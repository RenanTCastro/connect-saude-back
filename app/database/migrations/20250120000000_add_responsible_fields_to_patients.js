/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('patients', table => {
    table.string('responsible_name', 255);
    table.string('responsible_cpf', 20);
    table.string('responsible_phone', 50);
    table.string('responsible_email', 255);
    table.string('responsible_relationship', 50);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('patients', table => {
    table.dropColumn('responsible_name');
    table.dropColumn('responsible_cpf');
    table.dropColumn('responsible_phone');
    table.dropColumn('responsible_email');
    table.dropColumn('responsible_relationship');
  });
};
