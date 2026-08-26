/**
 * database.js
 * MongoDB connection lifecycle using Mongoose.
 *
 * The server should never silently run without a database, so callers await
 * connectDatabase() during startup and abort when it fails.
 */

const mongoose = require("mongoose");
const dns = require("dns");

try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (err) {
    // ignore if restricted
}

/**
 * Connect to MongoDB using process.env.MONGODB_URI.
 * Throws (rejects) when the connection cannot be established.
 */
async function connectDatabase() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI is not set. Cannot connect to MongoDB.");
    }

    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    mongoose.connection.on("connected", () => {
        console.log("✅ MongoDB connected");
    });

    mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("⚠️  MongoDB disconnected");
    });

    await mongoose.connect(uri);

    return mongoose.connection;
}

/**
 * Close the database connection cleanly.
 */
async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
}

module.exports = {
    connectDatabase,
    disconnectDatabase
};