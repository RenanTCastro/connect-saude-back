/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("budgets", (table) => {
    table.increments("id").primary();
    table.integer("patient_id").notNullable().references("id").inTable("patients").onDelete("CASCADE");
    table.text("description").nullable();
    table.date("budget_date").nullable();
    table.decimal("discount", 12, 2).defaultTo(0);
    table.decimal("down_payment", 12, 2).defaultTo(0);
    table.integer("installments_count").defaultTo(1);
    table.timestamps(true, true);
  });

  await knex.schema.createTable("budget_treatments", (table) => {
    table.increments("id").primary();
    table.integer("budget_id").notNullable().references("id").inTable("budgets").onDelete("CASCADE");
    table.integer("treatment_id").notNullable().references("id").inTable("patient_treatments").onDelete("CASCADE");
    table.unique(["budget_id", "treatment_id"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("budget_treatments");
  await knex.schema.dropTableIfExists("budgets");
};
