import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { registerAndVerify } from "../../../test/helpers.js";

// Throwaway audit-verification test — NOT part of the suite, to be deleted
// after use. Confirms whether GET /api/listings/browse leaks the raw
// `embedding` field via the aggregation ($geoNear / $lookup) path, since
// Listing.aggregate() bypasses Mongoose's schema-level `select: false`
// (which only applies to find()/findOne()).
describe("AUDIT: embedding leak via aggregate path", () => {
  it("sort=rating", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({
        type: "teacher_ad",
        subject: "AuditLeakTest",
        grade: "Grade 10",
        medium: "english",
        description: "A perfectly reasonable listing description for testing.",
      });

    const res = await request(app)
      .get("/api/listings/browse")
      .query({ subject: "AuditLeakTest", sort: "rating" });

    console.log("=== sort=rating result keys ===", Object.keys(res.body.data.listings[0] || {}));
    console.log("=== embedding present? ===", res.body.data.listings[0]?.embedding !== undefined);
    console.log("=== embedding is array of length ===", Array.isArray(res.body.data.listings[0]?.embedding) ? res.body.data.listings[0].embedding.length : "N/A");
  });

  it("plain newest sort (control — should NOT leak, uses .find())", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({
        type: "teacher_ad",
        subject: "AuditLeakControlTest",
        grade: "Grade 10",
        medium: "english",
        description: "A perfectly reasonable listing description for testing.",
      });

    const res = await request(app)
      .get("/api/listings/browse")
      .query({ subject: "AuditLeakControlTest" });

    console.log("=== plain find() result keys ===", Object.keys(res.body.data.listings[0] || {}));
    console.log("=== embedding present (control)? ===", res.body.data.listings[0]?.embedding !== undefined);
  });

  it("geo search path", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({
        type: "teacher_ad",
        subject: "AuditLeakGeoTest",
        grade: "Grade 10",
        medium: "english",
        description: "A perfectly reasonable listing description for testing.",
        location: { type: "Point", coordinates: [79.8612, 6.9271] },
      });

    const res = await request(app).get("/api/listings/browse").query({
      subject: "AuditLeakGeoTest",
      lat: 6.9271,
      lng: 79.8612,
      radiusKm: 10,
    });

    console.log("=== geo result keys ===", Object.keys(res.body.data.listings[0] || {}));
    console.log("=== embedding present (geo)? ===", res.body.data.listings[0]?.embedding !== undefined);
  });

  it("semantic search vectorSearch-unavailable fallback (control — should NOT leak, explicit delete)", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({
        type: "teacher_ad",
        subject: "AuditLeakSemanticTest",
        grade: "Grade 10",
        medium: "english",
        description: "A perfectly reasonable listing description for testing calculus.",
      });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus", subject: "AuditLeakSemanticTest" });

    console.log("=== semantic (fallback) result keys ===", Object.keys(res.body.data.listings[0] || {}));
    console.log("=== embedding present (semantic fallback)? ===", res.body.data.listings[0]?.embedding !== undefined);
  });
});
