---
phase: 1
slug: fondations-sch-mas-v1-et-content-core
status: draft
nyquist_compliant: false
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
| **Quick run command** | `TZ=Europe/Paris node --test "tests/**/*.test.ts"` |
| **Full suite command** | `npm run migrate -- --check && npm run validate && npm run check && npm test && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `node --test` on the touched area (< 5 s) + `npm run validate -- --root tests/fixtures/corpus-valide`
- **After every plan wave:** full `npm test` + `npm run check`
- **Before `/gsd:verify-work`:** full suite green locally AND GitHub Actions run green on pushed branch
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Filled by planner / executor. Requirement → test map:

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| FOND-01 | unit + CI | `node --test tests/repo/scaffold.test.ts` | ❌ W0 | ⬜ pending |
| FOND-02 | unit + build | `node --test tests/repo/astro-config.test.ts tests/dist/skeleton.test.ts` | ❌ W0 | ⬜ pending |
| FOND-03 | unit | `node --test tests/repo/ci.test.ts` | ❌ W0 | ⬜ pending |
| FOND-04 | unit | `node --test tests/repo/ci.test.ts` | ❌ W0 | ⬜ pending |
| FOND-05 | unit | `node --test tests/repo/docs.test.ts` | ❌ W0 | ⬜ pending |
| DATA-01 | unit | `node --test tests/schemas/meta.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | table-driven unit | `node --test tests/schemas/candidat.test.ts` | ❌ W0 | ⬜ pending |
| DATA-03 | unit | `node --test tests/schemas/mesure.test.ts` | ❌ W0 | ⬜ pending |
| DATA-04 | unit | `node --test tests/schemas/source.test.ts` | ❌ W0 | ⬜ pending |
| DATA-05 | unit | `node --test tests/schemas/couverture.test.ts` | ❌ W0 | ⬜ pending |
| DATA-06 | unit | `node --test tests/schemas/glossaire.test.ts` | ❌ W0 | ⬜ pending |
| DATA-01..06 corpus | integration | `node --test tests/content-core/corpus-valide.test.ts` | ❌ W0 | ⬜ pending |
| DATA-07 | unit + integration | `node --test tests/content-core/load.test.ts tests/content-core/astro-parity.test.ts` | ❌ W0 | ⬜ pending |
| DATA-08 | unit + CLI | `node --test tests/migrations/*.test.ts` | ❌ W0 | ⬜ pending |
| diagnostics | unit | `node --test tests/content-core/diagnostics.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `astro.config.mjs`, `package-lock.json` — framework install (Node 24.22.2 arm64 via fnm, repaired 2026-11-03)
- [ ] `tests/fixtures/corpus-valide/**` — fictional corpus, 8 collections + 1 archive
- [ ] `tests/helpers/validate-yaml.ts` — `expectOk` / `expectErrors` helper
- [ ] test files listed above

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Actions run green on push | FOND-03 | Needs remote runner | `gh run watch` after push |
| Dependabot active on repo | FOND-04 | Repo setting | `gh api repos/ErwanHenry/reveleTonProg/vulnerability-alerts` / Insights › Dependency graph |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
