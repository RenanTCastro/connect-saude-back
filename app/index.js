
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Webhook do Stripe precisa de raw body
app.use("/subscription/webhook", express.raw({ type: "application/json" }));

// Demais rotas usam JSON
app.use(express.json());

app.use("/", routes);

app.use((err, req, res, next) => {
  console.error("Erro no servidor:", err);
  res.status(500).json({ error: "Ocorreu um erro interno no servidor" });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
