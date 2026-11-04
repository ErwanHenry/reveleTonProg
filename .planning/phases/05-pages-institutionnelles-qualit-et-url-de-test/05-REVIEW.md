---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
reviewed: 2026-11-04T14:10:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - e2e/4g.spec.ts
  - e2e/axe.spec.ts
  - e2e/clavier.spec.ts
  - e2e/contraste.spec.ts
  - e2e/mouvement.spec.ts
  - e2e/pages.ts
  - e2e/poids.ts
  - e2e/sans-js.spec.ts
  - e2e/serveur.ts
  - e2e/texte.spec.ts
  - e2e/vie-privee.spec.ts
  - playwright.config.ts
  - scripts/audit-lire.ts
  - scripts/check-dist.ts
  - scripts/e2e.ts
  - src/components/EtatVide.astro
  - src/layouts/Base.astro
  - src/lib/dataset-datagouv.ts
  - src/lib/dates-tours.ts
  - src/lib/hebergeur-config.ts
  - src/lib/profil-4g.ts
  - src/lib/stockage-local.ts
  - src/lib/corpus/vue.ts
  - src/pages/mentions-legales.astro
  - src/pages/methode.astro
  - src/pages/qui-sommes-nous.astro
  - src/styles/base.css
  - src/styles/niveaux.css
  - src/styles/ordre.css
  - src/styles/pages.css
  - .github/workflows/ci.yml
  - config/hebergeur.yml
  - data/dataset-datagouv.yaml
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-04T14:10:00Z
**Depth:** standard
**Files Reviewed:** 33 (31 in scope, plus the two data files the pages read)
**Status:** issues_found

## Summary

I reviewed the Phase 5 sources: the institutional pages (Méthode, Mentions légales, Qui sommes-nous), the layout footer, the strict config readers, the e2e harness (static server, page discovery, specs, runner), the audit reader and the CI workflow. I probed the server and the audit reader with real traversal requests, and I built the Méthode text from the current data.

What holds up:
- Both tools reject dot-dot traversal, encoded traversal (`%2e%2e`, `..%2f`), backslashes, NUL bytes and sibling-prefix paths (`dist-evil`).
- The journal has exactly 6 keys.
- `prevu` plus `RTP_DEPLOIEMENT=1` makes `astro build` fail.
- Every CI action is pinned by SHA with `persist-credentials: false`. Untrusted GitHub context only reaches `run:` through `env:`.
- The LCEN article 1-1 references and the right-of-reply time limits (3 months, 3 days) match the research notes.

The main problems are factual statements on the institutional pages:
- Méthode says the Arcom handles polls. The legal regulator for polls is the Commission des sondages.
- Qui sommes-nous presents the GitHub repository as public. It is private today, so its links return 404 for anyone reviewing the test URL.

The warnings are:
- symlink escape in both "dist-only" tools;
- the audit reader can write its journal inside the dist;
- pre-deployment statements are hard-coded with no deployment guard;
- the 4G test profile is milder than the "Slow 4G" it is named after;
- the disclosure marker of the "Détails techniques" summary is gone;
- the authorship claim on Qui sommes-nous;
- the Méthode sentence that always states a dataset discrepancy.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Méthode says polls fall under the Arcom; the regulator for polls is the Commission des sondages

**File:** `src/pages/methode.astro:91`
**Issue:** The page says: « Les règles de communication des sondages et du pluralisme relèvent de l'Arcom : voir les mentions légales. » This is wrong for polls. The publication of election polls is governed by loi n° 77-808 du 19 juillet 1977 and supervised by the **Commission des sondages**, not the Arcom. That law applies whatever the medium, including a website. The Arcom part is only right for audiovisual pluralism. The sentence also contradicts the page it links to: Mentions légales (line 55) says the site is "pas soumis à la supervision de l'Arcom". A reader therefore concludes that no poll rule applies to this site. That is false, and it matters directly for the next milestone, which publishes polls. On a page whose purpose is a transparent and correct method, this is a wrong legal statement that must not ship.
**Fix:** Separate the two regimes and name the right body. For example:
```astro
<p>L'étiquette politique affichée est celle que le candidat revendique. Un chiffrage n'est donné que s'il vient du candidat.
La publication des sondages relève de la loi n° 77-808 du 19 juillet 1977, sous le contrôle de la Commission des sondages ;
le pluralisme dans les médias audiovisuels relève de l'Arcom, qui ne supervise pas ce site (voir les <a href="/mentions-legales/">mentions légales</a>).</p>
```
Have it checked during the legal review that is already planned for Lot 3. Add a dist test case that rejects « sondages … relèvent de l'Arcom ».

### CR-02: Qui sommes-nous and Méthode present the GitHub repository as public, but it is private

**File:** `src/pages/qui-sommes-nous.astro:41-49` (also `src/pages/methode.astro:69,143`)
**Issue:** `gh repo view ErwanHenry/reveleTonProg --json visibility` returns `PRIVATE`. The pages still say:
- « Le dépôt est consultable sur https://github.com/ErwanHenry/reveleTonProg »;
- « ouvrez un signalement sur le suivi des signalements du dépôt » (`/issues`);
- on Méthode, « Une copie est conservée dans le dépôt du site » and « le journal est dans le dépôt du site ».

Anyone reviewing the Lot 2 test URL (the deliverable of this phase) without repository access gets a 404 on every one of these links. The same applies to the "Extrait archivé" and "Signaler une erreur (GitHub)" links the pages describe. The "Code et données ouverts" heading and the licence statement promise a reuse that is impossible today. The pages make a false, checkable claim, and the error-report channel they announce does not work.
**Fix:** Either make the repository public before handing out the test URL (a human action, recorded in RUNBOOK), or make the claim conditional and guarded. For example, add a `depot_public: true|false` key to `config/site.yml`, display the repository and issues links only when it is `true`, and make the build fail under `RTP_DEPLOIEMENT=1` while it is `false`, like the `.invalid` contact guard:
```ts
if (!cfg.depotPublic && env.RTP_DEPLOIEMENT === '1') throw erreur('dépôt privé : les liens « dépôt », « signalement GitHub » et « extrait archivé » seraient en 404');
```

## Warnings

### WR-01: The e2e server and the audit reader follow symlinks out of the dist

**File:** `e2e/serveur.ts:30-36`, `scripts/audit-lire.ts:45-48` (and `scripts/audit-lire.ts:56` for `--empreinte`)
**Issue:** The containment check is lexical only (`path.resolve` plus `startsWith(racine + sep)`). `existsSync`, `statSync` and `readFileSync` then follow symlinks. Confirmed by testing:
- the server returned `200` with the content of `/tmp/rtp-rev/secret.txt` for `GET /lien.txt`, where `dist/lien.txt` was a symlink to it;
- `audit-lire --dist dist /sym.html` printed a file from outside the dist.

The constraint "must refuse paths outside the dist" is not met for links. `--empreinte` uses `Dirent.isFile()`, which is false for symlinks, so a planted link does not even change the fingerprint that is supposed to prove the dist was untouched.
**Fix:** Resolve real paths on both sides before comparing, and include links in the fingerprint:
```ts
const racineReelle = fs.realpathSync(racine);
let reel: string;
try { reel = fs.realpathSync(abs); } catch { return notFound(); }
if (!reel.startsWith(racineReelle + path.sep) || !fs.statSync(reel).isFile()) return notFound();
// --empreinte : lister aussi e.isSymbolicLink() (avec fs.readlinkSync) ou refuser un dist qui en contient
```

### WR-02: `audit-lire --journal` can write inside the dist

**File:** `scripts/audit-lire.ts:156-162`
**Issue:** The header says « Lecture seule sur le dist ; le journal est la seule écriture », but nothing stops the journal from going inside the dist. Confirmed: `--journal dist/journal.jsonl` created `dist/journal.jsonl`. The default `audit/journal.jsonl` is also relative to the current directory, so running from inside the dist writes `dist/audit/journal.jsonl`. Either way the read-only invariant and the before/after `--empreinte` comparison of the audit protocol are broken.
**Fix:**
```ts
const journal = path.resolve(values.journal ?? 'audit/journal.jsonl');
if (journal === dist || journal.startsWith(dist + path.sep)) refuser('Le journal ne peut pas être écrit dans le dist (lecture seule)');
```
Use the real paths (see WR-01) if the dist can be reached through a link.

### WR-03: Pre-deployment statements are hard-coded and only one deployment guard exists, at build time

**File:** `src/pages/methode.astro:153`, `src/pages/mentions-legales.astro:60,75`, `scripts/check-dist.ts:54-55`, `src/lib/hebergeur-config.ts:95`
**Issue:** Only the Hébergement paragraph follows `heb.statut`. Three statements are written unconditionally:
- « Cette version de test n'est pas encore en ligne. » (Méthode);
- « Ces mentions seront relues par un juriste avant la mise en ligne. »;
- « Ce site ne collecte aucune donnée personnelle ». Once Lot 3 puts Caddy in front, its access logs record IP addresses unless they are anonymized at write time (PITFALLS §13).

Switching to `statut: actif` publishes these false statements with no check. Also, the `prevu` guard only runs inside `astro build`, and only when the value is exactly `'1'`. `check-dist` has a dist-level `CONTACT_PROVISOIRE` check but no matching check for the hosting provider. If a deploy job builds without the variable, or ships an artifact built earlier (`site-preview`, `dist-reel`), the "Hébergeur prévu / n'est pas mise en ligne" page goes live.
**Fix:** Drive all pre-deployment text from `heb.statut`, for example `{heb.statut === 'prevu' && <li>Cette version de test n'est pas encore en ligne.</li>}`. Add a `check-dist` rule, `HEBERGEUR_PREVU`, that matches a marker attribute such as `data-hebergeur="prevu"` on the Mentions page and is an error when `deploiement` is true. Replace the privacy sentence before Lot 3 with an accurate statement about the server logs.

### WR-04: The "4G lente" test is milder than Slow 4G, and runs 2 and 3 are not cold

**File:** `src/lib/profil-4g.ts:2-6`, `e2e/4g.spec.ts:19-35`, `src/pages/methode.astro:143`
**Issue:** The profile is named "Lantern Slow 4G" (150 ms RTT, packet level). It is applied through `Network.emulateNetworkConditions`, whose `latency` is a per-request delay, not an RTT. For the same Slow 4G profile, Lighthouse's DevTools throttling multiplies the latency by 3.75 (`requestLatencyMs = 150 × 3.75 = 562.5`) and the throughput by 0.9, precisely to make up for this.

Other conditions also favour the test:
- it uses plain HTTP on loopback, with no DNS or TLS;
- `about:blank` does not close the keep-alive socket, so runs 2 and 3 reuse the TCP connection of run 1. "Chargement à froid" is only true for run 1.

The measured ~0.4 s (05-05-SUMMARY) would be around 1.2 s or more under the equivalent DevTools profile: one HTML request plus one CSS request, at 562 ms each. That breaks the « moins d'une seconde » the Méthode page publishes.
**Fix:** Use request-level values equivalent to Lantern, `latency: 150 * 3.75` and `downloadThroughput: 1.6 * 1024 * 1024 * 0.9 / 8`. Otherwise, rename the profile and the Méthode text to what is actually simulated (« 150 ms de latence par requête »). Open a fresh `browser.newContext()` per run to force new connections.

### WR-05: The "Détails techniques" summary on Méthode has lost its disclosure marker

**File:** `src/styles/pages.css:274-280`
**Issue:** `.texte-institutionnel summary { display: flex; }` replaces the `display: list-item` that produces the `::marker` triangle in Chromium and Firefox. Confirmed in Chromium through the test server: computed `display: flex`, so no marker box is generated. The summary renders as plain bold text, with nothing to show it can be expanded or whether it is open. That is a regression for the 72-year-old persona the site targets. It is also inconsistent with `details.renonce summary` (base.css:440), which keeps its marker.
**Fix:** Keep the native marker and get the height from padding:
```css
.texte-institutionnel summary {
  display: list-item;
  min-height: 2.75rem;
  padding-block: 0.6rem;
  font-weight: 600;
  cursor: pointer;
}
```
Alternatively, add an explicit `::before` marker that changes on `details[open]`.

### WR-06: Qui sommes-nous says the editor writes the four versions, but drafts are machine-generated

**File:** `src/pages/qui-sommes-nous.astro:33-35`
**Issue:** « Les quatre versions de chaque mesure sont rédigées par l'éditeur du site ». The corpus drafts are produced by AI agents: for example, commit `7af84bf content(03-07): travail, candidats 1-12 (brouillon)` carries `Co-Authored-By: Claude Sonnet`. Editorial review stays human. The Méthode page already discloses that the cross reading was "simulée par des agents", so leaving out the same fact for the writing itself is inconsistent. For a site whose value is transparency on a matter of public interest, this undisclosed fact is a credibility risk.
**Fix:** State the process accurately, for example: « Les quatre versions sont préparées avec l'aide d'un outil d'IA à partir du texte publié par le candidat, puis relues et validées par l'éditeur, qui en est responsable. Une version non relue n'est jamais publiée. » Mirror the sentence in Méthode › Limites connues.

### WR-07: The Méthode dataset sentence always states a discrepancy

**File:** `src/pages/methode.astro:72-74`
**Issue:** The template always renders « … annonce {annonce} personnes …, alors que le fichier … en contient {total} … Cet écart est constaté, il n'est pas expliqué. ». The numbers are computed (51 vs 59 today), but the claim of a discrepancy is hard-coded. After a snapshot refresh where `annonce === total`, the page states a discrepancy that does not exist, with nothing to catch it.
**Fix:** Branch on the computed values:
```astro
{dataset.annonce === dataset.instantane.total
  ? <>… annonce {dataset.annonce} personnes, autant que le fichier mis à jour le …</>
  : <>… alors que le fichier … en contient {dataset.instantane.total} … Cet écart est constaté, il n'est pas expliqué.</>}
```

## Info

### IN-01: The Méthode summary of the tie rule does not match the algorithm at a gap of exactly 2

**File:** `src/pages/methode.astro:117` (rule in `scripts/lib/couverture.ts:313-322`)
**Issue:** The page says two themes « à 2 positions d'écart ou moins » are tied. `classer()` gives a guaranteed place to a theme with `positions >= p4 + 2`, so a theme exactly 2 ahead of the fourth is *not* treated as tied with it. Example: A=10, then B=C=D=8, all three Aîné-priority. The algorithm picks A, B, C. The published rule (A is tied with the others, so the Aîné themes win) would pick B, C, D. The detailed explanation lines below are correct; only the summary sentence is wrong.
**Fix:** Write « moins de 2 positions d'écart avec le quatrième » for the guaranteed places, or align the code with the sentence.

### IN-02: Unquoted dist path in the Playwright `webServer` command

**File:** `playwright.config.ts:21`
**Issue:** `node e2e/serveur.ts ${dist} ${port}` runs through a shell. A clone path containing a space (`REPO_ROOT` is absolute) splits the argument.
**Fix:** `command: \`node e2e/serveur.ts ${JSON.stringify(dist)} ${port}\``

### IN-03: GitHub annotations take the first 10 findings whatever their severity

**File:** `scripts/check-dist.ts:59`
**Issue:** `constats.slice(0, 10)` can fill the 10 annotations with warnings and hide the errors that fail the job.
**Fix:** Sort errors first before slicing: `[...constats].sort((a, b) => Number(b.severite === 'erreur') - Number(a.severite === 'erreur')).slice(0, 10)`.

### IN-04: The axe gate ignores "moderate" and "minor" WCAG violations

**File:** `e2e/axe.spec.ts:11`
**Issue:** STACK.md says "fail on any violation". The spec only fails on `serious`/`critical`, yet Méthode publishes an « audit d'accessibilité WCAG 2.2 niveau AA ». Low impact today, because few WCAG-tagged rules are moderate, but the gate is weaker than documented.
**Fix:** Fail on every violation with a WCAG tag, or document the threshold on Méthode.

### IN-05: The privacy section leaves out the GitHub error-report link

**File:** `src/pages/mentions-legales.astro:68`
**Issue:** Only the mail link is described. The « Signaler une erreur (GitHub) » link sends the visitor to a third party (GitHub account, IP address) and should be described the same way.
**Fix:** Add one item: « Le lien « Signaler une erreur (GitHub) » mène à GitHub, qui applique sa propre politique de confidentialité. »

### IN-06: The deployment guard is skipped for any value other than `'1'`

**File:** `src/lib/hebergeur-config.ts:95`
**Issue:** `RTP_DEPLOIEMENT=true` or `yes` silently skips the guard (fail-open).
**Fix:** Reject any value that is set but is neither `'1'` nor empty: `if (env.RTP_DEPLOIEMENT !== undefined && !['', '0', '1'].includes(env.RTP_DEPLOIEMENT)) throw erreur('RTP_DEPLOIEMENT doit valoir 1');`

---

_Reviewed: 2026-11-04T14:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
