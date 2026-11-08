---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 07
subsystem: ops, supervision, backup, testing
tags: [heartbeat, healthchecks, disk-threshold, certificate-checkend, tar-archive, sha256-manifest, restore-test, node-test, bash]

# Dependency graph
requires:
  - phase: 08-02
    provides: ops/valider-caddy.sh (RTP_CADDYFILE, RTP_SITES_D, RTP_AVEC_SANS_VARIABLES), the PATH-stub test pattern for bash ops scripts
  - phase: 08-03
    provides: ops/installer-serveur.sh (--verifier, --racine, --source, steps battement and sauvegarde waiting for this plan's scripts), /etc/rtp/battement.env and restauration.env written from stdin, cron files rtp-battement, rtp-sauvegarde, rtp-restauration
provides:
  - ops/battement.sh, installed as /usr/local/sbin/rtp-battement (checks vps-battement, vps-disque-85, vps-disque-92, vps-certificat; exit codes 0/1/2; RTP_SEUIL1, RTP_SEUIL2, RTP_CERT_JOURS, RTP_HC_SIMULATION)
  - ops/sauvegarder-config.sh, installed as /usr/local/sbin/rtp-sauvegarder (<destination>/<AAAA-MM-JJ>.tar.gz, 0600 in 0700, MANIFESTE.txt, liens.txt, 6 kept; exit codes 0/1/2)
  - ops/tester-restauration.sh, installed as /usr/local/sbin/rtp-tester-restauration (archive, hachages, comparaison, installateur, caddy, ping; exit codes 0/1/2)
  - tests/repo/battement.test.ts and tests/repo/sauvegarde.test.ts (run inside npm test)
affects: [08-11, 08-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root env files parsed line by line for known keys (printf -v), never sourced: a password with $ or a space cannot run code"
    - "Ops scripts log to journald through the cron pipe; they call logger themselves only when stdout is a terminal, so each run gives exactly one journal entry"
    - "End-to-end restore test: the real installer builds a fake server, the real backup script archives it, the real restore script reinstalls-checks it with the real installer and valider-caddy"
    - "Temp folders created with mktemp -d \"${TMPDIR:-/tmp}/...\" because macOS mktemp -d ignores TMPDIR, so tests can prove cleanup"

key-files:
  created:
    - ops/battement.sh
    - ops/sauvegarder-config.sh
    - ops/tester-restauration.sh
    - tests/repo/battement.test.ts
    - tests/repo/sauvegarde.test.ts
  modified: []

key-decisions:
  - "battement.env is read line by line (known keys only, one pair of surrounding quotes stripped) instead of sourced; the process environment cannot override HC_*, RTP_HOTE, RTP_SONDE_* or RTP_DISQUES, only the thresholds, RTP_BASE, RTP_ENV, RTP_CONTENEUR and the simulation flag"
  - "Exit codes of the heartbeat: 0 whatever the site health (health goes through the pings), 1 when a ping could not be sent, 2 for a refused configuration (missing file, group or world readable on Linux, missing or non-https HC_*, bad threshold)"
  - "Heartbeat commit check needs 40 hex characters, both on disk (before DNS) and over HTTPS (after), the same rule as check-dist; an unreadable df marks both disk checks /fail"
  - "Simulation (RTP_HC_SIMULATION=1) sends no ping but still runs the local checks; it prints the four signal lines then the JSON line, and never writes to journald"
  - "The backup requires the Caddyfile and docker-compose.yml (exit 1 otherwise); every other path is optional and listed as « absent <chemin> »; '*_key' is excluded both from the file list and from tar, on top of the .pub-only glob"
  - "Default --destination is <racine>/root/rtp-sauvegardes and default --source is <racine>/opt/rtp/depot, so --racine alone points everything at a test tree; RTP_DATE overrides the UTC day for tests"
  - "The restore test validates Caddy with and without the hash variables (RTP_AVEC_SANS_VARIABLES=1) and prints only the « validation » verdict lines, because Caddy error messages can quote the configuration"
  - "Deployment pointers (.historique files and the current links) that changed since the backup are reported as information, never as a failure, even for an archive of the same day"
  - "A restore run without /etc/rtp/restauration.env or without HC_RESTAURATION exits 0 with ping « absent » (08-15 runs the restore before installing that file); a malformed URL or a failed ping exits 1"

patterns-established:
  - "Server scripts print one JSON line on stdout and diagnostics on stderr; neither ever carries a URL, a credential, a hash or a file content (each test asserts it on every run)"

requirements-completed: [OPS-01, OPS-02, OPS-03]

# Metrics
duration: 26min
completed: 2026-11-08
---

# Phase 8 Plan 07: Heartbeat, configuration archive and restore proof Summary

**Three VPS-side bash scripts, ready for the installer: a 5-minute heartbeat that pings vps-battement only when the Caddy container and the site content are fine and sends /fail for disk at 85 or 92 % and for a certificate under 14 days; a dated, root-only archive of every server file of the site with a sha256 manifest; and a monthly restore proof. The restore proof extracts the newest archive into a throwaway folder, recreates the folder skeleton, checks the hashes, compares the files with the live ones, runs the real installer (zero « [a faire] ») and the real Caddy validation, then pings restauration-mensuelle.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-11-08T22:01:38Z
- **Completed:** 2026-11-08T22:27:48Z
- **Tasks:** 2
- **Files modified:** 5 (5 created)

## Accomplishments

- `ops/battement.sh` (294 lines, 100755). Before DNS it reads `$RTP_BASE/essai/current/version.json` from disk and skips the certificate. Once `RTP_HOTE` is set, it fetches `/version.json` and `/` (marker `reveleTonProg`) with `curl --resolve <hôte>:443:127.0.0.1 --config -`, so the credentials stay on stdin. It then checks the certificate with `openssl s_client -connect 127.0.0.1:443 -servername <hôte>` piped to `openssl x509 -noout -checkend`. All checks run first, then the pings go out in a fixed order. A failed ping is reported without its URL and does not stop the others. With several disks in `RTP_DISQUES`, the fullest one decides, and the ping body names every mount point and its percentage. The header names the four Healthchecks checks and explains that recovery comes from the next normal ping.
- `ops/sauvegarder-config.sh` (201 lines, 100755). It writes `<destination>/<AAAA-MM-JJ>.tar.gz` through a 0600 temp file in the 0700 destination, then renames it into place. The archive holds the interface list (Caddyfile, compose files and override, `.env`, `sites.d/`, `etc/cron.d/rtp-*`, `etc/rtp/`, `authorized_keys`, `usr/local/sbin/rtp-*`, `ssh_host_*_key.pub`, both `.historique`) plus `MANIFESTE.txt` and `liens.txt`. Archives are rotated to the 6 newest, and only names matching the date pattern are ever removed. The header records the pull model (Erwan copies the archive to his Mac, and the VPS holds no outbound credential) and the Vaultwarden copy of the two secret files.
- `ops/tester-restauration.sh` (241 lines, 100755). It runs the five plan steps plus the archive step, uses `tar -xpzf` with `umask 022` so the folders tar creates come out 0755 like on the server, and removes its mktemp folder with a trap. On failure it prints a JSON line naming the step and sends no ping.
- `ops/installer-serveur.sh` (08-03) no longer exits with « source absente » on the battement and sauvegarde steps, because the three sources now exist.

## Task Commits

1. **Task 1: heartbeat script**: `ad97c39` (test, RED: 33 of 36 failing, 2 skipped), then `b629cc2` (feat, GREEN: 34 pass, 2 skip locally for shellcheck and the Linux-only mode check)
2. **Task 2: configuration archive and restore proof**: `4d4cf6b` (test, RED: 15 failing, 2 skipped; the shared fake-server setup itself failed because the installer refused the missing sources), then `1a1dcdb` (feat, GREEN: 29 pass, 2 skip for shellcheck)
3. **Follow-up:** `a60ff2e` (fix: typed the refused-parameter table in battement.test.ts, which `astro check` flagged as TS2345)

## Files Created/Modified

- `ops/battement.sh`: the heartbeat (installed as `/usr/local/sbin/rtp-battement`)
- `ops/sauvegarder-config.sh`: the configuration archive (`/usr/local/sbin/rtp-sauvegarder`)
- `ops/tester-restauration.sh`: the restore proof (`/usr/local/sbin/rtp-tester-restauration`)
- `tests/repo/battement.test.ts`: stubs for df, docker, openssl, curl and logger, with fake `https://hc.invalid/<uuid>` URLs built at runtime. Cases:
  - a normal run before and after DNS
  - seven site-down cases (container stopped or missing, version.json missing, bad commit on disk, HTTP failure, bad commit over HTTP, missing marker), where battement gets no ping but the disk checks, and the certificate check after DNS, still ping
  - thresholds 85 and 92, several disks, recovery, unreadable df, certificate checkend
  - ping failure, refused configuration, simulation
  - static checks
  Every run asserts that no URL, user or password appears in the output.
- `tests/repo/sauvegarde.test.ts`: a copy of the repo's `ops/` and `deploy/` serves as source, with the essai block address replaced at runtime when it is a reserved `.invalid` name. The real installer `--appliquer` builds the fake server with the stubs id, useradd and chown, and the real backup script archives it. Cases:
  - archive content, modes, MANIFESTE hashes and liens.txt
  - no `_key` entry and nothing off the list
  - JSON line, same-day overwrite, absent paths, rotation to 6, refusals
  - restore success with exactly one ping, restored Caddyfile mounted (not the live one), no temp left
  - an old archive with a modified file is reported but does not fail
  - a same-day deployment after the backup does not fail
  - no restauration.env means no ping and exit 0
  - failures: no archive, corrupted file, missing file, live file changed on the archive's day, override removed (step 3, `[a faire]` for the override), invalid Caddy (step 4)

## Verification

- Task 1 verify: `TZ=Europe/Paris fnm exec --using=24 node --test tests/repo/battement.test.ts && bash -n ops/battement.sh` exits 0 (34 pass, 2 skip). Acceptance: `grep -c checkend` = 1, and the no-printed-HC_ grep on uncommented lines = 0.
- Task 2 verify: `TZ=Europe/Paris fnm exec --using=24 node --test tests/repo/sauvegarde.test.ts && bash -n ops/sauvegarder-config.sh && bash -n ops/tester-restauration.sh` exits 0 (29 pass, 2 skip). Acceptance: `grep -c "ssh_host_\*_key.pub\|\.pub"` = 2, and a test asserts that no archive entry ends with `_key`.
- Tests ran under macOS `/bin/bash` 3.2.57 and bsdtar 3.5.3.
- A simulation smoke run with the real `df` on the Mac printed the four signal lines and the JSON line.
- Full `fnm exec --using=24 npm test`: 2200 tests, 2192 pass, 0 fail, 8 skipped (shellcheck cases and the Linux-only mode check).
- `fnm exec --using=24 npm run check`: 0 errors, 0 warnings, 0 hints.
- CI run 42529631033 on main (commit a60ff2e) succeeded: Vérifier, Tests navigateur and gitleaks were green, and gel/deploy were skipped (dormant). The ubuntu log shows 2200 tests, 2199 pass and 1 skipped (the PDF capture case that was already skipped before). So shellcheck passed on all three new scripts, the Linux mode check ran, and the GNU tar archive and restore path passed. gitleaks flagged nothing, because the fake URLs, hashes and keys are built at runtime.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] The env file is parsed, not sourced**
- **Found during:** Task 1
- **Issue:** the plan said to « source the env file ». The installer writes each stdin line verbatim, so a sonde password containing `$`, a backquote or a space would be expanded or run as root by `source`.
- **Fix:** a read loop takes only the eight known keys (`printf -v`) and strips one pair of surrounding quotes. The static test forbids `source` and `.`.
- **Commit:** b629cc2

**2. [Rule 1 - Bug] One journald entry per run instead of two**
- **Found during:** Task 1
- **Issue:** the cron line of 08-03 already pipes stdout and stderr to `logger -t rtp-battement`. Calling logger from the script as well would log every run twice, which would also weaken the 08-11 check that counts `"site":"ok"` entries.
- **Fix:** the script calls logger itself only when stdout is a terminal (manual runs). The test asserts that logger is not called under a pipe.
- **Commit:** b629cc2

**3. [Rule 1 - Bug] A deployment after the backup no longer fails a same-day restore**
- **Found during:** Task 2
- **Issue:** under the plan's rule (a difference fails when the archive is from today), any deploy between the 02:45 backup and the 11:00 restore on the 1st would fail the monthly test.
- **Fix:** the `.historique` files and the current links are reported as information and never block. Every other file follows the plan's rule. This is tested.
- **Commit:** 1a1dcdb

**4. [Rule 1 - Bug] Temp folders honour TMPDIR on macOS**
- **Found during:** Task 2
- **Issue:** macOS `mktemp -d` ignores TMPDIR, so on the Mac the cleanup assertions passed without proving anything and the restored Caddyfile was mounted from the system temp folder.
- **Fix:** `mktemp -d "${TMPDIR:-/tmp}/rtp-restauration.XXXXXX"` (and the same for the backup staging folder).
- **Commit:** 1a1dcdb

**5. [Rule 3 - Blocking] astro check error in the new test**
- **Found during:** final verification
- **Issue:** TS2345 on an untyped array literal of env objects in battement.test.ts.
- **Fix:** typed it as `Record<string, string>[]`.
- **Commit:** a60ff2e

### Additions within scope (Rule 2)

- The heartbeat refuses non-https ping URLs, an invalid `RTP_HOTE`, a lone `RTP_SONDE_USER` or `RTP_SONDE_PASS`, a user containing `:`, and invalid mount points or thresholds (exit 2, never echoing a value). A failed ping exits 1.
- The restore test refuses manifest lines with `..` or absolute paths, and symlinked files in place of manifest entries. It requires a non-empty manifest, and a malformed `HC_RESTAURATION` exits 1 without printing it.
- The archive excludes `*_key` twice (file list and `tar --exclude`), on top of the `.pub` glob. The test plants an ed25519 and an RSA private key.

## Issues Encountered

- shellcheck is not installed on the Mac. The three shellcheck cases skip locally and passed on the ubuntu-24.04 runner.

## Known Stubs

None.

## Next Phase Readiness

- 08-11: `--etape battement` with `~/.config/rtp/battement.env` on stdin (HC_BATTEMENT, HC_DISQUE85, HC_DISQUE92, HC_CERT, optionally `RTP_DISQUES="/ <volume>"`), then `--etape sauvegarde`. For the read-only check before presenting: `RTP_ENV=<temp env> RTP_HC_SIMULATION=1 bash ops/battement.sh` prints `vps-battement: ping|aucun`, both disk lines and `vps-certificat: ignore`. Until an essai release with a 40-hex `version.json` exists at `/srv/reveletonprog/essai/current`, vps-battement gets no ping (by design). Manual runs over ssh return the JSON line but do not write to journald; cron runs do, once each.
- 08-15: after `RTP_HOTE`, `RTP_SONDE_USER` and `RTP_SONDE_PASS` are added, the heartbeat switches to HTTPS and the certificate check. W6 can run `rtp-tester-restauration` before W7 installs `restauration.env`: it then exits 0 with `"ping":"absent"`. Run it again after W7 to send the first restauration-mensuelle ping. The restore needs `/opt/rtp/depot` refreshed (installer `depot` step) with the real-domain `essai.caddy`, otherwise the installer's site-essai step exits 6 and the restore fails at step 3.

## Self-Check: PASSED

- FOUND: ops/battement.sh, ops/sauvegarder-config.sh, ops/tester-restauration.sh (all 100755), tests/repo/battement.test.ts, tests/repo/sauvegarde.test.ts
- FOUND commits: ad97c39, b629cc2, 4d4cf6b, 1a1dcdb, a60ff2e
