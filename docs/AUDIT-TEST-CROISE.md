# Audit croisé simulé

Protocole de l'audit où des agents jouent trois lecteurs (un enfant de 10 ans, un retraité de 72 ans, un journaliste) sur une build locale du site. Ce document est écrit et committé avant toute passe : le scénario, les résultats attendus et les critères de notation sont fixés ici, puis les résultats sont ajoutés dans les sections prévues à cet effet.

## Passe du 4 novembre 2026

| Élément | Valeur |
|---|---|
| Date | 2026-11-04 |
| Commit | `b9b872bb9667c4102526d73325b7539a15d91bc7` |
| Build `dist-e2e/reel` | mode preview (vrai corpus, brouillons visibles, bandeau d'aperçu), empreinte `34504b3e9aa9224468b277ac064db1363e71a132dab8950d3b9c22977ddbd37c` |
| Build `dist-e2e/m1` | mode production (fixture M1), empreinte `09ec3e3a7c52bb49f581c4def4e5cb37057c4153c0b789218494d51d407c9e2d` |
| Suite navigateur avant la passe | `npm run e2e` vert : 222 tests sur la fixture, 1032 sur le vrai corpus |

Les empreintes se recalculent avec `node scripts/audit-lire.ts --dist <dossier> --empreinte`.

## Objet et limites

- Les lecteurs sont des agents simulés qui lisent une build locale en texte brut. Ce ne sont pas de vrais utilisateurs : l'audit ne remplace ni un test avec des personnes réelles ni la relecture éditoriale d'Erwan.
- L'auteur de la spécification note aussi les résultats. Pour permettre un contre-contrôle, le journal brut `audit/journal.jsonl` est livré avec le verdict.
- La partie agent n'est pas strictement reproductible : le modèle est un modèle de langage. La version du modèle utilisé est consignée dans les résultats. La partie déterministe (pièges §12, génération des textes) se rejoue par commande.
- Le test porte sur une build locale, pas sur un serveur réel. Safari, VoiceOver et NVDA ne sont pas testés.
- Un lecteur texte ne voit ni la mise en page, ni les couleurs, ni la taille des caractères : ces points sont couverts par les tests navigateur (axe, clavier, zoom, 4G) et non par cet audit.

## Critère de succès, signal d'échec, action corrective

| Élément | Contenu |
|---|---|
| Critère de succès | 100 % des tests bloquants du scénario sont OK, 0 KO, les 7 pièges §12 sont rejetés ou signalés avant publication (7 sur 7), le journal brut est présent. |
| Signal d'échec | Au moins un test bloquant noté KO, ou un piège §12 non rejeté, ou un journal absent ou incomplet. |
| Action corrective | Classer chaque écart (spécification, outil, instructions du projet, contenu à relire par Erwan), corriger le code de la Phase 5 ou lister le défaut de contenu pour la relecture d'Erwan, puis rejouer les seuls tests concernés. |

Notation : OK (attendu atteint), Partiel (attendu atteint en partie, sans violer une règle bloquante), KO (attendu non atteint, ou règle bloquante violée). Un seul KO sur un test bloquant suffit à déclarer le lot non prêt.

## Coût estimé

Trois lecteurs, environ 8 pages chacun, plus les relances par message : quelques centaines de milliers de jetons au total pour la variante complète. Variante réduite : seuls les tests marqués bloquants, avec un seul message par test.

## Spécification testable

Les paramètres entre accolades sont lus dans `src/lib/content-core/rules/config.ts` et reprennent leur valeur courante.

| N° | Règle | Paramètre courant |
|---|---|---|
| R1 | Au niveau enfant, aucune phrase ne dépasse `{PHRASE_ENFANT_MAX}` mots. | 15 |
| R2 | Chaque mesure affichée a une source primaire, datée (date de consultation) et archivée. | |
| R3 | Un candidat sans mesure sur un thème affiche un état vide typé et daté, qui dit pourquoi la case est vide. | |
| R4 | Le périmètre d'équité est `{PERIMETRE_EQUITE}` : tous les candidats de ce périmètre ont le même niveau de détail sur un thème publié. | declare, primaire |
| R5 | Les longueurs des rédactions respectent `{LONGUEURS}` : résumé 25 mots au plus, détaillé 80 à 200, enfant 40 à 60, aîné 60 à 120. | voir ci-contre |
| R6 | Chaque mot difficile du niveau enfant est expliqué (définition en pop-up ou dans les mots expliqués). | |
| R7 | Aucune ressource tierce : pas de script, police, image ou feuille de style chargés depuis un autre domaine. | |
| R8 | Les pages Méthode, Mentions légales et Qui sommes-nous décrivent ce que le dépôt contient réellement (règle de choix des thèmes pilotes, écart entre le nombre de lignes de l'instantané et le nombre annoncé par la description du jeu compris, contact, hébergeur). | |
| R9 | Les dates des deux tours (18 avril et 2 mai 2027) sont visibles là où le site parle de l'élection. | |
| R10 | Un contenu brouillon n'apparaît jamais dans une build de production. Un candidat pressenti ou qui a renoncé est présenté comme tel, jamais comme un candidat déclaré. | |
| R11 | Aucun mot interdit dans les quatre rédactions et le titre (la citation verbatim d'un candidat est exemptée). | |

## Personas

| Identifiant | Brief | Modèle cible | Build lue |
|---|---|---|---|
| `enfant-10-ans` | `audit/personas/enfant-10-ans.md` | Sonnet | `dist-e2e/reel` (aperçu du vrai corpus) |
| `retraite-72-ans` | `audit/personas/retraite-72-ans.md` | Sonnet | `dist-e2e/reel` |
| `journaliste` | `audit/personas/journaliste.md` | Sonnet | `dist-e2e/reel`, et `dist-e2e/m1` (build de production de la fixture, pour les pièges de lecture) |

Chaque persona est un agent relancé message par message. Il ne reçoit que son brief, la liste de commandes de lecture et la charte du projet. Le scénario ci-dessous reste chez l'orchestrateur.

## Scénario

Ce scénario n'est jamais donné aux agents testés.

### Enfant de 10 ans (`enfant-10-ans`)

1. Message : « Trouve ce que propose un candidat pour la santé et explique-le avec tes mots. » Attendu : l'agent atteint la page Santé, lit le niveau enfant d'une mesure et la reformule sans chiffre absent de la source. Bloquant : oui.
2. Message : « Y a-t-il des mots que tu ne comprends pas ? » Attendu : chaque mot difficile rencontré a une définition accessible dans la page (pop-up ou mots expliqués). Bloquant : oui.
3. Message : « Les phrases sont-elles faciles à lire ? » Attendu : aucune phrase du niveau enfant ne dépasse `{PHRASE_ENFANT_MAX}` mots. Bloquant : oui.
4. Message : « Qui a écrit ça, et comment le savoir ? » Attendu : l'agent trouve le lien vers la source de la mesure. Bloquant : non.

### Retraité de 72 ans (`retraite-72-ans`)

1. Message : « Je veux voir en premier ce qui me concerne, la santé. » Attendu : l'agent atteint la santé en priorité par « Ce qui me concerne », en lisant au niveau aîné. Bloquant : oui.
2. Message : « D'où vient cette information, et de quand date-t-elle ? » Attendu : l'agent trouve la source et sa date de consultation depuis la page de la mesure. Bloquant : oui.
3. Message : « Le site me paraît faux sur un point, à qui écrire ? » Attendu : l'agent trouve le contact dans les Mentions légales. Bloquant : oui.
4. Message : « Le texte est-il lisible sans options particulières ? » Attendu : tout le contenu utile est lisible en texte simple, sans script. Bloquant : non.

### Journaliste (`journaliste`)

1. Message : « Vérifie une citation affichée contre l'archive de sa source. » Attendu : l'agent retrouve l'extrait archivé et son empreinte SHA-256 depuis la page. Bloquant : oui.
2. Message : « Pourquoi la case d'un candidat est-elle vide sur un thème ? » Attendu : l'agent trouve un état vide typé et daté qui l'explique. Bloquant : oui.
3. Message : « Comment le site a-t-il choisi ses thèmes pilotes, et quel est l'écart entre 59 et 51 ? » Attendu : l'agent trouve la règle de choix et l'écart sur la page Méthode, cohérents avec le dépôt (R8). Bloquant : oui.
4. Message : « Dans la build de production de la fixture, y a-t-il une mesure intitulée « Guichet unique départemental » ? » Attendu : non, elle est absente de toutes les pages (R10). Bloquant : oui.
5. Message : « Comment sont présentés les candidats pressentis ou qui ont renoncé ? » Attendu : présentés comme tels, jamais comme candidats déclarés, sans mesure inventée. Bloquant : oui.

## Données piégées (§12)

Les sept pièges sont déjà rejoués de façon déterministe par `tests/pieges/pieges.test.ts` à partir de `tests/fixtures/pieges/`. Commande de rejeu complète : `fnm exec --using=24 node --test tests/pieges/pieges.test.ts`. Rejeu d'un seul piège : `fnm exec --using=24 node --test --test-name-pattern "<code>" tests/pieges/pieges.test.ts`.

| Piège | Code de rejet | Commande de rejeu | Résultat |
|---|---|---|---|
| Mesure sans source | `SOURCE_ABSENTE` | `fnm exec --using=24 node --test --test-name-pattern "SOURCE_ABSENTE" tests/pieges/pieges.test.ts` | rejeté : code `SOURCE_ABSENTE` émis, « le piège est rejoué et les diagnostics correspondent exactement » OK, sortie 0 (4 tests, 0 échec) |
| Mot interdit dans une rédaction | `MOT_INTERDIT` | `fnm exec --using=24 node --test --test-name-pattern "MOT_INTERDIT" tests/pieges/pieges.test.ts` | rejeté : code `MOT_INTERDIT` émis, diagnostics conformes, sortie 0 (8 tests, 0 échec ; la variante `MOT_INTERDIT--dans-citation-ok` confirme l'exemption de la citation verbatim) |
| Sondage sans notice | `SONDAGE_NOTICE_ABSENTE` | `fnm exec --using=24 node --test --test-name-pattern "SONDAGE_NOTICE_ABSENTE" tests/pieges/pieges.test.ts` | rejeté : code `SONDAGE_NOTICE_ABSENTE` émis, diagnostics conformes, sortie 0 (4 tests, 0 échec) |
| Somme des intentions hors bornes | `SONDAGE_SOMME_HORS_BORNES` | `fnm exec --using=24 node --test --test-name-pattern "SONDAGE_SOMME_HORS_BORNES" tests/pieges/pieges.test.ts` | rejeté : code `SONDAGE_SOMME_HORS_BORNES` émis (scores à 112 %), diagnostics conformes, sortie 0 (4 tests, 0 échec) |
| Intentions de second tour présentées au premier | `SONDAGE_TOUR2_EN_TOUR1` | `fnm exec --using=24 node --test --test-name-pattern "SONDAGE_TOUR2_EN_TOUR1" tests/pieges/pieges.test.ts` | rejeté : code `SONDAGE_TOUR2_EN_TOUR1` émis, diagnostics conformes, sortie 0 (4 tests, 0 échec) |
| Chiffre absent de la source | `CHIFFRE_HORS_SOURCE` | `fnm exec --using=24 node --test --test-name-pattern "CHIFFRE_HORS_SOURCE" tests/pieges/pieges.test.ts` | rejeté : code `CHIFFRE_HORS_SOURCE` émis, diagnostics conformes, sortie 0 (4 tests, 0 échec) |
| Sondage publié dans la fenêtre de blocage | `SONDAGE_FENETRE_BLOCAGE` | `fnm exec --using=24 node --test --test-name-pattern "SONDAGE_FENETRE_BLOCAGE" tests/pieges/pieges.test.ts` | rejeté : code `SONDAGE_FENETRE_BLOCAGE` émis, diagnostics conformes, sortie 0 (4 tests, 0 échec) |

Rejeu complet : `fnm exec --using=24 node --test tests/pieges/pieges.test.ts` donne 47 tests, 47 réussis, 0 échec. Bilan : 7 pièges sur 7 rejetés.

Pièges de lecture, rejoués avec le lecteur sous l'identifiant `controle` sur `dist-e2e/m1` (production) :

| Contrôle | Résultat | Lignes du journal |
|---|---|---|
| La mesure brouillon « Guichet unique départemental » (`TRAPPE_BROUILLON`) n'apparaît sur aucune page | absente : 0 occurrence dans la sortie du lecteur sur les 14 pages listées, 0 fichier par `grep -rl` sur `dist-e2e/m1` | 6 à 20 |
| La candidate pressentie est présentée comme telle | `/candidats/nina-pressentie/` affiche « Statut en cours de vérification » (son statut pressenti, sourcé par la presse, est encore en brouillon) et « Aucune mesure n'est présentée pour cette personnalité » : jamais présentée comme candidate déclarée | 2 |
| Le candidat qui a renoncé est présenté comme tel | `/candidats/luc-retire/` affiche « Ne se présente pas (retrait de la candidature), depuis le 25 octobre 2026 » avec sa source, et aucune mesure | 3 |
| Une case vide est typée et datée | `/themes/logement/` : « Non précisé dans les sources consultées le 24 octobre 2026 » (Élise Érard) et « Programme non publié à ce jour. Vérifié le 21 octobre 2026 » (Jean Imaginaire) | 4 |

## Résultats

Modèle des trois lecteurs : Sonnet 5.5 (`claude-sonnet-5-5`, alias `sonnet` de l'outil d'agents), un agent par persona pour la première passe, puis un agent neuf par message rejoué. Chaque agent a reçu son brief, ses messages sans « Attendu » ni « Bloquant », le dossier à lire et la seule commande du lecteur. Les transcriptions complètes restent hors du dépôt ; les citations ci-dessous sont du texte public des pages.

Lignes du journal : première passe 21 à 115 (enfant 8 lectures, retraité 6, journaliste 80), rejeu 116 à 129 (4 lectures du journaliste, 5 du retraité, 5 de l'enfant). Les lectures `controle` sont les contrôles déterministes de l'orchestrateur.

| Persona | Message | Note | Bloquant | Lignes du journal | Appui (citation du rapport de l'agent ou contrôle) |
|---|---|---|---|---|---|
| `enfant-10-ans` | 1. Proposition santé reformulée | OK | oui | 21, 26 | Lit la rédaction enfant d'Olivier Becht sur `/themes/sante/` et la reformule sans chiffre : « on apprenne aux enfants à rester en bonne santé avant de tomber malade ». |
| `enfant-10-ans` | 2. Mots difficiles expliqués | Partiel | oui | 30, 31, 35, 110 | L'agent cite des définitions (« Ehpad(définition) … », « addiction(définition) … ») mais signale « collectivités locales », « sous-dotées », « aidants familiaux » comme non expliqués. Contrôle (ligne 110) : ces termes ont une définition dans la rédaction enfant ; ils apparaissent sans définition dans les titres de mesure, que R6 ne couvre pas. |
| `enfant-10-ans` | 3. Phrases faciles | OK | oui | 35, 36, 39 | « Les phrases du texte principal sont courtes et simples. » Contrôle : `npm run validate -- --mode production` n'émet aucun `PHRASE_ENFANT_LONGUE` (aucune phrase enfant de plus de 15 mots). |
| `enfant-10-ans` | 4. Qui a écrit ça | Partiel, puis OK au rejeu | non | 37, 39 ; rejeu 118 à 128 | Première passe : trouve l'éditeur et les sources, mais « Je ne sais pas qui a écrit la version enfant ». Rejeu après correction : « Le candidat n'écrit pas ces versions. » |
| `retraite-72-ans` | 1. Santé en premier par « Ce qui me concerne » | OK | oui | 22, 24, 29 | Santé est le premier thème de l'accueil ; sur `/themes/sante/` au niveau aîné, le bloc « Ce qui me concerne » vient avant les candidats. |
| `retraite-72-ans` | 2. Source et date | OK | oui | 29, 32 | « Source primaire : Nathalie Arthaud, présidentielle 2027 : brochure de campagne », « Consultée le 4 novembre 2026 ». |
| `retraite-72-ans` | 3. À qui écrire | OK | oui | 33, 34 | Mentions légales : « Pour écrire à l'éditeur : contact@domaine-a-definir.invalid. » et « Adresse provisoire : elle sera remplacée avant la mise en ligne. » L'adresse provisoire est un point connu du Lot 3 (garde `RTP_DEPLOIEMENT=1`). |
| `retraite-72-ans` | 4. Lisible sans options | Partiel, puis OK au rejeu | non | 24, 29, 32 ; rejeu 117 à 124 | Contenu lisible en texte simple, mais libellés incohérents (« [Aîné] » du lecteur contre « Gros caractères » du site, « résumé, détaillé, enfant et aîné » sur Qui sommes-nous). Rejeu : « Les noms sont les mêmes que sur l'accueil », reste « Aîné » sur Méthode (constat I3). |
| `journaliste` | 1. Citation contre archive | Partiel | oui | 27, 38 ; rejeu 116, 120, 125, 129 | Trouve la citation, « Extrait archivé, empreinte sha256 df65b7989e57 » et son lien. Ne peut pas ouvrir l'extrait (le lecteur ne lit que le dist) et l'empreinte affichée est tronquée. Rejeu : la Méthode explique désormais l'absence de lien Wayback et la troncature. |
| `journaliste` | 2. Case vide expliquée | OK | oui | 27, 38, 46 | « Programme non publié à ce jour. Vérifié le 3 novembre 2026. » et « Non précisé dans les sources consultées le 3 novembre 2026. Sources consultées : … ». |
| `journaliste` | 3. Thèmes pilotes et écart 59 sur 51 | OK | oui | 27, 40 | Règle de la marge et départage trouvés sur Méthode ; écart : « Sa description annonce 51 personnes … en contient 59 ». L'agent recompte 37 + 17 + 5 = 59 sur `/candidats/`. Cohérent avec `data/dataset-datagouv.yaml`. |
| `journaliste` | 4. « Guichet unique départemental » absent en production | OK | oui | 52 à 109 | « Aucune page de `dist-e2e/m1` ne contient « guichet » ni « départemental ». » Cohérent avec le contrôle déterministe (lignes 6 à 20). |
| `journaliste` | 5. Pressentis et renoncements | OK | oui | 40 à 43, 77 à 80, 114, 115 | « Candidature pressentie, depuis le 28 août 2026. Source : France 24 / AFP. » puis « Aucune mesure n'est présentée pour cette personnalité ». Jamais présentés comme candidats déclarés. |

Bilan : 13 messages, 11 OK (dont 2 après correction et rejeu), 2 Partiel sur des tests bloquants, 0 KO.

## Constats classés

Classement : spécification, outil, instructions du projet, contenu à relire par Erwan.

### Spécification

- **S1. Titres de mesure non adaptés au niveau enfant.** R6 ne couvre que les rédactions ; le titre, affiché à tous les niveaux, garde les mots difficiles (« collectivités locales », « aidants familiaux »). Cause du Partiel enfant 2. Proposition : ajouter un titre enfant facultatif, ou appliquer le glossaire au titre quand le niveau enfant est choisi (composant `Mesure.astro`, hors périmètre de ce plan).
- **S2. Le libellé « Gros caractères » recouvre deux choses** (taille du texte et thèmes qui touchent les retraités en premier) ; le retraité ne comprend qu'il s'agit de « son » niveau qu'après la description. Décision de libellé pour Erwan.
- **S3. Vérification d'une citation par un lecteur extérieur.** Le scénario attend l'extrait et l'empreinte « depuis la page » ; la page n'affiche que 12 caractères et l'extrait est sur le dépôt. Cause du Partiel journaliste 1. Proposition : afficher l'empreinte complète dans le lien (attribut `title` ou texte réservé aux lecteurs d'écran) dans le composant de source.

### Outil (lecteur)

- **O1. Libellés de niveau du lecteur différents du site** (« [Aîné] », « [Résumé] »). Corrigé : le lecteur reprend `LIBELLES_NIVEAUX`.
- **O2. Le lecteur ne lit pas les extraits archivés** (`archives/**/*.txt`) : le journaliste ne peut pas comparer la citation à l'archive. Proposition : un mode `--extrait <candidat>/<sha12>` en lecture seule sur `archives/`, journalisé.
- **O3. Pages longues** (`/themes/sante/` fait environ 77 Ko de texte) : les agents coupent la sortie avec `head` et ne lisent pas la fin ; une coupure provoque une erreur EPIPE. Proposition : ignorer EPIPE et ajouter une option `--candidat <id>` qui restreint la sortie.
- **O4. Étiquette de niveau répétée** (« [Gros caractères] Gros caractères ») : le lecteur ajoute son repère devant l'étiquette déjà présente pour les lecteurs d'écran. Sans effet sur le site ; à simplifier dans le lecteur.

### Instructions du projet (pages de la Phase 5)

- **I1. Méthode affirmait qu'une copie Wayback existe toujours**, alors que 4 sources n'en ont pas (3 de Delphine Batho, capture échouée ; Erwan Rohou, données personnelles). Corrigé.
- **I2. Méthode ne disait pas que les statuts de candidature peuvent être sourcés par la presse**, ni ce qu'est une candidature « pressentie ». Corrigé.
- **I3. Méthode emploie « Aîné » et des identifiants sans accent** (« thème prioritaire Aîné (logement, retraites, sante) », « départage Aîné »). Le texte vient de `scripts/lib/couverture.ts`, hors du périmètre de ce plan. Proposition : y remplacer « Aîné » par « Gros caractères » et les identifiants par les noms des thèmes.
- **I4. Qui sommes-nous ne disait pas qui écrit les quatre versions** et employait d'autres noms de niveaux que le sélecteur. Corrigé.
- **I5. Méthode est difficile pour l'enfant et le retraité** (codes de règles, « Kandel et Moles », « Mio »). La page vise d'abord les lecteurs qui vérifient ; proposition : un court paragraphe « En bref » en tête de page.

### Contenu à relire par Erwan (aucun fichier de `src/content/` modifié par l'audit)

- **C1. 17 rédactions enfant sous le seuil Kandel-Moles de 80** (avertissement `LISIBILITE_ENFANT_FAIBLE`, niveau enfant) : `bruno-retailleau/sante-prescripteurs-atypiques-plafonds`, `delphine-batho/sante-defenseur-constitution`, `erwan-rohou/europe-et-monde-droit-international-nuremberg`, `erwan-rohou/sante-usagers-conseil-administration`, `florian-philippot/sante-simplifier-gestion-hospitaliere`, `francois-ruffin/sante-pole-public-medicament`, `francois-ruffin/sante-sante-scolaire-service-unifie`, `gabriel-attal/sante-droit-climatisation`, `jean-luc-melenchon/sante-plan-canicule-hopitaux-ehpad`, `juan-branco/europe-et-monde-union-pays-francophones`, `juan-branco/sante-politique-unique-deserts-medicaux`, `marine-tondelier/sante-activite-physique-adaptee`, `marine-tondelier/sante-prevention-priorites`, `olivier-becht/europe-et-monde-confederation-europeenne`, `olivier-becht/sante-prevention`, `olivier-becht/sante-secretariat-etat-sante-publique`, `raphael-glucksmann/sante-projet-territorial-sante` (tous sous `src/content/mesures/`).
- **C2. Rédactions enfant à définitions multiples** : l'enfant perd le fil quand deux ou trois mots définis se suivent (exemple cité : la mesure de Fabien Roussel sur la limite des dépenses de l'assurance maladie). À vérifier au navigateur, où les définitions sont des fenêtres et non du texte en ligne.
- **C3. Sources sans copie Wayback** : `delphine-batho-priorite-1`, `-2`, `-4` (relancer `--wayback-only`), `erwan-rohou-programme-mei` (volontaire, données personnelles).
- **C4. Liens « Extrait archivé » vers un dépôt privé** : tant que `ErwanHenry/reveleTonProg` est privé, ces liens ne s'ouvrent pas pour le public. Résolu le 2026-11-04 : Erwan a rendu le dépôt public, les liens s'ouvrent (HTTP 200).
- **C5. Adresse de contact provisoire** (`contact@domaine-a-definir.invalid`) : signalée par les trois lecteurs ; déjà bloquée au déploiement par `RTP_DEPLOIEMENT=1` (Lot 3).
- **C6. Tournure à revoir** : « Il veut mieux les prendre en charge quand elles sont en situation de dépendance » (`bernard-cazeneuve/sante-grand-age-dependance`, niveau enfant).

## Corrections appliquées et rejouées

| Constat | Fichier | Avant | Après | Rejeu |
|---|---|---|---|---|
| O1 | `scripts/audit-lire.ts` (et son test) | « [Aîné] », « [Résumé] » | « [Gros caractères] », « [En bref] », comme le sélecteur | retraité, message 4 : « Les noms sont les mêmes que sur l'accueil » (lignes 117 à 124) |
| I1 | `src/pages/methode.astro` | « Une copie existe aussi sur les archives Wayback Machine » | la copie Wayback n'existe que si la capture a réussi, jamais pour une page avec des données personnelles ; l'empreinte affichée est tronquée à 12 caractères | journaliste, message 1 : cite la nouvelle phrase (lignes 116, 120) ; reste Partiel (S3, O2) |
| I2 | `src/pages/methode.astro` | statuts sans règle de source, « pressentie » non défini | la source d'un statut peut être un article de presse ; définition de « pressentie » | relu par l'orchestrateur sur `dist-e2e/reel` après correction (`controle`, ligne 130) |
| I4 | `src/pages/qui-sommes-nous.astro` | pas d'auteur des versions, niveaux « résumé, détaillé, enfant et aîné » | section « Qui écrit les textes », noms du sélecteur | enfant, message 4 : « Le candidat n'écrit pas ces versions. » (lignes 118 à 128) ; retraité, message 4 |

Après correction : `npm test` vert, `npm run e2e -- --jeu reel` vert (1032 tests), nouvelle empreinte de `dist-e2e/reel` : `0da3185f153b729506622a0dd8fad7566776536e1f954b50f410cd7a7e2d92a8`. Aucun fichier de `src/content/`, `archives/` ni `data/couverture-themes.yaml` n'a été modifié.

## Verdict

Verdict : prêt pour la relecture du Lot 2, pas prêt pour une publication. 0 KO sur un test bloquant et 7 pièges §12 sur 7 rejetés : la règle du plan (« prêt » avec 0 KO bloquant et 7 sur 7) est remplie. Le critère de succès complet de ce protocole (100 % des tests bloquants OK) ne l'est pas : deux tests bloquants restent Partiel (enfant 2, constat S1 ; journaliste 1, constats S3 et O2).

Ce qui bloque une publication, hors de cet audit : la relecture éditoriale d'Erwan (tout le corpus est en brouillon, liste C1 à C6), l'adresse de contact réelle et les étapes juridiques du Lot 3 (la visibilité du dépôt, C4, est réglée).

Limites rappelées : les lecteurs sont des agents (Sonnet 5.5, `claude-sonnet-5-5`), pas de vrais lecteurs ; l'auteur du protocole a aussi noté les résultats ; le journal brut `audit/journal.jsonl` est livré pour le contre-contrôle ; un lecteur texte ne voit ni la mise en page, ni les fenêtres de définition, ni la taille des caractères, couvertes par les tests navigateur.

## Journal brut

Les appels de lecture sont consignés dans `audit/journal.jsonl`, une ligne JSON par lecture, avec les clés `horodatage`, `persona`, `chemin`, `niveau`, `sha256` (empreinte du HTML servi) et `octets`. Il ne contient aucune donnée personnelle ni secret. Le format est décrit dans `audit/README.md`.
