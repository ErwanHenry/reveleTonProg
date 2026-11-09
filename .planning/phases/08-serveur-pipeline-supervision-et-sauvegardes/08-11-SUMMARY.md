---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 11
subsystem: ops
tags: [supervision, healthchecks, telegram, sauvegarde]
requirements-completed: [OPS-02]
requirements-partial: [OPS-01, OPS-03]
metrics:
  completed: 2026-11-09
---

# Phase 8 Plan 11: Supervision du VPS et sauvegarde de la configuration Summary

Le VPS signale son état toutes les 5 minutes à Healthchecks.io, qui alerte Erwan sur Telegram ; la configuration serveur est archivée chaque jour et une première copie est sur le Mac d'Erwan.

## Tâches

1. **Décision (Erwan)** : six contrôles créés dans Healthchecks.io (`vps-battement`, `vps-disque-85`, `vps-disque-92`, `vps-certificat` : période 5 min, grâce 10 min ; `sonde-externe` : 10 min, grâce 20 min ; `restauration-mensuelle` : cron `0 11 1 * *` UTC, grâce 3 jours), intégration Telegram native attachée aux six. Les quatre URL de ping du VPS sont dans `~/.config/rtp/battement.env` (0600, vérifié par comptage sans affichage). **Sauvegardes automatiques Hetzner : actives** (réponse d'Erwan du 2026-11-09). « go » d'Erwan.
2. **Écritures (session principale, approuvées)** :
   - copie `/opt/rtp/depot` identique à HEAD (vérifiée) ;
   - `--etape battement` : `/usr/local/sbin/rtp-battement`, `/etc/rtp` (700 root), `/etc/rtp/battement.env` (600 root, lu ligne à ligne, jamais sourcé), `/etc/cron.d/rtp-battement` (644) ;
   - `--etape sauvegarde` : `rtp-sauvegarder`, `rtp-tester-restauration`, `/etc/cron.d/rtp-sauvegarde` (644) ;
   - exécutions manuelles : battement normal (tous `ok`), `RTP_SEUIL1=1` (échec sur `vps-disque-85`), `RTP_SEUIL2=1` (échec sur `vps-disque-92`, retour de 85), battement normal (retour de 92) ;
   - première archive `rtp-sauvegarder` : `2026-11-09.tar.gz`, 16 fichiers, 19 153 octets, copiée sur le Mac dans `~/Sauvegardes/reveletonprog/` (dossier 700, fichier 600).
3. **Constat d'Erwan sur Telegram** : `vps-disque-85` DOWN puis UP ; `vps-disque-92` DOWN puis UP (« The downtime lasted 1 second »).

## Vérifications

- Droits : `/etc/rtp` 700, `battement.env` 600, crons 644, propriétaire root.
- Cron réel : 3 battements automatiques (20:00, 20:05, 20:10 UTC) avec `"site":"ok"`, contenu vérifié par `essai/current/version.json` (pas de DNS, certificat `ignore`).
- Archive : Caddyfile, compose et override, `.env`, crons, `/etc/rtp`, `authorized_keys`, scripts, clés publiques d'hôte, `MANIFESTE.txt`, `liens.txt` ; **aucune clé privée** ; seul absent attendu : `srv/reveletonprog/.historique` (pas encore de déploiement en production).

## Reste

- `vps-certificat` et `sonde-externe` : activés en 08-15 (HTTPS et sonde GitHub).
- Test de restauration réel et premier ping `restauration-mensuelle` : 08-15.
- L'archive contient des secrets de la configuration (hash `basic_auth`, compose) : root 0600 sur le VPS, 0600 sur le Mac, jamais envoyée ailleurs.
