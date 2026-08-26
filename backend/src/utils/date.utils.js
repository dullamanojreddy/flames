/**
 * date.utils.js
 * Builds the human-friendly date fields (date, day, year) from a Date instance.
 *
 * The stored `timestamp` is always the raw Date (UTC internally), while the
 * `date` / `day` / `year` display fields are rendered in a configured
 * timezone (default: UTC). This keeps the stored value unambiguous and the
 * display timezone configurable through the TIMEZONE environment variable.
 */

const DEFAULT_TIMEZONE = "UTC";

/**
 * Resolve the timezone to use. Reads TIMEZONE from the environment.
 * Falls back to UTC when invalid/unset (Intl.DateTimeFormat throws RangeError
 * on unknown zone names).
 *
 * @returns {string} A valid IANA timezone name.
 */
function resolveTimezone() {
    const configured = (process.env.TIMEZONE || "").trim();
    if (!configured) return DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: configured });
        return configured;
    } catch (err) {
        return DEFAULT_TIMEZONE;
    }
}

/**
 * Extract a single part out of an Intl.DateTimeFormat result.
 *
 * @param {Intl.DateTimeFormat} formatter
 * @param {Date} date
 * @param {string} desiredType e.g. "day", "month", "year", "weekday"
 * @returns {string}
 */
function extractPart(formatter, date, desiredType) {
    const parts = formatter.formatToParts(date);
    const match = parts.find(part => part.type === desiredType);
    return match ? match.value : "";
}

/**
 * Get the current timestamp together with formatted date/day/year fields.
 *
 * @param {Date} [now=new Date()] Date to describe (defaults to "now").
 * @param {string} [timezone]   Override timezone (defaults to env/UTC).
 * @returns {{ timestamp: Date, date: string, day: string, year: number }}
 */
function getCurrentDateDetails(now = new Date(), timezone = resolveTimezone()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    const day = extractPart(formatter, now, "day") || String(now.getDate()).padStart(2, "0");
    const month = extractPart(formatter, now, "month") || String(now.getMonth() + 1).padStart(2, "0");
    const yearValue =
        extractPart(formatter, now, "year") || String(now.getFullYear());
    const weekday = extractPart(formatter, now, "weekday") || "";

    return {
        timestamp: now,
        date: `${day}-${month}-${yearValue}`,
        day: weekday,
        year: Number(yearValue)
    };
}

module.exports = {
    resolveTimezone,
    getCurrentDateDetails
};