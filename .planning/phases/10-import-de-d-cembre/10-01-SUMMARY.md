---
phase: 10-import-de-d-cembre
plan: 01
subsystem: content-core, import, archive, couverture, repo-tests
tags: [yaml, imp-01, d-02, d-03, alias, uniqueKeys, liste-blanche]

requires:
  - phase: 03 (v1.0)
    provides: import data.gouv (import-datagouv.ts, datagouv.ts), parseYaml de content-core
  - phase: 09-03
    provides: archive-source --wayback-missing, exceptions Wayback motivées
provides:
  - "src/lib/content-core/yaml-plafonne.ts : lireYamlPlafonne, lireDocumentPlafonne, analyserYamlPlafonne, messageRefus (trois positions puis (+N autre(s))), YamlRefuse ; n'importe que 'yaml' (et deux types), pas load.ts"
  - "Six lectures YAML migrées dans quatre fichiers : import-datagouv.ts x3, datagouv.ts (ajouterStatutYaml), archive-source.ts (sourcesSansWayback), couverture.ts (lireCouverture)"
  - "tests/repo/yaml-plafonne.test.ts : LISTE_BLANCHE (8 fichiers motivés), trouverLecturesYamlDirectes, fermetureImports ; graphe d'import de couverture.ts épinglé"
affects: [10-02, 10-03, 10-05]

tech-stack:
  added: []
  patterns:
    - "Analyseur plafonné léger dupliqué volontairement, gardé identique à parseYaml de load.ts par un test d'équivalence champ par champ"
    - "Test de dépôt sur le code livré (git ls-files) avec liste blanche motivée et détection d'entrée périmée"
    - "Fermeture des imports relatifs épinglée pour garder une page Astro légère"

key-files:
  created:
    - src/lib/content-core/yaml-plafonne.ts
    - tests/content-core/yaml-plafonne.test.ts
    - tests/repo/yaml-plafonne.test.ts
  modified:
    - scripts/import-datagouv.ts
    - scripts/lib/datagouv.ts
    - scripts/archive-source.ts
    - scripts/lib/couverture.ts
    - tests/import/import-cli.test.ts
    - tests/import/datagouv.test.ts
    - tests/archive/wayback.test.ts
    - tests/couverture/classement.test.ts

key-decisions:
  - "IMP-01 : les scripts lisent le YAML du dépôt par src/lib/content-core/yaml-plafonne.ts, copie légère de parseYaml (load.ts non importé pour garder ajv et le moteur de règles hors de la build de la page Méthode) ; un test d'équivalence compare les diagnostics des deux analyseurs"
  - "IMP-01 : liste blanche de huit fichiers autorisés à importer parse/parseDocument/parseAllDocuments/Document de 'yaml' (yaml-plafonne, load, migrate, relecture/editer, quatre lecteurs de configuration), test de dépôt qui refuse tout autre import et toute entrée périmée"
  - "archive --wayback-missing : une source au YAML refusé arrête l'outil (code 1, fichier et ligne, « rien n'a été soumis ») au lieu d'être écartée en silence"
  - "lireCouverture : un refus donne une entrée « YAML illisible : fichier:ligne:col CODE message » par diagnostic, trois au plus, le reste compté sur la dernière ; la racine non objet garde sa phrase"

patterns-established:
  - "Lecture YAML d'un script : lireYamlPlafonne(texte, cheminRelatif), YamlRefuse dont le message nomme fichier, ligne, colonne et code"

requirements-completed: [IMP-01]

duration: ~25min
completed: 2026-11-12
---

# Phase 10 Plan 01 : lectures YAML plafonnées des outils d'import, d'archivage et de couverture

**Un analyseur YAML plafonné léger (yaml-plafonne.ts, équivalent prouvé à parseYaml de content-core sans importer load.ts) sert désormais les six lectures de l'import, de l'archivage et de la couverture : un alias, une bombe d'alias ou une clé en double est refusé avec fichier, ligne, colonne et code, et un test de dépôt interdit toute nouvelle lecture directe hors d'une liste blanche de huit fichiers.**

## Performance

- **Duration:** environ 25 min de travail (hors suite complète)
- **Started:** 2026-11-12T13:10Z (environ)
- **Completed:** 2026-11-12
- **Tasks:** 3/3
- **Files modified:** 11 (3 créés, 8 modifiés)

## Accomplishments

- `src/lib/content-core/yaml-plafonne.ts` : mêmes options que load.ts (schéma core, uniqueKeys, merge false, maxAliasCount 0), mêmes messages français, même visite des alias ; seul import d'exécution : 'yaml'. load.ts inchangé.
- Équivalence prouvée sur 12 entrées (valide, alias bénin, bombe, doublon, liste à la racine, vide, deux documents, balise inconnue, fusion `<<`, indentation cassée, une vraie fiche candidat, data/couverture-themes.yaml) : diagnostics identiques champ par champ, données identiques sans diagnostic.
- Import : chaque fiche existante passe par la lecture plafonnée, y compris celle dont l'action serait « inchangé » (pitfall 6). Le vrai corpus donne toujours `59 inchangé(s), 0 absent(s) en amont, 0 conflit(s)` en `--dry-run`.
- `ajouterStatutYaml` prend son Document de `lireDocumentPlafonne` ; sur les 59 vraies fiches (lues, jamais écrites), telles quelles et après `definirChamps` (relu, relecteur, date_relecture sur le dernier statut, en mémoire), la sortie commence par le texte d'entrée et n'ajoute que le bloc du statut.
- `archive --wayback-missing` : refus réunis puis `Sortie(1, …)` qui finit par « rien n'a été soumis » ; fetch appelé 0 fois.
- `lireCouverture(texte, fichier = 'data/couverture-themes.yaml')` : ne lève jamais, positions et code ; le vrai tableau donne `problemes: []`.
- Page Méthode : construite en production avant (base 0ad1728) et après la migration, `cmp` identique ; tout le dist identique sauf l'horodatage de `version.json`. check-dist sur la build d'après : 0 erreur (3 avertissements existants : PUBLICATION_VIDE, HEBERGEUR_PREVU x2).

## Ce que produit chaque entrée hostile

Mesuré sur des racines temporaires (jamais sur le dépôt) :

| Entrée | Outil | Avant 10-01 | Après 10-01 |
|--------|-------|-------------|-------------|
| Alias bénin (`nom: &n Kazib` / `nom_tri: *n`) dans une fiche | import | accepté en silence, code 0, « 59 inchangé(s) » | code 1, `conflit : anasse-kazib — fichier existant illisible (src/content/candidats/anasse-kazib.yaml:5:10 YAML_ALIAS_INTERDIT les alias YAML (*nom) sont interdits : répéter la valeur)`, « rien n'a été écrit » |
| Clé en double (ligne 24) dans une fiche | import | code 1, message anglais sans fichier ni code (`Map keys must be unique at line 24, column 1:`) | code 1, `src/content/candidats/anasse-kazib.yaml:24:1 YAML_DUPLICATE_KEY clé en double dans le même objet (Map keys must be unique)` |
| Bombe d'alias (6 niveaux, 9 alias par niveau) dans une fiche | import | `Excessive alias count indicates a resource exhaustion attack` | code 1, trois positions `…anasse-kazib.yaml:2:8`, `2:11`, `2:14 YAML_ALIAS_INTERDIT …` puis ` (+42 autre(s))` |
| Alias dans `data/import/correspondances.yaml` | import | accepté, 59 fiches créées | code 1, stderr `import : data/import/correspondances.yaml refusé : data/import/correspondances.yaml:7:14 YAML_ALIAS_INTERDIT …`, rien d'écrit |
| Clé en double dans une fiche hors amont | import | code 0, `illisible … : hors-amont` sans raison | code 0, `illisible (YAML refusé, ignoré pour le rapport « absent en amont ») : hors-amont (src/content/candidats/hors-amont.yaml:2:1 YAML_DUPLICATE_KEY clé en double …)` |
| Alias dans une source (`copie: *u`, ligne 3) | archive --wayback-missing | `AVERTISSEMENT : … illisible : ignorée`, source écartée en silence | code 1, `1 source(s) au YAML refusé : src/content/sources/alias-piege.yaml:3:8 YAML_ALIAS_INTERDIT les alias YAML (*nom) sont interdits : répéter la valeur. Corriger le fichier puis relancer ; rien n'a été soumis.` |
| Alias dans le tableau de couverture | lireCouverture | `YAML illisible : <message anglais>` | `YAML illisible : data/couverture-themes.yaml:2:8 YAML_ALIAS_INTERDIT les alias YAML (*nom) sont interdits : répéter la valeur` |

## Cas rouges avant la migration (commit 55ea155, avant a7e56b6)

- import, alias bénin dans une fiche : code 0 et « 59 inchangé(s) » (rouge attendu, IMP-01)
- import, clé en double : message anglais sans fichier ni code
- import, bombe d'alias : message anglais, aucune position
- import, alias dans la table de correspondances : code 0, fiches créées dans la racine temporaire
- import, fiche hors amont en double : ligne « illisible » sans raison
- `ajouterStatutYaml` : alias accepté (pas de YamlRefuse) ; les deux preuves de préfixe sur les vraies fiches étaient déjà vertes (caractérisation : le comportement d'ajout ne devait pas changer)
- archive `--wayback-missing` avec une source à alias : « Missing expected rejection » (source écartée en silence)
- `lireCouverture` : 4 cas rouges (alias, doublon, bombe, YAML cassé sans position) ; racine non objet et vrai tableau déjà verts

## Liste blanche (tests/repo/yaml-plafonne.test.ts)

1. `src/lib/content-core/yaml-plafonne.ts` : l'analyseur plafonné léger, gardé équivalent à load.ts par test
2. `src/lib/content-core/load.ts` : l'analyseur de content-core (PARSE_OPTIONS, parseYaml)
3. `src/lib/content-core/migrate.ts` : content-core, mêmes PARSE_OPTIONS, réécriture par positions
4. `scripts/lib/relecture/editer.ts` : éditeur par positions de nœuds, PARSE_OPTIONS, refuse tout alias
5. `src/lib/site-config.ts` : lecteur de configuration avec plafond propre
6. `src/lib/hebergeur-config.ts` : idem
7. `src/lib/publication-config.ts` : idem
8. `src/lib/dataset-datagouv.ts` : idem

Graphe d'import épinglé de `scripts/lib/couverture.ts` : avant 10-01 `couverture.ts`, `rules/config.ts`, `rules/text/normalize.ts` ; après, la même liste plus `src/lib/content-core/yaml-plafonne.ts`. Ni load.ts, ni ajv.ts, ni rules/index.ts, ni rules/corpus.ts. Vérification complémentaire : le balayage appliqué aux fichiers de 55ea155 signale exactement les quatre fichiers migrés (et site-config.ts, sur liste blanche) et ignore fetch-safe.ts, archive.ts et diagnostics.ts.

## Task Commits

1. **Task 1 : analyseur plafonné léger et équivalence** : `0ad1728` (feat ; test vu rouge avant, module absent)
2. **Task 2 : migration des six lectures** : `55ea155` (test, cas rouges), `a7e56b6` (feat)
3. **Task 3 : test de dépôt et graphe d'import** : `7781404` (test ; 29 cas vus rouges avec des fonctions vides, puis verts)

## Deviations from Plan

### Ajustements

**1. [Rule 3 - Bloquant évité] Builds dans des dossiers temporaires, pas dans dist/**
- Le plan demande de copier `dist/methode/index.html` ; un serveur de dev tourne pour la revue de design. Les deux builds de production ont été faites avec `astro build --outDir /tmp/rtp-10-01/{avant,apres}` (comme le harnais de test), puis comparées par `cmp`. Même preuve, aucun `dist/` touché.

**2. [Choix de forme] Entrées de `problemes` de lireCouverture**
- « une entrée par diagnostic, trois au plus, puis (+N autre(s)) » : le compte restant est accolé à la troisième entrée plutôt que de former une quatrième entrée sans position.

**3. [Rule 2] `ajouterStatutYaml` refuse aussi les avertissements YAML (balise inconnue)**
- Effet du passage par l'analyse plafonnée (load.ts traite déjà les avertissements comme des erreurs) ; aucun fichier réel n'en contient.

**4. Commit 09.1 intercalé**
- `36c8a93` (docs 09.1 : ROADMAP, REQUIREMENTS, CONTEXT) est arrivé sur main entre la build « avant » et la migration ; il ne touche ni `src/` ni `scripts/` : la comparaison de la page Méthode reste sur la même base de code.

Aucun test existant n'a dû être modifié : les assertions WR-08 (`/conflit : .* — fichier existant illisible/`, `/illisible .*hors-amont/`) passent telles quelles. Aucun fichier hors `files_modified` (plus SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Vérifications

- `TZ=Europe/Paris fnm exec --using=24 npm test` : 2624 tests, 2615 réussis, 0 échec, 9 ignorés (existants)
- `fnm exec --using=24 npm run check` : 0 erreur, 0 avertissement
- `fnm exec --using=24 node scripts/validate.ts --mode production` : 391 fichiers, 0 erreur (25 avertissements existants)
- Nouveaux tests : tests/content-core/yaml-plafonne.test.ts 21 (8 unitaires, 13 d'équivalence), tests/repo/yaml-plafonne.test.ts 29, cas IMP-01 ajoutés : import-cli 5, datagouv 3, wayback 1, classement 6
- `--test-name-pattern="méthode|methode" tests/dist/site.test.ts` : 14/14
- `git status --porcelain src/content data archives` : vide ; load.ts et scripts/lib/relecture/ non modifiés

## Known Stubs

Aucun.

## Notes

- Push non fait (décision de l'orchestrateur) : regroupé avec 10-02 ; CI et approbation de déploiement à vérifier après ce push.
- `passeWayback` relit les sources après soumission par la même fonction : si un fichier devenait illisible entre-temps (cas non observé, l'outil n'écrit que des sources validées), le message dirait « rien n'a été soumis » à tort. Laissé tel quel, noté ici.

## Self-Check: PASSED
