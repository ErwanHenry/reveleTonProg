---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 02
subsystem: testing
tags: [check-dist, post-build, html-parser, node-test, astro-build, qual-01]

requires:
  - phase: 02-content-core
    provides: motsInterdits, PERIMETRE_EQUITE, loadAll, resolveMode (reused, never copied)
provides:
  - "scripts/lib/html.ts: stdlib HTML tokenizer and tree helpers"
  - "scripts/lib/check-dist.ts: checkDist, cellulesAttendues, CODES_CHECK_DIST, LIMITES"
  - "scripts/check-dist.ts: CLI (--dist, --root, --mode, --format text|github)"
  - "tests/dist/site.test.ts: the single owner of astro builds, loading tests/dist/cas/*.cas.ts"
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, phase-05-methode]

tech-stack:
  added: []
  patterns:
    - "Fault-injection tests on synthetic dist directories (one injected fault, exactly one code)"
    - "Pluggable build cases: tests/dist/cas/<tranche>.cas.ts exports default (ctx: ContexteSite) => void"

key-files:
  created:
    - scripts/lib/html.ts
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - tests/scripts/html.test.ts
    - tests/scripts/check-dist.test.ts
    - tests/dist/contexte.ts
    - tests/dist/site.test.ts
    - tests/dist/cas/squelette.cas.ts
  modified:
    - src/lib/content-core/rules/equite.ts
  deleted:
    - tests/dist/skeleton.test.ts

key-decisions:
  - "ESPACE_PERDU is judged on the parsed tree (previous/next text sibling of every a/button without data-colle) instead of two raw-HTML regexes: same behaviour, data-colle is read from the element itself, also for the closing side"
  - "Visible text joins text nodes with a space, so adjacent blocks never glue into a false word (MOT_INTERDIT, MARQUEUR_RESIDUEL)"
  - "Extra code DIST_VIDE (no HTML page at all) so a wrong --dist or missing build fails closed instead of reporting zero errors"
  - "cellulesParTheme accepts a Map or a plain record; theme pages absent from dist are not an error (theme pages arrive in later plans), only unexpected or miscounted ones are"
  - "No .invalid-contact warning: the clean synthetic dist must report [] and the plan lists no such code"

patterns-established:
  - "Build harness: ContexteSite.construire(cle, { racine, mode? }) memoised by key; RTP_MODE is deleted when no mode is given"

requirements-completed: [QUAL-01]

duration: 40min
completed: 2026-11-03
---

# Phase 4 Plan 02: Post-build check (QUAL-01) and single build harness Summary

**Stdlib post-build checker (`checkDist` + CLI) with 22 codes, each proven by fault injection on synthetic dists, plus `tests/dist/site.test.ts` as the only astro-build owner with pluggable `*.cas.ts` modules.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-03
- **Tasks:** 3 (all TDD, all autonomous)
- **Files:** 8 created, 1 modified, 1 deleted

## Accomplishments

- `scripts/lib/html.ts`: tokenizer and tree (void elements, raw `script`/`style`, entity decoding incl. numeric refs and `&nbsp;` to U+00A0, never throws). No dependency added.
- `scripts/lib/check-dist.ts`: `checkDist(dist, { mode, cellulesParTheme })`, `cellulesAttendues(contentRoot, projectRoot, mode)` (computed from `loadAll` + `statutLePlusRecent` + `PERIMETRE_EQUITE`, independent of any view-model), `LIMITES` (500 000 raw, 100 000 gzip, 2048 script, 1 Ko = 1000 octets), `CODES_CHECK_DIST`.
- `scripts/check-dist.ts`: `CODE chemin : message` lines, summary line, `--format github` annotations, exit 0/1, exit 2 on invalid `--mode` (ModeInvalideError message), bad format or missing dist. The npm alias and CI step are left to plan 04-09, as specified.
- `tests/dist/site.test.ts` builds sequentially, memoises by key, removes temp dirs in `after()`, deletes `RTP_MODE` from the build env when no mode is given, and loads each `tests/dist/cas/*.cas.ts` sorted.
- Skeleton cases (a)-(d) now live in `tests/dist/cas/squelette.cas.ts`; case (a) additionally requires `checkDist` to report zero errors on the corpus-valide production build (it does).
- Tests: `tests/scripts/html.test.ts` 6 passing; `tests/scripts/check-dist.test.ts` 40 `it(` blocks (clean production and preview passes, one test per rule, cells, CLI), all passing; `tests/rules/equite.test.ts` still green; `npm run check` 0 errors, 0 warnings.

## CODES_CHECK_DIST

`POIDS_BRUT`, `POIDS_GZIP`, `SCRIPT_TROP_LOURD`, `RESSOURCE_TIERCE`, `LIEN_EXTERNE_NON_PROTEGE`, `SCRIPT_EN_LIGNE`, `SCRIPT_DATA_URI`, `SCRIPT_NON_BLOQUANT`, `STYLE_EN_LIGNE`, `ID_DUPLIQUE`, `ESPACE_PERDU`, `MOT_INTERDIT`, `MESURE_SANS_SOURCE_DATEE`, `CELLULES_INCOHERENTES`, `THEME_INATTENDU`, `BROUILLON_EN_PRODUCTION`, `PREVIEW_INDEXABLE`, `LIEN_INTERNE_CASSE`, `LANG_ABSENTE`, `H1_NOMBRE`, `MARQUEUR_RESIDUEL`, `DIST_VIDE`.

## Task Commits

1. Task 1: Stdlib HTML tokenizer and tree helpers: `d0ab6d9`
2. Task 2: checkDist rules, expected cells and CLI: `bd559cd`
3. Task 3: Single build harness, skeleton cases migrated: `69b77c4`

## Note for Phase 3 plan 03-09 (skeleton.test.ts)

`tests/dist/skeleton.test.ts` no longer exists. Its four cases moved unchanged in substance to `tests/dist/cas/squelette.cas.ts`, copied from the file as it read on this branch's base (3e90269, before any Phase 3 relabel on main). Plan 03-09 Task 2 must therefore apply its relabel of case (a) strings (e.g. « Squelette de développement », `</span>\s+contenu en brouillon, non relu`) to `squelette.cas.ts` and verify with `node --test tests/dist/site.test.ts`. Merging this branch with a main that edited `skeleton.test.ts` will show a modify/delete conflict: resolve by keeping the deletion and porting the edited strings into `squelette.cas.ts`.

## Deviations from Plan

### Auto-fixed Issues

None needing a rule. Two small judgement calls:

1. ESPACE_PERDU is tree-based rather than regex-on-raw-HTML (see key-decisions); observable behaviour listed in the plan is unchanged.
2. Added the `DIST_VIDE` code (22nd) as a fail-closed guard; not in the plan's list.

**Total deviations:** 0 rule-driven; 2 implementation choices. **Impact:** none on the plan's acceptance criteria.

## Issues Encountered

- The first astro build of a fresh worktree takes about 46 s (cold cache); the 120 s timeout holds.
- The worktree had to be reset to base 3e90269 at start (merge-base was an older commit).
- Test pitfalls fixed during RED/GREEN: a CSS `@import url(https://…)` was reported twice (as `@import` and as `url()`), now once; the srcset test needed its local image to exist.

## Known Stubs

None.

## Threat Flags

None: no new network surface; the checker only reads `dist/` and the content root.

## Next Phase Readiness

Plans 04-03 onward can add `tests/dist/cas/<tranche>.cas.ts` modules and rely on `checkDist`; 04-09 adds `"check-dist": "node scripts/check-dist.ts"` to `package.json`, the CI step after `npm run build`, and the `ci.test.ts` order update.

## Self-Check: PASSED

- Files present: `scripts/lib/html.ts`, `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `tests/scripts/html.test.ts`, `tests/scripts/check-dist.test.ts`, `tests/dist/contexte.ts`, `tests/dist/site.test.ts`, `tests/dist/cas/squelette.cas.ts`; `tests/dist/skeleton.test.ts` absent.
- Commits present: `d0ab6d9`, `bd559cd`, `69b77c4`.
