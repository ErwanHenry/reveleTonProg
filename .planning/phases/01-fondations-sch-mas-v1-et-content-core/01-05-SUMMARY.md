---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 05
subsystem: content-core
tags: [json-schema, ajv, couverture, glossaire, sondage, journal]

requires:
  - phase: 01-02
    provides: "content-core API, defs/common, validate-yaml test helper, npm run validate"
provides:
  - "schemas/couverture.schema.json (DATA-05)"
  - "schemas/glossaire.schema.json (DATA-06)"
  - "schemas/sondage.schema.json and schemas/journal.schema.json (DATA-01)"
  - "schemas/CHANGELOG.md with the version bump rule and assumptions A1-A4"
  - "fixture: second fictional candidate plus one valid file per new collection"
affects: [01-06, 01-07, phase-02]

tech-stack:
  added: []
  patterns:
    - "if/then re-declares the constrained property so Ajv strict mode (strictRequired) passes"
    - "journal references its target with collection_cible/id_cible, never a field named collection"

key-files:
  created:
    - schemas/couverture.schema.json
    - schemas/glossaire.schema.json
    - schemas/sondage.schema.json
    - schemas/journal.schema.json
    - schemas/CHANGELOG.md
    - tests/schemas/couverture.test.ts
    - tests/schemas/glossaire.test.ts
    - tests/schemas/sondage.test.ts
    - tests/schemas/journal.test.ts
    - tests/fixtures/corpus-valide/src/content/candidats/jean-imaginaire.yaml
    - tests/fixtures/corpus-valide/src/content/couverture/logement.yaml
    - tests/fixtures/corpus-valide/src/content/glossaire/loyer.yaml
    - tests/fixtures/corpus-valide/src/content/glossaire/parti-imaginaire.yaml
    - tests/fixtures/corpus-valide/src/content/sondages/sondage-fictif-1.yaml
    - tests/fixtures/corpus-valide/src/content/journal/20261103-001.yaml
  modified: []

key-decisions:
  - "Schemas copied from RESEARCH Pattern 1 and compiled under unmodified Ajv strict mode (no relaxation)"
  - "Cross-file references (couverture theme, journal id_cible, sondage candidates) are not checked in Phase 1; they are Phase 2 integrity rules"

patterns-established:
  - "Each schema test file loads its fixture, mutates it with swap() and asserts (code, pointer) pairs"

requirements-completed: [DATA-01, DATA-05, DATA-06]

duration: ~20min
completed: 2026-11-03
---

# Phase 1 Plan 05: couverture, glossaire, sondage and journal schemas Summary

**The four remaining v1 JSON Schemas (coverage, glossary, poll, journal) with 59 positive and negative test cases, a 7-file fixture corpus and `schemas/CHANGELOG.md` stating the version bump rule.**

## Accomplishments
- `couverture`: a `non_precise` case must carry at least one `sources_consultees` (then-clause re-declares the property for strict mode); every case needs `verifie_le` and `verifie_par`.
- `glossaire`: `terme` and `parti` entries, definition 1 to 300 characters, `source.type` limited to `parti | institution`, and a `parti` entry must have a `source` of type `parti`.
- `sondage`: `url_notice` and `url_publication` required (https only), `tour` in {1, 2}, enums for `methode` and `base`, each hypothesis has at least two scores, unknown keys such as `bloc` rejected.
- `journal`: `collection_cible` enum plus `id_cible` pattern; a field named `collection` is rejected by `unevaluatedProperties` and tested.
- `schemas/CHANGELOG.md`: bump rule, the eight schemas plus `defs/common`, assumptions A1 to A4, the deferred Phase 2 `wayback_url` rule, and the `collection_cible` naming rationale.
- `npm run validate` on the fixture: 7 files, 0 errors.

## Task Commits
1. **Task 1: couverture and glossaire schemas, tests, fixtures** - `49353f8` (feat)
2. **Task 2: sondage and journal schemas, fixtures, CHANGELOG** - `7895626` (feat)

## Verification
- `node --test tests/schemas/couverture.test.ts tests/schemas/glossaire.test.ts`: 26 tests pass (13 + 13 after dropping a redundant case)
- `node --test tests/schemas/sondage.test.ts tests/schemas/journal.test.ts`: 33 tests pass
- `npm run validate`: exit 0, `7 fichier(s), 0 erreur(s)`
- All acceptance greps pass. Full `npm test`, `astro check` and `astro build` deliberately not run (wave rule).

## Deviations from Plan

### Judgment calls
- **Commit trailer** is `Co-Authored-By: Claude Sonnet 5.5` (orchestrator instruction) instead of the plan's `Claude Opus 5.5`.
- **Worktree base**: the worktree was created on `de2265e`, not the expected base `515a5ef`; reset to `515a5ef` as the startup check prescribes (no work existed at that point).
- **TDD**: tasks are `tdd="true"` but schemas, fixtures and tests were written together and went green on the first run (one fix to a test only: a redundant identity-swap case removed). No separate RED commit; plan type is `execute`.
- Tests also cover cases beyond the plan list (unknown glossaire key, journal `source` in http, journal `id_cible` uppercase, `version_schema: 2` per schema, sondage `relu` with relecteur).

No Rule 1-3 auto-fixes were needed.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model. T-01-13 to T-01-17 are mitigated and covered by tests (parti source type const, no `collection` field, https-only poll URLs, `non_precise` sources, unknown keys rejected).

## Notes for later plans
- The coverage fixture references theme `logement`, and the journal fixture references `marie-fictive/encadrement-loyers`; both targets are created by plan 01-06. Cross-file checks are Phase 2.
- With the four new schemas present, `loadAll` no longer skips these collections: `npm run validate` now validates 7 fixture files.

## Self-Check: PASSED
All files in key-files.created exist in the worktree; commits `49353f8` and `7895626` exist in `git log`.
