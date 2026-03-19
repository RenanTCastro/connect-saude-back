/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await knex.schema.createTable("prescription_medications", (table) => {
    table.increments("id").primary();
    table.integer("user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("termo", 255).notNullable();
    table.string("apresentacao", 255).nullable();
    table.timestamps(true, true);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_prescription_medications_termo_trgm ON prescription_medications USING GIN (termo gin_trgm_ops)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_prescription_medications_apresentacao_trgm ON prescription_medications USING GIN (apresentacao gin_trgm_ops)'
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("prescription_medications");
};
