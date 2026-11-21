# UI redesign handoff

Sprint: https://github.com/NoahA6624/slop-guard/issues/2. Status as of 21 November 2026: UI-01 to UI-09 are done on `dev`. The UI-10 comprehension pilot has not been run.

## What changed

- **Theme:** `static/theme.css` is the only source of tokens, and `static/style.css` holds component geometry. The rules are in `docs/DESIGN_PRINCIPLES.md`, and the token roles and contrast are in `docs/DESIGN_VERIFICATION.md`.
- **Shell:** a skip link, list navigation with `aria-current`, a Menu disclosure under 900px, per-route titles, heading focus after client navigation, a named dialog that restores focus, and a loading status for slow routes.
- **Home:** owner/repo or a GitHub link, inline errors, one request per submit, input kept on failure, and the AI option disabled when the quota is not available.
- **Report:**
  - Two independent score boxes. The quota line sits under Probabilistic AI Slop.
  - Explicit coverage states.
  - Findings show the source with line numbers, Fix/Verify, and stable `#finding-…` links.
  - The Serious/Satirical switch keeps focus and open disclosures. Satirical grade names are presentation only.
- **Fix My AI Slop:** a cached Markdown preview with copy and download, a fallback when copying fails, and no model call.
- **Community, Library, Slop Form, Our Slop, Methodology:** a shared contribution row, votes that can be undone and keep focus, topics with attached evidence, and honest empty states.
- **Sign-in, contribution, moderation and consent:**
  - Shared form errors.
  - Drafts kept after a 401.
  - Sign-in that names the action it is for.
  - Hiding a contribution asks for confirmation first.
  - Revocable social consent.

## How it was verified

- **Test suite:** 49 pytest tests, plus `node --check` and Prettier.
- **UI-09 audit:** 115 checks on a credential-free local fixture: layout, zoom, states, quota, keyboard, ARIA tree, motion, forced colors and the full journey. Details are in `docs/DESIGN_VERIFICATION.md`, and the script and screenshots are in `docs/ui-audit/ui-09/`.

## Remaining limitations

- No real screen reader, Safari or Firefox, real browser zoom, or touch device testing.
- No real Google sign-in. OAuth is configured, but no account has completed sign-in.
- No live GitHub scans in the UI audit. The scan request was stubbed.
- No production deployment review, abuse throttling or monitoring. See `docs/VERIFICATION.md`.
- No usability evidence: the pilot below has not been run. Implementer checks are not user validation.

## Rollback

The work is all buildless static files (`static/`) and docs, merged into `dev` one PR at a time (#13, #14, #16, #17, #18, #19 and the UI-09 PR). Any piece can be rolled back with `git revert` of its merge commit on a branch, through a PR into `dev`. No database migration or API contract changed for the UI, except the scanner's GitHub request savings in #19, which can be reverted separately. Changes to `main` still require approval from a human repository admin.

## Comprehension pilot (UI-10, open)

Three people unfamiliar with Slop Guard, using the local fixture or a deployed preview. Record no names or contact details: just P1, P2 and P3, and whether each person writes code regularly.

Tasks, read aloud without hints:

1. Grade a public repository of your choice.
2. What does the Deterministic Slop Score mean? Is a higher score better or worse?
3. How much of the repository was inspected?
4. Find the source evidence for one finding and open it at the exact commit.
5. Get a fix plan you could give to a coding tool.

For each task, record: completed (yes / with help / no), time, hesitations, and the participant's exact interpretation for tasks 2 and 3. A **critical failure** is any of these:

- Reading a score as "written by AI".
- Reading a higher score as better.
- Missing partial coverage.
- Being unable to find the evidence or the export.

Fix critical failures before closing #2.

| Participant | T1  | T2 (interpretation) | T3 (interpretation) | T4  | T5  | Notes |
| ----------- | --- | ------------------- | ------------------- | --- | --- | ----- |
| P1          |     |                     |                     |     |     |       |
| P2          |     |                     |                     |     |     |       |
| P3          |     |                     |                     |     |     |       |
