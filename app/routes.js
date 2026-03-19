
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
const FormController = require("./controllers/FormController").default;
const AttachmentController = require("./controllers/AttachmentController").default;
const FolderController = require("./controllers/FolderController").default;
const ProcedureController = require("./controllers/ProcedureController").default;
const TreatmentController = require("./controllers/TreatmentController").default;
const OdontogramAnnotationController = require("./controllers/OdontogramAnnotationController").default;
const EvolutionEntryController = require("./controllers/EvolutionEntryController").default;

routes.post("/login", UserController.login); 
routes.post("/register", UserController.register);
routes.get("/me", authMiddleware, UserController.getProfile);
routes.put("/me", authMiddleware, UserController.updateProfile);

routes.get("/patients", authMiddleware, PatientController.getPatients);
routes.get("/patients/:id", authMiddleware, PatientController.getPatientById);
routes.get("/patients/:id/invoices", authMiddleware, PatientController.getPatientInvoices);
routes.post("/patients", authMiddleware, PatientController.createPatient);
routes.put("/patients/:id", authMiddleware, PatientController.updatePatient);
routes.delete("/patients/:id", authMiddleware, PatientController.deletePatient);

// Rotas de anexos
routes.post("/patients/:id/attachments/upload-url", authMiddleware, AttachmentController.generateUploadUrl);
routes.post("/patients/:id/attachments/confirm", authMiddleware, AttachmentController.confirmUpload);
routes.get("/patients/:id/attachments", authMiddleware, AttachmentController.getAttachments);
routes.get("/attachments/:id/download-url", authMiddleware, AttachmentController.getDownloadUrl);
routes.delete("/attachments/:id", authMiddleware, AttachmentController.deleteAttachment);

// Rotas de pastas
routes.post("/patients/:id/folders", authMiddleware, FolderController.createFolder);
routes.put("/folders/:id", authMiddleware, FolderController.updateFolder);
routes.delete("/folders/:id", authMiddleware, FolderController.deleteFolder);
routes.put("/attachments/:id/move", authMiddleware, FolderController.moveAttachment);

// Procedimentos (busca por nome/TUSS e criação de personalizados)
routes.get("/procedures", authMiddleware, ProcedureController.list);
routes.post("/procedures", authMiddleware, ProcedureController.create);

// Tratamentos do paciente
routes.get("/patients/:id/treatments", authMiddleware, TreatmentController.list);
routes.post("/patients/:id/treatments", authMiddleware, TreatmentController.create);
routes.put("/treatments/:id", authMiddleware, TreatmentController.update);
routes.delete("/treatments/:id", authMiddleware, TreatmentController.delete);

// Anotações do odontograma
routes.get("/patients/:id/odontogram-annotations", authMiddleware, OdontogramAnnotationController.list);
routes.post("/patients/:id/odontogram-annotations", authMiddleware, OdontogramAnnotationController.create);
routes.put("/odontogram-annotations/:id", authMiddleware, OdontogramAnnotationController.update);
routes.delete("/odontogram-annotations/:id", authMiddleware, OdontogramAnnotationController.delete);

// Evolução do paciente (pasta tratamento/tratamento_1 em Anexos)
routes.get("/patients/:id/evolution-folder", authMiddleware, EvolutionEntryController.getOrCreateEvolutionFolder);
routes.get("/patients/:id/evolution-entries", authMiddleware, EvolutionEntryController.list);
routes.post("/patients/:id/evolution-entries", authMiddleware, EvolutionEntryController.create);
routes.put("/evolution-entries/:id", authMiddleware, EvolutionEntryController.update);
routes.delete("/evolution-entries/:id", authMiddleware, EvolutionEntryController.delete);

routes.get("/inventory", authMiddleware, InventoryController.getInventoryItems);
routes.get("/inventory/:id/history", authMiddleware, InventoryController.getInventoryHistory);
routes.post("/inventory", authMiddleware, InventoryController.createInventoryItem);
routes.put("/inventory/:id", authMiddleware, InventoryController.updateInventoryItem);
routes.put("/inventory/:id/adjust-quantity", authMiddleware, InventoryController.adjustInventoryQuantity);
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

routes.get("/forms", authMiddleware, FormController.getAllForms);
routes.get("/forms/:id_form", authMiddleware, FormController.getFormById);
routes.post("/forms", authMiddleware, FormController.createForm);
routes.put("/forms/:id_form", authMiddleware, FormController.updateForm);
routes.delete("/forms/:id_form", authMiddleware, FormController.deleteForm);
routes.post("/forms/:id_form/duplicate", authMiddleware, FormController.duplicateForm);
routes.post("/forms/response", authMiddleware, FormController.submitFormResponse);
routes.get("/patients/:patient_id/forms/:id_form", authMiddleware, FormController.getPatientForm);

routes.get("/cashflow/period", authMiddleware, CashFlowController.getPeriodData);
routes.post("/cashflow/income", authMiddleware, CashFlowController.createIncome);
routes.put("/cashflow/income/:id", authMiddleware, CashFlowController.updateIncome);
routes.delete("/cashflow/income/:id", authMiddleware, CashFlowController.deleteIncome);
routes.post("/cashflow/expense", authMiddleware, CashFlowController.createExpense);
routes.put("/cashflow/expense/:id", authMiddleware, CashFlowController.updateExpense);
routes.delete("/cashflow/expense/:id", authMiddleware, CashFlowController.deleteExpense);
routes.put("/cashflow/transactions/:id/toggle-paid", authMiddleware, CashFlowController.togglePaidStatus);
routes.get("/cashflow/receivables", authMiddleware, CashFlowController.getReceivables);
routes.put("/cashflow/installments/:id/pay", authMiddleware, CashFlowController.markInstallmentAsPaid);
routes.delete("/cashflow/installments/:id", authMiddleware, CashFlowController.deleteInstallment);

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