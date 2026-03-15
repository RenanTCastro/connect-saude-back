/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Remover foreign keys e tabelas antigas primeiro
  await knex.schema.dropTableIfExists('patient_form_answers');
  await knex.schema.dropTableIfExists('form_questions');
  
  // Adicionar user_id e form_structure na tabela forms
  await knex.schema.alterTable('forms', table => {
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('form_structure');
  });
  
  // Adicionar responses (JSON) na tabela patient_forms
  await knex.schema.alterTable('patient_forms', table => {
    table.text('responses');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Remover campos adicionados
  await knex.schema.alterTable('patient_forms', table => {
    table.dropColumn('responses');
  });
  
  await knex.schema.alterTable('forms', table => {
    table.dropColumn('form_structure');
    table.dropColumn('user_id');
  });
  
  // Recriar tabelas antigas (estrutura básica)
  await knex.schema.createTable('form_questions', table => {
    table.increments('id_question').primary();
    table.integer('id_form').notNullable().references('id_form').inTable('forms').onDelete('CASCADE');   
    table.text('question').notNullable();
    table.string('answer_type').notNullable();     
    table.boolean('required').defaultTo(false);
    table.boolean('has_comment').defaultTo(false);
    table.integer('order');
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('patient_form_answers', table => {
    table.increments('id_answer').primary();
    table.integer('id_patient_form').notNullable().references('id_patient_form').inTable('patient_forms').onDelete('CASCADE');
    table.integer('id_question').notNullable().references('id_question').inTable('form_questions').onDelete('CASCADE');
    table.text('answer');
    table.text('comment');
    table.timestamps(true, true);
  });
};
