"""Run via stdin in a disposable, resource-limited container. No provider calls."""

import asyncio
import json
import os
import time
from pathlib import Path

os.environ["AI_ENABLED"] = "false"
os.environ["SLOP_DB"] = "/tmp/representative.sqlite3"

import httpx
from slopguard import app as module
from slopguard import db, scanner


async def resolve(repo):
    return "f" * 40


async def fetch(repo, sha):
    source = (
        "def calculate(value):\n"
        + "".join(f"    value += {i}\n" for i in range(400))
        + "    return value\n"
    )
    files = {f"fixture_{i:02}.py": source for i in range(35)}
    files["syntax.ts"] = "export const value: number = ;\n" + "\n" * 10
    return files, {
        "eligible": 36,
        "inspected": 36,
        "bytes": sum(len(s) for s in files.values()),
        "partial": False,
        "reasons": ["Explicit synthetic container measurement."],
        "tree_complete": True,
    }


async def main():
    db.migrate()
    scanner.resolve = resolve
    scanner.fetch_files = fetch
    done = False
    count = 0
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=module.app), base_url="http://testserver"
    ) as client:

        async def browse():
            nonlocal count
            while not done:
                assert (await client.get("/")).status_code == 200
                count += 1
                await asyncio.sleep(0.02)

        visitor = asyncio.create_task(browse())
        started = time.monotonic()
        response = await client.post(
            "/api/scans", json={"repo": "local-fixture/container", "include_ai": False}
        )
        done = True
        await visitor
        assert response.status_code == 200, response.text
        report = response.json()
        assert any(f["rule"].startswith("TS") for f in report["findings"]), report[
            "checks"
        ]
        assert not db.rows("SELECT * FROM quota")
        result = {
            "scope": "synthetic container API scan; no external network",
            "runtime_seconds": round(time.monotonic() - started, 2),
            "parallel_homepage_responses": count,
            "files": report["coverage"]["inspected"],
            "source_bytes": report["coverage"]["bytes"],
            "cgroup_peak_mib": round(
                int(Path("/sys/fs/cgroup/memory.peak").read_text()) / 1024**2, 2
            ),
            "memory_limit_bytes": Path("/sys/fs/cgroup/memory.max").read_text().strip(),
            "cpu_quota": Path("/sys/fs/cgroup/cpu.max").read_text().strip(),
            "uid": os.getuid(),
            "schema": db.rows("PRAGMA user_version")[0]["user_version"],
        }
        print(json.dumps(result, indent=2))


asyncio.run(main())
