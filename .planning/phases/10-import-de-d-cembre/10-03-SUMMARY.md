---
phase: 10-import-de-d-cembre
plan: 03
subsystem: import, rapport, repetition-a-blanc
tags: [imp-03, d-06, rapport, dry-run, check, repetition]

requires:
  - phase: 10-01
    provides: lireYamlPlafonne (lectures YAML de l'import)
  - phase: 10-02
    provides: comparerInstantane, chargerEtatDepot (contrôle D-04 réutilisé par --check)
provides:
  - "scripts/lib/rapport-import.ts : construireRapport(entree) et rapportMarkdown(rapport), modules purs"
  - "npm run import:datagouv -- --format texte|markdown, --dry-run tolérant aux identifiants inconnus, --check"
  - "Répétition réelle sur le jeu en ligne dans un worktree jetable, et la liste des fichiers à mettre à jour à la main pour 10-05"
affects: [10-04, 10-05, 10-06]

key-files:
  created:
    - scripts/lib/rapport-import.ts
    - tests/import/rapport.test.ts
  modified:
    - scripts/import-datagouv.ts
    - tests/import/import-cli.test.ts

key-decisions:
  - "Le rapport est du Markdown déterministe produit par un module pur (données en entrée, aucun disque) : même texte pour le terminal et pour le corps de la pull request"
  - "Un identifiant amont inconnu ne s'écrit nulle part comme décision : il est listé sous « Nouveaux à décider » avec les seuls faits amont (identifiant, nom public, code, date, source, vérifié le, clés de liens), jamais l'étiquette de parti, le bloc, les propositions ni le détail"
  - "La section que la feuille de route appelle « retirés » s'intitule « Absents du jeu amont » ; l'en-tête le dit, et le mot n'apparaît qu'une fois, dans cette phrase de vocabulaire"
  - "En mode markdown stdout ne porte que le rapport (tout le reste sur stderr) ; en cas de conflit le rapport est quand même imprimé, avec le code 1"

requirements-completed: []

completed: 2026-11-12
---

# Phase 10 Plan 03 : rapport de répétition à blanc, --check et répétition sur le jeu en ligne

**`npm run import:datagouv -- --dry-run --format markdown` imprime sans rien écrire le diff de décembre (nouveaux, à décider, absents du jeu amont, changés champ par champ, statuts relus qui changent, conséquences sur les thèmes publiés, dérives de source, conflits), chaque transition porte sa source et sa date ; `--check` lance la cohérence D-04 sans réseau ; l'import de décembre a été répété pour de vrai sur le jeu en ligne dans un worktree jetable, aujourd'hui disparu.**

IMP-03 n'est pas coché : l'import réel est l'objet de 10-05 et 10-06.

## Forme du rapport

Sections, dans l'ordre, toujours présentes (« aucun » si vide), puis une ligne finale (« Aucune décision sur une personne n'est prise par cet outil : statut, motif et type de source sont décidés par le relecteur. »). Exemples sur des personnes fictives :

| Section | Ligne d'exemple |
|---------|-----------------|
| `## Instantané` | `- fiches : 1 créée(s), 1 statut(s) ajouté(s), 59 inchangée(s)` et la phrase « Vocabulaire : « absents du jeu amont » correspond aux « retirés » de la feuille de route ; une absence du jeu ne vaut pas retrait de candidature. » |
| `## Nouveaux` | `- zoe-test : declare (2026-11-01), source https://exemple.test/zoe du 2026-11-01` |
| `## Nouveaux à décider (absents de correspondances.yaml)` | `- inconnu-un : Essai Fictif Un, renonce (2026-11-02), source https://exemple.test/inconnu, vérifié le 2026-11-09, liens : campagne, parti` |
| `## Absents du jeu amont` | `- b (fiche bob-test) : absent du jeu amont du 2026-12-10` |
| `## Changés` | `- alice-test : statut : declare (2026-09-01) -> renonce/retrait (2026-11-20), source https://exemple.test/nouveau du 2026-11-20` ; `- alice-test : parti : différent du fichier (non appliqué)` |
| `## Statut déjà relu qui change` | `- alice-test : relu declare (2026-09-01), source https://exemple.test/alice-ancien du 2026-09-01 -> renonce/retrait (2026-11-20), source https://exemple.test/alice-nouveau du 2026-11-20` puis `  - thème logement : 2 mesure(s) publiée(s), case : aucune` |
| `## Conséquences sur les thèmes publiés` | par thème publié et ouvert : `cellules attendues : 2 maintenant, 3 après relecture de tous les statuts importés`, `case de couverture à créer avant de relire le statut : zoe-test (declare)`, `sort du périmètre après relecture : alice-test (renonce), 2 mesure(s) publiée(s), case : aucune` ; sinon `aucun thème publié` |
| `## Dérives de source (information)` | `- alice-test : declare inchangé ; fichier https://exemple.test/ancienne du 2026-09-01 ; amont https://exemple.test/nouvelle du 2026-09-15` |
| `## Conflits` | `- alice-test : régression de date : amont renonce du 2026-01-01` (le tiret long du texte du mode texte devient « : ») |

Le périmètre vient de `rules/equite.ts` (`statutRetenu`, `dansPerimetre`, `statutLePlusRecent`) : production pour ce que le site montre, aperçu pour ce que verra la relecture. Le texte ne contient ni étiquette de parti, ni qualificatif, ni tiret long ou demi-long (les textes amont sont nettoyés), et aucun mot interdit (testé sur chaque entrée).

## Options de la commande

- `--format texte|markdown` (texte par défaut : sortie inchangée octet pour octet, les tests existants passent sans modification) ; autre valeur : code 2.
- `--dry-run` : un identifiant inconnu est listé (texte : `à décider : <ids>` ; Markdown : « Nouveaux à décider ») et les autres lignes sont traitées ; code 0 sauf conflit ou fiche invalide ; rien n'est écrit (comparaison octet pour octet de la racine temporaire, `ids.lock` compris). Sans `--dry-run`, un identifiant inconnu arrête toujours tout.
- `--check [--root]` : sans réseau, refuse `--file`, `--url`, `--dry-run`, `--format` (code 2) ; imprime les écarts, puis les informations préfixées « information : » ; code 1 s'il y a un écart, sinon « cohérence instantané / fiches : 0 écart ».

Sur le dépôt réel, le dry run Markdown donne « aucun » sous Nouveaux, Changés et Conflits (59 inchangées) et `--check` sort avec 0.

## Répétition sur le jeu en ligne

Worktree détaché et jetable sous `/tmp/rtp-rehearsal.pNM5WV/rtp-import-essai` (supprimé), à partir de `de22a10` (les commits de ce plan). Lecture seule du jeu data.gouv par `fetchSafe`, `npm ci` sur le lockfile, `git fetch origin relecture/sante` en lecture.

### Étape 1 : dry run, table de correspondances inchangée (premier rapport)

Code de sortie 0 en 2,5 s. Jeu en ligne : `mise_a_jour 2026-11-01`, 61 lignes, instantané `2027etmoi-candidats-2026-11-01-5fae5880d9ac.json`. Rapport (les identifiants, noms et adresses de personnes réelles sont retirés de ce document, conformément à la consigne de ne rien dériver ni recopier sur des personnes réelles ; la commande ci-dessus le reproduit sur demande) :

```
## Instantané        61 lignes amont, précédent : 2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json, 0 créée(s), 0 statut(s) ajouté(s), 59 inchangée(s)
## Nouveaux           aucun
## Nouveaux à décider (absents de correspondances.yaml)
                      2 lignes : <id amont>, <nom public amont>, <code> (<date>), source <url>, vérifié le 2026-11-09, liens : wikipedia   (un declare, un renonce)
## Absents du jeu amont      aucun
## Changés            aucun
## Statut déjà relu qui change   aucun
## Conséquences sur les thèmes publiés   aucun thème publié
## Dérives de source (information)   6 lignes : <id>, <code> inchangé ; fichier <url> du <date> ; amont <url> du <date>
## Conflits           aucun
```

Constats : 2 nouveaux, 0 absent, 0 changement de statut, 6 dérives de source à statut inchangé, 59 inchangés, 0 conflit. C'est exactement la vue de la recherche (§11).

### Étape 2 : placeholders

Deux entrées d'essai évidentes (`essai-un`, prénom `Essai`, nom `Un`, type `institution`, motif `non_candidat` seulement pour le statut `renonce` ; `essai-deux`) ajoutées dans le worktree seul, chacune commentée « sans rapport avec la personne », supprimée avec ce worktree. Aucun découpage de nom, type de source ni motif n'a été déduit d'une personne réelle. Dry run suivant : code 0, 2 sous « Nouveaux », 0 sous « Nouveaux à décider », 6 dérives, 0 changé, 0 absent, 0 conflit.

### Étape 3 : import réel dans le worktree

Code 0 en environ 1 s : 61 lignes, 2 créés, 0 statut ajouté, 59 inchangés, 0 absent, 0 conflit. Écrit : instantané et `.meta.json`, deux fiches, `ids.lock`.

| Contrôle (avant mises à jour à la main) | Résultat |
|---|---|
| `node scripts/validate.ts --mode production` | code 0, 393 fichiers, 0 erreur, 25 avertissements (les mêmes qu'avant) |
| `node scripts/ids.ts --check` | code 0, 61 candidats, 61 verrouillés |
| `npm run import:datagouv -- --check` | **code 1** : 1 écart `data/dataset-datagouv.yaml : instantane` (pointeur sur l'ancien instantané), plus des informations « absent de l'instantané » pour les deux fiches : D-04 attrape bien le pointeur périmé |
| `npm test` (231 s) | 2758 tests, 9 en échec. En échec : `instantane-coherence` (3), `import-cli` (2 de mes tests qui lisent l'état du dépôt, attendu), `tests/corpus/fiches.test.ts` (date de ATTRIBUTION.md et LICENSE), `tests/corpus/couverture-themes.test.ts` (une ligne par candidat du périmètre), `tests/corpus/pilote.test.ts` (2 : case manquante dans chaque thème pilote) |

### Étape 4 : mises à jour à la main (avec des valeurs fictives pour les personnes)

| Contrôle | Résultat |
|---|---|
| `npm run import:datagouv -- --check` | code 0, « 0 écart » (plus des informations de dérive de source) |
| `npm test` (231 s) | un seul échec restant (ma ligne fictive du tableau de couverture sans `urls_consultees`), corrigé puis `couverture-themes` et `pilote` : 14 tests, 0 échec |
| `npm run check` | 0 erreur, 0 avertissement, 0 conseil |
| `RTP_MODE=production npm run build` | code 0, 7 pages, 3 s |
| `RTP_MODE=production npm run check-dist` | code 0, 0 erreur, 3 avertissements attendus (aucun thème ouvert, hébergeur « prévu ») |

### Liste de contrôle pour 10-05 (fichiers à toucher à la main dans l'import réel)

Écrits par l'outil : le nouvel instantané et son `.meta.json`, les nouvelles fiches `src/content/candidats/<id>.yaml`, `ids.lock`, et l'ajout éventuel d'entrées de statut aux fiches existantes. Entrées de `data/import/correspondances.yaml` : décision d'Erwan (prénom, nom, `nom_tri`, type de source, motif), jamais d'un agent.

À la main, dans la même pull request :

1. `data/dataset-datagouv.yaml` : `instantane` (nouveau chemin) ; relire la description du jeu en ligne pour `annonce` et `description_consultee_le` (non modifiés dans la répétition : un fait à constater, pas à supposer).
2. `data/import/ATTRIBUTION.md` : date « mises à jour le JJ/MM/AAAA ».
3. `LICENSE` (ligne 81) : même date. Les deux sont contrôlés par `tests/corpus/fiches.test.ts`.
4. `tests/corpus/dataset-datagouv.test.ts` (titre et assertions lignes 58 à 63 : total, répartition par statut, `miseAJour`), calculés sur le nouvel instantané.
5. `tests/dist/cas/methode.cas.ts` ligne 133 : titre du test (« 61 lignes »).
6. `data/couverture-themes.yaml` : une entrée par nouvelle personne du périmètre (declare ou primaire), 10 cellules, `acces`, `sources`, **`urls_consultees` non vide** (le test l'exige même pour `aucun_site`). Ce sont des constats éditoriaux sur une personne réelle : décision d'Erwan. Contrôlé par `tests/corpus/couverture-themes.test.ts` (ordre `nom_tri`).
7. `src/content/couverture/{sante,travail,europe-et-monde}.yaml` : une case par nouvelle personne du périmètre dans chacun des thèmes pilotes (`candidat`, `etat`, `verifie_le`, `verifie_par`). Contrôlé par `tests/corpus/pilote.test.ts` (`PILOTE_CASE_MANQUANTE`). Idem : décision d'Erwan.
8. Textes qui annoncent un compte : `README.md` (lignes 94 et 98, « 59 »), `docs/COUVERTURE-THEMES.md` ligne 160 (« 59 », « 37/17/5 », date). Non contrôlés par un test : à ne pas oublier.

Ni `data/import/README.md` (aucun compte), ni la page Méthode (calculée depuis le pointeur) ne demandent de changement ; les ADR et `docs/AUDIT-TEST-CROISE.md` sont des documents d'historique.

Pour les nouveaux « déclarés », `Conséquences sur les thèmes publiés` du rapport dira, dès qu'un thème est publié et ouvert, quelles cases sont à créer avant de relire le statut.

### Essai de fusion (lecture seule)

Un commit local sur la tête détachée (jamais poussé, perdu avec le worktree), puis `git merge --no-commit --no-ff` de `origin/relecture/sante` : **aucun conflit**, fusion automatique réussie, arrêtée puis annulée. Aucun fichier candidat relu n'est modifié par l'import (aucun statut ne change) : seuls des fichiers créés ou propres à l'import sont touchés. Le worktree `../reveleTonProg-relecture` n'a pas été touché.

### Durées

`npm ci` 4,5 s ; dry run 2,5 s ; import réel environ 1 s ; validate 2 s ; ids 0 s ; `--check` moins d'une seconde ; `npm test` 231 s (deux fois) ; `npm run check` quelques secondes ; build 3 s ; check-dist 2 s ; essai de fusion quelques secondes.

### Nettoyage

`git worktree remove --force`, `git worktree prune`, dossier temporaire supprimé. Après : `git worktree list` montre les trois worktrees d'avant (main, relecture, design) ; `git status --porcelain src/content archives data config` vide ; `git branch --list`, `git ls-remote --heads origin` et la liste des remisages identiques à l'avant. Seule référence modifiée : le suivi distant local `origin/relecture/sante` (mis à jour par le `git fetch` demandé).

## Task Commits

1. Cas rouges du rapport : `f007c70` (test)
2. Module pur du rapport : `5285b18` (feat)
3. Cas rouges de la commande : `493b483` (test)
4. Options de la commande : `de22a10` (feat), poussé
5. Documents : voir le commit `docs(10-03)` de fin de plan

## TDD

Rouge vu pour la bonne raison deux fois : module introuvable (rapport), puis 11 cas en échec sur 31 (option `--format` ou `--check` inconnue, code 2 au lieu de 0 ou 1). Deux défauts de tests corrigés avant le vert : la section « Conflits » avalait la phrase finale (séparateur `---` ajouté) et les littéraux de tiret du module (remplacés par des échappements Unicode, pour que le module ne contienne aucun tiret long).

## Deviations from Plan

1. **[Écart de consigne] Premier rapport anonymisé dans ce document.** Le plan demande de le copier en entier ; la consigne de l'orchestrateur (rien de dérivé sur une personne réelle dans le SUMMARY) prime : sections, nombres et formes sont donnés, pas les identifiants, noms ni adresses réels.
2. Aucun défaut du code livré (rapport, options) trouvé pendant la répétition. Seule découverte hors plan : les cases à créer dans `data/couverture-themes.yaml` et dans les trois couvertures pilotes (points 6 et 7 de la liste), que le plan n'énumérait pas.
3. Les deux tests `--check` du fichier `import-cli.test.ts` attendent un dépôt cohérent, comme `instantane-coherence.test.ts` : ils échouent tant que le pointeur n'est pas à jour dans l'import réel (voulu, c'est le contrôle D-04).
4. Aucun fichier hors `files_modified` (plus SUMMARY, STATE, ROADMAP).

## Known Stubs

Aucun.

## Self-Check: PASSED
