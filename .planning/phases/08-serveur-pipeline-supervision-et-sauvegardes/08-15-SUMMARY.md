---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 15
subsystem: ops
tags: [supervision, restauration, panne-simulee]
requirements-completed: [OPS-02, OPS-03]
requirements-partial: [OPS-01]
metrics:
  completed: 2026-11-10
---

# Phase 8 Plan 15: Supervision de bout en bout, panne simulée et restauration réelle Summary

Toutes les alertes de supervision ont été déclenchées puis levées en conditions réelles et reçues par Erwan sur Telegram ; une restauration réelle de la configuration a réussi. Reste un défaut de la sonde externe : la planification GitHub est trop rare (OPS-01 partiel).

## Écritures (session principale, « Go, approve it » d'Erwan le 2026-11-10)

| Étape (UTC) | Résultat |
|---|---|
| P 09:38 | déploiement du correctif `X-Robots-Tag` (commit cabc995) approuvé par l'orchestrateur à la demande d'Erwan ; succès |
| R1 à R3 | installateur depuis une copie jetable (4 « à faire » attendus) ; bloc candidat valide avec et sans variables ; relevé des sites |
| W0 09:40 | bloc `essai` réinstallé (hash `45510268…` hôte et conteneur), `caddy validate` puis `reload`, StartedAt inchangé, 0 redémarrage ; 401 avec `x-robots-tag: noindex, nofollow` ; 200 avec HSTS, CSP, une seule `x-robots-tag` ; **17 hôtes identiques, 0 différent, 0 disparu** |
| W1 09:40 | `battement.env` complété (`RTP_HOTE`, identifiant de la sonde) ; battement en HTTPS : site ok, certificat ok |
| W2 09:41 | secret `SONDE_PING_URL` (Environment `sonde`) et variable `SONDE_URL` ; sonde manuelle réussie |
| W4 09:41 | certificat simulé presque expiré (`RTP_CERT_JOURS=9999`, aucun certificat touché) : `vps-certificat` DOWN puis UP |
| W7 11:41 | `/etc/rtp/restauration.env` (600) et `/etc/cron.d/rtp-restauration` (644, `0 11 1 * *`) |
| W6 11:41 | archive `2026-11-10.tar.gz` (19 fichiers) ; **restauration réelle** : empreintes ok, 0 modifié, installateur conforme, Caddy valide, ping `restauration-mensuelle` ok ; copie sur le Mac |
| W3 11:42 à 12:14 | `essai/current` basculé sur une page cassée (`version.json` 404) ; 3 sondes en échec (11:52, 12:02, 12:12), battement `site: ko` x6 ; Telegram : `vps-battement` DOWN 11:55, `sonde-externe` DOWN 12:11 ; retour par la commande forcée en root (`retour essai cabc995`), page cassée supprimée ; sonde ok ; Telegram : les deux UP |
| W5 12:15 à 12:31 | cron du battement suspendu : Telegram : les 4 contrôles du VPS DOWN à 12:30 (machine muette) ; cron remis (644 root) : 4 UP à 12:35 |

## Écarts

1. Correctif 401 par une ligne `header X-Robots-Tag` non différée, pas par `handle_errors` : un `handle_errors` sur le serveur :443 partagé ferait passer les erreurs des autres sites au niveau debug dans le journal de Caddy. La 401 garde `Server: Caddy` et n'a ni HSTS ni CSP (sans effet d'indexation).
2. W7 puis W6 avant W3 : la restauration du jour échoue si un fichier vivant diffère de l'archive du jour ; et `restauration.env` installé avant W6 permet le premier ping mensuel.
3. **D1, sonde externe** : la planification `*/10` de GitHub ne tourne que quelques fois par jour (5 exécutions planifiées récentes, toutes en sommeil avant l'activation). Avec une période de 10 min et une grâce de 20 min, `sonde-externe` passe en DOWN à chaque trou : faux positifs reçus à 10:11 et 12:44. **À décider** : déclencheur externe (par exemple un service de cron qui appelle `workflow_dispatch` avec un jeton limité à Actions), ou période et grâce élargies dans Healthchecks, ou désactivation de ce contrôle (le battement du VPS couvre déjà le contenu en HTTPS).

## Reste

- OPS-01 : fiabiliser la sonde externe (D1).
- Le battement exige désormais `essai` en HTTPS ; à l'ouverture (Phase 9), passer `RTP_HOTE` sur le domaine public.
