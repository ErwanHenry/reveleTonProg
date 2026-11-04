---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 03
subsystem: qualite
tags: [audit, personas, qual-06, cli]
requires: []
provides:
  - scripts/audit-lire.ts (lecteur texte journalisé, lecture seule)
  - audit/ (README, 3 briefs de personas)
  - docs/AUDIT-TEST-CROISE.md (protocole, scénario, pièges, sections de résultats à remplir)
affects: [05-06, 05-07]
tech-stack:
  added: []
  patterns: [CLI node natif TS, journal JSONL à clés fixes]
key-files:
  created:
    - scripts/audit-lire.ts
    - tests/scripts/audit-lire.test.ts
    - audit/README.md
    - audit/personas/enfant-10-ans.md
    - audit/personas/retraite-72-ans.md
    - audit/personas/journaliste.md
    - docs/AUDIT-TEST-CROISE.md
  modified: []
key-decisions:
  - "Sans --niveau, tous les niveaux sont affichés avec leur étiquette ; avec --niveau, les autres rédactions sont omises."
  - "Le chemin demandé est décodé, résolu et doit rester sous le dist, uniquement des .html (code de sortie 2 sinon)."
requirements-completed: [QUAL-06]
duration: 20min
completed: 2026-11-03
---

# Phase 5 Plan 03: banc d'audit croisé Summary

Lecteur CLI journalisé en lecture seule sur un dist, trois briefs de personas sans réponse attendue, et protocole d'audit (critère, scénario de 13 tests bloquants ou non, 7 pièges §12 avec commande de rejeu) écrits avant toute passe.

## Tâches

1. Lecteur `scripts/audit-lire.ts` (TDD, 5 tests verts, `npm run check` à 0 erreur) : commit d47edf9.
2. Briefs et protocole : commit voir `git log` (docs(05-03)).

## Deviations from Plan

- Le worktree n'était pas basé sur 37e18a8 : `git reset --hard 37e18a8` exécuté comme prescrit.
- Les tests ont été écrits avec le code dans le même commit (pas de commit RED séparé) ; aucun écart de comportement.
- L'expression `[Niveau] ` du texte rendu est recollée à sa ligne par un post-traitement, pour que « [Résumé] Texte » reste sur une ligne.

## Known Stubs

Les sections Résultats, Constats classés, Corrections, Verdict et la colonne Résultat des pièges de `docs/AUDIT-TEST-CROISE.md` valent « à remplir (05-07) » : voulu, remplies par 05-07.

## Notes

- Aucun `audit/journal.jsonl` créé (le journal réel naît en 05-07). Pas d'alias npm (05-06). Aucun `astro build` lancé.
- Le rejeu d'un piège passe par `--test-name-pattern "<CODE>"` sur `tests/pieges/pieges.test.ts` (le nom du dossier de piège figure dans le nom du test) ; à confirmer en 05-07.

## Self-Check: PASSED
