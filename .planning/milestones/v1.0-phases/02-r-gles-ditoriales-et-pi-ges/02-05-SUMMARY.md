---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 05
subsystem: content-core
tags: [sondages, rules-engine, validation-mode, ci-annotations, regle-09, regle-11]
requires:
  - phase: 02-r-gles-ditoriales-et-pi-ges
    provides: "02-02 rule engine, config.ts constants (SOMME_SONDAGE, DUEL, FENETRES_BLOCAGE, MODES), trap harness, CodeOverride.anchor"
provides:
  - "SONDAGE_NOTICE_ABSENTE from the schema (Ajv override, anchored on url_publication)"
  - "rules/sondages.ts: entry rule 'sondage' (SOMME_HORS_BORNES, TOUR2_EN_TOUR1, TOUR1_EN_TOUR2, CANDIDAT_DOUBLON, FENETRE_BLOCAGE) and fenetreDe()"
  - "4 section 12 poll trap fixtures replayed by the generic trap runner"
  - "resolveMode / ModeInvalideError (root.ts), shared by the validate CLI and the Astro loader"
  - "npm run validate -- --mode preview|production, RTP_MODE, summary line ends with ', mode <mode>'"
affects: [02-06, 02-07, phase-4]
tech-stack:
  added: []
  patterns:
    - "Percentages compared in integer hundredths (Math.round(pct * 100)) so 95 and 105 are exact"
    - "Legal windows as Date.UTC instants compared to Date.parse of offset-bearing ISO strings, never local-time Date constructors"
    - "Fail-closed mode resolution: flag > env > production, unknown value throws, '' means unset"
key-files:
  created:
    - src/lib/content-core/rules/sondages.ts (filled)
    - tests/rules/sondages.test.ts
    - tests/fixtures/pieges/SONDAGE_NOTICE_ABSENTE/attendu.json
    - tests/fixtures/pieges/SONDAGE_SOMME_HORS_BORNES/attendu.json
    - tests/fixtures/pieges/SONDAGE_TOUR2_EN_TOUR1/attendu.json
    - tests/fixtures/pieges/SONDAGE_FENETRE_BLOCAGE/attendu.json
  modified:
    - src/lib/content-core/ajv.ts
    - src/lib/content-core/root.ts
    - src/lib/content-core/astro-loader.ts
    - scripts/validate.ts
    - .env.example
    - tests/schemas/sondage.test.ts
    - tests/content-core/validate-cli.test.ts
    - tests/content-core/astro-parity.test.ts
key-decisions:
  - "A duel is detected by exactly DUEL.scores scores summing to at least DUEL.sommeMin (scores only, without autres_pct) or a hypothesis name matching DUEL.motif; only applied when tour is 1"
  - "resolveMode's error message names both --mode and RTP_MODE and truncates/sanitizes the offending value (control characters replaced)"
  - "The Astro loader logs 'racine de contenu : <root> (mode <mode>)', which makes the mode visible in build logs and observable in tests"
requirements-completed: [REGLE-09, REGLE-11]
duration: ~40min
completed: 2026-11-03
---

# Phase 2 Plan 05: Sondages pieges refuses, mode de validation explicite Summary

**The four section 12 poll traps (no notice, 112 % sum, second-round duel in round one, blocking-window date) are refused with file, line and code, using hundredth-based sums and TZ-proof Paris-time windows, and `--mode` / `RTP_MODE` now resolve fail-closed through one function shared by the validate CLI and the Astro loader.**

## Performance

- Duration: ~40 min
- Tasks: 3/3 (each TDD: RED then GREEN commits)
- Files: 6 created, 8 modified

## Task Commits

1. Task 1 RED: `cb36ca5` test(02-05): add failing poll traps and sondages rule tests (REGLE-09)
2. Task 1 GREEN: `f3abd14` feat(02-05): poll traps (REGLE-09)
3. Task 2 RED: `ec2e66e` test(02-05): add failing legal window tests and trap (REGLE-09)
4. Task 2 GREEN: `415d7c2` feat(02-05): legal blocking windows, TZ-proof (REGLE-09)
5. Task 3 RED: `27ae075` test(02-05): add failing mode resolution and CI annotation tests (REGLE-11)
6. Task 3 GREEN: `d64fc6a` feat(02-05): validation mode and CI annotation contract (REGLE-11)

## Accomplishments

- `url_notice` missing is a schema-level `SONDAGE_NOTICE_ABSENTE` (Ajv override), reported on the `url_publication` line (line 15 after the patch), so no rule bug can let a notice-less poll through.
- `sondage` entry rule: sums in hundredths (94.99 refused, 95 and 105 accepted, `24.6 + 31.2 + 44.2` accepted), duel in `tour: 1`, non-duel in `tour: 2`, duplicate candidat (reported at the second score), publication inside a legal window. Thresholds come only from `config.ts`.
- `fenetreDe(iso)`: same verdict under `TZ` = UTC, Europe/Paris, America/Los_Angeles, Pacific/Auckland, Asia/Tokyo (child-process test); window bounds cross-checked with `Intl.DateTimeFormat` (Saturday 00:00 to Sunday 20:00 Paris).
- `resolveMode(flag, env)`: flag > `RTP_MODE` > `production`; empty means unset; anything else throws `ModeInvalideError`. CLI exits 2 with usage; Astro build load rejects with a message naming `RTP_MODE`; dev logs and keeps previous data.
- Astro loader memo key now includes the mode; fingerprint and watcher also cover `<contentRoot>/ids.lock` and `<contentRoot>/archives/`.
- CI annotation contract verified on real trap roots (SOURCE_ABSENTE line 7, SONDAGE_NOTICE_ABSENTE line 15): text line `file:line:col CODE` and `::error file=...,line=...,col=...,title=CODE::`. `scripts/validate.ts` has no `::error` of its own (only `formatGithub`).

## Deviations from Plan

1. **SONDAGE_FENETRE_BLOCAGE trap committed in Task 2, not Task 1.** The plan lists the four trap directories under Task 1 but the window rule is Task 2's work. Committing that trap in Task 1 would have left the Task 1 verify (`pieges.test.ts`) red. The trap was staged with the Task 2 RED commit; nothing is missing at the end. Rule 3 (ordering), no behavior change.
2. **Mode logged in the loader's info line** (`... (mode preview)`): small addition, not in the plan, so the memo recompute is observable. No other output changed.
3. Worktree base: HEAD started at `640658f`; reset to the expected base `3d23fa5` as instructed by the worktree check (permitted reset at startup).

No auto-fixes of bugs, no missing config value, no auth gates.

## Verification

- `node --test tests/rules/*.test.ts tests/schemas/*.test.ts tests/pieges/pieges.test.ts tests/content-core/*.test.ts`: 375 pass, 0 fail.
- `node --test tests/content-core/validate-cli.test.ts tests/content-core/astro-parity.test.ts tests/content-core/load.test.ts tests/rules/sondages.test.ts tests/pieges/pieges.test.ts tests/repo/docs.test.ts`: 127 pass.
- `npm run validate -- --mode production --format github`: exit 0, 0 errors; `--mode nope` and `RTP_MODE=nope`: exit 2. `npm run check`: 0 errors, 0 warnings, 0 hints.
- Acceptance greps: `code: 'SONDAGE_NOTICE_ABSENTE'` 1, no literal 95/105/99 in `sondages.ts`, no `new Date(<digit>` in `sondages.ts`, one `export function fenetreDe`, `resolveMode(` present in both CLI and loader, `RTP_MODE` in `.env.example`, no `::error` in `scripts/validate.ts`.
- Not run (per instructions): full `npm test`, `astro build`.

## Notes for the orchestrator / merge

- Trap patches change only the property under test; the only entries of the corpus touched are `sondage-fictif-1.yaml` lines, so they should stay independent of 02-03 and 02-04.
- Files not edited, per plan: `rules/config.ts`, `rules/index.ts`, `rules/types.ts`, `load.ts`, `corpus-valide` fixture.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (orchestrator-owned).
- Plan 02-06 still has to pin `--mode production` in the CI workflow (T-02-21 remainder).

## Known Stubs

None.

## Threat Flags

None. T-02-21 to T-02-25 mitigations are implemented as planned (fail-closed resolver, annotation only through `formatGithub`, `Date.UTC` + `Date.parse` verified under 5 time zones, hundredth sums, notice enforced by the schema override). Mode values echoed in error messages are control-character sanitized and truncated.

## Self-Check: PASSED

- Files present: sondages.ts, sondages.test.ts, 4 trap `attendu.json`, root.ts, validate.ts, astro-loader.ts, .env.example.
- Commits present: cb36ca5, f3abd14, ec2e66e, 415d7c2, 27ae075, d64fc6a.
