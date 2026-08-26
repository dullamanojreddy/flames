/** flames.routes.js
 * Route definitions mounted under /api/flames.
 */

const express = require("express");
const { calculateFlamesController, getRecordsController } = require("../controllers/flames.controller");
const { validateNames } = require("../middleware/validation.middleware");
const { createFlamesRateLimiter } = require("../middleware/rate.limiter");

const router = express.Router();

// Rate-limit the calculation endpoint to protect the database from abuse.
router.post(
    "/calculate",
    createFlamesRateLimiter(),
    validateNames,
    calculateFlamesController
);

// Admin history endpoints
router.get("/records", getRecordsController);
router.get("/history", getRecordsController);

module.exports = router;