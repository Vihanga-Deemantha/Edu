import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../../app.js";
import User from "../../../models/User.js";
import AuditLog from "../../../models/AuditLog.js";
import { registerAndVerify, uniquePhone, login } from "../../../test/helpers.js";

/**
 * Admin isn't reachable through the public register endpoint (rejected —
 * see auth.test.js), so it's seeded directly via the model, matching
 * scripts/seedAdmin.js's own approach, then logged in through the real
 * /api/auth/login endpoint for a genuine access token.
 */
const newAdmin = async () => {
  const password = "AdminPass1";
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 4);
  const email = `admin.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const admin = await User.create({
    name: "Test Admin",
    email,
    phone: uniquePhone(),
    passwordHash,
    role: "admin",
    emailVerified: true,
    phoneVerified: true,
    isActive: true,
  });

  const loginRes = await request(app).post("/api/auth/login").send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`newAdmin: login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
  }
  return { userId: admin._id.toString(), accessToken: loginRes.body.data.accessToken };
};

const submitVerification = (token) =>
  request(app)
    .post("/api/verification/teacher/submit")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nicNumber: "199912345678",
      nicDocumentUrl: "https://example.com/nic.jpg",
      selfieWithIdUrl: "https://example.com/selfie.jpg",
    });

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

describe("Admin routes require an admin", () => {
  it("rejects every admin route for a non-admin caller", async () => {
    const student = await registerAndVerify({ role: "student" });
    const token = student.accessToken;

    const calls = [
      request(app).patch(`/api/admin/verification/${student.userId}`).set("Authorization", `Bearer ${token}`).send({}),
      request(app).patch(`/api/admin/users/${student.userId}/suspend`).set("Authorization", `Bearer ${token}`).send({}),
      request(app).patch("/api/admin/listings/000000000000000000000000/moderate").set("Authorization", `Bearer ${token}`).send({ status: "flagged" }),
      request(app).get("/api/admin/reports").set("Authorization", `Bearer ${token}`),
      request(app).patch("/api/admin/reports/000000000000000000000000/resolve").set("Authorization", `Bearer ${token}`).send({ status: "resolved" }),
    ];

    const results = await Promise.all(calls);
    for (const res of results) {
      expect(res.status).toBe(403);
    }
  });

  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/admin/reports");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/verification/:userId", () => {
  it("approves a teacher's verification and syncs TeacherProfile immediately", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await submitVerification(teacher.accessToken);
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({ subjects: ["Mathematics"], grades: ["Grade 10"], medium: ["english"], classType: ["online"] });
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/verification/${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ verificationTier: "fully_verified", status: "approved", adminNotes: "Documents checked out." });

    expect(res.status).toBe(200);
    expect(res.body.data.verification.verificationTier).toBe("fully_verified");
    expect(res.body.data.verification.status).toBe("approved");

    const profileRes = await request(app).get(`/api/profiles/teacher/${teacher.userId}`);
    expect(profileRes.body.data.profile.verificationStatus).toBe("fully_verified");

    const auditEntry = await AuditLog.findOne({ targetType: "verification", "metadata.userId": teacher.userId });
    expect(auditEntry).toBeTruthy();
    expect(auditEntry.adminId.toString()).toBe(admin.userId);
    expect(auditEntry.action).toBe("verification_reviewed");
  });

  it("rejects a teacher's verification", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await submitVerification(teacher.accessToken);
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/verification/${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ verificationTier: "none", status: "rejected", adminNotes: "Blurry NIC photo." });

    expect(res.status).toBe(200);
    expect(res.body.data.verification.status).toBe("rejected");
  });

  it("404s for a teacher with no verification submission", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/verification/${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ verificationTier: "id_verified", status: "approved" });

    expect(res.status).toBe(404);
  });

  it("rejects an invalid verificationTier", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    await submitVerification(teacher.accessToken);
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/verification/${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ verificationTier: "super_verified", status: "approved" });

    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/admin/users/:userId/suspend", () => {
  it("suspends a user, revoking their existing session and blocking future logins", async () => {
    const student = await registerAndVerify({ role: "student" });
    const { cookie } = await login(student.payload);
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/users/${student.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ adminNotes: "Reported for spam." });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);

    // suspendUser hard-deletes the RefreshToken outright (not just flips a
    // flag), so refresh reports "session not found" — the isActive check
    // added to refreshTokens is defense in depth for a token that's still
    // on record, which this one deliberately no longer is.
    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe("INVALID_REFRESH_TOKEN");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: student.payload.email, password: student.payload.password });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("rejects suspending an admin account", async () => {
    const admin = await newAdmin();
    const targetAdmin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/users/${targetAdmin.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_SUSPEND_ADMIN");
  });

  it("404s for a nonexistent user", async () => {
    const admin = await newAdmin();

    const res = await request(app)
      .patch("/api/admin/users/000000000000000000000000/suspend")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/users/:userId/unsuspend", () => {
  it("reverses a suspension, allowing login again", async () => {
    const student = await registerAndVerify({ role: "student" });
    const admin = await newAdmin();
    await request(app)
      .patch(`/api/admin/users/${student.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/admin/users/${student.userId}/unsuspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ adminNotes: "Appeal accepted." });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(true);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: student.payload.email, password: student.payload.password });
    expect(loginRes.status).toBe(200);
  });

  it("404s for a nonexistent user", async () => {
    const admin = await newAdmin();

    const res = await request(app)
      .patch("/api/admin/users/000000000000000000000000/unsuspend")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/listings/:id/moderate", () => {
  it("flags a listing, removing it from public browse results", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    const listing = await createListing(teacher.accessToken, { subject: "ModerationTestSubject" });
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/listings/${listing._id}/moderate`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "flagged", adminNotes: "Reported content." });

    expect(res.status).toBe(200);
    expect(res.body.data.listing.status).toBe("flagged");

    const browseRes = await request(app).get("/api/listings/browse").query({ subject: "ModerationTestSubject" });
    expect(browseRes.body.data.listings).toHaveLength(0);
  });

  it("un-flags a listing back to active", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    const listing = await createListing(teacher.accessToken, { subject: "UnflagTestSubject" });
    const admin = await newAdmin();

    await request(app)
      .patch(`/api/admin/listings/${listing._id}/moderate`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "flagged" });

    const res = await request(app)
      .patch(`/api/admin/listings/${listing._id}/moderate`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.data.listing.status).toBe("active");

    const browseRes = await request(app).get("/api/listings/browse").query({ subject: "UnflagTestSubject" });
    expect(browseRes.body.data.listings).toHaveLength(1);
  });

  it("404s for a nonexistent listing", async () => {
    const admin = await newAdmin();

    const res = await request(app)
      .patch("/api/admin/listings/000000000000000000000000/moderate")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "flagged" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/admin/reports and PATCH .../resolve", () => {
  const fileReport = (token, overrides = {}) =>
    request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "review", targetId: "000000000000000000000000", reason: "Looks fake.", ...overrides });

  it("lists reports, optionally filtered by status", async () => {
    const reporter = await registerAndVerify({ role: "student" });
    await fileReport(reporter.accessToken);
    await fileReport(reporter.accessToken);
    const admin = await newAdmin();

    const all = await request(app).get("/api/admin/reports").set("Authorization", `Bearer ${admin.accessToken}`);
    expect(all.body.data.reports).toHaveLength(2);

    const pending = await request(app)
      .get("/api/admin/reports")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(pending.body.data.reports).toHaveLength(2);
  });

  it("resolves a report", async () => {
    const reporter = await registerAndVerify({ role: "student" });
    const reportRes = await fileReport(reporter.accessToken);
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/reports/${reportRes.body.data.report._id}/resolve`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "resolved", adminNotes: "Confirmed and actioned." });

    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe("resolved");

    const remaining = await request(app)
      .get("/api/admin/reports")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(remaining.body.data.reports).toHaveLength(0);
  });

  it("dismisses a report", async () => {
    const reporter = await registerAndVerify({ role: "student" });
    const reportRes = await fileReport(reporter.accessToken);
    const admin = await newAdmin();

    const res = await request(app)
      .patch(`/api/admin/reports/${reportRes.body.data.report._id}/resolve`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "dismissed" });

    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe("dismissed");
  });

  it("404s for a nonexistent report", async () => {
    const admin = await newAdmin();

    const res = await request(app)
      .patch("/api/admin/reports/000000000000000000000000/resolve")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "resolved" });

    expect(res.status).toBe(404);
  });
});
