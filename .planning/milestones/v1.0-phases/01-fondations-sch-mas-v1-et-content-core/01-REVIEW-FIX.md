---
phase: 01-fondations-sch-mas-v1-et-content-core
fixed_at: 2026-11-03T13:35:00Z
review_path: .planning/phases/01-fondations-sch-mas-v1-et-content-core/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/01-fondations-sch-mas-v1-et-content-core/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, WR-01 to WR-07)
- Fixed: 9
- Skipped: 0

Run mode: main working tree, no worktree (sole writer, as instructed by the caller). Full gate green after the last fix: `migrate --check`, `validate`, `check` (0 errors), `test` (335 pass, 0 fail, up from 298), `build`. The "corpus réel" steps (`RTP_CONTENT_ROOT=.`) also pass locally: 0 files, exit 0.

## Fixed Issues

### CR-01: A nonexistent or mistyped content root validates as "0 errors" and exits 0

**Files modified:** `src/lib/content-core/load.ts`, `src/lib/content-core/migrate.ts`, `src/lib/content-core/astro-loader.ts`, `scripts/migrate.ts`, `tests/content-core/load.test.ts`, `tests/content-core/validate-cli.test.ts`, `tests/migrations/cli.test.ts`
**Commit:** 3de22fa
**Applied fix:** `listContentFiles` now returns an error diagnostic `RACINE_INTROUVABLE` when the content root does not exist, when `src/content` does not exist, or when `src/content` is not a directory. An existing but empty `src/content` stays accepted (explicit "0 fichier(s)"), so the CI "corpus réel" steps with `RTP_CONTENT_ROOT=.` still pass until Phase 3. `inspectVersions` previously dropped the listing diagnostics, so `migrate --check` could not fail on this. It now includes them, and `migrate --write` deduplicates diagnostics so each is printed once. The Astro loader logs `racine de contenu : <chemin>` on every sync, and the fixture default is unchanged. Tests cover the missing root, the missing `src/content`, `src/content` as a file, the empty `src/content`, and the validate and migrate CLIs.

### CR-02: The symlink refusal is bypassed at `src/` and `src/content/`

**Files modified:** `src/lib/content-core/load.ts`, `src/lib/content-core/migrate.ts`, `tests/content-core/load.test.ts`, `tests/migrations/migrate.test.ts`
**Commit:** fe95ed7
**Applied fix:**
- `listContentFiles` refuses a symlink on `<root>/src` and on `<root>/src/content` (`FICHIER_LIEN_SYMBOLIQUE`).
- It also refuses non-regular files such as FIFOs (`FICHIER_NON_REGULIER`).
- New `checkContained` and `readContained` re-check, right before each read and before each migration write, that the path is not a symlink, is a regular file, and resolves under `realpath(contentRoot)` (`FICHIER_HORS_RACINE`). This closes the TOCTOU window the review described.
- I/O errors on read become `FICHIER_ILLISIBLE` diagnostics instead of exceptions.
- `loadAll`, `inspectVersions` and `runMigrations` use these helpers.
- Tests cover a symlinked `src/`, a symlinked `src/content`, a real FIFO that would block forever if opened, direct containment checks, and a check that `runMigrations --write` writes nothing through a symlink.

### WR-01: Untrusted YAML content is printed unsanitised (workflow-command injection)

**Files modified:** `src/lib/content-core/diagnostics.ts`, `tests/content-core/diagnostics.test.ts`
**Commit:** cb64c87
**Applied fix:** New exported `safe()` replaces control characters (C0, DEL, C1, U+2028 and U+2029) with `\uXXXX`. `formatText` applies it to the file path, code, message and pointer, so every diagnostic is one line and no printed line can begin with `::`. The `::error` annotation line keeps its existing `%0A` encoding, which an existing test pins. Tests cover `safe` and the reproduction from the review: a double-quoted key containing `\n::warning ...` and `::stop-commands::`.

### WR-02: `migrate --write` is not atomic

**Files modified:** `src/lib/content-core/migrate.ts`, `tests/migrations/migrate.test.ts`
**Commit:** 5b4b6f3
**Applied fix:** `runMigrations` now runs in two phases.
1. It computes the migrated text of every outdated file. Every error, including arbitrary exceptions (`MIGRATION_ECHEC`, with the file path) and chain-missing errors, becomes a localized diagnostic.
2. It writes only if phase 1 had no error. Each write goes to a temporary neighbour file (dotfile, mode preserved) and then `renameSync`. If a write fails midway, files already rewritten are restored and `MIGRATION_ECRITURE_ECHEC` is reported.

Behaviour change: a missing migration chain on one file now blocks all writes, where before the other files were migrated. Tests cover a throwing migration on the second file (nothing written, no `.tmp` left), a missing chain with two outdated files, the success path, and a real write failure (read-only directory) with restoration.

### WR-03: Nothing ties a mesure or entry to its path

**Files modified:** `src/lib/content-core/load.ts`, `tests/content-core/load.test.ts`
**Commit:** 911a09b
**Applied fix:** New `checkPathCoherence` in `loadAll`. After schema validation, it emits `ID_CHEMIN_INCOHERENT`, positioned on the `id` key (and on the `candidat` key for mesures):
- when `data.id` differs from the filename-derived id, and
- when a mesure's `data.candidat` differs from its parent directory.

A file with this error is not added to `entries`. The slug-pattern check on the path-derived id is implied: the id must equal the data id, which the schema already validates. `validateYamlText` now also returns `doc` and `lc`. Tests cover the reviewer's scenario (a mesure moved to another candidate's directory under another name) and a candidat file whose name differs from its id.
**Status:** fixed: requires human verification. This is a logic rule, so a quick human read is worthwhile (the id must strictly equal the path-derived id).

### WR-04: Themes and polls can be `publie` with no reviewer

**Files modified:** `schemas/theme.schema.json`, `schemas/sondage.schema.json`, `tests/schemas/theme.test.ts`, `tests/schemas/sondage.test.ts`
**Commit:** c2ac342
**Applied fix:** Same `allOf` block as `mesure.schema.json`: `statut_relecture` of `relu` or `publie` requires `relecteur` and `date_relecture`. Strict Ajv unchanged. New negative tests for both schemas (published without reviewer, reviewed without review date). The fixtures and all existing positive cases still pass. `version_schema` was not bumped: the rule tightens validation without changing the data shape, and the corpus has no real data yet. Say so if you want a version bump.

### WR-05: Watcher callbacks and the shared memo can crash the Astro dev server

**Files modified:** `src/lib/content-core/astro-loader.ts`, `src/lib/content-core/ajv.ts`, `tests/content-core/astro-parity.test.ts`
**Commit:** be39a09
**Applied fix:**
- `fingerprintDir` tolerates files deleted between `readdir` and `lstat`.
- The body of `run()` is wrapped. In dev (watcher present) an exception is logged with `logger.error` and the previous data is kept. In build the error is rethrown.
- The watcher now also watches `schemas/`. A schema change clears the Ajv cache (new `clearSchemaCache()`) before reloading.
- Path matching uses a proper directory-containment check.
- Tests exercise dev (logged, no throw, including a re-triggered watcher event) and build (rejects) with a project root that has no `schemas/` folder.

### WR-06: Schema load and compile errors are uncaught, and compilation is lazy

**Files modified:** `src/lib/content-core/ajv.ts`, `scripts/validate.ts`, `scripts/migrate.ts`, `tests/content-core/schema-load.test.ts` (new)
**Commit:** 2559dcd
**Applied fix:**
- New `SchemaLoadError`. `context()` wraps directory read, JSON parse, `$id` check (missing or outside the URN prefix) and `addSchema`, and names the offending file.
- Every schema is compiled eagerly, so strict-mode faults surface at load time even for a collection with no content file.
- New `checkSchemas(dir)` also asserts that each collection in `COLLECTIONS` has its schema.
- Both CLIs call it up front and exit with code 2 and a one-line message (no stack trace).
- `validate` gained `--schemas`, as the review's IN-07 suggested.
- I also renamed the shadowing `unknown` helper to `schemaInconnu` (IN-07).
- `loadAll` itself keeps returning `SCHEMA_INCONNU` for a collection without a schema, because an existing test pins that.
- New test file with 9 tests.

### WR-07: `npm ci` runs dependency lifecycle scripts, and the workflow runs twice per PR

**Files modified:** `.npmrc`, `.github/workflows/ci.yml`, `docs/RUNBOOK.md`, `tests/repo/ci.test.ts`, `tests/repo/scaffold.test.ts`
**Commit:** 9a6017e
**Applied fix:** `ignore-scripts=true` added to `.npmrc`. Before committing it, I verified in a clean copy of the repo (`/tmp`, removed afterwards) that `npm ci` with the setting installs and that `migrate --check`, `validate`, `astro check`, `npm test` and `astro build` all pass. fsevents is the only package with an install script, and it ships its prebuilt `fsevents.node`. CI `push` is restricted to `branches: [main]`. `docs/RUNBOOK.md` documents the setting and the `npm rebuild <paquet>` escape hatch. Two tests pin both changes.

## Skipped Issues

None. Info findings (IN-01 to IN-08) were out of scope; IN-07's `--schemas` option and the `unknown` rename were done along the way in WR-06.

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
