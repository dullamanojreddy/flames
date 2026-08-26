const { createApp } = require("../src/app");
const { connectDatabase } = require("../src/config/database");

const app = createApp();

module.exports = async (req, res) => {
    try {
        if (process.env.MONGODB_URI) {
            await connectDatabase();
        }
    } catch (err) {
        console.error("Vercel DB connection error:", err.message);
    }
    return app(req, res);
};
