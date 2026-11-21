"""Explicit developer-only UI fixture server, isolated from the real database."""

import json
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["GEMINI_FREE_TIER_CONFIRMED"] = "false"
os.environ["AI_ENABLED"] = "false"
os.environ["REVIEW_PROVIDER"] = "gemini"
from fastapi.responses import HTMLResponse
import uvicorn
from slopguard import app as module
from slopguard import db, scanner

fixture_dir = tempfile.TemporaryDirectory()
db.DB_PATH = str(Path(fixture_dir.name) / "fixture.sqlite3")
db.migrate()
source = "import os\n\ndef test_checkout_succeeds():\n    assert True\n\ndef choose(flag):\n    if flag:\n        return 1\n    else:\n        return 1\n\ndef calculate():\n    return missing_value\n"
coverage = {
    "eligible": 1,
    "inspected": 1,
    "bytes": len(source),
    "partial": False,
    "reasons": ["Explicit local fixture, not a live GitHub scan."],
    "tree_complete": True,
}
result = scanner.analyze({"tests/test_checkout.py": source}, coverage)
findings = result.pop("findings")
for f in findings:
    f["url"] = scanner.source_url("local-fixture/example", "f" * 40, f)
report = dict(
    result,
    id="local-fixture",
    repo="local-fixture/example",
    sha="f" * 40,
    rubric="1.0",
    created=time.time(),
    coverage=coverage,
    findings=findings,
    ai={
        "score": None,
        "status": "unavailable",
        "uncertainty": "Fixture preview: no AI calls.",
    },
    cache_hit=True,
)
with db.connect() as conn:
    conn.execute(
        "INSERT INTO users VALUES (?,?)", ("fixture-member", "Test user")
    )
    conn.execute(
        "INSERT INTO reports VALUES (?,?,?,?)",
        ("local-fixture", "local-fixture", json.dumps(report), time.time()),
    )
module.user = lambda request: {"id": "fixture-member", "name": "Test user"}

# Explicit UI-only quota demonstration. No provider calls are enabled in this process.
if "--quota-demo" in sys.argv:
    quota_demo = {"state": "available"}

    def fixture_quota(db, now, tokens=0):
        state = quota_demo["state"]
        return {
            "state": state,
            "server_time": now,
            "remaining": 5 if state == "available" else 0,
            "retry_at": now + 60
            if state == "cooldown"
            else now + 3600
            if state == "exhausted"
            else None,
            "message": "Fixture AI availability: " + state,
            "limits_kind": "explicit local fixture",
        }

    module.review.quota_status = fixture_quota

    @module.app.post("/api/fixture/quota/{state}")
    def set_fixture_quota(state: str):
        if state not in {"available", "cooldown", "exhausted", "unknown", "disabled"}:
            return {"error": "Unsupported fixture state"}
        quota_demo["state"] = state
        return {"state": state, "fixture": True}


@module.app.middleware("http")
async def fixture_banner(request, call_next):
    response = await call_next(request)
    if response.headers.get("content-type", "").startswith("text/html"):
        content = b"".join([chunk async for chunk in response.body_iterator]).decode()
        content = content.replace(
            "<body>",
            '<body><div class="fixture-banner">Local preview · sample data and a test user · no live scans or AI calls</div>',
        )
        return HTMLResponse(content, headers={"X-Slop-Guard-Fixture": "true"})
    return response


if __name__ == "__main__":
    print("Developer fixture: http://127.0.0.1:8041/reports/local-fixture")
    try:
        uvicorn.run(module.app, host="127.0.0.1", port=8041, workers=1)
    finally:
        fixture_dir.cleanup()
