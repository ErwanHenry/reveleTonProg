---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 01
subsystem: testing
tags: [fixtures, corpus, content-core, overlay]
requires:
  - phase: 02
    provides: loadAll validation engine, ids.lock tooling, corpus-valide fixture
provides:
  - tests/fixtures/corpus-m1 overlay (13 fictional files) layered on corpus-valide
  - tests/helpers/corpus-m1.ts (materialiserCorpusM1, nettoyerCorpusM1, CORPUS_M1, TRAPPE_BROUILLON, SURCHARGES_AUTORISEES, CLI)
  - tests/corpus/corpus-m1.test.ts (13 scenario assertions)
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09]
tech-stack:
  added: []
  patterns: [overlay-on-base fixture with temp-dir materialisation, explicit allow-list of overridden base paths]
key-files:
  created:
    - tests/helpers/corpus-m1.ts
    - tests/corpus/corpus-m1.test.ts
    - tests/fixtures/corpus-m1/ids.lock
    - tests/fixtures/corpus-m1/src/content/candidats/elise-erard.yaml
    - tests/fixtures/corpus-m1/src/content/candidats/paul-de-villefranche.yaml
    - tests/fixtures/corpus-m1/src/content/candidats/luc-retire.yaml
    - tests/fixtures/corpus-m1/src/content/candidats/nina-pressentie.yaml
    - tests/fixtures/corpus-m1/src/content/themes/climat.yaml
    - tests/fixtures/corpus-m1/src/content/themes/ecole.yaml
    - tests/fixtures/corpus-m1/src/content/couverture/logement.yaml
    - tests/fixtures/corpus-m1/src/content/couverture/climat.yaml
    - tests/fixtures/corpus-m1/src/content/mesures/marie-fictive/aide-construction.yaml
    - tests/fixtures/corpus-m1/src/content/mesures/elise-erard/guichet-unique.yaml
    - tests/fixtures/corpus-m1/src/content/sources/programme-commun-fictif.yaml
    - tests/fixtures/corpus-m1/archives/programme-commun-fictif/c3107ed7287b.txt
  modified: []
key-decisions:
  - "Archive extract named c3107ed7287b.txt (sha256 c3107ed7287b072c38461027ac295a334cfcdd7076821cbaf9a78a0bb465e2b5), LF endings, covered by the existing tests/fixtures/**/archives/** -text attribute"
  - "The overlay overrides exactly ids.lock and couverture/logement.yaml; the list is exported as SURCHARGES_AUTORISEES and asserted by the test"
requirements-completed: [M1-01, M1-07, M1-11]
duration: 25min
completed: 2026-11-03
---

# Phase 4 Plan 01: Fictional M1 corpus overlay Summary

**Overlay `tests/fixtures/corpus-m1` + `materialiserCorpusM1()` helper giving every Phase 4 page slice a valid 6-candidate fictional corpus (renonce, pressenti, unreviewed statut, typed empty states, glossary markers, a draft trap) without touching `corpus-valide`.**

## Performance

- Tasks: 2/2 (TDD: RED then GREEN)
- Files: 13 overlay files, 1 helper, 1 test

## Accomplishments

- `materialiserCorpusM1(dest?)` copies `corpus-valide` then the overlay into a temp dir (or an empty `dest`); `nettoyerCorpusM1()` only removes roots it created; CLI: `node tests/helpers/corpus-m1.ts <dest>`.
- Materialised corpus validates with 0 errors and 0 warnings in `production` and `preview`; `ids --check` exits 0 (6 candidates, 6 locked).
- Scenario test (13 assertions) covers: distinct roots, cleanup, allowed overrides only, both modes, ids check, equity perimeter = {elise-erard, jean-imaginaire, marie-fictive, paul-de-villefranche}, accented `nom_tri` (Érard), particle (de Villefranche -> Villefranche), unreviewed statut (paul), `renonce`/`retrait`/relu (luc-retire), `pressenti` (nina-pressentie), themes logement + climat published (only logement `prioritaire_aine`) and ecole `relu`, `non_precise` and `programme_non_publie` states, 2 marie-fictive measures on logement with `[[loyer]]` and `[[Parti Imaginaire|parti-imaginaire]]`, trap phrase `Guichet unique départemental` only in the brouillon measure title, all overlay URLs on `.invalid` (wayback envelope excepted).

## Task Commits

1. Task 1 (RED): `549ce92` test(04-01): failing scenario test for the M1 fixture corpus
2. Task 2 (GREEN): `8f37c70` test(04-01): corpus-m1 overlay for the M1 pages

## Deviations from Plan

**1. [Rule 1 - Bug] Marker-order assertion**
- **Found during:** Task 2
- **Issue:** the RED test asserted `[[loyer]]` before `[[Parti Imaginaire|...]]`, but the enfant text (written for sentence-length limits) mentions the party first.
- **Fix:** assertion compares the sorted marker set. Included in commit `8f37c70`.
- **Files modified:** tests/corpus/corpus-m1.test.ts

**2. Orchestrator base reset**
- The worktree started on `0672303`; per the orchestrator's instruction it was reset to `3e90269` before any work. Trailer uses `Claude Sonnet 5.5` as instructed by the orchestrator (the plan text said Opus 5.5).

Otherwise: plan executed as written. `npm ci` was run in the worktree (no new dependency).

## Issues Encountered

One validator error on first pass (`LONGUEUR_HORS_BORNES`: elise-erard/guichet-unique enfant had 61 words, max 60); fixed by trimming one word. No validator warnings remain (0 in both modes).

## Known Stubs

None. All content is intentionally fictional test data.

## Threat Flags

None. Mitigations T-04-01 to T-04-03 are in place: `.invalid` hosts asserted by test and grep, `corpus-valide` untouched (`git diff 3e90269 -- tests/fixtures/corpus-valide` is empty), `nettoyerCorpusM1` never deletes a caller-supplied `dest`.

## Verification

- `node --test tests/corpus/corpus-m1.test.ts`: 13 pass, 0 fail
- `validate.ts --mode production|preview` and `ids.ts --check` on a materialised dir: exit 0
- `find tests/fixtures/corpus-m1 -type f | wc -l` = 13; acceptance greps (non-.invalid URLs = 0, trap phrase files = 1) pass
- `tsc --noEmit` reports nothing for the new files

## Self-Check: PASSED

- Created files exist (13 overlay files, helper, test): FOUND
- Commits `549ce92`, `8f37c70`: FOUND
