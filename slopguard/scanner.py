"""Only parse text. Never import or execute submitted source or configuration."""

import ast
import base64
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import PurePosixPath
from urllib.parse import quote

import httpx

RUBRIC = "1.0"
MAX_FILES = 35
MAX_BYTES = 280_000
MAX_FILE = 40_000
EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
EXCLUDED = {
    "node_modules",
    "vendor",
    "dist",
    "build",
    ".git",
    ".venv",
    "venv",
    "coverage",
    "__pycache__",
    "generated",
    "fixtures",
}


class ScanError(Exception):
    pass


def parse_repo(value):
    match = re.fullmatch(
        r"(?:https://github\.com/)?([A-Za-z0-9_.-]{1,100})/([A-Za-z0-9_.-]{1,100})/?",
        value.strip(),
    )
    if not match:
        raise ScanError(
            "Enter a public GitHub repository URL or owner/repo. Branch and file URLs are not supported."
        )
    owner, repo = match.groups()
    repo = repo.removesuffix(".git")
    if owner in {".", ".."} or repo in {"", ".", ".."}:
        raise ScanError("That repository address is not valid.")
    return f"{owner}/{repo}"


def eligible(item):
    p = PurePosixPath(item["path"])
    return (
        item.get("type") == "blob"
        and item.get("mode") in {"100644", "100755"}
        and not any(x in EXCLUDED or x.startswith(".") for x in p.parts)
        and p.suffix in EXTENSIONS
        and not re.search(r"\.(min|generated|bundle|d)\.", p.name)
        and item.get("size", MAX_FILE + 1) <= MAX_FILE
    )


async def github(path):
    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
        async with client.stream(
            "GET",
            "https://api.github.com" + path,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "Slop-Guard-local",
            },
        ) as response:
            chunks = bytearray()
            async for chunk in response.aiter_bytes():
                chunks.extend(chunk)
                if len(chunks) > 9_000_000:
                    raise ScanError(
                        "The repository inventory exceeded the safe response limit."
                    )
    if response.status_code == 404:
        raise ScanError(
            "Repository or revision not found. Only public repositories are supported."
        )
    if response.status_code in {403, 429}:
        raise ScanError(
            "GitHub’s public API limit is reached. Try again after its reset; cached reports still work."
        )
    if response.status_code != 200:
        raise ScanError("GitHub is unavailable right now. Try again shortly.")
    return json.loads(chunks)


async def resolve(repo):
    meta = await github("/repos/" + repo)
    if meta.get("private"):
        raise ScanError("Only public repositories are supported.")
    commit = await github(
        f"/repos/{repo}/commits/{quote(meta['default_branch'], safe='')}"
    )
    return commit["sha"]


async def fetch_files(repo, sha):
    started = time.monotonic()
    tree = await github(f"/repos/{repo}/git/trees/{sha}?recursive=1")
    items = sorted(
        (i for i in tree.get("tree", []) if eligible(i)), key=lambda i: i["path"]
    )
    files, used, reasons = {}, 0, []
    if tree.get("truncated"):
        reasons.append(
            "GitHub returned a truncated tree; the eligible inventory is incomplete."
        )
    for item in items[:MAX_FILES]:
        if time.monotonic() - started > 65 or used + item["size"] > MAX_BYTES:
            reasons.append("The scan reached its time or byte budget.")
            break
        blob = await github(f"/repos/{repo}/git/blobs/{item['sha']}")
        try:
            raw = base64.b64decode(blob["content"], validate=False)
            if len(raw) > MAX_FILE or b"\0" in raw:
                reasons.append(f"{item['path']}: oversized or binary blob skipped.")
                continue
            files[item["path"]] = raw.decode("utf-8")
            used += len(raw)
        except (UnicodeDecodeError, ValueError, KeyError):
            reasons.append(f"{item['path']}: unsupported text encoding.")
    if len(items) > MAX_FILES:
        reasons.append(
            f"File budget: first {MAX_FILES} eligible files, ordered by path."
        )
    readme = None
    if (
        not tree.get("truncated")
        and used < MAX_BYTES - MAX_FILE
        and time.monotonic() - started < 55
    ):
        entry = next(
            (
                i
                for i in tree.get("tree", [])
                if i["path"].lower() == "readme.md"
                and i.get("mode") == "100644"
                and i.get("size", MAX_FILE + 1) <= MAX_FILE
            ),
            None,
        )
        if entry:
            blob = await github(f"/repos/{repo}/git/blobs/{entry['sha']}")
            try:
                raw = base64.b64decode(blob["content"])
                if len(raw) <= MAX_FILE:
                    readme = {"path": entry["path"], "text": raw.decode("utf-8")}
                    used += len(raw)
            except (ValueError, UnicodeDecodeError, KeyError):
                reasons.append("README could not be decoded; command checks skipped.")
    return files, {
        "eligible": None if tree.get("truncated") else len(items),
        "inspected": len(files),
        "bytes": used,
        "partial": bool(reasons),
        "reasons": reasons,
        "tree_complete": not tree.get("truncated"),
        "paths": [i["path"] for i in tree.get("tree", [])],
        "readme": readme,
    }


def finding(
    path,
    start,
    end,
    rule,
    title,
    roast,
    consequence,
    fix,
    check,
    evidence,
    points,
    source="deterministic",
    confidence="high",
):
    return dict(
        id=hashlib.sha256(f"{path}:{start}:{rule}".encode()).hexdigest()[:12],
        path=path,
        start=start,
        end=end,
        rule=rule,
        title=title,
        roast=roast,
        consequence=consequence,
        fix=fix,
        check=check,
        evidence=evidence[:4000],
        points=points,
        source=source,
        confidence=confidence,
    )


def analyze(files, coverage):
    findings, lengths, comments, checks = [], [], 0, set()
    comment_lengths = []
    started = time.monotonic()
    for path, text in files.items():
        if time.monotonic() - started > 75:
            coverage["partial"] = True
            coverage["reasons"].append(
                "Analysis runtime budget reached; remaining files were not analyzed."
            )
            coverage["inspected"] = len(lengths)
            break
        lines = text.splitlines()
        lengths.append(len(lines))

        def add(start, end, rule, title, roast, consequence, fix, check, points):
            findings.append(
                finding(
                    path,
                    start,
                    end,
                    rule,
                    title,
                    roast,
                    consequence,
                    fix,
                    check,
                    "\n".join(lines[start - 1 : end]),
                    points,
                )
            )

        # Exclude initial headers, including licenses, from density measurements.
        header = True
        for line in lines:
            if header and (
                not line.strip() or line.lstrip().startswith(("#", "//", "/*", "*"))
            ):
                continue
            header = False
            comments += int(line.lstrip().startswith(("#", "//")))
            if line.lstrip().startswith(("#", "//")):
                comment_lengths.append(len(line.strip()))
        if len(lines) > 500:
            add(
                1,
                1,
                "long-file",
                "A file is carrying too much responsibility",
                "This file has its own postal code.",
                "Large files make changes harder to isolate. Length alone is a weak signal.",
                "Inspect cohesion before extracting a focused module.",
                "Confirm the extraction simplifies a real caller and preserves behavior.",
                1,
            )
        if path.endswith(".py"):
            try:
                tree = ast.parse(text)
            except (SyntaxError, RecursionError):
                checks.add("Python syntax could not be parsed in at least one file.")
                continue
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    body = [
                        n
                        for n in node.body
                        if not (
                            isinstance(n, ast.Expr)
                            and isinstance(n.value, ast.Constant)
                            and isinstance(n.value.value, str)
                        )
                    ]
                    if (
                        node.name.startswith("test")
                        and body
                        and all(
                            isinstance(n, ast.Assert)
                            and isinstance(n.test, ast.Constant)
                            and n.test.value is True
                            for n in body
                        )
                    ):
                        add(
                            node.lineno,
                            node.end_lineno,
                            "empty-test",
                            "A test cannot fail",
                            "This test has never doubted you.",
                            "This test passes even if the feature is removed.",
                            "Exercise the named behavior and assert an observable result.",
                            "Remove or break the feature; confirm this test fails.",
                            18,
                        )
                    if node.end_lineno - node.lineno > 80:
                        add(
                            node.lineno,
                            node.lineno,
                            "long-function",
                            "A function spans more than 80 lines",
                            "A function with a full character arc.",
                            "Long functions increase review effort; this is a weak signal, not a defect.",
                            "Investigate distinct responsibilities before extracting helpers.",
                            "Preserve meaningful behavior tests and simplify control flow.",
                            1,
                        )
                if (
                    isinstance(node, ast.If)
                    and node.orelse
                    and ast.dump(ast.Module(body=node.body, type_ignores=[]))
                    == ast.dump(ast.Module(body=node.orelse, type_ignores=[]))
                ):
                    add(
                        node.lineno,
                        node.end_lineno,
                        "identical-branches",
                        "Both branches do the same thing",
                        "A choose-your-own-adventure with one ending.",
                        "The condition does not change the outcome; an intended case may be missing.",
                        "Confirm intent, then implement the distinct case or remove the condition.",
                        "Test both condition values and the expected outcomes.",
                        12,
                    )
            if importlib.util.find_spec("ruff"):
                result = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "ruff",
                        "check",
                        "--isolated",
                        "--no-cache",
                        "--select",
                        "F401,F821,F841",
                        "--output-format",
                        "json",
                        "--stdin-filename",
                        path,
                        "-",
                    ],
                    input=text,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=6,
                )
                if result.returncode in (0, 1):
                    checks.add(
                        "Ruff F401 / F821 / F841 ran with isolated trusted configuration."
                    )
                    for diag in json.loads(result.stdout):
                        row = diag["location"]["row"]
                        add(
                            row,
                            row,
                            diag["code"],
                            diag["message"],
                            "The code is leaving loose ends for future you.",
                            "An undefined name can fail at runtime."
                            if diag["code"] == "F821"
                            else "Unused names add misleading maintenance surface.",
                            "Resolve the diagnostic without suppressing a real problem.",
                            f"Run Ruff {diag['code']}; confirm this diagnostic is gone.",
                            10 if diag["code"] == "F821" else 2,
                        )
                else:
                    checks.add("Ruff could not analyze at least one Python file.")
            else:
                checks.add("Ruff skipped: trusted executable is not installed.")
        else:
            checks.add(
                "JS/TS: trusted TypeScript syntax diagnostics only; semantic type checking and unused-name checks skipped (dependencies are not installed)."
            )
            if shutil.which("node"):
                result = subprocess.run(
                    ["node", "scripts/check-js.cjs", path],
                    input=text,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=6,
                )
                if result.returncode == 0:
                    for diag in json.loads(result.stdout):
                        add(
                            diag["line"],
                            diag["line"],
                            "TS" + str(diag["code"]),
                            diag["message"],
                            "The parser would like a word.",
                            "Invalid syntax prevents this file from compiling.",
                            "Correct the syntax at this location.",
                            "Run the trusted parser again and confirm the syntax diagnostic is gone.",
                            8,
                        )
                else:
                    checks.add(
                        "TypeScript parser unavailable; JS/TS syntax check skipped."
                    )
    readme = coverage.get("readme")
    if coverage.get("tree_complete") and readme:
        paths = set(coverage.get("paths", []))
        for row, line in enumerate(readme["text"].splitlines(), 1):
            # Only literal, explicit local source paths in command examples.
            match = re.match(
                r"^\s*(?:\$\s+)?(?:python3?|node)\s+((?:\./)?[\w/-]+\.(?:py|[cm]?js))\s*$",
                line,
            )
            if match and match[1].removeprefix("./") not in paths:
                findings.append(
                    finding(
                        readme["path"],
                        row,
                        row,
                        "missing-script",
                        "A README command points to a missing script",
                        "The quick start ends before it starts.",
                        "A literal root-level quick-start command cannot find its referenced script at this commit. Confirm the documented working directory.",
                        "Correct the path or add the intended script.",
                        "Confirm the documented command points to a real file in the stated working directory.",
                        line,
                        8,
                        confidence="medium",
                    )
                )
    else:
        checks.add(
            "README local command check skipped: complete inventory or bounded README unavailable."
        )
    total = sum(lengths)
    scale = max(1, total / 1000)
    substantive = min(
        95,
        round(
            sum(f["points"] for f in findings if not f["rule"].startswith("long-"))
            / scale
        ),
    )
    style = min(5, sum(f["points"] for f in findings if f["rule"].startswith("long-")))
    findings.sort(key=lambda f: (-f["points"], f["path"], f["start"]))
    for f in findings:
        f["contribution"] = (
            round(f["points"] / scale, 2)
            if not f["rule"].startswith("long-")
            else f["points"]
        )
    return {
        "score": min(100, substantive + style) if total >= 10 else None,
        "findings": findings[:100],
        "metrics": {
            "lines": total,
            "average_file_length": round(total / len(lengths), 1) if lengths else 0,
            "file_lengths": sorted(lengths),
            "comment_lines": comments,
            "average_comment_length": round(
                sum(comment_lengths) / max(1, len(comment_lengths)), 1
            ),
            "comment_density": round(comments / max(1, total), 3),
            "normalizer": round(scale, 3),
        },
        "checks": sorted(checks)
        + [
            "Semantic type checking skipped: submitted dependencies and configurations are never executed."
        ],
        "languages": sorted(
            {
                "Python" if p.endswith(".py") else "JavaScript / TypeScript"
                for p in files
            }
        ),
    }


def source_url(repo, sha, f):
    return f"https://github.com/{repo}/blob/{sha}/{quote(f['path'], safe='/')}#L{f['start']}-L{f['end']}"
