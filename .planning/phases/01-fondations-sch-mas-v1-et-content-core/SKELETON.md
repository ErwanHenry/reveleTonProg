# Walking Skeleton — reveleTonProg

**Phase:** 1
**Generated:** 2026-11-03

## Capability Proven End-to-End

On a clean clone with Node 24, a developer runs `npm install && npm run validate && npm test && npm run build`. The result is a static `dist/index.html` with zero JavaScript, rendered from the fictional fixture `tests/fixtures/corpus-valide`: the candidate « Marie Fictive », her current status with its date, and a published measure with its dated primary source. Each fixture YAML file passes through `src/lib/content-core` (the single parse and validation path) and then through both the `npm run validate` CLI and the Astro object loader. If a fixture file violates its schema, both paths fail with `fichier:ligne:col CODE message`. GitHub Actions replays the same sequence on every push and PR.

Static-site mapping of the generic skeleton terms:

| Generic | Here |
|---|---|
| DB read | YAML file → `loadAll()` (yaml `parseDocument` + Ajv 2020) |
| DB write | `npm run migrate -- --write` (YAML Document API, comment-preserving) |
| API | `src/lib/content-core` (plain TS, no `astro:*`) |
| UI route | `src/pages/index.astro` → `dist/index.html` |
| Deployment | none in Phase 1: green CI on GitHub plus local `npm run preview`; hosting is lot 3 (v1.1) |

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Node 24 LTS (`.nvmrc` = 24, `engines >=24.12`, `engine-strict=true`); `.ts` scripts run natively (type stripping), no tsx | D-5. Node 22 reaches EOL between the two rounds. Native TS avoids an extra toolchain |
| Framework | Astro 7, `output: 'static'`, `compressHTML: true`, `prefetch: false`, noop image service, `trailingSlash: 'always'`, dev toolbar off | Imposed by the spec. `compressHTML: 'jsx'` (the Astro 7 default) glues French words at inline boundaries |
| Data layer | One YAML file per entity in Git under `src/content/<collection>/`, measures under `mesures/<candidat>/<slug>.yaml`. No database | ADR-001. A public audit trail through Git history and review through PRs |
| Structural contract | JSON Schema 2020-12 in `schemas/` (8 schemas + `defs/common`), URN `$id`s, `version_schema` const, `unevaluatedProperties: false` everywhere | Single source of truth, language-neutral (a lot 5 collector can reuse it). No Zod field schemas |
| Validation engine | Ajv 8 `ajv/dist/2020.js`, `strict: true`, `allErrors`, 3 own formats (`date`, `date-time`, `https-url`), no ajv-formats | Strict mode catches schema typos; own formats are stricter than RFC `uri` |
| YAML parsing | `yaml` 2.9 `parseDocument` with `schema: 'core'`, no `timestamp` tag, `uniqueKeys`, `merge: false`, `maxAliasCount: 0`; parser warnings are errors | Dates stay strings, no Norway problem, no alias bomb, line and column for every diagnostic |
| Shared core | `src/lib/content-core/{collections,root,diagnostics,ajv,load,astro-loader,migrate}.ts`. CLIs in `scripts/` only call it | CI and build cannot drift apart (DATA-07). Phase 2 adds `content-core/rules` and `config.ts` |
| Astro integration | Custom object loader `contentCoreLoader(name)` for each of 8 collections, with NO `schema`, one shared memoized `loadAll` per sync, throws in build | A second parser (`glob()`/`file()`) would reintroduce `Date` objects and a second validation path |
| View-model | Hand-written TS interfaces in `src/lib/corpus/types.ts`; pages call `src/lib/corpus/index.ts` and never call `getCollection` directly; sorting uses `Intl.Collator('fr')` on `nom_tri` | Locked choice. `getCollection` order is not guaranteed; the Phase 4 pages build on these helpers |
| Content root | `RTP_CONTENT_ROOT` env, default `tests/fixtures/corpus-valide` (`root.ts` `DEFAULT_CONTENT_ROOT`) until Phase 3 flips it to `.` | The real corpus is empty in Phase 1, yet the skeleton must render something real. The fixture mirrors the repo layout |
| Diagnostics | `{code, severity, file, line, col, pointer, message}`. Codes are `YAML_*`, `FICHIER_*`, `SCHEMA_*` and `MIGRATION_*`. Output is text (`fichier:ligne:col CODE message (pointeur)`) or GitHub annotations (max 10 per severity) | Actionable in CI. Phase 2 maps them to domain codes through the override table in `ajv.ts` |
| Migrations | `npm run migrate -- --check|--write`; version of a collection = `schema.properties.version_schema.const`; static registry `scripts/migrations/index.ts`; `toString({ lineWidth: 0 })` | DATA-08. Reviewer diffs stay minimal, and no code is loaded from content paths |
| Archives | `archives/<candidat>/<sha12>.txt` committed (sha256 recorded in the source YAML); binaries in the private repo `reveleTonProg-archives`; 5 MB cap | D-8, copyright (CPI L.122-5); the hash is checkable in CI |
| Tests | `node:test` + `node:assert/strict`, `TZ=Europe/Paris node --test "tests/**/*.test.ts"`; only `tests/dist/skeleton.test.ts` spawns `astro build` | Zero test dependencies. Concurrent builds would share the `.astro` cache |
| CI | GitHub Actions: `verifier` job (npm ci → migrate --check → validate → check → test → build, fixture and real root) and `secrets` job (gitleaks 8.30.1 binary, sha256-verified, full history). Actions pinned by SHA, `contents: read`, `TZ=Europe/Paris` | FOND-03/04. The gitleaks MIT binary avoids the action's proprietary licence |
| Dependencies | Dependabot for npm + github-actions, weekly, 7-day cooldown (14 for majors) | FOND-04. The cooldown defends against freshly published malicious versions |
| Auth | None (no accounts, no cookies, no server) | Spec: zero personal data |
| Licensing | Code MIT; editorial content Licence Ouverte 2.0; `archives/` and candidates' texts excluded | D-9 |

## Stack Touched in Phase 1

- [x] Project scaffold: Node 24, Astro 7, TypeScript 6 (`astro check`), `node:test` runner (plan 01-01)
- [x] Routing: one real route `/` rendered from the corpus (plans 01-01, 01-02)
- [x] Data: real read (YAML → content-core → Astro store, plans 01-01..03) AND real write (`migrate --write` through the Document API, plan 01-05)
- [x] UI: data-driven static page (candidate, status, measure, source). There is deliberately no interactive element: the level toggle (radios + `:has()`) is Phase 4, and zero JS by default is a spec constraint
- [x] Deployment: green CI on GitHub plus the documented local command `npm install && npm run validate && npm test && npm run build && npm run preview` (plan 01-05). Hosting is lot 3

## Out of Scope (Deferred to Later Slices)

- Editorial rules and traps (forbidden words, lengths, figures outside the source, verbatim quotes, archive presence and sha256 check, equity, `ids.lock`, poll rules, REGLE-12 scan): Phase 2
- data.gouv import, archiving tool, real pilot corpus, flipping `DEFAULT_CONTENT_ROOT` to `.`: Phase 3
- Theme and candidate pages, 4 reading levels, alphabetical/random order, Aîné/Enfant, preview badge, post-build `check-dist`: Phase 4
- Méthode / Mentions légales / Qui sommes-nous pages, Playwright + axe + 4G tests, preview URL: Phase 5
- Hosting (Caddy, rsync deploy, monitoring), git history squash decision (D-13): lot 3 / v1.1
- Photos (D-12): none in v1.0
- Generated TS types from schemas (`gen-types`), editor `$schema` headers: not in v1.0

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering the decisions above:

- Phase 2: CI refuses a measure without a valid primary source and every applicable §12 trap, with file:line:code annotations (Lot 1 deliverable). Rules plug into `content-core/rules` and run inside the same `loadAll` path
- Phase 3: the 59 real candidates are imported with dated, sourced statuses, plus 3 pilot themes collected from archived primary sources (`DEFAULT_CONTENT_ROOT` → `.`)
- Phase 4: a visitor reads each theme and candidate at their chosen level without JS, built on `src/lib/corpus` and the fixture
- Phase 5: the pilot corpus is navigable on a test URL with institutional pages and proven accessibility and performance (Lot 2 deliverable)
