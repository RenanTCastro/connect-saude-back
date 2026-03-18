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

/** Retorna pasta com nome 'tratamento', 'tratamento_1', etc., criando se não existir. */
async function getOrCreateEvolutionFolder(patientId) {
  const existing = await db("patient_folders")
    .where({ patient_id: patientId, parent_id: null })
    .select("name");

  const names = new Set((existing || []).map((r) => r.name));
  let name = "tratamento";
  let i = 0;
  while (names.has(name)) {
    name = i === 0 ? "tratamento_1" : `tratamento_${i + 1}`;
    i++;
  }

  const s3Prefix = `folder-${Date.now()}`;
  const [folder] = await db("patient_folders")
    .insert({
      patient_id: patientId,
      name,
      parent_id: null,
      s3_prefix: s3Prefix,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  await db("patient_folders")
    .where({ id: folder.id })
    .update({ s3_prefix: `folder-${folder.id}` });
  folder.s3_prefix = `folder-${folder.id}`;
  return folder;
}

export default {
  async getOrCreateEvolutionFolder(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      await validatePatientOwnership(userId, patientId);

      const folder = await getOrCreateEvolutionFolder(patientId);
      return res.status(200).json(folder);
    } catch (error) {
      console.error("Erro ao obter/criar pasta de evolução:", error);
      return res.status(500).json({
        error: "Erro ao obter pasta de evolução.",
        details: error.message,
      });
    }
  },

  async list(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      await validatePatientOwnership(userId, patientId);

      const entries = await db("evolution_entries")
        .where({ patient_id: patientId })
        .orderBy("occurred_at", "desc")
        .orderBy("created_at", "desc")
        .select("*");

      return res.status(200).json(entries);
    } catch (error) {
      console.error("Erro ao listar evolução:", error);
      return res.status(500).json({
        error: "Erro ao listar evolução.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const patientId = parseInt(req.params.id);
      const { content, occurred_at, folder_id } = req.body;

      await validatePatientOwnership(userId, patientId);

      if (!occurred_at) {
        return res.status(400).json({
          error: "Campo 'occurred_at' é obrigatório.",
        });
      }

      if (folder_id) {
        const folder = await db("patient_folders")
          .where({ id: folder_id, patient_id: patientId })
          .first();
        if (!folder) {
          return res.status(400).json({
            error: "Pasta não encontrada ou não pertence ao paciente.",
          });
        }
      }

      const [entry] = await db("evolution_entries")
        .insert({
          patient_id: patientId,
          content: content ? String(content).trim() : null,
          folder_id: folder_id ? parseInt(folder_id) : null,
          occurred_at: occurred_at,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(entry);
    } catch (error) {
      console.error("Erro ao criar entrada de evolução:", error);
      return res.status(500).json({
        error: "Erro ao criar evolução.",
        details: error.message,
      });
    }
  },

  async update(req, res) {
    try {
      const userId = req.user.user_id;
      const entryId = parseInt(req.params.id);
      const { content, occurred_at, folder_id } = req.body;

      const entry = await db("evolution_entries").where({ id: entryId }).first();
      if (!entry) {
        return res.status(404).json({ error: "Entrada de evolução não encontrada." });
      }
      await validatePatientOwnership(userId, entry.patient_id);

      const updates = { updated_at: db.fn.now() };
      if (content !== undefined) updates.content = content ? String(content).trim() : null;
      if (occurred_at !== undefined) updates.occurred_at = occurred_at;
      if (folder_id !== undefined) {
        if (folder_id === null) {
          updates.folder_id = null;
        } else {
          const folder = await db("patient_folders")
            .where({ id: folder_id, patient_id: entry.patient_id })
            .first();
          if (!folder) {
            return res.status(400).json({ error: "Pasta não encontrada." });
          }
          updates.folder_id = folder_id;
        }
      }

      const [updated] = await db("evolution_entries")
        .where({ id: entryId })
        .update(updates)
        .returning("*");

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Erro ao atualizar evolução:", error);
      return res.status(500).json({
        error: "Erro ao atualizar evolução.",
        details: error.message,
      });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.user.user_id;
      const entryId = parseInt(req.params.id);

      const entry = await db("evolution_entries").where({ id: entryId }).first();
      if (!entry) {
        return res.status(404).json({ error: "Entrada de evolução não encontrada." });
      }
      await validatePatientOwnership(userId, entry.patient_id);

      await db("evolution_entries").where({ id: entryId }).delete();

      return res.status(200).json({ message: "Entrada de evolução removida com sucesso." });
    } catch (error) {
      console.error("Erro ao remover evolução:", error);
      return res.status(500).json({
        error: "Erro ao remover evolução.",
        details: error.message,
      });
    }
  },
};
