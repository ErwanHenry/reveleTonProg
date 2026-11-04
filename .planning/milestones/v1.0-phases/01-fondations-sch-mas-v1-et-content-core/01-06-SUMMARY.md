---
phase: 01-fondations-sch-mas-v1-et-content-core
plan: 06
subsystem: content-core
tags: [json-schema, ajv, mesure, source, theme, archive, astro]

requires:
  - phase: 01-02
    provides: "content-core API, defs/common (archive, statutRelecture), validate-yaml test helper"
  - phase: 01-04
    provides: "Astro loader, corpus view-model, walking-skeleton page and dist test"
provides:
  - "schemas/mesure.schema.json (DATA-03): 4 redactions, enfant+aine required when publie, relecteur/date_relecture from relu"
  - "schemas/source.schema.json (DATA-04): primary types only (no presse), required archive block"
  - "schemas/theme.schema.json: sous_themes, statut_relecture"
  - "Fixture: theme logement, source marie-fictive-programme, measure marie-fictive/encadrement-loyers, hashed archive extract"
  - "View-model helpers getMesuresDe() and getSource(); skeleton page lists measures with dated source"
affects: [01-07, phase-02, phase-04]

tech-stack:
  added: []
  patterns:
    - "Schemas copied from RESEARCH Pattern 1, compiled under unmodified Ajv strict mode"
    - "Archive extract named <first 12 hex of sha256>.txt; sha256, name and verbatim quote checked by skeleton test case (d)"
    - "Fixture measure already written to satisfy the future Phase 2 editorial rules (word counts, verbatim quote, numbers present in texte_source)"

key-files:
  created:
    - schemas/mesure.schema.json
    - schemas/source.schema.json
    - schemas/theme.schema.json
    - tests/schemas/mesure.test.ts
    - tests/schemas/source.test.ts
    - tests/schemas/theme.test.ts
    - tests/fixtures/corpus-valide/src/content/themes/logement.yaml
    - tests/fixtures/corpus-valide/src/content/sources/marie-fictive-programme.yaml
    - tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml
    - tests/fixtures/corpus-valide/archives/marie-fictive/23c5f1cc8eff.txt
  modified:
    - src/lib/corpus/types.ts
    - src/lib/corpus/index.ts
    - src/pages/index.astro
    - tests/dist/skeleton.test.ts

key-decisions:
  - "Followed the orchestrator's commit trailer (Claude Sonnet 5.5) instead of the plan text's Opus 5.5"
  - "Ran the full npm test at the end as instructed by the orchestrator (the plan text deferred it to 01-07)"
  - "Fixture texte_source is a single line so it is a plain substring of the archive extract"

patterns-established:
  - "Schema tests start from one valid base document and mutate one field per case, asserting (code, pointer)"

requirements-completed: [DATA-01, DATA-03, DATA-04]

duration: ~25min
completed: 2026-11-03
---

# Phase 1 Plan 06: theme, source and mesure schemas Summary

**The measure -> source -> archive chain is now a contract: three strict v1 schemas (59 table-driven cases), a fictional published measure with a SHA-256-named archive extract, and a skeleton page that shows the measure with its dated source.**

## Accomplishments

- `mesure.schema.json`, `source.schema.json`, `theme.schema.json` compile under unmodified Ajv strict mode and follow the shared conventions (URN `$id`, `version_schema` const 1, `unevaluatedProperties: false` at every level, no field named `collection`).
- DATA-03: a `publie` measure without `enfant` or `aine` fails with `SCHEMA_REQUIRED` at `/redactions`; `relu`/`publie` without relecteur + date_relecture fails at the root; a `brouillon` with only resume + detaille passes.
- DATA-04: `type: presse` is `SCHEMA_ENUM` at `/type`; a source without `archive` fails; `archive.extrait` with `..`, absolute path or non-`.txt` extension is `SCHEMA_PATTERN` (threat T-01-08); `wayback_url` is optional and restricted to `web.archive.org`.
- Fixture archive extract `23c5f1cc8eff.txt` (sha256 `23c5f1cc8eff56b2...a7993e`); the source's `archive.sha256` equals its real hash and the measure's `texte_source` appears verbatim in it (skeleton test case d).
- Fixture measure redactions measured with a word counter: resume 23 words, detaille 100, enfant 50 (sentences of 8, 10, 11, 10, 11 words), aine 70; detaille contains one verbatim « ... » quotation; no forbidden word; every number in resume/enfant/aine (50 000) appears in texte_source.
- Skeleton page lists each candidate's measures (h3 titre, resume, "Source : titre, consultée le date"); still zero JS and no external src/href.

## Task Commits

1. Task 1: theme, source and mesure schemas with tests - `90f4cb8` (feat)
2. Task 2: fictional sourced measure rendered on the skeleton page - `d781818` (feat)

## Verification

- `node --test` on the three new schema test files: 59/59 pass
- `npm run validate`: 10 files, 0 errors
- `npm run check`: 0 errors, 0 warnings, 0 hints
- `npm run build`: OK; `dist/index.html` contains the source title once, `<script` count 0
- Full `npm test`: 226/226 pass (was 166 before this plan)

## Deviations from Plan

None - plan executed as written. Two instruction differences, both from the orchestrator and not auto-fixes: the commit trailer names Claude Sonnet 5.5 (the plan text says Opus 5.5), and the full `npm test` was run at the end of this plan rather than deferred to 01-07.

Test lookups of fixture entries do not rely on array position (the fixture has two candidates); the new page code groups measures by `candidat` id.

## Known Stubs

None. The page output is wired to real corpus data.

## Threat Flags

None. No new network endpoint, auth path or trust-boundary file access beyond the plan's threat model (T-01-08 to T-01-12 covered: path pattern, no `presse`, https-url + Wayback restriction, `.invalid` hosts, archives outside src/ and public/).

## Self-Check: PASSED

All created files exist; commits `90f4cb8` and `d781818` are in `git log`.
