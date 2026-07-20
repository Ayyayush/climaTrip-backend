const Joi = require("joi");

// Same rules the original controller enforced by hand (name length,
// email format, password complexity) — just moved to a shared,
// reusable schema instead of inline regex in the controller.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

const registerSchema = Joi.object({
    name: Joi.string().trim().min(3).max(50).required().messages({
        "string.min": "Name must be at least 3 characters",
        "any.required": "All fields are required",
    }),
    email: Joi.string().trim().lowercase().email().required().messages({
        "string.email": "Invalid email format",
        "any.required": "All fields are required",
    }),
    password: Joi.string().pattern(PASSWORD_PATTERN).required().messages({
        "string.pattern.base":
            "Password must contain uppercase, lowercase, number and special character",
        "any.required": "All fields are required",
    }),
    profilePicture: Joi.string().uri().allow("", null),
});

const loginSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required().messages({
        "any.required": "Email and Password are required",
    }),
    password: Joi.string().required().messages({
        "any.required": "Email and Password are required",
    }),
});

const updateProfileSchema = Joi.object({
    name: Joi.string().trim().min(3).max(50),
    phone: Joi.string().trim().allow("", null).max(20),
    location: Joi.string().trim().allow("", null).max(120),
    profilePicture: Joi.string().uri().allow("", null),
});

module.exports = { registerSchema, loginSchema, updateProfileSchema };
