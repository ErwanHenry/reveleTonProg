# Relecture par agent : lot A, thème santé (24 mesures, 13 candidats)

- Date : 2026-11-17
- Relecteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5)
- Lot : mesures `sante-*` de anasse-kazib, antoine-mikolajczak, bernard-cazeneuve, bruno-retailleau, christian-collovati, david-lisnard, delphine-batho, edouard-philippe, emmanuel-dubuisson, eric-zemmour, erwan-rohou, fabien-roussel, florian-philippot (24 fichiers, compte vérifié par `ls`).
- Contexte : le propriétaire a confirmé le 2026-11-17 que la ligne publique sous une mesure relue par un agent nommera un agent IA, pas lui. Un verdict `conforme` ci-dessous est donc un verdict que je signe : il n'est donné que si tous les contrôles ont été faits et n'ont rien trouvé.

## Méthode (en cinq lignes)

1. Pour chaque mesure : lecture du YAML (titre, sous-thème, citation, localisation, quatre rédactions, termes du glossaire marqués `[[...]]`) et de la fiche source (`src/content/sources/`).
2. Lecture de l'extrait archivé (`archive.extrait`) autour de la citation, pas seulement la citation ; numéro de page vérifié par les sauts de page de l'extrait quand la localisation cite une page.
3. Comparaison élément par élément de chaque niveau avec la source : qui, quoi, combien, quand, pour qui, conditions, modalité, portée, attribution (candidat ou parti, règle de `docs/COUVERTURE-THEMES.md` : un document de parti est compté comme tel, pas comme des paroles du candidat).
4. Neutralité : recherche des mots interdits et verbes connotés (`src/lib/content-core/rules/config.ts`) dans titres et rédactions (aucun trouvé dans le lot), puis lecture pour les jugements implicites ; lecture des définitions du glossaire utilisées.
5. Verdict : `conforme` seulement si rien n'est à corriger ; `doute` si un éditeur doit trancher ; `erreur` si un défaut factuel ou de neutralité doit être corrigé avant publication.

## Limites

- Je suis un modèle qui relit des textes écrits par un modèle : mes biais peuvent recouper ceux du rédacteur. Les points `doute` demandent une décision humaine ou une seconde lecture.
- J'ai travaillé uniquement sur les extraits archivés du dépôt, sans consulter les sites en direct ni les PDF d'origine (mise en page, images, encadrés absents de l'extrait texte ne sont pas vus).
- Les longueurs et mots interdits sont contrôlés par le validateur ; je ne les ai pas recomptés, sauf recherche des mots interdits.
- Les définitions du glossaire sont rédigées par le site, sans source primaire ; je les ai jugées sur leur exactitude générale et leur neutralité.

## Tableau de synthèse

| Mesure | Verdict | Motif en une ligne |
|---|---|---|
| anasse-kazib/sante-expropriation-secteurs-strategiques | conforme | Citation exacte, quatre niveaux fidèles, liste ouverte bien rendue |
| antoine-mikolajczak/sante-alimentation-soins-territoire | doute | Localisation « page 1 » alors que le passage est en page 2 du PDF |
| bernard-cazeneuve/sante-grand-age-dependance | doute | « mieux prendre en charge » (enfant, aîné) : comparatif absent de la source |
| bernard-cazeneuve/sante-soignants-sante-mentale | conforme | Citation exacte, quatre niveaux fidèles |
| bruno-retailleau/sante-prescripteurs-atypiques-plafonds | doute | Chiffrage du candidat (1,0 et 0,7 Md€) non repris ; « dits atypiques » en enfant |
| bruno-retailleau/sante-reexamen-arrets-maladie | doute | Enfant « il aiderait à choisir » ajoute une intention ; chiffrage 1,7 Md€ non repris |
| christian-collovati/sante-reduction-ame | erreur | Même page : « Suppression AME : 1,2 Md » omis ; aîné dit à tort que rien n'est dit d'autres aides |
| christian-collovati/sante-securite-sociale-endettement | doute | « ne précise pas si les remboursements seraient touchés » alors que la page suspend un mois les remboursements ; « objectifs » au lieu de « Constat » |
| david-lisnard/sante-conventionnement-differencie | doute | Texte du parti (« Nous proposons ») attribué à D. Lisnard en résumé et enfant ; enfant « moins bien remboursés » ambigu |
| david-lisnard/sante-supprimer-ars | doute | Détaillé présuppose des « conseils d'administration actuels » ; attribution parti ou candidat mêlée |
| delphine-batho/sante-defenseur-constitution | doute | « priorité 1 » absent de l'extrait ; phrase agrammaticale dans le détaillé |
| delphine-batho/sante-deserts-medicaux | doute | « priorité 1 » absent de l'extrait ; conditionnel « serait soutenue » introduit un doute absent de la source |
| edouard-philippe/sante-sante-mentale-ecole | erreur | Phrase répétée deux fois dans le détaillé ; présuppose des recrutements |
| edouard-philippe/sante-stabiliser-depenses-prevention | conforme | Citation exacte, quatre niveaux fidèles |
| emmanuel-dubuisson/sante-parcours-soins-simple | doute | Enfant : quatre phrases sans attribution, lues comme la voix du site |
| emmanuel-dubuisson/sante-sante-plus-proche | conforme | Citation exacte, quatre niveaux fidèles |
| eric-zemmour/sante-acces-soins-desertification | doute | Tract du parti qui ne nomme pas É. Zemmour, attribué au candidat ; « déserts médicaux » couvre mal les pharmacies |
| eric-zemmour/sante-supprimer-ame | doute | Même attribution ; enfant « votre argent » sans guillemets |
| erwan-rohou/sante-egalite-acces-soins | doute | Résumé change la modalité (« en contenant les dépenses ») ; lien candidat et mouvement non vérifiable dans l'archive |
| erwan-rohou/sante-usagers-conseil-administration | doute | Lien candidat et mouvement non vérifiable dans l'archive ; enfant « des patients » au lieu d'associations |
| fabien-roussel/sante-fin-limitation-ondam | conforme | Citation exacte, attribution au parti correcte, niveaux fidèles |
| fabien-roussel/sante-remboursement-100-securite-sociale | doute | « ne dit pas quels soins » alors que la suite du passage borne le périmètre |
| florian-philippot/sante-simplifier-gestion-hospitaliere | doute | Livret du mouvement qui ne nomme pas F. Philippot ; « que dirige » non sourcé ; titre du document |
| florian-philippot/sante-soins-proximite-centres | doute | Mêmes points d'attribution et de titre du document |

Décompte : 5 conforme, 17 doute, 2 erreur.

## Détail par mesure

### 1. anasse-kazib/sante-expropriation-secteurs-strategiques : conforme

- Source : `anasse-kazib-programme`, site de campagne, auteur candidat, consulté le 2026-11-04, extrait `archives/anasse-kazib/7e51275b7bb8.txt` : ok.
- Citation : présente mot pour mot sous « 2. Confisquer le pouvoir aux patrons », « Ce que nous voulons ». Localisation exacte (espace parasite avant le guillemet fermant, sans effet). ok.
- Contexte lu : la page dit « Le programme 2027 est en cours d'élaboration » et présente « les premières mesures ». Aucun niveau n'en dit le contraire. ok.
- Résumé, détaillé, enfant, aîné : fidèles ; la liste ouverte (« … ») est signalée ; « secteurs clés du pays » (enfant) reste dans le sens de « secteurs stratégiques ». ok.
- Neutralité, attribution : ok. Glossaire `expropriation` : définition exacte et neutre. ok.
- Titre et sous-thème (`gouvernance-sante`) : ok. Cohérence des niveaux : ok.

### 2. antoine-mikolajczak/sante-alimentation-soins-territoire : doute

- Source : tract de campagne Équinoxe portant le nom et la biographie du candidat, consulté le 2026-11-04 ; citation présente mot pour mot sous « VIVRE EN BONNE SANTÉ ». ok.
- Rédactions : fidèles, modalité « veut garantir » respectée, aucun ajout. ok.
- Neutralité : ok. Titre, sous-thème : ok.
- Point à corriger, localisation : `source_localisation` dit « page 1 du tract ». Dans l'extrait, la page 1 ne contient que la couverture (« ÉQUINOXE 2027 Renouer avec notre avenir Antoine Mikolajczak ») ; la rubrique « VIVRE EN BONNE SANTÉ » est après le premier saut de page, donc en page 2 du PDF. Proposition : « page 2 du PDF du tract, rubrique Vivre en bonne santé ».
- Point mineur, niveau enfant : « Il veut aussi garantir l'accès aux soins sur tout le territoire » rattache « sur tout le territoire » aux seuls soins, alors que la source l'applique aussi à l'alimentation. Proposition : « Il veut garantir partout en France l'accès à une alimentation de qualité. Il veut aussi garantir partout l'accès aux soins. »

### 3. bernard-cazeneuve/sante-grand-age-dependance : doute

- Source : lettre du candidat (programme, auteur candidat, 2026-07-15) ; citation exacte dans « Les propositions de Bernard Cazeneuve », proposition 5 ; contexte page 19 lu (« un chantier considérable, dont il nous appartient d'assurer la soutenabilité financière pour les familles les plus modestes à moyen et long terme »). ok.
- Résumé, détaillé : fidèles. ok.
- Problème, niveaux enfant et aîné : enfant « Il veut mieux les prendre en charge », aîné « Bernard Cazeneuve propose de mieux prendre en charge le grand âge ». La source dit « prise en charge du grand âge » sans comparatif. « mieux » ajoute un jugement sur la situation actuelle que le candidat n'écrit pas dans ce passage. Propositions : enfant « Il veut s'occuper de leur prise en charge quand elles sont en situation de [[dépendance]]. » ; aîné « Bernard Cazeneuve inscrit la prise en charge du grand âge et de la dépendance, c'est-à-dire... ».
- Glossaire `dependance`, `aidant-familial` : exacts et neutres. ok. Titre, sous-thème `grand-age` : ok.

### 4. bernard-cazeneuve/sante-soignants-sante-mentale : conforme

- Citation exacte, proposition 4 de la liste ; contexte page 19 cohérent (santé mentale de la jeunesse, grande cause nationale, formation des personnels de santé et de l'éducation). ok.
- Quatre niveaux fidèles ; « épreuve silencieuse de la jeunesse » attribuée au candidat (« qu'il décrit comme »). ok.
- Glossaire `sante-mentale`, `grande-cause-nationale` : exacts, neutres. ok. Titre, sous-thème : ok. Cohérence : ok.

### 5. bruno-retailleau/sante-prescripteurs-atypiques-plafonds : doute

- Source : fiches presse « Rétablir l'ordre dans les comptes publics », auteur candidat ; citation exacte, deuxième puce de « Ce que nous faisons », page 9 de l'extrait (vérifié par sauts de page). ok.
- Rédactions : fidèles sur le contenu des mesures. ok.
- Point 1, chiffrage du candidat omis (détaillé, aîné) : la même page donne le chiffrage du candidat : « Prescripteurs atypiques 1,0 » et « Plafonds de prescription 0,7 » (Md€ en 2032), dans une fiche titrée « Santé : les arrêts maladie, 4 Md€ ». Le site s'autorise le chiffrage du candidat ; ne pas le donner n'est pas faux, mais d'autres mesures du lot écrivent « ne donne aucun chiffre » quand il n'y en a pas, et l'objectif d'économies disparaît. Proposition (détaillé, ajout) : « La fiche chiffre l'économie attendue en 2032 à 1,0 milliard d'euros pour les prescripteurs atypiques et 0,7 milliard pour les plafonds. »
- Point 2, enfant : « Les médecins dits atypiques » : « dits » met une distance qui peut se lire comme ironique. Proposition : « Les médecins qui prescrivent plus d'arrêts que les autres » serait une interprétation ; plus sûr : « Certains médecins, appelés prescripteurs atypiques dans le texte, auraient des objectifs. »
- Neutralité sinon : ok. Glossaire `teleconsultation` : ok. Titre, sous-thème : ok.

### 6. bruno-retailleau/sante-reexamen-arrets-maladie : doute

- Citation exacte, première puce, page 9 : ok.
- Résumé, détaillé, aîné : fidèles. ok.
- Problème, enfant : « Il aiderait à choisir la suite pour la personne, comme une reprise adaptée. » La source dit « avec orientation vers la reprise adaptée, le temps partiel thérapeutique, la reconversion ou l'invalidité ». « aiderait » prête une intention bienveillante et ne garde que l'issue la plus favorable. Proposition : « Le médecin orienterait la personne : reprise du travail adaptée, temps partiel, autre métier ou invalidité. »
- Enfant, « Le texte ne donne pas de date de début » : ambigu (date de la réforme ou point de départ des trois mois). Proposition : « Le texte ne dit pas quand la mesure commencerait. »
- Chiffrage du candidat omis : « Réexamen à 3 et 6 mois 1,7 » Md€ en 2032, sur la même page. Proposition (détaillé) : « La fiche chiffre l'économie attendue à 1,7 milliard d'euros en 2032. »
- Glossaire `medecin-conseil` : exact, neutre. Titre, sous-thème : ok.

### 7. christian-collovati/sante-reduction-ame : erreur

- Source : site de campagne, auteur candidat ; citation exacte : « - Réduire l'AME (Aide Médicale d'Etat)(1,3 milliard €) ». ok.
- Erreur 1, omission qui change la position (tous niveaux) : la même page, section « BUDGET avec chiffrages possibles », « Economies », écrit « Suppression AME : 1,2 Md ». Le site du candidat parle donc à la fois de réduire et de supprimer l'AME, avec deux montants différents. Présenter seulement « réduire » rétrécit sa position. Proposition (détaillé, ajout) : « Plus bas sur la même page, dans une liste d'économies chiffrées, le site écrit aussi « Suppression AME : 1,2 Md ». Le texte ne dit pas laquelle des deux formulations prévaut. » Résumé : « Christian Collovati veut réduire l'AME (Aide médicale d'État) ; une autre liste de son site parle de la supprimer. » Enfant : « Plus loin, son site parle aussi de la supprimer. » Aîné : même ajout. Titre à revoir : « Réduction ou suppression de l'Aide médicale d'État ».
- Erreur 2, aîné : « Il ne dit pas non plus si d'autres aides seraient modifiées. » Faux pour la page : elle prévoit par exemple « Prestations sociales type RSA, APL, RMI, allocations familiales réservées aux français ». Proposition : supprimer la phrase.
- Doute, détaillé : « liste parmi ses objectifs » : la ligne figure sous l'intitulé « Constat de la situation actuelle en France » (la localisation le dit). Proposition : « Sur son site de campagne, dans une liste intitulée Constat de la situation actuelle en France, Christian Collovati écrit : réduire l'AME. »
- Le chiffre 1,3 milliard est bien présenté comme non expliqué. ok. Glossaire `aide-medicale-d-etat` : exact, neutre. Neutralité sinon : ok.

### 8. christian-collovati/sante-securite-sociale-endettement : doute

- Citation exacte, même liste « Constat de la situation actuelle en France ». ok.
- Doute 1, détaillé et aîné : « Il ne précise pas non plus si les soins ou les remboursements de l'assurance maladie seraient touchés » (détaillé), « ni si les remboursements de soins seraient touchés » (aîné). La même page prévoit, dès la prise de fonctions, l'« Arrêt du versement de ... remboursement de la sécurité sociale aux entreprises et aux particuliers (pour une durée de 1 mois ...) ». Ce n'est pas présenté comme la mise en oeuvre de cette ligne, mais le lecteur comprendra que le candidat n'a rien dit des remboursements, ce qui est inexact. Proposition : « Cette ligne ne précise pas quelles dépenses seraient freinées. Ailleurs sur la page, le candidat prévoit de suspendre un mois les versements, dont les remboursements de la sécurité sociale, le temps de contrôles. »
- Doute 2, détaillé : « liste parmi ses objectifs » ; l'intitulé est « Constat ». Même correction que la mesure 7.
- Détaillé, « Il n'indique pas comment l'endettement serait mesuré » : remarque sans objet pour le lecteur ; à retirer.
- Glossaire `securite-sociale`, `collectivite-locale` : ok. Titre : ok. Sous-thème `assurance-maladie` : acceptable (la ligne vise la sécurité sociale en général).

### 9. david-lisnard/sante-conventionnement-differencie : doute

- Source : page Santé du site du parti Nouvelle Énergie (auteur `parti_du_candidat`), consultée le 2026-11-03 ; citation exacte au point 1. ok.
- Détaillé, aîné : attribution correcte (« programme de Nouvelle Énergie, parti de David Lisnard »). ok.
- Doute 1, attribution (résumé, enfant) : « David Lisnard propose ». Le texte est écrit par le parti (« Nous proposons ») ; la règle du dépôt compte un document de parti comme tel, pas comme des paroles du candidat. Proposition (résumé) : « Le programme de Nouvelle Énergie, parti de David Lisnard, propose que la Sécurité sociale rembourse mieux les actes en zones sous-dotées. » Enfant : « Le parti de David Lisnard propose que... ».
- Doute 2, enfant : « Dans les zones saturées, ces soins seraient moins bien remboursés. » La source compare (« mieux ... que ») sans dire que le remboursement baisserait en zone saturée. Proposition : « Ils y seraient mieux remboursés que dans les zones où il y a beaucoup de soignants. »
- Glossaire `zone-sous-dotee`, `securite-sociale` : ok. Titre, sous-thème : ok.

### 10. david-lisnard/sante-supprimer-ars : doute

- Citation exacte au point 2 ; contexte lu (les ARS « devenues des forteresses comptables » : jugement du parti, non repris, ce qui est correct). ok.
- Doute 1, détaillé : « Il ne dit pas non plus ce que deviendraient les conseils d'administration actuels. » La source dit « redonner aux maires la présidence des conseils d'administration des hôpitaux » ; « actuels » présuppose que ces conseils existent aujourd'hui sous ce nom, ce que l'extrait n'établit pas (et « redonner » suggère un retour à une situation passée). Proposition : supprimer la phrase.
- Doute 2, attribution : le résumé mêle « Dans le programme de Nouvelle Énergie, David Lisnard veut » ; l'enfant écrit « David Lisnard veut ». Proposition (résumé) : « Le programme de Nouvelle Énergie, parti de David Lisnard, veut supprimer les ARS et transférer leurs responsabilités aux préfets et aux élus. » Enfant : « Le parti de David Lisnard veut supprimer... ».
- Glossaire `agence-regionale-de-sante`, `prefet`, `conseil-d-administration` : exacts, neutres. Titre, sous-thème : ok.

### 11. delphine-batho/sante-defenseur-constitution : doute

- Source : page du site de la candidate (auteur candidat), consultée le 2026-11-03 ; citation exacte sous « 05 Inscrire la pleine santé et le respect de l'habitabilité dans la Constitution ». ok.
- Localisation (point connu) : `source_localisation` dit « page de la priorité 1 La pleine santé , proposition 05 ». Ce que je constate : l'extrait commence par le titre « La pleine santé » ; les mots « Priorité 1 » n'y figurent nulle part (ils ne figurent que dans le titre de la fiche source et l'adresse contient `/priorites/la-pleine-sante/`). Je ne peux donc pas confirmer « priorité 1 » à partir de l'archive. « proposition 05 » est exact. Espace parasite avant la virgule. Proposition : « page La pleine santé (rubrique Priorités du site), proposition 05 Inscrire la pleine santé et le respect de l'habitabilité dans la Constitution ».
- Détaillé, phrase agrammaticale : « Le texte donne pour buts à cette inscription guider toutes les politiques publiques, ... ». Proposition : « Selon le texte, cette inscription doit guider toutes les politiques publiques, reconnaître l'interdépendance avec l'ensemble du vivant et empêcher l'adoption de lois toxiques. »
- Fond des quatre niveaux : fidèle ; « Nous créerons » rendu par « annonce la création » et « veut », acceptable. « lois toxiques » est l'expression de la candidate, reprise attribuée. ok.
- Glossaire `constitution` : ok. Titre, sous-thème : ok.

### 12. delphine-batho/sante-deserts-medicaux : doute

- Citation exacte sous « 04 Mettre fin aux déserts médicaux ». ok.
- Localisation : même constat que la mesure 11 sur « priorité 1 ». Proposition : « page La pleine santé (rubrique Priorités du site), proposition 04 Mettre fin aux déserts médicaux ».
- Doute, détaillé : « Le texte indique qu'elle serait soutenue par 86 % de la population ». La source écrit à l'indicatif « soutenue par 86 % de la population » ; le conditionnel journalistique introduit un doute que la méthode du site écarte. Proposition : « Le texte indique qu'elle est soutenue par 86 % de la population, sans citer d'étude. » (l'extrait ne cite en effet aucune source pour ce chiffre).
- Contexte : la source rattache le texte à un « groupe de travail transpartisan » cofondé par la candidate ; aucun niveau ne dit qu'elle en est l'autrice seule, ce qui est correct. ok.
- Autres niveaux fidèles. Glossaire `desert-medical` : ok. Titre, sous-thème : ok.

### 13. edouard-philippe/sante-sante-mentale-ecole : erreur

- Source : page du site de campagne du candidat, consultée le 2026-11-04 ; citation exacte. ok.
- Erreur, détaillé : la phrase « Il ne dit pas non plus comment les problèmes de santé mentale seraient repérés ni par qui. » est écrite deux fois de suite. Défaut éditorial visible du public. Proposition : supprimer la seconde occurrence.
- Doute, détaillé : « combien de personnes seraient recrutées, ni dans quels établissements cela commencerait » présuppose des recrutements et un déploiement progressif que la source n'évoque pas. Proposition : « Le texte ne précise pas qui seraient ces tiers de confiance, avec quels moyens, ni à partir de quand. »
- Localisation : exacte pour la page ; la rubrique « Pour une école de la liberté et de l'exigence » pourrait être ajoutée. Mineur.
- Résumé, enfant, aîné : fidèles. Glossaire `sante-mentale` : ok. Titre, sous-thème : ok.

### 14. edouard-philippe/sante-stabiliser-depenses-prevention : conforme

- Citation exacte sous « Rétablir nos comptes pour retrouver notre souveraineté » ; localisation exacte. ok.
- Quatre niveaux fidèles ; « n'augmentent plus » (enfant) rend « stabiliser » ; « plutôt que sur la seule hausse des moyens » bien rendu par « pas seulement ». ok.
- Neutralité, attribution : ok. Glossaire `prevention` : ok. Titre, sous-thème `prevention` : ok. Cohérence : ok.

### 15. emmanuel-dubuisson/sante-parcours-soins-simple : doute

- Source : dossier 3 du site du candidat, consulté le 2026-11-03 ; citation exacte dans la section « Un parcours de soins plus simple ». ok.
- Résumé, détaillé, aîné : fidèles et attribués (« écrit », « selon lui »). ok.
- Doute, enfant : après « Emmanuel Dubuisson veut que les soins soient plus simples. », les quatre phrases suivantes (« Les gens doivent obtenir une réponse claire et rapide. ... Le médecin doit pouvoir soigner sans perdre son temps en démarches inutiles. ») sont écrites sans attribution : elles se lisent comme des affirmations du site. Proposition : « Emmanuel Dubuisson veut que les soins soient plus simples. Pour lui, chacun doit avoir une réponse claire et rapide. Il ne veut pas qu'on se perde entre plusieurs portes. Il veut que le patient sache où aller. Il veut que le médecin perde moins de temps en démarches inutiles. Le texte ne dit pas comment. »
- Neutralité sinon : ok. Titre, sous-thème : ok.

### 16. emmanuel-dubuisson/sante-sante-plus-proche : conforme

- Citation exacte dans la section « Une santé plus proche des gens ». ok.
- Quatre niveaux fidèles et attribués ; l'enfant garde « Il ne veut pas » et le conditionnel « serait ». ok.
- Neutralité : ok. Titre, sous-thème : ok. Cohérence : ok.

### 17. eric-zemmour/sante-acces-soins-desertification : doute

- Source : tract de Reconquête (auteur `parti_du_candidat`), consulté le 2026-11-04 ; citation exacte, page 2 de l'extrait, sous « L'IMMIGRATION NÉGATIVE, MAINTENANT ! ». Localisation exacte. ok.
- Doute 1, attribution (résumé, détaillé, aîné) : « Éric Zemmour propose ». L'extrait du tract ne nomme pas Éric Zemmour (il parle au nom de « Reconquête »). Le détaillé et l'aîné nomment bien le tract du parti, mais en font la proposition du candidat. Proposition (résumé) : « Le tract de Reconquête, parti d'Éric Zemmour, propose de concentrer les moyens pour assurer un accès au soin partout en France. » Même tournure aux autres niveaux.
- Doute 2, enfant : « Éric Zemmour parle des endroits où il manque de médecins et de pharmacies. On les appelle des [[déserts médicaux|desert-medical]]. » La définition du glossaire ne parle que de médecins ; le manque de pharmacies n'est pas un désert médical au sens de la définition. Proposition : « Il parle des endroits où il manque des médecins et des pharmacies, comme les [[déserts médicaux|desert-medical]]. »
- Détaillé : « La phrase se trouve dans le même paragraphe que la suppression de l'aide médicale d'État » : exact et utile au contexte. ok.

### 18. eric-zemmour/sante-supprimer-ame : doute

- Citation exacte, même paragraphe. ok. Le qualificatif « clandestins » est cité entre guillemets en résumé, détaillé, aîné : attribution correcte.
- Doute 1, attribution : même remarque que la mesure 17 (tract du parti qui ne nomme pas le candidat ; l'aîné écrit « qu'il décrit comme »). Proposition (aîné) : « que le tract décrit comme une aide « qui soigne les clandestins avec votre argent » ».
- Doute 2, enfant : « Il dit qu'elle est payée avec votre argent. » Sans guillemets, « votre » s'adresse au lecteur enfant comme si le site parlait. Proposition : « Le tract dit qu'elle est payée « avec votre argent ». »
- Détaillé et aîné, « ni le sort des soins urgents » : remarque fondée sur une connaissance extérieure du dispositif, sans être fausse ; acceptable.
- Glossaire `aide-medicale-d-etat` : exact, neutre. Titre : ok. Sous-thème `assurance-maladie` : acceptable.

### 19. erwan-rohou/sante-egalite-acces-soins : doute

- Source : programme du Mouvement des Écologistes Indépendants (auteur `parti_du_candidat`), consulté le 2026-11-03 ; citation exacte, proposition 6. ok.
- Doute 1, résumé : « place l'accès aux soins parmi quatre égalités à garantir, en contenant les dépenses ». La source dit « sans ignorer la nécessité de contenir les dépenses » : une réserve, pas un engagement à contenir. Proposition : « Le programme du mouvement soutenant Erwan Rohou place l'accès aux soins parmi quatre égalités à garantir, sans ignorer la nécessité de contenir les dépenses. »
- Doute 2, lien entre le candidat et le mouvement (détaillé, aîné) : « dont Erwan Rohou est le candidat selon l'accueil du mouvement ». L'archive ne contient que la page programme, qui ne nomme pas Erwan Rohou ; la page d'accueil n'est pas archivée, et la fiche du candidat indique `parti: null`. Le lien n'est donc pas vérifiable dans le dépôt. Correction : archiver la page d'accueil comme source, ou citer la source qui établit ce lien.
- Détaillé, « Il ne chiffre pas la limite de dépenses » présuppose une limite. Proposition : « Il ne donne aucun chiffre. »
- Enfant, aîné : fidèles. Titre, sous-thème : ok.

### 20. erwan-rohou/sante-usagers-conseil-administration : doute

- Citation exacte, proposition 38. ok.
- Doute 1 : même lien candidat et mouvement non vérifiable dans l'archive (voir mesure 19).
- Doute 2, enfant : « Par exemple, des patients de l'[[assurance maladie]]. » La source parle d'une « association de patients », pas de patients individuels. Proposition : « Par exemple, une association de patients à l'[[assurance maladie]]. »
- Détaillé : « une association de chômeurs à l'assurance chômage » pour « à l'UNEDIC » : glissement acceptable (l'UNEDIC gère l'assurance chômage), on peut garder le sigle. ok.
- Glossaire `assurance-maladie`, `conseil-d-administration` : ok. Titre, sous-thème : ok.

### 21. fabien-roussel/sante-fin-limitation-ondam : conforme

- Source : cahier « Sécurité sociale » du PCF (auteur `parti_du_candidat`, 2025-09-24) ; citation exacte, page 16 de l'extrait, rubrique « Un financement qui réponde aux besoins ». Localisation exacte. ok.
- Attribution au parti dans les quatre niveaux. ok.
- Fidélité : « étrangle » rendu par « met en difficulté » (enfant), « estime » (aîné) ; la suite du passage (« des financements supplémentaires sont nécessaires ») ne décrit pas de mécanisme de remplacement : la phrase « ne dit pas par quel mécanisme » est juste. ok.
- Glossaire `parlement`, `assurance-maladie`, `prevention` : ok. Titre, sous-thème : ok. Cohérence : ok.

### 22. fabien-roussel/sante-remboursement-100-securite-sociale : doute

- Citation exacte, page 15 de l'extrait, chapitre 4. ok. Attribution au parti : ok.
- Doute, détaillé et aîné : « Le texte cité ne dit pas ... quels soins seraient concernés » et « ni la liste des soins concernés ». La suite immédiate du passage borne le périmètre : il ne peut s'agir « d'un seul panier de soins limité », il ne s'agit pas de rembourser « les médecines parallèles », et « c'est la démocratie qui doit trancher ce qui doit être remboursé ». Le lecteur croira que le cahier est muet sur ce point. Proposition (détaillé) : « Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui est remboursé. Il ne donne ni date ni coût. »
- Titre : « Remboursement à 100 % des soins prescrits par la Sécurité sociale » ; la source dit « aller vers ». Proposition : « Vers le remboursement à 100 % des soins prescrits par la Sécurité sociale ».
- Enfant, résumé : fidèles. Glossaire `securite-sociale` : ok.

### 23. florian-philippot/sante-simplifier-gestion-hospitaliere : doute

- Source : livret des Patriotes (auteur `parti_du_candidat`), consulté le 2026-11-04 ; citation exacte, page 5 de l'extrait (vérifié), paragraphe « Réduire la bureaucratie et rendre aux soignants la maîtrise de leur métier ». ok.
- Doute 1, attribution : le livret présente « les grandes orientations politiques de notre mouvement » et l'extrait ne nomme jamais Florian Philippot. Résumé et enfant écrivent « Florian Philippot propose / veut » ; le détaillé « Florian Philippot consacre un paragraphe ». Proposition (résumé) : « Le livret des Patriotes, mouvement de Florian Philippot, propose de simplifier la gestion hospitalière, de supprimer les obligations inutiles et les agences régionales de santé. »
- Doute 2, aîné : « le mouvement Les Patriotes que dirige Florian Philippot » : fait qui n'est pas dans l'archive. Proposition : « le mouvement Les Patriotes, parti de Florian Philippot » (cohérent avec la fiche candidat `parti: Les Patriotes`).
- Doute 3, titre du document : les niveaux disent « le Projet pour la France » ; ce nom ne vient que du nom du fichier PDF. La couverture de l'extrait porte « Grandes orientations pour un projet patriote, édition 2026-2027 ». Proposition : « le livret Grandes orientations pour un projet patriote ».
- Doute 4, détaillé : « consacre un paragraphe ... à la bureaucratie des soignants » : la source parle d'une bureaucratie qui pèse sur les soignants. Proposition : « à la bureaucratie qui pèse sur les soignants ».
- Glossaire `agence-regionale-de-sante` : ok. Titre, sous-thème : ok.

### 24. florian-philippot/sante-soins-proximite-centres : doute

- Citation exacte, page 5, paragraphe « Investir massivement dans les soins de proximité pour désengorger l'hôpital ». ok.
- Fidélité : bonne ; la suite (« raccourcir les délais de prise en charge ») n'est pas reprise, sans distorsion. ok.
- Doutes : mêmes points 1 à 3 que la mesure 23 (attribution au candidat d'un livret qui ne le nomme pas ; « que dirige » non sourcé ; nom du document). Propositions identiques.
- Titre, sous-thème : ok.

## Bloc lisible par script

```json
[
  { "cible": "mesure:anasse-kazib/sante-expropriation-secteurs-strategiques", "verdict": "conforme", "niveaux": [], "motif": "Citation exacte, quatre niveaux fidèles" },
  { "cible": "mesure:antoine-mikolajczak/sante-alimentation-soins-territoire", "verdict": "doute", "niveaux": ["localisation", "enfant"], "motif": "Localisation page 1 alors que le passage est en page 2 du PDF ; portée de « sur tout le territoire » en enfant" },
  { "cible": "mesure:bernard-cazeneuve/sante-grand-age-dependance", "verdict": "doute", "niveaux": ["enfant", "aine"], "motif": "« mieux prendre en charge » : comparatif absent de la source" },
  { "cible": "mesure:bernard-cazeneuve/sante-soignants-sante-mentale", "verdict": "conforme", "niveaux": [], "motif": "Citation exacte, quatre niveaux fidèles" },
  { "cible": "mesure:bruno-retailleau/sante-prescripteurs-atypiques-plafonds", "verdict": "doute", "niveaux": ["detaille", "aine", "enfant"], "motif": "Chiffrage du candidat (1,0 et 0,7 Md€ en 2032) non repris ; « dits atypiques » en enfant" },
  { "cible": "mesure:bruno-retailleau/sante-reexamen-arrets-maladie", "verdict": "doute", "niveaux": ["enfant", "detaille"], "motif": "Enfant « il aiderait à choisir » ajoute une intention et réduit les orientations ; chiffrage 1,7 Md€ non repris" },
  { "cible": "mesure:christian-collovati/sante-reduction-ame", "verdict": "erreur", "niveaux": ["resume", "detaille", "enfant", "aine", "titre"], "motif": "La même page écrit « Suppression AME : 1,2 Md » ; aîné affirme à tort que d'autres aides ne sont pas évoquées ; « objectifs » au lieu de « Constat »" },
  { "cible": "mesure:christian-collovati/sante-securite-sociale-endettement", "verdict": "doute", "niveaux": ["detaille", "aine"], "motif": "Dit que les remboursements ne sont pas évoqués alors que la page prévoit d'en suspendre le versement un mois ; « objectifs » au lieu de « Constat »" },
  { "cible": "mesure:david-lisnard/sante-conventionnement-differencie", "verdict": "doute", "niveaux": ["resume", "enfant"], "motif": "Texte du parti attribué au candidat ; enfant « moins bien remboursés » laisse croire à une baisse" },
  { "cible": "mesure:david-lisnard/sante-supprimer-ars", "verdict": "doute", "niveaux": ["detaille", "resume", "enfant"], "motif": "Présuppose des « conseils d'administration actuels » ; attribution parti ou candidat mêlée" },
  { "cible": "mesure:delphine-batho/sante-defenseur-constitution", "verdict": "doute", "niveaux": ["localisation", "detaille"], "motif": "« priorité 1 » absent de l'extrait archivé ; phrase agrammaticale dans le détaillé" },
  { "cible": "mesure:delphine-batho/sante-deserts-medicaux", "verdict": "doute", "niveaux": ["localisation", "detaille"], "motif": "« priorité 1 » absent de l'extrait archivé ; conditionnel « serait soutenue » ajoute un doute" },
  { "cible": "mesure:edouard-philippe/sante-sante-mentale-ecole", "verdict": "erreur", "niveaux": ["detaille"], "motif": "Phrase répétée deux fois ; présuppose des recrutements non évoqués par la source" },
  { "cible": "mesure:edouard-philippe/sante-stabiliser-depenses-prevention", "verdict": "conforme", "niveaux": [], "motif": "Citation exacte, quatre niveaux fidèles" },
  { "cible": "mesure:emmanuel-dubuisson/sante-parcours-soins-simple", "verdict": "doute", "niveaux": ["enfant"], "motif": "Quatre phrases sans attribution, lues comme la voix du site" },
  { "cible": "mesure:emmanuel-dubuisson/sante-sante-plus-proche", "verdict": "conforme", "niveaux": [], "motif": "Citation exacte, quatre niveaux fidèles" },
  { "cible": "mesure:eric-zemmour/sante-acces-soins-desertification", "verdict": "doute", "niveaux": ["resume", "detaille", "enfant", "aine"], "motif": "Tract du parti qui ne nomme pas le candidat, attribué au candidat ; pharmacies rangées sous « déserts médicaux »" },
  { "cible": "mesure:eric-zemmour/sante-supprimer-ame", "verdict": "doute", "niveaux": ["resume", "detaille", "enfant", "aine"], "motif": "Même attribution ; enfant « votre argent » sans guillemets" },
  { "cible": "mesure:erwan-rohou/sante-egalite-acces-soins", "verdict": "doute", "niveaux": ["resume", "detaille", "aine"], "motif": "Résumé change la modalité ; lien candidat et mouvement non vérifiable dans l'archive" },
  { "cible": "mesure:erwan-rohou/sante-usagers-conseil-administration", "verdict": "doute", "niveaux": ["detaille", "aine", "enfant"], "motif": "Lien candidat et mouvement non vérifiable dans l'archive ; enfant « des patients » au lieu d'une association" },
  { "cible": "mesure:fabien-roussel/sante-fin-limitation-ondam", "verdict": "conforme", "niveaux": [], "motif": "Citation exacte, attribution au parti, niveaux fidèles" },
  { "cible": "mesure:fabien-roussel/sante-remboursement-100-securite-sociale", "verdict": "doute", "niveaux": ["detaille", "aine", "titre"], "motif": "Dit que les soins concernés ne sont pas précisés alors que la suite du passage borne le périmètre ; titre sans « vers »" },
  { "cible": "mesure:florian-philippot/sante-simplifier-gestion-hospitaliere", "verdict": "doute", "niveaux": ["resume", "detaille", "enfant", "aine"], "motif": "Livret du mouvement attribué au candidat ; « que dirige » non sourcé ; nom du document ; « bureaucratie des soignants »" },
  { "cible": "mesure:florian-philippot/sante-soins-proximite-centres", "verdict": "doute", "niveaux": ["resume", "detaille", "enfant", "aine"], "motif": "Livret du mouvement attribué au candidat ; « que dirige » non sourcé ; nom du document" }
]
```
