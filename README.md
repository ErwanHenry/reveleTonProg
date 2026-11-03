# reveleTonProg

> Site pédagogique, neutre et sourcé, pour comprendre les programmes des candidats à la présidentielle française des 18 avril et 2 mai 2027, en quatre niveaux de lecture (résumé, détaillé, enfant, aîné).

## Pour qui

- Public : tout citoyen, des enfants de 8-12 ans aux retraités.
- Éditeur et owner technique : Erwan Henry (projet personnel, non rattaché à Alignd ni SpikeeLabs).
- Cahier des charges : [docs/spec/CAHIER-DES-CHARGES.md](./docs/spec/CAHIER-DES-CHARGES.md).

## Stack

- [Astro](https://astro.build) — site 100 % statique, zéro JS par défaut, îlots pour les parties interactives
- Contenu en YAML dans `src/content/` (candidats, thèmes, mesures, sondages), validé par JSON Schema
- Node 20+, GitHub Actions (validation + build + déploiement rsync)
- Hébergement : Caddy sur le VPS Hetzner existant (lot 3)

## Lancer en local

```bash
npm install
npm run validate   # vérifie les données (schémas + règles éditoriales)
npm test           # tests des règles éditoriales et des pièges
npm run dev        # http://localhost:4321
npm run build      # site statique dans dist/
```

## Où sont les secrets

Aucun secret pour l'instant. Au lot 3, la clé SSH de déploiement vivra dans **GitHub Secrets** (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`) et en copie dans **Vaultwarden** (coffre `reveleTonProg`). Rien dans le dépôt.

## Liens

- Architecture : [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Runbook : [docs/RUNBOOK.md](./docs/RUNBOOK.md)
- Rétrospectives : [docs/RETROSPECTIVE.md](./docs/RETROSPECTIVE.md)
- Planification GSD : [.planning/](./.planning/)
- Repo : https://github.com/ErwanHenry/reveleTonProg

## État

🟢 Actif — lots 1 et 2 en cours. Dernière revue hygiène : 2026-11-03.
