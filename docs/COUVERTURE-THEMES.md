# Couverture des thèmes par les sources primaires

Mesure du **2026-11-03** — Claude (agent), à relire par Erwan Henry. Données : [`data/couverture-themes.yaml`](../data/couverture-themes.yaml), recalculées par `scripts/couverture-scan.ts --check-data`. Contenu publié sous Licence Ouverte 2.0 (voir [LICENSE](../LICENSE)).

Ce document explique comment les trois thèmes pilotes du site ont été choisis (exigence CONT-04). Il mesure la **couverture des thèmes par les documents de programme des candidats**, pas la qualité, la faisabilité ni l’intérêt des programmes. Il est repris par la page « Méthode » du site.

## Méthode

1. **Périmètre.** Les 37 candidats dont le dernier statut est « déclaré » ou « primaire », rangés par nom de tri (collation française). Les personnes qui ont renoncé ou qui sont seulement pressenties n’en font pas partie.
2. **Sources admises.** Le programme du candidat, son site de campagne, le site de son parti, ses discours, tribunes et dépôts au Conseil constitutionnel. Jamais la presse, les comparateurs et agrégateurs, Wikipédia, data.gouv.fr, ni les contributions de soutiens, ni les programmes d’élections précédentes. Les documents d’un parti sont comptés comme tels (`parti_du_candidat`), pas comme des paroles du candidat.
3. **Lecture en direct.** Toutes les adresses ont été relues en direct le 2026-11-03. L’estimation de recherche faite avant (même date) n’est pas reprise : elle servait de piste. Chaque document de programme lu est archivé : l’extrait texte et son empreinte sha256 sont dans le dépôt public, le fichier d’origine dans un dépôt privé.
4. **Outil et lecture humaine.** Le scanner (`scripts/couverture-scan.ts`) repère, pour chaque thème, les passages qui contiennent des mots-clés du thème. Ces repérages sont des pistes : chaque passage est relu avant de classer la case, et une note d’une ligne dit quelle section, combien d’énoncés, quelle source.
5. **Niveaux de couverture.** Un énoncé de position est une phrase ou une puce par laquelle le candidat s’engage à faire, changer, garder ou refuser quelque chose ; une formule de politesse ou un mot isolé n’en est pas un.

| Symbole | Niveau | Sens |
|---|---|---|
| ● | fort | une section ou une page dédiée au thème, ou au moins 3 énoncés de position nets |
| ◐ | partiel | 1 ou 2 énoncés, ou un énoncé indirect ou de principe |
| ○ | silence | un document de programme existe, a été lu, et ne dit rien sur ce thème |
| × | aucun | aucun document de programme trouvé pour ce candidat (les 10 cases) |
| — | inaccessible | un document existe mais ne peut pas être lu automatiquement (refus HTTP 403, page rendue côté navigateur) |

6. **Accès par candidat.** `ok` : tout ce qui a été trouvé a été lu. `partiel` : au moins un document a été lu, un autre est inaccessible ; les cases sont classées d’après ce qui a été lu et la note le dit. `bloque` : rien n’a pu être lu. `aucun_site` : aucun document de programme n’existe.
7. **Sur 37 candidats** : 26 en accès `ok`, 3 en `partiel`, 1 en `bloque`, 7 en `aucun_site`.

## Limites

- **Mots-clés.** Le repérage par mots-clés rate les listes à puces sans verbe et compte à tort les formules générales ; la relecture corrige une partie seulement. Les niveaux sont des estimations lues, pas des mesures exactes.
- **Frontière entre deux niveaux.** « Au moins 3 énoncés » (fort) contre « 1 ou 2 » (partiel) dépend de la manière de compter : une ligne qui contient trois engagements compte pour trois. Les cas limites sont signalés dans la note de la case.
- **Sites explorés en partie.** Certains sites ont des centaines de mesures, une page par mesure : seule la page d’index ou les livrets thématiques ont été archivés ; les pages de thème sont archivées plus tard, thème par thème.
- **Documents de parti.** Un document du parti d’un candidat est compté comme un document de programme du candidat, avec la mention `parti_du_candidat`. Quand le candidat n’a pas son propre texte, la case reflète donc le parti.
- **Élections précédentes.** Les programmes de 2012, 2017, 2022 et des élections de 2024 sont exclus, même s’ils restent en ligne sur le site du candidat ou de son parti. Un candidat dont tous les documents sont anciens est classé « aucun site ».
- **Presse et agrégateurs.** Jamais utilisés. Un candidat que la presse décrit mais qui ne publie pas de programme apparaît comme « aucun site ».
- **Sites inaccessibles.** Un site qui refuse les requêtes automatiques (403, contrôle anti-robot) ou qui ne s’affiche que dans un navigateur n’est pas contourné : il est signalé « bloqué » ou « partiel », et une capture manuelle est demandée (voir plus bas).
- **Programmes en cours d’écriture.** Plusieurs candidats annoncent un programme à venir. La mesure est datée ; elle doit être refaite si un programme paraît avant la publication.
- **Pas de jugement.** Un « fort » veut dire que le sujet est traité, jamais que la position est bonne, réaliste ou chiffrée.

## Tableau

Thèmes dans l’ordre du cahier des charges : Lo Logement, Éc École, Re Retraites, Sa Santé, Sé Sécurité, Cl Climat, Tr Travail, Im Impôts, Eu Europe et monde, In Institutions. ● fort, ◐ partiel, ○ silence, × aucun, — inaccessible.

| # | Candidat | Accès | Lo | Éc | Re | Sa | Sé | Cl | Tr | Im | Eu | In |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Nathalie Arthaud | ok | ○ | ◐ | ◐ | ◐ | ◐ | ○ | ● | ◐ | ● | ○ |
| 2 | François Asselineau | aucun site | × | × | × | × | × | × | × | × | × | × |
| 3 | Gabriel Attal | ok | ◐ | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 4 | Delphine Batho | partiel | ◐ | ◐ | ○ | ● | ● | ● | ◐ | ○ | ◐ | ● |
| 5 | Olivier Becht | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 6 | Xavier Bertrand | aucun site | × | × | × | × | × | × | × | × | × | × |
| 7 | Augustin Billetdoux | aucun site | × | × | × | × | × | × | × | × | × | × |
| 8 | Karim Bouamrane | ok | ◐ | ◐ | ○ | ◐ | ● | ◐ | ◐ | ○ | ● | ○ |
| 9 | Juan Branco | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 10 | Bernard Cazeneuve | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 11 | Christian Collovati | ok | ● | ● | ● | ◐ | ● | ● | ● | ● | ● | ● |
| 12 | Emmanuel Dubuisson | ok | ○ | ◐ | ◐ | ● | ● | ◐ | ● | ● | ◐ | ● |
| 13 | Nicolas Dupont-Aignan | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 14 | Sylvain Durif | aucun site | × | × | × | × | × | × | × | × | × | × |
| 15 | Clara Egger | ok | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| 16 | Raphaël Glucksmann | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 17 | Anasse Kazib | ok | ◐ | ◐ | ◐ | ◐ | ● | ◐ | ● | ◐ | ● | ● |
| 18 | Selma Labib | ok | ◐ | ◐ | ◐ | ◐ | ○ | ◐ | ● | ◐ | ◐ | ○ |
| 19 | Francis Lalanne | ok | ○ | ◐ | ○ | ◐ | ● | ○ | ◐ | ● | ● | ● |
| 20 | Marine Le Pen | aucun site | × | × | × | × | × | × | × | × | × | × |
| 21 | Jean-François Legendre | ok | ◐ | ● | ◐ | ◐ | ● | ● | ● | ● | ● | ● |
| 22 | David Lisnard | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 23 | Mira Markovic | aucun site | × | × | × | × | × | × | × | × | × | × |
| 24 | Benoît Mathieu | ok | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| 25 | Jean-Luc Mélenchon | partiel | ● | ● | ● | ● | ◐ | ● | ● | ● | ◐ | ● |
| 26 | Antoine Mikolajczak | ok | ○ | ○ | ○ | ● | ○ | ◐ | ◐ | ○ | ◐ | ● |
| 27 | Manolo Mlekuz | ok | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| 28 | Édouard Philippe | ok | ◐ | ● | ● | ◐ | ● | ● | ● | ● | ● | ◐ |
| 29 | Florian Philippot | ok | ◐ | ● | ◐ | ● | ● | ● | ● | ● | ● | ● |
| 30 | Gilles Platret | aucun site | × | × | × | × | × | × | × | × | × | × |
| 31 | Natacha Polony | ok | ○ | ◐ | ○ | ◐ | ○ | ◐ | ◐ | ○ | ◐ | ◐ |
| 32 | Bruno Retailleau | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 33 | Erwan Rohou | bloqué | — | — | — | — | — | — | — | — | — | — |
| 34 | Fabien Roussel | ok | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ |
| 35 | François Ruffin | ok | ● | ● | ◐ | ◐ | ◐ | ● | ● | ● | ● | ● |
| 36 | Marine Tondelier | partiel | ● | ● | ◐ | ● | ● | ● | ● | ● | ● | ◐ |
| 37 | Éric Zemmour | ok | ◐ | ● | ○ | ◐ | ◐ | ◐ | ◐ | ● | ● | ○ |

## Comptage par thème

Une **position** est une case « fort » ou « partiel » ; « silence », « aucun » et « inaccessible » ne comptent jamais.

| Rang | Thème | Positions | ● | ◐ | ○ | × | — | Thème Aîné prioritaire |
|---:|---|---:|---:|---:|---:|---:|---:|:-:|
| 1 | Travail (`travail`) | 26 | 20 | 6 | 3 | 7 | 1 |  |
| 2 | Europe et monde (`europe-et-monde`) | 26 | 20 | 6 | 3 | 7 | 1 |  |
| 3 | Santé (`sante`) | 26 | 15 | 11 | 3 | 7 | 1 | oui |
| 4 | Institutions (`institutions`) | 25 | 21 | 4 | 4 | 7 | 1 |  |
| 5 | École (`ecole`) | 25 | 17 | 8 | 4 | 7 | 1 |  |
| 6 | Climat (`climat`) | 24 | 17 | 7 | 5 | 7 | 1 |  |
| 7 | Sécurité (`securite`) | 23 | 19 | 4 | 6 | 7 | 1 |  |
| 8 | Impôts (`impots`) | 22 | 19 | 3 | 7 | 7 | 1 |  |
| 9 | Logement (`logement`) | 21 | 12 | 9 | 8 | 7 | 1 | oui |
| 10 | Retraites (`retraites`) | 20 | 12 | 8 | 9 | 7 | 1 | oui |

Les dix thèmes sont séparés par 6 position(s) seulement (de 20 à 26 sur 37 candidats) ; 8 candidats sur 37 n’ont aucun document lisible (accès « bloqué » ou « aucun site »), donc aucune position sur aucun des 10 thèmes. L’ordre fin du classement est donc dans la marge d’erreur de la mesure, d’où la règle ci-dessous.

## Règle de choix des trois thèmes

Règle fixée avant la mesure : on retient les trois thèmes que les sources primaires des candidats couvrent le mieux ; les thèmes à égalité (à 2 candidats près, la marge d’erreur de la mesure) sont départagés en faveur des thèmes prioritaires pour les lecteurs âgés (retraites, santé, logement). Le calcul est fait par le code (`classer` dans `scripts/lib/couverture.ts`), pas à la main :

- Mesure du 2026-11-03 sur 37 candidats, 10 thèmes.
- Une position est une case « fort » ou « partiel » : « silence », « aucun » et « inaccessible » ne comptent jamais.
- Classement : positions décroissantes, puis nombre de cases « fort » décroissant, puis ordre de la spec.
- Règle des trois thèmes : un écart de 2 candidats au plus = égalité (marge d’erreur de la mesure).
- Les thèmes qui devancent le quatrième du classement de 2 positions ou plus (P4 = 25, seuil 27) sont retenus d’office, trois au plus.
- Pour chaque place restante, on garde les thèmes à 2 positions ou moins du meilleur reste, et on retient d’abord le thème prioritaire Aîné (logement, retraites, sante), puis celui qui a le plus de positions, de cases « fort », puis le premier de l’ordre de la spec.
- Thèmes retenus (règle de la marge) : sante, travail, europe-et-monde.
- Trois premiers du classement littéral (sans marge ni départage Aîné) : travail, europe-et-monde, sante.
- Comparaison côte à côte : marge = sante, travail, europe-et-monde ; littéral = travail, europe-et-monde, sante.

## Résultat, côte à côte

| Règle de la marge (thèmes retenus) | Classement littéral (3 premiers, sans marge) | Liste provisoire de la recherche (estimation) |
|---|---|---|
| Santé, Travail, Europe et monde (`sante`, `travail`, `europe-et-monde`) | Travail, Europe et monde, Santé (`travail`, `europe-et-monde`, `sante`) | Institutions, Impôts, Retraites (`institutions`, `impots`, `retraites`) |

- **Règle de la marge et classement littéral** : mêmes trois thèmes, dans un ordre différent. La règle de la marge place d’abord Santé (thème prioritaire Aîné).
- **Institutions** (liste provisoire) : non retenu, 25 positions contre 26, 26, 26 pour les thèmes retenus.
- **Impôts** (liste provisoire) : non retenu, 22 positions contre 26, 26, 26 pour les thèmes retenus.
- **Retraites** (liste provisoire) : non retenu, 20 positions contre 26, 26, 26 pour les thèmes retenus.

La mesure **ne confirme pas** la liste provisoire de la recherche (une estimation du même jour, faite par mots-clés, sans lecture complète).

## Thèmes pilotes retenus : santé, travail, Europe et monde

Thèmes pilotes retenus : `sante`, `travail`, `europe-et-monde`. Erwan Henry les a confirmés explicitement le 2026-11-03, après avoir vu le classement mesuré. Ils sont identiques au choix de la règle de la marge et au classement littéral (`choix` = `top3Litteral`, à l’ordre près) : aucune dérogation n’est nécessaire (`pilote.derogation: null`). Ils diffèrent entièrement de la liste provisoire (`institutions`, `impots`, `retraites`), qui était une estimation par mots-clés. Le classement reste fragile (dix thèmes séparés par 6 positions) ; Travail est le seul thème présent dans tous les trios de la sensibilité calculée en 03-04.

## Sources inaccessibles (état après les captures du 2026-11-03)

Adresses restant dans `urls_bloquees` pour les candidats en accès « bloqué » ou « partiel ». Aucune n’a été contournée.

- **Delphine Batho** (partiel) : priorités 1, 2 et 4 de https://www.delphinebatho.fr/priorites/ lues et archivées (captures de navigateur du 2026-11-03). Restent non lues :
  - https://www.delphinebatho.fr/priorites/priorite-3/ (« La beauté pour vivre mieux »)
  - https://generationecologie.fr/ (HTTP 403)
- **Jean-Luc Mélenchon** (partiel) :
  - https://melenchon2027.fr/programme2025/livre/ (redirige vers l’accueil, le livre n’est pas en ligne)
- **Erwan Rohou** (bloqué) :
  - https://www.les-ecologistes-mei.org/notre-programme
- **Marine Tondelier** (partiel) :
  - https://lesecologistes.fr/document/3N4JsAEmq6vsx42IITGNZa/vdef-programme-1.pdf (programme complet de 557 mesures, HTTP 403 à l’outil ; téléchargement dans un navigateur à autoriser par Erwan)

**Sylvain Durif** n’est plus bloqué : la page https://durif2027.com/le-projet, affichée dans un navigateur réel le 2026-11-03, ne montre qu’un communiqué « CAMPAGNE DU MINISTÈRE DU CRINGE SUSPENDUE … jusqu’à nouvel ordre cosmique » et aucun programme ; ses dix cases sont « aucun » (accès `aucun_site`).

Cas particulier : la page de programme du Mouvement écologiste indépendant (Erwan Rohou) est lisible mais n’est pas conservée dans le dépôt, car son pied de page publie l’adresse, le téléphone mobile et des adresses de messagerie de particuliers. Une capture expurgée est demandée ; en attendant, les dix cases sont « inaccessibles » et non « aucun », puisqu’un programme existe.

## Choix des mesures quand un thème est publié

Règle commune, appliquée dans le même ordre à tous les candidats :

- au plus **2 mesures** par candidat et par thème ;
- les mesures « les plus centrales du thème dans la source » : d’abord celles que la source met elle-même en avant sur le thème (titre de section, première puce, élément en gras ou en titre) ; s’il y en a plus de deux, les deux premières dans l’ordre de la source ;
- jamais selon le caractère frappant, polémique ou facile à expliquer d’une mesure ;
- une seule mesure suffit quand la source n’en énonce qu’une ;
- les candidats sont traités dans l’ordre alphabétique de leur nom de tri, jamais selon l’état d’avancement de leur programme.

## Écart entre la description du jeu de données et le fichier

La description du jeu data.gouv.fr « statuts sourcés » annonce 51 personnes ; le fichier du 28/10/2026 en contient 59 (statuts : 37 « declare », 17 « renonce », 5 « pressenti »). Cet écart est constaté, pas expliqué. Le périmètre de cette mesure est calculé à partir des fiches (37 lignes), jamais à partir de la description.

