---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
verified: 2026-11-04T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "Décider de la lecture de « < 1 s sur 4G » (spec §10/§12) : accepter les deux profils publiés sur Méthode (latence-150 : budget 1 s ; slow-4g-lighthouse : budget 1,5 s), ou demander l'inlining du CSS pour tenir 1 s sur le profil Lighthouse"
    expected: "Décision d'Erwan consignée (ADR-009 / RUNBOOK) ; la phrase publiée sur Méthode reste celle générée depuis src/lib/profil-4g.ts"
    why_human: "WR-04 a changé une affirmation de performance publiée ; le critère ROADMAP (150 ms, 1,6 Mbps, < 1 s) est tenu à la lettre, mais le choix du profil de référence est une décision éditoriale, pas un fait vérifiable"
  - test: "Parcours personnel de l'URL de test par Erwan : télécharger l'artefact site-preview de la dernière CI verte sur main (ou `node e2e/serveur.ts dist-preview 4173`), parcourir accueil, 3 thèmes pilotes aux 4 niveaux, une page candidat, Méthode, Mentions légales, Qui sommes-nous"
    expected: "Bandeau « Version de prévisualisation », dates des tours en pied de page, cartes ou états vides datés pour les 37 candidats de chaque thème, pages institutionnelles conformes"
    why_human: "Le critère 4 nomme Erwan ; 05-08 a fait réaliser le parcours par l'orchestrateur en son nom (autorisé par le plan, autonomie maximale). Le parcours d'Erwan lui-même reste recommandé avant le Lot 3"
  - test: "Trancher les constats de l'audit croisé qui laissent 2 tests bloquants Partiel : S1 (titres de mesure non adaptés au niveau enfant), S3/O2 (vérification de la citation contre l'extrait archivé par un lecteur extérieur), S2 (libellé « Gros caractères »)"
    expected: "Pour chaque constat : correction planifiée ou acceptation écrite ; verdict actuel « prêt pour la relecture du Lot 2, pas prêt pour une publication »"
    why_human: "Décisions de spécification et de libellé réservées à Erwan ; l'audit les classe, il ne les tranche pas"
  - test: "(Reporté de la Phase 3, non nouveau) Relecture éditoriale du corpus pilote, dont les 17 avertissements LISIBILITE_ENFANT_FAIBLE (liste C1 à C6 de docs/AUDIT-TEST-CROISE.md)"
    expected: "Mesures passées en relu ; aucune publication avant cette relecture"
    why_human: "Relecture humaine voulue par conception (Phase 3 human_needed)"
---

# Phase 5 : vérification (pages institutionnelles, qualité et URL de test)

**Objectif de la phase :** le corpus pilote est navigable sur une URL de test, avec des pages Méthode, Mentions légales et Qui sommes-nous neutres qui décrivent ce qui a réellement été construit. L'accessibilité, le fonctionnement sans JS et la performance en 4G sont prouvés par des tests automatiques. Livrable du Lot 2.
**Vérifié le :** 2026-11-04
**Statut :** human_needed (les 5 critères sont vérifiés dans le code ; il reste des décisions d'Erwan, aucun écart)
**Re-vérification :** non, vérification initiale

Note sur le mode MVP : la phase est marquée `**Mode:** mvp`, mais l'objectif n'est pas rédigé en user story (`user-story.validate` renvoie `valid: false`). C'est le cas pour toutes les phases du milestone, et les vérifications 03 et 04 ont suivi la méthode classique. On fait de même ici. La couverture du parcours utilisateur est donnée plus bas, à partir du parcours de 05-08, revérifié sur une build fraîche.

## Atteinte de l'objectif

### Vérités observables (critères de succès du ROADMAP)

| # | Vérité | Statut | Preuve |
|---|---|---|---|
| 1 | Méthode explique sources, neutralité, mots interdits, longueurs, périmètre d'équité, ordre, états vides et écart 59/51 ; listes et chiffres générés depuis la config ; un changement de borne dans `config.ts` change la page | VERIFIED | `src/pages/methode.astro` importe `LONGUEURS`, `MOTS_INTERDITS`, `PERIMETRE_EQUITE`, `VERBES_CONNOTES`, `PHRASE_ENFANT_MAX`, `KANDEL_MOLES`, `CATALOGUE` et `HYPOTHESES` depuis `src/lib/content-core/rules/config.ts`, `ETAT_VIDE_TEXTES`, l'enum des types de source du schéma, `classer()` sur la couverture, `loadDatasetDatagouv()`, `TOURS` et `PROFILS_4G`. **Test de mutation fait par le vérificateur** sur une copie `git archive HEAD` : `resume.max` 25→27 et `PHRASE_ENFANT_MAX` 15→14, puis rebuild. La page affiche alors « En bref : au plus 27 mots » et « ne dépasse pas 14 mots ». Sur la build preview fraîche, la page affiche « annonce 51 personnes », « en contient 59 » et « Cet écart est constaté, il n'est pas expliqué ». `tests/dist/cas/methode.cas.ts` compare la page à ses imports et refuse les nombres en dur dans la source. |
| 2 | Mentions légales (LCEN art. 1-1, éditeur non professionnel Erwan Henry sans adresse personnelle, hébergeur depuis `config/hebergeur.yml`, contact, droit de réponse, données personnelles : clés localStorage, aucun cookie) ; Qui sommes-nous sans branding tiers ni lien de don ; dates du 18 avril et du 2 mai 2027 visibles | VERIFIED | `src/pages/mentions-legales.astro` : « II de l'article 1-1 de la loi n° 2004-575 », « Éditeur et directeur de la publication : Erwan Henry », aucune adresse de rue de l'éditeur. L'hébergeur est lu par `loadHebergeurConfig()` (Hetzner Online GmbH, `statut: prevu`, affiché honnêtement « pas mise en ligne »). Le contact vient de `config/site.yml`, signalé comme provisoire ; l'adresse réelle relève du Lot 3, hors milestone. Droit de réponse au III de l'art. 1-1, délai de 3 jours. `CLES_STOCKAGE` donne `rtp:niveau` et `rtp:ordre`, et la page dit « aucun cookie ». `qui-sommes-nous.astro` : grep Alignd, SpikeeLabs, don, PayPal et Tipeee = 0 ; « ne demande aucun argent aux visiteurs ». Dates : `src/lib/dates-tours.ts` → pied de page de `Base.astro`, avec « 18 avril 2027 » et « 2 mai 2027 » présents sur l'accueil, Méthode, Mentions, Qui sommes-nous et `/themes/sante/` de la build fraîche. |
| 3 | La suite Playwright passe : lecture et bascule sans JS ; clavier complet ; 0 violation axe WCAG 2.2 AA sérieuse ou critique ; texte 160 % et reduced-motion ; contraste AA ; page la plus lourde < 1 s en 4G lente simulée (150 ms, 1,6 Mbps), servie compressée | VERIFIED | Specs lues, toutes substantielles. Elles s'appliquent à **toutes** les pages découvertes dans le dist (`e2e/pages.ts`) : `sans-js.spec.ts` (projet `javaScriptEnabled: false`, 4 radios, seul le niveau choisi est visible) ; `clavier.spec.ts` (premier arrêt sur le lien d'évitement, chaque élément focalisable atteint, indicateur ≥ 2 px, aucun tabindex positif) ; `axe.spec.ts` (tags wcag2a à wcag22aa, échec sur serious ou critical, 4 niveaux par page) ; `texte.spec.ts` (160 %, zoom, 320 px) ; `mouvement.spec.ts` (`reducedMotion: 'reduce'`, aucune durée non nulle) ; `contraste.spec.ts` (10 couleurs × 2 niveaux, règle `color-contrast`) ; `4g.spec.ts` (contexte neuf à chaque mesure, `content-encoding: gzip` exigé, 3 mesures sur 3 sous budget). Le profil `latence-150` correspond exactement au critère : 150 ms, 1,6 Mbit/s, budget 1000 ms. `scripts/e2e.ts` exécute la fixture m1 en production puis le vrai corpus en preview, c'est-à-dire l'URL de test elle-même. Dernière CI terminée sur main (run 41843217660) : job e2e en succès, 222 et 1032 passed. Run 41879201471 sur HEAD (après les corrections de revue, profil Lighthouse compris) : succès, 223 + 1033 passed. |
| 4 | Erwan ouvre la build preview (artefact CI ou preview locale, `noindex` si hébergée) et parcourt le corpus pilote de bout en bout | VERIFIED (parcours fait par délégation, voir la vérification humaine n° 2) | L'artefact `site-preview` existe : run 41843217660, 316 712 octets, non expiré, expiration 2026-11-18. Il est publié par l'étape `upload-artifact` de `.github/workflows/ci.yml` (`path: dist-preview`, après `check-dist --mode preview`). **Build preview fraîche du vérificateur** : 68 pages, `check-dist --mode preview` donne 0 erreur et 34 avertissements, tous `CONTACT_PROVISOIRE` et `HEBERGEUR_PREVU`, attendus hors déploiement. `noindex` est présent une fois par page sur les 5 pages sondées. 05-08 consigne le parcours en 7 étapes fait par l'orchestrateur pour Erwan, comme le plan le permet (« réalisable par l'orchestrateur pour lui »). README et RUNBOOK décrivent comment récupérer l'URL de test. |
| 5 | Un journal d'audit existe pour le test croisé simulé (enfant 10 ans, retraité 72 ans, journaliste, données piégées), avant la clôture du milestone | VERIFIED | Fichiers présents : `docs/AUDIT-TEST-CROISE.md` (197 lignes : protocole écrit avant les résultats, 3 personas, 13 messages notés, 7 pièges §12 sur 7 rejetés avec la commande de rejeu, constats classés, verdict), `audit/journal.jsonl` (131 lignes) et `audit/personas/`. Verdict : « prêt pour la relecture du Lot 2, pas prêt pour une publication », avec 0 KO et 2 tests bloquants Partiel. C'est le contexte connu ; le critère demande que le journal existe, et il existe. |

**Score :** 5/5 vérités vérifiées

### Couverture du parcours utilisateur (mode MVP)

| Étape | Attendu | Preuve | Statut |
|---|---|---|---|
| Ouvrir l'URL de test | build preview servie, `noindex`, bandeau de prévisualisation | artefact `site-preview` ; build fraîche avec `noindex` ×1 par page ; `check-dist --mode preview` 0 erreur | ✓ |
| Choisir un thème | 3 thèmes pilotes, chaque candidat du périmètre a une carte ou un état vide daté | `check-dist` 0 erreur (contrôle des cellules) ; parcours 05-08 : santé 27 + 10, travail 24 + 13, Europe 22 + 15 sur 37 | ✓ |
| Lire au niveau voulu | bascule sur 4 niveaux, aussi sans JS | `sans-js.spec.ts` sur chaque page avec sélecteur | ✓ |
| Vérifier la source | source primaire, copie archivée | phases 2 et 4 ; parcours 05-08 (PDF original, Wayback, extrait sha256) | ✓ |
| Comprendre la méthode et l'éditeur | Méthode, Mentions, Qui sommes-nous neutres et exactes | vérités 1 et 2 | ✓ |

### Artefacts requis

| Artefact | Attendu | Statut | Détails |
|---|---|---|---|
| `src/pages/methode.astro` | page générée depuis la config | ✓ VERIFIED | 184 lignes, aucun nombre en dur, mutation propagée |
| `src/pages/mentions-legales.astro` | LCEN, hébergeur, droit de réponse, données | ✓ VERIFIED | lit `hebergeur.yml`, `site.yml` et `CLES_STOCKAGE` |
| `src/pages/qui-sommes-nous.astro` | éditeur, démarche, sans branding ni don | ✓ VERIFIED | plus une section sur la rédaction assistée par IA (WR-06) |
| `config/hebergeur.yml` + `src/lib/hebergeur-config.ts` | hébergeur, lecteur strict, garde de déploiement | ✓ VERIFIED | `statut: prevu` ; `RTP_DEPLOIEMENT=1` fait échouer le build |
| `src/lib/dates-tours.ts` + `src/layouts/Base.astro` | dates sur chaque page | ✓ VERIFIED | pied de page, source service-public.fr |
| `src/lib/profil-4g.ts` | profils et budgets partagés par la page et le test | ✓ VERIFIED | importé par `methode.astro` et `e2e/4g.spec.ts` |
| `e2e/*.spec.ts`, `e2e/serveur.ts`, `e2e/pages.ts`, `playwright.config.ts`, `scripts/e2e.ts` | suite navigateur | ✓ VERIFIED | projets `avec-js`, `sans-js` et `4g` ; serveur gzip sans dépendance |
| `.github/workflows/ci.yml` | artefact `site-preview` et job e2e | ✓ VERIFIED | actions épinglées par SHA, rétention 14 jours |
| `docs/AUDIT-TEST-CROISE.md`, `audit/journal.jsonl`, `scripts/audit-lire.ts` | banc et journal de l'audit | ✓ VERIFIED | journal JSONL, lecteur journalisé, durci par WR-01 et WR-02 |
| `README.md`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md` | URL de test, droit de réponse, ADR | ✓ VERIFIED | README §URL de test ; RUNBOOK §Droit de réponse ; ADR-049 à ADR-052 |

### Vérification des liens clés

| De | Vers | Par | Statut |
|---|---|---|---|
| `methode.astro` | `rules/config.ts` | import + rendu | WIRED (mutation constatée) |
| `methode.astro` | `data/dataset-datagouv.yaml` + instantané | `loadDatasetDatagouv()` / `ecartAnnonce()` | WIRED (51/59 rendu) |
| `mentions-legales.astro` | `config/hebergeur.yml` | `loadHebergeurConfig()` | WIRED |
| `Base.astro` | `dates-tours.ts` | pied de page | WIRED (dates vues sur 5 pages) |
| `4g.spec.ts` et `methode.astro` | `profil-4g.ts` | import commun | WIRED (phrases des deux profils rendues) |
| CI `verifier` | artefact `site-preview` | `upload-artifact` sur `dist-preview` | WIRED (artefact présent) |
| `scripts/e2e.ts` | vrai corpus en preview | `RTP_CONTENT_ROOT=REPO_ROOT`, `RTP_MODE=preview` | WIRED |

### Trace du flux de données (niveau 4)

| Artefact | Donnée | Source | Données réelles | Statut |
|---|---|---|---|---|
| Méthode : bornes, mots interdits, périmètre | `LONGUEURS`, `MOTS_INTERDITS`, `PERIMETRE_EQUITE` | `config.ts` | oui (mutation) | ✓ FLOWING |
| Méthode : écart du jeu de données | `dataset.annonce`, `instantane.total` | `data/dataset-datagouv.yaml` + instantané haché | oui (51 / 59) | ✓ FLOWING |
| Méthode : classement pilote | `resultat.classement` | `classer(data/couverture-themes.yaml)` | oui | ✓ FLOWING |
| Mentions : hébergeur | `heb.*` | `config/hebergeur.yml` | oui (Hetzner) | ✓ FLOWING |
| Mentions : clés de stockage | `CLES_STOCKAGE` | `src/lib/stockage-local.ts` | oui (`rtp:niveau`, `rtp:ordre`) | ✓ FLOWING |

### Vérifications comportementales

| Comportement | Commande | Résultat | Statut |
|---|---|---|---|
| Tests unitaires et dist | `fnm exec --using=24 npm test` | 1646 tests, 1646 pass, 0 fail | ✓ PASS |
| Validation du corpus en production | `npm run validate -- --mode production` | 391 fichiers, 0 erreur, 17 avertissements (`LISIBILITE_ENFANT_FAIBLE`, déjà connus) | ✓ PASS |
| Types | `npm run check` | 186 fichiers, 0 erreur, 0 avertissement, 0 indice | ✓ PASS |
| Build preview du vrai corpus + contrôle | `RTP_MODE=preview npm run build -- --outDir /tmp/…` puis `check-dist --mode preview` | 68 pages ; 0 erreur, 34 avertissements attendus | ✓ PASS |
| La config change la page | copie `git archive`, mutation de 2 bornes, `astro build` | « au plus 27 mots », « ne dépasse pas 14 mots » | ✓ PASS |
| Contenu des pages institutionnelles | grep sur le HTML construit | LCEN art. 1-1, Erwan Henry, Hetzner, droit de réponse, `rtp:niveau`, `rtp:ordre`, aucun cookie, 0 marque tierce ou lien de don | ✓ PASS |
| Suite e2e complète | non relancée (consigne) ; CI | run 41843217660 (HEAD de 05-08) : succès, 222 + 1032 passed. Run 41879201471 (HEAD actuel, après les corrections de revue, dont le nouveau profil 4G) : voir ci-dessous | ✓ PASS (run sur HEAD vert, voir ci-dessous) |

Run CI sur HEAD (5b9dde1, run 41879201471) : conclusion success. Le job e2e passe sur les deux jeux : m1 223 passed, vrai corpus 1033 passed. Mesures 4G à froid (3 sur 3) : `/methode/` (11 257 o gzip), latence-150 334 à 336 ms et slow-4g-lighthouse 1168 ms ; `/themes/sante/` (29 882 o gzip, page la plus lourde du vrai corpus), latence-150 379 à 404 ms et slow-4g-lighthouse 1217 à 1240 ms. Tout est sous budget (1000 et 1500 ms). Nouvel artefact `site-preview` de 317 601 octets, expiration le 2026-11-18T17:39:46Z.

### Exécution des sondes

Aucune sonde `scripts/*/tests/probe-*.sh` n'est déclarée ou présente pour cette phase. Les preuves exécutables sont les commandes ci-dessus.

### Couverture des exigences

| Exigence | Plan source | Description | Statut | Preuve |
|---|---|---|---|---|
| INST-01 | 05-04, 05-08 | Méthode générée depuis la config | ✓ SATISFIED | vérité 1, mutation |
| INST-02 | 05-02 | Mentions légales LCEN, hébergeur, droit de réponse, données | ✓ SATISFIED | vérité 2 |
| INST-03 | 05-02 | Qui sommes-nous sans branding ni don | ✓ SATISFIED | vérité 2, grep 0 |
| INST-04 | 05-02 | dates des deux tours | ✓ SATISFIED | pied de page de chaque page |
| QUAL-02 | 05-01 | sans JS, clavier, axe AA serious/critical | ✓ SATISFIED | specs + CI |
| QUAL-03 | 05-05, WR-04 | 4G lente 150 ms / 1,6 Mbps < 1 s, servie compressée | ✓ SATISFIED (à la lettre, profil `latence-150`) ; profil Lighthouse en plus, budget 1,5 s, décision d'Erwan (humain n° 1) | `4g.spec.ts`, `profil-4g.ts` |
| QUAL-04 | 05-05 | 160 %, reduced-motion, contraste AA des thèmes | ✓ SATISFIED | `texte`, `mouvement`, `contraste` specs |
| QUAL-05 | 05-06, 05-08 | URL de test (artefact CI ou preview locale, `noindex`) | ✓ SATISFIED | artefact `site-preview`, build fraîche `noindex` |
| QUAL-06 | 05-03, 05-07 | test croisé simulé avec journal d'audit | ✓ SATISFIED | `docs/AUDIT-TEST-CROISE.md`, `audit/journal.jsonl` |

Aucune exigence orpheline : les 9 identifiants que REQUIREMENTS.md affecte à la Phase 5 sont tous portés par un plan. Pour l'orchestrateur : les cases de ces 9 exigences sont encore `[ ]` et « Pending » dans `.planning/REQUIREMENTS.md`. Le vérificateur ne les a pas modifiées (consigne : un seul fichier).

### Anti-patterns relevés

| Fichier | Ligne | Motif | Gravité | Impact |
|---|---|---|---|---|
| (fichiers de la phase : `e2e/`, `src/pages/`, `src/lib/`, `scripts/e2e.ts`, `scripts/audit-lire.ts`, `scripts/check-dist.ts`, `ci.yml`, docs) | — | TBD / FIXME / XXX | — | aucun |
| idem | — | TODO / HACK / PLACEHOLDER | — | aucun |
| `CLAUDE.md`, `.planning/research/STACK.md` | — | disent encore que l'audit axe échoue « on any violation », alors que le seuil réel est serious/critical | ℹ️ Info | écart documentaire noté par IN-04. Méthode, README et RUNBOOK publient le vrai seuil. À aligner hors workflow (fichiers d'instructions) |
| `config/site.yml` | — | contact `.invalid` | ℹ️ Info | voulu : garde `CONTACT_PROVISOIRE`, erreur sous `RTP_DEPLOIEMENT=1` (Lot 3) |

### Vérification humaine requise

1. **Lecture de « < 1 s sur 4G ».** Accepter les deux profils publiés (latence-150 avec un budget de 1 s, tenu ; slow-4g-lighthouse avec un budget de 1,5 s) ou demander un changement de conception (CSS en ligne) pour tenir 1 s sur le profil Lighthouse. Attendu : la décision est consignée. Pourquoi humain : c'est une affirmation publiée, et la spec ne nomme pas de profil.
2. **Parcours personnel d'Erwan sur l'URL de test.** Artefact `site-preview` de la dernière CI verte, ou preview locale gzip. Attendu : ce que 05-08 a constaté (bandeau, dates, 37 cartes ou états vides par thème, pages institutionnelles). Pourquoi humain : le critère 4 nomme Erwan, et le parcours a été fait par délégation.
3. **Constats de l'audit croisé S1, S2, S3/O2.** Ce sont eux qui laissent 2 tests bloquants Partiel. Attendu : correction planifiée ou acceptation écrite. Pourquoi humain : décisions de spécification et de libellé.
4. **(Reporté de la Phase 3) Relecture éditoriale du corpus.** Elle couvre C1 à C6, dont 17 avertissements de lisibilité enfant. Pourquoi humain : la relecture humaine est voulue par conception.

### Résumé

Les 5 critères du ROADMAP et les 9 exigences sont tenus dans le code, sans s'appuyer sur les SUMMARY. Le vérificateur a lui-même vérifié que :

- les tests, la validation et les types sont verts ;
- une build preview fraîche passe `check-dist` avec 0 erreur ;
- les pages institutionnelles contiennent les mentions exigées ;
- **un changement de borne dans `config.ts` modifie bien la page Méthode** (test de mutation) ;
- l'artefact `site-preview` existe et n'est pas expiré.

Aucun écart bloquant. Le statut human_needed vient de décisions qui reviennent à Erwan : la lecture du critère 4G (WR-04), son propre parcours de la preview, les constats Partiel de l'audit, et la relecture éditoriale reportée de la Phase 3. Hors milestone v1.0 (Lot 3) : domaine, VPS, relecture juridique, hébergeur `actif` et contact réel.

---

_Vérifié : 2026-11-04_
_Vérificateur : Claude (gsd-verifier)_
