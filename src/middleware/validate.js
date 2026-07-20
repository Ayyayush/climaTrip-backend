const AppError = require("../utils/AppError");

/**
 * Returns Express middleware that validates req[source] (default: body)
 * against a Joi schema. On failure, throws a 400 AppError with a clear
 * client-safe message instead of letting bad input reach controllers/DB/AI.
 */
const validate = (schema, source = "body") => (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const message = error.details.map((d) => d.message).join(", ");
        return next(new AppError(message, 400));
    }

    req[source] = value;
    next();
};

module.exports = validate;
