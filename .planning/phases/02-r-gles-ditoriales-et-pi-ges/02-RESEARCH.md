# Phase 2: Règles éditoriales et pièges - Research

**Researched:** 2026-11-03
**Domain:** Editorial-rule engine on top of the existing `content-core` loader (French text processing, cross-file integrity, poll legal windows, trap-fixture test harness). Node 24, stdlib only.
**Confidence:** HIGH for the French text utilities (prototyped, type-checked, calibrated against Lexique 3.83), HIGH for the integration design (read against the real code), MEDIUM for readability thresholds and a few rule-severity defaults (flagged in the Assumptions Log).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Décisions héritées (Phase 1, verrouillées)**
- JSON Schema = structure ; les règles éditoriales vivent dans content-core, jamais dans Astro
- Statuts `declare|primaire|pressenti|empeche|renonce` ; périmètre d'équité = `declare` + `primaire` (config)
- Presse autorisée pour statuts seulement, jamais pour une mesure (`SOURCE_NON_PRIMAIRE`)
- Archive : extrait `.txt` + sha256 committés ; règle Phase 2 : `archive.wayback_url` obligatoire pour toute source citée par une mesure `publie`
- Tests : entrées de fixture adressées par id, jamais par index ; Node 24 via fnm ; aucune nouvelle dépendance sans justification

**Règles éditoriales (acceptées par Erwan 2026-11-03)**
- Mots interdits : préfixes de lemmes après NFC + minuscules (`extrêm*`/`extrem*`, `populis*`, `irresponsab*`, `courage*`, `enfin` en mot exact), dans les champs éditoriaux (titre, 4 rédactions, résumé de statut), en excluant les spans `« … »` et `texte_source` ; erreur `MOT_INTERDIT`
- Verbes connotés = avertissement `VERBE_CONNOTE` : promet, prétend, ose, assure, affirme, martèle, reconnaît, admet, avoue, se vante (formes conjuguées courantes)
- Chiffres : nombre écrit en chiffres (normalisation espaces fines/insécables, virgule décimale, %, €) absent du `texte_source` ou du chiffrage = erreur `CHIFFRE_HORS_SOURCE` pour résumé, enfant, aîné ; nombre en lettres = avertissement
- Lisibilité : Kandel-Moles (207 − 1,015 × mots/phrase − 73,6 × syllabes/mot) sur la rédaction enfant = avertissement si < 80 ; phrase enfant > 15 mots = erreur pour `publie` (`PHRASE_ENFANT_LONGUE`), avertissement en brouillon
- Longueurs : résumé ≤ 25 mots, détaillé 80-200, enfant 40-60, aîné 60-120 (comptage `Intl.Segmenter` + élisions + groupes de chiffres)
- Citations : chaque `« … »` du détaillé ⊆ `texte_source` ; `texte_source` ⊆ extrait archivé, après normalisation (NFC, apostrophes, espaces, guillemets)

**Corpus et sondages**
- `ids.lock` committé : un id de candidat renommé/supprimé = erreur
- Références cassées (candidat, thème, source, glossaire `[[terme]]`) = erreur
- Équité : thème `publie` exige pour chaque candidat du périmètre une mesure `publie` ou un état couverture vérifié ; erreur en production, avertissement en preview
- Garde-fou : `bloc`, `extdroite`, `propositions` interdits dans `src/content/`
- Sondages : notice absente, somme hors 95-105 %, hypothèse tour 2 en tour 1, publication dans fenêtres 17/04/2027 00:00 → 18/04 20:00 et 01/05 00:00 → 02/05 20:00 Europe/Paris = erreurs

### Claude's Discretion
- Organisation interne des fichiers de règles, noms exacts des codes au-delà de ceux listés, format de `attendu.json`
- Heuristique de syllabes française (calibrée et figée en cas de test)

### Deferred Ideas (OUT OF SCOPE)
- Kandel-Moles bloquant après calibrage sur Vikidia (DIFF-01)
- Gel de contenu pendant le silence électoral (lot 5) — les fenêtres sont déjà codées ici

**Phase boundary (from CONTEXT.md `<domain>`):** Règles d'entrée (par fichier) et de corpus (inter-fichiers) dans `src/lib/content-core/rules/`, appelées par `loadAll` après Ajv, avec codes d'erreur stables, sévérité dépendante du mode (`--mode preview|production`) et annotations GitHub (fichier, ligne, code). Suite de pièges §12 en fixtures `tests/fixtures/pieges/<code>/` (overlay sur `corpus-valide` + `attendu.json`). Livrable Lot 1 : la CI refuse une mesure sans source. Hors périmètre : import réel (Phase 3), pages (Phase 4), page Méthode (Phase 5, mais la config des règles doit être exportable pour la générer).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REGLE-01 | Mesure sans source / source inconnue / non primaire / sans archive valide rejetée | Ajv `OVERRIDES` give `SOURCE_ABSENTE`, `SOURCE_NON_PRIMAIRE` (verified by spike); corpus rules give `SOURCE_INCONNUE`, `SOURCE_AUTRE_CANDIDAT`, `ARCHIVE_ABSENTE`, `ARCHIVE_SHA256_DIVERGENT`, `ARCHIVE_WAYBACK_ABSENTE`; fixture needs `wayback_url` |
| REGLE-02 | Mots interdits (hors citations et `texte_source`) ; verbes connotés en avertissement | `forbidden.ts` prototype (accent-folded prefix match on elision-split words, 23+8 cases pass); quote-exemption loophole closed by REGLE-04 on all fields |
| REGLE-03 | Longueurs 25 / 80-200 / 40-60 / 60-120 | `words()` prototype; fixture measured at 22 / 99 / 51 (after edit) / 73 words |
| REGLE-04 | Nombre absent de la source ; citation ⊆ `texte_source` | `numbers.ts` (canonical decimal compare, 26 cases) + `verbatim.ts` (17 cases); `chiffrage` must itself be verified against the archive |
| REGLE-05 | `texte_source` ⊆ extrait archivé après normalisation | token-sequence containment with ellipsis fragments; haystack cached per archive |
| REGLE-06 | Kandel-Moles en avertissement ; phrase enfant > 15 mots = erreur `publie` | `syllables.ts` calibrated: 98.7 % exact on 121 050 Lexique 3.83 word types, 99.2 % on the 5 000 most frequent; fixture enfant scores 79.1 and must be edited |
| REGLE-07 | Références existantes, chemin = id (déjà fait), `ids.lock` | corpus rules over `allIds` (no cascade); `ids.lock` format and `scripts/ids.ts` workflow |
| REGLE-08 | Équité par thème `publie` (erreur en production, avertissement en preview) | corpus rule over `couverture` + published mesures; mode threaded through `LoadOptions` |
| REGLE-09 | Sondage : notice, somme 95-105 %, tour 2 en tour 1, fenêtres de blocage | Ajv override for notice; entry rules; TZ-independent `Date.UTC` window constants verified under 5 time zones |
| REGLE-10 | Chaque piège §12 = fixture + code attendu ; `npm test` échoue si un piège passe | overlay + `attendu.json` + one table-driven runner + coverage meta-test |
| REGLE-11 | Erreurs avec fichier, ligne, code ; annotations GitHub | existing `formatGithub`/`pointerToPos` reused; add `--mode`, integration test on `::error ...line=N,title=CODE::` |
| REGLE-12 | `bloc`, `extdroite`, `propositions` interdits dans `src/content/` | YAML AST key scan (not text grep) that runs even on files failing the schema |
</phase_requirements>

## Summary

Phase 2 adds a rule layer to `loadAll` in three tiers: **file rules** (YAML AST, run even if the schema fails: REGLE-12), **entry rules** (one schema-valid entry: editorial text, polls) and **corpus rules** (all entries plus the file system: references, sources/archives, `ids.lock`, equity). Rules return `Finding { code, severity, pointer, message, file? }`; a single runner turns each finding into the existing `Diagnostic` through `pointerToPos(doc, lc, pointer, 'key')`, so line numbers, text output and `::error file=,line=,col=,title=CODE::` annotations all come for free (REGLE-11). The only change to the `loadAll` contract is an optional `mode`; `LoadResult` keeps its exact shape (an existing test asserts `deepEqual(res, { entries: [], diagnostics: [], files: 0 })`).

The French text layer is small and was prototyped, type-checked (`tsc --strict --erasableSyntaxOnly`) and tested under four time zones. The findings that change the plan: (1) ICU treats U+202F (narrow NBSP) as part of a number and returns `"12 "` as a word, so **normalize all space-like characters before segmenting**; (2) `Intl.Segmenter` keeps `l’école` as one word and `l'extrême` as one token, so **split elisions before counting and before prefix matching**; (3) `textstat` (the reference named in STACK.md) is a biased oracle for French syllables (hyphenation points + 1: 88.4 % exact on the top 5 000 words, systematic under-count), whereas **Lexique 3.83 `nbsyll` is a real ground truth**, so the heuristic is calibrated against Lexique and a frozen table of 161 verified words is provided; (4) the Phase 1 fixture **does not satisfy two Phase 2 rules as it stands**: its source has no `wayback_url` (mesure is `publie`) and its enfant text scores Kandel-Moles 79.1 (< 80, a warning that would break the `deepEqual(diagnostics, [])` test), so the fixture must be edited in the first plan.

The trap suite is an overlay on a temp copy of `corpus-valide` plus text patches declared in `attendu.json`, executed by one table-driven runner that asserts the exact set of `(code, file, pointer, severity)`; a meta-test fails if any catalogue code marked `piege` has no fixture or if a fixture directory names an unknown code.

**Primary recommendation:** Build plan 1 as the runner + REGLE-01 vertical slice (Lot 1 deliverable: "la CI refuse une mesure sans source"), including the fixture corrections and the trap harness; then add rule families as independent slices (text rules, numbers/quotes/archive, readability, corpus integrity + `ids.lock` + REGLE-12, equity, polls), each delivering fixture → rule → diagnostic with line → CLI annotation.

## Architectural Responsibility Map

This phase is build-time/CI only; there is no browser, SSR or API tier. Tiers below are the project's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Editorial rules, codes, severities | `src/lib/content-core/rules/` (pure Node, no Astro import) | — | Locked: rules live in content-core, never in Astro |
| Rule configuration (word lists, bounds, windows) | `rules/config.ts` (pure data, no `node:` import) | Phase 5 Méthode page imports it | Must be importable by an Astro page |
| French text utilities | `rules/text/*.ts` (pure functions, stdlib) | — | Reused by several rules and by tests |
| Filesystem checks (archive exists, sha256, `ids.lock`) | corpus/entry rules via `readContained`/`checkContained` | — | Reuse Phase 1 symlink/containment guards |
| Mode selection (`preview`/`production`) | `scripts/validate.ts` (`--mode`) and `astro-loader.ts` (`RTP_MODE`) | `root.ts` (`resolveMode`) | One resolver shared by CLI and Astro; default `production` (fail-closed) |
| Diagnostics with file/line/code, GitHub annotations | `diagnostics.ts` (existing) | CI workflow | Already implemented in Phase 1; Phase 2 adds codes and an integration test |
| `ids.lock` maintenance | `scripts/ids.ts` (`--check`/`--write`, append-only) | rule `ID_*` in corpus tier | Same pattern as `migrate --check/--write` |
| Trap fixtures and runner | `tests/fixtures/pieges/**`, `tests/pieges/pieges.test.ts` | `tests/helpers/` | Test tier; never validated by CI `validate` (outside `src/content`) |
| Blocking-window enforcement on poll data | entry rule `SONDAGE_FENETRE_BLOCAGE` | Lot 4 display layer (out of scope) | Data-level guard now; display-level hiding is Lot 4 |

## Standard Stack

### Core
No new dependency. Everything already in the repo or in Node 24 stdlib.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.22.2 (ICU 78.3, Unicode 17.0) `[VERIFIED: fnm exec --using=24 node]` | Runtime, `Intl.Segmenter`, `node:test`, `node:crypto`, `fs.cpSync`, native TS stripping | Project decision D-5 |
| `yaml` (eemeli) | ^2.9.1 (already a dependency) | `parseDocument` + `LineCounter`; `visit()` for the REGLE-12 key scan | Already the single parse path (DATA-07) |
| `ajv` | ^8.20.0 (already a dependency) | Structure; the `OVERRIDES` table gives stable business codes | Existing mechanism, spike-verified below |
| `node:test` | Node 24 | All new tests (`tests/text`, `tests/rules`, `tests/pieges`) | Existing convention (`npm test` globs `tests/**/*.test.ts`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` `createHash('sha256')` | stdlib | Archive hash over raw bytes | ARCHIVE rule |
| `Intl.Segmenter('fr')` | stdlib | Word and sentence segmentation (locked decision) | `words()`, `sentences()` |
| `Intl.DateTimeFormat({ timeZone: 'Europe/Paris' })` | stdlib | Test-only cross-check of the hard-coded UTC window constants | window unit test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Own syllable heuristic | `hyphen@1.14.1` / pyphen | Hyphenation is an orthographic proxy that under-counts (see Pitfall 7). Not needed: heuristic is 98.7 % exact vs Lexique |
| `Intl.Segmenter` words | A 3-line regex tokenizer | Regex is ICU-version independent; segmenter is the locked decision. Mitigate drift with canary tests |
| Hard-coded UTC window instants | `Temporal` / date library | `Temporal` is not needed: Paris is UTC+2 on both dates (DST began 2027-03-28), constants are exact and TZ-proof |

**Installation:** none.

**Version verification:** `node --version` = v24.22.2, `process.versions.icu` = 78.3, `unicode` = 17.0 `[VERIFIED: local run 2026-11-03]`. `yaml`/`ajv` versions are those already pinned in `package.json` `[VERIFIED: codebase]`.

## Package Legitimacy Audit

No external package is installed by this phase. **Packages removed due to slopcheck [SLOP] verdict:** none. **Packages flagged [SUS]:** none.

Tools used only during research, in throw-away directories under `/tmp` and never added to the project: Python `textstat` 0.7.13 and `pyphen` 0.17.2 (installed from PyPI in a venv to inspect their syllable counting), and the Lexique 3.83 dataset downloaded from lexique.org (data, not code). They are evidence sources, not dependencies, so slopcheck does not apply.

## Architecture Patterns

### System Architecture Diagram

```
 npm run validate -- [--mode preview|production] [--format github]      astro build (RTP_MODE)
                  |                                                          |
                  v                                                          v
        scripts/validate.ts ----------------------------------> astro-loader.ts (memo key += mode)
                  \                                                         /
                   \________________________  loadAll(root, {schemasDir, mode}) ________________/
                                              |
        listContentFiles ──> per file: readContained ─> parseYaml ─> Ajv (OVERRIDES: SOURCE_ABSENTE,
                                              |            |            SOURCE_NON_PRIMAIRE, ARCHIVE_ABSENTE,
                                              |            |            SONDAGE_NOTICE_ABSENTE)
                                              |            +─> FILE RULES (YAML AST, even if schema fails)
                                              |                  CHAMP_NON_IMPORTABLE (bloc/extdroite/propositions)
                                              |            +─> checkPathCoherence (ID_CHEMIN_INCOHERENT, Phase 1)
                                              v
                              valid entries + parsed docs (internal: entry + doc + LineCounter)
                                              |
                       ┌──────────────────────┴───────────────────────┐
                       v                                              v
               ENTRY RULES (1 entry)                          CORPUS RULES (all entries + FS + ids.lock)
         mesure: MOT_INTERDIT, VERBE_CONNOTE,            REFERENCE_CASSEE, SOURCE_INCONNUE, SOURCE_AUTRE_CANDIDAT,
         LONGUEUR_HORS_BORNES, CHIFFRE_HORS_SOURCE,      ARCHIVE_ABSENTE / _SHA256_DIVERGENT / _WAYBACK_ABSENTE,
         NOMBRE_LETTRES_HORS_SOURCE, CITATION_HORS_SOURCE,  TEXTE_SOURCE_HORS_ARCHIVE, CHIFFRAGE_HORS_ARCHIVE,
         PHRASE_ENFANT_LONGUE, LISIBILITE_ENFANT_FAIBLE  ID_VERROUILLE_DISPARU / ID_NON_VERROUILLE / IDS_LOCK_ABSENT,
         sondage: SOMME, TOUR2_EN_TOUR1, FENETRE_BLOCAGE EQUITE_CANDIDAT_MANQUANT / EQUITE_COUVERTURE_INCOHERENTE
                       \                                              /
                        └────────────── Finding {code, severity, pointer, message, file?} ──────────────┘
                                              |
                       toDiagnostic: pointerToPos(doc, lc, pointer, 'key') ──> Diagnostic {file,line,col,code,severity}
                                              |
                       sort (file, line, col, code, message) ──> LoadResult {entries, diagnostics, files}   (shape unchanged)
                                              |
              formatText / formatGithub (::error|::warning file=,line=,col=,title=CODE::)  ──> exit 1 if any error
```

### Recommended Project Structure
```
src/lib/content-core/
├── rules/
│   ├── config.ts            # PURE DATA, no node: import (Méthode page, Phase 5): MOTS_INTERDITS, VERBES_CONNOTES,
│   │                        #   LONGUEURS, SEUIL_KANDEL_MOLES, PHRASE_ENFANT_MAX, SOMME_SONDAGE, FENETRES_BLOCAGE,
│   │                        #   PERIMETRE_EQUITE, CHAMPS_NON_IMPORTABLES, CHAMPS_EDITORIAUX
│   ├── catalogue.ts         # every code: { code, regle, severite, piege: boolean, libelle } (Méthode + coverage meta-test)
│   ├── types.ts             # Mode, Finding, EntryRule, CorpusRule, FileRule, RuleContext
│   ├── run.ts               # runFileRules / runEntryRules / runCorpusRules + toDiagnostic
│   ├── index.ts             # explicit ordered registry (one import line per rule)
│   ├── text/                # normalize.ts words.ts sentences.ts syllables.ts numbers.ts verbatim.ts  (pure)
│   ├── fichier-champs.ts    # REGLE-12
│   ├── mesure-texte.ts      # REGLE-02/03/04/06 (entry)
│   ├── source-archive.ts    # REGLE-01/05 (corpus + FS)
│   ├── references.ts        # REGLE-07 refs
│   ├── ids-lock.ts          # REGLE-07 lock
│   ├── equite.ts            # REGLE-08
│   └── sondage.ts           # REGLE-09 (entry + refs)
├── load.ts                  # + LoadOptions.mode, keep internal doc/lc per entry, call runners
├── root.ts                  # + resolveMode(env)
scripts/validate.ts          # + --mode
scripts/ids.ts               # --check | --write (append-only), --root
ids.lock                     # real corpus (header only until Phase 3) ; tests/fixtures/corpus-valide/ids.lock
.gitattributes               # archives/** -text  (byte-exact sha256)
tests/text/*.test.ts         # unit tests for the text layer (frozen tables)
tests/rules/*.test.ts        # rule tests (inline YAML via helper)
tests/pieges/pieges.test.ts  # table-driven runner + coverage meta-test
tests/fixtures/pieges/<CODE>[--variante]/{attendu.json, <overlay files...>}
```

### Pattern 1: Three rule tiers and one Finding-to-Diagnostic path
**What:** `FileRule(doc, lc, file) -> Finding[]`, `EntryRule(entry, ctx) -> Finding[]`, `CorpusRule(corpus, ctx) -> Finding[]`. The runner owns severity default (`error`), location and sorting. A finding may name a different `file` (corpus rules point at the offending file, e.g. the mesure for `SOURCE_INCONNUE`, the theme for equity, `ids.lock` for a vanished id).
**When to use:** every new rule. Keep rules pure on data + `ctx`; no rule formats text or touches `Diagnostic` directly.
**Example:**
```typescript
// Source: design derived from src/lib/content-core/load.ts and diagnostics.ts (read 2026-11-03)
export type Mode = 'preview' | 'production';
export interface Finding { code: string; severity?: 'error' | 'warning'; pointer: string; message: string; file?: string }
export interface RuleContext { mode: Mode; contentRoot: string; corpus: Corpus; archives: ArchiveCache }
export interface EntryRule { id: string; run(e: LoadedEntry, ctx: RuleContext): Finding[] }

// load.ts (sketch): keep doc/lc internally, expose plain Entry
interface LoadedEntry extends Entry { doc: Document.Parsed; lc: LineCounter }
// ... after the per-file loop:
const ctx = { mode: opts.mode ?? 'production', contentRoot, corpus, archives: new ArchiveCache(contentRoot) };
for (const e of loaded) findings.push(...runEntryRules(e, ctx));
findings.push(...runCorpusRules(corpus, ctx));
diagnostics.push(...findings.map((f) => toDiagnostic(f, parsedByFile)));
```

### Pattern 2: Stable business codes from Ajv via `OVERRIDES` (spike-verified)
**What:** For "missing field" and "bad enum" cases that Ajv already detects, add entries to `OVERRIDES` instead of re-detecting. Spike on the real code (2026-11-03): removing `source:` from the fixture mesure gave `['SOURCE_ABSENTE', line 1, '']`; changing the source `type` to `presse` gave `['SOURCE_NON_PRIMAIRE', line 3, '/type']`.
**Entries to add:** `{schema:'mesure', keyword:'required', pointer:/^$/, when:(_,p)=>p.missingProperty==='source', code:'SOURCE_ABSENTE'}`; same with `texte_source` -> `TEXTE_SOURCE_ABSENT`; `{schema:'source', keyword:'enum', pointer:/^\/type$/, code:'SOURCE_NON_PRIMAIRE'}`; `{schema:'source', keyword:'required', pointer:/^$/, when: missingProperty==='archive', code:'ARCHIVE_ABSENTE'}`; `{schema:'sondage', keyword:'required', pointer:/^$/, when: missingProperty==='url_notice', code:'SONDAGE_NOTICE_ABSENTE'}`.
**Line quality:** a "required" error is positioned on the parent object (line 1). To give `SOURCE_ABSENTE` a useful line, extend `CodeOverride` with an optional `anchor` pointer (e.g. `/texte_source`) used for positioning when present. Optional improvement, cheap.

### Pattern 3: Fail-closed mode resolution
`resolveMode(env)` in `root.ts`: `--mode` flag, else `RTP_MODE`, else `production`; any other value is a usage error (exit 2 in the CLI, a thrown error in the Astro loader). `LoadOptions.mode` is optional and defaults to `production`, so every existing caller and test keeps working. The Astro loader's memo key must include the mode. Phase 4 reuses the same resolver for M1-11.

### Pattern 4: No cascading errors
Entries failing the schema are not in `entries`; if corpus rules treated them as absent, one broken file would produce a wave of `REFERENCE_CASSEE`. Build `allIds: Map<CollectionName, Set<string>>` from **all listed files** (including invalid ones) and report a broken reference only when the target id is in no listed file. Likewise: if a source's archive is missing or its sha256 diverges, report that once on the source and **skip** `TEXTE_SOURCE_HORS_ARCHIVE`/`CHIFFRAGE_HORS_ARCHIVE` for its mesures.

### Pattern 5: Trap fixtures as patches on a temp copy of `corpus-valide`
**What:** `tests/fixtures/pieges/<CODE>[--variante]/` holds (a) `attendu.json`, (b) optional overlay files at their final relative paths (`src/content/...`, `archives/...`, `ids.lock`), copied over the base. `attendu.json` can also `supprimer` paths and apply exact-once text `remplacer` patches, so most traps are 3-line diffs that cannot drift from the base fixture (a patch whose `de` does not occur exactly once fails the test loudly).
```json
{
  "piege": "§12 : une mesure sans source",
  "regle": "REGLE-01",
  "mode": "production",
  "remplacer": [
    { "fichier": "src/content/mesures/marie-fictive/encadrement-loyers.yaml",
      "de": "source: marie-fictive-programme\n", "par": "" }
  ],
  "supprimer": [],
  "attendu": [
    { "code": "SOURCE_ABSENTE", "severite": "error", "fichier": "src/content/mesures/marie-fictive/encadrement-loyers.yaml", "pointer": "" }
  ]
}
```
**Runner contract:** copy base to `mkdtemp`, overlay, delete, patch, `loadAll(tmp, {schemasDir, mode})`, relativize `d.file`, then `assert.deepEqual(sortedActual, sortedExpected)` on `(code, severite, fichier, pointer)`. Exact-set matching (not subset) catches cascades. `ligne` is optional in `attendu.json`; a dedicated REGLE-11 test asserts real line numbers for 3-4 traps. Negative variants (`MOT_INTERDIT--dans-citation-ok`, `attendu: []`) guard against false positives, which Roadmap says must flow back to Phase 2 from Phase 3 content.
**Meta-test:** every catalogue entry with `piege: true` has a directory `<CODE>` or `<CODE>--*`; every directory name's code prefix exists in the catalogue; the base corpus with no patch yields `[]`.

### Pattern 6: Suggested vertical slices (mode mvp)
| Plan | Slice | Requirements | Notes |
|------|-------|--------------|-------|
| 02-01 | Rule runner + `--mode` + trap harness + **REGLE-01** (source/archive) + fixture corrections | REGLE-01, 10 (harness), 11 | Lot 1 deliverable; owns all edits to `corpus-valide` and `.gitattributes` |
| 02-02 | Text layer + forbidden words + lengths | REGLE-02, 03 | `rules/text/{normalize,words}.ts` |
| 02-03 | Numbers, quotes, verbatim vs archive, chiffrage | REGLE-04, 05 | needs 02-01 archive cache |
| 02-04 | Sentences, syllables, Kandel-Moles, sentence-length rule | REGLE-06 | owns frozen syllable table and fixture enfant edit |
| 02-05 | Corpus integrity: references, `ids.lock` + `scripts/ids.ts`, REGLE-12 key scan | REGLE-07, 12 | |
| 02-06 | Equity | REGLE-08 | needs mode from 02-01 |
| 02-07 | Polls | REGLE-09 | |
| 02-08 | Closure: CI step (`--mode production`), docs (README/RUNBOOK `ids` workflow, ARCHITECTURE ADR), config-export test, §12 coverage assertion | REGLE-10 | |
Slices 02-02 to 02-07 depend only on 02-01 and can run in parallel; they all append one line to `rules/index.ts` and `catalogue.ts` (trivial merge conflicts, note it in the plans).

### Anti-Patterns to Avoid
- **Text-grep for REGLE-12:** `propositions` is an ordinary French word that will appear in rédactions; scan YAML **keys** via the AST.
- **Exempting `« … »` without verifying them:** a writer could wrap a forbidden word in guillemets to bypass REGLE-02. Verify every `« … »` span of every editorial field of a mesure against `texte_source`.
- **Trusting `chiffrage`:** numbers in `chiffrage.texte` legitimize numbers in rédactions; if `chiffrage.texte` is not itself verified against the archive it launders invented figures.
- **`new Date(y, m, d)` for windows:** depends on the process time zone. Use `Date.UTC` constants and `Date.parse` of the offset-bearing ISO string.
- **Excluding invalid entries from `allIds`:** causes cascades (Pattern 4).
- **A domain denylist for "press":** a tribune published in a newspaper is a legitimate primary source (spec §5 lists tribunes). Primary/non-primary is decided by `source.type` and `source.candidats`, never by hostname.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML position of a finding | Line counting on raw text | Existing `pointerToPos(doc, lc, pointer, 'key')` | Handles maps/seqs/fallbacks; already tested |
| GitHub annotation formatting and injection safety | New printf | Existing `formatGithub`/`formatText`/`safe`/`escapeData` | Offending words are contributor-controlled text; messages must stay escaped |
| Path containment / symlink refusal for `archive.extrait` and `ids.lock` | `fs.existsSync` + join | Existing `checkContained`/`readContained` | TOCTOU and realpath checks already solved in Phase 1 |
| Hash | custom | `node:crypto` `createHash('sha256').update(bytes)` | Raw bytes, not decoded text |
| Unicode folding | char maps | `String.prototype.normalize('NFKC'/'NFD')` + `\p{M}` | Handles ligatures (ﬁ), compatibility ellipsis, NBSP |
| Word/sentence boundaries | split on spaces | `Intl.Segmenter('fr')` with the thin layer in Code Examples | Locked decision; known corrections documented |
| Syllable dictionary | embedding Lexique | the 20-line heuristic + frozen table | 98.7 % exact; avoids a CC BY-SA data dependency |
| Time zone arithmetic | offset math | `Date.UTC` constants + `Date.parse` (+ `Intl` only in the test cross-check) | TZ-independent by construction |
| Fixture copy | recursive copier | `fs.cpSync(src, dst, {recursive:true})` | Already used by existing tests |
| Exact-once text patching | regex replace | `split(de).length - 1 === 1` assertion then `replace` | A silent no-op patch would make a trap pass vacuously |

**Key insight:** every deceptively hard part (positions, escaping, containment, Unicode, time zones) already has a tested or stdlib answer in this repo. The new code is the rules and ~150 lines of French text handling; resist adding libraries.

## Common Pitfalls

### Pitfall 1: The Phase 1 fixture violates Phase 2 rules (three silent breakages)
**What goes wrong:** (a) the mesure `marie-fictive/encadrement-loyers` is `publie` but its source has no `archive.wayback_url`, so `ARCHIVE_WAYBACK_ABSENTE` fires; (b) its enfant text scores Kandel-Moles **79.1** with the frozen heuristic (< 80), so `LISIBILITE_ENFANT_FAIBLE` fires and `corpus-valide.test.ts` (`deepEqual(result.diagnostics, [])`) and `load.test.ts:224` fail; (c) once a `wayback_url` is added, the existing test "toutes les URL https ont un hôte en `.invalid`" fails on `web.archive.org`.
**Why it happens:** Phase 1 wrote the fixture "conform to future rules" by hand, before the rules existed.
**How to avoid:** plan 02-01 owns these edits:
1. Add `wayback_url: https://web.archive.org/web/20261020100000/https://marie-fictive.exemple.invalid/programme` under `archive:` (matches the schema pattern `^https://web\.archive\.org/web/[0-9]{14}/`). Update the `.invalid` test to allow host `web.archive.org` only for a key named `wayback_url`.
2. Replace the last enfant sentence `Le préfet est la personne qui représente l'État dans le département.` by `Le préfet est la personne qui parle pour l'État dans le département.` Measured: 51 words (still 40-60), 5 sentences, longest 13 words, **Kandel-Moles 82.6** (margin 2.6). Re-measure with the real implementation and keep >= 2 points of margin.
3. Add `tests/fixtures/corpus-valide/ids.lock` (`jean-imaginaire`, `marie-fictive`) and a header-only `ids.lock` at the repo root so `RTP_CONTENT_ROOT=.` (0 candidates) passes.
**Warning signs:** `npm test` red on `corpus-valide.test.ts` right after wiring the first rule.

### Pitfall 2: ICU treats U+202F as part of a number
**What goes wrong:** `Intl.Segmenter('fr',{granularity:'word'})` on `12` + U+202F + `%` returns a word-like segment `"12 "` (with the space), and `1`+U+202F+`500`+U+202F+`000` as **one** word, while U+0020/U+00A0/U+2009/U+200A/U+2007 give three words `[VERIFIED: local run, ICU 78.3]`. Counts and number extraction diverge by which space the typographer used.
**How to avoid:** `cleanText()` first (NFC, strip U+00AD/U+200B-200D/U+2060/U+FEFF, map NBSP, U+1680, U+2000-200A, U+202F, U+205F and U+3000 to U+0020, apostrophes to `'`, collapse whitespace), then merge digit groups, then segment.
**Warning signs:** a word count that changes when a `NBSP` is swapped for a `NNBSP`.

### Pitfall 3: Elisions defeat prefix matching
**What goes wrong:** `l'extrême droite` is one token `l'extrême` (apostrophe is UAX#29 MidNumLet), so `startsWith('extrem')` misses it and the CI accepts a forbidden word.
**How to avoid:** the same `words()` that counts (elisions split) must feed the forbidden-word and connoted-verb matchers. Exceptions kept whole by construction: `aujourd'hui`, `presqu'île`, `quelqu'un`, `prud'homme` (their prefix is not in the elision list).
**Warning signs:** trap `MOT_INTERDIT--elision` ("l'extrême") not failing.

### Pitfall 4: Accent folding merges verbs and participles
**What goes wrong:** matching connoted verbs on accent-folded text makes `osé` match `ose`, `assuré` match `assure`.
**How to avoid:** forbidden **stems** are matched accent-folded (so `extreme` and `extrême` both hit, as required); connoted **verbs** are matched on NFC lower-case with accents kept (include both `reconnaît` and `reconnait`).

### Pitfall 5: `extrémité` is not an editorial judgement
**What goes wrong:** the locked prefix `extrem*` flags `extrémité` (anatomy, geography).
**How to avoid:** an `exceptions` list on the rule (`extremite`, `extremites`), exposed in the config so the Méthode page can show it. Keep the list tiny and reviewed; the Roadmap routes false positives from Phase 3 back here.

### Pitfall 6: Kandel-Moles 80 is hard to reach; do not escalate
**What goes wrong:** French averages ~1.6 syllables/word, which alone costs ~118 points; a short, clean child text (the fixture: 5 sentences, max 12 words) scores only 79.1. Most real enfant texts will warn.
**How to avoid:** keep it a warning (DIFF-01 defers any gate), keep the 15-word sentence rule as the actionable control, and do not make the score a build failure. Mention in the plan that the warning volume on real content is expected to be high and is informational.

### Pitfall 7: `textstat` is not a ground truth for French syllables
**What goes wrong:** STACK.md proposed calibrating against `textstat`. Its `syllable_count` is `len(pyphen.positions(word)) + 1` (hyphenation points + 1, source read in `textstat/backend/counts/_count_syllables.py`), which under-counts words pyphen refuses to hyphenate (`école` 1, `fixé` 1, `construction` 2, `nucléaire` 2). On the 5 000 most frequent Lexique words it is **88.4 % exact (570 under-counts, 10 over)**; the heuristic below is **99.2 %** on the same words `[VERIFIED: local comparison against Lexique 3.83 nbsyll]`.
**How to avoid:** calibrate against Lexique 3.83 (oral syllables, `nbsyll`), freeze the verified table below as test cases, and document the convention (final mute `e` excluded, internal `e` counted, verbal `-ent` dropped).

### Pitfall 8: Sentence segmentation in the presence of `« … »` and abbreviations
**What goes wrong:** ICU splits after `M.` (`"M. "`, `"Dupont propose..."`), after `p.` in `(cf. p. 3)`, and inside `« Non. Jamais. »` (producing a segment that starts with `»`). Result: wrong sentences, wrong 15-word verdicts.
**How to avoid:** `cleanText` (newlines become spaces: a hard-wrapped `|` block scalar is not several sentences), mask `.!?…` inside `« … »`, mask the period of a known abbreviation list and of single capital initials, then segment. Consequence documented: a sentence ending exactly with a closing quote followed by another sentence is merged (acceptable, conservative for the 15-word rule).

### Pitfall 9: Number comparison needs a canonical value, not a string
**What goes wrong:** `50 000` / `50000` / `50 000` (NNBSP) / `50.000`, `1,5 milliard` / `1 500 millions` / `1 500 000 000`, `3,5` / `3.5`, `04` / `4` must compare equal, and `CO2`, `5G` must not be extracted.
**How to avoid:** `canonical()` (BigInt-free decimal-string arithmetic with magnitude words) as in Code Examples. Units (`%`, `€`) are intentionally not compared: `12 %` in the rédaction matches `12 euros` in the source; document it as a known leniency. Ordinals (`1er`, `2e`) are extracted, so rewriting "second tour" as "2e tour" is flagged (add the figure to the source or write the words).

### Pitfall 10: Time-zone dependence of the legal windows
**What goes wrong:** window bounds built with local-time `Date` constructors move with `TZ`.
**How to avoid:** `Date.UTC` instants (`2027-04-16T22:00Z` to `2027-04-18T18:00Z`; `2027-04-30T22:00Z` to `2027-05-02T18:00Z`), start inclusive, end exclusive, `Date.parse` on the ISO string. Verified identical results under `UTC`, `Europe/Paris`, `America/Los_Angeles`, `Pacific/Auckland`, `Asia/Tokyo`; weekdays confirmed as samedi to dimanche for both windows via `Intl` with `timeZone: 'Europe/Paris'`. Add a test that runs the pure function under several `process.env.TZ` values or via `spawnSync` with `TZ=...`.

### Pitfall 11: Existing tests pin the `loadAll` result shape
**What goes wrong:** `load.test.ts:97` asserts `deepEqual(res, { entries: [], diagnostics: [], files: 0 })`; adding a field to `LoadResult` breaks it.
**How to avoid:** keep `LoadResult` identical; keep doc/lc in an internal structure. Run the whole suite after wiring each rule family; tests that copy `corpus-valide` (`validate-cli --root`, `WR-03`) pick up `ids.lock` automatically via `cpSync`.

### Pitfall 12: Poll sum with floating-point percentages
**What goes wrong:** `24.6 + 31.2 + 44.2` is not exactly `100`; boundary sums like `95` can flip.
**How to avoid:** sum in hundredths (`Math.round(pct * 100)`), compare to `9500..10500`.

### Pitfall 13: Second-round hypothesis detection must not reject the valid fixture
**What goes wrong:** the valid fixture poll is `tour: 1` with **two** scores (52 + 41) and `autres_pct: 7`. A naive "two candidates in round 1 = duel" rule flags it.
**How to avoid:** duel = exactly 2 scores whose sum is >= 99 (no residual share) **or** a hypothesis `nom` matching `/second tour|2(?:e|nd|ème) tour|duel|face[- ]à[- ]face/i`; the mirror rule: `tour: 2` with a number of scores other than 2 -> `SONDAGE_TOUR1_EN_TOUR2`. Both thresholds live in `config.ts`.

### Pitfall 14: Byte-exact archives
**What goes wrong:** `sha256` is over raw bytes; CRLF conversion (Windows `core.autocrlf`) or editor normalization changes the hash.
**How to avoid:** `.gitattributes` with `archives/** -text` and `tests/fixtures/**/archives/** -text`; read with `readFileSync` (Buffer) for the hash, then `.toString('utf8')` for the text. Cap the size before reading (`ARCHIVE_TROP_VOLUMINEUX`, > 5 MB, matching the PITFALLS.md guard).

### Pitfall 15: ICU/Node minor drift
`.nvmrc` is `24` (floating). Segmentation tables can change with ICU. The text-layer unit tests (elision, NNBSP, abbreviation, quote cases) act as canaries; a failing canary after a Node bump means "re-verify the text layer", not "disable the test".

### Pitfall 16: Messages embed contributor text
Truncate the quoted word/figure to <= 60 characters in messages and let `formatText`/`escapeData` do the escaping (never build `::error` lines in rules).

## Code Examples

All modules below are pure TypeScript (`erasableSyntaxOnly`, strict, `noUncheckedIndexedAccess`) and were executed on Node 24.22.2 under `TZ` = UTC, Europe/Paris, Pacific/Auckland and America/Los_Angeles (`node --test`, 8 groups green) and type-checked with `tsc --ignoreConfig --strict --noUncheckedIndexedAccess --erasableSyntaxOnly`. Copy as the starting point, then add the project's own tests.

### `rules/text/normalize.ts`
```typescript
// Pur : aucun import node:, importable par Astro.
const SPACE_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g; // NBSP, espaces fines, insécables fines...
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g; // trait d'union conditionnel, largeur nulle, BOM
const APOSTROPHES = /[‘’‛ʼ′`´]/g;
const DIGIT_GROUP = /(?<![\d.,])(\d{1,3})((?: \d{3})+)(?!\d)/g;

/** NFC, invisibles retirés, espaces typographiques -> U+0020, apostrophes -> ', espaces réduits. */
export function cleanText(s: string): string {
  return s.normalize('NFC').replace(INVISIBLE, '').replace(SPACE_LIKE, ' ').replace(APOSTROPHES, "'").replace(/\s+/g, ' ').trim();
}
/** « 1 500 000 » -> « 1500000 » (après cleanText). « en 2027 500 personnes » reste intact. */
export function mergeDigitGroups(s: string): string {
  return s.replace(DIGIT_GROUP, (_m, a: string, rest: string) => a + rest.replaceAll(' ', ''));
}
/** Clé de comparaison, jamais affichée : NFKC, minuscules fr, sans diacritiques, œ -> oe. */
export function foldKey(s: string): string {
  return s.normalize('NFKC').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{M}/gu, '');
}
```

### `rules/text/words.ts`
```typescript
import { cleanText, mergeDigitGroups } from './normalize.ts';

const ELISION = /^(?:[ldjnsctm]|qu|jusqu|lorsqu|puisqu|quoiqu)'(?=\p{L})/iu; // aujourd'hui, presqu'île, quelqu'un restent entiers
const segmenter = new Intl.Segmenter('fr', { granularity: 'word' });

/** Mots français : Intl.Segmenter + élisions séparées (l'école = 2) + groupes de chiffres fusionnés (1 500 000 = 1). */
export function words(raw: string): string[] {
  const s = mergeDigitGroups(cleanText(raw)).replace(/(?<=\p{L})-t-(?=\p{L})/gu, '-'); // « a-t-il » : le t euphonique ne compte pas
  const out: string[] = [];
  for (const seg of segmenter.segment(s)) {
    if (!seg.isWordLike) continue;
    let w = seg.segment;
    const m = ELISION.exec(w);
    if (m) { out.push(m[0]); w = w.slice(m[0].length); }
    if (w) out.push(w);
  }
  return out;
}
export const countWords = (s: string): number => words(s).length;

const QUOTE_SPAN = /«([^«»]*)»/g;
export const quoteSpans = (s: string): string[] => [...s.matchAll(QUOTE_SPAN)].map((m) => cleanText(m[1] ?? ''));
export const withoutQuotes = (s: string): string => s.replace(QUOTE_SPAN, ' ');
/** Faux si un « ou » est orphelin : empêche d'exempter tout le texte avec un guillemet ouvrant jamais fermé. */
export const quotesBalanced = (s: string): boolean => !/[«»]/.test(s.replace(QUOTE_SPAN, ''));
```
Hyphenated compounds count per part (`peut-être` = 2, `c'est-à-dire` = `c'`, `est`, `à`, `dire` = 4); documented and frozen in tests (it is stricter for the upper bounds and the 15-word rule, more lenient for lower bounds).

### `rules/text/sentences.ts`
```typescript
import { cleanText } from './normalize.ts';
import { words } from './words.ts';

const MASK = '\uE000'; // remplace un point qui ne termine pas la phrase
const ABBR = /\b(?:MM|Mmes?|Mlle|Mgr|Dr|Pr|St|Ste|cf|pp?|art|arts|vol|av|apr|env|fig|tél?|sec|min)\./gi;
const INITIALE = /(?<![\p{L}])(\p{Lu})\./gu; // « J. Dupont », « M. Dupont »
const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });

export function sentences(raw: string): string[] {
  let s = cleanText(raw); // les sauts de ligne deviennent des espaces
  s = s.replace(/«[^»]*»/g, (q) => q.replace(/[.!?…]/g, MASK));
  s = s.replace(ABBR, (m) => m.slice(0, -1) + MASK).replace(INITIALE, `$1${MASK}`);
  const out: string[] = [];
  for (const seg of segmenter.segment(s)) {
    const t = seg.segment.replaceAll(MASK, '.').trim();
    if (words(t).length > 0) out.push(t);
  }
  return out;
}
```

### `rules/text/syllables.ts` (heuristic + Kandel-Moles)
```typescript
import { sentences } from './sentences.ts';
import { words } from './words.ts';

// Convention de Lexique 3 (nbsyll) : syllabes prononcées ; e final muet exclu, e interne compté.
const V = 'aeiouyàâäéèêëîïôöùûüÿ';
const NASAL_ENT = new Set(['moment', 'vent', 'souvent', 'comment', 'argent', 'agent', 'agents', 'client', 'clients', 'président', 'présidents', 'accident', 'accidents', 'différent', 'différents', 'évident', 'patient', 'patients', 'récent', 'récents', 'content', 'contents', 'parent', 'parents', 'cent', 'dent', 'dents', 'lent', 'lents', 'talent', 'talents', 'urgent', 'excellent', 'violent', 'permanent', 'document', 'documents', 'instrument', 'instruments', 'gent', 'sergent', 'serpent', 'présent', 'absent', 'effet']);

export function syllables(word: string): number {
  let w = word.normalize('NFC').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  // nombre en chiffres : approximation (« 50000 » ~ 4, « 3,5 » ~ 3)
  if (/\d/.test(w)) return (w.match(/\d+/g) ?? []).reduce((a, run) => a + Math.min(run.length, 4), 0) + (/\d[.,]\d/.test(w) ? 1 : 0);
  w = w.replace(/[^a-zà-ÿ]/g, '');
  if (w === '') return 0;
  const verbEnt = w.length > 4 && w.endsWith('ent') && !w.endsWith('ment') && !NASAL_ENT.has(w);
  w = w
    .replace(/([qg])u(?=[eiyéèêë])/g, '$1') // qu / gu devant e, i, y : u muet
    .replace(/(?<=[aeiouéèêàâôû])y(?=[aeiouéèêàâôû])/g, 'j') // loyer, voyage : y consonne
    .replace(/^y(?=[aeiou])/, 'j')
    .replace(/([bcdfgpt][lr][iu])(?=[aeoéèêâô])/g, '$1.') // diérèse après consonne + liquide (crier, influence)
    .replace(/(?<=[éèê])(?=[aeiouyàâäéèêëîïôöùûüÿ])/g, '.') // hiatus : é + voyelle (créer, nucléaire)
    .replace(/(?<=[aeoyàâäéèêëîïôöùûüÿ])(?=[éèê])/g, '.') // hiatus : voyelle + é (aérien, poète), pas après i/u (société, joué)
    .replace(/(?<=[aeiouyàâäéèêëîïôöùûüÿ])(?=[äëïöüÿ])/g, '.'); // tréma (maïs, Noël)
  const groups = w.split(new RegExp(`[^${V}]+`)).filter(Boolean);
  let n = groups.length;
  if (n > 1 && groups[n - 1] === 'e' && (/es?$/.test(w) || verbEnt)) n -= 1; // e final muet (-e, -es, -ent verbal)
  return Math.max(1, n);
}

/** Kandel-Moles (1958) : 207 − 1,015 × mots/phrase − 73,6 × syllabes/mot. NaN si texte vide. */
export function kandelMoles(text: string): number {
  const ws = words(text);
  const ss = sentences(text);
  if (ws.length === 0 || ss.length === 0) return Number.NaN;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  return 207 - 1.015 * (ws.length / ss.length) - 73.6 * (syl / ws.length);
}
```
**Calibration (reproduce with the commands in Validation Architecture, Wave 0):** against Lexique 3.83 `nbsyll`, one entry per orthographic form (most frequent homograph): 121 050 types, **98.7 % exact, 99.7 % frequency-weighted, 100.0 % within +-1**, 526 over-counts, 1 072 under-counts; top-5 000 words 99.2 % exact. The constants `207 / 1.015 / 73.6` for French are confirmed in textstat 0.7.13 `backend/utils/constants.py` (`"fr": {"fre_base": 207, "fre_sentence_length": 1.015, "fre_syll_per_word": 73.6}`) `[VERIFIED: PyPI package source, 2026-11-03]`.

**Frozen table (`mot:syllabes`, values from Lexique 3.83, all equal to the heuristic; turn into a `node:test` loop):**
```
le:1 de:1 que:1 je:1 un:1 une:1 les:1 des:1 mais:1 est:1 sont:1 pas:1 plus:1 tout:1 très:1 où:1 à:1 été:2 être:1 avoir:2 école:2 loyer:2 loyers:2 propriétaire:4 préfet:2 département:4 gouvernement:4 programme:2 habitants:3 plafond:2 représente:3 aujourd'hui:3 fixé:2 année:2 montant:2 maximal:3 logement:3 logements:3 construction:3 encadrer:3 permis:2 question:2 oiseau:2 voyage:2 ancien:2 situation:3 lien:1 pied:1 rien:1 bien:1 nuit:1 huit:1 fruit:1 ouest:1 moyen:2 payer:2 essayer:3 théâtre:2 aérien:3 poète:2 maïs:2 Noël:2 aiguille:2 guide:1 qui:1 quatre:1 quarante:2 cinquante:2 trente:1 soixante:2 vingt:1 million:2 milliard:2 euros:2 impôt:2 retraite:2 retraités:3 santé:2 dépendance:3 succession:3 citoyen:3 nucléaire:3 énergie:3 scientifique:3 hôpital:3 maire:1 mairie:2 commune:2 région:2 européen:4 société:3 égalité:4 simplement:3 tellement:3 propose:2 proposer:3 éducation:4 enseignant:3 élèves:2 université:5 emploi:2 salaire:2 locataire:3 sécurité:4 justice:2 environnement:5 écologie:4 climat:2 agriculture:4 famille:2 enfants:2 personnes:2 pharmacien:3 créer:2 créé:2 crier:2 premier:2 première:2 peuple:1 république:3 élection:3 président:3 présidentielle:4 candidat:3 jamais:2 toujours:2 aussi:2 avec:2 pour:1 dans:1 sans:1 vie:1 pluie:1 joue:1 rue:1 français:2 peuvent:1 veulent:1 viennent:1 disent:1 doivent:1 savent:1 arrivent:2 parlent:1 prennent:1 attendent:2 moment:2 souvent:2 argent:2 client:2 patient:2 vraiment:2 lentement:3 seulement:3 étaient:2 avaient:2 influence:3 propriété:4 oublier:3 triomphe:2 cruel:2
```
**Known-wrong words, frozen as documented limitations (`mot: lexique -> heuristique`):** `pays: 2->1`, `aiment: 1->2`, `ouvrier: 3->2`, `médecin: 2->3`, `extraordinaire: 5->4`, `lorsque: 2->1`, `blanche: 2->1`, `ok: 2->1`, `chaos: 2->1`. Digits: `50000` = 4, `2027` = 4, `3,5` = 3, `12` = 2 (rough by design).

### `rules/text/numbers.ts`
```typescript
import { cleanText, foldKey, mergeDigitGroups } from './normalize.ts';

const MULT: Record<string, number> = { mille: 3, million: 6, millions: 6, milliard: 9, milliards: 9 };
// 1.500.000 | 3,5 | 12 ; suffixe ordinal toléré (1er, 2e) ; jamais collé à une lettre (CO2, 5G) ; multiplicateur optionnel (1,5 milliard)
const NUM = /(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?:er|ère|re|e|ème|nd|nde)?(?![\p{L}\p{N}])(?:\s+(mille|millions?|milliards?)(?!\p{L}))?/giu;

/** Forme décimale canonique (chaîne, sans flottant) : « 1,5 » + « milliard » -> « 1500000000 ». */
export function canonical(raw: string, mult?: string): string {
  const s = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replaceAll('.', '') : raw.replace(',', '.');
  const [i0 = '', f0 = ''] = s.split('.');
  let int = i0; let frac = f0;
  let exp = mult ? (MULT[mult.toLowerCase()] ?? 0) : 0;
  while (exp > 0) { if (frac.length > 0) { int += frac[0]; frac = frac.slice(1); } else int += '0'; exp--; }
  int = int.replace(/^0+(?=\d)/, ''); frac = frac.replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}
/** Nombres écrits en chiffres, valeurs canoniques. L'unité (%, €) n'est pas comparée. */
export function extractNumbers(text: string): string[] {
  const t = mergeDigitGroups(cleanText(text));
  return [...t.matchAll(NUM)].map((m) => canonical(m[1] ?? '', m[2]));
}

const NUMBER_WORDS = new Set('zero deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt vingts trente quarante cinquante soixante septante huitante nonante cent cents mille million millions milliard milliards dizaine dizaines douzaine douzaines centaine centaines millier milliers'.split(' '));
/** Nombres en lettres (clés pliées) ; « un/une » exclus (articles) ; « pour cent » exclu. */
export function extractNumberWords(text: string): string[] {
  const toks = foldKey(cleanText(text)).split(/[^a-z]+/).filter(Boolean);
  return toks.filter((w, i) => NUMBER_WORDS.has(w) && !(w === 'cent' && toks[i - 1] === 'pour'));
}
```
Rule: let `S` = set of `extractNumbers(texte_source)` plus `extractNumbers(chiffrage.texte)`; for each of `resume`, `enfant`, `aine` (not `detaille`, per REGLE-04) flag every extracted number not in `S` as `CHIFFRE_HORS_SOURCE` (one finding per field and value). Number words absent from `extractNumberWords(texte_source + chiffrage)` give the warning `NOMBRE_LETTRES_HORS_SOURCE`.

### `rules/text/verbatim.ts`
```typescript
import { cleanText, mergeDigitGroups } from './normalize.ts';

const ELLIPSIS = /\s*(?:[[(]\s*(?:…|\.{3})\s*[\])]|…|\.{3})\s*/u; // a […] b, a (...) b, a … b, a ... b
const TOKEN = /\d+(?:[.,]\d+)*|[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;

/** NFKC, casse et ponctuation ignorées, accents conservés, groupes de chiffres fusionnés. */
export function tokens(s: string): string[] {
  const t = mergeDigitGroups(cleanText(s.normalize('NFKC').replace(/œ/g, 'oe').replace(/Œ/g, 'OE'))).toLocaleLowerCase('fr');
  return t.match(TOKEN) ?? [];
}
export function fragments(s: string): string[] {
  return cleanText(s.normalize('NFKC')).split(ELLIPSIS).map((f) => tokens(f).join(' ')).filter(Boolean);
}
/** À calculer une fois par extrait d'archive (cache par chemin). */
export function haystack(text: string): string { return ` ${tokens(text).join(' ')} `; }
/** Chaque fragment figure, mot pour mot et contigu, dans `hay`. Citation vide = faux. */
export function quoteIn(quote: string, hay: string): boolean {
  const frs = fragments(quote);
  return frs.length > 0 && frs.every((f) => hay.includes(` ${f} `));
}
```
Normalization contract (what "après normalisation" means, to put on the Méthode page): NFKC; apostrophes `’ ‘ ʼ ′ ´` become `'`; NBSP/NNBSP/thin spaces become spaces; guillemets and all punctuation ignored; whitespace and line breaks irrelevant; digit groups merged (`50 000` = `50000`); case ignored; **accents significant**; `œ` = `oe`; word-boundary anchored (a quote cannot start or end in the middle of a source word); hyphen is a separator (`peut-être` = `peut être`); `[…]`, `(...)`, `…`, `...` split a quote into fragments that must each appear contiguously (order across fragments is not enforced). Used for: every `« … »` span of every mesure editorial field vs `texte_source` (`CITATION_HORS_SOURCE`), `texte_source` vs archive extract (`TEXTE_SOURCE_HORS_ARCHIVE`), and `chiffrage.texte` vs archive extract (`CHIFFRAGE_HORS_ARCHIVE`). Tested cases that must pass: exact; capitalised/final-punctuation variant; comma inserted; NBSP+NNBSP inside `50 000`; `50000`; ellipsis in three notations; and must fail: accents stripped, extra trailing words (`de région`), different figure, partial word (`ncadrerons`), reordered words, empty quote, `«»`.

### `rules/text/forbidden.ts` and config extract
```typescript
// config.ts (pur) — extrait
export interface MotInterdit { motif: string; type: 'prefixe' | 'exact'; exceptions?: readonly string[]; exemples: readonly string[] }
export const MOTS_INTERDITS: readonly MotInterdit[] = [
  { motif: 'extrem', type: 'prefixe', exceptions: ['extremite', 'extremites'], exemples: ['extrême', 'extrêmement', 'extrémiste'] },
  { motif: 'populis', type: 'prefixe', exemples: ['populiste', 'populisme'] },
  { motif: 'irresponsab', type: 'prefixe', exemples: ['irresponsable', 'irresponsabilité'] },
  { motif: 'courage', type: 'prefixe', exemples: ['courage', 'courageux', 'courageusement'] },
  { motif: 'enfin', type: 'exact', exemples: ['enfin'] },
];
export const VERBES_CONNOTES: readonly string[] = [
  'promet', 'promettent', 'promettait', 'promettaient', 'prétend', 'prétendent', 'prétendait', 'prétendaient',
  'ose', 'osent', 'osait', 'osaient', 'assure', 'assurent', 'assurait', 'assuraient',
  'affirme', 'affirment', 'affirmait', 'affirmaient', 'martèle', 'martèlent', 'martelait', 'martelaient',
  'reconnaît', 'reconnait', 'reconnaissent', 'reconnaissait', 'reconnaissaient',
  'admet', 'admettent', 'admettait', 'admettaient', 'avoue', 'avouent', 'avouait', 'avouaient',
];
export const VERBES_CONNOTES_PRONOMINAUX = /\bse vant(?:e|ent|ait|aient)\b/u;

// forbidden.ts
export function motsInterdits(text: string): string[] {
  const found = new Set<string>();
  for (const w of words(withoutQuotes(cleanText(text)))) {
    const k = foldKey(w);
    for (const r of MOTS_INTERDITS) {
      const hit = r.type === 'exact' ? k === r.motif : k.startsWith(r.motif);
      if (hit && !(r.exceptions ?? []).includes(k)) found.add(w.toLocaleLowerCase('fr'));
    }
  }
  return [...found];
}
export function verbesConnotes(text: string): string[] { /* same loop on NFC-lower words ∈ VERBES_CONNOTES, plus the pronominal regex */ }
```
Verified cases (all pass): `EXTREME`/`extrême`/`l’extrême`/`extrémiste`/`extrêmement` flagged; `populistes`/`populisme` flagged, `population`/`populaire` not; `irresponsable`/`irresponsabilité`; `courageux`/`courage`/`courageusement` flagged, `encouragé` not; `Enfin,` flagged, `Enfinir` not; `extrémité` not; `Il dit « enfin, c’est extrême » puis propose` clean; `Il dit « enfin » puis c’est extrême` flags only `extrême`; verbs: `promet`, `prétend`, `se vante` flagged, `a osé` and `« admet »` not.

### `rules/config.ts` — windows and poll constants (verified)
```typescript
// Fenêtres de blocage (loi 77-808 art. 11) : instants UTC en dur. Paris = UTC+2 aux deux dates (heure d'été depuis le 28 mars 2027).
export const FENETRES_BLOCAGE = [
  { debut: Date.UTC(2027, 3, 16, 22, 0, 0), fin: Date.UTC(2027, 3, 18, 18, 0, 0), libelle: 'du samedi 17 avril 2027 00h00 au dimanche 18 avril 20h00 (heure de Paris)' },
  { debut: Date.UTC(2027, 3, 30, 22, 0, 0), fin: Date.UTC(2027, 4, 2, 18, 0, 0), libelle: 'du samedi 1er mai 2027 00h00 au dimanche 2 mai 20h00 (heure de Paris)' },
] as const; // début inclus, fin exclue
export const fenetreDe = (iso: string) => { const t = Date.parse(iso); return FENETRES_BLOCAGE.find((f) => t >= f.debut && t < f.fin); };
```
Boundary cases that must be in the unit test: `2027-04-16T23:59:59+02:00` not blocked; `2027-04-17T00:00:00+02:00`, `2027-04-16T22:00:00Z` and `2027-04-17T00:00:00+01:00` blocked; `2027-04-18T19:59:59+02:00` blocked; `2027-04-18T20:00:00+02:00` and `18:00:00Z` not blocked; `2027-04-30T23:59:59+02:00` not blocked; `2027-05-01T00:00:00+02:00` blocked; `2027-05-02T19:59:59+02:00` blocked; `2027-05-02T20:00:00+02:00` not blocked; `2027-04-17T10:00:00-04:00` blocked; the fixture date `2026-10-05T08:00:00+02:00` not blocked.

### `ids.lock` format and workflow
```
# ids.lock — identifiants de candidats figés (append-only). Ne jamais renommer ni supprimer une ligne.
# Mise à jour : npm run ids -- --write   |   Vérification : npm run validate (ou npm run ids -- --check)
jean-imaginaire
marie-fictive
```
UTF-8, LF, one id per line sorted by code unit (`a < b`), `#` comments and blank lines ignored, one file per content root (`<contentRoot>/ids.lock`). Rules (all errors, positioned in `ids.lock` at the id line, or at the candidat file for the unlocked case): `ID_VERROUILLE_DISPARU` (locked id not among the listed `candidats` files, which covers rename and deletion), `ID_NON_VERROUILLE` (candidat file whose id is not in the lock; the message says `npm run ids -- --write`), `IDS_LOCK_ABSENT` (candidats exist but no lock file), `IDS_LOCK_INVALIDE` (a line that is not a valid candidat id or an unsorted/duplicate line). `scripts/ids.ts --write` only **appends** new ids (re-sorted) and refuses (exit 1) if a locked id is missing, so the workflow is: add the candidat file, run `npm run ids -- --write`, commit both. Existence check uses `allIds` (listed files), so a candidat file that fails the schema is not reported as "disappeared".

### REGLE-12 key scan (file rule)
```typescript
import { isPair, isScalar, visit } from 'yaml';
// run on every parsed document, even when the schema failed
visit(doc, { Pair(_k, pair) {
  const key = isScalar(pair.key) ? String(pair.key.value) : '';
  if (CHAMPS_NON_IMPORTABLES.includes(key)) {
    const pos = lc.linePos((pair.key as { range: [number, number, number] }).range[0]);
    findings.push({ code: 'CHAMP_NON_IMPORTABLE', pointer: '', message: `le champ « ${key} » du dataset data.gouv ne doit jamais entrer dans src/content/`, at: pos });
  }
}});
```
(`Finding` needs an optional explicit `at: {line, col}` for rules that already hold a position; otherwise the runner uses `pointer`.) A text-level `grep` is rejected (Anti-Patterns).

## Catalogue of codes

| Code | Req | Severity | Tier / where it points | Piège §12 | Notes |
|------|-----|----------|------------------------|-----------|-------|
| `SOURCE_ABSENTE` | 01 | error | Ajv override (mesure, `required: source`) | #1 mesure sans source | line 1 unless `anchor` added |
| `TEXTE_SOURCE_ABSENT` | 01 | error | Ajv override | — | |
| `SOURCE_INCONNUE` | 01 | error | corpus: mesure `/source` | — | skipped if a source file with that id exists but is invalid |
| `SOURCE_NON_PRIMAIRE` | 01 | error | Ajv override on source `/type` | — | press/unknown type |
| `SOURCE_AUTRE_CANDIDAT` | 01 | error | corpus: mesure `/source` | — | `source.candidats` lacks `mesure.candidat` |
| `ARCHIVE_ABSENTE` | 01 | error | Ajv override (source `archive` missing) + corpus (file missing) | — | |
| `ARCHIVE_SHA256_DIVERGENT` | 01 | error | corpus: source `/archive/sha256` | — | raw-bytes hash |
| `ARCHIVE_TROP_VOLUMINEUX` | 01 | error | corpus | — | > 5 MB, optional hardening |
| `ARCHIVE_WAYBACK_ABSENTE` | 01 | error | corpus: source `/archive` | — | only for sources cited by a `publie` mesure |
| `MOT_INTERDIT` | 02 | error | entry: field pointer | #2 mot interdit | stems, accent-folded, outside `« »` |
| `GUILLEMETS_DESEQUILIBRES` | 02 | error | entry | — | closes the unclosed-`«` bypass |
| `VERBE_CONNOTE` | 02 | warning | entry | — | |
| `LONGUEUR_HORS_BORNES` | 03 | error | entry: `/redactions/<niveau>` | — | message gives found/expected |
| `CHIFFRE_HORS_SOURCE` | 04 | error | entry | #6 enfant avec chiffre absent | résumé, enfant, aîné |
| `NOMBRE_LETTRES_HORS_SOURCE` | 04 | warning | entry | — | |
| `CITATION_HORS_SOURCE` | 04 | error | entry | — | every `« »` of every mesure editorial field |
| `TEXTE_SOURCE_HORS_ARCHIVE` | 05 | error | corpus: mesure `/texte_source` | — | skipped if archive unusable |
| `CHIFFRAGE_HORS_ARCHIVE` | 05 | error | corpus: mesure `/chiffrage/texte` | — | closes the laundering hole |
| `TEXTE_SOURCE_TROP_COURT` / `_LONG` | 05 | warning | entry | — | optional anti-gaming guard (< 4 or > 120 words) |
| `PHRASE_ENFANT_LONGUE` | 06 | error if `statut_relecture` is `relu`/`publie`, warning if `brouillon` | entry | — | > 15 words |
| `LISIBILITE_ENFANT_FAIBLE` | 06 | warning | entry | — | KM < 80 |
| `REFERENCE_CASSEE` | 07 | error | corpus: the referencing field | — | candidat, thème, sous-thème, source, glossaire, sondage→candidat, couverture→thème/candidat/sources |
| `ID_VERROUILLE_DISPARU` / `ID_NON_VERROUILLE` / `IDS_LOCK_ABSENT` / `IDS_LOCK_INVALIDE` | 07 | error | corpus | — | see ids.lock section |
| `EQUITE_CANDIDAT_MANQUANT` | 08 | error in production, warning in preview | corpus: theme `/statut_relecture` | — | |
| `EQUITE_COUVERTURE_INCOHERENTE` | 08 | same as above | corpus: couverture `/cases/<i>/etat` | — | `mesures` without published mesure, or other state with one |
| `SONDAGE_NOTICE_ABSENTE` | 09 | error | Ajv override | #3 sondage sans notice | |
| `SONDAGE_SOMME_HORS_BORNES` | 09 | error | entry: `/hypotheses/<i>` | #4 sondage à 112 % | scores + `autres_pct`, hundredths |
| `SONDAGE_TOUR2_EN_TOUR1` / `SONDAGE_TOUR1_EN_TOUR2` | 09 | error | entry | #5 hypothèse 2e tour en 1er tour | see Pitfall 13 |
| `SONDAGE_FENETRE_BLOCAGE` | 09 | error | entry: `/date_publication` | #7 fenêtre de blocage | |
| `SONDAGE_CANDIDAT_DOUBLON` | 09 | error | entry | — | same candidat twice in an hypothesis |
| `CHAMP_NON_IMPORTABLE` | 12 | error | file rule (any depth, any file) | — | |
| `CARACTERE_SUSPECT` | 02 | error | entry | — | optional hardening: bidi controls and non-Latin scripts in editorial text (homoglyph bypass of the word filter) |

Editorial fields scanned (config `CHAMPS_EDITORIAUX`): mesure `titre` and `redactions.{resume,detaille,enfant,aine}`; glossaire `libelle` and `definition`; journal `resume`; thème `nom` and `sous_themes[].nom`. **Exempt:** `texte_source`, `chiffrage.texte`, candidat `parti`, any `source.titre`. The CONTEXT mention of a "résumé de statut" has no corresponding schema field in v1 (statuts carry a code, `motif` enum, date and typed source only); see Open Questions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Calibrate syllables against `textstat` (STACK.md) | Calibrate against Lexique 3.83 `nbsyll` | This research | textstat under-counts (hyphenation proxy); heuristic is 99.2 % exact on the top 5 000 words |
| Text grep guard for `bloc|extdroite|propositions` (PITFALLS.md) | YAML AST key scan | This research | no false positives on the word "propositions" |
| "Apply forbidden-word rule to the 4 rédactions + titre, not to the citation" | Same, plus verify every `« »` span against `texte_source` | This research | removes the guillemet bypass |
| Node 20 / 22 | Node 24 type stripping, `erasableSyntaxOnly` | Phase 1 | rules are plain TS with `.ts` imports; no enums, no parameter properties, no namespaces |

**Deprecated/outdated:** archive.today (never cite); `ajv-cli`; English readability packages (STACK.md "What NOT to Use").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Freezing ~170 `mot:syllabes` facts derived from Lexique 3.83 (CC BY-SA 4.0) in a test file is acceptable under the repo licences; credit Lexique (New et al.) in a comment | Code Examples | Low: facts, tiny excerpt; if Erwan objects, regenerate the table from hand checks |
| A2 | Glossary markers in rédactions are `[[affiché]]` or `[[affiché\|id]]`, id defaulting to the slug of the displayed text; markers are replaced by their displayed text before counting/matching | Open Questions | Medium: Phase 4 renders them; if Phase 4 picks another syntax, only `references.ts` and a preprocessing helper change |
| A3 | `relu` is treated like `publie` for `PHRASE_ENFANT_LONGUE` (error), only `brouillon` downgrades to warning | Catalogue | Low: CONTEXT only specifies `publie` and `brouillon` |
| A4 | `LONGUEUR_HORS_BORNES` is an error for every `statut_relecture` (CONTEXT makes only the 15-word rule status-dependent) | Catalogue | Medium: drafts collected by agents in Phase 3 must already respect lengths |
| A5 | A candidat id missing from `ids.lock` is an error (not only renamed/deleted ones), forcing `npm run ids -- --write` in the same PR | ids.lock | Low: friction only; the Phase 3 importer must call the same append routine |
| A6 | Equity perimeter uses the **last** `statuts[]` entry regardless of its `statut_relecture` (fail-closed) | Equity | Medium: a draft `declare` status blocks a published theme until the candidate has a case or measure |
| A7 | Duel detection in round 1 = exactly 2 scores summing >= 99, or a name matching the second-round regex | Pitfall 13 | Medium: heuristic; thresholds in config, trap + negative fixtures lock behaviour |
| A8 | Blocking window is start-inclusive, end-exclusive (20:00:00 allowed) | Pitfall 10 | Low: one-second ambiguity; spec says "jusqu'à 20h" |
| A9 | GitHub keeps annotation limits at 10 errors + 10 warnings per step (as encoded in Phase 1 `formatGithub`); the fetched docs page did not state a limit | REGLE-11 | Low: only affects how many annotations show; text lines always print |
| A10 | Loi 77-808 art. 11 covers "la veille et le jour de chaque scrutin"; the 00h/20h bounds come from the project spec §6 and CONTEXT, not from the article text `[CITED: legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547]` | Windows | Low: the project spec is the authority for the coded bounds |
| A11 | Case-insensitive, accent-sensitive, punctuation-insensitive comparison is an acceptable meaning of "mot pour mot après normalisation" | Verbatim | Medium: a stricter reading (case/punctuation exact) would reject more quotes; trivial to tighten in `tokens()` |
| A12 | Kandel-Moles stays at threshold 80 and is a warning even though the clean fixture needs an edit to reach it | Pitfall 6 | Low: DIFF-01 owns calibration |

## Open Questions (RESOLVED)

1. **Where does `ids.lock` live and what does it contain?**
   - RESOLVED: `<contentRoot>/ids.lock`, plain text, one candidat id per line, sorted, `#` comments, append-only via `scripts/ids.ts --write`. A header-only file exists at the repo root and a populated one in `corpus-valide`.
2. **Is a candidat id absent from the lock an error?**
   - RESOLVED: yes (`ID_NON_VERROUILLE`); the fix is one command. Phase 3's importer reuses the same append function.
3. **The CONTEXT lists "résumé de statut" among scanned fields; the schemas have none. What is scanned?**
   - RESOLVED: scanned fields are the ones that exist: mesure `titre` + 4 rédactions, glossaire `libelle`/`definition`, journal `resume`, thème `nom`/`sous_themes[].nom`. Status `source.titre` is exempt (it can be a press headline). A future free-text status summary only needs a line in `CHAMPS_EDITORIAUX`.
4. **Which lengths/sentence rules are status-dependent?**
   - RESOLVED: lengths = error for every status; `PHRASE_ENFANT_LONGUE` = error for `relu`/`publie`, warning for `brouillon`; Kandel-Moles = warning always; equity = error in production, warning in preview; everything else not mode-dependent.
5. **Default mode?**
   - RESOLVED: `production` (fail-closed). Resolution order `--mode` > `RTP_MODE` > `production`; invalid value = usage error. CI runs `validate --mode production --format github` explicitly; local authoring uses `--mode preview`.
6. **Glossary marker syntax for `[[terme]]` references (Phase 4 will render it)?**
   - RESOLVED: `[[affiché]]` or `[[affiché|id]]`; without `|id` the id is the slug of the displayed text (NFD-strip accents, lower-case, non-alphanumerics to `-`). A marker whose id has no glossaire entry is `REFERENCE_CASSEE`. Markers are replaced by the displayed text before word counting, readability and word matching. Phase 4 should confirm or adjust.
7. **Is the 80 Kandel-Moles threshold kept given the fixture scores 79.1?**
   - RESOLVED: keep 80 (locked, warning only), edit the fixture sentence (82.6). No threshold change.
8. **Calibrate syllables against textstat as planned in STACK.md?**
   - RESOLVED: no; against Lexique 3.83 (see Pitfall 7). `hyphen` fallback dropped.
9. **Should numbers in `detaille` be checked?**
   - RESOLVED: not as an error (REGLE-04 names résumé, enfant, aîné). Quotes in `detaille` and in every other field are verified; an optional `detaille` number warning is left out of scope.
10. **Does the `ids.lock` need protection against someone deleting a line?**
    - RESOLVED: out of scope for Phase 2 (needs the base branch in CI: `git show origin/main:ids.lock`). The append-only script plus code review is the control; record as a hardening idea in the RUNBOOK.
11. **Trap directory naming for several traps per code?**
    - RESOLVED: `tests/fixtures/pieges/<CODE>/` is the canonical trap; variants use `<CODE>--<variante-en-minuscules>` (e.g. `MOT_INTERDIT--dans-citation-ok`, `EQUITE_CANDIDAT_MANQUANT--preview`).
12. **Must a candidate have a couverture case when they already have a published mesure?**
    - RESOLVED: no (a measure suffices); but when a case exists it must agree both ways (`EQUITE_COUVERTURE_INCOHERENTE`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 via `fnm exec --using=24` | Everything | yes | 24.22.2 (ICU 78.3) | — |
| npm | scripts | yes | bundled | — |
| `typescript` / `tsc` | type-check of new modules (`npm run check` covers `src/**`) | yes | ^6.0.3 in repo | — |
| Python 3 + `textstat`/`pyphen` | research only | yes (throw-away venv) | 3.9.6, textstat 0.7.13, pyphen 0.17.2 | not needed at runtime or in CI |
| Lexique 3.83 (lexique.org) | one-off calibration, optional re-run | downloaded to `/tmp` | 3.83 (2019-06-04), CC BY-SA 4.0 | the frozen table in this document is enough for tests |
| External services, databases, Docker | — | not required | — | — |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` on Node 24.22.2 (native `.ts`), as in `package.json` |
| Config file | none (script: `"test": "TZ=Europe/Paris node --test \"tests/**/*.test.ts\""`) |
| Quick run command | `fnm exec --using=24 node --test "tests/text/*.test.ts" "tests/rules/*.test.ts" "tests/pieges/*.test.ts"` |
| Full suite command | `fnm exec --using=24 npm test` (baseline 335 tests, ~40 s; expect +150-250 tests, trap runner adds one temp-dir copy per fixture) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REGLE-01 | `SOURCE_ABSENTE`, `SOURCE_INCONNUE`, `SOURCE_NON_PRIMAIRE`, `SOURCE_AUTRE_CANDIDAT`, `ARCHIVE_ABSENTE`, `ARCHIVE_SHA256_DIVERGENT`, `ARCHIVE_WAYBACK_ABSENTE` (+ `--brouillon-ok` negative) | trap + unit | `node --test tests/pieges/pieges.test.ts tests/rules/source-archive.test.ts` | Wave 0 |
| REGLE-02 | forbidden stems, accents, elision, quote exemption, `extrémité`, unbalanced `«`, connoted verbs (`osé` not `ose`) | unit + trap | `node --test tests/text/forbidden.test.ts tests/pieges/pieges.test.ts` | Wave 0 |
| REGLE-03 | bounds per level, boundaries 25/26, 79/80, 200/201, 39/40, 60/61, 59/60, 120/121; NNBSP, elision, digit groups | unit + trap | `node --test tests/text/words.test.ts tests/rules/longueurs.test.ts` | Wave 0 |
| REGLE-04 | number extraction/canonical table, `CHIFFRE_HORS_SOURCE` for résumé/enfant/aîné, number words warning, `CITATION_HORS_SOURCE`, chiffrage as extra source | unit + trap | `node --test tests/text/numbers.test.ts tests/rules/chiffres-citations.test.ts` | Wave 0 |
| REGLE-05 | verbatim containment table (pass/fail cases above), `TEXTE_SOURCE_HORS_ARCHIVE`, `CHIFFRAGE_HORS_ARCHIVE`, skipped when archive broken | unit + trap | `node --test tests/text/verbatim.test.ts tests/pieges/pieges.test.ts` | Wave 0 |
| REGLE-06 | syllable frozen table (161 words), KM on fixture >= 80 (82.6), sentence splitting cases, 15 vs 16 words, brouillon vs publie severity | unit + trap | `node --test tests/text/syllables.test.ts tests/text/sentences.test.ts tests/rules/lisibilite.test.ts` | Wave 0 |
| REGLE-07 | `REFERENCE_CASSEE` per reference kind, no cascade from an invalid target, `ids.lock` four codes, `scripts/ids.ts` check/write/refuse | unit + trap + CLI | `node --test tests/rules/references.test.ts tests/rules/ids-lock.test.ts tests/content-core/ids-cli.test.ts` | Wave 0 |
| REGLE-08 | equity both modes, both directions of coherence, perimeter from config, `renonce` ignored | unit + trap | `node --test tests/rules/equite.test.ts` | Wave 0 |
| REGLE-09 | notice, sum 95/105 boundaries incl. decimals, duel vs fixture, mirror rule, window boundaries under several `TZ` | unit + trap | `node --test tests/rules/sondage.test.ts` | Wave 0 |
| REGLE-10 | table-driven trap runner, exact-set match, patch-applies-exactly-once guard, catalogue-vs-fixtures coverage, all 7 §12 traps present | meta | `node --test tests/pieges/pieges.test.ts` | Wave 0 |
| REGLE-11 | CLI on a trap root prints `file:line:col CODE` and `::error file=...,line=N,col=M,title=CODE::`; warnings as `::warning`; exit 1/0; `--mode` usage errors exit 2 | CLI integration | `node --test tests/content-core/validate-cli.test.ts` (extended) | extend existing |
| REGLE-12 | `bloc`/`extdroite`/`propositions` as key at depth 1 and nested, in a file that also fails the schema; the word "propositions" inside a rédaction is clean | unit + trap | `node --test tests/rules/champs.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** the quick command above (target < 15 s).
- **Per wave merge:** `fnm exec --using=24 npm test` plus `npm run validate -- --mode production` on the default root and with `RTP_CONTENT_ROOT=.`.
- **Phase gate:** full suite green, `npm run check` (astro check) green, `npm run build` green, `npm run migrate -- --check` green.

### Wave 0 Gaps
- [ ] `tests/pieges/pieges.test.ts` + `tests/helpers/overlay.ts` (copy, delete, exact-once patch, relativize, exact-set compare, coverage meta-test)
- [ ] `tests/text/{words,sentences,syllables,numbers,verbatim,forbidden}.test.ts` seeded with the cases in this document (including the TZ-spawn test for windows)
- [ ] `tests/rules/*.test.ts` (inline-YAML helper beside `tests/helpers/validate-yaml.ts`)
- [ ] fixture corrections in `tests/fixtures/corpus-valide` (wayback, enfant sentence, `ids.lock`) and the `.invalid` test relaxation for `wayback_url`
- [ ] `.gitattributes` (`archives/** -text`, `tests/fixtures/**/archives/** -text`), root `ids.lock` (header only), `.env.example` line for `RTP_MODE`
- [ ] Optional re-calibration script kept **outside** the repo or under `scripts/dev/` (not in CI): reads Lexique 3.83 TSV, prints exact/within-1 rates; the thresholds asserted in tests are the frozen table only
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Ajv schemas (structure) + rules (content); regexes written to be linear (`[^«»]*`, bounded `\d{1,3}`); contributor text never concatenated into annotation lines except through `escapeData`/`escapeProperty`/`safe` |
| V6 Cryptography | yes (integrity only) | `node:crypto` SHA-256 over raw archive bytes; never hand-rolled |
| V12 Files and Resources | yes | `archive.extrait` pattern forbids `..`; `checkContained`/`readContained` (symlink refusal, realpath containment); size cap before reading; no network access in rules |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal / symlink via `archive.extrait` or `ids.lock` | Tampering / Information disclosure | schema pattern + `checkContained` + `lstat`; refuse non-regular files |
| Workflow-command injection through a finding message (`::stop-commands::` in an offending word) | Tampering | existing `safe()` + `escapeData`; truncate quoted text to <= 60 chars |
| Bypass of the neutrality filter with guillemets, unclosed `«`, zero-width characters, Cyrillic/Greek homoglyphs | Tampering (editorial integrity) | verify every `« »` span against `texte_source`; `GUILLEMETS_DESEQUILIBRES`; `INVISIBLE` stripped before matching; optional `CARACTERE_SUSPECT` for bidi controls and non-Latin scripts |
| Laundering an invented figure through `chiffrage` | Tampering | `CHIFFRAGE_HORS_ARCHIVE` |
| ReDoS on long contributor text | Denial of service | no nested quantifiers; archive size cap; per-archive haystack cache |
| Archive swapped after review | Tampering | sha256 in the source file, byte-exact (`.gitattributes -text`), plus Wayback URL as independent timestamp |
| Silent loosening of rules in preview | Elevation of privilege (process) | default mode `production`; only equity is mode-dependent; CI pins `--mode production` |

## Project Constraints (from CLAUDE.md)

The repo `CLAUDE.md` is generated from PROJECT.md and STACK.md; its actionable directives, all honoured by this research:
- Tech stack: Astro static, YAML in Git validated by JSON Schema in CI, no database, no server framework.
- Neutrality: forbidden words (« extrême », « populiste », « irresponsable », « courageux », « enfin »), label claimed by the candidate, candidate's own costing only.
- Sourcing: primary source only (never press), consultation date, archived copy in the repo.
- Equity: same level of detail for every declared candidate on a published theme.
- Dependencies: every added dependency justified in writing in the PR; **this phase adds none**.
- Do not use: `ajv-cli`, `js-yaml`, English readability libraries (own Kandel-Moles + French syllable heuristic), `z.fromJSONSchema()`.
- Node 24, TypeScript run natively (`erasableSyntaxOnly`), `.ts` import extensions, `node:test`.
- GSD workflow enforcement: file edits go through a GSD command (`/gsd-execute-phase` for this phase).
- User global instructions (`~/.claude/CLAUDE.md`): pushed to Git within the hour, French messages, ARCHITECTURE.md/RUNBOOK.md kept current (plan 02-08 updates both), measurable success criteria per task.

## Sources

### Primary (HIGH confidence)
- Local codebase (read 2026-11-03): `src/lib/content-core/{load,diagnostics,ajv,collections,root,astro-loader}.ts`, `scripts/validate.ts`, `tests/helpers/validate-yaml.ts`, `tests/content-core/*.test.ts`, `schemas/*.schema.json`, `schemas/defs/common.schema.json`, `tests/fixtures/corpus-valide/**`, `.github/workflows/ci.yml`, `package.json`, `tsconfig.json`.
- Local executions on Node 24.22.2 / ICU 78.3: `Intl.Segmenter` behaviour on elisions, six space types, digit groups, sentences; prototypes of all text modules under four time zones; spike of `OVERRIDES` entries on the real `validateYamlText`; baseline `npm test` = 335 pass.
- textstat 0.7.13 source (PyPI package inspected in a venv): `backend/utils/constants.py` (French constants 207 / 1.015 / 73.6) and `backend/counts/_count_syllables.py` (pyphen positions + 1).
- Lexique 3.83 (New, Pallier et al., lexique.org, CC BY-SA 4.0): `nbsyll` column used as syllable ground truth.
- Project spec `docs/spec/CAHIER-DES-CHARGES.md` §5, §6, §7, §12.

### Secondary (MEDIUM confidence)
- Légifrance, article 11 of loi n° 77-808 du 19 juillet 1977 (veille et jour du scrutin): https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547 ; Commission des sondages: https://www.commission-des-sondages.fr/lois/lois.htm
- GitHub Docs, workflow commands (parameters of `::error`: file, line, col, endLine, endColumn, title): https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions

### Tertiary (LOW confidence)
- Readability band interpretation (what a Kandel-Moles of 80 means for CM1): carried over from `.planning/research/STACK.md` as LOW; not used to gate anything.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependency; everything verified in the repo or on Node 24.22.2.
- Architecture: HIGH for the integration (read against the real `loadAll`, spiked `OVERRIDES`), MEDIUM for the exact module split (discretionary).
- Text layer: HIGH, executed and measured (98.7 % / 99.2 % against Lexique; all utility cases pass in four time zones).
- Pitfalls: HIGH for the fixture/test breakages (reproduced), MEDIUM for severity defaults listed in the Assumptions Log.

**Research date:** 2026-11-03
**Valid until:** 2026-12-03 for the text layer (re-run the canary tests on any Node/ICU bump); the poll window constants are fixed by law and the 2027 calendar.
