# Lien entre Erwan Rohou et le Mouvement Écologiste Indépendant (MEI)

Recherche en lecture seule, faite le 2026-11-17. Aucune page soumise à Wayback ni à un service d'archivage, aucun formulaire rempli, aucun fichier du dépôt modifié hors ce rapport. Les pages ont été lues par simples requêtes GET (copies de travail dans /tmp, hors dépôt).

## 1. Ce que le dépôt sait déjà

- `src/content/candidats/erwan-rohou.yaml` : `parti: null`, pas de `parti_source`. Statut `declare` au 2026-10-22, source de type presse (franceinfo, « 34 candidats au 22 octobre 2026 »), `statut_relecture: brouillon`.
- Jeu de données importé `data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json`, ligne `rohou` : `parti: "Mouvement écologiste indépendant"`, `liens: {}` (aucun lien de campagne ni de parti), source du statut = le même article franceinfo, `statut_detail` mentionnant le MEI (« Le MEI, fondé en 1994 par Antoine Waechter »). Donc le jeu de données connaît le parti, mais seulement via la presse. La règle du plan 03 (03-RESEARCH.md ligne 222) ne retient `parti` que s'il existe une source primaire de rattachement : d'où `parti: null`.
- `src/content/sources/erwan-rohou-programme-mei.yaml` : URL `https://www.les-ecologistes-mei.org/notre-programme`, type `site_parti`, auteur `parti_du_candidat`, `date_publication: 2026-11` (partielle), consultée le 2026-11-03, extrait saisi à la main `archives/erwan-rohou/e4e379a88baa.txt` (seul fichier du dossier `archives/erwan-rohou/`), exception Wayback motivée par les données de particuliers du pied de page.
- L'extrait archivé ne nomme ni Erwan Rohou ni le MEI (vérifié : aucune occurrence de « Rohou » ni de « MEI »). Il se termine par « Ce programme est évidemment évolutif et se trouvera régulièrement complété ou modifié en fonction des réflexions de notre mouvement. »
- `data/couverture-themes.yaml` (ligne erwan-rohou) : l'accueil du mouvement a bien été consulté le 2026-11-03 (« interview vidéo d'Erwan Rohou, candidat du mouvement en 2027 »), mais aucune copie de cette page d'accueil n'a été archivée, et elle n'est pas citée comme source. Le plan du site donnait une dernière modification du programme au 2026-10-11.
- Les deux mesures (`sante-egalite-acces-soins.yaml`, `sante-usagers-conseil-administration.yaml`) écrivent déjà « dont Erwan Rohou est le candidat selon l'accueil du mouvement » : l'affirmation repose donc sur une page d'accueil non archivée.

## 2. Pages primaires trouvées (domaine du mouvement, lues le 2026-11-17)

Aucune page n'affiche d'adresse e-mail, de téléphone ni de nom de particulier autre que des figures publiques du mouvement (recherche automatique d'e-mails et de numéros : zéro résultat sur les cinq pages ci-dessous).

| # | URL | Date affichée | Citation exacte (courte) | Qui parle | Données de particuliers | Stabilité |
|---|---|---|---|---|---|---|
| A | https://les-ecologistes-mei.org/erwan-rohou-candidat-du-mei-aux-elections-presidentielles/ | 2026-09-04 (date de publication dans les métadonnées de la page) | « le Mouvement Écologiste Indépendant [...] a décidé de présenter un candidat à l'élection présidentielle 2027. Ce candidat sera Erwan Rohou. » | le mouvement (communiqué) | non | bonne : article daté, non modifié depuis la publication d'après les métadonnées (pas de date de modification) |
| B | https://les-ecologistes-mei.org/erwan-rohou/ | non datée dans le texte ; publiée 2026-10-23, modifiée 2026-11-16 (métadonnées) | « Candidat du Mouvement Écologiste Indépendant à l'élection présidentielle de 2027 » ; « Erwan Rohou a été désigné par le Mouvement Écologiste Indépendant pour porter ses orientations » ; « Membre du bureau national » ; « Erwan Rohou rejoint le Mouvement Écologiste Indépendant en 2021. » | le mouvement (page de présentation du candidat, à la 3e personne) | non | moyenne : page modifiée il y a un jour, contenu de fond probablement stable, mais à archiver |
| C | https://les-ecologistes-mei.org/ (accueil) | non datée ; modifiée 2026-11-11 (métadonnées) | « Présidentielle 2027 Erwan Rohou notre candidat » | le mouvement | non | faible : accueil qui change (actualités) |
| D | https://les-ecologistes-mei.org/programme-du-mei/ | non datée ; publiée 2026-10-30, modifiée 2026-11-11 (métadonnées) | titre « Le programme du MEI. Pour une France qui serve l'avenir » ; propositions 6 et 39 présentes avec le même texte que l'extrait archivé | le mouvement | non (aucune adresse, téléphone ni e-mail repéré) | moyenne. Nouvelle adresse du programme (voir point 4) |
| E | https://les-ecologistes-mei.org/projet-politique-du-mei-pour-2027/ | non datée ; publiée 2026-10-22, modifiée 2026-11-11 (métadonnées) | « Présidentielle 2027 Erwan Rohou notre candidat » | le mouvement | non | moyenne |

Cette page est aussi présente : https://les-ecologistes-mei.org/interview-erwan-rohou/ (publiée 2026-10-17), mais son texte n'est qu'une vidéo intitulée « Écologie indépendante : L'alternative du terrain avec Bruno Ladsous et Erwan Rohou (Mouvement écologiste indépendant) ». Le titre rattache les deux noms au mouvement, mais la vidéo n'est pas lisible automatiquement : à ne pas utiliser comme preuve.

Le candidat ne figure pas dans le jeu de données avec un site ou un compte personnel (`liens: {}`). Je n'ai pas cherché de compte de réseau social personnel : le seul site de campagne identifié est celui du mouvement. Il n'y a pas de site propre du candidat trouvé dans le jeu de données.

Contexte presse (non primaire, non archivable comme source de mesure) : l'article franceinfo du 22 octobre 2026 déjà cité dans la fiche, via le jeu de données, indique que le MEI a été fondé en 1994 par Antoine Waechter et que le candidat figurait en 25e position de la liste de Yann Wehrling aux européennes de 2024. La page B (primaire) confirme la liste de 2024 et la direction de campagne confiée à Antoine Waechter (page A).

Wayback : l'API de disponibilité (lecture seule) ne renvoie aucun instantané existant pour les pages A, B et D à la date de la recherche. Rien n'a été soumis.

## 3. Conclusion

**Lien établi par une source primaire.**

Page la plus solide : A (communiqué du 2026-09-04 sur le site du MEI). Citation : « Ce candidat sera Erwan Rohou. » à la suite de « le Mouvement Écologiste Indépendant [...] a décidé de présenter un candidat à l'élection présidentielle 2027 ». Elle établit : le MEI a décidé de présenter un candidat à la présidentielle 2027, et ce candidat est Erwan Rohou. La même page indique qu'il est « Membre du bureau national du MEI depuis 5 ans ».

Page complémentaire : B (présentation du candidat sur le site du MEI, modifiée le 2026-11-16) : « Candidat du Mouvement Écologiste Indépendant à l'élection présidentielle de 2027 », et « désigné par le Mouvement Écologiste Indépendant pour porter ses orientations ». Elle établit le rattachement (candidat désigné par le mouvement, membre du bureau national, adhérent depuis 2021, ancien trésorier selon cette même page).

Ce que ces pages ne disent pas : elles émanent toutes du mouvement lui-même, donc c'est le mouvement qui parle, non le candidat. Je n'ai pas trouvé de page du candidat seul. Aucune ne dit en toutes lettres que le programme de la page D est « le programme du candidat » : la page E et la page B placent le « Projet 2027 » et le candidat côte à côte, et la page B renvoie à « Découvrir le Projet 2027 », mais ne dit pas « mon programme ». Le lien candidat, mouvement, programme est donc : le mouvement est celui de la candidature (établi), le programme est celui du mouvement (établi), et c'est le mouvement qui présente le candidat comme porteur de ses orientations (page B, établi). Rien de plus.

## 4. Point d'attention : l'URL de la source est maintenant en 404

`https://www.les-ecologistes-mei.org/notre-programme` (URL du fichier source) renvoie 404 le 2026-11-17 (le site a été refait). Le même programme est maintenant sur `https://les-ecologistes-mei.org/programme-du-mei/` (page D). Il garde la proposition 6 et la proposition 39 avec le texte archivé : proposition 6 « Les quatre égalités fondamentales à garantir sont l'accès aux soins (sans ignorer la nécessité de contenir les dépenses), à une alimentation de qualité, à l'école et au logement. » et proposition 39 « Les usagers (association de chômeurs à l'UNEDIC, association de patients à l'assurance maladie …) sont introduits dans le conseil d'administration des assurances sociales [...] ». Dans l'extrait archivé la numérotation de la proposition sur les usagers est 38 ; sur la page actuelle elle est 39 (la page actuelle compte 40 propositions, l'archive 39) : la numérotation a donc changé. La page D n'affiche pas de pied de page avec données de particuliers, d'après la recherche automatique, mais un humain doit le confirmer à l'œil avant tout archivage. Les `source_localisation` des deux mesures (« proposition n° 6 », et le numéro de la seconde) sont à revérifier contre la copie archivée choisie.

## 5. Ce que j'archiverais si Erwan Henry garde les deux mesures

1. Page A (communiqué du 2026-09-04), copie intégrale : c'est la preuve datée et stable du lien. Aucune donnée de particulier repérée, donc Wayback possible (décision à prendre par Erwan Henry, pas par moi).
2. Page B (`/erwan-rohou/`), copie intégrale : désignation, bureau national, adhésion. Date de consultation à noter (page modifiée la veille).
3. Page D (`/programme-du-mei/`) : nouvelle copie du programme à son adresse actuelle, qui remplace l'URL en 404, avec contrôle humain de l'absence de données de particuliers, puis hash et mise à jour du fichier source (URL, `date_consultation`, numéros des propositions). Une copie Wayback devient possible si le contrôle confirme l'absence de données personnelles ; l'exception actuelle (`wayback_exception`) ne vaudrait alors plus pour cette URL.
4. Ajouter les pages A et B comme sources du rattachement du candidat au parti, et dans `erwan-rohou.yaml` renseigner `parti` et `parti_source` (type parti ou candidat, selon la règle du plan 03), cette décision restant à Erwan Henry. Je n'ai rien écrit dans ce sens.

## 6. Formulation que les mesures pourraient employer sans dépasser les pages

Seulement ce que A et B disent :
- « Le Mouvement Écologiste Indépendant, dont Erwan Rohou est le candidat à l'élection présidentielle de 2027 selon le communiqué du mouvement du 4 septembre 2026, ... » (page A, parole du mouvement).
- « Le programme du mouvement » pour le contenu de la proposition 6 ou 39, avec la source D, sans écrire « son programme à lui » ni « le programme d'Erwan Rohou » comme si c'était dit par le candidat.

À éviter : « le programme d'Erwan Rohou » sans précision ; « selon l'accueil du mouvement » (page C, instable et non archivée) ; toute mention des positions personnelles du candidat sur l'assurance maladie ou les soins, qu'aucune page lue n'exprime.

## 7. Données personnelles

Aucune des pages A, B, C, D, E ni la page d'interview n'affiche d'adresse, de téléphone ni d'e-mail de particulier. Le seul risque connu reste le pied de page de l'ancienne page `/notre-programme` (décrit dans le dépôt, désormais en 404). Aucune donnée de particulier n'a été recopiée ici.
