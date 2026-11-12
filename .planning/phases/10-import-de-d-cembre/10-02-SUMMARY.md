---
phase: 10-import-de-d-cembre
plan: 02
subsystem: import, corpus-tests, pieges, relecture
tags: [imp-02, d-04, d-05, instantane, coherence, pieges, equite]

requires:
  - phase: 10-01
    provides: lireYamlPlafonne (analyseur plafonné) utilisé par le chargeur
  - phase: 09-15
    provides: filtre de production (une personne au statut non relu est absente)
provides:
  - "scripts/lib/instantane.ts : comparerInstantane (erreurs E1 à E6, informations I1 à I3), formaterEcart, instantaneLePlusRecent"
  - "scripts/lib/instantane-depot.ts : chargerEtatDepot(racine), seule lecture disque"
  - "tests/corpus/instantane-coherence.test.ts : 25 cas (17 synthétiques, 5 sur racines temporaires, 3 sur le dépôt réel)"
  - "Quatre pièges EQUITE_CANDIDAT_MANQUANT--import-* (personne fictive) et tests/relecture/marquer-import.test.ts"
affects: [10-03, 10-04]

key-files:
  created:
    - scripts/lib/instantane.ts
    - scripts/lib/instantane-depot.ts
    - tests/corpus/instantane-coherence.test.ts
    - tests/relecture/marquer-import.test.ts
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon/
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon-preview/
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-relu/
    - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-relu-avec-case/
  modified: []

key-decisions:
  - "D-04 vit dans npm test (tests/corpus), pas dans une règle du validateur : le validateur ne lit que src/content/ et reste isolé pour les fixtures --root"
  - "Une personne absente de l'instantané (I2) est une information, pas une erreur"
  - "Le plus récent des instantanés est le maximum par (mise_a_jour, fetched_at) ; un test compare cette définition à celle par nom de fichier du reste des tests, pour qu'elles ne dérivent pas en silence"

requirements-completed: [IMP-02]

completed: 2026-11-12
---

# Phase 10 Plan 02 : cohérence instantané data.gouv et fichiers candidats, pièges D-05

**`npm test` compare l'instantané versionné, la table de correspondances et les 59 fichiers candidats (identifiants, ids_externes, couple code/motif du statut le plus récent, pointeur), une ligne par écart ; quatre pièges figent ce qui arrive à une personne déclarée ajoutée à un thème publié, et `marquer statut` refuse puis restaure tant que la case manque.**

## Résultat sur le dépôt réel

- 59 lignes amont, 59 fiches, **0 écart, 0 information** (aucune dérive de source, aucun absent en amont, aucune fiche hors import).
- Le plus récent par nom de fichier et par (mise_a_jour, fetched_at) est le même instantané (`2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json`), et c'est celui que pointe `data/dataset-datagouv.yaml`.

## Ce qu'asserte chaque piège

Ces pièges prouvent des états, pas une détection en production avant relecture : une personne non relue y est invisible. La détection repose sur le piège « relu », l'avertissement d'aperçu, le refus de `marquer`, et (plus tard) la section « Conséquences sur les thèmes publiés » du rapport de 10-03.

| Piège | Mode | Assertion |
|-------|------|-----------|
| `--import-brouillon` | production | `[]` : la personne au statut brouillon est invisible (ADR-041 et filtre 09-15). Preuve d'invisibilité, pas de détection |
| `--import-brouillon-preview` | aperçu | `EQUITE_CANDIDAT_MANQUANT` en avertissement sur `src/content/themes/logement.yaml` `/statut_relecture` |
| `--import-relu` | production | `EQUITE_CANDIDAT_MANQUANT` en erreur, même fichier, `/statut_relecture`, ligne 11 |
| `--import-relu-avec-case` | production | même fiche relue plus la case `programme_non_publie` dans `couverture/logement.yaml` : `[]` |

Scénario `marquer` (`tests/relecture/marquer-import.test.ts`, racine temporaire issue de `--import-brouillon`) : la production est propre au départ ; `marquer statut nouvelle-personne` sort avec le code 1 et dit

```
erreur : src/content/themes/logement.yaml:11:1 EQUITE_CANDIDAT_MANQUANT le thème publié « logement » n'a ni mesure publiée ni case de couverture pour le candidat « nouvelle-personne »
refusé : statut:nouvelle-personne : 1 nouvelle(s) erreur(s) de validation après écriture : fichier restauré
```

le fichier retrouve ses octets d'origine ; une fois la case posée (même patch que `--import-relu-avec-case`) la commande sort avec 0, `statuts[0]` porte `relu`, `relecteur`, `date_relecture`, et la production n'a plus d'erreur.

## Preuve par mutation

Sur une copie temporaire de `data/` et de `src/content/candidats/` (jamais les vrais fichiers), le code d'un statut le plus récent passe de `declare` à `pressenti` : la liste d'erreurs contient `<id> : statut : fichier=pressenti amont=declare`. C'est un cas de test. Autres cas sur racines temporaires : instantané plus récent déposé sans mise à jour du pointeur (une seule erreur `instantane`), fiche au YAML refusé et table au YAML refusé (l'erreur nomme le fichier).

## Task Commits

1. Cas rouges de la cohérence (module absent) : `72adae1` (test)
2. Module et chargeur : `1020e76` (feat)
3. Quatre pièges et test de `marquer` : `40a6b27` (test)

## TDD

- Cohérence : rouge observé (module introuvable), puis vert. Pas de test écrit qui passe à vide : le cas de mutation échoue si le code ne compare pas les statuts.
- Pièges : le piège `--import-relu` a été vu rouge avec `attendu: []` (une erreur réelle), puis corrigé. Les trois autres pièges et le test `marquer` étaient verts du premier coup : c'est une caractérisation de comportement déjà protégé par le code (conclusion de la recherche pour D-05), aucune modification de validateur, de règle ou d'outil de relecture.

## Deviations from Plan

Aucune dans le fond. Précisions :
- Les `pointer` des attendus sans `ligne` (aperçu) n'en portent pas : le piège existant n'en donne une que pour la production.
- Aucun fichier hors `files_modified` (plus SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Vérifications

- `TZ=Europe/Paris fnm exec --using=24 npm test` : 2666 tests, 2657 réussis, 0 échec, 9 ignorés (existants) ; 2624 avant ce plan
- `fnm exec --using=24 npm run check` : 0 erreur, 0 avertissement
- `node scripts/validate.ts --mode production` : 391 fichiers, 0 erreur, 25 avertissements existants
- `grep -c "import .* from 'yaml'"` : 0 pour les deux modules ; `git status --porcelain tests/fixtures/corpus-valide src/content data archives` : vide ; load.ts, règles d'équité, `scripts/lib/relecture/`, `scripts/import-datagouv.ts` non modifiés

## Known Stubs

Aucun.

## Self-Check: PASSED
