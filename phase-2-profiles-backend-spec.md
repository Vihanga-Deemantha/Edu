# Phase 2 — Teacher & Student Profile Backend
### Full Implementation Spec (Tuition Marketplace)

Goal of this phase: authenticated teachers and students/parents can create and maintain a profile beyond the bare `User` account — subjects, grades, location, bio, and (for teachers) the public-facing verification badge. Nothing about listings, search, or interest requests yet — this phase ends when a profile can be created, fetched publicly (teacher) or privately (student), and updated, all verified via Postman/Thunder Client, and `TeacherProfile.verificationStatus` correctly mirrors the existing `TeacherVerification.verificationTier` from the Phase 0 upgrade.

This phase builds directly on the Phase 0/1 auth system — `authenticate`, `authorize`, `ApiError`, and the `{ success, data }` / `{ success: false, error }` response shape all carry over unchanged.

---

## 1. Tech Stack & Dependencies

No new runtime dependencies. This phase is pure Mongoose models + Express routes on the existing stack.

```
# from server/ — nothing new to install
```

If you add server-side geocoding later (converting a typed address into coordinates) you'd add a geocoding client here — out of scope for this phase. For now, the frontend (Phase 3) supplies `{ lat, lng }` directly (browser geolocation or a manual pin), and this phase just stores and indexes it.

---

## 2. Folder Structure (additions)

```
server/
├── src/
│   ├── models/
│   │   ├── TeacherProfile.js       # NEW
│   │   └── StudentProfile.js       # NEW
│   ├── modules/
│   │   └── profiles/               # NEW module
│   │       ├── profiles.controller.js
│   │       ├── profiles.routes.js
│   │       ├── profiles.service.js
│   │       └── profiles.validation.js
```

Mount the new router in `app.js` alongside the existing `authRoutes`/`verificationRoutes`:
```js
import profileRoutes from "./modules/profiles/profiles.routes.js";
// ...
app.use("/api/profiles", profileRoutes);
```

---

## 3. Data Models

### `TeacherProfile.js`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId ref `User`, required, unique | one profile per teacher |
| `subjects` | [String], required, min 1 | e.g. `["Mathematics", "Physics"]` |
| `grades` | [String], required, min 1 | e.g. `["Grade 10", "Grade 11", "A/L"]` |
| `medium` | [String] enum `sinhala`\|`tamil`\|`english`, required, min 1 | |
| `curriculum` | [String] enum `local`\|`cambridge`\|`edexcel` | optional, default `[]` |
| `classType` | [String] enum `individual`\|`group`\|`online`\|`home_visit`, required, min 1 | |
| `bio` | String, max 1000 chars | |
| `qualifications` | [String] | free text list for MVP; structured `{title, issuer}` objects are already covered by the separate `TeacherVerification.qualificationDocuments` from Phase 0 upgrade — don't duplicate that data here, this field is just the public-facing summary text |
| `experienceYears` | Number, min 0 | |
| `location` | GeoJSON `{ type: "Point", coordinates: [lng, lat] }` | optional at creation; **required before appearing in Phase 6 geo-sorted search** (validated at the search layer, not here) |
| `photoUrl` | String | |
| `introVideoUrl` | String | optional |
| `verificationStatus` | String enum `none`\|`id_verified`\|`fully_verified`, default `none` | **read-only from the client's perspective** — see §5 |
| `avgRating` | Number, default `0` | denormalized, written only by Phase 11 |
| `reviewCount` | Number, default `0` | denormalized, written only by Phase 11 |
| `createdAt`/`updatedAt` | Timestamps | |

Indexes:
```js
teacherProfileSchema.index({ location: "2dsphere" });
teacherProfileSchema.index({ subjects: 1, grades: 1 });
```

### `StudentProfile.js`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId ref `User`, required, unique | for a child account, this is the **child's** `User._id`, but only ever written through the parent's session (see §6) |
| `gradeOrLevel` | String | |
| `subjectsInterested` | [String] | |
| `medium` | [String] enum `sinhala`\|`tamil`\|`english` | |
| `location` | GeoJSON `{ type: "Point", coordinates: [lng, lat] }` | optional |
| `createdAt`/`updatedAt` | Timestamps | |

No `2dsphere` index needed yet — student profiles aren't searched in Phase 2-6, only teacher profiles are. Add it later if "students near me" ever becomes a teacher-facing feature.

---

## 4. Validation (`profiles.validation.js`)

Mirror the model constraints with `express-validator`:
- `subjects`, `grades`, `medium`, `classType`: non-empty arrays, each element checked against its enum
- `experienceYears`: optional, integer, min 0
- `location.coordinates`: if present, must be a 2-element array of numbers, longitude in `[-180, 180]`, latitude in `[-90, 90]`
- Reject `verificationStatus`, `avgRating`, `reviewCount` if present in the request body at all (see §5) — don't just ignore them silently, since a silently-ignored field that a future frontend dev starts relying on is how the read-only guarantee quietly breaks. Explicit `.not().exists()` validators here fail loud.

---

## 5. Service Logic (`profiles.service.js`)

**`upsertTeacherProfile({ userId, ...fields })`**
- `findOneAndUpdate({ userId }, fields, { upsert: true, new: true, runValidators: true })`
- Before writing, strip `verificationStatus`, `avgRating`, `reviewCount` from `fields` even if validation somehow let them through — defense in depth, matches the pattern already used for `TeacherVerification.verificationTier` in Phase 0 upgrade §C6
- On first creation only (not on update), read `TeacherVerification.verificationTier` for this `userId` (if a record exists — most new teachers won't have submitted verification yet) and set `verificationStatus` from it, so a teacher who verified before completing their profile doesn't show `none` incorrectly

**`getPublicTeacherProfile(userId)`**
- Returns the profile with `avgRating`, `reviewCount`, `verificationStatus` (the simplified enum only) — this is what Phase 6 search results and the public profile page (Phase 3) consume. No field here should ever require joining to `TeacherVerification`.

**`upsertStudentProfile({ requesterId, targetUserId, ...fields })`**
- If `requesterId === targetUserId`: the student is updating their own profile — proceed.
- If `requesterId !== targetUserId`: look up the requester's `User.linkedChildIds`; if `targetUserId` isn't in that list, throw `403`. This is the same trust boundary already established for `register-child` in Phase 0 — a parent acts *for* a child by ID, never by the child authenticating.
- Child accounts have `loginDisabled: true` (Phase 0) so `targetUserId === requesterId` is impossible for a child in practice — this branch exists for the parent-acting-on-behalf-of-child path specifically.

**`syncTeacherVerificationStatus(userId, newTier)`** — exported for Phase 14 (admin) to call once approve/reject exists; not wired to any route in this phase. Having the function ready now means Phase 14 is a one-line call, not a new sync mechanism invented late.

---

## 6. API Endpoints

Base path: `/api/profiles`

### `PUT /api/profiles/teacher`
Protected, `authorize('teacher')`. Upsert semantics — same route creates or updates.

Request body: any subset of the `TeacherProfile` fields from §3 except the three read-only ones.

Response `200`:
```json
{ "success": true, "data": { "profile": { "...": "full TeacherProfile" } } }
```

### `GET /api/profiles/teacher/:userId`
Public — no `authenticate` middleware.

Response `200`:
```json
{
  "success": true,
  "data": {
    "profile": {
      "userId": "...", "subjects": [], "grades": [], "medium": [],
      "bio": "...", "experienceYears": 3,
      "verificationStatus": "id_verified",
      "avgRating": 4.6, "reviewCount": 12,
      "photoUrl": "..."
    }
  }
}
```
`404` if no profile exists for that `userId` yet (a teacher who registered but never completed their profile) — don't `500`, this is an expected state.

### `PUT /api/profiles/student`
Protected, `authorize('student', 'parent')`.

Request body: `{ targetUserId, gradeOrLevel, subjectsInterested, medium, location }` — `targetUserId` is required even for a student updating their own profile (keeps the endpoint shape uniform; the service layer checks `targetUserId === req.user.id` for a self-update).

### `GET /api/profiles/student/:userId`
Protected — **never public**, matches the product-level rule that a student "wanted" ad and its owning profile are teacher-and-owner-only, never guest/other-student visible. `authorize('teacher', 'student', 'parent')` at the route, with the service layer enforcing: teachers may read any student profile (they need this to evaluate a wanted-ad's fit), a student may read their own, a parent may read a linked child's — anything else is `403`.

---

## 7. Wiring Into Existing Decisions

- `profiles.routes.js` uses the existing `authenticate`/`authorize` middleware unchanged — no new auth primitives in this phase.
- `TeacherProfile.verificationStatus` is a **mirror**, not a source of truth — the source of truth stays `TeacherVerification.verificationTier` (Phase 0 upgrade). This phase only reads it once at profile creation; Phase 14 is responsible for keeping it in sync going forward. Document this explicitly in a code comment on the field, the same way the original Phase 0 spec insisted on documenting the child-account password decision — it's a decision worth defending later.
- Don't add a `GET /api/profiles/me` shortcut that duplicates `/api/auth/me` — if the frontend needs "my profile," it already knows its own `userId` from `AuthContext.user` and can call `GET /api/profiles/teacher/:userId` like anyone else. One fewer endpoint to keep in sync.

---

## 8. Security Checklist for Phase 2

- [ ] `verificationStatus`, `avgRating`, `reviewCount` cannot be set via any client request, on create or update (test with a raw Postman body that includes them — confirm they're silently stripped, not silently accepted)
- [ ] A parent can only write a `StudentProfile` for a `userId` present in their own `linkedChildIds`, verified against the DB, not against a client-supplied flag
- [ ] `GET /api/profiles/student/:userId` returns `403` for a student requesting another student's profile
- [ ] `GET /api/profiles/teacher/:userId` requires no `Authorization` header at all
- [ ] Malformed `location.coordinates` (out-of-range lat/lng, wrong array length) is rejected with `422`, not stored

---

## 9. Manual Test Checklist (Postman/Thunder Client)

1. Register + verify a teacher (Phase 0/0-upgrade flow) → `PUT /api/profiles/teacher` with valid fields → `200`, profile returned
2. Repeat the same `PUT` with different values → still `200`, same document updated (not a duplicate)
3. `PUT /api/profiles/teacher` including `"verificationStatus": "fully_verified"` in the body → succeeds but the stored value is unaffected (still whatever it was before, `none` by default)
4. `GET /api/profiles/teacher/:userId` with no auth header → `200`, profile returned
5. `GET /api/profiles/teacher/:randomInvalidId>` → `404`
6. As a student, `PUT /api/profiles/student` with `targetUserId` = own ID → `200`
7. As a parent, `PUT /api/profiles/student` with `targetUserId` = a linked child's ID → `200`
8. As a parent, `PUT /api/profiles/student` with `targetUserId` = some other user's ID (not a linked child) → `403`
9. As a student, `GET /api/profiles/student/:someOtherStudentId>` → `403`
10. As a teacher, `GET /api/profiles/student/:anyStudentId>` → `200` (teachers can view student profiles)
11. Submit teacher verification (Phase 0 upgrade flow) and have it approved (manually flip `TeacherVerification.verificationTier` in the DB, since Phase 14 admin approval doesn't exist yet) → create a **new** `TeacherProfile` afterward → confirm `verificationStatus` picks up the tier on creation

---

## 10. Definition of Done

Phase 2 is complete when all 11 checklist items in §9 pass, `TeacherProfile` has a working `2dsphere` index (confirm with `db.teacherprofiles.getIndexes()`), and you can explain — without looking at the code — why `verificationStatus` is copied onto `TeacherProfile` at all instead of having every consumer join against `TeacherVerification` directly. (Short answer to check yourself against: `TeacherVerification` holds NIC numbers and police-clearance scans — nothing that reads public profile data should ever have a query path anywhere near that collection, even accidentally. The mirror field is the access-control boundary, not just a performance shortcut.)
