const logger = require("../utils/logger");
const { env } = require("../config/env");

/**
 * Catches requests to routes that don't exist. Must be registered
 * AFTER all real routes and BEFORE the error handler.
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

/**
 * Single place all errors flow through. Never leaks raw internal
 * error messages (stack traces, driver errors, etc) to the client
 * unless the error was explicitly thrown as an operational AppError
 * with a client-safe message.
 * Must be registered LAST, after every other app.use()/route.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.isOperational ? err.message : "Something went wrong. Please try again.";

    // Known Mongoose/Mongo error shapes -> safe, specific messages
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors || {})
            .map((e) => e.message)
            .join(", ") || "Validation failed";
    } else if (err.code === 11000) {
        statusCode = 409;
        message = "A record with this value already exists";
    } else if (err.name === "CastError") {
        statusCode = 400;
        message = "Invalid identifier supplied";
    } else if (err.type === "entity.parse.failed") {
        // Malformed JSON body sent by client
        statusCode = 400;
        message = "Malformed JSON in request body";
    }

    if (statusCode >= 500) {
        logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
    } else {
        logger.warn(message, { path: req.originalUrl, method: req.method });
    }

    const body = { success: false, message };

    if (!env.isProduction && statusCode >= 500) {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
};

module.exports = { notFoundHandler, errorHandler };
