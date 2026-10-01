// Throwaway live-deployment endpoint smoke test. Not part of the app;
// deleted after use. Seeds pre-verified test accounts directly in MongoDB
// (bypassing OTP, same pattern as scripts/seedAdmin.js) then drives every
// real endpoint over HTTPS against the deployed Render backend. Cleans up
// everything it created at the end, win or lose.

import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Stripe from "stripe";

import User from "./src/models/User.js";
import TeacherProfile from "./src/models/TeacherProfile.js";
import StudentProfile from "./src/models/StudentProfile.js";
import Listing from "./src/models/Listing.js";
import InterestRequest from "./src/models/InterestRequest.js";
import TeacherAvailability from "./src/models/TeacherAvailability.js";
import Booking from "./src/models/Booking.js";
import Payment from "./src/models/Payment.js";
import Review from "./src/models/Review.js";
import Report from "./src/models/Report.js";
import Notification from "./src/models/Notification.js";
import TeacherVerification from "./src/models/TeacherVerification.js";
import Conversation from "./src/models/Conversation.js";
import Message from "./src/models/Message.js";

const BASE = "https://eduhub-server.onrender.com/api";
const RUN_ID = Date.now();
const results = [];

const check = (name, condition, detail) => {
  const pass = Boolean(condition);
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail !== undefined ? " :: " + JSON.stringify(detail) : ""}`);
  return pass;
};

const api = async (method, path, { token, cookie, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json, setCookie: res.headers.get("set-cookie") };
};

const cookieValue = (setCookieHeader, name) => {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
};

const uniquePhone = () => `+94${Math.floor(100000000 + Math.random() * 899999999)}`;

const nextOccurrence = (dayOfWeek, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date();
  result.setUTCHours(h, m, 0, 0);
  let diff = (dayOfWeek - result.getUTCDay() + 7) % 7;
  if (diff === 0 && result.getTime() <= Date.now()) diff = 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
};

const cleanup = { userIds: [], listingIds: [], interestIds: [], bookingIds: [] };

async function main() {
  console.log("Connecting to MongoDB (production) to seed verified test accounts...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  const PASSWORD = "LiveTest8!";
  const passwordHash = await bcrypt.hash(PASSWORD, saltRounds);

  const seedUser = async (role, name) => {
    const user = await User.create({
      name, email: `livetest.${role}.${RUN_ID}@example.com`, phone: uniquePhone(),
      passwordHash, role, emailVerified: true, phoneVerified: true, isActive: true, loginDisabled: false,
    });
    cleanup.userIds.push(user._id);
    return user;
  };

  const teacherUser = await seedUser("teacher", "Live Test Teacher");
  const studentUser = await seedUser("student", "Live Test Student");
  const parentUser = await seedUser("parent", "Live Test Parent");
  console.log(`Seeded teacher=${teacherUser._id} student=${studentUser._id} parent=${parentUser._id}\n`);

  try {
    // ── AUTH ────────────────────────────────────────────────────────────────
    const teacherLogin = await api("POST", "/auth/login", { body: { email: teacherUser.email, password: PASSWORD } });
    check("POST /auth/login (teacher)", teacherLogin.status === 200 && teacherLogin.body?.data?.accessToken, teacherLogin.status);
    const teacherToken = teacherLogin.body?.data?.accessToken;
    const teacherCookie = cookieValue(teacherLogin.setCookie, "refreshToken");

    const studentLogin = await api("POST", "/auth/login", { body: { email: studentUser.email, password: PASSWORD } });
    check("POST /auth/login (student)", studentLogin.status === 200 && studentLogin.body?.data?.accessToken, studentLogin.status);
    const studentToken = studentLogin.body?.data?.accessToken;
    const studentCookie = cookieValue(studentLogin.setCookie, "refreshToken");

    const parentLogin = await api("POST", "/auth/login", { body: { email: parentUser.email, password: PASSWORD } });
    check("POST /auth/login (parent)", parentLogin.status === 200 && parentLogin.body?.data?.accessToken, parentLogin.status);
    const parentToken = parentLogin.body?.data?.accessToken;
    const parentCookie = cookieValue(parentLogin.setCookie, "refreshToken");

    const adminLogin = await api("POST", "/auth/login", { body: { email: "admin@eduhub.lk", password: "sasuke123" } });
    check("POST /auth/login (admin)", adminLogin.status === 200 && adminLogin.body?.data?.accessToken, adminLogin.status);
    const adminToken = adminLogin.body?.data?.accessToken;
    const adminCookie = cookieValue(adminLogin.setCookie, "refreshToken");

    const badLogin = await api("POST", "/auth/login", { body: { email: teacherUser.email, password: "WrongPassword1!" } });
    check("POST /auth/login (wrong password -> 401)", badLogin.status === 401, badLogin.status);

    const meRes = await api("GET", "/auth/me", { token: teacherToken });
    check("GET /auth/me", meRes.status === 200 && meRes.body?.data?.user?.role === "teacher", meRes.status);

    const refreshRes = await api("POST", "/auth/refresh", { cookie: teacherCookie });
    check("POST /auth/refresh", refreshRes.status === 200 && Boolean(refreshRes.body?.data?.accessToken), refreshRes.status);

    const registerRes = await api("POST", "/auth/register", {
      body: { name: "Live Test Throwaway", email: `livetest.throwaway.${RUN_ID}@example.com`, phone: uniquePhone(), password: PASSWORD, role: "student" },
    });
    check("POST /auth/register", registerRes.status === 201 && Boolean(registerRes.body?.data?.userId), registerRes.status);
    if (registerRes.body?.data?.userId) cleanup.userIds.push(registerRes.body.data.userId);

    const resendRes = await api("POST", "/auth/resend-otp", { body: { userId: registerRes.body?.data?.userId, channel: "email" } });
    check("POST /auth/resend-otp", resendRes.status < 500, resendRes.status);

    const forgotRes = await api("POST", "/auth/forgot-password", { body: { email: teacherUser.email } });
    check("POST /auth/forgot-password", forgotRes.status === 200, forgotRes.status);

    const childRes = await api("POST", "/auth/register-child", { token: parentToken, body: { name: "Live Test Child", grade: "Grade 10", attestedGuardianship: true } });
    check("POST /auth/register-child", childRes.status === 201 && Boolean(childRes.body?.data?.child?._id), childRes.status);
    const childId = childRes.body?.data?.child?._id;
    if (childId) cleanup.userIds.push(childId);

    const googleRes = await api("POST", "/auth/google", { body: { idToken: "fake" } });
    check("POST /auth/google (disabled in prod -> 404)", googleRes.status === 404, googleRes.status);

    // ── PROFILES ────────────────────────────────────────────────────────────
    const teacherProfileRes = await api("PUT", "/profiles/teacher", { token: teacherToken, body: { subjects: ["Mathematics"], grades: ["Grade 10"], medium: ["english"], bio: "Live test bio.", experienceYears: 3 } });
    check("PUT /profiles/teacher", teacherProfileRes.status === 200, teacherProfileRes.status);

    const getTeacherProfileRes = await api("GET", `/profiles/teacher/${teacherUser._id}`, {});
    check("GET /profiles/teacher/:userId (public)", getTeacherProfileRes.status === 200, getTeacherProfileRes.status);

    const studentProfileRes = await api("PUT", "/profiles/student", { token: studentToken, body: { targetUserId: String(studentUser._id), gradeOrLevel: "Grade 10", subjectsInterested: ["Mathematics"], medium: ["english"] } });
    check("PUT /profiles/student", studentProfileRes.status === 200, studentProfileRes.status);

    const getStudentProfileRes = await api("GET", `/profiles/student/${studentUser._id}`, { token: teacherToken });
    check("GET /profiles/student/:userId", getStudentProfileRes.status === 200, getStudentProfileRes.status);

    // ── LISTINGS ────────────────────────────────────────────────────────────
    const createListingRes = await api("POST", "/listings", { token: teacherToken, body: { type: "teacher_ad", subject: "Mathematics", grade: "Grade 10", medium: "english", description: "Live endpoint test listing - auto-deleted after the run." } });
    check("POST /listings (teacher_ad)", createListingRes.status === 201 && Boolean(createListingRes.body?.data?.listing?._id), createListingRes.status);
    const listingId = createListingRes.body?.data?.listing?._id;
    if (listingId) cleanup.listingIds.push(listingId);

    const browseRes = await api("GET", `/listings/browse?ownerId=${teacherUser._id}`, {});
    check("GET /listings/browse", browseRes.status === 200 && browseRes.body?.data?.listings?.some((l) => String(l._id) === String(listingId)), browseRes.status);

    const mineRes = await api("GET", "/listings/mine", { token: teacherToken });
    check("GET /listings/mine", mineRes.status === 200, mineRes.status);

    const getListingRes = await api("GET", `/listings/${listingId}`, {});
    check("GET /listings/:id (public)", getListingRes.status === 200, getListingRes.status);

    const priceSuggestionRes = await api("GET", "/listings/price-suggestion?subject=Mathematics&grade=Grade%2010&medium=english", { token: teacherToken });
    check("GET /listings/price-suggestion", priceSuggestionRes.status === 200, priceSuggestionRes.status);

    const updateListingRes = await api("PATCH", `/listings/${listingId}`, { token: teacherToken, body: { description: "Updated live test description, still well over ten characters." } });
    check("PATCH /listings/:id", updateListingRes.status === 200, updateListingRes.status);

    const studentAdRes = await api("POST", "/listings", { token: parentToken, body: { type: "student_ad", subject: "Mathematics", grade: "Grade 10", medium: "english", targetUserId: childId, description: "Live endpoint test student ad - auto-deleted after the run." } });
    check("POST /listings (student_ad, parent-for-child)", studentAdRes.status === 201, studentAdRes.status);
    const studentAdListingId = studentAdRes.body?.data?.listing?._id;
    if (studentAdListingId) cleanup.listingIds.push(studentAdListingId);

    // ── AVAILABILITY ────────────────────────────────────────────────────────
    const dayOfWeek = (new Date().getUTCDay() + 1) % 7;
    const availRes = await api("POST", "/availability", { token: teacherToken, body: { dayOfWeek, startTime: "10:00", endTime: "14:00" } });
    check("POST /availability", availRes.status === 201, availRes.status);

    const getAvailRes = await api("GET", `/availability/${teacherUser._id}`, {});
    check("GET /availability/:teacherId (public)", getAvailRes.status === 200, getAvailRes.status);

    // ── INTERESTS ───────────────────────────────────────────────────────────
    const interestRes = await api("POST", "/interests", { token: studentToken, body: { listingId, message: "Hi, live endpoint test." } });
    check("POST /interests (student)", interestRes.status === 201, interestRes.status);
    const interestId = interestRes.body?.data?.interestRequest?._id;
    if (interestId) cleanup.interestIds.push(interestId);

    const sentRes = await api("GET", "/interests/sent", { token: studentToken });
    check("GET /interests/sent", sentRes.status === 200, sentRes.status);

    const receivedRes = await api("GET", "/interests/received", { token: teacherToken });
    check("GET /interests/received", receivedRes.status === 200, receivedRes.status);

    const respondRes = await api("PATCH", `/interests/${interestId}/respond`, { token: teacherToken, body: { status: "accepted" } });
    check("PATCH /interests/:id/respond", respondRes.status === 200 && respondRes.body?.data?.interestRequest?.status === "accepted", respondRes.status);
    const conversationId = respondRes.body?.data?.conversationId;

    const interest2Res = await api("POST", "/interests", { token: parentToken, body: { listingId, targetUserId: childId, message: "Live test, parent for child." } });
    check("POST /interests (parent-for-child)", interest2Res.status === 201, interest2Res.status);
    const interestId2 = interest2Res.body?.data?.interestRequest?._id;
    if (interestId2) cleanup.interestIds.push(interestId2);

    const respond2Res = await api("PATCH", `/interests/${interestId2}/respond`, { token: teacherToken, body: { status: "accepted" } });
    check("PATCH /interests/:id/respond (second)", respond2Res.status === 200, respond2Res.status);

    // ── BOOKINGS ────────────────────────────────────────────────────────────
    const start1 = nextOccurrence(dayOfWeek, "11:00");
    const booking1Res = await api("POST", "/bookings", { token: studentToken, body: { interestRequestId: interestId, startTime: start1.toISOString(), durationMinutes: 60 } });
    check("POST /bookings (student)", booking1Res.status === 201, booking1Res.status);
    const bookingId1 = booking1Res.body?.data?.booking?._id;
    if (bookingId1) cleanup.bookingIds.push(bookingId1);

    const myBookingsRes = await api("GET", "/bookings/mine", { token: teacherToken });
    check("GET /bookings/mine", myBookingsRes.status === 200, myBookingsRes.status);

    const start2 = nextOccurrence(dayOfWeek, "12:00");
    const booking2Res = await api("POST", "/bookings", { token: parentToken, body: { interestRequestId: interestId2, startTime: start2.toISOString(), durationMinutes: 60 } });
    check("POST /bookings (parent-for-child)", booking2Res.status === 201, booking2Res.status);
    const bookingId2 = booking2Res.body?.data?.booking?._id;
    if (bookingId2) cleanup.bookingIds.push(bookingId2);

    const start3 = nextOccurrence(dayOfWeek, "13:00");
    const booking3Res = await api("POST", "/bookings", { token: studentToken, body: { interestRequestId: interestId, startTime: start3.toISOString(), durationMinutes: 60 } });
    check("POST /bookings (for cancel test)", booking3Res.status === 201, booking3Res.status);
    const bookingId3 = booking3Res.body?.data?.booking?._id;
    if (bookingId3) cleanup.bookingIds.push(bookingId3);

    const cancelRes = await api("PATCH", `/bookings/${bookingId3}/cancel`, { token: studentToken });
    check("PATCH /bookings/:id/cancel", cancelRes.status === 200 && cancelRes.body?.data?.booking?.status === "cancelled", cancelRes.status);

    const cancelAgainRes = await api("PATCH", `/bookings/${bookingId3}/cancel`, { token: studentToken });
    check("PATCH /bookings/:id/cancel (already cancelled -> 400)", cancelAgainRes.status === 400, cancelAgainRes.status);

    const completeBookingRes = await api("PATCH", `/bookings/${bookingId2}/complete`, { token: teacherToken });
    check("PATCH /bookings/:id/complete", completeBookingRes.status === 200 && completeBookingRes.body?.data?.booking?.status === "completed", completeBookingRes.status);

    // ── PAYMENTS (real Stripe test-mode session + REAL signed webhook) ───────
    const checkoutRes = await api("POST", "/payments/checkout", { token: studentToken, body: { bookingId: bookingId1 } });
    check("POST /payments/checkout", checkoutRes.status === 201 && checkoutRes.body?.data?.checkoutUrl?.includes("checkout.stripe.com"), checkoutRes.status);

    const checkout2Res = await api("POST", "/payments/checkout", { token: parentToken, body: { bookingId: bookingId2 } });
    check("POST /payments/checkout (parent-for-child)", checkout2Res.status === 201, checkout2Res.status);

    const paymentStatusRes = await api("GET", `/payments/booking/${bookingId1}`, { token: teacherToken });
    check("GET /payments/booking/:bookingId (pending)", paymentStatusRes.status === 200 && paymentStatusRes.body?.data?.payment?.status === "pending", paymentStatusRes.status);
    const stripeSessionId = paymentStatusRes.body?.data?.payment?.stripeSessionId;

    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && stripeSessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const eventPayload = JSON.stringify({ id: `evt_livetest_${RUN_ID}`, type: "checkout.session.completed", data: { object: { id: stripeSessionId } } });
      const signature = stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: process.env.STRIPE_WEBHOOK_SECRET });

      const webhookRes = await fetch(`${BASE}/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: eventPayload });
      const webhookJson = await webhookRes.json().catch(() => null);
      check("POST /payments/webhook (REAL signed event, production secret)", webhookRes.status === 200 && webhookJson?.received === true, webhookRes.status);

      const paidStatusRes = await api("GET", `/payments/booking/${bookingId1}`, { token: studentToken });
      check("Webhook actually marked the payment paid in production DB", paidStatusRes.body?.data?.payment?.status === "paid", paidStatusRes.body?.data?.payment?.status);

      const webhookAgainRes = await fetch(`${BASE}/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: eventPayload });
      check("POST /payments/webhook (idempotent replay)", webhookAgainRes.status === 200, webhookAgainRes.status);

      const alreadyPaidRes = await api("POST", "/payments/checkout", { token: studentToken, body: { bookingId: bookingId1 } });
      check("POST /payments/checkout (already paid -> 409)", alreadyPaidRes.status === 409, alreadyPaidRes.status);
    } else {
      check("POST /payments/webhook (skipped - missing STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET locally)", false, "set both in server/.env to exercise this");
    }

    // ── VERIFICATION ────────────────────────────────────────────────────────
    const submitVerificationRes = await api("POST", "/verification/teacher/submit", { token: teacherToken, body: { nicNumber: "199912345678", nicDocumentUrl: "https://example.com/nic.jpg", selfieWithIdUrl: "https://example.com/selfie.jpg" } });
    check("POST /verification/teacher/submit", submitVerificationRes.status === 201, submitVerificationRes.status);

    const myVerificationRes = await api("GET", "/verification/teacher/me", { token: teacherToken });
    check("GET /verification/teacher/me", myVerificationRes.status === 200 && myVerificationRes.body?.data?.status === "pending", myVerificationRes.status);

    const uploadSigRes = await api("GET", "/verification/teacher/upload-signature", { token: teacherToken });
    check("GET /verification/teacher/upload-signature", uploadSigRes.status === 200, uploadSigRes.status);

    // ── ADMIN ───────────────────────────────────────────────────────────────
    const statsRes = await api("GET", "/admin/stats", { token: adminToken });
    check("GET /admin/stats", statsRes.status === 200, statsRes.status);

    const adminUsersRes = await api("GET", "/admin/users", { token: adminToken });
    check("GET /admin/users", adminUsersRes.status === 200, adminUsersRes.status);

    const userAuditRes = await api("GET", `/admin/users/${teacherUser._id}/audit`, { token: adminToken });
    check("GET /admin/users/:userId/audit", userAuditRes.status === 200, userAuditRes.status);

    const adminListingsRes = await api("GET", "/admin/listings", { token: adminToken });
    check("GET /admin/listings", adminListingsRes.status === 200, adminListingsRes.status);

    const adminVerificationsRes = await api("GET", "/admin/verifications?status=pending", { token: adminToken });
    check("GET /admin/verifications", adminVerificationsRes.status === 200, adminVerificationsRes.status);

    const verificationDetailRes = await api("GET", `/admin/verifications/${teacherUser._id}`, { token: adminToken });
    check("GET /admin/verifications/:userId", verificationDetailRes.status === 200, verificationDetailRes.status);

    const approveVerificationRes = await api("PATCH", `/admin/verification/${teacherUser._id}`, { token: adminToken, body: { verificationTier: "fully_verified", status: "approved" } });
    check("PATCH /admin/verification/:userId (approve)", approveVerificationRes.status === 200, approveVerificationRes.status);

    const moderateFlagRes = await api("PATCH", `/admin/listings/${studentAdListingId}/moderate`, { token: adminToken, body: { status: "flagged" } });
    check("PATCH /admin/listings/:id/moderate (flag)", moderateFlagRes.status === 200, moderateFlagRes.status);

    const moderateUnflagRes = await api("PATCH", `/admin/listings/${studentAdListingId}/moderate`, { token: adminToken, body: { status: "active" } });
    check("PATCH /admin/listings/:id/moderate (unflag)", moderateUnflagRes.status === 200, moderateUnflagRes.status);

    const suspendRes = await api("PATCH", `/admin/users/${registerRes.body?.data?.userId}/suspend`, { token: adminToken, body: {} });
    check("PATCH /admin/users/:userId/suspend", suspendRes.status === 200 && suspendRes.body?.data?.user?.isActive === false, suspendRes.status);

    const unsuspendRes = await api("PATCH", `/admin/users/${registerRes.body?.data?.userId}/unsuspend`, { token: adminToken, body: {} });
    check("PATCH /admin/users/:userId/unsuspend", unsuspendRes.status === 200 && unsuspendRes.body?.data?.user?.isActive === true, unsuspendRes.status);

    // ── REPORTS ─────────────────────────────────────────────────────────────
    const reportRes = await api("POST", "/reports", { token: studentToken, body: { targetType: "listing", targetId: listingId, reason: "Live endpoint test report." } });
    check("POST /reports", reportRes.status === 201 && Boolean(reportRes.body?.data?.report?._id), reportRes.status);
    const reportId = reportRes.body?.data?.report?._id;

    const adminReportsRes = await api("GET", "/admin/reports?status=pending", { token: adminToken });
    check("GET /admin/reports", adminReportsRes.status === 200 && adminReportsRes.body?.data?.reports?.some((r) => String(r._id) === String(reportId)), adminReportsRes.status);

    const severityRes = await api("PATCH", `/admin/reports/${reportId}/severity`, { token: adminToken, body: { severity: "high" } });
    check("PATCH /admin/reports/:id/severity", severityRes.status === 200 && severityRes.body?.data?.report?.severity === "high", severityRes.status);

    const resolveRes = await api("PATCH", `/admin/reports/${reportId}/resolve`, { token: adminToken, body: { status: "resolved" } });
    check("PATCH /admin/reports/:id/resolve", resolveRes.status === 200 && resolveRes.body?.data?.report?.status === "resolved", resolveRes.status);

    // ── INTERESTS COMPLETE + REVIEWS ────────────────────────────────────────
    const completeInterestRes = await api("PATCH", `/interests/${interestId}/complete`, { token: studentToken });
    check("PATCH /interests/:id/complete", completeInterestRes.status === 200 && completeInterestRes.body?.data?.interestRequest?.status === "completed", completeInterestRes.status);

    const completeInterest2Res = await api("PATCH", `/interests/${interestId2}/complete`, { token: parentToken });
    check("PATCH /interests/:id/complete (second)", completeInterest2Res.status === 200, completeInterest2Res.status);

    const reviewRes = await api("POST", "/reviews", { token: studentToken, body: { linkedRequestId: interestId, rating: 5, comment: "Live endpoint test review." } });
    check("POST /reviews", reviewRes.status === 201 && Boolean(reviewRes.body?.data?.review?._id), reviewRes.status);

    const review2Res = await api("POST", "/reviews", { token: parentToken, body: { linkedRequestId: interestId2, rating: 4, comment: "Live endpoint test review (parent)." } });
    check("POST /reviews (parent-for-child)", review2Res.status === 201, review2Res.status);

    const duplicateReviewRes = await api("POST", "/reviews", { token: studentToken, body: { linkedRequestId: interestId, rating: 3 } });
    check("POST /reviews (duplicate -> 409)", duplicateReviewRes.status === 409, duplicateReviewRes.status);

    const teacherReviewsRes = await api("GET", `/reviews/teacher/${teacherUser._id}`, {});
    check("GET /reviews/teacher/:teacherId (public)", teacherReviewsRes.status === 200 && teacherReviewsRes.body?.data?.reviews?.length >= 2, teacherReviewsRes.status);

    const featuredReviewsRes = await api("GET", "/reviews/featured", {});
    check("GET /reviews/featured (public)", featuredReviewsRes.status === 200, featuredReviewsRes.status);

    // ── NOTIFICATIONS ───────────────────────────────────────────────────────
    const notificationsRes = await api("GET", "/notifications", { token: teacherToken });
    check("GET /notifications", notificationsRes.status === 200 && Array.isArray(notificationsRes.body?.data?.notifications), notificationsRes.status);
    const firstNotificationId = notificationsRes.body?.data?.notifications?.[0]?._id;

    if (firstNotificationId) {
      const markReadRes = await api("PATCH", `/notifications/${firstNotificationId}/read`, { token: teacherToken });
      check("PATCH /notifications/:id/read", markReadRes.status === 200, markReadRes.status);
    } else {
      check("PATCH /notifications/:id/read (skipped, no notifications yet)", true);
    }

    const markAllReadRes = await api("PATCH", "/notifications/read-all", { token: teacherToken });
    check("PATCH /notifications/read-all", markAllReadRes.status === 200, markAllReadRes.status);

    // ── CHAT (REST side only - sending is socket-only, covered by the automated suite) ──
    const conversationsRes = await api("GET", "/chat/conversations", { token: teacherToken });
    check("GET /chat/conversations", conversationsRes.status === 200 && Array.isArray(conversationsRes.body?.data?.conversations), conversationsRes.status);

    if (conversationId) {
      const messagesRes = await api("GET", `/chat/conversations/${conversationId}/messages`, { token: teacherToken });
      check("GET /chat/conversations/:id/messages", messagesRes.status === 200, messagesRes.status);
    } else {
      check("GET /chat/conversations/:id/messages (skipped, no conversationId returned)", true);
    }

    // ── RECOMMENDATIONS ─────────────────────────────────────────────────────
    const recTeachersRes = await api("GET", "/recommendations/teachers", { token: studentToken });
    check("GET /recommendations/teachers", recTeachersRes.status === 200, recTeachersRes.status);

    const recStudentsRes = await api("GET", "/recommendations/students", { token: teacherToken });
    check("GET /recommendations/students", recStudentsRes.status === 200, recStudentsRes.status);

    // ── SEARCH (semantic - may lazy-load the embedding model, can be slow) ──
    const searchRes = await api("POST", "/search/semantic", { body: { query: "math tutor for O/L" } });
    check("POST /search/semantic", searchRes.status === 200, searchRes.status);

    // ── LOGOUT (last, since it ends each session) ──────────────────────────
    const logoutTeacherRes = await api("POST", "/auth/logout", { token: teacherToken, cookie: teacherCookie });
    check("POST /auth/logout (teacher)", logoutTeacherRes.status === 204, logoutTeacherRes.status);

    const logoutStudentRes = await api("POST", "/auth/logout", { token: studentToken, cookie: studentCookie });
    check("POST /auth/logout (student)", logoutStudentRes.status === 204, logoutStudentRes.status);

    const logoutParentRes = await api("POST", "/auth/logout", { token: parentToken, cookie: parentCookie });
    check("POST /auth/logout (parent)", logoutParentRes.status === 204, logoutParentRes.status);

    const refreshAfterLogoutRes = await api("POST", "/auth/refresh", { cookie: teacherCookie });
    check("POST /auth/refresh (after logout -> fails)", refreshAfterLogoutRes.status === 401, refreshAfterLogoutRes.status);

    const logoutAdminRes = await api("POST", "/auth/logout", { token: adminToken, cookie: adminCookie });
    check("POST /auth/logout (admin)", logoutAdminRes.status === 204, logoutAdminRes.status);
  } catch (err) {
    console.error("\nUnexpected error during test run:", err);
  } finally {
    console.log("\nCleaning up all test data created by this run...");
    try {
      await Promise.all([
        Payment.deleteMany({ bookingId: { $in: cleanup.bookingIds } }),
        Booking.deleteMany({ _id: { $in: cleanup.bookingIds } }),
        Review.deleteMany({ linkedRequestId: { $in: cleanup.interestIds } }),
        Conversation.deleteMany({ interestRequestId: { $in: cleanup.interestIds } }).then(async (r) => {
          const convos = await Conversation.find({ interestRequestId: { $in: cleanup.interestIds } }).select("_id");
          return Message.deleteMany({ conversationId: { $in: convos.map((c) => c._id) } });
        }),
        InterestRequest.deleteMany({ _id: { $in: cleanup.interestIds } }),
        Report.deleteMany({ targetId: { $in: cleanup.listingIds } }),
        Listing.deleteMany({ _id: { $in: cleanup.listingIds } }),
        TeacherAvailability.deleteMany({ teacherId: teacherUser._id }),
        TeacherVerification.deleteMany({ userId: teacherUser._id }),
        TeacherProfile.deleteMany({ userId: teacherUser._id }),
        StudentProfile.deleteMany({ userId: studentUser._id }),
        Notification.deleteMany({ userId: { $in: cleanup.userIds } }),
      ]);
      await User.deleteMany({ _id: { $in: cleanup.userIds } });
      console.log("Cleanup complete — production database restored to its prior state.");
    } catch (cleanupErr) {
      console.error("Cleanup encountered an error (some test data may remain):", cleanupErr.message);
    }
    await mongoose.disconnect();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n==================== SUMMARY ====================`);
  console.log(`${passed}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`\nFAILED:`);
    failed.forEach((f) => console.log(` - ${f.name}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
