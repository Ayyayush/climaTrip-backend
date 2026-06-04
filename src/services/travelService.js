const generateTravelPlanService = (
    source,
    destination,
    startDate,
    endDate
) => {

    return {
        success: true,
        trip: {
            source,
            destination,
            startDate,
            endDate
        },
        message: "Travel Service Working"
    };
};

module.exports = {
    generateTravelPlanService
};