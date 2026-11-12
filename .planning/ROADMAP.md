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

- [x] **Phase 6: Diagnostic du VPS et décision** : rapport chiffré en lecture seule, snapshot, décision écrite d'Erwan (completed 2026-11-08)
- [x] **Phase 7: Domaine paramétré, inlining et dette** : domaine unique en configuration, CSS et scripts dans la page avec CSP à empreintes, dette W3, W4, W10, W7 (completed 2026-11-07)
- [x] **Phase 8: Serveur, pipeline, supervision et sauvegardes** : Caddy en HTTPS, déploiement atomique avec retour arrière, hôte technique protégé, alertes, restauration réelle (completed 2026-11-10)
- [ ] **Phase 9: Contenu relu, juridique et ouverture** : un thème relu publié, Mentions légales finales, journal d'audit refait, ouverture publique vers le 5 décembre
- [ ] **Phase 9.1: Finitions visuelles avant l'ouverture** (INSÉRÉE le 2026-11-12) : défauts de l'audit visuel corrigés, page 404, balises et image de partage, accueil, en-tête, pied de page et page thème retouchés avec validation d'Erwan sur un aperçu ; à faire entrer avant la publication (09-11)
- [ ] **Phase 10: Import de décembre** : analyseur plafonné, cohérence de l'instantané, import des statuts en pull request relue (10 au 13 décembre, gel du 13 au 15)

## Piste 0 (Erwan, hors code)

Actions humaines qui conditionnent le code. Dates proposées pour tenir le 2026-12-15 ; elles sont les dernières dates acceptables, pas des objectifs.

| Action | Débloque | Au plus tard | Remarque |
|---|---|---|---|
| Décider du VPS (libérer, monter en gamme ou isoler) après lecture du rapport | Phase 8 | 2026-11-13 | Le rapport sort de la Phase 6 ; sans décision, aucun déploiement |
| Acheter le domaine et poser le DNS (A et AAAA, apex et www) | Phase 8 (HTTPS, hôte technique), `config/site.yml` | 2026-11-16 | Prévoir la propagation avant la demande de certificat ; éviter plus de 5 certificats identiques par 7 jours |
| Envoyer l'identité d'éditeur à Hetzner et garder la preuve datée | `hebergeur.yml` en `actif`, Phase 9 | 2026-11-16 | Condition des Mentions légales finales |
| Créer l'Environment `production` (relecteur requis, limité à `main`), déposer les secrets et l'empreinte du serveur | Phase 8 | 2026-11-20 | Rien n'est stocké dans le dépôt |
| Relire un thème complet (santé) pour tous les candidats du périmètre, environ 6 à 8 h | Phase 9 (PUB-02) | début 2026-11-23, fin 2026-12-01 | Un thème complet vaut mieux que trois thèmes partiels |
| Solliciter un juriste (régime d'éditeur, base du droit de réponse, journaux, localStorage) | LEG-02 | demande 2026-11-13, avis 2026-12-02 | À défaut d'avis à temps, consigner par écrit le risque accepté au plus tard le 2026-12-03 |
| Tester l'adresse de contact réelle de bout en bout | LEG-01 | 2026-11-27 | Envoi et réponse depuis l'extérieur |
| Approuver le premier déploiement sur l'hôte technique, puis chaque déploiement en production | HEB-12, HEB-14 | essai technique vers 2026-11-27 ; ouverture vers 2026-12-05 | Approbation dans GitHub, un clic par déploiement |
| Répondre aux sept questions de la procédure d'import (D-08, D-09, bornes du gel, fusion en brouillon, repli, ouverture tardive, relecture non fusionnée) | Phase 10 (10-04) | 2026-11-28 | Réponse possible dès la lecture des plans ; défauts de procédure seulement en cas de silence au 2026-12-07 |
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

**Plans**: 15 plans (6 waves; server plans have checkpoints with Erwan, 08-12 and later wait for the domain and DNS)

Plans:

- [x] 08-01-PLAN.md — Bloc Caddy de l'hôte technique (basic_auth à valeur factice, noindex, robots fermé), politique du journal à source unique, phrase des Mentions légales (vague 1)
- [x] 08-02-PLAN.md — Commande forcée de déploiement (rrsync, bascule atomique, rotation, retour) et scripts de vérification Caddy en lecture seule (vague 1)
- [x] 08-03-PLAN.md — Installateur idempotent, fichier override compose, fichiers cron (vague 1)
- [x] 08-04-PLAN.md — /version.json, règles check-dist, mode 4G distant de Playwright, RUNBOOK (codes et libellé) (vague 1)
- [x] 08-05-PLAN.md — Profil « Slow 4G simulé » à 1 s, Méthode et README (vague 1)
- [x] 08-06-PLAN.md — Garde de gel, jobs gel et deploy en sommeil, rollback.yml, sonde.yml, tests de dépôt (vague 1)
- [x] 08-07-PLAN.md — Battement de cœur, sauvegarde de la configuration, test de restauration (vague 2)
- [x] 08-08-PLAN.md — RUNBOOK, ADR-054, 055, 057, 058, README des secrets (vague 3)
- [x] 08-09-PLAN.md — Serveur : validation jetable, montages, empreintes, ligne import, recréation du soir de Caddy (vague 2, accord d'Erwan)
- [x] 08-10-PLAN.md — Serveur : utilisateur deploy, commande forcée, preuve rrsync en boucle locale, aller-retour (vague 2, accord d'Erwan)
- [x] 08-11-PLAN.md — Serveur : Healthchecks et Telegram, cron du battement, alertes disque simulées, première archive (vague 3, accord d'Erwan)
- [x] 08-12-PLAN.md — Domaine réel, bloc essai importé, validate puis reload, HTTPS et en-têtes vérifiés (vague 3, attend le DNS)
- [x] 08-13-PLAN.md — Environments GitHub, déploiement approuvé par push, retour chronométré sous 2 min (vague 4)
- [x] 08-14-PLAN.md — PERF-02 derrière Caddy, Lighthouse, publication de la mesure (vague 5)
- [x] 08-15-PLAN.md — Sonde active, pannes simulées avec Telegram, restauration réelle et cron mensuel (vague 6)

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

**Plans**: 15 plans (8 waves; 09-03 and 09-08 to 09-13 have checkpoints with Erwan; 09-08 starts as soon as 09-04 is done, signature targeted before 23 November; the review of the santé theme by Erwan, 23 November to 1 December, about 6 to 8 h, is the critical path)

Plans:

- [x] 09-01-PLAN.md — Relecture ouverte (pilote.relecture_ouverte), éditeur par positions de nœuds YAML, registre, commandes liste, marquer, note (vague 1)
- [x] 09-02-PLAN.md — Liste blanche config/publication.yml, règle PUBLICATION_*, filtre des pages, codes check-dist (vague 1)
- [x] 09-03-PLAN.md — W9 : exception Wayback motivée, adoption d'un instantané existant, sources Batho et Rohou (vague 1, validation d'Erwan)
- [x] 09-04-PLAN.md — Mentions légales finales (régime II), contact réel, phrase du journal d'erreurs, note de risques R1 à R9 (vague 1)
- [x] 09-05-PLAN.md — Page de relecture locale sur 127.0.0.1 avec jeton CSRF, jamais dans le dist (vague 2)
- [x] 09-06-PLAN.md — Commandes publier (relu vers publie, thème entier) et retirer (retrait d'urgence avec case de couverture) (vague 2)
- [x] 09-07-PLAN.md — Installateur site-public, test de restauration conditionnel, favicon.ico et règle check-dist (vague 2)
- [x] 09-08-PLAN.md — Actes d'Erwan : identité transmise à Hetzner, contact testé de bout en bout, signature de la note de risques (vague 2)
- [x] 09-09-PLAN.md — RUNBOOK (retrait d'urgence, gel 2027, relecture, publication, ouverture), ADR-059 à 062, préparation du serveur (vague 5, accord d'Erwan)
- [ ] 09-10-PLAN.md — Relecture du thème santé par Erwan : 47 mesures, 37 statuts, 37 cases (vague 3, du 23 novembre au 1er décembre)
- [ ] 09-11-PLAN.md — Publication de santé sur l'hôte d'essai, hébergeur actif, exercice chronométré de retrait d'urgence (vague 6)
- [ ] 09-12-PLAN.md — Ouverture : cible production, bloc Caddy public et certificats, supervision réorientée, hôte d'essai retiré (vague 7)
- [ ] 09-13-PLAN.md — Journal d'audit refait sur la build en ligne (DETTE-04), 4G remesurée avec la page santé, confirmation d'Erwan (vague 8)
- [x] 09-14-PLAN.md — Relecteur et date affichés sur chaque mesure publiée (PUB-03), code check-dist RELECTURE_ABSENTE (vague 3)
- [x] 09-15-PLAN.md — Personnes sans statut relu absentes de la production (D-06, décision 2a), comptes honnêtes, code check-dist CANDIDAT_NON_RELU_EN_PRODUCTION (vague 4)

### Phase 9.1: Finitions visuelles avant l'ouverture (INSÉRÉE)

**Goal**: Le site qui ouvre au public n'a plus les défauts relevés par l'audit visuel du 2026-11-12 et donne une première impression claire, sans changer d'identité : les retouches restent dans le système de design existant et dans toutes les contraintes du projet (accessibilité AA, zéro JS par défaut, poids et 4G, CSP à empreintes, neutralité).
**Depends on**: Phase 7 (inlining, check-dist) ; doit être fusionnée avant la publication du thème santé (plan 09-11), pour que l'audit final (09-13) porte sur le site retouché
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04
**Success Criteria** (what must be TRUE):

  1. Une adresse inconnue affiche une page 404 en français, dans la mise en page du site, avec un retour vers l'accueil ; les textes des mesures et du glossaire ne sont plus coupés par césure automatique ; le survol ne reste plus collé au doigt sur un écran tactile ; les petits défauts de l'audit (texte « ci-dessus », barre de thème décalée) sont corrigés.
  2. Un lien partagé affiche un titre, une description et une image du site ; la page porte ses balises de partage et sa couleur de barre de navigateur ; l'image ne pèse rien pour le visiteur (elle n'est chargée que par les robots de partage) et check-dist l'admet comme seul fichier de ce type.
  3. Erwan a vu sur un aperçu, avant toute fusion, les propositions qui touchent ses textes ou des règles verrouillées du contrat de design (accueil, en-tête, pied de page, bloc source compact, liste d'accès aux candidats, alignement de la grille) et n'entrent sur `main` que celles qu'il a validées, avec ses corrections de texte.
  4. Tous les garde-fous restent verts après les retouches : axe AA, lecture à 320 px et à 160 %, fonctionnement sans JS, budget de poids et « Slow 4G simulé » sous 1 s, check-dist (empreintes CSP), et la page santé est nettement moins haute sur téléphone qu'à l'audit (26 800 px en « En bref » à 375 px).

**Plans**: 9 plans (8 waves; lot A 09.1-01 to 09.1-05 on main, one push and one deployment request at 09.1-05; lot B 09.1-06 to 09.1-08 on branch design/finitions in ../reveleTonProg-design; single checkpoint with Erwan at 09.1-09 around 20 November, merged before 09-11 and measured before the December import)

Plans:

- [x] 09.1-01-PLAN.md — Césure réservée aux noms et titres, mot long sans débordement à 320 px, survol sous (hover: hover), texte de /candidats/, barre de thème alignée, statut pleine largeur (vague 1)
- [x] 09.1-02-PLAN.md — Page 404 en français, serveur de test et bloc Caddy public (matcher file et status 404, sans handle_errors), preuve Caddy locale jetable, contrôles avant et après pour 09-12 (vague 1)
- [x] 09.1-03-PLAN.md — Nom du site en un seul endroit (NOM_SITE), pages construites identiques octet pour octet (vague 2)
- [x] 09.1-04-PLAN.md — Balises de partage et theme-color, og:url depuis le seul domaine configuré, code check-dist PARTAGE_INCORRECT (vague 3)
- [x] 09.1-05-PLAN.md — Plus de rappel du niveau sur l'accueil, gros caractères et niveau mémorisé épinglés sur chaque page candidat, pied de page structuré, gardes complètes et push du lot A (vague 4)
- [x] 09.1-06-PLAN.md — Worktree design/finitions, script de mesure et référence, propositions 1 (accueil) et 5 (nom, sous-titre, ligne d'identité) en brouillon (vague 5)
- [ ] 09.1-07-PLAN.md — Propositions 2 (bloc source compact, variante 2b si la cible de 21 500 px est manquée), 3 (Aller à un candidat), 4 (grille, règle verrouillée M1-08) (vague 6)
- [ ] 09.1-08-PLAN.md — Proposition 6 (image de partage, seul PNG admis), indépendance de chaque commit, gardes sur la branche, aperçu 4331/4332, carte de partage locale et fiche pour Erwan (vague 7)
- [ ] 09.1-09-PLAN.md — Réponse d'Erwan proposition par proposition et sur les deux textes du lot A, intégration des seuls commits acceptés avec ses textes, gardes, push, mesure finale avant l'import de décembre, nettoyage (vague 8, validation d'Erwan)

### Phase 10: Import de décembre

**Goal**: Les statuts de candidats de décembre entrent dans le dépôt par une pull request relue, sans jamais modifier la production avant relecture d'Erwan.
**Depends on**: Phase 9 (site ouvert) ; IMP-01 peut démarrer avant
**Requirements**: IMP-01, IMP-02, IMP-03
**Success Criteria** (what must be TRUE):

  1. Les outils d'import et d'archivage lisent le YAML par l'analyseur plafonné de content-core : un fichier avec alias excessifs ou clés en double est refusé avec un message clair.
  2. La CI échoue si l'instantané data.gouv et les fichiers candidats sont incohérents, et un piège prouve que « l'import ajoute un candidat déclaré à un thème publié » est détecté.
  3. Une répétition à blanc produit un diff (nouveaux, retirés, changés) puis l'import réel du 10 au 13 décembre passe par une pull request dédiée qu'Erwan relit ; la production n'est affectée qu'après cette relecture, avant le gel du 13 au 15.

**Plans**: 6 plans (une chaîne stricte de 6 vagues ; 10-01 à 10-04 avant l'ouverture, 10-05 et 10-06 du 10 au 16 décembre ; points de validation d'Erwan en 10-04, 10-05 et 10-06)

Plans:

- [x] 10-01-PLAN.md — Analyseur YAML plafonné léger (équivalent à content-core, sans load.ts) pour l'import, l'archivage et la couverture, test de dépôt avec liste blanche de huit fichiers (vague 1)
- [x] 10-02-PLAN.md — Cohérence instantané data.gouv / fiches candidats dans npm test, pièges d'une personne déclarée ajoutée à un thème publié (vague 2)
- [ ] 10-03-PLAN.md — Rapport de répétition à blanc (nouveaux, absents du jeu amont, changés avec leurs sources, conséquences sur les thèmes publiés), option --check, répétition sur le jeu en ligne dans un worktree jetable (vague 3)
- [ ] 10-04-PLAN.md — Décisions d'Erwan (D-08, D-09, bornes du gel, fusion en brouillon, repli, ouverture tardive, relecture non fusionnée), avertissement STATUT_PLUS_RECENT_NON_RELU, procédure d'import et gel au RUNBOOK (vague 4)
- [ ] 10-05-PLAN.md — Import réel sur import/statuts-2026-12 : répétition du matin, correspondances validées par Erwan, pull request avec le rapport (vague 5, 10 au 11 décembre)
- [ ] 10-06-PLAN.md — Relecture et fusion par Erwan, déploiement approuvé avant le gel, vérifications en production, relevé du gel (vague 6, 11 au 16 décembre)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 1. Fondations, schémas v1 et content-core | v1.0 | 7/7 | Complete | 2026-11-03 |
| 2. Règles éditoriales et pièges | v1.0 | 7/7 | Complete | 2026-11-03 |
| 3. Import data.gouv et corpus pilote | v1.0 | 9/9 | Complete | 2026-11-04 |
| 4. Référentiel M1 et 4 niveaux de lecture | v1.0 | 9/9 | Complete | 2026-11-03 |
| 5. Pages institutionnelles, qualité et URL de test | v1.0 | 8/8 | Complete | 2026-11-04 |
| 6. Diagnostic du VPS et décision | v1.1 | 1/0 | Complete    | 2026-11-08 |
| 7. Domaine paramétré, inlining et dette | v1.1 | 8/8 | Complete    | 2026-11-07 |
| 8. Serveur, pipeline, supervision et sauvegardes | v1.1 | 15/15 | Complete    | 2026-11-10 |
| 9. Contenu relu, juridique et ouverture | v1.1 | 11/15 | In Progress|  |
| 9.1 Finitions visuelles avant l'ouverture | v1.1 | 6/9 | In Progress|  |
| 10. Import de décembre | v1.1 | 1/6 | In Progress|  |
