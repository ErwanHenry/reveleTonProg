---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 10
subsystem: contenu, relecture
tags: [relecture, sante, agent-ia, pub-01, pub-02, pub-03]

requires:
  - phase: 09
    provides: outil de relecture (09-05, 09-06), filtre de production (09-15), exception Wayback (09-03)
provides:
  - Thème santé entièrement relu sur main : 47 mesures, 37 statuts de candidature, 37 cases de couverture
  - Source erwan-rohou-communique-mei-candidature (lien entre le candidat et le mouvement)
  - Source erwan-rohou-programme-mei recapturée à sa nouvelle adresse, exception Wayback retirée
  - Mention publique de la page Méthode et avenant à la note de risques (relecture par agent d'IA)
affects: [09-11, 09-12, 09-13, 10-05]

key-files:
  created:
    - src/content/sources/erwan-rohou-communique-mei-candidature.yaml
    - archives/erwan-rohou/4bcf24185901.txt
    - archives/erwan-rohou/ac03771a1fbf.txt
    - .planning/phases/09-contenu-relu-juridique-et-ouverture/relecture-agent/ (onze rapports)
  modified:
    - src/content/mesures/*/sante-*.yaml (47)
    - src/content/candidats/*.yaml (37)
    - src/content/couverture/sante.yaml
    - src/content/sources/ (5 sources existantes)
    - relecture/journal.jsonl
    - src/pages/methode.astro
    - docs/RISQUES-JURIDIQUES.md
    - docs/RUNBOOK.md
    - tests/rules/sources-wayback.test.ts
    - tests/relecture/editer.test.ts
    - tests/repo/revision-pages.test.ts

key-decisions:
  - "Erwan, 2026-11-17 : « Je ne vais pas valider les 120 à la main », puis « Ne pas relire ou alors tu fais relire par un agent » : la relecture est faite par des agents d'IA, pas par l'éditeur"
  - "Erwan, 2026-11-17 : « Agent d'IA, nommé » : la mention publique nomme l'agent ; valeur écrite « l'agent d'IA Claude » (la règle de forme du nom de relecteur refuse les parenthèses)"
  - "Erwan, 2026-11-17 : « Agent corrige, autre agent revérifie » et « Suivre le jeu, le dire, signaler les doutes »"
  - "Erwan, 2026-11-17 : « Suis ton avis » sur cinq points éditoriaux (voir 09-CONTEXT.md, révision du même jour)"
  - "Erwan, 2026-11-17 : « Oui, Wayback compris » pour les deux nouvelles pages du mouvement d'Erwan Rohou"
  - "Erwan, 2026-11-17 : « Suis ton avis » : case de Sylvain Durif gardée à « programme non publié », phrase de la page Méthode"
  - "Erwan, 2026-11-17 : « Oui, j'accepte l'avenant » (note de risques)"
  - "Erwan, 2026-11-18 : « Oui, fusionne »"

requirements-completed: []
---

# Plan 09-10 : relecture du thème santé

## Résultat

Le thème santé est relu en entier et la relecture est sur `main` (pull request ErwanHenry/reveleTonProg#4, fusionnée le 2026-11-18 par commit de fusion `eba173e`). Rien n'est publié : les mesures sont `relu`, pas `publie`, et le thème n'est pas dans `config/publication.yml`.

Le plan prévoyait une relecture par Erwan. Il a décidé le 2026-11-17 de la confier à des agents d'IA. Le plan a donc été exécuté autrement que prévu, et ce résumé le dit sans détour : **aucune mesure n'a été relue par un humain**, sauf le statut de candidature de François Asselineau, validé par Erwan dans la page de relecture.

## Comment la relecture a été faite

Trois passes contre la source archivée, par des agents distincts :

1. Relecture : deux agents (lots A et B) comparent chaque rédaction à `texte_source` et à l'extrait archivé. 12 mesures conformes d'emblée, 35 à corriger.
2. Correction : un agent corrige les rédactions rattachées à un constat. Interdits tenus : `texte_source`, `archives/**`, toute correction sans constat.
3. Seconde relecture indépendante : un autre agent revérifie chaque correction ; retouches puis verdict final.

Les statuts de candidature ne sont plus affirmés par le site : ils sont attribués au jeu de données public et à la source qu'il cite (commit ff7328e). 17 statuts conformes, 20 doutes traités par cette formulation.

Rapports : `.planning/phases/09-contenu-relu-juridique-et-ouverture/relecture-agent/` (mesures-A, mesures-B, statuts-et-cases, corrections-A, corrections-B, seconde-relecture-A, seconde-relecture-B, retouches-seconde-relecture, statuts-sources-relues, decisions-3-et-5, lien-rohou-mouvement, recontrole-rohou).

## Contrôles de clôture (tâche 3 du plan, adaptée)

| Contrôle | Résultat |
|---|---|
| `liste --theme sante --relecteur "l'agent d'IA Claude"` | reste 0 sur 121, aucune note ouverte |
| `validate` en modes preview et production | 0 erreur, 18 avertissements ; plus aucun `COUVERTURE_VERIFIEE_AVANT_SOURCE` en santé |
| Mesures santé `relu` | 47, toutes `relecteur: l'agent d'IA Claude` |
| Statuts `relu` | 37 : 36 par l'agent, 1 par Erwan Henry |
| Cases de couverture | 37, toutes `verifie_par: l'agent d'IA Claude` |
| `npm test` sur la branche à jour avec main | 2893 tests, 0 échec |
| CI | verte sur la pull request (d1c56af) avant fusion |

### Audit des rédactions

44 fichiers de `src/content` portent des lignes modifiées hors des cinq champs de relecture : 37 mesures, 1 fiche candidat, 6 sources. Vérification automatique : chaque mesure est nommée dans au moins un rapport de correction ou de seconde relecture ; aucune modification sans rapport. Les 6 sources et la fiche candidat sont rattachées à `decisions-3-et-5.md`, `corrections-B.md`, `lien-rohou-mouvement.md` et `recontrole-rohou.md`.

L'audit prévu par le plan comparait chaque ligne aux corrections validées par Erwan. Il n'a pas validé les corrections une à une : il a validé la méthode (« Agent corrige, autre agent revérifie »). L'audit porte donc sur le rattachement de chaque fichier à un rapport, pas sur une validation humaine ligne à ligne.

### Audit du périmètre

Hors du périmètre prévu par le plan, tout est connu et motivé :

| Fichier | Motif |
|---|---|
| `archives/erwan-rohou/4bcf24185901.txt`, `ac03771a1fbf.txt` | nouveaux extraits écrits par l'outil d'archivage (programme recapturé, communiqué) ; aucun extrait existant modifié |
| 6 fichiers de `src/content/sources/` | dates de publication de trois sources, auteur d'une source, titre d'une page non datée, source Rohou recapturée, nouveau communiqué |
| 2 mesures Europe et monde d'Erwan Rohou | seul le numéro de proposition de `source_localisation` (30 et 31 deviennent 31 et 32 sur la nouvelle page) |
| `docs/RUNBOOK.md`, `tests/rules/sources-wayback.test.ts` | exception Wayback retirée, liste épinglée vide |
| `tests/relecture/editer.test.ts` | le test supposait un corpus entièrement en brouillon |

## Écarts par rapport au plan

1. **Relecteur.** Agents d'IA au lieu d'Erwan (décision d'Erwan). Conséquences traitées : mention publique sous chaque mesure, phrase de la page Méthode (« Ce n'est pas une relecture humaine de chaque texte »), avenant du 2026-11-17 à `docs/RISQUES-JURIDIQUES.md` accepté par Erwan.
2. **`marquer` lancé par l'orchestrateur.** Le plan l'interdisait pour ne jamais poser une marque au nom d'Erwan. Les marques sont au nom de l'agent, jamais au sien ; la seule marque à son nom vient de sa propre session.
3. **Nom du relecteur.** « Claude (agent d'IA) » est refusé par la règle de forme de l'outil (parenthèses). Valeur retenue sans assouplir la règle : « l'agent d'IA Claude ».
4. **Source d'Erwan Rohou.** L'adresse du programme répondait 404. Communiqué du 2026-09-04 archivé comme preuve du lien, programme recapturé, `parti` et `parti_source` inscrits sur la fiche, deux mesures reformulées selon la règle du parti puis recontrôlées (deux écarts corrigés, verdict conforme).
5. **Branche et worktree gardés.** Le plan prévoyait de supprimer la branche distante et le worktree après la fusion. Non fait : la page de relecture d'Erwan peut encore tourner depuis ce worktree, et aucun agent n'arrête un de ses processus.

## Points ouverts

- **Copies Wayback des deux pages du mouvement (bloque 09-11).** L'Internet Archive indexe un instantané du 2026-11-17 pour chacune, mais leur lecture renvoie « page non archivée » (captures prises pendant une panne du service). Les liens n'ont pas été enregistrés. À relancer avec `--wayback-only` ; si l'échec persiste, une exception motivée est une décision d'Erwan.
- **Outil d'archivage.** `--wayback-only` enregistre le lien renvoyé par le service sans vérifier que l'instantané s'ouvre. À corriger avant l'ouverture.
- **Hors périmètre, à reprendre à la relecture des thèmes travail et Europe et monde :** quatre mesures d'Erwan Rohou gardent l'ancien nom du mouvement et la formule « selon l'accueil du mouvement » ; deux mesures de Jean-Luc Mélenchon du thème travail sont à réattribuer au parti.
- **Signalement au responsable du jeu de données** (7 statuts sans déclaration formelle, une dépêche hors ligne) : à rédiger, envoi seulement avec l'accord d'Erwan.
- **Chiffrages des candidats** absents des citations : champ dédié à planifier après l'ouverture.
- **Ancien extrait `archives/erwan-rohou/e4e379a88baa.txt`** : plus cité, laissé en place.
- **Exigences PUB-01 à PUB-03** : cochées à la publication (09-11), pas ici.
