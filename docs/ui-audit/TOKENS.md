# UI-02 design tokens and primitives

Defined in `:root` at the top of `static/style.css`. Components use tokens; avoid new colour or spacing literals.

## Roles

| Token | Value | Role |
| --- | --- | --- |
| `--canvas` | `#f7f8f6` | Page background |
| `--surface` | `#ffffff` | Reading surfaces, inputs, secondary buttons |
| `--sunken` | `#eef2ee` | Coverage band, tone track, disabled controls |
| `--code-bg` | `#f1f4f1` | Evidence and plan excerpts |
| `--accent-soft` | `#e6efe9` | Notices, hover, selected tab background |
| `--ink` | `#202722` | Body text and score numbers (scores are not coloured green) |
| `--ink-2` | `#526057` | Secondary text and metadata (minimum 14px) |
| `--line` | `#d8ded9` | Decorative separators |
| `--line-strong` | `#78857b` | Input and control boundaries (needs 3:1) |
| `--accent` / `--accent-hover` | `#245c43` / `#1b4733` | Single accent: primary actions, links, focus, current route |
| `--danger` / `--danger-bg` | `#a13a2e` / `#fbedeb` | Errors, always with text |
| `--warn-ink` / `--warn-bg` | `#6b4a10` / `#fff0cc` | Fixture banner and warnings |
| `--info-ink` / `--info-bg` | `#5a4c7a` / `#efedf6` | Model-review provenance badge |
| `--rule-ink` / `--rule-bg` | `#7a5524` / `#f6ecdf` | Deterministic rule badge |

Type: system UI and system monospace stacks, no web fonts. 14 / 16 / 18 / 20 / 24 / 36 / 48px, with smaller headings under 800px. Code 14px (badges 13px). Tabular numerals for scores, votes and quota timers.
Space: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px (`--s1`–`--s8`). Radius 4/6px. Work area 1200px, reading measure 72ch, gutter 20px (16px on phones). Interactive target 44px.

## Calculated contrast (WCAG 2.x relative luminance)

| Pair | Ratio | Requirement |
| --- | --- | --- |
| ink on canvas / surface | 14.34 / 15.28 | 4.5 |
| ink-2 on canvas / surface / sunken / accent-soft / code-bg | 6.22 / 6.63 / 5.86 / 5.64 / 5.98 | 4.5 |
| accent on canvas / surface / accent-soft | 7.34 / 7.82 / 6.66 | 4.5 |
| white on accent / accent-hover | 7.82 / 10.52 | 4.5 |
| danger on surface / danger-bg / canvas | 6.65 / 5.83 / 6.24 | 4.5 |
| warn-ink on warn-bg | 7.12 | 4.5 |
| info-ink on info-bg | 6.59 | 4.5 |
| rule-ink on rule-bg | 5.70 | 4.5 |
| line-strong on canvas / surface / sunken | 3.62 / 3.86 / 3.41 | 3.0 (UI boundary) |
| focus ring (accent) on canvas / surface | 7.34 / 7.82 | 3.0 |

These are calculated from token values, not from a rendered-pixel audit. UI-09 should re-check rendered combinations.

## Primitives and states

- Buttons: `.primary` (one filled action per task area), `.secondary` (outlined), `.text-button` (tertiary), `.icon-button`. All have a 44px minimum height; disabled uses `--sunken` with `--ink-2` text and `not-allowed` cursor instead of opacity. `[aria-busy="true"]` shows a progress cursor.
- Fields: inputs, textareas and selects share border, height and focus. `[aria-invalid="true"]` adds a danger border; error text uses `.field-error` / `#form-error` with `role="alert"`.
- Notices: `.notice` (info), `.notice-warn`, `.notice-error` / `.scan-error`; each has a left rule plus text, not colour alone.
- Selected state: sort tabs, the tone switch and votes expose `aria-pressed`; styling keys off the attribute as well as the legacy class.
- Dialog: named by `#modal-label` via `aria-labelledby`; focuses the first field or control; restores focus to the opener on close.
- `prefers-reduced-motion` disables animation and smooth scrolling. `forced-colors: active` keeps button borders, highlights pressed or current state with system colours, and uses `Highlight` for focus.

Not yet verified: rendering under forced-colors mode and reduced motion (rules exist; no emulation was run).
