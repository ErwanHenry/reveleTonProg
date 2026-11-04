---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 03
subsystem: ui
tags: [astro, view-model, theme-page, css, empty-states, check-dist]

requires:
  - phase: 04-01
    provides: corpus-m1 fixture (materialiserCorpusM1, TRAPPE_BROUILLON)
  - phase: 04-02
    provides: checkDist, cellulesAttendues, single build harness (tests/dist/site.test.ts + cas modules)
provides:
  - "src/lib/corpus/vue.ts: pure view-model (construireCorpus, formatDate, dateMax, phraseCouverture, statutAffiche, labels)"
  - "src/lib/corpus/index.ts: getCorpus(), the only reader of RTP_MODE; legacy helpers re-implemented on it"
  - "Base layout, LecteurNiveaux / Cellule / Mesure / EtatVide components, src/styles/base.css"
  - "/themes/<id>/ pages for every visible theme"
  - "astro.config.mjs pinned to external hashed CSS"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09]

tech-stack:
  added: []
  patterns:
    - "Pure view-model + thin Astro adapter (mode is a parameter of the pure code)"
    - "Production fails closed at build time on a perimeter cell with neither a visible measure nor a coverage case"
    - "Update date computed from displayed content dates (no build clock)"

key-files:
  created:
    - src/lib/corpus/vue.ts
    - src/layouts/Base.astro
    - src/pages/themes/[id].astro
    - src/components/LecteurNiveaux.astro
    - src/components/Cellule.astro
    - src/components/Mesure.astro
    - src/components/EtatVide.astro
    - src/styles/base.css
    - tests/corpus/vue.test.ts
    - tests/ui/styles.test.ts
    - tests/dist/cas/theme.cas.ts
  modified:
    - src/lib/corpus/types.ts
    - src/lib/corpus/index.ts
    - astro.config.mjs
    - tests/repo/astro-config.test.ts

key-decisions:
  - "Corpus gained a `mesures: VueMesure[]` field (all visible measures) beyond the contract, so the legacy getMesuresDe can filter on visibility without walking cells"
  - "index.ts re-exports vue.ts (`export *`) so pages import everything from one module"
  - "A non-perimeter candidate is the only kind listed in `renonces`; a perimeter candidate whose displayed statut is renonce (older relu renonce, newer unreviewed declare) stays a cell (fail-closed A6)"
  - "The renonce line carries its date even without a motif (`{Nom} : ne se présente pas. <time>.`), consistent with the update-date rule"

requirements-completed: [M1-01, M1-08, M1-11, M1-12]

duration: 50min
completed: 2026-11-03
---

# Phase 4 Plan 03: Theme page slice Summary

**Pure tested view-model (`construireCorpus`) feeding static `/themes/<id>/` pages: one card per perimeter candidate with exactly one measure or a typed dated grey empty state, coverage sentence, closed « Ne se présentent pas » section, deterministic update date, external hashed CSS.**

## Performance

- Tasks: 3/3 (TDD: RED `7e3d7c1`, GREEN view-model `5336572`, GREEN pages `01a2a87`)
- `npm test`: 1316 tests, 0 failures; `npm run check`: 0 errors, 0 warnings, 0 hints
- Note: astro builds on the fixture take about 1.5 s each here (warm worktree)

## Accomplishments

- `vue.ts` is pure (no `astro:content`, no `node:`): perimeter by `statutLePlusRecent`, `Intl.Collator('fr')` on `nom_tri` then `id`, cell state machine (`mesures` / `non_precise` / `programme_non_publie` / `non_verifie`), production visibility (`publie` only, themes and measures), coverage counts and sentence, `renonces` and `autresPersonnalites`, `miseAJour` = max of displayed content dates. Production throws with theme and candidate named when a cell cannot be derived.
- `getCorpus()` is memoised and is the only place a page learns the mode (`resolveMode(undefined, process.env)`). Legacy `getCandidats`, `statutCourant`, `getMesuresDe`, `getSource` remain, now on top of `getCorpus()`, so the legacy home page obeys the mode filter (no draft in production `dist/index.html`).
- Theme page, `Base` layout (noindex in preview, skip link, footer date and cookie canary), four components, `base.css` (tokens, 10-theme palette incl. `europe-et-monde`, cards grid, empty states, `details`, focus ring, forced colours; no transition/animation/`!important`).
- `astro.config.mjs`: `build.inlineStylesheets: 'never'` + `vite.build.assetsInlineLimit: 0`, asserted in `tests/repo/astro-config.test.ts`. Built HTML has a single `<link rel="stylesheet">` to `/_astro/*.css`, no `<style>`, no `style=`.
- Tests: `tests/corpus/vue.test.ts` (18), `tests/ui/styles.test.ts` (11), `tests/dist/cas/theme.cas.ts` (15, production and preview builds of corpus-m1, `checkDist` clean in production, trap title absent from every dist file).

## Copy additions (not in the UI-SPEC deck; for review at the 04-09 checkpoint)

- Motif labels (`LIBELLES_MOTIF`): retrait « retrait de la candidature », elimine_primaire « élimination lors d'une primaire », ralliement « ralliement à une autre candidature », non_candidat « déclaration de non-candidature ».
- Autres personnalités line: « 1 autre personnalité du jeu de données ne figure pas ici : voir la liste complète des candidats. » / « {n} autres personnalités du jeu de données ne figurent pas ici : voir la liste complète des candidats. » (adapted from `theme.pressentis`; « voir la liste complète des candidats » becomes a link in 04-06).
- Empty card list: « Aucun candidat dans le périmètre de ce thème pour le moment. » followed by the next step link « Revenir à l'accueil pour choisir un autre thème ».
- Missing enfant/aîné text (drafts in preview): « Cette version n'est pas encore rédigée ; voici la version En bref. » + the résumé.
- Footer with nothing to date: « Aucun contenu publié pour le moment. »
- Renonce line without motif: « {Nom} : ne se présente pas. {date}. »

## Deviations from Plan

### Auto-fixed Issues

None needing a deviation rule. Judgement calls:

1. **Acceptance grep `new Date(|Date.now(` in `src` prints 1, not 0.** The single hit is `src/lib/content-core/ajv.ts:25` (`new Date(0)`, a Phase 2 constant used for ajv date formats, not a clock). Pre-existing and out of scope; nothing added by this plan. No `new Date`/`Date.now` exists in the files of this plan (`formatDate` formats `Date.UTC(...)` numbers).
2. **Trailer.** Commits use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` as instructed by the orchestrator (the plan text said Opus 5.5).
3. **Inspection build.** One manual `astro build` into `/tmp` (removed) to read the generated HTML; no code or file in the repo was produced by it.
4. **Worktree base.** HEAD was already on `d0d869c`, no reset needed. `npm ci` was run (no new dependency).

## Known Stubs

None. Two intentional not-yet-linked pieces, both owned by later plans: card names and « N autres mesures » are plain text until 04-06 creates their targets (the theme intro says « Cliquez sur un nom… » per the UI-SPEC deck, which is only true after 04-06; the site is not deployed between plans); the four rédactions are all shown with visible level labels until 04-05 adds the radio toggle.

## Threat Flags

None. T-04-10 to T-04-14 are mitigated: no `set:html` (grep 0), enfant markers resolved by `sansMarqueurs`; production filter plus trap-absent scan of every dist file; production throws on a missing cell; `rel="noopener noreferrer"` on the external source link; config pinned and `<style>`/`style=` absent from every HTML file.

## Self-Check: PASSED

- Files present: `src/lib/corpus/vue.ts`, `src/layouts/Base.astro`, `src/pages/themes/[id].astro`, `src/components/{LecteurNiveaux,Cellule,Mesure,EtatVide}.astro`, `src/styles/base.css`, `tests/corpus/vue.test.ts`, `tests/ui/styles.test.ts`, `tests/dist/cas/theme.cas.ts`.
- Commits present: `7e3d7c1`, `5336572`, `01a2a87`.
