# Phase 4: Référentiel M1 et 4 niveaux de lecture - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Pages thème et candidat statiques (M1), bascule 4 niveaux sans JS (radios + `:has()`) avec mémorisation localStorage en amélioration progressive, ordre alphabétique / aléatoire (JS), niveaux Aîné (gros caractères + « ce qui me concerne ») et Enfant (mots expliqués en Popover API + liste « Mots expliqués »), builds preview (brouillons badgés) vs production (publie seulement), contrôle post-build (poids, ressources tierces, espaces inline, nombre de cellules). Construit d'abord sur la fixture `corpus-valide`. Hors périmètre : pages Méthode/Mentions/Qui sommes-nous et suite Playwright/axe complète (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Héritées (verrouillées)
- Zéro JS requis pour lire ; scripts classiques same-origin < 2 Ko (`niveau.js`, `ordre.js`) ; aucune ressource tierce ; `compressHTML: true`
- Les pages itèrent sur les candidats, jamais sur les mesures ; `getCorpus()` seul lit `RTP_MODE` ; collation `Intl.Collator('fr')` sur `nom_tri`
- Cartes de taille fixe (première mesure + « N autres mesures »), ligne de couverture, section repliée « Ne se présentent pas » (`renonce`), pictogramme neutre identique, pas de photos
- États vides typés et datés : « Non précisé dans les sources consultées le … », « Programme non publié à ce jour » ; gris neutre, jamais rouge
- Source primaire toujours visible sous chaque mesure + lien « signaler une erreur » (mailto + issue GitHub, id pré-rempli)
- localStorage : seulement `rtp:niveau` et `rtp:ordre` (exemption CNIL personnalisation)
- Budget : ≤ 500 Ko bruts et ≤ 100 Ko gzip par page

### Choix visuels acceptés par Erwan (2026-11-03)
- Polices système (pile sans-serif système), aucun téléchargement de police
- Libellés des niveaux : « En bref » (résumé), « En détail » (détaillé), « Pour les enfants » (enfant), « Gros caractères » (aîné) ; les codes internes restent résumé/détaillé/enfant/aîné
- Une couleur dominante par thème (palette contrastée AA, fond neutre) ; jamais de couleur associée à un candidat ou un parti
- Interface en français, vouvoiement neutre

### Claude's Discretion
- Palette exacte, espacements, structure des composants, URL (`/themes/<id>/`, `/candidats/<id>/` recommandé)

</decisions>

<code_context>
## Existing Code Insights

- `src/lib/corpus/{types,index}.ts` (view-model, `getMesuresDe`, `getSource`), `src/pages/index.astro` (page squelette), `src/content.config.ts` (8 collections via loader content-core)
- Règles Phase 2 dans content-core (équité, glossaire `[[terme]]` résolu)

</code_context>

<specifics>
## Specific Ideas

- Niveau Aîné : corps ≥ 20 px, cibles ≥ 44 px ; bloc « ce qui me concerne » en tête (retraites, santé, dépendance, succession, logement), sans réordonner par CSS
- Enfant : soulignement pointillé + icône, distinct des liens

</specifics>

<deferred>
## Deferred Ideas

- Feuille de style impression (DIFF-02) si temps
- Ordre du Conseil constitutionnel (lot 7)

</deferred>
