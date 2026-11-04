# Phase 1: Fondations, schémas v1 et content-core - Research

**Researched:** 2026-11-03
**Domain:** Node 24 + Astro 7 static scaffold, JSON Schema 2020-12 contract (Ajv 8), YAML parsing (`yaml` 2.9), shared validation core, migration runner, hardened GitHub Actions CI
**Confidence:** HIGH (every load-bearing claim below was exercised in a throw-away probe project on Node 24.21.0 with astro 7.4.5, ajv 8.20.0, yaml 2.9.1, or read from the published package source / official docs today)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Décisions déjà prises par Erwan (2026-11-03)
- D-1 : statuts = codes du dataset `declare|primaire|pressenti|empeche|renonce` ; `renonce` affiché « Ne se présente pas » ; historique `statuts[]` append-only
- D-2 : périmètre d'équité = `declare` + `primaire`, piloté par config
- D-4 : mentions légales éditeur non professionnel (LCEN art. 1-1 II), pas d'adresse personnelle
- D-5 : Node 24 LTS (`.nvmrc` = 24, `engines >=24.12`, `engine-strict`) ; Node 24.21.0 déjà installé localement via fnm

#### Données et sources
- D-3 : presse autorisée comme source d'un **statut** uniquement, `source.type: presse` affiché sur le badge, remplacée dès qu'une source candidat/parti/institution existe ; jamais pour une mesure
- D-8 : archives = extrait `.txt` + sha256 + date de capture + URL Wayback committés dans `archives/` ; binaires (PDF, HTML rendu) dans un repo privé `reveleTonProg-archives` (hors dépôt public) ; plafond 5 Mo par fichier ; LICENSE exclut `archives/`
- D-7 : collections en plus des 5 de la spec : `sources`, `couverture`, `glossaire` (partis = entrées `type: parti` avec auto-description sourcée)
- `motif` obligatoire quand statut `renonce` : enum `retrait`, `elimine_primaire`, `ralliement`, `non_candidat`
- Dates partielles `YYYY-MM` acceptées seulement en `brouillon` (if/then), date complète exigée pour `publie`
- Ids candidats `prenom-nom` ASCII figés ; id amont dans `ids_externes.2027etmoi`
- Un fichier YAML par entité ; mesures sous `src/content/mesures/<candidat>/`

#### Projet
- D-9 : code MIT ; contenu éditorial Licence Ouverte 2.0 ; `archives/` et textes des candidats exclus (droits réservés à leurs auteurs, reproduits à titre de preuve et de citation)
- D-12 : aucune photo en v1.0, pictogramme neutre identique pour tous
- D-13 : convention dès le commit 1 (pas de commentaires informels dans les fichiers de contenu, gitleaks en CI) ; décision squash/publication reportée au lot 3

#### Choix techniques (recherche, SUMMARY.md)
- JSON Schema = seule source de vérité ; loader Astro custom qui appelle content-core (parse + Ajv) ; pas de Zod par champ ; interfaces TS écrites à la main pour le view-model
- YAML parsé avec `schema: 'core'` SANS tag `timestamp` (dates = chaînes), `uniqueKeys`
- Ajv 8 `ajv/dist/2020.js`, strict, allErrors, 3 formats maison (`date`, `date-time`, `https-url`), pas d'ajv-formats
- Tests `node:test` ; scripts `.ts` exécutés nativement par Node 24 (pas de tsx)
- Astro : `compressHTML: true`, `prefetch: false`, image service passthrough
- CI : checkout/setup-node épinglés par SHA, `permissions: contents: read`, `TZ=Europe/Paris`, gitleaks, Dependabot avec cooldown
- TypeScript ^6 (peer de @astrojs/check)

### Claude's Discretion
- Découpage exact des plans, noms de fichiers internes, structure de `defs/common`
- Format exact des diagnostics (doit inclure fichier, ligne, code)

### Deferred Ideas (OUT OF SCOPE)
- Squash de l'historique Git avant passage public — lot 3
- Photos Wikimedia — après v1.0, si jamais

*Scope fence from CONTEXT `<domain>`: les règles éditoriales (mots interdits, longueurs, équité, pièges) relèvent de la Phase 2 ; l'import réel de la Phase 3 ; les pages de la Phase 4.*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOND-01 | Clone → `npm install && npm run validate && npm test && npm run build` on Node 24, nothing else | npm scripts contract §Architecture; `.nvmrc`/`engines`/`engine-strict` verified to refuse Node 22 (probe); fnm Node 24 install is broken locally (Pitfall 1); loader tolerates an empty `src/content` |
| FOND-02 | Astro 7 static, no JS by default, `compressHTML: true`, `prefetch: false`, passthrough images | Probe `astro.config.mjs`; `compressHTML:'jsx'` glues words at newlines, `true` keeps them (verified); `dist/` of the probe contains only `index.html` |
| FOND-03 | CI on push/PR, SHA-pinned, `contents: read`, `TZ=Europe/Paris`, fail on first problem | Draft `ci.yml` with current SHAs (verified via `gh api`); single sequential job |
| FOND-04 | gitleaks in CI; Dependabot with cooldown | gitleaks binary + sha256 (verified); Dependabot `cooldown` keys verified on GitHub docs |
| FOND-05 | LICENSE (MIT + Licence Ouverte 2.0 + carve-outs), ADRs for D-1…D-13 | License structure; ADR numbering plan; stale docs to fix (README says Node 20+, RUNBOOK mesure path) |
| DATA-01 | 8 JSON Schema 2020-12 files, `version_schema` each, single source of truth | Complete verified schema drafts §Pattern 1 |
| DATA-02 | Candidat: id, names, `nom_tri`, parti + `parti_source`, `ids_externes`, `ordre_cc`, `statuts[]` append-only with `motif` | `candidat.schema.json` (verified against valid + invalid cases) |
| DATA-03 | Mesure with 4 rédactions, `statut_relecture`, enfant+aîné required for `publie` | `mesure.schema.json` if/then (verified) |
| DATA-04 | Source with type, auteur, URL, dates, archive block | `source.schema.json` + `archive` def |
| DATA-05 | Couverture per theme with `etat`, `verifie_le`, `verifie_par`, sources consultées | `couverture.schema.json` |
| DATA-06 | Glossaire: terme and parti entries | `glossaire.schema.json` (parti requires sourced self-description) |
| DATA-07 | One loader (`content-core/load`) for CI and Astro; YAML without `timestamp` | `yaml` options verified; Astro object loader verified end to end (build passes/fails) |
| DATA-08 | `npm run migrate -- --check\|--write`, tested before/after; CI fails on outdated file | Migration runner design; `Document` API round-trip caveats (`lineWidth: 0`) verified |
</phase_requirements>

## Summary

Phase 1 is a walking skeleton whose real product is the **data contract**: eight JSON Schema 2020-12 files plus one framework-free module (`src/lib/content-core`) that turns a YAML file into either a validated plain object or `Diagnostic {code, severity, file, line, col, pointer, message}` records. I built and ran that whole chain in a probe project: the 8 schemas compile under Ajv's **unmodified `strict: true`**, a fictional corpus of 9 files covering all 8 collections validates with 0 diagnostics, Node 24 runs the `.ts` sources natively, `astro check` and `tsc` pass under `erasableSyntaxOnly`, and `astro build` renders a page from the corpus. A deliberately broken corpus fails the Astro build with exit code 1 and file:line:code diagnostics. Nothing in the locked decisions turned out to be infeasible; several details needed correction or care (below).

Four findings change what the planner should write down. **(1)** The local Node 24.21.0 is installed in fnm in a malformed layout (`installation` is a file, the real tree sits next to it), so `fnm use 24` reports success but `node` stays v22.23.3; D-5's "already installed" is not usable until reinstalled. **(2)** Astro 7's content layer treats *any* entry object holding a string `collection` field that names a real collection, plus an `id`, as a content reference and logs `Invalid content reference` errors. The spec's `journal` fields (`collection`, `id`) trip it; rename to `collection_cible`/`id_cible`. **(3)** `yaml`'s `Document.toString()` re-folds long strings at 80 columns unless `lineWidth: 0`; without it the migration runner would rewrite every `texte_source`. **(4)** Ajv `strict: true` rejects the common `then: {required: [...]}` pattern (`strictRequired`) and `$ref` siblings without a `type` (`strictTypes`) unless the `then` re-declares the property (`properties: {x: true}`) or the sibling carries `type`; keep strict, fix the schemas (patterns below).

**Primary recommendation:** Build in this order: (a) repo scaffold + Node 24 fix + CI skeleton, (b) `schemas/` + `content-core` + `corpus-valide` + `validate` CLI + schema tests, (c) Astro object loader + one fixture page + dist assertions, (d) migration runner + tests, (e) docs/LICENSE/ADRs. Reuse the verified code in this document verbatim; do not redesign the loader, parse options, or Ajv setup.

## Architectural Responsibility Map

Phase 1 has no browser tier and no runtime server. The "tiers" are build-time stages.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structural contract (fields, enums, if/then) | `schemas/` (static JSON files) | — | Single source of truth, language-neutral (a Python collector can reuse it) |
| YAML parse + structural validation + line mapping | `content-core` (plain Node/TS, no `astro:*`) | — | Must run identically in CLI, tests, CI and Astro |
| Fail the build on invalid data | Astro loader (build tier) | `npm run validate` (CI tier) | Loader throws so `astro build` cannot emit a site from invalid data even if `validate` is skipped |
| Referential/editorial rules | Phase 2 `content-core/rules` | — | Out of scope; Phase 1 leaves the extension point (`loadAll` returns all entries) |
| Schema migration | `scripts/migrate.ts` + `content-core/migrate.ts` | CI `--check` | Mutates content files via YAML Document API |
| Static HTML page from corpus | Astro (SSG) | `dist/` post-build assertions | Proves loader → page chain; zero JS |
| Secret scanning, dependency freshness | GitHub Actions / Dependabot | — | Repo-level, not code |
| Archive files (`.txt` extracts) | Git working tree (`archives/`) | private repo for binaries (D-8) | Never shipped in `dist/` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24 LTS (`.nvmrc` = `24`, `engines.node ">=24.12"`) | Runtime for build, CLIs, tests | Stable native TS type stripping; verified `.ts` scripts run with plain `node` on 24.21.0, no warning noise [VERIFIED: probe] |
| astro | ^7.4.5 | SSG + content layer | Imposed by spec; `engines.node >=22.23.4`; `yaml@^2.9.1` and `zod@^4.6.6` come with it [VERIFIED: npm registry] |
| ajv | ^8.20.0 (`ajv/dist/2020.js`) | JSON Schema 2020-12 validation | Strict mode, `unevaluatedProperties`, `if/then`, cross-file `$ref` by `$id` [VERIFIED: probe] |
| yaml | ^2.9.1 | YAML parse with positions, Document API for migrations | Already in `node_modules` via Astro (deduped, 0 extra bytes) [VERIFIED: `npm ls`] |

### Supporting (dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/check | ^0.9.12 | `astro check` (also type-checks `scripts/*.ts` and `tests/*.ts` when in `tsconfig include`) | CI step; replaces a separate `tsc` call [VERIFIED: probe, an injected type error in `scripts/` was caught] |
| typescript | ^6.0.3 | Peer of `@astrojs/check` (`^5 \|\| ^6`) | Always with it; do not take 7.x (registry `latest` is 7.0.2 today) [VERIFIED: npm view] |
| @types/node | ^24.19.2 | Types for `node:test`, `node:fs` | Always; registry `latest` is 26.x, pin the major to 24 to match the runtime [VERIFIED: npm view] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gitleaks release binary + sha256 | `gitleaks/gitleaks-action@v3` (SHA `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`) | Action is auto-updatable by Dependabot, but its license is proprietary since v2 (free for personal accounts, `GITLEAKS_LICENSE` needed for organizations) [CITED: github.com/gitleaks/gitleaks-action README]. Binary is MIT and has no org licensing risk; cost = manual version bump (put it in the monthly hygiene review). **Recommend the binary.** |
| Own 3 `addFormat`s | `ajv-formats` | Locked decision: own formats |

**Installation:**
```bash
# Prereq: working Node 24 (see Pitfall 1), then:
npm install astro@^7.4.5 ajv@^8.20.0 yaml@^2.9.1
npm install -D @astrojs/check@^0.9.12 typescript@^6.0.3 @types/node@^24.19.2
```

**Version verification (2026-11-03):**
| Package | Verified version | Publish/modified | Notes |
|---------|------------------|------------------|-------|
| astro | 7.4.5 | 2026-11-02 | `npm view astro version engines` |
| ajv | 8.20.0 | 2026-04-24 | 4 tiny deps |
| yaml | 2.9.1 | 2026-09-11 | zero deps |
| @astrojs/check | 0.9.12 | 2026-10-21 | peer typescript `^5 \|\| ^6` |
| typescript | 6.0.3 (`latest` is 7.0.2: do not use) | — | pin `^6.0.3` |
| @types/node | 24.x line | — | `latest` is 26.6.6: pin `^24` |

Installed tree in the probe: 211 top-level `node_modules` entries, 208 MB, **no package with an install script** (`hasInstallScript` absent in `package-lock.json`; `npm view <pkg> scripts.postinstall` empty for all six). [VERIFIED: probe]

## Package Legitimacy Audit

`slopcheck` could not be installed: the sandbox refused `pip install slopcheck` (external code), and I did not retry or work around it. Per protocol every package is therefore tagged `[ASSUMED]` for provenance even though the evidence below is strong; the planner should put **one** `checkpoint:human-verify` before the first `npm install` (a single confirmation covers all six, they are all mainstream).

| Package | Registry | Age | Downloads (last week) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------------------|-------------|-----------|-------------|
| astro | npm | years | 10.9M | github.com/withastro/astro | not run | [ASSUMED] approved; named in spec §8 and Astro docs |
| ajv | npm | years | 513.6M | github.com/ajv-validator/ajv | not run | [ASSUMED] approved |
| yaml | npm | years | 313.0M | github.com/eemeli/yaml | not run | [ASSUMED] approved; already a transitive dep of astro |
| @astrojs/check | npm | years | n/a | github.com/withastro/astro | not run | [ASSUMED] approved; official Astro package |
| typescript | npm | years | 402.6M | github.com/microsoft/TypeScript | not run | [ASSUMED] approved |
| @types/node | npm | years | n/a | github.com/DefinitelyTyped/DefinitelyTyped | not run | [ASSUMED] approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck unavailable)
**Packages flagged [SUS]:** none. No postinstall/install scripts on any of them [VERIFIED: npm registry + lockfile].

GitHub Actions (not npm): `actions/checkout`, `actions/setup-node` are GitHub-owned; SHAs verified via `gh api` below.

## Architecture Patterns

### System Architecture Diagram

```
 YAML files  (src/content/<collection>/…  — or $RTP_CONTENT_ROOT/src/content for the fixture)
     │
     ▼
┌─────────────────────────── content-core (plain TS, no astro:*) ───────────────────────────┐
│ load.ts:  walk dirs ─▶ yaml parseDocument(core, uniqueKeys, LineCounter, merge:false)      │
│             │ doc.errors + doc.warnings ─▶ YAML_* diagnostics (line/col from linePos)      │
│             ▼ doc.toJS({maxAliasCount:0})  (aliases refused)                               │
│ ajv.ts:   Ajv2020 strict ◀── schemas/*.schema.json + defs/common (addSchema, URN $id)      │
│             │ errors ─▶ filter if/anyOf noise ─▶ SCHEMA_<KEYWORD> + pointer                │
│ diagnostics.ts: pointer ─▶ YAML node (key preferred) ─▶ line:col ; format text | github    │
│ migrate.ts: Document API, version chain, toString({lineWidth:0})                           │
└───────────────┬───────────────────────────────────────────────┬────────────────────────────┘
                │ same loadAll()                                │ same loadAll()
                ▼                                               ▼
   scripts/validate.ts  (npm run validate)          src/lib/content-core/astro-loader.ts
   scripts/migrate.ts   (npm run migrate)             (object Loader, NO schema; throws on error
   exit 1 + annotations (≤10 per step)                 in build, logs + keeps old data in dev)
                │                                               │
                ▼                                               ▼
        GitHub Actions job                          astro build ─▶ dist/index.html (zero JS)
   migrate --check ▶ validate ▶ check ▶ test ▶ build   (fixture: RTP_CONTENT_ROOT=tests/fixtures/corpus-valide)
```

### Recommended Project Structure
```
reveleTonProg/
├── .nvmrc  .npmrc  package.json  package-lock.json  tsconfig.json  astro.config.mjs
├── .github/{workflows/ci.yml, dependabot.yml}
├── schemas/                       # 8 *.schema.json + defs/common.schema.json + CHANGELOG.md
├── src/
│   ├── content.config.ts          # 8 collections, loader only (no schema)
│   ├── content/                   # real corpus (empty in Phase 1: loader must tolerate absent dirs)
│   ├── lib/content-core/{load,ajv,diagnostics,migrate,astro-loader}.ts   (+ config.ts in Phase 2)
│   └── pages/index.astro          # walking-skeleton page
├── scripts/{validate.ts, migrate.ts, migrations/<schema>/<NNN>-<desc>.ts}
├── tests/
│   ├── fixtures/corpus-valide/{src/content/**, archives/**}   # mirrors repo layout
│   ├── repo/ schemas/ content-core/ migrations/ dist/ *.test.ts
├── archives/                      # real archives (empty now) + README with rights notice
├── LICENSE  docs/{ARCHITECTURE,RUNBOOK,RETROSPECTIVE}.md  README.md
```
**Why the fixture mirrors the repo layout** (`src/content/…` and `archives/…` under the fixture root): `loadAll(root)`, the CLI `--root`, and Phase 2's archive-file/sha256 check all resolve paths relative to a root, so the fixture is tested by exactly the code that tests the real corpus.

### Pattern 1: Schema design (verified)

All eight schemas below were compiled with `new Ajv2020({ strict: true, allErrors: true })` (no strictness relaxed) and exercised with valid and invalid documents. Conventions:

- `$schema` = 2020-12; `$id` = `urn:reveletonprog:schema:<name>`; shared defs in `urn:reveletonprog:schema:common` and referenced by the **absolute URN** `urn:reveletonprog:schema:common#/$defs/<x>` (relative refs cannot resolve against a URN base). Load with `ajv.addSchema(json)` for every file, then `ajv.getSchema(urn)`. [VERIFIED: probe]
- Every file: `version_schema: { "const": 1 }` (required), `type: object`, **`unevaluatedProperties: false`** at the root and in every nested object (not `additionalProperties`, which breaks with `allOf`/`$ref` composition). Typos in field names are therefore rejected; so is `photo` (D-12).
- Conditional rules use `if/then/else`. Under `strict: true` each `then`/`else` that mentions `required` must **re-declare** the property (`"properties": { "x": true }`), and each `$ref` sibling that adds `properties` needs `"type": "object"`. Forbidding a property uses `"properties": { "motif": false }` (gives a precise pointer `/statuts/1/motif`; `not: {required: [...]}` points at the parent and says only "must NOT be valid").
- Rule of thumb for `schemas/CHANGELOG.md`: loosening or adding an *optional* field = no version bump; tightening, renaming, or new required field = bump + migration. So start loose where the spec is silent.
- **Never name a data field `collection`** (see Pitfall 2): the journal uses `collection_cible` / `id_cible`.

`schemas/defs/common.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:reveletonprog:schema:common",
  "title": "Définitions communes",
  "$defs": {
    "slug":            { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$", "maxLength": 80 },
    "idCandidat":      { "type": "string", "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)+$", "maxLength": 80 },
    "dateComplete":    { "type": "string", "format": "date" },
    "datePartielle":   { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "dateOuPartielle": { "anyOf": [ { "$ref": "#/$defs/dateComplete" }, { "$ref": "#/$defs/datePartielle" } ] },
    "dateHeure":       { "type": "string", "format": "date-time" },
    "urlHttps":        { "type": "string", "format": "https-url" },
    "sha256":          { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "texte":           { "type": "string", "minLength": 1 },
    "statutRelecture": { "enum": ["brouillon", "relu", "publie"] },
    "archive": {
      "type": "object",
      "required": ["extrait", "sha256", "capture_le"],
      "unevaluatedProperties": false,
      "properties": {
        "extrait":        { "type": "string", "pattern": "^archives/([a-z0-9-]+/)*[a-z0-9._-]+\\.txt$" },
        "sha256":         { "$ref": "#/$defs/sha256" },
        "capture_le":     { "$ref": "#/$defs/dateHeure" },
        "wayback_url":    { "type": "string", "format": "https-url", "pattern": "^https://web\\.archive\\.org/web/[0-9]{14}/" },
        "binaire_sha256": { "$ref": "#/$defs/sha256" }
      }
    },
    "sourceStatut": {
      "type": "object",
      "required": ["type", "url", "date_consultation"],
      "unevaluatedProperties": false,
      "properties": {
        "type":              { "enum": ["candidat", "parti", "institution", "presse"] },
        "titre":             { "$ref": "#/$defs/texte" },
        "url":               { "$ref": "#/$defs/urlHttps" },
        "date_publication":  { "$ref": "#/$defs/dateOuPartielle" },
        "date_consultation": { "$ref": "#/$defs/dateComplete" },
        "archive":           { "$ref": "#/$defs/archive" }
      }
    }
  }
}
```
Notes: the `archive.extrait` pattern forbids `..` path traversal because directory segments cannot contain dots. `capture_le` is a full date-time with offset. `archive.sha256` is defined here as **the sha256 of the committed `.txt` extract** (the only artifact CI can check; the binary lives in the private repo, D-8) and `binaire_sha256` optionally records the PDF/HTML hash. `wayback_url` is optional (see Assumption A3).

`schemas/candidat.schema.json` (DATA-02)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:reveletonprog:schema:candidat",
  "title": "Candidat",
  "type": "object",
  "required": ["version_schema", "id", "prenom", "nom", "nom_tri", "parti", "statuts"],
  "unevaluatedProperties": false,
  "properties": {
    "version_schema": { "const": 1 },
    "id":      { "$ref": "urn:reveletonprog:schema:common#/$defs/idCandidat" },
    "prenom":  { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "nom":     { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "nom_tri": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "parti":   { "type": ["string", "null"], "minLength": 1 },
    "parti_source": {
      "$ref": "urn:reveletonprog:schema:common#/$defs/sourceStatut",
      "type": "object",
      "properties": { "type": { "enum": ["candidat", "parti"] } }
    },
    "site_officiel":    { "$ref": "urn:reveletonprog:schema:common#/$defs/urlHttps" },
    "mandats_en_cours": { "type": "array", "uniqueItems": true, "items": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" } },
    "ids_externes": {
      "type": "object",
      "properties": { "2027etmoi": { "type": "string", "minLength": 1 }, "wikidata": { "type": "string", "pattern": "^Q[0-9]+$" } },
      "additionalProperties": { "type": "string", "minLength": 1 }
    },
    "ordre_cc": { "type": "integer", "minimum": 1 },
    "statuts": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["code", "date", "source", "statut_relecture"],
        "unevaluatedProperties": false,
        "properties": {
          "code":   { "enum": ["declare", "primaire", "pressenti", "empeche", "renonce"] },
          "motif":  { "enum": ["retrait", "elimine_primaire", "ralliement", "non_candidat"] },
          "date":   { "$ref": "urn:reveletonprog:schema:common#/$defs/dateOuPartielle" },
          "source": { "$ref": "urn:reveletonprog:schema:common#/$defs/sourceStatut" },
          "statut_relecture": { "$ref": "urn:reveletonprog:schema:common#/$defs/statutRelecture" },
          "relecteur":        { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
          "date_relecture":   { "$ref": "urn:reveletonprog:schema:common#/$defs/dateComplete" }
        },
        "allOf": [
          { "if": { "properties": { "code": { "const": "renonce" } }, "required": ["code"] },
            "then": { "required": ["motif"], "properties": { "motif": true } },
            "else": { "properties": { "motif": false } } },
          { "if": { "properties": { "statut_relecture": { "const": "brouillon" } }, "required": ["statut_relecture"] },
            "else": { "required": ["relecteur", "date_relecture"],
                      "properties": { "relecteur": true, "date_relecture": true,
                                      "date": { "$ref": "urn:reveletonprog:schema:common#/$defs/dateComplete" } } } }
        ]
      }
    }
  },
  "if":   { "properties": { "parti": { "type": "string" } }, "required": ["parti"] },
  "then": { "required": ["parti_source"], "properties": { "parti_source": true } }
}
```
Design points (all exercised): `motif` required iff `code: renonce` and forbidden otherwise (D-1). A partial date `2026-11` passes only when the *statut entry* is `brouillon`; for `relu`/`publie` the `else` tightens `date` to a full date. `statuts[]` is append-only by convention: the **last element is current**; chronological order and "no entry removed/edited" are Phase 2 corpus rules (`ids.lock`-style, git-diff based), not schema constructs. The relecture fields sit **on each `statuts[]` entry** (palier B = every status change is reviewed) rather than on the candidate; this is the smallest design that gives the "partial date only in brouillon" rule a hook (Assumption A1). `parti: null` is valid for "sans étiquette" (no `parti_source` then). `ids_externes` key `2027etmoi` starts with a digit and is a plain string in YAML 1.2 core (verified).

`schemas/mesure.schema.json` (DATA-03)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:reveletonprog:schema:mesure",
  "title": "Mesure",
  "type": "object",
  "required": ["version_schema", "id", "candidat", "theme", "sous_theme", "titre", "texte_source", "source", "redactions", "statut_relecture"],
  "unevaluatedProperties": false,
  "properties": {
    "version_schema": { "const": 1 },
    "id":         { "type": "string", "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)+/[a-z0-9]+(-[a-z0-9]+)*$" },
    "candidat":   { "$ref": "urn:reveletonprog:schema:common#/$defs/idCandidat" },
    "theme":      { "$ref": "urn:reveletonprog:schema:common#/$defs/slug" },
    "sous_theme": { "$ref": "urn:reveletonprog:schema:common#/$defs/slug" },
    "titre":         { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "texte_source":  { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "source":              { "$ref": "urn:reveletonprog:schema:common#/$defs/slug" },
    "source_localisation": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "redactions": {
      "type": "object", "required": ["resume", "detaille"], "unevaluatedProperties": false,
      "properties": {
        "resume":   { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
        "detaille": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
        "enfant":   { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
        "aine":     { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" }
      }
    },
    "chiffrage": {
      "type": "object", "required": ["texte"], "unevaluatedProperties": false,
      "properties": { "texte": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
                      "source_localisation": { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" } }
    },
    "statut_relecture": { "$ref": "urn:reveletonprog:schema:common#/$defs/statutRelecture" },
    "relecteur":        { "$ref": "urn:reveletonprog:schema:common#/$defs/texte" },
    "date_relecture":   { "$ref": "urn:reveletonprog:schema:common#/$defs/dateComplete" }
  },
  "allOf": [
    { "if": { "properties": { "statut_relecture": { "const": "publie" } }, "required": ["statut_relecture"] },
      "then": { "properties": { "redactions": { "type": "object", "required": ["enfant", "aine"], "properties": { "enfant": true, "aine": true } } } } },
    { "if": { "properties": { "statut_relecture": { "enum": ["relu", "publie"] } }, "required": ["statut_relecture"] },
      "then": { "required": ["relecteur", "date_relecture"], "properties": { "relecteur": true, "date_relecture": true } } }
  ]
}
```
`mesure.id` = `<candidat-id>/<slug>` (file `src/content/mesures/<candidat>/<slug>.yaml`; the "path = id" and "id prefix = `candidat`" checks are Phase 2). `source` is a *reference* to a `sources` entry (slug), and a measure can never carry a free-form press source: `presse` is not in the `sources.type` enum. `résumé` and `détaillé` are required in every state; `enfant`/`aine` only from `publie`; `relecteur` + `date_relecture` from `relu` (a stricter-than-spec but cheap rule, Assumption A2).

`schemas/source.schema.json` (DATA-04): required `version_schema, id(slug), type, auteur, candidats[], titre, url(https), date_publication, date_consultation, archive`.
- `type`: enum `programme | site_candidat | site_parti | discours | tribune | depot_cc` (primary types only: `presse` is a structural error here, and the Phase 2 code `SOURCE_NON_PRIMAIRE` maps from `SCHEMA_ENUM` at `/type`).
- `auteur`: enum `candidat | parti_du_candidat | coalition`; `candidats`: array of `idCandidat`, `minItems 1`, `uniqueItems` (needed so Phase 2 can test "party platform counts only with endorsement" and "measure.candidat ∈ source.candidats"; not in DATA-04's list but required to make REGLE-01/07 decidable, Assumption A4).
- `date_publication`: `dateOuPartielle` (programmes often carry only a month); `date_consultation`: `dateComplete`; `archive`: `$ref` common `archive`, **required** (a source cannot exist without its archive).

`schemas/couverture.schema.json` (DATA-05): `{version_schema, id(slug = theme id), theme(slug), cases[] (minItems 1)}`; each case `{candidat, etat: mesures|non_precise|programme_non_publie, verifie_le(date), verifie_par(texte), sources_consultees?: slug[]}` with
```json
"if":   { "properties": { "etat": { "const": "non_precise" } }, "required": ["etat"] },
"then": { "required": ["sources_consultees"], "properties": { "sources_consultees": { "type": "array", "minItems": 1 } } }
```
(a "non précisé" claim must name the sources consulted). The consistency of `etat` with actual published measures and with the candidate set is Phase 2 (`equite`).

`schemas/glossaire.schema.json` (DATA-06): `{version_schema, id(slug), type: terme|parti, libelle, definition (1..300 chars), source?: sourceStatut with type ∈ {parti, institution}}` and
```json
"if":   { "properties": { "type": { "const": "parti" } }, "required": ["type"] },
"then": { "required": ["source"], "properties": { "source": { "type": "object", "properties": { "type": { "const": "parti" } } } } }
```
A `parti` entry therefore *must* carry a source of type `parti` (its own self-description); the definition text is that self-description. "One sentence, CM1 level" is a Phase 2 editorial rule; the schema only caps at 300 chars.

`schemas/theme.schema.json`: `{version_schema, id(slug), nom, ordre(int≥1), mots_cles?: texte[] unique, prioritaire_aine?: boolean, sous_themes: [{id(slug), nom}] (minItems 1), statut_relecture}`. `statut_relecture` doubles as the theme's publication state that REGLE-08 will read; uniqueness of `sous_themes[].id` and `mesure.sous_theme ∈ theme.sous_themes` are Phase 2.

`schemas/sondage.schema.json` (schema only in v1.0, displayed in lot 4): required `version_schema, id(slug), institut, commanditaire, terrain{debut,fin: date}, date_publication(date-time), echantillon(int≥1), methode(en_ligne|telephone|mixte), base(inscrits|certains_aller_voter), marges_erreur[{score_pct, marge_pct}] (minItems 1), url_notice(https), url_publication(https), tour(enum [1,2]), hypotheses[{nom, scores[{candidat(idCandidat), pct 0..100}] (minItems 2), autres_pct?}] (minItems 1), statut_relecture` + optional `relecteur`, `date_relecture`. `url_notice` is required, so REGLE-09's "notice absente" is a structural error. Sum 95-105 %, tour/hypothesis coherence and the blocking windows are Phase 2.

`schemas/journal.schema.json` (generated in lot 5): `{version_schema, id (^[0-9]{8}-[0-9]{3}$), date(date-time), type: ajout|correction|retrait, collection_cible: candidats|themes|mesures|sources|couverture|glossaire|sondages, id_cible, resume, source?(https), auteur}`. **Not** `collection`/`cible` (Pitfall 2). One file per entry: `src/content/journal/<id>.yaml`.

### Pattern 2: Ajv setup + diagnostic mapping (verified)

```ts
// src/lib/content-core/ajv.ts  (core parts)
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';

export function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true, allErrors: true });   // no strict* relaxation, no coerceTypes, no useDefaults
  ajv.addFormat('date', { type: 'string', validate: isoDate });  // real calendar date: Date.UTC round-trip
  ajv.addFormat('date-time', { type: 'string', validate: (s: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && isoDate(s.slice(0, 10)) && !Number.isNaN(Date.parse(s)) });
  ajv.addFormat('https-url', { type: 'string', validate: (s: string) => URL.canParse(s) && new URL(s).protocol === 'https:' });
  for (const f of ['defs/common.schema.json', ...readdirSync(SCHEMAS_DIR).filter((n) => n.endsWith('.schema.json'))])
    ajv.addSchema(JSON.parse(readFileSync(SCHEMAS_DIR + f, 'utf8')));   // $id taken from the file
  return ajv;
}
// validator: ajv.getSchema('urn:reveletonprog:schema:' + name)  (compile is lazy, memoize the Ajv instance)
```
Error post-processing that the probe needed (put it in `ajv.ts`):
- **Drop `keyword === 'if'` and `'anyOf'` errors** ("must match "then" schema" noise). The informative error is the child (`required`, `format`…).
- **`unevaluatedProperties` / `additionalProperties`**: `instancePath` is the *parent*; append `/` + `params.unevaluatedProperty` so the line points at the offending key (`photo` was reported at its own line).
- **`required`**: pointer = the parent object; message built from `params.missingProperty`.
- Code scheme: `SCHEMA_` + keyword upper-cased (`SCHEMA_REQUIRED`, `SCHEMA_ENUM`, `SCHEMA_FORMAT`, `SCHEMA_CONST`, `SCHEMA_UNEVALUATEDPROPERTIES`, `SCHEMA_FALSE` for forbidden-by-`false`). Provide an **override table keyed by (schema, keyword, pointer pattern)** so Phase 2 can expose stable domain codes (e.g. `/version_schema` `const` with value < current → `SCHEMA_VERSION_OBSOLETE` "lancer `npm run migrate -- --write`"; `/type` `enum` in `source` → `SOURCE_NON_PRIMAIRE`).
- Throughput measured: ~540 000 candidat validations/s: performance is a non-issue (59 candidates + a few hundred measures).

### Pattern 3: YAML parse (`yaml` 2.9.1), verified options

```ts
import { parseDocument, LineCounter, type Document } from 'yaml';
export function parseYamlText(text: string, lc: LineCounter): Document.Parsed {
  return parseDocument(text, { schema: 'core', uniqueKeys: true, lineCounter: lc, merge: false });
}
// consumer: problems = [...doc.errors, ...doc.warnings]   // warnings count as errors (see below)
//           data = doc.toJS({ maxAliasCount: 0 })          // throws "Alias resolution is disabled" on any *alias
```
Verified behaviors:
| Input | Result with `schema:'core'` (no `customTags`) |
|-------|-----------------------------------------------|
| `date: 2026-11-03`, `partielle: 2026-11` | strings `"2026-11-03"`, `"2026-11"` (no `Date`); Astro's own `file()` loader would produce a `Date` because it passes `customTags:['timestamp']`: that is why our loader must be the only parser |
| `oui: no` | string `"no"` (no YAML 1.1 "Norway problem") |
| `zero: 010` | number **10** (YAML 1.2 core reads leading-zero decimals): ids/labels that look numeric must be quoted; Ajv `type: string` then rejects the number, which is the desired outcome |
| `n: 1_000` | string |
| duplicate key | `doc.errors[0].code === 'DUPLICATE_KEY'`, `linePos` present (with `LineCounter`, `prettyErrors` default true) |
| two documents (`---`) | `MULTIPLE_DOCS` error |
| `a: [1, 2` | `BAD_INDENT`/syntax error with `linePos` |
| `a: !!timestamp 2026-11-03` | **resolves to a `Date` even with `schema:'core'`** and no warning; Ajv `type: string` rejects it |
| `b: !foo bar` | **warning** `TAG_RESOLVE_FAILED`, value `"bar"`: treat warnings as errors |
| `<<: *x` / aliases | `merge:false` leaves `<<` a literal key; `maxAliasCount:0` refuses aliases |
| empty file | `doc.contents === null`, `toJS()` null: emit `YAML_RACINE_NON_OBJET` |

Pointer → line: walk `doc.contents` (`isMap`/`isSeq`/`isScalar`), find the `Pair` whose key scalar equals the segment, remember the **key** node, and return `lc.linePos(node.range[0])` → `{line, col}` (1-based). Prefer the key node for "unknown property"/format errors and the object node for "missing required" (the code in `diagnostics.ts` of the probe does exactly this; it located `photo` at 7:1 and a bad URL inside a flow mapping at 11:29). `prettyErrors` messages end with "at line N, column M:": strip everything after the first `\n` and that suffix.

### Pattern 4: Astro 7 object loader (verified on `astro@7.4.5` source + docs + builds)

API [CITED: docs.astro.build/en/reference/content-loader-reference]: loader = `{ name: string, load(context): Promise<void>, schema?, createSchema?() }`; `context = { collection, store, meta, logger, config, parseData, renderMarkdown, generateDigest, watcher (dev only), refreshContextData, entryTypes }`; `store` methods `get/set/has/delete/clear/keys/entries/values`; `store.set({ id, data, filePath?, digest?, body?, rendered? })` returns `false` if the digest is unchanged. `Loader` type is exported from `astro/loaders`.

Verified source facts (`dist/content/content-layer.js`, `utils.js`):
- `schema` is read from `collection.schema`, then `collection.loader.schema`, then `loader.createSchema()`. **If all are absent, `getEntryData` returns the data untouched** (`if (schema) {…} return data`): passthrough, and `parseData()` is a no-op. So: define collections as `defineCollection({ loader })` with **no `schema` anywhere**, and do not use `parseData` (nothing to validate in Zod).
- `loader.load(context)` runs inside `Promise.all` over collections inside `sync()`. A throw there fails `astro build` with exit code 1 and **no `dist/`** (probe: `EXIT 1`, `ls dist` empty). Astro prints the message plus a `Location/Stack trace` block; keep the thrown message short and `logger.error(...)` each diagnostic before throwing.
- Entry ids are used verbatim: `marie-fictive/encadrement-loyers` works with `getCollection` and `getEntry('mesures', 'marie-fictive/encadrement-loyers')` (probe).
- `getCollection()` order is not guaranteed: sort explicitly in the view-model.
- `watcher` exists only in `astro dev`, and Astro wraps it to auto-remove listeners on re-sync. Use `if (!watcher) throw …` to get "fail the build, but don't kill the dev server": a throw during dev start made the dev server exit ("Dev server process exited before becoming ready", probe).

```ts
// src/lib/content-core/astro-loader.ts
import type { Loader } from 'astro/loaders';
import { fileURLToPath } from 'node:url';
import { loadAll, type CollectionName, type LoadResult } from './load.ts';
import { formatText } from './diagnostics.ts';

let memo: { key: string; res: LoadResult; reported: boolean } | undefined;   // 8 loaders share ONE loadAll per sync
function shared(root: string): { res: LoadResult; first: boolean } {
  const key = fingerprint(root);                    // join of relative path + mtimeMs + size for src/content/**, schemas/**
  if (memo?.key !== key) memo = { key, res: loadAll(root), reported: false };
  const first = !memo.reported; memo.reported = true;
  return { res: memo.res, first };
}

export function contentCoreLoader(name: CollectionName): Loader {
  return {
    name: `content-core:${name}`,                   // deliberately NO `schema`
    load: async ({ config, store, generateDigest, logger, watcher }) => {
      const root = process.env.RTP_CONTENT_ROOT ?? fileURLToPath(config.root);
      const run = () => {
        const { res, first } = shared(root);
        const errors = res.diagnostics.filter((d) => d.severity === 'error');
        if (errors.length) {
          if (first) for (const d of errors) logger.error(formatText(d));   // once, not 8×
          if (!watcher) throw new Error(`content-core : ${errors.length} erreur(s) de contenu, build interrompu`);
          return;                                                            // dev: keep previous data
        }
        store.clear();
        for (const e of res.entries.filter((x) => x.collection === name))
          store.set({ id: e.id, data: e.data, digest: generateDigest(e.data), filePath: e.file });
      };
      run();
      if (watcher) {
        watcher.add(`${root}/src/content`);
        const again = (p: string) => { if (p.includes('/src/content/')) run(); };
        watcher.on('change', again); watcher.on('add', again); watcher.on('unlink', again);
      }
    },
  };
}
```
Probe status of this snippet: the probe used a time-bucket memo and logged errors once per loader (duplicate lines per loader were observed); the `fingerprint`/`reported` refinements above are the fix and are straightforward but **were not re-run** (Assumption A5). `src/content.config.ts` is then eight lines: `export const collections = { candidats: defineCollection({ loader: contentCoreLoader('candidats') }), … }`. Content root: `RTP_CONTENT_ROOT` (default = Astro root) lets CI and tests build the fixture without touching the real corpus. Use `astro build --outDir <tmp>` in dist tests (flag exists, verified).

Typing: with no schema, `entry.data` is loosely typed (`astro check` passed with `c.data.nom_tri.localeCompare(...)`). Cast once in `src/lib/corpus/` to hand-written interfaces; pages never touch `getCollection` directly (project architecture rule).

### Pattern 5: Migration runner (DATA-08)

- Current version of a collection = `schema.properties.version_schema.const` (read from the loaded schema; no separate registry).
- File version = `doc.get('version_schema')` from the `yaml` Document (integer). Outcomes: `a_jour`, `en_retard` (file < const), `trop_recent` (file > const → error), `invalide` (missing/non-integer → error).
- `--check`: report every `en_retard` file as `MIGRATION_EN_RETARD file:line "lancer npm run migrate -- --write"` (line of `version_schema`), exit 1. Run it **before** `validate` in CI so the actionable message wins over a confusing `SCHEMA_CONST`.
- `--write`: apply the chain `from → from+1 …` using migrations registered in `scripts/migrations/<schema>/<NNN>-<desc>.ts` (`export const collection, from, to; export function migrate(doc: Document.Parsed)`), set `version_schema` last, write `doc.toString({ lineWidth: 0 })`, then run `validate`. A missing link in the chain throws `Aucune migration <schema> v<N> -> v<N+1>`.
- Migrations mutate the **Document API** (`doc.set`, `doc.setIn`, `doc.has`), never `JSON.stringify`/`js-yaml`: comments, key order and quoting survive.

Round-trip facts (verified; they dictate the design):
| `toString` option | Effect on a realistic file |
|---|---|
| default | **refolds long scalars at 80 columns** (a 150-char `texte_source` was split over 3 lines), also shifts `- a` sequences under a key by 2 spaces |
| `{ lineWidth: 0 }` | long strings and `>-` / `\|` block scalars intact; remaining diffs: comment spacing before `#` normalized to one space, `- a` under a key indented, flow `[1,2]` → `[ 1, 2 ]` |
Therefore: **always `lineWidth: 0`** (constant `TO_STRING_OPTS`), only rewrite files that actually migrate, and document a canonical content style (2-space indent, indented sequences, no padded trailing comments) in the README/RUNBOOK + `.editorconfig`. The `node:test` suite must assert comments, the `# en-tête` line and a >80-char line survive, that the result is idempotent, and that a v3 file against a v2 schema is rejected.
v1.0 ships zero real migrations. The mechanism is proven by (a) unit tests with an injected registry and fake `Migration`, and (b) an integration test where a copy of a fixture file carries `version_schema: 0`: `migrate --check` exits 1 with `MIGRATION_EN_RETARD` (no migration needed to *detect*).

### Pattern 6: GitHub Actions (verified SHAs and keys)

| Item | Value | Source |
|------|-------|--------|
| `actions/checkout` | `v7.0.1` → `3d3c42e5aac5ba805825da76410c181273ba90b1` (runs on node24) | `gh api repos/actions/checkout/git/ref/tags/v7.0.1` [VERIFIED] |
| `actions/setup-node` | `v7.1.0` → `949feb2413d6458794dcd2491c4babbbce0c15c1` (node24; inputs `node-version-file`, `cache`) | [VERIFIED: gh api + action.yml] |
| `actions/upload-artifact` (Phase 4/5, not now) | `v7.0.2` → `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | [VERIFIED] |
| gitleaks binary | `v8.30.1`, `gitleaks_8.30.1_linux_x64.tar.gz` sha256 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` (matches `gitleaks_8.30.1_checksums.txt`) | [VERIFIED: gh release download] |
| gitleaks action (alternative) | `v3.0.0` → `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` (node24) | [VERIFIED] |
| Dependabot `cooldown` | keys `default-days` (default 3), `semver-major-days`, `semver-minor-days`, `semver-patch-days`, `include`, `exclude`; **version updates only**, not security updates; semver keys are **not** supported for the `github-actions` ecosystem (use `default-days` only) | [CITED: docs.github.com dependabot-options-reference] |
| Dependabot schedule | `interval: weekly`, `day`, `time` "hh:mm", `timezone` (IANA); `open-pull-requests-limit` default 5 | [CITED: same page] |
| `::error` annotation | `::error file=…,line=…,col=…,title=…::message`; escape data `%`→`%25`, `\r`→`%0D`, `\n`→`%0A`; properties additionally `:`→`%3A`, `,`→`%2C` | [CITED: actions/toolkit `command.ts`] |
| Annotation cap | 10 errors + 10 warnings per step, 50 per job, extra ones silently dropped | [CITED: GitHub REST check-runs docs + community reports] → print every diagnostic as plain text and annotate only the first 10 |

The repo is private on GitHub with Actions enabled and `sha_pinning_required: false` (repo setting; enabling it enforces SHA pinning server-side) [VERIFIED: `gh api repos/ErwanHenry/reveleTonProg/actions/permissions`].

Draft `.github/workflows/ci.yml` (YAML-parsed OK; `actionlint`/`zizmor` not installed here, run `actionlint` once if available):
```yaml
name: CI
on:
  push:
  pull_request:
permissions:
  contents: read
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
env:
  TZ: Europe/Paris
  ASTRO_TELEMETRY_DISABLED: "1"
jobs:
  verifier:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run migrate -- --check
      - run: npm run validate -- --format github
      - run: npm run check            # astro check (covers scripts/ and tests/ .ts)
      - run: npm test                 # includes dist tests that build the fixture to a temp outDir
      - run: npm run build
  secrets:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { fetch-depth: 0, persist-credentials: false }
      - name: Installer gitleaks (binaire épinglé, somme de contrôle vérifiée)
        env:
          GITLEAKS_VERSION: 8.30.1
          GITLEAKS_SHA256: 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
        run: |
          curl -sSfL -o "$RUNNER_TEMP/gitleaks.tgz" "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
          echo "${GITLEAKS_SHA256}  $RUNNER_TEMP/gitleaks.tgz" | sha256sum -c -
          mkdir "$RUNNER_TEMP/gitleaks" && tar -xzf "$RUNNER_TEMP/gitleaks.tgz" -C "$RUNNER_TEMP/gitleaks" gitleaks
      - run: '"$RUNNER_TEMP/gitleaks/gitleaks" git --no-banner --redact -v .'
```
"Échoue au premier problème": steps in one job stop at the first failing step by default; the `secrets` job runs in parallel and also fails the workflow. gitleaks CLI uses `gitleaks git` for history and `gitleaks dir` for files (`detect`/`protect` are deprecated hidden aliases) [CITED: gitleaks README]. Keep `permissions: contents: read` at workflow level: no job needs more.

`.github/dependabot.yml`
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday, time: "06:00", timezone: Europe/Paris }
    cooldown: { default-days: 7, semver-major-days: 14 }
    open-pull-requests-limit: 5
    groups:
      astro: { patterns: ["astro", "@astrojs/*"] }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly, day: monday, time: "06:00", timezone: Europe/Paris }
    cooldown: { default-days: 7 }
```
Dependabot will **not** bump the hard-coded gitleaks version/sha in the workflow: add "bump gitleaks pin" to the monthly hygiene review (RUNBOOK).

### Anti-Patterns to Avoid
- **A second parser for Astro** (`glob()`/`file()` on the YAML): it re-introduces `Date` objects (`customTags:['timestamp']`) and a second validation path. All YAML goes through `content-core`.
- **`additionalProperties: false` with `allOf`/`$ref`**: use `unevaluatedProperties: false`.
- **Relaxing Ajv strict mode** to silence `strictRequired`/`strictTypes` errors: fix the schema instead (`properties: {x: true}`, add `type`).
- **Zod field schemas, `reference()`, `z.fromJSONSchema()`**: none; integrity is a Phase 2 rule.
- **Putting rule logic in `scripts/`**: CLIs only call `content-core`.
- **A data field named `collection`** (Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing with positions | regex/line scanner | `yaml` `parseDocument` + `LineCounter` | Handles flow style, block scalars, duplicate keys, error codes |
| Comment-preserving edits | `JSON.stringify` + dump | `yaml` Document API (`doc.set`, `toString({lineWidth:0})`) | Review diffs stay minimal |
| JSON Schema evaluation | custom `if/then` checks | Ajv 2020 | Conditional rules, `unevaluatedProperties`, `$ref` across files |
| Date validity | regex only | `Date.UTC` round-trip (the `date` format above) | `2026-02-30` must fail |
| URL validity | regex | `URL.canParse` + `protocol === 'https:'` | Rejects `javascript:`, relative, `http:` |
| Hashing | external lib | `node:crypto` `createHash('sha256')` | Phase 2 archive check |
| GitHub annotations | action/library | `::error` lines with toolkit escaping | 6 lines, zero deps |
| Test runner / `.ts` execution | vitest, tsx | `node:test`, `node --test "tests/**/*.test.ts"` (glob handled by Node) | Locked decision; verified on 24.21.0 |
| Secret scanning | home-grown grep | gitleaks | Maintained rule set |

**Key insight:** every "small" piece above has a sharp edge (YAML 1.1 vs 1.2, refolding, annotation escaping, calendar validity); the verified snippets in this document are the minimal safe versions.

## Common Pitfalls

### Pitfall 1: Node 24 is installed but unusable through fnm
**What goes wrong:** `fnm use 24` prints "Using Node v24.21.0" but `node --version` still prints v22.23.3 (probe). `~/.local/share/fnm/node-versions/v24.21.0/installation` is a 6 KB *file* (a stray `.DS_Store`-like blob) and the real tree is the sibling `node-v24.21.0-darwin-arm64/` (the 22.x installs, by contrast, look normal). The Node 24 binary itself works: `…/node-v24.21.0-darwin-arm64/bin/node` → v24.21.0, npm 11.19.0.
**Why:** the tarball was extracted by hand rather than by `fnm install`.
**How to avoid:** a Wave 0 task: `fnm uninstall 24.21.0 && fnm install 24` (then `fnm default 24`, add `fnm env --use-on-cd` to the shell profile so `.nvmrc` is honored), verify `node --version` ≥ 24.12. Executors that cannot fix the shell should prefix `PATH` with the bin directory above. `engine-strict=true` makes the failure explicit: under Node 22 `npm install` stops with `Unsupported engine … Required: {"node":">=24.12"}` [VERIFIED: probe].
**Warning signs:** `EBADENGINE`/"Unsupported engine"; `node --version` ≠ `.nvmrc`.

### Pitfall 2: Astro mistakes data for content references
**What goes wrong:** with a journal entry `{ id: "20261103-001", collection: "mesures", … }` the build logs `[ERROR] [content] Invalid content reference: entry "20261103-001" in collection "journal" references "20261103-001" in collection "mesures", but that entry does not exist.` (probe). `#validateReferences` walks every entry's data and treats any object having a string `collection` that names a collection plus an `id`/`slug` as a reference; it logs but does not fail the build.
**How to avoid:** no field called `collection` (with a collection name as value) anywhere in any schema. Journal uses `collection_cible` + `id_cible`. Add a schema meta-test that greps the schema property names for `collection`.
**Warning signs:** `Invalid content reference` in build output.

### Pitfall 3: `compressHTML: 'jsx'` (the Astro 7 default) glues words
**What goes wrong:** `…<span>b</span>⏎fin` becomes `…<span>b</span>fin` (newline between an inline element and text is deleted); `compressHTML: true` keeps it (probe, both modes built and compared). French prose with links/definition buttons breaks.
**How to avoid:** `compressHTML: true`; the walking-skeleton page must contain a deliberate `</span>⏎text` sequence and a dist test asserting it survives.

### Pitfall 4: `yaml` re-folds long lines on write
`Document.toString()` default `lineWidth` 80 re-wraps long quoted/plain scalars (probe: a 150-char `texte_source`). Always `{ lineWidth: 0 }`. See Pattern 5.

### Pitfall 5: Ajv strict-mode errors on idiomatic if/then
`strictRequired` ("required property "x" is not defined at …/then") and `strictTypes` ("missing type "object" for keyword "properties"") appear as soon as `then`/`else`/`$ref` siblings mention properties declared elsewhere. Fix in the schema, not in Ajv options (patterns in Pattern 1). Also: `["string","null"]` is accepted without `allowUnionTypes`.

### Pitfall 6: Opaque Ajv errors
`required`/`unevaluatedProperties` errors carry the parent `instancePath`; `if` errors are noise; `format` errors have no value echo. Without the mapping in Pattern 2 diagnostics point at line 1 or at the wrong key.

### Pitfall 7: GitHub annotation cap and escaping
Only 10 error annotations per step survive; unescaped `:`/`,` in `title`/`file` break the command; a `\n` in a message truncates it. Print all diagnostics as plain lines too.

### Pitfall 8: `astro dev` detaches when stdout is not a TTY
In a non-interactive shell `astro dev` printed `Dev server running at … (pid N) / Stop: astro dev stop` and returned (probe). Agents/executors that start it must stop it (`astro dev stop` or `kill <pid>`) and must not rely on it for verification; CI and tests use `astro build`.

### Pitfall 9: Stale docs contradict the new decisions
`README.md` says "Node 20+"; `docs/RUNBOOK.md` documents `src/content/mesures/<candidat>-<theme>-<slug>.yaml` (decision: `mesures/<candidat>/<slug>.yaml`); `docs/ARCHITECTURE.md` ADR-003 cites `scripts/validate.mjs` (now `scripts/validate.ts`, run via native TS) and describes JSON Schema "double garde". Fix as part of FOND-05.

### Pitfall 10: Empty `src/content` must build
Phase 1 ships no real content. `walk()` returns `[]` for missing dirs; every `getCollection` is empty; `npm run build` must still exit 0 (FOND-01). The walking-skeleton page renders the fixture only when `RTP_CONTENT_ROOT` points to it.

### Pitfall 11: Editor `$ref` resolution (LOW confidence)
`# yaml-language-server: $schema=…` headers may not resolve `urn:` `$ref`s across files in the VS Code YAML extension. Do not make editor support a deliverable; headers are optional comments and must not be relied on (and contain no informal text, D-13).

## Code Examples

### Native TS + test commands (verified Node 24.21.0)
```jsonc
// package.json (excerpt)
{
  "type": "module",
  "engines": { "node": ">=24.12" },
  "scripts": {
    "validate": "node scripts/validate.ts",
    "migrate": "node scripts/migrate.ts",
    "check": "astro check",
    "test": "TZ=Europe/Paris node --test \"tests/**/*.test.ts\"",
    "build": "astro build",
    "dev": "astro dev",
    "preview": "astro preview"
  }
}
```
`.npmrc`: `engine-strict=true`. `.nvmrc`: `24`. `tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "erasableSyntaxOnly": true, "noUncheckedIndexedAccess": true, "types": ["node"] },
  "include": [".astro/types.d.ts", "src/**/*", "scripts/**/*", "tests/**/*.ts"],
  "exclude": ["dist", "tests/fixtures"]
}
```
Rules for `.ts` run by Node: relative imports **with `.ts` extension**, `import type` for types (Astro's strict tsconfig already sets `allowImportingTsExtensions` and `verbatimModuleSyntax`), no `enum`/`namespace`/parameter properties. `astro sync` (run by `astro check`/`build`) generates `.astro/types.d.ts`; `.astro/` and `dist/` are already in `.gitignore`.

### Astro config
```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  compressHTML: true,
  prefetch: false,
  trailingSlash: 'always',
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  devToolbar: { enabled: false },
});
```
`output`, `compressHTML`, `prefetch`, `image.service.entrypoint` were run in the probe; `trailingSlash` and `devToolbar` are from project research / Astro docs and were not exercised (Assumption A6).

### Walking-skeleton page (verified in probe)
```astro
---
import { getCollection } from 'astro:content';
const candidats = (await getCollection('candidats')).sort((a, b) => a.data.nom_tri.localeCompare(b.data.nom_tri, 'fr'));
---
<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Corpus fictif</title></head>
<body><h1>Corpus fictif</h1>
<ul>{candidats.map((c) => <li>{c.data.prenom} {c.data.nom}</li>)}</ul>
<p><span>fin de</span>
test d'espaces</p></body></html>
```
Dist assertions: output contains `Marie Fictive`; no `<script`; no file ending `.js` under `dist/`; `</span>\ntest` present (compressHTML); no `http://`/`https://` `src`/`href` to third parties.

### Fixture inventory (`tests/fixtures/corpus-valide`, all verified to validate with 0 diagnostics and build)
`candidats/marie-fictive.yaml`, `themes/logement.yaml`, `sources/marie-fictive-programme.yaml`, `mesures/marie-fictive/encadrement-loyers.yaml` (`publie`, 4 rédactions), `couverture/logement.yaml`, `glossaire/loyer.yaml` (terme) and `glossaire/parti-imaginaire.yaml` (parti), `sondages/sondage-fictif-1.yaml`, `journal/20261103-001.yaml`, plus `archives/marie-fictive/<sha12>.txt` whose sha256 matches the source's `archive.sha256` (computed with `shasum -a 256`). Everything is visibly fictional (`exemple.invalid` hosts, "Parti Imaginaire", "PROGRAMME FICTIF" in the archive text). The sondage references a second fictional candidate id (`jean-imaginaire`) that has no file: Phase 2 integrity would flag it, so either add that candidate to the fixture or reference only `marie-fictive` plus a second candidate file.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node 20 default, `tsx` for TS scripts | Node 24, native type stripping (stable from 24.12) | 2026 | No `tsx`/`ts-node`; `erasableSyntaxOnly` |
| Astro `glob()`/`file()` + Zod schema | Object loader calling a shared validator, no Zod | Astro 5+ content layer | One parser/validator for CI and build |
| `compressHTML: true` default (≤6) | default `'jsx'` in Astro 7 | Astro 7.0 (2026-06-22) | Must set `true` explicitly |
| gitleaks `detect`/`protect` | `gitleaks git` / `gitleaks dir` | v8.19.0 | Use the new subcommands |
| `gitleaks-action@v2` (node20) | `@v3` (node24); Node 20 removed from runners 2026-09-16 | v3.0.0, 2026-05-30 | v2 no longer works |
| Dependabot no delay | `cooldown` (default 3 days for version updates) | 2025 | Set explicit values |

**Deprecated/outdated:** `actions/checkout@v4/v5`, `setup-node@v4` (node20 runtimes); legacy `src/content/config.ts`; Zod-as-schema-source for this project.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Relecture fields (`statut_relecture`, `relecteur`, `date_relecture`) live on each `statuts[]` entry, so the "partial date only in brouillon" rule has a hook (CONTEXT/DATA-02 don't say where) | Pattern 1 | If Erwan wants candidate-level review, a bump before freeze is cheap; after freeze it is a migration |
| A2 | `relu` also requires `relecteur` + `date_relecture` (DATA-03 only requires enfant/aîné for `publie`) | Pattern 1 | Slightly stricter than the spec; trivially loosened |
| A3 | `archive.wayback_url` optional (Wayback SPN can fail or be blocked by robots.txt); `archive.sha256` = hash of the committed `.txt` extract, optional `binaire_sha256` for the private binary | Pattern 1 | If DATA-04's "URL Wayback" must be mandatory, tighten now (free before data exists) |
| A4 | `sources.candidats[]` is required (not in DATA-04's list) so Phase 2 can validate author/endorsement and `mesure.candidat ∈ source.candidats` | Pattern 1 | If dropped, REGLE-01/07 need another way to link source to candidate |
| A5 | The `fingerprint` memo and "log once" refinements of the Astro loader work as written (probe used a simpler memo and showed duplicated log lines) | Pattern 4 | Duplicate log noise only; failure behavior is verified |
| A6 | `trailingSlash: 'always'` and `devToolbar: { enabled: false }` are accepted Astro 7 options with the expected effect | Code Examples | Config error at first build; trivial to fix |
| A7 | gitleaks default rules will not flag the 64-hex `sha256` values or fixture URLs; a `.gitleaks.toml` allowlist for `tests/fixtures/` is the fallback | Pattern 6 | False positive fails CI; allowlist is a one-file fix (gitleaks was not executed locally) |
| A8 | All six npm packages are legitimate (slopcheck unavailable) | Package Legitimacy Audit | Negligible (mainstream, high download counts, official repos) but the protocol requires a human checkpoint |
| A9 | Astro's `#validateReferences` only logs (does not fail) for bad references | Pitfall 2 | Read from source; the observed run still produced a `dist/` |
| A10 | A public/private split of `archives/` and `.txt` size cap are enforced by Phase 2/3 tooling, not by the Phase 1 schema | Pattern 1 | None for Phase 1 |

## Open Questions (RESOLVED)

1. **What does the default `npm run build` render in Phase 1?**
   - Known: `src/content/` is empty; the walking-skeleton page needs the fixture; FOND-01 requires `npm run build` to pass.
   - Unclear: whether the user expects a populated page from a plain `npm run build`.
   - Recommendation: keep `build` on the real (empty) corpus, add a `build:fixture` script (`RTP_CONTENT_ROOT=tests/fixtures/corpus-valide astro build`) and the dist tests that build the fixture to a temp `--outDir`. Say so in README.
   - RESOLVED: the default `npm run build` / `npm run validate` / `npm run migrate` root is the fixture, through `DEFAULT_CONTENT_ROOT = 'tests/fixtures/corpus-valide'` in `src/lib/content-core/root.ts`, overridable with `RTP_CONTENT_ROOT` (orchestrator decision, 2026-11-03). README documents it, CI also validates `RTP_CONTENT_ROOT=.`, and Phase 3 flips the default to `.` once real content exists. No `build:fixture` script.
2. **Is Erwan fine with per-`statuts[]` review fields (A1) and the stricter `relu` rule (A2)?** Raise at the plan checkpoint; both are one-line schema edits before data exists.
   - RESOLVED: A1-A4 are accepted as defaults by Erwan's delegate (the orchestrator, 2026-11-03). They are recorded in `schemas/CHANGELOG.md` (plan 01-05) and as ADRs in `docs/ARCHITECTURE.md` (plan 01-03).
3. **Page-level "last updated" (M1-12, Phase 4)** has no schema field: derive it from `date_relecture`/`verifie_le`/git metadata, or add an optional `modifie_le` later (optional additions need no bump). No action in Phase 1.
   - RESOLVED (deferred): M1-12 « dernière mise à jour » is designed in Phase 4 (derived from `date_relecture` / `verifie_le` / git metadata, or an optional field that needs no version bump). No Phase 1 action.
4. **Editor integration of URN `$ref`s (Pitfall 11)** unverified; decide in Phase 2 whether to ship a bundled schema for editors.
   - RESOLVED (deferred): editor integration of URN `$ref`s is not needed for v1.0. CI and `npm run validate` are the authority, and editor `$schema` headers are not a deliverable.
5. **`ids.lock` (REGLE-07)** is Phase 2, but the candidate id regexp `^[a-z][a-z0-9]*(-[a-z0-9]+)+$` requires at least two segments: mononyms would need a decision (none are expected among the 59).
   - RESOLVED (deferred): the mononym id regex question is handled in the Phase 3 import, when the real names exist; the schema is loosened then if needed (loosening = no version bump).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | all | ✓ binary / ✗ via fnm | 24.21.0 (`…/node-versions/v24.21.0/node-v24.21.0-darwin-arm64/bin`) | `fnm uninstall 24.21.0 && fnm install 24`; or prefix `PATH` |
| npm | install | ✓ | 11.19.0 (with Node 24); 10.9.9 with Node 22 | — |
| Node 22.23.3 (active default) | — | ✓ | refused by `engine-strict` (expected) | — |
| fnm | version switching | ✓ | 1.39.0 | direct `PATH` |
| git | repo | ✓ | 2.55.0 | — |
| gh CLI | SHA lookup, repo ops | ✓ (authenticated as ErwanHenry) | 2.76.2 | — |
| GitHub repo | CI | ✓ private, `main`, Actions enabled | — | — |
| `actionlint` / `zizmor` | workflow lint | ✗ | — | `yaml` parse only; optional local install |
| gitleaks (local) | pre-push check | ✗ (CI binary only) | — | optional `brew install gitleaks` |
| Playwright / Chromium | later phases | not needed in Phase 1 | — | — |

**Missing dependencies with no fallback:** none (Node 24 needs a one-time fnm repair).
**Missing with fallback:** fnm's Node 24 (see above); local gitleaks and workflow lint are optional.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (built into Node 24.21.0), TS executed natively |
| Config file | none (flags in the npm script) |
| Quick run command | `TZ=Europe/Paris node --test "tests/**/*.test.ts"` (probe: 3 tests in ~0.2 s) |
| Full suite command | `npm run migrate -- --check && npm run validate && npm run check && npm test && npm run build` |
| Per-file run | `node --test tests/schemas/candidat.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOND-01 | `.nvmrc`=24, `engines >=24.12`, `.npmrc engine-strict`, scripts `validate/test/build/migrate/check` exist; clean-clone sequence passes in CI | unit + CI | `node --test tests/repo/scaffold.test.ts`; CI job `verifier` | ❌ Wave 0 |
| FOND-02 | Astro config values (`output static`, `compressHTML true`, `prefetch false`, noop image service); fixture build has no `<script`, no `.js`, no third-party URL, `</span>⏎text` survives | unit + build | `node --test tests/repo/astro-config.test.ts tests/dist/skeleton.test.ts` | ❌ Wave 0 |
| FOND-03 | Parse `ci.yml`: every `uses:` is a 40-hex SHA (with `# vX` comment), workflow `permissions == {contents: read}`, `env.TZ == Europe/Paris`, triggers include `push` and `pull_request`, sequence includes migrate/validate/check/test/build | unit | `node --test tests/repo/ci.test.ts` | ❌ Wave 0 |
| FOND-04 | `ci.yml` has a gitleaks step with pinned version + sha256; `dependabot.yml` has `cooldown` for `npm` and `github-actions` | unit | `node --test tests/repo/ci.test.ts` | ❌ Wave 0 |
| FOND-05 | LICENSE contains MIT text + "Licence Ouverte 2.0" + `archives/` exclusion; `docs/ARCHITECTURE.md` has a heading per D-1…D-13; README no longer says "Node 20"; RUNBOOK uses `mesures/<candidat>/<slug>.yaml` | unit | `node --test tests/repo/docs.test.ts` | ❌ Wave 0 |
| DATA-01 | 8 schemas + common compile under strict Ajv; each has `$schema` 2020-12, URN `$id`, `version_schema.const` integer, root `unevaluatedProperties:false`, no property named `collection` | unit | `node --test tests/schemas/meta.test.ts` | ❌ Wave 0 |
| DATA-02 | Valid candidat passes; `renonce` without `motif` fails; `motif` on non-`renonce` fails; `2026-11` passes in brouillon, fails in `relu`; bad id; `photo` rejected; `parti` string without `parti_source` fails; `parti_source.type: presse` fails; `ordre_cc`, `ids_externes` accepted | table-driven unit | `node --test tests/schemas/candidat.test.ts` | ❌ Wave 0 |
| DATA-03 | Mesure brouillon without enfant/aîné passes; `publie` without them fails; `publie` without `relecteur/date_relecture` fails; unknown field fails | unit | `node --test tests/schemas/mesure.test.ts` | ❌ Wave 0 |
| DATA-04 | Source valid; `type: presse` fails; archive path traversal / bad sha / non-ISO `capture_le` fail; archive required | unit | `node --test tests/schemas/source.test.ts` | ❌ Wave 0 |
| DATA-05 | Couverture valid; `non_precise` without `sources_consultees` fails; bad `etat` fails | unit | `node --test tests/schemas/couverture.test.ts` | ❌ Wave 0 |
| DATA-06 | Terme valid; parti without source fails; parti with `source.type: institution` fails; definition > 300 chars fails | unit | `node --test tests/schemas/glossaire.test.ts` | ❌ Wave 0 |
| DATA-01..06 (corpus) | `corpus-valide` yields 0 diagnostics and ≥1 entry in each of the 8 collections; a diagnostic carries file, line, col, code | integration | `node --test tests/content-core/corpus-valide.test.ts` | ❌ Wave 0 |
| DATA-07 | Unquoted date stays a string; `!!timestamp` rejected; duplicate key → `YAML_DUPLICATE_KEY` with line; multi-doc; alias refused; empty file; unknown tag (warning) is an error; **parity**: Astro loader `load()` with a stub store yields the same ids/data as `loadAll`; `astro build` on fixture exits 0 and on a broken copy exits ≠ 0 with `file:line CODE` in output | unit + integration (spawn) | `node --test tests/content-core/load.test.ts tests/content-core/astro-parity.test.ts` | ❌ Wave 0 |
| DATA-08 | Migration unit tests (comments, long line, idempotence, missing link, future version); `migrate --check` on a `version_schema: 0` copy exits 1 with `MIGRATION_EN_RETARD`; on `corpus-valide` exits 0 | unit + CLI | `node --test tests/migrations/*.test.ts` | ❌ Wave 0 (unit prototype passed 3/3) |
| (diagnostics) | `--format github` escapes `% \r \n : ,` and caps annotations at 10 | unit | `node --test tests/content-core/diagnostics.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test` on the touched area (< 5 s) plus `npm run validate -- --root tests/fixtures/corpus-valide`.
- **Per wave merge:** full `npm test` (includes the spawn-based Astro build tests, ~10 s) + `npm run check`.
- **Phase gate:** the full suite command above green, and the GitHub Actions run green on the pushed branch, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `astro.config.mjs`, `package-lock.json`: framework install (`npm install`) after the fnm repair
- [ ] `tests/fixtures/corpus-valide/**` (9 files + 1 archive), the shared fixture for most tests
- [ ] `tests/helpers/validate-yaml.ts`: table-driven helper `expectOk(schema, yamlText)` / `expectErrors(schema, yamlText, [{code, pointer}])` (the probe's `v()` helper)
- [ ] test files listed in the table above

## Security Domain

`security_enforcement` is not set to false in config, so this section applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts, no auth in v1 |
| V3 Session Management | no | no sessions, no cookies |
| V4 Access Control | no (repo-level only) | GitHub branch protection (RUNBOOK), least-privilege `GITHUB_TOKEN` (`contents: read`) |
| V5 Input Validation | **yes** | JSON Schema (Ajv strict, `unevaluatedProperties:false`), `schema:'core'` YAML, aliases/tags refused, `https-url` format, archive-path pattern forbidding traversal |
| V6 Cryptography | partly | `node:crypto` sha256 for archive integrity; never hand-rolled |
| V14 Config / supply chain | **yes** | actions pinned by SHA, Dependabot cooldown, lockfile + `npm ci`, no install scripts, gitleaks, `persist-credentials: false`, `ASTRO_TELEMETRY_DISABLED` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `archive.extrait` | Tampering | Pattern forbids dots in directory segments; Phase 2 resolves under `archives/` and checks `startsWith` |
| YAML alias bomb / custom tag execution | DoS / Tampering | `maxAliasCount: 0`; core schema; unknown tags = errors |
| Malicious `javascript:`/`http:` URLs in content | Spoofing / XSS | `https-url` format; Astro escapes text |
| Compromised action tag | Tampering | SHA pinning + Dependabot with cooldown (new releases wait 7 days) |
| Secrets in history | Info disclosure | gitleaks `git` on full history, `.env` in `.gitignore`; convention from commit 1 (D-13) |
| Typosquatted dependency | Tampering | Six mainstream packages, human checkpoint before first install, lockfile |
| Third-party resource / telemetry leak | Info disclosure | Astro telemetry off in CI; dist test for third-party URLs |

## Project Constraints (from CLAUDE.md)

Project `./CLAUDE.md` (GSD-generated) and the user's global `~/.claude/CLAUDE.md`:
- Astro static, zero JS by default, no server framework; data in YAML/JSON in Git validated by JSON Schema in CI; no database.
- Neutrality, primary sources, equity, privacy (no cookie, no third-party script/resource), **every added dependency justified in writing in the PR** (reuse the one-line justifications in `.planning/research/STACK.md`), no secrets in the repo (GitHub Secrets + Vaultwarden), images only from Commons with verified licence or none (D-12: none).
- Node 24 LTS is an accepted exception to the user's Node 20 default (D-5): record it in an ADR.
- GSD workflow: make file edits through a GSD command (`/gsd-execute-phase` for planned work, `/gsd-quick` for small fixes); no direct edits outside GSD unless the user bypasses it.
- User global rules: docs in French; code on remote Git within the first hour (repo already on GitHub, private); `.env` in `.gitignore`; README answers 5 questions (project / for whom / stack / local launch / where the secrets are); `ARCHITECTURE.md` with a Mermaid diagram + short ADRs; `RUNBOOK.md` (logs, restart, restore); JSON structured logs, Uptime Kuma/Healthchecks and Telegram alerting (N/A for a static build, but note in RUNBOOK that monitoring begins with lot 3); reproducible deployment; monthly hygiene review in `RETROSPECTIVE.md`; commits end with the `Co-Authored-By` trailer given by the harness; define a measurable success criterion, an observable failure signal and a corrective action for any non-trivial task; dogfood (apply the hygiene rules to the scaffold itself).
- Token economy: read files with `limit`/`offset`, delegate large scaffolds to sub-agents.

## Documentation deliverables (FOND-05) - what exactly to write

- **LICENSE** (single file): sections (1) code: MIT, copyright "Erwan Henry"; (2) editorial content (`src/content/**` authored by the project, `docs/`): Licence Ouverte 2.0 (Etalab, SPDX `Etalab-2.0`; official text https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf, data.gouv.fr/pages/legal/licences/etalab-2.0) [CITED: search results]; (3) exclusions: `archives/` and quoted/candidate texts: « droits réservés à leurs auteurs, reproduits à titre de preuve et de citation »; (4) the data.gouv "statuts sourcés" dataset keeps its own Licence Ouverte 2.0 and attribution (Phase 3 detail). `package.json` `"license": "MIT"`.
- **docs/ARCHITECTURE.md**: update the Mermaid diagram (content-core box shared by `validate` and the Astro loader) and keep ADR-001 to ADR-003 (rewrite ADR-003: JSON Schema is the single source of truth, Ajv inside the Astro loader, `.ts` scripts). Add ADR-004…ADR-016 for D-1…D-13 **in D order, each titled "ADR-0NN (D-n): …"**, with a table at the top mapping D-n → ADR number, each with Contexte / Décision / Conséquence in the existing style. Add ADRs for the technical decisions made here (parse options; Ajv strict + `unevaluatedProperties`; Astro loader without schema; archive `sha256` semantics; URN `$id`s; `compressHTML: true`).
- **README.md**: Node 24 (`fnm use`), the five questions, FOND-01 command sequence, `RTP_CONTENT_ROOT`, canonical YAML style.
- **docs/RUNBOOK.md**: fix the mesure path, add `npm run migrate`, how to read a diagnostic, monthly: bump the gitleaks pin, right-of-reply placeholder (D-4), "Node 24 repair" note.

## Sources

### Primary (HIGH confidence)
- Probe project (Node 24.21.0, astro 7.4.5, ajv 8.20.0, yaml 2.9.1, @astrojs/check 0.9.12, typescript 6.0.3): all Ajv, YAML, loader, build-failure, `compressHTML`, `astro check`, `node --test` results above
- `astro@7.4.5` package source: `dist/content/content-layer.js` (schema lookup, `#validateReferences`, `loader.load` call), `dist/content/utils.js` (`getEntryData` passthrough), `dist/content/watcher.js`
- https://docs.astro.build/en/reference/content-loader-reference/ (object loader API, store, context)
- `gh api` (GitHub): tags/SHAs for checkout, setup-node, upload-artifact, gitleaks, gitleaks-action; action.yml of setup-node/checkout; repo settings; release notes of gitleaks-action v3
- https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference (cooldown, schedule, open-pull-requests-limit)
- https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions (annotation syntax) and actions/toolkit `packages/core/src/command.ts` (escaping)
- gitleaks README (commands, flags, action licensing) via `gh api`
- npm registry (`npm view`, download API)

### Secondary (MEDIUM confidence)
- Annotation caps (10 per level per step, 50 per job): GitHub REST check-runs docs plus community discussions (actions/toolkit problem-matchers docs, community #26680)
- Licence Ouverte 2.0 text locations and CC-BY compatibility: web search (etalab.gouv.fr PDF, data.gouv.fr legal page, github.com/etalab/licence-ouverte)

### Tertiary (LOW confidence)
- Editor handling of `urn:` `$ref`s in yaml-language-server (not tested)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, versions from the registry today, installed and executed together
- Architecture (schemas, content-core, loader, migrations): HIGH, prototyped end to end; residual risk is limited to Assumptions A1-A4 (modelling choices awaiting a human nod) and A5-A7 (small unexercised refinements)
- Pitfalls: HIGH for 1-6 and 8-10 (reproduced), MEDIUM for 7 (caps from docs and reports), LOW for 11

**Research date:** 2026-11-03
**Valid until:** 2026-11-17 for action SHAs and package versions (fast-moving: re-run `gh api` before pinning if the plan executes later); schema/loader findings stable for the Astro 7.4.x line.
