---
phase: 07-domaine-param-tr-inlining-et-dette
fixed_at: 2026-11-07T02:36:29Z
review_path: .planning/phases/07-domaine-param-tr-inlining-et-dette/07-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 12
skipped: 1
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-11-07T02:36:29Z
**Source review:** .planning/phases/07-domaine-param-tr-inlining-et-dette/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (fix scope: all, Info included)
- Fixed: 12
- Skipped: 1 (IN-01: no change, as decided)

Review report committed first: `3ac2247 docs(07): add code review report`.

Gates after the fixes (local, Node 24):
- `npm test`: 1847 of 1847 pass
- `npm run check`: 0 errors, 0 warnings, 0 hints
- `node scripts/render-caddy.ts --check`: up to date
- `npm run validate -- --mode production`: fixture `tests/fixtures/corpus-valide` has 0 errors and 0 warnings; the real corpus has 0 errors and 25 warnings (17 before, plus the 8 WR-05 cases), exit 0
- `npm run e2e`: m1 259 passed, reel 1177 passed

## Fixed Issues

### CR-01: The access log is not limited to 14 days; size-only rotation keeps IP entries for months

**Files modified:** `scripts/render-caddy.ts`, `deploy/caddy/site.caddy`, `tests/repo/caddy.test.ts`, `docs/RUNBOOK.md`
**Commit:** d00389c
**Status:** fixed: requires human verification (`caddy validate` and a 2-day check on the server in Phase 8)
**Applied fix:**

I checked the Caddy docs and source:
- `roll_interval`, `roll_at` and `roll_minutes` exist since Caddy v2.11.0, where the file writer moved from lumberjack to timberjack v1.4.8. They are absent from v2.10.x. The current stable is v2.11.9 (2026-11-05), which `caddy:2-alpine` follows.
- `roll_at` starts a clock timer (UTC by default) that rotates even with no traffic.
- `roll_keep` keeps the N newest distinct rotation timestamps.
- `roll_keep_for` has day resolution (rounded up).
- Pruning runs on every rotation.

The block now has `roll_size 10MiB`, `roll_at 00:00`, `roll_keep 12` and `roll_keep_for 288h`.

The exact bound with one rotation per day: the oldest kept file covers day D-13, so an entry lives **less than 13 days**. A missed midnight rotation (Caddy stopped at midnight) is never caught up, because timberjack restarts from the first write. One file then spans 2 days, giving **14 days at most**. A size rotation only shortens the covered time. The 14-day promise to the Mentions légales holds with one day of margin.

The constants `ROTATION_JOURNAL`, `TAILLE_JOURNAL`, `FICHIERS_TOURNES_GARDES` and `RETENTION_MAX_JOURS` are exported. `caddy.test.ts` pins the 4 directives, recomputes the bound from the rendered block (`roll_keep + 2 <= 14`, `ceil(roll_keep_for / 24h) <= roll_keep`) and pins the comment wording. I fixed the false wording in the block comment, the test title and the RUNBOOK sentence. RUNBOOK step 4 (Mentions légales) now says "14 jours au plus".

Still needs `caddy validate` in Phase 8 (recorded in the RUNBOOK "Bloc Caddy (Phase 8)" list):
- `roll_at 00:00`, which needs an image at Caddy >= 2.11 (`caddy version`);
- `request>headers delete`, `ip_mask 24 48` and `request>client_ip`, which were already listed.

Phase 8 assumption, also in the RUNBOOK: after a restart, the rotation timer only starts at the first request, so the monitoring probe must hit the site at least once a day. Check after 2 days: `ls -l /var/log/caddy/` shows `reveletonprog-<date>-time.log.gz` files at UTC midnight, never more than 12.

### WR-01: The no-User-Agent / masked-IP policy only covers the access logger; Caddy's error and default logs stay unfiltered

**Files modified:** `scripts/render-caddy.ts`, `deploy/caddy/site.caddy`, `tests/repo/caddy.test.ts`, `docs/RUNBOOK.md`
**Commit:** fcf6430
**Applied fix:** No server change. The block comment now says that the rules cover only the access log and points to the RUNBOOK. The RUNBOOK "Bloc Caddy (Phase 8)" checklist has a new item:
- cap the container logs with Docker options (`max-size: "10m"`, `max-file: "3"` in compose, or `--log-opt`);
- either set the default logger to WARN, or route `http.log.error` through the same `format filter`;
- check commands: `docker inspect` for LogConfig, and a `docker logs` grep that finds no full IPv4 address in `remote_ip`.

A test pins the comment and the RUNBOOK terms.

### WR-02: No test ever applies the header CSP that is said to protect the order script

**Files modified:** `scripts/render-caddy.ts`, `e2e/serveur.ts`, `e2e/csp.spec.ts`, `e2e/csp-sans-js.spec.ts`, `tests/repo/caddy.test.ts`, `docs/RUNBOOK.md`
**Commit:** 64fb300
**Applied fix:**
- **Shared header.** `cspEnTete(empreintes)` is extracted from `renderCaddy` and exported, with the same hash checks. `e2e/serveur.ts` sends `cspEnTeteDuDepot()` (the same function over `src/scripts/*.js`) on every response, so nothing is duplicated. `creerServeur(racine, { csp })` accepts `null`, and the CLI accepts `--sans-entete-csp` for old `site-preview` artifacts (documented under "URL de test").
- **Header checked in the specs.** `csp.spec.ts` checks that every page carries exactly that header. `csp-sans-js.spec.ts` checks it on every response. The browser therefore enforces header and meta together, with JS on and off, and all pages pass.
- **Mutation proof.** A copy of the first page whose `ordre.js` body is altered is served by `creerServeur`. With the header, the script is blocked (`data-ordre-js` absent, `script-src(-elem) inline` violation). In the control without the header, it runs, which proves that the meta does not govern it (ADR-056). Before the run, the test asserts that `ordre.js` is inline, byte for byte, before the meta.
- **Unit pin.** `caddy.test.ts` asserts that the block's header equals `cspEnTete(...)` and that `e2e/serveur.ts` imports it.

### WR-03: types-schemas does not catch a field that is non-optional in the type but optional or nullable in the schema

**Files modified:** `tests/corpus/types-schemas.test.ts`
**Commit:** cbf1265
**Applied fix:** `comparer()` now:
- merges `required` from the object and from each `allOf[*]` branch (not `then`/`else`, which stay conditional);
- reports a property that is non-optional in the type and not unconditionally required by the schema;
- compares nullability both ways, through `type` null, `const`/`enum` null and `anyOf`/`oneOf`, following `$ref`;
- compares an enum reached through `$ref` with the type's alias union (for example `statut_relecture: StatutRelecture`).

There is one fault injection per rule: `url` removed from `source#/required`; `url` moved into `allOf`, which gives no gap; conditional `motif`; nullable `Source.titre`; `parti` without `| null`; `url: string | null`; and an `$ref` to a narrower enum. No real drift in `types.ts`, so it is unchanged.

### WR-04: The hard-coded-host guard misses percent-encoded copies of the domain

**Files modified:** `tests/repo/hote-en-dur.test.ts`
**Commit:** 71d4e9c
**Applied fix:** Each line is also matched after `vueDecodee()`, which decodes every `%XX` up to 3 times (for double encoding); a lone UTF-8 byte becomes a space. New positive cases: `mailto:contact%40exemple.test`, `https%3A%2F%2Fexemple.test%2Fthemes%2F`, `%253A%252F%252F` (double encoding) and `exemple%2Etest`. New negative cases: encoded `autre-exemple.test`, encoded `exemple.testeur.fr`, `100%25` and `%E9t%E9`.

### WR-05: W10 now shows readers a contradiction: "verified on 3 Nov" next to sources "consulted on 4 Nov"

**Files modified:** `src/lib/content-core/rules/equite.ts`, `src/lib/content-core/rules/corpus.ts`, `src/lib/content-core/rules/config.ts`, `tests/rules/equite.test.ts`, `tests/rules/moteur.test.ts`, `docs/RUNBOOK.md`
**Commit:** d1a3a3a
**Status:** fixed: requires human verification (editorial correction of the 8 cases below, by Erwan)
**Applied fix:** No content edited.
- **New rule.** The warning `COUVERTURE_VERIFIEE_AVANT_SOURCE` (REGLE-08, severity "avertissement", never an error in either mode) is in the CATALOGUE, so the Méthode page lists it. It fires when a case's `verifie_le` is earlier than the `date_consultation` of a listed source, with one warning per case, on `/cases/<i>/verifie_le`. It is skipped when a coverage or source file is invalid, so errors do not cascade.
- **Tests.** Warning in production and in preview, nothing on the same day or after, the reference corpus stays clean, and the catalogue count goes from 41 to 42.
- **RUNBOOK.** A new row in the code table and a new section "Relire les dates de couverture" with the editorial procedure.
- **Production validate.** The real corpus still exits 0.

#### Contenu à relire par Erwan (WR-05)

8 cases where `verifie_le` (2026-11-03) is earlier than the consultation date of a listed source (2026-11-04). The page shows "Non précisé dans les sources consultées le 3 novembre 2026" above "Consultée le 4 novembre 2026". Each case appears on the theme page and on the candidate page, which matches the review's 16 of 34 blocks.

| Fichier | Case | Candidat | verifie_le | Source consultée plus tard | date_consultation |
|---|---|---|---|---|---|
| `src/content/couverture/sante.yaml` | `/cases/14` | clara-egger | 2026-11-03 | clara-egger-notre-solution | 2026-11-04 |
| `src/content/couverture/sante.yaml` | `/cases/23` | benoit-mathieu | 2026-11-03 | benoit-mathieu-le-candidat | 2026-11-04 |
| `src/content/couverture/sante.yaml` | `/cases/26` | manolo-mlekuz | 2026-11-03 | manolo-mlekuz-programme | 2026-11-04 |
| `src/content/couverture/travail.yaml` | `/cases/14` | clara-egger | 2026-11-03 | clara-egger-presentation-candidate | 2026-11-04 |
| `src/content/couverture/travail.yaml` | `/cases/23` | benoit-mathieu | 2026-11-03 | benoit-mathieu-programme | 2026-11-04 |
| `src/content/couverture/travail.yaml` | `/cases/25` | antoine-mikolajczak | 2026-11-03 | antoine-mikolajczak-tract-campagne | 2026-11-04 |
| `src/content/couverture/travail.yaml` | `/cases/26` | manolo-mlekuz | 2026-11-03 | manolo-mlekuz-programme | 2026-11-04 |
| `src/content/couverture/travail.yaml` | `/cases/30` | natacha-polony | 2026-11-03 | natacha-polony-ma-vision | 2026-11-04 |

To fix each case, see RUNBOOK "Relire les dates de couverture":
- reread the case in the listed sources, then set `verifie_le` to the date of that reading;
- or, if the consultation date is the wrong one, correct `date_consultation` from `archive.capture_le`.

Do this in a content PR, never by script. Once fixed, `npm run validate` should report 8 fewer warnings. I did not change the rendering ("Vérifié le max(verifie_le, dates des sources)"): that would change what the date means, which is an editorial decision.

### IN-02: The `loadSiteConfig` memo skips the deployment guard on the second read

**Files modified:** `src/lib/site-config.ts`, `tests/corpus/site-config.test.ts`
**Commit:** 3a8b931
**Applied fix:** Parsing (`lireFichier`) is memoized per root. The deployment guard (`verifierDeploiement`) now runs on every call, memoized or not. The regression test (empty env first, then `RTP_DEPLOIEMENT=1`) fails before the fix and passes after it.

### IN-03: `list-style: none` on the consulted-sources list removes list semantics in WebKit/VoiceOver

**Files modified:** `src/components/EtatVide.astro`, `tests/dist/cas/theme.cas.ts`
**Commit:** 7071de2
**Applied fix:** `role="list"` on the `<ul>`, with a comment. The dist case asserts the attribute. axe stays green in e2e.

### IN-04: Only `.invalid` counts as provisional; `.test`, `.example`, `.localhost` would pass the deployment guard

**Files modified:** `src/lib/site-config.ts`, `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `tests/corpus/site-config.test.ts`, `tests/scripts/check-dist.test.ts`, `tests/dist/cas/domaine.cas.ts`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 78aab5a
**Applied fix:**
- **Shared rule.** `TLD_PROVISOIRES` (`invalid`, `test`, `example`, `localhost`) and `estHoteProvisoire()` live in `site-config.ts` and judge only the last label, ignoring case and a trailing dot. They are used for `domaineProvisoire`, for `contactProvisoire` (the domain part of the address) and in check-dist: `DOMAINE_PROVISOIRE` on the option and on the canonical host, and `CONTACT_PROVISOIRE` on mailto links. Messages now say "TLD réservé : .invalid, .test, .example, .localhost".
- **Test consistency.** The check-dist tests called clean dists directly with `exemple.test`, which now draws a provisional warning even outside deployment. Their default domain becomes `example.org`: a name reserved by RFC 2606, but not a reserved TLD, so it acts as a "real" domain for the guard. `exemple.test` stays where only pure functions are tested (sitemap, renderCaddy, hote-en-dur) and in the new provisional cases (`.test`, `.example`, `.localhost`, uppercase). Pins, RUNBOOK and the ADR quote are updated.

### IN-05: `render-caddy` refuses to render under `RTP_DEPLOIEMENT=1` when only the contact is provisional

**Files modified:** `scripts/render-caddy.ts`, `tests/repo/caddy.test.ts`, `docs/RUNBOOK.md`
**Commit:** b90ef0b
**Applied fix:** The CLI reads with `{}`, then checks `estDeploiement(process.env) && domaineProvisoire` explicitly, as check-dist does. An invalid `RTP_DEPLOIEMENT` still exits 2. CLI tests run on a temporary project:
- a real domain with a provisional contact renders;
- `.invalid` and `.test` domains with a real contact are refused with exit 2 and nothing written;
- `RTP_DEPLOIEMENT=oui` exits 2.

USAGE and RUNBOOK are updated.

### IN-06: The Docker assumptions do not say that the `current` symlink must be relative

**Files modified:** `docs/RUNBOOK.md`
**Commit:** b4e432e
**Applied fix:** Two new items in "Hypothèses à confirmer en Phase 8":
- a relative link `ln -sfn releases/<sha> current`, with a check through `readlink` and `docker exec ... ls`;
- a `www.<domaine>` DNS record created before the block is applied, otherwise ACME retries without end; check with `dig +short`.

### IN-07: Adding a 404 page later would be required in the sitemap and given a canonical URL

**Files modified:** `scripts/lib/check-dist.ts`, `src/lib/sitemap.ts`, `tests/scripts/check-dist.test.ts`, `docs/RUNBOOK.md`
**Commit:** 6e9fe95
**Applied fix:** `PAGE_ERREUR = '404.html'` is left out of `canoniquesAttendues`, so it needs neither a canonical nor a sitemap entry. A canonical on it gives `CANONIQUE_INCORRECT`. `a/404.html` stays an ordinary page. `sitemap.ts` comment and RUNBOOK row are updated, with tests.

## Skipped Issues

### IN-01: The meta CSP is broader than the two site scripts, and check-dist allows any hash

**File:** `astro.config.mjs:30-35`, `scripts/lib/check-dist.ts:147,401`
**Reason:** No change, by decision (already documented in ADR-056: check-dist checks inclusion, not equality). The production header (`deploy/caddy/site.caddy`) only allows the 2 site hashes, and WR-02 now enforces that header in e2e. The optional allowlist of Astro directive hashes is left for later.
**Original issue:** The built meta `script-src` holds `'self'`, the 2 site hashes and 5 Astro client-directive hashes; until the Phase 8 header is live (and for the `site-preview` artifact), the meta alone permits those extra known scripts and any same-origin script file.

---

_Fixed: 2026-11-07T02:36:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
