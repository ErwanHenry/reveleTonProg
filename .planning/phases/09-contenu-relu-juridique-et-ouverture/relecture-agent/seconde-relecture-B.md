# Seconde relecture par agent, lot B : 16 mesures santé corrigées

- Date : 2026-11-17
- Relecteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5), second relecteur indépendant (décision du propriétaire « Agent corrige, autre agent revérifie »).
- Périmètre : les 16 fichiers modifiés et non commités du worktree `/Users/erwanhenry/claude-projects/reveleTonProg-relecture` (branche `relecture/sante`) pour francis-lalanne, francois-ruffin, gabriel-attal, jean-francois-legendre (2), jean-luc-melenchon (2), marine-tondelier, natacha-polony, nathalie-arthaud, nicolas-dupont-aignan (2), olivier-becht (2), raphael-glucksmann, selma-labib. Compte vérifié par `git status --porcelain`.
- Méthode :
  1. Relecture à l'aveugle de chaque mesure dans son état actuel, contre l'extrait archivé (`archive.extrait` de la fiche source), en lisant le passage cité, son contexte et le reste de l'extrait chaque fois qu'une rédaction affirme ce que le document dit ou ne dit pas.
  2. Contrôle des règles : `CLAUDE.md` (neutralité, mots interdits, chiffrage du candidat, source primaire), `docs/COUVERTURE-THEMES.md` et la règle « parti ou candidat » de `09-CONTEXT.md` (sujet = le parti quand le document est celui du parti et ne nomme pas le candidat), longueurs, glossaire, sous-thèmes de `src/content/themes/sante.yaml`.
  3. Validateur : `fnm exec --using=24 node scripts/validate.ts --mode production` puis `--mode preview`, depuis le worktree.
  4. Ensuite seulement : lecture de `mesures-B.md` (premier relecteur), de `corrections-B.md` (correcteur) et `git diff` de chaque fichier.
  5. Les réécritures que je propose ont été testées sur une copie du worktree (`/tmp/rtpB`, hors dépôt) avec `--root` : 0 erreur, aucun avertissement sur les fichiers concernés, en production et en preview.
- Limites :
  - Je suis un modèle qui relit un texte écrit puis corrigé par des modèles : des erreurs de même nature peuvent m'échapper.
  - Je n'ai lu que les extraits texte archivés, pas les PDF ni les sites en ligne. Les numéros de page « du PDF » ne sont vérifiables que par les numéros de page imprimés présents dans l'extrait.
  - Je n'ai rien modifié dans le worktree ni dans le dépôt, à part ce fichier.

## Tableau récapitulatif

Bilan : 7 conformes, 5 à corriger, 4 décisions de l'éditeur.

| Mesure | Verdict | Raison |
|---|---|---|
| francis-lalanne/sante-fin-pass-obligations-medicales | conforme | Fidèle aux quatre niveaux ; localisation corrigée et juste |
| francois-ruffin/sante-pole-public-medicament | conforme | Fidèle ; phrases « ne donne ni » exactes pour tout le livret ; sous-thème corrigé pertinent |
| gabriel-attal/sante-droit-climatisation | a_corriger | Enfant : une phrase dit au nom du site ce que la page affirme (« Parfois, la copropriété refuse… ») |
| jean-francois-legendre/sante-analyser-arrets-maladie | a_corriger | Détaillé : « ne dit pas quelles décisions pourraient en découler » tait que le manifeste renvoie ces décisions au référendum |
| jean-francois-legendre/sante-preserver-prise-en-charge | conforme | Contexte (baisse des remboursements) désormais rendu ; enfant attribué |
| jean-luc-melenchon/sante-budget-hopitaux-postes-soignants | decision_editeur | Fidèle ; mais le document se présente comme les orientations « que la France insoumise propose » et ne nomme pas le candidat |
| jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad | decision_editeur | Même question d'attribution ; texte fidèle |
| marine-tondelier/sante-prevention-priorites | conforme | Fidèle ; exemples rendus ; Marine Tondelier signe la préface du programme |
| natacha-polony/sante-medicaments-essentiels-production | a_corriger | Enfant : « Il ne dit pas comment. » alors que le paragraphe suivant parle de l'État stratège et des investissements |
| nathalie-arthaud/sante-embauches-hopitaux | decision_editeur | Fidèle, portée claire ; maintien en santé d'une revendication générale sur l'emploi à décider |
| nicolas-dupont-aignan/sante-fin-passe-sanitaire | a_corriger | Résumé, enfant, aîné : le candidat est sujet sur une page du parti ; aîné : « ne précise pas quel dispositif » démenti plus bas ; page non datée |
| nicolas-dupont-aignan/sante-lits-etablissements | a_corriger | Même défaut de sujet ; « ni le calendrier » et « Il ne dit pas quand » alors que la mesure dit « immédiatement » |
| olivier-becht/sante-prevention | conforme | Fidèle ; phrase enfant clarifiée |
| olivier-becht/sante-secretariat-etat-sante-publique | conforme | Enfant réécrit fidèle ; « enfin » absent |
| raphael-glucksmann/sante-projet-territorial-sante | conforme | Enfant réécrit fidèle, sujet « Son parti, Place publique » |
| selma-labib/sante-besoins-embauches-hopitaux | decision_editeur | Fidèle, portée claire ; maintien en santé à décider |

## Résultat du validateur (worktree, Node 24)

- `--mode production` : 391 fichiers, 0 erreur, 23 avertissements, code de sortie 0.
- `--mode preview` : 391 fichiers, 0 erreur, 23 avertissements, code de sortie 0.
- Diagnostics sur mes 16 fichiers : uniquement `LISIBILITE_ENFANT_FAIBLE` (avertissement, jamais bloquant selon le catalogue des règles) sur :
  - `francois-ruffin/sante-pole-public-medicament` : 77,6 ;
  - `gabriel-attal/sante-droit-climatisation` : 66,9 ;
  - `jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad` : 79,2 ;
  - `marine-tondelier/sante-prevention-priorites` : 68,4 ;
  - `olivier-becht/sante-prevention` : 78,9.
- Aucune erreur de longueur, de mot interdit, de chiffre hors source ou de phrase enfant longue sur ces fichiers. Le correcteur annonçait 24 avertissements ; j'en compte 23 (écart probablement dû aux fichiers du lot A, sans effet sur mon lot).
- Avec mes réécritures appliquées à la copie `/tmp/rtpB` : 0 erreur, 22 avertissements dans les deux modes ; l'avertissement Attal disparaît (80,2) et aucun n'apparaît sur Polony (81,0) ni sur Dupont-Aignan ou Legendre.

## Champs protégés

`git diff` des 16 fichiers : `texte_source`, `source`, `id`, `candidat`, `theme` et `statut_relecture` (toujours `brouillon`) sont inchangés. Seuls changent, hors rédactions : `source_localisation` (Lalanne, Legendre arrêts maladie, Arthaud), `sous_theme` (Ruffin) et `titre` (Arthaud). Ces trois changements sont exacts (voir chaque mesure).

## Détail par mesure

### 1. francis-lalanne/sante-fin-pass-obligations-medicales : conforme

À l'aveugle :
- Citation verbatim dans `archives/francis-lalanne/5369dfe9ad56.txt`, sous « 3. Liberté ! », quatrième puce après « Liberté d'expression totale », « Refus du contrôle social », « Stop à l'intrusion de l'État ». Localisation juste.
- Source primaire : le pied de page dit « Site officiel de la campagne présidentielle de Francis Lalanne ».
- Les quatre niveaux reprennent les deux éléments sans ajout. Les phrases « ne précise pas » (quel pass, quelles obligations, sens de « statut médical », procédure, calendrier) sont vraies pour toute la page : la puce « Refus du contrôle social » cite les « obligations médicales » sans les définir, et le RIC de l'axe 4 n'est pas lié à cette interdiction.
- Remarque non bloquante : dans la source, la partie après les deux-points précise la puce (même structure que « Frexit organisé : Sortie de l'Union Européenne… ») ; « Il y ajoute » la présente comme un ajout. Le sens politique (il veut les deux) n'est pas déformé.
- Glossaire Constitution et discrimination : neutres et cohérents. Sous-thème `gouvernance-sante` : acceptable.

Constats du premier relecteur : localisation (cinquième point) : résolu.

Verdict : conforme.

### 2. francois-ruffin/sante-pole-public-medicament : conforme

À l'aveugle :
- Citation verbatim, Proposition 2 « Une production publique pour les secteurs où il faut reprendre le contrôle », passage suivi du marqueur de page imprimée 48 ; la couverture porte le numéro 1, donc page imprimée et page du PDF coïncident. Localisation juste.
- Détaillé : « La suite du texte précise que ce pôle aurait une gouvernance mixte (État, collectivités, représentants des soignants et des patients) et produirait d'abord des médicaments essentiels à brevet public » : exact (« Mission n°1 : Une capacité de production nationale pour des médicaments essentiels à brevet public dans un premier temps »). « Elle ne donne ni le coût, ni le nom des entreprises visées, ni la date » : vrai pour toutes les mentions du pôle dans le livret (lignes « ex. pôle public du médicament », Proposition 2, mot de la fin). Sanofi est nommé ailleurs comme exemple de désengagement, jamais comme cible du pôle.
- Enfant : « les produits de base très importants » rend « critiques » ; « Ces groupes créeraient des médicaments nouveaux » rend « dédiés aux médicaments innovants ». Phrases au conditionnel, attribuées.
- Résumé : omet « critiques » et « innovants » (limite de 25 mots atteinte) sans déformer.
- Sous-thème `gouvernance-sante` (« Organisation et pilotage du système de santé ») : plus juste que `hopital-et-soignants`.

Constats du premier relecteur : sous-thème : résolu ; « ne précise pas les médicaments » : résolu (le correcteur a écrit « le nom des entreprises », plus exact que « les entreprises », la mission n°2 citant une catégorie d'entreprises).

Verdict : conforme. Lisibilité enfant 77,6 : avertissement préexistant, non bloquant.

### 3. gabriel-attal/sante-droit-climatisation : a_corriger

À l'aveugle :
- Citation verbatim, section « Lever les blocages des copropriétés et des contraintes patrimoniales », page datée « 25 juin 2026 », étiquetée « Santé » et « Écologie ».
- Détaillé et aîné : exacts. « La page indique que ce droit doit protéger les Français dès l'été prochain, sans date plus précise » est vrai (« dès l'été prochain, pendant que se construit la filière de la géoénergie »). « sans raison » n'est pas repris, ce qui retire un jugement du candidat sans le déformer.
- Enfant : défaut. « Parfois, la [[copropriété|copropriete]] refuse les installations individuelles. » est écrit avec la voix du site. La source le présente comme un constat du candidat (« Certaines copropriétés s'opposent sans raison aux installations individuelles »). La règle du niveau enfant demande que chaque phrase soit attribuée.
- Remarque (fiche source, hors de ce fichier) : `date_publication: 2026-11` alors que la page affiche « 25 juin 2026 ».

Constats du premier relecteur : « pas de date » au détaillé et à l'aîné : résolu ; enfant « règles sur les logements anciens » : résolu (« règles qui protègent les bâtiments anciens »).

Correction demandée (enfant, texte entier) :
- Actuel : « Gabriel Attal propose un droit à la climatisation des logements. Parfois, la [[copropriété|copropriete]] refuse les installations individuelles. Il veut mettre fin à ces blocages. Il veut aussi simplifier des règles qui protègent les bâtiments anciens. Selon lui, elles empêchent trop souvent de poser des volets ou d'isoler. »
- Source : « Certaines copropriétés s'opposent sans raison aux installations individuelles ».
- Remplacement (53 mots, phrases de 13 mots au plus, Kandel-Moles 80,2, validé) : « Gabriel Attal veut un droit à la climatisation chez soi. Selon lui, des [[copropriétés|copropriete]] bloquent sans raison ce que les habitants veulent installer. Il veut mettre fin à ces blocages. Il veut aussi simplifier des règles qui protègent les vieux bâtiments. Selon lui, elles empêchent trop souvent de poser des volets ou d'isoler. »

Verdict : a_corriger (enfant).

### 4. jean-francois-legendre/sante-analyser-arrets-maladie : a_corriger

À l'aveugle :
- Citation verbatim ; elle suit l'intertitre « La fiscalité » à l'intérieur du manifeste. Localisation corrigée juste.
- « La phrase suivante du manifeste donne le nombre de ces arrêts sur une année et leur charge pour l'assurance maladie » : exact (« Neuf millions d'arrêts en 2025 qui représentent une charge de 14 milliards pour l'assurance maladie »). Formulation sans chiffre imposée par la règle REGLE-04 ; elle n'induit pas en erreur.
- « Le texte ne précise pas qui mènerait cette analyse, selon quelle méthode, ni quelles sanctions s'appliqueraient aux abus » : vrai pour tout le manifeste.
- Défaut : « Il ne dit pas non plus quelles décisions pourraient en découler. » Juste après, le manifeste écrit : « Le Peuple souverain décidera par voie de référendums de ce qu'il conviendra de faire pour les nombreux sujets tels que ceux évoqués ci-dessus. » Vraie à la lettre, la phrase tait le seul élément que le texte donne sur la suite, et fait croire qu'il est muet.
- Enfant et aîné : exacts (ils ne parlent que de la méthode et des sanctions).

Constats du premier relecteur : « ne chiffre pas le coût » : résolu ; localisation : résolu.

Correction demandée (détaillé) :
- Actuel : « Il ne dit pas non plus quelles décisions pourraient en découler. »
- Source : « Le Peuple souverain décidera par voie de référendums de ce qu'il conviendra de faire ».
- Remplacement (validé) : « Il ajoute que le peuple décidera par référendum de ce qu'il conviendra de faire sur ces sujets. »

Verdict : a_corriger (détaillé).

### 5. jean-francois-legendre/sante-preserver-prise-en-charge : conforme

À l'aveugle :
- Citation verbatim, paragraphe « La santé » introduit par « En France, l'assistanat est partout. », dans le passage « Construire solide en brisant la dette ».
- Détaillé : « Le passage figure dans une partie consacrée à l'assistanat » : exact au sens du passage (introduit par l'assistanat, conclu par « étudier la pertinence de l'ensemble des mesures d'assistanat »). « pour que tout cela continue, il faudra faire des choix, tous ensemble » : exact. « Plus haut, parmi les efforts demandés pour réduire les déficits, il prévoit moins de remboursements pour les actes médicaux et les médicaments » : exact (« Donc moins de remboursements pour les actes médicaux et les médicaments »), et bien placé avant le paragraphe.
- Enfant : chaque phrase est attribuée (« Selon lui », « D'après lui », « Il écrit », « Il note », « Le même texte prévoit »). Phrases courtes.
- Aîné : « Le texte ne précise pas les moyens de cette préservation » : vrai (le manifeste renvoie à des choix collectifs, sans moyen concret) ; la baisse des remboursements est rendue.
- Neutralité : « merveilleux » est attribué (« Il écrit que ce système est merveilleux »).

Constats du premier relecteur : « ni s'il serait modifié » : résolu ; enfant non attribué : résolu ; aîné incomplet : résolu.

Verdict : conforme.

### 6. jean-luc-melenchon/sante-budget-hopitaux-postes-soignants : decision_editeur

À l'aveugle :
- Citation verbatim, section « Répondre aux urgences en renforçant les services publics », passage entre les marqueurs de page imprimée 9 et 10, donc page 10. Localisation juste.
- « Le document range cette hausse dans ses orientations budgétaires pour l'année de l'élection présidentielle, financées selon lui en faisant contribuer les plus riches » : exact (« les grandes orientations budgétaires que la France insoumise propose pour l'année 2027 » ; recettes « uniquement en faisant contribuer les plus riches » ; l'élection est en 2027 selon l'en-tête du document).
- « ne précise pas dans quels hôpitaux… ni comment les professionnels seraient recrutés… ni quelles catégories » : vrai pour le document (la hausse du point d'indice vise l'attractivité de la fonction publique en général, pas un mode de recrutement hospitalier).
- Enfant et aîné : fidèles.
- Point d'attribution : le document ne nomme jamais Jean-Luc Mélenchon ; il dit « nous » et « la France insoumise propose ». Il est publié sur melenchon2027.fr et la fiche source le classe `auteur: candidat`. Toutes les rédactions disent « Jean-Luc Mélenchon propose » et « selon lui ».

Constats du premier relecteur : « pas de calendrier » et « pas de financement » : résolus, sans chiffre (« l'année de l'élection présidentielle » pour 2027, exact). Le premier relecteur jugeait l'attribution acceptable ; je la soumets au propriétaire.

Décision à prendre : le document de campagne qui dit parler pour « la France insoumise » vaut-il parole du candidat ? Options : garder `auteur: candidat` et les rédactions actuelles (publication sur son site de campagne) ; ou classer la fiche `parti_du_candidat` et écrire « Son parti, La France insoumise, propose… » dans les quatre niveaux des deux mesures.

### 7. jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad : decision_editeur

À l'aveugle :
- Citation verbatim, section « Enclencher la planification écologique », page imprimée 11. Localisation juste.
- Résumé : « contre les incendies » désormais présent, comme dans la source (qui parle bien d'équiper « contre les incendies » dans un plan contre les canicules).
- « Le texte ne précise pas quel matériel serait installé, ni le coût propre à ce plan » : exact ; le document donne 10 milliards pour toute la planification écologique (« 10 milliards devront être investis dès 2026 »), sans isoler ce plan. L'aîné dit « ni le coût de ce plan » : exact aussi, le plan n'étant pas chiffré à part.
- « sans calendrier propre à ce plan » : exact.
- Enfant : fidèle ; glossaire Ehpad exact.
- Même point d'attribution que la mesure 6.

Constats du premier relecteur : résumé : résolu ; « ni le calendrier » : résolu.

Décision à prendre : la même que pour la mesure 6 (attribution à Jean-Luc Mélenchon ou à La France insoumise). Lisibilité enfant 79,2 : avertissement préexistant.

### 8. marine-tondelier/sante-prevention-priorites : conforme

À l'aveugle :
- Citation verbatim, chapitre 29, proposition 1 ; les propositions suivent le marqueur de page 110, donc page 111. Localisation juste.
- « La suite de la proposition donne des exemples : programmes d'éducation à la santé pour les enfants, remboursement de séances de diététique, soutien aux associations et interdiction de produits nocifs pour lutter contre l'obésité » : exact. « Le texte ne dit pas quel budget y serait consacré » : vrai pour le programme (seul montant proche, 7 milliards, vise le plan d'adaptation au changement climatique).
- Attribution : document du parti (`parti_du_candidat`) dont la préface est signée « Marine Tondelier, Secrétaire nationale des Écologistes ». Le document nomme donc la candidate ; « Marine Tondelier et son parti » (enfant) et « Marine Tondelier propose » dans « le programme des Écologistes » (résumé) restent dans la règle. « soutenu par Marine Tondelier » (détaillé, aîné) est étayé par cette signature.
- Neutralité : « encouragements » n'appartient pas à la famille interdite « courage* ».

Constats du premier relecteur : exemples tus : résolu.

Verdict : conforme. Lisibilité enfant 68,4 : avertissement préexistant, que le propriétaire peut vouloir réduire plus tard.

### 9. natacha-polony/sante-medicaments-essentiels-production : a_corriger

À l'aveugle :
- Citation verbatim dans la lettre « Ma vision pour la France » (« Mes chers compatriotes »), juste après « Dans dix ans, la France doit avoir retrouvé sa puissance industrielle. » Localisation juste.
- Détaillé et aîné : exacts. « une échéance » rend « Dans dix ans » sans le nombre ; c'est moins informatif mais pas trompeur. Le paragraphe suivant (« L'État doit redevenir stratège. Planifier les investissements essentiels. ») est rendu avec la réserve « sans détail propre aux médicaments ».
- Résumé : « comme son énergie » lève l'ambiguïté de « avec ».
- Enfant : défaut. « Il ne dit pas comment. » contredit le paragraphe suivant, qui donne des moyens généraux (État stratège, investissements planifiés, filières protégées). C'est le défaut type du lot, et l'enfant dit désormais autre chose que le détaillé et l'aîné.

Constats du premier relecteur : horizon omis : résolu sans chiffre ; « aucun chiffre » et « ni calendrier » : résolus ; « avec » ambigu : résolu.

Correction demandée (enfant) :
- Actuel : « Il ne dit pas comment. »
- Source : « L'État doit redevenir stratège. Planifier les investissements essentiels. »
- Remplacement (enfant à 43 mots, Kandel-Moles 81,0, validé) : « Selon elle, l'État doit faire des plans. »

Verdict : a_corriger (enfant).

### 10. nathalie-arthaud/sante-embauches-hopitaux : decision_editeur

À l'aveugle :
- Citation verbatim, rubrique « Face au chômage et aux licenciements », entre les marqueurs de page imprimée 9 et 10. Nouvelle localisation juste.
- La portée est claire dans les quatre niveaux : le résumé commence par « Contre le chômage », le détaillé et l'aîné citent la demande générale (« recenser les besoins et imposer que le travail soit réparti entre tous ») et disent que les hôpitaux ne sont qu'un service parmi d'autres ; l'enfant part du partage du travail.
- Modalité : « La phrase est écrite au conditionnel : elle décrit une démarche possible » : exact (« Si nous demandions… on arriverait… »).
- « Ailleurs, la brochure demande la confiscation des bénéfices de ceux qu'elle appelle les profiteurs de guerre, pour les hôpitaux et les écoles, sans lier cette demande à ces embauches » : exact (« les milliards pour les hôpitaux, les écoles, pas pour la guerre ! »), attribué.
- Titre « Idée d'une liste… » : fidèle à la modalité.
- Remarque (fiche source, hors de ce fichier) : l'extrait se termine par « Supplément gratuit à Lutte ouvrière n° 3021 du 26 juin 2026 », la fiche dit `date_publication: 2026-07-06`.

Constats du premier relecteur : nature santé : laissée au propriétaire ; page du PDF : remplacée par l'intertitre et la page imprimée, exact.

Décision à prendre : garder en santé une revendication générale sur l'emploi où l'hôpital est un exemple, ou la déplacer vers le thème travail. Le texte est publiable tel quel si elle reste en santé.

### 11. nicolas-dupont-aignan/sante-fin-passe-sanitaire : a_corriger

À l'aveugle :
- Citation verbatim, première des « Quelques mesures fortes » de la page Santé de debout-la-france.fr. Localisation juste.
- Attribution : la fiche source est `parti_du_candidat`. Le corps de la page parle en « nous » et ne nomme pas Nicolas Dupont-Aignan ; son nom n'apparaît que dans le menu et le pied de page du site (« NDA », « Nicolas Dupont-Aignan / Qui est-il ? »), qui ne lui attribuent pas le projet. La règle s'applique : le sujet doit être le parti. Le détaillé respecte la règle (« la mesure qui ouvre la liste… ») ; le résumé (« Nicolas Dupont-Aignan veut »), l'enfant (« Nicolas Dupont-Aignan veut… Il l'écrit dans le projet de son parti ») et l'aîné (« Nicolas Dupont-Aignan veut prononcer ») ne la respectent pas. « Il l'écrit » est faux : la page ne dit pas qu'il l'a écrite.
- Aîné : « Le texte ne précise pas quel dispositif exact il vise » est démenti par la même page : « suppression définitive de tout passe sanitaire ou vaccinal, réintégration des soignants exclus ».
- Détaillé : « Le texte ne définit pas ce qu'il désigne par passe sanitaire » est vrai à la lettre mais suggère un flou que la phrase suivante (extension au passe vaccinal, soignants exclus) dément ; à retirer.
- Datation : aucune date visible ; chiffres les plus récents de 2017 à 2020, numerus clausus « en 2020 », objectif « dès 2025 ». La fiche source affiche `date_publication: 2026-11`, non étayée. Les rédactions le disent honnêtement.
- Glossaire passe sanitaire : exact (« était », dispositif disparu).

Constats du premier relecteur : extension de la mesure plus bas : résolu au détaillé, pas à l'aîné ; page non datée : signalée dans les rédactions, fiche source non corrigée (hors périmètre).

Corrections demandées :
- Résumé, actuel : « Nicolas Dupont-Aignan veut la suppression immédiate, intégrale et irréversible du passe sanitaire, selon le projet de Debout la France. » Remplacement : « Son parti, Debout la France, veut la suppression immédiate, intégrale et irréversible du passe sanitaire. »
- Détaillé, actuel : « Le texte ne définit pas ce qu'il désigne par passe sanitaire. Il ne dit pas non plus par quel acte juridique cette suppression serait décidée. » Remplacement : « Le texte ne dit pas par quel acte juridique cette suppression serait décidée. »
- Enfant, remplacement du texte entier : « Son parti, Debout la France, veut supprimer le [[passe sanitaire]]. Il l'écrit dans la page Santé de son projet. Cette suppression serait immédiate, totale et sans retour possible. Le texte ne dit pas comment elle serait décidée. Il ne donne pas de date. »
- Aîné, remplacement du texte entier : « Dans la page Santé de son projet, Debout la France, parti de Nicolas Dupont-Aignan, veut prononcer la suppression immédiate, intégrale et irréversible du passe sanitaire. Cette mesure ouvre la liste des mesures fortes de la page. Plus bas, la même page l'étend à tout passe sanitaire ou vaccinal. Le texte ne précise pas par quel texte juridique la suppression serait décidée. La page ne porte pas de date de publication visible, ce qui empêche de savoir si ce passage date de la campagne actuelle. »
- Toutes validées (0 erreur, 0 avertissement sur ce fichier).

Décision qui reste au propriétaire en plus : corriger `date_publication` de la fiche source, et dire si une page qui semble écrite pour une campagne antérieure (règle « Élections précédentes » de `COUVERTURE-THEMES.md`) peut servir de source.

Verdict : a_corriger (résumé, détaillé, enfant, aîné).

### 12. nicolas-dupont-aignan/sante-lits-etablissements : a_corriger

À l'aveugle :
- Citation verbatim, deuxième mesure forte (répétée sous « Sauver l'hôpital public »). Localisation juste.
- Attribution : même défaut que la mesure 11 au résumé, à l'enfant et à l'aîné. Le détaillé (« une même mesure rassemble ») respecte la règle.
- « sans dater sa propre rédaction » : juste ; « au niveau de 2008 » : dans le `texte_source`.
- Défaut de calendrier : le détaillé dit « Il ne précise ni… ni le calendrier », l'aîné « ni le calendrier », l'enfant « Il ne dit pas quand ». La source dit « Arrêter immédiatement les fermetures de lits ». Le calendrier ne manque que pour les réouvertures. L'enfant perd en plus « immédiatement ».
- Coût et financement : la page chiffre d'autres mesures (lits de réanimation), pas celle-ci. « ne précise ni le coût, ni le financement » : vrai.

Constats du premier relecteur : « aujourd'hui » sans réserve : résolu.

Corrections demandées :
- Résumé, actuel : « Nicolas Dupont-Aignan veut arrêter les fermetures de lits, rouvrir un établissement de santé par département et cesser les concentrations d'établissements. » Remplacement (23 mots) : « Son parti, Debout la France, veut arrêter les fermetures de lits, rouvrir un établissement de santé par département et cesser les concentrations d'établissements. »
- Détaillé, actuel : « ni les établissements concernés, ni le calendrier. » Remplacement : « ni les établissements concernés, ni le délai des réouvertures. »
- Enfant, remplacement du texte entier : « Son parti, Debout la France, veut garder les lits d'hôpital. Il veut arrêter tout de suite d'en fermer. Il veut aussi rouvrir un hôpital ou une maternité dans chaque département. On ne regrouperait plus les établissements de santé. Le texte ne dit pas le coût. Il ne dit pas quand les réouvertures auraient lieu. »
- Aîné, remplacement du texte entier : « Dans le projet de Debout la France, parti de Nicolas Dupont-Aignan, la page Santé propose d'arrêter immédiatement les fermetures de lits et de rouvrir un établissement de santé, hôpital ou maternité, dans chaque département, à l'image du Val-de-Grâce en Ile-de-France. Elle propose aussi de cesser les concentrations d'établissements de santé. Le texte indique que rouvrir une maternité par département ramènerait au niveau de 2008. Il ne précise ni le financement, ni le délai des réouvertures. »
- Toutes validées (0 erreur, 0 avertissement sur ce fichier).

Même décision sur la date de la fiche source que pour la mesure 11.

Verdict : a_corriger (résumé, détaillé, enfant, aîné).

### 13. olivier-becht/sante-prevention : conforme

À l'aveugle :
- Citation verbatim, section « Un nouveau modèle de prévention ». Localisation juste.
- Les quatre niveaux sont fidèles ; « qu'il juge » attribue « trop souvent reléguée au second plan ». Les phrases « ne précise pas » (âge, intervenants, budget, date de départ) sont vraies pour toute la page. La suite de la section (sophrologie, méditation, santé au travail) est un autre engagement ; son absence ne déforme pas.
- Enfant : « Prévenir, c'est agir avant que les problèmes de santé arrivent. » est une définition de mot, cohérente avec le glossaire et avec « agir en amont » de la source ; ce n'est pas une affirmation sur la politique, je l'accepte.

Constats du premier relecteur : « en subir » sans antécédent : résolu.

Verdict : conforme. Lisibilité enfant 78,9 : avertissement préexistant.

### 14. olivier-becht/sante-secretariat-etat-sante-publique : conforme

À l'aveugle :
- Citation verbatim, section « Une priorité régalienne ». Le mot interdit « enfin » de la source n'est repris nulle part.
- Enfant réécrit : « Ce service fusionnerait cinq grandes agences qui existent déjà » (« fusionnera les cinq grandes agences existantes ») ; « Elles auraient les mêmes buts » (« sous un même contrat d'objectifs ») ; « Selon lui, on saurait mieux qui est responsable de quoi » (« mettre fin à l'éparpillement des responsabilités »). Fidèle et attribué ; « Ce service » cohérent avec le glossaire secrétariat d'État.
- Détaillé et aîné : exacts ; l'explication de « régalienne » est juste.

Constats du premier relecteur : lisibilité enfant : résolu (avertissement levé).

Verdict : conforme.

### 15. raphael-glucksmann/sante-projet-territorial-sante : conforme

À l'aveugle :
- Citation verbatim, chantier 23 « Bien soigner, partout ! », texte suivi du marqueur de page 50. Localisation cohérente.
- Attribution : document de Place publique ; Raphaël Glucksmann n'y figure que comme codirecteur de la publication. Résumé, détaillé et aîné ont le projet pour sujet ; l'enfant dit « Son parti, Place publique ». Conforme à la règle.
- Enfant réécrit : « les hôpitaux » rétablis ; « patients » pour « usagers » ; « Ce projet dirait ce dont les gens ont le plus besoin » pour « définissant les priorités selon les besoins réels de la population ». « Chaque territoire aurait son projet » est une lecture raisonnable de « piloté localement, à travers un Projet territorial ».
- « ne précise ni la taille du territoire, ni le calendrier, ni le coût, ni la façon dont les désaccords seraient tranchés » : vrai pour le chantier (la phrase suivante parle de « carte sanitaire » sans échelle ; le « financement global, territorial et pluri-annuel » vise l'hôpital, pas ce projet).

Constats du premier relecteur : lisibilité, « usagers », hôpitaux omis : résolus.

Verdict : conforme.

### 16. selma-labib/sante-besoins-embauches-hopitaux : decision_editeur

À l'aveugle :
- Citation verbatim, page 2, avant l'intertitre « Imposer l'interdiction des licenciements et des embauches massives ». Localisation juste.
- Attribution : document du NPA-Révolutionnaires qui nomme Selma Labib comme candidate ; « le NPA-Révolutionnaires, parti de Selma Labib » (résumé, détaillé, aîné) et « Selma Labib et son parti » (enfant) sont dans la règle. « les travailleurs » rend le « nous » du document (« C'est nous qui travaillons »).
- Portée claire dans les quatre niveaux (« Contre le chômage », « des ateliers aux hôpitaux », « un lieu parmi d'autres »).
- « Le document écrit qu'imposer ces mesures suppose de s'en prendre aux profits des multinationales, sans détailler le financement des postes hospitaliers » : exact.

Constats du premier relecteur : nature santé : laissée au propriétaire ; « ne dit pas qui paierait » : résolu.

Décision à prendre : la même que pour Arthaud (santé ou travail). Texte publiable tel quel s'il reste en santé.

## Changements du correcteur au-delà des constats, refus et points laissés

- Arthaud, financement (« ni comment elles seraient financées » remplacé par la phrase sur la confiscation des bénéfices) : d'accord. La brochure parle d'argent pour les hôpitaux, et la nouvelle phrase précise qu'elle n'est pas liée aux embauches.
- Polony, moyens (« par quels moyens » et « ni avec quels moyens » retirés au détaillé et à l'aîné) : d'accord. Mais la même logique imposait de corriger « Il ne dit pas comment. » à l'enfant, ce qu'il n'a pas fait (voir mesure 9).
- Ruffin, « le nom des entreprises visées » : d'accord, plus exact.
- Legendre, refus d'écrire « trop généreux » : d'accord sur la décision, pas tout à fait sur la raison. La phrase « notre système est trop généreux » vise le système social en général, mais le paragraphe santé est présenté juste après comme exemple d'« assistanat ». La baisse des remboursements, désormais rendue, suffit à montrer la tension sans reprendre ce jugement.
- Legendre, référendum (vu, laissé) : pas d'accord. L'omission est trompeuse au regard de la règle 3 ; correction demandée (mesure 4).
- Dupont-Aignan, sujet (vu, laissé) : pas d'accord. La page ne nomme pas le candidat dans son contenu ; le menu du site ne suffit pas. Correction demandée (mesures 11 et 12).
- Dupont-Aignan, « ni le calendrier » (vu, laissé) : pas d'accord. « immédiatement » est dans la citation même ; correction demandée (mesure 12).
- Polony, enfant (vu, laissé) : pas d'accord ; correction demandée (mesure 9).
- REGLE-04 : d'accord avec la méthode du correcteur. Aucune des formulations sans chiffre que j'ai vérifiées (Legendre « phrase suivante », Mélenchon « l'année de l'élection présidentielle », Polony « une échéance ») n'est fausse ni trompeuse. Elles sont moins informatives : élargir le `texte_source` reste une option du propriétaire.

## Désaccords avec le correcteur ou le premier relecteur

1. Gabriel Attal, enfant : les deux ont laissé une phrase écrite avec la voix du site (« Parfois, la copropriété refuse les installations individuelles. »). Le premier relecteur a noté « selon lui attribue le jugement » sans voir cette phrase.
2. Jean-François Legendre, arrêts maladie : le premier relecteur a déclaré le détaillé juste en dehors du chiffre ; le correcteur a vu le référendum et l'a laissé. Je demande la correction.
3. Nicolas Dupont-Aignan, deux mesures : le premier relecteur a jugé le sujet « Nicolas Dupont-Aignan » acceptable ; le correcteur l'a signalé sans corriger. Je demande la correction. Je relève aussi, dans l'aîné de la mesure passe sanitaire, une phrase « ne précise pas quel dispositif » qu'aucun des deux n'a relevée et que la page dément.
4. Nicolas Dupont-Aignan, lits : « ni le calendrier » et « Il ne dit pas quand », vus par le correcteur, laissés ; à corriger.
5. Natacha Polony, enfant : le premier relecteur l'a dit « ok » ; le correcteur l'a vu et laissé ; à corriger.
6. Jean-Luc Mélenchon, deux mesures : le premier relecteur a jugé l'attribution au candidat acceptable. Le document ne le nomme pas et dit présenter ce « que la France insoumise propose » : je renvoie la question au propriétaire.
7. Marine Tondelier : pas de désaccord sur le verdict ; je précise que l'attribution tient parce qu'elle signe la préface du programme.

## Données pour script

```json
[
  { "cible": "mesure:francis-lalanne/sante-fin-pass-obligations-medicales", "verdict": "conforme", "motif": "fidèle aux quatre niveaux ; localisation quatrième point vérifiée ; phrases « ne précise pas » vraies pour toute la page" },
  { "cible": "mesure:francois-ruffin/sante-pole-public-medicament", "verdict": "conforme", "motif": "fidèle ; gouvernance mixte et médicaments essentiels rendus ; coût, noms et date absents de tout le livret ; sous-thème gouvernance-sante pertinent" },
  { "cible": "mesure:gabriel-attal/sante-droit-climatisation", "verdict": "a_corriger", "motif": "enfant : « Parfois, la copropriété refuse les installations individuelles » est dit avec la voix du site ; réécriture attribuée proposée et validée (lisibilité 80,2)" },
  { "cible": "mesure:jean-francois-legendre/sante-analyser-arrets-maladie", "verdict": "a_corriger", "motif": "détaillé : « ne dit pas quelles décisions pourraient en découler » tait que le manifeste renvoie ces décisions au référendum ; remplacement proposé" },
  { "cible": "mesure:jean-francois-legendre/sante-preserver-prise-en-charge", "verdict": "conforme", "motif": "baisse des remboursements rendue au détaillé, à l'enfant et à l'aîné ; enfant attribué ; aucune phrase « ne dit pas » fausse" },
  { "cible": "mesure:jean-luc-melenchon/sante-budget-hopitaux-postes-soignants", "verdict": "decision_editeur", "motif": "texte fidèle ; le document ne nomme pas le candidat et présente ce « que la France insoumise propose » : attribution au candidat ou au parti à décider" },
  { "cible": "mesure:jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad", "verdict": "decision_editeur", "motif": "texte fidèle ; même question d'attribution au candidat ou à La France insoumise" },
  { "cible": "mesure:marine-tondelier/sante-prevention-priorites", "verdict": "conforme", "motif": "exemples de la proposition rendus ; aucun budget dans le programme ; attribution étayée par la préface signée par Marine Tondelier" },
  { "cible": "mesure:natacha-polony/sante-medicaments-essentiels-production", "verdict": "a_corriger", "motif": "enfant : « Il ne dit pas comment » alors que le paragraphe suivant parle de l'État stratège et des investissements ; remplacer par « Selon elle, l'État doit faire des plans. »" },
  { "cible": "mesure:nathalie-arthaud/sante-embauches-hopitaux", "verdict": "decision_editeur", "motif": "texte fidèle, portée générale explicite ; maintien en santé d'une revendication sur l'emploi à décider" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-fin-passe-sanitaire", "verdict": "a_corriger", "motif": "résumé, enfant, aîné : candidat sujet sur une page du parti qui ne le nomme pas ; aîné « ne précise pas quel dispositif » démenti par la même page ; date de la fiche source non étayée" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-lits-etablissements", "verdict": "a_corriger", "motif": "résumé, enfant, aîné : candidat sujet sur une page du parti ; « ni le calendrier » et « Il ne dit pas quand » alors que la mesure dit « immédiatement »" },
  { "cible": "mesure:olivier-becht/sante-prevention", "verdict": "conforme", "motif": "fidèle ; phrase enfant clarifiée, définition cohérente avec le glossaire" },
  { "cible": "mesure:olivier-becht/sante-secretariat-etat-sante-publique", "verdict": "conforme", "motif": "enfant réécrit fidèle et attribué ; mot interdit de la source non repris ; avertissement de lisibilité levé" },
  { "cible": "mesure:raphael-glucksmann/sante-projet-territorial-sante", "verdict": "conforme", "motif": "enfant réécrit fidèle ; sujet « Son parti, Place publique » conforme à la règle ; avertissement de lisibilité levé" },
  { "cible": "mesure:selma-labib/sante-besoins-embauches-hopitaux", "verdict": "decision_editeur", "motif": "texte fidèle, portée générale explicite ; maintien en santé d'une revendication sur l'emploi à décider" }
]
```

## Contrôle des retouches (2026-11-17)

Relecture complète des quatre niveaux des 5 mesures dans l'état du commit `6f75573` (branche `relecture/sante`), contre les extraits archivés. Les remplacements sont appliqués mot pour mot. Validateur (Node 24) : 0 erreur, 22 avertissements en production comme en preview, aucun sur ces 5 fichiers. Champs protégés inchangés.

- gabriel-attal/sante-droit-climatisation : conforme. Les quatre niveaux concordent ; chaque phrase enfant est attribuée (« Selon lui ») ; « sans raison », absent du détaillé et de l'aîné, est attribué au candidat à l'enfant, comme dans la source. Reste hors verdict : la date de la fiche source (2026-11 contre « 25 juin 2026 » sur la page).
- jean-francois-legendre/sante-analyser-arrets-maladie : conforme (contrôle final, commit `88b1693`). Premier contrôle : a_corriger, « La phrase suivante du manifeste » venait après la phrase sur le référendum et désignait donc la mauvaise phrase. Le détaillé dit désormais « La phrase qui suit la citation donne le nombre de ces arrêts… » puis « Plus loin, le manifeste ajoute que le peuple décidera par référendum… », dans l'ordre du manifeste (chiffres juste après la citation, référendum deux phrases plus loin). Relu en entier : résumé, enfant et aîné inchangés et exacts ; aucun chiffre hors citation ; le validateur ne donne aucun diagnostic sur ce fichier.
- natacha-polony/sante-medicaments-essentiels-production : conforme. L'enfant dit désormais comme le détaillé et l'aîné que l'État doit planifier, sans phrase « ne dit pas » fausse.
- nicolas-dupont-aignan/sante-fin-passe-sanitaire : conforme pour les rédactions. Le parti est sujet dans les quatre niveaux ; l'extension au passe vaccinal figure au détaillé et à l'aîné ; l'absence de date est signalée. Reste ouverte, hors rédactions, la décision de l'éditeur sur la fiche source (`date_publication: 2026-11` non étayée, page peut-être d'une campagne antérieure) : si la page est jugée hors période, la mesure ne doit pas être publiée.
- nicolas-dupont-aignan/sante-lits-etablissements : conforme pour les rédactions. Parti sujet dans les quatre niveaux ; « immédiatement » rendu partout (« tout de suite » à l'enfant) ; seul le délai des réouvertures est dit absent, ce qui est exact. Même décision ouverte sur la fiche source.

### Données pour script (verdicts après retouches, remplacé par le bloc final plus bas)

```json
[
  { "cible": "mesure:francis-lalanne/sante-fin-pass-obligations-medicales", "verdict": "conforme", "motif": "fidèle aux quatre niveaux ; localisation quatrième point vérifiée ; phrases « ne précise pas » vraies pour toute la page" },
  { "cible": "mesure:francois-ruffin/sante-pole-public-medicament", "verdict": "conforme", "motif": "fidèle ; gouvernance mixte et médicaments essentiels rendus ; coût, noms et date absents de tout le livret ; sous-thème gouvernance-sante pertinent" },
  { "cible": "mesure:gabriel-attal/sante-droit-climatisation", "verdict": "conforme", "motif": "après retouche : enfant entièrement attribué, quatre niveaux concordants ; date de la fiche source à corriger hors rédactions" },
  { "cible": "mesure:jean-francois-legendre/sante-analyser-arrets-maladie", "verdict": "conforme", "motif": "après la seconde retouche : chiffres situés juste après la citation, renvoi au référendum dans l'ordre du manifeste ; quatre niveaux exacts" },
  { "cible": "mesure:jean-francois-legendre/sante-preserver-prise-en-charge", "verdict": "conforme", "motif": "baisse des remboursements rendue au détaillé, à l'enfant et à l'aîné ; enfant attribué ; aucune phrase « ne dit pas » fausse" },
  { "cible": "mesure:jean-luc-melenchon/sante-budget-hopitaux-postes-soignants", "verdict": "decision_editeur", "motif": "texte fidèle ; le document ne nomme pas le candidat et présente ce « que la France insoumise propose » : attribution au candidat ou au parti à décider" },
  { "cible": "mesure:jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad", "verdict": "decision_editeur", "motif": "texte fidèle ; même question d'attribution au candidat ou à La France insoumise" },
  { "cible": "mesure:marine-tondelier/sante-prevention-priorites", "verdict": "conforme", "motif": "exemples de la proposition rendus ; aucun budget dans le programme ; attribution étayée par la préface signée par Marine Tondelier" },
  { "cible": "mesure:natacha-polony/sante-medicaments-essentiels-production", "verdict": "conforme", "motif": "après retouche : l'enfant rend l'État qui planifie, comme le détaillé et l'aîné ; plus de phrase « ne dit pas » fausse" },
  { "cible": "mesure:nathalie-arthaud/sante-embauches-hopitaux", "verdict": "decision_editeur", "motif": "texte fidèle, portée générale explicite ; maintien en santé d'une revendication sur l'emploi à décider" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-fin-passe-sanitaire", "verdict": "conforme", "motif": "après retouche : parti sujet dans les quatre niveaux, extension au passe vaccinal rendue ; décision de l'éditeur encore ouverte sur la date non étayée de la fiche source, à trancher avant publication" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-lits-etablissements", "verdict": "conforme", "motif": "après retouche : parti sujet dans les quatre niveaux, « immédiatement » rendu, seul le délai des réouvertures dit absent ; même décision ouverte sur la fiche source" },
  { "cible": "mesure:olivier-becht/sante-prevention", "verdict": "conforme", "motif": "fidèle ; phrase enfant clarifiée, définition cohérente avec le glossaire" },
  { "cible": "mesure:olivier-becht/sante-secretariat-etat-sante-publique", "verdict": "conforme", "motif": "enfant réécrit fidèle et attribué ; mot interdit de la source non repris ; avertissement de lisibilité levé" },
  { "cible": "mesure:raphael-glucksmann/sante-projet-territorial-sante", "verdict": "conforme", "motif": "enfant réécrit fidèle ; sujet « Son parti, Place publique » conforme à la règle ; avertissement de lisibilité levé" },
  { "cible": "mesure:selma-labib/sante-besoins-embauches-hopitaux", "verdict": "decision_editeur", "motif": "texte fidèle, portée générale explicite ; maintien en santé d'une revendication sur l'emploi à décider" }
]
```

## Après les décisions de l'éditeur (2026-11-17)

Décisions du propriétaire : quand le document est celui du parti, le sujet est le parti, pour tous les candidats ; les mesures d'Arthaud et de Labib restent en santé ; publication sans les chiffrages des candidats. Commits relus : `8aa78a2` et `25f68eb` (branche `relecture/sante`). Validateur (Node 24) : 0 erreur, 21 avertissements en production comme en preview ; aucun diagnostic sur les fichiers Mélenchon, Dupont-Aignan, Attal et Arthaud (l'avertissement de lisibilité de l'enfant canicule a disparu).

1. **Les deux mesures Mélenchon, relues en entier : conformes.**
   - Attribution vraie et claire : le document dit présenter « les grandes orientations budgétaires que la France insoumise propose pour l'année 2027 », et la fiche candidat donne `parti: La France insoumise`. La fiche source passe à `auteur: parti_du_candidat`, ce qui est cohérent.
   - « publié sur le site de campagne du candidat » : étayé par l'adresse du document (melenchon2027.fr) et par l'en-tête « Élection présidentielle - 18 avril 2027 ».
   - Coupes d'un mot : « le budget hospitalier » pour « le budget des hôpitaux » garde le sens ; « un plan d'urgence contre les canicules, commençant par équiper… » garde le sens de « Ce plan d'urgence contre les canicules commencera par équiper », et « contre les incendies » reste.
   - Pronoms : « Il indique », « Il veut aussi » renvoient à « son parti » ; « selon lui » suit « Le document range… » et renvoie au document. À l'enfant, « Son parti » sans nom suit la convention du projet (les textes enfant ne nomment pas les partis). Le validateur ne relève aucun dépassement de longueur.
2. **Dates des sources : exactes.**
   - Attal `2026-06-25` : la page affiche « 25 juin 2026 · Face aux canicules » sous le titre de la mesure.
   - Arthaud `2026-06-26` : la brochure se termine par « Supplément gratuit à Lutte ouvrière n° 3021 du 26 juin 2026 » (l'adresse du PDF est aussi rangée en 2026/06).
   - Debout la France : le champ obligatoire garde `2026-11`, mais le site public n'affiche pas `date_publication` (`BlocSource.astro` montre le titre et la date de consultation). Le titre affiché « Debout la France, projet : Santé (page non datée) », les deux `source_localisation` et le détaillé (et l'aîné de la mesure passe sanitaire) disent l'absence de date : c'est exact et suffisant pour un lecteur. Seul l'outil de relecture interne affiche encore « Publiée : 2026-11 » (`scripts/lib/relecture/serveur.ts`) ; c'est à garder en tête pour les relecteurs, sans effet public.
3. **Verdicts finaux des quatre mesures en attente :** Mélenchon budget des hôpitaux : conforme. Mélenchon plan canicule : conforme. Arthaud : conforme (classement en santé décidé, texte fidèle, portée explicite). Labib : conforme (même raison).

Bilan final du lot : 16 conformes sur 16.

### Données pour script (verdicts finaux après décisions de l'éditeur, dernier bloc, à prendre en compte)

```json
[
  {
    "cible": "mesure:francis-lalanne/sante-fin-pass-obligations-medicales",
    "verdict": "conforme",
    "motif": "fidèle aux quatre niveaux ; localisation quatrième point vérifiée ; phrases « ne précise pas » vraies pour toute la page"
  },
  {
    "cible": "mesure:francois-ruffin/sante-pole-public-medicament",
    "verdict": "conforme",
    "motif": "fidèle ; gouvernance mixte et médicaments essentiels rendus ; coût, noms et date absents de tout le livret ; sous-thème gouvernance-sante pertinent"
  },
  {
    "cible": "mesure:gabriel-attal/sante-droit-climatisation",
    "verdict": "conforme",
    "motif": "après retouche : enfant entièrement attribué, quatre niveaux concordants ; date de la fiche source corrigée au 2026-06-25, étayée par la page"
  },
  {
    "cible": "mesure:jean-francois-legendre/sante-analyser-arrets-maladie",
    "verdict": "conforme",
    "motif": "après la seconde retouche : chiffres situés juste après la citation, renvoi au référendum dans l'ordre du manifeste ; quatre niveaux exacts"
  },
  {
    "cible": "mesure:jean-francois-legendre/sante-preserver-prise-en-charge",
    "verdict": "conforme",
    "motif": "baisse des remboursements rendue au détaillé, à l'enfant et à l'aîné ; enfant attribué ; aucune phrase « ne dit pas » fausse"
  },
  {
    "cible": "mesure:jean-luc-melenchon/sante-budget-hopitaux-postes-soignants",
    "verdict": "conforme",
    "motif": "après décision de l'éditeur : son parti, La France insoumise, sujet des quatre niveaux, comme le dit le document ; « budget hospitalier » de même sens ; longueurs et chiffres conformes"
  },
  {
    "cible": "mesure:jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad",
    "verdict": "conforme",
    "motif": "après décision de l'éditeur : attribution à La France insoumise exacte ; « commençant par » garde le sens ; « contre les incendies » conservé ; longueurs conformes"
  },
  {
    "cible": "mesure:marine-tondelier/sante-prevention-priorites",
    "verdict": "conforme",
    "motif": "exemples de la proposition rendus ; aucun budget dans le programme ; attribution étayée par la préface signée par Marine Tondelier"
  },
  {
    "cible": "mesure:natacha-polony/sante-medicaments-essentiels-production",
    "verdict": "conforme",
    "motif": "après retouche : l'enfant rend l'État qui planifie, comme le détaillé et l'aîné ; plus de phrase « ne dit pas » fausse"
  },
  {
    "cible": "mesure:nathalie-arthaud/sante-embauches-hopitaux",
    "verdict": "conforme",
    "motif": "maintien en santé décidé par l'éditeur ; texte fidèle, portée générale explicite ; date de la brochure corrigée au 2026-06-26, étayée par l'extrait"
  },
  {
    "cible": "mesure:nicolas-dupont-aignan/sante-fin-passe-sanitaire",
    "verdict": "conforme",
    "motif": "parti sujet dans les quatre niveaux, extension au passe vaccinal rendue ; page non datée signalée dans le titre de la source affiché, la localisation et les rédactions"
  },
  {
    "cible": "mesure:nicolas-dupont-aignan/sante-lits-etablissements",
    "verdict": "conforme",
    "motif": "parti sujet dans les quatre niveaux, « immédiatement » rendu ; page non datée signalée dans le titre de la source affiché, la localisation et le détaillé"
  },
  {
    "cible": "mesure:olivier-becht/sante-prevention",
    "verdict": "conforme",
    "motif": "fidèle ; phrase enfant clarifiée, définition cohérente avec le glossaire"
  },
  {
    "cible": "mesure:olivier-becht/sante-secretariat-etat-sante-publique",
    "verdict": "conforme",
    "motif": "enfant réécrit fidèle et attribué ; mot interdit de la source non repris ; avertissement de lisibilité levé"
  },
  {
    "cible": "mesure:raphael-glucksmann/sante-projet-territorial-sante",
    "verdict": "conforme",
    "motif": "enfant réécrit fidèle ; sujet « Son parti, Place publique » conforme à la règle ; avertissement de lisibilité levé"
  },
  {
    "cible": "mesure:selma-labib/sante-besoins-embauches-hopitaux",
    "verdict": "conforme",
    "motif": "maintien en santé décidé par l'éditeur ; texte fidèle, portée générale explicite"
  }
]
```
