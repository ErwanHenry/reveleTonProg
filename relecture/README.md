# Registre de relecture

Ce dossier appartient à l'outil de relecture local (`npm run relecture`). Il n'est jamais déployé et n'est lu ni par le site ni par Astro.

## Les deux fichiers

- `journal.jsonl` : une ligne JSON par écriture de l'outil (`horodatage`, `action`, `cible`, `relecteur`, `date`, `sha256`). L'empreinte `sha256` porte sur le texte relu (rédactions et sourçage d'une mesure, contenu d'un statut ou d'une case de couverture, sans les champs de relecture). Si ce texte change après la relecture, `liste` affiche la cible « à revoir ».
- `notes.jsonl` : les notes de correction (`horodatage`, `cible`, `texte`, `etat` ouverte ou resolue). Une note ouverte bloque `marquer` sur sa cible, sauf avec `--malgre-note`.

Les deux fichiers sont en ajout seul : on ne modifie ni ne supprime une ligne. Une note se ferme par une nouvelle ligne (`npm run relecture -- note --resoudre <cible>`). Une ligne illisible ou une clé inconnue arrête l'outil avec le numéro de la ligne.

## Le dépôt est public

Tout ce qui est écrit ici est publié avec le dépôt. Une note ne contient aucune donnée personnelle (ni adresse, ni téléphone, ni nom d'un particulier) : seulement ce qu'il faut corriger dans la mesure. Le nom du relecteur est public (il s'affiche sur les mesures publiées) ; il vient de l'option `--relecteur` ou de la valeur par défaut de l'outil, jamais de l'environnement.

## Ce que l'outil écrit dans le contenu

Dans `src/content/`, l'outil écrit seulement les champs de relecture : `statut_relecture`, `relecteur` et `date_relecture` d'une mesure ou d'un statut de candidat, `verifie_le` et `verifie_par` d'une case de couverture (D-04). Il modifie ces lignes en place, sans réécrire le fichier, et vérifie après coup que rien d'autre n'a changé ; sinon il remet le fichier d'origine. Une correction de texte reste une modification manuelle du YAML, relue en PR.

## Commandes

```sh
npm run relecture -- liste --theme sante              # ce qui reste à relire, par candidat
npm run relecture -- marquer mesure <candidat>/<slug>  # relu, relecteur, date du jour (Paris)
npm run relecture -- marquer statut <candidat>
npm run relecture -- marquer case <theme> <candidat>
npm run relecture -- note mesure:<candidat>/<slug> "texte de la correction"
npm run relecture -- note --resoudre mesure:<candidat>/<slug>
```
