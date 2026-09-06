/**
 * analytics.service.js
 * High-efficiency analytics aggregation and query service for the Admin Console.
 * Enforces strict query whitelisting, pagination caps, and prevents arbitrary Mongo injections.
 * Features built-in failure isolation when database is not connected.
 */

const mongoose = require("mongoose");
const Visitor = require("../models/visitor.model");
const Session = require("../models/session.model");
const SecurityEvent = require("../models/security-event.model");
const FlamesResult = require("../models/flames.model");
const securityConfig = require("../config/security.config");

const MAX_PAGE_SIZE = 100;

/**
 * Get high-level security and visitor overview metrics for the Admin Dashboard.
 *
 * @returns {Promise<object>}
 */
let overviewCache = null;
let overviewCacheTime = 0;
const OVERVIEW_CACHE_TTL_MS = 2500;

async function getAnalyticsOverview(deps = {}) {
    const now = new Date();

    if (mongoose.connection.readyState !== 1 && !deps.bypassDbCheck) {
        return {
            activeVisitors: 0,
            todayVisitors: 0,
            todaySessions: 0,
            totalVisitors: 0,
            totalCalculations: 0,
            activeWindowSeconds: securityConfig.activeVisitorWindowSeconds,
            securityAlerts: {
                rateLimitEvents: 0,
                suspiciousEvents: 0,
                failedAdminLogins: 0
            },
            timestamp: now.toISOString()
        };
    }

    if (!deps.bypassCache && overviewCache && (Date.now() - overviewCacheTime < OVERVIEW_CACHE_TTL_MS)) {
        return overviewCache;
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeThreshold = new Date(Date.now() - securityConfig.activeVisitorWindowSeconds * 1000);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
        activeSessionsCount,
        todayVisitorsCount,
        todaySessionsCount,
        totalVisitorsCount,
        totalCalculationsDoc,
        rateLimitEventsCount,
        suspiciousEventsCount,
        failedAdminLoginsCount
    ] = await Promise.all([
        // Active sessions within the active window
        Session.countDocuments({ lastActivityAt: { $gte: activeThreshold } }).catch(() => 0),
        // Today's active visitors
        Visitor.countDocuments({ lastSeenAt: { $gte: startOfToday } }).catch(() => 0),
        // Today's sessions
        Session.countDocuments({ startedAt: { $gte: startOfToday } }).catch(() => 0),
        // Total unique visitors tracked
        Visitor.countDocuments().catch(() => 0),
        // Total calculations in database
        FlamesResult.countDocuments().catch(() => 0),
        // Rate limit hits in last 24h
        SecurityEvent.countDocuments({ eventType: "RATE_LIMIT_TRIGGERED", timestamp: { $gte: last24h } }).catch(() => 0),
        // Suspicious / abuse events in last 24h
        SecurityEvent.countDocuments({
            eventType: { $in: ["SUSPICIOUS_REQUEST", "ABUSE_DETECTED"] },
            timestamp: { $gte: last24h }
        }).catch(() => 0),
        // Failed admin logins in last 24h
        SecurityEvent.countDocuments({ eventType: "ADMIN_LOGIN_FAILURE", timestamp: { $gte: last24h } }).catch(() => 0)
    ]);

    const result = {
        activeVisitors: activeSessionsCount,
        todayVisitors: todayVisitorsCount,
        todaySessions: todaySessionsCount,
        totalVisitors: totalVisitorsCount,
        totalCalculations: totalCalculationsDoc,
        activeWindowSeconds: securityConfig.activeVisitorWindowSeconds,
        securityAlerts: {
            rateLimitEvents: rateLimitEventsCount,
            suspiciousEvents: suspiciousEventsCount,
            failedAdminLogins: failedAdminLoginsCount
        },
        timestamp: now.toISOString()
    };

    if (!deps.bypassCache) {
        overviewCache = result;
        overviewCacheTime = Date.now();
    }

    return result;
}

/**
 * Fetch paginated list of visitors.
 *
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=25]
 * @param {string} [params.search=""]
 * @returns {Promise<object>}
 */
async function getVisitorsList(params = {}) {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.limit, 10) || 25));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
        return {
            page,
            limit,
            total: 0,
            totalPages: 1,
            visitors: []
        };
    }

    const query = {};
    if (params.search && typeof params.search === "string") {
        const cleanSearch = params.search.trim().slice(0, 50);
        if (cleanSearch) {
            // Safe escaped regex for search
            const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { visitorId: new RegExp(escaped, "i") },
                { lastIp: new RegExp(escaped, "i") },
                { devices: new RegExp(escaped, "i") },
                { browsers: new RegExp(escaped, "i") }
            ];
        }
    }

    const [total, visitors] = await Promise.all([
        Visitor.countDocuments(query).catch(() => 0),
        Visitor.find(query)
            .sort({ lastSeenAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .catch(() => [])
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        visitors: visitors.map(v => ({
            visitorId: v.visitorId,
            firstSeenAt: v.firstSeenAt,
            lastSeenAt: v.lastSeenAt,
            totalSessions: v.totalSessions || 1,
            totalPageViews: v.totalPageViews || 0,
            totalCalculations: v.totalCalculations || 0,
            devices: v.devices || [],
            browsers: v.browsers || [],
            operatingSystems: v.operatingSystems || [],
            lastIp: v.lastIp || "N/A"
        }))
    };
}

/**
 * Fetch detailed timeline and history for a specific visitor.
 *
 * @param {string} visitorId
 * @returns {Promise<object|null>}
 */
async function getVisitorTimeline(visitorId) {
    if (!visitorId || typeof visitorId !== "string" || mongoose.connection.readyState !== 1) {
        return null;
    }

    const visitor = await Visitor.findOne({ visitorId: visitorId.trim() }).lean();
    if (!visitor) return null;

    // Fetch sessions for this visitor
    const sessions = await Session.find({ visitorId: visitor.visitorId })
        .sort({ startedAt: -1 })
        .limit(50)
        .lean()
        .catch(() => []);

    // Fetch security events for this visitor
    const events = await SecurityEvent.find({ visitorId: visitor.visitorId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean()
        .catch(() => []);

    // Build timeline items
    const timeline = [];

    sessions.forEach(s => {
        timeline.push({
            type: "SESSION_START",
            timestamp: s.startedAt,
            title: "Session Started",
            details: `${s.device} • ${s.browser} on ${s.os} (${s.ip || "unknown IP"})`,
            sessionId: s.sessionId
        });
        if (s.lastActivityAt && s.lastActivityAt > s.startedAt) {
            timeline.push({
                type: "SESSION_ACTIVE",
                timestamp: s.lastActivityAt,
                title: "Last Activity in Session",
                details: `${s.requestCount || 1} requests, ${s.pageViewCount || 0} page views`,
                sessionId: s.sessionId
            });
        }
    });

    events.forEach(e => {
        if (e.eventType === "FLAMES_CALCULATED") {
            timeline.push({
                type: "CALCULATION",
                timestamp: e.timestamp,
                title: "FLAMES Calculation",
                details: `Result: ${e.metadata?.result || "N/A"} (${e.metadata?.percentage || 0}%)`,
                severity: e.severity
            });
        } else if (e.eventType === "PAGE_VIEW") {
            timeline.push({
                type: "PAGE_VIEW",
                timestamp: e.timestamp,
                title: "Page Viewed",
                details: e.route || "/",
                severity: e.severity
            });
        } else {
            timeline.push({
                type: "SECURITY_EVENT",
                timestamp: e.timestamp,
                title: e.eventType,
                details: `Route: ${e.route} - Severity: ${e.severity}`,
                severity: e.severity
            });
        }
    });

    // Sort timeline descending by timestamp
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        visitor: {
            visitorId: visitor.visitorId,
            firstSeenAt: visitor.firstSeenAt,
            lastSeenAt: visitor.lastSeenAt,
            totalSessions: visitor.totalSessions,
            totalPageViews: visitor.totalPageViews,
            totalCalculations: visitor.totalCalculations,
            devices: visitor.devices,
            browsers: visitor.browsers,
            operatingSystems: visitor.operatingSystems,
            lastIp: visitor.lastIp
        },
        sessionsCount: sessions.length,
        sessions: sessions.map(s => ({
            sessionId: s.sessionId,
            startedAt: s.startedAt,
            lastActivityAt: s.lastActivityAt,
            requestCount: s.requestCount,
            pageViewCount: s.pageViewCount,
            calculationCount: s.calculationCount,
            ip: s.ip,
            device: s.device,
            browser: s.browser,
            os: s.os
        })),
        timeline: timeline.slice(0, 100)
    };
}

/**
 * Fetch paginated security events.
 *
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @param {string} [params.severity]
 * @param {string} [params.eventType]
 * @returns {Promise<object>}
 */
async function getSecurityEventsList(params = {}) {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.limit, 10) || 50));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
        return {
            page,
            limit,
            total: 0,
            totalPages: 1,
            events: []
        };
    }

    const query = {};
    if (params.severity && ["INFO", "WARNING", "HIGH", "CRITICAL"].includes(params.severity.toUpperCase())) {
        query.severity = params.severity.toUpperCase();
    }
    if (params.eventType && typeof params.eventType === "string") {
        query.eventType = params.eventType.trim();
    }

    const [total, events] = await Promise.all([
        SecurityEvent.countDocuments(query).catch(() => 0),
        SecurityEvent.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .catch(() => [])
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        events: events.map(e => ({
            eventId: e.eventId,
            eventType: e.eventType,
            severity: e.severity,
            visitorId: e.visitorId,
            sessionId: e.sessionId,
            ip: e.ip,
            route: e.route,
            method: e.method,
            timestamp: e.timestamp,
            metadata: e.metadata
        }))
    };
}

/**
 * Manual data retention cleanup trigger.
 * Purges security events older than days specified.
 *
 * @param {number} [days=90]
 * @returns {Promise<{ deletedEvents: number, deletedSessions: number }>}
 */
async function purgeOldTelemetryData(days = 90) {
    if (mongoose.connection.readyState !== 1) {
        return { deletedEvents: 0, deletedSessions: 0, cutoff: new Date().toISOString() };
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [eventRes, sessionRes] = await Promise.all([
        SecurityEvent.deleteMany({ timestamp: { $lt: cutoff } }).catch(() => ({ deletedCount: 0 })),
        Session.deleteMany({ lastActivityAt: { $lt: cutoff } }).catch(() => ({ deletedCount: 0 }))
    ]);

    return {
        deletedEvents: eventRes.deletedCount || 0,
        deletedSessions: sessionRes.deletedCount || 0,
        cutoff: cutoff.toISOString()
    };
}

module.exports = {
    getAnalyticsOverview,
    getVisitorsList,
    getVisitorTimeline,
    getSecurityEventsList,
    purgeOldTelemetryData
};
