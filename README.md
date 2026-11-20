# Slop Guard

**My AI slop grades your AI slop.**

A local-first, evidence-based repository grader. Python/FastAPI serves a buildless responsive interface; SQLite holds bounded cached reports, quota reservations, accounts, votes, discussions, and consent. Nothing in a submitted repository is executed.

## Run with Docker

```powershell
docker compose up -d --build --wait
```

Open [Slop Guard locally](http://127.0.0.1:8000). The container uses the existing `data/` SQLite database and runtime `.env`, runs as non-root, and is limited to 512 MiB / one CPU. Secrets and fixture harnesses are excluded from the image. Stop the venv preview before starting Compose against the same database. See [operations](docs/OPERATIONS.md) for backups and Linux data-directory ownership.

## Run locally without Docker

Python 3.12+ and Node 20+ are required. From this checkout:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-lock.txt
npm ci --ignore-scripts
Copy-Item .env.example .env  # only on a new setup; preserve an existing .env
./scripts/start.ps1
```

Open [Slop Guard locally](http://127.0.0.1:8000). Linux: create the same venv, install `requirements.txt` (the lock includes a Windows development environment), run `npm ci --ignore-scripts`, and `sh scripts/start.sh`. There is no frontend build step. The repository itself has not been pushed or deployed by this work.

Do not replace an existing `.env` containing the supplied key. The deterministic grader works with all providers disabled. See [key provisioning and policy controls](docs/KEYS.md) for Groq reviews, Cloudflare humor, the optional Gemini pilot, and Google login.

## Verify

```powershell
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
.venv/Scripts/python -m pytest -q
node --check static/app.js
.venv/Scripts/python scripts/measure_memory.py
```

The full test suite uses fixtures and temporary databases, never billable requests. The explicit `scripts/preview_fixture.py` developer server runs on port 8041 with a synthetic report, test identity, and visible fixture banner; none of those identities/endpoints are installed into the ordinary app. Do not expose that developer process publicly.

## Product behavior

- Public GitHub tree and selected blobs only, resolved to a commit. Stable path order, at most 35 source files / 40 KB each / 280 KB combined, bounded API responses and analysis time. Generated/vendor/binary/symlink/submodule/lock content is excluded.
- Deterministic AST rules, isolated Ruff correctness rules, trusted TypeScript syntax parser, published weighted rubric, and explicit skipped semantic checks. Higher means more observed slop, never a claim of AI authorship.
- Probabilistic AI Slop uses strictly structured, evidence-validated findings. Groq GPT-OSS 120B is the intended public-site provider; eligible local Gemini 3.1 Flash-Lite is a comparison. Optional Cloudflare GLM wording never affects scores or facts.
- Serious/Satirical modes, finding deep links, cached Markdown preview/copy/download, and attached Slop Form discussions. Mode switches and exports use zero model calls.
- Real empty community/portfolio states, curated credited resources, Google identity verification, own-content editing, reversible account-scoped votes, abuse reports, admin moderation, explicit social consent and revocation, manual verification, and template reel drafts.

[Operations](docs/OPERATIONS.md) · [verification and remaining limitations](docs/VERIFICATION.md) · [product scope](PROJECT.md)
