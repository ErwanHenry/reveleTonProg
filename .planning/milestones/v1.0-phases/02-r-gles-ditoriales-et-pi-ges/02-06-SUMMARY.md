---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 06
subsystem: content-core
tags: [rules, citations, numbers, verbatim, archives, traps, ci, ids-lock, regle-04, regle-05, regle-07, regle-08, regle-10, regle-11]
requires:
  - phase: 02-r-gles-ditoriales-et-pi-ges
    provides: text layer and champsEditoriaux (02-03), lireArchive and corpus rules (02-04), validation mode and poll traps (02-05), rule engine, config.ts and trap harness (02-02), ids-lock module (02-01)
provides:
  - "text/numbers.ts: canonical(), extractNumbers(), extractNumberWords() (decimal strings, no floats)"
  - "text/verbatim.ts: tokens(), fragments(), haystack(), quoteIn() (word-for-word containment after normalization)"
  - "famille 'citations' (entry rule chiffres_citations, corpus rule textes_archives) registered in FAMILLES"
  - "Section 12 trap CHIFFRE_HORS_SOURCE (the seventh and last)"
  - "tests/pieges/couverture.test.ts: 7 traps, catalogue <-> code literals <-> tests, config purity"
  - "npm run ids -- --check --base <fichier>: refuses a locked id removed since the base"
  - "CI pinned on --mode production, ids.lock append-only guard against the base commit"
affects: [02-07, phase-3, phase-4, phase-5]
tech-stack:
  added: []
  patterns:
    - "Figures compared as canonical decimal strings (1,5 milliard = 1 500 millions = 1500000000), units deliberately ignored"
    - "Archive haystack built once per source and memoised in ctx.cache under haystack:<sourceId>"
    - "Archive-dependent checks skipped when lireArchive reports the archive unusable (no cascading errors)"
    - "Coverage meta-test reads source text with regexes, plus imports OVERRIDES directly, so a new code cannot be added without catalogue and test"
    - "CI shell bodies never interpolate GitHub expressions; event values go through env"
key-files:
  created:
    - src/lib/content-core/rules/text/numbers.ts
    - src/lib/content-core/rules/text/verbatim.ts
    - src/lib/content-core/rules/citations.ts
    - tests/text/numbers.test.ts
    - tests/text/verbatim.test.ts
    - tests/rules/citations.test.ts
    - tests/pieges/couverture.test.ts
    - tests/fixtures/pieges/CHIFFRE_HORS_SOURCE/attendu.json
  modified:
    - src/lib/content-core/rules/index.ts
    - scripts/ids.ts
    - .github/workflows/ci.yml
    - tests/repo/ci.test.ts
    - tests/content-core/ids-cli.test.ts
    - tests/content-core/validate-cli.test.ts
    - tests/rules/moteur.test.ts
key-decisions:
  - "CHIFFRE_HORS_SOURCE and NOMBRE_LETTRES_HORS_SOURCE reported once per field and distinct value; the message quotes the canonical value (citer()), not the raw token"
  - "An empty or « » quotation is refused (CITATION_HORS_SOURCE): quoteIn() is false when no fragment remains"
  - "--base reads the base lock with lireIdsLock and ignores the base file's own problems; only base ids missing from the current lock are reported, positioned in the base file at the id's line"
  - "CI base selection: merge-base of origin/<base_ref> and HEAD on pull_request, github.event.before on push; skips with an explanation (and a ::warning for an unknown commit after a history rewrite) rather than failing"
patterns-established:
  - "Test inputs for in-memory archive changes append to the tmp archive and recompute sha256 in the source file (avecArchive helper), so the sha256 family stays quiet"
requirements-completed: [REGLE-04, REGLE-05, REGLE-07, REGLE-10, REGLE-11, REGLE-08]
duration: ~50min
completed: 2026-11-03
---

# Phase 2 Plan 06: Chaque chiffre et chaque citation remontent à la source archivée Summary

**A figure or « … » quotation that is not word for word in the archived primary source now fails with its file, line and code, the last of the seven section 12 traps is a fixture guarded by a coverage meta-test, and CI validates in production mode and refuses any ids.lock line removed since the base commit.**

## Performance

- Duration: ~50 min
- Tasks: 3/3 (Task 1 as RED then GREEN commits)
- Files: 8 created, 7 modified

## Task Commits

1. Task 1 RED, trap and failing tests: `0bb5a76`
2. Task 1 GREEN, figures, quotes and archive containment (REGLE-04, REGLE-05): `76a6e4e`
3. Task 2, section 12 coverage meta-test and CLI mode end to end (REGLE-10, REGLE-11, REGLE-08): `28dbe8b`
4. Task 3, CI on production mode and ids.lock append-only guard: `cbd959b`

## Accomplishments

- `CHIFFRE_HORS_SOURCE` on résumé, enfant, aîné for any figure absent from `texte_source` and `chiffrage.texte`; `50 000`, `50000`, `50 000` (NBSP, NNBSP) and `50.000` are equal; the détaillé is not checked (open question 9); number words absent from the source give the `NOMBRE_LETTRES_HORS_SOURCE` warning.
- `CITATION_HORS_SOURCE` for every « … » span of every editorial field of a measure (titre and the four rédactions), checked against `texte_source` through `quoteIn()`.
- `TEXTE_SOURCE_HORS_ARCHIVE` and `CHIFFRAGE_HORS_ARCHIVE` close the laundering hole (a figure is trusted from `chiffrage` only once the chiffrage is itself in the archive); both are skipped when `lireArchive` says the archive is unusable, so a deleted archive yields only `ARCHIVE_ABSENTE`.
- `TEXTE_SOURCE_TROP_COURT` (< 4 words) and `TEXTE_SOURCE_TROP_LONG` (> 120 words) warnings; 120 words stays silent, verified with an overlay archive whose sha256 matches.
- Trap 6 (`CHIFFRE_HORS_SOURCE`): enfant `50 000` becomes `30 000`, exactly one error on `/redactions/enfant`.
- `couverture.test.ts`: exactly seven catalogue codes carry a section 12 trap and each has `tests/fixtures/pieges/<CODE>/attendu.json` expecting that code as an error; the pure `verifierCouverture()` is self-tested on a list lacking `SONDAGE_FENETRE_BLOCAGE`; every code literal in `rules/`, `OVERRIDES` (except `SCHEMA_VERSION_OBSOLETE`), `CodeIds` and `ID_CHEMIN_INCOHERENT` is in the catalogue; every catalogue code appears in a test file other than the meta-test itself; `config.ts` has no runtime import and exports the 14 Méthode page symbols; hypotheses are A1 to A12.
- `validate-cli.test.ts`: on the `EQUITE_CANDIDAT_MANQUANT` root, preview gives `::warning` on the `statut_relecture` line and exit 0, production gives `::error` and exit 1; `RTP_MODE=preview` acts as the flag; `--mode production` beats `RTP_MODE=preview`; default is production.
- `scripts/ids.ts`: `--check --base <fichier>` reports `ID_VERROUILLE_DISPARU` positioned in the base file ("identifiant « x » retiré de ids.lock depuis la base : interdit"); a missing base file or `--base` without `--check` exits 2 with usage.
- `ci.yml`: both validate steps run `npm run validate -- --mode production --format github`; verifier checkout has `fetch-depth: 0` and keeps `persist-credentials: false`; new step "ids.lock en ajout seul (comparé au commit de base)" with `RTP_CONTENT_ROOT: "."`, event values only through `env`.

## Deviations from Plan

### Allowed edits outside `files_modified`

1. **`tests/rules/moteur.test.ts`** (cross-family interaction, executor rule): the "registre par défaut" test pinned `FAMILLES` to `['redaction', 'corpus', 'sondages']`; it now expects `citations` last and its title no longer says "trois familles vides". No rule was loosened.
2. No constant had to be moved into `rules/config.ts`: none of the 02-03/02-04/02-05 SUMMARYs reported a locally defined constant, and `config.ts` already held `CHAMPS_CHIFFRES`, `TEXTE_SOURCE_MOTS` and `NORMALISATION_CITATIONS`.

### Auto-fixed Issues

**1. [Rule 1 - Bug] YAML plain scalar with ": " in a test input**
- **Found during:** Task 1 GREEN
- **Issue:** the chiffrage text `Coût estimé : 2 milliards d'euros.` produced `YAML_BLOCK_AS_IMPLICIT_KEY` in the in-memory test, hiding the property under test.
- **Fix:** test text reworded to `Coût estimé de 2 milliards d'euros.`
- **Files modified:** tests/rules/citations.test.ts
- **Commit:** 76a6e4e

**2. [Rule 1 - Bug] Unused import flagged by astro check**
- **Found during:** Task 1 GREEN
- **Issue:** `foldKey` imported but unused in citations.ts (ts 6133 hint).
- **Fix:** removed the import.
- **Files modified:** src/lib/content-core/rules/citations.ts
- **Commit:** 76a6e4e

### Notes

- The RED commit for Task 1 holds the trap and three failing test files (the two pure modules did not exist yet), as the plan asks.
- Task 2 is a meta-test over already-complete code, so its tests passed on first run; it was validated by the self-test of `verifierCouverture()` and by the guard test that checks the code-literal detector actually sees known codes.
- `.planning/ROADMAP.md` showed as modified in `git status` during the run; it is not from this plan (never staged by it).

## Known Stubs

None.

## Threat Flags

None. T-02-26 to T-02-32 are mitigated as planned: canonical decimal comparison (no float), chiffrage trusted only once archived, every « … » span verified, haystack memoised per source (5 MB archive cap from 02-04, linear token regexes), both CI validate steps pinned on production and asserted by `tests/repo/ci.test.ts`, the coverage meta-test, and the ids.lock base comparison with no `${{ }}` inside shell bodies (asserted).

## Verification (full gate, all exit 0)

- `npm run migrate -- --check`
- `npm run validate -- --mode production --format github` on the default root and with `RTP_CONTENT_ROOT=.`
- `npm run ids -- --check`; `npm run ids -- --check --base tests/fixtures/corpus-valide/ids.lock --root tests/fixtures/corpus-valide` exits 0
- `npm run check`: 0 errors
- `npm test`: 884 tests, 884 pass, 0 fail (808 before this plan)
- `npm run build`: 1 page built; `grep -c "<script" dist/index.html` prints 0
- Acceptance greps: `lireArchive(` 1 in citations.ts, `citations` in index.ts, no `node:` import in numbers.ts and verbatim.ts, `--mode production --format github` 2 in ci.yml, `npm run ids -- --check --base` 1, `fetch-depth: 0` 2, no `run:.*${{` line.
- The CI base-selection script was extracted from the workflow and run locally for four cases (known base commit, all-zeros base, unknown commit, base without ids.lock): exits 0 each time with the expected message.

## Self-Check: PASSED

- Files present: numbers.ts, verbatim.ts, citations.ts, numbers.test.ts, verbatim.test.ts, citations.test.ts, couverture.test.ts, CHIFFRE_HORS_SOURCE/attendu.json.
- Commits present: 0bb5a76, 76a6e4e, 28dbe8b, cbd959b.
