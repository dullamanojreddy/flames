/**
 * validation.middleware.js
 * Request-body validation for POST /api/flames/calculate.
 *
 * Enforces:
 *   - JSON body with string fields
 *   - non-empty names after trimming
 *   - maximum 50 characters per name
 *   - no obvious control characters / malformed content
 */

const MAX_NAME_LENGTH = 50;

// Control characters we never want inside a name (C0 + DEL).
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Validate the request body and attach sanitised names to req.body.
 * Rejects with a 400 error (thrown) when validation fails.
 */
function validateNames(req, res, next) {
    const { name1, name2 } = req.body || {};

    const errors = [];

    if (typeof name1 !== "string" || typeof name2 !== "string") {
        errors.push("Both names are required");
        return next(createError(errors));
    }

    const trimmedName1 = name1.trim();
    const trimmedName2 = name2.trim();

    if (!trimmedName1 || !trimmedName2) {
        errors.push("Both names are required");
    }
    if (trimmedName1.length > MAX_NAME_LENGTH) {
        errors.push(`name1 cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
    if (trimmedName2.length > MAX_NAME_LENGTH) {
        errors.push(`name2 cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
    if (
        CONTROL_CHAR_PATTERN.test(name1) ||
        CONTROL_CHAR_PATTERN.test(name2)
    ) {
        errors.push("Names contain unsupported control characters");
    }

    if (errors.length > 0) {
        return next(createError(errors));
    }

    // Trimmed names are handed to the service layer.
    req.body.name1 = trimmedName1;
    req.body.name2 = trimmedName2;

    return next();
}

/** Build a 400 ApiError with one or more messages. */
function createError(messages) {
    const err = new Error(messages.join(" / "));
    err.statusCode = 400;
    return err;
}

module.exports = {
    validateNames,
    MAX_NAME_LENGTH
};