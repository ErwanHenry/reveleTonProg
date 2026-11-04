---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 05
subsystem: ui
tags: [astro, css-has, radio-toggle, localStorage, classic-script, large-print]

requires:
  - phase: 04-03
    provides: LecteurNiveaux wrapper, Mesure redactions, base.css tokens, theme pages, build harness
provides:
  - "src/scripts/niveau.js: classic script (923 bytes) restoring/persisting/announcing the level"
  - "LecteurNiveaux: fieldset#niveaux of 4 native radios + script + .lecteur-contenu (ConcerneAine first, slot, level reminder)"
  - "ConcerneAine: « Ce qui me concerne » block (theme and candidate contexts)"
  - "niveaux.css: :has() level switching, Gros caractères token replacement, 48px targets"
affects: [04-06, 04-07, 04-08, 04-09]

tech-stack:
  added: []
  patterns:
    - "Radios own the state, CSS reads it with :has() anchored on .lecteur > .niveaux, JS only persists"
    - "Gros caractères replaces the --t-* tokens on main:has(...) (no multiplier on top)"

key-files:
  created:
    - src/scripts/niveau.js
    - src/components/ConcerneAine.astro
    - src/styles/niveaux.css
    - tests/browser-js/niveau.test.ts
    - tests/dist/cas/niveaux.cas.ts
  modified:
    - src/components/LecteurNiveaux.astro
    - tests/ui/styles.test.ts

key-decisions:
  - "ConcerneAine takes an optional `mesures` prop (LecteurNiveaux forwards it) so a non-perimeter candidate page links only themes it has a section for"
  - "The Gros caractères token rule also sets `font-size: var(--t-corps)` on main, otherwise text inheriting from body would keep the 18px computed there"
  - "`data-js-niveau` is set after the `.niveaux` guard (it only hides the no-JS sentence that lives in the fieldset)"
  - "The hidden-label rule is `.lecteur .redaction > .etiquette` (specificity above base.css) so stylesheet order cannot break it"

requirements-completed: [M1-05, M1-06, M1-09]

duration: 35min
completed: 2026-11-03
---

# Phase 4 Plan 05: Four reading levels Summary

**Four native radios switch every measure between En bref / En détail / Pour les enfants / Gros caractères with CSS `:has()` only, a 923-byte classic script remembers the level under `rtp:niveau`, and Gros caractères replaces the type tokens (20/22/28/36 px), gives 48px targets and shows « Ce qui me concerne ».**

## Performance

- Tasks: 2/2 (TDD)
- `niveau.js`: 923 bytes (limit 2048), no comment, only key `rtp:niveau`
- `npm test`: 1350 tests, 0 failures; `npm run check`: 0 errors, 0 warnings, 0 hints
- Commits: `01880bb` (script + vm tests), `7f015c9` (toggle, CSS, concerne block, tests)

## Accomplishments

- `tests/browser-js/niveau.test.ts` (13 tests, `node:vm` with a fake DOM whose radios behave as a group): restore, hostile values (`"]x`, unknown, empty, null, case variants) ignored, throwing `localStorage` silent, `change` writes only `rtp:niveau` and announces « Niveau « En détail » affiché. », `pageshow` persisted re-syncs, `data-js-niveau`, no `.niveaux` returns cleanly, file size and content constraints.
- `LecteurNiveaux.astro`: markup per RESEARCH with `id="niveaux"`, options generated from `NIVEAUX`/`LIBELLES_NIVEAUX`, only `resume` checked, `autocomplete="off"`, help line, no-JS sentence (`.aide-sansjs`, hidden by `html[data-js-niveau]`), shipped empty `role=status`, then `<script is:inline src={niveauUrl}>` directly after `</fieldset>` (built as `/_astro/niveau.<hash>.js`, byte-identical to source, blocking), then `.lecteur-contenu` = ConcerneAine, slot, « Changer le niveau de lecture » link.
- `niveaux.css`: 4 level rules anchored `.lecteur:has(> .niveaux #niv-X:checked)`, labels visually hidden under `@supports selector(:has(*))` (clip-path, 1px), toggle visuals (hollow/filled dot, hover, 44px labels, 2x2 grid then wrapping row at 37.5em, radio overlay with `opacity: 0`, focus ring on the label with halo), Aîné: tokens replaced on `main:has(> .lecteur > .niveaux #niv-aine:checked)`, `min-height: 3rem` on `a, button, label, summary` (not `.terme`), card grid `minmax(min(100%, 22rem), 1fr)`, `.concerne-aine` shown only there, forced-colors block. No `order` anywhere.
- `ConcerneAine.astro`: published `prioritaire_aine` themes; theme context links `/themes/<id>/` with « (page affichée) » and `aria-current="page"` on the current one; candidate context links `#<theme>` (all themes if the candidate is in the perimeter, else themes with a measure on the page); hall and empty list render nothing.
- Tests: 10 new contract tests in `tests/ui/styles.test.ts`; `tests/dist/cas/niveaux.cas.ts` (11 tests on a production build of corpus-m1: markup, script position and bytes, concerne block on logement and climat, last-element reminder, built-CSS rules after minification, `checkDist` clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aîné font-size would not reach inherited text**
- **Found during:** Task 2 (CSS design)
- **Issue:** `body { font-size: var(--t-corps) }` is resolved at `body`, so overriding `--t-corps` on `main` alone leaves paragraph text inheriting 18px.
- **Fix:** the token rule on `main:has(...)` also declares `font-size: var(--t-corps)` (a token, not a multiplier; asserted by the styles test).
- **Files modified:** `src/styles/niveaux.css`
- **Commit:** `7f015c9`

**2. [Rule 3 - Blocking] `ConcerneAine` needs the page's measures**
- **Found during:** Task 2
- **Issue:** the plan's `<ConcerneAine contexte={contexte} />` cannot know which themes have a section on a non-perimeter candidate page.
- **Fix:** optional `mesures` prop forwarded by `LecteurNiveaux` (which already receives `mesures`). No page file touched.
- **Commit:** `7f015c9`

### Judgement calls

- Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` as instructed by the orchestrator (the plan text said Opus 5.5).
- Worktree base: HEAD was on `d0d869c` (ancestor of `f62b43e`), so `git reset --hard f62b43e` was run as the startup check requires; `npm ci` run (no new dependency).
- The built-CSS test normalises whitespace and quotes (`compact`) because the minifier may rewrite `[data-niveau="x"]`; it uses its own build key (`niveaux-production`) and a `ctx.tmp()` corpus root so it does not share state with `theme.cas.ts`.
- No frame-recording or real-browser evidence was produced here (no browser in this run): the no-flash property (M1-06) rests on script position (tested) and RESEARCH Pitfall 7 evidence; the Phase 5 Playwright pass should re-verify it, the 160 % + Gros caractères reflow, and forced-colors rendering.

## Known Stubs

None. Candidate-page anchors `#<theme id>` in `ConcerneAine` point at sections created by plan 04-06; theme pages (the only pages today) use `/themes/<id>/` links.

## Threat Flags

None. T-04-21 (hostile stored value compared in a loop, `"]x` tested), T-04-22 (only `rtp:niveau`, test asserts no other key, no cookie), T-04-23 (hashed same-origin file, no inline body, `checkDist` clean), T-04-24 (default state shows content; no `:has()` shows all levels with labels; script errors keep the default) are mitigated.

## Self-Check: PASSED

- Files present: `src/scripts/niveau.js`, `src/components/LecteurNiveaux.astro`, `src/components/ConcerneAine.astro`, `src/styles/niveaux.css`, `tests/browser-js/niveau.test.ts`, `tests/dist/cas/niveaux.cas.ts`, `tests/ui/styles.test.ts`.
- Commits present: `01880bb`, `7f015c9`.
