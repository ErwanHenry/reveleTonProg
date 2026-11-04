---
phase: 03-import-data-gouv-et-corpus-pilote
verified: 2026-11-04T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Relecture éditoriale par Erwan des 134 mesures brouillon, des 3 fichiers de couverture et du choix des thèmes (sante, travail, europe-et-monde)"
    expected: "Neutralité, fidélité des rédactions, états de couverture exacts ; passage de statut_relecture à relu / pilote.relecture_ouverte à true"
    why_human: "Relecture humaine voulue par conception (tout est brouillon, relecture_ouverte false) ; attendue, pas un écart"
  - test: "Corriger ou accepter les 17 avertissements LISIBILITE_ENFANT_FAIBLE (Kandel-Moles < 80) avant toute publication"
    expected: "Rédactions enfant plus lisibles ; le seuil bloque à statut publie"
    why_human: "Avertissements seulement en brouillon ; jugement éditorial"
  - test: "9 sources sans wayback_url : relancer la soumission Wayback"
    expected: "wayback_url renseigné"
    why_human: "Soumission Wayback non bloquante par conception"
---

# Phase 3 : verification

**Objectif :** 59 fiches candidats sourcées (data.gouv), outil d'archivage, choix mesuré de 3 thèmes pilotes, corpus pilote réel en brouillon (mesures sourcées ou couverture datée), glossaire, bascule de la racine. Rien d'inventé.
**Statut :** human_needed (tout est vérifié automatiquement ; seule la relecture éditoriale attendue reste)

## Vérités observables (critères ROADMAP)

| # | Vérité | Statut | Preuve |
|---|---|---|---|
| 1 | Import : instantané + sha256 + date, bloc/propositions écartés, statuts mappés, diff, rerun sans diff | VERIFIED | `data/import/2027etmoi-...9f2fbc7930c0.json` + `.meta.json` ; `npm run import:datagouv` : « 59 ligne(s), 0 créé, 0 statut ajouté, 59 inchangé, 0 conflit » ; git status propre après ; aucun `bloc`/`propositions` dans `src/` |
| 2 | 59 fiches valides, nom_tri, statut daté/sourcé, attribution LO | VERIFIED | 59 fichiers `src/content/candidats` ; `ids --check` : 59 candidats, 59 verrouillés ; `data/import/ATTRIBUTION.md` ; validate 0 erreur |
| 3 | Archivage : extrait .txt + sha256, binaire hors dépôt public, Wayback, validateur accepte | VERIFIED | `scripts/archive-source.ts` ; 104 sources ; sha256 de chaque extrait recalculé = valeur déclarée (0 écart) ; seul fichier non .txt versionné dans `archives/` = README.md ; `binaire_sha256` présent ; 95/104 avec `wayback_url` (9 sans, non bloquant) |
| 4 | 3 thèmes choisis par couverture mesurée, documentée ; chaque candidat declare/primaire a mesures brouillon ou état couverture daté | VERIFIED | `couverture-scan --check-data` : 37 candidats × 10 thèmes, retenus sante/travail/europe-et-monde (règle de marge, comparée au top 3 littéral) ; `docs/COUVERTURE-THEMES.md` ; 3 fichiers `src/content/couverture` de 37 cases chacun (73 mesures, 17 non_precise avec sources_consultees obligatoires par schéma, 21 programme_non_publie), tous datés 2026-11-03 ; cohérence recalculée : aucune case « mesures » sans mesure, aucune mesure hors case « mesures » |
| 5 | Glossaire résout chaque terme/parti des rédactions enfant, vérifié en CI | VERIFIED | `src/content/glossaire/*.yaml` ; validate : 391 fichiers, 0 erreur ; tests 1598/1598 |

Bascule de la racine : `validate` s'exécute par défaut en « racine . , mode production » (391 fichiers).

## Contrôles indépendants

- `npm run validate` : exit 0, 0 erreur, 17 avertissements (lisibilité enfant, brouillon).
- `npm test` : 1598 pass, 0 fail. `ids --check` OK. `couverture --check-data` OK.
- `pilote.themes == pilote.livres == [sante, travail, europe-et-monde]` (`data/couverture-themes.yaml`), `derogation: null`, `relecture_ouverte: false`.
- 134 mesures, toutes `statut_relecture: brouillon`.
- Citations : les 134 `texte_source` (pas seulement 10) retrouvés mot pour mot (espaces/apostrophes normalisés, `[…]` autorisé) dans l'extrait archivé : 134/134, 0 échec.
- Lecture manuelle de 4 rédactions (Attal climatisation, Collovati AME, Ruffin indexation, Retailleau zéro cotisation) : aucun fait ajouté ; les limites (« le texte ne dit pas… ») sont signalées ; chiffres identiques à la citation.
- Sources : types programme / site_candidat / site_parti uniquement (primaires).

## Exigences

| ID | Statut |
|---|---|
| CONT-01 | SATISFIED |
| CONT-02 | SATISFIED |
| CONT-03 | SATISFIED |
| CONT-04 | SATISFIED |
| CONT-05 | SATISFIED |
| CONT-06 | SATISFIED |

Aucune exigence orpheline : les ID CONT-01..06 des PLAN (03-01 à 03-04 notamment) couvrent REQUIREMENTS.md.

## Anti-patterns

Aucun TBD/FIXME/XXX bloquant observé ; les 17 avertissements de lisibilité sont informatifs.

## Remarques

- Case `programme_non_publie` : pas de champ source dans le schéma (l'absence n'a pas de source) ; les notes et URL consultées sont dans `data/couverture-themes.yaml`. Compatible avec « état daté ».
- Les thèmes sont sante/travail/europe-et-monde (et non les provisoires institutions/impots/retraites du ROADMAP) : décision documentée.
- La case 03-09 du ROADMAP reste non cochée : à régler par l'orchestrateur. `03-REVIEW.md` non suivi par git.

## Écarts

Aucun.
