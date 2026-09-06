/**
 * visitor.service.js
 * High-performance, non-blocking visitor and session tracking service.
 * Implements strict failure isolation — database or network errors in this service
 * will NEVER break or delay the core FLAMES application.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const Visitor = require("../models/visitor.model");
const Session = require("../models/session.model");
const { parseUserAgent } = require("../utils/device.utils");
const { emitSecurityEvent } = require("./security-event.service");
const securityConfig = require("../config/security.config");

/**
 * Generate an anonymous random visitor identifier (e.g. V-72f91c8a4b3d).
 * Contains no PII, no IP, no timestamp.
 *
 * @returns {string}
 */
function generateVisitorId() {
    return `V-${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Generate an anonymous random session identifier (e.g. S-91ab22409f).
 *
 * @returns {string}
 */
function generateSessionId() {
    return `S-${crypto.randomBytes(10).toString("hex")}`;
}

/**
 * Validate format of visitor ID.
 *
 * @param {string} vid
 * @returns {boolean}
 */
function isValidVisitorId(vid) {
    return typeof vid === "string" && /^V-[a-f0-9]{16,64}$/i.test(vid.trim());
}

/**
 * Validate format of session ID.
 *
 * @param {string} sid
 * @returns {boolean}
 */
function isValidSessionId(sid) {
    return typeof sid === "string" && /^S-[a-f0-9]{16,64}$/i.test(sid.trim());
}

/**
 * Synchronize visitor and session lifecycle asynchronously.
 *
 * @param {object} params
 * @param {string} [params.incomingVisitorId]
 * @param {string} [params.incomingSessionId]
 * @param {string} params.ip
 * @param {string} params.userAgent
 * @param {string} [params.route]
 * @param {string} [params.method]
 * @returns {Promise<{ visitorId: string, sessionId: string, isNewVisitor: boolean, isNewSession: boolean }>}
 */
async function syncVisitorSession(params) {
    if (!securityConfig.visitorTrackingEnabled) {
        return {
            visitorId: params.incomingVisitorId || generateVisitorId(),
            sessionId: params.incomingSessionId || generateSessionId(),
            isNewVisitor: false,
            isNewSession: false
        };
    }

    let visitorId = isValidVisitorId(params.incomingVisitorId) ? params.incomingVisitorId.trim() : null;
    let sessionId = isValidSessionId(params.incomingSessionId) ? params.incomingSessionId.trim() : null;

    let isNewVisitor = false;
    let isNewSession = false;

    if (!visitorId) {
        visitorId = generateVisitorId();
        isNewVisitor = true;
    }

    if (!sessionId) {
        sessionId = generateSessionId();
        isNewSession = true;
    }

    // If database is not connected, return immediately with IDs
    if (mongoose.connection.readyState !== 1) {
        return { visitorId, sessionId, isNewVisitor, isNewSession };
    }

    // Non-blocking background database sync
    setImmediate(async () => {
        try {
            const uaInfo = parseUserAgent(params.userAgent);
            const now = new Date();

            // 1. Sync Visitor
            let visitor = await Visitor.findOne({ visitorId });
            if (!visitor) {
                isNewVisitor = true;
                await Visitor.create({
                    visitorId,
                    firstSeenAt: now,
                    lastSeenAt: now,
                    totalSessions: 1,
                    totalPageViews: 0,
                    totalCalculations: 0,
                    firstIp: params.ip,
                    lastIp: params.ip,
                    devices: [uaInfo.device],
                    browsers: [uaInfo.browser],
                    operatingSystems: [uaInfo.os]
                });

                emitSecurityEvent({
                    eventType: "VISITOR_CREATED",
                    severity: "INFO",
                    visitorId,
                    sessionId,
                    ip: params.ip,
                    route: params.route,
                    method: params.method,
                    metadata: { device: uaInfo.device, browser: uaInfo.browser, os: uaInfo.os }
                });
            } else {
                const updateOps = {
                    $set: { lastSeenAt: now, lastIp: params.ip },
                    $addToSet: {
                        devices: uaInfo.device,
                        browsers: uaInfo.browser,
                        operatingSystems: uaInfo.os
                    }
                };
                if (isNewSession) {
                    updateOps.$inc = { totalSessions: 1 };
                }
                await Visitor.updateOne({ visitorId }, updateOps);
            }

            // 2. Sync Session
            let session = await Session.findOne({ sessionId });
            if (!session) {
                isNewSession = true;
                const expiresAt = new Date(Date.now() + securityConfig.ipRetentionDays * 24 * 60 * 60 * 1000);
                await Session.create({
                    sessionId,
                    visitorId,
                    startedAt: now,
                    lastActivityAt: now,
                    requestCount: 1,
                    pageViewCount: 0,
                    calculationCount: 0,
                    ip: params.ip,
                    userAgent: (params.userAgent || "").slice(0, 255),
                    device: uaInfo.device,
                    browser: uaInfo.browser,
                    os: uaInfo.os,
                    expiresAt
                });

                emitSecurityEvent({
                    eventType: "SESSION_CREATED",
                    severity: "INFO",
                    visitorId,
                    sessionId,
                    ip: params.ip,
                    route: params.route,
                    method: params.method
                });
            } else {
                await Session.updateOne(
                    { sessionId },
                    {
                        $set: { lastActivityAt: now, ip: params.ip },
                        $inc: { requestCount: 1 }
                    }
                );
            }
        } catch (err) {
            // Failure isolation
        }
    });

    return { visitorId, sessionId, isNewVisitor, isNewSession };
}

/**
 * Record a page view event.
 *
 * @param {object} params
 * @param {string} params.visitorId
 * @param {string} params.sessionId
 * @param {string} params.route
 * @param {string} params.ip
 * @param {string} [params.userAgent]
 */
async function recordPageView(params) {
    if (!securityConfig.visitorTrackingEnabled) return;

    if (mongoose.connection.readyState === 1) {
        setImmediate(async () => {
            try {
                if (params.sessionId) {
                    await Session.updateOne(
                        { sessionId: params.sessionId },
                        { $inc: { pageViewCount: 1, requestCount: 1 }, $set: { lastActivityAt: new Date() } }
                    );
                }
                if (params.visitorId) {
                    await Visitor.updateOne(
                        { visitorId: params.visitorId },
                        { $inc: { totalPageViews: 1 }, $set: { lastSeenAt: new Date() } }
                    );
                }
                emitSecurityEvent({
                    eventType: "PAGE_VIEW",
                    severity: "INFO",
                    visitorId: params.visitorId,
                    sessionId: params.sessionId,
                    ip: params.ip,
                    route: params.route,
                    method: "GET"
                });
            } catch (err) {
                // Failure isolation
            }
        });
    }
}

/**
 * Record a successful FLAMES calculation telemetry event.
 * Non-blocking: will never impede the user's calculation result.
 *
 * @param {object} params
 * @param {string} params.visitorId
 * @param {string} params.sessionId
 * @param {string} params.ip
 * @param {string} params.result
 * @param {number} params.percentage
 * @param {number} params.attempts
 */
async function recordCalculationTelemetry(params) {
    if (!securityConfig.visitorTrackingEnabled) return;

    if (mongoose.connection.readyState === 1) {
        setImmediate(async () => {
            try {
                const now = new Date();
                if (params.sessionId) {
                    await Session.updateOne(
                        { sessionId: params.sessionId },
                        { $inc: { calculationCount: 1, requestCount: 1 }, $set: { lastActivityAt: now } }
                    );
                }
                if (params.visitorId) {
                    await Visitor.updateOne(
                        { visitorId: params.visitorId },
                        { $inc: { totalCalculations: 1 }, $set: { lastSeenAt: now } }
                    );
                }

                const metadata = {
                    result: params.result,
                    percentage: params.percentage,
                    attempts: params.attempts
                };

                // Privacy check: only store names if FLAMES_INPUT_LOGGING_ENABLED=true
                if (securityConfig.flamesInputLoggingEnabled && params.name1 && params.name2) {
                    metadata.name1 = params.name1;
                    metadata.name2 = params.name2;
                }

                emitSecurityEvent({
                    eventType: "FLAMES_CALCULATED",
                    severity: "INFO",
                    visitorId: params.visitorId,
                    sessionId: params.sessionId,
                    ip: params.ip,
                    route: "/api/flames/calculate",
                    method: "POST",
                    metadata
                });
            } catch (err) {
                // Failure isolation
            }
        });
    }
}

module.exports = {
    generateVisitorId,
    generateSessionId,
    isValidVisitorId,
    isValidSessionId,
    syncVisitorSession,
    recordPageView,
    recordCalculationTelemetry
};
