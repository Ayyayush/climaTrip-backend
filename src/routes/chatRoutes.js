const express = require("express");

const router = express.Router();

const { chatWithAI } = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimiter");
const { chatSchema } = require("../validators/travelValidators");

// The UI already requires login before opening TripGenie (see TripGenie.jsx),
// so enforcing it server-side too closes the same cost-abuse gap as
// /api/generate. TripGenie.jsx has been updated to send the Authorization
// header it already has available, so this does not change the user flow.
router.post("/", authMiddleware, aiLimiter, validate(chatSchema), chatWithAI);

module.exports = router;
