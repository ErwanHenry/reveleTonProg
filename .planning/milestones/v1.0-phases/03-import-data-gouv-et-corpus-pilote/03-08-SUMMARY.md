---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 08
subsystem: content
tags: [corpus, europe-et-monde, brouillon, couverture, glossaire, archives]
requires:
  - phase: 03-import-data-gouv-et-corpus-pilote
    provides: "03-07 : theme travail livre, glossaire et sources partages ; 03-05 : themes pilotes (europe-et-monde en position 3)"
provides:
  - "Theme europe-et-monde complet en brouillon : 37 cases (un candidat = une case), 43 mesures sourcees, 29 entrees de glossaire"
  - "europe-et-monde ajoute a pilote.livres : l'exhaustivite des cases est imposee par tests/corpus/pilote.test.ts"
affects: [03-09, relecture Erwan]
tech-stack:
  added: []
  patterns:
    - "texte_source verbatim copie depuis l'extrait archive, validee par TEXTE_SOURCE_HORS_ARCHIVE"
    - "Principe sans engagement concret : case non_precise (regle de coherence des lots 2 et 3)"
key-files:
  created:
    - src/content/themes/europe-et-monde.yaml
    - src/content/couverture/europe-et-monde.yaml
    - "src/content/mesures/*/europe-et-monde-*.yaml (43)"
    - "src/content/glossaire/*.yaml (29 entrees : 18 + 5 + 6)"
  modified:
    - data/couverture-themes.yaml
    - "src/content/sources/*.yaml (captures rafraichies, Wayback, 3 sources creees)"
key-decisions:
  - "Substitution : le 3e theme pilote est europe-et-monde (pilote.themes[2]), et non retraites ; immigration et frontieres rangees dans ce theme"
  - "Regle des 2 mesures appliquee par ordre de la source ; ecarts signales sous 'Points a relire'"
  - "Aucun developpement de sigle absent du texte_source (UE, OTAN, CEDH, OMS, AME, PUMA gardes tels quels)"
  - "URL Wayback de erwan-rohou-programme-mei retiree (copie non expurgee d'une page avec donnees personnelles)"
requirements-completed: [CONT-05, CONT-06]
duration: "3 lots"
completed: 2026-11-04
---

# Phase 3 Plan 08 : theme europe-et-monde, corpus pilote 3 (brouillon) Summary

**Les 37 candidats declares ont une case europe-et-monde datee du 2026-11-04 : 22 avec 43 mesures a texte_source verbatim (verifie contre l'extrait archive), 7 `programme_non_publie`, 8 `non_precise` ; tout est `brouillon`, rien n'est relu. Le theme est ajoute a `pilote.livres`.**

Detail par lot et par candidat : `03-08-LOTS.md` (source de cette synthese).

## Resultat

- Validateur `--mode preview` et `--mode production` : `0 erreur(s)`, 17 avertissements (tous `LISIBILITE_ENFANT_FAIBLE`, seuil 80).
- `tests/corpus/*.test.ts` : 125 pass, 0 fail ; `ids --check` : 0 probleme ; `couverture-scan --check-data` : exit 0 ; `npm run check` : 0 erreur, 0 avertissement, 0 indice. La suite complete `npm test` n'a pas ete lancee ici (consigne de l'orchestrateur : les tests de build depassent le delai sur ce poste) ; la CI fait foi.
- Perimetre : 37 candidats `declare`, 0 `primaire`.
- Wayback : 6 URLs obtenues sur les 3 lots pour les sources creees (lot 3 : attal-europe-frontieres, dubuisson-europe-outre-mer, dupont-aignan-affaires-europeennes, dupont-aignan-20-mesures, retailleau-manifeste, tondelier-livret-sante-reproductive), 0 echec ; 1 URL volontairement retiree (Rohou).
- Depot prive d'archives synchronise (`--sync-private`), propre, pousse.

## Etat par candidat (37)

| # | id | etat | mesures / sources consultees |
|---|----|------|------------------------------|
| 1 | nathalie-arthaud | mesures | regularisation-sans-papiers, contre-protectionnisme |
| 2 | francois-asselineau | programme_non_publie | programme 2027 annonce comme « publie prochainement » |
| 3 | gabriel-attal | mesures | regroupement-familial, systeme-a-points |
| 4 | delphine-batho | mesures | strategie-geopolitique-offensive (proposition 08, priorite 4) |
| 5 | olivier-becht | mesures | europe-trois-cercles, confederation-europeenne |
| 6 | xavier-bertrand | programme_non_publie | pages europe et immigration reduites au titre |
| 7 | augustin-billetdoux | programme_non_publie | video, pas de texte de programme |
| 8 | karim-bouamrane | mesures | politique-migratoire-trois-exigences, europe-qui-protege |
| 9 | juan-branco | mesures | union-pays-francophones, integration-brics |
| 10 | bernard-cazeneuve | mesures | securite-exterieure-otan, multilateralisme |
| 11 | christian-collovati | mesures | suspension-traites-ue, cooperation-internationale |
| 12 | emmanuel-dubuisson | non_precise | emmanuel-dubuisson-projet, -ce-qui-change, -europe-outre-mer |
| 13 | nicolas-dupont-aignan | mesures | referendum-appartenance-ue, sortie-schengen |
| 14 | sylvain-durif | programme_non_publie | seul un communique est servi |
| 15 | clara-egger | non_precise | clara-egger-parrainage-2027, -presentation-candidate, -notre-solution |
| 16 | raphael-glucksmann | mesures | production-industrielle-defense, drones-spatial-ia-defense |
| 17 | anasse-kazib | mesures | regularisation-sans-papiers, pas-un-euro-pour-la-guerre |
| 18 | selma-labib | non_precise | selma-labib-4-pages-campagne |
| 19 | francis-lalanne | mesures | frexit-organise, sortie-otan |
| 20 | marine-le-pen | programme_non_publie | seuls des programmes d'elections precedentes |
| 21 | jean-francois-legendre | mesures | renegociation-directives-ue, demondialisation |
| 22 | david-lisnard | mesures | traite-democratisation-europe, referendum-blocage-supranational |
| 23 | mira-markovic | programme_non_publie | parrainages et programmes passes uniquement |
| 24 | benoit-mathieu | non_precise | benoit-mathieu-programme, -le-candidat |
| 25 | jean-luc-melenchon | non_precise | -lettre-au-peuple, -comptes-publics, -pole-public-bancaire |
| 26 | antoine-mikolajczak | non_precise | -manifeste-equinoxe, -tract-campagne |
| 27 | manolo-mlekuz | non_precise | -programme, -programme-detaille |
| 28 | edouard-philippe | mesures | immigration-diviser-par-deux, accord-1968-algerie |
| 29 | florian-philippot | mesures | sortie-instances-supranationales, objectif-frexit |
| 30 | gilles-platret | programme_non_publie | aucun site de campagne ou de programme |
| 31 | natacha-polony | non_precise | -ma-vision, -mes-principes |
| 32 | bruno-retailleau | mesures | clause-sauvegarde-nationale, non-application-droit-europeen |
| 33 | erwan-rohou | mesures | onu-siege-oslo, droit-international-nuremberg |
| 34 | fabien-roussel | mesures | politique-paix-independante, droit-international-partout |
| 35 | francois-ruffin | mesures | protection-contre-concurrence-deloyale, buy-french-act |
| 36 | marine-tondelier | mesures | droits-personnes-exilees, regularisation-criteres-objectifs |
| 37 | eric-zemmour | mesures | arreter-immigration-expulsions, suppression-aide-developpement |

Les identifiants de mesure sont `<candidat>/europe-et-monde-<sujet>` ; l'etat par candidat et les sources par lot sont dans `03-08-LOTS.md`.

Totaux : 22 candidats avec mesures (43 mesures : 15 au lot 1, 12 au lot 2, 16 au lot 3), 8 `non_precise`, 7 `programme_non_publie`. Aucune case non resolue.

## Sources

- Rafraichies en direct le 2026-11-04 (`--refresh`, extraits inchanges, memes sha256) : toutes les sources non manuelles citees ou consultees par les 37 cases ; le detail par lot est dans `03-08-LOTS.md`.
- Creees au total : 3 (`gabriel-attal-europe-frontieres`, `emmanuel-dubuisson-europe-outre-mer`, `nicolas-dupont-aignan-europe-et-monde-affaires-europeennes`), `date_publication` = mois de capture (« date de publication inconnue, mois de capture »), jamais un jour invente. Aucune au lot 3.
- Non rafraichissables (captures manuelles) : `delphine-batho-priorite-4`, `jean-francois-legendre-manifeste`, `erwan-rohou-programme-mei`, `marine-tondelier-programme-prosperite-ecologique`.

## Glossaire

29 entrees `terme` creees (18 au lot 1, 5 au lot 2, 6 au lot 3) : aucune entree `parti`, aucun exemple tire d'un candidat. Lot 3 : `libre-echange`, `douane`, `droit-international`, `commande-publique`, `exil` (« personne exilee »), `aide-publique-au-developpement`. Toutes les definitions sont redigees de connaissance generale (pas de source) : a verifier.

## Points à relire par Erwan

Consolidation des trois lots (detail et citations dans `03-08-LOTS.md`).

1. **Selection des 2 mesures** (regle « les 2 premieres de la source », identique pour tous). A revoir si une mesure centrale est laissee de cote :
   - Branco (lot 1) : section « L'Exterieur et la Defense » (Union des pays francophones, BRICS) retenue ; la sortie de l'UE et de l'euro (section 13) n'est pas retenue.
   - Cazeneuve (lot 1) : propositions 25 et 26 (OTAN, multilateralisme) ; l'Europe (27) et l'immigration (28) ne sont pas retenues.
   - Bouamrane (lot 1) : la defense et le rang de la France ne sont pas retenus.
   - Collovati (lot 1) : Europe et International retenus ; immigration et controle aux frontieres non retenus.
   - Attal, Batho (lot 1) : Attal limite aux deux mesures du chantier Frontieres ; Batho une seule mesure (proposition 08).
   - Glucksmann, Dupont-Aignan, Lisnard, Legendre, Kazib, Lalanne (lot 2) : voir LOTS.
   - Philippe (lot 3) : frontieres retenues ; marche unique, Chine, Schengen non retenus.
   - Philippot (lot 3) : deux mesures qui se recoupent (sortie de l'UE) ; « Guerre et paix » (OTAN, armee europeenne), « Cout de l'Europe » et « Immigration » non retenus.
   - Roussel (lot 3) : les points I et II de la partie propositions ; « 3.1 Sortie et dissolution de l'OTAN », la mesure la plus precise, non retenue.
   - Tondelier (lot 3) : deux propositions du chapitre 56 (migrations) ; **toute la partie VIII « Une Europe democratique dans un monde en paix » non retenue**.
   - Retailleau, Ruffin, Rohou, Zemmour (lot 3) : voir LOTS (Ruffin : `plan des 100 produits` du livret non retenu ; Zemmour : l'aide au developpement vient du tract « pouvoir d'achat »).
2. **`non_precise` par regle de coherence « principe sans engagement concret »** : Labib, Melenchon (lot 2), Mikolajczak, Polony (lot 3). La couverture 03-04 notait `partiel` pour plusieurs. Dubuisson (outre-mer sans engagement sur l'Europe), Egger (comparaisons), Mathieu (« aucun programme »), Mlekuz (silence) sont aussi `non_precise`.
3. **`programme_non_publie` verifie en direct** (Asselineau, Bertrand, Billetdoux, Durif, Le Pen, Markovic, Platret). Marine Le Pen : seuls des programmes passes ; a confirmer avant publication.
4. **Rohou (MEI)** : programme d'apparence ancienne (« traite constitutionnel », « guerre en Irak ») ; date de publication inconnue ; URL Wayback retiree volontairement (page avec donnees personnelles de particuliers). Decision a prendre.
5. **Tondelier, Roussel, Philippot, Zemmour, Retailleau** : documents de parti pour Tondelier, Roussel (PCF), Philippot (Les Patriotes), Zemmour (Reconquete) ; `auteur: parti_du_candidat` et les redactions le disent.
6. **Roussel** : `texte_source` avec « EtatsUnis » (trait d'union perdu a l'extraction), cite tel quel. Zemmour (APD) : verifier visuellement que « 15 milliards € » se rapporte bien a la ligne (mise en page du tract).
7. **Sigles** : aucun sigle developpe dans les redactions hors du texte source ; les enfant utilisent des marqueurs de glossaire sur UE et OTAN. En revanche, le lot 1 developpe OTAN en toutes lettres dans quelques textes (Cazeneuve, Lalanne au lot 2) et OIF (Branco) : a harmoniser si la regle « jamais d'expansion » doit s'appliquer retroactivement.
8. **Phrases de definition de l'aine tirees du glossaire**, absentes du texte_source (referendum, Schengen, BRICS, Commonwealth, etc., lots 1 et 2). A verifier.
9. **Glossaire** : 29 definitions de connaissance generale, sans source.
10. **Doutes de contenu** : Collovati (« Etat des lieux »), Cazeneuve (sigle OTAN developpe, « sans rien y abdiquer » rendu « sans rien ceder »), Becht (« notre prosperite »), Bouamrane (« reconduire »), Arthaud (« Cela s'appelle la regularisation »), Branco (`auteur: coalition`).

## Avertissements du validateur restants

17 × `LISIBILITE_ENFANT_FAIBLE` (Kandel-Moles < 80) : 3 sur ce theme, `juan-branco/europe-et-monde-union-pays-francophones` (73,6), `olivier-becht/europe-et-monde-confederation-europeenne` (72,3), `erwan-rohou/europe-et-monde-droit-international-nuremberg` (68,5) ; 14 sur les themes sante et travail (03-06, 03-07). Aucun `PILOTE_SIGLE_ENFANT`, `PHRASE_ENFANT_LONGUE`, `VERBE_CONNOTE` ni `NOMBRE_LETTRES_HORS_SOURCE`. Les 40 autres mesures du theme sont >= 80.

## Marqueurs ajoutes retroactivement

Aucun sur les trois lots (`tests/corpus` vert, 125 tests).

## Contenus suspects

Aucun contenu d'instruction detecte dans les pages lues.

## Données personnelles et secrets

Aucun e-mail ni telephone prive dans les extraits utilises. Coordonnees publiques de campagne ou de parti (Dupont-Aignan : standard du siege ; Polony : adresses de contact du site, mentions legales ; Zemmour : adresse de l'imprimeur et du parti) : non citees. Gitleaks local indisponible (grep de motifs) : le scan de CI fait foi. Aucun secret dans le depot.

## Cases non résolues

Aucune.

## Deviations from Plan

- **Substitution de theme (decision anterieure, 03-05)** : europe-et-monde au lieu de retraites. Tous les noms de fichiers et de sous-themes utilisent europe-et-monde.
- **[Rule 2 - Donnees personnelles]** URL Wayback de `erwan-rohou-programme-mei` retiree apres `--wayback-missing`, pour ne pas lier une copie non expurgee d'une page contenant des donnees personnelles de particuliers.
- **Consigne de l'orchestrateur** : la suite complete `npm test` n'a pas ete lancee (tests de build lents) ; `tests/corpus`, `validate`, `ids --check`, `couverture-scan --check-data` et `npm run check` sont verts.

## Known Stubs

Aucun stub. Tout est `brouillon` par conception (relecture Erwan avant publication).

## Self-Check

- Fichiers : 43 mesures `europe-et-monde-*`, `couverture/europe-et-monde.yaml` (37 cases), `themes/europe-et-monde.yaml`, 29 entrees de glossaire creees pour le theme, presents.
- `pilote.livres` contient `europe-et-monde`.
