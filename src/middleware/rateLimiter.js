const rateLimit = require("express-rate-limit");

const jsonHandler = (message) => (req, res /* , next, options */) => {
    res.status(429).json({ success: false, message });
};

// Generic API-wide limiter — a safety net, not the primary control.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many requests. Please try again later."),
});

// Tight limiter for login/register — brute-force / credential-stuffing defense.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many authentication attempts. Please try again in a few minutes."),
});

// AI endpoints hit a paid upstream (Groq) — must be the strictest limiter.
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("Too many AI requests. Please slow down and try again shortly."),
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
