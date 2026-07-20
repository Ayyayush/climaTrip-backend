const UserPreference = require("../../models/UserPreference");

/**
 * Reads a user's stored trip-style/food preferences. Returns a plain,
 * human-readable summary string so it can be dropped straight into a
 * prompt, plus the raw doc for anything that needs the structured form.
 */
async function getPreferences(userId) {
    if (!userId) return { summary: "none known yet", doc: null };

    const doc = await UserPreference.findOne({ user: userId }).lean();

    if (!doc || (doc.tripStyle?.length === 0 && !doc.foodPreference)) {
        return { summary: "none known yet", doc };
    }

    const parts = [];
    if (doc.tripStyle?.length) parts.push(`trip style: ${doc.tripStyle.join(", ")}`);
    if (doc.foodPreference) parts.push(`food preference: ${doc.foodPreference}`);

    return { summary: parts.join("; "), doc };
}

/**
 * Merges newly-mentioned preferences into the stored set (additive —
 * doesn't wipe previously learned preferences unless explicitly replaced).
 */
async function upsertPreferences(userId, { tripStyle = [], foodPreference } = {}) {
    if (!userId) return null;

    const update = {};
    if (tripStyle.length) {
        update.$addToSet = { tripStyle: { $each: tripStyle } };
    }
    if (foodPreference) {
        update.foodPreference = foodPreference;
    }

    if (Object.keys(update).length === 0) return null;

    return UserPreference.findOneAndUpdate({ user: userId }, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
}

module.exports = { getPreferences, upsertPreferences };
