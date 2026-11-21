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
