import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import Listing from "../../../models/Listing.js";
import { registerAndVerify } from "../../../test/helpers.js";

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

describe("POST /api/search/semantic", () => {
  it("ranks a listing whose description shares words with the query above one that doesn't", async () => {
    const teacher = await newTeacher();
    const matching = await createListing(teacher, {
      subject: "SemanticRankTest",
      description: "Experienced calculus and algebra tutor for advanced students preparing for exams.",
    });
    await createListing(teacher, {
      subject: "SemanticRankTest",
      description: "Friendly piano lessons for beginners of all ages in a relaxed setting.",
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus algebra tutor exam preparation", subject: "SemanticRankTest" });

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(2);
    expect(String(res.body.data.listings[0]._id)).toBe(String(matching._id));
  });

  it("combines semantic ranking with a hard structured filter (subject) — matching wording alone isn't enough", async () => {
    const teacher = await newTeacher();
    await createListing(teacher, {
      subject: "SemanticFilterTestMath",
      description: "Calculus and algebra expert tutor for exam preparation.",
    });
    const wrongSubject = await createListing(teacher, {
      subject: "SemanticFilterTestChem",
      description: "Calculus and algebra expert tutor for exam preparation.", // same wording, different subject
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus algebra tutor", subject: "SemanticFilterTestMath" });

    expect(res.body.data.listings.every((l) => l.subject === "SemanticFilterTestMath")).toBe(true);
    expect(res.body.data.listings.map((l) => String(l._id))).not.toContain(String(wrongSubject._id));
  });

  it("applies the same visibility rule as /browse — a guest never sees student_ads", async () => {
    const { accessToken: studentToken } = await registerAndVerify({ role: "student" });
    await createListing(studentToken, {
      type: "student_ad",
      subject: "SemanticVisibilityTest",
      description: "Looking for a calculus and algebra tutor for weekend classes.",
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus algebra tutor", subject: "SemanticVisibilityTest" });

    expect(res.body.data.listings.every((l) => l.type === "teacher_ad")).toBe(true);
  });

  it("excludes the raw embedding field from the $vectorSearch pipeline itself (regression: aggregate() bypasses Mongoose's select:false)", async () => {
    // The other "never exposes the raw embedding field" test below only
    // ever exercises searchViaInMemoryFallback, since MongoMemoryServer
    // can't run $vectorSearch at all — it can't tell us anything about
    // whether the REAL vector-index pipeline strips the field too. This
    // test inspects the pipeline array itself (via a spy, not a mocked
    // rejection) so it still catches a regression here even though the
    // pipeline can never actually succeed in this test environment.
    const teacher = await newTeacher();
    await createListing(teacher, {
      subject: "EmbeddingPipelineTest",
      description: "Calculus and algebra expert tutor for exams.",
    });
    const aggregateSpy = vi.spyOn(Listing, "aggregate");

    await request(app).post("/api/search/semantic").send({ query: "calculus", subject: "EmbeddingPipelineTest" });

    expect(aggregateSpy).toHaveBeenCalled();
    const pipeline = aggregateSpy.mock.calls[0][0];
    const stripsEmbedding = pipeline.some(
      (stage) =>
        stage.$unset === "embedding" ||
        (Array.isArray(stage.$unset) && stage.$unset.includes("embedding")) ||
        (stage.$project && stage.$project.embedding === 0)
    );
    expect(stripsEmbedding).toBe(true);

    aggregateSpy.mockRestore();
  });

  it("never exposes the raw embedding field", async () => {
    const teacher = await newTeacher();
    await createListing(teacher, {
      subject: "SemanticEmbeddingHiddenTest",
      description: "Calculus and algebra expert tutor for exams.",
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus", subject: "SemanticEmbeddingHiddenTest" });

    expect(res.body.data.listings[0].embedding).toBeUndefined();
  });

  it("paginates", async () => {
    const teacher = await newTeacher();
    for (let i = 0; i < 3; i += 1) {
      await createListing(teacher, {
        subject: "SemanticPaginationTest",
        description: `Listing number ${i} about calculus tutoring for exams.`,
      });
    }

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus tutoring", subject: "SemanticPaginationTest", page: 1, limit: 2 });

    expect(res.body.data.listings).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("falls back to the in-memory path when $vectorSearch itself fails (e.g. no Atlas index configured yet)", async () => {
    const teacher = await newTeacher();
    await createListing(teacher, {
      subject: "SemanticFallbackTest",
      description: "Calculus and algebra expert tutor for exams.",
    });

    // MongoMemoryServer already doesn't support $vectorSearch, so every
    // other test in this file already exercises the fallback path as a
    // side effect — this one specifically pins down the CONTROL FLOW
    // (attempt real vector search, catch a failure there specifically,
    // fall back) rather than just the ranking outcome, since that's the
    // part a future refactor could silently break without any other test
    // in this file noticing.
    const aggregateSpy = vi.spyOn(Listing, "aggregate").mockRejectedValueOnce(new Error("simulated: no such index"));

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "calculus", subject: "SemanticFallbackTest" });

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
    aggregateSpy.mockRestore();
  });

  it("rejects a missing query", async () => {
    const res = await request(app).post("/api/search/semantic").send({});
    expect(res.status).toBe(422);
  });

  it("rejects an invalid medium filter", async () => {
    const res = await request(app).post("/api/search/semantic").send({ query: "maths tutor", medium: "klingon" });
    expect(res.status).toBe(422);
  });
});

describe("Phase 19B — translated content fields feed into semantic search", () => {
  it("matches via description_si even when the base description shares nothing with the query", async () => {
    const teacher = await newTeacher();
    const translated = await createListing(teacher, {
      subject: "SemanticTranslationTest",
      description: "A generic tutoring listing with no distinctive overlap words at all.",
      description_si: "quantum physics olympiad coaching specialist",
    });
    await createListing(teacher, {
      subject: "SemanticTranslationTest",
      description: "A completely unrelated cooking and baking lesson listing.",
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "quantum physics olympiad coaching", subject: "SemanticTranslationTest" });

    expect(res.status).toBe(200);
    expect(String(res.body.data.listings[0]._id)).toBe(String(translated._id));
  });

  it("matches via the owning teacher's profile bio_si even when the listing's own text shares nothing with the query", async () => {
    const teacherWithBio = await newTeacher();
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${teacherWithBio}`)
      .send({
        subjects: ["Mathematics"],
        grades: ["Grade 10"],
        medium: ["english"],
        classType: ["online"],
        bio_si: "astrophysics rocketry specialist mentor",
      });
    const matching = await createListing(teacherWithBio, {
      subject: "BioTranslationTest",
      description: "A generic listing with no distinctive overlap words at all here.",
    });

    const otherTeacher = await newTeacher();
    await createListing(otherTeacher, {
      subject: "BioTranslationTest",
      description: "A completely unrelated cooking and baking lesson listing.",
    });

    const res = await request(app)
      .post("/api/search/semantic")
      .send({ query: "astrophysics rocketry specialist mentor", subject: "BioTranslationTest" });

    expect(res.status).toBe(200);
    expect(String(res.body.data.listings[0]._id)).toBe(String(matching._id));
  });
});
