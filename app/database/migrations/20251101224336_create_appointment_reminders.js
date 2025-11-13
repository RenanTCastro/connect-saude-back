exports.up = function(knex) {
  return knex.schema.createTable('appointment_reminders', table => {
    table.increments('id').primary();
    table.integer('appointment_id').notNullable().references('id').inTable('appointments');
    table.dateTime('send_at').notNullable()
    table.dateTime('sent_at').nullable()
    table.string('status', 50).defaultTo('pending')
    table.string('channel', 50)
    table.integer('sent_count').defaultTo(0)
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('appointment_reminders');
};
