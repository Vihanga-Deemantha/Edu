import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { registerAndVerify } from "../../../test/helpers.js";

// Colombo-ish coordinates, ~a few km apart, for geo tests.
const COLOMBO = [79.8612, 6.9271];
const NEARBY = [79.8712, 6.9371]; // roughly 1.5km away
const FAR_AWAY = [80.6337, 7.2906]; // Kandy — ~100km away

const createListing = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "teacher_ad",
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      description: "A perfectly reasonable listing description for testing.",
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createListing failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.listing;
};

const newTeacher = async () => (await registerAndVerify({ role: "teacher" })).accessToken;

describe("GET /api/listings/browse", () => {
  it("shows only teacher_ads to a guest", async () => {
    const teacherToken = await newTeacher();
    await createListing(teacherToken);

    const { accessToken: studentToken } = await registerAndVerify({ role: "student" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        type: "student_ad",
        subject: "Science",
        grade: "Grade 9",
        medium: "english",
        description: "Looking for a science tutor for weekend classes.",
      });

    const res = await request(app).get("/api/listings/browse");

    expect(res.status).toBe(200);
    expect(res.body.data.listings.every((l) => l.type === "teacher_ad")).toBe(true);
  });

  it("shows student_ads too when the requester is a teacher", async () => {
    const { accessToken: studentToken } = await registerAndVerify({ role: "student" });
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        type: "student_ad",
        subject: "Science",
        grade: "Grade 9",
        medium: "english",
        description: "Looking for a science tutor for weekend classes.",
      });

    const teacherToken = await newTeacher();
    const res = await request(app).get("/api/listings/browse").set("Authorization", `Bearer ${teacherToken}`);

    expect(res.body.data.listings.some((l) => l.type === "student_ad")).toBe(true);
  });

  it("never returns a closed listing", async () => {
    const teacherToken = await newTeacher();
    const listing = await createListing(teacherToken, { subject: "UniqueSubjectXYZ" });
    await request(app).delete(`/api/listings/${listing._id}`).set("Authorization", `Bearer ${teacherToken}`);

    const res = await request(app).get("/api/listings/browse").query({ subject: "UniqueSubjectXYZ" });

    expect(res.body.data.listings).toHaveLength(0);
  });

  it("filters by subject case-insensitively", async () => {
    const teacherToken = await newTeacher();
    await createListing(teacherToken, { subject: "Chemistry" });

    const res = await request(app).get("/api/listings/browse").query({ subject: "chemistry" });

    expect(res.body.data.listings.length).toBeGreaterThan(0);
    expect(res.body.data.listings.every((l) => l.subject === "Chemistry")).toBe(true);
  });

  it("filters by price range and excludes listings with no stated price", async () => {
    const teacherToken = await newTeacher();
    await createListing(teacherToken, {
      subject: "PricedSubject",
      price: { amount: 2000, unit: "hour" },
    });
    await createListing(teacherToken, { subject: "PricedSubject" }); // no price at all

    const res = await request(app)
      .get("/api/listings/browse")
      .query({ subject: "PricedSubject", minPrice: 1000, maxPrice: 3000 });

    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].price.amount).toBe(2000);
  });

  it("sorts by price ascending", async () => {
    const teacherToken = await newTeacher();
    await createListing(teacherToken, { subject: "SortTest", price: { amount: 5000, unit: "hour" } });
    await createListing(teacherToken, { subject: "SortTest", price: { amount: 1000, unit: "hour" } });

    const res = await request(app)
      .get("/api/listings/browse")
      .query({ subject: "SortTest", sort: "price" });

    const amounts = res.body.data.listings.map((l) => l.price.amount);
    expect(amounts).toEqual([1000, 5000]);
  });

  it("paginates results", async () => {
    const teacherToken = await newTeacher();
    for (let i = 0; i < 3; i += 1) {
      await createListing(teacherToken, { subject: "PaginationTest" });
    }

    const res = await request(app)
      .get("/api/listings/browse")
      .query({ subject: "PaginationTest", page: 1, limit: 2 });

    expect(res.body.data.listings).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("finds a nearby listing and excludes a far-away one within a radius search", async () => {
    const teacherToken = await newTeacher();
    await createListing(teacherToken, {
      subject: "GeoTestNear",
      location: { type: "Point", coordinates: NEARBY },
    });
    await createListing(teacherToken, {
      subject: "GeoTestNear",
      location: { type: "Point", coordinates: FAR_AWAY },
    });

    const res = await request(app).get("/api/listings/browse").query({
      subject: "GeoTestNear",
      lat: COLOMBO[1],
      lng: COLOMBO[0],
      radiusKm: 10,
    });

    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].location.coordinates).toEqual(NEARBY);
    // Exercises the $facet-based single-pass geo count path — regression
    // check that the count branch still reports correctly now that it's
    // computed alongside the data branch instead of via a second $geoNear.
    expect(res.body.data.pagination.total).toBe(1);
  });

  it("paginates within a geo search using the $facet count", async () => {
    const teacherToken = await newTeacher();
    for (let i = 0; i < 3; i += 1) {
      await createListing(teacherToken, {
        subject: "GeoPaginationTest",
        location: { type: "Point", coordinates: NEARBY },
      });
    }

    const res = await request(app).get("/api/listings/browse").query({
      subject: "GeoPaginationTest",
      lat: COLOMBO[1],
      lng: COLOMBO[0],
      radiusKm: 10,
      page: 1,
      limit: 2,
    });

    expect(res.body.data.listings).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("rejects lat without lng", async () => {
    const res = await request(app).get("/api/listings/browse").query({ lat: 6.9271 });
    expect(res.status).toBe(422);
  });

  it("rejects an invalid medium filter", async () => {
    const res = await request(app).get("/api/listings/browse").query({ medium: "klingon" });
    expect(res.status).toBe(422);
  });
});
