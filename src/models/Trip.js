const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        source: {
            type: String,
            required: true
        },

        destination: {
            type: String,
            required: true
        },

        startDate: {
            type: String,
            required: true
        },

        endDate: {
            type: String,
            required: true
        },

        travelPlan: {
            type: Object,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Trip", tripSchema);