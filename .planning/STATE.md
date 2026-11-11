---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: "Lot 3 : hébergement et mise en ligne"
status: executing
stopped_at: Completed 09-09-PLAN.md ; waiting for Erwan (09-10, review of the santé theme)
last_updated: "2026-11-11T00:53:59.447Z"
last_activity: "2026-11-11 (09-15 : filtre de production des personnes sans statut relu, comptes honnêtes sur /candidats/ et la Méthode, code check-dist CANDIDAT_NON_RELU_EN_PRODUCTION ; production réelle : aucune personne affichée tant que 09-10 n'a relu aucun statut)"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 38
  completed_plans: 34
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-04)

**Core value:** Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient, chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.
**Current focus:** Phase 6, diagnostic du VPS et décision (en parallèle de la Phase 7)
**Milestone:** v1.1 Lot 3 : hébergement et mise en ligne (Phases 6 à 10)

## Current Position

Phase: 9 of 10 (contenu relu, juridique et ouverture)
Plan: 09-01 à 09-09, 09-14 et 09-15 done (dernier : 09-09, RUNBOOK, ADR-059 à 062, serveur prêt, override OPS-01 accepté) ; reste 09-10 (relecture santé par Erwan, chemin critique), puis 09-11 à 09-13
Status: Executing phase 9
Last activity: 2026-11-11 (09-15 : filtre de production des personnes sans statut relu, comptes honnêtes sur /candidats/ et la Méthode, code check-dist CANDIDAT_NON_RELU_EN_PRODUCTION ; production réelle : aucune personne affichée tant que 09-10 n'a relu aucun statut)

Progress v1.1: [..........] 0/5 phases, 0 plans

## Performance Metrics

**Velocity:**

- Total plans completed: 64 (v1.0)
- v1.1 plans completed: 0

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 7 | - | - |
| 2 | 7 | - | - |
| 4 | 9 | - | - |
| 3 | 9 | - | - |
| 05 | 8 | - | - |
| 07 | 8 | - | - |
| 06 | 1 | - | - |
| 08 | 15 | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: D-1 codes statut du dataset (`declare|primaire|pressenti|empeche|renonce`), `renonce` affiché « Ne se présente pas » + `motif`
- [Init]: D-2 périmètre d'équité = `declare` + `primaire`
- [Init]: D-4 mentions légales éditeur non professionnel (LCEN art. 1-1 II, pas d'adresse perso), à faire valider (Phase 9)
- [Init]: D-5 Node 24 LTS (exception au défaut Node 20 d'Erwan)
- [Roadmap v1.1]: 5 phases (6 à 10) ; Phases 6 et 7 parallélisables ; Phase 8 dépend de la décision VPS et du domaine (piste 0)
- [Roadmap v1.1]: PERF-02 et HEB-07 en Phase 8 (mesure réelle et version servie exigent un hôte déployé) ; DETTE-04 en Phase 9 (audit sur la build mise en ligne)
- [Roadmap v1.1]: critère 4G lu comme « Slow 4G simulé » (Lighthouse), mesure réelle consignée
- [Roadmap v1.1]: déploiement par releases datées + lien `current`, job dans `ci.yml`, build de production reconstruite, jamais d'artefact preview
- [Roadmap v1.1]: dépôt public depuis le 2026-11-04 : réviser l'ADR-051, la preview n'est jamais servie
- [09-05]: page de relecture locale = node:http sur 127.0.0.1 seulement, Host exact, Origin, jeton par lancement ; « Valider » appelle le même `marquer` que la ligne de commande ; un refus répond 409 avec le message, jamais d'écriture
- [09-07]: le bloc public n'arrive sur le serveur que par l'étape site-public (codes 6 et 7) ; après le retrait de l'hôte technique, le marqueur /opt/rtp/essai-retire neutralise site-essai ; le test de restauration déduit ses étapes des blocs restaurés ; favicon.ico généré par scripts/favicon.ts, seul .ico admis par check-dist, servi en no-cache (no-store casse le bfcache)
- [Phase 9]: 09-15 : en production, une personne sans statut relu ou publié est absente (filtre statutAffiche === null dans construireCorpus, CANDIDAT_NON_RELU_EN_PRODUCTION dans check-dist, même définition ADR-041)

### Pending Todos

None yet.

### Blockers/Concerns

- Chemin critique humain (voir « Piste 0 » dans ROADMAP.md) : décision VPS (13 nov.), domaine et DNS (16 nov.), identité d'éditeur à Hetzner (16 nov.), relecture du thème santé (fin 1er déc.), juriste (avis 2 déc.)
- VPS Hetzner saturé (RAM 3,7 Go, disque 90 %) : aucun déploiement avant la décision et le snapshot
- Churn des statuts data.gouv autour du 10-13 déc. 2026 : import par PR relue (Phase 10), gel du 13 au 15
- Jalon spec : lots 1 à 3 avant le 2026-12-15 ; ouverture visée vers le 2026-12-05
- Base légale du droit de réponse (art. 6 IV ou 1-1 LCEN) et régime d'éditeur à vérifier avec un juriste

## Deferred Items

Items acknowledged and deferred at v1.0 close on 2026-11-04 (Erwan: « Fix, then close »):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | 03-HUMAN-UAT.md (relecture éditoriale du corpus, 3 scénarios) | partial |
| uat_gap | 05-HUMAN-UAT.md (critère 4G, parcours d'Erwan, constats S1/S2/S3, relecture) | partial |
| verification_gap | 03-VERIFICATION.md | human_needed |
| verification_gap | 05-VERIFICATION.md | human_needed |
| tech_debt | W9 : Wayback des 3 sources Batho (HTTP 520 puis 429, à relancer), à résoudre avant de publier les mesures concernées (Phase 9) | open |

## Session Continuity

Last session: 2026-11-11T00:53:33.709Z
Stopped at: Completed 09-15-PLAN.md
Resume file: None

## Operator Next Steps

- `/gsd:plan-phase 6` (et `/gsd:plan-phase 7` en parallèle)
