import asyncio
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo
from datetime import timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from slopguard import db, review, scanner
from slopguard.app import app

COVERAGE = {
    "eligible": 1,
    "inspected": 1,
    "bytes": 200,
    "partial": False,
    "reasons": [],
    "tree_complete": True,
}
CLEAN = "\n".join(["def plus(a, b):", "    return a + b"] + [""] * 10)
MESSY = "import os\n\ndef test_payment():\n    assert True\n\ndef decide(flag):\n    if flag:\n        return 1\n    else:\n        return 1\n\ndef missing():\n    return nonexistent\n"


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.sqlite3"))
    monkeypatch.setenv("GEMINI_FREE_TIER_CONFIRMED", "false")
    monkeypatch.setenv("REVIEW_PROVIDER", "gemini")
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("CLOUDFLARE_FREE_PLAN_CONFIRMED", "false")
    monkeypatch.setenv("CLOUDFLARE_ROAST_RPM", "150")
    monkeypatch.setenv("CLOUDFLARE_NEURONS_PER_DAY", "5000")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    monkeypatch.setenv("ADMIN_GOOGLE_SUBS", "admin")
    monkeypatch.setenv(
        "PATH",
        str(os.path.dirname(os.sys.executable)) + os.pathsep + os.environ["PATH"],
    )
    db.migrate()


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def identify(client, identity="owner"):
    token = "test-session-" + identity
    with db.connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users VALUES (?,?)", (identity, "Test member")
        )
        conn.execute(
            "INSERT OR REPLACE INTO sessions VALUES (?,?,?)",
            (token, identity, time.time() + 1000),
        )
    client.cookies.set("session", token)


@pytest.fixture
def mocked_scan(monkeypatch):
    calls = []

    async def resolve(repo):
        return "a" * 40

    async def fetch(repo, sha):
        calls.append(repo)
        return {"tests/test_pay.py": MESSY}, dict(COVERAGE)

    monkeypatch.setattr(scanner, "resolve", resolve)
    monkeypatch.setattr(scanner, "fetch_files", fetch)
    return calls


def test_scan_export_and_cache(client, mocked_scan):
    first = client.post("/api/scans", json={"repo": "owner/repo"}).json()
    assert first["sha"] == "a" * 40
    assert first["ai"]["score"] is None
    assert {"empty-test", "identical-branches", "F821", "F401"} <= {
        f["rule"] for f in first["findings"]
    }
    assert all("/blob/" + first["sha"] + "/" in f["url"] for f in first["findings"])
    second = client.post(
        "/api/scans", json={"repo": "https://github.com/owner/repo"}
    ).json()
    assert second["cache_hit"] and first["id"] == second["id"] and len(mocked_scan) == 1
    for url in [
        f"/api/reports/{first['id']}",
        f"/api/reports/{first['id']}/plan",
        f"/api/reports/{first['id']}/plan?download=true",
    ]:
        response = client.get(url)
        assert response.status_code == 200
    plan = client.get(f"/api/reports/{first['id']}/plan").text
    assert "Deterministic checklist" in plan and "Confirm each finding" in plan
    assert db.rows("SELECT count(*) n FROM quota")[0]["n"] == 0
    assert (
        "attachment"
        in client.get(f"/api/reports/{first['id']}/plan?download=true").headers[
            "content-disposition"
        ]
    )


def test_scoring_and_counterexample():
    clean = scanner.analyze({"a.py": CLEAN}, COVERAGE)
    assert clean["score"] == 0 and not clean["findings"]
    messy = scanner.analyze({"a.py": MESSY}, COVERAGE)
    assert messy == scanner.analyze({"a.py": MESSY}, COVERAGE)
    useful = scanner.analyze(
        {
            "a.py": CLEAN
            + "\n"
            + "\n".join("# Explains a real invariant." for _ in range(100))
        },
        COVERAGE,
    )
    assert useful["score"] < messy["score"]
    assert scanner.analyze({}, COVERAGE)["score"] is None


def test_unicode_source_and_js_parser():
    result = scanner.analyze(
        {"unicode.py": MESSY + "\n# █ useful Unicode explanation\n"}, COVERAGE
    )
    assert any(f["rule"] == "F401" for f in result["findings"])
    result = scanner.analyze(
        {"bad.ts": "export const result: number = ;\n" + ("\n" * 10)}, COVERAGE
    )
    assert any(f["rule"].startswith("TS") for f in result["findings"])


def test_readme_command_requires_complete_tree():
    c = dict(
        COVERAGE,
        readme={"path": "README.md", "text": "```sh\npython scripts/missing.py\n```"},
        paths=["a.py"],
    )
    result = scanner.analyze({"a.py": CLEAN}, c)
    assert any(f["rule"] == "missing-script" for f in result["findings"])
    assert not any(
        f["rule"] == "missing-script"
        for f in scanner.analyze({"a.py": CLEAN}, dict(c, tree_complete=False))[
            "findings"
        ]
    )


@pytest.mark.parametrize(
    "path,mode,kind,allowed",
    [
        ("src/a.py", "100644", "blob", True),
        ("node_modules/a.js", "100644", "blob", False),
        ("dist/a.ts", "100644", "blob", False),
        ("x.min.js", "100644", "blob", False),
        ("x.d.ts", "100644", "blob", False),
        ("x.py", "120000", "blob", False),
        ("x.py", "160000", "commit", False),
        ("image.png", "100644", "blob", False),
        (".env", "100644", "blob", False),
    ],
)
def test_file_exclusions(path, mode, kind, allowed):
    assert (
        scanner.eligible({"path": path, "mode": mode, "type": kind, "size": 20})
        == allowed
    )


@pytest.mark.parametrize(
    "value",
    [
        "https://evil.test/a/b",
        "owner/repo/tree/main",
        "../repo",
        "a/.",
        "file:///repo",
        "https://github.com/a/b?token=secret",
    ],
)
def test_url_rejections(value):
    with pytest.raises(scanner.ScanError):
        scanner.parse_repo(value)


def enable(monkeypatch, rpm=1, rpd=2, tpm=10000):
    for key, value in {
        "AI_ENABLED": "true",
        "DEPLOYMENT_AUDIENCE": "local-adult-pilot",
        "GEMINI_BILLING_DISABLED": "true",
        "GEMINI_VERIFIED_UNTIL": (
            datetime.now(timezone.utc) + timedelta(days=1)
        ).isoformat(),
        "GEMINI_API_KEY": "test-not-a-key",
        "GEMINI_MODEL": "gemini-3.1-flash-lite",
        "GEMINI_FREE_TIER_CONFIRMED": "true",
        "GEMINI_AUDIENCE_ELIGIBLE": "true",
        "GEMINI_RPM": str(rpm),
        "GEMINI_RPD": str(rpd),
        "GEMINI_TPM": str(tpm),
    }.items():
        monkeypatch.setenv(key, value)


def test_quota_cooldown_exhaustion_restart(monkeypatch):
    enable(monkeypatch)
    now = datetime(2026, 11, 20, 12, tzinfo=ZoneInfo("America/Los_Angeles")).timestamp()
    assert review.reserve(100, now)
    assert not review.reserve(100, now + 1)
    assert review.reserve(100, now + 61)
    with db.connect() as conn:
        assert review.quota_status(conn, now + 130)["state"] == "exhausted"
    db.migrate()  # Simulate restart, durable data remains.
    assert not review.reserve(100, now + 140)
    assert review.reserve(100, review.day_bounds(now)[1] + 1)


def test_token_limit_separate(monkeypatch):
    enable(monkeypatch, rpm=100, tpm=100)
    assert review.reserve(80)
    assert not review.reserve(30)


def test_atomic_reservations(monkeypatch):
    enable(monkeypatch, rpm=50, rpd=1)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: review.reserve(50), range(6)))
    assert sum(results) == 1


def test_unknown_retry(monkeypatch):
    enable(monkeypatch)
    with db.connect() as conn:
        conn.execute("INSERT INTO settings VALUES (?,?)", ("provider_retry", "-1"))
    with db.connect() as conn:
        result = review.quota_status(conn, time.time())
    assert result["state"] == "unknown" and result["retry_at"] is None
    assert not review.reserve(10)


@pytest.mark.parametrize("date,hours", [("2026-03-08", 23), ("2026-11-01", 25)])
def test_dst_reset(date, hours):
    now = (
        datetime.fromisoformat(date)
        .replace(hour=12, tzinfo=ZoneInfo("America/Los_Angeles"))
        .timestamp()
    )
    start, end = review.day_bounds(now)
    assert end - start == hours * 3600


def test_review_evidence_validation():
    entry = dict(
        path="x.py",
        start=1,
        end=1,
        evidence="assert True",
        title="Test",
        roast="Roast",
        consequence="Consequence",
        fix="Correction",
        check="Verify",
        confidence="high",
    )
    assert (
        len(review.validate_review({"findings": [entry]}, {"x.py": "assert True"})) == 1
    )
    assert not review.validate_review(
        {"findings": [dict(entry, evidence="made up")]}, {"x.py": "assert True"}
    )
    assert not review.validate_review(
        {"findings": [dict(entry, start=0)]}, {"x.py": "assert True"}
    )
    assert not review.validate_review(
        {"findings": [dict(entry, path="../secret")]}, {"x.py": "assert True"}
    )


def test_community_auth_ownership_votes_and_replies(client):
    body = {
        "kind": "project",
        "title": "My project",
        "body": "An honest description of my project.",
        "url": "https://github.com/a/b",
    }
    assert client.post("/api/content", json=body).status_code == 401
    identify(client)
    item = client.post("/api/content", json=body).json()["id"]
    assert (
        client.put(
            "/api/content/" + item, json=dict(body, title="Updated project")
        ).status_code
        == 200
    )
    for value in [1, 1, -1, 0]:
        assert (
            client.post(f"/api/content/{item}/vote", json={"value": value}).status_code
            == 200
        )
        row = client.get("/api/content?kind=project").json()[0]
        assert row["votes"] == value and row["my_vote"] == value
    identify(client, "other")
    assert client.put("/api/content/" + item, json=body).status_code == 403
    topic = client.post(
        "/api/content",
        json={
            "kind": "topic",
            "title": "Question about this code",
            "body": "What is the expected outcome?",
        },
    ).json()["id"]
    assert (
        client.post(
            "/api/content",
            json={
                "kind": "reply",
                "parent": topic,
                "title": "Reply",
                "body": "Here is a useful response.",
            },
        ).status_code
        == 200
    )
    assert client.post("/api/content", json=dict(body, consent=True)).status_code == 400
    assert (
        client.post(
            "/api/content", json=dict(body, url="javascript:alert(1)")
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/content/{item}/report", json={"reason": "This is unwanted spam."}
        ).status_code
        == 200
    )
    assert client.get("/api/admin").status_code == 403
    identify(client, "admin")
    assert len(client.get("/api/admin").json()) == 1
    assert client.post(f"/api/admin/{item}/hide").status_code == 200
    assert not client.get("/api/content?kind=project").json()
    assert "email" not in client.get("/api/config").text


def test_attached_discussion(client, mocked_scan):
    report = client.post("/api/scans", json={"repo": "owner/repo"}).json()
    identify(client)
    response = client.post(
        "/api/content",
        json={
            "kind": "topic",
            "title": "Is this finding correct?",
            "body": "I think this finding needs another look.",
            "report": report["id"],
            "finding": report["findings"][0]["id"],
        },
    )
    assert response.status_code == 200
    evidence = json.loads(client.get("/api/content?kind=topic").json()[0]["evidence"])
    assert (
        evidence["sha"] == report["sha"]
        and evidence["finding"]["url"] == report["findings"][0]["url"]
    )


def test_google_login_and_returning_identity(client, monkeypatch):
    assert client.post("/api/login", json={"credential": "invalid"}).status_code == 503
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client")
    from google.oauth2 import id_token

    def verify(token, request, audience):
        assert audience == "test-client"
        if token == "invalid":
            raise ValueError("invalid")
        return {
            "sub": "google-sub",
            "iss": "https://accounts.google.com",
            "email_verified": True,
            "email": "private@example.test",
            "name": "Member",
        }

    monkeypatch.setattr(id_token, "verify_oauth2_token", verify)
    assert client.post("/api/login", json={"credential": "invalid"}).status_code == 401
    for _ in range(2):
        result = client.post("/api/login", json={"credential": "valid"})
        assert result.status_code == 200 and "HttpOnly" in result.headers["set-cookie"]
        assert client.get("/api/config").json()["user"]["id"] == "google-sub"
    assert len(db.rows("SELECT * FROM users")) == 1
    assert "private@example.test" not in str(db.rows("SELECT * FROM users"))
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/config").json()["user"] is None


def test_csrf_and_headers(client):
    assert (
        client.post(
            "/api/scans", json={"repo": "a/b"}, headers={"origin": "https://evil.test"}
        ).status_code
        == 403
    )
    for route in [
        "/",
        "/community",
        "/library",
        "/forum",
        "/portfolio",
        "/methodology",
    ]:
        response = client.get(route)
        assert (
            response.status_code == 200
            and response.headers["x-content-type-options"] == "nosniff"
        )
    assert client.get("/api/not-a-real-endpoint").status_code == 404


def test_provider_retry_and_conservative_accounting(monkeypatch):
    enable(monkeypatch, tpm=100000)
    import httpx

    class Provider:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            return httpx.Response(
                429,
                headers={"retry-after": "90"},
                request=httpx.Request("POST", "https://provider.test/"),
            )

    monkeypatch.setattr(review.httpx, "AsyncClient", lambda **kwargs: Provider())
    result = asyncio.run(review.review({"a.py": CLEAN}))
    assert result["status"] == "unavailable"
    assert db.rows("SELECT count(*) n FROM quota")[0]["n"] == 1
    with db.connect() as conn:
        state = review.quota_status(conn, time.time())
    assert state["state"] == "cooldown" and state["retry_at"] > time.time() + 80


def test_duplicate_inflight_reuses_work(monkeypatch):
    import httpx

    calls = []

    async def resolve(repo):
        return "b" * 40

    async def fetch(repo, sha):
        calls.append(repo)
        await asyncio.sleep(0.02)
        return {"a.py": CLEAN}, dict(COVERAGE)

    monkeypatch.setattr(scanner, "resolve", resolve)
    monkeypatch.setattr(scanner, "fetch_files", fetch)

    async def run():
        from slopguard import app as module

        module.scan_lock = asyncio.Lock()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            responses = await asyncio.gather(
                *[client.post("/api/scans", json={"repo": "a/b"}) for _ in range(3)]
            )
        return responses

    responses = asyncio.run(run())
    assert all(r.status_code == 200 for r in responses)
    assert len({r.json()["id"] for r in responses}) == 1 and len(calls) == 1


def test_policy_fail_closed(monkeypatch):
    from slopguard import policy

    enable(monkeypatch)
    assert policy.gate("gemini", review.model()) is None
    monkeypatch.setenv("DEPLOYMENT_AUDIENCE", "public")
    assert not review.enabled()
    monkeypatch.setenv("DEPLOYMENT_AUDIENCE", "local-adult-pilot")
    monkeypatch.setenv("GEMINI_VERIFIED_UNTIL", "2020-01-01T00:00:00Z")
    assert not review.enabled()
    assert policy.gate("gemini", "gemini-paid-model")
    monkeypatch.setenv(
        "GEMINI_VERIFIED_UNTIL",
        (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
    )
    assert not review.enabled()


def test_secret_filter(monkeypatch):
    from slopguard import policy

    secret = "AIza" + "a" * 35
    safe, skipped = policy.safe_excerpts(
        {"secret.py": f'API_KEY="{secret}"', "fine.py": CLEAN}
    )
    assert set(safe) == {"fine.py"} and skipped == ["secret.py"]


def test_unique_quotation_can_repair_model_line_anchor():
    entry = {
        "path": "x.py",
        "start": 1,
        "end": 1,
        "evidence": "assert True",
        "title": "Test",
        "roast": "Roast",
        "consequence": "Consequence",
        "fix": "Fix",
        "check": "Check",
        "confidence": "high",
    }
    valid = review.validate_review(
        {"findings": [entry]}, {"x.py": "def test_x():\n    assert True\n"}
    )
    assert (
        len(valid) == 1
        and valid[0]["start"] == 2
        and valid[0]["evidence"] == "    assert True"
    )
    assert "corrected" in valid[0]["evidence_alignment"]
    corrected = review.validate_review(
        {
            "findings": [
                dict(entry, start=52, end=95, evidence="def test_x():\n    assert True")
            ]
        },
        {"x.py": "def test_x():\n    assert True\n"},
    )
    assert (
        len(corrected) == 1 and corrected[0]["start"] == 1 and corrected[0]["end"] == 2
    )
    assert corrected[0]["model_claimed_location"] == {"start": 52, "end": 95}
    assert not review.validate_review(
        {"findings": [entry]},
        {"x.py": "def test_x():\n    assert True\n    assert True\n"},
    )


def test_social_consent_verification_and_revocation(client, mocked_scan):
    report = client.post("/api/scans", json={"repo": "owner/repo"}).json()
    identify(client)
    body = {
        "report": report["id"],
        "finding": report["findings"][0]["id"],
        "maintainer": True,
        "consent": True,
        "proof_url": "https://github.com/owner/repo/issues/1",
        "credit": "Anonymous",
    }
    assert client.post("/api/social", json=dict(body, consent=False)).status_code == 400
    item = client.post("/api/social", json=body).json()["id"]
    identify(client, "admin")
    assert client.get(f"/api/admin/social/{item}/draft").status_code == 403
    assert (
        client.post(
            f"/api/admin/social/{item}/verify",
            json={
                "notes": "Fixture: manually confirmed maintainer ownership and explicit consent."
            },
        ).status_code
        == 200
    )
    assert "publishing is manual" in client.get(f"/api/admin/social/{item}/draft").text
    identify(client, "other")
    assert client.delete("/api/social/" + item).status_code == 403
    identify(client)
    assert client.delete("/api/social/" + item).status_code == 200
    identify(client, "admin")
    assert client.get(f"/api/admin/social/{item}/draft").status_code == 403


def test_groq_strict_request_and_token_budget(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setenv("REVIEW_PROVIDER", "groq")
    for k, v in {
        "GROQ_API_KEY": "fixture",
        "GROQ_FREE_TIER_CONFIRMED": "true",
        "GROQ_BILLING_DISABLED": "true",
        "GROQ_VERIFIED_UNTIL": (
            datetime.now(timezone.utc) + timedelta(days=1)
        ).isoformat(),
        "GROQ_RPM": "30",
        "GROQ_RPD": "1000",
        "GROQ_TPM": "4000",
        "GROQ_TPD": "200000",
    }.items():
        monkeypatch.setenv(k, v)
    import httpx

    captured = []

    class Provider:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            captured.append(kwargs["json"])
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": '{"findings":[]}'}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr(review.httpx, "AsyncClient", lambda **kwargs: Provider())
    result = asyncio.run(review.review({"a.py": CLEAN}))
    assert result["status"] == "reviewed" and result["provider"] == "groq"
    assert review.groq_reservation(captured[0]) <= 4000
    assert captured[0]["reasoning_effort"] == "low"
    schema = captured[0]["response_format"]["json_schema"]
    assert schema["strict"] and schema["schema"]["additionalProperties"] is False
    assert (
        schema["schema"]["properties"]["findings"]["items"]["additionalProperties"]
        is False
    )
    monkeypatch.setenv("GROQ_TPD", "1")
    assert not review.reserve(10)


def test_cloudflare_changes_only_cached_presentation(monkeypatch):
    from slopguard import roast
    import copy
    import httpx

    for key, value in {
        "AI_ENABLED": "true",
        "CLOUDFLARE_FREE_PLAN_CONFIRMED": "true",
        "CLOUDFLARE_BILLING_DISABLED": "true",
        "CLOUDFLARE_VERIFIED_UNTIL": (
            datetime.now(timezone.utc) + timedelta(days=1)
        ).isoformat(),
        "CLOUDFLARE_ACCOUNT_ID": "fixture",
        "CLOUDFLARE_API_TOKEN": "fixture",
        "CLOUDFLARE_ROAST_RPD": "1",
    }.items():
        monkeypatch.setenv(key, value)
    findings = scanner.analyze({"test_a.py": MESSY}, COVERAGE)["findings"]
    original = copy.deepcopy(findings)

    class Provider:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            assert kwargs["json"]["model"] == roast.MODEL
            result = {
                "roasts": [
                    {
                        "id": findings[0]["id"],
                        "options": [
                            "This test is too agreeable.",
                            "A green check on vacation.",
                            "An assertion with no ambition.",
                        ],
                    }
                ]
            }
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": json.dumps(result)}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr(roast.httpx, "AsyncClient", lambda **kwargs: Provider())
    assert asyncio.run(roast.refine(findings)) == roast.MODEL
    for before, after in zip(original, findings):
        assert all(before[k] == after[k] for k in before if k != "roast")
    assert not roast.reserve()


def test_disabled_provider_consumes_no_allowance(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")

    def forbidden(*args, **kwargs):
        raise AssertionError("No external calls when disabled")

    monkeypatch.setattr(review.httpx, "AsyncClient", forbidden)
    assert asyncio.run(review.review({"a.py": CLEAN}))["status"] == "unavailable"
    assert not db.rows("SELECT * FROM quota")


def enable_cloudflare(monkeypatch, neurons=5000, rpm=150):
    for key, value in {
        "AI_ENABLED": "true",
        "CLOUDFLARE_FREE_PLAN_CONFIRMED": "true",
        "CLOUDFLARE_BILLING_DISABLED": "true",
        "CLOUDFLARE_VERIFIED_UNTIL": (
            datetime.now(timezone.utc) + timedelta(days=1)
        ).isoformat(),
        "CLOUDFLARE_ACCOUNT_ID": "fixture",
        "CLOUDFLARE_API_TOKEN": "fixture",
        "CLOUDFLARE_ROAST_RPM": str(rpm),
        "CLOUDFLARE_NEURONS_PER_DAY": str(neurons),
        "CLOUDFLARE_ROAST_RPD": "0",
    }.items():
        monkeypatch.setenv(key, value)


def test_cloudflare_neuron_budget_restart_and_reset(monkeypatch):
    from slopguard import roast

    enable_cloudflare(monkeypatch)
    now = datetime(2026, 11, 20, 12, tzinfo=timezone.utc).timestamp()
    assert roast.reserve(3000, now)
    db.migrate()
    assert roast.reserve(2000, now + 61)
    assert not roast.reserve(1, now + 62)
    assert roast.reserve(5000, now + 86400)


def test_cloudflare_atomic_neurons_and_minute_cap(monkeypatch):
    from slopguard import roast

    enable_cloudflare(monkeypatch)
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(lambda _: roast.reserve(3000), range(5)))
    assert sum(results) == 1
    monkeypatch.setenv("CLOUDFLARE_ROAST_RPM", "1")
    assert not roast.reserve(1)


def test_explicit_scan_opt_out_makes_no_model_requests(
    client, mocked_scan, monkeypatch
):
    from slopguard import roast

    async def forbidden(*args, **kwargs):
        raise AssertionError("Opt-out must not call either provider")

    monkeypatch.setattr(review, "review", forbidden)
    monkeypatch.setattr(roast, "refine", forbidden)
    result = client.post("/api/scans", json={"repo": "owner/repo", "include_ai": False})
    assert result.status_code == 200 and result.json()["score"] is not None
    assert not db.rows("SELECT * FROM quota")


def test_daily_token_exhaustion_visible_without_pending_request(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setenv("GEMINI_TPD", "100")
    assert review.reserve(100)
    with db.connect() as conn:
        assert review.quota_status(conn, time.time())["state"] == "exhausted"


def test_actual_usage_separate_from_reserved_capacity(monkeypatch):
    from slopguard import usage
    import httpx

    enable(monkeypatch)
    request_id = review.reserve(900)
    usage.record(
        request_id,
        "succeeded",
        httpx.Response(
            200,
            json={
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                    "total_tokens": 150,
                }
            },
        ),
    )
    row = db.rows("SELECT * FROM quota WHERE id=?", (request_id,))[0]
    assert (
        row["tokens"],
        row["input_tokens"],
        row["output_tokens"],
        row["total_tokens"],
    ) == (900, 100, 50, 150)
    assert row["status"] == "succeeded" and row["http_status"] == 200
    usage.record(request_id, "failed")
    row = db.rows("SELECT * FROM quota WHERE id=?", (request_id,))[0]
    assert (
        row["tokens"] == 900
        and row["total_tokens"] is None
        and row["status"] == "failed"
    )


def test_retry_details_and_dates():
    import httpx

    assert (
        review.retry_timestamp(
            httpx.Response(429, json={"error": {"details": [{"retryDelay": "35s"}]}})
        )
        > time.time() + 30
    )
    assert (
        review.retry_timestamp(
            httpx.Response(
                429, headers={"retry-after": "Fri, 20 Nov 2026 22:00:00 GMT"}
            )
        )
        == datetime(2026, 11, 20, 22, tzinfo=timezone.utc).timestamp()
    )


def github_mock(monkeypatch, handler, keep_cache=False):
    """Route scanner GitHub calls to an in-process handler; no network."""
    import httpx

    if not keep_cache:
        scanner.reset_github_state()
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    seen = []

    def record(request):
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(
        scanner,
        "_new_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(record)),
    )
    return seen


def fake_github(blobs, limits=None):
    import base64 as b64

    import httpx

    def handler(request):
        path = request.url.path
        headers = {"etag": '"v1"', **(limits or {})}
        if request.headers.get("if-none-match") == '"v1"':
            return httpx.Response(304, headers=headers)
        if path == "/repos/o/r":
            body = {"private": False, "default_branch": "main"}
        elif path == "/repos/o/r/commits/main":
            body = {"sha": "c" * 40}
        elif "/git/trees/" in path:
            body = {
                "truncated": False,
                "tree": [
                    {
                        "path": name,
                        "type": "blob",
                        "mode": "100644",
                        "sha": sha,
                        "size": 10,
                    }
                    for name, sha in blobs.items()
                ],
            }
        elif "/git/blobs/" in path:
            sha = path.rsplit("/", 1)[1]
            body = {"content": b64.b64encode(f"x = '{sha}'\n".encode()).decode()}
        else:
            return httpx.Response(404)
        return httpx.Response(200, json=body, headers=headers)

    return handler


def test_github_resolve_memoized_then_revalidated(monkeypatch):
    seen = github_mock(monkeypatch, fake_github({}))
    assert asyncio.run(scanner.resolve("o/r")) == "c" * 40
    assert asyncio.run(scanner.resolve("O/R")) == "c" * 40
    assert len(seen) == 2
    scanner.state.resolved.clear()
    assert asyncio.run(scanner.resolve("o/r")) == "c" * 40
    assert len(seen) == 4 and all(
        r.headers["if-none-match"] == '"v1"' for r in seen[2:]
    )
    assert all("authorization" not in r.headers for r in seen)


def test_github_blobs_reused_across_commits(monkeypatch):
    seen = github_mock(monkeypatch, fake_github({"a.py": "1" * 40, "b.py": "2" * 40}))
    files, coverage = asyncio.run(scanner.fetch_files("o/r", "d" * 40))
    assert len(files) == 2 and coverage["inspected"] == 2 and len(seen) == 3
    # Next commit changes one file: only that blob is requested.
    seen = github_mock(
        monkeypatch, fake_github({"a.py": "1" * 40, "b.py": "3" * 40}), keep_cache=True
    )
    files, _ = asyncio.run(scanner.fetch_files("o/r", "e" * 40))
    assert len(files) == 2
    assert [r.url.path.rsplit("/", 1)[1] for r in seen if "/blobs/" in r.url.path] == [
        "3" * 40
    ]
    seen.clear()
    asyncio.run(scanner.fetch_files("o/r", "e" * 40))
    assert seen == []


def test_github_rate_limit_stops_before_spending(monkeypatch):
    reset = int(time.time()) + 600
    limits = {"x-ratelimit-remaining": "2", "x-ratelimit-reset": str(reset)}
    seen = github_mock(
        monkeypatch, fake_github({f"{n}.py": f"{n}" * 40 for n in range(5)}, limits)
    )
    with pytest.raises(scanner.ScanError, match="Try again in about 10 minutes"):
        asyncio.run(scanner.fetch_files("o/r", "d" * 40))
    assert len(seen) == 1  # only the tree; no blobs started that could not finish

    import httpx

    def exhausted(request):
        return httpx.Response(
            403, headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": str(reset)}
        )

    seen = github_mock(monkeypatch, exhausted)
    with pytest.raises(scanner.ScanError, match="limit is reached"):
        asyncio.run(scanner.resolve("o/r"))
    with pytest.raises(scanner.ScanError, match="too low"):
        asyncio.run(scanner.resolve("x/y"))
    assert len(seen) == 1


def test_github_forbidden_and_token(monkeypatch):
    import httpx

    seen = github_mock(monkeypatch, lambda request: httpx.Response(403))
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    with pytest.raises(scanner.ScanError, match="refused access"):
        asyncio.run(scanner.resolve("o/r"))
    assert seen[0].headers["authorization"] == "Bearer test-token"
    assert "test-token" not in str(seen[0].url)


def test_topic_reply_counts_are_exact_past_the_list_cap(client):
    identify(client)
    topics = [
        client.post(
            "/api/content",
            json={
                "kind": "topic",
                "title": f"Topic {n}",
                "body": "A question about a finding.",
            },
        ).json()["id"]
        for n in range(2)
    ]
    # More replies than the 100-item list returns, all older than the
    # second topic's single reply.
    now = time.time()
    with db.connect() as conn:
        conn.executemany(
            "INSERT INTO contributions (id,kind,owner,title,body,parent,created) VALUES (?,?,?,?,?,?,?)",
            [
                (
                    f"r{n:03}",
                    "reply",
                    "owner",
                    "Reply",
                    "A useful reply.",
                    topics[0],
                    now - 1000 + n,
                )
                for n in range(120)
            ],
        )
        conn.execute(
            "INSERT INTO contributions (id,kind,owner,title,body,parent,created) VALUES (?,?,?,?,?,?,?)",
            ("r-other", "reply", "owner", "Reply", "A useful reply.", topics[1], now),
        )
        conn.execute("UPDATE contributions SET hidden=1 WHERE id='r005'")
    assert len(client.get("/api/content?kind=reply").json()) == 100
    counts = {
        t["id"]: t["replies"] for t in client.get("/api/content?kind=topic").json()
    }
    assert counts == {topics[0]: 119, topics[1]: 1}
    own = client.get(f"/api/content?kind=reply&parent={topics[0]}").json()
    assert len(own) == 119 and own[0]["id"] == "r000" and own[-1]["id"] == "r119"
    assert "r005" not in {r["id"] for r in own}
    assert [
        r["id"]
        for r in client.get(f"/api/content?kind=reply&parent={topics[1]}").json()
    ] == ["r-other"]
