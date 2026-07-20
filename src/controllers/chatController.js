const { getChatResponse } = require("../ai/chains/chatChain");
const asyncHandler = require("../utils/asyncHandler");

const chatWithAI = asyncHandler(async (req, res) => {
    const { message } = req.body;

    const response = await getChatResponse(message, req.user?.id);

    return res.status(200).json({ success: true, response });
});

module.exports = { chatWithAI };
