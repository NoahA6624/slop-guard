# Quiet Evidence verification

20 November 2026, on `codex/ui-sprint-foundation` (PR #13). This records checks of the integrated theme: `static/theme.css` from the local Quiet Evidence work, combined with the sprint's component CSS and JavaScript.

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

- Forced-colors and reduced-motion rules on this branch: present but not emulated here. An earlier emulation ran against the pre-sprint stylesheet on local main, which does not cover this CSS.
- Screen readers, real browser zoom to 400%, other browser engines, and complete authentication/loading/error journeys. These remain UI-09 work.
