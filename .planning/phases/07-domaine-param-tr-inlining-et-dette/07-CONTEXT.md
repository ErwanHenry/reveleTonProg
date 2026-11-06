# Phase 7: Domaine paramétré, inlining et dette - Context

**Gathered:** 2026-11-07
**Status:** Ready for planning
**Mode:** décisions prises par l'orchestrateur à partir de `.planning/research/` et des choix d'Erwan du 2026-11-06 (mode yolo, autonomie maximale demandée)

<domain>
## Phase Boundary

Le site se construit pour n'importe quel domaine déclaré une seule fois, charge vite avec CSS et scripts dans la page sous une CSP stricte, et les dettes de l'audit v1.0 qui ne dépendent d'aucun serveur sont soldées. Exigences : HEB-05, HEB-06, PERF-01, DETTE-01, DETTE-02, DETTE-03, DETTE-05. Aucun serveur, aucun déploiement, aucun secret dans cette phase. Le bloc Caddy généré existe ici seulement comme sortie d'un rendu testé (le serveur réel est en Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Domaine (HEB-05, HEB-06)
- **D-01:** Nouveau champ `domaine` dans `config/site.yml`, lu par le lecteur strict `src/lib/site-config.ts`. Valeur provisoire `domaine-a-definir.invalid` (le domaine n'est pas acheté).
- **D-02:** Sous `RTP_DEPLOIEMENT=1`, un domaine en `.invalid` fait échouer la build et check-dist, comme `CONTACT_PROVISOIRE` (même mécanisme, nouveau code stable dans le catalogue s'il passe par check-dist).
- **D-03:** Le domaine alimente `site` dans `astro.config.mjs`, une balise `<link rel="canonical">` par page (Base.astro), un `sitemap.xml` écrit à la main (endpoint Astro, sans `@astrojs/sitemap`), la ligne `Sitemap:` de `robots.txt` en production seulement, et le bloc Caddy rendu par un script (`scripts/render-caddy.ts` ou équivalent) vers `deploy/caddy/site.caddy` avec un test de dérive. En preview, pas de `Sitemap:` et `noindex` conservé.
- **D-04:** Un test de dépôt refuse tout nom d'hôte du site écrit en dur hors de `config/site.yml` (les URL de sources, data.gouv, GitHub et Wayback restent permises).

### Inlining et CSP (PERF-01)
- **D-05:** CSS dans chaque page : `build.inlineStylesheets: 'always'`. Garder `vite.build.assetsInlineLimit: 0` (sinon les scripts deviennent des URI `data:`, refusées par `SCRIPT_DATA_URI`).
- **D-06:** Scripts de niveau et d'ordre dans la page via `import … from '../scripts/x.js?raw'` et `<script is:inline set:html={…}>`, toujours classiques et bloquants à leur place actuelle (ADR-040). Le plafond de 2048 octets par script reste.
- **D-07:** CSP par page en `<meta>` via `security.csp` d'Astro (option A), empreintes sha256 des styles calculées par Astro, empreintes des deux scripts fournies par `scriptDirective.hashes` à partir de `node:crypto` sur les fichiers sources (pas de dérive possible). Jamais `unsafe-inline` sur `script-src`. Repli (option B) seulement si un spike montre que A ne couvre pas les `is:inline` : documenter dans un ADR.
- **D-08:** check-dist : les règles `SCRIPT_EN_LIGNE` et `STYLE_EN_LIGNE` (ADR-037) sont remplacées par des règles à empreintes, jamais simplement supprimées : un script en ligne est accepté seulement s'il est identique octet pour octet à un fichier de `src/scripts/` et si son empreinte figure dans la CSP de la page ; un `<style>` en ligne seulement si son empreinte figure dans la CSP. Toujours refusés : attributs `on*=`, attributs `style=`, scripts `data:`, tout `unsafe-inline` dans `script-src`. Les cas `ordre.cas.ts` et `niveaux.cas.ts` (identité octet pour octet du script) sont réécrits pour la forme en ligne. Nouvel ADR qui remplace l'ADR-037 ; note ajoutée à l'ADR-051 (dépôt public depuis le 2026-11-04 : brouillons et artefact `site-preview` lisibles par tous, la build preview n'est jamais déployée).
- **D-09:** Le budget de poids reste dur (500 Ko bruts, 100 Ko gzip par page) : mesurer la page la plus lourde (`/themes/sante/`) après inlining. Test e2e « zéro violation CSP » (écoute des `securitypolicyviolation` et de la console) sur toutes les pages, avec et sans JS.
- **D-10:** La mesure Slow 4G réelle et le libellé public « Slow 4G simulé » sont en Phase 8 (PERF-02) ; ici, relancer `e2e/4g.spec.ts` et consigner les chiffres des deux profils après inlining, sans changer les budgets publiés.

### Dette (DETTE-01, 02, 03, 05)
- **D-11:** DETTE-01 (W3) : en preview, la phrase de couverture ne dit pas « position publiée » pour des brouillons (ex. « 27 candidats sur 37 ont une position rédigée, en attente de relecture »). La production garde sa phrase.
- **D-12:** DETTE-02 (W4) : un test Playwright suit le parcours par clics (accueil, thème, choix de niveau, page candidat, retour) et vérifie que le niveau est gardé d'une page à l'autre et après un retour arrière (bfcache, `pageshow`). Il tourne sur la build inlinée.
- **D-13:** DETTE-03 (W10) : dans `EtatVide.astro`, chaque source consultée affiche un lien vers le document, sa date de consultation et le lien vers l'extrait archivé, comme le bloc source d'une mesure.
- **D-14:** DETTE-05 (W7) : un test compare `src/lib/corpus/types.ts` aux schémas JSON (`schemas/`) : chaque propriété requise d'un schéma existe dans le type et inversement pour les champs lus par les pages. Pas de génération de types (hors périmètre).

### Claude's Discretion
- Nom et emplacement exacts du script de rendu Caddy et du test de dérive ; contenu du bloc Caddy (en-têtes, cache, journal à 14 jours avec IP masquée /24 et /48, sans User-Agent ni Referer) tant qu'il découle de la configuration ; le bloc réel sera appliqué en Phase 8.
- Découpage en plans et vagues, ordre interne (le spike CSP passe en premier).

</decisions>

<constraints>
## Contraintes du projet

- Node 24 via `fnm exec --using=24` ; aucune nouvelle dépendance npm (chaque ajout justifié par écrit).
- Zéro ressource tierce, zéro cookie, fonctionnement complet sans JS, WCAG 2.2 AA (axe : violations serious et critical bloquantes).
- Neutralité des textes (mots interdits), français sans tiret long ni demi-cadratin dans les textes du site.
- Jamais modifier `src/content/**`, `archives/**`, `data/couverture-themes.yaml`.
- Après chaque push : vérifier la CI (`gh run list`) ; tests qui font `git commit` fixent leur identité ; à 320 px, police large imposée dans les tests.
</constraints>

<canonical_refs>
## Références

- `.planning/research/SUMMARY.md`, `STACK.md` (inlining vérifié par build jetable, pièges `assetsInlineLimit`, en-tête CSP sans `default-src`), `ARCHITECTURE.md` (composants, ADR-053 à 058), `PITFALLS.md` (pitfall 11)
- `docs/ARCHITECTURE.md` (ADR-037, 040, 049, 051), `docs/RUNBOOK.md`
- `astro.config.mjs`, `src/layouts/Base.astro`, `src/components/LecteurNiveaux.astro`, `src/components/OrdreCandidats.astro`, `src/components/EtatVide.astro`, `src/lib/site-config.ts`, `src/lib/corpus/vue.ts`, `src/lib/corpus/types.ts`, `scripts/lib/check-dist.ts`, `tests/dist/cas/*.cas.ts`, `e2e/*.spec.ts`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (W3, W4, W7, W10)
</canonical_refs>
