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
| **Quick run command** | `fnm exec --using=24 sh -c 'TZ=Europe/Paris node --test "tests/**/*.test.ts"'` |
| **Full suite command** | `fnm exec --using=24 sh -c 'npm run migrate -- --check && npm run validate && npm run check && npm test && npm run build'` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `node --test` on the touched area (< 5 s) + `npm run validate` (default root = `tests/fixtures/corpus-valide`)
- **After every plan wave:** full `npm test` + `npm run check`
- **Before `/gsd:verify-work`:** full suite green locally AND GitHub Actions run green on `main` (plan 01-05 Task 3)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Requirement | Plan / Task | Test Type | Automated Command | File Exists | Status |
|-------------|-------------|-----------|-------------------|-------------|--------|
| FOND-01 | 01-01 T1, T3; 01-05 T3 | unit + clean clone + CI | `node --test tests/repo/scaffold.test.ts`; clean-clone sequence; `gh run list` | ❌ W0 (01-01 T1) | ⬜ pending |
| FOND-02 | 01-01 T1, T3 | unit + build | `node --test tests/repo/astro-config.test.ts tests/dist/skeleton.test.ts` | ❌ W0 (01-01 T1) | ⬜ pending |
| FOND-03 | 01-04 T1; 01-05 T3 | unit + real CI | `node --test tests/repo/ci.test.ts`; `gh run watch --exit-status` | ❌ (01-04 T1) | ⬜ pending |
| FOND-04 | 01-04 T1; 01-05 T3 | unit + gh api | `node --test tests/repo/ci.test.ts`; `gh api repos/ErwanHenry/reveleTonProg/vulnerability-alerts --silent` | ❌ (01-04 T1) | ⬜ pending |
| FOND-05 | 01-04 T2; 01-05 T3 | unit | `node --test tests/repo/docs.test.ts` | ❌ (01-04 T2) | ⬜ pending |
| DATA-01 | 01-01 T2; 01-02 T1; 01-03 T1-T2; 01-05 T1 | unit | `node --test tests/schemas/meta.test.ts` | ❌ (01-05 T1) | ⬜ pending |
| DATA-02 | 01-01 T2 | table-driven unit | `node --test tests/schemas/candidat.test.ts` | ❌ (01-01 T2) | ⬜ pending |
| DATA-03 | 01-02 T1 | unit | `node --test tests/schemas/mesure.test.ts` | ❌ (01-02 T1) | ⬜ pending |
| DATA-04 | 01-02 T1 | unit | `node --test tests/schemas/source.test.ts` | ❌ (01-02 T1) | ⬜ pending |
| DATA-05 | 01-03 T1 | unit | `node --test tests/schemas/couverture.test.ts` | ❌ (01-03 T1) | ⬜ pending |
| DATA-06 | 01-03 T1 | unit | `node --test tests/schemas/glossaire.test.ts` | ❌ (01-03 T1) | ⬜ pending |
| (theme, sondage, journal) | 01-02 T1; 01-03 T2 | unit | `node --test tests/schemas/theme.test.ts tests/schemas/sondage.test.ts tests/schemas/journal.test.ts` | ❌ | ⬜ pending |
| DATA-01..06 corpus | 01-05 T1 | integration | `node --test tests/content-core/corpus-valide.test.ts` | ❌ (01-05 T1) | ⬜ pending |
| DATA-07 | 01-01 T2, T3 | unit + integration | `node --test tests/content-core/load.test.ts tests/content-core/astro-parity.test.ts tests/content-core/validate-cli.test.ts` | ❌ (01-01 T2-T3) | ⬜ pending |
| DATA-08 | 01-05 T2 | unit + CLI | `node --test tests/migrations/migrate.test.ts tests/migrations/cli.test.ts` | ❌ (01-05 T2) | ⬜ pending |
| diagnostics | 01-01 T2 | unit | `node --test tests/content-core/diagnostics.test.ts` | ❌ (01-01 T2) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
All commands run under `fnm exec --using=24` (the user's default Node is 22).

---

## Wave 0 Requirements

Covered by plan 01-01 Task 1 (RED tests first):

- [ ] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `astro.config.mjs`, `package-lock.json` (Node 24.22.2 arm64 via fnm)
- [ ] `tests/fixtures/corpus-valide/**`: the fictional corpus, started in 01-01 and completed by 01-02 and 01-03 (8 collections + 1 archive)
- [ ] `tests/helpers/validate-yaml.ts`: `expectOk` / `expectErrors` helper (01-01 T2)
- [ ] test files listed above (each created by the task that implements the behavior)

---

## Manual-Only Verifications

None remain. Both former manual checks are automated in plan 01-05 Task 3 through `gh`:

| Behavior | Requirement | Automated by |
|----------|-------------|--------------|
| GitHub Actions run green on push, red on an invalid fixture | FOND-03 | `gh run watch --exit-status` on main + probe branch `ci-probe/fixture-invalide` |
| Dependabot active on repo | FOND-04 | `gh api .../contents/.github/dependabot.yml` + `gh api -X PUT .../vulnerability-alerts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`gh run watch` waits for a remote run, not a file watcher)
- [x] Feedback latency < 15s (except the remote CI wait in 01-05 T3)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
