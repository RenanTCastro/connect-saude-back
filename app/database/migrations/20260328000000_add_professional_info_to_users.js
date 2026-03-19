/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.string("address", 500).nullable();
    table.string("cro_number", 50).nullable();
    table.string("professional_phone", 20).nullable();
    table.string("specialty", 100).nullable();
    table.string("logo_s3_key", 512).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("address");
    table.dropColumn("cro_number");
    table.dropColumn("professional_phone");
    table.dropColumn("specialty");
    table.dropColumn("logo_s3_key");
  });
};
