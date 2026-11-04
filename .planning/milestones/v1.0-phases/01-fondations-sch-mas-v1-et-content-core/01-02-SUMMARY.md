---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 02
subsystem: content-core
tags: [ajv, yaml, json-schema, diagnostics, cli, node-test]

requires:
  - phase: 01-01
    provides: "Node 24 scaffold, fictional fixture corpus-valide, RED skeleton test"
provides:
  - "schemas/defs/common + schemas/candidat (DATA-02 contract) under unmodified Ajv strict mode"
  - "framework-free content-core: collections, root, diagnostics, ajv, load (single parse/validation path)"
  - "npm run validate CLI (--root, --format text|github, exit 0/1/2)"
  - "table-driven test helper tests/helpers/validate-yaml.ts (expectOk, expectErrors)"
affects: [01-03, 01-04, 01-05, 01-06, 01-07]

tech-stack:
  added: []
  patterns:
    - "All YAML goes through content-core parseYaml: core schema, uniqueKeys, no merge, no aliases, no timestamp"
    - "Ajv diagnostics: SCHEMA_<KEYWORD> codes, SCHEMA_FALSE for forbidden props, override table for stable domain codes"
    - "Schemas resolved from a projectRoot passed by the caller, never from import.meta.url inside content-core"

key-files:
  created:
    - schemas/defs/common.schema.json
    - schemas/candidat.schema.json
    - src/lib/content-core/collections.ts
    - src/lib/content-core/root.ts
    - src/lib/content-core/diagnostics.ts
    - src/lib/content-core/ajv.ts
    - src/lib/content-core/load.ts
    - tests/helpers/validate-yaml.ts
    - tests/content-core/load.test.ts
    - tests/content-core/diagnostics.test.ts
    - tests/content-core/validate-cli.test.ts
    - tests/schemas/candidat.test.ts
    - scripts/validate.ts
  modified: []

key-decisions:
  - "Ajv dedupe key is code+pointer+message (not only code+pointer) so two missing required properties on the same object both surface"
  - "Alias detection uses yaml visit() on the AST (gives a line:col) with toJS maxAliasCount 0 as backstop"
  - "RTP_CONTENT_ROOT set to an empty string is treated as unset"
  - "Override table entries carry an optional when() predicate (value, params) so SCHEMA_VERSION_OBSOLETE can compare against the const"

patterns-established:
  - "Position policy: key node for every error except required, which points at the parent object"
  - "YAML parser warnings are promoted to errors (YAML_TAG_RESOLVE_FAILED)"

requirements-completed: [DATA-01, DATA-02, DATA-07]

duration: ~35min
completed: 2026-11-03
---

# Phase 1 Plan 02: content-core, candidat schema and `npm run validate` Summary

**Framework-free content-core (YAML core-schema parse, Ajv 2020 strict, line-located French diagnostics) with the DATA-02 candidat schema and an `npm run validate` CLI.**

## Accomplishments
- `schemas/defs/common.schema.json` and `schemas/candidat.schema.json` copied from RESEARCH Pattern 1 and compiled under unmodified `strict: true` (no strict* relaxation, no coerceTypes, no ajv-formats). `unevaluatedProperties: false` at the root and in every nested object, so `photo` (D-12) and typos are rejected.
- content-core: `COLLECTIONS` table, `root.ts` (fixture default until Phase 3), `diagnostics.ts` (pointer to line:col, text and GitHub formatters, 10-annotation cap), `ajv.ts` (3 custom formats, error mapping, override table with `SCHEMA_VERSION_OBSOLETE`), `load.ts` (parse, walk, `loadAll`, `validateYamlText`).
- Unsafe YAML and misplaced files are refused with stable codes: `YAML_DUPLICATE_KEY`, `YAML_MULTIPLE_DOCS`, `YAML_ALIAS_INTERDIT`, `YAML_RACINE_NON_OBJET`, `YAML_TAG_RESOLVE_FAILED`, `FICHIER_EXTENSION`, `FICHIER_EMPLACEMENT`, `FICHIER_LIEN_SYMBOLIQUE`, `SCHEMA_INCONNU`. Unquoted `2026-10-15` stays a string; `!!timestamp` is rejected as `SCHEMA_TYPE`.
- `npm run validate` prints `content-core : 1 fichier(s), 0 erreur(s), 0 avertissement(s) — racine tests/fixtures/corpus-valide` and exits 0; a broken candidate exits 1 with `<file>:<line>:<col> SCHEMA_REQUIRED`; `--format github` annotates at most 10 errors; unknown flag exits 2.

## Task Commits
1. **Task 1: content-core parse, Ajv and candidat schema** - `58ada9d` (feat)
2. **Task 2: `npm run validate` CLI** - `f1fefdf` (feat)

## Verification
- `node --test tests/content-core/*.test.ts tests/schemas/candidat.test.ts`: 58 tests, 58 pass
- `npm run validate`: exit 0, `0 erreur(s)`
- `npm run check` (astro check, owner of wave 2): 15 files, 0 errors, 0 warnings, 0 hints
- All acceptance greps pass (customTags 0, timestamp 0, `schema: 'core'` 1, `maxAliasCount: 0` 1, `strict: true` 1, strict relaxations 0, `unevaluatedProperties: false` 2, `astro:` imports 0)
- Full `npm test` and `astro build` deliberately not run (wave rule; `tests/dist/skeleton.test.ts` stays RED until 01-04)

## Deviations from Plan

### Auto-fixed / judgment calls

**1. [Rule 2 - Correctness] Dedupe key includes the message**
- **Found during:** Task 1 (Ajv error mapping)
- **Issue:** plan said deduplicate identical (code, pointer) pairs; with `allErrors` two missing required properties share both code and pointer (the parent), so the second would be silently dropped.
- **Fix:** key is code + pointer + message. Identical repeated errors (the date `anyOf`/`else` duplicates) are still collapsed.
- **Files modified:** `src/lib/content-core/ajv.ts`
- **Commit:** `58ada9d`

**2. [Rule 1 - Bug] Empty `RTP_CONTENT_ROOT` resolved to the project root**
- **Found during:** Task 2 (CLI test setup)
- **Issue:** `env.RTP_CONTENT_ROOT ?? DEFAULT` treats `''` as set, so `path.resolve(projectRoot, '')` would validate the repository root.
- **Fix:** use `||`; an empty variable equals an absent one.
- **Files modified:** `src/lib/content-core/root.ts`
- **Commit:** `f1fefdf`

**3. [Attribution] Commit trailer** is `Claude Sonnet 5.5` (accurate model attribution, coordinator instruction) instead of the plan's `Claude Opus 5.5`.

**4. [TDD note]** Tasks are marked `tdd="true"`, but the implementation and tests were written together and went green on the first run; there was no separate RED commit. The tests were still written against the plan's behavior list (58 cases), so they would fail on a regression, but no RED/GREEN gate commits exist for this plan (plan type is `execute`, not `tdd`).

### Minor
- Beyond the plan's list, tests also cover: `motif` outside the enum, a typo in a nested key, `ordre_cc: 0`, `--root` precedence over `RTP_CONTENT_ROOT`, invalid `--format`.
- YAML error messages carry a French prefix for the four common codes (`DUPLICATE_KEY`, `MULTIPLE_DOCS`, `TAG_RESOLVE_FAILED`, `BAD_INDENT`) followed by the original yaml message; other codes keep yaml's English text.
- Override-table entries have an extra optional `when(value, params)` predicate beyond the plan's `{ schema?; keyword; pointer; code; message? }` shape; the interface is a superset.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model. T-01-01 to T-01-05 are mitigated and tested (aliases refused, core schema without custom tags, symlinks never followed, `https-url` format, Ajv strict grep gate).

## Notes for later plans
- `loadAll` skips a collection with `SCHEMA_INCONNU` until its schema file exists; plans adding theme/mesure/source/... schemas simply drop `schemas/<name>.schema.json` (`$id` `urn:reveletonprog:schema:<name>`).
- `.claude/` is untracked in the working tree and was left alone (not part of this plan).

## Self-Check: PASSED
All files listed in key-files.created exist; commits `58ada9d` and `f1fefdf` exist in `git log`.
