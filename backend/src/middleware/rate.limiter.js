/**
 * rate.limiter.js
 * Basic per-IP rate limiting for the calculation endpoint.
 *
 * Configurable via environment variables and/or override options so tests can
 * exercise the 429 behaviour with a small limit.
 */

const rateLimit = require("express-rate-limit");

/**
 * Create a rate limiter configured for the FLAMES endpoint.
 *
 * @param {object} [override] Optional { windowMs, max } override (used in tests).
 * @returns {import("express-rate-limit").RateLimitRequestHandler}
 */
function createFlamesRateLimiter(override = {}) {
    const windowMs =
        Number(override.windowMs) ||
        Number(process.env.RATE_LIMIT_WINDOW_MS) ||
        15 * 60 * 1000;

    const max =
        Number(override.max) ||
        Number(process.env.RATE_LIMIT_MAX) ||
        100;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: { message: "Too many requests. Please try again later. ❤️" }
        }
    });
}

module.exports = {
    createFlamesRateLimiter
};