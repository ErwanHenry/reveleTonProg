---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 07
subsystem: docs
tags: [docs, readme, runbook, architecture, adr, regle-10, regle-11]
requires:
  - phase: 02-r-gles-ditoriales-et-pi-ges
    provides: "CATALOGUE and HYPOTHESES (02-02), rules (02-03/04/05), validation mode (02-05); CI design of 02-06 taken from its PLAN"
provides:
  - "README: preview/production modes, RTP_MODE, ids.lock commands"
  - "RUNBOOK: codes table mirroring CATALOGUE (39 codes), ids.lock workflow, trap procedure, false positives, preview mode"
  - "ARCHITECTURE: rule tiers in the Mermaid diagram, ADR-027 to ADR-033 (incl. A1-A12)"
  - "tests/repo/docs.test.ts pins all of the above"
affects: [02-06]
tech-stack:
  added: []
  patterns:
    - "Docs test imports CATALOGUE and HYPOTHESES from rules/config.ts so a new code or hypothesis cannot ship undocumented"
key-files:
  created: []
  modified:
    - README.md
    - docs/RUNBOOK.md
    - docs/ARCHITECTURE.md
    - tests/repo/docs.test.ts
key-decisions:
  - "Seven Phase 2 ADRs (027-033) instead of the five minimum: tiers, mode, traps, syllables, ids.lock, verbatim chain, A1-A12"
  - "RUNBOOK heading uses an ASCII apostrophe (\"Faux positif d'une règle\") to match the plan wording literally"
requirements-completed: [REGLE-10, REGLE-11]
duration: ~25min
completed: 2026-11-03
---

# Phase 2 Plan 07: Documentation des règles, des modes et des pièges Summary

**A contributor or operator can act on any CI refusal from the docs alone: every validator code has a "que faire" row, the preview/production modes, the append-only ids.lock workflow (including the CI base-commit check) and the trap procedure are documented, and ARCHITECTURE records the three rule tiers and A1-A12 as ADRs, all pinned by docs tests.**

## Performance
- Duration: ~25 min
- Tasks: 2/2
- Files: 4 modified (no new file besides this SUMMARY)

## Task Commits
1. Task 1, README and RUNBOOK: `4612696`
2. Task 2, ARCHITECTURE: `6595524`

## Accomplishments
- README: section "Règles éditoriales, mode de validation et identifiants" (`npm run validate -- --mode preview`, `--mode production` forced by CI, `RTP_MODE`, `npm run ids -- --check` / `--write`); five-question headings, the FOND-01 line and the six dependency rows untouched.
- RUNBOOK: sections "Codes du validateur" (one row per `CATALOGUE` code: règle, gravité, que faire), "Verrouiller un identifiant de candidat", "Ajouter un piège" (`attendu.json` fields, exact-once `remplacer`, overlay files, negative variants), "Faux positif d'une règle" (issue, negative trap, reviewed change in `rules/config.ts`), "Mode preview" (local only, only equity downgraded). Commands list and CI step list updated.
- ARCHITECTURE: the Mermaid diagram shows the file, entry and corpus tiers feeding `Diagnostic`s, with `rules/config.ts` as shared config; components table extended; ADR-027 (tiers and Finding to Diagnostic, fail-closed `REGLE_ECHEC`), ADR-028 (mode), ADR-029 (traps as overlays, exact-set matching), ADR-030 (syllables calibrated on Lexique 3.83, not textstat), ADR-031 (ids.lock append-only, script plus CI base comparison), ADR-032 (figures, quotes and archive containment), ADR-033 (A1 to A12 with default and risk, pointing to `HYPOTHESES`). No new heading contains `(D-`, so the one-ADR-per-D-n check still holds.
- docs.test.ts: README needles; RUNBOOK headings and "every CATALOGUE code appears backticked"; ARCHITECTURE tiers in the Mermaid block, ADR-027..031 headings, no `(D-` in them, and each of the 12 `HYPOTHESES` ids as `**An**`. 22 tests pass.

## CI design documented from the 02-06 PLAN (not its summary)
- Both `validate` steps (default root and `RTP_CONTENT_ROOT: "."`) run `npm run validate -- --mode production --format github`, pinned by `tests/repo/ci.test.ts`.
- A dedicated step runs `npm run ids -- --check --base <ids.lock du commit de base>`: base is `origin/${GITHUB_BASE_REF}` on pull requests and `github.event.before` on pushes, skipped on first introduction of the file; the verifier checkout uses `fetch-depth: 0`.
- If 02-06 changes any of this (step wording, base selection), RUNBOOK sections "Verrouiller un identifiant de candidat" and "Mode preview" and ADR-028 / ADR-031 need a matching touch-up at merge.

## Deviations from Plan
None - plan executed exactly as written. Two small latitudes: the docs tests for Task 2 were added together with the docs (not strictly RED first), and ADR count is seven rather than the minimum five.

## Verification
- `fnm exec --using=24 node --test tests/repo/docs.test.ts`: 22 pass, 0 fail.
- Acceptance greps: `npm run ids -- --write` in README.md and RUNBOOK.md, `SOURCE_ABSENTE` in RUNBOOK.md, 7 `### ADR-027..033` headings, none with `(D-`, `A12` present in ARCHITECTURE.md.
- Not run (per instructions): full gate, `npm test`, `npm run build`; no `npm ci` needed (config.ts has only type imports).

## Known Stubs
None.

## Threat Flags
None. No secret, token or personal address added (T-02-33); RUNBOOK "Faux positif d'une règle" requires a reviewed change to `rules/config.ts` plus a negative trap (T-02-34).

## Self-Check: PASSED
- Files present: README.md, docs/RUNBOOK.md, docs/ARCHITECTURE.md, tests/repo/docs.test.ts.
- Commits present: 4612696, 6595524.
- STATE.md, ROADMAP.md and REQUIREMENTS.md not touched, as instructed.
