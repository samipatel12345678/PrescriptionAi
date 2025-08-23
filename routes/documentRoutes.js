import express from "express";
import DocumentController from "../controllers/DocumentController.js";

const router = express.Router();

// Upload documents for a patient
router.post("/upload", DocumentController.uploadFiles);

// Get all documents for a specific patient
router.get("/patient/:patientId", DocumentController.getPatientDocuments);

// Delete a specific document
router.delete("/:documentId", DocumentController.deleteDocument);

// Download a specific document
router.get("/download/:documentId", DocumentController.downloadDocument);

// Get response based on document embeddings
router.post("/embedding-response", DocumentController.getEmbeddingResponse);

export default router;
