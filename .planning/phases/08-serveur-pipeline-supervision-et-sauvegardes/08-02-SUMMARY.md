---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 02
subsystem: deploy, caddy, ops, testing
tags: [ssh-forced-command, rrsync, atomic-switch, rollback, flock, caddy-validate, docker, http-snapshot, node-test, bash]

# Dependency graph
requires:
  - phase: 08-01
    provides: HASH_FACTICE (scripts/render-caddy.ts), FICHIER_SITES_D_ESSAI name reveletonprog-essai.caddy, .gitattributes LF rule for ops/*.sh
  - phase: 06
    provides: ops/diagnostic-vps.sh and its read-only static test conventions
provides:
  - ops/commande-deploiement.sh, forced command installed as /usr/local/sbin/rtp-deploy-command (verbs rsync upload, activer, retour, etat; exit codes 0/64/65/66/75/1; one-line outputs)
  - ops/valider-caddy.sh, read-only throwaway caddy validate (same image id, --network none --read-only, tmpfs, :ro mounts; RTP_BLOC_B64, RTP_AJOUTER_IMPORT, RTP_AVEC_SANS_VARIABLES)
  - ops/verifier-sites.sh, per-site HTTP snapshot (sha256 prefix of the host, code) and comparer (exit 1 on a changed code or a missing host)
  - tests/repo/commande-deploiement.test.ts and tests/repo/verifications-caddy.test.ts (stub-driven, run inside npm test)
affects: [08-03, 08-06, 08-09, 08-10, 08-12, 08-13, 08-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bash ops scripts tested by node:test through spawnSync with PATH stubs (df, logger, rrsync, docker, curl; flock and mv -> gmv on darwin only)"
    - "Read-only scripts guarded by a static test on comment-stripped code: forbidden verbs and a redirection matcher that allows only /dev/null or the script's own mktemp folder"
    - "Darwin-only skips for GNU-only behaviour, with the Linux CI log as the authority (0 dispatcher skip there)"

key-files:
  created:
    - ops/commande-deploiement.sh
    - ops/valider-caddy.sh
    - ops/verifier-sites.sh
    - tests/repo/commande-deploiement.test.ts
    - tests/repo/verifications-caddy.test.ts
  modified: []

key-decisions:
  - "Lock through an fd (exec 9>>$BASE/.verrou; flock -w 20 9) instead of a re-exec with a marker variable: bash 3.2 safe and no env marker that could skip the lock"
  - "Validation happens before any side effect: a refused command writes nothing (no .verrou, no incoming/), which the malicious-command table asserts"
  - "rsync upload: besides the destination regex, t[1] must be --server, the source must be '.', every middle token must be a slash-free option, and --sender, --delete*, --remove*, --del are refused before rrsync (defence in depth on top of rrsync -wo -no-del)"
  - "activer of a release that already exists discards the incoming copy and only switches if it is not current (re-activating an older sha after a retour is allowed); no history line when nothing changes"
  - "Missing upload, missing index.html, missing or unreadable version.json, or a commit mismatch all exit 65; symlinked index.html/version.json/upload folder are refused too"
  - "The current-is-a-real-directory case is left to mv -T (no early check), so the test proves the fail-closed rename; the release folder may remain in releases/ but current, history and rotation are untouched"
  - "Rotation keeps the newest 5 distinct shas of the history whose folder exists, plus current and previous; only 40-hex names are ever removed"
  - "Stale incoming cleanup (find -mindepth 2 -maxdepth 2 -mtime +0) runs at every valid call and skips the upload being activated"
  - "valider-caddy builds the fake bcrypt string the same way as render-caddy HASH_FACTICE (prefix padded with dots to 60), so no 60-char literal is committed; the test compares with the TS constant"
  - "valider-caddy mounts an empty mktemp sites.d when the live one does not exist yet: docker -v would otherwise create the host folder as root"
  - "verifier-sites counts http://-only, ported, wildcard and non-hostname addresses as ignorés; a hostname-free placeholder like {$VAR} is also ignored; the opening brace is detected as a standalone token so placeholders in addresses do not hide a site"
  - "verifier-sites takes its mode as a positional argument (default instantane), not an RTP_MODE variable, because RTP_MODE is a name the deploy job must never carry (D-11)"

patterns-established:
  - "Forced-command contract: charset gate ^[A-Za-z0-9 ._/=,+-]+$, read -r -a tokens, case on verb, per-token regex, fixed-argv exec, one JSON line through logger -t rtp-deploy"

requirements-completed: [HEB-01, HEB-02, HEB-10, HEB-11]

# Metrics
duration: 20min
completed: 2026-11-08
---

# Phase 8 Plan 02: Forced-command deploy dispatcher and read-only Caddy checks Summary

**One SSH forced command that only accepts four verbs (rrsync upload into incoming/, verified activation with an ln -s + mv -T switch and rotation to 5, history-driven toggling retour, etat), plus a throwaway `caddy validate` with no network and a per-site HTTP snapshot that never prints a host name.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-08T19:24:00Z (approximate)
- **Completed:** 2026-11-08T19:44:00Z
- **Tasks:** 2
- **Files modified:** 5 (5 created)

## Accomplishments

- `ops/commande-deploiement.sh` (309 lines): charset gate, `read -r -a` tokenization, `case` on the verb, exit 64 for anything else. Upload: `rsync --server <options> . <essai|production>/<40hex>/` -> disk guard (`df -Pm`, free >= 1024 MiB and use < 92 %, else 75) -> `mkdir -p incoming/<cible>` -> `exec "$RRSYNC" -wo -no-del "$BASE/incoming"`. `activer`: index.html and `jq -e '.commit == $s'` checks (65), `mv -T` into `releases/<sha>`, `ln -s releases/<sha> .current.tmp && mv -T .current.tmp current`, `.historique` line, rotation, `active cible=… courant=… versions=…`. `retour`: previous distinct sha of the history whose folder exists, or an explicit present sha (66 otherwise), so a second `retour` toggles forward. `etat`: `etat cible=… courant=<sha|aucun> versions=<n> libre_mio=<n>`. flock -w 20 around activer and retour; one JSON line per call through `logger -t rtp-deploy` (T-08-07 to T-08-11).
- `ops/valider-caddy.sh`: image id from `docker inspect caddy --format '{{.Image}}'`, `docker run --rm --network none --read-only` with tmpfs on /tmp, /data, /config, /var/log/caddy and both mounts `:ro`; candidate block from `RTP_BLOC_B64` (written as `reveletonprog-essai.caddy` in a mktemp sites.d), `RTP_AJOUTER_IMPORT=1` validates a mktemp copy ending with `import /etc/caddy/sites.d/*.caddy`, `RTP_AVEC_SANS_VARIABLES=1` runs with and without the hash variables; prints `caddy <version>` and one `validation <avec|sans> variables : valide|invalide` line per run, Caddy output filtered to verdict and errors; trap removes the mktemp folder (T-08-12).
- `ops/verifier-sites.sh`: `instantane` parses the Caddyfile and `sites.d/*.caddy` (snippets, comments, import lines skipped; continuation after a trailing comma), curls each host through `--resolve <host>:443:127.0.0.1`, prints `<12 hex of sha256(host)>\t<code>` sorted and `N sites, M joignables (2xx, 3xx, 401), K ignorés` on stderr; `comparer` prints `identiques N, differents M, nouveaux P, disparus Q`, exits 1 on M or Q (T-08-13).

## Task Commits

1. **Task 1: forced-command dispatcher** - `042c637` (test, RED: script missing) then `a92af3f` (feat, GREEN: 67/67 locally, shellcheck skipped)
2. **Task 2: throwaway validate and per-site snapshot** - `e147b70` (test, RED: 22/22 failing) then `0c1dce3` (feat, GREEN: 27/27 locally, 2 shellcheck skips)
3. **Type fix for astro check** - `e3de6fa` (fix: noUncheckedIndexedAccess in the two new tests)

## Files Created/Modified

- `ops/commande-deploiement.sh` - forced command (mode 100755)
- `ops/valider-caddy.sh` - throwaway caddy validate (mode 100755)
- `ops/verifier-sites.sh` - per-site snapshot and comparison (mode 100755)
- `tests/repo/commande-deploiement.test.ts` - 37-line malicious-command table, upload, disk guard bounds, activer, idempotence, rotation, mv -T fail-closed, retour toggle, etat, stale cleanup, static checks, bash -n, shellcheck
- `tests/repo/verifications-caddy.test.ts` - static read-only checks of both scripts, docker stub runs (two runs, no `-e RTP_ESSAI_HASH` on the second, candidate block, import copy with the live file byte-identical, temp folder gone, absent sites.d not created, 7 refusal cases with exit 2), curl stub snapshot with synthetic `*.exemple.test` hosts, comparer cases

## Verification

- Task 1 verify: `TZ=Europe/Paris fnm exec --using=24 node --test tests/repo/commande-deploiement.test.ts && bash -n ops/commande-deploiement.sh` -> 67 pass, 1 skip (shellcheck absent on the Mac; gmv present so no switch case skipped)
- Task 2 verify: `node --test tests/repo/verifications-caddy.test.ts && bash -n` both scripts -> 27 pass, 2 skips (shellcheck absent)
- Tests ran under macOS `/bin/bash` 3.2.57 (bash 3.2 compatibility confirmed)
- Acceptance greps: forbidden `eval|bash -c|sudo|docker|ln -sfn` in uncommented dispatcher code = 0 (1 with comments, so the filter works); `-wo -no-del` = 2; `mv -T` = 3; state-changing docker verbs or `caddy reload` in valider-caddy = 0; `--network none` = 2; dispatcher 309 lines (>= 120)
- Full `fnm exec --using=24 npm test`: 1973 tests, 1970 pass, 0 fail, 3 skipped (shellcheck)
- `npm run check`: 0 errors, 0 warnings, 0 hints (after `e3de6fa`)
- CI run 42515880360 on main (commit e3de6fa): success. Vérifier, Tests navigateur, gitleaks all green. Linux log: 1973 tests, 1972 pass, 1 skipped (an unrelated PDF capture case), the three shellcheck cases ran and passed, no dispatcher case skipped. gitleaks flagged nothing (no fake secret literal committed).

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Redirection matcher in the new static test captured a trailing `;`**
- **Found during:** Task 2
- **Issue:** the matcher copied from diagnostic-vps.test.ts read `>>"$DOSSIER/Caddyfile"; fi` as target `"$DOSSIER/Caddyfile";` and flagged an allowed write.
- **Fix:** the target class excludes `;` (`[^\s&|);]+`) in tests/repo/verifications-caddy.test.ts only.
- **Commit:** 0c1dce3

**2. [Rule 1 - Bug] Usage text tripped the read-only redirection check**
- **Found during:** Task 2
- **Issue:** the verifier-sites usage message `comparer <avant> <apres>` contained `>` and matched as a redirection.
- **Fix:** usage text reads `comparer AVANT APRES`.
- **Commit:** 0c1dce3

**3. [Rule 3 - Blocking] astro check failed on the new tests (noUncheckedIndexedAccess)**
- **Found during:** final `npm run check`
- **Issue:** 18 `possibly undefined` index accesses in the two new test files.
- **Fix:** a `defini()` helper and named tuples; no behaviour change.
- **Files modified:** tests/repo/commande-deploiement.test.ts, tests/repo/verifications-caddy.test.ts
- **Commit:** e3de6fa

### Additions within scope (Rule 2)

- Dispatcher refuses symlinked upload folder, index.html and version.json, and an unreadable version.json (65); refuses a missing upload (65). The test table adds tabs, `--delete`, an option carrying a path, a non-`.` source, an extra argument after the destination, `rsync` without `--server`, uppercase verb, and the "key used with no command" case.
- valider-caddy refuses relative paths, values other than 0/1, an invalid container name and an unexpected image id format (exit 2), and never lets `docker -v` create a missing sites.d on the host.
- Plan said "nothing written" for refusals; the script also performs all validation before taking the lock, so no `.verrou` appears on a refusal.

## Issues Encountered

- shellcheck is not installed on the Mac; the cases skip locally and ran (and passed) on the ubuntu-24.04 CI runner.

## Known Stubs

None.

## Next Phase Readiness

- 08-03 installs `ops/commande-deploiement.sh` as `/usr/local/sbin/rtp-deploy-command` (root:root 0755) with the `restrict,command=` line; `/srv/reveletonprog` must be owned by `deploy` for `.verrou`, `incoming/` and `essai/` to be writable.
- 08-06 workflows parse the one-line outputs and exit codes listed in the script header; upload with `rsync -rlt --chmod=D755,F644` to `<cible>/<sha>/` (no `--delete`).
- 08-09 runs `ssh <hôte> 'bash -s -- instantane' < ops/verifier-sites.sh` before and after the recreate and `ssh <hôte> 'RTP_AJOUTER_IMPORT=1 RTP_AVEC_SANS_VARIABLES=1 bash -s' < ops/valider-caddy.sh` before writing the import line; the rrsync option string accepted by the real rrsync still has to be proven with a dry run (08-RESEARCH T-rrsync).

## Self-Check: PASSED

- FOUND: ops/commande-deploiement.sh, ops/valider-caddy.sh, ops/verifier-sites.sh (all 100755), tests/repo/commande-deploiement.test.ts, tests/repo/verifications-caddy.test.ts
- FOUND commits: 042c637, a92af3f, e147b70, 0c1dce3, e3de6fa
