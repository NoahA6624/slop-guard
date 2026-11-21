# Design tokens

Defined in `:root` at the top of `static/style.css`. Components use tokens rather than colour or spacing literals.

Direction (after PR #13 review): plain white, near-black text and primary buttons, one blue accent for links and focus. Colour appears only where it means something (links, focus, errors, warnings). Swapping `--accent` or `--primary` restyles the site.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas`, `--surface` | `#ffffff` | Page and cards |
| `--sunken` / `--code-bg` | `#f4f5f7` / `#f6f7f9` | Tone track, disabled controls, notices / code |
| `--ink` | `#111418` | Text, scores, selected states |
| `--ink-2` | `#5a6169` | Secondary text (14px minimum) |
| `--line` / `--line-strong` | `#e3e6ea` / `#858c96` | Separators / control borders |
| `--primary` | `#111418` | Primary button (one per task area) |
| `--accent` | `#1f4fd1` | Links, text buttons, focus ring |
| `--danger` / `--danger-bg` | `#b42318` / `#fef3f2` | Errors, with text |
| `--warn-ink` / `--warn-bg` | `#7a4d0b` / `#fff6e0` | Local preview banner, warnings |
| `--badge-ink` / `--badge-bg` | `#3d434b` / `#f1f2f4` | Rule and model badges |

Type: system UI and monospace stacks, 14–48px, tabular numerals for scores and timers. Space: 4–64px scale (`--s1`–`--s8`). Targets: 44px.

## Calculated contrast

| Pair | Ratio | Needed |
| --- | --- | --- |
| ink on white | 18.47 | 4.5 |
| ink-2 on white / sunken / code-bg | 6.27 / 5.75 / 5.85 | 4.5 |
| accent on white / sunken | 6.78 / 6.22 | 4.5 |
| white on primary / primary-hover | 18.47 / 12.74 | 4.5 |
| danger on white / danger-bg | 6.57 / 6.05 | 4.5 |
| warn-ink on warn-bg | 6.74 | 4.5 |
| badge-ink on badge-bg | 8.92 | 4.5 |
| line-strong on white / sunken | 3.39 / 3.11 | 3.0 |

Calculated from token values; UI-09 re-checks rendered pixels.

## States

Buttons, fields, notices, tabs, tone switch and votes share hover, focus, selected (`aria-pressed`), disabled (grey fill, not opacity), busy (`aria-busy`) and error (`aria-invalid`, `role="alert"`) treatments. Reduced-motion and forced-colors rules exist but have not been checked under emulation.
