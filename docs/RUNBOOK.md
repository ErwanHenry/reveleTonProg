# Runbook — reveleTonProg

## Accès

- **VPS** : `ubuntu-4gb-nbg1-2` (Hetzner), accès SSH avec la clé d'Erwan ; clé de déploiement CI dans GitHub Secrets (lot 3).
- **Repo** : https://github.com/ErwanHenry/reveleTonProg
- **Archives binaires** : dépôt privé `reveleTonProg-archives`.

## Node 24

Le projet tourne sous Node 24 LTS (`.nvmrc`). Avec fnm : `fnm use`, ou pour une seule commande `fnm exec --using=24 npm test`. Pour en faire le défaut de la machine : `fnm default 24`. Si `node -v` n'affiche pas 24 alors que fnm l'annonce installé, réparer l'installation (`fnm install 24`) plutôt que de contourner la version : `engine-strict` refuse un Node plus ancien.

`.npmrc` pose aussi `ignore-scripts=true` : `npm ci` n'exécute aucun script d'installation de dépendance (surface d'attaque supply-chain sur les PR de forks). Si un paquet en exige un un jour, lancer `npm rebuild <paquet>` explicitement et le justifier dans la PR.

## Commandes courantes

```bash
npm run validate                  # données valides ? (racine : RTP_CONTENT_ROOT, sinon . = vrai corpus ; mode production)
npm run validate -- --mode preview  # idem, équité en avertissement (local seulement)
npm run ids -- --check            # ids.lock couvre-t-il exactement les candidats ?
npm run ids -- --write            # ajoute les nouveaux candidats à ids.lock (ajout seul)
npm run check                     # astro check : types
npm run migrate -- --check        # le contenu est-il au dernier schéma ?
npm run migrate -- --write        # applique les migrations de schéma
npm test                          # tests (TZ=Europe/Paris)
npm run build                     # génère dist/
npm run preview                   # sert dist/ en local
```

Par défaut ces commandes lisent le vrai corpus (`.`). Pour le corpus fictif de test : `RTP_CONTENT_ROOT=tests/fixtures/corpus-valide`.

Autres commandes de la phase 3 : `npm run import:datagouv`, `npm run archive`, `npm run couverture` (sections ci-dessous).

### Ajouter ou corriger une mesure
1. Créer/éditer `src/content/mesures/<candidat>/<slug>.yaml` (statut `brouillon`), sans commentaire dans le fichier (D-13).
2. Déposer l'extrait texte de la source dans `archives/<candidat>/<sha12>.txt`, puis créer `src/content/sources/<id>.yaml` avec `archive.sha256` (hash du `.txt`), la date de capture et, si possible, `archive.wayback_url`. Le PDF ou le HTML rendu va dans le dépôt privé `reveleTonProg-archives`.
3. `npm run validate && npm test`, puis pull request ; passer `statut_relecture: publie` après relecture.

Les chiffres et les citations des rédactions doivent remonter, mot pour mot, au `texte_source` de la mesure, lui-même mot pour mot dans l'extrait archivé (voir `CHIFFRE_HORS_SOURCE`, `CITATION_HORS_SOURCE` et `TEXTE_SOURCE_HORS_ARCHIVE` plus bas).

### Lire un diagnostic

Chaque erreur de validation a la forme :

```
fichier:ligne:col CODE message (pointeur)
```

Exemple : `src/content/candidats/marie-fictive.yaml:12:5 SCHEMA_REQUIRED propriété requise manquante (/statuts/0/motif)`. Le fichier, la ligne et la colonne désignent l'endroit à corriger ; le pointeur donne le chemin JSON dans le fichier.

Dans GitHub Actions, la sortie `--format github` produit des annotations sur les fichiers, **limitées à 10 par étape** : la liste complète est toujours dans le journal de l'étape.

### Codes du validateur

`npm run validate` (et la CI) refuse une donnée avec un code stable. Colonne « Gravité » : *erreur* bloque toujours ; *avertissement* ne bloque jamais ; *selon le mode* est une erreur en production et un avertissement en preview ; *selon le statut* dépend du `statut_relecture` de la mesure. Les erreurs de forme (schéma, YAML) ont leurs propres codes `SCHEMA_*` et `YAML_*`, décrits par leur message.

| Code | Règle | Gravité | Que faire |
|------|-------|---------|-----------|
| `SOURCE_ABSENTE` | REGLE-01 | erreur | Ajouter `source:` (identifiant d'un fichier de `src/content/sources/`) à la mesure. |
| `TEXTE_SOURCE_ABSENT` | REGLE-01 | erreur | Ajouter `texte_source` : le passage exact de la source qui fonde la mesure. |
| `SOURCE_INCONNUE` | REGLE-01 | erreur | Corriger l'identifiant de source ou créer le fichier de source. |
| `SOURCE_NON_PRIMAIRE` | REGLE-01 | erreur | Une mesure ne s'appuie jamais sur la presse : citer le programme, le site du candidat, du parti ou une institution (ADR-006). |
| `SOURCE_AUTRE_CANDIDAT` | REGLE-01 | erreur | La source doit lister le candidat de la mesure dans `candidats[]` : choisir la bonne source. |
| `ARCHIVE_ABSENTE` | REGLE-01 | erreur | Déposer l'extrait `archives/<candidat>/<sha12>.txt` et renseigner `archive` dans la source (fichier réel, pas un lien symbolique). |
| `ARCHIVE_SHA256_DIVERGENT` | REGLE-01 | erreur | Recalculer le sha256 de l'extrait et corriger `archive.sha256` ; si l'extrait a changé sans raison, restaurer l'original. |
| `ARCHIVE_TROP_VOLUMINEUX` | REGLE-01 | erreur | L'extrait dépasse 5 Mo : n'en garder que le texte utile ; le binaire va dans le dépôt privé. |
| `ARCHIVE_WAYBACK_ABSENTE` | REGLE-01 | erreur | Une mesure publiée exige `archive.wayback_url` sur sa source : demander une capture Wayback Machine. |
| `MOT_INTERDIT` | REGLE-02 | erreur | Reformuler sans le mot signalé. Une citation exacte mise entre « » est exemptée, à condition d'être mot pour mot dans `texte_source`. |
| `GUILLEMETS_DESEQUILIBRES` | REGLE-02 | erreur | Rétablir les « » ouvrants et fermants. |
| `VERBE_CONNOTE` | REGLE-02 | avertissement | Préférer un verbe neutre (« dit », « propose ») à un verbe de parole connoté. |
| `CARACTERE_SUSPECT` | REGLE-02 | erreur | Retirer le caractère invisible, bidirectionnel, d'une écriture non latine (cyrillique, grec) imitant une lettre latine (i sans point, petites capitales) ou un chiffre non ASCII (pleine chasse, arabo-indien). |
| `LONGUEUR_HORS_BORNES` | REGLE-03 | erreur | Ramener la rédaction dans les bornes de son niveau (le message donne le décompte et les bornes). |
| `CHIFFRE_HORS_SOURCE` | REGLE-04 | erreur | Supprimer le chiffre ou le justifier : il doit figurer dans `texte_source` ou dans `chiffrage.texte` (lui-même archivé). Vaut pour résumé, enfant et aîné. |
| `CHIFFRE_DETAILLE_HORS_SOURCE` | REGLE-04 | avertissement | Même contrôle que `CHIFFRE_HORS_SOURCE`, pour le titre et le détaillé : un chiffre (date, somme) absent de `texte_source` et de `chiffrage.texte`. Établir le chiffre dans `texte_source` ou le retirer. |
| `NOMBRE_LETTRES_HORS_SOURCE` | REGLE-04 | avertissement | Un nombre écrit en lettres n'est pas dans la source : vérifier qu'il n'est pas inventé. |
| `CITATION_HORS_SOURCE` | REGLE-04 | erreur | Une citation « … » doit être mot pour mot dans `texte_source` (casse et ponctuation ignorées, accents significatifs). |
| `TEXTE_SOURCE_HORS_ARCHIVE` | REGLE-05 | erreur | Recopier `texte_source` tel qu'il est dans l'extrait archivé. |
| `CHIFFRAGE_HORS_ARCHIVE` | REGLE-05 | erreur | Recopier `chiffrage.texte` tel qu'il est dans l'extrait archivé ; seul le chiffrage du candidat est admis. |
| `TEXTE_SOURCE_TROP_COURT` | REGLE-05 | avertissement | Citer un passage plus complet (au moins 4 mots). |
| `TEXTE_SOURCE_TROP_LONG` | REGLE-05 | erreur en production, avertissement en preview | Réduire la citation au passage utile (au plus 120 mots) : un `texte_source` démesuré légitimerait tous les chiffres et toutes les citations. |
| `PHRASE_ENFANT_LONGUE` | REGLE-06 | selon le statut | Couper la phrase de la rédaction enfant (15 mots au plus). Erreur pour `relu` et `publie`, avertissement pour `brouillon`. |
| `LISIBILITE_ENFANT_FAIBLE` | REGLE-06 | avertissement | Raccourcir phrases et mots de la rédaction enfant ; l'indice Kandel-Moles est indicatif. |
| `ID_CHEMIN_INCOHERENT` | REGLE-07 | erreur | Faire correspondre l'`id` (ou le `candidat`) au nom du dossier et du fichier. |
| `REFERENCE_CASSEE` | REGLE-07 | erreur | La référence (thème, candidat, source, `[[terme]]`...) vise une entrée inexistante : corriger l'identifiant ou créer l'entrée. |
| `ID_VERROUILLE_DISPARU` | REGLE-07 | erreur | Un identifiant de `ids.lock` n'a plus de fichier (renommé ou supprimé) : le restaurer, jamais retirer la ligne. |
| `ID_NON_VERROUILLE` | REGLE-07 | erreur | Lancer `npm run ids -- --write` et commiter `ids.lock`. |
| `IDS_LOCK_ABSENT` | REGLE-07 | erreur | Il y a des candidats sans `ids.lock` : lancer `npm run ids -- --write`. |
| `IDS_LOCK_INVALIDE` | REGLE-07 | erreur | Une ligne de `ids.lock` est mal formée, en double ou mal triée : restaurer le fichier depuis Git puis relancer `npm run ids -- --write`. |
| `EQUITE_CANDIDAT_MANQUANT` | REGLE-08 | selon le mode | Un candidat `declare` ou `primaire` n'a ni mesure publiée ni case de couverture sur un thème publié : ajouter la mesure ou la case, ou repasser le thème en brouillon. |
| `EQUITE_PERIMETRE_VIDE` | REGLE-08 | selon le mode | Un thème est publié alors qu'aucun candidat n'a de statut `declare` ou `primaire` relu (en production) : relire les statuts des candidats avant de publier le thème, ou le repasser en brouillon. |
| `EQUITE_COUVERTURE_INCOHERENTE` | REGLE-08 | selon le mode | Aligner la couverture du thème sur les mesures publiées : l'état `mesures` exige une mesure publiée, `non_precise` et `programme_non_publie` n'en admettent pas. |
| `SONDAGE_NOTICE_ABSENTE` | REGLE-09 | erreur | Renseigner `url_notice` : la notice officielle de la Commission des sondages. |
| `SONDAGE_SOMME_HORS_BORNES` | REGLE-09 | erreur | La somme des scores d'une hypothèse doit tenir entre 95 et 105 : corriger les scores. |
| `SONDAGE_TOUR2_EN_TOUR1` | REGLE-09 | erreur | Une hypothèse de duel ne va pas dans un sondage de `tour: 1` : la placer dans un sondage de second tour. |
| `SONDAGE_TOUR1_EN_TOUR2` | REGLE-09 | erreur | Une hypothèse de plus de deux candidats ne va pas dans un sondage de `tour: 2`. |
| `SONDAGE_FENETRE_BLOCAGE` | REGLE-09 | erreur | Ne pas publier pendant une fenêtre de blocage légal (du samedi 00h00 au dimanche 20h00, heure de Paris, veille et jour du scrutin) : corriger la date ou différer. |
| `SONDAGE_CANDIDAT_DOUBLON` | REGLE-09 | erreur | Un même candidat apparaît deux fois dans une hypothèse : retirer le doublon. |
| `CHAMP_NON_IMPORTABLE` | REGLE-12 | erreur | Retirer la clé `bloc`, `extdroite` ou `propositions` copiée du dataset data.gouv : elles n'entrent jamais dans `src/content/`. |
| `REGLE_ECHEC` | REGLE-11 | erreur | Une règle a planté et la validation échoue plutôt que de passer en silence : relever le message et ouvrir une issue avec le fichier fautif (voir « Faux positif d'une règle »). |

La liste fait foi dans `src/lib/content-core/rules/config.ts` (`CATALOGUE`) ; `tests/repo/docs.test.ts` vérifie que ce tableau mentionne chaque code.

### Verrouiller un identifiant de candidat

Les URL de candidats sont permanentes : `ids.lock` (à la racine du contenu) liste les identifiants dans l'ordre, en **ajout seul**.

1. Créer `src/content/candidats/<id>.yaml`.
2. `npm run ids -- --write` ajoute l'identifiant à `ids.lock` (tri automatique, écriture atomique) ; commiter les deux fichiers dans la même pull request.
3. `npm run ids -- --check` vérifie que le verrou couvre exactement les candidats (`ID_NON_VERROUILLE`, `ID_VERROUILLE_DISPARU`...).

Ne jamais renommer ni supprimer un candidat verrouillé, ni retirer une ligne de `ids.lock` : `npm run ids -- --write` refuse sans toucher au fichier. Si on supprime la ligne **et** le fichier du candidat, la validation seule ne voit plus rien : c'est la CI qui l'attrape. Une étape dédiée compare le `ids.lock` de la racine à celui du commit de base (`npm run ids -- --check --base <fichier>` ; base = branche cible d'une pull request, ou commit précédent d'un push) et échoue avec `ID_VERROUILLE_DISPARU` si une ligne a disparu. À la toute première introduction du fichier, l'étape est sautée faute de base.

### Ajouter un piège

Un piège est une donnée volontairement fautive, rejouée par `npm test` : le test échoue si elle passe, ou si elle produit un diagnostic imprévu. Les sept pièges du cahier des charges §12 existent déjà ; en ajouter un pour chaque nouveau cas ou chaque faux positif corrigé.

1. Créer `tests/fixtures/pieges/<CODE>[--variante]/attendu.json` (`<CODE>` : le code attendu ; `--variante` : un cas particulier, par exemple `--preview` ou `--dans-citation-ok`).
2. Champs : `piege` (libellé du cas), `regle` (REGLE-nn), `mode` (`production` par défaut, ou `preview`), `remplacer` (liste de `{ fichier, de, par }` appliquée à une copie temporaire de `tests/fixtures/corpus-valide` ; `de` doit apparaître **exactement une fois** dans le fichier, sinon le test échoue), `supprimer` (chemins à retirer de la copie) et `attendu` (liste **exacte** des diagnostics : `code`, `severite` `error` ou `warning`, `fichier`, `pointer`, et `ligne` si on veut la figer). Un diagnostic de plus ou de moins fait échouer le test.
3. Tout autre fichier placé dans le dossier du piège (un extrait d'archive par exemple) est copié par-dessus la copie du corpus, au même chemin relatif ; si l'extrait change, mettre à jour le `sha256` de la source dans un `remplacer`.
4. Un code qui referme un piège du §12 a `piege` non nul dans `CATALOGUE` ; `tests/pieges/couverture.test.ts` exige un dossier par piège du §12 et un test pour chaque code du catalogue.
5. Lancer `npm test`.

Une variante `--…-ok` dont l'`attendu` est `[]` sert de piège négatif : elle prouve qu'un cas légitime (une citation, par exemple) n'est pas refusé.

### Faux positif d'une règle

Une règle refuse un contenu légitime ?

1. Ne pas contourner : ni `--mode preview` (il n'allège que l'équité), ni retrait de la règle, ni commentaire dans le contenu.
2. Ouvrir une issue avec le fichier, le code et le texte en cause.
3. Ajouter un piège négatif (`tests/fixtures/pieges/<CODE>--<cas>-ok/attendu.json`, `attendu: []`) qui reproduit le cas.
4. Corriger la règle ou sa configuration par une pull request relue : les listes et seuils vivent dans `src/lib/content-core/rules/config.ts` (mots interdits, bornes, fenêtres, hypothèses A1 à A12). Toute modification de règle laisse ainsi une trace Git et un test.
5. La boucle de retour d'expérience (relecteurs, corpus réel) est outillée en phase 3 ; d'ici là, l'issue fait foi.

### Mode preview

Le mode `production` est le défaut et le **seul mode de la CI** : les deux étapes `validate` du workflow passent `--mode production --format github`, et `tests/repo/ci.test.ts` le vérifie.

Le mode `preview` ne sert qu'en local, pour rédiger un thème sans avoir encore couvert tous les candidats : `npm run validate -- --mode preview` ou `RTP_MODE=preview npm run validate`. Seuls les codes « selon le mode » (`EQUITE_CANDIDAT_MANQUANT`, `EQUITE_COUVERTURE_INCOHERENTE`, `EQUITE_PERIMETRE_VIDE` et `TEXTE_SOURCE_TROP_LONG`) deviennent des avertissements (annotation `::warning`, code de sortie 0) ; toutes les autres règles continuent de bloquer. `--mode` l'emporte sur `RTP_MODE` et une valeur inconnue est refusée (code de sortie 2). Avant la pull request, relancer en production : c'est ce que fera la CI.

### Prévisualiser les brouillons

`RTP_MODE=preview npm run build` (ou `npm run dev`) affiche les mesures en brouillon et relues avec leur pastille, ajoute un bandeau de prévisualisation, met chaque page en `noindex` et écrit un `robots.txt` qui interdit tout. Sans `RTP_MODE`, c'est la production. **Ne jamais fixer `RTP_MODE` dans la CI** : `tests/repo/ci.test.ts` le vérifie.

### Tests navigateur (e2e)

`npm run e2e` construit la fixture (`corpus-m1`) puis le vrai corpus en mode preview, sert chaque dossier avec `e2e/serveur.ts` (compression gzip comme Caddy) et lance Playwright. Les fichiers de `e2e/` prouvent : fonctionnement sans JS et changement de niveau (`sans-js`), parcours au clavier (`clavier`), WCAG 2.2 AA par axe (`axe` : échec sur toute violation d'impact `serious` ou `critical`, les impacts `minor` et `moderate` ne bloquent pas ; même seuil annoncé sur la page Méthode), contraste (`contraste`), texte agrandi à 160 % (`texte`), `prefers-reduced-motion` (`mouvement`), aucun tiers, cookie ni clé `localStorage` hors réglages (`vie-privee`), et le temps de chargement à froid de la page la plus lourde sur deux connexions lentes simulées par CDP (`4g`, Chromium uniquement) : moins de 1 s avec 150 ms de latence par requête et 1,6 Mbit/s, moins de 1,5 s avec l'équivalent DevTools du « Slow 4G » de Lighthouse (562,5 ms par requête, 1,44 Mbit/s). Profils et budgets : `src/lib/profil-4g.ts`, repris tels quels par la page Méthode. Chaque mesure ouvre un contexte de navigateur neuf (cache et connexions neufs) ; le serveur local n'a ni DNS ni TLS, une mesure réelle derrière Caddy peut être plus lente.

La Phase 7 ajoute quatre fichiers. `csp` et `csp-sans-js` chargent chaque page des deux dist sous sa propre CSP et exigent zéro `securitypolicyviolation` et une console vide, avec et sans JavaScript, et que les deux scripts en ligne aient tourné. `parcours` suit le chemin accueil, Thèmes, thème, Aîné, candidat, Enfant, retour arrière, et prouve que la page revenue du bfcache affiche Enfant ; une copie du dist sans le gestionnaire `pageshow` doit échouer. `retour` fait le même chemin avec un retour arrière sans bfcache.

- `bypassCSP: true` est le défaut de `playwright.config.ts` (texte.spec injecte des styles par `page.addStyleTag`, qu'une CSP à empreintes refuse) ; seuls `csp.spec.ts` et `csp-sans-js.spec.ts` posent `bypassCSP: false`.
- Le projet `parcours` utilise `channel: 'chromium'` (nouveau mode headless) et retire l'option de lancement qui coupe le bfcache : le headless shell par défaut ne restaure jamais une page du bfcache. `npx playwright install chromium` installe ce navigateur ; la CI le fait déjà.
- Mesures 4G après l'intégration du CSS et des scripts dans la page (07-05, serveur local gzip, page la plus lourde `/themes/sante/` du vrai corpus, 180 590 octets bruts, 29 622 octets gzip) : environ 730 ms en « Slow 4G » (1257 ms avant) et environ 300 ms à 150 ms de latence (environ 420 ms avant). Les budgets publiés (1 s et 1,5 s) n'ont pas changé.
- Première exécution : `npx playwright install chromium` (téléchargement du navigateur).
- Ne jamais le lancer en même temps que `npm test` (cache `.astro` partagé). Un seul jeu : `npm run e2e -- --jeu m1` ; un seul fichier : `npm run e2e -- --jeu m1 -- e2e/axe.spec.ts`.
- Le rapport HTML est écrit dans `playwright-report/` (ignoré par Git). En CI, le job `e2e` le téléverse seulement en cas d'échec (7 jours).
- Si le Mac se met en veille pendant l'exécution, des tests peuvent expirer : relancer ; la CI fait foi.

### URL de test

Le livrable du lot 2 est l'artefact `site-preview` du job `verifier` : la build preview du vrai corpus (`dist-preview`, déjà contrôlée `noindex` et `robots.txt`), conservée 14 jours.

1. GitHub, Actions, dernière exécution de `CI` sur `main`, télécharger `site-preview` (zip) et le décompresser.
2. `node e2e/serveur.ts <dossier> 4173`, ouvrir http://127.0.0.1:4173/. Le serveur envoie l'en-tête CSP du bloc Caddy, calculé depuis les scripts de la copie locale : si l'artefact vient d'un autre commit et que ses scripts ont changé, ils sont bloqués (la page reste lisible sans JS) ; ajouter `--sans-entete-csp` ou se placer sur le commit de l'exécution.
3. Pour partager avec un relecteur : lui donner le lien de l'exécution (accès selon la visibilité du dépôt) ou le zip ; au-delà de 14 jours, relancer le workflow.

En local : `RTP_MODE=preview npm run build -- --outDir dist-preview`, puis la même commande de service.

### Contrôle post-build (check-dist)

`npm run check-dist` lit `dist/` (options : `--dist`, `--root`, `--mode`, `--format text|github`) et sort en erreur au premier constat bloquant. La CI le lance juste après `npm run build`. Limites : 500 000 octets bruts et 100 000 octets gzip par page (HTML plus CSS et JS liés), 2048 octets par script ; 1 Ko = 1000 octets.

| Code | Sens | Correction usuelle |
|------|------|--------------------|
| `POIDS_BRUT` | page de plus de 500 000 octets | alléger la page ou la scinder |
| `POIDS_GZIP` | page de plus de 100 000 octets compressés | idem ; c'est la limite qui mord en premier |
| `SCRIPT_TROP_LOURD` | script de plus de 2048 octets | réduire le script |
| `RESSOURCE_TIERCE` | ressource chargée depuis un autre site | héberger la ressource dans le dépôt ou la retirer |
| `LIEN_EXTERNE_NON_PROTEGE` | lien externe sans `rel="noopener noreferrer"`, ou schéma autre que `https:`, `mailto:` et lien relatif | ajouter le `rel`, ou remplacer le lien |
| `SCRIPT_EN_LIGNE` | `<script>` en ligne dont le corps diffère, octet pour octet, de chaque fichier de `src/scripts/`, ou gestionnaire `on…=` en attribut | inclure le fichier tel quel (`?raw` + `is:inline set:html`), jamais de code écrit dans la page |
| `SCRIPT_DATA_URI` | script en `data:` | idem |
| `SCRIPT_NON_BLOQUANT` | script d'ordre ou de niveau en `async`/`defer`/`module` | le remettre bloquant dans `<head>` |
| `STYLE_EN_LIGNE` | attribut `style=` (les blocs `<style>` sont permis s'ils sont hachés, voir `STYLE_SANS_EMPREINTE`) | utiliser une classe CSS |
| `ID_DUPLIQUE` | même `id` deux fois dans une page | rendre l'id unique |
| `ESPACE_PERDU` | mot collé à un bouton ou à une définition | remettre l'espace ou la ponctuation |
| `MOT_INTERDIT` | mot interdit dans le texte rendu | reformuler la rédaction |
| `MESURE_SANS_SOURCE_DATEE` | mesure affichée sans source datée | compléter la source |
| `CELLULES_INCOHERENTES` | nombre de cellules différent du attendu pour le thème | vérifier la couverture et les candidats |
| `THEME_INATTENDU` | page de thème absente du corpus publié | retirer la page ou publier le thème |
| `BROUILLON_EN_PRODUCTION` | trace de brouillon dans un build de production | vérifier `RTP_MODE` et le statut de la mesure |
| `PREVIEW_INDEXABLE` | build preview indexable : page sans `noindex`, `robots.txt` sans `Disallow: /`, `<link rel="canonical">` dans une page, `sitemap.xml` présent ou ligne `Sitemap:` dans `robots.txt` | vérifier le mode du build (`RTP_MODE=preview`) ; la preview n'a pas d'URL publique |
| `LIEN_INTERNE_CASSE` | lien interne vers une page ou une ancre absente | corriger le lien |
| `LANG_ABSENTE` | `<html>` sans `lang="fr"` | corriger la mise en page |
| `H1_NOMBRE` | zéro ou plusieurs `h1` | un seul `h1` par page |
| `MARQUEUR_RESIDUEL` | marqueur de gabarit resté dans le HTML | corriger le rendu |
| `DIST_VIDE` | aucun HTML dans `dist/` | construire d'abord le site |
| `META_REFRESH` | `<meta http-equiv="refresh">` dans une page | retirer la redirection ; en faire une règle du serveur |
| `BASE_INTERDITE` | `<base>` dans une page | le retirer : il réécrit tous les liens relatifs |
| `CONTACT_PROVISOIRE` | lien `mailto:` en `.invalid` (contact de `config/site.yml` pas encore remplacé) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : renseigner un vrai contact |
| `CSP_ABSENTE` | page sans meta CSP, avec plusieurs, ou meta hors de `<head>` (le navigateur l'ignore) | vérifier `security.csp` dans `astro.config.mjs` et la mise en page |
| `CSP_TROP_PERMISSIVE` | jeton de la CSP autre que `'self'`, `'none'` ou une empreinte sha256 (`'unsafe-inline'`, `*`, `https:`…), y compris dans une directive répétée | retirer le jeton ; ne jamais affaiblir la politique pour faire passer un script |
| `SCRIPT_SANS_EMPREINTE` | empreinte d'un script en ligne absente de la directive effective (`script-src-elem`, sinon `script-src`, sinon `default-src`) | reconstruire : les empreintes sont calculées au chargement de `astro.config.mjs` par `src/lib/csp-empreintes.ts` |
| `STYLE_SANS_EMPREINTE` | empreinte d'un `<style>` absente de la directive effective (`style-src-elem`, `style-src`, `default-src`) | reconstruire ; vérifier `security.csp` (Astro hache les styles qu'il écrit) |
| `CANONIQUE_ABSENT` | page de production sans `<link rel="canonical">` ou avec plusieurs | vérifier `Base.astro` (un seul lien, production seulement) |
| `CANONIQUE_INCORRECT` | URL canonique différente de `https://` + domaine de `config/site.yml` + chemin de la page (relative, `http:`, autre hôte, `www.`, mauvais chemin) | reconstruire après tout changement de domaine ; ne jamais écrire l'URL à la main |
| `SITEMAP_INCOHERENT` | `sitemap.xml` absent en production, ou liste différente des URL canoniques des pages (manquante, en trop, en double) | reconstruire ; vérifier `src/lib/sitemap.ts` si une page a été ajoutée hors de `cheminsDuSite` |
| `ROBOTS_SANS_SITEMAP` | `robots.txt` de production absent ou sans la ligne `Sitemap: https://<domaine>/sitemap.xml` | reconstruire ; vérifier `src/pages/robots.txt.ts` |
| `DOMAINE_PROVISOIRE` | domaine de `config/site.yml` en `.invalid` (un constat pour le dist), ou URL canonique vers un domaine `.invalid` | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : voir « Changer de domaine » |
| `HEBERGEUR_PREVU` | page qui porte `data-hebergeur="prevu"` (Méthode, Mentions légales : « pas encore en ligne », relecture par un juriste à venir) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : passer `statut: actif` dans `config/hebergeur.yml` et reconstruire |

**Garde de déploiement (contact et domaine).** Tant que le domaine n'est pas acheté, `config/site.yml` garde `contact@domaine-a-definir.invalid` et la CI passe avec un avertissement. Le job de déploiement du lot 3 doit définir `RTP_DEPLOIEMENT=1` : le build (`astro build`) échoue alors si le contact finit par `.invalid`, et `check-dist` signale `CONTACT_PROVISOIRE` en erreur. Même logique pour l'hébergeur : tant que `config/hebergeur.yml` dit `statut: prevu`, le build échoue sous `RTP_DEPLOIEMENT=1`, et `check-dist` signale `HEBERGEUR_PREVU` en erreur sur un dist construit plus tôt (artefact `site-preview`, `dist-reel`) qui contient encore les phrases d'avant la mise en ligne. Même logique pour le domaine : tant que `domaine` finit par `.invalid`, le build échoue sous `RTP_DEPLOIEMENT=1` et `check-dist` signale `DOMAINE_PROVISOIRE` en erreur. Quand le domaine et le contact sont tous deux provisoires, le build s'arrête sur une seule erreur qui nomme les deux : « config/site.yml : domaine provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner une vraie adresse avant de déployer ». Sans la variable, le build passe avec un seul avertissement « config/site.yml : valeurs provisoires (.invalid), à remplacer avant le déploiement : … ». `node scripts/render-caddy.ts` refuse aussi de rendre le bloc (code 2) sous `RTP_DEPLOIEMENT=1`. `RTP_DEPLOIEMENT` n'accepte que `1` (déploiement), `0` ou une valeur vide : `true`, `yes` ou toute autre valeur font échouer le build et `check-dist` (code 2) au lieu de désactiver les gardes en silence (`src/lib/deploiement.ts`).

### Changer de domaine

Le domaine n'est écrit qu'à un seul endroit : le champ `domaine:` de `config/site.yml` (ADR-053). Le site (`site` d'Astro), les URL canoniques, `sitemap.xml`, la ligne `Sitemap:` de `robots.txt` et le bloc Caddy en dérivent.

1. Modifier `domaine:` dans `config/site.yml` (nom d'hôte seul, en minuscules, sans `https://`, sans `www.` ni port).
2. Régénérer le bloc Caddy : `fnm exec --using=24 node scripts/render-caddy.ts` (réécrit `deploy/caddy/site.caddy`). `node scripts/render-caddy.ts --check` n'écrit rien et sort en code 1 si le fichier commité n'est plus à jour.
3. `npm test` : le test de dérive (`tests/repo/caddy.test.ts`) et la garde des noms d'hôte écrits en dur (`tests/repo/hote-en-dur.test.ts`) doivent passer. Un nom d'hôte copié ailleurs que dans `config/site.yml` (sous-domaines compris) fait échouer le second.
4. Commiter `config/site.yml` et `deploy/caddy/site.caddy` ensemble.
5. Appliquer le bloc sur le serveur en Phase 8 (« Bloc Caddy » ci-dessous), puis remplacer aussi le contact `.invalid` de `config/site.yml` : la garde de déploiement refuse l'un comme l'autre.

### Modifier un script de src/scripts/

Les empreintes CSP de `src/scripts/*.js` sont calculées au chargement de `astro.config.mjs`. Après une modification de `src/scripts/*.js`, redémarrer `astro dev` (`npm run dev`) : les empreintes calculées au chargement de la configuration ne suivent pas le fichier, et le navigateur refuserait le script modifié. Relancer ensuite `node scripts/render-caddy.ts` et commiter `deploy/caddy/site.caddy` : l'en-tête CSP du bloc porte les mêmes empreintes, et le test de dérive échoue tant qu'il n'est pas régénéré. Un script reste bloquant, sans attribut, et pèse au plus 2048 octets.

### Importer les statuts data.gouv

Entrée : `data/import/` (instantanés bruts datés, `correspondances.yaml` faite à la main, attribution). Détail complet dans `data/import/README.md`.

1. `npm run import:datagouv` (ou `-- --file data/import/<instantané>.json` hors ligne, `-- --dry-run` pour le rapport seul ; `-- --url` n'accepte que des hôtes https publics, redirections revérifiées, sinon `ADRESSE_PRIVEE`) ;
2. lire le rapport : créé, statut ajouté (en place : les commentaires du fichier candidat sont conservés), inchangé, absent en amont, conflit (un fichier candidat YAML illisible est signalé `conflit` / `illisible`, sans plantage) ;
3. ouvrir une pull request avec le diff de `src/content/candidats/`, l'instantané et `ids.lock` ; `npm run validate -- --mode production` et `npm run ids -- --check` doivent passer.

Les changements de statut attendus en décembre suivent ce chemin : un statut qui change s'ajoute à la fin de `statuts[]` (historique en ajout seul, jamais de réécriture). Un conflit (id amont inconnu, date qui recule) arrête tout sans rien écrire : ajouter la personne à la main dans `correspondances.yaml`, jamais par découpage automatique du nom. Les champs `bloc`, `propositions` et `statut_detail` du jeu amont n'entrent jamais dans `src/content/`. L'attribution de la source (data.gouv.fr, licence) reste dans `data/import/`.

### Mesurer la couverture

`npm run couverture -- --candidat <id> [--theme <id>]` liste, pour un candidat, les passages de ses sources archivées qui contiennent les mots-clés de chaque thème : ce sont des pistes, chaque passage est relu avant de classer la case. Les cases (fort, partiel, silence, aucun, inaccessible) et leur note vivent dans `data/couverture-themes.yaml`. `npm run couverture -- --check-data` valide le tableau et recalcule le classement des dix thèmes et les trois thèmes pilotes.

Règle de classement : positions décroissantes, puis cases « fort », puis ordre de la spec. Un écart de 2 candidats au plus est une égalité (marge d'erreur de la mesure) : les thèmes à égalité se départagent d'abord par le thème prioritaire pour les aînés, ce qui peut différer du « top 3 littéral » (la sortie affiche les deux côte à côte). Une dérogation (`pilote.derogation`) exige une raison, un décideur et une date ; elle est `null` aujourd'hui. Après tout ajout de source ou changement de case, relancer `--check-data` et mettre à jour `docs/COUVERTURE-THEMES.md`.

### Ouvrir la relecture

`pilote.relecture_ouverte` (dans `data/couverture-themes.yaml`) vaut `false` pendant la phase 3 : toutes les mesures, les fichiers thème, les fichiers de couverture et les statuts des fiches du corpus pilote doivent rester en `brouillon`, sans relecteur, et `tests/corpus` le fait respecter (code `PILOTE_NON_BROUILLON`). Erwan passe la valeur à `true` dans le commit où il commence à marquer des fichiers `relu` ou `publie` ; ensuite seuls les schémas et les règles de la phase 2 encadrent les états de relecture. Ne jamais la remettre à `false` une fois qu'un fichier est `relu`.

### Archiver une source

`scripts/archive-source.ts` capture une URL (ou un fichier que vous avez enregistré), écrit l'extrait texte `archives/<candidat>/<sha12>.txt` et la source `src/content/sources/<id>.yaml` (sha256, instant de capture, date de consultation), range le binaire (PDF ou HTML) dans le dépôt privé `ErwanHenry/reveleTonProg-archives` et peut soumettre l'URL à l'Internet Archive. L'outil ne touche jamais `src/content/mesures`. **Jamais de binaire dans le dépôt public.**

Prérequis :
- `pdftotext` (poppler) pour les PDF : `brew install poppler` ou `sudo port install poppler` ;
- le clone du dépôt privé, voisin du projet (`../reveleTonProg-archives`) ou désigné par `RTP_ARCHIVES_DIR` (un chemin relatif se lit depuis `--root`, jamais depuis le dossier courant). Dans un worktree, exporter `RTP_ARCHIVES_DIR=/Users/erwanhenry/claude-projects/reveleTonProg-archives` ;
- Node 24 : `fnm exec --using=24 npm run archive -- …`. La racine de contenu est le dossier courant (`--root` pour en choisir un autre ; `RTP_CONTENT_ROOT` est ignorée).

Les cinq modes :

```bash
# 1. Capturer une nouvelle source (--wayback soumet l'URL, --push envoie le binaire au dépôt privé)
npm run archive -- https://exemple.fr/programme --candidat prenom-nom --source-id prenom-nom-programme \
  --type programme --auteur candidat --titre "Programme de …" --date-publication 2026-10 --wayback --push

# 2. Recapturer une source existante en ligne (même identifiant)
npm run archive -- --refresh prenom-nom-programme

# 3. Soumettre à Wayback des sources précises (une à la fois, 20 s d'écart, reprise possible)
npm run archive -- --wayback-only prenom-nom-programme

# 4. Soumettre toutes les sources encore sans wayback_url (--candidat pour restreindre)
npm run archive -- --wayback-missing --candidat prenom-nom

# 5. Pousser tout ce qui attend dans le dépôt privé
npm run archive -- --sync-private
```

`--dry-run` va jusqu'à la validation sans rien écrire. `--candidat` se répète si plusieurs candidats sont concernés (le premier nomme le dossier d'archive). `--date-publication` est obligatoire et jamais devinée : date visible sur la page, sinon date de création du PDF (`pdfinfo`), sinon l'en-tête `Last-Modified`, sinon le mois visible `AAAA-MM`.

Refus et que faire :

| Message | Cause | Que faire |
|---|---|---|
| `HTTP 403 … capture manuelle (--file)` ou « page rendue côté client … --file » | le site bloque les outils automatiques, ou le texte n'existe qu'après exécution de scripts | enregistrer la page depuis votre navigateur (PDF, ou « Page web, complète »), puis relancer avec `--file <fichier>` (l'URL reste enregistrée ; ajouter `--capture-le <ISO>` si la capture date d'avant) |
| « extrait trop court » (moins de 500 caractères) | mauvaise page, page vide ou contenu absent du HTML | vérifier l'URL ; sinon capture manuelle |
| « caractère(s) de remplacement U+FFFD » | ligature de PDF perdue ou mauvais jeu de caractères | choisir un autre passage ou un autre document ; en dernier recours `--allow-replacement-chars`, en sachant qu'une citation qui traverse ce caractère ne correspondra jamais |
| « extrait trop volumineux » (plus de 5 Mio) ou « binaire trop volumineux » (plus de 50 Mio) | document hors limites | archiver la partie utile en PDF |
| `la source … existe déjà` | l'identifiant est pris | `--refresh <id>` |
| `https`, adresse non publique, plus de 5 redirections | URL refusée par la protection SSRF | corriger l'URL |
| « reveleTonProg-archives introuvable » | pas de clone du dépôt privé | `gh repo clone ErwanHenry/reveleTonProg-archives ../reveleTonProg-archives` ou `RTP_ARCHIVES_DIR` |
| « RTP_ARCHIVES_DIR désigne le dépôt public » | `RTP_ARCHIVES_DIR` est le dépôt public, le contient, est dedans, ou partage son `origin` | cloner le dépôt privé nommé dans le message et pointer `RTP_ARCHIVES_DIR` dessus |
| « verrou ancien » | un archivage interrompu a laissé `.git/rtp-archive.lock` dans le clone privé | vérifier qu'aucun autre archivage ne tourne, puis supprimer ce dossier à la main (l'outil ne le retire jamais seul) |

Les avertissements ne bloquent pas : entités HTML non décodées (`&xxx;` brut dans l'extrait : une citation avec ce texte brut échouerait), traits d'union conditionnels, caractères de largeur nulle, lignes se terminant par `-` (rien n'est recollé automatiquement). Les PDF à deux colonnes mélangent les colonnes : choisir une citation dans un seul paragraphe et laisser `npm run validate` trancher.

Rafraîchir (`--refresh`) :
- **texte identique** : seules les dates (`capture_le`, `date_consultation`) sont rafraîchies, l'URL Wayback est conservée. Sur un site dynamique, le binaire change souvent à chaque capture (jetons, horodatages) alors que le texte ne bouge pas : l'outil le signale (« binaire modifié ») et range le nouveau binaire, c'est normal ;
- **texte modifié** : nouvel extrait (le sha12 change), `wayback_url` retiré (il montre l'ancien contenu), et l'avertissement « contenu modifié : relancer validate, les mesures citant cette source doivent être revérifiées ». L'ancien extrait reste dans `archives/` : le supprimer s'il n'est plus cité ;
- une source saisie à la main (`fichier-manuel`) est ignorée avec un avertissement ; pour la mettre à jour : `--refresh <id> --file <nouveau fichier>`.

Une page dont le pied de page publie des données personnelles de particuliers (cas de `erwan-rohou-programme-mei`) n'est ni archivée telle quelle ni soumise à Wayback : saisie manuelle expurgée avec `--file`, `wayback_url` laissé vide. `--wayback-missing` soumettrait pourtant cette page : utiliser `--wayback-only` avec la liste des autres sources.

Wayback est une corroboration, jamais un blocage : un échec (429 = plafond quotidien par URL, délai de 150 s dépassé, redirection inattendue) est un avertissement avec la commande de reprise, et `--wayback-missing` liste ce qui manque. Si Save Page Now renvoie l'instantané d'une autre adresse que celle soumise, l'outil prévient et n'enregistre rien : relancer plus tard avec `--wayback-only <id>`. Un instantané plus ancien de plus de 24 h que la capture est signalé (Wayback peut renvoyer une capture existante) : le contenu a pu changer depuis.

**Règle d'or** : `--sync-private` à la fin de chaque session. Les binaires ne sont que dans le dépôt privé ; sans push, ils disparaissent avec la machine. Le binaire est rangé dans le dépôt privé avant l'écriture des fichiers publics, et `.gitignore` exclut `archives/**/*.{pdf,html,htm,mhtml}` : seuls les extraits `.txt` vivent dans le dépôt public.

Faux positif de gitleaks sur un extrait (longue chaîne hexadécimale ou URL dans un programme) : ne jamais désactiver une règle. Créer `.gitleaks.toml` à la racine avec `[extend]` `useDefault = true` et une section `[allowlist]` dont `paths` ne liste que les fichiers exacts concernés (`archives/<candidat>/<sha12>.txt`, jamais tout `archives/`), faire relire, expliquer dans la pull request. Un vrai secret : ne pas committer l'extrait, écarter le document. Contrôle d'un lot : `gitleaks dir --no-banner --redact -v archives/` (gitleaks 8.30.1, binaire vérifié par somme de contrôle, hors du dépôt).

## Déploiement (lot 3, à venir)

GitHub Actions → `rsync -az --delete dist/ $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH`. Rollback : re-lancer le workflow sur le commit précédent.

Étapes juridiques à faire avant la mise en ligne publique :

1. Communiquer l'identité de l'éditeur à l'hébergeur (condition du II de l'article 1-1 pour ne publier que l'identité de l'hébergeur) et conserver la preuve de cet envoi.
2. Vérifier sur la facture que l'entité qui héberge le VPS est bien Hetzner Online GmbH (hypothèse A5 de la phase 5) ; sinon corriger `config/hebergeur.yml`.
3. Passer `statut: actif` dans `config/hebergeur.yml`, dans le commit de déploiement. Tant que le statut est `prevu`, un build avec `RTP_DEPLOIEMENT=1` échoue.
4. Décrire dans les Mentions légales ce que garde le journal d'accès de Caddy (champs, adresse IP entière ou tronquée, durée de conservation : 14 jours au plus avec le bloc généré, voir « Bloc Caddy (Phase 8) ») une fois sa configuration arrêtée. Avec `statut: actif`, la page dit seulement que le serveur reçoit l'adresse IP pour envoyer les pages ; elle ne dit plus que le site ne collecte aucune donnée personnelle.
5. Faire relire par un juriste les Mentions légales et l'interprétation de la CNIL sur `localStorage` (hypothèse A2 : réglages d'affichage exemptés de consentement).
6. Remplacer le domaine provisoire de `config/site.yml` (le build échoue sous `RTP_DEPLOIEMENT=1` tant qu'il finit par `.invalid`), puis régénérer le bloc Caddy (« Changer de domaine »).
7. Remplacer l'adresse de contact provisoire de `config/site.yml`.
8. Vérifier que le dépôt `ErwanHenry/reveleTonProg` est toujours public (il l'est depuis le 2026-11-04) et le garder public : les liens du site vers le dépôt (Qui sommes-nous, « Signaler une erreur (GitHub) », « Extrait archivé ») en dépendent et renverraient une erreur 404 s'il redevenait privé. Contrôle : `gh repo view ErwanHenry/reveleTonProg --json visibility` doit répondre `PUBLIC`.
9. Vérifier au premier run que `actions/upload-artifact` fonctionne avec `permissions: contents: read` (hypothèse A4).

### Bloc Caddy (Phase 8)

`deploy/caddy/site.caddy` est généré (`node scripts/render-caddy.ts`, ne pas l'éditer à la main) : bloc du domaine (`root`, `encode zstd gzip`, `file_server`, en-têtes, journal) et redirection permanente de `www.` vers le domaine. Son en-tête `Content-Security-Policy` porte les empreintes des deux scripts et `frame-ancestors 'none'` : c'est lui qui couvre le script d'ordre, placé avant la meta CSP de la page (ADR-056). Le journal d'accès tourne chaque jour à 00:00 UTC (`roll_at 00:00`, ou dès 10 Mio) et Caddy ne garde que 12 fichiers tournés (`roll_keep 12`, `roll_keep_for 288h`) plus le fichier du jour : une entrée y reste moins de 13 jours, et **14 jours au plus** si une rotation de minuit est manquée (Caddy arrêté à minuit). Adresses IP tronquées (/24 et /48), en-têtes de requête supprimés. C'est cette borne de 14 jours que reprennent les Mentions légales (étape 4 ci-dessus) ; `tests/repo/caddy.test.ts` la recalcule depuis le bloc rendu.

Hypothèses à confirmer en Phase 8 (constat de la Phase 6 : Caddy tourne dans un conteneur `caddy:2-alpine`, un seul Caddyfile monté avec une quinzaine de blocs, sans `import`, aucun dossier de site statique monté) :

- `root * /srv/reveletonprog/current` est un chemin **dans le conteneur** : monter en lecture seule le dossier des versions de l'hôte sur `/srv/reveletonprog` (versions dans `releases/<sha>/`, lien `current`), ce qui recrée le conteneur une fois.
- `output file /var/log/caddy/reveletonprog.log` est aussi dans le conteneur : monter un dossier de l'hôte **en écriture** sur `/var/log/caddy`, sinon le journal disparaît à chaque recréation. Pour un autre chemin, changer la constante `JOURNAL` de `scripts/render-caddy.ts` et régénérer.
- Coller le bloc dans le Caddyfile monté (ou ajouter une ligne `import`), puis `docker exec <conteneur> caddy validate --config <Caddyfile monté>` avant tout rechargement. À vérifier au même moment : la forme `request>headers delete`, `ip_mask 24 48` et la prise en charge de `request>client_ip` par la version de Caddy de l'image.
- `roll_at` n'existe que depuis Caddy 2.11 (rotation par timberjack) : vérifier `docker exec <conteneur> caddy version` (2.11 ou plus) et que `caddy validate` accepte `roll_at 00:00`. Si l'image est plus ancienne, la mettre à jour avant d'appliquer le bloc : avec la seule rotation à la taille, des entrées resteraient des mois.
- Après un redémarrage de Caddy, le minuteur de rotation ne repart qu'à la première requête : la sonde de supervision (Uptime Kuma) doit interroger le site au moins une fois par jour. Contrôle au bout de deux jours : `ls -l /var/log/caddy/` sur l'hôte montre des fichiers `reveletonprog-<date>-time.log.gz` datés de minuit UTC, et jamais plus de 12.
- La politique du bloc (IP tronquées, en-têtes supprimés, 14 jours) ne vaut que pour le **journal d'accès**. Le journal d'erreurs (`http.log.error`, réponses 5xx) et le journal par défaut de Caddy (TLS, ACME) vont sur la sortie d'erreur du conteneur, que le pilote Docker `json-file` garde sans limite par défaut, avec l'adresse complète et les en-têtes (User-Agent, référent). Avant d'appliquer le bloc : plafonner les journaux du conteneur (`logging: options: max-size: "10m"`, `max-file: "3"` dans le compose, ou `--log-opt max-size=10m --log-opt max-file=3`), et soit passer le journal par défaut au niveau WARN, soit faire passer `http.log.error` par le même `format filter` (bloc `log` global avec `include http.log.error`). Contrôle : `docker inspect --format '{{.HostConfig.LogConfig}}' <conteneur>` montre `max-size` et `max-file`, et `docker logs <conteneur> 2>&1 | grep -E '"remote_ip":"[0-9]+\.[0-9]+\.[0-9]+\.[1-9]'` ne trouve aucune adresse IPv4 entière (dernier octet non nul).
- Ne pas appliquer le bloc tant que le domaine finit par `.invalid`.

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure (passer en `brouillon`), tracer au journal, redéployer.

### Build CI en échec
Ouvrir l'exécution du workflow `CI`. Trois jobs tournent en parallèle :
- `verifier` : lire l'étape en rouge (`migrate`, `validate`, `ids.lock`, `check`, `test` ou `build`). Les étapes s'arrêtent à la première erreur ; la sortie de `npm run validate` nomme le fichier et la règle violée. Reproduire en local avec la même commande.
- `e2e` : tests navigateur ; télécharger l'artefact `playwright-report`, ou reproduire avec `npm run e2e` (voir « Tests navigateur (e2e) »).
- `secrets` : gitleaks a trouvé un secret dans l'historique. Ne rien pousser de plus, **révoquer le secret** chez son émetteur, puis traiter l'historique. Faux positif confirmé : ajouter une exception ciblée (motif exact, jamais un dossier entier) dans `.gitleaks.toml`.

### Droit de réponse

Cadre : article 1-1 de la loi pour la confiance dans l'économie numérique (LCEN) et son décret d'application. Procédure :

1. La demande est écrite et adressée au directeur de la publication à l'adresse de contact de `config/site.yml` (alias dédié, jamais une adresse personnelle). Elle est recevable dans un délai de trois mois à compter de la mise en ligne du contenu visé.
2. Accuser réception le jour même. La réponse est insérée au plus tard trois jours après réception de la demande, présentée comme une réponse du demandeur, et reste accessible aussi longtemps que le contenu d'origine.
3. Suivi : ouvrir une issue GitHub qui trace la date de réception, la date d'insertion et la décision, sans donnée personnelle du demandeur.
4. Une demande de rectification d'erreur factuelle suit la procédure de correction habituelle (sources, relecture), pas celle du droit de réponse.

Tant que l'adresse de contact est la valeur provisoire en `.invalid`, aucune demande ne peut être reçue : la remplacer fait partie du lot 3.

## Restauration

- Le contenu est sauvegardé par Git (dépôt GitHub distant) : cloner le dépôt suffit.
- Les binaires d'archives sont dans le dépôt privé `reveleTonProg-archives` (à cloner à côté si besoin).
- Le site se reconstruit entièrement avec `npm ci && npm run build`.

## Monitoring

Pas de service à surveiller avant l'hébergement : le monitoring (Uptime Kuma ou Healthchecks.io, alerte Telegram) démarre avec le lot 3.

## Réglages de sécurité GitHub (action utilisateur, une fois)

Ces réglages sont à faire par Erwan dans l'interface GitHub ; aucun script ni aucun plan ne les modifie par l'API.

1. Ouvrir https://github.com/ErwanHenry/reveleTonProg/settings/security_analysis (**Settings > Code security**).
2. Activer **Dependabot alerts** (obligatoire pour être alerté des vulnérabilités).
3. Optionnel : activer **Dependabot security updates** et **secret scanning push protection**.
4. Vérifier : `gh api repos/ErwanHenry/reveleTonProg/vulnerability-alerts --silent` (code de sortie 0 = activé).

Les mises à jour de versions de Dependabot n'ont besoin d'aucun réglage : `.github/dependabot.yml` sur `main` suffit (hebdomadaire, lundi 6 h Paris, cooldown de 7 jours).

## Revue mensuelle d'hygiène (15 min, notes dans RETROSPECTIVE.md)

- Mettre à jour le pin gitleaks : nouvelle version et sha256 pris dans `gitleaks_<version>_checksums.txt` (ligne `linux_x64`), à reporter dans `GITLEAKS_VERSION` et `GITLEAKS_SHA256` de `.github/workflows/ci.yml`. Dependabot ne le fait pas.
- Relire les pull requests Dependabot (cooldown de 7 jours, 14 pour les versions majeures) et le groupe `astro`.
- Revérifier les SHA des actions épinglées (un commentaire `# vX` à côté de chaque `uses:`).
- Tester une restauration (cloner le dépôt, `npm ci && npm run build`) le 1er du mois.

## Contacts

- Hébergeur VPS : Hetzner — compte Erwan
- DNS : domaine à acheter (open question)
