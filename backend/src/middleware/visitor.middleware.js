/**
 * visitor.middleware.js
 * Express middleware for anonymous first-party visitor and session identification.
 * Uses HttpOnly cookies where supported, with header fallbacks (X-Visitor-Id, X-Session-Id)
 * to guarantee compatibility with cross-domain deployments (Vercel frontend -> Render backend).
 */

const { getClientIp } = require("../utils/ip.utils");
const { syncVisitorSession } = require("../services/visitor.service");
const securityConfig = require("../config/security.config");

/**
 * Middleware to track visitor and session IDs without blocking request execution.
 */
async function visitorMiddleware(req, res, next) {
    if (!securityConfig.visitorTrackingEnabled) {
        return next();
    }

    // Skip static assets or health checks if needed
    if (req.path === "/api/health" || req.path.startsWith("/assets/")) {
        return next();
    }

    try {
        const clientIp = getClientIp(req);
        const userAgent = req.headers["user-agent"] || "";

        // Read incoming visitor ID from cookie or header
        const incomingVisitorId =
            req.cookies?.[securityConfig.cookie.visitorCookieName] ||
            req.headers["x-visitor-id"];

        // Read incoming session ID from cookie or header
        const incomingSessionId =
            req.cookies?.[securityConfig.cookie.sessionCookieName] ||
            req.headers["x-session-id"];

        const { visitorId, sessionId } = await syncVisitorSession({
            incomingVisitorId,
            incomingSessionId,
            ip: clientIp,
            userAgent,
            route: req.originalUrl || req.path,
            method: req.method
        });

        req.visitorId = visitorId;
        req.sessionId = sessionId;

        // Set response headers for client visibility & cross-origin storage
        res.setHeader("X-Visitor-Id", visitorId);
        res.setHeader("X-Session-Id", sessionId);

        // Set HttpOnly first-party cookies with appropriate SameSite and Secure flags
        if (res.cookie) {
            res.cookie(securityConfig.cookie.visitorCookieName, visitorId, {
                httpOnly: true,
                secure: securityConfig.cookie.secure,
                sameSite: securityConfig.cookie.sameSite,
                maxAge: securityConfig.cookie.visitorMaxAgeMs,
                path: "/"
            });

            res.cookie(securityConfig.cookie.sessionCookieName, sessionId, {
                httpOnly: true,
                secure: securityConfig.cookie.secure,
                sameSite: securityConfig.cookie.sameSite,
                maxAge: securityConfig.cookie.sessionMaxAgeMs,
                path: "/"
            });
        }
    } catch (err) {
        // Failure isolation: Never let visitor tracking disrupt request handling
    }

    return next();
}

module.exports = {
    visitorMiddleware
};
