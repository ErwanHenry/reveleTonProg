# Pitfalls Research

**Domain:** Neutral French civic website presenting 2027 presidential candidates' programs (static Astro + YAML in Git, 4 reading levels incl. children 8-12 and seniors 65+)
**Researched:** 2026-11-03
**Confidence:** MEDIUM overall. Legal texts: HIGH (Legifrance and CNIL pages opened today). Dataset findings: HIGH (the data.gouv JSON was downloaded and inspected). Neutrality track record: MEDIUM (few documented post-mortems). Technical: HIGH for `:has()` and GitHub limits, MEDIUM for readability.

> Phase vocabulary used below: **Lot 1** = data, schemas, CI validation. **Lot 2** = M1 pages, Méthode, Mentions légales, Qui sommes-nous. **Later** = lots 3-7 (noted only).

---

## Critical Pitfalls

### Pitfall 1: Importing the data.gouv "statuts sourcés" dataset as-is

**What goes wrong:**
The spec calls this dataset the starting list of candidates. I downloaded the JSON (`mise_a_jour: 2026-10-28`, resource `06237c53-…`). It does not match the spec's model, and parts of it break the spec's own rules:
- **Status vocabulary differs.** The data uses `declare` (37), `pressenti` (5) and `renonce` (17). The spec wants `déclaré, en primaire, pressenti, retiré, empêché`. `renonce` lumps together "lost the PS primary on 11 Oct 2026" (Faure, Guedj, Royal, Maurel), "chose not to run" (Bardella, Wauquiez) and "was never a candidate". No entry is `en primaire` today.
- **A `bloc` field with values like `extdroite`, `gauche`, `souverainiste`.** These are labels the site assigns, not ones the candidates claim, and `extdroite` contains a forbidden word ("extrême"). Importing it breaks section 5 of the spec.
- **A `propositions` field.** These are 0-4 one-line summaries per person written by the dataset author, not taken from primary sources. If they turn into `mesures`, they become unsourced content.
- **Status sources are mostly press:** LCP, franceinfo, CNews, Sud Radio, Le Télégramme, 20 Minutes. Five candidates (billetdoux, collovati, legendre, markovic, rohou) share one source: the franceinfo round-up "34 candidats au 22 octobre 2026". One source is a SIRENE registry entry.
- **The counts disagree.** The dataset page says 51 personalities; the file holds 59.
- **The date format is inconsistent.** `wauquiez.source.date = "2026-07"` (month only).
- **Party labels are not always self-claimed:** "Divers droite (sans parti)" uses the Interior ministry's grid, "Ex-Renaissance" (le-maire) is the dataset author's own description.

**Why it happens:**
The spec trusts the dataset as a citizen source. It is good as a discovery index but is not a primary source. The spec itself says "à recouper avec la source datée de chaque ligne".

**How to avoid:**
- Write an **import script** (`scripts/import-statuts.*`). It maps into the project's own schema and **drops `bloc` and `propositions`**. The upstream id is kept in `ids_externes.2027etmoi`.
- Keep an explicit **mapping table**: `declare → declare`, `pressenti → pressenti`, `renonce → retire` *or* `elimine_primaire` (a new value, or `retire` with a `motif` field), and add `empêché` and `en_primaire` by hand. Write the decision down as an ADR.
- Add `source.type` (enum: `candidat` | `parti` | `institution` | `presse`) to every status source. CI rule: `presse` is allowed for a status only with a flag `a_recouper: true`. A candidate shows "déclaré" on the site only when there is a `candidat`, `parti` or `institution` source, or Erwan has explicitly accepted press for that line (the source type is shown on the site).
- The schema requires `YYYY-MM-DD`. The import script rejects or flags partial dates.
- Each `parti` label must point to the candidate's or party's own site or statement (`parti_source`). CI fails when it is missing.

**Warning signs:**
`bloc`, `extdroite` or `propositions` appear anywhere in `content/`. A status whose only source is a press round-up. 59 files where the Méthode page says 51.

**Phase to address:** Lot 1 (import script, schema, CI). This must be done before any candidate file is committed.

---

### Pitfall 2: Unstable or colliding candidate ids

**What goes wrong:**
Upstream ids are bare surnames: `philippe`, `bertrand`, `martin`-style, `brun`, `mathieu`, `legendre`. Reusing them causes collisions with a future homonym (another Bertrand or Philippe on the official list). Building ids from `prénom-nom` and later "fixing" a typo or an accent breaks URLs, the journal history and M6 vote links. The spec says an id never changes.

**Why it happens:**
Ids look cosmetic in Lot 1. Their cost only shows up when URLs are public and the journal (M5) relies on history.

**How to avoid:**
- Use your own id = `prenom-nom` ASCII slug, frozen at creation, and add a `wikidata` QID (uniquely tells homonyms apart and links to Commons photos).
- Keep an `ids.lock` registry (or CI that diffs against `origin/main`). **CI fails when an id disappears or is renamed.** File name = id.
- Store display names separately (`nom_affiche`, `nom_tri`) so name corrections never touch the id.
- Withdrawn candidates stay as files (`statut: retire`), never deleted.

**Warning signs:**
A PR that renames a file in `content/candidats/`. Two people with the same surname.

**Phase to address:** Lot 1.

---

### Pitfall 3: Status churn is modelled as an overwritten field, and it peaks during the delivery window

**What goes wrong:**
According to the dataset's own `statut_detail`, December 2026 is crowded:
- the Écologistes hold an internal referendum on 10-13 Dec 2026 (Tondelier could run alone or withdraw);
- Hollande is expected to decide in December;
- Bertrand pushed his official declaration to the end of the year;
- Villepin says he will decide "dans les prochaines semaines".

Marine Le Pen's cassation appeal is expected "au plus tard début avril 2027", so an `empêché` status could arrive just after the Conseil constitutionnel list (mid or late March 2027). A single `statut` field loses the history the spec requires, and pages cached or built before the change show stale statuses.

**Why it happens:**
The spec lists "date du statut, source du statut" as flat fields.

**How to avoid:**
- Schema: `statuts: [{valeur, date, source, motif}]` as an **append-only** array. The current status is the latest entry. CI checks that the dates are ordered and that no past entry was edited (diff check).
- Every page shows the status **with its date** ("déclaré · source du 9 sept. 2026").
- Show a "dernière vérification" date (`verifie_le`) on every candidate page. CI warns when it is older than N days (start with 14, tighten later).
- Theme pages list withdrawn or eliminated candidates in a collapsed "ont renoncé" section, not mixed in with the active ones, so their measures stay reachable without looking current.

**Warning signs:**
A Lot 2 demo in mid-December still shows a status that changed on 13 Dec. A status with no date shown.

**Phase to address:** Lot 1 (schema), Lot 2 (display of date and withdrawn candidates).

---

### Pitfall 4: The equal-detail rule deadlocks publication, or "non précisé" becomes an unsourced claim

**What goes wrong:**
There are 37 declared candidates today. Three pilot themes × 37 = 111 cells, each of which must be checked before a theme can be published (spec section 5). Two failure modes:
1. **Deadlock:** the themes never ship because one minor candidate's site is down.
2. **Silent assertion:** "non précisé" is shown without saying where and when it was checked. That is itself a factual claim about the candidate, made without a source, and it is asymmetric: it is cheap for a candidate with a 300-page program and wrong for one whose position sits in a video.

**Why it happens:**
The spec treats an empty cell as "absence of data", but in practice it is a verification result.

**How to avoid:**
- Model empty cells explicitly with an `absences/` collection (or `couverture` records): `{candidat, theme, verifie_le, sources_consultees: [url...], resultat: "non_precise" | "programme_non_publie"}`.
- CI equity rule: if `theme.publie == true`, every candidate with an active status has either ≥1 published measure or an absence record younger than N days on that theme. This is exactly the spec's "0 case vide non marquée".
- The site shows "Non précisé dans les sources consultées le 3 nov. 2026 (voir lesquelles)" rather than a bare "non précisé".
- Decide in an ADR **which statuses count for equity**. Recommendation: `declare` and `en_primaire`. `pressenti` gets a candidate page but is not part of the equity rule. Otherwise a sixth wave of pressentis blocks everything.

**Warning signs:**
A theme flagged ready while the equity CI only counts measures. Erwan spends hours re-checking the same empty cells.

**Phase to address:** Lot 1 (schema and CI rule), Lot 2 (display wording).

---

### Pitfall 5: A nearly empty site that structurally favours early publishers

**What goes wrong:**
Only about 6 of the 59 entries have a `liens.programme` URL (Mélenchon, Attal, Cazeneuve, Mlekuz, Egger, Mikolajczak). A theme page is then a wall of "programme non publié à ce jour", with a few candidates taking all the visual space. Readers and journalists will read that as editorial preference. It mirrors the 2022 criticism of comparators for "critères de sélection non définis", just inverted: the bias here comes from layout, not selection.

**Why it happens:**
Campaigns publish programs late, often in February or March of the election year.

**How to avoid:**
- Use **fixed-size candidate cards** on theme pages. The détaillé text expands on demand, so a candidate with 8 measures does not take 8× the space by default (show the first measure plus "N autres mesures").
- Never show measure counts as a visible "score" or sort key.
- Choose the 3 pilot themes **by measured coverage** (count primary-sourced positions per theme first). Write that rationale on the Méthode page.
- Allow speeches, op-eds and official statements as primary sources (already in the spec), so candidates without a formal program still have sourced positions.
- Candidate page: "Programme non publié à ce jour; positions publiques sourcées ci-dessous" when there are any.

**Warning signs:**
More than 70% of the cells on a pilot theme are empty. One candidate takes more than 30% of the scroll height on a theme page.

**Phase to address:** Lot 1 (theme choice backed by data), Lot 2 (card layout).

---

### Pitfall 6: Agent-collected quotes that are not actually in the source

**What goes wrong:**
Pilot content is collected by an agent. The "citation exacte entre guillemets" in the détaillé level is the field most likely to be paraphrased or invented. A single misquote found by a campaign team destroys the site's credibility, and under LCEN art. 1-1 III it triggers a right-of-reply demand (see Pitfall 12).

**Why it happens:**
LLM summarization drifts. Human review at 15-30 min/day cannot re-read every source.

**How to avoid:**
- CI check: after normalization (Unicode NFC, apostrophes `’`→`'`, whitespace, NBSP), `texte_source` and every `« … »` quote in `detaille` **must appear verbatim in the archived copy's extracted text**. This rule needs the archive (Pitfall 7) to be present and text-extractable.
- Also check numbers: every number, percentage, euro amount or year in `resume`, `enfant` and `aine` must appear in `texte_source` or `chiffrage`. This catches the spec's trap "rédaction enfant qui ajoute un chiffre absent".
- Put both rules in the trap-data test suite.

**Warning signs:**
Quotes containing typographic quotes or ellipses that are not in the source. Round numbers in the enfant level.

**Phase to address:** Lot 1.

---

### Pitfall 7: Source archiving that is broken, bloated or legally exposed

**What goes wrong:**
- **Empty captures:** campaign sites are often JS apps or web books (`melenchon2027.fr/programme2025/livre/`). A plain `curl` HTML snapshot saves an empty shell. The quote check passes on nothing, or fails on everything.
- **Repo bloat:** program PDFs, sometimes with images, run from 5 to 50 MB each. Thirty-seven candidates × several versions, multiplied by daily collection, push the repo past GitHub's recommended size ("ideally less than 1 GB, less than 5 GB strongly recommended"; files over 100 MiB blocked). The VPS disk is already at 90%.
- **Unreliable third-party archive:** archive.today (archive.is, archive.ph) was **deprecated and blacklisted by English Wikipedia on 20 Feb 2026**. The reasons were a DDoS run from its CAPTCHA page and evidence of **altered captures**. French Wikipedia discussed the same move. Citing it as proof of what a candidate wrote is now indefensible.
- **Copyright:** a full copy of a program PDF in a **public** repo is a reproduction, not a "courte citation". CPI L.122-5 3° a) covers "analyses et courtes citations justifiées par le caractère critique, polémique, pédagogique…" with author and source named. L.122-5 3° c) allows even full diffusion of speeches given in political assemblies and public political meetings, but only "par la voie de presse ou de télédiffusion, à titre d'information d'actualité". It does not cover a website hosting a program PDF. If the repo carries an open licence (MIT, CC BY), it would wrongly appear to relicense the candidates' texts.

**Why it happens:**
"Copie archivée dans le dépôt" sounds simple. Licensing and size only show up once the repo goes public.

**How to avoid:**
- Capture with a **headless browser** (Playwright, already in Erwan's stack). Store a rendered single-file HTML or PDF print, the extracted plain text (`.txt`, used by the quote CI), a SHA-256 hash and the capture timestamp. Also submit the URL to **Internet Archive Save Page Now** as an independent timestamp, and store the returned Wayback URL. Never rely on archive.today.
- **Split storage:** commit only `.txt` extracts plus metadata (small, diffable, needed by CI) to the public repo. Keep the binary originals (PDF, full HTML) in a **private** store: a private repo or the VPS, with hashes in the public repo.
- Exclude `archives/` from the repo's open licence in `LICENSE`/`README` ("textes des candidats : droits réservés à leurs auteurs, reproduits à titre de preuve et de citation"). Publish a takedown contact.
- CI size guard: fail on any committed file over 5 MB under `archives/`.

**Warning signs:**
An archived `.html` under 5 KB. `git count-objects -vH` growing more than 50 MB a week. A link to `archive.ph` in content.

**Phase to address:** Lot 1 (archive format, size guard, licence carve-out, quote CI). The full storage split can wait for Lot 5, but the format decision cannot.

---

### Pitfall 8: Forbidden-word CI that is both too naive and too strict

**What goes wrong:**
- A substring match on "enfin" flags the candidate's own quote ("Enfin, nous rétablirons…") inside `texte_source`, which must stay verbatim.
- It misses inflections and close cousins: "extrêmes", "extrémiste", "populisme", "ultra-", "radical", "mesure phare", "choc".
- It misses typographic variants: capitals, `œ`, NBSP, `’`.
- It scans the Méthode page, which *must* list the forbidden words.
- Loaded verbs pass through: "promet", "prétend", "assure", "admet", "reconnaît", "s'attaque à", "veut imposer", "ose". These are the classic neutrality failures of comparator sites, more than adjectives.

**Why it happens:**
The spec's list is short and illustrative, and teams implement it literally.

**How to avoid:**
- Normalize (NFKC, lowercase, strip accents for matching) and use **stem or regex patterns** (`\bextr[eé]m`, `\bpopulis`, `\benfin\b`).
- **Scope:** apply only to editorial fields (`titre`, `resume`, `detaille` minus quoted segments, `enfant`, `aine`, glossary definitions, party explanations). Exempt `texte_source` and quoted `« … »` spans. Exempt `pages/methode` through an explicit allowlist.
- Add a second **warning** list for loaded verbs. Recommend a house verb: "propose" / "prévoit". CI warns, a human decides.
- Allow per-measure overrides only with a written `justification` field, which shows up in review.

**Warning signs:**
False positives on quotes (people start disabling the check). Zero warnings over 100 measures (the check is too weak).

**Phase to address:** Lot 1.

---

### Pitfall 9: Children's and seniors' versions that distort or add facts

**What goes wrong:**
- **Enfant:** the metaphor smuggles in a judgment ("comme un super-héros qui…", "comme une punition"). The spec also says never to show a party name without explaining it, and the explanation becomes a political label ("un parti de droite dure"). Simplification can flip a conditional into a promise ("si… alors" turns into "il va").
- **Aîné:** "effet concret sur pensions, santé, succession" invites the writer to *compute* impacts the candidate never stated ("votre pension augmentera de 50 €"). That is a third-party estimate presented as the program.
- **Détaillé:** "ce qui existe déjà dans la loi" is content the site adds. Framed asymmetrically ("cela existe déjà" for one candidate only), it reads as a rebuttal.

**Why it happens:**
Each level is drafted separately, and the most simplified levels are the least checked.

**How to avoid:**
- Number and entity rule from Pitfall 6 (no number, date or proper noun absent from the source).
- **Party explanations stored once per party** in a `partis` collection, written from the party's own self-description (statuts, "qui sommes-nous" page), sourced and reviewed. The enfant level references them instead of writing free text.
- **Aîné:** only effects the candidate states. Otherwise "le candidat ne précise pas l'effet sur les pensions".
- **Legal context in détaillé:** require a separate `contexte_legal` source (Legifrance or service-public URL). Apply the same rule to every candidate: either every measure on a sub-theme gets a legal-context line, or none does.
- Keep the spec's planned cross-check agent (enfant against source) and also run it on aîné.
- **Glossary definitions** ("mots soulignés") go through the same forbidden-word and review rules.

**Warning signs:**
Enfant texts with "va" or "veut" where the source says "proposera d'étudier". Aîné texts with euro amounts.

**Phase to address:** Lot 1 (rules, `partis` collection), Lot 2 (glossary UI).

---

### Pitfall 10: Ordering bias hidden in "alphabetical" and "random"

**What goes wrong:**
- **Alphabetical by what?** "de Villepin" (D or V?), "Le Pen" (L), "Dupont-Aignan", accents (É). JS `localeCompare` without options, or a naive `sort()`, puts accented names after Z.
- **Random:** the classic bug `arr.sort(() => Math.random() - 0.5)` is not uniform. A shuffle done at **build time** freezes one "random" order for every visitor until the next build. That is worse than alphabetical, because it looks deliberate.
- **Without JS, random cannot exist at all**, yet the spec wants M1 to work without JS.
- **Inside a candidate page, measure order** can bias too (the most popular measure first).

**Why it happens:**
Ordering looks trivial. Ballot-order and primacy effects are well documented, but people forget them.

**How to avoid:**
- An explicit `nom_tri` field per candidate (follow the French convention: "Villepin, Dominique de" sorted at V; write the rule on the Méthode page). Use `Intl.Collator('fr', {sensitivity: 'base'})` everywhere, at build and in JS.
- Random = **client-side Fisher-Yates** using `crypto.getRandomValues`, triggered by the visitor. Without JS, alphabetical is the documented fallback.
- Measures within a candidate follow sub-theme order (from the `themes` collection), then `id`. Never by "importance".
- Prepare the "ordre du Conseil constitutionnel" option field (`ordre_cc`) now, empty until the official list (mid or late March 2027).
- Unit test: across 10,000 shuffles, each position frequency stays within ±3%.

**Warning signs:**
"Villepin" listed under D on one page and V on another. The same "random" order on two devices.

**Phase to address:** Lot 1 (`nom_tri`, collator utility), Lot 2 (shuffle, UI).

---

### Pitfall 11: Photos that create asymmetry (and licence debt)

**What goes wrong:**
Commons has flattering official portraits for some candidates, blurry rally shots for others, nothing for minor candidates. A grid of mixed photos and grey silhouettes is a visible neutrality failure. CC BY-SA files need attribution, licence and link next to the image, or on a credits page the image links to. Commons also tags many portraits with `{{Personality rights}}`: "il est de la seule responsabilité du réutilisateur" to respect image rights, whatever the licence.

**Why it happens:**
Photos make cards look finished, and they are cheap to add.

**How to avoid:**
- **v1.0: no photos** (the spec allows "ou aucune"). Use initials or a neutral pictogram, identical for everyone. Revisit only if every active candidate has a usable Commons portrait of comparable quality.
- If photos come later: a schema `photo: {commons_file, auteur, licence, url_licence, date_verif}`, CI that refuses an incomplete entry, and the all-or-none rule enforced per page.

**Warning signs:**
A PR adding one candidate's photo.

**Phase to address:** Lot 2 (decision recorded in an ADR).

---

### Pitfall 12: Mentions légales citing the wrong article, exposing a home address, or naming the wrong host

**What goes wrong:**
- **Outdated reference.** Many templates still cite "LCEN art. 6 III". Since the **SREN law (loi n° 2024-449, in force 23 May 2024)**, publisher identification is in **LCEN art. 1-1**. Art. 6 now covers intermediaries. This was checked on Legifrance, consolidated version as of 03/11/2026.
- **Art. 1-1 I** requires, for an individual: "nom, prénoms, domicile et numéro de téléphone" (1°); "le nom du directeur ou du codirecteur de la publication" (3°); the host's "nom, dénomination ou raison sociale, l'adresse et le numéro de téléphone" (4°); and, where relevant, whoever stores the data (5°).
- **Art. 1-1 II:** a person publishing "à titre non professionnel" may show only the host's identity, provided they have given their own details to the host.
- **Art. 1-2** penalty: one year and €75,000 for breaching I or II.
- The spec wants the mention "au nom d'Erwan Henry". Under I.1° that means publishing his **home address and phone number** on a political website during a presidential campaign, which is a real harassment risk.
- **Art. 1-1 III, right of reply.** Every candidate named on the site "dispose d'un droit de réponse". The request goes to the directeur de la publication, within three months of publication. The reply must be inserted **within three days**, or a €3,750 fine applies. Fifty-nine named people make this a realistic workload, especially from campaign teams.
- **Wrong host.** The Lot 2 test URL will likely sit on GitHub Pages, Cloudflare Pages or a preview host, not Hetzner. Mentions that name Hetzner while the site is served by someone else are wrong.

**Why it happens:**
People copy templates, and the spec mixes "transparency" (named publisher) with the legal minimum.

**How to avoid:**
- Cite **"article 1-1 de la loi n° 2004-575 du 21 juin 2004 (LCEN), dans sa rédaction issue de la loi n° 2024-449 du 21 mai 2024"**.
- **Decide explicitly (ADR):**
  - (a) Full identification under I: name, address, phone. Consider a postal domiciliation address, **LOW confidence that this satisfies "domicile"; check with a lawyer**. Or
  - (b) Non-professional anonymity under II: host only, plus the name "Erwan Henry" given voluntarily as editor and directeur de la publication, without the address. The site has no commercial link to Erwan's freelance work (not Alignd or SpikeeLabs), which supports the non-professional reading. That reading **falls apart if the site carries any freelance promotion, donation link or client branding**.
- Name a **directeur de la publication** (Erwan) and a dedicated contact address for right-of-reply and error reports (an alias, not a personal inbox). Write a 3-day response procedure in `RUNBOOK.md`.
- Generate the mentions from a `config/hebergeur.yml` that changes with the deploy target, so the preview host and the production host (Hetzner Online GmbH, verify the address and phone on Hetzner's own Impressum at Lot 3) are always right.
- Add a short "Données personnelles" section (see Pitfall 13).

**Warning signs:**
"article 6" anywhere in the mentions. Mentions that name Hetzner on a preview URL. No contact channel other than a mailto to a personal address.

**Phase to address:** Lot 2 (page content and ADR), Lot 3 (production host details).

---

### Pitfall 13: Believing "zero cookies" means "no RGPD/ePrivacy duties"

**What goes wrong:**
- **localStorage counts.** The rule (art. 82 Loi Informatique et Libertés, transposing art. 5(3) ePrivacy) targets "le stockage d'informations sur son terminal ou l'accès à des informations déjà stockées", not only cookies. Storing the chosen reading level in localStorage is a tracker in the legal sense. The CNIL exempts "traceurs de personnalisation de l'interface utilisateur… pour le choix de la langue ou de la présentation d'un service, lorsqu'une telle personnalisation constitue un élément intrinsèque et attendu du service". The reading-level choice fits, **but only if storage holds nothing else** (no visitor ID, no visit counter, no shuffle seed persisted for analytics).
- **Caddy access logs contain IP addresses**, which are personal data, until they are anonymized. "Logs anonymisés" must be anonymized at write time, with a retention period.
- **The error-report form** (an email to Erwan) processes personal data: email address, name. It needs an information notice.
- **Third-party requests:** Google Fonts, a CDN or an embedded YouTube video send visitors' IPs to third parties and break the "aucun script externe" promise.
- **Later (M3):** game choices can reveal political opinions, which are sensitive data under RGPD art. 9. The 2022 Elyze case shows what happens: the CNIL examined the app over this "sensitive data" (Euronews, Jan 2022), and it faced public accusations of bias after a ranking "bug" favoured one candidate.

**How to avoid:**
- One localStorage key (`rtp.niveau`) with an enumerated value, documented on the mentions or confidentiality page. No consent banner needed.
- Self-host fonts (woff2 subset). CI or build check: the built HTML contains no `http(s)://` resource outside the site's own origin (links are fine, resource loads are not).
- Caddy (Lot 3): log format with the IP truncated, or no IP; retention ≤ 13 months is a defensible default, in line with CNIL's audience-measurement guidance (tracker lifetime ~13 months, data ≤ 25 months).
- Error reporting: a `mailto:` link with a short notice (purpose, retention, no storage in the repo).

**Phase to address:** Lot 2 (storage, fonts, external-resource check, privacy section), Lot 3 (Caddy logs), Later (M3 stays local).

---

## Moderate Pitfalls

### Pitfall 14: Misreading which election rules apply to a private site

**What goes wrong:**
Two opposite errors. The first is claiming the site "respects Arcom rules" as if it were under Arcom. The second is ignoring the electoral code rules that *do* touch any online publisher.

**What the texts actually say:**
- **Equity and equality of candidates (loi n° 62-1292, art. 3 I bis)** apply to radio and TV services, under Arcom supervision: "équité" from publication of the candidate list to the eve of the campaign, "égalité" during the official campaign. Arcom's page describes its pluralism role as "à la télévision et à la radio". As of late October 2026 the **Arcom recommendation for 2027 had not been published** (Arcom announced it for autumn 2026). Secondary sources say Arcom may extend it to on-demand audiovisual services and is talking with political podcasters and video creators. **Not applicable to a static text site. Re-check when the recommendation is published, especially before Lot 6 audio (MEDIUM/LOW).**
- **CNCCEP (décret n° 2001-213, art. 13)** "veille au respect" of equal State facilities for candidates and works through public authorities. It has no stated power over private websites. It is installed the day after publication of the decree setting the date for sending the parrainage forms.
- **What does apply to everyone:** Code électoral **L.49** (in force since 30 June 2020): "A partir de la veille du scrutin à zéro heure, il est interdit de…" broadcast electoral propaganda by electronic means to the public, and so on. **L.48-2:** no new element of controversy so late that opponents cannot answer (cited by the Conseil constitutionnel's 2022 site). **L.97:** false news used to sway votes. All of these are within the range L.47 A to L.52-2 made applicable to the presidential election by art. 3 II of the 1962 law.

**Prevention:**
- Méthode page: "L'égalité de traitement est une règle éditoriale que nous nous imposons ; le site n'est pas un service audiovisuel soumis à l'Arcom." Never claim any official endorsement.
- Pre-plan a **content freeze** (not only polls) from Saturday 0h to Sunday 20h for each round. A late correction that hurts a candidate, published on the eve, could be read as L.48-2 or L.49 material. Hard-code it like the poll ban (later lot), but put the dates in config now.
- No paid promotion of the site that features a candidate (L.52-1 bans commercial advertising for electoral propaganda in the six months before the month of the vote, i.e. since 1 Oct 2026. Neutral information is not propaganda, but don't create the ambiguity).

**Phase:** Lot 2 (Méthode wording), Later (freeze in Lot 4 and 5).

### Pitfall 15: Poll ban window (later lot, note only)

**Text checked:** Loi n° 77-808 art. 11 (version since 27 April 2016). For a presidential election the ban runs "le samedi précédant le scrutin à zéro heure" until "la fermeture du dernier bureau de vote sur le territoire métropolitain". Polls published earlier may keep circulating if the date of first publication, the outlet and the institute are given, but **no publication, diffusion or commentary** during the window. Art. 14 adjusts the end time for overseas territories.

**Pitfalls for Lot 4:**
- CI and cron run in **UTC**. The window is Europe/Paris time (CEST in April). Test with an explicit TZ.
- Static pages cached by browsers or Caddy keep serving the moving average, which is new commentary ("calcul du site"). Deploy the blocking page before Friday 23:00 and set a short cache.
- The spec's full block is stricter than the law, which is fine and prudent.
- No "règle du 15 avril 2026" was found (spec section 13 mentions one from vie-publique). **Verify in Lot 4 (LOW).**

**Phase:** Later (Lot 4). For Lot 1, only make sure the schemas carry `date_publication` with timezone.

### Pitfall 16: Party program vs candidate program attribution

**What goes wrong:**
Glucksmann was designated by a PS / Place publique / GRS primary (11 Oct 2026). Is the PS program "his"? LFI's movement program and Mélenchon's site are distinct sources. Attributing a party platform to a candidate before the candidate endorses it adds facts.
**Prevention:** add `source.auteur` (enum: `candidat` | `parti_du_candidat` | `coalition`) and show it ("programme du parti, repris par le candidat le…"). A party document counts for a candidate only with a dated endorsement source.
**Phase:** Lot 1.

### Pitfall 17: Unreviewed drafts leaking into a public build

**What goes wrong:**
The Lot 2 deliverable is a test URL. If the build includes `brouillon` measures (agent-written, unreviewed) and the preview is indexable or public, unreviewed political content is published, and Erwan is legally the publisher.
**Prevention:**
- The build filters `statut_relecture == publie` by default. A `--drafts` flag is only used locally.
- Preview served with `X-Robots-Tag: noindex` plus a robots `Disallow`, ideally behind basic auth.
- CI test: a trap draft must not appear in `dist/`.

**Phase:** Lot 2.

### Pitfall 18: Git history becomes public at launch

**What goes wrong:**
The repo is private until launch, then public. All draft wording, review comments ("ce type est fou"), agent prompts and early mistakes become permanently visible, which is a gift to anyone looking for bias.
**Prevention:** professional review comments only, in PR descriptions, not in content files. Before going public, audit history with `git log -p` plus secret scanning (gitleaks). Decide (ADR) whether to squash pre-launch history or publish it as-is for transparency.
**Phase:** Lot 1 (convention), Lot 3 (pre-launch audit).

### Pitfall 19: Readability formula misused as a hard gate

**What goes wrong:**
The spec asks for "indice de Flesch adapté au français" at CM1 level. The French adaptation is **Kandel & Moles (1958)**: 207 − 1.015 × (mots/phrases) − 73.6 × (syllabes/mots).
- On 40-60 words (2-4 sentences) the score is very unstable.
- French syllable counting (silent final *e*, *-ent*, liaisons) is error-prone, and English libraries undercount or overcount.
- No validated score-to-grade table exists. Popular "70-80 = CM1" bands come from blog tables, not research (LOW).
- Writers game it with ultra-short sentences that **drop the conditions of a measure**, which is a neutrality failure in its own right.

**Prevention:**
- Implement Kandel-Moles with a French syllable heuristic in the validator, as a **warning**, not a blocking gate.
- Add a deterministic lexical check (word length, flag words longer than N syllables without a glossary entry).
- Record the formula and its limits on the Méthode page.
- The real gate is human review plus the cross-check agent.

**Phase:** Lot 1 (validator warning), Lot 2 (Méthode wording).

### Pitfall 20: `:has()` level toggle that fails on old devices and for screen readers

**What goes wrong:**
- `:has()` is Baseline "widely available" across browsers **since December 2023** (MDN). Early versions: roughly Chrome 105, Safari 15.4, Firefox 121, from MDN's table and general knowledge. Seniors on iPads stuck at iOS ≤ 15.3, or on Firefox ESR 115, get **no style**: a rule containing an unsupported `:has()` is dropped entirely. With the "hide the other levels" approach, they see all 4 versions stacked, or none.
- Hiding levels by moving them off-screen visually leaves them in the accessibility tree, so screen readers read four versions.
- Restoring the localStorage choice after first paint flashes the default level.
- Using `role="tablist"` on radio buttons gives conflicting semantics.
- "Mots soulignés avec définition au survol" relies on hover, which is unusable on touch and keyboard.

**Prevention:**
- One global `<fieldset><legend>Niveau de lecture</legend>` with 4 native radios at the top. CSS `body:has(#niveau-enfant:checked) .niveau:not(.niveau-enfant){display:none}` inside `@supports selector(:has(*))`.
- **Default without `:has()`: show the résumé level, and the others in `<details>`**, so the page is usable everywhere.
- `display:none` (not visually-hidden) for inactive levels. A tiny inline `<head>` script reads `rtp.niveau` before paint (allowed by the "JS d'amélioration" decision). Native radios already give arrow-key navigation, so no ARIA roles are needed beyond the labels.
- Glossary terms: `<details>`/`<summary>` or a button that toggles a definition. Not `title=` (inaccessible) and not hover-only.
- Test on Safari 15.3 (BrowserStack or an old iPad) and with VoiceOver/NVDA.

**Phase:** Lot 2.

---

## Minor Pitfalls

### Pitfall 21: Level labels that put users off
Seniors may not tick "Aîné", and teenagers will avoid "Enfant". **Prevention:** labels describe the need ("Très simple", "Gros caractères et effets sur la retraite") with the audience as a subtitle. Test with the cross-test personas. **Phase:** Lot 2.

### Pitfall 22: Link rot detected too late
**Prevention:** a link-checker script in Lot 1, run on a schedule (weekly). **It must not fail PR CI on external flakiness.** It opens an issue instead. A dead source triggers a check of the archive copy, and the source is shown as "archivée le…". **Phase:** Lot 1 (script), Lot 5 (schedule).

### Pitfall 23: Date and timezone drift
`date de consultation`, `verifie_le` and status dates mix local and UTC values. **Prevention:** ISO dates; datetimes carry `+01:00`/`+02:00`; validators use `Europe/Paris`. **Phase:** Lot 1.

### Pitfall 24: "Qui sommes-nous" that is thin or not neutral itself
**Prevention:** state the editor, method and funding (none), declare any political membership or the absence of one, keep client branding out, and link the public repo and journal. **Phase:** Lot 2.

### Pitfall 25: Méthode page drifting from actual practice
The page claims "toutes les personnalités" while the site shows only declared candidates, or claims "relu" for every item. **Prevention:** generate the Méthode numbers (number of candidates, statuses counted for equity, forbidden-word list, readability formula) **from the same config the CI uses**. **Phase:** Lot 2.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy data.gouv JSON into `content/candidats` | Lot 1 "done" in an hour | Imposed labels (`extdroite`), press-only sources, wrong status vocabulary on a public site | Never; always go through the import and mapping script |
| Single `statut` field instead of a history array | Simpler schema | Lost history, migration needed in mid-campaign | Never (the migration rule in spec section 7 makes it costly) |
| Store full PDFs and HTML in the public repo | One place for everything | Repo bloat, copyright exposure, VPS disk | Only `.txt` extracts and hashes. Binaries go to private storage |
| Forbidden words as a plain substring list | Quick CI | False positives on quotes lead people to disable the check | Only as a first commit, replaced within Lot 1 |
| "Non précisé" without an absence record | Fewer files | Unsourced claims, equity can't be audited | Never on a published theme |
| Build-time "random" ordering | Works without JS | Frozen order looks deliberate | Never; no JS falls back to alphabetical |
| Readability score as a blocking gate | Measurable KPI | Gamed texts that lose a measure's conditions | Warning only |
| Photos for some candidates | Prettier cards | Visible asymmetry | Never per-candidate; all or none |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| data.gouv "statuts sourcés" (2027etmoi, Licence Ouverte 2.0) | Trusting the description (51) over the file (59). Importing `bloc` and `propositions` | Pin the resource UUID and `mise_a_jour`. Map fields explicitly. Credit the source (Licence Ouverte requires attribution). Diff each refresh for status changes; each change goes through a palier B PR |
| Campaign sites (JS apps, web books) | `curl` snapshot gives an empty shell | Playwright render, then single-file HTML, PDF and text extract, SHA-256 hash, plus a Wayback SPN submission |
| archive.today | Used as the third-party archive | Deprecated by Wikipedia on 20 Feb 2026 (DDoS, altered captures). Do not use it |
| Internet Archive SPN | Assuming the capture succeeded | Store the returned snapshot URL and timestamp. Retry later if it fails. It is a corroboration, not the primary copy |
| Wikimedia Commons | Taking the image without attribution or checking `{{Personality rights}}` | Full attribution record, or no photos in v1.0 |
| Conseil constitutionnel list (mid or late March 2027) | Rebuilding candidate files from it | Status change only (append to history) plus `ordre_cc`. The ids are already yours |
| GitHub Actions | Default UTC dates in validators | `TZ=Europe/Paris` in the workflow; validators parse with an explicit zone |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 4 levels × all candidates inline in the HTML | Theme page HTML grows with candidate count | Rough estimate: 37 candidates × 3 measures × ~4 KB (4 texts + quote + source metadata) ≈ 450 KB uncompressed, ~80-120 KB brotli. Fits **if** the 500 KB budget is defined as transferred size. Write down which one (transferred vs decoded). CI budget check on `dist/` with both numbers | Over ~50 candidates or 5+ measures each, or long détaillé quotes |
| Web fonts (large-print "aîné" fonts, several weights) | 200-400 KB of fonts | One variable woff2, latin subset, `font-display: swap` | As soon as a second family is added |
| Glossary repeated inline per occurrence | HTML bloat on the enfant level | Define each term once per page and reference it by anchor | Pages with many enfant texts |
| Archive extracts imported into Astro content collections | Slow builds, huge bundles | Keep `archives/` outside `src/content`. Only CI reads it | First few hundred archives |
| Pseudo-random pre-rendered order pages | Many duplicate pages | Don't pre-render permutations. Client-side shuffle only | Not applicable if avoided |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Publishing Erwan's home address and phone (LCEN 1-1 I.1°) on a political site | Harassment during the campaign | ADR: non-professional anonymity (1-1 II) or a domiciliation address, with a lawyer check (LOW confidence) |
| Error-report or right-of-reply address = personal inbox | Spam, doxxing, lost requests (3-day legal deadline) | Dedicated alias, filtering, RUNBOOK procedure |
| Accepting content PRs from outside contributors after going public | Injected biased or unsourced content, or a "hacked app" scandal (one developer hacked Elyze within hours in 2022) | Branch protection, CODEOWNERS = Erwan on `content/`, required CI, no auto-merge for paliers B, C and D |
| External resource loaded at runtime | Visitor IPs leak, CSP bypass | Strict CSP (`default-src 'self'`), checked in CI on `dist/` |
| Secrets or SSH keys in the repo before going public | Compromised VPS | gitleaks in CI from Lot 1 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Theme page that is a wall of "programme non publié" | Visitor leaves within 10 s, site looks broken | Short status line per card, collapsed list of candidates without positions, coverage summary at the top ("12 candidats sur 37 ont publié une position sourcée sur ce thème au 3 nov.") |
| Level switch per measure instead of global | Tedious, inconsistent | One global choice, remembered, shown in the header |
| Status without a date | Misleading after the next change | "Déclaré · 9 sept. 2026 · source" |
| Withdrawn candidates mixed with active ones | Confusion | Separate collapsed section "Ont renoncé ou ont été éliminés" |
| Party explained only for some candidates in enfant mode | Asymmetry | Explanation drawn from the `partis` collection for everyone, or for no one |
| Hover-only definitions | Unusable on tablets, which seniors use heavily | Tap or keyboard toggle (`details` or button) |

## "Looks Done But Isn't" Checklist

- [ ] **Candidate import:** no `bloc`, `extdroite` or `propositions` in `content/`. Status vocabulary matches the ADR. Count reconciled (59 vs 51) and noted in the Méthode page.
- [ ] **Source CI:** rejects a missing source **and** a quote that is not found in the archived text extract **and** a number absent from the source in résumé, enfant or aîné.
- [ ] **Archive:** the `.txt` extract is non-empty (over 500 chars) for every source. Hash stored. No archive.today URL.
- [ ] **Equity CI:** counts absence records, not just measures. Fails when one active candidate lacks both on a published theme.
- [ ] **Forbidden words:** trap test passes, a candidate quote containing "enfin" is *not* flagged, the Méthode page is not flagged.
- [ ] **Ids:** renaming a candidate file fails CI.
- [ ] **Ordering:** "de Villepin" sorts at V everywhere. Shuffle uniformity test passes. Without JS the order is alphabetical.
- [ ] **No-JS:** with JS disabled, a theme page shows the résumé and lets you reach the other levels. With `:has()` unsupported (test in Safari 15.3), the page is still usable.
- [ ] **Screen reader:** only the active level is announced.
- [ ] **Mentions légales:** cite LCEN art. 1-1 (not art. 6), name the *actual* current host with address and phone, name a directeur de la publication, give a right-of-reply contact.
- [ ] **Privacy:** only `rtp.niveau` in localStorage. Zero third-party requests in `dist/` (CI check). Privacy section written.
- [ ] **Drafts:** the trap `brouillon` measure is absent from `dist/`. Preview is `noindex`.
- [ ] **Weight:** CI reports transferred and decoded size per page. Budget definition written down.
- [ ] **Licence:** `LICENSE` excludes `archives/` and candidates' texts. Licence Ouverte attribution for the data.gouv data.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Misquote published | MEDIUM | Remove within the hour (spec), journal entry with the reason, check the archive, answer any right-of-reply request within 3 days (LCEN 1-1 III) |
| Imposed label or forbidden word published | LOW | Fix, journal entry, add the pattern to CI so it cannot recur |
| Candidate id renamed after launch | MEDIUM | Restore the old id, add the new name as `nom_affiche`, add a redirect for any URL that leaked |
| Repo bloated by archives | HIGH | `git filter-repo` to move binaries to private storage (rewrites history, so do it before going public) |
| Status history overwritten | MEDIUM | Rebuild from `git log -p content/candidats/…` and the dataset's previous versions (data.gouv keeps resource history) |
| Unreviewed draft published on preview | MEDIUM | Take down the preview, purge the cache, request de-indexing, add the build filter test |
| Takedown request from a campaign for an archived PDF | LOW | Remove the binary from the public repo (should already be private), keep the hash and text extract, document it in the journal |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Dataset imported as-is | Lot 1 | Import script plus mapping ADR. Grep `extdroite\|bloc\|propositions` in `content/` = 0 |
| 2 Id instability | Lot 1 | CI fails on a rename or deleted id |
| 3 Status churn | Lot 1 schema, Lot 2 display | History array plus dated status shown; Dec 2026 changes applied through PRs |
| 4 Equity deadlock / unsourced "non précisé" | Lot 1 schema+CI, Lot 2 wording | Equity CI uses absence records; trap test |
| 5 Empty site / layout asymmetry | Lot 1 theme choice, Lot 2 layout | Coverage count per theme recorded; fixed-size cards |
| 6 Invented quotes / numbers | Lot 1 | Quote-in-archive and number checks in the trap suite |
| 7 Archive format / bloat / copyright | Lot 1 (format, licence), Lot 5 (storage split) | Non-empty extracts, size guard, LICENSE carve-out |
| 8 Forbidden words naive | Lot 1 | Trap tests incl. "enfin" inside a quote |
| 9 Enfant/aîné distortion | Lot 1 rules, Lot 2 glossary | Number rule plus `partis` collection plus cross-check agent |
| 10 Ordering bias | Lot 1 `nom_tri`, Lot 2 shuffle | Collator utility plus uniformity test |
| 11 Photo asymmetry | Lot 2 | ADR "no photos v1.0" |
| 12 Mentions légales | Lot 2 (+Lot 3 host) | Checklist against LCEN 1-1 I-III |
| 13 RGPD with zero cookies | Lot 2 (+Lot 3 logs) | `dist/` external-resource check; privacy section |
| 14 Election-law misreading | Lot 2 Méthode, Later freeze | Méthode wording; freeze dates in config |
| 15 Poll ban | Later (Lot 4) | TZ-explicit test of both windows |
| 16 Party vs candidate program | Lot 1 | `source.auteur` enum required |
| 17 Draft leak | Lot 2 | Trap draft absent from `dist/` |
| 18 Public history | Lot 1 convention, Lot 3 audit | gitleaks plus history review before going public |
| 19 Readability misuse | Lot 1 (warning), Lot 2 (Méthode) | Score reported, not gating |
| 20 `:has()`/a11y toggle | Lot 2 | Safari 15.3 and VoiceOver test; axe audit |

## Sources

Opened and read on 2026-11-03:
- Legifrance, LCEN (loi n° 2004-575), consolidated version as of 03/11/2026, art. 1-1 I-III and 1-2. HIGH. https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164
- Legifrance, CPI art. L122-5 (3° a and 3° c), version in force since 1 Jan 2023. HIGH. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278917
- Legifrance, Code électoral art. L49, in force since 30 June 2020. HIGH. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215
- Legifrance, Code électoral art. L97. HIGH. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006353232
- Legifrance, loi n° 62-1292 art. 3 (I bis equity/equality, II applicable articles L.47 A-L.52-2). HIGH. https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000684037
- Legifrance, décret n° 2001-213 art. 13-15 (CNCCEP). HIGH. https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000769091
- Legifrance, loi n° 77-808 art. 11 and 14 (poll ban), version 25/05/2026. HIGH. https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000522846/2026-05-25
- CNIL, "Cookies et traceurs : que dit la loi ?" (exemption for interface personalization; art. 82 LIL). HIGH. https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi
- CNIL, audience measurement exempt from consent (13 / 25 months). HIGH. https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience
- Arcom, pluralism and speaking time (radio/TV scope; one recommendation per election). HIGH for scope; the 2027 recommendation was not found. https://www.arcom.fr/temps-parole
- Conseil constitutionnel, présidentielle 2022, "Peut-on faire campagne sur internet le jour et la veille du scrutin ?" HIGH. https://presidentielle2022.conseil-constitutionnel.fr/l-election/la-campagne-sur-internet/peut-on-faire-campagne-sur-internet-le-jour-et-la-veille-du-scrutin.html
- data.gouv, "Candidatures à l'élection présidentielle 2027 — statuts sourcés" (page plus JSON resource downloaded and inspected). HIGH. https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources
- MDN, `:has()` (Baseline widely available since Dec 2023; unsupported `:has()` invalidates the rule unless inside `:is()`/`:where()`). HIGH. https://developer.mozilla.org/en-US/docs/Web/CSS/:has
- GitHub Docs, large files (50 MiB warning, 100 MiB block, repo < 1 GB ideal / < 5 GB strongly recommended). HIGH. https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- Wikimedia Commons, Template:Personality rights. HIGH. https://commons.wikimedia.org/wiki/Template:Personality_rights/fr?uselang=fr
- Euronews (18 Jan 2022), Elyze: CNIL review of "sensitive data", bias accusations after a ranking "bug", app hacked within hours. MEDIUM. https://www.euronews.com/my-europe/2022/01/18/french-voting-app-sparks-concerns-over-data-protection-ahead-of-election

Search results only (secondary, not opened):
- archive.today deprecation, Wikipedia RfC closed 20 Feb 2026 (DDoS plus altered captures): Wikipedia Signpost 2026-03-10, Boing Boing, SC World. MEDIUM (several sources agree). https://en.wikipedia.org/wiki/Wikipedia:Wikipedia_Signpost/2026-03-10/Technology_report
- Arcom 2027 recommendation not published as of 21 Oct 2026; podcast and creator talks: kohenavocats.com. LOW. https://kohenavocats.com/podcasts-politiques-presidentielle-2027-arcom-temps-de-parole-createurs-recours/
- 2022 comparator criticism (undefined candidate-selection criteria, opaque method): espoir-ric.fr. LOW. https://www.espoir-ric.fr/une/comparatif-programme-presidentielle-2022
- Kandel-Moles formula and French readability limits: force-interactive.com, annebeckers.com. MEDIUM for the formula, LOW for grade bands. https://www.force-interactive.com/score-lisibilite-texte/
- SREN law moving publisher identification to LCEN art. 1-1 (also confirmed on Legifrance above): simonnetavocat.fr. https://www.simonnetavocat.fr/mentions-legales-dun-site-internet-obligations-sanctions-et-modele/

---
*Pitfalls research for: neutral French civic site, presidential 2027 programs*
*Researched: 2026-11-03*
