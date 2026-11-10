---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 02
subsystem: publication, validator, post-build control
tags: [liste-blanche, publication, content-core, check-dist, view-model]

requires:
  - phase: 02
    provides: content-core corpus rules, CATALOGUE
  - phase: 07
    provides: check-dist, strict config readers (site-config discipline)
provides:
  - config/publication.yml (themes_ouverts, created empty)
  - src/lib/publication-config.ts (loadPublicationConfig, strict, read from the content root)
  - src/lib/publication-ouverture.ts (pure estOuvert, single definition of an open theme)
  - REGLE-13 with PUBLICATION_THEME_NON_OUVERT, PUBLICATION_THEME_OUVERT_NON_PUBLIE, PUBLICATION_THEME_INCONNU, PUBLICATION_LISTE_INVALIDE
  - construireCorpus(brut, mode, themesOuverts?) production filter, always passed by the Astro adapter
  - check-dist THEME_HORS_LISTE_BLANCHE, THEME_OUVERT_ABSENT, PUBLICATION_VIDE
affects: [09-11, 09-12, 09-14, 09-15]

tech-stack:
  added: []
  patterns:
    - "Asymmetric severities: published but not open is an error in production; open but not published, or nothing open, is a warning so an emergency withdrawal still deploys"
    - "The whitelist only narrows what `publie` shows, in the validator, the view-model and check-dist alike"

key-files:
  created:
    - config/publication.yml
    - src/lib/publication-config.ts
    - src/lib/publication-ouverture.ts
    - src/lib/content-core/rules/publication.ts
    - tests/corpus/publication-config.test.ts
    - tests/rules/publication.test.ts
    - tests/dist/cas/publication.cas.ts
    - tests/fixtures/corpus-valide/config/publication.yml
    - tests/fixtures/corpus-m1/config/publication.yml
  modified:
    - src/lib/content-core/rules/corpus.ts
    - src/lib/content-core/rules/config.ts
    - src/lib/corpus/vue.ts
    - src/lib/corpus/index.ts
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - tests/helpers/corpus-m1.ts
    - tests/corpus/vue.test.ts
    - tests/scripts/check-dist.test.ts
    - tests/rules/moteur.test.ts
    - docs/RUNBOOK.md

key-decisions:
  - "The list is read from the content root (project root for the real corpus), a missing file equals an empty list, no memo"
  - "config/publication.yml starts empty: opening `sante` is the explicit decision of the publication commit (09-11)"
  - "Pure estOuvert lives in publication-ouverture.ts and is re-exported by publication-config.ts, because vue.ts must stay free of node: imports"

requirements-completed: [PUB-02]

duration: 45min
completed: 2026-11-10
---

# Phase 9 Plan 02: Liste blanche de publication Summary

**A theme reaches production only if it is `publie` and listed in `config/publication.yml` (created empty): the validator, the page view-model and check-dist all apply the same intersection, and the safe direction only warns.**

## Task Commits

1. **Task 1: whitelist file, strict reader, rule REGLE-13, catalogue and RUNBOOK rows**: `7ea9992`
2. **Task 2: view-model filter and check-dist codes**: `07fe2b1`

## Verification

- `npm test`: all green (e2e: 259 passed; the dist suite was re-run alone after a collision with a second concurrent `astro build` that I started by mistake; 169 of 169 pass).
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run validate -- --mode production`: 391 files, 0 errors, 25 warnings (unchanged). Fixture `corpus-valide` in production: 0 errors.
- Dist case `publication.cas.ts`: the M1 corpus builds with `logement` and `climat`; a list cut to `logement` makes the validator report `PUBLICATION_THEME_NON_OUVERT` on `climat` and check-dist report `THEME_HORS_LISTE_BLANCHE`.

## Deviations from Plan

**1. [Rule 3 - Blocking] estOuvert placed in a pure module**
- **Issue:** the plan wanted the shared helper exported by `src/lib/publication-config.ts`, which imports `node:fs`; `src/lib/corpus/vue.ts` is declared pure (no `node:` import) and a test relies on it.
- **Fix:** `estOuvert` is defined in the new `src/lib/publication-ouverture.ts` and re-exported by `publication-config.ts`; vue.ts imports the pure module, check-dist and the rule use either path. Still one definition.
- **Commit:** second task commit.

**2. [Rule 1 - Consistency] Catalogue size assertion**
- `tests/rules/moteur.test.ts` asserted 42 catalogue codes; it now asserts 46 (the four new codes). Not a weakened assertion.

**3. Corpus M1 test of measures**
- The M1 `climat` theme has no published measure, so the view test asserts that `climat` is absent and that all remaining measures belong to `logement`, instead of showing `climat` measures disappearing.

## Known Stubs

None. `themes_ouverts: []` is intentional until the publication commit of 09-11.

## Threat Flags

None beyond the plan's threat model (T-09-07 to T-09-09 mitigated and tested).

## Self-Check: PASSED
