const crypto = require("crypto");
const Redis = require("ioredis");
const { env } = require("../../config/env");
const logger = require("../../utils/logger");

/**
 * TTL cache for identical AI requests (Part 10: "cache responses").
 * Uses Redis when REDIS_URL is configured (multi-instance safe — required
 * once this runs behind a load balancer per Part 14/15). Falls back to an
 * in-process Map automatically if REDIS_URL is unset or Redis is
 * unreachable, so local dev / single-instance setups still work with zero
 * extra infrastructure.
 */
const TTL_SECONDS = 10 * 60; // 10 minutes
const memoryStore = new Map();

let redisClient = null;
let redisReady = false;

if (env.redisUrl) {
    redisClient = new Redis(env.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
        lazyConnect: true,
    });

    redisClient.on("error", (err) => {
        if (redisReady) {
            logger.warn("Redis cache error, falling back to in-memory cache", { error: err.message });
        }
        redisReady = false;
    });

    redisClient.on("ready", () => {
        redisReady = true;
        logger.info("Redis cache connected");
    });

    redisClient.connect().catch((err) => {
        logger.warn("Redis unavailable at startup, using in-memory cache", { error: err.message });
    });
}

function makeKey(namespace, payload) {
    const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return `climatrip:cache:${namespace}:${hash}`;
}

function memoryGet(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryStore.delete(key);
        return null;
    }
    return entry.value;
}

function memorySet(key, value) {
    memoryStore.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

async function get(namespace, payload) {
    const key = makeKey(namespace, payload);

    if (redisReady) {
        try {
            const raw = await redisClient.get(key);
            if (raw) {
                logger.info("AI cache hit (redis)", { namespace });
                return JSON.parse(raw);
            }
            return null;
        } catch (error) {
            logger.warn("Redis GET failed, falling back to in-memory cache", { error: error.message });
        }
    }

    const value = memoryGet(key);
    if (value) logger.info("AI cache hit (memory)", { namespace });
    return value;
}

async function set(namespace, payload, value) {
    const key = makeKey(namespace, payload);

    if (redisReady) {
        try {
            await redisClient.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
            return;
        } catch (error) {
            logger.warn("Redis SET failed, falling back to in-memory cache", { error: error.message });
        }
    }

    memorySet(key, value);
}

async function close() {
    if (redisClient) {
        try {
            await redisClient.quit();
        } catch (error) {
            logger.warn("Error closing Redis connection", { error: error.message });
        }
    }
}

module.exports = { get, set, close };
