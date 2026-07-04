const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const chatRoutes = require("./routes/chatRoutes");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const travelRoutes = require("./routes/travelRoutes");

dotenv.config();

const app = express();

connectDB();

// ============================
// CORS Configuration
// ============================
app.use(
    cors({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Origin",
            "X-Requested-With",
            "Content-Type",
            "Accept",
            "Authorization"
        ]
    })
);



app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", travelRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "BeachTravel Backend Running"
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});