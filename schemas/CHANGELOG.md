# Journal des schémas

Les schémas JSON de ce dossier sont la seule source de vérité du contrat de données (JSON Schema 2020-12, validé par Ajv en mode strict). Chaque fichier de contenu porte `version_schema`.

## Règle d'incrément

- Resserrer une contrainte, renommer un champ ou ajouter un champ obligatoire : **incrément de `version_schema`** et migration dans `scripts/migrations/<schema>/<NNN>-<desc>.ts`.
- Assouplir une contrainte ou ajouter un champ optionnel : **pas d'incrément**.

`npm run migrate -- --check` échoue en CI si un fichier est en retard sur la version courante ; `npm run migrate -- --write` applique les migrations.

## v1, ajout du 2026-11-10 : `archive.wayback_exception` (sans incrément)

- Champ **optionnel** `archive.wayback_exception { motif, decide_par, decide_le }` dans `defs/common` : exception motivée à la copie Wayback Machine (décision D-08 révisée, plan 09-03, PUB-04). `motif` : 20 à 300 caractères ; `decide_par` : texte ; `decide_le` : date complète ; aucune autre clé.
- Une archive qui porte à la fois `wayback_url` et `wayback_exception` est invalide (`SCHEMA_FALSE` sur `/archive/wayback_url`).
- Ajout d'un champ optionnel : **pas d'incrément** de `version_schema` (règle ci-dessus), aucune migration ; les sources existantes restent valides.
- Règle : une source citée par une mesure publiée qui porte une exception valide ne produit pas `ARCHIVE_WAYBACK_ABSENTE`. La liste des exceptions du corpus réel est épinglée par `tests/rules/sources-wayback.test.ts`.

## v1 (2026-11-03)

Schémas :

- `defs/common` : définitions partagées (slug, idCandidat, dates, urlHttps, sha256, texte, statutRelecture, archive, sourceStatut).
- `candidat` : identité, parti avec sa source, identifiants externes, historique `statuts[]` relu et sourcé.
- `theme` : thème et sous-thèmes ordonnés, état de relecture lu par la règle d'équité.
- `mesure` : mesure d'un candidat avec ses quatre rédactions et son état de relecture.
- `source` : document primaire cité (type, auteur, URL, dates, bloc d'archive, candidats concernés).
- `couverture` : pour un thème, l'état de chaque candidat (`mesures`, `non_precise`, `programme_non_publie`) avec `verifie_le`, `verifie_par` et, pour `non_precise`, les sources consultées.
- `glossaire` : entrées `terme` et `parti` ; une entrée `parti` exige une source de type `parti` (son auto-description).
- `sondage` : fiche de sondage (institut, terrain, échantillon, marges, notice obligatoire, hypothèses) ; affichage au lot 4, règles en Phase 2.
- `journal` : entrée du journal public (générée au lot 5), un fichier par entrée.

### Hypothèses de modélisation acceptées

- **A1** : les champs de relecture (`statut_relecture`, `relecteur`, `date_relecture`) vivent sur chaque entrée de `statuts[]`.
- **A2** : le statut `relu` exige déjà `relecteur` et `date_relecture` (plus strict que la spec).
- **A3** : `archive.wayback_url` est optionnel en v1 (la capture Wayback peut échouer ou être bloquée par robots.txt) ; `archive.sha256` est l'empreinte de l'extrait `.txt` versionné ; `archive.binaire_sha256` est facultatif.
- **A4** : `source.candidats[]` est obligatoire, pour relier une source à ses candidats.

### Règles différées

- Règle Phase 2 : `archive.wayback_url` obligatoire pour toute source citée par une mesure `statut_relecture: publie` (règle, pas de changement de schéma).
- Cohérence entre fichiers (couverture et candidats, sondage et candidats, `id_cible` du journal), somme des pourcentages d'un sondage, fenêtres de blocage des sondages, longueur et ton des définitions du glossaire : Phase 2.

### Nommage du journal

Le journal utilise `collection_cible` et `id_cible`, jamais `collection` : la couche contenu d'Astro traite tout objet portant une chaîne `collection` qui nomme une vraie collection, plus un `id`, comme une référence de contenu et journalise des erreurs.
