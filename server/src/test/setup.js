import { beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Global safety net, not per-file: as of Phase 10B, interests.controller.js
// (and every future module that fires a notification — Phase 11B's reviews,
// etc.) imports queues/notification.queue.js directly, which imports
// config/redis.js, which opens a real ioredis connection at module load
// time. Without this, EVERY test file that imports app.js — which is nearly
// all of them — would attempt a real Redis connection the moment it's
// collected, not just the tests that actually exercise notifications. A test
// file that needs finer-grained control over the queue (see
// queues/__tests__/notification.queue.test.js) can still declare its own
// vi.mock() for these same specifiers — a local mock overrides this global
// one for that file only.
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn().mockResolvedValue({ id: "mock-job-id" }) })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));

vi.mock("../config/redis.js", () => ({
  redisConnection: {},
}));

// Phase 16's real embedding model (services/embedding.service.js) downloads
// and runs an actual ONNX model — multiple seconds on first use, and
// listings.service.js calls it on every listing create/update, so nearly
// every test file would pay that cost without this. Deterministic and fast
// instead: a tiny bag-of-words hash "embedding," not a real one — it can't
// capture actual meaning, but two texts sharing words DO get a
// meaningfully higher cosine similarity than two that share none, which is
// enough for tests that check ranking/comparison logic actually works
// against SOME vector. Real semantic quality was verified live against the
// real model during implementation, not something this mock can stand in
// for.
const seededWordVector = (word, dims) => {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: dims }, () => next() * 2 - 1);
};

const seededEmbedding = (text, dims = 384) => {
  const words = String(text).toLowerCase().match(/[a-z0-9]+/g) || ["_empty_"];
  const sum = new Array(dims).fill(0);
  for (const word of words) {
    const wordVec = seededWordVector(word, dims);
    for (let i = 0; i < dims; i++) sum[i] += wordVec[i];
  }
  const norm = Math.sqrt(sum.reduce((s, v) => s + v * v, 0)) || 1;
  return sum.map((v) => v / norm);
};

vi.mock("../services/embedding.service.js", () => ({
  EMBEDDING_DIMENSIONS: 384,
  embedPassage: (text) => Promise.resolve(seededEmbedding(text)),
  embedQuery: (text) => Promise.resolve(seededEmbedding(text)),
  warmUpEmbeddingModel: () => Promise.resolve(),
}));

// Phase 18B's Stripe integration — mocked at the same config/*.js boundary
// as Redis above, not the `stripe` package itself, so payments.service.js
// and payments.controller.js run their real logic against a fake client
// that mimics just the two calls they make. A single shared object (not a
// fresh literal per call) so payments.test.js can import getStripeClient()
// itself and override webhooks.constructEvent for one call — e.g. to
// simulate a signature-verification failure — and have the controller's
// own later call see that same override. constructEvent otherwise just
// parses the raw body, since there's no real Stripe secret in tests to sign
// a real payload against.
const mockStripeClient = {
  checkout: {
    sessions: {
      create: vi.fn().mockImplementation(async ({ metadata }) => ({
        id: `cs_test_${Math.random().toString(36).slice(2)}`,
        url: `https://checkout.stripe.com/test/${metadata?.bookingId || "session"}`,
      })),
    },
  },
  webhooks: {
    constructEvent: vi.fn((rawBody) => JSON.parse(rawBody.toString())),
  },
};

vi.mock("../config/stripe.js", () => ({
  getStripeClient: () => mockStripeClient,
}));

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
process.env.CLIENT_URL = "http://localhost:5173";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
process.env.TRIAL_DEPOSIT_AMOUNT_CENTS = "1000";
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
