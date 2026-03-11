/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('patients', table => {
    table.string('plan_card_number', 50);
    table.string('plan_holder', 255);
    table.string('plan_document', 20);
    table.text('observations');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('patients', table => {
    table.dropColumn('plan_card_number');
    table.dropColumn('plan_holder');
    table.dropColumn('plan_document');
    table.dropColumn('observations');
  });
};
