# Milestones

## v1.0 Lots 1 et 2 : squelette, données, référentiel M1 (Shipped: 2026-11-04)

**Phases completed:** 5 phases, 40 plans
**Timeline:** 2026-11-03 → 2026-11-04, 304 commits, environ 24 000 lignes de code et de tests (TypeScript, Astro, CSS)
**Audit:** tech_debt, 53/53 exigences, aucun bloqueur (`milestones/v1.0-MILESTONE-AUDIT.md`)

**Key accomplishments:**

- Socle Node 24 + Astro 7 statique, CI épinglée par SHA (gitleaks sur tout l'historique, Dependabot), 8 schémas JSON v1 et un content-core unique pour la validation, les identifiants, le build et le contrôle post-build.
- Moteur de règles éditoriales à trois niveaux (41 codes stables) : la CI refuse une mesure sans source, un mot interdit, un chiffre ou une citation absents de l'archive, un thème inéquitable et les 7 pièges §12 (livrable du Lot 1).
- Import data.gouv (59 personnalités, statuts sourcés en ajout seul), outil d'archivage (extrait public haché, binaire dans un dépôt privé, Wayback), relevé de couverture 37 x 10 et 3 thèmes pilotes réels : 134 mesures en brouillon, citées mot pour mot.
- Pages thème et candidat en 4 niveaux de lecture sans JavaScript (radios + `:has()`), glossaire en popover natif, ordre alphabétique ou aléatoire, états vides typés et datés, modes preview et production.
- Pages Méthode (générée depuis la configuration), Mentions légales (LCEN art. 1-1) et Qui sommes-nous ; suite Playwright, axe WCAG 2.2 AA, 160 %, 320 px, mouvement réduit, contrastes, vie privée et 4G (environ 1 250 tests).
- URL de test : artefact CI `site-preview` et preview locale gzip ; test croisé simulé (enfant, retraité, journaliste) avec journal d'audit, verdict « prêt pour la relecture du Lot 2 » (livrable du Lot 2).

**Known deferred items at close:** 5 (see STATE.md Deferred Items) : relecture éditoriale (phase 3), décisions d'Erwan de la phase 5 (critère 4G, parcours, constats S1 à S3), Wayback des 3 sources Batho.

---
