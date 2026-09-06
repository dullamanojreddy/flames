/**
 * admin-auth.service.js
 * Cryptographically secure Admin Authentication service.
 * Uses timing-safe password comparison and HMAC-SHA256 signed session tokens
 * without heavy external JWT dependencies.
 */

const crypto = require("crypto");
const securityConfig = require("../config/security.config");

// In-memory blacklist for revoked tokens
const revokedTokens = new Set();

/**
 * Perform constant-time string comparison to prevent timing attacks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeCompare(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        // Run dummy comparison to equalize timing
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify administrator password against configured secret.
 *
 * @param {string} enteredPassword
 * @returns {boolean}
 */
function verifyAdminPassword(enteredPassword) {
    const expected = String(securityConfig.admin.password || "admin1234567890");
    return safeCompare(String(enteredPassword || ""), expected);
}

/**
 * Generate a cryptographically signed HMAC-SHA256 admin session token.
 *
 * @returns {{ token: string, expiresAt: number }}
 */
function createAdminSessionToken() {
    const now = Date.now();
    const expiresAt = now + securityConfig.admin.sessionDurationMs;
    const payload = {
        role: "admin",
        iat: now,
        exp: expiresAt,
        nonce: crypto.randomBytes(8).toString("hex")
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", securityConfig.admin.sessionSecret)
        .update(payloadB64)
        .digest("base64url");

    const token = `${payloadB64}.${signature}`;
    return { token, expiresAt };
}

/**
 * Verify and decode an admin session token.
 *
 * @param {string} token
 * @returns {{ valid: boolean, payload?: object, reason?: string }}
 */
function verifyAdminSessionToken(token) {
    if (!token || typeof token !== "string") {
        return { valid: false, reason: "Missing token" };
    }

    if (revokedTokens.has(token)) {
        return { valid: false, reason: "Token has been revoked" };
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
        return { valid: false, reason: "Malformed token structure" };
    }

    const [payloadB64, signature] = parts;

    // Verify signature with timing-safe comparison
    const expectedSig = crypto
        .createHmac("sha256", securityConfig.admin.sessionSecret)
        .update(payloadB64)
        .digest("base64url");

    if (!safeCompare(signature, expectedSig)) {
        return { valid: false, reason: "Invalid signature" };
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

        if (!payload || payload.role !== "admin") {
            return { valid: false, reason: "Invalid token role" };
        }

        if (Date.now() > payload.exp) {
            return { valid: false, reason: "Token expired" };
        }

        return { valid: true, payload };
    } catch (err) {
        return { valid: false, reason: "Invalid token payload JSON" };
    }
}

/**
 * Invalidate/revoke an admin token.
 *
 * @param {string} token
 */
function revokeAdminToken(token) {
    if (token && typeof token === "string") {
        revokedTokens.add(token);
        // Limit in-memory set size
        if (revokedTokens.size > 10000) {
            const firstItem = revokedTokens.values().next().value;
            revokedTokens.delete(firstItem);
        }
    }
}

module.exports = {
    verifyAdminPassword,
    createAdminSessionToken,
    verifyAdminSessionToken,
    revokeAdminToken,
    safeCompare
};
