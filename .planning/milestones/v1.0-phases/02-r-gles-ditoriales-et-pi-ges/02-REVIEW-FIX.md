---
phase: 02-r-gles-ditoriales-et-pi-ges
fixed_at: 2026-11-03T17:00:00Z
review_path: .planning/phases/02-r-gles-ditoriales-et-pi-ges/02-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/02-r-gles-ditoriales-et-pi-ges/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 16 (CR-01 to CR-04, WR-01 to WR-12; Info findings IN-01 to IN-08 are out of scope for `critical_warning`)
- Fixed: 16 (one of them, WR-10, is a documented deferral rather than code)
- Skipped: 0

Full gate green after the last commit: `npm run migrate -- --check && npm run validate -- --mode production && npm run ids -- --check && npm run check && npm test && npm run build` (994 tests, 0 failures; `astro check` 0 errors; also `validate` on the real root `RTP_CONTENT_ROOT=.`). No new dependency.

Status wording: findings classified as logic changes are marked "fixed: requires human verification" because tier 1 and tier 2 checks only prove syntax; each one carries a regression test that pins the intended behaviour.

## Fixed Issues

### CR-01: Invisible and format characters hide a forbidden word

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/text/normalize.ts`, `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/redaction.ts`, `src/lib/content-core/rules/text/forbidden.ts`, `docs/RUNBOOK.md`, `tests/text/forbidden.test.ts`, `tests/rules/redaction.test.ts`
**Commit:** 9304ae2
**Applied fix:** `INVISIBLE` now strips every `\p{Cf}` and `\p{Co}` character plus the fillers that are not Cf (U+034F, U+115F, U+1160, U+17B4/5, U+180E, U+3164, U+FE00-FE0F, U+FFA0). `CARACTERES_SUSPECTS` became an allowlist (anything outside Latin, Common and Inherited, plus Cf/Co) and also flags Latin look-alikes (IPA and phonetic extensions, dotless i and j). `verbesConnotes` now folds NFKC (accents kept, since `osé` is not `ose`). Tests cover every code point of the review table plus full-width verbs.
**Deviation:** the review suggested `foldKey` in `verbesConnotes`; that would drop accents and break the locked rule that `osé` and `assuré` are not flagged, so NFKC plus lowercase is used instead.

### CR-02: The sondage rule runs on all collections

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/sondages.ts`, `tests/rules/sondages.test.ts`
**Commit:** b052db5
**Applied fix:** guard `if (e.collection !== 'sondages') return [];`. Test: a source dated 2027-04-17, 04-18, 05-01 and 05-02 produces no finding.

### CR-03: « » exempts any word outside `mesures`

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/text/forbidden.ts`, `src/lib/content-core/rules/redaction.ts`, `tests/rules/redaction.test.ts`
**Commit:** 1db9915
**Applied fix:** `motsInterdits` and `verbesConnotes` take `{ exempterCitations }` (default true); `neutralite` passes `e.collection === 'mesures'`, the only collection where quotes are verified against `texte_source`. Tests: forbidden words quoted in a glossaire, journal and theme are flagged; the mesure exemption is unchanged.

### CR-04: Non-ASCII digits and glued units escape CHIFFRE_HORS_SOURCE

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/text/numbers.ts`, `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/redaction.ts`, `docs/RUNBOOK.md`, `tests/text/numbers.test.ts`, `tests/rules/redaction.test.ts`
**Commit:** ba65357
**Applied fix:** `extractNumbers` normalises to NFKC and converts every Unicode decimal digit to ASCII. A suffix glued to the number is now read: ordinals (`10es`, `1ers`), amount abbreviations `k`, `M`, `Md`, `Mds`, `Mrd`, `Mrds` (case-sensitive, so `100m` stays a length) and common units (`50kg`); `3 Md€` equals `3 milliards`. Unknown glued tokens (`5G`, `CO2`) are still not numbers (existing contract). Non-ASCII decimal digits are also flagged `CARACTERE_SUSPECT`.

### WR-01: ids.lock base guard fails open

**Status:** fixed
**Files modified:** `.github/workflows/ci.yml`, `tests/repo/ci.test.ts`
**Commit:** a909fe0
**Applied fix:** for a pull request, a failing or empty `merge-base` is `::error::` and `exit 1`; a missing base commit is an error for both events. Only the creation of a branch (`before` all zeros) on `push` skips the comparison. `cancel-in-progress` is `${{ github.event_name == 'pull_request' }}`. Tests assert the fail-closed shape and the concurrency expression.

### WR-02: `lireLock` treats any lstat error as "no lock"

**Status:** fixed
**Files modified:** `scripts/ids.ts`, `tests/content-core/ids-cli.test.ts`
**Commit:** ca9ac43
**Applied fix:** `lstatSync(lockPath, { throwIfNoEntry: false }) === undefined`; every other error propagates. An EACCES or ENOTDIR on the lock cannot be reproduced portably without breaking the content listing first, so the test pins the shape of the code (and the existing CLI tests keep covering the real missing-file path).

### WR-03: Figures not checked in `titre` and `detaille`

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/citations.ts`, `docs/RUNBOOK.md`, `tests/rules/citations.test.ts`, `tests/rules/moteur.test.ts`
**Commit:** 918355c
**Applied fix:** `titre` and `detaille` are now checked against `texte_source` and `chiffrage.texte`, with a new warning code `CHIFFRE_DETAILLE_HORS_SOURCE` (catalogue now has 40 codes). It is a warning, not an error, to stay consistent with CONTEXT (error reserved to résumé, enfant, aîné) and because long text legitimately carries dates and derived figures. The old test that said the détaillé is not verified was replaced. `glossaire`, `journal` and `themes` have no `texte_source` to compare with; this is recorded in `CHAMPS_EXEMPTES`.

### WR-04: Anti-bypass guards are warnings and never fail CI

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/citations.ts`, `src/lib/content-core/rules/text/numbers.ts`, `docs/RUNBOOK.md`, `tests/rules/citations.test.ts`, `tests/text/numbers.test.ts`
**Commit:** 262f58e
**Applied fix:** `TEXTE_SOURCE_TROP_LONG` is now `selon_mode` (error in production, warning in preview). CONTEXT does not mention this code. Warnings in general stay non-blocking and `NOMBRE_LETTRES_HORS_SOURCE` stays a warning (CONTEXT: number words = warning). The number-word list gained `moitié`, `demi`, `double`, `triple`, `quadruple`, `tiers`, `quart`, the `-aine` family (`quinzaine` to `soixantaine`), `premier`, `second` and the ordinals up to `dixième`.
**Note:** `premier` can be noisy (« Premier ministre »); it only produces a warning and is easy to remove from `NUMBER_WORDS`.

### WR-05: Free-text fields displayed publicly are never scanned

**Status:** fixed
**Files modified:** `src/lib/content-core/rules/config.ts`, `tests/rules/redaction.test.ts`
**Commit:** d241a12
**Applied fix:** `CHAMPS_EDITORIAUX` now also covers sondages `/institut`, `/commanditaire`, `/hypotheses/*/nom`; themes `/mots_cles/*`; candidats `/mandats_en_cours/*`; mesures `/source_localisation` and `/chiffrage/source_localisation`. One test per collection.

### WR-06: Quote tokenisation differs from word tokenisation (elisions)

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/text/words.ts`, `src/lib/content-core/rules/text/verbatim.ts`, `src/lib/content-core/rules/config.ts`, `tests/text/verbatim.test.ts`
**Commit:** 5126bdf
**Applied fix:** `ELISION` is exported from `words.ts` and `tokens()` splits elisions the same way, so `extrême droite` can be quoted from « l'extrême droite » in the source. `NORMALISATION_CITATIONS` (shown on the Méthode page) documents it.

### WR-07: Duel detection misses common wordings

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/sondages.ts`, `tests/rules/sondages.test.ts`
**Commit:** 65d9881
**Applied fix:** the motif now includes `deuxième tour`, `ballottage`, `finale` and `T2`. A two-score hypothesis at tour 1 is a duel when the scores sum to at least 99 or when « autres » is under 5 % (new `DUEL.autresMax`).
**Deviation:** the review suggested treating any two scores at tour 1 as a duel. The healthy fixture `sondage-fictif-1` is precisely two scores plus 7 % « autres » (the fictional corpus has only two candidates), so that rule would reject the reference corpus. A7 in `HYPOTHESES` and ADR-033 records the residual gap: 47 + 46 + 7 « autres » is still accepted.

### WR-08: Digit in the rédaction does not match the same number spelled out in the source

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/citations.ts`, `src/lib/content-core/rules/text/word-numbers.ts` (new), `tests/rules/citations.test.ts`, `tests/text/word-numbers.test.ts` (new)
**Commit:** 0fc1d4b
**Applied fix:** new pure module `word-numbers.ts` evaluates unambiguous French number words (`deux millions` = 2000000, `soixante et onze` = 71, `quatre-vingt-dix-sept` = 97). The source's digit set now includes the values of its spelled-out numbers, so `2 millions` in a résumé is established by « deux millions » in the source, and `trois` in a rédaction is established by `3` in the source. Ambiguous words stay out (`un`/`une` alone, `millions` without a count, `pour cent`); vague quantities (`dizaine`, `moitié`, ordinals) are still compared word for word. 32 unit tests plus 4 integration tests. New file created: `word-numbers.ts` (and its test).

### WR-09: Quadratic regex on unmatched « in `sentences()`

**Status:** fixed
**Files modified:** `schemas/defs/common.schema.json`, `src/lib/content-core/rules/text/sentences.ts`, `tests/schemas/mesure.test.ts`, `tests/text/sentences.test.ts`
**Commit:** 1047dcb
**Applied fix:** regex is `/«[^«»]*»/g`; `texte` in the common schema gets `maxLength: 5000` (a 200-word détaillé is about 1500 characters). Tests: 60 KB of `« a ` runs under 1 s; 5000 characters pass and 5001 give `SCHEMA_MAXLENGTH`.

### WR-10: Blocking window checks the publication date, not display during the window

**Status:** fixed (documented as deferred, not implemented, as instructed)
**Files modified:** `docs/ARCHITECTURE.md`, `src/lib/content-core/rules/config.ts`, `tests/repo/docs.test.ts`
**Commit:** 91208a4
**Applied fix:** this is a display concern for Lot 4. ADR-033 A10 and `HYPOTHESES` A10 now record the debt (hide polls or fail the production build when the build clock falls in a window, injectable clock for tests) and note that overseas Saturday voting is not covered. A docs test pins that the debt stays recorded.

### WR-11: Quote and `texte_source` fragments can be spliced from anywhere

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/config.ts`, `src/lib/content-core/rules/citations.ts`, `src/lib/content-core/rules/text/verbatim.ts`, `tests/text/verbatim.test.ts`
**Commit:** 5d1c141
**Applied fix:** a quote with an ellipsis now needs each fragment to hold at least 2 words, to appear in the same order as in the quote, and to start at most 60 words after the previous one (`FRAGMENTS_CITATION` in `config.ts`; a bounded depth-first search handles repeated fragments). The error messages for `CITATION_HORS_SOURCE`, `TEXTE_SOURCE_HORS_ARCHIVE` and `CHIFFRAGE_HORS_ARCHIVE` recall the conditions when an ellipsis is present. `NORMALISATION_CITATIONS` updated.

### WR-12: Equity perimeter reads the last array element

**Status:** fixed: requires human verification
**Files modified:** `src/lib/content-core/rules/equite.ts`, `src/lib/content-core/rules/config.ts`, `docs/ARCHITECTURE.md`, `tests/rules/equite.test.ts`
**Commit:** a08d9bb
**Applied fix:** the perimeter reads the status with the latest `date` (partial dates compare as ISO strings; ties go to the last in the list). A6 text updated in `HYPOTHESES` and ADR-033. Tests: an older status placed last no longer drops the candidate; a partial `AAAA-MM` date compares correctly.

## Skipped Issues

None.

## Out of scope / residual notes

- Info findings IN-01 to IN-08 were not touched (`fix_scope: critical_warning`).
- CR-01 residual: Latin look-alikes outside the ranges now flagged (for example other compatibility letters) are not covered by an exhaustive homoglyph table; the allowlist plus the IPA/phonetic blocks cover the cases listed in the review.
- WR-04: warnings in general still never fail CI (validate exits non-zero on errors only); only `TEXTE_SOURCE_TROP_LONG` was promoted.
- WR-07: see deviation above.
- Worktree note: this agent already ran inside a dedicated agent worktree (branch `worktree-agent-af4f548ffaa34292b`, base reset to 082c39a), so the nested review-fix worktree and recovery sentinel were not created.

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
