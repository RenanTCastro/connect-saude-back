exports.up = function(knex) {
  return knex.schema.createTable('appointments', table => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.integer('patient_id').nullable().references('id').inTable('patients');
    table.string('type', 50).notNullable()
    table.string('title', 255).notNullable();
    table.text('description');
    table.dateTime('start_datetime').notNullable();
    table.dateTime('end_datetime').notNullable();
    table.string('status', 50).defaultTo('scheduled')
    table.integer('duration_minutes');
    table.integer('recurrence_id').nullable().references('id').inTable('appointment_recurrences');
    table.text('observation');
    table.date('follow_up_date');
    table.boolean('send_reminder').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('appointments');
};
