const Joi = require("joi");

// Bounded lengths so free-text fields can never blow up prompt size
// or be used to inject instructions into the LLM prompt unchecked.
const generateItinerarySchema = Joi.object({
    source: Joi.string().trim().min(2).max(100).required(),
    destination: Joi.string().trim().min(2).max(100).required(),
    startDate: Joi.string().trim().required(),
    endDate: Joi.string().trim().required(),
});

const chatSchema = Joi.object({
    message: Joi.string().trim().min(1).max(2000).required().messages({
        "any.required": "Message is required",
        "string.empty": "Message is required",
    }),
    sessionId: Joi.string().trim().max(100).allow("", null),
});

module.exports = { generateItinerarySchema, chatSchema };
