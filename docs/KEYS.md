# Provider setup and zero-spend controls

Verified against provider documentation on November 20, 2026. Keep all secrets in the ignored root `.env`. Do not paste keys into chat, put them in browser code, or commit them. Never enable billing, redeem credits that activate a paid plan, upgrade Workers, or add a payment method for this app. Stop if a console requires any of those actions.

## 1. Groq: production review and fix-plan data

1. Open [Groq Console keys](https://console.groq.com/keys) and sign in yourself. Keep the organization on **Free**. If available, create/select a dedicated Slop Guard project; scope the key to it.
2. Create a key named `slop-guard-local`. Copy it directly into `GROQ_API_KEY` in `.env`. Set `REVIEW_PROVIDER=groq` and `GROQ_MODEL=openai/gpt-oss-120b`.
3. Check the organization's [actual limits](https://console.groq.com/dashboard/limits). The current published Free table lists 30 RPM, 1,000 RPD, 8,000 TPM, and 200,000 TPD for this model. Use ceilings no higher than your own organization's values. Start more conservatively if this organization serves other apps.
4. After reading the [current policies](https://console.groq.com/docs/legal), confirm `GROQ_FREE_TIER_CONFIRMED=true` and `GROQ_BILLING_DISABLED=true`. Set `GROQ_VERIFIED_UNTIL` to an ISO timestamp at most seven days ahead. This is a human attestation, not an automated billing check.
5. Set `AI_ENABLED=true`, restart, and inspect `/api/config`. It exposes availability and model names, never keys. Run one review, then repeat the same commit: it should be cached with no additional model call.

Example non-secret configuration after verification:

```dotenv
REVIEW_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-120b
GROQ_RPM=15
GROQ_TPM=4000
GROQ_RPD=500
GROQ_TPD=100000
QUOTA_LIMITS_KIND=half of verified free-tier allowance
```

Do not interpret 200,000 / 4,000 as a guarantee of 50 reviews: output, schema, reasoning, failed attempts, other apps, and retries consume capacity. We conservatively reserve input plus maximum output, count failed attempts, and never retry automatically. Groq's exact account limits and response timing take precedence. The local daily ceiling resets at midnight UTC; it does not claim to replenish the organization's provider allowance.

[Groq setup](https://console.groq.com/docs/quickstart), [strict structured outputs](https://console.groq.com/docs/structured-outputs), [rate limits](https://console.groq.com/docs/rate-limits). Spend-limit controls are for paid plans; they are not a reason to upgrade this app.

## 2. Cloudflare: optional humor audition

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/), select an account on **Workers Free**, and open **Workers AI → Use REST API**. No Worker deployment, domain purchase, or paid subscription is needed for the REST integration.
2. Choose **Create a Workers AI API Token**, review the template, and limit it to this account. The REST guide specifies Workers AI Read and Edit permissions for a custom token. Do not use a global API key or grant DNS, billing, or unrelated account permissions.
3. Put the token in `CLOUDFLARE_API_TOKEN` and the account ID in `CLOUDFLARE_ACCOUNT_ID`. The code fixes the model to `@cf/zai-org/glm-4.7-flash`.
4. Verify Workers Free and no paid billing route or AI Gateway credits, then set `CLOUDFLARE_FREE_PLAN_CONFIRMED=true`, `CLOUDFLARE_BILLING_DISABLED=true`, and a seven-day `CLOUDFLARE_VERIFIED_UNTIL`. Set `CLOUDFLARE_ROAST_RPM=150` and `CLOUDFLARE_NEURONS_PER_DAY=5000`. `CLOUDFLARE_ROAST_RPD=0` removes only the optional additional request/day ceiling; the neuron and minute caps still apply.
5. A fresh scan may request three short alternatives for each of its top three verified findings in one bounded call. Results are saved with the report. If the model is unavailable or rejects the format, the app uses cached reviewer wording or local templates. Scores, evidence, and fix plans never change based on a roast.

Workers Free includes 10,000 neurons/day and further usage fails unless the account is upgraded. The app now reserves a conservative neuron estimate atomically before each request, using the model's published 5,500 input / 36,400 output neurons per million tokens, a serialized-input byte bound, and the maximum completion. The testing profile caps this app at 5,000 neurons/day and 150 requests/minute (half the published free allowances). Failed attempts stay counted; zero-valued legacy reservations conservatively consume the daily neuron budget. Other apps can still consume shared account capacity; monitor the dashboard. Never upgrade or add credits to get around exhaustion. [REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [pricing and UTC reset](https://developers.cloudflare.com/workers-ai/platform/pricing/), [model](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/).

## 3. Gemini: optional local comparison

The supplied key is already stored locally. We confirmed metadata access and one bounded `gemini-3.1-flash-lite` working-tree review. The local pilot has a one-request daily ceiling, with eligibility confirmed by the owner; actual project limits still apply.

For a new key, open [AI Studio API keys](https://aistudio.google.com/api-keys), create/select a project with billing disabled and create its API key. Do not select Set up billing, activate paid credits, or link a Cloud Billing account. Confirm **Free tier**, available region, and the model's free eligibility. Save as `GEMINI_API_KEY`, set `REVIEW_PROVIDER=gemini`, and copy current RPM/TPM/RPD ceilings from AI Studio.

Enable only for an eligible **adult professional/developer local pilot**: `DEPLOYMENT_AUDIENCE=local-adult-pilot`, `GEMINI_AUDIENCE_ELIGIBLE=true`, `GEMINI_FREE_TIER_CONFIRMED=true`, `GEMINI_BILLING_DISABLED=true`, and a seven-day `GEMINI_VERIFIED_UNTIL`. The API additionally requires the direct client address to be loopback before generating a Gemini review. Keep Uvicorn bound to `127.0.0.1` and do not expose it through a tunnel.

Google's terms restrict clients likely to be accessed by under-18s and require paid services for clients made available in the EEA, UK, or Switzerland. Since this app must spend $0, Gemini is disabled for the public-site configuration. A checkbox cannot establish eligibility. Free-service inputs/outputs may be used to improve Google's products; send only the intended bounded public excerpts. [Terms](https://ai.google.dev/gemini-api/terms), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [project quotas](https://ai.google.dev/gemini-api/docs/rate-limits).

## 4. Google sign-in: public client ID, not a model key

In an existing no-billing Google Cloud project, configure the OAuth consent screen and create an **OAuth client ID → Web application**. Add `http://127.0.0.1:8000` to Authorized JavaScript origins (and `http://localhost:8000` only if you use that address). Put the ID in `GOOGLE_CLIENT_ID`. Google Identity Services does not need a client secret in this app. Do not enable unrelated paid APIs.

If the consent app is in testing, add your intended testers in Google's console. Production requires your actual HTTPS origin and Google's applicable consent/verification requirements. The server verifies signature, audience, issuer, expiry, and verified email using Google's library; it stores the Google `sub` and display name, never the email. Put the owner's verified `sub` in `ADMIN_GOOGLE_SUBS` to grant moderation rights. [Client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## 5. GitHub API: request budget and optional token

Scans read public repositories through GitHub's REST API. Without a token GitHub allows 60 requests per hour per server IP; a fresh scan costs at most 39 (repository, commit, tree, up to 35 file blobs, README). The scanner keeps that low:

- Repeated scans of the same repository within 60 seconds reuse the resolved commit with zero GitHub requests.
- Repository and commit lookups are revalidated with ETags. GitHub answers `304 Not Modified` without a body; its [conditional request guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests-if-appropriate) says such responses do not count against the primary limit for authorized requests. This was not measured for anonymous requests.
- Trees and blobs are addressed by SHA and never change, so they are kept in a bounded in-process cache (16 MB). A new commit only downloads changed files; identical files are fetched once.
- Each scan reuses one HTTPS connection.
- The last `x-ratelimit-remaining`/`x-ratelimit-reset` headers are remembered. A scan that cannot finish within the remaining budget is refused before it spends requests, and the message says when to retry. Results are never cached partially for lack of budget.
- A cached report for a commit still costs zero file requests; reading reports and exports never calls GitHub.

The cache is per process and is lost on restart. Never rotate tokens, IPs or accounts to get around a limit.

Optional, free: create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with **Public repositories (read-only)** access and no extra permissions, and put it in `GITHUB_TOKEN`. Authenticated requests get GitHub's standard authenticated allowance. The token is only sent to `api.github.com` (redirects are not followed) and never appears in URLs, logs or `/api/config`. Leave it empty for local fixtures and routine checks.

## Guard behavior and limits

- Global kill switch: `AI_ENABLED=false` immediately disables new model calls after restart.
- Exact reviewed model allowlist; no latest aliases, arbitrary URLs, key pools, automatic provider fallback, paid endpoints, tools, code execution, search grounding, or automatic retries.
- Expiring free-plan/billing attestations. Missing, malformed, expired, or more-than-eight-day verification timestamps disable calls. Recheck current terms and account state weekly; then renew manually.
- Independent atomic request/minute, token/minute, request/day, and Groq token/day reservations in SQLite, separated by provider. Failed calls stay counted; restarts and page refreshes do not replenish usage. Provider retry timing is honored; unknown retry duration disables that provider until owner investigation.
- Secret-like source files are excluded from model excerpts. This is heuristic; it cannot prove that arbitrary source contains no secrets or personal data.
- Repository content is untrusted text: no submitted code execution, config loading, dependency installation, clone, submodule, or arbitrary remote fetch. Reports validate paths, line ranges, and quotations against the selected snapshot.
- Social featuring requires separate maintainer consent and manual admin ownership verification. Google sign-in or submitting a public link is not proof of repository ownership. Consent can be revoked; publishing remains manual.

Software cannot verify all legal/account obligations or stop an owner from changing a provider's billing plan outside the app. These guards reduce operational risk; they do not certify universal policy compliance. Revoke a key if exposed, pause AI on uncertainty, preserve licenses/attribution, and respect takedown/access restrictions. Keep the deployment private until its audience, privacy notice, license handling, and moderation obligations are reviewed.

## UI behavior at a limit

The fresh-AI checkbox becomes unchecked and disabled on exhaustion, cooldown, missing eligibility, unknown retry, or stale/unreachable quota state. The page refreshes server state every 10 seconds while visible and on focus. The server independently enforces reservations for races and direct API requests. Deterministic scans, cached report links, mode switches, and downloads remain usable. Explicit `include_ai=false` requests call neither model provider and use a distinct report cache key. Gemini remains on its original conservative local pilot ceiling until actual project-specific free limits are supplied; Groq figures do not establish Gemini limits.

Provider responses now record actual input/output/total token usage, HTTP status, completion time, and outcome separately from reservations in SQLite. Legacy usage is unknown rather than fabricated. Failed/unsupported attempts retain their original budget reservation; usage history is retained for 90 days. Groq uses low reasoning with a bounded completion, and Cloudflare disables unnecessary thinking for the short roast task. Unique source quotations may repair model line/indentation mistakes; final source anchors and original whitespace are verified and the correction is recorded. Ambiguous/invented evidence is rejected.
