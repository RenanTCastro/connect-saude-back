exports.up = function(knex) {
  return knex.schema.createTable('inventory_quantity_history', table => {
    table.increments('id').primary();
    table.integer('inventory_item_id').notNullable().references('id').inTable('inventory_items').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.integer('previous_quantity').notNullable().defaultTo(0);
    table.integer('new_quantity').notNullable();
    table.integer('change_amount').notNullable().comment('Positivo = entrada, Negativo = saída');
    table.string('type', 50).notNullable().comment('entrada_inicial | entrada | saida | ajuste');
    table.string('notes', 500).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('inventory_quantity_history');
};
