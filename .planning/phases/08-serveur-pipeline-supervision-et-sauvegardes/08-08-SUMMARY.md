---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 08
subsystem: docs, ops
tags: [runbook, adr, readme, secrets, rollback, freeze, healthchecks, restore, node-test]
# Dependency graph
requires:
  - phase: 08-01..08-07
    provides: render-caddy essai block, forced-command dispatcher, installer, version.json, workflows gel/deploy/rollback/sonde, heartbeat, backup and restore scripts
  - phase: 08-09
    provides: live facts (Caddy 2.11.2, override and sites.d import, recreate of 2026-11-09 with all other sites identical)
  - phase: 08-10
    provides: deploy user with root-owned authorized_keys, loopback proof (switches 288 and 329 ms), keys under ~/.config/rtp/
provides:
  - RUNBOOK sections Déploiement, Retour arrière, Gel des scrutins et retrait d'urgence, Hôte technique (essai), Serveur installer et vérifier, Environments GitHub, Bloc Caddy (Phase 8) with live facts, Restauration, Monitoring, monthly review step
  - ADR-054, ADR-055, ADR-057, ADR-058 in docs/ARCHITECTURE.md
  - README « Où sont les secrets » for Phase 8 (names and locations, no value)
  - tests/repo/docs.test.ts pins (sectionRunbook helper, 14 new cases)
affects: [08-11, 08-12, 08-13, 08-14, 08-15, 09]
# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RUNBOOK sections pinned by a sectionRunbook(titre) helper: needles and the no em/en dash rule checked on the section body only"
key-files:
  created: []
  modified:
    - docs/RUNBOOK.md
    - docs/ARCHITECTURE.md
    - README.md
    - tests/repo/docs.test.ts
key-decisions:
  - "The incident fallback (root ssh, runuser -u deploy, same dispatcher) bypasses both approval and freeze gate; the RUNBOOK limits it to GitHub being unavailable and requires a dated issue afterwards"
  - "Legal step 9 (upload-artifact under contents: read, hypothesis A4) is marked confirmed: site-preview is uploaded on every main run (artifact of run 42525804302 checked through the API)"
  - "Manual version check uses printf | curl --config - so the sonde password never enters argv"
  - "Monitoring table gives, per Healthchecks check, period, grace, meaning and the first command to run; simulated alerts are flagged as approval-worthy because they send real Telegram alerts"
  - "The Phase 7 negative pin on ADR-054/055/057/058 became positive pins plus a numeric-order check around ADR-056"
patterns-established:
  - "Server procedures in the RUNBOOK use the ssh alias keel-vps and placeholders essai.<domaine>, never an IP, another site name or a value"
requirements-completed: [HEB-01, HEB-02, HEB-10, HEB-11, HEB-12, HEB-13, HEB-14, OPS-01, OPS-02, OPS-03]
# Metrics
duration: 40min
completed: 2026-11-09
---

# Phase 8 Plan 08: RUNBOOK, ADR and README for the delivery chain Summary

**The RUNBOOK now documents every Phase 8 operation with the exact commands of the scripts and workflows: push to approved deploy, rollback (with the root fallback that needs no GitHub), freeze and emergency removal, the technical host, the installer and the 9-step recreate procedure, the GitHub Environments, the live Caddy facts, the configuration archive and monthly restore, and the Healthchecks/Telegram supervision. ARCHITECTURE records ADR-054, 055, 057 and 058, and the README says where each Phase 8 secret lives without any value.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-09T19:15:00Z (approximate)
- **Completed:** 2026-11-09T20:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `docs/RUNBOOK.md`
  - `## Déploiement` replaces « (lot 3, à venir) » and the obsolete `rsync -az --delete` line. It describes the nine steps of the chain from ci.yml (gel, approval, head-of-main check, rebuild, check-dist, rsync into `incoming/`, `activer` + `etat`, HTTPS smoke, automatic `retour`), the essai/production `RTP_DEPLOIEMENT` rule, `gh workflow run ci.yml --ref main`, and the rule to approve or reject a waiting run at once. The legal steps list is kept; step 9 is marked confirmed.
  - `### Retour arrière` gives `gh workflow run rollback.yml -f cible=essai` (and `-f version=<sha>`), the toggle behaviour, code 66, the under-2-minutes target with the approval wait counted apart (loopback switches 288 and 329 ms from 08-10), a password-safe `/version.json` check, « rejeter ou approuver d'abord le déploiement en attente », and the incident fallback `ssh keel-vps 'SSH_ORIGINAL_COMMAND="retour essai" runuser -u deploy -- /usr/local/sbin/rtp-deploy-command'` with the instruction to record it in a dated issue.
  - `### Gel des scrutins et retrait d'urgence`: Paris windows from TOURS, dispatch with `-f retrait_urgence=true -f justification="…"` (20 characters minimum, sanitised, 300 max, kept in the run summary), applies to rollbacks, ticked box without justification fails, dry check command.
  - `### Hôte technique (essai)`: users essai and sonde, hashes in `/opt/vaultwarden/.env`, password rotation needs env-caddy plus a recreate, noindex and closed robots.txt, removal in Phase 9, and the Phase 9 point on the Mentions légales sentence « aucun serveur de l'éditeur ne reçoit vos visites ».
  - `### Serveur : installer et vérifier`: D-01 rule (agents never write to the server), ephemeral-copy `--verifier`, staging in `/opt/rtp/depot`, apply examples with stdin, step order and exit codes, valider-caddy and verifier-sites usage, dispatcher verb/exit-code table, the 9-step recreate procedure and the `-f docker-compose.yml` warning.
  - `### Environments GitHub`: production (Erwan only, prevent self-review off, main only) and sonde, variable and secret names, `DEPLOY_CIBLE`, `SONDE_URL`, `gh secret set … < file`, read-only API checks.
  - `### Bloc Caddy (Phase 8)`: the Phase 7 hypotheses are replaced by the facts of 08-09 (Caddy 2.11.2, override, sites.d import, inode rule, validate then reload and never restart, empty-variable hazard and `HASH_FACTICE`, relative `current`, DNS before import, rotation touched by probe and heartbeat instead of Uptime Kuma). The error-stream caveat is kept and marked as a Phase 9 legal point.
  - `## Restauration`: Git for content; the daily archive, pulled to `~/Sauvegardes/reveletonprog/`; Vaultwarden for the two secret files; the `rtp-tester-restauration` command; restoring a single file in place; the Hetzner answer pointing to 08-11; and rebuilding the server from the repo in 8 ordered steps.
  - `## Monitoring`: a table of the six checks (fed by, period, grace, meaning, first command), the Telegram integration, simulated alerts with RTP_SEUIL1, RTP_SEUIL2 and RTP_CERT_JOURS, the 60-day schedule pause and the `gh workflow enable sonde.yml` fix, and pre-DNS versus post-DNS behaviour.
  - Revue mensuelle gains « lancer rtp-tester-restauration et noter le résultat dans RETROSPECTIVE.md ». The Accès line and the « mesure publiée sans source » incident now point to the new sections.
- `docs/ARCHITECTURE.md`:
  - ADR-054: releases plus an atomic `mv -T` switch, with no `git revert` for content because of ids.lock.
  - ADR-055: the deploy job behind the production Environment. The essai target is built without RTP_DEPLOIEMENT (D-07 revised) and no SITE_VIDE guard is added.
  - ADR-057: Caddy is applied outside CI through override, sites.d and validate then reload. The long-cache clause is vacuous and guarded by TYPE_FICHIER_INATTENDU.
  - ADR-058: Healthchecks plus a GitHub-scheduled probe instead of a prober on the 4 GB shared VPS, plus what is backed up and why, and the monthly restore.
  - The ADRs follow the numeric order around ADR-056.
- `README.md`: « Où sont les secrets » covers the production and sonde Environments (secrets versus non-secret variables), the three root-only server files, Vaultwarden and the `~/.config/rtp/` working copies. It contains no value.

## Task Commits

1. **Task 1: RUNBOOK procedures**: `84fc942` (test, RED: 10 of 11 new cases failing), then `f6976a3` (docs, GREEN: 54/54)
2. **Task 2: ADR and README**: `cf222b5` (test, RED: 3 failing), then `208d059` (docs, GREEN: 57/57)

## Verification

- Task 1 verify: `TZ=Europe/Paris fnm exec --using=24 node --test tests/repo/docs.test.ts` gave 54 pass, 0 fail. Acceptance: `grep -c "Uptime Kuma" docs/RUNBOOK.md` = 0, `grep -c "rsync -az --delete" docs/RUNBOOK.md` = 0, `grep -c "rollback.yml" docs/RUNBOOK.md` = 5.
- Task 2 verify: docs.test gave 57 pass, then the full `TZ=Europe/Paris fnm exec --using=24 npm test` gave 2214 tests, 2206 pass, 0 fail, 8 skipped (shellcheck and the Linux-only cases on the Mac). Acceptance: `grep -cE "^### ADR-05[4578] : " docs/ARCHITECTURE.md` = 4.
- `fnm exec --using=24 npm run check`: 0 errors, 0 warnings, 0 hints.
- Added lines contain no em dash, no en dash, no forbidden word, no IPv4 address and no URL other than placeholders (`essai.<domaine>`), checked by grep on the diff.
- CI run 42687612259 on main (commit 208d059) succeeded:
  - Vérifier: success. The Linux log shows 2214 tests, 2213 pass and 1 skipped.
  - Tests navigateur: success.
  - Chercher des secrets: success.
  - Garde de gel and Déployer: skipped (dormant, DEPLOY_CIBLE not set).

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Adjustments within scope

**1. [Rule 2 - Correctness] Stale pointers outside the listed sections**
- **Found during:** Task 1
- **Issue:** the Accès section still said the deploy key would live in « GitHub Secrets (lot 3) », and the « Une mesure publiée sans source » incident did not mention the freeze.
- **Fix:** one-line updates pointing to « Environments GitHub » and « Gel des scrutins et retrait d'urgence ». Nothing else outside the listed sections was rewritten.
- **Commit:** f6976a3

**2. Legal step 9 updated to « confirmed »**
- The plan allowed it only if a CI run confirmed upload-artifact under `contents: read`. The `site-preview` artifact of run 42525804302 (08-06), and every main run since Phase 5, confirm it. The artifact was checked through the API.

**3. Phase 7 test renamed**
- The negative pin « ADR-053 et ADR-056 seulement » kept its two positive assertions under a new title. The new Phase 8 block carries the four positive pins plus a numeric-order check.

### Facts reflected from the server plans (not in the plan text)

- The keys and host pin live in `~/.config/rtp/` (08-10 deviation). The RUNBOOK uses `~/.config/rtp/rtp-deploy-github`.
- The recreate procedure records the 2026-11-09 run (ready in under 2 s, every other site identical) without counting or naming the other sites.
- Agents never write to the VPS. Writes run from the main session with Erwan's approval, as stated in the D-01 paragraph.

## Issues Encountered

None.

## Known Stubs

- The Hetzner automatic backups answer is a pointer to the 08-11 summary, which does not exist yet. 08-11 records it.
- The end-to-end GitHub rollback timing is a pointer to 08-13. The RUNBOOK gives the 08-10 loopback figures in the meantime.

## Next Phase Readiness

- 08-11, 08-13 and 08-15 can follow the RUNBOOK commands as written. If a run reveals a different command or flag, update the matching section and its needle in docs.test.ts.
- Phase 9: the RUNBOOK flags two legal points, the Mentions légales sentence on the essai host and the container error stream.

## Self-Check: PASSED

- FOUND: docs/RUNBOOK.md, docs/ARCHITECTURE.md, README.md, tests/repo/docs.test.ts
- FOUND commits: 84fc942, f6976a3, cf222b5, 208d059
