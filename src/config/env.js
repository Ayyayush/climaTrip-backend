const REQUIRED_VARS = ["MONGO_URI", "JWT_SECRET", "GROQ_API_KEY"];

/**
 * Validates required environment variables at boot time so the process
 * fails fast with a clear message instead of failing deep inside a request.
 */
function validateEnv() {
    const missing = REQUIRED_VARS.filter((key) => !process.env[key] || !process.env[key].trim());

    if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
            `❌ Missing required environment variable(s): ${missing.join(", ")}. ` +
                "Check your .env file against .env.example."
        );
        process.exit(1);
    }

    if (process.env.JWT_SECRET.length < 16) {
        // eslint-disable-next-line no-console
        console.warn(
            "⚠️  JWT_SECRET is shorter than 16 characters. Use a long, random value in production."
        );
    }
}

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    port: parseInt(process.env.PORT, 10) || 3001,

    mongoUri: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    groqTimeoutMs: parseInt(process.env.GROQ_TIMEOUT_MS, 10) || 20000,

    // Comma separated list of allowed origins, e.g. "https://app.example.com,https://admin.example.com"
    corsOrigins: (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),

    logLevel: process.env.LOG_LEVEL || "info",

    redisUrl: process.env.REDIS_URL || "",
};

module.exports = { env, validateEnv };
