process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/beachtravel-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-key";

jest.mock("../src/config/db", () => jest.fn());

const request = require("supertest");
const app = require("../src/server");

describe("Health endpoints", () => {
    it("GET / returns running status", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("GET /health returns ok", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("GET /unknown-route returns 404 with a consistent error shape", async () => {
        const res = await request(app).get("/unknown-route");
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});
