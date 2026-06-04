const { generateItinerary } = require("../services/groqService");

const generateTravelPlan = async (req, res) => {
    try {

        const {
            source,
            destination,
            startDate,
            endDate
        } = req.body;

        const aiResponse = await generateItinerary(
            source,
            destination,
            startDate,
            endDate
        );

        const cleanedResponse = aiResponse
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const travelPlan = JSON.parse(cleanedResponse);
        
       console.log(
    JSON.stringify(
        travelPlan.day_wise_itinerary,
        null,
        2
    )
);

        return res.status(200).json(travelPlan);

    } catch (error) {

        console.error("Generate Travel Plan Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to Generate Travel Plan"
        });
    }
};

module.exports = {
    generateTravelPlan
};