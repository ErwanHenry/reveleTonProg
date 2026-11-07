---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 03
subsystem: testing, security
tags: [csp, sha256, inlining, check-dist, dist-tests, mutation-testing]

# Dependency graph
requires:
  - phase: 07-01
    provides: inlined build under a hash-based CSP meta, src/lib/csp-empreintes.ts, check-dist CSP codes
  - phase: 07-02
    provides: restructured tests/dist/site.test.ts (all modules imported before suites are declared)
  - phase: 07-04
    provides: build harness that never inherits RTP_DEPLOIEMENT
provides:
  - tests/dist/css-pages.ts (cssDesPages), the single reader of the built inline CSS
  - tests/dist/cas/csp.cas.ts, PERF-01 proven on the m1 production and preview builds, with four mutation proofs
  - ordre, niveaux, enfant, integration and theme dist cases rewritten for the inline form
  - tests/dist fully green again (07-01 transitional red list closed)
affects: [07-05, 07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation proof on a real dist: fs.cpSync the memoised build into ctx.tmp(), inject one fault into one page (asserting the motif occurs exactly once), then diff checkDist against the intact build by code+file+message and require exactly the expected codes, all on that page, all errors"
    - "CSS rule tests read the deduplicated <style> text of every built page through one helper that throws when it finds none"

key-files:
  created:
    - tests/dist/css-pages.ts
    - tests/dist/cas/csp.cas.ts
  modified:
    - tests/dist/cas/ordre.cas.ts
    - tests/dist/cas/niveaux.cas.ts
    - tests/dist/cas/enfant.cas.ts
    - tests/dist/cas/integration.cas.ts
    - tests/dist/cas/theme.cas.ts

key-decisions:
  - "The two old ordre script tests (« <script src=/_astro/ordre…> » and « le fichier du dist pèse… ») become one: inline, first <script> of <head>, no attribute, byte-identical, at most 2048 bytes"
  - "Mutation cases compare checkDist against the intact build (code, file, message) rather than filtering on CSP codes only, so an injected fault that tripped any other rule, or another page, would also fail the case"
  - "csp.cas checks checkDist without cellulesParTheme: it only asserts on CSP and inline codes; the full error-free checkDist stays in the other modules"

patterns-established:
  - "A dist assertion about the CSP requires inclusion of a hash in the directive, never equality with the page's scripts (Astro adds 5 island hashes), and never that the meta precedes the order script (Pitfall 1)"

requirements-completed: [PERF-01]

# Metrics
duration: 8min
completed: 2026-11-07
---

# Phase 7 Plan 03: Dist cases for the inline form and CSP proofs Summary

**The dist cases that still asserted the ADR-037 external form now check the inline form. The CSS rule tests read the built `<style>` through one shared helper. A new `csp.cas.ts` proves on the m1 production and preview builds that each inline script is byte-identical to its source and that its sha256 is in the page CSP. Four faults injected into copies of the real dist show that check-dist catches each of them.**

PERF-01 note: with 07-01 (build and check-dist rules), this plan completes success criterion 3. The zero-violation browser test is still 07-05's job, and the header CSP that covers the order script is 07-07's.

## Performance

- **Duration:** about 8 min
- **Started:** 2026-11-07T01:56+01:00
- **Completed:** 2026-11-07T02:04+01:00
- **Tasks:** 2/2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- **`cssDesPages(outDir, pages?)`** returns the raw text of every `<style>` on the built pages. Identical texts are kept once, the order is stable (sorted pages, then document order), and the call throws when it finds no `<style>`, so a CSS test can never pass on an empty string (T-07-10). The 9 CSS rule tests in ordre, niveaux and enfant keep their exact assertions.
- **theme.cas « CSS en ligne »** checks both production and preview: no `dist/_astro/`, no `.css` or `.js` file at all, exactly one non-empty `<style>` per page inside `<head>`, and no `style=` attribute (read from the parsed attributes, not a regex).
- **ordre.cas**: on every page, the first `<script>` in `<head>` is the order script. It has no attribute, is byte-identical to `src/scripts/ordre.js`, weighs 2048 bytes or less, and appears once.
- **niveaux.cas**: on every page with `fieldset#niveaux`, the next element is a `<script>` with no attribute, identical to `niveau.js`, and it appears once. Pages without a selector have no level script. The case checks that themes/logement and at least one candidate page carry the selector.
- **integration.cas**: the candidate page checks the inline level script after `</fieldset>`. The weight diagnostic now weighs the HTML alone (nothing external since ADR-056) and still prints the 3 heaviest pages: methode 35,464 B raw / 11,853 B gzip, then themes/logement and candidats/marie-fictive.
- **csp.cas** (15 tests, all named « PERF-01 : », reusing `m1-production` and `m1-preview`, so no extra build):
  - `scriptsEnLigne` returns exactly niveau.js and ordre.js, each 2048 bytes or less.
  - For each mode: one CSP meta per page, a child of `<head>`, with no `unsafe-*` and with `default-src 'none'`. `script-src` holds both source hashes and the hash of every script body, and every body is one of the sources. Each `<style>` hash is in `style-src`. There is no `style=`. The order script comes first in `<head>` and the level script right after `</fieldset>`, both identical to their sources. checkDist reports none of the six CSP or inline codes.
  - Mutations on `fs.cpSync` copies (T-07-11). Adding one space to the level script gives SCRIPT_EN_LIGNE and SCRIPT_SANS_EMPREINTE. Changing one letter in the `<style>` gives STYLE_SANS_EMPREINTE. Removing the order hash from the meta gives SCRIPT_SANS_EMPREINTE, and the message names that hash. Adding `'unsafe-inline'` to script-src gives CSP_TROP_PERMISSIVE. Each mutation first asserts that its motif occurs exactly once and that the page really changed. It then requires that the new findings, compared with the intact build, are exactly the expected codes, all on that one page and all errors.

## Task Commits

1. **Task 1: shared CSS helper, CSS rule tests, theme « CSS en ligne »**: `1e3b762` (test)
2. **Task 2: inline script identity cases and csp.cas with mutation proofs**: `ada5681` (test)

These are test-only tasks on an implementation that already existed (07-01). The RED state was the 15 transitional failures that 07-01 recorded. Both tasks turn them green, and the mutation cases are the proof that the new checks catch faults.

## Verification

- Task 1 verify (`--test-name-pattern` over the 11 CSS / theme names): 15/15 pass. The pattern also matches 4 neighbouring tests.
- Task 2 verify: `node --test tests/dist/site.test.ts` 154/154 pass. `npm run check` 0 errors, 0 warnings, 0 hints.
- Acceptance greps:
  - `PERF-01 :` in csp.cas.ts: 10 lines, which produce 15 test names.
  - `/_astro/(ordre|niveau)`: 0 in every case module.
  - `unsafe-inline` in csp.cas.ts: 2.
  - `_astro`: 0 in ordre, niveaux and enfant.
  - `cssDesPages`: 4 each in ordre, niveaux and enfant.
  - `scriptsEnLigne` in csp.cas.ts: 4.
- **Full `npm test` (Node 24, `RTP_DEPLOIEMENT` unset): 1748 tests, 1748 pass, 0 fail.** 07-04 had 1734 tests with 15 failing. The difference: 15 csp.cas tests added, and the two old ordre script tests merged into one.

## Transitional red list (07-01): all closed

| # | Case | Closed by |
|---|---|---|
| 1-2 | ordre « script src=/_astro/ordre… » and « le fichier du dist pèse… » | merged into « toutes les pages : script d'ordre en ligne… » |
| 3-5 | ordre CSS (3) | cssDesPages |
| 6 | niveaux « le script classique suit immédiatement </fieldset> … » | rewritten for the inline form, on every page with a selector |
| 7-9 | niveaux CSS (3) | cssDesPages |
| 10-12 | enfant CSS (3) | cssDesPages |
| 13 | integration « sélecteur de niveau suivi du script niveau » | inline body after `</fieldset>` |
| 14-15 | theme « CSS externe » production / preview | « CSS en ligne » block |

## Deviations from Plan

None. The plan was executed as written. Additions beyond the plan, all in test files:
- csp.cas also checks the order and level script positions and identity on the **preview** build. The plan's must-have truth names both builds, while ordre.cas and niveaux.cas use their own production builds.
- csp.cas also asserts `default-src 'none'`, that no script is external, and that `scriptsEnLigne` lists exactly the two expected files, so the hash checks cannot pass on an empty list.
- In the mutation cases, the findings are compared with the full checkDist output of the intact build, not only the CSP codes.

The plan's `<interfaces>` mention the build keys `m1-production` and `m1-preview`. csp.cas uses them. The existing modules keep their own keys (`ordre-*`, `niveaux-production`, `enfant-production`), so no key was added. tests/dist/site.test.ts and tests/dist/contexte.ts were not modified.

No CLAUDE.md-driven adjustment. No new dependency or npm script. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched. Nothing was pushed. STATE.md and ROADMAP.md were not updated (orchestrator instruction).

## Known Stubs

None.

## Threat Flags

None. These are test files only and add no new surface.

## Next Phase Readiness

- 07-05: tests/dist is fully green, so the e2e CSP specs and the `bypassCSP` change to texte.spec are the last PERF-01 coverage.
- 07-07: csp.cas does not claim that the meta covers the order script (Pitfall 1, T-07-12 accepted). The Caddy header must carry both hashes.
- The `deferred-items.md` entry from 07-04 (an exported `RTP_DEPLOIEMENT=1` breaks test-side config reads) is still open. csp.cas does not read the site config, so it adds nothing to that problem.

## Self-Check: PASSED

- FOUND: tests/dist/css-pages.ts, tests/dist/cas/csp.cas.ts
- FOUND: commits 1e3b762, ada5681
