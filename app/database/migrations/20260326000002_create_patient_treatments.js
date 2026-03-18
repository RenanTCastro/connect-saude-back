/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("patient_treatments", (table) => {
    table.increments("id").primary();
    table.integer("patient_id").notNullable().references("id").inTable("patients").onDelete("CASCADE");
    table.string("plan_type", 20).notNullable(); // 'plano' | 'particular'
    table.string("target_type", 20).notNullable(); // 'dente' | 'regiao'
    table.string("tooth_fdi", 10).nullable();
    table.string("region_name", 50).nullable();
    table.integer("procedure_id").nullable().references("id").inTable("procedures").onDelete("SET NULL");
    table.text("procedure_name").nullable();
    table.decimal("value", 12, 2).nullable();
    table.string("status", 30).notNullable().defaultTo("planejado"); // planejado | em_andamento | concluido | cancelado
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("patient_treatments");
};
