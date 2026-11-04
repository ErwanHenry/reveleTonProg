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
| R8 | Les pages Méthode, Mentions légales et Qui sommes-nous décrivent ce que le dépôt contient réellement (règle de choix des thèmes pilotes, écart 59 sur 51 compris, contact, hébergeur). | |
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

à remplir (05-07)

## Constats classés

Classement : spécification, outil, instructions du projet, contenu à relire par Erwan.

à remplir (05-07)

## Corrections appliquées et rejouées

à remplir (05-07)

## Verdict

à remplir (05-07)

## Journal brut

Les appels de lecture sont consignés dans `audit/journal.jsonl`, une ligne JSON par lecture, avec les clés `horodatage`, `persona`, `chemin`, `niveau`, `sha256` (empreinte du HTML servi) et `octets`. Il ne contient aucune donnée personnelle ni secret. Le format est décrit dans `audit/README.md`.
