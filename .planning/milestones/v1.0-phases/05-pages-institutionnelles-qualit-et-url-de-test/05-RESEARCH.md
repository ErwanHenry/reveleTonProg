# Phase 5: Pages institutionnelles, qualité et URL de test - Research

**Researched:** 2026-11-03
**Domain:** pages statiques Astro générées depuis la config du validateur, suite e2e Playwright + axe (sans JS, clavier, WCAG 2.2 AA, 160 %, reduced-motion, 4G lente), mentions légales (LCEN art. 1-1), artefact CI, test croisé simulé
**Confidence:** HIGH (stack, prototype mesuré), MEDIUM (formulation juridique, relecture juriste recommandée avant le Lot 3)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Héritées (verrouillées)**
- D-4 : éditeur non professionnel (LCEN art. 1-1 II) — « Éditeur et directeur de la publication : Erwan Henry », identité complète de l'hébergeur, contact dédié, AUCUNE adresse personnelle, procédure de droit de réponse (3 jours) ; relecture par un juriste recommandée avant le Lot 3 (noter sur la page/RUNBOOK, pas bloquant ici)
- Contact public = `config/site.yml` (placeholder `contact@domaine-a-definir.invalid`, garde RTP_DEPLOIEMENT=1 au Lot 3)
- Hébergeur depuis `config/hebergeur.yml` (à créer) : Hetzner Online GmbH (identité à vérifier sur leur Impressum au moment de rédiger, source citée) pour la cible Lot 3 ; la preview v1.0 n'est PAS hébergée (artefact CI / local) — la page doit refléter honnêtement cet état
- Méthode : toutes les listes et bornes (mots interdits, verbes connotés, longueurs, Kandel-Moles, équité `declare`+`primaire`, statuts relus = `relu` ADR-041, ordre, états vides, sources primaires, archives, écart 59/51 du dataset, attribution Licence Ouverte 2.0 2027etmoi, règle de choix des thèmes pilotes « marge 2 + Aîné » et le classement mesuré) générées depuis `src/lib/content-core/rules/config.ts` et `data/couverture-themes.yaml` ; liste des mots interdits dans un élément `data-liste-mots-interdits` (exempté par check-dist)
- Phrase « site non soumis à l'Arcom (pas un service audiovisuel) » et profil 4G utilisé pour les tests
- Qui sommes-nous : éditeur, démarche, aucun financement, aucun branding tiers (ni Alignd ni SpikeeLabs), aucun lien de don
- Données personnelles : aucune collecte, aucun cookie, localStorage `rtp:niveau` et `rtp:ordre` seulement (exemption CNIL personnalisation), mailto = action volontaire du visiteur
- Dates des tours 18 avril et 2 mai 2027 visibles (hall + Méthode au minimum)
- Playwright : dépendances `@playwright/test@^1.64.1` + `@axe-core/playwright@^4.14.0` (justifications prêtes dans research/STACK.md) ; Chromium seulement ; `.npmrc ignore-scripts=true` reste → installer le navigateur explicitement (`npx playwright install chromium`, en CI `--with-deps`) ; serveur statique gzip maison (node:http + node:zlib) pour le test 4G (astro preview ne compresse pas)
- Tests e2e sur la fixture `corpus-m1` (contenu publié) ET sur le vrai corpus en mode preview
- URL de test = artefact CI (upload-artifact v7 épinglé par SHA) de la build preview du vrai corpus + instructions locales ; `noindex`/robots déjà en place pour la preview
- Test croisé : agent simulé jouant 3 personas (enfant 10 ans, retraité 72 ans, journaliste) sur la build preview, plus injection des pièges §12 ; journal d'audit `docs/AUDIT-TEST-CROISE.md` (ou dans la phase) — peut s'appuyer sur la compétence `banc-test-croise` si utile

### Claude's Discretion
- Structure des pages, URL (`/methode/`, `/mentions-legales/`, `/qui-sommes-nous/`), découpage des specs Playwright, format du journal d'audit

### Deferred Ideas (OUT OF SCOPE)
- Hébergement Caddy, domaine, déploiement (Lot 3, milestone v1.1)
- Relecture juridique des mentions (avant Lot 3)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INST-01 | Page Méthode, listes et chiffres générés depuis la config du validateur | Pattern « page Astro qui importe `config.ts` + `couverture-themes.yaml?raw` » prototypé et vert (check-dist 0 erreur). Section « Méthode ». |
| INST-02 | Mentions légales LCEN art. 1-1, hébergeur depuis `config/hebergeur.yml`, droit de réponse, données personnelles | Texte de l'art. 1-1 I/II/III cité depuis Légifrance ; identité Hetzner relevée ; CNIL cité. Section « Mentions légales ». |
| INST-03 | Qui sommes-nous sans branding tiers ni don | Contrôle check-dist/test e2e de chaînes interdites (Alignd, SpikeeLabs, don). |
| INST-04 | Dates des deux tours visibles | Constante unique partagée (hall + Méthode + pied de page), test e2e. |
| QUAL-02 | Sans JS, clavier, axe WCAG 2.2 AA sérieux/critique | Prototype : 12 pages × 4 niveaux, 0 violation ; clavier ; sans JS. |
| QUAL-03 | 4G lente 150 ms / 1,6 Mbps, page la plus lourde < 1 s | Mesuré : 377 à 446 ms (corpus réel preview, 63 pages) avec serveur gzip. |
| QUAL-04 | 160 %, reduced-motion, contraste AA tous thèmes | Prototype vert, avec un défaut réel trouvé à 320 px + police 160 %. |
| QUAL-05 | URL de test = artefact CI ou preview locale | SHA upload-artifact v7.0.2 obtenu par `gh api`. |
| QUAL-06 | Test croisé simulé + journal d'audit | Compétence `banc-test-croise` trouvée et lue ; protocole adapté. |
</phase_requirements>

## Summary

Tout le périmètre technique est faisable sans nouvelle idée d'architecture. Le prototype (copie de travail dans `/tmp/rtp-proto`, dépôt non modifié) a installé `@playwright/test@1.64.1` et `@axe-core/playwright@4.14.0` avec `ignore-scripts=true` sans accroc, téléchargé Chromium par `npx playwright install chromium` (13 s), construit la fixture `corpus-m1` et le vrai corpus (63 pages) en preview, puis fait passer 570 tests. Sur le vrai corpus : axe (WCAG 2.2 AA, `serious`/`critical`) = 0 violation sur 63 pages × 4 niveaux ; clavier, police 160 %, zoom 160 % émulé, reduced-motion et 4G tous verts. La seule rupture réelle trouvée est visuelle : à 320 px de large avec la police à 160 %, une `<label>` du sélecteur de niveau déborde (377 px pour 320). Elle ne viole pas WCAG 1.4.10 (reflow mesuré à 100 %, vert), mais le plan doit soit corriger le CSS (`flex-wrap` sur le sélecteur), soit documenter la limite sur la page Méthode.

Trois pièges de test à connaître avant d'écrire une ligne : (1) le `<input type=radio>` du sélecteur est superposé au `<label>` (`position:absolute; inset:0; z-index:1`) : `locator('label').click()` échoue en timeout (« input intercepts pointer events »), il faut `getByRole('radio', { name }).check()` ; (2) `astro check` n'inclut pas `e2e/` ni `playwright.config.ts` tant qu'on n'élargit pas `tsconfig.json` ; (3) deux tests existants verrouillent la forme actuelle du dépôt et DOIVENT être mis à jour dans la même tranche : `tests/repo/scaffold.test.ts` (liste exacte des `devDependencies`) et `tests/repo/ci.test.ts` (`checkouts.length === 2`, `setup-node` unique, type `jobs`).

Pour le juridique, une correction par rapport à la mémoire courante : le droit de réponse est à l'**art. 1-1 III** de la LCEN (rédaction issue de la loi n° 2024-449 du 21 mai 2024, en vigueur depuis le 23 mai 2024), plus à l'art. 6 IV. La demande se fait dans les 3 mois de la mise à disposition du message ; le directeur de la publication insère la réponse dans les **3 jours** de sa réception. Le décret n° 2007-1527 qui l'applique porte encore dans son titre l'ancienne référence « IV de l'article 6 » : ne pas en déduire que l'art. 6 s'applique.

**Primary recommendation :** une tranche « socle » (deps + `playwright.config.ts` + serveur gzip + script `npm run e2e` qui construit séquentiellement ses propres dist) avant les pages ; les trois pages sont des composants Astro purs qui importent `config.ts`, `couverture-themes.yaml?raw` et `config/hebergeur.yml` ; le job CI `e2e` est séparé du job `verifier`, l'upload de l'artefact preview se fait dans `verifier` (qui a déjà construit `dist-preview`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pages Méthode / Mentions / Qui sommes-nous | Build-time (Astro SSG) | CDN / Static (Lot 3) | Contenu figé à la build ; aucune logique runtime. |
| Listes et bornes de la Méthode | Build-time (import de `config.ts`) | — | Source unique avec le validateur : une borne modifiée change la page. |
| Identité de l'hébergeur | Config (`config/hebergeur.yml`) lue au build | — | Change avec la cible de déploiement ; jamais en dur dans une page. |
| Bascule de niveau sans JS | Browser (CSS `:has()` + radios) | — | Déjà en place Phase 4 ; Phase 5 ne fait que la prouver. |
| Mémorisation `rtp:niveau` / `rtp:ordre` | Browser (localStorage, amélioration progressive) | — | Documenté en Mentions ; exemption CNIL. |
| Compression gzip pour le test 4G | Test harness (serveur Node maison) | Caddy (Lot 3) | `astro preview` ne compresse pas ; le harness imite Caddy `encode gzip`. |
| Throttling 4G | Navigateur de test (CDP `Network.emulateNetworkConditions`) | — | Chromium seulement. |
| URL de test | CI (artefact GitHub) | Preview locale | Pas d'hébergement avant le Lot 3. |
| Test croisé | Orchestrateur (agent) + outil de lecture CLI | CI (partie déterministe : pièges §12) | Partie non déterministe hors CI. |

## Standard Stack

### Core (nouvelles devDependencies, Chromium seulement)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.64.1 (registre : 1.64.1) | e2e : sans JS, clavier, CDP 4G, émulation reduced-motion | Un seul outil pour 4 exigences ; déjà justifié dans STACK.md |
| `@axe-core/playwright` | ^4.14.0 (registre : 4.14.0) | audit WCAG dans la suite Playwright | Réutilise le Chromium de Playwright ; pas de second navigateur |

`[VERIFIED: npm view]` versions 1.64.1 et 4.14.0 le 2026-11-03. Les deux noms sont déjà recommandés par STACK.md (sources officielles : Context7 `/microsoft/playwright`, `/dequelabs/axe-core-npm`, cités là) ; `npm view @playwright/test scripts.postinstall` est vide `[VERIFIED: npm view]`. slopcheck non exécuté dans cette session (voir audit) : le planner garde le `checkpoint:human-verify` avant `npm install`.

### Built with stdlib (aucune dépendance)
| Need | Native tool |
|---|---|
| Serveur statique gzip | `node:http` + `node:zlib` (`gzipSync`, niveau 6, mémoïsé), ~35 lignes, prototypé |
| Calcul de la page la plus lourde | `node:fs` + `node:zlib` (gzip HTML + CSS/JS référencés dans `/_astro/`) |
| Matérialiser la fixture `corpus-m1` | `tests/helpers/corpus-m1.ts` (existe) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Serveur gzip maison | `astro preview` | Ne compresse pas (STACK.md) : le test 4G serait faux. |
| Zoom navigateur réel | viewport 800 px + police 160 % | CDP ne zoome pas la page headless ; l'émulation par viewport/police est la proxy fiable (voir pièges). |

**Installation (prouvée dans le prototype, sous `ignore-scripts=true`) :**
```bash
npm install -D @playwright/test@^1.64.1 @axe-core/playwright@^4.14.0
npx playwright install chromium            # local : 13 s, ~100 Mio
npx playwright install --with-deps chromium   # CI ubuntu-24.04 (apt via sudo, fourni par le runner)
```
`playwright install` n'est pas un script de cycle de vie npm : `ignore-scripts=true` ne l'affecte pas `[VERIFIED: prototype]`. Chromium atterrit dans `~/.cache/ms-playwright` (Linux) / `~/Library/Caches/ms-playwright` (macOS). Le poste d'Erwan possède déjà d'anciennes révisions (1148, 1223, 1234) ; 1.64.1 a téléchargé `chromium_headless_shell-1248` `[VERIFIED: prototype]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @playwright/test | npm | plusieurs années | très élevé | github.com/microsoft/playwright | non exécuté | `[ASSUMED]` réputé ; version confirmée par `npm view` ; gater par `checkpoint:human-verify` |
| @axe-core/playwright | npm | plusieurs années | élevé | github.com/dequelabs/axe-core-npm | non exécuté | idem |

**Packages removed due to slopcheck [SLOP] verdict :** aucun (slopcheck non exécuté).
**Packages flagged [SUS] :** aucun détecté ; pas de `postinstall` sur `@playwright/test`. Le planner insère un `checkpoint:human-verify` avant l'install, conformément à la dégradation prévue, et rédige la justification d'une ligne par dépendance (déjà dans STACK.md).

## Architecture Patterns

### System Architecture Diagram

```
                     npm run e2e  (scripts/e2e.ts, jamais lancé par npm test)
                          |
        +-----------------+------------------------------+
        |                                                |
 materialiserCorpusM1(tmp)                       RTP_CONTENT_ROOT=. RTP_MODE=preview
        |  astro build --outDir dist-e2e/m1             |  astro build --outDir dist-e2e/reel
        |  (sequentiel : un seul build a la fois)       |  (apres le 1er, meme cache .astro)
        v                                                v
   dist-e2e/m1  ---------------+--------------- dist-e2e/reel
                               |
              playwright test (E2E_DIST=<dist>, E2E_PORT)
                               |
          webServer: node e2e/serveur.ts <dist> <port>   (gzip comme Caddy)
                               |
     +-------------+-----------+-----------+-------------+------------+
     |             |           |           |             |            |
  avec-js       sans-js     clavier     texte        mouvement      4g (CDP)
  axe x4 niveaux  bascule   Tab complet  160%/zoom/   reduced-motion  RTT 150ms
  contraste x10   radios    focus visible 320px reflow                 1.6 Mbps
                                                                      <1 s, page la plus lourde

CI : job verifier (existant)   -> build dist-preview -> upload-artifact (URL de test)
     job e2e (nouveau, parallele) -> npm ci, cache ms-playwright, install --with-deps chromium, npm run e2e
```

### Recommended Project Structure
```
config/hebergeur.yml            # NOUVEAU : identité hébergeur + statut (prevu|actif) + source/date de vérification
src/lib/hebergeur-config.ts     # NOUVEAU : lecteur strict, calqué sur site-config.ts, garde RTP_DEPLOIEMENT=1
src/lib/dates-tours.ts          # NOUVEAU : constante unique 18 avril / 2 mai 2027 (hall, Méthode, pied)
src/pages/methode.astro         # NOUVEAU
src/pages/mentions-legales.astro
src/pages/qui-sommes-nous.astro
e2e/                            # NOUVEAU (hors tests/ : le glob node:test ne le voit pas)
  serveur.ts  pages.ts  axe.spec.ts  sans-js.spec.ts  clavier.spec.ts  texte.spec.ts
  mouvement.spec.ts  contraste.spec.ts  4g.spec.ts  institutionnel.spec.ts
playwright.config.ts
scripts/e2e.ts                  # construit séquentiellement puis lance playwright
scripts/audit-lire.ts           # outil de lecture du test croisé (journalise chaque appel)
docs/AUDIT-TEST-CROISE.md       # journal d'audit
```

### Pattern 1 : Méthode générée depuis la config (prototypé, check-dist 0 erreur)
**What :** la page importe `config.ts` (module pur, conçu pour ça) et le YAML de couverture via Vite `?raw`, le valide par `lireCouverture` et appelle `classer`. Aucun chiffre de bornes ou de classement n'est écrit à la main.
```astro
---
// Source : prototype /tmp/rtp-proto, build + check-dist vert
import Base from '../layouts/Base.astro';
import { MOTS_INTERDITS, LONGUEURS, PERIMETRE_EQUITE, SEUIL_KANDEL_MOLES, NORMALISATION_CITATIONS, HYPOTHESES, CATALOGUE } from '../lib/content-core/rules/config.ts';
import { lireCouverture, classer } from '../../scripts/lib/couverture.ts';
import brut from '../../data/couverture-themes.yaml?raw';
const { data, problemes } = lireCouverture(brut);
if (problemes.length > 0) throw new Error(`data/couverture-themes.yaml : ${problemes[0]}`); // échec fermé
const r = classer(data);
---
<p data-liste-mots-interdits>{MOTS_INTERDITS.flatMap((m) => m.exemples).join(', ')}</p>
```
**Règles à respecter :**
- `couverture.ts` est pur (importe seulement `yaml` et `normalize.ts`) : l'importer depuis `src/pages` est correct, mais c'est un import `src -> scripts` ; le noter dans l'ADR (ou déplacer plus tard).
- Dans `config.ts`, seules les entrées de `MOTS_INTERDITS` (champ `exemples`) contiennent un mot interdit `[VERIFIED: grep]`. Les rendre UNIQUEMENT à l'intérieur de `data-liste-mots-interdits`. Ne pas afficher `motif`/`exceptions` hors de cet élément (« extrem », « enfin »...). L'exemption couvre le sous-arbre `[VERIFIED: scripts/lib/check-dist.ts:381-385]`.
- Tout texte de prose rédigé à la main sur les trois pages passe par le scan `MOT_INTERDIT` de check-dist : éviter « enfin », « courage », « extrême » (y compris dans « extrême droite »), « populisme ».
- `data/couverture-themes.yaml` vit à la racine du PROJET, pas dans la racine de contenu : la Méthode affiche donc toujours la mesure réelle, même pour un build de la fixture. C'est voulu (les chiffres 37/10/26 sont ceux de la mesure).
- Écart 59/51 : le **59** (et 37/17/5) se calcule depuis le corpus (`getCorpus()`, comptage des statuts) ; le **51** n'existe que dans `docs/COUVERTURE-THEMES.md` (prose), aucun fichier de données. Créer `data/dataset-datagouv.yaml` (`annonce: 51`, `fichier_du: 2026-10-28`, `source: URL`) lu au build, plutôt que de recopier le chiffre dans la page (recommandation ; voir Q2).
- Attribution Licence Ouverte 2.0 : texte déjà dans `LICENSE:74-80` ; reprendre l'URL du jeu de données depuis un fichier unique plutôt que dupliquer.
- Détails techniques repliés : `<details><summary>` natif (zéro JS, géré au clavier). Le catalogue de codes (≈ 45 lignes) et les hypothèses A1-A12 vont dans un `<details>`.
- Profil 4G affiché sur la Méthode : lire `150 ms / 1,6 Mbit/s` d'une constante exportée par un module partagé avec `e2e/4g.spec.ts` (un seul endroit).
- Poids : check-dist limite à 500 000 octets bruts / 100 000 gzip par page (Phase 4 : pages à ≈ 30 Ko / 10 Ko gzip) ; le catalogue complet tient largement.

### Pattern 2 : serveur gzip + config Playwright (prototypés)
```ts
// e2e/serveur.ts : node e2e/serveur.ts <dist> <port>  (Node 24 : type stripping natif)
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib'; import path from 'node:path';
const [racineArg, portArg] = process.argv.slice(2); const racine = path.resolve(racineArg!);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const memo = new Map<string, Buffer>();
createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.resolve(racine, `.${rel}`);
  if (!abs.startsWith(racine + path.sep) || !existsSync(abs) || !statSync(abs).isFile()) { res.writeHead(404).end('404'); return; }
  const ext = path.extname(abs), brut = readFileSync(abs);
  const h = { 'content-type': TYPES[ext as keyof typeof TYPES] ?? 'application/octet-stream', 'cache-control': 'no-store' };
  if (ext in TYPES && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    let gz = memo.get(abs); if (!gz) memo.set(abs, (gz = gzipSync(brut, { level: 6 })));
    res.writeHead(200, { ...h, 'content-encoding': 'gzip', vary: 'Accept-Encoding', 'content-length': String(gz.length) }).end(gz);
  } else res.writeHead(200, { ...h, 'content-length': String(brut.length) }).end(brut);
}).listen(Number(portArg), '127.0.0.1');
```
```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
const dist = process.env.E2E_DIST ?? 'dist-e2e/reel', port = Number(process.env.E2E_PORT ?? 4173);
export default defineConfig({
  testDir: 'e2e', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, ...devices['Desktop Chrome'], locale: 'fr-FR', timezoneId: 'Europe/Paris' },
  webServer: { command: `node e2e/serveur.ts ${dist} ${port}`, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 15_000 },
  projects: [
    { name: 'avec-js', testIgnore: /sans-js/ },
    { name: 'sans-js', testMatch: /sans-js\.spec\.ts/, use: { javaScriptEnabled: false } }, // CTX7 /microsoft/playwright
  ],
});
```
Le serveur n'est pas lancé par `npm test` : les specs sont dans `e2e/*.spec.ts`, le glob `tests/**/*.test.ts` ne les voit pas.

### Pattern 3 : tests (extraits prototypés, tous verts)
- **Axe** : `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()`, échec si `impact` ∈ {`serious`,`critical`}. Boucler sur toutes les pages du `dist` × 4 niveaux (`await page.locator('#niv-<n>').check()` quand la page a le sélecteur). 63 pages × 4 = 252 tests en ≈ 70 s.
- **Sans JS** : projet `sans-js`, `getByRole('radio', { name: 'Pour les enfants' }).check()` puis `.redaction[data-niveau="enfant"]` visible et `resume` caché ; vérifier aussi qu'aucun `<script>` n'est exécuté (le contexte est `javaScriptEnabled:false`).
- **Clavier** : `Tab` en boucle ; le premier arrêt est `A|#contenu` (lien d'évitement) ; l'ensemble visité inclut chaque `a[href]`, `button`, `summary` visibles et UN arrêt par groupe de radios ; l'indicateur de focus est un `outline` ≥ 2 px ou un `box-shadow` sur l'élément, son `<label>` ou son parent. Vert sur toutes les pages.
- **160 %** : (a) `html{font-size:160% !important}` à 1280 px, (b) zoom 160 % émulé = viewport 800 px, (c) reflow WCAG 1.4.10 à 320 px à 100 %. Assertions : `scrollWidth <= clientWidth` ; aucun élément visible tronqué (`overflow:hidden`/`text-overflow`, en ignorant les éléments de ≤ 1 px comme `.sr-only`).
- **Reduced motion** : `test.use({ reducedMotion: 'reduce' })` ; aucune `transition`/`animation` de durée > 0 ni `scroll-behavior:smooth` sur aucun élément. L'animation `rtp-reveler` (`0s` de durée, délai 1,5 s) passe car sa durée est nulle.
- **Contraste tous thèmes** : sur une page thème, réécrire `data-theme` en chacun des 10 ids (`logement`, `travail`, `ecole`, `climat`, `sante`, `impots`, `europe-et-monde`, `institutions`, `retraites`, `securite`) et lancer `withRules(['color-contrast'])` aux niveaux `resume` et `aine` : 20 tests verts. Nécessaire car le vrai corpus ne publie que 3 thèmes pilotes, donc axe sur les pages ne couvre pas les 10 couleurs.
- **4G** (CDP) :
```ts
const cdp = await context.newCDPSession(page);   // Chromium seulement
await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6*1024*1024/8, uploadThroughput: 750*1024/8 });
for (let i = 0; i < 3; i++) {
  await cdp.send('Network.clearBrowserCache'); await page.goto('about:blank');
  await page.goto(lourde.url, { waitUntil: 'load' });
  mesures.push(await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return n.loadEventEnd - n.startTime; }));
}
expect(Math.max(...mesures)).toBeLessThan(1000);
```
« Page la plus lourde » = HTML + CSS/JS référencés sous `/_astro/` en octets gzip, calculé par `node:fs`/`node:zlib` au chargement du fichier de spec. Sur le vrai corpus preview le débit réel est de ~10 Ko gzip pour la plus lourde de la fixture ; voir mesures ci-dessous.

### Mesures du prototype (machine d'Erwan, macOS, Node 24.22.2, Chromium headless shell 156)
| Jeu | Tests | Résultat | Durée |
|---|---|---|---|
| Fixture `corpus-m1` (preview, 12 pages) | 49 axe/sans-js puis 49 clavier/160 %/mouvement + 4G + 20 contraste | tout vert après correction des sélecteurs | axe+sans-js 22 s ; clavier+texte 5 s ; contraste 11 s |
| Vrai corpus (preview, 63 pages) | 570 | 568 verts ; 2 échecs attendus (voir plus bas) | 2 min 26 s, 1 worker |
| 4G, fixture : page la plus lourde `/themes/logement/` (10 207 o gzip) | 3 chargements à froid | **446, 385, 388 ms** | |
| 4G, vrai corpus : page la plus lourde | 3 chargements à froid | **432, 398, 377 ms** | |

Ressources réelles de la page lourde : HTML + `BadgeBrouillon.*.css` (2,2 Ko gzip), `LecteurNiveaux.*.css` (1,5 Ko), `OrdreCandidats.*.css` (0,7 Ko), `ordre.*.js` (0,8 Ko), `niveau.*.js` (0,5 Ko). Le coût est dominé par les allers-retours (150 ms d'abord pour le HTML, puis ≈ 150 ms pour les CSS/JS en parallèle), pas par les octets : marge ≈ 2,4× sous la barre d'1 s. Les 2 échecs sur le vrai corpus sont des défauts de spec, pas du site : `/themes/logement/` n'est pas une page du vrai corpus (pilotes : santé, travail, Europe et monde). Les specs doivent choisir leur page cible dans le `dist` (première page `/themes/<id>/`), jamais un id en dur.

### Anti-Patterns to Avoid
- **Cliquer le `<label>` du sélecteur :** le radio le recouvre (`position:absolute; inset:0; z-index:1` dans `niveaux.css:69-73`) ; Playwright boucle sur « intercepts pointer events » jusqu'au timeout. Toujours `getByRole('radio', { name }).check()` ou `#niv-<id>`.
- **Compter les `input` pour le clavier :** un groupe de radios n'a qu'un arrêt de tabulation (flèches à l'intérieur). Compter un arrêt par `name`.
- **Un `npm test` qui lance un navigateur :** interdit (les specs vivent dans `e2e/`, hors du glob).
- **Lancer `npm test` et `npm run e2e` en même temps en local :** les deux utilisent `astro build` dans le même projet (cache `.astro` partagé, corruption connue par `tests/dist/contexte.ts`). En CI ils tournent sur des runners distincts ; localement, documenter « l'un après l'autre » dans le RUNBOOK.
- **Mesurer la 4G pendant que d'autres tests tournent :** `workers: 1` et un projet dédié, ou lancer le fichier `4g.spec.ts` seul, pour que le CPU ne fausse pas la mesure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit WCAG | Vérifier le contraste/ARIA à la main | `@axe-core/playwright` | Moteur de référence, tags `wcag22aa` |
| Throttling réseau | Retarder les réponses dans le serveur | CDP `Network.emulateNetworkConditions` | Applique RTT et débit par requête, côté navigateur |
| Serveur de test | Une dépendance (`serve`, `http-server`) | 35 lignes `node:http` + `node:zlib` | Zéro dépendance ; la compression est justement l'objet du test |
| Listes de la Méthode | Recopier mots interdits/bornes dans la page | Import de `config.ts` | « un changement de borne change la page » |
| Classement des thèmes pilotes | Réécrire la règle de la marge | `classer()` de `scripts/lib/couverture.ts` | Déjà testé (Phase 3) |
| Rendu texte des pages pour le test croisé | Un parseur HTML | `scripts/lib/html-text.ts` / `html.ts` (existent) | Pas de dépendance HTML (décision Phase 4) |

## Mentions légales : ce que dit la loi (vérifié aujourd'hui)

Source : Légifrance, LCEN, loi n° 2004-575 du 21 juin 2004, **article 1-1**, créé par la loi n° 2024-449 du 21 mai 2024 (SREN), art. 48, « En vigueur depuis le 23 mai 2024 » `[CITED: https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614, consulté le 2026-11-03]`. Les fragments entre guillemets sont des citations littérales (≤ 125 caractères, limite de l'outil de lecture).

| Alinéa | Contenu pertinent |
|---|---|
| I, 3° | « Le nom du directeur ou du codirecteur de la publication » et, le cas échéant, celui du responsable de la rédaction |
| I, 4° | « Le nom, la dénomination ou la raison sociale, l'adresse et le numéro de téléphone » du fournisseur de services d'hébergement |
| I, 5° | les personnes qui « assurent, même à titre gratuit, le stockage de données traitées directement par elles » (ajout SREN) |
| II | les personnes éditant à titre non professionnel « peuvent ne tenir à la disposition du public, pour préserver leur anonymat, » « que le nom, la dénomination ou la raison sociale et l'adresse du fournisseur de services d'hébergement », « sous réserve d'avoir communiqué à ce fournisseur les éléments d'identification personnelle » mentionnés au I |
| III | « Toute personne nommée ou désignée dans un service de communication au public en ligne dispose d'un droit de réponse » ; demande « adressée au directeur de la publication ou, lorsque la personne éditant à titre non professionnel a conservé l'anonymat, au fournisseur de services d'hébergement, qui la transmet sans délai au directeur de la publication » |

Autres points du même article (paraphrase, non citée mot pour mot) : la demande est présentée dans les **3 mois** de la mise à disposition du message ; le directeur de la publication doit insérer la réponse dans les **3 jours** de sa réception, sinon amende de 3 750 € `[CITED: Légifrance, art. 1-1 III ; recoupé avec PITFALLS.md]`. Le IV traite du droit de réponse des associations ; le V renvoie aux chapitres IV et V de la loi de 1881. Les sanctions pénales sont à l'art. 1-2.

Décret d'application : n° 2007-1527 du 24 octobre 2007 (demande par lettre recommandée avec AR ou moyen équivalent garantissant l'identité et la réception ; contenu : références du message, conditions d'accès, nom de l'auteur ; réponse présentée comme telle, accessible aussi longtemps que le message) `[CITED: https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000428279, via recherche ; texte intégral non relu]`. Le titre du décret vise « le IV de l'article 6 » : c'est l'ancienne numérotation ; la page cite l'art. 1-1 III. `[ASSUMED]` : le délai de transmission « sous 24 heures » par l'hébergeur (relevé dans un résumé de recherche, non vérifié sur le texte) : ne pas l'écrire sur la page.

### Wording recommandé (à faire relire par un juriste avant le Lot 3)
- **Cadre :** « Ce site est édité à titre non professionnel, au sens du II de l'article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), dans sa rédaction issue de la loi n° 2024-449 du 21 mai 2024. »
- **Éditeur et directeur de la publication :** « Erwan Henry. » Aucune adresse, aucun téléphone personnels. (Le II autorise de ne publier que l'identité de l'hébergeur, à la condition d'avoir remis son identité à l'hébergeur : **cette condition est un acte à accomplir au Lot 3 avec Hetzner, à noter dans le RUNBOOK ; la page ne peut l'attester avant.**)
- **Contact :** `site.contact` de `config/site.yml` (lien `mailto:`). Rappel : valeur provisoire `.invalid` => check-dist émet `CONTACT_PROVISOIRE` en avertissement, en erreur avec `RTP_DEPLOIEMENT=1`.
- **Hébergeur (Lot 3, `statut: prevu`) :** Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne ; tél. +49 (0)9831 505-0 ; registre : Ansbach, HRB 6089. Relevé sur https://www.hetzner.com/legal/legal-notice/ (page « Legal Notice », sans date de mise à jour, pied « © 2026 Hetzner Online GmbH »), consulté le 2026-11-03 `[CITED: hetzner.com/legal/legal-notice]`. Le numéro de téléphone est exigé par le I 4°. Vérifier avant le Lot 3 que le VPS d'Erwan est bien chez Hetzner Online GmbH (RUNBOOK : « Hetzner — compte Erwan », VPS `ubuntu-4gb-nbg1-2`) et non chez une autre entité du groupe.
- **État honnête de la preview :** « Cette version de test n'est pas mise en ligne : elle est remise sous forme de fichiers aux personnes qui relisent le projet. L'hébergement sur le serveur d'Hetzner est prévu à la mise en ligne. » La page lit `statut` dans `hebergeur.yml` : `prevu` => ce bloc ; `actif` => la phrase au présent. Une garde `RTP_DEPLOIEMENT=1` + `statut: prevu` doit faire échouer le build, comme pour le contact (WR-03).
- **Droit de réponse :** art. 1-1 III ; demande écrite au directeur de la publication à l'adresse de contact ; dans les 3 mois ; réponse insérée dans les 3 jours de la réception. Ne pas citer l'amende sur la page publique.
- **Arcom :** « Ce site n'est pas un service de communication audiovisuelle et n'est pas soumis à la supervision de l'Arcom. L'égalité de traitement des candidats est une règle éditoriale que nous nous imposons. » (formulation de PITFALLS ; ne jamais suggérer un aval officiel)
- **Données personnelles :**
  - aucune donnée collectée, aucun cookie, aucun script externe, aucune statistique de visite côté page ;
  - deux clés du stockage local du navigateur, créées seulement si le visiteur change le réglage : `rtp:niveau` (valeurs `resume`, `detaille`, `enfant`, `aine`) et `rtp:ordre` (`alphabetique`, `aleatoire`) ; elles ne quittent jamais l'appareil et n'identifient personne ;
  - le visiteur peut les effacer à tout moment dans les réglages du navigateur ;
  - cliquer « Signaler une erreur (courriel) » ouvre son logiciel de courrier : c'est une action volontaire ; l'adresse du visiteur n'est connue que s'il envoie le message.
- **CNIL :** le stockage et la lecture d'informations sur le terminal relèvent de l'art. 82 de la loi Informatique et Libertés, qui ne vise pas que les cookies. Sont exemptés de consentement les traceurs de personnalisation de l'interface (« choix de la langue ou de la présentation d'un service ») quand ils sont « un élément intrinsèque et attendu du service » `[CITED: https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi]`. La page CNIL consultée ne nomme pas explicitement `localStorage` : l'application à `localStorage` est une interprétation `[ASSUMED]` cohérente avec PITFALLS.md (« localStorage counts »). L'exemption tient seulement si ces clés ne stockent rien d'autre (pas d'identifiant, de compteur ni de graine d'ordre aléatoire persistée) : un test e2e doit asserter que, après navigation et changement de réglages, `Object.keys(localStorage)` ⊆ {`rtp:niveau`, `rtp:ordre`} et que `document.cookie` est vide.
- **Clés :** PITFALLS.md écrit `rtp.niveau` (point) ; le code utilise `rtp:niveau` et `rtp:ordre` (deux-points) `[VERIFIED: src/scripts/niveau.js, ordre.js]`. La page affiche celles du code, lues si possible depuis une constante partagée.

## Common Pitfalls

### Pitfall 1 : radio superposé au label
**What goes wrong :** `label.click()` expire, aucun message utile (« Test timeout » sans ligne). **Why :** `.niveau input { position:absolute; inset:0; z-index:1 }`. **Avoid :** `getByRole('radio').check()`. **Warning :** `DEBUG=pw:api` affiche « intercepts pointer events ».

### Pitfall 2 : `scrollWidth` à 320 px avec police 160 %
**What goes wrong :** un `<label>` du sélecteur atteint 377 px sur 320 `[VERIFIED: prototype, toutes les pages]`. **Why :** les 4 étiquettes sont en `flex:1` sans retour à la ligne. **Avoid :** `flex-wrap:wrap` (ou colonne sous un point de rupture) sur `.niveaux`/`.niveau` ; sinon assertion limitée à 320 px/100 % et limite notée en Méthode. Décision à prendre par le planner ; le critère QUAL-04 (« 160 % ») est satisfait par les cas (a) et (b) qui passent.

### Pitfall 3 : faux positifs « texte tronqué »
`.sr-only` (clip volontaire) et les `.etiquette` masquées (rectangle ≤ 1 px) ressortent comme tronqués. Ignorer les éléments de largeur/hauteur ≤ 1 px.

### Pitfall 4 : les tests figés du dépôt cassent
`tests/repo/scaffold.test.ts:47-54` compare la liste exacte des deps/devDeps ; `tests/repo/ci.test.ts` exige exactement 2 `actions/checkout`, 1 `actions/setup-node`, et type les `jobs` comme `{ verifier, secrets }`. Un job `e2e` avec son propre checkout/setup-node impose de mettre ces assertions à jour dans la même tranche (checkout 3, setup-node 2, tous épinglés SHA avec commentaire `# vN`). Les nouvelles lignes `uses:` doivent finir par `@<40 hex> # v<chiffre>`.

### Pitfall 5 : couverture de type
`astro check` n'inspecte `e2e/` que si `tsconfig.json` l'inclut : ajouter `"e2e/**/*", "playwright.config.ts"` dans `include` (prototypé : détecte une erreur réelle `string | undefined`). `noUncheckedIndexedAccess` est actif : `m[1]!` ou garde.

### Pitfall 6 : contraste des 10 thèmes non couvert par axe sur les pages
Voir Pattern 3. Sans le test d'injection de `data-theme`, 7 couleurs sur 10 ne sont jamais vérifiées.

### Pitfall 7 : `astro preview` ne compresse pas, `cache-control`
Le serveur maison pose `cache-control: no-store` pour que chaque chargement 4G soit à froid ; ne pas le comparer à Caddy sur le cache.

### Pitfall 8 : mots interdits dans les pages institutionnelles
Voir Pattern 1. Le scan `MOT_INTERDIT` de check-dist s'applique à toutes les pages du `dist`, donc aux trois nouvelles pages.

### Pitfall 9 : branding tiers
INST-03 : ajouter un test (check-dist ou e2e `institutionnel.spec.ts`) qui échoue si une page contient `Alignd`, `SpikeeLabs`, « faire un don »/`don`, `paypal`, `helloasso`, `buymeacoffee`, `ko-fi`. Attention : la compétence `banc-test-croise` vient du dossier Alignd ; ne pas mentionner sa provenance sur le site (le journal d'audit du dépôt peut nommer la compétence).

## Code Examples

### CI : upload de la preview (URL de test) et job e2e (à ajouter)
```yaml
# Dans le job verifier, juste après « Contrôler le site du corpus réel (preview...) » :
      - name: Publier la build preview (URL de test, artefact)
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: site-preview
          path: dist-preview
          retention-days: 14
          if-no-files-found: error

  e2e:
    name: Tests navigateur (Playwright, axe, 4G)
    runs-on: ubuntu-24.04
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - name: Cache Chromium de Playwright
        id: pw-cache
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - name: Installer Chromium (navigateur + dépendances système)
        run: npx playwright install --with-deps chromium   # sans cache : navigateur + apt ; avec cache : réinstaller au moins les dépendances système
      - run: npm run e2e
      - name: Rapport Playwright (si échec)
        if: failure()
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with: { name: playwright-report, path: playwright-report, retention-days: 7 }
```
SHA relevés avec `gh api repos/actions/<action>/git/ref/tags/<tag>` le 2026-11-03 : `upload-artifact` v7.0.2 = `cf430e030ddbb5b0abf93d22962f4752f3646cd9` (publiée le 2026-10-07, c'est la dernière release `[VERIFIED: gh api]`), `cache` v6.1.0 = `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` `[VERIFIED: gh api]`. `checkout` et `setup-node` : SHA déjà épinglés dans `ci.yml`. Note : `playwright install --with-deps` réinstalle toujours les paquets apt même avec un cache de navigateur ; cacher `~/.cache/ms-playwright` économise seulement le téléchargement (~100 Mio, 13 s en local) : gain faible, le cache est optionnel (à garder simple, ne pas ajouter `actions/cache` si le planner veut limiter les actions épinglées). `permissions: contents: read` suffit pour `upload-artifact` `[ASSUMED]` (aucun test sur GitHub dans cette session).

L'artefact `site-preview` : l'utilisateur le télécharge (zip) puis lance `node e2e/serveur.ts <dossier> 4173` ou `npx astro preview` ; documenter dans le RUNBOOK. Le `dist-preview` est déjà `noindex` + `robots.txt` (contrôlé par `check-dist --mode preview`).

### `scripts/e2e.ts` (esquisse)
```ts
// Construit séquentiellement (un seul astro build à la fois) puis lance playwright par jeu.
// 1) fixture : materialiserCorpusM1(tmp) ; RTP_CONTENT_ROOT=tmp ; RTP_MODE=preview ; astro build --outDir dist-e2e/m1
// 2) réel    : RTP_CONTENT_ROOT=.   ; RTP_MODE=preview ; astro build --outDir dist-e2e/reel
// 3) pour chaque dist : E2E_DIST=dist-e2e/<x> E2E_PORT=<p> npx playwright test
// Code de sortie non nul si l'un des trois échoue. Supprimer dist-e2e/ et le dossier temporaire en fin.
```
Ajouter à `.gitignore` : `/dist-e2e/`, `/playwright-report/`, `/test-results/`. Script npm : `"e2e": "node scripts/e2e.ts"`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LCEN art. 6 III pour l'identification de l'éditeur | LCEN **art. 1-1** (I à III) | loi SREN 2024-449, en vigueur 2024-05-23 | Les modèles de mentions qui citent l'art. 6 sont périmés |
| Droit de réponse « IV de l'article 6 » | **art. 1-1 III** | idem | Le décret 2007-1527 garde l'ancien intitulé |
| Lighthouse pour la perf | CDP `emulateNetworkConditions` + octets gzip | STACK.md | Déterministe, aucune dépendance en plus |

**Deprecated :** `astro:content`'s `z` (utiliser `astro/zod`), déjà géré en Phase 1.

## Runtime State Inventory
Phase non concernée (ni renommage, ni migration) : section omise.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@playwright/test` et `@axe-core/playwright` sont légitimes (slopcheck non exécuté) | Package Legitimacy | Faible (noms recommandés par STACK.md avec sources officielles) ; checkpoint humain avant `npm install` |
| A2 | L'exemption CNIL « personnalisation de l'interface » couvre `localStorage` | Mentions légales | Moyen : si non, bandeau de consentement requis ; relecture juriste |
| A3 | Délai de transmission de 24 h par l'hébergeur (décret 2007-1527) | Mentions légales | Faible : non écrit sur la page |
| A4 | `upload-artifact` fonctionne avec `permissions: contents: read` | CI | Faible : l'artefact n'exige pas `actions: write` ; à confirmer au premier run |
| A5 | Le VPS d'Erwan relève de Hetzner Online GmbH (Allemagne) | Mentions légales | Moyen : mauvaise entité si autre société du groupe ; à vérifier au Lot 3 avec la facture Hetzner |
| A6 | Le coût en tokens du test croisé (3 personas, ≈ 8 pages chacun) est de l'ordre de quelques centaines de milliers de tokens | Test croisé | Faible ; la compétence demande une estimation annoncée avant lancement |
| A7 | Le « 51 » du dataset n'a pas d'autre source de données que `docs/COUVERTURE-THEMES.md:162` | Méthode | Faible : créer `data/dataset-datagouv.yaml` |

## Open Questions (RESOLVED)

1. **Un seul job CI ou deux ?** — RESOLVED : deux. L'upload de l'artefact preview va dans `verifier` (il a déjà `dist-preview`) ; le nouveau job `e2e` est indépendant, évite d'allonger `verifier` (timeout 15 min) et ne partage pas de cache `.astro`. Conséquence : mettre à jour `tests/repo/ci.test.ts` (compte de checkout/setup-node, type des jobs) dans la même tranche.
2. **D'où vient le 51 de l'écart 59/51 ?** — RESOLVED : uniquement de la prose de `docs/COUVERTURE-THEMES.md`. Créer `data/dataset-datagouv.yaml` (annonce 51, fichier du 2026-10-28) ; calculer 59/37/17/5 depuis le corpus au build. Si le planner préfère ne rien créer, mettre 51 dans un `const` documenté dans `src/lib/`, mais pas dans `config.ts` (qui ne doit pas être modifié par les plans, d'après son en-tête).
3. **Que dire de l'hébergeur d'une preview non hébergée ?** — RESOLVED : `config/hebergeur.yml` porte `statut: prevu|actif` ; la page affiche honnêtement « non mise en ligne » tant que `prevu` ; garde de build `RTP_DEPLOIEMENT=1` refuse `prevu`.
4. **Comment prouver « zoom 160 % » avec Chromium headless ?** — RESOLVED : pas de zoom navigateur via CDP ; on prouve la propriété par trois émulations (police 160 %, viewport 800 px, reflow 320 px) ; le défaut réel à 320 px + police 160 % est consigné (Pitfall 2).
5. **La compétence `banc-test-croise` existe-t-elle ?** — RESOLVED : oui, voir ci-dessous.
6. **Les e2e ont-ils leur place dans `npm test` ?** — RESOLVED : non, `npm run e2e` séparé ; `ci.test.ts` ne doit pas être touché pour `npm test`.

## Test croisé simulé (QUAL-06)

**Compétence trouvée :** `banc-test-croise`, versions identiques à `/Users/erwanhenry/claude-projects/alignd/code/methodologie/skills/banc-test-croise/SKILL.md` (aussi dans le plugin skills de Cowork et dans `alignd/code/crm/.claude/skills/`). Elle n'est PAS dans `~/.claude/skills/` : le planner la référence par chemin ou en copie le contenu utile (4 Ko) dans le plan, sans dépendre de ce chemin. Elle prescrit :
1. Avant : critère de succès mesurable, signal d'échec, action corrective ; estimation du coût en tokens avec variante réduite (tests bloquants seulement) ; aucune donnée réelle.
2. Étapes : spécification testable (règles numérotées, paramètres en `{ACCOLADES}`) ; jeu de données piégé (un comportement par élément) ; scénario (suite de messages, résultat attendu, bloquant ou non, **jamais donné à l'agent testé**) ; outil sous test (réel en bac à sable ou faux outil en ligne de commande : lectures libres, journal de chaque appel, pas d'écriture sauf par l'orchestrateur) ; agent testé (Sonnet par défaut, un seul agent relancé message par message) ; notation OK/Partiel/KO (un seul KO bloquant = pas prêt) ; contrôle croisé (classer chaque écart : défaut de spécification, d'outil, d'instructions du projet).
3. Livrables : résultats (verdict, grille, constats, corrections), journal brut des appels, spécification corrigée.
4. Limites à annoncer : si l'auteur de la spec note aussi le test, livrer le journal brut pour contre-vérification ; un test sur faux outil valide la spécification et l'agent, pas l'outil réel.
5. Forme : français, aucun tiret cadratin, demi-cadratin ni double tiret (y compris tableaux et Mermaid).

**Adaptation au site statique (recommandée) :**
- *Outil sous test* = `scripts/audit-lire.ts <chemin> [--niveau resume|detaille|enfant|aine]` : lit un fichier de `dist-preview/`, imprime le texte visible (réutilise `scripts/lib/html-text.ts`) pour le niveau demandé, **ajoute une ligne à `audit/journal.jsonl`** (horodatage, persona, chemin, niveau, SHA-256 du HTML servi). Lecture seule, aucun réseau. L'orchestrateur lance un sous-agent par persona (modèle cible : Sonnet) avec pour seules consignes : la brève du persona, la liste des commandes, la charte (CLAUDE.md du projet) ; le scénario reste chez l'orchestrateur.
- *Personas et tâches (exemples de scénario, à écrire dans le journal comme « attendu »)* : **enfant 10 ans** : trouver sur la page Santé la mesure d'un candidat au niveau enfant ; critère bloquant : pas de mot hors glossaire sans explication, phrases ≤ 15 mots, aucun chiffre qui n'est pas dans la source. **Retraité 72 ans** : atteindre « Retraites/Santé » en priorité, niveau Gros caractères, lire la source et sa date ; bloquant : accès sans JS, texte lisible, lien de source daté. **Journaliste** : vérifier une citation contre l'archive (SHA-256, Wayback), retrouver pourquoi un candidat a une case vide, trouver la règle de choix des thèmes pilotes et l'écart 59/51 ; bloquant : chaque mesure a une source primaire datée, les états vides sont typés et expliqués, la Méthode est cohérente avec le dépôt.
- *Données piégées (§12, sept pièges)* : déjà couvertes de façon déterministe par `tests/fixtures/pieges/*` et `tests/pieges/pieges.test.ts` (SOURCE_ABSENTE, MOT_INTERDIT, SONDAGE_NOTICE_ABSENTE, SONDAGE_SOMME_HORS_BORNES, SONDAGE_TOUR2_EN_TOUR1, CHIFFRE_HORS_SOURCE, SONDAGE_FENETRE_BLOCAGE `[VERIFIED: ls tests/fixtures/pieges]`). Le journal cite, pour chaque piège, la commande rejouée et la sortie : `npm test -- tests/pieges/pieges.test.ts` (ou `node --test tests/pieges/pieges.test.ts`), plus `validate --mode production` sur un corpus piégé matérialisé en `/tmp`. Pièges supplémentaires utiles côté lecture, déjà dans `corpus-m1` : brouillon dont le titre « Guichet unique départemental » (`TRAPPE_BROUILLON`) ne doit jamais sortir en production ; candidat « pressenti » ; candidat qui a « renoncé » ; page sans mesure.
- *Critère de succès mesurable* : 100 % des tests bloquants OK ; 0 KO ; chaque piège §12 rejeté ou signalé avant publication (7/7) ; journal brut présent.
- *Contenu du journal d'audit* (`docs/AUDIT-TEST-CROISE.md`) : date et version du dépôt (SHA git) ; build testée (mode, SHA de `dist-preview`) ; critère de succès / signal d'échec / action corrective ; persona, brève et modèle utilisé ; scénario avec « attendu » et « bloquant ou non » (écrit AVANT les résultats) ; grille OK/Partiel/KO avec renvoi aux lignes du journal brut ; table des pièges §12 (piège, code de rejet, commande, résultat) ; constats classés (spec / outil / instructions) ; corrections appliquées et rejouées ; limites (l'auteur note aussi : journal brut fourni ; test sur build locale, pas sur serveur réel, Safari/VoiceOver non testés). Joindre `audit/journal.jsonl` (ne contient aucune donnée personnelle ni secret).
- *Reproductibilité :* la partie déterministe (pièges, génération des textes) est rejouable par une commande ; la partie agent ne l'est pas strictement (modèle) : l'annoncer, fournir le journal brut, fixer la version du modèle dans le journal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 (`fnm exec --using=24`) | tout | ✓ | 24.22.2 | — |
| npm | install deps | ✓ | livré avec Node 24 | — |
| Chromium Playwright | e2e | ✓ après `npx playwright install chromium` | headless shell 156 (rév. 1248) | — |
| `gh` CLI | SHA d'actions | ✓ | — | — |
| Accès réseau (Légifrance, Hetzner, CNIL) | recherche | ✓ | — | — |
| `slopcheck` | audit des paquets | non exécuté | — | `checkpoint:human-verify` avant `npm install` |
| Runner GitHub `ubuntu-24.04` + `sudo apt` | `--with-deps` | ✓ (standard) | — | — |

Aucune dépendance bloquante.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework unitaire | `node:test` + `node:assert` (Node 24, TS natif), 1533 tests au 04-REVIEW-FIX |
| Framework navigateur | `@playwright/test` ^1.64.1 + `@axe-core/playwright` ^4.14.0 (nouveau) |
| Config | `playwright.config.ts` (nouveau) ; aucune pour node:test |
| Quick run | `node --test tests/repo/*.test.ts tests/scripts/*.test.ts` (sans build, < 10 s) |
| Build run | `node --test tests/dist/site.test.ts` (seul fichier qui lance `astro build` dans `npm test`) |
| E2E | `npm run e2e` (séquentiel : build fixture, build réel preview, playwright ×2) |
| Full suite | `npm test && npm run check && npm run build && npm run check-dist && npm run e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INST-01 | Méthode contient chaque borne/liste de `config.ts` ; une borne modifiée change la page | build + dist | cas `tests/dist/cas/methode.cas.ts` : lit `methode/index.html`, compare à `LONGUEURS`, `MOTS_INTERDITS[].exemples`, `PERIMETRE_EQUITE`, `classer()` ; test de mutation (surcharger la config n'est pas possible sans build : comparer à l'import) | ❌ Wave 0 |
| INST-01 | `data-liste-mots-interdits` exempté, hors de l'élément un mot interdit est refusé | unit | `tests/scripts/check-dist.test.ts` (existe) + cas | ✅ / ❌ cas |
| INST-02 | Mentions : « article 1-1 », « Erwan Henry », hébergeur depuis `hebergeur.yml`, droit de réponse « trois jours », clés `rtp:niveau`/`rtp:ordre`, aucune adresse, pas de « article 6 » | build + dist | `tests/dist/cas/mentions.cas.ts` | ❌ Wave 0 |
| INST-02 | `hebergeur.yml` : lecteur strict, `RTP_DEPLOIEMENT=1` + `prevu` => erreur | unit | `tests/corpus/hebergeur-config.test.ts` (calqué sur `site-config.test.ts`) | ❌ Wave 0 |
| INST-03 | Aucune chaîne Alignd/SpikeeLabs/don sur tout le dist | build + dist | cas `qui-sommes-nous.cas.ts` (tout le dist) | ❌ Wave 0 |
| INST-04 | « 18 avril » et « 2 mai 2027 » dans hall + Méthode | build + dist | cas `dates.cas.ts` | ❌ Wave 0 |
| QUAL-02 | sans JS, clavier, axe | e2e | `npx playwright test e2e/sans-js.spec.ts e2e/clavier.spec.ts e2e/axe.spec.ts` | ❌ Wave 0 |
| QUAL-03 | 4G < 1 s | e2e | `npx playwright test e2e/4g.spec.ts --project=avec-js` | ❌ Wave 0 |
| QUAL-04 | 160 %, reduced-motion, contraste | e2e | `npx playwright test e2e/texte.spec.ts e2e/mouvement.spec.ts e2e/contraste.spec.ts` | ❌ Wave 0 |
| QUAL-05 | artefact `site-preview` produit par CI | CI structure | `tests/repo/ci.test.ts` : étape `upload-artifact` avec `path: dist-preview` après le contrôle preview | ❌ (à étendre) |
| QUAL-06 | `docs/AUDIT-TEST-CROISE.md` existe, 3 personas, 7 pièges, verdict, 0 KO bloquant ; `audit/journal.jsonl` non vide | doc | `tests/repo/docs.test.ts` (étendre) | ❌ Wave 0 |

### Sampling Rate
- **Par commit de tâche :** tests node ciblés (< 10 s) ; pour les pages : `node --test tests/dist/site.test.ts` (20-40 s).
- **Par vague :** quick + build + `npm run check` ; `npm run e2e` après chaque vague qui touche CSS ou pages.
- **Avant `/gsd:verify-work` :** suite complète verte, y compris `npm run e2e` (≈ 3 min en local, `workers:1`), et le test croisé archivé.
- **Latence max de feedback :** 60 s (node), 3 min (e2e).

### Wave 0 Gaps
- [ ] `package.json` : deux devDeps + script `e2e` ; mettre à jour `tests/repo/scaffold.test.ts:47-54` (liste exacte).
- [ ] `tests/repo/ci.test.ts` : nouveaux compteurs (checkout 3, setup-node 2), type `jobs`, étape upload-artifact, job `e2e`.
- [ ] `tsconfig.json` : inclure `e2e/**/*` et `playwright.config.ts`.
- [ ] `.gitignore` : `/dist-e2e/`, `/playwright-report/`, `/test-results/`.
- [ ] `config/hebergeur.yml` + `src/lib/hebergeur-config.ts` + test.
- [ ] `playwright.config.ts`, `e2e/serveur.ts`, `e2e/pages.ts`, specs, `scripts/e2e.ts`.
- [ ] `docs/RUNBOOK.md` : section e2e (installation, un build à la fois), URL de test, droit de réponse sous 3 jours, relecture juridique avant le Lot 3, formalité « identité remise à l'hébergeur » (II).
- [ ] `docs/ARCHITECTURE.md` : ADR (e2e hors `npm test`, import `scripts/lib/couverture.ts` depuis une page, hébergeur `prevu|actif`).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | site statique, aucun compte |
| V3 Session Management | non | aucune session ; localStorage non sensible |
| V4 Access Control | non | contenu public ; l'artefact CI hérite des droits du dépôt |
| V5 Input Validation | oui | lecteurs YAML stricts (`schema: core`, clés uniques, pas d'alias), échec fermé pour `hebergeur.yml` et `dataset-datagouv.yaml` ; serveur de test : refus de sortie de racine (`startsWith(racine + sep)`) |
| V6 Cryptography | non | SHA-256 existant (`node:crypto`) |
| V14 Configuration | oui | actions épinglées SHA, `contents: read`, `ignore-scripts=true`, pas de `pull_request_target` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Traversée de chemin dans le serveur de test | Tampering / Disclosure | `path.resolve` + contrôle du préfixe ; écoute sur `127.0.0.1` seulement |
| Action tierce modifiée (supply chain) | Tampering | épinglage par SHA de 40 hex + commentaire de version (test `ci.test.ts`) |
| Paquet npm malveillant (Playwright/axe) | Tampering | `ignore-scripts=true`, `npm audit signatures` déjà en CI, `checkpoint:human-verify` |
| Fuite de données personnelles dans les mentions | Information disclosure | aucune adresse ni téléphone personnels ; contact dédié |
| Contenu de PR de fork exécuté avec secrets | Elevation | aucun secret dans le job `e2e` ; `persist-credentials:false` |
| Journal d'audit contenant des secrets/PII | Disclosure | `audit-lire.ts` n'enregistre que chemin, niveau, hash ; aucun jeton |

## Sources

### Primary (HIGH confidence)
- Prototype local `/tmp/rtp-proto` (Node 24.22.2, Playwright 1.64.1, axe 4.14.0) : installation sous `ignore-scripts=true`, 570 tests, timings 4G.
- `npm view @playwright/test version` (1.64.1), `npm view @axe-core/playwright version` (4.14.0), `npm view @playwright/test scripts.postinstall` (vide), 2026-11-03.
- `gh api repos/actions/upload-artifact/git/ref/tags/v7.0.2` (`cf430e03...`), `repos/actions/cache/git/ref/tags/v6.1.0` (`55cc8345...`), `releases/latest`, 2026-11-03.
- Légifrance, LCEN art. 1-1 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614 (consulté 2026-11-03).
- Hetzner, Legal Notice : https://www.hetzner.com/legal/legal-notice/ (consulté 2026-11-03, sans date de page).
- CNIL, « Cookies et traceurs : que dit la loi ? » : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi (consulté 2026-11-03).
- Code et fichiers du dépôt lus : `config.ts`, `check-dist.ts`, `Base.astro`, `niveaux.css`, `site-config.ts`, `ci.yml`, `ci.test.ts`, `scaffold.test.ts`, `corpus-m1.ts`, `couverture.ts`, `data/couverture-themes.yaml`, `docs/COUVERTURE-THEMES.md`.
- Compétence `banc-test-croise` : `/Users/erwanhenry/claude-projects/alignd/code/methodologie/skills/banc-test-croise/SKILL.md`.

### Secondary (MEDIUM confidence)
- Décret 2007-1527 (résultat de recherche + page Légifrance, texte non relu en entier) : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000428279
- `.planning/research/PITFALLS.md` (Pitfalls 12, 13 et 14 sur les mentions, la CNIL et l'Arcom) et `STACK.md`.

### Tertiary (LOW confidence)
- Aucune information issue d'une seule source non officielle n'est utilisée comme fait ; les points non vérifiés sont dans l'Assumptions Log.

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH, installé et exécuté dans le prototype.
- Architecture : HIGH pour le côté Playwright/CI/Méthode (prototypés) ; MEDIUM pour le job CI sur GitHub (non exécuté sur GitHub).
- Pitfalls : HIGH (reproduits).
- Juridique : MEDIUM, citations littérales de Légifrance mais interprétation (CNIL/localStorage, condition du II) à faire relire par un juriste avant le Lot 3.

**Research date :** 2026-11-03
**Valid until :** 2026-12-03 (stack stable) ; juridique : à revalider avant le Lot 3.
