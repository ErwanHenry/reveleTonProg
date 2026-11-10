---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
fixed_at: 2026-11-10T20:30:00Z
review_path: .planning/phases/08-serveur-pipeline-supervision-et-sauvegardes/08-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 14
skipped: 1
status: partial
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-11-10T20:30:00Z
**Source review:** .planning/phases/08-serveur-pipeline-supervision-et-sauvegardes/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (2 critical, 6 warning, 7 info; scope "all")
- Fixed: 14
- Skipped: 1 (IN-06, tracked for Phase 9)

Repository-side only. No command was run on the VPS. The server-side files changed by these fixes
(`rtp-deploy-command`, `/home/deploy` ownership, `rtp-battement`, `/etc/cron.d/rtp-battement`,
`rtp-tester-restauration`) take effect only after the orchestrator re-applies the installer steps with Erwan's
approval.

Local verification after the last fix: `npm test` 2295 tests, 2286 pass, 0 fail, 9 skipped; `npm run check` 0
errors, 0 warnings, 0 hints; `node scripts/render-caddy.ts --check` both blocks up to date.

CI run 42882087970 (head 25f43e6): verifier, e2e, secrets (gitleaks), changements, gel and the new `construire` job
are all green. `construire` published `site-deploiement-1` (428 903 bytes, expires 2026-12-10). The `deploy` job is
waiting for approval in the `production` Environment:
https://github.com/ErwanHenry/reveleTonProg/actions/runs/42882087970/job/130064968902

## Fixed Issues

### CR-01: Symlinks in an upload are published and followed by Caddy

**Files modified:** `ops/commande-deploiement.sh`, `.github/workflows/ci.yml`, `tests/repo/commande-deploiement.test.ts`, `tests/repo/deploy-workflow.test.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 5927d9d
**Status:** fixed: requires human verification (takes effect on the server only after the `commande` step is re-applied)
**Applied fix:** `activer` now refuses with exit 65, before any move, an upload that contains anything other than regular files and directories (symlink, fifo, socket, device) or a file with more than one hard link. A failed `find` also refuses. rrsync gets `-munge`: the rrsync 3.2.7 source (`support/rrsync` at tag v3.2.7) defines `-munge` ("Enable rsync's --munge-links on the server side"); it is only a second barrier, and the `activer` check is the guarantee. The CI client sends with `rsync -rt` (no `-l`). Seven new cases inject an absolute symlink, a deep symlink, a symlink to a directory, a broken symlink, a fifo and a hard link, plus a first upload with no `current`. All seven fail without the fix.

### CR-02: The freeze guard runs before the approval wait

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/deploy-workflow.test.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 4ca8513
**Status:** fixed: requires human verification (workflow logic, proven only by a real run)
**Applied fix:** The `deploy` job runs `node scripts/garde-gel.ts` again right after checkout and setup-node, with the same inputs passed through env only (no `${{ }}` in `run`). A refusal step (`steps.gel.outputs.ok != 'true'`) exits 1 before any download, key or rsync. The `gel` job stays, so a push during a freeze does not even ask for approval. A test pins the step's position (immediately after setup-node, before the key, rsync and activer) and its exact command and env.

### WR-01: The automatic rollback goes back one version too far

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/deploy-workflow.test.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 5b3f54a
**Status:** fixed: requires human verification (logic)
**Applied fix:**
- A new step runs `etat` just before `activer` and records `COURANT_AVANT`. It fails closed on an unreadable reply.
- The automatic rollback runs `retour <cible> <COURANT_AVANT>` and checks `etat` afterwards.
- It does nothing when `COURANT_AVANT == SHA`, meaning the run did not change `current`.
- It refuses when nothing was live before the run.
- It never auto-reverts an emergency withdrawal (`retrait_urgence`). It fails loudly instead.
- Both step bodies are run in tests with a stub `ssh`.

### WR-02: A pending rollback can be cancelled by a newer pending deploy

**Files modified:** `.github/workflows/ci.yml`, `.github/workflows/rollback.yml`, `tests/repo/deploy-workflow.test.ts`, `tests/repo/docs.test.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 3760dac
**Status:** fixed: requires human verification (logic)
**Applied fix:**
- `rollback.yml` now uses its own concurrency group, `retour-production`, with `cancel-in-progress: false`. `deploy` keeps `deploy-production`.
- A push can no longer replace a pending rollback.
- The server's `flock -w 20` on every `activer` and `retour` serialises the two on the server.
- To keep a deploy that runs at the same moment from undoing a manual rollback, the deploy job's automatic rollback first checks that `current` still points to its own sha. It does nothing if `current` has moved.
- The choice is documented in the `rollback.yml` header, the RUNBOOK (reject a waiting deploy during an incident) and ADR-055, which also notes that A6 no longer concerns rollbacks.

### WR-03: The root-owned `.ssh` gives no protection inside a deploy-owned home

**Files modified:** `ops/installer-serveur.sh`, `tests/repo/installer-serveur.test.ts`, `docs/RUNBOOK.md`
**Commit:** b47c539
**Status:** fixed: requires human verification (takes effect only after the `utilisateur` step is re-applied)
**Applied fix:**
- `etape_utilisateur` enforces `/home/deploy` as root:root 0755.
- It chowns every entry of the home other than `.ssh` to root with `chown -hR`, which never follows a link. These are the skeleton dotfiles: bash reads `.bashrc` before the forced command when sshd starts it.
- `.ssh` stays root:root 0755 and `authorized_keys` stays root 0644.
- `--verifier` flags a deploy-owned or 0750 home and any deploy-owned entry in it.
- rrsync locks its target directory (`incoming/`), not the home, and appends to `rrsync.log` only if that file already exists. deploy therefore needs no writable home.
- Tests cover the check, the apply and the full install.

### WR-04: Dependency code runs in the job that later writes the SSH key

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/deploy-workflow.test.ts`, `tests/repo/ci.test.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** fbdb3f3
**Status:** fixed: requires human verification (first real deploy proves the artifact hand-off)
**Applied fix:** The split was feasible, so it was done.
- A new `construire` job has no secret and no Environment, and the same condition as `deploy`.
- It runs `npm ci --ignore-scripts` (consistent with `.npmrc` `ignore-scripts=true`; fsevents is macOS-only and unaffected), `npm audit signatures`, the build and check-dist.
- It hashes the `dist/` tree (sorted paths and SHA-256 of each file) and uploads `dist` as `site-deploiement-<run_attempt>`, kept 30 days (the maximum approval wait), with outputs `artefact`, `empreinte` and `cible`.
- `deploy` no longer runs npm or any dependency code. It downloads that artifact with `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333` (v8.0.2, `digest-mismatch: error`).
- Before writing the key, `deploy` checks:
  - the artifact name;
  - the tree hash against the build job output;
  - that the build target still equals `DEPLOY_CIBLE`, so a build made for `essai` never ships to production;
  - that there is no symlink or special file;
  - that `version.json` carries the run commit.
- The key is still written after these checks and removed by the `always()` step (confirmed and pinned).

### WR-05: The heartbeat has no timeout and no lock

**Files modified:** `ops/battement.sh`, `deploy/cron/rtp-battement`, `tests/repo/battement.test.ts`, `tests/repo/config-serveur.test.ts`, `docs/RUNBOOK.md`
**Commit:** 327e5f0
**Status:** fixed: requires human verification (takes effect only after the `battement` step is re-applied)
**Applied fix:**
- Every external call runs under `timeout -k 5`: `docker inspect` and `openssl s_client` 15 s, HTTPS checks 15 s, pings 60 s.
- The cron line is `flock -n /run/rtp-battement.lock /usr/local/sbin/rtp-battement 2>&1 | logger -t rtp-battement`.
- A `timeout` stub tests the wrapping and simulates expiry: docker hang means no heartbeat, openssl hang means cert `/fail`.
- A code check asserts that no `curl`, `docker` or `s_client` call runs without `timeout`.

### WR-06: check-dist skips symlinks and special files

**Files modified:** `scripts/lib/check-dist.ts`, `tests/scripts/check-dist.test.ts`, `docs/RUNBOOK.md`
**Commit:** 3149ca9
**Applied fix:**
- `lister()` collects every entry that is neither a regular file nor a directory, without following or reading it: symlinks (even broken, or pointing to a directory), fifos, sockets and devices.
- `checkDist` reports each one under the new stable code `FICHIER_NON_REGULIER`, an error in every mode with no option.
- The code is added to `CODES_CHECK_DIST` and to the RUNBOOK code table.
- Tests cover the API and the CLI.

### IN-01: Ping URLs in curl's argv

**Files modified:** `ops/battement.sh`, `ops/tester-restauration.sh`, `tests/repo/battement.test.ts`, `tests/repo/sauvegarde.test.ts`
**Commit:** 8eb985e
**Status:** fixed: requires human verification (server re-apply of `battement` and `sauvegarde`)
**Applied fix:** The validated URL goes to `curl --config -` as `url = "..."`, printed by the builtin `printf`. Tests assert that curl's argv holds no ping address.

### IN-02: The certificate check accepts any certificate

**Files modified:** `ops/battement.sh`, `tests/repo/battement.test.ts`
**Commit:** 652ade4
**Status:** fixed: requires human verification (run `RTP_HC_SIMULATION=1 rtp-battement` on the server after re-apply)
**Applied fix:** `openssl s_client` now runs with `-verify_return_error -verify_hostname "$RTP_HOTE" -CAfile "$RTP_CA"` (default `/etc/ssl/certs/ca-certificates.crt`). A failed verification gives `/fail`, and the output of a failed s_client is never read.

### IN-03: Ping URL regex stricter in the installer

**Files modified:** `ops/installer-serveur.sh`, `tests/repo/installer-serveur.test.ts`
**Commit:** 555e60d
**Applied fix:** The installer accepts `(:[0-9]+)?` like its consumers, and a drift test pins one `RE_URL_PING` across the three scripts.

### IN-04: `.gitattributes` classified as non-site

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/deploy-workflow.test.ts`, `tests/repo/site-touche.test.ts`, `docs/RUNBOOK.md`
**Commit:** 8147890
**Applied fix:** Removed from `CHEMINS_HORS_SITE`. The site-touche tests now expect `true` for `.gitattributes`.

### IN-05: Raw justification in the Markdown job summary

**Files modified:** `scripts/garde-gel.ts`, `tests/scripts/garde-gel.test.ts`
**Commit:** 3df4b2e
**Applied fix:** The justification is written as a Markdown code span whose delimiter is longer than any backtick run in the text (new `codeMarkdown`). It is tested on a link, image, HTML and emphasis injection.

### IN-07: No automatic rollback when the deploy job is cancelled or times out

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/deploy-workflow.test.ts`, `docs/RUNBOOK.md`
**Commit:** 25f43e6
**Status:** fixed: requires human verification (logic)
**Applied fix:** This was trivial once WR-01 was in, so it was applied. The rollback step condition is now `(failure() || cancelled()) && steps.activer.outcome == 'success'`, with all the WR-01 and WR-02 guards. A cancel during `activer` itself (outcome `cancelled`) still does not trigger it; check `etat` by hand in that case.

## Skipped Issues

### IN-06: The Mentions légales access-log sentence does not cover the container stderr log

**File:** `src/lib/journal-acces.ts:28-33`, `src/pages/mentions-legales.astro`
**Reason:** Out of scope by instruction. This is a tracked Phase 9 point (RUNBOOK line 511, 08-RESEARCH O4), and the sentence is not rendered while `config/hebergeur.yml` has `statut: prevu`.
**Original issue:** Caddy's error and default logs go to Docker `json-file` with full client IPs, capped in size but not in time. The sentence "l'adresse IP y est tronquée ... 14 jours au plus" describes the access log only.

---

_Fixed: 2026-11-10T20:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
