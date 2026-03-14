import db from "../database/index.js";

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

export default {
  // Criar pasta
  async createFolder(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const { name, parentId } = req.body;

      // Validar campos obrigatórios
      if (!name || name.trim() === "") {
        return res.status(400).json({
          error: "Campo 'name' é obrigatório.",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, patientId);

      // Validar parentId se fornecido
      if (parentId) {
        const parentFolder = await db("patient_folders")
          .where({ id: parentId, patient_id: patientId })
          .first();
        
        if (!parentFolder) {
          return res.status(404).json({
            error: "Pasta pai não encontrada.",
          });
        }
      }

      // Gerar s3_prefix fixo baseado em ID (será atualizado após inserção)
      const s3Prefix = `folder-${Date.now()}`;

      // Inserir pasta
      const [folder] = await db("patient_folders")
        .insert({
          patient_id: patientId,
          name: name.trim(),
          parent_id: parentId || null,
          s3_prefix: s3Prefix,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      // Atualizar s3_prefix com o ID real
      await db("patient_folders")
        .where({ id: folder.id })
        .update({ s3_prefix: `folder-${folder.id}` });

      folder.s3_prefix = `folder-${folder.id}`;

      return res.status(201).json(folder);
    } catch (error) {
      console.error("Erro ao criar pasta:", error);
      return res.status(500).json({
        error: "Erro ao criar pasta.",
        details: error.message,
      });
    }
  },

  // Atualizar nome da pasta
  async updateFolder(req, res) {
    try {
      const userId = req.user.user_id;
      const folderId = parseInt(req.params.id);
      const { name } = req.body;

      // Validar campos obrigatórios
      if (!name || name.trim() === "") {
        return res.status(400).json({
          error: "Campo 'name' é obrigatório.",
        });
      }

      // Buscar pasta
      const folder = await db("patient_folders")
        .where({ id: folderId })
        .first();

      if (!folder) {
        return res.status(404).json({
          error: "Pasta não encontrada.",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, folder.patient_id);

      // Atualizar apenas o nome (sem mexer no S3)
      const [updatedFolder] = await db("patient_folders")
        .where({ id: folderId })
        .update({
          name: name.trim(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(200).json(updatedFolder);
    } catch (error) {
      console.error("Erro ao atualizar pasta:", error);
      return res.status(500).json({
        error: "Erro ao atualizar pasta.",
        details: error.message,
      });
    }
  },

  // Deletar pasta
  async deleteFolder(req, res) {
    try {
      const userId = req.user.user_id;
      const folderId = parseInt(req.params.id);

      // Buscar pasta
      const folder = await db("patient_folders")
        .where({ id: folderId })
        .first();

      if (!folder) {
        return res.status(404).json({
          error: "Pasta não encontrada.",
        });
      }

      // Validar que o paciente pertence ao usuário
      await validatePatientOwnership(userId, folder.patient_id);

      // Verificar se pasta tem subpastas
      const subfolders = await db("patient_folders")
        .where({ parent_id: folderId })
        .count("* as count")
        .first();

      if (parseInt(subfolders.count) > 0) {
        return res.status(400).json({
          error: "Não é possível deletar pasta que contém subpastas.",
        });
      }

      // Verificar se pasta tem anexos
      const attachments = await db("patient_attachments")
        .where({ folder_id: folderId })
        .count("* as count")
        .first();

      if (parseInt(attachments.count) > 0) {
        return res.status(400).json({
          error: "Não é possível deletar pasta que contém anexos.",
        });
      }

      // Deletar pasta (hard delete)
      await db("patient_folders")
        .where({ id: folderId })
        .delete();

      return res.status(200).json({
        message: "Pasta deletada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao deletar pasta:", error);
      return res.status(500).json({
        error: "Erro ao deletar pasta.",
        details: error.message,
      });
    }
  },

  // Mover anexo entre pastas
  async moveAttachment(req, res) {
    try {
      const userId = req.user.user_id;
      const attachmentId = parseInt(req.params.id);
      const { targetFolderId } = req.body;

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

      // Validar targetFolderId se fornecido
      if (targetFolderId !== null && targetFolderId !== undefined) {
        const targetFolder = await db("patient_folders")
          .where({ id: targetFolderId, patient_id: attachment.patient_id })
          .first();
        
        if (!targetFolder) {
          return res.status(404).json({
            error: "Pasta de destino não encontrada.",
          });
        }
      }

      // Atualizar folder_id (sem mexer no S3)
      const [updatedAttachment] = await db("patient_attachments")
        .where({ id: attachmentId })
        .update({
          folder_id: targetFolderId || null,
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(200).json(updatedAttachment);
    } catch (error) {
      console.error("Erro ao mover anexo:", error);
      return res.status(500).json({
        error: "Erro ao mover anexo.",
        details: error.message,
      });
    }
  },
};
