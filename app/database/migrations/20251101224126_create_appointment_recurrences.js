exports.up = function(knex) {
  return knex.schema.createTable('appointment_recurrences', table => {
    table.increments('id').primary();
    table.string('frequency', 50).notNullable()
    table.integer('interval_value').defaultTo(1)
    table.string('days_of_week', 50)
    table.date('end_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('appointment_recurrences');
};
