exports.up = function(knex) {
  return knex.schema.createTable('patients', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('patient_number').notNullable()
    table.string('full_name', 255).notNullable();
    table.string('gender', 50);
    table.string('phone', 50);
    table.string('street', 255);
    table.string('neighborhood', 255);
    table.string('city', 255);
    table.string('state', 10);
    table.string('zip_code', 20);
    table.date('birth_date');
    table.string('cpf', 20).unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('patients');
};
