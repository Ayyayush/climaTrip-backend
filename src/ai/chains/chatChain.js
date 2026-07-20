const { StringOutputParser } = require("@langchain/core/output_parsers");
const { createLLM } = require("../config/llm");
const { chatPrompt } = require("../prompts/travelPrompts");
const { getPreferences } = require("../memory/preferenceStore");
const { getHistory, appendTurn } = require("../memory/chatMemoryStore");
const withRetry = require("../utils/withRetry");
const logger = require("../../utils/logger");

// PromptTemplate -> LLM -> Output Parser, exactly per Part 3's required
// shape, replacing the old "call Groq directly with axios" chatService.
const llm = createLLM({ temperature: 0.6, maxTokens: 600 });
const outputParser = new StringOutputParser();
const chain = chatPrompt.pipe(llm).pipe(outputParser);

async function getChatResponse(message, userId) {
    const [{ summary: preferences }, history] = await Promise.all([
        getPreferences(userId),
        getHistory(userId),
    ]);

    const response = await withRetry(
        () => chain.invoke({ message, preferences, history }),
        { retries: 2, label: "chat chain" }
    );

    // Fire-and-forget persistence — never let memory-write failures break
    // the response the user is waiting on.
    appendTurn(userId, message, response).catch((error) =>
        logger.warn("Failed to persist chat memory", { error: error.message })
    );

    return response;
}

module.exports = { getChatResponse };
