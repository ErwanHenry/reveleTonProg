---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 06
subsystem: content
tags: [corpus, sante, brouillon, couverture, glossaire, archives]
requires:
  - phase: 03-import-data-gouv-et-corpus-pilote
    provides: "03-05 : themes pilotes (sante en position 0), tests pilote du corpus reel, captures manuelles"
provides:
  - "Theme sante complet en brouillon : 37 cases (un candidat = une case), 47 mesures sourcees, 29 entrees de glossaire"
  - "sante ajoute a pilote.livres : l'exhaustivite des cases est desormais imposee par tests/corpus/pilote.test.ts"
affects: [03-07, 03-08, 03-09, relecture Erwan]
tech-stack:
  added: []
  patterns:
    - "texte_source verbatim copie depuis l'extrait archive, validee par TEXTE_SOURCE_HORS_ARCHIVE"
    - "source expurgee a la main (fichier-manuel) quand la page publique contient des donnees de particuliers"
key-files:
  created:
    - src/content/themes/sante.yaml
    - src/content/couverture/sante.yaml
    - "src/content/mesures/*/sante-*.yaml (47)"
    - "src/content/glossaire/*.yaml (29 entrees)"
    - src/content/sources/erwan-rohou-programme-mei.yaml
    - archives/erwan-rohou/e4e379a88baa.txt
  modified:
    - data/couverture-themes.yaml
    - "src/content/sources/*.yaml (captures rafraichies en direct, Wayback)"
key-decisions:
  - "Theme pilote 1 = sante (et non institutions) : substitution lue dans pilote.themes[0]"
  - "Rohou : capture manuelle expurgee du programme (pied de page avec donnees de particuliers retire) pour ne pas laisser une case non resolue"
  - "Tondelier : programme complet (557 mesures, chapitre 29) utilise en plus des livrets"
requirements-completed: [CONT-05, CONT-06]
duration: "3 lots"
completed: 2026-11-03
---

# Phase 3 Plan 06 : theme sante, corpus pilote 1 (brouillon) Summary

**Les 37 candidats declares ont une case sante datee du 2026-11-03 : 27 avec 47 mesures a texte_source verbatim (verifie contre l'extrait archive), 7 `programme_non_publie`, 3 `non_precise` ; tout est `brouillon`, rien n'est invente, et `sante` est livre dans `pilote.livres`.**

## Resultat

- Validateur `--mode preview` et `--mode production` : `0 erreur(s)`, 14 avertissements (tous `LISIBILITE_ENFANT_FAIBLE`, liste plus bas).
- `tests/corpus/*.test.ts` : 107 pass, 0 fail ; `ids --check` : 0 probleme ; `couverture-scan --check-data` : exit 0.
- Perimetre : 37 candidats `declare`, 0 `primaire` (inchange depuis 03-04).
- Sous-themes (7) : acces-aux-soins, hopital-et-soignants, prevention, sante-environnementale, gouvernance-sante, assurance-maladie, grand-age.

### Totaux

| | Lot 1 | Lot 2 | Lot 3 | Total |
|---|---|---|---|---|
| Candidats | 12 | 13 | 12 | 37 |
| Mesures `brouillon` | 16 | 13 | 18 | 47 |
| Cases `mesures` | 9 | 8 | 10 | 27 |
| Cases `programme_non_publie` | 3 | 3 | 1 | 7 |
| Cases `non_precise` | 0 | 2 | 1 | 3 |
| Entrees de glossaire creees | 14 | 8 | 7 | 29 |

Nouvelles entrees du lot 3 : `prevention`, `medecin-conseil`, `teleconsultation`, `parlement`, `rectorat`, `obesite`, `activite-physique-adaptee`.

## Resultat par candidat

| # | id | etat | mesures / sources consultees |
|---|----|------|------------------------------|
| 1 | nathalie-arthaud | mesures | sante-embauches-hopitaux |
| 2 | francois-asselineau | programme_non_publie | upr.fr/notre-programme (programme annonce comme a venir) |
| 3 | gabriel-attal | mesures | sante-depistage-pfas, sante-droit-climatisation |
| 4 | delphine-batho | mesures | sante-deserts-medicaux, sante-defenseur-constitution |
| 5 | olivier-becht | mesures | sante-secretariat-etat-sante-publique, sante-prevention |
| 6 | xavier-bertrand | programme_non_publie | nousfrance.fr relu : aucune mesure |
| 7 | augustin-billetdoux | programme_non_publie | billetdoux2027.fr : pas de programme |
| 8 | karim-bouamrane | mesures | sante-soins-deserts-medicaux |
| 9 | juan-branco | mesures | sante-plan-urgence-deserts-medicaux, sante-politique-unique-deserts-medicaux |
| 10 | bernard-cazeneuve | mesures | sante-soignants-sante-mentale, sante-grand-age-dependance |
| 11 | christian-collovati | mesures | sante-securite-sociale-endettement, sante-reduction-ame |
| 12 | emmanuel-dubuisson | mesures | sante-sante-plus-proche, sante-parcours-soins-simple |
| 13 | nicolas-dupont-aignan | mesures | sante-fin-passe-sanitaire, sante-lits-etablissements |
| 14 | sylvain-durif | programme_non_publie | durif2027.com/le-projet : communique, pas de programme |
| 15 | clara-egger | non_precise | clara-egger-notre-solution, -parrainage-2027, -presentation-candidate |
| 16 | raphael-glucksmann | mesures | sante-projet-territorial-sante, sante-plan-prevention |
| 17 | anasse-kazib | mesures | sante-expropriation-secteurs-strategiques |
| 18 | selma-labib | mesures | sante-besoins-embauches-hopitaux |
| 19 | francis-lalanne | mesures | sante-fin-pass-obligations-medicales |
| 20 | marine-le-pen | programme_non_publie | rien de presidentielle 2027 sur rassemblementnational.fr |
| 21 | jean-francois-legendre | mesures | sante-preserver-prise-en-charge, sante-analyser-arrets-maladie |
| 22 | david-lisnard | mesures | sante-conventionnement-differencie, sante-supprimer-ars |
| 23 | mira-markovic | programme_non_publie | parti-animaliste.fr : parrainages ; programmes 2022/2024 exclus |
| 24 | benoit-mathieu | non_precise | benoit-mathieu-programme, benoit-mathieu-le-candidat |
| 25 | jean-luc-melenchon | mesures | sante-budget-hopitaux-postes-soignants, sante-plan-canicule-hopitaux-ehpad |
| 26 | antoine-mikolajczak | mesures | sante-alimentation-soins-territoire |
| 27 | manolo-mlekuz | non_precise | manolo-mlekuz-programme, manolo-mlekuz-programme-detaille |
| 28 | edouard-philippe | mesures | sante-stabiliser-depenses-prevention, sante-sante-mentale-ecole |
| 29 | florian-philippot | mesures | sante-simplifier-gestion-hospitaliere, sante-soins-proximite-centres |
| 30 | gilles-platret | programme_non_publie | gillesplatret.fr (site d'historien) relu : aucune mention de candidature ; domaines de campagne essayes inexistants |
| 31 | natacha-polony | mesures | sante-medicaments-essentiels-production |
| 32 | bruno-retailleau | mesures | sante-reexamen-arrets-maladie, sante-prescripteurs-atypiques-plafonds |
| 33 | erwan-rohou | mesures | sante-egalite-acces-soins, sante-usagers-conseil-administration |
| 34 | fabien-roussel | mesures | sante-remboursement-100-securite-sociale, sante-fin-limitation-ondam |
| 35 | francois-ruffin | mesures | sante-pole-public-medicament, sante-sante-scolaire-service-unifie |
| 36 | marine-tondelier | mesures | sante-prevention-priorites, sante-activite-physique-adaptee |
| 37 | eric-zemmour | mesures | sante-supprimer-ame, sante-acces-soins-desertification |

## Sources

- Rafraichies en direct (`--refresh`) a chaque lot ; contenu inchange sauf `david-lisnard-programme-index` et `jean-luc-melenchon-programme-index` (lot 2, aucune mesure ne les cite).
- Creees : lots 1-2 (5 + 2 sources, voir LOTS.md), lot 3 : `erwan-rohou-programme-mei` (voir Rohou ci-dessous).
- `date_publication` : pour la plupart des pages de campagne, `2026-11` = mois de capture (« date de publication inconnue, mois de capture »), jamais un jour invente. Les PDF gardent leur date de creation (ex. cahier Securite sociale du PCF `2025-09-24`, programme Les Patriotes `2026-09-03`, fiches Retailleau `2026-10-12`).
- **Sources `fichier-manuel` (non rafraichissables)** : `delphine-batho-priorite-1`, `jean-francois-legendre-manifeste`, `marine-tondelier-programme-prosperite-ecologique` (PDF « Pour une prosperite ecologique », Les Ecologistes, juillet 2026), `erwan-rohou-programme-mei` (extrait expurge, voir ci-dessous).
- Wayback (passe du lot 3, sources citees par le theme) : 10 obtenues sur 12 manquantes (david-lisnard-sante-programme, emmanuel-dubuisson-sante-publique-medecine, gabriel-attal-sante-depistage-pfas, gabriel-attal-sante-droit-climatisation, natacha-polony-ma-vision, nathalie-arthaud-brochure-campagne, nicolas-dupont-aignan-sante-projet-dlf, olivier-becht-refondation-sante, raphael-glucksmann-projet-acte-1, selma-labib-4-pages-campagne). Echecs (avertissements) : `delphine-batho-priorite-1` (HTTP 520 a deux essais ; le site repond 403 aux clients automatises), `erwan-rohou-programme-mei` (volontairement non soumise). 21 sources du depot restent sans `wayback_url`, toutes hors mesure/case de ce theme sauf les deux ci-dessus (index de programme, livres de Becht parties 4 a 9, lettres, livrets Tondelier solitude/sante reproductive, etc.) : `--wayback-missing` a relancer au besoin en 03-09. Les deux sources a `wayback_url` perdu au lot 2 (`david-lisnard-programme-index`, `jean-luc-melenchon-programme-index`) ne sont citees par aucune mesure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Donnees personnelles] Rohou : capture manuelle expurgee**
- **Found during:** lot 3, case 33
- **Issue:** la page `les-ecologistes-mei.org/notre-programme` est la seule source programme de Rohou, mais son pied de page publie adresse postale, telephone mobile et adresses e-mail de particuliers (protocole §8 etape 4 : ne pas conserver). La cellule etait `inaccessible` (03-04), ce qui interdit `programme_non_publie` et bloquait `pilote.livres`.
- **Fix:** page relue en direct le 2026-11-03 ; fichier HTML minimal compose des seuls 39 points de programme (du titre « Notre Programme » a la mention « Ce programme est evidemment evolutif… »), sans menu ni pied de page, archive via `--file` (`fichier-manuel`, binaire dans le depot prive). Grep e-mail/telephone sur l'extrait : zero resultat. Pas de demande Wayback pour cette source (la page en ligne contient les donnees de particuliers).
- **Files:** `src/content/sources/erwan-rohou-programme-mei.yaml`, `archives/erwan-rohou/e4e379a88baa.txt`
- **A relire par Erwan :** l'extrait n'est pas la capture brute de la page ; il en reprend le texte des 39 points tel quel (les apostrophes sont droites, comme sur le site).

**2. [Rule 1 - Bug] Marqueurs retroactifs**
- Le nouveau terme `prevention` a rendu non conformes deux enfant du lot 1/2 : ajout de `[[prevention]]` au premier emploi dans `olivier-becht/sante-prevention` et `raphael-glucksmann/sante-plan-prevention`, rien d'autre change.

Aucune autre deviation : plan execute tel quel.

## Points a relire par Erwan (liste consolidee, lots 1 a 3)

### A. Choix editoriaux / selection des 2 mesures (regle « les plus centrales »)

1. **Batho** : mesures 04 (deserts medicaux) et 05 (Defenseur de la sante dans la Constitution) retenues, 01 a 03 relevent d'autres themes ; si tu preferes l'ordre brut, remplacer.
2. **Becht** : 2 premieres sections de la page « La sante » ; l'acces aux soins, plus loin, est exclu par le plafond de 2.
3. **Branco** : deux puces voisines (la premiere ne fait que 6 mots, la seconde la detaille) ; `auteur: coalition` (Les Ruches), le candidat est « Sans etiquette (soutenu par Les Ruches) ».
4. **Attal** : 2 premieres mesures de la page de thematique ; le texte_source de la climatisation est le paragraphe des coproprietes / Architectes des Batiments de France, l'enfant dit « droit a la climatisation » d'apres le titre de la page.
5. **Dubuisson** : 2 premieres sections du dossier 3. **Cazeneuve** : propositions 4 et 5 de la liste finale (la 5 sur le grand age classee sante).
6. **Collovati** : page en listes sans structure ; la premiere puce (securite sociale) est discutable comme « sante » ; le chiffre « 1,3 milliard € » de l'AME n'est pas qualifie (cout ? economie ?) et le meme texte parle ailleurs de « Suppression AME : 1,2 Md » : incoherence a signaler, `chiffrage` laisse vide.
7. **Arthaud** : un seul passage, au conditionnel, dans un paragraphe sur le partage du travail ; plutot « tres partiel » que `partiel`.
8. **Bouamrane** : un passage de principe (section « Soigner ») avec des criteres de non-discrimination repris dans detaille/aine, pas dans l'enfant.
9. **Dupont-Aignan** : la page Sante de Debout la France n'est pas datee et peut dater de 2022 (cite le Covid) ; premiere mesure (fin du passe sanitaire) a cheval sur santé et libertes ; les 20 mesures du 23/10/2026 ne contiennent rien sur la sante.
10. **Glucksmann** : document de Place publique (`parti_du_candidat`), chantiers 23 et 24 (premiere puce de chacun).
11. **Kazib** : une seule mesure (la sante n'est qu'un item d'une liste de secteurs a exproprier) ; cellule `partiel` a juger. **Labib** : passage de methode (les travailleurs evaluent les besoins en embauches), pas un nombre d'embauches. **Lalanne** : le site s'appelle « Dieudo Lalanne 2027 », fiche = Francis Lalanne ; ne pas relier « pass » au Covid, le texte ne le dit pas.
12. **Legendre** : le systeme de sante est qualifie de « merveilleux » dans un paragraphe sur l'assistanat ; la mesure 2 (arrets maladie) est une phrase d'exemple ; « reduire nos prestations de 10 % » non retenu (conditionnel, non specifique sante).
13. **Lisnard** : 2 premieres propositions (conventionnement differencie, suppression des ARS).
14. **Melenchon** : livre-programme toujours bloque, non lu ; les 2 mesures viennent du document « comptes publics » ; le texte canicule dit « equiper … contre les incendies », repris tel quel.
15. **Mikolajczak** : une seule mesure, l'enonce de la rubrique « Vivre en bonne sante » du tract (il y a 3 enonces de principe dans une seule phrase). Le programme detaille du parti Equinoxe est annonce pour le 4 novembre 2026 (page candidat, non archivee car elle republie noms, ages et villes de membres de l'equipe) : a refaire apres publication.
16. **Mlekuz** : `non_precise`. Seule mention : « l'acces aux soins » dans une liste de defis non releves par le regime actuel (diagnostic, pas une position) ; non retenue comme mesure.
17. **Philippe** : mesures 1 (depenses de sante, page « prospere », rubrique comptes) et 2 (sante a l'ecole, page « enfants ») ; seules deux mentions sante du site, dans deux pages differentes.
18. **Philippot** : document des Patriotes (`parti_du_candidat`), PDF a deux colonnes : les deux premiers paragraphes de la rubrique SANTE sont contigus et propres. Autres engagements non retenus (plafond) : reorganiser l'hopital, secret medical, supprimer le Conseil de l'Ordre, etc.
19. **Platret** : `programme_non_publie` apres relecture : gillesplatret.fr est un site d'historien (livres, evenements) sans mention de la candidature ; platret2027.fr, www.platret2027.fr, platret.fr ne repondent pas.
20. **Polony** : une seule mesure, le paragraphe « Produire son energie. Ses medicaments essentiels… » : c'est un enonce industriel qui nomme les medicaments essentiels, pas une section sante ; cellule `partiel`. Les « 4 phrases » du paragraphe sont des fragments ; texte_source = le paragraphe entier. « Notre systeme de sante craque » (diagnostic) non utilise.
21. **Retailleau** : fiche 7 des comptes publics, deux premieres puces de « Ce que nous faisons » ; le titre de la fiche mentionne « 4 Md€ » (chiffre d'economie de la fiche entiere) : pas de `chiffrage` rempli, pas rattache a une mesure precise. L'enfant parle d'arrets maladie d'apres le titre de la fiche (la puce 2 ne contient que « premier arret limite »). La page theme Sante de avecretailleau.fr est « A venir ».
22. **Rohou** : la fiche candidat n'a pas de parti (`parti: null`) ; la source est le programme du Mouvement des Ecologistes Independants, et le rattachement « candidat du mouvement » vient de l'accueil du mouvement (interview video, non lisible automatiquement). Les rédactions disent « dont Erwan Rohou est le candidat selon l'accueil du mouvement ». Deux mesures : point 6 (acces aux soins parmi quatre egalites) et point 38 (usagers au conseil d'administration des assurances sociales) ; ce sont les deux seuls points du programme qui parlent de soins/patients. Page non datee (plan du site : derniere modification 2026-10-11) : `date_publication: 2026-11`. Les prochains rafraichissements demanderont `--file` (la page contient toujours le pied de page).
23. **Roussel** : le cahier Securite sociale est un document du PCF (`parti_du_candidat`) date de 2025-09-24, ante-rieur a la candidature ; retenu car c'est le cahier thematique courant. Mesures = 2 premiers enonces du chapitre 4 (assurance maladie) : remboursement a 100 % et fin de la limitation annuelle des depenses (ONDAM). Non retenu (plafond) : plan jeunesse 2027-2032, qui est de Roussel lui-meme et propose une equipe de sante par lycee (1 medecin scolaire pour 3 000 eleves) ; **si tu preferes une source du candidat plutot que du parti, remplace la mesure 2 par celle-la**. L'enfant du remboursement dit « le systeme actuel de remboursement » sans detailler la « dualite » (le texte ne la detaille pas).
24. **Ruffin** : pas de section sante dans les livrets ; deux enonces explicitement sante : pole public du medicament (cahier Industrie) et services unifies de sante scolaire (cahier Education, proposition 3 « Garantir le droit a la sante… »). Non retenus (plafond) : accompagnement psychologique gratuit pour les victimes de catastrophes (plan Urgence climat), tarifs des produits de sante et prevention (9 Mds€ en 2030 dans le plan de redressement, a texte entrelace et chiffres issus d'organismes tiers).
25. **Tondelier** : programme complet (chapitre 29, « Ameliorer la prevention et le parcours de soin ») utilise ; mesures = propositions 1 et 2 dans l'ordre du chapitre. La proposition 4 (remboursement total des soins essentiels a 100 %, fin des franchises), plus saillante, n'est pas retenue (plafond, regle de l'ordre de la source). Les livrets Sante environnementale et Sante reproductive (50+ engagements) ne sont pas utilises dans les mesures (cases deja pourvues par le programme complet). Le texte_source de la proposition 1 contient un saut de ligne vide au milieu de la phrase (mise en page PDF) ; il passe le validateur.
26. **Zemmour** : tract « L'avenir est a nous » (Reconquete, `parti_du_candidat`) ; les deux premieres phrases du paragraphe sante : suppression de l'AME, acces au soin. Le vocabulaire du tract (« les clandestins », « votre argent ») est cite entre guillemets, jamais repris a notre compte. Le tract « pouvoir d'achat » (« Supprimer les ARS » ; « Supprimer l'AME : 1 milliard € ») n'est pas utilise (plafond, et le chiffre est dans un autre document que le texte_source).

### B. Definitions du glossaire redigees sans source (29 entrees : a verifier)

Redigees de ma connaissance generale, sans source : `aide-medicale-d-etat`, `securite-sociale`, `grande-cause-nationale`, `addiction` (exemple tabac/alcool), `secretariat-d-etat`, `passe-sanitaire`, `agence-regionale-de-sante`, `prefet`, `conseil-d-administration`, `assurance-maladie`, `zone-sous-dotee`, `expropriation` (volontairement neutre, sans indemnite), `discrimination`, `constitution`, `copropriete`, `dependance`, `desert-medical`, `ehpad`, `pfas`, `sante-mentale`, `aidant-familial`, `collectivite-locale`, et les 7 du lot 3 : `prevention`, `medecin-conseil`, `teleconsultation`, `parlement` (ajoute le budget de la Securite sociale), `rectorat`, `obesite`, `activite-physique-adaptee`. Aucune n'a d'exemple tire d'un candidat. Aucun glossaire de type `parti` n'a ete cree : les textes enfant evitent de nommer les partis (« son parti », « son mouvement »).

### C. Avertissements de lisibilite (14, tous `LISIBILITE_ENFANT_FAIBLE`, Kandel-Moles < 80, non bloquants en brouillon)

| mesure | indice |
|---|---|
| retailleau/sante-prescripteurs-atypiques-plafonds | 61,5 |
| rohou/sante-usagers-conseil-administration | 65,4 |
| tondelier/sante-prevention-priorites | 68,4 |
| attal/sante-droit-climatisation | 67,5 |
| batho/sante-defenseur-constitution | 70,1 |
| branco/sante-politique-unique-deserts-medicaux | 72,4 |
| becht/sante-secretariat-etat-sante-publique | 74,3 |
| glucksmann/sante-projet-territorial-sante | 75,3 |
| philippot/sante-simplifier-gestion-hospitaliere | 76,9 |
| tondelier/sante-activite-physique-adaptee | 76,9 |
| ruffin/sante-sante-scolaire-service-unifie | 77,0 |
| ruffin/sante-pole-public-medicament | 77,6 |
| melenchon/sante-plan-canicule-hopitaux-ehpad | 79,2 |
| becht/sante-prevention | 79,5 |

Ce sont des mesures dont les termes techniques (prescripteur, atypique, conseil d'administration, rectorat…) ne se contournent pas sans trahir le texte. `PHRASE_ENFANT_LONGUE`, `VERBE_CONNOTE`, `NOMBRE_LETTRES_HORS_SOURCE`, `PILOTE_SIGLE_ENFANT` : aucun apres corrections.

### D. Jargon que la CI ne peut pas detecter (termes sans entree de glossaire dans les enfant)

« depenses sociales » (Collovati), « obligations d'exercer » (Branco), « Outre-mer » (Dubuisson), « Defenseur » (Batho, explique dans la phrase), « usagers » (Glucksmann ; Rohou l'explique dans le texte), « secteurs cles/strategiques » (Kazib), « zones saturees » (Lisnard), « statut medical » (Lalanne), « prescripteurs atypiques » (Retailleau : le texte ne le definit pas), « assurances sociales » (Rohou), « cellules d'ecoute » (Ruffin), « sport sur ordonnance » (Tondelier), « medicaments innovants » et « produits de base critiques » (Ruffin : paraphrases « medicaments nouveaux », « tres importants »), « gestion hospitaliere » (Philippot), « contenir les depenses » (Rohou).

### E. Autres

- **Dates de publication inconnues** (mois de capture) : toutes les pages de site de campagne non datees (voir LOTS.md pour la liste par lot ; lot 3 : Rohou).
- **Ligne Rohou de `data/couverture-themes.yaml`** : restee `acces: bloque` / cellule `inaccessible` (mesure 03-04). Elle n'est pas realignee sur l'archive expurgee ; le test pilote ne l'exige pas. A decider en 03-09 (la ligne dit toujours « capture manuelle expurgee a demander »).
- **Tondelier, programme complet** : source `fichier-manuel`, son `wayback_url` existe (pris pendant le lot 2). Les soft hyphens U+00AD du PDF n'ont pas gene : seuls des passages propres sont cites.
- **Melenchon** : livre-programme bloque non lu (cf. A.14). **Batho** : site du parti non lu, priorites 2 et 4 archivees, non lues pour ce theme.

## Cases non resolues

Aucune. (Rohou, initialement `inaccessible`, resolu par la capture expurgee ci-dessus.)

## Contenus suspects

Aucun contenu d'instruction detecte dans les pages lues, lots 1 a 3 (pages des 12 candidats du lot 3 comprises : Equinoxe, Trajectoire, sites Philippe/Retailleau/Roussel/Ruffin/Zemmour, Les Patriotes, MEI).

## Donnees personnelles

- Lot 3 : grep e-mail/telephone sur l'unique nouvel extrait (`archives/erwan-rohou/e4e379a88baa.txt`) : zero resultat. Les extraits rafraichis sont inchanges (memes sha256) sauf trois captures dont seul le binaire a change (Polony x2, Roussel).
- Lots 1-2 : coordonnees publiques de partis (Debout la France : telephone et adresse du siege ; Nouvelle Energie : adresse de contact) conservees, aucune donnee de particulier.
- Page « equipe » du parti Equinoxe (noms, ages, metiers, villes de membres) volontairement non archivee.
- gitleaks local indisponible : etape §8.5 sautee comme convenu ; remplacee par le grep ci-dessus.

## Marqueurs ajoutes retroactivement

`olivier-becht/sante-prevention` et `raphael-glucksmann/sante-plan-prevention` (`[[prevention]]`, 1er emploi dans l'enfant).

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'attaque. Rappel T-03-35 : trois sources sont des documents de parti (`parti_du_candidat`) ou de mouvement, pas du candidat seul (Philippot, Roussel cahier Securite sociale, Tondelier programme, Zemmour tracts, Rohou, Mikolajczak) : les redactions le disent.

## Self-Check

Voir la fin de ce fichier.

## Self-Check: PASSED

- 47 fichiers `src/content/mesures/*/sante-*.yaml`, 37 cases dans `src/content/couverture/sante.yaml`, 29 entrees de glossaire, `sante` dans `pilote.livres` : verifies.
- `validate` preview et production 0 erreur ; `npm test` 1533 pass ; `npm run check` 0 erreur ; `ids --check` et `couverture-scan --check-data` OK ; depot prive d'archives propre et pousse.
