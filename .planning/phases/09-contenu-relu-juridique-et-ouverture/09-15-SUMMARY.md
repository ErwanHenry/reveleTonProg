---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 15
subsystem: view-model, pages, check-dist
tags: [publication, equite, d-06, check-dist, pub-02]

requires:
  - phase: 09-02
    provides: liste blanche de publication, filtre du view-model, codes check-dist de production
  - phase: 09-14
    provides: ligne de relecture, RELECTURE_ABSENTE
provides:
  - "construireCorpus écarte en production toute personne sans statut relu ou publié (statutAffiche === null), avant les rangs ; champ Corpus.nonRelus"
  - "Textes honnêtes : /candidats/ (intro, description, p[data-non-relus]), page thème (« voir la liste des candidats »), Méthode (p[data-personnalites-affichees])"
  - "check-dist CANDIDAT_NON_RELU_EN_PRODUCTION (erreur, production) et helper candidatsNonRelus, câblé dans le CLI ; ligne du RUNBOOK"
affects: [09-10, 09-11, 09-12]

key-files:
  created:
    - tests/dist/cas/candidats-relus.cas.ts
  modified:
    - src/lib/corpus/vue.ts
    - src/pages/candidats/index.astro
    - src/pages/themes/[id].astro
    - src/pages/methode.astro
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - docs/RUNBOOK.md
    - tests/corpus/vue.test.ts
    - tests/corpus/vue-candidat.test.ts
    - tests/corpus/corpus-m1.test.ts
    - tests/dist/cas/candidat.cas.ts
    - tests/dist/cas/theme.cas.ts
    - tests/dist/cas/methode.cas.ts
    - tests/dist/cas/ordre.cas.ts
    - tests/scripts/check-dist.test.ts

key-decisions:
  - "Une seule définition (ADR-041) : le view-model filtre sur statutAffiche(c, 'production') === null, check-dist sur statutRetenu(statuts, 'production') === undefined ; aucune seconde lecture de statut_relecture"
  - "Le filtre précède l'attribution des rangs (rangs contigus) ; les personnes écartées étaient déjà hors périmètre, le périmètre d'équité ne change pas (test dédié)"
  - "Quand aucune personne n'est affichée, les phrases ne disent pas « autres » : « 59 personnalités du jeu de données apparaîtront après relecture de leur statut. » et « Ce site n'affiche encore aucune personnalité : … »"
  - "check-dist ignore les liens de pur fragment (#…) : ils visent la page elle-même, déjà signalée comme page"

requirements-completed: []

metrics:
  completed: 2026-11-11
---

# Phase 9 Plan 15: personnes sans statut relu absentes de la production Summary

En production, une personne du jeu de données sans aucun statut relu ou publié n'a plus ni page, ni ligne sur /candidats/, ni entrée de sitemap, ni lien, ni nom sur une page thème ; le site dit combien de personnes attendent la relecture de leur statut, et check-dist refuse un dist qui en exposerait une (CANDIDAT_NON_RELU_EN_PRODUCTION). La preview montre toujours tout le monde, avec les pastilles de brouillon.

## Ce que montre la build de production réelle aujourd'hui

Aucun statut du corpus réel n'est relu (09-10 n'est pas fait) : la build de production de main (hôte `essai`) n'affiche **aucune personne** (« Aucun candidat à afficher pour le moment. » puis « 59 personnalités du jeu de données apparaîtront après relecture de leur statut. »), aucun thème (`themes_ouverts: []`), et la Méthode dit « Ce site n'affiche encore aucune personnalité : les 59 personnalités du jeu de données apparaîtront après relecture de leur statut. ». `dist/candidats/` ne contient que `index.html` ; `sitemap.xml` liste les six pages fixes. check-dist : 0 erreur, 3 avertissements attendus (PUBLICATION_VIDE, HEBERGEUR_PREVU x2). C'est l'état voulu et honnête.

## Surfaces couvertes par le filtre

Toutes passent par la liste filtrée `corpus.candidats` (ou par les vues qui en dérivent), sans filtre propre :
- pages `/candidats/<id>/` (`getStaticPaths` de `src/pages/candidats/[id].astro`) ;
- lignes de `/candidats/` et leurs rangs ;
- cases des pages thème, liste « Ne se présentent pas », compte `autresPersonnalites`, phrase de couverture, cases vides et « Sources consultées » (seulement pour le périmètre, inchangé) ;
- `sitemap.xml` (`cheminsDuSite`) et donc les URL canoniques (une par page construite) ;
- `miseAJourIndex()`, `pageCandidat()`, `candidat()` (lèvent pour une personne écartée) ;
- `corpus.mesures` (défense en profondeur : une mesure publiée d'une personne écartée est retirée) ;
- navigation et liens croisés (aucune page ne peut lier une page qui n'existe pas : LIEN_INTERNE_CASSE, et désormais CANDIDAT_NON_RELU_EN_PRODUCTION) ;
- sorties non HTML : `robots.txt`, `version.json` et `sitemap.xml` vérifiés par le cas dist (aucun identifiant ni nom de Paul ou Nina dans aucun fichier html, xml, txt ou json du dist M1 de production).

Contrôle post-build : page `candidats/<id>/index.html`, lien (absolu, relatif, avec fragment, ou absolu vers le domaine du site avec ou sans `www.`) et `<loc>` du sitemap.

## Commits

- 3c6a6f6 test(09-15) : view-model, tests rouges (6 échecs vus avant le code)
- 5f1b339 feat(09-15) : filtre de production dans construireCorpus, nonRelus
- 27ba4fe test(09-15) : cas dist, tests rouges (3 échecs vus : intro et phrase de l'index, paragraphe Méthode)
- 6066389 feat(09-15) : index, page thème, Méthode
- 25a7d11 test(09-15) : check-dist, tests rouges (export absent, CLI non câblé, RUNBOOK)
- 3124e0a feat(09-15) : check-dist CANDIDAT_NON_RELU_EN_PRODUCTION, helper, CLI, RUNBOOK, cas dist sur le corpus réel

## Assertions de production changées volontairement

- `tests/corpus/vue.test.ts` : `autresPersonnalites` en production passe de 2 à 0 sur logement et climat (Paul et Nina ne sont plus comptés).
- `tests/corpus/vue-candidat.test.ts` : les cas de production « Paul : statut non relu » et « Nina : aucune section » deviennent un cas d'absence (`pageCandidat` lève).
- `tests/dist/cas/candidat.cas.ts` : « une page par personnalité » attend 4 pages et l'absence de Paul et Nina ; les cas de production « Paul : statut en cours de vérification », « Paul (W2) » et « Nina (W2) » sont supprimés (pages inexistantes ; la phrase W2 n'est plus atteignable en production) ; l'index attend 4 lignes et la nouvelle intro ; le lien « voir la liste complète des candidats » n'existe plus en production ; nouveau cas preview de l'index à six lignes (Paul sans étiquette, pastille). Les cas preview de Paul et Nina sont inchangés.
- `tests/dist/cas/theme.cas.ts` : « 2 autres personnalités … liste complète » devient l'absence du paragraphe en production (aucune autre personnalité dans la fixture).
- Aucune assertion de preview n'a été affaiblie.

## Vérifications

- `npm test` : 2537 tests, 2528 réussis, 0 échec, 9 ignorés (avant : 2519).
- `npm run check` : 0 erreur, 0 avertissement, 0 indice.
- Build de production réelle (`RTP_MODE=production npm run build`) puis `npm run check-dist` : 0 erreur, 3 avertissements attendus (PUBLICATION_VIDE, HEBERGEUR_PREVU x2).
- `npm run e2e -- --jeu m1` : 225 réussis (259 avant : deux pages candidat de moins en production, donc moins de cas par page ; aucun spec à adapter).
- `npm run e2e -- --jeu reel` : 1177 réussis.
- Tests rouges vus avant chaque code : tâche 1 (6 échecs), tâche 2 (3 échecs ; les cas d'absence passaient déjà grâce à la tâche 1), tâche 3 (export manquant, CLI non câblé, ligne RUNBOOK manquante).

## Deviations from Plan

**1. [Rule 3 - Blocking] tests/dist/cas/ordre.cas.ts modifié (hors `files_modified`)**
- Le cas « /candidats/ : le contrôle suit l'introduction » cherchait le paragraphe par `startsWith('Toutes les personnalités')` sur une build de production ; la nouvelle intro de production l'aurait cassé. Il accepte désormais les deux intros (`/^(Toutes les|Les) personnalités du jeu de données/`). Commit 27ba4fe.

**2. [Rule 1 - Honnêteté du texte] Phrases sans « autres » quand personne n'est affiché**
- Le plan donne « {k} autres personnalités … » et « Ce site affiche {n} personnalités … ». Sur le corpus réel d'aujourd'hui, n = 0 : « 59 autres personnalités » sous « Aucun candidat à afficher » et « Ce site affiche 0 personnalités » seraient trompeurs. Variantes ajoutées pour n = 0, pluriels français appliqués partout (1 personnalité, l'autre personnalité, 1 candidature déclarée). Prouvé par un cas dist sur le corpus réel (build `reel-production`, n et k recalculés depuis le contenu, donc toujours juste après 09-10).

**3. Build supplémentaire dans la suite dist**
- Le cas « corpus réel en production » ajoute un build (`reel-production`) à `tests/dist/site.test.ts` ; les autres cas réutilisent `m1-production` et `m1-preview`.

**4. REVISION de la page Méthode passée au 2026-11-11** (le commentaire de la page l'exige à chaque modification du texte).

**5. PUB-02 non coché dans REQUIREMENTS.md**
- Le plan le liste dans `requirements`, mais l'exigence (un thème entièrement relu publié) n'est atteinte qu'à la publication de 09-11 ; même choix que 09-02, la ligne reste « Pending ».

## Known Stubs

Aucun. La branche « Statut en cours de vérification » de `src/pages/candidats/[id].astro` et de l'index n'est plus atteignable en production (personne n'y a `statutAffiche === null`) ni en preview (toujours au moins un statut) ; elle est laissée en place (fichier hors du plan, comportement sûr).

## Threat Flags

Aucun au-delà du modèle de menaces du plan (T-09-76 à T-09-78 atténués et testés).

## Self-Check: PASSED
