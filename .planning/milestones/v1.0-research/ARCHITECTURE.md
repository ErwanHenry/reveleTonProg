# Architecture Research

**Domain:** Static, Git-backed, schema-validated civic reference site (Astro 7, YAML content, CI editorial gate)
**Researched:** 2026-11-03
**Confidence:** HIGH for Astro/Zod/YAML mechanics (verified against current docs and the published `astro@7.4.5` package source). MEDIUM for browser-feature choices (MDN Baseline, verified). MEDIUM/LOW where noted (e.g. CSS `random()` rollout, popover ARIA details).

---

## 0. Verified facts that shape this architecture (read first)

| Fact | Source | Consequence |
|------|--------|-------------|
| Current Astro is **7.4.5** (7.0.0 released 2026-06-22). `engines.node >= 22.23.4`. | `npm view astro` | **Node 20 (Erwan's default) cannot run Astro 7.** Node 20 is EOL. Pin Node **24 LTS** (`.nvmrc`, `engines`, `actions/setup-node`). Node 26 became LTS in Oct 2026 and works too. |
| Collections are defined in `src/content.config.ts` with `defineCollection`, `glob()`/`file()` loaders from `astro/loaders`, and `z` from `astro/zod` (Zod 4, `zod@^4.6.6`). | docs.astro.build content-collections | Content Layer API is the only option to plan for. |
| Astro auto-generates JSON Schema in `.astro/collections/*.schema.json` **from Zod**, using `z.toJSONSchema(..., { unrepresentable: "any", io: "input" })`. | `astro/dist/content/types-generator.js` | That direction is Zod to JSON Schema. Refinements and transforms vanish, so the generated file is weaker than the Zod schema. It **cannot** be the "JSON Schema validated in CI" the spec requires. |
| Astro parses YAML with `yaml` v2: `parseDocument(src, { schema: "core", customTags: ["timestamp"], merge: true })`. | `@astrojs/internal-helpers/dist/yaml.js` | **An unquoted `2026-11-03` becomes a JS `Date` inside Astro** but a string in a default `yaml`/Ajv pipeline. The validator and Astro must share **one** parse/normalize function. |
| `glob()` default ID = `data.slug` if present, else the slugified file path. `generateId({ entry, base, data })` is overridable. | `astro/dist/content/loaders/glob.js` | Set `generateId: ({ data }) => data.id`, and have the validator check `id` against the file path. |
| `reference()` existence checking was lost in the Zod 4 upgrade. A fix restored it, but as a **`logger.error`** after loading, not a schema failure. | astro commit bd2c1a5 / PR #17582; issue #13268; `content-layer.js` | **Do not rely on `reference()` for integrity.** Cross-collection integrity belongs in our validator. |
| `getCollection()` order is non-deterministic. | docs.astro.build | Always sort explicitly (alphabetical rule). |
| Astro 7: `compressHTML` default changed to `'jsx'`, so `<span>a</span><em>b</em>` renders as `ab`. The compiler is stricter: invalid HTML fails the build, and a `<div>` inside a `<p>` is no longer auto-fixed. | upgrade-to/v7 guide | French prose with inline glossary buttons and source links will lose spaces. **Set `compressHTML: true`** and add a dist test. |
| Processed `<script>` tags become `type="module"` (deferred) and are bundled. `is:inline` renders the script as written. CSP (`security.csp`) has been stable since Astro 6. It hashes Astro-processed scripts only, not `is:inline` ones. | client-side-scripts docs; Astro 6 CSP docs | The localStorage restore must run before first paint, so it cannot be a module script. Use a tiny same-origin **classic** script (`<script is:inline src="/js/niveau.js">`). It is CSP `'self'`-friendly, with no hash bookkeeping. |
| Zod 4: `z.fromJSONSchema()` exists but is "experimental and not part of Zod's stable API". `z.toJSONSchema()` drops transforms and refinements. Custom issues come from `ctx.issues.push({...})` in transforms, or `ctx.addIssue` in `superRefine`. | zod.dev/json-schema, zod.dev/api | Rules out "generate Zod from JSON Schema" for production. Enables an "Ajv inside Zod" bridge. |
| `:has()` has been Baseline Widely Available since Dec 2023. MDN advises against broad anchors (`body:has`) for mutation performance. Inside a non-forgiving list, an unsupported `:has()` kills the whole rule. | MDN `:has` | Anchor on a `.lecteur` wrapper with child combinators. Degradation shows all 4 levels, which is acceptable. |
| Popover API (`popovertarget`, declarative, no JS) is Baseline 2025 (newly available, Jan 2025). | MDN Popover API | Usable for Enfant "mot souligné, définition en une phrase" without JS, with fallback text. |
| CSS `random()` shipped in Safari 26.2 and Chrome 156. Firefox plans it for 161. Not Baseline. | Mozilla intent-to-ship (2026-10-27), web-features | It could reorder visually without JS, but see section 4: rejected for a11y and neutrality reasons. |
| Node ≥ 22.18 runs `.ts` natively (type stripping, erasable syntax only). Stable since 24.12. | nodejs.org/api/typescript.html | `scripts/*.ts` can run with plain `node`, so no `tsx` dependency is needed. Use `erasableSyntaxOnly` and `.ts` import extensions. |

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AUTHORING (humans, agents, later the lot-5 cron) — writes PRs, never the site│
│   YAML files in src/content/**   +   archives/** (PDF/HTML copies)           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ git push / PR
┌──────────────────────────────▼───────────────────────────────────────────────┐
│ GATE 1 — content-core (pure TS, framework-free, shared)                      │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │ load +   │→ │ Ajv (JSON  │→ │ entry rules  │→ │ corpus rules          │   │
│  │ normalize│  │ Schema SoT)│  │ (editorial)  │  │ (refs, equity, ids)   │   │
│  └──────────┘  └────────────┘  └──────────────┘  └───────────────────────┘   │
│        Diagnostics {code, severity, file, line, message_fr} → CLI / GH annot. │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ same modules imported by
┌──────────────────────────────▼───────────────────────────────────────────────┐
│ BUILD — Astro 7 static                                                       │
│  content.config.ts: glob() loaders + "Ajv bridge" Zod schema (same core)     │
│        ↓ getCollection                                                       │
│  src/lib/corpus/ (view-model): publish filter, fr collation, cells matrix    │
│        ↓                                                                      │
│  components (LecteurNiveaux, Mesure, Cellule, Source, Terme) → pages         │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ dist/
┌──────────────────────────────▼───────────────────────────────────────────────┐
│ GATE 2 — check-dist (post-build): page weight, no external <script>,         │
│  forbidden words in final HTML, every .mesure has a dated source, spaces     │
│  around inline terms, a11y (axe) + no-JS e2e (Playwright)                    │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ artifact (lot 3: rsync → Caddy)
                               ▼
                         Visitors (static HTML + ~2 KB optional JS)
```

**Data flow is strictly one-way:** content to gates to dist. Nothing at runtime writes content, and nothing in dist is read back. The lot-5 collector is just another PR author upstream of Gate 1.

### Component Responsibilities

| Component | Owns | Implementation | Must NOT |
|-----------|------|----------------|----------|
| **Content store** `src/content/**` | Facts: candidats, thèmes, mesures, sources, couverture, glossaire, sondages (schema only in v1.0) | One YAML file per entity, with a `# yaml-language-server: $schema=` header for editor validation | Contain derived data (orders, counts) |
| **Schema registry** `schemas/` | Structural truth, draft 2020-12, versioned | `*.schema.json` + `CHANGELOG.md` | Duplicate editorial rules that need corpus context |
| **Archive store** `archives/` | Immutable source copies | Content-addressed files (`<sha256-12>.pdf/html`), outside `src/` and `public/` | Be shipped in `dist/` (VPS disk at 90 %) |
| **content-core** `src/lib/content-core/` | Parsing, normalization, Ajv, rule engine, diagnostics | Plain TS (erasable syntax), no Astro imports | Import `astro:*` (it must run in plain Node CI) |
| **CLIs** `scripts/` | `validate`, `migrate`, `check-dist`, `import-datagouv`, `archive-source`, `gen-types` | `node scripts/x.ts` | Contain rule logic (they only call content-core) |
| **Astro bridge** `src/content.config.ts` | Load collections and re-run the same Ajv check in dev/build | `glob()` + `ajvSchema<T>()` helper | Define its own field-level Zod schema (that would be drift) |
| **Corpus view-model** `src/lib/corpus/` | Publication filter, French alphabetical sort, theme×candidate cell matrix, glossary resolution | Memoized `getCorpus()` | Be bypassed: pages never call `getCollection` directly |
| **UI components** `src/components/` | Rendering only | `.astro` components, zero JS by default | Decide what is shown; they render what the view-model gives them |
| **Enhancement scripts** `public/js/` | localStorage memory, random order, live-region announcements | 2 classic scripts, < 2 KB each | Be required for reading content |
| **CI** `.github/workflows/` | Run gates on every push/PR | GitHub Actions, Node 24 | Deploy in v1.0 (lot 3) |
| **Tests** `tests/` | Rules, pièges, migrations, dist, e2e | `node:test` (built in) + Playwright/axe (lot 2) | Use real content as fixtures |

---

## 1. Recommended Project Structure

```
reveleTonProg/
├── .nvmrc                          # 24
├── astro.config.mjs                # output static, compressHTML: true, trailingSlash: 'always'
├── package.json                    # scripts below; engines.node ">=22.23.4"
├── tsconfig.json                   # extends astro/tsconfigs/strict + erasableSyntaxOnly
├── schemas/                        # SINGLE SOURCE OF TRUTH (structure)
│   ├── candidat.schema.json
│   ├── theme.schema.json
│   ├── mesure.schema.json
│   ├── source.schema.json
│   ├── couverture.schema.json      # equity "cases" (see §5)
│   ├── glossaire.schema.json       # Enfant definitions
│   ├── sondage.schema.json         # schema + rules in v1.0, display in lot 4
│   ├── journal.schema.json         # generated entries (lot 5)
│   ├── defs/                       # shared $defs: date, url, slug, statut-relecture
│   │   └── common.schema.json
│   └── CHANGELOG.md
├── src/
│   ├── content.config.ts           # collections = glob() + ajvSchema bridge
│   ├── content/
│   │   ├── candidats/<candidat-id>.yaml
│   │   ├── themes/<theme-id>.yaml
│   │   ├── sources/<source-id>.yaml
│   │   ├── mesures/<candidat-id>/<slug>.yaml     # id = "<candidat-id>/<slug>"
│   │   ├── couverture/<theme-id>.yaml            # one row per candidate
│   │   ├── glossaire/<terme-id>.yaml
│   │   └── sondages/<sondage-id>.yaml            # empty in v1.0 (fixtures only)
│   ├── lib/
│   │   ├── content-core/           # framework-free, shared by CLI + Astro
│   │   │   ├── load.ts             # read + parse (Astro-identical options) + normalizeDates
│   │   │   ├── ajv.ts              # Ajv2020 + formats, compile all schemas once
│   │   │   ├── diagnostics.ts      # Diagnostic type, JSON-pointer → line (yaml LineCounter)
│   │   │   ├── rules/
│   │   │   │   ├── index.ts        # registry: entry rules + corpus rules
│   │   │   │   ├── source-primaire.ts
│   │   │   │   ├── archive-presente.ts       # file exists + sha256 matches
│   │   │   │   ├── mots-interdits.ts
│   │   │   │   ├── longueurs.ts
│   │   │   │   ├── redactions-publie.ts      # enfant/aîné required when publié
│   │   │   │   ├── chiffres-hors-source.ts   # numbers in rédactions ⊆ source text/chiffrage
│   │   │   │   ├── citation-exacte.ts        # quoted text in détaillé ⊆ texte_source
│   │   │   │   ├── glossaire-resolu.ts       # every [[terme]] exists
│   │   │   │   ├── integrite.ts              # ids, refs, path==id, sous_theme ∈ theme
│   │   │   │   ├── equite.ts                 # §5
│   │   │   │   └── sondages.ts               # notice url, 95–105 %, tour, blocage dates
│   │   │   ├── config.ts           # forbidden words, length bounds, blocage windows, statuts "déclarés"
│   │   │   └── types.generated.ts  # from schemas/ via json-schema-to-typescript (CI drift check)
│   │   └── corpus/
│   │       ├── index.ts            # getCorpus(): Corpus (memoized)
│   │       ├── ordre.ts            # Intl.Collator('fr') sort; (later) ordre CC
│   │       └── cellules.ts         # cellule(candidat, theme) → {etat, mesures[]}
│   ├── components/
│   │   ├── LecteurNiveaux.astro    # radio fieldset + wrapper (the toggle)
│   │   ├── Mesure.astro            # 4 rédactions + source
│   │   ├── Cellule.astro           # candidate×theme cell incl. "non précisé"
│   │   ├── SourceCitation.astro
│   │   ├── TexteEnfant.astro       # parses [[terme]] → popover buttons
│   │   ├── OrdreCandidats.astro    # hidden-without-JS control
│   │   └── BadgeBrouillon.astro    # preview mode only
│   ├── layouts/Base.astro
│   ├── pages/
│   │   ├── index.astro             # hall: the 4 "lunettes" + themes
│   │   ├── themes/index.astro
│   │   ├── themes/[theme].astro    # all candidates on one theme
│   │   ├── candidats/index.astro
│   │   ├── candidats/[candidat].astro
│   │   ├── methode.md
│   │   ├── mentions-legales.md
│   │   └── qui-sommes-nous.md
│   └── styles/
│       ├── niveaux.css             # the :has() rules (isolated, testable)
│       └── base.css
├── public/js/
│   ├── niveau.js                   # sync restore + persist + announce + pageshow resync
│   └── ordre.js                    # random order (crypto.getRandomValues)
├── archives/
│   └── <candidat-id>/<sha256-12>.<pdf|html>
├── scripts/
│   ├── validate.ts                 # --content --archives --mode preview|production --format text|json|github
│   ├── migrate.ts                  # --check | --write
│   ├── migrations/<collection>/<NNN>-<desc>.ts
│   ├── check-dist.ts
│   ├── gen-types.ts
│   ├── import-datagouv.ts          # one-shot: CSV → candidats/*.yaml (brouillon)
│   └── archive-source.ts           # url → archives/ + sources/<id>.yaml stub
├── tests/
│   ├── fixtures/
│   │   ├── corpus-valide/          # minimal fictional corpus that passes everything
│   │   └── pieges/<code>/          # overlay files + attendu.json { "codes": [...] }
│   ├── rules/*.test.ts             # unit tests per rule
│   ├── pieges.test.ts              # overlay → validate → assert codes
│   ├── migrations/*.test.ts        # before/after fixtures
│   ├── dist/*.test.ts              # built fixture site checks
│   └── e2e/*.spec.ts               # Playwright: no-JS, keyboard, axe (lot 2)
└── .github/workflows/ci.yml        # validate → test → build → check-dist
```

### Structure Rationale

- **`schemas/` at the repo root, not under `src/`.** These schemas are a public contract for open data, the lot-5 collector (Node or Python) and the reviewers. Keeping them out of `src/` signals that they are not Astro internals.
- **`content-core` under `src/lib/` but Astro-free.** `content.config.ts` can import it through a relative path, and `scripts/validate.ts` can run it in plain Node. Code reuse is the anti-drift mechanism.
- **`archives/` outside `src/` and `public/`.** Astro never touches it, it never reaches `dist/`, and the VPS disk is spared. The "copie archivée" link points to the public GitHub blob once the repo is public. Before that, show the hash only. *(Decision to confirm with Erwan.)*
- **`mesures/<candidat-id>/`.** Collection work happens per candidate (one programme gives N mesures in one PR), so reviewer diffs stay grouped. The theme is a field, so a mesure can be reclassified without changing its ID, its anchors or its journal history.
- **Extra collections beyond the spec's five** (`sources`, `couverture`, `glossaire`) are justified below. They add no runtime cost.
  - `sources`: one programme PDF backs about 30 mesures. One record holds the archive, the hash and the consultation date, and re-consulting it updates one file.
  - `couverture`: makes the equity rule auditable (§5).
  - `glossaire`: makes the Enfant definitions validatable.
- **`tests/fixtures/pieges/` as overlays on `corpus-valide/`.** Each trap is 1 or 2 files plus an expected code list, so seven traps don't mean seven corpora to maintain.

### npm scripts (contract for CI and humans)

```json
{
  "validate": "node scripts/validate.ts --mode production",
  "validate:preview": "node scripts/validate.ts --mode preview",
  "migrate:check": "node scripts/migrate.ts --check",
  "gen:types": "node scripts/gen-types.ts",
  "test": "node --test tests/**/*.test.ts",
  "build": "npm run validate && astro build",
  "build:preview": "npm run validate:preview && RTP_MODE=preview astro build",
  "check:dist": "node scripts/check-dist.ts dist",
  "ci": "npm run migrate:check && npm run gen:types -- --check && npm test && npm run build && npm run check:dist"
}
```

---

## 2. Single Source of Truth: JSON Schema vs Zod — Recommendation

### Options weighed

| Option | Drift risk | Fidelity to spec ("JSON Schema validé en CI") | Conditional rules (`enfant` required if `publie`) | TS types | Verdict |
|--------|-----------|-----------------------------------------------|---------------------------------------------------|----------|---------|
| **A. JSON Schema SoT + Ajv everywhere (Ajv bridged into Astro's Zod slot)** | **None.** One compiled validator is used in both places | Exact | Native `if/then` | Generated from JSON Schema (dev dep), with a CI drift check | **RECOMMENDED** |
| B. Zod SoT in `content.config.ts`, export JSON Schema via `z.toJSONSchema()` and commit it | Medium. `superRefine` and `transform` are silently dropped from the export, so CI's Ajv ends up weaker than Astro's Zod | Indirect (JSON Schema becomes a by-product) | Only via refinements, which don't survive the export | Free | Rejected |
| C. JSON Schema SoT, Zod generated at runtime with `z.fromJSONSchema()` | Low, but the API is experimental and may change | Exact | Depends on undocumented keyword coverage | None (`unknown`) | Rejected (unstable API) |
| D. JSON Schema SoT + hand-written "permissive" Zod (`z.looseObject({id})`) + Ajv pre-build only | Low for validation. Types are hand-maintained, and `astro dev` shows no errors | Exact | Native | Hand-written, so they drift | Acceptable fallback only |

### Why A

1. ADR-003 and the spec already make `schemas/*.schema.json` authoritative. A also supports the lot-5 collector in any language, plus open-data reuse.
2. Conditional constraints the spec states ("enfant et aîné optionnelles en brouillon, obligatoires pour publié") are first-class in JSON Schema (`if/then`). Under B they live in Zod refinements, which `z.toJSONSchema()` cannot express, so B drifts by construction.
3. Running the same Ajv inside Astro means `astro dev` surfaces schema errors live, and `astro build` cannot produce a site from invalid data even if someone skips `npm run validate`.
4. It avoids `reference()` entirely. Its integrity checking is version-dependent and log-only in 7.x. Our `integrite` rule owns referential integrity.

### Bridge sketch (verified against Zod 4 API: `ctx.issues.push`, `z.NEVER`)

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { validateStructure } from './lib/content-core/ajv.ts';
import { normalizeDates } from './lib/content-core/load.ts';
import type { Candidat, Mesure, Theme, Source, Couverture, Terme } from './lib/content-core/types.generated.ts';

// Astro parses YAML with customTags:["timestamp"] → Dates. Normalize to 'YYYY-MM-DD'
// so Ajv sees exactly what scripts/validate.ts sees.
const ajvSchema = <T>(name: string) =>
  z.unknown().transform((raw, ctx) => {
    const data = normalizeDates(raw);
    const errors = validateStructure(name, data); // same compiled Ajv as CI
    if (errors.length) {
      for (const e of errors) ctx.issues.push({ code: 'custom', message: `${e.instancePath || '/'} ${e.message}`, input: raw });
      return z.NEVER;
    }
    return data as T;
  });

const yamlIn = (dir: string) =>
  glob({ pattern: '**/*.yaml', base: `./src/content/${dir}`, generateId: ({ data }) => String(data.id) });

export const collections = {
  candidats:  defineCollection({ loader: yamlIn('candidats'),  schema: ajvSchema<Candidat>('candidat') }),
  themes:     defineCollection({ loader: yamlIn('themes'),     schema: ajvSchema<Theme>('theme') }),
  sources:    defineCollection({ loader: yamlIn('sources'),    schema: ajvSchema<Source>('source') }),
  mesures:    defineCollection({ loader: yamlIn('mesures'),    schema: ajvSchema<Mesure>('mesure') }),
  couverture: defineCollection({ loader: yamlIn('couverture'), schema: ajvSchema<Couverture>('couverture') }),
  glossaire:  defineCollection({ loader: yamlIn('glossaire'),  schema: ajvSchema<Terme>('glossaire') }),
};
```

Notes:
- The Astro side runs **structure only**. Editorial and corpus rules run in `scripts/validate.ts`, which the `build` script runs first. Keeping corpus rules out of Zod avoids per-entry ordering problems: Zod sees one entry at a time, while equity needs all of them.
- Astro's generated `.astro/collections/*.schema.json` will degrade to `{}` for these collections, because a transform is unrepresentable. That is harmless. Editor validation uses the `# yaml-language-server: $schema=../../../schemas/mesure.schema.json` header pointing at the real schemas.
- `scripts/load.ts` must parse with **the same options Astro uses** (`schema: 'core'`, `customTags: ['timestamp']`, `merge: true`), then `normalizeDates`. Add a test that loads a fixture through both paths and deep-compares. Alternative: forbid unquoted dates in the schema via `pattern`. It is still worth normalizing, because authors and agents *will* write unquoted dates.
- Ajv setup: `import Ajv2020 from 'ajv/dist/2020.js'`, `ajv-formats`, `{ allErrors: true, strict: true }`. Under `strict`, unknown keywords fail, so put the version in `$comment`/`$id`, not in an `x-` keyword, or register the vocabulary.
- Types: `json-schema-to-typescript` (dev dependency, justified: removes hand-written types, the remaining drift vector). `gen:types -- --check` fails CI if `types.generated.ts` is stale.

---

## 3. No-JS 4-level toggle — Recommendation: radio group + `:has()` on a scoped wrapper

### Options weighed

| Pattern | No reload | Works without JS | Global (one choice for all mesures on page) | A11y semantics | SEO | Weight | Verdict |
|---------|-----------|------------------|---------------------------------------------|----------------|-----|--------|---------|
| **Radio inputs + `:has()`** | Yes | Yes | Yes | Native radio group: `fieldset`/`legend`, arrow keys, "1 of 4, selected" announced | All 4 levels in HTML and indexed | ×~2 HTML (détaillé dominates) | **RECOMMENDED** |
| `details/summary` (with `name` for an exclusive accordion) | Yes | Yes | **No.** It works per mesure, so 30 mesures need 30 clicks | Disclosure semantics, not a mode selector | OK | Same | Rejected (wrong interaction model) |
| `:target` (`#enfant` + `html:has(#enfant:target)`) | Yes | Yes | Yes | Links announce as links, not a selected state, and there's no "which is active" | Hash URLs | Same | Rejected. It pollutes history (Back cycles through levels), scroll-jumps to the target, and collides with mesure/candidate anchors (`#dupont-jean`), which navigation needs |
| Separate static URLs (`/enfant/themes/logement/`) | **No** (full reload) | Yes, and the choice persists without JS | Yes | Plain links | 4× duplicate pages, needs canonicals | 4× pages, ¼ weight each | Rejected. It violates "sans rechargement" and multiplies the build/test surface |
| ARIA tabs (`role=tablist`) | Yes | **No** (needs JS for `aria-selected`) | Yes | Correct only with JS, and lies when JS is off | OK | Same | Rejected |

### Markup sketch

```astro
---
// LecteurNiveaux.astro — wraps ALL level-dependent content of the page
const niveaux = [
  { v: 'resume',   label: 'Résumé' },
  { v: 'detaille', label: 'Détaillé' },
  { v: 'enfant',   label: 'Enfant' },
  { v: 'aine',     label: 'Aîné' },
];
---
<div class="lecteur">
  <fieldset class="niveaux" aria-describedby="niveaux-aide">
    <legend>Niveau de lecture</legend>
    {niveaux.map((n, i) => (
      <span class="niveau">
        <input type="radio" name="niveau" id={`niv-${n.v}`} value={n.v} checked={i === 0} />
        <label for={`niv-${n.v}`}>{n.label}</label>
      </span>
    ))}
    <p id="niveaux-aide" class="aide">S'applique à toutes les mesures de la page.</p>
    <p class="sr-only" aria-live="polite" data-niveau-annonce></p>  <!-- filled by JS only -->
  </fieldset>
  <!-- Classic (non-module), same-origin, synchronous: restores the saved choice BEFORE the
       content below is parsed and painted, so there's no flash. CSP: script-src 'self'. -->
  <script is:inline src="/js/niveau.js"></script>
  <div class="lecteur-contenu"><slot /></div>
</div>
```

```astro
<!-- Mesure.astro (inside the slot) -->
<article class="mesure" id={`m-${slug}`} aria-labelledby={`m-${slug}-t`}>
  <h3 id={`m-${slug}-t`}>{titre}</h3>
  <div class="redaction" data-niveau="resume"><p class="etiquette">En résumé</p>…</div>
  <div class="redaction" data-niveau="detaille"><p class="etiquette">En détail</p>…</div>
  <div class="redaction" data-niveau="enfant"><p class="etiquette">Pour les enfants</p><TexteEnfant texte={enfant} /></div>
  <div class="redaction" data-niveau="aine"><p class="etiquette">Pour les aînés</p>…</div>
  <SourceCitation source={source} />   <!-- ALWAYS visible, outside the level blocks -->
</article>
```

```css
/* niveaux.css — anchored on .lecteur, child combinator to the fieldset (MDN perf advice) */
.lecteur:has(> .niveaux #niv-resume:checked)   .redaction:not([data-niveau="resume"]),
.lecteur:has(> .niveaux #niv-detaille:checked) .redaction:not([data-niveau="detaille"]),
.lecteur:has(> .niveaux #niv-enfant:checked)   .redaction:not([data-niveau="enfant"]),
.lecteur:has(> .niveaux #niv-aine:checked)     .redaction:not([data-niveau="aine"]) { display: none; }

/* Labels are only needed when all 4 show (no :has() support) */
@supports selector(:has(*)) { .redaction > .etiquette { position: absolute; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; } }

/* Aîné: larger type + "ce qui me concerne" block */
.lecteur:has(> .niveaux #niv-aine:checked) .lecteur-contenu { font-size: 1.25em; }
.concerne-aine { display: none; }
.lecteur:has(> .niveaux #niv-aine:checked) .concerne-aine { display: block; }

.niveaux { position: sticky; top: 0; }
.niveau input:focus-visible + label { outline: 3px solid; outline-offset: 2px; }
```

Why this is the right call:
- **Accessibility.** The native radio group needs no ARIA: `fieldset`/`legend` names the group, Tab enters it, arrows switch (instant and non-destructive, so selection-follows-focus is fine), and screen readers announce "Résumé, bouton radio, 1 sur 4, coché". `display:none` correctly removes hidden levels from the accessibility tree. The one gap is that, without JS, a level change is not announced. The JS layer fills the `aria-live` region ("Niveau Enfant affiché"). Do **not** add `role="tablist"`, which promises JS behavior.
- **Degradation.** Without `:has()` (pre-2023 browsers), the rule is dropped and all four levels show with visible labels. Content stays complete and readable.
- **SEO.** All four rédactions are in the HTML, so there is no duplicate-URL problem and the "enfant" text is indexable too.
- **Weight.** Per mesure, the 4 rédactions total about 25+200+60+120 = 405 words (about 2.7 KB of text, about 4–5 KB with markup). A theme page with 30 published mesures is about 150 KB raw HTML, roughly 25–35 KB brotli. At about 120 mesures per theme late in the campaign it is about 550 KB **raw**, which is still under 100 KB compressed. **The spec's "< 500 Ko" must be defined as transferred bytes**, and `check-dist` should also enforce a raw-HTML budget (suggest 400 KB). If that budget is ever hit, split theme pages by sous-thème. *(Clarify the metric in requirements.)*
- **Print.** Only the selected level prints, which is free.

### JS enhancement (`public/js/niveau.js`, about 40 lines, classic script)

1. Synchronously: read `localStorage['rtp:niveau']`, wrapped in `try` (Safari private mode and storage-disabled cases), and set `.checked` on the matching radio. Since the script sits right after the fieldset and before the content, there is no flash.
2. On `change`: persist, then write the live-region text.
3. On `pageshow` with `event.persisted` (bfcache): re-sync from storage. Otherwise Back to a cached page shows its stale form state after the level was changed elsewhere. The browser's form-state restoration also fights localStorage, so set `autocomplete="off"` on the radios.
4. Without JS there is no cross-page memory: each page starts at Résumé. This is the accepted trade-off. Note it on the Méthode page.

### Enfant "mots soulignés" (no JS): Popover API

```html
<p>Le candidat veut baisser le prix de la
  <button type="button" class="terme" popovertarget="def-cantine-m12">cantine</button><span
  id="def-cantine-m12" popover class="definition">Cantine : le restaurant de l'école.</span>
  pour tous les élèves.</p>
```
- Authoring syntax in YAML: `[[cantine]]` or `[[loyer|loyers]]`. `TexteEnfant.astro` parses it, and the `glossaire-resolu` rule fails on unknown terms.
- Use `<span popover>`, never `<div>`, inside `<p>`. The Astro 7 compiler now fails or misrenders invalid nesting.
- `compressHTML: true` is required. Under the v7 default `'jsx'`, "la`<button>`cantine`</button>`pour" loses its spaces. Add a `check-dist` assertion that no `\p{L}<button class="terme">` or `</button>\p{L}` sequence exists.
- Popover IDs must be unique per page (the same term appears in many mesures), so suffix them with the mesure ID.
- MEDIUM confidence: whether browsers expose `aria-expanded` automatically on `popovertarget` buttons is not documented on MDN. Test it with VoiceOver/NVDA during lot 2.

### Aîné "ce qui me concerne"

Prefer an **aîné-only block** (`.concerne-aine`, shown by the same `:has()` rule) listing the priority themes (`theme.prioritaire_aine: true`) as links at the top. Avoid CSS `order` reordering of large sections: visual order that differs from DOM/focus order breaks WCAG 1.3.2 / 2.4.3. Duplicating a short list of links costs a few hundred bytes.

---

## 4. Random order without JS — Recommendation: alphabetical static HTML + JS DOM shuffle on demand

| Option | Per-visitor? | A11y | Neutrality | Verdict |
|--------|--------------|------|------------|---------|
| Build-time shuffle | No. Every visitor gets the same order until the next deploy | Fine | **Bad.** A fixed "random" order favors whoever lands first for a day or more, and it is not reproducible or explainable | Rejected |
| N pre-rendered permutations (`/themes/x/ordre-3/`) | Only if something picks N at random. A static link can't, and Caddy server-side randomness is lot 3, out of scope and against "pas de framework serveur" | Fine | OK | Rejected (complexity, no randomness source) |
| CSS `random()` + `order` | Yes | **Bad.** Screen readers and keyboard users keep alphabetical order while sighted users see random, so two audiences get different orders | Ties fall back to DOM order (alphabetical bias), and Firefox is unsupported until about 161 | Rejected |
| **JS shuffle of DOM order, control hidden without JS** | Yes | DOM order = visual = focus order | Fisher–Yates with `crypto.getRandomValues`, fresh on every load, unit-tested for uniformity | **RECOMMENDED** |

Design:
- **Default (no JS, or JS without opt-in): alphabetical** by `nom` then `prenom`, `Intl.Collator('fr', { sensitivity: 'base' })` (É sorts with E), computed in `corpus/ordre.ts` at build. The page states it: "Ordre : alphabétique (nom de famille)". That satisfies the spec's default without JS.
- The control `<fieldset hidden data-ordre>` (Alphabétique / Aléatoire radios) ships with `hidden`. `ordre.js` removes `hidden`, so no-JS users never see a dead control. The Méthode page explains that random order requires JavaScript.
- The persisted preference is the **mode** (`rtp:ordre = aleatoire`), never a permutation. Every page load reshuffles.
- **Flash avoidance.** A deferred shuffle would briefly show alphabetical order, giving the first candidate a small exposure bias, plus layout shift. Put the shuffle in a synchronous classic script right after the candidate list's closing tag. If the mode is `aleatoire`, the list carries a `data-ordre-pending` attribute (set by the same inline restore, before the list) with `visibility:hidden`. A CSS `animation` fallback unhides it after 1 s if the script dies.
- Applies to: theme pages (candidate sections) and the candidates index. It does not apply to the theme order on candidate pages, which uses the editorial `theme.ordre`.
- The future "ordre du Conseil constitutionnel" option is a build-time sort on `candidat.ordre_cc`. That is a third mode, static, and no-JS-capable. Reserve the field in schema v1 as optional.
- Test: `tests/rules/ordre.test.ts` runs the shuffle 60 000× over 6 items with a chi-square check on first-position frequency. It's cheap, and it is evidence for the Méthode page.

---

## 5. Equity rule — enforce in the validator as a corpus rule, backed by explicit `couverture` records

**Problem with an implicit "no mesure means render 'non précisé'":** the renderer would make equity trivially true, which defeats the spec's intent ("un thème publié … impose de **vérifier et compléter** la case de tous les autres candidats"). The success metric is "0 case vide non marquée « non précisé »", which needs an explicit mark proving that someone checked.

**Data:** `src/content/couverture/<theme-id>.yaml`, one file per theme, acting as the reviewer's checklist:

```yaml
# yaml-language-server: $schema=../../../schemas/couverture.schema.json
version_schema: 1
id: logement
theme: logement
cases:
  - candidat: dupont-jean
    etat: mesures                 # ≥1 publiée mesure must exist
    verifie_le: "2026-11-10"
    verifie_par: erwan
  - candidat: martin-claire
    etat: non_precise             # programme publié, nothing on this theme
    verifie_le: "2026-11-10"
    verifie_par: erwan
    sources_consultees: [martin-claire-programme-2026-09]
  - candidat: durand-paul
    etat: programme_non_publie    # requires candidat.programme.publie == false
    verifie_le: "2026-11-10"
    verifie_par: erwan
```

**Rule `equite` (corpus scope), in `content-core/rules/equite.ts`:**

```
let D = candidats where statut ∈ config.statutsSoumisEquite   // default: ['declare'] — confirm 'en_primaire'
for theme T where T.statut == 'publie':
  C = couverture[T]                                  → EQUITE_COUVERTURE_ABSENTE if missing
  for d in D:
    case = C.cases[d]                                → EQUITE_CASE_MANQUANTE (lists the exact YAML to add)
    pub  = mesures(d, T, statut == 'publie')
    case.etat == 'mesures'             ⇒ pub.length ≥ 1     else EQUITE_ETAT_INCOHERENT
    case.etat != 'mesures'             ⇒ pub.length == 0    else EQUITE_ETAT_INCOHERENT
    case.etat == 'programme_non_publie'⇒ !d.programme.publie else EQUITE_ETAT_INCOHERENT
    case.verifie_le < max(d.statut_date, last mesure change) ⇒ EQUITE_VERIFICATION_PERIMEE (warning)
  extra cases for candidates not in D → warning (retiré: keep history, render per status)
```

- **Severity by mode.** `--mode production` gives errors. `--mode preview` gives warnings, because during lots 1–2 everything is `brouillon` and themes aren't published yet.
- **Render-side guarantee (defense in depth).** `themes/[theme].astro` iterates over **candidates** (`corpus.candidatsSoumisEquite()`) and asks `cellule(candidat, theme)`. It never iterates over mesures. Even a validator bug can't make a candidate vanish from a theme page: worst case shows "non précisé" (and `check-dist` asserts that the number of `.cellule` elements equals the number of candidates on each theme page).
- **Operational pitfall.** A newly declared candidate (palier B PR) instantly fails equity on every published theme. That is intended, but it blocks unrelated PRs. Mitigation: the error message prints the exact stub, and `scripts/couverture-stub.ts <candidat>` appends `programme_non_publie` cases dated today for review. The status-change PR must include them.
- "Non précisé" (programme exists, silent on the theme) and "programme non publié à ce jour" (no programme at all) are both explicit states. The display text comes from `etat`, never from absence.

---

## 6. Schema versioning and migrations

**Convention:**
- Each schema has `$id: "urn:reveletonprog:schema:<collection>"` and a `properties.version_schema: { "const": N }`. Every data file carries `version_schema: N` (required). The domain isn't bought yet, hence a URN rather than an https `$id`. Switch when the domain exists, without changing semantics.
- `schemas/CHANGELOG.md` gets one entry per bump: what changed, why, and the migration filename.
- **Bump N for any change that can invalidate existing files or change a field's meaning.** Adding an *optional* field with no meaning change needs no bump, but still gets a CHANGELOG line.
- Shared `$defs` live in `schemas/defs/common.schema.json` (`date`, `url`, `slug`, `statutRelecture`), referenced by `$ref`. Ajv loads them via `addSchema`.

**Migration runner (`scripts/migrate.ts`):**

```ts
// scripts/migrations/mesure/002-sous-theme-obligatoire.ts
import type { Document } from 'yaml';
export const collection = 'mesure';
export const from = 1, to = 2;
export function migrate(doc: Document): void {
  if (!doc.has('sous_theme')) doc.set('sous_theme', 'general');
  doc.set('version_schema', 2);
}
```
- It edits files through the **`yaml` Document API**, which preserves comments, key order and quoting. Human review diffs then stay minimal. Never round-trip through `JSON.stringify` or `js-yaml`.
- `migrate --check` (in CI) fails if any file's `version_schema` < the schema's `const`, with the message "lancer `npm run migrate -- --write`". `--write` applies the chain `from→to` sequentially, then runs `validate`.
- Migrations are idempotent and tested: `tests/migrations/<collection>/<NNN>/{avant,apres}.yaml`.
- The schema change, the migration, the migrated data and `types.generated.ts` all land in **one PR**. CI enforces consistency via `migrate:check` + `gen:types --check` + `validate`.
- v1.0 ships `version_schema: 1` everywhere and the runner with zero migrations, plus one test migration in fixtures to prove the mechanism. That is enough to satisfy "le schéma est versionné ; migration scriptée" in lot 1.

---

## 7. Validation layering and the pièges

| Layer | Runs where | Catches |
|-------|-----------|---------|
| L0 parse | content-core `load.ts` | YAML syntax, duplicate keys (`uniqueKeys: true`), multi-document files |
| L1 structure | Ajv (CI + Astro bridge) | Missing source ref, missing notice url, enums, `if statut=publie then required [enfant, aine]`, date/url formats, `version_schema` |
| L2 entry rules | `validate.ts` | Mots interdits (NFC + case-fold, Unicode word boundaries `(?<!\p{L})…(?!\p{L})`), word-count bounds per level, citation exacte ⊆ texte_source, numbers in rédactions ⊆ numbers in texte_source/chiffrage, source type ∈ primaires, archive file present + sha256, `[[terme]]` resolved |
| L3 corpus rules | `validate.ts` | ID uniqueness, `id` vs path, refs (candidat/theme/sous_theme/source/glossaire), equity, sondage hypothesis candidates exist |
| L4 dist | `check-dist.ts` | Forbidden words in **final HTML**, which also covers Méthode/Mentions pages and template strings; no `<script src="http…">`; no third-party origins; each `.mesure` has a `<time datetime>` source; weight budgets; inline-space check; `.cellule` count = candidates |
| L5 e2e | Playwright (lot 2) | No-JS toggle works, keyboard path, axe 0 serious/critical, localStorage restore without flash |

**Pièges from section 12 of the spec, mapped to v1.0.** The sondage schema ships in lot 1, so its traps are cheap to enforce now even though display is lot 4.

| Piège | Rule code | Layer | v1.0 |
|-------|-----------|-------|------|
| Mesure sans source | `SOURCE_ABSENTE` / `SOURCE_INCONNUE` / `SOURCE_NON_PRIMAIRE` / `ARCHIVE_ABSENTE` | L1/L2/L3 | Yes (lot 1 deliverable) |
| Mot interdit | `MOT_INTERDIT` | L2 + L4 | Yes |
| Rédaction enfant ajoutant un chiffre | `CHIFFRE_HORS_SOURCE` | L2 | Yes (digits are reliable; French number words such as "deux fois" give **warnings only**, and the human/agent cross-check covers the rest) |
| Sondage sans notice | `SONDAGE_NOTICE_ABSENTE` | L1 | Yes (schema) |
| Scores 112 % | `SONDAGE_SOMME_HORS_BORNES` | L2 | Yes |
| Hypothèse 2nd tour dans 1er tour | `SONDAGE_TOUR_INCOHERENT` (2-candidate hypothesis in `tour: 1`, or `hypothese.tour` ≠ `sondage.tour`) | L2 | Yes |
| Publication en fenêtre de blocage | `SONDAGE_PUBLICATION_BLOCAGE` (dates hard-coded in `config.ts`, Europe/Paris) | L2 | Yes |

Each piège is `tests/fixtures/pieges/<code>/` (overlay + `attendu.json`). `tests/pieges.test.ts` copies `corpus-valide` + the overlay to a tmp dir, runs `validate --content <tmp> --format json`, and asserts that the expected codes are present. A meta-test asserts that `corpus-valide` alone yields zero errors.

Diagnostics map JSON pointers to YAML line numbers (`yaml` `LineCounter`) and, under `--format github`, emit `::error file=…,line=…::message`. Reviewers then see errors inline on the PR diff, which matters for a daily 15–30 min review routine.

---

## Data Flow

### Build-time flow (the only "request flow" a static site has)

```
YAML file ─parse(load.ts, Astro-identical opts)─→ JS object ─normalizeDates─→ plain JSON
   │                                                                          │
   │   CI: scripts/validate.ts ──Ajv──→ entry rules ──→ corpus rules ──→ exit code + annotations
   │                                                                          │
   └─ Astro: glob() → ajvSchema bridge (same Ajv) → data store → getCollection
                                                         ↓
                                  corpus/getCorpus(): filter by mode (production: statut=publie;
                                  preview: all + BadgeBrouillon), index by id, Intl.Collator('fr') sort,
                                  cells[theme][candidat] = {etat, mesures}
                                                         ↓
                                  pages (getStaticPaths over themes publiés / all candidats)
                                                         ↓
                                  dist/*.html ──check-dist──→ artifact
```

### Client-side state (only two keys, both optional)

```
localStorage['rtp:niveau'] ∈ {resume, detaille, enfant, aine}   → radio.checked (sync, pre-paint)
localStorage['rtp:ordre']  ∈ {alphabetique, aleatoire}          → DOM reorder (sync, after list)
No cookies, no network, no other state.
```

### Key data flows

1. **Mesure lifecycle:** agent or Erwan writes `mesures/<c>/<slug>.yaml` (`brouillon`) and the `sources/` + `archives/` entries, opens a PR, and CI runs gates. Erwan reviews, sets `relecture.statut: publie` with `relecteur`/`date`, and updates `couverture/<theme>.yaml`. CI then re-runs equity in production mode, and the merge builds.
2. **Candidate status (palier B):** data.gouv CSV goes through `import-datagouv.ts` (one-shot or periodic) to a PR. A status change to `declare` triggers equity errors on published themes, and `couverture-stub` adds the cases.
3. **Preview vs production:** `RTP_MODE=preview` builds everything with visible "brouillon, non relu" badges. That is the v1.0 "URL de test", because the pilot content is all `brouillon` until reviewed. Production only builds `publie`. **Without preview mode, the lot-2 deliverable would be an empty site.**

---

## Architectural Patterns

### Pattern 1: Shared validation core, multiple hosts
**What:** one framework-free module (`content-core`) hosted by the CLI, Astro's content layer, and tests.
**When:** whenever the same rule must hold in dev, CI and build.
**Trade-offs:** imports cross the Astro and plain-Node boundary, so content-core must avoid `astro:*` and Vite-only features. Use `.ts` extensions in imports for Node type stripping, which Vite also resolves.

### Pattern 2: View-model between content and pages
**What:** `getCorpus()` returns an indexed, filtered, sorted, equity-shaped structure. Pages render it.
**When:** always. Pages never call `getCollection`.
**Trade-offs:** one more layer, but publication filtering and ordering, the two neutrality-critical decisions, live in one tested place instead of being scattered across templates.

### Pattern 3: State in the DOM, not in JS
**What:** the level and order live in form controls (radios). CSS reads them via `:has()`. JS only persists and restores.
**When:** progressive-enhancement requirements ("works without JS").
**Trade-offs:** no cross-page persistence without JS (accepted).

### Pattern 4: Explicit absence records
**What:** "nothing to say" is a reviewed datum (`couverture` case), not a missing file.
**When:** fairness or completeness is audited.
**Trade-offs:** about 20 candidates × 10 themes = 200 rows to maintain by end of campaign, mitigated by stub generation.

---

## Scaling Considerations

Traffic is a non-issue: static files behind Caddy. The real scaling axes are **corpus size, repo size, and page weight**.

| Axis | Pilot (v1.0) | End of campaign (~Apr 2027) | What breaks first / fix |
|------|-------------|-----------------------------|-------------------------|
| Content files | ~20 candidats, 3 thèmes, ~50 mesures | ~20 × 10 thèmes, ~1 500 mesures, ~300 sources | Validator and Astro build stay in seconds. Nothing breaks. |
| Repo size (archives) | Tens of MB | 300 sources × 1–20 MB PDF/HTML, so **0.5–2 GB** | **First bottleneck.** CI clone time and GitHub repo-size warnings. Cap per file (validator warns > 10 MB). Use `actions/checkout` with `filter: blob:none` + sparse checkout excluding `archives/` for the build job, and verify sha256 only for archives changed in the PR (`git diff --name-only`). Consider Git LFS only if > 1 GB (LFS bandwidth quota applies to CI). |
| Theme page weight | ~150 KB raw / ~30 KB br | ~550 KB raw / < 100 KB br | Second bottleneck if "500 Ko" is read as raw bytes. Split by sous-thème. |
| Review throughput | Low | Bi-daily | Human, not technical. Line-level annotations and stub scripts are the lever. |

---

## Anti-Patterns

### Anti-Pattern 1: Two schema languages maintained by hand
**What people do:** write `schemas/mesure.schema.json` for CI and a parallel `z.object({...})` in `content.config.ts` "for types".
**Why it's wrong:** they diverge within weeks, and the conditional publié rules end up in only one of them.
**Do this instead:** use the Ajv bridge (§2). Types are generated from JSON Schema.

### Anti-Pattern 2: Trusting `reference()` for integrity
**What people do:** `candidat: reference('candidats')` and assume a bad ID fails the build.
**Why it's wrong:** in Astro 5–7 it has been silently accepted or only logged, depending on version.
**Do this instead:** keep the reference fields as plain slug strings validated by the `integrite` rule, and resolve them in `corpus/`.

### Anti-Pattern 3: Rendering by iterating mesures
**What people do:** `mesures.filter(m => m.theme === t).map(...)`.
**Why it's wrong:** candidates with no mesure disappear silently, which is an equity violation produced by the template.
**Do this instead:** iterate candidates, then render `cellule(c, t)`.

### Anti-Pattern 4: Module script for the level restore
**What people do:** `<script>` (Astro-processed, which becomes `type=module` and therefore deferred) to read localStorage.
**Why it's wrong:** the page paints at Résumé, then jumps to Enfant (flash plus layout shift), which is bad for the readers who most need stability.
**Do this instead:** a classic synchronous same-origin script placed right after the fieldset.

### Anti-Pattern 5: Parsing YAML differently in CI and Astro
**What people do:** CI uses `yaml.parse()` defaults or `js-yaml`, while Astro uses `core` + `timestamp`.
**Why it's wrong:** `consulte_le: 2026-11-03` passes `format: date` in CI and arrives as a `Date` in Astro, or the reverse. "Valid in CI, broken in build" bugs follow.
**Do this instead:** one `load.ts` with Astro's exact options plus `normalizeDates`, and a parity test.

### Anti-Pattern 6: Visual-only reordering (CSS `order`, CSS `random()`)
**Why it's wrong:** screen-reader and keyboard order differ from what sighted users see. For a neutrality product, that means two audiences get different candidate orders.
**Do this instead:** reorder the DOM.

### Anti-Pattern 7: Shipping archives in `dist/`
**Why it's wrong:** VPS disk is at 90 %, and archives add hundreds of MB.
**Do this instead:** link to the Git-hosted copy, and keep `archives/` outside `public/`.

---

## Integration Points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| data.gouv "candidatures 2027 statuts sourcés" | `scripts/import-datagouv.ts` (CSV to YAML `brouillon`), run manually or in a PR | Citizen dataset: copy each row's own dated source into `candidat.statut.source`. Never a runtime fetch. |
| Campaign sites / programme PDFs | `scripts/archive-source.ts <url>` writes `archives/<c>/<sha12>.<ext>` + a `sources/<id>.yaml` stub (`consulte_le` = today, `sha256`) | PDFs via plain fetch. HTML capture via Playwright `page.content()` (dev dependency, already needed for e2e). Single-file HTML captures can be large, so cap them. |
| GitHub Actions | `ci.yml`: setup-node 24, `npm ci`, `npm run ci`; `--format github` annotations | `fetch-depth: 0` is not needed until the lot-5 journal (Git history). |
| Caddy/VPS | Lot 3 (out of scope) | Artifact = `dist/` only. If CSP is added in Caddy, `script-src 'self'` suffices thanks to the external classic scripts. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| content-core ↔ Astro | Direct TS import from `content.config.ts` | Ajv compiles once per config load. Keep the core side-effect free. |
| content-core ↔ CLIs/tests | Direct import | CLIs are thin: arguments, then core, then a formatter. |
| corpus ↔ pages/components | `getCorpus()` + typed view objects | The only place where `RTP_MODE` is read. |
| HTML ↔ enhancement JS | `data-*` attributes + form controls | JS never builds content. It only toggles and reorders existing nodes. |

---

## Suggested Build Order (dependencies)

```
[1] Toolchain scaffold ──→ [2] Schemas v1 + corpus-valide fixture ──→ [3] content-core (load/Ajv/diagnostics/CLI)
                                         │                                     │
                                         │                                     ├─→ [4] Entry+corpus rules + pièges + CI   ★ Lot 1 deliverable
                                         │                                     ├─→ [5] Migration runner (+ version check)
                                         └─→ [6] Archive/import tooling ──→ [7] Real pilot data (brouillon) — can overlap [4]
[3] ──→ [8] Astro bridge + gen:types + corpus view-model (+ preview mode)
[8] ──→ [9] Base layout + LecteurNiveaux (no-JS first) ──→ [10] Theme & candidate pages, Cellule, Source
                                                     └──→ [11] niveau.js enhancement (restore/persist/announce/pageshow)
[10] ──→ [12] Ordre (collator + ordre.js) ──→ [13] Aîné block + Enfant glossary popovers
[10] ──→ [14] Méthode / Mentions / Qui sommes-nous
[10] ──→ [15] check-dist + Playwright no-JS/keyboard/axe ──→ [16] Preview build = "URL de test"   ★ Lot 2 deliverable
```

Implications for the roadmap:
- **Phase A (Lot 1a): steps 1–3.** Schema design is the critical path. Every later artifact depends on field names. Freeze v1 early, and expect one migration before lot 2 ends (that's what the runner is for).
- **Phase B (Lot 1b): steps 4–5, with 6–7 in parallel.** Write the pièges *before* the rules (TDD), since they are the acceptance test. Real data entry (data.gouv import, 3 themes, sources, archives) can run alongside rule work once schemas are frozen. Data validates the rules, and rules catch data problems.
- **Phase C (Lot 2a): steps 8–11.** The toggle (9, 11) only needs fixture data and can be built and a11y-tested against `corpus-valide` before real content is reviewed.
- **Phase D (Lot 2b): steps 12–16.** `check-dist` should start in phase C with the first page, not at the end. Weight and inline-space regressions are cheapest to catch early.
- **Research flags:** step 2 (`couverture` and `sources` modelling, and which statuts fall under equity, need Erwan's decision); step 4 (French word counting and number extraction heuristics); step 13 (popover screen-reader behavior, needs a manual VoiceOver/NVDA check). Steps 1, 3, 8 and 14 are standard.

---

## Open decisions for requirements (surfaced by this architecture)

1. Which statuts are subject to equity: `declare` only, or also `en_primaire`? Default proposed: `declare`.
2. Is "< 500 Ko par page" transferred or decoded bytes? Proposed: transferred, plus a 400 KB raw-HTML guard.
3. Public "copie archivée" link target before the repo goes public: hash only, or self-hosted?
4. Should the random-order preference persist across pages (localStorage) or stay per-page?
5. Accept `sources`, `couverture` and `glossaire` as additional collections beyond the spec's five (recommended).

---

## Sources

- Astro content collections (Astro 7.x docs): https://docs.astro.build/en/guides/content-collections/ — HIGH
- Astro v7 upgrade guide (compressHTML `'jsx'`, stricter compiler, Vite 8): https://docs.astro.build/en/guides/upgrade-to/v7/ — HIGH
- Astro client-side scripts (`is:inline`, module processing): https://docs.astro.build/en/guides/client-side-scripts/ — HIGH
- Astro CSP (stable since v6, `security.csp`): https://docs.astro.build/en/reference/configuration-reference/ , https://astro.build/blog/astro-6/ — MEDIUM (via search summary)
- `astro@7.4.5` published package source, read locally: `dist/content/loaders/glob.js` (generateId default), `dist/content/types-generator.js` (`z.toJSONSchema` with `unrepresentable:"any"`), `dist/content/content-layer.js` (`Invalid content reference` = `logger.error`); `@astrojs/internal-helpers@0.13.0/dist/yaml.js` (core + timestamp) — HIGH
- `reference()` validation history: https://github.com/withastro/astro/issues/13268 , https://github.com/withastro/astro/commit/bd2c1a5a70666cc140c73a77edb41882fc88b277 — HIGH (confirmed in source)
- Zod JSON Schema interop (`toJSONSchema`, experimental `fromJSONSchema`): https://zod.dev/json-schema — HIGH
- Zod API (transform `ctx.issues`, `z.NEVER`, `superRefine`, `z.custom`): https://zod.dev/api — HIGH
- MDN `:has()` (Baseline Dec 2023, perf and forgiving-list notes): https://developer.mozilla.org/en-US/docs/Web/CSS/:has — HIGH
- MDN Popover API (Baseline 2025): https://developer.mozilla.org/en-US/docs/Web/API/Popover_API — HIGH for baseline, LOW for implicit ARIA
- CSS `random()` status: https://www.mail-archive.com/dev-platform@mozilla.org/msg01912.html , https://web-platform-dx.github.io/web-features-explorer/features/random-function/ , https://www.smashingmagazine.com/2026/10/embracing-playful-imperfection-css-random-function/ — MEDIUM
- Node type stripping (default since 22.18, stable 24.12): https://nodejs.org/api/typescript.html , https://github.com/nodejs/node/releases/tag/v22.18.0 — HIGH
- Node release lines (20 EOL; 22/24/26 LTS): https://nodejs.org/dist/index.json — HIGH
- npm registry: astro 7.4.5 (engines node ≥ 22.23.4, zod ^4.6.6), zod 4.6.7, ajv 8.20.0, ajv-formats 3.0.1 — HIGH

---
*Architecture research for: static, Git-backed, schema-validated civic reference site (reveleTonProg)*
*Researched: 2026-11-03*
