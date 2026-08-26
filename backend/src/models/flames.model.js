/**
 * flames.model.js
 * Mongoose model for a FLAMES relationship/calculation pair.
 *
 * PRIVACY:
 *  - Stores ONLY: both names, timestamp, date, day, year, result, percentage,
 *    and the attempt counter.
 *  - Does NOT store email, phone, IP, location, device/browser info, cookies,
 *    auth data, or the raw elimination breakdown.
 *
 * normalizedPair -> INTERNAL DB KEY ONLY.
 *  It is derived from the two sanitised names ("a|b" or "b|a", regardless of
 *  input order and case). It contains no information beyond the two names and
 *  is never returned to the client.
 *
 * `timestamp` is managed explicitly by the app, so Mongoose `timestamps` is
 * disabled.
 */

const mongoose = require("mongoose");

const FlamesResultSchema = new mongoose.Schema(
    {
        name1: {
            type: String,
            required: [true, "name1 is required"],
            trim: true,
            maxlength: [50, "name1 cannot exceed 50 characters"]
        },

        name2: {
            type: String,
            required: [true, "name2 is required"],
            trim: true,
            maxlength: [50, "name2 cannot exceed 50 characters"]
        },

        timestamp: {
            type: Date,
            required: [true, "timestamp is required"]
        },

        date: {
            type: String,
            required: [true, "date is required"]
        },

        day: {
            type: String,
            required: [true, "day is required"]
        },

        year: {
            type: Number,
            required: [true, "year is required"]
        },

        result: {
            type: String,
            required: [true, "result is required"],
            enum: {
                values: [
                    "Friends",
                    "Lovers",
                    "Affection",
                    "Marriage",
                    "Enemies",
                    "Siblings"
                ],
                message: "result must be a valid FLAMES outcome"
            }
        },

        percentage: {
            type: Number,
            required: [true, "percentage is required"],
            min: [35, "percentage must be at least 35"],
            max: [99, "percentage must be at most 99"]
        },

        attempts: {
            type: Number,
            required: [true, "attempts is required"],
            min: [1, "attempts must be at least 1"]
        },

        // INTERNAL UNIQUE KEY only. Never exposed to the client.
        normalizedPair: {
            type: String,
            required: true,
            unique: true,
            index: true
        }
    },
    {
        timestamps: false
    }
);

module.exports = mongoose.model("FlamesResult", FlamesResultSchema);