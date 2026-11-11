---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 14
subsystem: site, check-dist, testing
tags: [relecture, mesure, check-dist, pub-03]

requires:
  - phase: 09-02
    provides: liste blanche de publication, filtre du view-model, codes check-dist de production
  - phase: 09-07
    provides: check-dist (TYPES_AUTORISES, favicon), serveur e2e
provides:
  - "Ligne « Relue par <relecteur> le <date>. » (p.relecture[data-relecture], time[datetime]) sous chaque mesure publiée"
  - "Code check-dist RELECTURE_ABSENTE (erreur en production seulement) et sa ligne du RUNBOOK"
  - "Phrase de la page Méthode sur la relecture affichée"
affects: [09-15]

key-files:
  modified:
    - src/components/Mesure.astro
    - src/styles/base.css
    - src/pages/methode.astro
    - scripts/lib/check-dist.ts
    - tests/scripts/check-dist.test.ts
    - tests/dist/cas/publication.cas.ts
    - tests/dist/cas/methode.cas.ts
    - docs/RUNBOOK.md

key-decisions:
  - "La ligne est rendue seulement si le statut n'est pas brouillon et que relecteur et date_relecture existent : un brouillon en preview n'a jamais de ligne"
  - "Style : classe .relecture, mêmes variables que .source (--encre-douce, --t-label), aucune nouvelle couleur ni nouveau fichier"
  - "La phrase Méthode est ajoutée à la fin de l'élément de liste existant sur la relecture par l'éditeur"

requirements-completed: [PUB-03]

metrics:
  completed: 2026-11-11
---

# Phase 9 Plan 14: relecteur et date sur chaque mesure publiée Summary

Chaque mesure publiée affiche « Relue par <relecteur> le <date>. » à tout niveau de lecture et sans JS, et check-dist refuse un build de production où cette ligne manque ou est invalide.

## Ce qui a été fait

- `Mesure.astro` : paragraphe `p.relecture[data-relecture]` entre les quatre niveaux et `div.source`, hors de tout `div.redaction`, avec `<time datetime>` (date formatée par `formatDate`).
- `check-dist.ts` : `RELECTURE_ABSENTE` (erreur, production seulement) : exactement une ligne par `article.mesure`, relecteur non vide, un `time[datetime]` qui est une vraie date du calendrier (le 30 février est refusé).
- Tests : cas unitaires (ligne valide, absente, doublée, relecteur vide, 30 février, format JJ/MM/AAAA, preview sans constat), trois cas dist sur le corpus M1 (production : une ligne par mesure et valeurs égales au YAML de `marie-fictive/aide-construction` ; preview : brouillon sans ligne ; check-dist sans RELECTURE_ABSENTE ni POIDS_*), une assertion Méthode.
- Aucun contenu réel touché : aucune mesure réelle n'est relue ni publiée.

## Commits

- 3d40f1e test(09-14) : tests rouges (unitaires vérifiés rouges avant le code)
- b6912e3 feat(09-14) : composant, style, Méthode, check-dist, RUNBOOK

## Vérifications

- `npm test` : 2519 tests, 2510 réussis, 0 échec, 9 ignorés
- `npm run check` : 0 erreur, 0 avertissement
- Build de production réel + check-dist : 0 erreur (avertissements attendus : PUBLICATION_VIDE, HEBERGEUR_PREVU x2)
- `npm run e2e -- --jeu m1` : 259 réussis (axe, contraste, 4G, sans JS)

## Deviations from Plan

Aucune. Note : les tests ont été écrits et commités avant le code (rouge vérifié sur le test unitaire), mais le cas dist n'a pas été exécuté seul en rouge. `tests/dist/cas/methode.cas.ts` (absent de la liste Task 2 mais présent dans `files_modified`) a reçu la nouvelle assertion.

## Known Stubs

Aucun.

## Self-Check: PASSED
