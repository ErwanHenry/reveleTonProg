---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 01
subsystem: deploy, caddy, legal, testing
tags: [caddy, basic_auth, noindex, robots, access-log, ip-mask, drift-test, mentions-legales, node-test]

# Dependency graph
requires:
  - phase: 07-07
    provides: scripts/render-caddy.ts (renderCaddy, cspEnTete, CLI --check/--sortie), deploy/caddy/site.caddy and its drift test
  - phase: 07-06
    provides: host guard tests/repo/hote-en-dur.test.ts (EXCLUSIONS)
provides:
  - renderCaddyEssai(options) rendering the technical host essai.<domaine> (basic_auth with env hashes and dummy default, X-Robots-Tag noindex, robots.txt Disallow, same headers and masked log)
  - constants RACINE_ESSAI, JOURNAL_ESSAI, VARIABLES_HASH, HASH_FACTICE, FICHIER_SITES_D_ESSAI exported from scripts/render-caddy.ts
  - deploy/caddy/essai.caddy, committed and generated, drift-tested inside npm test
  - CLI node scripts/render-caddy.ts [--check] [--cible <site|essai>] [--sortie <fichier>] (default writes and checks both files, site then essai)
  - src/lib/journal-acces.ts, single source of the access log policy and phraseJournalAcces()
  - Mentions légales sentence in <li data-journal-acces>, active-host branch only
affects: [08-02, 08-03, 08-06, 08-08, 08-09, 08-12, 09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two generated deploy artefacts from one renderer: shared private line helpers (header block, log block) keep the policies identical, each output has its own drift test"
    - "Policy constants shown to the public live in src/lib (pure module), re-exported by the script that renders server config"

key-files:
  created:
    - deploy/caddy/essai.caddy
    - src/lib/journal-acces.ts
    - tests/ui/journal-acces.test.ts
  modified:
    - scripts/render-caddy.ts
    - deploy/caddy/site.caddy
    - tests/repo/caddy.test.ts
    - tests/repo/hote-en-dur.test.ts
    - src/pages/mentions-legales.astro
    - .gitattributes

key-decisions:
  - "HASH_FACTICE = '$2a$14$' + 'factice' padded with dots to 53 chars: valid bcrypt shape (Caddy parses it), produced by no computation, so no known password matches; built in TS so the source carries no 60-char literal"
  - "The rendered essai.caddy user lines end with '# gitleaks:allow' (Caddyfile comment at token start, ignored by Caddy) because gitleaks scans the full history: a flagged line could only be cleared by rewriting main"
  - "robots.txt is answered with a respond heredoc (<<TXT ... TXT 200) placed after basic_auth; the named matcher @protege (not path /robots.txt) keeps it reachable without a password"
  - "X-Robots-Tag sits in the header block, so it is also sent on the 401 answer of basic_auth"
  - "--sortie without --cible keeps targeting the production block (07-07 CLI contract unchanged); --check reports every stale file and exits 1 once"
  - "The Mentions légales sentence covers only the access log; the container stderr log stays out of the public text until the Phase 9 legal review (O4), noted in a code comment"

patterns-established:
  - "Generated Caddy blocks: one exported constant per server path, one drift test per committed file, hote-en-dur exclusion by exact path only"

requirements-completed: [HEB-01, HEB-08, HEB-09, HEB-14]

# Metrics
duration: 25min
completed: 2026-11-08
---

# Phase 8 Plan 01: Technical-host Caddy block and single access log policy Summary

**essai.<domaine> Caddy block rendered next to production: basic_auth on every path but /robots.txt with two env-fed bcrypt hashes that default to a dummy value, X-Robots-Tag noindex, robots.txt Disallow, identical headers and 14-day masked log; the log policy now has one source that also writes the Mentions légales sentence.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-08T18:40:00Z (approximate)
- **Completed:** 2026-11-08T19:05:00Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `renderCaddyEssai` (pure, same input checks as `renderCaddy`) renders `essai.<domaine>` only (no apex, no `www.`), root `/srv/reveletonprog/essai/current`, `encode zstd gzip`, `file_server`, the production header set plus `X-Robots-Tag "noindex, nofollow"`, `@protege not path /robots.txt` + `basic_auth @protege` with `essai {$RTP_ESSAI_HASH:<HASH_FACTICE>}` and `sonde {$RTP_SONDE_HASH:<HASH_FACTICE>}`, a heredoc `/robots.txt` (`User-agent: *`, `Disallow: /`, 200) and the same log block as production writing `/var/log/caddy/essai.log` (T-08-01, T-08-02, T-08-03).
- `renderCaddy` now builds its header and log blocks through the same two private helpers; its output is byte-identical to 07-07 apart from the two comment lines that said « à confirmer » (now: relative `current` link to `releases/<sha>/`, syntax accepted by Caddy 2.11.2).
- CLI: no option writes both files (site then essai), `--check` checks both and names each stale file, `--cible <site|essai>` selects one, unknown `--cible` exits 2; fail-closed `RTP_DEPLOIEMENT=1` rule kept for both (T-08-06).
- `src/lib/journal-acces.ts` holds `ROTATION_JOURNAL`, `TAILLE_JOURNAL`, `FICHIERS_TOURNES_GARDES`, `RETENTION_MAX_JOURS` (= files kept + 2), `MASQUE_IPV4`, `MASQUE_IPV6` and `phraseJournalAcces()`; render-caddy imports and re-exports them and renders `ip_mask` from them (T-08-05). The Mentions légales page shows the sentence in the active-host branch only; the current `prevu` build is unchanged.

## Task Commits

1. **Task 1: renderCaddyEssai, shared helpers, CLI for both files, drift tests** - `8027ea0` (feat; tests written first and seen failing, committed together with the implementation)
2. **Task 2: access log policy module and Mentions légales sentence** - `76cdca3` (test, RED) then `4380d23` (feat, GREEN)

## Files Created/Modified

- `scripts/render-caddy.ts` - `renderCaddyEssai`, essai constants, shared header/log helpers, `--cible`, imports and re-exports the log policy
- `deploy/caddy/essai.caddy` - generated technical-host block (new)
- `deploy/caddy/site.caddy` - regenerated, two comment lines changed
- `src/lib/journal-acces.ts` - access log policy constants and French sentence (new)
- `src/pages/mentions-legales.astro` - `<li data-journal-acces>{phraseJournalAcces()}</li>` in the non-prevu branch, comment on O4
- `tests/repo/caddy.test.ts` - « renderCaddyEssai » and « essai.caddy : dérive » suites, 5 new CLI cases, updated comment assertion
- `tests/repo/hote-en-dur.test.ts` - exact-path exclusion of `deploy/caddy/essai.caddy`
- `tests/ui/journal-acces.test.ts` - constants, re-export, sentence content, placement in the page (new)
- `.gitattributes` - `deploy/caddy/*.caddy`, `ops/*.sh`, `deploy/compose/*.yml`, `deploy/cron/*` forced to LF

## Verification

- `fnm exec --using=24 node scripts/render-caddy.ts --check`: both files à jour
- Task 1 verify (`caddy`, `hote-en-dur`, `scaffold`, `e2e-serveur` tests): 101/101 pass
- Task 2 verify (`journal-acces`, `caddy` tests + `--check` + `npm run check`): 60/60 pass, astro check 0 errors 0 warnings 0 hints
- Full `TZ=Europe/Paris npm test`: 1876/1876 pass
- CI run 42513078570 on main (commit 4380d23): success (Vérifier, Tests navigateur, gitleaks all green; gitleaks did not flag the dummy hash)
- Acceptance greps: `basic_auth @protege` = 1, `X-Robots-Tag` = 1, uncommented `RTP_ESSAI_HASH}` = 0 in essai.caddy; uncommented `basic_auth` = 0 in site.caddy; no diff in `package.json` or `.github/`; Task 2 left `deploy/caddy/` unchanged

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Contradiction in the plan] « No User-Agent anywhere in the essai block » vs robots.txt body**
- **Found during:** Task 1
- **Issue:** the behavior list asks for no `User-Agent` (case-insensitive) in the whole essai block, but also requires the robots.txt body line `User-agent: *`.
- **Fix:** the test checks the block with the robots heredoc body removed (and the log block itself); `Referer` is checked on the whole block. The intent (no request header recorded) is kept.
- **Files modified:** tests/repo/caddy.test.ts
- **Commit:** 8027ea0

**2. [Rule 3 - Blocking] Existing caddy.test.ts case pinned the old comment text**
- **Found during:** Task 1
- **Issue:** the case « le commentaire du bloc dit la borne exacte » asserted `Syntaxe (roll_at, filtres) à confirmer par « caddy validate »`, the very line the plan tells to update.
- **Fix:** the assertion now expects `acceptée par Caddy 2.11.2` and that no « à confirmer » remains; a new case pins the updated release-layout line.
- **Files modified:** tests/repo/caddy.test.ts
- **Commit:** 8027ea0

**3. [Preventive, per executor instructions] `gitleaks:allow` on the two rendered user lines**
- The secrets job scans the full history, so a flagged line could not be fixed by a later commit. The fake hash appears literally only in `deploy/caddy/essai.caddy` (the TS source builds it, the tests compare with the constant), so only those two lines carry `# gitleaks:allow`. No path allowlist.

### TDD note

Task 1 tests were written first and run red (import failure), but the test and implementation landed in one commit (`8027ea0`). Task 2 follows the RED (`76cdca3`) then GREEN (`4380d23`) sequence.

## Issues Encountered

- CI run 42468619806 (before this plan) failed on a transient 504 while downloading gitleaks; unrelated to this plan.

## Known Stubs

None. The Mentions légales sentence is wired to the constants and shows once the host is `actif` (Phase 9); the page `REVISION` date is unchanged because the visible `prevu` page does not change.

## Next Phase Readiness

- 08-03 can install `deploy/caddy/essai.caddy` as `sites.d/reveletonprog-essai.caddy` (`FICHIER_SITES_D_ESSAI`) and set `RTP_ESSAI_HASH` / `RTP_SONDE_HASH` with `${VAR:?}` in compose.
- 08-09 validates the real merged Caddyfile with the variables set and unset (dummy default path, heredoc respond and trailing comments included).
- Do not import essai.caddy while the domain ends in `.invalid` (Pitfall 13); 08-12 regenerates it with the real domain.

## Self-Check: PASSED

- FOUND: deploy/caddy/essai.caddy, src/lib/journal-acces.ts, tests/ui/journal-acces.test.ts
- FOUND commits: 8027ea0, 76cdca3, 4380d23
