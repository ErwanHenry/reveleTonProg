# Phase 8: Serveur, pipeline, supervision et sauvegardes - Context

**Gathered:** 2026-11-08
**Status:** Ready for research and planning (execution of server steps needs the domain and DNS)

<domain>
## Phase Boundary

Chaque push validé sur `main` peut être déployé en HTTPS par Caddy, avec approbation d'Erwan, retour arrière en moins de 2 minutes, alertes Telegram et restauration éprouvée, d'abord sur un hôte technique protégé. Exigences : HEB-01, HEB-02, HEB-07, HEB-08, HEB-09, HEB-10, HEB-11, HEB-12, HEB-13, HEB-14, PERF-02, OPS-01, OPS-02, OPS-03. Pas d'ouverture publique ici (Phase 9) : la production publique reste bloquée par les gardes (`SITE_VIDE`, `RTP_DEPLOIEMENT=1`, hébergeur `prevu`, contact provisoire).

</domain>

<decisions>
## Implementation Decisions

### Qui agit sur le serveur
- **D-01:** L'orchestrateur (Claude) agit sur le VPS via `ssh keel-vps` (root), uniquement par des scripts versionnés et idempotents du dossier `ops/` (ou `deploy/`). Avant chaque étape qui modifie la machine, il montre à Erwan la commande et son effet, et attend son accord. Les étapes en lecture seule (diagnostic, `caddy validate` dans un conteneur jetable, vérifications HTTP) ne demandent pas d'accord.
- **D-02:** Un instantané Hetzner existe (2026-11-08). Le VPS est conservé tel quel (décision du 2026-11-07).

### Caddy en conteneur (constat de la Phase 6)
- **D-03:** Caddy tourne dans le conteneur Docker `caddy` (`caddy:2-alpine`), Caddyfile monté depuis l'hôte (`/opt/vaultwarden/Caddyfile`, environ 15 blocs, sans `import`), données et configuration montées. Le site sera servi depuis un montage en lecture seule `/srv/reveletonprog` (dans le conteneur) contenant `releases/<sha>/` et un lien relatif `current`. Le journal d'accès écrit dans un dossier hôte monté sur `/var/log/caddy`.
- **D-04:** Recréer le conteneur Caddy une fois (ajout des montages et de la variable d'environnement du hash `basic_auth`) : autorisé par Erwan « quand tu veux, en soirée », avec un message juste avant, une sauvegarde du Caddyfile et du fichier de composition, et une vérification HTTP de chaque site servi avant et après. Trouver d'abord comment le conteneur est défini (compose ou `docker run`) en lecture seule.
- **D-05:** Le bloc du site (`deploy/caddy/site.caddy`, généré en Phase 7) est ajouté au Caddyfile monté par une ligne `import` vers un fichier dédié, puis `caddy validate` et `caddy reload` dans le conteneur (`docker exec`), jamais `restart` sauf la recréation unique de D-04. Avant d'appliquer : `caddy validate` du bloc dans un conteneur jetable de la même image pour confirmer `roll_at`, `ip_mask 24 48`, `request>headers delete`, `request>client_ip` et la version de Caddy (2.11 ou plus).
- **D-06:** Les journaux du conteneur (stderr) sont plafonnés par les options de journal Docker (taille et nombre de fichiers) lors de la recréation (constat WR-01 de la Phase 7).

### Hôte technique protégé (HEB-14)
- **D-07 (révisée le 2026-11-08 après recherche):** Sous-domaine `essai.<domaine>`, protégé par `basic_auth`. Le hash bcrypt n'est jamais commité : variable d'environnement du conteneur (rendu avec une valeur par défaut factice pour qu'une variable absente ne casse pas tout le Caddyfile, et `${VAR:?}` côté compose). Le mot de passe en clair va dans Vaultwarden (Erwan). L'hôte technique reçoit une build de production **construite sans `RTP_DEPLOIEMENT`** (il est privé : contact et hébergeur provisoires y sont acceptés), avec `X-Robots-Tag: noindex` et un `robots.txt` qui interdit tout, posés par son bloc Caddy. Aucune garde n'est levée : la garde de déploiement public (`RTP_DEPLOIEMENT=1`) reste entière pour la cible `production`. La garde `SITE_VIDE` n'existe pas dans le code : ne pas l'inventer ici (la Phase 9 décide si une garde « au moins un thème publié » est utile). L'hôte technique est retiré à l'ouverture (Phase 9).

### Déploiement (HEB-02, HEB-10, HEB-11, HEB-12, HEB-13)
- **D-08:** Job `deploy` dans `.github/workflows/ci.yml` : `needs: [verifier, e2e, secrets]`, seulement sur `push` vers `refs/heads/main`, `environment: production` (relecteur requis : Erwan ; limité à `main`), `concurrency` sans annulation. Il reconstruit la build de production (sous `RTP_DEPLOIEMENT=1` pour la cible publique), lance check-dist, envoie dans `releases/<sha>/`, bascule `current` de façon atomique, fait un test de fumée, garde 5 versions.
- **D-09:** Utilisateur `deploy` sans sudo, clé ed25519 dédiée avec `restrict` et commande forcée. La recherche tranche le mécanisme : rrsync seul ne sait pas basculer un lien ; options : script de commande forcée avec liste blanche de `SSH_ORIGINAL_COMMAND` (rsync vers `releases/<sha>/`, bascule, rotation), ou deux clés. Empreinte du serveur épinglée dans une variable de l'Environment, jamais `ssh-keyscan`, jamais `StrictHostKeyChecking=no`.
- **D-10:** Retour arrière par `workflow_dispatch` (`rollback.yml`) qui rebascule `current` sur la version précédente en moins de 2 minutes, testé par un aller-retour chronométré. Gel des déploiements du 17 au 19 avril et du 1er au 3 mai 2027 dans le workflow, sauf retrait d'urgence documenté (entrée explicite).
- **D-11:** Test de dépôt : pas de `pull_request_target`, pas de `RTP_MODE` dans le job, aucun artefact preview déployé, `needs` des trois jobs, secrets seulement dans l'Environment.

### Version servie, performance (HEB-07, PERF-02)
- **D-12:** `/version.json` (commit, date de build) généré à la build.
- **D-13 (précisée le 2026-11-08):** PERF-02 : « Slow 4G simulé » désigne le profil `slow-4g-lighthouse` de `src/lib/profil-4g.ts` (562,5 ms par requête, 1,44 Mbit/s), mesuré à environ 730 ms en Phase 7. Son budget passe de 1 500 à **1 000 ms** (choix d'Erwan « Critère 4G à 1 s »). Le profil `latence-150` garde son budget de 1 000 ms. Mesure derrière le vrai serveur (hôte technique, identifiants `basic_auth` passés au test), consignée ; libellé « Slow 4G simulé » sur Méthode, README, RUNBOOK ; une mesure réelle à la main (`lighthouse` hors dépendances du projet) consignée avec son écart. Accepter zstd ou gzip derrière Caddy.

### Supervision et sauvegardes (OPS-01, OPS-02, OPS-03)
- **D-14:** Healthchecks.io (compte existant d'Erwan) + Telegram (intégration native HealthchecksBot, branchée par Erwan dans l'interface Healthchecks ; le bot existant d'Erwan seulement si l'intégration native manque). Healthchecks ne sonde pas les URL : la sonde externe est un workflow GitHub planifié qui ne pingue qu'en cas de succès, complété par le battement de cœur du VPS. Jetons et URL de ping dans les secrets ou sur le VPS hors dépôt, jamais commités. Sonde externe de contenu avec alerte après 3 échecs et message de rétablissement, testée par une panne simulée (sur l'hôte technique). Battement de cœur par cron de 5 min sur le VPS : site, disque (85 et 92 %), certificat (moins de 14 jours). La sonde doit toucher le site au moins une fois par jour (rotation du journal à la première requête, constat de la Phase 7).
- **D-15:** Sauvegarde : la configuration (Caddyfile importé, fichier de composition, cron, clés autorisées, script d'installation idempotent) est dans le dépôt ou reconstructible par lui ; une restauration réelle avant l'ouverture, puis chaque 1er du mois. Les sauvegardes Hetzner automatiques sont à vérifier par Erwan. restic seulement si nécessaire.

### Claude's Discretion
- Noms exacts des scripts (`ops/installer-serveur.sh`, `ops/commande-deploiement.sh`…), découpage en plans et vagues, ordre interne, tant que les étapes sans domaine (scripts, tests de dépôt, job de workflow en mode à sec, `caddy validate` jetable) passent avant celles qui demandent le DNS.

</decisions>

<constraints>
- Domaine pas encore acheté : les étapes qui demandent le DNS (certificat, hôte technique joignable) sont à la fin et attendent Erwan ; tout le reste se prépare et se teste avant.
- Aucun secret dans le dépôt (public) ; GitHub Environment `production` et Vaultwarden. Le rapport brut du serveur et le contenu du Caddyfile des autres sites ne vont jamais dans le dépôt.
- Node 24 via `fnm exec --using=24` ; aucune nouvelle dépendance npm ; actions GitHub épinglées par SHA, `persist-credentials: false`.
- Ne jamais modifier `src/content/**`, `archives/**`, `data/couverture-themes.yaml`.
- Vérifier la CI après chaque push.
</constraints>

<canonical_refs>
- `.planning/phases/06-diagnostic-du-vps-et-d-cision/06-RAPPORT-VPS.md`
- `.planning/phases/07-domaine-param-tr-inlining-et-dette/07-07-SUMMARY.md`, `07-REVIEW-FIX.md` (journal, `roll_at`, points Phase 8), `07-VERIFICATION.md`
- `deploy/caddy/site.caddy`, `scripts/render-caddy.ts`, `docs/RUNBOOK.md` (« Bloc Caddy (Phase 8) », étapes de déploiement), `docs/ARCHITECTURE.md` (ADR-049, 051, 053, 056)
- `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` (pièges 1 à 6, 9, 10, 12, 13)
- `.github/workflows/ci.yml`, `tests/repo/ci.test.ts`, `ops/diagnostic-vps.sh`
</canonical_refs>
