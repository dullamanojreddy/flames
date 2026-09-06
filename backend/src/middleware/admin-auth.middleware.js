/**
 * admin-auth.middleware.js
 * Protects administrative and analytics endpoints against unauthorized access.
 * Accepts credentials via HttpOnly cookie or Authorization Bearer header.
 */

const { verifyAdminSessionToken } = require("../services/admin-auth.service");
const { emitSecurityEvent } = require("../services/security-event.service");
const { getClientIp } = require("../utils/ip.utils");
const securityConfig = require("../config/security.config");

/**
 * Express middleware to enforce admin authentication.
 */
function requireAdminAuth(req, res, next) {
    let token = null;

    // 1. Check Cookie
    if (req.cookies && req.cookies[securityConfig.cookie.adminCookieName]) {
        token = req.cookies[securityConfig.cookie.adminCookieName];
    }

    // 2. Check Authorization Header (Bearer <token>)
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization.trim();
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
    }

    // 3. Check X-Admin-Token Header
    if (!token && req.headers["x-admin-token"]) {
        token = req.headers["x-admin-token"].trim();
    }

    const verification = verifyAdminSessionToken(token);

    if (!verification.valid) {
        const clientIp = getClientIp(req);

        emitSecurityEvent({
            eventType: "UNAUTHORIZED_ADMIN_ACCESS",
            severity: "HIGH",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl || req.path,
            method: req.method,
            requestId: req.requestId,
            metadata: {
                reason: verification.reason || "Missing or invalid admin token"
            }
        });

        return res.status(401).json({
            success: false,
            error: {
                message: "Unauthorized. Admin session required."
            },
            requestId: req.requestId
        });
    }

    req.admin = verification.payload;
    return next();
}

module.exports = {
    requireAdminAuth
};
