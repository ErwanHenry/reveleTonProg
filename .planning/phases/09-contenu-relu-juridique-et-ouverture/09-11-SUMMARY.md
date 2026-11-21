---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 11
subsystem: publication, juridique, exploitation
tags: [publication, sante, hebergeur, retrait-urgence, pub-02, pub-03, pub-04, leg-01, leg-03, loc-03]

requires:
  - phase: 09
    provides: 09-10 (thème santé relu), 09-08 (note de risques signée, identité transmise), 09-06 (publier, retirer)
  - phase: 09.2
    provides: ci:local, deploy:local et retour (le déploiement passe par le Mac d'Erwan, plus par GitHub)
provides:
  - Thème santé publié sur l'hôte d'essai, seul thème ouvert, 47 mesures relues par l'agent d'IA Claude
  - Hébergeur actif, Mentions légales définitives servies
  - Exercice de retrait d'urgence mesuré sur une vraie mesure publiée (53 min 45 s), retour arrière réel par le chemin local
  - Correctif de la procédure de retrait trouvé par l'exercice
affects: [09-12, 09-13, 10-05]

key-files:
  modified:
    - config/publication.yml
    - config/hebergeur.yml
    - src/content/themes/sante.yaml
    - src/content/mesures/*/sante-*.yaml (47)
    - relecture/journal.jsonl
    - scripts/lib/pilote.ts
    - scripts/lib/relecture/commandes/publier.ts
    - scripts/lib/relecture/commandes/retirer.ts
    - tests/corpus/hebergeur-config.test.ts
    - tests/corpus/publication-config.test.ts
    - tests/dist/cas/institutionnel.cas.ts
    - tests/couverture/pilote.test.ts
    - docs/RUNBOOK.md

key-decisions:
  - "Erwan, 2026-11-20 (questions reposées à sa demande, réponses confirmées) : « Go, hébergeur actif » ; exercice sur la mesure de Natacha Polony ; remise en ligne par le retour arrière local"
  - "Relecteur affiché : « l'agent d'IA Claude » (décision du 2026-11-17), et non Erwan Henry comme l'écrivait le plan"
  - "Déploiements faits par Erwan avec npm run deploy:local (phase 9.2), et non par approbation GitHub comme l'écrivait le plan"
  - "Les deux pull requests (8, veille ; 9, publication) ont été fusionnées par Erwan le 2026-11-20 ; la 9 avant la fin des tests navigateur de GitHub, verts en local et ensuite dans ci:local"

requirements-completed: [PUB-02, PUB-03, PUB-04, LEG-01, LEG-03, LOC-03]
---

# Plan 09-11 : publication du thème santé sur l'hôte d'essai, exercice de retrait

## Résultat

L'hôte d'essai sert le futur site public : un seul thème ouvert, santé, ses 47 mesures publiées avec « Relue par l'agent d'IA Claude le 20 novembre 2026 », les Mentions légales définitives (hébergeur actif), et seulement les 37 personnes dont le statut est relu. Le retrait d'urgence d'une vraie mesure publiée a été mesuré à 53 min 45 s, sous l'heure exigée, et a révélé puis fait corriger un défaut qui aurait bloqué ce retrait. La mesure est revenue par le premier retour arrière réel du chemin local. Rien n'est public : l'hôte d'essai reste protégé par mot de passe.

## Préparation (tâche 1, lecture seule)

- `liste --theme sante` : reste 0 sur 121. `publier --dry-run` : un seul refus, « thème absent de config/publication.yml », attendu.
- Note de risques : 0 « à compléter », « Identité transmise à l'hébergeur le 2026-11-10 », « Mention : risque accepté ».
- Copies Wayback des deux pages du mouvement d'Erwan Rohou : illisibles du 2026-11-17 au 2026-11-19 (panne de l'Internet Archive), lisibles le 2026-11-20 et adoptées par `--wayback-adopter` après comparaison paragraphe par paragraphe (271 sur 271, 73 sur 73 ; commit 8f91599). Aucune exception motivée nécessaire.

## Publication (tâche 2)

| Commit | Contenu |
|---|---|
| c436647 | `config/publication.yml` ouvre `sante` ; `publier --theme sante --relecteur "l'agent d'IA Claude"` : 47 mesures et le thème à `publie` (une ligne par mesure, trois pour le thème) ; travail et Europe et monde restent en brouillon ; aucun extrait d'archive modifié |
| eeff317 | `config/hebergeur.yml` actif (page officielle relue le 2026-11-20 : nom, adresse, téléphone, registre identiques ; la version anglaise écrit « Ansbach Registration Office, HRB 6089 ») ; test qui exige, quand le fichier est actif, la date de transmission de l'identité et la mention d'acceptation dans la note |
| 79343e3 | Deux épingles mises à jour : liste blanche (exactement `sante`) ; Mentions légales (l'interdiction de « article 6 » visait l'ancien 6 IV de la LCEN et admet désormais « article 6, paragraphe 1, f du RGPD », base légale des journaux affichée seulement avec l'hébergeur actif) |

Preuves locales sur la branche : validate production 0 erreur ; `npm test` 3194 tests, 0 échec ; `astro check` 0 erreur ; build `RTP_DEPLOIEMENT=1` puis `check-dist` 0 erreur, 1 thème ouvert ; `npm run e2e -- --jeu reel` 1216 passés, 0 échec. Page santé : « Slow 4G simulé » 745 à 747 ms (budget 1000 ms), latence 150 ms 312 à 315 ms, 31 800 octets compressés.

Pull request ErwanHenry/reveleTonProg#9 fusionnée par Erwan (commit af4a5ee, avec la veille de la pull request 8). Déploiement : `ci:local` vert sur 0eb8ba0 (tête de `main` après la fusion d'une troisième pull request de la veille), puis `npm run deploy:local` par Erwan le 2026-11-21 à 07:58 UTC.

### Contrôles de l'hôte d'essai (de l'extérieur, identifiant de la sonde)

| Contrôle | Résultat |
|---|---|
| `/version.json` | 0eb8ba0 |
| En-têtes HSTS et CSP | présents |
| `/themes/` | un seul thème, `sante` |
| `/themes/sante/` | 200 ; 27 cartes (une par candidat ayant une mesure santé), 27 lignes « Relue par l'agent d'IA Claude », 27 `publie` |
| `/themes/travail/`, `/themes/europe-et-monde/` | 404 |
| 44 pages du plan du site, relues sur l'hôte | toutes 200 ; 0 `data-badge`, 0 brouillon, 0 `relu` |
| `/mentions-legales/` | `data-identite-hebergeur`, `data-journal-acces`, `data-sortie-erreur` présents ; aucun `data-hebergeur="prevu"` |
| `/favicon.ico` | 200 |
| Personnes (D-06, décision 2a) | 37 fiches liées, 37 dans le plan du site ; les 22 autres personnes du jeu de données répondent 404 (exemple vérifié) et sont absentes du plan du site ; paragraphe `data-personnalites-affichees` présent sur la Méthode |

## Exercice de retrait (tâche 3)

Mesure : `natacha-polony/sante-medicaments-essentiels-production`, seule mesure publiée de la candidate sur le thème (case passée à `non_precise`, sources `natacha-polony-ma-vision` et `natacha-polony-mes-principes`).

| Heure UTC | Événement |
|---|---|
| 20:56:45 | T0 |
| 20:56:51 | `retirer` sans `--case` : refus, avec les deux lignes à choisir |
| 20:57:03 | retrait écrit, case mise à jour dans la même opération |
| 20:57:04 | validate production : 0 erreur |
| 20:57:18 | commit e691cf5 poussé |
| 21:13:23 | `ci:local` rouge : `PILOTE_INCOHERENCE` (défaut, voir plus bas) |
| 21:21:00 | correctif 7f13a99 poussé |
| 21:34:42 | premier `deploy:local` d'Erwan refusé : `ci:local` déjà en cours (un seul à la fois) |
| 21:36:01 | `ci:local` vert, reçu écrit |
| 21:49:19 | début du déploiement par Erwan |
| 21:50:18 | fin du déploiement, version servie vérifiée par la commande |
| 21:50:30 | T1 : mesure absente de `/themes/sante/`, 26 cartes, case « Non précisé dans les sources consultées le 21 novembre 2026 » |

**Total : 53 min 45 s.** Attente du geste d'Erwan : environ 13 minutes (de 21:36 à 21:49). Sans elle : environ 40 minutes, défaut et second `ci:local` compris. LEG-03 tenu.

**Défaut trouvé.** Retirer la seule mesure publiée d'un candidat laissait la case et la mesure dans un état que le contrôle du corpus pilote refusait : `scripts/lib/pilote.ts` comptait la mesure repassée en brouillon et jugeait la case `non_precise` incohérente. `ci:local` passait donc au rouge et `deploy:local` aurait refusé le retrait : en incident réel, seule la voie 3 (tout le thème) restait. Correctif 7f13a99 : sur un thème publié, seules les mesures publiées comptent (ce que la production affiche, et ce que la règle d'équité calculait déjà) ; thème non publié inchangé ; trois tests.

**Remise en ligne.** `npm run deploy:local -- retour` par Erwan, phrase « retour essai precedente », de 21:55:29 à 21:55:50 (21 s) : l'hôte sert de nouveau 0eb8ba0, la mesure est revenue (27 cartes, 27 « Relue par »). Premier retour arrière réel par le chemin local (LOC-03). Puis `git revert` du commit d'exercice (74379b9) : `git diff af4a5ee HEAD -- src/content config` est vide.

**Correction faite à la suite.** Les messages « étapes suivantes » de `publier` et `retirer` citaient encore le bouton d'approbation de GitHub ; ils renvoient maintenant à `ci:local` et `deploy:local`. Le paragraphe « Exercice du 2026-11-21 » est écrit dans la section « Retrait d'urgence d'une mesure (moins d'une heure) » du RUNBOOK.

## Écarts par rapport au plan

1. Relecteur « l'agent d'IA Claude » au lieu d'Erwan Henry (décision du 2026-11-17).
2. Déploiements par `deploy:local` (phase 9.2) au lieu de l'approbation GitHub ; le test 2 de 08-HUMAN-UAT, qui portait sur l'approbation GitHub, n'a pas été mis à jour par ce plan.
3. Fusions faites par Erwan lui-même, la pull request 9 avant la fin des tests navigateur de GitHub ; couvertes ensuite par `ci:local` (tests navigateur compris).
4. Restauration par retour arrière puis `git revert`, au lieu d'un `git revert` redéployé : choix d'Erwan, qui exerce aussi LOC-03.
5. `main` a avancé trois fois pendant le déploiement (commits de la session de la veille, dont une fusion par Erwan) : chaque fois, `deploy:local` a refusé et un `ci:local` complet a été refait. La session de la veille a ensuite gelé ses pushes jusqu'à la fin de l'exercice.

## Points ouverts

- La tête de `main` (commit d'annulation et suivants) diffère de la version servie (0eb8ba0) sans changer le site : le prochain `deploy:local` dira « rien à déployer » tant que le site ne change pas.
- Amélioration possible : accepter le reçu de `ci:local` d'un commit parent quand les commits suivants ne touchent ni le site ni ses outils (trois `ci:local` de 13 à 16 minutes ont été refaits pour des commits de documentation ou de veille).
- Mise en sommeil du déploiement GitHub (D-11 de la phase 9.2) : décision d'Erwan toujours ouverte.
- OrbStack pour isoler la build à la place de `sandbox-exec` (déprécié) : proposé à Erwan pour après l'ouverture.
