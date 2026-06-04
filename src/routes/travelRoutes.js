const express = require("express");

const router = express.Router();

const {
    generateTravelPlan
} = require("../controllers/travelController");

const authMiddleware = require("../middleware/authMiddleware");

router.post(
    "/generate",
    generateTravelPlan
);

module.exports = router;