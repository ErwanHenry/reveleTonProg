# reveleTonProg

> Site pédagogique, neutre et sourcé, pour comprendre les programmes des candidats à la présidentielle française des 18 avril et 2 mai 2027, en quatre niveaux de lecture (résumé, détaillé, enfant, aîné).

## Pour qui

- Public : tout citoyen, des enfants de 8-12 ans aux retraités.
- Éditeur et owner technique : Erwan Henry (projet personnel).
- Cahier des charges : [docs/spec/CAHIER-DES-CHARGES.md](./docs/spec/CAHIER-DES-CHARGES.md).

## Stack

- [Astro](https://astro.build) 7 : site 100 % statique, zéro JS par défaut.
- Contenu en YAML dans `src/content/`, validé par JSON Schema 2020-12 à travers `src/lib/content-core` : le même code sert la CI (`scripts/validate.ts`) et le loader Astro.
- **Node 24 LTS** (décision D-5, voir [ADR](./docs/ARCHITECTURE.md)) : la version est fixée par `.nvmrc`. Avec fnm : `fnm use`, ou `fnm exec --using=24 <commande>`.
- GitHub Actions : migrate, validate, check, test, build et recherche de secrets (gitleaks) à chaque push et pull request.
- Hébergement : Caddy sur le VPS Hetzner existant (lot 3). Le domaine n'est écrit que dans `config/site.yml` ; le bloc Caddy (CSP en en-tête, journal d'accès) est généré dans `deploy/caddy/site.caddy` par `node scripts/render-caddy.ts` (procédure « Changer de domaine » du [runbook](./docs/RUNBOOK.md)).

### Dépendances

Chaque dépendance est justifiée par écrit (cahier des charges §11) :

| Paquet | Justification |
|--------|---------------|
| `astro` | Générateur imposé par le cahier des charges §8 ; sortie 100 % statique, zéro JS par défaut. |
| `ajv` | Validation JSON Schema 2020-12 exigée par §7 ; standard de fait, supporte if/then pour la règle brouillon vers publié. |
| `yaml` | Déjà présent en transitif via Astro (même version) ; déclaré pour que la CI parse le YAML exactement comme le build et donne les numéros de ligne. |
| `@astrojs/check` | Vérification de types des composants `.astro` ; outil officiel Astro. |
| `@playwright/test` | Un seul outil couvre 4 exigences testées du §10/§12 : fonctionnement sans JS, clavier, poids de page, 4G simulée. |
| `@axe-core/playwright` | Audit AA automatisé (§10, §12 « 0 erreur bloquante ») qui réutilise le Chromium de Playwright, sans second navigateur. |
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
npm run ids -- --check         # les identifiants de candidats sont-ils tous verrouillés ?
npm run build                  # génère dist/ (production : brouillons exclus)
npm run check-dist             # contrôle post-build de dist/ : poids, tiers, sources datées, cellules (la CI l'exécute après le build)
npm run preview                # sert dist/ en local
npm run dev                    # http://localhost:4321
```

Voir les brouillons (pastillés, noindex, bandeau de prévisualisation) : `RTP_MODE=preview npm run build`. Parcourir le corpus fictif des pages M1 :

```bash
node tests/helpers/corpus-m1.ts /tmp/rtp-m1
RTP_CONTENT_ROOT=/tmp/rtp-m1 RTP_MODE=preview npm run dev
```

### Tests navigateur

```bash
npx playwright install chromium   # une seule fois (télécharge le navigateur)
npm run e2e                       # construit la fixture et le vrai corpus, puis lance Playwright, axe et la 4G simulée
npm run e2e -- --jeu m1 -- e2e/axe.spec.ts   # un seul jeu de données, un seul fichier de test
```

Les tests navigateur (sans JS, clavier, WCAG 2.2 AA avec axe, bloquant sur les violations `serious` et `critical`, 160 %, sans animation, chargement à froid sur deux connexions lentes simulées, vie privée ; profils et budgets dans `src/lib/profil-4g.ts` : moins de 1 s à 150 ms de latence par requête, moins de 1 s aussi avec le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse)) ne font **pas** partie de `npm test`. Ne jamais lancer `npm test` et `npm run e2e` en même temps dans le même dossier : les deux exécutent `astro build` et partagent le cache `.astro`. La CI les exécute dans un job séparé (`e2e`).

### URL de test (livrable du lot 2)

Rien n'est hébergé avant le lot 3. La build de test est l'artefact de la CI :

1. Sur GitHub, onglet Actions, ouvrir la dernière exécution du workflow `CI` sur `main`.
2. Télécharger l'artefact `site-preview` (un zip, conservé 14 jours) et le décompresser dans un dossier.
3. Le servir avec compression comme en production : `node e2e/serveur.ts <dossier> 4173`, puis ouvrir http://127.0.0.1:4173/.

Sans passer par GitHub : `RTP_MODE=preview npm run build -- --outDir dist-preview`, puis le même serveur sur `dist-preview`. La build preview est `noindex` et affiche les brouillons pastillés.

### Règles éditoriales, mode de validation et identifiants

`npm run validate` applique les règles éditoriales (source primaire archivée, mots interdits, longueurs, chiffres et citations, sondages, équité) et indique pour chaque refus le fichier, la ligne et un code stable ; la liste des codes et la marche à suivre sont dans le [runbook](./docs/RUNBOOK.md#codes-du-validateur).

- **Mode `production` (défaut)** : toutes les règles bloquent. **C'est le seul mode de la CI**, qui passe `--mode production` à chaque étape `validate`.
- **Mode `preview`** (poste local, pour rédiger pas à pas) : `npm run validate -- --mode preview`. Seule l'équité entre candidats devient un avertissement ; tout le reste continue de bloquer. Même effet avec `RTP_MODE=preview npm run validate` ; le drapeau `--mode` l'emporte sur `RTP_MODE`, et une valeur inconnue est refusée.
- **Verrouiller l'identifiant d'un candidat** : dès qu'un fichier `candidats/<id>.yaml` existe, lancer `npm run ids -- --write` pour l'ajouter à `ids.lock` (fichier à ajout seul), puis commiter les deux. Ne jamais renommer ni supprimer une ligne : la CI compare `ids.lock` au commit de base et refuse toute ligne retirée.

### Racine du contenu : `RTP_CONTENT_ROOT`

Les commandes lisent le contenu dans la racine indiquée par la variable `RTP_CONTENT_ROOT`. Par défaut (variable absente ou vide), la racine est `.` : le **vrai corpus** (`src/content/`, 59 candidats importés, 3 thèmes pilotes en brouillon). Le corpus fictif de test s'obtient explicitement : `RTP_CONTENT_ROOT=tests/fixtures/corpus-valide npm run validate`. Pour voir les brouillons dans le site : `RTP_MODE=preview npm run build`.

### Données : import, archives, couverture

- `npm run import:datagouv` importe les 59 personnalités du jeu data.gouv « statuts sourcés » en fiches candidats (voir [data/import/README.md](./data/import/README.md)).
- `npm run archive -- <url> --candidat … --source-id …` archive une source primaire (extrait texte et sha256 dans `archives/`, binaire dans le dépôt privé `ErwanHenry/reveleTonProg-archives`, désigné par `RTP_ARCHIVES_DIR` ; Wayback en corroboration).
- `npm run couverture -- --check-data` recalcule la couverture des thèmes et le choix des trois thèmes pilotes ([docs/COUVERTURE-THEMES.md](./docs/COUVERTURE-THEMES.md)).
- Tout le contenu pilote est en `brouillon` : la relecture s'ouvre via `pilote.relecture_ouverte` (voir le runbook, « Ouvrir la relecture »).

### Style YAML canonique

- 2 espaces d'indentation, séquences indentées sous leur clé (voir `.editorconfig`).
- Dans les fichiers qui ne sont pas du contenu (CI, configuration) : un espace avant `#`.
- **Aucun commentaire dans les fichiers de contenu** (décision D-13) : les remarques de relecture vont dans les pull requests.
- Les dates non quotées (`2026-10-15`) sont lues comme des chaînes, jamais comme des dates YAML.
- Quoter toute valeur qui ressemble à un nombre (`"010"`) : YAML 1.2 lirait `010` comme le nombre 10 et le schéma refuserait la valeur.

## Où sont les secrets

Aucun secret dans le dépôt : `.env` est ignoré par Git, `.env.example` ne contient que des noms de variables, et gitleaks parcourt tout l'historique à chaque CI. Les secrets de la mise en ligne (Phase 8) vivent aux endroits suivants, et leur valeur n'est écrite nulle part ailleurs :

- **GitHub, Environment `production`** (approbation d'Erwan à chaque run, branche `main` seulement) : secrets `DEPLOY_SSH_KEY` (clé de déploiement, limitée à une commande forcée sur le serveur), `DEPLOY_SMOKE_USER` et `DEPLOY_SMOKE_PASS` (identifiants du test de fumée). Variables non secrètes : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS` (empreinte épinglée du serveur) et `DEPLOY_URL`.
- **GitHub, Environment `sonde`** (sans relecteur, branche `main` seulement) : secrets `SONDE_USER` et `SONDE_PASS` (identifiants de la sonde) et `SONDE_PING_URL` (adresse de ping Healthchecks). Les variables de dépôt `DEPLOY_CIBLE` et `SONDE_URL` ne sont pas secrètes.
- **Serveur, fichiers lisibles par root seul (0600)** : `/opt/vaultwarden/.env` (les deux empreintes bcrypt de l'hôte d'essai), `/etc/rtp/battement.env` et `/etc/rtp/restauration.env` (adresses de ping Healthchecks, identifiants de la sonde pour le battement).
- **Vaultwarden** (coffre `reveleTonProg`) : mots de passe en clair des utilisateurs `essai` et `sonde`, clé privée de déploiement, copies des trois fichiers du serveur et des adresses de ping. Copies de travail sur le Mac dans `~/.config/rtp/` (0600), hors de tout dépôt.

Procédures : `docs/RUNBOOK.md`, sections « Environments GitHub » et « Restauration ».

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

🟢 Actif — livrable du lot 2 : pages Méthode, Mentions légales et Qui sommes-nous, tests navigateur en CI, build de test en artefact `site-preview`. Dernière revue hygiène : 2026-11-03.
