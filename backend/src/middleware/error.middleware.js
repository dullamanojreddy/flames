/**
 * error.middleware.js
 * Centralised, consistent JSON error responses with request correlation tracking.
 * Strictly prevents leaking sensitive MongoDB internals, stack traces, or credentials.
 */

const logger = require("../utils/logger.utils");
const { emitSecurityEvent } = require("../services/security-event.service");
const { getClientIp } = require("../utils/ip.utils");

/**
 * Express error-handling middleware.
 * Must be registered as the LAST middleware in the app.
 */
function errorMiddleware(err, req, res, next) {
    const requestId = req.requestId || undefined;
    const clientIp = getClientIp(req);

    // Malformed JSON from express.json() (body-parser SyntaxError).
    if (err && err.type === "entity.parse.failed") {
        emitSecurityEvent({
            eventType: "INVALID_REQUEST",
            severity: "WARNING",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId,
            metadata: { reason: "Malformed JSON payload" }
        });

        return res.status(400).json({
            success: false,
            error: { message: "Invalid JSON payload" },
            requestId
        });
    }

    // Payload too large.
    if (err && err.type === "entity.too.large") {
        emitSecurityEvent({
            eventType: "SUSPICIOUS_REQUEST",
            severity: "WARNING",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId,
            metadata: { reason: "Request payload exceeded size limit" }
        });

        return res.status(413).json({
            success: false,
            error: { message: "Request body too large" },
            requestId
        });
    }

    const statusCode = err.statusCode || err.status || 500;

    // Never leak technical/internal details on server errors.
    if (statusCode >= 500) {
        logger.error("SERVER_ERROR", {
            requestId,
            visitorId: req.visitorId,
            sessionId: req.sessionId,
            route: req.originalUrl || req.path,
            method: req.method,
            message: err.message
        });

        emitSecurityEvent({
            eventType: "SERVER_ERROR",
            severity: "CRITICAL",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId,
            metadata: { error: err.message }
        });

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
            requestId
        });
    }

    // 4xx validation or client error
    if (statusCode === 400) {
        emitSecurityEvent({
            eventType: "VALIDATION_FAILURE",
            severity: "INFO",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId,
            metadata: { message: err.message }
        });
    }

    return res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || "Request failed"
        },
        requestId
    });
}

/** 404 handler for unknown routes. */
function notFoundMiddleware(req, res, next) {
    res.status(404).json({
        success: false,
        error: { message: "Route not found" },
        requestId: req.requestId
    });
}

module.exports = {
    errorMiddleware,
    notFoundMiddleware
};