
const express = require("express");
const routes = express.Router();
// const authMiddleware = require("./middleware/authMiddleware");

const UserController = require("./controllers/UserController").default;

routes.post("/login", UserController.login); 
routes.post("/register", UserController.register);

module.exports = routes;