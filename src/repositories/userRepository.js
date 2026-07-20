const User = require("../models/User");

// Repository layer (Part 11): controllers/services no longer talk to
// Mongoose directly for User data.
async function findByEmail(email) {
    return User.findOne({ email });
}

async function findById(id, { withPassword = false } = {}) {
    const query = User.findById(id);
    return withPassword ? query : query.select("-password");
}

async function createUser(data) {
    return User.create(data);
}

async function save(userDoc) {
    return userDoc.save();
}

module.exports = { findByEmail, findById, createUser, save };
