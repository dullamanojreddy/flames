/**
 * admin-auth.controller.js
 * Controller handling administrator authentication, session verification, and logout.
 */

const {
    verifyAdminPassword,
    createAdminSessionToken,
    verifyAdminSessionToken,
    revokeAdminToken
} = require("../services/admin-auth.service");
const { emitSecurityEvent } = require("../services/security-event.service");
const { getClientIp } = require("../utils/ip.utils");
const securityConfig = require("../config/security.config");

/**
 * Handle POST /api/admin/auth/login
 */
async function adminLoginController(req, res, next) {
    try {
        const { password } = req.body || {};
        const clientIp = getClientIp(req);

        if (!password || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                error: { message: "Password is required" },
                requestId: req.requestId
            });
        }

        const isValid = verifyAdminPassword(password);

        if (!isValid) {
            await emitSecurityEvent({
                eventType: "ADMIN_LOGIN_FAILURE",
                severity: "WARNING",
                visitorId: req.visitorId || "",
                sessionId: req.sessionId || "",
                ip: clientIp,
                route: req.originalUrl,
                method: "POST",
                requestId: req.requestId,
                metadata: { reason: "Incorrect admin password entered" }
            });

            return res.status(401).json({
                success: false,
                error: { message: "Invalid administrator credentials" },
                requestId: req.requestId
            });
        }

        // Login successful
        const { token, expiresAt } = createAdminSessionToken();

        await emitSecurityEvent({
            eventType: "ADMIN_LOGIN_SUCCESS",
            severity: "INFO",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: req.originalUrl,
            method: "POST",
            requestId: req.requestId
        });

        // Set HttpOnly admin session cookie
        if (res.cookie) {
            res.cookie(securityConfig.cookie.adminCookieName, token, {
                httpOnly: true,
                secure: securityConfig.cookie.secure,
                sameSite: securityConfig.cookie.sameSite,
                maxAge: securityConfig.admin.sessionDurationMs,
                path: "/"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Authentication successful",
            token,
            expiresAt,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle GET /api/admin/auth/verify
 */
async function adminVerifyController(req, res, next) {
    try {
        let token =
            req.cookies?.[securityConfig.cookie.adminCookieName] ||
            (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null) ||
            req.headers["x-admin-token"];

        const verification = verifyAdminSessionToken(token);

        if (!verification.valid) {
            return res.status(401).json({
                success: false,
                authenticated: false,
                error: { message: verification.reason || "Invalid or expired session" },
                requestId: req.requestId
            });
        }

        return res.status(200).json({
            success: true,
            authenticated: true,
            payload: verification.payload,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle POST /api/admin/auth/logout
 */
async function adminLogoutController(req, res, next) {
    try {
        const token =
            req.cookies?.[securityConfig.cookie.adminCookieName] ||
            (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null);

        if (token) {
            revokeAdminToken(token);
        }

        if (res.clearCookie) {
            res.clearCookie(securityConfig.cookie.adminCookieName, {
                path: "/"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    adminLoginController,
    adminVerifyController,
    adminLogoutController
};
