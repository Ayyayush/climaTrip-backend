const mongoose = require("mongoose");

// Rolling conversation memory per user, so TripGenie has multi-turn context
// instead of treating every message as a fresh, isolated request.
const chatMessageSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ["human", "ai"],
            required: true,
        },
        content: {
            type: String,
            required: true,
            maxlength: 4000,
        },
    },
    { timestamps: true }
);

chatMessageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
