---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 04
subsystem: institutional-pages
tags: [methode, config-driven, dataset-datagouv]
requires: [05-02]
provides: [methode page, loadDatasetDatagouv, ETAT_VIDE_TEXTES]
affects: [05-06]
key-files:
  created:
    - src/pages/methode.astro
    - data/dataset-datagouv.yaml
    - src/lib/dataset-datagouv.ts
    - tests/corpus/dataset-datagouv.test.ts
    - tests/dist/cas/methode.cas.ts
  modified:
    - src/lib/corpus/vue.ts
    - src/components/EtatVide.astro
    - src/layouts/Base.astro
    - src/styles/pages.css
requirements-completed: [INST-01, INST-04]
completed: 2026-11-03
---

# Phase 5 Plan 04: Page Méthode Summary

/methode/ est générée depuis config.ts (mots interdits, verbes, bornes, Kandel-Moles, périmètre, catalogue, hypothèses), data/couverture-themes.yaml (classement recalculé, thèmes pilotes et livrés lus dans `pilote.themes` / `pilote.livres`), data/dataset-datagouv.yaml (51 annoncés vs 59 lignes calculées depuis l'instantané vérifié par SHA-256), TOURS et PROFIL_4G. Lien « Méthode » dans le pied de page de toutes les pages.

## Commits
- 3b2dadd test(05-04): failing build cases
- 5f26f62 feat(05-04): dataset facts file and strict reader
- (suivant) feat(05-04): Méthode page, ETAT_VIDE_TEXTES, footer link

## Verification
- tests/corpus/dataset-datagouv.test.ts : 8 pass. tests/dist/site.test.ts : 121 pass, 0 fail (methode.cas.ts et tous les cas antérieurs). `npm run check` : 0 error.
- Build du corpus réel en preview : méthode/index.html sans erreur ni avertissement check-dist, 7258 octets gzip.
- Description data.gouv relue le 2026-11-03 : annonce toujours 51 personnes.

## Deviations
- [Rule 3] L'hypothèse A2 cite la syntaxe `[[…]]`, que check-dist refuse dans le texte visible (MARQUEUR_RESIDUEL). La page affiche `[ [` et `] ]` à la place ; la source de config.ts est intacte.
- check-dist sur le corpus réel renvoie 2 erreurs THEME_INATTENDU (themes/sante, themes/travail) : écart entre le contenu Phase 3 et la liste de thèmes attendue (data/couverture-themes.yaml, hors périmètre). Même constat qu'en 05-02. L'exit 0 du critère n'est donc pas atteint sur le corpus réel, mais aucune erreur ne concerne la Méthode.
- Le test du dataset a été écrit avant le lecteur mais n'a pas été exécuté en rouge séparément (module inexistant).

## Known Stubs
None.

## Self-Check: PASSED
