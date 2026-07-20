const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const AppError = require("../utils/AppError");

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            throw new AppError("No token found", 401);
        }

        const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

        const decoded = jwt.verify(token, env.jwtSecret);

        req.user = decoded;

        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        // jwt.verify throws its own error types (TokenExpiredError, JsonWebTokenError)
        return next(new AppError("Invalid or expired token", 401));
    }
};

module.exports = authMiddleware;
