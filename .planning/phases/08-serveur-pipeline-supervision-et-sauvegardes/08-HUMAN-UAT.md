---
status: partial
phase: 08-serveur-pipeline-supervision-et-sauvegardes
source: [08-VERIFICATION.md]
started: 2026-11-10
updated: 2026-11-10
---

## Current Test

Réglage de `sonde-externe` dans Healthchecks.

## Tests

### 1. Sonde externe sans fausse alerte (OPS-01, D1)
expected: Erwan règle `sonde-externe` à 1 jour de période et 1 jour de grâce dans Healthchecks, puis aucune fausse alerte DOWN sur Telegram pendant 48 h ; ou il retient un déclencheur externe (service de cron qui appelle `workflow_dispatch` avec un jeton limité à Actions) à faire en Phase 9
result: pending (capture du 2026-11-10 : encore 10 min / 20 min)

### 2. Approbation des déploiements par Erwan lui-même
expected: avant l'ouverture, Erwan approuve au moins un déploiement depuis l'interface GitHub (en 08-15, l'orchestrateur a approuvé avec le jeton d'Erwan, à sa demande)
result: passed (run 42904829430 approuvé par Erwan dans l'interface GitHub le 2026-11-10, déploiement réussi, essai sert e5a75b7)

### 3. Test de restauration après les correctifs de revue
expected: `rtp-tester-restauration` relancé après la réapplication du 2026-11-10 ; fait à 19:23 UTC (résultat ok, 0 fichier modifié) ; le cron mensuel le rejoue le 2026-12-01
result: passed

## Gaps

Reportés en Phase 9 : déploiement réel vers la cible `production` (nom nu et `www`, `RTP_DEPLOIEMENT=1`), phrase des Mentions légales sur le journal d'erreurs du conteneur (IN-06), HSTS à allonger après l'ouverture, IPv6 (ufw et réseaux Docker) puis enregistrements AAAA, `favicon.ico`.
