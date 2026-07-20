const client = require("prom-client");

// Prometheus-ready metrics endpoint (Part 19). Collects default Node.js
// process metrics plus a basic HTTP request duration histogram.
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

const metricsMiddleware = (req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on("finish", () => {
        end({
            method: req.method,
            route: req.route?.path || req.originalUrl.split("?")[0],
            status_code: res.statusCode,
        });
    });
    next();
};

module.exports = { register, metricsMiddleware };
