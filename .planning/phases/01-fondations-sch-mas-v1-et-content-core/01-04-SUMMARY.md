---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 04
subsystem: astro-integration
tags: [astro, content-layer, loader, view-model, zero-js, walking-skeleton]

requires:
  - phase: 01-02
    provides: "content-core (loadAll, resolveContentRoot, schemasDirOf, formatText) and candidat schema"
  - phase: 01-01
    provides: "Astro 7 scaffold, fictional fixture, RED tests/dist/skeleton.test.ts"
provides:
  - "contentCoreLoader(name): Astro object loader without schema, delegating to the shared loadAll"
  - "src/content.config.ts: 8 collections, loader only"
  - "View-model src/lib/corpus (getCandidats, statutCourant) with hand-written TS interfaces"
  - "Zero-JS walking-skeleton page src/pages/index.astro"
  - "tests/content-core/astro-parity.test.ts (CLI/Astro parity, log-once)"
affects: [01-05, 01-06, 01-07]

tech-stack:
  added: []
  patterns:
    - "One parse/validation path: Astro never parses YAML, the loader stores loadAll entries as is (dates stay strings)"
    - "Module-level memo keyed by a file fingerprint: 8 loaders share one loadAll per sync; first reader logs diagnostics"
    - "Loader throws only when watcher is undefined (build); dev keeps previous data"
    - "Pages go through src/lib/corpus, never getCollection"

key-files:
  created:
    - src/lib/content-core/astro-loader.ts
    - src/content.config.ts
    - src/lib/corpus/types.ts
    - src/lib/corpus/index.ts
    - src/pages/index.astro
    - tests/content-core/astro-parity.test.ts
  modified:
    - tests/repo/ci.test.ts
    - tests/repo/docs.test.ts

key-decisions:
  - "Memo key includes projectRoot and contentRoot besides the file fingerprint, so switching RTP_CONTENT_ROOT within one process never reuses stale results"
  - "Warnings are logged (logger.warn) as well as errors, once; only errors abort the build"
  - "Store filePath is relative to the project root (posix separators)"

patterns-established:
  - "Stub Astro LoaderContext in node:test (Map-backed store, collecting logger) to test loaders without spawning Astro"

requirements-completed: [FOND-01, FOND-02, DATA-07]

duration: ~25min
completed: 2026-11-03
---

# Phase 1 Plan 04: Astro loader, view-model and zero-JS skeleton page Summary

**Astro object loader (no schema) over the shared content-core `loadAll`, 8 collections, hand-typed view-model and a zero-JS page: the RED e2e skeleton test is now GREEN.**

## Accomplishments
- `contentCoreLoader(name)` follows RESEARCH Pattern 4 with the A5 refinements: fingerprint memo (relative path + mtime + size of `src/content/**` and `schemas/**`), `reported` flag so the 8 loaders log each diagnostic exactly once, `store.clear()` then `store.set` with `generateDigest`, throws `content-core : N erreur(s) de contenu, build interrompu` only when `watcher` is undefined, dev watcher re-runs on change/add/unlink under `/src/content/`.
- `src/content.config.ts` is 8 explicit `defineCollection({ loader })` lines: no `schema`, no Zod, no `reference()`, no `glob()`/`file()` (grep gate = 0).
- View-model: `Candidat`/`StatutEntree`/`SourceStatut` interfaces mirror the schema (dates typed `string`); `getCandidats()` casts once and sorts with `Intl.Collator('fr')` on `nom_tri`; `statutCourant()` returns the last `statuts` entry.
- `src/pages/index.astro`: `lang="fr"`, noindex, no script/client directive/external URL, empty state, and the `</span>⏎à des fins de test.` compressHTML probe. Built HTML contains `Marie Fictive, Parti Imaginaire : declare — 2026-10-15`, 0 `<script`, 0 `.js` files.
- A5 resolved: verified by the parity test (8 loaders against a broken root log the single `SCHEMA_REQUIRED` diagnostic once) and by skeleton case (c) on a real `astro build`.

## Task Commits
1. **Task 1: Astro object loader, 8 collections, parity test** - `0711795` (feat)
2. **Task 2: view-model and zero-JS skeleton page** - `a61e119` (feat)

## Verification
- `node --test tests/content-core/astro-parity.test.ts tests/dist/skeleton.test.ts`: 5 tests, 5 pass (skeleton a, b, c GREEN)
- `npm run validate`: 0 erreur(s); `npm run check`: 23 files, 0 errors, 0 warnings, 0 hints; `npm run build`: exit 0, 1 page
- Acceptance greps: `loadAll(` in loader >= 1; schema/zod gate 0; `contentCoreLoader('` count 8; `getCollection` in index.astro 0; `Intl.Collator('fr')` 1
- Full `npm test` not run (wave rule, runs in 01-07)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run check` failed on pre-existing test typings**
- **Found during:** Task 1 verification
- **Issue:** `tests/repo/ci.test.ts` (10 errors) and `tests/repo/docs.test.ts` (1 error) from plan 01-03 did not satisfy `noUncheckedIndexedAccess`, so the plan's `npm run check` (0 errors) gate could not pass.
- **Fix:** typed `jobs` as `{ verifier: Job; secrets: Job } & Record<string, Job>`, added `?.` on `node[0]` and `block[1]`, `?? 0` on the cooldown comparison. No behavior change; ci/docs tests still pass.
- **Files modified:** `tests/repo/ci.test.ts`, `tests/repo/docs.test.ts`
- **Commit:** `0711795`

**2. [Attribution] Commit trailer** is `Claude Sonnet 5.5` (accurate attribution, coordinator instruction) instead of the plan's `Claude Opus 5.5`.

**3. [TDD note]** Tasks are `tdd="true"`; the RED for task 2 is the pre-existing skeleton test from 01-01 (committed RED). Task 1's parity test was written together with the loader and went green on first run, so there is no separate RED commit for it.

### Minor
- Memo key also includes `projectRoot` and `contentRoot` (plan listed only file fingerprints).
- Warnings are also surfaced through `logger.warn` (once).

## Known Stubs
None. The page intentionally shows fictional data from the fixture; real content arrives in Phase 3.

## Threat Flags
None beyond the plan's threat model. T-01-34 (no second parser, grep gate 0), T-01-04 (text expressions only, no `set:html`), T-01-07 (skeleton test asserts no script/js/external resource) and T-01-35 (build aborts on invalid data, no `index.html`) are mitigated and covered by tests.

## Notes for later plans
- 01-05 drops the other 7 schemas and fixture files: the loader already registers all 8 collections and will pick them up (a collection with files but no schema yields `SCHEMA_INCONNU` and fails the build).
- `dist/` and `.astro/` are gitignored; the clean-clone proof stays in 01-07.

## Self-Check: PASSED
Files exist: astro-loader.ts, content.config.ts, corpus/types.ts, corpus/index.ts, pages/index.astro, astro-parity.test.ts. Commits `0711795` and `a61e119` exist in `git log`.
