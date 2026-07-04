const express = require("express");

const {
    register,
    login,
    getProfile,
    updateProfile
} = require("../controllers/authControllers");

const authMiddleware =
    require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.get(
    "/profile",
    authMiddleware,
    getProfile
);

router.put(
    "/profile",
    authMiddleware,
    updateProfile
);

module.exports = router;