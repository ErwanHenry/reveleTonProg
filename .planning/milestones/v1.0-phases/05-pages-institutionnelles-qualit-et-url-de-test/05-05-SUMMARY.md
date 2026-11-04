---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 05
subsystem: testing
tags: [playwright, accessibility, performance, privacy, css]
requires: ["05-01", "05-02"]
provides:
  - "QUAL-03: 4G slow load of the heaviest page < 1 s (project 4g)"
  - "QUAL-04: 160 % text, 320 px reflow, reduced motion, 10-colour contrast, privacy specs"
affects: [05-06]
key-files:
  created: [e2e/texte.spec.ts, e2e/mouvement.spec.ts, e2e/contraste.spec.ts, e2e/vie-privee.spec.ts, e2e/poids.ts, e2e/4g.spec.ts]
  modified: [src/styles/niveaux.css, src/styles/base.css, tests/ui/styles.test.ts, playwright.config.ts]
requirements-completed: [QUAL-03, QUAL-04]
completed: 2026-11-03
---

# Phase 5 Plan 05: Text, motion, contrast, privacy and 4G specs Summary

Five Playwright specs plus a real CSS reflow fix: no horizontal scroll at 320 px with text at 160 %, and the heaviest page loads in about 0.4 s under simulated slow 4G.

## Results
- Full e2e: fixture m1 214 passed (49 s), real corpus 1009 passed (3.7 min). `npm run check`: 0 errors. `npm test`: 1570/1570 (run after e2e, not concurrently).
- Contrast: 40 tests per jeu (10 theme ids x 2 levels x 2 pages: first theme page with selector, home) + guard on base.css + page-existence check; all pass, no theme colour changed.
- Privacy: 1 test per jeu; storage keys within CLES_STOCKAGE, cookie empty, only 127.0.0.1 requests. No defect.
- 4G (PROFIL_4G, gzip asserted, cache disabled, 3 cold runs): m1 `/themes/logement/` 9858 B gzip: 397 / 382 / 370 ms; real `/themes/sante/` 29709 B gzip: 431 / 384 / 379 ms (limit 1000 ms).

## CSS fix (orchestrator decision: fix, not document)
Initial RED run (320 px + 160 %): level labels ended at 377 px in a 320 px viewport (408 px on some pages, 334 px for a second label), and 3 further defects surfaced that the prototype did not report.
- `niveaux.css`: `.niveau` and `.niveau label` get `min-inline-size: 0`, label gets `overflow-wrap: anywhere` and `hyphens: auto`. After: every label right edge <= 320 px. No motion added (transition/animation count in niveaux.css unchanged).
- `base.css`: `a { overflow-wrap: anywhere }` (long URLs on Qui sommes-nous: 388 px at 320 px, Mentions légales: 480 px at 160 %); `.cellule-tete > :not(.picto) { min-inline-size: 0 }`, `.cellule-nom` break-word and `.cellule-parti` anywhere (candidate grid on real theme pages: 337 px at 320 px + 160 %).
- `tests/ui/styles.test.ts`: new case for the wrap rules; all existing cases green (ui suite 35/35).

## Task Commits
1. Reflow fix + texte/mouvement specs: b96aa78
2. Contrast and privacy specs: see git log (`test(05-05): contraste ...`)
3. 4G spec, weight helper, project: see git log (`test(05-05): chargement 4G ...`)

## Deviations from Plan
**1. [Rule 1 - Bug] Extra overflow sources**: the plan named only the level labels; long links and candidate cells also overflowed at 320 px. Fixed in base.css (a file listed in the plan).
No other deviations. No stubs, no new threat surface.

## Self-Check: PASSED
