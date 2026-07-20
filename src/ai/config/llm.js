const { ChatGroq } = require("@langchain/groq");
const { env } = require("../../config/env");

/**
 * Single shared LLM client. Every chain/agent gets its model from here
 * instead of re-instantiating axios calls, so model name, timeout, and
 * key management live in exactly one place.
 */
function createLLM({ temperature = 0.4, maxTokens = 1500 } = {}) {
    return new ChatGroq({
        apiKey: env.groqApiKey,
        model: env.groqModel,
        modelName: env.groqModel, // some @langchain/groq versions expect this key instead of `model`
        temperature,
        maxTokens,
        timeout: env.groqTimeoutMs,
        maxRetries: 2,
    });
}

module.exports = { createLLM };
