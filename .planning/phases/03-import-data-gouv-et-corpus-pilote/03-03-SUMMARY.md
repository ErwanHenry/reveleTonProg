---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 03
subsystem: tooling
tags: [couverture, pilote, scanner, node-test, yaml]
requires:
  - phase: 02
    provides: PERIMETRE_EQUITE, MARQUEUR_GLOSSAIRE, foldKey, slugGlossaire, loadAll, readContained
provides:
  - scripts/lib/couverture.ts (THEMES_SPEC, lireCouverture, classer, scanner, MOTS_CLES_DEFAUT)
  - scripts/couverture-scan.ts (CLI --candidat scan, --check-data ranking)
  - scripts/lib/pilote.ts (verifierPilote, HOTES_INTERDITS, SIGLES_ENFANT)
  - frozen research estimate fixture (37 x 10)
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, phase-05-methode]
tech-stack:
  added: []
  patterns: [pure lib + thin CLI, French messages, frozen-fixture tests]
key-files:
  created:
    - scripts/lib/couverture.ts
    - scripts/couverture-scan.ts
    - scripts/lib/pilote.ts
    - tests/couverture/classement.test.ts
    - tests/couverture/scan.test.ts
    - tests/couverture/pilote.test.ts
    - tests/fixtures/couverture/estimation-2026-11-03.yaml
  modified: []
key-decisions:
  - "Theme rule regle_themes: marge (Erwan): classer returns choix (margin rule) and top3Litteral side by side"
  - "--check-data fails (exit 1) when pilote.themes differs from the computed choix and no derogation is recorded"
  - "Case-level pilot checks (CASE_MANQUANTE, INCOHERENCE, ECART_MESURE) apply to delivered themes only; PLAFOND, CASE_DOUBLE, SOURCE_CONSULTEE, hosts and glossary marking apply to every pilot theme"
requirements-completed: [CONT-04, CONT-05, CONT-06]
duration: ~45min
completed: 2026-11-03
---

# Phase 3 Plan 03: Coverage ranking, scanner and pilot integrity checks Summary

**Executable theme-choice rule (margin of 2, Aîné priority) with the literal top 3 beside it, a per-candidate keyword scanner over archived extracts, and a pilot-corpus integrity checker (cap, completeness, hosts, glossary marking).**

## Tasks

| Task | Commit | What |
|------|--------|------|
| 1 | 4b9870f | `lireCouverture` strict shape (French messages), `classer`, frozen 37 x 10 estimate. The estimate gives institutions, impots, retraites (margin) and institutions, impots, ecole (literal); tallies equal RESEARCH. |
| 2 | 5e11cb5 | `scanner` + `MOTS_CLES_DEFAUT`; CLI `--candidat/--theme/--max` scan and `--check-data [--file]` ranking. Read-only. |
| 3 | 837b895 | `verifierPilote` with the 10 `PILOTE_*` codes, `HOTES_INTERDITS`, `SIGLES_ENFANT`. |

95 tests in `tests/couverture/*.test.ts` pass; `npm run check` reports 0 errors; `tsc --noEmit` shows nothing for the new files.

## Decisions Made

- **Margin rule as implemented:** sort by positions, forts, spec order; P4 = positions of the 4th; themes with positions >= P4 + 2 are secured (3 at most); each remaining slot picks, inside the band of themes within 2 positions of the best remainder, the Aîné theme first, then positions, forts, spec order. `explication` prints the rule and both lists.
- **Table contract extra:** `regle.marge_egalite` must equal `MARGE_EGALITE` (2), so a hand-edited margin cannot silently diverge from the code. `pilote.provisoires` must be theme ids.
- **Derogation guard (T-03-18):** `--check-data` exits 1 if `pilote.themes` (non-empty) is not the same set as the computed `choix` and `pilote.derogation` is null. Plan 03-05 must either set `themes` to the computed choix or record a derogation. This goes beyond the plan text; it is the mechanical form of "a human override needs a recorded derogation".
- **Scanner heuristics:** keywords are word prefixes on folded tokens, except keywords of 3 letters or fewer (ric, tva, csg, 49.3) which must be whole words. A commitment sentence is detected by: bullet line, infinitive at sentence start (with a small non-infinitive stoplist), nous/je + future ending within 4 tokens, or sera/seront/doit/doivent/devra/devront within the first 10 tokens. Engagement-looking hits get snippets first. Snippets strip control and bidi characters (terminal safety for third-party text).
- **Page numbers** come only from form feeds (`\f`), as in the plan; a literal "Page 3" in the text is not interpreted.
- **Pilot checks:** `ECART_MESURE` expectations: fort/partiel -> mesures, silence -> non_precise, aucun -> programme_non_publie; `inaccessible` sets no expectation. Glossary matching is whole-word on the exact `libelle` (no plural folding: "loyers" does not trigger "loyer"), as the plan's tests require.

## Deviations from Plan

None in scope. Two small additions inside the plan's files: the derogation guard above, and control-character stripping in snippets (Rule 2, T-03-17).

## Notes for downstream plans

- Call `fnm exec --using=24 node scripts/couverture-scan.ts --check-data --root .` (reads `<root>/data/couverture-themes.yaml`). Problems print on stdout with exit 1.
- `verifierPilote(entries, couverture)` takes `loadAll(...).entries` and the `data` returned by `lireCouverture`; 03-09 still has to wire it into a CLI or test over the real corpus.
- `scripts/lib/pilote.ts` imports `slugGlossaire` from `rules/references.ts` (which itself imports node:fs); pilote.ts has no direct `node:` import.
- No package.json change (03-09 adds the npm alias).

## Known Stubs

None.

## Threat Flags

None. The scanner never writes; the tools add no network access.

## Self-Check: PASSED

Files and commits 4b9870f, 5e11cb5, 837b895 verified present.
