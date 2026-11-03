# Audit croisé simulé

Ce dossier contient ce qui sert à faire lire le site par des agents qui jouent des lecteurs (enfant, retraité, journaliste) et à garder la trace de ce qu'ils ont lu.

## Contenu

- `personas/` : un brief par lecteur simulé. C'est la seule chose donnée à l'agent testé.
- `journal.jsonl` : écrit uniquement par `scripts/audit-lire.ts`, une ligne par lecture. Il est créé lors de la passe d'audit.

Le scénario, les résultats attendus et la grille de notation sont dans `docs/AUDIT-TEST-CROISE.md`. Ils ne sont jamais donnés aux agents testés.

## Lecteur

```
node scripts/audit-lire.ts --dist <dossier> --liste
node scripts/audit-lire.ts --dist <dossier> --persona <id> [--niveau resume|detaille|enfant|aine] <chemin>
node scripts/audit-lire.ts --dist <dossier> --empreinte
```

Le lecteur est en lecture seule sur le dossier construit, n'utilise pas le réseau, et refuse tout chemin hors du dossier (code de sortie 2).

## Format du journal

Une ligne JSON par lecture, avec exactement ces clés :

| Clé | Contenu |
|---|---|
| `horodatage` | date et heure ISO 8601 |
| `persona` | identifiant court (a-z, 0-9, tiret) |
| `chemin` | chemin de la page lue, ou `--liste` |
| `niveau` | `resume`, `detaille`, `enfant`, `aine`, ou `null` |
| `sha256` | empreinte du HTML servi |
| `octets` | taille du HTML servi |

## Règle

Aucune donnée personnelle, aucun secret, aucun jeton dans ce dossier, ni dans le journal, ni dans les briefs.
