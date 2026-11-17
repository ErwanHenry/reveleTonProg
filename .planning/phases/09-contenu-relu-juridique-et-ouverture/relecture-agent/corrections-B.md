# Corrections par agent, lot B : mesures santé (16 mesures corrigées)

- Date : 2026-11-17
- Auteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5), décision du propriétaire du 2026-11-17 « Agent corrige, autre agent revérifie ».
- Entrée : `relecture-agent/mesures-B.md` (16 mesures `doute` ou `erreur`). Les 7 mesures `conforme` n'ont pas été touchées.
- Worktree : `/Users/erwanhenry/claude-projects/reveleTonProg-relecture`, branche `relecture/sante`. Rien n'est commité.
- Méthode : pour chaque constat, relecture du passage dans l'extrait archivé (`archive.extrait` de la fiche source), puis modification ciblée du seul niveau concerné. Aucun `texte_source`, `source`, `id`, fichier source, archive, glossaire ou fichier de couverture modifié.

## Contrainte rencontrée : la règle REGLE-04 du validateur

Le validateur refuse (erreur en enfant et aîné, avertissement en détaillé) tout chiffre absent du `texte_source` ou du `chiffrage`, même s'il figure ailleurs dans l'extrait archivé. Plusieurs corrections proposées par le relecteur ajoutaient un chiffre de la phrase voisine (14 milliards, 2025, 2027, 10 milliards, dix ans, 2017). Je ne peux ni élargir le `texte_source` ni ajouter un `chiffrage`. J'ai donc corrigé l'affirmation fausse sans chiffre : soit en décrivant ce que dit la source (« la phrase suivante donne le nombre de ces arrêts et leur charge »), soit avec une formulation équivalente sans nombre (« l'année de l'élection présidentielle » pour 2027, « une échéance » pour dans dix ans). Si le propriétaire veut ces chiffres dans les rédactions, il faut élargir le `texte_source` à la phrase voisine (cas listés plus bas).

## Détail par mesure

### 1. francis-lalanne/sante-fin-pass-obligations-medicales

- Constat : localisation fausse (quatrième point, pas cinquième).
- `source_localisation` : avant « page Le Projet 2027, axe 3 Liberté !, cinquième point » ; après « page Le Projet 2027, axe 3 Liberté !, quatrième point ».
- Source : sous « 3. Liberté ! », les points sont dans l'ordre « Liberté d'expression totale », « Refus du contrôle social », « Stop à l'intrusion de l'État », puis « Fin du pass et des obligations médicales ».

### 2. francois-ruffin/sante-pole-public-medicament

- Constats : sous-thème inadapté ; détaillé et aîné disent que le texte ne précise pas les médicaments.
- `sous_theme` : avant `hopital-et-soignants` ; après `gouvernance-sante` (liste vérifiée dans `src/content/themes/sante.yaml`, cohérent avec la mesure Polony).
- Détaillé, dernière phrase : avant « Le passage cité ne précise ni le coût, ni les médicaments concernés, ni les entreprises visées, ni la date. » ; après « La suite du texte précise que ce pôle aurait une gouvernance mixte (État, collectivités, représentants des soignants et des patients) et produirait d'abord des médicaments essentiels à brevet public. Elle ne donne ni le coût, ni le nom des entreprises visées, ni la date. »
- Aîné, dernière phrase : avant « Le passage ne dit pas combien cela coûterait ni quels médicaments seraient produits. » ; après « Le texte précise que le pôle aurait une gouvernance mixte et produirait d'abord des médicaments essentiels à brevet public. Il ne dit pas combien cela coûterait. »
- Source : « une entité à gouvernance mixte (État, collectivités, représentants des soignants et des patients) » ; « Mission n°1 : Une capacité de production nationale pour des médicaments essentiels à brevet public dans un premier temps ».
- Écart avec la proposition : « ni le nom des entreprises visées » au lieu de « ni les entreprises visées », car la mission n°2 cite une catégorie (« biotechs et entreprises pharmaceutiques françaises à fort potentiel innovant ») sans nom. Coût et date : absents de toutes les mentions du pôle dans l'extrait (vérifié).

### 3. gabriel-attal/sante-droit-climatisation

- Constats : détaillé et aîné affirment l'absence de date ; l'enfant élargit les contraintes patrimoniales.
- Détaillé, dernière phrase : avant « Il ne chiffre pas le coût et ne donne pas de date d'application. » ; après « Il ne chiffre pas le coût. La page indique que ce droit doit protéger les Français dès l'été prochain, sans date plus précise. »
- Aîné, dernière phrase : avant « Le texte ne dit pas comment ces blocages seraient levés ni à quelle date la mesure s'appliquerait. » ; après « Le texte ne dit pas comment ces blocages seraient levés. La page indique que ce droit doit protéger les Français dès l'été prochain. »
- Enfant, quatrième phrase : avant « Il veut aussi simplifier des règles sur les logements anciens. » ; après « Il veut aussi simplifier des règles qui protègent les bâtiments anciens. »
- Source : « Ce droit doit protéger les Français dès l'été prochain, pendant que se construit la filière de la géoénergie. » (page datée « 25 juin 2026 ») ; « contraintes patrimoniales imposées par les Architectes des Bâtiments de France ».
- Lisibilité enfant : avertissement préexistant (67,5), désormais 66,9 ; non nouveau.

### 4. jean-francois-legendre/sante-analyser-arrets-maladie

- Constats : le détaillé dit que le texte ne chiffre pas le coût ; localisation imprécise.
- `source_localisation` : avant « manifeste, paragraphe sur la solidarité et les abus, après le passage sur l'assistanat » ; après « manifeste, partie La fiscalité, paragraphe sur la solidarité et les abus ».
- Détaillé, dernière phrase : avant « Le texte ne chiffre pas non plus le coût de ces arrêts. » ; après « La phrase suivante du manifeste donne le nombre de ces arrêts sur une année et leur charge pour l'assurance maladie. »
- Source : « La fiscalité Le mode de fonctionnement de notre fiscalité… » puis « Neuf millions d'arrêts en 2025 qui représentent une charge de 14 milliards pour l'assurance maladie ».
- Écart avec la proposition : les chiffres (neuf millions, 2025, 14 milliards) ne sont pas repris à cause de REGLE-04 (voir plus haut).

### 5. jean-francois-legendre/sante-preserver-prise-en-charge

- Constats : le détaillé dit « ni s'il serait modifié » alors que le manifeste prévoit moins de remboursements ; l'enfant présente la description du candidat comme un fait ; l'aîné omet la baisse des remboursements.
- Détaillé : avant « Le texte ne dit pas comment ce système serait préservé, ni par quels moyens, ni s'il serait modifié. Le passage figure dans une partie consacrée à l'assistanat. » ; après « Le passage figure dans une partie consacrée à l'assistanat. Après les paragraphes sur la santé, l'éducation, le logement et les transports, le manifeste écrit que, pour que tout cela continue, il faudra faire des choix, tous ensemble. Plus haut, parmi les efforts demandés pour réduire les déficits, il prévoit moins de remboursements pour les actes médicaux et les médicaments. »
- Enfant : avant « Les soins sont pris en charge par des organismes de l'État. Il suffit de montrer la carte Vitale. Il écrit qu'il faut préserver ce système. Il note que très peu de pays font pareil. » ; après « Selon lui, des organismes de l'État paient tous les soins. D'après lui, il suffit de montrer sa carte Vitale. Il écrit qu'il faut préserver ce système. Il note que très peu de pays font pareil. Le même texte prévoit aussi moins de remboursements de soins et de médicaments. »
- Aîné, ajout après la dernière phrase : « Plus haut, parmi les efforts demandés pour réduire les déficits, le manifeste prévoit moins de remboursements pour les actes médicaux et les médicaments. »
- Source : « Les efforts demandés ne seront pas des taxes supplémentaires, ils consisteront en des réductions des versements de l'État […]. Donc moins de remboursements pour les actes médicaux et les médicaments » ; « Si nous voulons que tout cela continue, il va falloir faire des choix et nous les ferons tous ensemble ».
- Écarts avec la proposition : (a) je n'écris pas « dans la même partie » : la phrase sur les remboursements est dans le passage « Construire solide en brisant la dette », avant « En France, l'assistanat est partout. La santé » ; l'extrait est sur une seule ligne et ne permet pas d'affirmer que c'est la même partie, d'où « Plus haut, parmi les efforts demandés pour réduire les déficits ». (b) Je ne reprends pas « juge le système trop généreux » : dans la source, « notre système est trop généreux » vise le système social en général (retraites, 35 heures), pas la santé. (c) Le détaillé disait aussi « ni par quels moyens » : remplacé par ce que dit le texte (des choix faits tous ensemble).

### 6. jean-luc-melenchon/sante-budget-hopitaux-postes-soignants

- Constats : « pas de calendrier » et « pas de financement » démentis par le document.
- Détaillé : « sur quelle durée, » supprimé ; dernière phrase avant « Le texte indique le montant de la hausse du budget, mais pas le calendrier de cette hausse. » ; après « Le document range cette hausse dans ses orientations budgétaires pour l'année de l'élection présidentielle, financées selon lui en faisant contribuer les plus riches. »
- Enfant, dernière phrase : avant « Il ne dit pas combien de temps cela prendrait. » ; après « Le texte place cette hausse dans son budget pour l'année de l'élection. »
- Aîné : « ni sur combien d'années, » supprimé ; dernière phrase avant « Il ne dit pas comment cette hausse serait financée. » ; après « Le document range cette hausse dans ses orientations budgétaires pour l'année de l'élection présidentielle, financées selon lui en faisant contribuer les plus riches. »
- Source : « Ce document présente donc les grandes orientations budgétaires que la France insoumise propose pour l'année 2027 » ; « nous proposons d'augmenter d'un peu plus de 100 milliards d'euros les recettes fiscales pour l'année prochaine […] uniquement en faisant contribuer les plus riches » ; en-tête « Élection présidentielle - 18 avril 2027 ».
- Écart avec la proposition : « 2027 » remplacé par « l'année de l'élection présidentielle » (REGLE-04 : 2027 absent du `texte_source`, erreur en enfant et aîné).

### 7. jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad

- Constats : le résumé omet « contre les incendies » ; « ni le calendrier » à nuancer.
- Résumé : avant « …qui commencerait par équiper les hôpitaux, les Ehpad, les écoles et des logements. » ; après « …qui commencerait par équiper hôpitaux, Ehpad, écoles et certains logements contre les incendies. »
- Détaillé, dernière phrase : avant « Le texte ne précise pas quel matériel serait installé, ni le calendrier, ni le coût propre à ce plan. » ; après « Le texte ne précise pas quel matériel serait installé, ni le coût propre à ce plan. Le document présente ses orientations budgétaires pour l'année de l'élection présidentielle, sans calendrier propre à ce plan. »
- Aîné, dernière phrase : avant « Le texte ne précise ni le matériel prévu, ni le calendrier, ni le coût de ce plan. » ; après « Le texte ne précise ni le matériel prévu, ni le coût de ce plan. Le document présente ses orientations pour l'année de l'élection présidentielle, sans calendrier propre à ce plan. »
- Source : « Ce plan d'urgence contre les canicules commencera par équiper les hôpitaux, Ehpad, écoles et logements dits « bouilloires thermiques » contre les incendies. » ; orientations « pour l'année 2027 ».
- Non repris : « 10 milliards devront être investis dès 2026 » (REGLE-04).

### 8. marine-tondelier/sante-prevention-priorites

- Constat : le détaillé tait les exemples donnés dans la même proposition.
- Détaillé, dernière phrase : avant « Le texte cité ne dit pas quel budget y serait consacré, ni quelles mesures précises composeraient chaque plan. » ; après « La suite de la proposition donne des exemples : programmes d'éducation à la santé pour les enfants, remboursement de séances de diététique, soutien aux associations et interdiction de produits nocifs pour lutter contre l'obésité. Le texte ne dit pas quel budget y serait consacré. »
- Source : « Par exemple, instaurer des programmes éducatifs sur l'éducation à la santé et la connaissance de son corps pour les enfants, rembourser des séances de diététique, soutenir les associations et les groupes de pairs et interdire les produits nocifs pour mieux lutter contre l'obésité. » Aucun montant pour la prévention dans l'extrait (vérifié : seule une hausse de taxes sur alcool, tabac, sucre est citée ailleurs, sans montant).

### 9. natacha-polony/sante-medicaments-essentiels-production

- Constats : horizon « dans dix ans » omis, « aucun chiffre » et « ni calendrier » faux ; « avec » ambigu dans le résumé.
- Résumé : « avec son énergie » devient « comme son énergie ».
- Détaillé : avant « Le passage vient après une phrase qui fixe pour objectif de retrouver la puissance industrielle. Le texte ne précise pas quels médicaments seraient concernés, par quels moyens ils seraient produits, ni quelle part de la consommation serait visée. Il ne donne aucun chiffre. » ; après « Le passage suit une phrase qui fixe une échéance pour que la France ait retrouvé sa puissance industrielle. Le paragraphe suivant ajoute que l'État doit redevenir stratège et planifier les investissements essentiels, sans détail propre aux médicaments. Le texte ne précise pas quels médicaments seraient concernés, ni quelle part de la consommation serait visée. »
- Aîné : avant « Ce passage suit l'objectif de retrouver une puissance industrielle. Le texte ne précise pas quels médicaments seraient fabriqués en France, ni avec quels moyens, ni sur quel calendrier. » ; après « Ce passage suit l'objectif, assorti d'une échéance, de retrouver la puissance industrielle. Le texte ne précise pas quels médicaments seraient fabriqués en France. Il ajoute que l'État doit redevenir stratège et planifier les investissements essentiels, sans détail propre aux médicaments. »
- Source : « Dans dix ans, la France doit avoir retrouvé sa puissance industrielle. » ; « L'État doit redevenir stratège. Planifier les investissements essentiels. »
- Écarts : « dix ans » non écrit (REGLE-04, nombre en lettres) ; en plus du constat, j'ai retiré « par quels moyens » et « ni avec quels moyens » (règle 2) puisque le paragraphe suivant parle des moyens, en termes généraux.

### 10. nathalie-arthaud/sante-embauches-hopitaux

- Constats : proposition générale sur l'emploi classée en santé ; page PDF non vérifiable. Consigne 4 : portée rendue explicite dans tous les niveaux.
- `titre` : avant « Liste des embauches nécessaires établie par le personnel des hôpitaux, des Ehpad, de l'éducation et des transports publics » ; après « Idée d'une liste des embauches nécessaires, établie par le personnel des hôpitaux, des Ehpad, de l'éducation et des transports publics ».
- `source_localisation` : avant « brochure de campagne, page 12 du PDF, rubrique sur le partage du travail » ; après « brochure de campagne, rubrique Face au chômage et aux licenciements, page imprimée 10 ». Le PDF n'est pas dans le dépôt ; l'extrait place le passage entre les marqueurs de page imprimée 9 et 10, sous l'intertitre « Face au chômage et aux licenciements » ; je ne peux pas établir la page du PDF.
- Résumé : ajout de « Contre le chômage, » en tête.
- Détaillé : ajout en tête « dans une rubrique sur le chômage et les licenciements, Nathalie Arthaud demande de recenser les besoins et de répartir le travail entre tous, pour que personne ne soit condamné au chômage. Elle avance l'idée… » ; fin, avant « L'extrait ne dit pas combien d'embauches concerneraient les hôpitaux ou les Ehpad, ni comment elles seraient financées. Il ne précise pas non plus… » ; après « Les hôpitaux et les Ehpad y figurent parmi d'autres services. L'extrait ne dit pas combien d'embauches les concerneraient. Ailleurs, la brochure demande la confiscation des bénéfices de ceux qu'elle appelle les profiteurs de guerre, pour les hôpitaux et les écoles, sans lier cette demande à ces embauches. Le texte ne précise pas non plus… »
- Enfant : avant « Nathalie Arthaud parle d'une liste d'embauches. Ce serait fait par le personnel des hôpitaux et des [[Ehpad]]. Ce serait aussi fait par celui de l'éducation et des transports publics. Chacun noterait les embauches dont il a besoin. Selon le texte, cela ferait des centaines de milliers d'emplois à créer. » ; après « Nathalie Arthaud veut partager le travail entre tous, pour que personne ne soit au chômage. Elle imagine une liste des embauches à faire. Le personnel des hôpitaux et des [[Ehpad]] la ferait. Celui de l'éducation et des transports publics aussi. Chacun dirait combien de gens il lui faut. Selon le texte, cela ferait des centaines de milliers d'emplois. » (lisibilité 82,8 ; une première version à 77,9 aurait créé un avertissement).
- Aîné : début avant « Nathalie Arthaud évoque, dans sa brochure de campagne, une liste d'embauches. » ; après « Dans une rubrique de sa brochure de campagne consacrée au chômage, Nathalie Arthaud demande de recenser les besoins et de répartir le travail entre tous. Elle évoque une liste d'embauches. » ; fin avant « Le texte ne dit pas combien d'embauches concerneraient les hôpitaux, ni comment elles seraient payées. » ; après « Les hôpitaux ne sont qu'un exemple parmi d'autres services. Le texte ne dit pas combien d'embauches les concerneraient, ni ne lie ces embauches à un financement précis. »
- Source : « Alors, pour que personne ne soit condamné au chômage, il faut recenser les besoins et imposer que le travail soit réparti entre tous. » ; « Confiscation des bénéfices de ces profiteurs de guerre : les milliards pour les hôpitaux, les écoles, pas pour la guerre ! »
- Au-delà du constat : « ni comment elles seraient financées / payées » corrigé (règle 2), la brochure parlant d'argent pour les hôpitaux.

### 11. nicolas-dupont-aignan/sante-fin-passe-sanitaire

- Constat : la même page étend la mesure plus bas ; page non datée.
- Détaillé : avant « Il ne dit pas non plus par quel acte juridique cette suppression serait décidée, ni si elle concerne un dispositif en vigueur ou un dispositif futur. » ; après « Il ne dit pas non plus par quel acte juridique cette suppression serait décidée. Plus bas, la même page étend la mesure à tout passe sanitaire ou vaccinal et demande la réintégration des soignants exclus et le rétablissement de leurs trimestres de retraite perdus. »
- Source (rubrique « Nos mesures ») : « suppression définitive de tout passe sanitaire ou vaccinal, réintégration des soignants exclus et rétablissement de leurs trimestres de retraite perdus ».
- Date de la fiche source : non modifiée (hors périmètre), voir cas pour le propriétaire.

### 12. nicolas-dupont-aignan/sante-lits-etablissements

- Constat : « entre 1997 et aujourd'hui » repris sans réserve sur une page non datée.
- Détaillé : avant « Le texte indique que plus de 100 000 lits ont été supprimés entre 1997 et aujourd'hui, et que rouvrir une maternité par département ramènerait au niveau de 2008. » ; après « Le texte indique que plus de 100 000 lits ont été supprimés entre 1997 et « aujourd'hui », sans dater sa propre rédaction. Il indique aussi que rouvrir une maternité par département ramènerait au niveau de 2008. »
- Source : texte_source ; aucune date de publication visible dans l'extrait. Non repris (REGLE-04) : plus bas, la page écrit « 100 000 lits ont ainsi été supprimés à l'hôpital public entre 1997 et 2017 ».

### 13. olivier-becht/sante-prevention

- Constat : « en subir » sans antécédent dans l'enfant.
- Enfant, deuxième phrase : avant « Prévenir, c'est agir avant, au lieu d'en subir les conséquences. » ; après « Prévenir, c'est agir avant que les problèmes de santé arrivent. »
- Source : « pour agir en amont plutôt que d'en subir les conséquences ».
- Lisibilité : avertissement préexistant (79,5), désormais 78,9 ; non nouveau.

### 14. olivier-becht/sante-secretariat-etat-sante-publique

- Constat : avertissement de lisibilité enfant (74,3).
- Enfant, trois dernières phrases : avant « Il réunirait les cinq grandes agences. Elles auraient un seul contrat d'objectifs. Il veut ainsi ne plus disperser les responsabilités. » ; après « Ce service fusionnerait cinq grandes agences qui existent déjà. Elles auraient les mêmes buts. Selon lui, on saurait mieux qui est responsable de quoi. » Lisibilité 83,1, avertissement levé.
- Source : « fusionnera les cinq grandes agences existantes sous un même contrat d'objectifs, pour mettre fin à l'éparpillement des responsabilités ». Le mot interdit « enfin » de la source n'est pas repris. « Ce service » est cohérent avec la définition du glossaire (« un service du gouvernement »).
- Écart avec la proposition : « fusionnerait » (verbe de la source) au lieu de « regrouperait » ; la conséquence est attribuée (« Selon lui ») au lieu de « Ainsi ».

### 15. raphael-glucksmann/sante-projet-territorial-sante

- Constat : avertissement de lisibilité enfant (75,3), « usagers » opaque, hôpitaux omis.
- Enfant : avant « Raphaël Glucksmann et son parti veulent organiser la santé près des habitants. Chaque territoire aurait un projet de santé. Les soignants, les élus, les usagers et l'État le feraient ensemble. Il fixerait les priorités selon les besoins des habitants. Le texte ne dit pas le coût. » ; après « Son parti, Place publique, veut organiser la santé près des gens. Chaque territoire aurait son projet de santé. Les soignants, les hôpitaux, les élus, les patients et l'État l'écriraient ensemble. Ce projet dirait ce dont les gens ont le plus besoin. Le texte ne dit pas combien cela coûterait. » Lisibilité 84,1, avertissement levé.
- Source : « un Projet territorial de Santé co-construit par les professionnels, les hôpitaux, les élus, les usagers et l'État, définissant les priorités selon les besoins réels de la population ».
- Écart avec la proposition : sujet « Son parti, Place publique » (consigne 3 : document du parti, qui ne nomme Raphaël Glucksmann que comme codirecteur de la publication).

### 16. selma-labib/sante-besoins-embauches-hopitaux

- Constats : revendication générale sur l'emploi ; « ne dit pas qui paierait » à nuancer. Consigne 4 : portée rendue explicite dans tous les niveaux.
- Résumé : avant « Le NPA-Révolutionnaires, parti de Selma Labib, veut que les travailleurs recensent eux-mêmes les besoins en embauches, notamment dans les hôpitaux. » ; après « Contre le chômage, le NPA-Révolutionnaires, parti de Selma Labib, veut que les travailleurs recensent eux-mêmes les besoins en embauches, des ateliers aux hôpitaux. »
- Détaillé : ajout en tête « demande l'interdiction des licenciements et la baisse du temps de travail sans perte de salaire, jusqu'à l'extinction du chômage. Il indique que… » ; fin avant « Il ne précise pas le nombre d'embauches pour les hôpitaux, ni qui les financerait, ni comment ces besoins seraient recensés. » ; après « Les hôpitaux y sont un lieu parmi d'autres. Le texte ne précise pas le nombre d'embauches pour les hôpitaux, ni comment ces besoins seraient recensés. Le document écrit qu'imposer ces mesures suppose de s'en prendre aux profits des multinationales, sans détailler le financement des postes hospitaliers. »
- Enfant : avant « Selma Labib et son parti veulent que les travailleurs comptent eux-mêmes les embauches nécessaires. Cela vaut pour les services, les écoles et les hôpitaux. […] Il ne dit pas qui paierait ces embauches. » ; après « Selma Labib et son parti veulent mettre fin au chômage. Ils veulent que les travailleurs comptent eux-mêmes les embauches nécessaires. Cela vaut pour les ateliers, les services, les écoles et les hôpitaux. […] Le texte ne donne pas le nombre d'embauches. »
- Aîné : ajout en tête « demande l'interdiction des licenciements pour mettre fin au chômage. Il écrit que… » ; fin avant « Le document ne donne aucun nombre d'embauches pour les hôpitaux et ne dit pas comment elles seraient financées. » ; après « Les hôpitaux n'y sont qu'un lieu parmi d'autres. Le document ne donne aucun nombre d'embauches pour les hôpitaux ; il écrit qu'imposer ces mesures suppose de s'en prendre aux profits des multinationales, sans détailler le financement. »
- Source : « Imposer l'interdiction des licenciements, l'arrêt de toutes les suppressions d'emplois et la baisse du temps de travail sans perte de salaire, jusqu'à l'extinction du chômage » ; « Imposer ces mesures, cela suppose de ne pas avoir peur de s'en prendre aux profits des multinationales. » Le document nomme Selma Labib comme candidate : le sujet « Selma Labib et son parti » de l'enfant est conservé.

## Constats non appliqués ou appliqués autrement, et pourquoi

1. Chiffres de la phrase voisine (Legendre 14 milliards et 2025, Mélenchon 2027 et 10 milliards, Polony dix ans, Dupont-Aignan 2017) : non écrits, à cause de REGLE-04 (voir plus haut). L'affirmation fausse est corrigée sans chiffre.
2. Legendre, « juge le système trop généreux » : non repris, la phrase de la source vise le système social en général.
3. Legendre, « dans la même partie » : remplacé par « plus haut, parmi les efforts demandés pour réduire les déficits », la structure en parties n'étant pas certaine dans l'extrait.
4. Arthaud, titre : je garde les quatre secteurs plutôt que « notamment par le personnel des hôpitaux et des Ehpad », pour ne pas réduire la portée.
5. Rien d'autre n'a été écarté : je n'ai pas trouvé de point où le relecteur se trompe sur le fond.

## Cas pour le propriétaire

1. **Classement en santé de deux mesures** : `nathalie-arthaud/sante-embauches-hopitaux` et `selma-labib/sante-besoins-embauches-hopitaux` sont des revendications générales sur l'emploi (partage du travail, interdiction des licenciements) où l'hôpital est un exemple parmi d'autres. La portée est désormais explicite dans les quatre niveaux ; leur maintien en santé (ou leur déplacement vers travail) est votre décision. Je ne les ai ni supprimées ni déplacées.
2. **Page Debout la France non datée** : la fiche `src/content/sources/nicolas-dupont-aignan-sante-projet-dlf.yaml` porte `date_publication: 2026-11`, que l'extrait n'étaye pas (aucune date visible ; chiffres les plus récents de 2017 à 2020 ; une mesure vise « dès 2025 »). Non modifié : à corriger dans la fiche source selon la règle du projet.
3. **Élargir des `texte_source` si vous voulez les chiffres** : Legendre arrêts maladie (phrase « Neuf millions d'arrêts en 2025… »), Polony (phrase « Dans dix ans… »), éventuellement Mélenchon (phrase sur 2027). Sinon les rédactions restent sans ces chiffres.
4. **Arthaud, page du PDF** : la localisation donne désormais l'intertitre et la page imprimée 10 ; si vous voulez la page du PDF, il faut l'ouvrir (le PDF n'est pas dans le dépôt public).
5. **Points vus hors constats, non modifiés** (consigne : une correction par constat) :
   - `jean-francois-legendre/sante-analyser-arrets-maladie`, détaillé : « Il ne dit pas non plus quelles décisions pourraient en découler. » Le manifeste ajoute ensuite que « Le Peuple souverain décidera par voie de référendums de ce qu'il conviendra de faire » sur ces sujets. La phrase reste exacte sur la lettre, mais incomplète.
   - `nicolas-dupont-aignan/*` : le résumé, l'enfant et l'aîné ont le candidat pour sujet (« Nicolas Dupont-Aignan veut ») sur une page du parti qui ne le nomme pas (seul « NDA » apparaît dans le menu). Le relecteur l'a jugé acceptable ; la consigne 3 demanderait « Son parti, Debout la France, propose ».
   - `natacha-polony/sante-medicaments-essentiels-production`, enfant : « Il ne dit pas comment. » reste exact pour les médicaments, mais le paragraphe suivant parle de moyens généraux (État stratège, investissements).
   - `nicolas-dupont-aignan/sante-lits-etablissements` : « ni le calendrier » et « Il ne dit pas quand » alors que la mesure dit « immédiatement » pour l'arrêt des fermetures (le calendrier manque pour les réouvertures).
6. **Lisibilité enfant préexistante** sur des mesures touchées : `gabriel-attal/sante-droit-climatisation` (66,9), `olivier-becht/sante-prevention` (78,9), `jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad` (79,2, enfant non touché), `francois-ruffin/sante-pole-public-medicament` (77,6, enfant non touché), `marine-tondelier/sante-prevention-priorites` (68,4, enfant non touché). Avertissements antérieurs, non nouveaux.

## Résultat du validateur

- `node scripts/validate.ts --mode preview` (Node 24) : 0 erreur, 24 avertissements (25 au départ).
- `--mode production` : 0 erreur, 24 avertissements.
- Sur mes 14 candidats : aucun avertissement nouveau ; les deux avertissements `LISIBILITE_ENFANT_FAIBLE` de `olivier-becht/sante-secretariat-etat-sante-publique` et `raphael-glucksmann/sante-projet-territorial-sante` ont disparu. Comparaison faite ligne à ligne avec la sortie de départ.

## Fichiers modifiés (16, aucun autre fichier de mon lot)

- src/content/mesures/francis-lalanne/sante-fin-pass-obligations-medicales.yaml
- src/content/mesures/francois-ruffin/sante-pole-public-medicament.yaml
- src/content/mesures/gabriel-attal/sante-droit-climatisation.yaml
- src/content/mesures/jean-francois-legendre/sante-analyser-arrets-maladie.yaml
- src/content/mesures/jean-francois-legendre/sante-preserver-prise-en-charge.yaml
- src/content/mesures/jean-luc-melenchon/sante-budget-hopitaux-postes-soignants.yaml
- src/content/mesures/jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad.yaml
- src/content/mesures/marine-tondelier/sante-prevention-priorites.yaml
- src/content/mesures/natacha-polony/sante-medicaments-essentiels-production.yaml
- src/content/mesures/nathalie-arthaud/sante-embauches-hopitaux.yaml
- src/content/mesures/nicolas-dupont-aignan/sante-fin-passe-sanitaire.yaml
- src/content/mesures/nicolas-dupont-aignan/sante-lits-etablissements.yaml
- src/content/mesures/olivier-becht/sante-prevention.yaml
- src/content/mesures/olivier-becht/sante-secretariat-etat-sante-publique.yaml
- src/content/mesures/raphael-glucksmann/sante-projet-territorial-sante.yaml
- src/content/mesures/selma-labib/sante-besoins-embauches-hopitaux.yaml

Glossaire non modifié. Les autres fichiers modifiés dans le worktree appartiennent à l'agent du lot A.
