/**
 * server.js - FLAMES Application Server
 * Entry point. Loads env, connects to MongoDB, starts Express, and wires up
 * graceful shutdown. The process exits when the database connection fails.
 */

require("dotenv").config();

const { createApp } = require("./app");
const { connectDatabase, disconnectDatabase } = require("./config/database");

const PORT = Number(process.env.PORT) || 5000;

async function start() {
    // Fail fast: never run without a database.
    await connectDatabase();

    const app = createApp();

    const server = app.listen(PORT, () => {
        console.log(`🚀 FLAMES API listening on http://localhost:${PORT} (${process.env.NODE_ENV || "development"})`);
    });

    // Graceful shutdown.
    async function shutdown(signal) {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        server.close(async () => {
            try {
                await disconnectDatabase();
                console.log("👋 Shutdown complete.");
                process.exit(0);
            } catch (err) {
                console.error("Error during shutdown:", err.message);
                process.exit(1);
            }
        });

        // Force-exit if the server cannot close in time.
        setTimeout(() => process.exit(1), 10000).unref();
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
    console.error("❌ Failed to start FLAMES API:", err.message);
    process.exit(1);
});