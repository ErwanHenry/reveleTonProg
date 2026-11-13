---
phase: 10-import-de-d-cembre
fixed_at: 2026-11-13T16:30:00Z
review_path: .planning/phases/10-import-de-d-cembre/10-REVIEW.md
iteration: 1
findings_in_scope: 23
fixed: 19
skipped: 4
status: partial
---

# Phase 10 : rapport des corrections de la revue de code

**Corrigé le :** 2026-11-13
**Revue source :** `.planning/phases/10-import-de-d-cembre/10-REVIEW.md`
**Itération :** 1

**Résumé :**
- Constats dans le périmètre : 23 (1 critique, 12 avertissements, 10 informations)
- Corrigés : 19 (le critique, les 12 avertissements, 6 informations : IN-01, IN-02, IN-05, IN-06, IN-07, IN-08)
- Laissés de côté avec raison : 4 (IN-03, IN-04, IN-09, IN-10)
- Un commit atomique par constat, dans l'ordre demandé (WR-11, CR-01, WR-01, WR-02, WR-05 à WR-08, puis WR-03, WR-04, WR-09, WR-10, WR-12), puis les informations. IN-06 est couvert par le commit de WR-02 (paragraphe du RUNBOOK).

## Tableau des constats

| Constat | Statut | Commit | Cas rouge observé avant la correction |
|---|---|---|---|
| WR-11 | corrigé | `4d59584` | Nouveau test `tests/repo/import-personnes-fictives.test.ts` : 11 occurrences signalées (`melenchon` x8 dans `import-cli.test.ts`, `brun` x1 dans `import-cli.test.ts`, `brun` x2 dans `datagouv.test.ts`) |
| CR-01 | corrigé | `fe6bf7c` | 6 tests rouges : clé de `liens` hostile acceptée, avertissements avec caractères de contrôle, faux titre `## Conflits`, lignes en trop, balise, lien, image, mention et barre verticale hors span de code. Le test « ligne légitime inchangée » était vert avant et l'est resté (non-régression) |
| WR-01 | corrigé, à confirmer par un humain (logique) | `d7c56b3` | 4 rouges : `mergeFiche` ajoutait une entrée `2026-03` dans le mois d'un statut du 15 ; même cas avec le 1er du mois ; la cohérence disait « 0 écart » là où la règle d'équité retient l'autre statut ; l'import CLI rajoutait l'entrée à chaque passage |
| WR-02 | corrigé | `03d2778` | `E5 date` en erreur (`{ e: ['date'] }`), `--check` code 1 sur une date qui recule ; test de documentation rouge (RUNBOOK sans issue) |
| WR-05 | corrigé | `7411017` | Test de documentation rouge : le worktree venait après les décisions, pas de `git diff --stat` |
| WR-06 | corrigé | `c98eff2` | Le test rejoue la commande du RUNBOOK sur un dépôt jetable : l'ancienne forme affichait `1: … < -: ------- main avance` et trois commits `>` non appariés |
| WR-07 | corrigé | `da07f7d` | Test de documentation rouge (condition 1 sans `gh pr list --head relecture/sante --state merged`) |
| WR-08 | corrigé | `ecd47a7` | Test de documentation rouge (aucun paragraphe « Date au mois seulement ») |
| WR-03 | corrigé | `3ed21a7` | 4 rouges : thème publié hors liste blanche absent, ligne à décider non comptée, fichiers refusés non signalés, libellé « statuts importés » |
| WR-04 | corrigé | `0df2c24` | Rouge : `instantanePlusRecent` n'existait pas ; les tests prenaient l'instantané « le plus récent » par nom de fichier (suffixe de hachage) |
| WR-09 | corrigé | `4446f60` | 9 rouges : `Parser`, `Composer`, `Lexer`, `parseCST`, `@astrojs/internal-helpers/yaml`, `js-yaml`, `require` d'une enveloppe, `req('yaml')`, `createRequire(import.meta.url)('yaml')` non détectés |
| WR-10 | corrigé | `610d355` | 4 rouges : jeu vide accepté (code 0), jeu tronqué à 10 lignes accepté, aucune ligne « garde de volume », `comparerInstantane` sur 0 ligne donnait 0 écart ; plus le test de documentation |
| WR-12 | corrigé (test seul) | `061c4a4` | Pas de code à corriger. Non-vacuité prouvée par mutation : `severity: 'error'` dans `statut-recent.ts` rend le nouveau cas rouge ; mutation annulée par `git checkout` |
| IN-07 | corrigé | `0c2685e` | Test de documentation rouge (redirection sans `-s`) |
| IN-08 | corrigé (en partie) | `1dc415e` | Test rouge : « 59 sur 51 » dans le critère R8, « trois avertissements » à l'étape 8 |
| IN-02 | corrigé | `dc358a7` | Test CLI rouge : la fiche illisible n'apparaissait pas dans le rapport Markdown |
| IN-01 | corrigé (commentaire) | `9556e24` | Test rouge sur l'épinglage du commentaire ; la partie comportementale du test (CRLF rendu en LF) était déjà vraie |
| IN-05 | corrigé | `158f1c9` | Test rouge : une balise inconnue dans `data/dataset-datagouv.yaml` était acceptée |
| IN-06 | corrigé (documentation) | `03d2778` | Couvert par le paragraphe WR-02 du RUNBOOK (mettre à jour `ids_externes.2027etmoi` dans le commit de la table) et son test de documentation |
| IN-03 | laissé de côté | | voir plus bas |
| IN-04 | laissé de côté | | voir plus bas |
| IN-09 | laissé de côté | | voir plus bas |
| IN-10 | laissé de côté | | voir plus bas |

## Corrections

### WR-11 : personnes réelles dans les tests

**Fichiers modifiés :** `tests/import/import-cli.test.ts`, `tests/import/datagouv.test.ts`, `tests/repo/import-personnes-fictives.test.ts` (nouveau)
**Commit :** `4d59584`

**Ce que la recherche a trouvé** (diff de la phase 10, `git log 167df41..HEAD`, plus les tests plus anciens du même fichier) :
- `tests/import/import-cli.test.ts`, commit `493b483` (phase 10) : deux tests Markdown faisaient passer `melenchon` à `renonce/retrait` et affirmaient la ligne `jean-luc-melenchon : statut : declare … -> renonce/retrait`, puis une « régression de date » pour la même personne.
- Même fichier, tests plus anciens (`75f9278`, hors phase 10 mais cités par la consigne, lignes 172 à 212) : même changement de statut et même régression de date pour `melenchon` ; test « ligne retirée en amont » qui retirait `brun` du jeu et affirmait `absent en amont : philippe-brun`.
- Même fichier : `deuxInconnus` et le test « id amont absent » recopiaient la ligne réelle n°0 (source, propositions, détail) sous un identifiant inventé ; le test `--check` « un statut diffère » changeait le statut d'une fiche réelle, choisie à l'exécution, en `pressenti`.
- `tests/import/datagouv.test.ts` (hors phase 10) : les tests de fusion prenaient la fiche réelle `brun` comme base de statuts inventés (déclaration, retrait, dates).
- Rien d'autre : aucun texte de la phase dans `docs/`, les messages de commit, les bilans ou les fixtures n'attribue un fait inventé à une personne réelle. Le bilan 10-01 cite le fichier d'une personne réelle pour un essai d'alias YAML (fait technique, aucun fait sur la personne).

**Correction :** une personne fictive `essai-fictif` (`Essai Fictif`, adresses `exemple.test`), ajoutée à la racine temporaire (ligne amont complète, aucun champ recopié, ligne de table) ou, pour `--check`, à une copie du dépôt (nouvel instantané au bon SHA-256, méta, pointeur, ligne de table, fiche). Base fictive dans `datagouv.test.ts`. Un test de dépôt refuse désormais les trois formes par lesquelles un test choisit une ligne réelle pour la modifier (`ajouterMotif`, rappel de `muter`, base de `mergeFiche`), avec auto-contrôle.

**Laissés tels quels, parce qu'ils n'affirment rien de faux :** la vérification du mapping de la ligne réelle `villepin`, l'essai d'alias sur le nom de la table (`nom: &m …`), l'absence de `jean-luc-melenchon.yaml` dans une fixture, la préservation des octets des 59 fiches réelles.

### CR-01 : texte amont dans le corps de la pull request

**Fichiers modifiés :** `scripts/lib/datagouv.ts`, `scripts/lib/rapport-import.ts`, `tests/import/rapport.test.ts`, `tests/import/datagouv.test.ts`
**Commit :** `fe6bf7c`

**Correction :** un seul point d'échappement dans `rapport-import.ts`. Une valeur qui passe une liste blanche stricte est imprimée telle quelle, si bien qu'une ligne légitime ne change pas d'un octet. Ces listes : jeton `[A-Za-z0-9/_.-]` pour les identifiants, codes et dates ; lettres, chiffres, espaces, apostrophes, point, virgule, tirets et parenthèses pour un nom ; URL `https:` sans crochet, parenthèse, chevron, `@`, `!`, accent grave ni espace. Toute autre valeur part dans un span de code dont la clôture est plus longue que toute suite d'accents graves du texte, avec contrôles, séparateurs de ligne et caractères invisibles ou de direction rendus en espaces ; une URL non sûre y est montrée sous sa forme `URL.href`, sans lien. À la lecture, `checkUpstream` refuse une clé de `liens` hors de `[A-Za-z0-9][A-Za-z0-9_.-]{0,39}`, et le message cite la clé avec les contrôles remplacés par `?`. Les avertissements de clés inconnues sont nettoyés de même.

**Écart avec la proposition de la revue :** la revue proposait des spans de code pour tout texte amont et `<URL>` pour toute adresse. Cela changeait toutes les lignes légitimes. La consigne demandait qu'une ligne légitime reste inchangée, d'où la liste blanche. Pour les clés de `liens`, la règle tolère majuscules et `.`, ce que `^[a-z][a-z0-9_-]{0,39}$` refusait. Ainsi une clé nouvelle et ordinaire comme `Bluesky` n'arrête pas l'import réel du 10 décembre, alors qu'une clé avec saut de ligne, espace ou balise l'arrête.

### WR-01 : une seule définition du statut le plus récent

**Fichiers modifiés :** `src/lib/content-core/rules/equite.ts`, `scripts/lib/datagouv.ts`, `scripts/lib/instantane.ts`, tests
**Commit :** `d7c56b3` (logique : à confirmer par un humain)

**Correction :** `comparerDatesStatut` (nouveau, dans `equite.ts`) est la seule définition. Son comportement est celui qu'avait déjà la règle d'équité (ordre des chaînes ISO : `AAAA-MM` vient avant tous les jours du mois, premier compris), donc rien ne change pour la règle ni pour les données existantes. `datagouv.ts` perd sa copie (`statutLePlusRecent`, `dateComparable`) ; `instantane.ts` et `mergeFiche` utilisent celle d'`equite.ts`. `mergeFiche` n'ajoute une entrée que si elle devient la plus récente. Le seul cas qui n'est ni un ajout ni une régression est une date amont au mois seulement dans le mois du dernier statut daté au jour. Il devient le conflit nommé « date amont … au mois seulement, dans le mois du dernier statut … », à arbitrer (RUNBOOK, WR-08). Deux passages sur la même entrée ne rajoutent plus rien (testé en unité et par la CLI).

**Preuve de non-changement de la règle d'équité :** tous les tests `tests/rules/*` et `tests/corpus/*` sont verts (468 tests) ; `validate --mode production` et `--mode preview` sur le vrai corpus donnent une sortie identique, octet pour octet, à celle d'avant (0 erreur, les mêmes 25 avertissements).

**Écart avec la proposition de la revue :** la revue proposait `dateComparable` (le mois vaut le 1er, égalité tranchée par l'ordre de la liste). J'ai gardé l'ordre de la règle d'équité, puisque la consigne interdisait de changer son comportement. Les deux ne diffèrent que pour `AAAA-MM` contre `AAAA-MM-01`.

### WR-02 : date amont qui recule pour un statut inchangé

**Fichiers modifiés :** `scripts/lib/instantane.ts`, `docs/RUNBOOK.md`, tests
**Commit :** `03d2778`

**Correction :** j'ai choisi l'option qui suit D-04 telle que résolue (« la dérive de source ou de date pour un statut inchangé est une information ») : E5 devient une information I1, avec le message « même statut, date amont antérieure au fichier, source non appliquée ». L'outil (« Dérives de source ») et `--check` disent la même chose. Le RUNBOOK dit ce qui reste une information, et donne l'issue des deux écarts qui peuvent encore rendre la pull request rouge après un import sans conflit : pointeur pas à jour, ou clé amont renommée (ce qui couvre aussi IN-06).

### WR-05, WR-06, WR-07, WR-08 : le RUNBOOK, suivi à la lettre

**Commits :** `7411017`, `c98eff2`, `da07f7d`, `ecd47a7`

- WR-05 : le worktree d'import (étape 2) vient avant les décisions d'Erwan (étape 3), qui sont écrites dans `../reveleTonProg-import/data/import/correspondances.yaml`. `git diff --stat` vérifie l'édition avant le commit de la table. Sans personne à décider, il n'y a pas de commit de table, et la recréation ne fait alors pas de `cherry-pick` de table.
- WR-06 : `git range-diff origin/main import/statuts-2026-12-ancienne import/statuts-2026-12`, plus le compte `git log --oneline origin/main..import/statuts-2026-12 | wc -l`. Le test de documentation rejoue la commande extraite du RUNBOOK sur un dépôt jetable (main qui avance, trois commits repris par `cherry-pick`, identité Git locale fixée).
- WR-07 : condition 1 vérifiée par `gh pr list --head relecture/sante --state merged --json number --jq length` (même commande que le plan 10-05) ; `--is-ancestor` ne reste qu'une information. Le test vérifie la concordance avec `10-05-PLAN.md`.
- WR-08 : paragraphe « Date au mois seulement ». Pour le refus de `marquer`, Erwan complète lui-même la seule entrée ajoutée par cet import d'après la source primaire, ou accepte l'avertissement par écrit, ou on reporte. Pour le nouveau conflit de WR-01, on attend la correction amont, ou Erwan ajoute lui-même l'entrée avec la date complète. Aucun agent ne complète une date.
- Les plans 10-05 et 10-06 ne citent aucune des commandes corrigées : ils n'ont pas été modifiés.

### WR-03 : conséquences sur les thèmes publiés

**Fichiers modifiés :** `scripts/lib/rapport-import.ts`, `scripts/import-datagouv.ts`, tests
**Commit :** `3ed21a7`

Tout thème publié est compté, comme dans `regleEquite`, avec la mention « (hors liste blanche) » s'il n'est pas ouvert. Une ligne « à décider, entreraient dans le périmètre une fois la table écrite et le statut relu » apparaît par thème. L'en-tête porte « fichiers refusés par le chargeur » (fichiers en erreur absents des entrées de `loadAll`). Le libellé devient « après relecture de tous les statuts en attente (importés ou déjà en brouillon) ».

### WR-04 : ordre des instantanés

**Commit :** `0df2c24`. `instantanePlusRecent(racine)` dans `scripts/lib/instantane-depot.ts` applique l'ordre du contrôle E6 (mise_a_jour, fetched_at, puis chemin). `newestSnapshot` (`import-cli.test.ts`, `fiches.test.ts`) et l'instantané de `datagouv.test.ts` l'utilisent. Un test le prouve sur deux instantanés de même `mise_a_jour` dont l'ordre des noms est l'inverse de celui des `fetched_at`.

### WR-09 : formes de lecture YAML directe

**Commit :** `4446f60`. Le test détecte aussi `Parser`, `Composer`, `Lexer`, `parseCST`, tout paquet `…/yaml` ou contenant `yaml` (sauf `yaml-lint`), tout appel avec un spécificateur YAML littéral, toute mention de `createRequire`. Il balaie les extensions `.mts`, `.cts`, `.cjs`, `.tsx`, `.jsx` et `astro.config.*`. Les exports de valeur des huit fichiers de la liste blanche sont épinglés (une enveloppe nouvelle exige une relecture). Chaque forme a son auto-contrôle synthétique ; aucun fichier du dépôt n'est signalé.

### WR-10 : jeu amont vide ou tronqué

**Commit :** `610d355`. L'import réel refuse toujours un jeu vide. Il refuse aussi un jeu dont plus de 20 % des identifiants de l'instantané pointé ont disparu, sauf `--accepter-absents` (décision d'Erwan, documentée au RUNBOOK, avec la règle « un agent n'ajoute jamais cette option de lui-même »). Dans ces deux cas, rien n'est écrit. La répétition à blanc n'est jamais refusée, mais son en-tête porte la ligne « garde de volume ». `comparerInstantane` compte un instantané pointé sans ligne comme une erreur, et le test du dépôt réel affirme `rows.length > 0` et une fiche par ligne.

### WR-12 : « ne bloque jamais » sur un état réel

**Commit :** `061c4a4`. Nouveau cas, en plus de l'ancien (qui reste inchangé). Le thème est publié, et Luc (retrait relu) reçoit l'entrée `declare` que l'import ajouterait (vérifié par `mergeFiche`). `validate` donne alors le code 0 dans les deux modes, avec l'avertissement, et un retrait d'urgence passe. `marquer statut` refuse avec `EQUITE_CANDIDAT_MANQUANT` et restaure les octets, puis réussit une fois les cases posées ; l'avertissement disparaît. Dans cet état, une nouvelle publication du thème est refusée par la garde de `publier` (Luc revient dans le périmètre d'aperçu), pas par l'avertissement : le test le dit en commentaire, et la propriété « publier n'est pas bloqué par l'avertissement » reste couverte par l'ancien cas.

### Informations corrigées

- IN-07 (`0c2685e`) : `npm run -s` à l'étape 1 ; le test exige `-s` pour toute commande d'import redirigée.
- IN-08 (`1dc415e`, en partie) : critère R8 de `docs/AUDIT-TEST-CROISE.md` sans « 59 sur 51 » (le journal daté de l'audit garde ses comptes historiques). L'étape 8 du RUNBOOK compare au nombre d'avertissements de `check-dist` relevé sur `main` avant l'import, au lieu de « trois ». Non fait : `tests/dist/cas/methode.cas.ts:235` (liste des comptes interdits en dur), parce qu'un autre relecteur lit en ce moment les fichiers de la phase 9.1 autour de la page Méthode et de `check-dist`. À faire dans la pull request d'import, avec les nouveaux comptes.
- IN-02 (`dc358a7`) : l'en-tête du rapport Markdown nomme les fiches au YAML refusé, avec leur raison.
- IN-01 (`9556e24`) : le commentaire d'`ajouterStatutYaml` décrit la re-sérialisation complète. La garde `sortie.startsWith(texte)` proposée par la revue n'a pas été ajoutée : un test existant (WR-07 de l'import initial) prouve qu'une fiche légitime avec des commentaires de fin de ligne ou un `statuts` qui n'est pas en dernier n'est pas un préfixe exact (espaces normalisées, entrée insérée au milieu). La garde l'aurait refusée. Le contrôle `git diff --numstat` du plan 10-05 (aucune ligne supprimée sous `src/content/candidats`) reste la protection de l'import réel.
- IN-05 (`158f1c9`) : `src/lib/dataset-datagouv.ts` refuse aussi `doc.warnings` (balise inconnue).
- IN-06 (`03d2778`) : une phrase du RUNBOOK, dans le paragraphe de WR-02.

## Constats laissés de côté

### IN-03 : titre « répétition à blanc » en import réel avec `--format markdown`

**Fichier :** `scripts/import-datagouv.ts:402-404`, `scripts/lib/rapport-import.ts:196`
**Raison :** le RUNBOOK calcule le corps de la pull request depuis le commit parent avec `--dry-run` (le bon chemin), et un test existant épingle le comportement actuel de `--format markdown` sans `--dry-run`. Changer le titre ou refuser cette combinaison est un choix d'interface à faire hors du gel, sans effet sur l'import de décembre.
**Constat d'origine :** en import réel, le rapport Markdown est calculé sur le corpus déjà écrit et garde le titre « répétition à blanc ».

### IN-04 : balises explicites et plafond de taille

**Fichier :** `src/lib/content-core/yaml-plafonne.ts:14-15`, `src/lib/content-core/load.ts:20-22`
**Raison :** la correction touche `load.ts`, que la consigne interdit de modifier, et les deux analyseurs doivent rester équivalents (test d'équivalence). La traiter d'un seul côté créerait l'écart que ce test interdit.
**Constat d'origine :** `!!binary`, `!!timestamp`, `!!set` acceptés ; aucun plafond d'octets avant `parseDocument`.

### IN-09 : `process.exit` juste après `console.log`

**Fichier :** `scripts/import-datagouv.ts:58-65`, `:406-420`
**Raison :** aucun cas rouge reproductible de façon déterministe (troncature d'un tube sous macOS). Le rapport Markdown, seul texte capturé dans un fichier par le RUNBOOK, passe déjà par `imprimer()`, qui attend la fin de l'écriture. À reprendre hors du gel, en passant à `process.exitCode`.
**Constat d'origine :** une longue liste d'écarts redirigée vers un tube peut être tronquée.

### IN-10 : la cohérence se tait dès qu'un fichier candidat est invalide

**Fichier :** `src/lib/content-core/rules/statut-recent.ts:29`
**Raison :** le comportement est voulu et cohérent avec `regleEquite`, et l'erreur de schéma fait déjà échouer la CI. La seule action proposée est une note au catalogue (`src/lib/content-core/rules/config.ts`), qui demanderait de mettre à jour aussi les tests qui épinglent ce libellé. Elle est sans effet sur l'import.
**Constat d'origine :** l'avertissement n'est fiable qu'à zéro erreur de schéma.

## Tests existants modifiés, et pourquoi leur propriété tient

| Test | Changement | Propriété toujours protégée |
|---|---|---|
| `tests/import/import-cli.test.ts` : « statut qui change », « date qui recule », « ligne retirée en amont », les deux tests Markdown, `--check` « un statut diffère » (WR-11) | La mutation porte sur `essai-fictif` au lieu d'une personne réelle | Oui : mêmes assertions (ajout en fin de `statuts[]`, ancien statut intact octet pour octet, conflit sans écriture, fiche et identifiant gardés, transition sourcée, écart `fichier=pressenti amont=declare`). Le test Markdown est même plus strict (date et adresse exactes) |
| `tests/import/import-cli.test.ts` : `deuxInconnus`, « id amont absent » (WR-11) | Ligne fictive complète au lieu d'une copie de la ligne réelle n°0 | Oui : mêmes identifiants, mêmes assertions |
| `tests/import/datagouv.test.ts` : bases de `mergeFiche` (WR-11) | Fiche fictive aux mêmes champs (renonce, élimination à la primaire, 2026-09-16) | Oui : mêmes cas, mêmes résultats attendus |
| `tests/import/datagouv.test.ts` : « une date partielle amont ne crée pas de régression dans le même mois » (WR-01) | Attendait `statut_ajoute`, attend maintenant un conflit nommé « au mois seulement » | La propriété nommée (« pas une régression de date ») tient : le test affirme l'absence de « régression de date ». Le résultat `statut_ajoute` était le défaut WR-01 (entrée invisible rajoutée à chaque import) |
| `tests/import/datagouv.test.ts` : « une date partielle compte comme le premier du mois » (WR-01) | `dateComparable` supprimé, l'ordre unique `comparerDatesStatut` est vérifié à sa place | Oui : la fusion attendue (`statut_ajoute` pour un `2026-07-01` après un `2026-07`) est inchangée |
| `tests/corpus/instantane-coherence.test.ts` : « E5 date » (WR-02) | Erreur `date` devenue information `source` au message explicite | Changement voulu par D-04 tel que résolu ; le cas reste détecté et affiché |
| `tests/corpus/instantane-coherence.test.ts` : « le plus récent par nom = par date » (WR-04) | Remplacé par « le pointeur est le plus récent par (mise_a_jour, fetched_at) » plus `instantanePlusRecent` | Oui et mieux : l'ancienne assertion échouait au hasard avec deux instantanés de même `mise_a_jour` ; le pointeur reste contrôlé |
| `tests/import/rapport.test.ts` : « cellules … après relecture de tous les statuts importés » (WR-03) | Nouveau libellé | Oui : mêmes nombres (2 maintenant, 3 après) |
| `tests/import/rapport.test.ts` : « thème publié non ouvert, ou ouvert mais en brouillon, n'est pas listé » (WR-03) | Le cas brouillon reste ; le cas publié non ouvert est maintenant listé « (hors liste blanche) » | Changement voulu : le rapport suit la règle d'équité, qui contrôle tout thème publié |
| `tests/import/import-cli.test.ts` `newestSnapshot`, `tests/corpus/fiches.test.ts` `newestSnapshot`, `tests/import/datagouv.test.ts` instantané (WR-04) | Par `instantanePlusRecent` au lieu du tri par nom | Oui : même fichier aujourd'hui (un seul instantané), déterministe demain |
| `tests/repo/yaml-plafonne.test.ts` (WR-09) | Filtre des fichiers et détecteur élargis | Renforcé : plus de fichiers et de formes vus ; aucune forme ancienne retirée |
| `tests/rules/statut-plus-recent.test.ts`, `tests/repo/docs.test.ts`, `tests/corpus/dataset-datagouv.test.ts` | Ajouts seulement | Oui |

## Vérifications (Node 24, avant le push)

- `npm test` : 2871 tests, 2862 réussis, 0 échec, 9 ignorés (avant : 2814, 2805, 0, 9).
- `npm run check` : 0 erreur, 0 avertissement, 0 indication.
- `RTP_MODE=production npm run build` puis `check-dist` : 0 erreur, 3 avertissements (les mêmes qu'avant : `PUBLICATION_VIDE`, `HEBERGEUR_PREVU` x2).
- `validate --mode production` et `--mode preview` sur le vrai corpus : sortie identique à celle d'avant les corrections (391 fichiers, 0 erreur, 25 avertissements).
- `npm run import:datagouv -- --dry-run --format markdown --file <instantané>` sur le vrai dépôt (lecture seule) : 59 inchangées, « fichiers refusés par le chargeur : aucun », « aucun thème publié ».
- Aucun fichier de `src/content/**`, `archives/**`, `data/**`, `config/**`, `src/lib/content-core/load.ts`, `scripts/lib/relecture/**` ni des fichiers de la phase 9.1 n'a été modifié. Aucun import réel contre le dépôt.

## Ce qui reste pour Erwan, ou pour après le gel

- WR-01 est un changement de logique, à confirmer : une date amont au mois seulement, dans le mois du dernier statut, arrête maintenant l'import (conflit nommé) au lieu d'ajouter une entrée invisible. Si le cas se présente le 10 décembre, la conduite est au RUNBOOK (« Date au mois seulement ») et la décision est la sienne.
- `--accepter-absents` (WR-10) n'est à utiliser que sur sa décision écrite.
- `10-05-PLAN.md`, vérification automatique de la tâche du worktree : `git rev-list --count origin/main..HEAD = 2` suppose un commit de table. Le RUNBOOK (WR-05) permet désormais de s'en passer quand aucune personne n'est à décider. Avec deux personnes nouvelles déjà dans le jeu en ligne, le cas ne devrait pas se produire, mais le plan n'a pas été modifié (consigne : seulement pour citer une commande corrigée).
- IN-08, reste : `tests/dist/cas/methode.cas.ts:235`, à compléter dans la pull request d'import avec les nouveaux comptes.
- IN-03, IN-04, IN-09, IN-10 : après le gel.
- Ce rapport n'est pas commité (l'orchestrateur s'en charge).

---

_Corrigé le : 2026-11-13_
_Correcteur : Claude (gsd-code-fixer)_
_Itération : 1_
