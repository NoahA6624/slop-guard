# Local operation and deployment runbook

## Daily operation

Use one Uvicorn worker and persistent `data/` storage. Startup applies the idempotent SQLite migration; `GET /api/health` checks service/database readiness. Root `.env` is server-only. Restart after config changes. Bind locally until production readiness is reviewed.

Configure Google login for the exact authorized origin before real posting/voting. Scans and browsing require no account. Set verified Google sub IDs in `ADMIN_GOOGLE_SUBS`; `/admin` handles abuse and social verification. Add owner-curated entries to `content/portfolio.json` using `title`, `description`, `repo`, optional `demo`, and `notes`; use only authorized HTTPS demo links. Resources live in `content/resources.json` and in member submissions.

Fresh scans serialize within the process; identical in-flight scans reuse one result. Reports retain at most 200 entries. Bounded report excerpts are stored, fetched source is transient. Quota reservations survive restart. Gemini resets at midnight America/Los_Angeles with DST; local Groq and Cloudflare ceilings use UTC. No new review is required for cached reports, mode changes, or downloads.

If a provider returns a known Retry-After delay, wait. Unknown retry duration disables new requests for that provider. Investigate the provider dashboard without buying credits, rotating keys, or upgrading. To clear an unknown block after confirming actual availability, stop the app, back up SQLite, and delete only the `provider_retry` (Gemini) or `groq_retry` settings row with a SQLite client; preserve quota history. Missing auth/provider credentials degrade to read-only community and deterministic grading.

## Backup and restore

Use SQLite's backup API, not a live copy of only the main WAL database file. Example from this checkout, writing to an owner-selected secure backup directory:

```python
import sqlite3
source = sqlite3.connect('data/slopguard.sqlite3')
target = sqlite3.connect('data/slopguard.backup.sqlite3')
source.backup(target)
target.close()
source.close()
```

Back up `.env` separately in an access-controlled secret store. For restore, stop the app, archive the current database and its WAL/SHM files, restore the consistent backup to the configured DB path, and start one worker. Check health, a cached report, and the quota count. Never reset quota to get around a provider limit.

## Small Linux target: owner-run steps only

No infrastructure was rented. The 512 MiB / one-vCPU deployment target has **not** been verified under a Linux memory/cpu limit.

1. On an already available no-incremental-cost builder, assemble a versioned release archive with `slopguard/`, `static/`, `content/`, `scripts/check-js.cjs`, `scripts/start.sh`, migrations, requirements, package manifests, and the trusted TypeScript dependency installed with `npm ci --ignore-scripts`. Exclude `.env`, runtime databases, tests/fixtures, `.git`, caches, and local venvs. Build Python dependencies for the target Linux/Python version; do not ship a Windows venv.
2. Transfer the prebuilt release artifact to an existing server. Do not clone the app or submitted repositories on the server. Use a dedicated unprivileged account, persistent data directory, and an owner-managed environment file. Install/start the vetted artifact; never install submitted dependencies.
3. Run one worker bound to loopback behind an already available reverse proxy. Configure a service restart policy, request/body limits, per-client abuse throttling, access-log retention, and a total process memory limit. The in-app limiter controls one scan, not a public multi-tenant job queue.
4. Set public review provider to Groq only after actual free/account/policy verification. Set `DEPLOYMENT_AUDIENCE=public`; Gemini generation fails closed in that configuration. Do not expose the fixture preview. Review privacy, repository-license handling, retention, terms, moderation staffing, and identity setup before opening access.
5. The owner manually configures DNS for `slop-guard.com` to the existing host and obtains/renews a free TLS certificate with their proxy tooling. Add the HTTPS origin in Google OAuth. No domain purchase or paid DNS/TLS service is authorized.
6. Check `/api/health`, cached report viewing, source links, mobile forms, sign-in, forum permissions, quotas, restore, and memory/cpu limits. Keep the prior versioned artifact available.

Rollback: stop the service, back up its current DB, select the prior compatible release artifact, and restart with the same persistent data. Migrations are additive; do not downgrade/delete data automatically. If schema compatibility is uncertain, restore the paired backup with the prior release. No automatic deploy/publish path exists in this app.
