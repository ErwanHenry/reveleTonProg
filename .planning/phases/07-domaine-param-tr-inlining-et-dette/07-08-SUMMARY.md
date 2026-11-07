---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 08
subsystem: docs, testing, ci
tags: [adr, runbook, csp, caddy, domain, docs-pins, gate, ci]

# Dependency graph
requires:
  - phase: 07-01
    provides: inlined build under a hash CSP meta, check-dist CSP codes, SCRIPT_EN_LIGNE / STYLE_EN_LIGNE redefined
  - phase: 07-02
    provides: W3 preview sentence, W10 BlocSource, W7 types vs schemas test
  - phase: 07-03
    provides: dist cases for the inline form, csp.cas mutation proofs
  - phase: 07-04
    provides: domaine in config/site.yml, canonical, sitemap, robots, combined deployment error
  - phase: 07-05
    provides: csp, csp-sans-js, parcours (channel chromium) and retour specs, bypassCSP, 4G figures
  - phase: 07-06
    provides: CANONIQUE_*, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP, DOMAINE_PROVISOIRE, PREVIEW_INDEXABLE cases, host guard
  - phase: 07-07
    provides: scripts/render-caddy.ts, deploy/caddy/site.caddy, Caddy container assumptions
provides:
  - ADR-053 (domain declared once) and ADR-056 (inline CSS and scripts, hash CSP), ADR-037 marked replaced, ADR-051 public-repository note
  - RUNBOOK rows for every CODES_CHECK_DIST code, « Changer de domaine », « Modifier un script de src/scripts/ », « Bloc Caddy (Phase 8) »
  - tests/repo/docs.test.ts « documentation (phase 7) » pins (8 cases)
  - Phase 7 full gate evidence, local and CI (run 42325996304)
affects: [phase-08, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A doc pin on a code list imports the list from the code (CODES_CHECK_DIST), so a new code without a RUNBOOK row fails npm test"
    - "An ADR section is the text from its title line to the next ## or ### heading; pins assert words inside that section, plus a negative regex against an overstated claim"

key-files:
  created:
    - .planning/phases/07-domaine-param-tr-inlining-et-dette/07-08-SUMMARY.md
  modified:
    - docs/ARCHITECTURE.md
    - docs/RUNBOOK.md
    - README.md
    - tests/repo/docs.test.ts

key-decisions:
  - "ADR-056 has a separate « Limite » bullet: the meta comes after the order script and does not protect it; the header CSP of deploy/caddy/site.caddy covers it once Phase 8 applies the block. A negative regex in docs.test refuses « meta … couvre/protège le script d'ordre »"
  - "ADR-051 note: drafts and the site-preview artefact are readable by anyone since 2026-11-04 (artefact download needs a GitHub login); « rien n'est exposé » now holds only for hosting; preview never deployed, Phase 8 checks it"
  - "Deployment steps renumbered: new step 6 replaces the provisional domain (and re-renders the Caddy block), contact becomes step 7"
  - "Caddy container assumptions for Phase 8 live in a RUNBOOK « Bloc Caddy (Phase 8) » section under Déploiement, not in the ADR"
  - "Mermaid diagram gains config/site.yml, scripts/render-caddy.ts and deploy/caddy/site.caddy (dotted edge to the VPS, « appliqué en Phase 8 »); every earlier node kept"

patterns-established:
  - "Docs pins for a phase import the code constant they document instead of copying it"

requirements-completed: [HEB-05, HEB-06, PERF-01, DETTE-01, DETTE-02, DETTE-03, DETTE-05]

# Metrics
duration: 18min
completed: 2026-11-07
---

# Phase 7 Plan 08: Phase 7 documentation and full gate Summary

**The docs now describe what Phase 7 built. ADR-053 covers the domain declared once in `config/site.yml`. ADR-056 replaces ADR-037: CSS and scripts are in the page under a hash CSP, and the ADR states the limit plainly: the meta does not cover the order script, the Caddy header does. ADR-051 notes that drafts and `site-preview` have been public since 2026-11-04. The RUNBOOK documents all 35 check-dist codes, « Changer de domaine », the combined deployment error and the Caddy assumptions for Phase 8. Tests pin each of these statements. The full gate is green locally and in CI on the first push.**

## Performance

- **Duration:** about 18 min
- **Started:** 2026-11-07T01:37Z (approx.)
- **Completed:** 2026-11-07T01:55Z
- **Tasks:** 2/2
- **Files modified:** 4 (plus this SUMMARY)

## Accomplishments

- **ARCHITECTURE.**
  - **ADR-053**: strict reader; `site`, canonical and `sitemap.xml` in production only; the robots `Sitemap:` line; `node scripts/render-caddy.ts` plus the drift test; the host guard; the five domain codes; the exact combined `RTP_DEPLOIEMENT=1` error and the single warning.
  - **ADR-056**: `inlineStylesheets: 'always'`, `assetsInlineLimit: 0`, `?raw` + `is:inline set:html`. Hashes come from `src/lib/csp-empreintes.ts`. It lists the identity and hash rules (`SCRIPT_EN_LIGNE`, `SCRIPT_SANS_EMPREINTE`, `STYLE_SANS_EMPREINTE`, `CSP_ABSENTE`, `CSP_TROP_PERMISSIVE`) and says the 5 Astro island hashes are accepted because check-dist only requires inclusion. The **Limite** bullet comes next, then the alternatives (`Astro.csp.insertScriptHash`; option B was not needed) and the tests (`bypassCSP`, `channel: 'chromium'`). Its consequence says to restart `astro dev` and re-render the block after a script change.
  - ADR-037 is titled « … (remplacée par l'ADR-056) » and has a « Remplacée » bullet.
  - ADR-051 has the dated Phase 7 note.
  - The diagram has three new nodes.
- **RUNBOOK.**
  - **Codes table**: 9 new rows. `SCRIPT_EN_LIGNE` now means byte identity with `src/scripts/` or `on…=`. `STYLE_EN_LIGNE` now means only `style=`. `PREVIEW_INDEXABLE` lists its new triggers: canonical, sitemap.xml, robots `Sitemap:`.
  - **« Garde de déploiement (contact et domaine) »**: the domain guard, the exact combined error, the single warning, and the render-caddy refusal (exit 2).
  - **New sections**:
    - `### Changer de domaine`: 5 steps.
    - `### Modifier un script de src/scripts/`: restart `astro dev`, re-render, commit the block.
    - `### Bloc Caddy (Phase 8)`: container paths `/srv/reveletonprog/current` (read-only mount) and `/var/log/caddy` (writable mount), `caddy validate` through `docker exec`, and assumptions A2, A5 and `client_ip`. Do not apply while the domain is `.invalid`.
  - **e2e**: the csp, csp-sans-js, parcours and retour specs, `bypassCSP`, `channel: 'chromium'` and the 4G figures after inlining.
  - **Deployment step 6**: the provisional domain.
- **README.** The hosting line now says the domain lives only in `config/site.yml` and the Caddy block is generated in `deploy/caddy/site.caddy` by `node scripts/render-caddy.ts`.
- **docs.test.ts.** `describe('documentation (phase 7)')` has 8 cases:
  - ADR-053 and ADR-056 present, and no `ADR-05[4578]` title (those numbers are reserved).
  - The ADR-037 title.
  - ADR-056 words, plus the negative regex.
  - ADR-051 words.
  - ADR-053 words.
  - The RUNBOOK needles.
  - Every `CODES_CHECK_DIST` code in backticks.
  - The README needles.

## Gate results (local, Node 24, `RTP_DEPLOIEMENT` unset, run one after another)

| # | Step | Result |
|---|------|--------|
| 1 | `migrate -- --check`, fixture / real | 10 / 391 files up to date |
| 1 | `validate -- --mode production`, fixture / real | 0 errors (real: 17 warnings, as before) |
| 1 | `RTP_CONTENT_ROOT=. ids -- --check` | 59 / 59 locked, 0 problems |
| 1 | `npm run check` | 206 files, 0 errors, 0 warnings, 0 hints |
| 1 | `npm test` | **1819 / 1819 pass** (1811 before + 8 new doc pins) |
| 1 | fixture build + `check-dist` | 0 errors, 7 warnings |
| 1 | real production build `dist-reel` + `check-dist --mode production` | 0 errors, 5 warnings (CONTACT_PROVISOIRE, HEBERGEUR_PREVU, DOMAINE_PROVISOIRE) |
| 1 | real preview build `dist-preview` + `check-dist --mode preview` | 0 errors, 35 warnings; no `_astro/` folder |
| 2 | `node scripts/render-caddy.ts --check` | exit 0, « deploy/caddy/site.caddy à jour » |
| 3 | `npm run e2e` | exit 0: m1 **256 passed** (57.2 s), real **1174 passed** (3.9 min) |
| 4 | `RTP_CONTENT_ROOT=. RTP_DEPLOIEMENT=1 npx astro build --outDir /tmp/rtp-0708-deploiement` | **exit 1**, « config/site.yml : domaine provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire (.invalid) refusé … », no index.html written |
| 5 | `git grep -n "unsafe-inline" -- src astro.config.mjs deploy` | prints nothing (exit 1) |

**Heaviest preview page** (dist-preview, gzip level 6): `/themes/sante/` is **180,590 bytes raw and 29,622 bytes gzip** (budget 500,000 / 100,000). Next come `/themes/travail/` (175,753 / 28,346) and `/themes/europe-et-monde/` (175,983 / 28,263).

**4G (local e2e run):**
- m1 `/methode/`: latence-150 at 225 / 225 / 217 ms, slow-4g at 642 / 640 / 637 ms.
- real `/themes/sante/`: latence-150 at 300 / 300 / 300 ms, slow-4g at 727 / 729 / 727 ms.
- Budgets are 1000 / 1500 ms, unchanged.

## CI on main

- Pushed `51a8f60..bf7b311` to `origin/main`. Run **42325996304** (workflow CI, push), watched with `gh run watch --exit-status`. **Conclusion: success** on the first push.
  - `Vérifier (migrate, validate, check, test, build)`: success
  - `Tests navigateur (Playwright, axe, 4G)`: success. m1 256 passed (59.9 s), real 1174 passed (4.2 min). Slow 4G on `/themes/sante/`: 729 / 730 / 728 ms.
  - `Chercher des secrets (gitleaks, historique complet)`: success
- **Assumption A1 confirmed**: the CI e2e log shows the `[parcours]` project running both tests on both datasets (4 passed): « niveau gardé … après un retour restauré du bfcache » and « preuve par mutation : sans gestionnaire pageshow ». `channel: 'chromium'` works on ubuntu-24.04 with `npx playwright install --with-deps chromium`.

## Requirement to test map (all passing in this gate)

| Requirement | Passing evidence |
|---|---|
| HEB-05 | tests/corpus/site-config.test.ts, tests/corpus/sitemap.test.ts, tests/repo/astro-config.test.ts, tests/dist/cas/domaine.cas.ts, tests/scripts/check-dist.test.ts (CANONIQUE_*, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP), tests/repo/caddy.test.ts (drift), tests/repo/hote-en-dur.test.ts, `render-caddy --check` |
| HEB-06 | tests/corpus/site-config.test.ts, tests/dist/cas/domaine.cas.ts (failing build), tests/scripts/check-dist.test.ts (DOMAINE_PROVISOIRE, CLI), gate step 4 |
| PERF-01 | tests/repo/scripts-en-ligne.test.ts, tests/repo/astro-config.test.ts, tests/scripts/check-dist.test.ts, tests/dist/cas/csp.cas.ts (+ ordre, niveaux, enfant, integration, theme cases), e2e/csp.spec.ts, e2e/csp-sans-js.spec.ts, e2e/sans-js.spec.ts, e2e/4g.spec.ts, tests/repo/caddy.test.ts (header CSP), gate step 5 |
| DETTE-01 | tests/corpus/vue.test.ts, tests/dist/cas/couverture-preview.cas.ts |
| DETTE-02 | e2e/parcours.spec.ts (project parcours, local and CI), e2e/retour.spec.ts |
| DETTE-03 | tests/dist/cas/theme.cas.ts (W10 cases), e2e/axe.spec.ts and e2e/texte.spec.ts on the final build |
| DETTE-05 | tests/corpus/types-schemas.test.ts |

ROADMAP Phase 7 success criteria: (1) domain change propagates and the hard-coded host test fails: HEB-05 row. (2) The deployment build fails with a clear message: HEB-06 row and gate step 4. (3) Inline CSS and scripts, identity and hash, no unsafe-inline, complete without JS: PERF-01 row. (4) Click path keeps the level after back: DETTE-02 row. (5) Honest preview sentence, full consulted sources, types vs schemas: DETTE-01, DETTE-03 and DETTE-05 rows.

Still manual for Phase 8, as listed in 07-VALIDATION:
- `caddy validate` on the VPS, with A2, A5 and `client_ip`.
- Header CSP plus meta together, behind the real server.

## Task Commits

1. **Task 1 RED: phase 7 documentation pins**: `0a11b9a` (test). All 8 new cases failed before the docs.
2. **Task 1 GREEN: ADRs, RUNBOOK, README** (with the helper fix): `bf7b311` (docs)
3. **Task 2: full gate and CI**: no file change. The gate found no RUNBOOK inaccuracy.
4. **Plan metadata**: this SUMMARY (docs commit, pushed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] My ADR-section helper in docs.test returned an empty section**
- **Found during:** Task 1 (first GREEN run, 3 ADR cases still red)
- **Issue:** `architecture.slice(debut + 1)` left `## ADR-…` at index 0, and the end search `^#{2,3} ` matched there at once.
- **Fix:** cut after the title line, then search the next `##` or `###` heading in the body.
- **Files modified:** tests/repo/docs.test.ts
- **Commit:** bf7b311

**Additions beyond the plan (docs and tests only):**
- The negative regex against « meta … couvre/protège le script d'ordre » (T-07-30).
- The pin that no ADR-054/055/057/058 title exists.
- A RUNBOOK section `### Bloc Caddy (Phase 8)` with the container assumptions from 07-07, as the orchestrator asked.
- A RUNBOOK section `### Modifier un script de src/scripts/`. It also gives the plan's dev note a natural place.

No CLAUDE.md-driven adjustment. New French text has no em dash or en dash (checked on the diff). No dependency and no npm script added. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched. STATE.md and ROADMAP.md were not updated (orchestrator instruction).

## Deferred Issues

None new. The open observation in deferred-items.md (memoized `loadSiteConfig` evaluated before the guard, no current impact) is unchanged.

## Known Stubs

None.

## Threat Flags

None. Documentation and test changes only. T-07-30 to T-07-33 are mitigated as registered: limit written and pinned, public-repository note, no check relaxed, CI watched and A1 confirmed.

## Self-Check: PASSED

- FOUND: docs/ARCHITECTURE.md (ADR-053, ADR-056), docs/RUNBOOK.md (### Changer de domaine), README.md, tests/repo/docs.test.ts (documentation (phase 7))
- FOUND commits: 0a11b9a, bf7b311
- FOUND CI run 42325996304: success (3 of 3 jobs)
