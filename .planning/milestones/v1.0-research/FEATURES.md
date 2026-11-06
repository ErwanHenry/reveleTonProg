# Feature Research

**Domain:** Neutral, sourced civic website comparing French presidential candidates' programmes (présidentielle 18 avril / 2 mai 2027), 4 reading levels (résumé, détaillé, enfant 8-12, aîné 65+)
**Researched:** 2026-11-03
**Scope:** Milestone v1.0 = Lot 1 (data skeleton + CI validation) + Lot 2 (M1 référentiel). Polls, game, comparator, audio and journal appear here only as dependencies or anti-features.
**Confidence:** MEDIUM-HIGH. The data.gouv dataset was inspected directly (HIGH). Live 2027 competitors were opened (MEDIUM: WebFetch summaries of pages). The 2012-2022 products come from press and secondary sources (MEDIUM/LOW, marked).

---

## 0. Primary data source: data.gouv « statuts sourcés » (inspected 2026-11-03)

This drives Lot 1 directly, so it comes first.

| Property | Value (verified) |
|---|---|
| Title | « Candidatures à l'élection présidentielle 2027 — statuts sourcés » |
| Dataset page | https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources |
| Dataset id (API) | `6abf8836bbebbc5488a27e4e`, API: https://www.data.gouv.fr/api/1/datasets/6abf8836bbebbc5488a27e4e/ |
| Producer | Organisation « 2027etmoi » (https://www.data.gouv.fr/organizations/2027etmoi), which also runs https://2027etmoi.fr, a comparable product |
| Licence | Licence Ouverte / Open Licence 2.0 (`lov2`) |
| Declared frequency | `weekly` (API field; the HTML page does not show it) |
| Created / last_update | 2026-10-02 / 2026-11-02 (data.gouv metadata). The file's own `mise_a_jour` is **2026-10-28** |
| Temporal coverage | 2026-01-01 → 2027-10-01, spatial `country:fr` |
| Resource | 1 JSON file, **remote** (`filetype: remote`, about 62 KB). Stable data.gouv URL: `https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493`, which returns a 302 to `https://2027etmoi.fr/data/candidats.json` (Netlify, `cache-control: max-age=300`) |
| Declared schema | None (no TableSchema/JSON Schema on data.gouv) |
| Discussions / reuses | 0 discussions; 1 reuse (2027etmoi.fr itself) |
| Upstream repo | https://github.com/2027etmoi/2027etmoi (pushed 2026-11-01). The `data/` folder is under Licence Ouverte 2.0 (`LICENCE-DONNEES.md`). The site code has **no free licence** |

**Actual JSON schema** (observed on the 2026-10-28 file):

```
{
  "mise_a_jour": "YYYY-MM-DD",
  "candidats": [ {
    "id":            "le-pen"            // stable slug, lowercase, hyphenated
    "nom":           "Marine Le Pen"     // FULL NAME in one field (no separate prénom/nom)
    "parti":         "Rassemblement national"   // as self-described, free text
    "bloc":          "gauche|ecolo|centre|droite|souverainiste|extdroite|autre"
    "statut":        "declare|primaire|pressenti|empeche|renonce"
    "statut_detail": "free text, one factual sentence"
    "source":        { "titre": str, "url": str, "date": "YYYY-MM-DD" | "YYYY-MM" }
    "propositions":  [str, ...]          // 0-4 headline proposals, NO per-item source
    "liens":         { campagne?, programme?, parti?, x?, instagram?, youtube?, wikipedia? }
    "verifie_le":    "YYYY-MM-DD"
  } ]
}
```

**Observed values (file dated 2026-10-28):**
- **59 entries**, while the dataset description says « 51 personnalités ». The description is stale, so the importer must not assert a count.
- `statut`: 37 `declare`, 17 `renonce`, 5 `pressenti`. No `primaire` or `empeche` currently, but both are documented in `docs/methode-candidatures.md`.
- Displayed labels used by 2027etmoi: `declare` = « Candidature déclarée », `primaire` = « En primaire », `pressenti` = « Candidature pressentie », `empeche` = « Candidature empêchée », `renonce` = « Ne se présente pas ».
- Only **6 of the 37 declared** candidates have a `liens.programme` (melenchon, cazeneuve, attal, mlekuz, egger, mikolajczak). Expect « programme non publié à ce jour » for most candidate cards in the pilot.
- `source.url` points overwhelmingly at **press**: franceinfo 19, LCP 12, plus CNews, BFM, Public Sénat, etc. Very few point at candidate or party sites.
- One **partial date**: `wauquiez` has `source.date = "2026-07"`. 2027etmoi's method doc explicitly allows `AAAA-MM`.
- `verifie_le` ranges from 2026-09-22 to 2026-10-28.

**Consequences for Lot 1 (actionable):**
1. **Status vocabulary mismatch with the spec.** The spec lists déclaré, en primaire, pressenti, **retiré**, empêché. The dataset uses `renonce` = « Ne se présente pas », which also covers *eliminated in a primary* and *rallied to another candidate*. Calling an eliminated primary candidate « retiré » would be inaccurate. **Recommendation:** adopt the dataset's five codes as the stored enum, so imports are lossless. Display « Ne se présente pas », with `statut_detail` saying why. Record this in an ADR, because it diverges from the spec wording. Erwan validates.
2. **Do not import `bloc`.** It is an editorial classification based on Ministry of the Interior *nuances*, and the id `extdroite` contains a forbidden root. The spec requires « étiquette revendiquée par le candidat ». Import `parti` only.
3. **Do not import `propositions` as mesures.** They carry no per-item source, and 2027etmoi accepts press as a measure source, which our spec forbids. At most they are « indices » for finding the primary source.
4. **Split the name by hand.** The spec wants `nom` + `prénom`, but the dataset has one `nom` field. Automatic splitting fails on « Dominique de Villepin », « Marion Maréchal », « Jean-Luc Mélenchon » and « Nicolas Dupont-Aignan ». Add explicit `prenom`, `nom` and `nom_tri` (sort key), filled manually once for 59 rows.
5. **Reuse the `id` slugs** as our immutable candidate ids. They are stable, readable, and allow a later diff against upstream.
6. **The status source is usually press.** The spec allows a press article as an « indice pour les statuts ». Decide explicitly whether a press URL may be the *displayed* status source. Recommendation: allowed for statuts with `nature: presse` shown visibly, upgraded to a primary source (the candidate's own announcement, or the Conseil constitutionnel list in March 2027) when available. Never allowed for mesures.
7. **Snapshot, don't hot-link.** The resource is remote and unversioned. Store `data/import/2027etmoi-candidats-<mise_a_jour>.json` with its sha256 and fetch date. The importer produces a diff PR (palier B: human review).
8. **Attribution is mandatory** (Licence Ouverte): « Source : 2027 et moi (https://2027etmoi.fr), données mises à jour le JJ/MM/AAAA ». Put it on the Méthode page and in the candidate-page footer.
9. Schema `date` fields must accept `YYYY-MM`, or the importer must flag such rows for manual completion. Recommendation: accept them in `brouillon` and require a full date for `publie`.

Related dataset (for cross-checking only): Repère 2027, https://www.data.gouv.fr/datasets/presidentielle-2027-sondages-candidatures-et-projection-departementale (lov2, weekly). It includes `candidatures-presidentielle-2027.csv` and `positions-candidats-par-theme.csv`. It is an aggregator: never a source of a mesure (2027etmoi itself refuses repere2027 as a source).

---

## 1. Competitor landscape (what exists)

| Product | Period | Model | Key traits relevant to M1 | Confidence |
|---|---|---|---|---|
| **2027etmoi.fr** | 2027, live | Static site + open data (GitHub) | Themes (13), candidate pages, comparator (up to 4), « Mes priorités », votes, polls. Sources typed « Programme / Déclaration / Presse » + date. Theme lists **alphabetical by surname**. Home and candidates list **grouped by political family** (`bloc`). Candidate list shows a **poll average per candidate**. A candidate without a position is **simply omitted** from a question list. Data page uses « non connu ». Error reports via GitHub issues. Public update history | HIGH (repo + pages opened) |
| **votons-2027.fr** | 2027, live | Media-style site | « Quiz politique » computing « tes affinités avec les 25 candidats ». Duel comparator. **Visitor vote « Le sondage Votons »** (12,742 votes). Poll block sourced « Wikipédia ». Non-alphabetical candidate order with no stated criterion. Glossaire, « Enseignants » page, Méthodologie, Sources | MEDIUM |
| **repere2027.fr** | 2027, live | Association loi 1901 + data.gouv | 8 themes. Same format for every candidate. Missing position worded « n'est pas établie ». Candidate amounts « rapportés comme des annonces ». **Candidate selection = the 15 tested in an Ifop poll** (others listed at the bottom) | MEDIUM |
| **quiproposequoi2027.fr** | 2027, live | Plain-French site | « Sans jargon »; difficult words underlined with a definition on hover/tap. Colour legend: blue = measure with a figure, white = intention with no figure, **red = « rien de public à ce jour »**, with the line « une absence de position, pas un jugement » and « "Rien dit" est une info ». Alphabetical order, « Aucun classement ». « Mis à jour » date per page. Correction form that stores nothing | MEDIUM |
| **IFRAP comparateur** | 2027, live | Think-tank | Alphabetical by surname. Missing = « Proposition non encore connue ». Visible content shows no per-position sources | MEDIUM |
| **candidats2027.org** | 2027 | PDF library | Programmes as PDFs, no rewording, many « en attente » | LOW (search snippet) |
| **sondages-presidentielle2027.fr, p2027.fr** | 2027 | Aggregators | « forces, faiblesses », « faisabilité »: evaluative content | LOW (search snippet) |
| **Le Monde comparateur (Les Décodeurs)** | 2022 | Newsroom | About 1,000 proposals from 12 candidates, about 100 items in 9 themes, plus a "main divides" overview. No tool named « décodeur des programmes » was found | LOW-MEDIUM (secondary) |
| **Voxe.org** | 2012-2017 | Association → SAS | Volunteers enter proposals from official programmes « sans éditorialisation ». Compare 2 candidates in 3 clicks. 11 programmes × 13 themes (2017). Open data on data.gouv. Activity in 2027 unknown | MEDIUM (multiple secondary) |
| **La Boussole présidentielle (Cevipof / Kieskompas)** | 2012, 2017, 2022 | VAA (voting advice app) | About 15 questions; user placed on a 2-D map. Researchers justify each candidate position with citations in open access. **Email required for results (2017)** | MEDIUM |
| **Elyze** | 2022 | Swipe app | About 500 anonymous proposals, swiped. Controversies: CNIL review (political opinions are sensitive data, resale of "anonymised" data was reserved), **tie-break favoured Macron** (first in the code), **unequal number of proposals per candidate**, 15 candidates chosen **by polls**, closed source, a proposal text was tampered with by a third party | MEDIUM (onepoint, Euronews, Stratégies, Contrepoints) |
| **vie-publique.fr** | various | Official (DILA) | No 2027 candidate or programme fiches found. Useful for neutral institutional explainers (role of the President, how the vote works, poll rules), not programmes | MEDIUM ("didn't find" is not "doesn't exist") |

**Key takeaway:** the 2027 field is crowded with "sourced, neutral" comparators. None of them offers a **kid level and a senior level of the same measure**, **archived copies of sources**, or **typed empty cells carrying a last-checked date**. Several of them do things our spec forbids: press as a measure source, grouping by political family, selection by polls, visitor votes, affinity quizzes, poll averages on candidate lists. That makes reveleTonProg's neutrality rules themselves a differentiator, if they show visibly.

---

## 2. Feature Landscape

### Table Stakes (Users Expect These)

Every serious competitor has these. Missing one means the site looks amateur or partisan.

| # | Feature | Why Expected | Complexity | Notes / M1 implementation |
|---|---|---|---|---|
| T1 | **Theme → candidates page** | Core navigation of every comparator | MEDIUM | One page per theme, optionally anchored by sous-thème. With **37 declared candidates**, page weight is the real constraint (see T14) |
| T2 | **Candidate → themes page** | Every competitor has candidate fiches | MEDIUM | One page for **each of the 59** personalities (spec: « toutes les personnalités »), including `renonce` ones. Header: name, claimed label, status badge, official site |
| T3 | **Primary source per measure, with date** | Expected by every competitor (« chaque information est sourcée ») | MEDIUM | Show source type, title, **date of the document**, **date consulted**, link to the original **and** to the archived copy. Lot 1 CI enforces it |
| T4 | **Candidate status with date and source** | 2027etmoi, France-Vote and others display it. 59 personalities with mixed statuses would mislead without it | LOW | Text badge (never colour alone), e.g. « Candidature déclarée · franceinfo, 6 sept. 2026 · vérifié le 28 oct. 2026 » |
| T5 | **Party label as self-described** | Universal. Imposed label = partisan accusation | LOW | Import `parti` verbatim (e.g. « Sans parti (association Les Gaulois) ») |
| T6 | **Explicit empty states, never silent omission** | quiproposequoi, repere2027 and IFRAP all label gaps. 2027etmoi omits the candidate, which is the weaker pattern | LOW-MEDIUM | Typed enum + date checked. See §3 |
| T7 | **Neutral default ordering = alphabetical by surname** | quiproposequoi, IFRAP and 2027etmoi theme lists. Spec requirement | LOW | French collation (`Intl.Collator('fr')` at build), explicit `nom_tri` (« de Villepin » → V, « Le Pen » → L, « Dupont-Aignan » → D) |
| T8 | **Méthode page** | All competitors have « Méthodologie / notre méthode / comment cette page est faite » | LOW (code) / MEDIUM (writing) | Source rules, forbidden words, ordering rule, empty-state meanings, equity rule, data.gouv attribution, review process |
| T9 | **Mentions légales** | Legal obligation (LCEN, now **art. 1-1** since loi SREN, May 2024) | LOW | Éditeur (Erwan Henry, per spec decision), directeur de la publication, hébergeur (Hetzner: name, address, phone). Cite **art. 1-1**, not the outdated « art. 6 III » |
| T10 | **Qui sommes-nous** | Every competitor. Credibility of an independent civic site | LOW | Neutral, no third-party branding (spec), funding statement (« aucun financement politique, pas de publicité ») |
| T11 | **Report an error** | 2027etmoi (GitHub issues), repere2027 (email), quiproposequoi (form) | LOW | v1.0: `mailto:` link + GitHub issue link on every measure (« Signaler une erreur sur cette mesure », pre-filled measure id). Form and journal = M5 later |
| T12 | **"Last updated" date per page** | quiproposequoi « Mis à jour », 2027etmoi | LOW | Build-time: max(date) of the content shown on the page |
| T13 | **Mobile-first, readable layout** | Majority of traffic is mobile, especially for young users | MEDIUM | Single column, no horizontal-scroll grids. Comparison tables are M4 |
| T14 | **Fast and light pages** | Spec: < 500 KB, < 1 s on 4G | MEDIUM-HIGH | **Real risk**: no-JS level toggle means all 4 rédactions sit in the HTML. 37 candidates × several measures × (25+200+60+120 words) can reach several hundred KB uncompressed. Mitigations: theme page shows Résumé/Enfant/Aîné inline and puts Détaillé behind a per-measure `<details>`, or split themes by sous-thème. Brotli. Budget test in CI |
| T15 | **Keyboard and screen-reader access on toggles** | Spec, plus WCAG AA expectations of public-facing civic sites | MEDIUM | Native radio inputs (`<fieldset><legend>Niveau de lecture</legend>`), visible focus, `:has()` switching |
| T16 | **Glossary of hard terms** | votons-2027 and quiproposequoi both have it | MEDIUM | Same glossary feeds the kid « explique-moi » (D3) and party-name explanations |
| T17 | **Election dates block** | Every competitor shows the calendar or a countdown | LOW | Static text with source (info.gouv.fr), no JS countdown needed |

### Differentiators (Competitive Advantage)

These match the Core Value: any visitor, right level, under 3 minutes, every line sourced, no side taken.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| D1 | **Four rédactions of the same measure + "lunettes" toggle, works without JS, choice remembered** | No competitor has kid + senior levels. quiproposequoi has a single "sans jargon" level | HIGH (content) / MEDIUM (code) | CSS radios + `:has()`, with a JS enhancement for localStorage. Without JS: default Résumé, selectable per page. Rédactions are written in Lot 1/2 data and reviewed by Erwan |
| D2 | **Niveau Aîné: larger type by default + « ce qui me concerne » filter** | Puts retraites, santé, dépendance, succession and logement first | MEDIUM | Filter = reorder themes on the home/hub and candidate pages, using `themes.prioritaires_aine`. Without JS: a dedicated static page `/aine/` listing those themes first. Base font ≥ 20 px at this level (FALC minimum is corps 14 pt ≈ 18.7 px), targets ≥ 44 px, no hover-only interaction |
| D3 | **Niveau Enfant: « explique-moi » definitions** | 8-12 year olds can read alone. Parties never named without explanation | MEDIUM | Make each term a `<a href="#def-…">` to an on-page mini-glossary (works everywhere without JS), enhanced into a Popover (`popover` attribute, Baseline 2025, so not on older iPads). Must satisfy WCAG 1.4.13 (dismissible with Esc, hoverable, persistent) and open on **tap/focus**, not hover only. FALC says « ne pas souligner »: use a dotted underline plus an icon, distinct from links |
| D4 | **Archived copy of every source in the repo** | Campaign sites change or vanish; we can prove what was said on the consultation date | MEDIUM | Link « copie archivée du JJ/MM/AAAA » next to the live link. Disk constraint on the VPS (spec §8) |
| D5 | **Typed empty states with "checked on" date** | Turns a gap into information (« "Rien dit" est une info », quiproposequoi) and proves equity | LOW | See §3 |
| D6 | **Equity gate in CI** | A theme cannot be `publie` unless every *declared* candidate has a mesure or an explicit empty state on it. No competitor enforces this mechanically | MEDIUM | Lot 1 rule. Elyze's "unequal number of proposals" controversy is exactly what it prevents |
| D7 | **Transparent random order** | Alphabetical order structurally favours A-names (Arthaud, Asselineau, Attal at the top). Random order on demand counters it | LOW-MEDIUM | JS-only (a static site cannot shuffle per visit without JS); the no-JS fallback stays alphabetical, with a sentence explaining why. Label « Ordre tiré au sort, cliquez pour un nouveau tirage » + « Revenir à l'ordre alphabétique ». Data field `ordre_cc` (nullable) prepared for the Conseil constitutionnel order (drawn by lot since 1981, list expected around mid/late March 2027) |
| D8 | **Visible neutrality charter** | Neutrality claims are everywhere. Showing the *rules* (forbidden words, own costing only, claimed label, no poll-based order) and that CI enforces them is rare | LOW | Short box on the Méthode page plus a link from every theme page |
| D9 | **Candidate's own costing, labelled as such** | repere2027 « rapportés comme des annonces »; spec §5 | LOW | Wording template: « Le candidat chiffre cette mesure à … (source) ». Third-party costing only as a named supplement, never in v1.0 by default |
| D10 | **« Ce qui existe déjà dans la loi » in Détaillé** | Helps students and journalists. Rare among competitors | MEDIUM (content) | Source = Légifrance / service-public. Counts as primary for law facts |
| D11 | **Open code and data (repo public at launch)** | 2027etmoi does it, but its code has no free licence. Credibility | LOW | Pick a licence: code MIT/EUPL, content Licence Ouverte 2.0. The ADR is needed before going public |
| D12 | **Print-friendly CSS** | Seniors and teachers print. Near-zero cost | LOW | `@media print`: chosen level only, source URLs written out in full |
| D13 | **Readability check of the Enfant level in CI** | Spec success criterion (Flesch adapted to French, CM1) | MEDIUM | Kandel-Moles formula plus word list. Put it in Lot 1 validation as a *warning* in `brouillon` and an *error* in `publie` |
| D14 | **Teachers' page** (votons has « Enseignants ») | School usage is a big channel for the kid level | LOW | **Defer** to after v1.0 |

### Anti-Features (Deliberately NOT Built)

Several competitors chose these. Each one conflicts with the spec's neutrality, legal or privacy rules.

| Anti-Feature | Who does it / why requested | Why Problematic | Alternative |
|---|---|---|---|
| **Affinity quiz / "de quel candidat êtes-vous proche" (VAA)** | votons « tes affinités », Boussole, Elyze. High engagement | Infers political opinions, which are sensitive data under GDPR art. 9 (inferred data included, per CNPD 2023). Elyze ended up under CNIL review. Algorithmic bias accusations (tie-break favoured Macron). The spec says "pas un outil de profilage" | M3 later: a 100 % local game with no score and no ranking (« jeu, pas un test d'affinité »). **Nothing in v1.0** |
| **Visitor votes / "sondage du site"** | votons « Le sondage Votons » | Not a sondage under the loi 77-808: no representative sample (décret 80-351 art. 2; Commission communiqué of 28 March 2012). Misleads, is easy to manipulate, and clashes with the M2 pedagogy | None. M2 shows only polls with a notice from the Commission des sondages |
| **Order or selection by poll score** | repere2027 (the 15 tested by Ifop), Elyze (15 by polls), votons (unexplained order) | Self-fulfilling visibility bias. Explicitly banned by the spec | Alphabetical, random on demand, CC order later. Inclusion = dataset status, not polls |
| **Grouping by political family / blocs** | 2027etmoi (`bloc`, Ministry nuances) | Editorial classification not claimed by candidates. The « extdroite » kind of label touches the forbidden words | Claimed label only. Search/filter by status, not by family |
| **Party colours on candidates** | Common in media | Spec: colours serve themes, never candidates. Implies alignment | Neutral grey for all candidates. Theme colours only |
| **Poll average on candidate list or page** | 2027etmoi candidate list | Ranks implicitly. Pollutes M1 with M2 content before its pedagogy screen exists | Polls only in M2, behind the pedagogy screen |
| **Evaluative content (forces/faiblesses, faisabilité, notes, "réaliste")** | sondages-presidentielle2027, p2027 | Judgment. Forbidden-word territory | Candidate's own costing. Third-party costing named, never as a verdict (2027etmoi « on ne reprend jamais le verdict ») |
| **Press article as a measure source** | 2027etmoi `nature: presse` | Spec §5 forbids it. Second-hand paraphrase | Press = clue only. Without a primary source the cell stays « non précisé » |
| **Silently omitting a candidate without a position** | 2027etmoi « questions clés » | Reads as neglect or bias. Breaks equity | Typed empty state with checked date (§3) |
| **Red (or any alarm colour) for "no position"** | quiproposequoi (red = « rien de public ») | Red connotes fault despite the disclaimer | Neutral grey + text + icon. Never colour alone |
| **Hiding or deleting withdrawn candidates** | votons « Anciens candidats » separate section (acceptable) vs deletion (not) | Loses history. Spec: ids never change, retirés keep their history | Keep candidate pages, with a status badge and date. Theme pages: declared (+ primaire) by default, pressentis in a "voir aussi" block, `renonce` out of theme grids but linked |
| **Third-party embeds (YouTube, X, Instagram), analytics, share widgets, web fonts from CDNs** | Ubiquitous | Third-party cookies and requests break spec §5 (no third-party cookie or script) and the page budget | Plain links (« voir la vidéo sur YouTube »), self-hosted fonts or system fonts, Caddy logs for audience |
| **Press photos of candidates** | Common | Copyright. Spec forbids it | Wikimedia Commons with verified licence + author credit, or no photo (default to none in v1.0 for equity: 59 people, uneven photo availability) |
| **AI chatbot / "pose ta question au programme" / auto-written rédactions published directly** | Trendy | Hallucination equals invented content, which the spec's absolute rule forbids | Agent drafts → `brouillon` → human review (palier C) |
| **Comments, accounts, newsletter** | Engagement | Moderation load, personal data. Out of v1 scope in the spec | Error-report mailto/issue |
| **Deterministic hidden tie-breaks** | Elyze (the first candidate in code wins ties) | Invisible bias | Every ordering rule documented on the Méthode page. Random uses a uniform shuffle (Fisher-Yates, `crypto.getRandomValues`) |
| **Publishing new content during the electoral silence weekend** | Pipeline automation | Code électoral L49 bans electronic propaganda from the eve of the vote at 0h. A neutral site is not propaganda, but CE 2009 says existing content may stay *unmodified*, and CNCCEP 2022 warned against relaying propaganda, even through links. Prudence | Content freeze in the pipeline (lot 5) for 17-18 April and 1-2 May, the same windows as the poll block. **Not v1.0 code, but a design rule to record now** |

---

## 3. M1 specifics asked for

### 3.1 "No position" cells: recommended typed states

| State (data) | Displayed text (FR) | Scope | When |
|---|---|---|---|
| `programme_non_publie` | « Programme non publié à ce jour » + « vérifié le JJ/MM/AAAA » | Candidate-level, repeated on each theme cell | No programme document found (31 of 37 declared today) |
| `non_precise` | « Non précisé » + « Le programme publié le JJ/MM/AAAA ne contient pas de mesure sur ce thème. Vérifié le … » | Candidate × theme | A programme exists but is silent on the theme |
| (rédaction level) | « Le candidat ne précise pas » | Inside one rédaction | E.g. Aîné effect on pensions not stated (spec §3 coherence rule) |
| `a_verifier` | Never displayed | Internal | Blocks `publie` of the theme (equity gate D6) |

Rules: the empty-state text carries **its own "checked on" date** (that is what separates it from neglect). Neutral grey, never red. Add an explainer link: « Pourquoi une case vide ? », leading to the Méthode page. Competitor wordings for reference: « n'est pas établie » (repere2027), « Proposition non encore connue » (IFRAP), « rien de public à ce jour » (quiproposequoi), « non connu » (2027etmoi data page).

### 3.2 Sources display

The pattern is a source line under every measure, in all levels:
`Source : [type] « titre » — publié le JJ/MM/AAAA · consulté le JJ/MM/AAAA · [lien original] · [copie archivée]`
Types (closed enum, primary only for mesures): `programme`, `site_candidat`, `site_parti`, `discours`, `tribune`, `depot_cc`. For candidate *statuts*, `presse` is additionally allowed (see §0, point 6). 2027etmoi's « Programme / Déclaration / Presse » badge is the closest precedent. Ours is stricter.

### 3.3 Candidate ordering

- Default: alphabetical by `nom_tri`, French collation. Document the particle rule.
- On demand: random (JS). The no-JS fallback is alphabetical, with an explanation.
- Later: Conseil constitutionnel order (drawn by lot; « L'ordre des candidats … est déterminé par tirage au sort », CC 2022 site). Option after the official list (expected mid/late March 2027).
- Never: polls, blocs, "notoriety", data-entry order.

### 3.4 Candidate status

- Badge text from the five codes (labels as in §0), with date and source. `statut_detail` shown on the candidate page.
- Counters, if any, should copy 2027etmoi's careful distinction: « déclarées ou en primaire » vs « pressenties » (pressentis are not counted as candidacies).
- Equity rule (spec §5) applies to **declared** candidates (37 today). Pressentis are shown but not required for theme publication. Recommend an ADR, since the spec says "candidats déclarés".

### 3.5 Kid-friendly (8-12)

- 40-60 words, CM1 vocabulary, concrete metaphor (école, cantine, argent de poche). Never a party name or acronym alone: link to a glossary entry using the party's self-description.
- Definitions on tap/focus/hover (D3), plus an on-page glossary fallback.
- CI readability check (D13), and the cross-check that the kid version adds no figure absent from the source (spec §12 trap). A simple automated heuristic: every number in `enfant` must appear in `texte_source`.
- Avoid: anxiety framing, "good/bad", emoji-heavy UI.

### 3.6 Elderly (65+)

- Larger default type at the Aîné level (≥ 20 px body), high contrast (AA minimum, aim for AAA on body text), large targets (≥ 44 px), no hover-only content, no auto-moving content, clear "where am I" breadcrumbs (NN/g: older users struggle with small, faint text and small targets).
- « Ce qui me concerne » filter (D2) and print CSS (D12). Audio comes later (lot 6), but the HTML structure should already allow one audio element per rédaction.

---

## 4. Feature Dependencies

```
[JSON Schemas: candidats, themes, mesures (+ sondages, journal stubs)]   (Lot 1)
    ├──requires──> [Status enum decision (5 dataset codes) + ADR]
    ├──requires──> [Source model: type enum, dates, archive path]
    └──requires──> [Empty-state enum (programme_non_publie / non_precise / a_verifier)]

[data.gouv importer + snapshot + diff PR]
    └──requires──> [candidats schema with prenom/nom/nom_tri manual fields]

[CI validation]
    ├── source primaire + archive exists ──> blocks [any mesure page]
    ├── forbidden words ─────────────────> applies to all rédactions + empty-state texts
    ├── length rules per level
    ├── enfant/aîné required for `publie`
    ├── equity gate (all declared covered) ──> required before [theme status publie]
    └── (opt.) readability + "no new numbers in enfant"

[Theme pages] ──requires──> [themes collection + mesures + empty states]
[Candidate pages] ──requires──> [candidats collection (all 59)]
[Theme<->candidate cross-links] ──requires──> both pages

[Level toggle (CSS :has)] ──requires──> [all 4 rédactions rendered in HTML]
    └──conflicts(tension)──> [< 500 KB page budget]  -> resolve with <details> / sous-thème split
[localStorage memory] ──enhances──> [Level toggle]
[Aîné "ce qui me concerne"] ──requires──> [themes.prioritaires_aine]
[Enfant "explique-moi"] ──requires──> [glossary collection]  (add to Lot 1 schemas)
[Random order] ──requires──> [JS island]; [CC order] ──requires──> [ordre_cc field] (later)

[Méthode page] ──requires──> [final rules above]; ──includes──> [Licence Ouverte attribution]
[Mentions légales] ──requires──> [hosting decision: Hetzner details]  (draft now, finalise lot 3)

[M4 comparator] ──reuses──> [empty-state enum + ordering]   (later)
[M5 journal] ──reuses──> [source model + git history]        (later)
[Electoral-silence freeze] ──shares──> [M2 hard-coded block windows]  (later)
```

### Dependency Notes

- **The glossary must be a Lot 1 collection.** It is not in the spec's five collections, but D3 (Enfant) and T16 need it, and party-name explanations need it. Recommend `glossaire/` (term, définition 1 phrase, source, statut) under the same CI rules.
- **The status enum and empty-state enum must be fixed in Lot 1.** Every Lot 2 template branches on them. Changing them later requires a scripted migration (spec §7).
- **The equity gate depends on knowing who is "declared" at build time.** That is the imported status. A status change from `pressenti` to `declare` can therefore unpublish a theme until the new candidate's cell is filled. This is intended, but expect it to happen often (the field changes weekly).
- **Page budget vs no-JS toggle** is the main M1 tension. Decide the rendering strategy in Lot 2 planning (see T14).

---

## 5. MVP Definition

### Launch With (v1.0 = Lot 1 + Lot 2)

- [ ] Schemas with the 5-code status enum, the source model, the empty-state enum, `nom_tri`, and a glossary collection: everything else depends on them
- [ ] data.gouv snapshot importer (59 rows, `bloc` and `propositions` dropped) plus a manual name split: the spec's candidate perimeter
- [ ] CI: primary source + archive, forbidden words, lengths, enfant/aîné for `publie`, equity gate, partial-date rule: the Lot 1 deliverable
- [ ] Theme pages (3 pilots) and candidate pages (59), cross-linked: the core M1 flows
- [ ] 4-level toggle without JS + localStorage memory + ARIA/keyboard: the core differentiator
- [ ] Typed empty states with checked date: honesty, with 31 of 37 declared having no programme
- [ ] Alphabetical (French collation) + random on demand (JS): spec requirement
- [ ] Aîné: larger type + « ce qui me concerne »; Enfant: definitions with tap/focus + glossary fallback
- [ ] Méthode, Mentions légales (LCEN art. 1-1), Qui sommes-nous, error-report link, data.gouv attribution
- [ ] Page budget test (< 500 KB) and basic a11y check in CI

### Add After Validation (v1.x)

- [ ] Print stylesheet (D12): add when there is senior or teacher feedback; it is almost free, so it can slip into Lot 2 if time allows
- [ ] Readability score in CI as a blocking rule (D13): once a baseline of reviewed enfant texts exists
- [ ] Conseil constitutionnel ordering option: when the official list is published (around mid/late March 2027)
- [ ] Teachers' page (D14)

### Future Consideration (later milestones, per spec)

- [ ] M2 polls, M3 game, M4 comparator + PDF, M5 journal + form, M6 votes, audio, "pièces": planned lots 4-7
- [ ] Electoral-silence content freeze in the pipeline: lot 5, rule recorded now

---

## 6. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Schemas + enums + CI source rule | HIGH | MEDIUM | P1 |
| data.gouv importer + snapshot | HIGH | LOW | P1 |
| Equity gate in CI | HIGH | MEDIUM | P1 |
| Theme + candidate pages | HIGH | MEDIUM | P1 |
| 4-level toggle (no-JS) | HIGH | MEDIUM | P1 |
| Typed empty states + date | HIGH | LOW | P1 |
| Alphabetical order (fr collation, nom_tri) | HIGH | LOW | P1 |
| Random order (JS) | MEDIUM | LOW | P1 (spec) |
| Aîné filter + large type | HIGH | MEDIUM | P1 |
| Enfant definitions + glossary | HIGH | MEDIUM | P1 |
| Méthode / Mentions / Qui sommes-nous | HIGH | LOW | P1 |
| Error-report link | MEDIUM | LOW | P1 |
| Page-weight budget test | MEDIUM | LOW | P1 |
| Archived source copy link | MEDIUM | MEDIUM | P1 (spec) |
| Print CSS | MEDIUM | LOW | P2 |
| Readability CI (blocking) | MEDIUM | MEDIUM | P2 |
| Election dates block | LOW | LOW | P2 |
| Teachers' page | MEDIUM | LOW | P3 |

---

## 7. Competitor Feature Analysis (M1-relevant)

| Feature | 2027etmoi | votons-2027 | repere2027 | quiproposequoi | Our Approach |
|---|---|---|---|---|---|
| Measure source | Programme / Déclaration / **Presse** + date | « sourcés », details unclear | Programme, else dated press statement | Primary + dated | **Primary only** + consulted date + archive |
| Empty cell | Omitted (questions) / « non connu » | Not observed | « n'est pas établie » | Red « rien de public à ce jour » | Grey, typed, with checked date |
| Candidate order | Alphabetical (theme), **by bloc** (lists) | Unexplained | Fixed, unexplained; **selection by poll** | Alphabetical | Alphabetical / random / CC later |
| Status | 5 codes, « Ne se présente pas » | Candidats / Anciens candidats | Count of positions | « en cours d'élaboration » | 5 codes + date + source badge |
| Reading levels | One | One + glossary | One | One "sans jargon" + definitions | **Four** + definitions + Aîné filter |
| Quiz / profiling | « Mes priorités » | **Affinity quiz** | No | No | **None** in v1.0 (M3 no-score game later) |
| Visitor votes | No | **Yes** | No | No | **Never** |
| Open data/code | Data LO 2.0, code unlicensed | No | Data on data.gouv | « libre réutilisation » | Data + code open at launch |

---

## Sources

Opened during this research (2026-11-03):
- data.gouv dataset page: https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources (HIGH)
- data.gouv API: https://www.data.gouv.fr/api/1/datasets/6abf8836bbebbc5488a27e4e/ (HIGH)
- Resource redirect: https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493 → https://2027etmoi.fr/data/candidats.json (downloaded and analysed, HIGH)
- 2027etmoi repo (licence, method docs `docs/methode-candidatures.md`, `docs/methode-sources.md`): https://github.com/2027etmoi/2027etmoi (HIGH)
- 2027etmoi pages: https://2027etmoi.fr/, https://2027etmoi.fr/themes/, https://2027etmoi.fr/themes/retraites.html, https://2027etmoi.fr/candidats.html (MEDIUM)
- Repère 2027 dataset (API): https://www.data.gouv.fr/datasets/presidentielle-2027-sondages-candidatures-et-projection-departementale (HIGH for metadata)
- https://votons-2027.fr/ and https://votons-2027.fr/comparer (MEDIUM)
- https://repere2027.fr/programmes/ (MEDIUM)
- https://quiproposequoi2027.fr/ (MEDIUM)
- https://www.ifrap.org/comparateurs/presidentielles-2027 (MEDIUM, partial read)
- Conseil constitutionnel, ordering by lot: https://presidentielle2022.conseil-constitutionnel.fr/les-candidats/etre-candidat/la-liste-officielle-des-candidats-suit-elle-un-ordre-particulier.html (HIGH)
- NN/g, usability for seniors (2019): https://www.nngroup.com/articles/usability-for-senior-citizens/ (MEDIUM)
- W3C, WCAG 2.2 SC 1.4.13: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html (HIGH)
- MDN, Popover API (Baseline 2025): https://developer.mozilla.org/en-US/docs/Web/API/Popover_API (HIGH)

From search results (not opened individually; MEDIUM/LOW):
- Elyze/CNIL: https://www.strategies.fr/actualites/marques/LQ121163C/la-cnil-va-se-pencher-sur-l-application-elyze.html, https://www.euronews.com/my-europe/2022/01/18/french-voting-app-sparks-concerns-over-data-protection-ahead-of-election, https://www.groupeonepoint.com/fr/publications/elyze-risque-de-manipulation-de-lopinion-ou-innovation-au-service-du-debat-democratique/, https://contrepoints-archives.org/lapp-elyze-presidentielle-2022-les-affres-du-genie-et-du-succes/
- Boussole présidentielle: https://www.sciencespo.fr/fr/actualites/la-boussole-presidentielle-une-arme-contre-lindecision/, https://business.ladn.eu/news-business/actualites-media/cevipof-et-20-minutes-lancent-un-outil-pour-se-reperer-pendant-les-elections/
- Voxe: https://siecledigital.fr/2017/03/10/presidentielles-2017-on-a-rencontre-voxe-comparateur-programmes-politiques/, https://blog.voxe.org/about
- Le Monde 2022 comparator (secondary): https://www.macommune.info/presidentielle-200-comparatif-programme-candidat-comparateur/
- Sondages vs online consultations (loi 77-808, décret 80-351 art. 2, communiqué 28/03/2012): https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE80645.pdf
- Code électoral L49 / CNCCEP 2022: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215, https://www.cnccep.fr/pdf-cp15.html
- LCEN art. 1-1 after loi SREN: https://legalnest.io/en/guides/legal-notice-website-france/, https://www.simonnetavocat.fr/mentions-legales-dun-site-internet-obligations-sanctions-et-modele/
- GDPR art. 9, inferred political opinions (CNPD Luxembourg 2023): https://cnpd.public.lu/content/dam/cnpd/fr/dossiers-thematiques/campages-electorales/lignes-directrices-les-campagnes-lectorales-dans-le-respect-de-la-protection-des-donnes-personnelles-022023.pdf
- FALC rules (corps 14, no underline): https://falc.unapei.org/quest-ce-que-le-falc/les-regles-du-falc/
- Arcom 2027 recommendation not yet published as of the search; equity/equality rules apply to audiovisual services, not to a static website (MEDIUM)

---
*Feature research for: neutral French presidential programme comparator (reveleTonProg)*
*Researched: 2026-11-03*
