import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../../app.js";
import User from "../../../models/User.js";
import Notification from "../../../models/Notification.js";
import { registerAndVerify, uniquePhone } from "../../../test/helpers.js";

/**
 * Read-side endpoints added for the redesigned frontend: the admin console's
 * lists/stats, and the display fields (names, summaries) other list
 * endpoints now attach. All additive — the write paths are covered elsewhere.
 */

const newAdmin = async () => {
  const password = "AdminPass1";
  const email = `admin.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  await User.create({
    name: "Read Admin",
    email,
    phone: uniquePhone(),
    passwordHash: await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 4),
    role: "admin",
    emailVerified: true,
    phoneVerified: true,
  });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.data.accessToken;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createListing = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/listings")
    .set(auth(token))
    .send({
      type: "teacher_ad",
      subject: "Physics",
      grade: "A/L",
      medium: "sinhala",
      description: "Theory, past papers and practicals every week.",
      price: { amount: 2500, unit: "hour" },
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createListing failed: ${JSON.stringify(res.body)}`);
  return res.body.data.listing;
};

describe("Admin read endpoints", () => {
  it("are admin-only", async () => {
    const student = await registerAndVerify({ role: "student" });
    for (const path of ["/api/admin/stats", "/api/admin/verifications", "/api/admin/users", "/api/admin/listings"]) {
      const res = await request(app).get(path).set(auth(student.accessToken));
      expect(res.status).toBe(403);
    }
  });

  it("lists a pending verification with the teacher's name and returns the full submission", async () => {
    const adminToken = await newAdmin();
    const teacher = await registerAndVerify({ role: "teacher", name: "Kasun Perera" });
    const submit = await request(app).post("/api/verification/teacher/submit").set(auth(teacher.accessToken)).send({
      nicNumber: "199012345678",
      // A Cloudinary public_id (what a direct signed upload returns) is accepted, not just a URL.
      nicDocumentUrl: "teacher-verification/abc/nic_scan",
      selfieWithIdUrl: "https://example.com/selfie.jpg",
    });
    expect(submit.status).toBe(201);

    const list = await request(app).get("/api/admin/verifications?status=pending&q=Kasun").set(auth(adminToken));
    expect(list.status).toBe(200);
    const row = list.body.data.verifications.find((v) => v.userId === teacher.userId);
    expect(row).toMatchObject({ name: "Kasun Perera", status: "pending_review", documentCount: 2 });
    expect(row).not.toHaveProperty("nicNumber");
    expect(list.body.data.counts.pending).toBeGreaterThanOrEqual(1);

    const detail = await request(app).get(`/api/admin/verifications/${teacher.userId}`).set(auth(adminToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.verification.nicNumber).toBe("199012345678");
    expect(detail.body.data.verification.documents.map((d) => d.field)).toEqual(["nicDocumentUrl", "selfieWithIdUrl"]);
  });

  it("searches users by name and filters by role, excluding admins and child accounts", async () => {
    const adminToken = await newAdmin();
    const unique = `Zelda${Date.now()}`;
    await registerAndVerify({ role: "teacher", name: `${unique} Teacher` });
    await registerAndVerify({ role: "student", name: `${unique} Student` });

    const res = await request(app).get(`/api/admin/users?q=${unique}&role=teacher`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0]).toMatchObject({ role: "teacher", isActive: true, verification: { status: "not_submitted", tier: "none" } });
    const all = await request(app).get("/api/admin/users?limit=50").set(auth(adminToken));
    expect(all.body.data.users.every((u) => u.role !== "admin")).toBe(true);
  });

  it("lists listings with owner names and report counts, filterable by status", async () => {
    const adminToken = await newAdmin();
    const teacher = await registerAndVerify({ role: "teacher", name: "Anusha Fernando" });
    const student = await registerAndVerify({ role: "student" });
    const listing = await createListing(teacher.accessToken, { subject: "Combined Maths" });
    await request(app).post("/api/reports").set(auth(student.accessToken)).send({ targetType: "listing", targetId: listing._id, reason: "Suspicious" });
    await request(app).patch(`/api/admin/listings/${listing._id}/moderate`).set(auth(adminToken)).send({ status: "flagged" });

    const res = await request(app).get("/api/admin/listings?status=flagged&q=Combined").set(auth(adminToken));
    expect(res.status).toBe(200);
    const row = res.body.data.listings.find((l) => l._id === listing._id);
    expect(row.owner.name).toBe("Anusha Fernando");
    expect(row).toMatchObject({ reportCount: 1, pendingReportCount: 1, status: "flagged" });

    const reports = await request(app).get("/api/admin/reports?status=pending").set(auth(adminToken));
    const report = reports.body.data.reports.find((r) => String(r.targetId) === listing._id);
    expect(report.target).toMatchObject({ subject: "Combined Maths", ownerName: "Anusha Fernando", status: "flagged" });
    expect(report.reporter.role).toBe("student");
  });

  it("returns dashboard stats with a 12-month series", async () => {
    const adminToken = await newAdmin();
    const res = await request(app).get("/api/admin/stats?rangeDays=90").set(auth(adminToken));
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats.rangeDays).toBe(90);
    expect(stats.bookings.monthly).toHaveLength(12);
    expect(stats.deposits.monthly).toHaveLength(12);
    expect(typeof stats.users.teachers).toBe("number");
    expect(stats.queues).toHaveProperty("pendingVerifications");
  });
});

describe("Display fields on list endpoints", () => {
  it("browse attaches owner summaries and supports ownerId", async () => {
    const teacher = await registerAndVerify({ role: "teacher", name: "Ravi Shankar" });
    const listing = await createListing(teacher.accessToken);

    const res = await request(app).get(`/api/listings/browse?ownerId=${teacher.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.listings.map((l) => l._id)).toEqual([listing._id]);
    expect(res.body.data.listings[0].owner).toMatchObject({ name: "Ravi Shankar", verificationStatus: "none", reviewCount: 0 });
    expect(res.body.data.listings[0].owner).not.toHaveProperty("email");
  });

  it("interests carry listing and party names but no contact details until accepted", async () => {
    const teacher = await registerAndVerify({ role: "teacher", name: "Malini Dias" });
    const student = await registerAndVerify({ role: "student", name: "Nimal Silva" });
    const listing = await createListing(teacher.accessToken, { subject: "English" });
    await request(app).post("/api/interests").set(auth(student.accessToken)).send({ listingId: listing._id, message: "I'd like spoken English help." });

    const sent = await request(app).get("/api/interests/sent").set(auth(student.accessToken));
    const interest = sent.body.data.interests[0];
    expect(interest.listing.subject).toBe("English");
    expect(interest.toUser.name).toBe("Malini Dias");
    expect(interest.fromUser.name).toBe("Nimal Silva");
    expect(interest).toMatchObject({ hasReview: false, conversationId: null });
    expect(interest).not.toHaveProperty("toContact");
  });

  it("the public teacher profile includes the teacher's name", async () => {
    const teacher = await registerAndVerify({ role: "teacher", name: "Nadeesha Gunawardena" });
    await request(app).put("/api/profiles/teacher").set(auth(teacher.accessToken)).send({
      subjects: ["Mathematics"], grades: ["A/L"], medium: ["english"], classType: ["online"],
    });
    const res = await request(app).get(`/api/profiles/teacher/${teacher.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.name).toBe("Nadeesha Gunawardena");
  });

  it("my listings include per-listing interest counts", async () => {
    const teacher = await registerAndVerify({ role: "teacher" });
    const student = await registerAndVerify({ role: "student" });
    const listing = await createListing(teacher.accessToken);
    await request(app).post("/api/interests").set(auth(student.accessToken)).send({ listingId: listing._id, message: "Interested in joining." });

    const res = await request(app).get("/api/listings/mine").set(auth(teacher.accessToken));
    expect(res.body.data.listings[0].stats).toMatchObject({ interestCount: 1, pendingInterestCount: 1 });
  });
});

describe("PATCH /api/notifications/read-all", () => {
  it("marks only the caller's own notifications read", async () => {
    const me = await registerAndVerify({ role: "student" });
    const other = await registerAndVerify({ role: "student" });
    await Notification.create([
      { userId: me.userId, type: "interest_accepted" },
      { userId: me.userId, type: "interest_declined" },
      { userId: other.userId, type: "interest_accepted" },
    ]);

    const res = await request(app).patch("/api/notifications/read-all").set(auth(me.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(2);
    expect(await Notification.countDocuments({ userId: me.userId, read: false })).toBe(0);
    expect(await Notification.countDocuments({ userId: other.userId, read: false })).toBe(1);
  });
});
