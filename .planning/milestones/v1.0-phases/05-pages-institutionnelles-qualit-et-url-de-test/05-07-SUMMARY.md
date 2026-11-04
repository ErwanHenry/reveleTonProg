---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 07
subsystem: audit
tags: [qual-06, audit, personas, pieges]
requires: [05-03, 05-06]
requirements-completed: [QUAL-06]
provides: [audit/journal.jsonl, completed docs/AUDIT-TEST-CROISE.md, docs.test pin of the audit]
affects: [docs/AUDIT-TEST-CROISE.md, audit/journal.jsonl, src/pages/methode.astro, src/pages/qui-sommes-nous.astro, scripts/audit-lire.ts]
key-files:
  modified:
    - docs/AUDIT-TEST-CROISE.md
    - src/pages/methode.astro
    - src/pages/qui-sommes-nous.astro
    - scripts/audit-lire.ts
    - tests/scripts/audit-lire.test.ts
    - tests/repo/docs.test.ts
  created:
    - audit/journal.jsonl
decisions:
  - "Persona agents run by the orchestrator (an executor cannot spawn subagents): Sonnet 5.5 (claude-sonnet-5-5), one agent per persona for the first pass, one fresh agent per replayed message"
  - "Verdict: ready for the Lot 2 review (0 blocking KO, 7/7 traps), not ready for publication; the protocol's full success criterion (100 % blocking OK) is not met: 2 blocking tests are Partiel"
  - "Reader level labels aligned with the site selector (LIBELLES_NIVEAUX)"
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 5 Plan 07: Cross-persona audit Summary

The cross-persona test prepared in 05-03 ran on the final real-corpus preview: the seven §12 traps were replayed (7/7 rejected), the reading traps checked on the production fixture build, and three simulated readers (child, retiree, journalist) read the site through the journaled reader. 13 scenario messages graded: 11 OK (2 of them after a fix and a replay), 2 Partiel on blocking tests, 0 KO.

## Task Commits

1. Task 1: `5a5cc5f` docs(05-07): deterministic part of the cross-persona audit. Builds fingerprinted (commit b9b872b, reel preview `34504b3e…`, m1 production `09ec3e3a…`), `npm run e2e` green before the pass (222 + 1032).
2. Task 2: `53ac2cb` docs(05-07): cross-persona audit results. Grades with journal lines and quotes, findings S1 to S3, O1 to O4, I1 to I5, C1 to C6, corrections O1, I1, I2, I4 replayed with fresh agents.
3. Task 3: `031ba2a` test(05-07): pin the cross-persona audit journal.

## Cost

Six Sonnet agents (3 personas, 3 replays), about 615 000 subagent tokens in total.

## Deviations

- The plan's Task 2 verify uses `git log -2 -- src/content …`, which lists the last two commits touching those paths (Phase 3 content commits), not the last two commits. Checked instead with `git diff 5a5cc5f~1 HEAD -- src/content archives data/couverture-themes.yaml`: empty.
- Finding I3 (« Aîné » and accentless theme ids on Méthode) comes from `scripts/lib/couverture.ts`, outside this plan's files: recorded with a proposed change, not edited.

## Verification

- `node --test tests/pieges/pieges.test.ts`: 47/47.
- `npm test`: 1626 pass, 0 fail.
- `npm run e2e -- --jeu reel` after the fixes: 1032 passed; new reel fingerprint `0da3185f…`.
- Journal: 131 lines, the three personas present, exactly the 6 allowed keys (docs.test).

## Self-Check: PASSED
