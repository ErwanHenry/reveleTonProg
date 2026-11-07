---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 06
subsystem: check-dist, testing, config
tags: [check-dist, canonical, sitemap, robots, deployment-guard, repo-guard, node-test]

# Dependency graph
requires:
  - phase: 07-01
    provides: check-dist hash rules, signaler/severity pattern, OptionsCheckDist.sourcesScripts
  - phase: 07-03
    provides: dist cases rewritten for the inline form
  - phase: 07-04
    provides: SiteConfig.domaine / domaineProvisoire, canonical per production page, sitemap.xml, robots Sitemap line, domaine.cas
provides:
  - check-dist codes CANONIQUE_ABSENT, CANONIQUE_INCORRECT, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP, DOMAINE_PROVISOIRE
  - OptionsCheckDist.domaine (CLI passes loadSiteConfig(projectRoot, {}).domaine)
  - PREVIEW_INDEXABLE extended to canonical, sitemap.xml and robots Sitemap line in preview
  - tests/repo/hote-en-dur.test.ts with the pure trouverHotesEnDur (D-04 guard)
  - npm test green with RTP_DEPLOIEMENT=1 exported (deferred item from 07-04 resolved)
affects: [07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain rules run only when opts.domaine is given; the CLI always gives it, direct unit calls stay valid"
    - "The CLI reads config/site.yml with an empty env: the deployment decision belongs to check-dist, which reports DOMAINE_PROVISOIRE as an error instead of crashing"
    - "Synthetic dists carry canonical, sitemap.xml and robots for their domain (exemple.test by default, SITE.domaine for CLI cases)"
    - "Test-side reads of repo config always pass {} as env"

key-files:
  created:
    - tests/repo/hote-en-dur.test.ts
  modified:
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - tests/scripts/check-dist.test.ts
    - tests/dist/cas/domaine.cas.ts
    - tests/dist/cas/source.cas.ts
    - tests/dist/cas/institutionnel.cas.ts
    - tests/dist/cas/methode.cas.ts
    - tests/repo/astro-config.test.ts
    - tests/corpus/site-config.test.ts
    - .planning/phases/07-domaine-param-tr-inlining-et-dette/deferred-items.md

key-decisions:
  - "A count of canonicals other than 1 is CANONIQUE_ABSENT; one canonical that differs from new URL(path, https://<domaine>).href (relative, http:, other host, www., wrong path) is CANONIQUE_INCORRECT"
  - "The sitemap is compared with the EXPECTED canonical of every production page (not the canonicals as written), so a wrong canonical is reported once as CANONIQUE_INCORRECT and the sitemap is judged on its own; duplicates are also SITEMAP_INCOHERENT"
  - "DOMAINE_PROVISOIRE is reported in both modes, like CONTACT_PROVISOIRE (warning; error only under deploiement)"
  - "checkDist throws on an invalid opts.domaine (scheme, port, path, empty) rather than running a silently wrong check"
  - "The host guard also refuses `<domaine>.<label>` as a different host (exemple.test.fr), on top of the plan's boundary regex"
  - "The check-dist CLI exits 2 with the reader's message when config/site.yml is invalid"

patterns-established:
  - "A repository guard is a pure function tested by fault injection, then run on git ls-files of the real repository"

requirements-completed: [HEB-05, HEB-06]

# Metrics
duration: 12min
completed: 2026-11-07
---

# Phase 7 Plan 06: check-dist domain rules and the hard-coded host guard Summary

**check-dist now proves that the dist follows the domain of config/site.yml. In production, each page has exactly one canonical equal to `https://<domaine>` + its path, sitemap.xml lists exactly those URLs, and robots.txt points to it. In preview, none of the three is allowed. A `.invalid` domain blocks deployment through DOMAINE_PROVISOIRE. A repository test fails as soon as the site host, or any subdomain of it, appears in a tracked file outside config/site.yml.**

HEB-05 note: this plan delivers the control half and the "test fails on a hard-coded host" clause. Only the Caddy block remains, in 07-07. HEB-06: both the build half (07-04) and the check-dist half (here) are done.

## Performance

- **Duration:** about 12 min
- **Started:** 2026-11-07T02:18 (local)
- **Completed:** 2026-11-07T02:30 (local)
- **Tasks:** 2/2, plus the deferred-item fix
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments

- **New codes.** `CANONIQUE_ABSENT`, `CANONIQUE_INCORRECT`, `SITEMAP_INCOHERENT`, `ROBOTS_SANS_SITEMAP` and `DOMAINE_PROVISOIRE` are in `CODES_CHECK_DIST`. `OptionsCheckDist.domaine` is documented (apex host, no scheme).
- **Expected paths.** `index.html` maps to `/`, `a/index.html` to `/a/`, and `a.html` to `/a.html`. Comparison goes through `new URL().href`, so an upper-case host is accepted and `&` is percent-normalised. `<loc>` values are parsed with a regex and XML entities are decoded, with `&amp;` decoded last. The message lists up to 3 differences per kind (missing, extra, duplicate) plus the total.
- **Preview.** A canonical on a page, a sitemap.xml file or a `Sitemap:` line in robots.txt is `PREVIEW_INDEXABLE`, with or without `domaine`. The `Disallow: /` rule is unchanged.
- **DOMAINE_PROVISOIRE.** One dist-wide finding (`fichier: '.'`) when `domaine` ends with `.invalid`. Without `domaine`, there is one finding per production page whose canonical host ends with `.invalid`. It is a warning by default and an error under `deploiement`. `CONTACT_PROVISOIRE` and `DOMAINE_PROVISOIRE` share one `severiteDeploiement`.
- **CLI.** It reads `loadSiteConfig(projectRoot, {})` and passes `domaine`. The USAGE text now lists contact, hébergeur and domaine on the RTP_DEPLOIEMENT=1 line, and an invalid config/site.yml exits 2.
- **Host guard (D-04).** `trouverHotesEnDur(fichiers, domaine)` matches case-insensitively on host-name boundaries, catching any subdomain (the Phase 8 technical host included) and `contact@<domaine>`. It skips the documented exclusions and binary files. The real scan uses `git ls-files -z`, falling back to a filesystem walk. While the domain is provisional, it also refuses a copied provisional contact.

## Measurements (real corpus, fresh production build `/tmp/rtp-0706`)

| Command | Exit | Result |
|---|---|---|
| `check-dist --mode production` | 0 | 0 errors, 5 warnings (4 earlier ones + DOMAINE_PROVISOIRE) |
| `RTP_DEPLOIEMENT=1 check-dist --mode production` | 1 | 5 errors, including `DOMAINE_PROVISOIRE . : domaine provisoire (.invalid) : … ; renseigner le vrai domaine dans config/site.yml avant de déployer` |

On m1 builds, `checkDist({ mode, cellulesParTheme, domaine })` reports 0 errors in production and in preview, plus exactly one DOMAINE_PROVISOIRE warning (`.`) while the domain is provisional.

## Task Commits

1. **Task 1: check-dist domain rules, DOMAINE_PROVISOIRE and CLI wiring**: `38f6fb7` (feat)
2. **Task 2: repository guard against hard-coded site host names**: `ae42fe7` (test)
3. **Deferred item from 07-04 (exported RTP_DEPLOIEMENT)**: `f485612` (test)

TDD: in Task 1, the new tests were run against the HEAD implementation (files swapped back temporarily) and 11 failed, covering every new domain case and the 3 new or changed CLI cases. They pass with the new code. In Task 2, the real-repository scan was seen failing on `tests/dist/cas/source.cas.ts:69` before the fix. Each task's tests went into the same commit as its implementation.

## Verification

- `node --test tests/scripts/check-dist.test.ts`: 71/71 (13 new: 10 domain unit cases, 3 CLI cases).
- `node --test --test-name-pattern="HEB-05 :|HEB-06 :|checkDist" tests/dist/site.test.ts`: 27/27 (4 new domaine.cas cases).
- `node --test tests/repo/hote-en-dur.test.ts`: 21/21 (8 positive and 8 negative injections, line numbers, exclusions and boundaries, binary, escaping, real scan).
- `node --test --test-name-pattern="liens : original|signalement" tests/dist/site.test.ts`: 6/6.
- Acceptance greps: the new codes appear 12 times in check-dist.ts (at least 5 required); `domaine-a-definir` appears 0 times in check-dist.test.ts; the `git grep -n "domaine-a-definir" -- . ':!config/site.yml' ':!.planning' ':!docs' ':!archives' ':!tests/fixtures'` command prints nothing.
- **Full `npm test`: 1786/1786** (1748 before, +38). **With `RTP_DEPLOIEMENT=1` exported: 1786/1786.**
- `npm run check`: 0 errors, 0 warnings, 0 hints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test design] Synthetic dists default to `exemple.test`, and only CLI cases use the repo domain**
- **Found during:** Task 1
- **Issue:** The plan says `distPropre()` should use `DOMAINE = loadSiteConfig(REPO).domaine`. The repo domain is `.invalid`, so every direct `checkDist` call without `domaine` would then get a per-page DOMAINE_PROVISOIRE (the "dist built earlier" rule in the plan), and every exact `codes: []` assertion would break.
- **Fix:** `distPropre(…, { domaine })` defaults to `exemple.test`. `distCli()` passes `SITE.domaine` for every CLI case, and the DOMAINE_PROVISOIRE expectations stay conditional on `SITE.domaineProvisoire` as planned. The CLI also gets a case showing that a dist built for another domain fails (CANONIQUE_INCORRECT, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP), which proves the CLI passes the configured domain.
- **Commit:** 38f6fb7

**2. [Rule 2 - Stricter check] Invalid `opts.domaine` throws; the guard regex also refuses `<domaine>.<label>`**
- `checkDist` throws on `https://…`, `…:8443`, `…/x` or an empty domain instead of producing a wrong check.
- The host regex adds `|\.[a-z0-9-]` to the negative lookahead, so `exemple.test.fr` (another host) is not reported, while `exemple.test.` at the end of a sentence still is.
- **Commits:** 38f6fb7, ae42fe7

**3. [Rule 3 - Acceptance grep] A comment in hote-en-dur.test.ts named the provisional label**
- The acceptance `git grep` counts comments, so I reworded it.
- **Commit:** ae42fe7

**4. [Deferred item, in scope by instruction] loadHebergeurConfig was a second instance of the same problem**
- The 07-04 note named only the site config. Once the site config was fixed, an `RTP_DEPLOIEMENT=1` run also failed on `loadHebergeurConfig(ctx.repoRoot)` (institutionnel.cas « mentions légales », and the same call in methode.cas). Both calls now pass `{}`.
- **Commit:** f485612

No CLAUDE.md-driven adjustment. No new dependency and no npm script. Nothing under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was touched. Nothing was pushed. STATE.md and ROADMAP.md were not updated (orchestrator instruction). The RUNBOOK code table and the ADR text for the new codes belong to 07-08.

## Deferred Issues

- Logged in deferred-items.md, not fixed and with no current impact: `loadSiteConfig` returns its memoized value before evaluating the deployment guard. Each real consumer reads the config once per process, so no guard is bypassed today.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint or output: the plan only adds controls (T-07-21 to T-07-24 mitigated as registered).

## Next Phase Readiness

- 07-07: `deploy/caddy/site.caddy` is already excluded from the host guard, which expects the Caddy drift test to cover it. `loadSiteConfig(REPO, {}).domaine` is the value to render.
- 07-08: the RUNBOOK code table needs CANONIQUE_ABSENT, CANONIQUE_INCORRECT, SITEMAP_INCOHERENT, ROBOTS_SANS_SITEMAP and DOMAINE_PROVISOIRE, plus PREVIEW_INDEXABLE's new triggers. The « changer de domaine » procedure can cite the hote-en-dur test.

## Self-Check: PASSED

- FOUND: tests/repo/hote-en-dur.test.ts, scripts/lib/check-dist.ts (DOMAINE_PROVISOIRE), scripts/check-dist.ts (loadSiteConfig)
- FOUND: commits 38f6fb7, ae42fe7, f485612
