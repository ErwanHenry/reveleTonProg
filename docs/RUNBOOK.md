# Runbook — reveleTonProg

## Accès

- **VPS** : `ubuntu-4gb-nbg1-2` (Hetzner), accès SSH avec la clé d'Erwan ; clé de déploiement CI dans GitHub Secrets (lot 3).
- **Repo** : https://github.com/ErwanHenry/reveleTonProg
- **Archives binaires** : dépôt privé `reveleTonProg-archives`.

## Node 24

Le projet tourne sous Node 24 LTS (`.nvmrc`). Avec fnm : `fnm use`, ou pour une seule commande `fnm exec --using=24 npm test`. Pour en faire le défaut de la machine : `fnm default 24`. Si `node -v` n'affiche pas 24 alors que fnm l'annonce installé, réparer l'installation (`fnm install 24`) plutôt que de contourner la version : `engine-strict` refuse un Node plus ancien.

`.npmrc` pose aussi `ignore-scripts=true` : `npm ci` n'exécute aucun script d'installation de dépendance (surface d'attaque supply-chain sur les PR de forks). Si un paquet en exige un un jour, lancer `npm rebuild <paquet>` explicitement et le justifier dans la PR.

## Commandes courantes

```bash
npm run validate                  # données valides ? (racine : RTP_CONTENT_ROOT)
npm run check                     # astro check : types
npm run migrate -- --check        # le contenu est-il au dernier schéma ?
npm run migrate -- --write        # applique les migrations de schéma
npm test                          # tests (TZ=Europe/Paris)
npm run build                     # génère dist/
npm run preview                   # sert dist/ en local
```

Par défaut ces commandes lisent la fixture fictive `tests/fixtures/corpus-valide`. Ajouter `RTP_CONTENT_ROOT=.` pour viser le vrai corpus.

### Ajouter ou corriger une mesure
1. Créer/éditer `src/content/mesures/<candidat>/<slug>.yaml` (statut `brouillon`), sans commentaire dans le fichier (D-13).
2. Déposer l'extrait texte de la source dans `archives/<candidat>/<sha12>.txt`, puis créer `src/content/sources/<id>.yaml` avec `archive.sha256` (hash du `.txt`), la date de capture et, si possible, `archive.wayback_url`. Le PDF ou le HTML rendu va dans le dépôt privé `reveleTonProg-archives`.
3. `npm run validate && npm test`, puis pull request ; passer `statut_relecture: publie` après relecture.

### Lire un diagnostic

Chaque erreur de validation a la forme :

```
fichier:ligne:col CODE message (pointeur)
```

Exemple : `src/content/candidats/marie-fictive.yaml:12:5 SCHEMA_REQUIRED propriété requise manquante (/statuts/0/motif)`. Le fichier, la ligne et la colonne désignent l'endroit à corriger ; le pointeur donne le chemin JSON dans le fichier.

Dans GitHub Actions, la sortie `--format github` produit des annotations sur les fichiers, **limitées à 10 par étape** : la liste complète est toujours dans le journal de l'étape.

## Déploiement (lot 3, à venir)

GitHub Actions → `rsync -az --delete dist/ $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH`. Rollback : re-lancer le workflow sur le commit précédent.

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure (passer en `brouillon`), tracer au journal, redéployer.

### Build CI en échec
Ouvrir l'exécution du workflow `CI`. Deux jobs tournent en parallèle :
- `verifier` : lire l'étape en rouge (`migrate`, `validate`, `check`, `test` ou `build`). Les étapes s'arrêtent à la première erreur ; la sortie de `npm run validate` nomme le fichier et la règle violée. Reproduire en local avec la même commande.
- `secrets` : gitleaks a trouvé un secret dans l'historique. Ne rien pousser de plus, **révoquer le secret** chez son émetteur, puis traiter l'historique. Faux positif confirmé : ajouter une exception ciblée (motif exact, jamais un dossier entier) dans `.gitleaks.toml`.

### Droit de réponse

À compléter au lot 3 (décision D-4) : adresse de contact dédiée (alias, sans adresse personnelle), délai de réponse et procédure d'un droit de réponse ou d'une demande de retrait. Rien n'est publié tant que ce paragraphe est vide.

## Restauration

- Le contenu est sauvegardé par Git (dépôt GitHub distant) : cloner le dépôt suffit.
- Les binaires d'archives sont dans le dépôt privé `reveleTonProg-archives` (à cloner à côté si besoin).
- Le site se reconstruit entièrement avec `npm ci && npm run build`.

## Monitoring

Pas de service à surveiller avant l'hébergement : le monitoring (Uptime Kuma ou Healthchecks.io, alerte Telegram) démarre avec le lot 3.

## Réglages de sécurité GitHub (action utilisateur, une fois)

Ces réglages sont à faire par Erwan dans l'interface GitHub ; aucun script ni aucun plan ne les modifie par l'API.

1. Ouvrir https://github.com/ErwanHenry/reveleTonProg/settings/security_analysis (**Settings > Code security**).
2. Activer **Dependabot alerts** (obligatoire pour être alerté des vulnérabilités).
3. Optionnel : activer **Dependabot security updates** et **secret scanning push protection**.
4. Vérifier : `gh api repos/ErwanHenry/reveleTonProg/vulnerability-alerts --silent` (code de sortie 0 = activé).

Les mises à jour de versions de Dependabot n'ont besoin d'aucun réglage : `.github/dependabot.yml` sur `main` suffit (hebdomadaire, lundi 6 h Paris, cooldown de 7 jours).

## Revue mensuelle d'hygiène (15 min, notes dans RETROSPECTIVE.md)

- Mettre à jour le pin gitleaks : nouvelle version et sha256 pris dans `gitleaks_<version>_checksums.txt` (ligne `linux_x64`), à reporter dans `GITLEAKS_VERSION` et `GITLEAKS_SHA256` de `.github/workflows/ci.yml`. Dependabot ne le fait pas.
- Relire les pull requests Dependabot (cooldown de 7 jours, 14 pour les versions majeures) et le groupe `astro`.
- Revérifier les SHA des actions épinglées (un commentaire `# vX` à côté de chaque `uses:`).
- Tester une restauration (cloner le dépôt, `npm ci && npm run build`) le 1er du mois.

## Contacts

- Hébergeur VPS : Hetzner — compte Erwan
- DNS : domaine à acheter (open question)
