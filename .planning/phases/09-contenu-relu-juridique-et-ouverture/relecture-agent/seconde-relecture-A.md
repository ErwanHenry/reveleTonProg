# Seconde relecture par agent : lot A corrigé, thème santé (19 mesures)

- Date : 2026-11-17
- Relecteur : agent IA, modèle Claude Opus 5.5 (claude-opus-5-5), second relecteur indépendant
- Périmètre : les 19 mesures `sante-*` modifiées par le correcteur dans le worktree `/Users/erwanhenry/claude-projects/reveleTonProg-relecture` (branche `relecture/sante`, changements non commités), candidats antoine-mikolajczak, bernard-cazeneuve, bruno-retailleau, christian-collovati, david-lisnard, delphine-batho, edouard-philippe, emmanuel-dubuisson, eric-zemmour, erwan-rohou, fabien-roussel, florian-philippot. Compte vérifié par `git status --porcelain` : 19 fichiers.
- Méthode :
  1. Relecture à l'aveugle, avant toute lecture des rapports : fichier de mesure, fiche source, extrait archivé lu autour de la citation et sur toute la page quand une rédaction dit ce que le document « ne dit pas » ; définitions du glossaire utilisées.
  2. Localisations par page vérifiées sur les PDF du dépôt privé `reveleTonProg-archives` avec `pdftotext -f N -l N` (Mikolajczak page 2, Retailleau page 9, Philippot page 5, Roussel page 15 : toutes exactes).
  3. Longueurs, longueur de phrase enfant et indice Kandel-Moles recalculés pour mes propositions avec les fonctions du dépôt (`words`, `sentences`, `kandelMoles`, `sansMarqueurs`), lancées depuis un script hors dépôt.
  4. Affichage : lecture de `Cellule.astro`, `Mesure.astro`, `themes/[id].astro` et `candidats/[id].astro` pour la formule « Son parti, ... ».
  5. Validateur lancé dans le worktree en mode production et preview.
  6. Puis seulement : lecture de `mesures-A.md`, `corrections-A.md` et `git diff` de chaque fichier.
- Limites : je suis un modèle qui relit des textes écrits et corrigés par des modèles ; nos biais peuvent se recouper. Je n'ai pas consulté les sites en direct. Les définitions du glossaire sont jugées sur leur exactitude générale, sans source primaire. Je n'ai rien modifié sous `src/`, `archives/`, `data/`, `config/`, `scripts/`, `tests/`.

## Validateur

- `fnm exec --using=24 node scripts/validate.ts --mode production` : 391 fichiers, 0 erreur, 23 avertissements, code de sortie 0.
- `--mode preview` : 0 erreur, 23 avertissements, code de sortie 0.
- Diagnostics sur les 19 fichiers (identiques dans les deux modes), tous `LISIBILITE_ENFANT_FAIBLE` (avertissement, jamais bloquant d'après `config.ts`) :
  - bruno-retailleau/sante-prescripteurs-atypiques-plafonds : Kandel-Moles 66,2 (seuil 80)
  - delphine-batho/sante-defenseur-constitution : 70,1
  - erwan-rohou/sante-usagers-conseil-administration : 61,9
  - florian-philippot/sante-simplifier-gestion-hospitaliere : 76,7
- Aucun mot interdit, aucun chiffre hors source, aucune longueur hors bornes sur ces fichiers.

## Champs protégés

`git diff` des 19 fichiers : aucune ligne de `texte_source`, `source`, `id`, `candidat`, `theme`, `sous_theme` ni `statut_relecture` n'est modifiée (aucune ligne indentée de deux espaces ni clé de premier niveau autre que celles ci-dessous). Clés de premier niveau modifiées : `source_localisation` (Mikolajczak, Batho x2, Philippe) et `titre` (Collovati AME, Roussel). Les 92 autres lignes modifiées sont dans `redactions`. Les quatre nouvelles localisations sont exactes (vérifiées sur l'extrait et, pour Mikolajczak, sur le PDF).

## Tableau de synthèse

| Mesure | Verdict | Motif en une ligne |
|---|---|---|
| antoine-mikolajczak/sante-alimentation-soins-territoire | conforme | Citation et page 2 vérifiées, quatre niveaux fidèles |
| bernard-cazeneuve/sante-grand-age-dependance | a_corriger | Résumé « familles modestes » élargit « familles les plus modestes » |
| bruno-retailleau/sante-prescripteurs-atypiques-plafonds | decision_editeur | Texte fidèle ; chiffrage du candidat (1,0 et 0,7 Md€) non écrivable sans champ `chiffrage` |
| bruno-retailleau/sante-reexamen-arrets-maladie | decision_editeur | Texte fidèle ; chiffrage du candidat (1,7 Md€) non écrivable sans champ `chiffrage` |
| christian-collovati/sante-reduction-ame | decision_editeur | Texte fidèle ; titre « Réduction ou suppression » et montant 1,2 Md à trancher |
| christian-collovati/sante-securite-sociale-endettement | a_corriger | Enfant : « Le texte ne dit pas comment il ferait » faux pour la page entière |
| david-lisnard/sante-conventionnement-differencie | conforme | Attribution au parti correcte, quatre niveaux fidèles |
| david-lisnard/sante-supprimer-ars | conforme | Attribution au parti correcte, quatre niveaux fidèles |
| delphine-batho/sante-defenseur-constitution | a_corriger | Aîné : « Elle veut » renvoie à « Cette personne » (le Défenseur) ; « ne définit pas » trop large ; enfant non attribué |
| delphine-batho/sante-deserts-medicaux | a_corriger | Enfant : « Un texte de loi est déjà écrit » à la voix du site |
| edouard-philippe/sante-sante-mentale-ecole | conforme | Doublon supprimé, présupposé retiré, localisation exacte |
| emmanuel-dubuisson/sante-parcours-soins-simple | conforme | Enfant désormais attribué, niveaux fidèles |
| eric-zemmour/sante-acces-soins-desertification | conforme | Attribution au parti, localisation et absences exactes |
| eric-zemmour/sante-supprimer-ame | conforme | Attribution au parti, citation entre guillemets, absences exactes |
| erwan-rohou/sante-egalite-acces-soins | decision_editeur | Aucun lien archivé entre le candidat et le Mouvement des Écologistes Indépendants |
| erwan-rohou/sante-usagers-conseil-administration | decision_editeur | Même lien manquant ; lisibilité enfant 61,9 |
| fabien-roussel/sante-remboursement-100-securite-sociale | a_corriger | Correction nouvelle : « la démocratie doit trancher » élargi au-delà des « zones floues » |
| florian-philippot/sante-simplifier-gestion-hospitaliere | conforme | Attribution au parti, livret nommé correctement, niveaux fidèles |
| florian-philippot/sante-soins-proximite-centres | a_corriger | Enfant : effet attendu (« moins de monde à l'hôpital ») à la voix du site |

Décompte : 8 conforme, 6 a_corriger, 5 decision_editeur.

## Affichage de « Son parti, ... »

- Page thème (`themes/[id].astro` puis `Cellule.astro`) : chaque mesure est rendue dans la carte du candidat, sous un `h3` portant son nom (lien vers sa page) et une ligne « Parti revendiqué : <parti> » tirée de la fiche candidat. Seule la première mesure est affichée dans la carte. « Son parti, Reconquête » se lit donc juste sous « Éric Zemmour » et « Parti revendiqué : Reconquête » : le lecteur sait de qui il s'agit.
- Page candidat (`candidats/[id].astro`) : `h1` au nom du candidat et même ligne « Parti revendiqué » ; les mesures (`Mesure.astro`) suivent. Même conclusion.
- Le titre de la mesure, affiché à tous les niveaux, ne nomme personne ; cela ne gêne pas tant que la carte nomme le candidat.
- Lisnard, Zemmour, Philippot, Roussel : le nom du parti écrit dans les rédactions correspond au champ `parti` de la fiche candidat, et ce champ a une `parti_source` de type parti. Pour Zemmour, Philippot et Roussel, l'extrait archivé ne nomme pas le candidat ; le lien personne et parti repose sur la fiche candidat, pas sur l'archive. Je l'accepte : c'est la donnée sourcée que le site affiche lui-même sur la ligne « Parti revendiqué ». Pour Lisnard, l'extrait porte aussi « David Lisnard 2027 » et « les citations de David Lisnard ».
- Rohou : la carte affiche « Sans étiquette de parti déclarée » (`parti: null`), puis une mesure qui parle du « Mouvement des Écologistes Indépendants ». Le lecteur ne peut pas savoir pourquoi ce mouvement parle pour Erwan Rohou. D'où le verdict `decision_editeur`.

## Détail par mesure

### 1. antoine-mikolajczak/sante-alimentation-soins-territoire : conforme

Relecture à l'aveugle :
- Citation présente mot pour mot sous « VIVRE EN BONNE SANTÉ » ; `pdftotext -f 2 -l 2` sur `956477af9fb0.pdf` confirme la page 2. Localisation exacte.
- Attribution : tract de campagne d'Équinoxe (« Équinoxe vous propose ») qui porte le nom, la photo-biographie du candidat et l'appel « Aidez nous à obtenir 500 parrainages ». Le document nomme le candidat et sert sa candidature : l'attribuer à Antoine Mikolajczak est admis. Les niveaux nomment bien le tract « du parti Équinoxe ».
- Fond : les quatre niveaux reprennent les trois éléments (alimentation de qualité, soins sur l'ensemble du territoire, qualité de l'air, de vie et de travail) sans ajout. Absences (moyens, date, chiffre, définition de « qualité », zones prioritaires) vraies pour tout le tract. Enfant : chaque phrase attribuée (« Il veut », « Le tract ne dit pas »).
Statut des constats du premier relecteur :
- Localisation page 1 : résolu (page 2, vérifiée sur le PDF).
- Portée de « sur tout le territoire » en enfant : résolu (« partout » sur les deux phrases).
Verdict : conforme.

### 2. bernard-cazeneuve/sante-grand-age-dependance : a_corriger

Relecture à l'aveugle :
- Citation exacte, proposition 5 de la liste « Les propositions de Bernard Cazeneuve ». Contexte page 19 lu : « dont il nous appartient d'assurer la soutenabilité financière pour les familles les plus modestes à moyen et long terme ».
- Détaillé, enfant, aîné : fidèles, « familles les plus modestes » respecté.
- Défaut (résumé, déjà présent avant correction, non relevé par le premier relecteur) : « avec une soutenabilité financière garantie aux familles modestes ». La source dit « aux familles les plus modestes ». « Les familles modestes » est un ensemble plus large que « les plus modestes » : la portée de la garantie est élargie.
- Glossaire `dependance` (« par exemple à cause de l'âge ») et `aidant-familial` : exacts.
Statut des constats du premier relecteur :
- « mieux prendre en charge » (enfant, aîné) : résolu, « mieux » retiré aux deux niveaux.
Correction demandée :
- Niveau : résumé.
- Texte actuel : « Bernard Cazeneuve veut prendre en charge le grand âge et la dépendance et soutenir les aidants familiaux, avec une soutenabilité financière garantie aux familles modestes. »
- Source : « dont la soutenabilité financière sera garantie aux familles les plus modestes ».
- Remplacement (24 mots) : « Bernard Cazeneuve veut prendre en charge grand âge et dépendance, soutenir les aidants familiaux, avec une soutenabilité financière garantie aux familles les plus modestes. »

### 3. bruno-retailleau/sante-prescripteurs-atypiques-plafonds : decision_editeur

Relecture à l'aveugle :
- Citation exacte, deuxième puce de « Ce que nous faisons », fiche 7 ; page 9 confirmée sur `0a56ad9b9bd2.pdf`.
- Fond fidèle aux quatre niveaux ; « en dispositif permanent » rendu par « de façon permanente » (aîné). Absences vérifiées sur toute la fiche : pas de définition du prescripteur atypique (la rubrique Pourquoi parle seulement de « prescriptions atypiques » qui « concentrent la dérive »), pas d'auteur de l'accord préalable, pas de durée du premier arrêt.
- Enfant : « Le texte vise des médecins qu'il appelle prescripteurs atypiques » : attribution correcte, sans distance ironique. « médecins » simplifie « prescripteurs » sans fausser.
- La même page chiffre les mesures : tableau « Md€ 2032 », « Prescripteurs atypiques 1,0 », « Plafonds de prescription 0,7 ». Aucun niveau ne dit qu'il n'y a pas de chiffre, donc rien n'est faux ; mais le chiffrage du candidat manque.
- Lisibilité enfant 66,2 : avertissement non bloquant.
Statut des constats du premier relecteur :
- « dits atypiques » : résolu.
- Chiffrage omis : non résolu, à juste titre (le validateur refuse un chiffre absent de `texte_source`).
Décision à prendre : publier sans le chiffrage du candidat, ou ajouter un champ `chiffrage` (texte « Prescripteurs atypiques 1,0 ; Plafonds de prescription 0,7 », localisation page 9, tableau Md€ 2032) puis une phrase au détaillé et à l'aîné.

### 4. bruno-retailleau/sante-reexamen-arrets-maladie : decision_editeur

Relecture à l'aveugle :
- Citation exacte, première puce, page 9 confirmée.
- Fond fidèle. Les quatre orientations (reprise adaptée, temps partiel thérapeutique, reconversion, invalidité) sont toutes présentes à chaque niveau. Enfant : « temps partiel » simplifie « temps partiel thérapeutique », acceptable.
- Absences : « à partir de quand courent ces délais » est littéralement vrai (le tableau dit seulement « Arrêts de plus de trois mois »), ainsi que « qui déciderait de l'orientation » et « en cas d'absence ». Enfant « Le texte ne dit pas quand ce serait mis en place » : vrai, la fiche ne donne que l'horizon de chiffrage 2032.
- Chiffrage du candidat présent sur la même page : « Réexamen à 3 et 6 mois 1,7 » (Md€ 2032), non repris.
Statut des constats du premier relecteur :
- « Il aiderait à choisir » : résolu.
- « date de début » ambiguë : résolu.
- Chiffrage 1,7 Md€ : non résolu, même contrainte du validateur.
Décision à prendre : publier sans le chiffrage, ou ajouter un champ `chiffrage` (« Réexamen à 3 et 6 mois 1,7 », Md€ 2032, page 9) et une phrase au détaillé.

### 5. christian-collovati/sante-reduction-ame : decision_editeur

Relecture à l'aveugle :
- Citation exacte : « - Réduire l'AME (Aide Médicale d'Etat)(1,3 milliard €) », sous « Constat de la situation actuelle en France ». Localisation exacte.
- Plus bas, sous « BUDGET avec chiffrages possibles », puis « Economies » : « Suppression AME : 1,2 Md ». Les quatre niveaux le disent maintenant (« avec un autre montant »), sans le chiffre. Le détaillé appelle la liste « liste d'économies intitulée Budget avec chiffrages possibles » : exact à la sous-rubrique près.
- Le sens du 1,3 milliard n'est pas expliqué par la page : le détaillé et l'aîné le disent, c'est exact.
- « veut réduire » pour une ligne à l'infinitif sous un intitulé « Constat » : lecture raisonnable, la ligne est prescriptive.
- Absences (de combien, qui, quand) vraies pour toute la page.
Statut des constats du premier relecteur :
- Suppression omise : résolu.
- Aîné « d'autres aides » faux : résolu (phrase supprimée).
- « objectifs » au lieu de « Constat » : résolu.
Décision à prendre : garder le titre « Réduction ou suppression de l'Aide médicale d'État » (exact, je le recommande) ou revenir à « Réduction » avec la suppression dans le texte ; et dire si le montant « 1,2 Md » doit être écrit via un champ `chiffrage`.

### 6. christian-collovati/sante-securite-sociale-endettement : a_corriger

Relecture à l'aveugle :
- Citation exacte, même liste « Constat ». Détaillé et aîné : les absences sont bornées à « Cette ligne », ce qui est exact. L'ajout sur la suspension d'un mois des versements, « dont les remboursements de la sécurité sociale », est fidèle à la liste des actions « dès ma prise de fonctions ».
- Défaut (enfant) : « Le texte ne dit pas comment il ferait. Il ne dit pas non plus quelles dépenses seraient touchées. » Pour un enfant, « le texte » est la page. Or la page prévoit la suspension d'un mois des versements sociaux et, sous « Economies », « Prestations sociales type RSA, APL, RMI, allocations familiales réservées aux français » et « Fraude sociale ». L'absence doit être bornée à la phrase, comme au détaillé.
- Remarque (détaillé, non bloquante) : le détaillé cite la suspension d'un mois mais pas la liste d'économies qui réserve plusieurs prestations sociales aux Français, alors qu'elle touche plus directement la « dépense sociale ». Ajout possible : « Plus bas, une liste d'économies chiffrées prévoit aussi de réserver plusieurs prestations sociales aux Français. »
- Classement : la ligne vise la dépense sociale et la dette des collectivités, la santé seulement par la sécurité sociale. À signaler au propriétaire, sans bloquer.
Statut des constats du premier relecteur :
- Remboursements dits non évoqués : résolu au détaillé et à l'aîné.
- « objectifs » : résolu.
- « comment l'endettement serait mesuré » : résolu (phrase supprimée).
Correction demandée :
- Niveau : enfant.
- Texte actuel : « Le texte ne dit pas comment il ferait. Il ne dit pas non plus quelles dépenses seraient touchées. »
- Source : « Prestations sociales type RSA, APL, RMI, allocations familiales réservées aux français » (même page, liste Economies).
- Remplacement : « Cette phrase ne dit pas comment il ferait. Elle ne dit pas non plus quelles dépenses seraient touchées. » (enfant complet : 43 mots, phrase la plus longue 10 mots, Kandel-Moles 83,6).

### 7. david-lisnard/sante-conventionnement-differencie : conforme

Relecture à l'aveugle :
- Citation exacte, point 1 de la page Santé de Nouvelle Énergie (« Nous proposons »). Auteur `parti_du_candidat` : les quatre niveaux ont le parti pour sujet ; « parti de David Lisnard » appuyé par la fiche candidat et par l'extrait (« David Lisnard 2027 »).
- Fond fidèle ; « rembourserait » rend le présent de définition. Absences (écart, actes, délimitation des zones, calendrier) vraies pour toute la page. Enfant : « Le remboursement y serait meilleur que dans les zones saturées » respecte le comparatif sans annoncer de baisse.
- Glossaire `zone-sous-dotee`, `securite-sociale` : exacts.
Statut des constats du premier relecteur :
- Attribution au candidat (résumé, enfant) : résolu.
- « moins bien remboursés » : résolu.
Verdict : conforme.

### 8. david-lisnard/sante-supprimer-ars : conforme

Relecture à l'aveugle :
- Citation exacte, point 2. Les trois éléments (suppression des ARS, transfert aux préfets et aux élus, présidence des conseils d'administration rendue aux maires) sont au détaillé et à l'aîné ; le résumé garde les deux premiers, sans déformer. Le jugement du parti sur les ARS (« forteresses comptables ») n'est pas repris : correct.
- Absences (responsabilités précises, personnel, calendrier, chiffrage) vraies pour toute la page.
- Glossaire `agence-regionale-de-sante`, `prefet`, `conseil-d-administration` : exacts.
Statut des constats du premier relecteur :
- « conseils d'administration actuels » : résolu (phrase supprimée).
- Attribution mêlée : résolu.
Verdict : conforme.

### 9. delphine-batho/sante-defenseur-constitution : a_corriger

Relecture à l'aveugle :
- Citation exacte sous « 05 Inscrire la pleine santé et le respect de l'habitabilité dans la Constitution ». Nouvelle localisation exacte.
- Défaut 1 (aîné, nouveau sens possible) : « Cette personne aurait des pouvoirs d'enquête ... Elle veut aussi inscrire la pleine santé ... » Le pronom « Elle » suit « Cette personne » (le Défenseur) : la phrase peut se lire comme une volonté du Défenseur.
- Défaut 2 (détaillé, aîné) : « L'extrait ne définit ni la pleine santé ni l'habitabilité » et « Le programme ne définit pas ces notions ». Le mot « extrait » désigne dans ce dépôt la page archivée entière, et la page s'ouvre par une description de la pleine santé : « une France de la pleine santé ... qui garantit à toutes et tous de boire et manger à sa faim, sans s'empoisonner, et d'être soigné ». L'absence n'est vraie que pour la proposition 05.
- Défaut 3 (enfant) : « Cela guiderait toutes les décisions publiques. » énonce, à la voix du site, l'effet attendu par la candidate.
- Lisibilité enfant 70,1 : avertissement non bloquant.
Statut des constats du premier relecteur :
- « priorité 1 » : résolu (localisation réécrite et vérifiée).
- Phrase agrammaticale : résolu.
Corrections demandées :
- Aîné, actuel « Elle veut aussi inscrire » ; remplacement « Delphine Batho veut aussi inscrire ». Actuel « Le programme ne définit pas ces notions » ; remplacement « La proposition ne définit pas ces notions ». (Aîné complet : 76 mots.)
- Détaillé, actuel « L'extrait ne définit ni la pleine santé ni l'habitabilité. Il ne dit pas comment ... » ; remplacement « La proposition ne définit ni la pleine santé ni l'habitabilité. Elle ne dit pas comment ... » (94 mots).
- Enfant, actuel « Cela guiderait toutes les décisions publiques. » ; source « pour guider toutes les politiques publiques » ; remplacement « Selon elle, cela guiderait toutes les décisions publiques. » (42 mots, phrase la plus longue 14, Kandel-Moles 70,6).

### 10. delphine-batho/sante-deserts-medicaux : a_corriger

Relecture à l'aveugle :
- Citation exacte sous « 04 Mettre fin aux déserts médicaux ». Localisation exacte. « sans citer d'étude » : vrai sur toute la page.
- Détaillé, aîné, résumé : fidèles et attribués (« qu'elle dit détaillée et prête », « Elle écrit que »).
- Défaut (enfant) : « Un texte de loi est déjà écrit. » est une affirmation de la candidate rendue à la voix du site. Source : « Une proposition de loi détaillée est prête ».
Statut des constats du premier relecteur :
- « priorité 1 » : résolu.
- Conditionnel « serait soutenue » : résolu.
Correction demandée :
- Niveau : enfant. Actuel « Un texte de loi est déjà écrit. » ; remplacement « Elle dit qu'un texte de loi est déjà prêt. » (enfant complet : 47 mots, phrase la plus longue 10, Kandel-Moles 84,7).

### 11. edouard-philippe/sante-sante-mentale-ecole : conforme

Relecture à l'aveugle :
- Citation exacte sous « Pour une école de la liberté et de l'exigence » ; nouvelle localisation exacte.
- Fond fidèle aux quatre niveaux. Absences (qui sont les tiers de confiance, moyens, date, organisation de la détection) vraies pour toute la page.
- Enfant : phrases au conditionnel qui décrivent la mesure, aucune affirmation du site. Glossaire `sante-mentale` : exact.
Statut des constats du premier relecteur :
- Phrase répétée : résolu.
- Recrutements présupposés : résolu.
- Localisation : résolu.
Verdict : conforme.

### 12. emmanuel-dubuisson/sante-parcours-soins-simple : conforme

Relecture à l'aveugle :
- Citation exacte, section « Un parcours de soins plus simple ». Localisation exacte.
- Fond fidèle. Résumé : « perde moins de temps en démarches inutiles » rend « soigner sans perdre son temps dans des démarches inutiles », acceptable. Absences (démarches supprimées, organisme, délai, budget, calendrier) vraies pour tout le dossier.
- Enfant : chaque phrase attribuée (« Pour lui », « Il ne veut pas », « Selon lui », « Il écrit »).
Statut des constats du premier relecteur :
- Enfant sans attribution : résolu.
Verdict : conforme.

### 13. eric-zemmour/sante-acces-soins-desertification : conforme

Relecture à l'aveugle :
- Citation exacte, dernière phrase du deuxième paragraphe de la rubrique « L'IMMIGRATION NÉGATIVE, MAINTENANT ! ». Le tract parle pour Reconquête et ne nomme pas le candidat : sujet « son parti, Reconquête » à tous les niveaux.
- « dans le même paragraphe que la suppression de l'aide médicale d'État » : exact. Absences vraies pour tout le tract.
- Enfant : « déserts médicaux » (glossaire : manque de médecins) puis une phrase séparée pour les pharmacies : fidèle à « désertification médicale et pharmaceutique ».
Statut des constats du premier relecteur :
- Attribution au candidat : résolu.
- Pharmacies rangées sous « déserts médicaux » : résolu.
Verdict : conforme.

### 14. eric-zemmour/sante-supprimer-ame : conforme

Relecture à l'aveugle :
- Citation exacte, deuxième paragraphe. Qualificatif « qui soigne les clandestins avec votre argent » cité entre guillemets et attribué au tract (résumé, détaillé, aîné).
- Enfant : « Son tract dit que cette aide soigne des étrangers en situation irrégulière » reformule « clandestins » en discours rapporté, attribué ; « avec votre argent » entre guillemets. Glossaire `aide-medicale-d-etat` : exact, neutre.
- Absences (date, remplacement, soins urgents, chiffre) vraies pour tout le tract.
Statut des constats du premier relecteur :
- Attribution : résolu.
- « votre argent » sans guillemets : résolu.
Verdict : conforme.

### 15. erwan-rohou/sante-egalite-acces-soins : decision_editeur

Relecture à l'aveugle :
- Citation exacte, proposition 6, sous « Consolider le lien social ». Fond fidèle ; la réserve « sans ignorer la nécessité de contenir les dépenses » est rendue comme une réserve au résumé, au détaillé et à l'aîné. Enfant « Le texte ajoute qu'il faut contenir les dépenses » : légère simplification, acceptable.
- Attribution : l'extrait (page programme) ne nomme jamais Erwan Rohou ; la fiche candidat a `parti: null` ; la fiche source dit `auteur: parti_du_candidat`. Les rédactions ne relient plus le candidat au mouvement : elles sont exactes, mais la carte du candidat affiche « Sans étiquette de parti déclarée » au-dessus d'un texte du Mouvement des Écologistes Indépendants.
Statut des constats du premier relecteur :
- Modalité du résumé : résolu.
- Lien candidat et mouvement : non résolu, correctement renvoyé au propriétaire.
- « limite de dépenses » : résolu.
Décision à prendre : archiver une page primaire qui établit le lien (accueil du mouvement), puis renseigner `parti` et écrire « Son mouvement, ... » ; ou retirer les deux mesures Rohou du thème tant que ce lien n'est pas sourcé.

### 16. erwan-rohou/sante-usagers-conseil-administration : decision_editeur

Relecture à l'aveugle :
- Citation exacte, proposition 38, sous « La démocratie pour construire le compromis ». Fond fidèle ; « à l'assurance chômage » pour « à l'UNEDIC » acceptable. Absences (sièges, désignation, pouvoirs) vraies.
- Enfant : « Par exemple, une association de patients à l'assurance maladie » ; la phrase de définition des usagers est neutre. Lisibilité 61,9 (avertissement).
- Même lien manquant que la mesure 15.
Statut des constats du premier relecteur :
- Lien candidat et mouvement : non résolu, renvoyé au propriétaire.
- « des patients » au lieu d'une association : résolu.
Décision à prendre : la même que la mesure 15 ; en cas de maintien, raccourcir aussi l'enfant pour remonter la lisibilité (non bloquant).

### 17. fabien-roussel/sante-remboursement-100-securite-sociale : a_corriger

Relecture à l'aveugle :
- Citation exacte, page 15 du cahier (confirmée sur le PDF). Cahier du PCF qui ne nomme pas le candidat : sujet « le cahier » ou « le Parti communiste français, parti de Fabien Roussel », conforme à la fiche candidat.
- Absences de date et de coût : vraies (le chiffre de 100 milliards, page 21, concerne les retraites).
- Défaut (détaillé, aîné ; introduit par la correction) : « et que la démocratie doit trancher ce qui doit être remboursé ». La source dit d'abord « La science est l'arbitre! », puis « Mais il reste des zones floues, en débat, ... c'est la démocratie qui doit trancher ce qui doit être remboursé ». Le rôle de la démocratie est limité aux zones floues ; la correction l'étend à tout le périmètre du remboursement et omet que la science est l'arbitre.
- Enfant, résumé : fidèles.
Statut des constats du premier relecteur :
- « ne dit pas quels soins » : partiellement résolu, avec un élargissement nouveau (voir ci-dessus).
- Titre sans « vers » : résolu.
Corrections demandées :
- Détaillé, actuel « Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui doit être remboursé. » ; remplacement « Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles. Il ajoute que la science est l'arbitre et que, pour les zones floues encore en débat, la démocratie doit trancher ce qui doit être remboursé. » (détaillé complet : 122 mots).
- Aîné, actuel « Le cahier précise qu'il ne s'agirait ni d'un panier de soins limité ni des médecines parallèles, et que la démocratie doit trancher ce qui doit être remboursé. » ; remplacement « Le cahier exclut un panier de soins limité et les médecines parallèles, et confie à la démocratie les zones floues encore en débat. » (aîné complet : 95 mots).

### 18. florian-philippot/sante-simplifier-gestion-hospitaliere : conforme

Relecture à l'aveugle :
- Citation exacte, page 5 du PDF (confirmée), paragraphe « Réduire la bureaucratie et rendre aux soignants la maîtrise de leur métier ». Livret qui parle pour « notre mouvement » sans nommer le candidat : sujet « son parti, Les Patriotes » ; nom du livret exact (couverture « Grandes orientations pour un projet patriote »).
- Fond fidèle ; « bureaucratie qui pèse sur les soignants » rend le paragraphe. Absences vérifiées sur tout le livret : aucune liste des obligations inutiles, aucune autorité qui reprendrait les missions des ARS, aucune date.
- Lisibilité enfant 76,7 : avertissement non bloquant.
Statut des constats du premier relecteur :
- Attribution, « que dirige », nom du document, « bureaucratie des soignants » : tous résolus.
Verdict : conforme.

### 19. florian-philippot/sante-soins-proximite-centres : a_corriger

Relecture à l'aveugle :
- Citation exacte, page 5, paragraphe « Investir massivement dans les soins de proximité pour désengorger l'hôpital ». Attribution et nom du livret corrects. Absences (nombre, emplacement, montant, professionnels) vraies pour le livret.
- Défaut (enfant) : « Il y aurait ainsi moins de monde à l'hôpital. » énonce, à la voix du site, l'effet que le parti attend (« pour désengorger l'hôpital »). Les autres phrases de l'enfant décrivent la mesure ; celle-ci affirme un résultat.
- Remarque non bloquante : le résumé omet « massivement ».
Statut des constats du premier relecteur :
- Attribution, « que dirige », nom du document : résolus.
Correction demandée :
- Niveau : enfant. Actuel « Il y aurait ainsi moins de monde à l'hôpital. » ; remplacement « Selon lui, il y aurait ainsi moins de monde à l'hôpital. » (enfant complet : 59 mots, phrase la plus longue 13, Kandel-Moles 88,5).

## Désaccords avec le correcteur ou le premier relecteur

1. Roussel : la correction proposée par le premier relecteur et appliquée par le correcteur (« la démocratie doit trancher ce qui doit être remboursé ») élargit la source, qui réserve ce rôle aux « zones floues, en débat » après avoir écrit « La science est l'arbitre ». Correction mal « résolue ».
2. Cazeneuve : le premier relecteur juge le résumé fidèle ; il élargit « les familles les plus modestes » en « familles modestes ».
3. Batho Constitution : le premier relecteur juge le fond fidèle ; la phrase « L'extrait ne définit ni la pleine santé » est trop large (la page décrit la pleine santé), et la correction n'a pas vu l'ambiguïté du pronom « Elle » après « Cette personne » à l'aîné.
4. Attribution des phrases enfant : le premier relecteur a relevé ce défaut pour Dubuisson seulement. Je relève le même défaut pour Batho déserts (« Un texte de loi est déjà écrit »), Batho Constitution (« Cela guiderait ») et Philippot centres (« Il y aurait ainsi moins de monde à l'hôpital »). Je laisse passer les phrases au conditionnel qui décrivent le mécanisme d'une mesure ; je demande l'attribution pour les affirmations de fait ou d'effet attendu.
5. Collovati endettement : le correcteur a borné les absences à « Cette ligne » au détaillé et à l'aîné, mais pas à l'enfant, où « Le texte ne dit pas comment il ferait » reste faux pour la page.
6. Accords avec le correcteur sur ses refus : « Le médecin orienterait » (Retailleau) non repris, car la source ne dit pas qui oriente : d'accord. « Le texte ne dit pas comment » (Dubuisson) non ajouté : d'accord. Chiffrages Retailleau et Collovati non écrits : d'accord, ils relèvent du propriétaire. Formule « Son parti, ... » : d'accord, l'affichage nomme le candidat juste au-dessus (voir la section Affichage).

## Bloc lisible par script

```json
[
  { "cible": "mesure:antoine-mikolajczak/sante-alimentation-soins-territoire", "verdict": "conforme", "motif": "Citation et page 2 vérifiées sur le PDF, quatre niveaux fidèles et attribués" },
  { "cible": "mesure:bernard-cazeneuve/sante-grand-age-dependance", "verdict": "a_corriger", "motif": "Résumé : « familles modestes » élargit « familles les plus modestes »" },
  { "cible": "mesure:bruno-retailleau/sante-prescripteurs-atypiques-plafonds", "verdict": "decision_editeur", "motif": "Texte fidèle ; chiffrage du candidat (1,0 et 0,7 Md€ en 2032) non écrivable sans champ chiffrage" },
  { "cible": "mesure:bruno-retailleau/sante-reexamen-arrets-maladie", "verdict": "decision_editeur", "motif": "Texte fidèle ; chiffrage du candidat (1,7 Md€ en 2032) non écrivable sans champ chiffrage" },
  { "cible": "mesure:christian-collovati/sante-reduction-ame", "verdict": "decision_editeur", "motif": "Texte fidèle ; titre « Réduction ou suppression » et montant 1,2 Md de la suppression à trancher" },
  { "cible": "mesure:christian-collovati/sante-securite-sociale-endettement", "verdict": "a_corriger", "motif": "Enfant : « Le texte ne dit pas comment il ferait » faux pour la page, à borner à « Cette phrase »" },
  { "cible": "mesure:david-lisnard/sante-conventionnement-differencie", "verdict": "conforme", "motif": "Attribution au parti correcte, comparatif respecté, absences exactes" },
  { "cible": "mesure:david-lisnard/sante-supprimer-ars", "verdict": "conforme", "motif": "Attribution au parti correcte, trois éléments fidèles, absences exactes" },
  { "cible": "mesure:delphine-batho/sante-defenseur-constitution", "verdict": "a_corriger", "motif": "Aîné : « Elle » renvoie au Défenseur ; « ne définit pas » trop large ; enfant « Cela guiderait » non attribué" },
  { "cible": "mesure:delphine-batho/sante-deserts-medicaux", "verdict": "a_corriger", "motif": "Enfant : « Un texte de loi est déjà écrit » à la voix du site" },
  { "cible": "mesure:edouard-philippe/sante-sante-mentale-ecole", "verdict": "conforme", "motif": "Doublon et présupposé retirés, localisation exacte, niveaux fidèles" },
  { "cible": "mesure:emmanuel-dubuisson/sante-parcours-soins-simple", "verdict": "conforme", "motif": "Enfant désormais attribué, niveaux fidèles" },
  { "cible": "mesure:eric-zemmour/sante-acces-soins-desertification", "verdict": "conforme", "motif": "Attribution au parti, localisation et absences exactes" },
  { "cible": "mesure:eric-zemmour/sante-supprimer-ame", "verdict": "conforme", "motif": "Attribution au parti, qualificatif cité entre guillemets, absences exactes" },
  { "cible": "mesure:erwan-rohou/sante-egalite-acces-soins", "verdict": "decision_editeur", "motif": "Aucun lien archivé entre Erwan Rohou et le Mouvement des Écologistes Indépendants ; parti null" },
  { "cible": "mesure:erwan-rohou/sante-usagers-conseil-administration", "verdict": "decision_editeur", "motif": "Même lien manquant ; lisibilité enfant 61,9" },
  { "cible": "mesure:fabien-roussel/sante-remboursement-100-securite-sociale", "verdict": "a_corriger", "motif": "Correction nouvelle : rôle de la démocratie élargi au-delà des « zones floues », science arbitre omise" },
  { "cible": "mesure:florian-philippot/sante-simplifier-gestion-hospitaliere", "verdict": "conforme", "motif": "Attribution au parti, nom du livret exact, absences vérifiées" },
  { "cible": "mesure:florian-philippot/sante-soins-proximite-centres", "verdict": "a_corriger", "motif": "Enfant : « Il y aurait ainsi moins de monde à l'hôpital » à la voix du site" }
]
```

## Contrôle des retouches (2026-11-17)

État relu : commit `6f75573` de la branche `relecture/sante` (worktree propre). Pour chacune des six mesures, relecture complète des quatre niveaux, du titre et de la localisation contre l'extrait archivé, recomptage avec les fonctions du dépôt, validateur relancé (production et preview : 0 erreur, 22 avertissements ; sur ces six fichiers, seul `LISIBILITE_ENFANT_FAIBLE` 70,6 pour Batho Constitution, non bloquant). `git show HEAD` : seules des lignes de `redactions` changent pour ces six fichiers ; `texte_source`, `source`, `sous_theme`, `statut_relecture` intacts. Les remplacements sont appliqués mot pour mot.

- bernard-cazeneuve/sante-grand-age-dependance : conforme. Résumé (24 mots) dit désormais « familles les plus modestes », comme le détaillé, l'enfant et l'aîné ; style elliptique (« grand âge et dépendance ») sans perte de sens.
- christian-collovati/sante-securite-sociale-endettement : conforme. Enfant (43 mots, Kandel-Moles 83,6) borne l'absence à « Cette phrase », cohérent avec « Cette ligne » au détaillé et à l'aîné ; l'ajout facultatif sur la liste d'économies n'a pas été fait, ce qui reste acceptable.
- delphine-batho/sante-defenseur-constitution : conforme. Aîné nomme « Delphine Batho » (plus d'ambiguïté avec le Défenseur) ; détaillé et aîné bornent l'absence de définition à « La proposition » (vrai pour la proposition 05) ; enfant attribué (« Selon elle ») ; lisibilité enfant 70,6, avertissement non bloquant.
- delphine-batho/sante-deserts-medicaux : conforme. Enfant (47 mots) : « Elle dit qu'un texte de loi est déjà prêt », cohérent avec « qu'elle dit détaillée et prête » au détaillé ; toutes les phrases attribuées ou au conditionnel.
- fabien-roussel/sante-remboursement-100-securite-sociale : conforme. Détaillé (122 mots) : science arbitre, démocratie limitée aux « zones floues encore en débat », conforme à la page 15 ; aîné (95 mots) dit la même chose plus brièvement ; résumé, enfant et titre inchangés et cohérents.
- florian-philippot/sante-soins-proximite-centres : conforme. Enfant (59 mots, plafond 60) : effet attendu attribué (« Selon lui ») ; « lui » renvoie à « Son parti, Les Patriotes », sujet de la première phrase ; les quatre niveaux concordent.

Décompte final : 14 conforme, 5 decision_editeur, 0 a_corriger.

### Verdicts finaux après contrôle des retouches (bloc à lire par script, remplace le précédent)

```json
[
  { "cible": "mesure:antoine-mikolajczak/sante-alimentation-soins-territoire", "verdict": "conforme", "motif": "Citation et page 2 vérifiées sur le PDF, quatre niveaux fidèles et attribués" },
  { "cible": "mesure:bernard-cazeneuve/sante-grand-age-dependance", "verdict": "conforme", "motif": "Retouche vérifiée : résumé dit « familles les plus modestes », quatre niveaux cohérents" },
  { "cible": "mesure:bruno-retailleau/sante-prescripteurs-atypiques-plafonds", "verdict": "decision_editeur", "motif": "Texte fidèle ; chiffrage du candidat (1,0 et 0,7 Md€ en 2032) non écrivable sans champ chiffrage" },
  { "cible": "mesure:bruno-retailleau/sante-reexamen-arrets-maladie", "verdict": "decision_editeur", "motif": "Texte fidèle ; chiffrage du candidat (1,7 Md€ en 2032) non écrivable sans champ chiffrage" },
  { "cible": "mesure:christian-collovati/sante-reduction-ame", "verdict": "decision_editeur", "motif": "Texte fidèle ; titre « Réduction ou suppression » et montant 1,2 Md de la suppression à trancher" },
  { "cible": "mesure:christian-collovati/sante-securite-sociale-endettement", "verdict": "conforme", "motif": "Retouche vérifiée : absences bornées à la phrase à tous les niveaux" },
  { "cible": "mesure:david-lisnard/sante-conventionnement-differencie", "verdict": "conforme", "motif": "Attribution au parti correcte, comparatif respecté, absences exactes" },
  { "cible": "mesure:david-lisnard/sante-supprimer-ars", "verdict": "conforme", "motif": "Attribution au parti correcte, trois éléments fidèles, absences exactes" },
  { "cible": "mesure:delphine-batho/sante-defenseur-constitution", "verdict": "conforme", "motif": "Retouches vérifiées : sujet explicite à l'aîné, absence bornée à la proposition, enfant attribué" },
  { "cible": "mesure:delphine-batho/sante-deserts-medicaux", "verdict": "conforme", "motif": "Retouche vérifiée : enfant attribué, cohérent avec le détaillé" },
  { "cible": "mesure:edouard-philippe/sante-sante-mentale-ecole", "verdict": "conforme", "motif": "Doublon et présupposé retirés, localisation exacte, niveaux fidèles" },
  { "cible": "mesure:emmanuel-dubuisson/sante-parcours-soins-simple", "verdict": "conforme", "motif": "Enfant désormais attribué, niveaux fidèles" },
  { "cible": "mesure:eric-zemmour/sante-acces-soins-desertification", "verdict": "conforme", "motif": "Attribution au parti, localisation et absences exactes" },
  { "cible": "mesure:eric-zemmour/sante-supprimer-ame", "verdict": "conforme", "motif": "Attribution au parti, qualificatif cité entre guillemets, absences exactes" },
  { "cible": "mesure:erwan-rohou/sante-egalite-acces-soins", "verdict": "decision_editeur", "motif": "Aucun lien archivé entre Erwan Rohou et le Mouvement des Écologistes Indépendants ; parti null" },
  { "cible": "mesure:erwan-rohou/sante-usagers-conseil-administration", "verdict": "decision_editeur", "motif": "Même lien manquant ; lisibilité enfant 61,9" },
  { "cible": "mesure:fabien-roussel/sante-remboursement-100-securite-sociale", "verdict": "conforme", "motif": "Retouche vérifiée : rôle de la démocratie limité aux zones floues, science arbitre, aîné cohérent" },
  { "cible": "mesure:florian-philippot/sante-simplifier-gestion-hospitaliere", "verdict": "conforme", "motif": "Attribution au parti, nom du livret exact, absences vérifiées" },
  { "cible": "mesure:florian-philippot/sante-soins-proximite-centres", "verdict": "conforme", "motif": "Retouche vérifiée : effet attendu attribué au parti, enfant 59 mots" }
]
```

## Contrôle du niveau enfant sans nom de parti (2026-11-17)

Commit relu : `38b8d93` (9 fichiers, une ligne `enfant` chacun : « Son parti, <nom>, » devient « Son parti »). Rien d'autre ne change. Longueurs recomptées avec les fonctions du dépôt. Les trois autres niveaux nomment toujours le parti, et la carte du candidat affiche « Parti revendiqué : <parti> » juste au-dessus de la mesure. Pour les trois mesures hors de mon lot, les fiches source ont `auteur: parti_du_candidat` et le parti est celui de la fiche candidat (Debout la France, Place publique). Je n'ai relu que le changement et la cohérence du niveau enfant, pas le fond déjà jugé par l'autre relecteur.

- david-lisnard/sante-conventionnement-differencie : conforme (44 mots, phrase la plus longue 11) ; « Il ne dit pas » renvoie à « Le texte ».
- david-lisnard/sante-supprimer-ars : conforme (42 mots, 12) ; « Il confierait » renvoie au parti.
- eric-zemmour/sante-acces-soins-desertification : conforme (40 mots, au plancher, 10) ; « Il parle aussi », « Il veut » renvoient au parti.
- eric-zemmour/sante-supprimer-ame : conforme (46 mots, 12) ; « Son tract » se lit comme le tract du parti, sujet de la phrase précédente.
- florian-philippot/sante-simplifier-gestion-hospitaliere : conforme (41 mots, 11 ; Kandel-Moles 78,4, avertissement non bloquant).
- florian-philippot/sante-soins-proximite-centres : conforme (57 mots, 12) ; « Selon lui » renvoie toujours au parti, seul sujet singulier avant lui.
- nicolas-dupont-aignan/sante-fin-passe-sanitaire : conforme (41 mots, 10) ; « Il l'écrit dans la page Santé de son projet » reste vrai pour un document du parti.
- nicolas-dupont-aignan/sante-lits-etablissements : conforme (53 mots, 12).
- raphael-glucksmann/sante-projet-territorial-sante : conforme pour ce changement (49 mots, 14).

Avis sur l'alternative (nommer le parti avec une entrée de glossaire de type `parti`) : pour un enfant, le nom seul apporte peu, puisque la carte l'affiche déjà, et une définition d'une phrase par parti ajouterait un mot difficile à chaque texte. Pour la neutralité, définir chaque parti oblige à une description équivalente et sourcée pour tous, avec un risque d'étiquette de positionnement. « Son parti » sans nom est donc préférable. Si un terme doit être expliqué, un seul terme générique « parti politique » au glossaire vaut mieux.

Les verdicts du dernier bloc JSON ci-dessus sont inchangés pour mes 19 mesures.
