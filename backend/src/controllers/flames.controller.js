/**
 * flames.controller.js
 * Controller: read body/params -> call service -> shape response -> next on error.
 * Includes non-blocking visitor telemetry and secured history management.
 */

const { persistFlamesResult, getAllHistoryRecords, deleteHistoryRecord } = require("../services/flames.service");
const { recordCalculationTelemetry } = require("../services/visitor.service");
const { getClientIp } = require("../utils/ip.utils");
const { createAdminSessionToken, verifyAdminSessionToken } = require("../services/admin-auth.service");
const { emitSecurityEvent } = require("../services/security-event.service");
const securityConfig = require("../config/security.config");

/**
 * Handle POST /api/flames/calculate
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
async function calculateFlamesController(req, res, next) {
    try {
        const { name1, name2 } = req.body;

        const result = await persistFlamesResult({ name1, name2 });

        // Secret Admin Login trigger (preserves existing backdoor and upgrades it with secure session)
        if (result && result.isAdmin) {
            const { token, expiresAt } = createAdminSessionToken();

            if (res.cookie) {
                res.cookie(securityConfig.cookie.adminCookieName, token, {
                    httpOnly: true,
                    secure: securityConfig.cookie.secure,
                    sameSite: securityConfig.cookie.sameSite,
                    maxAge: securityConfig.admin.sessionDurationMs,
                    path: "/"
                });
            }

            emitSecurityEvent({
                eventType: "ADMIN_LOGIN_SUCCESS",
                severity: "INFO",
                visitorId: req.visitorId || "",
                sessionId: req.sessionId || "",
                ip: getClientIp(req),
                route: req.originalUrl,
                method: "POST",
                requestId: req.requestId,
                metadata: { trigger: "flames_secret_names" }
            });

            return res.status(200).json({
                success: true,
                isAdmin: true,
                token,
                expiresAt,
                records: result.records,
                requestId: req.requestId
            });
        }

        // Fire-and-forget telemetry: completely non-blocking
        recordCalculationTelemetry({
            visitorId: req.visitorId,
            sessionId: req.sessionId,
            ip: getClientIp(req),
            result: result.result,
            percentage: result.percentage,
            attempts: result.attempts,
            name1,
            name2
        });

        return res.status(200).json({
            success: true,
            data: result,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle GET /api/flames/records
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
async function getRecordsController(req, res, next) {
    try {
        const token =
            req.cookies?.[securityConfig.cookie.adminCookieName] ||
            (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null) ||
            req.headers["x-admin-token"];

        if (token) {
            const verification = verifyAdminSessionToken(token);
            if (verification.valid) {
                req.isAdmin = true;
            }
        }

        const records = await getAllHistoryRecords();
        return res.status(200).json({
            success: true,
            records,
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Handle DELETE /api/flames/records and /api/flames/records/:id
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
async function deleteRecordController(req, res, next) {
    try {
        const id = req.params.id || req.query.id || req.body?.id;
        const name1 = req.query.name1 || req.body?.name1;
        const name2 = req.query.name2 || req.body?.name2;

        if (!id && (!name1 || !name2)) {
            return res.status(400).json({
                success: false,
                message: "Missing id or name pair to delete",
                requestId: req.requestId
            });
        }

        const token =
            req.cookies?.[securityConfig.cookie.adminCookieName] ||
            (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null) ||
            req.headers["x-admin-token"];

        if (token) {
            const verification = verifyAdminSessionToken(token);
            if (verification.valid) {
                req.isAdmin = true;
                emitSecurityEvent({
                    eventType: "ADMIN_ACTION",
                    severity: "INFO",
                    visitorId: req.visitorId || "",
                    sessionId: req.sessionId || "",
                    ip: getClientIp(req),
                    route: req.originalUrl,
                    method: "DELETE",
                    requestId: req.requestId,
                    metadata: { action: "delete_record", id, name1, name2 }
                });
            }
        }

        const deleted = await deleteHistoryRecord({ id, name1, name2 });
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Record not found or already deleted",
                requestId: req.requestId
            });
        }

        return res.status(200).json({
            success: true,
            message: "Record deleted successfully",
            requestId: req.requestId
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    calculateFlamesController,
    getRecordsController,
    deleteRecordController
};