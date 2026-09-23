"""
Phase 12 — implicit-feedback collaborative filtering.

Builds a single user x user interaction matrix from real behavior (the
Event log's view_listing / interest_sent / interest_accepted actions) plus
completed Review ratings, trains an ALS model (implicit's), and writes each
user's top candidates into RecommendationCache — read by
server/src/modules/recommendations/recommendations.service.js and blended
with Phase 8's content-based score THERE, never here. That scoring formula
already exists and is tested in Node; duplicating it in Python would just
be a second copy of the same logic to keep in sync.

The matrix is intentionally "square" (the same user-id space on both axes)
rather than two separate student x teacher / teacher x student matrices —
interactions are naturally bipartite already (a student's row only ever has
nonzero entries in teacher columns, and vice versa, since that's the only
kind of interaction the product allows), so one ALS run serves both
recommend_teachers_for_student and recommend_students_for_teacher without
training two models or maintaining two id spaces.
"""

from datetime import datetime, timezone
from collections import defaultdict

import numpy as np
from bson import ObjectId
from implicit.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix

from db import get_db

TOP_N = 20  # candidates cached per user — Node's own candidate pool + limit trims further at read time

# How much each observed interaction contributes to the "confidence" ALS
# trains on — a stronger, more deliberate action counts for more. A review
# is additionally weighted by its own star rating (rating / 5) on top of
# REVIEW_WEIGHT, so a 5-star review counts far more than a 1-star one.
EVENT_WEIGHTS = {
    "view_listing": 1.0,
    "interest_sent": 3.0,
    "interest_accepted": 5.0,
}
REVIEW_WEIGHT = 8.0

MIN_INTERACTIONS_TO_TRAIN = 5  # below this there's nothing real for ALS to learn — skip rather than fit noise


def _to_object_id(hex_id):
    return ObjectId(hex_id)


def _load_listing_owners(db):
    """listingId (str) -> ownerId (str) — the only thing needed to turn a
    view_listing/interest_sent/interest_accepted event's targetId (a
    listing) into the "who this interaction was really with" the CF matrix
    is keyed on."""
    return {str(doc["_id"]): str(doc["ownerId"]) for doc in db.listings.find({}, {"ownerId": 1})}


def _load_user_roles(db):
    return {str(doc["_id"]): doc.get("role") for doc in db.users.find({}, {"role": 1})}


def build_interactions(db):
    """(userId, ownerId) -> accumulated confidence weight, from Event +
    Review. userId is who acted; ownerId is whose listing/teaching they
    acted on — search events are excluded, they carry no targetId to
    attribute the interaction to."""
    listing_owners = _load_listing_owners(db)
    interactions = defaultdict(float)

    events = db.events.find(
        {"action": {"$in": list(EVENT_WEIGHTS)}, "userId": {"$ne": None}, "targetId": {"$ne": None}},
        {"userId": 1, "action": 1, "targetId": 1},
    )
    for event in events:
        owner_id = listing_owners.get(str(event["targetId"]))
        user_id = str(event["userId"])
        if owner_id is None or owner_id == user_id:
            continue
        interactions[(user_id, owner_id)] += EVENT_WEIGHTS[event["action"]]

    for review in db.reviews.find({}, {"reviewerId": 1, "teacherId": 1, "rating": 1}):
        reviewer_id = str(review["reviewerId"])
        teacher_id = str(review["teacherId"])
        if reviewer_id == teacher_id:
            continue
        interactions[(reviewer_id, teacher_id)] += REVIEW_WEIGHT * (review["rating"] / 5.0)

    return interactions


def _normalize_scores(scores):
    """Per-user min-max normalization to a 0-100 scale — matches Phase 8's
    content score range so recommendations.service.js can blend the two
    directly with no conversion step. A single-candidate (or all-tied)
    result has no spread to normalize against; falls back to a flat
    mid-range 50 rather than dividing by zero."""
    lo, hi = float(np.min(scores)), float(np.max(scores))
    if hi - lo < 1e-9:
        return [50.0] * len(scores)
    return [100.0 * (float(s) - lo) / (hi - lo) for s in scores]


def run(db=None):
    # Not `db or get_db()` — pymongo's Database explicitly raises on
    # bool(database) to stop exactly this kind of truthiness check.
    db = db if db is not None else get_db()
    interactions = build_interactions(db)

    if len(interactions) < MIN_INTERACTIONS_TO_TRAIN:
        print(f"[collaborative_filtering] only {len(interactions)} interaction(s) - skipping, nothing to learn yet")
        return 0

    user_ids = sorted({u for pair in interactions for u in pair})
    index_of = {uid: i for i, uid in enumerate(user_ids)}
    roles = _load_user_roles(db)

    rows, cols, values = [], [], []
    for (user_id, owner_id), weight in interactions.items():
        rows.append(index_of[user_id])
        cols.append(index_of[owner_id])
        values.append(weight)
    n = len(user_ids)
    matrix = csr_matrix((values, (rows, cols)), shape=(n, n), dtype=np.float32)

    model = AlternatingLeastSquares(factors=32, regularization=0.05, iterations=15, random_state=42)
    model.fit(matrix)

    now = datetime.now(timezone.utc)
    written = 0
    for user_id in user_ids:
        idx = index_of[user_id]
        if matrix[idx].nnz == 0:
            continue  # only ever appears as someone else's target, never acted themselves — nothing to recommend from

        candidate_indices, candidate_scores = model.recommend(
            idx, matrix[idx], N=TOP_N, filter_already_liked_items=True
        )
        if len(candidate_indices) == 0:
            continue

        # implicit pads out to N with garbage when fewer than N real
        # candidates exist for this user (confirmed empirically, not
        # documented behavior) — repeated ids and/or float32-min sentinel
        # scores. Real ALS scores from this data never approach that
        # magnitude, so filtering on it is safe; deduplicating (keeping the
        # first/best-scored occurrence, since results come back sorted) plus
        # this score floor together account for both padding shapes seen.
        seen_ids = set()
        real_pairs = []
        for i, score in zip(candidate_indices, candidate_scores):
            target_id = user_ids[i]
            if score <= -1e6 or target_id in seen_ids:
                continue
            seen_ids.add(target_id)
            real_pairs.append((target_id, float(score)))
        if not real_pairs:
            continue

        # RecommendationCache is only ever looked up by a student's or
        # teacher's own id (see recommendations.service.js) — a parent
        # browses under their OWN userId (Event.userId is the authenticated
        # requester, not a resolved child), so a parent-role row can end up
        # in this matrix, but a cache entry keyed by their id would never
        # be read back. There's no reliable way to attribute that
        # browsing to one specific linked child from the event data alone
        # (a parent can have several), so it's skipped here rather than
        # guessed at.
        own_role = roles.get(user_id)
        if own_role not in ("student", "teacher"):
            continue
        wanted_role = "teacher" if own_role == "student" else "student"

        # ALS doesn't know about roles — a student's real recommendations
        # are only ever meaningful among teachers (and vice versa), so this
        # filters out same-role noise the model might otherwise surface.
        pairs = [(target_id, score) for target_id, score in real_pairs if roles.get(target_id) == wanted_role]
        if not pairs:
            continue

        normalized_scores = _normalize_scores([score for _, score in pairs])
        recommendations = [
            {"targetUserId": _to_object_id(target_id), "score": round(score, 1)}
            for (target_id, _), score in zip(pairs, normalized_scores)
        ]

        db.recommendationcaches.replace_one(
            {"userId": _to_object_id(user_id)},
            {"userId": _to_object_id(user_id), "recommendations": recommendations, "computedAt": now},
            upsert=True,
        )
        written += 1

    print(
        f"[collaborative_filtering] trained on {len(interactions)} interactions, {n} users; "
        f"wrote {written} cache document(s)"
    )
    return written


if __name__ == "__main__":
    run()
