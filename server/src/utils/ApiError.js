/**
 * Custom API error class for structured, predictable error handling.
 * All thrown errors in service/controller layers should use this class
 * so the central errorHandler can format them consistently.
 */
class ApiError extends Error {
  constructor(statusCode, message, code = null, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    // Optional extra fields (e.g. { userId }) merged into the error response
    // body by errorHandler — lets a specific error carry the one extra piece
    // of context a caller needs (see ACCOUNT_NOT_VERIFIED) without widening
    // the general error shape for every error.
    this.data = data;
    this.isOperational = true; // distinguishes from unexpected programmer errors
  }
}

export default ApiError;
