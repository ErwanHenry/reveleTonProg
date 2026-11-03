# Project Research Summary

**Project:** reveleTonProg
**Domain:** Static, neutral, sourced civic reference site for the French 2027 presidential election (Astro 7 static output, YAML content in Git, JSON Schema + editorial rules enforced in CI, 4 reading levels: résumé, détaillé, enfant 8-12, aîné 65+)
**Researched:** 2026-11-03
**Milestone in scope:** v1.0 = Lot 1 (schemas, data, CI validation) + Lot 2 (M1 theme/candidate pages, level toggle, Méthode/Mentions/Qui sommes-nous)
**Confidence:** MEDIUM-HIGH overall. Tooling, versions and Astro internals: HIGH (npm registry, package source, official docs). data.gouv dataset: HIGH (file downloaded and inspected). Legal texts: HIGH (Legifrance, CNIL opened). Competitor UX and neutrality track record: MEDIUM. French readability thresholds and a few browser a11y details: LOW-MEDIUM.

## Executive Summary

reveleTonProg is a content product with a thin code layer. A small static site renders a Git-versioned corpus, and the hard engineering sits in the **validation gate**, not in the UI. The 2027 field already has several "neutral, sourced" comparators (2027etmoi, votons-2027, repere2027, quiproposequoi2027, IFRAP). Most of them do things our spec forbids: press as a measure source, grouping candidates by political bloc, picking candidates by poll, visitor votes, affinity quizzes, silently leaving out candidates with no position. None offers kid and senior versions of the same measure, archived source copies, or typed empty cells with a "checked on" date. That makes the neutrality rules themselves the differentiator, as long as they are **machine-enforced and visible** (CI gate plus a Méthode page generated from the same config).

The recommended build is boring on purpose, with very few dependencies:
- **Runtime and core packages:** Node 24 LTS, Astro 7.4 (static, zero JS), Ajv 8 (JSON Schema 2020-12), and `yaml` 2.9, which is already shipped by Astro.
- **Dev dependencies (5):** Playwright, axe, `@astrojs/check`, TypeScript 6, `@types/node`.
- **Everything else is Node stdlib:** `node:test`, `Intl.Segmenter`, `node:zlib`, `node:crypto`.
- **Validation:** JSON Schema files are the single source of truth. One framework-free `content-core` module (parse, Ajv, editorial rules, corpus rules) is called both by the CI validator and by a custom Astro loader, so invalid data cannot reach a build.
- **Level toggle:** native radio inputs plus `:has()` on a scoped wrapper. It works without JS. A tiny classic script restores the localStorage choice before first paint.
- **Candidate order:** alphabetical at build time (French collation, explicit `nom_tri`). Random order is a JS DOM shuffle on demand; without JS the order stays alphabetical.
- **Equity:** explicit `couverture` records. A theme cannot be published until every in-scope candidate has a published measure or a dated, reviewed empty state.

The main risks are not technical:
1. **Importing the data.gouv "statuts sourcés" dataset as-is.** It carries the editorial `bloc` field (including `extdroite`), unsourced `propositions`, press-only status sources, a status vocabulary that differs from the spec, bare-surname ids, and 59 rows where its own description says 51.
2. **An almost empty pilot.** Only 6 of 37 declared candidates have a published programme, so layout and coverage can read as bias.
3. **Agent-collected content that paraphrases quotes or adds numbers.**
4. **Legal exposure** from the mentions légales (publisher home address under LCEN art. 1-1), copyright on archived programme PDFs in a public repo, and unreviewed drafts leaking onto a public preview URL.
5. **Page weight.** The no-JS toggle ships all 4 versions of every measure in the HTML. On Slow 4G (1.6 Mbps) 500 KB takes about 2.5 s, so the binding target is **< 1 s on 4G, which means about 100 KB gzip**, not the literal 500 KB.

Every one of these has a concrete mitigation below, and most of them land in Lot 1 schemas and CI rules. Several need a decision from Erwan before schema v1 is frozen (see "Decisions needed").

## Key Findings

### Recommended Stack

Target footprint: **3 runtime dependencies (`astro`, `ajv`, `yaml`, with `yaml` already transitive via Astro, so 0 extra bytes) plus 5 dev dependencies.** Each has a one-line PR justification ready in STACK.md. Node stdlib covers tests, word counting, page weight, hashing and CI annotations.

**Core technologies:**
- **Node.js 24 LTS (floor `>=24.12`):** runtime for build, validator and tests.
- Node 20 (Erwan's default) has been EOL since 2026-04-30 and cannot run Astro 7.
- Node 22 reaches EOL on 2027-04-30, between the two rounds.
- Node 24 runs `.ts` natively (stable type stripping), so no `tsx` is needed.
- The local machine runs v22.23.3, which is below Astro's floor: **upgrade required**.
- **astro ^7.4.5:** imposed by the spec. Static output, content layer, zero JS by default.
- Set `compressHTML: true`. The v7 default `'jsx'` deletes whitespace between inline elements, which would glue French words to glossary buttons and links.
- Also set `prefetch: false`, `build.inlineStylesheets: 'auto'`, and the passthrough image service (avoids the `sharp` dependency).
- **ajv ^8.20.0 (`ajv/dist/2020.js`):** JSON Schema 2020-12 with `if/then`, needed for "enfant/aîné required when `publie`". Strict mode, `allErrors`.
- Write the 3 custom formats ourselves (`date`, `date-time`, `https-url`) instead of adding `ajv-formats`.
- **yaml ^2.9.1:** the same parser Astro uses. `LineCounter` maps JSON pointers to line numbers for `::error file=…,line=…` PR annotations.
- **Dev:** `@playwright/test` ^1.64 (no-JS mode, keyboard, 4G CDP throttling, page weight, also the HTML-capture tool for source archiving), `@axe-core/playwright` ^4.14 (WCAG 2.2 AA), `@astrojs/check` ^0.9.12 + `typescript` **^6** (not 7: peer range), `@types/node` ^24.
- **Do not add:** Lighthouse CI, pa11y, vitest, Tailwind or any UI framework, `js-yaml`, `ajv-cli`, English readability libraries, any CDN font or analytics, `z.fromJSONSchema()`, or legacy `src/content/config.ts`.
- **CI:** GitHub Actions `checkout@v7`, `setup-node@v7` (`.nvmrc` = 24), actions pinned by SHA, Dependabot with cooldown, `permissions: contents: read`, `TZ=Europe/Paris`.

### Expected Features

The data.gouv dataset (2027etmoi, Licence Ouverte 2.0, file dated 2026-10-28) has **59 personalities**: 37 `declare`, 17 `renonce`, 5 `pressenti`. Only 6 of the declared candidates link to a programme, so most cells in the pilot will be explicit empty states. Status sources point overwhelmingly to press. One date is partial (`YYYY-MM`).

**Must have (table stakes for v1.0):**
- Theme → candidates pages (3 pilot themes) and candidate → themes pages (all 59 personalities), cross-linked.
- A primary source per measure: source type, title, publication date, consultation date, original link, archived copy.
- Candidate status badge in text (never colour alone), with date and source. The party label is the one the candidate claims, imported verbatim.
- Explicit typed empty states with a "vérifié le" date, never silent omission: `programme_non_publie`, `non_precise`, and internal `a_verifier`.
- Alphabetical order by `nom_tri` with French collation ("de Villepin" sorted at V).
- Méthode page. Mentions légales citing **LCEN art. 1-1** (post-SREN), not art. 6. Qui sommes-nous with a funding statement.
- An error-report link on every measure (mailto + GitHub issue, measure id pre-filled).
- A "last updated" date per page, mobile-first single column, keyboard and screen-reader-accessible toggle.
- A glossary (it feeds the Enfant definitions and party explanations).
- Licence Ouverte attribution for the 2027etmoi data.

**Should have (differentiators, all in v1.0 scope per spec):**
- The 4-level toggle without JS, with the choice remembered (D1).
- Aîné level: larger type (≥ 20 px body, targets ≥ 44 px) plus a « ce qui me concerne » block of priority themes (D2).
- Enfant level: « explique-moi » definitions that open on tap and focus, never on hover only (D3).
- An archived copy of every source (D4) and typed empty states with dates (D5).
- **An equity gate in CI (D6).** No competitor enforces this mechanically.
- Transparent random order on demand (D7), with the `ordre_cc` field reserved for the Conseil constitutionnel order (expected mid/late March 2027).
- A visible neutrality charter (D8), the candidate's own costing labelled as such (D9), open code and data (D11).
- Readability reported in CI (D13, as a warning, see the decisions below).

**Defer (v1.x and later):**
- Print CSS (D12): almost free, so it can slip into Lot 2 if time allows.
- A blocking readability gate, once calibrated.
- The CC ordering option (after the official list) and a teachers' page.
- M2 polls, M3 game, M4 comparator, M5 journal, M6 votes, audio: lots 4-7.
- The electoral-silence content freeze (lot 5), but **record the windows in config now**.

**Anti-features (never build):** affinity quiz or profiling, visitor votes, ordering or selection by polls, grouping by bloc, party colours on candidates, poll averages on candidate lists, evaluative content (forces/faiblesses, faisabilité), press as a measure source, red or alarm colour for "no position", deleting withdrawn candidates, third-party embeds, fonts or analytics, press photos, publishing AI text without human review, hidden deterministic tie-breaks.

### Architecture Approach

Data flows strictly one way:

```
YAML in src/content/** + archives
→ Gate 1: content-core (parse → Ajv structure → entry rules → corpus rules, diagnostics with line numbers)
→ Astro build (custom loader re-runs content-core; corpus view-model filters, sorts and shapes cells)
→ Gate 2: check-dist (weight, external resources, forbidden words in final HTML,
          every .mesure has a dated source, inline-space check, .cellule count = candidates)
→ Playwright/axe e2e
→ dist/ artifact
```

Nothing at runtime writes content. The lot-5 collector will just be another PR author upstream of Gate 1.

**Major components:**
1. **`schemas/*.schema.json`** (repo root): the single structural source of truth. Draft 2020-12, URN `$id`s, a `version_schema` const per collection, `CHANGELOG.md`. It is a public contract that a Python collector could reuse.
2. **`src/lib/content-core/`:** framework-free TypeScript with no `astro:*` imports. It holds `load.ts` (the single parse path), `ajv.ts`, `diagnostics.ts`, `rules/*` and `config.ts` (forbidden words, length bounds, statuses in equity scope, blocking windows). It is shared by CLIs, tests and the Astro loader.
3. **`scripts/`:** thin CLIs: `validate` (`--mode preview|production`, `--format github`), `migrate` (`--check|--write`, using the yaml Document API so comments survive), `check-dist`, `import-datagouv`, `archive-source`, `couverture-stub`, `check-weight`.
4. **`src/content.config.ts`:** collections loaded through content-core (see the resolution below). No field-level Zod schema, and **no reliance on `reference()`**, which is log-only in Astro 7.
5. **`src/lib/corpus/`:** a memoized `getCorpus()`. It is the only place that reads `RTP_MODE` (preview shows brouillon with badges, production shows `publie` only), sorts with `Intl.Collator('fr')`, and builds `cellule(candidat, theme)`. **Pages never call `getCollection` directly, and they iterate candidates, never measures**, so a candidate can never vanish from a theme page.
6. **Components:** `LecteurNiveaux`, `Mesure`, `Cellule`, `SourceCitation`, `TexteEnfant` (parses `[[terme]]`), `OrdreCandidats`, `BadgeBrouillon`. All render only. Two classic scripts in `public/js/` (`niveau.js`, `ordre.js`) stay under 2 KB each and are never required for reading.
7. **`tests/`:** `node:test` unit tests per rule, plus **trap fixtures as overlays** on a minimal fictional `corpus-valide` (each trap = 1-2 files + `attendu.json`), migrations before/after, dist checks, Playwright e2e.

**Researcher disagreements, resolved:**

| Topic | STACK says | ARCHITECTURE / PITFALLS say | Resolution and why |
|---|---|---|---|
| Bridging JSON Schema into Astro | Thin hand-written Zod mirror for types + drift test (`z.toJSONSchema()` keys ⊆ JSON Schema keys); custom object loader | `z.unknown().transform()` calling the same Ajv + `json-schema-to-typescript` for generated types | **Custom Astro object loader that calls `content-core` (parse + Ajv) and throws aggregated diagnostics. No field-level Zod at all. Hand-written TS interfaces for the view-model only.** Reasons: (1) a single validator, so zero rule drift; (2) a single parse path, because our loader parses with `schema: 'core'` **without** the `timestamp` tag, so Astro never parses these files. That removes the `normalizeDates` + parity-test machinery the `glob()` approach needs; (3) **zero added dependencies**. `json-schema-to-typescript@16.0.0` was checked on npm today: it pulls `prettier`, `lodash`, `js-yaml@^5` (a second YAML parser STACK explicitly bans) and a ref parser, which is hard to justify under the per-dependency PR rule. Type drift is low-stakes because types validate nothing, and `astro check` plus the dist checks catch misrendered fields. Revisit generated types only if the hand-written interfaces become painful. |
| Formats | Own `addFormat` (3 formats) | `ajv-formats` | **Own formats.** Fewer dependencies, and a stricter `https-url`. |
| Candidate ids | Reuse the dataset slugs (`le-pen`) | Own `prenom-nom` slug + Wikidata QID + `ids.lock`; upstream id under `ids_externes.2027etmoi` | **Own `prenom-nom` ASCII slugs**, frozen at creation, upstream id kept as an external id. Bare surnames (`philippe`, `bertrand`, `martin`) will collide with homonyms. CI fails when an id is renamed or removed. |
| Status shape | Flat `statut` + date + source | Append-only `statuts[]` history | **Append-only history in schema v1.** December 2026 is crowded: the Écologistes referendum on 10-13 Dec, Hollande's and Bertrand's decisions. Le Pen's appeal ruling may follow the CC list. Migrating mid-campaign would cost more. |
| Partial dates (`YYYY-MM`) | Accept in brouillon, require a full date for publie | Schema requires `YYYY-MM-DD`; importer flags | **Accept `YYYY-MM` only when `statut_relecture: brouillon` (`if/then`); a full date is required for `publie`.** This keeps the import lossless without publishing imprecision. |
| `:has()` unsupported | — | ARCH: show all 4 levels with visible labels; PITFALLS: résumé + others in `<details>` | **ARCH's approach.** Content stays complete with no extra markup, and `:has()` has been Baseline since Dec 2023. Verify manually on Safari 15.x / an old iPad. |
| Level restore script | — | ARCH: classic same-origin script right after the fieldset; PITFALLS: inline `<head>` script | **Classic `<script is:inline src="/js/niveau.js">` after the fieldset.** It runs before the content paints, needs only CSP `script-src 'self'`, and requires no hash bookkeeping. Add `autocomplete="off"` on the radios and a `pageshow` re-sync for bfcache. |
| Enfant definitions | FEATURES: anchor to an on-page glossary, enhanced to popover | ARCH: Popover API (one per mesure); PITFALLS: `<details>` or button, define once per page | **Popover API (declarative, no JS, Baseline 2025) with one `<span popover>` per term per page** (several buttons can target the same id), plus a visible "Mots expliqués" list at the end of the Enfant level as a fallback for older browsers and for print. Use a dotted underline plus an icon, distinct from links. |
| Forbidden words in final HTML | ARCH: scan all of dist, including Méthode | PITFALLS: Méthode must list the words, so exempt it | **Scan all of dist, but exempt elements marked `data-liste-mots-interdits`** (the Méthode list, generated from `config.ts`). Editorial-field scan exempts `texte_source` and `« … »` quoted spans. |
| Readability | ≥ 80 Kandel-Moles = warning in brouillon, **block** in publie, + hard 15-word sentence rule | FEATURES: same; PITFALLS: warning only, never gate | **Score = warning only in v1.0** (the threshold is LOW confidence, uncalibrated, and gameable by dropping a measure's conditions). **Sentence length ≤ 15 words in `enfant` = error for `publie`** (deterministic and actionable). Promote the score to a gate after calibration on Vikidia. |
| Brouillon in builds | ARCH: preview mode with badges is the "URL de test", otherwise the site is empty | PITFALLS: drafts must never be public | **Both:** a `RTP_MODE=preview` build shows everything with « brouillon, non relu » badges. It is delivered as a **CI artifact or local preview, not a public host**. If ever hosted: `noindex` + `X-Robots-Tag` + basic auth. The production build excludes brouillon, and a trap draft must be absent from `dist/` (test). |

### Critical Pitfalls

1. **Importing the data.gouv dataset as-is.** Go through `scripts/import-datagouv.ts`:
 - **Drop `bloc` and `propositions`.** Split names by hand into `prenom`, `nom`, `nom_tri` (« Dominique de Villepin », « Jean-Luc Mélenchon »).
 - Snapshot the JSON with its sha256 and `mise_a_jour` under `data/import/`. Never hot-link.
 - Never assert a row count; reconcile 59 vs 51 on the Méthode page.
 - Type every status source (`candidat|parti|institution|presse`). Press is allowed for statuses only, visibly labelled, and is upgraded to a primary source when one exists. Never for measures.
 - Party label from the candidate's own statement, with `parti_source`.
 - Each refresh becomes a diff PR (palier B).
 - Grep guard in CI: `extdroite|bloc|propositions` in `src/content/` = 0.
2. **Invented quotes and added numbers in agent-collected content.**
 - `texte_source` must appear verbatim, after normalization (NFC, `’`→`'`, NBSP, whitespace), in the **archived text extract**.
 - Every `« … »` in `détaillé` must be ⊆ `texte_source`.
 - Every digit-based number in résumé, enfant and aîné must be ⊆ `texte_source`/`chiffrage` (`CHIFFRE_HORS_SOURCE`). French number words only give warnings.
 - Aîné states only effects the candidate states, otherwise « le candidat ne précise pas ».
 - `source.auteur` (`candidat|parti_du_candidat|coalition`): a party platform counts for a candidate only with a dated endorsement.
3. **The equity rule deadlocks publication, or « non précisé » becomes an unsourced claim.**
 - Use explicit `couverture/<theme>.yaml` records: `etat` + `verifie_le` + `verifie_par` + `sources_consultees`.
 - The CI corpus rule checks consistency both ways: `mesures` ⇒ ≥ 1 published measure, other states ⇒ none.
 - Severity follows the mode (errors in production, warnings in preview).
 - `couverture-stub` generates cases for a newly declared candidate.
 - Display « Non précisé dans les sources consultées le JJ/MM/AAAA (voir lesquelles) ».
 - Equity scope stays config-driven (see the decisions below).
4. **A nearly empty site whose layout favours early publishers.**
 - Fixed-size candidate cards: the first measure plus « N autres mesures ». Never show measure counts as a score.
 - A coverage line at the top (« 12 candidats sur 37… au 3 nov. »).
 - A collapsed « Ont renoncé ou ont été éliminés » section.
 - **Pick the 3 pilot themes by measured primary-source coverage**, and say so on the Méthode page.
 - No photos in v1.0. Use an identical neutral pictogram for everyone.
5. **Legal and storage exposure.** These must be decided in Lot 1/2, because recovery is expensive:
 - **Mentions légales:** LCEN art. 1-1 I.1° requires an individual publisher's home address and phone number. Use the art. 1-1 II non-professional option or get a lawyer check. Use a dedicated contact alias, and write a 3-day right-of-reply procedure in RUNBOOK.md. Generate host details from `config/hebergeur.yml`, so a preview host is never misnamed as Hetzner.
 - **Archives:** a full programme PDF in a public repo is reproduction, not « courte citation » (CPI L.122-5). Removing it after the repo goes public requires `git filter-repo`, which is HIGH cost. archive.today was blacklisted by Wikipedia (20 Feb 2026, altered captures), so never use it.
 - **Privacy:** localStorage counts as a tracker under art. 82 LIL, but it is exempt as interface personalisation **only if it stores nothing but the level and order modes**.
 - **Third-party resources:** zero third-party resource loads, checked on `dist/`.

Also important: churn in December 2026 statuses (history array, `verifie_le` staleness warning at 14 days); forbidden-word matching that is too naive (lemma prefixes `extrêm*`, `populis*`, `irresponsab*`, `courage*`, `enfin` exact, after NFC + lowercasing, plus a warning list of loaded verbs: promet, prétend, assure, ose…); ordering bugs (use `Intl.Collator('fr', {sensitivity:'base'})` everywhere; Fisher-Yates with `crypto.getRandomValues`; chi-square uniformity test; never a build-time "random" order); Astro 7 `compressHTML` whitespace loss; timezone drift (`TZ=Europe/Paris`); a Méthode page that drifts from practice (generate its numbers and lists from `config.ts`); public Git history at launch (professional review comments only, gitleaks from Lot 1).

## Decisions Needed (Erwan)

These are blocking for schema v1 or for Lot 2 pages. Each has a recommended default the roadmap can assume until Erwan says otherwise. Each one becomes a short ADR in `ARCHITECTURE.md` (hygiene rule 4).

| # | Decision | Options | Recommended default | Why | Blocks |
|---|---|---|---|---|---|
| D-1 | **Status vocabulary: spec « retiré » vs dataset `renonce`** | (a) Spec codes `declare, en_primaire, pressenti, retire, empeche`; (b) dataset codes `declare, primaire, pressenti, empeche, renonce` | **(b) Store the 5 dataset codes** (lossless import, upstream diff stays trivial). Display `renonce` as « Ne se présente pas ». Add a required `motif` enum for `renonce` (`retrait`, `elimine_primaire`, `ralliement`, `non_candidat`), filled by hand from `statut_detail`. ADR records the divergence from the spec wording. | Calling Faure, Guedj, Royal or Maurel (eliminated in the PS primary) « retiré » would be inaccurate. `motif` gives the spec's precision without lying. | Phase 2 (schema) |
| D-2 | **Equity scope: which statuses must be covered before a theme is `publie`** | `declare` only; `declare` + `primaire`; all incl. `pressenti` | **`declare` + `primaire`**, set in `config.ts` | No `primaire` entries exist today, so it costs nothing now, and it is the defensible neutral reading during a primary. Including `pressenti` would let a wave of rumours block publication. Pressentis still get candidate pages. | Phase 3 (equity rule) |
| D-3 | **Press as a status source** | Forbidden; allowed and labelled; allowed with `a_recouper` | **Allowed for statuses only, with `source.type: presse` shown on the badge**, upgraded to a candidate, party or Conseil constitutionnel source when available. Never for measures. | Without it, most of the 59 statuses would have no displayable source today. The spec already treats press as an « indice pour les statuts ». | Phase 2 |
| D-4 | **Mentions légales: publisher identification** | (a) Full art. 1-1 I (name, home address, phone); (b) art. 1-1 II non-professional (host identity only, name given voluntarily); (c) postal domiciliation address | **(b)**: « Éditeur et directeur de la publication : Erwan Henry », host identity in full, a dedicated contact alias, **no home address**, right-of-reply procedure. A lawyer check is recommended before the public launch (Lot 3). | Avoids harassment risk on a political site during a presidential campaign. Only valid if the site carries **no freelance promotion, donation link or client branding**. (c) is LOW confidence as a valid « domicile ». | Phase 7 (pages); Lot 3 final |
| D-5 | **Node 24 upgrade** | Node 20 (default stack), 22, 24, 26 | **Node 24 LTS**: `.nvmrc` = 24, `engines >=24.12`, `engine-strict`. Upgrade the local machine (currently 22.23.3) | 20 is EOL and cannot run Astro 7. 22 reaches EOL between the two rounds. 26 is too fresh. Record it as a project exception to Erwan's Node 20 default. | Phase 1 |
| D-6 | **Page-weight definition (« < 500 Ko par page »)** | Transferred (compressed); decoded (raw); both | **Gate both in CI:** raw HTML + same-origin assets ≤ 500 KB (the spec's literal rule, audio excluded) **and** gzip ≤ 100 KB, plus a Playwright Slow-4G test (150 ms RTT, 1.6 Mbps) with `load` < 1 s on the heaviest pages, served gzip-compressed. | The 1 s on 4G target is the binding one: 500 KB takes about 2.5 s. Pilot theme pages are estimated at 150-450 KB raw and 30-120 KB compressed, so watch them from the first page. If raw approaches the cap late in the campaign, split by sous-thème rather than lazy-load with JS. | Phase 5 (check-dist) |
| D-7 | **Extra collections beyond the spec's five** (`sources`, `couverture`, `glossaire`, `partis`) | Accept all / some / none | **Accept `sources`, `couverture`, `glossaire`; fold `partis` into `glossaire` as `type: parti`** with a required source to the party's own self-description. `absences` (PITFALLS) = `couverture` (same concept, one name). | `sources`: one programme backs about 30 measures (one archive, one hash, one re-check). `couverture`: makes equity auditable. `glossaire`: makes Enfant definitions and party explanations validatable and identical for everyone. A fourth collection adds no value over a typed glossary entry. | Phase 2 |
| D-8 | **Archive storage and licensing** | (a) Full binaries in the main repo (spec literal); (b) text extract + hash + Wayback URL in the public repo, binaries in a private companion repo or the VPS; (c) hash only | **(b), decided now:** commit `archives/<candidat>/<sha12>.txt` (plain-text extract, used by the quote CI) + sha256 + capture timestamp + Internet Archive SPN URL. Store the PDF / rendered single-file HTML in a private `reveleTonProg-archives` repo. `LICENSE` excludes `archives/` and candidates' texts (« droits réservés à leurs auteurs, reproduits à titre de preuve et de citation »). Per-file cap 5 MB. Publish a takedown contact. | It avoids a history rewrite before going public, avoids copyright exposure and keeps repo size and the VPS disk (90 %) under control, while still proving what was published on the consultation date. It diverges from the spec's « copie archivée dans le dépôt », so ADR it. | Phase 4 (archive tool); Phase 2 (source schema fields) |
| D-9 | **Project licences** | MIT / EUPL for code; Licence Ouverte 2.0 / CC BY for content | **Code MIT** (or EUPL if Erwan prefers a French/EU licence); **own editorial content Licence Ouverte 2.0** (matches upstream data); archives excluded | Needed before the repo goes public. 2027etmoi's code has no licence, so an open one is a credibility edge. | Phase 1 (LICENSE file) |
| D-10 | **Readability gating** | Block in publie; warning only | **Kandel-Moles = warning only; enfant sentences ≤ 15 words = error for publie** | See the resolution table above | Phase 3 |
| D-11 | **Random-order persistence** | Per page; remembered across pages | **Remember the mode** (`rtp:ordre = aleatoire`), never a permutation; reshuffle on every load | Interface personalisation, so CNIL-exempt. Consistent with the level memory. | Phase 6 |
| D-12 | **Photos** | Commons photos where available; none | **None in v1.0** (ADR) | Uneven availability across 59 people is a visible neutrality failure. Personality-rights and attribution debt. | Phase 6 |
| D-13 | **Pre-launch Git history** | Publish as-is; squash | Defer to Lot 3, but **adopt the convention now**: no informal review comments in content files; gitleaks in CI | Recovery is cheap only if the convention starts at commit 1 | Phase 1 |

## Implications for Roadmap

Calendar context: started 2026-11-03. The spec milestone puts lots 1-3 before **2026-12-15**, which leaves about 6 weeks for v1.0 plus Lot 3. Status churn peaks around **10-13 Dec 2026**, so the status-history schema and the import diff workflow must exist before then.

Critical path: **schema v1 → content-core → rules.** Real data entry can run in parallel with rule work once schemas are frozen. Lot 2 UI can be built against the fictional `corpus-valide` fixture before any real content is reviewed.

### Phase 1: Toolchain scaffold and project hygiene
**Rationale:** Everything depends on the runtime and CI skeleton. Erwan's hygiene rules require the repo, README, ARCHITECTURE.md (Mermaid + ADRs) and RUNBOOK.md from the first hour.
**Delivers:**
- Repo setup: Node 24 (`.nvmrc`, `engines`, `engine-strict`), Astro 7 static config (`compressHTML: true`, `prefetch: false`, passthrough images, `trailingSlash`), `tsconfig` (strict + `erasableSyntaxOnly`), npm scripts contract.
- CI skeleton: `ci.yml` with SHA-pinned actions, `TZ=Europe/Paris`, `permissions: read`, Dependabot with cooldown, gitleaks.
- Docs: `LICENSE` (D-9, with the archives carve-out), README (5 questions), ARCHITECTURE.md with ADRs for D-1…D-13 as accepted defaults, RUNBOOK.md stub (incl. the right-of-reply procedure placeholder).
- Pushed to GitHub (private).
**Addresses:** the foundation for everything else.
**Avoids:** Node EOL mid-campaign (D-5), Astro 7 whitespace loss, supply-chain risk, secret leaks before going public.

### Phase 2: Schemas v1 and content-core (Lot 1a)
**Rationale:** Field names are the critical path, since every rule, template and import depends on them. Freeze v1 early, and expect one migration before Lot 2 ends.
**Delivers:**
- `schemas/` (draft 2020-12, URN `$id`s, `version_schema`, `defs/common`) for `candidat`, `theme`, `mesure`, `source`, `couverture`, `glossaire` (with `type: terme|parti`), `sondage` and `journal`. `sondage` and `journal` are schema + trap rules only.
- Key modelling points:
- append-only `statuts[]` with `motif`;
- typed status `source.type`;
- `ids_externes`, `wikidata`, `prenom`/`nom`/`nom_tri`;
- `ordre_cc` reserved;
- measure source type enum, primary only;
- `source.auteur`;
- `chiffrage`, `texte_source`, `contexte_legal` source;
- `statut_relecture` with an `if/then` making enfant/aîné and full dates required for `publie`;
- an archive block (txt path, sha256, captured_at, wayback_url);
- `theme.prioritaire_aine`.
- `content-core`: `load.ts` (yaml core schema, no timestamp tag, `uniqueKeys`), `ajv.ts` (own 3 formats), `diagnostics.ts` (pointer → line, `--format github`).
- `scripts/validate.ts`, the minimal fictional `corpus-valide` fixture, the migration runner with one fixture migration, and `migrate --check` in CI.
**Uses:** ajv, yaml, `node:test`.
**Implements:** the schema registry, content-core, the CLI layer.
**Avoids:** the dataset vocabulary trap (D-1), id instability, overwritten status history, two schema languages, YAML Date/string mismatch.

### Phase 3: Editorial and corpus rules plus trap suite (Lot 1b, the Lot 1 deliverable)
**Rationale:** The Lot 1 deliverable is "CI refuses a measure with no source, and the other applicable data traps". Write the trap fixtures **before** the rules (TDD), because they are the acceptance test.
**Delivers:**
- French text utilities: `Intl.Segmenter` + elision split, digit-group merge, abbreviation list.
- Entry rules:
- `SOURCE_ABSENTE/INCONNUE/NON_PRIMAIRE`, `ARCHIVE_ABSENTE` (+ sha256 + non-empty extract > 500 chars);
- `MOT_INTERDIT` (lemma prefixes, field-scoped, quote-exempt) + loaded-verb warnings;
- per-level lengths (25 / 80-200 / 40-60 / 60-120 words);
- `redactions-publie`;
- `CHIFFRE_HORS_SOURCE`, `citation-exacte` (vs the archived extract), `glossaire-resolu`;
- the readability warning + enfant sentence-length rule;
- the partial-date rule.
- Corpus rules: `integrite` (ids, refs, path == id, ids.lock / no renames), `equite` (couverture-based, mode-dependent severity), the `verifie_le` staleness warning.
- Sondage traps: `SONDAGE_NOTICE_ABSENTE`, `SOMME_HORS_BORNES` (95-105 %), `TOUR_INCOHERENT`, `PUBLICATION_BLOCAGE` (windows hard-coded in Europe/Paris, also reused later for the electoral-silence freeze).
- Grep guard against `bloc`/`extdroite`/`propositions`.
**Addresses:** T3, D6, D13, the spec §12 traps.
**Avoids:** pitfalls 4, 6, 8, 9, 19 and 23.

### Phase 4: Data ingestion and pilot corpus (Lot 1c, parallel with Phase 3 once schemas are frozen)
**Rationale:** Real data validates the rules, and the rules catch data problems. Status churn in December requires the import diff workflow to exist early.
**Delivers:**
- `import-datagouv.ts`: snapshot + sha256, drops `bloc`/`propositions`, maps to D-1 codes, flags partial dates, produces a diff PR.
- 59 candidate files with hand-split names and `nom_tri`, plus Licence Ouverte attribution.
- `archive-source.ts`: Playwright-rendered capture → `.txt` extract in the repo, binary in the private archive store (D-8), Wayback SPN submission.
- A **coverage count per candidate theme** to choose the 3 pilot themes (documented on Méthode).
- Pilot measures collected by agent in `brouillon`; `couverture` records via `couverture-stub`; glossary and party entries.
**Addresses:** T2, T4, T5, D4.
**Avoids:** pitfalls 1, 5 (theme choice), 7 and 16.

### Phase 5: Astro bridge, view-model and core pages (Lot 2a)
**Rationale:** The pages need only the schemas and `corpus-valide`, so this can start as soon as Phase 2 lands. The weight and inline-space checks must start with the **first** page, because regressions are cheapest to catch then.
**Delivers:**
- The custom content-core loader in `content.config.ts`, hand-written view-model types, `getCorpus()` (mode filter, French collation, cell matrix, glossary resolution), and the `RTP_MODE=preview` build with brouillon badges.
- Base layout and `LecteurNiveaux`: radio fieldset + `:has()` on `.lecteur`, `display:none`, labels shown when `:has()` is unsupported.
- `Mesure`, `Cellule` (typed empty states + dates, neutral grey), `SourceCitation` (always visible).
- Theme pages: fixed-size cards, iterating candidates, coverage line, collapsed « ont renoncé » section. Candidate pages for all 59.
- Cross-links, last-updated dates, error-report links.
- `check-dist` (weight per D-6, no external resources, forbidden words with the Méthode exemption, a dated source per `.mesure`, inline-space check, `.cellule` count, absence of a trap brouillon in a production build).
**Uses:** Astro 7, `@astrojs/check`.
**Implements:** the Astro bridge, the corpus view-model, the UI components, Gate 2.
**Avoids:** anti-patterns 2, 3 and 5, pitfalls 17 and 20 (in part), and the T14 weight risk.

### Phase 6: Progressive enhancement, Aîné and Enfant levels (Lot 2b)
**Rationale:** This builds on the working no-JS pages. It is the part with the most a11y uncertainty (popover ARIA, flash-free restore, bfcache).
**Delivers:**
- `niveau.js`: synchronous restore, persist, `aria-live` announcement, `pageshow` re-sync, `try` around storage.
- `ordre.js`: Fisher-Yates + `crypto.getRandomValues`, control `hidden` without JS, `data-ordre-pending` anti-flash with a CSS fallback, chi-square uniformity test; D-11.
- Aîné: larger type, the `.concerne-aine` priority-themes block (no CSS `order` reordering).
- Enfant: `TexteEnfant` `[[terme]]` → popover buttons, one popover per term per page, plus the "Mots expliqués" list.
- Need-based level labels (« Très simple », « Gros caractères… »), a neutral pictogram instead of photos (D-12), and print CSS if time allows.
**Addresses:** D1, D2, D3, D7, T15, T16.
**Avoids:** pitfalls 10, 11, 13, 20 and 21, and anti-patterns 4 and 6.

### Phase 7: Institutional pages, quality gates and test-URL delivery (Lot 2c, the Lot 2 deliverable)
**Rationale:** The Méthode page must describe the final rules, so it comes last and is generated from `config.ts`. The legal wording depends on D-4. The full e2e suite proves the M1 acceptance criteria.
**Delivers:**
- **Méthode**, with lists and numbers generated from config:
- forbidden words, length bounds, readability formula and limits;
- equity scope and ordering rules (particle rule, random order requires JS);
- meaning of empty states, the 59-vs-51 reconciliation, the Licence Ouverte attribution;
- the « pas un service audiovisuel soumis à l'Arcom » sentence and the 4G profile.
- **Mentions légales:** LCEN art. 1-1, host details from `config/hebergeur.yml`, directeur de la publication, right-of-reply contact, a « Données personnelles » section (localStorage keys, no cookies, mailto notice).
- **Qui sommes-nous:** editor, method, no funding, no third-party branding.
- Playwright suite: no-JS mode, keyboard path, axe WCAG 2.2 AA with 0 serious or critical issues, localStorage restore without flash, the Slow-4G load test against a gzip static server.
- A manual VoiceOver/NVDA check and an old-Safari check.
- The preview build uploaded as a CI artifact = the « URL de test » (noindex if ever hosted).
**Addresses:** T8, T9, T10, T17 (election dates block), D8.
**Avoids:** pitfalls 12, 14, 17, 24 and 25.

### Phase Ordering Rationale

- **Schemas first, because every artifact branches on field names and enums.** The status and empty-state enums are hard to change later, since changing them needs scripted migrations under spec §7.
- **Rules before real data merges, but data entry runs in parallel.** Phases 3 and 4 share the frozen schema. Pilot data surfaces rule false positives early (for example "enfin" inside a candidate quote).
- **UI against fixtures, not against reviewed content.** Phase 5 can start right after Phase 2, so the toggle and weight budget are proven before content volume grows. Without the preview mode the Lot 2 deliverable would be an empty site, since all pilot content is `brouillon`.
- **Legal and method pages last, because they describe what was actually built.** This prevents drift between the Méthode page and practice (pitfall 25).
- **Parallelism, if the roadmapper wants it:** Phase 4 ∥ Phase 3, and Phase 5 can start once Phase 2 is done. Phases 6-7 are sequential after 5.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 2:** modelling decisions D-1, D-3, D-7 and D-8 must be confirmed by Erwan. The exact `couverture`/`sources`/archive field set and the `motif` vocabulary deserve a focused design pass.
- **Phase 3:** French word-count normalization edge cases, number extraction (digits vs French number words), the syllable heuristic and its calibration against textstat, and the verbatim-quote normalization rules. LOW-MEDIUM confidence on readability thresholds.
- **Phase 4:** capturing JS-heavy campaign sites (web books, SPAs) into usable text extracts, the private archive store mechanics, the Internet Archive SPN API behaviour and retries, and choosing pilot themes from measured coverage.
- **Phase 6:** screen-reader behaviour of `popovertarget` (implicit `aria-expanded` is undocumented), `:has()` fallback on Safari 15.x, the bfcache and form-state restoration interplay.
- **Phase 7:** the legal wording of the mentions légales (D-4, ideally a lawyer check), and confirming the actual preview host's identity.

Phases with standard patterns (skip research):
- **Phase 1:** a well-documented toolchain; versions were already verified today.
- **Phase 5:** Astro content layer, custom loaders and static pages are documented. The design is fully specified in ARCHITECTURE.md. The only novelty (the custom loader calling content-core) is small.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, engines and peer ranges verified on npm (2026-11-03). Astro YAML parsing and Zod `fromJSONSchema` limits verified in package source. Node EOL dates from the official schedule. `json-schema-to-typescript` dependency tree verified today. MEDIUM: CDP 4G throttling (Chromium only), Dependabot cooldown option name, Luciole licence. |
| Features | MEDIUM-HIGH | The dataset was inspected directly (HIGH). Live 2027 competitors were opened (MEDIUM, page summaries). 2012-2022 products come from secondary sources (MEDIUM/LOW). |
| Architecture | HIGH | Astro 7 mechanics confirmed in published source (`glob` ids, `reference()` log-only, `compressHTML` default). Browser features from MDN Baseline. MEDIUM: popover ARIA, CSS `random()` status (rejected anyway). |
| Pitfalls | MEDIUM-HIGH | Legal texts read on Legifrance and CNIL today (HIGH). Dataset issues verified on the file (HIGH). archive.today deprecation from multiple secondary sources (MEDIUM). Domiciliation as a valid « domicile » and readability grade bands: LOW. |

**Overall confidence:** MEDIUM-HIGH. Technical choices are solid. The residual uncertainty is editorial and legal, and is concentrated in the Decisions table.

### Gaps to Address

- **Erwan's decisions D-1 to D-13:** the roadmap should assume the defaults, and the Phase 2 plan should open with a confirmation checkpoint.
- **Readability threshold for « CM1 »:** no validated French score-to-grade table exists. Calibrate on a Vikidia sample in Phase 3 and keep it as a warning until then.
- **Mentions légales art. 1-1 II applicability:** recommend a lawyer check before the public launch (Lot 3). Lot 2 ships the draft wording.
- **Which 3 pilot themes:** not decidable until the Phase 4 coverage count. Aîné-priority themes (retraites, santé) are plausible candidates but are not yet backed by data.
- **Preview hosting:** v1.0 treats the CI artifact or local preview as the « URL de test ». A hosted preview needs noindex + basic auth, and correct host details in the mentions.
- **Popover a11y and old-device fallback:** needs a manual VoiceOver/NVDA/old-Safari pass in Phase 6-7, which automated axe will not cover.
- **Dataset drift:** the 2027etmoi file changes weekly, and its description (51) already disagrees with its content (59). The import must be diff-based, with no count assertions. Consider whether press-only status lines get a visible « à recouper » marker (D-3).
- **Arcom 2027 recommendation:** not yet published. Re-check when it is, mainly before audio (Lot 6). Not applicable to a static text site per current texts.
- **No "règle du 15 avril 2026"** (spec §13) was found. Verify in Lot 4 (polls), out of scope here.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-11-03): astro 7.4.5, ajv 8.20.0, yaml 2.9.1, @playwright/test 1.64.1, @axe-core/playwright 4.14.0, @astrojs/check 0.9.12, typescript 6.0.3/7.0.2, zod 4.6.7, json-schema-to-typescript 16.0.0 (dependency tree checked during synthesis), lighthouse, pa11y-ci, vitest, ajv-formats, ajv-cli
- Package source: `astro@7.4.5` loaders, types-generator and content-layer; `@astrojs/internal-helpers/yaml` (core + timestamp); `zod` `from-json-schema` (unsupported keywords throw); `@paulirish/trace_engine` Lantern constants (Slow 4G)
- Node release schedule and TypeScript type-stripping docs; `node:test` docs
- docs.astro.build: content collections, loader reference, upgrade guides v6/v7, client-side scripts
- zod.dev/json-schema and zod.dev/api; MDN `:has()` and Popover API; WCAG 2.2 SC 1.4.13
- data.gouv « Candidatures à l'élection présidentielle 2027 — statuts sourcés » (page, API, JSON resource downloaded); 2027etmoi GitHub repo (data licence, method docs)
- Legifrance: LCEN art. 1-1/1-2 (post-SREN), CPI L.122-5, Code électoral L49/L97, loi 62-1292 art. 3, décret 2001-213, loi 77-808 art. 11/14
- CNIL: cookies and trackers (personalisation exemption, art. 82 LIL), audience measurement guidance
- GitHub Docs: large files and repo size limits; GitHub API for action releases
- Conseil constitutionnel 2022 site: candidate order by lot, campaigning online on the eve of the vote

### Secondary (MEDIUM confidence)
- Live competitor sites: 2027etmoi.fr, votons-2027.fr, repere2027.fr, quiproposequoi2027.fr, IFRAP comparateur
- Elyze 2022 controversies (Euronews, Stratégies, onepoint), Boussole présidentielle, Voxe
- archive.today deprecation (Wikipedia Signpost 2026-03-10 and others)
- Kandel-Moles formula (textstat constants, French readability articles)
- NN/g senior usability; FALC rules (Unapei)
- Context7: Playwright 1.64.1, axe-core-npm, Ajv

### Tertiary (LOW confidence)
- French readability score-to-grade bands (blog tables)
- Postal domiciliation as satisfying LCEN « domicile »
- Arcom 2027 recommendation status and creator talks (kohenavocats.com)
- 2022 comparator criticism (espoir-ric.fr); candidats2027.org, p2027 and sondages-presidentielle2027 (search snippets)

---
*Research completed: 2026-11-03*
*Ready for roadmap: yes (assuming the "Decisions Needed" defaults, to be confirmed by Erwan at the start of Phase 2)*
