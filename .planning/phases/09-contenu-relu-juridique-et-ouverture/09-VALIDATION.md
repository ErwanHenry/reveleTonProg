---
phase: 9
slug: contenu-relu-juridique-et-ouverture
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-10
---

# Phase 9 : Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` (Node 24, native TypeScript) for unit, rule, repo and dist tests; bash scripts tested by spawning `bash` with PATH stubs; `@playwright/test` 1.64.1 for the browser suite and the remote 4G run |
| **Config file** | `package.json` script `test` (`TZ=Europe/Paris node --test "tests/**/*.test.ts"`); `playwright.config.ts` (remote switch `E2E_BASE_URL`, `E2E_DIST`) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/relecture/*.test.ts tests/rules/publication.test.ts tests/rules/sources-wayback.test.ts tests/corpus/publication-config.test.ts tests/scripts/check-dist.test.ts tests/ui/journal-acces.test.ts tests/repo/risques-juridiques.test.ts tests/repo/relecture-hors-site.test.ts tests/repo/docs.test.ts` (only the files that exist at that point; no build; under 60 s) |
| **Build run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/dist/site.test.ts` (the only file that runs `astro build`; filter with `--test-name-pattern`) |
| **Corpus validation** | `fnm exec --using=24 node scripts/validate.ts --mode production` (and `--root tests/fixtures/corpus-valide`) |
| **E2E command** | `fnm exec --using=24 npm run e2e -- --jeu m1` (fixture) or `--jeu reel` (real corpus); remote 4G: `E2E_BASE_URL=https://<hôte> E2E_DIST=<dist du même commit> npx playwright test --project=4g` |
| **Full suite command** | CI on main (verifier, e2e, secrets, then changements, gel, construire, deploy for a site push) + `node scripts/render-caddy.ts --check` |
| **Estimated runtime** | about 45 s `npm test`, about 8 min e2e, about 12 min full CI |

Platform notes: GNU-only cases of the `ops/*.sh` tests use `gmv` locally and always run on the ubuntu CI. Never run `npm test` and `npm run e2e` at the same time (shared `.astro` cache).

---

## Sampling Rate

- **After every task commit:** quick run of the test files the task touched, plus `validate --mode production` for any task that touches `src/content/**`, `config/publication.yml`, schemas or rules; build run for tasks touching `src/pages/**`, `src/components/**`, `scripts/lib/check-dist.ts` or `tests/dist/**`.
- **After every plan:** `fnm exec --using=24 npm test` + `fnm exec --using=24 npm run check`; push; CI green on main before the next plan. A site push leaves a deploy waiting: Erwan approves or rejects it at once.
- **Execution order:** wave-1 plans have disjoint files but share one working tree and the Astro cache: run them one at a time (suggested 09-01, 09-02, 09-03, 09-04). Wave 2: 09-05, 09-06, 09-07 one at a time; 09-08 is Erwan's track and can run at any moment. Wave 3: 09-09 in the main tree, 09-10 in its own worktree. Waves 4 to 6 are sequential.
- **Server and GitHub settings:** read-only checks are the sampling; each approved write is followed by its check before the next write.
- **Before `/gsd:verify-work`:** full suite green, CI green on main, live evidence checklist complete (below).
- **Max feedback latency:** 60 s (node), 8 min (e2e), 15 min (one deploy cycle with approval at hand).

Waves: 1 = 09-01 to 09-04; 2 = 09-05 to 09-08; 3 = 09-09, 09-10; 4 = 09-11; 5 = 09-12; 6 = 09-13.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | PUB-01 | T-09-01, T-09-03 | review open; splice at node offsets, closed key list, only-these-keys post-check on every real file | unit + corpus | `node --test tests/relecture/editer.test.ts tests/corpus/couverture-themes.test.ts tests/corpus/fiches.test.ts tests/corpus/pilote.test.ts` | ❌ W0 editer.test / ✅ to modify | ⬜ pending |
| 9-01-02 | 01 | 1 | PUB-01 | T-09-02, T-09-04, T-09-05 | `liste`, `marquer` (3 fields, restore on new error), registry and state à revoir | integration (temp corpus) + CLI | `node --test tests/relecture/marquer.test.ts tests/relecture/liste.test.ts tests/repo/scaffold.test.ts` + `npm run relecture -- liste --theme sante --format json` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 1 | PUB-02 | T-09-07, T-09-08, T-09-09 | whitelist reader strict; published theme outside the list refused in production; safe direction is a warning | rule traps + corpus | `node --test tests/corpus/publication-config.test.ts tests/rules/publication.test.ts tests/repo/docs.test.ts` + validate (real and fixture) | ❌ W0 | ⬜ pending |
| 9-02-02 | 02 | 1 | PUB-02 | T-09-07 | view-model and check-dist apply the same list | unit + dist | `node --test tests/corpus/vue.test.ts tests/scripts/check-dist.test.ts` + `node --test --test-name-pattern="publication" tests/dist/site.test.ts` | ✅ to extend / ❌ W0 publication.cas | ⬜ pending |
| 9-02-03 | 02 | 1 | PUB-03 | T-09-10 | reviewer and date on every published measure; RELECTURE_ABSENTE | unit + dist + e2e m1 | `node --test tests/scripts/check-dist.test.ts tests/ui/styles.test.ts` + `node --test --test-name-pattern="publication\|méthode" tests/dist/site.test.ts` | ✅ to extend | ⬜ pending |
| 9-03-01 | 03 | 1 | PUB-04 | T-09-12 to T-09-16 | exception field and rule; adoption only when the extract matches the snapshot | schema + rule traps + unit | `node --test tests/schemas/source.test.ts tests/rules/sources-wayback.test.ts tests/archive/archive.test.ts tests/archive/wayback.test.ts tests/corpus/types-schemas.test.ts` | ✅ to extend / ❌ W0 sources-wayback | ⬜ pending |
| 9-03-02 | 03 | 1 | PUB-04 | T-09-13 | Erwan validates the exact source diffs and the motive | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 9-03-03 | 03 | 1 | PUB-04 | T-09-12, T-09-14 | sources updated, archives untouched, pinned exception list | corpus + live read | `node --test tests/rules/sources-wayback.test.ts` + validate + greps on the two source files + `git status --porcelain archives` empty | ✅ | ⬜ pending |
| 9-04-01 | 04 | 1 | LEG-01 | T-09-17 to T-09-21 | regime II text, identity sentence only under actif, two log sentences from constants, real contact, art. 1-1 III kept | unit + dist | `node --test tests/ui/journal-acces.test.ts tests/corpus/site-config.test.ts tests/repo/hote-en-dur.test.ts` + `node --test --test-name-pattern="mentions\|institutionnel" tests/dist/site.test.ts` | ✅ to extend / ❌ W0 mentions-finales.cas | ⬜ pending |
| 9-04-02 | 04 | 1 | LEG-02 | T-09-22 | note R1 to R9, triggers, unverified points, signature block | repo | `node --test tests/repo/risques-juridiques.test.ts` | ❌ W0 | ⬜ pending |
| 9-05-01 | 05 | 2 | PUB-01 | T-09-26 | review sheet from corpus and validator diagnostics, extract window | unit (temp corpus) | `node --test tests/relecture/vue.test.ts` | ❌ W0 | ⬜ pending |
| 9-05-02 | 05 | 2 | PUB-01 | T-09-23 to T-09-28 | loopback only, Host, Origin, CSRF, body cap, escaping, never in the site | integration + repo | `node --test tests/relecture/serveur.test.ts tests/repo/relecture-hors-site.test.ts` | ❌ W0 | ⬜ pending |
| 9-06-01 | 06 | 2 | PUB-02 | T-09-30, T-09-31 | publier: preconditions, all or nothing, production validation at 0 error | integration (temp corpus) | `node --test tests/relecture/publier.test.ts` + dry-run on the real corpus exits 1 | ❌ W0 | ⬜ pending |
| 9-06-02 | 06 | 2 | LEG-03 | T-09-32, T-09-33 | retirer: coverage case updated or refusal with exact commands; theme fallback | integration (temp corpus) | `node --test tests/relecture/retirer.test.ts` | ❌ W0 | ⬜ pending |
| 9-07-01 | 07 | 2 | PUB-02 | T-09-35 to T-09-38 | installer step site-public (exit 6, exit 7), restore test follows installed blocks | repo (bash + stubs) | `node --test tests/repo/installer-serveur.test.ts tests/repo/sauvegarde.test.ts` | ✅ to extend | ⬜ pending |
| 9-07-02 | 07 | 2 | PUB-02 | T-09-39, T-09-40 | generated favicon, single allowed .ico | unit + CLI + build | `node --test tests/scripts/favicon.test.ts tests/scripts/check-dist.test.ts tests/scripts/e2e-serveur.test.ts` + `node scripts/favicon.ts --check` + build and check-dist | ❌ W0 favicon.test / ✅ to extend | ⬜ pending |
| 9-08-01 | 08 | 2 | LEG-01 | T-09-41, T-09-43, T-09-44 | identity given to the host, contact tested end to end | human | n/a (Erwan) | n/a | ⬜ pending |
| 9-08-02 | 08 | 2 | LEG-02 | T-09-42 | Erwan signs or corrects | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 9-08-03 | 08 | 2 | LEG-01, LEG-02 | T-09-41, T-09-42 | signature and dates recorded, nothing private committed | repo | `node --test tests/repo/risques-juridiques.test.ts` + grep signature, 0 « à compléter » | ✅ | ⬜ pending |
| 9-09-01 | 09 | 3 | LEG-03, PUB-01, PUB-02 | T-09-45, T-09-46 | RUNBOOK procedures match the commands; ADRs | repo | `node --test tests/repo/docs.test.ts` | ✅ to extend | ⬜ pending |
| 9-09-02 | 09 | 3 | LEG-03 | T-09-48 | approval of three server writes, OPS-01 override | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 9-09-03 | 09 | 3 | PUB-02 | T-09-47, T-09-49 | restore test installed and passing, public block pre-validated, baseline | live | `ssh keel-vps 'cmp -s … && echo identique'` + baseline file + AAAA empty | ✅ | ⬜ pending |
| 9-10-01 | 10 | 3 | PUB-01 | T-09-54 | review worktree, branch, draft pull request | local | worktree checks + `liste` total > 0 | ✅ | ⬜ pending |
| 9-10-02 | 10 | 3 | PUB-01 | T-09-51 | Erwan reviews 121 targets himself | human | n/a (Erwan, 23 November to 1 December) | n/a | ⬜ pending |
| 9-10-03 | 10 | 3 | PUB-01 | T-09-50, T-09-52, T-09-53 | reste 0, wording audit, scope audit, merge | corpus + CLI | `liste … --format json` reste 0 + validate + counts 47, 37, 37 | ✅ | ⬜ pending |
| 9-11-01 | 11 | 4 | PUB-02 | T-09-55, T-09-57 | Erwan's go to publish, host actif, drill measure | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 9-11-02 | 11 | 4 | PUB-02, PUB-03, PUB-04, LEG-01 | T-09-55, T-09-56, T-09-58, T-09-60 | whitelist + publier, actif, deployment build at 0 error, rehearsal on essai approved by Erwan | corpus + build + e2e reel + live | validate + greps (sante open, 47 publie, theme publie) + essai `/themes/sante/` 200 | ✅ | ⬜ pending |
| 9-11-03 | 11 | 4 | LEG-03 | T-09-59 | real timed withdrawal then restore | live | validate + 47 publie + « Exercice du » in RUNBOOK + clean tree | ✅ | ⬜ pending |
| 9-12-01 | 12 | 5 | PUB-02, LEG-01 | T-09-61, T-09-67 | gate and go or no-go with the exact write list | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 9-12-02 | 12 | 5 | PUB-02, LEG-01 | T-09-61 to T-09-63, T-09-65 to T-09-67 | production release, public block by validate then reload, certificates, public checks | live | curl 200 and 301, version.json commit, HSTS 300, `verifier-sites.sh comparer` | ✅ | ⬜ pending |
| 9-12-03 | 12 | 5 | PUB-02 | T-09-64, T-09-68, T-09-69 | supervision on the public host without credentials, technical host removed, restore test | live + repo | `gh variable list` values, sonde run success, curl 200, `node --test tests/repo/docs.test.ts` | ✅ | ⬜ pending |
| 9-13-01 | 13 | 6 | DETTE-04 | T-09-70 to T-09-72 | deployed copy proven identical, audit journal redone, old journal kept | repo + live read | `node --test tests/repo/docs.test.ts tests/scripts/audit-lire.test.ts` + journal files checks | ✅ to extend | ⬜ pending |
| 9-13-02 | 13 | 6 | PUB-02 | T-09-73, T-09-74 | 4G on the public host with the santé page under budget, published from one constant, smoke test passed in production | e2e remote + unit + live | `node --test tests/ui/constantes-publiques.test.ts tests/repo/docs.test.ts` + served commit check | ✅ to extend | ⬜ pending |
| 9-13-03 | 13 | 6 | PUB-02 | T-09-75 | Erwan confirms the public site and the supervision | human | n/a (Erwan) | n/a | ⬜ pending |

All node commands run with `fnm exec --using=24` and `TZ=Europe/Paris`.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement to Test Map

| Req ID | Behavior | Automated tests | Live or human evidence |
|--------|----------|-----------------|------------------------|
| PUB-01 | a command lists what remains and marks `relu` with reviewer and date, writing nothing else; local page for the review | tests/relecture/{editer,marquer,liste,vue,serveur}.test.ts, tests/repo/relecture-hors-site.test.ts, tests/repo/scaffold.test.ts, tests/corpus/couverture-themes.test.ts | 09-10: Erwan's review, reste 0, wording and scope audits |
| PUB-02 | only a fully reviewed, explicitly opened theme is in production; no draft | tests/rules/publication.test.ts, tests/corpus/publication-config.test.ts, tests/corpus/vue.test.ts, tests/scripts/check-dist.test.ts, tests/dist/cas/publication.cas.ts, tests/relecture/publier.test.ts, tests/rules/equite.test.ts (existing) | 09-11 rehearsal table on essai; 09-12 public checks; 09-13 Erwan's confirmation |
| PUB-03 | each published measure shows its reviewer and date | tests/scripts/check-dist.test.ts (RELECTURE_ABSENTE), tests/dist/cas/publication.cas.ts | 09-11 and 09-12: count of `data-relecture` equals the count of measures |
| PUB-04 | every source of a published measure has a Wayback copy or a motivated exception accepted by the rule | tests/schemas/source.test.ts, tests/rules/sources-wayback.test.ts (traps and pinned list), tests/archive/{archive,wayback}.test.ts | 09-03: new Batho address answers 200; validator at 0 error once santé is published (09-11) |
| LEG-01 | final legal notice: regime II, host actif, contact tested, log policy, art. 1-1 III | tests/ui/journal-acces.test.ts, tests/dist/cas/mentions-finales.cas.ts, tests/dist/cas/institutionnel.cas.ts, tests/corpus/site-config.test.ts, tests/corpus/hebergeur-config.test.ts | 09-08: identity to the host and contact test (dates); 09-11: deployment build at 0 error; 09-12: page online |
| LEG-02 | written accepted risk | tests/repo/risques-juridiques.test.ts | 09-08: Erwan's signature |
| LEG-03 | RUNBOOK: emergency withdrawal under one hour, 2027 freeze calendar | tests/repo/docs.test.ts (phase 9 block), tests/relecture/retirer.test.ts, tests/scripts/garde-gel.test.ts (existing) | 09-09: measured chain; 09-11: timed drill on a published measure |
| DETTE-04 | audit journal and fingerprints redone on the build online | tests/repo/docs.test.ts (audit block extended), tests/scripts/audit-lire.test.ts | 09-13: tree digest equal to the server's release, served files hashed, new pass recorded |

---

## Wave 0 Requirements

Created test-first by the task that needs them:

- [ ] `tests/relecture/editer.test.ts` (09-01 T1), `tests/relecture/marquer.test.ts`, `tests/relecture/liste.test.ts`, `tests/helpers/corpus-relecture.ts` (09-01 T2)
- [ ] `tests/corpus/publication-config.test.ts`, `tests/rules/publication.test.ts`, fixture lists `tests/fixtures/corpus-valide/config/publication.yml` and `tests/fixtures/corpus-m1/config/publication.yml` (09-02 T1), `tests/dist/cas/publication.cas.ts` (09-02 T2)
- [ ] `tests/rules/sources-wayback.test.ts` (09-03 T1)
- [ ] `tests/dist/cas/mentions-finales.cas.ts` (09-04 T1), `tests/repo/risques-juridiques.test.ts` (09-04 T2)
- [ ] `tests/relecture/vue.test.ts`, `tests/relecture/serveur.test.ts`, `tests/repo/relecture-hors-site.test.ts` (09-05)
- [ ] `tests/relecture/etat-publie.ts`, `tests/relecture/publier.test.ts`, `tests/relecture/retirer.test.ts` (09-06)
- [ ] `tests/scripts/favicon.test.ts` (09-07 T2)
- [ ] Adapt `tests/corpus/couverture-themes.test.ts` line 95 (09-01 T1), `tests/repo/scaffold.test.ts` (09-01 T2), `tests/corpus/hebergeur-config.test.ts` (09-11 T2), `tests/ui/constantes-publiques.test.ts` (09-13 T2)

No framework install, no new npm package. One new npm script (`relecture`, 09-01), pinned by tests/repo/scaffold.test.ts.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editorial review of 47 measures, 37 statuses, 37 cases | PUB-01, PUB-02 | Human judgment on wording against sources is the control (no automatic promotion to relu) | 09-10 T2 |
| Validation of the Batho and Rohou source changes and of the exception's motive | PUB-04 | Editorial decision, Erwan's words in a public file | 09-03 T2 |
| Identity given to Hetzner, invoice entity | LEG-01 | Erwan's customer account; proof stays outside the repository | 09-08 T1 |
| Contact address tested end to end | LEG-01 | Erwan's mailboxes | 09-08 T1 |
| Signature of the risk note | LEG-02 | Only the publisher can accept a legal risk | 09-08 T2 |
| Deploy approvals in the GitHub interface | PUB-02 | The human approval is the control; at least one by Erwan himself (Phase 8 UAT 2) | 09-11 T2, 09-12 T2, 09-13 T2 |
| Go or no-go for the opening | PUB-02, LEG-01 | Publisher's decision | 09-12 T1 |
| Public site read on a phone and a computer, Healthchecks and Telegram quiet, `essai` DNS record removed | PUB-02 | Real devices, third-party consoles, registrar account | 09-13 T3 |
| HSTS lengthened to 31536000 | (D-09) | Must wait at least 7 stable days after the opening; dated follow-up in the RUNBOOK | after 09-12, date in docs/RUNBOOK.md |

---

## Live Evidence Checklist (phase gate)

- [ ] 09-03: old Batho address 404, new one 200, snapshot adopted with all paragraphs found, Rohou exception with Erwan's wording, `archives/` untouched
- [ ] 09-08: dates of the identity transmission and of the contact test, invoice entity, Erwan's « risque accepté »
- [ ] 09-09: three run timings, restore test ok with the new script, public block valid in a throwaway container (with and without variables), DNS table (A only), GitHub settings names, OPS-01 override accepted
- [ ] 09-10: reste 0 of 121, wording audit table, scope audit, merged pull request
- [ ] 09-11: deployment build and check-dist at 0 error under `RTP_DEPLOIEMENT=1`, e2e real corpus green with the 4G figures of the santé page, rehearsal table on essai, approval by Erwan in the interface (run id), drill timeline under 60 minutes without the approval wait, restore diff empty
- [ ] 09-12: gate table, timeline of S1 to S6 and V1 to V6, run log with `RTP_DEPLOIEMENT: 1`, two certificates (issuer, end dates), public checks table, masked first log line, comparisons (0 different, 2 new; then 1 missing after the removal), Caddy StartedAt unchanged, heartbeat and probe green on the public host, restore test ok
- [ ] 09-13: commit served, artefact name, equal tree digests, served files compared with 0 difference, fingerprint, new audit section, 4G figures under 1 000 ms on the public host, smoke step passed in production, Erwan's « ouvert, vérifié »

---

## Validation Sign-Off

- [ ] Every task has an automated verify, or is a human gate listed above
- [ ] Sampling continuity: no three consecutive tasks without an automated verify (human gates are followed by a recording or checking task)
- [ ] Wave 0 files are created test-first by their task
- [ ] No watch-mode flag; feedback latency under 60 s for node tests
- [ ] `nyquist_compliant: true` set in the frontmatter

**Approval:** pending
