---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 09
subsystem: infra
tags: [default-root, ci, adr, docs, wayback, phase-gate, couverture]
requires:
  - phase: 03-import-data-gouv-et-corpus-pilote
    provides: "03-01 à 03-08 : import, archivage, couverture, trois thèmes pilotes livrés en brouillon"
provides:
  - "DEFAULT_CONTENT_ROOT = '.' : validate, migrate, ids, check-dist et build travaillent sur le vrai corpus sans option"
  - "CI explicite sur les deux corpus (fictif nommé, réel RTP_CONTENT_ROOT=.), test ci.test.ts synchronisé"
  - "Alias npm archive et couverture"
  - "Barrière de phase : tests/corpus/pilote.test.ts exige livres = themes avec fichier thème et couverture complète"
  - "README, RUNBOOK, ARCHITECTURE (ADR-042 à ADR-046), .env.example à jour"
affects: [relecture Erwan, phase 6 publication]
tech-stack:
  added: []
  patterns:
    - "Fixture fictive toujours désignée explicitement (RTP_CONTENT_ROOT ou --root) ; helper cliReel pour tester le défaut réel"
key-files:
  created:
    - tests/repo/default-root.test.ts
    - .planning/phases/03-import-data-gouv-et-corpus-pilote/03-09-LOTS.md
  modified:
    - src/lib/content-core/root.ts
    - src/lib/content-core/astro-loader.ts
    - scripts/validate.ts
    - scripts/ids.ts
    - scripts/migrate.ts
    - scripts/check-dist.ts
    - tests/content-core/astro-parity.test.ts
    - tests/content-core/validate-cli.test.ts
    - tests/content-core/ids-cli.test.ts
    - tests/content-core/schema-load.test.ts
    - tests/migrations/cli.test.ts
    - .github/workflows/ci.yml
    - tests/repo/ci.test.ts
    - tests/repo/scaffold.test.ts
    - tests/repo/docs.test.ts
    - tests/corpus/pilote.test.ts
    - package.json
    - README.md
    - docs/RUNBOOK.md
    - docs/ARCHITECTURE.md
    - docs/COUVERTURE-THEMES.md
    - data/couverture-themes.yaml
    - .env.example
    - src/content/sources/david-lisnard-programme-index.yaml
    - src/content/sources/jean-luc-melenchon-programme-index.yaml
    - src/content/sources/olivier-becht-livre-partie-7.yaml
    - src/content/sources/raphael-glucksmann-lettre-aux-francais.yaml
key-decisions:
  - "Racine par défaut = corpus réel (ADR-042, succède à ADR-025 qui reste comme historique)"
  - "Balayage Wayback final fait par --wayback-only sur 7 ids, pas --wayback-missing, pour ne jamais soumettre la page Rohou (données personnelles)"
  - "Ligne Rohou réalignée : acces ok, dix cases reclassées d'après la capture manuelle expurgée ; classement et trois thèmes inchangés"
patterns-established:
  - "Le défaut réel est testé par un helper cliReel, le corpus fictif par un helper qui force la fixture"
requirements-completed: [CONT-05, CONT-06, CONT-01, CONT-03]
duration: ~1h30
completed: 2026-11-04
---

# Phase 3 Plan 09 : racine réelle par défaut, CI explicite, barrière de phase, documentation Summary

**`DEFAULT_CONTENT_ROOT` passe à `.`, la CI nomme ses deux corpus, `npm test` impose `livres == themes`, et README/RUNBOOK/ADR-042 à 046 décrivent import, archive, couverture et ouverture de la relecture.**

## Commits

| Tâche | Commit | Contenu |
|---|---|---|
| 1 | f7f8bff | `feat(03-09)` : racine par défaut réelle, fixture explicite, 3 tests « sans option » sur le réel |
| 2 | 0b66bd2 | `ci(03-09)` : étapes « corpus fictif » avec `RTP_CONTENT_ROOT=tests/fixtures/corpus-valide`, alias npm `archive` et `couverture` |
| 2 | 82e2ea8 | `content(03-09)` : balayage Wayback final, 4 URL, `03-09-LOTS.md` |
| 2 | df79936 | `content(03-09)` : ligne Rohou réalignée (voir Déviations) |
| 3 | 609d161 | `docs(03-09)` : documentation, ADR-042 à 046, barrière de phase |

## Résultats de la barrière (2026-11-04, racine `.`)

- `migrate --check` : 391 fichiers à jour, exit 0
- `validate --mode production` et `--mode preview` : 0 erreur, 17 avertissements (tous `LISIBILITE_ENFANT_FAIBLE`), exit 0
- `RTP_CONTENT_ROOT=tests/fixtures/corpus-valide validate --mode production` : 10 fichiers, 0 erreur, 0 avertissement
- `ids --check` : 59 candidats, 59 verrouillés, 0 problème
- `couverture --check-data` : exit 0, choix `sante, travail, europe-et-monde` (inchangé après réalignement de Rohou)
- `npm run check` : 0 erreur, 0 hint
- `npm test` : 1598 pass, 0 fail (le build de `tests/dist/site.test.ts` passe localement)
- `npm run build` (réel, production) : 65 pages ; `RTP_MODE=preview npm run build` : 68 pages
- `livres == themes == [sante, travail, europe-et-monde]` ; 134 mesures (santé 47, travail 44, Europe et monde 43), `relecture_ouverte: false`
- Nombre de cas de test : aucun supprimé ; ajoutés : 4 (default-root), 1 validate-cli, 1 migrations, 1 ci, 1 pilote, 3 docs. Le cas ids-cli existant a été étendu (sans option sur le réel).
- Aucun `uses:` de ci.yml modifié, `package-lock.json` non touché.

## Déviations from Plan

### Auto-ajustements

**1. [Rebase reality] Relabel du squelette sans objet**
- Phase 4 a remplacé `src/pages/index.astro` par le hall et supprimé `tests/dist/skeleton.test.ts`. Aucune des chaînes « Données fictives », « corpus fictif », « à des fins de test » ne subsiste dans `index.astro` ni dans `tests/dist/cas/squelette.cas.ts` (seul un intitulé de cas dit « corpus fictif », exact). Rien modifié ; seul `site.test.ts` lance `astro build`.

**2. [Rule 3] Étapes ci.yml `npm run build` et `npm run check-dist`**
- Sans option elles auraient construit le réel en doublon avec les étapes `dist-reel`. Elles sont renommées « (corpus fictif) » et portent la fixture explicite ; ci.test.ts épingle ce point (pas de « corpus par défaut »).

**3. [Rule 1] Écart d'ordre de la consigne : `--wayback-missing` remplacé par `--wayback-only`**
- `--wayback-missing` aurait soumis `erwan-rohou-programme-mei` (consigne : jamais). Les 7 autres ids ont été soumis avec `--wayback-only`, ≥ 20 s d'écart, plus une reprise de Batho. `wayback_url` de Rohou reste vide ; la raison est dans le RUNBOOK, `03-09-LOTS.md` et l'ADR-044.

**4. [Donnée due par les plans précédents] Ligne Rohou de `data/couverture-themes.yaml`**
- `acces: bloque` → `ok`, `sources: [erwan-rohou-programme-mei]`, `urls_bloquees: []`, note d'URL expliquant la capture manuelle expurgée. Les dix cases `inaccessible` ont été reclassées d'après l'extrait archivé (39 propositions) : logement fort, école partiel, retraites fort, santé partiel, sécurité partiel, climat fort, travail fort, impôts partiel, Europe et monde fort, institutions fort. Effet : positions 27/27/27/26/26/25/24/23/22/21, classement et trois thèmes inchangés. `docs/COUVERTURE-THEMES.md` mis à jour (ligne 33, compteurs 27 ok / 0 bloqué, tableau de classement, section sources inaccessibles). Ces classements sont de ma lecture : à relire.

**5. [Hors périmètre déclaré] `scripts/check-dist.ts` : texte d'usage** (« sinon le corpus fictif de test ») corrigé comme les autres CLI.

## Wayback restant (4 sources)

| Source | Raison |
|---|---|
| delphine-batho-priorite-1, -2, -4 | HTTP 520 de Wayback sur www.delphinebatho.fr, deux essais ; reprise : `npm run archive -- --wayback-only delphine-batho-priorite-1 delphine-batho-priorite-2 delphine-batho-priorite-4` |
| erwan-rohou-programme-mei | volontairement jamais soumise (pied de page avec adresse, téléphone mobile, courriels de particuliers) ; extrait = saisie manuelle expurgée |

Obtenues pendant ce balayage : Lisnard, Mélenchon (index), Becht partie 7, Glucksmann (lettre). `--sync-private` : dépôt privé propre et poussé.

## À relire par Erwan avant tout statut `relu` (liste consolidée, tous thèmes)

Les détails et citations sont dans les résumés 03-01, 03-04, 03-06, 03-07, 03-08 et leurs LOTS. Positionner `pilote.relecture_ouverte: true` seulement dans le commit où la relecture commence (RUNBOOK, « Ouvrir la relecture »).

1. **Motifs de statut (03-01)** : 17 motifs `renonce` lus dans `statut_detail`, dont trois choisis faute de code propre : Poutou et Knafo en `non_candidat`, Brun en `elimine_primaire`.
2. **`parti: null` (24 fiches)** : billetdoux, lundy, mathieu, vallaud, le-maire, collovati, autain, rohou, lalanne, hollande, darmanin, legendre, platret, bardella, bouamrane, castets, wauquiez, barnier, markovic, brun, becht, knafo, royal, durif. Hypothèse P3-A4 (ADR-046).
3. **Dates partielles** : statut de Wauquiez `2026-07` à compléter ; `date_publication` partielle (mois de capture) sur toutes les sources de sites non datés ; Rohou : programme d'apparence ancienne (« traité constitutionnel », « guerre en Irak »), date inconnue, à décider. Orthographe « lucas-landy » dans l'URL source de Lundy. Hypothèse P3-A3 : `date_consultation` = `verifie_le` amont.
4. **Dérogation** : aucune (`pilote.derogation: null`) ; le choix par marge égale le top 3 littéral à l'ordre près (décision d'Erwan, 03-05).
5. **Choix des 2 mesures par candidat et thème** (règle « les 2 premières de la source ») : substitutions possibles listées thème par thème (santé : 26 points ; travail : 10 ; Europe et monde : 10 dont Tondelier partie VIII et Roussel 3.1 OTAN non retenues).
6. **Cases `non_precise` contre mesure de principe** (Batho, Egger, Mathieu, Mikolajczak, Mlekuz, Polony contre Bouamrane ; Labib, Mélenchon) et **`programme_non_publie`** vérifiés en direct (Asselineau, Bertrand, Billetdoux, Durif, Le Pen, Markovic, Platret ; Le Pen : seulement des programmes passés, à confirmer).
7. **Auteurs et étiquettes** : documents de parti (`parti_du_candidat`) pour Glucksmann, Lisnard, Labib, Roussel, Retailleau, Tondelier, Philippot, Zemmour, Rohou, Mikolajczak ; Branco `coalition` ; les rédactions le disent, les textes enfant ne nomment aucun parti.
8. **Doutes de contenu** : Collovati (AME 1,3 Md contre 1,2 Md, `chiffrage` vide), Dupont-Aignan (pages sans date, incohérence un an / trois mois), Mélenchon (livre-programme jamais lu, sources budgétaires), Retailleau (`chiffrage` ambigu), Zemmour (vocabulaire des tracts cité entre guillemets seulement), Roussel (« EtatsUnis »), Cazeneuve (OTAN développé, « sans rien céder »), Becht, Bouamrane, Arthaud, Mikolajczak (programme Équinoxe attendu le 2026-11-04).
9. **Glossaire** : 88 entrées au total, dont les définitions rédigées de connaissance générale, sans source (29 santé, 30 travail, 29 Europe et monde, selon les résumés 03-06 à 03-08) ; à vérifier une à une.
10. **Marqueurs ajoutés rétroactivement** : `olivier-becht/sante-prevention`, `raphael-glucksmann/sante-plan-prevention` (`[[prevention]]`). Aucun sur travail et Europe et monde.
11. **Cases non résolues** : aucune.
12. **Avertissements restants** : 17 `LISIBILITE_ENFANT_FAIBLE` (14 santé, 3 Europe et monde : Branco 73,6, Becht 72,3, Rohou 68,5) ; 0 `PILOTE_SIGLE_ENFANT`. Liste santé dans 03-06 §C.
13. **Sigles** : OTAN développé dans quelques textes (Cazeneuve, Lalanne), OIF (Branco) : à harmoniser. Définitions d'aîné tirées du glossaire absentes du texte source (référendum, Schengen, BRICS, Commonwealth…).
14. **Rohou** : fiche sans parti, rattachement « candidat du mouvement » tiré de l'accueil du mouvement (vidéo non lisible) ; capture manuelle expurgée = les 39 points tels quels, apostrophes droites, sans copie Wayback ; dix cases de couverture reclassées par moi dans ce plan.
15. **Sources sans `wayback_url`** : Batho x3 (HTTP 520), Rohou (volontaire).
16. **Limite CONT-06** : la CI ne contrôle que les termes ayant déjà une entrée de glossaire et les noms de partis écrits en toutes lettres. Elle ne peut pas détecter du jargon sans entrée, ni des sigles nus au-delà de la liste d'avertissement `SIGLES_ENFANT`. Erwan relit donc chaque texte enfant pour les mots qu'un enfant de 10 ans ne connaît pas (déjà repérés : « dépenses sociales », « obligations d'exercer », « Outre-mer », « zones saturées », « négociation », « indemnité », « concurrence déloyale »…).

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'attaque. T-03-39 : seuls des noms d'étapes et `env.RTP_CONTENT_ROOT` ont changé dans ci.yml, aucun `uses:` ni permission touché ; T-03-40 : assertions conservées, cas de test non diminués ; T-03-41 : le squelette n'existe plus (hall Phase 4) ; T-03-42 : barrière `livres == themes` active.

## Self-Check: PASSED

- Fichiers : `tests/repo/default-root.test.ts`, `03-09-LOTS.md`, `docs/ARCHITECTURE.md` (ADR-042 à 046) présents.
- Commits f7f8bff, 0b66bd2, 82e2ea8, df79936, 609d161 présents dans `git log`.
