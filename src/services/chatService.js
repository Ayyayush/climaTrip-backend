const axios = require("axios");

const getChatResponse = async (message) => {

    const systemPrompt = `
You are TripGenie, the official AI travel assistant of ClimaTrip.

Help users with:
- Travel planning
- Destination recommendations
- Budget suggestions
- Packing guidance
- Transportation advice
- Travel safety
- Weather related travel suggestions

Keep responses practical and concise.
`;

    const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.3-70b-versatile",

            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: message
                }
            ],

            temperature: 0.7,
            max_tokens: 500
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data.choices[0].message.content;
};

module.exports = {
    getChatResponse
};