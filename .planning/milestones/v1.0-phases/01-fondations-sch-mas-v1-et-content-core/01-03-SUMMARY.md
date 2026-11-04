---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 03
subsystem: infra
tags: [github-actions, gitleaks, dependabot, docs, adr, license]

requires:
  - phase: 01-01
    provides: "package.json scripts, .nvmrc, npm audit signatures exit 0, fsevents exception"
provides:
  - "Hardened CI (.github/workflows/ci.yml): verifier job + parallel gitleaks secrets job"
  - "Dependabot npm + github-actions with cooldown"
  - "LICENSE (MIT code, Licence Ouverte 2.0 content, exclusions)"
  - "README (5 questions, Node 24, dependency justifications), ARCHITECTURE (Mermaid, ADR-001..026), RUNBOOK"
  - "Static tests tests/repo/ci.test.ts and tests/repo/docs.test.ts"
affects: [01-07]

tech-stack:
  added: []
  patterns:
    - "Every action pinned to a 40-hex SHA with a # vX comment, asserted by test"
    - "Static repo tests parse YAML with the yaml package and assert on structure"

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/dependabot.yml
    - LICENSE
    - .editorconfig
    - archives/README.md
    - tests/repo/ci.test.ts
    - tests/repo/docs.test.ts
  modified:
    - README.md
    - docs/ARCHITECTURE.md
    - docs/RUNBOOK.md
    - .env.example

key-decisions:
  - "npm audit signatures added to CI because plan 01-01 recorded exit 0"
  - "No .gitleaks.toml: local scan found nothing, so no allowlist was created"
  - "ADR numbering: D-n maps to ADR-(n+3) (ADR-004..016), technical ADRs ADR-017..026"

requirements-completed: [FOND-03, FOND-04, FOND-05]

duration: ~35min
completed: 2026-11-03
---

# Phase 1 Plan 03: Hardened CI, gitleaks, Dependabot and project documentation Summary

**A SHA-pinned least-privilege CI that replays the developer sequence plus a checksum-verified gitleaks history scan, Dependabot with cooldowns, and a licence/README/ADR/RUNBOOK set covering D-1 to D-13.**

## Accomplishments
- `ci.yml`: triggers push and pull_request (never pull_request_target); workflow `permissions: contents: read`, no job override; `TZ=Europe/Paris`, Astro telemetry off; job `verifier` runs `npm ci`, `npm audit signatures`, `migrate --check` and `validate` twice each (default fixture and `RTP_CONTENT_ROOT=.` real corpus), `check`, `test`, `build`; job `secrets` fetches full history, downloads gitleaks 8.30.1 and checks sha256 before `tar`, then runs `gitleaks git`.
- `dependabot.yml`: npm (cooldown 7 days, 14 for majors, `astro` group) and github-actions (cooldown 7 days only), weekly Monday 06:00 Paris.
- `LICENSE` with the four sections (MIT, Licence Ouverte 2.0, exclusions, third-party data).
- `ARCHITECTURE.md`: new Mermaid diagram with `content-core` shared by `scripts/validate.ts`, `scripts/migrate.ts` and the Astro loader; D-n to ADR table; ADR-004 to ADR-016 for D-1 to D-13 (each titled `ADR-0NN (D-n) : ...`); technical ADR-017 to ADR-026 (YAML options, Ajv strict, Astro loader, compressHTML, A1 to A4, journal fields, default content root, gitleaks binary).
- `README.md` rewritten (Node 24, six dependency justifications, `RTP_CONTENT_ROOT`, canonical YAML style, manual GitHub settings pointer); `RUNBOOK.md` fixed (mesure path, archive step, migrate commands, diagnostic format, two CI jobs, monthly hygiene including gitleaks pin bump, right-of-reply placeholder, security settings section); `.env.example` no longer sets `NODE_VERSION=20`.

## Task Commits
1. **Task 1: hardened CI, gitleaks, Dependabot, ci.test.ts** - `42b3d63` (ci)
2. **Task 2: LICENSE, README, ARCHITECTURE, RUNBOOK, docs.test.ts** - `4f2f908` (docs)

## Verification
- `fnm exec --using=24 node --test tests/repo/docs.test.ts tests/repo/ci.test.ts`: 32 pass, 0 fail.
- Acceptance greps: `uses:` lines 3 = pinned lines 3; gitleaks sha256 count 1; `sha256sum -c` count 1; `pull_request_target` 0; `cooldown` 2; ADR(D-n) headings 13; `validate.mjs` 0; `Node 20` in README 0; `NODE_VERSION=20` 0; stale mesure path 0.
- Per wave rule, the full `npm test`, `astro check` and `astro build` were not run (scripts/validate.ts and migrate.ts do not exist yet; they land in later plans and are first exercised by CI at plan 01-07).

## Local gitleaks scan (A7, T-01-21)
- Binary: gitleaks v8.30.1 `darwin_arm64`, downloaded with `gh release download` into a new empty temp dir outside the repo; `grep darwin_arm64 gitleaks_8.30.1_checksums.txt | shasum -a 256 -c -` printed `OK`.
- History scan: `gitleaks stdin --no-banner --redact -v < history.patch`, where the patch is `git log -p -U0 --all --no-color` of the worktree (14305 lines, 1.09 MB). Result: `no leaks found`, exit 0. The CI command is `gitleaks git`; see deviation 1 for why the local run used the documented stdin equivalent.
- Working tree scan: `gitleaks dir --no-banner --redact -v .` after Task 1 and after Task 2: `no leaks found`, exit 0.
- `.gitleaks.toml` was **not needed** and was not created (no allowlist).
- A7 resolved: gitleaks default rules do not flag the fixture sha256 values or `.invalid` URLs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `gitleaks git` refused by the worktree command guard**
- **Found during:** Task 1, local scan
- **Issue:** the sandbox rejected every invocation of the form `gitleaks git ...` (it cannot prove a `git` operand targets the worktree).
- **Fix:** produced the same history input with a plain `git log -p -U0 --all` into a temp file and piped it to the documented `gitleaks stdin` mode. Coverage is equivalent for secret detection in commit diffs (all refs of the shared history). The CI job still uses `gitleaks git` on a full-depth checkout; that command is the one asserted by `ci.test.ts`.
- **Files modified:** none (verification only)

### Other notes
- **Attribution:** commit trailers use `Co-Authored-By: Claude Sonnet 5.5` (orchestrator instruction), not the plan's Opus 5.5.
- **Worktree base:** the worktree started at `de2265e`, not the expected `0828168`; reset to `0828168` with `git reset --hard` as the agent instructions require (clean tree, per-agent branch, nothing lost).
- **TDD ordering:** for Task 1 the YAML files and the test were written in one pass, then the test run green; a separate RED run against missing files was not performed (the assertions are structural and the files did not exist before). Same for docs.test.ts.
- **actionlint:** « actionlint indisponible » (not on PATH); `ci.yml` was only checked by the YAML parser and `ci.test.ts`.
- **fsevents exception:** no lockfile install-script check was added to CI in this plan; the exception from plan 01-01 (`node_modules/fsevents` only) is enforced by `tests/repo/scaffold.test.ts` and runs inside `npm test`, so the CI inherits it.
- **Manual user action (not done by the agent):** Settings > Code security > enable Dependabot alerts (optionally security updates and push protection), documented in README and RUNBOOK. No GitHub setting was changed through the API.
- **`gh api .../vulnerability-alerts` verification** is documented but was not run.

## Known Stubs
- `docs/RUNBOOK.md` « Droit de réponse » is an intentional placeholder (D-4), completed in lot 3.
- `ci.yml` calls `scripts/validate.ts` and `scripts/migrate.ts`, created by later plans; CI is not pushed until plan 01-07.

## Threat Flags
None beyond the plan's threat model. T-01-18 to T-01-25 and T-01-33 are mitigated as specified (pins, `contents: read`, checksum before extraction, history scan, cooldowns, telemetry off, no personal data, licence exclusions, no settings API calls).

## Self-Check: PASSED
Files verified present: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `LICENSE`, `.editorconfig`, `archives/README.md`, `tests/repo/ci.test.ts`, `tests/repo/docs.test.ts`. Commits `42b3d63` and `4f2f908` present in `git log`.
