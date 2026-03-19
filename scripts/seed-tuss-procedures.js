/**
 * Script para popular a tabela procedures com os códigos TUSS padrão.
 * Os procedimentos TUSS ficam com user_id NULL e ficam disponíveis para todos os usuários.
 *
 * Uso: node scripts/seed-tuss-procedures.js [caminho_do_csv]
 * Se não informar o caminho, usa: data/tuss-procedures.csv (relativo à raiz do backend)
 */

require("dotenv").config();
const { readFileSync } = require("fs");
const { join } = require("path");
const knex = require("knex");
const config = require("../knexfile.js")[process.env.NODE_ENV || "development"];
const db = knex(config);

const ROOT = join(__dirname, "..");

function parseCSVLine(line) {
  const match = line.match(/^(\d+),(.+)$/);
  if (!match) return null;
  const [, code, name] = match;
  const cleanName = name.replace(/^"|"$/g, "").trim();
  return { tuss_code: code.trim(), name: cleanName };
}

async function seedTussProcedures(csvPath) {
  console.log("Lendo CSV:", csvPath);
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  const procedures = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row) procedures.push(row);
  }

  console.log(`Encontrados ${procedures.length} procedimentos TUSS.`);

  const existing = await db("procedures").whereNull("user_id").select("tuss_code");
  const existingCodes = new Set(existing.map((r) => r.tuss_code));

  const toInsert = procedures.filter((p) => !existingCodes.has(p.tuss_code));
  if (toInsert.length === 0) {
    console.log("Todos os procedimentos TUSS já estão cadastrados.");
    process.exit(0);
  }

  const now = new Date().toISOString();
  const rows = toInsert.map((p) => ({
    user_id: null,
    name: p.name,
    tuss_code: p.tuss_code,
    is_custom: false,
    created_at: now,
    updated_at: now,
  }));

  await db("procedures").insert(rows);
  console.log(`Inseridos ${rows.length} procedimentos TUSS.`);
}

async function main() {
  const csvPath =
    process.argv[2] ||
    join(ROOT, "data", "tuss-procedures.csv");

  try {
    await seedTussProcedures(csvPath);
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
