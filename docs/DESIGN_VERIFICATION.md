# Quiet Evidence verification

20 November 2026, on the PR #13 branch (merged into `dev`). This records checks of the integrated theme: `static/theme.css` from the local Quiet Evidence work, combined with the sprint's component CSS and JavaScript.

## Setup

macOS, Python 3.14.6, Node 24.18.0, in-app Chromium-based browser. `scripts/preview_fixture.py --quota-demo` with a temporary database, providers disabled, and an empty worktree `.env` so no real credentials load. No live scans, identity-provider calls, or production data.

## Checks performed

- `.venv/bin/python -m pytest -q`: 45 passed. `node --check static/app.js` and Prettier: passed.
- Theme contract: the page loads `theme.css` then `style.css`. All CSS variables used resolve, `style.css` has no colour literals or pixel font sizes, and type sizes are rem-based. The favicon (`mark.svg`) and `theme-color` metadata are the documented standalone exceptions.
- Eight routes (`/`, fixture report, community, library, forum, portfolio, methodology, admin) at 320, 390, 768 and 1440px: 32 of 32 with no document horizontal overflow, no visible control under 44px tall or 24px wide, and focus on the page heading after client navigation.
- Text enlargement (root font 200%): no overflow on seven routes at 640px. At 1024px the inline navigation first overflowed by about 270px. The header and nav now wrap, and breakpoints use em so a larger default font switches to the Menu sooner. Re-check: 0 overflow.
- Score boxes stack below 30em (480px at default font size). Both keep a visible status line, and the quota line stays under Probabilistic AI Slop. Screenshot: `docs/ui-audit/after-review-1/report-390-theme.jpg`.

## Calculated contrast

WCAG relative luminance, rounded to two decimals.

| Pair                               | Ratio   |
| ---------------------------------- | ------- |
| Ink (midnight plum) / white        | 17.33:1 |
| Secondary ink / white              | 6.75:1  |
| Secondary ink / subtle surface     | 6.17:1  |
| Secondary ink / code surface       | 6.28:1  |
| Accent (grader violet) / white     | 7.21:1  |
| Accent / subtle surface            | 6.59:1  |
| Accent / accent surface            | 6.28:1  |
| White / primary action             | 17.33:1 |
| White / primary hover              | 13.91:1 |
| Error / error surface              | 6.05:1  |
| Caution / caution surface          | 6.74:1  |
| Neutral badge text / badge surface | 9.51:1  |
| Control boundary / white           | 3.56:1  |
| Focus / white                      | 7.21:1  |

Calculated values do not by themselves establish WCAG conformance.

## Not yet verified

- Superseded: see "Forced colors and reduced motion" below.
- Screen readers, real browser zoom to 400%, other browser engines, and complete authentication/loading/error journeys. These remain UI-09 work.

## Forced colors and reduced motion

Verified 20 November 2026 on `dev` plus UI-06, in headless Google Chrome via Playwright `emulateMedia`, at 390×844. Requests were restricted to the local fixture.

- `forced-colors: active`:
  - Keyboard focus shows a solid 3px outline.
  - Primary and secondary buttons, inputs, and score boxes keep a 1px solid border.
  - The selected tone button is outlined.
  - No horizontal overflow.
  - Screenshot inspection: every control stayed visible and distinguishable in system colours.
- `prefers-reduced-motion: reduce`: smooth scrolling resolves to `auto` and the progress spinner has no animation. Focus and borders are unchanged.

Not covered: Windows High Contrast themes on real hardware.

## UI-08: sign-in, contribution, moderation and consent

Verified 20 November 2026 in the built-in Chromium pane against the local fixture (temporary DB, synthetic "Test user", no `GOOGLE_CLIENT_ID`, providers disabled). Anonymous, 401, 422, admin-queue and Google-script-failure states were simulated in the page by overriding `config.user`, stubbing `fetch` or stubbing the script loader. No request left loopback.

- Contribution form: empty submit shows an error under each field, linked with `aria-describedby` and `aria-invalid`, and focuses the first one. A server 422 is mapped to its field. While sending, the form has `aria-busy`, the button is disabled and relabelled, and the status line says "Publishing…". Two rapid submits sent one request. After a 401 the form stays open, offers "Sign in again", and the text is restored when the form is reopened. Publish, reply, edit (own items only) and vote/unvote used the real fixture API.
- Report: the 5-character minimum shows inline ("4 so far"); success closes the dialog and announces "Report sent for admin review."
- Anonymous: the forum, community and library pages say "Anyone can read. Sign in to post, reply, vote or report.", and vote/report buttons reference that line. Each gated action opens sign-in with its own heading ("Sign in to vote."). Without a client ID, the setup note shows. When the Google script fails to load, the dialog stays open with an error and a focused Try again that retries.
- Moderation: a real 403 shows "This page is for admins." Stubbed queue: reports are grouped per item with kind, count, reasons and link. Hide asks for confirmation (focus on Cancel); Cancel restores focus; Hide re-renders, announces the result and focuses the heading. Markup in titles was shown as text.
- Social consent: both boxes start unchecked, credit defaults to Anonymous and the handle field is enabled only when chosen, and the three manual steps are listed. A proof link outside the repository is attached to the proof field. Success shows "pending manual verification. Nothing has been published." Revoking from the account dialog announces "Consent revoked." and the item reads "Revoked. It will not be drafted."
- At 375px the consent dialog had no document or dialog overflow; error text computes to the danger color.

Not covered: a real Google sign-in, screen readers, forced colors for the new form states, and whether a real mouse click moves focus back to the report button in Safari. These remain UI-09 work.

## UI-09: accessibility, responsive states and journeys

Run on 21 November 2026 on `dev` (`ba6bc98`) plus the UI-09 fixes. macOS, Python 3.14.6, Node 24.18.0, headless Google Chrome through Playwright, against `scripts/preview_fixture.py --quota-demo` (temporary DB, providers disabled, empty worktree `.env`). The script is `docs/ui-audit/ui-09/audit.cjs`. It aborts any request that leaves loopback, and none did. Per-check results are in `results.json` and screenshots are in the same folder.

- `.venv/bin/python -m pytest -q`: 49 passed. `node --check static/app.js` and Prettier: passed.
- Audit: 115 of 115 checks passed after two fixes. The first run failed 5:
  - Finding badges were 13px, below the 14px metadata minimum. They now use `--text-sm`.
  - While a report or list was loading, the view stayed blank. After 300ms it now shows "Loading…" in a status region, and `main` has `aria-busy` while loading.
- Layout: eight routes at 320, 390, 768 and 1440px, with no document overflow, no visible control under 44px tall (inline text links excepted), every control named, one `h1`, and no text under 14px. The Fix My AI Slop dialog fits at 390, 768 and 1440px. Screenshots: home, report and community at 390×844, 768×1024 and 1440×900, plus the dialog at each width.
- Zoom, approximated as the equivalent CSS viewport: 720×450 for 200% of 1440×900, and 320×256 for 400% of 1280×1024. All eight routes had no horizontal overflow. This is not a real browser-zoom test.
- Code-only overflow: a 420-character evidence line and a long path scroll inside the evidence block only, with no document overflow at 390px.
- States (stubbed report responses):
  - Empty findings: honest message, and export disabled with a note.
  - Partial coverage: "1 of 40 … (partial coverage)".
  - Insufficient coverage: "—" plus a label.
  - Unknown eligible total.
  - Not reviewed.
  - Model-reviewed score next to an unchanged deterministic score.
  - Missing report (404), report network failure, community 503, and slow-loading report.
- Quota: available, cooldown, exhausted, unknown and disabled.
  - On home, fresh AI is unchecked and disabled in every state except available, and deterministic grading stays enabled.
  - On reports, the quota line stays inside Probabilistic AI Slop.
- Keyboard:
  - Skip link moves focus to main.
  - The Menu opens with Enter, Tab enters the nav, and Escape closes it and returns focus.
  - A route change focuses the `h1` and sets `aria-current` and the page title.
  - The finding's More disclosure opens with Enter.
  - The tone switch keeps focus, the open disclosure and `aria-pressed`.
  - The plan dialog is named, focuses Copy and keeps Tab inside. Escape returns focus to Fix My AI Slop.
  - Empty form submit links errors and focuses the first field.
  - Votes toggle `aria-pressed` and keep focus.
  - The focus outline is visible.
- Accessibility tree (Playwright ARIA snapshots, saved as `aria-*.yml`): every route exposes banner, navigation, main and contentinfo, and heading levels never skip. This is a programmatic check, not a screen-reader test.
- Motion and forced colors: under reduced motion the tone switch runs no animation. Under `forced-colors: active`, contribution form errors keep their text and the inputs keep borders (`forced-colors-form-errors-390.png`).
- Journey: scan → evidence → tone → copy finding link → open deep link → copy and download plan → discuss finding → topic → back to finding → vote and unvote.
  - Scan (stubbed `/api/scans`, one request) → report with focus on the `h1`.
  - Evidence is visible with a commit-pinned source link.
  - The tone switch made zero requests.
  - The finding link copies, and the deep link focuses the exact finding.
  - Copied and downloaded `SLOP_FIX_PLAN.md` are identical. Export requested only `/plan`, with no scan or model call.
  - The new topic carries the commit-pinned evidence, and "Open exact finding" focuses it.
  - Voting and unvoting work.
  - A scan network error keeps the input and offers Try again, and a branch link is rejected inline.

### Not verified

- Real screen readers (VoiceOver, NVDA, JAWS, TalkBack). The ARIA snapshots show names and structure only, not how announcements sound.
- Real browser zoom, Safari and Firefox, Windows High Contrast on hardware, and touch devices.
- Real Google sign-in and live GitHub scans (the scan is stubbed here).
- WCAG 2.2 AA conformance as a whole. These checks cover the listed criteria only.
