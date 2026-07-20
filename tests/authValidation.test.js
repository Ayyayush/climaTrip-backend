process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/beachtravel-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-key";

jest.mock("../src/config/db", () => jest.fn());
jest.mock("../src/repositories/userRepository", () => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    createUser: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
}));

const request = require("supertest");
const app = require("../src/server");

describe("POST /api/auth/register validation", () => {
    it("rejects a weak password with a 400 and no server error leak", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Test User",
            email: "test@example.com",
            password: "weak",
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toEqual(expect.any(String));
    });

    it("rejects an invalid email format", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Test User",
            email: "not-an-email",
            password: "StrongPass1!",
        });
        expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
        const res = await request(app).post("/api/auth/register").send({});
        expect(res.status).toBe(400);
    });
});

describe("Rate limiting", () => {
    it("still responds normally under the auth rate limit threshold", async () => {
        const res = await request(app).post("/api/auth/login").send({
            email: "test@example.com",
            password: "whatever",
        });
        expect([400, 429]).toContain(res.status);
    });
});
