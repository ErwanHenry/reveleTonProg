---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 09
subsystem: ci-docs-integration
tags: [ci, check-dist, integration, adr, docs]
requires: ["04-07", "04-08"]
provides:
  - "npm run check-dist et étape CI juste après le build"
  - "Cas d'intégration inter-tranches sur corpus-m1 (production et preview)"
  - "ADR-034 à ADR-040, README et RUNBOOK à jour"
affects: [ci, docs]
key-files:
  created: [tests/dist/cas/integration.cas.ts]
  modified: [package.json, .github/workflows/ci.yml, tests/repo/ci.test.ts, tests/repo/scaffold.test.ts, README.md, docs/RUNBOOK.md, docs/ARCHITECTURE.md, tests/repo/docs.test.ts]
requirements-completed: [QUAL-01, M1-02, M1-09]
duration: ~20 min
completed: 2026-11-03
---

# Phase 4 Plan 09 : Intégration, CI check-dist et documentation

Le contrôle post-build `check-dist` est dans la CI, les tranches de la phase 4 sont prouvées ensemble sur le corpus fictif `corpus-m1`, et les décisions de la phase sont consignées en ADR.

## Tâches

| Tâche | Commit | Contenu |
|---|---|---|
| 1 | a61474c | script `check-dist`, étape CI après `npm run build` (sans `RTP_MODE`, aucun `uses:` modifié), `ci.test.ts` et `scaffold.test.ts` étendus, `integration.cas.ts` |
| 2 | 9ae3ed8 | README, RUNBOOK (tableau des 22 codes, limites, preview), ARCHITECTURE (diagramme, ADR-034 à 040), `docs.test.ts` |
| 3 | n/a | Point de contrôle navigateur, résolu par l'orchestrateur (voir plus bas) |

## Cas d'intégration

Réutilisent les clés de build `m1-production` et `m1-preview` (aucun build supplémentaire) : page candidat (sélecteur de niveau + script niveau, « Ce qui me concerne » en premier avec un seul lien `#logement`, popover enfant, « Mots expliqués (2) »), contrôle d'ordre caché sur `/candidats/` et `/themes/logement/`, hall sans bloc Gros caractères, au plus une mesure par cellule, et sur chaque page des deux builds : un `h1`, `lang="fr"`, date de mise à jour, `noindex` absent en production, bandeau en preview, `checkDist` sans erreur.

Pages les plus lourdes (production, HTML + ressources liées) :
1. `themes/logement/index.html` : 30 849 octets bruts, 9 633 gzip
2. `candidats/marie-fictive/index.html` : 30 080 bruts, 8 783 gzip
3. `themes/climat/index.html` : 25 297 bruts, 7 987 gzip

Très loin des limites (500 000 bruts, 100 000 gzip).

## Gate complète (worktree, Node 24)

| Commande | Résultat |
|---|---|
| `migrate --check` (fixture) | vert, 10 fichiers |
| `migrate --check` (racine `.`) | vert, 141 fichiers |
| `validate --mode production` (fixture, défaut) | vert, 0 erreur |
| `validate --mode production` (racine `.`) | vert, 141 fichiers, 0 erreur, 0 avertissement |
| `ids --check` (racine `.`) | vert, 59 candidats verrouillés |
| `npm run check` | 0 erreur, 0 avertissement, 0 hint |
| `npm test` | 1516 / 1516 |
| `build` + `check-dist` (défaut, fixture) | vert, 6 pages, 0 erreur |
| `build` + `check-dist` (`RTP_CONTENT_ROOT=.`, production) | vert, 62 pages, 0 erreur |
| `build` + `check-dist` (`RTP_CONTENT_ROOT=.`, preview) | vert, 62 pages, 0 erreur |

Le corpus réel ne contient encore aucun thème publié (0 thème attendu) : il est donc vert mais pas encore représentatif.

## Décisions

- ADR numérotés à partir de la dernière ADR présente (033) : ADR-034 « cartes à structure fixe, pas à hauteur fixe » (statut décidé) à ADR-040.
- Sur une page sans mesure publiée, `Base.astro` affiche « Aucun contenu publié pour le moment. » au lieu d'une date : le cas d'intégration l'accepte explicitement, sinon il exige un `<time datetime>`.

## Vérification navigateur (orchestrateur)

Le point de contrôle humain de la tâche 3 a été résolu par l'orchestrateur, qui a ouvert le site de prévisualisation (corpus-m1, `RTP_MODE=preview`) dans un vrai navigateur le 2026-11-03 au nom d'Erwan. Observé : hall avec bandeau de prévisualisation et sélecteur à 4 niveaux ; page thème logement avec ligne de couverture, cartes à structure fixe, état vide typé « Programme non publié à ce jour. Vérifié le 21 octobre 2026. », pastille brouillon ; au niveau « Pour les enfants », termes soulignés en pointillé avec marqueur « ? », popover au clic avec la définition et « Définition donnée par … 20 octobre 2026 », fermeture par Échap ; le rechargement restaure le niveau (`rtp:niveau` = enfant) ; page `marie-fictive` à 375 px en « Gros caractères » : texte ≥ 20 px, aucun défilement horizontal, bloc « Ce qui me concerne » en premier ; seuls des scripts du même site (`/_astro/ordre.*.js`, `/_astro/niveau.*.js`) ; les 8 URL externes sont des liens `<a rel="noopener noreferrer">`, aucune ressource tierce chargée. Aucun défaut relevé. Non testés : Safari, VoiceOver, ordre aléatoire sur 5 rechargements (couverts par tests automatisés, voir cas `ordre`).

## Note ADR M1-08 (information, déjà décidé)

« Taille fixe » = structure fixe (une mesure plus « N autres mesures », largeurs et rangées alignées, hauteur variable), pour l'accessibilité à 160 % de zoom et en Gros caractères. Consigné en ADR-034, décidé par l'orchestrateur à la demande d'Erwan. Aucune réponse attendue.

## Défauts supposés, à relire par Erwan

- A1 : statut affiché en production = dernière entrée relue, sinon « Statut en cours de vérification ».
- A2 : cartes seulement pour `declare` et `primaire`, `renonce` dans la section repliée, les autres comptés sur une ligne.
- A3 : textes des badges « brouillon, non relu » et « relu, pas encore publié ».
- A4 : copie archivée = Wayback + lien vers l'extrait sha256 sur GitHub (404 tant que le dépôt n'est pas public).
- Défauts UI-SPEC 1 à 8 : palette, tailles, style du sélecteur, sélecteur non collant, popover sans bouton de fermeture, nom du site, libellés de statut, thème clair uniquement.
- Ajouts de texte : libellés des motifs, « N autres personnalités du jeu de données ne figurent pas ici », suites proposées pour une liste vide, phrase de niveau manquant, pied de page sans date.

## Deviations from Plan

- **Trailer de commit** : « Co-Authored-By: Claude Sonnet 5.5 » (modèle réel) au lieu de « Claude Opus 5.5 » du plan, sur instruction de l'orchestrateur.
- **Cas d'intégration, page sans contenu** [Rule 1] : la première version exigeait un `<time>` partout, ce qui échouait sur `candidats/nina-pressentie` (aucune mesure publiée, texte « Aucun contenu publié pour le moment. »). Assertion corrigée avant le premier commit.
- Le message du commit a61474c et 9ae3ed8 ne mentionne pas ce détail ; `integration.cas.ts` est entièrement dans a61474c.

Aucun package ajouté, `package-lock.json` intact, aucun `uses:` modifié, aucun fichier de 03-05 touché. STATE.md, ROADMAP.md et REQUIREMENTS.md volontairement non modifiés (consigne de l'orchestrateur).

## Known Stubs

Aucun.

## Self-Check: PASSED

Fichiers et commits a61474c, 9ae3ed8 présents.
