exports.up = function(knex) {
  return knex.schema.createTable('sales_stages', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('name', 255).notNullable()
    table.integer('order_position').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sales_stages');
};
