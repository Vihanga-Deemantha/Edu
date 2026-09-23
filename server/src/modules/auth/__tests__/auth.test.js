import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { __testOtpCapture } from "../../../services/otp.service.js";
import User from "../../../models/User.js";
import { uniquePhone, baseUser, registerAndVerify, login } from "../../../test/helpers.js";

const baseTeacher = () => baseUser("teacher");

describe("POST /api/auth/register", () => {
  it("creates an unverified account and sends both OTPs, no tokens yet", async () => {
    const res = await request(app).post("/api/auth/register").send(baseTeacher());

    expect(res.status).toBe(201);
    expect(res.body.data.emailVerified).toBe(false);
    expect(res.body.data.phoneVerified).toBe(false);
    expect(res.body.data.accessToken).toBeUndefined();

    const { userId } = res.body.data;
    expect(__testOtpCapture[`${userId}:email:signup`]).toMatch(/^\d{6}$/);
    expect(__testOtpCapture[`${userId}:phone:signup`]).toMatch(/^\d{6}$/);
  });

  it("rejects a duplicate email with 409", async () => {
    const payload = baseTeacher();
    await request(app).post("/api/auth/register").send(payload);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, phone: uniquePhone() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects role: admin from the public endpoint", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...baseTeacher(), role: "admin" });
    expect(res.status).toBe(422);
  });
});

describe("OTP verification and login gating", () => {
  it("blocks login with 403 ACCOUNT_NOT_VERIFIED and returns the userId to resume with", async () => {
    const payload = baseTeacher();
    const registerRes = await request(app).post("/api/auth/register").send(payload);
    const { userId } = registerRes.body.data;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe("ACCOUNT_NOT_VERIFIED");
    // Regression check: the frontend has no other way to know which account
    // to resume OTP verification for — this field is what makes that flow
    // reachable instead of a dead end.
    expect(loginRes.body.error.userId).toBe(userId);
  });

  it("logs in automatically once both channels are verified", async () => {
    const { verifyRes } = await registerAndVerify();

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.fullyVerified).toBe(true);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
    expect(verifyRes.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("rejects the wrong password with a generic 401 after verification", async () => {
    const { payload } = await registerAndVerify();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: "WrongPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in successfully when the email is typed in different casing than registered", async () => {
    const { payload } = await registerAndVerify();
    const mixedCaseEmail = payload.email
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c))
      .join("");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: mixedCaseEmail, password: payload.password });

    expect(res.status).toBe(200);
  });

  it("rejects a duplicate registration that only differs from an existing account by email casing", async () => {
    const payload = baseTeacher();
    await request(app).post("/api/auth/register").send(payload);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, email: payload.email.toUpperCase(), phone: uniquePhone() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the profile for a valid access token, never the password hash", async () => {
    const { verifyRes } = await registerAndVerify();
    const accessToken = verifyRes.body.data.accessToken;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBeTruthy();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });
});

describe("refresh token rotation and reuse detection", () => {
  it("issues a new access token and rotates the refresh cookie", async () => {
    const { payload } = await registerAndVerify();
    const { cookie } = await login(payload);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("treats reuse of a rotated-out refresh token as theft and revokes the session", async () => {
    const { payload } = await registerAndVerify();
    const { cookie: staleCookie } = await login(payload);

    // Rotate once — staleCookie no longer matches any active session afterward
    const rotated = await request(app).post("/api/auth/refresh").set("Cookie", staleCookie);
    expect(rotated.status).toBe(200);

    // Replay the pre-rotation cookie
    const reuseRes = await request(app).post("/api/auth/refresh").set("Cookie", staleCookie);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe("TOKEN_REUSE");
  });

  it("keeps a second device's session alive after logging in again on a first (multi-device)", async () => {
    const { payload } = await registerAndVerify();

    const { cookie: cookieA } = await login(payload);
    const { cookie: cookieB } = await login(payload);

    // Regression check: with a single refreshTokenHash-on-User, this second
    // login would have silently invalidated the first device's session.
    const refreshA = await request(app).post("/api/auth/refresh").set("Cookie", cookieA);
    const refreshB = await request(app).post("/api/auth/refresh").set("Cookie", cookieB);

    expect(refreshA.status).toBe(200);
    expect(refreshB.status).toBe(200);
  });

  it("logout ends only the current session, not other devices", async () => {
    const { payload } = await registerAndVerify();

    const { res: loginA, cookie: cookieA } = await login(payload);
    const { cookie: cookieB } = await login(payload);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginA.body.data.accessToken}`)
      .set("Cookie", cookieA);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogoutA = await request(app).post("/api/auth/refresh").set("Cookie", cookieA);
    const refreshB = await request(app).post("/api/auth/refresh").set("Cookie", cookieB);

    expect(refreshAfterLogoutA.status).toBe(401);
    expect(refreshB.status).toBe(200);
  });

  it("rejects a refresh for an account whose isActive flips to false mid-session", async () => {
    const { payload, userId } = await registerAndVerify();
    const { cookie } = await login(payload);

    // Phase 14's suspendUser also hard-deletes the RefreshToken outright,
    // which would make refresh 401 for an unrelated reason (no record at
    // all) before this check ever ran — flipping isActive directly here,
    // leaving the token on record, is what actually exercises this
    // specific guard in refreshTokens.
    await User.findByIdAndUpdate(userId, { isActive: false });

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("child account registration", () => {
  const registerParent = async () => registerAndVerify({ role: "parent" });

  it("rejects a child registration without attestedGuardianship", async () => {
    const { verifyRes } = await registerParent();
    const accessToken = verifyRes.body.data.accessToken;

    const res = await request(app)
      .post("/api/auth/register-child")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Little Kid", grade: "Grade 4" });

    // The express-validator layer requires attestedGuardianship to be
    // present and exactly true/"true", so an omitted field is rejected at
    // 422 before the request ever reaches the service's own 400 check —
    // both layers agree the request is invalid, just at different points.
    expect(res.status).toBe(422);
  });

  it("creates a child and links it to the parent's linkedChildIds", async () => {
    const { verifyRes } = await registerParent();
    const accessToken = verifyRes.body.data.accessToken;

    const createRes = await request(app)
      .post("/api/auth/register-child")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Little Kid", grade: "Grade 4", attestedGuardianship: true });

    expect(createRes.status).toBe(201);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    const childIds = meRes.body.data.user.linkedChildIds.map((c) => String(c._id));

    expect(childIds).toContain(String(createRes.body.data.child._id));
  });
});

describe("forgot / reset password", () => {
  it("resets the password with a valid code and revokes existing sessions", async () => {
    const { payload, userId } = await registerAndVerify();
    const { cookie: oldSessionCookie } = await login(payload);

    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email: payload.email });
    expect(forgotRes.status).toBe(200);

    const code = __testOtpCapture[`${userId}:email:password_reset`];
    expect(code).toMatch(/^\d{6}$/);

    const resetRes = await request(app).post("/api/auth/reset-password").send({
      email: payload.email,
      code,
      newPassword: "BrandNewPassword9",
    });
    expect(resetRes.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: "BrandNewPassword9" });
    expect(newPasswordLogin.status).toBe(200);

    // The session that existed before the reset should no longer refresh.
    const staleRefresh = await request(app).post("/api/auth/refresh").set("Cookie", oldSessionCookie);
    expect(staleRefresh.status).toBe(401);
  });

  it("responds the same way whether or not the email is registered (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody-registered@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("sends a reset code even when the email is typed in different casing than registered", async () => {
    const { payload, userId } = await registerAndVerify();

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: payload.email.toUpperCase() });

    expect(res.status).toBe(200);
    expect(__testOtpCapture[`${userId}:email:password_reset`]).toMatch(/^\d{6}$/);
  });
});
