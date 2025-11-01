exports.up = function(knex) {
  return knex.schema.createTable('installments', table => {
    table.increments('id').primary();
    table.integer('transaction_id').unsigned().notNullable().references('id').inTable('transactions');
    table.integer('installment_number').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.date('due_date').notNullable();
    table.date('payment_date');
    table.boolean('is_paid').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('installments');
};
