import db from "../database/index.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { generateJwt } from "../utils/jwt.js";
import { createDefaultForms } from "../database/seeders/defaultForms.js";
import s3Client, { S3_BUCKET_NAME } from "../config/aws.js";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const MAX_LOGO_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default {
  async register(req, res, next) {
    try {
      const {
        email,
        password,
        name,
        phone,
        accept_lgpd_responsibility,
        accept_terms_of_use,
        accept_privacy_policy,
      } = req.body;

      // Validação de campos obrigatórios
      if (!email || !password || !name || !phone) {
          return res.status(400).json({ 
            error: "Os campos nome, e-mail, telefone e senha são obrigatórios" 
          });
      }

      if (
        accept_lgpd_responsibility !== true ||
        accept_terms_of_use !== true ||
        accept_privacy_policy !== true
      ) {
        return res.status(400).json({
          error:
            "É necessário aceitar a declaração de responsabilidade, os Termos de Uso e a Política de Privacidade para se cadastrar.",
        });
      }

      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
          return res.status(400).json({ 
            error: "Formato de e-mail inválido" 
          });
      }

      // Validação de senha mínima
      if (password.length < 8) {
          return res.status(400).json({ 
            error: "A senha deve ter no mínimo 8 caracteres" 
          });
      }

      // Normaliza o email para lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Verifica se o usuário já existe
      const existingUser = await db("users").where({ email: normalizedEmail }).first();

      if (existingUser) {
          return res.status(409).json({ 
            error: "E-mail já cadastrado" 
          });
      }

      // Hash da senha
      const hashedPassword = bcrypt.hashSync(password, 10);

      const acceptedAt = db.fn.now();

      // Insere o usuário e obtém o ID
      const [newUser] = await db("users")
        .insert({ 
          email: normalizedEmail, 
          password: hashedPassword, 
          name, 
          phone,
          lgpd_responsibility_accepted_at: acceptedAt,
          terms_of_use_accepted_at: acceptedAt,
          privacy_policy_accepted_at: acceptedAt,
        })
        .returning("id");

      const userId = newUser?.id || newUser;

      // Cria os estágios padrões de venda
      const defaultStages = [
        { name: "Primeiro Contato", order_position: 1 },
        { name: "Negociação", order_position: 2 },
        { name: "Fechado - ganho", order_position: 3 },
        { name: "Fechado - perdido", order_position: 4 },
      ];

      await db("sales_stages").insert(
        defaultStages.map(stage => ({
          user_id: userId,
          name: stage.name,
          order_position: stage.order_position,
          created_at: db.fn.now(),
        }))
      );

      // Cria os formulários padrão de anamnese
      try {
        await createDefaultForms(userId);
      } catch (formError) {
        console.error("Erro ao criar formulários padrão:", formError);
        // Não falha o registro se houver erro ao criar formulários
      }

      return res.status(201).json({ 
        message: "Usuário registrado com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);
      
      // Tratamento de erros específicos do banco de dados
      if (error.code === 'SQLITE_CONSTRAINT' || error.code === '23505') {
        return res.status(409).json({ 
          error: "E-mail já cadastrado" 
        });
      }
      
      if (error.code === 'SQLITE_ERROR' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: "Erro de conexão com o banco de dados. Tente novamente mais tarde." 
        });
      }

      return res.status(500).json({ 
        error: "Erro interno do servidor ao registrar usuário" 
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validação de campos obrigatórios
      if (!email || !password) {
        return res.status(400).json({ 
          error: "É necessário preencher todos os campos" 
        });
      }

      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          error: "Formato de e-mail inválido" 
        });
      }

      // Normaliza o email para lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Busca o usuário
      const user = await db("users").where({ email: normalizedEmail }).first();

      if (!user) {
        return res.status(401).json({ 
          error: "E-mail ou senha incorretos" 
        });
      }

      // Verifica a senha
      const isPasswordValid = bcrypt.compareSync(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: "E-mail ou senha incorretos" 
        });
      }

      // Gera o token
      const token = await generateJwt({ user_id: user.id });
      
      return res.status(200).json({ 
        token: token 
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      
      // Tratamento de erros específicos
      if (error.code === 'SQLITE_ERROR' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: "Erro de conexão com o banco de dados. Tente novamente mais tarde." 
        });
      }

      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(500).json({ 
          error: "Erro ao gerar token de autenticação" 
        });
      }

      return res.status(500).json({ 
        error: "Erro interno do servidor ao fazer login" 
      });
    }
  },

  async getProfile(req, res) {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          error: "Usuário não autenticado",
        });
      }

      const user = await db("users")
        .where({ id: userId })
        .first(
          "id",
          "name",
          "email",
          "phone",
          "address",
          "cro_number",
          "professional_phone",
          "specialty",
          "logo_s3_key"
        );

      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado",
        });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Erro ao buscar perfil do usuário:", error);

      if (error.code === "SQLITE_ERROR" || error.code === "ECONNREFUSED") {
        return res.status(503).json({
          error: "Erro de conexão com o banco de dados. Tente novamente mais tarde.",
        });
      }

      return res.status(500).json({
        error: "Erro interno do servidor ao buscar perfil do usuário",
      });
    }
  },

  async updateProfile(req, res) {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          error: "Usuário não autenticado",
        });
      }

      const {
        name,
        phone,
        address,
        cro_number,
        professional_phone,
        specialty,
        logo_s3_key,
      } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "O nome é obrigatório",
        });
      }

      const updateData = {
        name: name.trim(),
      };

      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address?.trim() || null;
      if (cro_number !== undefined) updateData.cro_number = cro_number?.trim() || null;
      if (professional_phone !== undefined)
        updateData.professional_phone = professional_phone?.trim() || null;
      if (specialty !== undefined) updateData.specialty = specialty?.trim() || null;

      if (logo_s3_key !== undefined) {
        const currentUser = await db("users").where({ id: userId }).first("logo_s3_key");
        const oldLogoKey = currentUser?.logo_s3_key;

        if (oldLogoKey && oldLogoKey !== logo_s3_key) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldLogoKey })
            );
          } catch (s3Err) {
            console.error("Erro ao deletar logo antiga do S3:", s3Err);
          }
        }
        updateData.logo_s3_key = logo_s3_key || null;
      }

      await db("users").where({ id: userId }).update(updateData);

      const updatedUser = await db("users")
        .where({ id: userId })
        .first(
          "id",
          "name",
          "email",
          "phone",
          "address",
          "cro_number",
          "professional_phone",
          "specialty",
          "logo_s3_key"
        );

      return res.status(200).json({
        message: "Perfil atualizado com sucesso",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil do usuário:", error);

      if (error.code === "SQLITE_ERROR" || error.code === "ECONNREFUSED") {
        return res.status(503).json({
          error: "Erro de conexão com o banco de dados. Tente novamente mais tarde.",
        });
      }

      return res.status(500).json({
        error: "Erro interno do servidor ao atualizar perfil do usuário",
      });
    }
  },

  async generateLogoUploadUrl(req, res) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const { fileName, fileSize, mimeType } = req.body;
      if (!fileName || !fileSize) {
        return res.status(400).json({
          error: "Campos 'fileName' e 'fileSize' são obrigatórios.",
        });
      }

      if (fileSize > MAX_LOGO_SIZE) {
        return res.status(400).json({
          error: "Arquivo muito grande! O tamanho máximo permitido é 15MB.",
        });
      }

      const allowed = ALLOWED_LOGO_TYPES.includes(mimeType);
      if (!allowed) {
        return res.status(400).json({
          error: "Formato não permitido. Use JPEG, PNG ou WebP.",
        });
      }

      const fileId = randomUUID();
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const s3Key = `users/${userId}/logo/${fileId}-${timestamp}-${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: mimeType || "image/jpeg",
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

      return res.status(200).json({ uploadUrl, s3Key, fileId });
    } catch (error) {
      console.error("Erro ao gerar URL de upload da logo:", error);
      return res.status(500).json({
        error: "Erro ao gerar URL de upload da logo.",
        details: error.message,
      });
    }
  },

  async getLogoUrl(req, res) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const user = await db("users")
        .where({ id: userId })
        .first("logo_s3_key");

      if (!user?.logo_s3_key) {
        return res.status(404).json({ error: "Logo não encontrada." });
      }

      const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: user.logo_s3_key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return res.status(200).json({ url });
    } catch (error) {
      console.error("Erro ao obter URL da logo:", error);
      return res.status(500).json({
        error: "Erro ao obter URL da logo.",
        details: error.message,
      });
    }
  },

  async deleteLogo(req, res) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const user = await db("users").where({ id: userId }).first("logo_s3_key");
      if (!user?.logo_s3_key) {
        return res.status(404).json({ error: "Logo não encontrada." });
      }

      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: user.logo_s3_key })
        );
      } catch (s3Err) {
        console.error("Erro ao deletar logo do S3:", s3Err);
      }

      await db("users").where({ id: userId }).update({ logo_s3_key: null });

      return res.status(200).json({ message: "Logo removida com sucesso." });
    } catch (error) {
      console.error("Erro ao remover logo:", error);
      return res.status(500).json({
        error: "Erro ao remover logo.",
        details: error.message,
      });
    }
  },
};