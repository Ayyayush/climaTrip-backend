const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const hpp = require("hpp");
const morgan = require("morgan");
const mongoose = require("mongoose");

dotenv.config();

const { env, validateEnv } = require("./config/env");
validateEnv();

const connectDB = require("./config/db");
const logger = require("./utils/logger");
const sanitizeInput = require("./middleware/sanitize");
const { generalLimiter } = require("./middleware/rateLimiter");
const {
    notFoundHandler,
    errorHandler,
} = require("./middleware/errorHandler");
const { register, metricsMiddleware } = require("./config/metrics");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const travelRoutes = require("./routes/travelRoutes");

// IMPORTANT:
// Uncomment ONLY if src/routes/chatRoutes.js actually exists.
// const chatRoutes = require("./routes/chatRoutes");

const app = express();

// Behind reverse proxy / Nginx / load balancer
app.set("trust proxy", 1);

// ============================
// Security & Performance
// ============================
app.use(helmet());
app.use(compression());
app.use(hpp());

// ============================
// CORS
// ============================
const corsOptions =
    env.isProduction || env.corsOrigins.length > 0
        ? {
              origin: (origin, callback) => {
                  if (!origin || env.corsOrigins.includes(origin)) {
                      return callback(null, true);
                  }

                  return callback(new Error("Not allowed by CORS"));
              },
              credentials: true,
              methods: [
                  "GET",
                  "POST",
                  "PUT",
                  "PATCH",
                  "DELETE",
                  "OPTIONS",
              ],
              allowedHeaders: [
                  "Origin",
                  "X-Requested-With",
                  "Content-Type",
                  "Accept",
                  "Authorization",
              ],
          }
        : {
              origin: true,
              credentials: true,
              methods: [
                  "GET",
                  "POST",
                  "PUT",
                  "PATCH",
                  "DELETE",
                  "OPTIONS",
              ],
              allowedHeaders: [
                  "Origin",
                  "X-Requested-With",
                  "Content-Type",
                  "Accept",
                  "Authorization",
              ],
          };

app.use(cors(corsOptions));

// ============================
// Body Parsing
// ============================
app.use(express.json({ limit: "1mb" }));
app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb",
    })
);

// Input sanitization
app.use(sanitizeInput);

// ============================
// Logging
// ============================
app.use(
    morgan(env.isProduction ? "combined" : "dev", {
        stream: {
            write: (message) => logger.info(message.trim()),
        },
    })
);

// ============================
// Rate Limiting & Metrics
// ============================
app.use(generalLimiter);
app.use(metricsMiddleware);

// ============================
// Database
// ============================
connectDB();

// ============================
// Health Endpoints
// ============================
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "BeachTravel Backend Running",
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        status: "ok",
    });
});

app.get("/health/live", (req, res) => {
    res.status(200).json({
        success: true,
        status: "alive",
    });
});

app.get("/health/ready", (req, res) => {
    const isDbReady = mongoose.connection.readyState === 1;

    if (!isDbReady) {
        return res.status(503).json({
            success: false,
            status: "not_ready",
            db: "disconnected",
        });
    }

    return res.status(200).json({
        success: true,
        status: "ready",
        db: "connected",
    });
});

// ============================
// Prometheus Metrics
// ============================
app.get("/metrics", async (req, res, next) => {
    try {
        res.set("Content-Type", register.contentType);
        return res.end(await register.metrics());
    } catch (error) {
        return next(error);
    }
});

// ============================
// API Routes
// ============================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", travelRoutes);

// IMPORTANT:
// If chatRoutes.js is a separate router, use:
// app.use("/api/chat", chatRoutes);
//
// If POST /api/chat is already defined inside travelRoutes,
// DO NOT mount another chat router.

// ============================
// 404 & Centralized Error Handler
// ============================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================
// Start Server
// ============================
let server;

if (env.nodeEnv !== "test") {
    server = app.listen(env.port, () => {
        logger.info(
            `Server running on port ${env.port} [${env.nodeEnv}]`
        );
    });
}

// ============================
// Graceful Shutdown
// ============================
const shutdown = async (signal) => {
    logger.info(
        `${signal} received. Shutting down gracefully...`
    );

    const forceShutdownTimer = setTimeout(() => {
        logger.error("Forcing shutdown after timeout.");
        process.exit(1);
    }, 10000);

    forceShutdownTimer.unref();

    try {
        // Stop accepting new HTTP requests
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        return reject(error);
                    }

                    logger.info("HTTP server closed.");
                    return resolve();
                });
            });
        }

        // Close external connections
        const responseCache = require("./ai/cache/responseCache");

        await Promise.all([
            mongoose.connection.readyState !== 0
                ? mongoose.connection.close(false)
                : Promise.resolve(),
            typeof responseCache.close === "function"
                ? responseCache.close()
                : Promise.resolve(),
        ]);

        logger.info("MongoDB and cache connections closed.");

        clearTimeout(forceShutdownTimer);
        process.exit(0);
    } catch (error) {
        logger.error("Error during shutdown", {
            error: error.message,
            stack: error.stack,
        });

        clearTimeout(forceShutdownTimer);
        process.exit(1);
    }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ============================
// Process-Level Error Handling
// ============================
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection", {
        reason: reason?.message || reason,
    });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
    });

    process.exit(1);
});

module.exports = app;