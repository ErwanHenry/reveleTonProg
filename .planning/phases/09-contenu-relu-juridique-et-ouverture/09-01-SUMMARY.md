---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 01
subsystem: relecture, content-tooling, testing
tags: [relecture, yaml, node-offset-splice, cli, registry, jsonl, node-test]

# Dependency graph
requires:
  - phase: 03
    provides: pilote.relecture_ouverte flag and PILOTE_NON_BROUILLON (scripts/lib/pilote.ts)
  - phase: 02
    provides: loadAll, PARSE_OPTIONS, TO_JS_OPTIONS, readContained (src/lib/content-core/load.ts); statutRetenu, dansPerimetre (rules/equite.ts)
  - phase: 04
    provides: tests/helpers/corpus-m1.ts (materialiserCorpusM1)
provides:
  - pilote.relecture_ouverte true (never goes back to false)
  - scripts/lib/relecture/editer.ts (definirChamps, verifierSeulesCles, comparerLignes, ecrireAtomique, CLES_ECRIVIBLES, EditionRefusee, dateValide, relecteurValide)
  - scripts/lib/relecture/etat.ts (etatRelecture, chargerCorpus, analyserCible, nomCible, empreinteMesure/Statut/Case, RELECTEUR_DEFAUT, types Contexte and Commande)
  - scripts/lib/relecture/registre.ts (relecture/journal.jsonl, relecture/notes.jsonl, append-only, strict reading)
  - scripts/relecture.ts dispatcher with the command module contract (liste, marquer, note installed; servir, publier, retirer loaded when their module exists)
  - npm run relecture
affects: [09-05, 09-06, 09-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Review writes splice text at yaml node.range offsets, then a post-check compares toJS minus the named keys and bounds the line diff (LCS); no Document.toString on content"
    - "Command modules scripts/lib/relecture/commandes/<nom>.ts with default export (argv, ctx) => Promise<exit code>; the dispatcher only imports a module whose file exists"
    - "Review hashes and notes live in relecture/*.jsonl (append-only), never in src/content"

key-files:
  created:
    - scripts/relecture.ts
    - scripts/lib/relecture/editer.ts
    - scripts/lib/relecture/etat.ts
    - scripts/lib/relecture/registre.ts
    - scripts/lib/relecture/commandes/liste.ts
    - scripts/lib/relecture/commandes/marquer.ts
    - scripts/lib/relecture/commandes/note.ts
    - tests/helpers/corpus-relecture.ts
    - tests/relecture/editer.test.ts
    - tests/relecture/marquer.test.ts
    - tests/relecture/liste.test.ts
    - relecture/README.md
  modified:
    - data/couverture-themes.yaml
    - tests/corpus/couverture-themes.test.ts
    - package.json
    - tests/repo/scaffold.test.ts

key-decisions:
  - "Contexte and Commande types live in scripts/lib/relecture/etat.ts (no extra module); commands import them from there"
  - "marquer loads in production mode before and after the write (resolution, file errors, new-error comparison by code+file+message); the retained status is statutRetenu(statuts, 'preview')"
  - "marquer also refuses a status entry already publie (would be downgraded to relu), in addition to a measure already publie"
  - "A case is relu when verifie_par equals the reviewer (default RELECTEUR_DEFAUT, or liste --relecteur); measures and statuses are a_revoir when relu/publie without a matching journal hash"
  - "Note targets use mesure:<candidat>/<slug> (or bare <candidat>/<slug>), statut:<candidat>, case:<theme>/<candidat>; a note is closed by an appended resolue line"
  - "Invalid note text (empty, over 500 characters, control character) is a usage error (exit 2); an unknown target is exit 1"
  - "A file without a final newline keeps having none after an insertion"

patterns-established:
  - "Review editor: closed writable-key list, value regexes before any write, post-check, atomic rename under src/content only"

requirements-completed: [PUB-01]

# Metrics
duration: 30min
completed: 2026-11-10
---

# Phase 9 Plan 01: Ouverture de la relecture et outil de relecture en terminal Summary

**The review is open, and `npm run relecture` lists what remains per candidate and marks a measure, a declared status or a coverage case as reviewed. It writes only the review fields, by splicing text at YAML node offsets, and checks afterwards that nothing else changed.**

## Performance

- **Duration:** about 30 min (plus CI)
- **Completed:** 2026-11-10
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- `pilote.relecture_ouverte: true` (one-line hand edit, first commit of the phase). The pinned test now asserts `true` and says the value never goes back to false. `scripts/couverture-scan.ts` only reads `data/couverture-themes.yaml` and never rewrites it, so the scan cannot reset the flag and no guard test was needed.
- Offset editor: the in-memory proof passes on all 134 real measures (1 modified + 2 added lines; a second review gives 1 modified, 0 added), on the retained status of all 59 real candidates (1 + 2) and on all 111 real coverage cases (2 modified lines). `titre` and `redactions` are refused, and so are values that would need YAML quoting or change type (`true`, `Null`, `a: b`, `#`, trailing space, impossible dates). The editor keeps CRLF line ends.
- `liste --theme sante` on the real corpus prints 37 perimeter candidates and 121 targets: 47 measures, 37 statuses and 37 cases, `reste 121 sur 121`. This matches the plan.
- `marquer` refuses without writing when the target is unknown, the file is invalid, a note is open, the status is out of the perimeter (unless `--hors-perimetre`), the date is partial, or the measure or status is already `publie`. On a new validation error after the write, it restores the original bytes (tested with an injected loader).
- Registry: `relecture/journal.jsonl` stores a sha256 of the reviewed wording. `liste` shows `a_revoir` after a later change to `redactions.resume`, which is tested.

## Task Commits

1. **Task 1: open the review flag, then the offset editor**: `83021ca` (feat, flag), `d94656a` (feat, editor + tests), `08ba932` (refactor, path messages without JSON.stringify to satisfy the acceptance grep)
2. **Task 2: state, registry, commands liste/marquer/note**: `e5a75b7` (feat)

## Verification

- Task 1 verify: `node --test tests/relecture/editer.test.ts tests/corpus/couverture-themes.test.ts tests/corpus/fiches.test.ts tests/corpus/pilote.test.ts`: 35 pass, 0 fail. `grep -c 'relecture_ouverte: true'` = 1. The toString/stringify grep = 0.
- Task 2 verify: the relecture and scaffold tests pass, and `liste --theme sante --format json` gives reste == total == 121.
- `npm test`: 2326 tests, 2317 pass, 0 fail, 9 skipped. `npm run check`: 0 errors, 0 warnings, 0 hints. `npm run validate -- --mode production`: 391 files, 0 errors, 25 warnings (unchanged).
- `git status --porcelain src/content archives`: empty. Real content is byte-identical. The tests work on temporary copies (M1 corpus) or in memory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] marquer refuses a status entry already `publie`**
- **Found during:** Task 2
- **Issue:** the plan lists the refusal for a measure already `publie` only. Marking a `publie` status would downgrade it to `relu`.
- **Fix:** the same refusal applies to a status entry.
- **Files modified:** scripts/lib/relecture/commandes/marquer.ts
- **Commit:** e5a75b7

**2. [Rule 3 - Blocking] Acceptance grep counted `JSON.stringify` in error messages**
- **Found during:** Task 1 acceptance check (after the editor commit)
- **Fix:** a small `montrer(chemin)` helper builds the messages, so editer.ts has no `stringify(` call at all.
- **Commit:** 08ba932

No other deviation. The `Contexte`/`Commande` types sit in `etat.ts` (no extra module), which is within the plan's file list.

## Known Stubs

None. `servir`, `publier` and `retirer` are known names of the dispatcher that answer « commande pas encore installée » (exit 2) until 09-05 and 09-06 add their modules. This is intended by the command module contract.

## Threat Flags

None beyond the plan's threat model (T-09-01 to T-09-06 mitigated as planned: closed key list, offset splice, post-check, strict target regex resolved via loadAll, containment and symlink refusal in ecrireAtomique, value regexes, journal hashes, validation before and after with restore).

## Self-Check: PASSED

All 12 created files exist; commits 83021ca, d94656a, 08ba932, e5a75b7 exist.
