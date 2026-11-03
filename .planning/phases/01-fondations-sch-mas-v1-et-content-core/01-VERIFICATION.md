---
phase: 01-fondations-sch-mas-v1-et-content-core
verified: 2026-11-03T13:45:00Z
status: passed
score: 5/5 roadmap success criteria verified; 13/13 requirements satisfied
overrides_applied: 0
re_verification: false
---

# Phase 1: Fondations, schémas v1 et content-core Verification Report

**Phase Goal:** Un développeur clone le dépôt, lance une seule commande, et obtient une validation structurelle du contenu par les schémas JSON v1. Le même loader sert à la CI et à Astro, sur un site statique sans JS, avec une CI durcie et l'hygiène documentée.
**Verified:** 2026-11-03
**Status:** passed
**Re-verification:** No (initial verification, after code-review fixes in 01-REVIEW-FIX.md)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Node 24: `npm install && npm run validate && npm test && npm run build` passes; `dist/` has static HTML with no Astro `<script>` | VERIFIED | Run under Node v24.22.2: validate = "10 fichier(s), 0 erreur(s)"; migrate --check = 10 à jour; `npm test` = 335 pass / 0 fail; `npm run check` = 0 errors, 0 warnings, 0 hints; build = 1 page. `grep -c "<script" dist/index.html` = 0, `.js` files in `dist/` = 0, "Marie Fictive" present. `package.json` engines `>=24.12`, `.nvmrc` = 24, `.npmrc` engine-strict. |
| 2 | Push/PR triggers hardened GitHub Actions; workflow fails when a `corpus-valide` file violates its schema | VERIFIED | `.github/workflows/ci.yml`: triggers on push (main) and pull_request; `permissions: contents: read`; `TZ: Europe/Paris`; actions pinned by 40-hex SHA with version comments; separate gitleaks job (full history, pinned binary with sha256 check). Local probe: removing `statuts` from a candidate gives `SCHEMA_REQUIRED` with a `::error file=…,line=1,col=1` annotation and exit 1. GitHub: CI on main HEAD b01006b = success. Branch `ci-probe/fixture-invalide` run = failure, so CI really fails on an invalid fixture. The `publie` measure without `enfant`/`aine` rule is covered by `tests/schemas/mesure.test.ts`. |
| 3 | Validator CLI and Astro loader share `src/lib/content-core/load`; a YAML date stays a string in both cases, test-verified | VERIFIED | `scripts/validate.ts` and `src/lib/content-core/astro-loader.ts` both import `loadAll` from `./load.ts`. `PARSE_OPTIONS` uses YAML schema `core` (no timestamp tag). `tests/content-core/astro-parity.test.ts` and `load.test.ts` pass. The built page prints the status date 2026-10-15 verbatim. |
| 4 | Bumping `version_schema` without migrating makes `migrate --check` fail; `--write` fixes it; before/after test passes | VERIFIED | Probe on a copy of the repo with `candidat.schema.json` `version_schema` const set to 2: `migrate --check` printed `MIGRATION_EN_RETARD` on 2 files and exited 1. `--write` and before/after fixtures (`tests/fixtures/migrations/candidat-v0-*.yaml`) are covered by `tests/migrations/{migrate,cli}.test.ts` (passing). CI runs `migrate --check`. |
| 5 | LICENSE (MIT code / Licence Ouverte 2.0 content, `archives/` excluded), README (5 questions), ARCHITECTURE (Mermaid + ADR D-1…D-13), RUNBOOK; pushed to GitHub with Dependabot | VERIFIED | LICENSE has 4 categories (MIT, LO 2.0, exclusions). `docs/ARCHITECTURE.md` has a Mermaid diagram and covers D-1 to D-13 (all 13 ids present). `README.md`, `docs/RUNBOOK.md` and `tests/repo/docs.test.ts` exist. `origin` = github.com/ErwanHenry/reveleTonProg, `origin/main` = HEAD. `.github/dependabot.yml` has npm + github-actions with cooldown, and Dependabot has opened PRs (run history). Enabling Dependabot **alerts** is a documented manual step in README and RUNBOOK (the API returns 404 for alerts, so not yet enabled). This is a known user action, not a gap. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `schemas/*.schema.json` (candidat, theme, mesure, source, couverture, glossaire, sondage, journal) + `defs/common` + `CHANGELOG.md` | VERIFIED | All 8 present, compiled by strict Ajv in `tests/schemas/meta.test.ts` and per-schema tests. |
| `src/lib/content-core/{load,ajv,diagnostics,migrate,astro-loader,collections,root}.ts` | VERIFIED | Substantive and wired (CLI, migrate and Astro all call `loadAll`). |
| `scripts/{validate,migrate}.ts`, `scripts/migrations/index.ts` | VERIFIED | Run and exit non-zero on error (checked by probes). |
| `src/content.config.ts`, `src/pages/index.astro`, `src/lib/corpus/*` | VERIFIED | Page renders fixture data (Level 4: Marie Fictive and her date come from the YAML through `loadAll`). |
| `tests/fixtures/corpus-valide/**` (fictional, 8 collections + archive) | VERIFIED | 10 files, 0 diagnostics. |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | VERIFIED | See SC2/SC5. |
| `LICENSE`, `README.md`, `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md` | VERIFIED | See SC5. |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| `scripts/validate.ts` | `content-core/load.loadAll` | WIRED | Direct import and call (line 53). |
| `astro-loader.ts` | `content-core/load.loadAll` | WIRED | One shared `loadAll` per sync for the 8 loaders. |
| `ci.yml` | validate / migrate / check / test / build | WIRED | All steps present in one job. |
| `migrate` | schema `version_schema` | WIRED | Probe confirmed `MIGRATION_EN_RETARD` exit 1. |

### Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| `npm run validate` | 0 errors, 10 files | PASS |
| `npm run migrate -- --check` | 10 up to date | PASS |
| `npm test` | 335/335 | PASS |
| `npm run check` | 0 errors / warnings / hints | PASS |
| `npm run build` | 1 page, no script, no js | PASS |
| Invalid candidate (no `statuts`) | exit 1, `SCHEMA_REQUIRED` + `::error` annotation | PASS |
| Schema version bump without migration | exit 1, `MIGRATION_EN_RETARD` | PASS |
| Nonexistent content root | exit 1, `RACINE_INTROUVABLE` (CR-01 fix effective) | PASS |

### Probe Execution

No `probe-*.sh` scripts are declared or present. The plan's "failing probe" was a CI probe branch, whose GitHub run is confirmed as failed (SC2). Not applicable.

### Requirements Coverage

All 13 IDs appear in plan frontmatter (01-01: FOND-01, FOND-02; 01-02: DATA-01, DATA-02, DATA-07; 01-03: FOND-03, FOND-04, FOND-05; 01-04: FOND-01, FOND-02, DATA-07; 01-05: DATA-01, DATA-05, DATA-06; 01-06: DATA-01, DATA-03, DATA-04; 01-07: DATA-01, DATA-07, DATA-08, FOND-01, FOND-03, FOND-04, FOND-05). No orphaned requirements: REQUIREMENTS.md maps exactly these 13 to Phase 1.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FOND-01 | SATISFIED | SC1 sequence runs green on Node 24; `.nvmrc`, `engines >=24.12`, engine-strict. |
| FOND-02 | SATISFIED | `astro.config.mjs`: static, `compressHTML: true`, `prefetch: false`, noop image service. Asserted by `tests/repo/astro-config.test.ts`. Zero script in dist. |
| FOND-03 | SATISFIED | `ci.yml` SHA pins, `contents: read`, `TZ`, fail-fast steps. CI green on HEAD. |
| FOND-04 | SATISFIED | gitleaks job with pinned, checksum-verified binary. `dependabot.yml` with cooldown, and Dependabot PRs observed. |
| FOND-05 | SATISFIED | LICENSE plus ARCHITECTURE ADRs D-1…D-13. |
| DATA-01 | SATISFIED | 8 schemas, each with `version_schema`, strict Ajv compile (`meta.test.ts`). |
| DATA-02 | SATISFIED | `candidat.schema.json` plus `candidat.test.ts` (statuts, motif, typed source). |
| DATA-03 | SATISFIED | `mesure.schema.json` if/then for `publie` and `relu`, tested. |
| DATA-04 | SATISFIED | `source.schema.json` (presse refused, archive block, `..` refused). Fixture sha256 matches. |
| DATA-05 | SATISFIED | `couverture.schema.json` and tests. |
| DATA-06 | SATISFIED | `glossaire.schema.json` and tests (terme/parti). |
| DATA-07 | SATISFIED | SC3. |
| DATA-08 | SATISFIED | SC4. |

### Anti-Patterns Found

None. No TBD/FIXME/XXX in `src`, `scripts`, `schemas`, `.github`, README or docs. No stub rendering paths. The `src/content/` directory is intentionally empty until Phase 3, and the "corpus réel" CI steps (`RTP_CONTENT_ROOT=.`) pass with 0 files by design.

### Code Review Closure

01-REVIEW.md reported 2 critical and 7 warning findings. 01-REVIEW-FIX.md reports 9/9 fixed, and the fixes are effective in the code (symlink and root checks in `load.ts`, `safe()` sanitisation in `diagnostics.ts`, atomic two-phase `migrate --write`, `checkPathCoherence`). I read `checkPathCoherence` (the fix flagged "requires human verification"): the rule is a strict equality of `data.id` with the path-derived id, and of a mesure's `candidat` with its parent directory. It is correct, and 335 tests pass.

### Human Verification Required

None blocking. Informational only: the repository owner still has to enable Dependabot alerts in GitHub Settings > Code security (documented in README and RUNBOOK; the API currently reports it as off). It is not a code gap.

### Gaps Summary

No gaps. The phase goal is achieved: a single command sequence validates content structurally through one shared loader, the build is static with no JS, CI is hardened and proven to fail on invalid content, and the hygiene documents are in place.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
