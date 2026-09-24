# EduHub — Frontend Page Inventory (Phase 3 → 19F)

### Full design brief for every page not yet built, for use with a design tool

The entire backend (Phases 2 through 19B) is built, tested, and audited. This document inventories every remaining frontend page — what it's for, who sees it, what it shows, what a person can do on it, and what states it needs to handle. It's written for **design**, not implementation: no component code, no state management, just what needs to exist on screen and why. Hand this to a design tool page by page, or all at once for a full site pass.

It extends [phase-1-upgrade-theme-landing-otp-google-spec.md](phase-1-upgrade-theme-landing-otp-google-spec.md) rather than replacing it — the design system below is a compressed recap of that doc, which stays the source of truth for anything not repeated here.

---

## 1. Design System — Quick Reference

**Concept**: a noticeboard. Teachers pin ads, students browse them. Warm, trustworthy, not generic SaaS.

**Colors** (CSS custom properties, mapped into Tailwind — never hardcode hex in a component):

| Token | Hex | Use |
|---|---|---|
| `chalkboard` | `#22463B` | primary — nav, headers, primary buttons |
| `paper` | `#FFF6ED` | page background |
| `ink` | `#1E2A32` | body text |
| `marigold` | `#F9A03F` | secondary accent — highlights, badges, hover |
| `coral` | `#FF6B5B` | primary CTAs ("Sign up," "Post an ad," "Express Interest") |
| `skyline` | `#4FA9E0` | trust/safety — verified badges, parent-safety callouts |

**Typography**: `Baloo 2` for headlines (large sizes only, used sparingly), `Plus Jakarta Sans` for body/UI text. Both stacks already include `Noto Sans Sinhala`/`Noto Sans Tamil` fallbacks — Phase 19F's language toggle needs no font-stack changes, just content swapping.

**Signature element — the pinned card**: every listing, teacher profile summary, and (new, this doc) booking/availability slot renders as an index-card component, resting tilted 1–2°, alternating direction per card in a grid, with a washi-tape-corner decoration (CSS, not an image). Hover: straightens to 0°, lifts (`translateY` + shadow), ~150ms ease-out. This is the one place for visual boldness — everything else stays calm around it. Respect `prefers-reduced-motion`: no tilt, no hover animation, cards render flat.

**Motion**: hover lift/straighten on cards, one gentle fade-up on scroll-into-view, nothing more.

**New surfaces this doc introduces that need their own visual treatment** (not covered by the pinned-card motif, since they're not listings):
- **Status badges** — a small set of pill/chip states reused everywhere: `pending` (marigold), `accepted`/`confirmed`/`active` (chalkboard or a success green if you introduce one), `declined`/`cancelled`/`flagged` (a muted red, not full-alarm coral — coral is reserved for CTAs), `completed` (skyline or a neutral gray). Define these once, reuse everywhere — Interests, Bookings, Listings, Reports, Payments, and Reviews-moderation all need the same visual language for "what state is this in."
- **Verified badge** — already implied by the trust & safety section on the landing page (skyline). Two tiers: `id_verified` (outline/lighter) and `fully_verified` (filled, more prominent — this is the one that matters for child-linked bookings). Needs a compact form (small icon+label on a pinned card) and an expanded form (with explanation, on the full profile page).
- **Star rating display** — read-only (avgRating, on profile/cards) and interactive input (leaving a review). Keep it simple: five marigold stars, partial-fill for averages.

---

## 2. Complete Sitemap

Existing (Phase 0/1, already built — listed for context only):

```
/                     LandingPage (public)
/register             RegisterPage (public)
/login                LoginPage (public)
/verify-otp           VerifyOtpPage (public)
/complete-profile     CompleteProfilePage (protected, profile_incomplete)
/forgot-password      ForgotPasswordPage (public)
/reset-password       ResetPasswordPage (public)
/dashboard            DashboardPage (protected — grows substantially across this doc's phases)
/children             ChildAccountPage (protected, parent)
```

New, this document:

```
Phase 3 — Profiles
/profile/edit                    ProfileEditPage (protected — teacher or student/parent variant)
/teachers/:userId                PublicTeacherProfilePage (public)
/verification                    TeacherVerificationPage (protected, teacher)

Phase 5 — Listings
/listings/new                    PostListingPage (protected)
/listings/:id/edit               PostListingPage (edit mode, same component)
/listings/mine                   MyListingsPage (protected)

Phase 6F — Browse & Search
/browse                          BrowsePage (public)
/listings/:id                    ListingDetailPage (visibility-gated)

Phase 9F — Notifications
/notifications                   NotificationsPage (protected)
                                  + NotificationBell (persistent, in Navbar)

Phase 10F — Interests
/interests                       InterestsPage (protected, Sent/Received tabs)

Phase 11F — Reviews
                                  (no standalone page — review form + list live inside
                                   InterestsPage/BookingsPage and PublicTeacherProfilePage)

Phase 13F — Chat
/chat                             ConversationsListPage (protected)
/chat/:conversationId             ChatWindowPage (protected)

Phase 15 — Admin
/admin                            AdminDashboardPage (protected, admin)
/admin/verification                VerificationQueuePage (protected, admin)
/admin/reports                     ReportsQueuePage (protected, admin)
/admin/users                       UserManagementPage (protected, admin)
/admin/listings                    ListingModerationPage (protected, admin)

Phase 17F — Booking
/availability                     AvailabilityPage (protected, teacher)
/bookings                         MyBookingsPage (protected)

Phase 18F — Payments
                                   (no standalone checkout page — redirects to Stripe-hosted
                                    Checkout, returns to MyBookingsPage)
/bookings?payment=success          → MyBookingsPage, success toast/banner
/bookings?payment=cancelled        → MyBookingsPage, cancelled toast/banner

Phase 19F — Multi-language
                                   (no new routes — a persistent LanguageSwitcher in
                                    Navbar/footer, i18next wiring across every page above)
```

---

## 3. Shared / Global Elements

These aren't pages, but every page below assumes they exist — design them first.

### 3.1 Navbar (extends the existing one)
Currently: logo, auth-aware links, presumably a basic account menu. Needs to grow, role-aware:
- **Guest**: Browse, Login, Sign up (coral CTA)
- **Student/Parent**: Browse, Dashboard, Interests, Chat (with unread dot), Bookings, Notification bell, account menu (Profile, Children — parent only, Logout)
- **Teacher**: Browse, Dashboard, My Listings, Interests, Chat (unread dot), Availability, Bookings, Notification bell, account menu (Profile, Verification status badge, Logout)
- **Admin**: a distinct, simpler nav — Admin Dashboard, Verification Queue, Reports, Users, Listings, Logout. Admins don't need the marketplace-browsing nav at all.
- Mobile: collapses to a hamburger/drawer — this nav has real breadth by Phase 17F, budget for it now rather than retrofitting.

### 3.2 NotificationBell
Icon in the navbar, unread-count badge, click opens a dropdown (last 5–8, "Mark all read," "View all" → `/notifications`). Polling or reasonable refresh interval, not real-time (that's chat's job, not notifications').

### 3.3 LanguageSwitcher (Phase 19F)
Three-way toggle (Sinhala / Tamil / English), navbar and footer. Persists the choice (local storage is fine — this is a per-viewer UI preference, not account data). Design it now even though it activates last — the nav layout in 3.1 should already reserve space for it.

### 3.4 EmptyState pattern
Every list page below (My Listings, Interests, Bookings, Notifications, Reviews, Chat) needs a designed empty state — not a bare "No X found" line. One reusable pattern: a small illustration or icon, one sentence explaining why it's empty, one CTA where relevant ("Post your first listing," "Browse teachers to get started").

### 3.5 Status badge set
See §1 — design once, apply everywhere a `status` enum is shown.

### 3.6 Verified badge
See §1 — compact (card) and expanded (profile) forms.

---

## 4. Phase 3 — Profiles

### 4.1 ProfileEditPage — `/profile/edit`
**Access**: protected. Renders a different form depending on `user.role` — no visible type selector, derive it silently.

**Teacher variant** — backed by `PUT /api/profiles/teacher`:
- Multi-select: Subjects, Grades, Medium (sinhala/tamil/english), Curriculum (local/cambridge/edexcel), Class Type (individual/group/online/home_visit)
- Bio (textarea, 1000 char max, live counter) — plus, once Phase 19F content fields matter, optional Sinhala/Tamil bio fields (`bio_si`/`bio_ta`) as collapsible "add a translation" sections, not forced up front
- Qualifications (repeatable text list — "add another")
- Experience (years, number input)
- Location (map click or "use my location" — simple pin-drop, no full geocoding UI)
- Photo URL / intro video URL (simple URL fields unless a real upload flow exists elsewhere)
- Verification status shown read-only (badge + "Get verified" link to `/verification` if not yet submitted)
- Save button — this is an upsert, so first-time vs. editing is the same form, just pre-filled

**Student/Parent variant** — backed by `PUT /api/profiles/student`:
- Grade/level, Subjects interested (multi-select or tag input), Medium, Location
- For a parent: a **child selector** at the top if they have multiple linked children (reuse whatever pattern `/children` already established) — editing always targets one specific child's profile, never the parent's own

### 4.2 PublicTeacherProfilePage — `/teachers/:userId`
**Access**: public. This is the single most important "sales" page in the product — a stranger deciding whether to trust this teacher with their child.

Sections, in order:
1. **Header**: photo, name, verified badge (expanded form), subjects/grades/medium as tags, star rating + review count (or "No reviews yet" — never a broken 0-star widget), location (distance if the viewer has location), a prominent coral "Express Interest" CTA (disabled/tooltip-explained if the viewer is looking at their own profile)
2. **About**: bio (localized per §3.3 once 19F lands), experience years, qualifications list
3. **Active listings**: this teacher's current teacher_ad listings as pinned cards (grid)
4. **Availability preview** (Phase 17F data, `GET /api/availability/:teacherId`): a compact weekly-grid showing declared windows — not bookable from here directly (booking requires an accepted interest first), just a trust/planning signal: "this teacher is generally free Mon/Wed evenings"
5. **Reviews**: paginated list (rating, comment, date — reviewer identity is deliberately never shown, per the backend's data-minimization rule) + the aggregate rating from the header, repeated near the CTA at the bottom for a second conversion point

### 4.3 TeacherVerificationPage — `/verification`
**Access**: protected, teacher only. A focused, single-purpose page — this isn't a marketplace page, it's a trust-and-safety form, so keep it calm and clear, not decorated with pinned cards.
- Explains the two tiers (`id_verified`, `fully_verified`) and why they matter (child-safety gate on accepting a child-linked interest)
- Upload fields: NIC/ID document, selfie-with-ID, (for full tier) police clearance or equivalent
- Submission status: `none` → form; `pending` → "under review" state with submission date; `approved`/`rejected` → result, with admin notes shown if rejected and a way to resubmit

---

## 5. Phase 5 — Listings

### 5.1 PostListingPage — `/listings/new` and `/listings/:id/edit`
**Access**: protected. Same component, edit mode pre-fills and calls PATCH instead of POST. Role-aware fields, no type selector — a teacher gets teacher_ad fields, a student/parent gets student_ad fields (parent gets a child selector first, same pattern as §4.1).

Fields: Subject, Grade, Medium, Curriculum (optional), Price (amount + unit: hour/month — currency is always LKR, shown not asked), Schedule (free-text slots — simple repeatable tag input, not a calendar; real scheduling is Phase 17F's job), Description (min 10 / max 2000 chars, live counter), optional Sinhala/Tamil description fields (same collapsible pattern as §4.1's bio), Location (reuse the profile's picker, defaults to the poster's own profile location but overridable).

States: draft/validation errors inline per field, a clear distinction between "Post" (create) and "Save changes" (edit), a "Close this listing" action available only in edit mode (soft-delete, not destructive-looking — this isn't a delete button, style it as a status change).

### 5.2 MyListingsPage — `/listings/mine`
**Access**: protected. List of the caller's own listings regardless of status (unlike Browse, which only shows active ones to others). Pinned-card grid or a denser list view — given this is a management page, not a discovery one, a denser row-based layout (still using the status-badge/verified-badge visual language) may serve better than full pinned cards; a simpler compact card if you want visual consistency with Browse.
- Status badge per listing (active/closed/flagged — flagged shows *why*, if admin notes are surfaced)
- Edit / Close actions per row
- Empty state: "You haven't posted anything yet" + CTA to `/listings/new`

---

## 6. Phase 6F — Browse & Search

### 6.1 BrowsePage — `/browse`
**Access**: public (guests see exactly what a logged-in student sees — never gate this page behind auth).

This page now does double duty — Phase 6B's structured browse AND Phase 16's semantic search share one backend filter, so they should share one page:
- **Search bar** at the top: natural-language input ("O/L maths tutor near Kandy, weekends only") — calls `POST /api/search/semantic` when non-empty, plain `GET /api/listings/browse` when empty. The user shouldn't need to know these are different endpoints; it's one search experience with structured filters layered on top of either mode.
- **Filter sidebar/bar**: Subject, Grade, Medium, Curriculum, Price range, Location + radius ("near me," needs geolocation permission prompt), Sort (price / distance / newest / rating / recommended)
- **Results grid**: pinned cards. When results came from semantic search, each card can show a short "why this matched" snippet if the backend's explainer text is present — otherwise omit it, don't fabricate one client-side
- **Empty/no-results state**: distinct from loading, with a suggestion to broaden filters
- **Loading skeletons**: this is the page where network latency is most visible (filters change rapidly) — real skeleton cards, not a spinner
- **Pagination**: standard page controls, total count shown

### 6.2 ListingDetailPage — `/listings/:id`
**Access**: visibility-gated server-side (a `student_ad` viewed by a non-teacher 404s — design the "not found" state to look intentional, not broken, since it's also what a genuinely-deleted listing shows).

- Full listing details: all fields from §5.1's form, read-only, plus poster info (mini teacher-profile card linking to §4.2, or mini student-profile summary for a student_ad, shown only to the teachers who can see it at all)
- Price displayed prominently (LKR, per hour/month)
- Full schedule, description (localized per Phase 19F)
- Map/location if present
- **Express Interest** CTA (coral, primary) — opens the modal in §7.1
- If the viewer already has a pending/accepted interest on this listing, show that state instead of the CTA ("Interest sent — awaiting response" / "Accepted — go to chat")

---

## 7. Phase 9F — Notifications

### 7.1 NotificationsPage — `/notifications`
**Access**: protected. Full paginated history, unread-first (matches the backend's own sort). Each row: icon by type, message text, relative timestamp, read/unread visual state (unread = slightly bolder or a marigold dot), click marks read and deep-links to the relevant page (a new interest → `/interests`, a new review → own profile, etc.).
- "Mark all as read" action
- Empty state: "You're all caught up"

(NotificationBell itself is specified in §3.2 — this page is its "view everything" overflow.)

---

## 8. Phase 10F — Interests

### 8.1 Express Interest flow
A modal/drawer (not a full page — it's a short, single-action flow), triggered from `ListingDetailPage` or `PublicTeacherProfilePage`:
- A short message field (required, this becomes the `message` field on the request)
- For a parent acting on a teacher_ad: a **child selector** first (which linked child is this for)
- Submit → success state ("Sent! You'll be notified when they respond") → closes back to the listing with its new "pending" state visible

### 8.2 InterestsPage — `/interests`
**Access**: protected. Two tabs: **Sent** and **Received** (symmetric, same visual treatment, different actions available).

Each row/card: the other party's name (or "a family" for a still-pending child-linked one, since contact isn't revealed yet), the listing/subject, the message, status badge, timestamp.

- **Received, pending**: Accept / Decline actions. If accepting a child-linked request from a non-fully-verified account, the Accept button should be visibly disabled with an inline explanation ("Requires full verification — see `/verification`") rather than a failed-request surprise after clicking.
- **Accepted (either tab)**: reveals contact info (name/email/phone — always the parent's for a child-linked side, per the backend rule) AND a "Go to chat" link (Phase 13F) AND, once Phase 17F is live, a "Book a trial session" CTA
- **Completed**: same as accepted, plus (Phase 11F) a "Leave a review" CTA if the viewer is the eligible reviewing side and hasn't already
- **Declined**: shown plainly, no actions, muted styling
- Empty state per tab, independently ("No interests sent yet — browse teachers to get started" / "No interests received yet")

---

## 9. Phase 11F — Reviews

No standalone page. Two pieces of UI, both hosted inside pages already specified above:

### 9.1 Review submission
A small form (star input 1–5, comment textarea, max 1000 chars) surfacing as a CTA on a `completed` interest in `InterestsPage` (§8.2) — only visible to the eligible reviewer, only once. Submitting shows immediate confirmation and the CTA is replaced with "You reviewed this" (no edit — the backend doesn't support review edits, so don't design a UI that implies it can).

### 9.2 Reviews display
Already specified in `PublicTeacherProfilePage` §4.2 — paginated list + aggregate rating, reviewer identity never shown.

---

## 10. Phase 13F — Chat

### 10.1 ConversationsListPage — `/chat`
**Access**: protected. List of conversations, newest-activity-first (matches backend sort). Each row: other party's name, last message preview, relative timestamp, unread indicator. Click → `/chat/:conversationId`.
- Empty state: "No conversations yet — they start automatically once an interest is accepted"

### 10.2 ChatWindowPage — `/chat/:conversationId`
**Access**: protected, participant-gated (backend 403s a non-participant — design a clear "you don't have access to this conversation" state for that case, since a stale/shared link could hit it).
- Standard thread layout: messages left/right by sender, timestamps, auto-scroll to newest, a composer at the bottom
- Real-time delivery via the existing socket connection — new messages append live, no manual refresh
- For a child-linked conversation: no special UI needed, the parent's own account is simply the participant (this is already resolved server-side)
- Loading state while history paginates in; "send failed, retry" state for a message whose ack comes back `success: false`

---

## 11. Phase 15 — Admin

Distinct visual register from the rest of the app — this is an operations console, not the marketplace. Keep the pinned-card motif OUT of admin pages entirely; use plain tables/lists with clear, dense information density. The `chalkboard`/`paper`/`ink` palette still applies, but skip `coral`/`marigold` decoration — admin needs to feel serious and fast to scan, not warm and inviting.

### 11.1 AdminDashboardPage — `/admin`
Landing page for admins. Aggregate stats and charts from `Event`/`Listing`/`InterestRequest` data: most-requested subjects, busiest regions, supply/demand gaps (subject-demand vs. teacher-supply comparison), pending-queue counts (verification, reports) as at-a-glance cards linking to their respective queues. A thin version (counts only, no trend charts) is a legitimate first pass if the full analytics build is a separate later effort.

### 11.2 VerificationQueuePage — `/admin/verification`
List of pending `TeacherVerification` submissions. Each row expands to: submitted documents (image viewer — these are sensitive, no thumbnail grid on the list view, only on click-through), NIC number, submission date. Actions: set tier (none/id_verified/fully_verified) + approve/reject + admin notes field. Approved/rejected history should remain viewable (filter by status), not just the pending queue.

### 11.3 ReportsQueuePage — `/admin/reports`
List of reports (target type: review/listing/user, reason, status, reporter — filterable by status, pending-first). Click-through shows the reported content inline (the actual review text, listing, or user summary) so the admin doesn't need a second tab to judge it. Actions: resolve / dismiss + admin notes.

### 11.4 UserManagementPage — `/admin/users`
Search/list users (by name/email, filterable by role and active status). Per-user: role, active status, verification tier if a teacher, join date. Actions: **Suspend** (with a required reason/notes field — this immediately ends their sessions, including any live chat connection, so the confirmation copy should say so plainly) and **Unsuspend** (reverses it — this is a real, symmetric action now, not a one-way switch). An audit trail link/expansion per user showing past admin actions against them would close the loop nicely, backed by the existing `AuditLog` collection.

### 11.5 ListingModerationPage — `/admin/listings`
Search/filter listings (by status, including `flagged`). Actions: flag / restore to active, with admin notes. Could be folded into `ReportsQueuePage` when the report's target is a listing rather than existing as a fully separate page — design whichever reads as less duplicative once you see both together; the backend supports either.

---

## 12. Phase 17F — Booking

### 12.1 AvailabilityPage — `/availability`
**Access**: protected, teacher only. A weekly-grid editor (Mon–Sun columns, hour rows or a simpler "add a window" list — a full drag-to-select calendar grid is the nicer version, a plain repeatable form (day + start time + end time) is the simpler, faster-to-build one). Each declared window is deletable. This directly feeds `PublicTeacherProfilePage`'s availability preview (§4.2) and gates what times are bookable — make the connection between "what I declare here" and "what students can book" explicit in the copy.

### 12.2 Booking flow
A modal/drawer, not a full page, triggered from an accepted interest in `InterestsPage` (§8.2): pick a date/time (constrained to the teacher's declared availability — grey out or hide non-available slots rather than letting the user pick an invalid one and fail server-side) and a duration. Submit → confirmed immediately (no separate accept step — picking an open slot *is* the confirmation) → success state with a prompt toward Phase 18F's deposit payment if one is required.

### 12.3 MyBookingsPage — `/bookings`
**Access**: protected. List of the caller's bookings, either side (teacher or student), upcoming-first. Each row: other party, date/time, status badge (confirmed/cancelled/completed), payment status badge (§13 — pending/paid, once 18F is live). Actions: Cancel (either participant — confirm-before-destructive copy, since it affects the other party too), Mark Complete (confirmed → completed, either participant), Pay Deposit (if unpaid — §13.1).
- Handles the `?payment=success` / `?payment=cancelled` return-from-Stripe states as a toast/banner on load, not a separate page

---

## 13. Phase 18F — Payments

No dedicated checkout UI to design — Stripe hosts the actual payment page. The frontend's job is the surrounding experience:

### 13.1 "Pay Deposit" action (within MyBookingsPage, §12.3)
A button on an unpaid confirmed booking → calls the checkout-session endpoint → redirects the browser to Stripe's returned URL. Design a brief loading/redirecting state for the moment between click and redirect (this is a real network round-trip, not instant).

### 13.2 Return states
`?payment=success`: a clear success banner/toast on `MyBookingsPage`, and that booking's payment badge should now read "Paid" (re-fetch on load, don't trust the URL param alone for the badge itself).
`?payment=cancelled`: a neutral (not alarming) banner — "Payment wasn't completed — you can try again anytime," with the Pay Deposit button still available.

---

## 14. Phase 19F — Multi-language

No new pages. Two design tasks layered onto everything above:

1. **LanguageSwitcher** (§3.3) — design it once, place it in the navbar (always visible) and footer (redundant, discoverable from a fresh landing).
2. **Content localization** — everywhere a listing description or teacher bio renders (`ListingDetailPage`, `PublicTeacherProfilePage`, Browse cards), it should show the field matching the selected language when that translation exists (`description_si`/`description_ta`/`bio_si`/`bio_ta`), falling back to the base field when it doesn't — design a small, unobtrusive "not available in [language]" indicator for that fallback case rather than silently showing English with no explanation. UI chrome (buttons, labels, nav) is a separate, full i18next string-externalization pass — every page above needs its static text run through that, not just the ones with translatable content fields.

---

## 15. Suggested Design Priority

If designing incrementally rather than all at once, this order front-loads the pages that most shape a first impression and unblock everything downstream:

1. **BrowsePage + ListingDetailPage** (§6) — the actual product; nothing else matters if this doesn't feel professional
2. **PublicTeacherProfilePage** (§4.2) — the trust-building page, directly supports the "professional level" goal
3. **ProfileEditPage + PostListingPage** (§4.1, §5.1) — get real content into the system
4. **InterestsPage + Express Interest flow** (§8) — the core transaction loop
5. **Dashboard evolution** — revisit the existing placeholder once Notifications (§7), Interests (§8), and recommendations have real content to show
6. Chat, Booking, Payments, Admin, Multi-language — roughly in that order, matching the backend build order already completed
