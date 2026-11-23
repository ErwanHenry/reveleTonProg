# Test A/B des maquettes de charte (2026-11-23)

Demande d'Erwan : « Fais de l'AB testing avec un agent », « De base je préfère A et B mais argumente et trouve des solutions ».

## Limite à garder en tête

Ce sont des lecteurs **simulés** (agents Sonnet 5.5), pas des visiteurs. Le test sert à trouver des défauts et à comparer des directions, pas à mesurer une audience. Un vrai test A/B sur le site est exclu : il demanderait un traceur, que le site s'interdit.

## Protocole

- Quatre profils, un agent neuf par profil et par tour : Lina, 18 ans, téléphone ; Bernard, 71 ans, vue fatiguée, ordinateur ; Claire, 45 ans, journaliste de vérification, ordinateur ; Karim, 38 ans, téléphone.
- À l'aveugle : versions nommées X et Y, ordre inversé une fois sur deux, barre « Maquette » masquée. Les agents ne connaissent ni la préférence d'Erwan ni l'hypothèse testée.
- Matériel : captures Playwright de la page entière, en tranches d'écran (1280 x 900 ou 375 x 812).
- Pour chaque version : première impression, trois tâches (trouver le thème santé, la source d'une mesure, le relecteur ou les niveaux de lecture), gênes de lecture, impression de neutralité, quatre notes sur 10, préférence, trois défauts.

## Résultats

Notes dans l'ordre : envie de rester (attrait grand public pour Claire), confiance (crédibilité), facilité de lecture, impression de neutralité.

### Tour 1 : A contre B

| Profil | A | B | Préférée |
|---|---|---|---|
| Lina | 6, 8, 7, 8 | 8, 6, 6, 5 | A (« Y m'attire plus, mais je préfère X ») |
| Bernard | 8, 8, 8, 8 | 4, 5, 4, 4 | A |
| Claire | 6, 8, 8, 7 | 8, 6, 7, 5 | A |
| Karim | 8, 8, 8, 8 | 6, 6, 6, 4 | A |

A préférée 4 sur 4. B ne passe devant que sur l'accroche (Lina, Claire). Reproches à B, répétés : capitales lourdes, aplat bleu vif et ombres décalées lus comme « tract » ou « campagne », tuile Santé rouge lue comme alerte, cartes de candidats inégales. Reproches à A : filet tricolore de l'en-tête lu comme drapeau ou site de l'État, titre de mesure rouge, mention de relecture pâle, thèmes à venir en pointillés « en panne », accueil un peu terne.

### Tour 2 : première synthèse D contre A

D reprenait de B le bloc « 2027 » en aplat, les ombres décalées, la tuile en bleu vif, un bandeau sombre.

A préférée 3 sur 4 (Lina, Bernard, Karim) ; Claire préfère D pour la lisibilité des preuves. Ce qui perd : exactement les emprunts à B (ombres, bleu vif, bloc « 2027 » qui pousse le bouton hors écran sur mobile, bandeau sombre à texte blanc, point rouge du logo). Ce qui gagne : mention de relecture en gras, encadré de source teinté, pastilles épaisses, cartes au même cadre.

### Tour 3 : D refaite contre A

D repart de A, retire ce que les deux tours ont condamné, garde ce qu'ils ont demandé.

| Profil | A | D | Préférée |
|---|---|---|---|
| Lina | 6, 7, 5, 6 | 7, 7, 8, 8 | D |
| Bernard | 7, 7, 6, 7 | 8, 8, 8, 7 | D |
| Claire | 5, 6, 6, 4 | 7, 8, 8, 8 | D |
| Karim | 7, 7, 6, 6 | 8, 7, 8, 8 | D |

D préférée 4 sur 4. Défauts restants de D : pastilles de niveau sur deux lignes sur mobile et tuiles à venir trop vides (corrigés après le tour, non retestés) ; page longue ; pastilles et bouton « Lire » jugés « très appli » par Claire ; l'envie de rester plafonne à 7 ou 8.

## Règles retenues pour la charte

1. Casse normale partout ; pas de petites capitales rouges espacées.
2. Pas de grand aplat saturé ni d'ombre décalée ; le bleu nuit porte la structure.
3. Rouge en accent seulement (filet, soulignement, numéro) ; jamais en aplat, jamais sur un titre de mesure ni sur un état lié à un candidat.
4. Même cadre, même vignette, même typographie pour toutes les cartes de candidats, avec ou sans programme.
5. Pas de filet ni de bandeau tricolore.
6. Mention de relecture et source en texte foncé et lisible ; liens de source en gras soulignés.
7. Zones à toucher épaisses (pastilles d'au moins 44 px de haut), bouton principal visible sans défiler sur mobile.
8. Thèmes à venir en tuiles pleines et lisibles, pas en pointillés.

## Pistes non testées

- Portraits des candidats (Wikimedia Commons, auteur et licence affichés) : sans doute le premier levier d'attrait, les notes d'envie de rester plafonnant à 8 sans image.
- Remonter le sélecteur de niveau de lecture plus haut dans la page (demandé par Karim aux trois tours) : c'est de la structure, pas de la charte.
- L'énergie de B hors du site : visuels de partage, où un registre d'affiche ne pèse pas sur la lecture des programmes.
