/**
 * visitor.model.js
 * Mongoose model for anonymous first-party visitors.
 * Stores technical device and activity counters without any personal identity or fingerprinting.
 */

const mongoose = require("mongoose");

const VisitorSchema = new mongoose.Schema(
    {
        visitorId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        firstSeenAt: {
            type: Date,
            default: Date.now
        },

        lastSeenAt: {
            type: Date,
            default: Date.now,
            index: true
        },

        totalSessions: {
            type: Number,
            default: 1,
            min: 1
        },

        totalPageViews: {
            type: Number,
            default: 0,
            min: 0
        },

        totalCalculations: {
            type: Number,
            default: 0,
            min: 0
        },

        firstIp: {
            type: String,
            default: ""
        },

        lastIp: {
            type: String,
            default: ""
        },

        devices: {
            type: [String],
            default: []
        },

        browsers: {
            type: [String],
            default: []
        },

        operatingSystems: {
            type: [String],
            default: []
        },

        locations: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

VisitorSchema.index({ lastSeenAt: -1 });
VisitorSchema.index({ totalCalculations: -1 });

module.exports = mongoose.model("Visitor", VisitorSchema);
