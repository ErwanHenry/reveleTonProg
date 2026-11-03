
# Cahier des charges : site pédagogique présidentielle 2027
2026-11-03 · 
## 1. Contexte et objectif
Le site aide tout public à comprendre les programmes des candidats à la présidentielle des 18 avril et 2 mai 2027, sans prendre parti, avec quatre niveaux de lecture d'une même mesure et des sondages présentés avec leur marge d'erreur. Nom de travail : « reveleTonProg » (dépôt GitHub ErwanHenry/reveleTonProg). Claude Code livre un site statique complet, son pipeline de mise à jour et sa documentation de maintenance, à partir de ce document.
Ce que le site n'est pas : pas un média d'opinion, pas un prédicteur de résultat, pas un outil de profilage politique des visiteurs. Toute mesure affichée renvoie à une source primaire datée ; toute donnée de sondage renvoie à sa notice déposée à la Commission des sondages.
Ce que le visiteur doit pouvoir faire en moins de 3 minutes : choisir un thème, lire la position de chaque candidat au niveau de détail qui lui convient (résumé, détaillé, enfant, aîné), et comprendre pourquoi un sondage n'est pas un résultat.
## 2. Décisions de cadrage validées
Quatre décisions prises le 3 novembre 2026 cadrent le projet ; Claude Code ne les remet pas en question.
 | 
Sujet | 
Décision | 
Conséquence pour la réalisation
 | 
Porteur et domaine | 
Nouveau nom de domaine dédié (à acheter), site non rattaché à Alignd ni à SpikeeLabs, mention légale au nom d'Erwan Henry | 
Page « Qui sommes-nous » neutre, sans branding tiers ; domaine à acheter avant le lot 3 (open question : le nom)
 | 
Hébergement | 
VPS Hetzner existant (ubuntu-4gb-nbg1-2, Caddy déjà en place) | 
Site statique servi par Caddy, empreinte mémoire quasi nulle ; pas de nouveau conteneur permanent (RAM saturée en juillet 2026, disque à 90 %)
 | 
Rythme de mise à jour | 
Quotidien dès l'ouverture, bi-quotidien du 18 mars au 17 avril 2027 et entre les deux tours | 
Collecte automatisée avec publication par paliers (voir section 9) ; relecture humaine quotidienne de 15 à 30 minutes
 | 
Périmètre candidats | 
Toutes les personnalités du jeu de données data.gouv « statuts sourcés », chacune avec son statut (déclarée, en primaire, pressentie, retirée, empêchée) | 
Aucun tri éditorial ; un candidat sans programme publié a une fiche avec la mention « programme non publié à ce jour »
Une cinquième décision est prise par Claude (ambiguïté technique tranchée) : pas de base de données ni de compte utilisateur, tout le contenu vit dans un dépôt Git et le jeu tourne en local dans le navigateur.
## 3. Publics et niveaux de lecture
Chaque mesure existe en quatre rédactions, toutes dérivées du même texte source et validées ensemble. Le visiteur choisit sa « paire de lunettes » une fois, le choix est mémorisé localement (localStorage) et modifiable à tout moment.
 | 
Niveau | 
Public visé | 
Longueur | 
Règles de rédaction
 | 
Résumé | 
Pressé, premier contact | 
1 phrase, 25 mots max | 
Verbe d'action, pas de jugement, chiffre clé si le candidat en donne un
 | 
Détaillé | 
Lecteur exigeant, étudiant, journaliste | 
80 à 200 mots | 
Coût annoncé par le candidat, calendrier, ce qui existe déjà dans la loi, citation exacte du programme entre guillemets avec lien
 | 
Enfant | 
8 à 12 ans, lecture accompagnée ou seule | 
40 à 60 mots | 
Métaphore concrète du quotidien (école, cantine, argent de poche), vocabulaire de niveau CM1, mots difficiles définis au survol, jamais de nom de parti seul sans explication
 | 
Aîné | 
Retraités et plus de 65 ans | 
60 à 120 mots | 
Effet concret sur pensions, santé, dépendance, succession, logement, pouvoir d'achat ; police plus grande par défaut ; lecture audio disponible
Le niveau Aîné porte en plus un filtre « ce qui me concerne » qui remonte en tête les thèmes retraites, santé, dépendance, succession et logement. Le niveau Enfant est accompagné d'un mode « explique-moi » : un clic sur un mot souligné ouvre une définition en une phrase.
Règle de cohérence : si une rédaction ne peut pas être produite sans ajouter une information absente du programme, elle affiche « le candidat ne précise pas » plutôt qu'une supposition.
## 4. Modules fonctionnels et critères d'acceptation
Six modules, livrés dans l'ordre du tableau. Un module est accepté quand tous ses critères passent sur le corpus pilote (3 thèmes, tous les candidats déclarés).
 | 
Module | 
Ce qu'il fait | 
Critères d'acceptation
 | 
M1 Référentiel programmes | 
Navigation par thème puis par candidat, ou par candidat puis par thème ; bascule entre les 4 niveaux sans rechargement | 
Chaque mesure affiche sa source primaire datée ; ordre des candidats alphabétique ou aléatoire selon réglage ; aucune page sans source ; temps de chargement &lt; 1 s sur 4G
 | 
M2 Sondages expliqués | 
Écran pédagogique obligatoire au premier accès, puis liste des sondages avec institut, commanditaire, dates de terrain, échantillon, marge, lien notice ; courbe de moyenne glissante étiquetée « calcul du site » | 
Un chiffre n'est jamais affiché sans sa marge sous forme d'intervalle ; blocage automatique du 17 avril 0h au 18 avril 20h et du 1er mai 0h au 2 mai 20h ; chaque sondage pointe vers sa notice commission-des-sondages.fr
 | 
M3 Compose ton programme | 
Le visiteur choisit 10 mesures présentées sans nom de candidat, puis découvre la répartition par candidat | 
Calcul 100 % local, aucune requête réseau pendant le jeu, aucun stockage serveur ; mesures tirées au hasard à chaque partie ; résultat partageable sous forme d'image générée côté client
 | 
M4 Comparateur | 
Deux à quatre candidats côte à côte sur un thème | 
Cases vides marquées « non précisé », jamais déduites ; export PDF de la comparaison
 | 
M5 Journal des modifications | 
Page publique listant chaque ajout ou correction de contenu, horodaté, avec la source | 
Généré automatiquement depuis l'historique Git ; un visiteur peut signaler une erreur par formulaire (mail vers Erwan, sans stockage)
 | 
M6 Ce qu'ils ont voté | 
Pour les candidats parlementaires, votes réels sur les textes liés à chaque thème, données 2027etmoi et Assemblée nationale | 
Livré après M1 à M5 ; chaque vote lié à son scrutin officiel ; absence et non-participation distinguées
Hors périmètre de la version 1 : commentaires des visiteurs, comptes, newsletter, application mobile native, version anglaise.
## 5. Règles éditoriales de neutralité et de sourçage
Ces règles s'appliquent à tout contenu, qu'il soit écrit par un humain ou proposé par un agent. Elles sont aussi le référentiel du test croisé (section 12).
Une mesure n'entre dans le référentiel que si elle est rattachée à une source primaire : programme officiel, site du candidat ou de son parti, discours ou tribune publiés par le candidat, dépôt officiel au Conseil constitutionnel. Un article de presse n'est jamais la source d'une mesure, seulement un indice pour aller chercher la source.
Chaque source porte une date de consultation et une copie archivée (capture HTML ou PDF stockée dans le dépôt) pour résister aux modifications de sites de campagne.
Vocabulaire neutre : les quatre rédactions décrivent ce que le candidat propose, jamais si c'est bien ou mal, réaliste ou non. Les mots interdits dans les textes du site : « extrême », « populiste », « irresponsable », « courageux », « enfin », et toute étiquette non revendiquée par le candidat lui-même. L'étiquette affichée est celle que le candidat ou son parti utilise.
Le chiffrage affiché est celui du candidat. Un chiffrage tiers (Institut Montaigne, Cour des comptes, etc.) peut être cité en complément, nommé comme tel, jamais substitué.
L'ordre des candidats est alphabétique par défaut, aléatoire sur demande, jamais par score de sondage. Pendant la campagne officielle, l'ordre du Conseil constitutionnel devient une option.
Les candidats sont traités au même niveau de détail : un thème publié pour un candidat impose de vérifier et compléter la case de tous les autres candidats déclarés sur ce thème avant publication.
Un contenu proposé par un agent n'est publié qu'après relecture humaine, sauf les données structurées de sondages (voir section 9) qui portent alors un badge « non relu » visible.
Toute correction est tracée dans le journal public (M5) avec la raison et la source.
Le site ne collecte aucune donnée personnelle, ne pose aucun cookie tiers, n'embarque aucun script de mesure externe. La fréquentation est lue dans les logs Caddy anonymisés.
Mentions légales et page « Méthode » publiques dès l'ouverture : qui édite, comment les sources sont choisies, comment signaler une erreur.
## 6. Règles d'affichage des sondages
Le cadre légal (loi du 19 juillet 1977, Commission des sondages) impose les mentions ; le site va plus loin pour que le visiteur comprenne ce qu'il lit.
Mentions obligatoires sur chaque sondage affiché, lues depuis la notice déposée : organisme, commanditaire, dates de terrain, taille de l'échantillon, méthode (en ligne ou téléphone), base (inscrits, certains d'aller voter), marges d'erreur, lien vers la notice sur commission-des-sondages.fr. Un sondage dont la notice est introuvable n'est pas affiché.
Pédagogie imposée avant tout chiffre (écran M2, affiché une fois puis accessible en permanence) :
Le chiffre est dessiné comme une barre d'intervalle, pas comme un point : « entre 24 et 30 % » avant « 27 % ».
Une animation « 1 000 autres personnes » tire plusieurs échantillons fictifs pour montrer la dispersion naturelle.
Un rappel des écarts entre derniers sondages et résultat réel au premier tour 2017 et 2022, à partir des résultats officiels du ministère de l'Intérieur et des notices de l'époque.
La phrase de la Commission, reprise telle quelle : les intentions de vote mesurent un rapport de force à un moment donné et ne sont pas prédictives.
Hypothèses : un sondage teste souvent plusieurs configurations de candidats. Le site affiche l'hypothèse telle que nommée par l'institut et ne fusionne jamais deux hypothèses.
Moyenne glissante : calculée sur les sondages des 30 derniers jours, par hypothèse comparable, pondérée par la taille d'échantillon, étiquetée « calcul du site, à titre indicatif ». La formule est publiée sur la page Méthode. Pas de projection en sièges ni de probabilité de victoire.
Blocage légal : du samedi 17 avril 2027 0h au dimanche 18 avril 20h, puis du samedi 1er mai 0h au dimanche 2 mai 20h, la page sondages affiche uniquement un texte expliquant l'interdiction et renvoie vers les résultats officiels après 20h. Le blocage est codé en dur sur ces dates et testé.
Second tour : les hypothèses de second tour sont affichées dans un onglet séparé, avec la même pédagogie, jamais en page d'accueil.
## 7. Modèle de données
Cinq collections de fichiers dans le dépôt Git, en YAML ou JSON, validées par un schéma à chaque commit (CI). Pas de base de données.
 | 
Collection | 
Un fichier par | 
Champs principaux
 | 
candidats | 
candidat | 
id, nom, prénom, parti ou mouvement (tel que revendiqué), statut (déclaré, en primaire, pressenti, retiré, empêché), date du statut, source du statut, site officiel, photo libre de droits ou absente, mandats en cours
 | 
themes | 
thème | 
id, nom, ordre d'affichage, mots-clés, sous-thèmes, liste des thèmes prioritaires pour le niveau Aîné
 | 
mesures | 
mesure | 
id, candidat, thème, sous-thème, titre neutre, texte source cité, source (url, date de consultation, fichier archivé), rédactions (résumé, détaillé, enfant, aîné), chiffrage du candidat, statut de relecture (brouillon, relu, publié), relecteur, date
 | 
sondages | 
sondage | 
id, institut, commanditaire, dates de terrain, date de publication, échantillon, méthode, base, marges, url de la notice, url de publication, hypothèses (liste), chaque hypothèse avec candidats et scores, tour (1 ou 2), statut de relecture
 | 
journal | 
généré | 
date, type (ajout, correction, retrait), collection, id, résumé, source, auteur
Contraintes :
Un id de candidat ne change jamais, même si le statut change ; un candidat retiré reste dans la base avec son historique.
Une mesure sans source valide est rejetée par la CI.
Un sondage sans url de notice est rejeté par la CI.
Les rédactions enfant et aîné sont optionnelles en brouillon, obligatoires pour passer au statut publié.
Le schéma est versionné ; un changement de schéma passe par une migration scriptée.
## 8. Architecture technique et hébergement
Site statique généré par Astro, servi par le Caddy déjà installé sur le VPS Hetzner ; le contenu et le code vivent dans un dépôt GitHub, et le déploiement est un simple rsync des fichiers construits.
La collecte ne touche jamais le site directement : elle ouvre des brouillons dans Git, la relecture les valide, l'intégration continue construit et déploie.
Choix techniques imposés à Claude Code :
Générateur : Astro (contenu Markdown et YAML natifs, zéro JavaScript par défaut, îlots interactifs pour M2 et M3). Pas de framework serveur.
Dépôt : GitHub, compte ErwanHenry, dépôt privé jusqu'à l'ouverture puis public (le code et les données ouverts font partie de la crédibilité).
Construction : GitHub Actions valide le schéma (JSON Schema), construit le site et le pousse sur le VPS par rsync via SSH. Le VPS ne construit rien lui-même.
Serveur : Caddy, bloc de site dédié au nouveau domaine, HTTPS automatique, compression, cache long sur les assets, cache court (5 min) sur les pages sondages.
Collecte : un script Node ou Python lancé par cron sur le VPS, une fois par jour puis deux fois en phase finale, qui lit les notices de la Commission et les flux des instituts, et ouvre une pull request par nouveauté. Durée cible inférieure à 2 minutes, mémoire inférieure à 200 Mo, aucun processus résident.
Audio : fichiers générés à la construction (synthèse vocale) et servis en statique, pas de synthèse à la volée.
Images des candidats : uniquement libres de droits (Wikimedia Commons avec licence vérifiée) ou absentes ; aucune photo de presse.
Contrainte VPS à traiter avant le lot 3 : en juillet 2026 la machine (3,7 Go de RAM) était saturée et le disque à 90 %. Le site statique n'ajoute presque rien, mais la collecte et les archives de sources demandent de libérer de l'espace ou de monter l'instance. Décision attendue d'Erwan au lot 2.
## 9. Pipeline de mise à jour et relecture
Le rythme quotidien, puis bi-quotidien, n'est tenable qu'avec une publication par paliers : les données structurées de sondages passent avec contrôles automatiques et badge « non relu », les textes de programmes attendent toujours une relecture humaine.
 | 
Palier | 
Contenu | 
Contrôles automatiques | 
Relecture humaine | 
Publication
 | 
A | 
Nouveau sondage (données chiffrées) | 
Notice trouvée sur commission-des-sondages.fr, institut connu, dates cohérentes, somme des scores entre 95 et 105 %, hypothèse rattachée à des candidats existants | 
Dans les 24 h, le badge « non relu » disparaît à la validation | 
Automatique dès que les contrôles passent
 | 
B | 
Changement de statut d'un candidat | 
Source datée obligatoire | 
Obligatoire avant publication | 
Après validation
 | 
C | 
Nouvelle mesure ou modification d'une mesure (4 rédactions) | 
Schéma, source archivée, mots interdits, longueurs | 
Obligatoire, avec contrôle croisé par un agent qui relit la rédaction enfant contre le texte source | 
Après validation
 | 
D | 
Correction signalée par un visiteur | 
Aucun | 
Obligatoire | 
Après validation, tracée au journal
Cadence de la collecte (tâche cron sur le VPS, journal dans le dépôt) :
Du lancement au 17 mars 2027 : une passe à 6 h 30, pull requests prêtes pour une relecture entre 8 h et 8 h 30.
Du 18 mars au 17 avril 2027, puis du 19 avril au 30 avril : deux passes, 6 h 30 et 18 h 30.
Relecture : 15 à 30 minutes par passe, assurée par Erwan ; un second relecteur est recommandé en phase finale (open question : qui).
La relecture elle-même est une tâche planifiée qui rappelle à Erwan les brouillons en attente, conformément à sa règle de suivi des actions. Un brouillon de palier A non relu après 48 h déclenche une alerte ; un brouillon de palier C non relu après 5 jours est fermé et réouvert à la passe suivante.
Ce que le pipeline ne fait jamais : rédiger lui-même une rédaction enfant ou aîné sans la soumettre à relecture, modifier un score de sondage, ou publier pendant les fenêtres de blocage légal.
## 10. Expérience sensorielle, jeu et accessibilité
Le sensoriel porte le sens ou n'existe pas : chaque effet doit aider à situer le thème ou à comprendre une mesure, sinon il est retiré.
Parcours : le site est une suite de « pièces », une par thème (logement, école, retraites, santé, sécurité, climat, travail, impôts, Europe et monde, institutions). On entre par un hall qui présente les 4 niveaux de lecture et le choix des lunettes. Chaque pièce a sa couleur dominante, son ambiance sonore courte (bruit de cour d'école, de marché, de salle d'attente) jouée uniquement si le visiteur active le son, et une transition lente entre les pièces.
Lecture audio : les rédactions enfant et aîné existent en version audio, générées à la construction, avec un bouton lecture visible dès la première mesure. La voix est neutre et la même pour tous les candidats.
Jeu « Compose ton programme » (M3) : 10 mesures tirées au hasard dans 10 thèmes différents, présentées sans nom ni parti, le visiteur garde ou écarte chacune. À la fin, une image générée côté client montre la répartition des mesures gardées par candidat, avec la mention « jeu, pas un test d'affinité politique ». Aucune donnée ne quitte le navigateur. Pas de score, pas de classement, pas de partage automatique sur les réseaux.
Accessibilité, exigences testées : contraste AA minimum, navigation au clavier complète, mode « très gros texte » (160 %), lecteur d'écran compatible (ARIA sur les bascules de niveau), animations désactivées si le système le demande, poids d'une page inférieur à 500 Ko hors audio, fonctionnement sans JavaScript pour M1 et M4.
Ton visuel : sobre, typographie lisible, pas de couleur associée à un parti dans la charte du site (les couleurs servent les thèmes, jamais les candidats).
## 11. Plan de réalisation par lots pour Claude Code
Sept lots, chacun livrable et testable seul, dans l'ordre. Modèle recommandé par lot : Sonnet pour les lots 1, 3, 4 et 7 ; Opus pour les lots 2, 5 et 6. Chaque lot se termine par le test croisé de la section 12 et une démonstration à Erwan.
Lot 1, squelette et données : dépôt, schémas JSON, 3 thèmes et tous les candidats déclarés avec statut et source, CI de validation. Livrable : la CI refuse une mesure sans source.
Lot 2, référentiel et 4 niveaux (M1) : pages thème et candidat, bascule de niveau, ordre alphabétique ou aléatoire, page Méthode et mentions légales. Livrable : corpus pilote navigable sur une URL de test.
Lot 3, hébergement : bloc Caddy du nouveau domaine, déploiement rsync depuis GitHub Actions, HTTPS, vérification de la charge mémoire du VPS. Livrable : site pilote en ligne sur le domaine.
Lot 4, sondages (M2) : collecte des notices, écran pédagogique, affichage par sondage avec intervalle, moyenne glissante, blocage légal codé et testé. Livrable : 10 sondages réels affichés avec leur notice.
Lot 5, pipeline quotidien (section 9) : cron, pull requests automatiques, paliers A à D, tâche de rappel de relecture, journal public (M5). Livrable : une semaine de fonctionnement sans intervention manuelle hors relecture.
Lot 6, expérience : pièces par thème, audio, jeu Compose ton programme (M3), comparateur (M4), accessibilité. Livrable : audit d'accessibilité passé.
Lot 7, extension : votes réels (M6), montée en cadence bi-quotidienne, second relecteur, plan de charge pour la campagne officielle.
Jalons de calendrier : lots 1 à 3 avant le 15 décembre 2026, lots 4 et 5 avant le 31 janvier 2027, lot 6 avant le 28 février 2027, lot 7 avant le 18 mars 2027 (début de la phase bi-quotidienne). La liste officielle des candidats du Conseil constitutionnel, attendue fin mars 2027, est intégrée par un simple changement de statut.
Règles de travail pour Claude Code : une pull request par lot, tests automatisés sur chaque règle de la section 5 et de la section 6, pas de dépendance ajoutée sans justification écrite dans la pull request, pas de secret dans le dépôt (clés SSH et tokens dans GitHub Secrets uniquement).
## 12. Test croisé, critères de succès et coût
Aucun lot n'est livré sans test croisé : la charte (sections 5 et 6) et le site sont testés ensemble par un agent simulé qui joue trois visiteurs (un enfant de 10 ans, un retraité de 72 ans, un journaliste), avec des données fictives piégées et un journal d'audit.
Données piégées à injecter à chaque test : une mesure sans source, une mesure avec un mot interdit, un sondage sans notice, un sondage dont les scores font 112 %, une hypothèse de second tour glissée dans le premier tour, une rédaction enfant qui ajoute un chiffre absent du programme, et une date de publication dans la fenêtre de blocage légal. Le test réussit si chaque piège est rejeté ou signalé avant publication.
 | 
Critère de succès | 
Mesure | 
Seuil
 | 
Sourçage | 
Part des mesures publiées avec source primaire archivée | 
100 %
 | 
Équité | 
Écart de nombre de mesures entre candidats déclarés sur un même thème publié | 
0 case vide non marquée « non précisé »
 | 
Sondages | 
Part des sondages affichés avec notice liée et intervalle de marge | 
100 %
 | 
Blocage légal | 
Test automatisé des deux fenêtres | 
Passe
 | 
Lisibilité enfant | 
Score de lisibilité (indice de Flesch adapté au français) sur les rédactions enfant | 
Niveau CM1 ou plus facile
 | 
Performance | 
Poids de page et temps de chargement sur 4G simulée | 
&lt; 500 Ko, &lt; 1 s
 | 
Accessibilité | 
Audit automatisé plus parcours clavier manuel | 
0 erreur bloquante
 | 
Tenue du rythme | 
Brouillons relus dans les 24 h sur une semaine test | 
90 %
Signaux d'échec et action corrective : une mesure publiée sans source est retirée dans l'heure et tracée au journal ; un sondage contesté par la Commission est retiré et la mise au point affichée ; une semaine avec moins de 60 % de brouillons relus déclenche la recherche d'un second relecteur ou la réduction à un palier A seul automatique.
Coût estimé : domaine 10 à 15 € par an ; hébergement 0 € de plus sur le VPS existant, ou environ 10 € par mois de plus si l'instance est montée en gamme ; collecte et contrôles agentiques de l'ordre de 5 à 15 € par mois de tokens en rythme quotidien, le double en phase bi-quotidienne. Piste de réduction : exécuter les contrôles de palier A sans modèle (règles pures) et réserver le modèle aux rédactions.
## 13. Sources vérifiées le 3 novembre 2026
 | 
Source | 
Usage dans le projet | 
Fiabilité
 | 
info.gouv.fr, dates et informations clés | 
Dates des deux tours (18 avril et 2 mai 2027) | 
Officielle
 | 
vie-publique.fr, règles des sondages | 
Cadre légal, fenêtre d'interdiction, règle du 15 avril 2026 | 
Officielle
 | 
Commission des sondages | 
Notices de chaque sondage, mentions obligatoires, marges | 
Officielle, source primaire des sondages
 | 
Conseil constitutionnel | 
Liste officielle des candidats (fin mars 2027) | 
Officielle
 | 
data.gouv.fr, candidatures 2027 statuts sourcés | 
Liste de départ des candidats et statuts | 
Citoyenne, à recouper avec la source datée de chaque ligne
 | 
data.gouv.fr, Repère 2027 | 
Historique de sondages pour amorcer M2 | 
Association indépendante, à recouper avec les notices
 | 
data.gouv.fr, 2027etmoi | 
Votes réels des parlementaires (M6), code ouvert sur GitHub | 
Citoyenne, réutilise des données officielles
 | 
Public Sénat, candidats déclarés | 
Indice pour les statuts, jamais source d'une mesure | 
Presse
 | 
Elabe, étude du 29 août 2026 | 
Exemple de format d'institut pour la collecte | 
Institut
 | 
votons-2027.fr | 
Référence de bonne pratique (fenêtre glissante, lien aux sources primaires), pas une source | 
Agrégateur indépendant
 | 
Ministère de l'Intérieur, résultats | 
Résultats 2017 et 2022 pour la pédagogie sondages | 
Officielle
Écartée : elyseescope.com (contenu générique non sourcé).