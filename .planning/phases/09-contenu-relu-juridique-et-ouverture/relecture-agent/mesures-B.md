# Relecture par agent, lot B : mesures santé (14 candidats, 23 mesures)

- Date : 2026-11-17
- Relecteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5)
- Lot : santé de francis-lalanne, francois-ruffin, gabriel-attal, jean-francois-legendre, jean-luc-melenchon, juan-branco, karim-bouamrane, marine-tondelier, natacha-polony, nathalie-arthaud, nicolas-dupont-aignan, olivier-becht, raphael-glucksmann, selma-labib (23 fichiers `src/content/mesures/<candidat>/sante-*.yaml`, compte vérifié par `ls`).
- Rappel : le propriétaire a confirmé le 2026-11-17 que la ligne publique sous une mesure relue par un agent nommera un agent IA, pas lui. Un verdict `conforme` ci-dessous est un verdict que je signe.

## Méthode (5 lignes)

1. Pour chaque mesure : lecture du fichier, de la fiche source (`src/content/sources/`) et de l'extrait archivé (`archive.extrait`).
2. Recherche du `texte_source` dans l'extrait par script (normalisation des apostrophes, espaces, guillemets et retours à la ligne) : les 23 citations sont retrouvées telles quelles.
3. Lecture du passage autour de la citation (avant et après, rubrique, page) pour vérifier contexte, conditions, chiffres, dates et localisation.
4. Comparaison phrase par phrase des quatre rédactions avec l'extrait, puis contrôle de neutralité (mots interdits par recherche, attribution, étiquette du candidat), des définitions du glossaire utilisées et du sous-thème (liste de `src/content/themes/sante.yaml`).
5. Toute phrase du type « le texte ne précise pas X » a été vérifiée contre l'ensemble de l'extrait, pas seulement contre la citation.

## Limites

- Je suis un modèle qui relit des textes écrits par un modèle : des erreurs de même nature peuvent m'échapper.
- J'ai travaillé uniquement sur les extraits texte archivés, sans le site en ligne ni le PDF d'origine. Les numéros de « page du PDF » ne sont donc vérifiables que par les numéros de page imprimés présents dans l'extrait.
- Je n'ai rien modifié dans le dépôt ; les corrections proposées sont à appliquer par l'humain ou par le flux prévu.
- Aucune mesure de ce lot ne contient de bloc aîné « ce qui me concerne » : ce point est sans objet pour les 23 mesures.

## Tableau récapitulatif

Bilan : 7 conformes, 12 doutes, 4 erreurs.

| Mesure | Verdict | Raison |
|---|---|---|
| francis-lalanne/sante-fin-pass-obligations-medicales | doute | Localisation fausse : quatrième point de l'axe 3, pas le cinquième |
| francois-ruffin/sante-pole-public-medicament | doute | Sous-thème inadapté ; « ne précise pas les médicaments » alors que la suite les précise |
| francois-ruffin/sante-sante-scolaire-service-unifie | conforme | Fidèle aux quatre niveaux |
| gabriel-attal/sante-depistage-pfas | conforme | Fidèle aux quatre niveaux |
| gabriel-attal/sante-droit-climatisation | erreur | Détaillé et aîné disent « pas de date » ; la page dit « dès l'été prochain » |
| jean-francois-legendre/sante-analyser-arrets-maladie | erreur | Détaillé dit « ne chiffre pas le coût » ; le texte donne 14 milliards |
| jean-francois-legendre/sante-preserver-prise-en-charge | erreur | Détaillé dit « ni s'il serait modifié » alors que le texte prévoit moins de remboursements ; l'enfant présente la vision du candidat comme un fait |
| jean-luc-melenchon/sante-budget-hopitaux-postes-soignants | erreur | « Pas de calendrier » et « pas de financement » démentis par le document (budget 2027) |
| jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad | doute | Résumé omet « contre les incendies » ; calendrier à nuancer |
| juan-branco/sante-plan-urgence-deserts-medicaux | conforme | Fidèle, attribution prudente |
| juan-branco/sante-politique-unique-deserts-medicaux | conforme | Fidèle |
| karim-bouamrane/sante-soins-deserts-medicaux | conforme | Fidèle, modalité acceptable |
| marine-tondelier/sante-activite-physique-adaptee | conforme | Fidèle |
| marine-tondelier/sante-prevention-priorites | doute | Détaillé tait les exemples donnés dans la même proposition |
| natacha-polony/sante-medicaments-essentiels-production | doute | Horizon « dans dix ans » omis ; « avec » ambigu dans le résumé |
| nathalie-arthaud/sante-embauches-hopitaux | doute | Proposition générale sur l'emploi, hypothétique, classée en santé ; page à vérifier |
| nicolas-dupont-aignan/sante-fin-passe-sanitaire | doute | Page non datée (date de la fiche source non étayée) ; portée précisée plus bas sur la page |
| nicolas-dupont-aignan/sante-lits-etablissements | doute | Page non datée ; « aujourd'hui » repris sans réserve |
| olivier-becht/sante-prevention | doute | Phrase enfant peu claire (« en subir ») |
| olivier-becht/sante-secretariat-etat-sante-publique | doute | Lisibilité enfant (avertissement validateur), reformulation proposée |
| raphael-glucksmann/sante-plan-prevention | conforme | Fidèle |
| raphael-glucksmann/sante-projet-territorial-sante | doute | Lisibilité enfant (avertissement validateur), « usagers », hôpitaux omis |
| selma-labib/sante-besoins-embauches-hopitaux | doute | Revendication générale sur l'emploi ; « ne dit pas qui paierait » à nuancer |

## Détail par mesure

### 1. francis-lalanne/sante-fin-pass-obligations-medicales : doute

- Citation : ok, trouvée telle quelle dans `archives/francis-lalanne/5369dfe9ad56.txt`.
- Localisation : **imprécise**. La citation est le **quatrième** point de l'axe 3 Liberté ! (après « Liberté d'expression totale », « Refus du contrôle social », « Stop à l'intrusion de l'État »), pas le cinquième.
- Résumé, détaillé, enfant, aîné : ok, fidèles ; les manques (quel pass, quel statut médical, quelle procédure) sont signalés sans ajout.
- Neutralité : ok. Glossaire Constitution et discrimination : ok, neutres.
- Titre, sous-thème (gouvernance-sante) : ok. Source primaire du candidat (« Site officiel de la campagne présidentielle de Francis Lalanne »), datée : ok.
- Correction proposée (`source_localisation`) : « page Le Projet 2027, axe 3 Liberté !, quatrième point ».

### 2. francois-ruffin/sante-pole-public-medicament : doute

- Citation : ok (`archives/francois-ruffin/21ea30ec89a7.txt`, Proposition 2 « Une production publique pour les secteurs où il faut reprendre le contrôle »). Page imprimée 48 : ok.
- Résumé, enfant : ok.
- Détaillé et aîné : **précision manquante qui induit en erreur**. Détaillé : « Le passage cité ne précise ni le coût, ni les médicaments concernés, ni les entreprises visées, ni la date. » Aîné : « Le passage ne dit pas combien cela coûterait ni quels médicaments seraient produits. » Or la phrase qui suit immédiatement la citation précise le pôle : « une entité à gouvernance mixte (État, collectivités, représentants des soignants et des patients) » et sa mission n°1 : « des médicaments essentiels à brevet public dans un premier temps ». Formellement limité au « passage cité », le texte laisse croire au lecteur que le candidat ne dit rien des médicaments visés.
- Sous-thème : **inadapté**. `hopital-et-soignants` ne correspond pas à un pôle public de production de médicaments. La mesure Polony de même nature est classée `gouvernance-sante` ; proposer `gouvernance-sante` par cohérence.
- Neutralité : ok (« sabotent » reste dans la citation, n'est pas repris).
- Corrections proposées :
  - Détaillé, dernière phrase : « La suite du texte précise que ce pôle aurait une gouvernance mixte (État, collectivités, soignants, patients) et produirait d'abord des médicaments essentiels à brevet public. Elle ne donne ni le coût, ni les entreprises visées, ni la date. »
  - Aîné, dernière phrase : « Le texte précise que le pôle produirait d'abord des médicaments essentiels dont le brevet est public, avec une gouvernance mixte. Il ne dit pas combien cela coûterait. »
  - `sous_theme: gouvernance-sante`.

### 3. francois-ruffin/sante-sante-scolaire-service-unifie : conforme

- Citation : ok (`archives/francois-ruffin/8e069fdc1ca5.txt`, Proposition 3, point 3, page imprimée 46).
- Localisation : ok (proposition et page justes ; ajouter « point 3 » serait plus précis, sans être nécessaire).
- Résumé : ok ; il ne reprend pas la médecine du travail, ce qui réduit sans déformer (limite de 25 mots).
- Détaillé, aîné : ok, fidèles, aucun ajout.
- Enfant : ok ; glossaire rectorat correct et neutre.
- Neutralité, titre, sous-thème (acces-aux-soins, acceptable) : ok. Source primaire datée (2026-10-28) : ok.

### 4. gabriel-attal/sante-depistage-pfas : conforme

- Citation : ok (`archives/gabriel-attal/6191539ef917.txt`, page de la mesure, datée « 10 août 2026 »).
- Résumé, détaillé, aîné : ok. La glose de l'aîné (« substances chimiques aussi appelées polluants éternels ») et la définition des captages sont exactes.
- Enfant : ok. « une alerte ou une demande locale » résume « un signalement, une alerte locale ou la vigilance d'une collectivité » sans changer le sens. Glossaire PFAS : exact et neutre.
- Neutralité : ok (les sanctions sont attribuées au texte). Titre, sous-thème (sante-environnementale ; la page est classée « Santé ») : ok.

### 5. gabriel-attal/sante-droit-climatisation : erreur

- Citation : ok (`archives/gabriel-attal/0ea9698010c3.txt`, section « Lever les blocages des copropriétés et des contraintes patrimoniales »).
- Résumé : ok.
- Détaillé : **erreur**. Texte actuel : « Il ne chiffre pas le coût et ne donne pas de date d'application. » La même page écrit : « Ce droit doit protéger les Français dès l'été prochain » (page datée du 25 juin 2026). La page donne donc une échéance.
- Aîné : **erreur**, même défaut : « Le texte ne dit pas comment ces blocages seraient levés ni à quelle date la mesure s'appliquerait. »
- Enfant : **doute**. « Il veut aussi simplifier des règles sur les logements anciens » élargit la portée : la source vise les « contraintes patrimoniales imposées par les Architectes des Bâtiments de France », pas toutes les règles sur les logements anciens. Glossaire copropriété : ok.
- Neutralité : ok (« sans raison » n'est pas repris ; « selon lui » attribue le jugement). Titre, sous-thème : ok.
- Corrections proposées :
  - Détaillé, dernière phrase : « Il ne chiffre pas le coût. La page indique que ce droit doit protéger les Français dès l'été prochain, sans date plus précise. »
  - Aîné, dernière phrase : « Le texte ne dit pas comment ces blocages seraient levés. La page indique que ce droit doit protéger les Français dès l'été prochain. »
  - Enfant, quatrième phrase : « Il veut aussi simplifier des règles qui protègent les bâtiments anciens. »

### 6. jean-francois-legendre/sante-analyser-arrets-maladie : erreur

- Citation : ok (`archives/jean-francois-legendre/7c49b6206376.txt`).
- Localisation : **imprécise**. Le paragraphe se trouve dans la partie « La fiscalité » du manifeste, bien après la partie sur l'assistanat. Proposer : « manifeste, partie La fiscalité, paragraphe sur la solidarité et les abus ».
- Détaillé : **erreur**. Texte actuel : « Le texte ne chiffre pas non plus le coût de ces arrêts. » La phrase qui suit la citation écrit : « Neuf millions d'arrêts en 2025 qui représentent une charge de 14 milliards pour l'assurance maladie ». Le texte donne donc un chiffre.
- Résumé, enfant, aîné : ok. Modalité respectée : « doit être rigoureusement analysée » est une demande d'analyse, pas une mesure de sanction précise.
- Neutralité : ok, « tricheurs » est attribué au candidat (« écrit que »). Titre, sous-thème (assurance-maladie) : ok.
- Correction proposée (détaillé, dernière phrase) : « Le texte ajoute que neuf millions d'arrêts en 2025 représentent, selon lui, une charge de 14 milliards pour l'assurance maladie. »

### 7. jean-francois-legendre/sante-preserver-prise-en-charge : erreur

- Citation : ok, partie « La santé » du passage sur l'assistanat.
- Contexte : la même partie du manifeste annonce « moins de remboursements pour les actes médicaux et les médicaments », juge que « notre système est trop généreux » et propose de « réduire la voilure pendant quelques années ».
- Détaillé : **erreur**. Texte actuel : « Le texte ne dit pas comment ce système serait préservé, ni par quels moyens, ni s'il serait modifié. » Le manifeste prévoit justement de le modifier (moins de remboursements).
- Enfant : **erreur de neutralité (attribution)**. « Les soins sont pris en charge par des organismes de l'État. Il suffit de montrer la carte Vitale. » présente comme un fait, avec la voix du site, une description du candidat (prise en charge intégrale, reste à charge de 0 €) qui est discutable et qui doit rester attribuée.
- Résumé : ok sur la lettre, mais l'absence du contexte (baisse des remboursements dans la même partie) sera réglée par la correction du détaillé et de l'aîné.
- Aîné : **doute**. « Le texte ne précise pas les moyens de cette préservation » est exact, mais il omet la baisse des remboursements prévue dans la même partie, ce qui donne une image partielle de la position.
- Titre, sous-thème : ok.
- Corrections proposées :
  - Détaillé, avant-dernière phrase : « Dans la même partie, le manifeste prévoit aussi moins de remboursements pour les actes médicaux et les médicaments, et juge le système trop généreux. »
  - Enfant (environ 45 mots) : « Jean-François Legendre décrit le système de santé français. Selon lui, des organismes de l'État paient tous les soins. Il suffirait de montrer sa carte Vitale. Il écrit qu'il faut préserver ce système. Dans le même texte, il propose aussi moins de remboursements. »
  - Aîné, dernière phrase : « Dans la même partie, il prévoit aussi moins de remboursements pour les actes médicaux et les médicaments. »

### 8. jean-luc-melenchon/sante-budget-hopitaux-postes-soignants : erreur

- Citation : ok (`archives/jean-luc-melenchon/b7af366684aa.txt`, section « Répondre aux urgences en renforçant les services publics », page imprimée 10).
- Contexte : le document écrit « Ce document présente donc les grandes orientations budgétaires que la France insoumise propose pour l'année 2027 », et finance ces dépenses par une hausse des recettes « d'un peu plus de 100 milliards d'euros [...] uniquement en faisant contribuer les plus riches ».
- Résumé : ok.
- Détaillé : **erreur**. « sur quelle durée » et « Le texte indique le montant de la hausse du budget, mais pas le calendrier de cette hausse. » : le document situe ces dépenses dans le budget de l'année 2027.
- Enfant : **erreur**. « Il ne dit pas combien de temps cela prendrait. » : même problème.
- Aîné : **erreur**. « ni sur combien d'années » et « Il ne dit pas comment cette hausse serait financée. » : le document explique son financement d'ensemble.
- Attribution : le texte dit « nous » et « la France insoumise », sur le site de campagne du candidat ; « Jean-Luc Mélenchon propose » est acceptable.
- Neutralité, titre, sous-thème : ok.
- Corrections proposées :
  - Détaillé : supprimer « sur quelle durée, » et remplacer la dernière phrase par « Le document range cette hausse dans ses orientations budgétaires pour 2027, financées selon lui par une contribution accrue des plus riches. »
  - Enfant, dernière phrase : « Cela ferait partie de son budget pour 2027. »
  - Aîné, deux dernières phrases : « Le texte ne précise pas dans quels établissements ces postes seraient créés, ni quelles professions seraient recrutées. Le document range cette hausse dans ses orientations budgétaires pour 2027, financées selon lui par une contribution accrue des plus riches. »

### 9. jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad : doute

- Citation : ok (section « Enclencher la planification écologique », page imprimée 11).
- Résumé : **doute**. « qui commencerait par équiper les hôpitaux, les Ehpad, les écoles et des logements » omet « contre les incendies » ; le lecteur comprend un équipement contre la chaleur, ce que la source ne dit pas.
- Détaillé et aîné : **doute** sur « ni le calendrier » : le document se présente comme les orientations budgétaires « pour l'année 2027 » et ajoute que « 10 milliards devront être investis dès 2026 » pour faire face aux effets du dérèglement climatique, sans dire si ce plan en fait partie. Le détaillé dit prudemment « le coût propre à ce plan », l'aîné dit « le coût de ce plan ».
- Enfant : ok (il reprend « équipés contre les incendies »). Glossaire Ehpad : ok.
- Neutralité, titre, sous-thème (sante-environnementale) : ok.
- Corrections proposées :
  - Résumé (22 mots) : « Jean-Luc Mélenchon veut un plan d'urgence contre les canicules, qui commencerait par équiper hôpitaux, Ehpad, écoles et certains logements contre les incendies. »
  - Détaillé et aîné : remplacer « ni le calendrier » par « Le document présente ses orientations pour l'année 2027 sans calendrier propre à ce plan ».

### 10. juan-branco/sante-plan-urgence-deserts-medicaux : conforme

- Citation : ok (`archives/juan-branco/1d64443933a3.txt`, réforme 07 « La Santé », première puce).
- Localisation : ok.
- Les quatre niveaux : ok, attribution prudente et exacte (programme publié par Les Ruches, qui soutient Juan Branco ; fiche candidat : « Sans étiquette (soutenu par Les Ruches) »). Aucun ajout ; la brièveté de la source est signalée.
- Enfant : glossaire désert médical exact et neutre.
- Titre, sous-thème (acces-aux-soins) : ok. Source datée (2026-11), auteur « coalition » : ok.

### 11. juan-branco/sante-politique-unique-deserts-medicaux : conforme

- Citation : ok (deuxième puce).
- Détaillé : ok, liste complète et fidèle.
- Aîné : ok ; il ne reprend pas la « régulation de l'installation décennale », omission qui ne déforme pas.
- Enfant : ok ; « Plusieurs aides existent » simplifie « dispositifs » sans déformer ; « dans chaque département » correspond à « centres de santé départementaux ».
- Neutralité, titre, sous-thème : ok.

### 12. karim-bouamrane/sante-soins-deserts-medicaux : conforme

- Citation : ok (`archives/karim-bouamrane/e98e184d8dd3.txt`, section « Soigner »).
- Modalité : la source décrit une vision (« Une France où... »), le manifeste se conclut par « Voilà ma vision. Voilà mon engagement. ». Le détaillé dit « décrit », les autres niveaux « veut » ou « souhaite » : acceptable.
- Résumé, détaillé, aîné : ok, et ils signalent l'absence de moyens, de chiffres et de calendrier, ce qui est exact pour tout le manifeste.
- Enfant : ok ; il retire la liste des critères de non-discrimination, simplification acceptable. Glossaire désert médical : ok.
- Remarque non bloquante : il s'agit d'un objectif plus que d'une mesure, ce que le détaillé dit déjà.

### 13. marine-tondelier/sante-activite-physique-adaptee : conforme

- Citation : ok (`archives/marine-tondelier/77deeacd2e6e.txt`, chapitre 29, proposition 2).
- Localisation : ok (les propositions suivent le marqueur de page 110, donc page 111).
- Attribution : ok (programme des Écologistes, « soutenu par Marine Tondelier » ; source « parti_du_candidat »).
- Les quatre niveaux : ok. La suite de la proposition (maisons Sport-Santé, formation d'éducateurs) ne contredit aucune phrase « ne précise pas ».
- Glossaire Sécurité sociale et activité physique adaptée : ok, neutres.

### 14. marine-tondelier/sante-prevention-priorites : doute

- Citation : ok (chapitre 29, proposition 1).
- Détaillé : **doute**. « Le texte cité ne dit pas quel budget y serait consacré, ni quelles mesures précises composeraient chaque plan. » La même proposition continue par « Par exemple, instaurer des programmes éducatifs [...], rembourser des séances de diététique, soutenir les associations [...] et interdire les produits nocifs pour mieux lutter contre l'obésité », et cite la vaccination préventive et le dépistage des maladies rares. Limitée au « texte cité », la phrase est exacte, mais elle fait croire que le programme ne donne aucun exemple.
- Résumé, enfant, aîné : ok. Glossaire prévention, obésité, santé mentale : ok. « encouragements » dans l'enfant n'est pas de la famille de « courageux » (pas de préfixe « courage »).
- Neutralité, titre (« Développement massif » reprend « massivement » de la source), sous-thème : ok.
- Correction proposée (détaillé, dernière phrase) : « La suite de la proposition donne des exemples : programmes d'éducation à la santé pour les enfants, remboursement de séances de diététique, interdiction de produits nocifs contre l'obésité. Le texte ne dit pas quel budget y serait consacré. »

### 15. natacha-polony/sante-medicaments-essentiels-production : doute

- Citation : ok (`archives/natacha-polony/4f2f9dff844e.txt`).
- Contexte : la phrase précédente est « Dans dix ans, la France doit avoir retrouvé sa puissance industrielle. »
- Détaillé : **doute**. « Le passage vient après une phrase qui fixe pour objectif de retrouver la puissance industrielle » omet l'horizon de dix ans, et « Il ne donne aucun chiffre » devient discutable.
- Aîné : **doute**. « ni sur quel calendrier » : le paragraphe précédent donne un horizon (dix ans) dont la liste « Produire... » est le prolongement.
- Résumé : **doute léger**. « avec son énergie, ses machines » se lit comme si les médicaments étaient produits au moyen de l'énergie et des machines ; la source énumère des productions parallèles.
- Enfant : ok.
- Neutralité, titre : ok. Sous-thème gouvernance-sante : acceptable.
- Corrections proposées :
  - Résumé : « Natacha Polony veut que la France produise ses médicaments essentiels, comme son énergie, ses machines et une alimentation de qualité. »
  - Détaillé : « Le passage suit une phrase qui fixe un objectif : que la France ait retrouvé sa puissance industrielle dans dix ans. » et « Il ne donne pas d'autre chiffre. »
  - Aîné : « Ce passage suit l'objectif de retrouver la puissance industrielle dans dix ans. Le texte ne précise pas quels médicaments seraient fabriqués en France, ni avec quels moyens. »

### 16. nathalie-arthaud/sante-embauches-hopitaux : doute

- Citation : ok (`archives/nathalie-arthaud/df65b7989e57.txt`).
- Localisation : **non vérifiable** ; le passage est sur la page imprimée 10 de la brochure, la fiche dit « page 12 du PDF » (décalage possible dû à la couverture, à confirmer sur le PDF).
- Les quatre niveaux : fidèles, modalité respectée (« avance l'idée », « au conditionnel », « Selon le texte »).
- **Point 8, nature santé de la mesure : doute.** La phrase est un argument hypothétique dans une rubrique sur le partage du travail contre le chômage ; la proposition elle-même est « il faut recenser les besoins et imposer que le travail soit réparti entre tous », pour tous les secteurs. Les hôpitaux et les Ehpad n'y sont que des exemples. Le titre présente une démarche hypothétique comme une mesure santé.
- Neutralité : ok. Glossaire Ehpad : ok.
- Correction proposée : décision éditoriale sur le maintien en santé ; si elle est maintenue, titre « Idée d'une liste des embauches nécessaires, établie notamment par le personnel des hôpitaux et des Ehpad », et ajout au détaillé : « Le passage figure dans une rubrique qui demande de recenser les besoins et de répartir le travail entre tous, pour que personne ne soit au chômage. »

### 17. nicolas-dupont-aignan/sante-fin-passe-sanitaire : doute

- Citation : ok (`archives/nicolas-dupont-aignan/e3eae3f78fa1.txt`, « Quelques mesures fortes », première mesure).
- **Datation (point 8) : doute.** La page n'a pas de date visible ; ses chiffres les plus récents datent de 2017 à 2020 et une mesure vise des délais à atteindre « dès 2025 ». La fiche source indique pourtant `date_publication: 2026-11`, ce que l'extrait ne permet pas d'établir. L'aîné et le détaillé signalent honnêtement l'absence de date ; la fiche source, elle, affiche une date non étayée (à corriger dans la source, hors de ce fichier mesure).
- Détaillé : **doute**. « ni si elle concerne un dispositif en vigueur ou un dispositif futur » : plus bas, la rubrique « Nos mesures » de la même page complète la mesure par la « suppression définitive de tout passe sanitaire ou vaccinal, réintégration des soignants exclus et rétablissement de leurs trimestres de retraite perdus ».
- Résumé, enfant, aîné : ok. Glossaire passe sanitaire : exact et neutre (« était » : le dispositif n'existe plus, constat factuel).
- Neutralité, titre, sous-thème : ok.
- Corrections proposées :
  - Détaillé : remplacer « ni si elle concerne un dispositif en vigueur ou un dispositif futur » par « Plus bas, la même page étend la mesure à tout passe sanitaire ou vaccinal et demande la réintégration des soignants exclus. »
  - Fiche source : `date_publication` à remplacer par une valeur étayée, ou à signaler comme inconnue selon la règle du projet.

### 18. nicolas-dupont-aignan/sante-lits-etablissements : doute

- Citation : ok (deuxième mesure ; le même texte figure aussi sous « Sauver l'hôpital public »).
- **Datation : doute**, même source que la mesure 17. Le détaillé reprend « plus de 100 000 lits ont été supprimés entre 1997 et aujourd'hui » : le lecteur comprendra « jusqu'en 2026 » alors que la date de rédaction est inconnue.
- Résumé, enfant, aîné : ok, fidèles. L'enfant (« un hôpital ou une maternité ») correspond à « (hôpital, maternité…) ».
- Neutralité : ok, les chiffres sont attribués au texte. Titre, sous-thème : ok.
- Correction proposée (détaillé) : « Le texte indique que plus de 100 000 lits ont été supprimés depuis 1997, sans dater sa propre rédaction, et que rouvrir une maternité par département ramènerait au niveau de 2008. »

### 19. olivier-becht/sante-prevention : doute

- Citation : ok (`archives/olivier-becht/03c8d47ce930.txt`, section « Un nouveau modèle de prévention »).
- Résumé, détaillé, aîné : ok, fidèles ; « qu'il juge » attribue le jugement.
- Enfant : **doute (clarté)**. « Prévenir, c'est agir avant, au lieu d'en subir les conséquences. » : le pronom « en » ne renvoie à rien dans le texte enfant ; un enfant ne comprend pas de quelles conséquences il s'agit. Glossaire prévention et addiction : ok.
- Neutralité : ok, « enfin » n'est pas repris. Titre, sous-thème : ok.
- Correction proposée (enfant, deuxième phrase) : « Prévenir, c'est agir avant que les problèmes de santé arrivent. »

### 20. olivier-becht/sante-secretariat-etat-sante-publique : doute

- Citation : ok (section « Une priorité régalienne »).
- Résumé, détaillé, aîné : ok. Le mot interdit « enfin » de la source n'est repris dans aucun niveau. L'aîné explique « régalienne » correctement.
- Détaillé : nuance mineure, « Il propose une organisation centrée sur l'humain » pour « Cela suppose une organisation... » ; acceptable.
- Enfant : **doute (lisibilité, avertissement du validateur)**. Le texte est fidèle, mais il enchaîne des termes abstraits (« contrat d'objectifs », « disperser les responsabilités ») et « les cinq grandes agences » sans dire qu'elles existent déjà. Glossaire secrétariat d'État : exact et neutre.
- Correction proposée (enfant, environ 45 mots, phrases de 15 mots au plus) : « Olivier Becht veut que la santé devienne une priorité de l'État. Il veut créer un [[secrétariat d'État|secretariat-d-etat]] à la santé publique. Ce service regrouperait cinq grandes agences qui existent déjà. Elles suivraient les mêmes objectifs. Ainsi, chacun saurait mieux qui est responsable de quoi. »

### 21. raphael-glucksmann/sante-plan-prevention : conforme

- Citation : ok (`archives/raphael-glucksmann/56f3d747f045.txt`, chantier 24 « Miser sur la prévention », première proposition ; page 52 du PDF cohérente avec le décalage de +1 observé sur les numéros imprimés).
- Les quatre niveaux : ok ; « enfin » n'est pas repris. Les autres propositions du chantier (fonds territorial, maladies chroniques) sont des propositions distinctes, donc la phrase « ne précise ni le montant du plan, ni les actions » reste exacte pour cette proposition.
- Attribution : ok (projet de Place publique, « parti de Raphaël Glucksmann »).
- Glossaire prévention, assurance maladie : ok. Titre, sous-thème : ok.

### 22. raphael-glucksmann/sante-projet-territorial-sante : doute

- Citation : ok (chantier 23 « Bien soigner, partout ! », page 50 du PDF cohérente).
- Résumé, détaillé, aîné : ok, fidèles.
- Enfant : **doute (lisibilité, avertissement du validateur)**. Sens fidèle, mais « usagers » est opaque pour un enfant et « les hôpitaux » sont omis de la liste des co-auteurs.
- Neutralité, titre, sous-thème (gouvernance-sante) : ok.
- Correction proposée (enfant, environ 48 mots) : « Raphaël Glucksmann et son parti veulent organiser la santé près des habitants. Chaque territoire aurait son projet de santé. Les soignants, les hôpitaux, les élus, les patients et l'État l'écriraient ensemble. Ce projet dirait ce qui compte le plus pour les habitants. Le texte ne dit pas combien cela coûterait. »

### 23. selma-labib/sante-besoins-embauches-hopitaux : doute

- Citation : ok (`archives/selma-labib/cbc9fde9cabc.txt`, rubrique « Imposer l'interdiction des licenciements et des embauches massives »).
- Attribution : ok (« nous » du document du NPA-Révolutionnaires, parti revendiqué par la candidate ; « travailleurs » rend bien ce « nous »).
- **Point 8, nature santé : doute**, comme pour la mesure 16 : revendication générale sur l'emploi (« Dans chaque atelier, dans tous les services... »), où les hôpitaux ne sont qu'un lieu parmi d'autres.
- Détaillé, enfant, aîné : **doute** sur « ni qui les financerait », « Il ne dit pas qui paierait ces embauches », « ne dit pas comment elles seraient financées ». La rubrique voisine, « Se donner les moyens de prendre sur les profits », écrit qu'« Imposer ces mesures, cela suppose de ne pas avoir peur de s'en prendre aux profits des multinationales ». Cela ne dit pas qui paierait les postes hospitaliers publics, mais le texte n'est pas muet sur les moyens.
- Neutralité, titre : ok.
- Corrections proposées :
  - Détaillé, dernière phrase : « Il ne précise pas le nombre d'embauches pour les hôpitaux. Le document lie ses mesures à une prise sur les profits des multinationales, sans détailler le financement des postes hospitaliers. »
  - Enfant, dernière phrase : « Le texte ne donne pas le nombre d'embauches. »
  - Aîné, dernière phrase : « Le document ne donne aucun nombre d'embauches pour les hôpitaux ; il lie ses mesures à une prise sur les profits des multinationales, sans détailler le financement. »

## Données pour script

```json
[
  { "cible": "mesure:francis-lalanne/sante-fin-pass-obligations-medicales", "verdict": "doute", "niveaux": [], "motif": "source_localisation : quatrième point de l'axe 3 Liberté !, pas le cinquième" },
  { "cible": "mesure:francois-ruffin/sante-pole-public-medicament", "verdict": "doute", "niveaux": ["detaille", "aine"], "motif": "sous-thème hopital-et-soignants inadapté (proposer gouvernance-sante) ; « ne précise pas les médicaments » alors que la suite cite les médicaments essentiels à brevet public et une gouvernance mixte" },
  { "cible": "mesure:francois-ruffin/sante-sante-scolaire-service-unifie", "verdict": "conforme", "niveaux": [], "motif": "fidèle aux quatre niveaux, citation et localisation vérifiées" },
  { "cible": "mesure:gabriel-attal/sante-depistage-pfas", "verdict": "conforme", "niveaux": [], "motif": "fidèle aux quatre niveaux, glossaire PFAS exact" },
  { "cible": "mesure:gabriel-attal/sante-droit-climatisation", "verdict": "erreur", "niveaux": ["detaille", "aine", "enfant"], "motif": "détaillé et aîné affirment l'absence de date alors que la page dit « dès l'été prochain » ; l'enfant élargit les contraintes patrimoniales à toutes les règles sur les logements anciens" },
  { "cible": "mesure:jean-francois-legendre/sante-analyser-arrets-maladie", "verdict": "erreur", "niveaux": ["detaille"], "motif": "détaillé dit que le texte ne chiffre pas le coût des arrêts ; le texte donne 9 millions d'arrêts et 14 milliards en 2025 ; localisation imprécise (partie La fiscalité)" },
  { "cible": "mesure:jean-francois-legendre/sante-preserver-prise-en-charge", "verdict": "erreur", "niveaux": ["detaille", "enfant", "aine"], "motif": "détaillé dit « ni s'il serait modifié » alors que la même partie prévoit moins de remboursements ; l'enfant présente la description du candidat comme un fait non attribué" },
  { "cible": "mesure:jean-luc-melenchon/sante-budget-hopitaux-postes-soignants", "verdict": "erreur", "niveaux": ["detaille", "enfant", "aine"], "motif": "les niveaux affirment l'absence de calendrier et de financement ; le document présente ses orientations budgétaires pour 2027 financées par les recettes prises sur les plus riches" },
  { "cible": "mesure:jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad", "verdict": "doute", "niveaux": ["resume", "detaille", "aine"], "motif": "le résumé omet « contre les incendies » ; « ni le calendrier » à nuancer (document pour 2027, 10 milliards dès 2026 pour l'adaptation)" },
  { "cible": "mesure:juan-branco/sante-plan-urgence-deserts-medicaux", "verdict": "conforme", "niveaux": [], "motif": "fidèle, attribution à Les Ruches exacte" },
  { "cible": "mesure:juan-branco/sante-politique-unique-deserts-medicaux", "verdict": "conforme", "niveaux": [], "motif": "fidèle aux quatre niveaux" },
  { "cible": "mesure:karim-bouamrane/sante-soins-deserts-medicaux", "verdict": "conforme", "niveaux": [], "motif": "fidèle ; objectif de manifeste, modalité acceptable" },
  { "cible": "mesure:marine-tondelier/sante-activite-physique-adaptee", "verdict": "conforme", "niveaux": [], "motif": "fidèle aux quatre niveaux, glossaire exact" },
  { "cible": "mesure:marine-tondelier/sante-prevention-priorites", "verdict": "doute", "niveaux": ["detaille"], "motif": "le détaillé dit que le texte ne donne pas de mesures précises alors que la même proposition donne des exemples" },
  { "cible": "mesure:natacha-polony/sante-medicaments-essentiels-production", "verdict": "doute", "niveaux": ["resume", "detaille", "aine"], "motif": "l'horizon « dans dix ans » de la phrase précédente est omis (« aucun chiffre », « ni calendrier ») ; « avec » ambigu dans le résumé" },
  { "cible": "mesure:nathalie-arthaud/sante-embauches-hopitaux", "verdict": "doute", "niveaux": ["detaille"], "motif": "argument hypothétique d'une proposition générale de partage du travail, classé comme mesure santé ; page 12 du PDF non vérifiable (page imprimée 10)" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-fin-passe-sanitaire", "verdict": "doute", "niveaux": ["detaille"], "motif": "page non datée, date de publication 2026-11 de la fiche source non étayée ; la même page étend la mesure à tout passe sanitaire ou vaccinal" },
  { "cible": "mesure:nicolas-dupont-aignan/sante-lits-etablissements", "verdict": "doute", "niveaux": ["detaille"], "motif": "page non datée ; « entre 1997 et aujourd'hui » repris sans réserve" },
  { "cible": "mesure:olivier-becht/sante-prevention", "verdict": "doute", "niveaux": ["enfant"], "motif": "phrase enfant « au lieu d'en subir les conséquences » sans antécédent, peu claire" },
  { "cible": "mesure:olivier-becht/sante-secretariat-etat-sante-publique", "verdict": "doute", "niveaux": ["enfant"], "motif": "lisibilité enfant (avertissement validateur), reformulation proposée" },
  { "cible": "mesure:raphael-glucksmann/sante-plan-prevention", "verdict": "conforme", "niveaux": [], "motif": "fidèle aux quatre niveaux, mot interdit de la source non repris" },
  { "cible": "mesure:raphael-glucksmann/sante-projet-territorial-sante", "verdict": "doute", "niveaux": ["enfant"], "motif": "lisibilité enfant (avertissement validateur) : « usagers » opaque, hôpitaux omis ; reformulation proposée" },
  { "cible": "mesure:selma-labib/sante-besoins-embauches-hopitaux", "verdict": "doute", "niveaux": ["detaille", "enfant", "aine"], "motif": "revendication générale sur l'emploi classée en santé ; « ne dit pas qui paierait » à nuancer (le document dit prendre sur les profits)" }
]
```
