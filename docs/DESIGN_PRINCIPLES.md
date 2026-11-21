# Quiet Evidence

Slop Guard design direction · 20 November 2026

## The principle: emphasis must be earned by evidence

A finding should attract attention in proportion to its engineering consequence and the evidence supporting it. A score, an unavailable review, and a popularity vote represent different kinds of information; their presentation must make those distinctions easy to understand. Reduce the effort between seeing a claim, inspecting its source, and choosing a useful next action.

Quiet Evidence is this project's synthesis of established practices, not a claim of a newly proven scientific law. The visual character is an open, white workspace with midnight-plum type, grader-violet links and highlights, clear source excerpts, and restrained status messages. Humor belongs in the wording of the selected mode. It must never change the apparent reliability of a finding.

## Research and decisions

These references were consulted on 20 November 2026. They span human–computer interaction, perception, industrial design, information design, accessibility, service design, and software architecture. They are a focused selection relevant to this product, not a survey of every design field.

| Field and reference                                                                                                                         | Relevant lesson                                                                                    | Slop Guard decision                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HCI: [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)                                           | Make system state visible, maintain consistency, support recovery, and reduce unnecessary content. | One clear primary action per task region; retain entered values on errors; put recovery beside the failure.                                                    |
| Perception: [Gestalt proximity](https://www.nngroup.com/articles/gestalt-proximity/)                                                        | Spatial grouping communicates relationships.                                                       | Keep a claim, provenance, consequence, and fix together; use larger gaps between unrelated findings.                                                           |
| Editorial and visual hierarchy: [NN/g visual principles](https://www.nngroup.com/articles/principles-visual-design/)                        | Scale, contrast, and grouping direct attention.                                                    | A short title, readable body, quiet metadata, and code in a consistent monospace face. Avoid a page of equally loud cards.                                     |
| Industrial design: [Dieter Rams, via Vitsœ](https://www.vitsoe.com/us/about/good-design)                                                    | Useful, understandable, honest, restrained products can remain useful over time.                   | No fake activity, theatrical terminals, ornamental gradients, or claims of certainty unsupported by the scan.                                                  |
| Service design: [GOV.UK color roles](https://design-system.service.gov.uk/styles/colour/)                                                   | Functional color roles provide consistent meaning.                                                 | Violet always means interaction, focus, or the current place; amber means caution; red means an error. No arbitrary palette per route.                         |
| Information design: [ONS uncertainty guidance](https://service-manual.ons.gov.uk/data-visualisation/guidance/showing-uncertainty-in-charts) | Decide whether an uncertain estimate can support a meaningful comparison.                          | Keep coverage and uncertainty beside results. An unavailable score is unavailable, never zero. Avoid probability-like gauges for uncalibrated model judgments. |
| Inclusive interaction: [WCAG 2.2](https://www.w3.org/TR/WCAG22/)                                                                            | Contrast, reflow, keyboard access, and target sizing are testable requirements.                    | Target WCAG 2.2 AA. Use 44px controls as a project default, above the AA 24px minimum with its exceptions. Preserve visible focus and semantic controls.       |
| Systems engineering: [W3C Design Tokens Community Group](https://www.w3.org/community/design-tokens/)                                       | Reusable named decisions support consistency across consumers.                                     | CSS custom properties are the single visual source of truth for this buildless web app. No token-generation toolchain is needed.                               |
| Research quality: [Aesthetic–usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/)                                | Attractive interfaces can conceal usability problems during evaluation.                            | Verify task completion and keyboard behavior separately from visual polish. A screenshot cannot prove accessibility.                                           |

## Theme contract

`static/theme.css` owns the palette, font families, type sizes, spacing scale, radii, readable measure, page width, and control target. `static/style.css` consumes these roles and owns component geometry and responsive composition. `static/index.html` loads the theme before component CSS; all current client routes share that shell. Any future independent HTML entry point must load the same files in the same order.

Do not introduce route-local palettes, copies of `:root` tokens, remote font requests, or inline visual styles. Use semantic names such as `--ink-2` and `--danger`, not hue names such as `--grey-600`. Extend an existing role only when it expresses the same meaning. Add a new role when its meaning differs, and document its foreground/background pair here. Pure geometric values such as zero, one-pixel borders, proportions, and viewport breakpoints may stay in component CSS. Legacy geometry is retained where changing it would require a separate layout redesign.

| Role                           | Value                           | Use                                                                                    |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------- |
| Canvas / surface               | `#ffffff`                       | Page and raised reading surfaces                                                       |
| Ink (midnight plum)            | `#1c1633`                       | Main text, score values, primary actions                                               |
| Secondary ink                  | `#5d5873`                       | Metadata, descriptions, placeholder and disabled text                                  |
| Accent (grader violet) / focus | `#5b2ee0`                       | Links, current page, selected controls, keyboard outline, slogan highlight, logo check |
| Accent hover                   | `#4520b8`                       | Hover on links                                                                         |
| Subtle surface                 | `#f5f4f8`                       | Grouped controls and disabled surfaces                                                 |
| Code surface                   | `#f7f6fa`                       | Source evidence and exported plan preview                                              |
| Accent surface                 | `#f1edff`                       | Linked finding or informative notice                                                   |
| Divider                        | `#e6e3ee`                       | Decorative section separation only                                                     |
| Control boundary               | `#8a8599`                       | Inputs and controls that need a visible boundary                                       |
| Error                          | `#b42318` on `#fef3f2` or white | Failed action, invalid value; include a textual explanation                            |
| Caution                        | `#7a4d0b` on `#fff6e0`          | Fixture identity, limitations, warnings                                                |
| Neutral badge                  | `#403a55` on `#f2f0f7`          | Provenance and categories, never an unsupported quality verdict                        |

The ink is a deep plum rather than flat black, and grader violet is the one accent: it marks links, focus, the current page, selected controls, the second half of the slogan, and the logo check. Use it sparingly; never on scores, warnings, or errors. White text belongs on the ink primary button. Secondary buttons use ink on white. Primary hover uses `#2e2650`. Do not use pale dividers as the only boundary of an input. The light warning border is decorative; warning text communicates the message. Scores stay neutral: no red-to-green spectrum implying a clean bill of health. There is no green success role in this theme; success uses explicit confirmation text.

The favicon is a standalone SVG and cannot inherit the page's custom properties. Its white and ink fills intentionally mirror the theme; update it and the browser theme-color metadata when those source roles change.

## Composition and behavior

- **Space and type:** use the 4/8/12/16/24/32/48/64px rhythm for new work. Use 16px-equivalent body text and at least 14px-equivalent metadata; rem-based type must respect user settings. Limit prose to 72ch; code may scroll inside its own container. Use system fonts without downloads.
- **Scores:** show the two independent scores as two equal boxes: a label and one number each. Put the quota line directly under Probabilistic AI Slop. Keep a short visible status under each number when it is not a plain score ("Insufficient coverage", "Not reviewed", "Model judgment"), and one line beneath both boxes stating that higher means more slop and what was inspected. Longer explanations go in the coverage disclosure. Stack the boxes at narrow widths. Preserve numeric values and source provenance across tone changes.
- **Actions:** use ink for the principal action, outlined controls for alternatives, and underlined text links for navigation. Do not use color alone for selected, error, or unavailable states. New toggles must expose their state programmatically.
- **Forms:** visible labels, retained input, inline error with correction, busy state, one submission per action, and an honest retry. Placeholder text is supplementary. Avoid controls that change meaning when a provider is unavailable.
- **Reports:** show source location, consequence, evidence, and acceptance check as a coherent reading group. Put secondary diagnostics in disclosures; the existence of uncertainty or missing coverage must stay visible outside them, even when the detail is inside.
- **Community:** popularity is social feedback, not an engineering grade. Empty lists explain what users can do next without fabricated members, reviews, or submissions. Maintain public names including Probabilistic AI Slop, Slop Form, and Our Slop (the team portfolio, renamed from My Slop after review).
- **Motion and navigation:** motion should explain a transition and never delay action. Respect reduced motion; never announce every countdown tick. Keyboard focus, dialog return focus, and route announcements require behavioral verification alongside CSS.
- **Small screens:** wrap navigation and actions, stack score blocks, allow long repo names to break, and keep source overflow local. Do not conceal document overflow with a global overflow-x rule. Check 320, 390, 768, and 1440px plus zoom/reflow.
- **Voice:** short, specific sentences; name the failure and the next action. Say only what the view needs: one-line page intros, no eyebrow labels or taglines. Roast code, not people. Satirical and Serious remain two presentations of the same stored evidence.

## Agent acceptance checklist

Before changing UI, read this document, `static/theme.css`, `PROJECT.md`, and root `AGENTS.md`. Inspect the real API/schema before altering consumers. Reuse the existing primitives. Keep the scanner, scores, quotas, consent, exports, escaping, and finding links unchanged unless the task explicitly covers those behaviors.

For each UI change verify the affected routes, loading/empty/error/unavailable states, long text, keyboard focus, 200% text enlargement and 400% reflow, reduced motion, and forced colors as applicable. Check foreground/background contrast (4.5:1 for normal text; 3:1 for meaningful non-text boundaries). Confirm there are no unresolved CSS variables or hardcoded application colors outside the theme's documented SVG/metadata exceptions. Distinguish measured results from requirements still awaiting verification.

A new theme does not fix existing JavaScript focus, announcement, or state-restoration defects. Track those separately rather than claiming CSS has resolved them.
