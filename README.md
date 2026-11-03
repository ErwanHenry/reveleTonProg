# reveleTonProg

> Site pédagogique, neutre et sourcé, pour comprendre les programmes des candidats à la présidentielle française des 18 avril et 2 mai 2027, en quatre niveaux de lecture (résumé, détaillé, enfant, aîné).

## Pour qui

- Public : tout citoyen, des enfants de 8-12 ans aux retraités.
- Éditeur et owner technique : Erwan Henry (projet personnel, non rattaché à Alignd ni SpikeeLabs).
- Cahier des charges : [docs/spec/CAHIER-DES-CHARGES.md](./docs/spec/CAHIER-DES-CHARGES.md).

## Stack

- [Astro](https://astro.build) 7 : site 100 % statique, zéro JS par défaut.
- Contenu en YAML dans `src/content/`, validé par JSON Schema 2020-12 à travers `src/lib/content-core` : le même code sert la CI (`scripts/validate.ts`) et le loader Astro.
- **Node 24 LTS** (décision D-5, voir [ADR](./docs/ARCHITECTURE.md)) : la version est fixée par `.nvmrc`. Avec fnm : `fnm use`, ou `fnm exec --using=24 <commande>`.
- GitHub Actions : migrate, validate, check, test, build et recherche de secrets (gitleaks) à chaque push et pull request.
- Hébergement : Caddy sur le VPS Hetzner existant (lot 3).

### Dépendances

Chaque dépendance est justifiée par écrit (cahier des charges §11) :

| Paquet | Justification |
|--------|---------------|
| `astro` | Générateur imposé par le cahier des charges §8 ; sortie 100 % statique, zéro JS par défaut. |
| `ajv` | Validation JSON Schema 2020-12 exigée par §7 ; standard de fait, supporte if/then pour la règle brouillon vers publié. |
| `yaml` | Déjà présent en transitif via Astro (même version) ; déclaré pour que la CI parse le YAML exactement comme le build et donne les numéros de ligne. |
| `@astrojs/check` | Vérification de types des composants `.astro` ; outil officiel Astro. |
| `typescript` | Pair obligatoire d'`@astrojs/check` (peer `^5 \|\| ^6`). |
| `@types/node` | Types Node 24 pour les scripts de validation exécutés en TypeScript natif. |

Tout le reste utilise la bibliothèque standard de Node (`node:test`, `node:fs`, `node:crypto`, `Intl.Segmenter`).

## Lancer en local

```bash
fnm use                # Node 24 (lit .nvmrc)
npm install && npm run validate && npm test && npm run build
```

Commandes complémentaires :

```bash
npm run check                  # astro check : types des .astro et des scripts
npm run migrate -- --check     # le contenu est-il au dernier schéma ?
npm run preview                # sert dist/ en local
npm run dev                    # http://localhost:4321
```

### Racine du contenu : `RTP_CONTENT_ROOT`

Les commandes lisent le contenu dans la racine indiquée par la variable `RTP_CONTENT_ROOT`. Par défaut, il s'agit de la **fixture fictive** `tests/fixtures/corpus-valide` (aucun vrai candidat), jusqu'à l'import réel de la phase 3. `RTP_CONTENT_ROOT=. npm run validate` vise le vrai corpus (`src/content/`), encore vide.

### Style YAML canonique

- 2 espaces d'indentation, séquences indentées sous leur clé (voir `.editorconfig`).
- Dans les fichiers qui ne sont pas du contenu (CI, configuration) : un espace avant `#`.
- **Aucun commentaire dans les fichiers de contenu** (décision D-13) : les remarques de relecture vont dans les pull requests.
- Les dates non quotées (`2026-10-15`) sont lues comme des chaînes, jamais comme des dates YAML.
- Quoter toute valeur qui ressemble à un nombre (`"010"`) : YAML 1.2 lirait `010` comme le nombre 10 et le schéma refuserait la valeur.

## Où sont les secrets

Aucun secret pour l'instant. Au lot 3, la clé SSH de déploiement vivra dans **GitHub Secrets** (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`) et en copie dans **Vaultwarden** (coffre `reveleTonProg`). Rien dans le dépôt : `.env` est ignoré par Git, `.env.example` ne contient que des noms de variables.

## Réglages GitHub à activer (action utilisateur)

Une seule fois, par Erwan, dans le dépôt GitHub : **Settings > Code security** : activer **Dependabot alerts** (obligatoire pour être alerté des vulnérabilités) ; optionnellement **Dependabot security updates** et **secret scanning push protection**. Aucun script ne modifie ces réglages. Détail et commande de vérification : section « Réglages de sécurité GitHub » du [runbook](./docs/RUNBOOK.md).

## Liens

- Architecture et décisions (ADR) : [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Runbook : [docs/RUNBOOK.md](./docs/RUNBOOK.md)
- Rétrospectives : [docs/RETROSPECTIVE.md](./docs/RETROSPECTIVE.md)
- Licences : [LICENSE](./LICENSE) (code MIT, contenu Licence Ouverte 2.0, archives exclues)
- Planification GSD : [.planning/](./.planning/)
- Repo : https://github.com/ErwanHenry/reveleTonProg

## État

🟢 Actif — lots 1 et 2 en cours. Dernière revue hygiène : 2026-11-03.
