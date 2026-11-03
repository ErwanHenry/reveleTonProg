# archives/

Preuves textuelles des sources citées par le site (décision D-8).

## Ce qui va ici

- Uniquement des **extraits en texte brut** : `archives/<candidat>/<sha12>.txt`, où `<sha12>` est le début du sha256 du fichier.
- Le hash complet, la date de capture et l'éventuelle URL Wayback sont enregistrés dans la source YAML correspondante (`src/content/sources/<id>.yaml`, champ `archive`).
- Plafond : **5 Mo** par fichier.

## Ce qui n'y va pas

Les binaires (PDF, HTML rendu) vivent dans le dépôt privé `reveleTonProg-archives`, hors de ce dépôt public. Ils évitent une réécriture d'historique avant la mise en ligne et protègent la taille du dépôt.

## Comment ça se remplit

Jamais à la main : `node scripts/archive-source.ts <url> --candidat <id> --source-id <slug> --type … --auteur … --titre … --date-publication …` (détails et modes dans `docs/RUNBOOK.md`, section « Archiver une source »). L'outil écrit l'extrait normalisé ici, la source dans `src/content/sources/`, et le binaire dans le dépôt privé.

Disposition du dépôt privé `reveleTonProg-archives` :

- `<candidat>/<sha12>.pdf` ou `.html` : le binaire, nommé par le début de son propre sha256 (`binaire_sha256` dans la source) ;
- `<candidat>/<sha12>--<source-id>.json` : la fiche de capture de cette source (`url_demandee`, `url_finale`, `statut_http`, `content_type`, `bytes`, `binaire_sha256`, `extrait_sha256`, `capture_le`, `outil`). Une fiche par source, même quand deux sources partagent un binaire.

## Droits

Les textes archivés sont des **droits réservés à leurs auteurs, reproduits à titre de preuve et de citation** (CPI art. L. 122-5). Ce dossier est exclu des licences du projet (voir [LICENSE](../LICENSE), section 3).

Un contact de retrait (demande de suppression par un ayant droit) sera publié au lot 3, dans les mentions légales.
