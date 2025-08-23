import express from "express";
import { body, param } from "express-validator";
import DocumentController from "../controllers/DocumentController.js";
import { validateRequest } from "../middleware/validation.js";

const router = express.Router();

// ============================================================================
// VALIDATION RULES
// ============================================================================

const uploadValidation = [
  body("patientId").notEmpty().withMessage("Patient ID is required"),
];

const patientIdValidation = [
  param("patientId").notEmpty().withMessage("Patient ID is required"),
];

const documentIdValidation = [
  param("documentId").notEmpty().withMessage("Document ID is required"),
];

const embeddingQueryValidation = [
  body("query").notEmpty().withMessage("Query is required"),
  body("userId").notEmpty().withMessage("User ID is required"),
  body("limit").optional().isInt({ min: 1, max: 20 }).withMessage("Limit must be between 1 and 20"),
];

// ============================================================================
// ROUTES
// ============================================================================

// Upload documents for a patient
router.post("/upload", uploadValidation, validateRequest, DocumentController.uploadFiles);

// Get all documents for a specific patient
router.get("/patient/:patientId", patientIdValidation, validateRequest, DocumentController.getPatientDocuments);

// Delete a specific document
router.delete("/:documentId", documentIdValidation, validateRequest, DocumentController.deleteDocument);

// Download a specific document
router.get("/download/:documentId", documentIdValidation, validateRequest, DocumentController.downloadDocument);

// Get AI response based on document embeddings
router.post("/embedding-response", embeddingQueryValidation, validateRequest, DocumentController.getEmbeddingResponse);

export default router; 