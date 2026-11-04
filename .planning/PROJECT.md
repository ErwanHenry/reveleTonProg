# reveleTonProg

## What This Is

Site statique pédagogique, neutre et sourcé, qui aide tout public à comprendre les programmes des candidats à l'élection présidentielle française des 18 avril et 2 mai 2027. Chaque mesure existe en quatre niveaux de lecture (résumé, détaillé, enfant, aîné) et renvoie à une source primaire datée et archivée. Les sondages (milestone suivant) sont présentés avec leur marge d'erreur, jamais comme un résultat.

Cahier des charges complet : `docs/spec/CAHIER-DES-CHARGES.md` (source : Claude Doc https://claude.ai/artifact/1FiDU6ykyLw8KTPwf5FUFz).

## Core Value

Un visiteur choisit un thème et lit, en moins de 3 minutes, la position de chaque candidat au niveau de détail qui lui convient — chaque mesure affichée étant rattachée à une source primaire datée, sans jamais prendre parti.

## Current State

**v1.0 livré le 2026-11-04** (Lots 1 et 2 du cahier des charges). Le corpus pilote réel (santé, travail, Europe et monde ; 59 personnalités, 134 mesures en brouillon) est navigable sur l'URL de test : artefact CI `site-preview` ou `node e2e/serveur.ts dist-preview 4173`. Dépôt public depuis le 2026-11-04 ; binaires d'archives dans le dépôt privé `reveleTonProg-archives`. Rien n'est en ligne : la relecture éditoriale d'Erwan et le Lot 3 restent à faire.

## Next Milestone Goals (v1.1, à définir avec `/gsd:new-milestone`)

- Lot 3 : domaine, VPS Hetzner + Caddy, relecture juridique des mentions, hébergeur `actif`, contact réel, déploiement reproductible.
- Relecture éditoriale du corpus pilote et passage en `relu` / `publie`.
- Nouvel import data.gouv (statuts attendus vers le 10-13 décembre 2026).
- Dette reportée de l'audit v1.0 (W3, W4, W6 à W10) et lecture du critère 4G.

## Requirements

### Validated

- ✓ Dépôt Node 24 + Astro 7 statique zéro JS, CI durcie (SHA, gitleaks, Dependabot), schémas JSON 2020-12 v1 pour 8 collections, content-core partagé CLI/Astro, migrations — Validated in Phase 1: Fondations, schémas v1 et content-core (FOND-01..05, DATA-01..08)
- ✓ Règles éditoriales §5 et pièges §12 en CI (source primaire + archive, mots interdits, longueurs, chiffres et citations vérifiés contre l'archive, lisibilité enfant, ids.lock, équité, sondages et fenêtres légales), annotations fichier/ligne/code — Validated in Phase 2: Règles éditoriales et pièges (REGLE-01..12) — livrable Lot 1
- ✓ Référentiel M1 : pages thème et candidat statiques, 4 niveaux sans JS mémorisés, ordre alphabétique/aléatoire, Aîné et Enfant (popovers), preview vs production, check-dist en CI — Validated in Phase 4 (M1-01..12, QUAL-01) — prouvé sur corpus fictif, vérifié en navigateur
- ✓ Pages Méthode (générée depuis la config), Mentions légales, Qui sommes-nous ; suite Playwright, axe, 160 %, 320 px, mouvement réduit, contrastes, vie privée, 4G ; URL de test (artefact CI + preview locale) ; test croisé simulé avec journal — Validated in Phase 5 (INST-01..04, QUAL-02..06) — livrable Lot 2
- ✓ Corpus pilote réel : 59 fiches importées de data.gouv, outil d'archivage (extrait + sha256, binaires privés, Wayback), couverture mesurée sur 37 déclarés × 10 thèmes, 134 mesures en brouillon sur santé / travail / Europe et monde, glossaire — Validated in Phase 3 (CONT-01..06) ; relecture éditoriale d'Erwan en attente

### Active

Prochain milestone (v1.1) à définir : voir « Next Milestone Goals ». Toutes les exigences de v1.0 (lots 1 et 2) sont validées ; détail dans `milestones/v1.0-REQUIREMENTS.md`.

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
- VPS Hetzner `ubuntu-4gb-nbg1-2` saturé (RAM 3,7 Go, disque 90 % en juillet 2026) : décision d'Erwan attendue pour le Lot 3 (libérer ou monter en gamme).
- Brouillons rédigés avec l'aide d'un modèle de langage, relus par Erwan avant publication (dit sur Qui sommes-nous et Méthode).
- Critère « < 1 s sur 4G » : deux profils publiés (latence 150 ms sous 1 s ; Slow 4G Lighthouse sous 1,5 s), lecture à trancher par Erwan.

## Constraints

- **Tech stack** : Astro statique, zéro JS par défaut, pas de framework serveur — imposé par la spec
- **Données** : YAML/JSON dans Git, validés par JSON Schema en CI — pas de BDD
- **Neutralité** : mots interdits (« extrême », « populiste », « irresponsable », « courageux », « enfin »), étiquette revendiquée par le candidat, chiffrage du candidat seulement
- **Sourçage** : source primaire (jamais presse) + date de consultation + copie archivée dans le dépôt
- **Équité** : même niveau de détail pour tous les candidats déclarés sur un thème publié
- **Vie privée** : aucun cookie, aucune donnée demandée au visiteur, aucun script externe (le serveur reçoit l'adresse IP une fois en ligne)
- **Dépendances** : chaque dépendance ajoutée justifiée par écrit dans la PR
- **Secrets** : aucun dans le dépôt ; GitHub Secrets + Vaultwarden
- **Images** : uniquement Wikimedia Commons licence vérifiée, ou aucune

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Présidentielle 2027 (pas 2017) | Spec cible 2027, le « 2017 » du message initial était une coquille | ✓ Good |
| Nom repo `reveleTonProg` | Préférence d'Erwan, remplace le nom de travail « Le Vestiaire des programmes » | ✓ Good (dépôt public le 2026-11-04) |
| Milestone v1.0 = lots 1+2 | Lots 3+ dépendent du domaine/VPS ou sont gros | ✓ Good : livré en 2 jours |
| Bascule de niveau en CSS (radio + `:has()`) + JS d'amélioration | M1 doit marcher sans JS et sans rechargement | ✓ Good ; coût : un script externe bloquant, cause du dépassement en Slow 4G |
| Contenu réel en brouillon, relu par Erwan | Règle « rien d'inventé », relecture humaine obligatoire (palier C) | — Pending : relecture à faire |
| Test croisé simulé par agents, journal livré | Pas de vrais lecteurs disponibles avant le Lot 3 | ⚠ Revisit : utile (8 constats), à compléter par de vrais lecteurs |
| Dépôt d'archives binaires séparé et privé | Données lourdes et parfois personnelles hors du dépôt public | ✓ Good |

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
*Last updated: 2026-11-04 after v1.0 milestone*
