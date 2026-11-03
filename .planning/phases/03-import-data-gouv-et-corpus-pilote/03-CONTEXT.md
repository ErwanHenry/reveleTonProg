# Phase 3: Import data.gouv et corpus pilote - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Script d'import du dataset data.gouv « Candidatures à l'élection présidentielle 2027 — statuts sourcés » (2027etmoi, Licence Ouverte 2.0) en fiches candidats valides ; outil d'archivage des sources ; choix mesuré des 3 thèmes pilotes ; corpus pilote réel en `brouillon` (mesures sourcées ou états de couverture datés) ; glossaire. Bascule de la racine de contenu par défaut de la fixture vers le vrai corpus (`.`). Hors périmètre : pages (Phase 4), publication (`publie` exige la relecture d'Erwan).

</domain>

<decisions>
## Implementation Decisions

### Héritées (Phases 1-2, verrouillées)
- Statuts = codes dataset (`declare|primaire|pressenti|empeche|renonce`, `motif` pour `renonce`), historique `statuts[]` append-only, ids `prenom-nom` ASCII figés + `ids_externes.2027etmoi`, `nom_tri` saisi à la main
- Ne jamais importer `bloc` ni `propositions` ; presse autorisée pour statuts seulement (badge) ; source de mesure = primaire uniquement
- Archives : extrait `.txt` + sha256 dans `archives/` du dépôt public ; binaires hors dépôt public ; plafond 5 Mo
- Équité = `declare` + `primaire` ; tout passe les règles Phase 2

### Choix acceptés par Erwan (2026-11-03)
- Thèmes pilotes : mesurer la couverture en sources primaires des candidats `declare` sur les 10 thèmes de la spec (logement, école, retraites, santé, sécurité, climat, travail, impôts, Europe et monde, institutions) ; retenir les 3 meilleurs ; départage par thèmes prioritaires Aîné ; résultat documenté (table de couverture) pour la page Méthode
- Binaires d'archives : créer le dépôt GitHub privé `ErwanHenry/reveleTonProg-archives` (autorisé) ; le script d'archivage y pousse PDF/HTML rendus, le dépôt public garde `.txt` + sha256 + chemin
- Wayback : soumettre chaque URL source publique à archive.org Save Page Now (autorisé), stocker l'URL retournée dans `archive.wayback_url` ; échec = avertissement, pas blocage
- Rédactions : l'agent rédige les 4 niveaux uniquement à partir du `texte_source` cité, tout en `statut_relecture: brouillon` ; rien n'est publié sans relecture d'Erwan ; « le candidat ne précise pas » plutôt qu'une supposition
- Rien d'inventé : une case sans source primaire trouvée = état couverture `programme_non_publie` ou `non_precise` avec sources consultées et date

### Claude's Discretion
- Outil de capture (Playwright si besoin de rendu JS, sinon fetch), structure du rapport de couverture, ordre de collecte

</decisions>

<code_context>
## Existing Code Insights

- content-core + 8 schémas + règles Phase 2 ; fixture `corpus-valide` comme modèle de fichiers
- `src/lib/content-core/root.ts` : `DEFAULT_CONTENT_ROOT = 'tests/fixtures/corpus-valide'` à basculer vers `.` quand le vrai corpus existe (les tests gardent la fixture explicitement)
- `.npmrc` `ignore-scripts=true` : Playwright navigateurs à installer explicitement si utilisé

</code_context>

<specifics>
## Specific Ideas

- Dataset : https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources, ressource stable https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493 (→ 2027etmoi.fr/data/candidats.json), 59 entrées au 2026-10-28 (description dit 51 : écart documenté)
- Seuls ~6 déclarés ont un lien programme : attendre beaucoup d'états `programme_non_publie`

</specifics>

<deferred>
## Deferred Ideas

- Collecte automatisée cron (lot 5)

</deferred>
