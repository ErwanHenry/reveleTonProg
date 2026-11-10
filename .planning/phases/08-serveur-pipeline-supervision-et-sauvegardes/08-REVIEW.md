---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
reviewed: 2026-11-10T12:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - ops/installer-serveur.sh
  - ops/commande-deploiement.sh
  - ops/valider-caddy.sh
  - ops/verifier-sites.sh
  - ops/battement.sh
  - ops/sauvegarder-config.sh
  - ops/tester-restauration.sh
  - ops/site-touche.sh
  - ops/diagnostic-vps.sh
  - deploy/compose/docker-compose.override.yml
  - deploy/cron/rtp-battement
  - deploy/cron/rtp-sauvegarde
  - deploy/cron/rtp-restauration
  - deploy/caddy/site.caddy
  - deploy/caddy/essai.caddy
  - scripts/render-caddy.ts
  - scripts/garde-gel.ts
  - scripts/lib/check-dist.ts
  - src/pages/version.json.ts
  - src/lib/journal-acces.ts
  - src/lib/profil-4g.ts
  - src/pages/mentions-legales.astro
  - src/pages/methode.astro
  - playwright.config.ts
  - e2e/4g.spec.ts
  - e2e/serveur.ts
  - .github/workflows/ci.yml
  - .github/workflows/rollback.yml
  - .github/workflows/sonde.yml
  - docs/ARCHITECTURE.md
findings:
  critical: 2
  warning: 6
  info: 7
  total: 15
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-11-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the server scripts (root installer, forced command, heartbeat, backup and restore), the Caddy blocks and their renderer, the freeze guard, the check-dist additions, the version endpoint, the log policy module, the Méthode and Mentions légales changes, the remote 4G mode and the three workflows. The phase 8 repo tests pass locally: 244 pass, 6 skipped, 0 fail on `commande-deploiement`, `site-touche`, `deploy-workflow`, `installer-serveur`, `battement` and `sauvegarde`.

Most of the input handling holds up:
- The `SSH_ORIGINAL_COMMAND` allow-list is strict.
- Values are never passed through `eval` or `source`.
- Env files are parsed line by line.
- Secrets stay out of argv where it matters.
- No `${{ }}` appears in `run:` bodies.

Two defects defeat a guard the phase relies on:
1. Symbolic links pass through the whole chain (rsync `-l`, rrsync without `-munge`, `activer`, check-dist). Caddy follows them inside its container, so anyone holding the deploy key can publish files from the shared Caddy container. That includes the TLS private keys of every site on the VPS, Vaultwarden's among them. The forced command's containment model is broken.
2. The election-freeze guard runs before the approval wait, not after it. A run queued before 17 April and approved during the freeze deploys during the freeze.

The warnings cover these points:
- The automatic rollback can go back further than intended.
- The concurrency group can cancel a pending rollback.
- The root-owned `.ssh` sits in a home directory that `deploy` owns.
- Dependency code runs in the job that later holds the deploy key.
- The heartbeat has no timeouts or lock.
- check-dist cannot see symlinks.

## Critical Issues

### CR-01: Symlinks in an upload are published and followed by Caddy, so the deploy key can read files from the shared Caddy container (TLS private keys)

**File:** `ops/commande-deploiement.sh:203`, `ops/commande-deploiement.sh:218-224`, `.github/workflows/ci.yml:376`
**Issue:**
- `verbe_envoi` runs `rrsync -wo -no-del` without `-munge`, so rsync receives symlinks as real symlinks.
- The CI client sends with `-rlt` (`-l` preserves links).
- `verbe_activer` checks only that `incoming/<cible>/<sha>`, `index.html` and `version.json` are not links. It then moves the whole tree into `releases/<sha>/`, including any symlink deeper in the tree.
- Caddy's `file_server` follows symlinks, and the absolute target resolves inside the Caddy container's own filesystem, not the read-only `/srv/reveletonprog` mount.

So an upload containing `x.txt -> /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/<vaultwarden-domain>/<vaultwarden-domain>.key` serves that private key over HTTPS once activated. `x -> /proc/self/environ` would expose the container environment, including the bcrypt hashes. The Caddy container runs as root and holds the certificates of every site on the shared VPS, including the Vaultwarden domain.

The forced command is meant to limit a leaked deploy key to "write a new version of this site" (ADR-054, D-09). With symlinks, a leaked key also allows stealing TLS keys and so intercepting the password manager. The same path exists from CI if `public/` ever contains a symlink, because check-dist does not see it (WR-06).
**Fix:** Close it on the server, which is the trust boundary, and on both other layers:
```bash
# ops/commande-deploiement.sh, verbe_activer, before mv -T (anything other than a regular file or a directory is refused)
if [ -n "$(find "$arrivee" ! -type f ! -type d -print -quit)" ]; then
  echouer 65 "l'envoi contient un lien symbolique ou un fichier spécial"
fi
# line 203: munge links received over rsync as a second barrier
exec "$RRSYNC" -wo -no-del -munge "$BASE/incoming"
```
Also send from CI with `rsync -rt` (drop `-l`), or add `--no-links`. Add a test that uploads a release containing `a -> /etc/hostname` and expects code 65.

### CR-02: The freeze guard runs before the approval wait, so a deploy approved during the 17-19 April or 1-3 May freeze goes out

**File:** `.github/workflows/ci.yml:250-276`, `.github/workflows/ci.yml:287-296`
**Issue:** The `gel` job has no Environment. It runs as soon as `verifier`, `e2e`, `secrets` and `changements` finish, and it evaluates `new Date()` at that moment. The `deploy` job then waits in the `production` Environment for Erwan's approval, which GitHub keeps open for up to 30 days, and it never evaluates the freeze again. Example: a push on 2027-04-16 at 22:00 Paris passes `gel` (outside the window). If it is approved on 2027-04-18, it is deployed on election day without an emergency justification. The stale-approval step (lines 319-347) checks only the head of `main`, not the date.

`rollback.yml` does it right: the job's Environment is approved first, then `garde-gel.ts` runs inside it (lines 69-79). HEB-13 / D-10 promises "aucun déploiement ... du 17 au 19 avril et du 1er au 3 mai 2027", and the pipeline does not enforce that.
**Fix:** Run the guard again as the first step of `deploy`, after approval:
```yaml
      - name: Garde de gel au moment de l'approbation
        id: gel_deploy
        env:
          URGENCE: ${{ inputs.retrait_urgence }}
          JUSTIFICATION: ${{ inputs.justification }}
        run: node scripts/garde-gel.ts --urgence "$URGENCE" --justification "$JUSTIFICATION"
      - name: Refuser le déploiement pendant le gel
        if: steps.gel_deploy.outputs.ok != 'true'
        run: |
          echo "::error::Déploiement refusé par la garde de gel au moment de l'approbation."
          exit 1
```
This step runs before `npm ci`, so it needs `setup-node` but no dependencies. Keep the `gel` job so a push during the freeze does not even ask for approval. Add a repo test asserting this step exists in `deploy` and comes before the key is written.

## Warnings

### WR-01: The automatic rollback goes back one version too far when the run did not switch `current`

**File:** `.github/workflows/ci.yml:432-439`, `ops/commande-deploiement.sh:210-216`, `ops/commande-deploiement.sh:236-246`
**Issue:**
- When `releases/<sha>` already exists and is current, `activer` succeeds without switching. This is the normal case for `workflow_dispatch -f deployer=true` on an unchanged head, or for an emergency re-run.
- If the smoke test then fails, even transiently (curl timeouts, HSTS/CSP grep), the rollback step runs `retour $CIBLE` with no sha.
- `trouver_precedent` picks the most recent history entry other than the current one. That replaces a version that was already in service and good with an older one.

During an emergency withdrawal (`retrait_urgence`), a smoke failure right after activation also re-publishes the very content that was being withdrawn, and does so during the freeze. Nothing in the job distinguishes "I switched" from "it was already current".
**Fix:** Record the current sha before activation, and roll back to that exact sha only if the run changed it:
```bash
# before "activer": AVANT=$(ssh ... "etat $CIBLE" | sed -n 's/.* courant=\([0-9a-f]\{40\}\) .*/\1/p'); echo "AVANT=$AVANT" >> "$GITHUB_ENV"
# rollback step:
if [ -n "$AVANT" ] && [ "$AVANT" != "$SHA" ]; then ssh ... "retour $CIBLE $AVANT"; else echo "current n'a pas changé : aucun retour"; fi
```
For `retrait_urgence` runs, consider skipping the automatic rollback and failing loudly instead.

### WR-02: A pending rollback can be silently cancelled by a newer pending deploy (shared concurrency group)

**File:** `.github/workflows/rollback.yml:46-48`, `.github/workflows/ci.yml:294-296`
**Issue:** `deploy-production` is shared, with `cancel-in-progress: false`. GitHub keeps at most one pending job per group, and a newer pending job cancels the older pending one. Scenario: a deploy is running or waiting for approval (ADR-055 says a waiting run holds the group, while 08-13 says A6 was not observed). Erwan then dispatches an incident rollback, which goes pending. A push to `main` before the slot frees up cancels the pending rollback, and a deploy takes its place. That deploy may re-publish what the rollback was meant to remove. The `rollback.yml` header ("un retour arrière ne chevauche jamais un déploiement") is true, but it hides this failure mode, and neither file nor the RUNBOOK mentions it.
**Fix:** Give the rollback its own group, so it cannot be replaced by a deploy, and make it wait on the activation lock instead (the server already serialises with `flock`). Otherwise, document in the RUNBOOK that a pending rollback must be watched until it starts, and that the waiting deploy must be rejected first. Also bring ADR-055 and the 08-13 A6 note into agreement.

### WR-03: The root-owned `.ssh` gives no protection, because `deploy` owns `/home/deploy` and can rename it

**File:** `ops/installer-serveur.sh:566`, `ops/installer-serveur.sh:580-581`
**Issue:**
- `useradd --create-home` makes `/home/deploy` owned by `deploy`.
- The installer makes `.ssh` and `authorized_keys` root-owned so that "deploy ne peut pas réécrire sa propre restriction".
- On Linux, renaming a directory within the same parent needs write permission only on the parent. Code running as `deploy` can therefore `mv ~/.ssh ~/.x && mkdir ~/.ssh` and drop an unrestricted `authorized_keys`. sshd `StrictModes` accepts files owned by the user.

The forced command makes this hard to reach today. Still, the comment and threat model claim a defence-in-depth layer that does not exist. It would matter for any future code execution as `deploy` (for example an rrsync or rsync bug).
**Fix:** In `etape_utilisateur`, also enforce `assurer_dossier "$R/home/deploy" 755 root` (deploy needs no writable home), or point `AuthorizedKeysFile` for `deploy` to a root-owned path (`Match User deploy` / `AuthorizedKeysFile /etc/ssh/authorized_keys/%u`). Add a check that the home directory is not writable by `deploy`.

### WR-04: Dependency code runs in the same job that later writes the SSH deploy key

**File:** `.github/workflows/ci.yml:315-372`
**Issue:** The `deploy` job runs these steps before writing `DEPLOY_SSH_KEY` to `$RUNNER_TEMP/cle`:
- `npm ci`, which runs dependency lifecycle scripts;
- `npm run build`, which runs Astro, Vite and every plugin;
- `npm run check-dist`.

A compromised transitive dependency can leave a background process that waits for the key file, or read `DEPLOY_SMOKE_PASS` from the environment of later steps. `npm audit signatures` checks provenance, not behaviour. The key is the one secret that writes to the shared VPS.
**Fix:** In `deploy`, use `npm ci --ignore-scripts` (the build needs no install scripts). Better still, build and check in a job without secrets and pass `dist/` as an artifact with its SHA-256 written to the job output. Then download, verify the hash and rsync in a minimal job that runs no repo or dependency code. This also makes the "build refaite depuis le commit du run" property explicit.

### WR-05: The heartbeat has no timeout on `openssl s_client` or `docker inspect`, and no lock, so runs pile up during the incidents it should detect

**File:** `ops/battement.sh:178`, `ops/battement.sh:235`, `deploy/cron/rtp-battement:6`
**Issue:** `curl` calls use `-m 10`, but `docker inspect` (dockerd hung) and `openssl s_client -connect 127.0.0.1:443` (Caddy accepts TCP and stalls the handshake) can block forever. Cron starts a new run every 5 minutes with no `flock`, so processes pile up on the shared, memory-constrained VPS exactly when Docker or Caddy misbehave. The alert does fire (no `vps-battement` ping), but the box degrades further.
**Fix:**
```bash
ETAT_CONTENEUR=$(timeout 15 docker inspect -f '{{.State.Running}}' "$CONTENEUR" 2>/dev/null) || ETAT_CONTENEUR=''
PEM=$(timeout 15 openssl s_client -connect 127.0.0.1:443 -servername "$RTP_HOTE" </dev/null 2>/dev/null) || true
```
and in the cron line: `flock -n /run/rtp-battement.lock /usr/local/sbin/rtp-battement 2>&1 | logger -t rtp-battement`.

### WR-06: check-dist silently skips symlinks and special files, so TYPE_FICHIER_INATTENDU and every page rule are blind to them

**File:** `scripts/lib/check-dist.ts:140-148`, `scripts/lib/check-dist.ts:700-711`
**Issue:** `lister()` keeps only `e.isDirectory()` and `e.isFile()` Dirents. A symlink (`isSymbolicLink()`), FIFO or socket in `dist/` is never listed. TYPE_FICHIER_INATTENDU's contract says "Tout autre fichier, y compris sans extension", which these entries escape. A symlinked `.html` page also escapes the third-party, CSP and source-date checks. rsync `-l` then uploads the link as is (see CR-01).
**Fix:** In `lister`, report anything that is neither a regular file nor a directory, for example a new code `LIEN_OU_FICHIER_SPECIAL` (or reuse TYPE_FICHIER_INATTENDU), so it is an error in every mode. Add a fixture with one symlink.

## Info

### IN-01: Healthchecks ping URLs are passed in curl's argv

**File:** `ops/battement.sh:250`, `ops/tester-restauration.sh:231`
**Issue:** The headers say the ping addresses are "jamais affichées", but they sit in `/proc/<pid>/cmdline` for the duration of each curl call. Anyone holding a ping URL can send fake success pings and hide an outage. Today the risk is low, because `deploy` has no shell and containers are in another PID namespace.
**Fix:** Pass the URL with the same pattern as the sonde credentials: `printf 'url = "%s"\n' "$url$suffixe" | curl --config - ...`.

### IN-02: The certificate check accepts any certificate (no chain or hostname check)

**File:** `ops/battement.sh:235-236`
**Issue:** `openssl s_client` without `-verify_return_error -verify_hostname "$RTP_HOTE"` checks only `notAfter`. A wrong, self-signed or other-site certificate would report `ok`.
**Fix:** Add `-verify_return_error -verify_hostname "$RTP_HOTE" -CAfile /etc/ssl/certs/ca-certificates.crt`, and treat a verification failure as `fail`.

### IN-03: The ping URL regex is stricter in the installer than in the scripts that use it

**File:** `ops/installer-serveur.sh:68` vs `ops/battement.sh:72`, `ops/tester-restauration.sh:52`
**Issue:** The installer rejects `https://host:port/...`, which the heartbeat and the restore test accept. The installer cannot write a config that the consumers consider valid. This is harmless but inconsistent.
**Fix:** Use one regex in all three (with `(:[0-9]+)?`).

### IN-04: `.gitattributes` is classified "hors site" but can change the bytes checked out and built

**File:** `.github/workflows/ci.yml:44`
**Issue:** eol, `working-tree-encoding` or filter attributes change the checked-out content of `src/` and `content/`, so the built site changes. A push that touches only `.gitattributes` triggers no deploy. The stale-approval check would also admit such a head, while the "site de la tête" really differs from the one deployed.
**Fix:** Remove `.gitattributes` from `CHEMINS_HORS_SITE` (conservative default).

### IN-05: The emergency justification goes raw into the Markdown job summary

**File:** `scripts/garde-gel.ts:189`
**Issue:** Control characters are removed, but Markdown, links and images are not. A justification can inject links or image beacons (proxied by GitHub) into the summary that records the freeze decision. Only users with dispatch rights can do this.
**Fix:** Wrap it in a code span (escaping backticks), or escape `[]()!<>*_` before writing it.

### IN-06: The Mentions légales access-log sentence does not cover the container stderr log, which keeps full IPs (tracked, not yet rendered)

**File:** `src/lib/journal-acces.ts:28-33`, `src/pages/mentions-legales.astro` (active-host branch)
**Issue:** Caddy's `http.log.error` and default logger go to Docker `json-file` with full client IPs. That log is capped in size (10 MiB x 3) but not in time. The sentence is accurate for the access log only. A reader will take "l'adresse IP y est tronquée ... 14 jours au plus" as the whole picture. This is already a tracked Phase 9 point (RUNBOOK line 511, 08-RESEARCH O4), and the sentence is not rendered while `config/hebergeur.yml` has `statut: prevu`. Recorded so it does not ship as is when `statut` becomes `actif`.
**Fix:** Before switching to `actif`, either filter `http.log.error` through the same `log` filter (global `log { include http.log.error ... }`) or state the stderr log and its retention in the sentence. A test could tie `statut: actif` to that decision.

### IN-07: No automatic rollback when the deploy job is cancelled or times out after activation

**File:** `.github/workflows/ci.yml:433`
**Issue:** `failure()` is false for a cancelled run (manual cancel or `timeout-minutes: 15`). A run cancelled between `activer` and the end of the smoke test leaves the new version live and unverified, with no rollback.
**Fix:** Use `if: (failure() || cancelled()) && steps.activer.outcome == 'success'`, combined with the exact-sha rollback from WR-01.

---

_Reviewed: 2026-11-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
