# UI-01 baseline audit and wireframes

Date: 2026-11-20. Branch base: `origin/dev` at `7eb86fa`. Environment: macOS, Python 3.14.6, Node 24.18.0, in-app browser.
Data: `scripts/preview_fixture.py --quota-demo` (temporary SQLite, synthetic identity, providers disabled). Nothing here is a live scan or real activity.

Evidence (measured in the browser) is kept separate from design decisions (hypotheses to verify after implementation).

## Baseline checks

- `.venv/bin/python -m pytest -q`: 45 passed. `node --check static/app.js`: passed.
- Screenshots: `baseline/home-375.jpg`, `baseline/report-375.jpg` (375×812 phone preset), `baseline/report-1440.jpg` (1440×900, scaled-down pane capture).

## Route and state inventory

| Route | States exercised | Notes |
| --- | --- | --- |
| `/` | AI available, cooldown, exhausted, unknown, disabled | Fresh-AI checkbox disables and unchecks in every non-available state; Grade my repo stays enabled. |
| `/reports/local-fixture` | 4 deterministic findings, AI not reviewed, Serious and Satirical | 4th finding sits inside "Show remaining findings". |
| `/community`, `/forum`, `/portfolio` | Empty | Empty states are honest; portfolio empty state exposes `content/portfolio.json` to visitors. |
| `/library` | Curated seeds, no submissions | Search filters seeds and submissions. |
| `/methodology` | Static | Table at 375px fits without document overflow. |
| `/admin` | Non-admin fixture user | Server rejects; generic "That didn't load." page. |
| Fixture states not available | Partial coverage, insufficient coverage, missing report, network failure, admin identity | Need fixture extensions in UI-09. |

## Measured findings (375×812 unless noted)

1. **Navigation scrolls sideways on every route.** `nav.scrollWidth > clientWidth`; Slop Form and My Slop are offscreen initially. No document-level overflow (`scrollWidth` 375).
2. **Touch targets.** Per route, 10–40 visible controls are under 44px in one dimension. Nav links are 21px tall; finding actions and vote buttons (30×28) are the bulk on reports.
3. **Small text.** Rendered text at 10, 11, 12 and 13px occurs on home, report, library and methodology (eyebrows 10px, quota/score descriptions 11px).
4. **Tone switch loses context.** Focusing Satirical and activating it moves `document.activeElement` to `<body>` and closes an open "Coverage, metrics, and skipped checks" disclosure (full `innerHTML` rerender).
5. **Route changes are silent.** `document.title` never changes from the home title; no `aria-current`; focus stays on `<body>` after client navigation.
6. **Dialog has no accessible name** (`aria-labelledby` unset) and does not restore focus to its opener.
7. **Live-region chatter.** `#ai-availability` is `role="status"` and is rewritten every second during a countdown, so assistive technology may announce it continuously.
8. **First viewport.** Home: Grade my repo bottom is at 706px of 812 with the fixture banner, so it fits, but the slogan, tone control and intro come before the form. Report: no finding is visible in the first phone viewport; three equal-weight action buttons wrap into tall boxes.
9. **Honesty detail.** Coverage shows "0 KB" for a 140-byte snapshot because bytes are rounded to KB.
10. Finding actions present five peers (View source, Share, Discuss, Bad call?, Find a useful tool, Offer for a social roast) at 12px with no grouping. "Bad call?" and "Discuss this finding" do the same thing.

## Wireframes

Phone (390 wide):

```
┌ slopguard.            [Menu ▾] ┐   Menu = disclosure listing all 5 destinations + Sign in
├────────────────────────────────┤
│ My AI slop grades your AI slop.│   left-aligned, ≤40px
│ Short purpose line             │
│ Public GitHub repository       │
│ [ owner/repo or URL          ] │
│ [      Grade my repo         ] │   ← within first viewport
│ help · Grade Slop Guard itself │
│ ☐ Include a fresh AI review    │
│   muted availability line      │
│ Tone: (Serious|Satirical)      │   secondary
└────────────────────────────────┘

Report
┌ owner/repo                     ┐
│ commit abc12345 · date · rubric│
│ (Serious|Satirical)            │
│ ┌ Deterministic ┬ Probabilistic AI Slop ┐
│ │ 42 /100       │ quota line (muted)    │
│ │ higher = more │ — not reviewed        │
│ └───────────────┴───────────────────────┘
│ Coverage: 1/1 files · Python · 140 B   │
│ [ Fix My AI Slop ]  More actions ▾      │
│ Finding 1  rule · confidence            │
│ │path:4   │ excerpt (local scroll)      │  source gutter
│ consequence / fix / verify              │
│ View source · Discuss this finding      │
│ More ▾ (Share, Bad call?, social opt-in)│
│ Findings 2–3 … then "Show N more"       │
└────────────────────────────────────────┘
```

Desktop (1440): same order; masthead shows inline destinations; report gets a narrow "Jump to finding" index beside the findings when there are more than three; reading column capped near 76ch.

Journey: Home form → report (scores, coverage) → finding → View source (commit-pinned) → tone switch (focus stays on toggle, disclosures retained) → Share finding (deep link) → Fix My AI Slop dialog (Copy / Download) → Discuss this finding (topic with evidence) → `/forum?topic=…`.

## Decisions for downstream issues

- Mobile navigation: a `Menu` button with `aria-expanded`/`aria-controls`, hidden list not focusable, Escape closes and returns focus. Inline nav from 900px up. (UI-03)
- Route announcements: set `document.title` per route, `aria-current="page"`, move focus to the page `<h1>` on client navigation only (not initial load). (UI-03)
- Dialog: `aria-labelledby="modal-label"`, remember and restore the opener. (UI-02)
- Tone switch: rerender, then restore focus by matching selector and reopen previously open `<details>` by stable key. (UI-05; minimal fix in UI-02/03 helpers)
- Countdown: keep the visible ticking text out of a live region; announce only state changes. (UI-04)
- Tokens per sprint direction; status colours paired with text. (UI-02)
- Do not reorder findings; keep server order and the existing 3-then-disclosure split. (UI-05)
