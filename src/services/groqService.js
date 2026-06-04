const axios = require("axios");

const generateItinerary = async (
    source,
    destination,
    startDate,
    endDate
) => {

    const prompt = `
Create a travel itinerary.

Source: ${source}
Destination: ${destination}
Start Date: ${startDate}
End Date: ${endDate}

Return ONLY valid JSON.

{
  "transport_options": {
    "to_destination": {
      "mode": "",
      "estimated_time": "",
      "cost": 0
    },
    "return": {
      "mode": "",
      "estimated_time": "",
      "cost": 0
    }
  },
  "local_transport": [],
  "nature_spots": [],
  "tourist_spots": [],
  "day_wise_itinerary": [],
  "budget_breakdown": {
    "travel": 0,
    "stay": 0,
    "food": 0,
    "activities": 0,
    "total": 0
  },
  "return_plan": {
    "time": "",
    "mode": ""
  }
}
`;

    const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7
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
    generateItinerary
};