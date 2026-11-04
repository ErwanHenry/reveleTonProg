---
phase: 03-import-data-gouv-et-corpus-pilote
fixed_at: 2026-11-04T14:10:00Z
review_path: .planning/phases/03-import-data-gouv-et-corpus-pilote/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-04
**Source review:** .planning/phases/03-import-data-gouv-et-corpus-pilote/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (Critical 0, Warning 9; Info excluded by scope)
- Fixed: 9
- Skipped: 0

Each fix is one commit with a regression test. No new dependency. The archive tool was never run against the real private repo or the network (tests use tmp dirs and local bare remotes with a local git identity).

## Fixed Issues

### WR-01: `syncPrivate` sweeps in unrelated changes when no file was written
**Files modified:** `scripts/lib/private-store.ts`, `tests/archive/private-store.test.ts`
**Commit:** a368943
**Applied fix:** When `chemins` is given but empty (idempotent re-run), nothing is committed and the global clone state is no longer inspected; pending commits are still pushed. The pathspec is now applied consistently to `status` and `commit`. Test: foreign untracked file stays untouched, no commit, no error.

### WR-02: Private archive directory could be the public repo
**Files modified:** `scripts/lib/private-store.ts`, `.gitignore`, `tests/archive/private-store.test.ts`
**Applied fix:** `resolveArchivesDir` now refuses a directory that is equal to, a parent of, or inside the content root; that shares the same git toplevel; or whose `origin` URL equals the content root's `origin`. `.gitignore` gains `archives/**/*.pdf`, `*.html`, `*.htm`, `*.mhtml`. Tests cover each refusal, the nominal sibling clone, and `git check-ignore` on the real `.gitignore`.

### WR-03: Importer downloaded with an unguarded `fetch`
**Files modified:** `scripts/import-datagouv.ts`, `scripts/lib/fetch-safe.ts`, `tests/import/import-cli.test.ts`
**Applied fix:** `lireReseau` now goes through `fetchSafe` (https only, public addresses re-checked on every hop, size cap, timeout); `FetchSafeError` maps to `fail(...)`. `fetchSafe`'s `Reponse` gained an `etag` field so the snapshot metadata keeps it. Test: `--url` to 127.0.0.1, 169.254.169.254 and `[::1]` exits 1 with `ADRESSE_PRIVEE`, offline.

### WR-04: `fetchSafe.lireCorps` leaked raw read errors
**Files modified:** `scripts/lib/fetch-safe.ts`, `tests/archive/fetch-safe.test.ts`
**Applied fix:** `reader.read()` errors become `FetchSafeError('DELAI')` (Timeout/Abort) or `('RESEAU')`. Tests use a body stream that throws.

### WR-05: Wayback snapshot not checked against the submitted URL
**Files modified:** `scripts/lib/wayback.ts`, `tests/archive/wayback.test.ts`
**Applied fix:** new `instantaneDe` compares the snapshot target to the submitted URL (http/https equivalent, host case, fragment and trailing slash ignored, collapsed `https:/` accepted). A mismatch returns `ok: false` and the URL is not recorded. Tests: mismatch rejected; equivalent variants accepted.

### WR-06: Binary stored after public files, no rollback
**Files modified:** `scripts/archive-source.ts`, `tests/archive/archive-e2e.test.ts`
**Applied fix:** `storeBinary` now runs first in `enregistrer`; the extract and source YAML are written only after it succeeds. `ecrireAtomique` removes a stale temp file and opens with `{ flag: 'wx' }`. E2E test: a colliding private file makes the CLI fail and leaves the public tree unchanged.

### WR-07: Importer re-serialised existing candidate files
**Files modified:** `scripts/lib/datagouv.ts`, `scripts/import-datagouv.ts`, `tests/import/datagouv.test.ts`
**Applied fix:** new `ajouterStatutYaml` uses the `yaml` Document API (`parseDocument`, `seq.add`) and edits the existing text in place, so comments, key order and formatting survive. Used for `statut_ajoute`; new files still use `renderYaml`. Tests check every comment and key order are preserved. Status: fixed (human check advised on one real hand-edited file at next import).

### WR-08: Uncaught YAML parse errors in the importer
**Files modified:** `scripts/import-datagouv.ts`, `tests/import/import-cli.test.ts`
**Applied fix:** the planning-phase parse now records a named `conflit` instead of throwing; the report-phase parse lists the file under « illisible » and continues. Tests: no stack trace, exit 1 with a `conflit :` line; and exit 0 with an `illisible` line for a non-upstream broken file.

### WR-09: Wrong "current status" and date regression precision
**Files modified:** `scripts/lib/datagouv.ts`, `tests/import/datagouv.test.ts`
**Applied fix:** `mergeFiche` uses `statutLePlusRecent` (latest by date, ties to the later list entry, same rule as `dernierCode`); new `dateAvant` compares at the common precision (a `2026-03` upstream date never regresses against `2026-03-15`). Status: fixed, requires human verification (logic change in merge rule). Tests: out-of-order `statuts[]` yields `inchange`; partial same-month date appends.

## Verification

- `node scripts/validate.ts` (default root): exit 0, 0 errors (17 pre-existing readability warnings)
- `node scripts/ids.ts --check`: 59 locked, 0 problems
- `node scripts/couverture-scan.ts --check-data`: exit 0
- `npm run check`: 0 errors, 0 warnings
- `node --test tests/archive/*.test.ts tests/import/*.test.ts tests/couverture/*.test.ts tests/corpus/*.test.ts`: 353 pass, 0 fail

## À reporter dans RUNBOOK (for the orchestrator)

- Archive tool: `RTP_ARCHIVES_DIR` is now refused if it is, contains, or is inside the public repo, or shares its git toplevel or `origin`. The error message names the private repo to clone.
- `.gitignore` now excludes `archives/**/*.{pdf,html,htm,mhtml}`; only `.txt` extracts live in the public repo.
- `npm run import:datagouv -- --url` now only accepts public https hosts (redirects re-checked); local/internal URLs fail with `ADRESSE_PRIVEE`.
- Wayback: if Save Page Now returns a snapshot of a different address, the tool warns and records nothing; rerun later with `--wayback-only <id>`.
- Importer on an existing candidate file adds the status in place (comments kept); a broken YAML candidate file is reported as `conflit` / `illisible`, not a crash.

---

_Fixed: 2026-11-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
