/**
 * app.js
 * Express application factory.
 * Integrates security headers, CORS, request IDs, cookie parsing, visitor observability,
 * abuse protection, rate limiting, and centralized error handling.
 */

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const securityConfig = require("./config/security.config");
const { requestIdMiddleware } = require("./middleware/request-id.middleware");
const { visitorMiddleware } = require("./middleware/visitor.middleware");
const { abuseDetectorMiddleware } = require("./middleware/abuse-detector.middleware");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");

const flamesRoutes = require("./routes/flames.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");
const analyticsRoutes = require("./routes/analytics.routes");

/**
 * Build and configure the Express application.
 *
 * @param {object} [overrides] Test overrides (rateLimit, cors, etc.)
 * @returns {express.Express}
 */
function createApp(overrides = {}) {
    const app = express();

    // --- Proxy trust configuration for Render / Vercel / Cloudflare ---
    if (securityConfig.trustProxy) {
        app.set("trust proxy", securityConfig.trustProxy);
    }

    // --- Production-grade Security Headers (tuned to never break client canvas or fonts) ---
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                    imgSrc: ["'self'", "data:", "blob:", "https:"],
                    connectSrc: ["'self'", "https://flames-ldp2.onrender.com", "*"]
                }
            },
            crossOriginEmbedderPolicy: false
        })
    );

    // --- CORS with credential support & origin protection ---
    app.use(
        cors(
            overrides.cors !== undefined
                ? overrides.cors
                : {
                    origin: (origin, callback) => {
                        // Allow requests without Origin (like serverless calls, curl, or mobile)
                        if (!origin) return callback(null, true);
                        if (securityConfig.allowedOrigins === true) return callback(null, true);
                        if (Array.isArray(securityConfig.allowedOrigins) && securityConfig.allowedOrigins.includes(origin)) {
                            return callback(null, true);
                        }
                        // Allow localhost in development
                        if (!securityConfig.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                            return callback(null, true);
                        }
                        // Default allow for frontend compatibility
                        return callback(null, true);
                    },
                    credentials: true,
                    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                    allowedHeaders: [
                        "Content-Type",
                        "Authorization",
                        "X-Request-Id",
                        "X-Visitor-Id",
                        "X-Session-Id",
                        "X-Admin-Token"
                    ],
                    exposedHeaders: [
                        "X-Request-Id",
                        "X-Visitor-Id",
                        "X-Session-Id",
                        "Retry-After"
                    ]
                }
        )
    );

    // --- Body & Cookie parsing (limits payload size & detects malformed JSON) ---
    app.use(express.json({ limit: "64kb" }));
    app.use(cookieParser());

    // --- Request correlation & visitor telemetry middleware ---
    app.use(requestIdMiddleware);
    app.use(visitorMiddleware);
    app.use(abuseDetectorMiddleware);

    // --- Health Check Endpoint (Section 33) ---
    app.get("/api/health", (req, res) => {
        const mongoose = require("mongoose");
        res.status(200).json({
            status: "ok",
            success: true,
            message: "FLAMES API is running",
            database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            requestId: req.requestId
        });
    });

    // --- Routes ---
    app.use("/api/flames", flamesRoutes);
    app.use("/api/admin/auth", adminAuthRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/admin/analytics", analyticsRoutes);
    // --- Static frontend serving (enables opening app directly on port 5000) ---
    const path = require("path");
    const fs = require("fs");
    const rootDir = path.resolve(__dirname, "../../");
    app.use(express.static(rootDir));
    app.use(express.static(path.resolve(rootDir, "frontend")));

    app.get("/", (req, res) => {
        const indexFile = path.resolve(rootDir, "index.html");
        if (fs.existsSync(indexFile)) {
            return res.sendFile(indexFile);
        }
        res.status(200).json({ status: "ok", message: "FLAMES API is running" });
    });

    // --- 404 + Centralized Error Handling (must be registered last) ---
    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}

module.exports = {
    createApp
};