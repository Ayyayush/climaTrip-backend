const { generateAndSaveTravelPlan } = require("../services/travelService");
const asyncHandler = require("../utils/asyncHandler");

const generateTravelPlan = asyncHandler(async (req, res) => {
    const { source, destination, startDate, endDate } = req.body;

    const travelPlan = await generateAndSaveTravelPlan({
        userId: req.user?.id,
        source,
        destination,
        startDate,
        endDate,
    });

    // Response shape is unchanged: the raw plan object, exactly as before.
    return res.status(200).json(travelPlan);
});

module.exports = { generateTravelPlan };
