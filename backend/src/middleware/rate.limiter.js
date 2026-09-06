/**
 * rate.limiter.js
 * Multi-tier rate limiting for General API, FLAMES calculations, Admin routes, and Authentication.
 * Includes security event logging on rate limit violations.
 */

const rateLimit = require("express-rate-limit");
const securityConfig = require("../config/security.config");
const { getClientIp } = require("../utils/ip.utils");
const { emitSecurityEvent } = require("../services/security-event.service");

/**
 * Standard handler for 429 Too Many Requests responses with security telemetry.
 *
 * @param {string} category
 */
function createRateLimitHandler(category) {
    return (req, res, next, options) => {
        const clientIp = getClientIp(req);

        emitSecurityEvent({
            eventType: "RATE_LIMIT_TRIGGERED",
            severity: category === "auth" ? "HIGH" : "WARNING",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId: req.requestId,
            metadata: {
                category,
                windowMs: options.windowMs,
                max: options.max
            }
        });

        res.status(429).json({
            success: false,
            error: {
                message: options.message?.error?.message || "Too many requests. Please try again later. ❤️"
            },
            requestId: req.requestId
        });
    };
}

/**
 * FLAMES calculation rate limiter (preserves backward compatibility with existing tests).
 *
 * @param {object} [override]
 */
function createFlamesRateLimiter(override = {}) {
    const windowMs =
        Number(override.windowMs) ||
        Number(process.env.RATE_LIMIT_FLAMES_WINDOW_MS) ||
        Number(process.env.RATE_LIMIT_WINDOW_MS) ||
        securityConfig.rateLimits.flames.windowMs;

    const max =
        Number(override.max) ||
        Number(process.env.RATE_LIMIT_FLAMES_MAX) ||
        Number(process.env.RATE_LIMIT_MAX) ||
        securityConfig.rateLimits.flames.max;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: createRateLimitHandler("flames"),
        message: {
            success: false,
            error: { message: "Too many requests. Please try again later. ❤️" }
        }
    });
}

/**
 * General API rate limiter for standard endpoints.
 */
function createGeneralRateLimiter(override = {}) {
    const windowMs = Number(override.windowMs) || securityConfig.rateLimits.general.windowMs;
    const max = Number(override.max) || securityConfig.rateLimits.general.max;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: createRateLimitHandler("general"),
        message: {
            success: false,
            error: { message: "API rate limit reached. Please wait before retrying." }
        }
    });
}

/**
 * Admin API rate limiter.
 */
function createAdminRateLimiter(override = {}) {
    const windowMs = Number(override.windowMs) || securityConfig.rateLimits.admin.windowMs;
    const max = Number(override.max) || securityConfig.rateLimits.admin.max;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: createRateLimitHandler("admin"),
        message: {
            success: false,
            error: { message: "Admin rate limit reached. Please slow down." }
        }
    });
}

/**
 * High-security authentication rate limiter to prevent brute-force login attempts.
 */
function createAuthRateLimiter(override = {}) {
    const windowMs = Number(override.windowMs) || securityConfig.rateLimits.auth.windowMs;
    const max = Number(override.max) || securityConfig.rateLimits.auth.max;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: createRateLimitHandler("auth"),
        message: {
            success: false,
            error: { message: "Too many login attempts. Please wait 15 minutes." }
        }
    });
}

module.exports = {
    createFlamesRateLimiter,
    createGeneralRateLimiter,
    createAdminRateLimiter,
    createAuthRateLimiter
};