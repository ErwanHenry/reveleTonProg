# Phase 7: Domaine paramétré, inlining et dette - Research

**Researched:** 2026-11-07
**Domain:** Astro 7.4.5 statique, CSP par `<meta>` à empreintes, inlining CSS et scripts, configuration de domaine unique, tests Playwright (CSP, bfcache), dette d'audit v1.0
**Confidence:** HIGH (spike CSP exécuté de bout en bout sur une copie du dépôt dans `/tmp/rtp-spike7`, Node 24.22.2, Astro 7.4.5, Chromium 156) ; MEDIUM pour la syntaxe Caddy (non validée par `caddy validate`, Docker éteint)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Domaine (HEB-05, HEB-06)**
- **D-01:** Nouveau champ `domaine` dans `config/site.yml`, lu par le lecteur strict `src/lib/site-config.ts`. Valeur provisoire `domaine-a-definir.invalid` (le domaine n'est pas acheté).
- **D-02:** Sous `RTP_DEPLOIEMENT=1`, un domaine en `.invalid` fait échouer la build et check-dist, comme `CONTACT_PROVISOIRE` (même mécanisme, nouveau code stable dans le catalogue s'il passe par check-dist).
- **D-03:** Le domaine alimente `site` dans `astro.config.mjs`, une balise `<link rel="canonical">` par page (Base.astro), un `sitemap.xml` écrit à la main (endpoint Astro, sans `@astrojs/sitemap`), la ligne `Sitemap:` de `robots.txt` en production seulement, et le bloc Caddy rendu par un script (`scripts/render-caddy.ts` ou équivalent) vers `deploy/caddy/site.caddy` avec un test de dérive. En preview, pas de `Sitemap:` et `noindex` conservé.
- **D-04:** Un test de dépôt refuse tout nom d'hôte du site écrit en dur hors de `config/site.yml` (les URL de sources, data.gouv, GitHub et Wayback restent permises).

**Inlining et CSP (PERF-01)**
- **D-05:** CSS dans chaque page : `build.inlineStylesheets: 'always'`. Garder `vite.build.assetsInlineLimit: 0` (sinon les scripts deviennent des URI `data:`, refusées par `SCRIPT_DATA_URI`).
- **D-06:** Scripts de niveau et d'ordre dans la page via `import … from '../scripts/x.js?raw'` et `<script is:inline set:html={…}>`, toujours classiques et bloquants à leur place actuelle (ADR-040). Le plafond de 2048 octets par script reste.
- **D-07:** CSP par page en `<meta>` via `security.csp` d'Astro (option A), empreintes sha256 des styles calculées par Astro, empreintes des deux scripts fournies par `scriptDirective.hashes` à partir de `node:crypto` sur les fichiers sources (pas de dérive possible). Jamais `unsafe-inline` sur `script-src`. Repli (option B) seulement si un spike montre que A ne couvre pas les `is:inline` : documenter dans un ADR.
- **D-08:** check-dist : les règles `SCRIPT_EN_LIGNE` et `STYLE_EN_LIGNE` (ADR-037) sont remplacées par des règles à empreintes, jamais simplement supprimées : un script en ligne est accepté seulement s'il est identique octet pour octet à un fichier de `src/scripts/` et si son empreinte figure dans la CSP de la page ; un `<style>` en ligne seulement si son empreinte figure dans la CSP. Toujours refusés : attributs `on*=`, attributs `style=`, scripts `data:`, tout `unsafe-inline` dans `script-src`. Les cas `ordre.cas.ts` et `niveaux.cas.ts` (identité octet pour octet du script) sont réécrits pour la forme en ligne. Nouvel ADR qui remplace l'ADR-037 ; note ajoutée à l'ADR-051 (dépôt public depuis le 2026-11-04 : brouillons et artefact `site-preview` lisibles par tous, la build preview n'est jamais déployée).
- **D-09:** Le budget de poids reste dur (500 Ko bruts, 100 Ko gzip par page) : mesurer la page la plus lourde (`/themes/sante/`) après inlining. Test e2e « zéro violation CSP » (écoute des `securitypolicyviolation` et de la console) sur toutes les pages, avec et sans JS.
- **D-10:** La mesure Slow 4G réelle et le libellé public « Slow 4G simulé » sont en Phase 8 (PERF-02) ; ici, relancer `e2e/4g.spec.ts` et consigner les chiffres des deux profils après inlining, sans changer les budgets publiés.

**Dette (DETTE-01, 02, 03, 05)**
- **D-11:** DETTE-01 (W3) : en preview, la phrase de couverture ne dit pas « position publiée » pour des brouillons (ex. « 27 candidats sur 37 ont une position rédigée, en attente de relecture »). La production garde sa phrase.
- **D-12:** DETTE-02 (W4) : un test Playwright suit le parcours par clics (accueil, thème, choix de niveau, page candidat, retour) et vérifie que le niveau est gardé d'une page à l'autre et après un retour arrière (bfcache, `pageshow`). Il tourne sur la build inlinée.
- **D-13:** DETTE-03 (W10) : dans `EtatVide.astro`, chaque source consultée affiche un lien vers le document, sa date de consultation et le lien vers l'extrait archivé, comme le bloc source d'une mesure.
- **D-14:** DETTE-05 (W7) : un test compare `src/lib/corpus/types.ts` aux schémas JSON (`schemas/`) : chaque propriété requise d'un schéma existe dans le type et inversement pour les champs lus par les pages. Pas de génération de types (hors périmètre).

### Claude's Discretion
- Nom et emplacement exacts du script de rendu Caddy et du test de dérive ; contenu du bloc Caddy (en-têtes, cache, journal à 14 jours avec IP masquée /24 et /48, sans User-Agent ni Referer) tant qu'il découle de la configuration ; le bloc réel sera appliqué en Phase 8.
- Découpage en plans et vagues, ordre interne (le spike CSP passe en premier).

### Deferred Ideas (OUT OF SCOPE)
Aucune section « Deferred Ideas » dans CONTEXT.md. Hors périmètre rappelé par le contexte : aucun serveur, aucun déploiement, aucun secret ; la mesure Slow 4G réelle et le libellé public sont en Phase 8 (PERF-02) ; pas de génération de types.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEB-05 | Domaine déclaré une seule fois, alimente `site`, canonique, `sitemap.xml`, `robots.txt`, bloc Caddy ; test anti nom d'hôte en dur | Section « HEB-05 » : `loadSiteConfig` importé depuis `astro.config.mjs` (vérifié), canonique, sitemap par route dynamique conditionnelle (vérifié), rendu Caddy pur + test de dérive, test de garde |
| HEB-06 | Domaine `.invalid` fait échouer la build sous `RTP_DEPLOIEMENT=1` | Vérifié : `astro build` sort en code 1 avec « Unable to load your Astro config / config/site.yml : domaine provisoire (.invalid) refusé… » ; code check-dist `DOMAINE_PROVISOIRE` |
| PERF-01 | CSS et scripts dans la page, CSP à empreintes sans `unsafe-inline` sur les scripts, check-dist vérifie l'identité et l'empreinte | Spike CSP : configuration exacte qui marche, résultats mesurés, règles check-dist à écrire, tests impactés listés |
| DETTE-01 | Phrase de couverture honnête en preview (W3) | `phraseCouverture` et `CompteCouverture` dans `src/lib/corpus/vue.ts` ; nouveau compte « rédigées, en attente » |
| DETTE-02 | Parcours par clics avec retour arrière et bfcache (W4) | Test spike : bfcache réellement exercé, sensible à la suppression du gestionnaire `pageshow` ; exige `channel: 'chromium'` |
| DETTE-03 | « Sources consultées » avec lien, date, extrait archivé (W10) | Réutiliser le bloc source de `Mesure.astro` (composant partagé) |
| DETTE-05 | Test types de vue / schémas JSON (W7) | Prototype avec l'API `typescript` (déjà devDependency) : 0 dérive aujourd'hui, 13 interfaces comparables |
</phase_requirements>

## Summary

**Le spike CSP réussit : l'option A (CSP par `<meta>` via `security.csp` d'Astro, plus `scriptDirective.hashes` calculés par `node:crypto`) fonctionne de bout en bout, sans repli B.** Sur le vrai corpus (preview, 68 pages) et en production (65 pages), chaque page contient un unique `<meta http-equiv="content-security-policy">`, un `<style>` et les scripts nécessaires ; les deux scripts restent classiques, sans attribut, bloquants, à leur place (ordre dans `<head>`, niveau juste après `</fieldset>`) ; leur texte est identique octet pour octet aux fichiers `src/scripts/*.js` (vérifié par `cmp`) malgré `compressHTML: true` ; Astro ne hache PAS les scripts `is:inline` (ses 5 hachages « supplémentaires » sont ses scripts de directives d'îlots), donc `scriptDirective.hashes` est indispensable. Chromium rapporte zéro violation (événements `securitypolicyviolation` et console), avec et sans JS, sur toutes les pages ; trois fautes injectées (script de niveau modifié d'un espace, `<style>` modifié, hachage retiré) sont détectées, ce qui prouve que le test mord.

**Trois pièges découverts par le spike que le plan doit absorber.** (1) Astro place le `<meta>` CSP en fin de `<head>`, donc APRÈS le script d'ordre : sur 68 pages sur 68, le premier `<script>` précède le meta, et un script d'ordre modifié n'est PAS bloqué (vérifié). Le meta ne protège réellement que le script de niveau (corps) et les styles ; la protection du script d'ordre doit venir de l'en-tête CSP Caddy (rendu dans le bloc généré avec les mêmes empreintes). (2) `page.addStyleTag` de `e2e/texte.spec.ts` est bloqué par la CSP : sans `bypassCSP: true` dans `playwright.config.ts`, 393 des 461 tests de texte échouent ; le test CSP doit, lui, remettre `bypassCSP: false`. (3) Le Chromium headless shell par défaut de Playwright ne sait pas faire de bfcache (`BackForwardCacheDisabledForDelegate`) : le test de retour arrière doit utiliser `channel: 'chromium'` et `ignoreDefaultArgs: ['--disable-back-forward-cache']`, et `goBack({ waitUntil: 'commit' })`.

Résultats de poids et de vitesse (D-09, D-10) : `/themes/sante/` en preview passe de 173 756 o bruts et 29 882 o gzip (HTML plus CSS externe) à 174 202 o bruts et 28 969 o gzip (tout dans le HTML) ; marge de budget 65 % (bruts) et 71 % (gzip). Serveur de test gzip, trois mesures chacune : profil « latence 150 ms » 426/414/429 ms avant, 309/298/301 ms après ; profil « Slow 4G Lighthouse » 1257/1259/1257 ms avant (budget 1500), 728/729/728 ms après (sous 1 s).

**Primary recommendation :** appliquer exactement la configuration de la section « Spike CSP » (`inlineStylesheets: 'always'`, `assetsInlineLimit: 0`, `security.csp` avec `directives` et `scriptDirective.hashes`, `?raw` plus `set:html`), centraliser le calcul d'empreinte dans un module `.ts` unique partagé par `astro.config.mjs`, check-dist et le rendu Caddy, ajouter `bypassCSP: true` à la config Playwright, et rendre dans le bloc Caddy un en-tête CSP qui porte `script-src` avec les deux empreintes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domaine unique (`config/site.yml`) | Build (config + lecteur strict) | — | Source de vérité unique lue par `astro.config.mjs`, endpoints, script Caddy, check-dist ; aucun runtime |
| URL canonique, sitemap, robots | CDN / Static (HTML et fichiers générés à la build) | Build | Générés par `Base.astro` et des endpoints statiques ; la production seule les émet |
| CSP des pages (styles, scripts) | CDN / Static (`<meta>` dans le HTML) | Serveur Caddy (en-tête, Phase 8) | Le meta porte les hachages par page ; l'en-tête couvre ce que le meta ne peut pas (frame-ancestors, script avant le meta) |
| Bloc Caddy généré | Build (script de rendu) | Serveur (appliqué en Phase 8) | Sortie d'un rendu testé ; aucun serveur touché dans cette phase |
| Mémoire du niveau et retour arrière | Browser / Client (localStorage, `pageshow`) | — | Amélioration progressive ; le site reste complet sans JS |
| Phrase de couverture preview, Sources consultées | Build (vue `vue.ts`, composants Astro) | — | Rendu statique ; aucune logique client |
| Contrôle des gardes (check-dist, tests) | CI / outillage | — | Lit `dist/`, ne sert rien |

## Standard Stack

Aucune nouvelle dépendance npm. Tout ce qui est nécessaire est déjà dans le dépôt. [VERIFIED: `package.json`, spike]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | 7.4.5 (installé) | `security.csp`, `build.inlineStylesheets`, endpoints statiques | Imposé par la spec ; CSP par meta disponible depuis 6.0.0, `kind` par hachage depuis 7.1 [VERIFIED: `node_modules/astro/dist/types/public/config.d.ts`] |
| node:crypto | Node 24.22.2 | SHA-256 base64 des scripts sources | Stdlib ; mêmes octets que ceux émis |
| yaml | ^2.9.1 (déjà là) | Lecture de `config/site.yml` via `loadSiteConfig` | Déjà utilisée par le lecteur strict |
| @playwright/test | ^1.64.1 (déjà là) | Tests CSP et parcours | `channel: 'chromium'` = nouveau headless, requis pour bfcache [VERIFIED: playwright-core 1.64.1 source] |
| typescript | ^6.0.3 (devDependency déjà là) | API `ts.createSourceFile` pour le test W7 | Évite un analyseur maison ; aucun ajout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @axe-core/playwright | ^4.14.0 (déjà là) | Audit AA existant | Continue de passer sous `bypassCSP: true` (1031 tests e2e verts dans le spike) |
| `vite` `?raw` | intégré à Astro 7 | Importer le texte exact des scripts | `astro check` accepte `../scripts/ordre.js?raw` (0 erreur) [VERIFIED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `scriptDirective.hashes` (config, D-07) | `Astro.csp.insertScriptHash(empreinte(sourceRaw))` dans `Base.astro` et `LecteurNiveaux.astro` | Vérifié aussi : CSP par page exacte (le hachage du niveau n'est pas listé sur les 5 pages sans sélecteur) et zéro dérive en `astro dev` ; mais D-07 verrouille la forme config. À garder en réserve si l'on veut le moindre privilège par page. |
| Ajouter `@astrojs/sitemap` | endpoint maison | Interdit par D-03 (dépendance non justifiée) |
| Ajouter une dépendance de test CSP | `securitypolicyviolation` + console Playwright | Suffisant et vérifié |

**Installation :** aucune. `npm ci` seulement dans la copie de spike (j'ai utilisé un lien symbolique vers `node_modules` du dépôt).

**Version verification :** `astro` 7.4.5, `@playwright/test` 1.64.1 (Chromium 156.0.8078.4 dans le cache local), Node 24.22.2 via `fnm exec --using=24`, npm 11.19.1 [VERIFIED: exécution locale 2026-11-07].

## Package Legitimacy Audit

Aucun paquet externe n'est installé par cette phase. `slopcheck` n'a pas été nécessaire.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (aucun nouveau paquet) | — | — | — | — | n/a | Approved (existants uniquement) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Spike CSP : résultats et configuration exacte

Copie : `git archive HEAD | tar -x -C /tmp/rtp-spike7`, `node_modules` du dépôt en lien symbolique. Tout ce qui suit est [VERIFIED: spike local 2026-11-07].

### Configuration qui marche

`astro.config.mjs` (version complète du spike, domaine compris) :

```js
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { empreinteCsp } from './src/lib/empreintes.ts';      // helper partagé (voir plus bas)
import { loadSiteConfig } from './src/lib/site-config.ts';   // un .ts est importable depuis le .mjs (vérifié)

const { domaine } = loadSiteConfig(new URL('.', import.meta.url).pathname);
const empreinte = (fichier) => empreinteCsp(readFileSync(new URL(fichier, import.meta.url)));

export default defineConfig({
  site: `https://${domaine}`,
  output: 'static',
  compressHTML: true,
  prefetch: false,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 0 } },
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  devToolbar: { enabled: false },
  security: {
    csp: {
      directives: ["default-src 'none'", "img-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"],
      scriptDirective: {
        hashes: [empreinte('./src/scripts/niveau.js'), empreinte('./src/scripts/ordre.js')],
      },
    },
  },
});
```

`src/lib/empreintes.ts` (à placer sous un nom stable, p. ex. `src/lib/csp-empreintes.ts`) :

```ts
import { createHash } from 'node:crypto';
/** Empreinte CSP « sha256-… » du texte exact d'un script ou d'une feuille (UTF-8). */
export function empreinteCsp(texte: string | Uint8Array): string {
  return `sha256-${createHash('sha256').update(texte).digest('base64')}`;
}
```

`Base.astro` (import et balise, à la place de `?url` et `src={ordreUrl}`) :

```astro
import ordreSource from '../scripts/ordre.js?raw';
...
<script is:inline set:html={ordreSource}></script>
```

`LecteurNiveaux.astro` : `import niveauSource from '../scripts/niveau.js?raw';` puis `<script is:inline set:html={niveauSource}></script>` juste après `</fieldset>` (position inchangée). Aucune espace ni retour ligne ajouté autour de `set:html`.

### Ce qu'Astro 7.4.5 émet (observé)

- Un seul `<meta http-equiv="content-security-policy" content="…">` par page, sans guillemets dans le contenu (échappement HTML inutile). Exemple `/themes/sante/` avec la configuration ci-dessus : `default-src 'none';img-src 'self';base-uri 'none';form-action 'none';object-src 'none'; script-src 'self' 'sha256-<niveau>' 'sha256-<ordre>' <5 hachages Astro>; style-src 'self' 'sha256-…' ×4;`
- **Astro ne hache pas les `<script is:inline>`** : les 5 hachages en plus des miens sont ceux des scripts de directives d'îlots (`settings.clientDirectives`), toujours ajoutés [VERIFIED: `astro/dist/core/csp/common.js` `trackScriptHashes`]. Inoffensifs (le site n'a aucun îlot) mais impossibles à retirer ; check-dist ne doit donc pas exiger que la liste de la CSP soit égale à l'ensemble des scripts de la page, seulement qu'elle l'inclue.
- `scriptDirective.hashes` s'applique à **toutes les pages** : le hachage de niveau figure donc aussi sur les 5 pages qui n'ont pas de sélecteur (`/themes/`, `/candidats/`, Méthode, Mentions légales, Qui sommes-nous), sans effet (inoffensif : un hachage n'autorise que ce texte exact). Les `<style>` : 4 variantes de liste de hachages de styles (60 + 1 + 4 + 3 pages), chaque page contient bien son propre hachage plus ceux de pages voisines.
- Le `<style>` unique de chaque page est émis après le meta ; le `<script>` d'ordre est émis AVANT le meta (position 297 contre 2034 dans le `<head>` de `/themes/sante/`).
- L'attribut `is:inline` disparaît du HTML : `<script>` nu. Aucun attribut `type`, `async`, `defer`.
- `compressHTML: true` ne modifie ni le texte du script (octets identiques aux fichiers, accents compris, `cmp` OK) ni celui des styles (le hachage Astro correspond au contenu réel sur les 133 pages construites). Contrôle exhaustif : 68 pages preview + 65 pages production, 0 problème (meta unique, aucun `unsafe-inline`/`unsafe-eval`/`data:`/hôte, chaque corps de script ∈ {niveau, ordre} et son hachage ∈ CSP, chaque `<style>` haché ∈ CSP, aucun `style=` ni `on*=`). `dist/_astro/` n'existe plus.
- `build.inlineStylesheets: 'always'` inline bien le CSS avec `assetsInlineLimit: 0` (aucun `data:`).

### Chromium (Playwright 1.64.1, Chromium 156)

- Spec de spike : pour chaque page de `PAGES`, écoute de `securitypolicyviolation` (via `addInitScript`) et de `console` (error et warning), `pageerror` ; avec JS, vérifie aussi que `data-ordre-js` (et `data-js-niveau` sur les pages à sélecteur) est posé, donc que les scripts ont réellement tourné. Résultat : 68 pages, 0 violation, avec JS et sans JS.
- Contrôles négatifs sur une copie de dist : script de niveau modifié d'un espace : `script-src-elem` signalé et script non exécuté (`data-js-niveau` absent) ; `<style>` modifié : `style-src-elem` signalé, même sans JS (message console « Applying inline style violates… ») ; script d'ordre modifié : **aucune violation, le script tourne** (placé avant le meta).
- `directives` ci-dessus (dont `default-src 'none'`) sont acceptées par Astro, 0 violation sur 68 pages. Un `default-src` dans un meta est sûr ici parce que `script-src` et `style-src` sont définis dans la même politique ; l'avertissement de STACK.md ne concerne que l'en-tête Caddy (voir plus bas).

### Variante runtime (vérifiée, non retenue par défaut)

`Astro.csp?.insertScriptHash(empreinteCsp(ordreSource))` dans `Base.astro` et `Astro.csp?.insertScriptHash(empreinteCsp(niveauSource))` dans `LecteurNiveaux.astro`, avec `scriptDirective` retiré de la config : build OK, listes par page exactes (les 5 pages sans sélecteur ne listent que l'ordre). Le hachage vient de la chaîne `?raw` réellement émise. À mentionner dans l'ADR comme alternative si l'on veut le moindre privilège par page.

### Option B : non nécessaire

Aucun repli requis. Si un jour A casse (changement de comportement d'Astro), le repli reste : en-tête Caddy global `script-src 'sha256-niveau' 'sha256-ordre'` plus `style-src 'unsafe-inline'`, à documenter dans l'ADR comme décrit par D-07.

## Architecture Patterns

### System Architecture Diagram

```
config/site.yml (domaine, contact, depot)
      |
      v
src/lib/site-config.ts (loadSiteConfig, strict, garde RTP_DEPLOIEMENT)
      |
      +--> astro.config.mjs : site, security.csp.scriptDirective.hashes
      |        ^                     ^
      |        |                     +-- src/lib/csp-empreintes.ts (node:crypto) <-- src/scripts/{niveau,ordre}.js (fichiers lus)
      |        |
      |        +-- build.inlineStylesheets 'always' --> <style> dans chaque page
      |
      +--> Base.astro : <link rel=canonical> (production), ordre.js?raw inline
      +--> src/pages/[fichier].xml.ts : sitemap.xml (production seulement)
      +--> src/pages/robots.txt.ts : Sitemap: (production seulement)
      +--> scripts/render-caddy.ts --> deploy/caddy/site.caddy (tests/repo/caddy.test.ts : dérive)
                                          ^
                                          +-- mêmes empreintes de scripts (en-tête CSP)

astro build --> dist/*.html (meta CSP + <style> + 2 scripts inline)
      |
      v
scripts/check-dist.ts : script inline == src/scripts/*, hachage ∈ CSP, <style> ∈ CSP, pas d'unsafe-inline,
                        canonique == https://domaine + chemin, sitemap == pages, DOMAINE_PROVISOIRE
      |
      v
e2e (Playwright) : csp.spec (0 violation, avec/sans JS), parcours.spec (bfcache), 4g.spec (chiffres consignés)
```

### Recommended Project Structure

```
src/lib/csp-empreintes.ts      # empreinteCsp(texte) ; liste SCRIPTS_EN_LIGNE (noms) et lecture des sources
src/lib/site-config.ts         # + domaine, domaineProvisoire
src/pages/[fichier].xml.ts     # sitemap (production), getStaticPaths conditionnel
src/pages/robots.txt.ts        # + Sitemap: en production
src/components/SourceConsultee.astro (ou BlocSource.astro)  # bloc source partagé Mesure / EtatVide
scripts/render-caddy.ts        # rendu pur renderCaddy(cfg) + CLI (--check)
deploy/caddy/site.caddy        # généré, committé
tests/repo/caddy.test.ts       # dérive
tests/repo/hote-en-dur.test.ts # garde D-04
tests/corpus/types-schemas.test.ts  # W7
tests/dist/cas/csp.cas.ts, domaine.cas.ts  # nouveaux modules de cas (pas de modification de site.test.ts)
e2e/csp.spec.ts, e2e/csp-sans-js.spec.ts, e2e/parcours.spec.ts
```

### Pattern 1 : empreinte de script unique

**What:** un module `.ts` sans dépendance expose `empreinteCsp()` ; `astro.config.mjs`, `render-caddy.ts`, `scripts/lib/check-dist.ts` et les tests l'importent. **When:** toujours. **Example :** voir plus haut ; `import` d'un `.ts` depuis `astro.config.mjs` est vérifié (Astro charge la config via Vite, Node 24 gère aussi le type stripping pour `tests/repo/astro-config.test.ts` qui importe la config sous `node:test`).

### Pattern 2 : règles check-dist à empreintes (remplacent `SCRIPT_EN_LIGNE` / `STYLE_EN_LIGNE`)

Pour chaque page :
1. Exactement un meta CSP (`http-equiv` insensible à la casse). Sinon `CSP_ABSENTE`.
2. Jetons interdits dans `script-src`, `script-src-elem`, `script-src-attr`, `style-src`, `style-src-elem`, `style-src-attr`, `default-src` : `'unsafe-inline'`, `'unsafe-eval'`, `'unsafe-hashes'`, `*`, `data:`, `blob:`, `http:`, `https:` (tout hôte). Code `CSP_TROP_PERMISSIVE`.
3. Chaque `<script>` sans `src` : son corps (texte exact, sans `trim`, c'est ce que le navigateur hache) doit être égal au contenu d'un fichier de `src/scripts/` (au sens UTF-8) ; sinon `SCRIPT_EN_LIGNE` (message : script en ligne différent des sources). Son hachage `sha256-…` base64 doit figurer dans la CSP (`script-src` ou `script-src-elem`) ; sinon `SCRIPT_SANS_EMPREINTE`. Taille ≤ `LIMITES.script` (2048 octets UTF-8) sinon `SCRIPT_TROP_LOURD` (le contrôle actuel ne regarde que les `.js` du dist, donc ne verrait plus rien).
4. Chaque `<style>` : hachage du texte exact ∈ CSP (`style-src` ou `style-src-elem`) ; sinon `STYLE_SANS_EMPREINTE`. Garder `STYLE_EN_LIGNE` pour l'attribut `style=`.
5. Garder `SCRIPT_EN_LIGNE` pour les attributs `on*=`, `SCRIPT_DATA_URI`, `SCRIPT_NON_BLOQUANT` (à appliquer aussi aux scripts en ligne : `type="module"`, `async`, `defer`, et tout `type` autre que classique).
6. **Régression de couverture à éviter :** les règles `RESSOURCE_TIERCE` sur `@import`/`url()` ne lisent que les fichiers `.css` du dist ; il faut aussi les appliquer au texte de chaque `<style>` en ligne, sinon un `@import url(https://…)` ou un `url(data:…)` passerait sans contrôle.
7. Ne PAS exiger que le meta précède les scripts (faux pour l'ordre, voir pièges). Ne PAS exiger l'égalité entre la liste CSP et les scripts de la page (les 5 hachages Astro).

Les codes sont à ajouter à `CODES_CHECK_DIST` (le test `tests/scripts/check-dist.test.ts` vérifie que tout code émis y figure et l'absence de doublon) et au tableau de `docs/RUNBOOK.md`.

### Pattern 3 : rendu Caddy pur et test de dérive

`scripts/render-caddy.ts` exporte `renderCaddy({ domaine, empreintesScripts, racine }): string` (fonction pure, sans lecture du système) et un CLI `node scripts/render-caddy.ts [--check]` qui écrit/vérifie `deploy/caddy/site.caddy`. Le test `tests/repo/caddy.test.ts` : (a) `renderCaddy(loadSiteConfig(REPO)…) === readFileSync('deploy/caddy/site.caddy')` (dérive) ; (b) avec un domaine synthétique `exemple.test`, le bloc contient ce domaine et pas `domaine-a-definir` (le changement de domaine se propage) ; (c) les empreintes du bloc sont celles des fichiers `src/scripts/*.js` ; (d) le bloc ne contient ni `default-src` ni `unsafe-inline` dans l'en-tête CSP, ni `User-Agent`/`Referer` en clair dans le journal. Un ajout de script npm (`render:caddy`) casserait `tests/repo/scaffold.test.ts` (`deepEqual` exact sur `pkg.scripts`) : soit ne pas ajouter de script npm, soit mettre ce test à jour dans le même plan.

Bloc proposé (MEDIUM : syntaxe `ip_mask`, `roll_*`, `wrap json` conforme à la documentation Caddy [CITED: caddyserver.com/docs/caddyfile/directives/log] ; `request>headers delete` et `request>tls delete` non documentés tels quels, et `caddy validate` n'a pas pu tourner car Docker est éteint ; à valider en Phase 8) :

```caddyfile
# Généré par scripts/render-caddy.ts depuis config/site.yml : ne pas modifier à la main.
{domaine} {
	root * /srv/reveletonprog/current
	encode zstd gzip
	file_server

	header {
		-Server
		Strict-Transport-Security "max-age=300"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
		Cross-Origin-Opener-Policy "same-origin"
		# Pas de default-src ici. Le meta de chaque page porte style-src (hachages par page) ; l'en-tête ajoute
		# ce que le meta ne sait pas dire (frame-ancestors) et couvre le script d'ordre, placé AVANT le meta.
		Content-Security-Policy "script-src 'sha256-{niveau}' 'sha256-{ordre}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
	}
	@html not path /_astro/*
	header @html Cache-Control "no-cache"

	log {
		output file /var/log/caddy/reveletonprog.log {
			roll_size 10MiB
			roll_keep 14
			roll_keep_for 336h
		}
		format filter {
			request>remote_ip ip_mask 24 48
			request>client_ip ip_mask 24 48
			request>headers delete
			request>tls delete
			wrap json
		}
	}
}

www.{domaine} {
	redir https://{domaine}{uri} permanent
}
```

Deux politiques (en-tête et meta) se cumulent par intersection : un script doit être admis par les deux ; ici l'en-tête n'admet que les deux empreintes, ce qui est cohérent avec le meta. Le chemin `/srv/reveletonprog/current` et le cache des fichiers hachés `/_astro/*` sont des paramètres que la Phase 8 tranchera (après inlining il n'y a plus de `/_astro/` : le matcher `@html not path /_astro/*` devient inutile ; garder simplement `Cache-Control "no-cache"` global ou le laisser rendu par constante).

### Anti-Patterns à éviter

- **`default-src` dans l'en-tête Caddy** : l'intersection ferait retomber `style-src` sur `default-src` et bloquerait les `<style>` hachés par le meta. Un `default-src 'none'` est en revanche sûr dans le meta (même politique que `style-src`).
- **Supprimer `assetsInlineLimit: 0`** : les scripts `?url` deviendraient des `data:`. Plus de `?url` après cette phase, mais le plafond protège aussi d'éventuelles images ou polices.
- **Relire le script depuis `dist/_astro/`** dans les tests : ce répertoire n'existe plus.
- **Faire dépendre le hachage de `trim()`** : le navigateur hache le texte exact.
- **Exiger `unsafe-inline` ou le tolérer sur les styles** : inutile, tous les styles passent par hachage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hachage CSP des styles | Un post-traitement qui hache les `<style>` | `security.csp` d'Astro | Calculé sur le contenu réel après minification, vérifié sur 133 pages |
| Listes de hachages de scripts | Une liste de hachages copiée à la main | `empreinteCsp(readFileSync(src/scripts/x.js))` | Une seule source ; impossible à désynchroniser |
| Sitemap | `@astrojs/sitemap` | Endpoint statique de 10 lignes | D-03 : pas de dépendance |
| Analyse TypeScript du test W7 | Regex sur `types.ts` | `ts.createSourceFile` de `typescript` (déjà devDependency) | Fiable pour `?` et unions ; prototype OK |
| Détection des violations CSP | Parser la console à la main | Événement `securitypolicyviolation` plus `page.on('console')` | Les deux canaux ont été éprouvés par fautes injectées |
| Journal Caddy anonymisé | Filtre maison | `format filter` avec `ip_mask` | Documenté par Caddy |

**Key insight :** tout ce que la phase demande existe déjà dans Astro, Node ou Playwright ; le risque est dans la couture (ordre du meta, `bypassCSP`, bfcache), pas dans l'outillage.

## HEB-05 / HEB-06 : domaine paramétré

### Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `config/site.yml` | `domaine: domaine-a-definir.invalid` + commentaire (apex sans `www`, minuscules, sans schéma ni chemin) |
| `src/lib/site-config.ts` | `CLES` + `'domaine'` ; interface `SiteConfig` + `domaine`, `domaineProvisoire` ; validation nom d'hôte (lettres minuscules, chiffres, tirets, au moins un point, TLD alphabétique ; refuser majuscules, schéma, port, chemin, `www.`) ; sous `RTP_DEPLOIEMENT=1` jeter `config/site.yml : domaine provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer` ; avertissement console unique comme le contact |
| `astro.config.mjs` | `site: \`https://${domaine}\`` (voir config plus haut) |
| `src/layouts/Base.astro` | `{corpus.mode !== 'preview' && Astro.site && <link rel="canonical" href={new URL(Astro.url.pathname, Astro.site).href} />}` (vérifié : `https://domaine-a-definir.invalid/themes/` etc.) |
| `src/pages/[fichier].xml.ts` (nouveau) | route dynamique `[fichier].xml` dont `getStaticPaths` renvoie `[{ params: { fichier: 'sitemap' } }]` en production et `[]` en preview : vérifié, `sitemap.xml` n'est écrit qu'en production (65 `<url>` pour 65 pages). Liste : `/`, `/themes/`, un chemin par thème visible, `/candidats/`, un par candidat, `/methode/`, `/mentions-legales/`, `/qui-sommes-nous/` ; `new URL(chemin, site).href` |
| `src/pages/robots.txt.ts` | production : `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', site)}\n` ; preview inchangé (`Disallow: /`, pas de `Sitemap:`) |
| `scripts/lib/check-dist.ts` + `scripts/check-dist.ts` | option `domaine` (passée par le CLI via `loadSiteConfig`) ; en production : canonique de chaque page == `https://<domaine>` + chemin de la page (`CANONIQUE_INCORRECT`/`CANONIQUE_ABSENT`), `sitemap.xml` : ensemble des `<loc>` == ensemble des canoniques (`SITEMAP_INCOHERENT`), `robots.txt` contient `Sitemap: https://<domaine>/sitemap.xml` (`ROBOTS_SANS_SITEMAP`) ; en preview : aucun canonique, aucune ligne `Sitemap:` ; `DOMAINE_PROVISOIRE` (erreur sous `deploiement`, avertissement sinon) détecté sur le domaine des canoniques ou de la config en `.invalid`, miroir de `CONTACT_PROVISOIRE` |
| `deploy/caddy/site.caddy`, `scripts/render-caddy.ts` | voir Pattern 3 |
| `tests/corpus/site-config.test.ts` | **tous** les `projet('contact: …\ndepot: …')` doivent recevoir `domaine:` ; le `deepEqual` sur la config doit inclure `domaine` et `domaineProvisoire` ; ajouter les cas : domaine invalide (majuscules, schéma, port, `www.`), `RTP_DEPLOIEMENT=1` refuse le domaine `.invalid` même avec un contact réel |
| `tests/repo/astro-config.test.ts` | ajouter `site`, `build.inlineStylesheets === 'always'`, `security.csp` présent, `scriptDirective.hashes` égal aux deux empreintes des fichiers, `assetsInlineLimit === 0` |
| `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md` | ADR-053 (domaine unique), table des codes, procédure « changer de domaine » (modifier `site.yml`, `node scripts/render-caddy.ts`, réappliquer le bloc en Phase 8) |

### Test anti nom d'hôte en dur (D-04)

`tests/repo/hote-en-dur.test.ts` : fonction pure `trouverHotesEnDur(fichiers: {chemin, contenu}[], domaine: string)` testée par injection de fautes (un fichier fictif contenant `https://${domaine}/x`, `www.${domaine}`, ou `@${domaine}` doit être signalé), puis exécutée sur le dépôt réel (`git ls-files`, repli sur un parcours du système de fichiers si `.git` est absent). Les hôtes de sources (web.archive.org, data.gouv.fr, github.com et la centaine d'URL de sites de candidats présentes dans `scripts/` et `src/content/`) ne sont PAS une liste blanche praticable : le test compare au seul `domaine` de `config/site.yml` (et `www.` + domaine) et refuse en plus la chaîne `domaine-a-definir` partout. Exclusions explicites : `config/site.yml`, `deploy/caddy/site.caddy` (généré, couvert par le test de dérive), `.planning/`, `docs/` (récits d'audit qui citent le provisoire), `archives/`, `tests/fixtures/`. Les occurrences actuelles à corriger : `tests/corpus/site-config.test.ts` (fixtures, remplacer par `exemple.invalid` ou lire la config), `tests/dist/cas/source.cas.ts:69` et `tests/scripts/check-dist.test.ts:242,464,488` (utiliser `loadSiteConfig(REPO).contact`).

### Pièges propres au domaine

- `loadSiteConfig` mémorise par racine ; la garde `RTP_DEPLOIEMENT` n'est évaluée qu'au premier chargement du processus. C'est suffisant (la config Astro charge une fois), mais `tests/dist/site.test.ts` lance `astro build` avec `env: {...process.env}` : un `RTP_DEPLOIEMENT=1` exporté dans le shell du développeur fera échouer tous les builds de test. Supprimer `RTP_DEPLOIEMENT` de l'environnement dans `contexte.construire`, comme c'est déjà fait pour `RTP_MODE`.
- Le message d'échec est celui d'Astro (« Unable to load your Astro config ») suivi du message de `site-config.ts` : clair, mais il inclut une trace ; c'est acceptable. Le code de sortie est 1 (vérifié).
- `Astro.site` vaut toujours `https://<domaine>` y compris en preview ; c'est pourquoi la canonique est conditionnée au mode (la build preview ne doit pas revendiquer le domaine).

## DETTE-01 (W3), DETTE-03 (W10), DETTE-05 (W7)

### W3 : phrase de couverture en preview

Fichiers : `src/lib/corpus/vue.ts` (`CompteCouverture`, `phraseCouverture`, construction du `compte` ligne ~318), `tests/corpus/vue.test.ts` (lignes 215-245), éventuellement un nouveau module de cas `tests/dist/cas/couverture-preview.cas.ts` (ne pas toucher `theme.cas.ts:109`, cas production). Cause : `mesures` compte les cellules à l'état `mesures`, qui en preview incluent des brouillons. Approche : ajouter `enAttente` (cellules `mesures` dont aucune mesure n'a `statut_relecture === 'publie'`) et réduire `mesures` aux cellules avec au moins une mesure publiée. Phrase : première clause « N candidat(s) sur T a/ont une position publiée » conservée telle quelle en production (où `enAttente` vaut toujours 0 : tests existants inchangés) ; en preview, clause « N candidat(s) a/ont une position rédigée, en attente de relecture » ajoutée ; si `mesures === 0` et `enAttente > 0`, supprimer la clause « publiée » pour éviter « 0 candidat sur 37 a une position publiée, 27 ont… » (décision de rédaction au planificateur, pluriels via le `pluriel()` existant). Piège : `nonVerifie` reste calculé sur l'état ; pas de double comptage. Mots interdits et accents/typographie du site (pas de tiret long).

### W10 : Sources consultées de `EtatVide.astro`

`EtatVide.astro` reçoit déjà `cellule.sourcesConsultees: Source[]` (objets complets : `titre`, `url`, `date_consultation`, `archive.{extrait, sha256, wayback_url}`) mais n'affiche que les titres. Plan : extraire de `Mesure.astro` le bloc « lien au document, consultée le, copie Wayback, extrait archivé avec lien `lienExtrait`» dans un composant partagé (p. ex. `BlocSource.astro`) utilisé par `Mesure.astro` (comportement et classes `.source` inchangés) et par `EtatVide.astro` (variante `.sources-consultees`, une `<ul>` d'éléments). Pièges :
- Ne pas appliquer la classe `.source` aux sources consultées : check-dist `MESURE_SANS_SOURCE_DATEE` ne regarde que `.mesure .source`, mais l'exemption des mots interdits pour `span[data-citation]` s'applique aux `.source` ; décider si le titre est exempté (un titre de document est une citation) et garder `data-citation` cohérent avec `dansSource`.
- Règle `ESPACE_PERDU` : du texte collé avant ou après un `<a>` fait échouer check-dist ; mettre des espaces ou des éléments blocs.
- Tous les liens externes ont `rel="noopener noreferrer"` ; les dates en `<time datetime="AAAA-MM-JJ">` + `formatDate`.
- `tests/dist/cas/theme.cas.ts:99` attend la phrase exacte « Sources consultées : Programme commun fictif d'Élise Érard et Jean Imaginaire. » : à réécrire pour la nouvelle structure ; `lienExtrait` suppose `resolveContentRoot(process.cwd(), process.env)`.
- Axe (contraste, noms de liens distincts) et reflow 320 px (`e2e/texte.spec.ts`) : des URL longues ne doivent pas déborder (le texte du lien est un libellé, pas l'URL).
- UI hint = yes : un `UI-SPEC` court (libellés exacts des trois liens) est utile.

### W7 : types de vue contre schémas

Nouveau fichier `tests/corpus/types-schemas.test.ts`, pas de code de production. Prototype exécuté : l'API `typescript` (`createSourceFile`, `InterfaceDeclaration`, `PropertySignature.questionToken`, `TypeAliasDeclaration` d'unions de littéraux) permet de comparer les 13 interfaces de `src/lib/corpus/types.ts` aux schémas : `Candidat`, `Theme`, `Source`, `Mesure`, `Couverture`, `EntreeGlossaire` (fichiers de premier niveau) et `StatutEntree`, `SousTheme`, `Redactions`, `Chiffrage`, `CaseCouverture` (sous-objets inline), `Archive`, `SourceStatut` (`schemas/defs/common.schema.json#/$defs`). Règles : (1) tout `required` du schéma existe dans le type et n'y est pas optionnel ; (2) toute propriété du type existe dans `properties` du schéma (y compris celles déclarées seulement dans `then`/`else`/`allOf`, comme `motif`) ; (3) toute propriété du schéma existe dans le type (le prototype confirme zéro différence aujourd'hui, donc l'égalité bidirectionnelle est tenable sans liste d'exceptions) ; (4) les unions de littéraux (`StatutRelecture`, `CodeStatut`, `MotifRenoncement`, `TypeSource`, `TypeSourcePrimaire`, `AuteurSource`, `EtatCouverture`) égalent les `enum` des schémas. Preuve de morsure : la fonction de comparaison prend le texte de `types.ts` en paramètre ; le test l'alimente avec des textes fautifs (propriété ajoutée, `?` retiré, valeur d'union manquante) et attend des écarts, puis l'exécute sur le vrai fichier. Les types de `vue.ts` (VueMesure etc.) sont dérivés et hors comparaison ; le point de dérive réel est le `as unknown as` de `src/lib/corpus/index.ts`. `sondage` et `journal` n'ont pas de type dans `types.ts` : hors périmètre.

## Common Pitfalls

### Pitfall 1 : le meta CSP suit le script d'ordre
**What goes wrong :** Astro rend le meta (puis les styles) en fin de `<head>` ; le `<script>` d'ordre, écrit dans `Base.astro`, est avant. **Why :** un meta CSP ne gouverne que ce qui est analysé après lui. Vérifié : script d'ordre falsifié, aucune violation, le script s'exécute ; 68 pages sur 68. **How to avoid :** ne pas écrire dans l'ADR ni dans la page Méthode que le meta couvre le script d'ordre ; rendre l'en-tête CSP `script-src` avec les deux empreintes dans le bloc Caddy (couvre dès le premier octet) ; garder la règle check-dist d'empreinte (elle prouve ce que la politique autoriserait). Alternative non retenue : déplacer le script d'ordre en début de `<body>` (contraire à D-06 « à leur place »). **Warning signs :** une règle check-dist « meta avant tout script » échoue.

### Pitfall 2 : `bypassCSP` et `addStyleTag`
**What goes wrong :** `e2e/texte.spec.ts` injecte des `<style>` avec `page.addStyleTag` (police 160 %, Verdana à 320 px) ; la CSP les refuse (`Applying inline style violates…`) et les tests échouent par expiration (393 sur 461 en preview, 4,5 min). **How to avoid :** `bypassCSP: true` dans `use` de `playwright.config.ts` (vérifié : 461 verts en 52 s) et `test.use({ bypassCSP: false })` dans les seuls specs CSP. **Warning signs :** `page.addStyleTag: … violates the following Content Security Policy`.

### Pitfall 3 : bfcache impossible avec les réglages par défaut
**What goes wrong :** Playwright lance `--disable-back-forward-cache` et, en mode headless, le binaire « headless shell » dont le délégué refuse le bfcache (`BackForwardCacheDisabledForDelegate`). Un test de retour arrière qui passe n'a alors rien prouvé : `pageshow.persisted` reste `false`, et le test passe même sans le gestionnaire `pageshow` (vérifié). **How to avoid :** projet dédié avec `channel: 'chromium'` (le nouveau headless, installé par `npx playwright install chromium`, qui installe aussi le headless shell [VERIFIED: playwright-core source]) et `launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] }` ; `page.goBack({ waitUntil: 'commit' })` (l'événement `load` n'a pas lieu à une restauration bfcache : `goBack()` par défaut expire) ; asserter `persisted === true` ET la persistance d'un marqueur JS, sinon échec. **Warning signs :** `Page.backForwardCacheNotUsed` avec `BackForwardCacheDisabledByCommandLine`.

### Pitfall 4 : neuf tests lisent `dist/_astro/*.css`
Les « feuille de style construite » de `enfant.cas.ts`, `niveaux.cas.ts`, `ordre.cas.ts` (`cssDist()`) échouent après inlining. Les remplacer par un assistant partagé qui concatène le contenu des `<style>` de toutes les pages (ou d'une page de référence), à placer dans `tests/dist/contexte.ts`/un helper, pas copié trois fois.

### Pitfall 5 : le CSS en ligne sort du périmètre de `RESSOURCE_TIERCE` et de `SCRIPT_TROP_LOURD`
Voir Pattern 2 points 3 et 6.

### Pitfall 6 : fins de ligne
Le navigateur normalise CR LF en LF avant de hacher un script ; un `src/scripts/*.js` en CRLF donnerait un hachage Node différent. `.editorconfig` impose `end_of_line = lf` mais `.gitattributes` ne couvre pas `src/scripts/`. Ajouter `src/scripts/*.js text eol=lf` et un test « aucun `\r` dans `src/scripts/*.js` ».

### Pitfall 7 : le serveur de test envoie `Cache-Control: no-store`
Avec Chromium 156, une page `no-store` est tout de même restaurée du bfcache dans le spike (sans changer le serveur), mais Caddy servira `no-cache` en production. Documenter ; ne pas modifier `e2e/serveur.ts` sans nécessité (la mesure 4G à froid en dépend).

### Pitfall 8 : `e2e/poids.ts` compte des fichiers `/_astro/` qui n'existent plus
`pageLaPlusLourde` retombe sur le seul HTML, donc reste correct ; mettre à jour le commentaire et simplifier. Même remarque pour le diagnostic `integration.cas.ts:141`.

### Pitfall 9 : `astro dev` et empreintes
Avec la forme config de D-07, modifier `src/scripts/*.js` en `astro dev` sans redémarrer laisse un hachage périmé et le navigateur bloque le script en développement. Consigner « redémarrer le serveur de développement après avoir modifié un script » dans le RUNBOOK (ou adopter la variante runtime, qui n'a pas ce défaut).

### Pitfall 10 : numérotation des ADR
Dernier ADR existant : ADR-052. Les recherches v1.1 réservent 053 (domaine), 056 (inlining/CSP, remplace 037) ; garder cette numérotation pour ne pas heurter les Phases 6 et 8 (054, 055, 057, 058). `tests/repo/docs.test.ts` ne vérifie que des minimums et des titres précis, pas de séquence continue.

## Code Examples

### Test CSP e2e (projet `avec-js`, fichier `e2e/csp.spec.ts`)

```ts
import { expect, test } from '@playwright/test';
import { PAGES } from './pages.ts';

test.use({ bypassCSP: false });   // la config globale passe bypassCSP à true pour texte.spec (addStyleTag)

test(`zéro violation CSP sur ${PAGES.length} pages`, async ({ page }) => {
  const problemes: string[] = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problemes.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problemes.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    (window as any).__v = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as any).__v.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  for (const p of PAGES) {
    problemes.length = 0;
    await page.goto(p.url);
    expect(await page.evaluate(() => (window as any).__v), `${p.url} securitypolicyviolation`).toEqual([]);
    expect(await page.locator('html').getAttribute('data-ordre-js'), `${p.url} : ordre.js a tourné`).not.toBeNull();
    if (p.aSelecteur) expect(await page.locator('html').getAttribute('data-js-niveau'), `${p.url} : niveau.js a tourné`).not.toBeNull();
    expect(problemes, `${p.url} console`).toEqual([]);
  }
});
```

Variante sans JS : `e2e/csp-sans-js.spec.ts` (le nom correspond à `testMatch: /sans-js\.spec\.ts/` du projet `sans-js` et est exclu de `avec-js` par `testIgnore: /sans-js|4g/`), `test.use({ bypassCSP: false })`, mêmes boucles avec seulement la console (pas d'`addInitScript`). Vérifié : l'erreur de style bloqué remonte dans la console sans JS.

### Parcours par clics et bfcache (W4), `e2e/parcours.spec.ts`

Config : nouveau projet `{ name: 'parcours', testMatch: /parcours\.spec\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chromium', launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } } }` ; ajouter `|parcours` au `testIgnore` d'`avec-js`.

```ts
test('niveau gardé d\'une page à l\'autre et après retour (bfcache)', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__ps = []; addEventListener('pageshow', (e) => (window as any).__ps.push(e.persisted)); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Thèmes', exact: true }).first().click();
  await page.locator('main a[href^="/themes/"]').first().click();
  await expect(page.locator('#niv-resume')).toBeChecked();
  await page.locator('#niv-aine').check();
  await page.evaluate(() => ((window as any).__marqueur = 'theme'));
  const urlTheme = page.url();
  await page.locator('main .cellule a[href^="/candidats/"]').first().click();
  await expect(page).toHaveURL(/\/candidats\/[^/]+\/(#.*)?$/);   // le lien porte un ancre (#sante)
  await expect(page.locator('#niv-aine')).toBeChecked();         // gardé d'une page à l'autre
  await page.locator('#niv-enfant').check();                     // changé sur la page candidat
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL(urlTheme);
  const etat = await page.evaluate(() => ({ marqueur: (window as any).__marqueur, ps: (window as any).__ps }));
  expect(etat.marqueur, 'la page doit venir du bfcache').toBe('theme');
  expect(etat.ps).toContain(true);
  await expect(page.locator('#niv-enfant')).toBeChecked();       // pageshow persisted : niveau relu
});
```

Mutation éprouvée : retirer `addEventListener('pageshow', …)` du script de niveau (copie de dist, `bypassCSP: true` pour que le script modifié tourne) fait échouer l'assertion finale ; avec le headless shell par défaut, la même mutation passe (test vide). Ajouter une seconde variante (retour arrière sans bfcache : navigation normale, `waitUntil` par défaut) dans le projet `avec-js`. Choisir les liens par structure (comme `e2e/pages.ts`), jamais par identifiant de thème : la fixture `m1` et le vrai corpus n'ont pas les mêmes thèmes ; si une page de thème n'a aucune cellule avec lien candidat, prendre `premierePage`.

### Test W7 (squelette)

```ts
import ts from 'typescript';
const src = ts.createSourceFile('types.ts', texte, ts.ScriptTarget.Latest, true);
src.forEachChild((n) => {
  if (ts.isInterfaceDeclaration(n)) /* membres : n.members.filter(ts.isPropertySignature) ; optionnel : !!m.questionToken */;
  if (ts.isTypeAliasDeclaration(n) && ts.isUnionTypeNode(n.type)) /* littéraux : n.type.types.map(t => t.getText().replace(/'/g, '')) */;
});
```

Propriétés d'un schéma : union de `properties`, et des `properties` de `then`/`else` (à la racine et dans `allOf[*]`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS et JS externes hachés (ADR-037) | CSS et JS dans la page, CSP meta à empreintes | Phase 7 | Une requête de moins sur Slow 4G (1257 ms vers 728 ms), politique plus stricte (plus de `script-src 'self'` dépendant de fichiers) |
| Playwright headless shell par défaut | `channel: 'chromium'` pour tout test dépendant de bfcache | Playwright 1.49+ | Restauration bfcache réelle |
| `security.csp` sans gestion de `kind` | `kind: 'element' / 'attribute' / 'default'` par hachage et ressource | Astro 7.1 | Peut cibler `script-src-elem` ; non utilisé ici (inutile) |

**Deprecated/outdated :** ADR-037 (« aucun code en ligne ») est remplacée par un nouvel ADR (ADR-056 suggéré) ; `astro:content`'s `z`, `src/content/config.ts` restent proscrits.

## Runtime State Inventory

Sans objet : ni renommage ni migration de données. Le champ `domaine` est une addition ; `dist/`, `dist-reel/`, `dist-preview/`, `dist-e2e/` sont des sorties de build régénérées (à reconstruire, jamais committées). Aucun état externe (aucun serveur, aucun secret).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npx playwright install --with-deps chromium` en CI fournit bien le binaire `chromium` complet utilisé par `channel: 'chromium'` (vérifié dans le code de playwright-core, pas dans un run CI) | Pitfall 3, Code Examples | Le projet `parcours` échouerait en CI ; vérifier `gh run list` au premier push |
| A2 | `request>headers delete` et `request>tls delete` sont acceptés par Caddy 2 comme chemins complets | Pattern 3 (bloc Caddy) | Le bloc ne validerait pas en Phase 8 ; repli : `request>headers>User-Agent delete`, etc. (documenté) |
| A3 | Un en-tête CSP `script-src` avec seulement les deux empreintes ne gêne aucune page (le meta en admet davantage, l'intersection suit le plus strict) | Pattern 3 | Scripts bloqués en Phase 8 ; le test e2e de Phase 8 « derrière l'en-tête réel » (STACK.md) le détectera ; je n'ai pas servi de page derrière cet en-tête |
| A4 | Les chiffres 4G (serveur de test local, Chromium 156) valent pour les profils publiés | Summary | Phase 8 mesure derrière Caddy ; ne rien publier avant |
| A5 | `request>remote_ip ip_mask 24 48` : forme à deux arguments (IPv4 24 bits, IPv6 48 bits) [CITED: documentation Caddy `log`] | Pattern 3 | Faible |

## Open Questions

1. **Faut-il aussi déplacer le script d'ordre après le meta ?**
   - Ce qu'on sait : il précède le meta sur 100 % des pages ; l'en-tête Caddy le couvrira en Phase 8.
   - Ce qui manque : décision de produit sur le niveau d'exigence tant que le serveur n'existe pas (la build preview et l'artefact `site-preview` n'ont que le meta).
   - Recommandation : ne pas bouger le script (D-06) ; consigner la limite dans l'ADR et dans le RUNBOOK.
2. **Phrase de couverture quand `mesures === 0` et `enAttente > 0`** : formulation exacte à trancher (voir W3). Recommandation : omettre la clause « publiée » et écrire « 27 candidats sur 37 ont une position rédigée, en attente de relecture. ».
3. **Hachage par page ou global** (config ou `Astro.csp.insertScriptHash`) : D-07 retient la config ; la variante runtime est vérifiée si l'on veut l'exactitude par page.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 via `fnm exec --using=24` | Tout | ✓ | 24.22.2 (shell par défaut : Node 22.23.3, trop ancien pour Astro 7.4.5 : toujours préfixer) | — |
| npm | Scripts | ✓ | 11.19.1 | — |
| Chromium Playwright (full + headless shell) | Tests CSP, parcours, 4G | ✓ | 156.0.8078.4 (caches 1148 à 1248) | — |
| Docker (OrbStack) | `caddy validate` local | ✗ (démon éteint) | client 29.5.3 | Valider en Phase 8 sur le VPS ; ne pas démarrer Docker dans cette phase |
| `caddy` | validation du bloc | ✗ | — | idem ; le test de dérive ne vérifie que le rendu |
| `gh` | Surveiller la CI (`gh run list`) | ✓ | — | — |

**Missing dependencies with no fallback :** aucune.
**Missing dependencies with fallback :** validation Caddy différée à la Phase 8.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24, type stripping) pour les tests unitaires, de dépôt et de dist ; Playwright 1.64.1 pour l'e2e |
| Config file | `package.json` script `test` ; `playwright.config.ts` (projets `avec-js`, `4g`, `sans-js`, plus `parcours` à créer) |
| Quick run command | `TZ=Europe/Paris fnm exec --using=24 node --test tests/scripts/check-dist.test.ts tests/corpus/site-config.test.ts tests/corpus/vue.test.ts tests/repo/astro-config.test.ts` |
| Full suite command | `TZ=Europe/Paris fnm exec --using=24 npm test` (environ 36 s mesuré) ; e2e : `fnm exec --using=24 npm run e2e` (construit fixture et vrai corpus, environ 4 min par jeu mesuré, ne pas lancer en même temps que `npm test` dans le même dossier) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEB-05 | `domaine` lu, validé, propagé (canonique, sitemap, robots, Caddy) | unit + dist | `node --test tests/corpus/site-config.test.ts tests/dist/site.test.ts` | partiel (à étendre) ; `tests/dist/cas/domaine.cas.ts` ❌ Wave 0 |
| HEB-05 | Aucun nom d'hôte du site en dur | repo | `node --test tests/repo/hote-en-dur.test.ts` | ❌ Wave 0 |
| HEB-05 | Bloc Caddy sans dérive | repo | `node --test tests/repo/caddy.test.ts` | ❌ Wave 0 |
| HEB-06 | `.invalid` + `RTP_DEPLOIEMENT=1` : build et check-dist échouent | unit + spawn | `node --test tests/corpus/site-config.test.ts tests/scripts/check-dist.test.ts` | partiel ; cas `astro build` en échec ❌ Wave 0 |
| PERF-01 | Script en ligne == source, hachage ∈ CSP, pas d'`unsafe-inline`, CSS inline hachée | unit (faute injectée) | `node --test tests/scripts/check-dist.test.ts` | ✅ à étendre |
| PERF-01 | Build réelle conforme (octets, ordre, bloquant) | dist | `node --test tests/dist/site.test.ts` | ✅ cas à réécrire (ordre, niveaux, integration, theme, enfant, squelette) |
| PERF-01 | Zéro violation CSP, avec et sans JS | e2e | `npm run e2e -- -- e2e/csp.spec.ts` (ou `playwright test e2e/csp*.spec.ts` avec `E2E_DIST`) | ❌ Wave 0 |
| PERF-01 | Poids de `/themes/sante/` sous budget | dist + e2e | `check-dist` (500 Ko / 100 Ko) ; `e2e/4g.spec.ts` | ✅ |
| DETTE-01 | Phrase preview sans « publiée » pour des brouillons | unit | `node --test tests/corpus/vue.test.ts` | ✅ à étendre |
| DETTE-02 | Parcours par clics, niveau gardé, retour bfcache | e2e | `playwright test --project=parcours` | ❌ Wave 0 |
| DETTE-03 | Sources consultées : lien, date, extrait | dist + unit | `node --test tests/dist/site.test.ts` | ✅ `theme.cas.ts` à réécrire |
| DETTE-05 | Types alignés sur les schémas | repo | `node --test tests/corpus/types-schemas.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** la commande rapide ci-dessus, plus le fichier de test ajouté par la tâche.
- **Per wave merge :** `npm test` entier, puis `astro check`.
- **Phase gate :** `npm test`, `npm run check`, `npm run e2e` verts, `check-dist` en production/preview/fixture, puis `gh run list` après push (CI verte) avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/repo/hote-en-dur.test.ts` (HEB-05)
- [ ] `tests/repo/caddy.test.ts` et `scripts/render-caddy.ts` (HEB-05)
- [ ] `tests/corpus/types-schemas.test.ts` (DETTE-05)
- [ ] `tests/dist/cas/csp.cas.ts`, `tests/dist/cas/domaine.cas.ts` (modules de cas ; `site.test.ts` les charge sans modification)
- [ ] `e2e/csp.spec.ts`, `e2e/csp-sans-js.spec.ts`, `e2e/parcours.spec.ts` + projet `parcours` + `bypassCSP: true` global dans `playwright.config.ts` + `testIgnore` d'`avec-js` mis à jour
- [ ] Assistant partagé « CSS des pages » pour les 9 tests qui lisaient `_astro/*.css`
- [ ] Mise à jour de `tests/corpus/site-config.test.ts`, `tests/repo/astro-config.test.ts`, `tests/scripts/check-dist.test.ts`, `tests/scripts/e2e-serveur.test.ts` (inchangé : n'utilise que des fichiers synthétiques)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Site statique public, aucun compte |
| V3 Session Management | no | Aucune session ni cookie (test `vie-privee.spec.ts` existant) |
| V4 Access Control | no | Aucun contenu protégé ; l'accès à l'artefact `site-preview` suit la visibilité du dépôt (note à ajouter à l'ADR-051) |
| V5 Input Validation | yes | `loadSiteConfig` strict (nom d'hôte validé par expression ; refus de schéma, port, chemin, majuscules) ; `new URL()` pour les chemins du sitemap ; échappement XML si un `<loc>` pouvait contenir `&` (les identifiants sont des slugs) |
| V6 Cryptography | yes | `node:crypto` SHA-256 pour les empreintes CSP, jamais d'algorithme maison |
| V14 Configuration | yes | CSP stricte (meta + en-tête), en-têtes de sécurité du bloc Caddy |

### Known Threat Patterns for Astro statique avec CSP à empreintes

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injection de script inline | Tampering | `script-src` à empreintes sans `unsafe-inline` ; check-dist refuse tout script qui n'est pas une source et tout hachage absent ; limite du meta (script d'ordre avant le meta) compensée par l'en-tête Caddy |
| Style injecté | Tampering | `style-src` à empreintes ; refus de `style=` et de tout `unsafe-inline` |
| Hachage périmé qui bloque le site | Denial of service | Une seule source (`csp-empreintes.ts`), tests de dérive, e2e « zéro violation » |
| Faux domaine canonique en preview | Spoofing | Pas de canonique ni de sitemap en preview ; `DOMAINE_PROVISOIRE` bloque le déploiement |
| Fuite via artefact preview (dépôt public) | Information disclosure | Note ADR-051 : brouillons lisibles par tous, build preview jamais déployée (Phase 8 teste l'absence d'artefact preview dans le déploiement) |
| Clickjacking | Spoofing | `frame-ancestors 'none'` dans l'en-tête Caddy uniquement (ignoré dans un meta) |
| Journal d'accès excessif | Information disclosure | `ip_mask 24 48`, en-têtes supprimés, 14 jours (rendu depuis la config, validé en Phase 8) |

## Fichiers à modifier et tests impactés (liste de contrôle pour les plans)

**Code de production**
- `astro.config.mjs` (site, inlineStylesheets, security.csp)
- `src/layouts/Base.astro` (`?raw` + inline, canonique)
- `src/components/LecteurNiveaux.astro` (`?raw` + inline)
- `src/components/OrdreCandidats.astro` : seul le commentaire d'en-tête évoque « chargé dans `<head>` » ; à ajuster
- `src/lib/site-config.ts`, `config/site.yml`
- `src/lib/csp-empreintes.ts` (nouveau)
- `src/pages/robots.txt.ts`, `src/pages/[fichier].xml.ts` (nouveau)
- `src/lib/corpus/vue.ts` (W3), `src/components/EtatVide.astro` et composant source partagé (W10), `src/components/Mesure.astro` (extraction)
- `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `scripts/render-caddy.ts` (nouveau), `deploy/caddy/site.caddy` (nouveau)
- `.gitattributes` (`src/scripts/*.js text eol=lf`)
- `playwright.config.ts`, `e2e/poids.ts` (commentaire), nouveaux specs
- `docs/ARCHITECTURE.md` (ADR-053, ADR-056 qui remplace ADR-037, note ADR-051), `docs/RUNBOOK.md` (tableau des codes, changer de domaine, redémarrer `astro dev`), `README.md` si le domaine y est évoqué

**check-dist** : règles actuelles à remplacer ou adapter : `SCRIPT_EN_LIGNE` (l. ~226-233 : `<script>` sans `src` et attributs `on*`), `STYLE_EN_LIGNE` (`<style>` et `style=`), `SCRIPT_NON_BLOQUANT` (étendre aux scripts en ligne), `SCRIPT_DATA_URI` (inchangée), `SCRIPT_TROP_LOURD` (étendre aux scripts en ligne), `RESSOURCE_TIERCE` (étendre aux `<style>` en ligne), calcul du poids (la boucle `liés` n'ajoute plus rien : correct).

**Tests dont les assertions changent** (37 échecs observés sur `npm test` dans le spike) :
- `tests/corpus/site-config.test.ts` : 4 tests (domaine requis)
- `tests/repo/astro-config.test.ts` : « assets toujours externes : assetsInlineLimit 0 et inlineStylesheets 'never' »
- `tests/dist/cas/ordre.cas.ts` : « toutes les pages : `<script src="/_astro/ordre.<hash>.js">` bloquant… » ; « le fichier du dist pèse au plus 2048 octets et est identique à `src/scripts/ordre.js` » (l. 78-84) ; `cssDist` et 3 tests CSS (listes cachées, phrase « demande JavaScript », prefers-reduced-motion)
- `tests/dist/cas/niveaux.cas.ts` : « le script classique suit immédiatement `</fieldset>` : bloquant, haché, identique à la source » (l. 83-98) ; `cssDist` et 3 tests CSS (règles `:has()`, `@supports :has()`, `.concerne-aine`)
- `tests/dist/cas/enfant.cas.ts` : `cssDist` et 3 tests (repli sans Popover, « Mots expliqués », terme en pointillé)
- `tests/dist/cas/integration.cas.ts` : l. 43 `src="/_astro/niveau.….js"` ; diagnostic de poids l. 141 (regex `/_astro/`)
- `tests/dist/cas/theme.cas.ts` : bloc « CSS externe » l. 171-183 (à inverser : un `<style>` par page, aucun fichier `.css`, aucun `style=`) ; phrase « Sources consultées » l. 99 (W10)
- Tous les tests `checkDist … aucune erreur` des modules de cas (`candidat`, `enfant`, `institutionnel`, `integration`, `methode`, `modes`, `niveaux`, `ordre`, `source`, `squelette`, `theme`) échouent tant que check-dist refuse l'inline : ils reviennent au vert avec les nouvelles règles
- `tests/scripts/check-dist.test.ts` : cas `SCRIPT_EN_LIGNE` (l. 277), `STYLE_EN_LIGNE` (l. 291), `SCRIPT_NON_BLOQUANT` (l. 285), `MOT_INTERDIT` dans script (l. 345-348), la page synthétique `page()` (l. 55-56) à enrichir d'un meta CSP et d'un script en ligne conforme ; nouveaux cas par code
- `tests/ui/constantes-publiques.test.ts` l. 53-54 lit `src/scripts/*.js` : inchangé
- `tests/browser-js/niveau.test.ts`, `ordre.test.ts` (faux DOM, `src/scripts/*.js`) : inchangés
- `tests/repo/ci.test.ts` : inchangé tant que les étapes de `ci.yml` ne changent pas (le job `e2e` lance déjà `npm run e2e`, qui ramasse les nouveaux specs)
- `tests/repo/scaffold.test.ts` : à mettre à jour seulement si un script npm est ajouté

## Découpage proposé en plans et vagues

Fichiers partagés entre les chantiers : `astro.config.mjs`, `Base.astro`, `scripts/lib/check-dist.ts`, `tests/dist/cas/theme.cas.ts`, `playwright.config.ts`. D'où des vagues séquentielles pour l'inlining puis le domaine.

| Vague | Plan | Contenu | Dépend de |
|-------|------|---------|-----------|
| 1 | **07-01 Inlining et CSP** | helper d'empreinte, `astro.config.mjs` (inline, csp), `Base.astro` / `LecteurNiveaux.astro`, `.gitattributes`, règles check-dist (Pattern 2) avec tests par injection de faute, réécriture des cas dist (ordre, niveaux, integration, theme CSS, enfant, squelette) et de `astro-config.test.ts`, assistant « CSS des pages » | — (spike fait) |
| 1 | **07-02 Dette sans conflit de fichiers** | W7 (`types-schemas.test.ts`, nouveau fichier seul) et W3 (`vue.ts`, `vue.test.ts`, nouveau cas dist) | — |
| 2 | **07-03 Domaine** | `site.yml`, `site-config.ts` et ses tests, `site` Astro, canonique, sitemap, robots, règles check-dist (canonique, sitemap, `DOMAINE_PROVISOIRE`), garde anti hôte en dur, `render-caddy.ts` + `deploy/caddy/site.caddy` + test de dérive | 07-01 (mêmes fichiers, empreintes pour l'en-tête Caddy) |
| 2 | **07-04 Navigateur** | `bypassCSP` global, `csp.spec.ts` + `csp-sans-js.spec.ts`, projet et spec `parcours`, relance de `4g.spec.ts` et consignation des chiffres (avant/après du présent document), poids de `/themes/sante/` | 07-01 (build inlinée) |
| 2 | **07-05 Sources consultées (W10)** | composant source partagé, `EtatVide.astro`, `Mesure.astro`, `theme.cas.ts` (phrase), UI-SPEC | 07-01 (`theme.cas.ts` modifié par 07-01) |
| 3 | **07-06 Documentation et clôture** | ADR-053, ADR-056 (remplace 037, mentionne la limite du meta et la variante runtime), note ADR-051, RUNBOOK (codes, changer de domaine, hachages en dev), mise à jour du plan de contrôle, vérification CI (`gh run list`) | 07-01 à 07-05 |

Ordre interne de 07-01 : (1) helper et config, (2) composants, (3) règles check-dist + tests unitaires, (4) cas dist, (5) vérification `npm test`. Chaque plan se termine par `npm test` + `astro check` ; les plans 07-04 et le final exécutent `npm run e2e`.

## Sources

### Primary (HIGH confidence)
- Spike local `/tmp/rtp-spike7` (Node 24.22.2, Astro 7.4.5, Playwright 1.64.1, Chromium 156.0.8078.4) : configuration, build preview (68 pages) et production (65 pages), contrôle exhaustif des hachages, Playwright CSP avec/sans JS, fautes injectées, parcours bfcache, 4G avant/après, `npm test` (1659 tests, 37 échecs attendus), 1031 tests e2e verts avec `bypassCSP: true`
- `node_modules/astro/dist/core/csp/common.js` (`trackScriptHashes`, `trackStyleHashes`), `dist/runtime/server/render/head.js` et `page.js` (placement du meta), `dist/types/public/config.d.ts` (`security.csp`, `scriptDirective.hashes`, `directives`) et `context.d.ts` (`Astro.csp.insertScriptHash`)
- `node_modules/playwright-core/lib/coreBundle.js` (`--disable-back-forward-cache`, installation de `chromium-headless-shell`, `getExecutableName`)
- Dépôt : `scripts/lib/check-dist.ts`, `tests/dist/cas/*.cas.ts`, `tests/scripts/check-dist.test.ts`, `e2e/*.ts`, `playwright.config.ts`, `src/lib/site-config.ts`, `src/lib/corpus/{vue,types,index}.ts`, `schemas/`, `docs/ARCHITECTURE.md`

### Secondary (MEDIUM confidence)
- https://caddyserver.com/docs/caddyfile/directives/log (consulté 2026-11-07) : `format filter`, `ip_mask`, `roll_*`, `wrap json`
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` (recherche v1.1 précédente) : bloc Caddy de départ, recommandation CSP

### Tertiary (LOW confidence)
- Aucune

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH, aucun ajout, versions lues sur disque
- Architecture (CSP, inlining, domaine, sitemap) : HIGH, exécutée de bout en bout
- Pitfalls : HIGH pour le meta, `bypassCSP`, bfcache (tous reproduits) ; MEDIUM pour le bloc Caddy (non validé)
- Chiffres 4G : MEDIUM, mesurés sur le serveur de test local (Phase 8 refait la mesure derrière Caddy)

**Research date:** 2026-11-07
**Valid until:** 2026-12-07 (Astro 7.x évolue vite : revérifier l'emplacement du meta et `scriptDirective` si Astro est mis à jour avant l'exécution)
