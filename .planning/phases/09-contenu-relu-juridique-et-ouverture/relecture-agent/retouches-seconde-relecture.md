# Retouches issues de la seconde relecture (worktree reveleTonProg-relecture, branche relecture/sante)

Date : 2026-11-17. Aucun commit, aucun push. Seuls les niveaux nommés par les deux rapports de seconde relecture ont été modifiés.

## Résultat

- 11 mesures traitées, 21 remplacements appliqués (champs ou phrases), 0 non appliqué.
- Chaque remplacement a été fait par un script qui vérifie que l'ancien texte existe une seule fois dans le niveau visé, puis le remplace par le texte exact du rapport (style scalaire plié `>-` conservé, pas de tiret cadratin ni demi-cadratin).
- Validateur : `node scripts/validate.ts --mode production` et `--mode preview` : 391 fichiers, 0 erreur, 23 avertissements avant, 22 après, dans les deux modes.
- `git status --porcelain` : toujours 35 fichiers modifiés, tous sous `src/content/mesures/`, rien d'autre.
- Copie du `git diff` avant retouches : `/tmp/avant-retouches.diff` ; après : `/tmp/apres-retouches.diff`. La différence entre les deux ne contient que des lignes de niveaux (résumé, détaillé, enfant, aîné) des 11 fichiers. Aucun champ protégé (`texte_source`, `source`, `id`, `candidat`, `theme`, `statut_relecture`, archives, couverture) n'a été touché.

## Diagnostics du validateur sur les 11 fichiers

Avant (identique en production et en preview) :
- delphine-batho/sante-defenseur-constitution : LISIBILITE_ENFANT_FAIBLE 70,1 (avertissement).
- gabriel-attal/sante-droit-climatisation : LISIBILITE_ENFANT_FAIBLE 66,9 (avertissement).
- aucun diagnostic sur les 9 autres.

Après (identique en production et en preview) :
- delphine-batho/sante-defenseur-constitution : LISIBILITE_ENFANT_FAIBLE 70,6 (avertissement, valeur annoncée par le rapport : 70,6).
- gabriel-attal/sante-droit-climatisation : plus aucun diagnostic (lisibilité remontée au-dessus de 80).
- aucun diagnostic sur les 9 autres.
- Le seul autre écart avec la sortie d'avant : le décompte passe de 23 à 22 avertissements.

Aucun remplacement n'a échoué à la validation, donc aucun champ n'a été laissé dans son état précédent.

## Détail champ par champ

Pour chaque ligne, « Avant » est le niveau entier avant ma retouche, « Après » le niveau entier après, « Remplacement du rapport » le texte exact donné par le relecteur (un niveau entier ou la phrase substituée). La vérification a été faite par le script : le texte du rapport est contenu dans « Après » et, pour les remplacements de niveau entier, « Après » lui est identique caractère pour caractère.

### bernard-cazeneuve/sante-grand-age-dependance : resume
- Avant : Bernard Cazeneuve veut prendre en charge le grand âge et la dépendance et soutenir les aidants familiaux, avec une soutenabilité financière garantie aux familles modestes.
- Après : Bernard Cazeneuve veut prendre en charge grand âge et dépendance, soutenir les aidants familiaux, avec une soutenabilité financière garantie aux familles les plus modestes.
- Remplacement du rapport : Bernard Cazeneuve veut prendre en charge grand âge et dépendance, soutenir les aidants familiaux, avec une soutenabilité financière garantie aux familles les plus modestes.
- Conforme caractère pour caractère : oui

### christian-collovati/sante-securite-sociale-endettement : enfant
- Avant : Christian Collovati veut freiner les dépenses sociales. Il veut aussi freiner les dettes de la [[Sécurité sociale|securite-sociale]]. Il parle aussi des dettes des [[collectivités locales|collectivite-locale]]. Le texte ne dit pas comment il ferait. Il ne dit pas non plus quelles dépenses seraient touchées.
- Après : Christian Collovati veut freiner les dépenses sociales. Il veut aussi freiner les dettes de la [[Sécurité sociale|securite-sociale]]. Il parle aussi des dettes des [[collectivités locales|collectivite-locale]]. Cette phrase ne dit pas comment il ferait. Elle ne dit pas non plus quelles dépenses seraient touchées.
- Remplacement du rapport : Cette phrase ne dit pas comment il ferait. Elle ne dit pas non plus quelles dépenses seraient touchées.
- Conforme caractère pour caractère : oui

### delphine-batho/sante-defenseur-constitution : aine
- Avant : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale. Cette personne aurait des pouvoirs d'enquête et pourrait être saisie par les citoyennes et les citoyens. Elle veut aussi inscrire la pleine santé et le principe d'habitabilité dans la Constitution, pour guider toutes les politiques publiques et empêcher l'adoption de lois toxiques. Le programme ne définit pas ces notions et ne dit pas quand la Constitution serait modifiée.
- Après : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale. Cette personne aurait des pouvoirs d'enquête et pourrait être saisie par les citoyennes et les citoyens. Delphine Batho veut aussi inscrire la pleine santé et le principe d'habitabilité dans la Constitution, pour guider toutes les politiques publiques et empêcher l'adoption de lois toxiques. Le programme ne définit pas ces notions et ne dit pas quand la Constitution serait modifiée.
- Remplacement du rapport : Delphine Batho veut aussi inscrire
- Conforme caractère pour caractère : oui

### delphine-batho/sante-defenseur-constitution : aine
- Avant : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale. Cette personne aurait des pouvoirs d'enquête et pourrait être saisie par les citoyennes et les citoyens. Delphine Batho veut aussi inscrire la pleine santé et le principe d'habitabilité dans la Constitution, pour guider toutes les politiques publiques et empêcher l'adoption de lois toxiques. Le programme ne définit pas ces notions et ne dit pas quand la Constitution serait modifiée.
- Après : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale. Cette personne aurait des pouvoirs d'enquête et pourrait être saisie par les citoyennes et les citoyens. Delphine Batho veut aussi inscrire la pleine santé et le principe d'habitabilité dans la Constitution, pour guider toutes les politiques publiques et empêcher l'adoption de lois toxiques. La proposition ne définit pas ces notions et ne dit pas quand la Constitution serait modifiée.
- Remplacement du rapport : La proposition ne définit pas ces notions
- Conforme caractère pour caractère : oui

### delphine-batho/sante-defenseur-constitution : detaille
- Avant : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale, doté de pouvoirs d'enquête, que les citoyennes et citoyens pourraient saisir. Elle prévoit aussi d'inscrire la pleine santé et le principe d'habitabilité dans la Constitution. Selon le texte, cette inscription doit guider toutes les politiques publiques, reconnaître l'interdépendance avec l'ensemble du vivant et empêcher l'adoption de lois toxiques. L'extrait ne définit ni la pleine santé ni l'habitabilité. Il ne dit pas comment le Défenseur serait désigné, ni quand la Constitution serait modifiée.
- Après : Delphine Batho annonce la création d'un Défenseur de la santé humaine et animale, doté de pouvoirs d'enquête, que les citoyennes et citoyens pourraient saisir. Elle prévoit aussi d'inscrire la pleine santé et le principe d'habitabilité dans la Constitution. Selon le texte, cette inscription doit guider toutes les politiques publiques, reconnaître l'interdépendance avec l'ensemble du vivant et empêcher l'adoption de lois toxiques. La proposition ne définit ni la pleine santé ni l'habitabilité. Elle ne dit pas comment le Défenseur serait désigné, ni quand la Constitution serait modifiée.
- Remplacement du rapport : La proposition ne définit ni la pleine santé ni l'habitabilité. Elle ne dit pas comment
- Conforme caractère pour caractère : oui

### delphine-batho/sante-defenseur-constitution : enfant
- Avant : Delphine Batho veut créer un Défenseur de la santé des humains et des animaux. Il pourrait enquêter. Les citoyens pourraient lui demander d'agir. Elle veut aussi écrire la pleine santé dans la [[Constitution]]. Cela guiderait toutes les décisions publiques.
- Après : Delphine Batho veut créer un Défenseur de la santé des humains et des animaux. Il pourrait enquêter. Les citoyens pourraient lui demander d'agir. Elle veut aussi écrire la pleine santé dans la [[Constitution]]. Selon elle, cela guiderait toutes les décisions publiques.
- Remplacement du rapport : Selon elle, cela guiderait toutes les décisions publiques.
- Conforme caractère pour caractère : oui

### delphine-batho/sante-deserts-medicaux : enfant
- Avant : Delphine Batho veut une nouvelle loi contre les [[déserts médicaux|desert-medical]]. Un texte de loi est déjà écrit. Il fixerait des règles pour l'installation des médecins. Il permettrait aussi de créer des centres de santé. Selon le texte, 86 % de la population le soutient.
- Après : Delphine Batho veut une nouvelle loi contre les [[déserts médicaux|desert-medical]]. Elle dit qu'un texte de loi est déjà prêt. Il fixerait des règles pour l'installation des médecins. Il permettrait aussi de créer des centres de santé. Selon le texte, 86 % de la population le soutient.
- Remplacement du rapport : Elle dit qu'un texte de loi est déjà prêt.
- Conforme caractère pour caractère : oui

### fabien-roussel/sante-remboursement-100-securite-sociale : detaille
- Avant : Dans le cahier Sécurité sociale du Parti communiste français, parti de Fabien Roussel, un chapitre sur l'assurance maladie juge qu'il est temps de mettre fin à la dualité du remboursement des soins. Le texte la décrit comme non solidaire, source d'inégalités sociales, de complexité et de dépenses supplémentaires. Il propose d'aller vers le remboursement à 100 % des soins prescrits par la Sécurité sociale. Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui doit être remboursé. Il ne donne ni date ni coût pour cette mesure.
- Après : Dans le cahier Sécurité sociale du Parti communiste français, parti de Fabien Roussel, un chapitre sur l'assurance maladie juge qu'il est temps de mettre fin à la dualité du remboursement des soins. Le texte la décrit comme non solidaire, source d'inégalités sociales, de complexité et de dépenses supplémentaires. Il propose d'aller vers le remboursement à 100 % des soins prescrits par la Sécurité sociale. Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles. Il ajoute que la science est l'arbitre et que, pour les zones floues encore en débat, la démocratie doit trancher ce qui doit être remboursé. Il ne donne ni date ni coût pour cette mesure.
- Remplacement du rapport : Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles. Il ajoute que la science est l'arbitre et que, pour les zones floues encore en débat, la démocratie doit trancher ce qui doit être remboursé.
- Conforme caractère pour caractère : oui

### fabien-roussel/sante-remboursement-100-securite-sociale : aine
- Avant : Dans le cahier Sécurité sociale du Parti communiste français, parti de Fabien Roussel, un chapitre consacré à l'assurance maladie propose de mettre fin à la dualité du remboursement des soins, décrite comme non solidaire, source d'inégalités sociales, de complexité et de dépenses supplémentaires, et d'aller vers un remboursement à 100 % des soins prescrits par la Sécurité sociale. Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui doit être remboursé. Il ne précise ni le calendrier ni le coût de cette réforme.
- Après : Dans le cahier Sécurité sociale du Parti communiste français, parti de Fabien Roussel, un chapitre consacré à l'assurance maladie propose de mettre fin à la dualité du remboursement des soins, décrite comme non solidaire, source d'inégalités sociales, de complexité et de dépenses supplémentaires, et d'aller vers un remboursement à 100 % des soins prescrits par la Sécurité sociale. Le cahier exclut un panier de soins limité et les médecines parallèles, et confie à la démocratie les zones floues encore en débat. Il ne précise ni le calendrier ni le coût de cette réforme.
- Remplacement du rapport : Le cahier exclut un panier de soins limité et les médecines parallèles, et confie à la démocratie les zones floues encore en débat.
- Conforme caractère pour caractère : oui

### florian-philippot/sante-soins-proximite-centres : enfant
- Avant : Son parti, Les Patriotes, veut créer des centres de santé près des habitants. Ces centres soigneraient les maladies courantes. Ils prendraient aussi les urgences qui ne menacent pas la vie. Il y aurait ainsi moins de monde à l'hôpital. Le texte ne dit pas combien de centres seraient ouverts. Il ne dit pas combien cela coûterait.
- Après : Son parti, Les Patriotes, veut créer des centres de santé près des habitants. Ces centres soigneraient les maladies courantes. Ils prendraient aussi les urgences qui ne menacent pas la vie. Selon lui, il y aurait ainsi moins de monde à l'hôpital. Le texte ne dit pas combien de centres seraient ouverts. Il ne dit pas combien cela coûterait.
- Remplacement du rapport : Selon lui, il y aurait ainsi moins de monde à l'hôpital.
- Conforme caractère pour caractère : oui

### gabriel-attal/sante-droit-climatisation : enfant
- Avant : Gabriel Attal propose un droit à la climatisation des logements. Parfois, la [[copropriété|copropriete]] refuse les installations individuelles. Il veut mettre fin à ces blocages. Il veut aussi simplifier des règles qui protègent les bâtiments anciens. Selon lui, elles empêchent trop souvent de poser des volets ou d'isoler.
- Après : Gabriel Attal veut un droit à la climatisation chez soi. Selon lui, des [[copropriétés|copropriete]] bloquent sans raison ce que les habitants veulent installer. Il veut mettre fin à ces blocages. Il veut aussi simplifier des règles qui protègent les vieux bâtiments. Selon lui, elles empêchent trop souvent de poser des volets ou d'isoler.
- Remplacement du rapport : Gabriel Attal veut un droit à la climatisation chez soi. Selon lui, des [[copropriétés|copropriete]] bloquent sans raison ce que les habitants veulent installer. Il veut mettre fin à ces blocages. Il veut aussi simplifier des règles qui protègent les vieux bâtiments. Selon lui, elles empêchent trop souvent de poser des volets ou d'isoler.
- Conforme caractère pour caractère : oui

### jean-francois-legendre/sante-analyser-arrets-maladie : detaille
- Avant : Dans son manifeste, Jean-François Legendre écrit que la solidarité continuera à ne laisser personne au bord de la route, mais que les tricheurs et les abus seront sanctionnés. Il donne un exemple : l'augmentation de 30% des arrêts maladie sur les dix dernières années doit être rigoureusement analysée. Le texte ne précise pas qui mènerait cette analyse, selon quelle méthode, ni quelles sanctions s'appliqueraient aux abus. Il ne dit pas non plus quelles décisions pourraient en découler. La phrase suivante du manifeste donne le nombre de ces arrêts sur une année et leur charge pour l'assurance maladie.
- Après : Dans son manifeste, Jean-François Legendre écrit que la solidarité continuera à ne laisser personne au bord de la route, mais que les tricheurs et les abus seront sanctionnés. Il donne un exemple : l'augmentation de 30% des arrêts maladie sur les dix dernières années doit être rigoureusement analysée. Le texte ne précise pas qui mènerait cette analyse, selon quelle méthode, ni quelles sanctions s'appliqueraient aux abus. Il ajoute que le peuple décidera par référendum de ce qu'il conviendra de faire sur ces sujets. La phrase suivante du manifeste donne le nombre de ces arrêts sur une année et leur charge pour l'assurance maladie.
- Remplacement du rapport : Il ajoute que le peuple décidera par référendum de ce qu'il conviendra de faire sur ces sujets.
- Conforme caractère pour caractère : oui

### natacha-polony/sante-medicaments-essentiels-production : enfant
- Avant : Natacha Polony veut que la France fabrique ses médicaments essentiels. Elle veut aussi que la France produise son énergie et sa nourriture. Elle cite aussi des machines. Le texte ne dit pas quels médicaments seraient fabriqués. Il ne dit pas comment.
- Après : Natacha Polony veut que la France fabrique ses médicaments essentiels. Elle veut aussi que la France produise son énergie et sa nourriture. Elle cite aussi des machines. Le texte ne dit pas quels médicaments seraient fabriqués. Selon elle, l'État doit faire des plans.
- Remplacement du rapport : Selon elle, l'État doit faire des plans.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-fin-passe-sanitaire : resume
- Avant : Nicolas Dupont-Aignan veut la suppression immédiate, intégrale et irréversible du passe sanitaire, selon le projet de Debout la France.
- Après : Son parti, Debout la France, veut la suppression immédiate, intégrale et irréversible du passe sanitaire.
- Remplacement du rapport : Son parti, Debout la France, veut la suppression immédiate, intégrale et irréversible du passe sanitaire.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-fin-passe-sanitaire : detaille
- Avant : Dans la page Santé du projet de Debout la France, parti de Nicolas Dupont-Aignan, la mesure qui ouvre la liste des mesures fortes consiste à prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Le texte ne définit pas ce qu'il désigne par passe sanitaire. Il ne dit pas non plus par quel acte juridique cette suppression serait décidée. Plus bas, la même page étend la mesure à tout passe sanitaire ou vaccinal et demande la réintégration des soignants exclus et le rétablissement de leurs trimestres de retraite perdus. La page ne porte pas de date de publication visible : elle est consultable sur le site du parti à la date de capture, sans autre indication de mise à jour.
- Après : Dans la page Santé du projet de Debout la France, parti de Nicolas Dupont-Aignan, la mesure qui ouvre la liste des mesures fortes consiste à prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Le texte ne dit pas par quel acte juridique cette suppression serait décidée. Plus bas, la même page étend la mesure à tout passe sanitaire ou vaccinal et demande la réintégration des soignants exclus et le rétablissement de leurs trimestres de retraite perdus. La page ne porte pas de date de publication visible : elle est consultable sur le site du parti à la date de capture, sans autre indication de mise à jour.
- Remplacement du rapport : Le texte ne dit pas par quel acte juridique cette suppression serait décidée.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-fin-passe-sanitaire : enfant
- Avant : Nicolas Dupont-Aignan veut supprimer le [[passe sanitaire]]. Il l'écrit dans le projet de son parti. Cette suppression serait immédiate, totale et sans retour possible. Le texte ne dit pas comment elle serait décidée. Il ne donne pas de date.
- Après : Son parti, Debout la France, veut supprimer le [[passe sanitaire]]. Il l'écrit dans la page Santé de son projet. Cette suppression serait immédiate, totale et sans retour possible. Le texte ne dit pas comment elle serait décidée. Il ne donne pas de date.
- Remplacement du rapport : Son parti, Debout la France, veut supprimer le [[passe sanitaire]]. Il l'écrit dans la page Santé de son projet. Cette suppression serait immédiate, totale et sans retour possible. Le texte ne dit pas comment elle serait décidée. Il ne donne pas de date.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-fin-passe-sanitaire : aine
- Avant : Dans le projet de Debout la France, Nicolas Dupont-Aignan veut prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Cette mesure ouvre la liste des mesures fortes de la page Santé du parti. Le texte ne précise pas quel dispositif exact il vise, ni par quel texte juridique la suppression serait décidée. La page ne porte pas de date de publication visible, ce qui empêche de savoir si ce passage date de la campagne actuelle.
- Après : Dans la page Santé de son projet, Debout la France, parti de Nicolas Dupont-Aignan, veut prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Cette mesure ouvre la liste des mesures fortes de la page. Plus bas, la même page l'étend à tout passe sanitaire ou vaccinal. Le texte ne précise pas par quel texte juridique la suppression serait décidée. La page ne porte pas de date de publication visible, ce qui empêche de savoir si ce passage date de la campagne actuelle.
- Remplacement du rapport : Dans la page Santé de son projet, Debout la France, parti de Nicolas Dupont-Aignan, veut prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Cette mesure ouvre la liste des mesures fortes de la page. Plus bas, la même page l'étend à tout passe sanitaire ou vaccinal. Le texte ne précise pas par quel texte juridique la suppression serait décidée. La page ne porte pas de date de publication visible, ce qui empêche de savoir si ce passage date de la campagne actuelle.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-lits-etablissements : resume
- Avant : Nicolas Dupont-Aignan veut arrêter les fermetures de lits, rouvrir un établissement de santé par département et cesser les concentrations d'établissements.
- Après : Son parti, Debout la France, veut arrêter les fermetures de lits, rouvrir un établissement de santé par département et cesser les concentrations d'établissements.
- Remplacement du rapport : Son parti, Debout la France, veut arrêter les fermetures de lits, rouvrir un établissement de santé par département et cesser les concentrations d'établissements.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-lits-etablissements : detaille
- Avant : Dans la page Santé du projet de Debout la France, parti de Nicolas Dupont-Aignan, une même mesure rassemble plusieurs actions : arrêter immédiatement les fermetures de lits, rouvrir un établissement de santé (hôpital, maternité…) par département, à l'image du Val-de-Grâce en Ile-de-France, et cesser les concentrations d'établissements de santé. Le texte indique que plus de 100 000 lits ont été supprimés entre 1997 et « aujourd'hui », sans dater sa propre rédaction. Il indique aussi que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise ni le coût, ni le financement, ni les établissements concernés, ni le calendrier.
- Après : Dans la page Santé du projet de Debout la France, parti de Nicolas Dupont-Aignan, une même mesure rassemble plusieurs actions : arrêter immédiatement les fermetures de lits, rouvrir un établissement de santé (hôpital, maternité…) par département, à l'image du Val-de-Grâce en Ile-de-France, et cesser les concentrations d'établissements de santé. Le texte indique que plus de 100 000 lits ont été supprimés entre 1997 et « aujourd'hui », sans dater sa propre rédaction. Il indique aussi que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise ni le coût, ni le financement, ni les établissements concernés, ni le délai des réouvertures.
- Remplacement du rapport : ni les établissements concernés, ni le délai des réouvertures.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-lits-etablissements : enfant
- Avant : Nicolas Dupont-Aignan veut garder les lits d'hôpital. Il veut arrêter d'en fermer. Il veut aussi rouvrir un hôpital ou une maternité dans chaque département. On ne regrouperait plus les établissements de santé. Le texte ne dit pas le coût. Il ne dit pas quand.
- Après : Son parti, Debout la France, veut garder les lits d'hôpital. Il veut arrêter tout de suite d'en fermer. Il veut aussi rouvrir un hôpital ou une maternité dans chaque département. On ne regrouperait plus les établissements de santé. Le texte ne dit pas le coût. Il ne dit pas quand les réouvertures auraient lieu.
- Remplacement du rapport : Son parti, Debout la France, veut garder les lits d'hôpital. Il veut arrêter tout de suite d'en fermer. Il veut aussi rouvrir un hôpital ou une maternité dans chaque département. On ne regrouperait plus les établissements de santé. Le texte ne dit pas le coût. Il ne dit pas quand les réouvertures auraient lieu.
- Conforme caractère pour caractère : oui

### nicolas-dupont-aignan/sante-lits-etablissements : aine
- Avant : Dans le projet de Debout la France, Nicolas Dupont-Aignan veut arrêter immédiatement les fermetures de lits et rouvrir un établissement de santé, hôpital ou maternité, dans chaque département, à l'image du Val-de-Grâce en Ile-de-France. Il veut aussi cesser les concentrations d'établissements de santé. Le texte indique que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise pas le financement ni le calendrier.
- Après : Dans le projet de Debout la France, parti de Nicolas Dupont-Aignan, la page Santé propose d'arrêter immédiatement les fermetures de lits et de rouvrir un établissement de santé, hôpital ou maternité, dans chaque département, à l'image du Val-de-Grâce en Ile-de-France. Elle propose aussi de cesser les concentrations d'établissements de santé. Le texte indique que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise ni le financement, ni le délai des réouvertures.
- Remplacement du rapport : Dans le projet de Debout la France, parti de Nicolas Dupont-Aignan, la page Santé propose d'arrêter immédiatement les fermetures de lits et de rouvrir un établissement de santé, hôpital ou maternité, dans chaque département, à l'image du Val-de-Grâce en Ile-de-France. Elle propose aussi de cesser les concentrations d'établissements de santé. Le texte indique que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise ni le financement, ni le délai des réouvertures.
- Conforme caractère pour caractère : oui
