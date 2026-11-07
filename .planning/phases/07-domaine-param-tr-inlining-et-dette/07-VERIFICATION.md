---
phase: 07-domaine-param-tr-inlining-et-dette
verified: 2026-11-07T02:51:51Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "The generated Caddy block is accepted by Caddy (`caddy validate`, including `roll_at`, `ip_mask`, `request>headers delete`) and applied without cutting other sites"
    addressed_in: "Phase 8"
    evidence: "Phase 8 SC1: « le bloc Caddy appliqué par `caddy validate` puis `reload` n'a coupé aucun autre site du VPS »; 07-VALIDATION Manual-Only row 1"
  - truth: "Header CSP and page meta enforced together behind the real server (zero violation)"
    addressed_in: "Phase 8"
    evidence: "Phase 8 SC1: « Le site répond en HTTPS ... avec en-têtes de sécurité »; 07-VALIDATION Manual-Only row 2. Phase 7 already proves it in e2e with the same header served by e2e/serveur.ts (WR-02)"
  - truth: "8 coverage cases dated 2026-11-03 list a source consulted on 2026-11-04 (WR-05), shown side by side by the new W10 block"
    addressed_in: "Phase 9"
    evidence: "Phase 9 SC1: Erwan rereads a theme and sets relecteur and date; COUVERTURE_VERIFIEE_AVANT_SOURCE warning (non-blocking) and RUNBOOK « Relire les dates de couverture » are in place. Editorial content, not Phase 7 code"
---

# Phase 7: Domaine paramétré, inlining et dette Verification Report

**Phase Goal:** Le site se construit pour n'importe quel domaine déclaré une seule fois, charge vite avec CSS et scripts dans la page sous une CSP stricte, et les dettes de l'audit v1.0 qui ne dépendent d'aucun serveur sont soldées.
**Verified:** 2026-11-07T02:51:51Z
**Status:** passed
**Re-verification:** No (initial verification)

All evidence below comes from commands I ran myself on main at 1c2ffd4 (Node 24 via `fnm exec --using=24`), from builds in /tmp, and from a throwaway copy of the repository with a different domain. SUMMARY claims were not used as evidence.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Changer le domaine dans `config/site.yml` modifie l'URL canonique de chaque page, `sitemap.xml`, `robots.txt` et le bloc Caddy généré ; un test échoue si un nom d'hôte est écrit en dur ailleurs. | ✓ VERIFIED | Own experiment: copy of the repo at /tmp/v07-copie with `domaine: verif-domaine.fr`, real production build. Result: 65/65 pages have a canonical on `https://verif-domaine.fr/...`, `sitemap.xml` has 65 `<loc>` on the new host, `robots.txt` ends `Sitemap: https://verif-domaine.fr/sitemap.xml`, check-dist 0 errors. The only remaining `domaine-a-definir` strings are the contact address (a separate field). `render-caddy.ts --sortie` gives `verif-domaine.fr {` and `www.verif-domaine.fr { redir https://verif-domaine.fr{uri} }`. `render-caddy.ts --check` exits 1 (stale block detected). Injecting `https://verif-domaine.fr/themes/` into `src/lib/sitemap.ts` makes `tests/repo/hote-en-dur.test.ts` fail (`src/lib/sitemap.ts:45`). On the real repo the guard passes. |
| 2 | Une build sous `RTP_DEPLOIEMENT=1` avec le domaine provisoire `.invalid` échoue avec un message clair, comme pour le contact provisoire. | ✓ VERIFIED | `RTP_DEPLOIEMENT=1 astro build --outDir /tmp/v07-dep` exits 1 with no dist written. Message: « config/site.yml : domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire ... ». `RTP_DEPLOIEMENT=1 check-dist` on a clean production dist: `DOMAINE_PROVISOIRE` as an error, 5 errors, exit 1. Without the variable it is a warning, exit 0. The guard runs on every call, even when the config is memoized (`src/lib/site-config.ts` `verifierDeploiement`, IN-02 fixed). |
| 3 | Chaque page contient son CSS et ses scripts de niveau et d'ordre ; check-dist prouve que chaque script en ligne est identique à sa source et que son empreinte sha256 figure dans la CSP, sans `unsafe-inline` sur les scripts ; le site reste complet avec JS désactivé. | ✓ VERIFIED | No `_astro/` in /tmp/v07-prod or /tmp/v07-prev. My own byte check (/tmp/v07-scripts/ident.mjs) on 68 preview and 65 production pages found 0 problems. The first `<script>` of `<head>` equals `src/scripts/ordre.js` byte for byte (1722 B). The `<script>` right after the level `</fieldset>` equals `niveau.js` (923 B) on 63 and 60 pages. Every inline script hash is in the meta. No `unsafe-*`, no `style=` attribute, no external `<script src>`. check-dist on both real builds: 0 errors. Dist mutation cases (space in the level script, one character in `<style>`, hash removed, `'unsafe-inline'` added) pass in `npm test`. JS off: CI run 42330177523 is green, e2e m1 259 and reel 1177 tests including `sans-js` and `csp-sans-js`. Heaviest page `/themes/sante/` (preview): 180,629 B raw, 29,626 B gzip, under the 500 KB / 100 KB budgets. |
| 4 | Un test navigateur suit le parcours par clics et prouve que le niveau de lecture est gardé d'une page à l'autre et après un retour arrière. | ✓ VERIFIED | I ran `node scripts/e2e.ts --jeu m1 -- e2e/csp.spec.ts e2e/parcours.spec.ts e2e/retour.spec.ts`: 21 passed. `e2e/chemin.ts` clicks hall, nav « Thèmes », a theme link and a cell link to a candidate page, and asserts that Aîné is still checked. `parcours.spec.ts` (project `parcours`, `channel: 'chromium'`, bfcache enabled) asserts `pageshow` gives `[false, true]`, the JS marker survives and Enfant is checked. Its mutation proof (handler removed from a dist copy) shows Aîné, so the test bites. `retour.spec.ts` covers a back navigation without bfcache. |
| 5 | En preview, la phrase de couverture ne présente plus de brouillons comme des positions publiées ; les « Sources consultées » des cases vides donnent lien, date et extrait archivé ; un test compare les types de vue aux schémas JSON. | ✓ VERIFIED | Real preview build: santé reads « 27 candidats sur 37 ont une position rédigée mais pas encore publiée, 3 n'ont rien de précisé..., 7 n'ont pas publié de programme. » Travail and europe-et-monde read the same way. Nothing in the real corpus is published, and no sentence claims a « position publiée ». In production the clause is unchanged when `enAttente === 0` (`vue.ts:204`; `vue.test.ts` pins the exact sentences). W10 (`EtatVide.astro` → `BlocSource.astro`, `role="list"`) renders the title, « Consultée le `<time>` », « Lire le document original », the Wayback copy and « Extrait archivé, empreinte sha256 df2c88bc0265 » (GitHub link). W7: `tests/corpus/types-schemas.test.ts` « aucune dérive sur les vrais fichiers (13 interfaces, 7 unions) » plus fault injections (WR-03), all passing. |

**Score:** 5/5 truths verified

Plan-level must-haves (07-01 to 07-08) were checked as supporting detail. All hold: a single CSP meta in `<head>`, check-dist codes `SCRIPT_EN_LIGNE`, `SCRIPT_SANS_EMPREINTE`, `STYLE_SANS_EMPREINTE`, `CSP_ABSENTE`, `CSP_TROP_PERMISSIVE`, `CANONIQUE_*`, `SITEMAP_INCOHERENT`, `ROBOTS_SANS_SITEMAP`, `PREVIEW_INDEXABLE`, `DOMAINE_PROVISOIRE` (`scripts/lib/check-dist.ts:31-66,350-425,480-665`), preview with no canonical, no sitemap and `Disallow: /` (checked on /tmp/v07-prev), the Caddy header CSP with exactly the two script hashes, `frame-ancestors 'none'` and no `default-src`, the log with IP masked to /24 and /48 and headers deleted, and the ADRs and RUNBOOK.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `caddy validate` of the generated block (`roll_at` needs Caddy >= 2.11, `ip_mask`, `request>headers delete`) | Phase 8 | Phase 8 SC1; RUNBOOK « Bloc Caddy (Phase 8) » list |
| 2 | Header CSP and meta together behind the real server | Phase 8 | Phase 8 SC1; already proven in e2e with the same header (`cspEnTete` shared by `render-caddy.ts` and `e2e/serveur.ts`) |
| 3 | WR-05: 8 coverage cases with `verifie_le` earlier than a listed source's `date_consultation` | Phase 9 | Phase 9 SC1 (theme reread by Erwan); non-blocking warning `COUVERTURE_VERIFIEE_AVANT_SOURCE` makes them visible in `npm run validate` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/csp-empreintes.ts` | single hash helper | ✓ VERIFIED | `empreinteCsp`, `scriptsEnLigne`. Imported by astro.config.mjs, check-dist and render-caddy |
| `astro.config.mjs` | inlineStylesheets always, assetsInlineLimit 0, security.csp with hashes, `site` from config | ✓ VERIFIED | Read directly. `site: https://${domaine}` from `loadSiteConfig(racine)` |
| `src/lib/site-config.ts` | `domaine`, `domaineProvisoire`, deployment guard | ✓ VERIFIED | Strict host regex, `TLD_PROVISOIRES`, guard on every call |
| `src/lib/sitemap.ts`, `src/pages/[fichier].xml.ts`, `src/pages/robots.txt.ts` | pure sitemap and robots, production only | ✓ VERIFIED | Built output checked in both modes |
| `src/layouts/Base.astro`, `src/components/LecteurNiveaux.astro` | `?raw` + `<script is:inline set:html>`, canonical in production only | ✓ VERIFIED | Placement confirmed on built pages |
| `scripts/lib/check-dist.ts` | hash rules and domain rules | ✓ VERIFIED | Implementation read; bites on mutations (npm test) and under RTP_DEPLOIEMENT=1 (CLI run) |
| `src/components/BlocSource.astro`, `EtatVide.astro`, `Mesure.astro` | shared source block | ✓ VERIFIED | Both callers use `BlocSource`; rendered output checked |
| `src/lib/corpus/vue.ts` | `enAttente` and an honest preview sentence | ✓ VERIFIED | Rendered sentence checked on 3 preview themes |
| `scripts/render-caddy.ts`, `deploy/caddy/site.caddy` | pure renderer, committed block, drift test | ✓ VERIFIED | `--check` up to date on the repo, stale on the changed-domain copy |
| `tests/repo/hote-en-dur.test.ts` | hard-coded host guard | ✓ VERIFIED | Fault injection bites (own run) |
| `tests/corpus/types-schemas.test.ts` | W7 drift test | ✓ VERIFIED | Passing, 13 interfaces and 7 unions |
| `e2e/csp.spec.ts`, `csp-sans-js.spec.ts`, `parcours.spec.ts`, `retour.spec.ts`, `playwright.config.ts` | browser proofs | ✓ VERIFIED | 21/21 locally on m1; full suite green in CI |
| `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, `README.md` | ADR-053, ADR-056 (replaces ADR-037), ADR-051 note, procedures | ✓ VERIFIED | ADR-037 marked « remplacée ». ADR-056 « Limite » says the header covers the order script, not the meta. ADR-051 note dated 2026-11-07. RUNBOOK « Changer de domaine », codes table, e2e notes and astro dev restart are present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| astro.config.mjs | csp-empreintes.ts | `scriptsEnLigne(racine).map(s => s.empreinte)` | WIRED | Meta hashes on built pages equal the source hashes |
| astro.config.mjs | site-config.ts | `loadSiteConfig(racine).domaine` → `site` | WIRED | Domain change propagates (own experiment) |
| check-dist.ts | csp-empreintes.ts | `empreinteCsp(corps)`, sources from src/scripts | WIRED | Mutations detected |
| scripts/check-dist.ts | site-config.ts | `loadSiteConfig(projectRoot, {})` + explicit deployment check | WIRED | DOMAINE_PROVISOIRE warning, then error under RTP_DEPLOIEMENT=1 |
| render-caddy.ts | csp-empreintes.ts, site-config.ts | hashes and domain | WIRED | Header hashes equal the meta's site hashes; domain follows the config |
| e2e/serveur.ts | render-caddy.ts | `cspEnTete` | WIRED | csp.spec checks the header on every page, and the tampered order script is blocked |
| EtatVide.astro / Mesure.astro | BlocSource.astro | component | WIRED | Rendered |
| themes/[id].astro | vue.ts | `phraseCouverture(vue.couverture)` | WIRED | Rendered sentence |
| playwright.config.ts | parcours.spec.ts | project `parcours`, `channel: 'chromium'`, `ignoreDefaultArgs` | WIRED | `persisted === true` asserted |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Theme page coverage sentence | `vue.couverture` (`mesures`, `enAttente`) | `getCorpus()` cells filtered on `statut_relecture === 'publie'` | Yes (27/24/22 pending on the real preview) | ✓ FLOWING |
| EtatVide « Sources consultées » | `cellule.sourcesConsultees` | coverage YAML + source YAML | Yes (titles, dates, Wayback, sha256 rendered) | ✓ FLOWING |
| Canonical, sitemap, robots | `Astro.site` / `context.site` | `config/site.yml` | Yes (changes with the domain) | ✓ FLOWING |
| Caddy block | `domaine`, script hashes | `config/site.yml`, `src/scripts/*.js` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit, repo and dist suite | `npm test` | 1847 pass, 0 fail, 0 skipped | ✓ PASS |
| Type check | `npm run check` | 0 errors, 0 warnings, 0 hints | ✓ PASS |
| Caddy drift | `node scripts/render-caddy.ts --check` | « à jour », exit 0 | ✓ PASS |
| Production validate | `npm run validate -- --mode production` | 391 files, 0 errors, 25 warnings | ✓ PASS |
| Real production build + check-dist | `astro build --outDir /tmp/v07-prod`; `check-dist --mode production` | 0 errors, 5 warnings (provisional domain, contact, host) | ✓ PASS |
| Real preview build + check-dist | `RTP_MODE=preview ...`; `check-dist --mode preview` | 0 errors, 35 warnings | ✓ PASS |
| Deployment build refuses .invalid | `RTP_DEPLOIEMENT=1 astro build` | exit 1, message names config/site.yml | ✓ PASS |
| check-dist under deployment | `RTP_DEPLOIEMENT=1 check-dist` | DOMAINE_PROVISOIRE error, exit 1 | ✓ PASS |
| Domain change end to end | copy with `verif-domaine.fr`, build, render | 65 canonicals, sitemap, robots, Caddy on the new host | ✓ PASS |
| Hard-coded host guard bites | injected host in copy, `node --test tests/repo/hote-en-dur.test.ts` | 1 fail at `src/lib/sitemap.ts:45` | ✓ PASS |
| Inline identity + hashes | `/tmp/v07-scripts/ident.mjs` on both dists | 0 problems on 68 + 65 pages | ✓ PASS |
| Targeted e2e | `node scripts/e2e.ts --jeu m1 -- e2e/csp.spec.ts e2e/parcours.spec.ts e2e/retour.spec.ts` | 21 passed | ✓ PASS |
| Full e2e (not rerun, per instructions) | CI run 42330177523 on 710f1f4 | m1 259 passed, reel 1177 passed, all 3 jobs success | ✓ PASS |

### Probe Execution

Step 7c: not applicable. The phase declares no `scripts/*/tests/probe-*.sh` and is not a migration phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HEB-05 | 07-04, 07-06, 07-07 | Domain declared once, feeds site, canonical, sitemap, robots, Caddy; test refuses a hard-coded host | ✓ SATISFIED | Truth 1 |
| HEB-06 | 07-04, 07-06 | `.invalid` fails the build under RTP_DEPLOIEMENT=1 | ✓ SATISFIED | Truth 2 |
| PERF-01 | 07-01, 07-03, 07-05, 07-07 | Inline CSS and scripts, sha256 CSP without unsafe-inline, check-dist proves identity and hash | ✓ SATISFIED | Truth 3 |
| DETTE-01 | 07-02 | W3 preview sentence | ✓ SATISFIED | Truth 5 |
| DETTE-02 | 07-05 | W4 click path, level kept, back | ✓ SATISFIED | Truth 4 |
| DETTE-03 | 07-02 | W10 consulted sources with link, date and archived extract | ✓ SATISFIED | Truth 5 |
| DETTE-05 | 07-02 | W7 types against schemas | ✓ SATISFIED | Truth 5 |

No orphaned requirements. REQUIREMENTS.md maps exactly these 7 IDs to Phase 7. DETTE-04 is mapped to Phase 9. The REQUIREMENTS.md checkboxes still show `[ ]` / Pending for these 7; that bookkeeping belongs to the orchestrator's phase completion.

### Anti-Patterns Found

I scanned 60 files changed since 51a8f60 (outside .planning) for TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER and « not implemented »: no matches. The phase does not touch `src/content/**`, `archives/**` or `data/couverture-themes.yaml`.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| astro.config.mjs / built meta | 30-35 | Meta `script-src` holds `'self'` and 5 Astro client-directive hashes besides the 2 site hashes (IN-01, skipped by decision, ADR-056); check-dist checks inclusion, not equality | ℹ️ Info | No script file is emitted (no `_astro/`), and the Phase 8 header allows only the 2 site hashes. Least privilege is not at its tightest until the header is live |
| src/layouts/Base.astro | head | The order script precedes the meta, so the meta does not govern it (documented ADR-056 « Limite ») | ℹ️ Info | Covered by the header CSP once Phase 8 applies the block; e2e proves that the header blocks a tampered order script |
| tests/repo/hote-en-dur.test.ts | 37 | `docs/` and `.planning/` are excluded from the host guard | ℹ️ Info | Docs may keep the old provisional name after a domain change; this is narrative, not output. RUNBOOK « Changer de domaine » exists |
| src/content/couverture/{sante,travail}.yaml | 8 cases | WR-05 dates (`verifie_le` 3 Nov vs consultation 4 Nov), visible side by side in the preview W10 block | ℹ️ Info | Editorial, preview only today (nothing published); deferred to Erwan's review (Phase 9) |

### Human Verification Required

None for Phase 7's own behaviours. The two manual rows of 07-VALIDATION (`caddy validate`, header + meta behind the real server) are Phase 8 success criteria and are listed under Deferred Items. WR-05 is an editorial content correction for Erwan, deferred to Phase 9.

### Gaps Summary

No gaps. I could reproduce each of the 5 roadmap success criteria myself:
- **Domain:** with a different domain in a copy, a real build moves every canonical, the sitemap, robots and the Caddy block; the drift check and the hard-coded host guard both fail when they should.
- **Deployment guard:** a deployment build on `.invalid` exits 1 with a clear message, and check-dist under `RTP_DEPLOIEMENT=1` reports `DOMAINE_PROVISOIRE` as an error.
- **Inlining and CSP:** every page carries its CSS and both scripts byte-identical to their sources, with their hashes in a CSP that has no `unsafe-*`.
- **Click path:** the test passes, uses the real bfcache, and its mutation proof bites.
- **Debt:** the preview coverage sentence no longer counts drafts as published, the consulted sources carry link, date, Wayback and archived extract, and the types-schemas test has zero drift with working fault injections.

The remaining items belong to the server (Phase 8) or to editorial review (Phase 9).

---

_Verified: 2026-11-07T02:51:51Z_
_Verifier: Claude (gsd-verifier)_
