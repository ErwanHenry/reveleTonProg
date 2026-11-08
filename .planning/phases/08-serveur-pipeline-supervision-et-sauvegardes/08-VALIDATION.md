---
phase: 8
slug: serveur-pipeline-supervision-et-sauvegardes
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-08
---

# Phase 8 : Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert` (Node 24, native TypeScript) for repo, unit and dist tests; bash scripts tested by spawning `bash` with PATH stubs; `@playwright/test` 1.64.1 for the 4G spec (local and remote mode) |
| **Config file** | `package.json` script `test` (`TZ=Europe/Paris node --test "tests/**/*.test.ts"`); `playwright.config.ts` (remote switch `E2E_BASE_URL`, `E2E_USER`, `E2E_PASS` added by 08-04) |
| **Quick run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/repo/caddy.test.ts tests/repo/hote-en-dur.test.ts tests/repo/commande-deploiement.test.ts tests/repo/verifications-caddy.test.ts tests/repo/installer-serveur.test.ts tests/repo/config-serveur.test.ts tests/repo/battement.test.ts tests/repo/sauvegarde.test.ts tests/repo/ci.test.ts tests/repo/deploy-workflow.test.ts tests/repo/playwright-config.test.ts tests/scripts/garde-gel.test.ts tests/scripts/check-dist.test.ts tests/ui/journal-acces.test.ts tests/ui/constantes-publiques.test.ts tests/repo/docs.test.ts` (only the files that exist at that point; no build; < 30 s) |
| **Build run command** | `TZ=Europe/Paris fnm exec --using=24 node --test tests/dist/site.test.ts` (only file that runs `astro build`) |
| **E2E command** | `fnm exec --using=24 npm run e2e` (local); remote: `E2E_BASE_URL=https://essai.<domaine> E2E_USER=sonde E2E_PASS=… E2E_DIST=<dist> npx playwright test --project=4g` (08-14) |
| **Full suite command** | CI sequence on main (verifier, e2e, secrets; gel and deploy skipped while DEPLOY_CIBLE is unset) + `node scripts/render-caddy.ts --check` |
| **Estimated runtime** | ~45 s `npm test`, ~8 min e2e, ~12 min full CI |

Platform note: the dispatcher's atomic-switch cases need GNU `mv -T`. On Erwan's macOS they use `gmv` (installed) through a stub; if `gmv` is missing they are skipped locally and always run on the ubuntu-24.04 CI (check 0 skipped there). macOS bash is 3.2: every `ops/*.sh` is written bash-3.2 compatible so its tests run locally too.

---

## Sampling Rate

- **After every task commit:** quick run of the files the task touched; build run for tasks touching `src/pages/**`, `src/lib/profil-4g.ts`, `tests/dist/**`.
- **Execution order:** wave-1 plans have no shared file but share one working tree and the Astro cache: run them one at a time (suggested 01, 02, 03, 06, 04, 05; 08-07 follows in wave 2 because its restore test runs the real installer and validation script), push after each, check CI after each push (memory rule). Never run `npm test` and `npm run e2e` at the same time.
- **After every plan:** `npm test` + `npm run check`; CI green on main before the next plan. Server plans: their read-only checks are the sampling; each write is followed by its verification command before the next write.
- **Before `/gsd:verify-work`:** full suite green, CI green on main, live evidence checklist complete (below).
- **Max feedback latency:** 60 s (node), 8 min (e2e), 40 min (alert chain, 08-15 only). Waves: 1 = 08-01 to 08-06; 2 = 08-07, 08-09, 08-10; 3 = 08-08, 08-11, 08-12; 4 = 08-13; 5 = 08-14; 6 = 08-15.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | HEB-01, HEB-08, HEB-14 | T-08-01, T-08-02, T-08-03, T-08-06 | basic_auth with dummy default, noindex, robots closed, same headers, drift | repo + CLI | `node scripts/render-caddy.ts --check && node --test tests/repo/caddy.test.ts tests/repo/hote-en-dur.test.ts` | ✅ caddy.test to extend | ⬜ pending |
| 8-01-02 | 01 | 1 | HEB-09 | T-08-05 | one source for log policy, Mentions sentence | unit | `node --test tests/ui/journal-acces.test.ts tests/repo/caddy.test.ts` | ❌ W0 journal-acces.test | ⬜ pending |
| 8-02-01 | 02 | 1 | HEB-02, HEB-10, HEB-11 | T-08-07 to T-08-11 | command whitelist, jail, atomic switch, rotation, toggle | repo (bash + stubs) | `node --test tests/repo/commande-deploiement.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 1 | HEB-01 | T-08-12, T-08-13 | throwaway validate, per-site snapshot without names | repo (bash + stubs) | `node --test tests/repo/verifications-caddy.test.ts` | ❌ W0 | ⬜ pending |
| 8-03-01 | 03 | 1 | HEB-01, OPS-03 | T-08-20 | override limited, `:?` variables, cron files | repo | `node --test tests/repo/config-serveur.test.ts` | ❌ W0 | ⬜ pending |
| 8-03-02 | 03 | 1 | HEB-10, OPS-03 | T-08-14 to T-08-19 | idempotent installer, no restart, in-place append, root-owned keys | repo (bash + stubs) | `node --test tests/repo/installer-serveur.test.ts` | ❌ W0 | ⬜ pending |
| 8-04-01 | 04 | 1 | HEB-07, HEB-08 | T-08-21, T-08-23 | version.json checked, file-type allowlist | unit + dist + CLI | `node --test tests/scripts/check-dist.test.ts tests/repo/docs.test.ts && node --test tests/dist/site.test.ts` | ✅ to extend / ❌ W0 version.cas | ⬜ pending |
| 8-04-02 | 04 | 1 | PERF-02 | T-08-24, T-08-25 | remote mode with preemptive Basic header (no 401 measured), same build | repo + unit | `node --test tests/repo/playwright-config.test.ts tests/scripts/e2e-serveur.test.ts` | ❌ W0 playwright-config.test | ⬜ pending |
| 8-05-01 | 05 | 1 | PERF-02 | T-08-26, T-08-27 | budget 1 000 ms, label, one constant | unit + dist | `node --test tests/ui/constantes-publiques.test.ts && node --test --test-name-pattern="méthode\|4G" tests/dist/site.test.ts` | ✅ to extend | ⬜ pending |
| 8-05-02 | 05 | 1 | PERF-02 | T-08-27 | budget enforced in a browser | e2e | `npm run e2e -- --jeu reel -- --project=4g` | ✅ | ⬜ pending |
| 8-06-01 | 06 | 1 | HEB-13 | T-08-34 | freeze windows in Paris time, emergency with justification | unit + CLI | `node --test tests/scripts/garde-gel.test.ts` | ❌ W0 | ⬜ pending |
| 8-06-02 | 06 | 1 | HEB-02, HEB-10, HEB-12, HEB-14 | T-08-28 to T-08-33, T-08-36 | deploy job safety properties, dormant | repo | `node --test tests/repo/ci.test.ts tests/repo/deploy-workflow.test.ts` + CI run shows gel and deploy skipped | ✅ ci.test to extend / ❌ W0 deploy-workflow | ⬜ pending |
| 8-06-03 | 06 | 1 | HEB-11, OPS-01 | T-08-35 | rollback behind the Environment, probe never /fail | repo | `node --test tests/repo/deploy-workflow.test.ts` | ❌ W0 | ⬜ pending |
| 8-07-01 | 07 | 2 | OPS-01, OPS-02 | T-08-37, T-08-38 | ping only when healthy, thresholds, no URL printed | repo (bash + stubs) | `node --test tests/repo/battement.test.ts` | ❌ W0 | ⬜ pending |
| 8-07-02 | 07 | 2 | OPS-03 | T-08-39 to T-08-41 | archive without private keys, folder skeleton recreated, real installer finds the restored tree conforming | repo (bash + stubs) | `node --test tests/repo/sauvegarde.test.ts` | ❌ W0 | ⬜ pending |
| 8-08-01 | 08 | 3 | HEB-11, HEB-13, OPS-01..03 | T-08-42, T-08-43 | procedures match the code | repo | `node --test tests/repo/docs.test.ts` | ✅ to extend | ⬜ pending |
| 8-08-02 | 08 | 3 | HEB-01, HEB-02, HEB-10, HEB-12, HEB-14 | T-08-42 | ADR-054/055/057/058, secrets answer | repo | `node --test tests/repo/docs.test.ts && npm test` | ✅ to extend | ⬜ pending |
| 8-09-01 | 09 | 2 | HEB-01, HEB-14 | T-08-44, T-08-46 | read-only baseline, throwaway validation with and without variables | live read-only | `bash -s` runs of valider-caddy and verifier-sites; files under ~/.config/rtp | ✅ scripts from W1 | ⬜ pending |
| 8-09-02 | 09 | 2 | HEB-01 | T-08-47, T-08-48 | D-01 approval | checkpoint | n/a (decision) | n/a | ⬜ pending |
| 8-09-03 | 09 | 2 | HEB-01, HEB-09, HEB-14 | T-08-44, T-08-45, T-08-49 | recreate without cutting other sites | live | `bash ops/verifier-sites.sh comparer <avant> <apres>` + docker inspect mounts | ✅ | ⬜ pending |
| 8-10-01 | 10 | 2 | HEB-10 | T-08-51, T-08-53 | key, pin cross-checked, two real builds | local | `jq -e … /tmp/rtp-essai-{a,b}/version.json` + fingerprint comparison | ✅ | ⬜ pending |
| 8-10-02 | 10 | 2 | HEB-10 | T-08-50 | D-01 approval | checkpoint | n/a | n/a | ⬜ pending |
| 8-10-03 | 10 | 2 | HEB-02, HEB-10, HEB-11 | T-08-50, T-08-52, T-08-54 | A1, toggle, refusals, cleanup | live | `ssh … deploy@<ip> etat essai` with the pinned host line | ✅ | ⬜ pending |
| 8-11-01 | 11 | 3 | OPS-02, OPS-03 | T-08-55 | D-01 approval, checks created | checkpoint | n/a | n/a | ⬜ pending |
| 8-11-02 | 11 | 3 | OPS-02, OPS-03 | T-08-55, T-08-57 | cron runs, simulated disk alerts, first archive | live | `ssh keel-vps "test -x /usr/local/sbin/rtp-battement …"` + journald count | ✅ | ⬜ pending |
| 8-11-03 | 11 | 3 | OPS-02 | T-08-56 | Telegram DOWN and UP seen | human | n/a (Erwan) | n/a | ⬜ pending |
| 8-12-01 | 12 | 3 | HEB-01 | T-08-61 | DNS by Erwan, D-01 approval | checkpoint | n/a | n/a | ⬜ pending |
| 8-12-02 | 12 | 3 | HEB-01, HEB-14 | T-08-60, T-08-61 | real domain, drift, DNS and validation checks | repo + live read-only | `node scripts/render-caddy.ts --check && node --test tests/repo/caddy.test.ts tests/repo/hote-en-dur.test.ts` | ✅ | ⬜ pending |
| 8-12-03 | 12 | 3 | HEB-01, HEB-07, HEB-08, HEB-09, HEB-14 | T-08-59, T-08-62, T-08-63 | HTTPS, headers, 401, noindex, log line, reload only | live | `curl … /` = 401 and `verifier-sites.sh comparer` | ✅ | ⬜ pending |
| 8-13-01 | 13 | 4 | HEB-10, HEB-12 | T-08-64, T-08-66 | Environments by Erwan | checkpoint (human action) | n/a | n/a | ⬜ pending |
| 8-13-02 | 13 | 4 | HEB-02, HEB-07, HEB-11, HEB-12, HEB-13 | T-08-65, T-08-67, T-08-69 | approved push deploy, timed round trip | live | `gh api …/environments/production` (prevent_self_review false) + run evidence + timing table | ✅ | ⬜ pending |
| 8-13-03 | 13 | 4 | HEB-11, HEB-12 | T-08-68 | approvals and timings confirmed, key removed | human | n/a | n/a | ⬜ pending |
| 8-14-01 | 14 | 5 | PERF-02 | T-08-70, T-08-72 | measures behind Caddy on the same build | e2e remote + manual Lighthouse | `jq -e … /tmp/rtp-perf/mesures.json` | ✅ (W1 tooling) | ⬜ pending |
| 8-14-02 | 14 | 5 | PERF-02 | T-08-71 | published figures from one constant | unit + dist + repo | `node --test tests/ui/constantes-publiques.test.ts tests/repo/docs.test.ts && node --test --test-name-pattern="méthode\|4G" tests/dist/site.test.ts` | ✅ to extend | ⬜ pending |
| 8-14-03 | 14 | 5 | PERF-02 | T-08-71 | Erwan reviews | human | n/a | n/a | ⬜ pending |
| 8-15-01 | 15 | 6 | OPS-01..03 | T-08-73 | D-01 approval | checkpoint | n/a | n/a | ⬜ pending |
| 8-15-02 | 15 | 6 | OPS-01, OPS-02, OPS-03 | T-08-73, T-08-75, T-08-76 | probe live, three simulated failures, restore proof | live | `gh run list --workflow sonde.yml` + restore JSON line + cron checks | ✅ | ⬜ pending |
| 8-15-03 | 15 | 6 | OPS-01, OPS-02 | T-08-74 | Telegram DOWN and UP for each check | human | n/a | n/a | ⬜ pending |

All node commands run with `fnm exec --using=24` and `TZ=Europe/Paris`.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement to Test Map

| Req ID | Behavior | Automated tests | Live evidence |
|--------|----------|-----------------|---------------|
| HEB-01 | generated block, drift, validate then reload, other sites unchanged | caddy.test, hote-en-dur.test, verifications-caddy.test, config-serveur.test, installer-serveur.test | 08-09 and 08-12 before/after comparisons, reload without restart |
| HEB-02 | push on main deploys to releases/<sha>/, atomic switch, smoke | commande-deploiement.test, deploy-workflow.test | 08-10 loopback, 08-13 approved push run |
| HEB-07 | /version.json commit and date | check-dist.test, dist case version.cas | 08-12 and 08-13 HTTPS checks |
| HEB-08 | headers, compression, no-cache, no hashed file | caddy.test, check-dist.test (TYPE_FICHIER_INATTENDU) | 08-12 header table |
| HEB-09 | 14-day masked log, Mentions sentence | caddy.test, journal-acces.test | 08-12 first log line |
| HEB-10 | restricted key, pinned host, secrets in Environment, repo refusals | commande-deploiement.test, installer-serveur.test, deploy-workflow.test, ci.test | 08-10 refusals and permissions, 08-13 Environment API |
| HEB-11 | rollback under 2 min, timed round trip | commande-deploiement.test (toggle), deploy-workflow.test | 08-10 switch time, 08-13 timing table |
| HEB-12 | every deploy waits for Erwan | deploy-workflow.test (environment production) | 08-13 three approved runs, prevent self-review off |
| HEB-13 | freeze windows except documented emergency | garde-gel.test, deploy-workflow.test | 08-13 dry check |
| HEB-14 | protected technical host, production never skips the guard | caddy.test, deploy-workflow.test (RTP_DEPLOIEMENT expression) | 08-12 401, noindex, robots |
| PERF-02 | under 1 s on « Slow 4G simulé », label and real measurement published | constantes-publiques.test, playwright-config.test, methode dist case, docs.test, e2e 4g | 08-14 remote run and Lighthouse |
| OPS-01 | probe, alert after 3 failures, recovery | deploy-workflow.test (sonde), battement.test | 08-15 simulated outage |
| OPS-02 | heartbeat: machine, disk 85/92 %, certificate under 14 days | battement.test | 08-11 disk simulations, 08-15 certificate and dead heartbeat |
| OPS-03 | configuration in the repo, real restore, monthly | installer-serveur.test, config-serveur.test, sauvegarde.test | 08-11 first archive, 08-15 restore test and monthly cron |

---

## Wave 0 Requirements

Created test-first by the task that needs them:

- [ ] `tests/ui/journal-acces.test.ts` (08-01 T2)
- [ ] `tests/repo/commande-deploiement.test.ts` (08-02 T1)
- [ ] `tests/repo/verifications-caddy.test.ts` (08-02 T2)
- [ ] `tests/repo/config-serveur.test.ts` (08-03 T1), `tests/repo/installer-serveur.test.ts` (08-03 T2)
- [ ] `tests/dist/cas/version.cas.ts` (08-04 T1), `tests/repo/playwright-config.test.ts` (08-04 T2)
- [ ] `tests/scripts/garde-gel.test.ts` (08-06 T1), `tests/repo/deploy-workflow.test.ts` (08-06 T2)
- [ ] `tests/repo/battement.test.ts` (08-07 T1), `tests/repo/sauvegarde.test.ts` (08-07 T2)

No framework install, no new npm package, no new npm script (tests/repo/scaffold.test.ts unchanged).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram receives DOWN and UP | OPS-01, OPS-02 | Third-party delivery to Erwan's phone | 08-11 T3, 08-15 T3 |
| Erwan approves each deploy | HEB-12 | Human approval is the control | 08-13 T2 and T3 |
| Hetzner automatic backups status | OPS-03 (D-15) | Only visible in Erwan's Hetzner console | 08-11 T1 answer recorded |
| Real-phone load time (optional) | PERF-02 | Real network, Erwan's device | 08-14 T3 |
| Domain purchase and DNS | HEB-01 | Erwan's registrar account | 08-12 T1 |

---

## Live Evidence Checklist (phase gate)

- [ ] 08-09: comparer before/after recreate = 0 different, 0 missing; mounts, env names, log caps
- [ ] 08-10: A1 verdict, retour durations, refusal table, authorized_keys 1 line root-owned
- [ ] 08-11: cron heartbeat lines, disk DOWN/UP on Telegram, archive on the Mac, Hetzner answer
- [ ] 08-12: HTTPS header table, 401 and noindex, version.json, masked log line, reload without restart, comparer with 1 new host
- [ ] 08-13: Environment API output, three approved runs, rollback and roll-forward pass figures (dispatch to served, approval wait excluded) under 120 s, totals recorded
- [ ] 08-14: Playwright measures under 1 000 ms both profiles with no 401 in the measures, Lighthouse figures, publication
- [ ] 08-15: 3 or more failed probes then recovery, certificate and heartbeat DOWN/UP, restore JSON line, RETROSPECTIVE entry

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoints with explicit human evidence
- [x] Sampling continuity: no 3 consecutive auto tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60 s for node tests
