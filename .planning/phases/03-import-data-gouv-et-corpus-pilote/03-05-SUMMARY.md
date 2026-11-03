---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 05
subsystem: corpus
tags: [couverture, pilote, themes, node-test, archives]
requires:
  - phase: 03-04
    provides: tableau de couverture 37 x 10, classement, archives
provides:
  - pilote.themes = sante, travail, europe-et-monde dans data/couverture-themes.yaml
  - 3 sources Batho archivées (priorités 1, 2, 4), ligne Batho recalculée, Durif en aucun_site
  - tests/corpus/pilote.test.ts et tests/corpus/glossaire.test.ts sur le corpus réel
affects: [03-06, 03-07, 03-08, 03-09]
key-files:
  created:
    - tests/corpus/pilote.test.ts
    - tests/corpus/glossaire.test.ts
    - src/content/sources/delphine-batho-priorite-{1,2,4}.yaml
    - archives/delphine-batho/*.txt
  modified:
    - data/couverture-themes.yaml
    - docs/COUVERTURE-THEMES.md
key-decisions:
  - "Thèmes pilotes : sante, travail, europe-et-monde (choix de la marge = top 3 littéral = décision d'Erwan), sans dérogation"
requirements-completed: [CONT-04, CONT-05, CONT-06]
completed: 2026-11-03
---

# Phase 3 Plan 05: Thèmes pilotes arrêtés et tests du corpus réel Summary

**Thèmes pilotes enregistrés (santé, travail, Europe et monde), captures Batho archivées, Durif ramené à « aucun programme visible », et deux suites de tests qui gardent le corpus pilote réel.**

## Décisions prises au checkpoint

- **Choix des thèmes (Task 3)** : décision d'Erwan Henry du 2026-11-03, enregistrée dans 03-CONTEXT.md (`regle_themes: marge`, confirmation explicite après le classement mesuré). `pilote.themes: [sante, travail, europe-et-monde]` = `choix` = `top3Litteral` (à l'ordre près), donc `derogation: null`. Chemin : réponse pré-enregistrée appliquée. Les résolutions ont été fournies à l'avance par l'orchestrateur ; la règle d'ambiguïté (c) ne se déclenche pas : une seule ligne reste `bloque` (Rohou), sous la marge de 2.
- **Captures manuelles (Task 1)** :
  - Batho : le `fetch` Node renvoie encore HTTP 403 sur les 4 priorités (contrairement au 200 attendu). Aucun contournement. Utilisation du repli prévu : captures de l'orchestrateur `/tmp/rtp-captures/batho/priorite-{1,2,4}.html` archivées avec `--file` (`--capture-le 2026-11-03T22:00:00+01:00`, type site_candidat, auteur candidat, date de publication partielle 2026-11 = mois de capture, inconnue). La priorité 3 n'a pas de capture : elle reste dans `urls_bloquees`.
  - Tondelier : reste `partiel` ; le PDF `https://lesecologistes.fr/document/3N4JsAEmq6vsx42IITGNZa/vdef-programme-1.pdf` est la seule adresse bloquée, **à capturer (téléchargement à autoriser par Erwan)**.
  - Durif : accès `aucun_site`, 10 cases `aucun`, note datée 2026-11-03 « vérifié dans un navigateur réel ». Statut du candidat non modifié.
  - Mélenchon : livre non en ligne (redirige vers l'accueil), ligne laissée `partiel`.
  - Rohou : reste `bloque` (données personnelles), inchangé.

## Réalisations

- Ligne Batho recalculée depuis les 3 priorités lues : logement ◐, école ◐, retraites ○, santé ●, sécurité ●, climat ●, travail ◐, impôts ○, Europe et monde ◐, institutions ●. Accès `partiel`.
- Nouveau classement (37 candidats) : travail 26, Europe et monde 26, santé 26, institutions 25, école 25, climat 24, sécurité 23, impôts 22, logement 21, retraites 20. Le trio ne change pas. Accès : 26 ok, 3 partiel, 1 bloque, 7 aucun_site.
- `docs/COUVERTURE-THEMES.md` : tableau, comptages, section « Thèmes pilotes retenus », section des adresses restantes.
- Tests réels : pilote (CONT-05, `verifierPilote` hors codes de glossaire, avertissements en `t.diagnostic`), glossaire (CONT-06 : marqueurs résolus, partis et termes marqués, `source.type: parti`).
- Vérifications : `couverture-scan --check-data`, validate production et preview (0 erreur, 0 avertissement), `ids --check`, `npm test` (1509 pass, 0 fail).

## Task Commits

1. Tâches 1 à 3 regroupées : `de7b0ac` (data(03-05) : thèmes pilotes, captures Batho, tests du corpus pilote)

## Cases non résolues et adresses restantes

- Batho : `https://www.delphinebatho.fr/priorites/priorite-3/` (La beauté pour vivre mieux), `https://generationecologie.fr/` (403).
- Mélenchon : `https://melenchon2027.fr/programme2025/livre/`.
- Tondelier : PDF `vdef-programme-1.pdf` ci-dessus.
- Rohou : `https://www.les-ecologistes-mei.org/notre-programme`.
- Aucune ligne `bloque` autre que Rohou.

## Deviations from Plan

- **Wayback** : la soumission pour les 3 sources Batho échoue (HTTP 520) ; reprise via `--wayback-only delphine-batho-priorite-1 ...` ou `--wayback-missing` avant publication (`ARCHIVE_WAYBACK_ABSENTE` bloque seulement en `publie`). Total de sources sans Wayback : 21.
- Gitleaks local indisponible : étape §8.5 sautée ; grep d'adresses e-mail et de téléphones sur les extraits Batho : aucun résultat.
- Dépôt privé synchronisé (`--sync-private`), non poussé côté dépôt public (consigne).

## Signaux à vérifier

- **Durif : signal de suspension de campagne à vérifier** (« CAMPAGNE DU MINISTÈRE DU CRINGE SUSPENDUE … jusqu'à nouvel ordre cosmique »). Le statut de la fiche n'est pas changé (palier B : source datée et relecture d'Erwan requises). Le site semble être une opération satirique (note déjà présente en 03-04).
- Contenus suspects : aucun.

## Self-Check: PASSED

Commit `de7b0ac` présent ; fichiers `tests/corpus/pilote.test.ts`, `tests/corpus/glossaire.test.ts` et sources Batho présents.
