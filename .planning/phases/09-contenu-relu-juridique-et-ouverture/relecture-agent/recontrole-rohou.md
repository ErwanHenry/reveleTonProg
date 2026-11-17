# Recontrôle Rohou (santé, fiche candidat, sources) du 2026-11-17

Relecteur : agent indépendant, en lecture seule sur le worktree `reveleTonProg-relecture` (branche `relecture/sante`, modifications non commitées).

Extraits lus en entier : `archives/erwan-rohou/4bcf24185901.txt` (programme, 600 lignes) et `archives/erwan-rohou/ac03771a1fbf.txt` (communiqué, 154 lignes). Validateur `node scripts/validate.ts --mode preview` (Node 24) : 0 erreur, 18 avertissements au total, dont 1 sur le périmètre (voir mesure 2).

## Ce qui établit le lien entre le candidat et le mouvement

Extrait `ac03771a1fbf.txt` :

- ligne 98 : « Erwan ROHOU, candidat du MEI aux élections présidentielles. »
- lignes 100 à 104 : « le Mouvement Écologiste Indépendant, réuni lors de ses journées d’été, a décidé de présenter un candidat à l’élection présidentielle 2027. Ce candidat sera Erwan Rohou. »
- ligne 108 : « Membre du bureau national du MEI depuis 5 ans, Erwan Rohou […] »

Extrait `4bcf24185901.txt` :

- ligne 98 : « Le programme du MEI »
- ligne 104 : « Le programme du Mouvement Écologiste Indépendant part d’un constat […] »

Le candidat est membre du bureau national du mouvement et le mouvement le présente comme son candidat : « son parti » est appuyé. Le document cité est le programme du mouvement, et c'est ce que disent les rédactions (« Son parti […] dans son programme », « Son parti a fait un programme »). Aucune rédaction ne présente le programme comme celui du candidat en personne. Le nom est écrit « Mouvement Écologiste Indépendant » dans les deux pages archivées, comme dans les rédactions.

## Mesure 1 : `src/content/mesures/erwan-rohou/sante-egalite-acces-soins.yaml`

Verdict : **à corriger** (un écart mineur, niveau enfant).

- `texte_source` : identique à la ligne 184 de l'extrait, aux apostrophes près. Conforme.
- `source_localisation` « proposition n° 6 du programme » : le numéro « 6 » est seul à la ligne 182, juste avant le texte (ligne 184). La section, citée seulement dans `detaille` (« Consolider le lien social »), est à la ligne 178, sans autre titre entre 178 et 184. Conforme.
- `titre` : fidèle.
- `resume`, `detaille`, `aine` : fidèles, attribution exacte, aucun mot interdit, aucun adjectif de valeur ajouté, aucun nombre en chiffres (« quatre » en lettres). Les mentions de ce que le texte ne dit pas (moyens, date, chiffre, niveau de dépenses) sont exactes.
- Cohérence : même contenu aux quatre niveaux, sauf le point ci-dessous.

Écart 1 (fidélité, niveau `enfant`)

- Phrase en cause : « Le texte ajoute qu'il faut contenir les dépenses. »
- Preuve : ligne 184, « l’accès aux soins (sans ignorer la nécessité de contenir les dépenses) ». La réserve porte sur les soins seulement et le texte dit « sans ignorer la nécessité de », pas « il faut ». Isolée après l'énumération des quatre égalités, la phrase enfant peut se lire comme une règle générale sur toutes les dépenses. Les niveaux `resume`, `detaille` et `aine` rattachent bien la réserve aux soins.
- Correction proposée : « Pour les soins, le texte ajoute qu'il faut aussi penser à contenir les dépenses. »

Remarque non bloquante, `detaille` : « Le texte ne dit pas comment l'accès aux soins serait garanti, par quels moyens ni à quelle date » répète la même idée (« comment » et « par quels moyens »). Formulation possible : « Le texte ne dit pas par quels moyens l'accès aux soins serait garanti, ni à quelle date. »

## Mesure 2 : `src/content/mesures/erwan-rohou/sante-usagers-conseil-administration.yaml`

Verdict : **à corriger** (un écart mineur, niveau détaillé, plus un avertissement du validateur à lever avant publication).

- `texte_source` : identique à la ligne 556 de l'extrait, aux apostrophes près. Conforme.
- `source_localisation` « proposition n° 39 du programme » : le numéro « 39 » est seul à la ligne 554, juste avant le texte (ligne 556). Le n° 38 (ligne 550) porte sur le référendum d'initiative populaire, donc la correction de 38 à 39 est juste. La section citée dans `detaille` (« La démocratie pour construire le compromis ») est à la ligne 532, sans autre titre entre 532 et 556. Conforme.
- `titre`, `resume`, `enfant`, `aine` : fidèles, attribution exacte, aucun mot interdit, aucun nombre en chiffres. « employeurs » pour « patronat » (enfant) est une simplification juste.
- Cohérence : même contenu aux quatre niveaux.

Écart 2 (fidélité, niveau `detaille`)

- Phrase en cause : « Il donne des exemples : une association de chômeurs à l'assurance chômage et une association de patients à l'assurance maladie. »
- Preuve : ligne 556, « association de chômeurs à l’UNEDIC ». La source nomme un organisme précis, l'UNEDIC ; « l'assurance chômage » remplace ce nom par une notion plus large, ce qui est une interprétation.
- Correction proposée : « Il donne des exemples : une association de chômeurs à l'UNEDIC et une association de patients à l'assurance maladie. »

Avertissement du validateur (niveau `enfant`)

- `LISIBILITE_ENFANT_FAIBLE` : indice Kandel-Moles 69,0, seuil 80. Ce n'est qu'un avertissement en brouillon, mais la règle bloquera au statut publié. Pistes : raccourcir « Les usagers sont les personnes qui utilisent ces services. » et « Ils y seraient avec les représentants des salariés et des employeurs. », par exemple « Ils seraient à côté de ceux qui parlent pour les salariés et les patrons. » Sans incidence sur la fidélité.

Remarque non bloquante, `resume` : « veut faire entrer » traduit « sont introduits ». C'est admissible pour une proposition. « propose de faire entrer » serait plus proche du verbe employé au niveau détaillé et aîné.

## Fiche candidat : `src/content/candidats/erwan-rohou.yaml`

Verdict : **conforme**.

- `parti: Mouvement Écologiste Indépendant` : appuyé par `ac03771a1fbf.txt`, ligne 100, « le Mouvement Écologiste Indépendant, réuni lors de ses journées d’été, a décidé de présenter un candidat à l’élection présidentielle 2027 », ligne 104, « Ce candidat sera Erwan Rohou. », et ligne 108, « Membre du bureau national du MEI depuis 5 ans ». Graphie identique à la page archivée.
- `parti_source.url` : identique à l'adresse de la source `erwan-rohou-communique-mei-candidature`, dont l'extrait est celui cité. `date_consultation` 2026-11-17 cohérente avec `capture_le` 2026-11-17T22:59:59+01:00.

Source du communiqué (`src/content/sources/erwan-rohou-communique-mei-candidature.yaml`), point à vérifier :

- `date_publication: 2026-09-04` n'apparaît nulle part dans l'extrait. L'extrait renvoie même à un « article du 29 septembre 2026 » (ligne 114) et à une réunion du 2 octobre (ligne 116) : la page a donc été modifiée après le 4 septembre. Si la date vient des métadonnées de la page brute (binaire archivé), c'est acceptable, mais il faut le noter ; sinon, remplacer par la précision que l'extrait permet (par exemple `2026-09`, ou la date de la page brute).
- Le mot « communiqué » du `titre` n'est pas écrit sur la page ; le titre affiché est « Erwan ROHOU, candidat du MEI aux élections présidentielles. » (ligne 98). Non bloquant.
- Données personnelles : aucune. Les seules personnes nommées sont le candidat et Antoine Waechter, directeur de campagne et personnalité publique (ligne 112). Pas d'adresse électronique, de téléphone ni d'adresse postale.

## Source du programme : `src/content/sources/erwan-rohou-programme-mei.yaml`

Verdict : **conforme**, avec une remarque.

- `titre` « Mouvement Écologiste Indépendant, Le programme du MEI : Pour une France qui serve l'avenir » : conforme aux lignes 98 à 102 (« Le programme du MEI », « Pour une France qui », « serve l’avenir ») et 104.
- `url` et `date_consultation` 2026-11-17 cohérentes avec `capture_le` 2026-11-17T22:59:18+01:00.
- `date_publication: 2026-11` : aucune date de publication dans l'extrait (les seules années citées sont 2021, 2014, 1950 à 2000 et 2027). Valeur reprise de l'ancienne fiche, non vérifiable dans le nouvel extrait. À confirmer d'après la page brute, ou à documenter.
- Suppression de `wayback_exception` : justifiée sur l'extrait. Recherche faite (adresses électroniques, numéros de téléphone, adresses postales, noms propres) : aucune donnée personnelle de particulier. Personnes nommées : Erwan Rohou (menu), François Hollande et Sébastien Lecornu (ligne 560), personnalités publiques.
- Constat technique sans effet sur les mesures : un bloc de texte est répété dans l'extrait (par exemple lignes 274 et 356, 308 et 412), entre les propositions 17 (ligne 250) et 18 (ligne 440). Les numéros 1 à 40 apparaissent chacun une seule fois et dans l'ordre.
- L'ancien extrait `e4e379a88baa.txt` n'est plus cité par aucun fichier de `src/`, `scripts/`, `schemas/` ou `tests/`.

## Localisations des deux mesures Europe et monde

- `europe-et-monde-onu-siege-oslo.yaml`, « section La nécessité d'une gouvernance mondiale et le respect du droit, proposition n° 31 » : titre de section ligne 508, numéro « 31 » ligne 512, texte identique ligne 514. **Conforme.**
- `europe-et-monde-droit-international-nuremberg.yaml`, même section, « proposition n° 32 » : numéro « 32 » ligne 516, texte identique ligne 518. **Conforme.**

Hors périmètre, signalé pour suite : les rédactions détaillées et aînées de ces deux mesures et des deux mesures « travail » de Rohou écrivent encore « Mouvement des Écologistes Indépendants » et « dont Erwan Rohou est le candidat selon l'accueil du mouvement ». Elles citent pourtant maintenant le nouvel extrait, qui écrit « Mouvement Écologiste Indépendant », et la règle du parti a changé. À aligner dans une passe séparée.

## Synthèse

Mesure accès aux soins : à corriger (enfant, réserve sur les dépenses à rattacher aux soins). Mesure usagers : à corriger (détaillé, « UNEDIC » au lieu de « assurance chômage » ; lisibilité enfant 69,0 à relever avant publication). Fiche candidat : conforme. Source du programme : conforme (date de publication non vérifiable dans l'extrait). Source du communiqué : date de publication 2026-09-04 absente de l'extrait, à justifier. Localisations n° 31 et n° 32 : conformes. Aucune attribution abusive, aucun mot interdit, aucun chiffre hors source, aucune donnée personnelle.

## Recontrôle après corrections

Relecture complète des deux fichiers (titre, `texte_source`, localisation, quatre niveaux), avec les mêmes critères qu'au premier contrôle. Dans `src/content/mesures/erwan-rohou/`, le diff ne touche que les deux mesures santé et les deux numéros de proposition (31 et 32) déjà contrôlés. Validateur : 0 erreur.

- `sante-egalite-acces-soins.yaml` : **conforme**. Au niveau `enfant`, la phrase est devenue « Pour les soins, le texte ajoute qu'il faut aussi contenir les dépenses. » La réserve est maintenant rattachée aux soins, comme dans la source (ligne 184, « l’accès aux soins (sans ignorer la nécessité de contenir les dépenses) »). « il faut aussi contenir » est une simplification admissible de « sans ignorer la nécessité de » pour ce niveau. Les autres niveaux n'ont pas changé et restent fidèles. Les quatre niveaux sont cohérents.
- `sante-usagers-conseil-administration.yaml` : **conforme** sur la fidélité, l'attribution, la neutralité et les chiffres. Au niveau `detaille`, la phrase est devenue « une association de chômeurs à l'UNEDIC et une association de patients à l'assurance maladie », identique à la source (ligne 556). Les autres niveaux n'ont pas changé. L'avertissement `LISIBILITE_ENFANT_FAIBLE` (69,0, seuil 80) reste au niveau `enfant`. Il ne bloque pas en brouillon mais devra être levé avant le passage au statut publié.

Date du communiqué (`date_publication: 2026-09-04`) : la justification suffit. `article:published_time` et `datePublished`, dans les métadonnées structurées de la page, donnent la date de première publication. Le renvoi à un article du 29 septembre montre seulement que la page a été mise à jour ensuite, ce qui ne change pas la date de première publication. Deux conditions : noter la provenance de la date (métadonnées de la copie privée, pas l'extrait) dans la fiche source ou dans le rapport d'archivage, et vérifier que le `binaire_sha256` de la fiche correspond bien à la copie qui contient ces métadonnées.

Synthèse finale : les deux mesures santé sont conformes, avec un seul point qui reste avant publication, la lisibilité enfant de la mesure sur les usagers. La date du communiqué est acceptée si sa provenance est notée.
