
const express = require("express");
const routes = express.Router();
const authMiddleware = require("./middleware/authMiddleware");

const UserController = require("./controllers/UserController").default;
const PatientController = require("./controllers/PatientController").default;
const InventoryController = require("./controllers/InventoryController").default;
const SalesController = require("./controllers/SalesController").default;
const LabelController = require("./controllers/LabelController").default;
const AppointmentController = require("./controllers/AppointmentController").default;
const CashFlowController = require("./controllers/CashFlowController").default;
const SubscriptionController = require("./controllers/SubscriptionController").default;

routes.post("/login", UserController.login); 
routes.post("/register", UserController.register);

routes.get("/patients", authMiddleware, PatientController.getPatients);
routes.get("/patients/:id", authMiddleware, PatientController.getPatientById);
routes.get("/patients/:id/invoices", authMiddleware, PatientController.getPatientInvoices);
routes.post("/patients", authMiddleware, PatientController.createPatient);
routes.put("/patients/:id", authMiddleware, PatientController.updatePatient);
routes.delete("/patients/:id", authMiddleware, PatientController.deletePatient);

routes.get("/inventory", authMiddleware, InventoryController.getInventoryItems);
routes.post("/inventory", authMiddleware, InventoryController.createInventoryItem);
routes.put("/inventory/:id", authMiddleware, InventoryController.updateInventoryItem);
routes.delete("/inventory/:id", authMiddleware, InventoryController.deleteInventoryItem);

routes.get("/sales/stages", authMiddleware, SalesController.getSalesStages);
routes.post("/sales/stages", authMiddleware, SalesController.createSalesStage);
routes.put("/sales/stages/:id", authMiddleware, SalesController.updateSalesStage);
routes.delete("/sales/stages/:id", authMiddleware, SalesController.deleteSalesStage);

routes.get("/sales/opportunities", authMiddleware, SalesController.getSalesOpportunities);
routes.get("/sales/opportunities/:id", authMiddleware, SalesController.getSalesOpportunityById);
routes.post("/sales/opportunities", authMiddleware, SalesController.createSalesOpportunity);
routes.put("/sales/opportunities/:id", authMiddleware, SalesController.updateSalesOpportunity);
routes.delete("/sales/opportunities/:id", authMiddleware, SalesController.deleteSalesOpportunity);

routes.get("/sales/opportunities/:opportunity_id/notes", authMiddleware, SalesController.getSalesNotes);
routes.post("/sales/notes", authMiddleware, SalesController.createSalesNote);
routes.put("/sales/notes/:id", authMiddleware, SalesController.updateSalesNote);
routes.delete("/sales/notes/:id", authMiddleware, SalesController.deleteSalesNote);

routes.get("/labels", authMiddleware, LabelController.getLabels);
routes.post("/labels", authMiddleware, LabelController.createLabel);
routes.delete("/labels/:id", authMiddleware, LabelController.deleteLabel);

routes.get("/appointments", authMiddleware, AppointmentController.getAppointments);
routes.get("/appointments/:id", authMiddleware, AppointmentController.getAppointmentById);
routes.post("/appointments", authMiddleware, AppointmentController.createAppointment);
routes.put("/appointments/:id", authMiddleware, AppointmentController.updateAppointment);
routes.delete("/appointments/:id", authMiddleware, AppointmentController.deleteAppointment);

routes.get("/cashflow/period", authMiddleware, CashFlowController.getPeriodData);
routes.post("/cashflow/income", authMiddleware, CashFlowController.createIncome);
routes.post("/cashflow/expense", authMiddleware, CashFlowController.createExpense);
routes.get("/cashflow/receivables", authMiddleware, CashFlowController.getReceivables);
routes.put("/cashflow/installments/:id/pay", authMiddleware, CashFlowController.markInstallmentAsPaid);

routes.get("/test_auth_middleware", authMiddleware, (req, res) => {
  res.json({ message: "Acesso autorizado!", user: req.user });
});

// Rotas de subscription
routes.post("/subscription/checkout", authMiddleware, SubscriptionController.createCheckoutSession);
routes.get("/subscription/status", authMiddleware, SubscriptionController.getSubscriptionStatus);
routes.post("/subscription/cancel", authMiddleware, SubscriptionController.cancelSubscription);
routes.post("/subscription/reactivate", authMiddleware, SubscriptionController.reactivateSubscription);
// Webhook do Stripe (sem autenticação, usa assinatura do Stripe)
routes.post("/subscription/webhook", SubscriptionController.handleWebhook);

module.exports = routes;