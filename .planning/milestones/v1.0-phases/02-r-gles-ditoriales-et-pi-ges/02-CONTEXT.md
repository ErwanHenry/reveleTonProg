# Phase 2: Règles éditoriales et pièges - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Règles d'entrée (par fichier) et de corpus (inter-fichiers) dans `src/lib/content-core/rules/`, appelées par `loadAll` après Ajv, avec codes d'erreur stables, sévérité dépendante du mode (`--mode preview|production`) et annotations GitHub (fichier, ligne, code). Suite de pièges §12 en fixtures `tests/fixtures/pieges/<code>/` (overlay sur `corpus-valide` + `attendu.json`). Livrable Lot 1 : la CI refuse une mesure sans source. Hors périmètre : import réel (Phase 3), pages (Phase 4), page Méthode (Phase 5, mais la config des règles doit être exportable pour la générer).

</domain>

<decisions>
## Implementation Decisions

### Décisions héritées (Phase 1, verrouillées)
- JSON Schema = structure ; les règles éditoriales vivent dans content-core, jamais dans Astro
- Statuts `declare|primaire|pressenti|empeche|renonce` ; périmètre d'équité = `declare` + `primaire` (config)
- Presse autorisée pour statuts seulement, jamais pour une mesure (`SOURCE_NON_PRIMAIRE`)
- Archive : extrait `.txt` + sha256 committés ; règle Phase 2 : `archive.wayback_url` obligatoire pour toute source citée par une mesure `publie`
- Tests : entrées de fixture adressées par id, jamais par index ; Node 24 via fnm ; aucune nouvelle dépendance sans justification

### Règles éditoriales (acceptées par Erwan 2026-11-03)
- Mots interdits : préfixes de lemmes après NFC + minuscules (`extrêm*`/`extrem*`, `populis*`, `irresponsab*`, `courage*`, `enfin` en mot exact), dans les champs éditoriaux (titre, 4 rédactions, résumé de statut), en excluant les spans `« … »` et `texte_source` ; erreur `MOT_INTERDIT`
- Verbes connotés = avertissement `VERBE_CONNOTE` : promet, prétend, ose, assure, affirme, martèle, reconnaît, admet, avoue, se vante (formes conjuguées courantes)
- Chiffres : nombre écrit en chiffres (normalisation espaces fines/insécables, virgule décimale, %, €) absent du `texte_source` ou du chiffrage = erreur `CHIFFRE_HORS_SOURCE` pour résumé, enfant, aîné ; nombre en lettres = avertissement
- Lisibilité : Kandel-Moles (207 − 1,015 × mots/phrase − 73,6 × syllabes/mot) sur la rédaction enfant = avertissement si < 80 ; phrase enfant > 15 mots = erreur pour `publie` (`PHRASE_ENFANT_LONGUE`), avertissement en brouillon
- Longueurs : résumé ≤ 25 mots, détaillé 80-200, enfant 40-60, aîné 60-120 (comptage `Intl.Segmenter` + élisions + groupes de chiffres)
- Citations : chaque `« … »` du détaillé ⊆ `texte_source` ; `texte_source` ⊆ extrait archivé, après normalisation (NFC, apostrophes, espaces, guillemets)

### Corpus et sondages
- `ids.lock` committé : un id de candidat renommé/supprimé = erreur
- Références cassées (candidat, thème, source, glossaire `[[terme]]`) = erreur
- Équité : thème `publie` exige pour chaque candidat du périmètre une mesure `publie` ou un état couverture vérifié ; erreur en production, avertissement en preview
- Garde-fou : `bloc`, `extdroite`, `propositions` interdits dans `src/content/`
- Sondages : notice absente, somme hors 95-105 %, hypothèse tour 2 en tour 1, publication dans fenêtres 17/04/2027 00:00 → 18/04 20:00 et 01/05 00:00 → 02/05 20:00 Europe/Paris = erreurs

### Claude's Discretion
- Organisation interne des fichiers de règles, noms exacts des codes au-delà de ceux listés, format de `attendu.json`
- Heuristique de syllabes française (calibrée et figée en cas de test)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/content-core/load.ts` (`loadAll`, entries, diagnostics avec ligne/colonne), `diagnostics.ts` (`formatText` sécurisé, `--format github` ≤ 10 annotations), `ajv.ts`, `collections.ts`, `root.ts`
- `tests/helpers/validate-yaml.ts` (`expectOk`/`expectErrors`), fixture `tests/fixtures/corpus-valide` (2 candidats, mesure `marie-fictive/encadrement-loyers` déjà conforme aux règles Phase 2, archive `.txt` + sha256)
- Règle existante `ID_CHEMIN_INCOHERENT` (fix WR-03) = modèle de règle d'entrée

### Established Patterns
- Codes diagnostics en MAJUSCULES_FRANÇAIS, messages en français, tri déterministe
- CI : `migrate --check` → `validate` (fixture + racine `.`) → check → test → build

### Integration Points
- `scripts/validate.ts` gagne `--mode preview|production`
- La config des règles (listes, bornes) doit être un module exportable pour la page Méthode (Phase 5)

</code_context>

<specifics>
## Specific Ideas

- Les pièges du §12 : mesure sans source, mot interdit, sondage sans notice, sondage à 112 %, hypothèse 2e tour en 1er tour, rédaction enfant avec chiffre absent, publication en fenêtre de blocage — chacun une fixture

</specifics>

<deferred>
## Deferred Ideas

- Kandel-Moles bloquant après calibrage sur Vikidia (DIFF-01)
- Gel de contenu pendant le silence électoral (lot 5) — les fenêtres sont déjà codées ici

</deferred>
