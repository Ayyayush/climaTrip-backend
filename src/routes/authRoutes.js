const express = require("express");

const { register, login, getProfile, updateProfile } = require("../controllers/authControllers");

const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const { registerSchema, loginSchema, updateProfileSchema } = require("../validators/authValidators");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), register);

router.post("/login", authLimiter, validate(loginSchema), login);

router.get("/profile", authMiddleware, getProfile);

router.put("/profile", authMiddleware, validate(updateProfileSchema), updateProfile);

module.exports = router;
