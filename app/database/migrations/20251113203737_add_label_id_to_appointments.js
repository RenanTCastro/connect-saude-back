/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('appointments', table => {
    table.integer('label_id').nullable().references('id').inTable('labels');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('appointments', table => {
    table.dropForeign('label_id');
    table.dropColumn('label_id');
  });
};
