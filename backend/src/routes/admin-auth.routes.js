/**
 * admin-auth.routes.js
 * Express routes for administrator authentication.
 */

const express = require("express");
const {
    adminLoginController,
    adminVerifyController,
    adminLogoutController
} = require("../controllers/admin-auth.controller");
const { createAuthRateLimiter } = require("../middleware/rate.limiter");

const router = express.Router();

// Strict rate-limiting on login attempts
router.post("/login", createAuthRateLimiter(), adminLoginController);
router.get("/verify", adminVerifyController);
router.post("/logout", adminLogoutController);

module.exports = router;
