# reveleTonProg

## What This Is

Site statique pédagogique, neutre et sourcé, qui aide tout public à comprendre les programmes des candidats à l'élection présidentielle française des 18 avril et 2 mai 2027. Chaque mesure existe en quatre niveaux de lecture (résumé, détaillé, enfant, aîné) et renvoie à une source primaire datée et archivée. Les sondages (milestone suivant) sont présentés avec leur marge d'erreur, jamais comme un résultat.

Cahier des charges complet : `docs/spec/CAHIER-DES-CHARGES.md` (source : Claude Doc https://claude.ai/artifact/1FiDU6ykyLw8KTPwf5FUFz).

## Core Value

Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient — chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.

## Requirements

### Validated

- ✓ Dépôt Node 24 + Astro 7 statique zéro JS, CI durcie (SHA, gitleaks, Dependabot), schémas JSON 2020-12 v1 pour 8 collections, content-core partagé CLI/Astro, migrations — Validated in Phase 1: Fondations, schémas v1 et content-core (FOND-01..05, DATA-01..08)
- ✓ Règles éditoriales §5 et pièges §12 en CI (source primaire + archive, mots interdits, longueurs, chiffres et citations vérifiés contre l'archive, lisibilité enfant, ids.lock, équité, sondages et fenêtres légales), annotations fichier/ligne/code — Validated in Phase 2: Règles éditoriales et pièges (REGLE-01..12) — livrable Lot 1
- ✓ Référentiel M1 : pages thème et candidat statiques, 4 niveaux sans JS mémorisés, ordre alphabétique/aléatoire, Aîné et Enfant (popovers), preview vs production, check-dist en CI — Validated in Phase 4 (M1-01..12, QUAL-01) — prouvé sur corpus fictif, vérifié en navigateur
- ✓ Corpus pilote réel : 59 fiches importées de data.gouv, outil d'archivage (extrait + sha256, binaires privés, Wayback), couverture mesurée sur 37 déclarés × 10 thèmes, 134 mesures en brouillon sur santé / travail / Europe et monde, glossaire — Validated in Phase 3 (CONT-01..06) ; relecture éditoriale d'Erwan en attente

### Active

Milestone v1.0 = lots 1 et 2 du cahier des charges.

**Lot 1 — squelette et données**
- [ ] Dépôt Astro, schémas JSON (candidats, thèmes, mesures, sondages, journal) versionnés
- [ ] 3 thèmes pilotes et tous les candidats déclarés (jeu data.gouv « statuts sourcés ») avec statut et source datée
- [ ] Validation (JSON Schema + règles éditoriales section 5 : source primaire, mots interdits, longueurs, enfant/aîné obligatoires pour « publié ») en CI GitHub Actions
- [ ] Livrable : la CI refuse une mesure sans source (et les autres pièges de données applicables au lot)

**Lot 2 — référentiel M1 et 4 niveaux**
- [ ] Pages thème et pages candidat, navigation thème→candidat et candidat→thème
- [ ] Bascule entre les 4 niveaux sans rechargement, choix mémorisé (localStorage), fonctionnement sans JS
- [ ] Ordre des candidats alphabétique par défaut, aléatoire sur demande, jamais par sondage
- [ ] Chaque mesure affiche sa source primaire datée ; case vide = « non précisé » / « programme non publié à ce jour »
- [ ] Niveau Aîné : police plus grande, filtre « ce qui me concerne » ; niveau Enfant : mots soulignés avec définition
- [ ] Pages Méthode, Mentions légales, Qui sommes-nous (neutres, sans branding tiers)
- [ ] Performance : < 500 Ko par page, < 1 s sur 4G ; accessibilité de base (ARIA sur bascules, clavier, AA)
- [ ] Livrable : corpus pilote navigable sur une URL de test (local/preview au minimum)

### Out of Scope

- Hébergement Caddy + domaine (lot 3) — dépend de l'achat du domaine et de la décision VPS d'Erwan ; milestone v1.1
- Sondages M2 (lot 4), pipeline quotidien + journal M5 (lot 5), pièces/audio/jeu M3/comparateur M4 (lot 6), votes M6 (lot 7) — milestones suivants
- Commentaires, comptes, newsletter, app mobile, version anglaise — hors v1 du cahier des charges
- Toute base de données ou backend — ADR-001, contenu en Git
- Rédiger du contenu non sourcé — règle éditoriale absolue ; un trou reste « non précisé »

## Context

- Date de démarrage : 2026-11-03. Premier tour 18 avril 2027, second tour 2 mai 2027.
- Jalon spec : lots 1 à 3 avant le 15 décembre 2026.
- Candidats : la campagne est encore précoce ; beaucoup de personnalités n'ont pas de programme publié → fiches avec « programme non publié à ce jour ».
- Contenu pilote réel, collecté par agent sur sources primaires, en statut `brouillon` : Erwan relit avant passage en `publie`.
- Sources de référence : data.gouv (statuts sourcés, Repère 2027, 2027etmoi), Conseil constitutionnel, Commission des sondages, sites officiels des candidats.
- VPS Hetzner `ubuntu-4gb-nbg1-2` saturé (RAM 3,7 Go, disque 90 % en juillet 2026) — décision d'Erwan attendue au lot 2 (libérer ou monter en gamme).

## Constraints

- **Tech stack** : Astro statique, zéro JS par défaut, pas de framework serveur — imposé par la spec
- **Données** : YAML/JSON dans Git, validés par JSON Schema en CI — pas de BDD
- **Neutralité** : mots interdits (« extrême », « populiste », « irresponsable », « courageux », « enfin »), étiquette revendiquée par le candidat, chiffrage du candidat seulement
- **Sourçage** : source primaire (jamais presse) + date de consultation + copie archivée dans le dépôt
- **Équité** : même niveau de détail pour tous les candidats déclarés sur un thème publié
- **Vie privée** : aucun cookie tiers, aucune donnée personnelle, aucun script externe
- **Dépendances** : chaque dépendance ajoutée justifiée par écrit dans la PR
- **Secrets** : aucun dans le dépôt ; GitHub Secrets + Vaultwarden
- **Images** : uniquement Wikimedia Commons licence vérifiée, ou aucune

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Présidentielle 2027 (pas 2017) | Spec cible 2027, le « 2017 » du message initial était une coquille | — Pending |
| Nom repo `reveleTonProg` | Préférence d'Erwan, remplace le nom de travail « Le Vestiaire des programmes » | — Pending |
| Milestone v1.0 = lots 1+2 | Lots 3+ dépendent du domaine/VPS ou sont gros | — Pending |
| Bascule de niveau en CSS (radio + `:has()`) + JS d'amélioration | M1 doit marcher sans JS et sans rechargement | — Pending |
| Contenu réel en brouillon, relu par Erwan | Règle « rien d'inventé », relecture humaine obligatoire (palier C) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-03 after Phase 3 (all of 1-4 complete)*
