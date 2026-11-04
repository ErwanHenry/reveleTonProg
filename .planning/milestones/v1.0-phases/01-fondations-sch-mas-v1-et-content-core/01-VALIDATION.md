---
phase: 1
slug: fondations-sch-mas-v1-et-content-core
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node 24, TS natif) |
| **Config file** | none — flags in npm scripts (Wave 0 installs) |
| **Quick run command** | `fnm exec --using=24 node --test <touched test files>` |
| **Full suite command** | `fnm exec --using=24 sh -c 'npm run migrate -- --check && npm run validate && npm run check && npm test && npm run build'` |
| **Estimated runtime** | ~45 seconds for the full suite. `astro check` takes ~10 s; `tests/dist/skeleton.test.ts` runs 3-4 sequential astro builds (~20 s); `npm run build` takes ~8 s; unit tests take < 5 s |

---

## Sampling Rate

- **After every task commit:** `node --test` on the touched test files (< 5 s), plus `npm run validate` (default root = `tests/fixtures/corpus-valide`)
- **Wave-parallel plans (waves 2 and 3):** each plan runs only its own test files. Astro commands (`npm run check`, `npm run build`, `tests/dist/skeleton.test.ts`) are run only by the designated plan of the wave: 01-02 in wave 2 (check only), 01-04 in wave 3. That avoids concurrent builds and syncs on `.astro/`
- **Wave 4 (01-06, alone):** its own tests, plus skeleton.test, check and build
- **Wave 5 (01-07, final):** full `npm test` and the full suite command; this is the only plan that runs the whole suite
- **Before `/gsd:verify-work`:** full suite green locally AND the GitHub Actions run green on `main` (plan 01-07 Task 3)
- **Max feedback latency:** 5 s per task; ~45 s for the full suite

---

## Per-Task Verification Map

| Requirement | Plan / Task | Test Type | Automated Command | File Exists | Status |
|-------------|-------------|-----------|-------------------|-------------|--------|
| FOND-01 | 01-01 T2; 01-07 T3 | unit + clean clone + CI | `node --test tests/repo/scaffold.test.ts`; clean-clone sequence (Node 22 refused, Node 24 green); `gh run list` | ❌ W0 (01-01 T2) | ⬜ pending |
| FOND-02 | 01-01 T1-T2; 01-04 T2 | unit + build | `node --test tests/repo/astro-config.test.ts tests/dist/skeleton.test.ts` | ❌ W0 (01-01) | ⬜ pending |
| FOND-03 | 01-03 T1; 01-07 T3 | unit + real CI | `node --test tests/repo/ci.test.ts`; `gh run watch --exit-status` (main green, probe red) | ❌ (01-03 T1) | ⬜ pending |
| FOND-04 | 01-03 T1; 01-07 T3 | unit + gh api (read-only) | `node --test tests/repo/ci.test.ts` (gitleaks pin + checksum, dependabot cooldown); `gh api .../contents/.github/dependabot.yml --jq .path` | ❌ (01-03 T1) | ⬜ pending |
| FOND-05 | 01-03 T2; 01-07 T3 | unit | `node --test tests/repo/docs.test.ts` | ❌ (01-03 T2) | ⬜ pending |
| DATA-01 | 01-02 T1; 01-05 T1-T2; 01-06 T1; 01-07 T1 | unit | `node --test tests/schemas/meta.test.ts` | ❌ (01-07 T1) | ⬜ pending |
| DATA-02 | 01-02 T1 | table-driven unit | `node --test tests/schemas/candidat.test.ts` | ❌ (01-02 T1) | ⬜ pending |
| DATA-03 | 01-06 T1 | unit | `node --test tests/schemas/mesure.test.ts` | ❌ (01-06 T1) | ⬜ pending |
| DATA-04 | 01-06 T1 | unit | `node --test tests/schemas/source.test.ts` | ❌ (01-06 T1) | ⬜ pending |
| DATA-05 | 01-05 T1 | unit | `node --test tests/schemas/couverture.test.ts` | ❌ (01-05 T1) | ⬜ pending |
| DATA-06 | 01-05 T1 | unit | `node --test tests/schemas/glossaire.test.ts` | ❌ (01-05 T1) | ⬜ pending |
| (theme, sondage, journal) | 01-06 T1; 01-05 T2 | unit | `node --test tests/schemas/theme.test.ts tests/schemas/sondage.test.ts tests/schemas/journal.test.ts` | ❌ | ⬜ pending |
| DATA-01..06 corpus | 01-07 T1 | integration | `node --test tests/content-core/corpus-valide.test.ts` | ❌ (01-07 T1) | ⬜ pending |
| DATA-07 | 01-02 T1-T2; 01-04 T1 | unit + integration | `node --test tests/content-core/load.test.ts tests/content-core/validate-cli.test.ts tests/content-core/astro-parity.test.ts` | ❌ (01-02, 01-04) | ⬜ pending |
| DATA-08 | 01-07 T2 | unit + CLI | `node --test tests/migrations/migrate.test.ts tests/migrations/cli.test.ts` | ❌ (01-07 T2) | ⬜ pending |
| diagnostics | 01-02 T1 | unit | `node --test tests/content-core/diagnostics.test.ts` | ❌ (01-02 T1) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
All commands run under `fnm exec --using=24` (the user's default Node is 22).

---

## Wave 0 Requirements

Covered by plan 01-01, with the RED e2e test written first:

- [ ] `tests/dist/skeleton.test.ts` + first fixture file (01-01 T1, RED)
- [ ] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `astro.config.mjs`, `package-lock.json`: Node 24.22.2 arm64 via fnm (01-01 T2)
- [ ] `tests/fixtures/corpus-valide/**`: started in 01-01, completed by 01-05 and 01-06 (8 collections + 1 archive)
- [ ] `tests/helpers/validate-yaml.ts`: `expectOk` / `expectErrors` (01-02 T1)
- [ ] test files listed above (each created by the task that implements the behavior)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dependabot alerts enabled, plus optionally Dependabot security updates and secret scanning push protection | FOND-04 (hardening beyond the version-update config) | This is a repository security setting, so it is a user action. Agents must not change it through the API | Erwan: GitHub > Settings > Code security, then turn on « Dependabot alerts » (and optionally the other two). Check with `gh api repos/ErwanHenry/reveleTonProg/vulnerability-alerts --silent` (exit 0 = on). Steps are in docs/RUNBOOK.md. The 01-07 SUMMARY records « action utilisateur en attente : Dependabot alerts » |

These are automated in plan 01-07 Task 3 rather than manual:

- CI green on main and red on an invalid fixture: `gh run watch --exit-status` on main and on the probe branch `ci-probe/fixture-invalide`.
- Dependabot version-update config on main: `gh api .../contents/.github/dependabot.yml --jq .path`, plus `tests/repo/ci.test.ts`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`gh run watch` waits for a remote run, not a file watcher)
- [x] Feedback latency < 5 s per task; full suite ~45 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
