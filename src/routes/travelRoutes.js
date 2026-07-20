const express = require("express");

const router = express.Router();

const { generateTravelPlan } = require("../controllers/travelController");

const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimiter");
const { generateItinerarySchema } = require("../validators/travelValidators");

// NOTE: previously unauthenticated and unlimited — now requires a valid
// token and is rate-limited, since it calls a paid LLM API. Frontend
// already sends an Authorization header on this call (see searchform.jsx),
// so this closes a real gap rather than changing the intended flow.
router.post("/generate", authMiddleware, aiLimiter, validate(generateItinerarySchema), generateTravelPlan);

module.exports = router;
