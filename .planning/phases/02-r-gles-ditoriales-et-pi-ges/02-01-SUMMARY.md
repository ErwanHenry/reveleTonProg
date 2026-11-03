---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 01
subsystem: content-core
tags: [ids-lock, fixture, gitattributes, cli, regle-07, regle-01]

requires:
  - phase: 01-fondations-sch-mas-v1-et-content-core
    provides: listContentFiles, readContained/checkContained, formatText, corpus-valide fixture
provides:
  - "Fictional corpus ready for every Phase 2 rule (wayback_url, short enfant sentence, locked ids)"
  - "Pure ids.lock module (lireIdsLock, comparerIdsLock, ecrireIdsLock, ajouterIds) reused by plan 02-04"
  - "npm run ids -- --check | --write (append-only)"
  - "Byte-exact archives in Git via .gitattributes"
affects: [02-03, 02-04, 02-05, 02-06]

tech-stack:
  added: []
  patterns:
    - "Pure module with no node: import for logic shared by CLI, validator rule and importer"
    - "CLI conventions: parseArgs strict, usage on stderr exit 2, content errors exit 1, atomic temp-file + rename write"

key-files:
  created:
    - src/lib/content-core/ids-lock.ts
    - scripts/ids.ts
    - tests/content-core/ids-cli.test.ts
    - ids.lock
    - tests/fixtures/corpus-valide/ids.lock
    - .gitattributes
  modified:
    - tests/fixtures/corpus-valide/src/content/sources/marie-fictive-programme.yaml
    - tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml
    - tests/fixtures/corpus-valide/README.md
    - tests/content-core/corpus-valide.test.ts
    - package.json
    - tests/repo/scaffold.test.ts

key-decisions:
  - "ids.lock is only rewritten when ids are added or the file is absent; a no-op --write leaves the file untouched"
  - "ajouterIds also refuses candidat ids that are not valid lock ids, so --write can never produce an invalid lock"
  - "Sort order is by code unit, so IDS_LOCK_INVALIDE sorts before ID_VERROUILLE_DISPARU on the same line"

patterns-established:
  - "wayback_url is the only https value allowed to have host web.archive.org in the fixture; the wrapped URL must be .invalid"

requirements-completed: [REGLE-07, REGLE-01]

duration: 20min
completed: 2026-11-03
---

# Phase 2 Plan 01: Verrou des identifiants et corpus fictif prêt Summary

**`npm run ids -- --check | --write` locks candidat ids append-only (rename or delete caught as ID_VERROUILLE_DISPARU), backed by a pure ids-lock module, and the fictional corpus now carries a Wayback URL, a short enfant sentence and locked ids for all Phase 2 rules.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-11-03
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Fixture `corpus-valide` edited once for every Phase 2 rule: `archive.wayback_url` on the source, enfant sentence shortened (no sentence over 15 words), `ids.lock` at fixture root and repo root (header-only).
- `.gitattributes` keeps archive extracts byte-exact (`-text`) and `ids.lock` LF, so sha256 never drifts on checkout.
- `src/lib/content-core/ids-lock.ts` exports the exact contract plan 02-04 imports (`IDS_LOCK`, `EN_TETE_IDS_LOCK`, `lireIdsLock`, `comparerIdsLock`, `ecrireIdsLock`, `ajouterIds`), with no `node:` import.
- `scripts/ids.ts`: `--check` exits 1 with ID_VERROUILLE_DISPARU / ID_NON_VERROUILLE / IDS_LOCK_ABSENT / IDS_LOCK_INVALIDE; `--write` refuses without touching the lock when a locked id vanished, otherwise appends sorted, atomically. Symlinked or out-of-root locks are refused.

## Task Commits

1. **Task 1: Fixture readiness (wayback, enfant sentence, ids.lock, byte-exact archives)** - `dafc44e` (test)
2. **Task 2: ids.lock module and `npm run ids`** - `1b8990c` (feat)

## Deviations from Plan

None - plan executed exactly as written. One of my own test expectations was wrong on first run (order of `IDS_LOCK_INVALIDE` vs `ID_VERROUILLE_DISPARU` under code-unit sorting); the test was corrected, the implementation was right.

## Verification

- `node --test tests/content-core/corpus-valide.test.ts tests/content-core/load.test.ts tests/schemas/source.test.ts tests/schemas/mesure.test.ts`: 93 pass.
- `node --test tests/content-core/ids-cli.test.ts tests/repo/scaffold.test.ts`: 29 pass.
- `npm run validate`: 0 erreur(s), 0 avertissement(s). `npm run ids -- --check` exits 0 on the fixture and on `RTP_CONTENT_ROOT=.`; `npm run ids` (no flag) exits 2. `npm run check`: 0 errors. `package-lock.json` unchanged.
- Not run (per instructions): full `npm test`, `astro build`, `tests/dist/skeleton.test.ts`.

## Known Stubs

None.

## Threat Flags

None. T-02-01, T-02-02, T-02-04 and T-02-05 mitigations are implemented as planned (contained read before and right before rename, append-only refusal, `-text` archives, all output through `formatText`). T-02-03 (deletion of a line together with its candidat file) stays assigned to plan 02-06.

## Self-Check: PASSED

- Files present: ids-lock.ts, scripts/ids.ts, ids-cli.test.ts, both ids.lock files, .gitattributes.
- Commits present: dafc44e, 1b8990c.
