exports.up = function(knex) {
  return knex.schema.createTable('transactions', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('patient_id').unsigned().nullable().references('id').inTable('patients');
    table.string('type', 50).notNullable()
    table.string('title', 255).notNullable()
    table.text('description');
    table.string('category', 100);
    table.decimal('amount', 10, 2).notNullable();
    table.date('due_date');
    table.date('payment_date');
    table.boolean('is_paid').defaultTo(false);
    table.string('recurrence', 50);
    table.string('payment_method_id', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('transactions');
};
