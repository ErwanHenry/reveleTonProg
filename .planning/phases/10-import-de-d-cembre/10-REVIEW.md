---
phase: 10-import-de-d-cembre
reviewed: 2026-11-13T11:40:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/lib/content-core/yaml-plafonne.ts
  - tests/content-core/yaml-plafonne.test.ts
  - tests/repo/yaml-plafonne.test.ts
  - scripts/import-datagouv.ts
  - scripts/archive-source.ts
  - scripts/lib/datagouv.ts
  - scripts/lib/couverture.ts
  - scripts/lib/instantane.ts
  - scripts/lib/instantane-depot.ts
  - tests/corpus/instantane-coherence.test.ts
  - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon/
  - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon-preview/
  - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-relu/
  - tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-relu-avec-case/
  - tests/relecture/marquer-import.test.ts
  - scripts/lib/rapport-import.ts
  - tests/import/rapport.test.ts
  - tests/import/import-cli.test.ts
  - src/lib/content-core/rules/statut-recent.ts
  - tests/rules/statut-plus-recent.test.ts
  - docs/RUNBOOK.md
  - tests/repo/docs.test.ts
findings:
  critical: 1
  warning: 12
  info: 10
  total: 23
status: issues_found
---

# Phase 10 : revue de code (import de décembre, plans 10-01 à 10-04)

**Revu le :** 2026-11-13
**Profondeur :** deep (chaînes d'appel suivies dans `equite.ts`, `marquer.ts`, `dataset-datagouv.ts`, `load.ts`, `editer.ts`, schéma `candidat`)
**Fichiers revus :** 22 (périmètre : commits `(10-0x)` de `167df41..HEAD`)
**Statut :** issues_found

## Résumé

L'analyseur plafonné est une copie fidèle de `parseYaml` (mêmes options, mêmes messages, mêmes positions) ; aucun écart d'entrée n'a été trouvé entre les deux. Le mode `--dry-run` n'écrit jamais, l'import réel s'arrête toujours sur un identifiant inconnu, et la règle `STATUT_PLUS_RECENT_NON_RELU` reste un avertissement partout (vérifié dans `marquer`, `publier`, `retirer`, le chargeur Astro et `validate`, qui ne filtrent que `severity === 'error'`).

Les défauts sérieux se trouvent aux frontières :

1. Des données amont (contenu tiers) passent sans échappement dans le rapport Markdown, qui sert de corps à la pull request. Une clé de `liens` peut même y injecter des sauts de ligne et fabriquer de fausses sections (CR-01).
2. Deux définitions de « statut le plus récent » coexistent, et l'outil et la CI ne classent pas pareil une date qui recule (WR-01, WR-02). Ces deux cas peuvent bloquer ou fausser la pull request d'import pendant la fenêtre de trois jours.
3. La section « Conséquences sur les thèmes publiés » peut sous-estimer ce que la garde d'équité exigera (WR-03).
4. Le RUNBOOK contient trois recettes qui ne marchent pas telles qu'écrites (WR-05, WR-06, WR-07).

Tests lancés (lecture seule, Node 24) : `yaml-plafonne` (deux fichiers), `instantane-coherence`, `rapport`, `statut-plus-recent` : 101 tests, 0 échec. Des sondes ad hoc sous `/tmp/rv10/` ont reproduit CR-01, WR-01, WR-08 et IN-01.

## Critical Issues

### CR-01 : injection Markdown et de lignes depuis le jeu amont dans le corps de la pull request

**Fichiers :** `scripts/lib/datagouv.ts:128-129` (clés de `liens` jamais contrôlées), `scripts/lib/rapport-import.ts:141-143` (`aDecider` imprime `r.nom`, `r.source.url` et les clés de `liens`), `:107`, `:118`, `:122`, `:131` (URLs amont brutes)

**Problème :** `checkUpstream` refuse les caractères de contrôle dans les *valeurs* (`chaine`), mais pas dans les *clés* de `liens` (`for (const [k, v] of Object.entries(brut.liens)) liens[k] = urlHttps(v, …)`). Le rapport imprime ces clés telles quelles. Reproduit avec une ligne amont inconnue (le cas exact de la répétition du 10 décembre), `liens: { "campagne\n\n## Conflits\n\naucun\n\n## Faux": "https://…" }`. Le rapport contient alors une fausse section `## Conflits` avec « aucun », puis une section `## Faux`. Le relecteur lit ce document pour décider des entrées de la table et de la fusion.

De plus, `nom` et les URLs (acceptées par `URL.canParse` avec `<`, `>`, `"`, `[`, `]`) passent sans échappement :
- `<img src=https://traceur/…>` charge une image externe à l'ouverture de la PR ;
- `[@compte](https://…)` produit un lien trompeur, et une mention `@compte` nue notifie un tiers ;
- `propre()` ne remplace que les tirets longs.

Le module affirme pourtant traiter l'amont comme une entrée non fiable.

**Correctif (petit, environ 25 lignes) :**
```ts
// datagouv.ts, checkUpstream : contrôler aussi les clés
for (const [k, v] of Object.entries(brut.liens)) {
  if (!/^[a-z][a-z0-9_-]{0,39}$/.test(k)) throw new UpstreamShapeError(`${at}.liens : clé « ${k.slice(0, 40).replace(CONTROLE, '?')} » invalide`);
  liens[k] = urlHttps(v, `${at}.liens.${k}`);
}
// rapport-import.ts : un seul point d'échappement pour tout texte amont
const texteAmont = (s: string): string => '`' + propre(s).replace(/[`\r\n]/g, ' ') + '`';
const urlAmont = (s: string): string => `<${new URL(s).href}>`; // href encode < > " espace
```
Appliquer `texteAmont` à `nom`, aux identifiants amont et aux clés de liens, et `urlAmont` à toute URL amont. Ajouter un test de `rapport.test.ts` avec la ligne hostile ci-dessus. Les clés de premier niveau et de ligne (`avertissements`, lignes 93 et 107) doivent aussi passer par le remplacement de `CONTROLE`. **À corriger avant le 10 décembre.**

## Warnings

### WR-01 : deux définitions de « plus récent » : une date partielle du même mois s'ajoute à chaque import, reste invisible et ne déclenche aucun avertissement

**Fichiers :** `scripts/lib/datagouv.ts:207-226` (`dateComparable`, `statutLePlusRecent`, `dateAvant`), `src/lib/content-core/rules/equite.ts:19-26` (comparaison de chaînes brutes), `scripts/lib/instantane.ts:25`, `src/lib/content-core/rules/statut-recent.ts:31-33`, `scripts/lib/relecture/commandes/marquer.ts:82-88`

**Problème :** le jeu amont admet `AAAA-MM` (une ligne sur 59 aujourd'hui), et le schéma n'exige une date complète que pour un statut relu. Exemple : statut relu `declare` du `2026-12-03`, puis l'amont passe à `renonce` daté `2026-12`. Le comportement observé est le suivant :
- `dateAvant` compare au mois, donc ce n'est pas un recul : `mergeFiche` ajoute l'entrée ;
- `statutLePlusRecent` de datagouv voit `2026-12-01 < 2026-12-03` : l'ancien statut reste « le plus récent » ;
- au passage suivant, `mergeFiche` ajoute **une seconde fois** la même entrée (reproduit : 2 statuts, puis 3) ;
- `equite.statutLePlusRecent` compare `"2026-12" < "2026-12-03"` : le nouveau statut est ignoré même en aperçu, et l'avertissement ne s'allume pas (faux négatif) ;
- la CI échoue sur E4 avec un message déroutant (`fichier=declare amont=renonce/retrait`) ;
- `marquer statut` cible l'ancien statut, ou refuse une date incomplète.

À date égale (`2026-12-01` contre `2026-12`), les deux modules désignent des entrées différentes. Le commentaire « aucune seconde définition » d'`instantane.ts` est donc faux.

**Correctif (petit) :** une seule fonction exportée par `equite.ts`, qui compare `dateComparable(a)` et `dateComparable(b)` puis départage par l'ordre de la liste. La réutiliser dans `datagouv.ts`, `instantane.ts` et `rapport-import.ts`. Dans `mergeFiche`, traiter « date partielle du même mois que le dernier statut et (code, motif) différent » comme un `conflit` nommé (arbitrage d'Erwan) plutôt qu'un ajout. Ajouter les cas « date égale » et « date partielle » à `statut-plus-recent.test.ts` et `datagouv.test.ts`. **À corriger avant le 10 décembre.**

### WR-02 : une date amont qui recule pour un statut inchangé est une « dérive (information) » pour l'outil mais une erreur E5 pour la CI

**Fichiers :** `scripts/lib/datagouv.ts:253-258` (même (code, motif) donne `inchange` quelle que soit la date), `scripts/lib/instantane.ts:107-111` (E5), `scripts/lib/rapport-import.ts:127-132`

**Problème :** le producteur corrige une date vers le passé (ce type de dérive existe : six dérives de source en un mois). La répétition affiche alors la personne sous « Dérives de source (information) » et l'import écrit `inchangé`. Mais après la mise à jour du pointeur, `--check` et `npm test` échouent sur E5. Le RUNBOOK interdit de toucher l'ancienne entrée et ne donne aucune issue : la pull request reste rouge pendant la fenêtre.

**Correctif (petit) :** choisir une seule règle. Soit `mergeFiche` renvoie un `conflit` « date amont antérieure pour un statut inchangé » (arrêt visible dès la répétition, section Conflits) ; soit E5 devient une information I1. Ajouter la conduite à tenir au RUNBOOK. **À corriger avant le 10 décembre.**

### WR-03 : « Conséquences sur les thèmes publiés » sous-estime ce que la garde d'équité exigera

**Fichiers :** `scripts/lib/rapport-import.ts:89`, `:159-173` ; `src/lib/content-core/rules/equite.ts:70-71`

**Problème :** le rapport ne retient que les thèmes `publie` **et** présents dans `themes_ouverts`. `regleEquite` contrôle tous les thèmes `publie`, liste blanche ou non. Le RUNBOOK (condition 2) autorise l'import même si l'ouverture a pris du retard. Un thème santé publié mais pas encore ouvert donne donc « aucun thème publié » dans le rapport, alors que relire une nouvelle personne déclarée produira `EQUITE_CANDIDAT_MANQUANT` en erreur. Autres sous-estimations :
- les lignes « à décider » (`inconnus`) n'entrent pas dans `perimetreApres` ;
- un fichier candidat qui ne passe pas le schéma disparaît sans bruit de `loadAll(...).entries`, donc du périmètre ;
- à l'inverse, « après relecture de tous les statuts importés » inclut aussi les brouillons antérieurs à l'import.

**Correctif (petit) :** calculer les conséquences pour chaque thème `publie`, en marquant « (hors liste blanche) » ceux qui ne sont pas ouverts. Compter les inconnus dont le statut amont est dans le périmètre sur une ligne « à décider, entreraient dans le périmètre ». Signaler dans l'en-tête un corpus qui a des diagnostics d'erreur. Corriger le libellé.

### WR-04 : le contrôle d'identifiant de ressource et les tests de dépôt supposent que le nom de fichier trie comme la fraîcheur

**Fichiers :** `tests/corpus/instantane-coherence.test.ts:270-277`, `tests/import/import-cli.test.ts:19-26` (`newestSnapshot` trie par nom)

**Problème :** le nom est `2027etmoi-candidats-<mise_a_jour>-<sha12>.json`, et la recherche a établi que `mise_a_jour` n'est pas un marqueur fiable. Deux instantanés de même `mise_a_jour` peuvent coexister, par exemple un import relancé sur la même branche après un changement amont sans changement de `mise_a_jour`. L'ordre par nom dépend alors du hachage. Le test « par nom = par date » échoue une fois sur deux, et `newestSnapshot` peut prendre l'ancien. La CI de l'import devient instable sans erreur de contenu.

**Correctif (petit) :** dans les tests, prendre le plus récent avec `instantaneLePlusRecent` (mise_a_jour puis fetched_at) et remplacer l'assertion « par nom » par « le pointeur est le plus récent par (mise_a_jour, fetched_at) ». Ou bien ajouter au RUNBOOK : un seul instantané nouveau par pull request (supprimer l'autre avant le commit).

### WR-05 : RUNBOOK, l'entrée de la table est écrite avant que le worktree d'import existe

**Fichier :** `docs/RUNBOOK.md:302-304`

**Problème :** l'étape 2 fait écrire l'entrée dans `data/import/correspondances.yaml` sans dire où. L'étape 3 crée `../reveleTonProg-import` depuis `origin/main`, puis l'étape 4 fait `git add data/import/correspondances.yaml && git commit` dans ce worktree. Suivie à la lettre, la procédure laisse l'édition dans l'arbre principal (qui n'est plus propre, contre la condition 3). Le commit de l'étape 4 échoue (« nothing to commit ») et l'étape 5 s'arrête sur les inconnus. Le plan 10-05 fait l'ordre juste (worktree d'abord), mais pas le RUNBOOK.

**Correctif (petit) :** inverser les étapes 2 et 3, en écrivant « dans `../reveleTonProg-import` ». Ajouter avant le commit `git diff --stat data/import/correspondances.yaml` (non vide).

### WR-06 : RUNBOOK, la commande `range-diff` montrée à Erwan est fausse

**Fichier :** `docs/RUNBOOK.md:337`

**Problème :** `git range-diff origin/main...import/statuts-2026-12-ancienne import/statuts-2026-12` mélange la forme symétrique et un second argument qui n'est pas une plage. Essai dans un dépôt jetable : les commits de `main` apparaissent comme « retirés » (`<`) et l'ancien commit d'import comme commun aux deux côtés. Le diff montré pour obtenir l'accord du `--force-with-lease` laisse croire à une perte, ou masque une vraie omission de commit de relecture.

**Correctif (une ligne) :** `git range-diff origin/main import/statuts-2026-12-ancienne import/statuts-2026-12` (forme à trois arguments : `origin/main..ancienne` contre `origin/main..nouvelle`). Ajouter `git log --oneline origin/main..import/statuts-2026-12 | wc -l` égal au nombre noté à l'étape `git log --reverse`.

### WR-07 : RUNBOOK, « relecture santé fusionnée » vérifiée par `--is-ancestor` sur une référence distante

**Fichier :** `docs/RUNBOOK.md:293`

**Problème :** `git merge-base --is-ancestor origin/relecture/sante origin/main` est faux si la pull request a été fusionnée en squash ou en rebase. Il est faux aussi si Erwan a poussé d'autres commits sur la branche après la fusion (la relecture travail/Europe peut continuer). Il échoue enfin avec « Not a valid object name » si la branche distante a été supprimée et élaguée. Dans tous ces cas, la règle « reporter » s'applique à tort et l'import part après le gel. Le plan 10-05 utilise `gh pr list --head relecture/sante --state merged`, plus robuste.

**Correctif (une ligne) :** reprendre la commande du plan 10-05 dans le RUNBOOK, et garder `--is-ancestor` seulement comme information.

### WR-08 : RUNBOOK, aucune conduite quand `marquer statut` refuse une date incomplète (règle D-08 impossible à tenir)

**Fichiers :** `docs/RUNBOOK.md:317`, `scripts/lib/relecture/commandes/marquer.ts:88`, `schemas/candidat.schema.json:47-50`

**Problème :** un statut importé daté `AAAA-MM` ne peut pas être relu par l'outil (« un statut relu exige une date complète »). L'étape 10 exige zéro `STATUT_PLUS_RECENT_NON_RELU` avant la fusion, sinon un écrit d'Erwan. Pour un retrait daté au mois seulement, la production continue d'afficher « déclaré » après la fusion, et le RUNBOOK ne dit ni s'il faut compléter la date à la main (l'entrée est neuve, ce n'est pas réécrire l'historique), ni avec quelle source.

**Correctif (petit, documentation) :** ajouter un paragraphe au RUNBOOK. Erwan complète la date de l'entrée **ajoutée par cet import** d'après la source primaire, dans le commit de relecture, puis lance `marquer`. Le contrôle E5 tolère déjà une date complète du même mois.

### WR-09 : le test de dépôt ne détecte pas plusieurs formes de lecture YAML directe

**Fichier :** `tests/repo/yaml-plafonne.test.ts:115`, `:142`, `:153`, `:270`

**Problème :** reproduit avec les fonctions du test. Les trois formes suivantes ne sont pas signalées :
- `import { Parser, Composer } from 'yaml'` (analyseur bas niveau) ;
- `import … from '@astrojs/internal-helpers/yaml'` (enveloppe de `parseDocument`, présente dans `node_modules`) ;
- `createRequire(import.meta.url)('yaml')`.

Les extensions `.mts`, `.cts`, `.cjs`, `.tsx` ne sont pas balayées. L'en-tête affirme pourtant que le test « interdit toute autre lecture directe ». Un fichier de la liste blanche peut aussi exporter une enveloppe générique : rien ne le voit.

**Correctif (petit) :** ajouter `Parser`, `Composer`, `Lexer`, `parseCST` à `API_LECTURE`. Signaler tout spécificateur qui finit par `/yaml` ou contient `yaml` hors `yaml-lint`, ainsi que `createRequire`. Élargir les extensions. Pour les huit fichiers de la liste blanche, vérifier qu'ils n'exportent aucune fonction qui prend un texte et renvoie un `Document` ou un objet, à part `parseYaml` et les fonctions de `yaml-plafonne.ts`.

### WR-10 : la cohérence peut passer à vide, et aucun garde ne protège d'un jeu amont vidé

**Fichiers :** `tests/corpus/instantane-coherence.test.ts:256-268`, `scripts/lib/datagouv.ts:96-97`, `scripts/import-datagouv.ts:150-160`

**Problème :** `checkUpstream` accepte `candidats: []`. Si data.gouv sert un jeu vide ou tronqué, l'import réel écrit l'instantané et sa méta, toutes les fiches passent en « absent » (I2, information) et, une fois le pointeur mis à jour, `--check` affiche « 0 écart ». La page Méthode annonce alors 0 ligne. Le test du dépôt réel n'affirme ni `rows.length > 0` ni `fiches.size > 0`. Seule la lecture humaine du rapport protège.

**Correctif (petit) :** dans l'import réel, refuser (code 1, rien d'écrit) un jeu dont plus de N % des clés connues de la table ont disparu (N = 20), sauf avec `--accepter-absents` explicite. Ajouter au test du dépôt réel `assert.ok(etat.rows.length > 0 && etat.fiches.size >= etat.rows.length - …)`.

### WR-11 : deux tests de la phase fabriquent un retrait de candidature pour une personne réelle

**Fichier :** `tests/import/import-cli.test.ts:446-460`, `:488-499` (commit `493b483`)

**Problème :** les nouveaux tests Markdown changent `melenchon` en `renonce/retrait` et vérifient la ligne `jean-luc-melenchon : statut : declare … -> renonce/retrait`. La consigne de la phase (et le 10-03-SUMMARY lui-même, qui caviarde les noms réels) est : personnes fictives seulement. La racine est temporaire et rien n'est publié, mais un texte qui attribue un retrait à une personne réelle se trouve désormais dans un dépôt public. Des tests plus anciens (`75f9278`) suivent le même motif ; la phase l'a étendu au lieu de le corriger.

**Correctif (petit) :** ajouter à la racine temporaire une ligne amont fictive (`essai-fictif`, sur le modèle de `deuxInconnus`) avec sa ligne de table, et muter celle-là.

### WR-12 : un test rouge a été réécrit au commit vert sur un état que l'import ne peut pas produire

**Fichier :** `tests/rules/statut-plus-recent.test.ts:115-121`, `:153` (commit `4a44d93`)

**Problème :** le cas rouge « ne bloque jamais » faisait recevoir à Luc (renoncement relu) une entrée `declare` plus récente. Au commit vert, il est devenu `renonce` puis `renonce` (même code, même motif, nouvelle source). Or `mergeFiche` ne produit jamais cela (même (code, motif) donne `inchange`). Le scénario réel « une personne relue hors périmètre redevient déclarée » n'est plus exercé par ce test. C'est pourtant le cas où `marquer` refuse (case de couverture manquante). La propriété « l'avertissement ne bloque pas » reste protégée, mais sur un état artificiel.

**Correctif (petit) :** remettre l'entrée `declare` et affirmer explicitement que `marquer` refuse avec `EQUITE_CANDIDAT_MANQUANT` et restaure le fichier, puis réussit après la pose de la case (comme `marquer-import.test.ts`). Garder le cas `renonce` en plus si besoin.

## Info

### IN-01 : `ajouterStatutYaml` re-sérialise tout le document, contrairement à son commentaire
`scripts/lib/datagouv.ts:271-283`. `doc.toString()` convertit les fins de ligne CRLF en LF sur tout le fichier et remet en forme les scalaires repliés (`>-` sur deux lignes devient une seule ligne) ; un fichier sans saut de ligne final en reçoit un. Les 59 fiches actuelles restent préfixe exact (vérifié), et le contrôle `numstat` du plan 10-05 attraperait une suppression. Correctif : soit une insertion de texte à la fin de la séquence `statuts` (comme `editer.ts`), soit vérifier `sortie.startsWith(texte)` et sinon en faire un conflit nommé.

### IN-02 : le rapport Markdown omet les fichiers illisibles
`scripts/import-datagouv.ts:267-281`, `:402-405`. `illisibles` n'est imprimé qu'en mode texte, après le `process.exit` du mode Markdown. Correctif : ajouter une section, ou une ligne dans « Conflits ».

### IN-03 : en import réel avec `--format markdown`, le rapport est calculé sur le corpus déjà écrit et garde le titre « répétition à blanc »
`scripts/import-datagouv.ts:402-404`, `rapport-import.ts:196`. `loadAll` lit les fiches écrites. Le périmètre de production n'en est pas changé (les nouveaux statuts sont en brouillon), mais le titre trompe. Le RUNBOOK calcule le rapport depuis le parent, ce qui est juste. Correctif : refuser `--format markdown` sans `--dry-run`, ou bien titrer « Rapport d'import ». Par ailleurs, un `fail()` dans `rapportDeCetteExecution` après les écritures sort avec le code 1 alors que l'import a réussi.

### IN-04 : balises explicites acceptées par les deux analyseurs ; aucun plafond de taille ni de profondeur
`yaml-plafonne.ts:14-15` et `load.ts:20-22`. `!!binary` donne un Buffer, `!!timestamp` une Date, `!!set` et `!!omap` un objet vide, `.inf` un Infinity. Le commentaire « 2026-11-03 reste une chaîne, jamais une Date » n'est donc vrai que sans balise. Une imbrication de 100 000 niveaux ne fait pas planter la lecture (diagnostic propre, vérifié), mais aucun plafond d'octets n'existe sur les lectures des scripts. Les deux analyseurs restent équivalents ; le test d'équivalence ne couvre pas ces balises. Correctif : refuser tout `tag` explicite via `visit` dans les deux analyseurs, et ajouter un plafond (1 Mio) avant `parseDocument`.

### IN-05 : `dataset-datagouv.ts` figure sur la liste blanche comme « plafond propre », mais ignore `doc.warnings`
`src/lib/dataset-datagouv.ts:51-52`. Une balise inconnue y passe, alors que `yaml-plafonne.ts` la refuse. Antérieur à la phase, mais la justification de la liste blanche l'affirme. Correctif : tester aussi `doc.warnings`.

### IN-06 : identifiant amont renommé : `ids_externes` reste périmé, sans conduite au RUNBOOK
`scripts/lib/datagouv.ts:233-264`, `instantane.ts:132-139`. Si Erwan fait pointer un nouvel identifiant amont vers une fiche existante, `mergeFiche` ne met pas `ids_externes` à jour. La fiche est alors listée « absente du jeu amont » et E3 rend la CI rouge jusqu'à une édition manuelle. Correctif : une phrase au RUNBOOK (« mettre à jour `ids_externes.2027etmoi` dans le même commit que la table »), ou une note `ids_externes différent` dans le rapport.

### IN-07 : étape 1 du RUNBOOK sans `npm run -s`
`docs/RUNBOOK.md:301`. L'en-tête de `npm run` s'écrit sur la sortie standard, donc au début de `/tmp/rapport-matin.md` (l'étape 6 utilise bien `-s`). Correctif : `npm run -s`.

### IN-08 : liste de contrôle : un compte en dur oublié, une attente périmée
`docs/AUDIT-TEST-CROISE.md:52` cite « écart 59 sur 51 », et ce fichier manque au point 8. L'étape 8 annonce « trois avertissements attendus tant qu'aucun thème n'est ouvert », alors que le site sera ouvert le 10 décembre ; préciser le nombre attendu à cette date. `tests/dist/cas/methode.cas.ts:235` n'interdit en dur que 51, 59, 37 et 17 : les nouveaux comptes n'y seront pas gardés.

### IN-09 : `process.exit` juste après `console.log` dans `--check` et en mode texte
`scripts/import-datagouv.ts:58-65`, `:406-420`. Sur macOS, l'écriture vers un tube est asynchrone : une longue liste d'écarts redirigée vers `| tee` peut être tronquée. Le mode Markdown utilise déjà `imprimer()`. Correctif : la même attente, ou `process.exitCode`.

### IN-10 : la cohérence se tait pour toutes les personnes dès qu'un seul fichier candidat est invalide
`statut-recent.ts:29`. Cohérent avec `regleEquite`, et l'erreur de schéma fait déjà échouer la CI. À noter au catalogue : l'avertissement n'est fiable qu'à zéro erreur de schéma.

## Tests existants modifiés par ces plans (point 8)

| Test | Changement | Propriété toujours protégée ? |
|---|---|---|
| `tests/rules/moteur.test.ts:293` | 46 codes passent à 47 au catalogue | Oui (unicité et décompte) |
| `tests/import/import-cli.test.ts` (`55ea155`) | ligne d'import seulement, puis ajouts | Oui |
| `tests/archive/wayback.test.ts`, `tests/couverture/classement.test.ts`, `tests/import/datagouv.test.ts` | ajouts seulement | Oui. Changement de comportement voulu : une source au YAML refusé arrête maintenant `archive-source` au lieu d'être ignorée |
| `tests/import/rapport.test.ts:87` (rouge réécrit au vert) | l'aide `section` s'arrête aussi sur `---` | Oui, et plus juste |
| `tests/rules/statut-plus-recent.test.ts:115-153` (rouge réécrit au vert) | `declare` devient `renonce`, `marquer` reçoit `--hors-perimetre` | En partie : voir WR-12 |
| `tests/repo/docs.test.ts` (`034f855`) | option cherchée comme clé `parseArgs`, « Décision d'Erwan » au moins deux fois | Oui, renforcé |

## Vérifié et trouvé sain

- `analyserYamlPlafonne` et `parseYaml` : texte identique ligne à ligne (options, messages, positions, racine non objet, avertissements comptés comme erreurs). BOM, CRLF, `yes`/`no` (chaînes), directive `%YAML 1.1` (sans effet), plusieurs documents, clés en double à toute profondeur, `<<` (refusé, car c'est un alias) : même résultat. Les messages ne citent que la première ligne d'erreur de `yaml`, jamais le contenu d'un scalaire.
- `--dry-run` : aucune écriture (lignes 380 et 396 gardées). L'import réel s'arrête sur un inconnu avant toute lecture des fiches. « rien n'a été écrit » n'est imprimé qu'avant la première écriture. Chaque fichier est écrit de façon atomique (`wx` puis `rename`) ; un nouveau passage après un arrêt brutal reprend proprement (fiches existantes vues comme « inchangé », `ids.lock` complété).
- `--check` : codes 0, 1 et 2 ; aucun réseau ni écriture ; une lecture refusée nomme le fichier.
- E1 à E6 échouent chacun sur l'incohérence annoncée (cas synthétiques et mutations sur racine temporaire). Une dérive tolérée se limite à l'URL de source ou à une date antérieure pour un même (code, motif), sauf l'asymétrie de WR-02. La mémoïsation de `loadDatasetDatagouv` n'introduit pas de dépendance à l'ordre : chaque fichier de test tourne dans son processus, avec des racines `mkdtemp` uniques.
- `STATUT_PLUS_RECENT_NON_RELU` : aucun faux positif pour une personne sans statut relu (`retenu === undefined`), aucun faux négatif quand l'entrée récente est `publie`. La sévérité reste `warning` dans tous les modes, et `validate`, le chargeur Astro, `marquer`, `publier` et `retirer` ne filtrent que les erreurs. Le message est neutre et sans mot interdit. Le catalogue et le RUNBOOK concordent.
- Les quatre pièges prouvent ce que disent les bilans : invisibilité en production pour un brouillon, avertissement en aperçu, erreur une fois relu sans case, propre avec la case. `marquer` refuse et restaure les octets. Personnes fictives (`Camille Exemplaire`, `exemple.test`).
- La recette de recréation (`switch -C`, `checkout <sha> --` des seuls fichiers d'instantané, `cherry-pick` des commits nommés, `--abort` sur conflit) ne réécrit pas de marque de relecture sans conflit visible. La preuve `--is-ancestor` porte sur le `headRefOid` exact, et `--match-head-commit` existe. Les bornes du gel et les replis concordent avec les décisions du 2026-11-13.
- Les huit points de la liste de contrôle couvrent tous les comptes en dur trouvés dans le code et les tests (`dataset-datagouv.test.ts:58-63`, `methode.cas.ts:133`, `LICENSE:81`, `ATTRIBUTION.md:3`, README, `COUVERTURE-THEMES.md`), sauf IN-08.
- Le rapport est déterministe : tri par code d'unité, aucune horloge, aucune locale. `fetched_at` est en UTC et comparé avec `Date.parse`.

---

_Revu le : 2026-11-13T11:40:00Z_
_Relecteur : Claude (gsd-code-reviewer)_
_Profondeur : deep_
