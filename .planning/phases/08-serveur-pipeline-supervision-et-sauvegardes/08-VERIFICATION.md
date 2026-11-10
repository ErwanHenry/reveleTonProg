---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
verified: 2026-11-10T19:30:00Z
status: human_needed
score: 6/6 roadmap success criteria verified; 13/14 requirements satisfied, OPS-01 partial (D1, human action pending)
overrides_applied: 0
gaps: []
deferred:
  - truth: "Le site public (nom nu et www) est servi en HTTPS et un déploiement de la cible production, construit sous RTP_DEPLOIEMENT=1, a réussi de bout en bout"
    addressed_in: "Phase 9"
    evidence: "Phase 9 SC5 : « le journal d'audit et ses empreintes sont refaits sur la build déployée, puis le site est ouvert avec l'hôte technique retiré » ; Phase 8 goal : « d'abord sur un hôte technique protégé »"
  - truth: "Les Mentions légales affichent la phrase exacte de la politique du journal (HEB-09), journaux d'erreurs du conteneur compris (IN-06)"
    addressed_in: "Phase 9"
    evidence: "Phase 9 SC4 : « Les Mentions légales finales portent ... la politique de journal exacte » ; phrase non rendue tant que hebergeur.yml est en statut prevu ; IN-06 ignoré dans 08-REVIEW-FIX avec renvoi en Phase 9"
  - truth: "L'hôte technique essai est retiré à l'ouverture (HEB-14, seconde moitié)"
    addressed_in: "Phase 9"
    evidence: "Phase 9 SC5 : « puis le site est ouvert avec l'hôte technique retiré »"
human_verification:
  - test: "D1, sonde externe : dans Healthchecks.io, passer le contrôle sonde-externe de 10 min / 20 min à 1 jour de période et 1 jour de grâce (action en cours d'Erwan le 2026-11-10), puis confirmer qu'aucune fausse alerte n'arrive sur Telegram pendant 48 h"
    expected: "Capture Healthchecks montrant sonde-externe à 1 jour / 1 jour et UP ; plus de DOWN parasite comme ceux de 10:11 et 12:44 le 2026-11-10"
    why_human: "Configuration Healthchecks et réception Telegram hors de portée du dépôt et du VPS ; la capture d'Erwan du 2026-11-10 montre encore 10 min / 20 min et DOWN"
  - test: "Décider le sort d'OPS-01 : accepter par écrit que la sonde externe GitHub ne garantisse plus « alerte après 3 échecs » (le battement du VPS, contrôle de contenu HTTPS toutes les 5 min, porte l'alerte rapide), ou ajouter un déclencheur externe (service de cron qui appelle workflow_dispatch avec un jeton limité à Actions)"
    expected: "Soit un override signé dans ce fichier (must_have OPS-01, accepted_by ErwanHenry, accepted_at), soit un plan de correction en Phase 9"
    why_human: "Arbitrage produit entre fiabilité de l'alerte externe et coût d'un service tiers ; seule la décision d'Erwan clôt OPS-01"
---

# Phase 8: Serveur, pipeline, supervision et sauvegardes Verification Report

**Phase Goal:** Chaque push validé sur `main` peut être déployé en HTTPS par Caddy, avec approbation d'Erwan, retour arrière en moins de 2 minutes, alertes Telegram et restauration éprouvée, d'abord sur un hôte technique protégé.
**Verified:** 2026-11-10T19:30:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

Toutes les preuves ci-dessous ont été relevées par le vérificateur le 2026-11-10 entre 19:15 et 19:30 UTC (dépôt à `a49b2b1`, version servie `25f43e6`), sauf mention « attesté » (fait humain consigné dans un SUMMARY et confirmé par Erwan, non rejouable sans écriture).

## Goal Achievement

### Observable Truths (Success Criteria du ROADMAP)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | HTTPS sur l'hôte technique protégé, en-têtes de sécurité, compression, `no-cache` HTML, cache long des fichiers hachés ; bloc appliqué par `validate` puis `reload` sans couper d'autre site ; `/version.json` donne commit et date | ✓ VERIFIED | `curl -sI https://essai.reveletonprog.fr/` : `HTTP/2 401`, `www-authenticate: Basic`, `x-robots-tag: noindex, nofollow` ; `robots.txt` lisible sans mot de passe (`Disallow: /`). Authentifié (sonde, `curl --config -`) sur `/`, `/methode/`, `/version.json` : 200, HSTS, CSP identique au bloc rendu, nosniff, `referrer-policy: no-referrer`, Permissions-Policy, COOP, sans `Server`, `cache-control: no-cache`, `content-encoding: zstd`. `/version.json` = `{"commit":"25f43e6…","date":"2026-11-10T19:14:35.283Z"}`. Cache long : clause vide par construction (aucun fichier haché séparé depuis l'inlining, ADR-056) et gardée par `check-dist` (`TYPE_FICHIER_INATTENDU`) et `tests/repo/caddy.test.ts` (aucun `/_astro/`) ; `dist/` sans `_astro`. Conteneur Caddy : `restarts=0`, `StartedAt` 2026-11-09T19:28:52Z inchangé depuis la recréation unique ; `verifier-sites.sh comparer` entre le relevé après 08-15 et maintenant : **17 identiques, 0 différent, 0 disparu**. `render-caddy.ts --check` : deux blocs à jour. |
| 2 | Push sur `main` aux jobs verts : build reconstruite, approbation d'Erwan, `releases/<sha>/`, bascule atomique, fumée ; clé restreinte, empreinte épinglée ; test de dépôt refusant `pull_request_target`, `RTP_MODE`, artefact preview | ✓ VERIFIED (cible essai ; production en Phase 9) | Run 42882087970 (25f43e6) : vérifier, e2e, gitleaks, changements, gel, construire, puis Déployer (approbation `ErwanHenry` sur `production`, API `approvals`) ; étapes 4 (garde de gel rejouée), 6 (tête de main), 7-8 (artefact du job construire, empreinte d'arbre, cible, aucun lien), 10 rsync, 11 version avant, 12 activer, 13 état, 14 fumée HTTPS : succès ; retour auto sauté ; clé effacée. VPS : `essai/current → releases/25f43e6…`, 5 versions gardées, journal `rtp-deploy` JSON (`envoi`, `activer`, code 0). Utilisateur `deploy` uid 996, seul groupe `deploy`, « not allowed to run sudo » ; `/home/deploy`, `.ssh` root 0755, `authorized_keys` root 0644, une ligne `restrict,command="/usr/local/sbin/rtp-deploy-command"` ; commande identique à `ops/commande-deploiement.sh`. Chaque `ssh` du workflow : `StrictHostKeyChecking=yes` + `DEPLOY_KNOWN_HOSTS` ; tests `deploy-workflow.test.ts` (ni `pull_request_target`, ni `ssh-keyscan`, `RTP_MODE` absent de changements/gel/construire/deploy, un seul download-artifact jamais `site-preview`). Cible essai construite avec `RTP_DEPLOIEMENT=0` par décision D-07 révisée ; cible production : `RTP_DEPLOIEMENT=1` câblé (`ci.yml` l. 312-317) et cible relue à l'approbation, mais jamais exécutée en vrai (différé Phase 9). |
| 3 | Retour arrière par `workflow_dispatch` < 2 min, chronométré ; refus de déployer du 17 au 19 avril et du 1er au 3 mai 2027 hors retrait d'urgence | ✓ VERIFIED | Runs `rollback.yml` 42707624664 et 42707883463 : run complet 58 s et 74 s (attente d'approbation comprise), job 14 s et 15 s. Depuis : `rollback.yml` n'a changé que de groupe de concurrence (WR-02) et le verbe `retour` de la commande forcée n'a pas changé (CR-01 ne touche que `activer` et `-munge`). Garde de gel jouée par le vérificateur (`--date`, TZ Europe/Paris) : 16/04 23:59 ok, 17/04 00:00 refus, 19/04 23:59 refus, 20/04 00:00 ok, 30/04 23:59 ok, 01/05 00:00 refus, 03/05 23:59 refus, 04/05 00:00 ok ; urgence + justification le 18/04 : ok. Garde dans le job `gel`, rejouée dans `deploy` après l'approbation (CR-02, vue dans le run 42882087970) et dans `rollback.yml`. |
| 4 | Page la plus lourde < 1 s à froid sur « Slow 4G simulé », libellé et mesure réelle dans Méthode, README, RUNBOOK ; journal plafonné 14 jours, IP masquée, sans User-Agent ni Referer | ✓ VERIFIED | `MESURE_SERVEUR_4G` (`src/lib/profil-4g.ts`) : 716/722/723 ms (budget 1 000), Lighthouse 13.0.3 FCP/LCP 791 ms ; README l. 72, RUNBOOK l. 183, Méthode rendue depuis la constante ; la page servie `/methode/` contient bien `data-mesure-serveur`. e2e 4G vert en CI à chaque build (run 42882087970). Journal : bloc `roll_at 00:00`, `roll_keep 12`, `roll_keep_for 288h`, `ip_mask 24 48` sur `remote_ip` et `client_ip`, `request>headers delete`, `request>tls delete` ; dernière entrée réelle de `/var/log/caddy/essai.log` : clés de requête `client_ip, host, method, proto, remote_ip, remote_port, uri` (aucun en-tête), IP `x.x.x.0` ; rotation du 2026-11-10 00:00 présente. Mesure faite sur `/methode/` (page la plus lourde de la build servie, aucun thème publié) : les pages de thème restent mesurées en local et en CI (environ 740 ms). |
| 5 | Panne simulée : Telegram après 3 échecs puis rétablissement ; battement : machine tombée, disque 85 % puis 92 %, certificat < 14 jours | ✓ VERIFIED (attesté) ; OPS-01 partiel en régime permanent | Attesté 08-11 et 08-15 (fait non relitigé) : 3 sondes en échec 11:52/12:02/12:12 puis DOWN `sonde-externe` 12:11 et UP ; `vps-battement` DOWN/UP ; disque 85 et 92 DOWN/UP ; `vps-certificat` DOWN/UP ; 4 contrôles DOWN à 12:30 avec cron suspendu, UP à 12:35. Vérifié par le vérificateur : runs `Sonde externe` 42810987099, 42812360119, 42813764865 en échec puis 42814033157 en succès ; cron `*/5` sous `flock` et `logger` ; journal `rtp-battement` des 40 dernières minutes : `site ok`, `cert ok`, disque 57 %, 4 pings `ok`. Reste D1 : la planification GitHub `*/10` ne tourne que quelques fois par jour (1 run `schedule` le 2026-11-10, à 16:53) ; voir Gaps Summary. |
| 6 | Installateur idempotent et configuration serveur dans le dépôt ; restauration réelle faite avant l'ouverture | ✓ VERIFIED | `ops/installer-serveur.sh --verifier` lancé sur le VPS depuis une copie jetable de `git archive HEAD` (étapes montages … depot) : **62 ok, 1 à faire, 0 erreur**. Le seul « à faire » est l'étape `depot` : `/opt/rtp/depot/deploy/.DS_Store` en trop (fichier macOS copié du Mac), tout le reste d'`ops/` et `deploy/` identique à HEAD (`diff -rq`). Crons `rtp-battement`, `rtp-sauvegarde` (02:45), `rtp-restauration` (`0 11 1 * *`) présents, root 644 ; `/etc/rtp` 700, `.env` 600. Archives `/root/rtp-sauvegardes/2026-11-09.tar.gz` et `2026-11-10.tar.gz` (root 600), copies sur le Mac `~/Sauvegardes/reveletonprog/` (600). Restauration réelle attestée 08-15 W6 (11:41 UTC, empreintes ok, installateur conforme, Caddy valide, ping `restauration-mensuelle`). Définition retenue au plan 08-15 : restauration de l'archive dans un arbre jetable puis contrôles, pas reconstruction d'une machine neuve. |

**Score:** 6/6 critères vérifiés ; OPS-01 partiel (D1).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Site public (nom nu, `www`) servi et premier déploiement de la cible `production` sous `RTP_DEPLOIEMENT=1` | Phase 9 | SC5 « le site est ouvert avec l'hôte technique retiré » ; aujourd'hui `reveletonprog.fr` ne répond pas en HTTPS (voulu) et `/srv/reveletonprog/current` n'existe pas |
| 2 | Phrase de politique du journal rendue dans les Mentions légales, journaux d'erreurs du conteneur compris (IN-06) | Phase 9 | SC4 « la politique de journal exacte » |
| 3 | Retrait de l'hôte technique à l'ouverture | Phase 9 | SC5 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `deploy/caddy/essai.caddy`, `site.caddy` | Blocs générés, sans dérive | ✓ VERIFIED | `render-caddy.ts --check` à jour ; bloc essai installé sur le VPS (`sites.d/reveletonprog-essai.caddy`, root 644), importé par la dernière ligne du Caddyfile |
| `ops/commande-deploiement.sh` | Commande forcée (envoi, activer, etat, retour) | ✓ VERIFIED | Copie identique en `/usr/local/sbin/rtp-deploy-command`, utilisée par le run 42882087970 |
| `ops/installer-serveur.sh` | Installateur idempotent | ✓ VERIFIED | 62 ok sur le VPS ; tests `installer-serveur.test.ts` verts |
| `ops/battement.sh` + `deploy/cron/rtp-battement` | Battement 5 min | ✓ VERIFIED | Journal JSON réel toutes les 5 min, timeouts et `flock` (WR-05) en service |
| `ops/sauvegarder-config.sh`, `ops/tester-restauration.sh`, crons | Sauvegarde quotidienne, restauration mensuelle | ✓ VERIFIED | Archives du 9 et du 10 ; cron mensuel installé |
| `.github/workflows/ci.yml` (jobs gel, construire, deploy) | Pipeline approuvé | ✓ VERIFIED | Run 42882087970 complet ; run 42883558304 (docs) saute construire/gel/deploy |
| `.github/workflows/rollback.yml` | Retour < 2 min | ✓ VERIFIED | Deux retours chronométrés |
| `.github/workflows/sonde.yml` | Sonde externe | ⚠️ PARTIAL | Fonctionne (runs manuels ok/échec corrects, 42885190434 ok) ; planification GitHub trop rare (D1) |
| `scripts/garde-gel.ts` | Gel des scrutins | ✓ VERIFIED | Bornes testées par le vérificateur |
| `src/pages/version.json.ts` | Commit et date servis | ✓ VERIFIED | Servi, commit = run déployé |
| `src/lib/profil-4g.ts`, `src/pages/methode.astro` | Mesure publiée | ✓ VERIFIED | Rendue sur la page servie |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| job `construire` | job `deploy` | artefact `site-deploiement-<n>` + empreinte d'arbre | WIRED | Étapes 7-8 du run 42882087970 |
| job `deploy` | VPS `deploy@` | ssh épinglé, rrsync `-wo -no-del -munge`, `activer` | WIRED | `rtp-deploy` journal `envoi`/`activer` code 0 à 19:24 |
| `essai/current` | Caddy | montage ro `/srv/reveletonprog`, `root * …/essai/current` | WIRED | `/version.json` servi = 25f43e6 |
| Environment `production` | relecteur | `required_reviewers` = ErwanHenry, branche `main` | WIRED | API environments ; secrets seulement dans l'Environment, aucun secret de dépôt |
| `rtp-battement` | Healthchecks | `curl --config -`, 4 URL de `/etc/rtp/battement.env` | WIRED | pings `ok` dans le journal |
| `sonde.yml` | Healthchecks `sonde-externe` | secret `SONDE_PING_URL` (Environment `sonde`) | WIRED, cadence insuffisante | D1 |
| `rtp-tester-restauration` | `restauration-mensuelle` | `/etc/rtp/restauration.env` + cron | WIRED | prochain passage 2026-12-01 11:00 UTC |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `/version.json` | commit, date | `GITHUB_SHA` à la build du job construire | Oui (25f43e6, 19:14:35Z) | ✓ FLOWING |
| Paragraphe Méthode | `MESURE_SERVEUR_4G` | constante datée, mesure du 2026-11-09 | Oui (page servie) | ✓ FLOWING |
| Battement | site, disque, cert | VPS réel | Oui (57 %, cert ok) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Suite du dépôt | `TZ=Europe/Paris fnm exec --using=24 npm test` | 2295 tests, 2286 pass, 0 fail, 9 skipped | ✓ PASS |
| Dérive Caddy | `node scripts/render-caddy.ts --check` | deux blocs à jour | ✓ PASS |
| Hôte protégé | `curl -sI https://essai.reveletonprog.fr/` | 401, Basic, noindex | ✓ PASS |
| En-têtes et version | curl authentifié (`--config -`) | voir SC1 | ✓ PASS |
| Installateur | `--verifier` depuis copie jetable sur le VPS | 62 ok, 1 à faire (`.DS_Store`) | ✓ PASS (info) |
| Autres sites | `verifier-sites.sh` instantané + comparer | 17 identiques | ✓ PASS |
| Gel | `garde-gel.ts --date …` aux bornes | conforme | ✓ PASS |
| CI | `gh run list` | 42882087970 et 42883558304 verts | ✓ PASS |

### Probe Execution

Step 7c : aucune sonde `scripts/*/tests/probe-*.sh` déclarée ni présente. Le « probe » de la phase est le workflow `sonde.yml` (run 42885190434 réussi à 19:25 UTC).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| HEB-01 | 08-01, 08-09, 08-12 | HTTPS par bloc Caddy généré, test de dérive, validate puis reload sans couper | ✓ SATISFIED (hôte essai) | SC1 ; nom nu en Phase 9 |
| HEB-02 | 08-06, 08-10, 08-13 | Push vert → build, releases/<sha>, bascule, fumée | ✓ SATISFIED (cible essai) | SC2 ; build `RTP_DEPLOIEMENT=1` câblée pour production, exécution en Phase 9 |
| HEB-07 | 08-04, 08-12 | `/version.json` | ✓ SATISFIED | servi |
| HEB-08 | 08-01, 08-12 | En-têtes, compression, no-cache, cache long haché | ✓ SATISFIED | cache long sans objet, gardé par check-dist |
| HEB-09 | 08-01, 08-12 | Journal 14 jours, IP masquée, sans UA/Referer ; Mentions exactes | ✓ SATISFIED (journal) ; phrase rendue en Phase 9 | entrée réelle vérifiée |
| HEB-10 | 08-02, 08-06, 08-10, 08-13 | Clé restreinte, empreinte épinglée, Environment `production` limité à `main`, test de dépôt | ✓ SATISFIED | VPS + API + tests |
| HEB-11 | 08-06, 08-13 | Retour < 2 min chronométré | ✓ SATISFIED | 58 s / 74 s |
| HEB-12 | 08-06, 08-13 | Approbation d'Erwan | ✓ SATISFIED | `required_reviewers` ErwanHenry |
| HEB-13 | 08-06 | Gel électoral sauf urgence | ✓ SATISFIED | bornes vérifiées |
| HEB-14 | 08-01, 08-09, 08-12 | Hôte technique protégé ; retiré à l'ouverture ; production ne contourne pas la garde | ✓ SATISFIED (Phase 8) ; retrait en Phase 9 | cible relue à l'approbation, build essai jamais livrée en production |
| PERF-02 | 08-04, 08-05, 08-14 | < 1 s Slow 4G simulé, publié | ✓ SATISFIED | SC4 |
| OPS-01 | 08-06, 08-11, 08-15 | Sonde externe, alerte après 3 échecs, rétablissement, panne simulée | ⚠️ PARTIAL | Panne simulée prouvée ; en régime permanent la planification GitHub ne tient pas la cadence (D1) ; élargissement à 1 jour / 1 jour en cours côté Erwan, ce qui retire la garantie « 3 échecs » pour la sonde externe |
| OPS-02 | 08-07, 08-11, 08-15 | Battement machine, disque 85/92, certificat | ✓ SATISFIED | journal réel + alertes attestées |
| OPS-03 | 08-03, 08-07, 08-11, 08-15 | Configuration dans le dépôt ou sauvegardée, restauration réelle, mensuelle | ✓ SATISFIED | installateur 62 ok, archives, cron mensuel, restauration attestée |

Aucune exigence orpheline : les 14 identifiants mappés à la Phase 8 dans REQUIREMENTS.md sont couverts par au moins un plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (fichiers de la phase : ops/, deploy/, workflows, scripts, src, docs) | | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` | aucun | Rien trouvé ; toutes les actions GitHub épinglées par SHA |
| VPS `/opt/rtp/depot/deploy/.DS_Store` | | fichier macOS copié du Mac | ℹ️ Info | L'étape `depot` de l'installateur répond « à faire » face à une source `git archive` ; le copier depuis `git archive` ou un arbre propre la prochaine fois |
| Environment `production` | | `prevent_self_review: false`, approbations faites par l'agent avec le jeton d'Erwan à sa demande (08-15) | ℹ️ Info | La barrière humaine repose sur la discipline de l'agent ; à revoir avant l'ouverture (approbation dans l'interface par Erwan) |
| `deploy/caddy/*.caddy` | | HSTS `max-age=300` | ℹ️ Info | À relever une fois le domaine stable (commentaire du bloc) |
| DNS | | AAAA retirés | ℹ️ Info | IPv6 à rétablir proprement plus tard (ufw, réseaux Docker) |
| Restauration | | Pas rejouée après la réapplication des étapes serveur du 2026-11-10 19:23 | ℹ️ Info | Le cron mensuel du 2026-12-01 la rejoue ; un passage manuel avant l'ouverture est conseillé |
| essai | | `/favicon.ico` en 404 | ℹ️ Info | Suivi 08-14 |

### Human Verification Required

### 1. D1 : élargir le contrôle sonde-externe

**Test:** Dans Healthchecks.io, passer `sonde-externe` à 1 jour de période et 1 jour de grâce (capture du 2026-11-10 : encore 10 min / 20 min et DOWN), puis surveiller Telegram 48 h.
**Expected:** `sonde-externe` UP, plus de DOWN parasite.
**Why human:** Healthchecks et Telegram sont hors de portée du dépôt et du VPS.

### 2. Décision OPS-01

**Test:** Choisir entre accepter par écrit la perte de la garantie « alerte après 3 échecs » pour la sonde externe (l'alerte rapide reste portée par le battement du VPS, contrôle HTTPS du contenu toutes les 5 min, DOWN prouvé en 13 min le 2026-11-10), ou ajouter un déclencheur externe de `workflow_dispatch`.
**Expected:** Override signé dans ce fichier, ou correction planifiée en Phase 9.
**Why human:** Arbitrage d'Erwan.

Override proposé si Erwan accepte :

```yaml
overrides:
  - must_have: "OPS-01 : une sonde externe alerte sur Telegram après 3 échecs consécutifs"
    reason: "La planification GitHub ne tient pas */10 ; sonde-externe élargie à 1 jour / 1 jour pour couper les fausses alertes. L'alerte rapide de contenu passe par le battement du VPS (HTTPS, 5 min, grâce 10 min), prouvée le 2026-11-10 ; la sonde externe reste un filet quotidien hors VPS."
    accepted_by: "ErwanHenry"
    accepted_at: "<date de la décision>"
```

### Gaps Summary

Aucun critère du ROADMAP n'échoue. Le but de la phase est atteint sur l'hôte technique :
- un push vert est construit sans secret, approuvé par Erwan, livré et basculé de façon atomique, puis vérifié par un test de fumée (run 42882087970) ;
- le retour arrière prend moins de 2 minutes ;
- le gel des scrutins tient aux bornes ;
- Caddy sert l'hôte essai en HTTPS, avec mot de passe et en-têtes, sans avoir coupé aucun des 17 autres hôtes ;
- les alertes et la restauration sont attestées, et le battement tourne en ce moment.

Un seul point reste ouvert, D1 sur OPS-01, et c'est une décision humaine, pas un manque de code. La sonde externe fonctionne quand elle tourne, mais GitHub ne la planifie que quelques fois par jour. L'élargissement à 1 jour / 1 jour n'est pas encore appliqué (capture d'Erwan du 2026-11-10). Une fois appliqué, il supprime les fausses alertes, mais la sonde externe ne peut plus alerter « après 3 échecs ». Il faut donc qu'Erwan accepte cette perte (override ci-dessus) ou fasse corriger la sonde.

Les éléments liés à l'ouverture sont différés en Phase 9 : nom nu et `www`, déploiement réel de la cible `production` sous `RTP_DEPLOIEMENT=1`, phrase des Mentions légales et IN-06, retrait de l'hôte essai.

---

_Verified: 2026-11-10T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
