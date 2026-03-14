/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('patient_folders', table => {
    table.increments('id').primary();
    table.integer('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.integer('parent_id').nullable().references('id').inTable('patient_folders').onDelete('CASCADE');
    table.string('s3_prefix', 255).notNullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('patient_folders');
};
