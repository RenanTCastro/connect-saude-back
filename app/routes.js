
const express = require("express");
const routes = express.Router();
const authMiddleware = require("./middleware/authMiddleware");

const UserController = require("./controllers/UserController").default;
const InventoryController = require("./controllers/InventoryController").default;

routes.post("/login", UserController.login); 
routes.post("/register", UserController.register);

routes.get("/inventory", authMiddleware, InventoryController.getInventoryItems);
routes.post("/inventory", authMiddleware, InventoryController.createInventoryItem);
routes.put("/inventory/:id", authMiddleware, InventoryController.updateInventoryItem);
routes.delete("/inventory/:id", authMiddleware, InventoryController.deleteInventoryItem);

routes.get("/test_auth_middleware", authMiddleware, (req, res) => {
  res.json({ message: "Acesso autorizado!", user: req.user });
});

module.exports = routes;