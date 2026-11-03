# data/import — import du jeu data.gouv « statuts sourcés »

Ce dossier contient l'entrée de l'import : instantanés bruts datés, table de correspondance faite à la main, attribution. Les fiches générées sont dans `src/content/candidats/`.

## Commande

```
npm run import:datagouv                      # télécharge le jeu, écrit l'instantané puis les fiches
npm run import:datagouv -- --file data/import/<instantané>.json   # hors ligne, rejouable
npm run import:datagouv -- --dry-run         # rapport seul, rien n'est écrit
```

Options : `--file <json>` (instantané local), `--url <https>` (ressource à télécharger), `--dry-run`, `--root <dossier>` (défaut : dossier courant ; `RTP_CONTENT_ROOT` est ignorée). Codes de sortie : 0 réussi, 1 contenu refusé (id inconnu, conflit, fiche invalide), 2 usage.

## Ce qui est écrit

- `2027etmoi-candidats-<mise_a_jour>-<sha12>.json` : les octets reçus, tels quels. `.meta.json` voisin : URL initiale et finale, ETag, date de récupération, sha256, taille, nombre de lignes. Un second passage sur les mêmes octets (même sha256) n'écrit aucun nouvel instantané et ne change aucune fiche.
- `src/content/candidats/<id>.yaml` : une fiche par ligne, statut en `brouillon`, sans relecteur.
- `ids.lock` : chaque identifiant importé est verrouillé (ajout seul).

Les instantanés sont déclarés `-text` dans `.gitattributes` : aucune conversion de fin de ligne, sinon le sha256 ne correspondrait plus aux octets reçus (Windows).

## Règle : jamais `bloc` ni `propositions`

`bloc`, `propositions` et `statut_detail` n'entrent jamais dans `src/content/`. Ils survivent seulement dans l'instantané brut de ce dossier, qui n'est ni publié ni copié dans `public/` ou `dist/`. Le code de mapping ne les lit pas (test sur chaque ligne) et la règle de contenu `CHAMP_NON_IMPORTABLE` de la phase 2 le vérifie dans `src/content/`.

## Historique des statuts : ajout seul

- Une fiche absente est créée.
- Une fiche présente garde `id`, `prenom`, `nom`, `nom_tri`, `ids_externes` et tout son historique, relectures comprises.
- Si le couple (code, motif) du jeu amont diffère du dernier statut du fichier et que la date amont n'est pas antérieure, une nouvelle entrée est ajoutée à la fin de `statuts[]` (en `brouillon`). Aucune entrée ancienne n'est modifiée ni supprimée. Une fiche modifiée est réécrite par l'importeur dans son rendu canonique : relire le diff.
- Même statut mais source ou date différente : note « source amont modifiée » dans le rapport, rien n'est écrit.
- `parti` ou site de campagne différent : note dans le rapport, jamais appliqué.
- Une ligne disparue du jeu amont : la fiche reste (son id reste verrouillé), le rapport la liste sous « absent en amont ».

## Conflit

Un conflit arrête tout l'import (code 1, rien n'est écrit) : un identifiant amont absent de `correspondances.yaml` (la liste complète est affichée), une date de statut qui recule, un fichier existant illisible. Pour résoudre : ajouter ou corriger la ligne dans `correspondances.yaml`, ou attendre la correction amont. Ne jamais modifier une ancienne entrée de `statuts[]` pour faire taire un conflit.

## Les changements de décembre (10-13 déc.)

1. `npm run import:datagouv` ;
2. lire le rapport imprimé (créé, statut ajouté, inchangé, absent en amont, conflit) ;
3. ouvrir une PR avec le diff de `src/content/candidats/`, le nouvel instantané et `ids.lock` ;
4. `npm run validate -- --root . --mode production` et `npm run ids -- --root . --check`.

Une nouvelle personne amont s'ajoute d'abord à la main dans `correspondances.yaml` (jamais de découpage automatique du nom).

## Valeurs par défaut à relire

- `date_consultation` d'un statut = `verifie_le` amont (la date d'import prétendrait une consultation qui n'a pas eu lieu).
- `parti: null` quand ni page du parti ni site de campagne ne corrobore l'étiquette : une étiquette sans source n'est pas affichée.

Lignes à relire à la main avant toute relecture éditoriale :

- motifs `renonce` ambigus : `philippe-poutou` et `sarah-knafo` en `non_candidat`, `philippe-brun` en `elimine_primaire` (la valeur la moins fausse ; aucun autre code ne convient) ;
- les lignes à `parti: null` (aucune source de revendication dans le jeu amont) ;
- `laurent-wauquiez` : date de statut partielle `2026-07`, à compléter avant tout passage à `relu` ;
- `benjamin-lucas-lundy` : l'URL de la source écrit « lucas-landy », vérifier l'orthographe.
