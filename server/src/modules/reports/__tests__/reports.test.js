import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { registerAndVerify } from "../../../test/helpers.js";

describe("POST /api/reports", () => {
  it("creates a pending report attributed to the reporter", async () => {
    const user = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ targetType: "review", targetId: "000000000000000000000000", reason: "This review looks fake." });

    expect(res.status).toBe(201);
    expect(res.body.data.report.status).toBe("pending");
    expect(res.body.data.report.reporterId).toBe(user.userId);
    expect(res.body.data.report.targetType).toBe("review");
  });

  it("rejects an invalid targetType", async () => {
    const user = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ targetType: "spaceship", targetId: "000000000000000000000000", reason: "Hi." });

    expect(res.status).toBe(422);
  });

  it("rejects a missing reason", async () => {
    const user = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ targetType: "review", targetId: "000000000000000000000000" });

    expect(res.status).toBe(422);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({ targetType: "review", targetId: "000000000000000000000000", reason: "Hi." });
    expect(res.status).toBe(401);
  });
});
