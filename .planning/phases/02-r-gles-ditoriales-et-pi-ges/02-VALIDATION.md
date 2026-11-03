---
phase: 2
slug: r-gles-ditoriales-et-pi-ges
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node 24, native TS) |
| **Config file** | none (`npm test` = `TZ=Europe/Paris node --test "tests/**/*.test.ts"`) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test <touched test files>` |
| **Full suite command** | `fnm exec --using=24 npm run migrate -- --check && fnm exec --using=24 npm run validate -- --mode production && fnm exec --using=24 npm run check && fnm exec --using=24 npm test && fnm exec --using=24 npm run build` |
| **Estimated runtime** | quick < 15 s; full suite ~60 s (baseline 335 tests ≈ 40 s, + trap runner temp copies) |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (quick run on the touched test files)
- **After every plan wave:** wave 1 and wave 2 plans run their own files plus the regression files listed in their `<verify>`; the full suite runs once, in plan 02-06 (wave 3, in parallel with the docs-only plan 02-07, which runs tests/repo/docs.test.ts only), per orchestrator decision
- **Before `/gsd:verify-work`:** full suite green (02-06 Task 3)
- **Max feedback latency:** 15 seconds per task (the full suite only at phase gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | REGLE-01, REGLE-07 | T-02-04 | archives byte-exact (`-text`), wayback only for `wayback_url` | unit | `fnm exec --using=24 node --test tests/content-core/corpus-valide.test.ts tests/content-core/load.test.ts` | ✅ (extended) | ⬜ pending |
| 2-01-02 | 01 | 1 | REGLE-07 | T-02-01, T-02-02, T-02-05 | lock read/write refuses symlink/out-of-root, append-only, atomic | unit + CLI | `fnm exec --using=24 node --test tests/content-core/ids-cli.test.ts tests/repo/scaffold.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-02-01 | 02 | 1 | REGLE-10 | T-02-09 | exact-once patch guard, exact-set compare (no vacuous trap) | trap (RED expected) | `fnm exec --using=24 node --test tests/pieges/pieges.test.ts` (must fail on SOURCE_ABSENTE only) | ❌ W0 (created by task) | ⬜ pending |
| 2-02-02 | 02 | 1 | REGLE-01, REGLE-11 | T-02-10 | press never backs a measure (type-based) | unit + trap | `fnm exec --using=24 node --test tests/pieges/pieges.test.ts tests/schemas/mesure.test.ts tests/schemas/source.test.ts` | ✅ | ⬜ pending |
| 2-02-03 | 02 | 1 | REGLE-10, REGLE-11 | T-02-06, T-02-07, T-02-08 | crashing rule → REGLE_ECHEC (fail-closed); default mode production; messages via citer() | unit | `fnm exec --using=24 node --test tests/rules/moteur.test.ts tests/pieges/pieges.test.ts tests/content-core/load.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-03-01 | 03 | 2 | REGLE-02 | T-02-11, T-02-12, T-02-14 | quote exemption only when balanced; invisible/homoglyph/bidi bypass blocked | unit + trap | `fnm exec --using=24 node --test tests/text/words.test.ts tests/text/forbidden.test.ts tests/rules/redaction.test.ts tests/pieges/pieges.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-03-02 | 03 | 2 | REGLE-03 | T-02-13 | linear tokenizer | unit | `fnm exec --using=24 node --test tests/text/words.test.ts tests/rules/redaction.test.ts` | ✅ (from 2-03-01) | ⬜ pending |
| 2-03-03 | 03 | 2 | REGLE-06 | — | N/A (warning-only score, status-dependent sentence rule) | unit | `fnm exec --using=24 node --test tests/text/sentences.test.ts tests/text/syllables.test.ts tests/rules/redaction.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-04-01 | 04 | 2 | REGLE-01 | T-02-15, T-02-16, T-02-17, T-02-18 | containment + 5 MB cap before read; sha256 on raw bytes; no hostname heuristics | unit | `fnm exec --using=24 node --test tests/rules/archives.test.ts tests/pieges/pieges.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-04-02 | 04 | 2 | REGLE-07, REGLE-12 | T-02-15, T-02-20 | AST key scan (no grep); lock read through readContained (contained.ts, no import cycle) | unit | `fnm exec --using=24 node --test tests/rules/references.test.ts tests/rules/champs.test.ts tests/content-core/load.test.ts tests/content-core/validate-cli.test.ts tests/migrations/migrate.test.ts tests/migrations/cli.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-04-03 | 04 | 2 | REGLE-08 | T-02-19 | only equite.ts reads ctx.mode | unit + trap | `fnm exec --using=24 node --test tests/rules/equite.test.ts tests/pieges/pieges.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-05-01 | 05 | 2 | REGLE-09 | T-02-24, T-02-25 | sums in hundredths; notice from schema `required` | unit + trap | `fnm exec --using=24 node --test tests/rules/sondages.test.ts tests/schemas/sondage.test.ts tests/pieges/pieges.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-05-02 | 05 | 2 | REGLE-09 | T-02-23 | windows identical under 5 time zones | unit (spawn per TZ) | `fnm exec --using=24 node --test tests/rules/sondages.test.ts` | ✅ (from 2-05-01) | ⬜ pending |
| 2-05-03 | 05 | 2 | REGLE-11 | T-02-21, T-02-22 | invalid mode exits 2 / fails build; annotations only via formatGithub | CLI integration | `fnm exec --using=24 node --test tests/content-core/validate-cli.test.ts tests/content-core/astro-parity.test.ts` | ✅ (extended) | ⬜ pending |
| 2-06-01 | 06 | 3 | REGLE-04, REGLE-05 | T-02-26, T-02-27, T-02-28, T-02-29 | figures and quotes traced to the archive; chiffrage verified | unit + trap | `fnm exec --using=24 node --test tests/text/numbers.test.ts tests/text/verbatim.test.ts tests/rules/citations.test.ts tests/pieges/pieges.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-06-02 | 06 | 3 | REGLE-10, REGLE-11, REGLE-08 | T-02-31 | missing/passing §12 trap or untested code fails npm test | meta + CLI | `fnm exec --using=24 node --test tests/pieges/couverture.test.ts tests/content-core/validate-cli.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 2-06-03 | 06 | 3 | REGLE-07 + all REGLE-01…12 (gate) | T-02-30, T-02-32 | CI pins `--mode production`; ids.lock removal vs base commit refused; event values via env | CLI + full gate | `fnm exec --using=24 node --test tests/content-core/ids-cli.test.ts tests/repo/ci.test.ts`, then the full suite command above | ✅ (extended) | ⬜ pending |
| 2-07-01 | 07 | 3 | REGLE-10, REGLE-11 | T-02-33, T-02-34 | no secret in docs; false-positive procedure requires review | docs test | `fnm exec --using=24 node --test tests/repo/docs.test.ts` | ✅ (extended) | ⬜ pending |
| 2-07-02 | 07 | 3 | REGLE-10, REGLE-11 | — | N/A (documentation) | docs test | `fnm exec --using=24 node --test tests/repo/docs.test.ts` | ✅ (extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan: in MVP mode every test file is created by the first task that needs it, test-first (each task has `tdd="true"` and a `<behavior>` block). Files created along the way:

- [ ] `tests/helpers/overlay.ts`, `tests/pieges/pieges.test.ts`, `tests/fixtures/pieges/SOURCE_ABSENTE/` — plan 02-02 Task 1 (RED commit)
- [ ] `tests/rules/moteur.test.ts` — 02-02 Task 3
- [ ] `tests/content-core/ids-cli.test.ts` — 02-01 Task 2
- [ ] `tests/text/{words,forbidden,sentences,syllables}.test.ts`, `tests/rules/redaction.test.ts` — 02-03
- [ ] `tests/rules/{archives,references,champs,equite}.test.ts` — 02-04
- [ ] `tests/rules/sondages.test.ts` — 02-05
- [ ] `tests/text/{numbers,verbatim}.test.ts`, `tests/rules/citations.test.ts`, `tests/pieges/couverture.test.ts` — 02-06
- [x] Framework install: none (node:test already in use)

---

## Manual-Only Verifications

All phase behaviors have automated verification. The GitHub-side rendering of annotations (how GitHub displays `::error` lines on a PR) is not re-verified manually: the format is pinned by CLI tests and was proven on a failing CI probe in Phase 1.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each created test-first by its task)
- [x] No watch-mode flags
- [x] Feedback latency < 15 s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-03 (planner)
