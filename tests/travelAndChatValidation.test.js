process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/beachtravel-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-key";

jest.mock("../src/config/db", () => jest.fn());
jest.mock("../src/services/travelService", () => ({
    generateAndSaveTravelPlan: jest.fn().mockResolvedValue({ mocked: true }),
}));
jest.mock("../src/ai/chains/chatChain", () => ({
    getChatResponse: jest.fn().mockResolvedValue("mocked response"),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/server");

const validToken = jwt.sign({ id: "64f000000000000000000001" }, process.env.JWT_SECRET);

describe("POST /api/generate", () => {
    it("rejects unauthenticated requests with 401", async () => {
        const res = await request(app).post("/api/generate").send({
            source: "Delhi",
            destination: "Goa",
            startDate: "2026-08-01",
            endDate: "2026-08-05",
        });
        expect(res.status).toBe(401);
    });

    it("rejects an authenticated request missing required fields", async () => {
        const res = await request(app)
            .post("/api/generate")
            .set("Authorization", `Bearer ${validToken}`)
            .send({ source: "Delhi" });
        expect(res.status).toBe(400);
    });

    it("accepts a valid authenticated request", async () => {
        const res = await request(app)
            .post("/api/generate")
            .set("Authorization", `Bearer ${validToken}`)
            .send({
                source: "Delhi",
                destination: "Goa",
                startDate: "2026-08-01",
                endDate: "2026-08-05",
            });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ mocked: true });
    });
});

describe("POST /api/chat", () => {
    it("rejects unauthenticated requests with 401", async () => {
        const res = await request(app).post("/api/chat").send({ message: "hi" });
        expect(res.status).toBe(401);
    });

    it("rejects an empty message", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set("Authorization", `Bearer ${validToken}`)
            .send({ message: "" });
        expect(res.status).toBe(400);
    });

    it("accepts a valid authenticated chat message", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set("Authorization", `Bearer ${validToken}`)
            .send({ message: "Plan me a trip" });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
