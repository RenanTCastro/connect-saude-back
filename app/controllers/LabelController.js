import db from "../database/index.js";

export default {
  async createLabel(req, res) {
    try {
      const { name, color, icon, description, is_active } = req.body;
      const userId = req.user.user_id;

      if (!name) {
        return res.status(400).json({
          error: "É necessário informar o nome do rótulo.",
        });
      }

      await db("labels").insert({
        user_id: userId,
        name,
        color: color || null,
        icon: icon || null,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      return res.status(201).json({ message: "Rótulo criado com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar rótulo:", error);
      return res.status(500).json({
        error: "Erro ao criar rótulo.",
        details: error.message,
      });
    }
  },

  async getLabels(req, res) {
    try {
      const { name, is_active } = req.query;
      const userId = req.user.user_id;

      let query = db("labels")
        .select("*")
        .where({ user_id: userId })
        .orderBy("name", "asc");

      if (name) {
        query = query.andWhereILike("name", `%${name}%`);
      }

      if (is_active !== undefined) {
        query = query.andWhere({ is_active: is_active === "true" });
      }

      const labels = await query;
      return res.status(200).json(labels);
    } catch (error) {
      console.error("Erro ao buscar rótulos:", error);
      return res.status(500).json({
        error: "Erro ao buscar rótulos.",
        details: error.message,
      });
    }
  },

  async deleteLabel(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const deleted = await db("labels")
        .where({ id, user_id: userId })
        .del();

      if (deleted === 0) {
        return res.status(404).json({
          error: "Rótulo não encontrado ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Rótulo removido com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir rótulo:", error);
      return res.status(500).json({
        error: "Erro ao excluir rótulo.",
        details: error.message,
      });
    }
  },
};

