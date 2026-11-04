---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 06
subsystem: ui
tags: [astro, candidate-pages, hall, navigation, cross-links, view-model, css]

requires:
  - phase: 04-03
    provides: view-model (construireCorpus), Base layout, theme page, Cellule / Mesure / EtatVide
  - phase: 04-04
    provides: BadgeBrouillon, preview marking, Base avecSignalement
  - phase: 04-05
    provides: LecteurNiveaux (toggle, ConcerneAine), niveaux.css
provides:
  - "vue.ts: pageCandidat(id), miseAJourIndex(), depuis(), texteSource(), SectionCandidat, PageCandidat"
  - "/candidats/<id>/ for every personality, /candidats/, /themes/, and the hall at /"
  - "Header « Navigation principale » with aria-current, theme <-> candidate cross-links"
  - "src/styles/pages.css, StatutCandidat and TuileTheme components"
affects: [04-07, 04-08, 04-09]

tech-stack:
  added: []
  patterns:
    - "Candidate section id = theme id (ConcerneAine links #<theme>); card link /candidats/<id>/#<theme> and back /themes/<theme>/#c-<id>"
    - "Whole-tile click target through a ::after overlay on the tile link"
    - "Current nav section derived from Astro.url.pathname (no page prop)"

key-files:
  created:
    - src/pages/candidats/[id].astro
    - src/pages/candidats/index.astro
    - src/pages/themes/index.astro
    - src/components/StatutCandidat.astro
    - src/components/TuileTheme.astro
    - src/styles/pages.css
    - tests/corpus/vue-candidat.test.ts
    - tests/dist/cas/candidat.cas.ts
  modified:
    - src/lib/corpus/vue.ts
    - src/lib/corpus/index.ts
    - src/pages/index.astro
    - src/pages/themes/[id].astro
    - src/components/Cellule.astro
    - src/layouts/Base.astro
    - tests/dist/cas/squelette.cas.ts

key-decisions:
  - "badgeStatut is BADGES.brouillon only for a brouillon statut; a relu statut carries no badge (it is what production shows)"
  - "A perimeter candidate's section reuses the theme cell (cellule.mesures already holds every visible measure of the pair); a non-perimeter candidate gets a synthetic cell in state mesures"
  - "The « Voir tous les candidats sur le thème X » link carries the #c-<id> fragment only for perimeter candidates (others have no card on the theme page)"
  - "Production page of a personality with no reviewed statut and nothing to show (Nina) has no date to display: its footer says « Aucun contenu publié pour le moment. »"

patterns-established:
  - "cas module candidat.cas.ts is the first by alphabetical order, so it builds m1-production / m1-preview (memoised by key) from its own ctx.tmp() root"

requirements-completed: [M1-02, M1-03, M1-12]

duration: 40min
completed: 2026-11-03
---

# Phase 4 Plan 06: Candidate pages, hall and navigation Summary

**Every personality has a page (`/candidats/<id>/`) with name, claimed party, dated statut sentence with source link (production: last reviewed statut, else « Statut en cours de vérification ») and one section per published theme; the hall, `/themes/` and `/candidats/` replace the skeleton, and theme cards, renonce lines, breadcrumbs and the new header navigation link everything both ways.**

## Performance

- Tasks: 3/3 (TDD: RED `eb6ec5d`, view-model `343abd8`, pages `f95fdb2`)
- `npm test`: 1420 tests, 0 failures; `npm run check`: 0 errors, 0 warnings, 0 hints
- checkDist (links and fragments included) clean on corpus-m1 production and preview, corpus-valide production, and the empty root

## Accomplishments

- `vue.ts`: `pageCandidat(id)` (sections in theme `ordre`, statut = `statutAffiche`, `badgeStatut`, `miseAJour` = max of displayed statut date and source consultation, shown measures' relecture and source dates, case `verifie_le`), `miseAJourIndex()`, `depuis()`, `texteSource()`. Legacy helpers `getCandidats`, `statutCourant`, `getMesuresDe`, `getSource` removed from `index.ts`.
- Pages: candidate page (focal point h1 + statut block; sections `section#<theme>[data-theme]` with the h2 in the theme colour, all measures through `Mesure` h3 or the typed empty state, back link to the theme card), `/candidats/` (`ul.lignes[data-ordonnable]`, `li[data-rang]`), `/themes/` and the hall (`TuileTheme` tiles). Every list has an empty state with a next step.
- Cross-links: card name and « N autres mesures » to `/candidats/<id>/#<theme>`; renonce names to `/candidats/<id>/`; « voir la liste complète des candidats » to `/candidats/`; breadcrumb « Thèmes » to `/themes/`.
- `Base.astro`: `nav[aria-label="Navigation principale"]` (Thèmes, Candidats; `aria-current="page"` from the path prefix) and `pages.css` import.
- Tests: `vue-candidat.test.ts` (12), `candidat.cas.ts` (17, both modes), `squelette.cas.ts` (a) and (b) rewritten against the candidate page and the hall (4 cases kept).

## Copy additions (not in the UI-SPEC deck; for review at the 04-09 checkpoint)

- Candidate page, no section: « Aucune mesure n'est présentée pour cette personnalité : les thèmes couvrent les candidatures déclarées et les candidatures à une primaire. » + « Voir les thèmes »; perimeter candidate with no published theme: « Aucun thème n'est publié pour le moment. » + « Voir la liste des candidats ».
- Empty lists: « Aucun thème publié pour le moment. » + « Consulter la liste des candidats »; « Revenir à l'accueil » under « Aucun candidat à afficher pour le moment. ».
- Meta descriptions of `/themes/` and `/candidats/` (the deck has titles only): « Les thèmes publiés, avec le nombre de candidats concernés. » and « Toutes les personnalités du jeu de données, avec leur parti revendiqué et leur statut. ».
- Hall `dl`: the deck's `hall.niveau.*` strings are split into `dt` (level label) and `dd` (rest of the sentence, first letter capitalised: « Une phrase par mesure. »), instead of the deck's « En bref : une phrase par mesure. ».
- Tile count: « 1 candidat » / « {n} candidats » (« 0 candidat » when a theme has no perimeter candidate).
- Breadcrumbs on `/themes/` and `/candidats/` (Accueil / page).

## Deviations from Plan

### Auto-fixed Issues

None needing a deviation rule. Judgement calls:

1. **Trailer.** Commits use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` as instructed by the orchestrator (the plan text said Opus 5.5).
2. **Worktree base.** The worktree started on `d0d869c` and was reset to `812c857` (phase 4 integration commit) as instructed; `npm ci` run, no dependency added.
3. **Nina's footer.** Plan says every page shows its date; a personality with no reviewed statut and no section has nothing dated to show in production, so the footer reads « Aucun contenu publié pour le moment. » (the existing Base fallback). The test accepts either form for candidate pages.
4. **Cas module ownership of builds.** `candidat.cas.ts` sorts first, so it triggers the memoised `m1-production` / `m1-preview` builds from its own `ctx.tmp()` root; `theme.cas.ts` reuses them (same content). `nettoyerCorpusM1` is not called.

## Note for Phase 3 plan 03-09 (src/pages/index.astro)

`src/pages/index.astro` is replaced by the hall: none of the skeleton strings « Données fictives » / « à des fins de test » remain (the footer canary now lives in `Base.astro` and is asserted on a candidate page in `squelette.cas.ts`). Plan 03-09's relabel of those strings therefore applies nowhere; any assertion it adds on them in `tests/dist/cas/squelette.cas.ts` must be written against the hall or the candidate page.

## Known Stubs

None. The `/candidats/` intro says « dans l'ordre choisi ci-dessus » (deck wording) but the order control it refers to arrives with plan 04-08 (`data-ordonnable` / `data-rang` are already emitted); the site is not deployed between plans.

## Threat Flags

None beyond the plan's register. T-04-25 (production shows only a relu/publie statut, else « Statut en cours de vérification »; tested on Paul and Nina), T-04-26 (Astro escaping, no `set:html`, external statut link `rel="noopener noreferrer"`), T-04-27 (rows and cards in build-time collation order via `data-rang`; no colour bound to a candidate or party; theme colour only on theme sections and tiles), T-04-28 (checkDist LIEN_INTERNE_CASSE incl. fragments clean in both modes; every empty list offers a next step) are mitigated.

## Self-Check: PASSED

- Files present: `src/pages/candidats/[id].astro`, `src/pages/candidats/index.astro`, `src/pages/themes/index.astro`, `src/components/StatutCandidat.astro`, `src/components/TuileTheme.astro`, `src/styles/pages.css`, `tests/corpus/vue-candidat.test.ts`, `tests/dist/cas/candidat.cas.ts`.
- Commits present: `eb6ec5d`, `343abd8`, `f95fdb2`.
