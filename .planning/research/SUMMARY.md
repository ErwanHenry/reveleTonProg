# Project Research Summary

**Project:** reveleTonProg | **Milestone:** v1.1 Lot 3, hébergement et mise en ligne | **Researched:** 2026-11-06 | **Confidence:** MEDIUM-HIGH

## Executive Summary

Le Lot 3 n'ajoute presque aucune technologie : le site reste un build Astro 7 statique servi par le Caddy déjà présent sur le VPS. Ce qui est à construire relève de l'exploitation : un domaine paramétré (source unique dans `config/site.yml`), un déploiement reproductible depuis GitHub Actions, des gardes contre la publication de contenu non relu, une supervision externe et des sauvegardes testées. Zéro nouvelle dépendance npm ; `ssh` et `rsync` simples, sans action tierce ; alerte par Healthchecks.io hébergé ; un dossier `deploy/` dans le dépôt rend la restauration réelle.

Approche en cinq mouvements : (1) sortir ce qui ne dépend de personne (domaine en config, inlining CSS et scripts avec CSP à hashes, dette W3, W10, W4) ; (2) déployer à vide d'abord, par releases datées avec lien `current` et rollback par bascule de lien ; (3) mettre en ligne un seul thème entièrement relu, derrière la garde d'équité et une liste blanche de publication ; (4) faire valider Mentions légales et régime d'éditeur par un juriste avant l'ouverture ; (5) traiter l'import data.gouv de décembre en PR séparée après la mise en ligne (ADR-041 le rend sans effet sur la production tant que les nouveaux statuts ne sont pas relus).

Risques majeurs : `rsync --delete` mal ciblé ou clé SSH trop puissante sur un VPS partagé, reload Caddy qui casse les autres sites, limites Let's Encrypt (5 certificats identiques par 7 jours), disque à 90 %, publication d'un brouillon, exposition juridique à l'ouverture. Le chemin critique est humain : décision VPS, achat du domaine, relecture d'Erwan (environ 3 à 4 h par thème), relecture juridique.

## Décisions de cadrage (orchestrateur)

- **Critère 4G à 1 s dans le périmètre** : cible = profil Lighthouse « Slow 4G simulé », atteint en mettant CSS et script de niveau dans la page ; le libellé publié dit « simulé ». Sur un vrai Slow 4G (562,5 ms de RTT), DNS + TCP + TLS + requête coûtent environ 2,2 s : 1 s réel est inatteignable. Mesurer l'URL réelle une fois avec `lighthouse` (hors dépendances) et consigner l'écart.
- **Dépôt public depuis le 2026-11-04** : YAML en brouillon et artefact `site-preview` lisibles par tout compte GitHub. Réviser l'ADR-051 ; la build preview n'est jamais déployée ni servie.
- **Vérification juridique ouverte** : article fondant le droit de réponse en ligne après la loi SREN (art. 6 IV ou 1-1 LCEN) ; le RUNBOOK cite 1-1, PITFALLS pense 6 IV. À vérifier sur Légifrance avec le juriste.
- **Domaine non acheté ; VPS à décider après diagnostic en lecture seule ; la production n'affiche que le contenu relu par Erwan.**

## Key Findings

### Recommended Stack

Pile v1.0 inchangée. Ajouts de configuration et d'exploitation :

- **Caddy existant** (v2.11.9 disponible) : fichier `/etc/caddy/sites/*.caddy` importé ; `caddy validate` puis `reload`, jamais `restart` (sauf une fois pour ouvrir un nouveau fichier de log) ; bloc généré depuis `site.yml`.
- **Astro 7.4.5** : `build.inlineStylesheets: 'always'` + `security.csp` (CSP en `<meta>`, hashes sha256 par page, vérifié par build jetable). Garder `assetsInlineLimit: 0`, sinon les scripts deviennent des URI `data:`.
- **Scripts inline** via `?raw` + `<script is:inline set:html>`, hashes passés à `scriptDirective.hashes` depuis `node:crypto` (support automatique des `is:inline` non vérifié).
- **OpenSSH + rsync + rrsync** : clé ed25519 dédiée, `restrict`, pas de sudo ; `known_hosts` épinglé en variable d'Environment ; jamais `ssh-keyscan` ni `StrictHostKeyChecking=no`.
- **`actions/download-artifact` v8.0.2** seulement si build et déploiement sont des jobs séparés (SHA à résoudre).
- **Healthchecks.io** (gratuit) : heartbeat depuis un cron de 5 min sur le VPS, alerte Telegram par absence de ping, détecte aussi la panne du VPS.
- **restic 0.19.1** seulement sans sauvegarde Hetzner : quelques Ko (`/etc/caddy`, `/var/lib/caddy`, cron, `authorized_keys`).
- **À écarter** : Uptime Kuma ou Healthchecks auto-hébergés (RAM), CDN, Docker, Ansible, `@astrojs/sitemap`, HSTS preload, toute ressource externe.

### Expected Features

**Table stakes** : diagnostic VPS en lecture seule avec décision écrite et snapshot avant action ; domaine unique dans `config/site.yml` (canonique, sitemap, robots, Caddy, check-dist) avec garde `.invalid` sous `RTP_DEPLOIEMENT=1` ; bloc Caddy dédié (HTTPS, apex/www, en-têtes, cache différencié, logs à IP masquée) ; job de déploiement sur `push` vers `main` avec `environment: production`, build de production reconstruit, test de fumée, rollback testé ; production limitée à `relu`/`publie`, garde « au moins un thème entièrement relu », file de relecture avec commande qui passe à `relu` avec relecteur et date ; dette W3, W10, W4 (après inlining), W8 (refait sur la build finale) ; inlining et libellé « Slow 4G simulé » ; sonde de disponibilité, alerte Telegram, surveillance disque et certificat, restauration testée avant ouverture ; conformité d'ouverture (contact réel testé, hébergeur `actif`, Mentions exactes sur IP, durée, localStorage, revue juridique, retrait d'urgence en moins d'une heure).

**Should have** : `version.json` (SHA et date), approbation manuelle du premier déploiement, date et relecteur par mesure, instantané d'import archivé, jeu d'import piégé en test, gel des déploiements autour des scrutins vérifié par le workflow.

**Defer** : page de statut publique, sonde de contenu avancée, journal public M5 (Lot 5), génération des types W7 (un test de dérive suffit), re-import par cron, `security.txt`.

### Architecture Approach

Un job `deploy` dans `ci.yml` : `needs: [verifier, e2e, secrets]`, seulement sur `push` vers `refs/heads/main`, `environment: production`, `concurrency` sans annulation. Il reconstruit sous `RTP_DEPLOIEMENT=1` (la garde est une garde de build), lance check-dist, envoie vers `releases/<sha>/`, bascule `current` de façon atomique (`ln -sfn` puis `mv -Tf`), fait un test de fumée, garde 5 releases. Rollback par bascule de lien (`rollback.yml`) ; un `git revert` de contenu échoue sur `ids.lock`. Le bloc Caddy est appliqué par Erwan, pas par la CI.

Composants : `config/site.yml` + `site-config.ts` (domaine) ; `astro.config.mjs`, `Base.astro`, `LecteurNiveaux.astro` (site, canonique, inline, CSP) ; `check-dist.ts` + cas `ordre`/`niveaux` (règles de hash remplaçant l'ADR-037) ; `render-caddy.ts` + `deploy/caddy/site.caddy` (test de dérive) ; `deploy/bootstrap-vps.sh` (idempotent, plan de restauration) ; job `deploy`, `rollback.yml`, `sonde.yml` ; `sitemap.xml.ts`, `version.json.ts`, `robots.txt.ts`.

### Critical Pitfalls

1. **`rsync --delete` mal ciblé** : utilisateur dédié, cible `releases/<sha>/` sans `--delete`, script `set -euo pipefail` qui refuse un chemin vide ou hors préfixe, dry-run lu au premier passage, rrsync sur la clé.
2. **Clé trop puissante, `known_hosts` contourné, secrets exposés aux PR (dépôt public)** : `restrict`, empreinte épinglée, secrets dans l'Environment restreint à `main`, jamais `pull_request_target` (test de dépôt), pas d'interpolation `${{ }}` de données tierces dans `run:`.
3. **Reload Caddy et Let's Encrypt** : fichier importé, sauvegarde de `/etc/caddy`, `validate` puis `reload`, `curl -sI` sur chaque site avant et après, `dig` multi-résolveurs, ACME staging d'abord, ne jamais supprimer `/var/lib/caddy`.
4. **Disque à 90 %, RAM saturée** : décision VPS avant tout déploiement, aucun build sur le VPS, rotation des releases, logs plafonnés, garde d'espace libre, alertes à 85 et 92 %.
5. **Publier du non relu** : build de production reconstruit, `RTP_MODE` absent (test de dépôt), jamais d'artefact preview déployé, liste blanche de publication, `SITE_VIDE`, W9 résolu avant de publier les mesures concernées.
6. **Exposition juridique** : régime d'éditeur avec un juriste (l'anonymat « non professionnel » est fragile), contact réel testé de bout en bout, Mentions exactes sur les journaux, gel autour des scrutins (sondages loi 77-808 art. 11, propagande L49).
7. **Inlining qui casse check-dist, le no-JS ou la CSP** : règles par hash au lieu d'assouplir, suite sans JS sur la build inlinée, scripts classiques et bloquants (ADR-040), gzip de la page la plus lourde sous 100 Ko.

## Implications for Roadmap

**Piste 0, hors code, immédiate** : décision VPS, achat du domaine et DNS, identité d'éditeur envoyée à Hetzner avec preuve datée, début de la relecture d'un thème, juriste sollicité.

1. **Diagnostic VPS et décision** : script en lecture seule (liste blanche de commandes) ; rapport chiffré et recommandation (libérer, monter en gamme, second VPS) ; snapshot ; OS, Caddy, rrsync, sauvegardes Hetzner, IPv6, ports. Si la libération laisse moins de 30 % de marge, monter en gamme ou isoler.
2. **Domaine paramétré, inlining et dette** : champ `domaine` partout, test « pas de domaine en dur » ; CSS et scripts inline avec CSP ; règles de hash dans check-dist ; test e2e « zéro violation CSP » ; W4, W3, W10 ; ADR-053, ADR-056 (remplace 037), révision de l'ADR-051 ; remesure 4G.
3. **Infrastructure, pipeline, supervision, sauvegardes** : bloc Caddy généré, `bootstrap-vps.sh`, utilisateur restreint, Environment ; job `deploy`, `rollback.yml` ; premier déploiement à vide avec aller-retour A, B, rollback chronométré (moins de 2 min) ; Healthchecks, sonde externe, alerte testée par panne simulée ; première restauration réelle ; RUNBOOK réécrit. Le déploiement à vide se heurte à `RTP_DEPLOIEMENT=1` et `SITE_VIDE` : hôte technique en `basic_auth` ou indicateur temporaire, jamais de contournement dans le job de production.
4. **Contenu relu, juridique et ouverture** (vers le 5 décembre) : outil de file de relecture, garde d'équité et liste blanche (CODEOWNERS sur le statut), au moins un thème entièrement relu, W9, W8 en dernier, Mentions finales, contact réel, `hebergeur.yml` `actif`, revue juridique, retrait d'urgence, calendrier de gel, premier déploiement public avec approbation. Un thème complet vaut mieux que trois partiels.
5. **Import data.gouv de décembre** : W6 d'abord, répétition à blanc, piège « l'import ajoute un déclaré à un thème publié », test CI instantané contre fichiers candidats, W7 si possible, import réel du 10 au 13 décembre en PR relue, gel du 13 au 15.

**Research flags** : phase 2 (spike CSP `is:inline`, `compressHTML`, gzip), phase 3 (bascule de lien avec commande forcée, chemins du filtre `ip_mask`, rrsync, Environments sur dépôt public, Telegram sur Healthchecks gratuit), phase 4 (juriste : régime d'éditeur, art. 6 IV ou 1-1, durée des logs CNIL 2021-122, localStorage, fenêtres électorales). Phases 1 et 5 : motifs standards.

## Arbitrages entre les fichiers de recherche

| Sujet | Divergence | Recommandation |
|---|---|---|
| Déploiement | rrsync `-wo` en deux passes (STACK) contre releases + lien (ARCHITECTURE, PITFALLS) | Releases + lien, mécanisme de bascule validé en phase 3 |
| En-tête CSP Caddy | `default-src 'self'` (ARCHITECTURE) contre exclu (STACK : les politiques s'intersectent) | Suivre STACK : pas de `default-src` dans l'en-tête, test e2e avec les vrais en-têtes |
| Mécanisme CSP | meta Astro (A) contre en-tête global avec `style-src 'unsafe-inline'` (B) | A avec `scriptDirective.hashes`, B en repli, jamais `unsafe-inline` sur `script-src` |
| Durée des logs | 14 j, 7 à 30 j, 30 j | 14 jours, IP masquée /24 et /48, sans User-Agent ni Referer, ou aucun journal d'accès (décision d'Erwan) ; Mentions et config citent la même valeur |
| Workflow | `deploy.yml` séparé contre job dans `ci.yml` | Job dans `ci.yml` avec tests de dépôt |
| Supervision | heartbeat seul | Heartbeat VPS + sonde HTTP externe ; `sonde.yml` en complément seulement |
| Sauvegardes | restic ou snapshot Hetzner | Selon le diagnostic ; dans tous les cas `deploy/` + `bootstrap.sh` |

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Versions vérifiées le 2026-11-06, inlining et CSP vérifiés par build ; MEDIUM sur scripts hachés de bout en bout, filtre de log Caddy, rrsync, Telegram gratuit |
| Features | MEDIUM | Sources CNIL et officielles ; art. 1-1 non lu directement ; temps de relecture non validé |
| Architecture | MEDIUM-HIGH | Code lu ; `security.csp` avec `is:inline`, Caddy et Environments de mémoire |
| Pitfalls | MEDIUM-HIGH | Let's Encrypt et textes électoraux vérifiés ; interprétation juridique non validée, L163-2 de mémoire |

**Overall : MEDIUM-HIGH.** L'incertitude porte sur l'état du VPS, le droit et le temps de relecture.

### Gaps to Address

- État réel du VPS : phase 1.
- Régime d'éditeur et base du droit de réponse : juriste en phase 4, ne pas figer le RUNBOOK avant ; à défaut de revue à temps, Erwan consigne le risque accepté.
- CSP des `is:inline` : spike de phase 2.
- Déploiement à vide contre la garde : hôte `basic_auth` ou indicateur temporaire (phase 3).
- Journal d'accès oui ou non : décision d'Erwan, pilote les Mentions.
- Critère 1 s : écrit « Slow 4G simulé », mesure réelle consignée.
- Temps de relecture (3 à 4 h par thème) à valider ; si ça glisse, un seul thème complet tient le jalon.
- Date des statuts data.gouv non garantie.
- Fenêtres électorales (gel 17-19 avril et 1er-3 mai 2027) à inscrire au RUNBOOK dès maintenant.

## Sources

HIGH : registres npm et API GitHub (2026-11-06), build jetable Astro 7.4.5 sur Node 24.22.2, code du dépôt, limites Let's Encrypt, documentation Caddy (`log`, `ip_mask`), Légifrance LCEN art. 6. MEDIUM : CNIL (mesure d'audience, cookies, guide RGPD du développeur), loi 77-808 art. 11, Code électoral L49, CNCCEP, Conseil constitutionnel, tarifs Healthchecks, images des runners GitHub. LOW-MEDIUM : synthèses d'avocats (anonymat de l'éditeur, Caen), décret 2007-1527, CNIL 2021-122 via synthèses, L163-2 de mémoire.

Détail : `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`.
