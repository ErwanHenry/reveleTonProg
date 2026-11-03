---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 04
subsystem: content-core
tags: [rules, corpus, archives, references, ids-lock, equite, regle-01, regle-07, regle-08, regle-12]
requires:
  - phase: 02-01
    provides: ids-lock module (lireIdsLock, comparerIdsLock), fixture with wayback_url and ids.lock
  - phase: 02-02
    provides: rule engine, corpus.ts registration module, contained.ts, trap harness
provides:
  - "Corpus rules sources / archives / references / ids_verrouilles / equite and file rule champs_non_importables, registered in famille 'corpus'"
  - "lireArchive(ctx, sourceId): memoised, contained, size-capped, sha256-checked archive reader for plan 02-06"
  - "Traps EQUITE_CANDIDAT_MANQUANT (production, error) and --preview (warning)"
affects: [02-06, 02-07]
tech-stack:
  added: []
  patterns:
    - "Corpus rules report on the invalid-free subset (corpus.entries) and test existence through corpus.listes: no cascading errors"
    - "Only equite.ts reads ctx.mode"
    - "Rule modules import contained.ts / ids-lock.ts only, never load.ts"
key-files:
  created:
    - src/lib/content-core/rules/archives.ts
    - src/lib/content-core/rules/references.ts
    - src/lib/content-core/rules/champs.ts
    - src/lib/content-core/rules/equite.ts
    - tests/rules/archives.test.ts
    - tests/rules/references.test.ts
    - tests/rules/champs.test.ts
    - tests/rules/equite.test.ts
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT/attendu.json
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--preview/attendu.json
  modified:
    - src/lib/content-core/rules/corpus.ts
    - tests/content-core/load.test.ts
    - tests/migrations/migrate.test.ts
key-decisions:
  - "REFERENCE_CASSEE also covers mesure /candidat and source /candidats/N (plain references not listed in the plan's field list)"
  - "EQUITE_COUVERTURE_INCOHERENTE is checked for every case of a published theme's couverture, not only perimeter candidates"
  - "ARCHIVE_TROP_VOLUMINEUX is reported at /archive/extrait"
requirements-completed: [REGLE-01, REGLE-07, REGLE-08, REGLE-12]
duration: ~40min
completed: 2026-11-03
---

# Phase 2 Plan 04: Un corpus cohérent, sourcé et équitable Summary

**A measure pointing to an unknown or foreign source, a missing/oversized/altered archive, a broken reference, a renamed candidate id, an unbalanced published theme or a forbidden data.gouv key now fails `npm run validate` with file, line and stable code.**

## Task Commits

1. Task 1 (sources and archives, REGLE-01): `14e9d82`
2. Task 2 (references, ids.lock, dataset keys, REGLE-07/12): `ea2ad46`
3. Task 3 (equity, REGLE-08): `e916a8e`

## Accomplishments

- `archives.ts`: SOURCE_INCONNUE, SOURCE_AUTRE_CANDIDAT, ARCHIVE_WAYBACK_ABSENTE (once per source cited by a published measure), ARCHIVE_ABSENTE (missing or symlink, reason from `checkContained`), ARCHIVE_TROP_VOLUMINEUX (`statSync` before any read), ARCHIVE_SHA256_DIVERGENT (`node:crypto` over raw bytes). `lireArchive` exported with the exact signature 02-06 expects.
- `references.ts`: REFERENCE_CASSEE for theme, sous-theme (only when the theme is valid), candidat, couverture sources, sondage scores, journal `id_cible` (retrait exempt) and `[[terme]]` / `[[affiché|id]]` markers; ID_NON_VERROUILLE / ID_VERROUILLE_DISPARU / IDS_LOCK_ABSENT / IDS_LOCK_INVALIDE through the same comparator as `npm run ids -- --check`.
- `champs.ts`: AST scan with `visit()` for `bloc`, `extdroite`, `propositions` at any depth; JSON pointer rebuilt from ancestors with `~`/`/` escaping.
- `equite.ts`: perimeter from the last status code (A6), severity from `ctx.mode`, silent when any listed candidat, theme, mesure or couverture file is invalid.
- `npm run validate`: 0 errors on the fixture and with `RTP_CONTENT_ROOT=.`; `npm run check`: 0 errors.

## Verification

- `node --test tests/rules/*.test.ts tests/pieges/pieges.test.ts tests/content-core/*.test.ts tests/migrations/*.test.ts`: 208/208 pass.
- Acceptance greps: no `load.ts` import in `rules/`, no `hostname` in archives, no `readFileSync` in champs, `ctx.mode` only in equite.ts.
- Not run, as instructed: full `npm test`, `astro build`.

## Deviations from Plan

### Auto-fixed Issues

None beyond the following, all within the plan's latitude.

**1. Duplicate-key scan tested at rule level, not through the engine**
- **Found during:** Task 2
- **Issue:** The behavior block says a YAML file with a duplicate key still gets the scan. `load.ts` (not editable here) only hands a file to file rules when its YAML read without any `YAML_*` diagnostic, so a duplicate-key file never reaches `champs_non_importables`. Such a file already fails with `YAML_DUPLICATE_KEY`, so CI still fails.
- **Fix:** The rule itself scans any parsed document (verified by calling `regleChamps.run` directly on a duplicate-key document). If the orchestrator wants the scan to reach YAML-failed files, `load.ts` must pass them to file rules (owned by another plan).
- **Files:** tests/rules/champs.test.ts

**2. Test scoping with code filters**
- In `references.test.ts`, `champs.test.ts`, `equite.test.ts`, patches that legitimately trigger other families (e.g. renaming Jean's id touches equity, breaking a mesure's theme triggers EQUITE_COUVERTURE_INCOHERENTE) are asserted on the tested family's codes only, so expectations stay true when plans 02-03 to 02-06 merge. Archive tests remain exact-set.

**3. Extra reference fields**
- `/candidat` on mesures and `/candidats/N` on sources are also checked (plain references; the fixture and all listed tests are unaffected).

## Existing tests adapted (as planned)

- `tests/content-core/load.test.ts` (WR-03 candidat) and `tests/migrations/migrate.test.ts` (« contenu migré ») write an `ids.lock` in their tmp roots. The planning-time audit held: no other existing test needed a change (126 + 208 passing across the verify sets).

## Known Stubs

None.

## Threat Flags

None. T-02-15..T-02-20 mitigations in place: `checkContained`/`readContained` before every disk read, 5 MB cap checked before reading, sha256 on raw bytes, `source.candidats` check with no hostname logic, mode read only in `equite.ts`, AST scan including schema-invalid files.

## Self-Check: PASSED

- Files present: archives.ts, references.ts, champs.ts, equite.ts, four test files, two trap `attendu.json`.
- Commits present: 14e9d82, ea2ad46, e916a8e.
