/**
 * security-event.service.js
 * Centralized logging and persistence of security events.
 * Fully isolated: failures in event logging never crash or block business operations.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const SecurityEvent = require("../models/security-event.model");
const logger = require("../utils/logger.utils");
const securityConfig = require("../config/security.config");

/**
 * Emit a structured security event.
 * Asynchronously stores in MongoDB if available, and logs to server output.
 *
 * @param {object} params
 * @param {string} params.eventType One of EVENT_TYPES
 * @param {"INFO" | "WARNING" | "HIGH" | "CRITICAL"} [params.severity="INFO"]
 * @param {string} [params.visitorId]
 * @param {string} [params.sessionId]
 * @param {string} [params.ip]
 * @param {string} [params.route]
 * @param {string} [params.method]
 * @param {object} [params.metadata]
 * @param {string} [params.requestId]
 * @returns {Promise<object|null>}
 */
async function emitSecurityEvent(params = {}) {
    const {
        eventType,
        severity = "INFO",
        visitorId = "",
        sessionId = "",
        ip = "",
        route = "",
        method = "",
        metadata = {},
        requestId = ""
    } = params;

    const eventId = `EVT-${crypto.randomBytes(8).toString("hex")}`;
    const timestamp = new Date();

    // 1. Structured Server Log
    const logLevel = severity === "CRITICAL" || severity === "HIGH" ? "ERROR" : (severity === "WARNING" ? "WARN" : "INFO");
    logger[logLevel.toLowerCase() || "info"](eventType, {
        requestId,
        visitorId,
        sessionId,
        route,
        method,
        metadata: {
            eventId,
            severity,
            ip: securityConfig.ipLoggingEnabled ? ip : "anonymized",
            ...metadata
        }
    });

    // 2. Non-blocking Async Database Persistence
    if (mongoose.connection.readyState === 1) {
        try {
            const retentionDays = 90;
            const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

            await SecurityEvent.create({
                eventId,
                eventType,
                severity,
                visitorId,
                sessionId,
                ip: securityConfig.ipLoggingEnabled ? ip : "anonymized",
                route,
                method,
                timestamp,
                metadata,
                expiresAt
            });
        } catch (err) {
            // Failure isolation: Never throw from security event logger
            logger.warn("SECURITY_EVENT_PERSIST_FAILED", {
                message: err.message,
                eventId
            });
        }
    }

    return { eventId, eventType, severity, timestamp };
}

module.exports = {
    emitSecurityEvent
};
