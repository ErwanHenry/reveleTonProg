---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 12
subsystem: ouverture, serveur, supervision
tags: [ouverture, caddy, certificats, supervision, pub-02, leg-01]

requires:
  - phase: 09
    provides: 09-11 (santé publié et répété sur l'hôte d'essai, hébergeur actif, exercice de retrait)
  - phase: 09.2
    provides: deploy:local (cible production, phrase « deployer en production <sha7> »)
provides:
  - reveletonprog.fr ouvert au public le 2026-11-22 à 08:43:54 UTC, www en 301, certificats Let's Encrypt
  - Supervision (battement, sonde externe, test de fumée local) sur l'hôte public, sans identifiant
  - Hôte technique retiré (marqueur /opt/rtp/essai-retire), fichiers gardés
  - Déploiement GitHub en sommeil (D-11 de la phase 9.2 tranchée)
affects: [09-13, 10-05]

key-decisions:
  - "Erwan, 2026-11-22 : « Go » (ouverture complète, retrait de l'hôte d'essai compris)"
  - "Erwan, 2026-11-22, sur la relecture du site avant l'ouverture : « je ne veux pas relire mais on corrigera le site s'il ne me convient pas. Pour le moment j'aurai peu voire pas de visiteurs »"
  - "Erwan, 2026-11-22 : « Rejette-le toi-même » (run 44954994364), puis « Oui, rejette-le » (run 44266078872, découvert en route ; le contrôle de permissions avait d'abord bloqué ce rejet, faute d'accord pour ce numéro)"
  - "Déploiement en production par deploy:local (Mac), et non par approbation GitHub comme l'écrivait le plan"
---

# Plan 09-12 : ouverture publique

## Résultat

`https://reveletonprog.fr` est public depuis le 2026-11-22 à 08:43:54 UTC. Il sert le commit `c383a03`, construit en mode production (`RTP_DEPLOIEMENT=1`) et déployé depuis le Mac par Erwan. Seul le thème santé est ouvert. Les Mentions légales définitives sont en ligne. Le site est indexable, sous HSTS court (300 s). Les 17 autres sites du serveur n'ont pas bougé et Caddy n'a jamais redémarré.

## Contrôle d'entrée (tâche 1, lecture seule)

| Point | Résultat |
|---|---|
| (a) main propre, CI verte sur `c383a03` ; validate production 0 erreur ; relecture reste 0 sur 121 ; liste blanche = `sante` | oui |
| (b) note de risques signée, 0 « à compléter », dates d'identité et de test du contact | oui |
| (c) hébergeur `actif`, contact sur `reveletonprog.fr` | oui |
| (d) build locale `RTP_DEPLOIEMENT=1` puis check-dist | 0 erreur, 1 thème, 37 fiches, pas de `noindex`, `robots.txt` avec `Sitemap:` |
| (e) hôte d'essai relu par Erwan | non : Erwan a choisi de ne pas relire (décision citée plus haut) |
| (f) exercice de retrait consigné au RUNBOOK | oui (09-11) |
| (g) aucun run en attente ; garde de gel | deux runs GitHub en attente, rejetés sur instruction d'Erwan ; hors gel |
| (h) DNS sur 1.1.1.1 et 9.9.9.9 | A du domaine et de `www` = serveur, AAAA vides |
| (i) validation jetable du bloc public ; instantané des autres sites | valide avec et sans variables ; 17 identiques, 0 différent, 0 disparu |
| (j) disque ; battement | 53 % ; `site ok`, `cert ok` |
| (k) réglages GitHub | conformes à la liste du plan |

## Chronologie UTC

| Heure | Écriture ou contrôle |
|---|---|
| 08:29 | rejet du run 44954994364 refusé par l'API : il n'attendait pas lui-même, il était en file derrière 44266078872 |
| 08:30:57 | variable GitHub `DEPLOY_CIBLE` retirée (déploiement GitHub en sommeil) ; `deploiement.env` local passé à `production`, `RTP_URL` vide (sauvegarde `deploiement.env.essai`) |
| ~08:33 | run 44266078872 rejeté (accord d'Erwan pour ce numéro), puis 44954994364 rejeté ; plus aucun run en cours |
| 08:27:46 | reçu `ci:local` vert pour `c383a03` (19 étapes, 3245 tests) |
| 08:42:03 à 08:42:42 | `deploy:local` en production par Erwan : `releases/c383a03…`, `current`, 37 fiches ; test de fumée sauté (RTP_URL vide) |
| 08:43:22 | copie de `ops/` et `deploy/` sur le serveur (0 `.DS_Store`) ; instantané des routes d'erreur de Caddy (avant) |
| 08:43:32 | étape `site-public` : `reveletonprog.caddy` installé (644) |
| 08:43:42 | validations jetable (avec et sans variables) et en direct : valides |
| 08:43:54 | `caddy reload` : **site public** |
| 08:44:05 | domaine nu 200, `www` 301 ; deux certificats obtenus |
| 08:45:13 | GitHub : `DEPLOY_URL` public, secrets `DEPLOY_SMOKE_USER`, `DEPLOY_SMOKE_PASS`, `SONDE_USER`, `SONDE_PASS` supprimés, `SONDE_URL` public ; sonde relancée : verte |
| 08:45:32 | battement : `RTP_HOTE` public, identifiants retirés (4 lignes `HC_` avant et après, rien affiché), `/etc/rtp/battement.env` 600 root ; simulation : site et certificat OK |
| 08:45:44 | marqueur `/opt/rtp/essai-retire`, bloc d'essai déplacé dans `/root/rtp-retire/`, validations : valides |
| 08:45:57 | `caddy reload` : hôte d'essai retiré |
| 08:46:30 | sauvegarde et test de restauration : `resultat: ok`, 20 fichiers, installateur conforme, Caddy valide |

## Contrôles publics

| Contrôle | Résultat |
|---|---|
| Certificats | Let's Encrypt (YE2 pour le domaine nu, YE1 pour `www`), échéance 2027-02-20 |
| `/version.json` | `c383a03`, date ISO |
| `www` | 301 vers `https://reveletonprog.fr/themes/sante/` |
| En-têtes de `/` | HSTS `max-age=300` (sans `includeSubDomains`), CSP, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP, `Cache-Control: no-cache`, compression ; pas de `Server`, pas de `X-Robots-Tag` |
| Indexation | pas de `noindex` ; `robots.txt` sans `Disallow: /`, avec `Sitemap: https://reveletonprog.fr/sitemap.xml` |
| `/sitemap.xml` | 200, 44 adresses, `/themes/sante/` listé |
| Thèmes | `/themes/` ne liste que `sante` ; `/themes/sante/` 200, 27 cartes, 27 « Relue par » ; `/themes/travail/` 404 |
| 44 pages du plan du site | toutes 200, 0 marque de brouillon |
| Mentions légales | identité de l'hébergeur, sortie d'erreur, contact du domaine ; pas de mention provisoire |
| `/favicon.ico` | 200 |
| Personnes (D-06) | 37 fiches liées, 37 dossiers dans la version servie ; les 22 autres répondent 404 (exemple vérifié) et sont absentes du plan du site |
| Adresse inconnue | 404, « Page introuvable » ; requête revalidée avec l'`ETag` : page complète renvoyée |
| Journal d'accès | adresse masquée, ni en-têtes ni détails TLS |
| Routes d'erreur de Caddy | aucune ajoutée (`srv0` sans `errors`, avant comme après) |
| Autres sites | après le bloc public : 17 identiques, 0 différent, 2 nouveaux ; après le retrait de l'essai : 18 identiques, 0 différent, 1 disparu (l'hôte d'essai) |
| Caddy | démarré le 2026-11-09, 0 redémarrage, inchangé |
| Hôte d'essai | ne répond plus (code 000) ; installateur `[ok: retiré]` |

## Écarts par rapport au plan

1. Déploiement en production par `deploy:local`, sans approbation GitHub ; le test de fumée du chemin local vise désormais le site public sans identifiant. Le test de fumée du workflow GitHub n'existe plus en pratique (déploiement GitHub en sommeil).
2. Relecture du site sur l'hôte d'essai non faite par Erwan, par choix explicite.
3. Deux runs GitHub en attente rejetés au lieu d'un : le premier désigné attendait derrière un plus ancien (18 novembre). Le rejet du plus ancien a d'abord été bloqué par le contrôle de permissions, puis fait après l'accord explicite d'Erwan.
4. Battement : deux exécutions normales sur l'hôte public après le changement, à 08:50:02 et 08:55:01 UTC, `site ok` et `cert ok`.

## Suites

- HSTS à `max-age=31536000` pas avant le 2026-11-29 ; suppression de `/srv/reveletonprog/essai` pas avant le 2026-11-29 ; enregistrement DNS `essai` à retirer par Erwan ; IPv6 avant tout AAAA (RUNBOOK, « Ouverture publique »).
- Plan 09-13 : journal d'audit refait sur la build en ligne, 4G remesurée sur l'hôte public, confirmation d'Erwan.
- Relecture du site public par Erwan, quand il le souhaite.
