---
phase: 09-contenu-relu-juridique-et-ouverture
reviewed: 2026-11-22T18:04:17Z
depth: deep
files_reviewed: 45
files_reviewed_list:
  - ops/installer-serveur.sh
  - ops/tester-restauration.sh
  - package.json
  - schemas/defs/common.schema.json
  - scripts/archive-source.ts
  - scripts/check-dist.ts
  - scripts/e2e.ts
  - scripts/favicon.ts
  - scripts/lib/archive.ts
  - scripts/lib/check-dist.ts
  - scripts/lib/pilote.ts
  - scripts/lib/relecture/commandes/liste.ts
  - scripts/lib/relecture/commandes/marquer.ts
  - scripts/lib/relecture/commandes/note.ts
  - scripts/lib/relecture/commandes/publier.ts
  - scripts/lib/relecture/commandes/retirer.ts
  - scripts/lib/relecture/commandes/servir.ts
  - scripts/lib/relecture/editer.ts
  - scripts/lib/relecture/etat.ts
  - scripts/lib/relecture/lot.ts
  - scripts/lib/relecture/registre.ts
  - scripts/lib/relecture/serveur.ts
  - scripts/lib/relecture/vue.ts
  - scripts/lib/wayback.ts
  - scripts/relecture.ts
  - src/components/Mesure.astro
  - src/components/StatutCandidat.astro
  - src/lib/content-core/rules/archives.ts
  - src/lib/content-core/rules/config.ts
  - src/lib/content-core/rules/corpus.ts
  - src/lib/content-core/rules/publication.ts
  - src/lib/corpus/index.ts
  - src/lib/corpus/types.ts
  - src/lib/corpus/vue.ts
  - src/lib/identite.ts
  - src/lib/journal-acces.ts
  - src/lib/profil-4g.ts
  - src/lib/publication-config.ts
  - src/lib/publication-ouverture.ts
  - src/pages/candidats/index.astro
  - src/pages/mentions-legales.astro
  - src/pages/methode.astro
  - src/pages/qui-sommes-nous.astro
  - src/pages/themes/[id].astro
  - src/styles/base.css
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 9 : revue de code (contenu relu, juridique et ouverture, plans 09-01 à 09-15)

**Revu le :** 2026-11-22
**Profondeur :** deep (chaînes suivies dans `equite.ts`, `load.ts`, `registre.ts`, `BlocSource.astro`, `Cellule`, RUNBOOK ; état réel du corpus lu avec `relecture liste`, lecture seule)
**Fichiers revus :** 45 (fichiers modifiés par les commits `(09-xx)`)
**Statut :** issues_found

## Résumé

Les gardes centrales tiennent. Le filtre de production des personnes sans statut relu (09-15) passe par une seule liste (`corpus.candidats`), et check-dist le double sur les pages, les liens et le plan du site. La liste blanche est appliquée à l'identique par le validateur, le view-model et check-dist (intersection `publie` ET listé), et le sens sûr ne fait qu'avertir. L'éditeur à positions refuse toute clé hors de sa liste fermée et vérifie après coup que rien d'autre n'a bougé. Le serveur de relecture est correctement défendu : Host exact, Origin, Sec-Fetch-Site, jeton en temps constant, corps plafonné, échappement unique, CSP sans script.

Le défaut sérieux est ailleurs. La « relecture » d'un texte publié n'est vérifiée que par l'outil local, jamais par la CI. Une mesure publiée, un statut relu ou une case de couverture peut donc changer de texte et partir en production avec la ligne « Relue par … le … » d'avant le changement (CR-01).

Viennent ensuite :
- la façon dont l'outil décide qu'une case est relue (WR-01) ;
- deux trous du tout ou rien de `publier` et de son lot (WR-03, WR-04) ;
- trois phrases publiques encore fausses ou fausses dans un état prévisible, dont deux écrites par la correction du jour (WR-05, WR-06, WR-07) ;
- le marqueur de retrait de l'hôte d'essai, absent des sauvegardes (WR-08).

Vérifications lancées (lecture seule, Node 24) :
- `npm run relecture -- liste --theme sante --relecteur "l'agent d'IA Claude"` donne `reste 0 sur 121` ;
- `npm run relecture -- liste --theme sante`, sans option, donne `reste 37 sur 121` sur un thème déjà publié (preuve de WR-01) ;
- le décompte des sources des 47 mesures santé publiées donne 20 mesures sourcées sur un document de parti (`auteur: parti_du_candidat`) et 2 sur un document de coalition (preuve de WR-06).

## Critical Issues

### CR-01 : rien n'empêche un texte modifié après relecture de partir en production avec sa mention « Relue par … »

**Fichiers :**
- `scripts/lib/relecture/etat.ts:210-214` (`a_revoir` calculé seulement par l'outil local) ;
- `scripts/lib/relecture/commandes/publier.ts:59-63` (refus `a_revoir` seulement au moment de publier) ;
- `scripts/lib/relecture/commandes/marquer.ts:66` (une mesure publiée ne peut pas être remarquée) ;
- `src/components/Mesure.astro:24`, `:54` ;
- `src/lib/corpus/vue.ts:309` ;
- `scripts/lib/check-dist.ts:883-899`.

**Problème :** l'empreinte du texte relu n'est enregistrée que dans `relecture/journal.jsonl`. Elle n'est comparée au contenu que par `liste`, `servir` et `publier`. Ni le validateur, ni `npm test`, ni check-dist ne lisent ce registre (aucune occurrence hors de `scripts/lib/relecture/`). En production, le view-model publie toute mesure `publie` et le statut `relu` le plus récent. Le composant affiche alors « Relue par {relecteur} le {date} », tiré des champs YAML, sans lien avec le texte réellement relu.

Scénario concret : une erreur est signalée sur une mesure santé publiée, et la correction est faite à la main dans `redactions.detaille`, comme le prévoit le RUNBOOK (ligne 387 : « une correction est une modification manuelle du YAML »). Les champs `statut_relecture: publie`, `relecteur` et `date_relecture` restent tels quels. `npm run validate`, `npm test`, `check-dist` et le déploiement passent. Le site montre le nouveau texte, que personne n'a relu, sous « Relue par l'agent d'IA Claude le 17 novembre 2026 ». Seul `liste` dirait « à revoir », mais rien n'oblige à le lancer pour une mesure déjà publiée. `publier` n'est pas rejoué, et `marquer` refuse une mesure publiée.

Même trou pour :
- un statut `relu` dont on modifie le `code` ou la `date` à la main ;
- une case de couverture : aucune garde du tout, voir WR-01. Exemple : après l'import de décembre, une case ajoutée pour une personne nouvellement déclarée et relue part en ligne sans relecture, et la garde d'équité n'exige que son existence.

C'est exactement le cas que la phase devait fermer : un contenu non relu en production.

**Correctif (petit, environ 40 lignes) :** ajouter un contrôle de dépôt qui échoue en CI (par exemple `tests/repo/relecture-empreintes.test.ts`, ou une règle du validateur en production) :
```ts
// Pour chaque mesure `publie` ou `relu` du corpus réel : la dernière ligne du journal pour `mesure:<id>` existe et
// son sha256 vaut empreinteMesure(data). Idem pour le statut retenu `relu`/`publie` de chaque candidat
// (empreinteStatut) et pour chaque case d'un thème publié (empreinteCase, voir WR-01).
const empreintes = dernieresEmpreintes(lireJournal(REPO_ROOT));
for (const m of mesures.filter((m) => m.data.statut_relecture === 'publie' || m.data.statut_relecture === 'relu')) {
  assert.equal(empreintes.get(`mesure:${m.id}`)?.sha256, empreinteMesure(m.data), `${m.id} : texte modifié depuis sa relecture, la repasser en brouillon (retirer) puis la relire`);
}
```
Ajouter au RUNBOOK la conduite à tenir pour corriger une mesure publiée : `retirer`, corriger, `marquer`, `publier`. Il faut aussi que `marquer` accepte une mesure `publie` dont l'empreinte a changé, sinon la seule voie reste `retirer`.

## Warnings

### WR-01 : une case est « relue » si `verifie_par` est égal au nom passé en option, et son empreinte n'est jamais comparée

**Fichiers :**
- `scripts/lib/relecture/etat.ts:276` (`etat: k.verifie_par === relecteur ? 'relu' : 'a_relire'`) ;
- `scripts/lib/relecture/etat.ts:135-137` (`empreinteCase`, écrite au journal par `marquer` et `retirer` mais jamais lue) ;
- `scripts/lib/relecture/commandes/publier.ts:36`, `:72-76`.

**Problème :** trois conséquences.
1. Une case relue puis modifiée à la main (`etat`, `sources_consultees`) reste « relue », alors qu'une mesure dans le même cas passe à « à revoir ».
2. L'état dépend du nom tapé. Sur le corpus réel, `liste --theme sante` sans option donne `reste 37 sur 121` sur un thème publié. La page `servir`, qui appelle `ficheCandidat` sans relecteur, montre les 37 cases « à relire » et propose de les « Valider ». La procédure du RUNBOOK (ligne 425 : « `liste --theme <id>` doit afficher `reste 0` ») échoue donc pour tout thème relu par l'agent.
3. Un thème dont les cases ont été vérifiées par deux relecteurs (Erwan pour une case, l'agent pour les autres) ne peut pas être publié. `publier --relecteur X` compte « à relire » toute case signée Y, et la seule issue est de réécrire le nom, donc de fausser la trace. À l'inverse, une case créée par un rédacteur avec un `verifie_par` égal au nom du relecteur (deux agents Claude) compte comme relue sans l'avoir été.

**Correctif (petit) :** calculer l'état d'une case comme celui d'une mesure : `relu` si la dernière ligne du journal pour `case:<theme>/<candidat>` a l'empreinte `empreinteCase(k)`, sinon `a_relire` ou `a_revoir`. `verifie_par` reste une information affichée, jamais un critère. Supprimer l'option `--relecteur` de `liste` (devenue inutile) ou la garder pour l'affichage seulement.

### WR-02 : le relecteur par défaut de `marquer`, `servir` et `retirer` est « Erwan Henry », contraire à la décision du 2026-11-17

**Fichiers :** `scripts/lib/relecture/etat.ts:15`, `scripts/lib/relecture/commandes/marquer.ts:209`, `scripts/lib/relecture/commandes/retirer.ts:178`, `scripts/lib/relecture/serveur.ts:439`

**Problème :** la décision de phase dit qu'« une mesure relue par un agent ne porte jamais « Relue par Erwan Henry » ». Or les relectures sont désormais faites par des agents, qui lancent `marquer` eux-mêmes (mémoire « autonomie max »). Un agent qui oublie `--relecteur` écrit `relecteur: Erwan Henry`, la CI passe et le site affiche « Relue par Erwan Henry le … » sur un texte qu'Erwan n'a pas lu. Rien ne détecte l'erreur. Le défaut n'a protégé `publier` que par accident : les cases signées par l'agent y sont vues « à relire » (WR-01).

**Correctif (petit) :** rendre `--relecteur` obligatoire pour `marquer`, `publier` et `retirer` en ligne de commande (code 2 sans lui). Garder « Erwan Henry » seulement pour le serveur local, qui n'est cliqué que par lui. Ajouter un test qui vérifie l'absence de défaut.

### WR-03 : `publier` ne peut pas changer une case de couverture : ajouter une mesure à un thème publié demande de le retirer

**Fichiers :** `scripts/lib/relecture/commandes/publier.ts:91-111`, `scripts/lib/pilote.ts:136-142`, `src/lib/content-core/rules/equite.ts:100-116`

**Problème :** sur santé, publié, une personne a la case `programme_non_publie`. Elle publie son programme ; une mesure est rédigée puis passe `relu`. Deux voies, toutes deux bloquées :
- `publier` fait passer la mesure à `publie` mais ne touche jamais la case. La vérification d'après écriture lève `EQUITE_COUVERTURE_INCOHERENTE` (case « programme non publié » et mesure publiée), restaure et refuse.
- Passer d'abord la case à `mesures` à la main lève `EQUITE_COUVERTURE_INCOHERENTE` et `PILOTE_INCOHERENCE` (« mesures » sans mesure publiée), car ces deux règles ne comptent que les mesures publiées sur un thème publié depuis le 2026-11-22.

Les seules issues sont `retirer --theme` (la page santé disparaît du site public le temps de republier) ou une modification à la main de la case et de la mesure dans le même commit, hors de l'outil. `retirer` sait changer la case dans la même opération ; `publier` non. Ce cas sera fréquent pendant la campagne, à chaque programme publié.

**Correctif (petit) :** donner à `publier` une option `--case-mesures <candidat,…>` (ou le faire automatiquement quand la case n'est pas `mesures` et que la personne aura au moins une mesure publiée après l'opération). Elle ajoute au même lot l'édition `etat: mesures`, déjà permise par l'éditeur (`CLES_ECRIVIBLES` contient `etat`), et la refuse si la case a une note ouverte. Ajouter le cas au test de `publier`.

### WR-04 : `appliquerLot` peut laisser un lot à moitié écrit : la restauration s'arrête à la première erreur

**Fichier :** `scripts/lib/relecture/lot.ts:52-66`

**Problème :** `ecrits.push(fichier)` est appelé avant `ecrireAtomique`. Si l'écriture du fichier k échoue (EACCES sur le dossier, disque plein, fichier devenu lien symbolique), `restaurer()` commence, dans l'ordre inverse, par le fichier k. Ce fichier n'a pas été écrit, et son écriture échoue de nouveau pour la même raison. L'exception sort de `restaurer()`, donc du `catch`, et les fichiers 1 à k-1 restent modifiés. L'erreur d'origine est perdue.

Exemple : `publier --theme sante` écrit 47 mesures puis le thème ; une erreur sur le fichier de thème laisse 47 mesures `publie` sur le disque avec un thème `brouillon`, et la commande se termine par une exception, pas par « fichiers restaurés ». Un `git add -A` derrière committe l'état partiel. Le « tout ou rien » documenté ne tient pas dans ce cas.

**Correctif (petit) :**
```ts
for (const [fichier, texte] of nouveaux) {
  ecrireAtomique(racine, fichier, texte);
  ecrits.push(fichier); // seulement après succès
}
// restaurer : chaque fichier dans son propre try, échecs collectés et renvoyés dans erreurs, jamais levés
```

### WR-05 : page Méthode, la phrase corrigée le 2026-11-22 promet une liste qui n'existe pas pour les candidatures pressenties

**Fichiers :** `src/pages/methode.astro:116`, `src/lib/corpus/vue.ts:313-316`, `src/pages/themes/[id].astro:71-95`

**Problème :** la phrase dit : « Les personnes qui ne se présentent pas, ou dont la candidature n'est que pressentie, ne sont affichées qu'une fois leur statut relu ; elles sont alors listées à part sur chaque page thème, avec le motif, la date et la source. » Le code fait autre chose :
- seules les personnes au statut `renonce` sont listées à part (`renonces`) ;
- une personne `pressenti` (ou `empeche`) relue n'est que comptée dans « N autres personnalités du jeu de données ne figurent pas ici » ;
- la liste « Ne se présentent pas » donne le motif et la date, mais pas la source (seulement un lien vers la page de la personne).

Dès qu'un statut pressenti est relu, la page affirme quelque chose de faux.

**Correctif (petit) :** « Les personnes qui ne se présentent pas ne sont affichées qu'une fois leur statut relu ; elles sont alors listées à part sur chaque page thème, avec le motif et la date, et leur page donne la source. Une candidature seulement pressentie, une fois relue, figure dans la liste des candidats, pas sur les pages thème. » Texte à faire valider par Erwan. Mettre à jour `tests/dist/cas/methode.cas.ts`.

### WR-06 : « un texte du candidat » sur les pages Méthode et Qui sommes-nous, alors que 22 des 47 mesures santé publiées citent un document de parti ou de coalition

**Fichiers :** `src/pages/methode.astro:88` (« Chaque mesure renvoie à un texte du candidat »), `:92` (« un texte publié par le candidat ou sa candidature »), `src/pages/qui-sommes-nous.astro:35` (« à partir du texte publié par le candidat, cité mot pour mot sous la mesure », phrase réécrite le 2026-11-22)

**Problème :** décompte du corpus en ligne : 20 mesures publiées s'appuient sur une source `auteur: parti_du_candidat` et 2 sur `auteur: coalition`. Pour ces mesures, la règle du 2026-11-17 fait justement dire aux rédactions « Son parti, … propose ». La même page Méthode cite d'ailleurs « le site de son parti » parmi les sources acceptées. Un journaliste qui suit le lien « Source primaire » d'une mesure de La France insoumise ou de Révolution permanente trouve un document du parti, pas du candidat, contrairement à ce qu'annoncent deux pages.

**Correctif (petit) :** Méthode : « Chaque mesure renvoie à un texte du candidat, de sa candidature ou de son parti, daté et archivé » et « un texte publié par le candidat, sa candidature ou son parti (la mesure le dit alors : « Son parti propose … »), jamais un article de presse ». Qui sommes-nous : « à partir du texte source (document du candidat ou de son parti), cité mot pour mot sous la mesure ». Textes à faire valider par Erwan.

### WR-07 : `/candidats/` dit « Le statut est celui de la dernière source consultée », ce qui deviendra faux dès l'import de décembre

**Fichiers :** `src/pages/candidats/index.astro:35`, `src/lib/corpus/vue.ts:239-241`

**Problème :** en production, le statut affiché est le plus récent des statuts **relus** (ADR-041), pas le plus récent. Exemple : l'import de décembre ajoute à une personne déclarée un statut `renonce` en brouillon, avec une source consultée le 10 décembre. Jusqu'à sa relecture, la page affiche « Candidature déclarée » et affirme que c'est le statut de la dernière source consultée, alors que la dernière source dit le contraire. Aujourd'hui, chaque fiche n'a qu'un statut et la phrase est vraie, mais elle cessera de l'être à la première entrée nouvelle (fenêtre de trois jours du RUNBOOK).

**Correctif (petit) :** en production : « Le statut affiché est le dernier statut relu ; un changement plus récent du jeu de données apparaît après sa relecture. » Garder la phrase actuelle en preview.

### WR-08 : le marqueur de retrait de l'hôte d'essai n'est pas sauvegardé, et l'étape `site-essai` répond « ok » sans vérifier que le bloc est absent

**Fichiers :** `ops/installer-serveur.sh:192-194`, `:752-762` ; `ops/tester-restauration.sh` (étape blocs) ; `ops/sauvegarder-config.sh` (ne copie pas `/opt/rtp/essai-retire`)

**Problème :**
1. Le marqueur `/opt/rtp/essai-retire` ne figure pas dans l'archive. Après une reconstruction du serveur depuis la sauvegarde (RUNBOOK, restauration), l'installateur rejoué avec la liste complète des étapes réinstalle `reveletonprog-essai.caddy`. Au rechargement suivant, l'hôte technique retiré le 2026-11-22 revient en ligne, avec un enregistrement DNS `essai` dont la suppression n'est pas confirmée.
2. Avec le marqueur présent, `etape_site_essai` imprime `[ok: retiré]` même si `sites.d/reveletonprog-essai.caddy` est toujours là (bloc remis à la main ou restauré). La vérification annonce alors un retrait qui n'est pas effectif.

**Correctif (petit) :** ajouter `opt/rtp/essai-retire` à la liste des fichiers sauvegardés (et au MANIFESTE). Dans `etape_site_essai`, quand le marqueur est présent et que `$BLOC_ESSAI` existe, dire `a faire` : « bloc d'essai présent alors que l'hôte est retiré : le déplacer dans /root/rtp-retire ». Le test de restauration hérite alors du contrôle.

### WR-09 : CANDIDAT_NON_RELU_EN_PRODUCTION ne voit pas les liens et pages sans barre finale

**Fichier :** `scripts/lib/check-dist.ts:362-371` (`idCandidatDuChemin` : `^\/candidats\/([^/]+)\/(?:index\.html)?$`), utilisé aux lignes 943-977

**Problème :** un lien `/candidats/paul-x` (sans barre finale, que Caddy sert), `/candidats/paul-x.html` ou une entrée de sitemap sans barre finale échappe au contrôle, de même qu'une page `candidats/paul-x.html` (format de build `file`). Le résumé 09-15 annonce pourtant la couverture de tous les liens (« absolu, relatif, avec fragment »). Le filtre du view-model reste la première défense, mais ce filet de sécurité a un trou. Les noms en texte simple (sans lien) ne sont pas non plus contrôlés.

**Correctif (petit) :** `^\/candidats\/([^/]+?)(?:\/(?:index\.html)?|\.html)?$`, plus un cas de test pour chaque forme. En option, chercher aussi « prénom nom » des personnes écartées dans le texte visible des pages de production.

## Info

### IN-01 : Mentions légales, phrase sur le juriste écrite au futur pour un événement passé

**Fichier :** `src/pages/mentions-legales.astro:105` (REVISION 2026-11-12)

« Aucune relecture par un juriste n'est prévue avant l'ouverture du site. » Le site est ouvert depuis le 2026-11-22. Proposition : « Ces mentions n'ont pas été relues par un juriste avant l'ouverture du site, le 22 novembre 2026 ; un juriste pourra les relire. » REVISION à mettre à jour.

### IN-02 : `scripts/e2e.ts`, le vrai corpus n'est testé dans le navigateur qu'en preview

**Fichier :** `scripts/e2e.ts:38-42`

Le commentaire dit « Vrai corpus (pas encore la racine par défaut) », ce qui n'est plus vrai. Axe, le test sans JavaScript et le test au clavier ne passent jamais sur la build de production du vrai corpus, celle qui est en ligne (seul `tests/dist` construit `reel-production`). Proposition : ajouter un jeu `reel-production`.

### IN-03 : `--wayback-only` et `--wayback-adopter` réécrivent la source et suppriment ses commentaires YAML

**Fichier :** `scripts/archive-source.ts:390-392`, `:606-620` (`buildSourceYaml(paramsDe(src.data))`)

La réécriture se fait par resérialisation. Elle supprime par exemple le commentaire qui explique la `date_publication` par défaut d'une page de parti non datée (décision du 2026-11-17, point 5). Le diff est montré, mais rien ne prévient. Proposition : refuser (ou avertir) quand le fichier contient `#`, ou écrire `wayback_url` et `url` par l'éditeur à positions.

### IN-04 : `publier --dry-run` annonce un succès que la vraie commande peut refuser

**Fichier :** `scripts/lib/relecture/commandes/publier.ts:101-105`

L'essai à blanc s'arrête avant la validation de production d'après écriture. Le cas de WR-03 passe donc l'essai à blanc puis échoue réellement. Proposition : appliquer le lot dans un dossier temporaire (copie de `src/content`), ou valider en mémoire les textes calculés.

### IN-05 : PILOTE_CASE_MANQUANTE juge un thème publié avec le périmètre de preview

**Fichier :** `scripts/lib/pilote.ts:77`, `:93`, `:183-187`

Après l'import de décembre, une personne nouvellement déclarée, avec un statut en brouillon, entre dans le périmètre du pilote (preview). Elle fait échouer `npm test` sur santé tant qu'elle n'a pas de case, alors que la production ne l'affiche pas et que la règle d'équité de production ne demande rien. La CI de la pull request d'import passe au rouge sans erreur de contenu publié. Proposition : pour un thème publié, prendre `dansPerimetre(statuts, 'production')`, comme pour le comptage des mesures introduit le 2026-11-22 ; ou le documenter dans la procédure d'import.

## Vérifié et trouvé sain

- **Filtre 09-15.** `construireCorpus` écarte avant le calcul des rangs toute personne pour qui `statutAffiche(c, 'production') === null`. Cette définition est la même que celle du validateur (`statutRetenu`) et de `candidatsNonRelus`. Les mesures d'une personne écartée sont filtrées (`parId.has`), et `pageCandidat` comme `candidat` lèvent pour elle. Les pages, l'index, les cellules, `renonces`, `autresPersonnalites` et le plan du site dérivent tous de cette liste.
- **Liste blanche.** Lecteur strict : alias refusés, clé inconnue refusée, doublons refusés, slug contrôlé, fichier absent compté comme liste vide. Intersection identique dans `vue.ts:269`, `cellulesAttendues` et la règle. Sens dangereux : erreur en production. Sens sûr : avertissement, `THEME_OUVERT_ABSENT` et `PUBLICATION_VIDE` compris (un retrait par thème se déploie).
- **`retirer`.** Refuse sans `--case` quand la case dirait `mesures` sans mesure publiée. Contrôle que les sources passées appartiennent au candidat. Repli `--theme` sans décision éditoriale. Validation de production complète puis restauration en cas d'échec, sauf l'ordre de restauration de WR-04. Cohérent avec la règle des cases du 2026-11-22.
- **Règle des cases (`pilote.ts`, 2026-11-22).** Sur un thème publié, seules les mesures publiées comptent, comme dans `regleEquite`. Aucun cas ne laisse passer une case qui contredit la production. Le seul effet indésirable est le blocage de WR-03.
- **Wayback.** `ARCHIVE_WAYBACK_ABSENTE` est une erreur pour toute source citée par une mesure publiée. L'exception exige `motif` (20 caractères au moins), `decide_par` et `decide_le`, et le schéma l'interdit à côté de `wayback_url`. L'adoption exige que tous les paragraphes de l'extrait se retrouvent dans l'instantané, refuse un extrait vide et refuse une URL finale différente. Une source sous exception n'est jamais soumise ni adoptée.
- **Serveur de relecture.** Écoute sur 127.0.0.1 vérifiée après `listen`. Host exact (421) contre le rebinding DNS. Origin et Sec-Fetch-Site contrôlés aussi sur les GET. Referrer-Policy `same-origin`, justifiée (sous `no-referrer`, le POST porterait `Origin: null`), avec liens externes en `noreferrer`. Corps plafonné même sans Content-Length. Champs en double refusés. Le jeton n'apparaît ni dans le journal ni dans une URL. Les écritures passent par `marquer`, donc par `ecrireAtomique`, confiné à `src/content` après résolution des liens.
- **Installateur.** Une ou deux clés ed25519, doublon détecté sur le corps de la clé (commentaire ignoré), préfixe `restrict,command=` exact sur chaque ligne, `authorized_keys` et dossier personnel à root. `site-public` refusé sans `current` (code 7) et sur un domaine réservé (code 6). Le marqueur n'est jamais créé par le script.
- **check-dist.** RELECTURE_ABSENTE exige exactement une ligne par mesure, avec un relecteur non vide et une date calendaire. PARTAGE_INCORRECT (og:url égal à l'URL canonique, image sur le domaine et présente dans le dist, jamais chargée par la page) est cohérent.
- **Mentions légales.** Durée du journal (`RETENTION_MAX_JOURS`), masques IP et plafond de la sortie d'erreur tirés des constantes partagées avec les blocs Caddy et le fichier de composition. Phrase d'identité et paragraphe RGPD seulement sous `actif`.

---

_Revu le : 2026-11-22T18:04:17Z_
_Relecteur : Claude (gsd-code-reviewer)_
_Profondeur : deep_
