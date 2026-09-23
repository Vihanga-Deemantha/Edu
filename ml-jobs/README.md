# ml-jobs — Phase 12 batch recommender

A plain Python script, not a service. It connects to the same MongoDB the
Node API uses, reads Event/Review/InterestRequest history, trains two
models, and writes the results back into two collections
(`RecommendationCache`, `RankingConfig`) that Node reads at request time.
Node never calls anything here directly — there's no port, no HTTP server,
nothing to keep running. Run it, it exits.

## Setup

```bash
cd ml-jobs
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then fill in MONGO_URI
```

`MONGO_URI` should point at the same database `server/.env`'s `MONGO_URI`
does.

## Running

```bash
python run.py
```

Trains and writes both:
- **Collaborative filtering** (`collaborative_filtering.py`) — an ALS model
  over real interaction history (views, interest sent/accepted, reviews),
  written per-user into `RecommendationCache`.
- **Learning-to-rank** (`ranking.py`) — a LightGBM ranker trained on
  weak-supervision labels derived from search → view/interest sequences in
  the Event log, distilled into `RankingConfig`'s feature weights.

Either step prints a one-line summary and skips itself (without erroring)
if there isn't yet enough real interaction data to train on — expected on
a fresh database, and not a failure.

## Scheduling

Nightly is the roadmap's own cadence. On Windows, Task Scheduler running
`python run.py` with the working directory set to this folder; on
Linux/macOS, a cron entry:

```
0 3 * * * cd /path/to/ml-jobs && .venv/bin/python run.py >> run.log 2>&1
```

## Why the results are safe to serve even when stale or missing

Node treats both collections as optional, best-effort inputs:
- `recommendations.service.js` blends a `RecommendationCache` entry into
  Phase 8's content-based score only if one exists and is under 7 days old;
  otherwise a user gets exactly Phase 8's original behavior.
- `listings.service.js`'s `sort=recommended` falls back to a fixed default
  weight set if `RankingConfig` hasn't been written yet.

Nothing here is in the request path — a stuck or never-run job degrades
recommendation quality, never availability.
