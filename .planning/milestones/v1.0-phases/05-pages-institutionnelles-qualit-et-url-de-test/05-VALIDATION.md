---
phase: 5
slug: pages-institutionnelles-qualit-et-url-de-test
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` (Node 24, TS natif) ; navigateur : `@playwright/test` ^1.64.1 + `@axe-core/playwright` ^4.14.0 (installés par 05-01, Chromium seul) |
| **Config file** | `playwright.config.ts` (05-01) ; aucune pour node:test |
| **Quick run command** | `fnm exec --using=24 node --test tests/repo/*.test.ts tests/scripts/*.test.ts tests/ui/*.test.ts tests/corpus/*.test.ts` (sans build, < 15 s) |
| **Build run command** | `fnm exec --using=24 node --test tests/dist/site.test.ts` (seul fichier qui lance `astro build`, 20-60 s) |
| **E2E command** | `fnm exec --using=24 node scripts/e2e.ts --jeu tous` (alias `npm run e2e` à partir de 05-06), ≈ 3 min, jamais en même temps que `npm test` |
| **Full suite command** | `npm run migrate -- --check && npm run validate -- --mode production && npm run ids -- --check && npm run check && npm test && npm run build && npm run check-dist && npm run e2e` |
| **Estimated runtime** | ≈ 6 min (full), < 15 s (quick) |

---

## Sampling Rate

- **After every task commit:** quick run ; build run for any task touching pages, layout, CSS or `tests/dist/cas/*`
- **After every plan wave:** quick + build run + `npm run check` ; `node scripts/e2e.ts --jeu tous` after waves 1, 2 and 3 (CSS / pages / CI)
- **Before `/gsd:verify-work`:** full suite green (05-08 Task 1) and the audit journal archived (05-07)
- **Max feedback latency:** 60 s (node), 3 min (e2e)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | QUAL-02 | T-05-SC | provenance checked, no install script, signatures valid | repo | `node --test tests/repo/scaffold.test.ts && npm audit signatures` | ✅ (to extend) | ⬜ pending |
| 5-01-02 | 01 | 1 | QUAL-02 | T-05-01, T-05-02 | traversal 404, 127.0.0.1 only | unit | `node --test tests/scripts/e2e-serveur.test.ts && npm run check` | ❌ W0 (created by task) | ⬜ pending |
| 5-01-03 | 01 | 1 | QUAL-02 | T-05-04 | no browser in npm test | e2e | `node scripts/e2e.ts --jeu tous -- e2e/sans-js.spec.ts e2e/clavier.spec.ts e2e/axe.spec.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | INST-02, INST-03, INST-04 | T-05-08 | brand / donation denylist | build | `node --test tests/dist/site.test.ts` (RED expected) | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | INST-02 | T-05-05, T-05-06, T-05-07 | strict YAML, RTP_DEPLOIEMENT guard | unit | `node --test tests/corpus/hebergeur-config.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 1 | INST-03, INST-04 | T-05-09, T-05-10 | storage keys pinned to scripts | unit + build | `node --test tests/ui/constantes-publiques.test.ts tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | QUAL-06 | T-05-11, T-05-12 | read-only, path guard, fixed journal keys | unit | `node --test tests/scripts/audit-lire.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | QUAL-06 | T-05-13, T-05-14 | no answer leak in briefs | doc grep | `perl` dash check + « Bloquant » count (see plan) | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | INST-01 | T-05-16 | page = imports | build | `node --test tests/dist/site.test.ts` (RED expected) | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 2 | INST-01 | T-05-15 | snapshot hash checked | unit | `node --test tests/corpus/dataset-datagouv.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-03 | 04 | 2 | INST-01, INST-04 | T-05-17 | forbidden words only in data-liste-mots-interdits | build | `node --test tests/dist/site.test.ts && npm run check` + preview check-dist | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 2 | QUAL-04 | T-05-21 | CSS fix without regression | e2e + unit | `node --test tests/ui/styles.test.ts && node scripts/e2e.ts --jeu tous -- e2e/texte.spec.ts e2e/mouvement.spec.ts e2e/sans-js.spec.ts e2e/clavier.spec.ts e2e/axe.spec.ts` | ❌ W0 | ⬜ pending |
| 5-05-02 | 05 | 2 | QUAL-04, INST-02 | T-05-19 | no extra storage key, no cookie, no third-party request | e2e | `node scripts/e2e.ts --jeu tous -- e2e/contraste.spec.ts e2e/vie-privee.spec.ts` | ❌ W0 | ⬜ pending |
| 5-05-03 | 05 | 2 | QUAL-03 | T-05-20 | gzip asserted, cold loads | e2e | `node scripts/e2e.ts --jeu tous && npm run check` | ❌ W0 | ⬜ pending |
| 5-06-01 | 06 | 3 | QUAL-05 | T-05-22, T-05-23, T-05-24, T-05-25 | SHA pins, contents: read, no secrets in e2e job | repo | `node --test tests/repo/ci.test.ts tests/repo/scaffold.test.ts && npm run e2e` | ✅ (to extend) | ⬜ pending |
| 5-06-02 | 06 | 3 | QUAL-05, INST-02 | T-05-26 | right-of-reply procedure documented | repo + full gate | `node --test tests/repo/docs.test.ts && npm run check && npm test && npm run build && npm run check-dist` | ✅ (to extend) | ⬜ pending |
| 5-07-01 | 07 | 4 | QUAL-06 | T-05-28 | fingerprinted builds, traps replayed | unit + doc | `node --test tests/pieges/pieges.test.ts && test -s audit/journal.jsonl` | ✅ | ⬜ pending |
| 5-07-02 | 07 | 4 | QUAL-06 | T-05-27, T-05-29, T-05-30 | journal keys fixed, no content edit | journal check | node one-liner on audit/journal.jsonl + git log on src/content (see plan) | ❌ (created by task) | ⬜ pending |
| 5-07-03 | 07 | 4 | QUAL-06 | T-05-29 | audit pinned | repo | `node --test tests/repo/docs.test.ts && npm test` | ✅ (to extend) | ⬜ pending |
| 5-08-01 | 08 | 5 | QUAL-05 | T-05-31, T-05-32 | noindex served, 127.0.0.1 | smoke | `curl` on /methode/, /mentions-legales/, /qui-sommes-nous/ + noindex grep | n/a | ⬜ pending |
| 5-08-02 | 08 | 5 | QUAL-05 | T-05-33 | performer recorded | checkpoint | `curl -sf http://127.0.0.1:4173/` (server up) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

All commands run under `fnm exec --using=24`.

---

## Wave 0 Requirements

Phase 5 has no separate Wave 0 plan: each test file is created RED by the first task of the plan that needs it (MVP order), or by the same TDD task.

- [ ] `@playwright/test`, `@axe-core/playwright`, Chromium: 05-01 Task 1
- [ ] `playwright.config.ts`, `e2e/serveur.ts`, `e2e/pages.ts`, `scripts/e2e.ts`, `tests/scripts/e2e-serveur.test.ts`: 05-01 Task 2
- [ ] `tsconfig.json` includes `e2e/**/*` and `playwright.config.ts`: 05-01 Task 1
- [ ] `.gitignore`: `/dist-e2e/`, `/playwright-report/`, `/test-results/`, `/blob-report/`: 05-01 Task 1
- [ ] `tests/dist/cas/institutionnel.cas.ts`: 05-02 Task 1 ; `tests/dist/cas/methode.cas.ts`: 05-04 Task 1
- [ ] `tests/corpus/hebergeur-config.test.ts`, `tests/ui/constantes-publiques.test.ts`: 05-02 ; `tests/corpus/dataset-datagouv.test.ts`: 05-04
- [ ] `tests/scripts/audit-lire.test.ts`: 05-03 Task 1
- [ ] `tests/repo/scaffold.test.ts` devDependencies (05-01) and scripts contract (05-06); `tests/repo/ci.test.ts` (05-06); `tests/repo/docs.test.ts` (05-06, 05-07)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Erwan walks the pilot corpus end to end on the test URL | QUAL-05 (ROADMAP criterion 4) | acceptance by the product owner; may be performed by the orchestrator on his behalf | 05-08 Task 2 how-to-verify (7 steps) |
| Persona reading by simulated agents | QUAL-06 | LLM agents, not strictly reproducible; deterministic half (traps) is automated | 05-07 Task 2, raw journal `audit/journal.jsonl` |
| VoiceOver, NVDA, JAWS reading of inline popovers | QUAL-02 (beyond automation) | screen readers not automatable here | listed as a known limit on /methode/ and in the audit; out of scope for v1.0 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
