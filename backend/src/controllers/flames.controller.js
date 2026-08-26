/**
 * flames.controller.js
 * Controller: read body/params -> call service -> shape response -> next on error.
 */

const { persistFlamesResult, getAllHistoryRecords } = require("../services/flames.service");

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

        if (result && result.isAdmin) {
            return res.status(200).json({
                success: true,
                isAdmin: true,
                records: result.records
            });
        }

        return res.status(200).json({
            success: true,
            data: result
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
        const records = await getAllHistoryRecords();
        return res.status(200).json({
            success: true,
            records
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    calculateFlamesController,
    getRecordsController
};