---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
fixed_at: 2026-11-04T17:36:58Z
review_path: .planning/phases/05-pages-institutionnelles-qualit-et-url-de-test/05-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 14
skipped: 1
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-04T17:36:58Z
**Source review:** .planning/phases/05-pages-institutionnelles-qualit-et-url-de-test/05-REVIEW.md (committed in e282021)
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (2 critical, 7 warning, 6 info; scope "all", as the orchestrator asked)
- Fixed: 14
- Skipped: 1 (CR-02: no code change needed. Erwan resolved it by making the repository public. Only a RUNBOOK note was committed.)

The work ran directly on `main` in the main checkout, as the orchestrator asked. Nothing was pushed. No file under `src/content/**`, `archives/**` or `data/couverture-themes.yaml` was changed. Two config files were edited for temporary verification builds and then restored byte for byte: `config/hebergeur.yml` (for WR-03) and `data/dataset-datagouv.yaml` (for WR-07).

## Fixed Issues

### CR-01: Méthode said polls fall under the Arcom

**Files modified:** `src/pages/methode.astro`, `src/pages/mentions-legales.astro`, `tests/dist/cas/methode.cas.ts`, `tests/dist/cas/institutionnel.cas.ts`
**Commit:** 7fe75c4
**Applied fix:**
- Both pages now carry a `data-regle="sondages"` paragraph. It names the loi n° 77-808 du 19 juillet 1977 relative à la publication et à la diffusion de certains sondages d'opinion, under the control of the Commission des sondages.
- Méthode cites the Arcom only for audiovisual pluralism and says it does not supervise the site. That matches Mentions légales.
- New dist tests reject « sondages … relèvent de l'Arcom ».
- Page revision dates moved to 2026-11-04.
- Wording to confirm during the legal review planned for Lot 3.

### WR-01: e2e server and audit reader followed symlinks out of the dist

**Files modified:** `e2e/serveur.ts`, `scripts/audit-lire.ts`, `tests/scripts/e2e-serveur.test.ts`, `tests/scripts/audit-lire.test.ts`
**Commit:** 9706bd0
**Applied fix:**
- After the lexical check, both tools compare `realpathSync` of the target with `realpathSync` of the dist.
- A link to a file or folder outside the dist gets 404 from the server and exit 2 from audit-lire. A link to another file inside the dist still works.
- Decision for `--empreinte`: include links rather than refuse them. Each link adds a line `path -> lien:<readlink>` and is never followed. Adding, removing or retargeting a link therefore changes the fingerprint, while a change to an outside target does not.
- Files keep the old line format and sort order. Fingerprints of link-free dists are unchanged, checked on `dist`, `dist-preview` and `dist-e2e/reel` with the old and new scripts. The fingerprints recorded in `docs/AUDIT-TEST-CROISE.md` stay valid.

### WR-02: `audit-lire --journal` could write inside the dist

**Files modified:** `scripts/audit-lire.ts`, `tests/scripts/audit-lire.test.ts`
**Commit:** 14bbcb6
**Applied fix:**
- The journal path is refused (exit 2, before any read) when it is the dist or below it. The check is done both lexically and on real paths (realpath of the nearest existing parent).
- The test covers three cases: a direct path, a path through a symlink to the dist, and the default `audit/journal.jsonl` when run from inside the dist. The dist stays untouched in all three.

### WR-03: Pre-deployment statements were hard-coded

**Files modified:** `src/pages/methode.astro`, `src/pages/mentions-legales.astro`, `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `tests/scripts/check-dist.test.ts`, `tests/dist/cas/institutionnel.cas.ts`, `tests/dist/cas/methode.cas.ts`, `docs/RUNBOOK.md`
**Commit:** c667a10
**Applied fix:**
- Three texts now render only with `statut: prevu`, and each carries `data-hebergeur="prevu"`:
  - Méthode « Cette version de test n'est pas encore en ligne »;
  - the Mentions « Relecture » section;
  - the Mentions hosting paragraph.
- Privacy wording. The site no longer claims it « ne collecte aucune donnée personnelle ». It now says: no cookie, no external script, no visit statistics, and no personal data asked for. The second sentence depends on the hosting status:
  - `prevu`: « aucun serveur de l'éditeur ne reçoit vos visites »;
  - `actif`: « Comme tout serveur web, le serveur qui héberge ce site reçoit l'adresse IP de votre appareil pour lui envoyer les pages demandées ».
- The `actif` rendering was checked with a temporary build; `config/hebergeur.yml` was restored afterwards.
- New check-dist code `HEBERGEUR_PREVU`. It is a warning by default and an error when `RTP_DEPLOIEMENT=1`, the same logic as `CONTACT_PROVISOIRE`. An artefact built earlier with `prevu` can no longer ship.
- RUNBOOK documents the new code and a Lot 3 step: describe what the Caddy access log keeps (fields, IP truncation, retention).

### WR-04: The "4G lente" test was milder than Slow 4G, and runs 2 and 3 were not cold

**Files modified:** `src/lib/profil-4g.ts`, `e2e/4g.spec.ts`, `src/pages/methode.astro`, `tests/ui/constantes-publiques.test.ts`, `tests/dist/cas/methode.cas.ts`, `README.md`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`
**Commit:** 15e2dff
**Status:** fixed: requires human verification (it changes the published performance claim)
**Applied fix:**
- Each measurement now runs in a fresh `browser.newContext()`, so cache and TCP connections are new each time.
- Measured with the Lighthouse-equivalent profile alone (562.5 ms per request, 1.44 Mbit/s), the < 1 s budget **failed**:
  - `/methode/` (m1): 1218, 1196, 1169 ms;
  - `/themes/sante/` (reel): 1254, 1222, 1265 ms.
- The cause is structural: HTML then CSS are two sequential requests, which already makes 1125 ms of latency.
- The budget was not loosened silently. `PROFILS_4G` now holds two named profiles, each with an explicit published budget:

| Profile | Simulates | Budget | Measured, final `npm run e2e` |
|---|---|---|---|
| `latence-150` | 150 ms of latency per request, 1.6 Mbit/s (the old profile, renamed for what it simulates) | 1 s | 338-371 ms (`/methode/`), 423-432 ms (`/themes/sante/`) |
| `slow-4g-lighthouse` | Lighthouse "Slow 4G" DevTools equivalent: 562.5 ms per request, 1.44 Mbit/s | 1.5 s | 1195-1203 ms (`/methode/`), 1255-1258 ms (`/themes/sante/`) |

- Méthode now builds its sentence from `PROFILS_4G`: « moins de 1 s avec une latence de 150 ms par requête et un débit de 1,6 Mbit/s ; moins de 1,5 s avec le profil « Slow 4G » de Lighthouse (562,5 ms de latence par requête, 1,44 Mbit/s) ». It also says the measurement is cold, on a local server that compresses the pages.
- README, RUNBOOK and ADR-009 were revised to match.
- **Decision for Erwan:** the spec says « < 1 s sur 4G » without naming a profile. Meeting < 1 s on the Lighthouse profile would require inlining the CSS into the page, which is a design change.

### WR-05: « Détails techniques » summary had lost its disclosure marker

**Files modified:** `src/styles/pages.css`, `tests/ui/styles.test.ts`
**Commit:** 617bf83
**Applied fix:**
- The summary is back to `display: list-item`, with `min-height: 2.75rem` and `padding-block: 0.5rem`. 0.5rem is used because the test for the 4/8/16 px spacing scale refuses 0.6rem.
- Checked in Chromium: computed display is `list-item`, the marker is generated, and the height is 44 px.
- A style test pins this and refuses `list-style: none`.

### WR-06: Qui sommes-nous did not disclose AI-assisted drafting

**Files modified:** `src/pages/qui-sommes-nous.astro`, `src/pages/methode.astro`, `tests/dist/cas/institutionnel.cas.ts`
**Commit:** ba3d48e
**Applied fix:**
- Qui sommes-nous now says the four versions are drafted with the help of an AI tool (a language model), from the candidate's text quoted verbatim. The publisher reviews each version before publication and is responsible for it. Unreviewed versions are never published.
- Méthode › Limites connues mirrors this.
- A dist test pins the wording and checks that no production file contains « brouillon, non relu ».

### WR-07: The Méthode dataset sentence always stated a discrepancy

**Files modified:** `src/lib/dataset-datagouv.ts`, `src/pages/methode.astro`, `tests/corpus/dataset-datagouv.test.ts`, `tests/dist/cas/methode.cas.ts`
**Commit:** b6e8256
**Applied fix:**
- New `ecartAnnonce()`; the sentence branches on it.
- When the counts differ (51 vs 59 today), the text is unchanged.
- When they are equal, it says « en contient le même nombre, N » and drops « Cet écart est constaté… ». This branch was checked with a temporary 59/59 build; the data file was restored afterwards.
- Unit test and dist test added.

### IN-01: Tie-rule summary did not match `classer()` at a gap of exactly 2

**Files modified:** `src/pages/methode.astro`, `tests/dist/cas/methode.cas.ts`
**Commit:** d9a5db4
**Applied fix:**
- The sentence now describes both steps of the code: a guaranteed place at P4 + marge or more, then a tie band within marge of the best remaining theme, broken in favour of the Aîné themes.
- No algorithm change, so the pilot choice is unchanged.

### IN-02: Unquoted dist path in the Playwright `webServer` command

**Files modified:** `playwright.config.ts`
**Commit:** f96fefb
**Applied fix:** `JSON.stringify(dist)` in the command. Checked: `E2E_DIST="/tmp/a b/dist"` gives `node e2e/serveur.ts "/tmp/a b/dist" 4173`.

### IN-03: GitHub annotations could hide errors behind warnings

**Files modified:** `scripts/check-dist.ts`, `tests/scripts/check-dist.test.ts`
**Commit:** b04abb3
**Applied fix:** findings are sorted errors first (stable sort) before keeping 10. The new CLI test uses 11 warnings plus 1 error; it fails without the fix.

### IN-04: The axe gate ignored moderate and minor violations

**Files modified:** `src/pages/methode.astro`, `docs/RUNBOOK.md`, `README.md`, `tests/dist/cas/methode.cas.ts`
**Commit:** 2184a24
**Applied fix:**
- The docs were made to match the gate, as the orchestrator preferred. Méthode says the test blocks on defects the tool rates serious or critical, and not on minor or moderate ones. README and RUNBOOK say the same.
- The gate is unchanged.
- `CLAUDE.md` and `.planning/research/STACK.md` still say "fail on any violation". They were not edited (project instructions and research artefact).

### IN-05: Privacy section left out the GitHub error-report link

**Files modified:** `src/pages/mentions-legales.astro`, `tests/dist/cas/institutionnel.cas.ts`
**Commit:** b056e03
**Applied fix:** new item: « Le lien « Signaler une erreur (GitHub) » mène au site GitHub : c'est aussi une action volontaire, et GitHub applique alors sa propre politique de confidentialité. »

### IN-06: Deployment guard skipped for any value other than `'1'`

**Files modified:** `src/lib/deploiement.ts` (new), `src/lib/site-config.ts`, `src/lib/hebergeur-config.ts`, `scripts/check-dist.ts`, `tests/corpus/deploiement.test.ts` (new), `tests/corpus/site-config.test.ts`, `tests/corpus/hebergeur-config.test.ts`, `tests/scripts/check-dist.test.ts`, `docs/RUNBOOK.md`
**Commit:** 9b4098e
**Applied fix:**
- `estDeploiement()` is the single reader: `1` means deployment; unset, empty or `0` mean no deployment; any other value throws `DeploiementInvalideError`.
- Both config readers call it first, so a bad value fails the build even when no guard would trigger. check-dist exits with code 2.
- The CLI test helper now also clears `RTP_DEPLOIEMENT` from the inherited environment.

## Skipped Issues

### CR-02: Pages presented the GitHub repository as public while it was private

**File:** `src/pages/qui-sommes-nous.astro:41-49` (also `src/pages/methode.astro`)
**Reason:** Erwan resolved it: the repository was made public on 2026-11-04. The orchestrator verified `visibility: PUBLIC` and that an « Extrait archivé » link returns HTTP 200. No page change was needed.

The RUNBOOK note went through two commits:
- ce77cc9 added a « make the repo public before deployment » note, under the earlier brief.
- 8be1611 reworded it after the update: the Lot 3 step now says to check that the repository is still public and to keep it public, because the repository, issue and archived-excerpt links depend on it. Check: `gh repo view ErwanHenry/reveleTonProg --json visibility` must return `PUBLIC`. The temporary « still private » warning in the test-URL section was removed.

Nothing was changed about `ErwanHenry/reveleTonProg-archives`, which stays private.

**Original issue:** `gh repo view` returned PRIVATE, so the repository, issues, « Extrait archivé » and « Signaler une erreur (GitHub) » links returned 404 for reviewers.

## Final verification (after the last commit)

| Command | Result |
|---|---|
| `fnm exec --using=24 npm test` | exit 0: 1646 tests, 1646 pass, 0 fail (baseline before fixes: 1626 pass) |
| `npm run validate -- --mode production` | exit 0: 391 files, 0 errors, 17 warnings (existing `LISIBILITE_ENFANT_FAIBLE` in `src/content`, out of scope) |
| `npm run check` | exit 0: 186 files, 0 errors, 0 warnings, 0 hints |
| `npm run e2e` (both datasets) | exit 0: m1 223 passed, reel 1033 passed. 4G numbers are in the WR-04 table. |

Commit attribution: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The session's attribution rule specifies this line, and it names the model that actually made the commits; the brief asked for `Claude Sonnet 5.5`.

---

_Fixed: 2026-11-04T17:36:58Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
