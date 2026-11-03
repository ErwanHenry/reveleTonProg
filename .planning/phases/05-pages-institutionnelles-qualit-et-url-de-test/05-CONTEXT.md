# Phase 5: Pages institutionnelles, qualité et URL de test - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** décisions reprises des phases précédentes (Erwan a demandé à l'orchestrateur d'avancer en autonomie maximale)

<domain>
## Phase Boundary

Pages Méthode (générée depuis la config du validateur), Mentions légales (LCEN art. 1-1), Qui sommes-nous, rappel des dates des deux tours ; suite Playwright + axe (sans JS, clavier, WCAG 2.2 AA, 160 %, reduced-motion, contraste, 4G lente) ; build preview livrée comme URL de test (artefact CI) ; test croisé simulé (3 personas + données piégées) avec journal d'audit. Livrable du Lot 2. Hors périmètre : hébergement réel, domaine, déploiement (Lot 3).

</domain>

<decisions>
## Implementation Decisions

### Héritées (verrouillées)
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

</decisions>

<code_context>
## Existing Code Insights

- Pages Astro existantes : hall `/`, `/themes/`, `/themes/[id]/`, `/candidats/`, `/candidats/[id]/` ; layout `Base.astro` (nav, bannière preview, footer, phrase de signalement) ; styles `base.css`, `pages.css`
- `tests/dist/site.test.ts` = seul fichier qui lance `astro build` (cas dans `tests/dist/cas/*.cas.ts`) ; `scripts/lib/check-dist.ts` (codes, exemption `data-liste-mots-interdits`)
- `config/site.yml` + `src/lib/site-config.ts` ; `rules/config.ts` (CATALOGUE, listes, bornes, HYPOTHESES) ; `data/couverture-themes.yaml` + `docs/COUVERTURE-THEMES.md`
- CI `.github/workflows/ci.yml` : validate, check, test, build + check-dist (fixture, réel production, réel preview)

</code_context>

<specifics>
## Specific Ideas

- La page Méthode doit être lisible par un public large : phrase d'introduction simple, détails techniques repliés
- Lister honnêtement les limites connues (sites bloqués, sources datées par mois de capture, Kandel-Moles en avertissement seulement, Safari/VoiceOver non testés)

</specifics>

<deferred>
## Deferred Ideas

- Hébergement Caddy, domaine, déploiement (Lot 3, milestone v1.1)
- Relecture juridique des mentions (avant Lot 3)

</deferred>
