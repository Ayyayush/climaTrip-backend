/**
 * Operational error with an HTTP status code attached.
 * Controllers/services throw this for expected failure cases
 * (validation, not found, unauthorized, upstream AI failure, etc).
 * Anything thrown that is NOT an AppError is treated as an
 * unexpected bug by the centralized error handler and never
 * leaks its raw message to the client.
 */
class AppError extends Error {
    constructor(message, statusCode = 500, details = undefined) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
