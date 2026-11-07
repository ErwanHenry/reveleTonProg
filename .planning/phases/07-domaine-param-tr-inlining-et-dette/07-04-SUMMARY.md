---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 04
subsystem: config, build, seo, testing
tags: [astro, site-config, canonical, sitemap, robots, deployment-guard, node-test]

# Dependency graph
requires:
  - phase: 07-01
    provides: astro.config.mjs with racine via fileURLToPath, inlined build, CSP meta (unchanged here)
  - phase: 07-02
    provides: dist harness that imports every case module before declaring suites
provides:
  - config/site.yml `domaine` (provisional .invalid), the single source of the site host
  - SiteConfig.domaine and SiteConfig.domaineProvisoire, strict host validation, one deployment error naming every provisional field
  - astro.config.mjs `site: https://<domaine>`
  - src/lib/sitemap.ts (cheminsDuSite, xmlSitemap, texteRobots), pure and unit-tested with synthetic domains
  - src/pages/[fichier].xml.ts (sitemap.xml in production only), robots.txt Sitemap line in production
  - One <link rel="canonical"> per production page in Base.astro, none in preview
  - Dist harness option `env` and removal of an inherited RTP_DEPLOIEMENT
  - tests/dist/cas/domaine.cas.ts (HEB-05 production and preview, HEB-06 failing deployment build)
affects: [07-06, 07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain-derived texts are pure functions of (site URL, paths, mode); endpoints only pass context.site"
    - "Production-only file through a dynamic route whose getStaticPaths is empty in preview"
    - "Tests never write the site host: fixtures use exemple.fr / exemple.invalid / exemple.test, repo assertions read loadSiteConfig(REPO)"

key-files:
  created:
    - src/lib/sitemap.ts
    - src/pages/[fichier].xml.ts
    - tests/corpus/sitemap.test.ts
    - tests/dist/cas/domaine.cas.ts
  modified:
    - config/site.yml
    - src/lib/site-config.ts
    - tests/corpus/site-config.test.ts
    - astro.config.mjs
    - tests/repo/astro-config.test.ts
    - src/layouts/Base.astro
    - src/pages/robots.txt.ts
    - tests/dist/contexte.ts
    - tests/dist/site.test.ts

key-decisions:
  - "Under RTP_DEPLOIEMENT=1 the domain and contact clauses are joined with « ; » in ONE error prefixed once by « config/site.yml : »"
  - "The single provisional-values console warning now names both values (« config/site.yml : valeurs provisoires (.invalid), à remplacer avant le déploiement : domaine …, contact … »)"
  - "xmlSitemap refuses a path that does not start with / or starts with // (no way to emit a loc outside the domain), and escapes & < > \" ' in every loc"
  - "domaine.cas reads the configured domain with loadSiteConfig(ctx.repoRoot, {}) so an exported RTP_DEPLOIEMENT=1 cannot prevent declaring the cases"

patterns-established:
  - "A dist case that needs a failing build passes the variable through construire({ env }) under its own memo key; the harness never inherits RTP_DEPLOIEMENT"

requirements-completed: [HEB-05, HEB-06]

# Metrics
duration: 10min
completed: 2026-11-07
---

# Phase 7 Plan 04: Domain declared once, canonical, sitemap and robots, deployment guard Summary

**The site host is now declared once, as `domaine:` in config/site.yml, and checked by a strict host-name reader. It drives Astro's `site`, one canonical link per production page, a hand-written sitemap.xml and the robots.txt Sitemap line. A build under `RTP_DEPLOIEMENT=1` exits 1 with « config/site.yml : domaine provisoire (.invalid) refusé… » for as long as the domain is not bought.**

HEB-05 note: this plan delivers the build half. The check-dist rules (canonical, sitemap, DOMAINE_PROVISOIRE) and the guard against hard-coded hosts belong to 07-06, and the Caddy block belongs to 07-07.

## Performance

- **Duration:** about 10 min
- **Started:** 2026-11-07T01:47 (local)
- **Completed:** 2026-11-07T01:56 (local)
- **Tasks:** 3/3
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- **Reader (D-01, D-02).** `CLES` is now `domaine, contact, depot`. The host regex accepts labels of `[a-z0-9]` with inner hyphens (63 characters at most), needs at least two labels and an alphabetic TLD of 2 to 63 letters, caps the total length at 253 and refuses a leading `www.`. The « racine non objet » and « fichier introuvable » messages list the three keys. Under `RTP_DEPLOIEMENT=1` the reader collects the provisional fields and throws a single error. `estDeploiement` is still read first (IN-06 unchanged).
- **Astro.** `site: \`https://${domaine}\`` comes from `loadSiteConfig(racine)`. If the config fails to load, `astro build` exits non-zero before rendering any page (the dist case checks that no index.html is written).
- **Pure functions (D-03).** `cheminsDuSite` returns `/`, `/themes/`, each theme, `/candidats/`, each candidate and the three institutional pages, sorted and with no duplicates. `xmlSitemap` builds the sitemaps.org 0.9 urlset. `texteRobots` returns the exact preview text (`Disallow: /`) and adds `Sitemap: <site>/sitemap.xml` in production. A different domain gives different texts (unit-proven with exemple.test and autre.test).
- **Endpoints and layout.** `[fichier].xml.ts` has an empty `getStaticPaths` in preview, so no file is written there. `robots.txt.ts` delegates to `texteRobots`. `Base.astro` emits the canonical link only when `corpus.mode !== 'preview'`. No visible text changed.
- **Harness.** `construire` deletes an inherited `RTP_DEPLOIEMENT` (as it already did for RTP_MODE) and merges `opts.env` last. The memo key is still the caller's `cle`. Both the header of site.test.ts and contexte.ts document this.

## Measurements (real corpus, fresh builds)

| Build | Pages | canonical | sitemap.xml | robots.txt | check-dist |
|---|---|---|---|---|---|
| production | 65 | exactly 1 on each page | 65 `<loc>` | `Allow: /` + `Sitemap: https://<domaine>/sitemap.xml` | 0 errors, 4 warnings (same as 07-01) |
| preview | 68 | 0 | absent | `Disallow: /`, no Sitemap | 0 errors, 34 warnings (same as 07-01) |

## Task Commits

1. **Task 1: domaine, strict reader, deployment guard, Astro `site`**: `7005ac7` (feat)
2. **Task 2: canonical, sitemap.xml, robots.txt**: `6e4838e` (feat)
3. **Task 3: harness env option and HEB-05 / HEB-06 dist cases**: `22c228b` (test)

For Tasks 1 and 2 the RED tests were written first and seen failing: 11 site-config failures, and sitemap.test failed on the missing module. Each was then committed together with its implementation.

## Verification

- `node --test tests/corpus/site-config.test.ts tests/repo/astro-config.test.ts`: 41/41 pass. `npm run check`: 0 errors, 0 warnings, 0 hints.
- `node --test tests/corpus/sitemap.test.ts`: 9/9 pass.
- `node --test --test-name-pattern="HEB-05 :|HEB-06 :|checkDist" tests/dist/site.test.ts`: 21/21 pass. The same HEB filter run with `RTP_DEPLOIEMENT=1` exported in the shell gives 6/6, which proves that test builds no longer inherit the variable.
- `RTP_DEPLOIEMENT=1 node -e "import('./src/lib/site-config.ts').then(m=>m.loadSiteConfig())"` exits 1 with « config/site.yml : domaine provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire (.invalid) refusé… ».
- Acceptance greps: `^domaine: ` in site.yml = 1; `domaine-a-definir` in site-config.test.ts = 0 and in domaine.cas.ts = 0; `rel="canonical"` in Base.astro = 1; `mode !== 'preview'` in Base.astro = 2; `delete env.RTP_DEPLOIEMENT` = 1; `HEB-0[56] :` in domaine.cas.ts = 6; `git diff -- package.json` empty (no @astrojs/sitemap).
- **Full `npm test`:** 1734 tests, 1719 pass, 15 fail. The 15 failures are exactly the transitional list in 07-01-SUMMARY.md (closed by 07-03). Nothing else is red (+32 tests compared with 07-02's 1702).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing check] xmlSitemap refuses paths that could leave the domain (T-07-14)**
- **Found during:** Task 2
- **Issue:** `new URL('//ailleurs.test/', site)` resolves to another host, and a relative path resolves against whatever path `site` has.
- **Fix:** Any path that does not start with `/`, or starts with `//`, throws « sitemap : chemin … invalide ». A unit case covers it.
- **Commit:** 6e4838e

**2. [Rule 1 - Bug] domaine.cas could not be declared with RTP_DEPLOIEMENT=1 exported**
- **Found during:** Task 3 (verify run with the variable exported)
- **Issue:** The plan says to read `loadSiteConfig(ctx.repoRoot)`. That call uses `process.env` in the test process, so the guard threw while the module was being declared, even though the builds themselves were now clean.
- **Fix:** `loadSiteConfig(ctx.repoRoot, {})` reads the configured value without evaluating the guard.
- **Commit:** 22c228b

**3. [Acceptance grep] The second `mode !== 'preview'` occurrence in Base.astro is a comment**
- The criterion asks for at least 2 occurrences. The banner and noindex already used `=== 'preview'`, and I did not rewrite them. The comment above the canonical link explains why `Astro.site` alone is not enough (it is set in both modes).

**Additions beyond the plan (tests only):** site-config also accepts a 253-character host and a subdomain, refuses a non-string `domaine`, and checks the wording of « racine non objet ». domaine.cas also checks that the preview dist has no `.xml` file at all, that preview robots.txt does not mention the domain, and that the refused deployment build writes no index.html.

No CLAUDE.md-driven adjustment. No new dependency and no npm script. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched. The provisional host literal appears only in config/site.yml (built dist outputs aside). Nothing was pushed. STATE.md and ROADMAP.md were not updated (orchestrator instruction).

## Deferred Issues

- If `RTP_DEPLOIEMENT=1` is exported in the developer's shell, a full `npm test` still fails in modules that call `loadSiteConfig(REPO)` with `process.env` in the test process: `tests/dist/cas/institutionnel.cas.ts` (« mentions légales » suite), `tests/repo/astro-config.test.ts` (imports astro.config.mjs) and the repo case of `tests/corpus/site-config.test.ts`. This predates this plan (the provisional contact already triggered it) and it is out of scope, because the plan only covers builds. A simple fix is to pass `{}` as env in those test-side reads, as domaine.cas does. Logged in deferred-items.md.

## Known Stubs

None. The domain value itself is provisional on purpose (D-01), and the deployment guard blocks it.

## Threat Flags

None. sitemap.xml and the canonical link are new public outputs, but they are the surface listed in the plan's threat model (T-07-13, T-07-14), and the dist cases cover both mitigations.

## Next Phase Readiness

- 07-06: check-dist can take `domaine` from `loadSiteConfig` and mirror the dist assertions here (CANONIQUE_ABSENT/INCORRECT, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP, DOMAINE_PROVISOIRE). The hard-coded host guard can rely on fixtures having no `domaine-a-definir` in site-config.test.ts or domaine.cas.ts. The remaining occurrences named by the research (source.cas.ts:69, check-dist.test.ts:242,464,488) are still there.
- 07-07: `loadSiteConfig(REPO).domaine` is available to the Caddy renderer. The site.yml comment already names `node scripts/render-caddy.ts`.
- 07-08: the RUNBOOK and ADR-053 should document the « config/site.yml : valeurs provisoires » warning and the single combined deployment error.

## Self-Check: PASSED

- FOUND: src/lib/sitemap.ts, src/pages/[fichier].xml.ts, tests/corpus/sitemap.test.ts, tests/dist/cas/domaine.cas.ts
- FOUND: commits 7005ac7, 6e4838e, 22c228b
