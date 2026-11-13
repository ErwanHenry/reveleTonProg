---
phase: 10
slug: import-de-d-cembre
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-12
---

# Phase 10 : Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` (Node 24, native TypeScript); trap harness tests/helpers/overlay.ts; Playwright not needed by this phase |
| **Config file** | `package.json` script `test` (`TZ=Europe/Paris node --test "tests/**/*.test.ts"`) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/content-core/yaml-plafonne.test.ts tests/repo/yaml-plafonne.test.ts tests/import/*.test.ts tests/corpus/instantane-coherence.test.ts tests/pieges/pieges.test.ts tests/relecture/marquer-import.test.ts tests/rules/statut-plus-recent.test.ts tests/repo/docs.test.ts` (only the files that exist at that point; no build; under 60 s) |
| **Build run command** | `TZ=Europe/Paris fnm exec --using=24 node --test --test-name-pattern="méthode\|methode" tests/dist/site.test.ts` (10-01 coverage reader, 10-04 catalogue row) |
| **Corpus validation** | `fnm exec --using=24 node scripts/validate.ts --mode production`, `fnm exec --using=24 node scripts/ids.ts --check`, `fnm exec --using=24 npm run import:datagouv -- --check` (from 10-03) |
| **Full suite command** | `TZ=Europe/Paris fnm exec --using=24 npm test` + `fnm exec --using=24 npm run check`; CI on main or on the import pull request |
| **Estimated runtime** | about 45 s `npm test`; about 3 min for the Méthode build case; rehearsal of 10-03 Task 3 about 15 min (npm ci, import, build) |

Never run `npm test` and a build at the same time (shared `.astro` cache). Plans run one at a time on main.

---

## Sampling Rate

- **After every task commit:** quick run of the test files the task touched; `validate --mode production` for any task that touches rules, the catalogue or (on the import branch) `src/content/**`; the build case for tasks touching `scripts/lib/couverture.ts` or `src/lib/content-core/rules/config.ts`.
- **After every plan:** `npm test` + `npm run check`; push (main for 10-01 to 10-04, the import branch for 10-05 and 10-06 before the merge); CI green before the next plan. A push touching `scripts/` or `src/` on main leaves a deploy run waiting: the orchestrator asks the owner to approve or reject it the same day (never an agent), and 10-04 Task 3 clears any remaining waiting run before 10-05. Recommended batching: one push for 10-01 + 10-02, one for 10-03 + 10-04 when they run within 24 hours. No phase 10 push to main while 09-11 to 09-13 are in progress.
- **Execution order and calendar:** wave 1 = 10-01, wave 2 = 10-02 (now, by about 2026-11-16); wave 3 = 10-03 (by about 2026-11-20, while the live dataset still matches the research); wave 4 = 10-04 (as soon as the owner answers, target 2026-11-28, before 09-11); wave 5 = 10-05 (10 to 11 December 2026, after the merge of the santé review and 09-11, and after 09-12 unless the owner allowed otherwise); wave 6 = 10-06 (11 to 13 December, merge and deploy before the freeze start, Task 3 on or after 16 December).
- **Before `/gsd:verify-work`:** full suite green on main after the merge, CI green, live evidence checklist complete.
- **Max feedback latency:** 60 s (node), 3 min (build case), one CI cycle plus the owner's approval for a deploy.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | IMP-01 | T-10-01, T-10-02, T-10-05b | light parser (no load.ts import) refuses alias, bomb, duplicate key, non-object root, with file:line:col CODE, message capped at 3; same diagnostics as parseYaml of load.ts on the same inputs | unit + equivalence | `node --test tests/content-core/yaml-plafonne.test.ts tests/content-core/load.test.ts` + load.ts unchanged | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | IMP-01 | T-10-01 to T-10-03, T-10-05 | import refuses a benign alias and a duplicate key (exit 1, nothing written); archive --wayback-missing stops on an unreadable source; lireCouverture gives line and column; append keeps the prefix of every real file; Méthode page byte-identical | CLI integration (temp root) + unit + corpus + build | `node --test tests/import/import-cli.test.ts tests/import/datagouv.test.ts tests/archive/wayback.test.ts tests/couverture/classement.test.ts tests/corpus/couverture-themes.test.ts` + real dry run « 59 inchangé(s) » + `cmp` of `methode/index.html` built before and after on the same base | ✅ to extend | ⬜ pending |
| 10-01-03 | 01 | 1 | IMP-01 | T-10-04 | no direct YAML parse in shipped code outside the eight-file whitelist (every import form self-checked); stale entries detected; import graph of couverture.ts pinned (no load.ts, ajv, rule engine) | repo | `node --test tests/repo/yaml-plafonne.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | IMP-02 | T-10-06, T-10-07 | snapshot, table and candidate files agree (ids, ids_externes, (code, motif), pointer); drift is information; 0 error on today's repository; one definition of the newest snapshot; fresh root per mutation (loader memo) | unit + corpus | `node --test tests/corpus/instantane-coherence.test.ts tests/corpus/fiches.test.ts tests/corpus/dataset-datagouv.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | IMP-02 | T-10-08, T-10-09 | new declared person on a published theme: invisible while brouillon in production (proves invisibility, not detection), warning in preview, error once relu, clean with a case; `marquer` refuses and restores | traps + integration (temp root) | `node --test tests/pieges/pieges.test.ts tests/pieges/couverture.test.ts tests/relecture/marquer-import.test.ts` | ❌ W0 (4 trap folders, marquer-import) | ⬜ pending |
| 10-03-01 | 03 | 3 | IMP-03 | T-10-11 | report sections (« Absents du jeu amont » for the roadmap's « retirés »), field-by-field changes with source URL and date, consequences on published themes, reviewed statuses that change; no party label, no dash, no forbidden word; deterministic | unit | `node --test tests/import/rapport.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 3 | IMP-03, IMP-02 | T-10-12 | tolerant dry run writes no byte; real mode still stops on unknown ids; markdown output; `--check` exits 1 on a gap | CLI integration (temp root) | `node --test tests/import/import-cli.test.ts` + `npm run import:datagouv -- --check` + real dry run in markdown | ✅ to extend | ⬜ pending |
| 10-03-03 | 03 | 3 | IMP-03, IMP-02 | T-10-13, T-10-14 | rehearsal part 1 in a throwaway worktree with fake placeholders (Essai): live report, real import, `--check` red on the stale pointer, failing tests listed | live (temp) | first report in the SUMMARY + main tree clean + no placeholder in the SUMMARY | n/a | ⬜ pending |
| 10-03-04 | 03 | 3 | IMP-03, IMP-02 | T-10-14 | rehearsal part 2: hand updates, `--check` green, build and check-dist, merge trial, cleanup | live (temp) | `git worktree list` back to 2 entries + `git status --porcelain src/content data archives ids.lock` empty + checklist in the SUMMARY | n/a | ⬜ pending |
| 10-04-01 | 04 | 4 | IMP-03 | T-10-19 | owner decides D-08, D-09, freeze bounds, brouillon merge, fallback « reporter », import before the end of the opening, review not merged; silence on 2026-12-07 sets only D-08, D-09, bounds; « Décisions enregistrées » block | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 10-04-02 | 04 | 4 | IMP-03 | T-10-16, T-10-17 | STATUT_PLUS_RECENT_NON_RELU warning in both modes, never error, catalogue and RUNBOOK row (option B) | rule (inline traps) + build case | verify conditional on the recorded `D-08` key: B runs `tests/rules/statut-plus-recent.test.ts` and checks registration, catalogue and RUNBOOK row; A checks the rule is absent | ❌ W0 | ⬜ pending |
| 10-04-03 | 04 | 4 | IMP-03 | T-10-18, T-10-19b | RUNBOOK import procedure (head check, recreation cutoff) and « Gel d'import (13 au 15 décembre 2026) »; garde-gel unchanged; waiting deploy runs cleared with the owner | repo | `node --test tests/repo/docs.test.ts tests/scripts/garde-gel.test.ts` + diff of garde-gel and workflows empty | ✅ to extend | ⬜ pending |
| 10-05-01 | 05 | 5 | IMP-03 | T-10-22 | waiting runs cleared with the owner; preconditions from the recorded answers (dates, 09-11 done, 09-12 done unless allowed, review merged, main up to date, `--check` 0 gap) and morning dry run | live read | date tests + 09-11/09-12 SUMMARY or recorded key + `gh pr list --head relecture/sante --state merged` + `git rev-parse` equality + `gh run list --status waiting` + `--check` | ✅ | ⬜ pending |
| 10-05-02 | 05 | 5 | IMP-03 | T-10-21 | owner writes each new person's entry (no agent draft) | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 10-05-03 | 05 | 5 | IMP-03 | T-10-20, T-10-24 | branch, owner's table, real import on the same sha, append-only (0 deleted lines), two local commits | branch | `merge-base --is-ancestor` + 2 commits + numstat deletions 0 + archives untouched + main tree clean | ✅ | ⬜ pending |
| 10-05-04 | 05 | 5 | IMP-03, IMP-02 | T-10-22, T-10-23 | report from the parent commit, hand updates, local proofs, PR body without dash or forbidden word, green CI | branch + CI | validate production + ids --check + `--check` + PR open + body dash count 0 + main tree clean | ✅ | ⬜ pending |
| 10-06-01 | 06 | 6 | IMP-03 | T-10-25, T-10-26 | owner reviews the PR and marks the changed statuses | human | n/a (Erwan) | n/a | ⬜ pending |
| 10-06-02 | 06 | 6 | IMP-03 | T-10-25 to T-10-28 | owner shown `--is-ancestor` true for the exact head sha before any merge; no recreation after the cutoff; deploy approved by him before the freeze; production shows only reviewed persons and the updated count sentences | live + CI | PR merged + merge commit on origin/main + validate + `--check` + `/version.json` commit equals the merge commit | ✅ | ⬜ pending |
| 10-06-03 | 06 | 6 | IMP-03 | T-10-29 | no merge nor deploy during the freeze except emergency withdrawal | live read | date ≥ 2026-12-16 + `--check` + git log and run list of the window recorded | ✅ | ⬜ pending |

All node commands run with `fnm exec --using=24` and `TZ=Europe/Paris`.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement and Success Criterion to Test Map

| Item | Behavior | Automated tests (plan/task creating them) | Live or human evidence |
|------|----------|--------------------------------------------|------------------------|
| IMP-01 / ROADMAP criterion 1 | import and archive tools read YAML through the capped parser; aliases and duplicate keys refused with a clear message | tests/content-core/yaml-plafonne.test.ts (10-01 T1); tests/import/import-cli.test.ts, tests/import/datagouv.test.ts, tests/archive/wayback.test.ts, tests/couverture/classement.test.ts cases (10-01 T2); tests/repo/yaml-plafonne.test.ts (10-01 T3) | 10-01 SUMMARY: cases red before the migration |
| IMP-02 / ROADMAP criterion 2, first half | the CI fails when the snapshot and the candidate files disagree | tests/corpus/instantane-coherence.test.ts (10-02 T1), run by `npm test` in the CI job `verifier`; `import:datagouv -- --check` cases in tests/import/import-cli.test.ts (10-03 T2) | 10-03 T3: `--check` red on the stale pointer in the rehearsal, green after the hand updates; 10-05 T3 and 10-06 T2: 0 gap on the branch and on main |
| IMP-02 / ROADMAP criterion 2, second half | a trap proves « l'import ajoute un candidat déclaré à un thème publié » is detected: in preview (warning), at review time (error, `marquer` refusal); while brouillon the production trap proves invisibility only, and the pre-review signal in production is the report section « Conséquences sur les thèmes publiés » | tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-{brouillon, brouillon-preview, relu, relu-avec-case} replayed by tests/pieges/pieges.test.ts; tests/relecture/marquer-import.test.ts (10-02 T2) | 10-06 T2: a new brouillon person answers 404 in production |
| IMP-03 / ROADMAP criterion 3, dry run | a dry run produces the diff (nouveaux, « absents du jeu amont » = the roadmap's « retirés », changés with sources) and writes nothing | tests/import/rapport.test.ts (10-03 T1); tolerant dry-run and markdown cases in tests/import/import-cli.test.ts (10-03 T2) | 10-03 T3: rehearsal reports on the live dataset; 10-05 T1: morning report |
| IMP-03 / ROADMAP criterion 3, pull request reviewed, production after review | the real import goes through a dedicated pull request the owner reviews; production changes only after it | tests/rules/statut-plus-recent.test.ts (10-04 T2, option B); CI `verifier` on the pull request (validate, ids, npm test with the D-04 check, build, check-dist with CANDIDAT_NON_RELU_EN_PRODUCTION) | 10-05 T2 (entries by the owner), 10-05 T3 (PR, green CI, no deploy), 10-06 T1 (his review), 10-06 T2 (his merge or written go, his deploy approval, production table) |
| IMP-03 / ROADMAP criterion 3, before the freeze | the import is deployed before 13 December and the freeze holds until 15 December | tests/repo/docs.test.ts phase 10 block (10-04 T3: freeze section, dates, garde-gel windows unchanged) | 10-06 T2 (approval time before the freeze start), 10-06 T3 (freeze record) |

---

## Wave 0 Requirements

Created test-first by the task that needs them:

- [ ] `tests/content-core/yaml-plafonne.test.ts` (10-01 T1), `tests/repo/yaml-plafonne.test.ts` (10-01 T3)
- [ ] `tests/corpus/instantane-coherence.test.ts` (10-02 T1)
- [ ] `tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon/`, `--import-brouillon-preview/`, `--import-relu/`, `--import-relu-avec-case/` and `tests/relecture/marquer-import.test.ts` (10-02 T2)
- [ ] `tests/import/rapport.test.ts` (10-03 T1)
- [ ] `tests/rules/statut-plus-recent.test.ts` (10-04 T2, only under D-08 option B)
- [ ] Extend: tests/import/import-cli.test.ts and tests/import/datagouv.test.ts (10-01 T2, 10-03 T2), tests/archive/wayback.test.ts and tests/couverture/classement.test.ts (10-01 T2), tests/repo/docs.test.ts (10-04 T3); deliberate updates on the import branch: tests/corpus/dataset-datagouv.test.ts counts, tests/dist/cas/methode.cas.ts title (10-05 T3)

No framework install, no new npm package, no new npm script.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-08, D-09, freeze bounds, brouillon merge, fallback, report form | IMP-03 | Publisher's rules about persons and production | 10-04 T1 |
| Table entry of each new person (name split, sort name, type of source, motive) | IMP-03 | Editorial decision; no agent decides | 10-05 T2 |
| Review of the pull request and marks of the statuses that change | IMP-03 | Human review is the control (D-07, rule B) | 10-06 T1 |
| Merge of the import pull request and deploy approval | IMP-03 | Only the owner authorises production changes | 10-06 T1 and T2 |

---

## Live Evidence Checklist (phase gate)

- [ ] 10-01: cases red before the migration (benign alias accepted by the import, unreadable source skipped by --wayback-missing), green after
- [ ] 10-03: rehearsal reports on the live dataset (new ids listed without stopping), `--check` red on the stale pointer then green, failing tests before the hand updates, production build and check-dist result, merge-trial conflicts, worktrees removed
- [ ] 10-04: owner's answers verbatim (or silence defaults with date) and the « Décisions enregistrées » block; real corpus with 0 STATUT_PLUS_RECENT_NON_RELU before the import; no waiting deploy run
- [ ] 10-05: preconditions table, morning report and sha256, owner's entries verbatim, three commit hashes, report from the parent commit with the same sha256, local proofs, PR URL and green CI, no deploy requested
- [ ] 10-06: owner's marks committed on the branch, 0 STATUT_PLUS_RECENT_NON_RELU before the merge, head sha and `--is-ancestor` result shown to the owner, merge commit, deploy run id approved by ErwanHenry before the freeze start, production table (version.json, new brouillon persons 404 and absent from sitemap, reviewed statuses shown), freeze record of 13 to 15 December

---

## Validation Sign-Off

- [ ] Every task has an automated verify, or is a human gate listed above
- [ ] Sampling continuity: no three consecutive tasks without an automated verify (each human gate is followed by an automated task)
- [ ] Wave 0 files are created test-first by their task
- [ ] No watch-mode flag; feedback latency under 60 s for node tests
- [ ] `nyquist_compliant: true` set in the frontmatter

**Approval:** pending
