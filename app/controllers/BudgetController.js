import db from "../database/index.js";

async function validatePatientOwnership(userId, patientId) {
  const patient = await db("patients")
    .where({ id: patientId, user_id: userId })
    .first();
  if (!patient) {
    throw new Error("Paciente não encontrado ou não pertence ao usuário");
  }
  return patient;
}

async function validateBudgetOwnership(userId, budgetId) {
  const budget = await db("budgets").where({ id: budgetId }).first();
  if (!budget) {
    throw new Error("Orçamento não encontrado");
  }
  await validatePatientOwnership(userId, budget.patient_id);
  return budget;
}

export default {
  async list(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      await validatePatientOwnership(userId, patientId);

      const budgets = await db("budgets")
        .where({ patient_id: patientId })
        .orderBy("budget_date", "desc")
        .orderBy("created_at", "desc")
        .select("*");

      return res.status(200).json(budgets);
    } catch (error) {
      console.error("Erro ao listar orçamentos:", error);
      return res.status(500).json({
        error: "Erro ao listar orçamentos.",
        details: error.message,
      });
    }
  },

  async get(req, res) {
    try {
      const userId = req.user.user_id;
      const budgetId = parseInt(req.params.id);
      const budget = await validateBudgetOwnership(userId, budgetId);

      const treatmentIds = await db("budget_treatments")
        .where({ budget_id: budgetId })
        .select("treatment_id")
        .then((rows) => rows.map((r) => r.treatment_id));

      const treatments =
        treatmentIds.length > 0
          ? await db("patient_treatments")
              .whereIn("id", treatmentIds)
              .select("*")
          : [];

      return res.status(200).json({
        ...budget,
        treatments,
        treatment_ids: treatmentIds,
      });
    } catch (error) {
      console.error("Erro ao obter orçamento:", error);
      return res.status(500).json({
        error: "Erro ao obter orçamento.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const {
        description,
        budget_date,
        discount,
        down_payment,
        installments_count,
        treatment_ids,
      } = req.body;

      await validatePatientOwnership(userId, patientId);

      const [budget] = await db("budgets")
        .insert({
          patient_id: patientId,
          description: description || null,
          budget_date: budget_date || null,
          discount: discount != null ? parseFloat(discount) : 0,
          down_payment: down_payment != null ? parseFloat(down_payment) : 0,
          installments_count: installments_count != null ? parseInt(installments_count, 10) : 1,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      const ids = Array.isArray(treatment_ids) ? treatment_ids : [];
      if (ids.length > 0) {
        const rows = ids.map((tid) => ({
          budget_id: budget.id,
          treatment_id: parseInt(tid, 10),
        }));
        await db("budget_treatments").insert(rows);
      }

      const treatmentIds = await db("budget_treatments")
        .where({ budget_id: budget.id })
        .select("treatment_id")
        .then((rows) => rows.map((r) => r.treatment_id));

      const treatments =
        treatmentIds.length > 0
          ? await db("patient_treatments")
              .whereIn("id", treatmentIds)
              .select("*")
          : [];

      return res.status(201).json({
        ...budget,
        treatments,
        treatment_ids: treatmentIds,
      });
    } catch (error) {
      console.error("Erro ao criar orçamento:", error);
      return res.status(500).json({
        error: "Erro ao criar orçamento.",
        details: error.message,
      });
    }
  },

  async update(req, res) {
    try {
      const userId = req.user.user_id;
      const budgetId = parseInt(req.params.id);
      const {
        description,
        budget_date,
        discount,
        down_payment,
        installments_count,
        treatment_ids,
      } = req.body;

      await validateBudgetOwnership(userId, budgetId);

      const updates = { updated_at: db.fn.now() };
      if (description !== undefined) updates.description = description || null;
      if (budget_date !== undefined) updates.budget_date = budget_date || null;
      if (discount !== undefined) updates.discount = parseFloat(discount) || 0;
      if (down_payment !== undefined) updates.down_payment = parseFloat(down_payment) || 0;
      if (installments_count !== undefined) updates.installments_count = parseInt(installments_count, 10) || 1;

      const [budget] = await db("budgets")
        .where({ id: budgetId })
        .update(updates)
        .returning("*");

      if (Array.isArray(treatment_ids)) {
        await db("budget_treatments").where({ budget_id: budgetId }).del();
        if (treatment_ids.length > 0) {
          const rows = treatment_ids.map((tid) => ({
            budget_id: budgetId,
            treatment_id: parseInt(tid, 10),
          }));
          await db("budget_treatments").insert(rows);
        }
      }

      const treatmentIds = await db("budget_treatments")
        .where({ budget_id: budgetId })
        .select("treatment_id")
        .then((rows) => rows.map((r) => r.treatment_id));

      const treatments =
        treatmentIds.length > 0
          ? await db("patient_treatments")
              .whereIn("id", treatmentIds)
              .select("*")
          : [];

      return res.status(200).json({
        ...budget,
        treatments,
        treatment_ids: treatmentIds,
      });
    } catch (error) {
      console.error("Erro ao atualizar orçamento:", error);
      return res.status(500).json({
        error: "Erro ao atualizar orçamento.",
        details: error.message,
      });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.user.user_id;
      const budgetId = parseInt(req.params.id);

      await validateBudgetOwnership(userId, budgetId);

      await db("budget_treatments").where({ budget_id: budgetId }).del();
      const deletedCount = await db("budgets").where({ id: budgetId }).del();

      if (!deletedCount) {
        return res.status(404).json({ error: "Orçamento não encontrado." });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      return res.status(500).json({
        error: "Erro ao excluir orçamento.",
        details: error.message,
      });
    }
  },
};
