---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 02
subsystem: content-core
tags: [rules-engine, ajv, traps, regle-01, regle-10, regle-11]
requires:
  - phase: 01-fondations-sch-mas-v1-et-content-core
    provides: loadAll, Ajv OVERRIDES, pointerToPos, Diagnostic, formatText/formatGithub
provides:
  - "Stable Ajv business codes SOURCE_ABSENTE, TEXTE_SOURCE_ABSENT, SOURCE_NON_PRIMAIRE, ARCHIVE_ABSENTE with anchored lines"
  - "Trap harness (tests/helpers/overlay.ts) and table-driven runner over tests/fixtures/pieges/*"
  - "Three-tier rule engine (file, entry, corpus) wired into loadAll, fail-closed (REGLE_ECHEC)"
  - "Pure Methode-exportable config.ts: CATALOGUE (39 codes, 7 section 12 traps), HYPOTHESES A1-A12, word lists, bounds, windows"
  - "Registration modules rules/{redaction,corpus,sondages}.ts for wave-2 plans"
  - "contained.ts leaf module (checkContained/readContained), re-exported from load.ts"
affects: [02-03, 02-04, 02-05, 02-06, 02-07]
tech-stack:
  added: []
  patterns:
    - "Finding -> Diagnostic conversion owned by the engine (position via pointerToPos or explicit at)"
    - "Traps as patches (exact-once remplacer) on a temp copy of corpus-valide, exact-set comparison"
key-files:
  created:
    - src/lib/content-core/contained.ts
    - src/lib/content-core/rules/types.ts
    - src/lib/content-core/rules/config.ts
    - src/lib/content-core/rules/index.ts
    - src/lib/content-core/rules/redaction.ts
    - src/lib/content-core/rules/corpus.ts
    - src/lib/content-core/rules/sondages.ts
    - tests/helpers/overlay.ts
    - tests/pieges/pieges.test.ts
    - tests/fixtures/pieges/SOURCE_ABSENTE/attendu.json
    - tests/rules/moteur.test.ts
  modified:
    - src/lib/content-core/ajv.ts
    - src/lib/content-core/load.ts
    - tests/schemas/mesure.test.ts
    - tests/schemas/source.test.ts
key-decisions:
  - "REGLE_ECHEC is reported once per failing rule id (first file touched), not once per file, to avoid an avalanche hiding the real diagnostic"
  - "citer() returns unquoted text truncated to 60 code points plus an ellipsis; callers add their own guillemets"
  - "A file is handed to file rules when its YAML read without any YAML_* diagnostic, even if its schema failed"
  - "Corpus-tier findings without an explicit file default to the content root at 1:1"
requirements-completed: [REGLE-01, REGLE-10, REGLE-11]
duration: ~35min
completed: 2026-11-03
---

# Phase 2 Plan 02: Rule engine and the "mesure sans source" trap Summary

**Removing `source:` from a measure now fails the CI with `SOURCE_ABSENTE` at the `texte_source` line, replayed by a data-driven §12 trap harness, on top of a three-tier fail-closed rule engine and a pure exportable config/catalogue.**

## Performance
- Duration: ~35 min
- Tasks: 3/3
- Files: 11 created, 4 modified

## Task Commits
1. Task 1 (RED): `159ad12` test(02-02): add trap harness and failing SOURCE_ABSENTE trap
2. Task 2 (GREEN): `1051954` feat(02-02): stable business codes for missing source, texte_source, archive and press type (REGLE-01)
3. Task 3: `a2afc5e` feat(02-02): rule engine with registry, config and catalogue

## Accomplishments
- Lot 1 deliverable met: `npm run validate -- --root <copy without source> --format github` exits 1 and prints `::error file=...,line=7,col=1,title=SOURCE_ABSENTE::mesure sans source : ...`.
- `CodeOverride.anchor` positions "missing property" errors on a neighbouring key (`texte_source`, `titre`, `url`); falls back to the original position when the anchor is itself missing.
- Trap runner: drop `tests/fixtures/pieges/<CODE>[--variante]/attendu.json` and `npm test` replays it with exact-set matching on (code, severite, fichier, pointer) plus optional line; self-checks cover base corpus `[]` (production and preview), exact-once guard, `..` refusal, comparer strictness; catalogue checks tie each directory to `CATALOGUE`.
- Engine: `appliquerRegles` runs file rules over every readable file (including schema-invalid ones), entry rules over valid entries, corpus rules once; `Corpus.listes` carries ids of all listed files and `aDesInvalides()` prevents cascades; a throwing rule gives `REGLE_ECHEC` while the others still run.
- `LoadResult` shape unchanged; `LoadOptions.mode` defaults to `production`; `familles` injectable.

## Deviations from Plan
None of Rules 1-4 beyond the following small design choices inside the plan's latitude:
- `REGLE_ECHEC` is deduplicated per rule id (plan said "one REGLE_ECHEC ... naming the rule id"; a file rule crashing on every file would otherwise produce N copies).
- The registration-module comments cite the requirement sets of the actual owning plans (02-03: REGLE-02/03/06, 02-04: REGLE-01/07/08/12, 02-05: REGLE-09) rather than RESEARCH's older slice numbering.

## Wave-1 independence notes (for the orchestrator / 02-01)
- This plan never touches `corpus-valide`, `ids.lock` or `scripts/ids.ts`. The SOURCE_ABSENTE trap expects `ligne: 7` (the `texte_source` line of `encadrement-loyers.yaml`); 02-01 edits only the enfant rédaction and the source file's `wayback_url`, so the line is stable.
- The harness self-check "base corpus yields `[]`" is evaluated against whichever `corpus-valide` state is checked out; it passes on the pre-02-01 fixture and must keep passing after 02-01 (the engine families are empty, so only Phase 1 diagnostics can appear).
- 02-01 also lists `tests/schemas/source.test.ts` and `mesure.test.ts` in its verify command only (not in its files_modified); this plan edits those two files, so a textual merge conflict is not expected.

## Known Stubs
`rules/redaction.ts`, `rules/corpus.ts`, `rules/sondages.ts` export empty families on purpose (registration modules); plans 02-03, 02-04 and 02-05 fill them.

## Threat Flags
None. T-02-06..T-02-10 mitigations are in place: `citer()` truncation (no rule prints output), `REGLE_ECHEC` fail-closed, `production` default, exact-once and exact-set trap guards, `SOURCE_NON_PRIMAIRE` decided by `type` enum.

## Verification
- `node --test tests/pieges/pieges.test.ts tests/rules/moteur.test.ts tests/schemas/*.test.ts tests/content-core/*.test.ts`: 288/288 pass
- `npm run validate`: 0 errors, 0 warnings; `npm run check`: 0 errors, 0 warnings
- Acceptance greps: 39 unique codes, 7 `piege: '§12`, 12 `A<n>` hypotheses, config.ts has only `import type`, no rule module imports `load.ts`, contained.ts is a leaf.

## Self-Check: PASSED
