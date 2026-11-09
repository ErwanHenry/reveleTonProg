---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 14
subsystem: perf, docs
tags: [perf-02, d-13, slow-4g, lighthouse, playwright-remote, methode]
requires:
  - phase: 08-04
    provides: remote 4G mode (preemptive Basic header, no-401 assertion, version.json same-commit check)
  - phase: 08-05
    provides: PROFILS_4G with both budgets at 1000 ms and the « Slow 4G simulé » label
  - phase: 08-12
    provides: essai.reveletonprog.fr in HTTPS behind the shared Caddy, zstd
  - phase: 08-13
    provides: GitHub deploy of commit 0949633 to essai
provides:
  - MESURE_SERVEUR_4G constant (date, page, gzip bytes, encoding, three measures per profile, Lighthouse medians, scope sentence, gap sentence)
  - Profil4G.nom (short name, prefix of the published libellé)
  - Méthode paragraph data-mesure-serveur rendered from the constant
  - README and RUNBOOK sentence with the same figures; RUNBOOK Lighthouse procedure
affects: [08-15, phase 9]
key-files:
  modified:
    - src/lib/profil-4g.ts
    - src/pages/methode.astro
    - tests/ui/constantes-publiques.test.ts
    - tests/dist/cas/methode.cas.ts
    - tests/repo/docs.test.ts
    - README.md
    - docs/RUNBOOK.md
key-decisions:
  - "The measured page is /methode/, the heaviest page of the served essai build (production mode, no theme page published yet); the published paragraph says so, and that the heavier theme pages in preparation stay measured on the local server"
  - "Lighthouse figures published as the median of three runs; the Speed Index outlier (1 671 ms on run 1) is kept in the RUNBOOK"
  - "Profil4G gains a nom field (prefix of libelle, tested) so the server-measure sentence names each profile without duplicating the label"
  - "Méthode REVISION bumped to 2026-11-09 (the page comment asks for it on each text change)"
requirements-completed: [PERF-02]
metrics:
  duration: about 35 min
  completed: 2026-11-09
---

# Phase 8 Plan 14: 4G measurement behind the real server Summary

**The heaviest page served by essai (`/methode/`, 11 917 bytes gzip, served in zstd by Caddy over HTTPS) loads cold in 723 ms at most on « Slow 4G simulé » and 345 ms at most at 150 ms latency, with no 401 in the measure and the same commit (0949633) before and after. Lighthouse 13.0.3 (simulated mobile Slow 4G, median of three runs) gives FCP 791 ms, LCP 791 ms and Speed Index 812 ms. Méthode, README and RUNBOOK now publish these figures, Méthode from the single constant `MESURE_SERVEUR_4G`.**

## Measures (2026-11-09, https://essai.reveletonprog.fr, commit served 0949633f5da5)

| Profile | Measures (cold, ms) | Worst | Budget |
|---|---|---|---|
| latence-150 (150 ms per request, 1,6 Mbit/s) | 345 / 300 / 304 | 345 | 1000 |
| « Slow 4G simulé » (562,5 ms per request, 1,44 Mbit/s) | 716 / 722 / 723 | 723 | 1000 |

- Page `/methode/`, 11 917 bytes gzip (e2e/poids.ts on the local dist), served `content-encoding: zstd` on all six loads.
- Served `/version.json` commit = local dist commit = `0949633f5da5a16c9eb45064a69aafce48e655bf`, before the run, in the spec, and after Lighthouse. The served `/methode/` HTML is byte-identical to the local build (SHA-256 `87cc38ae…`).
- No 401 in any measure (the spec asserts it; the run passed 4/4).
- Stop rule: not triggered (worst « Slow 4G simulé » 723 ms < 1000 ms), so no re-run was needed.

| Lighthouse 13.0.3 run | FCP | LCP | Speed Index | Score |
|---|---|---|---|---|
| 1 | 791 ms | 791 ms | 1 671 ms | 0,84 |
| 2 | 812 ms | 812 ms | 812 ms | 1 |
| 3 | 770 ms | 783 ms | 770 ms | 1 |
| **Median** | **791 ms** | **791 ms** | **812 ms** | |

Settings: `formFactor: mobile`, `throttlingMethod: simulate`, rtt 150 ms, 1 638,4 kbit/s, CPU x4. Document transferred: 13 125 bytes over h2, total byte weight 13 146 bytes. A `/favicon.ico` request answers 404 (see Deferred).

**Gap.** Lighthouse does not time the load. It replays an unthrottled trace through its Lantern model, charging 150 ms per network round trip (including DNS, TCP and the TLS handshake) and slowing the CPU 4 times, and FCP/LCP stop at paint, not at the end of `load`. The site's test adds 562,5 ms to each request at the CDP level, opens a real TLS connection to the server, does not slow the CPU, and stops at `loadEventEnd`. The figures are close (791 ms vs 723 ms) but not the same measurement.

**Phone figure (Task 3, optional):** non fourni.

## Task Commits

1. **Task 1: remote Playwright 4G run and manual Lighthouse**: no repo file (evidence in `/tmp/rtp-perf/mesures.json` and `/tmp/rtp-perf-rapport/`)
2. **Task 2: publication**: `14fb970` (test, RED: missing export, constants and docs suites failed), then `7b006a0` (docs, GREEN)
3. **Task 3: human-verify checkpoint**: not blocking per the orchestrator; phone figure recorded as « non fourni »

## Verification

- Task 1 verify: `jq -e '.profils | length == 2 and all(.[]; (.mesuresMs | length) == 3)' /tmp/rtp-perf/mesures.json` gave `true`.
- Task 2 verify: `node --test tests/ui/constantes-publiques.test.ts tests/repo/docs.test.ts` gave 63/63; `node --test --test-name-pattern="[Mm]éthode|methode|4G|4g" tests/dist/site.test.ts` gave 14/14.
- `grep -c MESURE_SERVEUR_4G src/pages/methode.astro` = 3.
- Full `TZ=Europe/Paris fnm exec --using=24 npm test`: 2218 tests, 2209 pass, 0 fail, 9 skipped (the shellcheck cases on the Mac).
- `fnm exec --using=24 npm run check`: 0 errors, 0 warnings, 0 hints.
- CI run 42710257129 on main (commit 7b006a0): Vérifier, Tests navigateur (Playwright, axe, 4G), Chercher des secrets (gitleaks) and Garde de gel all succeeded. The Déployer job waits for Erwan's approval (cible essai): https://github.com/ErwanHenry/reveleTonProg/actions/runs/42710257129. After approval, https://essai.reveletonprog.fr/methode/ shows the paragraph; the served commit becomes 7b006a0. The published measure stays dated and tied to commit 0949633; 7b006a0 only adds the paragraph to /methode/ (a few hundred bytes), and the local and CI 4G e2e keep enforcing the budget on every build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Own dist test compared a narrow no-break space with a normalised space**
- **Found during:** Task 2 GREEN
- **Issue:** `toLocaleString('fr-FR')` writes 11 917 with U+202F, while the case's `norm()` collapses page whitespace to a space.
- **Fix:** the expected numbers go through `norm()` as well.
- **Commit:** 7b006a0

**2. [Rule 1 - Bug] Own test comment held the essai host name**
- **Found during:** full `npm test` (tests/repo/hote-en-dur.test.ts)
- **Fix:** the comment says « l'hôte technique essai » instead.
- **Commit:** 7b006a0

**3. [Rule 3 - Blocking] Source check narrowed to the paragraph**
- **Issue:** the RED test refused the measure date anywhere in methode.astro, but the page's REVISION constant must move to the same date.
- **Fix:** the date and the Lighthouse version are looked for in the `<p data-mesure-serveur>` source only; the measured numbers are still refused in the whole file.
- **Commit:** 7b006a0

### Adjustments within scope

- Build from the main checkout instead of a git worktree at C: HEAD (51a1a78) differs from C (0949633) only by `.planning/…/08-13-SUMMARY.md`, which is not a build input. `GITHUB_SHA=C` was set, the commit check passed, and the served HTML is byte-identical to the local build.
- The heaviest page of the served build is `/methode/` (11 917 bytes gzip), not `/themes/sante/` (29 637 bytes, preview build). The essai deploy is a production build where no theme page is published yet. The publication states this (`perimetre` sentence), and the theme pages stay covered by the local e2e (about 740 ms on « Slow 4G simulé » in CI, 08-05).
- `curl` reads the credential from stdin (`curl -K -`) rather than `-u`, so the password never appears in argv. The RUNBOOK documents this form.
- The Lighthouse JSON report copies the header file into `configSettings.extraHeaders`; the field was deleted from the three reports kept in /tmp, and the RUNBOOK now warns about it.
- Added `perimetre` (scope sentence) and `Profil4G.nom` to the constants (not listed in the plan's behaviour); both are tested.

## Deferred

- `/favicon.ico` answers 404 on essai (seen in the Lighthouse network list). Browsers request it on every first visit; outside this plan's scope.

## Threat model

- T-08-70: commit checked before (curl), during (spec) and after (curl), plus an identical HTML hash.
- T-08-71: no budget changed; the constants test asserts every published measure is under its profile budget.
- T-08-72: password only in subshell env or stdin; header file 0600 in a 0700 mktemp folder, deleted (trap and explicit rm, verified absent); `extraHeaders` scrubbed from the Lighthouse reports; playwright-report and test-results are ignored by Git.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/lib/profil-4g.ts, src/pages/methode.astro, tests/ui/constantes-publiques.test.ts, tests/dist/cas/methode.cas.ts, tests/repo/docs.test.ts, README.md, docs/RUNBOOK.md, /tmp/rtp-perf/mesures.json
- FOUND commits: 14fb970, 7b006a0
