---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 05
subsystem: perf, docs, e2e
tags: [slow-4g, perf-02, d-13, profil-4g, methode, readme, node-test, playwright]

# Dependency graph
requires:
  - phase: 07
    provides: CSS and scripts inlined in the page (one HTML request per page), PROFILS_4G, e2e/4g.spec.ts
  - phase: 08-04
    provides: RUNBOOK « Slow 4G simulé » wording with the 1 s budget, remote 4G switch
provides:
  - PROFILS_4G[1] (slow-4g-lighthouse) with budgetMs 1000 and the libellé « Slow 4G simulé »
  - Méthode and README publish both profiles under 1 s, from the same constant the e2e test enforces
  - ADR-009 dated revision recording the D-13 arbitration
affects: [08-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Published budget pinned twice: the constants deep-equal test and a literal « moins de 1 s » assertion on the rendered Méthode page"

key-files:
  created: []
  modified:
    - src/lib/profil-4g.ts
    - tests/ui/constantes-publiques.test.ts
    - tests/dist/cas/methode.cas.ts
    - README.md
    - docs/ARCHITECTURE.md

key-decisions:
  - "slow-4g-lighthouse budget 1500 -> 1000 ms (D-13, Erwan's choice « Critère 4G à 1 s », 2026-11-08); latence-150 unchanged at 1000 ms"
  - "Public libellé: « le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse : 562,5 ms de latence par requête, 1,44 Mbit/s) »; the Méthode sentence changes only through the constant"
  - "The Méthode sentence keeps « sur un serveur local qui compresse les pages » until 08-14 publishes the measurement behind the real server"

patterns-established:
  - "Budget changes are recorded as a dated revision under the ADR that set them (ADR-009)"

requirements-completed: []
requirements-partial: [PERF-02]

# Metrics
duration: 16min
completed: 2026-11-08
---

# Phase 8 Plan 05: « Slow 4G simulé » under 1 s Summary

**The `slow-4g-lighthouse` profile is now published as « Slow 4G simulé » with a 1 000 ms budget, the same as `latence-150`. The constant in `src/lib/profil-4g.ts` drives the Méthode sentence and the e2e budget. The README says the same, and the heaviest real page loads in about 745 ms locally and 742 ms in CI, under the new budget.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-11-08T20:57:00Z
- **Completed:** 2026-11-08T21:13:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `src/lib/profil-4g.ts`: `budgetMs` of `slow-4g-lighthouse` changed from 1500 to 1000. The new libellé names « Slow 4G simulé ». The header comment no longer says 1 s is out of reach. It explains that since the Phase 7 inlining (ADR-056) a page is one HTML request, so the 562,5 ms latency leaves room under 1 s (about 730 ms measured in 07-05). It also records Erwan's choice of 2026-11-08 and says the budget must not be raised to make a test pass.
- The rendered Méthode sentence now reads: « … avec ces connexions mobiles lentes simulées : moins de 1 s avec une latence de 150 ms par requête et un débit de 1,6 Mbit/s ; moins de 1 s avec le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse : 562,5 ms de latence par requête, 1,44 Mbit/s). » `methode.astro` itself did not need to change.
- `tests/ui/constantes-publiques.test.ts`: the deep-equal now expects budget 1000 and the new libellé, with a comment forbidding a budget raise.
- `tests/dist/cas/methode.cas.ts`: every `data-profil-4g` span must contain « moins de 1 s avec », and the `slow-4g-lighthouse` span must contain « « Slow 4G simulé » ».
- `README.md`: « moins de 1 s à 150 ms de latence par requête, moins de 1 s aussi avec le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse) ». No « 1,5 s » is left.
- `docs/ARCHITECTURE.md`: ADR-009 gets a dated revision recording the arbitration. The WR-04 revision above it still said « le choix entre les deux lectures reste à arbitrer ».

## Task Commits

1. **Task 1: profile budget and label, Méthode wording**: `0de75e0` (test, RED: the constants deep-equal and the Méthode case failed on « moins de 1,5 s avec le profil « Slow 4G » de Lighthouse »), then `44d280f` (feat, GREEN, with the ADR-009 revision)
2. **Task 2: README wording and e2e proof**: `dcd18fd` (docs)

## 4G measures (heaviest page, three cold loads each, budget 1000 ms for both)

| Where | Dataset | Page (gzip) | latence-150 | Slow 4G simulé |
|---|---|---|---|---|
| Local (Mac, gzip test server) | reel | /themes/sante/ (29 637 o) | 327 / 314 / 314 ms | 746 / 745 / 741 ms |
| Local (Mac, gzip test server) | m1 | /methode/ (11 925 o) | 250 / 223 / 224 ms | 637 / 638 / 647 ms |
| CI run 42523319157 | m1 | /methode/ (11 925 o) | 214 / 215 / 214 ms | 637 / 636 / 636 ms |
| CI run 42523319157 | reel | /themes/sante/ (29 637 o) | 310 / 309 / 307 ms | 739 / 742 / 739 ms |

The worst « Slow 4G simulé » measure is 746 ms (local reel run), about 250 ms under the budget. The stop rule (a measure of 1000 ms or more) was not triggered, so no CI re-run was needed.

## Verification

- Task 1 verify: `node --test tests/ui/constantes-publiques.test.ts` gave 3/3, and `node --test --test-name-pattern="[Mm]éthode|methode|4G|4g" tests/dist/site.test.ts` gave 13/13. Acceptance: `grep -c "budgetMs: 1500" src/lib/profil-4g.ts` = 0, and `grep -c "Slow 4G simulé" src/lib/profil-4g.ts` = 2.
- Task 2 verify: `node --test tests/repo/docs.test.ts` gave 43/43, and `npm run e2e -- --jeu reel -- --project=4g` gave 3 passed. Acceptance: README « Slow 4G simulé » count = 1, « 1,5 s » count = 0.
- The 4g project on the m1 dataset gave 3 passed.
- Full `TZ=Europe/Paris fnm exec --using=24 npm test`: 2056 tests, 2052 pass, 0 fail, 4 skipped (the shellcheck cases on the Mac).
- `fnm exec --using=24 npm run check`: 0 errors, 0 warnings, 0 hints.
- CI run 42523319157 on main (commit dcd18fd) succeeded. All three jobs were green: Vérifier (migrate, validate, check, test, build), Chercher des secrets (gitleaks) and Tests navigateur (Playwright, axe, 4G). e2e m1 gave 259 passed and reel 1177 passed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Additions within scope (Rule 2)

**1. ADR-009 dated revision in docs/ARCHITECTURE.md**
- **Found during:** Task 1
- **Issue:** the WR-04 revision of ADR-009 still said the 4G profile choice was « à arbitrer », with a 1,5 s budget. Once the budget changed, that became a stale design record.
- **Fix:** one dated bullet (Phase 8, D-13, 2026-11-08) that records the arbitration, the 1 s budget, the label and the no-raise rule. The historical bullet was left as it was.
- **Files modified:** docs/ARCHITECTURE.md (not listed in files_modified)
- **Commit:** 44d280f

### Not changed

- The Méthode sentence was not touched. The plan expected it to change only through the constant, and it reads correctly as rendered.
- The RUNBOOK was not touched: 08-04 already wrote the « Slow 4G simulé » 1 s wording, and that file belongs to 08-04 in wave 1.

## Issues Encountered

None.

## Known Stubs

None. The Méthode page still says the measure runs on a local server that compresses the pages. That is true until 08-14 publishes the measurement behind the real server.

## Next Phase Readiness

- PERF-02 is partial. The label and budget are published and enforced locally and in CI. What remains is the measurement behind the real Caddy server and a manual Lighthouse run (08-14).
- 08-14 can read `PROFILS_4G[1].libelle` and `budgetMs` (1000) for its `data-mesure-serveur` paragraph.

## Self-Check: PASSED

- FOUND: src/lib/profil-4g.ts, tests/ui/constantes-publiques.test.ts, tests/dist/cas/methode.cas.ts, README.md, docs/ARCHITECTURE.md
- FOUND commits: 0de75e0, 44d280f, dcd18fd
