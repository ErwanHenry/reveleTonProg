---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 01
subsystem: build, security, testing
tags: [astro, csp, sha256, inlining, check-dist, perf]

# Dependency graph
requires:
  - phase: 07 research spike
    provides: CSP option A configuration verified on Astro 7.4.5 (meta per page, scriptDirective.hashes)
provides:
  - src/lib/csp-empreintes.ts (empreinteCsp, scriptsEnLigne), the single CSP hash helper
  - Inlined build: one <style> per page, ordre.js and niveau.js as inline classic blocking scripts, no dist/_astro/
  - One CSP meta per page with the two source-file script hashes, no unsafe-* keyword
  - check-dist hash-based rules CSP_ABSENTE, CSP_TROP_PERMISSIVE, SCRIPT_SANS_EMPREINTE, STYLE_SANS_EMPREINTE
  - SCRIPT_EN_LIGNE redefined as byte identity with src/scripts/ (on*= still refused)
affects: [07-02, 07-03, 07-04, 07-05, 07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One hash helper (node:crypto on the source files) shared by astro.config.mjs, check-dist and later the Caddy renderer"
    - "check-dist requires inclusion of each inline script/style hash in the effective directive (-elem, then -src, then default-src), never equality"

key-files:
  created:
    - src/lib/csp-empreintes.ts
    - tests/repo/scripts-en-ligne.test.ts
  modified:
    - astro.config.mjs
    - src/layouts/Base.astro
    - src/components/LecteurNiveaux.astro
    - src/components/OrdreCandidats.astro
    - .gitattributes
    - tests/repo/astro-config.test.ts
    - scripts/lib/check-dist.ts
    - tests/scripts/check-dist.test.ts

key-decisions:
  - "CSP_TROP_PERMISSIVE checks every directive occurrence, including a repeated directive the browser would ignore (stricter than the browser)"
  - "SCRIPT_NON_BLOQUANT applies to inline and external scripts alike; only an absent, empty or text/javascript type counts as classic"
  - "The default sourcesScripts list is read from src/scripts/*.js of the repository resolved from the check-dist module location, so the CLI needs no new option"

patterns-established:
  - "Inline code accepted only if byte-identical to a reviewed source file AND its hash is in the page CSP"
  - "CSS resource rules (@import/url()) factored into ressourcesCss() and applied to dist .css files and inline <style> text"

requirements-completed: [PERF-01]

# Metrics
duration: 15min
completed: 2026-11-07
---

# Phase 7 Plan 01: Inlining under a hash-based CSP meta Summary

**CSS and both scripts are now inlined in every page under one `<meta>` CSP that lists the sha256 of `src/scripts/niveau.js` and `ordre.js`, computed by node:crypto on the source files. check-dist replaces the ADR-037 "no inline code" rules with hash rules that are at least as strict: byte identity with the source, hash present in the effective directive, no permissive token.**

PERF-01 note: this plan delivers the build half and the control half. The rewritten dist cases (07-03) and the zero-violation e2e (07-05) complete the requirement's test coverage.

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-07T00:18Z (approx.)
- **Completed:** 2026-11-07T00:32Z
- **Tasks:** 2/2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `src/lib/csp-empreintes.ts`: `empreinteCsp(texte)` returns `sha256-<base64>` of the exact bytes (no trim). `scriptsEnLigne(root)` lists `src/scripts/*.js` sorted by name, with text and hash.
- `astro.config.mjs`: `build.inlineStylesheets: 'always'`, `assetsInlineLimit: 0` kept (with the reason), and `security.csp` exactly as in the spike. Script hashes come from `scriptsEnLigne(racine)`, with `racine` taken from `fileURLToPath` (never `.pathname`).
- `Base.astro` and `LecteurNiveaux.astro`: `?raw` import plus `<script is:inline set:html>` at the same place (order script in `<head>`, level script right after `</fieldset>`). `.gitattributes` forces LF on `src/scripts/*.js`.
- check-dist adds `CSP_ABSENTE`, `CSP_TROP_PERMISSIVE`, `SCRIPT_SANS_EMPREINTE` and `STYLE_SANS_EMPREINTE`. `SCRIPT_TROP_LOURD`, `SCRIPT_NON_BLOQUANT` and `RESSOURCE_TIERCE` now also cover inline scripts and inline `<style>`. `SCRIPT_EN_LIGNE` now means "body differs from every source" and still covers `on*=`. `STYLE_EN_LIGNE` stays for `style=`. `SCRIPT_DATA_URI` is unchanged.
- There is a fault-injection unit case for every new code. One case proves that a trailing newline is refused (no trim), one that a script before the meta is accepted (Pitfall 1), one that extra Astro island hashes are tolerated, and one that the hash lookup follows -elem, then -src, then default-src precedence.

## Measurements (fresh builds of the real corpus)

| Build | Pages | `_astro/` | check-dist |
|---|---|---|---|
| production | 65 | absent | 0 errors, 4 warnings (pre-existing CONTACT_PROVISOIRE, HEBERGEUR_PREVU) |
| preview | 68 | absent | 0 errors, 34 warnings (same two pre-existing codes) |

- `/themes/sante/` (preview, heaviest page): **174,290 bytes raw, 29,007 bytes gzip** (HTML only, which is now the whole page). The budget is 500,000 / 100,000.
- Heaviest production page: `/methode/`, 35,365 bytes raw, 11,797 bytes gzip.
- `themes/sante/index.html` has exactly one `http-equiv="content-security-policy"`. Both script bodies are byte-identical to the source files, and both hashes appear in `script-src`.

## Task Commits

1. **Task 1: Shared hash helper, inlined build with CSP meta, LF guard**: `4880d63` (feat)
2. **Task 2: check-dist hash-based CSP rules**: `0d8f6a9` (feat)

In both tasks the RED tests were written first and seen failing, then committed together with the implementation in the task's single commit.

## Verification

- `node --test tests/repo/scripts-en-ligne.test.ts tests/repo/astro-config.test.ts`: 16/16 pass. `npm run check`: 0 errors, 0 warnings, 0 hints.
- `node --test tests/scripts/check-dist.test.ts`: 58/58 pass.
- The plan's Task 2 verify command chain (fresh prod and preview builds, then check-dist): exit 0, « 0 erreur(s) » in both modes.
- `node --test --test-name-pattern="checkDist" tests/dist/site.test.ts`: 15/15 pass.
- Acceptance greps: `inlineStylesheets: 'always'` = 1, `assetsInlineLimit: 0` = 1, `unsafe-inline|unsafe-eval` in astro.config.mjs = 0, `?url` = 0 in both components, the `.gitattributes` rule = 1, new codes in check-dist.ts = 9 (at least 4 required), `empreinteCsp` = 3, `SCRIPT_EN_LIGNE` in tests = 7, `STYLE_EN_LIGNE` in tests = 3.
- Full `npm test`: 1683 tests, 1668 pass, 15 fail. All 15 failures are in the transitional list below.

## Transitional red list (by design, closed by 07-03)

These cases assert the old external form. They are red after this plan:

1. ordre.cas.ts:55: « toutes les pages : <script src="/_astro/ordre.<hash>.js"> bloquant, sans corps, avant le <body> »
2. ordre.cas.ts:78: « le fichier du dist pèse au plus 2048 octets et est identique à src/scripts/ordre.js »
3. ordre.cas.ts:172: « listes cachées sans décalage tant que data-ordre-fait manque, révélées par rtp-reveler après 1,5 s » (CSS)
4. ordre.cas.ts:184: « la phrase « demande JavaScript » est masquée quand le script a tourné » (CSS)
5. ordre.cas.ts:190: « le sélecteur de masquage ne dépend pas de prefers-reduced-motion » (CSS)
6. niveaux.cas.ts:83: « le script classique suit immédiatement </fieldset> : bloquant, haché, identique à la source, ≤ 2048 octets »
7. niveaux.cas.ts:170: « quatre règles :has() masquent les rédactions des autres niveaux » (CSS)
8. niveaux.cas.ts:180: « @supports :has() masque visuellement .etiquette » (CSS)
9. niveaux.cas.ts:190: « .concerne-aine masqué par défaut, affiché seulement au niveau Gros caractères » (CSS)
10. enfant.cas.ts:170: « repli sans Popover : @supports not selector(:popover-open) … » (CSS)
11. enfant.cas.ts:181: « « Mots expliqués » est masqué hors du niveau enfant … » (CSS)
12. enfant.cas.ts:188: « terme en pointillé et marqueur « ? » … » (CSS)
13. integration.cas.ts:38: « sélecteur de niveau suivi du script niveau »
14. theme.cas.ts:171: « production : feuille de style dans _astro/, aucun <style> ni style="" dans le HTML »
15. theme.cas.ts:171: « preview : feuille de style dans _astro/, aucun <style> ni style="" dans le HTML »

The plan's list also names the integration weight diagnostic (integration.cas.ts:135). That case is **not red**. Its `/_astro/` regex no longer matches anything, so it measures the HTML alone, which is now the full page weight, and `lourdes.length === 3` still holds. 07-03 can still simplify its regex (Pitfall 8). Every `checkDist …` case of tests/dist is green.

## Files Created/Modified

- `src/lib/csp-empreintes.ts`: the single CSP hash helper.
- `astro.config.mjs`: inlining and the `security.csp` meta configuration.
- `src/layouts/Base.astro`, `src/components/LecteurNiveaux.astro`: `?raw` inline scripts.
- `src/components/OrdreCandidats.astro`: header comment only.
- `.gitattributes`: `src/scripts/*.js text eol=lf`.
- `tests/repo/scripts-en-ligne.test.ts`: known SHA-256 vector, helper output, LF, no BOM, size cap, and the `.gitattributes` rule.
- `tests/repo/astro-config.test.ts`: the 'never' test is replaced by inline + CSP assertions (the assetsInlineLimit assertion is kept).
- `scripts/lib/check-dist.ts`: hash-based CSP rules, `sourcesScripts` option, `ressourcesCss()`.
- `tests/scripts/check-dist.test.ts`: the synthetic page carries a CSP meta, plus the new CSP describe block and the updated older cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Stricter check] CSP_TROP_PERMISSIVE also inspects repeated directives**
- **Found during:** Task 2 (GREEN run)
- **Issue:** The browser ignores a repeated directive after the first one, so a parser that follows the browser would let `script-src 'self'; script-src 'unsafe-inline'` through without a finding. The policy is harmless today, but it would be a trap if the first occurrence were ever removed.
- **Fix:** Tokens are now checked in every occurrence (`directivesCsp`). The effective lists used for hash lookup still follow the browser's first-wins rule (`politiqueEffective`). A unit case covers this.
- **Files modified:** scripts/lib/check-dist.ts, tests/scripts/check-dist.test.ts
- **Commit:** 0d8f6a9

**2. [Rule 3 - Acceptance grep] astro.config.mjs comment reworded**
- **Found during:** Task 1
- **Issue:** The acceptance criterion `grep -cE "unsafe-inline|unsafe-eval" astro.config.mjs = 0` also counts comments, and my first comment said « jamais 'unsafe-inline' ni 'unsafe-eval' ».
- **Fix:** The comment now says « Aucun mot-clé « unsafe-* » (check-dist CSP_TROP_PERMISSIVE) ».
- **Commit:** 4880d63

**3. [Test fixture] The "external script still weighed" case expects POIDS_BRUT and SCRIPT_TROP_LOURD together**
- **Found during:** Task 2
- **Issue:** A linked `.js` of more than 500 KB also trips SCRIPT_TROP_LOURD, so `exactement('POIDS_BRUT', …)` could not hold.
- **Fix:** The case now asserts both codes and both files (`index.html` for the weight, `_astro/n.js` for the size).
- **Commit:** 0d8f6a9

No CLAUDE.md-driven adjustment. No new dependency and no new npm script. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched. Nothing was pushed.

## Known Stubs

None.

## Next Phase Readiness

- 07-02, 07-03 and 07-04 can rely on `empreinteCsp` and `scriptsEnLigne` from `src/lib/csp-empreintes.ts`, and on the four new check-dist codes (the RUNBOOK code table update belongs to 07-08).
- 07-03 must rewrite the 15 transitional cases listed above, using a shared `<style>` reader instead of `dist/_astro/*.css` (Pitfall 4).
- 07-05: `e2e/texte.spec.ts` uses `page.addStyleTag`, which the CSP now blocks. It needs `bypassCSP: true` (Pitfall 2). It was not run here: no e2e in this plan.

## Self-Check: PASSED

- FOUND: src/lib/csp-empreintes.ts, tests/repo/scripts-en-ligne.test.ts
- FOUND: commits 4880d63, 0d8f6a9
