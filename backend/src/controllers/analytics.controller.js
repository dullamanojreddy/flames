/**
 * analytics.controller.js
 * Controller for admin analytics dashboards and public telemetry pings.
 */

const {
    getAnalyticsOverview,
    getVisitorsList,
    getVisitorTimeline,
    getSecurityEventsList,
    purgeOldTelemetryData
} = require("../services/analytics.service");
const { recordPageView } = require("../services/visitor.service");
const { getClientIp } = require("../utils/ip.utils");
const securityConfig = require("../config/security.config");

/**
 * Handle GET /api/admin/analytics/overview
 */
async function getOverviewController(req, res, next) {
    try {
        const overview = await getAnalyticsOverview();
        return res.status(200).json({
            success: true,
            data: overview,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle GET /api/admin/analytics/visitors
 */
async function getVisitorsController(req, res, next) {
    try {
        const result = await getVisitorsList({
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search
        });
        return res.status(200).json({
            success: true,
            ...result,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle GET /api/admin/analytics/visitors/:visitorId
 */
async function getVisitorTimelineController(req, res, next) {
    try {
        const { visitorId } = req.params;
        const details = await getVisitorTimeline(visitorId);

        if (!details) {
            return res.status(404).json({
                success: false,
                error: { message: "Visitor not found" },
                requestId: req.requestId
            });
        }

        return res.status(200).json({
            success: true,
            data: details,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle GET /api/admin/analytics/security
 */
async function getSecurityEventsController(req, res, next) {
    try {
        const result = await getSecurityEventsList({
            page: req.query.page,
            limit: req.query.limit,
            severity: req.query.severity,
            eventType: req.query.eventType
        });
        return res.status(200).json({
            success: true,
            ...result,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle POST /api/admin/analytics/cleanup
 */
async function purgeDataController(req, res, next) {
    try {
        const days = parseInt(req.body?.days, 10) || 90;
        const result = await purgeOldTelemetryData(days);
        return res.status(200).json({
            success: true,
            message: "Telemetry retention cleanup executed",
            ...result,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle POST /api/analytics/ping (Lightweight public page view reporting)
 */
async function telemetryPingController(req, res, next) {
    try {
        if (!securityConfig.visitorTrackingEnabled) {
            return res.status(200).json({ success: true, tracking: false });
        }

        const route = String(req.body?.route || "/").slice(0, 100);
        const clientIp = getClientIp(req);

        await recordPageView({
            visitorId: req.visitorId,
            sessionId: req.sessionId,
            route,
            ip: clientIp,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            success: true,
            visitorId: req.visitorId,
            sessionId: req.sessionId
        });
    } catch (err) {
        // Ping should never fail with a 500 to the client
        return res.status(200).json({ success: false });
    }
}

module.exports = {
    getOverviewController,
    getVisitorsController,
    getVisitorTimelineController,
    getSecurityEventsController,
    purgeDataController,
    telemetryPingController
};
