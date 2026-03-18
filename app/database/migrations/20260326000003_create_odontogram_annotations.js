/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("odontogram_annotations", (table) => {
    table.increments("id").primary();
    table.integer("patient_id").notNullable().references("id").inTable("patients").onDelete("CASCADE");
    table.string("dentition", 20).notNullable(); // 'permanent' | 'deciduous'
    table.string("element_type", 30).notNullable(); // tooth | maxila | mandibula | face | arcada_superior | arcada_inferior
    table.string("element_key", 50).notNullable();
    table.text("annotation_text").nullable();
    table.string("status", 50).nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("odontogram_annotations");
};
