const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const userRepository = require("../repositories/userRepository");

// Validation of shape/format happens in validators/authValidators.js via
// the `validate` middleware, so controllers only handle business logic.

const register = asyncHandler(async (req, res) => {
    const { name, email, password, profilePicture } = req.body;

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
        throw new AppError("User already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userRepository.createUser({
        name,
        email,
        password: hashedPassword,
        profilePicture,
    });

    return res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePicture: user.profilePicture,
        },
    });
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await userRepository.findByEmail(email);

    if (!user) {
        throw new AppError("Invalid Credentials", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new AppError("Invalid Credentials", 400);
    }

    const token = jwt.sign({ id: user._id }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });

    return res.status(200).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePicture: user.profilePicture,
        },
    });
});

const getProfile = asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return res.status(200).json({ success: true, user });
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, location, profilePicture } = req.body;

    const user = await userRepository.findById(req.user.id, { withPassword: true });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.location = location || user.location;
    user.profilePicture = profilePicture || user.profilePicture;

    await userRepository.save(user);

    return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            location: user.location,
            profilePicture: user.profilePicture,
        },
    });
});

module.exports = { register, login, getProfile, updateProfile };
