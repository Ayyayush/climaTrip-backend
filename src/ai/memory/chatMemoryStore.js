const ChatMessage = require("../../models/ChatMessage");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");

const MAX_HISTORY_MESSAGES = 10;

/**
 * Loads the last N turns for this user as LangChain message objects,
 * ready to drop into the {history} placeholder of chatPrompt.
 */
async function getHistory(userId) {
    if (!userId) return [];

    const recent = await ChatMessage.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(MAX_HISTORY_MESSAGES)
        .lean();

    return recent
        .reverse()
        .map((msg) => (msg.role === "human" ? new HumanMessage(msg.content) : new AIMessage(msg.content)));
}

async function appendTurn(userId, humanContent, aiContent) {
    if (!userId) return;

    await ChatMessage.insertMany([
        { user: userId, role: "human", content: humanContent },
        { user: userId, role: "ai", content: aiContent },
    ]);
}

module.exports = { getHistory, appendTurn, MAX_HISTORY_MESSAGES };
