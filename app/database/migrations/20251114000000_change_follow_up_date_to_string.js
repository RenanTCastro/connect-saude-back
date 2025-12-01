/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.transaction(async (trx) => {
    // Primeiro, limpar os valores existentes (datas não podem ser convertidas diretamente para texto descritivo)
    await trx('appointments').update({ follow_up_date: null });
    
    // Depois, alterar o tipo da coluna para VARCHAR
    await trx.raw(`
      ALTER TABLE appointments 
      ALTER COLUMN follow_up_date TYPE VARCHAR(50);
    `);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.transaction(async (trx) => {
    // Limpar os valores antes de reverter (textos descritivos não podem ser convertidos para data)
    await trx('appointments').update({ follow_up_date: null });
    
    // Reverter o tipo da coluna para DATE
    await trx.raw(`
      ALTER TABLE appointments 
      ALTER COLUMN follow_up_date TYPE DATE;
    `);
  });
};

