# Phase 10: Import de décembre - Context

**Gathered:** 2026-11-12
**Status:** Ready for research and planning
**Mode:** decisions set by the orchestrator from the roadmap and earlier phases (Erwan said « Oui, prépare » on 2026-11-12 and is busy reviewing the santé theme); every point marked « à confirmer par Erwan » is shown to him with the plans.

<domain>
## Phase Boundary

Les statuts de candidats de décembre entrent dans le dépôt par une pull request relue, sans jamais modifier la production avant relecture d'Erwan. Exigences : IMP-01, IMP-02, IMP-03. Import réel du 10 au 13 décembre 2026, gel des changements du 13 au 15 (échéance du cahier des charges : 2026-12-15).

Hors périmètre : pipeline quotidien et re-import par cron (Lot 5), sondages (Lot 4), relecture des thèmes travail et Europe et monde, relecture des 22 statuts « ne se présente pas » et « pressenti ».

</domain>

<decisions>
## Implementation Decisions

### Ordre et dépendances
- **D-01:** La phase dépend de la Phase 9 pour l'import réel (site ouvert), mais le code (IMP-01, IMP-02, outil de répétition à blanc d'IMP-03) se fait dès maintenant, pendant la relecture d'Erwan. Rien de cette phase ne touche `src/content/**` avant la pull request d'import.

### IMP-01, lectures YAML plafonnées (dette W6 de l'audit v1.0)
- **D-02:** Toute lecture YAML des outils d'import et d'archivage (`scripts/import-datagouv.ts`, `scripts/archive-source.ts`, `scripts/lib/{datagouv,archive,couverture}.ts`, et tout autre appel direct trouvé par la recherche) passe par l'analyseur plafonné de content-core (alias plafonnés, clés en double refusées). Un fichier piégé est refusé avec un message clair, fichier et ligne.
- **D-03:** Un test de dépôt interdit tout nouvel appel direct à `yaml.parse` ou `parseDocument` hors d'une liste blanche courte et motivée (content-core lui-même, l'éditeur de relecture qui travaille sur les positions des nœuds, les lecteurs de configuration s'ils ont déjà leur propre plafond). La recherche établit cette liste à partir du code réel.

### IMP-02, cohérence de l'instantané et piège
- **D-04:** La CI vérifie que l'instantané data.gouv versionné (`data/dataset-datagouv.yaml`, `data/import/`) et les fichiers candidats sont cohérents : même ensemble d'identifiants, mêmes statuts et dates pour les champs que l'import possède. Une incohérence fait échouer `npm test` ou `validate` avec la liste des écarts.
- **D-05:** Un piège (fixture) prouve que « l'import ajoute un candidat déclaré à un thème publié » est détecté : la garde d'équité ou une règle dédiée signale que le thème publié n'a ni mesure ni case de couverture pour ce candidat. La recherche dit ce que le code fait aujourd'hui dans ce cas, avec le filtre de production du plan 09-15 (une personne au statut non relu est absente de la production) : le piège doit couvrir le moment où ce statut est relu.

### IMP-03, répétition à blanc et import réel
- **D-06:** La répétition à blanc (`--dry-run` ou équivalent) n'écrit rien et produit un rapport lisible : nouveaux, retirés, changés (champ par champ), plus les conséquences sur les thèmes publiés (périmètre d'équité, cases manquantes). Le même rapport sert de corps à la pull request.
- **D-07:** L'import réel se fait sur une branche dédiée (`import/statuts-2026-12`) et une pull request relue par Erwan, jamais par un commit direct sur `main`. Les statuts importés arrivent non relus : avec le filtre du plan 09-15, ils n'apparaissent pas en production tant qu'Erwan ne les a pas relus.
- **D-08 (à confirmer par Erwan):** Quand l'import change le statut d'une personne déjà relue et publiée (par exemple un retrait de candidature), le statut repasse « à relire ». La recherche décrit l'effet exact sur le thème publié (la personne sort-elle de la production, la garde d'équité bloque-t-elle la build) et propose la règle la plus sûre ; Erwan tranche avec les plans sous les yeux.
- **D-09 (à confirmer par Erwan):** Le « gel du 13 au 15 décembre » est une règle d'exploitation écrite au RUNBOOK (aucune fusion ni déploiement sauf retrait d'urgence), pas une nouvelle fenêtre dans `scripts/garde-gel.ts`. À revoir si Erwan préfère une garde technique.

### Claude's Discretion
- Découpage en plans et vagues, noms des fonctions et des codes d'erreur, forme exacte du rapport de répétition à blanc.

</decisions>

<constraints>
- Aucun agent ne modifie `src/content/**`, `archives/**`, `data/**` hors de la branche d'import, et la pull request d'import n'est fusionnée que par Erwan ou avec son accord écrit.
- Aucun secret ni donnée personnelle dans le dépôt public. Aucune écriture serveur dans cette phase.
- Node 24 via `fnm exec --using=24` ; aucune nouvelle dépendance npm.
- Un push qui touche le site demande une approbation de déploiement ; vérifier la CI après chaque push.
- La relecture d'Erwan se fait en parallèle sur la branche `relecture/sante` (worktree `../reveleTonProg-relecture`) : ne pas y toucher ; un plan qui modifie des fichiers lus par l'outil de relecture le signale.
- Sous-agents sur Opus ou Sonnet ; exécution un plan à la fois sur `main`.
</constraints>

<canonical_refs>
- `.planning/ROADMAP.md` (Phase 10), `.planning/REQUIREMENTS.md` (IMP-01 à IMP-03)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (W6), `.planning/milestones/v1.0-phases/03-import-data-gouv-et-corpus-pilote/` (plans et SUMMARY de l'import initial)
- `.planning/research/SUMMARY.md`, `PITFALLS.md` (import de décembre)
- `scripts/import-datagouv.ts`, `scripts/lib/datagouv.ts`, `src/lib/dataset-datagouv.ts`, `data/dataset-datagouv.yaml`, `data/import/`
- `src/lib/content-core/load.ts` (analyseur plafonné), `scripts/archive-source.ts`, `scripts/lib/{archive,couverture}.ts`
- `.planning/phases/09-contenu-relu-juridique-et-ouverture/09-15-SUMMARY.md` (filtre de production), `09-06-SUMMARY.md` (publier, retirer), `docs/ARCHITECTURE.md` (ADR-041, ADR-059, ADR-060), `docs/RUNBOOK.md`
</canonical_refs>

<research_resolutions>
Résolutions tirées de `10-RESEARCH.md` (2026-11-12). Celles marquées « défaut » sont les recommandations de la recherche, retenues par l'orchestrateur pour planifier ; Erwan les confirme ou les change en lisant les plans.

- Le jeu en ligne compte déjà 61 lignes contre 59 au dépôt (deux nouveaux, six sources changées sans changement de statut) : la répétition à blanc se fait sur des données réelles, avant l'ouverture.
- IMP-01 : cinq sites d'appel à migrer (`scripts/import-datagouv.ts`, `scripts/archive-source.ts`, `scripts/lib/datagouv.ts`, `scripts/lib/couverture.ts`) vers une enveloppe dans un nouveau fichier `src/lib/content-core/yaml-plafonne.ts` ; `load.ts` n'est pas modifié. Liste blanche du test de dépôt : `load.ts`, `migrate.ts`, `scripts/lib/relecture/editer.ts` et les quatre lecteurs de configuration.
- D-04 précisée : la cohérence porte sur les identifiants, `ids_externes`, le couple (code, motif) du statut le plus récent et le pointeur `data/dataset-datagouv.yaml`. La dérive de source ou de date pour un statut inchangé est une information, pas une erreur.
- La pull request d'import met aussi à jour à la main : `data/dataset-datagouv.yaml`, `ATTRIBUTION.md`, `LICENSE`, et les tests à compteurs en dur.
- D-05 : le comportement protège déjà (erreur `EQUITE_CANDIDAT_MANQUANT` en production dès que le statut est relu, et `marquer statut` restaure le fichier) ; il manque les fixtures qui le prouvent.
- D-08 (défaut B) : l'import ajoute une entrée `brouillon` sans toucher l'ancienne ; la production garde l'ancien statut relu, donc risque d'affichage périmé sans alerte. Règle retenue par défaut : les statuts qui changent pour une personne d'un thème publié sont relus dans la pull request d'import avant fusion ; un avertissement de validateur `STATUT_PLUS_RECENT_NON_RELU` (toujours avertissement) le signale ; le rapport a une section dédiée.
- D-09 (défaut) : règle au RUNBOOK seule, avec une assertion dans `tests/repo/docs.test.ts` ; pas de fenêtre dans `scripts/garde-gel.ts`.
- Ordre de fusion : la relecture santé est fusionnée d'abord ; l'import est lancé ensuite sur un `main` à jour. Si `main` avance, la branche d'import est recréée et l'import relancé, jamais fusionné à la main.
- Le rapport de répétition ne s'arrête pas sur un identifiant inconnu de la table de correspondances : il le liste comme « nouveau, à décider ».
- Questions ouvertes pour Erwan, à poser avec les plans : règle D-08, D-09, décision sur les deux nouveaux du jeu (table de correspondances), fusion de statuts `brouillon` avant leur relecture, conduite à tenir si des nouveaux ne sont pas décidés le 13 décembre au soir.
- Découpage recommandé : vague 1 maintenant (10-01 IMP-01, 10-02 IMP-02), vague 2 avant l'ouverture (10-03 rapport et répétition réelle dans un worktree jetable), vague 3 du 10 au 13 décembre (10-04 import réel, pull request, relecture, fusion).
</research_resolutions>
