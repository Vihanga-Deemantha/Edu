import { beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Test-only environment — set BEFORE any app module is imported by a test
// file, since a couple of modules (e.g. auth.routes.js's conditional Google
// route) read process.env at import time, not at request time.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRY = "15m";
process.env.JWT_REFRESH_EXPIRY = "7d";
process.env.BCRYPT_SALT_ROUNDS = "4"; // low cost factor — correctness, not production hashing strength
process.env.CORS_ORIGIN = "http://localhost:5173";
// GOOGLE_SIGNIN_ENABLED deliberately left unset: the /auth/google route
// requires a real Google ID token to verify, which isn't mockable here
// without pulling in google-auth-library internals — out of scope for this
// pass. Everything reachable without it is covered.

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

// Fresh DB state between tests — avoids one test's leftover user/OTP data
// changing another test's behavior (e.g. duplicate-email checks).
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
