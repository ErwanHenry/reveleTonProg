---
phase: 07-domaine-param-tr-inlining-et-dette
reviewed: 2026-11-07T02:12:22Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - astro.config.mjs
  - config/site.yml
  - deploy/caddy/site.caddy
  - scripts/render-caddy.ts
  - scripts/check-dist.ts
  - scripts/lib/check-dist.ts
  - src/components/BlocSource.astro
  - src/components/EtatVide.astro
  - src/components/LecteurNiveaux.astro
  - src/components/Mesure.astro
  - src/components/OrdreCandidats.astro
  - src/layouts/Base.astro
  - src/lib/corpus/vue.ts
  - src/lib/csp-empreintes.ts
  - src/lib/site-config.ts
  - src/lib/sitemap.ts
  - src/pages/[fichier].xml.ts
  - src/pages/robots.txt.ts
  - src/styles/base.css
  - playwright.config.ts
  - e2e/csp.spec.ts
  - e2e/csp-sans-js.spec.ts
  - e2e/parcours.spec.ts
  - e2e/retour.spec.ts
  - e2e/chemin.ts
  - .gitattributes
  - tests/repo/hote-en-dur.test.ts
  - tests/repo/caddy.test.ts
  - tests/corpus/types-schemas.test.ts
findings:
  critical: 1
  warning: 5
  info: 7
  total: 13
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-07T02:12:22Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

I reviewed the domain parameterisation (site-config, canonical, sitemap, robots, rendered Caddy block), the inlining under a hash-based CSP (astro.config, csp-empreintes, the check-dist rules that replace ADR-037), the debt items (W3 coverage sentence, W4 click path with bfcache, W10 consulted sources, W7 types against schemas) and the new repo guards.

I checked these things by running them, not only by reading:
- Fresh production and preview builds were written to `/tmp` and passed through `check-dist`. Result: 0 errors. The warnings are only the expected provisional ones.
- The meta CSP comes after the order script and before the single `<style>`. Its `script-src` holds `'self'`, the 2 site hashes and the 5 Astro client-directive hashes.
- The inline script bodies match `src/scripts/*.js` byte for byte.
- `/themes/sante/` weighs 180,590 bytes raw and 29,609 bytes gzip.
- `tests/repo/caddy.test.ts`, `hote-en-dur.test.ts`, `types-schemas.test.ts` and `sitemap.test.ts` pass: 66 of 66.

The check-dist replacement is sound. No rule was loosened:
- Inline scripts must match the source files byte for byte, and their hash must be in the CSP.
- `<style>` hashes must be in the CSP.
- `on*`, `style=`, `data:` scripts and every `unsafe-*` token are still refused.
- Directive tokens are checked against a strict allowlist.
- Sitemap paths cannot leave the origin, and the Caddy inputs are validated against injection (domain regex, hash regex, path regex).

The problems are elsewhere:
- **Blocker:** the generated Caddy log block does not enforce the "14 days at most" retention that the block, the drift test and the RUNBOOK all claim.
- The combined header + meta CSP is never exercised in a browser.
- The types-to-schemas drift test misses the most dangerous direction (a field that is non-optional in the type but optional or nullable in the schema).
- The hard-coded-host guard misses percent-encoded copies.
- W10 now shows readers a visible date contradiction in 16 of 34 consulted-source blocks.

## Critical Issues

### CR-01: The access log is not limited to 14 days; size-only rotation keeps IP entries for months

**File:** `scripts/render-caddy.ts:88-95` (rendered in `deploy/caddy/site.caddy:31-38`). The false statement also appears in `tests/repo/caddy.test.ts:137` and `docs/RUNBOOK.md:325`.

**Issue:** The block uses `roll_size 10MiB`, `roll_keep 14` and `roll_keep_for 336h`, with no time-based rotation. Caddy's file writer (lumberjack-style) rotates the **active** file only when it reaches `roll_size`. `roll_keep_for` deletes **rotated** backups by the timestamp in the backup's file name, which is the rotation time, not the age of the entries inside it. One JSON access line is roughly 500 to 700 bytes, so 10 MiB is about 15,000 to 20,000 requests. That is weeks or months of traffic for this pedagogical site before launch traffic grows.

So:
1. Entries stay in `reveletonprog.log` for as long as the file stays under 10 MiB.
2. When it finally rotates, the backup holds entries up to N days old and survives another 14 days.

The comment "Journal d'accès : 14 jours au plus" and the RUNBOOK sentence "Le journal d'accès est gardé 14 jours" are therefore false. The mentions légales will copy that duration (RUNBOOK step 4, line 316), so this is a privacy promise to visitors (masked IPs are still personal data under the GDPR (RGPD) when combined with time and URL) that the configuration does not keep. The drift test pins the three directives, so it locks the wrong policy in place.

**Fix:** Make rotation time-based and test that, not only the keep counts. Either:
```text
		output file /var/log/caddy/reveletonprog.log {
			roll_interval 24h      # if the caddy:2-alpine version in use supports it (check with caddy validate in Phase 8)
			roll_keep_for 336h
			roll_keep 15
		}
```
or keep Caddy's writer and add a daily host-side rotation on the mounted `/var/log/caddy` (for example `logrotate` with `daily`, `rotate 14`, `maxage 14`, `copytruncate`), documented in the RUNBOOK.

Until one of these is verified, reword the comment, the test title and RUNBOOK:325 to say "rotated files kept 14 days", and pin the rotation-interval directive in `caddy.test.ts`.

## Warnings

### WR-01: The no-User-Agent / masked-IP policy only covers the access logger; Caddy's error and default logs stay unfiltered

**File:** `scripts/render-caddy.ts:88-103`

**Issue:** The Caddyfile `log` directive configures the **access** logger only (`http.log.access.*`). Handler errors (`http.log.error`, emitted for 5xx) and the default runtime logger (TLS/ACME, `http.stdlib`) go to the default log: the container's stderr, which Docker's `json-file` driver keeps with no size or age limit by default. These entries can carry the full remote address and the request headers (User-Agent, and Referer from external sites), without `ip_mask` or `headers delete`. The block and the RUNBOOK present the log policy as complete ("en-têtes de requête supprimés").

**Fix:** In Phase 8, inspect the existing global options of the shared Caddyfile. Either:
- route `http.log.error` through the same filtered `format filter` (a global `log` block with `include http.log.error` and the same filters and retention), or
- set the default logger level to WARN with a bounded Docker log driver (`--log-opt max-size=10m --log-opt max-file=3`).

Add this to the "Hypothèses à confirmer en Phase 8" list in RUNBOOK:327-332. Until then, narrow the comment at render-caddy.ts:88 to "journal d'accès".

### WR-02: No test ever applies the header CSP that is said to protect the order script

**File:** `e2e/csp.spec.ts:25-45`, `e2e/csp-sans-js.spec.ts:17-27`, `playwright.config.ts:21`

**Issue:** ADR-056 says the meta CSP does not govern `ordre.js` (it comes before the meta) and that the header in `site.caddy` does. But `e2e/serveur.ts` sends no CSP header, so in every e2e run the order script runs under no policy at all. The `data-ordre-js` assertion at csp.spec.ts:40 is therefore true by construction.

`tests/repo/caddy.test.ts` only compares strings. Nothing shows that the header plus meta intersection behaves as argued:
- the header has no `default-src` and no `style-src`;
- the hashed `<style>` survives both policies;
- the order script passes the header.

A future change, such as adding `default-src` to the header or moving the niveau script, would pass `npm test` and the e2e suite and break only on the server.

**Fix:** Have `e2e/serveur.ts` optionally send the header that `renderCaddy` produces, for example by exporting a `cspEnTete(empreintes)` helper from `scripts/render-caddy.ts` and using it in both places. Then run `csp.spec.ts` and `csp-sans-js.spec.ts` with it enabled, so the browser enforces the real combined policy. Add one negative case: a mutated `ordre.js` body served with the header must raise a `script-src` violation.

### WR-03: types-schemas does not catch a field that is non-optional in the type but optional or nullable in the schema

**File:** `tests/corpus/types-schemas.test.ts:171-189`

**Issue:** Today `comparer()` reports three cases:
- required in the schema but absent or optional (`?`) in the type;
- in the type but unknown to the schema;
- known to the schema but absent from the type.

It never reports the reverse requiredness case: a property declared **non-optional** in `types.ts` while the schema no longer lists it in `required`, or allows `null`. That is exactly the drift `as unknown as` hides, and the one that crashes a page at runtime (for example `source.url.startsWith` on `undefined`). D-14 asks for both directions "pour les champs lus par les pages".

Example: remove `"url"` from `source.schema.json#/required` and leave `url: string;`. The test still passes. The repo is clean today (I checked all 13 interfaces), so this is a gap in the guard, not a current bug. Two smaller gaps:
- `required` arrays inside `allOf[*]` are not merged into `requises`;
- properties whose definition is a `$ref` to an enum never get their union compared.

**Fix:**
```ts
const requisesToutes = new Set([
  ...requises,
  ...((Array.isArray(s['allOf']) ? s['allOf'] : []) as Json[]).flatMap((b) => (Array.isArray(b['required']) ? (b['required'] as string[]) : [])),
]);
for (const [cle, p] of type) {
  if (!p.optionnelle && connues.has(cle) && !requisesToutes.has(cle))
    ecarts.push(`${nom}.${cle} : non optionnelle dans le type, pas requise par ${emplacement}`);
  const def = objet(connues.get(cle));
  const nullable = JSON.stringify(def?.['type'] ?? '').includes('null');
  if (nullable && !typeTexte(cle).includes('null')) ecarts.push(`${nom}.${cle} : null permis par le schéma, absent du type`);
}
```
Conditionally required fields (`enfant` and `aine` only when `publie`) stay `?` in the type, so they are unaffected. Add one fault-injection case for each new rule.

### WR-04: The hard-coded-host guard misses percent-encoded copies of the domain (encoded mailto links, encoded URLs)

**File:** `tests/repo/hote-en-dur.test.ts:49`

**Issue:** The lookbehind `(?<![a-z0-9-])` runs with the `i` flag. The hex digit of a percent escape therefore counts as a host character and suppresses the match. I checked with the exported function: `mailto:contact%40exemple.test` gives 0 hits and `https%3A%2F%2Fexemple.test%2F` gives 0 hits, while `contact@exemple.test` gives 1.

Encoded forms are what `lienMailto` and URL-building code produce, so they are the most likely hard-coded copies in tests and fixtures (for example an expected `href` string in a `.cas.ts`). ADR-053's promise that a domain change leaves "aucune copie périmée" does not hold for them.

**Fix:** Scan a decoded view of each line as well:
```ts
const vues = [texte, texte.replace(/%[0-9a-f]{2}/gi, (h) => { try { return decodeURIComponent(h); } catch { return ' '; } })];
if (vues.some((v) => { motif.lastIndex = 0; return motif.test(v); })) out.push(...);
```
Or replace `%XX` with a space before testing. Add `contact%40exemple.test` and `https%3A%2F%2Fexemple.test` to the "signale" cases.

### WR-05: W10 now shows readers a contradiction: "verified on 3 Nov" next to sources "consulted on 4 Nov"

**File:** `src/components/EtatVide.astro:16-33` (data rule missing from `src/lib/content-core/rules/`)

**Issue:** D-13 now prints each consulted source's own `date_consultation` under the sentence "Non précisé dans les sources consultées le <verifie_le>". In the fresh preview build, **16 of 34** consulted-source blocks list a source consulted *after* the case's `verifie_le`. For example, `themes/travail/`: "Non précisé dans les sources consultées le 3 novembre 2026", then "Consultée le 4 novembre 2026" twice.

The reader is told the check happened before the sources were read. That undermines the sourcing promise (core value: every statement tied to a dated primary source). Nothing in the validator compares `verifie_le` with the dates of `sources_consultees`. The data is not editable in this phase, but the rendering made the inconsistency public, and production will show it as soon as the themes are published.

**Fix:** Add a validator rule (content-core, which runs in the CI `validate` step) that fails when `verifie_le < max(date_consultation of sources_consultees)`, then fix the 16 cases in a content PR. Until then, consider rendering "Vérifié le …" from `max(verifie_le, dates des sources)`. Only do that if the editorial owner agrees, because it changes what the date means.

## Info

### IN-01: The meta CSP is broader than the two site scripts ('self' + 5 Astro client-directive hashes), and check-dist allows any hash

**File:** `astro.config.mjs:30-35`, `scripts/lib/check-dist.ts:147,401`

**Issue:** The built meta `script-src` is `'self'`, the 2 site hashes and 5 hashes of Astro's island directive scripts (`settings.clientDirectives`, always added by `trackScriptHashes`). check-dist checks inclusion, not equality (documented in ADR-056). Until the Phase 8 header is live, and for the public `site-preview` artifact, the meta alone permits those extra known scripts and any same-origin script file.

**Fix:** None is required. Optionally add a check-dist rule that every hash in `script-src` is either a `src/scripts` hash or one of Astro's known directive hashes, so that an unexpected hash fails.

### IN-02: The `loadSiteConfig` memo skips the deployment guard on the second read (already deferred)

**File:** `src/lib/site-config.ts:46-48`

**Issue:** The function returns the memoized config before the `deploiement` check. A process that reads with `{}` and then with `RTP_DEPLOIEMENT=1` does not throw. No real consumer does this today (deferred-items.md, 07-06), but it is a latent fail-open in a guard.

**Fix:** Run the deployment check on the memoized value too: move the `if (deploiement) {...}` block into a helper and call it on both paths.

### IN-03: `list-style: none` on the consulted-sources list removes list semantics in WebKit/VoiceOver

**File:** `src/styles/base.css:427-431`, `src/components/EtatVide.astro:27`

**Fix:** Add `role="list"` to the `<ul>` in EtatVide.astro, or keep the markers.

### IN-04: Only `.invalid` counts as provisional; `.test`, `.example`, `.localhost` would pass the deployment guard

**File:** `src/lib/site-config.ts:80`, `scripts/lib/check-dist.ts:267`

**Fix:** Treat all RFC 2606/6761 reserved TLDs (`invalid`, `test`, `example`, `localhost`) as provisional, in both places.

### IN-05: `render-caddy` refuses to render under `RTP_DEPLOIEMENT=1` when only the contact is provisional, although the contact is not in the block

**File:** `scripts/render-caddy.ts:148`

**Fix:** Read with `{}` and check `domaineProvisoire` under deployment explicitly, as `check-dist.ts` does. Otherwise, document the coupling in USAGE.

### IN-06: The Docker assumptions do not say that the `current` symlink must be relative

**File:** `scripts/render-caddy.ts:13-16`, `docs/RUNBOOK.md:328`

**Issue:** `root * /srv/reveletonprog/current` is resolved inside the container. An absolute host-path symlink (`current -> /home/.../releases/<sha>`) breaks unless host and container paths are identical. A `www.` record missing from DNS would also make Caddy retry ACME for `www.<domaine>` again and again.

**Fix:** Add both to RUNBOOK's "Hypothèses à confirmer en Phase 8": `ln -sfn releases/<sha> current` (relative), and a `www` DNS record before applying the block.

### IN-07: Adding a 404 page later would be required in the sitemap and given a canonical URL

**File:** `scripts/lib/check-dist.ts:484-486,647-652`, `src/lib/sitemap.ts:13`

**Issue:** Every production `.html` file is added to `canoniquesAttendues`, so a future `404.html` would need a `<link rel="canonical">` and a `<loc>`. Both are wrong for an error page.

**Fix:** Exclude `404.html` from the canonical and sitemap expectations when one is added (the comment says there is none today).

---

_Reviewed: 2026-11-07T02:12:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
