/**
 * error.middleware.js
 * Centralised, consistent JSON error responses.
 *
 * Handles:
 *   400  validation / malformed JSON
 *   404  unknown route
 *   429  rate limit
 *   500  unexpected internal errors (never leak MongoDB internals)
 */

/**
 * Express error-handling middleware.
 * Must be registered as the LAST middleware in the app.
 */
function errorMiddleware(err, req, res, next) {
    // Malformed JSON from express.json() (body-parser SyntaxError).
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            error: { message: "Invalid JSON payload" }
        });
    }

    // Payload too large.
    if (err && err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            error: { message: "Request body too large" }
        });
    }

    const statusCode = err.statusCode || err.status || 500;

    // Never leak technical/internal details on server errors.
    if (statusCode >= 500) {
        // Safe to log the message without request bodies (no personal info).
        console.error("[error] ", err.message);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }

    return res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || "Request failed"
        }
    });
}

/** 404 handler for unknown routes. */
function notFoundMiddleware(req, res, next) {
    res.status(404).json({
        success: false,
        error: { message: "Route not found" }
    });
}

module.exports = {
    errorMiddleware,
    notFoundMiddleware: notFoundMiddleware
};