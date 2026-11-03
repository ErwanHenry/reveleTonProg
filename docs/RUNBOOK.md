# Runbook — reveleTonProg

## Accès

- **VPS** : `ubuntu-4gb-nbg1-2` (Hetzner), accès SSH avec la clé d'Erwan ; clé de déploiement CI dans GitHub Secrets (lot 3).
- **Repo** : https://github.com/ErwanHenry/reveleTonProg

## Commandes courantes

```bash
npm run validate          # données valides ?
npm test                  # règles éditoriales + pièges
npm run build             # génère dist/
npm run preview           # sert dist/ en local
```

### Ajouter ou corriger une mesure
1. Créer/éditer `src/content/mesures/<candidat>-<theme>-<slug>.yaml` (statut `brouillon`).
2. Archiver la source dans `archives/<candidat>/` et renseigner `source.archive`.
3. `npm run validate && npm test`, puis pull request ; passer `statut_relecture: publie` après relecture.

## Déploiement (lot 3, à venir)

GitHub Actions → `rsync -az --delete dist/ $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH`. Rollback : re-lancer le workflow sur le commit précédent.

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure (passer en `brouillon`), tracer au journal, redéployer.

### Build CI en échec
Lire la sortie de `npm run validate` : elle nomme le fichier et la règle violée.

## Contacts

- Hébergeur VPS : Hetzner — compte Erwan
- DNS : domaine à acheter (open question)
