---
status: partial
phase: 05-pages-institutionnelles-qualit-et-url-de-test
source: [05-VERIFICATION.md]
started: 2026-11-04
updated: 2026-11-04
---

## Current Test

Décision d'Erwan sur la lecture du critère « < 1 s sur 4G » (WR-04).

## Tests

### 1. Critère 4G (WR-04)
expected: Erwan choisit la lecture du critère : soit deux profils publiés (latence-150 sous 1 s, Slow 4G Lighthouse sous 1,5 s, état actuel), soit CSS et script de niveau mis dans chaque page pour viser 1 s en Slow 4G (défait un choix de la phase 4, cache perdu)
result: pending

### 2. Parcours d'Erwan sur l'URL de test
expected: parcours des 7 étapes de 05-08 par Erwan lui-même (fait par l'orchestrateur pour lui le 2026-11-04, approuvé avec un écart corrigé sur Méthode) ; artefact `site-preview` du dernier run CI ou `node e2e/serveur.ts dist-preview 4173`
result: pending

### 3. Constats de l'audit croisé à arbitrer
expected: S1 (titres non adaptés au niveau enfant), S2 (libellé « Gros caractères »), S3 et O2 (vérifier une citation contre l'archive depuis la page) : accepter, ou ouvrir une phase de correction
result: pending

### 4. Relecture éditoriale du corpus
expected: reportée de la phase 3 (03-HUMAN-UAT.md), plus la liste C1 à C6 de docs/AUDIT-TEST-CROISE.md
result: pending

## Summary

Aucun échec technique : 5 critères sur 5 vérifiés, CI verte sur 5b9dde1. Le dépôt est public depuis le 2026-11-04 (CR-02 réglé par Erwan).

## Gaps

Aucun écart technique.
