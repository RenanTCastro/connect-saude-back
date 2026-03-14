import db from "../database/index.js";
import s3Client, { S3_BUCKET_NAME } from "../config/aws.js";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Helper para validar que o paciente pertence ao usuário
async function validatePatientOwnership(userId, patientId) {
  const patient = await db("patients")
    .where({ id: patientId, user_id: userId })
    .first();
  
  if (!patient) {
    throw new Error("Paciente não encontrado ou não pertence ao usuário");
  }
  
  return patient;
}

// Helper para determinar tipo de arquivo
function getFileType(mimeType, fileName) {
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  return "document";
}

export default {
  // Gera presigned URL para upload
  async generateUploadUrl(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const { fileName, fileType, fileSize, folderId } = req.body;

      // Validar campos obrigatórios
      if (!fileName || !fileSize) {
        return res.status(400).json({
          error: "Campos 'fileName' e 'fileSize' são obrigatórios.",
        });
      }

      // Validar tamanho do arquivo
      if (fileSize > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: `Arquivo muito grande! O tamanho máximo permitido é ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, patientId);

      // Validar folderId se fornecido
      if (folderId) {
        const folder = await db("patient_folders")
          .where({ id: folderId, patient_id: patientId })
          .first();
        
        if (!folder) {
          return res.status(404).json({
            error: "Pasta não encontrada.",
          });
        }
      }

      // Gerar ID único para o arquivo
      const fileId = randomUUID();
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const s3Key = `patients/${patientId}/files/${fileId}-${timestamp}-${sanitizedFileName}`;

      // Determinar tipo de arquivo
      const detectedFileType = fileType || getFileType(null, fileName);

      // Criar comando PutObject
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: req.body.mimeType || "application/octet-stream",
      });

      // Gerar presigned URL (expira em 5 minutos)
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d13a1be9-16a7-4807-ac4a-57af8f7d3bb6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AttachmentController.js:85',message:'Presigned URL gerada',data:{uploadUrl:uploadUrl.substring(0,100)+'...',s3Key,fileId,fileName,bucket:S3_BUCKET_NAME},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return res.status(200).json({
        uploadUrl,
        fileId,
        s3Key,
        fileType: detectedFileType,
      });
    } catch (error) {
      console.error("Erro ao gerar URL de upload:", error);
      return res.status(500).json({
        error: "Erro ao gerar URL de upload.",
        details: error.message,
      });
    }
  },

  // Confirma upload e salva no banco
  async confirmUpload(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const { fileId, fileName, fileType, fileSize, folderId, s3Key, mimeType } = req.body;

      // Validar campos obrigatórios
      if (!fileId || !fileName || !fileType || !fileSize || !s3Key) {
        return res.status(400).json({
          error: "Campos obrigatórios: fileId, fileName, fileType, fileSize, s3Key",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, patientId);

      // Validar folderId se fornecido
      if (folderId) {
        const folder = await db("patient_folders")
          .where({ id: folderId, patient_id: patientId })
          .first();
        
        if (!folder) {
          return res.status(404).json({
            error: "Pasta não encontrada.",
          });
        }
      }

      // Inserir registro no banco
      const [attachment] = await db("patient_attachments")
        .insert({
          patient_id: patientId,
          folder_id: folderId || null,
          file_name: fileName,
          file_type: fileType,
          file_size: fileSize,
          s3_key: s3Key,
          s3_bucket: S3_BUCKET_NAME,
          mime_type: mimeType || null,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(attachment);
    } catch (error) {
      console.error("Erro ao confirmar upload:", error);
      return res.status(500).json({
        error: "Erro ao confirmar upload.",
        details: error.message,
      });
    }
  },

  // Lista anexos do paciente
  async getAttachments(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const folderId = req.query.folderId ? parseInt(req.query.folderId) : null;

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, patientId);

      // Buscar pastas
      const foldersQuery = db("patient_folders")
        .where({ patient_id: patientId });
      
      if (folderId === null) {
        foldersQuery.whereNull("parent_id");
      } else if (folderId !== undefined) {
        foldersQuery.where({ parent_id: folderId });
      }

      const folders = await foldersQuery.orderBy("name");

      // Buscar anexos
      const attachmentsQuery = db("patient_attachments")
        .where({ patient_id: patientId });
      
      if (folderId === null) {
        attachmentsQuery.whereNull("folder_id");
      } else if (folderId !== undefined) {
        attachmentsQuery.where({ folder_id: folderId });
      }

      const attachments = await attachmentsQuery.orderBy("created_at", "desc");

      return res.status(200).json({
        folders,
        attachments,
      });
    } catch (error) {
      console.error("Erro ao buscar anexos:", error);
      return res.status(500).json({
        error: "Erro ao buscar anexos.",
        details: error.message,
      });
    }
  },

  // Gera presigned URL para download
  async getDownloadUrl(req, res) {
    try {
      const userId = req.user.user_id;
      const attachmentId = parseInt(req.params.id);

      // Buscar anexo
      const attachment = await db("patient_attachments")
        .where({ id: attachmentId })
        .first();

      if (!attachment) {
        return res.status(404).json({
          error: "Anexo não encontrado.",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, attachment.patient_id);

      // Criar comando GetObject
      const command = new GetObjectCommand({
        Bucket: attachment.s3_bucket,
        Key: attachment.s3_key,
      });

      // Gerar presigned URL (expira em 1 hora)
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return res.status(200).json({
        downloadUrl,
        fileName: attachment.file_name,
      });
    } catch (error) {
      console.error("Erro ao gerar URL de download:", error);
      return res.status(500).json({
        error: "Erro ao gerar URL de download.",
        details: error.message,
      });
    }
  },

  // Deleta anexo
  async deleteAttachment(req, res) {
    try {
      const userId = req.user.user_id;
      const attachmentId = parseInt(req.params.id);

      // Buscar anexo
      const attachment = await db("patient_attachments")
        .where({ id: attachmentId })
        .first();

      if (!attachment) {
        return res.status(404).json({
          error: "Anexo não encontrado.",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, attachment.patient_id);

      // Deletar do S3
      try {
        const command = new DeleteObjectCommand({
          Bucket: attachment.s3_bucket,
          Key: attachment.s3_key,
        });
        await s3Client.send(command);
      } catch (s3Error) {
        console.error("Erro ao deletar do S3:", s3Error);
        // Continuar mesmo se falhar no S3 (pode já ter sido deletado)
      }

      // Deletar do banco
      await db("patient_attachments")
        .where({ id: attachmentId })
        .delete();

      return res.status(200).json({
        message: "Anexo deletado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao deletar anexo:", error);
      return res.status(500).json({
        error: "Erro ao deletar anexo.",
        details: error.message,
      });
    }
  },
};
