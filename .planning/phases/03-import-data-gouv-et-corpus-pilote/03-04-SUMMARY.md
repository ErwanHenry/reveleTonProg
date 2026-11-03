---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 04
subsystem: corpus
tags: [couverture, sources, archives, wayback, classement, node-test, yaml]
requires:
  - phase: 03-01
    provides: 59 fiches candidats, périmètre declare/primaire (37 lignes)
  - phase: 03-02
    provides: scripts/archive-source.ts (archivage, empreinte, copie Wayback, dépôt privé)
  - phase: 03-03
    provides: scripts/lib/couverture.ts (THEMES_SPEC, lireCouverture, classer), couverture-scan.ts
provides:
  - data/couverture-themes.yaml (37 candidats x 10 thèmes, cases notées, accès, adresses bloquées)
  - docs/COUVERTURE-THEMES.md (méthode, limites, tableau, comptage, règle, résultat côte à côte)
  - 82 sources archivées (extrait + sha256 publics, binaire dans le dépôt privé), dont 64 avec copie Wayback
  - tests/corpus/couverture-themes.test.ts (test sur les données réelles)
affects: [03-05, 03-06, 03-07, 03-08, 03-09, phase-05-methode]
tech-stack:
  added: []
  patterns: [mesure en 3 lots avec journal LOTS.md, tableau et document générés depuis le YAML, lecture en direct avant archivage]
key-files:
  created:
    - data/couverture-themes.yaml
    - docs/COUVERTURE-THEMES.md
    - tests/corpus/couverture-themes.test.ts
    - .planning/phases/03-import-data-gouv-et-corpus-pilote/03-04-LOTS.md
    - src/content/sources/*.yaml (82 sources)
    - archives/<candidat>/*.txt (82 extraits)
  modified: []
key-decisions:
  - "Le classement mesuré (marge) retient santé, travail, Europe et monde : il diffère de la liste provisoire (institutions, impôts, retraites) et reste fragile, décision au checkpoint du plan 03-05"
  - "Un document dont le pied de page publie des données de particuliers n'est pas conservé (Rohou, page d'équipe de Mikolajczak) : protocole §8 étape 4"
  - "« Défense » étant un mot-clé du thème sécurité, un candidat qui publie sa politique de défense a une position sur sécurité même sans police ni justice"
requirements-completed: [CONT-04, CONT-03]
duration: ~85min (lot 3)
completed: 2026-11-03
---

# Phase 3 Plan 04: Couverture mesurée des 10 thèmes (37 candidats) Summary

**Tableau de couverture 37 x 10 mesuré en direct sur 82 documents de programme archivés (64 avec copie Wayback), classé par la règle de la marge : santé, travail, Europe et monde, qui n'est pas la liste provisoire (institutions, impôts, retraites).**

## Performance

- **Duration:** ~85 min pour le lot 3 (les lots 1 et 2 ont eu leurs propres exécutions)
- **Tasks:** 3/3 (un lot par exécution)
- **Files modified:** 1 tableau, 1 document, 1 test, 82 sources et 82 extraits sur les trois lots, LOTS.md, ce fichier

## Accomplishments

- 37 lignes, 370 cases, chacune avec une note d'une ligne ; 82 sources (15 + 22 + 45) attribuées aux candidats, aucun hôte de presse ni d'agrégateur.
- `choix` et `top3Litteral` recalculés par `classer`, jamais saisis : `docs/COUVERTURE-THEMES.md` les montre côte à côte avec la liste provisoire.
- Test sur les données réelles (`tests/corpus/couverture-themes.test.ts`) : 37 lignes = périmètre calculé depuis les fiches, cases complètes, sources attribuées et vérifiées par sha256, définitions de `acces`, choix recalculé, document à jour.
- Accès sur 37 lignes : 26 `ok`, 2 `partiel` (Mélenchon, Tondelier), 3 `bloque` (Batho, Durif, et Rohou pour données personnelles), 6 `aucun_site` (Asselineau, Bertrand, Billetdoux, Le Pen, Markovic, Platret).

## Task Commits

1. **Task 1 : candidats 1-12** - `0672303` (data)
2. **Task 2 : candidats 13-25** - `e4178e6` (data)
3. **Task 3 : candidats 26-37, Wayback, classement, documentation, test** - le commit `data(03-04): couverture mesurée complète, classement et documentation` qui contient ce fichier

## Classement final (37 candidats, mesure du 2026-11-03)

| Rang | Thème | Positions | ● | ◐ | ○ | × | — | Aîné |
|---:|---|---:|---:|---:|---:|---:|---:|:-:|
| 1 | Travail | 25 | 20 | 5 | 3 | 6 | 3 | |
| 2 | Europe et monde | 25 | 20 | 5 | 3 | 6 | 3 | |
| 3 | Santé | 25 | 14 | 11 | 3 | 6 | 3 | oui |
| 4 | Institutions | 24 | 20 | 4 | 4 | 6 | 3 | |
| 5 | École | 24 | 17 | 7 | 4 | 6 | 3 | |
| 6 | Climat | 23 | 16 | 7 | 5 | 6 | 3 | |
| 7 | Impôts | 22 | 19 | 3 | 6 | 6 | 3 | |
| 8 | Sécurité | 22 | 18 | 4 | 6 | 6 | 3 | |
| 9 | Logement | 20 | 12 | 8 | 8 | 6 | 3 | oui |
| 10 | Retraites | 20 | 12 | 8 | 8 | 6 | 3 | oui |

| Règle | Résultat | Égal à la liste provisoire (institutions, impôts, retraites) ? |
|---|---|---|
| `choix` (marge de 2, priorité Aîné) | santé, travail, Europe et monde | non (aucun thème en commun) |
| `top3Litteral` (tri simple) | travail, Europe et monde, santé | non (mêmes trois thèmes que `choix`, autre ordre) |

`pilote.themes` reste `[]` et `relecture_ouverte` reste `false` (plan 03-05). `--check-data` sort 0 : `pilote.themes` vide, aucune dérogation à contrôler.

**Fragilité (calculée avec `classer`).** Les dix thèmes sont séparés par 5 positions seulement. Sans la ligne Zemmour (tracts, voir ci-dessous), le trio devient santé, travail, institutions ; en ne comptant que les cases « fort », travail, Europe et monde, institutions ; avec la lecture de Rohou réintégrée, inchangé. Retraites est neuvième ou dixième dans les quatre cas ; impôts du quatrième au huitième rang ; institutions quatrième en base. Travail est le seul thème présent dans tous les trios.

## Adresses à capturer à la main (entrée du plan 03-05)

| Candidat | accès | adresses | cause |
|---|---|---|---|
| Delphine Batho | bloque | `https://www.delphinebatho.fr/`, `https://generationecologie.fr/` | HTTP 403 |
| Sylvain Durif | bloque | `https://durif2027.com/le-projet` | page rendue côté navigateur ; authenticité à confirmer (opération « Ministère du Cringe ») |
| Jean-Luc Mélenchon | partiel | `https://melenchon2027.fr/programme2025/livre/` | redirige vers l'accueil, livre non lisible en ligne |
| Marine Tondelier | partiel | `https://marinetondelier.fr/le-programme`, `https://lesecologistes.fr/pages/6ImK65GKUnvibm33WGkjkj/projet-2027` | HTTP 403 (contrôle anti-robot) ; programme de 557 mesures |
| Erwan Rohou | bloque | `https://www.les-ecologistes-mei.org/notre-programme` | page lisible mais non conservable (coordonnées de particuliers dans le pied de page) : capture expurgée |

## Cases qui changent par rapport à l'estimation de recherche

178 cases sur 370 (lot 1 : 46 sur 120 ; lot 2 : 71 sur 130 ; lot 3 : 61 sur 120). Le détail par candidat est dans LOTS.md. Les causes : documents que la recherche n'avait pas lus (cahiers, livrets, fiches), règle « 3 énoncés = fort » appliquée à des textes lus en entier, passage à `inaccessible` pour les sites bloqués (Batho, Durif, Rohou), passage à `aucun` pour les candidats dont tous les documents sont d'élections précédentes (Le Pen, Markovic), passage de `aucun` à des cases lues pour Zemmour (deux tracts) et Labib, Lalanne.

## Wayback

Une passe unique `--wayback-missing`, arrêtée au plafond de 45 minutes : **64 copies obtenues sur 82 sources**, 1 échec (`bruno-retailleau-manifeste-peuple-souverain`, HTTP 429 plafond quotidien par URL), 17 non tentées (Tondelier santé reproductive et solitude, Polony x2, Dupont-Aignan x2, Arthaud, Becht x7, Glucksmann x2, Labib). Relance : `fnm exec --using=24 node scripts/archive-source.ts --wayback-missing`. Les plans de thème la refont avant publication (`ARCHIVE_WAYBACK_ABSENTE` n'est bloquant qu'en `publie`).

## Sources dont la date de publication est le mois de capture

31 sources sur 82 (6 + 14 + 11), listées par lot dans LOTS.md. Lot 3 : bruno-retailleau-projet-index, bruno-retailleau-livret-electricite, edouard-philippe-priorite-securite, -enfants, -prosperite, -conquerante, fabien-roussel-vivre-campagne, francois-ruffin-statut-travailleurs-essentiels, manolo-mlekuz-programme, natacha-polony-ma-vision, natacha-polony-mes-principes.

## Decisions Made

- Retirer du dépôt, avant le commit, les documents qui publient des données de particuliers : programme du Mouvement écologiste indépendant (adresse, téléphone mobile, e-mails privés) et page d'équipe de campagne d'Équinoxe (noms, âges, métiers, villes). Source, extrait et binaire privé supprimés ; lignes recalculées sur ce qui reste (Rohou `bloque`, Mikolajczak sur tract et manifeste).
- Traiter « défense » comme relevant du thème sécurité (c'est un mot-clé du thème) : Roussel et Retailleau y gagnent une position.
- Compter une ligne qui contient trois engagements pour trois énoncés ; compter ensemble les énoncés dispersés dans plusieurs documents d'un même candidat quand ils portent sur le thème lui-même (Tondelier logement), pas quand ils sont rattachés à un autre thème (Ruffin santé).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Données personnelles] Rohou et Mikolajczak : documents non conservés**
- **Found during:** Task 3, grep du protocole §8 étape 4
- **Issue:** le pied de page du programme du MEI contient une adresse postale, un mobile et deux e-mails de particuliers ; la page d'Équinoxe liste l'identité, l'âge, le métier et la ville d'une quinzaine de membres de l'équipe.
- **Fix:** sources, extraits et binaires privés supprimés ; Rohou passé à `bloque` (10 cases `inaccessible`) avec ma lecture en direct consignée dans LOTS.md pour mémoire ; Mikolajczak classé sur le tract et le manifeste ; une copie Wayback de la page d'équipe avait déjà été faite avant la suppression.
- **Files modified:** `data/couverture-themes.yaml`
- **Commit:** celui de cette tâche

**2. [Rule 3 - Outil] gitleaks indisponible**
- **Found during:** fin de chaque lot
- **Issue:** le téléchargement du binaire épinglé est refusé par les permissions ; étape 5 de 03-REDACTION §8 impossible.
- **Fix:** `grep` de motifs de jetons sur les extraits (aucun résultat, deux faux positifs « secret ») ; la CI exécute gitleaks au push. Aucun `.gitleaks.toml` créé.

**3. [Rule 1 - Erreur de classement] Retailleau sécurité**
- **Found during:** relecture de la clé « défense » des mots-clés
- **Fix:** sécurité passée de partiel à fort (droit à la sécurité dans la Constitution, trois mesures de défense du thème IA), note mise à jour.

**4. [Retrait] Cahier ESS de Roussel**
- Archivé puis retiré (aucun contenu sur les thèmes), source, extrait et binaire privé supprimés avant commit.

### Écarts de forme

- `pcf.fr` a répondu HTTP 429 après des requêtes rapprochées : pages `objectif_2` à `objectif_10` non relues, sans insistance.
- Les extraits de 4 cahiers du PCF contiennent des caractères de remplacement U+FFFD (archivés avec `--allow-replacement-chars`) : les plans de thème devront éviter les passages qui les traversent.

## Issues Encountered

- Le jeu d'outils de recherche web renvoie surtout presse et comparateurs : pour Platret, aucun site de campagne n'existe (`aucun_site`).
- Les sites de Mikolajczak (programme annoncé pour le 2026-11-04), de Retailleau (7 thèmes sur 18 « À venir »), de Tondelier et de Zemmour sont en cours d'écriture : la mesure est datée et doit être refaite avant publication.

## Known Stubs

Aucun. Ce plan ne crée ni mesures, ni cases de thème, ni fichiers de couverture ; `pilote.themes` et `pilote.livres` restent vides.

## Threat Flags

Aucun nouveau point d'entrée réseau, de chemin d'authentification ni de schéma. Contenus suspects (instructions adressées à une IA dans une page) : aucun repéré.

## Doutes à relire par Erwan (synthèse)

Détail complet dans LOTS.md (Lots 1, 2 et 3). Les plus lourds :

1. **Le classement ne confirme pas la liste provisoire** et dépend de choix de lecture (Zemmour sur tracts, Retailleau sécurité, Tondelier sans le programme bloqué). Décision au checkpoint du plan 03-05.
2. **Zemmour** : deux tracts de parti, pas de programme publié ; si non retenus, `aucun_site` et le troisième thème devient institutions.
3. **Le Pen et Markovic** (`aucun_site`) : exclus parce que leurs documents sont d'élections précédentes ; à reclasser si tu les juges valables comme projet courant.
4. **Tondelier** : cases probablement sous-estimées tant que le programme de 557 mesures est bloqué.
5. **Auteur** : Branco (`coalition`), Retailleau (livrets `parti_du_candidat`), Ruffin (cahiers `candidat`), Mlekuz, Mélenchon (PDF budgétaires).
6. **Dupont-Aignan** : pages santé, retraites, environnement du projet DLF sans badge « Projet 2027 ».
7. **Équinoxe** : programme attendu le 2026-11-04.

## Self-Check: PASSED

- Fichiers : `data/couverture-themes.yaml`, `docs/COUVERTURE-THEMES.md`, `tests/corpus/couverture-themes.test.ts`, `03-04-LOTS.md`, 82 sources et 82 extraits présents.
- Commits des lots 1 et 2 (`0672303`, `e4178e6`) présents dans `git log`.
- `npm run validate` (production et preview) 0 erreur ; `ids --check` 0 problème ; `couverture-scan.ts --check-data` 0 problème ; 110 tests verts.
