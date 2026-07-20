const logger = require("../../utils/logger");

/**
 * Retries an async function with exponential backoff. Used to wrap
 * every LLM/tool call so a single transient upstream failure doesn't
 * bubble up as a 500 to the user (Part 10: retry / recover / never crash).
 */
async function withRetry(fn, { retries = 2, baseDelayMs = 400, label = "operation" } = {}) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;
            logger.warn(`${label} failed (attempt ${attempt + 1}/${retries + 1})`, {
                error: error.message,
            });
            if (attempt < retries) {
                const delay = baseDelayMs * 2 ** attempt;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

module.exports = withRetry;
