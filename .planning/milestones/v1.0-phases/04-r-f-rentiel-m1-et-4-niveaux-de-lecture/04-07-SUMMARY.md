---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 07
subsystem: ui
tags: [astro, popover-api, glossaire, accessibilite, css, enfant]
requires:
  - phase: 04-03
    provides: "Corpus.glossaire (Map), VueMesure.ancre, formatDate, getCorpus"
  - phase: 04-04
    provides: "composant Mesure et ses quatre rédactions"
  - phase: 04-05
    provides: "LecteurNiveaux, niveaux.css (interrupteur :has par niveau)"
provides:
  - "segmenter / termesDe : découpe pure des textes enfant en segments texte et terme"
  - "TexteEnfant : bouton .terme + popover adjacent, un par occurrence, ids def-<ancre>-<n>"
  - "MotsExpliques : details fermée « Mots expliqués (N) » + phrase d'aide de repli"
  - "enfant.css : pointillé, marqueur « ? » ASCII en CSS, boîte popover, repli sans Popover"
  - "slugGlossaire dans rules/text/normalize.ts (pur), re-exporté par rules/references.ts"
affects: [04-08, 04-09]
tech-stack:
  added: []
  patterns:
    - "Popover natif adjacent à son déclencheur (ordre de lecture), sans script"
    - "Repli @supports not selector(:popover-open) + liste toujours présente"
    - "Segments rendus en JSX, jamais en HTML brut"
key-files:
  created:
    - src/lib/corpus/enfant.ts
    - src/components/TexteEnfant.astro
    - src/components/MotsExpliques.astro
    - src/styles/enfant.css
    - tests/corpus/enfant.test.ts
    - tests/dist/cas/enfant.cas.ts
  modified:
    - src/lib/content-core/rules/text/normalize.ts
    - src/lib/content-core/rules/references.ts
    - src/components/Mesure.astro
    - src/components/LecteurNiveaux.astro
    - tests/ui/styles.test.ts
key-decisions:
  - "L'état ouvert d'un mot repose sur .terme:has(+ .definition:popover-open) et non sur [aria-expanded=true] : popovertarget n'écrit pas aria-expanded dans le DOM (l'arbre d'accessibilité seulement)"
  - "La phrase d'aide de repli suit le même interrupteur :not(:has(...)) que la liste : elle n'apparaît qu'au niveau Pour les enfants"
  - "enfant.css est importé par TexteEnfant et par MotsExpliques (Astro dédoublonne) pour que la liste soit stylée même sans mot sur la page"
requirements-completed: [M1-10]
duration: 35min
completed: 2026-11-03
---

# Phase 4 Plan 07: Glossaire enfant en popover Summary

**Chaque `[[mot]]` du niveau « Pour les enfants » devient un bouton pointillé suivi de sa définition en popover natif (sans JavaScript), avec une liste « Mots expliqués » et un repli complet pour les navigateurs sans API Popover.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-11-03
- **Tasks:** 2 (la tâche 1 en TDD : commit RED puis GREEN)
- **Files:** 6 créés, 5 modifiés

## Accomplishments

- `segmenter(texte, glossaire, prefixe)` et `termesDe(mesures, glossaire)` sont purs (aucun import `node:` ni `astro:`) et partagent `MARQUEUR_GLOSSAIRE` avec le validateur. Les segments texte gardent leurs espaces exacts ; un identifiant inconnu lève une erreur qui nomme l'id et le préfixe.
- `slugGlossaire` vit dans `rules/text/normalize.ts` ; `references.ts` le ré-exporte (`scripts/lib/pilote.ts` et `tests/rules/references.test.ts` n'ont pas bougé). La suite des règles et des pièges reste verte.
- `TexteEnfant.astro` : `<button type="button" class="terme" popovertarget>` immédiatement suivi de `<span id popover class="definition">`, un par occurrence ; pour une entrée `parti`, ligne « Définition donnée par {titre}, {date}. » (RESEARCH Pitfall 4, menace T-04-30).
- `MotsExpliques.astro` : `details.mots-expliques` fermée, `dl` alphabétique (collation fr), rien si la page n'a aucun mot ; rendue par `LecteurNiveaux` après le slot et avant « Changer le niveau de lecture », donc aucune page n'a à changer.
- `enfant.css` : pointillé 2px décalé de 4px, zone de 24 px, marqueur « ? » dessiné en CSS (déclaration simple puis variante `/ ""`), boîte de popover du UI-SPEC, repli `@supports not selector(:popover-open)` (définitions masquées, mots en texte simple, aide affichée), liste et aide masquées hors niveau enfant par `:not(:has(...))` (visibles sans `:has()`).

## Task Commits

1. **Task 1 RED:** `62d5a77` test(04-07): add failing test for enfant text segmenter
2. **Task 1 GREEN:** `66853cc` feat(04-07): enfant text segmenter and page term list
3. **Task 2:** `0149c1a` feat(04-07): enfant glossary popovers and Mots expliqués list

## Verification

- `node --test tests/corpus/enfant.test.ts tests/rules/references.test.ts tests/pieges/*.test.ts` : vert.
- `node --test tests/ui/styles.test.ts tests/corpus/enfant.test.ts` : 43 tests verts. Suites `tests/repo`, `ui`, `corpus`, `rules`, `pieges`, `text` : 761 tests verts.
- `npm run check` (astro check) : 0 erreur, 0 avertissement, 0 conseil.
- Acceptance : `grep -c sansMarqueurs src/components/Mesure.astro` = 0 ; `grep -rn "set:html" src | wc -l` = 0 ; `:popover-open` présent dans `enfant.css`.
- Le view-model est vérifié sur le corpus fictif corpus-m1 (tests dans `tests/corpus/enfant.test.ts`) : marie-fictive donne `Parti Imaginaire` (def-m-marie-fictive-aide-construction-1, source datée 2026-10-20) puis `loyer` (-2) ; la page logement compte 2 mots, `loyer` avant `Parti Imaginaire`.
- La sortie du CSS minifié a été contrôlée séparément avec `lightningcss` (déjà dans `node_modules`, sans `astro build`) : les deux déclarations `content` et le bloc `@supports not selector(:popover-open)` survivent ; la forme `underline 2px dotted` est celle que le cas de build accepte.

## IMPORTANT : le cas de build n'a PAS été exécuté dans cette vague

`tests/dist/cas/enfant.cas.ts` est écrit mais **n'a jamais tourné** : la vague 4 n'autorise qu'un seul `astro build` (propriétaire : le plan 04-06), donc ni `tests/dist/site.test.ts` ni `astro build` n'ont été lancés ici. Ses assertions (HTML construit de `/themes/logement/`, CSS du dist, `checkDist`) sont à exécuter après fusion avec le plan 04-06, par exemple avec `node --test tests/dist/site.test.ts`. Points les plus susceptibles de demander un ajustement au premier vrai build :
- la forme exacte des sélecteurs minifiés (`.terme:after`, `:not(:has(>.niveaux ...))`) ; le test compacte les espaces et accepte `::after` ou `:after` ;
- le placement de `details.mots-expliques` comme enfant direct de `.lecteur-contenu` (testé via l'arbre HTML) ;
- le caractère précédent/suivant des boutons (testé sur l'arbre, pas sur le HTML brut).

Le module utilise `materialiserCorpusM1(path.join(ctx.tmp(), 'enfant'))` et la clé de build `enfant-production`, sans nettoyage global.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] État ouvert du mot : `:has(+ .definition:popover-open)` au lieu de `[aria-expanded="true"]`**
- **Found during:** Task 2 (CSS)
- **Issue:** `popovertarget` expose `aria-expanded` à l'arbre d'accessibilité, mais n'ajoute aucun attribut au DOM ; le sélecteur du UI-SPEC n'aurait jamais correspondu, donc le fond `--panneau` n'apparaîtrait pas.
- **Fix:** `.terme:has(+ .definition:popover-open) { background: var(--panneau) }` (le popover suit toujours son bouton). Le test `styles.test.ts` verrouille ce sélecteur.
- **Files modified:** src/styles/enfant.css, tests/ui/styles.test.ts
- **Commit:** 0149c1a

**2. [Rule 2 - Correctness] Phrase d'aide de repli masquée hors niveau enfant**
- **Found during:** Task 2 (CSS)
- **Issue:** Le plan ne la liait qu'au `@supports not`, mais « en bas de page » renvoie à une liste qui n'est visible qu'au niveau enfant : la phrase aurait été visible à En bref, En détail et Gros caractères pour renvoyer vers une liste cachée.
- **Fix:** même interrupteur `.lecteur:not(:has(> .niveaux #niv-enfant:checked))` que la liste.
- **Files modified:** src/styles/enfant.css, tests/ui/styles.test.ts
- **Commit:** 0149c1a

**3. [Écart de procédure, voulu par l'orchestrateur] Attributions et tests**
- Trailer de commit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (le plan disait Opus 5.5) ; `slugGlossaire` est ré-exporté comme demandé.
- Tests supplémentaires hors liste du plan : trois tests de view-model sur le corpus corpus-m1 dans `tests/corpus/enfant.test.ts`, pour couvrir le comportement attendu de la page sans lancer le build.

**Total deviations:** 2 corrections (Rule 1, Rule 2), 1 ajustement de procédure. **Impact:** aucun changement de périmètre.

## Auth gates

Aucune.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'entrée réseau, chemin d'authentification ou accès fichier. Menaces du plan : T-04-29 (XSS) traitée par segments JSX et grep `set:html` = 0 ; T-04-30 par la ligne de source des partis ; T-04-31 par le repli `@supports` et la liste ; T-04-32 par l'absence de script, de style en ligne et d'image `data:`.

## Self-Check: PASSED

- Fichiers : `src/lib/corpus/enfant.ts`, `src/components/TexteEnfant.astro`, `src/components/MotsExpliques.astro`, `src/styles/enfant.css`, `tests/corpus/enfant.test.ts`, `tests/dist/cas/enfant.cas.ts` présents.
- Commits : 62d5a77, 66853cc, 0149c1a présents dans l'historique de la branche.
