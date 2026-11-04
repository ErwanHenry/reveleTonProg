# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Lots 1 et 2 : squelette, données, référentiel M1

**Shipped:** 2026-11-04
**Phases:** 5 | **Plans:** 40 | **Sessions:** 1 (longue, avec compactions)

### What Was Built
- Socle Astro 7 statique sur Node 24, 8 schémas JSON v1, content-core unique, CI épinglée (gitleaks, Dependabot).
- Moteur de règles éditoriales (41 codes) et les 7 pièges §12 rejoués en CI : livrable du Lot 1.
- Import data.gouv (59 personnalités), archivage des sources (public haché, binaires privés, Wayback), 134 mesures réelles en brouillon sur 3 thèmes pilotes.
- Pages thème et candidat en 4 niveaux sans JS, glossaire en popover, pages Méthode, Mentions légales, Qui sommes-nous.
- Suite navigateur (axe, clavier, 160 %, 320 px, 4G, vie privée), URL de test en artefact CI, test croisé simulé avec journal : livrable du Lot 2.

### What Worked
- Phases 2, 3 et 4 en parallèle sur worktrees, avec une fixture fictive (`corpus-valide`, `corpus-m1`) qui découple les pages du contenu réel.
- Revue des plans avant exécution, puis revue de code et correcteur après chaque phase : CR-01 (sondages attribués à l'Arcom) et WR-06 (rédaction par IA non dite) auraient été publiés sans elles.
- Contenu en lots par exécuteur, notes `NN-LOTS.md`, règle « rien d'inventé » tenue : chaque citation est vérifiée contre l'extrait archivé par la CI.
- Contrôle d'intégration de fin de milestone : a trouvé W1 et W2, deux textes faux en production que les tests par phase ne voyaient pas.

### What Was Inefficient
- CI non surveillée après des pushs de contenu : rouge pendant environ 10 commits (identité git absente sur le runner).
- Reflow 320 px vert en local et rouge en CI : polices Linux plus larges que celles de macOS ; corrigé en imposant une police large dans le test.
- Mac en veille capot fermé : processus figés et faux délais dépassés ; la CI fait foi.
- Agent coupé par une erreur réseau : relance nécessaire, heureusement sans travail perdu.
- Wayback inutilisable pour certains sites (520 puis 429) : trois sources restent sans copie.

### Patterns Established
- Tout test qui fait `git commit` fixe son identité locale ; vérifier la CI après chaque push.
- Les tests de mise en page à 320 px imposent une police large pour reproduire la CI.
- Les textes publics qui dépendent d'un état (hébergeur, écart du jeu de données, thèmes livrés) se calculent depuis cet état, jamais en dur.
- Un seul module pour le périmètre d'équité (`dansPerimetre`), une garde de test contre les copies.
- Le test croisé par agents donne des constats utiles (8) mais ne remplace pas de vrais lecteurs ; garder le journal et le scénario écrits avant les résultats.

### Key Lessons
1. Un critère chiffré sans profil (« < 1 s sur 4G ») doit être précisé avant d'écrire le test : la mesure réaliste (Slow 4G) le contredit.
2. Les pages institutionnelles portent des affirmations juridiques : les faire relire par une revue dédiée avant le juriste.
3. Dire la vérité sur l'outillage : la rédaction assistée par IA est annoncée sur le site.

### Cost Observations
- Model mix: orchestration et revues sur Opus ; exécution, contenu et personas surtout sur Sonnet.
- Sessions: 1
- Notable: le test croisé (6 agents Sonnet) a coûté environ 615 000 jetons pour 8 constats corrigés ou routés.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 5 | Parallélisation sur worktrees, revue de code + correcteur par phase, audit d'intégration avant clôture |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 1659 unitaires + environ 1 250 navigateur | non mesurée | stdlib d'abord (node:test, Intl.Segmenter, zlib, crypto) ; 6 dépendances justifiées |

### Top Lessons (Verified Across Milestones)

1. (à confirmer au v1.1) Vérifier la CI après chaque push.
2. (à confirmer au v1.1) Calculer les textes d'état depuis l'état.
