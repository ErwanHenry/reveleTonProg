# Phase 1: Fondations, schémas v1 et content-core - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Dépôt Node 24 + Astro 7 statique (zéro JS), CI GitHub Actions durcie, hygiène documentée (LICENSE, README, ARCHITECTURE avec ADR D-1 à D-13, RUNBOOK), schémas JSON Schema 2020-12 v1 pour toutes les collections, module `src/lib/content-core` (load, ajv, diagnostics) partagé par le validateur CLI et le loader Astro, fixture fictive `corpus-valide`, runner de migrations. Les règles éditoriales (mots interdits, longueurs, équité, pièges) relèvent de la Phase 2 ; l'import réel de la Phase 3 ; les pages de la Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Décisions déjà prises par Erwan (2026-11-03)
- D-1 : statuts = codes du dataset `declare|primaire|pressenti|empeche|renonce` ; `renonce` affiché « Ne se présente pas » ; historique `statuts[]` append-only
- D-2 : périmètre d'équité = `declare` + `primaire`, piloté par config
- D-4 : mentions légales éditeur non professionnel (LCEN art. 1-1 II), pas d'adresse personnelle
- D-5 : Node 24 LTS (`.nvmrc` = 24, `engines >=24.12`, `engine-strict`) ; Node 24.21.0 déjà installé localement via fnm

### Données et sources
- D-3 : presse autorisée comme source d'un **statut** uniquement, `source.type: presse` affiché sur le badge, remplacée dès qu'une source candidat/parti/institution existe ; jamais pour une mesure
- D-8 : archives = extrait `.txt` + sha256 + date de capture + URL Wayback committés dans `archives/` ; binaires (PDF, HTML rendu) dans un repo privé `reveleTonProg-archives` (hors dépôt public) ; plafond 5 Mo par fichier ; LICENSE exclut `archives/`
- D-7 : collections en plus des 5 de la spec : `sources`, `couverture`, `glossaire` (partis = entrées `type: parti` avec auto-description sourcée)
- `motif` obligatoire quand statut `renonce` : enum `retrait`, `elimine_primaire`, `ralliement`, `non_candidat`
- Dates partielles `YYYY-MM` acceptées seulement en `brouillon` (if/then), date complète exigée pour `publie`
- Ids candidats `prenom-nom` ASCII figés ; id amont dans `ids_externes.2027etmoi`
- Un fichier YAML par entité ; mesures sous `src/content/mesures/<candidat>/`

### Projet
- D-9 : code MIT ; contenu éditorial Licence Ouverte 2.0 ; `archives/` et textes des candidats exclus (droits réservés à leurs auteurs, reproduits à titre de preuve et de citation)
- D-12 : aucune photo en v1.0, pictogramme neutre identique pour tous
- D-13 : convention dès le commit 1 (pas de commentaires informels dans les fichiers de contenu, gitleaks en CI) ; décision squash/publication reportée au lot 3

### Choix techniques (recherche, SUMMARY.md)
- JSON Schema = seule source de vérité ; loader Astro custom qui appelle content-core (parse + Ajv) ; pas de Zod par champ ; interfaces TS écrites à la main pour le view-model
- YAML parsé avec `schema: 'core'` SANS tag `timestamp` (dates = chaînes), `uniqueKeys`
- Ajv 8 `ajv/dist/2020.js`, strict, allErrors, 3 formats maison (`date`, `date-time`, `https-url`), pas d'ajv-formats
- Tests `node:test` ; scripts `.ts` exécutés nativement par Node 24 (pas de tsx)
- Astro : `compressHTML: true`, `prefetch: false`, image service passthrough
- CI : checkout/setup-node épinglés par SHA, `permissions: contents: read`, `TZ=Europe/Paris`, gitleaks, Dependabot avec cooldown
- TypeScript ^6 (peer de @astrojs/check)

### Claude's Discretion
- Découpage exact des plans, noms de fichiers internes, structure de `defs/common`
- Format exact des diagnostics (doit inclure fichier, ligne, code)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Aucun code. Dépôt contient : README, .gitignore, .env.example, docs/ARCHITECTURE.md (3 ADR initiaux à étendre), docs/RUNBOOK.md, docs/RETROSPECTIVE.md, docs/spec/CAHIER-DES-CHARGES.md, HYGIENE.md, CHECKLIST.md, CLAUDE.md (GSD)

### Established Patterns
- Docs en français ; commits avec trailer Co-Authored-By

### Integration Points
- `.planning/research/ARCHITECTURE.md` contient la disposition de dépôt recommandée et les esquisses de code (loader, Ajv bridge)
- `.planning/research/STACK.md` contient versions et justifications de dépendances prêtes pour la PR

</code_context>

<specifics>
## Specific Ideas

- Chaque dépendance ajoutée a une justification écrite (spec §11) — reprendre les lignes de STACK.md
- La fixture `corpus-valide` est fictive et clairement marquée comme telle (jamais de faux contenu attribué à un vrai candidat)

</specifics>

<deferred>
## Deferred Ideas

- Squash de l'historique Git avant passage public — lot 3
- Photos Wikimedia — après v1.0, si jamais

</deferred>
