import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export async function generateJwt(params = {}) {
  return jwt.sign(params, process.env.JWT_SECRET, { expiresIn: 86400 });
}