import { supabase } from "./supabase.js";
import { logger } from "../utils/logger.js";

/**
 * Connect to database and verify connection
 */
export async function connectDatabase() {
  try {
    // Test the connection by making a simple query
    const { data, error } = await supabase
      .from("document_embeddings")
      .select("count")
      .limit(1);

    if (error) {
      logger.warn("Database connection test failed:", error.message);
      // Don't throw error as the table might not exist yet
    } else {
      logger.info("✅ Database connection successful");
    }

    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error.message);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase() {
  return supabase;
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabase
      .from("document_embeddings")
      .select("count")
      .limit(1);

    return {
      status: error ? "warning" : "healthy",
      message: error ? "Database accessible but table may not exist" : "Database healthy",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
} 