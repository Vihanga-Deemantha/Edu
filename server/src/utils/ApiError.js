/**
 * Custom API error class for structured, predictable error handling.
 * All thrown errors in service/controller layers should use this class
 * so the central errorHandler can format them consistently.
 */
class ApiError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguishes from unexpected programmer errors
  }
}

export default ApiError;
