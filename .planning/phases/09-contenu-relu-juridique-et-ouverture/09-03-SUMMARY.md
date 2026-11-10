---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 03
subsystem: sources, archivage, règles de contenu
tags: [wayback, exception, sources, pub-04, batho, rohou]

requires:
  - phase: 03
    provides: scripts/archive-source.ts, scripts/lib/{archive,wayback}.ts, règle ARCHIVE_WAYBACK_ABSENTE
provides:
  - Champ archive.wayback_exception {motif, decide_par, decide_le}, exclusif de wayback_url, sans montée de version du schéma
  - Règle des sources citées par une mesure publiée : copie Wayback ou exception motivée
  - Mode `npm run archive -- --wayback-adopter <id> --nouvelle-url <url> --instantane <horodatage>` (reprend un instantané existant après preuve paragraphe par paragraphe)
  - executer(argv, deps) exporté par scripts/archive-source.ts (testable en processus)
  - Trois sources Batho corrigées (url + wayback_url), exception Rohou épinglée par test
affects: [09-09, 09-10, 09-11, 09-13]

tech-stack:
  added: []
  patterns:
    - "Exclusivité de deux clés sous unevaluatedProperties : if/then avec properties: {clé: false}, pas dependentSchemas"
    - "Liste épinglée des exceptions du corpus réel : toute nouvelle exception fait échouer un test tant qu'elle n'est pas ajoutée à la main"

key-files:
  created:
    - tests/rules/sources-wayback.test.ts
  modified:
    - schemas/defs/common.schema.json
    - schemas/CHANGELOG.md
    - src/lib/content-core/rules/archives.ts
    - src/lib/corpus/types.ts
    - scripts/lib/archive.ts
    - scripts/lib/wayback.ts
    - scripts/archive-source.ts
    - tests/schemas/source.test.ts
    - tests/archive/archive.test.ts
    - tests/archive/wayback.test.ts
    - src/content/sources/delphine-batho-priorite-1.yaml
    - src/content/sources/delphine-batho-priorite-2.yaml
    - src/content/sources/delphine-batho-priorite-4.yaml
    - src/content/sources/erwan-rohou-programme-mei.yaml

key-decisions:
  - "Les quatre diffs de sources ont été montrés à Erwan et validés par lui le 2026-11-10 (« Valider les 4 ») avant toute écriture sous src/content/"
  - "Motif de l'exception Rohou reformulé par l'orchestrateur et validé : « le site ne renvoie pas vers une copie Wayback Machine de cette page » ; la première formulation (« elle n'est pas envoyée à la Wayback Machine ») était inexacte, un instantané de tiers existe déjà"
  - "Les sources priorité 2 et priorité 4 (hors santé) sont corrigées en même temps que la priorité 1 : même preuve, même outil"
  - "Une exception sans motif ne produit que l'erreur de schéma de la source (SCHEMA_REQUIRED) ; la règle des sources ignore volontairement les sources invalides"

requirements-completed: []
---

# Plan 09-03 : exception Wayback motivée et sources Batho, Rohou

## Résultat

PUB-04 est outillé : une source citée par une mesure publiée a une copie Wayback ou une exception motivée, datée et attribuée, acceptée par la règle. Les deux sources du thème santé qui bloquaient (Batho priorité 1, Rohou) sont en règle. L'exigence elle-même ne sera cochée qu'à la publication du thème (09-11), quand la règle tournera sur des mesures réellement publiées.

## Tâches

| Tâche | Contenu | Commit |
|---|---|---|
| 1 (rouge) | Tests de l'exception, de la liste épinglée et du mode d'adoption | 27fcbc4 |
| 1 (vert) | Champ, règle, mode `--wayback-adopter` | 57f8092 |
| 2 | Point de validation : diffs exacts montrés à Erwan, validés le 2026-11-10 | sans commit |
| 3 | Adoption des trois instantanés, exception Rohou, liste épinglée | 8ac6e4f |

## Preuves de la tâche 3

- Anciennes adresses Batho : 404. Nouvelles adresses (prises dans l'index des priorités du site) : 200. Les trois copies Wayback adoptées répondent 200.
- Extrait archivé retrouvé paragraphe par paragraphe dans chaque instantané : 30/30 (priorité 1, instantané 20261109220051), 29/29 (priorité 2, 20261109090913), 39/39 (priorité 4, 20261109220340). Même résultat sur les pages en ligne.
- Tests ciblés (règle, schéma, archive, wayback) : 101 sur 101. `validate` en modes production et preview : 0 erreur, 25 avertissements (inchangé).
- `git status --porcelain archives` vide : aucun extrait ni empreinte modifié.
- Extrait Rohou versionné : aucune adresse électronique ni numéro de téléphone. La page Rohou et son instantané n'ont pas été téléchargés.

## Écarts

1. **Exclusivité des deux clés.** `dependentSchemas` rendait toutes les clés d'archive « inconnues » sous `unevaluatedProperties`. Remplacé par `if/then` avec `wayback_url: false`. Erreur produite : `SCHEMA_FALSE` sur `/archive/wayback_url`.
2. **Formulation du plan corrigée.** Une exception sans motif ne déclenche pas d'erreur de référence sur la mesure : seule l'erreur de schéma de la source apparaît. Elle bloque toujours la publication. Le test fixe ce comportement.
3. **Point d'entrée testable.** `archive-source.ts` exporte `executer(argv, deps)` et ne s'exécute que sous `import.meta.main` ; `paramsDeSource` est passé dans `scripts/lib/archive.ts` (relire puis réécrire chacune des sources réelles redonne les mêmes octets) ; un `diffUnifie` sans dépendance a été ajouté.
4. **Quatre lignes, pas trois.** Le bloc d'exception compte la clé et trois champs.
5. **Tâche 3 faite par l'orchestrateur**, pas par l'exécuteur, pendant que le plan 09-05 tournait : seuls les cinq fichiers de la tâche ont été commités (commit par chemins), sans build ni suite complète en parallèle. La suite complète passe avec le push du plan 09-05.

## Points ouverts

- **RUNBOOK (09-09).** Le site de Delphine Batho répond 403 à l'agent utilisateur de l'outil d'archivage (200 pour curl). L'adoption n'est pas touchée (elle ne lit que web.archive.org), mais un futur `--refresh` de ces sources demandera `--file`.
- **Relecture (09-10).** Le champ `source_localisation` des deux mesures santé de Delphine Batho dit encore « page de la priorité 1 La pleine santé » : à voir par Erwan, aucun agent ne le modifie.
- **`data/couverture-themes.yaml`.** Trois lignes de « sources consultées » citent encore les anciennes adresses Batho, telles qu'elles étaient le jour de la consultation (2026-11-03). Fichier non modifié (hors des diffs validés) : à trancher avec Erwan, garder comme trace datée ou mettre à jour.
- **Motif non affiché.** Le motif de l'exception n'apparaît sur aucune page ; l'afficher près de la source serait une amélioration possible.
