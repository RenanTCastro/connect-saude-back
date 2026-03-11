/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.createTable('forms', table => {
        table.increments('id_form').primary();
        table.string('name').notNullable();
        table.text('description');
        table.string('type');
        table.timestamps(true, true);
    });
  
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
  
    await knex.schema.createTable('patient_forms', table => {
      table.increments('id_patient_form').primary();
      table.integer('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
      table.integer('id_form').notNullable().references('id_form').inTable('forms').onDelete('CASCADE');
      table.timestamp('filled_at').defaultTo(knex.fn.now());
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
  
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('patient_form_answers');
    await knex.schema.dropTableIfExists('patient_forms');
    await knex.schema.dropTableIfExists('form_questions');
    await knex.schema.dropTableIfExists('forms');
  };