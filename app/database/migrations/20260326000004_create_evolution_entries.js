/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("evolution_entries", (table) => {
    table.increments("id").primary();
    table.integer("patient_id").notNullable().references("id").inTable("patients").onDelete("CASCADE");
    table.text("content").nullable();
    table.integer("folder_id").nullable().references("id").inTable("patient_folders").onDelete("SET NULL");
    table.date("occurred_at").notNullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("evolution_entries");
};
