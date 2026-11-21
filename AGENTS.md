# Repository instructions

- Build and verify the scope in `PROJECT.md`. Keep evidence, coverage, and test results truthful.
- Omit AI bylines, signatures, generated-by notices, and AI co-author trailers from commits, PRs, code, and docs. Never infer who wrote submitted code. Preserve required disclosures, licenses, and existing attribution. Keep the requested product branding and AI feature labels.
- Spend $0. Never enable billing, buy credits, provision paid infrastructure, or use a service that can incur charges. When free usage is uncertain or exhausted, use local fixtures or disable the integration.
- Act lawfully and within authorization. Respect access controls, licenses, privacy, and service terms. Never bypass quotas or execute submitted code. Stop any prohibited action and continue permitted local work.
- You may open pull requests targeting `dev` and merge changes into `dev`. Treat `main` as protected: every change must go through a pull request approved by a human repository admin for the current changes before merging. Never push directly to `main` or bypass its protections.

## Mandatory design system: Quiet Evidence

- Read `docs/DESIGN_PRINCIPLES.md` and `static/theme.css` before any UI change. Emphasis must be earned by evidence: keep claims, coverage, provenance, uncertainty, and next actions legible together.
- All pages must load `static/theme.css` before `static/style.css`. Use the shared semantic tokens; do not duplicate palettes, add route-specific colors, or import remote fonts. Component geometry belongs in style.css. Document new token roles and contrast pairs in the design principles document.
- Use white surfaces, ink text/actions, blue links/focus, and explicit neutral/error/caution states. No green branding, decorative gradients, fake terminals, fabricated activity, or score colors suggesting authorship or unsupported certainty.
- Maintain 16px-equivalent body text, 14px-equivalent metadata, 44px control targets, visible keyboard focus, responsive reflow, reduced motion, and forced-color usability. Color must never be the only state indicator. WCAG 2.2 AA is the target; report actual checks without claiming unmeasured compliance.
- Keep two independent scores, quota under Probabilistic AI Slop, commit-pinned evidence, stable finding links, Serious/Satirical state, and zero-call cached exports intact. Preserve existing public labels and approved UI naming when integrating branches.
- Validate changed routes and error/empty/loading/unavailable states using credential-free local fixtures. Never use the real .env or production DB for design checks. Record verification and remaining behavioral issues.
