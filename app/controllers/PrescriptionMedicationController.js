import db from "../database/index.js";

export default {
  async list(req, res) {
    try {
      const { q } = req.query;
      const searchTerm = q ? String(q).trim() : "";
      if (searchTerm.length < 2) {
        return res.status(200).json([]);
      }

      const userId = req.user.user_id;
      const term = `%${searchTerm.toLowerCase()}%`;

      let query = db("prescription_medications")
        .where((builder) => {
          builder.where({ user_id: userId }).orWhereNull("user_id");
        })
        .where((builder) => {
          builder
            .whereRaw("LOWER(termo) LIKE ?", [term])
            .orWhereRaw("LOWER(COALESCE(apresentacao, '')) LIKE ?", [term]);
        });

      const medications = await query
        .orderBy("termo")
        .limit(25)
        .select("*");
      return res.status(200).json(medications);
    } catch (error) {
      console.error("Erro ao listar medicamentos:", error);
      return res.status(500).json({
        error: "Erro ao listar medicamentos.",
        details: error.message,
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.user_id;
      const { termo, apresentacao } = req.body;

      if (!termo || String(termo).trim() === "") {
        return res.status(400).json({
          error: "Campo 'termo' é obrigatório.",
        });
      }

      const [medication] = await db("prescription_medications")
        .insert({
          user_id: userId,
          termo: String(termo).trim(),
          apresentacao: apresentacao ? String(apresentacao).trim() : null,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json(medication);
    } catch (error) {
      console.error("Erro ao criar medicamento:", error);
      return res.status(500).json({
        error: "Erro ao criar medicamento.",
        details: error.message,
      });
    }
  },
};
