exports.up = function(knex) {
  return knex.schema.createTable('sales_opportunities', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('patient_id').unsigned().nullable().references('id').inTable('patients');
    table.integer('stage_id').unsigned().notNullable().references('id').inTable('sales_stages');
    table.string('title', 255).notNullable()
    table.text('description');
    table.decimal('estimated_value', 10, 2);
    table.string('label', 100);
    table.date('contact_date');
    table.date('next_action_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sales_opportunities');
};
