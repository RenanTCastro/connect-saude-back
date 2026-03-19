import db from "../database/index.js";

export default {
  async list(req, res) {
    try {
      const userId = req.user.user_id;
      const { q } = req.query;

      let query = db("procedures").where((builder) => {
        builder.where({ user_id: userId }).orWhereNull("user_id");
      });

      if (q && String(q).trim()) {
        const term = `%${String(q).trim().toLowerCase()}%`;
        query = query.where((builder) => {
          builder
            .whereRaw("LOWER(name) LIKE ?", [term])
            .orWhereRaw("LOWER(COALESCE(tuss_code, '')) LIKE ?", [term]);
        });
      }

      const procedures = await query.orderBy("name").select("*");
      return res.status(200).json(procedures);
    } catch (error) {
      console.error("Erro ao listar procedimentos:", error);
      return res.status(500).json({
        error: "Erro ao listar procedimentos.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const { name, tuss_code, is_custom } = req.body;

      if (!name || String(name).trim() === "") {
        return res.status(400).json({
          error: "Campo 'name' é obrigatório.",
        });
      }

      const [procedure] = await db("procedures")
        .insert({
          user_id: userId,
          name: String(name).trim(),
          tuss_code: tuss_code ? String(tuss_code).trim() : null,
          is_custom: Boolean(is_custom),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(procedure);
    } catch (error) {
      console.error("Erro ao criar procedimento:", error);
      return res.status(500).json({
        error: "Erro ao criar procedimento.",
        details: error.message,
      });
    }
  },
};
