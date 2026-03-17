import db from "../database/index.js";

async function recordQuantityHistory(inventoryItemId, userId, previousQuantity, newQuantity, type, notes = null) {
  const changeAmount = newQuantity - previousQuantity;
  if (changeAmount === 0) return;
  await db("inventory_quantity_history").insert({
    inventory_item_id: inventoryItemId,
    user_id: userId,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    change_amount: changeAmount,
    type,
    notes,
  });
}

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
      const { name, quantity, ideal_quantity } = req.body;
      const userId = req.user.user_id;

      if (!name || quantity === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome e a quantidade do produto.",
        });
      }

      await db("inventory_items").insert({
        user_id: userId,
        name,
        quantity,
        ideal_quantity: ideal_quantity || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      const item = await db("inventory_items").where({ user_id: userId, name }).orderBy("id", "desc").first();
      if (item && quantity > 0) {
        await recordQuantityHistory(item.id, userId, 0, quantity, "entrada_inicial");
      }

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
      const { name, ideal_quantity, quantity } = req.body;
      const userId = req.user.user_id;

      if (!name && ideal_quantity === undefined && quantity === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome, quantidade ideal ou quantidade para atualização.",
        });
      }

      const updateData = { updated_at: db.fn.now() };
      if (name !== undefined) updateData.name = name;
      if (ideal_quantity !== undefined) updateData.ideal_quantity = ideal_quantity || null;

      if (quantity !== undefined) {
        const item = await db("inventory_items").where({ id, user_id: userId }).first();
        if (item && item.quantity !== quantity) {
          const type = quantity > item.quantity ? "entrada" : "saida";
          await recordQuantityHistory(id, userId, item.quantity, quantity, type);
        }
        updateData.quantity = quantity;
      }

      const updated = await db("inventory_items")
        .where({ id, user_id: userId })
        .update(updateData)

      if (updated === 0) {
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

  async adjustInventoryQuantity(req, res) {
    try {
      const { id } = req.params;
      const { operation, amount } = req.body;
      const userId = req.user.user_id;

      if (!operation || !amount || !['add', 'subtract'].includes(operation)) {
        return res.status(400).json({
          error: "É necessário informar a operação (add/subtract) e a quantidade.",
        });
      }

      const item = await db("inventory_items")
        .where({ id, user_id: userId })
        .first();

      if (!item) {
        return res.status(404).json({ error: "Item não encontrado ou sem permissão." });
      }

      let newQuantity = item.quantity;
      if (operation === 'add') {
        newQuantity = item.quantity + amount;
      } else if (operation === 'subtract') {
        newQuantity = Math.max(0, item.quantity - amount);
      }

      const type = operation === 'add' ? 'entrada' : 'saida';
      await recordQuantityHistory(id, userId, item.quantity, newQuantity, type);

      const updated = await db("inventory_items")
        .where({ id, user_id: userId })
        .update({ 
          quantity: newQuantity,
          updated_at: db.fn.now() 
        });

      if (updated === 0) {
        return res.status(404).json({ error: "Item não encontrado ou sem permissão." });
      }

      return res.status(200).json({ 
        message: "Quantidade alterada com sucesso!",
        newQuantity 
      });
    } catch (error) {
      console.error("Erro ao alterar quantidade:", error);
      return res.status(500).json({
        error: "Erro ao alterar quantidade.",
        details: error.message,
      });
    }
  },

  async getInventoryHistory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const item = await db("inventory_items")
        .where({ id, user_id: userId })
        .first();

      if (!item) {
        return res.status(404).json({ error: "Item não encontrado ou sem permissão." });
      }

      const history = await db("inventory_quantity_history")
        .select(
          "inventory_quantity_history.*",
          "users.name as user_name"
        )
        .leftJoin("users", "inventory_quantity_history.user_id", "users.id")
        .where("inventory_quantity_history.inventory_item_id", id)
        .orderBy("inventory_quantity_history.created_at", "desc");

      return res.status(200).json({
        item: { id: item.id, name: item.name },
        history,
      });
    } catch (error) {
      console.error("Erro ao buscar histórico do estoque:", error);
      return res.status(500).json({
        error: "Erro ao buscar histórico.",
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

      if (deleted === 0) {
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
