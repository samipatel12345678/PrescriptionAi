import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";

/**
 * Middleware to validate request using express-validator
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn("Validation failed", {
      errors: errors.array(),
      url: req.url,
      method: req.method,
    });

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
}; 