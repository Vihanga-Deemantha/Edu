import axiosInstance from "./axiosInstance.js";

// Every backend response is `{ success, data }` — unwrap to `data` once here
// so pages deal only in the payload.
const data = (request) => request.then((res) => res.data.data);

const get = (url, params) => data(axiosInstance.get(url, { params }));
const post = (url, body) => data(axiosInstance.post(url, body));
const put = (url, body) => data(axiosInstance.put(url, body));
const patch = (url, body) => data(axiosInstance.patch(url, body));
const del = (url) => data(axiosInstance.delete(url));

export const listingsApi = {
  browse: (params) => get("/listings/browse", params),
  get: (id) => get(`/listings/${id}`),
  mine: () => get("/listings/mine"),
  create: (body) => post("/listings", body),
  update: (id, body) => patch(`/listings/${id}`, body),
  close: (id) => del(`/listings/${id}`),
  priceSuggestion: (params) => get("/listings/price-suggestion", params),
};

export const searchApi = {
  semantic: (body) => post("/search/semantic", body),
};

export const profilesApi = {
  getTeacher: (userId) => get(`/profiles/teacher/${userId}`),
  upsertTeacher: (body) => put("/profiles/teacher", body),
  getStudent: (userId) => get(`/profiles/student/${userId}`),
  upsertStudent: (body) => put("/profiles/student", body),
};

export const verificationApi = {
  me: () => get("/verification/teacher/me"),
  submit: (body) => post("/verification/teacher/submit", body),
  uploadSignature: () => get("/verification/teacher/upload-signature"),
  documentUrl: (userId, field) => get(`/verification/document/${userId}/${field}`),
};

export const notificationsApi = {
  list: (params) => get("/notifications", params),
  markRead: (id) => patch(`/notifications/${id}/read`),
  markAllRead: () => patch("/notifications/read-all"),
};

export const interestsApi = {
  create: (body) => post("/interests", body),
  sent: (params) => get("/interests/sent", params),
  received: (params) => get("/interests/received", params),
  respond: (id, status) => patch(`/interests/${id}/respond`, { status }),
  complete: (id) => patch(`/interests/${id}/complete`),
};

export const reviewsApi = {
  create: (body) => post("/reviews", body),
  forTeacher: (teacherId, params) => get(`/reviews/teacher/${teacherId}`, params),
};

export const reportsApi = {
  create: (body) => post("/reports", body),
};

export const chatApi = {
  conversations: () => get("/chat/conversations"),
  messages: (conversationId, params) => get(`/chat/conversations/${conversationId}/messages`, params),
};

export const availabilityApi = {
  forTeacher: (teacherId) => get(`/availability/${teacherId}`),
  create: (body) => post("/availability", body),
  remove: (id) => del(`/availability/${id}`),
};

export const bookingsApi = {
  create: (body) => post("/bookings", body),
  mine: (params) => get("/bookings/mine", params),
  cancel: (id) => patch(`/bookings/${id}/cancel`),
  complete: (id) => patch(`/bookings/${id}/complete`),
};

export const paymentsApi = {
  checkout: (bookingId) => post("/payments/checkout", { bookingId }),
  forBooking: (bookingId) => get(`/payments/booking/${bookingId}`),
};

export const recommendationsApi = {
  teachers: (params) => get("/recommendations/teachers", params),
  students: (params) => get("/recommendations/students", params),
};

export const adminApi = {
  stats: (params) => get("/admin/stats", params),
  verifications: (params) => get("/admin/verifications", params),
  verification: (userId) => get(`/admin/verifications/${userId}`),
  reviewVerification: (userId, body) => patch(`/admin/verification/${userId}`, body),
  users: (params) => get("/admin/users", params),
  userAudit: (userId) => get(`/admin/users/${userId}/audit`),
  suspendUser: (userId, adminNotes) => patch(`/admin/users/${userId}/suspend`, { adminNotes }),
  unsuspendUser: (userId, adminNotes) => patch(`/admin/users/${userId}/unsuspend`, { adminNotes }),
  listings: (params) => get("/admin/listings", params),
  moderateListing: (id, body) => patch(`/admin/listings/${id}/moderate`, body),
  reports: (params) => get("/admin/reports", params),
  resolveReport: (id, body) => patch(`/admin/reports/${id}/resolve`, body),
};
