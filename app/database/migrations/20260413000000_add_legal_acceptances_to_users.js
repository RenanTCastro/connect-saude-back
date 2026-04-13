exports.up = function (knex) {
  return knex.schema.alterTable("users", (table) => {
    table.timestamp("lgpd_responsibility_accepted_at", { useTz: true }).nullable();
    table.timestamp("terms_of_use_accepted_at", { useTz: true }).nullable();
    table.timestamp("privacy_policy_accepted_at", { useTz: true }).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable("users", (table) => {
    table.dropColumn("lgpd_responsibility_accepted_at");
    table.dropColumn("terms_of_use_accepted_at");
    table.dropColumn("privacy_policy_accepted_at");
  });
};
