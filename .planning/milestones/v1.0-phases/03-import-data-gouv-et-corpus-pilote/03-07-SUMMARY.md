---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 07
subsystem: content
tags: [corpus, travail, brouillon, couverture, glossaire, archives]
requires:
  - phase: 03-import-data-gouv-et-corpus-pilote
    provides: "03-06 : theme sante livre, glossaire et sources partages ; 03-05 : themes pilotes (travail en position 1)"
provides:
  - "Theme travail complet en brouillon : 37 cases (un candidat = une case), 44 mesures sourcees, 30 entrees de glossaire"
  - "travail ajoute a pilote.livres : l'exhaustivite des cases est imposee par tests/corpus/pilote.test.ts"
affects: [03-08, 03-09, relecture Erwan]
tech-stack:
  added: []
  patterns:
    - "texte_source verbatim copie depuis l'extrait archive, validee par TEXTE_SOURCE_HORS_ARCHIVE"
key-files:
  created:
    - src/content/themes/travail.yaml
    - src/content/couverture/travail.yaml
    - "src/content/mesures/*/travail-*.yaml (44)"
    - "src/content/glossaire/*.yaml (30 entrees)"
  modified:
    - data/couverture-themes.yaml
    - "src/content/sources/*.yaml (captures rafraichies, Wayback)"
key-decisions:
  - "Theme pilote 2 = travail (et non impots) : substitution lue dans pilote.themes[1]"
  - "Regle des 2 mesures appliquee par ordre de la source ; ecarts signales sous 'Points a relire'"
  - "Retailleau : textes cites du livret (plus precis) et non des cartes de la page theme"
requirements-completed: [CONT-05, CONT-06]
duration: "3 lots"
completed: 2026-11-04
---

# Phase 3 Plan 07 : theme travail, corpus pilote 2 (brouillon) Summary

**Les 37 candidats declares ont une case travail datee du 2026-11-03 : 24 avec 44 mesures a texte_source verbatim (verifie contre l'extrait archive), 7 `programme_non_publie`, 6 `non_precise` ; tout est `brouillon`, rien n'est invente, et `travail` est livre dans `pilote.livres`.**

Detail par lot et par candidat : `03-07-LOTS.md` (source de cette synthese).

## Resultat

- Validateur `--mode preview` et `--mode production` : `0 erreur(s)`, 14 avertissements (tous `LISIBILITE_ENFANT_FAIBLE`, sur des mesures de sante, hors de ce plan). Aucun avertissement sur les mesures travail.
- `tests/corpus/*.test.ts` : 107 pass, 0 fail ; `ids --check` : 0 probleme ; `couverture-scan --check-data` : exit 0 ; `npm run check` : 0 erreur, 0 avertissement, 0 indice ; `npm test` (suite complete) : 1473 pass, 60 fail, tous hors perimetre du contenu : builds Astro de `tests/dist/cas/*` (statut null, delais de 23 min, collision « vite config has changed » avec les executeurs de la phase 5 qui travaillent en parallele) et deux tests de depot prive git (`--sync-private`, `pull --rebase`, qui bloquent aussi isoles). Aucun echec dans `tests/corpus`. A relancer sans execution concurrente.
- Perimetre : 37 candidats `declare`, 0 `primaire`.
- Sous-themes (9) : salaires, temps-de-travail, droit-du-travail, chomage-et-emploi, formation-et-transitions, partage-de-la-valeur, dialogue-social (non utilise), travail-illegal, fiscalite-et-financement.

### Totaux

| | Lot 1 | Lot 2 | Lot 3 | Total |
|---|---|---|---|---|
| Candidats | 12 | 13 | 12 | 37 |
| Mesures `brouillon` | 14 | 14 | 16 | 44 |
| Cases `mesures` | 8 | 8 | 8 | 24 |
| Cases `non_precise` | 1 | 2 | 3 | 6 |
| Cases `programme_non_publie` | 3 | 3 | 1 | 7 |
| Entrees de glossaire creees | 10 | 12 | 8 | 30 |

## Resultat par candidat

| # | id | etat | mesures / sources consultees |
|---|----|------|------------------------------|
| 1 | nathalie-arthaud | mesures | hausse-salaires-indexation, repartition-du-travail |
| 2 | francois-asselineau | programme_non_publie | upr.fr : programme 2027 « publie prochainement » |
| 3 | gabriel-attal | mesures | constitution-du-travail, reforme-assurance-chomage |
| 4 | delphine-batho | non_precise | priorite-1, -2, -4 |
| 5 | olivier-becht | mesures | contrat-unique, actionnariat-salarie |
| 6 | xavier-bertrand | programme_non_publie | nousfrance.fr : aucune mesure |
| 7 | augustin-billetdoux | programme_non_publie | pas de programme |
| 8 | karim-bouamrane | mesures | valoriser-le-travail |
| 9 | juan-branco | mesures | service-public-emploi |
| 10 | bernard-cazeneuve | mesures | transitions-professionnelles, apprentissage-stages-cdi |
| 11 | christian-collovati | mesures | fin-35-heures, travail-dissimule |
| 12 | emmanuel-dubuisson | mesures | cotisations-partage-valeur, egalite-salariale |
| 13 | nicolas-dupont-aignan | mesures | exoneration-charges-embauche, defiscalisation-heures-supplementaires |
| 14 | sylvain-durif | programme_non_publie | communique de suspension |
| 15 | clara-egger | non_precise | notre-solution, parrainage-2027, presentation-candidate |
| 16 | raphael-glucksmann | mesures | conferences-salariales, chantier-fiscal |
| 17 | anasse-kazib | mesures | smic-salaires, semaine-28-heures |
| 18 | selma-labib | mesures | hausse-salaires-indexation, interdiction-licenciements-temps-travail |
| 19 | francis-lalanne | mesures | soutien-petites-entreprises-charges |
| 20 | marine-le-pen | programme_non_publie | aucun programme presidentiel 2027 |
| 21 | jean-francois-legendre | mesures | taxer-finance-internationale |
| 22 | david-lisnard | mesures | contrat-unique, charges-embauches-rsa |
| 23 | mira-markovic | programme_non_publie | page de candidature |
| 24 | benoit-mathieu | non_precise | programme, le-candidat |
| 25 | jean-luc-melenchon | mesures | smic-1700, abrogation-reformes-assurance-chomage |
| 26 | antoine-mikolajczak | non_precise | tract-campagne, manifeste-equinoxe |
| 27 | manolo-mlekuz | non_precise | programme, programme-detaille |
| 28 | edouard-philippe | mesures | temps-de-travail-libre, travail-supplementaire-exonere |
| 29 | florian-philippot | mesures | reindustrialisation-emplois, indemnites-chomage-hors-ue |
| 30 | gilles-platret | programme_non_publie | aucun site de campagne |
| 31 | natacha-polony | non_precise | ma-vision, mes-principes |
| 32 | bruno-retailleau | mesures | redonner-pouvoir-achat-salaries (chiffrage), seuil-zero-cotisation |
| 33 | erwan-rohou | mesures | relocalisation-emplois-industriels, aide-petites-entreprises-travail-manuel |
| 34 | fabien-roussel | mesures | securite-emploi-formation, cotisations-patronales-modulees |
| 35 | francois-ruffin | mesures | salaires-indexes-inflation, grilles-classification |
| 36 | marine-tondelier | mesures | salaire-minimum-2000-brut, traitements-fonctionnaires |
| 37 | eric-zemmour | mesures | salaire-net-salaire-brut, csg-revenus-du-travail |

(Tous les ids de mesures sont prefixes `travail-`.)

## Sources

- Rafraichies en direct : toutes les sources non manuelles utilisees ou consultees (extraits inchangés, seule `capture_le` change ; deux nouveaux binaires au lot 3).
- Creees (dates de publication inconnues, mois de capture `2026-11`) : gabriel-attal-travail-constitution, -assurance-chomage, -salaires ; olivier-becht-refondation-sociale ; emmanuel-dubuisson-travail-richesse ; nicolas-dupont-aignan-travail-economie-travail ; bruno-retailleau-travail-page-theme.
- Saisies manuelles citees (`fichier-manuel`, non rafraichissables) : delphine-batho-priorite-1/2/4 (non citees), jean-francois-legendre-manifeste, erwan-rohou-programme-mei, marine-tondelier-programme-prosperite-ecologique.
- Wayback : sur les 40 sources citees par le theme, 36 ont une URL Wayback ; manquantes : Batho x3 (captures manuelles), Rohou (delai depasse). Echecs hors theme/non citees : becht-livre-partie-7, dubuisson-travail-richesse, retailleau-manifeste, tondelier-livret-sante-reproductive (HTTP 429). Reprise : `--wayback-only <id>`.

## Points a relire par Erwan

1. **Selection des mesures (regle « les 2 premieres de la source »)** : substitutions possibles a decider pour Branco (1 seule mesure, 2e puce administrative illisible), Glucksmann (le SMIC a 1600 euros net non retenu), Kazib (interdiction des licenciements refusee : texte de 3 mots), Rohou (credit formation d'un an = proposition 3), Tondelier (chapitre 14 « Travailler mieux » non retenu), Retailleau (cartes 26-29 non retenues), Philippe (assurance chomage a 12 mois non retenue), Roussel (modulation des cotisations hors section travail).
2. **Cases `non_precise` vs mesure de principe** : Batho, Egger, Mathieu, Mikolajczak, Mlekuz, Polony (sans mesure) contre Bouamrane (une mesure de principe). Arbitrage de jugement a harmoniser.
3. **Zemmour** : seulement des enonces fiscaux (net/brut, CSG sur revenus du travail) ; `non_precise` serait defendable. Le fragment « supprimer la CSG… » est tire d'une phrase qui cite aussi accise et droits de succession.
4. **Retailleau** : `chiffrage` = « au moins 30 milliards d'euros de gains, restitues » (gain redistribue, pas un cout) ; textes du livret LR publie sur le site du candidat (`auteur: parti_du_candidat`).
5. **Philippot** : mesure 1 (reindustrialisation) a la limite du theme ; mesure 2 conditionnee a la sortie de l'UE (dit dans la redaction).
6. **Dupont-Aignan** : incoherence interne entre deux pages (un an / trois mois d'exoneration pour le premier emploi d'un jeune), seule la page Economie est citee.
7. **Melenchon** : source = document d'orientations budgetaires ; le livre du programme (bloque) n'a pas ete lu.
8. **Auteurs et etiquettes** : Branco `coalition` (Les Ruches) ; Glucksmann, Lisnard, Labib, Roussel, Retailleau, Tondelier : documents de parti, dits dans les redactions ; les enfant ne nomment aucun parti.
9. **Glossaire** : 30 definitions redigees de connaissance generale, sans source ; a verifier. Jargon reste sans entree : « negociation », « grands principes », « situations equivalentes », « organismes », « allocations », « grilles de salaires », « indemnite », « concurrence deloyale » (plusieurs expliques dans le texte).
10. **Dates** : captures du 2026-11-03 ; `date_publication` partielle `2026-11` pour les 7 sources creees.

## Marqueurs ajoutes retroactivement

Aucun.

## Contenus suspects

Aucun contenu d'instruction detecte dans les pages lues.

## Donnees personnelles

Un numero de telephone public du parti Debout la France dans l'extrait Dupont-Aignan (non utilise). Aucun autre resultat (e-mail/telephone/jetons) ; gitleaks local indisponible, remplace par un grep de motifs. Depot prive d'archives synchronise, propre, pousse.

## Cases non resolues

Aucune.

## Avertissements restants

14 `LISIBILITE_ENFANT_FAIBLE` (sante, 03-06). `PILOTE_SIGLE_ENFANT` : 0.

## Deviations from Plan

- [Rule 3] Theme substitue : travail a la place d'impots (pilote.themes[1]).
- Corrections de comptage des lots 1-2 (8 et 14 au lieu de 9 et 15) relevees au lot 3.
- Aucune autre deviation.

## Self-Check: PASSED (fichiers, cases et ids relus ; validateur, ids, corpus et check verts ; `npm test` : echecs d'environnement ci-dessus, a confirmer)
