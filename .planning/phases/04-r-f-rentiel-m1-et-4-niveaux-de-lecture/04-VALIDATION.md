---
phase: 4
slug: r-f-rentiel-m1-et-4-niveaux-de-lecture
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` on Node 24 (TypeScript type stripping), already used by Phases 1-3; `node:vm` for the two browser scripts; no Playwright in this phase (Phase 5) |
| **Config file** | none; `package.json` script `TZ=Europe/Paris node --test "tests/**/*.test.ts"` |
| **Quick run command** | `fnm exec --using=24 node --test tests/corpus/corpus-m1.test.ts tests/corpus/vue.test.ts tests/corpus/vue-candidat.test.ts tests/corpus/site-config.test.ts tests/corpus/signalement.test.ts tests/corpus/enfant.test.ts tests/scripts/html.test.ts tests/scripts/check-dist.test.ts tests/browser-js/niveau.test.ts tests/browser-js/ordre.test.ts tests/ui/styles.test.ts` (Phase 4 files only, each run on the files that exist at that point; no Astro build, < 10 s). Phase 3 also adds tests under `tests/corpus/`: never glob that directory in a Phase 4 command |
| **Build run command** | `fnm exec --using=24 node --test tests/dist/site.test.ts` (the ONLY file that runs `astro build`; slices plug in via `tests/dist/cas/*.cas.ts`) |
| **Full suite command** | `fnm exec --using=24 npm test && fnm exec --using=24 npm run check && fnm exec --using=24 npm run build && fnm exec --using=24 npm run check-dist` (plan 04-09 only) |
| **Estimated runtime** | quick ~10 s; build run ~20-40 s (4-6 sequential builds); full ~90 s |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (quick tests, plus the build run when the task touches pages or CSS)
- **After every plan wave:** quick run + build run + `npm run check`
- **Before `/gsd:verify-work`:** full suite green (04-09 Task 2), including the real corpus (`RTP_CONTENT_ROOT=.`) in production and preview
- **Max feedback latency:** 60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | M1-01, M1-07, M1-11 | T-04-02, T-04-03 | overlay never edits corpus-valide; cleanup only removes own temp roots | unit (RED) | `! node --test tests/corpus/corpus-m1.test.ts` (non-zero exit expected) | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | M1-01, M1-07, M1-11 | T-04-01 | fictional `.invalid` hosts only | unit + CLI | `node --test tests/corpus/corpus-m1.test.ts` + `validate --root <m1> --mode production/preview` + `ids --check --root <m1>` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | QUAL-01 | — | no HTML parser dependency | unit | `node --test tests/scripts/html.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | QUAL-01 | T-04-04…08 | third parties, inline code, drafts, indexable preview all rejected | unit (fault injection, ≥ 22 cases) | `node --test tests/scripts/check-dist.test.ts tests/rules/equite.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | QUAL-01 | T-04-09 | skeleton cases kept, checkDist replaces the no-JS loop | build | `node --test tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | M1-01, M1-08, M1-11, M1-12 | — | — | unit + CSS + build (RED) | `! node --test tests/corpus/vue.test.ts tests/ui/styles.test.ts` (non-zero exit expected) | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | M1-01, M1-11, M1-12 | T-04-11, T-04-12 | production filter, fail-closed on missing case, single RTP_MODE reader | unit | `node --test tests/corpus/vue.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | M1-01, M1-08, M1-12 | T-04-10, T-04-13, T-04-14 | no set:html, external hashed CSS, rel noopener | build + CSS | `node --test tests/repo/astro-config.test.ts tests/ui/styles.test.ts tests/corpus/vue.test.ts tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | M1-04 | T-04-15, T-04-16 | encodeURIComponent, strict config reader, no personal address | unit | `node --test tests/corpus/site-config.test.ts tests/corpus/signalement.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 3 | M1-04 | T-04-17, T-04-20 | archives never in dist | build | `node --test tests/dist/site.test.ts tests/ui/styles.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-04-03 | 04 | 3 | M1-11 | T-04-18, T-04-19 | preview noindex + robots Disallow; zero badge strings in production | build (2 modes) | `node --test tests/dist/site.test.ts tests/ui/styles.test.ts tests/corpus/vue.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | M1-06 | T-04-21, T-04-22 | hostile stored value ignored, only `rtp:niveau` | unit (node:vm) | `node --test tests/browser-js/niveau.test.ts` + size ≤ 2048 | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 3 | M1-05, M1-09 | T-04-23, T-04-24 | sync same-origin script, content readable without :has() | build + CSS | `node --test tests/ui/styles.test.ts tests/browser-js/niveau.test.ts tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 4 | M1-02, M1-03, M1-12 | — | — | unit + build (RED) | `! node --test tests/corpus/vue-candidat.test.ts` (non-zero exit expected) | ❌ W0 | ⬜ pending |
| 04-06-02 | 06 | 4 | M1-02 | T-04-25 | unreviewed statut never shown as fact in production | unit | `node --test tests/corpus/vue-candidat.test.ts tests/corpus/vue.test.ts` | ❌ W0 | ⬜ pending |
| 04-06-03 | 06 | 4 | M1-02, M1-03, M1-12 | T-04-26, T-04-27, T-04-28 | links and fragments resolve; neutral order and colour | build (2 modes) | `node --test tests/dist/site.test.ts tests/ui/styles.test.ts tests/corpus/vue.test.ts tests/corpus/vue-candidat.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-07-01 | 07 | 4 | M1-10 | T-04-29 | shared marker syntax, unknown id throws | unit | `node --test tests/corpus/enfant.test.ts tests/rules/references.test.ts tests/pieges/*.test.ts` | ❌ W0 | ⬜ pending |
| 04-07-02 | 07 | 4 | M1-10 | T-04-30, T-04-31, T-04-32 | no set:html; party definitions sourced; fallback list | build + CSS | `node --test tests/ui/styles.test.ts tests/corpus/enfant.test.ts tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-08-01 | 08 | 5 | M1-07 | T-04-33, T-04-34, T-04-35 | unbiased shuffle (chi² < 20.52), only `rtp:ordre` | unit (node:vm) | `node --test tests/browser-js/ordre.test.ts` + size ≤ 2048 | ❌ W0 | ⬜ pending |
| 04-08-02 | 08 | 5 | M1-07 | T-04-36 | lists revealed after 1.5 s even if the script fails | build + CSS | `node --test tests/browser-js/ordre.test.ts tests/ui/styles.test.ts tests/dist/site.test.ts && npm run check` | ❌ W0 | ⬜ pending |
| 04-09-01 | 09 | 6 | QUAL-01, M1-02, M1-09 | T-04-37, T-04-38, T-04-39 | check-dist in CI, no `uses:` change, no RTP_MODE in CI | repo + build | `node --test tests/repo/ci.test.ts tests/repo/scaffold.test.ts tests/dist/site.test.ts && npm run build && npm run check-dist` | ❌ W0 | ⬜ pending |
| 04-09-02 | 09 | 6 | all | T-04-40 | full gate on corpus-valide, corpus-m1 and the real corpus | full | `node --test tests/repo/docs.test.ts && npm run check && npm test && npm run build && npm run check-dist && RTP_CONTENT_ROOT=. npm run build && RTP_CONTENT_ROOT=. npm run check-dist` | ❌ W0 | ⬜ pending |
| 04-09-03 | 09 | 6 | M1-05, M1-06, M1-07, M1-09, M1-10 | — | human check in a real browser | manual (checkpoint) | `curl -sf http://localhost:4321/themes/logement/` (server up) then the checklist | n/a | ⬜ pending |

*All commands are prefixed with `fnm exec --using=24`. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/corpus-m1/` (13 fictional files) + `tests/helpers/corpus-m1.ts` + `tests/corpus/corpus-m1.test.ts`: the M1 cases (plan 04-01)
- [ ] `tests/dist/site.test.ts` + `tests/dist/contexte.ts` + `tests/dist/cas/squelette.cas.ts` replacing `tests/dist/skeleton.test.ts`: single build owner (plan 04-02)
- [ ] `scripts/lib/html.ts`, `scripts/lib/check-dist.ts`, `scripts/check-dist.ts` + `tests/scripts/{html,check-dist}.test.ts`: QUAL-01 checker with fault injection (plan 04-02)
- [ ] Framework install: none (no new dependency)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No painted frame at the wrong level when restoring `rtp:niveau` | M1-06 | No browser in the Phase 4 test stack (Playwright is Phase 5); script position and vm tests cover the logic | 04-09 Task 3 step 2 |
| Popover reading by VoiceOver/NVDA/JAWS | M1-10 | Assistive technologies are not automatable here (RESEARCH A6) | 04-09 Task 3 step 7; otherwise Phase 5 manual checklist |
| Popover and `:has()` behaviour in Safari | M1-05, M1-10 | Only Chrome was available to the research prototype | 04-09 Task 3 step 4 |
| Gros caractères at 160 % zoom and 320 px reflow | M1-09 | Layout rendering needs a browser (automated in Phase 5) | 04-09 Task 3 step 5 |
| Enfant level switch < 50 ms layout with many terms | M1-10 | Needs DevTools performance metrics | Optional, DevTools Performance panel on /themes/logement/ |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
