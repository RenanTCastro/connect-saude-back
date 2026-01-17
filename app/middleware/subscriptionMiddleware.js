const knex = require("knex");
const configFile = require("../../knexfile.js");
const dotenv = require("dotenv");

dotenv.config();

const environment = process.env.NODE_ENV || "development";
const config = configFile[environment];
const db = knex(config);

/**
 * Middleware para verificar se o usuário tem assinatura ativa ou em trial
 * Bloqueia acesso às rotas se não tiver assinatura válida
 */
module.exports = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    const user = await db("users")
      .select(
        "subscription_id",
        "subscription_status",
        "subscription_start_date",
        "subscription_end_date"
      )
      .where({ id: userId })
      .first();

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Verificar se tem acesso (ativa, trialing ou cancelada mas ainda no período pago)
    const hasAccess = 
      user.subscription_status === "active" ||
      user.subscription_status === "trialing" ||
      (user.subscription_status === "canceled" &&
        user.subscription_end_date &&
        new Date(user.subscription_end_date) > new Date());

    if (!hasAccess) {
      return res.status(403).json({
        error: "Acesso negado",
        message: "É necessário ter uma assinatura ativa para acessar esta funcionalidade.",
        requiresSubscription: true,
      });
    }

    next();
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    return res.status(500).json({
      error: "Erro ao verificar assinatura",
      details: error.message,
    });
  }
};
