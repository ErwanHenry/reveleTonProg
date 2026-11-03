---
phase: 02-r-gles-ditoriales-et-pi-ges
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - .gitattributes
  - .github/workflows/ci.yml
  - package.json
  - scripts/ids.ts
  - scripts/validate.ts
  - src/lib/content-core/ajv.ts
  - src/lib/content-core/astro-loader.ts
  - src/lib/content-core/contained.ts
  - src/lib/content-core/ids-lock.ts
  - src/lib/content-core/load.ts
  - src/lib/content-core/root.ts
  - src/lib/content-core/rules/archives.ts
  - src/lib/content-core/rules/champs.ts
  - src/lib/content-core/rules/citations.ts
  - src/lib/content-core/rules/config.ts
  - src/lib/content-core/rules/corpus.ts
  - src/lib/content-core/rules/equite.ts
  - src/lib/content-core/rules/index.ts
  - src/lib/content-core/rules/redaction.ts
  - src/lib/content-core/rules/references.ts
  - src/lib/content-core/rules/sondages.ts
  - src/lib/content-core/rules/text/forbidden.ts
  - src/lib/content-core/rules/text/normalize.ts
  - src/lib/content-core/rules/text/numbers.ts
  - src/lib/content-core/rules/text/sentences.ts
  - src/lib/content-core/rules/text/syllables.ts
  - src/lib/content-core/rules/text/verbatim.ts
  - src/lib/content-core/rules/text/words.ts
  - src/lib/content-core/rules/types.ts
findings:
  critical: 4
  warning: 12
  info: 8
  total: 24
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

The editorial rule engine is well structured (pure text layer, fail-closed `REGLE_ECHEC`, `env:` indirection in CI so no `${{ }}` reaches a `run:` body, regexes mostly linear). The weak points are exactly the ones a motivated contributor would use. Four defects are confirmed by running the code with `node` 24:

1. Several invisible or format Unicode characters inside a forbidden word are not stripped and not flagged (CR-01).
2. The sondage rule runs on every collection, so a **source** dated inside a blocking window fails CI (CR-02).
3. Text between « » is exempt from forbidden words, but quotes are only verified for `mesures` (CR-03).
4. Numbers written with non-ASCII digits or glued to a unit escape the "invented figure" check (CR-04).

CI step injection: no finding. `BASE_REF`, `PUSH_BEFORE` and `EVENT_NAME` go through `env:` and are quoted, and the `origin/` prefix prevents option injection. Regex DoS: one quadratic regex (WR-09), nothing exponential.

## Structural Findings (fallow)

Not provided for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Invisible and format characters hide a forbidden word (MOT_INTERDIT bypass)

**File:** `src/lib/content-core/rules/text/normalize.ts:6` (also `rules/config.ts:91`, `rules/text/forbidden.ts:17-27`)
**Issue:** `INVISIBLE` only removes U+00AD, U+200B-200D, U+2060 and U+FEFF. `foldKey` then removes only `\p{M}`. Other `Cf` characters and filler letters stay inside the word. `Intl.Segmenter` keeps them in one word, so `k.startsWith('extrem')` and `k === 'enfin'` fail. `CARACTERES_SUSPECTS` covers only U+202A-E, U+2066-9, Cyrillic and Greek, so nothing flags them either. Tested with `ext<cp>rême`:

| Code point | Name | Result |
|---|---|---|
| U+200E | LRM | BYPASS |
| U+200F | RLM | BYPASS |
| U+061C | ALM | BYPASS |
| U+2061, U+2062 | invisible operators | BYPASS |
| U+180E | Mongolian vowel separator | BYPASS |
| U+3164 | Hangul filler | BYPASS |
| U+E0041 | tag character | BYPASS |

U+200B, U+00AD, U+2060, U+FEFF, U+034F and U+FE0F are caught. The same gap affects `verbesConnotes`: it uses only NFC and lowercase, so fullwidth letters or a variation selector hide a verb. The denylist of scripts (Greek, Cyrillic) also leaves Armenian, Coptic, Cherokee and Latin look-alikes (dotless ı, small capitals) untouched. In the other direction, a legitimate Greek or Cyrillic quote, or `Ω` (U+2126, Script=Greek), raises `CARACTERE_SUSPECT` with no exemption.
**Fix:** Switch to an allowlist and strip every format character before segmenting.
```ts
// normalize.ts
const INVISIBLE = /[\p{Cf}\p{Co}͏ᅟᅠ឴឵᠎ㅤﾠ]/gu;
// config.ts: flag everything that is not Latin/Common/Inherited, plus any Cf/Co
export const CARACTERES_SUSPECTS = /[\p{Cf}\p{Co}]|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
```
Apply `foldKey` in `verbesConnotes` as well. If `\p{Cf}` is flagged, the silent stripping of ZWJ and soft hyphen becomes an explicit `CARACTERE_SUSPECT` error. Add tests for each code point above.

### CR-02: The sondage rule runs on all collections, so a source dated in a blocking window fails CI

**File:** `src/lib/content-core/rules/sondages.ts:53-67`, `src/lib/content-core/rules/index.ts:93`
**Issue:** `sondage: EntryRule` has no `e.collection !== 'sondages'` guard, unlike every other entry rule. `appliquerRegles` runs `fam.entree` on all entries. `schemas/source.schema.json` also has `date_publication` (a date or partial date). `Date.parse('2027-04-17')` is midnight UTC, which is inside the window. Verified output:

| `date_publication` | Result |
|---|---|
| `2027-04-17` | `SONDAGE_FENETRE_BLOCAGE` |
| `2027-04-18` | `SONDAGE_FENETRE_BLOCAGE` |
| `2027-05-01` | `SONDAGE_FENETRE_BLOCAGE` |
| `2027-05-02` | `SONDAGE_FENETRE_BLOCAGE` |
| `2027-04-16` | no finding |

A candidate programme or speech published on 17 or 18 April, or 1 or 2 May, cannot be archived. The error message talks about a "sondage" for a non-poll file. Unrelated future collections with `date_publication` or `hypotheses` would hit the same bug.
**Fix:**
```ts
run(e: LoadedEntry): Finding[] {
  if (e.collection !== 'sondages') return [];
```
Add a test: a source dated `2027-04-17` produces no finding.

### CR-03: « » exempts any word in `glossaire`, `journal` and `themes`, and quotes are only verified for `mesures`

**File:** `src/lib/content-core/rules/citations.ts:40`, `src/lib/content-core/rules/text/forbidden.ts:10,19`, `src/lib/content-core/rules/config.ts:36-41`
**Issue:** `motsInterdits` and `verbesConnotes` drop every « … » span. Per the comment, the exemption is legitimate because CITATION_HORS_SOURCE verifies each quote against `texte_source`. That check runs only for `e.collection === 'mesures'`. `CHAMPS_EDITORIAUX` also scans `glossaire` (`/libelle`, `/definition`), `journal` (`/resume`) and `themes` (`/nom`, `/sous_themes/*/nom`). In those collections, "Le candidat est « extrême » et « populiste »" passes both REGLE-02 and REGLE-04 with nothing verifying the quote. A journal summary is public editorial text.
**Fix:** Either do not exempt quotes outside `mesures` (pass a flag to `motsInterdits`), or require a source for them.
```ts
// redaction.ts neutralite: exempt quotes only where a texte_source can verify them
const exempterCitations = e.collection === 'mesures';
motsInterdits(texte, { exempterCitations })
```
In `forbidden.ts`, `corps()` should skip `withoutQuotes` when the flag is false. Add a glossaire fixture containing `« extrême »` that must fail.

### CR-04: Numbers in non-ASCII digits or glued to a unit escape CHIFFRE_HORS_SOURCE

**File:** `src/lib/content-core/rules/text/numbers.ts:11,35-38`
**Issue:** `extractNumbers` uses `cleanText` (NFC), not NFKC. `\d` matches only ASCII digits. The regex requires no letter or digit right after the number. Verified, each returns `[]`:
- Fullwidth digits (`２０００`) and Arabic-Indic digits (`٥٠٠`). Fullwidth digits would render as "2000" to a reader.
- A unit glued to the number, which is common in French budget prose: `50k`, `100M€`, `10es`, `1ers`. The lookahead rejects the match and backtracking cannot rescue it.
- `3 Md€` / `2,5 Mds` yield `3` / `2.5` because only `mille|million(s)|milliard(s)` are multipliers. A source saying "3 milliards" gives `3000000000`, so the legitimate text fails. Conversely, any stray `3` in the source legitimises "3 Md€".

An invented figure therefore passes in the résumé, enfant and aîné levels.
**Fix:** Normalise to NFKC at the top of `extractNumbers`, and also convert Arabic-Indic digits (`\p{Nd}` to ASCII via a map). Allow a unit suffix after the digits, then read the multiplier from it.
```ts
const t = mergeDigitGroups(cleanText(text.normalize('NFKC')));
// NUM: allow glued unit letters, then map k/M/Md/Mds/Mrd to a multiplier
(?<![\p{L}\p{N}])(...)(?:er|ers|ère|ères|e|es|ème|èmes|nd|nde)?(?:\s*(k|M|Md|Mds|Mrd|mille|millions?|milliards?))?(?![\p{L}\p{N}])
```
Also reject any `\p{Nd}` character that is not an ASCII digit as CARACTERE_SUSPECT.

## Warnings

### WR-01: The ids.lock base guard fails open, and `cancel-in-progress` weakens it on main

**File:** `.github/workflows/ci.yml:13,60-74`
**Issue:** (a) For a `pull_request`, `git merge-base ... || true` can return an empty value. The script then prints "première poussée de la branche" and exits 0, so a PR that removes an id passes if the merge-base lookup fails. (b) A missing base commit (force-push) is only `::warning::` + `exit 0`. (c) `cancel-in-progress: true` also applies to pushes on `main`. A push that removes a line from `ids.lock` and is cancelled by the next push is never compared. The next push compares only against its own `before`.
**Fix:** Fail closed for pull requests.
```bash
if [ "$EVENT_NAME" = "pull_request" ]; then
  BASE=$(git merge-base "origin/${BASE_REF}" HEAD) || { echo "::error::merge-base introuvable"; exit 1; }
```
Limit the empty or zero base escape to `push` on a new branch. Use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.

### WR-02: `lireLock` treats any `lstat` error as "no lock", so `--write` can overwrite the lock

**File:** `scripts/ids.ts:63-72,100-121`
**Issue:** `try { lstatSync(lockPath) } catch { return undefined }` also swallows EACCES, ENOTDIR and EIO. With `lock === undefined`, `ajouterIds` writes a new `ids.lock` from only the current candidates and `renameSync`s it over the existing file. Previously locked ids that have no candidate file would be silently dropped, which defeats the append-only guarantee. `rules/references.ts:128` handles this correctly with `throwIfNoEntry: false` (any other error throws and fails closed).
**Fix:**
```ts
if (lstatSync(lockPath, { throwIfNoEntry: false }) === undefined) return undefined;
```
Let other errors propagate.

### WR-03: Figures are not checked in `titre` or `detaille` (or in `glossaire`, `journal`, `themes`)

**File:** `src/lib/content-core/rules/config.ts:115`, `src/lib/content-core/rules/citations.ts:49-70`
**Issue:** `CHAMPS_CHIFFRES = ['resume','enfant','aine']`. The detailed level is the longest text (80-200 words) and the most likely to carry an invented figure. `/titre` ("Baisse de 30 % des impôts") is also unchecked. The comment says this is deliberate, but the project constraint is "chiffrage du candidat seulement".
**Fix:** Check `detaille` and `titre` too. If a derived figure (a sum) is legitimate, accept it through an explicit field in the schema rather than by omission.

### WR-04: The anti-bypass guards are warnings and never fail CI

**File:** `src/lib/content-core/rules/citations.ts:61-69,84-98`; `scripts/validate.ts:67,71`
**Issue:** `process.exit(errors > 0 ? 1 : 0)` ignores warnings. `TEXTE_SOURCE_TROP_LONG` is advertised as a "garde-fou anti-contournement", but a `texte_source` of 300 words (or the whole archive) legitimises every number and every quote and only warns. `NOMBRE_LETTRES_HORS_SOURCE` (invented "trois millions") is also warning-only. `NUMBER_WORDS` lacks `moitié`, `double`, `triple`, `tiers`, `quart`, `trentaine`, `quarantaine`, `cinquantaine`, `soixantaine`, `vingtaine`, `premier`, `deuxième` and `second`.
**Fix:** Make `TEXTE_SOURCE_TROP_LONG` an error in production (as `selon_mode`). Extend the list. Consider making `NOMBRE_LETTRES_HORS_SOURCE` an error for `resume`, `enfant` and `aine` when published.

### WR-05: Free-text fields displayed publicly are never scanned

**File:** `src/lib/content-core/rules/config.ts:36-49`
**Issue:** `CHAMPS_EDITORIAUX` and `CHAMPS_EXEMPTES` omit fields that the schemas define as free text: sondages `hypotheses/*/nom`, `institut`, `commanditaire`; themes `mots_cles/*`; candidats `mandats_en_cours/*`; and `chiffrage.source_localisation`. `hypotheses/*/nom` is shown next to the scores and is the natural place to write a loaded label. The exempt list does not mention them, so the omission looks accidental.
**Fix:** Add those pointers to `CHAMPS_EDITORIAUX` (with the right collection), or list them in `CHAMPS_EXEMPTES` with a reason.

### WR-06: Quote tokenisation differs from word tokenisation (false CITATION_HORS_SOURCE on elisions)

**File:** `src/lib/content-core/rules/text/verbatim.ts:7` vs `rules/text/words.ts:6`
**Issue:** `TOKEN` keeps `l'extrême` as one token, whereas `words()` splits `l'` from `extrême` (so `l'extrême` is caught as forbidden). Verified: with source "il combat l'extrême droite et l'école", `quoteIn('extrême droite', …)` is `false` and `quoteIn('école', …)` is `false`. The legitimate way to neutralise the forbidden word (quote it) fails unless the editor copies the elision, and the message does not say why. The normalisation contract also states that a quote cannot start in the middle of a word.
**Fix:** Split elisions in `tokens()` with the same `ELISION` regex as `words()`, or document the rule on the Méthode page and in the error message.

### WR-07: Duel detection misses common wordings

**File:** `src/lib/content-core/rules/config.ts:141-145`, `rules/sondages.ts:86-94`
**Issue:** `DUEL.motif` does not match "deuxième tour" (tested false), "ballottage", "T2" or "finale". The structural test requires two scores summing to at least 99. A runoff scenario reported with "blanc/nul" in `autres_pct` (for example 47+46 and 7 others) is not detected, and a first-round poll with 2 candidates is never legitimate.
**Fix:** Add `deuxi[èe]me tour|ballottage|finale` to the motif. In tour 1 treat `scores.length === 2` as a duel regardless of the sum, or at least when `autres_pct < 5`.

### WR-08: A digit in the rédaction does not match the same number spelled out in the source

**File:** `src/lib/content-core/rules/citations.ts:46-60`
**Issue:** Digits and words are compared in separate sets. A source that says "deux millions d'euros" and a résumé that says "2 millions d'euros" gives `CHIFFRE_HORS_SOURCE` (error): `extractNumbers` gives `2000000`, the source set is empty, and `deux` / `millions` go to the words set. Verified. This blocks legitimate summaries. "un" is excluded from words, so "un million" versus "1 million" fails the same way.
**Fix:** Convert number words from `NUMBER_WORDS` to canonical values (units, tens, `cent`, `mille`, `million`, `milliard`, with "un" before a multiplier) and compare in the digit set. Otherwise document the constraint and give an actionable message ("écrire le nombre comme la source").

### WR-09: Quadratic regex on unmatched « in `sentences()`

**File:** `src/lib/content-core/rules/text/sentences.ts:18`
**Issue:** `/«[^»]*»/g` allows « inside the span (unlike `QUOTE_SPAN` in words.ts which uses `[^«»]*`). With many « and no », each « scans to the end of the text. Measured: 60 KB of `« a ` takes 2.3 s. The mesure text fields have no `maxLength`, so a large contributed file stalls CI for minutes. Not exponential, but a cheap denial of service.
**Fix:** Use `/«[^«»]*»/g`, and add `maxLength` to `texte` in the schema.

### WR-10: Blocking window checks the poll's publication date, not whether it is displayed during the window

**File:** `src/lib/content-core/rules/sondages.ts:47-51,58-67`, `rules/config.ts:151-162`
**Issue:** The legal ban (loi 77-808 art. 11, as the project reads it) covers publication, diffusion and comment during the window. A poll published on 10 April and still on the static site on 17 April is lawful for the rule engine but not for the law, because the site is rebuilt or served during the ban. The rule does not look at the build instant.
**Fix:** Add a build-time step that hides polls (or fails the production build) when `Date.now()` falls in a window. Pin the clock for tests. Also note that overseas Saturday voting is outside the stated window (A10 should say so).

### WR-11: Quote and `texte_source` fragments can be spliced from anywhere in the archive

**File:** `src/lib/content-core/rules/text/verbatim.ts:15-32`, `rules/citations.ts:129-136`
**Issue:** An ellipsis splits a quote into independent fragments with no order and no minimum length. A `texte_source` such as "40 000 […] postes […] supprimés" passes REGLE-05 if each fragment exists somewhere in the archive, even far apart or in contradictory order. It then legitimises numbers and quotes in the rédactions. `TEXTE_SOURCE_TROP_COURT` counts all words and is a warning.
**Fix:** Require fragments to appear in the same order, and within a bounded distance (for example in the same paragraph). Require a minimum token count per fragment.

### WR-12: Equity perimeter reads the last array element, not the latest dated status

**File:** `src/lib/content-core/rules/equite.ts:22-30`, `schemas/candidat.schema.json:28-50`
**Issue:** A6 takes `statuts[statuts.length - 1]`. Neither the schema nor a rule enforces chronological order. Prepending a `renonce` (or an earlier `pressenti` entry) changes membership silently. A trailing `brouillon` status can drop a candidate from the perimeter without review, which relaxes REGLE-08.
**Fix:** Sort by `date` (partial dates normalised) before reading the last, or add a rule that rejects out-of-order `statuts`.

## Info

### IN-01: `slugGlossaire` turns ligatures into hyphens

**File:** `src/lib/content-core/rules/references.ts:20-27`
**Issue:** `cœur` becomes `c-ur` and `Œuvre` becomes `uvre`, because `œ` and `æ` have no NFD decomposition. A `[[cœur]]` marker looks for the id `c-ur`, hence `REFERENCE_CASSEE` unless the editor writes `[[cœur|coeur]]`.
**Fix:** Replace `œ` with `oe` and `æ` with `ae` before slugifying (as `foldKey` does).

### IN-02: Duplicated pointer expansion

**File:** `src/lib/content-core/rules/references.ts:30-45` and `rules/redaction.ts:20-42`
**Issue:** `valeursTexte` and `developper` / `champsEditoriaux` do the same thing. `references.ts` should import `champsEditoriaux` from `redaction.ts`.
**Fix:** Reuse the single helper.

### IN-03: The default content root is the fixture corpus, and CI builds it

**File:** `src/lib/content-core/root.ts:6`, `.github/workflows/ci.yml` (build step)
**Issue:** `npm run build` without `RTP_CONTENT_ROOT` builds the fictional corpus. The "Construire le site" step has no `RTP_CONTENT_ROOT`, so CI does not exercise the real corpus at build time. The loader logs the root, but nothing fails.
**Fix:** Set `RTP_CONTENT_ROOT: "."` on the build step now, and flip the default when Phase 3 lands.

### IN-04: Redundant gitattributes pattern

**File:** `.gitattributes:5-6`
**Issue:** `ids.lock` (no slash) already matches at any depth, so `**/ids.lock` is redundant.
**Fix:** Keep one line.

### IN-05: `resume` has no minimum length

**File:** `src/lib/content-core/rules/config.ts:99`
**Issue:** `LONGUEURS.resume = { max: 25 }`. A résumé of `.` or `-` (schema `minLength: 1`) passes REGLE-03.
**Fix:** Add `min` (for example 5).

### IN-06: Sum message rounds to one decimal

**File:** `src/lib/content-core/rules/sondages.ts:39,82`
**Issue:** `decimale` shows 94.96 as "95,0 %" while the rule rejects it as below the 95 bound. The message looks self-contradictory.
**Fix:** Show two decimals.

### IN-07: Forbidden-word matching limits and false positives

**File:** `src/lib/content-core/rules/text/forbidden.ts:22`, `rules/config.ts:66-72`
**Issue:** (a) Prefix-only matching misses `ultraextrême`, `antipopuliste`, and `enfin_` / `enfin2` (the segmenter keeps `_` and digits in the word, so the `exact` rule fails). (b) `extrem` also blocks `Extrême-Orient` or `extremum`; the only escape is quoting. (c) `VERBE_CONNOTE` flags `assure` in its ordinary insurance or guarantee sense. If the Méthode page promises coverage, state these limits.
**Fix:** For (a) match `\benfin\b` on the cleaned string rather than the segmenter token. Otherwise document.

### IN-08: Build honours `RTP_MODE=preview`

**File:** `src/lib/content-core/astro-loader.ts:80`, `src/lib/content-core/root.ts:33`
**Issue:** The Astro loader reads the mode from the environment. A deploy environment with `RTP_MODE=preview` builds with the equity rule downgraded to a warning.
**Fix:** Refuse `preview` when `NODE_ENV === 'production'` or when running `astro build`.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
