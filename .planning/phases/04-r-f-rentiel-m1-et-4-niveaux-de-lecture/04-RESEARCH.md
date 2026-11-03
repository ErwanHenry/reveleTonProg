# Phase 4: Référentiel M1 et 4 niveaux de lecture - Research

**Researched:** 2026-11-03
**Domain:** Static Astro 7 pages (theme + candidate), no-JS 4-level reader (radios + `:has()`), progressive enhancement (localStorage, shuffle), Popover API glossary, RTP_MODE preview/production filtering, post-build gate (`check-dist`)
**Confidence:** HIGH for everything marked "prototype" (built and run against Astro 7.4.5 + Chrome 156 in `/tmp/rtp-proto`, repo untouched). MEDIUM for screen-reader behaviour (Chrome accessibility tree verified; VoiceOver/NVDA/JAWS not testable here). LOW only where flagged `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Héritées (verrouillées)**
- Zéro JS requis pour lire ; scripts classiques same-origin < 2 Ko (`niveau.js`, `ordre.js`) ; aucune ressource tierce ; `compressHTML: true`
- Les pages itèrent sur les candidats, jamais sur les mesures ; `getCorpus()` seul lit `RTP_MODE` ; collation `Intl.Collator('fr')` sur `nom_tri`
- Cartes de taille fixe (première mesure + « N autres mesures »), ligne de couverture, section repliée « Ne se présentent pas » (`renonce`), pictogramme neutre identique, pas de photos
- États vides typés et datés : « Non précisé dans les sources consultées le … », « Programme non publié à ce jour » ; gris neutre, jamais rouge
- Source primaire toujours visible sous chaque mesure + lien « signaler une erreur » (mailto + issue GitHub, id pré-rempli)
- localStorage : seulement `rtp:niveau` et `rtp:ordre` (exemption CNIL personnalisation)
- Budget : ≤ 500 Ko bruts et ≤ 100 Ko gzip par page

**Choix visuels acceptés par Erwan (2026-11-03)**
- Polices système (pile sans-serif système), aucun téléchargement de police
- Libellés des niveaux : « En bref » (résumé), « En détail » (détaillé), « Pour les enfants » (enfant), « Gros caractères » (aîné) ; les codes internes restent résumé/détaillé/enfant/aîné
- Une couleur dominante par thème (palette contrastée AA, fond neutre) ; jamais de couleur associée à un candidat ou un parti
- Interface en français, vouvoiement neutre

**Contact (Erwan 2026-11-03)**
- Adresse publique dans `config/site.yml` (`contact: contact@domaine-a-definir.invalid` placeholder), remplacée au lot 3 quand le domaine est acheté ; aucune adresse personnelle publiée ; lien « signaler une erreur » = mailto vers cette valeur + issue GitHub

### Claude's Discretion
- Palette exacte, espacements, structure des composants, URL (`/themes/<id>/`, `/candidats/<id>/` recommandé)

### Deferred Ideas (OUT OF SCOPE)
- Feuille de style impression (DIFF-02) si temps
- Ordre du Conseil constitutionnel (lot 7)

Hors périmètre de phase : pages Méthode/Mentions/Qui sommes-nous et suite Playwright/axe complète (Phase 5). Construit d'abord sur la fixture `corpus-valide`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| M1-01 | Page thème : tous les candidats du périmètre, mesures ou état vide typé daté | §Architecture (cellule state machine), §Code Examples (view-model), §Open Q1-Q2 |
| M1-02 | Page candidat (59) : mesures par thème, statut texte+date+source, parti revendiqué | §Architecture (routes), §Open Q1 (statut display policy) |
| M1-03 | Liens croisés thème ↔ candidat | §Architecture (index pages `/themes/`, `/candidats/`), `check-dist` internal-link rule |
| M1-04 | Source primaire + lien « signaler une erreur » par mesure | §Code Examples (source block, mailto/issue builders), §Open Q4 (archived-copy link) |
| M1-05 | Bascule 4 niveaux sans JS, un seul niveau lu par les lecteurs d'écran | §Standard Stack (toggle), prototype evidence P1, §Code Examples |
| M1-06 | Niveau mémorisé, restauré sans flash | `niveau.js` + frame-recording evidence P2, bfcache P3 |
| M1-07 | Ordre alphabétique / aléatoire (JS), explication sans JS | `ordre.js` + evidence P4, chi² unit test |
| M1-08 | Cartes de taille fixe, couverture, `renonce` repliés, pas de photos | §Architecture, page-weight table (cards show 1 measure) |
| M1-09 | Aîné : ≥ 20 px, cibles ≥ 44 px, bloc « ce qui me concerne » | §Code Examples (CSS), DOM-order rule (no CSS reordering) |
| M1-10 | Enfant : mots soulignés → Popover API + liste « Mots expliqués » | §Popover findings P5, fallback for iOS < 18.3 |
| M1-11 | Preview montre les brouillons badgés ; production aucun brouillon | `getCorpus()` filter, `robots.txt` endpoint, `check-dist` mode rules |
| M1-12 | Date de dernière mise à jour par page | §Code Examples (deterministic max-of-content-dates, `<time>`) |
| QUAL-01 | Contrôle post-build : poids, tiers, mots interdits, source datée, espaces collés, cellules | §`check-dist` design + prototype fault-injection, weight table |
</phase_requirements>

## Summary

The architecture already chosen (radios + `:has()` anchored on a wrapper, classic same-origin scripts, Popover API, view-model between content and pages) works as designed. I prototyped it in a throwaway Astro 7.4.5 project (and a second one wired to the **real** content-core loader + `corpus-valide` fixture) and ran it in Chrome 156 through `playwright-core` (installed only under `/tmp`, not a repo dependency). No-JS switching works, only the active level is in the accessibility tree, the saved level is restored with **no painted frame at the wrong level** even with the script artificially delayed 400 ms, bfcache restores re-sync, the shuffle is hidden until done (with a CSS 1.5 s safety net), and `getStaticPaths` + `RTP_MODE` filtering work against the real loader in ~1.5 s per build.

The prototype also surfaced **eight findings that change the plan** (all verified, details below): (1) two `astro build` processes in the same project **clash** (one fails every time), so all builds in tests must be owned by one test file; (2) importing a small script with `?url` silently turns it into a `data:` URI (breaks CSP `script-src 'self'`) unless `vite.build.assetsInlineLimit: 0` is set, which also makes CSS external (shared, hashed) and enables a strict CSP without `'unsafe-inline'`; (3) the decorative `ⓘ` glyph makes level switching 5x slower (system-font fallback, 155 ms vs 32 ms for 111 buttons) and leaks into the button's accessible name; (4) popover definitions should be emitted **inline right after each term button**, not once per page at the end, so screen-reader users find them in reading order (cost: +12 % raw, +1 % gzip); (5) the binding page-weight limit is **gzip 100 Ko, not raw 500 Ko**, and cards that show 2 measures at max REGLE-03 lengths sit at 93 Ko gzip, so cards must show exactly one measure; (6) `popover` is Baseline "newly available" only (iOS Safari full support from 18.3), so the `@supports not selector(:popover-open)` fallback and the "Mots expliqués" list are mandatory, not optional; (7) the existing `skeleton.test.ts` forbids any `.js` file, any `<script`, and any external `href`, all of which Phase 4 legitimately needs, so it must be rewritten; (8) `ci.test.ts` forbids `RTP_MODE` in the workflow and pins the step order, so `check-dist` is added as a plain `npm run check-dist` step after `npm run build` in production mode only.

**Primary recommendation:** Build `src/lib/corpus/` as a pure view-model (`construireCorpus(raw, mode)`) with a thin Astro-bound `getCorpus()`; one `LecteurNiveaux` wrapper with `:has(> .niveaux …)`; hashed external scripts via `?url` + `assetsInlineLimit: 0`; one inline popover per term occurrence; theme cards show exactly one measure; and a stdlib `scripts/check-dist.ts` (mini HTML tokenizer, ~35 lines) covering every QUAL-01 rule, tested by fault injection.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filtering drafts vs published (RTP_MODE) | Build (view-model `getCorpus()`) | `check-dist` (defence in depth) | Only build-time code may decide what enters HTML; production must contain zero draft bytes |
| Alphabetical order (`nom_tri`, `Intl.Collator('fr')`) | Build | — | Static default; JS restores it from build-time `data-rang`, never re-collates |
| Level switching (4 levels) | Browser CSS (`:has()` + radios) | JS only persists/announces | Must work with JS off |
| Level persistence / anti-flash | Browser, classic script after the fieldset | — | Must run before content is parsed; `localStorage` only |
| Random order | Browser JS (`crypto.getRandomValues`) | — | No server, no build-time randomness (would freeze one order for everyone) |
| Glossary definitions | Build (markers `[[…]]` → button + `[popover]`) | Browser Popover API | Declarative, JS-free; fallback list for old browsers |
| Page weight / tiers / glue / forbidden words | CI post-build script | node:test fault-injection | Same checks run locally, in CI, and in tests |
| Robots / noindex | Build (meta + `robots.txt` endpoint) | Server header `X-Robots-Tag` (Lot 3) | Preview artifacts must never be indexable |
| CSP / referrer policy | Server (Lot 3, Caddy) | `check-dist` verifies the page is CSP-compatible (no inline script/style, no `data:` script) | Headers are not part of `dist/` |

## Standard Stack

No new dependency in this phase. [VERIFIED: package.json, prototype]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | ^7.4.5 (installed 7.4.5) | Static routes, `getStaticPaths`, components | Locked by spec; `trailingSlash: 'always'` + default `build.format: 'directory'` yields `dist/themes/<id>/index.html` [VERIFIED: prototype] |
| yaml | ^2.9.1 (already a dep) | Read `config/site.yml` with `{ schema: 'core' }` (dates stay strings) | Same parser as content-core |
| Node stdlib | 24.22.2 | `node:test`, `node:fs`, `node:zlib` (`gzipSync`), `node:vm` (script unit tests) | No dependency, matches Phase 1-2 conventions |

### Supporting (platform features, no packages)
| Feature | Support | Notes |
|---------|---------|-------|
| `:has()` | Baseline widely available (low 2023-12-19, high 2026-06-19); Chrome 105, Safari 15.4, Firefox 121 [CITED: api.webstatus.dev/v1/features/has] | Anchor on `.lecteur` with child combinator (MDN perf advice) |
| Popover API (`popover`, `popovertarget`, `:popover-open`) | Baseline **Low (newly available)** since 2025-01-27 because iOS Safari needs 18.3; Chrome 116, Firefox 125, Safari 17 [CITED: api.webstatus.dev/v1/features/popover] | Fallback mandatory (see Pitfall 5) |
| `@supports selector(...)` | Safari 14.1+, Chrome 83+ | Browsers lacking it also lack `:has()`, so the "all levels visible" fallback is consistent [ASSUMED: from engine histories] |
| `crypto.getRandomValues` | universal | Fisher-Yates with rejection sampling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radios + `:has()` | CSS-only sibling combinator `#niv:checked ~ .contenu` | Works without `:has()` but forces radios outside the `<fieldset>` (loses group semantics); locked decision keeps `:has()` |
| Hand-written tokenizer in `check-dist` | `parse5` / cheerio | `parse5` is **not** in `node_modules` today (checked); a new dep needs a PR justification, and Astro output is well-formed, so ~35 lines suffice |
| `public/js/*.js` | `src/scripts/*.js` + `?url` | See Pitfall 2; `?url` gives content-hashed names (safe with Caddy long cache) |
| Shared popover per term per page | One inline popover per occurrence | Verified +12 % raw / +1 % gzip; better reading order for screen readers |

**Installation:** none. For Phase 5 only: Playwright is already planned (STACK.md).

**Version verification:** `astro` 7.4.5 present in `node_modules`; `playwright-core@1.64.1` exists on the registry (published 2026-11-03, repo `microsoft/playwright`) and was used **only** for the throwaway prototype under `/tmp/rtp-proto/tools`; it is not proposed for this phase. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none added by this phase) | — | — | — | — | not run (no installs) | n/a |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
*`playwright-core` was installed with `--ignore-scripts` in `/tmp` for prototyping only; slopcheck is not installed on this machine, so it is `[ASSUMED]`-grade and must not enter the repo without the Phase 5 justification.*

## Architecture Patterns

### System Architecture Diagram

```
 YAML (corpus root)                         config/site.yml (project root)
   │  content-core loadAll (same as CLI)            │ contact, depot (GitHub slug)
   ▼                                                ▼
 Astro content store (8 collections, strings only) ─► loadSiteConfig() (yaml core schema, strict checks)
   │
   ▼
 getCorpus()  ── resolveMode(undefined, process.env)  (ONLY reader of RTP_MODE, fail-closed)
   │   production: statut_relecture === 'publie' only   preview: all + badge data
   │   construireCorpus(raw, mode)  ◄── pure, unit-testable (no astro:content import)
   │       themes (ordre), candidats (collator + id tiebreak, data-rang), cellules[theme][candidat],
   │       glossaire index, "dernière mise à jour" (max content date), prioritaire_aine themes
   ▼
 getStaticPaths():  /themes/[id]/  /candidats/[id]/  + /themes/  /candidats/  /  /robots.txt
   │
   ▼  per page, ONE wrapper:
 <div class="lecteur">  <fieldset class="niveaux"> 4 radios (name=niveau, autocomplete=off) </fieldset>
   │                    <script src=/_astro/niveau.<hash>.js>  ← sync, restores radio BEFORE content is parsed
   │                    <div class="lecteur-contenu"> bloc "ce qui me concerne" (DOM first) ; order control (hidden) ;
   │                        <ul data-ordonnable> <li class="cellule" data-rang=n> 1 mesure + "N autres" </li> … </ul>
   │                        <details> Ne se présentent pas </details> ; <details> Mots expliqués </details>
   ▼
 dist/*.html + dist/_astro/{base.<hash>.css, niveau.<hash>.js, ordre.<hash>.js}
   │
   ▼  npm run check-dist  (stdlib; mode from resolveMode; expected cell counts from loadAll)
 weight (html+css+js, raw/gzip) · third-party · inline script/style · data: URI · ids · glue · forbidden words
 · mesure source+date · cells = perimeter · draft leakage (production) / noindex (preview) · internal links
```

Browser, JS off: radios drive `:has()` → one level displayed; `<head>` shuffle script absent → alphabetical, control stays `hidden`. Browser, JS on: `ordre.js` (in `<head>`) sets `data-ordre` from localStorage → CSS hides the lists → shuffles at DOMContentLoaded → marks lists `data-ordre-fait` → visible.

### Recommended Project Structure
```
config/site.yml                       # contact, depot ("ErwanHenry/reveleTonProg"); validated by loadSiteConfig()
astro.config.mjs                      # + vite.build.assetsInlineLimit: 0  (pinned by astro-config.test.ts)
src/
├── lib/corpus/
│   ├── vue.ts                        # PURE: construireCorpus(raw, mode) -> Corpus (cellules, états, dates, ordre)
│   ├── index.ts                      # Astro-bound: getCorpus() memoised, reads RTP_MODE via resolveMode
│   ├── enfant.ts                     # PURE: segmenter(texte) -> segments (reuses MARQUEUR_GLOSSAIRE + slugGlossaire)
│   ├── signalement.ts                # PURE: lienMailto(id, page), lienIssue(id)  (encodeURIComponent)
│   └── dates.ts                      # PURE: formatDate("2026-10-21" | "2026-10" | "2026") with Intl, timeZone UTC
├── lib/site-config.ts                # loadSiteConfig()
├── components/ LecteurNiveaux, Cellule, Mesure, SourceCitation, TexteEnfant, OrdreCandidats, BadgeBrouillon, MotsExpliques
├── layouts/Base.astro                # <html lang=fr>, robots meta (preview), <script src={ordreUrl}> in <head>, footer "mis à jour"
├── pages/ index.astro, themes/index.astro, themes/[id].astro, candidats/index.astro, candidats/[id].astro, robots.txt.ts
├── scripts/ niveau.js, ordre.js      # classic scripts, imported with ?url, < 2048 bytes raw each
└── styles/ base.css, niveaux.css
scripts/check-dist.ts + scripts/lib/html.ts          # npm run check-dist
tests/dist/site.test.ts               # THE ONLY test file that runs `astro build` (skeleton + M1 + modes)
tests/fixtures/corpus-m1/             # overlay on corpus-valide (see Wave 0)
```

### Pattern 1: Pure view-model + thin Astro adapter
**What:** all rules (mode filter, ordering, cell state, dates) live in `vue.ts` taking plain arrays; `index.ts` only calls `getCollection` and `resolveMode`. **Why:** `astro:content` cannot be imported by `node:test`; pure code is unit-tested in milliseconds and `getCorpus()` remains the single `RTP_MODE` reader. [VERIFIED: prototype `src/lib/corpus/corpus.ts` built in both modes]

Cell state machine (per perimeter candidate × theme):
`mesures` (≥ 1 visible mesure) → else the `couverture` case `etat` (`non_precise` | `programme_non_publie`, with `verifie_le`) → else `non_verifie` (only reachable in preview; production validation guarantees a case, so `getCorpus()` must **throw** in production if it happens, fail-closed).

### Pattern 2: State in the DOM, scripts only write state
Radios own the level; CSS reads them; `niveau.js` only sets `.checked`, persists, announces. Without JS nothing is lost.

### Pattern 3: Route params through `props`
`getStaticPaths()` cannot read variables from the page frontmatter (only imports) [CITED: docs.astro.build/en/reference/routing-reference]. Return `{ params: { id }, props: { id } }` and call the memoised `getCorpus()` in the frontmatter body.

### Anti-Patterns to Avoid
- **Iterating over mesures in pages** (locked): iterate candidates, then their mesures.
- **Reordering with CSS `order`** for "ce qui me concerne" (WCAG 1.3.2/2.4.3): put the block first in the DOM, show it with `:has()` at Aîné only.
- **`set:html` for the enfant text**: escapes become your problem; use JSX segments (strings keep their own spaces, so no gluing under `compressHTML: true`). [VERIFIED: prototype output `Le <button …>loyer</button><span popover…>…</span> est lié à la …`]
- **Side-effect collection during render** (the prototype's `utilises.add()` worked but is order-dependent): compute the page's term list in the frontmatter from the cell data first.
- **Sticky level switcher without `scroll-padding-top`**: it obscures focus (WCAG 2.4.11, AA in 2.2). Prefer non-sticky; if sticky, set `scroll-padding-top` ≥ its height. [ASSUMED: needs UI-SPEC decision]
- **Two concurrent `astro build` runs** in one project (see Pitfall 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glossary marker parsing | a new regex | `MARQUEUR_GLOSSAIRE` (`rules/config.ts`) + `slugGlossaire` | One syntax already enforced by `references.ts` (A2). `slugGlossaire` lives in `references.ts`, which imports `node:fs`; move it to pure `rules/text/normalize.ts` and re-export from `references.ts` (tiny refactor, avoids drift) |
| Forbidden-word list/normalisation in `check-dist` | a second list | `MOTS_INTERDITS` from `rules/config.ts` (pure) and `foldKey` from `rules/text/normalize.ts` | Prototype used a copy; production code must import, or the Méthode page and the gate disagree |
| Perimeter definition | "status === declare" literals | `PERIMETRE_EQUITE` + last `statuts[]` entry | Matches the equity rule (A6) |
| Mode resolution | `process.env.RTP_MODE ?? 'production'` | `resolveMode(undefined, process.env)` | Fail-closed on invalid values, already tested |
| Shuffle | `sort(() => Math.random() - 0.5)` | Fisher-Yates + rejection sampling over `crypto.getRandomValues` | Uniform; chi² test in Validation Architecture |
| Gzip size | an estimate | `zlib.gzipSync` (level 6 default) | Deterministic; Caddy's level differs by a few % |
| French date formatting | manual month table | `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })` | Date-only strings must not shift with TZ. Day 1 prints "1 novembre"; post-fix to "1er" by hand (ICU does not emit "1er") [VERIFIED: node 24, ICU 78.3] |
| Level toggle, popover, accordion | ARIA tabs / custom JS widgets | native `fieldset`+radios, `popover`, `details` | Native semantics, work without JS |
| mailto/issue URL encoding | template-string concatenation | `encodeURIComponent` per component | RFC 6068: spaces `%20`, line breaks `%0D%0A`, `+` is **not** a space |

**Key insight:** every "hard" part of this phase has a native or already-written answer; the risk is in the seams (build concurrency, asset inlining, glyph fallback, test assumptions), which is where the findings below sit.

## Common Pitfalls

### Pitfall 1: Concurrent `astro build` processes corrupt each other
**What goes wrong:** with `node --test` file-level parallelism, two test files that each run `astro build` in the same project make one build fail (run 4 times: every run, exactly one of two builds exited 1). [VERIFIED: prototype, same project dir, different `--outDir`, different `RTP_MODE`]
**Why:** shared `.astro/` data store and type output.
**How to avoid:** `tests/dist/site.test.ts` is the **only** file allowed to run `astro build` (the existing skeleton comment says so). Move the skeleton cases (a, b, c) into it and add the M1 builds (fixture-m1 in production, in preview, empty root, broken fixture) as sequential `before()`/`it()` steps. All other new test files read fixtures/HTML strings and never spawn Astro.
**Warning signs:** flaky "dist/…/index.html not found" in CI only.

### Pitfall 2: `?url` imports become `data:` URIs; `assetsInlineLimit` also drives CSS inlining
**What goes wrong:** `import u from '../scripts/niveau.js?url'` emitted `<script src="data:text/javascript;base64,…">` (file < 4 KB gets inlined) and the `data:` script violates `script-src 'self'`. [VERIFIED: prototype]
**Fix:** `vite: { build: { assetsInlineLimit: 0 } }` in `astro.config.mjs` → `<script src="/_astro/niveau.Xi2exZqR.js">`, file byte-identical to source, content-hashed. Same setting makes `inlineStylesheets: 'auto'` (threshold = `assetsInlineLimit` [CITED: docs.astro.build configuration-reference]) emit **one shared** `/_astro/<name>.<hash>.css` for all page types [VERIFIED: prototype with theme + candidate pages]. Consequences: (a) CSP can drop `'unsafe-inline'` for styles provided no `<style>` and no `style=""` attributes are emitted (make `check-dist` fail on both); (b) page weight must add the CSS file (the checker sums linked assets); (c) one extra request on first visit, cached afterwards. Pin the setting in `tests/repo/astro-config.test.ts`; `check-dist` rejects `src="data:`.
**Do not** use `<script is:inline src="/js/x.js">` from `public/`: unhashed names + the planned Caddy "cache long" = stale scripts after a deploy.

### Pitfall 3: Decorative `ⓘ` glyph (U+24D8) is slow and pollutes the accessible name
**What goes wrong:** with `.terme::after { content: "\00a0ⓘ" }`, switching to the Enfant level cost **155 ms** layout (111 term buttons, CPU x1) versus **32 ms** with plain-text `::after` or none; and Chrome's accessible name became "loyer ⓘ". [VERIFIED: prototype, CDP `Performance.getMetrics`]
**Fix:** no exotic Unicode symbol. Use the dotted underline (required anyway) and, if an icon is wanted, a plain ASCII character or a CSS-drawn shape (no `data:` image: CSP `img-src`), and give generated content an empty alt: `content: "\00a0?" / "";` (Chrome 156 then reports the name "loyer" [VERIFIED]; browsers not supporting the `/` syntax drop the whole declaration, so declare a plain one first, then the alt one).
**Note:** `:has()` style recalculation itself is cheap (2-17 ms on a 154 Ko page). [VERIFIED]

### Pitfall 4: Popover definitions out of reading order
**What goes wrong:** Chrome exposes `expanded` (false/true) and an implicit `details` relation on `popovertarget` buttons, and the open popover as a `group` [VERIFIED: CDP AX tree; MDN: "an implicit aria-details and aria-expanded relationship is set up" — CITED: developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using]. Focus **stays on the button** when it opens; Esc closes and keeps focus on the button; Tab moves to the next focusable (a text-only popover has none) [VERIFIED]. Nothing announces the content; a popover parked at the end of the page is not found by arrowing on from the button.
**Fix:** emit `<button class="terme" popovertarget=ID>mot</button><span id=ID popover class="definition">…</span>` adjacent, one popover per occurrence, ids suffixed with the mesure slug (`check-dist` rejects duplicate ids). Many invokers may target one popover (37 → one worked) but do not. Cost: 173.7 Ko vs 154.5 Ko raw, 39.7 vs 39.2 Ko gzip at 37 cards x 3 terms. [VERIFIED]
**Residual risk (MEDIUM):** whether VoiceOver (macOS/iOS), NVDA and JAWS read the adjacent popover on activation is not testable here. Add to the Phase 5 manual checklist; mitigation if poor: give the popover `tabindex="-1"` and focus it from a 3-line `click` handler (progressive enhancement only).
**For `type: parti` glossary entries** show the `source` (title + date) inside the popover: the definition is the party's self-description ("se présente comme…"), neutrality requires showing whose words they are.

### Pitfall 5: Old browsers show the definition text inline
**What goes wrong:** without Popover support (iOS < 17 / < 18.3 partial, Firefox < 125), `<span popover>` is an ordinary inline span, so the sentence reads "…la cantine La cantine est le restaurant… pour tous". Baseline status is only "newly available" (since 2025-01-27). [CITED: api.webstatus.dev]
**Fix:** `@supports not selector(:popover-open) { [popover].definition { display: none } .terme { text-decoration: none; color: inherit } .terme::after { content: none } }` plus the "Mots expliqués" `<details>` list (page-level, one `<dt>/<dd>` per distinct term, shown only at Enfant level) and a one-line hint visible only in that `@supports not` branch. [VERIFIED: rule syntax built into prototype CSS; the non-supporting branch itself could not be exercised in Chrome]

### Pitfall 6: `autocomplete="off"` vs Back-navigation without JS
**Measured:** without JS and **with** autocomplete enabled, Chrome restores the checked level on Back; with `autocomplete="off"` it resets to "En bref". [VERIFIED]
**Decision:** keep `autocomplete="off"` on the 4 radios (and the order radios). With JS, the localStorage value must win over browser form restoration, and Firefox's restoration timing relative to inline-ish scripts could not be tested here [ASSUMED]; the no-JS Back reset is consistent with "each page starts at En bref without JS" (accepted trade-off in ARCHITECTURE §3). The attribute goes on the inputs (a `<fieldset>` does not support it; no `<form>` needed).

### Pitfall 7: Radio flash before the restoring script (external script)
**Measured:** with `niveau.js` delayed 400 ms, recorded `requestAnimationFrame` frames never showed the wrong level: first frame with radios already had `enfant` checked, `resume` blocks visible = 0 in all frames. [VERIFIED: Chrome 156 only]
**Why it holds:** the script is parser-blocking and sits between the fieldset and the content, and the browser did not paint the half-parsed page. Not guaranteed by spec; the structural guarantee is that all level-dependent **content** comes after the script. Keep the script directly after `</fieldset>` and never `defer`/`async`/`type="module"`.

### Pitfall 8: Shuffle flash and dead script
**Design verified:** `ordre.js` runs from `<head>`; if `rtp:ordre === 'aleatoire'` it sets `data-ordre="aleatoire"` on `<html>` before body parsing; CSS `html[data-ordre="aleatoire"] [data-ordonnable]:not([data-ordre-fait]) { visibility: hidden; animation: rtp-reveler 0s 1.5s forwards }` (`@keyframes rtp-reveler { to { visibility: visible } }`) hides the lists without layout shift and reveals them after 1.5 s even if the script throws after setting the attribute. [VERIFIED: frames `hidden` → `visible,fait`; dead-script case `hidden` → `visible` after 1.7 s]. Do **not** gate this animation on `prefers-reduced-motion` (it is a safety net, not motion).
**bfcache:** restore keeps the DOM (verified `pageshow.persisted === true`, DOM marker kept), so the visitor returns to the order they left. Decision: do **not** reshuffle on bfcache restore; only `niveau.js` re-syncs.

### Pitfall 9: Existing tests encode assumptions Phase 4 breaks
- `tests/dist/skeleton.test.ts` (a): fails on any `*.js` in dist, any `<script`, any `href="https://…"` (candidate site links, Wayback), and expects the old `index.astro` skeleton text. Replace by calls to the shared `check-dist` library (resource-loading attributes must be same-origin; only `<a href>` may be external, with `rel="noopener noreferrer"`; only allow-listed same-origin `<script src>`).
- `tests/repo/ci.test.ts`: `expectedOrder` must gain `'npm run check-dist'` after `'npm run build'`; `!/RTP_MODE/.test(ciRaw)` forbids a preview step in the workflow, so preview builds are exercised **inside node:test** (env set per build), not in `ci.yml`. The Phase 5 "preview artifact" (QUAL-05) will have to relax that test deliberately.
- `tests/repo/astro-config.test.ts`: add the `assetsInlineLimit: 0` assertion.
- `tests/content-core/corpus-valide.test.ts` and the piège overlays depend on `corpus-valide` content: **do not edit it**; build the richer corpus as an overlay (Wave 0).

### Pitfall 10: Weight is gzip-bound, and Ko ambiguity
Use 1 Ko = 1000 octets (500 000 / 100 000: stricter and unambiguous). Count a page as HTML + linked same-origin CSS/JS, raw and gzip separately. With this markup the text compresses about 3.9x (synthetic text, indicative), so **gzip 100 Ko binds before raw 500 Ko**: 60 cards x 2 measures is 481 Ko raw (just under) but 116.7 Ko gzip (over). See the weight table.

### Pitfall 11: Details that bite in review
- Forced-colors mode: `:checked + label` background disappears; add an outline/border (`@media (forced-colors: active)`) [VERIFIED: rule present in prototype; rendering not checked].
- Radio inputs must stay focusable: overlay them transparently (`opacity: 0; position: absolute; inset: 0`), never `display: none`. A click-test via the label fails in Playwright (the input intercepts pointer events), so tests click `#niv-enfant`.
- `role="status"` empty live region shipped in HTML (not created by JS); the first message is announced because the node exists beforehand. The radio change is already announced by the screen reader, so keep the message short ("Niveau « En détail » affiché.").
- Cell tie-break: `Intl.Collator('fr')` on `nom_tri`, then `id`, so equal keys have a deterministic order.
- Production must never silently fall back: unknown `RTP_MODE` throws (already true via `resolveMode`).
- Do not print the mailto page URL as an absolute URL: `site` is not configured (domain unknown); use the path `/themes/logement/#m-…`.

## Code Examples

### Toggle markup and CSS (prototype-verified)
```html
<div class="lecteur">
  <fieldset class="niveaux" aria-describedby="niveaux-aide">
    <legend>Niveau de lecture</legend>
    <span class="niveau"><input type="radio" name="niveau" id="niv-resume" value="resume" checked autocomplete="off"><label for="niv-resume">En bref</label></span>
    <!-- niv-detaille "En détail", niv-enfant "Pour les enfants", niv-aine "Gros caractères" -->
    <p id="niveaux-aide" class="aide">Ce choix s'applique à toutes les mesures de la page.</p>
    <p class="sr-only" role="status" data-niveau-annonce></p>
  </fieldset>
  <script src="/_astro/niveau.B6qKp3v7.js"></script>   <!-- Astro: <script is:inline src={niveauUrl}> -->
  <div class="lecteur-contenu">…</div>
</div>
```
Per measure: `.mesure[data-statut-relecture]` containing four `.redaction[data-niveau="resume|detaille|enfant|aine"]` blocks (each starts with `<p class="etiquette">`), then the source block and report links **outside** the level blocks (always visible).
```css
.lecteur:has(> .niveaux #niv-resume:checked)   .redaction:not([data-niveau="resume"]),
.lecteur:has(> .niveaux #niv-detaille:checked) .redaction:not([data-niveau="detaille"]),
.lecteur:has(> .niveaux #niv-enfant:checked)   .redaction:not([data-niveau="enfant"]),
.lecteur:has(> .niveaux #niv-aine:checked)     .redaction:not([data-niveau="aine"]) { display: none; }
@supports selector(:has(*)) { .redaction > .etiquette { /* visually hidden, still read */ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } }
.lecteur:has(> .niveaux #niv-aine:checked) .lecteur-contenu { font-size: 1.25rem; }          /* 20 px at the default root size */
.lecteur:has(> .niveaux #niv-aine:checked) :is(a, button, label) { min-height: 2.75rem; }       /* 44 px targets */
.concerne-aine { display: none; } .lecteur:has(> .niveaux #niv-aine:checked) .concerne-aine { display: block; }
.niveau { position: relative; } .niveau input { position: absolute; inset: 0; opacity: 0; margin: 0; width: 100%; height: 100%; }
.niveau input:focus-visible + label { outline: 3px solid; outline-offset: 2px; }
```
Evidence: JS off, `#niv-enfant` click → visible blocks `{resume:0,detaille:0,enfant:37,aine:0}`; accessibility tree: radiogroup-like `group "Niveau de lecture"`, radios `En bref:false | En détail:false | Pour les enfants:true | …`, and only the active level's blocks present (labels read: 37 `Pour les enfants` + 1 radio label, 1 each for the others = the radios). With every `:has(` renamed (simulating no support) all four levels and the visible labels show: page still complete. [VERIFIED: Chrome 156]

### `niveau.js` (833 bytes; unit-tested in `node:vm`, 5 cases pass)
```js
(function () {
  var CLE = 'rtp:niveau', champ = document.querySelector('.niveaux');
  if (!champ) return;
  var annonce = document.querySelector('[data-niveau-annonce]');
  function lire() { try { return localStorage.getItem(CLE); } catch (e) { return null; } }
  function appliquer(v) {                       // compare, never interpolate into a selector
    var r = champ.querySelectorAll('input[name="niveau"]');
    for (var i = 0; i < r.length; i++) if (r[i].value === v) { r[i].checked = true; return; }
  }
  appliquer(lire());
  champ.addEventListener('change', function (e) {
    var r = e.target;
    if (r.name !== 'niveau') return;
    try { localStorage.setItem(CLE, r.value); } catch (x) {}
    if (annonce) annonce.textContent = 'Niveau « ' + r.labels[0].textContent + ' » affiché.';
  });
  addEventListener('pageshow', function (e) { if (e.persisted) appliquer(lire()); });
})();
```
Tests: restores stored level; hostile/unknown/empty value ignored without exception; `localStorage` throwing (Safari private mode) leaves default; `change` writes only `rtp:niveau`; persisted `pageshow` resyncs. Browser: after `localStorage.setItem('rtp:niveau','aine')` while the page sat in bfcache, Back showed `aine`. [VERIFIED]

### `ordre.js` (1694 bytes, in `<head>`; chi² = 4.67 over 60 000 draws of 6 items, threshold 20.52)
```js
(function () {
  var CLE = 'rtp:ordre', racine = document.documentElement, mode = 'alphabetique';
  try { if (localStorage.getItem(CLE) === 'aleatoire') mode = 'aleatoire'; } catch (e) {}
  if (mode === 'aleatoire') racine.setAttribute('data-ordre', 'aleatoire');
  function alea(n) {
    var max = Math.floor(4294967296 / n) * n, u = new Uint32Array(1);
    do { crypto.getRandomValues(u); } while (u[0] >= max);       // rejection sampling: no modulo bias
    return u[0] % n;
  }
  function ordonner() {
    var listes = document.querySelectorAll('[data-ordonnable]');
    for (var k = 0; k < listes.length; k++) {
      var l = listes[k], a = Array.prototype.slice.call(l.children), f = document.createDocumentFragment();
      if (mode === 'aleatoire') {
        for (var i = a.length - 1; i > 0; i--) { var j = alea(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
      } else a.sort(function (x, y) { return x.getAttribute('data-rang') - y.getAttribute('data-rang'); });
      a.forEach(function (n) { f.appendChild(n); });
      l.appendChild(f);
      l.setAttribute('data-ordre-fait', '');
    }
  }
  function pret() {
    ordonner();
    var c = document.querySelector('[data-ordre-controle]');
    if (!c) return;
    c.hidden = false;                                              // control exists hidden without JS
    c.querySelector('input[value="' + mode + '"]').checked = true;
    c.addEventListener('change', function (e) {
      mode = e.target.value;                                       // 'alphabetique' | 'aleatoire' (radio values)
      try { localStorage.setItem(CLE, mode); } catch (x) {}
      ordonner();
      c.querySelector('[data-ordre-annonce]').textContent = 'Ordre ' + (mode === 'aleatoire' ? 'aléatoire : nouveau tirage.' : 'alphabétique.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pret); else pret();
})();
```
Browser results: JS off → control `hidden`, first card `c-candidat-00`, explanatory text "L'ordre aléatoire demande JavaScript" present; JS on with `aleatoire` → list `hidden` then `visible,fait` with a shuffled first card; switching back restores `data-rang` order; 60 loads gave 29-31 distinct first cards (expected ≈ 29). Static markup: `<ul class="cellules" data-ordonnable>` with `<li class="cellule" data-rang="n">`; the `renonce` list and the `/candidats/` index list get `data-ordonnable` too. Each card carries a build-time `data-rang` so the client never re-collates. The raw size limit (2048) is enforced by `check-dist`; the first draft with comments was 2097 bytes, so strip comments in the shipped file (document them in the test file instead).

### View-model skeleton (pure)
```ts
// src/lib/corpus/vue.ts — no astro:content import
export interface Brut { themes: Theme[]; candidats: Candidat[]; mesures: Mesure[]; sources: Source[]; couverture: Couverture[]; glossaire: Entree[] }
export function construireCorpus(brut: Brut, mode: 'preview' | 'production'): Corpus {
  const visible = (s: StatutRelecture) => (mode === 'production' ? s === 'publie' : true);
  // themes: visible(statut_relecture), sorted by ordre ; candidats: collator.compare(nom_tri) then id -> rang
  // perimetre = candidats whose LAST statuts[] code ∈ PERIMETRE_EQUITE  (same as equity rule, A6)
  // cellule(theme, candidat): mesures = visible mesures of that pair (title order) ; etat from couverture ; throw if none in production
  // misAJour(page) = max(date_relecture, verifie_le, date_consultation, statut date) over what the page shows
}
// src/lib/corpus/index.ts (Astro-bound)
import { getCollection } from 'astro:content';
import { resolveMode } from '../content-core/root.ts';
let memo: Promise<Corpus> | undefined;
export const getCorpus = () => (memo ??= (async () => construireCorpus(await lireTout(), resolveMode(undefined, process.env)))());
```
Prototype (real loader, `corpus-valide`, production vs preview): both modes build 4 pages in ~0.7-1.5 s, `data-mode` follows `RTP_MODE`, `getStaticPaths` returned themes and candidates. [VERIFIED]

### Enfant text → segments (no `set:html`)
```astro
{segmenter(texte).map((s) => s.terme
  ? <><button type="button" class="terme" popovertarget={s.popId}>{s.affiche}</button><span id={s.popId} popover class="definition">{s.definition}</span></>
  : s.texte)}
```
`segmenter` returns text and term segments by iterating `texte.matchAll(MARQUEUR_GLOSSAIRE)` and resolving `m[2] ?? slugGlossaire(m[1])`; an unknown id throws at build (the rule already guarantees it for validated content). Output keeps the spaces (`…de la <button>…</button><span…>…</span> pour…`) under `compressHTML: true`. [VERIFIED]

### Report links
```ts
const sujet = `Signaler une erreur : ${id}`;
const corps = `Identifiant : ${id}\r\nPage : ${chemin}\r\n\r\nErreur constatée :\r\n`;
export const lienMailto = (contact, id, chemin) => `mailto:${contact}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
export const lienIssue = (depot, id) =>
  `https://github.com/${depot}/issues/new?title=${encodeURIComponent(`Erreur signalée : ${id}`)}&body=${encodeURIComponent(`Identifiant : ${id}\n\nErreur constatée :\n`)}`;
```
- RFC 6068: spaces `%20` (not `+`), body line breaks `%0D%0A`, no max length defined. [CITED: rfc-editor.org/rfc/rfc6068]
- GitHub `issues/new` accepts `title`, `body`, `labels`, `assignees`, `milestone`, `projects`, `template`; invalid URL or missing permission gives 404; over-long URL gives 414. [CITED: docs.github.com … creating-an-issue] `labels` is applied only if the label exists and the visitor may label, so **do not rely on it**: put the id in the title and omit `labels` (or add it as best-effort). Issue-form field prefill is mentioned but its id mapping is not documented on the pages read → do not use `template=` forms in v1.
- The repo (`ErwanHenry/reveleTonProg`) is private until launch (Pitfall 18): the issue link 404s for outsiders before then; the mailto link always works. Read `contact` and `depot` from `config/site.yml`; `check-dist` warns when the contact ends in `.invalid` (placeholder until Lot 3).
- Weight: two links x ~400 B per measure; negligible after gzip.

### `check-dist` core (stdlib, run on 154 Ko in 66 ms; 12 injected faults all caught)
```ts
// scripts/lib/html.ts — tokenizer for Astro-generated, well-formed HTML (ignores comments, handles void elements)
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|[^<]+|</g;
// stack-based tree -> { tag, attrs, children, parent }; helpers walk(), text(el, skip), cls(el, name)
```
Rules (code → check), all in one `checkDist(dist, { mode, cellulesParTheme })`:

| Code | Rule |
|------|------|
| `POIDS_BRUT` / `POIDS_GZIP` | per HTML page: html + linked same-origin `<link rel=stylesheet>` + `<script src>`; 500 000 / 100 000 octets |
| `SCRIPT_TROP_LOURD` | each `.js` in dist ≤ 2048 octets |
| `RESSOURCE_TIERCE` | `src`, `srcset`, `poster`, `data`, `action`, `<link href>`, CSS `@import`/`url(http…)` must not be absolute/protocol-relative; **only `<a href>` may leave the site**, and then needs `rel` containing `noopener` |
| `SCRIPT_EN_LIGNE`, `SCRIPT_DATA_URI`, `STYLE_EN_LIGNE` | no `<script>` without `src`, no `data:` script, no `<style>`/`style=` (CSP-ready) |
| `ID_DUPLIQUE` | unique ids per page (popovers, anchors) |
| `ESPACE_PERDU` | `[\p{L}\p{N}]<(button\|a)\b` or `</(button\|a)>[\p{L}\p{N}]` (opt-out `data-colle`); plus a canary: the layout footer ships `<span>…</span>␊texte` and the fixture test asserts `</span> texte` survives (exactly what the skeleton test did) |
| `MOT_INTERDIT` | visible text minus `[data-liste-mots-interdits]`, `[data-citation]`, `<style>/<script>`, and `« … »` spans; matching = `MOTS_INTERDITS` + `foldKey` imported from content-core. Mark source titles `data-citation` (Phase 2 exempts `sources.titre`) |
| `MESURE_SANS_SOURCE_DATEE` | each `.mesure` has a `.source` containing `<time datetime="AAAA-MM-JJ">` and an `https:` link |
| `CELLULES_INCOHERENTES` | on `main[data-theme]` pages, `.cellule` count = perimeter size computed **independently** with `loadAll` + `PERIMETRE_EQUITE` (not from the view-model) |
| `BROUILLON_EN_PRODUCTION` | production: every `.mesure` has `data-statut-relecture="publie"` (attribute mandatory = fail-closed), no badge text |
| `PREVIEW_INDEXABLE` | preview: every page has `meta robots noindex` (and `robots.txt` Disallow) |
| extras (cheap) | internal `href` resolves to a file in dist; `<html lang="fr">`; one `<h1>`; no literal `[[` left |

Prototype caught: oversized `ordre.js` (2097 B), forbidden words in random text (`extrême`, `enfin`), missing noindex, inline script, third-party stylesheet/img, duplicate id, glued `<button>`, mesure without dated source, draft in production, wrong cell count; it exempted `enfin` inside « … » and inside `[data-liste-mots-interdits]`. [VERIFIED]

### Deterministic "dernière mise à jour"
Display the max of the content dates shown on the page (mesure `date_relecture`, couverture `verifie_le`, source `date_consultation`, statut `date`), formatted with `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })` and wrapped in `<time datetime="AAAA-MM-JJ">`. Reasons: reproducible builds, no TZ drift (CI forces `TZ=Europe/Paris`), no dependence on git depth. Partial dates (`AAAA-MM`, `AAAA`) format as "octobre 2026" / "2026". [VERIFIED: formatting; policy is a recommendation]

## Page weight estimate (prototype, synthetic French-vocabulary text, real markup incl. popovers, source block, 2 report links)

| Scenario | Raw | gzip -6 | brotli |
|----------|-----|---------|--------|
| Theme page, 37 cards x **1** measure, average lengths (22/150/52/90 words) | 154-174 Ko | 39 Ko | 32 Ko |
| same, **max** REGLE-03 lengths (25/200/60/120) | 196 Ko | **48.6 Ko** | 40 Ko |
| 37 cards x **2** measures shown, average lengths | 300-342 Ko | 74-76 Ko | 61 Ko |
| 37 cards x 2 measures shown, **max** lengths | 385 Ko | **93.3 Ko** (limit 100) | 75.5 Ko |
| 60 cards x 2 measures, average lengths | 481 Ko | **116.7 Ko (over)** | 94 Ko |
| 37 cards x 3 measures, average lengths | 443 Ko | **107.7 Ko (over)** | 88 Ko |
| Candidate page, 20 measures (10 themes x 2), max lengths | 107 Ko | 27.5 Ko | 23 Ko |
| Shared CSS (external) | 3.1 Ko | 1.2 Ko | — |

Per displayed measure ≈ 4.2 Ko raw, ≈ 1.05 Ko gzip. [VERIFIED: prototype; text is random sampling of repo prose, so ratios are indicative: MEDIUM] Consequences: cards show exactly one measure (as locked); never render several measures per cell on a theme page; if a theme ever exceeds ~60 perimeter candidates, split by sous-thème rather than lazy-loading (no-JS must work). Real accented French is slightly larger raw (2-byte UTF-8), still comfortable at one measure per card.

## Runtime State Inventory

Not a rename/refactor/migration phase: omitted. (New client state is exactly `rtp:niveau` and `rtp:ordre`; no cookies; nothing server-side.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS tab widgets with ARIA | native radios + `:has()` | `:has()` widely available 2026-06-19 | no JS, native semantics |
| Custom tooltip/definition JS | `popover` + `popovertarget` (implicit `aria-expanded`/`aria-details`) | Baseline "newly" 2025-01-27 | keep fallback list |
| Astro default `compressHTML` | v7 default `'jsx'` glues inline words | Astro 7.0 | project pins `true` (tested) |
| Inlined small CSS/assets | `assetsInlineLimit: 0` for CSP-clean external assets | this phase | enables `script-src 'self'; style-src 'self'` |

**Deprecated/outdated:** `astro:content` `z`, legacy collections (already avoided). Hover-only definitions, `title=` tooltips (inaccessible; not used).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production shows the **last reviewed** statut entry (`relu`/`publie`); if none, "Statut en cours de vérification"; cells still follow the equity perimeter (last entry, A6) | Open Q1 | Phase 3 data (59 brouillon statuts) would otherwise leak unreviewed statuses or make CI fail permanently |
| A2 | Theme pages list only `declare`+`primaire` as `.cellule`; `renonce` in the collapsed section; `pressenti`/`empeche` only on `/candidats/` and their own page (+ one count line) | Open Q2 | Visitors may expect `empeche` under "Ne se présentent pas" |
| A3 | Preview badge text for `relu` (not yet `publie`) = "relu, pas encore publié" | Open Q3 | Cosmetic |
| A4 | "Copie archivée" = Wayback URL + sha256 + GitHub blob link under `depot` from `config/site.yml`; archives are never copied into `dist/` | Open Q4 | Blob link 404s until the repo is public |
| A5 | Firefox ESR/Firefox form-state restoration may override a late script; `autocomplete="off"` is the safe choice | Pitfall 6 | Slightly worse no-JS Back UX |
| A6 | VoiceOver/NVDA/JAWS read an adjacent open popover in reading order | Pitfall 4 | Enfant definitions inaudible to some AT users; fallback list still works |
| A7 | Sticky switcher is a UI-SPEC decision; if chosen needs `scroll-padding-top` | Anti-patterns | WCAG 2.4.11 failure |
| A8 | Browsers without `@supports selector()` all lack `:has()` | Standard Stack | None practical (older than Safari 14.1) |

## Open Questions (RESOLVED)

1. **Which statut does the page display in production, given Phase 3 will hold many `brouillon` statuts?**
   - Known: `statut_relecture` lives on each `statuts[]` entry (ADR-021); equity perimeter reads the last entry regardless of review state (A6); Phase 3 stores ambiguous `renonce` motifs as `brouillon`.
   - RESOLVED (recommendation, A1): show the last entry whose `statut_relecture ∈ {relu, publie}`; if there is none, show a neutral grey "Statut en cours de vérification" (no code, no date). Preview shows the last entry with a badge when it is `brouillon`. Cell membership keeps using the A6 perimeter. `check-dist` does **not** fail production on unreviewed statuts (it would make CI red until all 59 are reviewed); it fails if a `.mesure` is not `publie`. Planner: lock this in the plan as `[ASSUMED]` and surface it to Erwan at the first checkpoint.

2. **Who gets a card on a theme page?**
   - RESOLVED (A2): perimeter (`declare`, `primaire`) = `.cellule`; `renonce` = collapsed `<details>` "Ne se présentent pas" (name, motif text, date, link; no `.cellule`); `pressenti`/`empeche` are reachable from `/candidats/` and a count line "N personnalités pressenties ou empêchées : voir la liste des candidats". `check-dist` counts `.cellule` only.

3. **Preview badges.**
   - RESOLVED (A3): `brouillon` → "brouillon, non relu" (locked wording); `relu` → "relu, pas encore publié"; `publie` → no badge. Badge is text, not colour-only. Production never renders badge markup.

4. **Target of the "copie archivée" link (archives are not in `dist/`).**
   - RESOLVED (A4): show (a) the Wayback link when present (always public), (b) "extrait archivé, empreinte sha256 abcdef12…" linking to `https://github.com/<depot>/blob/main/<archive.extrait>`. `depot` comes from `config/site.yml`. Never ship `archives/` into `dist/` (ARCHITECTURE anti-pattern 7).

5. **Do M1-03 cross-links need index pages?**
   - RESOLVED: yes: `/themes/` and `/candidats/` (the latter lists all 59, `data-ordonnable`, with the order control) plus a hall `/`. The old skeleton `index.astro` is replaced; its checks move into `site.test.ts`.

6. **Where is `config/site.yml` read from, given `RTP_CONTENT_ROOT` points into a fixture?**
   - RESOLVED: from the **project root** (`config/site.yml`), not the content root, via `loadSiteConfig()` using `yaml` with `{ schema: 'core' }`; strict checks (contact is an address, depot matches `^[\w.-]+/[\w.-]+$`), build fails on invalid; the fixture builds therefore also show the `.invalid` placeholder.

7. **CSS inline or external?**
   - RESOLVED: external shared file (`assetsInlineLimit: 0`), see Pitfall 2. One extra cached request is acceptable against the < 1 s target (Phase 5 measures it).

8. **Second-measure display / lazy loading?**
   - RESOLVED: no. One measure per card; "N autres mesures" links to `/candidats/<id>/#<theme>`; no lazy loading (violates no-JS).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 via `fnm exec --using=24` | build, tests, check-dist | ✓ | 24.22.2 (npm 11.19.1) | — |
| astro | pages | ✓ | 7.4.5 | — |
| Google Chrome (local) | manual/prototype verification only | ✓ | 156.0.8078 | Brave also installed; not needed in CI |
| Safari | manual cross-check | ✓ (app present, not scriptable here) | — | manual |
| Playwright / axe | Phase 5 | ✗ not installed in repo | — | deferred to Phase 5 by decision |
| `ctx7` / slopcheck | docs lookup / package audit | ✗ | — | official docs via WebFetch; no packages added |
| VoiceOver / NVDA / JAWS | popover + toggle announcements | not testable | — | Phase 5 manual checklist |

**Missing dependencies with no fallback:** none for Phase 4.
**Missing dependencies with fallback:** real-AT testing → manual checklist.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` on Node 24 (TypeScript type stripping), already used |
| Config file | none; `package.json` script `TZ=Europe/Paris node --test "tests/**/*.test.ts"` |
| Quick run command | `fnm exec --using=24 node --test tests/corpus/*.test.ts tests/scripts/*.test.ts tests/browser-js/*.test.ts` (no Astro build) |
| Full suite command | `npm test` (includes `tests/dist/site.test.ts`, the single build owner) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| M1-01 | cells = perimeter, typed dated empty states | unit (`construireCorpus`) + dist | `node --test tests/corpus/vue.test.ts` ; `site.test.ts` | ❌ Wave 0 |
| M1-02 | candidate page: statut text+date+source, parti | dist | `node --test tests/dist/site.test.ts` | ❌ Wave 0 |
| M1-03 | cross-links resolve | `check-dist` internal-link rule | `node --test tests/scripts/check-dist.test.ts` | ❌ Wave 0 |
| M1-04 | `.source` with `<time>` + https link + 2 report links with encoded id | unit (`signalement.ts`) + `check-dist` | `node --test tests/corpus/signalement.test.ts` | ❌ Wave 0 |
| M1-05 | fieldset/legend, 4 radios `autocomplete=off`, 4 `.redaction` per mesure, 4 `:has()` rules in CSS | dist (markup + CSS string) ; real behaviour verified by prototype, automated in Phase 5 | `site.test.ts` | ❌ Wave 0 |
| M1-06 | restore / hostile value / storage throws / pageshow | unit via `node:vm` | `node --test tests/browser-js/niveau.test.ts` | ❌ Wave 0 (prototype test exists in `/tmp/rtp-proto/final`) |
| M1-07 | collation order incl. accents/particles, `data-rang`; Fisher-Yates uniformity; control `hidden` | unit + dist | `tests/corpus/vue.test.ts`, `tests/browser-js/ordre.test.ts` (chi² < 20.52, 60 000 draws) | ❌ Wave 0 |
| M1-08 | ≤ 1 `.mesure` per `.cellule`, "N autres" link, couverture line, `<details>` renonce without `.cellule` | dist | `site.test.ts` | ❌ Wave 0 |
| M1-09 | CSS: aîné `font-size ≥ 1.25rem`, `min-height ≥ 2.75rem`; `.concerne-aine` precedes the list in DOM and links `prioritaire_aine` themes | dist (CSS regex + DOM order) | `site.test.ts` | ❌ Wave 0 |
| M1-10 | each `[[…]]` → `button[popovertarget]` + adjacent `[popover]` with matching id; no literal `[[`; fallback `@supports not` rule; "Mots expliqués" present | unit (`enfant.ts`) + dist | `tests/corpus/enfant.test.ts`, `site.test.ts` | ❌ Wave 0 |
| M1-11 | production dist has zero draft titles/badges; preview has badge + noindex + `robots.txt` Disallow | dist x2 builds | `site.test.ts` (trap draft title must not appear in production `dist/`) | ❌ Wave 0 |
| M1-12 | `<time datetime>` update date on every page, deterministic across two builds | dist | `site.test.ts` | ❌ Wave 0 |
| QUAL-01 | every rule above fails on injected fault; real fixture build passes | fault-injection unit + dist | `node --test tests/scripts/check-dist.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick command (no Astro build, < 10 s).
- **Per wave merge:** `npm test` (adds 3-4 sequential builds, ~2-5 s each) + `npm run build && npm run check-dist`.
- **Phase gate:** full suite green, CI green, `RTP_MODE=preview` build inspected manually once in a browser (toggle, shuffle, popovers) and with a screen reader if available.

### Wave 0 Gaps
- [ ] `tests/fixtures/corpus-m1/` overlay on `corpus-valide` (copied at test time with `cpSync`; superset `ids.lock`): a `renonce` candidate, a candidate with `non_precise` couverture (+ `sources_consultees`), a second published theme with `prioritaire_aine`, a `brouillon` mesure with a unique trap title (leak test), a `relu` mesure, enfant text with `[[loyer]]` and `[[Parti Imaginaire|parti-imaginaire]]`, a name with a particle ("de Villepin" with `nom_tri: Villepin`) and an accented name; must pass `npm run validate` (add one test for that).
- [ ] `tests/dist/site.test.ts` = skeleton cases (a)-(d) rewritten + M1 builds; delete/replace `skeleton.test.ts` so only one file builds.
- [ ] `scripts/check-dist.ts`, `scripts/lib/html.ts`, `tests/scripts/check-dist.test.ts` (synthetic HTML directories, one fault per rule + a clean pass).
- [ ] `tests/browser-js/niveau.test.ts`, `ordre.test.ts` (read the shipped files, `node:vm` sandbox; prototypes already pass).
- [ ] Update `tests/repo/ci.test.ts` (step order), `tests/repo/astro-config.test.ts` (`assetsInlineLimit: 0`), `package.json` (`"check-dist": "node scripts/check-dist.ts"`), `ci.yml` (`npm run check-dist` after build; no `RTP_MODE`), README/RUNBOOK lines.
- [ ] Framework install: none.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | no accounts, no cookies |
| V4 Access Control | no | static public site |
| V5 Input Validation | yes | content validated by JSON Schema (`https-url` only) before build; Astro escapes text; `encodeURIComponent` for report URLs; localStorage values compared against radio values, never interpolated into selectors |
| V6 Cryptography | partial | `crypto.getRandomValues` for shuffle only (not security-critical); no custom crypto |
| V14 Configuration | yes | CSP `default-src 'self'; script-src 'self'; style-src 'self'` achievable (no inline script/style, no `data:`); `Referrer-Policy`/`<meta name="referrer">` decision at Lot 3; `check-dist` enforces the page side |

### Known Threat Patterns for static Astro + YAML content
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via content text | Tampering | Astro auto-escaping; **no `set:html`**; JSX segments for the enfant text |
| `javascript:` / non-https links from YAML | Tampering | schema format `https-url`; `check-dist` verifies external `<a>` are `https:` with `rel="noopener noreferrer"` |
| Third-party tracking via resources | Info disclosure | `check-dist` `RESSOURCE_TIERCE` (also CSS `@import`/`url()`), `data:` ban |
| Unreviewed drafts published | Repudiation/Tampering | `getCorpus()` filter + `check-dist` `BROUILLON_EN_PRODUCTION` + noindex/robots in preview |
| Selector injection from tampered localStorage | Tampering | value comparison loop (tested with `"]x`) |
| Prefilled-issue link abuse | Spoofing | content is built only from the mesure id; no free text from visitors is stored (mailto/GitHub only) |
| Referrer leakage to candidate sites/GitHub | Info disclosure | `rel="noopener noreferrer"`; revisit a global referrer policy at Lot 3 |

## Sources

### Primary (HIGH confidence)
- Local prototypes (Astro 7.4.5, Chrome 156.0.8078.80, Node 24.22.2) in `/tmp/rtp-proto/{work,work2,final,check,tools}`: toggle markup, no-JS behaviour, AX tree dumps, frame recording, bfcache, shuffle, popovers, weights, `?url`/`assetsInlineLimit`, concurrent-build clash, real-loader `getStaticPaths` + RTP_MODE, `robots.txt` endpoint, `check-dist` fault injection.
- https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using : light dismiss, Esc focus return, one auto popover at a time, implicit `aria-details`/`aria-expanded`.
- https://docs.astro.build/en/reference/routing-reference/ : `getStaticPaths` scope rule and props.
- https://docs.astro.build/en/reference/configuration-reference/ : `compressHTML` (`true` vs v7 default `'jsx'`), `build.inlineStylesheets: 'auto'` threshold = `assetsInlineLimit`, `build.format`, `trailingSlash`.
- https://api.webstatus.dev/v1/features/has and /popover : Baseline dates and first versions.
- https://www.rfc-editor.org/rfc/rfc6068.html : mailto encoding.
- https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue : issue URL query parameters.
- Repo code read: `src/lib/corpus/*`, `content-core/{root,astro-loader,load}.ts`, `rules/config.ts`, `rules/equite.ts`, `rules/references.ts`, `rules/text/{forbidden,normalize}.ts`, `tests/dist/skeleton.test.ts`, `tests/repo/{ci,astro-config}.test.ts`, `.github/workflows/ci.yml`, fixture `corpus-valide`.

### Secondary (MEDIUM confidence)
- https://developer.mozilla.org/en-US/docs/Web/CSS/:has : performance guidance (anchor + child combinator), unsupported-selector behaviour.
- Search results on popover Baseline status (web.dev, Chrome docs): "newly available", consistent with webstatus.dev.

### Tertiary (LOW confidence)
- Screen-reader behaviour of native popovers (no authoritative matrix found; one project tracker mentions pending VoiceOver/NVDA/JAWS passes).
- Firefox form-state restoration timing (not tested).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependencies; platform support from webstatus.dev.
- Architecture: HIGH, prototyped against the real loader and fixture.
- Pitfalls: HIGH for the eight verified findings; MEDIUM for AT behaviour and non-Chrome engines (only Chrome 156 was available).

**Research date:** 2026-11-03
**Valid until:** 2026-12-03 (Astro/Vite minor releases can change asset inlining and `compressHTML` details; re-run the prototype assertions if Astro is bumped).
