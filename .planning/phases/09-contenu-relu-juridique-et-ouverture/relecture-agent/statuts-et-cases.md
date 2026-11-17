# Relecture par un agent : statuts de candidature et cases de couverture santé

Date : 2026-11-17
Relecteur : Claude (modèle Sonnet 5.5), agent indépendant, lecture seule sur le dépôt.

## Méthode

1. Liste des cibles lue avec `npm run relecture -- liste --theme sante --format json` : 37 statuts et 37 cases.
2. Statuts : chaque fiche `src/content/candidats/<id>.yaml` comparée à la ligne de l'instantané `data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json` (code, date, URL de source, étiquette). La commande `npm run -s import:datagouv -- --check` répond « 0 écart » : les 37 fiches sont conformes à l'instantané. Chaque URL de source a ensuite été ouverte le 2026-11-17 pour vérifier qu'elle soutient « cette personne a déclaré sa candidature à la présidentielle 2027 à cette date ». La page Méthode dit qu'un statut peut citer la presse et qu'une personne « pressentie » est citée sans s'être déclarée elle-même : j'ai retenu cette définition.
3. Cases : état de chaque case comparé aux fichiers `src/content/mesures/<id>/sante-*.yaml`, aux sources de `src/content/sources/` et aux extraits sous `archives/<id>/` (recherche du vocabulaire de santé dans les trois cases `non_precise`), aux dates de consultation, puis relecture en direct des URL listées dans `data/couverture-themes.yaml` pour les cases `programme_non_publie`.
4. Verdicts : `conforme` seulement si tous les points ont été vérifiés. Une source inaccessible, une date non établie ou une déclaration non formelle donne `doute`.

## Limites

- Relecture d'un modèle, pas d'un humain. Pages vues le 2026-11-17 seulement : elles peuvent avoir changé depuis la date de consultation du dépôt.
- L'outil de lecture web résume les pages ; je ne cite que de courts passages. Certaines pages n'ont pas pu être ouvertes (voir ci-dessous). Je n'ai pas contourné ces blocages.
- Pages non ouvertes : cnews.fr (Bouamrane, HTTP 403), 20minutes.fr (Durif, refus de l'outil), rmc.bfmtv.com (Mathieu et Mlekuz, refus de l'outil), annuaire-entreprises.data.gouv.fr (Dubuisson, page reçue vide), rassemblementnational.fr (redirection 307, rien lu), parti-animaliste.fr (HTTP 403). L'URL Orange/AFP de Ruffin répond mais n'affiche plus l'article.
- Les recherches web faites en complément ne donnent que des suggestions, jamais un fait à écrire.
- François Asselineau : statut déjà relu par Erwan le 2026-11-17, vérifié ici comme les autres.

## Tableau des 37 statuts

| Candidat | Code | Date | Source (type) | Accessible | Verdict | Raison |
|---|---|---|---|---|---|---|
| Nathalie Arthaud | declare | 2025-12-08 | franceinfo, presse | oui | conforme | Article du 2025-12-08 : Lutte ouvrière sera présente, la porte-parole annonce sa candidature. |
| François Asselineau (déjà relu par Erwan) | declare | 2026-07-07 | UPR, parti | oui | conforme | Déjà relu par Erwan. Page UPR du 2026-07-07 : candidature confirmée, étiquette sourcée sur le site du parti. |
| Gabriel Attal | declare | 2026-05-22 | LCP, presse | oui | conforme | Article du 2026-05-22 : il a officialisé sa candidature. |
| Delphine Batho | declare | 2025-11-25 | Site de campagne, candidat | oui | doute | Le site la présente « Candidate à l'élection présidentielle » mais n'affiche aucune date : la date 2025-11-25 n'est pas vérifiable. |
| Olivier Becht | declare | 2026-09-24 | ICI Alsace, presse | oui | conforme | Annonce à Rixheim le 2026-09-24, article du même jour ; la page le dit « apparenté Renaissance », la fiche n'affiche pas d'étiquette. |
| Xavier Bertrand | declare | 2026-08-27 | franceinfo, presse | oui | doute | L'article du 2026-08-27 le dit « futur candidat » : il répond « Je le serai » et précise « Quand je me déclarerai ». Intention, pas déclaration formelle. |
| Augustin Billetdoux | declare | 2026-10-22 | franceinfo (liste de candidats), presse | oui | doute | Page de recensement, pas de déclaration : la date 2026-10-22 est celle de la liste, la déclaration date de septembre 2025 selon la page ; le titre cité (34 candidats au 22 octobre) ne correspond plus (38 au 17 novembre). |
| Karim Bouamrane | declare | 2026-08-26 | CNews, presse | non | doute | Page non lisible (403). Son titre porte sur le refus de la primaire PS, pas sur une déclaration. Une recherche suggère une annonce le 2026-06-09 (franceinfo). |
| Juan Branco | declare | 2025-12-19 | Sud Radio, presse | oui | conforme | Article du 2025-12-19 : il se présente à la présidentielle 2027. Étiquette sourcée sur ruches.org. |
| Bernard Cazeneuve | declare | 2026-04-29 | Europe 1, presse | oui | doute | Annonce dans un entretien au Figaro du 2026-04-28, l'article est du 04-29 ; l'instantané note que ICI et LCP relèvent qu'il ne s'est pas formellement déclaré. |
| Christian Collovati | declare | 2026-10-22 | franceinfo (liste de candidats), presse | oui | doute | Page de recensement : la date 2026-10-22 est celle de la liste, pas celle de la déclaration ; titre cité obsolète (38 candidats au 17 novembre). |
| Emmanuel Dubuisson | declare | 2026-10-08 | Annuaire des entreprises (SIRENE), institution | non | doute | Page reçue vide. Elle décrit une association de campagne, pas une déclaration ; l'association date du 2026-06-05, la fiche date 2026-10-08. Source ni candidat ni média. |
| Nicolas Dupont-Aignan | declare | 2026-09-19 | franceinfo, presse | oui | conforme | Article du 2026-09-19 : il se déclare candidat, quatrième campagne. |
| Sylvain Durif | declare | 2026-08-26 | 20 Minutes, presse | non | doute | Page non ouverte. Une recherche donne une annonce le 2026-08-23 sur les réseaux, la fiche date 2026-08-26 ; un site conteste l'attribution de la vidéo. |
| Clara Egger | declare | 2026-04-19 | Solution démocratique, parti | oui | conforme | Communiqué du parti du 2026-04-19 annonçant sa candidature. |
| Raphaël Glucksmann | declare | 2026-10-11 | LCP, presse | oui | conforme | Désigné candidat dès le 1er tour de la primaire le 2026-10-11 (« désormais candidat »). Date = désignation, pas déclaration séparée. |
| Anasse Kazib | declare | 2026-06-01 | Révolution permanente, parti | oui | doute | Page présente sa candidature (500 parrainages en cours) mais ses métadonnées donnent 2026-06-19, la fiche 2026-06-01. |
| Selma Labib | declare | 2026-06-17 | NPA-Révolutionnaires, parti | oui | conforme | Annonce du 2026-06-17 (page du 06-18) : le parti présente sa porte-parole. |
| Francis Lalanne | declare | 2026-08-19 | franceinfo, presse | oui | conforme | Article du 2026-08-19 : candidature annoncée par communiqué, mouvement « France Libre ». Communiqué daté de la veille selon la page, écart d'un jour. |
| Marine Le Pen | declare | 2026-07-07 | franceinfo, presse | oui | conforme | Article du 2026-07-07 consacré à la décision d'appel : elle y annonce sur TF1 qu'elle sera candidate. Source centrée sur la condamnation, une source dédiée serait plus nette. |
| Jean-François Legendre | declare | 2026-10-22 | franceinfo (liste de candidats), presse | oui | doute | Page de recensement : date de la liste (2026-10-22), pas de la déclaration ; titre cité obsolète. |
| David Lisnard | declare | 2026-03-31 | LCP, presse | oui | conforme | Annonce sur France 2 le 2026-03-31, « Je suis candidat » (article du 04-01). |
| Mira Markovic | declare | 2026-10-22 | franceinfo (liste de candidats), presse | oui | doute | Page de recensement : date de la liste, pas de la déclaration ; titre cité obsolète. Désignation par le parti le 2026-10-02 selon une recherche. |
| Benoît Mathieu | declare | 2026-05-03 | RMC, presse | non | doute | Page non ouverte. D'autres sources montrent un candidat en quête de parrainages parti le 30 mars ; la date 2026-05-03 est celle de l'article. |
| Jean-Luc Mélenchon | declare | 2026-05-03 | LCP, presse | oui | conforme | Annonce sur TF1 le 2026-05-03, « Oui, je suis candidat ». |
| Antoine Mikolajczak | declare | 2026-07-12 | JHM, presse locale | oui | doute | L'article dit qu'il « veut défendre les couleurs d'Équinoxe » et cherche ses parrainages ; la date du vote de désignation n'y figure pas (article du 07-12, mise à jour du 07-11). |
| Manolo Mlekuz | declare | 2026-07-03 | RMC, presse | non | doute | Page non ouverte. Des articles de mai 2026 le disent déjà candidat : la date 2026-07-03 est celle de l'article RMC. |
| Édouard Philippe | declare | 2026-09-09 | Public Sénat, presse | oui | doute | L'article du 2026-09-09 le nomme « le candidat Horizons » sans dater sa déclaration ; l'instantané dit « déclaré depuis septembre 2024 » : la date de la fiche est celle de l'article. |
| Florian Philippot | declare | 2026-05-09 | Front Populaire, presse | oui | conforme | Il « s'est à nouveau porté candidat » sur France 2 le 2026-05-09 (article du 05-11). |
| Gilles Platret | declare | 2026-10-09 | France 3 Bourgogne-Franche-Comté, presse | oui | doute | Engagement annoncé le 2026-10-08 en réunion publique ; la page note qu'il évite le mot « candidat ». Date de la fiche = date de l'article. |
| Natacha Polony | declare | 2026-10-14 | LCP, presse | oui | conforme | Article du 2026-10-14 : elle confirme sa candidature. Étiquette sourcée sur son site de campagne. |
| Bruno Retailleau | declare | 2026-04-19 | Les Républicains, parti | oui | conforme | Désignation par les adhérents le week-end du 18-19 avril 2026 (article du 04-20, la fiche date la publication du 04-19). |
| Erwan Rohou | declare | 2026-10-22 | franceinfo (liste de candidats), presse | oui | doute | Page de recensement : date de la liste, pas de la déclaration ; titre cité obsolète. |
| Fabien Roussel | declare | 2026-09-06 | LCP, presse | oui | conforme | Article du 2026-09-06 : « C'est désormais officiel », investi par le PCF. |
| François Ruffin | declare | 2026-09-16 | Orange / AFP, presse | non | doute | L'URL affiche désormais une page de rubrique sans mention de Ruffin. Une recherche donne une annonce le 2026-05-12 ; la fiche date 2026-09-16. |
| Marine Tondelier | declare | 2026-09-22 | Journal du Net, presse | oui | doute | Candidature « officiellement maintenue » (article du 2026-09-22) en attendant le référendum interne du 10 au 13 décembre ; la date de la fiche est celle de l'article. |
| Éric Zemmour | declare | 2026-09-17 | L'Avenir (AFP), presse | oui | doute | Il confirme le 2026-09-17 « je serai candidat » ; l'article précise que ce n'est pas une déclaration formelle, attendue à partir d'octobre. |

## Tableau des 37 cases de couverture santé

| Candidat | État | verifie_le | Verdict | Raison |
|---|---|---|---|---|
| Nathalie Arthaud | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| François Asselineau | programme_non_publie | 2026-11-03 | conforme | upr.fr/notre-programme relu le 2026-11-17 : programme 2027 « publié prochainement », 2012, 2017 et 2022 seulement. |
| Gabriel Attal | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Delphine Batho | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Olivier Becht | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Xavier Bertrand | programme_non_publie | 2026-11-03 | conforme | nousfrance.fr/programme relu : 8 thèmes en titres seuls, pages travail et jeunesse sans mesure ; seulement 2 des 8 pages rouvertes. |
| Augustin Billetdoux | programme_non_publie | 2026-11-03 | doute | billetdoux2027.fr n'affiche qu'un résumé de la déclaration ; le texte complet lié n'a pas été lu (/declaration répond 404). |
| Karim Bouamrane | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Juan Branco | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Bernard Cazeneuve | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Christian Collovati | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Emmanuel Dubuisson | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Nicolas Dupont-Aignan | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Sylvain Durif | programme_non_publie | 2026-11-03 | doute | elvita2027.com, absent des URL consultées, publie un programme « Zéro Défaut » en 5 thèmes ; durif2027.com redirige vers ministereducringe.com (site satirique). |
| Clara Egger | non_precise | 2026-11-03 | erreur | Contenu exact (aucune proposition de santé dans les 3 extraits) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04. |
| Raphaël Glucksmann | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Anasse Kazib | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Selma Labib | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Francis Lalanne | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Marine Le Pen | programme_non_publie | 2026-11-03 | doute | Site du RN non lisible aujourd'hui (redirection 307) : absence de programme 2027 non revérifiable ; rien ne la contredit. |
| Jean-François Legendre | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| David Lisnard | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Mira Markovic | programme_non_publie | 2026-11-03 | doute | parti-animaliste.fr répond 403 : non revérifiable aujourd'hui ; des agrégateurs citent des positions santé générales sans source primaire. |
| Benoît Mathieu | non_precise | 2026-11-03 | erreur | Contenu exact (le site dit n'avoir de programme ni sur la santé ni sur le reste) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04. |
| Jean-Luc Mélenchon | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Antoine Mikolajczak | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Manolo Mlekuz | non_precise | 2026-11-03 | erreur | Contenu exact (une seule mention de l'accès aux soins comme constat, sans proposition) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04. |
| Édouard Philippe | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Florian Philippot | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Gilles Platret | programme_non_publie | 2026-11-03 | doute | gillesplatret.fr sans mention de la candidature (page lue en partie) ; aucun site de campagne trouvé, recontrôle incomplet. |
| Natacha Polony | mesures | 2026-11-03 | conforme | 1 fichier sante-*.yaml. |
| Bruno Retailleau | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Erwan Rohou | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Fabien Roussel | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| François Ruffin | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Marine Tondelier | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |
| Éric Zemmour | mesures | 2026-11-03 | conforme | 2 fichiers sante-*.yaml. |

## Détails des doutes et des erreurs

Les corrections proposées sont à décider par le propriétaire. Les suggestions issues de recherches web ne sont pas des faits à écrire.

### Observation générale sur les dates des cases

Dans `src/content/sources/`, les sources de 27 des 30 candidats à case `mesures` ou `non_precise` ont `date_consultation: 2026-11-04`, alors que toutes les cases portent `verifie_le: 2026-11-03` (seuls Batho, Legendre et Rohou ont des sources du 2026-11-03). Les adresses Wayback citées portent un horodatage du 2026-11-03 (par exemple 20261103183037 pour Egger) alors que la capture locale est du 2026-11-04 (capture_le 2026-11-04T09:58). Pour les cases `mesures`, l'état repose sur l'existence des fichiers de mesures, que j'ai vérifiée : je les garde `conforme` en signalant ici l'écart. Pour les trois cases `non_precise`, l'état repose sur les sources elles-mêmes : l'écart est retenu comme `erreur`. Correction proposée : aligner `verifie_le` sur la dernière date de consultation (2026-11-04) après relecture, ou corriger les `date_consultation` si la lecture a bien eu lieu le 11-03.

### Cases erreur : clara-egger, benoit-mathieu, manolo-mlekuz

- clara-egger : sources `clara-egger-notre-solution`, `-parrainage-2027`, `-presentation-candidate`, toutes `date_consultation: 2026-11-04`, case au 2026-11-03. Recherche de vocabulaire santé dans les trois extraits : aucune proposition. Seule occurrence utile : sa biographie parle de recherches sur « crises sanitaires, sécuritaires ou politiques ». Le site dit que ses deux seules propositions portent sur la démocratie directe et la décentralisation. L'état `non_precise` est exact.
- benoit-mathieu : sources `benoit-mathieu-le-candidat` et `-programme`, consultées le 2026-11-04. Extrait : « Il n'y a pas de programme partisan sur ce site : ni sur l'économie, ni sur le social, ni sur la santé, ni sur la sécurité. » L'état est exact.
- manolo-mlekuz : sources `manolo-mlekuz-programme` et `-programme-detaille` (PDF), consultées le 2026-11-04. La seule mention est un constat de départ (« l'accès aux soins ») sans proposition ; le programme est institutionnel. L'état est exact.
- Correction proposée pour les trois : mettre `verifie_le: 2026-11-04`.

### Cases doute

- sylvain-durif (programme_non_publie) : `https://elvita2027.com/` présente le candidat (mouvement ELVITA) et un « Programme Zéro Défaut » en cinq thèmes (paix, souveraineté, écologie, simplification, société), sans section santé, avec la mention « Le programme complet est en cours de rédaction ». Cette adresse ne figure pas dans les URL consultées le 2026-11-03. Par ailleurs `durif2027.com` redirige aujourd'hui vers `ministereducringe.com`, qui se dit satirique et ne mentionne pas Durif. Si le programme existait le 11-03, la case devrait passer à `non_precise` avec archivage de la source. À vérifier par un éditeur.
- marine-le-pen (programme_non_publie) : `rassemblementnational.fr` répond par une redirection que mon outil ne suit pas ; rien lu. Des agrégateurs attribuent des mesures de santé « 2027 » au RN, mais l'un d'eux précise qu'elles viennent du programme 2022 et un autre n'a trouvé aucune position datée de 2027. Rien ne contredit la case, rien ne la confirme aujourd'hui. À revérifier à la main.
- mira-markovic (programme_non_publie) : `parti-animaliste.fr` répond 403. Un agrégateur cite des positions générales sur la santé, sans source primaire : ne pas les reprendre. À revérifier à la main.
- gilles-platret (programme_non_publie) : la page d'accueil de `gillesplatret.fr` ne mentionne ni la candidature ni un programme (contenu reçu tronqué). Aucun site de campagne trouvé. Candidature récente (2026-10-08). À revérifier.
- augustin-billetdoux (programme_non_publie) : `billetdoux2027.fr` montre un extrait de « La déclaration » et des témoignages ; le texte complet lié n'a pas été lu. Il peut contenir des propositions. À lire avant publication.

### Statuts doute, par type de problème

Déclaration non formelle ou conditionnelle (la définition du site : « pressentie » = citée sans s'être déclarée elle-même) :
- xavier-bertrand : franceinfo, 2026-08-27, le dit « futur candidat ». Citations : « Je le serai » ; « Quand je me déclarerai, ce sera en candidat indépendant ». Proposition : garder `declare` avec la phrase exacte en note, ou passer en `pressenti`. Étiquette de la fiche : « Les Républicains (candidat indépendant, Nous France) », sourcée sur nousfrance.fr ; à confronter à ce site, la mention d'un parti dont il se dit indépendant peut prêter à confusion.
- eric-zemmour : L'Avenir, 2026-09-18, « je serai candidat » dit la veille sur BFM ; l'article précise que ce n'est pas une déclaration formelle, attendue à partir d'octobre. Proposition : chercher la déclaration formelle si elle a eu lieu depuis.
- marine-tondelier : candidature « officiellement maintenue » dans l'attente d'un référendum interne (10 au 13 décembre 2026) entre candidature autonome et retrait. Le statut peut changer le 2026-12-13. Date de la fiche = date de l'article, pas de la déclaration. Proposition : noter la condition et réexaminer après le 13 décembre.
- gilles-platret : annonce le 2026-10-08 en réunion publique ; l'article note qu'il évite le mot « candidat » (« je m'engage résolument vers 2027 »). Proposition : décision éditoriale `declare` ou `pressenti`, et date 2026-10-08.
- bernard-cazeneuve : annonce dans Le Figaro du 2026-04-28 ; Europe 1 le reprend le 04-29 ; l'instantané note que ICI et LCP disent qu'il ne s'est pas formellement déclaré. Proposition : date 2026-04-28 et même note.
- antoine-mikolajczak : « veut défendre les couleurs d'Équinoxe », parrainages en cours ; date du vote des adhérents non indiquée. Proposition : chercher la source de la désignation.

Date de la fiche qui est celle de l'article ou de la liste, pas celle de la déclaration :
- augustin-billetdoux, christian-collovati, jean-francois-legendre, mira-markovic, erwan-rohou : tous cités par le même article de recensement franceinfo (date de la fiche 2026-10-22). La page ouverte aujourd'hui compte 38 candidats au 17 novembre et non 34 au 22 octobre, et ne porte pas de date : le titre cité dans la fiche ne correspond plus. Elle décrit bien ces cinq personnes comme candidates ; pour Billetdoux elle date la déclaration de septembre 2025 (vidéo). Proposition : garder le recensement comme preuve de l'existence de la candidature, mais utiliser pour la date une source propre à chacun (site ou communiqué), ou afficher « recensé le 2026-10-22 » plutôt que « déclaré le ».
- edouard-philippe : l'article du 2026-09-09 le nomme « le candidat Horizons » sans dater sa déclaration ; l'instantané indique « déclaré depuis septembre 2024 ». La date 2026-09-09 est donc très probablement fausse comme date de déclaration. Proposition : source et date de la déclaration.
- anasse-kazib : la page indique 2026-06-19 dans ses métadonnées (mise à jour 06-27) ; fiche 2026-06-01 ; elle décrit une campagne de parrainages (500 requis). Proposition : corriger la date ou trouver la source d'origine.
- delphine-batho : le site la présente comme candidate mais sans date ; 2025-11-25 non vérifiable. Proposition : une source datée (communiqué ou presse).
- benoit-mathieu : RMC non ouvert. Sud Radio, Ouest-France, ICI et son site `benoitmathieu2027.fr` le présentent comme candidat en quête de parrainages, parti le 30 mars 2026. Proposition : remplacer par une page ouverte, de préférence son site.
- manolo-mlekuz : RMC non ouvert (2026-07-03). CNews et Ouest-France l'évoquent dès mai 2026 (CNews du 27 mai). Proposition : source primaire `trajectoire2027.fr` avec sa date.
- sylvain-durif : 20 Minutes non ouvert. Recherche : annonce sur les réseaux le 2026-08-23 ; un site conteste que le compte soit le sien. Proposition : vérifier sur son site `elvita2027.com` avant publication.
- karim-bouamrane : CNews (403) porte sur le refus de la primaire. Recherche : franceinfo et France 3 titrent « annonce sa candidature », officialisée le 2026-06-09 sur France Inter. Proposition : remplacer la source et la date par la déclaration. L'instantané donne « Parti socialiste », la fiche n'affiche pas d'étiquette.
- francois-ruffin : l'URL Orange affiche une page de rubrique sans Ruffin. Recherche : annonce de candidature hors primaire le 2026-05-12 (source agrégateur). Proposition : source primaire (debout.fr) datée.

Source qui n'est ni le candidat ni un média :
- emmanuel-dubuisson : l'Annuaire des entreprises décrit l'association « Les Gaulois, campagne présidentielle élection 2027 de M. Emmanuel Dubuisson » (créée le 2026-06-05 d'après l'instantané et une recherche). Cela montre un compte de campagne, pas une déclaration, et la date 2026-10-08 n'y correspond pas. Page reçue vide par mon outil. Son site `dubuisson2027.fr` et son compte X seraient de meilleures sources primaires. Le recensement note qu'il était absent de franceinfo, LCP, ICI et France 24 le 8 octobre. Statut sensible : à trancher avant publication.

Point de forme sans verdict : la fiche de Retailleau date `date_publication` du 2026-04-19, l'article du parti porte l'adresse du 04-20 ; pour Labib, la page est du 06-18 et l'annonce du 06-17 ; pour Lalanne, l'annonce serait du 2026-08-18. Écarts d'un jour, non retenus.

Étiquettes : les étiquettes affichées viennent de sites de parti ou de candidat (`parti_source`), aucune ne ressemble à une description d'un tiers. Réserve : « Sans étiquette (soutenu par Les Ruches) » (Branco) et « Les Républicains (candidat indépendant, Nous France) » (Bertrand) sont des formules composées à confronter à ce que chacun revendique.

## Verdicts au format JSON

```json
[
 {
  "cible": "statut:nathalie-arthaud",
  "verdict": "conforme",
  "motif": "Article du 2025-12-08 : Lutte ouvrière sera présente, la porte-parole annonce sa candidature."
 },
 {
  "cible": "statut:francois-asselineau",
  "verdict": "conforme",
  "motif": "Déjà relu par Erwan. Page UPR du 2026-07-07 : candidature confirmée, étiquette sourcée sur le site du parti."
 },
 {
  "cible": "statut:gabriel-attal",
  "verdict": "conforme",
  "motif": "Article du 2026-05-22 : il a officialisé sa candidature."
 },
 {
  "cible": "statut:delphine-batho",
  "verdict": "doute",
  "motif": "Le site la présente « Candidate à l'élection présidentielle » mais n'affiche aucune date : la date 2025-11-25 n'est pas vérifiable."
 },
 {
  "cible": "statut:olivier-becht",
  "verdict": "conforme",
  "motif": "Annonce à Rixheim le 2026-09-24, article du même jour ; la page le dit « apparenté Renaissance », la fiche n'affiche pas d'étiquette."
 },
 {
  "cible": "statut:xavier-bertrand",
  "verdict": "doute",
  "motif": "L'article du 2026-08-27 le dit « futur candidat » : il répond « Je le serai » et précise « Quand je me déclarerai ». Intention, pas déclaration formelle."
 },
 {
  "cible": "statut:augustin-billetdoux",
  "verdict": "doute",
  "motif": "Page de recensement, pas de déclaration : la date 2026-10-22 est celle de la liste, la déclaration date de septembre 2025 selon la page ; le titre cité (34 candidats au 22 octobre) ne correspond plus (38 au 17 novembre)."
 },
 {
  "cible": "statut:karim-bouamrane",
  "verdict": "doute",
  "motif": "Page non lisible (403). Son titre porte sur le refus de la primaire PS, pas sur une déclaration. Une recherche suggère une annonce le 2026-06-09 (franceinfo)."
 },
 {
  "cible": "statut:juan-branco",
  "verdict": "conforme",
  "motif": "Article du 2025-12-19 : il se présente à la présidentielle 2027. Étiquette sourcée sur ruches.org."
 },
 {
  "cible": "statut:bernard-cazeneuve",
  "verdict": "doute",
  "motif": "Annonce dans un entretien au Figaro du 2026-04-28, l'article est du 04-29 ; l'instantané note que ICI et LCP relèvent qu'il ne s'est pas formellement déclaré."
 },
 {
  "cible": "statut:christian-collovati",
  "verdict": "doute",
  "motif": "Page de recensement : la date 2026-10-22 est celle de la liste, pas celle de la déclaration ; titre cité obsolète (38 candidats au 17 novembre)."
 },
 {
  "cible": "statut:emmanuel-dubuisson",
  "verdict": "doute",
  "motif": "Page reçue vide. Elle décrit une association de campagne, pas une déclaration ; l'association date du 2026-06-05, la fiche date 2026-10-08. Source ni candidat ni média."
 },
 {
  "cible": "statut:nicolas-dupont-aignan",
  "verdict": "conforme",
  "motif": "Article du 2026-09-19 : il se déclare candidat, quatrième campagne."
 },
 {
  "cible": "statut:sylvain-durif",
  "verdict": "doute",
  "motif": "Page non ouverte. Une recherche donne une annonce le 2026-08-23 sur les réseaux, la fiche date 2026-08-26 ; un site conteste l'attribution de la vidéo."
 },
 {
  "cible": "statut:clara-egger",
  "verdict": "conforme",
  "motif": "Communiqué du parti du 2026-04-19 annonçant sa candidature."
 },
 {
  "cible": "statut:raphael-glucksmann",
  "verdict": "conforme",
  "motif": "Désigné candidat dès le 1er tour de la primaire le 2026-10-11 (« désormais candidat »). Date = désignation, pas déclaration séparée."
 },
 {
  "cible": "statut:anasse-kazib",
  "verdict": "doute",
  "motif": "Page présente sa candidature (500 parrainages en cours) mais ses métadonnées donnent 2026-06-19, la fiche 2026-06-01."
 },
 {
  "cible": "statut:selma-labib",
  "verdict": "conforme",
  "motif": "Annonce du 2026-06-17 (page du 06-18) : le parti présente sa porte-parole."
 },
 {
  "cible": "statut:francis-lalanne",
  "verdict": "conforme",
  "motif": "Article du 2026-08-19 : candidature annoncée par communiqué, mouvement « France Libre ». Communiqué daté de la veille selon la page, écart d'un jour."
 },
 {
  "cible": "statut:marine-le-pen",
  "verdict": "conforme",
  "motif": "Article du 2026-07-07 consacré à la décision d'appel : elle y annonce sur TF1 qu'elle sera candidate. Source centrée sur la condamnation, une source dédiée serait plus nette."
 },
 {
  "cible": "statut:jean-francois-legendre",
  "verdict": "doute",
  "motif": "Page de recensement : date de la liste (2026-10-22), pas de la déclaration ; titre cité obsolète."
 },
 {
  "cible": "statut:david-lisnard",
  "verdict": "conforme",
  "motif": "Annonce sur France 2 le 2026-03-31, « Je suis candidat » (article du 04-01)."
 },
 {
  "cible": "statut:mira-markovic",
  "verdict": "doute",
  "motif": "Page de recensement : date de la liste, pas de la déclaration ; titre cité obsolète. Désignation par le parti le 2026-10-02 selon une recherche."
 },
 {
  "cible": "statut:benoit-mathieu",
  "verdict": "doute",
  "motif": "Page non ouverte. D'autres sources montrent un candidat en quête de parrainages parti le 30 mars ; la date 2026-05-03 est celle de l'article."
 },
 {
  "cible": "statut:jean-luc-melenchon",
  "verdict": "conforme",
  "motif": "Annonce sur TF1 le 2026-05-03, « Oui, je suis candidat »."
 },
 {
  "cible": "statut:antoine-mikolajczak",
  "verdict": "doute",
  "motif": "L'article dit qu'il « veut défendre les couleurs d'Équinoxe » et cherche ses parrainages ; la date du vote de désignation n'y figure pas (article du 07-12, mise à jour du 07-11)."
 },
 {
  "cible": "statut:manolo-mlekuz",
  "verdict": "doute",
  "motif": "Page non ouverte. Des articles de mai 2026 le disent déjà candidat : la date 2026-07-03 est celle de l'article RMC."
 },
 {
  "cible": "statut:edouard-philippe",
  "verdict": "doute",
  "motif": "L'article du 2026-09-09 le nomme « le candidat Horizons » sans dater sa déclaration ; l'instantané dit « déclaré depuis septembre 2024 » : la date de la fiche est celle de l'article."
 },
 {
  "cible": "statut:florian-philippot",
  "verdict": "conforme",
  "motif": "Il « s'est à nouveau porté candidat » sur France 2 le 2026-05-09 (article du 05-11)."
 },
 {
  "cible": "statut:gilles-platret",
  "verdict": "doute",
  "motif": "Engagement annoncé le 2026-10-08 en réunion publique ; la page note qu'il évite le mot « candidat ». Date de la fiche = date de l'article."
 },
 {
  "cible": "statut:natacha-polony",
  "verdict": "conforme",
  "motif": "Article du 2026-10-14 : elle confirme sa candidature. Étiquette sourcée sur son site de campagne."
 },
 {
  "cible": "statut:bruno-retailleau",
  "verdict": "conforme",
  "motif": "Désignation par les adhérents le week-end du 18-19 avril 2026 (article du 04-20, la fiche date la publication du 04-19)."
 },
 {
  "cible": "statut:erwan-rohou",
  "verdict": "doute",
  "motif": "Page de recensement : date de la liste, pas de la déclaration ; titre cité obsolète."
 },
 {
  "cible": "statut:fabien-roussel",
  "verdict": "conforme",
  "motif": "Article du 2026-09-06 : « C'est désormais officiel », investi par le PCF."
 },
 {
  "cible": "statut:francois-ruffin",
  "verdict": "doute",
  "motif": "L'URL affiche désormais une page de rubrique sans mention de Ruffin. Une recherche donne une annonce le 2026-05-12 ; la fiche date 2026-09-16."
 },
 {
  "cible": "statut:marine-tondelier",
  "verdict": "doute",
  "motif": "Candidature « officiellement maintenue » (article du 2026-09-22) en attendant le référendum interne du 10 au 13 décembre ; la date de la fiche est celle de l'article."
 },
 {
  "cible": "statut:eric-zemmour",
  "verdict": "doute",
  "motif": "Il confirme le 2026-09-17 « je serai candidat » ; l'article précise que ce n'est pas une déclaration formelle, attendue à partir d'octobre."
 },
 {
  "cible": "case:sante/nathalie-arthaud",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/francois-asselineau",
  "verdict": "conforme",
  "motif": "upr.fr/notre-programme relu le 2026-11-17 : programme 2027 « publié prochainement », 2012, 2017 et 2022 seulement."
 },
 {
  "cible": "case:sante/gabriel-attal",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/delphine-batho",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/olivier-becht",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/xavier-bertrand",
  "verdict": "conforme",
  "motif": "nousfrance.fr/programme relu : 8 thèmes en titres seuls, pages travail et jeunesse sans mesure ; seulement 2 des 8 pages rouvertes."
 },
 {
  "cible": "case:sante/augustin-billetdoux",
  "verdict": "doute",
  "motif": "billetdoux2027.fr n'affiche qu'un résumé de la déclaration ; le texte complet lié n'a pas été lu (/declaration répond 404)."
 },
 {
  "cible": "case:sante/karim-bouamrane",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/juan-branco",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/bernard-cazeneuve",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/christian-collovati",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/emmanuel-dubuisson",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/nicolas-dupont-aignan",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/sylvain-durif",
  "verdict": "doute",
  "motif": "elvita2027.com, absent des URL consultées, publie un programme « Zéro Défaut » en 5 thèmes ; durif2027.com redirige vers ministereducringe.com (site satirique)."
 },
 {
  "cible": "case:sante/clara-egger",
  "verdict": "erreur",
  "motif": "Contenu exact (aucune proposition de santé dans les 3 extraits) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04."
 },
 {
  "cible": "case:sante/raphael-glucksmann",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/anasse-kazib",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/selma-labib",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/francis-lalanne",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/marine-le-pen",
  "verdict": "doute",
  "motif": "Site du RN non lisible aujourd'hui (redirection 307) : absence de programme 2027 non revérifiable ; rien ne la contredit."
 },
 {
  "cible": "case:sante/jean-francois-legendre",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/david-lisnard",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/mira-markovic",
  "verdict": "doute",
  "motif": "parti-animaliste.fr répond 403 : non revérifiable aujourd'hui ; des agrégateurs citent des positions santé générales sans source primaire."
 },
 {
  "cible": "case:sante/benoit-mathieu",
  "verdict": "erreur",
  "motif": "Contenu exact (le site dit n'avoir de programme ni sur la santé ni sur le reste) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04."
 },
 {
  "cible": "case:sante/jean-luc-melenchon",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/antoine-mikolajczak",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/manolo-mlekuz",
  "verdict": "erreur",
  "motif": "Contenu exact (une seule mention de l'accès aux soins comme constat, sans proposition) mais verifie_le 2026-11-03 antérieur aux consultations du 2026-11-04."
 },
 {
  "cible": "case:sante/edouard-philippe",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/florian-philippot",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/gilles-platret",
  "verdict": "doute",
  "motif": "gillesplatret.fr sans mention de la candidature (page lue en partie) ; aucun site de campagne trouvé, recontrôle incomplet."
 },
 {
  "cible": "case:sante/natacha-polony",
  "verdict": "conforme",
  "motif": "1 fichier sante-*.yaml."
 },
 {
  "cible": "case:sante/bruno-retailleau",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/erwan-rohou",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/fabien-roussel",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/francois-ruffin",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/marine-tondelier",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 },
 {
  "cible": "case:sante/eric-zemmour",
  "verdict": "conforme",
  "motif": "2 fichiers sante-*.yaml."
 }
]
```
