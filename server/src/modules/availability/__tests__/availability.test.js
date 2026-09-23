import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { registerAndVerify } from "../../../test/helpers.js";

const newTeacher = async () => registerAndVerify({ role: "teacher" });
const newStudent = async () => registerAndVerify({ role: "student" });

const createAvailability = (token, overrides = {}) =>
  request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${token}`)
    .send({ dayOfWeek: 1, startTime: "16:00", endTime: "18:00", ...overrides });

describe("POST /api/availability", () => {
  it("lets a teacher create a recurring weekly window", async () => {
    const teacher = await newTeacher();

    const res = await createAvailability(teacher.accessToken);

    expect(res.status).toBe(201);
    expect(res.body.data.availability.dayOfWeek).toBe(1);
    expect(res.body.data.availability.startTime).toBe("16:00");
    expect(res.body.data.availability.endTime).toBe("18:00");
  });

  it("rejects a non-teacher", async () => {
    const student = await newStudent();

    const res = await createAvailability(student.accessToken);

    expect(res.status).toBe(403);
  });

  it("rejects endTime at or before startTime", async () => {
    const teacher = await newTeacher();

    const res = await createAvailability(teacher.accessToken, { startTime: "18:00", endTime: "16:00" });

    expect(res.status).toBe(422);
  });

  it("rejects a malformed HH:mm value", async () => {
    const teacher = await newTeacher();

    const res = await createAvailability(teacher.accessToken, { startTime: "4pm" });

    expect(res.status).toBe(422);
  });

  it("rejects an out-of-range dayOfWeek", async () => {
    const teacher = await newTeacher();

    const res = await createAvailability(teacher.accessToken, { dayOfWeek: 7 });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/availability/:teacherId", () => {
  it("is public — a guest can read a teacher's declared windows", async () => {
    const teacher = await newTeacher();
    await createAvailability(teacher.accessToken, { dayOfWeek: 1 });
    await createAvailability(teacher.accessToken, { dayOfWeek: 3, startTime: "10:00", endTime: "12:00" });

    const res = await request(app).get(`/api/availability/${teacher.userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(2);
  });

  it("returns an empty list for a teacher with no declared windows", async () => {
    const teacher = await newTeacher();

    const res = await request(app).get(`/api/availability/${teacher.userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toEqual([]);
  });
});

describe("DELETE /api/availability/:id", () => {
  it("lets a teacher delete their own window", async () => {
    const teacher = await newTeacher();
    const created = await createAvailability(teacher.accessToken);

    const res = await request(app)
      .delete(`/api/availability/${created.body.data.availability._id}`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/availability/${teacher.userId}`);
    expect(list.body.data.availability).toHaveLength(0);
  });

  it("rejects deleting another teacher's window", async () => {
    const teacher = await newTeacher();
    const otherTeacher = await newTeacher();
    const created = await createAvailability(teacher.accessToken);

    const res = await request(app)
      .delete(`/api/availability/${created.body.data.availability._id}`)
      .set("Authorization", `Bearer ${otherTeacher.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s deleting a window that doesn't exist", async () => {
    const teacher = await newTeacher();

    const res = await request(app)
      .delete("/api/availability/64b64b64b64b64b64b64b64b")
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(404);
  });
});
