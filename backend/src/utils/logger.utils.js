/**
 * logger.utils.js
 * Structured JSON server logger with request correlation IDs.
 * Strictly avoids logging sensitive calculation input names into application logs.
 */

const securityConfig = require("../config/security.config");

/**
 * Format and write a structured log entry to stdout / stderr.
 *
 * @param {"INFO" | "WARN" | "ERROR" | "DEBUG"} level
 * @param {string} event Event name or description
 * @param {object} [context] Request or event context
 */
function log(level, event, context = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        requestId: context.requestId || undefined,
        visitorId: context.visitorId || undefined,
        sessionId: context.sessionId || undefined,
        route: context.route || undefined,
        method: context.method || undefined,
        message: context.message || undefined
    };

    // Filter out undefined keys for compact JSON
    Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

    // Attach sanitized metadata if present
    if (context.metadata && typeof context.metadata === "object") {
        const meta = { ...context.metadata };
        // Privacy rule: Never leak submitted names to server logs
        if (!securityConfig.flamesInputLoggingEnabled) {
            delete meta.name1;
            delete meta.name2;
        }
        if (Object.keys(meta).length > 0) {
            entry.metadata = meta;
        }
    }

    const output = JSON.stringify(entry);

    if (level === "ERROR") {
        console.error(output);
    } else if (level === "WARN") {
        console.warn(output);
    } else {
        console.log(output);
    }
}

const logger = {
    info: (event, ctx) => log("INFO", event, ctx),
    warn: (event, ctx) => log("WARN", event, ctx),
    error: (event, ctx) => log("ERROR", event, ctx),
    debug: (event, ctx) => {
        if (!securityConfig.isProduction) {
            log("DEBUG", event, ctx);
        }
    }
};

module.exports = logger;
