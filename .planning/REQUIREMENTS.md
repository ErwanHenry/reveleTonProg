# Requirements: reveleTonProg

**Defined:** 2026-11-06
**Milestone:** v1.1 Lot 3 : hébergement et mise en ligne
**Core Value:** Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient — chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.

Les exigences v1.0 (53, toutes validées) sont archivées dans `milestones/v1.0-REQUIREMENTS.md`.

## v1.1 Requirements

### VPS (diagnostic et décision)

- [x] **HEB-03**: Erwan dispose d'un rapport chiffré sur le VPS (mémoire, disque, services, version de Caddy, rrsync, IPv6, ports 80/443, sauvegardes Hetzner) obtenu par un script en lecture seule versionné, avec une recommandation (libérer, monter en gamme, isoler) et sa décision écrite
- [x] **HEB-04**: Un instantané (snapshot) du VPS existe avant toute modification de la machine, et la marge libre retenue après décision est d'au moins 30 % du disque

### Domaine et configuration

- [x] **HEB-05**: Le domaine est déclaré une seule fois (`config/site.yml`) et alimente `site` Astro, l'URL canonique de chaque page, `sitemap.xml`, `robots.txt` et le bloc Caddy ; un test refuse tout nom d'hôte écrit en dur ailleurs
- [x] **HEB-06**: Un domaine provisoire (`.invalid`) fait échouer la build sous `RTP_DEPLOIEMENT=1`, comme le contact provisoire
- [x] **HEB-07**: `/version.json` indique le commit et la date de la version servie

### Serveur (Caddy, HTTPS)

- [x] **HEB-01**: Le site est servi en HTTPS sur le domaine par un bloc Caddy dédié, généré depuis la configuration et vérifié par un test de dérive, appliqué par `caddy validate` puis `reload` sans couper les autres sites du VPS
- [x] **HEB-08**: Les réponses portent des en-têtes de sécurité (CSP compatible avec la CSP par page, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`), la compression, `no-cache` sur le HTML et un cache long sur les fichiers hachés
- [x] **HEB-09**: Le journal d'accès garde au plus 14 jours, avec IP masquée (/24 en IPv4, /48 en IPv6), sans User-Agent ni Referer, et les Mentions légales décrivent exactement cette politique

### Déploiement

- [x] **HEB-02**: Un push sur `main` dont les jobs de vérification, e2e et secrets sont verts déploie la build de production reconstruite sous `RTP_DEPLOIEMENT=1` vers `releases/<sha>/` puis bascule `current` de façon atomique, avec un test de fumée après bascule
- [x] **HEB-10**: La clé de déploiement est dédiée et restreinte (utilisateur sans sudo, commande forcée), l'empreinte du serveur est épinglée, les secrets vivent dans l'Environment `production` limité à `main`, et un test de dépôt refuse `pull_request_target`, `RTP_MODE` et le déploiement d'un artefact preview
- [x] **HEB-11**: Un retour à la version précédente se fait en moins de 2 minutes par bascule de lien (`workflow_dispatch`), testé lors d'un aller-retour chronométré
- [x] **HEB-12**: Chaque déploiement en production attend l'approbation d'Erwan dans GitHub (Environment `production`)
- [x] **HEB-13**: Le workflow refuse de déployer pendant les fenêtres électorales (17 au 19 avril et 1er au 3 mai 2027), sauf retrait d'urgence documenté
- [x] **HEB-14**: Un hôte technique protégé par mot de passe reçoit les déploiements d'essai avant l'ouverture ; il est retiré à l'ouverture et le job de production ne contourne jamais la garde

### Performance (Slow 4G simulé)

- [x] **PERF-01**: Le CSS et les scripts de niveau et d'ordre sont dans chaque page, couverts par une CSP à empreintes sha256 sans `unsafe-inline` sur les scripts ; check-dist vérifie que chaque script en ligne est identique octet pour octet à sa source et que son empreinte figure dans la CSP
- [x] **PERF-02**: Un chargement à froid de la page la plus lourde tient sous 1 s sur le profil « Slow 4G simulé » (Lighthouse), le site reste complet sans JS, et Méthode, README et RUNBOOK publient ce libellé ainsi qu'une mesure réelle consignée

### Publication (contenu relu)

- [ ] **PUB-01**: Erwan relit les mesures d'un thème avec une commande qui liste ce qui reste à relire et passe une mesure en `relu` en enregistrant relecteur et date
- [ ] **PUB-02**: Un thème entièrement relu pour tous les candidats de son périmètre est publié en production ; aucun brouillon n'y apparaît (garde d'équité et liste blanche de publication)
- [x] **PUB-03**: Chaque mesure publiée affiche son relecteur et sa date de relecture
- [ ] **PUB-04**: Les sources citées par les mesures publiées ont toutes une copie Wayback, ou une exception motivée (données personnelles) acceptée par la règle

### Ouverture (juridique)

- [ ] **LEG-01**: Les Mentions légales finales portent le régime d'éditeur validé, l'hébergeur `actif`, l'adresse de contact réelle testée de bout en bout, la politique de journal et la base légale exacte du droit de réponse (vérifiée sur Légifrance)
- [x] **LEG-02**: Une relecture juridique a eu lieu avant l'ouverture, ou Erwan a consigné par écrit le risque accepté
- [x] **LEG-03**: Le RUNBOOK décrit le retrait d'urgence d'une mesure en moins d'une heure et le calendrier de gel des scrutins de 2027

### Supervision et sauvegardes

- [x] **OPS-01**: Une sonde externe vérifie que le site répond avec son contenu attendu et alerte sur Telegram après 3 échecs consécutifs, avec message de rétablissement, testée par une panne simulée
- [x] **OPS-02**: Un battement de cœur depuis le VPS alerte si la machine tombe, si le disque dépasse 85 % puis 92 %, ou si le certificat expire dans moins de 14 jours
- [x] **OPS-03**: La configuration serveur (Caddy, cron, clés autorisées, script d'installation idempotent) est dans le dépôt ou sauvegardée, et une restauration réelle a été faite avant l'ouverture, puis chaque 1er du mois

### Import de décembre

- [x] **IMP-01**: Les lectures YAML des outils d'import et d'archivage passent par un analyseur plafonné (alias, clés en double), comme content-core
- [x] **IMP-02**: La CI vérifie la cohérence entre l'instantané data.gouv et les fichiers candidats, et un piège couvre « l'import ajoute un candidat déclaré à un thème publié »
- [ ] **IMP-03**: L'import des statuts de décembre passe par une répétition à blanc puis une pull request dédiée dont le diff (nouveaux, retirés, changés) est relu par Erwan ; la production n'en est affectée qu'après relecture

### Finitions visuelles (ajoutées le 2026-11-12, décision d'Erwan « Audit puis finitions »)

- [x] **FIN-01**: Les défauts de l'audit visuel sont corrigés : page 404 en français dans la mise en page du site, plus de césure automatique dans les textes des mesures et du glossaire, survol non collant sur écran tactile, texte et barre de thème corrigés
- [x] **FIN-02**: Un lien partagé affiche titre, description et image du site (balises de partage, couleur de barre du navigateur, image de partage admise par check-dist et jamais chargée par le visiteur)
- [x] **FIN-03**: L'accueil, l'en-tête et le pied de page disent en quelques secondes ce qu'est le site et pourquoi lui faire confiance ; leurs textes sont validés par Erwan sur un aperçu avant fusion
- [x] **FIN-04** (atteint avec la cible abaissée : 24 038 px au lieu de 21 500 px, variante 2b refusée, décision d'Erwan du 2026-11-13 « Suis ton avis » ; la cible d'origine n'est pas atteinte) : La page d'un thème est plus courte et plus facile à parcourir (bloc source compact, accès direct à un candidat, grille sans grands vides), sans perdre la source ni la date, avec la validation d'Erwan pour toute règle verrouillée du contrat de design, et tous les garde-fous restent verts (accessibilité AA, 320 px, sans JS, poids, 4G, check-dist)

### Dette de l'audit v1.0

- [x] **DETTE-01**: En preview, la phrase de couverture ne présente pas des brouillons comme des positions publiées (W3)
- [x] **DETTE-02**: Un test navigateur suit le parcours par clics : niveau gardé d'une page à l'autre et après un retour arrière (W4)
- [x] **DETTE-03**: Les « Sources consultées » des cases vides donnent lien, date et extrait archivé (W10)
- [ ] **DETTE-04**: Le journal d'audit et ses empreintes sont refaits sur la build réellement mise en ligne (W8)
- [x] **DETTE-05**: Un test compare les types de vue écrits à la main aux schémas JSON (W7)

## Future Requirements

- **SOND-01** : sondages M2 (Lot 4)
- **PIPE-01** : pipeline quotidien, paliers A à D, journal public M5 (Lot 5)
- **EXP-01**, **EXT-01** : expérience M3/M4 (Lot 6), votes et extension (Lot 7)
- **DIFF-01**, **DIFF-02** : lisibilité Kandel-Moles bloquante après calibrage, feuille de style impression
- Relecture des deux autres thèmes pilotes (travail, Europe et monde) après l'ouverture
- Page de statut publique, `security.txt`, re-import par cron

## Out of Scope

| Feature | Reason |
|---------|--------|
| CDN, analytics, bandeau cookies | Vie privée : aucun service tiers, aucun cookie |
| Uptime Kuma ou Healthchecks auto-hébergés sur le VPS | RAM saturée ; une sonde sur la machine tombe avec elle |
| Docker, Ansible, runner auto-hébergé | Inutile pour un site statique, coût mémoire |
| HSTS preload dès l'ouverture | Irréversible à court terme ; HSTS simple d'abord |
| Promotion automatique brouillon vers relu | Relecture humaine obligatoire (palier C) |
| Build sur le VPS | Disque et RAM saturés ; la build se fait en CI |
| Achat du domaine, paiement Hetzner, relecture juridique | Actions d'Erwan (paiement, avis humain), suivies en piste 0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HEB-03 | Phase 6 | Complete |
| HEB-04 | Phase 6 | Complete |
| DETTE-01 | Phase 7 | Complete |
| DETTE-02 | Phase 7 | Complete |
| DETTE-03 | Phase 7 | Complete |
| DETTE-05 | Phase 7 | Complete |
| HEB-05 | Phase 7 | Complete |
| HEB-06 | Phase 7 | Complete |
| PERF-01 | Phase 7 | Complete |
| HEB-01 | Phase 8 | Complete |
| HEB-02 | Phase 8 | Complete |
| HEB-07 | Phase 8 | Complete |
| HEB-08 | Phase 8 | Complete |
| HEB-09 | Phase 8 | Complete |
| HEB-10 | Phase 8 | Complete |
| HEB-11 | Phase 8 | Complete |
| HEB-12 | Phase 8 | Complete |
| HEB-13 | Phase 8 | Complete |
| HEB-14 | Phase 8 | Complete |
| OPS-01 | Phase 8 | Complete |
| OPS-02 | Phase 8 | Complete |
| OPS-03 | Phase 8 | Complete |
| PERF-02 | Phase 8 | Complete |
| DETTE-04 | Phase 9 | Pending |
| LEG-01 | Phase 9 | Pending |
| LEG-02 | Phase 9 | Complete |
| LEG-03 | Phase 9 | Complete |
| PUB-01 | Phase 9 | Pending |
| PUB-02 | Phase 9 | Pending |
| PUB-03 | Phase 9 | Complete |
| PUB-04 | Phase 9 | Pending |
| FIN-01 | Phase 9.1 | Complete |
| FIN-02 | Phase 9.1 | Complete |
| FIN-03 | Phase 9.1 | Complete |
| FIN-04 | Phase 9.1 | Complete |
| IMP-01 | Phase 10 | Complete |
| IMP-02 | Phase 10 | Complete |
| IMP-03 | Phase 10 | Pending |

**Coverage:**

- v1.1 requirements: 38 total (34 at definition, 4 added on 2026-11-12 for Phase 9.1)
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-11-06*
