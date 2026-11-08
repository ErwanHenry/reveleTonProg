---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 06
subsystem: ci, deploy, ops, testing
tags: [github-actions, environment, freeze-gate, rollback, probe, healthchecks, ssh-pinned-host, rsync, node-test]

# Dependency graph
requires:
  - phase: 08-02
    provides: forced-command verbs (rsync upload into incoming/<cible>/<sha>/, activer, retour, etat) and their one-line outputs
  - phase: 08-04
    provides: dist/version.json { commit, date } and check-dist VERSION_* rules (commit = GITHUB_SHA, dev refused under RTP_DEPLOIEMENT=1)
  - phase: 01
    provides: src/lib/dates-tours.ts TOURS
provides:
  - scripts/garde-gel.ts (evaluerGel, FENETRES_GEL, dateParis, nettoyerJustification, lireDate; CLI writing ok= to GITHUB_OUTPUT)
  - ci.yml workflow_dispatch inputs retrait_urgence and justification, per-run concurrency group on main
  - ci.yml jobs gel and deploy (dormant until the repository variable DEPLOY_CIBLE is set)
  - .github/workflows/rollback.yml « Retour arrière » (dormant until DEPLOY_CIBLE)
  - .github/workflows/sonde.yml « Sonde externe » (dormant until the repository variable SONDE_URL)
  - tests/repo/deploy-workflow.test.ts (structure and safety of gel, deploy, retour, sonde)
affects: [08-11, 08-12, 08-13, 08-14, 08-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dormant jobs gated by a repository variable in the job-level if (vars.X != ''), so CI stays green before the Environment exists"
    - "Non-secret values (vars, github context) in job-level env; secrets only in step env; nothing interpolated inside run bodies"
    - "Credentials to curl through `curl --config -` fed by a printf builtin, with backslash and quote escaping for the config syntax"
    - "Repo test copies: rollback key step must equal the deploy key step byte for byte, and every ssh line must contain the deploy ssh option prefix"

key-files:
  created:
    - scripts/garde-gel.ts
    - tests/scripts/garde-gel.test.ts
    - tests/repo/deploy-workflow.test.ts
    - .github/workflows/rollback.yml
    - .github/workflows/sonde.yml
  modified:
    - .github/workflows/ci.yml
    - tests/repo/ci.test.ts

key-decisions:
  - "An emergency request always needs a valid justification, even outside a freeze window: a box ticked by mistake fails the gel step (exit 1) instead of passing silently"
  - "Justification sanitised before printing: control characters and line separators become spaces, whitespace collapsed, cut to 300 code points; annotation data escaped (% -> %25) like @actions/core"
  - "--date accepts strict ISO 8601 only and refuses impossible calendar dates (2027-02-30), exit 2"
  - "Deploy job splits activation and verification into two steps (activer, then etat) so the automatic retour also runs when the etat check or the ssh call for it fails after a successful switch"
  - "Deploy job env carries CIBLE, SHA, REPO, DEPLOY_HOST, DEPLOY_USER, DEPLOY_URL (no secret); the key step also refuses an empty DEPLOY_HOST or DEPLOY_USER"
  - "Smoke and rollback HTTPS checks refuse a DEPLOY_URL that is not https://; the probe refuses a SONDE_URL that is not https:// and treats an empty SONDE_PING_URL as a failure"
  - "Rollback freeze refusal is a separate step (if: steps.gel.outputs.ok != 'true') that fails the job with the reason; the gel CLI itself exits 0 for both decisions"
  - "Rollback reads the new current from etat (sed on courant=<40 hex>), checks it equals the requested version when one is given, and compares /version.json with it only when cible equals DEPLOY_CIBLE (DEPLOY_URL names that target)"
  - "Probe uses curl without -f and -w '%{http_code}' to report the HTTP status in the failure reason, with --retry 2 --retry-all-errors for network blips; success ping is the last command"

patterns-established:
  - "Workflow comment above every dormant job names the variable that wakes it and who sets it (08-13 for DEPLOY_CIBLE, 08-11 for SONDE_URL)"

requirements-completed: [HEB-02, HEB-10, HEB-11, HEB-12, HEB-13, HEB-14, OPS-01]

# Metrics
duration: 25min
completed: 2026-11-08
---

# Phase 8 Plan 06: Deploy, rollback and probe workflows (dormant) with the freeze gate Summary

**ci.yml now ends with a `gel` job (Paris-dated freeze windows from TOURS, emergency path with a written justification) and a `deploy` job behind the `production` Environment. The deploy job rebuilds with RTP_DEPLOIEMENT=1 for production, refuses a stale approval, pushes with rsync over a pinned host key, switches through the forced command, smoke-tests over HTTPS and rolls back on its own. `rollback.yml` and `sonde.yml` complete the set. All of them stay skipped until Erwan sets DEPLOY_CIBLE / SONDE_URL, and CI is green with both new jobs shown as skipped.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-08T21:22:44Z
- **Completed:** 2026-11-08T21:47:00Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `scripts/garde-gel.ts`: `FENETRES_GEL` = 2027-04-17..19 (tour 1) and 2027-05-01..03 (tour 2), derived from TOURS. `dateParis` uses `Intl.DateTimeFormat` with `timeZone: 'Europe/Paris'`. `evaluerGel(instant, urgence, justification)` returns `{ ok, gele, urgence, tour, date, motif }`. The CLI appends `ok=` to GITHUB_OUTPUT and a French summary to GITHUB_STEP_SUMMARY. It prints `::warning::` on a freeze refusal and `::notice::` with the justification when the emergency path is used, then exits 0. It exits 1 with `::error::` for an emergency without a valid justification, and 2 on a usage error.
- `ci.yml`:
  - `workflow_dispatch` with `retrait_urgence` (boolean) and `justification` (string).
  - The concurrency group is `ci-${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}`. `cancel-in-progress` is unchanged.
  - `gel` runs on push or dispatch, on main, and only when `vars.DEPLOY_CIBLE != ''`.
  - `deploy` has `needs: [verifier, e2e, secrets, gel]`, `if: needs.gel.outputs.ok == 'true'`, `environment: production` and the job concurrency `deploy-production` without cancel.
  - The steps run in this order: checkout, node, npm ci, audit signatures, target and head-of-main check, build and check-dist (both with `RTP_DEPLOIEMENT: ${{ vars.DEPLOY_CIBLE == 'production' && '1' || '0' }}`), key and known_hosts under umask 077, `rsync -rlt --chmod=D755,F644 --stats` to `$CIBLE/$SHA/`, `activer`, `etat` (courant must equal the SHA), HTTPS smoke (version.json commit, HSTS, CSP), automatic `retour` (`if: failure() && steps.activer.outcome == 'success'`), cleanup `always()`.
  - The three existing jobs are untouched.
- `rollback.yml` « Retour arrière » takes the dispatch inputs `cible` (choice), `version`, `retrait_urgence` and `justification`. It runs in Environment production with group deploy-production and a 5 min timeout. Steps: UTC start time, checkout, node, gel, refusal step, input check (`[[ "$VERSION" =~ ^[0-9a-f]{40}$ ]]`), key, `retour $CIBLE [$VERSION]`, etat, HTTPS check of the new current, a timed summary (`always()`) and cleanup.
- `sonde.yml` « Sonde externe » runs on `*/10 * * * *` and on dispatch, in Environment sonde with group sonde (cancel), without a checkout and in a single step. It requires `/` to return 200 with the marker `reveleTonProg`, then `/version.json` to return 200 with a `.commit` of 7 to 40 hex. Only after both checks does it ping `$SONDE_PING_URL`. On a failure it posts the reason to `$SONDE_PING_URL/log`, prints `::error::` and exits 1. The file never contains the immediate-failure endpoint.

## Task Commits

1. **Task 1: freeze gate script**: `fe9c6a2` (test, RED: module missing), then `41e987d` (feat, GREEN: 26/26)
2. **Task 2: gel and deploy jobs, per-run concurrency**: `7e5b95d` (test, RED: 7 failing), then `37a9ec7` (feat, GREEN: 64/64 with scaffold)
3. **Task 3: rollback.yml and sonde.yml**: `f62652e` (test, RED: 20 failing), then `bbfe279` (feat, GREEN: 81/81)

## Verification

- Task 1 verify: `TZ=Europe/Paris fnm exec --using=24 node --test tests/scripts/garde-gel.test.ts` gave 26 pass. The child processes ran under TZ=UTC and TZ=Pacific/Auckland and gave the same decisions.
- Task 1 acceptance: `node scripts/garde-gel.ts --urgence '' --justification '' --date 2027-04-18T12:00:00+02:00` printed `::warning::Garde de gel : 2027-04-18 tombe dans le gel du tour 1 (du 2027-04-17 au 2027-04-19, heure de Paris) : déploiement refusé. …` and exited 0 without GITHUB_OUTPUT.
- Task 2 verify: `node --test tests/repo/ci.test.ts tests/repo/deploy-workflow.test.ts tests/repo/scaffold.test.ts` gave 64 pass. `grep -c "pull_request_target\|ssh-keyscan\|StrictHostKeyChecking=no" .github/workflows/ci.yml` = 0.
- Task 3 verify: `node --test tests/repo/deploy-workflow.test.ts tests/repo/ci.test.ts` gave 81 pass. In sonde.yml, `grep -c "/fail"` = 0 and `grep -c "environment: production\|name: production"` = 0.
- Every `run:` body of the three workflows passes `bash -n` (macOS bash 3.2). actionlint and shellcheck are not installed locally, and GitHub accepted the three files (no workflow file error).
- Full `TZ=Europe/Paris fnm exec --using=24 npm test`: 2133 tests, 2129 pass, 0 fail, 4 skipped (shellcheck absent on the Mac).
- `fnm exec --using=24 npm run check`: 0 errors, 0 warnings, 0 hints.
- CI run 42525804302 on main (commit bbfe279) succeeded:
  - Vérifier: success (Linux: 2133 tests, 2132 pass, 1 skipped)
  - Tests navigateur: success
  - Chercher des secrets: success
  - Garde de gel des scrutins: **skipped**
  - Déployer: **skipped**
- `gh workflow list` shows « Retour arrière » and « Sonde externe » as active. The repository had no Environment and no variable before the push. Nothing was created by this plan.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Activation and etat check split into two steps**
- **Found during:** Task 2
- **Issue:** the plan put `activer` and the `etat` check in one step with id `activer`. With the automatic rollback gated on `steps.activer.outcome == 'success'`, a failure of the etat call or check after a successful switch would mark `activer` as failed, so no rollback would run while current already pointed to the new release.
- **Fix:** step `activer` runs only `activer $CIBLE $SHA`. The next step runs `etat $CIBLE` and checks `courant=$SHA`. The repo test pins the order and the rollback condition.
- **Files modified:** .github/workflows/ci.yml, tests/repo/deploy-workflow.test.ts
- **Commit:** 37a9ec7

**2. [Rule 1 - Bug] YAML plain scalar with « : » in rollback.yml**
- **Found during:** Task 3
- **Issue:** `run: echo "- Retour arrière : début …"` is not valid YAML (nested mapping in a compact mapping).
- **Fix:** block scalars (`run: |`) for the two timing steps.
- **Commit:** bbfe279

**3. [Rule 3 - Blocking] Step name tripped the ssh-keyscan acceptance grep**
- **Found during:** Task 2
- **Issue:** the key step name said « jamais ssh-keyscan », which the zero-count grep and the repo test refuse.
- **Fix:** the name says « jamais de scan de clé d'hôte ».
- **Commit:** 37a9ec7

### Additions within scope (Rule 2)

- The key step refuses an empty DEPLOY_HOST or DEPLOY_USER, as well as an empty key or known_hosts.
- https-only check for DEPLOY_URL (smoke, rollback) and SONDE_URL (probe). The probe treats an empty SONDE_PING_URL as a failure.
- The curl config escapes backslashes and double quotes in user and password, so a password with `"` still works and cannot add a config line.
- The repo test checks that no IPv4 address and no URL other than `https://github.com/` appears in the deploy job. It also checks that every action pin in rollback.yml and sonde.yml equals one already in ci.yml.

## Issues Encountered

- actionlint and shellcheck are not installed on the Mac. Shell syntax was checked with `bash -n`. GitHub itself parsed the three workflow files without error at the push.

## Known Stubs

None. The jobs are dormant by design, not stubbed: they wake when Erwan creates the Environments and sets DEPLOY_CIBLE (08-13) and SONDE_URL (08-11).

## Threat Flags

None beyond the plan's threat register: T-08-28 to T-08-36 are all mitigated and pinned by tests/repo/deploy-workflow.test.ts and tests/scripts/garde-gel.test.ts.

## Next Phase Readiness

- 08-11: create the Environment `sonde` (branch main, no reviewer) with the secrets SONDE_USER, SONDE_PASS and SONDE_PING_URL, then set the repository variable SONDE_URL to the essai origin. Set the Healthchecks check `sonde-externe` to a 10 min period and 20 min grace.
- 08-13: create the Environment `production` (Erwan as the only reviewer, prevent self-review off, deployment branch main). Add the variables DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS (the pinned `known_hosts` line) and DEPLOY_URL, and the secrets DEPLOY_SSH_KEY, DEPLOY_SMOKE_USER and DEPLOY_SMOKE_PASS. Then set the repository variable DEPLOY_CIBLE=essai. The first run will show whether a job waiting for approval holds the deploy-production slot (Pitfall 4, observed there).
- 08-14 / D-10: run a timed rollback with « Retour arrière » (version empty). The summary gives the UTC start and end times.

## Self-Check: PASSED

- FOUND: scripts/garde-gel.ts, tests/scripts/garde-gel.test.ts, tests/repo/deploy-workflow.test.ts, .github/workflows/rollback.yml, .github/workflows/sonde.yml
- FOUND commits: fe9c6a2, 41e987d, 7e5b95d, 37a9ec7, f62652e, bbfe279
