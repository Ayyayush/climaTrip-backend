const Trip = require("../models/Trip");

// Simple repository layer (Part 11) so controllers/services never touch
// Mongoose directly for Trip data.
async function createTrip({ userId, source, destination, startDate, endDate, travelPlan }) {
    return Trip.create({ user: userId, source, destination, startDate, endDate, travelPlan });
}

async function listTripsForUser(userId, { limit = 20 } = {}) {
    return Trip.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = { createTrip, listTripsForUser };
