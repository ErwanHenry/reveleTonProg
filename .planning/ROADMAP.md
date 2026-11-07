# Roadmap: reveleTonProg

## Milestones

- ✅ **v1.0 Lots 1 et 2 : squelette, données, référentiel M1** — Phases 1-5 (shipped 2026-11-04)
- 🚧 **v1.1 Lot 3 : hébergement et mise en ligne** : Phases 6-10 (en cours, jalon spec : lots 1 à 3 avant le 2026-12-15)

## Phases

<details>
<summary>✅ v1.0 Lots 1 et 2 (Phases 1-5) — SHIPPED 2026-11-04</summary>

- [x] Phase 1: Fondations, schémas v1 et content-core (7/7 plans) — completed 2026-11-03
- [x] Phase 2: Règles éditoriales et pièges (7/7 plans) — completed 2026-11-03
- [x] Phase 3: Import data.gouv et corpus pilote (9/9 plans) — completed 2026-11-04
- [x] Phase 4: Référentiel M1 et 4 niveaux de lecture (9/9 plans) — completed 2026-11-03
- [x] Phase 5: Pages institutionnelles, qualité et URL de test (8/8 plans) — completed 2026-11-04

Détail complet : [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) ; exigences : [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) ; audit : [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

</details>

### 🚧 v1.1 Lot 3 : hébergement et mise en ligne

- [ ] **Phase 6: Diagnostic du VPS et décision** : rapport chiffré en lecture seule, snapshot, décision écrite d'Erwan
- [x] **Phase 7: Domaine paramétré, inlining et dette** : domaine unique en configuration, CSS et scripts dans la page avec CSP à empreintes, dette W3, W4, W10, W7 (completed 2026-11-07)
- [ ] **Phase 8: Serveur, pipeline, supervision et sauvegardes** : Caddy en HTTPS, déploiement atomique avec retour arrière, hôte technique protégé, alertes, restauration réelle
- [ ] **Phase 9: Contenu relu, juridique et ouverture** : un thème relu publié, Mentions légales finales, journal d'audit refait, ouverture publique vers le 5 décembre
- [ ] **Phase 10: Import de décembre** : analyseur plafonné, cohérence de l'instantané, import des statuts en pull request relue (10 au 13 décembre, gel du 13 au 15)

## Piste 0 (Erwan, hors code)

Actions humaines qui conditionnent le code. Dates proposées pour tenir le 2026-12-15 ; elles sont les dernières dates acceptables, pas des objectifs.

| Action | Débloque | Au plus tard | Remarque |
|---|---|---|---|
| Décider du VPS (libérer, monter en gamme ou isoler) après lecture du rapport | Phase 8 | 2026-11-13 | Le rapport sort de la Phase 6 ; sans décision, aucun déploiement |
| Acheter le domaine et poser le DNS (A et AAAA, apex et www) | Phase 8 (HTTPS, hôte technique), `config/site.yml` | 2026-11-16 | Prévoir la propagation avant la demande de certificat ; éviter plus de 5 certificats identiques par 7 jours |
| Envoyer l'identité d'éditeur à Hetzner et garder la preuve datée | `hebergeur.yml` en `actif`, Phase 9 | 2026-11-16 | Condition des Mentions légales finales |
| Créer l'Environment `production` (relecteur requis, limité à `main`), déposer les secrets et l'empreinte du serveur | Phase 8 | 2026-11-20 | Rien n'est stocké dans le dépôt |
| Relire un thème complet (santé) pour tous les candidats du périmètre, environ 3 à 4 h | Phase 9 (PUB-02) | début 2026-11-23, fin 2026-12-01 | Un thème complet vaut mieux que trois thèmes partiels |
| Solliciter un juriste (régime d'éditeur, base du droit de réponse, journaux, localStorage) | LEG-02 | demande 2026-11-13, avis 2026-12-02 | À défaut d'avis à temps, consigner par écrit le risque accepté au plus tard le 2026-12-03 |
| Tester l'adresse de contact réelle de bout en bout | LEG-01 | 2026-11-27 | Envoi et réponse depuis l'extérieur |
| Approuver le premier déploiement sur l'hôte technique, puis chaque déploiement en production | HEB-12, HEB-14 | essai technique vers 2026-11-27 ; ouverture vers 2026-12-05 | Approbation dans GitHub, un clic par déploiement |
| Relire le diff d'import des statuts et l'approuver | Phase 10 | 2026-12-13 | Gel des changements du 13 au 15 |

## Phase Details

### Phase 6: Diagnostic du VPS et décision

**Goal**: Erwan sait précisément ce que le VPS peut porter et a tranché par écrit, sans que la machine ait été modifiée avant un instantané.
**Depends on**: Nothing (première phase de v1.1, en parallèle de la Phase 7)
**Requirements**: HEB-03, HEB-04
**Success Criteria** (what must be TRUE):

  1. Erwan lance un script versionné en lecture seule et obtient un rapport chiffré (mémoire, disque, services, version de Caddy, rrsync, IPv6, ports 80 et 443, sauvegardes Hetzner) sans qu'aucune commande n'ait modifié la machine.
  2. Le rapport se termine par une recommandation (libérer, monter en gamme ou isoler) et la décision d'Erwan est consignée par écrit dans le dépôt.
  3. Un instantané du VPS existe et sa date précède toute modification de la machine.
  4. Après la décision, la marge de disque libre retenue est d'au moins 30 %, mesurée et consignée.

**Plans**: TBD

### Phase 7: Domaine paramétré, inlining et dette

**Goal**: Le site se construit pour n'importe quel domaine déclaré une seule fois, charge vite avec CSS et scripts dans la page sous une CSP stricte, et les dettes de l'audit v1.0 qui ne dépendent d'aucun serveur sont soldées.
**Depends on**: Nothing (aucune dépendance externe, en parallèle de la Phase 6)
**Requirements**: HEB-05, HEB-06, PERF-01, DETTE-01, DETTE-02, DETTE-03, DETTE-05
**Success Criteria** (what must be TRUE):

  1. Changer le domaine dans `config/site.yml` modifie l'URL canonique de chaque page, `sitemap.xml`, `robots.txt` et le bloc Caddy généré ; un test échoue si un nom d'hôte est écrit en dur ailleurs.
  2. Une build sous `RTP_DEPLOIEMENT=1` avec le domaine provisoire `.invalid` échoue avec un message clair, comme pour le contact provisoire.
  3. Chaque page contient son CSS et ses scripts de niveau et d'ordre ; check-dist prouve que chaque script en ligne est identique à sa source et que son empreinte sha256 figure dans la CSP, sans `unsafe-inline` sur les scripts ; le site reste complet avec JS désactivé.
  4. Un test navigateur suit le parcours par clics et prouve que le niveau de lecture est gardé d'une page à l'autre et après un retour arrière.
  5. En preview, la phrase de couverture ne présente plus de brouillons comme des positions publiées ; les « Sources consultées » des cases vides donnent lien, date et extrait archivé ; un test compare les types de vue aux schémas JSON.

**Plans**: 8 plans (4 waves)

Plans:

- [x] 07-01-PLAN.md — CSS et scripts dans la page, CSP meta à empreintes, règles check-dist à empreintes (vague 1)
- [x] 07-02-PLAN.md — Dette W7 (types contre schémas), W3 (phrase de couverture en preview), W10 (sources consultées complètes) (vague 1)
- [x] 07-03-PLAN.md — Cas dist réécrits pour la forme en ligne, cas CSP avec mutations (vague 2)
- [x] 07-04-PLAN.md — Domaine dans config/site.yml : site, canonique, sitemap, robots, build refusée sous RTP_DEPLOIEMENT=1 (vague 2)
- [x] 07-05-PLAN.md — Navigateur : zéro violation CSP avec et sans JS, parcours et bfcache, 4G après inlining (vague 2)
- [x] 07-06-PLAN.md — check-dist : canonique, sitemap, robots, DOMAINE_PROVISOIRE ; garde anti nom d'hôte en dur (vague 3)
- [x] 07-07-PLAN.md — Bloc Caddy rendu depuis la configuration et test de dérive (vague 3)
- [x] 07-08-PLAN.md — ADR-053, ADR-056, note ADR-051, RUNBOOK, README, porte complète avec npm run e2e et CI (vague 4)

**UI hint**: yes

### Phase 8: Serveur, pipeline, supervision et sauvegardes

**Goal**: Chaque push validé sur `main` peut être déployé en HTTPS par Caddy, avec approbation d'Erwan, retour arrière en moins de 2 minutes, alertes Telegram et restauration éprouvée, d'abord sur un hôte technique protégé.
**Depends on**: Phase 6 (décision VPS), Phase 7 (domaine paramétré, inlining), domaine acheté et DNS posé (piste 0)
**Requirements**: HEB-01, HEB-02, HEB-07, HEB-08, HEB-09, HEB-10, HEB-11, HEB-12, HEB-13, HEB-14, PERF-02, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):

  1. Le site répond en HTTPS sur l'hôte technique protégé par mot de passe avec en-têtes de sécurité, compression, `no-cache` sur le HTML et cache long sur les fichiers hachés ; le bloc Caddy appliqué par `caddy validate` puis `reload` n'a coupé aucun autre site du VPS ; `/version.json` donne le commit et la date servis.
  2. Un push sur `main` aux jobs verts reconstruit la build sous `RTP_DEPLOIEMENT=1`, attend l'approbation d'Erwan, publie dans `releases/<sha>/`, bascule `current` de façon atomique et passe un test de fumée ; la clé est restreinte, l'empreinte du serveur épinglée, et un test de dépôt refuse `pull_request_target`, `RTP_MODE` et tout artefact preview.
  3. Un retour à la version précédente par `workflow_dispatch` prend moins de 2 minutes, chronométré lors d'un aller-retour ; le workflow refuse de déployer du 17 au 19 avril et du 1er au 3 mai 2027 hors retrait d'urgence documenté.
  4. La page la plus lourde charge à froid en moins de 1 s sur le profil « Slow 4G simulé » (Lighthouse), le libellé et une mesure réelle sont publiés dans Méthode, README et RUNBOOK ; le journal d'accès est plafonné à 14 jours, IP masquée, sans User-Agent ni Referer.
  5. Une panne simulée déclenche l'alerte Telegram après 3 échecs puis un message de rétablissement ; le battement de cœur du VPS alerte sur machine tombée, disque à 85 % puis 92 % et certificat à moins de 14 jours.
  6. Le script d'installation idempotent et la configuration serveur sont dans le dépôt, et une restauration réelle a été faite avant l'ouverture.

**Plans**: TBD

### Phase 9: Contenu relu, juridique et ouverture

**Goal**: Le site ouvre au public avec un thème entièrement relu par Erwan, des Mentions légales finales validées, et un journal d'audit refait sur la build réellement en ligne (cible : vers le 2026-12-05).
**Depends on**: Phase 8
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, LEG-01, LEG-02, LEG-03, DETTE-04
**Success Criteria** (what must be TRUE):

  1. Erwan relit un thème avec une commande qui liste ce qui reste à relire et passe chaque mesure en `relu` en enregistrant relecteur et date ; chaque mesure publiée affiche son relecteur et sa date de relecture.
  2. Le site en production n'affiche que le thème entièrement relu pour tous les candidats de son périmètre : aucun brouillon n'y apparaît, et la garde d'équité et la liste blanche refusent toute autre publication.
  3. Chaque source citée par une mesure publiée a une copie Wayback, ou une exception motivée (données personnelles) acceptée par la règle.
  4. Les Mentions légales finales portent le régime d'éditeur validé, l'hébergeur `actif`, un contact réel testé de bout en bout, la politique de journal exacte et la base légale du droit de réponse vérifiée sur Légifrance ; une relecture juridique a eu lieu, ou Erwan a consigné par écrit le risque accepté.
  5. Le RUNBOOK décrit le retrait d'urgence d'une mesure en moins d'une heure et le calendrier de gel des scrutins de 2027 ; le journal d'audit et ses empreintes sont refaits sur la build déployée, puis le site est ouvert avec l'hôte technique retiré.

**Plans**: TBD

### Phase 10: Import de décembre

**Goal**: Les statuts de candidats de décembre entrent dans le dépôt par une pull request relue, sans jamais modifier la production avant relecture d'Erwan.
**Depends on**: Phase 9 (site ouvert) ; IMP-01 peut démarrer avant
**Requirements**: IMP-01, IMP-02, IMP-03
**Success Criteria** (what must be TRUE):

  1. Les outils d'import et d'archivage lisent le YAML par l'analyseur plafonné de content-core : un fichier avec alias excessifs ou clés en double est refusé avec un message clair.
  2. La CI échoue si l'instantané data.gouv et les fichiers candidats sont incohérents, et un piège prouve que « l'import ajoute un candidat déclaré à un thème publié » est détecté.
  3. Une répétition à blanc produit un diff (nouveaux, retirés, changés) puis l'import réel du 10 au 13 décembre passe par une pull request dédiée qu'Erwan relit ; la production n'est affectée qu'après cette relecture, avant le gel du 13 au 15.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 1. Fondations, schémas v1 et content-core | v1.0 | 7/7 | Complete | 2026-11-03 |
| 2. Règles éditoriales et pièges | v1.0 | 7/7 | Complete | 2026-11-03 |
| 3. Import data.gouv et corpus pilote | v1.0 | 9/9 | Complete | 2026-11-04 |
| 4. Référentiel M1 et 4 niveaux de lecture | v1.0 | 9/9 | Complete | 2026-11-03 |
| 5. Pages institutionnelles, qualité et URL de test | v1.0 | 8/8 | Complete | 2026-11-04 |
| 6. Diagnostic du VPS et décision | v1.1 | 0/0 | Not started | - |
| 7. Domaine paramétré, inlining et dette | v1.1 | 8/8 | Complete   | 2026-11-07 |
| 8. Serveur, pipeline, supervision et sauvegardes | v1.1 | 0/0 | Not started | - |
| 9. Contenu relu, juridique et ouverture | v1.1 | 0/0 | Not started | - |
| 10. Import de décembre | v1.1 | 0/0 | Not started | - |
