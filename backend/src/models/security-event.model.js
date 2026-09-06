/**
 * security-event.model.js
 * Mongoose model for security, audit, and observability events.
 * Features automated retention via TTL indexing.
 */

const mongoose = require("mongoose");
const securityConfig = require("../config/security.config");

const EVENT_TYPES = [
    "VISITOR_CREATED",
    "SESSION_CREATED",
    "PAGE_VIEW",
    "FLAMES_CALCULATED",
    "INVALID_REQUEST",
    "VALIDATION_FAILURE",
    "RATE_LIMIT_TRIGGERED",
    "SUSPICIOUS_REQUEST",
    "ADMIN_LOGIN_SUCCESS",
    "ADMIN_LOGIN_FAILURE",
    "UNAUTHORIZED_ADMIN_ACCESS",
    "SERVER_ERROR",
    "CORS_REJECTION",
    "ABUSE_DETECTED"
];

const SEVERITY_LEVELS = ["INFO", "WARNING", "HIGH", "CRITICAL"];

const SecurityEventSchema = new mongoose.Schema(
    {
        eventId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        eventType: {
            type: String,
            required: true,
            enum: EVENT_TYPES,
            index: true
        },

        severity: {
            type: String,
            required: true,
            enum: SEVERITY_LEVELS,
            default: "INFO",
            index: true
        },

        visitorId: {
            type: String,
            index: true,
            default: ""
        },

        sessionId: {
            type: String,
            default: ""
        },

        ip: {
            type: String,
            index: true,
            default: ""
        },

        route: {
            type: String,
            default: ""
        },

        method: {
            type: String,
            default: ""
        },

        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days retention
        }
    },
    {
        timestamps: false
    }
);

// TTL index to automatically purge expired security events
SecurityEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SecurityEventSchema.index({ timestamp: -1 });
SecurityEventSchema.index({ visitorId: 1, timestamp: -1 });

module.exports = mongoose.model("SecurityEvent", SecurityEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
