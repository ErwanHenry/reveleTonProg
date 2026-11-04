---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
verified: 2026-11-03T23:00:00Z
status: passed
score: 13/13 requirements verified
overrides_applied: 0
gaps: []
---

# Phase 4 : Vérification

**Objectif :** pages thème et candidat statiques (M1), bascule 4 niveaux sans JS avec mémorisation, ordre alphabétique/aléatoire, niveaux Aîné et Enfant, builds preview vs production, contrôle post-build.
**Statut : passed** (restes : voir « Résiduel »).

## Preuves exécutées par le vérificateur

| Contrôle | Résultat |
|---|---|
| Build corpus-m1 (fixture) production + `check-dist` | 11 pages, 0 erreur (2 avertissements CONTACT_PROVISOIRE, attendus hors déploiement) |
| Build corpus-m1 preview + `check-dist` | 12 pages, 0 erreur (3 avertissements idem) |
| Build corpus réel (`RTP_CONTENT_ROOT=.`) production et preview + `check-dist` | 62 pages, 0 erreur, 0 avertissement (0 thème publié, donc non représentatif) |
| `npm test` | 1533 / 1533 |
| Brouillon piège « Guichet unique départemental » | 0 fichier en production, 2 en preview |
| Badge « brouillon, non relu » | présent en preview, absent en production |
| Sélecteur de niveau | 4 radios `name="niveau"`, CSS `:has()` dans LecteurNiveaux.css, sans JS requis |
| Mémorisation | `rtp:niveau` dans `_astro/niveau.*.js` (script du même site) |
| Ordre aléatoire | `ordre.*.js` utilise `crypto.getRandomValues` ; ordre alphabétique côté HTML |
| Enfant | `popovertarget` + éléments `popover`, liste « Mots expliqués » |
| Aîné | bloc « Ce qui me concerne » présent sur la page candidat |
| Source / archive / signalement | lien Wayback archivé et lien « signaler » sur chaque mesure |
| Scripts/liens tiers en production | aucun |
| `<time>` (M1-12) | présents sur les pages avec contenu |

## Couverture des exigences

| ID | Statut |
|---|---|
| M1-01 à M1-12 | SATISFAITES (code + build + tests ; comportements visuels confirmés par la vérification navigateur de l'orchestrateur du 2026-11-03, 04-09-SUMMARY) |
| QUAL-01 | SATISFAITE (`check-dist` en CI, 22 codes, exercé sur 4 builds) |

Aucune exigence orpheline : toutes les ID de la phase dans REQUIREMENTS.md sont revendiquées par les plans.

## Revue de code

04-REVIEW-FIX.md : 6 constats sur 6 corrigés (WR-01 périmètre/statut via `statutRetenu`, WR-02 ADR-041, WR-03 garde `RTP_DEPLOIEMENT`, WR-04 CI sur corpus réel). Gate verte après correctifs (reconfirmée ici).

## Résiduel (non bloquant)

- Safari et VoiceOver non testés.
- WR-01/WR-02 marqués « requires human verification » dans le fix report : choix `relu` vs `publie` pour les statuts (ADR-041), à relire par Erwan ; changement localisé dans `RELUS` (equite.ts).
- Corpus réel sans thème publié : la phase 4 est prouvée sur le corpus fictif ; le contenu réel relève des phases suivantes.
- Contact provisoire `.invalid` : le job de déploiement (Lot 3) doit définir `RTP_DEPLOIEMENT=1`.
- Défauts supposés A1 à A4 et UI-SPEC 1 à 8 à relire par Erwan (04-09-SUMMARY).

_Verifier : Claude (gsd-verifier)_
