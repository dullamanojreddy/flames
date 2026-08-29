/**
 * flames.controller.js
 * Controller: read body/params -> call service -> shape response -> next on error.
 */

const { persistFlamesResult, getAllHistoryRecords, deleteHistoryRecord } = require("../services/flames.service");

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
                message: "Missing id or name pair to delete"
            });
        }

        const deleted = await deleteHistoryRecord({ id, name1, name2 });
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Record not found or already deleted"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Record deleted successfully"
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