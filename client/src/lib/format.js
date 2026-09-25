// Shared display helpers — labels for backend enums, money, dates, names.

export const MEDIUMS = [
  { value: "sinhala", label: "Sinhala" },
  { value: "tamil", label: "Tamil" },
  { value: "english", label: "English" },
];

export const CURRICULA = [
  { value: "local", label: "Local syllabus" },
  { value: "cambridge", label: "Cambridge" },
  { value: "edexcel", label: "Edexcel" },
];

export const CLASS_TYPES = [
  { value: "individual", label: "One-to-one" },
  { value: "group", label: "Group class" },
  { value: "online", label: "Online" },
  { value: "home_visit", label: "Home visits" },
];

export const SUBJECTS = [
  "Mathematics", "Combined Maths", "Physics", "Chemistry", "Biology", "Science",
  "English", "Sinhala", "Tamil", "ICT", "Accounting", "Economics",
  "Business Studies", "History", "Geography", "Music", "Art",
];

export const GRADES = [
  "Grade 1–5", "Grade 5 Scholarship", "Grade 6–9", "Grade 10–11 (O/L)",
  "A/L", "University", "Adult learners",
];

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const labelFrom = (list) => (value) => list.find((o) => o.value === value)?.label || value || "";
export const mediumLabel = labelFrom(MEDIUMS);
export const curriculumLabel = labelFrom(CURRICULA);
export const classTypeLabel = labelFrom(CLASS_TYPES);

export const roleLabel = (role) =>
  ({ teacher: "Teacher", student: "Student", parent: "Parent", admin: "Admin" })[role] || role || "";

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "";

const lkr = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });
export const formatNumber = (n) => lkr.format(Number(n) || 0);

/** "LKR 2,500 / hr" — or "" when a listing has no price. */
export const formatPrice = (price, { unit = true } = {}) => {
  if (!price || price.amount === undefined || price.amount === null) return "";
  const u = price.unit === "month" ? "month" : "hr";
  return `${price.currency || "LKR"} ${formatNumber(price.amount)}${unit ? ` / ${u}` : ""}`;
};

/** Stripe amounts are in the smallest unit (cents). */
export const formatMinorAmount = (amount, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(
      (amount || 0) / 100
    );
  } catch {
    return `${currency.toUpperCase()} ${((amount || 0) / 100).toFixed(2)}`;
  }
};

export const formatDate = (date, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  date ? new Date(date).toLocaleDateString("en-GB", opts) : "";

export const formatTime = (date) =>
  date ? new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase() : "";

export const formatDateTime = (date) =>
  date ? `${formatDate(date, { weekday: "short", day: "numeric", month: "short" })} · ${formatTime(date)}` : "";

export const relativeTime = (date) => {
  if (!date) return "";
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return formatDate(date);
};

/** "HH:mm" 24h → "4:00 pm" */
export const formatClock = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export const todayEyebrow = (date = new Date()) =>
  date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

/** The backend's error envelope → a user-facing message. */
export const apiError = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

export const apiErrorCode = (err) => err?.response?.data?.error?.code;

export const listingTitle = (listing) =>
  listing ? [listing.subject, listing.grade].filter(Boolean).join(" · ") : "";

export const pluralize = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;
