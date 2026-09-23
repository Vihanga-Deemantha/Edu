# EduLink — Phase Roadmap (Phase 2 onward)
### Reconciles with phase numbers already referenced in the Phase 0/1 specs

This document sequences everything after auth (Phase 0/1, built) through the full marketplace and the ML/AI layer. It intentionally stops short of full phase-0-style implementation detail for every phase — each phase here has enough to scope and start planning; expand any individual phase into a full build spec (folder structure, exact endpoints, request/response shapes, checklists) when you're about to start it, the same way Phase 0 later got two upgrade addenda once real requirements were known.

**Numbering note**: Phase 2, 4/5, 6, 10, and 14 are already referenced by name in your existing Phase 0/1 upgrade docs (`TeacherProfile` in Phase 2, listings in Phase 4/5, public listing display from Phase 6, interest requests in Phase 10, admin backend in Phase 14). This roadmap fills the gaps around those fixed points rather than renumbering anything.

---

## Roadmap at a glance

| Phase | Name | Depends on | Type |
|---|---|---|---|
| 2 | Teacher & Student Profiles — Backend | 0 | Core |
| 3 | Teacher & Student Profiles — Frontend | 2 | Core |
| 4 | Listings — Backend | 2 | Core |
| 5 | Listings — Frontend | 4 | Core |
| 6 | Public Browse, Search & Discovery | 4, 5 | Core |
| 7 | Interaction Event Logging & Analytics Foundation | 6 | Infra |
| **8** | **AI/ML v1 — Content-Based Recommendations** | 6, 7 | **AI/ML** |
| 9 | Notifications Module | 0 (can start anytime after auth) | Infra |
| 10 | Interest & Contact Request Flow | 6, 9 | Core |
| 11 | Ratings & Reviews | 10 | Core |
| **12** | **AI/ML v2 — Collaborative Filtering & Ranking** | 7, 8, 10, 11 | **AI/ML** |
| 13 | In-App Chat | 10 | Enhancement |
| 14 | Admin Backend | 2, 4, 10, 11 | Core |
| 15 | Admin Frontend & Analytics Dashboard | 14, 7 | Core |
| **16** | **AI/ML v3 — Semantic Search & Assistant Layer** | 6, 12 | **AI/ML** |
| 17 | Trial-Class Booking & Scheduling | 10 | Stretch |
| 18 | Payments (PayHere/WebXPay) | 17 | Stretch |
| 19 | Multi-Language (Sinhala/Tamil/English) | 6 | Stretch |

The three AI/ML phases are bolded because they're the direct answer to "add ML/AI for relevant suggestions" — each is scoped to what the *preceding* phase's data actually supports, so none of them require data you don't have yet.

---

## Phase 2 — Teacher & Student Profiles (Backend)

**Goal**: extend the bare `User` document into role-specific public profiles. This is what listings (Phase 4) and search (Phase 6) will read from.

**New models**:
```
TeacherProfile {
  userId (ref User, unique),
  subjects: [String], grades: [String], medium: [String enum: sinhala|tamil|english],
  curriculum: [String enum: local|cambridge|edexcel],
  classType: [String enum: individual|group|online|home_visit],
  bio, qualifications: [String], experienceYears: Number,
  location: { type: "Point", coordinates: [lng, lat] },  // GeoJSON, indexed 2dsphere
  photoUrl, introVideoUrl,
  verificationStatus: none|id_verified|fully_verified,  // mirrored from TeacherVerification (Phase 0 upgrade), read-only here
  avgRating: Number (default 0), reviewCount: Number (default 0),
  createdAt, updatedAt
}

StudentProfile {
  userId (ref User, unique),
  gradeOrLevel, subjectsInterested: [String], medium: [String],
  location: { type: "Point", coordinates: [lng, lat] },
  // For child accounts, this profile belongs to the child's User doc but is only ever
  // written through the parent's authenticated session — enforce in the controller,
  // not just trust the client.
  createdAt, updatedAt
}
```

**Key endpoints**:
- `POST /api/profiles/teacher` (protected, teacher only) — create/update own profile (upsert)
- `GET /api/profiles/teacher/:userId` (public) — public view; strip `verificationStatus` down to the simplified badge only, never expose raw `TeacherVerification` fields (already decided in Phase 0 upgrade §C6)
- `PATCH /api/profiles/teacher` (protected, teacher only) — partial update
- `POST /api/profiles/student` (protected, student or parent-on-behalf-of-child)
- `GET /api/profiles/student/:userId` (protected — never public; student "wanted" visibility is teacher-only per the product spec)

**Rules carried over from existing decisions**:
- `TeacherProfile.verificationStatus` is derived/read-only from the client's perspective — only an admin action (Phase 14) can change it. Reject any client-supplied value on create/update.
- A parent updating a child's `StudentProfile` must pass `req.user.id` as the parent and resolve the child via `linkedChildIds` — never trust a `userId` in the body for this.
- `location` is optional at profile-creation time (don't force geolocation permission before someone can even sign up) but required before a `TeacherProfile` can appear in geo-sorted search (Phase 6) — validate at the search layer, not by rejecting profile creation.

**Definition of done**: a teacher can create/edit a profile via Postman, a public unauthenticated request can fetch a teacher's profile with verification badge only, and a parent can create a profile for a linked child but not for an arbitrary `userId`.

---

## Phase 3 — Teacher & Student Profiles (Frontend)

**Goal**: profile edit forms + public teacher profile page.

**Key deliverables**:
- `TeacherProfileEditPage` — multi-field form (subjects/grades/medium as multi-select, bio, qualifications list, location picker — a simple map click or "use my location" button is enough, no need for full geocoding UI yet)
- `StudentProfileEditPage` — lighter version; parent-facing variant for child profiles reachable from `/children`
- `PublicTeacherProfilePage` (`/teachers/:id`) — public route, shows the pinned-card design system's expanded view: bio, subjects, rating (0 until Phase 11 exists — show "No reviews yet" not a broken 0-star widget), verification badge, contact-gated CTA ("Express Interest" — wired in Phase 10, show as disabled/"Coming soon" until then if you're shipping incrementally)
- Reuse the existing design tokens/pinned-card motif from the Phase 1 upgrade — don't introduce a second visual language for profiles

**Definition of done**: teacher and student/parent can edit their profile in the browser and see it persist across reload; the public profile page renders for a logged-out visitor.

---

## Phase 4 — Listings (Backend)

**Goal**: the actual marketplace inventory — teacher ads and student "wanted" ads, with the asymmetric visibility rule enforced server-side (not just hidden in the UI, which is trivially bypassed).

**Data model** (matches your overview doc's sketch, tightened):
```
Listing {
  _id, type: "teacher_ad" | "student_ad",
  ownerId (ref User),
  subject, grade, medium, curriculum,
  price: { amount, currency: "LKR", unit: "hour"|"month" },
  schedule: [String] (free-text slots is fine for MVP, structured calendar is Phase 17),
  description,
  location: { type: "Point", coordinates },  // denormalized from profile at creation time, so a later profile move doesn't retroactively change where an old ad appeared
  status: "active" | "closed" | "flagged",   // flagged = admin-moderated, hidden from public results
  createdAt, updatedAt
}
```

**Visibility rule — enforce in the query layer, every time, not per-endpoint ad hoc**:
- `teacher_ad`: any authenticated user OR guest can read
- `student_ad`: only `role: teacher` (authenticated) can read the full listing; everyone else gets `404`, not `403` — don't confirm the ad's existence to a non-teacher. This is the access-control detail the overview doc calls out as interview-worthy; implement it as a single shared query filter (e.g. a `visibleTo(req.user)` helper used by every listing-read endpoint), not copy-pasted role checks, so it can't drift out of sync across endpoints.

**Key endpoints**:
- `POST /api/listings` (protected — teacher for `teacher_ad`, student/parent for `student_ad`) — role must match listing type, reject mismatches
- `GET /api/listings/mine` (protected) — owner's own listings regardless of status
- `PATCH /api/listings/:id` (protected, owner only)
- `DELETE /api/listings/:id` (protected, owner only — soft delete via `status: "closed"`, don't hard-delete; Phase 11 reviews and Phase 7 events may reference the listing later)
- `GET /api/listings/:id` (visibility-gated per rule above)

**Definition of done**: a teacher can post/edit/close a teacher ad; a student can post a wanted ad that a guest/other-student cannot fetch (404) but a logged-in teacher can.

---

## Phase 5 — Listings (Frontend)

**Goal**: post/manage-listing UI.

**Key deliverables**:
- `PostListingPage` — role-aware form (teacher sees teacher-ad fields, student/parent sees wanted-ad fields — don't show a type selector, derive it from `user.role`)
- `MyListingsPage` — list + edit/close actions, status badges
- Reuse pinned-card component for listing previews everywhere (dashboard, my-listings, and later the browse grid in Phase 6) — one component, not a re-implementation per page

**Definition of done**: full create → edit → close loop works in the browser for both listing types, gated by role.

---

## Phase 6 — Public Browse, Search & Discovery

**Goal**: the page that makes this a marketplace instead of a form-filling exercise — browsing teacher ads with filters, and geospatial "near me" search.

**Backend**:
- `GET /api/listings/browse` (public) — query params: `subject, grade, medium, curriculum, minPrice, maxPrice, lat, lng, radiusKm, sort (rating|price|distance|newest)`
- Geospatial: `$geoNear` (requires a `2dsphere` index on `Listing.location`, aggregation pipeline since `$geoNear` must be the first stage — plan the query builder around that constraint from the start rather than retrofitting)
- Text filters: compound index on `{ type: 1, status: 1, subject: 1, grade: 1 }` covers the common filter combination; add MongoDB text index on `subject description` for free-text search until Phase 16's semantic search replaces it
- Guest (unauthenticated) requests get the same browse results as logged-in students — per the product spec, guests can browse but not act. Don't gate browse behind auth; gate the *interest* action (Phase 10) instead.

**Frontend**:
- `BrowsePage` — filter sidebar/bar + pinned-card grid, matches the "Featured/sample subjects" placeholder from the landing page (Phase 1 upgrade §B1.4) — this is where that placeholder becomes real data, as already flagged in that spec
- Empty/no-results state, loading skeletons (this is the first page where real pagination and network latency matter — this is also the point where I'd actually introduce TanStack Query instead of hand-rolled `useEffect` fetching, since filters changing rapidly is exactly the caching/race-condition problem it solves)

**Definition of done**: a guest can browse and filter teacher ads including a "near me" sort, with results matching what a logged-in student sees.

---

## Phase 7 — Interaction Event Logging & Analytics Foundation

**Goal**: infrastructure phase, deliberately thin. Nothing user-facing changes. This exists because Phase 8/12's ML and Phase 15's admin analytics both need historical interaction data, and that data is worthless if you only start collecting it the day you need it — so it's logged from here on, well before anything consumes it.

**New model**:
```
Event {
  _id, userId (nullable — guests generate events too),
  sessionId,               // client-generated UUID, persisted in a cookie/localStorage, links guest activity to a later signup
  action: "view_listing" | "view_profile" | "search" | "filter_apply" | "interest_sent" | "interest_accepted",
  targetType: "listing" | "profile" | null,
  targetId: ObjectId | null,
  metadata: Object,        // e.g. { subject, grade, filters } for a search event
  createdAt
}
```
- Fire-and-forget write from the relevant Phase 4-6 endpoints (`view_listing` on `GET /api/listings/:id`, `search` on `/browse`, etc.) — don't block the response on this write; write async / don't await, and never let a logging failure break the actual request.
- TTL or archival policy: raw events get large fast. Set a TTL index (e.g. 180 days) or plan a rollup job that aggregates into daily summaries and drops the raw rows — decide this now, not after the collection is unmanageably large.
- No new endpoints exposed to the frontend in this phase — this is write-only infrastructure.

**Definition of done**: browsing, searching, and viewing a listing/profile each produce an `Event` document, verified by checking the collection directly — no user-visible change.

---

## Phase 8 — AI/ML v1: Content-Based Recommendations

**Goal**: the first real "AI/ML" feature, and the one that works with zero historical interaction data — this is what should ship the moment Phase 6 listings exist, not something to wait on.

**Approach**: no trained model. A scored similarity function over structured attributes, implemented as a Node module (no new service, no new infra) — this directly answers "relevant suggestions for teachers and students" without over-building for data you don't have yet.

**Scoring inputs** (weighted sum, tune weights empirically once you have click-through to check against):
- Subject/grade/medium exact match (highest weight)
- Location proximity (via the same `2dsphere` index from Phase 6)
- Price-band fit (student's implied budget from their wanted ad or profile vs. teacher's listed price)
- `TeacherProfile.verificationStatus` (fully_verified ranks above id_verified ranks above none — trust signal doubles as a ranking signal)
- `avgRating`/`reviewCount` (0 weight until Phase 11 exists; wire the field in now so Phase 11 doesn't require touching this module again)

**Key endpoints**:
- `GET /api/recommendations/teachers` (protected, student/parent) — top-N for the current user, computed on request (cheap enough at this scale — don't precompute/cache until it's actually slow)
- `GET /api/recommendations/students` (protected, teacher) — the symmetric "leads" version: student wanted-ads that fit this teacher's subjects/location, which is the concrete answer to "relevant suggestions for teachers" specifically, not just students
- Surfaced in the frontend as a "Recommended for you" rail on the dashboard and browse page — label it plainly, don't oversell it as "AI-powered" in the UI copy for what is currently a weighted-attribute score; save that framing for Phase 12+ where it's genuinely learned

**Definition of done**: a student with a profile/wanted-ad sees a ranked, non-empty recommendation list from real listings; a teacher sees ranked student leads; both update when the underlying listings change.

---

## Phase 9 — Notifications Module

**Goal**: event-driven alerts, needed before Phase 10 can have an accept/decline flow worth building (an interest request nobody gets notified about is a dead feature).

**Architecture**: Redis + BullMQ, per the overview doc's own suggested stack — a worker process consumes jobs queued by other modules (`interest.accepted`, `review.posted`, etc.) and fans out to in-app notification + email (reuse the Phase 0 `email.service.js` transport, don't build a second one).

**Data model**:
```
Notification {
  userId, type: "interest_received"|"interest_accepted"|"interest_declined"|"new_review"|"listing_flagged",
  payload: Object, read: Boolean (default false), createdAt
}
```

**Key endpoints**:
- `GET /api/notifications` (protected) — paginated, unread-first
- `PATCH /api/notifications/:id/read`
- In-app delivery: polling every 30-60s is sufficient for MVP; don't build WebSockets here unless Phase 13 (chat) is being built concurrently, since chat is the feature that actually needs sub-second delivery — notifications alone don't justify the added complexity.

**Definition of done**: a job queued by another module produces a `Notification` document and (if email-worthy) an email, verified independent of any specific trigger feature existing yet.

---

## Phase 10 — Interest & Contact Request Flow

**Goal**: the core marketplace transaction — this is the phase your existing upgrade specs already name, and it's the reason Phase 9 had to come first.

**Data model** (matches overview doc):
```
InterestRequest {
  _id, listingId, fromUserId, toUserId,
  status: "pending"|"accepted"|"declined"|"completed",
  message, createdAt, respondedAt
}
```

**Key endpoints**:
- `POST /api/interests` — body `{ listingId, message }`; `toUserId` derived server-side from `listing.ownerId`, never trust a client-supplied `toUserId`
- `PATCH /api/interests/:id/respond` — body `{ status: "accepted"|"declined" }`, only `toUserId` may call this
- `PATCH /api/interests/:id/complete` — marks a request completed once the arrangement concluded; this is the gate Phase 11 reviews check against
- `GET /api/interests/sent` / `GET /api/interests/received` (protected)

**Rules**:
- On `accepted`, reveal contact details (email/phone) in the response — but for a child-linked request, contact info revealed is always the **parent's**, never the child's (no exception — Phase 0 upgrade's data-minimization decision holds here too)
- Enforce the verification-tier gate from Phase 0 upgrade §C3 at acceptance time: a request involving a child-linked account can only be *accepted* by a `fully_verified` teacher — check this server-side in the accept handler, not just cosmetically on the profile
- Fire a Phase 9 notification job on every state transition

**Definition of done**: full pending→accepted loop works between a real teacher and student account, contact is correctly revealed only on acceptance, and the child-linked + non-fully-verified-teacher combination is rejected even if attempted directly against the API.

---

## Phase 11 — Ratings & Reviews

**Goal**: the trust mechanism the overview doc correctly calls "the hardest part of any marketplace."

**Data model**:
```
Review {
  _id, teacherId, reviewerId, rating: 1-5, comment,
  linkedRequestId (ref InterestRequest, required),
  createdAt
}
```

**Key endpoints**:
- `POST /api/reviews` — body `{ linkedRequestId, rating, comment }`; reject unless `linkedRequestId` belongs to the caller AND its `status === "completed"` (this is what prevents fake reviews — enforce it server-side, the frontend check is UX only)
- `GET /api/reviews/teacher/:teacherId` (public, paginated)
- On write: recompute and store `TeacherProfile.avgRating`/`reviewCount` (denormalized for fast search sorting — don't compute this live on every search request)
- Report/flag button (ties into Phase 14 admin moderation queue): `POST /api/reports` with `targetType: "review"`

**Definition of done**: a review can only be posted against a genuinely completed request, `avgRating` updates and is visible on the public profile and in Phase 6 search sorting.

---

## Phase 12 — AI/ML v2: Collaborative Filtering & Ranking

**Goal**: this is where recommendations stop being a hand-tuned weighted score and start being learned from real behavior — only viable now because Phase 7 has been logging events and Phase 11 has real ratings.

**Architecture shift**: introduce a small Python service here (FastAPI), separate from the Node monolith — this is the point where a real ML ecosystem (scikit-learn/LightGBM/implicit) actually pays for itself. It reads from MongoDB (a read-only connection or a scheduled export), runs offline, and writes precomputed results back.

- **Implicit-feedback collaborative filtering** (e.g. `implicit` library's ALS) over the `Event` log (view/search/interest-sent as positive implicit signals) blended with the Phase 8 content-based score — classic hybrid recommender, not a replacement for Phase 8, an upgrade to it
- **Learning-to-rank** (LightGBM ranking objective) for search result ordering in Phase 6: features = content-match score, distance, price fit, `avgRating`, `reviewCount`, response rate (derivable from Phase 10's accept/decline timestamps), verification tier
- Batch job: nightly retrain + score, results cached into a `RecommendationCache` collection (`{ userId, recommendedIds: [...], computedAt }`) — Node serves reads from this cache, never calls the Python service synchronously on a user request. This keeps the production request path fast and the Node/Python coupling loose (a cron job and a shared DB, not a live RPC dependency).

**Definition of done**: recommendation quality is measurably different from Phase 8's static scoring for users with real interaction history (spot-check a few accounts), while accounts with no history still gracefully fall back to the Phase 8 content-based score (cold start must never break).

---

## Phase 13 — In-App Chat

**Goal**: replace the "reveal contact details" outcome of Phase 10 with a proper in-app conversation, keeping contact info off-platform entirely (better privacy posture, and it's where the child-safety mediation story gets stronger — a parent can review a chat thread).

- WebSockets (Socket.io) now justified by this feature specifically
- `Conversation`/`Message` models keyed off an accepted `InterestRequest`
- Child-linked conversations: the parent is always a participant, the child (if it ever gets its own limited session — out of scope here, matches the existing "child never logs in independently" decision) is not a direct party

**Definition of done**: two accepted-interest parties can exchange messages in real time; contact-detail revelation from Phase 10 can be scoped down to "you're now connected" instead of raw phone/email, if you choose to fully replace it.

---

## Phase 14 — Admin Backend

**Goal**: this is the phase your Phase 0 upgrade doc explicitly deferred verification approval to — it's now unblocked.

**Key endpoints**:
- `PATCH /api/admin/verification/:userId` — approve/reject, set `verificationTier`, write `adminNotes` (internal only), sync `TeacherProfile.verificationStatus`
- `PATCH /api/admin/users/:userId/suspend` — sets `isActive: false`
- `PATCH /api/admin/listings/:id/moderate` — sets `status: "flagged"`
- `GET /api/admin/reports` + `PATCH /api/admin/reports/:id/resolve`
- All routes: `authenticate + authorize('admin')`, and every admin action should write to a lightweight `AuditLog` collection (`{ adminId, action, targetType, targetId, createdAt }`) — cheap to add now, painful to reconstruct later if a moderation decision is ever disputed

**Definition of done**: an admin (seeded via the existing `seedAdmin.js` script) can approve a teacher's verification end-to-end, and the tier change is reflected on that teacher's public profile immediately.

---

## Phase 15 — Admin Frontend & Analytics Dashboard

**Goal**: the "business thinking" feature the overview doc calls out — most-requested subjects, busiest regions, supply/demand gaps.

- Verification review queue UI (document viewer via the Phase 0 upgrade's signed-URL route — build that route now if Phase 2/14 hasn't already)
- Reports/moderation queue
- Analytics: aggregate `Event` (Phase 7) + `Listing` + `InterestRequest` data — e.g. `$group` by subject/region on search events to surface "high demand, low teacher supply" gaps. This is genuinely more interesting once Phase 12's event volume exists; a thin version (just counts, no trends) is fine to ship earlier if you want the dashboard to feel alive sooner.

**Definition of done**: an admin can see and act on the verification queue and reports queue, and view at least subject-demand and region-demand charts.

---

## Phase 16 — AI/ML v3: Semantic Search & Assistant Layer

**Goal**: the "actual AI" phase in the sense most people mean it — natural-language search and an explainability layer, built on top of the recommendation infrastructure from Phase 8/12, not replacing it.

- **Embeddings**: generate vector embeddings for teacher bios + listing descriptions (a hosted embeddings API, or a self-hosted sentence-transformers model if you want to avoid per-call cost) — store via **MongoDB Atlas Vector Search**, which fits directly into the existing Mongo Atlas deployment with no new database to run
- **Semantic search**: `POST /api/search/semantic` — body `{ query: "O/L maths tutor near Kandy, weekends only" }`, combines `$vectorSearch` with the existing structured filters/geo query from Phase 6 (semantic for intent, structured filters for hard constraints like price/location — don't let the LLM guess at things the user already told you precisely)
- **"Why this match" explainer**: a short generated explanation attached to top recommendations ("Matches your child's grade and subject, 2.1km away, fully verified") — this can be template-generated from the Phase 12 ranking features without needing an LLM call at all; only reach for an actual LLM call if you want free-text generation, and cache the result per listing-pair rather than regenerating on every view
- **Teacher-facing pricing assistant** (optional, same phase): suggest a competitive price band from the `Listing` price distribution for that subject/grade/region — a percentile calculation, not ML, but genuinely useful and cheap to add here since the data's already being queried

**Definition of done**: a free-text query returns relevant results ranked sensibly against a structured-filter baseline, and a recommended listing shows a legible one-line reason for the match.

---

## Phase 17 — Trial-Class Booking & Scheduling (stretch)

Calendar-based trial session booking between an accepted `InterestRequest` pair — a `Booking` model with a time slot, teacher-defined availability windows, and conflict checking. Straightforward CRUD + calendar UI; no new architectural decisions beyond what Phases 4-10 already established.

## Phase 18 — Payments (stretch)

PayHere or WebXPay sandbox integration for a trial-class deposit, gated behind Phase 17. Payments are explicitly out of scope until this point — don't let Phase 8/12's recommendation work get entangled with a payment model that doesn't exist yet.

## Phase 19 — Multi-Language (Sinhala/Tamil/English) (stretch)

The Phase 1 upgrade already set the font stack up for this (`Noto Sans Sinhala`/`Noto Sans Tamil` fallbacks). This phase is UI string externalization (i18next) + translated content fields on `Listing`/`TeacherProfile` where relevant. Independent of the ML phases — semantic search (Phase 16) embeddings would need to be regenerated per-language if this ships after Phase 16, so consider sequencing this before Phase 16 if multi-language is a near-term priority rather than a true stretch goal.

---

## Where the AI/ML story actually lives, summarized

| Stage | Phase | What it needs | What it delivers |
|---|---|---|---|
| Content-based | 8 | Listings + profiles (Phase 4-6) | "Recommended for you" / lead suggestions, works from day one, zero cold-start problem |
| Collaborative + ranking | 12 | Event log (7) + ratings (11) | Learned recommendations + search ranking, falls back to Phase 8 for new users |
| Semantic + assistant | 16 | Vector search infra + Phase 12 ranking features | Natural-language search, match explanations, pricing guidance |

This is the sequencing I'd defend in an interview: each ML phase is justified by data the *previous* phase actually produced, not aspirational — which is also the answer if anyone asks "why didn't you just build the recommendation engine first."
