/**
 * request-id.middleware.js
 * Attaches a unique correlation requestId (e.g. REQ-8f92ab12) to each incoming request
 * and propagates it via the X-Request-Id response header.
 */

const crypto = require("crypto");

/**
 * Express middleware to generate or propagate correlation request IDs.
 */
function requestIdMiddleware(req, res, next) {
    const existing = req.headers["x-request-id"];

    let reqId;
    if (existing && typeof existing === "string" && existing.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(existing)) {
        reqId = existing;
    } else {
        const random = crypto.randomBytes(6).toString("hex");
        reqId = `REQ-${random}`;
    }

    req.requestId = reqId;
    res.setHeader("X-Request-Id", reqId);

    return next();
}

module.exports = {
    requestIdMiddleware
};
