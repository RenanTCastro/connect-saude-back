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
        
      if (!email || !password || !name || !phone) {
          return res.status(400).json({ error: "Os campos nome, e-mail, telefone e senha são obrigatórios" });
      }

      // Normaliza o email para lowercase
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await db("users").where({ email: normalizedEmail }).first();

      if (existingUser) {
          return res.status(400).json({ error: "E-mail já cadastrado" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      await db("users").insert({ email: normalizedEmail, password: hashedPassword, name, phone});

      return res.status(201).json({ message: "Usuário registrado com sucesso" });
    } catch (error) {
      console.log("Erro ao registrar usuário", error);
      return res.status(500).json({ error: "Erro ao registrar usuário" });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!(email && password)) {
        return res
          .status(400)
          .json({ message: "É necessário preencher todos os campos" });
      }

      // Normaliza o email para lowercase
      const normalizedEmail = email.toLowerCase().trim();

      const user = await db("users").where({ email: normalizedEmail });

      if (!user.length) {
        res.status(401).json({ message: "Usuário não existe" });
      } else {
        const isPasswordValid = bcrypt.compareSync(password, user[0].password);

        if (!isPasswordValid) {
            res.status(401).json({ message: "Senha incorreta" });
        } else {
            const token = await generateJwt({ user_id: user[0].id });
            res.send({ token: token });
        }
      }
    } catch (error) {
      console.log("Erro ao fazer login", error);
      return res.status(500).json({ error: "Erro ao fazer login" });
    }
  },
};