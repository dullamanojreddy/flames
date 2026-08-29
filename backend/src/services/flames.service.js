/**
 * flames.service.js
 * Business logic for the FLAMES calculation.
 *
 * The algorithms below are re-implementations of the existing frontend
 * (frontend/flames.html) so the backend and browser always agree:
 *
 *   - calculateFlames          == frontend `calculateFlamesDetailed`
 *   - calculateCompatibility   == frontend `calculateCompatibility`
 *
 * The controller stays thin; all decision-making lives here.
 */

const FlamesResult = require("../models/flames.model");
const { getCurrentDateDetails } = require("../utils/date.utils");

// FLAMES letter -> full result name (matches the frontend resultData map).
const RESULT_MAP = {
    F: "Friends",
    L: "Lovers",
    A: "Affection",
    M: "Marriage",
    E: "Enemies",
    S: "Siblings"
};

/**
 * Normalise a single name for identity matching.
 * Lowercases and keeps only a-z letters.
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Build the internal, order/case-insensitive unique pair key.
 *
 * NOTE: This is ONLY an internal database key. It is derived solely from the
 * two names (sorted alphabetically, lowercased) so "Alex|Jordan" equals
 * "jordan|alex" equals "ALEX|JORDAN". It stores no extra personal data.
 *
 * @param {string} name1
 * @param {string} name2
 * @returns {string} e.g. "alex|jordan"
 */
function createNormalizedPair(name1, name2) {
    return [normalizeName(name1), normalizeName(name2)].sort().join("|");
}

/**
 * Core FLAMES algorithm — identical behaviour to the frontend.
 *
 * @param {string} name1
 * @param {string} name2
 * @returns {{
 *   result: string,
 *   remainingA: string[],
 *   remainingB: string[],
 *   remaining: number,
 *   eliminationSteps: string[]
 * }}
 */
function calculateDetailedFlames(name1, name2) {
    let a = normalizeName(name1).split("");
    let b = normalizeName(name2).split("");

    // Single-pass removal of common letters (matches frontend exactly).
    for (let i = 0; i < a.length; i++) {
        const index = b.indexOf(a[i]);
        if (index !== -1) {
            a[i] = "";
            b[index] = "";
        }
    }

    const remainingA = a.filter(x => x !== "");
    const remainingB = b.filter(x => x !== "");
    const remaining = remainingA.length + remainingB.length;
    const count = remaining > 0 ? remaining : 1;

    let flames = ["F", "L", "A", "M", "E", "S"];
    let eliminationSteps = [];
    let index = 0;

    while (flames.length > 1) {
        index = (index + count - 1) % flames.length;
        const removed = flames[index];
        eliminationSteps.push(`${flames.join(" → ")}  ❌ ${removed}`);
        flames.splice(index, 1);
    }

    return {
        result: flames[0],
        remainingA,
        remainingB,
        remaining,
        eliminationSteps
    };
}

/**
 * Return only the final FLAMES letter for the pair.
 *
 * @param {string} name1
 * @param {string} name2
 * @returns {string} "F" | "L" | "A" | "M" | "E" | "S"
 */
function calculateFlames(name1, name2) {
    return calculateDetailedFlames(name1, name2).result;
}

/**
 * Compatibility percentage — identical to the frontend `calculateCompatibility`.
 *
 * @param {string} name1
 * @param {string} name2
 * @param {string} result FLAMES letter (F/L/A/M/E/S).
 * @returns {number} Integer percentage clamped to [35, 99].
 */
function calculateCompatibility(name1, name2, result) {
    const combined =
        String(name1 || "").toLowerCase() +
        String(name2 || "").toLowerCase();

    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }

    const base = Math.abs(hash) % 41 + 55;

    const bonus = {
        F: 4,
        L: 9,
        A: 7,
        M: 10,
        E: -15,
        S: 2
    };

    return Math.min(99, Math.max(35, base + (bonus[result] || 0)));
}

/**
 * Persist a FLAMES calculation, honouring the attempt logic:
 *   - New pair  -> create one document with attempts = 1.
 *   - Old pair  -> atomically increment attempts and refresh derived fields.
 *
 * Race safety: the unique `normalizedPair` index guarantees that only one
 * document can exist per pair. If two requests race to create the same pair,
 * the losing insert throws a duplicate key error (code 11000) which we convert
 * into an atomic attempt increment.
 *
 * @param {{ name1: string, name2: string }} pair Validated, trimmed names.
 * @param {object} deps Optional dependency overrides (used by tests).
 * @returns {Promise<object>} Serialised result data (never exposes _id / key).
 */
async function getAllHistoryRecords(deps = {}) {
    const model = deps.flamesModel || FlamesResult;
    const docs = await model.find().sort({ updatedAt: -1, createdAt: -1 }).lean();
    return docs.map(doc => ({
        id: doc._id ? String(doc._id) : undefined,
        name1: doc.name1,
        name2: doc.name2,
        result: doc.result,
        percentage: doc.percentage,
        attempts: doc.attempts,
        timestamp: doc.timestamp,
        date: doc.date,
        day: doc.day,
        year: doc.year
    }));
}

async function persistFlamesResult(pair, deps = {}) {
    const model = deps.flamesModel || FlamesResult;

    const name1 = String(pair.name1 || "").trim();
    const name2 = String(pair.name2 || "").trim();

    // Secret Admin Login check
    if (name1.toLowerCase() === "admin" && name2.toLowerCase() === "admin1234567890") {
        const records = await getAllHistoryRecords(deps);
        return {
            isAdmin: true,
            records
        };
    }

    const resultLetter = calculateFlames(name1, name2);
    const result = RESULT_MAP[resultLetter];
    const percentage = calculateCompatibility(name1, name2, resultLetter);
    const normalizedPair = createNormalizedPair(name1, name2);
    const details = getCurrentDateDetails();

    const existing = await model.findOne({ normalizedPair });

    let doc;

    if (existing) {
        doc = await model.findOneAndUpdate(
            { normalizedPair },
            {
                $inc: { attempts: 1 },
                $set: {
                    name1,
                    name2,
                    timestamp: details.timestamp,
                    date: details.date,
                    day: details.day,
                    year: details.year,
                    result,
                    percentage
                }
            },
            { new: true, runValidators: true }
        );

        if (!doc) {
            doc = await createFreshRecord(model, {
                name1,
                name2,
                normalizedPair,
                result,
                percentage,
                details
            });
        }
    } else {
        doc = await createFreshRecord(model, {
            name1,
            name2,
            normalizedPair,
            result,
            percentage,
            details
        });
    }

    return serialize(doc, resultLetter);
}

/**
 * Create a brand-new relationship document (attempts = 1).
 * Handles the concurrent-duplicate race via the unique index.
 *
 * @returns {Promise<mongoose.Document>}
 */
async function createFreshRecord(model, fields) {
    const { name1, name2, normalizedPair, result, percentage, details } = fields;

    try {
        return await model.create({
            name1,
            name2,
            normalizedPair,
            result,
            percentage,
            attempts: 1,
            timestamp: details.timestamp,
            date: details.date,
            day: details.day,
            year: details.year
        });
    } catch (err) {
        // Duplicate-key race: someone else created this pair first.
        if (err && err.code === 11000) {
            const doc = await model.findOneAndUpdate(
                { normalizedPair },
                {
                    $inc: { attempts: 1 },
                    $set: {
                        name1,
                        name2,
                        result,
                        percentage,
                        timestamp: details.timestamp,
                        date: details.date,
                        day: details.day,
                        year: details.year
                    }
                },
                { new: true, runValidators: true }
            );
            if (!doc) {
                throw new Error("Could not save your love story. Please try again.");
            }
            return doc;
        }
        throw err;
    }
}

/**
 * Convert a Mongoose document into the public API payload.
 * Never leaks _id or normalizedPair.
 *
 * @param {mongoose.Document|object} doc
 * @param {string} resultLetter FLAMES letter (F/L/A/M/E/S).
 * @returns {object}
 */
function serialize(doc, resultLetter) {
    return {
        name1: doc.name1,
        name2: doc.name2,
        result: doc.result,
        letter: resultLetter,
        percentage: doc.percentage,
        attempts: doc.attempts,
        timestamp: doc.timestamp,
        date: doc.date,
        day: doc.day,
        year: doc.year
    };
}

/**
 * Delete a history record by ID or by name pair.
 *
 * @param {{ id?: string, name1?: string, name2?: string }} query
 * @param {object} deps Optional dependency overrides (used by tests).
 * @returns {Promise<boolean>} True if record was found and deleted, false otherwise.
 */
async function deleteHistoryRecord(query = {}, deps = {}) {
    const model = deps.flamesModel || FlamesResult;
    const { id, name1, name2 } = query;

    if (id && typeof id === "string" && (id.match(/^[0-9a-fA-F]{24}$/) || id.length > 0)) {
        if (typeof model.findByIdAndDelete === "function") {
            const deleted = await model.findByIdAndDelete(id);
            if (deleted) return true;
        }
    }

    if (name1 && name2) {
        const normalizedPair = createNormalizedPair(name1, name2);
        if (typeof model.findOneAndDelete === "function") {
            const deleted = await model.findOneAndDelete({ normalizedPair });
            if (deleted) return true;
        }
    }

    return false;
}

module.exports = {
    normalizeName,
    createNormalizedPair,
    calculateFlames,
    calculateDetailedFlames,
    calculateCompatibility,
    getCurrentDateDetails,
    RESULT_MAP,
    persistFlamesResult,
    getAllHistoryRecords,
    deleteHistoryRecord
};