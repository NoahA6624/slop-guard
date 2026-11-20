# Verification record

As of November 20, 2026. This record distinguishes live checks from fixtures. Remaining scope is stated explicitly.

## Automated checks

The test suite currently passes 39 tests without paid credentials or billable calls. It covers deterministic repeatability, clean/messy/unsupported inputs, safe exclusions and URL parsing, Unicode source, trusted TypeScript syntax checks, incomplete-tree README behavior, evidence validation, caching, concurrent duplicate reuse, fix-plan/download APIs, anonymous/authorized posting, identity verification/signup/returning-account fixtures, ownership, reversible votes, replies, evidence-attached discussions, abuse/moderation, social consent/verification/revocation, private email handling, CSRF origin checks, quota minute/token/daily/DST/restart/atomic reservations, known/unknown retry, provider fail-closed gates, secret exclusion, and Groq strict-schema request construction.

Google signatures are verified by the official library in production, but tests replace the external identity verifier; no real OAuth client ID is available yet. Groq strict review requests and Cloudflare presentation-only refinement are fixture-tested; live calls require owner-provisioned keys. No test identity exists in the ordinary app.

## Live checks

- Browser-driven anonymous scan of `NoahA6624/slop-guard` at public commit `1893f9de…`: no eligible source in that public commit, correctly shown as insufficient coverage.
- Browser-driven anonymous scan of `pallets/markupsafe` at `4e111271…`: 12/12 eligible files inspected, 0 deterministic findings; this is a scoped result, not a correctness guarantee.
- A larger scan exposed a Windows Unicode subprocess encoding bug; corrected and regression-tested. Subsequent fresh requests reached GitHub's anonymous rate limit and displayed an explicit error. No alternative keys or routes were used to evade it.
- The supplied Gemini key successfully listed Flash models. After owner confirmation of billing-disabled unpaid eligibility, one bounded local working-tree comparison ran on `gemini-3.1-flash-lite`, producing a valid empty finding set. It is stored only in ignored `data/local-benchmark.json`, not presented as a public commit-pinned report. It consumed the one-request local pilot ceiling. No paid fallback or credits were enabled.
- UI evidence/roast/fix-plan/forum flow is verified separately in the explicitly labeled, temporary local fixture preview; results are not community submissions or live scans.
- Browser checks verified a finding share link survives a Satirical switch, deterministic Markdown preview/copy and a real `SLOP_FIX_PLAN.md` download, and publishing a temporary fixture topic with the exact finding attached. At a 390×844 viewport, the slogan, repo input, and Grade my repo button fit in the initial viewport, with no document horizontal overflow. Library search filtered to the relevant mutation-testing resource. These checks used the in-app browser; live Google sign-in remains owner-configured.

## Resource measurement

`scripts/measure_memory.py` scanned 35 synthetic Python files / 235,515 bytes through the actual scan API while a second visitor repeatedly fetched the homepage. On this Windows host (22 logical CPUs, 32,437 MiB RAM), measured combined application and analyzer-child RSS peaked at 81.62 MiB, runtime 7.75 seconds, with 142 concurrent-browsing responses. Measurement is sampled, includes the API test harness, and excludes OS/browser memory. Nominal difference from 512 MiB is about 430 MiB; it is **not measured remaining OS headroom**. A constrained 512 MiB / one-vCPU Linux deployment remains unverified.

## Remaining limitations

- Dependency-aware type checking is intentionally skipped; it must not be confused with a clean type check. JS/TS currently gets trusted syntax parsing, not the Python AST rules or semantic unused-name analysis. README checking handles only literal root-level Python/Node script commands; working-directory intent requires review.
- Model excerpt selection is bounded and incomplete. Matching evidence is not proof the interpretation is correct. A model may return zero findings. Secret detection is heuristic; owner attestations cannot detect external billing/account changes automatically.
- Free-provider keys, Google OAuth client configuration, and admin identities are owner-supplied. Public launch, DNS/TLS, Linux resource target, real-account sign-in, and live Groq/Cloudflare humor quality are not verified.
- Portfolio starts honestly empty. Curated library entries are credited references, not invented community activity. Social ownership checks are manual; no social publishing is automated.
- Public production hardening needs proxy abuse throttling, operational monitoring/retention policy, a deployment review, and provider terms review for the actual audience. This is a working local app, not a claim that every item of PROJECT.md is production-certified.
