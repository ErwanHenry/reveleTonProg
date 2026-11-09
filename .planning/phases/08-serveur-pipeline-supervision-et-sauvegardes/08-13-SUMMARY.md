---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 13
subsystem: ci
tags: [deploy, github-environments, rollback]
requirements-completed: [HEB-02, HEB-10, HEB-11, HEB-12, HEB-13]
metrics:
  completed: 2026-11-09
---

# Phase 8 Plan 13: Déploiement GitHub de bout en bout sur l'hôte technique Summary

Un push sur `main` aux jobs verts déploie désormais l'hôte `essai.reveletonprog.fr` après l'approbation d'Erwan, et un retour arrière se fait par `workflow_dispatch` en une dizaine de secondes d'exécution.

## Tâches

1. **Environments GitHub (créés par l'orchestrateur avec `gh`, à la demande d'Erwan : « Yes, do it »)** :
   - `production` : relecteur requis = Erwan seul, `prevent_self_review` = false, branches personnalisées = `main` ; variables `DEPLOY_HOST` (vérifiée égale à l'hôte `keel-vps`), `DEPLOY_USER` (`deploy`), `DEPLOY_KNOWN_HOSTS` (ligne épinglée), `DEPLOY_URL` (`https://essai.reveletonprog.fr`) ; secrets `DEPLOY_SSH_KEY`, `DEPLOY_SMOKE_USER`, `DEPLOY_SMOKE_PASS`. Valeurs lues depuis `~/.config/rtp/`, jamais affichées.
   - `sonde` : sans relecteur, branches = `main` ; secrets `SONDE_USER`, `SONDE_PASS`. **`SONDE_PING_URL` manque** (URL du contrôle `sonde-externe`, à fournir par Erwan pour 08-15).
   - Vérification API : relecteur `ErwanHenry`, `prevent_self_review` false, politique de branche `main` sur les deux.
2. **Déploiement et retours arrière** (variable de dépôt `DEPLOY_CIBLE=essai`, commit vide `0949633`) :

| Étape | Run | Résultat |
|---|---|---|
| CI + garde de gel | 42705693502 | vérification, tests navigateur, gitleaks, gel : verts ; le job Déployer attend l'approbation |
| Déploiement approuvé (21:58:16 UTC) | 42705693502 | **27 s** de l'approbation à la fin : build (`RTP_DEPLOIEMENT=0` pour essai), check-dist, rsync sans suppression, bascule, état, test de fumée HTTPS ; retour automatique non déclenché ; clé effacée du runner |
| Version servie | | `version.json` = `0949633…` |
| Retour arrière n°1 | 42707624664 | servi `6da5b2c…` ; total 56 s, approbation vue à +48 s, **exécution environ 8 s** |
| Retour arrière n°2 | 42707883463 | servi de nouveau `0949633…` ; total 70 s, approbation vue à +59 s, **exécution environ 11 s** |

Chiffre de réussite HEB-11 (lancement jusqu'à la version servie, attente d'approbation exclue) : environ 8 s et 11 s, sous 120 s. Les durées d'approbation sont mesurées par interrogation toutes les 3 s (précision de quelques secondes).

3. **Clé privée de déploiement supprimée du Mac** (`~/.config/rtp/rtp-deploy-github`) après vérification de sa présence dans l'Environment `production` ; la clé publique reste.

## Constats

- Chaque push sur `main` déclenche désormais une demande d'approbation de déploiement (cible `essai`). Les commits de planification seuls portent `[skip ci]` pour ne pas en créer ; à revoir (filtrer le job `deploy` sur les chemins utiles, ou rejeter les demandes inutiles).
- A6 (groupe de concurrence partagé) : non observé, aucun déploiement en attente pendant les retours arrière.
