
const express = require("express");
const routes = express.Router();
const authMiddleware = require("./middleware/authMiddleware");

const UserController = require("./controllers/UserController").default;

routes.post("/login", UserController.login); 
routes.post("/register", UserController.register);

routes.get("/test_auth_middleware", authMiddleware, (req, res) => {
  res.json({ message: "Acesso autorizado!", user: req.user });
});

module.exports = routes;