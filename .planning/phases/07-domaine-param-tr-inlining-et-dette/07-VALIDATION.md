---
phase: 7
slug: domaine-param-tr-inlining-et-dette
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-07
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` (Node 24, native TypeScript) for unit, repo and dist tests; `@playwright/test` 1.64.1 + `@axe-core/playwright` 4.14 for e2e (Chromium only; project `parcours` uses `channel: 'chromium'` for bfcache) |
| **Config file** | `package.json` script `test`; `playwright.config.ts` (projects `avec-js`, `4g`, `sans-js`, `parcours` added by 07-05; `bypassCSP: true` globally, `false` in CSP specs) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/scripts/check-dist.test.ts tests/corpus/site-config.test.ts tests/corpus/vue.test.ts tests/corpus/sitemap.test.ts tests/corpus/types-schemas.test.ts tests/repo/astro-config.test.ts tests/repo/scripts-en-ligne.test.ts tests/repo/caddy.test.ts tests/repo/hote-en-dur.test.ts` (no build, < 15 s; only the files that exist at that point) |
| **Build run command** | `fnm exec --using=24 node --test tests/dist/site.test.ts` (only file that runs `astro build`; filter with `--test-name-pattern` as given in each plan while 07-01's transitional red cases exist) |
| **E2E command** | `fnm exec --using=24 node scripts/e2e.ts --jeu tous [-- <playwright args>]` (= `npm run e2e`), about 4 min per jeu, never concurrently with `npm test` |
| **Full suite command** | CI sequence (migrate, validate, ids, `npm run check`, `npm test`, build + check-dist on fixture, real production, real preview) + `node scripts/render-caddy.ts --check` + `npm run e2e` (07-08 Task 2) |
| **Estimated runtime** | ~36 s `npm test`, ~8 min e2e both jeux, ~12 min full gate |

---

## Sampling Rate

- **After every task commit:** quick run + the test file added or changed by the task; build run (filtered) for any task touching pages, layout, components, CSS, astro.config.mjs or `tests/dist/**`
- **Execution order (orchestrator, plan-check W1):** plans run one at a time on main, in the order 01, 02, 04, 03, 05, 06, 07, 08 (shared Astro cache and dist folders forbid concurrent builds).
- **After every plan:** `npm test` + `npm run check`; green expected only from the end of 07-03 (dist cases of the external form are red by design between 07-01 and 07-03, `e2e/texte.spec` until 07-05). No push before 07-08; after 07-05 and 07-08, `npm run e2e`.
- **Before `/gsd:verify-work`:** full suite green locally, then CI green on main (`gh run list --branch main`)
- **Max feedback latency:** 60 s (node), 8 min (e2e)

Known transitional state: between 07-01 (wave 1) and 07-03 (wave 2), the dist cases that assert the old external form are red by design (list in 07-01 objective); every `checkDist` case stays green. tests/dist is fully green again at the end of wave 2.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | PERF-01 | T-07-03 | hashes from source files, LF only, no unsafe-inline in config | repo | `node --test tests/repo/scripts-en-ligne.test.ts tests/repo/astro-config.test.ts && npm run check` | ❌ W0 (scripts-en-ligne created) / ✅ astro-config to extend | ⬜ pending |
| 7-01-02 | 01 | 1 | PERF-01 | T-07-01, T-07-02, T-07-05 | inline code identical to sources, hash in CSP, no permissive token | unit (fault injection) + CLI on real builds | `node --test tests/scripts/check-dist.test.ts` + check-dist on fresh real prod/preview builds | ✅ to extend | ⬜ pending |
| 7-02-01 | 02 | 1 | DETTE-05 | T-07-08 | types.ts and schemas cannot drift | repo | `node --test tests/corpus/types-schemas.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | DETTE-01 | T-07-06 | drafts never counted as published | unit + dist | `node --test tests/corpus/vue.test.ts && node --test --test-name-pattern="W3 :\|phrase de couverture" tests/dist/site.test.ts` | ✅ vue.test / ❌ W0 couverture-preview.cas | ⬜ pending |
| 7-02-03 | 02 | 1 | DETTE-03 | T-07-07 | rel noopener on every link, dated, archived extract | dist | `node --test --test-name-pattern="W10 :\|source primaire\|liens : original\|quatre rédactions\|checkDist" tests/dist/site.test.ts` | ✅ theme.cas to rewrite | ⬜ pending |
| 7-03-01 | 03 | 2 | PERF-01 | T-07-10 | CSS tests not vacuous | dist | `node --test --test-name-pattern="<CSS test names>" tests/dist/site.test.ts` (see plan) | ❌ W0 css-pages.ts | ⬜ pending |
| 7-03-02 | 03 | 2 | PERF-01 | T-07-11, T-07-12 | identity + hash on real builds, mutations bite | dist | `node --test tests/dist/site.test.ts` | ❌ W0 csp.cas.ts | ⬜ pending |
| 7-04-01 | 04 | 2 | HEB-05, HEB-06 | T-07-14, T-07-15 | strict host, deployment guard | unit + repo | `node --test tests/corpus/site-config.test.ts tests/repo/astro-config.test.ts` | ✅ to extend | ⬜ pending |
| 7-04-02 | 04 | 2 | HEB-05 | T-07-13 | canonical/sitemap only in production | unit | `node --test tests/corpus/sitemap.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-03 | 04 | 2 | HEB-05, HEB-06 | T-07-13, T-07-16 | deployment build fails on .invalid | dist | `node --test --test-name-pattern="HEB-05 :\|HEB-06 :\|checkDist" tests/dist/site.test.ts` | ❌ W0 domaine.cas.ts | ⬜ pending |
| 7-05-01 | 05 | 2 | PERF-01 | T-07-17 | zero CSP violation, with and without JS | e2e | `node scripts/e2e.ts --jeu tous -- e2e/csp.spec.ts e2e/csp-sans-js.spec.ts e2e/texte.spec.ts` | ❌ W0 | ⬜ pending |
| 7-05-02 | 05 | 2 | DETTE-02 | T-07-18, T-07-19 | real bfcache, mutation proof | e2e | `node scripts/e2e.ts --jeu tous -- --project=parcours e2e/parcours.spec.ts` + `e2e/retour.spec.ts` | ❌ W0 | ⬜ pending |
| 7-05-03 | 05 | 2 | PERF-01 | T-07-20 | budgets unchanged, figures recorded | e2e | `node scripts/e2e.ts --jeu tous && npm run check` | ✅ | ⬜ pending |
| 7-06-01 | 06 | 3 | HEB-05, HEB-06 | T-07-21, T-07-22, T-07-23 | canonical, sitemap, robots, DOMAINE_PROVISOIRE | unit + dist + CLI | `node --test tests/scripts/check-dist.test.ts && node --test --test-name-pattern="HEB-05 :\|HEB-06 :\|checkDist" tests/dist/site.test.ts` | ✅ to extend | ⬜ pending |
| 7-06-02 | 06 | 3 | HEB-05 | T-07-24 | no hard-coded site host | repo | `node --test tests/repo/hote-en-dur.test.ts` | ❌ W0 | ⬜ pending |
| 7-07-01 | 07 | 3 | HEB-05, PERF-01 | T-07-25, T-07-26, T-07-27, T-07-29 | header CSP without default-src, masked log | repo | `node --test tests/repo/caddy.test.ts` | ❌ W0 | ⬜ pending |
| 7-07-02 | 07 | 3 | HEB-05 | T-07-28 | drift of the generated block | repo + CLI | `node scripts/render-caddy.ts --check && node --test tests/repo/caddy.test.ts tests/repo/scaffold.test.ts tests/repo/ci.test.ts` | ❌ W0 | ⬜ pending |
| 7-08-01 | 08 | 4 | all | T-07-30, T-07-31 | docs state the meta limit and the public repo | repo | `node --test tests/repo/docs.test.ts` | ✅ to extend | ⬜ pending |
| 7-08-02 | 08 | 4 | all | T-07-32, T-07-33 | full gate, CI green | full | `npm test && npm run check && node scripts/render-caddy.ts --check && npm run e2e` + CI sequence + `gh run list` | ✅ | ⬜ pending |

All commands run with `fnm exec --using=24` and `TZ=Europe/Paris` for node tests.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement → Test Map

| Req ID | Behavior | Test files |
|--------|----------|------------|
| HEB-05 | `domaine` read, validated, propagated (site, canonical, sitemap, robots, Caddy); no hard-coded host | tests/corpus/site-config.test.ts, tests/corpus/sitemap.test.ts, tests/repo/astro-config.test.ts, tests/dist/cas/domaine.cas.ts, tests/scripts/check-dist.test.ts, tests/repo/caddy.test.ts, tests/repo/hote-en-dur.test.ts |
| HEB-06 | `.invalid` + `RTP_DEPLOIEMENT=1`: build and check-dist fail with a clear message | tests/corpus/site-config.test.ts, tests/dist/cas/domaine.cas.ts (failing build), tests/scripts/check-dist.test.ts (DOMAINE_PROVISOIRE, CLI) |
| PERF-01 | CSS and scripts inline, CSP with hashes, no unsafe-inline on scripts, identity and hash proven, site complete without JS, weight under budget | tests/repo/scripts-en-ligne.test.ts, tests/repo/astro-config.test.ts, tests/scripts/check-dist.test.ts, tests/dist/cas/csp.cas.ts (+ ordre, niveaux, integration, theme, enfant cases), e2e/csp.spec.ts, e2e/csp-sans-js.spec.ts, e2e/sans-js.spec.ts, e2e/4g.spec.ts, tests/repo/caddy.test.ts (header CSP) |
| DETTE-01 | Preview sentence never presents drafts as published | tests/corpus/vue.test.ts, tests/dist/cas/couverture-preview.cas.ts |
| DETTE-02 | Click path, level kept, back with bfcache | e2e/parcours.spec.ts (project parcours), e2e/retour.spec.ts |
| DETTE-03 | Sources consultées: link, date, archived extract | tests/dist/cas/theme.cas.ts (W10 case), e2e/axe.spec.ts and e2e/texte.spec.ts on the final build |
| DETTE-05 | Types aligned with schemas | tests/corpus/types-schemas.test.ts |

---

## Wave 0 Requirements

Each test file below is created by the task that needs it, test first (tdd="true"):

- [ ] `tests/repo/scripts-en-ligne.test.ts` (07-01 T1)
- [ ] `tests/corpus/types-schemas.test.ts` (07-02 T1)
- [ ] `tests/dist/cas/couverture-preview.cas.ts` (07-02 T2)
- [ ] `tests/dist/css-pages.ts` helper and `tests/dist/cas/csp.cas.ts` (07-03)
- [ ] `tests/corpus/sitemap.test.ts`, `tests/dist/cas/domaine.cas.ts` (07-04)
- [ ] `e2e/csp.spec.ts`, `e2e/csp-sans-js.spec.ts`, `e2e/parcours.spec.ts`, `e2e/retour.spec.ts`, project `parcours` and `bypassCSP: true` in playwright.config.ts (07-05)
- [ ] `tests/repo/hote-en-dur.test.ts` (07-06)
- [ ] `tests/repo/caddy.test.ts` (07-07)

No framework install: everything uses existing dependencies (no new npm package, no new npm script).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Caddy accepts the generated block (`caddy validate`) | HEB-05 | No Caddy and Docker is off in this phase; the server is Phase 8 | Phase 8: `caddy validate --config <Caddyfile importing deploy/caddy/site.caddy>` on the VPS, check A2 and A5 |
| Header CSP and meta together on the served site | PERF-01 | Needs the real server (Phase 8) | Phase 8 e2e behind Caddy: zero violation with the header applied |

*All phase-7 behaviors themselves have automated verification; the two rows above are Phase 8 follow-ups.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60 s for node tests
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd /Users/erwanhenry/claude-projects/reveleTonProg && for f in .planning/phases/07-domaine-param-tr-inlining-et-dette/07-0*-PLAN.md; do echo "== $f"; gsd-sdk query frontmatter.validate "$f" --schema plan 2>&1 | head -5; gsd-sdk query verify.plan-structure "$f" 2>&1 | head -8; done