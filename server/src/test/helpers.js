import request from "supertest";
import app from "../app.js";
import { __testOtpCapture } from "../services/otp.service.js";

export const uniquePhone = () => `+94${Math.floor(100000000 + Math.random() * 899999999)}`;

export const baseUser = (role = "teacher") => ({
  name: "Test User",
  email: `user.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
  phone: uniquePhone(),
  password: "SuperSecret8",
  role,
});

/** Registers a user of the given role and drives them through both OTP channels to a verified, logged-in state. */
export const registerAndVerify = async (overrides = {}) => {
  const payload = { ...baseUser(overrides.role), ...overrides };
  const registerRes = await request(app).post("/api/auth/register").send(payload);
  if (registerRes.status !== 201) {
    throw new Error(
      `registerAndVerify: register failed (${registerRes.status}): ${JSON.stringify(registerRes.body)}`
    );
  }
  const { userId } = registerRes.body.data;

  const emailCode = __testOtpCapture[`${userId}:email:signup`];
  const phoneCode = __testOtpCapture[`${userId}:phone:signup`];

  await request(app).post("/api/auth/verify-otp").send({ userId, channel: "email", code: emailCode });
  const finalRes = await request(app)
    .post("/api/auth/verify-otp")
    .send({ userId, channel: "phone", code: phoneCode });

  if (!finalRes.body?.data?.accessToken) {
    throw new Error(`registerAndVerify: final verify did not return tokens: ${JSON.stringify(finalRes.body)}`);
  }

  return { payload, userId, verifyRes: finalRes, accessToken: finalRes.body.data.accessToken };
};

/** Logs in and returns both the response and its Set-Cookie header, ready to replay on a later request. */
export const login = async (payload) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });
  if (res.status !== 200) {
    throw new Error(`login helper: login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { res, cookie: res.headers["set-cookie"] };
};

/**
 * Polls `checkFn` until it returns a truthy value or `timeoutMs` elapses.
 * For asserting on fire-and-forget side effects (Event logging) that
 * deliberately aren't awaited by the HTTP response they're attached to, so
 * a direct check right after the request can legitimately race the write.
 */
export const waitFor = async (checkFn, { timeoutMs = 1000, intervalMs = 20 } = {}) => {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await checkFn();
    if (result) return result;
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
