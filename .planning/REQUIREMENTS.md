# Requirements: reveleTonProg

**Defined:** 2026-11-03
**Core Value:** Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient — chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.

**Milestone v1.0** = Lot 1 (squelette, données, CI) + Lot 2 (M1 référentiel, 4 niveaux, pages institutionnelles) du cahier des charges (`docs/spec/CAHIER-DES-CHARGES.md`).

**Décisions d'Erwan (2026-11-03)** : D-1 codes statut du dataset (`declare|primaire|pressenti|empeche|renonce`, `renonce` affiché « Ne se présente pas » + `motif`) ; D-2 équité = `declare` + `primaire` ; D-4 mentions légales éditeur non professionnel (LCEN art. 1-1 II, pas d'adresse perso) ; D-5 Node 24 LTS. Autres décisions D-3, D-6…D-13 : défauts recommandés de `research/SUMMARY.md`.

## v1 Requirements

### Fondations (FOND)

- [x] **FOND-01**: Un développeur clone le dépôt et lance `npm install && npm run validate && npm test && npm run build` avec Node 24 (`.nvmrc`, `engines >=24.12`) sans autre étape
- [x] **FOND-02**: La config Astro 7 produit un site 100 % statique sans JS par défaut (`compressHTML: true`, `prefetch: false`, service d'image passthrough)
- [x] **FOND-03**: Chaque push et pull request déclenche GitHub Actions (actions épinglées par SHA, `permissions: contents: read`, `TZ=Europe/Paris`) qui exécute validate + tests + build et échoue au premier problème
- [x] **FOND-04**: CI détecte les secrets (gitleaks) et Dependabot ouvre des PR de mise à jour avec cooldown
- [x] **FOND-05**: Le dépôt contient LICENSE (code MIT, contenu éditorial Licence Ouverte 2.0, `archives/` et textes des candidats exclus) et des ADR pour D-1…D-13 dans `docs/ARCHITECTURE.md`

### Schémas et modèle de données (DATA)

- [x] **DATA-01**: Les schémas JSON Schema 2020-12 dans `schemas/` (candidat, theme, mesure, source, couverture, glossaire, sondage, journal) sont la seule source de vérité structurelle, chacun avec `version_schema`
- [x] **DATA-02**: Un candidat a un id `prenom-nom` ASCII figé, `prenom`, `nom`, `nom_tri`, parti tel que revendiqué avec `parti_source`, `ids_externes`, `ordre_cc` réservé, et un historique `statuts[]` append-only (code, `motif` si `renonce`, date, source typée `candidat|parti|institution|presse`)
- [x] **DATA-03**: Une mesure a candidat, thème, sous-thème, titre neutre, `texte_source` cité, référence de source, 4 rédactions, chiffrage du candidat, `statut_relecture` (`brouillon|relu|publie`), relecteur, date ; enfant et aîné obligatoires pour `publie` (if/then)
- [x] **DATA-04**: Une source a type primaire (programme, site candidat/parti, discours, tribune, dépôt CC), auteur (`candidat|parti_du_candidat|coalition`), URL, date de publication, date de consultation, et un bloc archive (chemin extrait `.txt`, sha256, date de capture, URL Wayback)
- [x] **DATA-05**: Une couverture par thème liste chaque candidat dans le périmètre d'équité avec un état `mesures|non_precise|programme_non_publie`, `verifie_le`, `verifie_par`, sources consultées
- [x] **DATA-06**: Un glossaire contient des termes (définition en une phrase, niveau CM1) et des partis (`type: parti`, auto-description sourcée)
- [x] **DATA-07**: Un loader unique (`src/lib/content-core/load`) parse le YAML sans le tag `timestamp` (dates = chaînes) et est utilisé à la fois par le validateur CI et par Astro
- [x] **DATA-08**: Un changement de schéma passe par un script de migration (`npm run migrate -- --check|--write`) testé avant/après ; la CI échoue si un fichier est en retard de version

### Règles éditoriales et pièges (REGLE)

- [x] **REGLE-01**: La CI rejette une mesure sans source, avec une source inconnue, non primaire (presse) ou sans archive valide (fichier présent, sha256 correspondant)
- [x] **REGLE-02**: La CI rejette un mot interdit (« extrême », « populiste », « irresponsable », « courageux », « enfin » et variantes) dans les champs éditoriaux, hors citations `« … »` et `texte_source`, et avertit sur les verbes connotés (promet, prétend, ose…)
- [x] **REGLE-03**: La CI vérifie les longueurs par niveau (résumé ≤ 25 mots, détaillé 80-200, enfant 40-60, aîné 60-120) avec un comptage de mots adapté au français
- [x] **REGLE-04**: La CI rejette une rédaction (résumé, enfant, aîné) contenant un nombre absent du `texte_source` ou du chiffrage, et toute citation `« … »` du détaillé absente du `texte_source`
- [x] **REGLE-05**: La CI rejette un `texte_source` qui ne figure pas mot pour mot (après normalisation) dans l'extrait archivé
- [x] **REGLE-06**: La CI calcule un score de lisibilité Kandel-Moles sur les rédactions enfant (avertissement) et rejette pour `publie` une phrase enfant de plus de 15 mots
- [x] **REGLE-07**: La CI vérifie l'intégrité du corpus : références existantes, chemin = id, ids de candidats jamais renommés ni supprimés (`ids.lock`)
- [x] **REGLE-08**: La CI bloque la publication d'un thème tant qu'un candidat `declare`/`primaire` n'a ni mesure publiée ni état couverture vérifié (erreur en production, avertissement en preview)
- [x] **REGLE-09**: La CI rejette un sondage sans URL de notice, dont les scores somment hors 95-105 %, une hypothèse de second tour rangée en premier tour, ou une date de publication dans une fenêtre de blocage légal (17-18 avril et 1-2 mai 2027, Europe/Paris)
- [x] **REGLE-10**: Chaque piège du §12 applicable est une fixture dans `tests/fixtures/pieges/` avec son code d'erreur attendu, et `npm test` échoue si un piège passe
- [x] **REGLE-11**: Les erreurs du validateur indiquent fichier, ligne et code, au format annotation GitHub en CI
- [x] **REGLE-12**: La CI échoue si `bloc`, `extdroite` ou `propositions` (champs du dataset non importables) apparaissent dans `src/content/`

### Contenu pilote (CONT)

- [x] **CONT-01**: Un script importe le dataset data.gouv « statuts sourcés » (instantané + sha256 + date), écarte `bloc` et `propositions`, mappe les statuts et produit un diff relisible
- [x] **CONT-02**: Les 59 personnalités du dataset ont une fiche candidat valide (nom découpé à la main, `nom_tri`, statut daté et sourcé, attribution Licence Ouverte)
- [x] **CONT-03**: Un script archive une source (capture (fetch HTML/PDF ; rendu manuel `--file` pour sites client/403) → extrait texte committé + sha256 ; binaire hors dépôt public ; soumission Wayback)
- [x] **CONT-04**: Les 3 thèmes pilotes sont choisis par couverture mesurée en sources primaires, et le choix est documenté
- [x] **CONT-05**: Chaque candidat `declare`/`primaire` a, pour chaque thème pilote, soit des mesures réelles sourcées en `brouillon`, soit un état couverture daté ; rien n'est inventé
- [x] **CONT-06**: Le glossaire couvre les termes et partis utilisés dans les rédactions enfant pilotes

### Référentiel M1 (M1)

- [x] **M1-01**: Le visiteur ouvre une page thème et voit tous les candidats du périmètre, chacun avec ses mesures ou un état vide typé et daté (« Non précisé dans les sources consultées le … », « Programme non publié à ce jour »)
- [x] **M1-02**: Le visiteur ouvre une page candidat (59 personnalités) et voit ses mesures par thème, son statut en texte avec date et source, et son parti tel que revendiqué
- [x] **M1-03**: Le visiteur navigue thème → candidat et candidat → thème par liens croisés
- [x] **M1-04**: Chaque mesure affiche sa source primaire (titre, date de consultation, lien original, lien vers la copie archivée) et un lien « signaler une erreur »
- [x] **M1-05**: Le visiteur bascule entre résumé, détaillé, enfant et aîné sans rechargement, y compris sans JavaScript (radios + `:has()`), seul le niveau actif étant lu par les lecteurs d'écran
- [x] **M1-06**: Le choix de niveau est mémorisé en localStorage et restauré sans flash au chargement suivant (amélioration progressive)
- [x] **M1-07**: Les candidats sont en ordre alphabétique (`nom_tri`, collation française) par défaut ; le visiteur peut demander un ordre aléatoire (JS, Fisher-Yates, retiré à chaque chargement, mode mémorisé) ; sans JS l'ordre reste alphabétique avec explication
- [x] **M1-08**: Les cartes candidats ont une taille fixe (première mesure + « N autres mesures »), une ligne de couverture en tête de thème, et les candidats `renonce` dans une section repliée ; aucune photo, pictogramme neutre identique
- [x] **M1-09**: Le niveau Aîné affiche une police plus grande (≥ 20 px, cibles ≥ 44 px) et un bloc « ce qui me concerne » qui met en tête les thèmes retraites, santé, dépendance, succession, logement
- [x] **M1-10**: Le niveau Enfant affiche des mots soulignés qui ouvrent une définition en une phrase au clic ou au focus (Popover API), plus une liste « Mots expliqués » en repli
- [x] **M1-11**: Une build `RTP_MODE=preview` montre les brouillons avec un badge « brouillon, non relu » ; la build production n'affiche que `publie` et ne contient aucun brouillon
- [x] **M1-12**: Chaque page indique sa date de dernière mise à jour

### Pages institutionnelles (INST)

- [x] **INST-01**: La page Méthode explique choix des sources, règles de neutralité, mots interdits, longueurs, périmètre d'équité, ordre, états vides, écart 59/51 du dataset — listes et chiffres générés depuis la config du validateur
- [x] **INST-02**: La page Mentions légales cite LCEN art. 1-1 (éditeur non professionnel Erwan Henry, hébergeur depuis `config/hebergeur.yml`, directeur de la publication, contact, droit de réponse) et une section données personnelles (clés localStorage, aucun cookie)
- [x] **INST-03**: La page Qui sommes-nous présente l'éditeur et la démarche sans branding tiers (ni Alignd ni SpikeeLabs) ni lien de don
- [x] **INST-04**: Le site rappelle les dates des deux tours (18 avril et 2 mai 2027)

### Qualité et livraison (QUAL)

- [x] **QUAL-01**: Un contrôle post-build échoue si une page dépasse 500 Ko bruts ou 100 Ko gzip, charge une ressource tierce, contient un mot interdit hors liste Méthode, affiche une mesure sans source datée, colle des mots (espaces inline perdues), ou a un nombre de cellules ≠ nombre de candidats du thème
- [x] **QUAL-02**: Un test Playwright vérifie le fonctionnement sans JS (lecture et bascule de niveau), le parcours clavier complet et zéro violation axe WCAG 2.2 AA sérieuse ou critique
- [x] **QUAL-03**: Un test Playwright en 4G lente simulée (150 ms RTT, 1,6 Mbps) sur la page la plus lourde servie compressée mesure un chargement < 1 s
- [x] **QUAL-04**: Le mode « très gros texte » (160 %) et `prefers-reduced-motion` sont respectés, contraste AA sur tous les thèmes
- [x] **QUAL-05**: Le corpus pilote est navigable sur une URL de test (build preview publiée en artefact CI ou preview locale, `noindex` si hébergée)
- [x] **QUAL-06**: Un test croisé simulé (enfant 10 ans, retraité 72 ans, journaliste) avec données piégées produit un journal d'audit avant livraison du milestone

## v2 Requirements

Deferred to future milestones (lots 3-7 du cahier des charges).

### Hébergement (lot 3)

- **HEB-01**: Bloc Caddy du nouveau domaine, HTTPS, compression, cache
- **HEB-02**: Déploiement rsync depuis GitHub Actions (clé SSH dans GitHub Secrets)
- **HEB-03**: Vérification charge mémoire/disque du VPS

### Sondages M2 (lot 4)

- **SOND-01**: Écran pédagogique, sondages avec intervalle, notice, moyenne glissante, blocage légal affiché

### Pipeline et journal (lot 5)

- **PIPE-01**: Cron de collecte, PR automatiques, paliers A-D, rappel de relecture, journal public M5, gel de contenu pendant le silence électoral

### Expérience (lot 6)

- **EXP-01**: Pièces par thème, audio, jeu M3, comparateur M4, audit accessibilité complet

### Extension (lot 7)

- **EXT-01**: Votes réels M6, cadence bi-quotidienne, ordre Conseil constitutionnel

### Différé interne

- **DIFF-01**: Lisibilité Kandel-Moles bloquante après calibrage sur Vikidia
- **DIFF-02**: Feuille de style impression

## Out of Scope

| Feature | Reason |
|---------|--------|
| Quiz d'affinité, profilage, votes des visiteurs | Neutralité ; M3 (lot 6) n'est explicitement pas un test d'affinité |
| Tri ou sélection par sondage, regroupement par bloc politique | Interdit par §5 ; le champ `bloc` du dataset contient une étiquette non revendiquée |
| Couleurs de parti, photos de presse, photos en v1.0 | Neutralité visuelle, disponibilité inégale (D-12) |
| Contenu évaluatif (forces/faiblesses, faisabilité) | Le site décrit, ne juge pas |
| Presse comme source d'une mesure | Source primaire obligatoire ; presse tolérée pour statuts seulement (D-3) |
| Publication de texte agent sans relecture humaine | §5, palier C |
| Base de données, comptes, commentaires, newsletter, app mobile, version anglaise | Hors v1 du cahier des charges |
| Scripts tiers, polices CDN, analytics | Zéro donnée personnelle, zéro ressource tierce |
| PDF complets des programmes dans le dépôt public | Droit d'auteur (CPI L.122-5) ; binaires dans un stockage privé (D-8) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOND-01 | Phase 1 | Complete |
| FOND-02 | Phase 1 | Complete |
| FOND-03 | Phase 1 | Complete |
| FOND-04 | Phase 1 | Complete |
| FOND-05 | Phase 1 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| DATA-08 | Phase 1 | Complete |
| REGLE-01 | Phase 2 | Complete |
| REGLE-02 | Phase 2 | Complete |
| REGLE-03 | Phase 2 | Complete |
| REGLE-04 | Phase 2 | Complete |
| REGLE-05 | Phase 2 | Complete |
| REGLE-06 | Phase 2 | Complete |
| REGLE-07 | Phase 2 | Complete |
| REGLE-08 | Phase 2 | Complete |
| REGLE-09 | Phase 2 | Complete |
| REGLE-10 | Phase 2 | Complete |
| REGLE-11 | Phase 2 | Complete |
| REGLE-12 | Phase 2 | Complete |
| CONT-01 | Phase 3 | Complete |
| CONT-02 | Phase 3 | Complete |
| CONT-03 | Phase 3 | Complete |
| CONT-04 | Phase 3 | Complete |
| CONT-05 | Phase 3 | Complete |
| CONT-06 | Phase 3 | Complete |
| M1-01 | Phase 4 | Complete |
| M1-02 | Phase 4 | Complete |
| M1-03 | Phase 4 | Complete |
| M1-04 | Phase 4 | Complete |
| M1-05 | Phase 4 | Complete |
| M1-06 | Phase 4 | Complete |
| M1-07 | Phase 4 | Complete |
| M1-08 | Phase 4 | Complete |
| M1-09 | Phase 4 | Complete |
| M1-10 | Phase 4 | Complete |
| M1-11 | Phase 4 | Complete |
| M1-12 | Phase 4 | Complete |
| INST-01 | Phase 5 | Complete |
| INST-02 | Phase 5 | Complete |
| INST-03 | Phase 5 | Complete |
| INST-04 | Phase 5 | Complete |
| QUAL-01 | Phase 4 | Complete |
| QUAL-02 | Phase 5 | Complete |
| QUAL-03 | Phase 5 | Complete |
| QUAL-04 | Phase 5 | Complete |
| QUAL-05 | Phase 5 | Complete |
| QUAL-06 | Phase 5 | Complete |

**Coverage:**

- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-03*
*Last updated: 2026-11-03 after roadmap creation*
