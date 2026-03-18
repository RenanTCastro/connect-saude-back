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

      const annotations = await db("odontogram_annotations")
        .where({ patient_id: patientId })
        .orderBy("created_at", "desc")
        .select("*");

      return res.status(200).json(annotations);
    } catch (error) {
      console.error("Erro ao listar anotações do odontograma:", error);
      return res.status(500).json({
        error: "Erro ao listar anotações.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const { dentition, element_type, element_key, annotation_text, status } = req.body;

      await validatePatientOwnership(userId, patientId);

      if (!dentition || !element_type || !element_key) {
        return res.status(400).json({
          error: "Campos 'dentition', 'element_type' e 'element_key' são obrigatórios.",
        });
      }

      const [annotation] = await db("odontogram_annotations")
        .insert({
          patient_id: patientId,
          dentition,
          element_type,
          element_key: String(element_key),
          annotation_text: annotation_text ? String(annotation_text).trim() : null,
          status: status ? String(status).trim() : null,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(annotation);
    } catch (error) {
      console.error("Erro ao criar anotação:", error);
      return res.status(500).json({
        error: "Erro ao criar anotação.",
        details: error.message,
      });
    }
  },

  async update(req, res) {
    try {
      const userId = req.user.user_id;
      const annotationId = parseInt(req.params.id);
      const { annotation_text, status } = req.body;

      const annotation = await db("odontogram_annotations").where({ id: annotationId }).first();
      if (!annotation) {
        return res.status(404).json({ error: "Anotação não encontrada." });
      }
      await validatePatientOwnership(userId, annotation.patient_id);

      const updates = { updated_at: db.fn.now() };
      if (annotation_text !== undefined) updates.annotation_text = annotation_text ? String(annotation_text).trim() : null;
      if (status !== undefined) updates.status = status ? String(status).trim() : null;

      const [updated] = await db("odontogram_annotations")
        .where({ id: annotationId })
        .update(updates)
        .returning("*");

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Erro ao atualizar anotação:", error);
      return res.status(500).json({
        error: "Erro ao atualizar anotação.",
        details: error.message,
      });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.user.user_id;
      const annotationId = parseInt(req.params.id);

      const annotation = await db("odontogram_annotations").where({ id: annotationId }).first();
      if (!annotation) {
        return res.status(404).json({ error: "Anotação não encontrada." });
      }
      await validatePatientOwnership(userId, annotation.patient_id);

      await db("odontogram_annotations").where({ id: annotationId }).delete();

      return res.status(200).json({ message: "Anotação removida com sucesso." });
    } catch (error) {
      console.error("Erro ao remover anotação:", error);
      return res.status(500).json({
        error: "Erro ao remover anotação.",
        details: error.message,
      });
    }
  },
};
