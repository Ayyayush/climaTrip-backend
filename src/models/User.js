const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    name:
    {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },

    email:
    {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password:
    {
        type: String,
        required: true
    },

    profilePicture:
    {
        type: String,
        default: "https://ui-avatars.com/api/?background=random"
    }
},
{
    timestamps: true
});

module.exports = mongoose.model("User", userSchema);