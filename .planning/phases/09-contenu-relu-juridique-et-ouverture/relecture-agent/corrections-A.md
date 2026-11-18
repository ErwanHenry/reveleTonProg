# Corrections par agent : lot A, thème santé (19 mesures)

- Date : 2026-11-17
- Correcteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5)
- Entrée : `relecture-agent/mesures-A.md` (19 mesures `doute` ou `erreur`) ; les 5 mesures `conforme` ne sont pas touchées.
- Worktree : `/Users/erwanhenry/claude-projects/reveleTonProg-relecture`, branche `relecture/sante`. Rien n'est commité.
- Méthode : pour chaque constat, relecture du passage dans l'extrait archivé (`archives/...`), puis une modification ciblée ; aucun champ `texte_source`, `source`, `id`, `statut_relecture` ni archive n'est modifié ; aucune définition du glossaire n'est modifiée.

## Contrainte du validateur à connaître

Un nombre qui n'est ni dans `texte_source` ni dans `chiffrage.texte` est une erreur en résumé, enfant et aîné, et un avertissement en titre et détaillé (`CHIFFRE_HORS_SOURCE`, `CHIFFRE_DETAILLE_HORS_SOURCE`, `NOMBRE_LETTRES_HORS_SOURCE`). Les citations entre guillemets doivent figurer dans `texte_source`. Je ne peux pas ajouter de champ `chiffrage`. Conséquence : les chiffrages proposés par le relecteur (Retailleau 1,0 / 0,7 / 1,7 Md€, Collovati « 1,2 Md ») ne peuvent pas être écrits en chiffres ; voir « Constats non appliqués ».

## Détail par mesure

### 2. antoine-mikolajczak/sante-alimentation-soins-territoire

- Constat : localisation « page 1 » ; portée de « sur tout le territoire » en enfant.
- `source_localisation` : avant « page 1 du tract, rubrique Vivre en bonne santé » ; après « page 2 du PDF du tract, rubrique Vivre en bonne santé ». Appui : l'extrait a un saut de page (caractère de saut de page) après la couverture « Antoine Mikolajczak », puis « VIVRE EN BONNE SANTÉ ».
- `enfant` : avant « Antoine Mikolajczak veut garantir l'accès à une alimentation de qualité. Il veut aussi garantir l'accès aux soins sur tout le territoire. » ; après « Antoine Mikolajczak veut garantir partout l'accès à une alimentation de qualité. Il veut aussi garantir partout l'accès aux soins. » Appui : « Garantir l'accès à une alimentation de qualité et aux soins sur l'ensemble du territoire ».

### 3. bernard-cazeneuve/sante-grand-age-dependance

- Constat : « mieux » absent de la source (enfant, aîné).
- `enfant` : « Il veut mieux les prendre en charge » devient « Il veut les prendre en charge ».
- `aine` : « Bernard Cazeneuve propose de mieux prendre en charge » devient « Bernard Cazeneuve propose de prendre en charge ».
- Appui : proposition 5, « prise en charge du grand âge, de la dépendance et du soutien aux aidants familiaux ».

### 5. bruno-retailleau/sante-prescripteurs-atypiques-plafonds

- Constat appliqué : « dits atypiques » (enfant).
- `enfant` : avant « Les médecins dits atypiques auraient des objectifs. » ; après « Le texte vise des médecins qu'il appelle prescripteurs atypiques. Ils auraient des objectifs. » Appui : « Prescripteurs atypiques sous objectifs puis sous accord préalable ».
- Constat non appliqué : chiffrage 1,0 et 0,7 Md€ (voir plus bas).

### 6. bruno-retailleau/sante-reexamen-arrets-maladie

- Constats appliqués : « Il aiderait » (intention ajoutée, orientations réduites) ; « date de début » ambiguë.
- `enfant` : avant « Il aiderait à choisir la suite pour la personne, comme une reprise adaptée. Le texte ne donne pas de date de début. » ; après « Puis la personne serait orientée vers un travail adapté ou à temps partiel. Ou bien vers un autre métier, ou vers l'invalidité. Le texte ne dit pas quand ce serait mis en place. »
- Appui : « avec orientation vers la reprise adaptée, le temps partiel thérapeutique, la reconversion ou l'invalidité ». Je n'ai pas repris la proposition « Le médecin orienterait » : la source ne dit pas qui oriente (le détaillé le signale déjà). Absence de date vérifiée dans tout l'extrait (fiche 7 : seul l'horizon de chiffrage « Md€ 2032 » est donné, pas une date de mise en oeuvre).
- Constat non appliqué : chiffrage 1,7 Md€ (voir plus bas).

### 7. christian-collovati/sante-reduction-ame (erreur)

- Constats : « Suppression AME : 1,2 Md » omis ; aîné « d'autres aides » faux ; « objectifs » au lieu de « Constat ».
- `titre` : « Réduction de l'Aide médicale d'État » devient « Réduction ou suppression de l'Aide médicale d'État ».
- `resume` : avant « …, avec la mention de 1,3 milliard € dans la liste. » ; après « …, avec la mention de 1,3 milliard € ; ailleurs, son site parle de la supprimer. »
- `detaille` : « Christian Collovati liste parmi ses objectifs de réduire l'AME » devient « dans une liste intitulée Constat de la situation actuelle en France, Christian Collovati inscrit la réduction de l'AME » ; ajout final : « Plus bas sur la même page, dans une liste d'économies intitulée Budget avec chiffrages possibles, le site parle aussi de la suppression de l'AME, avec un autre montant. Le site ne dit pas laquelle de ces formulations prévaut. »
- `enfant` : ajout « Plus loin, son site parle aussi de la supprimer. »
- `aine` : « Il ne dit pas non plus si d'autres aides seraient modifiées. » remplacé par « Plus bas sur la même page, dans une liste d'économies chiffrées, le site parle aussi de supprimer l'AME, avec un autre montant. »
- Appui : sous « Constat de la situation actuelle en France », « Réduire l'AME (Aide Médicale d'Etat)(1,3 milliard €) » ; sous « BUDGET avec chiffrages possibles », « Suppression AME : 1,2 Md ». Le montant 1,2 n'est pas écrit (contrainte du validateur), d'où « avec un autre montant ».

### 8. christian-collovati/sante-securite-sociale-endettement

- Constats : remboursements dits non évoqués ; « objectifs » au lieu de « Constat » ; phrase sur la mesure de l'endettement.
- `detaille` : « liste parmi ses objectifs de freiner la dépense sociale, l'endettement… » devient « dans une liste intitulée Constat de la situation actuelle en France, Christian Collovati inscrit le freinage de la dépense sociale, de l'endettement… » ; « Le texte ne dit pas… » devient « Cette ligne ne dit pas… » ; supprimés : « si les soins ou les remboursements de l'assurance maladie seraient touchés » et « Il n'indique pas comment l'endettement serait mesuré. » ; ajout : « Ailleurs sur la page, parmi les actions prévues dès sa prise de fonctions, le candidat prévoit de suspendre pendant un mois plusieurs versements, dont les remboursements de la sécurité sociale, le temps de contrôles. »
- `aine` : avant « Le texte ne précise pas quelles dépenses seraient concernées, de combien elles baisseraient, ni si les remboursements de soins seraient touchés. » ; après « Cette ligne ne précise pas quelles dépenses seraient concernées ni de combien elles baisseraient. Ailleurs sur la page, le candidat prévoit de suspendre pendant un mois plusieurs versements, dont les remboursements de la sécurité sociale, le temps de contrôles. »
- Appui : « voici le déroulé de mes actions dès ma prise de fonctions » puis « Arrêt du versement de toutes subventions, … de remboursement de la sécurité sociale aux entreprises et aux particuliers (pour une durée de 1 mois : durée nécessaire aux divers contrôles) ». « Cette ligne » borne les absences à la ligne citée, car la section Budget chiffre d'autres économies sociales.

### 9. david-lisnard/sante-conventionnement-differencie

- Constats : texte du parti (« Nous proposons ») attribué au candidat (résumé, enfant) ; « moins bien remboursés ».
- `resume` et `enfant` : « David Lisnard propose » devient « Son parti, Nouvelle Énergie, propose ».
- `enfant` : « Dans les zones saturées, ces soins seraient moins bien remboursés. » devient « Le remboursement y serait meilleur que dans les zones saturées. »
- Appui : « Nous proposons un conventionnement différencié : la Sécurité sociale rembourse mieux les actes dans les zones sous-dotées que dans les zones saturées. »

### 10. david-lisnard/sante-supprimer-ars

- Constats : « conseils d'administration actuels » ; attribution mêlée.
- `resume` : « Dans le programme de Nouvelle Énergie, David Lisnard veut supprimer » devient « Son parti, Nouvelle Énergie, veut supprimer ».
- `enfant` : « David Lisnard veut supprimer » devient « Son parti, Nouvelle Énergie, veut supprimer ».
- `detaille` : phrase « Il ne dit pas non plus ce que deviendraient les conseils d'administration actuels. » supprimée ; pour rester au minimum de 80 mots, « ni le calendrier » devient « ni le calendrier de ces changements ».
- Appui : « Nous voulons supprimer les ARS, transférer les responsabilités aux préfets et aux élus, redonner aux maires la présidence des conseils d'administration des hôpitaux. »

### 11. delphine-batho/sante-defenseur-constitution

- Constats : « priorité 1 » absent de l'extrait ; phrase agrammaticale.
- `source_localisation` : avant « page de la priorité 1 La pleine santé , proposition 05 » ; après « page La pleine santé (rubrique Priorités du site), proposition 05 Inscrire la pleine santé et le respect de l'habitabilité dans la Constitution ». Appui : titre de l'extrait « La pleine santé », URL `/priorites/la-pleine-sante/`, intertitre « 05 Inscrire la pleine santé et le respect de l'habitabilité dans la Constitution ».
- `detaille` : « Le texte donne pour buts à cette inscription guider toutes les politiques publiques » devient « Selon le texte, cette inscription doit guider toutes les politiques publiques ». Appui : « seront inscrits dans la Constitution pour guider toutes les politiques publiques ».

### 12. delphine-batho/sante-deserts-medicaux

- Constats : « priorité 1 » ; conditionnel « serait soutenue ».
- `source_localisation` : avant « page de la priorité 1 La pleine santé , proposition 04 Mettre fin aux déserts médicaux » ; après « page La pleine santé (rubrique Priorités du site), proposition 04 Mettre fin aux déserts médicaux ».
- `detaille` : « qu'elle serait soutenue par 86 % de la population » devient « qu'elle est soutenue par 86 % de la population, sans citer d'étude, ». Appui : « soutenue par 86 % de la population » ; aucune étude ni source citée dans l'extrait (vérifié sur les 59 lignes).

### 13. edouard-philippe/sante-sante-mentale-ecole (erreur)

- Constats : phrase répétée ; recrutements présupposés ; localisation (mineur).
- `detaille` : seconde occurrence de « Il ne dit pas non plus comment les problèmes de santé mentale seraient repérés ni par qui. » supprimée ; « combien de personnes seraient recrutées, ni dans quels établissements cela commencerait » devient « avec quels moyens, ni à partir de quand ».
- `source_localisation` : ajout de « , rubrique Pour une école de la liberté et de l'exigence » (intertitre présent dans l'extrait juste au-dessus de la mesure).
- Appui : « Renforcer la santé à l'école, en donnant aux élèves accès à des tiers de confiance, à des conseils et à la détection en matière de santé mentale. »

### 15. emmanuel-dubuisson/sante-parcours-soins-simple

- Constat : quatre phrases de l'enfant sans attribution.
- `enfant` : avant « Les gens doivent obtenir une réponse claire et rapide. Ils ne doivent pas se perdre entre plusieurs portes. Le patient doit savoir où aller. Le médecin doit pouvoir soigner sans perdre son temps en démarches inutiles. » ; après « Pour lui, les Français doivent obtenir une réponse claire et rapide. Il ne veut pas qu'ils se perdent entre plusieurs portes. Selon lui, le patient doit savoir où aller. Il écrit que le médecin doit pouvoir soigner sans perdre son temps en démarches inutiles. »
- Je n'ai pas ajouté « Le texte ne dit pas comment » proposé par le relecteur : absence non nécessaire à la correction.
- Appui : citation de la section « Un parcours de soins plus simple ».

### 17. eric-zemmour/sante-acces-soins-desertification

- Constats : tract de Reconquête qui ne nomme pas le candidat ; pharmacies rangées sous « déserts médicaux ».
- `resume` : « Éric Zemmour propose » devient « Son parti, Reconquête, propose ».
- `detaille` et `aine` : « Dans le tract de son parti Reconquête intitulé L'avenir est à nous, Éric Zemmour propose » devient « Dans un tract intitulé L'avenir est à nous, son parti, Reconquête, propose ».
- `enfant` : avant « Éric Zemmour parle des endroits où il manque de médecins et de pharmacies. On les appelle des [[déserts médicaux|desert-medical]]. » ; après « Son parti, Reconquête, parle des [[déserts médicaux|desert-medical]]. Il parle aussi des endroits où il manque des pharmacies. »
- Appui : l'extrait (47 lignes) ne contient pas le nom « Zemmour » ; « Face à la désertification médicale et pharmaceutique, concentrer les moyens pour assurer un accès au soin partout en France. »

### 18. eric-zemmour/sante-supprimer-ame

- Constats : même attribution ; « votre argent » sans guillemets.
- `resume`, `detaille`, `enfant`, `aine` : sujet « Éric Zemmour » remplacé par « son parti, Reconquête » (même tournure que la mesure 17) ; aîné « qu'il décrit comme » devient « que le tract décrit comme ».
- `enfant` : « Il dit qu'elle est payée avec votre argent. » devient « Le tract dit qu'elle est payée « avec votre argent ». »
- Appui : « Supprimer l'AME qui soigne les clandestins avec votre argent. »

### 19. erwan-rohou/sante-egalite-acces-soins

- Constats : modalité du résumé ; lien candidat et mouvement non vérifiable ; « limite de dépenses ».
- `resume` : avant « Le programme du mouvement d'Erwan Rohou place l'accès aux soins parmi quatre égalités à garantir, en contenant les dépenses. » ; après « Le programme du Mouvement des Écologistes Indépendants place l'accès aux soins parmi quatre égalités à garantir, sans ignorer la nécessité de contenir les dépenses. »
- `detaille` : supprimé « , dont Erwan Rohou est le candidat selon l'accueil du mouvement, » ; « Il ne chiffre pas la limite de dépenses. » devient « Cette proposition ne donne aucun chiffre. » ; ajout, pour rester à 80 mots au moins : « La proposition figure dans la partie du programme intitulée Consolider le lien social. » (intertitre de l'extrait au-dessus de la proposition 6).
- `enfant` : « Le programme du mouvement d'Erwan Rohou cite quatre égalités à garantir. » devient « Le Mouvement des Écologistes Indépendants a fait un programme. Il dit qu'il faut garantir quatre égalités. » (forme choisie pour garder la lisibilité au-dessus de 80).
- `aine` : supprimé « , dont Erwan Rohou est présenté comme le candidat sur la page d'accueil du mouvement, ».
- Appui : « 6. Les quatre égalités fondamentales à garantir sont l'accès aux soins (sans ignorer la nécessité de contenir les dépenses), … ».

### 20. erwan-rohou/sante-usagers-conseil-administration

- Constats : lien candidat et mouvement ; « des patients » au lieu d'une association.
- `resume` : « Le programme du mouvement d'Erwan Rohou » devient « Le programme du Mouvement des Écologistes Indépendants ».
- `detaille` : supprimé « , dont Erwan Rohou est le candidat selon l'accueil du mouvement, » ; ajout « La proposition figure dans la partie du programme intitulée La démocratie pour construire le compromis. » (intertitre de l'extrait au-dessus des propositions 35 à 39 ; nécessaire pour le minimum de 80 mots).
- `enfant` : « Le programme du mouvement d'Erwan Rohou veut des usagers » devient « Le Mouvement des Écologistes Indépendants a fait un programme. Il veut des usagers » ; « Par exemple, des patients de l'[[assurance maladie]]. » devient « Par exemple, une association de patients à l'[[assurance maladie]]. »
- `aine` : supprimé « , dont Erwan Rohou est présenté comme le candidat sur la page d'accueil du mouvement, ».
- Appui : « 38. Les usagers (association de chômeurs à l'UNEDIC, association de patients à l'assurance maladie …) sont introduits… ».

### 22. fabien-roussel/sante-remboursement-100-securite-sociale

- Constats : « ne dit pas quels soins » alors que la suite borne le périmètre ; titre sans « vers ».
- `titre` : « Remboursement à 100 % … » devient « Vers le remboursement à 100 % des soins prescrits par la Sécurité sociale ».
- `detaille` : avant « Le texte cité ne dit pas à quelle date, ni quels soins seraient concernés, ni combien cela coûterait. » ; après « Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui doit être remboursé. Il ne donne ni date ni coût pour cette mesure. »
- `aine` : avant « Le passage cité ne précise ni le calendrier, ni la liste des soins concernés, ni le coût de cette réforme. » ; après la même phrase sur le périmètre, puis « Il ne précise ni le calendrier ni le coût de cette réforme. »
- Appui (page 15) : « Il ne peut s'agir de remboursements d'un seul panier de soins limité », « il ne peut s'agir de rembourser aussi les médecines parallèles », « c'est la démocratie qui doit trancher ce qui doit être remboursé ». Absence de date et de coût vérifiée : la page 16 dit seulement que « des financements supplémentaires sont nécessaires » ; le chiffre de 100 milliards (page 21) concerne les retraites.

### 23. florian-philippot/sante-simplifier-gestion-hospitaliere

- Constats : livret du mouvement qui ne nomme pas le candidat ; « que dirige » non sourcé ; nom du document ; « bureaucratie des soignants ».
- `resume` : « Florian Philippot propose » devient « Son parti, Les Patriotes, propose ».
- `detaille` : « Dans le Projet pour la France, publié par le mouvement Les Patriotes, Florian Philippot consacre un paragraphe … à la bureaucratie des soignants. » devient « Dans le livret Grandes orientations pour un projet patriote, son parti, Les Patriotes, consacre un paragraphe … à la bureaucratie qui pèse sur les soignants. »
- `enfant` : « Florian Philippot veut simplifier » devient « Son parti, Les Patriotes, veut simplifier » ; « Ce projet vient de son mouvement. » supprimé (redondant et ambigu après le changement de sujet).
- `aine` : « Dans le Projet pour la France, publié par le mouvement Les Patriotes que dirige Florian Philippot, » devient « Dans le livret Grandes orientations pour un projet patriote de son parti, Les Patriotes, ».
- Appui : couverture « GRANDES ORIENTATIONS POUR UN PROJET PATRIOTE … ÉDITION 2026-2027 » ; « Ce livret … présente les grandes orientations politiques de notre mouvement » ; le nom « Philippot » est absent de l'extrait.

### 24. florian-philippot/sante-soins-proximite-centres

- Constats : mêmes points 1 à 3 que la mesure 23.
- `resume`, `enfant` : « Florian Philippot » devient « Son parti, Les Patriotes, ».
- `detaille` : « Dans le Projet pour la France, publié par le mouvement Les Patriotes, Florian Philippot propose » devient « Dans le livret Grandes orientations pour un projet patriote, son parti, Les Patriotes, propose ».
- `aine` : même remplacement que la mesure 23.
- Appui : même couverture ; paragraphe « Investir massivement dans les soins de proximité pour désengorger l'hôpital ».

## Constats non appliqués, et pourquoi

1. Retailleau, chiffrages du candidat (mesure 5 : 1,0 et 0,7 Md€ ; mesure 6 : 1,7 Md€ ; fiche page 9, tableau « Md€ 2032 »). Écrits en chiffres, ils déclenchent `CHIFFRE_DETAILLE_HORS_SOURCE` (nouvel avertissement) en détaillé et une erreur en aîné, car ils ne sont pas dans `texte_source`. La voie propre est un champ `chiffrage` (texte et localisation), que je n'ai pas le droit d'ajouter. À décider par le propriétaire.
2. Collovati, montant « 1,2 Md » de la suppression de l'AME : même contrainte ; le texte dit « avec un autre montant » sans le chiffre.
3. Retailleau mesure 6, « Le médecin orienterait la personne » : non repris, la source ne dit pas qui oriente.
4. Dubuisson, « Le texte ne dit pas comment » : non ajouté, pas nécessaire au constat.
5. Rohou mesure 20, garder le sigle UNEDIC au détaillé : jugé acceptable par le relecteur, non modifié.
6. Batho mesure 12, autres niveaux : le détaillé garde « Dans la priorité de son site de campagne intitulée La pleine santé », que l'URL `/priorites/` soutient ; non signalé par le relecteur.

## Cas pour le propriétaire

1. Erwan Rohou : l'archive (page programme seule) ne nomme jamais Erwan Rohou et sa fiche a `parti: null`. Les deux mesures sont maintenant attribuées au seul Mouvement des Écologistes Indépendants, sans phrase qui relie le candidat au mouvement. Le rattachement au candidat ne repose plus que sur la fiche source (`candidats: [erwan-rohou]`). Il faut archiver une page qui établit ce lien (page d'accueil du mouvement), ou retirer ces mesures.
2. Lisnard, Zemmour, Philippot : formule « Son parti, <nom> » en résumé et enfant ; le nom du candidat n'apparaît plus dans ces niveaux. Vérifier que l'affichage (page thème) rend clair de quel candidat il s'agit.
3. Collovati : la ligne « Réduire l'AME » est sous l'intitulé « Constat de la situation actuelle en France » alors qu'elle est à l'infinitif prescriptif ; j'ai gardé « veut réduire » en résumé, enfant et aîné (non signalé). Même remarque pour la mesure sur l'endettement. Le titre devient « Réduction ou suppression » : à confirmer.
4. Classement santé : Collovati « dépense sociale, endettement de la sécurité sociale et des collectivités locales » (sous-thème `assurance-maladie`) ne vise la santé qu'indirectement ; Zemmour AME vient d'une rubrique immigration. Le relecteur les juge acceptables ; je n'ai rien changé.
5. Dates de source : aucun doute nouveau relevé. Rohou : `date_publication: 2026-11` sans jour (inchangé).
6. Lisibilité : quatre avertissements `LISIBILITE_ENFANT_FAIBLE` existaient déjà sur des fichiers de ce lot (contrairement à l'hypothèse de deux avertissements hors lot) : Retailleau prescripteurs (61,5, maintenant 66,2), Batho Constitution (70,1, inchangé), Rohou usagers (65,4, maintenant 61,9, baisse due au nom long du mouvement et à « association »), Philippot gestion hospitalière (76,9, maintenant 76,7). Aucun nouvel avertissement.

## Résultat du validateur (Node 24)

- `node scripts/validate.ts --mode preview` : 0 erreur, 23 avertissements (25 avant les corrections des deux lots).
- `--mode production` : 0 erreur, 23 avertissements.
- Sur les fichiers de ce lot : seulement les quatre `LISIBILITE_ENFANT_FAIBLE` déjà présents ; aucun nouveau diagnostic. Un avertissement transitoire (« deux » en lettres, Collovati AME) a été corrigé (« laquelle de ces formulations »).
- Contrôles locaux par mesure : longueurs dans les bornes, phrases enfant de 15 mots au plus, pas de tiret long ni demi-cadratin, pas de mot interdit.

## Fichiers modifiés (19)

- src/content/mesures/antoine-mikolajczak/sante-alimentation-soins-territoire.yaml
- src/content/mesures/bernard-cazeneuve/sante-grand-age-dependance.yaml
- src/content/mesures/bruno-retailleau/sante-prescripteurs-atypiques-plafonds.yaml
- src/content/mesures/bruno-retailleau/sante-reexamen-arrets-maladie.yaml
- src/content/mesures/christian-collovati/sante-reduction-ame.yaml
- src/content/mesures/christian-collovati/sante-securite-sociale-endettement.yaml
- src/content/mesures/david-lisnard/sante-conventionnement-differencie.yaml
- src/content/mesures/david-lisnard/sante-supprimer-ars.yaml
- src/content/mesures/delphine-batho/sante-defenseur-constitution.yaml
- src/content/mesures/delphine-batho/sante-deserts-medicaux.yaml
- src/content/mesures/edouard-philippe/sante-sante-mentale-ecole.yaml
- src/content/mesures/emmanuel-dubuisson/sante-parcours-soins-simple.yaml
- src/content/mesures/eric-zemmour/sante-acces-soins-desertification.yaml
- src/content/mesures/eric-zemmour/sante-supprimer-ame.yaml
- src/content/mesures/erwan-rohou/sante-egalite-acces-soins.yaml
- src/content/mesures/erwan-rohou/sante-usagers-conseil-administration.yaml
- src/content/mesures/fabien-roussel/sante-remboursement-100-securite-sociale.yaml
- src/content/mesures/florian-philippot/sante-simplifier-gestion-hospitaliere.yaml
- src/content/mesures/florian-philippot/sante-soins-proximite-centres.yaml

Glossaire : non modifié. Les autres fichiers modifiés dans le worktree (francis-lalanne, francois-ruffin, gabriel-attal, etc.) appartiennent à l'autre lot.
