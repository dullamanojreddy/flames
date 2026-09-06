/**
 * session.model.js
 * Mongoose model for anonymous visitor browsing sessions.
 * Automatically retained/cleaned up using MongoDB TTL on expiresAt.
 */

const mongoose = require("mongoose");
const securityConfig = require("../config/security.config");

const SessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        visitorId: {
            type: String,
            required: true,
            index: true,
            trim: true
        },

        startedAt: {
            type: Date,
            default: Date.now
        },

        lastActivityAt: {
            type: Date,
            default: Date.now,
            index: true
        },

        endedAt: {
            type: Date
        },

        requestCount: {
            type: Number,
            default: 1,
            min: 1
        },

        pageViewCount: {
            type: Number,
            default: 0,
            min: 0
        },

        calculationCount: {
            type: Number,
            default: 0,
            min: 0
        },

        ip: {
            type: String,
            default: ""
        },

        userAgent: {
            type: String,
            default: ""
        },

        device: {
            type: String,
            default: "Desktop"
        },

        browser: {
            type: String,
            default: "Unknown"
        },

        os: {
            type: String,
            default: "Unknown"
        },

        location: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + securityConfig.ipRetentionDays * 24 * 60 * 60 * 1000)
        }
    },
    {
        timestamps: true
    }
);

// TTL index to automatically purge old sessions after expiresAt
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ visitorId: 1, startedAt: -1 });
SessionSchema.index({ lastActivityAt: -1 });

module.exports = mongoose.model("Session", SessionSchema);
