const mongoose = require("mongoose");
const { env } = require("./env");
const logger = require("../utils/logger");

const connectDB = async () => {
    try {
        mongoose.connection.on("error", (err) => {
            logger.error("MongoDB connection error", { error: err.message });
        });
        mongoose.connection.on("disconnected", () => {
            logger.warn("MongoDB disconnected");
        });

        await mongoose.connect(env.mongoUri);

        logger.info("MongoDB Connected");
    } catch (error) {
        logger.error("MongoDB Connection Error", { error: error.message });
        process.exit(1);
    }
};

module.exports = connectDB;
