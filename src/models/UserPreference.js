const mongoose = require("mongoose");

// Persists the preference tags mentioned in Part 6 (budget, adventure,
// luxury, family, solo, beach, nature, nightlife, food) per user so the
// AI can reuse them across sessions instead of starting from zero every time.
const userPreferenceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        tripStyle: {
            type: [String],
            enum: ["budget", "luxury", "adventure", "family", "solo", "beach", "nature", "nightlife"],
            default: [],
        },
        foodPreference: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("UserPreference", userPreferenceSchema);
