---
phase: 09-contenu-relu-juridique-et-ouverture
fixed_at: 2026-11-22T23:40:00Z
review_path: .planning/phases/09-contenu-relu-juridique-et-ouverture/09-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 9 : rapport des corrections de la revue de code

**Corrigé le :** 2026-11-22
**Revue source :** `.planning/phases/09-contenu-relu-juridique-et-ouverture/09-REVIEW.md`
**Itération :** 1

**Résumé :**
- Constats dans le périmètre : 10 (le critique CR-01 ; les avertissements WR-01, WR-02, WR-03, WR-04, WR-08, WR-09 ; les informations de code IN-03, IN-04, IN-05)
- Corrigés : 10, un commit atomique par constat, plus deux commits de suite : typage du test de WR-03 (`astro check`) et lecture des commentaires d'IN-03 par l'analyseur plafonné (garde IMP-01, relevé par `npm test`)
- Hors périmètre, déjà traités par l'orchestrateur avec des textes validés par Erwan : WR-05, WR-06, WR-07, IN-01 (commit `2bb6b41`)
- IN-02 : proposé seulement, pas ajouté (voir plus bas)
- Corpus réel : 121 cibles relues sur 121 conformes au registre `relecture/journal.jsonl` (47 mesures, 37 statuts, 37 cases du thème santé). Aucun texte modifié après relecture trouvé. `liste --theme sante`, sans option, donne maintenant `reste 0 sur 121`.

## Tableau des constats

| Constat | Statut | Commit | Cas rouge observé avant la correction |
|---|---|---|---|
| CR-01 | corrigé, à confirmer par un humain (logique) | `d93a25e` | Nouveaux tests `relecturesPerimees` et `RELECTURE_PERIMEE` (fonction et code absents) ; `marquer` refusait la mesure publiée corrigée (« déjà publiée ») |
| WR-04 | corrigé | `753ce7d` | Dossier du deuxième fichier en lecture seule : le premier restait modifié et l'exception de restauration sortait du `catch` |
| WR-01 | corrigé, à confirmer par un humain (logique) | `9940990` | Case relue par « Anne Relectrice » vue « à relire » ; contenu de case changé à la main resté « relu » ; publication avec deux relecteurs refusée |
| WR-02 | corrigé | `5b89d0e` | Les sept commandes sans `--relecteur` écrivaient « Erwan Henry » (code 0) ; « Erwan Henry » en dur dans `etat.ts` |
| WR-03 | corrigé | `56a82bb`, `fd12a81` | Première mesure d'une personne « programme non publié » sur un thème publié : refus après écriture (`EQUITE_COUVERTURE_INCOHERENTE`), aucune option pour la case |
| IN-04 | corrigé | `65e3086` | `--dry-run` répondait code 0 alors que la validation d'après écriture refusait |
| WR-09 | corrigé | `a7babca` | Liens `/candidats/<id>`, `/candidats/<id>.html`, page `candidats/<id>.html` et entrée de sitemap sans barre finale non signalés |
| WR-08 | corrigé (dépôt seulement) | `5b4a695` | Marqueur absent de l'archive ; `site-essai` disait « ok: retiré » avec le bloc présent ; test de restauration conforme avec le bloc remis |
| IN-05 | corrigé | `b0ccf12` | Thème publié, statut déclaré en brouillon sans case : `PILOTE_CASE_MANQUANTE` |
| IN-03 | corrigé | `8caadec`, `259a538` | Source commentée réécrite par `--wayback-only` et `--wayback-adopter`, commentaire perdu |

## Corrections

### CR-01 : texte modifié après relecture

**Fichiers modifiés :** `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `scripts/lib/relecture/commandes/marquer.ts`, `tests/scripts/check-dist.test.ts`, `tests/relecture/marquer.test.ts`, `tests/repo/relecture-empreintes.test.ts` (nouveau), `docs/RUNBOOK.md`
**Commit :** `d93a25e`

- `relecturesPerimees(contentRoot, projectRoot)` compare l'empreinte actuelle à la dernière ligne du registre, avec les fonctions de l'outil (`empreinteMesure`, `empreinteStatut`, `empreinteCase`), pour : chaque mesure `relu` ou `publie` ; le statut que la production retient pour chaque personne ; chaque case d'un thème `publie` pour une personne visible en production. Une cible absente du registre compte comme non relue ; un registre illisible donne une entrée qui le dit.
- `check-dist` : nouveau code `RELECTURE_PERIMEE`, erreur en production, sur la page qui montre la cible. Registre obligatoire pour le vrai corpus (racine de contenu égale à la racine du projet) ; une fixture sans registre n'est pas contrôlée.
- `tests/repo/relecture-empreintes.test.ts` : même contrôle sur le vrai corpus dès `npm test`.
- `marquer` accepte une mesure ou un statut `publie` dont l'empreinte a changé : il garde `publie` et ne change que relecteur et date. Inchangé, il refuse comme avant.
- RUNBOOK : ligne `RELECTURE_PERIMEE` de la table check-dist, paragraphe « Corriger une mesure publiée ».

**Pourquoi check-dist (et `npm test`), pas la validation de production.** `check-dist --mode production` tourne sur la build réelle avant chaque déploiement : job `verifier` de la CI (dont dépend le job de déploiement), job `construire`, et `deploy:local` (`scripts/lib/deploiement/construire.ts`). C'est suffisant pour bloquer toute mise en ligne. Une règle du validateur aurait fait refuser à `marquer`, `publier` et `retirer` leur propre écriture : ils valident en production juste après l'écriture, avant d'ajouter la ligne au registre. Il aurait fallu filtrer ce code dans trois commandes et poser un registre dans chaque fixture publiée.

**À confirmer par Erwan (logique) :** le périmètre contrôlé. Les thèmes eux-mêmes (nom, sous-thèmes) ne sont pas comparés à leur empreinte ; une mesure `relu` non publiée l'est, comme le demandait la consigne (« publié ou relu »), ce qui bloque la CI tant qu'une correction sur une mesure relue n'est pas relue de nouveau.

### WR-04 : restauration d'un lot

**Fichiers modifiés :** `scripts/lib/relecture/lot.ts`, `tests/relecture/publier.test.ts`
**Commit :** `753ce7d`

Un fichier n'entre dans la liste des écrits qu'après succès. Chaque restauration a son propre essai ; un échec est ajouté aux erreurs renvoyées (avec « le remettre avec git checkout »), jamais levé.

### WR-01 : état d'une case

**Fichiers modifiés :** `scripts/lib/relecture/etat.ts`, `vue.ts`, `commandes/liste.ts`, `commandes/publier.ts`, tests de `tests/relecture/`, `docs/RUNBOOK.md`
**Commit :** `9940990`

Une case est relue si la dernière ligne du registre pour `case:<theme>/<candidat>` a l'empreinte de son contenu actuel, à revoir si elle diffère, à relire sans ligne. `verifie_par` n'est plus qu'affiché. L'option `--relecteur` de `liste`, sans objet, disparaît (code 2).

**À confirmer par Erwan (logique) :** une case changée par `retirer` ou `publier --case-mesures` est relue par l'empreinte que ces commandes écrivent au registre.

### WR-02 : relecteur par défaut

**Fichiers modifiés :** `scripts/lib/relecture/etat.ts`, `commandes/marquer.ts`, `publier.ts`, `retirer.ts`, `servir.ts`, `serveur.ts`, `scripts/relecture.ts`, `scripts/lib/veille/preparer.ts`, commentaire de `src/lib/content-core/rules/statut-recent.ts`, tests, `e2e/relecture.spec.ts`, `docs/RUNBOOK.md`
**Commit :** `5b89d0e`

Forme retenue, la plus sûre : `--relecteur <nom>` obligatoire pour `marquer`, `publier`, `retirer` et `servir` (code 2 sans lui, rien n'est écrit), sans défaut ni fichier de configuration. Un défaut lu dans un fichier aurait le même effet qu'aujourd'hui pour un agent qui oublie l'option. La page `servir` signe chaque « Valider » au nom donné et l'affiche en tête. Les lignes à copier de `retirer` reprennent le nom ; la veille et le RUNBOOK donnent `--relecteur <nom>` dans chaque commande. Un test vérifie qu'aucun nom de relecteur n'est écrit en dur dans l'outil.

### WR-03 : case d'une première mesure sur un thème publié

**Fichiers modifiés :** `scripts/lib/relecture/commandes/publier.ts`, `tests/relecture/publier.test.ts`, `docs/RUNBOOK.md`
**Commits :** `56a82bb`, `fd12a81` (typage du test, relevé par `astro check`)

`publier --case-mesures <candidat,…>` : la case passe à `mesures` (avec `verifie_le` et `verifie_par` du relecteur) dans le même lot tout ou rien, avec sa ligne de registre. Choix explicite, comme `--case` de `retirer` : sans l'option, refus avant écriture qui nomme la case et l'option ; une demande sans objet est refusée ; une note ouverte sur la case bloque. Le test sur un thème déjà publié vérifie la validation de production, `relecturesPerimees` et `reste 0`.

### IN-04 : essai à blanc de publier

**Fichiers modifiés :** `scripts/lib/relecture/lot.ts`, `scripts/lib/relecture/commandes/publier.ts`, `tests/relecture/publier.test.ts`, `docs/RUNBOOK.md`
**Commit :** `65e3086`

`essayerLot` applique le même lot à une copie temporaire de ce que lit la validation (`src/content`, `config`, `archives`, `ids.lock`, environ 5 Mo pour le vrai corpus), y lance la même validation de production, puis efface la copie.

### WR-09 : chemins de candidat

**Fichiers modifiés :** `scripts/lib/check-dist.ts`, `tests/scripts/check-dist.test.ts`
**Commit :** `a7babca`

`idCandidatDuChemin` reconnaît `/candidats/<id>/`, `/candidats/<id>/index.html`, `/candidats/<id>` et `/candidats/<id>.html`. Non fait : la recherche des noms en texte simple (option de la revue).

### WR-08 : marqueur de retrait de l'hôte d'essai

**Fichiers modifiés :** `ops/sauvegarder-config.sh`, `ops/installer-serveur.sh`, `ops/tester-restauration.sh`, `tests/repo/sauvegarde.test.ts`, `tests/repo/installer-serveur.test.ts`, `docs/RUNBOOK.md`
**Commit :** `5b4a695`

- La sauvegarde archive `opt/rtp/essai-retire` (chemin facultatif : ligne « absent » sinon).
- `site-essai` : marqueur présent et bloc encore là, ligne « a faire » (le déplacer dans `/root/rtp-retire`). Le script ne déplace jamais le bloc ; en application, le bilan finit donc en code 1.
- Le test de restauration vérifie `site-essai` quand le marqueur est dans l'archive.

Rien n'a été appliqué sur le serveur.

### IN-05 : périmètre de la règle des cases

**Fichiers modifiés :** `scripts/lib/pilote.ts`, `tests/couverture/pilote.test.ts`, `docs/RUNBOOK.md`
**Commit :** `b0ccf12`

Sur un thème publié, `PILOTE_CASE_MANQUANTE` exige une case pour le périmètre de production (statuts relus), comme la règle d'équité de production. Thème non publié : périmètre de travail inchangé.

### IN-03 : commentaires YAML des sources

**Fichiers modifiés :** `scripts/archive-source.ts`, `tests/archive/wayback.test.ts`, `docs/RUNBOOK.md`
**Commits :** `8caadec`, `259a538`

Si le fichier de la source contient un commentaire YAML (lu sur le document de `lireDocumentPlafonne`, nœud par nœud : un « # » dans une valeur ou un texte plié n'en est pas un), rien n'est réécrit. Le premier commit utilisait le `Lexer` de `yaml`, interdit hors liste blanche par `tests/repo/yaml-plafonne.test.ts` (IMP-01) : corrigé par le second. `--wayback-only` garde la soumission et affiche la ligne `wayback_url` à ajouter à la main ; `--wayback-adopter` refuse (code 1) après vérification de l'instantané et donne les valeurs. Même trou, non traité : `--refresh` réécrit aussi la source.

## Proposé, non ajouté

### IN-02 : navigateur sur la build de production du vrai corpus

Proposition : un jeu `reel-production` dans `scripts/e2e.ts` (build `RTP_CONTENT_ROOT=. RTP_MODE=production`), sur lequel tourneraient axe, le parcours sans JavaScript et le parcours au clavier, déjà écrits pour les autres jeux. Mettre aussi à jour le commentaire « Vrai corpus (pas encore la racine par défaut) ». Coût : une build de plus dans le job `e2e` de la CI.

## Tests existants modifiés, et pourquoi leur propriété tient

| Test | Changement | La propriété tient ? |
|---|---|---|
| `tests/relecture/marquer.test.ts`, refus d'une mesure publiée | Sorti de la boucle des refus ; registre posé avec l'empreinte actuelle | Oui : refus toujours exigé pour une mesure publiée inchangée ; le cas « modifiée » est un nouveau test |
| `tests/relecture/liste.test.ts`, `vue.test.ts`, `serveur.test.ts` : `reste 7` devient `reste 11` | Les 4 cases du corpus M1, sans ligne de registre, sont « à relire » | Changement voulu (WR-01) |
| `tests/relecture/liste.test.ts`, « --relecteur change la référence » | Remplacé par l'état de case par empreinte, et `--relecteur` refusé | Changement voulu (WR-01) |
| `tests/relecture/publier.test.ts`, « case pas relue » (verifie_par réécrit) | Contenu de la case changé après relecture | Oui : refus toujours exigé, sur le vrai critère |
| `tests/relecture/publier.test.ts`, « échec réel de la validation (case incohérente) » | Le refus arrive avant écriture et nomme `--case-mesures` ; avec l'option, la publication passe | Changement voulu (WR-03) ; la restauration après écriture reste couverte par le test au chargeur injecté et par celui de WR-04 |
| Appels de `marquer`, `publier`, `retirer`, `servir` dans les tests et `e2e/relecture.spec.ts` | `--relecteur` ou l'option `relecteur` ajoutés | Oui : mêmes valeurs qu'avant le défaut |
| `tests/repo/sauvegarde.test.ts` : `absents: 0`, manifeste sans ligne `absent`, rien sous `opt/rtp` | Une ligne `absent opt/rtp/essai-retire` attendue ; seul ce chemin permis sous `opt/rtp` | Oui : la copie du dépôt reste exclue |
| `tests/relecture/retirer.test.ts`, lignes à copier | Finissent par `--relecteur "Erwan Henry"` | Oui |

## Vérifications (Node 24)

- `npm test` : 3274 tests, 3265 réussis, 0 échec, 9 ignorés (un premier passage complet avait trouvé 1 échec, la garde IMP-01 sur le `Lexer` d'IN-03, corrigé par `259a538`).
- `npm run check` : 0 erreur, 0 avertissement, 0 indication (335 fichiers).
- `npm run relecture -- liste --theme sante` : `reste 0 sur 121`.
- `relecturesPerimees` sur le vrai corpus : aucune entrée.
- Aucun fichier de `src/content/**`, `archives/**`, `data/**` ni `relecture/journal.jsonl` n'a été modifié. Rien n'a été poussé.

## Ce qui reste pour Erwan

- **Écriture serveur (WR-08), avec son accord :** réinstaller les scripts sur le serveur (`installer-serveur.sh --appliquer --etape sauvegarde,depot`, précédé de `--verifier`), puis lancer `rtp-sauvegarder` et `rtp-tester-restauration` : l'archive doit contenir `opt/rtp/essai-retire` et le test doit lister `site-essai` parmi les étapes, conforme. Aucun rechargement de Caddy n'est nécessaire.
- CR-01 et WR-01 sont des changements de logique, à confirmer (voir leurs paragraphes).
- WR-02 : toute commande de relecture demande maintenant `--relecteur`. Pour une validation faite par Erwan lui-même : `--relecteur "Erwan Henry"` ; par un agent : son nom (« l'agent d'IA Claude »).
- IN-02 : proposé ci-dessus.

---

_Corrigé le : 2026-11-22_
_Correcteur : Claude (gsd-code-fixer)_
_Itération : 1_

## Décisions d'Erwan (2026-11-23)

- CR-01 (contenu relu ou publié modifié après relecture bloqué par check-dist, mesure relue non publiée comprise) et WR-01 (état « relu » d'une case lu dans le journal) : validés (« Je valide les quatre »).
- WR-08 appliqué sur le serveur avec son accord (« Oui, fais-la ») le 2026-11-23 : étapes `sauvegarde` et `depot` mises à jour, sauvegarde du jour à 21 fichiers (20 auparavant, le marqueur `/opt/rtp/essai-retire` compris), test de restauration `resultat: ok`, `site-essai` `[ok: retiré]`, aucun rechargement de Caddy.
- Corrections déployées en production le 2026-11-23 (commit `3702f7f`, test de fumée passé).
