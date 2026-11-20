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


def rows(sql, args=()):
    with connect() as db:
        return [dict(r) for r in db.execute(sql, args).fetchall()]
