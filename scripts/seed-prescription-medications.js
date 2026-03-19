/**
 * Script para popular a tabela prescription_medications.
 * Compatível com TUSS Tabela 20: Código do Termo, Termo, Apresentação
 *
 * Uso: node scripts/seed-prescription-medications.js [caminho_do_csv]
 * Ex: node scripts/seed-prescription-medications.js "C:\Users\...\TUSS - Tabela_20_Medicamentos.csv"
 */

require("dotenv").config();
const { readFileSync } = require("fs");
const { join } = require("path");
const knex = require("knex");
const config = require("../knexfile.js")[process.env.NODE_ENV || "development"];
const db = knex(config);

const ROOT = join(__dirname, "..");

/** Parseia linha CSV respeitando aspas (campos com vírgula dentro) */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.replace(/^"|"$/g, "").trim());
  return result;
}

async function seedPrescriptionMedications(csvPath) {
  console.log("Lendo CSV:", csvPath);
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    console.log("CSV precisa ter header e ao menos uma linha de dados.");
    process.exit(1);
  }

  const headerNorm = parseCSVLine(lines[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const termoIdx = headerNorm.findIndex((h) => h === "termo" || h === "denominacao");
  const apresIdx = headerNorm.findIndex((h) => h === "apresentacao");
  if (termoIdx < 0) {
    console.log("CSV precisa ter coluna 'termo' (ou 'denominacao').");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    const termo = (parts[termoIdx] || "").trim();
    if (!termo) continue;
    const apresentacao = apresIdx >= 0 ? (parts[apresIdx] || "").trim() || null : null;
    rows.push({
      user_id: null,
      termo,
      apresentacao,
      created_at: now,
      updated_at: now,
    });
  }

  if (rows.length === 0) {
    console.log("Nenhuma linha válida encontrada.");
    process.exit(0);
  }

  const clearFirst = process.argv.includes("--clear");
  if (clearFirst) {
    console.log("Limpando tabela existente...");
    await db("prescription_medications").whereNull("user_id").del();
  }

  console.log(`Inserindo ${rows.length} medicamentos...`);
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db("prescription_medications").insert(batch);
    console.log(`  ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }
  console.log("Concluído.");
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--clear");
  const csvPath = args[0] || join(ROOT, "data", "prescription-medications.csv");
  try {
    await seedPrescriptionMedications(csvPath);
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
