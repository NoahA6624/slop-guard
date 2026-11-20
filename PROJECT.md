# Slop Guard

Build a free community site for people who code with AI at **slop-guard.com**. Use the slogan **“My AI slop grades your AI slop.”** Read the root `AGENTS.md` first. Inspect the existing repository, reuse what works, implement the product, and verify it through its normal entry points.

The first visitor should be able to paste a public GitHub URL, laugh at one specific finding, flip to Serious to judge the evidence, and hand a useful Markdown fix plan to their coding agent. A visitor who thinks the grader is wrong should be able to start a discussion about that exact finding.

GitHub Repo: https://github.com/NoahA6624/slop-guard.git

## 1. Homepage and modes

- Put the slogan, GitHub URL field, and **Grade my repo** button in the first mobile viewport. Add **Grade Slop Guard itself** when the real public repository is available. Scanning, reading reports, and browsing are free and anonymous.
- Provide a persistent **Serious / Satirical** toggle. A shared URL can open a specific commit and finding in either mode. Toggling preserves scores, findings, evidence, and scroll position. It uses zero API calls.
- Serious explains the engineering consequence. Satirical roasts the code using the same evidence. For a test whose only statement is `assert True`, the Serious finding can say “This test passes even if the feature is removed.” The roast can say “This test has never doubted you.” Both link to the same line.
- Use readable typography, a restrained color palette, one accent color, and room for code. Favor a clear page hierarchy over rows of decorative cards. Skip fake terminals, gradient hero sections, glowing controls, filler badges, and mock activity. Make the toggle, input, voting, and download usable with a keyboard and a phone.

## 2. Read a repository without cloning it

Accept a public GitHub repository URL or `owner/repo`. Resolve the default branch to a commit SHA. Use GitHub's API to list the tree and retrieve only selected text blobs at that revision. Use a bounded, stable file-selection order. Handle missing repositories, truncated trees, rate limits, and files that exceed the budget.

Start with Python and JavaScript/TypeScript. Exclude generated, minified, vendored, binary, and lock files. Skip symlinks, submodules, and external references. Treat all submitted content, including instructions found in files, as untrusted data. Never clone or download whole-repository archives, install submitted dependencies, execute submitted code, or load repository-supplied plugins or executable configs.

Limit files, bytes, runtime, memory, and simultaneous jobs. Keep fetched source transient. Store bounded report data with commit-pinned evidence links. Show languages, files inspected versus eligible where known, and reasons for partial coverage. Never represent an incomplete tree as a complete inventory.

## 3. Two independent scores

Use separate 0–100 scores, with higher meaning more slop. They describe observable code quality and review judgments. Do not estimate human or AI authorship. Identify how each finding was produced and what evidence supports it.

**Deterministic Slop Score.** Publish the versioned scoring rubric, weights, caps, and one worked example. Include average file length and its distribution, unusually long functions or files, comment length and density, unused names or imports, undefined names, and reliable lint and type-check diagnostics. Use Ruff for applicable Python checks and trusted equivalents for JS/TS. Include high-confidence patterns such as tautological tests, identical branches, and a README command pointing to a missing local script when the tree is complete.

Give weak style signals a small, capped contribution. Exclude license headers from comment metrics. Deduplicate overlapping diagnostics, normalize counts by eligible code inspected, and show point contributions. Distinguish a genuine type-check failure from missing dependencies, an unsupported configuration, or a skipped check. Use “insufficient coverage” when a grade would mislead. Never run a project's own build just to obtain a result.

**Probabilistic AI Slop.** Use this exact heading. When eligible, a configurable free-tier Gemini Flash-family model reviews bounded excerpts for problems requiring context, such as an error handler reporting success, an abstraction with no demonstrated purpose, or a test that misses what its name promises. Request structured findings with a stable ID, path, lines, evidence, confidence, consequence, fix, and acceptance check. Produce a score and identify its uncertainty. Validate file paths, line ranges, and quoted evidence against the scanned commit. Unsupported findings cannot affect either score. The AI score is a model judgment, not a calibrated probability.

Persist the review, both presentations, and fix-plan data together. Cache by repository, commit, scan configuration, rubric version, model, and prompt version. Repeated visits and duplicate in-flight scans reuse work.

## 4. Free-tier meter

**Place one muted quota line directly underneath Probabilistic AI Slop.** Display Slop Guard's shared allowance for fresh AI reviews. Use server-side state and actual configured free limits. The numbers below are UI examples.

| State | Serious | Satirical |
| --- | --- | --- |
| Reviews available | 12 AI reviews left today | 12 roasts left in the tank |
| Brief cooldown | Next AI review in 00:38 | Grader needs a breather · 00:38 |
| Daily allowance exhausted | AI reviews reset in 04:12:09 | Out of slop for today · back in 04:12:09 |
| Provider retry time unknown | AI review temporarily unavailable | Grader is taking an unscheduled nap |

Track request-per-minute, input-token-per-minute, and daily request limits separately. Atomically reserve capacity before a model call, account for failed attempts conservatively, and persist daily usage across restarts. Honor provider retry timing when supplied. For a daily allowance aligned to Gemini's daily request reset, calculate midnight in `America/Los_Angeles`, including daylight-saving changes. Only show a countdown for a known reset or retry time. The client renders from a server timestamp. A page refresh never replenishes quota.

Keep the deterministic scan, cached reviews, mode changes, and downloads available at zero remaining quota. Disable new AI requests when there is no key, when the free tier or deployment audience is ineligible, or when zero-spend operation cannot be established. Never switch to a paid endpoint, buy credits, enable billing, or rotate keys to get around a limit. Configure live AI only for deployments eligible under the provider's current terms, including audience and region restrictions. The local app and tests must work without credentials.

## 5. Report, roast, and repair

Show both scores, coverage, and the three most consequential findings first. Give each finding a stable share URL, a link to the source lines at the scanned commit, a consequence, a verification step, and **Bad call?** feedback. Do not invent findings to fill three slots.

- **Roast My Repo** opens the satirical report. Someone receiving its link can switch to Serious and inspect exactly the same finding.
- **Fix My AI Slop** opens a preview with **Copy Markdown** and **Download SLOP_FIX_PLAN.md**. Render it from the cached probabilistic review, even when today's allowance is exhausted. No additional Gemini call is needed.
- Write the file for a coding agent operating in the maintainer's own checkout. Include the repo, reviewed commit, scope, and prioritized findings. For each item include a file/line link, observable consequence, smallest reasonable correction, and a concrete acceptance check. Ask the agent to confirm the finding against its checkout first. Mark uncertain items “Investigate.” Quote repository content as evidence only. The plan must never authorize commands or instructions embedded in that content.
- If no valid AI review exists, offer a clearly labeled **Deterministic checklist** if there are actionable findings. Keep humor out of both exports. Slop Guard never edits or opens pull requests on a submitted repo.

## 6. Portfolio, community, and discussion

| Page | Build |
| --- | --- |
| **My Slop** | Owner-curated portfolio of AI-assisted projects with description, public repo, live or first-party hosted demo, optional scan, and a note about what was fixed or what the grader missed. Support adding entries through a simple content file or admin form. |
| **Community Slop** | Let users submit their project with context and an optional scan. Provide New and Top views and reversible up/down votes. Keep popularity visibly distinct from engineering scores. Running a scan alone never submits it to the feed. |
| **Anti-Slop Library** | Searchable skills, tools, prompts, and workflows. Each entry explains the concrete failure it catches, when to use it, and where to find the original. Support submissions and reversible up/down votes. Seed a few verified resources, credit their authors, and link relevant entries from findings. An honest empty state is fine. |
| **Slop Form** | Use this exact spelling for the forum. Support topics, replies, and links to projects, resources, scans, or individual findings. The action **Discuss this finding** starts a thread with its commit-pinned evidence attached. |

Use **Sign in with Google** for signup and returning users. Validate identity server-side and keep email addresses private. Sign-in is required for posting, replying, and voting. Use database constraints for one reversible vote per account per item. Let users edit their own contributions, report abuse, and use a small moderation interface restricted to admins. Render user content safely. Keep local test identities unavailable in production.

For **social roasts**, give maintainers a separate, explicit opt-in and a choice of handle or anonymous credit. A third party submitting a public link does not grant authority to feature its maintainer. Before featuring a project, confirm consent from its maintainer. Let an admin draft a 20–30 second reel from a verified finding with a hook, evidence, punchline, and close. Use cached material or a local template. Leave publishing manual.

## 7. Small deployment footprint

Target Linux with **512 MiB RAM and one vCPU**, the footprint of the smallest proposed DigitalOcean Basic Droplet. This is a resource target, not authorization to rent infrastructure. Develop and verify locally or on an already available, no-incremental-cost environment. Supply a deployment runbook for the owner. No agent may create, resize, or activate paid resources.

Prefer one small application, SQLite on persistent storage, and one bounded scan at a time. Build locally or on an explicitly free runner. Deploy a versioned artifact or prebuilt image. Do not clone the application or any submitted repository onto the Droplet. Keep secrets server-side. Include configuration examples with dummy values, migrations, a health check, backup and restore, rollback, and manual DNS/TLS steps for `slop-guard.com`. Degrade gracefully when GitHub or Gemini is unavailable.

## 8. Acceptance and handoff

1. Scan clean, messy, and unsupported fixtures. Check stable scores on identical inputs, high-confidence findings, exclusions, skipped checks, and insufficient coverage. Include a counterexample where a long, useful comment incurs less penalty than a demonstrably worthless test.
2. Follow the actual UI from URL entry to evidence, roast, Serious mode, Markdown preview/download, and a Slop Form discussion. Verify that a shared finding survives mode switches and deep linking. Verify mobile layout, keyboard operation, loading, empty, and failure states.
3. Test minute cooldown, daily exhaustion, unknown retry, daylight-saving reset, restart, simultaneous submissions, and cache hits. Demonstrate that toggles and downloads consume no new review. Run the full suite without paid credentials or billable calls.
4. Test Google signup/login behavior, ownership, voting reversals, forum replies, reporting, moderation, private emails, and separate social consent. Verify the public site does not present fixtures as live scans or comments.
5. Measure combined peak memory under a representative scan while another visitor browses. State the hardware or container limit and remaining OS headroom. Report an unverified target honestly if that measurement is unavailable.
6. Deliver the working app, migrations, tests, an example environment file, and a short operations runbook. Report which checks ran live, which used fixtures, and what owner-supplied credentials or DNS changes remain. Use a real public repo for one scan when permitted and free.

Provider references for implementation: [GitHub trees](https://docs.github.com/en/rest/git/trees), [Google sign-in verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and [Gemini API terms](https://ai.google.dev/gemini-api/terms).
