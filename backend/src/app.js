/**
 * app.js
 * Express application factory (kept separate from server.js so it can be
 * imported directly by tests).
 */

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const flamesRoutes = require("./routes/flames.routes");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");

/**
 * Build and configure the Express application.
 *
 * @param {object}   [overrides] Test overrides (rateLimit, ...)
 * @returns {express.Express}
 */
function createApp(overrides = {}) {
    const app = express();

    // --- Security headers ---
    app.use(helmet());

    // --- CORS (Allows Vercel frontend, mobile browsers, and local dev) ---
    app.use(
        cors(
            overrides.cors !== undefined
                ? overrides.cors
                : {
                    origin: true,
                    credentials: false
                }
        )
    );

    // --- Body parsing (limits size & detects malformed JSON) ---
    app.use(express.json({ limit: "64kb" }));

    // --- Routes ---
    app.get("/api/health", (req, res) => {
        const mongoose = require("mongoose");
        res.status(200).json({
            success: true,
            message: "FLAMES API is running",
            database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
        });
    });

    app.use("/api/flames", flamesRoutes);

    // --- 404 + error handling (must be last) ---
    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}

module.exports = {
    createApp
};