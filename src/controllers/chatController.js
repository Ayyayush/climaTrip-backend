const { getChatResponse } = require("../services/chatService");

const chatWithAI = async (req, res) => {

    try {

        const { message } = req.body;

        if (!message) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }

        const response = await getChatResponse(message);

        return res.status(200).json({
            success: true,
            response
        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate response"
        });

    }

};

module.exports = {
    chatWithAI
};