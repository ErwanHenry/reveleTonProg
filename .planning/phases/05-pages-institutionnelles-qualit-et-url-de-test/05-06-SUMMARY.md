---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 06
subsystem: ci-docs
tags: [ci, playwright, artifact, runbook, adr]
requires: [05-03, 05-04, 05-05, 03-09]
provides: [site-preview artifact, e2e CI job, phase 5 docs and ADR-047..052]
affects: [.github/workflows/ci.yml, package.json, README.md, docs/RUNBOOK.md, docs/ARCHITECTURE.md]
key-files:
  modified:
    - .github/workflows/ci.yml
    - package.json
    - tests/repo/ci.test.ts
    - tests/repo/scaffold.test.ts
    - README.md
    - docs/RUNBOOK.md
    - docs/ARCHITECTURE.md
    - tests/repo/docs.test.ts
decisions:
  - "upload-artifact pinned at cf430e030ddbb5b0abf93d22962f4752f3646cd9 (v7.0.2), used twice (site-preview, playwright-report); no actions/cache"
  - "ADR-047 to ADR-052 added (highest before: ADR-046)"
metrics:
  tasks: 2
  completed: 2026-11-04
---

# Phase 5 Plan 06: CI e2e job, site-preview artifact and Phase 5 docs Summary

The `verifier` job now publishes the checked preview build as the `site-preview` artifact (the Lot 2 test URL), a separate `e2e` job runs the Playwright/axe/4G suite on every push and PR, and README, RUNBOOK and ARCHITECTURE document it, pinned by repo tests.

## Task Commits

1. Task 1: `e891ada` ci(05-06): e2e job and site-preview artifact (URL de test). Scripts `e2e` and `audit:lire`; ci.test (3 checkouts, 2 setup-node, artifact step, e2e job) and scaffold.test updated.
2. Task 2: `0c58ed1` docs(05-06): browser tests, test URL, right of reply and Phase 5 ADRs.

## Verification

- `node --test tests/repo/ci.test.ts tests/repo/scaffold.test.ts tests/repo/docs.test.ts`: green.
- Full gate: migrate --check, validate (production), ids --check, astro check (0 errors), `npm test` (1605 pass), build, check-dist (production), preview build + check-dist preview: all exit 0 (CONTACT_PROVISOIRE warnings are expected until Lot 3).
- `npm run e2e`: 1032 passed (m1 and reel OK) after Task 1 (about 5 min). Not re-run after Task 2, which touched only docs and a repo test.
- No existing `uses:` line changed; 2 upload-artifact lines; no new `secrets.` reference.

## Deviations from Plan

- [Rule 2] Removed "non rattaché à Alignd ni SpikeeLabs" from README (acceptance requires 0 occurrences in README, RUNBOOK, ARCHITECTURE).
- ADR-050 and ADR-052 describe decisions realized in sibling plans (05-07 / 05-08 scope: data-gap announcement, simulated cross test); wording is based on `scripts/audit-lire.ts` as present in the base and on the plan's titles, so reviewers should check them against those plans' final SUMMARYs.
- RUNBOOK "Build CI en échec" updated from two to three jobs (not in plan, consistent with the new job).

## Known Stubs

None. Right-of-reply section completed; the contact address stays the provisional `.invalid` value by design until Lot 3 (documented in the RUNBOOK).

## Open points

- Assumption A4 (`upload-artifact` under `permissions: contents: read`) is unverified until the first CI run on GitHub; CI is the authority.
- Not pushed; no GitHub settings changed.

## Self-Check: PASSED
