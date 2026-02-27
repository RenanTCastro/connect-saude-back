/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('appointment_reminders', table => {
    table.renameColumn('channel', 'template_type');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('appointment_reminders', table => {
    table.renameColumn('template_type', 'channel');
  });
};
