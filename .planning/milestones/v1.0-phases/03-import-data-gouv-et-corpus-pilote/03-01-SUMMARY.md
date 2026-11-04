---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 01
subsystem: import
tags: [data.gouv, 2027etmoi, yaml, importer, ids-lock, licence-ouverte]
requires:
  - phase: 02-regles-editoriales
    provides: content-core (validateYamlText, ids-lock, readContained), règles production
provides:
  - "59 fiches candidats en brouillon sous src/content/candidats/ (CONT-01, CONT-02)"
  - "npm run import:datagouv : instantané haché, fusion append-only, rapport"
  - "data/import/ : instantané, .meta.json, correspondances.yaml, README, ATTRIBUTION"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09]
tech-stack:
  added: []
  patterns:
    - "mapping pur (scripts/lib) + CLI mince, écriture atomique temp + rename"
    - "rien d'écrit tant que mapping, validation, fusion et ids.lock ne sont pas tous bons"
key-files:
  created:
    - scripts/lib/datagouv.ts
    - scripts/import-datagouv.ts
    - data/import/correspondances.yaml
    - data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json
    - data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.meta.json
    - data/import/README.md
    - data/import/ATTRIBUTION.md
    - tests/import/datagouv.test.ts
    - tests/import/import-cli.test.ts
    - tests/corpus/fiches.test.ts
  modified:
    - ids.lock
    - LICENSE
    - .gitattributes
    - package.json
    - tests/repo/scaffold.test.ts
key-decisions:
  - "Motifs : Poutou et Knafo en non_candidat, Brun en elimine_primaire (brouillon, à relire par Erwan)"
  - "A3 : date_consultation d'un statut = verifie_le amont"
  - "A4 : parti: null sans source de revendication (24 fiches)"
  - "Une fiche modifiée par l'import est réécrite en rendu canonique (pas d'ajout textuel)"
requirements-completed: [CONT-01, CONT-02]
duration: 40min
completed: 2026-11-03
---

# Phase 3 Plan 01: Import data.gouv Summary

**Import idempotent des 59 lignes du jeu data.gouv « statuts sourcés » en fiches candidats valides, avec instantané haché, historique de statuts en ajout seul et attribution Licence Ouverte.**

## Accomplissements

- Instantané récupéré en direct le 2026-11-03 : sha256 `9f2fbc7930c00796e7992d7468806e095bec2e0782d6ae2d2df2582a36367e50`, **identique à celui de la recherche** (2026-10-28, 62 986 octets, 59 lignes). Aucun id ajouté ou retiré, aucun changement de statut depuis la recherche. Chaîne : 302 data.gouv vers `https://2027etmoi.fr/data/candidats.json`, ETag `"43cd7765d0e892886967e943ceaa3d9e-ssl"`.
- `correspondances.yaml` : 59 lignes copiées du tableau de la recherche (id, prénom, nom, nom_tri, motif pour les 17 `renonce`, type de source du statut).
- `scripts/lib/datagouv.ts` : `checkUpstream` (forme, doublons, https, dates, caractères de contrôle), `lireCorrespondances`, `mapRow`, `mergeFiche`, `renderYaml`, `snapshotName`.
- `scripts/import-datagouv.ts` : tous les ids inconnus listés avant arrêt, validation de chaque fiche contre le schéma, conflits bloquants, `ids.lock` via `ajouterIds`, plafond 5 Mo et délai 30 s, refus de lien symbolique et de sortie de racine.
- Rapport réel (premier passage) : `import : 59 ligne(s), 59 créé(s), 0 statut(s) ajouté(s), 0 inchangé(s), 0 absent(s) en amont, 0 conflit(s) — instantané 9f2fbc7930c0 du 2026-10-28`. Second passage : `0 créé(s)`, 59 inchangés, `git status --porcelain src/content ids.lock` vide.
- Vérifications : `npm run validate -- --root . --mode production` : 59 fichiers, 0 erreur ; `npm run ids -- --root . --check` : 59 verrouillés, 0 problème ; 67 tests verts (datagouv, import-cli, fiches, docs, scaffold).

## Commits

| Tâche | Commit | Contenu |
|---|---|---|
| 1 | ff7d22a | instantané, table à la main, tests RED |
| 2 | 969103f | mapping, CLI, 59 fiches, ids.lock, script npm |
| 3 | 75f9278 | tests de fusion et conflits, README, ATTRIBUTION, LICENSE §4 |

## Lignes à relire (Erwan)

**Motifs `renonce` en brouillon** (décision CONTEXT, valeur la moins fausse) :
- `philippe-poutou` : `non_candidat` (le NPA, pas lui, se rallie)
- `sarah-knafo` : `non_candidat` (« pas candidate », soutient Zemmour)
- `philippe-brun` : `elimine_primaire` (suspendu du PS, exclu de la primaire ; aucun code ne convient proprement)

Les 14 autres motifs viennent du tableau de la recherche sans marque `?` mais restent des lectures de `statut_detail` : à relire aussi.

**`parti: null` (24, aucune page de parti ni site de campagne dans le jeu)** : augustin-billetdoux, benjamin-lucas-lundy, benoit-mathieu, boris-vallaud, bruno-le-maire, christian-collovati, clementine-autain, erwan-rohou, francis-lalanne, francois-hollande, gerald-darmanin, jean-francois-legendre, gilles-platret, jordan-bardella, karim-bouamrane, lucie-castets, laurent-wauquiez, michel-barnier, mira-markovic, philippe-brun, olivier-becht, sarah-knafo, segolene-royal, sylvain-durif.

**Dates et orthographe** : `laurent-wauquiez` date de statut partielle `2026-07` (à compléter avant `relu`) ; `benjamin-lucas-lundy` : l'URL source écrit « lucas-landy », vérifier l'orthographe.

**Lignes ajoutées à relire** : aucune (le jeu live est identique à celui de la recherche).

**Sources de statut** : le type (`presse`, `parti`, `candidat`, `institution`) vient de la recherche ; `antoine-mikolajczak` (jhm.fr) reste `presse` par hypothèse.

## Déviations par rapport au plan

**1. [Règle 3 - bloquant] `--file` dans `data/import/` et tests en racine temporaire**
- Le plan lit la table sous `<root>/data/import/`, donc les tests copient `data/import/` dans la racine temporaire et passent un `--file` situé dans ce dossier (aucun instantané ni méta dupliqué). Un second test couvre un `--file` extérieur (instantané + `.meta.json` copiés, `url_*` et `etag` à `null`).

**2. Garde fixture simplifiée**
- Le plan demandait de refuser une racine sous `tests/fixtures/` sans `--root` explicite. Comme `RTP_CONTENT_ROOT` est ignorée et le défaut est le dossier courant, la garde ne se déclenche que si la commande est lancée depuis un dossier de fixture ; le test vérifie surtout que `RTP_CONTENT_ROOT` est ignorée.

**3. `fetched_at` du `.meta.json` committé** : `2026-11-03T17:22:47+01:00` (récupération par curl, sha256 vérifié à l'octet). Pour un téléchargement fait par la CLI : instant UTC `...Z`.

**4. Fusion complétée dès la tâche 2** : `mergeFiche` a été écrit en version complète d'emblée ; la tâche 3 ajoute les tests CLI de conflit, de statut ajouté et de ligne retirée, plus la documentation.

Aucun défaut ni correctif d'autre nature. Aucune dépendance ajoutée.

## Known Stubs

Aucun. `parti: null` est un choix assumé (A4), pas un bouche-trou.

## Threat Flags

Aucune surface nouvelle hors du modèle de menaces du plan (T-03-01 à T-03-06 mitigées : sha256 + méta, forme vérifiée, champs interdits jamais lus, ajout seul, ids inconnus bloquants, plafond/délai, écriture contenue et atomique).

## Self-Check: PASSED

- Fichiers : tous présents (scripts, data/import/*, tests, 59 fiches).
- Commits ff7d22a, 969103f, 75f9278 présents dans la branche `worktree-agent-a1f85031e95abe8ee`.
