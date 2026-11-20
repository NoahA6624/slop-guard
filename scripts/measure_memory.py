"""Local fixture scan through the API while a second visitor browses. No network/model."""

import json
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["GEMINI_FREE_TIER_CONFIRMED"] = "false"
os.environ["AI_ENABLED"] = "false"
import psutil
from fastapi.testclient import TestClient
from slopguard import db, scanner
from slopguard.app import app

peak = 0
done = threading.Event()
browse_count = 0


def observe(client):
    global peak, browse_count
    process = psutil.Process()
    while not done.is_set():
        total = process.memory_info().rss
        for child in process.children(recursive=True):
            try:
                total += child.memory_info().rss
            except psutil.NoSuchProcess:
                pass
        peak = max(peak, total)
        assert client.get("/").status_code == 200
        browse_count += 1
        time.sleep(0.02)


async def resolve(repo):
    return "f" * 40


async def fetch(repo, sha):
    source = (
        "def calculate(value):\n"
        + "".join(f"    value += {i}\n" for i in range(400))
        + "    return value\n"
    )
    files = {f"fixture_{i:02}.py": source for i in range(35)}
    return files, {
        "inspected": 35,
        "eligible": 35,
        "bytes": sum(len(s) for s in files.values()),
        "partial": False,
        "reasons": [],
        "tree_complete": True,
    }


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as directory:
        db.DB_PATH = str(Path(directory) / "memory.sqlite3")
        scanner.resolve = resolve
        scanner.fetch_files = fetch
        with TestClient(app) as client:
            worker = threading.Thread(target=observe, args=(client,), daemon=True)
            worker.start()
            started = time.monotonic()
            response = client.post(
                "/api/scans", json={"repo": "local-fixture/representative"}
            )
            done.set()
            worker.join()
            assert response.status_code == 200, response.text
            report = response.json()
            print(
                json.dumps(
                    {
                        "source": "synthetic fixtures, not a public scan",
                        "files": report["coverage"]["inspected"],
                        "bytes": report["coverage"]["bytes"],
                        "parallel_homepage_responses": browse_count,
                        "runtime_seconds": round(time.monotonic() - started, 2),
                        "peak_app_and_child_rss_mib": round(peak / 1024**2, 2),
                        "platform": sys.platform,
                        "host_logical_cpus": os.cpu_count(),
                        "host_ram_mib": round(psutil.virtual_memory().total / 1024**2),
                        "linux_512_mib_target": "unverified: Windows host, no cgroup or one-vCPU constraint",
                    },
                    indent=2,
                )
            )
