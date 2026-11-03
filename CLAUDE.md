<!-- GSD:project-start source:PROJECT.md -->
## Project

**reveleTonProg**

Site statique pédagogique, neutre et sourcé, qui aide tout public à comprendre les programmes des candidats à l'élection présidentielle française des 18 avril et 2 mai 2027. Chaque mesure existe en quatre niveaux de lecture (résumé, détaillé, enfant, aîné) et renvoie à une source primaire datée et archivée. Les sondages (milestone suivant) sont présentés avec leur marge d'erreur, jamais comme un résultat.

Cahier des charges complet : `docs/spec/CAHIER-DES-CHARGES.md` (source : Claude Doc https://claude.ai/artifact/1FiDU6ykyLw8KTPwf5FUFz).

**Core Value:** Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient — chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.

### Constraints

- **Tech stack** : Astro statique, zéro JS par défaut, pas de framework serveur — imposé par la spec
- **Données** : YAML/JSON dans Git, validés par JSON Schema en CI — pas de BDD
- **Neutralité** : mots interdits (« extrême », « populiste », « irresponsable », « courageux », « enfin »), étiquette revendiquée par le candidat, chiffrage du candidat seulement
- **Sourçage** : source primaire (jamais presse) + date de consultation + copie archivée dans le dépôt
- **Équité** : même niveau de détail pour tous les candidats déclarés sur un thème publié
- **Vie privée** : aucun cookie tiers, aucune donnée personnelle, aucun script externe
- **Dépendances** : chaque dépendance ajoutée justifiée par écrit dans la PR
- **Secrets** : aucun dans le dépôt ; GitHub Secrets + Vaultwarden
- **Images** : uniquement Wikimedia Commons licence vérifiée, ou aucune
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version (verified 2026-11-03) | Purpose | Why Recommended | PR justification (1 line) | Confidence |
|---|---|---|---|---|---|
| **Node.js** | **24 LTS "Krypton"** (latest 24.22.2; floor `>=24.12.0`) | Runtime for build, validator, tests, CI | Node 20 has been EOL since 2026-04-30. Node 22 goes EOL on **2027-04-30**, 12 days after round 1 and before round 2, so do not use it. Node 24 is supported until 2028-04-30, covers the whole campaign, and from 24.12 has **stable TypeScript type stripping** (`node scripts/validate.ts` runs with no tsx/ts-node). Node 26 became LTS on 2026-10-28; it is too fresh to bet a campaign on, so revisit after the election. | n/a (runtime) | HIGH |
| **astro** | **^7.4.5** | Static site generator, content collections | Imposed by the spec. Zero JS by default, `output: 'static'`, content layer with `glob()`/`file()` loaders for YAML, `reference()` across collections. Astro 7 (2026-06-22) adds the Rust compiler and Vite 8/Rolldown. It requires Node `>=22.23.4`, which Node 24 satisfies. | "Générateur imposé par le cahier des charges §8 ; sortie 100 % statique, zéro JS par défaut." | HIGH |
| **ajv** | **^8.20.0** (import `ajv/dist/2020.js`) | JSON Schema draft 2020-12 validation of every YAML file | De facto standard. It supports 2020-12 in full, including `if/then` (needed for "enfant/aîné required when `statut: publie`"), `unevaluatedProperties`, cross-file `$ref` via `$id` + `addSchema`, `allErrors`, and strict mode, which rejects typos in the schemas themselves. It has 4 tiny transitive deps. | "Validation JSON Schema 2020-12 exigée par §7 ; standard de fait, supporte if/then pour la règle brouillon→publié." | HIGH |
| **yaml** (eemeli) | **^2.9.1** | YAML parsing in the validator, with line/column positions | **Astro already ships it**: `@astrojs/internal-helpers@0.13.0` depends on `yaml@^2.9.1`, and Astro's `file()` loader calls `parseDocument(src, { schema: "core", customTags: ["timestamp"], merge: true })`. Declaring it directly adds **0 bytes** to `node_modules` and guarantees CI parses exactly like the build. `parseDocument` + `LineCounter` give line numbers for CI error annotations. YAML 1.2 core schema avoids the YAML 1.1 "Norway problem" (`no` read as `false`). | "Déjà présent en transitif via Astro (même version) ; déclaré pour que la CI parse le YAML exactement comme le build et donne les numéros de ligne." | HIGH |
### Supporting Libraries (dev only)
| Library | Version | Purpose | When to Use | PR justification (1 line) | Confidence |
|---|---|---|---|---|---|
| **@playwright/test** | **^1.64.1** | E2E tests on the built site: **no-JS mode** (`test.use({ javaScriptEnabled: false })`), level toggle, keyboard path, localStorage enhancement, page weight from real network responses, **4G simulation** through a CDP session (`Network.emulateNetworkConditions`, Chromium only) | Lot 2 onward. Install Chromium only in CI (`npx playwright install --with-deps chromium`). It also gives Lot 1 a source-archiving tool (`page.pdf()`, MHTML via CDP) with no extra dep. | "Un seul outil couvre 4 exigences testées du §10/§12 : fonctionnement sans JS, clavier, poids de page, 4G simulée." | HIGH (APIs verified in v1.64.1 docs). CDP throttling: MEDIUM (stable CDP method, Chromium only) |
| **@axe-core/playwright** | **^4.14.0** (bundles `axe-core ~4.14.0`) | Automated WCAG audit inside the Playwright suite: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()`; fail on any violation | Lot 2 onward, on every generated page (iterate over the `dist/` HTML list) | "Audit AA automatisé (§10, §12 « 0 erreur bloquante ») qui réutilise le Chromium de Playwright, sans second navigateur." | HIGH |
| **@astrojs/check** | **^0.9.12** | `astro check`: type-checks `.astro` files and `content.config.ts` | CI step before build | "Vérification de types des composants .astro ; outil officiel Astro." | HIGH |
| **typescript** | **^6.0.3** (**not 7.x**) | Peer of `@astrojs/check` | Always alongside `@astrojs/check` | "Pair obligatoire d'@astrojs/check (peer `^5 \|\| ^6`)." | HIGH (peer range verified: `typescript: ^5.0.0 \|\| ^6.0.0`) |
| **@types/node** | **^24.19.2** | Types for `node:test`, `node:fs`, etc. in `scripts/*.ts` | Always | "Types Node 24 pour les scripts de validation exécutés en TypeScript natif." | HIGH |
### Built with stdlib (no dependency)
| Need | Native tool | Notes | Confidence |
|---|---|---|---|
| Unit tests for editorial rules and data traps (§12) | **`node:test`** + `node:assert` | Stable since Node 20. Snapshots stable since 23.4 (`t.assert.snapshot`, `--test-update-snapshots`). Runs `.ts` files natively on Node 24. Coverage is still experimental (`--experimental-test-coverage`), which is acceptable here. | HIGH |
| Custom JSON Schema formats | `ajv.addFormat()` + **`URL.canParse`** + regex/`Date.UTC` round-trip | Only 3 formats are needed: `date` (YYYY-MM-DD, real calendar date), `date-time`, and a custom **`https-url`** (stricter than RFC `uri`: rejects `http:`, `javascript:`, relative URLs). About 20 lines. | HIGH |
| Word counts (25 / 80-200 / 40-60 / 60-120 words) and forbidden words | **`Intl.Segmenter('fr', { granularity: 'word' })`** + `String.prototype.normalize('NFC')` + `toLocaleLowerCase('fr')` | ICU word segmentation is native in Node (ICU 78 here). **It needs a thin French normalization layer** (see the section below). | HIGH (tested locally) |
| Sentence segmentation (readability) | `Intl.Segmenter('fr', { granularity: 'sentence' })` + abbreviation list | Splits after "M." in "M. Dupont" (verified), so a small abbreviation merge list is needed (M., Mme, Dr, etc., p. ex.) | HIGH (tested) |
| French readability (Kandel-Moles) | Own implementation, about 60 lines | No credible npm package exists (see the Readability section) | MEDIUM |
| Page weight budget | `node:fs` + **`node:zlib`** (`gzipSync`) over `dist/` | Deterministic, server-free, and fast (see the Page weight section) | HIGH |
| Source archive integrity | `node:crypto` (SHA-256) | Store `sha256` of the archived file in the measure YAML; CI checks file exists + hash matches | HIGH |
| Static server for E2E | `astro preview` (built in) or a ~40-line `node:http` + `node:zlib` server | `astro preview` does **not** compress. The 4G timing test needs gzip to mirror Caddy (see the Page weight section). | MEDIUM |
| CI annotations | GitHub workflow commands printed to stdout: `::error file=…,line=…::message` | Line numbers come from `yaml` `LineCounter` + Ajv `instancePath` | HIGH |
| Client-side progressive enhancement (localStorage, random order) | One `<script>` in an Astro component, plain JS, under 2 KB | No framework, no island needed for M1 | HIGH |
| Styling | Plain CSS with custom properties + Astro scoped `<style>`; radio inputs + `:checked ~` / `:has()` for the level toggle | No Tailwind or UnoCSS: an extra build dep with no benefit at this scale | HIGH |
| Fonts | System font stack (0 KB) | Optional, for Aîné/Enfant: self-host **Luciole** (designed for low-vision readers, French origin; license reported as CC BY 4.0, verify before adding), WOFF2, 2 weights max, `font-display: swap` | MEDIUM (Luciole license not re-verified) |
## French text normalization on top of `Intl.Segmenter` (verified locally)
| Input | Segmenter output | Rule to apply in `scripts/lib/text.ts` |
|---|---|---|
| `l’école`, `c’est` | **1 word** (apostrophe is UAX#29 MidNumLet) | Split French elisions (`l’ d’ j’ n’ s’ c’ qu’ m’ t’`, both `'` and `’`) to count words the French way. Keep `aujourd’hui` and `presqu’île` whole (exception list). |
| `1 500 000` (spaces / NBSP / NNBSP) | **3 words** | Merge digit groups separated by U+0020/U+00A0/U+202F before counting |
| `3,5` | 1 word | OK |
| `c’est-à-dire` | `c’est` + `à` + `dire` | Decide and document (count 3 is acceptable) |
| `M. Dupont` | sentence break after `M.` | Abbreviation merge list for sentence counts |
| `Enfin`, `extrêmement`, `populistes` | separate words | Forbidden words: match on **lemma prefixes** after NFC + `toLocaleLowerCase('fr')`: `extrêm*` (catches extrême/extrêmes/extrêmement), `populis*`, `irresponsab*`, `courage*` (courageux/courageuse/courageusement), `enfin` exact. Keep the list in a versioned YAML (`regles/mots-interdits.yaml`) so the Méthode page can show it. Mind false positives (e.g. a candidate's **quoted** program text in the `texte source cité` field): apply the rule to the 4 rédactions + titre, **not** to the verbatim citation. |
## Readability scoring (Flesch adapted to French)
- **Formula (verified, MEDIUM-HIGH):** `L = 207 − 1.015 × (words / sentences) − 73.6 × (syllables / words)` (Kandel & Moles, 1958, *Cahiers d'études de radio-télévision*). Python's `textstat` uses the same constants for `fr` (`fre_base: 207, fre_sentence_length: 1.015, fre_syll_per_word: 73.6`), and several French sources agree.
- **npm landscape (verified by search):** `flesch`, `flesch-kincaid`, `text-readability`, `readability-scores` and `textlens` are all English-centric (English syllable counting). Nothing maintained implements French syllabification plus Kandel-Moles. A wrapper would add a dependency whose only correct part is a 1-line formula.
- **Syllable counting:** a heuristic French counter (about 30 lines). Count vowel groups `[aeiouyàâäéèêëîïôöùûüÿæœ]+`; treat `qu`/`gu` + vowel as a consonant; drop a final mute `-e`/`-es` on polysyllables; keep `-ent` as is (verb ambiguity, document it). **Calibrate once** against Python `textstat` (which uses pyphen French hyphenation) on 30 sample sentences, run locally with no project dependency, and freeze the results as `node:test` fixtures. Fallback if the heuristic drifts too far: `hyphen@1.14.1` (French patterns, the same approach as textstat). That is one dev dependency and needs its own justification.
- **Threshold for "CM1 or easier" (LOW confidence):** Flesch's original scale bottoms out at "90-100 = very easy = US 5th grade (≈ CM2)", and CM1 ≈ US 4th grade. A defensible starting gate is **Kandel-Moles ≥ 80 as a warning for `brouillon` and a block for `publie`**, plus a **hard rule: no sentence over 15 words in `enfant`**. The sentence rule is more actionable for writers than a global score. **Calibrate** on a CC BY-SA corpus written for 8-13 year olds (Vikidia articles), set the gate near its 25th percentile, and publish formula + threshold on the Méthode page (neutrality = transparent method).
- Optional cross-check: **LIX** (no syllables: `words/sentences + 100 × long_words(>6 letters)/words`) is language-independent and cheap. Report it alongside but do not gate on it.
## JSON Schema + Astro content layer: how they fit (single source of truth)
## Page weight and the "< 1 s on 4G" target
## GitHub Actions
| Action | Version (latest release, verified) | Notes |
|---|---|---|
| `actions/checkout` | **v7** (7.0.1, 2026-07-20) | `persist-credentials: false` |
| `actions/setup-node` | **v7** (7.1.0, 2026-10-08) | `node-version-file: .nvmrc` (contains `24`), `cache: npm` |
| `actions/cache` | v6 (6.1.0) | Cache `~/.cache/ms-playwright` keyed on the Playwright version |
| `actions/upload-artifact` | v7 (7.0.2) | Upload `dist/` + Playwright report on failure (the Lot 2 "URL de test" preview can come from this artifact until Lot 3) |
## Installation
# Prereq: Node 24 LTS (local machine currently has v22.23.3, below astro 7.4.5's floor >=22.23.4, so upgrade)
# Runtime (yaml is already a transitive dep of astro; declared for parse parity)
# Dev
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `node:test` | **vitest@5.1.0** | Only if we adopt Astro's Container API to unit-test `.astro` components in isolation (its documented path is via Vitest's `getViteConfig`). For M1, testing the **built HTML** with Playwright is closer to what users get, so skip it. |
| Own `addFormat` (3 formats) | **ajv-formats@3.0.1** | If the schemas start needing many RFC formats (email, ipv4…). It is maintained by the Ajv org, but its last publish was 2024-03 and it would cover 3 formats we can write more strictly ourselves. |
| `@axe-core/playwright` | **pa11y-ci@5.0.0** | If a non-developer wants a zero-code URL-list config. It pulls **puppeteer@^25** (a second Chromium download), lodash, cheerio and node-fetch, and runs the same axe engine underneath. |
| Shared loader + Ajv | Zod as source of truth + `z.toJSONSchema()` export | If the spec dropped "JSON Schema validated in CI". Zod refinements (`superRefine` for the brouillon→publié rule) do not export to JSON Schema, so the exported schema would be weaker than the real rule. |
| Own Kandel-Moles | `hyphen@1.14.1` for syllables | If the heuristic counter disagrees with the textstat calibration by more than ~5 % on the fixture set |
| Node 24 LTS | Node 26 LTS | After the 2027 election, or if a dependency drops 24 (none does today: Astro `>=22.23.4`, Playwright `>=20`, axe `>=22.12`) |
| npm | pnpm | Not worth an extra tool for one package. npm 11 ships with Node 24. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| **Node 20** (Erwan's default stack) and **Node 22** | 20 is EOL (2026-04-30). 22 goes EOL on 2027-04-30, mid-campaign, between the two rounds. | Node 24 LTS |
| **typescript@7.x** | `@astrojs/check@0.9.12` peer range is `^5 \|\| ^6`, so npm will error or warn | `typescript@^6.0.3` |
| **`z.fromJSONSchema()`** | Experimental; throws on `if/then`, external `$ref`, `unevaluatedProperties` | Shared Ajv loader + thin Zod mirror with drift test |
| **ajv-cli@5.0.0** | Last published 2023-04, can't run our editorial rules, poor YAML line reporting | `scripts/validate.ts` (Ajv as a library) |
| **js-yaml@5.x** | A second YAML parser with subtly different semantics from the one Astro uses | `yaml@^2.9.1` (same as Astro) |
| **Lighthouse CI / lighthouse** | Heavy (puppeteer-core, Sentry…), non-deterministic scores, a duplicate browser | `check-weight.ts` + Playwright CDP 4G test |
| **pa11y / pa11y-ci** | Bundles puppeteer + a second Chromium | `@axe-core/playwright` |
| **Tailwind / UnoCSS / any UI framework (React, Svelte, Preact)** | Adds build deps and, for frameworks, client JS. M1 must work without JS. | Plain CSS + Astro components; one vanilla `<script>` for enhancement |
| **English readability libs** (`flesch`, `text-readability`, `readability-scores`, `textlens`) | English syllable rules give wrong counts for French | Own Kandel-Moles + French syllable heuristic |
| **Any analytics, CDN-hosted font, or external script** | Forbidden by §5 (no third-party scripts or cookies) | Caddy anonymized logs; self-hosted assets only |
| **`astro:content`'s `z` / `astro:schema`** | Deprecated since Astro 6 | `import { z } from 'astro/zod'` |
| **`src/content/config.ts`, `type: 'data'`** | Legacy collections removed in Astro 6 | `src/content.config.ts` with explicit `loader` |
## Stack Patterns by Variant
- Give the custom object loader incremental support (`store.has` + digest via `generateDigest`) so dev reloads stay fast
- Because the inline/object loader reparses everything on start, which is fine at the pilot's scale (3 themes)
- Keep them in the repo (spec §5) but enforce a CI size cap per file (e.g. 5 MB) and dedupe by SHA-256. Consider Git LFS only if the repo passes ~1 GB. The VPS disk is at 90 %, but the VPS only receives `dist/`, not archives.
- Split the "Détaillé" level into the candidate×theme page and keep Résumé/Enfant/Aîné on the theme page, rather than adding JS lazy-loading (no-JS must keep working)
## Version Compatibility
| Package A | Compatible With | Notes |
|---|---|---|
| astro@7.4.5 | Node `>=22.23.4` | Verified `engines`. Node 24.x satisfies it. Local v22.23.3 does **not**. |
| astro@7.4.5 | zod `^4.6.6` (bundled, via `astro/zod`) | Do not install zod separately |
| astro@7.4.5 | yaml `^2.9.1` (via @astrojs/internal-helpers@0.13.0) | Pin the same caret range so npm dedupes |
| @astrojs/check@0.9.12 | typescript `^5 \|\| ^6` | Not TS 7 |
| @axe-core/playwright@4.14.0 | axe-core `~4.14.0`, playwright-core `>=1.0.0` (peer) | Peer satisfied by @playwright/test@1.64.1 |
| @playwright/test@1.64.1 | Node `>=20` | Chromium only needed (CDP throttling is Chromium-only) |
| ajv@8.20.0 | — | Deps: fast-deep-equal, fast-uri, json-schema-traverse, require-from-string |
| actions/setup-node@v7 | `.nvmrc` = `24` | `package-manager-cache` defaults on when `packageManager` is set in package.json |
## Sources
- npm registry (`npm view`, 2026-11-03): versions, engines, dependency trees for astro 7.4.5, ajv 8.20.0, ajv-formats 3.0.1, ajv-cli 5.0.0, yaml 2.9.1, vitest 5.1.0, pa11y-ci 5.0.0, axe-core / @axe-core/playwright 4.14.0, @playwright/test 1.64.1, @astrojs/check 0.9.12, typescript 7.0.2/6.0.3, lighthouse 13.6.0, @lhci/cli 0.16.0, zod 4.6.7, hyphen 1.14.1 — HIGH
- Package source inspection: `astro@7.4.5/dist/content/loaders/file.js` → `@astrojs/internal-helpers/yaml` (`parseDocument`, `schema: "core"`, `customTags: ["timestamp"]`); `zod@4.6.7/v4/classic/from-json-schema.js` (unsupported keywords throw); `@paulirish/trace_engine@0.0.67` Lantern `Constants.js` (Slow 4G = 150 ms / 1.6 Mbps / CPU ×4) — HIGH
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json + https://nodejs.org/dist/index.json — Node EOL dates, current LTS lines — HIGH
- https://nodejs.org/docs/latest-v24.x/api/typescript.html — type stripping stable in v24.12.0 — HIGH
- https://nodejs.org/docs/latest-v24.x/api/test.html — node:test stable, snapshots stable (v23.4), coverage experimental — HIGH
- https://docs.astro.build/en/guides/content-collections/ and /en/reference/content-loader-reference/ — `src/content.config.ts`, `glob()`/`file()` YAML support, `astro/zod`, `reference()` — HIGH
- https://docs.astro.build/en/guides/upgrade-to/v6/ — legacy collections removed, Zod 4, Node 22.12 floor — HIGH
- https://docs.astro.build/en/guides/upgrade-to/v7/ and https://astro.build/blog/astro-7/ — `compressHTML` default `'jsx'`, stricter HTML compiler — HIGH
- Context7 `/microsoft/playwright/v1.64.1` — `javaScriptEnabled: false`, `webServer` config — HIGH
- Context7 `/dequelabs/axe-core-npm` — `AxeBuilder.withTags()` — HIGH
- Context7 `/ajv-validator/ajv` — `addFormat`, `allErrors` — HIGH
- https://zod.dev/json-schema — `fromJSONSchema` marked experimental — HIGH
- textstat `constants.py` (GitHub) — French Flesch constants 207 / 1.015 / 73.6 — MEDIUM-HIGH
- https://www.force-interactive.com/score-lisibilite-texte/, https://github.com/dreadmoreeee/readability-check, https://annebeckers.com/lisible-ou-comprehensible-le-point-sur-les-formules-de-lisibilite/, https://arxiv.org/pdf/2208.12924 — Kandel-Moles formula and its limits — MEDIUM
- GitHub API `repos/actions/*/releases/latest` — checkout v7.0.1, setup-node v7.1.0, cache v6.1.0, upload-artifact v7.0.2 — HIGH
- Local experiment (Node 22.23.3, ICU 78.3): `Intl.Segmenter('fr')` behavior on elisions, spaced numbers, "M." — HIGH
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
