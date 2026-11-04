---
phase: 02-r-gles-ditoriales-et-pi-ges
plan: 03
subsystem: content-core
tags: [rules, text-layer, neutrality, readability, kandel-moles, traps, regle-02, regle-03, regle-06]
requires:
  - phase: 02-r-gles-ditoriales-et-pi-ges
    provides: rule engine (Famille/EntryRule/Finding), config.ts word lists and bounds, trap harness (02-02); fixture with short enfant sentence (02-01)
provides:
  - "French text layer: cleanText, mergeDigitGroups, foldKey, sansMarqueurs (normalize.ts); words, countWords, quoteSpans, withoutQuotes, quotesBalanced (words.ts)"
  - "motsInterdits / verbesConnotes (forbidden.ts), sentences (sentences.ts), syllables / kandelMoles (syllables.ts)"
  - "famille 'redaction' with 4 entry rules: neutralite, longueurs, phrases_enfant, lisibilite_enfant; champsEditoriaux() exported"
  - "Section 12 trap MOT_INTERDIT and its false-positive guard MOT_INTERDIT--dans-citation-ok"
affects: [02-06, 02-07]
tech-stack:
  added: []
  patterns:
    - "One words() feeds both counting and forbidden-word matching, so elisions cannot slip between the two"
    - "Thresholds, lists and fields read only from config.ts (no numeric literal in the rule file)"
    - "Syllable heuristic frozen by a 161-word table derived from Lexique 3.83 plus documented known-wrong words"
key-files:
  created:
    - src/lib/content-core/rules/text/normalize.ts
    - src/lib/content-core/rules/text/words.ts
    - src/lib/content-core/rules/text/forbidden.ts
    - src/lib/content-core/rules/text/sentences.ts
    - src/lib/content-core/rules/text/syllables.ts
    - tests/text/words.test.ts
    - tests/text/forbidden.test.ts
    - tests/text/sentences.test.ts
    - tests/text/syllables.test.ts
    - tests/rules/redaction.test.ts
    - tests/fixtures/pieges/MOT_INTERDIT/attendu.json
    - tests/fixtures/pieges/MOT_INTERDIT--dans-citation-ok/attendu.json
    - tests/fixtures/pieges/MOT_INTERDIT--dans-citation-ok/archives/marie-fictive/23c5f1cc8eff.txt
  modified:
    - src/lib/content-core/rules/redaction.ts
key-decisions:
  - "relu is treated like publie for PHRASE_ENFANT_LONGUE (assumption A3, accepted by the orchestrator): this is stricter than the CONTEXT wording, which names only publie (error) and brouillon (warning). Only brouillon downgrades the finding to a warning."
  - "champsEditoriaux accepts Pick<LoadedEntry, 'collection' | 'data'> so the same function works on loadAll entries and engine entries; LoadedEntry stays assignable"
  - "GUILLEMETS_DESEQUILIBRES does not stop the other checks: an orphan guillemet leaves the rest of the text scanned, so a following forbidden word is still reported"
  - "Fixture enfant text measured at Kandel-Moles 82.64 with the real implementation (>= 82), so no fixture edit was needed"
requirements-completed: [REGLE-02, REGLE-03, REGLE-06]
duration: ~45min
completed: 2026-11-03
---

# Phase 2 Plan 03: Rédactions neutres, bornées et lisibles Summary

**A forbidden word (accents, elisions and zero-width tricks included) in any editorial field now fails with MOT_INTERDIT on its line, lengths are held to their bounds with the French word count, and long enfant sentences block published measures while Kandel-Moles only warns.**

## Performance
- Duration: ~45 min
- Tasks: 3/3
- Files: 13 created, 1 modified (the fixture was not touched)

## Task Commits
1. Task 1, text layer + neutrality (REGLE-02) + 2 traps: `af832d3`
2. Task 2, lengths per level (REGLE-03): `fb2ad62`
3. Task 3, enfant sentences + Kandel-Moles (REGLE-06): `f904e03`

## Accomplishments
- `MOT_INTERDIT` on `/titre`, `/redactions/*`, glossaire `/libelle` and `/definition`, journal `/resume`, themes `/nom` and `/sous_themes/*/nom`; one finding per distinct word per field; positioned on the key's line.
- Quote exemption only for balanced spans; an orphan « gives `GUILLEMETS_DESEQUILIBRES` and does not hide what follows. `texte_source`, `chiffrage.texte`, `source.titre` and candidat `parti` are never scanned.
- `VERBE_CONNOTE` warnings (accents significant: `a osé`, `assuré` not flagged); `CARACTERE_SUSPECT` on Cyrillic/Greek letters and bidi controls, checked on raw NFC text.
- `LONGUEUR_HORS_BORNES` (error for every status, A4) with count and bounds in the message. Fixture counts frozen exactly: résumé 22, détaillé 99, enfant 51, aîné 73.
- `PHRASE_ENFANT_LONGUE` (error for relu/publie, warning for brouillon) and `LISIBILITE_ENFANT_FAIBLE` (warning only, score with one decimal and a decimal comma).
- Fixture enfant text: 5 sentences of 8, 9, 11, 10, 13 words, Kandel-Moles 82.64.
- Both §12 traps replayed by the harness: `MOT_INTERDIT` (exactly one error on `/redactions/resume`) and `MOT_INTERDIT--dans-citation-ok` (`[]`). The overlay archive (sha256 `ddfceaa7…e250`) appends ` Nous voulons enfin des loyers justes.` on the rent line; `texte_source` and the détaillé quote stay consistent so plan 02-06's CITATION_HORS_SOURCE keeps the trap at `[]`.

## Deviations from Plan
None of Rules 1-4 beyond:
- The plan's contingency (edit the fixture enfant text if KM < 82) was not triggered, so `encadrement-loyers.yaml` is unchanged even though it is listed in `files_modified`.
- Test-only: ICU does not split a sentence before a lowercase letter, so boundary tests build sentences with a capital first letter (real contributor text starts sentences with a capital).
- `champsEditoriaux` parameter type loosened (see key-decisions) after `astro check` flagged tests passing `loadAll` entries.

No config constant was missing; `rules/config.ts`, `index.ts`, `types.ts` and `load.ts` were not edited.

## Verification
- `node --test tests/text/*.test.ts tests/rules/redaction.test.ts tests/pieges/pieges.test.ts tests/content-core/corpus-valide.test.ts tests/content-core/load.test.ts`: 351 pass, 0 fail.
- `npm run validate`: 0 erreur(s), 0 avertissement(s). `npm run check`: 0 errors, 0 warnings.
- Acceptance greps: no `node:` import in the pure text modules, `words(withoutQuotes` present in forbidden.ts, no 25/80/200/40/60/120 or 80/15 literal in redaction.ts, `Lexique` credited in syllables.test.ts, the `Cela concerne les villes de plus de 50 000 habitants.` sentence still byte-identical once.
- Not run (per instructions): full `npm test`, `astro build`.

## Known Stubs
None.

## Threat Flags
None. T-02-11 to T-02-14 mitigations are in place: balanced-quote exemption plus orphan detection (the per-span check against `texte_source` is owned by 02-06), invisible/elision/accent/homoglyph handling, linear regexes only, `citer()` truncation in every message.

## Self-Check: PASSED
- Files present: the 5 text modules, redaction.ts, 5 test files, the 2 trap directories (attendu.json plus overlay archive).
- Commits present: af832d3, fb2ad62, f904e03.
