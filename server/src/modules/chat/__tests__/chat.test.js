import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { io as ioClient } from "socket.io-client";
import app from "../../../app.js";
import { createHttpServer } from "../../../httpServer.js";
import TeacherVerification from "../../../models/TeacherVerification.js";
import User from "../../../models/User.js";
import { registerAndVerify, uniquePhone } from "../../../test/helpers.js";

let httpServer;
let port;

beforeAll(async () => {
  // A real listening server, not just the Express app — supertest can
  // exercise app.js without binding a port, but a WebSocket client can't.
  ({ httpServer } = createHttpServer(app));
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

const connectSocket = (accessToken) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false, // a failed auth test's socket must not keep silently retrying in the background for the rest of the file
    });
    // Waits for the server's "ready" (auto-join complete), not just
    // "connect" — otherwise sending a message right away legitimately
    // races the server's own room-join step (see chatSocket.js).
    socket.on("ready", () => resolve(socket));
    socket.on("connect_error", (err) => {
      socket.close();
      reject(err);
    });
  });

const waitForEvent = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const sendMessage = (socket, conversationId, text) =>
  new Promise((resolve) => socket.emit("send_message", { conversationId, text }, resolve));

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

const newTeacher = async () => registerAndVerify({ role: "teacher" });
const newStudent = async () => registerAndVerify({ role: "student" });

/** Mirrors admin.test.js's own helper — admin isn't reachable via public register. */
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
  return { userId: admin._id.toString(), accessToken: loginRes.body.data.accessToken };
};

const newParentWithChild = async () => {
  const parent = await registerAndVerify({ role: "parent" });
  const childRes = await request(app)
    .post("/api/auth/register-child")
    .set("Authorization", `Bearer ${parent.accessToken}`)
    .send({ name: "Little Kid", grade: "Grade 10", attestedGuardianship: true });
  return { parent, childId: childRes.body.data.child._id };
};

/** teacher + student, interest sent and accepted — returns both accounts and the resulting conversationId. */
const createAcceptedEngagement = async () => {
  const teacher = await newTeacher();
  const listing = await createListing(teacher.accessToken);
  const student = await newStudent();
  const sendRes = await request(app)
    .post("/api/interests")
    .set("Authorization", `Bearer ${student.accessToken}`)
    .send({ listingId: listing._id, message: "Hi." });

  const acceptRes = await request(app)
    .patch(`/api/interests/${sendRes.body.data.interestRequest._id}/respond`)
    .set("Authorization", `Bearer ${teacher.accessToken}`)
    .send({ status: "accepted" });

  return { teacher, student, conversationId: acceptRes.body.data.conversationId };
};

describe("Interest acceptance creates a conversation", () => {
  it("creates a conversation automatically when an interest is accepted, listed for both parties", async () => {
    const { teacher, student, conversationId } = await createAcceptedEngagement();
    expect(conversationId).toBeTruthy();

    const teacherList = await request(app)
      .get("/api/chat/conversations")
      .set("Authorization", `Bearer ${teacher.accessToken}`);
    const studentList = await request(app)
      .get("/api/chat/conversations")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(teacherList.body.data.conversations.map((c) => c._id)).toContain(conversationId);
    expect(studentList.body.data.conversations.map((c) => c._id)).toContain(conversationId);
  });
});

describe("Chat over a socket connection", () => {
  it("lets two accepted-interest parties exchange messages over a socket connection", async () => {
    const { teacher, student, conversationId } = await createAcceptedEngagement();

    const teacherSocket = await connectSocket(teacher.accessToken);
    const studentSocket = await connectSocket(student.accessToken);

    const received = waitForEvent(studentSocket, "new_message");
    const ack = await sendMessage(teacherSocket, conversationId, "Hello, glad to have you!");

    expect(ack.success).toBe(true);
    expect(ack.message.text).toBe("Hello, glad to have you!");

    const event = await received;
    expect(event.conversationId).toBe(conversationId);
    expect(event.message.text).toBe("Hello, glad to have you!");
    expect(event.message.senderId).toBe(teacher.userId);

    teacherSocket.disconnect();
    studentSocket.disconnect();
  });

  it("rejects a socket connection with no token", async () => {
    await expect(connectSocket(undefined)).rejects.toBeTruthy();
  });

  it("rejects a socket connection with an invalid token", async () => {
    await expect(connectSocket("not-a-real-token")).rejects.toBeTruthy();
  });

  it("handles a null send_message payload gracefully instead of crashing the server", async () => {
    // Regression test for a real bug: `async ({ conversationId, text } = {}, ack)`
    // — the `= {}` default only covers `undefined`, not `null`. Destructuring
    // `null` throws during argument binding, before the handler's own
    // try/catch ever runs; for an async listener that becomes an unhandled
    // promise rejection, which crashes the whole Node process (not just this
    // socket) on the default `--unhandled-rejections=throw` behavior. If this
    // regresses, this test — and every test after it in the whole suite —
    // would fail or hang, not just this one assertion, since the server
    // process itself would die.
    const { conversationId } = await createAcceptedEngagement();
    const teacher = (await createAcceptedEngagement()).teacher; // any authenticated socket works — this isn't about participancy
    const socket = await connectSocket(teacher.accessToken);

    const ack = await new Promise((resolve) => socket.emit("send_message", null, resolve));

    expect(ack.success).toBe(false);
    void conversationId; // not used by this null-payload case on purpose

    socket.disconnect();
  });

  it("handles a malformed conversationId gracefully without crashing", async () => {
    const teacher = (await createAcceptedEngagement()).teacher;
    const socket = await connectSocket(teacher.accessToken);

    const ack = await sendMessage(socket, "not-a-valid-object-id", "hi");

    expect(ack.success).toBe(false);

    socket.disconnect();
  });

  it("rejects sending a message to a conversation the sender isn't a participant in", async () => {
    const { conversationId } = await createAcceptedEngagement();
    const stranger = await newStudent();
    const strangerSocket = await connectSocket(stranger.accessToken);

    const ack = await sendMessage(strangerSocket, conversationId, "Let me in?");

    expect(ack.success).toBe(false);
    expect(ack.error.code).toBe("FORBIDDEN");

    strangerSocket.disconnect();
  });

  it("disconnects a user's live socket immediately when an admin suspends them", async () => {
    // Regression coverage for a real gap: authenticateSocket only checks a
    // token at the initial handshake, never again — so before this fix, an
    // admin suspending a user (meant to be "immediate session revocation")
    // left any already-open chat socket completely unaffected.
    const { teacher } = await createAcceptedEngagement();
    const admin = await newAdmin();
    const teacherSocket = await connectSocket(teacher.accessToken);
    const disconnected = waitForEvent(teacherSocket, "disconnect");

    const suspendRes = await request(app)
      .patch(`/api/admin/users/${teacher.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});
    expect(suspendRes.status).toBe(200);

    await expect(disconnected).resolves.toBeDefined();
  });

  it("delivers messages via the PARENT's socket for a child-linked conversation — the child has no account to connect with", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const { parent, childId } = await newParentWithChild();

    const sendRes = await request(app)
      .post("/api/interests")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ listingId: listing._id, message: "For my child.", targetUserId: childId });

    // Phase 0's verification gate (Phase 10B): a child-linked accept needs
    // a fully_verified teacher. Not the focus of this test, so satisfied
    // directly via the model rather than the full document-upload flow.
    await TeacherVerification.create({
      userId: teacher.userId,
      nicNumber: "199912345678",
      nicDocumentUrl: "https://example.com/nic.jpg",
      selfieWithIdUrl: "https://example.com/selfie.jpg",
      verificationTier: "fully_verified",
    });

    const acceptRes = await request(app)
      .patch(`/api/interests/${sendRes.body.data.interestRequest._id}/respond`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({ status: "accepted" });
    const conversationId = acceptRes.body.data.conversationId;
    expect(conversationId).toBeTruthy();

    const teacherSocket = await connectSocket(teacher.accessToken);
    const parentSocket = await connectSocket(parent.accessToken);

    const received = waitForEvent(parentSocket, "new_message");
    await sendMessage(teacherSocket, conversationId, "Happy to help your child!");
    const event = await received;

    expect(event.message.text).toBe("Happy to help your child!");

    teacherSocket.disconnect();
    parentSocket.disconnect();
  });
});

describe("GET /api/chat/conversations/:id/messages", () => {
  it("returns history in chronological order", async () => {
    const { teacher, student, conversationId } = await createAcceptedEngagement();
    const teacherSocket = await connectSocket(teacher.accessToken);

    await sendMessage(teacherSocket, conversationId, "First");
    await sendMessage(teacherSocket, conversationId, "Second");
    await sendMessage(teacherSocket, conversationId, "Third");
    teacherSocket.disconnect();

    const res = await request(app)
      .get(`/api/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages.map((m) => m.text)).toEqual(["First", "Second", "Third"]);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("rejects a non-participant", async () => {
    const { conversationId } = await createAcceptedEngagement();
    const stranger = await newStudent();

    const res = await request(app)
      .get(`/api/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent conversation", async () => {
    const student = await newStudent();

    const res = await request(app)
      .get("/api/chat/conversations/000000000000000000000000/messages")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("rejects a request with no token", async () => {
    const { conversationId } = await createAcceptedEngagement();
    const res = await request(app).get(`/api/chat/conversations/${conversationId}/messages`);
    expect(res.status).toBe(401);
  });
});
