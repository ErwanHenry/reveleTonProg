---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 07
subsystem: content-core
tags: [migration, yaml-document-api, ci, github-actions, gitleaks, dependabot, meta-test]

requires:
  - phase: 01-03
    provides: "Hardened CI, gitleaks job, dependabot.yml, documentation set"
  - phase: 01-05
    provides: "Candidat, couverture, glossaire, sondage, journal schemas and fixtures"
  - phase: 01-06
    provides: "Theme, source and mesure schemas, hashed archive extract"
provides:
  - "tests/schemas/meta.test.ts: DATA-01 contract lock over the 8 schemas and defs/common"
  - "tests/content-core/corpus-valide.test.ts: whole-fixture integration test (DATA-01, DATA-07)"
  - "src/lib/content-core/migrate.ts: inspectVersions, migrateText, runMigrations, TO_STRING_OPTS (DATA-08)"
  - "scripts/migrate.ts: npm run migrate -- --check|--write; scripts/migrations/index.ts: static empty registry"
  - "Repo pushed to GitHub main, CI green on HEAD, failing probe recorded, probe branch deleted"
affects: [phase-02, phase-03, phase-04]

tech-stack:
  added: []
  patterns:
    - "Migrations mutate the YAML Document API only; version_schema is set last; toString({ lineWidth: 0 })"
    - "Static migration registry, no dynamic import (no code runs from content directories)"
    - "Migration CLI mirrors validate.ts: --root, --schemas (schema-bump simulation), --format text|github"

key-files:
  created:
    - tests/schemas/meta.test.ts
    - tests/content-core/corpus-valide.test.ts
    - src/lib/content-core/migrate.ts
    - scripts/migrate.ts
    - scripts/migrations/index.ts
    - tests/migrations/fake-migration.ts
    - tests/migrations/migrate.test.ts
    - tests/migrations/cli.test.ts
    - tests/fixtures/migrations/candidat-v0-avant.yaml
    - tests/fixtures/migrations/candidat-v0-apres.yaml
  modified: []

key-decisions:
  - "migrateText accepts only single-step registry entries (from -> from+1) and refuses two entries for the same step"
  - "runMigrations(write:true) drops the MIGRATION_EN_RETARD diagnostic of files it migrates; with write:false it keeps them (read-only check)"
  - "An unreadable YAML file is classified 'invalide' by migrate and left to `npm run validate` for the detail"
  - "No .gitleaks.toml: gitleaks found nothing on the full history, so no allowlist was created"

patterns-established:
  - "Before/after migration fixtures compared byte for byte, never loosened"
  - "Phase gate run on a real runner: green main run plus a deliberately failing probe branch"

requirements-completed: [DATA-01, DATA-07, DATA-08, FOND-01, FOND-03, FOND-04, FOND-05]

duration: 40min
completed: 2026-11-03
---

# Phase 1 Plan 07: Contract lock, migration runner and CI proof Summary

**Whole-contract meta and corpus tests over the 8 schemas, a comment-preserving idempotent schema migration runner on the YAML Document API (`npm run migrate -- --check|--write`), and a pushed repo with green CI on main plus a recorded failing probe run.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-03
- **Tasks:** 3 of 3
- **Files created:** 10

## Accomplishments

- Meta-test locks the 8 schemas and `defs/common`: URN `$id`, 2020-12 `$schema`, strict-mode compile, integer `version_schema.const`, root `unevaluatedProperties: false`, no property named `collection`, `photo`, `photos` or `image`, and every object subschema with `required` (outside `if/then/else`) closed against unknown properties.
- Corpus-valide test proves the fictional corpus: 0 diagnostics, at least one entry in each of the 8 collections, `data.id` equals the file id, no `Date` anywhere, every `https://` URL host ends in `.invalid`, archive extract present with matching sha256.
- Migration runner: `inspectVersions` classifies `a_jour`, `en_retard`, `trop_recent`, `invalide`; `migrateText` walks the chain and throws `MIGRATION_CHAINE_MANQUANTE` (« Aucune migration candidat v0 -> v1 ») on a gap; `runMigrations` rewrites only late files and only when the text changed. The before/after fixture is byte-equal, keeps the header comment, the inline comment and the >80-char line, and is idempotent.
- Success criterion 4 verified literally: bumping `candidat` to `version_schema` const 2 (via `--schemas` on a temp copy) makes `migrate --check` exit 1 with `MIGRATION_EN_RETARD` for both candidate files.

## Task Commits

1. **Task 1: schema meta-test and corpus-valide integration test** - `76d3229` (test)
2. **Task 2: migration runner with check and write modes** - `93bf552` (feat)
3. **Task 3: phase gate (clean clone, secret scan, push, CI, probe, Dependabot)** - no source change (no `.gitleaks.toml` needed); evidence below

Plan metadata commit: see the final `docs(01-07)` commit.

## Phase gate evidence (Task 3)

| Check | Result |
|-------|--------|
| Local gate `migrate --check && validate && RTP_CONTENT_ROOT=. validate && check && test && build` | exit 0, 298/298 tests |
| Clean clone, Node 22 `npm install` | refused: `EBADENGINE Unsupported engine`, `Required: {"node":">=24.12"}`, exit 1 (engine-strict) |
| Clean clone, Node 24 `npm install && validate && test && build` | exit 0 (298/298 tests, 1 page built) |
| gitleaks v8.30.1 darwin_arm64 (sha256 verified against the official checksums file) `gitleaks git --no-banner --redact .` on full history | 34 commits scanned, `no leaks found`, exit 0 |
| Push `main` (`de2265e..93bf552`) | done, no force |
| CI run on main for HEAD `93bf552` | success: https://github.com/ErwanHenry/reveleTonProg/actions/runs/41633902857 (jobs `verifier` and `secrets` both green, `migrate`, `validate`, `check`, `test`, `build` all pass) |
| Failure probe (branch `ci-probe/fixture-invalide`, `enfant` redaction removed from `encadrement-loyers.yaml`) | failure: https://github.com/ErwanHenry/reveleTonProg/actions/runs/41634101868, failing step « validate (corpus par défaut) » |
| Probe error line | `tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml:11:3 SCHEMA_REQUIRED propriété obligatoire manquante : « enfant » (/redactions)` |
| Probe branch cleanup | deleted on origin, deleted locally, `git ls-remote --heads origin ci-probe/fixture-invalide` prints nothing |
| Dependabot | `gh api repos/ErwanHenry/reveleTonProg/contents/.github/dependabot.yml --jq .path` prints `.github/dependabot.yml`; cooldown present (npm: `default-days: 7`, `semver-major-days: 14`; github-actions: `default-days: 7`). Dependabot version updates are live: two update runs succeeded and opened PRs #1 (typescript 6.0.3 to 7.0.2) and #2 (@types/node 24.19.2 to 26.6.5) |
| Read-only status check `vulnerability-alerts` | HTTP 404 « Vulnerability alerts are disabled » : non activé (action utilisateur) |

## Files Created/Modified

- `src/lib/content-core/migrate.ts` - version inspection, migration chain and write path on the Document API
- `scripts/migrate.ts` - CLI (`--check`, `--write`, `--root`, `--schemas`, `--format`), exit 2 on bad usage
- `scripts/migrations/index.ts` - static registry, empty in v1.0
- `tests/migrations/fake-migration.ts`, `migrate.test.ts`, `cli.test.ts` - 24 tests
- `tests/fixtures/migrations/candidat-v0-avant.yaml`, `candidat-v0-apres.yaml` - byte-for-byte round-trip fixtures
- `tests/schemas/meta.test.ts`, `tests/content-core/corpus-valide.test.ts` - 48 tests

## Decisions Made

See `key-decisions` above. The executor trailer on every commit of this plan is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the plan text said Opus 5.5; the orchestrator instruction naming the accurate model took precedence).

## Deviations from Plan

None - plan executed exactly as written. No schema or fixture needed a root-cause fix: both integration test files passed on the first run, so there is nothing to list under Task 1 fixes. The plan's `files_modified` lists `.gitleaks.toml`; it was intentionally not created because gitleaks reported no leak and no allowlist is justified.

The one non-obvious point: `gh run list --branch main` showed two extra `dynamic` runs next to the `push` CI run (Dependabot update jobs). They are unrelated to CI and both succeeded; the CI run for HEAD was selected by name `CI` and event `push`.

## Issues Encountered

- Dependabot opened PR #1 (typescript 7.0.2) and PR #2 (@types/node 26.6.5) right after the push. `research/STACK.md` pins `typescript ^6.0.3` (peer of `@astrojs/check` is `^5 || ^6`) and `@types/node ^24`. Not merged and not touched; Erwan should close or ignore them. Adding an `ignore` rule for those major versions in `dependabot.yml` would be a sensible follow-up (not done here: out of this plan's scope).

## Actions utilisateur en attente

action utilisateur en attente : Dependabot alerts

Settings > Code security : activer Dependabot alerts (et, en option, Dependabot security updates et secret scanning push protection). Détail dans `docs/RUNBOOK.md`, section « Réglages de sécurité GitHub (action utilisateur, une fois) ». L'agent n'appelle jamais ces endpoints d'écriture (T-01-33).

## Known Stubs

None. `MIGRATIONS` is intentionally empty in v1.0 (no schema has changed version yet); the mechanism is proven by the injected-registry tests and by the `--check` detection tests.

## Threat Flags

None. The only new write path (`runMigrations`) is covered by T-01-26 to T-01-28 and tested (untouched files stay byte-identical, static registry, byte-equality, idempotence).

## Next Phase Readiness

Phase 1 is complete: the v1 contract is frozen and migration-guarded, CI is green on GitHub and proven to fail on an invalid fixture. Phases 2, 3 and 4 can start in parallel. Pending user actions: enable Dependabot alerts, decide on Dependabot PRs #1 and #2.

## Self-Check: PASSED

All created files exist, commits `76d3229` and `93bf552` exist, `origin/main` equals the pushed HEAD, probe branch absent from origin.
