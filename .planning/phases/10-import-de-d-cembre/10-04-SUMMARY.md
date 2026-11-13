---
phase: 10-import-de-d-cembre
plan: 04
subsystem: validateur, runbook, procedure-d-import
tags: [imp-03, d-08, d-09, statut-plus-recent, runbook, gel-d-import]

requires:
  - phase: 10-03
    provides: rapport de répétition, --dry-run, --format, --check, liste de contrôle des mises à jour à la main
provides:
  - "Avertissement de validateur STATUT_PLUS_RECENT_NON_RELU (D-08, option B), toujours un avertissement, jamais bloquant"
  - "RUNBOOK : « Importer les statuts data.gouv » réécrite, « Import de décembre (10 au 13 décembre 2026) », « Gel d'import (13 au 15 décembre 2026) »"
  - "Bloc de test phase 10 dans tests/repo/docs.test.ts"
  - "Décisions procédurales d'Erwan enregistrées (bloc « Décisions enregistrées » ci-dessous), lues par 10-05 et 10-06"
affects: [10-05, 10-06]

key-files:
  created:
    - src/lib/content-core/rules/statut-recent.ts
    - tests/rules/statut-plus-recent.test.ts
  modified:
    - src/lib/content-core/rules/corpus.ts
    - src/lib/content-core/rules/config.ts
    - tests/rules/moteur.test.ts
    - docs/RUNBOOK.md
    - tests/repo/docs.test.ts

key-decisions:
  - "D-08 option B : la règle vit dans son fichier, importe statutRetenu et statutLePlusRecent d'equite.ts (aucune copie, ADR-041), n'est jamais une erreur"
  - "D-09 : règle d'exploitation au RUNBOOK seule ; scripts/garde-gel.ts, ses fenêtres et les workflows sont inchangés"
  - "Le rapport de répétition ne change pas de forme (aucun changement demandé par Erwan)"

requirements-completed: []

completed: 2026-11-13
---

# Phase 10 Plan 04 : décisions procédurales, avertissement STATUT_PLUS_RECENT_NON_RELU, procédure et gel d'import au RUNBOOK

**`npm run validate` signale, en avertissement seulement et dans les deux modes, une personne dont le statut le plus récent n'est pas relu alors que la production affiche encore un statut relu plus ancien (message : les deux statuts et leurs dates) ; le RUNBOOK contient la procédure exécutable de l'import de décembre et le gel du 13 au 15 décembre 2026, gardés par un bloc de test.**

IMP-03 n'est pas coché : l'import réel est l'objet de 10-05 et 10-06.

## Décisions enregistrées

Le 2026-11-13, l'orchestrateur a présenté à Erwan Henry les sept questions de la tâche 1, en français, chacune avec son défaut, dans les termes du plan, en précisant que la forme du rapport de répétition pouvait être changée sur demande. Sa réponse, mot pour mot : « Tout par défaut ».

```
D-08: B
D-09: runbook
gel-debut: 2026-12-13 18:00
gel-fin: 2026-12-15 23:59
fusion-brouillon: oui
repli: reporter
import-avant-fin-ouverture: oui
relecture-non-fusionnee: reporter
source: reponse 2026-11-13
```

Précisions qui découlent des défauts acceptés :

- Limite de recréation de la branche d'import : **2026-12-13 12:00 (Paris)**. Au-delà, l'import attend la fin du gel (à partir du 16 décembre 2026).
- Il n'a demandé **aucun changement** à la forme du rapport de répétition : le module `scripts/lib/rapport-import.ts` et `tests/import/rapport.test.ts` ne sont pas modifiés.
- Heures et dates sont en heure de Paris. Aucune réponse n'a été prise par silence : la source est la réponse du 2026-11-13.
- Rien au sujet d'une personne n'a été décidé : les entrées de `correspondances.yaml`, les cases de couverture et le tableau `data/couverture-themes.yaml` restent des décisions d'Erwan, à prendre pour chaque nouvelle personne.

## Avertissement STATUT_PLUS_RECENT_NON_RELU (option B)

- Règle `regleStatutPlusRecent` dans `src/lib/content-core/rules/statut-recent.ts`, enregistrée dans `corpus.ts` juste après `regleEquite`. Pour chaque candidat : si `statutRetenu(statuts, 'production')` existe et que `statutLePlusRecent(statuts)` est une autre entrée dont `statut_relecture` n'est ni `relu` ni `publie`, un diagnostic `warning` (fichier du candidat, pointeur `/statuts/<index>/statut_relecture`, message « le statut le plus récent de <id> (<code>, <date>) n'est pas relu : la production affiche encore <code> du <date> »). Rien si l'entrée la plus récente est relue, si aucune entrée n'est relue (nouvelle personne : pièges D-05), si l'entrée non relue est plus ancienne, ni si un fichier candidat est invalide.
- Catalogue : une ligne `STATUT_PLUS_RECENT_NON_RELU` (REGLE-08, avertissement, sans piège). Le test « codes uniques » de `tests/rules/moteur.test.ts` comptait 46 codes en dur : passé à 47 (le nombre de codes à piège est inchangé, la règle est sans piège, aucun dossier de piège ajouté ni modifié).
- Ligne du tableau « Codes du validateur » du RUNBOOK (relire avec `marquer statut`, `--hors-perimetre` pour un retrait, jamais par script).
- Fichiers d'équité (`equite.ts`, `equite.test.ts`) et dossiers de pièges existants : non modifiés.

### Preuve que l'avertissement ne bloque jamais

`tests/rules/statut-plus-recent.test.ts` (11 cas) : le corpus de base ne produit aucun diagnostic dans les deux modes ; la règle se déclenche (un avertissement par mode, jamais une erreur, sur l'entrée la plus récente) ; WR-01 gardé (aucune erreur d'équité en production) ; message et libellé sans mot interdit ; se tait pour une entrée relue, plus ancienne, une personne sans statut relu, un fichier candidat invalide. Sur le corpus fictif M1 temporaire, une personne reçoit une entrée plus récente non relue, puis, avec l'avertissement affiché :

| Commande | Résultat avec l'avertissement affiché |
|---|---|
| `scripts/validate.ts --mode production` et `--mode preview` | code 0, « 0 erreur(s) », une ligne d'avertissement |
| `relecture publier --theme logement` | réussit (code 0) |
| `relecture retirer <mesure>` | réussit (code 0) |
| `relecture marquer statut <candidat>` | réussit (code 0) ; relire l'entrée fait disparaître l'avertissement |

Le chargeur de contenu d'Astro (build) et `check-dist` ne bloquent que sur `severity === 'error'` (relu dans `astro-loader.ts` et `check-dist.ts`) : un avertissement ne peut pas interrompre une build ni un déploiement.

### Corpus réel

`validate --mode production` : 391 fichiers, 0 erreur, 25 avertissements (les mêmes qu'avant), **0** `STATUT_PLUS_RECENT_NON_RELU`. Idem en preview (0). Personne n'est concerné aujourd'hui (chaque personne a un seul statut). Non vacuité prouvée par le fichier de tests sur la fixture.

### Page Méthode

Une ligne de plus dans le catalogue, rendue depuis `CATALOGUE` : « STATUT_PLUS_RECENT_NON_RELU | REGLE-08 | avertissement | Un statut de candidature plus récent que le statut relu attend sa relecture : la production affiche encore l'ancien. » Le cas de build de la page Méthode compare au `CATALOGUE.length` : il reste vert sans modification ; aucun autre changement visible.

## RUNBOOK

Trois sections de `docs/RUNBOOK.md`, en français, sans tiret long ni demi-long, sans mot interdit, sans secret ni nom de personne du jeu réel :

1. **Importer les statuts data.gouv** (réécrite) : tableau des quatre commandes (`--dry-run`, `--dry-run --format markdown`, `--check`, import réel), options communes, sections du rapport dans leur ordre, vocabulaire « Absents du jeu amont » (la ligne « retirés » de la feuille de route, jamais un retrait de candidature), refus YAML avec fichier, ligne et code.
2. **Import de décembre (10 au 13 décembre 2026)** : conditions de départ (relecture santé fusionnée, thème santé publié, `main` à jour et propre, aucun déploiement en attente, avant la limite de recréation), déroulé en 12 étapes (répétition du matin et contrôle de l'identifiant de ressource, entrées écrites par Erwan seul, worktree `../reveleTonProg-import` et branche `import/statuts-2026-12`, trois commits, rapport calculé depuis le commit parent dans un worktree jetable, preuves locales, pull request, règle D-08, preuve `--is-ancestor` montrée à Erwan pour le sha de tête exact, fusion par Erwan ou sur son accord écrit avec `--match-head-commit`, approbation du déploiement), règle « recréer la branche, jamais fusionner `main` dedans » avec les commandes exactes et la limite du 13 décembre 2026 à 12:00, replis (reporter), règle de la case de couverture avant de relire une nouvelle personne (pitfall 5), liste de contrôle de huit points dont les points 6 et 7 nommés « Décision d'Erwan », et la phrase « Aucun agent n'écrit jamais une entrée sur une personne ».
3. **Gel d'import (13 au 15 décembre 2026)**, juste après « Gel des scrutins et retrait d'urgence » : bornes 2026-12-13 18:00 à 2026-12-15 23:59, interdits (fusion, déploiement), seule exception (`retrait_urgence` avec justification), rejet par Erwan d'un run en attente, fenêtres de 2027 de `scripts/garde-gel.ts` inchangées.

### Commandes du RUNBOOK vérifiées, et comment

Aucun import réel n'a été lancé. Chaque commande a été exécutée sous une forme sans écriture ou sur un arbre jetable, ou lue dans le code :

| Commande | Vérification |
|---|---|
| `npm run import:datagouv -- --dry-run --format markdown --file <instantané>` | exécutée (code 0), sortie identique dans le dépôt et dans un worktree jetable détaché obtenu comme à l'étape 6 (`git worktree add --detach`, `npm ci`, `cp` de l'instantané) ; arbre inchangé après |
| `npm run import:datagouv -- --check` | exécutée, « 0 écart », code 0 |
| option inconnue (`--help`) | exécutée : affiche l'aide (usage) |
| options `--dry-run`, `--format`, `--check`, `--file`, `--url`, `--root` | lues dans `scripts/import-datagouv.ts` ; test du dépôt qui compare chaque option citée au code |
| `git worktree add -b <branche> <dossier> origin/main`, `git switch -C`, `git checkout <sha> -- <fichiers>`, `git cherry-pick`, `git branch -D` | simulés de bout en bout sur une branche et un worktree temporaires (supprimés) |
| `git merge-base --is-ancestor origin/main HEAD` et `origin/relecture/sante origin/main` | exécutées (codes 0 et 1 comme documenté) |
| `git range-diff A...B` | exécutée |
| `gh pr merge --help` (`--merge`, `--match-head-commit`), `gh pr create --help` (`--base`, `--head`, `--title`, `--body-file`), `gh pr view <n> --json headRefOid --jq .headRefOid` | aide lue, et `gh pr view` exécutée sur une pull request existante |
| `gh run list --branch main --status waiting` | exécutée |
| `curl` de l'API data.gouv du jeu, `grep -o` de l'identifiant de ressource | exécutée : l'identifiant `06237c53-76bd-4224-9805-418e125f0493` apparaît |
| `npm run ids -- --check`, `npm run couverture -- --check-data`, `npm run validate -- --mode production`, `npm test`, `npm run check`, build et check-dist de production | exécutées |
| `npm run relecture -- marquer statut <candidat> [--hors-perimetre]` | couverte par les tests de ce plan sur le corpus M1 ; commandes de relecture contrôlées contre `COMMANDES` par le test du RUNBOOK |

## Preuves

- `TZ=Europe/Paris npm test` : 2814 tests, 2805 réussis, 0 échec, 9 ignorés (les 9 d'avant). Ce plan ajoute 11 cas de règle (tests/rules/statut-plus-recent.test.ts) et 8 cas de documentation (bloc phase 10 de tests/repo/docs.test.ts).
- `npm run check` : 0 erreur, 0 avertissement, 0 conseil.
- Build de production : 7 pages ; `check-dist` : 0 erreur, 3 avertissements attendus (aucun thème ouvert, hébergeur « prévu »).
- `npm run e2e` en entier : 263 (corpus M1), 1214 (corpus réel) et 2 (relecture) cas réussis, 0 échec ; la page de relecture de l'orchestrateur (port 4327) n'a pas été touchée.

## Task Commits

1. Cas rouges de l'avertissement : `7d63734` (test, 6 cas rouges sur 11 pour la bonne raison : l'avertissement absent)
2. Règle, catalogue, RUNBOOK (ligne) : `4a44d93` (feat)
3. Cas rouges de la documentation : `70d236d` (test, 7 cas rouges sur 8 : sections absentes)
4. RUNBOOK (trois sections) : `034f855` (docs), poussé
5. Documents de fin de plan : commit `docs(10-04)` suivant

## TDD

Rouge vu deux fois pour la bonne raison. Règle : 6 cas sur 11 en échec parce que l'avertissement n'existait pas (longueur 0 au lieu de 1, ligne absente de la sortie de `validate`) ; les cinq autres passaient déjà (cas de silence), la non vacuité est portée par les cas qui déclenchent la règle. Un défaut du cas `publier` corrigé avant le vert : une entrée « declare » plus récente aurait fait refuser `publier` pour une autre raison (statut à relire), sans rapport avec l'avertissement ; le cas utilise donc un nouveau « renonce » non relu, hors périmètre, pour que seul l'avertissement s'allume. Documentation : test rouge sur sections absentes, puis vert ; deux défauts du test corrigés (lecture des options limitée aux options qui suivent la commande, forme `'dry-run': { type: ... }` du code).

## Deviations from Plan

1. **[Rule 3 - bloquant] `tests/rules/moteur.test.ts` modifié (hors `files_modified`)** : le compteur en dur du catalogue (46) devait passer à 47. Une ligne.
2. **[Écart de consigne] Pas de rapport de répétition modifié** : Erwan n'a demandé aucun changement ; `scripts/lib/rapport-import.ts` et `tests/import/rapport.test.ts` sont intacts (la partie « changements de forme » de la tâche 2 est vide).
3. **Titre de niveau 3** pour « Import de décembre (10 au 13 décembre 2026) » (le plan disait `####`) : l'aide `sectionRunbook` du test ne lit que les niveaux 2 et 3, et la procédure est une section de plein droit.
4. **Rapport depuis le commit parent** : le plan demandait seulement de le calculer depuis le commit parent ; le RUNBOOK précise la manière (worktree jetable détaché, `npm ci`, instantané copié), vérifiée sur un arbre jetable.
5. Aucun autre fichier hors `files_modified` (plus SUMMARY, STATE, ROADMAP). `load.ts`, `scripts/lib/relecture/`, `src/content/**`, `archives/**`, `data/**`, `config/**` et `../reveleTonProg-relecture` non touchés.

## Known Stubs

Aucun.

## Threat Flags

Aucune nouvelle surface : une règle de lecture seule du validateur, de la documentation et des tests.

## Self-Check: PASSED
