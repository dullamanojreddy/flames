/**
 * analytics.routes.js
 * Express routes for administrative visitor & security analytics.
 */

const express = require("express");
const {
    getOverviewController,
    getVisitorsController,
    getVisitorTimelineController,
    getSecurityEventsController,
    purgeDataController,
    telemetryPingController
} = require("../controllers/analytics.controller");
const { requireAdminAuth } = require("../middleware/admin-auth.middleware");
const { createAdminRateLimiter, createGeneralRateLimiter } = require("../middleware/rate.limiter");

const router = express.Router();

// Public telemetry ping (lightweight page view notification)
router.post("/ping", createGeneralRateLimiter(), telemetryPingController);

// All dashboard analytics endpoints require valid Admin authentication
router.get("/overview", requireAdminAuth, createAdminRateLimiter(), getOverviewController);
router.get("/visitors", requireAdminAuth, createAdminRateLimiter(), getVisitorsController);
router.get("/visitors/:visitorId", requireAdminAuth, createAdminRateLimiter(), getVisitorTimelineController);
router.get("/security", requireAdminAuth, createAdminRateLimiter(), getSecurityEventsController);
router.post("/cleanup", requireAdminAuth, createAdminRateLimiter(), purgeDataController);

module.exports = router;
