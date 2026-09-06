/**
 * ip.utils.js
 * Proxy-aware client IP extraction and privacy utilities.
 */

const securityConfig = require("../config/security.config");

/**
 * Clean IPv6-mapped IPv4 addresses (e.g. "::ffff:127.0.0.1" -> "127.0.0.1").
 *
 * @param {string} ip
 * @returns {string}
 */
function cleanIp(ip) {
    if (!ip || typeof ip !== "string") return "127.0.0.1";
    let cleaned = ip.trim();
    if (cleaned.startsWith("::ffff:")) {
        cleaned = cleaned.substring(7);
    }
    if (cleaned === "::1") {
        return "127.0.0.1";
    }
    return cleaned;
}

/**
 * Extract client IP address safely from an Express request object,
 * taking reverse proxy headers (Cloudflare, Render, Vercel) into account.
 *
 * @param {import("express").Request} req
 * @returns {string}
 */
function getClientIp(req) {
    if (!securityConfig.ipLoggingEnabled) {
        return "anonymized";
    }

    // 1. Cloudflare header
    const cfIp = req.headers["cf-connecting-ip"];
    if (cfIp && typeof cfIp === "string") {
        return cleanIp(cfIp);
    }

    // 2. Standard X-Real-IP
    const realIp = req.headers["x-real-ip"];
    if (realIp && typeof realIp === "string") {
        return cleanIp(realIp);
    }

    // 3. X-Forwarded-For (take the first, client-most address)
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor && typeof xForwardedFor === "string") {
        const parts = xForwardedFor.split(",");
        if (parts.length > 0 && parts[0].trim()) {
            return cleanIp(parts[0]);
        }
    }

    // 4. Express req.ip (when trust proxy is configured)
    if (req.ip) {
        return cleanIp(req.ip);
    }

    // 5. Raw socket remote address
    if (req.socket && req.socket.remoteAddress) {
        return cleanIp(req.socket.remoteAddress);
    }

    return "127.0.0.1";
}

/**
 * Anonymize an IP address by zeroing the last octet (IPv4) or last 80 bits (IPv6).
 *
 * @param {string} ip
 * @returns {string}
 */
function anonymizeIp(ip) {
    const cleaned = cleanIp(ip);
    if (!cleaned || cleaned === "anonymized") return "anonymized";

    // IPv4: 192.168.1.123 -> 192.168.1.0
    if (cleaned.includes(".")) {
        const parts = cleaned.split(".");
        if (parts.length === 4) {
            parts[3] = "0";
            return parts.join(".");
        }
    }

    // IPv6: 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:85a3::
    if (cleaned.includes(":")) {
        const parts = cleaned.split(":");
        return parts.slice(0, 3).join(":") + "::";
    }

    return cleaned;
}

module.exports = {
    cleanIp,
    getClientIp,
    anonymizeIp
};
