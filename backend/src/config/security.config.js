/**
 * security.config.js
 * Centralized security, visitor observability, privacy, and rate limiting configuration.
 * All settings are driven by environment variables with secure, sensible defaults.
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const securityConfig = {
    nodeEnv: NODE_ENV,
    isProduction: IS_PRODUCTION,

    // Master killswitch: when false, visitor and session tracking are completely disabled
    visitorTrackingEnabled: process.env.VISITOR_TRACKING_ENABLED !== "false",

    // IP logging and privacy
    ipLoggingEnabled: process.env.IP_LOGGING_ENABLED !== "false",
    ipRetentionDays: Number(process.env.IP_RETENTION_DAYS) || 30,
    ipGeolocationEnabled: process.env.IP_GEOLOCATION_ENABLED === "true",

    // Privacy control: never log submitted names in telemetry unless explicitly enabled
    flamesInputLoggingEnabled: process.env.FLAMES_INPUT_LOGGING_ENABLED === "true",

    // Active visitor window in seconds (default: 300s = 5 minutes)
    activeVisitorWindowSeconds: Number(process.env.ACTIVE_VISITOR_WINDOW_SECONDS) || 300,

    // Cookie configuration
    cookie: {
        secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : IS_PRODUCTION,
        sameSite: process.env.COOKIE_SAME_SITE || "lax",
        visitorCookieName: "flames_vid",
        sessionCookieName: "flames_sid",
        adminCookieName: "flames_admin_token",
        visitorMaxAgeMs: 365 * 24 * 60 * 60 * 1000, // 1 year
        sessionMaxAgeMs: 24 * 60 * 60 * 1000,       // 24 hours
        adminMaxAgeMs: 8 * 60 * 60 * 1000           // 8 hours
    },

    // Admin authentication
    admin: {
        password: process.env.ADMIN_PASSWORD || "admin1234567890",
        sessionSecret: process.env.ADMIN_SESSION_SECRET || "flames-secret-admin-session-salt-2026",
        sessionDurationMs: 8 * 60 * 60 * 1000
    },

    // Rate limits (windowMs and max hits)
    rateLimits: {
        general: {
            windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000,
            max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 150
        },
        flames: {
            windowMs: Number(process.env.RATE_LIMIT_FLAMES_WINDOW_MS) || Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
            max: Number(process.env.RATE_LIMIT_FLAMES_MAX) || Number(process.env.RATE_LIMIT_MAX) || 30
        },
        admin: {
            windowMs: Number(process.env.RATE_LIMIT_ADMIN_WINDOW_MS) || 15 * 60 * 1000,
            max: Number(process.env.RATE_LIMIT_ADMIN_MAX) || 60
        },
        auth: {
            windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000,
            max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5
        }
    },

    // Proxy settings: trust proxy configuration for reverse proxies (Render, Vercel, Cloudflare)
    trustProxy: process.env.TRUST_PROXY || (IS_PRODUCTION ? 1 : false),

    // CORS allowed origins list
    allowedOrigins: (() => {
        const raw = process.env.CLIENT_ORIGIN || process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "";
        if (!raw) return true; // Allows dynamic origin matching in dev if unset
        const list = raw.split(",").map(o => o.trim()).filter(Boolean);
        return list.length > 0 ? list : true;
    })()
};

module.exports = securityConfig;
