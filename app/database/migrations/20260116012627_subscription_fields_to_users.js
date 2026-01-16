/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.table('users', table => {
      table.string('stripe_customer_id', 255).nullable();
      table.string('subscription_id', 255).nullable();
      table.enu('subscription_status', ['inactive', 'active', 'canceled', 'past_due']).nullable();
      table.timestamp('subscription_start_date').nullable();
      table.timestamp('subscription_end_date').nullable();
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.table('users', table => {
      table.dropColumn('stripe_customer_id');
      table.dropColumn('subscription_id');
      table.dropColumn('subscription_status');
      table.dropColumn('subscription_start_date');
      table.dropColumn('subscription_end_date');
    });
  };
  