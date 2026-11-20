"""Read-only public scan and local process-tree memory observation. No AI calls."""

import asyncio
import json
import os
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import psutil
from slopguard.scanner import analyze, fetch_files, resolve

peak = 0
done = threading.Event()


def sample():
    global peak
    process = psutil.Process()
    while not done.is_set():
        children = process.children(recursive=True)
        total = process.memory_info().rss
        for child in children:
            try:
                total += child.memory_info().rss
            except psutil.NoSuchProcess:
                pass
        peak = max(peak, total)
        time.sleep(0.02)


async def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "pallets/click"
    sha = await resolve(repo)
    files, coverage = await fetch_files(repo, sha)
    result = await asyncio.to_thread(analyze, files, coverage)
    print(
        json.dumps(
            {
                "repo": repo,
                "sha": sha,
                "inspected": coverage["inspected"],
                "eligible": coverage["eligible"],
                "reasons": coverage["reasons"],
                "score": result["score"],
                "findings": len(result["findings"]),
                "checks": result["checks"],
                "peak_process_tree_mib": round(peak / 1024**2, 2),
                "platform": sys.platform,
                "cpu_count": os.cpu_count(),
                "host_ram_mib": round(psutil.virtual_memory().total / 1024**2),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    try:
        asyncio.run(main())
    finally:
        done.set()
