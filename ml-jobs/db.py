"""Shared MongoDB connection for the ml-jobs batch scripts.

Deliberately just a pymongo connection, not a live service — this whole
directory is invoked as `python run.py` on a schedule (cron / Windows Task
Scheduler), reads/writes MongoDB directly, and exits. The Node API never
calls anything here; it only reads what the last run left in
RecommendationCache / RankingConfig.
"""

import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()


def get_db():
    mongo_uri = os.environ.get("MONGO_URI")
    if not mongo_uri:
        raise RuntimeError("MONGO_URI is not set — copy .env.example to .env and fill it in")
    client = MongoClient(mongo_uri)
    # The database name lives in the URI's path (e.g. .../EduLink) — same
    # convention server/src/config/db.js already relies on via
    # mongoose.connect(uri), so both sides read/write the same database
    # without the name being repeated/hardcoded here.
    return client.get_default_database()
