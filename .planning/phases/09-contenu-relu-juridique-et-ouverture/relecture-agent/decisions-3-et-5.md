# Décisions 3 et 5 du 2026-11-17 : application par agent

- Date : 2026-11-17
- Worktree : `/Users/erwanhenry/claude-projects/reveleTonProg-relecture`, branche `relecture/sante`
- Décisions appliquées : point 3 (document d'un parti sur le site de campagne, deux mesures de Jean-Luc Mélenchon) et point 5 (dates de publication de trois sources), voir le dernier bloc `<revision>` de `09-CONTEXT.md`.
- Champs protégés non touchés : `texte_source`, `id`, `candidat`, `theme`, `statut_relecture`, `relecteur`, `date_relecture`, tous les champs `archive.*`, le dossier `archives/`, la couverture, le glossaire. Titres des mesures inchangés (aucun ne nomme le candidat comme auteur).

## Tâche A : attribution au parti (décision 3)

### Preuve dans l'archive

Extrait `archives/jean-luc-melenchon/b7af366684aa.txt` (source `jean-luc-melenchon-comptes-publics`), lignes 351 et 352 :

> « Ce document présente donc les grandes orientations budgétaires que la France insoumise propose pour l'année 2027. »

Le nom du candidat n'apparaît nulle part dans l'extrait (`grep -c -i lenchon` : 0). Le texte parle en « nous » (ligne 464 : « Nous proposons une hausse globale de 3 milliards d'euros du budget des hôpitaux avec au moins 10 000 créations de postes de personnel soignant. »). Le seul lien au candidat est l'adresse du fichier, sur melenchon2027.fr (champ `url` de la fiche source) : c'est ce qui appuie « publié sur le site de campagne du candidat ».

Nom du parti repris tel quel de `src/content/candidats/jean-luc-melenchon.yaml` : `parti: La France insoumise`.

### Fiche source `src/content/sources/jean-luc-melenchon-comptes-publics.yaml`

- `auteur` : avant `candidat`, après `parti_du_candidat`. Rien d'autre ne change dans ce fichier.

### `src/content/mesures/jean-luc-melenchon/sante-budget-hopitaux-postes-soignants.yaml`

- Résumé, avant : « Jean-Luc Mélenchon propose 3 milliards d'euros de plus pour le budget des hôpitaux, avec au moins 10 000 créations de postes de soignants. »
- Résumé, après : « Son parti, La France insoumise, propose 3 milliards d'euros de plus pour le budget hospitalier, avec au moins 10 000 créations de postes de soignants. »
  Le nom du parti porte le résumé à 26 mots (plafond 25) : « budget des hôpitaux » devient « budget hospitalier », même sens (citation : « du budget des hôpitaux »).
- Détaillé, début avant : « Dans le document sur les comptes publics publié sur son site de campagne, Jean-Luc Mélenchon propose une hausse globale… »
- Détaillé, début après : « Dans le document sur les comptes publics publié sur le site de campagne du candidat, son parti, La France insoumise, propose une hausse globale… » (« son site » deviendrait ambigu avec le parti pour sujet ; le reste du texte est inchangé, « selon lui » renvoie désormais au parti.)
- Enfant, début avant : « Jean-Luc Mélenchon veut donner plus d'argent aux hôpitaux. » Après : « Son parti veut donner plus d'argent aux hôpitaux. » (« Il veut aussi… » et « son budget » renvoient au parti ; reste inchangé.)
- Aîné, début avant : « Dans son document sur les comptes publics, Jean-Luc Mélenchon propose d'augmenter… » Après : « Dans le document sur les comptes publics, son parti, La France insoumise, propose d'augmenter… » (reste inchangé).

### `src/content/mesures/jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad.yaml`

- Résumé, avant : « Jean-Luc Mélenchon veut un plan d'urgence contre les canicules, qui commencerait par équiper hôpitaux, Ehpad, écoles et certains logements contre les incendies. »
- Résumé, après : « Son parti, La France insoumise, veut un plan d'urgence contre les canicules, commençant par équiper hôpitaux, Ehpad, écoles et certains logements contre les incendies. »
  Même dépassement à 26 mots : « qui commencerait » devient « commençant » (formulation du titre de la mesure). Archive, ligne 492 : « Ce plan d'urgence contre les canicules commencera par équiper les hôpitaux, Ehpad, écoles et logements dits « bouilloires thermiques » contre les incendies. » Le verbe « veut » est conservé (consigne : garder les autres mots).
- Détaillé, début avant : « Dans le document sur les comptes publics publié sur son site de campagne, Jean-Luc Mélenchon écrit qu'il faut… » Après : « Dans le document sur les comptes publics publié sur le site de campagne du candidat, son parti, La France insoumise, écrit qu'il faut… » (« Il indique » renvoie au parti ; reste inchangé.)
- Enfant, début avant : « Jean-Luc Mélenchon veut un plan d'urgence contre les canicules. » Après : « Son parti veut un plan d'urgence contre les canicules. » (reste inchangé).
- Aîné, début avant : « Dans son document sur les comptes publics, Jean-Luc Mélenchon écrit qu'il faut… » Après : « Dans le document sur les comptes publics, son parti, La France insoumise, écrit qu'il faut… » (reste inchangé).

### Autres mesures qui citent la même source

`grep -rl "source: jean-luc-melenchon-comptes-publics" src/content/mesures` :

- `jean-luc-melenchon/sante-budget-hopitaux-postes-soignants` (corrigée)
- `jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad` (corrigée)
- `jean-luc-melenchon/travail-abrogation-reformes-assurance-chomage` : thème travail, NON modifiée ; nomme « Jean-Luc Mélenchon » 4 fois, donc même correction à prévoir lors de la relecture du thème travail.
- `jean-luc-melenchon/travail-smic-1700` : thème travail, NON modifiée ; même remarque (4 occurrences).

Le passage de la fiche à `parti_du_candidat` ne déclenche aucune erreur sur ces deux mesures (validateur à 0 erreur).

## Tâche B : dates de publication (décision 5)

### 1. `src/content/sources/gabriel-attal-sante-droit-climatisation.yaml`

- Preuve, `archives/gabriel-attal/0ea9698010c3.txt`, lignes 32 à 36 : « Mesure annoncée / Instaurer un droit à la climatisation / 25 juin 2026 · Face aux canicules ». La date est sous le titre de la mesure elle-même (et non seulement dans le bloc « Dans les actualités », ligne 62, qui porte la même date).
- `date_publication` : avant `2026-11`, après `2026-06-25`.
- Une seule mesure cite cette source : `gabriel-attal/sante-droit-climatisation` ; ses rédactions ne citent aucune date de publication.

### 2. `src/content/sources/nathalie-arthaud-brochure-campagne.yaml`

- Preuve, `archives/nathalie-arthaud/df65b7989e57.txt`, ligne 824 : « Supplément gratuit à Lutte ouvrière n° 3021 du 26 juin 2026 ».
- `date_publication` : avant `2026-07-06`, après `2026-06-26`.
- Mesures qui citent la source : `nathalie-arthaud/sante-embauches-hopitaux`, `travail-repartition-du-travail`, `travail-hausse-salaires-indexation`, `europe-et-monde-regularisation-sans-papiers`, `europe-et-monde-contre-protectionnisme`. Aucune ne mentionne « juin », « juillet » ni la date dans ses rédactions (vérifié par grep) ; le champ n'est pas affiché : aucune n'est touchée par le changement.

### 3. `src/content/sources/nicolas-dupont-aignan-sante-projet-dlf.yaml`

- Constat dans `archives/nicolas-dupont-aignan/e3eae3f78fa1.txt` : aucune date de publication ; chiffres les plus récents de 2017 à 2020 (ligne 161 : « atteignait 9 361 en 2020 »), échéance ligne 279 : « atteindre dès 2025 les objectifs de délais d'attente » ; seule mention de 2026 au pied de page (ligne 517 : « Debout La France © 2026 »), qui n'est pas une date de publication.
- (a) Commentaire YAML : NON ajouté. Essai fait : avec le commentaire au-dessus de `date_publication`, le test `relire puis réécrire chaque source réelle redonne les mêmes octets` (`tests/archive/archive.test.ts`) échoue sur ce fichier, car `paramsDeSource` puis `buildSourceYaml` ne restituent pas les commentaires. Commentaire retiré, test vert. `date_publication: 2026-11` est conservé tel quel (mois de consultation, valeur exigée par le schéma, non affichée). L'explication passe par le titre seul.
- (b) `titre` : avant `"Debout la France, projet : Santé"`, après `"Debout la France, projet : Santé (page non datée)"`. L'aller-retour octet pour octet passe avec ce titre.
- (c) `source_localisation` des deux mesures (rédactions non touchées) :
  - `nicolas-dupont-aignan/sante-fin-passe-sanitaire` : avant « page Santé du projet de Debout la France, liste Quelques mesures fortes, première mesure », après « page Santé du projet de Debout la France, liste Quelques mesures fortes, première mesure (page non datée) ».
  - `nicolas-dupont-aignan/sante-lits-etablissements` : avant « … deuxième mesure », après « … deuxième mesure (page non datée) ».
- Ces deux mesures sont les seules à citer cette source.

## Vérifications (Node 24, depuis le worktree)

- `node scripts/validate.ts --mode production` : 0 erreur, 21 avertissements (avant : 0 erreur, 22). `--mode preview` : idem. Le seul écart est la disparition de l'avertissement de lisibilité de l'enfant de `sante-plan-canicule-hopitaux-ehpad` (79,2 avant) ; aucun nouvel avertissement (diff des sorties).
- `npm test` (suite complète) : 2891 tests, 2882 réussis, 0 échec, 9 ignorés.
- `npm run check` : 291 fichiers, 0 erreur, 0 avertissement, 0 indication.

## Commits (branche `relecture/sante`, non poussés)

- `8aa78a2` relecture(sante): Mélenchon, deux mesures attribuées à La France insoumise
- `25f68eb` relecture(sante): dates de publication de trois sources

## Ce qui n'a pas été fait

- Commentaire YAML sur la source Debout la France : il casse le test d'aller-retour des fiches sources ; explication portée par le titre seul, comme prévu par la consigne.
- Les deux mesures travail de Jean-Luc Mélenchon, qui citent la même source et nomment le candidat comme sujet : signalées, non modifiées (thème hors relecture).
