import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.getenv("SLOP_DB", "data/slopguard.sqlite3")


@contextmanager
def connect():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def migrate():
    with connect() as db:
        db.executescript(Path("migrations/001_initial.sql").read_text())
        if "provider" not in [
            r["name"] for r in db.execute("PRAGMA table_info(quota)")
        ]:
            db.execute(
                "ALTER TABLE quota ADD COLUMN provider TEXT NOT NULL DEFAULT 'gemini'"
            )
        if "neurons" not in [r["name"] for r in db.execute("PRAGMA table_info(quota)")]:
            db.execute(
                "ALTER TABLE quota ADD COLUMN neurons INTEGER NOT NULL DEFAULT 0"
            )

        columns = {r["name"] for r in db.execute("PRAGMA table_info(quota)")}
        for name, kind in {
            "input_tokens": "INTEGER",
            "output_tokens": "INTEGER",
            "total_tokens": "INTEGER",
            "status": "TEXT NOT NULL DEFAULT 'reserved'",
            "http_status": "INTEGER",
            "completed": "REAL",
        }.items():
            if name not in columns:
                db.execute(f"ALTER TABLE quota ADD COLUMN {name} {kind}")
        if "status" not in columns:
            db.execute("UPDATE quota SET status='legacy_unknown'")
        db.execute("CREATE INDEX IF NOT EXISTS quota_provider_at ON quota(provider,at)")
        db.execute("PRAGMA user_version=2")


def rows(sql, args=()):
    with connect() as db:
        return [dict(r) for r in db.execute(sql, args).fetchall()]
