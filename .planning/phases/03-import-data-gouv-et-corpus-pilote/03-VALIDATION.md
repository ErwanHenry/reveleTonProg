---
phase: 3
slug: import-data-gouv-et-corpus-pilote
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node 24, native TS) |
| **Config file** | none (`npm test` = `TZ=Europe/Paris node --test "tests/**/*.test.ts"`) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test <touched test files>` (tooling plans) or `fnm exec --using=24 npm run validate -- --root . --mode preview && ... --mode production && fnm exec --using=24 node --test tests/corpus/*.test.ts` (content plans) |
| **Full suite command** | `fnm exec --using=24 npm run migrate -- --check && fnm exec --using=24 npm run validate -- --root . --mode production && fnm exec --using=24 npm run ids -- --root . --check && fnm exec --using=24 npm run check && fnm exec --using=24 npm test && fnm exec --using=24 npm run build` (after 03-09 the `--root .` options become the default) |
| **Estimated runtime** | quick < 20 s (no network in any test); full suite ~60-90 s |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command. Tooling tasks run their own test files; content batches run the validator on the real corpus in both modes plus `tests/corpus/*.test.ts`.
- **After every plan wave:** wave 1 plans run their own files plus listed regressions; content plans 03-06, 03-07, 03-08 run the full `npm test` in their last task; the full suite runs at the phase gate (03-09 Task 3).
- **Before `/gsd:verify-work`:** full suite green (03-09 Task 3), plus `RTP_MODE=preview npm run build`.
- **Max feedback latency:** 20 seconds per tooling task; content batches are bounded by live fetching, not by tests.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CONT-01, CONT-02 | T-03-01 | byte-exact snapshot (`-text`), sha256 + meta | e2e (RED) | `! fnm exec --using=24 node --test tests/import/import-cli.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 3-01-02 | 01 | 1 | CONT-01, CONT-02 | T-03-02, T-03-05, T-03-06 | forbidden fields never mapped; body cap; no write into fixture | unit + e2e + real corpus | `fnm exec --using=24 node --test tests/import/datagouv.test.ts tests/import/import-cli.test.ts tests/corpus/fiches.test.ts tests/repo/scaffold.test.ts && fnm exec --using=24 npm run validate -- --root . --mode production && fnm exec --using=24 npm run ids -- --root . --check` | ❌ W0 (created by task) | ⬜ pending |
| 3-01-03 | 01 | 1 | CONT-01, CONT-02 | T-03-03, T-03-04 | append-only statuts; unknown id / date regression exit 1 | unit + CLI | `fnm exec --using=24 node --test tests/import/*.test.ts tests/corpus/fiches.test.ts tests/repo/docs.test.ts` | ✅ (from 3-01-01/02) | ⬜ pending |
| 3-02-01 | 02 | 1 | CONT-03 | T-03-12 | tampered extract must fail validation | e2e (RED) | `! fnm exec --using=24 node --test tests/archive/archive-e2e.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 3-02-02 | 02 | 1 | CONT-03 | T-03-08, T-03-09, T-03-10, T-03-14 | https + public IP only, caps, execFile no shell, contained writes | unit + e2e (mocked network, local bare remote) | `fnm exec --using=24 node --test tests/archive/*.test.ts && fnm exec --using=24 npm run check` | ❌ W0 (created by task) | ⬜ pending |
| 3-02-03 | 02 | 1 | CONT-03 | T-03-13, T-03-16 | private repo visibility asserted PRIVATE | repo check + docs test | `test "$(gh repo view ErwanHenry/reveleTonProg-archives --json visibility -q .visibility)" = PRIVATE && fnm exec --using=24 node --test tests/repo/docs.test.ts` | ✅ (extended) | ⬜ pending |
| 3-03-01 | 03 | 1 | CONT-04 | T-03-18 | choice recomputed from cells | unit | `fnm exec --using=24 node --test tests/couverture/classement.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 3-03-02 | 03 | 1 | CONT-04 | T-03-17, T-03-19 | scanner read-only, bounded snippets | unit + CLI | `fnm exec --using=24 node --test tests/couverture/scan.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 3-03-03 | 03 | 1 | CONT-05, CONT-06 | T-03-20, T-03-21 | cap 2, host floor, completeness, marking | unit (fixture overlays) | `fnm exec --using=24 node --test tests/couverture/*.test.ts && fnm exec --using=24 npm run check` | ❌ W0 (created by task) | ⬜ pending |
| 3-04-01 | 04 | 2 | CONT-04, CONT-03 | T-03-22, T-03-23, T-03-26 | live fetch, no aggregator/press host, personal-data grep | data check + validator | `fnm exec --using=24 node scripts/couverture-scan.ts --check-data --root . && fnm exec --using=24 npm run validate -- --root . --mode production` | ✅ (tools from W1) | ⬜ pending |
| 3-04-02 | 04 | 2 | CONT-04, CONT-03 | T-03-22, T-03-23 | idem | data check + validator | same as 3-04-01 | ✅ | ⬜ pending |
| 3-04-03 | 04 | 2 | CONT-04 | T-03-24, T-03-27 | ranking recomputed; Wayback warning-only | real-data test | `fnm exec --using=24 node --test tests/corpus/couverture-themes.test.ts tests/couverture/*.test.ts && fnm exec --using=24 npm run validate -- --root . --mode production` | ❌ W0 (created by task) | ⬜ pending |
| 3-05-01 | 05 | 3 | CONT-04 | T-03-30, T-03-31 | human browser capture only (checkpoint, conditional) | checkpoint | `test "$(grep -c 'acces: bloque' data/couverture-themes.yaml)" = "0" \|\| ls -d …/_depot-manuel/*/` | — | ⬜ pending |
| 3-05-02 | 05 | 3 | CONT-04, CONT-05, CONT-06 | T-03-28 | manual files through the same extraction pipeline | real-corpus tests | `fnm exec --using=24 node --test tests/corpus/pilote.test.ts tests/corpus/glossaire.test.ts tests/corpus/couverture-themes.test.ts && fnm exec --using=24 npm run validate -- --root . --mode production` | ❌ W0 (created by task) | ⬜ pending |
| 3-05-03 | 05 | 3 | CONT-04 | T-03-29 | override needs recorded derogation (checkpoint, conditional) | checkpoint + real-data test | `fnm exec --using=24 node --test tests/corpus/couverture-themes.test.ts tests/corpus/pilote.test.ts` | ✅ (from 3-05-02) | ⬜ pending |
| 3-06-01 | 06 | 4 | CONT-05, CONT-06 | T-03-32, T-03-33, T-03-35, T-03-36 | verbatim quotes, figures and quotes traced, neutral wording | validator + real-corpus tests | `fnm exec --using=24 npm run validate -- --root . --mode preview && fnm exec --using=24 npm run validate -- --root . --mode production && fnm exec --using=24 node --test tests/corpus/*.test.ts` | ✅ | ⬜ pending |
| 3-06-02 | 06 | 4 | CONT-05, CONT-06 | T-03-32 … T-03-37 | idem | idem | same as 3-06-01 | ✅ | ⬜ pending |
| 3-06-03 | 06 | 4 | CONT-05, CONT-06 | T-03-34, T-03-38 | completeness enforced once delivered | full suite | same as 3-06-01 `&& fnm exec --using=24 npm test` | ✅ | ⬜ pending |
| 3-07-01 | 07 | 5 | CONT-05, CONT-06 | T-03-32 … T-03-37 | idem 3-06-01 (number-heavy theme: CHIFFRE_HORS_SOURCE) | validator + real-corpus tests | same as 3-06-01 | ✅ | ⬜ pending |
| 3-07-02 | 07 | 5 | CONT-05, CONT-06 | T-03-32 … T-03-37 | idem | idem | same as 3-06-01 | ✅ | ⬜ pending |
| 3-07-03 | 07 | 5 | CONT-05, CONT-06 | T-03-34, T-03-38 | completeness enforced once delivered | full suite | same as 3-06-03 | ✅ | ⬜ pending |
| 3-08-01 | 08 | 6 | CONT-05, CONT-06 | T-03-32 … T-03-37 | idem (Aîné theme: « ce qui me concerne » only from source) | validator + real-corpus tests | same as 3-06-01 | ✅ | ⬜ pending |
| 3-08-02 | 08 | 6 | CONT-05, CONT-06 | T-03-32 … T-03-37 | idem | idem | same as 3-06-01 | ✅ | ⬜ pending |
| 3-08-03 | 08 | 6 | CONT-05, CONT-06 | T-03-34, T-03-38 | completeness enforced once delivered | full suite | same as 3-06-03 | ✅ | ⬜ pending |
| 3-09-01 | 09 | 7 | CONT-05 (root) | T-03-40 | fixture explicit, no assertion weakened | unit + CLI | `fnm exec --using=24 node --test tests/repo/default-root.test.ts tests/content-core/*.test.ts tests/migrations/*.test.ts && fnm exec --using=24 npm run validate -- --mode production` | ❌ W0 (created by task) | ⬜ pending |
| 3-09-02 | 09 | 7 | CONT-05 | T-03-39, T-03-41 | no action pin or permission change; honest label | repo + dist tests | `fnm exec --using=24 node --test tests/repo/ci.test.ts tests/dist/skeleton.test.ts && fnm exec --using=24 npm run build` | ✅ (extended) | ⬜ pending |
| 3-09-03 | 09 | 7 | CONT-01, CONT-03, CONT-05, CONT-06 | T-03-42, T-03-43 | phase gate `livres == themes`; no secret in docs | full gate | full suite command above | ✅ (extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan: in MVP mode every test file is created by the first task that needs it, test-first.

- [ ] `tests/import/import-cli.test.ts`, `tests/corpus/fiches.test.ts` — 03-01 Task 1 (RED commit); `tests/import/datagouv.test.ts` — 03-01 Task 2
- [ ] `tests/archive/archive-e2e.test.ts` + `tests/fixtures/archive/*.html` — 03-02 Task 1 (RED); `tests/archive/{archive,html-text,fetch-safe,wayback,private-store}.test.ts` — 03-02 Task 2
- [ ] `tests/couverture/{classement,scan,pilote}.test.ts`, `tests/fixtures/couverture/estimation-2026-11-03.yaml` — 03-03
- [ ] `tests/corpus/couverture-themes.test.ts` — 03-04 Task 3
- [ ] `tests/corpus/pilote.test.ts`, `tests/corpus/glossaire.test.ts` — 03-05 Task 2
- [ ] `tests/repo/default-root.test.ts` — 03-09 Task 1
- [x] Framework install: none (node:test already in use; no Playwright in this phase)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Capture of sites that refuse automated clients (403, client-rendered) | CONT-03, CONT-04 | Bypassing bot protection is forbidden; only a human browser may capture | 03-05 Task 1 checkpoint (conditional): save each listed URL as HTML or PDF into `reveleTonProg-archives/_depot-manuel/<id>/`, or answer « aucun programme » |
| Pilot theme choice when the measured top 3 differs from the accepted provisional list | CONT-04 | Editorial decision reserved to Erwan (CONTEXT) | 03-05 Task 3 checkpoint (conditional) |
| Editorial review of every draft (neutrality, fidelity, selection of the 2 measures, motifs, `parti: null` rows) | CONT-02, CONT-05 | `publie` requires Erwan's relecture; out of this phase's scope | SUMMARYs of 03-01, 03-06, 03-07, 03-08 and 03-09 list every item to review |
| Live network behaviour (fetch, pdftotext, Save Page Now) | CONT-03 | `npm test` never touches the network (Phase 1 rule) | 03-02 Task 3 smoke on one real URL; every content batch exercises it live |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoint tasks carry a condition check)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each created test-first by its task)
- [x] No watch-mode flags
- [x] Feedback latency < 20 s per tooling task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-03 (planner)
