const axios = require("axios");
const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const logger = require("../../utils/logger");

const TOOL_TIMEOUT_MS = 8000;

// All tools below use free, no-API-key endpoints (Open-Meteo) so the AI
// system is testable out of the box. Swap the base URLs for a paid
// provider (Google Maps, OpenWeather, etc) later without touching the
// agents that call these tools — they only depend on the return shape.

async function geocode(place) {
    const res = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
        params: { name: place, count: 1 },
        timeout: TOOL_TIMEOUT_MS,
    });
    const match = res.data?.results?.[0];
    if (!match) throw new Error(`Could not geocode "${place}"`);
    return { lat: match.latitude, lon: match.longitude, name: match.name, country: match.country };
}

const weatherTool = new DynamicStructuredTool({
    name: "get_weather_forecast",
    description: "Get the current weather and short-term forecast for a destination city.",
    schema: z.object({ destination: z.string() }),
    func: async ({ destination }) => {
        try {
            const place = await geocode(destination);
            const res = await axios.get("https://api.open-meteo.com/v1/forecast", {
                params: {
                    latitude: place.lat,
                    longitude: place.lon,
                    current: "temperature_2m,weather_code,wind_speed_10m",
                    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                    timezone: "auto",
                },
                timeout: TOOL_TIMEOUT_MS,
            });
            return JSON.stringify({ location: place.name, ...res.data.current, daily: res.data.daily });
        } catch (error) {
            logger.warn("weather tool failed", { error: error.message, destination });
            return JSON.stringify({ error: "weather data unavailable" });
        }
    },
});

const distanceTool = new DynamicStructuredTool({
    name: "get_distance",
    description: "Get the great-circle distance in kilometers between a source and destination city.",
    schema: z.object({ source: z.string(), destination: z.string() }),
    func: async ({ source, destination }) => {
        try {
            const [from, to] = await Promise.all([geocode(source), geocode(destination)]);
            const R = 6371;
            const dLat = ((to.lat - from.lat) * Math.PI) / 180;
            const dLon = ((to.lon - from.lon) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos((from.lat * Math.PI) / 180) *
                    Math.cos((to.lat * Math.PI) / 180) *
                    Math.sin(dLon / 2) ** 2;
            const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
            return JSON.stringify({ distanceKm, from: from.name, to: to.name });
        } catch (error) {
            logger.warn("distance tool failed", { error: error.message, source, destination });
            return JSON.stringify({ error: "distance data unavailable" });
        }
    },
});

const currencyTool = new DynamicStructuredTool({
    name: "convert_currency",
    description: "Convert an amount from one currency code to another (ISO 4217, e.g. USD, INR, EUR).",
    schema: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
    func: async ({ amount, from, to }) => {
        try {
            const res = await axios.get(`https://api.frankfurter.app/latest`, {
                params: { amount, from, to },
                timeout: TOOL_TIMEOUT_MS,
            });
            return JSON.stringify(res.data);
        } catch (error) {
            logger.warn("currency tool failed", { error: error.message, from, to });
            return JSON.stringify({ error: "currency data unavailable" });
        }
    },
});

const travelAgentTools = [weatherTool, distanceTool, currencyTool];

module.exports = { weatherTool, distanceTool, currencyTool, travelAgentTools, geocode };
