exports.up = function(knex) {
  return knex.schema.createTable('sales_notes', table => {
    table.increments('id').primary();
    table.integer('opportunity_id').unsigned().notNullable().references('id').inTable('sales_opportunities');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.text('content').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sales_notes');
};
