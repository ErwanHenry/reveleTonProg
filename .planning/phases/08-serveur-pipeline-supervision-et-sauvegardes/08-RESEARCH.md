# Phase 8: Serveur, pipeline, supervision et sauvegardes - Research

**Researched:** 2026-11-08
**Domain:** static-site delivery on a shared Docker VPS (Caddy container, SSH forced-command deploy, GitHub Actions Environment gate, Healthchecks.io heartbeats, config backup/restore)
**Confidence:** HIGH on the server facts (read-only SSH, 2026-11-08) and the repo facts; MEDIUM on Healthchecks.io free-plan details and Actions concurrency-vs-approval behaviour; LOW on real-device 4G.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Qui agit sur le serveur**
- **D-01:** L'orchestrateur (Claude) agit sur le VPS via `ssh keel-vps` (root), uniquement par des scripts versionnés et idempotents du dossier `ops/` (ou `deploy/`). Avant chaque étape qui modifie la machine, il montre à Erwan la commande et son effet, et attend son accord. Les étapes en lecture seule (diagnostic, `caddy validate` dans un conteneur jetable, vérifications HTTP) ne demandent pas d'accord.
- **D-02:** Un instantané Hetzner existe (2026-11-08). Le VPS est conservé tel quel (décision du 2026-11-07).

**Caddy en conteneur (constat de la Phase 6)**
- **D-03:** Caddy tourne dans le conteneur Docker `caddy` (`caddy:2-alpine`), Caddyfile monté depuis l'hôte (`/opt/vaultwarden/Caddyfile`, environ 15 blocs, sans `import`), données et configuration montées. Le site sera servi depuis un montage en lecture seule `/srv/reveletonprog` (dans le conteneur) contenant `releases/<sha>/` et un lien relatif `current`. Le journal d'accès écrit dans un dossier hôte monté sur `/var/log/caddy`.
- **D-04:** Recréer le conteneur Caddy une fois (ajout des montages et de la variable d'environnement du hash `basic_auth`) : autorisé par Erwan « quand tu veux, en soirée », avec un message juste avant, une sauvegarde du Caddyfile et du fichier de composition, et une vérification HTTP de chaque site servi avant et après. Trouver d'abord comment le conteneur est défini (compose ou `docker run`) en lecture seule.
- **D-05:** Le bloc du site (`deploy/caddy/site.caddy`, généré en Phase 7) est ajouté au Caddyfile monté par une ligne `import` vers un fichier dédié, puis `caddy validate` et `caddy reload` dans le conteneur (`docker exec`), jamais `restart` sauf la recréation unique de D-04. Avant d'appliquer : `caddy validate` du bloc dans un conteneur jetable de la même image pour confirmer `roll_at`, `ip_mask 24 48`, `request>headers delete`, `request>client_ip` et la version de Caddy (2.11 ou plus).
- **D-06:** Les journaux du conteneur (stderr) sont plafonnés par les options de journal Docker (taille et nombre de fichiers) lors de la recréation (constat WR-01 de la Phase 7).

**Hôte technique protégé (HEB-14)**
- **D-07:** Sous-domaine `essai.<domaine>`, protégé par `basic_auth`. Le hash bcrypt n'est jamais commité : il est passé à Caddy par une variable d'environnement du conteneur (`{$RTP_ESSAI_HASH}` dans le bloc rendu). Le mot de passe en clair va dans Vaultwarden (Erwan). L'hôte technique reçoit la build de production construite avec un indicateur explicite et temporaire qui ne lève que `SITE_VIDE` pour cet hôte, jamais dans le job de production ; il porte `noindex` et `Disallow: /`. Il est retiré à l'ouverture (Phase 9).

**Déploiement (HEB-02, HEB-10, HEB-11, HEB-12, HEB-13)**
- **D-08:** Job `deploy` dans `.github/workflows/ci.yml` : `needs: [verifier, e2e, secrets]`, seulement sur `push` vers `refs/heads/main`, `environment: production` (relecteur requis : Erwan ; limité à `main`), `concurrency` sans annulation. Il reconstruit la build de production (sous `RTP_DEPLOIEMENT=1` pour la cible publique), lance check-dist, envoie dans `releases/<sha>/`, bascule `current` de façon atomique, fait un test de fumée, garde 5 versions.
- **D-09:** Utilisateur `deploy` sans sudo, clé ed25519 dédiée avec `restrict` et commande forcée. La recherche tranche le mécanisme : rrsync seul ne sait pas basculer un lien ; options : script de commande forcée avec liste blanche de `SSH_ORIGINAL_COMMAND` (rsync vers `releases/<sha>/`, bascule, rotation), ou deux clés. Empreinte du serveur épinglée dans une variable de l'Environment, jamais `ssh-keyscan`, jamais `StrictHostKeyChecking=no`.
- **D-10:** Retour arrière par `workflow_dispatch` (`rollback.yml`) qui rebascule `current` sur la version précédente en moins de 2 minutes, testé par un aller-retour chronométré. Gel des déploiements du 17 au 19 avril et du 1er au 3 mai 2027 dans le workflow, sauf retrait d'urgence documenté (entrée explicite).
- **D-11:** Test de dépôt : pas de `pull_request_target`, pas de `RTP_MODE` dans le job, aucun artefact preview déployé, `needs` des trois jobs, secrets seulement dans l'Environment.

**Version servie, performance (HEB-07, PERF-02)**
- **D-12:** `/version.json` (commit, date de build) généré à la build.
- **D-13:** PERF-02 : mesure du profil « Slow 4G simulé » derrière le vrai serveur (hôte technique), consignée ; libellé « Slow 4G simulé » sur Méthode, README, RUNBOOK ; une mesure réelle à la main (`lighthouse` hors dépendances du projet) consignée avec son écart.

**Supervision et sauvegardes (OPS-01, OPS-02, OPS-03)**
- **D-14:** Healthchecks.io (compte existant d'Erwan) + bot Telegram existant d'Erwan. Jetons et URL de ping dans les secrets ou sur le VPS hors dépôt, jamais commités. Sonde externe de contenu avec alerte après 3 échecs et message de rétablissement, testée par une panne simulée (sur l'hôte technique). Battement de cœur par cron de 5 min sur le VPS : site, disque (85 et 92 %), certificat (moins de 14 jours). La sonde doit toucher le site au moins une fois par jour (rotation du journal à la première requête, constat de la Phase 7).
- **D-15:** Sauvegarde : la configuration (Caddyfile importé, fichier de composition, cron, clés autorisées, script d'installation idempotent) est dans le dépôt ou reconstructible par lui ; une restauration réelle avant l'ouverture, puis chaque 1er du mois. Les sauvegardes Hetzner automatiques sont à vérifier par Erwan. restic seulement si nécessaire.

### Claude's Discretion
- Noms exacts des scripts (`ops/installer-serveur.sh`, `ops/commande-deploiement.sh`…), découpage en plans et vagues, ordre interne, tant que les étapes sans domaine (scripts, tests de dépôt, job de workflow en mode à sec, `caddy validate` jetable) passent avant celles qui demandent le DNS.

### Deferred Ideas (OUT OF SCOPE)
None listed in CONTEXT.md. Constraints block (copied for the planner): domain not yet bought, so DNS-dependent steps (certificate, reachable technical host) come last and wait for Erwan; no secret in the (public) repo; raw server report and other sites' Caddyfile content never go into the repo; Node 24 via `fnm exec --using=24`; no new npm dependency; GitHub actions pinned by SHA with `persist-credentials: false`; never modify `src/content/**`, `archives/**`, `data/couverture-themes.yaml`; check CI after every push. Public opening is Phase 9, not here.

## Project Constraints (from CLAUDE.md)

- Static Astro, zero JS by default, no server framework, no BDD. No third-party cookie, script, analytics. Images: Wikimedia Commons only, or none.
- Each added dependency needs a written PR justification: this phase adds **zero npm dependencies** (everything is bash, `node:test`, plain `ssh`/`rsync`/`curl`, hosted Healthchecks.io).
- Secrets: none in the repo; GitHub Environment + Vaultwarden.
- Neutrality/forbidden-words rules apply to any French copy added (Méthode/README/RUNBOOK labels): no « extrême », « populiste », « irresponsable », « courageux », « enfin ».
- Node 24 (`.nvmrc` = 24); TypeScript scripts run natively (`node scripts/x.ts`).
- GSD workflow enforcement: file edits only through a GSD command; erwan's global rules (push within the hour, README/RUNBOOK/ARCHITECTURE, logs JSON, monitoring + Telegram, reproducible deploy, monthly backup test) are satisfied by this phase.
- Memory: after each push run `gh run list` and watch the CI; git tests must set a local git identity.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEB-01 | HTTPS via generated Caddy block, `caddy validate` then `reload`, no other site cut | §1 (compose override, recreate runbook), §2 (adapt-verified syntax, throwaway validate), per-site HTTP before/after script |
| HEB-02 | Push on main deploys production rebuild to `releases/<sha>/`, atomic `current` switch, smoke test | §3 forced command, §4 `deploy` job |
| HEB-07 | `/version.json` with commit + date | §5 (`src/pages/version.json.ts`, check-dist rule, test server MIME) |
| HEB-08 | Security headers, compression, `no-cache` HTML, long cache on hashed files | Block already has headers/encode/no-cache; **no hashed files exist after the Phase 7 inlining** (dist = html/txt/xml only), so the long-cache clause is vacuous: record as ADR note + test "dist has no file type other than html/txt/xml/json" |
| HEB-09 | Access log ≤14 days, masked IP, no UA/Referer, Mentions légales exact | `roll_at`/filters verified by `caddy adapt` on 2.11.2; runtime check of a real log line; error-stream caveat (Pitfall 9) |
| HEB-10 | Dedicated restricted key, pinned host key, secrets in Environment, repo test | §3, §4, repo test list |
| HEB-11 | Rollback < 2 min by `workflow_dispatch`, timed round trip | §3 `retour` command, §4 `rollback.yml`, timing protocol |
| HEB-12 | Every production deploy waits for Erwan | Environment `production` required reviewer; prevent-self-review OFF (solo reviewer) |
| HEB-13 | Refuse deploy on 17-19 Apr and 1-3 May 2027 except documented emergency | `scripts/garde-gel.ts` + `gel` job, explicit inputs, node:test with injected date |
| HEB-14 | Password-protected technical host receives trial deploys | §1 essai block + env hash, §4 target variable, Open Question O1 (SITE_VIDE) |
| PERF-02 | Cold load of heaviest page < 1 s on "Slow 4G simulé", real measurement logged | §5 remote Playwright run + manual lighthouse |
| OPS-01 | External content probe, Telegram alert after 3 failures + recovery, simulated outage | §6 |
| OPS-02 | VPS heartbeat: alive, disk 85/92 %, cert < 14 d | §6 |
| OPS-03 | Server config in repo or backed up; real restore before opening, then monthly | §7 |
</phase_requirements>

## Summary

The caddy container is **defined by Docker Compose** (project `vaultwarden`, `/opt/vaultwarden/docker-compose.yml`, mode 600 root, service `caddy`, `container_name: caddy`, `mem_limit: 192m`, three networks). It runs **Caddy v2.11.2 as root** with three bind mounts (Caddyfile single-file read-only, `caddy_data`, `caddy_config`). Everything D-05 wants to confirm has been confirmed on the live container with `caddy adapt` (parse-level, nothing changed): `roll_at`, `roll_keep`/`roll_keep_for`, `filter` encoder with `ip_mask 24 48`, `delete` on `request>headers`/`request>tls`, and `request>client_ip` all adapt cleanly; `basic_auth` with `{$ENV}` works but **fails the whole adapt if the variable is empty**, which is the main operational hazard (an unset variable at the next reload or container restart takes down every site). The Docker daemon already caps `json-file` logs at 10m x 3 for all containers, so D-06 is already satisfied at daemon level; set it explicitly in the override anyway.

The recommended minimal change is **not an edit of the secret-bearing compose file**: add a versioned `docker-compose.override.yml` (auto-merged by `docker compose` in `/opt/vaultwarden`) plus a root-only `.env` holding the bcrypt hash, one `import /etc/caddy/sites.d/*.caddy` line appended **in place** to the Caddyfile, and recreate with `docker compose up -d --no-deps --force-recreate caddy`. Deploy uses **one SSH key whose forced command is a small bash dispatcher**: `rsync --server` is delegated to `rrsync -wo -no-del` rooted at an `incoming/` folder (never the live tree), and three whitelisted verbs (`activer`, `retour`, `etat`) do the atomic relative-symlink switch (`ln -s` to a temp name + `mv -T`), rotation to 5, free-space guard and rollback.

Two repo findings change the plan: **(1) the `SITE_VIDE` guard does not exist in the code** (grep over `src`, `scripts`, `tests`, `docs`, `config` is empty; only `.planning/research` mentions it), so D-07's "flag that lifts only SITE_VIDE" has nothing to lift; **(2) an essai build under `RTP_DEPLOIEMENT=1` is refused today** by the contact-provisional and hébergeur-`prevu` guards, not only by domain/SITE_VIDE. See Open Questions O1/O2.

**Primary recommendation:** Build everything repo-side first (renderer extension for the essai block, `ops/` scripts with stub-based `node:test` tests, `/version.json`, `deploy` job gated by a repo variable so CI stays green while dormant, `rollback.yml`, `garde-gel`, heartbeat script, probe workflow); then do the server steps that need no DNS (compose override + recreate, deploy user, first deploy over SSH to the IP, heartbeat cron); leave ACME/HTTPS, PERF-02, the GitHub approval round trip, simulated outage and restore test for after DNS.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build + check-dist of the deployable `dist` | CI runner (GitHub Actions) | — | Never build on the shared 4 GB VPS |
| Approval, secrets, freeze gate | GitHub (Environment `production`, `gel` job) | — | Secrets scoped to Environment; reviewer click = HEB-12 |
| Upload (rsync over SSH) | CI runner -> VPS `deploy` user | rrsync | Forced command restricts to `incoming/` |
| Activation, atomic switch, rotation, rollback | VPS forced-command script | Caddy (reads `current`) | Only the host can change the symlink; one place, unit-testable |
| TLS, headers, compression, access log, basic_auth | Caddy container | — | Generated block (`render-caddy.ts`) is the single source |
| `current` resolution | Caddy container (read-only mount) | Host fs | Relative link `releases/<sha>` resolves inside the mount |
| `/version.json` content | Astro build (CDN/Static tier) | Smoke test in CI | Generated at build, served as a static file |
| External availability/content probe | GitHub scheduled workflow -> Healthchecks.io | VPS heartbeat | Healthchecks.io is a dead-man's switch, not an HTTP prober |
| Disk, cert, alive | VPS cron (root, `/etc/cron.d`) -> Healthchecks.io | — | Must run on the machine |
| Config backup / restore test | VPS script + repo (reconstruct) | Hetzner backups (Erwan checks) | Config is small and reproducible from the repo |

## Standard Stack

### Core
| Library / tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Caddy (container `caddy:2-alpine`) | **v2.11.2** `[VERIFIED: ssh keel-vps docker exec caddy caddy version, 2026-11-08]` | TLS, headers, log, basic_auth | Already running; do **not** pull a newer image during this phase |
| Docker Compose (v2) | 2.40.3 on host, container labelled by compose 5.4.0 `[VERIFIED: ssh]` | Defines caddy | Existing; use override file |
| OpenSSH forced command (`restrict,command=`) | host OpenSSH (Ubuntu 24.04) | Restrict deploy key | Standard, no extra tool |
| rsync 3.2.7 + `rrsync` (python3 script, `-wo`, `-no-del`, `-munge`) | `[VERIFIED: ssh, /usr/bin/rrsync --help options]` | Validated receive | Tested code; do not hand-roll rsync arg validation |
| bash + coreutils (`ln`, `mv -T`, `flock`, `df`), `jq` 1.x, `openssl`, `curl` | all present `[VERIFIED: ssh command -v]` | ops scripts | No new install on the VPS |
| `node:test` (Node 24) | in repo | Tests of ops scripts via stubs | Existing pattern (`tests/repo/diagnostic-vps.test.ts`, `caddy.test.ts`) |
| Healthchecks.io hosted (Hobbyist, free: 20 checks, 100 log entries/check) | `[CITED: healthchecks.io/pricing]` | Heartbeats + alert routing + Telegram | Decided D-14 |
| Lighthouse CLI 13.0.3 (Erwan's Mac, global, outside the project) | `[VERIFIED: lighthouse --version]` | Manual PERF-02 run | D-13 |

### Supporting
| Tool | Purpose | When |
|---------|---------|------|
| `actions/checkout` `3d3c42e5aac5ba805825da76410c181273ba90b1` (# v7.0.1) | Checkout in deploy/rollback/gel/sonde | Already pinned in `ci.yml` |
| `actions/setup-node` `949feb2413d6458794dcd2491c4babbbce0c15c1` (# v7.1.0) | Node 24 for build + `garde-gel.ts` | Already pinned |
| `actions/upload-artifact` `cf430e030ddbb5b0abf93d22962f4752f3646cd9` (# v7.0.2) | **Not used by deploy** (rebuild in job; never ship `site-preview`) | — |
| `gh` CLI | Create Environment, secrets, variables | Orchestrator or Erwan |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compose override file | Edit `docker-compose.yml` in place | In-place edit touches the 600-mode file that also defines Vaultwarden (admin token present in a backup copy name); override is versioned in the repo and survives. Risk: a future `docker compose -f docker-compose.yml up` ignores the override and recreates caddy without the mounts (document in RUNBOOK) |
| Single key + dispatcher | Two keys (rrsync key + switch key) | Two secrets to rotate; the dispatcher keeps one key and one audit point |
| GitHub scheduled probe + Healthchecks.io | UptimeRobot free (5-min keyword monitors) | Telegram and HTTP basic auth on the **free** plan could not be verified; keep as optional second layer after checking the account |
| Healthchecks.io HealthchecksBot for Telegram | Erwan's existing bot via a Healthchecks "Webhook" integration to `api.telegram.org` | Existing bot works only through a webhook integration (bot token then lives in Healthchecks.io); the native Telegram integration uses Healthchecks' own `HealthchecksBot` and stores no token `[CITED: healthchecks.io/integrations/telegram]` |

**Installation:** none (no npm package, no apt package, no image pull). Everything reuses what exists on the VPS and runner.

**Version verification:** Caddy v2.11.2 read from the live container. rrsync option set read from `/usr/bin/rrsync --help` source (`-ro/-wo`, `-no-del`, `-munge`, `-no-lock`). Actions SHAs are the ones already in `.github/workflows/ci.yml`; Dependabot owns bumps.

## Package Legitimacy Audit

No external package is installed by this phase (no npm, pip, cargo, apt). slopcheck was therefore not run; nothing to flag.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | n/a | n/a |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none. Third-party deploy actions (`webfactory/ssh-agent`, `burnett01/rsync-deployments`, `appleboy/*`) are explicitly **not** used: plain `ssh` + `rsync` on the runner.

## Architecture Patterns

### System Architecture Diagram

```
 push main / workflow_dispatch(urgence)
        |
        v
 [verifier] [e2e] [secrets]  ---- all green ---->  [gel]  (garde-gel.ts: Paris date vs freeze windows,
                                                          emergency input + justification)
                                                      | ok
                                                      v
                              [deploy]  if vars.DEPLOY_CIBLE set  (skipped = dormant, CI stays green)
                              environment: production  --> Erwan approves (reviewer, main only)
                                |  secrets released: SSH key, known_hosts var, host var
                                v
        checkout(sha) -> npm ci -> build (RTP_DEPLOIEMENT=1 only if cible=production)
        -> check-dist -> guard "main head == this sha"
                                |  rsync -rlt --chmod=D755,F644  (ssh, key, pinned known_hosts, StrictHostKeyChecking=yes)
                                v
 VPS  sshd --(restrict,command=)--> /usr/local/sbin/rtp-deploy-command  (root-owned dispatcher)
        |-- "rsync --server ..." -> disk guard -> exec rrsync -wo -no-del /srv/reveletonprog/incoming
        |-- "activer <cible> <sha>" -> verify index.html + version.json.commit -> mv incoming->releases
        |                              -> ln -s releases/<sha> .current.tmp && mv -T -> current (atomic)
        |                              -> history append -> rotate to 5
        |-- "retour <cible> [sha]"  -> same switch to previous/explicit release
        '-- "etat <cible>"          -> current sha, #releases, free MiB
                                |
 Caddy container (root, ro mount /srv/reveletonprog, rw /var/log/caddy, env RTP_ESSAI_HASH)
   essai.<domaine> {basic_auth, noindex, robots Disallow, root .../essai/current, log -> essai.log}
   <domaine>, www  {root .../current, log -> reveletonprog.log}   <- imported in Phase 9 only
                                |
   smoke: ssh etat == sha ; curl https://.../version.json (.commit == sha, HSTS+CSP headers)

 Monitoring (outside-in and inside-out):
   GitHub schedule (sonde.yml, every 10 min, Environment `sonde`) --curl content--> OK: ping HC
                                                                      KO: ping HC /log only (no ping)
   VPS cron */5 (battement.sh) --> HC checks: battement, disque-85, disque-92, certificat
   HC (period+grace = ~3 misses) --> Telegram (down + recovery)
```

### Recommended Project Structure
```
ops/
├── diagnostic-vps.sh            # existing (Phase 6)
├── installer-serveur.sh         # idempotent; --verifier (default, no change) / --appliquer; steps selectable
├── commande-deploiement.sh      # forced-command dispatcher (installed to /usr/local/sbin/rtp-deploy-command)
├── verifier-sites.sh            # per-site HTTP codes before/after (counts + index only)
├── valider-caddy.sh             # throwaway container validate (read-only)
├── battement.sh                 # heartbeat (disk, cert, content) -> Healthchecks.io
├── sauvegarder-config.sh        # tar of config; restore-test helper
└── tester-restauration.sh       # monthly restore proof, pings a Healthchecks check
deploy/
├── caddy/site.caddy             # existing generated (production)
├── caddy/essai.caddy            # NEW generated (technical host)
└── compose/docker-compose.override.yml   # NEW (no secrets; ${RTP_ESSAI_HASH:?})
scripts/
├── render-caddy.ts              # extend: second target "essai"
└── garde-gel.ts                 # NEW: freeze windows, pure function + CLI
src/pages/version.json.ts        # NEW
.github/workflows/ci.yml         # + gel, deploy jobs; + workflow_dispatch inputs
.github/workflows/rollback.yml   # NEW
.github/workflows/sonde.yml      # NEW (schedule)
tests/repo/                      # commande-deploiement, installer-serveur, garde-gel, deploy-workflow, battement, ci (extended)
```

### Pattern 1: Compose override + env file (recreate caddy once)
**What:** `/opt/vaultwarden/docker-compose.override.yml` (copied from the repo) merged automatically with the original; `/opt/vaultwarden/.env` (root, 600) holds `RTP_ESSAI_HASH='...'` in **single quotes** (bcrypt contains `$`; single-quoted values are literal for compose interpolation).
```yaml
# deploy/compose/docker-compose.override.yml  (no secret in it)
services:
  caddy:
    volumes:
      - /srv/reveletonprog:/srv/reveletonprog:ro
      - /var/log/caddy:/var/log/caddy
      - /opt/vaultwarden/sites.d:/etc/caddy/sites.d:ro
    environment:
      RTP_ESSAI_HASH: ${RTP_ESSAI_HASH:?RTP_ESSAI_HASH manquant dans /opt/vaultwarden/.env}
      RTP_SONDE_HASH: ${RTP_SONDE_HASH:?RTP_SONDE_HASH manquant dans /opt/vaultwarden/.env}
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
```
`import /etc/caddy/sites.d/*.caddy` is appended **once, in place** (`cat >> Caddyfile`, never `sed -i`/`mv`/editor-with-rename) because the Caddyfile is a **single-file bind mount**: replacing the inode leaves the running container on the old file (inode 265375 verified identical inside and outside today). A directory mount (`sites.d`) does not have that problem, so site blocks are updated by `mv` of whole files there. A glob import matching no file is only a warning (`Nofilesmatchingimportglobpattern`, verified), so the import line can go in before the mounts exist.
**Verification of env interpolation** (no secret printed): `docker compose config --format json | jq -r '.services.caddy.environment.RTP_ESSAI_HASH' | cut -c1-7` must print `$2a$14$` (or `$2y$..`). `docker compose config -q` alone for syntax (a plain `config` would print the Vaultwarden service's secrets, do not run it unfiltered).
**Hazard + hardening:** Caddy substitutes `{$VAR}` before parsing; an empty value makes the **whole** Caddyfile fail (`username and password cannot be empty or missing`, reproduced on the live container). Render the block with a non-matching default hash so a missing variable degrades to "nobody can log in" instead of "every site down": `essai {$RTP_ESSAI_HASH:$2a$14$<53 fixed chars of a hash whose preimage was discarded>}` (adapt-verified syntax with `:default`, 2026-11-08). Keep compose `${VAR:?}` too (fails at compose time, before anything is recreated).
**Hash creation:** on Erwan's Mac, `docker run --rm -it caddy:2-alpine caddy hash-password` (interactive prompt, plaintext never in argv or on the VPS) -> paste hash into `.env`; plaintext into Vaultwarden. Same for the probe user `sonde` (second credential, separate hash, so the probe secret can be rotated without touching Erwan's login). Changing a hash later needs another recreate (env read at parse time).

### Pattern 2: Forced-command dispatcher (core of the deploy)
```bash
# /usr/local/sbin/rtp-deploy-command   (root:root 0755; installed from ops/commande-deploiement.sh)
set -euo pipefail
BASE=${RTP_BASE:-/srv/reveletonprog}           # overridable in tests
RRSYNC=${RTP_RRSYNC:-/usr/bin/rrsync}
GARDER=5; MIN_LIBRE_MIO=1024; MAX_UTILISE_PCT=92
cmd=${SSH_ORIGINAL_COMMAND:-}
[[ "$cmd" =~ ^[A-Za-z0-9\ ._/=,+-]+$ ]] || { echo "refusé: caractères" >&2; exit 64; }   # no ; & | $ ` ( ) < > quotes, newline
read -r -a t <<<"$cmd"
re_sha='^[0-9a-f]{40}$'
racine() { case "$1" in essai) echo "$BASE/essai";; production) echo "$BASE";; *) exit 64;; esac; }
case "${t[0]}" in
  rsync)   # "rsync --server -vlogDtpre.iLsfx . essai/<sha>/"
           [[ "${t[1]:-}" == "--server" ]] || exit 64
           last=${t[-1]}; [[ "$last" =~ ^(essai|production)/[0-9a-f]{40}/?$ ]] || exit 64
           garde_espace; mkdir -p "$BASE/incoming/${last%%/*}"
           exec "$RRSYNC" -wo -no-del "$BASE/incoming" ;;        # rrsync re-reads SSH_ORIGINAL_COMMAND itself
  activer) [[ ${#t[@]} -eq 3 && "${t[2]}" =~ $re_sha ]] ...  # verify index.html + jq -e '.commit==sha', mv -T, switch, history, rotate
  retour)  # [sha] optional: default = previous distinct sha in history whose release dir still exists
  etat)    # prints: courant=<sha> versions=<n> libre_mio=<n> lien=<readlink>
  *) exit 64 ;;
esac
# atomic switch (rename(2) on the same fs). Plain `ln -sfn` unlinks then links: NOT atomic.
basculer() { ( cd "$1" && ln -s "releases/$2" .current.tmp && mv -T .current.tmp current ); }
```
Facts for the planner: (a) the link target is **relative** (`releases/<sha>`), so it resolves inside the container mount; (b) `mv -T` fails closed if `current` is a real directory; (c) history file `$racine/.historique` (append-only `ISO sha`) drives "previous" so a second `retour` toggles back (round trip); (d) rotation deletes only directories whose names match the 40-hex regex, never the current or previous release, newest 5 by history; (e) upload goes to `incoming/<cible>/<sha>/` and only `activer` moves it to `releases/`, so the live release is never written by rsync (a leaked key cannot edit the live tree in place); (f) `flock -w 20 $BASE/.verrou` around activer/retour; (g) disk guard = free >= 1024 MiB and used% < 92 before accepting an upload; (h) stale `incoming/*` older than 1 day removed at each call; (i) exit codes: 64 refused, 75 no space, 1 failure; one-line machine-readable output for the workflow.
`rrsync` option notes: `-wo` (write only), `-no-del` (refuses `--delete*`/`--remove*`), `-munge` optional. `--chmod` is applied by the **sender** when pushing, so it is not forwarded and not whitelisted server-side; use `rsync -rlt --chmod=D755,F644` (no `-a`, no `-p/-o/-g`) from the runner. `[ASSUMED]` that rrsync 3.2.7 accepts exactly the option string a runner's rsync 3.2.7 sends for `-rlt --stats --human-readable`; **prove with a real `rsync -n` dry-run from the Mac/runner before trusting it** (test T-rrsync below).

### Pattern 3: authorized_keys line and user
```
# /home/deploy/.ssh/authorized_keys  -> owned root:root 0644, .ssh root:root 0755 (the deploy user cannot rewrite its own restriction)
restrict,command="/usr/local/sbin/rtp-deploy-command" ssh-ed25519 AAAA... rtp-deploy-github
```
`useradd --system --create-home --shell /bin/bash --user-group -p '*' deploy` (shell must exist for `command=`; `-p '*'` avoids the locked-account `!` pitfall; sshd here has `UsePAM yes`, `PasswordAuthentication no`, `PermitRootLogin without-password`, no `AllowUsers`, so no sshd change is needed). No sudo, not in `docker` group (`id deploy` today: user does not exist, `docker` gid 110). `/srv/reveletonprog` owned `deploy:deploy` 0755; Caddy container is uid 0 so it reads regardless, files are still 0644/0755 for any future non-root image.

### Pattern 4: Per-target roots
Production keeps D-03 layout at the mount root (`/srv/reveletonprog/{releases,current}`), the technical host lives in `/srv/reveletonprog/essai/{releases,current}`; `incoming/` is shared (`incoming/essai/<sha>`, `incoming/production/<sha>`). `render-caddy.ts` gets a second output (`essai.caddy`, `root * /srv/reveletonprog/essai/current`, own log file `essai.log`, same header/CSP/encode set); `RACINE_SERVEUR` stays for production, so existing drift tests and the `site.caddy` stay valid.

### Anti-Patterns to Avoid
- `rsync --delete` onto the live tree; `ln -sfn` alone as "atomic"; absolute symlink target (404 in the container); `ssh-keyscan` or `StrictHostKeyChecking=no` in CI; `${{ }}` inside `run:` bodies (existing repo test forbids it; pass via `env:`); `docker restart caddy` for config changes; editing the Caddyfile through a rename (breaks the single-file bind mount); applying the apex/`www` block before DNS exists (ACME retry loop, Let's Encrypt rate limits).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| rsync argument validation / path jail | custom parser of `rsync --server` options | `rrsync -wo -no-del <incoming>` | Maintained, handles option whitelist, `..`, absolute paths |
| Atomic publish | in-place copy or `ln -sfn` | tmp symlink + `mv -T` (rename) | Only rename(2) is atomic |
| bcrypt hashing | script around `htpasswd`/python | `caddy hash-password` in a container | Caddy-native format |
| Password prompt in CI / process list | `curl -u user:pass` | `curl --config -` (stdin) or `--netrc-file` in `$RUNNER_TEMP` | Keeps secret out of argv |
| Date logic for freeze | bash `date` arithmetic in YAML | `scripts/garde-gel.ts` pure function (TZ Europe/Paris, injected clock) | Testable; `src/lib/dates-tours.ts` already holds the two round dates |
| HTTP prober / uptime SaaS | self-hosted Uptime Kuma (RAM: 230 MB free) | GitHub scheduled workflow + Healthchecks.io dead-man's switch | No VPS RAM, no new vendor |
| Cert expiry parsing | grep of `-enddate` dates | `openssl x509 -noout -checkend 1209600` | Exit code, no date parsing |
| Deploy GitHub Action | `appleboy/*`, `webfactory/ssh-agent`, `burnett01/*` | plain `ssh`/`rsync` | Supply-chain surface for ~20 lines |

**Key insight:** every risky capability here (jail, atomicity, hashing, TLS expiry) has a primitive that already guarantees it; the repo's job is to compose them and to test the composition with stubs.

## Runtime State Inventory

Not a rename/refactor phase, but it modifies a shared live machine; the equivalent inventory of what the VPS already holds (structure only, no names or contents):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Caddy cert store `caddy_data` (existing certs of the other sites) | None, preserved by the recreate (bind mount). Do not delete or re-create |
| Live service config | One Caddyfile (single-file `:ro` bind mount, 88 non-empty lines, 15 site blocks, **0** `import`, **0** global options block, **1** existing `basic_auth`); admin API on `127.0.0.1:2019` inside the container works | Append one import line in place; no global block exists (so no global `log` change) |
| OS-registered state | `/etc/cron.d/`: 5 files incl. an existing 03:30 backup for Vaultwarden (`backup.sh`, `/opt/vaultwarden/backups`, 15 entries); root crontab has 32 non-empty lines; ufw active; timezone UTC, NTP synced | Add one new `/etc/cron.d/rtp-battement`; touch nothing else |
| Secrets/env vars | Caddy container env today: only PATH/CADDY_VERSION/XDG_* (names only) | Add `RTP_ESSAI_HASH`, `RTP_SONDE_HASH` via root-only `/opt/vaultwarden/.env`; Healthchecks UUID URLs in `/etc/rtp/battement.env` (0600 root) |
| Build artifacts | `/srv/` has an unrelated `keel` folder; `/var/log/caddy` and `/srv/reveletonprog` do not exist | Create both; disk `/` 58 % used, 16 GB free (HEB-04 margin) |

## Common Pitfalls

### Pitfall 1: Empty `{$RTP_ESSAI_HASH}` takes every site down
**What goes wrong:** Caddy adapt aborts, `caddy reload` is refused (old config stays, safe) but a **container restart/recreate with the variable missing crash-loops Caddy** (`restart: unless-stopped`), cutting ~15 sites.
**Why:** `{$VAR}` is substituted before parsing; empty hash is a config error (reproduced).
**Avoid:** compose `${VAR:?}`; default dummy hash in the rendered block; pre-flight `docker exec caddy printenv RTP_ESSAI_HASH | cut -c1-4` before any reload; throwaway validate with `-e RTP_ESSAI_HASH=<dummy>`.
**Warning signs:** `adapt`/`validate` message "username and password cannot be empty or missing".

### Pitfall 2: Single-file Caddyfile mount goes stale
**What:** editing via rename/`sed -i`/editor swap makes the container keep the old inode; `reload` "succeeds" with old config.
**Avoid:** append/overwrite in place (`cat > file` keeps the inode); verify `stat -c %i` host vs `docker exec caddy stat -c %i /etc/caddy/Caddyfile` (and `wc -c`) equal after each edit.

### Pitfall 3: Recreate side effects
`depends_on: vaultwarden` and two external networks. Use `docker compose up -d --no-deps --force-recreate caddy` (does not touch vaultwarden), do **not** pull (image `caddy:2-alpine` locally is v2.11.2; latest stable is newer, an upgrade mid-phase mixes risks). Expect a few seconds of outage for all sites; `mem_limit: 192m` stays (check `docker stats --no-stream caddy` after first traffic). Run the per-site HTTP snapshot before and after; compare status codes by index, print counts only.

### Pitfall 4: Approval wait x concurrency x stale commit
A job waiting for approval may hold the concurrency slot (observe at the first run `[ASSUMED]`). With `cancel-in-progress: false` only one running and one pending run survive, newer pending replaces older. Erwan may approve an old SHA after `main` moved. Add a step that aborts if `git ls-remote https://github.com/$GITHUB_REPOSITORY refs/heads/main` is not the run's SHA (public repo, no credentials needed), and say so in the job summary.

### Pitfall 5: "Prevent self-review" breaks a solo reviewer
Erwan is the only collaborator; the Environment reviewer must be him with **prevent self-review OFF**, otherwise nobody can approve his own push `[CITED: docs.github.com deployments-and-environments]`. Required reviewers on a Free plan only work because the repo is public (keep it public, already a Phase 9 rule).

### Pitfall 6: Essai build refused by other guards (see O1)
Under `RTP_DEPLOIEMENT=1` the build already fails on provisional domain, provisional contact (`src/lib/site-config.ts`) and hébergeur `prevu` (`src/lib/hebergeur-config.ts`), independent of SITE_VIDE.

### Pitfall 7: Compression assertion in the 4G spec
`e2e/4g.spec.ts` asserts `content-encoding === 'gzip'`. The local test server only gzips; Caddy with `encode zstd gzip` will most likely answer **zstd** to Chromium (`[ASSUMED]`: Caddy honours its configured order when q-values tie). The remote run must accept `gzip|zstd|br` and log what it saw.

### Pitfall 8: Rollback and conditional requests
Release B has newer mtimes than A. Browsers send `If-None-Match` (ETag) with `If-Modified-Since`; Go's `ServeContent` gives ETag precedence, so a rolled-back page is not wrongly 304'd. Still verify after the timed rollback by fetching `/version.json` (served `no-cache`) and one HTML page, and compare commit.

### Pitfall 9: The 14-day log policy covers only the access log
Container stderr (ACME/TLS, `http.log.error`) keeps full IPs/headers and is bounded by **size** (10m x 3), not time; the 03:30 backup and any `docker logs` consumer see it. The legal text (Mentions légales, Phase 9) must say exactly this or the error log must be filtered (needs a global options block that does not exist today). Record as Open Question O4; do not silently promise 14 days for everything.

### Pitfall 10: Healthchecks.io does not probe URLs
It only receives pings. "External HTTP probe" must be our own script (GitHub schedule). Do not send `/fail` on a single probe failure (that alerts at once, violating "after 3 failures"); on failure send nothing (or `/log`) and let period + grace expire.

### Pitfall 11: GitHub schedule drift and the environment for secrets
Scheduled runs can be delayed minutes and are disabled after 60 days without repository activity `[ASSUMED, standard GitHub behaviour]`. Probe secrets cannot come from `production` (approval each run); use a second Environment `sonde` (no reviewers, branch main). Do not tighten period below ~10 min.

### Pitfall 12: AAAA records vs ACME
The VPS has global IPv6. If Erwan publishes AAAA, Let's Encrypt validates over IPv6 and fails if Docker does not forward `[::]:443` to the container. After DNS: `curl -6 -I https://essai.<domaine>` from outside before requesting certificates, or publish only A first.

### Pitfall 13: `.invalid` and certificate attempts
Never import `site.caddy`/`essai.caddy` while the domain ends in `.invalid`. Import the essai file only after `dig +short essai.<domaine>` returns the VPS IP; keep the apex/`www` block out of the import folder until Phase 9 (its absence is why nothing public is served and no `www` ACME loop can start).

## Code Examples

### 1. Throwaway validate of the real, merged config (read-only on the machine)
```bash
# ops/valider-caddy.sh : run from the host, changes nothing, same image ID as the live container
IMG=$(docker inspect caddy --format '{{.Image}}')
docker run --rm --network none --read-only \
  --tmpfs /tmp --tmpfs /data --tmpfs /config --tmpfs /var/log/caddy \
  -e RTP_ESSAI_HASH='$2a$14$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' \
  -e RTP_SONDE_HASH='$2a$14$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' \
  -v /opt/vaultwarden/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v "${SITES_D:-/opt/vaultwarden/sites.d}":/etc/caddy/sites.d:ro \
  "$IMG" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```
Expected: `Valid configuration`. `--network none` guarantees no ACME or upstream contact; `validate` provisions modules but does not start the servers. `[ASSUMED]` that opening the `output file` writer under tmpfs is harmless (it is, the path is a throwaway tmpfs). Already confirmed today at parse level on the running 2.11.2 with `docker exec -i caddy caddy adapt --config /dev/stdin --adapter caddyfile < deploy/caddy/site.caddy`: output contained `roll_at ["00:00"]`, `roll_keep 12`, `roll_keep_days 12`, `request>client_ip`/`request>remote_ip` `ip_mask` `ipv4_cidr 24` `ipv6_cidr 48`, `request>headers` and `request>tls` `filter: delete`. [VERIFIED: ssh keel-vps, 2026-11-08]

### 2. Recreate procedure (each mutating step = one D-01 approval)
```
0  READ-ONLY  ops/verifier-sites.sh avant   -> /root/rtp-avant-apres/avant.tsv   (host list read from live Caddyfile,
              curl --resolve host:443:127.0.0.1, status code per host; console prints: "N sites, N joignables", no names)
1  WRITE      backup: cp -p Caddyfile Caddyfile.bak-<AAAAMMJJhhmm>; cp -p docker-compose.yml docker-compose.yml.bak-<...>
              (same naming as the existing .bak-* files)
2  WRITE      mkdir -p /srv/reveletonprog/{incoming,releases,essai/releases} /opt/vaultwarden/sites.d /var/log/caddy
              chown deploy... (after step 5 of the user creation) ; install .env (0600), override file
3  READ-ONLY  docker compose config -q  (syntax)  +  jq/cut check of the interpolated hash prefix
4  WRITE      cat >> /opt/vaultwarden/Caddyfile  <<< 'import /etc/caddy/sites.d/*.caddy'   (in place)
5  READ-ONLY  ops/valider-caddy.sh   (throwaway container, new Caddyfile + empty sites.d)
6  MESSAGE    tell Erwan "coupure de quelques secondes de tous les sites dans 1 minute"
7  WRITE      cd /opt/vaultwarden && docker compose up -d --no-deps --force-recreate caddy
8  READ-ONLY  docker inspect caddy (mounts incl. 3 new, Env names only, LogConfig 10m/3, restart policy),
              stat -c %i host vs container, caddy version, ops/verifier-sites.sh apres + diff vs avant
9  ROLLBACK   if any site code differs: restore compose bak + Caddyfile bak, move override/.env aside,
              docker compose up -d --no-deps --force-recreate caddy; re-run verifier-sites
```

### 3. Deploy job skeleton (ci.yml addition; run bodies use `env:` only)
```yaml
  gel:
    name: Garde de gel des scrutins (17-19 avril, 1-3 mai 2027)
    needs: [verifier, e2e, secrets]
    if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main' && vars.DEPLOY_CIBLE != ''
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    outputs: { ok: ${{ steps.gel.outputs.ok }} }
    steps:  # checkout (persist-credentials false) + setup-node, then:
      - id: gel
        run: node scripts/garde-gel.ts --urgence "$URGENCE" --justification "$JUSTIFICATION"   # writes ok=true|false to $GITHUB_OUTPUT, summary
        env: { URGENCE: ${{ inputs.retrait_urgence }}, JUSTIFICATION: ${{ inputs.justification }} }
  deploy:
    name: Déployer
    needs: [verifier, e2e, secrets, gel]
    if: needs.gel.outputs.ok == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    environment: { name: production }
    concurrency: { group: deploy-production, cancel-in-progress: false }
    steps:
      # checkout(persist-credentials:false) ; setup-node ; npm ci ; abort if main head != $GITHUB_SHA
      # build: env RTP_CONTENT_ROOT=".", RTP_DEPLOIEMENT=<1 iff cible=production else 0>, GITHUB_SHA available to version.json
      # npm run check-dist -- --dist dist --mode production
      # write key (umask 077, $RUNNER_TEMP), known_hosts from vars; ssh opts: -o IdentitiesOnly=yes -o BatchMode=yes
      #   -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$RUNNER_TEMP/kh -o ConnectTimeout=15
      # rsync -rlt --chmod=D755,F644 --stats -e "ssh ..." dist/ "$DEPLOY_USER@$DEPLOY_HOST:$CIBLE/$GITHUB_SHA/"
      # ssh ... "activer $CIBLE $GITHUB_SHA"  ; ssh ... "etat $CIBLE" must print courant=$GITHUB_SHA
      # HTTPS smoke if vars.DEPLOY_URL set: curl --retry 5 version.json .commit == sha ; HSTS + CSP headers present
      # cleanup key/kh in `if: always()` step
```
`workflow_dispatch` is added to `ci.yml` with inputs `retrait_urgence` (boolean) and `justification` (string) so an emergency removal is possible during a freeze; `tests/repo/ci.test.ts` currently asserts only that `push` and `pull_request` exist and `pull_request_target` does not, so adding `workflow_dispatch` is compatible. The ids.lock step already treats an empty `github.event.before` as "no base" (exit 0).
Dormant mode: `DEPLOY_CIBLE` is a **repository variable** (job `if` can read `vars`, Environment vars are not available before the job reaches the Environment `[CITED: docs.github.com]`). Unset = both new jobs are skipped, CI stays green until the Environment exists (piste 0: 2026-11-20).

### 4. `/version.json`
```ts
// src/pages/version.json.ts  (Astro static endpoint -> dist/version.json)
import type { APIRoute } from 'astro';
const commit = process.env.GITHUB_SHA ?? 'dev';
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ commit, date: new Date().toISOString() }) + '\n',
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
```
Adjacent changes: `check-dist` rule (under `RTP_DEPLOIEMENT=1`: file exists, `commit` matches `^[0-9a-f]{40}$` and equals `GITHUB_SHA`; new code in `CODES_CHECK_DIST` + docs table in RUNBOOK + the docs test that lists codes); `e2e/serveur.ts` `TYPES` needs `.json`; Caddy `no-cache` already applies to it; sitemap/robots unaffected; `dev` fallback keeps local builds working. Include it in the "dist has only html/txt/xml/json" test (HEB-08 note).

### 5. Heartbeat (`ops/battement.sh`, cron `*/5` via `/etc/cron.d/rtp-battement`, root)
```bash
# /etc/rtp/battement.env (0600 root): HC_BATTEMENT=https://hc-ping.com/<uuid> HC_DISQUE85=... HC_DISQUE92=... HC_CERT=...
# RTP_HOTE=essai.<domaine>   RTP_SONDE_USER/RTP_SONDE_PASS (probe user, essai only)   RTP_DISQUES="/ <volume mountpoint>"
ping() { curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$2" "$1${3:-}" ; }
pct=$(df --output=pcent "$d" | tail -1 | tr -dc 0-9)
[ "$pct" -ge "${RTP_SEUIL1:-85}" ] && ping "$HC_DISQUE85" "disque $d ${pct}%" /fail || ping "$HC_DISQUE85" "ok ${pct}%"
[ "$pct" -ge "${RTP_SEUIL2:-92}" ] && ... "$HC_DISQUE92" ...
echo | openssl s_client -connect 127.0.0.1:443 -servername "$RTP_HOTE" 2>/dev/null | openssl x509 -noout -checkend $((14*86400)) \
  && ping "$HC_CERT" "ok" || ping "$HC_CERT" "expire < 14 j" /fail
curl -fsS -m 10 --resolve "$RTP_HOTE:443:127.0.0.1" --config - <<<"user = \"$U:$P\"" "https://$RTP_HOTE/version.json" | jq -e '.commit|test("^[0-9a-f]{7,40}$")' \
  && ping "$HC_BATTEMENT" "ok"      # no ping on failure -> Healthchecks.io goes late -> alert
```
Thresholds are env-overridable (`RTP_SEUIL1=1` etc.) so the simulated disk/cert alerts are produced **without filling the disk or touching certificates**. Pings only after all local checks have run; the script is a pure bash file testable under `node:test` with a `PATH` stub dir (fake `df`, `openssl`, `curl`, `jq` recording calls).

### 6. Atomic switch test idea (runs on macOS and Linux CI)
`RTP_BASE=$(mktemp -d)`; create `releases/<40hex>/index.html`; call dispatcher with `SSH_ORIGINAL_COMMAND="activer essai <sha>"`; assert `readlink current === releases/<sha>`, no `.current.tmp` left, rotation keeps 5, `retour` toggles back, refused commands exit 64 (`rm -rf /`, `rsync --server . ../../etc`, uppercase sha, 39-char sha, `;`, `$(...)`). `mv -T` is GNU-only: the test must run on Linux (CI `ubuntu-24.04`) or skip on darwin; keep the script POSIX-clean where possible (macOS has `mv` without `-T`: use `mv -fh`? not equivalent; therefore **tag the atomicity test `skip` on darwin** and keep it in the Linux CI `verifier` job via `npm test`).

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `basicauth` | `basic_auth` (renamed in Caddy 2.8) `[CITED: caddyserver.com/docs/caddyfile/directives/basic_auth]` | Use `basic_auth`; bcrypt default; hash via `caddy hash-password` |
| lumberjack log roller | timberjack in Caddy 2.11: `roll_at`, `roll_interval`, `roll_minutes`, `roll_keep_days` | Needs >=2.11: satisfied (2.11.2) |
| Hand-made rrsync config | `rrsync` python script with `-no-del`, `-munge` (rsync 3.2.x) | Use `-wo -no-del` |
| `ssh-keyscan` pinning | Verified host key line in an Environment variable | Compare against `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the VPS over the existing authenticated channel |

**Deprecated/outdated:** `STACK.md` claim that `rrsync` alone is enough (it cannot switch a symlink, as D-09 says); the RUNBOOK sentence "ajouter une ligne `import`" is correct but must name the mounted folder; STACK.md's "rtp-deploy" user name is superseded by the CONTEXT name `deploy`; the Uptime Kuma mention in the RUNBOOK Phase 8 list is superseded by D-14 (Healthchecks.io).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | rrsync 3.2.7 accepts exactly the option string sent by a runner rsync 3.2.7 for `-rlt --stats --human-readable` | Pattern 2 | Upload refused; adjust flags (test T-rrsync dry-run before trusting) |
| A2 | Caddy answers `zstd` rather than `gzip` to Chromium when `encode zstd gzip` | Pitfall 7 | Remote 4G spec's encoding assertion needs the relaxed form anyway; low |
| A3 | `caddy validate` in a `--network none --read-only` container with tmpfs paths succeeds without side effects | Code Ex. 1 | Adjust mounts; only `adapt` was run live |
| A4 | A log-config change (new `log` file output) is applied by `caddy reload` without a restart (STACK.md says a restart is needed, MEDIUM) | §1 | If wrong, one extra approved container restart; verify `/var/log/caddy/essai.log` appears after the first request |
| A5 | Healthchecks.io free plan includes the Telegram integration and "up" recovery notifications | §6 | Use a Webhook integration to the existing bot, or e-mail; verify in the account before relying on it |
| A6 | A waiting-for-approval job holds the concurrency group | Pitfall 4 | Only affects pending replacement semantics; observe once |
| A7 | GitHub disables scheduled workflows after 60 days of repo inactivity; schedules can be delayed | Pitfall 11 | Probe silently stops; the dead-man's switch itself alerts (that is why the probe pings on success) |
| A8 | `-p '*'` user creation + `restrict,command=` works with `UsePAM yes` | Pattern 3 | Key login refused; fall back to `usermod -U` or set a random unusable password |
| A9 | Hetzner Backups cost about 20 % of server price and keep 7 daily slots; they exclude attached Volumes | §7 | Docs confirm 7 daily slots and Volume exclusion (`[CITED: docs.hetzner.com]`); price is `[ASSUMED]` |
| A10 | Docker publishes 443 on IPv6 to the container | Pitfall 12 | ACME over AAAA fails; publish A only or fix IPv6 forwarding |
| A11 | Compose does not re-interpolate `$` inside a value that came from a single-quoted `.env` entry | Pattern 1 | Hash corrupted; verify with the `jq | cut -c1-7` check; fallback `$$` escaping or a `{file.}` placeholder |

## Open Questions

1. **O1: What does the essai build run under (D-07 vs reality)?**
   - Known: `SITE_VIDE` is not implemented anywhere in code; `RTP_DEPLOIEMENT=1` currently refuses provisional domain, provisional contact and hébergeur `prevu`.
   - Unclear: whether Erwan wants the essai deploy to wait for real contact + hébergeur `actif` (piste 0: 11-16 and 11-27, target essai ~11-27).
   - Recommendation: follow D-07 literally. Implement `SITE_VIDE` in check-dist now (error when `RTP_DEPLOIEMENT=1` and the production dist shows zero published measures) and an explicit `RTP_ESSAI=1` flag read only by that rule; the `deploy` job sets `RTP_ESSAI=1` only when `vars.DEPLOY_CIBLE == 'essai'` and never otherwise (repo test: the expression is the only place the flag appears and the production branch cannot receive it). Essai then needs real domain + contact + hébergeur `actif`, which are due by 11-27 anyway; if Erwan's Hetzner formality slips, the pipeline can still be proven by SSH-only deploy to the IP with `RTP_DEPLOIEMENT` unset (documented fallback, flagged in the summary, not on `main`).
2. **O2: Domain/DNS dates.** Domain not bought; everything HTTPS-dependent (SC1 headers over TLS, PERF-02, probe, cert check, approval round trip with HTTP smoke) is blocked until Erwan buys it and sets A (and AAAA after checking IPv6). Ask for `essai.<domaine>` A record first.
3. **O3: PERF-02 definition.** `src/lib/profil-4g.ts` has two profiles: `latence-150` (150 ms, 1.6 Mbit/s, budget 1000 ms) and `slow-4g-lighthouse` (562.5 ms, 1.44 Mbit/s, budget 1500 ms). Success criterion 4 says "< 1 s on Slow 4G simulé (Lighthouse)". Recommendation: label the **150 ms / 1.6 Mbit/s** profile "Slow 4G simulé" (these are Lighthouse's simulated Slow 4G network numbers), keep the 1500 ms DevTools-applied profile as a documented harsher profile, record both remote measurements and the manual Lighthouse FCP/LCP.
4. **O4: Error-stream retention.** Access log is 14 days max; stderr is size-capped only. Decide in Phase 9's Mentions légales wording (or add a global filtered error log later). Not blocking Phase 8.
5. **O5: Hetzner automatic backups** are not visible from the machine; Erwan checks the console (Server > Backups: automatic daily, 7 slots, off by default `[CITED: docs.hetzner.com]`). If off, decision whether to pay (about 20 % `[ASSUMED]`) or rely on repo-reconstructible config + the monthly restore test (D-15 allows the latter).
6. **O6: Which file system holds `/srv`?** `/` (sda1, 38 GB, 16 GB free) holds `/opt` and `/srv`; an attached 50 GB volume exists but is not used by this phase. Heartbeat should watch both mount points (list in `RTP_DISQUES`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| SSH to VPS (`ssh keel-vps`, root, key) | all server steps | ✓ | OpenSSH Ubuntu 24.04 | — |
| Docker + Compose on VPS | recreate, throwaway validate | ✓ | Docker 29.1.3, Compose 2.40.3 | — |
| Caddy image local | validate | ✓ | v2.11.2 (image id read from container) | — |
| rsync / rrsync / python3 on VPS | upload | ✓ | 3.2.7 / `/usr/bin/rrsync` / 3.12.3 | — |
| jq, openssl, curl on VPS | verify, heartbeat | ✓ | present | — |
| `deploy` user | forced command | ✗ (to create) | — | — |
| `/srv/reveletonprog`, `/var/log/caddy`, `/opt/vaultwarden/sites.d`, `.env`, override | mounts | ✗ (to create) | — | — |
| ufw | firewall | ✓ active; 22/80/443 open per Phase 6 | — | no rule change expected (SSH from GitHub runners uses 22) |
| Time sync / zone | cron, logs | ✓ UTC, NTP synchronized | — | cron times are UTC |
| Domain + DNS | HTTPS, probe, PERF-02 | ✗ | — | Pre-DNS work listed in Ordering |
| Healthchecks.io account + Telegram | OPS-01/02 | ✓ per D-14 (Erwan) | free | — |
| `lighthouse` on Erwan's Mac | PERF-02 manual | ✓ | 13.0.3 | — |
| GitHub Environment `production`, secrets, vars | deploy | ✗ (Erwan, piste 0 by 11-20; orchestrator can do via `gh api` if the token has admin) | — | dormant workflow |
| Local Docker daemon on the Mac | optional local Caddy functional test of headers/gzip before DNS | unknown (`/usr/local/bin/docker` exists) | — | run the same test as a throwaway container on the VPS bound to `127.0.0.1` (needs approval) |
| fail2ban on VPS | — | ✓ | — | A run of wrong-pin retries from CI cannot ban valid key logins; ban applies only to failed auth |

**Missing with no fallback:** domain/DNS (blocks only the last wave).
**Missing with fallback:** local Docker daemon (use VPS throwaway container).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24, TS natively) + Playwright 1.64.1 for the remote 4G spec |
| Config file | none for node:test; `playwright.config.ts` (add an env switch `E2E_BASE_URL` for the remote run) |
| Quick run command | `fnm exec --using=24 node --test tests/repo/ci.test.ts tests/repo/caddy.test.ts tests/repo/commande-deploiement.test.ts tests/repo/garde-gel.test.ts tests/repo/battement.test.ts tests/repo/installer-serveur.test.ts tests/repo/deploy-workflow.test.ts` |
| Full suite command | `fnm exec --using=24 npm test` (currently 1811 tests green, `TZ=Europe/Paris node --test "tests/**/*.test.ts"`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEB-01 | essai/site blocks render deterministically, drift test, default dummy hash, no host hard-coded | unit | `node --test tests/repo/caddy.test.ts tests/repo/hote-en-dur.test.ts` | extend ❌ Wave 0 |
| HEB-01 | `caddy validate` of merged config in throwaway container; other sites unchanged | manual-live (read-only) | `ssh keel-vps 'bash -s' < ops/valider-caddy.sh` and `ops/verifier-sites.sh` | ❌ Wave 0 scripts |
| HEB-02 | dispatcher: activer/relative link/atomic/rotation 5/refusals | unit (Linux) | `node --test tests/repo/commande-deploiement.test.ts` | ❌ Wave 0 |
| HEB-07 | `version.json` built, check-dist rule, MIME in test server | unit/integration | `node --test tests/dist/*.test.ts tests/repo/ci.test.ts` | extend ❌ |
| HEB-08 | headers/encode/no-cache present in blocks; dist file-type allowlist | unit | `node --test tests/repo/caddy.test.ts` | extend ❌ |
| HEB-09 | block pins `roll_at`, `ip_mask`, deletes; live log line has masked IP and no `headers` | unit + manual-live | `node --test tests/repo/caddy.test.ts`; after traffic `ssh keel-vps "tail -1 /var/log/caddy/essai.log \| jq 'has(\"request\") and (.request.headers==null)'"` | partial ✅ |
| HEB-10 | workflow structure: no `pull_request_target`, no `RTP_MODE`, no preview artifact, `needs` triple, no `${{` in run, secrets only in deploy/rollback/sonde, pinned SHAs, StrictHostKeyChecking=yes, no `ssh-keyscan`/`=no` | repo test | `node --test tests/repo/ci.test.ts tests/repo/deploy-workflow.test.ts` | extend ❌ |
| HEB-11 | rollback workflow shape + dispatcher `retour` round trip + timed live round trip | unit + manual-live | `node --test tests/repo/commande-deploiement.test.ts tests/repo/deploy-workflow.test.ts`; timing in plan evidence | ❌ |
| HEB-12 | `environment: production` on deploy and rollback; Environment config verified | repo test + manual | `gh api repos/ErwanHenry/reveleTonProg/environments/production --jq '.protection_rules,.deployment_branch_policy'` | ❌ |
| HEB-13 | freeze windows inclusive, Paris date, emergency needs justification | unit | `node --test tests/repo/garde-gel.test.ts` | ❌ |
| HEB-14 | essai block has `basic_auth`, noindex header, robots Disallow; flag only on essai path | unit | `node --test tests/repo/caddy.test.ts tests/repo/deploy-workflow.test.ts` | ❌ |
| PERF-02 | remote Playwright 4G spec against essai host; lighthouse manual logged | e2e-live + manual | `E2E_BASE_URL=https://essai.<d> E2E_USER=.. E2E_PASS=.. E2E_DIST=dist fnm exec --using=24 npx playwright test --project=4g` | ❌ (config switch) |
| OPS-01 | probe workflow shape (no `/fail` on failure, secret from Environment `sonde`), live simulated outage | repo test + manual-live | `node --test tests/repo/deploy-workflow.test.ts`; outage per RUNBOOK | ❌ |
| OPS-02 | thresholds, ping/fail logic via stubs; live forced thresholds | unit + manual-live | `node --test tests/repo/battement.test.ts`; `RTP_SEUIL1=1 /usr/local/sbin/rtp-battement` | ❌ |
| OPS-03 | installer idempotent (run twice = no diff in dry-run), allowlist of commands, backup/restore scripts, real restore evidence | unit + manual-live | `node --test tests/repo/installer-serveur.test.ts` | ❌ |

### Sampling Rate
- **Per task commit:** the quick-run command for the touched area (< 30 s).
- **Per wave merge:** `fnm exec --using=24 npm test` and `npm run check`.
- **Phase gate:** full suite + CI green on `main` (check `gh run list` after every push) before `/gsd:verify-work`, then the live evidence checklist (HTTP before/after counts, timed rollback round trip, simulated outage alert + recovery screenshots/notes, restore report).

### Wave 0 Gaps
- [ ] `tests/repo/commande-deploiement.test.ts`: temp `RTP_BASE`, stub `RTP_RRSYNC`, malicious-command table, skip-on-darwin for `mv -T` atomicity.
- [ ] `tests/repo/installer-serveur.test.ts` and `diagnostic-vps.test.ts` style allowlist of mutating commands per step; dry-run output stable.
- [ ] `tests/repo/garde-gel.test.ts`: 2027-04-16/17/19/20 and 04-30/05-01/03/04 boundaries in Europe/Paris, DST (Paris is UTC+2 in April/May: check 23:30 UTC on 04-16 = 01:30 Paris on 04-17 is frozen), emergency input.
- [ ] `tests/repo/deploy-workflow.test.ts`: parse `ci.yml` deploy/gel, `rollback.yml`, `sonde.yml` (structure, pins, env-only secrets).
- [ ] `tests/repo/battement.test.ts`: stub PATH.
- [ ] Extend `tests/repo/ci.test.ts`: checkout count (3 -> 4+ with persist-credentials false everywhere), setup-node count/`.nvmrc`, `jobs` type includes `deploy`/`gel`, `permissions` rule still holds (workflow-level only), `workflow_dispatch` inputs, top-level concurrency unchanged.
- [ ] Extend `tests/repo/caddy.test.ts` (essai target, dummy-default hash, `X-Robots-Tag`, robots override) and `.gitattributes` `text eol=lf` for `deploy/caddy/essai.caddy` and `ops/*.sh`.
- [ ] Playwright config switch for remote base URL (no webServer, `httpCredentials`).
- [ ] No framework install needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Caddy `basic_auth` bcrypt (technical host); SSH key-only (`PasswordAuthentication no`, verified) |
| V3 Session Management | no | Stateless static site |
| V4 Access Control | yes | `restrict` + forced command + `rrsync -wo -no-del`; GitHub Environment reviewer + branch policy; root-owned `authorized_keys` |
| V5 Input Validation | yes | Strict charset + regex whitelist of `SSH_ORIGINAL_COMMAND`, 40-hex SHA only, no eval |
| V6 Cryptography | yes | ed25519 key, pinned host key, bcrypt via `caddy hash-password`, TLS by Caddy ACME; never hand-roll |
| V7/V8 Logging, data protection | yes | Access log masked IP /24 /48, headers/tls deleted, 14-day cap; secrets only in Environment/root-only files |
| V14 Configuration | yes | Actions pinned by SHA, `persist-credentials: false`, no third-party deploy action, no `pull_request_target` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Leaked deploy key writes arbitrary files / runs commands | Elevation | forced command, no shell, no sudo, write-only `incoming/`, live tree not writable by rsync |
| Command injection through `SSH_ORIGINAL_COMMAND` | Tampering | charset gate + token regexes, `exec` with fixed argv, no `eval`/`bash -c` |
| MITM on first connection | Spoofing | known_hosts line in Environment var, `StrictHostKeyChecking=yes`, no keyscan |
| Unreviewed or stale deploy | Tampering | required reviewer, main-only, "main head == sha" check, freeze gate |
| Preview/draft content shipped | Information disclosure | no `RTP_MODE` in job, no artifact download, check-dist production mode |
| Secret in logs/argv | Information disclosure | `env:` passing, `curl --config -`, umask 077 key file removed in `always()` step, gitleaks job remains required |
| Empty env var downing all sites | DoS | dummy default hash, compose `:?`, pre-flight check |
| Disk fill by releases/logs | DoS | 5-release rotation, disk guard in dispatcher, log roll caps, heartbeat 85/92 % |
| Healthchecks ping URL leakage | Spoofing of "alive" | URLs in root-only file / GitHub secret, never in repo |
| Probe credential reuse | Spoofing | separate `sonde` user and hash, Environment `sonde` secret |

## Healthchecks.io, probe and heartbeat design (OPS-01, OPS-02)

Checks to create (free plan: 20, 100 log entries each; ~6 used) `[CITED: healthchecks.io/pricing]`. Slug/UUID URLs form `https://hc-ping.com/<uuid>` with `/fail`, `/start`, `/log` variants; do not ping one check more than 5 times per minute `[CITED: healthchecks.io/docs/http_api]`.

| Check | Fed by | Schedule (Simple) | Alert when | Notes |
|---|---|---|---|---|
| `vps-battement` | VPS cron `*/5`, only if local content check (essai `version.json`) + all local probes ran | period 5 min, grace 10 min | no ping for ~15 min (machine down, Docker down, cron dead, content broken) | covers "machine tombée" |
| `vps-disque-85` | VPS cron | 5 / 10 | `/fail` at >= 85 % (any listed mount) | recovery message when back < 85 |
| `vps-disque-92` | VPS cron | 5 / 10 | `/fail` at >= 92 % | second, louder alert |
| `vps-certificat` | VPS cron | 5 / 10 | `/fail` when `openssl x509 -checkend 1209600` fails | live `s_client` on 127.0.0.1:443 with SNI |
| `sonde-externe` | GitHub `sonde.yml`, `*/10`, Environment `sonde` | period 10 min, grace 20 min | ~3 missed pings (>= 30 min) | on probe failure send **nothing** (or `/log` with the reason); success pings; recovery = next ping |
| `restauration-mensuelle` | `ops/tester-restauration.sh` success | cron schedule `0 12 1 * *` Europe/Paris, grace 3 days | monthly test missed | OPS-03 cadence |

Telegram: in the Healthchecks.io project add the native Telegram integration (invite `HealthchecksBot`, `/start`, open the confirmation link, "Connect Telegram") `[CITED: healthchecks.io/integrations/telegram]`; down and up (recovery) messages are the default behaviour of a check state change `[ASSUMED]`, verified by the simulated outage. If Erwan insists on his **existing** bot, use a Healthchecks "Webhook" integration to `https://api.telegram.org/bot<TOKEN>/sendMessage` (token then stored at Healthchecks.io). Attach the integration to every check. The probe content check: `curl` the essai `/version.json` and `/` with the `sonde` credential, require HTTP 200, JSON `.commit` of 7-40 hex, and a marker string from the home page; after Phase 9 the same workflow drops the credential for the public host. The probe plus the heartbeat touch the site every <= 10 min, so the `roll_at` rotation timer (starts at first request after restart) is satisfied well within a day.

Simulated outage (D-14, on the essai host only, each mutating step approved): (1) `ssh keel-vps 'cd /srv/reveletonprog/essai && ln -s releases/_panne .p && mv -T .p current'` where `_panne/index.html` lacks the marker; (2) wait for 3 missed probe cycles, expect the Telegram "DOWN" message from `sonde-externe` (and `vps-battement` if its content check also uses the marker); (3) restore the previous link with the dispatcher `retour`; (4) expect the "UP" message. Disk/cert alerts: run `RTP_SEUIL1=1 /usr/local/sbin/rtp-battement` then `RTP_SEUIL2=1`, then `RTP_CERT_JOURS=9999`; no real disk fill. "Machine down": stop the cron (rename `/etc/cron.d/rtp-battement`) for 16 minutes, expect the alert, restore. Secrets: `/etc/rtp/battement.env` (0600 root), GitHub Environment `sonde` secrets; Vaultwarden copy by Erwan.

## Backups and restore (OPS-03)

Back up (all small): `/opt/vaultwarden/Caddyfile`, `docker-compose.yml`, the override, `.env`, `sites.d/`, `/etc/cron.d/rtp-*`, `/etc/rtp/battement.env`, `/home/deploy/.ssh/authorized_keys`, `/usr/local/sbin/rtp-*`, `/etc/ssh/ssh_host_*` public keys (fingerprints only, not private), and the `releases/` pointers (`.historique`, current sha). **Not** needed: site content (rebuildable from Git), certificates (Caddy re-issues; `caddy_data` already covered by the existing Vaultwarden backup scope? not verified, leave untouched).
The repo reconstructs everything except two secrets: `.env` hash lines and the Healthchecks URLs. Those two files live in Vaultwarden (Erwan, secure note) and in the root tarball on the VPS.
Mechanism: `ops/sauvegarder-config.sh` writes `/root/rtp-sauvegardes/AAAA-MM-JJ.tar.gz` (0600, keep 6); Erwan's Mac pulls it (pull, so the VPS holds no outbound credential), plus Hetzner backups if enabled.
Restore test (`ops/tester-restauration.sh`, also the "real restoration before opening"): (1) on a throwaway directory/containers, extract the latest tarball; (2) run `installer-serveur.sh --verifier --racine <tmp>` and diff generated files against the live ones (must be identical = idempotence + reconstructibility); (3) start a throwaway Caddy container from the same image on `127.0.0.1:18443` with `tls internal`-style local address, the restored Caddyfile/blocks and a clone of the repo built into a temp `releases/<sha>`; fetch `/version.json` and compare commit; (4) tear down; (5) ping the `restauration-mensuelle` check and append the dated result to `docs/RUNBOOK.md` or `RETROSPECTIVE.md`. Cadence: 1st of each month (matches Erwan's hygiene rule 6 and the monthly review already in RUNBOOK).
Hetzner: Backups = automatic daily copies in up to seven rotating slots; Snapshots = manual and permanent; neither includes attached Volumes `[CITED: docs.hetzner.com/cloud/servers/backups-snapshots/overview]`. Erwan checks in the console whether Backups are enabled and records the answer in the Phase 8 summary.

## PERF-02 measurement (D-13)

1. Pre-DNS sanity (optional): serve `dist` through a throwaway Caddy (Mac Docker or VPS) with the rendered headers/`encode` to see real compression and `no-cache`.
2. Post-DNS: add an env switch in `playwright.config.ts` (`E2E_BASE_URL`): no `webServer`, `use.baseURL`, `use.httpCredentials` from `E2E_USER/E2E_PASS`, projects limited to `4g`. `e2e/4g.spec.ts` keeps using `pageLaPlusLourde(E2E_DIST)` (build the same commit locally into `dist`); relax the `content-encoding` assertion to `/^(gzip|zstd|br)$/` and log it. The CDP emulation is applied to a context with Basic credentials; each of the 3 measures uses a fresh context (already the case). Run from Erwan's Mac (real latency to Nuremberg adds a little).
3. Manual Lighthouse (outside project deps): `lighthouse https://essai.<d>/themes/sante/ --only-categories=performance --output=json --output-path=./lh.json --extra-headers=./headers.json` where `headers.json` (chmod 600, deleted after) holds `{"Authorization":"Basic <base64 user:pass>"}`; default mobile config uses simulated throttling (Slow 4G: 150 ms RTT, 1.6 Mbit/s, CPU 4x). Record FCP, LCP, Speed Index, the page weight, and the Playwright figures; also one real-phone mobile-data run by Erwan; log the gap in `docs/RUNBOOK.md`, README, Méthode with the label « Slow 4G simulé ». Heaviest page today is `/themes/sante/` (180 590 raw bytes, about 29.6 kB gzip, from the Phase 7 notes).
4. Real device is LOW confidence for < 1 s (TLS handshakes cost RTTs the emulation does not add); publish the measured gap honestly rather than rounding.

## Ordering of steps (no-DNS first, DNS last) and suggested plan/wave split

**Wave 1: repo only, no server, no DNS, all parallelisable, every item testable in CI.**
- Plan 08-01 Caddy rendering: extend `render-caddy.ts` with the essai target (basic_auth with dummy-default env, `X-Robots-Tag`, robots override, own log file, own root), compose override file, drift/policy tests, `.gitattributes`. (HEB-01 part, HEB-08, HEB-09, HEB-14 part)
- Plan 08-02 Deploy mechanism scripts: `ops/commande-deploiement.sh`, `ops/installer-serveur.sh` (dry-run default; steps: dirs, user, authorized_keys, compose files, import line, cron), `ops/valider-caddy.sh`, `ops/verifier-sites.sh`, stub-based tests. (HEB-02, HEB-10, HEB-11 part)
- Plan 08-03 Build side: `/version.json`, check-dist rule(s) including `SITE_VIDE` + `RTP_ESSAI` (per O1), e2e server MIME, Playwright remote switch, HEB-08 dist allowlist test. (HEB-07, HEB-14 part, PERF-02 tooling)
- Plan 08-04 Workflows: `gel` + `deploy` in `ci.yml` (dormant via `vars.DEPLOY_CIBLE`), `rollback.yml`, `scripts/garde-gel.ts`, `sonde.yml`, extended `tests/repo/ci.test.ts` + new workflow tests. (HEB-02, 10, 11, 12, 13, OPS-01 part)
- Plan 08-05 Supervision + backup scripts + docs: `ops/battement.sh`, `ops/sauvegarder-config.sh`, `ops/tester-restauration.sh`, RUNBOOK sections (deploy, rollback, emergency removal pointer, monitoring, restore, label « Slow 4G simulé » placeholders). (OPS-01/02/03 part)

**Wave 2: server, still no DNS, each mutating step shown to Erwan and approved (D-01).**
- Plan 08-06 (checkpoint-heavy): read-only baseline (`verifier-sites.sh avant`, `valider-caddy.sh` dry), approval 1 stage `ops/` to `/opt/rtp`; approval 2 backups + dirs + `.env` + override + import line; approval 3 recreate Caddy (evening, with warning), verify before/after; approval 4 create `deploy`, install dispatcher + authorized_keys (public key generated by orchestrator/Erwan; private key straight into the GitHub secret then shredded, copy into Vaultwarden); approval 5 first SSH-only deploy of a built `dist` to `essai/releases/<sha>` over the IP, `etat`, timed `retour` round trip (HEB-11 server half); approval 6 install heartbeat cron and `/etc/rtp/battement.env` (UUIDs from Erwan); Erwan creates Healthchecks checks + Telegram integration; first backup run.
- Erwan actions in parallel (piste 0): Environments `production` (reviewer Erwan, prevent-self-review off, branch policy `main`, secrets `DEPLOY_SSH_KEY`, probe/essai credentials; vars `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_URL`) and `sonde`; repository variable `DEPLOY_CIBLE=essai` only when ready to switch the dormant jobs on.

**Wave 3: needs domain + DNS (A for `essai.<domaine>`; AAAA only after the IPv6 check).**
- Plan 08-07: set real domain in `config/site.yml` (Erwan), regenerate blocks, `dig` check, drop `essai.caddy` into `sites.d`, throwaway validate, `docker exec caddy caddy reload` (never restart), confirm ACME cert and the "no other site cut" diff, check headers/compression/no-cache/CSP/HSTS, first access-log line inspection (masked IP, no headers), `/version.json`.
- Plan 08-08: GitHub end-to-end (push -> approval -> deploy -> smoke) and timed rollback `workflow_dispatch` round trip; freeze-gate dry check; PERF-02 remote Playwright + manual Lighthouse + real-device note; publish « Slow 4G simulé » label in Méthode, README, RUNBOOK.
- Plan 08-09: Healthchecks end-to-end: simulated outage on essai (3 failures -> Telegram DOWN -> restore -> UP), forced disk 85/92 and cert alerts, "machine down" test; then the real restore test and recording the Hetzner backups answer; update RUNBOOK; final CI/`gh run list` check.

Steps that need Erwan's per-step approval under D-01: everything that writes on the VPS (staging, dirs, `.env`/override, import line, Caddy recreate, user creation, authorized_keys, cron, blocks into `sites.d`, reload, simulated-outage link switches, restore test directories). Read-only without approval: `ops/diagnostic-vps.sh`, `ops/valider-caddy.sh`, `ops/verifier-sites.sh`, `etat` dispatcher verb, installer in `--verifier` mode **run from stdin so it writes nothing**, HTTP/TLS checks, log inspection.

## Sources

### Primary (HIGH confidence)
- Live VPS, read-only, 2026-11-08 (`ssh -o BatchMode=yes keel-vps`): `docker inspect caddy` (image, restart, mounts, log config, compose labels, env names only), `docker exec caddy caddy version` (v2.11.2), `caddy list-modules` (filter encoder incl. `ip_mask`, `delete`; `http.authentication.providers.http_basic`, `hashes.bcrypt`; `encoders.zstd/gzip`), `caddy adapt` of `deploy/caddy/site.caddy` and of a test essai block (parse-level, nothing changed), compose caddy service section (secrets masked), `/etc/docker/daemon.json` (log caps), `sshd -T`, `getent`, `/usr/bin/rrsync` option list, `ls`, `df`, cron.d listing.
- Repo files read: `08-CONTEXT.md`, ROADMAP Phase 8, REQUIREMENTS, `06-RAPPORT-VPS.md`, `07-07-SUMMARY.md`, `07-REVIEW-FIX.md`, `deploy/caddy/site.caddy`, `scripts/render-caddy.ts`, `.github/workflows/ci.yml`, `tests/repo/ci.test.ts`, `docs/RUNBOOK.md` (Bloc Caddy section), `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `e2e/4g.spec.ts`, `e2e/serveur.ts`, `playwright.config.ts`, `src/lib/profil-4g.ts`, `src/lib/site-config.ts`, `src/lib/hebergeur-config.ts`, `src/lib/dates-tours.ts`.
- https://caddyserver.com/docs/caddyfile/directives/basic_auth (basic_auth rename in 2.8, bcrypt default, `{env.*}`/global placeholders)
- https://caddyserver.com/docs/caddyfile/concepts (`{$VAR}` and `{$VAR:default}` substituted before parsing; `import` globs)
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments (required reviewers, prevent self-review, branch policy, environment secrets/vars availability, public repos on Free plans)

### Secondary (MEDIUM confidence)
- https://healthchecks.io/pricing/ (Hobbyist: 20 checks, 100 log entries); https://healthchecks.io/docs/configuring_checks/ (period, grace, cron schedule, start/fail signals); https://healthchecks.io/docs/http_api/ (ping URL forms, rate limit 5/min); https://healthchecks.io/integrations/telegram/ (HealthchecksBot setup)
- https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/ (7 daily slots, snapshots manual, Volumes excluded)
- UptimeRobot 2026 free-plan reviews (50 monitors, 5-min, commercial use reportedly allowed since June 2026): not relied upon.

### Tertiary (LOW confidence, needs validation)
- Healthchecks.io free-plan inclusion of Telegram and automatic "up" messages (A5); Caddy zstd-first choice (A2); concurrency/approval interplay (A6); GitHub schedule behaviour (A7); Hetzner Backups price (A9).

## Metadata

**Confidence breakdown:**
- Standard stack / server facts: HIGH. Read from the live machine and repo today.
- Architecture (dispatcher, override, ordering): MEDIUM-HIGH. Built on verified primitives; rrsync option compatibility (A1) and env interpolation (A11) must be proven by the Wave 1/2 tests.
- Pitfalls: HIGH for the reproduced ones (empty env, inode, rename), MEDIUM for GitHub behaviours.
- Monitoring on Healthchecks free plan: MEDIUM.
- PERF-02 real device: LOW.

**Research date:** 2026-11-08
**Valid until:** 2026-11-22 for GitHub/Healthchecks behaviour; the VPS facts are valid until the next change on the machine (re-run `ops/diagnostic-vps.sh` and `docker inspect caddy` at the start of Wave 2).
