---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 05
subsystem: relecture, content-tooling, security, testing
tags: [relecture, node-http, csrf, dns-rebinding, csp, loopback, node-test]

# Dependency graph
requires:
  - phase: 09-01
    provides: etatRelecture, chargerCorpus, analyserCible, nomCible, RE_SEGMENT, RELECTEUR_DEFAUT (etat.ts); marquer and aujourdhuiParis (commandes/marquer.ts); ajouterNote, texteNoteValide (registre.ts); dispatcher scripts/relecture.ts; tests/helpers/corpus-relecture.ts
  - phase: 02
    provides: loadAll diagnostics, readContained, fragments (verbatim.ts), cleanText and foldKey (normalize.ts)
provides:
  - scripts/lib/relecture/vue.ts (ficheCandidat, resume, fenetreExtrait)
  - scripts/lib/relecture/serveur.ts (creerServeurRelecture, creerGestionnaire, echapper, CSP_RELECTURE, CORPS_MAX)
  - scripts/lib/relecture/commandes/servir.ts (`npm run relecture -- servir [--theme <id>] [--port <n>]`, demarrer)
  - tests/repo/relecture-hors-site.test.ts (the tool never reaches the site)
affects: [09-06, 09-09, 09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local review server: node:http bound to 127.0.0.1, address checked after listen, exact Host (421), Origin and Sec-Fetch-Site (403), form content type only (415), 8 KiB body cap (413), per-launch token compared with timingSafeEqual (403), identifiers resolved in the loaded corpus (400)"
    - "Every page string goes through one echapper(); CSP default-src 'none' with inline style only; no script element"
    - "Quote location in an archive: per-character cleanText + foldKey squash keeping original offsets, so the window is cut from the original text"

key-files:
  created:
    - scripts/lib/relecture/vue.ts
    - scripts/lib/relecture/serveur.ts
    - scripts/lib/relecture/commandes/servir.ts
    - tests/relecture/vue.test.ts
    - tests/relecture/serveur.test.ts
    - tests/repo/relecture-hors-site.test.ts
  modified: []

key-decisions:
  - "A refused marquer (open note, validation error) answers 409 with the candidate page and the refusal messages, instead of a 303: the messages are free text and the 303 query string only carries the closed codes valide and note"
  - "POST /valider takes type mesure|statut|case and cible = <candidat>/<slug> for a measure, <candidat> for a status or a case (the case's theme is the served theme); POST /note takes the CLI target syntax (mesure:, statut:, case:<theme>/) and refuses a target outside the served theme"
  - "A GET for an unknown or out-of-perimeter candidate gives 404; a malformed candidate id gives 400"
  - "The sheet shows errors and warnings of production-mode diagnostics (the 09-01 liste shows warnings only), so a missing archive (ARCHIVE_ABSENTE, an error) appears on the page"
  - "The corpus is reloaded on every request (about 1 s on the real corpus), so the page always reflects the YAML on disk after a manual correction"

patterns-established:
  - "Review page modules live under scripts/lib/relecture/, are started by hand, and a repo test forbids any reference from src/ or astro.config.mjs"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-11-11
---

# Phase 9 Plan 05: Page de relecture locale Summary

**`npm run relecture -- servir` serves a review page on 127.0.0.1 only. Each candidate has one page with the four wordings next to the quoted source text, the archived extract around the quote, the source with dates and full sha256, the CI alerts, the declared status and the coverage case with its date contradictions. The « Valider » and « Note » forms call the same code as the terminal commands and are protected against foreign sites.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-10T23:35+01:00 (approximate)
- **Completed:** 2026-11-11T00:05+01:00
- **Tasks:** 2
- **Files modified:** 6 (all new)

## Accomplishments

- `ficheCandidat` and `resume` assemble the sheet from `loadAll` (preview data, production diagnostics) and the 09-01 state, with no rule recomputed. On the real corpus, the 47 santé measures all find their extract window (`trouve: true`, 47 of 47), 37 candidates have a status and a case, and the three santé date contradictions (clara-egger, benoit-mathieu, manolo-mlekuz) are attached to their case (D-11).
- The server refuses a foreign Host (421), a foreign Origin or a cross-site Sec-Fetch-Site (403), a non-form content type (415), a body over 8 KiB (413), a missing, wrong or duplicated token (403), and a malformed or unknown target (400). Every refusal leaves `src/content` byte-identical and creates no registry file (tested).
- Happy path tested end to end: GET the page, read the hidden token, POST valider, follow the 303, the measure file gains exactly the three review fields and the journal gets one line. Status and case validation write the same bytes as the CLI.
- A `<script>` and quotes put in a temp measure wording and in a note come back escaped; no page contains a script element.
- Manual smoke on the real corpus: `npm run relecture -- servir --theme sante --port 4399` printed the address, `GET /` gave 200 with `reste 121 sur 121`, a forged `Host: exemple.test` gave 421, lsof showed a listener on 127.0.0.1:4399 only, Ctrl+C (SIGINT) stopped it, `git status --porcelain src/content archives data relecture` stayed empty.

## Task Commits

1. **Task 1: review sheet of a candidate**: `97d0d4e` (test, red), `f53d203` (feat)
2. **Task 2: local server, forms, security checks, proof it stays out of the site**: `e82bbdb` (test, red), `03d5c84` (feat)

## Verification

- `TZ=Europe/Paris node --test tests/relecture/serveur.test.ts tests/relecture/vue.test.ts tests/repo/relecture-hors-site.test.ts`: 26 pass, 0 fail.
- Greps: `'127.0.0.1'` appears 2 times in serveur.ts and 1 time in servir.ts; `0.0.0.0` 0 in each; `<script` in serveur.ts 0.
- `npm test`: 2452 tests, 2443 pass, 0 fail, 9 skipped. `npm run check`: 0 errors, 0 warnings, 0 hints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Quote not found when the archive uses U+02BC (modifier letter apostrophe)**
- **Found during:** Task 1 acceptance run on the real corpus (46 of 47 at first; miss: `antoine-mikolajczak/sante-alimentation-soins-territoire`)
- **Issue:** U+02BC is a Unicode letter, so the squash kept it in the archive while `fragments` (through `cleanText`) had turned it into an apostrophe in the quote.
- **Fix:** each character goes through `cleanText` before `foldKey`, the same normalization as the rule engine; regression test added.
- **Files modified:** scripts/lib/relecture/vue.ts, tests/relecture/vue.test.ts
- **Commit:** f53d203

### Notes on the test approach

- The Host refusals are tested with raw `node:http` requests that set the `host` header explicitly (as in tests/scripts/e2e-serveur.test.ts), not by calling the handler with a fake request. A real socket gives a real `localPort`, which the Host check uses. The handler is still exported (`creerGestionnaire`).

No other deviation. No file outside `files_modified` was touched (besides this SUMMARY, STATE.md and the ROADMAP checkbox). scripts/relecture.ts and package.json are unchanged: the dispatcher finds `commandes/servir.ts` by its presence.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-09-23 to T-09-28 are mitigated as planned; T-09-29 (another local user) stays accepted (loopback only, token required for any write). The page shows source URLs as links (`rel="noopener noreferrer"`, `https:` only, `Referrer-Policy: no-referrer`); following one is a top-level navigation by Erwan, not a request from the server.

## How Erwan opens the page

```
fnm exec --using=24 npm run relecture -- servir
```

(thème santé, http://127.0.0.1:4327/ ; `--port <n>` if 4327 is taken ; Ctrl+C to stop)

## Self-Check: PASSED

All 6 created files exist; commits 97d0d4e, f53d203, e82bbdb, 03d5c84 exist.
