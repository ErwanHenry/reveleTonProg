---
phase: 06-diagnostic-du-vps-et-d-cision
verified: 2026-11-08
status: passed
score: 4/4 success criteria
---

# Phase 6 Verification

| # | Critère (ROADMAP) | Preuve | Statut |
|---|---|---|---|
| 1 | Script versionné en lecture seule, rapport chiffré sans modification de la machine | `ops/diagnostic-vps.sh` ; `tests/repo/diagnostic-vps.test.ts` (liste blanche, aucune redirection hors `/dev/null`) ; deux relevés (2026-11-06, 2026-11-08), code de sortie 0 ; `06-RAPPORT-VPS.md` | passed |
| 2 | Recommandation et décision écrite d'Erwan dans le dépôt | `06-RAPPORT-VPS.md`, sections « Recommandation » et « Décision d'Erwan » (garder l'instance, 2026-11-07) | passed |
| 3 | Instantané antérieur à toute modification | Déclaré par Erwan le 2026-11-08 ; aucune commande modifiant la machine n'a été lancée (seul le script en lecture seule a tourné) | passed (déclaratif : l'instantané n'est pas visible depuis la machine) |
| 4 | Marge disque d'au moins 30 %, mesurée et consignée | 42 % libres sur `/` aux deux relevés | passed |

Exigences : HEB-03 satisfaite, HEB-04 satisfaite.

Point de vigilance pour la Phase 8 : RAM disponible environ 1,2 Go et swap utilisé à plus de 1 Go ; le site n'ajoute aucun processus. Caddy tourne dans un conteneur Docker : le montage du dossier du site impose de recréer ce conteneur une fois (moment à choisir avec Erwan).
