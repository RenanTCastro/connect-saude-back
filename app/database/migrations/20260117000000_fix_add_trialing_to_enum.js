/**
 * Migration para garantir que 'trialing' esteja no enum subscription_status
 * Esta migração corrige o problema caso a migração anterior não tenha funcionado
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Tentar adicionar 'trialing' ao enum subscription_status
  // Primeiro tenta adicionar ao enum, depois verifica e atualiza constraint CHECK se necessário
  return knex.raw(`
    DO $$ 
    DECLARE
      enum_type_name text;
      enum_oid oid;
      value_exists boolean := false;
      constraint_exists boolean := false;
    BEGIN
      -- Tentar encontrar o tipo enum de várias formas
      -- 1. Buscar pelo nome da coluna diretamente
      SELECT pg_type.oid, pg_type.typname INTO enum_oid, enum_type_name
      FROM pg_catalog.pg_type
      JOIN pg_catalog.pg_attribute ON pg_attribute.atttypid = pg_type.oid
      JOIN pg_catalog.pg_class ON pg_class.oid = pg_attribute.attrelid
      JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_class.relname = 'users' 
        AND pg_attribute.attname = 'subscription_status'
        AND pg_type.typtype = 'e'
        AND pg_namespace.nspname = 'public'
      LIMIT 1;
      
      -- Se encontrou o tipo enum
      IF enum_type_name IS NOT NULL THEN
        -- Verificar se 'trialing' já existe
        SELECT EXISTS (
          SELECT 1 FROM pg_catalog.pg_enum 
          WHERE enumlabel = 'trialing' 
          AND enumtypid = enum_oid
        ) INTO value_exists;
        
        -- Se não existe, adicionar
        IF NOT value_exists THEN
          BEGIN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_type_name, 'trialing');
            RAISE NOTICE 'Valor "trialing" adicionado ao enum %', enum_type_name;
          EXCEPTION
            WHEN duplicate_object THEN
              RAISE NOTICE 'Valor "trialing" já existe no enum %', enum_type_name;
            WHEN OTHERS THEN
              RAISE NOTICE 'Erro ao adicionar "trialing" ao enum %: %', enum_type_name, SQLERRM;
          END;
        ELSE
          RAISE NOTICE 'Valor "trialing" já existe no enum %', enum_type_name;
        END IF;
      ELSE
        RAISE NOTICE 'Tipo enum não encontrado para subscription_status.';
      END IF;
      
      -- Verificar se existe constraint CHECK e atualizá-la se necessário
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_subscription_status_check'
      ) INTO constraint_exists;
      
      IF constraint_exists THEN
        -- Remover constraint antiga e criar nova com 'trialing' incluído
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
        ALTER TABLE users ADD CONSTRAINT users_subscription_status_check 
          CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due', 'trialing') OR subscription_status IS NULL);
        RAISE NOTICE 'Constraint CHECK atualizada para incluir "trialing"';
      END IF;
    END $$;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Nota: PostgreSQL não permite remover valores de enum diretamente
  console.warn('Rollback: Remover "trialing" do enum requer recriação do tipo. Não executado automaticamente.');
  return Promise.resolve();
};
