const { runTravelGraph } = require("../ai/graph/travelGraph");
const { getPreferences } = require("../ai/memory/preferenceStore");
const responseCache = require("../ai/cache/responseCache");
const { createTrip } = require("../repositories/tripRepository");
const logger = require("../utils/logger");

/**
 * Orchestrates: preference lookup -> cache check -> LangGraph multi-agent
 * pipeline -> persistence. Replaces the old dead stub of the same name
 * (previously unused; the controller called groqService directly).
 */
async function generateAndSaveTravelPlan({ userId, source, destination, startDate, endDate }) {
    const requestKey = { source, destination, startDate, endDate };

    const cached = await responseCache.get("itinerary", requestKey);
    if (cached) {
        return cached;
    }

    const { summary: preferences } = await getPreferences(userId);

    const travelPlan = await runTravelGraph({
        source,
        destination,
        startDate,
        endDate,
        preferences,
    });

    await responseCache.set("itinerary", requestKey, travelPlan);

    // Persist trip history — previously the Trip model was defined but
    // never used anywhere. Never let a save failure break the response
    // the user is waiting on.
    createTrip({ userId, source, destination, startDate, endDate, travelPlan }).catch((error) => {
        logger.warn("Failed to persist trip history", { error: error.message });
    });

    return travelPlan;
}

module.exports = { generateAndSaveTravelPlan };
