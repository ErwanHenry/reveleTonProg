---
phase: 07-domaine-param-tr-inlining-et-dette
plan: 07
subsystem: deploy, csp, config, testing
tags: [caddy, csp, frame-ancestors, access-log, ip-mask, drift-test, node-test]

# Dependency graph
requires:
  - phase: 07-01
    provides: scriptsEnLigne(root) / empreinteCsp (script hashes from src/scripts/*.js)
  - phase: 07-04
    provides: loadSiteConfig(root, env).domaine with the RTP_DEPLOIEMENT guard
  - phase: 07-06
    provides: host guard that excludes deploy/caddy/site.caddy (covered by this drift test)
provides:
  - scripts/render-caddy.ts with pure renderCaddy(options) and constants RACINE_SERVEUR, JOURNAL
  - CLI node scripts/render-caddy.ts [--check] [--sortie <fichier>] (exit 0/1/2, fail-closed under RTP_DEPLOIEMENT=1)
  - deploy/caddy/site.caddy, committed and generated (site block + www redirect)
  - tests/repo/caddy.test.ts (policy, drift, CLI)
  - estDomaineValide exported from src/lib/site-config.ts
affects: [07-08, 08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated deploy artefact = pure render function + committed output + drift test inside npm test + CLI --check"
    - "Module with exports and a CLI: main() guarded by path.resolve(process.argv[1]) === fileURLToPath(import.meta.url), like tests/helpers/corpus-m1.ts"

key-files:
  created:
    - scripts/render-caddy.ts
    - deploy/caddy/site.caddy
    - tests/repo/caddy.test.ts
  modified:
    - src/lib/site-config.ts
    - .gitattributes

key-decisions:
  - "The rendered paths are paths inside the Caddy container (Phase 6: caddy:2-alpine, bind-mounted Caddyfile with about 15 site blocks and no import): root /srv/reveletonprog/current under a read-only mount of /srv/reveletonprog, access log /var/log/caddy/reveletonprog.log under a writable host folder mounted on /var/log/caddy. Both mounts are Phase 8 work"
  - "Header CSP = script-src with the two source hashes + frame-ancestors 'none', base-uri 'none', form-action 'none', object-src 'none'; no default-src, no style-src, no unsafe-"
  - "Access log: roll_keep 14, roll_keep_for 336h, roll_size 10MiB; remote_ip and client_ip ip_mask 24 48; request>headers and request>tls deleted; wrap json"
  - "renderCaddy reuses the host rule of config/site.yml (estDomaineValide) and refuses empty, malformed or duplicate hashes, and non-absolute or Caddyfile-breaking paths"
  - "The CLI reads config/site.yml with the process env: under RTP_DEPLOIEMENT=1 a provisional domain refuses to render (exit 2), nothing is written"
  - "No npm script and no CI step added: the drift test runs inside npm test"

patterns-established:
  - "A generated file that is compared byte for byte gets a `text eol=lf` line in .gitattributes"

requirements-completed: [HEB-05, PERF-01]

# Metrics
duration: 6min
completed: 2026-11-07
---

# Phase 7 Plan 07: generated Caddy site block Summary

**`deploy/caddy/site.caddy` is now rendered by a pure function from the domain in `config/site.yml` and the hashes of `src/scripts/*.js`. The block sets a header CSP that covers the order script from the first byte: `script-src` with exactly the two hashes, plus `frame-ancestors 'none'`, and no `default-src`. It also keeps an access log for 14 days, with IPs masked to /24 and /48 and request headers removed. A drift test in `npm test` fails as soon as the committed file differs from a fresh render.**

HEB-05: with this plan, the Caddy item is done (« … et le bloc Caddy généré »), so every HEB-05 item is now covered (07-04, 07-06, 07-07). PERF-01: this adds the server-side half of the hash CSP, which the page meta cannot provide (07-RESEARCH Pitfall 1). It takes effect once Phase 8 applies the block.

## Performance

- **Duration:** about 6 min
- **Started:** 2026-11-07T02:30 (local)
- **Completed:** 2026-11-07T02:36 (local)
- **Tasks:** 2/2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **Renderer.** `renderCaddy({ domaine, empreintesScripts, racine, journal })` takes no file-system input and returns the same string for the same input. It indents with tabs, ends with a newline and leaves no trailing blanks. Output: a first comment line saying the file is generated from config/site.yml and must not be edited by hand, the `{domaine}` block (`root`, `encode zstd gzip`, `file_server`, `header { … }`, `log { … }`), and `www.{domaine} { redir https://{domaine}{uri} permanent }`. There is no `/_astro/` matcher, since the inlining left no separate files.
- **Rendered French comments** cover four points: why the header has no `default-src` (both policies apply together, so the hashed `<style>` would be blocked), why the header covers the order script placed before the meta, why `frame-ancestors` only works in a header, and the Phase 8 values (raise HSTS after the first week, release layout `releases/<sha>/` + `current`, `caddy validate`). The words User-Agent and Referer appear nowhere ("en-têtes de requête supprimés"), and `Content-Security-Policy` appears only once, on the header line.
- **CLI.** `node scripts/render-caddy.ts` writes `deploy/caddy/site.caddy` and creates the folder if needed. `--check` writes nothing and exits 1 with « … lancer node scripts/render-caddy.ts » when the file is missing or different. `--sortie <fichier>` changes the target. An unknown option, a positional argument or an invalid config exits 2 with the usage text. With `RTP_DEPLOIEMENT=1` and a provisional domain it also exits 2 and writes nothing (fail-closed).
- **Generated block** committed for the current provisional domain. Its hashes are `sha256-AYs4…avM=` and `sha256-jsoh…i18=`, the same ones Astro puts in the meta. If either script changes without a re-render, npm test fails.

## Deployment assumption (Phase 6 fact, to confirm in Phase 8)

The VPS runs Caddy in a Docker container (`caddy:2-alpine`). Its Caddyfile is one bind-mounted file with about 15 site blocks and no `import`, and no static-site folder is mounted yet (06-RAPPORT-VPS.md). The block is written for that setup:

- `root * /srv/reveletonprog/current`: this is a path **inside the container**. Phase 8 adds a read-only bind mount of the host's release folder onto `/srv/reveletonprog`, which means recreating the container once.
- `output file /var/log/caddy/reveletonprog.log`: also inside the container. Phase 8 must mount a **writable** host folder onto `/var/log/caddy`, or the 14-day log would be lost when the container is recreated. If Phase 8 prefers another mounted path, change the `JOURNAL` constant and re-render. The drift test follows the change.
- The block can be pasted into the mounted Caddyfile, or imported once an `import` line is added. `caddy validate` (through `docker exec`) remains a Phase 8 manual item, together with assumptions A2 (`request>headers delete` path form) and A5 (`ip_mask 24 48`) and the support of `request>client_ip` by the image's Caddy version.
- While the domain is `.invalid`, the block is not meant to be applied: the build and this CLI both refuse it under `RTP_DEPLOIEMENT=1`.

## Task Commits

1. **Task 1: pure renderer with policy tests**: `4938f42` (test, RED: module missing), then `7f71a53` (feat)
2. **Task 2: CLI, generated block and drift test**: `0188cb7` (test, RED: 8 of 9 new cases failing; `--check` exited 0 because the module had no CLI yet), then `8a57b79` (feat)

## Verification

- `node --test tests/repo/caddy.test.ts`: 25/25 (16 policy and input cases, 3 drift cases, 6 CLI cases).
- `node scripts/render-caddy.ts --check`: exit 0, « deploy/caddy/site.caddy à jour ».
- `node --test tests/repo/caddy.test.ts tests/repo/scaffold.test.ts tests/repo/ci.test.ts tests/repo/hote-en-dur.test.ts`: 84/84. The host guard is still green with the new files: the renderer and the test only read the domain, and the block is excluded.
- Same caddy and host-guard tests with `RTP_DEPLOIEMENT=1` exported: 46/46.
- Acceptance greps: `export function renderCaddy` 1; `Content-Security-Policy` in the block 1; `default-src` in non-comment lines 0; `git diff --stat -- package.json .github/` empty.
- **Full `npm test`: 1811/1811** (1786 before, +25).
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- No server, Docker or `caddy` command was run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Single source] The host rule is shared with config/site.yml**
- **Found during:** Task 1
- **Issue:** `renderCaddy` must refuse an invalid domain. A second copy of the hostname regex could drift from the one `loadSiteConfig` uses.
- **Fix:** `estDomaineValide(domaine)` is exported from `src/lib/site-config.ts` and used by both. `loadSiteConfig` behaves the same (site-config tests 32/32).
- **Files modified:** src/lib/site-config.ts
- **Commit:** 7f71a53

**2. [Rule 2 - Robustness] Paths and duplicate hashes are validated**
- **Found during:** Task 1
- **Issue:** `racine` and `journal` are inserted verbatim into the Caddyfile. A blank, quote or brace would change how Caddy parses the block, and a duplicated hash would hide a missing script.
- **Fix:** both paths must match `^/[A-Za-z0-9._/-]+$`, and duplicate hashes are refused. Both rules are tested.
- **Commit:** 7f71a53

**3. [Rule 2 - Drift safety] `deploy/caddy/site.caddy text eol=lf` in .gitattributes**
- **Found during:** Task 2
- **Issue:** the drift test compares bytes, so a CRLF checkout would fail it with no real drift. src/scripts/*.js already gets the same treatment (Pitfall 6).
- **Fix:** one `.gitattributes` line, with a comment.
- **Commit:** 8a57b79

**4. [Convention] Test-side config reads use `{}` as env**
- The plan's drift formula reads `loadSiteConfig(REPO).domaine`. The test reads `loadSiteConfig(REPO, {})` instead, following the 07-06 convention, so an exported `RTP_DEPLOIEMENT=1` does not break npm test. CLI spawns delete `RTP_DEPLOIEMENT` from the inherited env, and only the fail-closed case sets it.

## Known Stubs

None. The block is rendered for the provisional `.invalid` domain on purpose: changing `config/site.yml` and running `node scripts/render-caddy.ts` re-renders it, and deployment refuses `.invalid`.

## Threat Flags

None. The file is a tested output that no server applies in this phase. T-07-25 to T-07-29 are mitigated as planned.

## Self-Check: PASSED

- FOUND: scripts/render-caddy.ts, deploy/caddy/site.caddy, tests/repo/caddy.test.ts
- FOUND commits: 4938f42, 7f71a53, 0188cb7, 8a57b79
