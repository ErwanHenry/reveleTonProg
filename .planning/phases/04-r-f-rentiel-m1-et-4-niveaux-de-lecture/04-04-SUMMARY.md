---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 04
subsystem: ui
tags: [astro, source-block, report-links, site-config, preview-mode, robots, badges]

requires:
  - phase: 04-03
    provides: Base layout, Mesure / EtatVide components, getCorpus() and view-model (badge, ancre), single build harness
provides:
  - "config/site.yml + loadSiteConfig(): strict reader of the public contact (placeholder .invalid) and GitHub depot"
  - "src/lib/corpus/signalement.ts: lienMailto, lienIssue, lienExtrait (pure, encodeURIComponent)"
  - "Complete source block under every measure (original, Wayback, archived extract with sha256, two report links)"
  - "Preview markers: BadgeBrouillon, banner, noindex, robots.txt endpoint; none in production"
affects: [04-06, 04-07, 04-09]

tech-stack:
  added: []
  patterns:
    - "Public configuration read from the project root (config/site.yml), never from the content root"
    - "Preview marker classes kept out of the production stylesheet (banner styled through a second class)"
    - "Each cas module materialises its own corpus-m1 root in ctx.tmp() (nettoyerCorpusM1 is global)"

key-files:
  created:
    - config/site.yml
    - src/lib/site-config.ts
    - src/lib/corpus/signalement.ts
    - src/components/BadgeBrouillon.astro
    - src/pages/robots.txt.ts
    - tests/corpus/site-config.test.ts
    - tests/corpus/signalement.test.ts
    - tests/dist/cas/source.cas.ts
    - tests/dist/cas/modes.cas.ts
  modified:
    - src/components/Mesure.astro
    - src/components/EtatVide.astro
    - src/layouts/Base.astro
    - src/pages/themes/[id].astro
    - src/styles/base.css

key-decisions:
  - "Banner carries two classes, banniere-preview (what checkDist looks for) and bandeau-apercu (what base.css styles), so the production stylesheet contains no preview marker and the « no file of dist » assertion can be literal"
  - "Theme badge sits next to the h1 in a div.theme-entete, not inside the h1, so the heading text and accessible name stay clean"
  - "Archived extract link: content root inside the project gives blob/main/<relative root>/<extrait>, otherwise blob/main/<extrait> (test temp roots); path segments encoded, never a '..'"
  - "Report sentence is rendered by Base (avecSignalement) after the main content, once per page, only when the page shows a measure"

patterns-established:
  - "Mesure title row: div.mesure-entete = heading + BadgeBrouillon (flex, space-between)"
  - "Production build proves the absence of preview strings over every dist file, not only HTML"

requirements-completed: [M1-04, M1-11]

duration: 35min
completed: 2026-11-03
---

# Phase 4 Plan 04: Source, report links and preview markers Summary

**Every measure now shows its primary source (title, date, original, Wayback, sha256-labelled extract on GitHub) and two pre-filled, RFC 6068-encoded report links driven by a strict config/site.yml; preview builds carry a banner, text badges, noindex and `Disallow: /`, and the production dist carries none of it.**

## Performance

- Tasks: 3/3, commits `52e292d`, `521251c`, `cce8654`
- `npm test`: 1357 tests, 0 failures; `npm run check`: 0 errors, 0 warnings, 0 hints
- New tests: `site-config.test.ts` (14), `signalement.test.ts` (9), `source.cas.ts` (7), `modes.cas.ts` (9)

## Accomplishments

- `loadSiteConfig(projectRoot)`: yaml `core` schema, unique keys, no aliases, unknown keys rejected, contact and depot regexes from the plan, memoised per root; every error message names `config/site.yml`. A `.invalid` contact sets `contactProvisoire` and prints one warning (« contact provisoire (.invalid) : à remplacer au lot 3 »).
- `lienMailto` (spaces `%20`, CRLF `%0D%0A`, no `+`), `lienIssue` (no `labels=`, no `template=`), `lienExtrait` (GitHub blob on `main`, never `..`). Unit tests assert exact output, including a hostile id.
- `Mesure.astro`: source block in the UI-SPEC C5 order; both report links carry a `.sr-only` suffix « sur la mesure « {titre} » »; the page path given to the mailto is `Astro.url.pathname#ancre` (a path, never an absolute URL). No contact or repository is hard-coded in any `.astro` file.
- `Base.astro`: `avecSignalement` prop adds the « Vous avez repéré une erreur ? … » sentence just before the footer; the theme page sets it when it shows at least one measure.
- Preview: `BadgeBrouillon` (text, dashed border, `data-badge`) in the measure title row, in `non_verifie` empty states and next to the theme h1; banner under the header; `robots.txt` endpoint (`Disallow: /` in preview, `Allow: /` in production); noindex was already emitted by Base in preview only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `nettoyerCorpusM1()` is global and deleted other modules' roots**
- **Found during:** Task 2 (first `site.test.ts` run)
- **Issue:** the plan's pattern (`materialiserCorpusM1()` + `after(nettoyerCorpusM1)`) makes the `after` of the first-running cas module (`source`) delete the temp roots that `theme.cas.ts` had already materialised at declaration time, so its preview build failed with `RACINE_INTROUVABLE`.
- **Fix:** `source.cas.ts` and `modes.cas.ts` materialise into `path.join(ctx.tmp(), 'corpus-m1')` (explicit `dest`, cleaned by the harness) and do not call `nettoyerCorpusM1`. `theme.cas.ts` is untouched. A later module that uses the global cleanup would still break the ones declared after it; worth knowing for 04-06 to 04-09.
- **Files modified:** `tests/dist/cas/source.cas.ts`, `tests/dist/cas/modes.cas.ts`
- **Commit:** `521251c`, `cce8654`

**2. [Rule 2 - Missing critical] Production dist must contain no preview marker in any file, including the stylesheet**
- **Found during:** Task 3 design
- **Issue:** styling `.banniere-preview` / `[data-badge]` in `base.css` would put those strings in the hashed `_astro/*.css` of the production dist, contradicting « no file of dist contains … `data-badge` or `banniere-preview` ».
- **Fix:** the banner has two classes (`banniere-preview` for checkDist, `bandeau-apercu` for CSS) and the badge is styled through `.badge`. The production test scans every file of dist (not only HTML) and passes.
- **Commit:** `cce8654`

**3. Trailer.** Commits use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` as instructed by the orchestrator (the plan text said Opus 5.5).

**4. Worktree base.** The worktree started on `d0d869c`; reset to `f62b43e` (04-03 result) as instructed. `npm ci` run, no dependency added.

**5. Builds.** `tests/dist/site.test.ts` was run in this worktree (the plan's verify commands require it); it builds into per-run temp dirs inside this worktree, so it cannot clash with plan 04-05 in its own worktree.

## Copy additions (not in the UI-SPEC deck)

None. The theme page keeps the badge outside the h1 text; the banner and badge texts are the deck's `preview.banniere`, `badge.brouillon`, `badge.relu`.

## Known Stubs

None. The contact `contact@domaine-a-definir.invalid` is an intentional placeholder (CONTEXT / orchestrator decision), replaced at Lot 3 when the domain is bought; the build prints a warning until then.

## Threat Flags

None beyond the plan's register. T-04-15 (encodeURIComponent on every component, exact-output tests), T-04-16 (config-only contact, acceptance grep prints 0), T-04-18 (noindex on every page + `Disallow: /`, checkDist PREVIEW_INDEXABLE clean in `modes.cas`), T-04-19 (text badges; production dist has none), T-04-20 (no `archives/` directory in dist, no on-site link to it) are mitigated.

## Self-Check: PASSED

- Files present: `config/site.yml`, `src/lib/site-config.ts`, `src/lib/corpus/signalement.ts`, `src/components/BadgeBrouillon.astro`, `src/pages/robots.txt.ts`, `tests/corpus/site-config.test.ts`, `tests/corpus/signalement.test.ts`, `tests/dist/cas/source.cas.ts`, `tests/dist/cas/modes.cas.ts`.
- Commits present: `52e292d`, `521251c`, `cce8654`.
