---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 04
subsystem: build, check-dist, e2e, docs
tags: [version-json, check-dist, heb-08-allowlist, playwright-remote, basic-auth-preemptive, slow-4g, node-test]

# Dependency graph
requires:
  - phase: 07
    provides: CSS and scripts inlined in the page (dist = html/txt/xml only), e2e/serveur.ts, PROFILS_4G, check-dist CLI and RUNBOOK code table
provides:
  - src/pages/version.json.ts (dist/version.json = { commit, date }, commit = GITHUB_SHA if 40 hex else dev)
  - check-dist codes VERSION_ABSENTE, VERSION_INVALIDE, TYPE_FICHIER_INATTENDU (library opt-in options `version` and `typesAutorises`, always on in the CLI)
  - exported COMMIT_VERSION regex in scripts/lib/check-dist.ts
  - e2e/serveur.ts serves .json as application/json, gzipped
  - playwright.config.ts remote switch E2E_BASE_URL / E2E_USER / E2E_PASS (preemptive Basic header, 4g project only, no webServer)
  - e2e/4g.spec.ts: project headers on every measuring context, 200 + no-401 assertions, gzip|zstd|br accepted and logged, remote version.json commit check
  - RUNBOOK: three new check-dist rows, « Slow 4G simulé » wording with the 1 s budget, « Mesure derrière le vrai serveur » paragraph
affects: [08-05, 08-06, 08-08, 08-12, 08-13, 08-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-level check-dist rules stay opt-in in the library (existing direct callers unchanged) and are always enabled by the CLI"
    - "Playwright config read in a child process per env by a repo test; the child prints only the encoded header and an equality flag, never the password"
    - "Remote-only tests are declared conditionally (not skipped) so the local test count stays identical"

key-files:
  created:
    - src/pages/version.json.ts
    - tests/dist/cas/version.cas.ts
    - tests/repo/playwright-config.test.ts
  modified:
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - tests/scripts/check-dist.test.ts
    - e2e/serveur.ts
    - tests/scripts/e2e-serveur.test.ts
    - playwright.config.ts
    - e2e/4g.spec.ts
    - docs/RUNBOOK.md

key-decisions:
  - "version.json is written in every build (production and preview), with a trailing newline; commit is GITHUB_SHA only when it is 40 lowercase hex, otherwise dev"
  - "VERSION_INVALIDE covers: invalid JSON, non-object, keys other than exactly commit and date, commit not 40 hex or dev, date not an ISO UTC timestamp (Z, optional ms, real calendar date), commit different from commitAttendu, dev under deploiement"
  - "CLI commitAttendu = GITHUB_SHA when it is 40 hex, else none (same rule as the endpoint), so build and check in the same CI job always agree"
  - "TYPE_FICHIER_INATTENDU flags any extension outside .html .txt .xml .json, files without extension included; this proves the HEB-08 long-cache clause is vacuous"
  - "E2E_BASE_URL must be an https origin only (no credentials, path, query or fragment); baseURL is normalised to the origin; E2E_USER and E2E_PASS go together; a colon in E2E_USER is refused; no error message repeats a credential or the URL"
  - "Remote mode without credentials is accepted (public host after Phase 9): no header, no httpCredentials"
  - "Local mode ignores E2E_USER and E2E_PASS (config identical to before)"

patterns-established:
  - "Same-build guarantee for remote measures: the served /version.json commit must equal the local E2E_DIST/version.json commit, which must be 40 hex (build with GITHUB_SHA=<commit servi>)"

requirements-completed: [HEB-07, HEB-08]
requirements-partial: [PERF-02]

# Metrics
duration: 26min
completed: 2026-11-08
---

# Phase 8 Plan 04: /version.json, check-dist version and file-type rules, remote 4G switch Summary

**Every build now writes `/version.json` (commit from GITHUB_SHA or `dev`, plus the build date). check-dist refuses a missing or wrong one, refuses `dev` under RTP_DEPLOIEMENT=1, and refuses any dist file other than html/txt/xml/json, which closes the HEB-08 long-cache clause. The 4G spec can also measure the protected essai host: a preemptive `Authorization: Basic` header means no 401 round trip is timed, and the served commit is checked against the commit of the local dist.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-11-08T20:26:37Z
- **Completed:** 2026-11-08T20:52:00Z
- **Tasks:** 2
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `src/pages/version.json.ts`: a static Astro endpoint that writes `{"commit":"…","date":"…"}\n` as `application/json; charset=utf-8`. A local build of the real corpus gives `{"commit":"dev","date":"2026-11-08T20:31:22.873Z"}`.
- `scripts/lib/check-dist.ts`: three codes appended to `CODES_CHECK_DIST`, plus two opt-in options with JSDoc (`version: { commitAttendu? }` and `typesAutorises`). The French messages name both commits on a mismatch. TYPE_FICHIER_INATTENDU explains that a separate file would need a long-cache rule in the Caddy block, which the block has not rendered since the Phase 7 inlining.
- `scripts/check-dist.ts` always passes `version` (with `commitAttendu` = GITHUB_SHA when it is 40 hex) and the four allowed extensions. The usage text documents both.
- `e2e/serveur.ts` adds `.json` to TYPES, so version.json is served as `application/json` and gzipped like the pages.
- `playwright.config.ts` gains a remote mode. It has no webServer, `baseURL` = the https origin, only the `4g` project, `use.extraHTTPHeaders.Authorization = Basic base64(user:pass)`, and `use.httpCredentials` as a fallback for the version.json request. Without E2E_BASE_URL the config is byte-for-byte the same in effect (pinned by the new test).
- `e2e/4g.spec.ts`: each measuring context is created with the project's `extraHTTPHeaders` (`{}` locally). A `response` listener checks that the first document answers 200 and that no response is a 401. The encoding must be gzip, zstd or br and is recorded in the attachment and on the console. In remote mode an extra first test compares the served `/version.json` commit with `<E2E_DIST>/version.json`.
- RUNBOOK: three check-dist rows. The e2e paragraph now names « Slow 4G simulé » with a 1 s budget. The dated Phase 7 note reads « (1 s et 1,5 s à l'époque, 1 s pour les deux depuis 08-05) ». A new paragraph « Mesure derrière le vrai serveur » covers the command (password read from `~/.config/rtp/sonde-pass` inside a subshell), why the header is sent preemptively, the same-commit check, the accepted encodings, and the manual Lighthouse run to be recorded with its gap in 08-14.

## Task Commits

1. **Task 1: /version.json endpoint and check-dist rules**: `ba6128b` (test, RED: 5 library and 3 CLI cases failing, existing CLI cases still green with the adapted fixtures), then `e363be9` (feat, GREEN)
2. **Task 2: test-server MIME, remote 4G mode, RUNBOOK e2e wording**: `719dc85` (test, RED: 10 remote config cases and the json case failing; the 2 local-mode cases pass, since they pin the existing behaviour), then `ba9fd00` (feat, GREEN)

## Files Created/Modified

- `src/pages/version.json.ts`: the endpoint
- `scripts/lib/check-dist.ts`: codes, options, `COMMIT_VERSION`, `ecartsVersion`, `estHorodatageUtc`, the two rules
- `scripts/check-dist.ts`: CLI wiring and usage text
- `tests/scripts/check-dist.test.ts`: library suite « version.json (HEB-07, D-12) et types de fichiers du dist (HEB-08) » (7 cases). The `pourCli()` fixture adapter and `COMMIT_CLI` are new. GITHUB_SHA is now cleared in the CLI child env. Three new CLI cases cover a GITHUB_SHA mismatch (and match, and a non-hex value ignored), a missing version.json, a dev commit under RTP_DEPLOIEMENT=1, and a `.woff2` file.
- `tests/dist/cas/version.cas.ts`: m1-production and m1-preview (exact keys, inherited commit, ISO date, no VERSION_* or TYPE_* finding, every file allowed), plus two extra builds: GITHUB_SHA = 40 × `a` is written and compared, and `abc1234` gives `dev`
- `e2e/serveur.ts`: `.json` MIME
- `tests/scripts/e2e-serveur.test.ts`: the version.json case (gzip and identity)
- `playwright.config.ts`: `modeDistant()` validation and the remote branch
- `tests/repo/playwright-config.test.ts`: 12 cases, local and remote, including 7 French refusals; each one asserts that the password never appears on stdout or stderr
- `e2e/4g.spec.ts`: headers, status assertions, relaxed encoding, remote version test
- `docs/RUNBOOK.md`: check-dist rows and e2e wording

## Verification

- Task 1 verify: `node --test tests/scripts/check-dist.test.ts tests/repo/docs.test.ts` gave 126/126, then `node --test tests/dist/site.test.ts` gave 166/166 in about 40 s (the two extra builds included).
- Task 1 acceptance: `RTP_CONTENT_ROOT=. npm run build -- --outDir dist-reel` wrote `dist-reel/version.json`. `npm run check-dist -- --dist dist-reel --mode production` exited 0 (0 errors, 5 existing warnings), and the RUNBOOK grep count was 3.
- Task 2 verify: `node --test tests/repo/playwright-config.test.ts tests/scripts/e2e-serveur.test.ts tests/repo/docs.test.ts` was green (96/96 with hote-en-dur). `npm run check` gave 0 errors, 0 warnings and 0 hints. `tsc --noEmit -p .` reported nothing on the touched files.
- Task 2 acceptance: `npm run e2e -- --jeu reel -- --project=4g` gave 3 passed (latence-150 about 310 ms, slow-4g-lighthouse about 740 ms, budget still 1500 ms until 08-05, served gzip). The « Slow 4G simulé » grep count was 1, and the count of « 1,5 s » lines without « à l'époque » was 0.
- Full `TZ=Europe/Paris fnm exec --using=24 npm test`: 2056 tests, 2052 pass, 0 fail, 4 skipped (the shellcheck cases on the Mac).
- Full `fnm exec --using=24 npm run e2e` (local mode, run alone): m1 259 passed, reel 1177 passed.
- CI run 42521457698 on main (commit ba9fd00) succeeded. The Vérifier, Tests navigateur and gitleaks jobs were all green. The Linux log shows 2056 tests (2055 pass, 1 skipped). check-dist ran on dist, dist-reel and dist-preview with GITHUB_SHA set, and the commit comparison passed: 0 errors on all three. e2e m1 gave 259 passed and reel 1177 passed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The CLI's always-on allowlist flagged the synthetic CLI fixtures**
- **Found during:** Task 1
- **Issue:** `distPropre()` links `/_astro/a.css` and `/_astro/n.js` and writes both files. Once the CLI always passes `typesAutorises`, every existing CLI case would get TYPE_FICHIER_INATTENDU and VERSION_ABSENTE. In CI, the inherited GITHUB_SHA would also have been enforced against the fixtures.
- **Fix:** a new `pourCli()` adapter, used by `distCli()` and by the HEB-05 case, removes the two links and the `_astro/` files and adds a valid version.json. Its commit is 40 hex rather than `dev`, so the HEB-06 case under RTP_DEPLOIEMENT=1 still counts exactly 1 error. The CLI child env now deletes GITHUB_SHA. No assertion was weakened. Touched CLI cases (all through the fixture): « dist propre », « HEB-05 », « HEB-06 », « dist fautif », « --format github », « --format github (IN-03) », « --mode invalide », « RTP_MODE=preview », « RTP_DEPLOIEMENT invalide (IN-06) ». The « dist introuvable » case is unchanged.
- **Commit:** ba6128b

**2. [Rule 1 - Bug] Own RED test re-added the version.json it meant to remove**
- **Found during:** Task 1 GREEN
- **Issue:** `distCli({ 'version.json': null })` deleted nothing, and `pourCli()` then added the file back.
- **Fix:** the case destructures the adapted dist to drop version.json.
- **Commit:** e363be9

### Adjustments within scope

- The spec reads the headers from the `extraHTTPHeaders` test fixture, not from `testInfo.project.use.extraHTTPHeaders`. Both resolve to the same project `use` value, and the fixture is typed.
- The RUNBOOK dated note uses « n'avaient pas changé » (past tense) with the parenthetical the plan specifies.

### Additions within scope (Rule 2)

- The config refuses credentials embedded in E2E_BASE_URL (they would end up in reports), refuses a path, query or fragment, and refuses a colon in E2E_USER. It normalises baseURL to the origin, so `${baseURL}${url}` never doubles a slash. No error message repeats a credential or the URL.
- The remote version test is declared only when E2E_BASE_URL is set, so the local 4g run still has exactly 3 tests. It also requires the local commit to be 40 hex, with a message that says to build with GITHUB_SHA.
- Remote mode without credentials (public host) is accepted.
- The measurement attachment now also records `baseURL` and the observed `encodages`. The header itself is never attached.
- An extra dist case shows that a short GITHUB_SHA (`abc1234`) gives `dev`. This costs one build of about 2 s.

## Issues Encountered

None.

## Known Stubs

None. The RUNBOOK states the 1 s budget for « Slow 4G simulé », but `src/lib/profil-4g.ts` keeps 1500 ms until 08-05 changes it. The plan expects this order (« the budget value itself lives in src/lib/profil-4g.ts (08-05): do not touch it here »).

## Next Phase Readiness

- 08-05: change `budgetMs` of `slow-4g-lighthouse` to 1000. The RUNBOOK wording already matches.
- 08-06 / 08-13: the deploy smoke test can compare `https://…/version.json` `.commit` with GITHUB_SHA. check-dist already refuses a mismatch and a `dev` commit under RTP_DEPLOIEMENT=1. The essai build (without RTP_DEPLOIEMENT) still gets its commit checked against GITHUB_SHA in CI.
- 08-14: build the measured dist with `GITHUB_SHA=<commit servi> RTP_CONTENT_ROOT=. npm run build -- --outDir dist-mesure`, then run the RUNBOOK subshell command. Expect `servi en zstd` (A2) in the console line.

## Self-Check: PASSED

- FOUND: src/pages/version.json.ts, tests/dist/cas/version.cas.ts, tests/repo/playwright-config.test.ts
- FOUND commits: ba6128b, e363be9, 719dc85, ba9fd00
