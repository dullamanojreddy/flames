/**
 * abuse-detector.middleware.js
 * Lightweight abuse detection and probe protection.
 * Identifies suspicious route scanning, sensitive file probes (.env, .git), and emits security events.
 */

const { emitSecurityEvent } = require("../services/security-event.service");
const { getClientIp } = require("../utils/ip.utils");

const PROBE_PATTERNS = [
    /\.env/i,
    /\.git/i,
    /wp-admin/i,
    /wp-login/i,
    /phpmyadmin/i,
    /\.php$/i,
    /cgi-bin/i,
    /xmlrpc/i,
    /eval\(/i,
    /<script/i,
    /select.+from/i,
    /union.+select/i,
    /etc\/passwd/i
];

/**
 * Express middleware to detect probes and malicious route scanning.
 */
function abuseDetectorMiddleware(req, res, next) {
    const url = req.originalUrl || req.url || "";
    const clientIp = getClientIp(req);

    // Check if requested URL matches known exploit or scanner signatures
    const isProbe = PROBE_PATTERNS.some(pattern => pattern.test(url));

    if (isProbe) {
        emitSecurityEvent({
            eventType: "SUSPICIOUS_REQUEST",
            severity: "HIGH",
            visitorId: req.visitorId || "",
            sessionId: req.sessionId || "",
            ip: clientIp,
            route: url,
            method: req.method,
            requestId: req.requestId,
            metadata: {
                flag: "Malicious probe or scanner pattern matched",
                userAgent: (req.headers["user-agent"] || "").slice(0, 150)
            }
        });

        return res.status(404).json({
            success: false,
            error: {
                message: "Route not found"
            },
            requestId: req.requestId
        });
    }

    return next();
}

module.exports = {
    abuseDetectorMiddleware
};
