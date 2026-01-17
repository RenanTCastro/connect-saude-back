/**
 * Migration para adicionar 'trialing' ao enum subscription_status
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Adicionar 'trialing' ao enum subscription_status
  // O Knex cria enums, precisamos encontrar o nome do tipo enum criado
  return knex.raw(`
    DO $$ 
    DECLARE
      enum_type_name text;
      enum_oid oid;
    BEGIN
      -- Encontrar o nome do tipo enum usado na coluna subscription_status da tabela users
      -- Buscar o tipo diretamente da coluna usando pg_attribute
      SELECT pg_type.oid, pg_type.typname INTO enum_oid, enum_type_name
      FROM pg_catalog.pg_type
      JOIN pg_catalog.pg_attribute ON pg_attribute.atttypid = pg_type.oid
      JOIN pg_catalog.pg_class ON pg_class.oid = pg_attribute.attrelid
      JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_class.relname = 'users' 
        AND pg_attribute.attname = 'subscription_status'
        AND pg_type.typtype = 'e'  -- 'e' significa ENUM type
        AND pg_namespace.nspname = 'public'
      LIMIT 1;
      
      -- Se encontrou o tipo enum e 'trialing' ainda não existe, adicionar
      IF enum_type_name IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_enum 
          WHERE enumlabel = 'trialing' 
          AND enumtypid = enum_oid
        ) THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_type_name, 'trialing');
          RAISE NOTICE 'Valor "trialing" adicionado ao enum %', enum_type_name;
        ELSE
          RAISE NOTICE 'Valor "trialing" já existe no enum %', enum_type_name;
        END IF;
      ELSE
        RAISE NOTICE 'Tipo enum não encontrado para subscription_status';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Se der erro, mostrar mas continuar
        RAISE NOTICE 'Erro ao adicionar valor ao enum: %', SQLERRM;
        RAISE;
    END $$;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Nota: PostgreSQL não permite remover valores de enum diretamente
  // Para fazer rollback, seria necessário recriar o enum sem 'trialing'
  // e atualizar os dados existentes. Como isso é complexo, vamos apenas
  // deixar um aviso no console.
  console.warn('Rollback: Remover "trialing" do enum requer recriação do tipo. Não executado automaticamente.');
  return Promise.resolve();
};
