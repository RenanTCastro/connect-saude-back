/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('patient_attachments', table => {
    table.increments('id').primary();
    table.integer('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('folder_id').nullable().references('id').inTable('patient_folders').onDelete('SET NULL');
    table.string('file_name', 255).notNullable();
    table.string('file_type', 50).notNullable(); // 'image' or 'document'
    table.integer('file_size').notNullable(); // in bytes
    table.string('s3_key', 500).notNullable();
    table.string('s3_bucket', 255).notNullable();
    table.string('mime_type', 100);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('patient_attachments');
};
