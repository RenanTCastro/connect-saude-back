import db from "../database/index.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateJwt } from "../utils/jwt.js";

dotenv.config();

export default {
  async register(req, res, next) {
    try {
      const { email, password, name, phone } = req.body;
        
      // Validação de campos obrigatórios
      if (!email || !password || !name || !phone) {
          return res.status(400).json({ 
            error: "Os campos nome, e-mail, telefone e senha são obrigatórios" 
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

      // Insere o usuário e obtém o ID
      const [newUser] = await db("users")
        .insert({ 
          email: normalizedEmail, 
          password: hashedPassword, 
          name, 
          phone
        })
        .returning("id");

      const userId = newUser?.id || newUser;

      // Cria os estágios padrões de venda
      const defaultStages = [
        { name: "Primeiro Contato", order_position: 1 },
        { name: "Pendentes", order_position: 2 },
        { name: "Negociação", order_position: 3 },
        { name: "Fechamento", order_position: 4 },
      ];

      await db("sales_stages").insert(
        defaultStages.map(stage => ({
          user_id: userId,
          name: stage.name,
          order_position: stage.order_position,
          created_at: db.fn.now(),
        }))
      );

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
};