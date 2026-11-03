# Roadmap: reveleTonProg

**Milestone:** v1.0 — Lots 1 & 2 (squelette, données, référentiel M1)
**Créé :** 2026-11-03
**Granularité :** coarse (5 phases)
**Couverture :** 53/53 exigences v1

## Overview

Le milestone part d'un dépôt vide et aboutit à un corpus pilote navigable sur une URL de test. Il suit le chemin critique identifié par la recherche : **schémas v1 → content-core → règles**. On pose d'abord la chaîne d'outils, les schémas JSON et le module `content-core`, qui est la seule voie de parsing et de validation (Phase 1). Viennent ensuite les règles éditoriales et la suite de pièges : quand la CI refuse une mesure sans source, le **livrable du Lot 1** est atteint (Phase 2). L'import data.gouv et la collecte du corpus pilote réel (Phase 3) peuvent tourner **en parallèle** avec les règles. Les pages M1 et les 4 niveaux (Phase 4) avancent aussi en parallèle, construits sur la fixture fictive `corpus-valide`. La Phase 5 assemble le tout : pages Méthode, Mentions légales et Qui sommes-nous générées depuis la config réelle, suite Playwright/axe/4G, test croisé, et build preview livrée comme URL de test (**livrable du Lot 2**).

**Contraintes calendaires** (repères, pas des estimations) :

- La spec veut les lots 1 à 3 avant le **2026-12-15**. Le Lot 3 (hébergement) relève du milestone v1.1.
- Les statuts vont bouger autour du **10-13 décembre 2026** (référendum des Écologistes, décisions Hollande et Bertrand). L'historique `statuts[]` (Phase 1) et le workflow d'import par diff (Phase 3) doivent exister avant.

**Décisions supposées :**

- Décidées par Erwan le 2026-11-03 : D-1, D-2, D-4, D-5.
- D-3 et D-6 à D-13 : défauts recommandés dans `research/SUMMARY.md`.
- Le plan de la Phase 1 s'ouvre sur un point de confirmation des choix de modélisation (D-3, D-7, D-8).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fondations, schémas v1 et content-core** - Dépôt Node 24 + Astro 7 statique, CI durcie, hygiène, schémas JSON 2020-12 et loader/validateur unique
- [ ] **Phase 2: Règles éditoriales et pièges** - La CI refuse une mesure sans source et tous les pièges §12 applicables (livrable Lot 1)
- [ ] **Phase 3: Import data.gouv et corpus pilote** - 59 fiches candidats sourcées, outil d'archivage, 3 thèmes pilotes réels en brouillon (parallélisable avec 2 et 4)
- [ ] **Phase 4: Référentiel M1 et 4 niveaux de lecture** - Pages thème et candidat, bascule de niveau sans JS, ordre alphabétique/aléatoire, Aîné et Enfant, contrôle post-build (parallélisable avec 2 et 3)
- [ ] **Phase 5: Pages institutionnelles, qualité et URL de test** - Méthode, Mentions légales, Qui sommes-nous, suite a11y/4G, test croisé, preview livrée (livrable Lot 2)

## Phase Details

### Phase 1: Fondations, schémas v1 et content-core

**Goal**: Un développeur clone le dépôt, lance une seule commande, et obtient une validation structurelle du contenu par les schémas JSON v1. Le même loader sert à la CI et à Astro, sur un site statique sans JS, avec une CI durcie et l'hygiène documentée.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):

  1. Sur une machine propre avec Node 24, `npm install && npm run validate && npm test && npm run build` passe sans autre étape. `dist/` contient des pages HTML statiques sans aucun `<script>` ajouté par Astro.
  2. Un push ou une PR déclenche GitHub Actions (actions épinglées par SHA, `contents: read`, `TZ=Europe/Paris`, gitleaks). Le workflow échoue dès qu'un fichier de la fixture `corpus-valide` viole son schéma (par exemple une mesure `publie` sans rédaction enfant, ou un candidat sans `statuts[]`).
  3. Le validateur CLI et le loader Astro passent par le même module `src/lib/content-core/load`. Une date YAML reste une chaîne dans les deux cas, ce qu'un test vérifie.
  4. Si on monte `version_schema` sans migrer un fichier, `npm run migrate -- --check` échoue en CI. `--write` le remet à niveau, et le test avant/après de la migration fixture passe.
  5. Le dépôt contient LICENSE (code MIT, contenu Licence Ouverte 2.0, `archives/` exclu), le README aux 5 questions, `docs/ARCHITECTURE.md` (Mermaid + ADR D-1 à D-13) et un RUNBOOK. Il est poussé sur GitHub, avec Dependabot actif.

**Plans**: 7 plans (5 waves)

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton test-first: failing e2e test + fictional fixture, Node 24 + Astro 7 scaffold with asserted config (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — content-core (parse + Ajv + diagnostics), common + candidat schemas, `npm run validate` CLI (wave 2)
- [x] 01-03-PLAN.md — Repo hygiene: hardened CI, gitleaks, Dependabot, LICENSE, README, ARCHITECTURE (ADR D-1…D-13), RUNBOOK incl. manual GitHub security settings (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Astro object loader on the shared loadAll + view-model + zero-JS page; e2e GREEN (wave 3)
- [x] 01-05-PLAN.md — couverture, glossaire, sondage, journal schemas + fixtures + schemas/CHANGELOG.md (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-06-PLAN.md — Sourced-measure slice: theme/source/mesure schemas, fictional measure + archive, rendered on the page (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-07-PLAN.md — Contract lock + migrations + phase gate: meta/corpus tests, migrate --check/--write, push, green CI, failing probe (wave 5)

**Research flag**: oui. Passe de conception sur les champs `couverture`/`sources`/archive et le vocabulaire `motif`, avec confirmation de D-3, D-7 et D-8.

### Phase 2: Règles éditoriales et pièges

**Goal**: La CI refuse toute donnée qui viole les règles éditoriales du §5 ou un piège applicable du §12. Elle indique fichier, ligne et code d'erreur. C'est le livrable du Lot 1 : « la CI refuse une mesure sans source ».
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: REGLE-01, REGLE-02, REGLE-03, REGLE-04, REGLE-05, REGLE-06, REGLE-07, REGLE-08, REGLE-09, REGLE-10, REGLE-11, REGLE-12
**Success Criteria** (what must be TRUE):

  1. Dans une PR, une mesure sans source, ou dont la source est inconnue, de presse ou sans archive valide (fichier absent, sha256 faux), fait échouer la CI. L'annotation GitHub donne le fichier, la ligne et le code (`SOURCE_ABSENTE`, `SOURCE_NON_PRIMAIRE`, `ARCHIVE_ABSENTE`…).
  2. La CI rejette les rédactions fautives :
     - un mot interdit hors citation ;
     - une longueur hors bornes pour un niveau ;
     - un chiffre absent de la source ;
     - une citation ou un `texte_source` introuvable mot pour mot dans l'extrait archivé ;
     - une phrase enfant de plus de 15 mots en `publie`.
     Un verbe connoté ou un score Kandel-Moles faible donne seulement un avertissement.

  3. La CI bloque aussi les erreurs de corpus et de thème :
     - un id de candidat renommé ou supprimé (`ids.lock`) ;
     - une référence cassée ;
     - un thème `publie` où un candidat `declare`/`primaire` n'a ni mesure publiée ni état de couverture vérifié (erreur en production, avertissement en preview) ;
     - la présence de `bloc`, `extdroite` ou `propositions` dans `src/content/`.
  4. Les sondages pièges sont rejetés : sans notice, somme hors 95-105 %, hypothèse de second tour rangée en premier tour, publication dans les fenêtres de blocage des 17-18 avril et 1-2 mai 2027 (heure de Paris).
  5. Chaque piège §12 applicable est une fixture dans `tests/fixtures/pieges/` avec son code attendu. `npm test` échoue dès qu'un piège passe la validation.

**Plans**: TBD
**Notes reportées de la Phase 1**: règle `archive.wayback_url` obligatoire pour toute source citée par une mesure `statut_relecture: publie` (le schéma v1 le laisse optionnel, hypothèse A3 ; règle Phase 2, sans changement de schéma).
**Research flag**: oui. Normalisation et comptage de mots en français, extraction des nombres, heuristique de syllabes Kandel-Moles, règles de normalisation des citations.

### Phase 3: Import data.gouv et corpus pilote

**Goal**: Le dépôt contient les 59 personnalités du jeu data.gouv, chacune avec un statut daté et sourcé, plus un corpus pilote réel de 3 thèmes. Ce corpus est collecté sur sources primaires archivées, en `brouillon`, prêt pour la relecture d'Erwan, et rien n'y est inventé.
**Mode:** mvp
**Depends on**: Phase 1 (schémas gelés). Peut tourner **en parallèle** avec les Phases 2 et 4. Le merge final du contenu pilote passe les règles de la Phase 2.
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06
**Success Criteria** (what must be TRUE):

  1. Le script d'import fonctionne ainsi :
     - il prend un instantané du jeu « statuts sourcés » (sha256 + date) ;
     - il écarte `bloc` et `propositions` et mappe les statuts sur les codes D-1 ;
     - il produit un diff qu'Erwan peut relire en PR.
     Une seconde exécution sur le même instantané ne produit aucun diff.

  2. Les 59 fiches candidats passent la validation, avec nom découpé à la main, `nom_tri`, statut daté et source typée. L'attribution Licence Ouverte de 2027etmoi est présente.
  3. Archiver une URL de source produit trois choses : un extrait `.txt` committé avec son sha256, le binaire stocké hors du dépôt public, et une soumission Wayback. Le validateur accepte alors les mesures qui citent cette source.
  4. Le choix des 3 thèmes pilotes est documenté avec la couverture mesurée en sources primaires par thème. Pour chaque thème pilote, chaque candidat `declare`/`primaire` a soit des mesures réelles en `brouillon` (citation vérifiée dans l'archive), soit un état de couverture daté.
  5. Chaque terme et parti utilisé dans les rédactions enfant pilotes se résout dans le glossaire, ce que la CI vérifie.

**Plans**: TBD
**Research flag**: oui. Capture de sites de campagne lourds en JS, mécanique du stockage privé des archives, API Save Page Now et reprises, choix des thèmes selon la couverture mesurée.

### Phase 4: Référentiel M1 et 4 niveaux de lecture

**Goal**: Un visiteur choisit un thème ou un candidat et lit chaque position au niveau qui lui convient (résumé, détaillé, enfant, aîné). La bascule se fait sans rechargement, même sans JS. Chaque mesure montre sa source datée, chaque case vide est typée et datée, et l'ordre des candidats n'est jamais lié aux sondages.
**Mode:** mvp
**Depends on**: Phase 1 (construit sur la fixture `corpus-valide`). Peut tourner **en parallèle** avec les Phases 2 et 3.
**Requirements**: M1-01, M1-02, M1-03, M1-04, M1-05, M1-06, M1-07, M1-08, M1-09, M1-10, M1-11, M1-12, QUAL-01
**Success Criteria** (what must be TRUE):

  1. Sur une page thème, le visiteur voit tous les candidats du périmètre :
     - chaque candidat a une carte de taille fixe (première mesure et « N autres mesures ») ;
     - un candidat sans mesure a un état vide daté (« Non précisé dans les sources consultées le … », « Programme non publié à ce jour ») ;
     - une ligne de couverture figure en tête ;
     - les candidats `renonce` sont dans une section repliée.
     Le visiteur passe d'une page thème à une page candidat et inversement par des liens croisés. Chaque page candidat montre le statut en texte (date + source) et le parti tel que revendiqué. Chaque mesure affiche sa source primaire (titre, date de consultation, lien original, lien vers la copie archivée) et un lien « signaler une erreur ». Chaque page indique sa date de dernière mise à jour.

  2. JS désactivé, le visiteur bascule entre les 4 niveaux sans rechargement, et seul le niveau actif est lu par un lecteur d'écran. JS actif, le niveau choisi est restauré au chargement suivant sans flash.
  3. Par défaut, les candidats sont triés par ordre alphabétique (`nom_tri`, collation française). Avec JS, le visiteur peut demander un ordre aléatoire, retiré à chaque chargement et dont le mode est mémorisé. Sans JS, l'ordre reste alphabétique et une explication l'indique.
  4. Le niveau Aîné affiche une police ≥ 20 px, des cibles ≥ 44 px et le bloc « ce qui me concerne ». Au niveau Enfant, les mots soulignés ouvrent une définition au clic ou au focus, et la liste « Mots expliqués » est disponible.
  5. La build `RTP_MODE=preview` affiche les brouillons avec le badge « brouillon, non relu ». La build production n'en contient aucun. Le contrôle post-build fait échouer la CI dans plusieurs cas : une page au-delà de 500 Ko bruts ou 100 Ko gzip, une ressource tierce, des mots collés, une mesure sans source datée, un nombre de cellules différent du nombre de candidats.

**Plans**: TBD
**UI hint**: yes
**Research flag**: oui. Comportement de `popovertarget` avec les lecteurs d'écran, repli `:has()` sur Safari 15.x, interaction entre le bfcache et la restauration de l'état des formulaires.

### Phase 5: Pages institutionnelles, qualité et URL de test

**Goal**: Le corpus pilote est navigable sur une URL de test, avec des pages Méthode, Mentions légales et Qui sommes-nous neutres qui décrivent ce qui a réellement été construit. L'accessibilité, le fonctionnement sans JS et la performance en 4G sont prouvés par des tests automatiques. C'est le livrable du Lot 2.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: INST-01, INST-02, INST-03, INST-04, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06
**Success Criteria** (what must be TRUE):

  1. La page Méthode explique sources, neutralité, mots interdits, longueurs, périmètre d'équité, ordre, états vides et écart 59/51. Ses listes et chiffres sont générés depuis la config du validateur : un changement de borne dans `config.ts` change la page.
  2. Les deux autres pages institutionnelles et le rappel des dates :
     - Mentions légales : cite la LCEN art. 1-1 (éditeur non professionnel Erwan Henry, sans adresse personnelle), donne l'hébergeur depuis `config/hebergeur.yml`, le contact et le droit de réponse, plus une section données personnelles (clés localStorage, aucun cookie).
     - Qui sommes-nous : aucun branding tiers ni lien de don.
     - Les dates du 18 avril et du 2 mai 2027 sont visibles.
  3. La suite Playwright passe :
     - lecture et bascule de niveau sans JS ;
     - parcours clavier complet ;
     - zéro violation axe WCAG 2.2 AA sérieuse ou critique ;
     - texte à 160 % et `prefers-reduced-motion` respectés, contraste AA ;
     - la page la plus lourde se charge en moins d'1 s en 4G lente simulée (150 ms RTT, 1,6 Mbps), servie compressée.
  4. Erwan ouvre la build preview (artefact CI ou preview locale, `noindex` si jamais hébergée) et parcourt le corpus pilote de bout en bout.
  5. Un journal d'audit existe pour le test croisé simulé (enfant de 10 ans, retraité de 72 ans, journaliste, avec données piégées), avant la clôture du milestone.

**Plans**: TBD
**UI hint**: yes
**Research flag**: oui. Formulation juridique des mentions légales (D-4, idéalement relue par un avocat avant le Lot 3), identité de l'hébergeur de la preview.

## Parallélisation

```
Phase 1 ──┬──> Phase 2 (règles) ──────────┐
          ├──> Phase 3 (données réelles) ─┼──> Phase 5
          └──> Phase 4 (pages M1, fixtures)┘
```

- Les Phases 2, 3 et 4 dépendent seulement de la Phase 1 (schémas v1 gelés). Elles peuvent avancer en parallèle.
- Le contenu de la Phase 3 est mergé une fois que les règles de la Phase 2 le valident. Les faux positifs remontés (par exemple « enfin » dans une citation de candidat) reviennent corriger la Phase 2.
- La Phase 4 se construit sur `corpus-valide`. Le contrôle post-build (QUAL-01) arrive dès la première page, pour attraper tôt les régressions de poids et d'espaces.
- La Phase 5 attend les trois : la page Méthode décrit les règles finales, et le test croisé porte sur le corpus réel.

**Jalons livrables :**

- Lot 1 : fin des Phases 2 et 3 (la CI refuse une mesure sans source, et les données réelles sont en place).
- Lot 2 : fin de la Phase 5 (corpus pilote navigable sur une URL de test).

## Progress

**Execution Order:**
1 → (2 ∥ 3 ∥ 4) → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fondations, schémas v1 et content-core | 6/7 | In Progress|  |
| 2. Règles éditoriales et pièges | 0/TBD | Not started | - |
| 3. Import data.gouv et corpus pilote | 0/TBD | Not started | - |
| 4. Référentiel M1 et 4 niveaux de lecture | 0/TBD | Not started | - |
| 5. Pages institutionnelles, qualité et URL de test | 0/TBD | Not started | - |

---
*Roadmap created: 2026-11-03*
