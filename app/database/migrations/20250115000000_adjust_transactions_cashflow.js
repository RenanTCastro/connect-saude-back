exports.up = async function(knex) {
  // Verificar se a coluna payment_method_id existe
  const hasPaymentMethodId = await knex.schema.hasColumn('transactions', 'payment_method_id');
  const hasPaymentType = await knex.schema.hasColumn('transactions', 'payment_type');
  
  // Se payment_method_id existe e payment_type não existe, renomear
  if (hasPaymentMethodId && !hasPaymentType) {
    await knex.schema.table('transactions', table => {
      table.renameColumn('payment_method_id', 'payment_type');
    });
  } else if (!hasPaymentType) {
    // Se nenhuma das colunas existe, criar payment_type
    await knex.schema.table('transactions', table => {
      table.string('payment_type', 50);
    });
  }
  
  // Alterar recurrence de string(50) para text para armazenar JSON
  // Verificar se a coluna existe primeiro
  const hasRecurrence = await knex.schema.hasColumn('transactions', 'recurrence');
  if (hasRecurrence) {
    await knex.raw('ALTER TABLE transactions ALTER COLUMN recurrence TYPE text');
  }
};

exports.down = function(knex) {
  return knex.raw('ALTER TABLE transactions ALTER COLUMN recurrence TYPE varchar(50)')
    .then(() => {
      return knex.schema.table('transactions', table => {
        // Reverter alterações
        table.renameColumn('payment_type', 'payment_method_id');
      });
    });
};

