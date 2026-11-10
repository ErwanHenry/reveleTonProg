---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 06
subsystem: relecture, content-tooling, testing
tags: [relecture, publier, retirer, retrait-urgence, couverture, tout-ou-rien, node-test]

# Dependency graph
requires:
  - phase: 09-01
    provides: definirChamps, ecrireAtomique, etatRelecture, chargerCorpus, erreursDuTheme, registre, dispatcher, marquer, aujourdhuiParis, tests/helpers/corpus-relecture.ts
  - phase: 09-02
    provides: loadPublicationConfig (liste blanche config/publication.yml), codes PUBLICATION_*
provides:
  - scripts/lib/relecture/lot.ts (appliquerLot, afficherDiagnostic)
  - scripts/lib/relecture/commandes/publier.ts (`npm run relecture -- publier --theme <id>`)
  - scripts/lib/relecture/commandes/retirer.ts (`npm run relecture -- retirer <candidat/slug> | --theme <id>`)
  - tests/relecture/etat-publie.ts (thème logement du corpus M1 prêt ou publié, réutilisable)
affects: [09-07, 09-09, 09-11]

tech-stack:
  added: []
  patterns:
    - "Lot tout ou rien : éditions calculées et contrôlées en mémoire, écriture fichier par fichier, vérification (loadAll en production), restauration en ordre inverse sur échec ou exception"
    - "Les commandes exportent leur coeur (publier, retirer) avec un chargeur injectable pour tester les échecs après écriture"

key-files:
  created:
    - scripts/lib/relecture/lot.ts
    - scripts/lib/relecture/commandes/publier.ts
    - scripts/lib/relecture/commandes/retirer.ts
    - tests/relecture/etat-publie.ts
    - tests/relecture/publier.test.ts
    - tests/relecture/retirer.test.ts
  modified: []

key-decisions:
  - "publier ne marque jamais rien relu : une mesure a_relire, a_revoir (texte changé depuis la relecture), une note ouverte, un statut ou une case non relus, une mesure d'un candidat hors périmètre, une erreur de validation du thème ou une alerte ARCHIVE_WAYBACK_ABSENTE bloquent ; toutes les raisons sont listées ensemble"
  - "La phrase « thème absent de config/publication.yml » est exportée (PHRASE_ABSENT_LISTE) et épinglée par un test"
  - "retirer exige --case seulement quand la CI passerait au rouge : thème publié, case `mesures`, aucune autre mesure publiée du candidat sur le thème (la condition exacte d'EQUITE_COUVERTURE_INCOHERENTE) ; sinon --case est refusé comme inutile"
  - "Sans --case quand il est nécessaire : exit 1, le piège en une phrase, les deux lignes à copier (la première avec les ids des sources du candidat) et le repli --theme ; la commande ne choisit jamais l'état de la case"
  - "Les lignes de journal sont écrites après la réussite seulement ; l'empreinte d'une mesure publiée reste celle de sa relecture, donc liste la voit `publie` et non `a_revoir`"
  - "Le rappel de gel réutilise FENETRES_GEL et dateParis de scripts/garde-gel.ts (importable sans effet de bord), aucune seconde liste de dates"

patterns-established:
  - "Tests de publication sur le thème logement du corpus M1 temporaire : thème et mesures remis à brouillon, case d'Élise à `mesures`, puis relecture par la vraie commande marquer"

requirements-completed: []

duration: 40min
completed: 2026-11-11
---

# Phase 9 Plan 06: Commandes publier et retirer Summary

**Deux commandes sorties de l'outil de relecture : `publier` passe un thème entièrement relu à `publie` en une opération tout ou rien (liste blanche exigée, validation de production sur tout le corpus, restauration sinon), et `retirer` repasse une mesure publiée à brouillon en mettant à jour la case de couverture dans la même opération, ou le thème entier en repli.**

## Accomplissements

- `lot.ts` : `appliquerLot(racine, editions, verifier)`. Deux éditions sur un même fichier s'enchaînent sur le même texte ; un refus en mémoire n'écrit rien ; une vérification qui échoue ou lève restaure chaque fichier.
- `publier --theme <id> [--relecteur] [--date] [--dry-run]` : refus groupés (exit 1, rien d'écrit), `N mesures publiées, thème <id> publié`, « déjà publié » au second passage, une ligne de journal par cible.
- `retirer <candidat/slug> [--case non_precise --sources a,b | --case programme_non_publie]` et `retirer --theme <id>`, avec `--dry-run`, validation de production après écriture, journal (`action: retirer`) et rappel des deux formes `gh workflow run` pendant une fenêtre de gel.
- Aucune des deux commandes n'écrit config/publication.yml ni autre chose que des champs de relecture et de couverture, par l'éditeur à positions de 09-01 (aucun `stringify(` ni `.toString()`).

## Task Commits

1. **Task 1 : publier** : `dcb5ff9` (test, rouge), `d6c803b` (feat)
2. **Task 2 : retirer** : `0367110` (test, rouge), `d60affb` (feat)

## Vérification

- `tests/relecture/*.test.ts` : 81 tests, 0 échec (publier 15, retirer 14).
- `npm test` : 2481 tests, 2472 réussis, 0 échec, 9 ignorés. `npm run check` : 0 erreur, 0 avertissement, 0 conseil.
- Vrai corpus, sans écriture : `publier --theme sante --dry-run` sort en 1 et cite « thème absent de config/publication.yml » parmi 127 lignes de refus ; `retirer nathalie-arthaud/sante-embauches-hopitaux --dry-run` répond en 1,2 s (refus : mesure non publiée). `git status --porcelain src/content archives data config relecture` : vide.

## Deviations from Plan

### Auto-fixed Issues

None au sens des règles 1 à 3.

### Écarts de forme

- **TDD :** les tests et le code ont été écrits ensemble puis commités en deux temps (tests d'abord, code ensuite) : les commits `test(...)` existent bien avant les `feat(...)` et seraient rouges seuls, mais le rouge n'a pas été observé avant d'écrire le code.
- **Exigence non cochée :** PUB-02 (un thème est réellement publié) et LEG-03 (RUNBOOK, écrit par 09-09) ne sont pas cochés dans REQUIREMENTS.md : ce plan fournit les outils, pas encore la publication ni la procédure documentée.
- **Chargeur du retrait :** la validation de `retirer` exige zéro erreur dans tout le corpus, comme écrit au plan. Si le corpus avait déjà une erreur sans rapport, le retrait serait refusé (et la CI serait de toute façon rouge).

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau. T-09-30 à T-09-34 traités comme prévu (préconditions de `publier`, `appliquerLot` avec restauration testée, `--case` obligatoire sans valeur par défaut, `--theme` sans décision éditoriale, journal).

## Commandes pour Erwan

Publier un thème (après avoir relu toutes les cibles et ajouté le thème à `themes_ouverts` dans config/publication.yml, dans un commit dédié) :

```
npm run relecture -- publier --theme <id> --dry-run
npm run relecture -- publier --theme <id>
```

Retrait d'urgence d'une mesure :

```
npm run relecture -- retirer <candidat>/<slug>
# si c'était sa seule mesure publiée du thème, la commande refuse et imprime les deux lignes à choisir :
npm run relecture -- retirer <candidat>/<slug> --case non_precise --sources <id-source,id-source>
npm run relecture -- retirer <candidat>/<slug> --case programme_non_publie
# repli le plus rapide, sans décision éditoriale :
npm run relecture -- retirer --theme <id>
```

Puis commiter, pousser sur main et approuver le déploiement.

## Self-Check: PASSED

Six fichiers créés présents ; commits dcb5ff9, d6c803b, 0367110, d60affb présents.
