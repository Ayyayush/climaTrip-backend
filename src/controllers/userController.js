const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const userRepository = require("../repositories/userRepository");

const getProfile = asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    res.status(200).json({ success: true, user });
});

module.exports = { getProfile };
