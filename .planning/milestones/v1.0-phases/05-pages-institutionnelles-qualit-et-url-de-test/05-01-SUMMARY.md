---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 01
subsystem: testing
tags: [playwright, axe-core, wcag, e2e, accessibility]
requires: []
provides:
  - "Harness e2e Chromium (gzip server, page discovery, sequential runner) reusable by 05-05 and 05-06"
  - "QUAL-02 specs: sans JS, clavier, axe WCAG 2.2 AA"
affects: [05-05, 05-06]
tech-stack:
  added: ["@playwright/test ^1.64.1 (dev)", "@axe-core/playwright ^4.14.0 (dev)"]
  patterns: ["specs in e2e/ outside tests/**/*.test.ts glob", "page list derived from E2E_DIST"]
key-files:
  created: [e2e/serveur.ts, e2e/pages.ts, e2e/sans-js.spec.ts, e2e/clavier.spec.ts, e2e/axe.spec.ts, playwright.config.ts, scripts/e2e.ts, tests/scripts/e2e-serveur.test.ts]
  modified: [package.json, package-lock.json, tests/repo/scaffold.test.ts, tsconfig.json, .gitignore]
key-decisions:
  - "Provenance checks automated instead of human checkpoint (orchestrator decision)"
  - "Pages with the selector but no measures only get a radio-toggle check in the sans-JS spec"
requirements-completed: [QUAL-02]
duration: ~25min
completed: 2026-11-03
---

# Phase 5 Plan 01: Browser harness and QUAL-02 specs Summary

Playwright + axe harness with a zero-dependency gzip server and one sequential runner (`node scripts/e2e.ts`); sans-JS, keyboard and axe WCAG 2.2 AA specs are green on the corpus-m1 fixture (production) and on the real corpus (preview).

## Provenance checks (Task 1)
- `npm view` repository URLs: `@playwright/test` and `playwright`/`playwright-core` -> github.com/microsoft/playwright; `@axe-core/playwright` -> github.com/dequelabs/axe-core-npm; `axe-core` -> github.com/dequelabs/axe-core.
- None of the 5 packages declares `preinstall`, `install` or `postinstall`. `@axe-core/playwright` declares `prepare` (pnpm, build), which npm runs only for git/local installs, not registry installs; `.npmrc` `ignore-scripts=true` stays on.
- `npm audit signatures` exit 0 (99 verified attestations); `npm audit`: 0 vulnerabilities. Lockfile install-script gate in scaffold.test unchanged and green.
- `npx playwright install chromium` done; `playwright --version` 1.64.1.

## Results
- fixture m1 (production): 71 tests passed, 21.9 s. Real corpus (preview): 435 tests passed, 2.3 min.
- `npm run check`: 0 errors (162 files). `npm test`: 1541/1541 pass, launches no browser, run after (not during) e2e.
- Server unit test: 8 cases (gzip, identity, traversal x3, 404, 400).

## Task Commits
1. Task 1 install/config: baaa4cc
2. Task 2 server, pages, config, runner (RED test seen failing first): 0e638c4
3. Task 3 specs: 34d0c78

## Deviations from Plan
**1. [Rule 1 - spec defect] Empty-state pages**: first m1 run failed 7 tests because pages carrying the selector but no `.redaction` (candidate pages without measures, home, a theme without published measures) were asserted to have redactions. Fix: on those pages only check the radios can be toggled; added a global test requiring at least one page with redactions. No site defect found; no site file modified.
**2. Plan numbers**: the "huit paquets" title kept as the plan asks (5 dev + 3 runtime).

## Known Stubs
None.

## Notes for downstream plans
- Phase 5 plan files are untracked in the main checkout and absent from this branch; they were read from the main checkout.
- No `npm run e2e` alias (05-06 owns the scripts block). Ports: m1 4173, reel 4174. Output dirs `dist-e2e/`, `playwright-report/`, `test-results/` are git-ignored.

## Self-Check: PASSED
Files and commits baaa4cc, 0e638c4, 34d0c78 exist on branch worktree-agent-a47512aa30bd73848.
