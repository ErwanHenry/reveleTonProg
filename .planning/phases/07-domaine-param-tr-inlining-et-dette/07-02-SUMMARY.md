---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 02
subsystem: corpus, ui, testing
tags: [typescript-api, json-schema, coverage, sources, astro-component, node-test]

# Dependency graph
requires:
  - phase: 07-01
    provides: inlined build under a hash-based CSP meta (no new inline style or script added here)
provides:
  - tests/corpus/types-schemas.test.ts (W7), which compares types.ts with schemas/ in both directions
  - CompteCouverture.enAttente and an honest preview coverage sentence (W3)
  - src/components/BlocSource.astro, the shared source block used by Mesure and EtatVide (W10)
  - tests/dist/cas/couverture-preview.cas.ts, which recounts the coverage claim on the rendered preview pages
  - tests/dist/site.test.ts imports every case module before it declares any suite (filtered runs no longer lose builds)
affects: [07-03, 07-05, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drift test against a hand-written type file: parse it with ts.createSourceFile, keep an explicit name-to-JSON-pointer table, fail loudly on unmapped or missing entries, prove each rule with a string-replace fault that must have matched"
    - "Shared Astro block without a wrapper: the caller owns div.source, so check-dist exemptions and selectors keep working"

key-files:
  created:
    - tests/corpus/types-schemas.test.ts
    - tests/dist/cas/couverture-preview.cas.ts
    - src/components/BlocSource.astro
  modified:
    - src/lib/corpus/vue.ts
    - tests/corpus/vue.test.ts
    - src/components/Mesure.astro
    - src/components/EtatVide.astro
    - src/styles/base.css
    - tests/dist/cas/theme.cas.ts
    - tests/dist/site.test.ts

key-decisions:
  - "W3 wording: « a/ont une position rédigée mais pas encore publiée », not the CONTEXT example « rédigée, en attente de relecture »: a preview measure can be relu (reviewed, not yet published), and a comma inside a clause is ambiguous in the comma-joined sentence"
  - "W3: the « publiée » clause stays when mesures > 0 or enAttente = 0; otherwise the « rédigée » clause takes its place and carries « sur T ». Production sentence is word-for-word unchanged (enAttente is always 0 there)"
  - "W10 class: the consulted-sources list is div.source.sources-consultees, so a document title in span[data-citation] gets the same MOT_INTERDIT exemption as in a measure (a title is a citation). MESURE_SANS_SOURCE_DATEE only reads .mesure .source and is unaffected"
  - "W10 accessible names: in the empty-cell list every link ends with an sr-only « : {titre} »; the measure block keeps its links unchanged (no suffix)"
  - "types.ts not modified: W7 finds 0 drift on the real files"

patterns-established:
  - "A dist case module that needs corpus-m1 materialises it in its own ctx.tmp() folder, never via materialiserCorpusM1() + nettoyerCorpusM1()"

requirements-completed: [DETTE-05, DETTE-01, DETTE-03]

# Metrics
duration: 15min
completed: 2026-11-07
---

# Phase 7 Plan 02: Types against schemas, honest preview coverage, full consulted sources Summary

**This plan settles three v1.0 audit debts. A typescript-API test now fails on any drift between `types.ts` and `schemas/` (W7). The preview coverage sentence no longer counts draft-only cells as published (W3). Each « Sources consultées » entry of an empty cell now shows its link, consultation date, Wayback copy and archived extract, through the same `BlocSource` component as a measure (W10).**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-07T01:32 (local)
- **Completed:** 2026-11-07T01:47 (local)
- **Tasks:** 3/3
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- **W7 (DETTE-05).** `comparer(texteTypes, schemas)` reads `types.ts` with `ts.createSourceFile` and covers 13 interfaces and 7 literal unions, each mapped explicitly to a schema location. It checks four things: every root `required` property exists in the type and is not optional; every type property is known to the schema (`properties` plus `then`/`else` at the root and in `allOf[*]`); every schema property exists in the type; and every union equals its `enum`. Bonus: inline unions such as `EntreeGlossaire.type` are also checked against the property's `enum`. On the real files it reports 0 drift. Seven fault injections each produce the expected gap. Three loud failures are proven: an interface missing from the table, a missing schema file, and a missing pointer.
- **W3 (DETTE-01).** `CompteCouverture` gains `enAttente`. `mesures` now counts only cells that hold a `publie` measure, and no cell is counted twice (the five counts add up to `total` on every preview theme). On the preview fixture, /themes/logement/ now says « 1 candidat sur 4 a une position publiée, 1 a une position rédigée mais pas encore publiée, 2 n'ont pas publié de programme. » It used to say « 2 candidats sur 4 ont une position publiée ».
- **W10 (DETTE-03).** `BlocSource.astro` (props `source`, `libelle?`, `nommer?`) renders the title, « Consultée le » + `<time>`, « Lire le document original », the optional « Copie archivée (Wayback Machine) » and « Extrait archivé, empreinte sha256 xxxxxxxxxxxx ». `Mesure.astro` keeps its `div.source` and `p.signaler`. `EtatVide.astro` renders `div.source.sources-consultees > p « Sources consultées : » + ul > li` with one `BlocSource nommer` per source. In base.css, `.vide-sources` is replaced by the two list rules.

## Verification

- `node --test tests/corpus/types-schemas.test.ts tests/corpus/vue.test.ts tests/ui/styles.test.ts`: 71/71 pass.
- `node --test --test-name-pattern="W3 :|W10 :|phrase de couverture|checkDist" tests/dist/site.test.ts`: 22/22 pass. The Task 3 pattern (`W10 :|source primaire|liens : original|quatre rédactions|checkDist`) gives 20/20, and the Task 2 pattern gives 5/5.
- `npm run check`: 0 errors, 0 warnings, 0 hints. `git diff -- package.json` is empty.
- **Measure source block byte-identical:** I took a snapshot of every `<div class="source">…</div>` before and after the refactor on four builds (real corpus and corpus-m1, production and preview: 215 blocks in total). All four are identical.
- **check-dist on the four builds after W10:** 0 errors each. The warning counts are unchanged from 07-01: 4 in real production and 34 in real preview, all CONTACT_PROVISOIRE / HEBERGEUR_PREVU.
- **Proof that the W3 dist case bites:** with the old count put back temporarily, 3 of the 4 W3 dist cases fail. The file was then restored.
- **Full `npm test`:** 1702 tests, 1687 pass, 15 fail. The 15 failures are exactly the transitional list in 07-01-SUMMARY.md, and nothing else is red (+19 new tests compared with 07-01's 1683).
- Acceptance greps: `createSourceFile` = 1, `it(` = 14; `enAttente` in vue.ts = 7, « rédigée mais pas encore publiée » = 1, no en or em dash in vue.ts, BlocSource.astro or EtatVide.astro; `BlocSource` = 2 in Mesure.astro and 2 in EtatVide.astro; `vide-sources` = 0 in EtatVide.astro and base.css.
- **Accessibility:** axe and the 320 px / 160 % text reflow on the new markup are proven by 07-05 (full e2e on the final build). Not run here: after 07-01 the CSP blocks texte.spec's `addStyleTag` until 07-05 sets `bypassCSP`. The links are fixed labels, never raw URLs, so nothing can overflow.

## theme.cas.ts and the 07-01 red cases

There is no conflict. The two red cases are the « CSS externe » block, which 07-03 owns. This plan did not touch them. They moved from theme.cas.ts:171 to theme.cas.ts:252 only because the W10 cases added lines above them. The new markup adds no `<style>` and no `style=""`, so it creates nothing new for 07-03 to handle.

## Task Commits

1. **Task 1: W7 types vs schemas**: `8282e99` (test)
2. **Task 2: W3 honest preview sentence**: `94f5240` (fix), plus `130ac4e` (fix: dedicated corpus root, see deviation 1)
3. **Task 3: W10 BlocSource**: `2a647b5` (feat), plus `733e01c` (fix: dist harness, see deviation 2)

In each task the RED tests were written first and seen failing (W3 unit cases: 3 failures before the vue.ts change). W7 is test-only: its fault cases are the RED proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] couverture-preview.cas used `materialiserCorpusM1()` + `after(nettoyerCorpusM1)` as the plan said**
- **Found during:** Task 3 verify
- **Issue:** `nettoyerCorpusM1()` deletes every root created by any module. couverture-preview sorts second, so its cleanup removed the roots of later modules, and 8 checkDist cases failed with ENOENT. The other modules already document this trap (« Racine dédiée … »).
- **Fix:** I gave the module its own root, `materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'))`, the same pattern as source.cas and modes.cas.
- **Files modified:** tests/dist/cas/couverture-preview.cas.ts
- **Commit:** 130ac4e

**2. [Rule 3 - Blocking] tests/dist/site.test.ts lost memoised builds when the name filter dropped a whole module (file not in files_modified)**
- **Found during:** Task 3 verify (`--test-name-pattern` without `W3 :`)
- **Issue:** The harness alternated `await import(module)` and `describe()`. When every test of couverture-preview was filtered out, its suite finished before the next suite was declared. The root test then thought it was done and ran its `after()`, which deletes all tmp dists while later suites still needed them. This happened only with name filters, never with the full `npm test`, but it made the plan's own Task 3 verify command fail. Moving the module last made the failure go away, which confirmed the cause.
- **Fix:** The harness now imports all case modules first and then declares the suites in the same order. Behaviour without a filter is unchanged.
- **Files modified:** tests/dist/site.test.ts
- **Commit:** 733e01c

**3. [Rule 3 - Repo rule] `.sources-consultees li + li` uses `margin-top: 1rem`, not the plan's `0.75rem`**
- **Found during:** Task 3 (tests/ui/styles.test.ts)
- **Issue:** 12 px is not on the spacing scale (4/8/16/24/32/48/64 px), so the styles test failed.
- **Fix:** I used 1rem (16 px).
- **Commit:** 2a647b5

**4. [Process] A stray `git checkout HEAD~3 -- tests/dist/cas/theme.cas.ts` discarded my uncommitted W10 edits to that file during debugging**
- At HEAD~3 that file is identical to HEAD, so no other content was affected. I re-applied the same scripted edit before committing and re-ran the full verification afterwards.

**Additions beyond the plan (all in test files):** W7 also compares inline literal unions with the property `enum` and refuses any interface or alias missing from the mapping table. W3 has a dist case pinning the logement sentence. W10 has a sweep case that checks every consulted-source entry of every page, in both modes, against its source YAML: date, `formatDate`, href list with Wayback only when it exists, and the sha256 prefix.

No CLAUDE.md-driven adjustment. No new dependency and no npm script. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched, and neither was `src/lib/corpus/types.ts` (0 drift). Nothing was pushed. STATE.md and ROADMAP.md were not updated (orchestrator instruction).

## Known Stubs

None.

## Threat Flags

None. The new links go to the same three destinations as the measure block (candidate document, Wayback, GitHub blob) and carry `rel="noopener noreferrer"`. check-dist confirms there is no LIEN_EXTERNE_NON_PROTEGE.

## Next Phase Readiness

- 07-03: the theme.cas.ts « CSS externe » block is now at line 252. Any new dist case module must use a dedicated `ctx.tmp()` root. Case modules can now be filtered freely by name.
- 07-05: the e2e axe and texte specs cover the new `ul` of consulted sources at 320 px.
- Known limit, recorded in couverture-preview.cas.ts: the theme page shows only the first measure of a cell (sorted by title). The DOM recount is exact on corpus-m1, but on a cell whose first measure is a draft while a later one is published, it would undercount.

## Self-Check: PASSED

- FOUND: tests/corpus/types-schemas.test.ts, tests/dist/cas/couverture-preview.cas.ts, src/components/BlocSource.astro
- FOUND: commits 8282e99, 94f5240, 130ac4e, 733e01c, 2a647b5
