# Phase 3: Import data.gouv et corpus pilote - Research

**Researched:** 2026-11-03
**Domain:** Dataset import into schema-valid YAML, source archiving (HTML/PDF text extraction, sha256, private binary repo, Wayback Save Page Now), measured choice of 3 pilot themes, real-content authoring workflow, default content-root flip. Node 24, almost no new dependency.
**Confidence:** HIGH for the dataset facts, the name table and the flip checklist (downloaded, parsed, read against the code). MEDIUM for the archiving design (live probes, but no end-to-end run). LOW-MEDIUM for the coverage matrix (semi-automated estimate, re-verification is part of execution).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Héritées (Phases 1-2, verrouillées)**
- Statuts = codes dataset (`declare|primaire|pressenti|empeche|renonce`, `motif` pour `renonce`), historique `statuts[]` append-only, ids `prenom-nom` ASCII figés + `ids_externes.2027etmoi`, `nom_tri` saisi à la main
- Ne jamais importer `bloc` ni `propositions` ; presse autorisée pour statuts seulement (badge) ; source de mesure = primaire uniquement
- Archives : extrait `.txt` + sha256 dans `archives/` du dépôt public ; binaires hors dépôt public ; plafond 5 Mo
- Équité = `declare` + `primaire` ; tout passe les règles Phase 2

**Choix acceptés par Erwan (2026-11-03)**
- Thèmes pilotes : mesurer la couverture en sources primaires des candidats `declare` sur les 10 thèmes de la spec (logement, école, retraites, santé, sécurité, climat, travail, impôts, Europe et monde, institutions) ; retenir les 3 meilleurs ; départage par thèmes prioritaires Aîné ; résultat documenté (table de couverture) pour la page Méthode
- Binaires d'archives : créer le dépôt GitHub privé `ErwanHenry/reveleTonProg-archives` (autorisé) ; le script d'archivage y pousse PDF/HTML rendus, le dépôt public garde `.txt` + sha256 + chemin
- Wayback : soumettre chaque URL source publique à archive.org Save Page Now (autorisé), stocker l'URL retournée dans `archive.wayback_url` ; échec = avertissement, pas blocage
- Rédactions : l'agent rédige les 4 niveaux uniquement à partir du `texte_source` cité, tout en `statut_relecture: brouillon` ; rien n'est publié sans relecture d'Erwan ; « le candidat ne précise pas » plutôt qu'une supposition
- Rien d'inventé : une case sans source primaire trouvée = état couverture `programme_non_publie` ou `non_precise` avec sources consultées et date

### Claude's Discretion
- Outil de capture (Playwright si besoin de rendu JS, sinon fetch), structure du rapport de couverture, ordre de collecte

### Deferred Ideas (OUT OF SCOPE)
- Collecte automatisée cron (lot 5)

**Phase boundary (from CONTEXT.md `<domain>`):** Script d'import du dataset data.gouv « Candidatures à l'élection présidentielle 2027 — statuts sourcés » (2027etmoi, Licence Ouverte 2.0) en fiches candidats valides ; outil d'archivage des sources ; choix mesuré des 3 thèmes pilotes ; corpus pilote réel en `brouillon` (mesures sourcées ou états de couverture datés) ; glossaire. Bascule de la racine de contenu par défaut de la fixture vers le vrai corpus (`.`). Hors périmètre : pages (Phase 4), publication (`publie` exige la relecture d'Erwan).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Script d'import (instantané + sha256 + date, écarte `bloc`/`propositions`, mappe les statuts, diff relisible) | Dataset facts, hand tables, deterministic YAML emit (`yaml.stringify` core schema, verified), append-only merge, idempotence test, `data/import/` layout |
| CONT-02 | 59 fiches candidats valides (nom découpé à la main, `nom_tri`, statut daté et sourcé, attribution LO) | Full 59-row name table with ids, motifs, status-source types; `parti_source` rule (35 of 59 sourceable, 24 get `parti: null`); LICENSE §4 and attribution file |
| CONT-03 | Script d'archivage (capture rendue, extrait texte + sha256, binaire hors dépôt public, Wayback) | CLI design, fetch / Playwright / manual-file tiers, `pdftotext`, charset and U+FFFD pitfalls, private repo layout, SPN behaviour measured on 2026-11-03 |
| CONT-04 | 3 thèmes pilotes choisis par couverture mesurée | Method, 37 x 10 matrix (estimate), tallies, decision rule applied, provisional pick: institutions, impôts, retraites |
| CONT-05 | Pour chaque thème pilote, chaque `declare`/`primaire`: mesures `brouillon` ou état couverture daté | Workload model (about 90 measures, about 360 rédactions), cap rule, Phase 2 constraints that bind drafts, per-theme plan slicing |
| CONT-06 | Glossaire des termes et partis utilisés dans les rédactions enfant | `[[affiché\|id]]` marker contract (Phase 2 A2), party-name check, test design |
</phase_requirements>

## Summary

The dataset is small, clean and stable enough to import by script: 59 rows, 37 `declare`, 17 `renonce`, 5 `pressenti`, 0 `primaire`, 0 `empeche`, sha256 `9f2fbc79...67e50`, `mise_a_jour` 2026-10-28, served through a 302 from data.gouv to `2027etmoi.fr`. The importer must be driven by two hand-made tables (name split, `renonce` motifs) that this research drafts in full (59 rows), because the upstream `id` slugs (`faure`, `royal`) do not match the schema's `prenom-nom` pattern (at least one hyphen) and `statut_detail` has no home in schema v1. Two upstream fields are deliberately lost (`bloc`, `propositions`), a third (`statut_detail`) cannot be stored; the raw snapshot under `data/import/` keeps everything for audit. 24 of 59 rows have no party or campaign link, so the schema's rule "`parti` string requires `parti_source`" forces `parti: null` for them.

The archiving tool is mostly stdlib: `fetch` for HTML and PDF, `pdftotext` (poppler, a system tool, present on this Mac via MacPorts) for PDF text, `node:crypto` for sha256, and a 15-line SPN client. Live probes on 2026-11-03 show what must be designed for: 41 of 43 candidate-site URLs answer 200, two (Batho) answer 403 to automated clients (needs a manual `--file` path); one dataset programme link (Mélenchon) redirects to the home page; two sites found by web search were stale (a parked domain, a satirical page); pdftotext replaces `tt` ligatures with U+FFFD in some PDFs; and anonymous Save Page Now returned either a 302 to an existing snapshot (8 s), an HTTP 429 per-URL daily cap, or hung for more than 100 s. Playwright is not needed to get text out of the sites we crawled (on 9 sampled pages rendered `innerText` differed from the fetched text by +3% to -52%, and rendering never revealed substantial content missing from the fetched HTML), so it is an optional `--render` tier, not a prerequisite.

The coverage estimate (semi-automated crawl of the 37 `declare` candidates' own sites, then manual reading of snippets) says only 27 of 37 have a programme-grade primary source today and 10 have none (`programme_non_publie`). Institutions and impôts are the two best-covered themes under both metrics (21 candidates with a position each); the third place is not separable by the estimate (école, climat, Europe at 19; sécurité leads on strong cells), so the user's own tie-break (Aîné priority themes) selects **retraites** (best Aîné theme: 18 with a position, 11 strong). Provisional pilot: **institutions, impôts, retraites**. About 60 cells will carry measures and 51 will carry coverage states; at a cap of 2 measures per cell this is about 90 measures and 360 rédactions, which must be authored in per-theme chunks, and only after Phase 2's `validate` has landed, because lengths, quotes and numbers are enforced on drafts too.

**Primary recommendation:** Build in this order: (1) importer + 59 fiches, (2) archive tool + private repo, (3) measured coverage table with a human confirmation of the 3 themes, (4) one plan per pilot theme (sources, archives, measures in batches of about 10, coverage cases, glossary), (5) flip `DEFAULT_CONTENT_ROOT` to `.` last, because it touches the same files as Phase 2 plans 02-05 and 02-06.

## Architectural Responsibility Map

Build-time and authoring tooling only; there is no browser, SSR or API tier in this phase.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dataset download, snapshot, mapping to YAML | `scripts/import-datagouv.ts` + pure module `scripts/lib/datagouv.ts` | `data/import/` (snapshot + hand tables) | Import logic is authoring tooling, not content-core; pure mapping function is unit-testable offline |
| Hand-made name split, motifs, status-source overrides | `data/import/correspondances.yaml` (committed, reviewed) | — | CONT-02 requires a manual split; code must refuse unknown ids rather than guess |
| Candidate files (59) | `src/content/candidats/*.yaml` | `ids.lock` (Phase 2) | Schema v1 is the only structural authority |
| Source capture and text extraction | `scripts/archive-source.ts` + pure module `scripts/lib/archive.ts` | system `pdftotext`; optional Playwright | Same loader and schemas as CI; network code isolated from pure functions |
| Text extract + hash in public repo | `archives/<candidat>/<sha12>.txt` | `src/content/sources/<id>.yaml` `archive` block | Locked (D-8); Phase 2 verifies sha256 and quote containment |
| Binaries (PDF, rendered HTML) | private repo `ErwanHenry/reveleTonProg-archives` | local clone via `RTP_ARCHIVES_DIR` | Copyright and size; never in the public repo |
| Independent timestamp | Internet Archive Save Page Now | `archive.wayback_url` in the source YAML | Corroboration only; failure is a warning |
| Coverage measurement and theme choice | `data/couverture-themes.yaml` + `docs/COUVERTURE-THEMES.md` | Phase 5 Méthode page reads it | Table must be reusable by INST-01 |
| Measures, sources, couverture, glossaire, thèmes | `src/content/**` | Phase 2 rules in `loadAll` | Editorial rules live in content-core, never in Astro |
| Default root | `src/lib/content-core/root.ts` | tests, CI, docs | One constant; many tests and docs pin the old value |

## Standard Stack

### Core
No new runtime dependency. Everything below is already in the repo or in Node 24 stdlib.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.22.2 via `fnm exec --using=24` `[VERIFIED: local run]` | Runtime, global `fetch` (undici), `node:crypto`, `node:test`, native TS | Project decision D-5. Shell default is v22.23.3, so every command in plans must use `fnm exec --using=24` |
| `yaml` (eemeli) | ^2.9.1 (already a dependency) | Deterministic YAML emit and parse | `stringify(obj, { schema: 'core', indent: 2, indentSeq: true, lineWidth: 0 })` produced the repo's canonical style and round-tripped (dates unquoted, `no` and `"010"` handled) `[VERIFIED: local run]` |
| `ajv` | ^8.20.0 (already) | Schema validation of generated files | Existing single path |
| `node:crypto` `createHash('sha256')` | stdlib | sha256 of the snapshot, the `.txt` extract and binaries | Raw bytes, never re-encoded text |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `pdftotext` (poppler) | 0.72.0 at `/opt/local/bin/pdftotext` `[VERIFIED: local]` | PDF to text | Every PDF source. System tool, not an npm dependency; the CLI must check `command -v pdftotext` and print an install hint (`brew install poppler` or `sudo port install poppler`) |
| `gh` CLI | authenticated as `ErwanHenry`, scopes `gist, read:org, repo, workflow` `[VERIFIED: gh auth status]` | `gh repo create ErwanHenry/reveleTonProg-archives --private` | Once, in an execution task. The repo does not exist yet `[VERIFIED: gh repo view]` |
| `@playwright/test` | 1.64.1 (latest on 2026-11-03) `[ASSUMED: slopcheck unavailable]` | Optional `--render` tier of the archive tool (`chromium.launch`, `page.content()`, `document.body.innerText`) | Only when a page has little text for a large HTML (client-side rendered) or a visitor-faithful text is wanted. Phase 5 needs the same package for E2E (STACK.md), so adding it now is not an extra dependency in the end. Import dynamically so `npm test` never loads it |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdftotext` | `pdfjs-dist` (pure JS) | Large dependency tree, column handling no better. Keep poppler; archiving runs on Erwan's Mac, never in CI |
| Playwright as default capture | `fetch` + built-in HTML text stripper | Fetch is enough for every site crawled today (on 9 sampled pages rendered text differed from fetched text by +3% to -52%, with no content found only after rendering). Playwright gives visitor-faithful `innerText` and a PDF print, at the cost of a 170 MB browser download (`npx playwright install chromium`, revision 1248 for 1.64.1 `[VERIFIED: browsers.json]`; the local cache holds 1148, 1223, 1234 only) |
| Third-party Wayback client (`savepagenow`, `spn2` npm) | 15 lines of `fetch` | A package for one GET is not worth a dependency (project rule: every dependency justified) |
| archive.today | — | Banned (PITFALLS.md: deprecated by Wikipedia 2026-02-20) |

**Installation (only if the planner keeps the `--render` tier):**
```bash
fnm exec --using=24 npm install --save-dev @playwright/test@^1.64.1   # ignore-scripts=true is fine: the package has no install script [VERIFIED: npm view scripts = {}]
fnm exec --using=24 npx playwright install chromium                    # explicit, ~170 MB, user-level cache; not needed in CI for this phase
```
**Version verification:** `npm view playwright version` = 1.64.1, `time.modified` 2026-11-03 `[VERIFIED: npm registry]`.

## Package Legitimacy Audit

slopcheck could not be installed in this session (the install command was denied by the permission layer), so per protocol every recommended package is `[ASSUMED]` and the planner must gate it behind a `checkpoint:human-verify` before install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@playwright/test` (pulls `playwright`, `playwright-core` 1.64.1) | npm | created 2020-09 (playwright 2015) | `playwright` 158.9 M last week (2026-10-27 to 11-02) `[VERIFIED: api.npmjs.org]` | github.com/microsoft/playwright, Apache-2.0 | not run | Approved by STACK.md for Phase 5 and by research here; `[ASSUMED]` until human-verify. No `postinstall`/`install` script (`scripts = {}`) `[VERIFIED: npm view]` |

**Packages removed due to slopcheck [SLOP] verdict:** none (tool not run).
**Packages flagged as suspicious [SUS]:** none.
Every other tool in this phase is a system binary (`pdftotext`, `gh`, `git`) or stdlib.

## Dataset findings (verified by download on 2026-11-03)

**Fetch chain `[VERIFIED: curl -D]`:** `https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493` answers `302` to `https://2027etmoi.fr/data/candidats.json` (`200`, `content-type: application/json`, `cache-control: public,max-age=300`, `etag: "43cd7765d0e892886967e943ceaa3d9e-ssl"`). Body 62 986 bytes, **sha256 `9f2fbc7930c00796e7992d7468806e095bec2e0782d6ae2d2df2582a36367e50`**. The importer must follow redirects and record the final URL and the ETag in the snapshot metadata.

**Schema (observed, no declared schema upstream):**
```
{ "mise_a_jour": "2026-10-28",
  "candidats": [ {
    "id": "faure",                       // upstream slug, NOT valid as our id (our pattern needs a hyphen)
    "nom": "Olivier Faure",              // one field
    "parti": "Parti socialiste",         // free text, never null (59/59)
    "bloc": "gauche",                    // NEVER import (gauche|ecolo|centre|droite|souverainiste|extdroite|autre)
    "statut": "renonce",
    "statut_detail": "…",                // one factual sentence, max 321 chars; no field in schema v1
    "source": { "titre": "…", "url": "https://…", "date": "2026-10-11" },   // titre is sometimes just the outlet ("LCP")
    "propositions": ["…"],               // NEVER import
    "liens": { "campagne"?, "programme"?, "parti"?, "x"?, "instagram"?, "youtube"?, "wikipedia"? },
    "verifie_le": "2026-10-28" } ] }
```
All 59 rows carry all 10 keys; no duplicate ids; every link is `https`. Counts `[VERIFIED: script]`: **59 rows** (the dataset description says 51; do not assert a count), `declare` 37, `renonce` 17, `pressenti` 5, `primaire` 0, `empeche` 0. `liens` keys: campagne 19, programme 6, parti 28, x 23, instagram 12, youtube 7, wikipedia 49. One partial date: `wauquiez` `source.date = "2026-07"`. `verifie_le` from 2026-09-22 to 2026-10-28. 8 `source.url` values are shared between rows (the LCP primary-election article for 5 rows (Faure, Glucksmann, Guedj, Royal, Maurel), the franceinfo portraits page for 5 (Billetdoux, Collovati, Legendre, Markovic, Rohou)). Oddity: `platret.liens.wikipedia` points to the Chalon-sur-Saône page.

**Declared candidates with a dataset `liens.programme` (6) re-checked live:** Mélenchon `/programme2025/livre/` redirects to the home page (dead; do not use it); Cazeneuve `la-convention.fr/lettre` 200; Attal `attalpresident.fr/programme` 200; Mlekuz `trajectoire2027.fr/programme.html` redirects to `/programme` 200; Egger `solutiondemocratique.fr/parrainage2027/` 200 (institutional only); Mikolajczak `parti-equinoxe.fr/presidentielle-2027/` 200. Of the 43 campaign/programme/party URLs of the 37 declared, 41 answered 200 and 2 (both Batho sites) answered 403 to curl and to a headless browser. 11 declared have no campaign, programme or party link at all (Bouamrane, Becht, Platret, Mathieu, Lalanne, Durif, Billetdoux, Collovati, Legendre, Markovic, Rohou).

### Hand name-split table (all 59 rows) — draft for `data/import/correspondances.yaml`

`id` = ASCII slug of `prenom + nom` (NFD strip, lower, non-alphanumerics to `-`), checked against `^[a-z][a-z0-9]*(-[a-z0-9]+)+$`, 59 unique `[VERIFIED: script]`. `nom_tri` has no particle (Villepin) except `Le Maire` and `Le Pen`, which sort at L. Zero duplicate `nom_tri`. With `Intl.Collator('fr')` the space sorts before letters, so `Le Maire`, `Le Pen`, `Legendre` come in that order `[VERIFIED: script]`. "Type src statut" is the proposed `statuts[0].source.type`: `presse` unless the host is a party, candidate or institution site (rule keyed on host, see mapping decisions). The `motif` column is **my reading of `statut_detail` and needs Erwan's confirmation** (`[ASSUMED]`): doubtful rows are marked `?`.

| Upstream id | Prénom | Nom | nom_tri | Proposed id | Statut / motif | Type src | Flags |
|---|---|---|---|---|---|---|---|
| melenchon | Jean-Luc | Mélenchon | Mélenchon | `jean-luc-melenchon` | declare | presse | compound first name |
| faure | Olivier | Faure | Faure | `olivier-faure` | renonce / elimine_primaire | presse | |
| glucksmann | Raphaël | Glucksmann | Glucksmann | `raphael-glucksmann` | declare | presse | |
| guedj | Jérôme | Guedj | Guedj | `jerome-guedj` | renonce / elimine_primaire | presse | |
| royal | Ségolène | Royal | Royal | `segolene-royal` | renonce / elimine_primaire | presse | |
| maurel | Emmanuel | Maurel | Maurel | `emmanuel-maurel` | renonce / elimine_primaire | presse | |
| roussel | Fabien | Roussel | Roussel | `fabien-roussel` | declare | presse | |
| ruffin | François | Ruffin | Ruffin | `francois-ruffin` | declare | presse | first-name homonym x4 |
| cazeneuve | Bernard | Cazeneuve | Cazeneuve | `bernard-cazeneuve` | declare | presse | |
| bouamrane | Karim | Bouamrane | Bouamrane | `karim-bouamrane` | declare | presse | |
| hollande | François | Hollande | Hollande | `francois-hollande` | pressenti | presse | first-name homonym |
| arthaud | Nathalie | Arthaud | Arthaud | `nathalie-arthaud` | declare | presse | |
| kazib | Anasse | Kazib | Kazib | `anasse-kazib` | declare | parti (revolutionpermanente.fr) | |
| labib | Selma | Labib | Labib | `selma-labib` | declare | parti (npa-revolutionnaires.org) | |
| tondelier | Marine | Tondelier | Tondelier | `marine-tondelier` | declare | presse | first-name homonym (Le Pen) |
| batho | Delphine | Batho | Batho | `delphine-batho` | declare | candidat (delphinebatho.fr) | site returns 403 |
| vallaud | Boris | Vallaud | Vallaud | `boris-vallaud` | renonce / ralliement | presse | |
| autain | Clémentine | Autain | Autain | `clementine-autain` | renonce / retrait | presse | |
| castets | Lucie | Castets | Castets | `lucie-castets` | renonce / non_candidat | presse | `parti` is "Sans étiquette" |
| poutou | Philippe | Poutou | Poutou | `philippe-poutou` | renonce / ralliement ? | presse | the NPA, not the person, rallies; first name = surname of Philippe |
| philippe | Édouard | Philippe | Philippe | `edouard-philippe` | declare | presse | accented initial; surname = first name of two others |
| attal | Gabriel | Attal | Attal | `gabriel-attal` | declare | presse | |
| becht | Olivier | Becht | Becht | `olivier-becht` | declare | presse | |
| villepin | Dominique | de Villepin | Villepin | `dominique-de-villepin` | pressenti | presse | particle; id keeps it, `nom_tri` drops it |
| le-maire | Bruno | Le Maire | Le Maire | `bruno-le-maire` | pressenti | presse | article, sorts at L |
| darmanin | Gérald | Darmanin | Darmanin | `gerald-darmanin` | renonce / ralliement | presse | |
| bayrou | François | Bayrou | Bayrou | `francois-bayrou` | renonce / non_candidat | presse | first-name homonym |
| retailleau | Bruno | Retailleau | Retailleau | `bruno-retailleau` | declare | parti (republicains.fr) | |
| lisnard | David | Lisnard | Lisnard | `david-lisnard` | declare | presse | |
| platret | Gilles | Platret | Platret | `gilles-platret` | declare | presse | |
| bertrand | Xavier | Bertrand | Bertrand | `xavier-bertrand` | declare | presse | `parti` is long free text |
| wauquiez | Laurent | Wauquiez | Wauquiez | `laurent-wauquiez` | renonce / non_candidat | presse | partial date `2026-07` |
| barnier | Michel | Barnier | Barnier | `michel-barnier` | renonce / non_candidat | presse | |
| le-pen | Marine | Le Pen | Le Pen | `marine-le-pen` | declare | presse | article, sorts at L |
| bardella | Jordan | Bardella | Bardella | `jordan-bardella` | renonce / non_candidat | presse | |
| zemmour | Éric | Zemmour | Zemmour | `eric-zemmour` | declare | presse | accented initial |
| knafo | Sarah | Knafo | Knafo | `sarah-knafo` | renonce / ralliement ? | presse | "pas candidate" and supports Zemmour: `non_candidat` is the alternative |
| marechal | Marion | Maréchal | Maréchal | `marion-marechal` | renonce / ralliement | presse | usage name as in the dataset |
| dupont-aignan | Nicolas | Dupont-Aignan | Dupont-Aignan | `nicolas-dupont-aignan` | declare | presse | compound surname |
| philippot | Florian | Philippot | Philippot | `florian-philippot` | declare | presse | host frontpopulaire.fr is a magazine, keep `presse` |
| asselineau | François | Asselineau | Asselineau | `francois-asselineau` | declare | parti (upr.fr) | |
| lassalle | Jean | Lassalle | Lassalle | `jean-lassalle` | pressenti | presse | |
| mlekuz | Manolo | Mlekuz | Mlekuz | `manolo-mlekuz` | declare | presse | |
| egger | Clara | Egger | Egger | `clara-egger` | declare | parti (solutiondemocratique.fr) | |
| mathieu | Benoît | Mathieu | Mathieu | `benoit-mathieu` | declare | presse | |
| lalanne | Francis | Lalanne | Lalanne | `francis-lalanne` | declare | presse | |
| branco | Juan | Branco | Branco | `juan-branco` | declare | presse | `parti` "Sans étiquette (soutenu par Les Ruches)" |
| durif | Sylvain | Durif | Durif | `sylvain-durif` | declare | presse | |
| mikolajczak | Antoine | Mikolajczak | Mikolajczak | `antoine-mikolajczak` | declare | presse (jhm.fr, `[ASSUMED]` regional press) | |
| polony | Natacha | Polony | Polony | `natacha-polony` | declare | presse | |
| billetdoux | Augustin | Billetdoux | Billetdoux | `augustin-billetdoux` | declare | presse | |
| collovati | Christian | Collovati | Collovati | `christian-collovati` | declare | presse | |
| legendre | Jean-François | Legendre | Legendre | `jean-francois-legendre` | declare | presse | compound first name; sorts after Le Pen |
| markovic | Mira | Markovic | Markovic | `mira-markovic` | declare | presse | |
| rohou | Erwan | Rohou | Rohou | `erwan-rohou` | declare | presse | same first name as the maintainer, no effect |
| dubuisson | Emmanuel | Dubuisson | Dubuisson | `emmanuel-dubuisson` | declare | institution (annuaire-entreprises.data.gouv.fr, SIRENE) | first-name homonym |
| massard | Lydie | Massard | Massard | `lydie-massard` | pressenti | presse | |
| lucas-lundy | Benjamin | Lucas-Lundy | Lucas-Lundy | `benjamin-lucas-lundy` | renonce / retrait | presse | compound surname; the Le Monde URL spells "lucas-landy", verify spelling at relecture |
| brun | Philippe | Brun | Brun | `philippe-brun` | renonce / elimine_primaire ? | presse | "suspendu du PS, exclu de la primaire": none of the four motifs fits cleanly; `retrait` and `non_candidat` are wrong, `elimine_primaire` is the least wrong |

Four `?` rows (Poutou, Knafo, Brun, plus the whole motif column) go to Erwan in the import PR. No automatic splitting heuristic is acceptable (FEATURES.md point 4); the importer **fails with exit 1 and lists the ids** if an upstream id has no entry in `correspondances.yaml`, so a December status change adding a new person never creates a guessed fiche.

### Mapping decisions for the importer

| Target field | Rule | Confidence |
|---|---|---|
| `id`, `prenom`, `nom`, `nom_tri` | from `correspondances.yaml` only | HIGH |
| `ids_externes.2027etmoi` | upstream `id` | HIGH |
| `statuts[0].code` | upstream `statut` (identity, codes already D-1) | HIGH |
| `statuts[0].motif` | from `correspondances.yaml`, required exactly when `code = renonce` (schema `if/then/else`) | HIGH structure, MEDIUM values |
| `statuts[0].date` | upstream `source.date` (date of the source that establishes the status; partial `AAAA-MM` allowed for `brouillon`, a full date is required before `relu`, so `wauquiez` needs a human completion) | MEDIUM `[ASSUMED]` |
| `statuts[0].source` | `{ type, titre: source.titre, url: source.url, date_publication: source.date, date_consultation: verifie_le }`. `date_consultation` = upstream `verifie_le` because it is the only date at which someone opened the cited source; the import date would claim a consultation that did not happen | MEDIUM `[ASSUMED]` |
| `statuts[0].statut_relecture` | `brouillon` (no reviewer) | HIGH |
| `parti`, `parti_source` | `parti` = upstream `parti` **only if** a primary claim source exists: `parti_source = { type: parti, url: liens.parti }` else `{ type: candidat, url: liens.campagne }`, with `date_consultation = verifie_le`. Otherwise `parti: null` (schema allows null; a string would require `parti_source`). 35 rows get a party, **24 rows get `null`**: royal, bouamrane, hollande, vallaud, autain, castets, becht, le-maire, darmanin, platret, wauquiez, barnier, bardella, knafo, mathieu, lalanne, durif, billetdoux, collovati, legendre, markovic, rohou, lucas-lundy, brun `[VERIFIED: script]` | MEDIUM `[ASSUMED]` |
| `site_officiel` | `liens.campagne` when present | HIGH |
| `bloc`, `propositions`, `statut_detail`, other `liens` | dropped (kept only in the raw snapshot) | HIGH |
| `mandats_en_cours`, `ordre_cc`, `wikidata` | not set | HIGH |

Wikipedia links are not stored (no field, not primary).

### Importer design (CONT-01 / CONT-02)

- **Files:** `scripts/import-datagouv.ts` (CLI), `scripts/lib/datagouv.ts` (pure: `mapRow(row, corr)`, `mergeFiche(existing, mapped)`, `renderYaml(obj)`), `data/import/correspondances.yaml` (hand table), `data/import/2027etmoi-candidats-<mise_a_jour>-<sha12>.json` (raw bytes, byte-exact) with a sibling `.meta.json` (`url_initiale`, `url_finale`, `etag`, `fetched_at`, `sha256`, `bytes`, `mise_a_jour`, `rows`), `data/import/README.md` (attribution and the "never import bloc/propositions" rule), `.gitattributes` line `data/import/*.json -text` so the sha256 survives Windows checkouts. `package.json`: `"import:datagouv": "node scripts/import-datagouv.ts"`.
- **Flags:** `--file <local.json>` (offline, tests), `--url` (default the stable resource URL), `--dry-run` (print the report, write nothing), `--root` (like validate).
- **Steps:** fetch or read, sha256, compare with the newest snapshot (**same sha256 means no new snapshot and no diff**), validate the upstream shape (array of objects with the 10 keys; any unknown top-level key is reported), map, write fiches, print the report.
- **Merge policy (append-only):** a missing fiche is created. An existing fiche keeps `id`, `prenom`, `nom`, `nom_tri`, `ids_externes` untouched. If `(code, motif)` differs from the last `statuts[]` entry, or the upstream date is later, a new entry is **appended** (never edit or drop an old one); if only the source URL changed for the same `(code, motif, date)`, report a "source changed" line and do not write. A fiche whose upstream row vanished is reported, never deleted (the id stays in `ids.lock`). `parti` / `site_officiel` changes are reported, not applied. Exit 1 on unknown ids or on a date regression.
- **Emission:** `yaml.stringify(obj, { schema: 'core', indent: 2, indentSeq: true, lineWidth: 0 })` with keys inserted in a fixed order (`version_schema, id, prenom, nom, nom_tri, parti, parti_source, site_officiel, ids_externes, statuts`). Verified round-trip. **No YAML comments** (D-13).
- **Diff for review:** the git diff of `src/content/candidats/*.yaml` plus the printed report (created / appended / unchanged / missing upstream / conflicts) is the "diff relisible". A second run on the same snapshot must produce an empty `git diff` (acceptance test).
- **`ids.lock`:** Phase 2 plan 02-01 creates `ids.lock`, `scripts/ids.ts` and `src/lib/content-core/ids-lock.ts` (`ajouterIds`). If Phase 2 has landed, the plan step is `npm run ids -- --write` after generating fiches, otherwise the 59 ids are picked up by Phase 2 later. The importer must not import Phase 2 code.
- **Attribution (LICENSE §4 says "modalités... détaillées en phase 3"):** add `data/import/ATTRIBUTION.md` and amend LICENSE §4 with: « Source : 2027 et moi (https://2027etmoi.fr), données mises à jour le 28/10/2026, Licence Ouverte 2.0 » plus the data.gouv dataset URL; keep `ids_externes.2027etmoi` on each fiche as the per-record trace. INST-01 and the candidate-page footer (Phases 4-5) read the date from the snapshot meta.
- **Phase 2 interplay:** `CHAMP_NON_IMPORTABLE` scans keys under `src/content/` only, so the raw snapshot under `data/import/` (which does contain `bloc` and `propositions`) is legal; keep it out of `src/content/`, out of `public/`, and out of `dist/`.

## Archiving tool design (CONT-03)

### CLI

```
node scripts/archive-source.ts <url> --candidat <id> --source-id <slug> --type <programme|site_candidat|site_parti|discours|tribune|depot_cc>
      --auteur <candidat|parti_du_candidat|coalition> --titre "<titre>" --date-publication <AAAA[-MM[-JJ]]>
      [--file <local.pdf|local.html>] [--render] [--wayback] [--push] [--root .] [--dry-run]
```
Outputs: (1) `archives/<candidat>/<sha12>.txt` in the public repo, (2) `src/content/sources/<source-id>.yaml` created or updated with the `archive` block (`extrait`, `sha256`, `capture_le`, `wayback_url` when obtained, `binaire_sha256`), (3) the binary and a `<binary_sha12>.json` metadata file in the private clone, (4) a printed summary with warnings. The tool never edits `src/content/mesures`.

### Capture tiers

| Tier | When | How | Evidence |
|------|------|-----|----------|
| 1. fetch (default) | SSR HTML, PDF | `fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'reveleTonProg-archiver/0.1 (+https://github.com/ErwanHenry/reveleTonProg)' } })`; HTML decoded with the charset from `content-type` or `<meta charset>` (`new TextDecoder(label)`), then stripped to text; PDF bytes to `pdftotext -enc UTF-8 <file> -` | 41 of 43 candidate URLs answered 200 to this approach |
| 2. `--render` | client-rendered shell (HTML above 30 KB but fewer than 1 200 text chars), or visitor-faithful text wanted | Playwright `chromium.launch()`, fresh context (no storage), `waitUntil: 'networkidle'`, `document.body.innerText` for the `.txt`, `page.content()` as the binary | On 9 sampled pages rendered text was between +3% and -52% of the fetched text (e.g. 5 351 vs 10 530 chars on attalpresident.fr/programme, where fetch also counts menus), and no JS-only content was found; the gain is fidelity, not coverage |
| 3. `--file` | bot-blocked (403), paywalled, login, robots-blocked | Erwan saves the page or PDF from his own browser; the tool ingests the local file, records the original URL | Batho's two sites answer 403 even to a headless browser; do not attempt to evade bot protection |

### Text extraction rules (all pure and unit-tested)

1. Normalize the extract: NFC, CRLF to LF, strip trailing spaces, exactly one final `\n`, UTF-8 without BOM. sha256 and file name (`<first 12 hex>.txt`) are computed from these final bytes.
2. **Cap:** refuse above 5 MiB (`5 * 1024 * 1024`) with a message; binaries above 50 MiB are refused (GitHub blocks pushes over 100 MB `[ASSUMED]`).
3. **Non-empty:** warn and exit non-zero below 500 characters (PITFALLS.md guard); the quote check would otherwise pass or fail on nothing.
4. **U+FFFD:** exit non-zero if the extract contains U+FFFD unless `--allow-replacement-chars`. Observed: pdftotext turned `tt` ligatures into `�` in some PDFs (`a�endu`, `ce�e`), 6 691 occurrences across 3 of 513 extracted pages `[VERIFIED: crawl]`. A quote crossing such a glyph can never match; the executor picks another passage or re-captures.
5. Report counts of soft hyphens, zero-width characters (stripped by Phase 2's `cleanText` anyway) and lines ending in `-`; do **not** dehyphenate silently.
6. Two-column PDFs interleave columns (seen on the Philippot PDF): the executor must choose quotes inside a single paragraph and rely on `npm run validate` (REGLE-05) as the oracle.
7. HTML named entities: the built-in stripper decodes numeric entities and a small named table; **warn if `&[a-z]+;` remains** (a quote with a raw `&eacute;` would fail verbatim). `--render` avoids this entirely.
8. Page structure noise (menus, cookie banners, forms) stays in the extract; harmless because `texte_source` is a short passage. Exclude nothing automatically.

### Dates and fields the tool cannot invent

`date_consultation` = capture day (Europe/Paris date). `capture_le` = ISO instant with `Z` or offset (the project's `date-time` format accepts both `[VERIFIED: ajv.ts]`). `date_publication` has no reliable automatic source: use, in this order, a visible "Mis à jour le" (Retailleau pages show "Mis à jour le 24 septembre 2026"), the PDF `CreationDate` (`pdfinfo`), `Last-Modified`, else a partial `AAAA-MM` from the page, else the plan stops and asks (never guess). The tool refuses to write a source without `--date-publication`.

### Private binary repository

- Create once: `gh repo create ErwanHenry/reveleTonProg-archives --private --description "Binaires d'archives de reveleTonProg (PDF, HTML rendu). Privé, droits réservés à leurs auteurs." --clone` `[CITED: cli.github.com/manual/gh_repo_create]`; authorized by CONTEXT, token has the `repo` scope, repo absent today `[VERIFIED]`. Local clone next to the project (`../reveleTonProg-archives`) or `RTP_ARCHIVES_DIR`; fail with a clear message when neither exists.
- Layout: `<candidat>/<binary_sha12>.<pdf|html>` + `<binary_sha12>.json` (`source_id`, `url`, `final_url`, `content_type`, `bytes`, `binary_sha256`, `txt_sha256`, `captured_at`, `tool`). One initial `README.md` saying "privé, ne jamais publier".
- `--push` runs `git -C <clone> add . && git commit -m "archive: <source-id>" && git push`; without `--push` it only stages locally. The Règle d'or (code survives a VM wipe) applies: the plan must end with a push.
- gitleaks runs on the **public** repo history with default rules and no `.gitleaks.toml` today: long hex strings or URLs in programme extracts could trigger a false positive. Mitigation if it happens: add a `[allowlist] paths = ['''archives/''']` config, not a rule disable. `[ASSUMED]` (not triggered yet because no extract is committed).

### Internet Archive Save Page Now (anonymous), measured 2026-11-03

| Observation | Evidence |
|---|---|
| `GET https://web.archive.org/save/<url>` (anonymous) answered **302** with `Location: https://web.archive.org/web/20261103014534/https://example.org/`, then 200 on the snapshot, 8.3 s total. The Location matches the schema pattern `^https://web\.archive\.org/web/[0-9]{14}/` | `[VERIFIED: curl -D]` |
| The returned snapshot (01:45 UTC) was about 12 h older than the request (13:32 UTC): SPN can hand back an existing capture rather than create one. Store the URL anyway, parse the 14-digit timestamp and **warn when it is more than 24 h older than our capture** | `[VERIFIED]` |
| A heavily archived URL (`example.com`) answered **HTTP 429** immediately with an HTML page: "This URL has been already captured 5 times today, which is a daily limit we have set for that Resource type" | `[VERIFIED]` |
| Two later requests for the same URL **hung for more than 100 to 120 s** (client timeout) | `[VERIFIED]` |
| Snapshot responses carry `Link: <original>; rel="original", ...timemap, ...timegate` and `x-archive-src: spn2-...warc.gz`; there is no `Content-Location` on the 302 | `[VERIFIED]` |
| Documented limits (SPN2 draft docs): anonymous users 6 concurrent captures, 4 000 per day, 10 per URL per day; a search result adds "3 captures per minute anonymous" (sources disagree on the daily figure); job status `GET /save/status/<job_id>` is only for the authenticated POST API | `[CITED: gist.github.com/regstuff/82e690db2f1d91ba59f6681c1abad6cf]`, MEDIUM |
| Read-only availability probes (`archive.org/wayback/available`) also rate-limit (429 on the first call); the CDX endpoint answered (`attalpresident.fr/programme` has captures from 2026-06-03) | `[VERIFIED]` |

Client design (about 25 lines, no dependency): one request at a time, at least 20 s between submissions, `fetch(..., { redirect: 'manual', signal: AbortSignal.timeout(150000) })`, accept a `3xx` whose `Location` matches the pattern, treat 429, timeout, non-matching Location as a **warning** with a `--wayback-only <source-id>` resume command that fills `archive.wayback_url` later. Never block the import of a source on SPN. About 27 programme-bearing candidates and maybe 40 URLs means roughly 15 minutes of spaced submissions: run it as a separate resumable pass at the end of each theme plan.

### Code example: Wayback submission

```typescript
// Source: behaviour measured on 2026-11-03 (see table above); no library.
const SNAPSHOT = /^https:\/\/web\.archive\.org\/web\/[0-9]{14}\//;
export async function submitWayback(url: string): Promise<{ ok: true; waybackUrl: string; ageHours: number } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`https://web.archive.org/save/${url}`, {
      redirect: 'manual',
      headers: { 'user-agent': 'reveleTonProg-archiver/0.1 (+https://github.com/ErwanHenry/reveleTonProg)' },
      signal: AbortSignal.timeout(150_000),
    });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc !== null && SNAPSHOT.test(loc)) {
      const ts = /\/web\/([0-9]{14})\//.exec(loc)![1]!;
      const t = Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10), +ts.slice(10, 12), +ts.slice(12, 14));
      return { ok: true, waybackUrl: loc, ageHours: (Date.now() - t) / 3_600_000 };
    }
    return { ok: false, reason: `HTTP ${res.status}${res.status === 429 ? ' (plafond quotidien par URL)' : ''}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.name : 'erreur réseau' };
  }
}
```

### Testability

Pure functions get `node:test` coverage with frozen inputs: HTML to text (entities, scripts, charset), extract normalization, sha and path naming, 5 MiB cap, U+FFFD detector, source-YAML builder (round-trips through the project's own Ajv), SPN `Location` parser with a mocked `fetch`. Network and browser paths are **not** in `npm test` (Phase 1 rule: only `skeleton.test.ts` runs `astro build`); they have a manual smoke command in the RUNBOOK.

## Coverage research (CONT-04), an estimate to re-verify

### Method and its limits

For each of the 37 `declare` candidates a crawler (research scripts in `/tmp`, not shipped) fetched the candidate's own sites (dataset `liens.campagne|programme|parti`, plus sites found by web search for the 11 candidates without links), followed internal links toward programme-like pages and PDFs (up to 60 pages and 10 PDFs per candidate, same host only), then counted, per theme, sentences that name the theme **and** begin like a commitment (infinitive verb, "nous/je" + future, "sera/doit"). I then read snippets for every candidate and corrected false positives (for example "quinquennat" counted as an institutions match, "dépendance aux importations" counted as retraites) and false negatives (bullet lists without verbs, PDF columns). Symbols: **●** a dedicated theme page or section, or at least 3 clear position statements; **◐** 1 to 2 statements or an indirect/principle-level statement; **○** a programme exists but nothing on this theme was found; **×** no programme-grade primary source found.

Limits that must stay visible: (1) keyword matching under-detects bullet lists and over-detects boilerplate, so ● and ◐ are best read as "likely" and "possible"; (2) 6 sites are only partly explored (Ruffin cahiers, Tondelier 557-measure project page, Legendre manifesto, Bouamrane PDF, Branco/Ruches, Lalanne); (3) Mélenchon's *L'Avenir en commun* (1 069 measures) is not reachable online (the dataset link redirects home, the book "disponible le 6 novembre"), so his row only reflects thematic plans; (4) "Synthèse des contributions" on melenchon2027.fr is supporters' input, not the candidate's position, and was excluded; (5) the Cazeneuve "Synthèse des mesures" PDF is a third-party summary of the letter; the letter itself is the source; (6) party documents count as `parti_du_candidat`, not the candidate's own words (schema `auteur` carries the difference); (7) older programmes (UPR 2012-2022, RN 2024 legislative) were excluded as not 2027; (8) sites found by web search were stale twice (lalanne2027.com is a parked domain, durif2027.com a satirical page), so **every URL must be re-fetched live in execution**. Everything here is dated 2026-11-03 and must be re-measured when the plan runs.

### Matrix: 37 `declare` candidates x 10 spec themes (research estimate)

Column order: logement, école, retraites, santé, sécurité, climat, travail, impôts, Europe et monde, institutions.

| Candidat | L É R S Sé C T I E In | Primary source(s) found (live 2026-11-03) |
|---|---|---|
| Nathalie Arthaud | × × × × × × × × × × | nathalie-arthaud.info, lutte-ouvriere.org: militant sites, no 2027 programme |
| François Asselineau | × × × × × × × × × × | upr.fr/notre-programme: only 2012, 2017, 2022 |
| Gabriel Attal | ◐ ● ◐ ◐ ● ● ● ● ● ● | attalpresident.fr/programme (5 chantiers, thematic filters, about 100 `/programme/mesures/*` pages) |
| Delphine Batho | × × × × × × × × × × | delphinebatho.fr, generationecologie.fr: HTTP 403 to automated clients (manual capture) |
| Olivier Becht | ● ● ● ● ● ● ● ◐ ● ● | becht2027.fr/projet-france (5 refondations) + book in 9 PDF parts |
| Xavier Bertrand | × × × × × × × × × × | nousfrance.fr/programme/*: pages reduced to a title (about 700 chars) |
| Augustin Billetdoux | × × × × × × × × × × | billetdoux2027.fr: general idea and testimonials, no measure |
| Karim Bouamrane | ◐ ◐ ○ ◐ ◐ ◐ ○ ○ ◐ ○ | karimbouamrane2027.org/manifeste.html + PDF (principle-level manifesto) |
| Juan Branco | ◐ ◐ ◐ ◐ ◐ ○ ◐ ● ◐ ● | ruches.org/le-projet + PDF (movement Les Ruches: `auteur` coalition or parti, to settle) |
| Bernard Cazeneuve | ● ● ● ● ● ● ● ● ● ● | la-convention.fr/lettre (126 k chars) + PDF "Aux Français" (122 k) |
| Christian Collovati | ◐ ◐ ● ○ ● ○ ◐ ◐ ◐ ◐ | site "Le Peuple français" (`xn--lepeuplefranais2027-hyb.fr`), 2 pages, found by web search |
| Emmanuel Dubuisson | ○ ○ ◐ ● ● ○ ◐ ● ○ ● | dubuisson2027.fr/dossiers/1 to 12 (santé, sécurité, justice, fiscalité, référendum) |
| Nicolas Dupont-Aignan | ● ● ● ● ● ● ● ● ● ● | debout-la-france.fr/projet/<thème>/ (34 thematic pages) + dupontaignan.fr |
| Sylvain Durif | × × × × × × × × × × | durif2027.com: satirical page, no programme |
| Clara Egger | ○ ○ ○ ○ ○ ○ ○ ○ ○ ● | solutiondemocratique.fr/parrainage2027: purely institutional project |
| Raphaël Glucksmann | ● ● ● ● ● ● ● ● ● ● | place-publique.eu: PDF "Projet Acte 1" (107 k) + open letter |
| Anasse Kazib | ● ◐ ● ◐ ● ◐ ● ◐ ● ● | anasse2027.fr/programme (6 axes "Ce que nous voulons") + leaflet PDF; page says "programme 2027 en cours d'élaboration" |
| Selma Labib | × × × × × × × × × × | npa-revolutionnaires.org: press releases, no 2027 programme |
| Francis Lalanne | × × × × × × × × × × | lalanne2027.com parked; dieudolalanne2027.com/projet 404 |
| Marine Le Pen | ◐ ● ◐ ● ● ◐ ● ● ◐ ◐ | rassemblementnational.fr: thematic booklets (PDF santé, entreprise, immigration) + `/22-mesures` |
| Jean-François Legendre | ○ ○ ○ ○ ○ ○ ○ ◐ ○ ◐ | anousmaintenant.fr: founding manifesto (not fully read), 1 page |
| David Lisnard | ◐ ● ◐ ● ● ◐ ● ● ◐ ● | unenouvelleenergie.fr/notre-programme/<thème> (éducation, sécurité, santé, agriculture, immigration) |
| Mira Markovic | ○ ○ ○ ◐ ○ ◐ ○ ◐ ◐ ◐ | parti-animaliste.fr/programme: party programme (animals, agriculture); no presidential programme yet |
| Benoît Mathieu | ○ ○ ○ ○ ○ ○ ○ ○ ○ ● | benoitmathieu2027.fr/programme: democracy (citizens' assembly, new Constitution), "no imposed programme" |
| Jean-Luc Mélenchon | ● ◐ ◐ ● ○ ● ◐ ● ◐ ○ | melenchon2027.fr/programme/plans-thematiques (esr, ruralité), `/plans-investissement` (btp-logement, automobile), 2 PDF; the book is not online |
| Antoine Mikolajczak | ○ ○ ○ ○ ◐ ● ○ ○ ○ ● | parti-equinoxe.fr/presidentielle-2027 + manifesto PDF (45 k) + citizens' conventions page |
| Manolo Mlekuz | ○ ◐ ○ ○ ○ ○ ○ ○ ○ ● | trajectoire2027.fr/programme + detailed programme PDF (52 k): institutional project |
| Édouard Philippe | ○ ● ● ○ ● ◐ ◐ ● ● ○ | edouardphilippe.fr/priorites/* (4 pages) + horizonsleparti.fr/le-manifeste |
| Florian Philippot | ◐ ● ● ● ● ● ● ● ● ● | les-patriotes.fr: PDF "Grandes orientations pour un projet patriote 2026-2027" (79 k) |
| Gilles Platret | × × × × × × × × × × | no campaign site found (announcement 8-9 Oct relayed by press) |
| Natacha Polony | ○ ◐ ○ ◐ ○ ○ ○ ○ ○ ◐ | natachapolony2027.fr/natacha-polony/ma-vision, `/mes-principes` (principle texts) |
| Bruno Retailleau | ● ● ● ○ ◐ ◐ ● ● ◐ ● | avecretailleau.fr/projet/theme/* (11 themes listed, 120 measures, one page per measure; site announces 18 themes) |
| Erwan Rohou | ◐ ○ ● ○ ○ ● ○ ◐ ◐ ○ | les-ecologistes-mei.org/notre-programme (10 points; "Livre Blanc" announced) |
| Fabien Roussel | ● ◐ ● ● ○ ◐ ● ● ◐ ○ | pcf.fr/objectif_1 (10 employment measures) + PDF cahiers (logement, sécurité sociale, mobilité, paix) |
| François Ruffin | ◐ ○ ◐ ○ ○ ◐ ◐ ◐ ◐ ◐ | debout.fr/notre-manifeste + nouspresident.fr (campaign "cahiers", to explore) |
| Marine Tondelier | ◐ ◐ ○ ● ○ ● ◐ ◐ ○ ○ | marinetondelier.fr/livrets-thematiques (PDF) + lesecologistes.fr/…/projet-2027 (557 measures, to explore) |
| Éric Zemmour | × × × × × × × × × × | parti-reconquete.fr: consultation "Le Programme pour la France" under way, no programme |

### Tallies (37 candidates)

| Thème | ● | ◐ | ○ | × | ● + ◐ |
|---|---|---|---|---|---|
| logement | 8 | 10 | 9 | 10 | 18 |
| école | 10 | 9 | 8 | 10 | 19 |
| retraites | 11 | 7 | 9 | 10 | 18 |
| santé | 11 | 6 | 10 | 10 | 17 |
| sécurité | 12 | 4 | 11 | 10 | 16 |
| climat | 10 | 9 | 8 | 10 | 19 |
| travail | 11 | 7 | 9 | 10 | 18 |
| impôts | 13 | 8 | 6 | 10 | 21 |
| Europe et monde | 8 | 11 | 8 | 10 | 19 |
| institutions | 15 | 6 | 6 | 10 | 21 |

27 candidates have at least one programme-grade source; 10 have none (all cells `programme_non_publie`: Arthaud, Asselineau, Batho, Bertrand, Billetdoux, Durif, Labib, Lalanne, Platret, Zemmour). Several of these may change before December (Arthaud, Zemmour, Batho are likely to publish; Batho needs a manual capture).

### Decision rule applied and recommendation

Rule (CONTEXT): keep the 3 themes with the best primary-source coverage of `declare` candidates; ties go to the Aîné priority themes (retraites, santé, dépendance, succession, logement). Metric chosen here: number of candidates with a position (● + ◐), then number of ● as first tie-break, then the Aîné rule.

1. **institutions**: 21 (15 strong). Best on both metrics; also the only theme where six micro-candidates (Egger, Mlekuz, Mathieu, Mikolajczak, Legendre, Polony) have something to show.
2. **impôts**: 21 (13 strong). Number-heavy, which exercises REGLE-04 (CHIFFRE_HORS_SOURCE) on real data.
3. Third place is **not separable**: école, climat and Europe at 19, retraites, travail and logement at 18, sécurité leads on strong (12) but is last on any-position (16). Differences of 1 to 3 cells are inside the estimate's error. This is exactly the case the Aîné tie-break exists for: within that band the Aîné priority themes are retraites (18, 11 strong), logement (18, 8 strong) and santé (17, 11 strong). **retraites** has the best joint score, so it wins.

**Provisional pilot themes: `institutions`, `impots`, `retraites`.** Alternates in order: logement (Aîné, but only 8 strong), santé, école. The plan must re-run the measurement with human-checked cells and **stop at a `checkpoint:decision` only if the measured top 3 differs from this list** (CONTEXT already accepted the rule, not these numbers). The final table goes to `data/couverture-themes.yaml` (machine-readable, for the Méthode page) and `docs/COUVERTURE-THEMES.md`.

Expected cell outcomes for the provisional pilot (111 cells = 3 themes x 37): about 60 with at least one measure (institutions 21, impôts 21, retraites 18), about 21 `non_precise` (a programme exists but is silent on the theme; needs `sources_consultees` pointing to archived sources), 30 `programme_non_publie` (10 candidates x 3).

## Pilot corpus production (CONT-05 / CONT-06)

### What Phase 2 enforces on drafts (binding on authoring)

From `02-RESEARCH.md` and the Phase 2 plans: `LONGUEUR_HORS_BORNES` is an **error for every `statut_relecture`** (résumé at most 25 words, détaillé 80 to 200, enfant 40 to 60, aîné 60 to 120; assumption A4); `CHIFFRE_HORS_SOURCE` for any figure in résumé, enfant, aîné that is not in `texte_source` or `chiffrage`; `CITATION_HORS_SOURCE` for any `« … »` span not in `texte_source`; `TEXTE_SOURCE_HORS_ARCHIVE` for a `texte_source` not verbatim (after normalization) in the `.txt`; `MOT_INTERDIT` in titre and the four rédactions; `PHRASE_ENFANT_LONGUE` is only a warning in `brouillon`; Kandel-Moles below 80 is a warning (expect many); `ARCHIVE_WAYBACK_ABSENTE` only matters for `publie`. Glossary markers in rédactions are `[[affiché]]` or `[[affiché|id]]` (A2), resolved by `REFERENCE_CASSEE`. Verbatim normalization: case, punctuation and line breaks ignored, accents significant, hyphen is a separator, `[…]` splits a quote into fragments.

**Sequencing consequence:** Phase 2's `validate` is the only oracle that catches a 79-word détaillé or an invented figure. Authoring about 360 texts without it means re-drafting them. Do the bulk drafting after Phase 2 plans 02-03, 02-04 and 02-06 are merged; import, archive tool, coverage measurement and the flip can run in parallel with Phase 2.

### Workload model

| Quantity | Estimate | Basis |
|---|---|---|
| Cells to resolve | 111 | 3 themes x 37 declared (primaire is empty today) |
| Cells with measures | about 60 | matrix: 21 + 21 + 18 |
| Measures per cell | 1 to 2 (cap 2) | Retailleau alone has 16 logement and 12 institutions measures; uncapped coverage would be unbalanced and unreviewable |
| Measures | about 90 (range 60 to 120) | 60 cells x 1.5 |
| Rédactions | about 360 (range 240 to 480) | 4 per measure |
| Words to draft | about 28 000 | résumé 25 + détaillé about 130 + enfant 50 + aîné 90 = about 300 per measure |
| Sources to archive | 27 to 45 captures | one per programme page or PDF used; `non_precise` cells also need their consulted sources archived |
| Coverage cases | 111 minus measure cells that are `mesures`, all in `couverture/<theme>.yaml` | `etat: mesures` is kept for cells that have a measure |
| Glossary entries | about 40 to 70 terms plus the parties named in enfant texts | institutions is the heaviest (référendum d'initiative citoyenne, proportionnelle, septennat, Constitution) |

**Cap and selection rule (to put in the Méthode page):** at most 2 measures per candidate per theme; the first 2 that the candidate's own source states under that theme, in the source's own order, never the "best" or the most striking. Equity is about the same level of detail, so the cap is the same for everyone. If a source has exactly one relevant measure, one is enough.

### Authoring rules for the agent (put in each theme plan)

1. `texte_source` is copied from the `.txt` extract, 1 to 3 sentences, never paraphrased; avoid passages crossing a hyphenated line break or a U+FFFD.
2. Every figure in résumé, enfant, aîné is in `texte_source`; otherwise write the idea without the figure.
3. Détaillé may quote `« … »` only text inside `texte_source`; when the source is silent on a point the text says "le programme ne précise pas ..." (CONTEXT).
4. Enfant: sentences of at most 15 words, no jargon without `[[terme]]`, no party names without `[[Parti|id]]`.
5. `titre` is neutral and descriptive, no forbidden word, no connoted verb (promet, prétend, assure ...).
6. `statut_relecture: brouillon`, no `relecteur`. Themes: `statut_relecture: brouillon`.
7. `couverture` cases: `verifie_le` = date of the check, `verifie_par` = a free-text actor such as `Claude (agent), à relire par Erwan Henry`; Erwan replaces it at relecture. `non_precise` needs `sources_consultees` (slugs of archived sources).
8. File naming: `src/content/mesures/<candidat-id>/<theme>-<sujet>.yaml`, id `<candidat-id>/<theme>-<sujet>` (the file is keyed by candidate, so prefix the theme to stay unique); `src/content/sources/<candidat>-<document>.yaml`; `archives/<candidat>/<sha12>.txt`.
9. Theme files `src/content/themes/{institutions,impots,retraites}.yaml`: `ordre`, `prioritaire_aine: true` for retraites, `sous_themes` listed from the vocabulary that the sources actually use (decide after the measure inventory, not before).

### Suggested plan slicing (mode mvp, coarse)

| Plan | Wave | Content | Requirements | Notes |
|---|---|---|---|---|
| 03-01 | 1 | Importer, hand table, snapshot, attribution (LICENSE §4, `data/import/ATTRIBUTION.md`), 59 fiches, ids step | CONT-01, CONT-02 | Erwan reviews the `?` motifs and the 24 `parti: null` rows in the PR |
| 03-02 | 1 | Archive tool (pure modules + CLI), `gh repo create`, RUNBOOK entry, manual smoke on one real URL | CONT-03 | Independent of 03-01. Contains the `checkpoint:human-verify` for `@playwright/test` if the `--render` tier is kept |
| 03-03 | 2 | Coverage measurement over 37 x 10, `data/couverture-themes.yaml`, `docs/COUVERTURE-THEMES.md`, theme choice (checkpoint only if it differs from the provisional list) | CONT-04 | Needs 03-01 for ids and 03-02 for archiving the consulted sources |
| 03-04, 03-05, 03-06 | 3 (parallel) | One plan per pilot theme: theme file, sources + archives (+ Wayback pass), measures in batches of about 10 candidates, couverture file, glossary entries, `validate` clean | CONT-05, CONT-06 | Each plan is one reviewable PR; the three are file-disjoint except `glossaire/` (distinct ids) |
| 03-07 | 4 | Flip `DEFAULT_CONTENT_ROOT` to `.`, test/CI/docs edits, real-corpus integrity test (every declared candidate x pilot theme resolved; every marker resolves; every party named in an enfant text is a marker), phase verification | CONT-05, CONT-06 | Last, to avoid conflicts with Phase 2 plans 02-05 and 02-06 |

Review chunking inside a theme plan: batches of about 10 candidates, ordered alphabetically by `nom_tri` (never by programme completeness), each batch ending with `npm run validate -- --mode preview` and a commit.

## Flipping `DEFAULT_CONTENT_ROOT` to `.` without breaking tests

Today `src/lib/content-core/root.ts` has `export const DEFAULT_CONTENT_ROOT = 'tests/fixtures/corpus-valide'`. Files that depend on the default `[VERIFIED: grep + read]`:

| File | Dependence | Edit |
|---|---|---|
| `src/lib/content-core/root.ts` | the constant and its comment | `'.'`; update the comment |
| `tests/content-core/astro-parity.test.ts` test 1 | `withEnv(undefined, ...)` and `resolveContentRoot(REPO_ROOT, {})` then expects `marie-fictive` and `filePath = tests/fixtures/...` | pass `FIXTURE_ROOT` in both places (`withEnv(FIXTURE_ROOT, ...)`, `resolveContentRoot(REPO_ROOT, { RTP_CONTENT_ROOT: FIXTURE_ROOT })`) |
| `tests/content-core/validate-cli.test.ts` "sans option" | runs `scripts/validate.ts` with no root and expects a clean summary | add `--root <FIXTURE_ROOT>` to that test; add a new test "sans option valide le vrai corpus" (exit 0) |
| `tests/migrations/cli.test.ts` "--check sur le corpus par défaut" | same | add `--root <FIXTURE_ROOT>`; keep a second assertion on the real root |
| `tests/content-core/schema-load.test.ts` `cli()` | deletes `RTP_CONTENT_ROOT`; the tests that use it only check schemas, but verify none asserts fixture counts | read; most likely no edit |
| `tests/dist/skeleton.test.ts` | passes `RTP_CONTENT_ROOT` explicitly in `build()` | none |
| new `tests/repo/default-root.test.ts` | — | asserts `DEFAULT_CONTENT_ROOT === '.'`, `resolveContentRoot(root, {})` equals the project root, and an empty `RTP_CONTENT_ROOT` equals absent |
| `.github/workflows/ci.yml` + `tests/repo/ci.test.ts` | "(corpus par défaut)" steps now run the real corpus; `ci.test.ts` line 129 requires migrate/validate steps with `env.RTP_CONTENT_ROOT === '.'` | make the existing default steps explicit with `RTP_CONTENT_ROOT: tests/fixtures/corpus-valide` (rename "corpus fictif") and keep the explicit `"."` steps; extend `ci.test.ts` to require both |
| `src/pages/index.astro` | footer says "Données fictives à des fins de test" and the title says "(corpus fictif)"; with `.` the page lists 59 real candidates under a false label | change the label to a neutral "Squelette de développement : contenu en brouillon, non relu" and update `skeleton.test.ts` (a) assertions (`<\/span>\s+à des fins de test`, "Données fictives"), keeping a `<span>` followed by text so the inline-space check survives |
| `src/lib/content-core/astro-loader.ts` | the info log comment "Jusqu'à la Phase 3 ..." | reword |
| `README.md` (section "Racine du contenu"), `docs/RUNBOOK.md`, `.env.example`, `docs/ARCHITECTURE.md` ADR-025 | describe the fixture default | rewrite; ADR-025 gets a successor ADR (append-only practice) "racine par défaut = corpus réel, fixture explicite pour les tests"; `tests/repo/docs.test.ts` only checks that `RTP_CONTENT_ROOT` is mentioned |

Conflicts to plan for: Phase 2 plan 02-05 edits `root.ts`, `astro-loader.ts`, `.env.example`, `validate-cli.test.ts`, `astro-parity.test.ts`; plan 02-06 edits `ci.yml`, `ci.test.ts`, `validate-cli.test.ts`; Phase 2 and Phase 3 both add `package.json` scripts (`ids`, `import:datagouv`, `archive`). Therefore the flip is the last plan and rebases on whatever Phase 2 has merged.

Behaviour to remember after the flip: `npm run build` uses the real corpus in `production` mode (Phase 2 default mode), where Phase 4 will show only `publie` content, i.e. nothing yet; the visible preview needs `RTP_MODE=preview` (Phase 2 plan 02-05 `resolveMode`). The skeleton page lists every candidate regardless of mode today.

## Architecture Patterns

### System Architecture Diagram

```
 data.gouv resource URL --302--> 2027etmoi.fr/data/candidats.json
            |                         (62 986 B, ETag, mise_a_jour)
            v
 scripts/import-datagouv.ts --sha256--> same as newest snapshot? --yes--> stop (no diff)
            | no
            v
 data/import/<snapshot>.json + .meta.json     data/import/correspondances.yaml (hand: id, prenom, nom, nom_tri, motif)
            |                                          |
            +--------------- mapRow / mergeFiche <-----+   unknown upstream id --> exit 1, list
                                   |
                                   v
              src/content/candidats/<prenom-nom>.yaml (59)  --> npm run ids -- --write (Phase 2, if present)
                                   |
                                   v
                          npm run validate (schema + Phase 2 rules)

 candidate source URL / local file
            |
            v
 scripts/archive-source.ts --tier 1 fetch | 2 render | 3 --file--> bytes
            |                                                   |
            | text (html strip | pdftotext | innerText)          +--> private clone <candidat>/<sha12>.<ext> + .json --git push--> ErwanHenry/reveleTonProg-archives
            v
 normalize -> sha256 -> archives/<candidat>/<sha12>.txt  --> src/content/sources/<id>.yaml (archive block)
            |
            +--> web.archive.org/save/<url> --302 Location--> archive.wayback_url   (failure = warning, resumable)

 coverage scan (37 x 10) --> data/couverture-themes.yaml + docs/COUVERTURE-THEMES.md --> 3 pilot themes
            |
            v
 per theme: themes/<t>.yaml, sources/*, mesures/<candidat>/<t>-*.yaml (brouillon), couverture/<t>.yaml, glossaire/*.yaml
            |
            v
 npm run validate -- --mode preview (Phase 2 rules) --> reviewable PR per theme --> Erwan's relecture (outside this phase)
```

### Recommended project structure
```
scripts/
├── import-datagouv.ts          # CLI
├── archive-source.ts           # CLI
└── lib/{datagouv.ts,archive.ts,wayback.ts}   # pure modules, unit-tested
data/
├── import/{correspondances.yaml,README.md,ATTRIBUTION.md,<snapshot>.json,<snapshot>.meta.json}
└── couverture-themes.yaml
docs/COUVERTURE-THEMES.md
archives/<candidat>/<sha12>.txt
src/content/{candidats,themes,sources,mesures/<candidat>,couverture,glossaire}/
tests/{import,archive,corpus,repo}/...
```

### Anti-Patterns to Avoid
- **Auto-splitting names or inventing ids from upstream slugs:** upstream ids (`faure`) violate the id pattern and splitting fails on particles and compounds.
- **Importing `statut_detail` text into editorial fields:** it is third-party prose; not a schema field.
- **Using a dataset or search-engine URL as a source without re-fetching it:** one programme link redirects home, one search hit was a parked domain.
- **Treating aggregators as sources** (2027etmoi, repere2027, france-vote, civiqo, poligraph, elysee-market): they are leads, never `source.url`.
- **Saving a source with the *requested* URL when the server redirected:** record the final URL (`ruffin2027.fr` ends on `nouspresident.fr`, `marinetondelier.fr/le-programme` ends on `lesecologistes.fr/...`, which also changes `auteur` to `parti_du_candidat`).
- **Evading bot protection** (403) with spoofed browsers: use `--file`.
- **Dehyphenating or "fixing" extracted text:** the extract is evidence; edit nothing, choose other passages.
- **Bulk drafting before Phase 2's validator exists.**
- **Committing a download into `src/content` or a binary into the public repo.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| YAML serialization of fiches and sources | string templates | `yaml.stringify` with the core-schema options above | quoting rules (`no`, `"010"`, colons, dates) are subtle; verified round-trip |
| sha256 | custom | `node:crypto` over raw bytes | byte-exactness |
| PDF text | JS PDF parser | `pdftotext` | no dependency, handles encodings; accept its ligature limits and detect them |
| Wayback client | npm wrapper | 25 lines of `fetch` (above) | one GET, one header |
| HTML rendering for fidelity | headless detection logic | Playwright `innerText` (optional tier) | only if needed |
| Name splitting | regex/heuristics | `correspondances.yaml` | locked decision, verified failure cases |
| Ids registry | new file | Phase 2 `ids.lock` + `npm run ids` | single source |
| Quote verification | own matcher | Phase 2 `npm run validate` | same normalization contract as CI |
| Repo creation | API calls | `gh repo create` | already authenticated |

## Common Pitfalls

### Pitfall 1: Upstream ids are not valid candidate ids
**What goes wrong:** copying `id: faure` fails the schema (`^[a-z][a-z0-9]*(-[a-z0-9]+)+$` needs a hyphen).
**How to avoid:** `prenom-nom` from the hand table; keep the upstream slug only in `ids_externes.2027etmoi`.

### Pitfall 2: `parti` requires a source
**What goes wrong:** `parti: "Parti socialiste"` without `parti_source` fails (`if parti is a string then parti_source required`); 24 rows have no party/campaign link.
**How to avoid:** `parti: null` for those rows, listed in the PR; a later pass can source them.

### Pitfall 3: Status dates and `relu`
**What goes wrong:** `wauquiez` has `2026-07`; a `relu` or `publie` status requires a complete date (schema).
**How to avoid:** leave `brouillon`; flag it for the relecture.

### Pitfall 4: The snapshot is not byte-stable on disk
**What goes wrong:** line-ending conversion changes the sha256.
**How to avoid:** `.gitattributes` `data/import/*.json -text`, write the exact bytes received, hash the buffer.

### Pitfall 5: Remote data changes under your feet
**What goes wrong:** `max-age=300`, unversioned file; the importer's "no diff on rerun" claim breaks if it re-fetches.
**How to avoid:** the tests use `--file` with a committed snapshot; the idempotence check compares sha256 before anything else.

### Pitfall 6: Dead or stale source URLs
**What goes wrong:** dataset link redirecting home (Mélenchon), parked domain (Lalanne), satirical page (Durif), 403 (Batho).
**How to avoid:** live fetch in the plan, record the final URL and HTTP status in the capture metadata, treat "no programme-grade text" as `programme_non_publie` with a dated check.

### Pitfall 7: PDF ligature loss and column interleaving
**What goes wrong:** `�` in extracts; quotes spanning columns fail REGLE-05.
**How to avoid:** U+FFFD gate in the tool, single-paragraph quotes, `validate` as oracle.

### Pitfall 8: Press and aggregators as sources of a measure
**What goes wrong:** `lcp.fr`, `franceinfo.fr` or `2027etmoi.fr` URLs in `mesure.source`.
**How to avoid:** source `type` enum is primary-only (schema); the plan checklist rejects any non-candidate/party host for a measure. A tribune published in a newspaper is allowed only as `tribune`, with the candidate as author.

### Pitfall 9: Party documents attributed to the candidate
**What goes wrong:** PCF cahiers, Place publique "Projet Acte 1", Les Écologistes' 557 measures, Les Ruches' project are party/movement texts.
**How to avoid:** `auteur: parti_du_candidat` (or `coalition`); phrase the title as "Programme du ..." not "Programme de <candidat>" when the document is the party's; say so in the détaillé.

### Pitfall 10: Wayback returns an old snapshot, rate-limits, or hangs
**What goes wrong:** blocking the import on SPN; recording a snapshot that predates the capture without noticing.
**How to avoid:** warning-only, 150 s timeout, 20 s spacing, resumable `--wayback-only`, age warning.

### Pitfall 11: Equity cap forgotten
**What goes wrong:** Retailleau/Attal/Mélenchon get 8 measures, micro-candidates get 1; the Méthode page cannot defend "same level of detail".
**How to avoid:** the cap of 2 per cell is part of the plan's acceptance test (count per `(candidat, theme)`).

### Pitfall 12: Default-root flip breaks tests and CI silently
**What goes wrong:** tests that relied on the fixture start validating real content; `ci.test.ts` fails on the changed steps.
**How to avoid:** the explicit edit table above; add `default-root.test.ts`; flip last.

### Pitfall 13: Merge conflicts with the parallel Phase 2
**What goes wrong:** both phases edit `root.ts`, `validate-cli.test.ts`, `ci.yml`, `package.json`.
**How to avoid:** plans 03-01 to 03-06 avoid those files; 03-07 owns them.

### Pitfall 14: Node version
**What goes wrong:** the shell default is Node 22.23.3, below the repo's `engines >=24.12`.
**How to avoid:** every plan command uses `fnm exec --using=24`.

## Code Examples

### Deterministic fiche emission (verified)
```typescript
// Source: local run 2026-11-03 against the repo's yaml@2.9.x
import { stringify } from 'yaml';
export const renderYaml = (o: unknown): string =>
  stringify(o, { schema: 'core', indent: 2, indentSeq: true, lineWidth: 0 });
// version_schema: 1 / id: dominique-de-villepin / statuts: / - code: pressenti / date: 2026-10-23 (unquoted) ...
```

### Pure mapping skeleton
```typescript
// Rule set from "Mapping decisions". `corr` is the parsed correspondances.yaml; throws on unknown ids.
export function mapRow(row: UpstreamRow, corr: Correspondances): Fiche {
  const c = corr[row.id];
  if (c === undefined) throw new UnknownUpstreamId(row.id);
  const src = {
    type: c.type_source_statut ?? (HOST_TYPES[new URL(row.source.url).hostname] ?? 'presse'),
    ...(row.source.titre ? { titre: row.source.titre } : {}),
    url: row.source.url,
    date_publication: row.source.date,
    date_consultation: row.verifie_le,
  };
  const partiUrl = row.liens.parti ?? row.liens.campagne;
  return {
    version_schema: 1, id: c.id, prenom: c.prenom, nom: c.nom, nom_tri: c.nom_tri,
    parti: partiUrl ? row.parti : null,
    ...(partiUrl ? { parti_source: { type: row.liens.parti ? 'parti' : 'candidat', url: partiUrl, date_consultation: row.verifie_le } } : {}),
    ...(row.liens.campagne ? { site_officiel: row.liens.campagne } : {}),
    ids_externes: { '2027etmoi': row.id },
    statuts: [{ code: row.statut, ...(row.statut === 'renonce' ? { motif: c.motif } : {}), date: row.source.date, source: src, statut_relecture: 'brouillon' }],
  };
}
```

### `DEFAULT_CONTENT_ROOT` flip test
```typescript
import { DEFAULT_CONTENT_ROOT, resolveContentRoot } from '../../src/lib/content-core/root.ts';
it('la racine par défaut est le corpus réel', () => {
  assert.equal(DEFAULT_CONTENT_ROOT, '.');
  assert.equal(resolveContentRoot('/x/proj', {}), '/x/proj');
  assert.equal(resolveContentRoot('/x/proj', { RTP_CONTENT_ROOT: '' }), '/x/proj');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Copy dataset JSON into content (PITFALLS.md) | Import script + hand tables + snapshot | project decision | avoids `bloc`/press labels |
| "curl snapshot of campaign sites" | Fetch for SSR, optional render, manual file for blocked sites | this research | no empty shells found, but 403 cases exist |
| archive.today | Internet Archive SPN only | 2026-02-20 Wikipedia deprecation | never cite archive.today |
| Playwright always | Optional tier, installed on demand | this research | avoids a 170 MB download for no measured gain |

**Deprecated/outdated:** `lalanne2027.com` (parked), the dataset's Mélenchon `liens.programme`, the "51 personnalités" description.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `renonce` motifs (esp. Poutou, Knafo, Brun, Vallaud) | Name table | Wrong public motif; Erwan reviews in the import PR |
| A2 | `statuts[0].date` = upstream `source.date` | Mapping | Status date shows the article date, not the event date |
| A3 | `date_consultation` = upstream `verifie_le` | Mapping | Claims a consultation done by the dataset editors; alternative is the import date |
| A4 | `parti: null` for the 24 rows without party/campaign link; `parti_source` from `liens.parti` else `liens.campagne` | Mapping | Pages read as "Parti non renseigné" for 24 people; a campaign site may not name the party |
| A5 | `jhm.fr` is regional press (type `presse`) | Name table | Wrong status-source badge for Mikolajczak |
| A6 | Coverage matrix cell values (all) | Matrix | The 3rd pilot theme may change; mitigated by the re-measurement step and the checkpoint |
| A7 | Cap of 2 measures per candidate per theme, source order | Workload | Editorial/equity policy; Erwan may prefer 1 or 3 |
| A8 | GitHub rejects pushes with a file over 100 MB and warns at 50 MB | Archiving | Cap for binaries could be mis-set |
| A9 | gitleaks may false-positive on programme extracts | Archiving | CI red on the first extract; mitigation is an allowlist |
| A10 | `@playwright/test` is acceptable as the `--render` dependency (slopcheck not run) | Stack | Gate behind `checkpoint:human-verify`; the tier can be dropped without losing the requirement |
| A11 | `verifie_par` free text `Claude (agent), à relire par Erwan Henry` is acceptable for drafts | Authoring rules | Equity gate (Phase 2) treats it as verified; Erwan replaces it at relecture |
| A12 | Anonymous SPN limits (3/min, 6 concurrent, 4 000/day, 10 per URL per day) | Wayback | Spacing could be too tight or too loose; the client is resumable anyway |

## Open Questions (RESOLVED)

1. **Which 3 themes?**
   - RESOLVED: provisional `institutions`, `impots`, `retraites` from the estimate; the coverage plan re-measures with human-checked cells and stops for a decision only if the measured top 3 differs. Slugs: `institutions`, `impots`, `retraites`.
2. **Playwright or fetch for capture?**
   - RESOLVED: fetch + `pdftotext` by default, `--file` for blocked pages, optional `--render` with `@playwright/test` gated by human-verify; unit tests never load Playwright.
3. **Where does the Licence Ouverte attribution live, given schema v1 has no field?**
   - RESOLVED: `data/import/ATTRIBUTION.md` + LICENSE §4 amendment + `ids_externes.2027etmoi` per fiche + snapshot meta; Phases 4-5 render it.
4. **What goes in `parti` when no claim source exists?**
   - RESOLVED: `null`, listed in the PR (24 rows).
5. **`date_consultation` for imported statuts?**
   - RESOLVED: upstream `verifie_le`.
6. **How many measures per cell?**
   - RESOLVED: cap 2, source order, same for everyone; at least 1 if the source states anything on the theme.
7. **Must the Wayback URL exist for `brouillon` sources?**
   - RESOLVED: no (Phase 2 requires it for `publie` only); a resumable pass fills it in at the end of each theme plan; failure is a warning.
8. **Do binaries get pushed automatically?**
   - RESOLVED: only with `--push`; each theme plan ends with a push of the private clone (Règle d'or).
9. **Should the raw snapshot with `bloc` and `propositions` be committed?**
   - RESOLVED: yes, under `data/import/` only (outside `src/content` and `public`), byte-exact; the importer never reads those fields.
10. **When to flip the default root?**
    - RESOLVED: last plan of the phase, after Phase 2's edits to the same files; fixture stays explicit in tests.
11. **Start bulk drafting before Phase 2 is merged?**
    - RESOLVED: no; import, archive tool, coverage and flip prep may run in parallel, drafting waits for the Phase 2 validator.
12. **Theme and fiche `statut_relecture`?**
    - RESOLVED: `brouillon` everywhere; no file gets a `relecteur`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 via `fnm exec --using=24` | everything | yes | 24.22.2 (shell default 22.23.3) | — |
| npm / registry access | optional Playwright | yes | npm view works | skip `--render` tier |
| `pdftotext` | PDF extraction | yes (MacPorts) | poppler 0.72.0 | `brew install poppler`; on a machine without it the tool exits with an install hint; `--file` with a pre-extracted `.txt` is not allowed (extract must come from the tool) |
| `gh` authenticated | private repo creation and push | yes | user ErwanHenry, scopes `repo workflow` | manual creation in the GitHub UI |
| Network to candidate sites, data.gouv, 2027etmoi.fr | import, capture | yes (41/43 URLs 200 on 2026-11-03) | — | `--file` |
| archive.org Save Page Now (anonymous) | Wayback | flaky | see measured table | warning only, resumable |
| Playwright Chromium revision 1248 | `--render` | no (cache has 1148, 1223, 1234) | `npx playwright install chromium` | skip tier, or pass an existing Chrome via `executablePath` for a smoke test |
| Python 3 | research scripts only | yes 3.9.6 | not needed at runtime | — |
| gitleaks | CI only | CI binary | 8.30.1 | — |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** Playwright browser (optional tier), Phase 2 validator (not yet merged: sequencing constraint above).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` on Node 24.22.2 (native `.ts`), as in `package.json` |
| Config file | none (`"test": "TZ=Europe/Paris node --test \"tests/**/*.test.ts\""`) |
| Quick run command | `fnm exec --using=24 node --test "tests/import/*.test.ts" "tests/archive/*.test.ts" "tests/corpus/*.test.ts"` |
| Full suite command | `fnm exec --using=24 npm test` (Phase 2 baseline 335 tests, about 40 s) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | `mapRow` drops `bloc`, `propositions`, `statut_detail`; every `corr` entry produces a schema-valid fiche; unknown upstream id throws and lists ids; second run on the same snapshot writes nothing; changed status appends a `statuts[]` entry and never rewrites old ones; date regression exits 1; snapshot sha256 matches meta | unit + CLI on a temp root with `--file` | `node --test tests/import/datagouv.test.ts tests/import/import-cli.test.ts` | Wave 0 |
| CONT-02 | the 59 committed fiches validate; 59 distinct ids; `ids_externes.2027etmoi` set; `renonce` rows have `motif`; no `bloc` / `propositions` / `statut_detail` key anywhere under `src/content`; `ATTRIBUTION.md` names the dataset date from the snapshot meta; every upstream id of the committed snapshot has a fiche | integration on real root | `node --test tests/corpus/fiches.test.ts` | Wave 0 |
| CONT-03 | HTML to text (entities, scripts, charset); extract normalization and `<sha12>.txt` naming; 5 MiB cap; U+FFFD gate; empty-text gate; source YAML builder round-trips through Ajv; SPN `Location` parser (302, 429, timeout, bad location) with mocked `fetch`; `--file` path; private-clone layout and metadata JSON | unit (no network, no browser) | `node --test tests/archive/*.test.ts` | Wave 0 |
| CONT-04 | `data/couverture-themes.yaml` has 37 rows x 10 themes, only allowed symbols/states, 3 chosen themes equal the top 3 under the documented rule recomputed from the data | unit on data file | `node --test tests/corpus/couverture-themes.test.ts` | Wave 0 |
| CONT-05 | for each declared/primaire candidate and each pilot theme exactly one of: at least one mesure, or a couverture case; at most 2 mesures per (candidat, theme); every mesure and theme and fiche statuts are `brouillon`; every mesure source has an archive whose file exists and sha256 matches; every `non_precise` case lists archived sources; real corpus `npm run validate` exits 0 | integration on real root | `node --test tests/corpus/pilote.test.ts` plus `fnm exec --using=24 npm run validate -- --mode preview` | Wave 0 |
| CONT-06 | every `[[terme]]` / `[[affiché\|id]]` marker in any rédaction resolves to a glossaire entry; every candidate `parti` string and every party name that appears in an enfant text is wrapped in a marker; each `type: parti` entry has a `source` of type `parti` | integration (marker syntax per Phase 2 A2, test-local scan so it works before Phase 2 lands) | `node --test tests/corpus/glossaire.test.ts` | Wave 0 |
| Root flip | `DEFAULT_CONTENT_ROOT === '.'`; fixture-pinned tests still green; CI steps explicit | unit | `node --test tests/repo/default-root.test.ts tests/repo/ci.test.ts tests/content-core/*.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command (target under 20 s; no network).
- **Per wave merge:** `fnm exec --using=24 npm test`, `npm run validate -- --mode preview` on `.` and on the fixture, `npm run migrate -- --check`.
- **Phase gate:** full suite green, `npm run check`, `npm run build`, `RTP_MODE=preview npm run build` once for a visual look, and `npm run validate -- --mode production` once to see which Phase 2 errors the drafts still raise (expected: none for lengths/quotes/figures).

### Wave 0 Gaps
- [ ] `tests/import/` (datagouv pure functions, CLI idempotence) and a committed copy of the 2026-10-28 snapshot used as test input
- [ ] `tests/archive/` pure-function tests plus small frozen HTML and a tiny generated PDF is **not** committed (use text fixtures; PDF path tested via an injected extractor)
- [ ] `tests/corpus/{fiches,couverture-themes,pilote,glossaire}.test.ts`
- [ ] `tests/repo/default-root.test.ts`
- [ ] `.gitattributes` lines for `data/import/*.json` (Phase 2 plan 02-01 also creates `.gitattributes`; append, do not overwrite)
- [ ] Optional: `@playwright/test` install behind a human-verify checkpoint

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | partly | private repo for binaries; `gh` credentials only, nothing in the repo |
| V5 Input Validation | yes | upstream JSON shape check before mapping; Ajv on every generated file; `https` allow-list for fetched URLs; slug patterns for ids and paths |
| V6 Cryptography | integrity only | `node:crypto` sha256, never hand-rolled |
| V12 Files and Resources | yes | `archive.extrait` pattern forbids traversal; size caps (5 MiB text, 50 MiB binary, 25 MB response); containment helpers from Phase 1 when reading the corpus |
| V13 API / outbound requests | yes | fixed user agent, timeouts, redirect cap, no cookies, no credentials sent to third-party sites |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious or oversized remote content (HTML, PDF) | Tampering / DoS | never execute or `eval`; text extraction only; response size cap; `pdftotext` run with a timeout and `maxBuffer`; Playwright context without storage, `acceptDownloads: false`, no persisted profile |
| SSRF through the URL argument (`file://`, internal hosts) | Information disclosure | the CLI accepts `https://` only and refuses private/loopback addresses after DNS resolution; it is a developer tool but still guarded |
| Upstream dataset tampering or silent change | Tampering | sha256 + meta, diff PR, append-only statuts, unknown ids refused |
| Forbidden fields leaking into content | Tampering (editorial) | importer never reads `bloc`/`propositions`; Phase 2 `CHAMP_NON_IMPORTABLE` scans `src/content` |
| Secrets or personal data in extracts | Information disclosure | extracts are public speech; scan with gitleaks (CI); strip nothing silently, review the diff; contact details of private individuals in a PDF are a reason to drop that passage |
| Workflow-command injection through contributor text | Tampering | unchanged: Phase 1 `formatGithub` escaping |
| Copyright | legal | full texts only in the private repo; public repo keeps the extract under the LICENSE carve-out (CPI L.122-5), takedown contact planned in Lot 3 |

## Project Constraints (from CLAUDE.md)

Repo `CLAUDE.md` (generated from PROJECT.md and STACK.md) and the user's global `~/.claude/CLAUDE.md`:
- Astro static, YAML in Git validated by JSON Schema in CI, no database; Node 24 (`fnm exec --using=24`), native TypeScript, `.ts` import extensions, `node:test`.
- Neutrality: forbidden words, label claimed by the candidate, candidate's own costing only; primary sources only (never press for a measure), consultation date, archived copy in the repo; same level of detail for every declared candidate on a published theme.
- Every added dependency is justified in writing in the PR (one line); `ajv-cli`, `js-yaml`, English readability libraries, `z.fromJSONSchema()` are banned.
- No secrets in the repo; GitHub Secrets and Vaultwarden; images only from Wikimedia Commons or none.
- File edits go through a GSD command (`/gsd-execute-phase`).
- User global rules: code on a remote Git within the hour (the archives repo and the project must be pushed); README answers 5 questions, `docs/ARCHITECTURE.md` with ADRs and `docs/RUNBOOK.md` kept current (this phase adds import and archive runbook entries and an ADR for the flip); structured JSON logs and monitoring are for the deployed service (Lot 3); each non-trivial task states a measurable success criterion, an observable failure signal and an automatic corrective action; "dogfooding": the new scripts are themselves versioned, tested and documented before delivery.

## Sources

### Primary (HIGH confidence)
- Local downloads and runs, 2026-11-03: data.gouv resource, `candidats.json` (headers, sha256, full parse), 43 candidate-site URLs, 513 extracted pages from a 37-candidate crawl, `yaml.stringify` round-trip, Intl.Collator order, `Intl`/Node versions.
- Local codebase: `src/lib/content-core/{root,ajv,load,collections,astro-loader}.ts`, `schemas/*.json` incl. `defs/common.schema.json`, `tests/fixtures/corpus-valide/**`, `tests/content-core/*.test.ts`, `tests/dist/skeleton.test.ts`, `tests/migrations/cli.test.ts`, `.github/workflows/ci.yml`, `.npmrc`, `package.json`, `LICENSE`, `README.md`, `docs/ARCHITECTURE.md` (ADR-025).
- `.planning/phases/02-*/02-RESEARCH.md`, `02-CONTEXT.md`, Phase 2 plans 02-01 to 02-06 (file lists, `ids-lock.ts` and `resolveMode` APIs).
- `.planning/research/FEATURES.md` section 0 and `PITFALLS.md` (archiving, ordering, dataset).
- npm registry (`npm view`, `api.npmjs.org`): playwright, @playwright/test, playwright-core 1.64.1; `browsers.json` inside the installed package (chromium revision 1248).
- Live archive.org probes (302 / 429 / timeout behaviours).
- `gh auth status`, `gh repo view` (repo absent, scopes).

### Secondary (MEDIUM confidence)
- SPN2 API draft documentation summary: https://gist.github.com/regstuff/82e690db2f1d91ba59f6681c1abad6cf (endpoints, quotas, error codes; says nothing about anonymous GET headers).
- Web searches for candidate sites (Bouamrane, Becht, Mathieu, Durif, Billetdoux, Collovati, Legendre, Markovic, Rohou, Platret, Zemmour) and for SPN rate limits; all candidate URLs were then re-fetched live, two search hits proved stale.

### Tertiary (LOW confidence)
- The coverage matrix cell values (keyword scan plus manual reading), flagged `[ASSUMED]` in the Assumptions Log.
- GitHub file-size limits and gitleaks false-positive behaviour (not re-verified this session).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (stdlib plus one optional, already-planned dev dependency, slopcheck not run).
- Dataset and import design: HIGH (downloaded, parsed, schema-checked, YAML emit verified).
- Archiving design: MEDIUM (live probes of fetch, pdftotext, SPN; no end-to-end run; SPN is flaky).
- Coverage and theme choice: LOW-MEDIUM (estimate, explicit limits, mandatory re-measurement).
- Flip checklist: HIGH (all dependents found by grep and read), conflicts with Phase 2 files known.
- Pitfalls: HIGH for the verified ones (U+FFFD, 403, redirect, stale hits, id pattern, `parti_source`).

**Research date:** 2026-11-03
**Valid until:** 2026-11-17 for the coverage matrix and Wayback behaviour (campaign sites change weekly; statuses move around 10-13 December); 30 days for the rest.
