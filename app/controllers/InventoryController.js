import db from "../database/index.js";

export default {
  async getInventoryItems(req, res) {
    try {
      const { name } = req.query;
      const userId = req.user.user_id;

      let query = db("inventory_items")
        .select("*")
        .where({ user_id: userId })
        .orderBy("name", "asc");

      if (name) {
        query = query.andWhereILike("name", `%${name}%`);
      }

      const items = await query;
      return res.status(200).json(items);
    } catch (error) {
      console.error("Erro ao buscar itens do estoque:", error);
      return res.status(500).json({
        error: "Erro ao buscar itens do estoque.",
        details: error.message,
      });
    }
  },

  async createInventoryItem(req, res) {
    try {
      const { name, quantity } = req.body;
      const userId = req.user.user_id;

      if (!name || quantity === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome e a quantidade do produto.",
        });
      }

      await db("inventory_items")
        .insert({
          user_id: userId,
          name,
          quantity,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })

      return res.status(201).json({ message: "Item criado com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar item:", error);
      return res.status(500).json({
        error: "Erro ao criar item.",
        details: error.message,
      });
    }
  },

  async updateInventoryItem(req, res) {
    try {
      const { id } = req.params;
      const { name, quantity } = req.body;
      const userId = req.user.user_id;

      if (!name && quantity === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome e/ou a quantidade para atualização.",
        });
      }

      const updated = await db("inventory_items")
        .where({ id, user_id: userId })
        .update({ name, quantity, updated_at: db.fn.now() })

      if (updated.length === 0) {
        return res.status(404).json({ error: "Item não encontrado ou sem permissão." });
      }

      return res.status(200).json({ message: "Item atualizado com sucesso!",});
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
      return res.status(500).json({
        error: "Erro ao atualizar item.",
        details: error.message,
      });
    }
  },

  async deleteInventoryItem(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const deleted = await db("inventory_items")
        .where({ id, user_id: userId })
        .del()

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Item não encontrado ou sem permissão." });
      }

      return res.status(200).json({ message: "Item removido com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir item:", error);
      return res.status(500).json({
        error: "Erro ao excluir item.",
        details: error.message,
      });
    }
  },
};
