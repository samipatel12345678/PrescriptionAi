import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { supabase } from "../SupabaseClient.js";
";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BUCKET_NAME = "document";
const FOLDER_NAME = "Document";

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, DOC, DOCX, TXT, JPG, PNG, GIF, XLS, XLSX files are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files per request
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Extract text from different file types
 */
async function extractTextFromFile(file) {
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(file.buffer);
    return data.text;
  } else if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  } else if (file.mimetype.startsWith("text/")) {
    return file.buffer.toString("utf-8");
  }
  return "";
}

/**
 * Extract text from file buffer based on file extension
 */
async function extractTextFromBuffer(buffer, fileName) {
  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
  
  switch (fileExtension) {
    case "pdf":
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    
    case "docx":
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    
    case "txt":
      return buffer.toString("utf-8");
    
    case "html":
    case "htm":
      const htmlContent = buffer.toString("utf-8");
      return htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    
    default:
      console.log("Unsupported file type for text extraction:", fileExtension);
      return "";
  }
}

/**
 * Convert file data to buffer
 */
async function convertToBuffer(data) {
  if (data instanceof Buffer) {
    return data;
  } else if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else if (data && typeof data[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of data) chunks.push(chunk);
    return Buffer.concat(chunks);
  } else {
    return Buffer.from(data);
  }
}

// ============================================================================
// EMBEDDING FUNCTIONS
// ============================================================================

/**
 * Store embedding in database
 */
async function storeEmbedding({ userId, documentId, embedding, text }) {
   const generatedDocumentId = documentId || uuidv4();

  console.log("Storing embedding:", {
    userId,
    documentId: generatedDocumentId,
    embeddingLength: embedding?.length,
    textPreview: text?.slice(0, 30),
  });

  const { data, error } = await supabase
    .from("document_embeddings")
    .insert([{ user_id: userId, document_id: generatedDocumentId, embedding, text }]);

  if (error) {
    console.error("Supabase insert error:", error);
    throw error;
  }

  console.log("Embedding stored successfully");
  return { data, generatedDocumentId };
}

/**
 * Extract text and create embeddings from uploaded file
 */
export async function extractTextAndStoreEmbedding(documentId, userId, bucket, filePath, fileName) {
  console.log("Processing document for embeddings:", { documentId, userId, fileName });

  try {
    // Download file from Supabase
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) {
      console.error("Error downloading from Supabase:", error);
      throw error;
    }

    // Convert to buffer and extract text
    const buffer = await convertToBuffer(data);
    const text = await extractTextFromBuffer(buffer, fileName);
    
    if (!text.trim()) {
      console.log("No text extracted from document");
      return;
    }

    console.log("Text extracted, length:", text.length);

    // Create embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    const embedding = embeddingResponse.data[0].embedding;
    console.log("Embedding created, dimensions:", embedding.length);

    // Store embedding
    await storeEmbedding({
      userId,
      documentId,
      embedding,
      text,
    });

    console.log("Document processing completed successfully");

  } catch (error) {
    console.error("Error processing document for embeddings:", error);
    throw error;
  }
}

/**
 * Generate LLM response based on retrieved context
 */
async function generateLLMResponse(query, contextTexts) {
  const systemPrompt = `You are a helpful assistant that answers questions based on the provided document context. 
Use only the information from the context to answer the question. 
If the context doesn't contain enough information to answer the question, say so.
Provide a clear, concise, and accurate response.`;

  const userPrompt = `Context from documents:
${contextTexts}

Question: ${query}

Please answer the question based on the context provided above.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 500,
    temperature: 0.7
  });

  return completion.choices[0].message.content;
}

// ============================================================================
// DOCUMENT CONTROLLER CLASS
// ============================================================================

class DocumentController {
  
  // ============================================================================
  // FILE UPLOAD METHODS
  // ============================================================================

  /**
   * Upload single or multiple files
   */
  static uploadFiles = (req, res) => {
    upload.array("documents", 5)(req, res, async (err) => {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        const errorMessages = {
          LIMIT_FILE_SIZE: "File too large. Maximum size is 10MB.",
          LIMIT_FILE_COUNT: "Too many files. Maximum 5 files allowed.",
        };
        
        return res.status(400).json({
          success: false,
          message: errorMessages[err.code] || err.message,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      // Validate request
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded.",
        });
      }

      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "Patient ID is required.",
        });
      }

      try {
        const uploadedDocuments = [];

        for (const file of req.files) {
          try {
            // Generate unique filename
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const ext = path.extname(file.originalname);
            const filename = `documents-${uniqueSuffix}${ext}`;
            const supabasePath = `${FOLDER_NAME}/patient-${patientId}/${filename}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(supabasePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: false,
              });

            if (error) {
              console.error("Supabase upload error:", error);
              throw new Error("Failed to upload to cloud storage");
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(supabasePath);

            // Create document object
            const document = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              patientId: patientId,
              originalName: file.originalname,
              filename: filename,
              path: supabasePath,
              url: urlData.publicUrl,
              size: file.size,
              mimetype: file.mimetype,
              uploadDate: new Date().toISOString(),
              status: "uploaded",
            };

            // Add to documents array (in production, this would be a database)
            documents.push(document);

            uploadedDocuments.push({
              id: document.id,
              name: document.originalName,
              size: document.size,
              type: document.mimetype,
              uploadDate: document.uploadDate,
              status: "success",
              url: document.url,
            });

            // Process document for embeddings
            try {
              await extractTextAndStoreEmbedding(
                document.id,
                patientId,
                BUCKET_NAME,
                document.path,
                document.originalName
              );
            } catch (embeddingError) {
              console.error("Error processing embeddings:", embeddingError);
            }

          } catch (error) {
            console.error("File upload error:", error);
            uploadedDocuments.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: file.originalname,
              size: file.size,
              type: file.mimetype,
              uploadDate: new Date().toISOString(),
              status: "error",
            });
          }
        }

        res.status(200).json({
          success: true,
          message: "Files uploaded successfully.",
          documents: uploadedDocuments,
        });

      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error during upload.",
        });
      }
    });
  };

  // ============================================================================
  // DOCUMENT RETRIEVAL METHODS
  // ============================================================================

  /**
   * Get documents for a specific patient
   */
  static getPatientDocuments = (req, res) => {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "Patient ID is required.",
        });
      }

      const patientDocuments = documents.filter((doc) => doc.patientId === patientId);
      const formattedDocuments = patientDocuments.map((doc) => ({
        id: doc.id,
        name: doc.originalName,
        size: doc.size,
        type: doc.mimetype,
        uploadDate: doc.uploadDate,
        status: doc.status,
      }));

      res.status(200).json({
        success: true,
        documents: formattedDocuments,
      });

    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error while fetching documents.",
      });
    }
  };

  /**
   * Download a specific document
   */
  static downloadDocument = (req, res) => {
    try {
      const { documentId } = req.params;

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: "Document ID is required.",
        });
      }

      const document = documents.find((doc) => doc.id === documentId);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      if (!document.url) {
        return res.status(404).json({
          success: false,
          message: "File URL not found.",
        });
      }

      res.redirect(document.url);

    } catch (error) {
      console.error("Download document error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error while downloading document.",
      });
    }
  };

  // ============================================================================
  // EMBEDDING RESPONSE METHODS
  // ============================================================================

  /**
   * Get AI response based on document embeddings
   */
  static getEmbeddingResponse = async (req, res) => {
    try {
      const { query, userId, limit = 5 } = req.body;

      // Validate input
      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Query is required.",
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required.",
        });
      }

      console.log("Processing embedding query:", { query, userId, limit });

      // Create embedding for the query
      const queryEmbedding = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: query,
      });

      const queryVector = queryEmbedding.data[0].embedding;

      // Fetch embeddings from database
      let embeddings = [];
      try {
        const { data, error } = await supabase
          .from("document_embeddings")
          .select("document_id, embedding, text")
          .eq("user_id", userId);

        if (error) {
          console.error("Supabase error:", error);
          return res.status(500).json({
            success: false,
            message: "Database connection error. Please check Supabase configuration.",
            details: error.message
          });
        }

        embeddings = data || [];

      } catch (dbError) {
        console.error("Database connection failed:", dbError);
        return res.status(500).json({
          success: false,
          message: "Unable to connect to database. Please check your Supabase configuration.",
          details: dbError.message
        });
      }

      if (embeddings.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No document embeddings found for this user. Please upload some documents first.",
        });
      }

      console.log(`Found ${embeddings.length} embeddings for user ${userId}`);

      // Calculate similarities and get top results
      const similarities = embeddings.map((doc) => ({
        document_id: doc.document_id,
        text: doc.text,
        similarity: calculateCosineSimilarity(queryVector, doc.embedding),
      }));

      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, limit);

      console.log("Top results found:", topResults.length);

      // Generate LLM response
      try {
        const contextTexts = topResults.map(result => result.text).join('\n\n');
        const llmResponse = await generateLLMResponse(query, contextTexts);

        res.status(200).json({
          success: true,
          response: llmResponse,
        });

      } catch (llmError) {
        console.error("LLM generation error:", llmError);
        
        // Fallback response
        res.status(200).json({
          success: true,
          response: "Unable to generate AI response. Please try again later.",
          error: "LLM generation failed"
        });
      }

    } catch (error) {
      console.error("Embedding response error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error while processing embedding query.",
        details: error.message
      });
    }
  };

  // ============================================================================
  // DOCUMENT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Delete a specific document
   */
  static deleteDocument = async (req, res) => {
    try {
      const { documentId } = req.params;

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: "Document ID is required.",
        });
      }

      const documentIndex = documents.findIndex((doc) => doc.id === documentId);

      if (documentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      const document = documents[documentIndex];

      // Delete from Supabase Storage
      try {
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([document.path]);

        if (error) {
          console.error("Supabase delete error:", error);
        }
      } catch (error) {
        console.error("Error deleting from storage:", error);
      }

      // Remove from documents array
      documents.splice(documentIndex, 1);

      res.status(200).json({
        success: true,
        message: "Document deleted successfully.",
      });

    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error while deleting document.",
      });
    }
  };
}

// ============================================================================
// MOCK DATA (Replace with database in production)
// ============================================================================

let documents = [];

export default DocumentController;
