---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - .github/workflows/ci.yml
  - astro.config.mjs
  - config/site.yml
  - package.json
  - scripts/check-dist.ts
  - scripts/lib/check-dist.ts
  - scripts/lib/html.ts
  - src/components/BadgeBrouillon.astro
  - src/components/Cellule.astro
  - src/components/ConcerneAine.astro
  - src/components/EtatVide.astro
  - src/components/LecteurNiveaux.astro
  - src/components/Mesure.astro
  - src/components/MotsExpliques.astro
  - src/components/OrdreCandidats.astro
  - src/components/StatutCandidat.astro
  - src/components/TexteEnfant.astro
  - src/components/TuileTheme.astro
  - src/layouts/Base.astro
  - src/lib/content-core/rules/equite.ts
  - src/lib/content-core/rules/references.ts
  - src/lib/content-core/rules/text/normalize.ts
  - src/lib/corpus/enfant.ts
  - src/lib/corpus/index.ts
  - src/lib/corpus/signalement.ts
  - src/lib/corpus/types.ts
  - src/lib/corpus/vue.ts
  - src/lib/site-config.ts
  - src/pages/candidats/[id].astro
  - src/pages/candidats/index.astro
  - src/pages/index.astro
  - src/pages/robots.txt.ts
  - src/pages/themes/[id].astro
  - src/pages/themes/index.astro
  - src/scripts/niveau.js
  - src/scripts/ordre.js
  - src/styles/*.css
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 37 (scripts/lib/html.ts and references.ts only skimmed via their callers)
**Status:** issues_found

## Summary

No XSS or HTML injection path found. No `set:html`, `innerHTML` or dynamic attribute name exists. All YAML text goes through Astro's escaping. Glossary markers are rendered as JSX segments. Every `href` fed by content (`source.url`, `wayback_url`, `statut.source.url`) is typed `https-url` in the schema. Mailto and GitHub query strings use `encodeURIComponent`. Only two localStorage keys are used (`rtp:niveau`, `rtp:ordre`). All scripts and styles are external, so a CSP of `script-src 'self'; style-src 'self'` is compatible. Radio selectors keep native focusability, with forced-colors and focus-visible rules. `prefers-reduced-motion` is not needed, since the only animation is a 0s visibility flip.

The real defects sit in two places. First, the view-model uses two different notions of "current status" (production perimeter vs. displayed status). Second, `check-dist` and CI have blind spots that match exactly the guarantees they claim.

## Warnings

### WR-01: Candidate perimeter uses unreviewed statuses in production, but the displayed status uses reviewed ones only (contradictory output)

**File:** `src/lib/corpus/vue.ts:206-216` (also `scripts/lib/check-dist.ts:92-103`, `src/lib/content-core/rules/equite.ts:23-31`)
**Issue:** `perimetre` is computed from `statutRecent = statutLePlusRecent(c.statuts)`, which includes `brouillon` statuses. The displayed status (`statutAffiche`) filters to `relu`/`publie` in production. Two cases follow.
- A candidate has `declare` (relu) and a newer `renonce` (brouillon). Production drops the candidate from the grid and counts them in "autres personnalités", yet their page and list row still say "Candidature déclarée". They are not listed under "Ne se présentent pas", because that list uses `statutAffiche`.
- A candidate has `renonce` (relu) and a newer `declare` (brouillon). They appear in the equity grid, and a cell is built for them, while their page says "Ne se présente pas".

An unreviewed draft therefore changes who appears on published theme pages. `cellulesAttendues` in check-dist mirrors the same logic, so it cannot catch this. The A6 "fail-closed" choice makes sense for the equity validator, but the display layer should not act on it silently.
**Fix:** Compute `perimetre` from `statutAffiche` in production (null means outside the perimeter). Keep the draft-inclusive rule only for the validator, and have the validator raise an error when the two disagree. Make `cellulesAttendues` use the same reviewed-only definition.
```ts
const retenu = production ? (statutAffiche(c, mode) ?? undefined) : statutRecent;
perimetre: retenu !== undefined && PERIMETRE_EQUITE.includes(retenu.code),
```

### WR-02: Statuses at `relu` are shown as facts in production, while themes and measures require `publie`

**File:** `src/lib/corpus/vue.ts:174-177` and `src/lib/corpus/vue.ts:357` (`badgeStatut`), `src/components/StatutCandidat.astro:22`
**Issue:** Production hides measures and themes unless `statut_relecture === 'publie'`. Candidate statuses are shown from `relu` onward, with no badge (`badgeStatut` is non-null only for `brouillon`). `BADGES.relu` ("relu, pas encore publié") exists but is never applied to statuses. This is the publication gate for the most sensitive claim, "candidature déclarée / ne se présente pas". `check-dist` cannot detect it either, because no `data-statut-relecture` is emitted on the status.
**Fix:** In production, filter statuses to `publie`, as for the other collections. If `relu` is deliberately allowed, document it as an ADR and make `check-dist` assert it.

### WR-03: A provisional `.invalid` contact ships to production without any gate

**File:** `src/lib/site-config.ts:56-63`, `config/site.yml:9`, `src/components/Mesure.astro:21,63`
**Issue:** `contactProvisoire` is computed but only triggers a `console.warn`. A production build and `check-dist` both pass with every "Signaler une erreur (courriel)" link pointing to `contact@domaine-a-definir.invalid`. `check-dist` skips `mailto:` entirely. That is a dead reporting channel on a site whose credibility rests on correction.
**Fix:** In production, throw when `contactProvisoire` is true, or add a `check-dist` code (e.g. `CONTACT_PROVISOIRE`) that flags `mailto:*.invalid` in production only. Unlike a build-time throw, the check-dist code keeps preview and CI-fixture builds working.

### WR-04: CI only builds and checks the fixture corpus, never the real content, and never a preview build

**File:** `.github/workflows/ci.yml:94-97`
**Issue:** `validate` and `migrate` run against both the fixture corpus and `RTP_CONTENT_ROOT=.`. The `Construire le site` and `check-dist` steps have no `RTP_CONTENT_ROOT`, so they run on `tests/fixtures/corpus-valide` (`DEFAULT_CONTENT_ROOT`). Several view-model failures only happen at build time, for example `construireCorpus` throwing "aucune mesure visible ni case de couverture", or unresolved glossary ids. They would first appear on the real corpus at deploy. The `PREVIEW_INDEXABLE` and `robots.txt` branches of check-dist are never run in CI either.
**Fix:** Add a second build and check-dist pass with `RTP_CONTENT_ROOT: "."`. Add a third with `RTP_MODE=preview` and `check-dist --mode preview` into a separate dist directory (e.g. `astro build --outDir dist-preview`).

### WR-05: `check-dist` link and CSP checks have false negatives

**File:** `scripts/lib/check-dist.ts:243-269` (link checks), `:228-241` (script/style checks)
**Issue:**
- In `<a href>`, schemes such as `data:`, `vbscript:`, `ftp:`, `file:` and `blob:` fall through every branch. They match `SCHEMA`, so the final `else if (!SCHEMA.test(href))` is skipped and nothing is reported.
- `nettoyerUrl` only strips tab, CR, LF and `trim()` whitespace. Browsers also strip leading C0 controls, so `\u0001javascript:` escapes the `^javascript:` test.
- Inline event handler attributes (`onclick=`, `onload=`…), `<meta http-equiv="refresh">` and `<base href>` are not checked. They would violate the `script-src 'self'` CSP that the `SCRIPT_EN_LIGNE` check is meant to protect.

Current content cannot produce these (https-only schema, no handlers in templates), so this is robustness of the guard, not a live bug.
**Fix:** Allow-list instead of block-list. After `nettoyerUrl`, also strip `[\u0000- ]` at the start. Any `href` whose scheme is not `https:`, `mailto:` or relative gets `LIEN_EXTERNE_NON_PROTEGE`. Add `n.attrs` keys matching `/^on/i` to `SCRIPT_EN_LIGNE`.

### WR-06: Forbidden-word scan ignores attributes and exempts whole `[data-citation]` subtrees by attribute presence

**File:** `scripts/lib/check-dist.ts:331-336`
**Issue:** `texteHors` collects text nodes only. Words in `title=`, `aria-label=`, `alt=`, `<meta name="description" content>` and `<meta property>` are never checked. Page titles and descriptions are built from content (`nom`, `theme.nom`), so they could carry a forbidden word. Separately, anything carrying a `data-citation` attribute (including `source.titre` in a `<span data-citation>`) is exempt. The `source.titre` span is not a verbatim quote of the candidate's programme, so the exemption is broader than the stated rule (apply the rule to the four rédactions + titre, not to the citation).
**Fix:** Also scan `title`, `aria-label`, `alt` and `meta[name=description]@content`. Restrict the exemption to `blockquote[data-citation]`, and treat `source.titre` as a separate, deliberate allowance with its own test.

## Info

### IN-01: Footer string splits a sentence across a `<span>` and a raw newline

**File:** `src/layouts/Base.astro:58-59`
**Issue:** `<p><span>Ce site</span>` followed by a newline and `n'utilise...` relies on the newline surviving `compressHTML` to supply the space. `ESPACE_PERDU` exists because of exactly this kind of fragility. Also, the claim "n'appelle aucun service extérieur" sits next to external outbound links (GitHub issues, Wayback). The wording is accurate for page loads but may be read as broader.
**Fix:** Write the sentence in one text node, and say "ne charge aucune ressource extérieure".

### IN-02: `lienMailto` and `lienIssue` trust `contact` and `depot` verbatim

**File:** `src/lib/corpus/signalement.ts:9-12,15-19`, `src/lib/site-config.ts:25-26`
**Issue:** `RE_CONTACT` accepts `?`, `&`, `#`, `%` (e.g. `a@b.fr?bcc=x`) and `RE_DEPOT` accepts `../..`. The file is trusted repo config, so the impact is low. A mistaken commit could still alter the recipient set or the target URL.
**Fix:** Tighten `RE_CONTACT` to `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`. Reject `.` and `..` segments in `RE_DEPOT`.

### IN-03: Popover definitions are `display:none` when closed, contradicting the "found in reading order" comment

**File:** `src/components/TexteEnfant.astro:3-5`, `src/styles/enfant.css`
**Issue:** The header comment says screen-reader users find the definition in reading order. A closed popover is removed from the accessibility tree, so the definition is reachable only after activating the button or through the `details` list. The `Mots expliqués` list is a valid second path, but it is also `display:none` outside the "Pour les enfants" level, which is the only level where the words appear, so it works. The comment is inaccurate rather than the behaviour.
**Fix:** Correct the comment, and verify with VoiceOver/NVDA that opening the popover announces its content (consider `role="note"` or `aria-live` on the opened popover).

### IN-04: Random-order mode cannot re-draw by re-selecting the option

**File:** `src/scripts/ordre.js:25-31`, `src/components/OrdreCandidats.astro:11`
**Issue:** The status message says "nouveau tirage", but clicking the already-selected "Ordre aléatoire" radio fires no `change` event. The only reshuffle is by toggling to alphabetical and back. Shuffle uses an unbiased rejection sampler, so the neutrality is fine.
**Fix:** Listen to `click` on the aléatoire input (or add a "Nouveau tirage" button) so re-selecting reshuffles.

### IN-05: Duplicate coverage cases silently overwrite each other

**File:** `src/lib/corpus/vue.ts:253-258`
**Issue:** `cases.set(cas.candidat, cas)` across several couverture files for the same theme lets the last one win with no diagnostic. The equity rule counts a candidate as covered if any case exists and does not detect duplicates or conflicting states.
**Fix:** Throw in `construireCorpus` (production) if a `candidat` appears twice for a theme, and add an `EQUITE_COUVERTURE_DOUBLON` rule in the validator.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
