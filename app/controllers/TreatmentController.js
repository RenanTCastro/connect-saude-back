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

export default {
  async list(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      await validatePatientOwnership(userId, patientId);

      const treatments = await db("patient_treatments")
        .where({ patient_id: patientId })
        .orderBy("created_at", "desc")
        .select("*");

      return res.status(200).json(treatments);
    } catch (error) {
      console.error("Erro ao listar tratamentos:", error);
      return res.status(500).json({
        error: "Erro ao listar tratamentos.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const {
        plan_type,
        target_type,
        tooth_fdi,
        region_name,
        procedure_id,
        procedure_name,
        value,
        status,
      } = req.body;

      await validatePatientOwnership(userId, patientId);

      if (!plan_type || !target_type) {
        return res.status(400).json({
          error: "Campos 'plan_type' e 'target_type' são obrigatórios.",
        });
      }

      const [treatment] = await db("patient_treatments")
        .insert({
          patient_id: patientId,
          plan_type: plan_type,
          target_type: target_type,
          tooth_fdi: tooth_fdi || null,
          region_name: region_name || null,
          procedure_id: procedure_id ? parseInt(procedure_id) : null,
          procedure_name: procedure_name ? String(procedure_name).trim() : null,
          value: value != null ? parseFloat(value) : null,
          status: status || "planejado",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(treatment);
    } catch (error) {
      console.error("Erro ao criar tratamento:", error);
      return res.status(500).json({
        error: "Erro ao criar tratamento.",
        details: error.message,
      });
    }
  },

  async update(req, res) {
    try {
      const userId = req.user.user_id;
      const treatmentId = parseInt(req.params.id);
      const {
        plan_type,
        target_type,
        tooth_fdi,
        region_name,
        procedure_id,
        procedure_name,
        value,
        status,
      } = req.body;

      const treatment = await db("patient_treatments").where({ id: treatmentId }).first();
      if (!treatment) {
        return res.status(404).json({ error: "Tratamento não encontrado." });
      }
      await validatePatientOwnership(userId, treatment.patient_id);

      const updates = { updated_at: db.fn.now() };
      if (plan_type !== undefined) updates.plan_type = plan_type;
      if (target_type !== undefined) updates.target_type = target_type;
      if (tooth_fdi !== undefined) updates.tooth_fdi = tooth_fdi || null;
      if (region_name !== undefined) updates.region_name = region_name || null;
      if (procedure_id !== undefined) updates.procedure_id = procedure_id ? parseInt(procedure_id) : null;
      if (procedure_name !== undefined) updates.procedure_name = procedure_name ? String(procedure_name).trim() : null;
      if (value !== undefined) updates.value = value != null ? parseFloat(value) : null;
      if (status !== undefined) updates.status = status;

      const [updated] = await db("patient_treatments")
        .where({ id: treatmentId })
        .update(updates)
        .returning("*");

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Erro ao atualizar tratamento:", error);
      return res.status(500).json({
        error: "Erro ao atualizar tratamento.",
        details: error.message,
      });
    }
  },
};
