# Runbook — reveleTonProg

## Accès

- **VPS** : `ubuntu-4gb-nbg1-2` (Hetzner), accès SSH avec la clé d'Erwan ; clé de déploiement dans l'Environment `production` (voir « Environments GitHub »).
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
| `COUVERTURE_VERIFIEE_AVANT_SOURCE` | REGLE-08 | avertissement | Une case est datée (`verifie_le`) d'avant la consultation d'une de ses `sources_consultees` : la page afficherait « Non précisé dans les sources consultées le 3 novembre » au-dessus de « Consultée le 4 novembre ». Relecture éditoriale (jamais corrigée par script) : revérifier la case dans les sources et passer `verifie_le` à la date de cette relecture, ou corriger `date_consultation` si c'est elle qui est fausse. Voir « Relire les dates de couverture ». |
| `STATUT_PLUS_RECENT_NON_RELU` | REGLE-08 | avertissement | Le statut de candidature le plus récent d'une personne n'est pas relu, alors que la production affiche encore un statut relu plus ancien (cas typique : l'import de décembre ajoute un statut `brouillon` après un statut déjà relu). Le message nomme les deux statuts et leurs dates. Toujours un avertissement, dans tous les modes : il ne bloque ni la CI, ni un déploiement, ni `publier`, `marquer` ou `retirer`, ni un retrait d'urgence. Se règle par une relecture, jamais par un script : `npm run relecture -- marquer statut <candidat> --relecteur <nom>` (avec `--hors-perimetre` pour un retrait de candidature), avant la fusion de la pull request d'import. Voir « Import de décembre (10 au 13 décembre 2026) ». |
| `SONDAGE_NOTICE_ABSENTE` | REGLE-09 | erreur | Renseigner `url_notice` : la notice officielle de la Commission des sondages. |
| `SONDAGE_SOMME_HORS_BORNES` | REGLE-09 | erreur | La somme des scores d'une hypothèse doit tenir entre 95 et 105 : corriger les scores. |
| `SONDAGE_TOUR2_EN_TOUR1` | REGLE-09 | erreur | Une hypothèse de duel ne va pas dans un sondage de `tour: 1` : la placer dans un sondage de second tour. |
| `SONDAGE_TOUR1_EN_TOUR2` | REGLE-09 | erreur | Une hypothèse de plus de deux candidats ne va pas dans un sondage de `tour: 2`. |
| `SONDAGE_FENETRE_BLOCAGE` | REGLE-09 | erreur | Ne pas publier pendant une fenêtre de blocage légal (du samedi 00h00 au dimanche 20h00, heure de Paris, veille et jour du scrutin) : corriger la date ou différer. |
| `SONDAGE_CANDIDAT_DOUBLON` | REGLE-09 | erreur | Un même candidat apparaît deux fois dans une hypothèse : retirer le doublon. |
| `CHAMP_NON_IMPORTABLE` | REGLE-12 | erreur | Retirer la clé `bloc`, `extdroite` ou `propositions` copiée du dataset data.gouv : elles n'entrent jamais dans `src/content/`. |
| `PUBLICATION_THEME_NON_OUVERT` | REGLE-13 | erreur en production, avertissement en preview | Un thème est `publie` mais absent de `themes_ouverts` dans `config/publication.yml` : l'ajouter dans un commit dédié relu par Erwan, ou repasser le thème en brouillon. |
| `PUBLICATION_THEME_OUVERT_NON_PUBLIE` | REGLE-13 | avertissement | Un thème listé dans `themes_ouverts` n'est pas `publie` : il n'apparaît pas sur le site. Normal après un retrait d'urgence ; retirer la ligne de la liste quand le retrait est définitif. |
| `PUBLICATION_THEME_INCONNU` | REGLE-13 | erreur | `themes_ouverts` cite un identifiant qui n'est pas un thème du corpus : corriger la faute de frappe ou retirer la ligne. |
| `PUBLICATION_LISTE_INVALIDE` | REGLE-13 | erreur | `config/publication.yml` est illisible ou mal formé (une seule clé `themes_ouverts`, séquence en bloc de deux espaces, identifiants en minuscules sans doublon) : corriger selon le message, qui nomme le fichier. |
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

`npm run e2e` construit la fixture (`corpus-m1`) puis le vrai corpus en mode preview, sert chaque dossier avec `e2e/serveur.ts` (compression gzip comme Caddy) et lance Playwright. Les fichiers de `e2e/` prouvent : fonctionnement sans JS et changement de niveau (`sans-js`), parcours au clavier (`clavier`), WCAG 2.2 AA par axe (`axe` : échec sur toute violation d'impact `serious` ou `critical`, les impacts `minor` et `moderate` ne bloquent pas ; même seuil annoncé sur la page Méthode), contraste (`contraste`), texte agrandi à 160 % (`texte`), `prefers-reduced-motion` (`mouvement`), aucun tiers, cookie ni clé `localStorage` hors réglages, et aucune requête vers l'image de partage `partage.png`, qui n'est citée que par `og:image` pour les robots (`vie-privee`), et le temps de chargement à froid de la page la plus lourde sur deux connexions lentes simulées par CDP (`4g`, Chromium uniquement) : moins de 1 s avec 150 ms de latence par requête et 1,6 Mbit/s, et moins de 1 s aussi en « Slow 4G simulé », l'équivalent DevTools du « Slow 4G » de Lighthouse (562,5 ms par requête, 1,44 Mbit/s). Profils et budgets : `src/lib/profil-4g.ts`, repris tels quels par la page Méthode. Chaque mesure ouvre un contexte de navigateur neuf (cache et connexions neufs) ; le serveur local n'a ni DNS ni TLS, une mesure réelle derrière Caddy peut être plus lente.

La Phase 7 ajoute quatre fichiers. `csp` et `csp-sans-js` chargent chaque page des deux dist sous sa propre CSP et exigent zéro `securitypolicyviolation` et une console vide, avec et sans JavaScript, et que les deux scripts en ligne aient tourné. `parcours` suit le chemin accueil, Thèmes, thème, Aîné, candidat, Enfant, retour arrière, et prouve que la page revenue du bfcache affiche Enfant ; une copie du dist sans le gestionnaire `pageshow` doit échouer. `retour` fait le même chemin avec un retour arrière sans bfcache.

- `bypassCSP: true` est le défaut de `playwright.config.ts` (texte.spec injecte des styles par `page.addStyleTag`, qu'une CSP à empreintes refuse) ; seuls `csp.spec.ts` et `csp-sans-js.spec.ts` posent `bypassCSP: false`.
- Le projet `parcours` utilise `channel: 'chromium'` (nouveau mode headless) et retire l'option de lancement qui coupe le bfcache : le headless shell par défaut ne restaure jamais une page du bfcache. `npx playwright install chromium` installe ce navigateur ; la CI le fait déjà.
- Mesures 4G après l'intégration du CSS et des scripts dans la page (07-05, serveur local gzip, page la plus lourde `/themes/sante/` du vrai corpus, 180 590 octets bruts, 29 622 octets gzip) : environ 730 ms en « Slow 4G » (1257 ms avant) et environ 300 ms à 150 ms de latence (environ 420 ms avant). Les budgets publiés (1 s et 1,5 s à l'époque, 1 s pour les deux depuis 08-05) n'avaient pas changé.
- Première exécution : `npx playwright install chromium` (téléchargement du navigateur).
- Ne jamais le lancer en même temps que `npm test` (cache `.astro` partagé). Un seul jeu : `npm run e2e -- --jeu m1` ; un seul fichier : `npm run e2e -- --jeu m1 -- e2e/axe.spec.ts`.
- Le rapport HTML est écrit dans `playwright-report/` (ignoré par Git). En CI, le job `e2e` le téléverse seulement en cas d'échec (7 jours).
- Si le Mac se met en veille pendant l'exécution, des tests peuvent expirer : relancer ; la CI fait foi.

**Mesure derrière le vrai serveur (PERF-02).** Avec `E2E_BASE_URL`, `playwright.config.ts` ne lance aucun serveur local, ne garde que le projet `4g` et mesure l'hôte technique derrière Caddy, en TLS. Les identifiants `basic_auth` de la sonde (`E2E_USER` et `E2E_PASS`, les deux ou aucun) sont envoyés d'emblée dans un en-tête `Authorization: Basic` (`extraHTTPHeaders`) par chaque contexte de mesure : le chiffre ne contient aucun aller-retour d'authentification (environ 560 ms de plus sous le profil à 562,5 ms), que le site public n'aura pas, et une réponse 401 fait échouer la mesure. Un premier test compare le commit de `/version.json` servi à celui du `version.json` du dist local : le dist pesé doit être construit sur le commit servi, avec `GITHUB_SHA`. La compression acceptée est gzip, zstd ou br (Caddy choisit) ; l'encodage vu est noté dans la pièce jointe et sur la console. Le mot de passe est lu dans le fichier secret local (`~/.config/rtp/sonde-pass`, mode 0600) par un sous-shell, jamais tapé sur la ligne de commande ni gardé dans l'historique :

```bash
GITHUB_SHA=<commit servi> RTP_CONTENT_ROOT=. npm run build -- --outDir dist-mesure
( export E2E_PASS="$(cat ~/.config/rtp/sonde-pass)"
  E2E_BASE_URL=https://essai.<domaine> E2E_USER=sonde E2E_DIST=dist-mesure npx playwright test --project=4g )
```

Forme générale : `E2E_BASE_URL=https://essai.<domaine> E2E_USER=sonde E2E_PASS=… E2E_DIST=<dist du même commit> npx playwright test --project=4g`. `E2E_BASE_URL` doit être une origine `https://` seule, sans identifiants ni chemin, sinon la configuration s'arrête avec un message en français. Le rapport `playwright-report/` reste ignoré par Git.

La mesure de référence à la main se fait avec `lighthouse` (installé sur le Mac, hors des dépendances du projet ; profil mobile par défaut, Slow 4G simulé par l'outil : 150 ms d'aller-retour, 1,6 Mbit/s, processeur ralenti 4 fois), trois passages, médiane retenue. L'en-tête Basic est écrit dans un fichier 0600 d'un dossier temporaire, construit sans que le mot de passe passe sur une ligne de commande, et le dossier est effacé à la fin. Le rapport JSON de Lighthouse recopie cet en-tête (`configSettings.extraHeaders`) : le garder dans le dossier temporaire, ou retirer ce champ avant de le conserver.

```bash
umask 077; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
( B64="$(printf 'sonde:%s' "$(cat ~/.config/rtp/sonde-pass)" | base64)"
  printf '{"Authorization":"Basic %s"}\n' "$B64" > "$T/entetes.json" )
lighthouse https://essai.<domaine>/methode/ --only-categories=performance --output=json --output-path="$T/lh.json" \
  --extra-headers="$T/entetes.json" --quiet --chrome-flags="--headless=new"
jq '{fcp: .audits["first-contentful-paint"].numericValue, lcp: .audits["largest-contentful-paint"].numericValue, si: .audits["speed-index"].numericValue}' "$T/lh.json"
```

Pour lire `/version.json` avant et après la mesure sans mettre le mot de passe sur la ligne de commande : `( printf 'user = "sonde:%s"\n' "$(cat ~/.config/rtp/sonde-pass)" | curl -sS -K - https://essai.<domaine>/version.json )`.

Relevé du 2026-11-22 (09-13, site public https://reveletonprog.fr ouvert le même jour, commit servi `c383a03`, aucun identifiant envoyé ; `E2E_DIST` = copie de la version servie prise sur le serveur ; page la plus lourde en ligne `/themes/sante/`, 31 085 octets gzip, servie en zstd) : 462 / 421 / 414 ms à 150 ms de latence par requête et 855 / 841 / 849 ms, soit 855 ms au plus en « Slow 4G simulé » ; Lighthouse 13.0.3 (mobile, simulé, médiane de trois passages, lancé à la main sans en-tête) : FCP 972 ms, LCP 982 ms, Speed Index 972 ms (passages : Speed Index 1 354, 958 et 972 ms). Relevé précédent : 2026-11-09 sur l'hôte technique, page `/methode/`, 723 ms au plus. Écart : Lighthouse recalcule le chargement à partir d'une trace sans ralentissement, compte 150 ms par aller-retour, y compris l'ouverture de la connexion chiffrée, ralentit le processeur 4 fois et mesure l'affichage ; le test du site ajoute 562,5 ms par requête sans ralentir le processeur et mesure la fin de l'événement `load`. Chiffres publiés sur la page Méthode depuis `MESURE_SERVEUR_4G` (`src/lib/profil-4g.ts`) ; une nouvelle mesure remplace la constante, ce paragraphe et la phrase du README, sans changer un budget.

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
| `THEME_HORS_LISTE_BLANCHE` | page de thème dont l'identifiant n'est pas dans `themes_ouverts` de `config/publication.yml` (erreur en production) | ajouter le thème à la liste dans un commit dédié relu par Erwan, ou le repasser en brouillon |
| `THEME_OUVERT_ABSENT` | thème listé dans `themes_ouverts` sans page dans le dist (avertissement en production) | normal après un retrait d'urgence ; sinon vérifier le statut du thème |
| `PUBLICATION_VIDE` | aucune page de thème dans le dist de production (avertissement) | normal si tout est retiré ; sinon vérifier `themes_ouverts` et les statuts |
| `BROUILLON_EN_PRODUCTION` | trace de brouillon dans un build de production | vérifier `RTP_MODE` et le statut de la mesure |
| `RELECTURE_ABSENTE` | mesure publiée sans exactement une ligne « Relue par … le … » avec relecteur et date réelle (erreur en production) | renseigner `relecteur` et `date_relecture` dans le YAML de la mesure ; ne pas publier une mesure non relue |
| `RELECTURE_PERIMEE` | une mesure relue ou publiée, le statut retenu d'une personne visible ou une case de couverture d'un thème publié n'a plus le texte relu : son empreinte diffère de la dernière ligne de `relecture/journal.jsonl`, ou la cible n'y figure pas (erreur en production ; registre obligatoire pour le vrai corpus, revue de la phase 9, CR-01). `npm test` fait le même contrôle sur le vrai corpus | relire le texte actuel, puis `npm run relecture -- marquer mesure … --relecteur <nom>` (ou `marquer statut`, `marquer case`) et commiter le registre avec le YAML (voir « Corriger une mesure publiée ») ; ne jamais écrire le registre à la main |
| `CANDIDAT_NON_RELU_EN_PRODUCTION` | une personne sans aucun statut relu ou publié serait publique en production : page `candidats/<id>/`, lien vers elle ou entrée de `sitemap.xml` (erreur, D-06) | faire relire son statut avec `npm run relecture -- marquer statut <candidat> --relecteur <nom>`, ou trouver la page qui la lie encore (le message nomme l'identifiant et le fichier) ; ne jamais changer un statut pour faire passer le contrôle |
| `PREVIEW_INDEXABLE` | build preview indexable : page sans `noindex`, `robots.txt` sans `Disallow: /`, `<link rel="canonical">` dans une page, `sitemap.xml` présent ou ligne `Sitemap:` dans `robots.txt` | vérifier le mode du build (`RTP_MODE=preview`) ; la preview n'a pas d'URL publique |
| `LIEN_INTERNE_CASSE` | lien interne vers une page ou une ancre absente | corriger le lien |
| `LANG_ABSENTE` | `<html>` sans `lang="fr"` | corriger la mise en page |
| `H1_NOMBRE` | zéro ou plusieurs `h1` | un seul `h1` par page |
| `MARQUEUR_RESIDUEL` | marqueur de gabarit resté dans le HTML | corriger le rendu |
| `DIST_VIDE` | aucun HTML dans `dist/` | construire d'abord le site |
| `META_REFRESH` | `<meta http-equiv="refresh">` dans une page | retirer la redirection ; en faire une règle du serveur |
| `BASE_INTERDITE` | `<base>` dans une page | le retirer : il réécrit tous les liens relatifs |
| `CONTACT_PROVISOIRE` | lien `mailto:` vers un TLD réservé, `.invalid`, `.test`, `.example` ou `.localhost` (contact de `config/site.yml` pas encore remplacé) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : renseigner un vrai contact |
| `CSP_ABSENTE` | page sans meta CSP, avec plusieurs, ou meta hors de `<head>` (le navigateur l'ignore) | vérifier `security.csp` dans `astro.config.mjs` et la mise en page |
| `CSP_TROP_PERMISSIVE` | jeton de la CSP autre que `'self'`, `'none'` ou une empreinte sha256 (`'unsafe-inline'`, `*`, `https:`…), y compris dans une directive répétée | retirer le jeton ; ne jamais affaiblir la politique pour faire passer un script |
| `SCRIPT_SANS_EMPREINTE` | empreinte d'un script en ligne absente de la directive effective (`script-src-elem`, sinon `script-src`, sinon `default-src`) | reconstruire : les empreintes sont calculées au chargement de `astro.config.mjs` par `src/lib/csp-empreintes.ts` |
| `STYLE_SANS_EMPREINTE` | empreinte d'un `<style>` absente de la directive effective (`style-src-elem`, `style-src`, `default-src`) | reconstruire ; vérifier `security.csp` (Astro hache les styles qu'il écrit) |
| `CANONIQUE_ABSENT` | page de production sans `<link rel="canonical">` ou avec plusieurs | vérifier `Base.astro` (un seul lien, production seulement) |
| `CANONIQUE_INCORRECT` | URL canonique différente de `https://` + domaine de `config/site.yml` + chemin de la page (relative, `http:`, autre hôte, `www.`, mauvais chemin), ou URL canonique sur la page d'erreur `404.html` (qui n'en a pas et n'entre pas dans le sitemap) | reconstruire après tout changement de domaine ; ne jamais écrire l'URL à la main ; ne pas passer la page 404 par le lien canonique de `Base.astro` |
| `PARTAGE_INCORRECT` | balises de partage fausses : en production, `og:url` absent, en double ou différent de l'URL canonique (autre hôte, `essai.`, `.invalid`, `http:`, mauvais chemin) ; `og:url` ou image de partage en préversion ou sur la page d'erreur `404.html` ; image de partage relative, hors du domaine configuré ou absente du dist ; image de partage aussi chargée par la page (`img`, `srcset`, `link`, `url()`, `video poster`, `input src`, `object data`, `image` SVG ; adresse comparée sans requête ni fragment ; `partage.png` du dist couvert aussi en préversion) | ne jamais écrire l'URL à la main ; `og:url` suit la même condition que l'URL canonique dans `Base.astro` ; l'image de partage n'est citée que par `og:image` et `twitter:image` |
| `SITEMAP_INCOHERENT` | `sitemap.xml` absent en production, ou liste différente des URL canoniques des pages (manquante, en trop, en double) | reconstruire ; vérifier `src/lib/sitemap.ts` si une page a été ajoutée hors de `cheminsDuSite` |
| `ROBOTS_SANS_SITEMAP` | `robots.txt` de production absent ou sans la ligne `Sitemap: https://<domaine>/sitemap.xml` | reconstruire ; vérifier `src/pages/robots.txt.ts` |
| `DOMAINE_PROVISOIRE` | domaine de `config/site.yml` sur un TLD réservé, `.invalid`, `.test`, `.example` ou `.localhost` (un constat pour le dist), ou URL canonique vers un tel domaine | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : voir « Changer de domaine » |
| `HEBERGEUR_PREVU` | page qui porte `data-hebergeur="prevu"` (Méthode, Mentions légales : « pas encore en ligne », relecture par un juriste à venir) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : passer `statut: actif` dans `config/hebergeur.yml` et reconstruire |
| `VERSION_ABSENTE` | `version.json` absent de la racine du dist (version servie, HEB-07) | reconstruire ; vérifier `src/pages/version.json.ts` |
| `VERSION_INVALIDE` | `version.json` illisible, clés autres qu'exactement `commit` et `date`, commit autre que 40 hexadécimaux ou `dev`, date qui n'est pas un horodatage ISO UTC, commit différent de `GITHUB_SHA` (CI), ou commit `dev` quand `RTP_DEPLOIEMENT=1` | reconstruire dans le même job que le contrôle (même `GITHUB_SHA`) ; un déploiement se construit en CI, jamais depuis une build locale |
| `TYPE_FICHIER_INATTENDU` | fichier du dist autre que `.html`, `.txt`, `.xml`, `.json`, le seul `favicon.ico` à la racine (4 096 octets au plus, régénéré par `node scripts/favicon.ts` ; toute autre icône ou une icône plus lourde est refusée) et le seul `partage.png` à la racine (image de partage 1200 x 630, 100 000 octets au plus, régénérée par `node scripts/partage.ts` ; tout autre PNG, un PNG plus lourd, ou un `partage.png` qui n'est pas un PNG 1200 x 630 bien formé (signature, IHDR, morceaux jusqu'à IEND, IN-02 de la revue 09.1) est refusé) (CSS, JS, police, autres images séparés) : il demanderait une règle de cache long dans le bloc Caddy (HEB-08), que le bloc n'a plus depuis l'intégration de la Phase 7 | intégrer la ressource dans la page, ou ajouter d'abord la règle de cache au rendu Caddy (`scripts/render-caddy.ts`) puis l'extension à `check-dist` |
| `FICHIER_NON_REGULIER` | entrée du dist qui n'est ni un fichier ordinaire ni un dossier (lien symbolique, même cassé ou vers un dossier, tube, socket, périphérique) ; erreur dans tous les modes. Caddy suivrait un lien dans son propre conteneur, et la commande forcée du serveur refuse un tel envoi (code 65) | retirer le lien et copier le fichier lui-même dans le dist (revue de code WR-06) |

**Garde de déploiement (contact et domaine).** Le domaine et le contact de `config/site.yml` sont réels (le contact est celui du domaine depuis 09-04) : la garde ne les arrête plus, mais elle reste active pour tout retour à une valeur provisoire (`.invalid` et les autres TLD réservés), qui ferait passer la CI avec un avertissement. Le job de déploiement définit `RTP_DEPLOIEMENT=1` pour la cible `production` : le build (`astro build`) échoue alors si le contact finit par un TLD réservé (`.invalid`, `.test`, `.example`, `.localhost` : `estHoteProvisoire` de `src/lib/site-config.ts`, partagé avec `check-dist`), et `check-dist` signale `CONTACT_PROVISOIRE` en erreur. Même logique pour l'hébergeur : tant que `config/hebergeur.yml` dit `statut: prevu`, le build échoue sous `RTP_DEPLOIEMENT=1`, et `check-dist` signale `HEBERGEUR_PREVU` en erreur sur un dist construit plus tôt (artefact `site-preview`, `dist-reel`) qui contient encore les phrases d'avant la mise en ligne. Même logique pour le domaine : tant que `domaine` finit par l'un de ces TLD réservés, le build échoue sous `RTP_DEPLOIEMENT=1` et `check-dist` signale `DOMAINE_PROVISOIRE` en erreur. Quand le domaine et le contact sont tous deux provisoires, le build s'arrête sur une seule erreur qui nomme les deux : « config/site.yml : domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner une vraie adresse avant de déployer ». Sans la variable, le build passe avec un seul avertissement « config/site.yml : valeurs provisoires (TLD réservé), à remplacer avant le déploiement : … ». `node scripts/render-caddy.ts` refuse aussi de rendre le bloc (code 2) sous `RTP_DEPLOIEMENT=1` quand le **domaine** est provisoire ; un contact provisoire seul ne l'empêche pas, car le contact n'est pas dans le bloc (le build et `check-dist` le refusent). `RTP_DEPLOIEMENT` n'accepte que `1` (déploiement), `0` ou une valeur vide : `true`, `yes` ou toute autre valeur font échouer le build et `check-dist` (code 2) au lieu de désactiver les gardes en silence (`src/lib/deploiement.ts`).

### Changer de domaine

Le domaine n'est écrit qu'à un seul endroit : le champ `domaine:` de `config/site.yml` (ADR-053). Le site (`site` d'Astro), les URL canoniques, `sitemap.xml`, la ligne `Sitemap:` de `robots.txt` et le bloc Caddy en dérivent.

1. Modifier `domaine:` dans `config/site.yml` (nom d'hôte seul, en minuscules, sans `https://`, sans `www.` ni port).
2. Régénérer le bloc Caddy : `fnm exec --using=24 node scripts/render-caddy.ts` (réécrit `deploy/caddy/site.caddy`). `node scripts/render-caddy.ts --check` n'écrit rien et sort en code 1 si le fichier commité n'est plus à jour.
3. `npm test` : le test de dérive (`tests/repo/caddy.test.ts`) et la garde des noms d'hôte écrits en dur (`tests/repo/hote-en-dur.test.ts`) doivent passer. Un nom d'hôte copié ailleurs que dans `config/site.yml` (sous-domaines compris) fait échouer le second.
4. Commiter `config/site.yml` et `deploy/caddy/site.caddy` ensemble.
5. Appliquer le bloc sur le serveur en Phase 8 (« Bloc Caddy » ci-dessous), puis remplacer aussi le contact provisoire de `config/site.yml` : la garde de déploiement du build refuse l'un comme l'autre (le rendu du bloc ne regarde que le domaine).

### Modifier un script de src/scripts/

Les empreintes CSP de `src/scripts/*.js` sont calculées au chargement de `astro.config.mjs`. Après une modification de `src/scripts/*.js`, redémarrer `astro dev` (`npm run dev`) : les empreintes calculées au chargement de la configuration ne suivent pas le fichier, et le navigateur refuserait le script modifié. Relancer ensuite `node scripts/render-caddy.ts` et commiter `deploy/caddy/site.caddy` : l'en-tête CSP du bloc porte les mêmes empreintes, et le test de dérive échoue tant qu'il n'est pas régénéré. Un script reste bloquant, sans attribut, et pèse au plus 2048 octets.

### Importer les statuts data.gouv

Entrée : `data/import/` (instantanés bruts datés, `correspondances.yaml` faite à la main, attribution). Détail complet dans `data/import/README.md`. Toutes les commandes se lancent sous `fnm exec --using=24`, depuis la racine du dépôt.

| Commande | Effet |
|---|---|
| `npm run import:datagouv -- --dry-run` | Répétition à blanc : n'écrit rien (ni instantané, ni fiche, ni `ids.lock`). Un identifiant amont inconnu de `correspondances.yaml` est listé « à décider » au lieu d'arrêter l'outil. Code 0, sauf conflit ou fiche invalide. |
| `npm run import:datagouv -- --dry-run --format markdown` | Même répétition, mais le rapport est du Markdown sur la sortie standard (tout le reste va sur la sortie d'erreur) : c'est le corps de la pull request d'import. |
| `npm run import:datagouv -- --check` | Sans réseau : contrôle la cohérence entre l'instantané versionné, le pointeur de `data/dataset-datagouv.yaml` et les fiches candidats. C'est le même contrôle que `npm test`. Code 1 et liste des écarts s'il y en a. Refuse `--file`, `--url`, `--dry-run` et `--format`. |
| `npm run import:datagouv` | Import réel : écrit l'instantané et son `.meta.json`, les fiches (statuts en `brouillon`, sans relecteur) et `ids.lock`. S'arrête sur un identifiant inconnu, en listant tous les inconnus et sans rien écrire. |
| `npm run import:datagouv -- --accepter-absents` | Import réel d'un jeu qui a perdu plus de 20 % des identifiants de l'instantané pointé (voir « garde de volume » plus bas). Décision d'Erwan seul, après lecture du rapport ; jamais par défaut, jamais par un agent sans son accord écrit. |

Options communes : `--file data/import/<instantané>.json` (hors ligne, rejouable), `--url` (https public seulement, redirections revérifiées, sinon `ADRESSE_PRIVEE`), `--root <dossier>`. Une option inconnue affiche l'aide et sort avec le code 2.

Le rapport Markdown a toujours les mêmes sections, dans cet ordre : Instantané, Nouveaux, Nouveaux à décider (absents de `correspondances.yaml`), Absents du jeu amont, Changés, Statut déjà relu qui change, Conséquences sur les thèmes publiés, Dérives de source (information), Conflits. **Vocabulaire : « Absents du jeu amont » est la ligne que la feuille de route appelle « retirés ».** Une absence du jeu ne vaut jamais retrait de candidature : la fiche reste, son identifiant reste verrouillé. Le rapport ne contient aucune décision sur une personne : statut, motif et type de source sont décidés par le relecteur.

Un fichier YAML refusé (alias en excès, clé en double, racine qui n'est pas un objet) donne un message avec le fichier, la ligne et le code. Un conflit (id amont inconnu en mode réel, statut qui change avec une date qui recule, date au mois seulement dans le mois du dernier statut) arrête tout sans rien écrire.

**Garde de volume.** Un jeu vide est toujours refusé (code 1, rien d'écrit) : data.gouv peut servir un fichier vidé ou tronqué, et toutes les fiches passeraient alors en « absent du jeu amont ». Si plus de 20 % des identifiants de l'instantané pointé par `data/dataset-datagouv.yaml` ont disparu du nouveau jeu, l'import réel est refusé de la même façon, sauf avec `--accepter-absents`. La répétition à blanc n'est jamais refusée : la ligne « garde de volume » de l'en-tête du rapport donne le nombre d'identifiants disparus et dit si l'import réel refusera. `--check` refuse aussi un instantané pointé sans ligne.

Ce que `--check` (et donc `npm test`) range en information, jamais en écart : une source ou une date différente pour un statut inchangé, dans les deux sens, y compris une date amont qui recule (le producteur corrige une date vers le passé). La fiche garde son entrée, l'outil la dit « inchangée » et le rapport la montre sous « Dérives de source (information) » : l'outil et la CI disent la même chose. Après un import sans conflit, deux écarts seulement peuvent encore rendre la pull request rouge, chacun avec son issue : le pointeur `data/dataset-datagouv.yaml` pas mis à jour (liste de contrôle de l'import de décembre, point 1) ; une fiche dont `ids_externes.2027etmoi` n'est plus une clé de la table (clé amont renommée : Erwan met à jour `ids_externes.2027etmoi` de cette fiche dans le commit de la table). Toute autre ligne d'écart : s'arrêter et la montrer à Erwan.

Un statut qui change s'ajoute à la fin de `statuts[]` (historique en ajout seul, jamais de réécriture d'une ancienne entrée). Pour une nouvelle personne, la ligne de `correspondances.yaml` est écrite soit par Erwan (`npm run veille -- decider`), soit par l'automate de mise à jour autonome des statuts selon des règles fixes (D-02 du 2026-11-26, section « Mise à jour autonome des statuts ») ; jamais par un agent interactif. Les champs `bloc`, `propositions` et `statut_detail` du jeu amont n'entrent jamais dans `src/content/`. L'attribution de la source (data.gouv.fr, licence) reste dans `data/import/`. Les changements de décembre suivent la procédure « Import de décembre (10 au 13 décembre 2026) ».

### Import de décembre (10 au 13 décembre 2026)

À suivre à la lettre, dans l'ordre. Règles décidées par Erwan le 2026-11-13 (réponse « Tout par défaut » à sept questions) ; elles sont reprises ici telles quelles. **Aucun agent interactif n'écrit une entrée sur une personne** : prénom, nom, nom de tri, type de source, motif de renoncement, case de couverture sont décidés par Erwan, ou, depuis D-02 (2026-11-26) et la délégation du 2026-11-24, écrits par l'automate de mise à jour autonome des statuts selon des règles fixes et relus par l'agent d'IA Claude (D-03), avec une alerte à Erwan qui peut corriger après coup. Un motif de renoncement d'une personne déjà connue reste une décision d'Erwan.

**Conditions de départ.** Toutes doivent être vraies avant l'étape 1, sinon l'import ne commence pas.

1. La branche `relecture/sante` est fusionnée dans `main`, preuve par sa pull request : `gh pr list --head relecture/sante --state merged --json number --jq length` affiche 1 ou plus. Sinon, l'import est reporté (« Replis » plus bas). `git merge-base --is-ancestor origin/relecture/sante origin/main` ne sert que d'information : il répond faux après une fusion en squash ou en rebase, ou si la branche a reçu des commits après la fusion, et échoue si la branche distante a été supprimée. Jamais de fusion à la main avec la branche de relecture.
2. Le thème santé est publié dans `main`. Si l'ouverture au public a pris du retard, l'import peut commencer quand même (réponse d'Erwan), mais aucun push d'import n'a lieu pendant qu'une étape de « Ouverture publique (Phase 9) » est en cours.
3. `main` local égale `origin/main` et l'arbre est propre : `git fetch origin && git switch main && git pull --ff-only && git status --short` (rien d'affiché).
4. Aucun déploiement en attente : `gh run list --branch main --status waiting`. Pour chaque run listé, Erwan l'approuve ou le rejette lui-même dans l'interface GitHub (« Review deployments ») avant de commencer ; relancer la commande jusqu'à une liste vide. Un agent n'approuve ni ne rejette jamais un déploiement.
5. Nous sommes avant le dimanche 13 décembre 2026 à 12:00 (heure de Paris), la date limite de recréation de la branche.

**Déroulé.**

1. **Répétition du matin** sur le jeu en ligne, depuis `main` : `npm run -s import:datagouv -- --dry-run --format markdown > /tmp/rapport-matin.md` (`-s` : sans l'en-tête de npm au début du rapport), puis lire le rapport, en particulier « Nouveaux à décider » et « Absents du jeu amont » (une absence du jeu n'est pas un retrait de candidature). Vérifier aussi que la ressource n'a pas changé : `curl -s https://www.data.gouv.fr/api/1/datasets/6abf8836bbebbc5488a27e4e/ | grep -o '06237c53-76bd-4224-9805-418e125f0493'` doit afficher l'identifiant `06237c53-76bd-4224-9805-418e125f0493`. S'il n'apparaît pas, ou si l'outil répond « jeu amont invalide », s'arrêter et prévenir Erwan.
2. **Worktree et branche**, depuis le dossier du dépôt : `git worktree add -b import/statuts-2026-12 ../reveleTonProg-import origin/main`, puis `cd ../reveleTonProg-import && fnm exec --using=24 npm ci`. La commande échoue si la branche existe déjà : c'est voulu (voir « recréer la branche »). Toutes les étapes suivantes, jusqu'à l'étape 12, se font dans ce worktree ; l'arbre principal reste propre.
3. **Décisions d'Erwan**, dans le worktree d'import : pour chaque nom listé sous « Nouveaux à décider », Erwan écrit l'entrée de `../reveleTonProg-import/data/import/correspondances.yaml` (prénom, nom, `nom_tri`, `type_source_statut`, motif seulement pour un statut `renonce`), jamais dans l'arbre principal. Si une entrée manque, voir « Replis ».
4. **Premier commit, la table** : `git diff --stat data/import/correspondances.yaml` doit afficher le fichier (sinon l'édition est ailleurs : la retrouver avant d'aller plus loin ; si aucune personne n'était à décider, il n'y a pas de premier commit, passer à l'étape 5), puis `git add data/import/correspondances.yaml && git commit -m "chore(import): table de correspondances de décembre, décidée par Erwan"`.
5. **Deuxième commit, la sortie de l'outil** : `npm run import:datagouv`, puis `git status --short` (seuls `data/import/`, `src/content/candidats/` et `ids.lock` ont changé), `git add data/import src/content/candidats ids.lock` et `git commit -m "chore(import): instantané data.gouv et fiches, sortie de l'outil"`.
6. **Rapport, calculé depuis le commit parent** (la table, avant la sortie de l'outil), dans un worktree jetable ; remplacer `<instantané>` par le nom du nouveau fichier de `data/import/` :
   ```bash
   git worktree add --detach /tmp/rtp-rapport HEAD~1
   cp data/import/<instantané>.json /tmp/rtp-rapport/data/import/
   (cd /tmp/rtp-rapport && fnm exec --using=24 npm ci && fnm exec --using=24 npm run -s import:datagouv -- --dry-run --format markdown --file data/import/<instantané>.json > /tmp/rapport-import.md)
   git worktree remove --force /tmp/rtp-rapport
   ```
   `/tmp/rapport-import.md` est le corps de la pull request. Les parties écrites à la main n'ont ni tiret long ni demi-long, ni mot de `regles/mots-interdits.yaml`.
7. **Troisième commit, les mises à jour à la main**, avec la liste de contrôle ci-dessous ; les points 6 et 7 sont écrits par un agent d'IA puis revérifiés par un second agent (délégation d'Erwan du 2026-11-24, voir le point 6). Message : `chore(import): mises à jour à la main de l'import (liste de contrôle)`.
8. **Preuves en local**, toutes à zéro erreur : `npm run validate -- --mode production`, `npm run ids -- --check`, `npm run import:datagouv -- --check` (« 0 écart »), `npm run couverture -- --check-data`, `npm test`, `npm run check`, `RTP_MODE=production npm run build`, puis `RTP_MODE=production npm run check-dist`, qui doit donner autant d'avertissements que la même commande lancée sur `main` juste avant l'import (le nombre dépend des thèmes ouverts et de l'hébergeur : le noter avant l'étape 1) ; tout avertissement de plus est montré à Erwan.
9. **Push et pull request** : `git push -u origin import/statuts-2026-12`, puis `gh pr create --base main --head import/statuts-2026-12 --title "Import des statuts data.gouv de décembre 2026" --body-file /tmp/rapport-import.md`. Surveiller la CI de la pull request jusqu'au bout.
10. **Relecture d'Erwan, règle D-08.** Tout statut qui change pour une personne d'un thème publié (section « Statut déjà relu qui change » du rapport) est relu dans la pull request, avant la fusion : sur la branche d'import, `npm run relecture -- marquer statut <candidat> --relecteur <nom>` (avec `--hors-perimetre` pour un retrait de candidature), puis commit. Ainsi une seule fusion change la production. Jamais d'écriture sur l'ancienne entrée de `statuts[]` pour « repasser à relire ». L'avertissement `STATUT_PLUS_RECENT_NON_RELU` de `npm run validate` doit n'afficher personne avant la fusion ; s'il en reste un, Erwan le dit par écrit avant de fusionner. Cet avertissement ne bloque jamais rien (ni CI, ni déploiement, ni retrait d'urgence). Si `marquer` refuse une date au mois seulement, voir « Date au mois seulement » plus bas.
11. **Fusion.** Avant toute fusion, l'agent montre à Erwan la preuve que `main` n'a pas avancé pour la tête exacte de la pull request : `git fetch origin && git merge-base --is-ancestor origin/main <sha de tête> && echo vrai`, où `<sha de tête>` vient de `gh pr view <numéro> --json headRefOid --jq .headRefOid`, avec la CI de ce même sha au vert. Si la réponse n'est pas « vrai », ne pas fusionner : « recréer la branche ». La fusion est faite par Erwan dans l'interface GitHub, ou sur son accord écrit avec `gh pr merge <numéro> --merge --match-head-commit <sha de tête>`. Elle peut se faire pendant que les nouvelles personnes sont encore en `brouillon` : elles restent invisibles en production.
12. **Déploiement.** La fusion crée une demande d'approbation : Erwan l'approuve ou la rejette dans l'interface le jour même, avant le dimanche 13 décembre 2026 à 18:00. Ensuite, `gh run list --branch main --status waiting` doit être vide.

**Si `main` avance, recréer la branche.** Ne jamais fusionner `main` dans la branche d'import : recréer la branche depuis `main` et relancer l'import (mêmes octets d'instantané, même résultat). Depuis le worktree `../reveleTonProg-import`, avant le dimanche 13 décembre 2026 à 12:00 :

```bash
git fetch origin
ANCIEN=$(git rev-parse origin/import/statuts-2026-12)
git log --oneline --reverse origin/main..$ANCIEN        # noter les commits : table, sortie de l'outil, mises à jour à la main, relectures
git branch import/statuts-2026-12-ancienne $ANCIEN      # trace locale de l'ancienne branche
git switch -C import/statuts-2026-12 origin/main
git cherry-pick <sha de la table>                      # s'il y a un commit de table (étape 4)
git checkout $ANCIEN -- data/import/<instantané>.json data/import/<instantané>.meta.json
npm run import:datagouv -- --file data/import/<instantané>.json
git add data/import src/content/candidats ids.lock
git commit -m "chore(import): instantané data.gouv et fiches, sortie de l'outil"
git cherry-pick <sha des mises à jour à la main> <sha des relectures>
```

Tout conflit d'un `cherry-pick` arrête la procédure : `git cherry-pick --abort`, ne rien improviser, montrer le conflit à Erwan. Après la recréation, rejouer les preuves de l'étape 8 ; vérifier que `git log --oneline origin/main..import/statuts-2026-12 | wc -l` donne le nombre de commits noté au `git log --reverse` ; montrer `git range-diff origin/main import/statuts-2026-12-ancienne import/statuts-2026-12` à Erwan (forme à trois arguments : les commits d'import de l'ancienne branche contre ceux de la nouvelle, chacun au-dessus de `origin/main` ; chaque ligne doit apparier un ancien commit et un nouveau, une ligne avec `<` ou `>` est un commit perdu ou en trop), puis seulement avec son accord `git push --force-with-lease origin import/statuts-2026-12` (la pull request se met à jour). **Après le dimanche 13 décembre 2026 à 12:00, plus aucune recréation** : l'import attend la fin du gel (« Gel d'import (13 au 15 décembre 2026) »).

**Replis (décidés par Erwan : reporter).**

- Une nouvelle personne n'a pas d'entrée validée par Erwan à l'heure de la fusion : on **reporte l'import entier** après le gel, à partir du 16 décembre 2026. La production garde les statuts relus de novembre. Noter ici et dans la pull request que la part « import » de l'échéance du cahier des charges (15 décembre 2026) a bougé. Seule autre issue, qui est celle d'Erwan seul : écrire lui-même chaque entrée manquante, puis reprendre à l'étape 2 (nouvelle branche) ou à l'étape 7.
- La relecture santé n'est pas fusionnée le 10 décembre : on **reporte**. L'import ne commence jamais sur un `main` sans cette relecture et n'est jamais fusionné à la main avec sa branche. Il reprend après le gel, ou dès la fusion de la relecture si elle a lieu avant le 13 décembre 2026 à 12:00 et qu'Erwan le dit.
- Nouvelles personnes encore en `brouillon` au moment de la fusion : fusion permise (D-07), sous la règle D-08 de l'étape 10 pour les statuts qui changent.
- L'import réel refuse un jeu vide ou tronqué (« garde de volume », plus de 20 % des identifiants disparus) : s'arrêter et montrer le rapport à Erwan. Lui seul décide de relancer avec `--accepter-absents` (jeu confirmé sur la page data.gouv), ou de reporter ; un agent n'ajoute jamais cette option de lui-même.

**Nouvelle personne visible sur un thème publié.** Une personne importée reste invisible tant que son statut n'est pas relu. Pour la rendre visible sur un thème publié, la case de couverture existe d'abord (`src/content/couverture/<thème>.yaml`), puis `npm run relecture -- marquer statut <candidat> --relecteur <nom>` : sinon l'erreur `EQUITE_CANDIDAT_MANQUANT` bloque la production dès que le statut est relu, et `marquer` refuse en restaurant le fichier.

**Date au mois seulement.** Le jeu amont date parfois un statut au mois seulement (`AAAA-MM`). Deux cas, tous deux décidés par Erwan seul ; **aucun agent ne complète une date** sur une personne, ni n'en propose une.

- `marquer statut` refuse « un statut relu exige une date complète » pour une entrée `AAAA-MM` ajoutée par cet import. Erwan choisit : soit il complète lui-même, sur la branche d'import, la date (`date` et `source.date_publication`) de cette seule entrée ajoutée par cet import, d'après la source primaire qu'il a lue, dans le même commit que sa relecture, puis lance `marquer statut` (une date complète du même mois reste cohérente avec l'amont pour `--check`) ; soit il laisse l'entrée en `brouillon` et écrit avant la fusion qu'il accepte l'avertissement `STATUT_PLUS_RECENT_NON_RELU` (étape 10 : la production garde l'ancien statut relu) ; soit on applique « reporter ». L'ancienne entrée n'est jamais modifiée.
- L'import s'arrête sur le conflit « date amont `AAAA-MM` au mois seulement, dans le mois du dernier statut » : l'ordre des deux statuts est inconnu, l'outil ne le devine pas. Erwan choisit : soit on attend la correction amont (« reporter ») ; soit il ajoute lui-même, dans le worktree d'import et dans le commit de la table (étape 4), l'entrée en fin de `statuts[]` de la fiche, avec la date complète tirée de la source primaire qu'il a lue ; l'import relancé la voit alors comme le statut amont, « inchangé ».

**Liste de contrôle : mises à jour à la main dans la même pull request** (le jeu en ligne compte plus de lignes que le dépôt : `--check` échoue tant que le pointeur n'est pas à jour).

1. `data/dataset-datagouv.yaml` : `instantane` (nouveau chemin) ; relire la description du jeu en ligne pour `annonce` et `description_consultee_le`, sans rien supposer.
2. `data/import/ATTRIBUTION.md` : date « mises à jour le JJ/MM/AAAA ».
3. `LICENSE` (ligne 81) : la même date. Les deux sont contrôlés par `tests/corpus/fiches.test.ts`.
4. `tests/corpus/dataset-datagouv.test.ts` : plus rien à faire depuis la phase 10.1 (total, répartition par statut et `miseAJour` sont recomptés depuis l'instantané pointé).
5. `tests/dist/cas/methode.cas.ts` : plus rien à faire depuis la phase 10.1 (le titre n'annonce plus de nombre).
6. `data/couverture-themes.yaml` : une entrée par nouvelle personne du périmètre (déclarée ou primaire), avec ses 10 cellules, `acces`, `sources` et `urls_consultees` non vide (même pour `aucun_site`). Constats éditoriaux sur une personne réelle : **délégués à l'agent d'IA par Erwan le 2026-11-24** (comme la relecture des mesures depuis le 2026-11-17). Un agent les écrit d'après les sources primaires, un second agent les revérifie en lecture seule ; `verifie_par` vaut « l'agent d'IA Claude » sur un thème publié, « Claude (agent), à relire par Erwan Henry » sur un thème en brouillon. Erwan garde les décisions de la table `correspondances.yaml` (identité, motif, type de source) et les dates au mois seulement. Contrôlé par `tests/corpus/couverture-themes.test.ts` (ordre `nom_tri`).
7. `src/content/couverture/sante.yaml`, `src/content/couverture/travail.yaml` et `src/content/couverture/europe-et-monde.yaml` : une case par nouvelle personne du périmètre (`candidat`, `etat`, `verifie_le`, `verifie_par`). Délégué à l'agent d'IA, comme le point 6. Contrôlé par `tests/corpus/pilote.test.ts` (`PILOTE_CASE_MANQUANTE`) : dès l'entrée dans le périmètre pour un thème non publié ; pour un thème publié, dès que le statut est relu, comme la règle d'équité de production (la pull request d'import ne passe pas au rouge pour un statut encore en brouillon). Poser la case avant `marquer statut`, qui sinon refuse (`EQUITE_CANDIDAT_MANQUANT`).
8. `README.md` et `docs/COUVERTURE-THEMES.md` : les textes qui annoncent un compte de personnes (aucun test ne les contrôle : ne pas les oublier).

Ni `data/import/README.md` (aucun compte) ni la page Méthode (calculée depuis le pointeur) ne demandent de changement.

### Mesurer la couverture

`npm run couverture -- --candidat <id> [--theme <id>]` liste, pour un candidat, les passages de ses sources archivées qui contiennent les mots-clés de chaque thème : ce sont des pistes, chaque passage est relu avant de classer la case. Les cases (fort, partiel, silence, aucun, inaccessible) et leur note vivent dans `data/couverture-themes.yaml`. `npm run couverture -- --check-data` valide le tableau et recalcule le classement des dix thèmes et les trois thèmes pilotes.

Règle de classement : positions décroissantes, puis cases « fort », puis ordre de la spec. Un écart de 2 candidats au plus est une égalité (marge d'erreur de la mesure) : les thèmes à égalité se départagent d'abord par le thème prioritaire pour les aînés, ce qui peut différer du « top 3 littéral » (la sortie affiche les deux côte à côte). Une dérogation (`pilote.derogation`) exige une raison, un décideur et une date ; elle est `null` aujourd'hui. Après tout ajout de source ou changement de case, relancer `--check-data` et mettre à jour `docs/COUVERTURE-THEMES.md`.

### Ouvrir la relecture

`pilote.relecture_ouverte` (dans `data/couverture-themes.yaml`) vaut `true` depuis le premier commit de la phase 9 (plan 09-01). Pendant la phase 3 elle valait `false` : tout le corpus pilote devait rester en `brouillon`, sans relecteur, et `tests/corpus` le faisait respecter (code `PILOTE_NON_BROUILLON`). Depuis qu'elle est à `true`, seuls les schémas et les règles de la phase 2 encadrent les états de relecture. **Ne jamais la remettre à `false`** : un fichier `relu` ou `publie` ferait échouer `PILOTE_NON_BROUILLON`. `scripts/couverture-scan.ts` ne réécrit pas ce fichier : le scan ne peut pas la remettre à `false`. La relecture elle-même se fait avec l'outil décrit dans « Relire un thème ».

### Relire les dates de couverture

Chaque case « Non précisé » affiche « Non précisé dans les sources consultées le <`verifie_le`> », puis la date de consultation de chaque source listée. Si une source a été consultée **après** `verifie_le`, le lecteur lit une vérification faite avant la lecture de la source : `npm run validate` le signale par l'avertissement `COUVERTURE_VERIFIEE_AVANT_SOURCE` (il ne bloque pas la CI et figure dans le catalogue de la page Méthode). Correction éditoriale, jamais par script ni par recherche-remplacement : relire la case dans les sources listées, puis mettre `verifie_le` à la date de cette relecture ; ou, si c'est la date de consultation qui est fausse, la corriger d'après la capture archivée (`archive.capture_le`). Les cas ouverts au 2026-11-07 sont listés dans `.planning/phases/07-domaine-param-tr-inlining-et-dette/07-REVIEW-FIX.md` (WR-05) ; les trois du thème santé se traitent pendant la relecture (« Relire un thème »), les cinq du thème `travail` restent ouverts.

### Relire un thème

La relecture est la seule voie qui fait passer une mesure de `brouillon` à `relu` : l'outil local `npm run relecture` (ADR-059). Il écrit seulement `statut_relecture`, `relecteur` et `date_relecture` (mesure ou statut de candidat) ou `verifie_le` et `verifie_par` (case de couverture), en insérant ces lignes sans réécrire le fichier, puis il vérifie que rien d'autre n'a changé. Il n'est jamais déployé et le site ne le lit pas. **Aucun agent ne corrige le texte d'une mesure de lui-même** : une correction est une modification manuelle du YAML, faite par Erwan ou validée par lui, et la cible doit ensuite être relue de nouveau (état « à revoir », ci-dessous).

Cadre de travail : un worktree et une branche à part, pour que la relecture n'encombre pas `main`. Pousser la branche au moins une fois par séance (règle d'or : rien d'utile ne reste seulement sur le Mac plus de 24 h) et fusionner par pull request.

```bash
git worktree add -b relecture/sante ../reveleTonProg-relecture main
cd ../reveleTonProg-relecture && fnm exec --using=24 npm ci
```

Commandes, toutes sous `fnm exec --using=24` depuis ce dossier (`--root <dossier>` avant le nom de la commande pour travailler sur une copie du corpus) :

| Commande | Effet |
|---|---|
| `npm run relecture -- liste --theme sante` | ce qui reste à relire, candidat par candidat, et la ligne `reste N sur M` ; `--format json` pour une sortie lisible par un script. Une case est relue quand la dernière ligne du registre pour elle a l'empreinte de son contenu actuel, comme une mesure : `verifie_par` n'est qu'affiché, et des cases signées par deux relecteurs différents se publient ensemble |
| `npm run relecture -- servir --relecteur <nom>` | page de relecture sur `http://127.0.0.1:4327/` (thème santé par défaut ; `--theme <id>`, `--port <n>`), arrêt par Ctrl+C ; chaque « Valider » signe au nom donné, affiché en tête de page |
| `npm run relecture -- marquer mesure <candidat>/<slug> --relecteur <nom>` | passe la mesure à `relu` avec le relecteur et la date du jour (Paris) |
| `npm run relecture -- marquer statut <candidat> --relecteur <nom>` | idem pour le statut de candidature retenu |
| `npm run relecture -- marquer case <theme> <candidat> --relecteur <nom>` | pose `verifie_le` et `verifie_par` sur la case de couverture |
| `npm run relecture -- note mesure:<candidat>/<slug> "texte"` | ouvre une note de correction (cibles `statut:<candidat>` et `case:<theme>/<candidat>` aussi) ; 500 caractères au plus |
| `npm run relecture -- note --resoudre mesure:<candidat>/<slug>` | ferme la note quand la correction est faite |

Options de `marquer` : `--relecteur <nom>`, obligatoire, sans valeur par défaut (revue de la phase 9, WR-02) : c'est le nom affiché sous « Relue par … », donc celui de qui relit vraiment ; un agent d'IA donne le sien (« l'agent d'IA Claude »), jamais celui d'Erwan Henry sans son geste à lui. Même règle pour `servir`, `publier` et `retirer`, qui répondent code 2 sans lui. Puis `--date AAAA-MM-JJ` (défaut : aujourd'hui, heure de Paris), `--malgre-note`, `--hors-perimetre`. `marquer` refuse, sans rien écrire, dans ces cas : cible inconnue, fichier invalide, note ouverte sur la cible (sauf `--malgre-note`), statut hors du périmètre d'équité (sauf `--hors-perimetre`, voir « Publier un thème »), date de statut incomplète, mesure ou statut déjà `publie` et inchangé depuis sa relecture. Si la validation de production trouve une erreur nouvelle après l'écriture, il remet les octets d'origine.

La page `servir` écoute sur la boucle locale seulement, exige un jeton propre à chaque lancement pour toute écriture et refuse un autre hôte ou une autre origine. Pour chaque candidat, elle montre les quatre rédactions à côté du `texte_source` et de l'extrait archivé autour de la citation, la source avec ses dates et son empreinte, les alertes de la CI, le statut de candidature et la case de couverture avec ses dates ; les formulaires « Valider » et « Note » appellent le même code que le terminal. Elle relit le corpus à chaque requête : une correction faite à la main dans le YAML apparaît au rechargement.

Un test navigateur garde cette page : `e2e/relecture.spec.ts` (config `playwright.relecture.config.ts`, lancé à la fin de `npm run e2e`, sans dist) pilote la vraie page dans Chromium sur une copie temporaire du corpus fictif, clique « Valider » et « Ajouter la note », puis vérifie le YAML, les registres et le refus 409 sur note ouverte. Il protège contre ce que seul un vrai navigateur fait : le 2026-11-11, la `Referrer-Policy: no-referrer` faisait envoyer `Origin: null` sur le formulaire et chaque clic était refusé en 403, ce que les tests à en-têtes fabriqués ne voyaient pas. Lancement seul : `fnm exec --using=24 npx playwright test -c playwright.relecture.config.ts`.

Le registre `relecture/journal.jsonl` garde, à chaque écriture de l'outil, l'empreinte sha256 du texte relu ; `relecture/notes.jsonl` garde les notes. Les deux fichiers sont en ajout seul et publics (le dépôt est public) : aucune donnée personnelle dans une note. Quand le texte d'une cible change après sa relecture, `liste` l'affiche « à revoir (modifié depuis la relecture) » (état `a_revoir` dans la sortie JSON) et `publier` refuse : refaire `marquer` après avoir relu la correction.

**Corriger une mesure publiée.** Une correction de texte sur une cible déjà relue ou publiée (mesure, statut retenu, case d'un thème publié) bloque la CI et tout déploiement tant qu'elle n'est pas relue : `check-dist` donne `RELECTURE_PERIMEE` et `npm test` échoue (`tests/repo/relecture-empreintes.test.ts`), parce que la ligne « Relue par … le … » ne doit jamais rester sous un texte que personne n'a relu. Conduite à tenir, dans le même commit : corriger le YAML (règles de correction ci-dessus), relire la correction contre la source, puis `npm run relecture -- marquer mesure <candidat>/<slug> --relecteur <nom>` (ou `marquer statut`, `marquer case`). Pour une mesure ou un statut déjà `publie`, `marquer` garde `publie` et ne change que le relecteur et la date ; la mesure reste en ligne. Pour retirer la mesure du site le temps de la corriger, prendre plutôt `retirer` (« Retrait d'urgence d'une mesure »), puis `marquer` et `publier`.

**Dates de couverture.** Trois cas du thème santé sont à traiter pendant la relecture de leur case, jamais par recherche-remplacement : `clara-egger`, `benoit-mathieu` et `manolo-mlekuz` ont `verifie_le: 2026-11-03` alors que leur source a été consultée le 2026-11-04 (avertissement `COUVERTURE_VERIFIEE_AVANT_SOURCE`, fichier `src/content/couverture/sante.yaml`). Relire la case dans les sources listées, puis `marquer case sante <candidat>` : `verifie_le` prend la date de cette relecture et l'avertissement disparaît. Cinq cas du thème `travail` restent ouverts tant que ce thème n'est pas relu (D-06) : `clara-egger`, `benoit-mathieu`, `antoine-mikolajczak`, `manolo-mlekuz` et `natacha-polony`. Ce sont des avertissements : ils ne bloquent ni la CI ni le déploiement.

**Périmètre de l'ouverture.** Seuls les 37 statuts « déclaré » du thème santé sont relus (121 cibles : 47 mesures, 37 statuts, 37 cases de couverture). Les 22 personnes « ne se présente pas » ou « pressenti » ne sont pas relues et restent absentes de la production (voir « Publier un thème »).

### Publier un thème

Une mesure passe en deux temps : `relu` (par Erwan, cible par cible, « Relire un thème »), puis `publie` pour le thème entier, quand tout son périmètre est relu (ADR-059). Un thème n'est visible en production que s'il est `publie` **et** listé dans `config/publication.yml` (ADR-060).

1. **Ouvrir le thème dans la liste blanche.** Ajouter son identifiant sous `themes_ouverts` de `config/publication.yml` (séquence en bloc, éléments indentés de deux espaces sous la clé), dans un commit dédié relu par Erwan : c'est une décision éditoriale, que l'outil ne prend jamais. `publier` refuse tant que le thème n'y est pas (« thème absent de config/publication.yml »).
2. **Vérifier qu'il ne reste rien à relire** : `npm run relecture -- liste --theme <id>` doit afficher `reste 0`, sans note ouverte ni cible « à revoir ».
3. **Essai à blanc puis publication** :

```bash
npm run relecture -- publier --theme <id> --relecteur <nom> --dry-run
npm run relecture -- publier --theme <id> --relecteur <nom>
```

   Options : `--relecteur <nom>` (obligatoire), `--date AAAA-MM-JJ` et `--case-mesures <candidat,…>`. Cette dernière sert quand une personne publie sa première mesure sur le thème alors que sa case dit « programme non publié » ou « non précisé » (thème déjà publié compris, sans le retirer) : la case passe à `mesures`, avec `verifie_le` et `verifie_par` du relecteur, dans la même opération. Sans l'option, la commande refuse en nommant la case ; c'est un choix explicite, comme `--case` de `retirer`. La commande passe les mesures `relu` du thème et le thème lui-même à `publie` en une seule opération tout ou rien : elle valide tout le corpus en mode production et remet les octets d'origine si une erreur apparaît. Elle **ne marque jamais rien `relu`**. Elle refuse, en listant toutes les raisons ensemble et sans rien écrire : thème absent de la liste blanche, mesure pas encore relue ou « à revoir », note ouverte, statut ou case de couverture pas encore relus, mesure d'un candidat hors du périmètre d'équité, erreur de validation du thème, alerte `ARCHIVE_WAYBACK_ABSENTE` (source sans copie Wayback ni exception motivée, voir « Archiver une source »). Un second passage répond « déjà publié ». `--dry-run` applique le même lot à une copie temporaire du corpus et y refait la validation de production : il annonce le même refus que la vraie commande, sans rien écrire.
4. **Pull request.** Vérifier en local que `npm run validate -- --mode production` donne zéro erreur ; la CI refait la validation, la build et `check-dist`. Un build local de déploiement se fait avec `RTP_DEPLOIEMENT=1 RTP_MODE=production GITHUB_SHA=$(git rev-parse HEAD) npm run build`, puis `npm run check-dist` : tant que `config/hebergeur.yml` est `prevu`, il échoue, c'est la garde de déploiement.
5. **Déploiement.** Après la fusion, le run de `main` attend l'approbation d'Erwan (bouton « Review deployments », voir « Déploiement »).

Codes qui bloquent une publication mal préparée : `PUBLICATION_THEME_NON_OUVERT` (thème `publie` mais absent de la liste : erreur en production), `THEME_HORS_LISTE_BLANCHE` et `THEME_OUVERT_ABSENT` côté `check-dist`, `RELECTURE_ABSENTE` (mesure publiée sans sa ligne de relecture). Leurs lignes sont dans les tables « Codes du validateur » et « Contrôle post-build (check-dist) ».

**Ligne du relecteur.** Chaque mesure publiée affiche, à tous les niveaux de lecture et sans JavaScript, « Relue par <relecteur> le <date>. » (valeurs du YAML de la mesure). `check-dist` refuse un build de production où cette ligne manque ou est invalide (`RELECTURE_ABSENTE`).

**Personnes sans statut relu (décision D-06, « 2a »).** En production, une personne du jeu de données qui n'a aucun statut de candidature `relu` ou `publie` est absente : ni page `candidats/<id>/`, ni ligne sur `/candidats/`, ni entrée de `sitemap.xml`, ni lien, ni nom sur une page thème. La page Candidats et la page Méthode disent combien de personnes attendent la relecture de leur statut. `check-dist` refuse un dist qui en exposerait une (`CANDIDAT_NON_RELU_EN_PRODUCTION`). Une personne apparaît dès que son statut est relu : `npm run relecture -- marquer statut <candidat> --relecteur <nom>` (avec `--hors-perimetre` pour un statut « ne se présente pas » ou « pressenti », hors du périmètre d'équité). La définition est celle de l'ADR-041 : la production ne compte que les statuts `relu` et `publie`, la prévisualisation montre tout le monde avec ses pastilles de brouillon.

### Archiver une source

`scripts/archive-source.ts` capture une URL (ou un fichier que vous avez enregistré), écrit l'extrait texte `archives/<candidat>/<sha12>.txt` et la source `src/content/sources/<id>.yaml` (sha256, instant de capture, date de consultation), range le binaire (PDF ou HTML) dans le dépôt privé `ErwanHenry/reveleTonProg-archives` et peut soumettre l'URL à l'Internet Archive. L'outil ne touche jamais `src/content/mesures`. **Jamais de binaire dans le dépôt public.**

Prérequis :
- `pdftotext` (poppler) pour les PDF : `brew install poppler` ou `sudo port install poppler` ;
- le clone du dépôt privé, voisin du projet (`../reveleTonProg-archives`) ou désigné par `RTP_ARCHIVES_DIR` (un chemin relatif se lit depuis `--root`, jamais depuis le dossier courant). Dans un worktree, exporter `RTP_ARCHIVES_DIR=/Users/erwanhenry/claude-projects/reveleTonProg-archives` ;
- Node 24 : `fnm exec --using=24 npm run archive -- …`. La racine de contenu est le dossier courant (`--root` pour en choisir un autre ; `RTP_CONTENT_ROOT` est ignorée).

Les six modes :

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

# 6. Adopter un instantané Wayback déjà existant (lecture seule de web.archive.org, rien n'est soumis)
npm run archive -- --wayback-adopter <id-source> --instantane <AAAAMMJJhhmmss> [--nouvelle-url https://…] [--dry-run]
```

`--dry-run` va jusqu'à la validation sans rien écrire (pour le mode 6 : lecture de l'instantané et comparaison, sans rien changer). `--candidat` se répète si plusieurs candidats sont concernés (le premier nomme le dossier d'archive). `--date-publication` est obligatoire et jamais devinée : date visible sur la page, sinon date de création du PDF (`pdfinfo`), sinon l'en-tête `Last-Modified`, sinon le mois visible `AAAA-MM`.

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

Une page dont le pied de page publie des données personnelles de particuliers (cas de `erwan-rohou-programme-mei` jusqu'au 2026-11-17) n'est ni archivée telle quelle ni soumise à Wayback : saisie manuelle expurgée avec `--file`, `wayback_url` absent, remplacé par une exception motivée (ci-dessous). Une source qui porte `archive.wayback_exception` n'est jamais soumise ni adoptée par l'outil, y compris par `--wayback-missing`.

**Adopter un instantané existant (mode 6, ADR-061).** Quand l'adresse d'une page a changé (l'ancienne répond 404) mais qu'un instantané Wayback de la nouvelle adresse existe, `--wayback-adopter <id> --instantane <horodatage> [--nouvelle-url <url>]` lit l'instantané (14 chiffres, repris de son adresse web.archive.org) et ne l'adopte que si **chaque paragraphe** de l'extrait archivé s'y retrouve (trouvé : 30 sur 30, 29 sur 29 et 39 sur 39 pour les trois sources de Delphine Batho en 09-03). Il avertit d'un écart de plus de 24 h entre la capture du dépôt et l'instantané. `--nouvelle-url` corrige aussi le champ `url` de la source ; l'extrait, son sha256 et les dates ne changent pas. Montrer le diff à Erwan avant d'écrire dans `src/content/sources/`.

**Exception Wayback motivée.** Une source citée par une mesure publiée exige `archive.wayback_url` ou le champ `archive.wayback_exception` (`motif`, `decide_par`, `decide_le`), exclusifs l'un de l'autre ; sinon `ARCHIVE_WAYBACK_ABSENTE`. La décision revient à Erwan seul : `decide_par` et `decide_le` portent son nom et la date. La liste des exceptions du corpus réel est épinglée par `tests/rules/sources-wayback.test.ts` (liste vide depuis le 2026-11-17 ; avant cette date `erwan-rohou-programme-mei`, motif : la page affichait des données personnelles de particuliers. Le site du mouvement a été refait, l'ancienne adresse répond 404, la nouvelle page n'affiche plus ces données : Erwan a autorisé sa soumission à Wayback le 2026-11-17, la source a été recapturée avec `--refresh <id> --file` et l'exception retirée) : ajouter une exception fait échouer ce test tant qu'elle n'est pas ajoutée à la liste, dans une pull request relue. Le motif n'est affiché sur aucune page. Sources Batho (PUB-04) : les trois (priorités 1, 2 et 4) ont leur nouvelle adresse et leur instantané adopté, aucune n'est ouverte ; deux points restent à décider par Erwan, le champ `source_localisation` des deux mesures santé de Delphine Batho (il dit encore « page de la priorité 1 La pleine santé ») et trois lignes de « sources consultées » de `data/couverture-themes.yaml` qui citent les anciennes adresses.

**Source commentée.** `--wayback-only` et `--wayback-adopter` réécrivent le fichier de la source en entier, ce qui effacerait ses commentaires YAML (par exemple celui qui explique la `date_publication` par défaut d'une page non datée). Si le fichier en contient, ils ne l'écrivent pas : `--wayback-only` garde la soumission et affiche la ligne `wayback_url` à ajouter à la main sous `archive` ; `--wayback-adopter` refuse (code 1) après avoir vérifié l'instantané et affiche les valeurs à ajouter à la main.

**Site qui refuse l'outil.** Le site de Delphine Batho répond HTTP 403 à l'agent utilisateur de l'outil d'archivage alors qu'un navigateur reçoit 200. L'adoption n'est pas touchée (elle ne lit que web.archive.org), mais un futur `--refresh` de ces sources demandera `--file` avec une page enregistrée depuis le navigateur.

Wayback est une corroboration, jamais un blocage : un échec (429 = plafond quotidien par URL, délai de 150 s dépassé, redirection inattendue) est un avertissement avec la commande de reprise, et `--wayback-missing` liste ce qui manque. Si Save Page Now renvoie l'instantané d'une autre adresse que celle soumise, l'outil prévient et n'enregistre rien : relancer plus tard avec `--wayback-only <id>`. Un instantané plus ancien de plus de 24 h que la capture est signalé (Wayback peut renvoyer une capture existante) : le contenu a pu changer depuis.

**Règle d'or** : `--sync-private` à la fin de chaque session. Les binaires ne sont que dans le dépôt privé ; sans push, ils disparaissent avec la machine. Le binaire est rangé dans le dépôt privé avant l'écriture des fichiers publics, et `.gitignore` exclut `archives/**/*.{pdf,html,htm,mhtml}` : seuls les extraits `.txt` vivent dans le dépôt public.

Faux positif de gitleaks sur un extrait (longue chaîne hexadécimale ou URL dans un programme) : ne jamais désactiver une règle. Créer `.gitleaks.toml` à la racine avec `[extend]` `useDefault = true` et une section `[allowlist]` dont `paths` ne liste que les fichiers exacts concernés (`archives/<candidat>/<sha12>.txt`, jamais tout `archives/`), faire relire, expliquer dans la pull request. Un vrai secret : ne pas committer l'extrait, écarter le document. Contrôle d'un lot : `gitleaks dir --no-banner --redact -v archives/` (gitleaks 8.30.1, binaire vérifié par somme de contrôle, hors du dépôt).

## Déploiement

Depuis le Mac, sans GitHub Actions : voir « CI et déploiement depuis le Mac » (`npm run ci:local`, `npm run deploy:local`).

La chaîne de livraison (Phase 8, ADR-054 et ADR-055) part d'un push sur `main` et finit par un test de fumée HTTPS. Elle dort tant que la variable de dépôt `DEPLOY_CIBLE` n'existe pas : les jobs `gel` et `deploy` de `.github/workflows/ci.yml` sont alors sautés et la CI reste verte.

1. Push sur `main` : les jobs `verifier`, `e2e` et `secrets` tournent comme pour toute modification. En parallèle, le job `changements` (sans secret ni Environment) classe les fichiers changés entre `github.event.before` et le commit du push avec `ops/site-touche.sh` et sort `site=true` ou `site=false`.
2. Job `gel` (sur `main`, `DEPLOY_CIBLE` posée, et seulement pour un push qui touche le site ou un lancement à la main avec `deployer` ou `retrait_urgence` coché) : `node scripts/garde-gel.ts` lit la date de Paris. Pendant un gel, `deploy` est sauté (voir « Gel des scrutins et retrait d'urgence »).
3. Job `deploy` (`needs` sur `verifier`, `e2e`, `secrets`, `changements`, `gel` et `construire`, même condition que `gel`, Environment `production`) : il attend l'approbation d'Erwan, bouton « Review deployments » de la page du run.
4. Après l'approbation, la garde de gel est rejouée en première étape (`node scripts/garde-gel.ts`, mêmes entrées) : un run approuvé pendant un gel est refusé, même s'il avait passé le job `gel` avant le gel, sauf retrait d'urgence justifié (revue de code CR-02). Puis contrôle de la cible (`essai` ou `production`) et de la tête de `main` (`git ls-remote`). Commit du run encore en tête : le déploiement continue. Sinon le job récupère la tête et ne l'admet que si elle descend du commit du run (`git merge-base --is-ancestor`) et ne change que des chemins hors site (même classement que `changements`) : le journal dit alors « tête plus récente sans changement du site : déploiement autorisé » et le site déployé est bien celui de la tête. Si `main` a avancé avec des changements du site, ou si l'historique a été réécrit, l'approbation est périmée, rien n'est déployé, le run du dernier commit qui change le site déploiera.
5. La build du corpus réel est faite avant l'approbation par le job `construire`, depuis le commit du run, sans secret ni Environment (`npm ci --ignore-scripts`, build, `check-dist` en mode production : le commit de `version.json` doit être celui du run). Il publie `dist/` comme artefact `site-deploiement-<tentative>` (30 jours, durée maximale d'attente d'une approbation) avec l'empreinte de l'arbre et la cible de la build. Après l'approbation, `deploy` télécharge cet artefact (jamais la build preview) et vérifie l'empreinte, l'absence de lien ou de fichier spécial, le commit de `version.json` et que la cible de la build est encore `DEPLOY_CIBLE` (une build faite pour `essai` ne part jamais en production). `deploy`, seul job qui reçoit la clé SSH, n'exécute ni npm ni code de dépendance (revue de code WR-04). Cible `essai` : build construite sans `RTP_DEPLOIEMENT` (valeur `0`), car le domaine, le contact et l'hébergeur restent provisoires sur cet hôte privé. Cible `production` : toujours `RTP_DEPLOIEMENT=1`, donc toutes les gardes de déploiement public.
6. Envoi : `rsync -rt --chmod=D755,F644 --stats` (sans `-l` : aucun lien symbolique envoyé) vers `<cible>/<sha>/`, que la commande forcée du serveur range dans `/srv/reveletonprog/incoming/<cible>/<sha>/` (jamais de suppression, jamais l'arbre servi). Clé : secret `DEPLOY_SSH_KEY` ; empreinte du serveur épinglée par `DEPLOY_KNOWN_HOSTS` (`StrictHostKeyChecking=yes`, aucun scan de clé d'hôte).
7. `activer <cible> <sha>` : la commande forcée vérifie l'envoi (`index.html`, commit de `version.json`), le range dans `releases/<sha>/`, bascule le lien relatif `current` de façon atomique (`ln -s` puis `mv -T`) et garde les 5 dernières versions (plus la courante et la précédente). L'étape suivante exige que `etat <cible>` réponde `courant=<sha>`.
8. Test de fumée HTTPS sur `DEPLOY_URL`, avec les identifiants de la sonde passés par `curl --config -` : `/version.json` sert le commit du run, la page d'accueil envoie `Strict-Transport-Security` et `Content-Security-Policy`. `DEPLOY_URL` vide : test sauté, `etat` fait foi.
9. Juste avant `activer`, le job note la version en ligne (`etat <cible>`, `COURANT_AVANT`). Si une étape échoue après l'activation, ou si le run est annulé ou dépasse son délai de 15 min après elle, il lance `retour <cible> <COURANT_AVANT>` puis contrôle `etat` : la version exacte qui était en ligne avant ce run revient, jamais une plus ancienne. Il ne rebascule rien si ce run n'a pas changé `current` (commit déjà en ligne, relance), ni s'il n'y avait aucune version avant (premier déploiement), ni pour un retrait d'urgence (le contenu retiré ne doit pas revenir : vérifier à la main, puis `rollback.yml` avec une version explicite si besoin). Le run reste rouge ; lire l'étape en échec avant de relancer.

**Un push de documentation seule ne déploie pas.** Les chemins hors site sont définis une seule fois, dans la variable `CHEMINS_HORS_SITE` de l'`env` de `.github/workflows/ci.yml` : `.planning/`, `docs/`, `tests/`, `e2e/`, `audit/`, `ops/`, `deploy/`, `.github/`, `README.md`, `LICENSE`, les `*.md` de la racine et `.editorconfig`. `.gitattributes` compte comme le site : ses règles de fin de ligne, d'encodage ou de filtre changent les octets extraits de `src/` (revue de code IN-04). Un push qui ne touche qu'eux saute `gel` et `deploy` : aucune demande d'approbation, la CI reste verte, et les commits de planification n'ont plus besoin de `[skip ci]`. Tout autre chemin (`src/`, `content/`, `config/`, `scripts/`, `public/`, `package.json`, etc.) compte comme un changement du site ; un renommage compte des deux côtés. Par prudence, `site=true` quand le commit de base manque, vaut 40 zéros ou n'est pas un ancêtre (création de branche, push forcé). Essai sur le Mac : `git diff --no-renames --name-only -z <avant> <après> | CHEMINS_HORS_SITE='...' bash ops/site-touche.sh`.

Forcer un déploiement de la tête de `main` (sans nouveau commit, ou après un push de documentation seule) : `gh workflow run ci.yml --ref main -f deployer=true` (même approbation). Sans `-f deployer=true`, un lancement à la main relance seulement les vérifications.

**Un run attend l'approbation : approuver ou rejeter tout de suite, ne jamais le laisser en attente.** Le job attend dans le groupe de concurrence `deploy-production` : un run oublié bloque les déploiements suivants (GitHub ne garde qu'un job en attente par groupe, le plus récent remplace l'autre), et une approbation tardive est refusée dès que `main` a avancé avec des changements du site ou pendant un gel. Les retours arrière ont leur propre groupe (`retour-production`) : un déploiement en attente ne les bloque plus et ne peut pas les annuler. Rejeter un run ne touche pas au serveur.

Étapes juridiques avant la mise en ligne publique (état au 2026-11-11, plan qui porte chaque étape) :

1. **Fait** (09-08) : l'identité de l'éditeur est transmise à l'hébergeur (condition du II de l'article 1-1 pour ne publier que l'identité de l'hébergeur) ; déclaré par Erwan le 2026-11-10, la preuve est conservée hors du dépôt.
2. **Fait** (09-08) : l'entité qui facture le VPS est bien celle de `config/hebergeur.yml` (Hetzner Online GmbH, hypothèse A5 de la phase 5).
3. **À faire** (09-11) : passer `statut: actif` dans `config/hebergeur.yml`. Tant que le statut est `prevu`, un build avec `RTP_DEPLOIEMENT=1` échoue, et les phrases d'identité et de sortie d'erreur des Mentions légales ne s'affichent pas.
4. **Fait** (09-04) : les Mentions légales décrivent le journal d'accès de Caddy (14 jours au plus, adresse IP tronquée, voir « Bloc Caddy (Phase 8) ») et la sortie d'erreur du conteneur (adresse entière, plafonnée en taille, pas en durée), avec la sentence RGPD ; ces phrases ne s'affichent qu'avec `statut: actif`.
5. **Remplacé** (09-08) : la relecture par un juriste avant l'ouverture est remplacée par la note de risques signée par Erwan le 2026-11-11 (`docs/RISQUES-JURIDIQUES.md`, mention « risque accepté », décision D-03) ; une relecture par un juriste est prévue après l'ouverture, en commençant par le régime d'éditeur (R1) et la lecture de la CNIL sur `localStorage` (hypothèse A2).
6. **Fait** : le domaine de `config/site.yml` est le domaine réel ; le bloc Caddy est rendu depuis lui (« Changer de domaine »).
7. **Fait** (09-04 pour l'adresse, 09-08 pour le test de bout en bout du 2026-11-10) : le contact de `config/site.yml` est celui du domaine.
8. **À faire** le jour de l'ouverture (09-12) : vérifier que le dépôt `ErwanHenry/reveleTonProg` est toujours public et le garder public : les liens du site vers le dépôt (Qui sommes-nous, « Signaler une erreur (GitHub) », « Extrait archivé ») renverraient une erreur 404 s'il redevenait privé. Contrôle : `gh repo view ErwanHenry/reveleTonProg --json visibility` doit répondre `PUBLIC`.
9. **Sans objet** : l'hypothèse A4 est confirmée, `actions/upload-artifact` fonctionne avec `permissions: contents: read` (artefact `site-preview` publié à chaque run de `main`) ; rien à faire au premier déploiement.

### Retour arrière

Depuis le Mac : `npm run deploy:local -- retour [<sha>]`, voir « CI et déploiement depuis le Mac ».

Workflow `.github/workflows/rollback.yml` (« Retour arrière »), lancé à la main sur `main`, approuvé par Erwan dans l'Environment `production`, arrêté au bout de 5 min :

```bash
gh workflow run rollback.yml -f cible=essai
gh workflow run rollback.yml -f cible=essai -f version=<sha>
gh run list --workflow rollback.yml --limit 1
gh run watch <id> --exit-status
```

- Sans `version` : le verbe `retour` remet la version précédente de l'historique (`.historique`). Un second retour remet la version qu'on vient de quitter : deux lancements font un aller-retour.
- Avec `-f version=<sha>` (commit complet, 40 hexadécimaux) : le commit doit encore être dans `releases/` (5 versions gardées, plus la courante et la précédente), sinon la commande forcée répond code 66 et rien ne change.
- Le job lit ensuite `etat` (nouveau `courant`, égal à `version` quand elle est donnée) et, quand `cible` est la cible de `DEPLOY_URL` (`DEPLOY_CIBLE`), vérifie que `/version.json` sert ce commit. Le résumé du job donne l'heure UTC de début et de fin.
- Objectif : moins de 2 min entre le lancement et le commit servi, l'attente de l'approbation comptée à part (elle dépend de la réaction d'Erwan, pas du mécanisme). La bascule seule prend moins d'une demi-seconde : 288 ms et 329 ms en boucle locale sur le serveur, poignée de main SSH comprise (08-10). Le chronométrage de bout en bout par GitHub est noté par 08-13.
- Vérifier à la main le commit servi, mot de passe de la sonde lu dans le fichier local par `printf` (interne au shell, jamais dans la ligne de commande) : `printf 'user = "sonde:%s"\n' "$(cat ~/.config/rtp/sonde-pass)" | curl -s --config - https://essai.<domaine>/version.json`. Charger aussi une page HTML.
- Groupe de concurrence propre, `retour-production`, jamais annulé (revue de code WR-02) : un push sur `main` ne peut plus annuler un retour en attente, et un déploiement en attente ne le retarde pas. Le serveur sérialise chaque verbe `activer` et `retour` (verrou `flock -w 20`). Si un déploiement attend son approbation pendant l'incident, le **rejeter** (sinon, approuvé plus tard, il remettrait en ligne ce que le retour a retiré). Si un déploiement est en cours, le retour automatique de ce déploiement ne défait jamais un retour manuel : il ne rebascule que si `current` pointe encore le commit qu'il a activé. Deux retours lancés coup sur coup : le plus récent en attente remplace l'autre.
- La garde de gel s'applique aussi aux retours arrière (section suivante).

**Repli en cas d'incident** (GitHub indisponible, approbation impossible). L'accès root d'Erwan lance la même commande forcée sous l'utilisateur `deploy`, avec le même verrou et la même bascule atomique, sans approbation GitHub ni garde de gel :

```bash
ssh keel-vps 'SSH_ORIGINAL_COMMAND="retour essai" runuser -u deploy -- /usr/local/sbin/rtp-deploy-command'
ssh keel-vps 'SSH_ORIGINAL_COMMAND="etat essai" runuser -u deploy -- /usr/local/sbin/rtp-deploy-command'
```

`retour production` pour la cible publique, `retour essai <sha>` pour un commit précis. Aucun run GitHub ne trace ce geste : le noter ensuite à côté de l'historique des runs, dans une issue datée (heure UTC, raison, version remise). Le journal `rtp-deploy` du serveur (`journalctl -t rtp-deploy`) et le fichier `.historique` le gardent aussi.

### Gel des scrutins et retrait d'urgence

- Fenêtres : du 17 au 19 avril 2027 et du 1er au 3 mai 2027, dates civiles en heure de Paris (veille et lendemain de chaque tour, tirées de `TOURS` dans `src/lib/dates-tours.ts` : déplacer un tour déplace le gel). Le runner est en UTC ; la garde convertit.

Calendrier 2027 (vérifié avec `node scripts/garde-gel.ts --urgence '' --justification '' --date <ISO>` : autorisé le 2027-04-16 à 23:59, refusé du 2027-04-17 au 2027-04-19, autorisé le 2027-04-20, refusé du 2027-05-01 au 2027-05-03, autorisé le 2027-05-04) :

| Tour | Scrutin | Gel, heure de Paris | Dernier déploiement sûr | Déploiement de nouveau possible |
|---|---|---|---|---|
| 1 | dimanche 18 avril 2027 | du samedi 17 avril 2027 à 00:00 au lundi 19 avril 2027 à 23:59 | vendredi 16 avril 2027, approbation avant minuit | mardi 20 avril 2027 dès 00:00 |
| 2 | dimanche 2 mai 2027 | du samedi 1er mai 2027 à 00:00 au lundi 3 mai 2027 à 23:59 | vendredi 30 avril 2027, approbation avant minuit | mardi 4 mai 2027 dès 00:00 |

La garde est rejouée au moment de l'approbation : ce qui compte est l'heure de l'**approbation**, pas celle du push. Minuit à Paris est 22:00 UTC la veille en avril et en mai. Avec 7 à 9 minutes de CI mesurées, un push du vendredi soir n'a pas de marge : viser le jeudi, et ne rien laisser en attente d'approbation à l'entrée dans une fenêtre. Pendant une fenêtre, la CI passe, `deploy` est sauté, et seul un retrait d'urgence justifié peut livrer (« Retrait d'urgence d'une mesure (moins d'une heure) »).
- Pendant un gel, un push sur `main` passe la CI mais `deploy` est sauté, avec l'avertissement « déploiement refusé » dans le résumé du job `gel`. Un retour arrière est refusé de la même façon. Un run qui a passé `gel` avant le gel et attend encore l'approbation est refusé au moment de l'approbation : `deploy` rejoue la garde en première étape et échoue (« Déploiement refusé par la garde de gel au moment de l'approbation »), sans rien envoyer.
- Retrait d'urgence pendant un gel (par exemple une mesure publiée sans source) : commiter le retrait (mesure repassée en `brouillon`), pousser sur `main`, puis relancer avec la case cochée et une justification écrite d'au moins 20 caractères :

```bash
gh workflow run ci.yml --ref main -f retrait_urgence=true -f justification="Retrait de la mesure X publiée sans source"
gh workflow run rollback.yml -f cible=production -f retrait_urgence=true -f justification="Retour à la version d'hier, page cassée"
```

- La justification est nettoyée (caractères de contrôle remplacés, coupée à 300 caractères) et gardée dans le résumé du run. Le déploiement passe ensuite par la même approbation. `retrait_urgence` coché suffit à demander le déploiement : inutile d'ajouter `-f deployer=true`.
- Une case cochée sans justification valable fait échouer le job `gel` (code 1), même hors gel : jamais de passage silencieux.
- Essai à blanc sur le Mac : `node scripts/garde-gel.ts --urgence '' --justification '' --date 2027-04-18T12:00:00+02:00` (refus, avertissement, code 0).

### Gel d'import (13 au 15 décembre 2026)

Règle d'exploitation décidée par Erwan le 2026-11-13, écrite ici et tenue par son bouton d'approbation, sans garde technique.

- **Bornes (heure de Paris)** : l'import est fusionné et son déploiement approuvé au plus tard le dimanche 13 décembre 2026 à 18:00. Le gel court du dimanche 13 décembre 2026 à 18:00 au mardi 15 décembre 2026 à 23:59.
- **Interdit pendant le gel** : toute fusion dans `main` et tout déploiement. Un agent ne fusionne rien, ne pousse rien sur `main` et ne recrée pas la branche d'import (la limite de recréation est le dimanche 13 décembre 2026 à 12:00).
- **Seule exception** : un retrait d'urgence, par la voie existante (`retrait_urgence` coché et justification écrite, voir « Gel des scrutins et retrait d'urgence » et « Retrait d'urgence d'une mesure (moins d'une heure) »).
- **Run en attente** : un déploiement encore en attente d'approbation au début du gel est rejeté par Erwan dans l'interface (« Review deployments »), jamais approuvé. Vérifier avec `gh run list --branch main --status waiting` le dimanche 13 décembre 2026 à 18:00, puis la liste doit rester vide.
- **Import non terminé à 18:00** : il est reporté après le gel (à partir du 16 décembre 2026), selon « Replis » dans « Import de décembre (10 au 13 décembre 2026) ».
- **Automate** : la mise à jour autonome des statuts est retenue du 10 décembre 2026 00:00 au 15 décembre 2026 à 23:59 (section « Mise à jour autonome des statuts »), ce qui contient ce gel.
- **Fenêtres de 2027** : celles de `scripts/garde-gel.ts` (17 au 19 avril 2027 et 1er au 3 mai 2027) ne changent pas. Ce gel de décembre est une règle écrite plus le bouton d'approbation d'Erwan : la garde technique ne coupe que le job `deploy` et ne peut pas empêcher une fusion. Le test `tests/repo/docs.test.ts` fait échouer la CI si cette section disparaît ou si les fenêtres de 2027 changent.

### Hôte technique (essai)

**Retiré le 2026-11-22 à 08:45:57 UTC (plan 09-12).** Bloc `reveletonprog-essai.caddy` déplacé dans `/root/rtp-retire/` sur le serveur, Caddy validé puis rechargé ; marqueur `/opt/rtp/essai-retire` posé : l'étape `site-essai` de l'installateur répond `[ok: retiré]` (« hôte technique retiré le 2026-11-22 ») et ne réinstalle plus le bloc. Fichiers `/srv/reveletonprog/essai` et variables d'empreinte gardés pour un éventuel retour : supprimer le marqueur, remettre le bloc dans `sites.d`, valider, recharger. Le texte ci-dessous reste comme historique.

- `essai.<domaine>` est un hôte privé : bloc `deploy/caddy/essai.caddy`, généré par `node scripts/render-caddy.ts`, installé en `sites.d/reveletonprog-essai.caddy` par l'étape `site-essai` de l'installateur (refusée tant que le domaine est réservé). Racine `/srv/reveletonprog/essai/current`.
- `basic_auth` sur tous les chemins sauf `/robots.txt`, deux utilisateurs : `essai` (relecture par Erwan) et `sonde` (sonde externe, battement HTTPS, test de fumée, mesures 4G). Mots de passe en clair dans Vaultwarden, copie locale dans `~/.config/rtp/` (0600). Empreintes bcrypt dans `/opt/vaultwarden/.env` (root, 0600), passées au conteneur par `RTP_ESSAI_HASH` et `RTP_SONDE_HASH`.
- Changer un mot de passe : nouvelle empreinte bcrypt calculée hors du dépôt (jamais affichée), `ops/installer-serveur.sh --appliquer --etape env-caddy` avec la ligne `RTP_ESSAI_HASH=…` ou `RTP_SONDE_HASH=…` sur l'entrée standard, puis recréation du conteneur (procédure de la section suivante) : la variable d'un conteneur ne change qu'à sa recréation, un `caddy reload` garde l'ancienne. Pour `sonde`, mettre aussi à jour Vaultwarden, `~/.config/rtp/sonde-pass`, les secrets `DEPLOY_SMOKE_PASS` et `SONDE_PASS`, et `RTP_SONDE_PASS` dans `/etc/rtp/battement.env` (étape `battement`).
- Non indexé : `X-Robots-Tag: noindex, nofollow` sur toutes les réponses (401 compris) et `robots.txt` fermé (`Disallow: /`). L'en-tête est posé par une directive `header` à part : le sous-bloc `header` commun est différé (à cause de `-Server`) et Caddy ne l'applique pas au 401 de `basic_auth`. Pas de `handle_errors` : sur le serveur partagé, il ferait passer au niveau debug le journal des erreurs 5xx de tous les sites. Contrôle sans identifiant : `curl -sI https://essai.<domaine>/ | grep -i x-robots-tag`. Mêmes en-têtes et même journal masqué que la production.
- Construit sans `RTP_DEPLOIEMENT` (ADR-055). Retiré à l'ouverture en Phase 9 : bloc ôté de `sites.d`, `caddy reload`, sonde et test de fumée réorientés vers l'hôte public, selon la procédure ordonnée de « Ouverture publique (Phase 9) ».
- **Point de la Phase 9 (Mentions légales).** La build d'essai a l'hébergeur `prevu` : ses Mentions légales disent « aucun serveur de l'éditeur ne reçoit vos visites », alors que l'hôte d'essai est un serveur. Il est privé, protégé par mot de passe et visité seulement par Erwan et la sonde. La phrase redevient vraie quand l'hôte d'essai est retiré, et la build publique passe à `actif`.

### Ouverture publique (Phase 9)

**Site ouvert au public le 2026-11-22 à 08:43:54 UTC** (rechargement de Caddy), commit servi `c383a03`, déployé en production depuis le Mac par Erwan (`npm run deploy:local`, cible `production`, phrase « deployer en production c383a03 ») de 08:42:03 à 08:42:42 UTC. Écritures réellement faites, chacune vérifiée avant la suivante : deux runs GitHub en attente rejetés sur instruction d'Erwan ; déploiement GitHub mis en sommeil (variable `DEPLOY_CIBLE` retirée, décision D-11 de la phase 9.2) ; `~/.config/rtp/deploiement.env` passé à `RTP_CIBLE=production` (test de fumée suspendu pour le premier envoi, puis `RTP_URL` sur le domaine public sans identifiant) ; copie de `ops/` et `deploy/` ; étape `site-public` ; validations jetable et en direct, rechargement ; `DEPLOY_URL` public, secrets `DEPLOY_SMOKE_*`, `SONDE_USER` et `SONDE_PASS` supprimés, `SONDE_URL` public, sonde relancée (verte) ; battement sur l'hôte public sans identifiant ; hôte technique retiré ; sauvegarde et test de restauration (`resultat: ok`). Certificats Let's Encrypt obtenus pour le domaine nu et `www` (échéance 2027-02-20). Caddy jamais redémarré (démarré le 2026-11-09, 0 redémarrage). Les 17 autres sites identiques avant et après. Différences avec la procédure ci-dessous, écrite pour GitHub : le déploiement de l'étape 3 passe par `deploy:local`, sans approbation dans l'interface ; Erwan a choisi de ne pas relire le site sur l'hôte d'essai avant l'ouverture (« on corrigera le site s'il ne me convient pas »).

**Suites datées.** HSTS à `max-age=31536000` **pas avant le 2026-11-29** (7 jours stables ; changer la constante dans `scripts/render-caddy.ts`, régénérer, tester, installer par `site-public`, valider, recharger ; jamais `includeSubDomains` ni `preload`). Suppression de `/srv/reveletonprog/essai` pas avant le 2026-11-29. Enregistrement DNS `essai` à retirer par Erwan. IPv6 : à traiter avant tout enregistrement AAAA.

Procédure ordonnée de la mise en ligne sur le domaine public (D-09), exécutée par le plan 09-12. Règle D-01 (ADR-057) : **chaque écriture du serveur et chaque réglage GitHub est montré à Erwan (commande, effet, retour arrière) et lancé seulement après son accord explicite**, depuis la session principale ; les agents n'écrivent jamais sur le serveur ni dans les réglages. Chaque écriture est suivie de son contrôle avant la suivante ; un contrôle qui échoue arrête la suite et applique le retour arrière écrit à côté. Jamais de redémarrage ni de recréation de Caddy : valider, puis recharger. `<domaine>` est la valeur de `domaine:` dans `config/site.yml` (`D=$(awk '/^domaine:/{print $2}' config/site.yml)`).

**Préalables (lecture seule).** Le thème santé est relu et publié (« Publier un thème », `config/publication.yml` ouvre exactement `sante`) ; la note de risques est signée ; `config/hebergeur.yml` est `actif` et le contact est celui du domaine ; un build `RTP_DEPLOIEMENT=1` de la tête de `main` passe `check-dist` à zéro erreur ; `node scripts/garde-gel.ts` ne signale aucun gel ; aucun run n'attend l'approbation (`gh run list --branch main --limit 5`) ; le DNS répond : `dig +short A <domaine> @1.1.1.1` et `@9.9.9.9`, pareil pour `www.<domaine>`, adresse du serveur et **aucun enregistrement AAAA** (`dig +short AAAA`) ; le serveur est sous 85 % de disque ; l'instantané des autres sites d'avant l'ouverture est pris (`~/.config/rtp/sites-avant-ouverture.tsv`, voir « Serveur : installer et vérifier »).

**Une seule cible de livraison à la fois.** Après l'étape 2, plus rien ne se déploie vers `essai`.

| # | Écriture | Effet | Contrôle | Retour arrière |
|---|---|---|---|---|
| 1 | `gh variable delete DEPLOY_URL --env production` | le premier déploiement de production saute le test de fumée HTTPS : le bloc public n'existe pas encore, le test échouerait et déclencherait un retour arrière inutile | `gh variable list --env production` ne montre plus `DEPLOY_URL` | `gh variable set DEPLOY_URL --env production --body https://essai.<domaine>` |
| 2 | `gh variable set DEPLOY_CIBLE --body production` | la prochaine build se fait sous `RTP_DEPLOIEMENT=1` et part vers `/srv/reveletonprog` | `gh variable list` | `gh variable set DEPLOY_CIBLE --body essai` |
| 3 | `gh workflow run ci.yml --ref main -f deployer=true`, puis **Erwan approuve lui-même** dans l'interface (« Review deployments ») | `releases/<sha>` et le lien `current` existent côté production ; rien n'est encore public | le journal « Construire » montre `RTP_DEPLOIEMENT: 1` et `check-dist` à zéro erreur ; « Test de fumée » est sauté ; `ssh keel-vps 'readlink /srv/reveletonprog/current; cat /srv/reveletonprog/current/version.json'` donne le commit de la tête | en cas d'échec : retours arrière des étapes 2 puis 1 |
| 4 | `git archive --format=tar.gz HEAD ops deploy \| ssh keel-vps 'mkdir -p /opt/rtp/depot && tar -xz -C /opt/rtp/depot'` | copie de `ops/` et `deploy/` du commit sur le serveur | `ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --verifier --etape site-public </dev/null'` répond `[a faire]` pour le bloc seulement | relancer depuis le commit précédent |
| 5 | `ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape site-public </dev/null'` | écrit `/opt/vaultwarden/sites.d/reveletonprog.caddy` (nom nu et `www`) ; Caddy ne le lit qu'au rechargement ; refusé en code 7 tant que `current` n'existe pas | seules des lignes `[fait]` ou `[ok]`, code 0 | `ssh keel-vps 'mkdir -p /root/rtp-retire && mv /opt/vaultwarden/sites.d/reveletonprog.caddy /root/rtp-retire/'` |
| 6 | validation puis rechargement, dans cet ordre (lecture seule, puis écriture) | Caddy sert le domaine et `www` et demande deux certificats : **le site est public à partir d'ici** | voir ci-dessous | retour arrière de l'étape 5, puis nouvelle validation et nouveau rechargement |

Étape 6 en détail :

```bash
ssh keel-vps "RTP_BLOC_B64=$(base64 < deploy/caddy/site.caddy | tr -d '\n') RTP_AVEC_SANS_VARIABLES=1 bash -s" < ops/valider-caddy.sh
ssh keel-vps 'docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile'
ssh keel-vps 'docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'
```

Le rechargement n'est lancé que si les deux validations (conteneur jetable avec et sans variables, puis `caddy validate`) sont valides. Les certificats se demandent une fois, jamais dans une boucle de reprises : si l'un manque au bout de 5 minutes, ne pas recharger de nouveau, appliquer le retour arrière et lire le nombre de lignes d'erreur ACME (le compte seulement).

**Contrôles de l'ouverture.** Attendre jusqu'à 3 minutes que `curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/` réponde 200 (vérification du certificat par défaut) et `https://www.<domaine>/` 301, puis contrôler :

- certificats de l'apex et de `www` : `echo | openssl s_client -connect <domaine>:443 -servername <domaine> 2>/dev/null | openssl x509 -noout -issuer -enddate`, et pareil pour `www.<domaine>` ;
- redirection : `curl -sI https://www.<domaine>/themes/sante/` donne 301 et un `location` sur le domaine nu ;
- en-têtes de `/` : `Strict-Transport-Security: max-age=300`, la CSP du bloc, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, pas d'en-tête `Server`, `Cache-Control: no-cache` ; **jamais de `no-store` sur `/favicon.ico`** ni ailleurs (il casserait le retour en arrière du navigateur) ;
- `robots.txt` sans `Disallow: /` et avec sa ligne `Sitemap:`, `sitemap.xml` qui liste `/themes/sante/`, aucun `noindex` ni `X-Robots-Tag` ;
- `/version.json` : le commit de la tête de `main` ; `/favicon.ico` 200 ;
- `/themes/` ne liste que le thème ouvert, un thème non ouvert répond 404 ; `/candidats/` ne liste que les personnes au statut relu ; `/mentions-legales/` porte la phrase d'identité de l'hébergeur et le vrai contact ;
- adresse inconnue : `curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/nexistepas/` répond 404 et `curl -s https://<domaine>/nexistepas/` contient « Page introuvable » ; revalidation de la 404 (CR-01 de la revue 09.1, Safari revalide une 404 gardée en cache) : `e=$(curl -sI https://<domaine>/nexistepas/ | awk 'tolower($1)=="etag:"{print $2}' | tr -d '\r'); curl -s -H "If-None-Match: $e" https://<domaine>/nexistepas/ | grep -c 'Page introuvable'` affiche `1` (une page vide affiche `0`) ; routes d'erreur : avant l'étape 5, `ssh keel-vps 'docker exec caddy caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile' | jq -c '.apps.http.servers | map_values(has("errors"))' > ~/.config/rtp/caddy-erreurs-avant.json` (lecture seule), puis la même commande après le rechargement de l'étape 6 vers `~/.config/rtp/caddy-erreurs-apres.json` ; `jq -s '.[0] as $a | .[1] | to_entries | all(.value == ($a[.key] // false))' ~/.config/rtp/caddy-erreurs-avant.json ~/.config/rtp/caddy-erreurs-apres.json` répond `true` : le bloc public n'a ajouté de route d'erreur à aucun serveur (comparaison avant et après, et non une valeur absolue : un autre site du serveur partagé peut déjà déclarer `handle_errors`, ce qui ne regarde pas ce bloc) ;
- autres sites du serveur inchangés : `ssh keel-vps 'bash -s -- instantane' < ops/verifier-sites.sh > ~/.config/rtp/sites-apres-bloc-public.tsv`, puis `bash ops/verifier-sites.sh comparer ~/.config/rtp/sites-avant-ouverture.tsv ~/.config/rtp/sites-apres-bloc-public.tsv` : `differents 0` et `disparus 0` (le nouvel hôte public est permis). Si une page de personne sans statut relu répond, c'est une panne : retour arrière immédiat de l'étape 5.

**Réglages après l'ouverture** (chacun après accord d'Erwan) :

| # | Écriture | Effet | Retour arrière |
|---|---|---|---|
| 7 | `gh variable set DEPLOY_URL --env production --body https://<domaine>` | le test de fumée des prochains déploiements vise l'hôte public | supprimer la variable |
| 8 | `gh secret delete DEPLOY_SMOKE_USER --env production`, `gh secret delete DEPLOY_SMOKE_PASS --env production` | plus d'identifiant envoyé à un site public sans défi `basic_auth` | les valeurs sont dans Vaultwarden et `~/.config/rtp/` |
| 9 | `gh variable set SONDE_URL --body https://<domaine>`, `gh secret delete SONDE_USER --env sonde`, `gh secret delete SONDE_PASS --env sonde`, puis `gh workflow run sonde.yml` | la sonde externe vise l'hôte public sans identifiant | remettre `SONDE_URL` sur l'hôte d'essai ; mots de passe dans Vaultwarden |
| 10 | battement, ci-dessous | le battement contrôle l'hôte public et son certificat, sans identifiant | recopier `battement.env.essai` et rejouer l'étape |

Étape 10 : modifier la copie locale du fichier d'environnement du battement sans l'afficher, puis l'installer par l'étape `battement` :

```bash
D=$(awk '/^domaine:/{print $2}' config/site.yml)
( umask 077; cp -p ~/.config/rtp/battement.env ~/.config/rtp/battement.env.essai
  { grep -v -E '^(RTP_HOTE|RTP_SONDE_USER|RTP_SONDE_PASS)=' ~/.config/rtp/battement.env.essai; printf 'RTP_HOTE=%s\n' "$D"; } > ~/.config/rtp/battement.env )
ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape battement' < ~/.config/rtp/battement.env
```

Les secrets `SONDE_PING_URL` et les adresses de ping ne changent pas. Contrôle : les deux dernières lignes de `journalctl -t rtp-battement` disent site et certificat `ok`.

**Retrait de l'hôte technique.** Commande approuvée à part, dans cet ordre : poser d'abord le marqueur, puis ôter le bloc de `sites.d` :

```bash
ssh keel-vps 'mkdir -p /opt/rtp /root/rtp-retire && touch /opt/rtp/essai-retire && mv /opt/vaultwarden/sites.d/reveletonprog-essai.caddy /root/rtp-retire/'
```

Puis les deux validations et le rechargement de l'étape 6. Avec le marqueur `/opt/rtp/essai-retire`, l'étape `site-essai` de l'installateur répond `[ok: retiré]` et ne réinstalle jamais le bloc, même quand toute la liste des étapes est rejouée (le marqueur n'est posé que par cette commande, jamais par le script). Si le bloc est de nouveau là malgré le marqueur (remis à la main, ou restauré), `site-essai` répond `[a faire]` : le déplacer dans `/root/rtp-retire/`, valider, recharger ; le script ne le déplace jamais. Le marqueur fait partie de la sauvegarde quotidienne (`rtp-sauvegarder`, revue de la phase 9, WR-08) : une reconstruction depuis l'archive le remet, et le test de restauration vérifie alors `site-essai`. Retour arrière : `ssh keel-vps 'rm /opt/rtp/essai-retire && mv /root/rtp-retire/reveletonprog-essai.caddy /opt/vaultwarden/sites.d/'`, validation, rechargement. Les variables d'empreinte `RTP_ESSAI_HASH` et `RTP_SONDE_HASH` restent : leur retrait changerait le conteneur. Le test de restauration du mois suit les blocs présents dans l'archive ; une sauvegarde puis un test juste après la mise en ligne le prouvent :

```bash
ssh keel-vps '/usr/local/sbin/rtp-sauvegarder && /usr/local/sbin/rtp-tester-restauration'
```

**Plus tard, avec une règle de date.**

- **HSTS** : le bloc envoie `max-age=300`. Le passer à `31536000` seulement après au moins **7 jours** stables après l'ouverture (aucune erreur de certificat ni de redirection, `www` vérifié) : modifier la valeur dans `scripts/render-caddy.ts`, relancer `node scripts/render-caddy.ts`, commiter, puis rejouer les étapes 4 à 6 pour ce bloc. **Jamais `includeSubDomains` ni `preload`** : le serveur héberge d'autres sites et l'hôte `essai` a son propre sous-domaine. Date d'ouverture et date visée : à inscrire ici par 09-12.
- **Dossier `/srv/reveletonprog/essai`** : le garder quelques jours (retour possible), puis le supprimer par une commande approuvée à part.
- **Enregistrement DNS `essai`** chez IONOS : à retirer par Erwan une fois le dossier supprimé.
- **IPv6 et enregistrements AAAA** : pas avant que ufw et les réseaux Docker du serveur soient traités (point ouvert de la Phase 8) ; avant tout AAAA, contrôler `curl -6 -I https://<domaine>` depuis l'extérieur.

### Serveur : installer et vérifier

Règle D-01 : sur le VPS, la lecture est libre (diagnostic, `caddy validate` dans un conteneur jetable, instantanés HTTP) ; toute écriture est montrée à Erwan (commande, effet, retour arrière) et lancée seulement après son accord, depuis la session principale (les agents n'écrivent jamais sur le serveur). La configuration du site ne s'écrit que par `ops/installer-serveur.sh`, une liste d'étapes approuvée à la fois ; recréation, rechargement de Caddy et cron restent des commandes séparées.

- Vérifier sans rien écrire, depuis une copie éphémère du dépôt (retirée à la fin, pas d'accord nécessaire) :

```bash
git archive --format=tar.gz HEAD ops deploy | ssh keel-vps 'd=$(mktemp -d) && tar -xz -C "$d" && bash "$d/ops/installer-serveur.sh" --verifier --etape montages,env-caddy,import-caddy,utilisateur,commande; r=$?; rm -rf "$d"; exit $r'
```

  Chaque ligne dit `[ok]` ou `[a faire]` ; une configuration conforme n'a aucun `[a faire]`. Ajouter à la liste les étapes déjà installées (`battement`, `sauvegarde`, `restauration-mensuelle`, `site-essai` ; `site-public` répond code 7 tant que la cible production n'est pas déployée, ce qui est attendu). Le script n'affiche jamais un contenu ni un secret.
- Appliquer (écriture, après accord) : rafraîchir la copie du dépôt sur le serveur, puis lancer les étapes approuvées depuis elle. La copie vient de `git archive` (l'arbre du dernier commit) et non d'un `tar` du dossier de travail : aucun fichier parasite du Mac (`.DS_Store`) ni modification non commitée n'est envoyé. Contrôle local, doit afficher 0 : `git archive --format=tar.gz HEAD ops deploy | tar -tz | grep -c DS_Store`. Un `.DS_Store` déjà envoyé avant ce changement se retire une fois : `ssh keel-vps 'rm -f /opt/rtp/depot/deploy/.DS_Store'`. Commiter avant d'envoyer. Sans secret à fournir, `</dev/null` ; avec secret, le fichier local sur l'entrée standard :

```bash
git archive --format=tar.gz HEAD ops deploy | ssh keel-vps 'mkdir -p /opt/rtp/depot && tar -xz -C /opt/rtp/depot'
ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape commande </dev/null'
ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape env-caddy' < ~/.config/rtp/hashes-caddy.env
```

  Étapes, toujours exécutées dans cet ordre : `sauvegarde-caddy` (copies `.bak-<AAAAMMJJhhmm>`, jamais écrasées), `montages`, `env-caddy`, `import-caddy` (ajout sur place, inode comparé), `utilisateur` (`--cle-publique <fichier>`), `commande`, `battement`, `sauvegarde`, `restauration-mensuelle`, `site-essai`, `site-public`, `depot`. Codes : 0 succès, 1 échec ou application incomplète, 2 usage, 3 `--appliquer` sans root, 4 entrée refusée, 5 inode du Caddyfile changé, 6 bloc d'essai ou public refusé, 7 bloc public refusé faute de `/srv/reveletonprog/current`. Une seconde application ne fait plus rien.
  `site-public` installe `deploy/caddy/site.caddy` en `sites.d/reveletonprog.caddy` et refuse dans deux cas : une adresse de l'un des deux blocs sur un domaine réservé (code 6), ou `/srv/reveletonprog/current` absent (code 7 : déployer d'abord la cible production). Après le retrait de l'hôte technique, `/opt/rtp/essai-retire` existe et l'étape `site-essai` répond `[ok: retiré]` au lieu de réinstaller le bloc, même dans la liste complète ; supprimer ce marqueur est la seule façon de rétablir l'étape. Le test de restauration mensuel vérifie `site-essai` et `site-public` selon les blocs présents dans l'archive, et échoue à l'étape `blocs` s'il n'y en a aucun.
- `ops/valider-caddy.sh` (lecture seule) : `caddy validate` dans un conteneur jetable de la même image, sans réseau ; `RTP_AJOUTER_IMPORT=1` valide une copie terminée par la ligne d'import, `RTP_BLOC_B64` un bloc candidat, `RTP_AVEC_SANS_VARIABLES=1` les deux cas de variables d'empreinte :

```bash
ssh keel-vps 'RTP_AVEC_SANS_VARIABLES=1 bash -s' < ops/valider-caddy.sh
ssh keel-vps "RTP_BLOC_B64=$(base64 < deploy/caddy/essai.caddy | tr -d '\n') bash -s" < ops/valider-caddy.sh
```

- `ops/verifier-sites.sh` (lecture seule) : instantané HTTP de chaque site servi, une ligne par hôte sous forme d'empreinte (aucun nom), puis comparaison. Les relevés restent sur le Mac (`~/.config/rtp/`, 0600), jamais dans le dépôt :

```bash
ssh keel-vps 'bash -s -- instantane' < ops/verifier-sites.sh > ~/.config/rtp/sites-avant.tsv
ssh keel-vps 'bash -s -- instantane' < ops/verifier-sites.sh > ~/.config/rtp/sites-apres.tsv
bash ops/verifier-sites.sh comparer ~/.config/rtp/sites-avant.tsv ~/.config/rtp/sites-apres.tsv
```

  Attendu : `differents 0` et `disparus 0` (un nouvel hôte, l'hôte technique, est permis). Code 1 sinon.
- Commande forcée `/usr/local/sbin/rtp-deploy-command` (copie de `ops/commande-deploiement.sh`, seule commande de la clé `deploy`, dont le `authorized_keys` appartient à root, comme `.ssh` et le dossier personnel `/home/deploy` lui-même, root:root 0755 avec tout son contenu : sinon `deploy` pourrait renommer `.ssh` et poser une clé sans restriction, revue de code WR-03 ; contrôle `ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --verifier --etape utilisateur </dev/null'`) :

| Verbe | Effet | Sortie |
|-------|-------|--------|
| `rsync --server <options> . <cible>/<sha>/` | envoi dans `incoming/<cible>/<sha>/` par `rrsync -wo -no-del -munge` | celle de rsync |
| `activer <cible> <sha>` | vérifie l'envoi, le range dans `releases/<sha>/`, bascule `current` | `active cible=… courant=… versions=…` |
| `retour <cible> [<sha>]` | rebascule `current` sur la précédente (ou sur `<sha>`) | `retour cible=… courant=… precedent=…` |
| `etat <cible>` | version courante, nombre de versions, espace libre | `etat cible=… courant=… versions=… libre_mio=…` |

  Codes : 0 succès, 64 refusé (caractères, verbe, jeton, nombre d'arguments), 65 envoi invalide (dont un envoi qui contient autre chose que des fichiers ordinaires et des dossiers : lien symbolique, tube, socket, périphérique, fichier à plusieurs liens physiques), 66 version introuvable, 75 espace disque insuffisant (moins de 1024 Mio libres ou 92 % utilisés), 1 autre échec (verrou, bascule). Chaque appel écrit une ligne JSON dans le journal (`journalctl -t rtp-deploy`).

**Recréer le conteneur Caddy** (seulement pour changer ses montages ou ses variables ; chaque écriture est approuvée à part). Faite une fois le 2026-11-09 : conteneur prêt en moins de 2 s, tous les autres sites identiques avant et après.

1. Lecture : instantané `avant` par `ops/verifier-sites.sh`.
2. Écriture : `--appliquer --etape sauvegarde-caddy --horodatage <AAAAMMJJhhmm>` (copies du Caddyfile et du fichier de composition).
3. Écriture : l'étape qui change la configuration (`montages`, `env-caddy`).
4. Lecture : `ssh keel-vps 'cd /opt/vaultwarden && docker compose config -q'` (surcharge fusionnée ; une empreinte manquante fait échouer la commande).
5. Lecture : `ops/valider-caddy.sh` avec `RTP_AVEC_SANS_VARIABLES=1`.
6. Message à Erwan : coupure de quelques secondes de tous les sites du serveur dans une minute.
7. Écriture : `ssh keel-vps 'cd /opt/vaultwarden && docker compose up -d --no-deps --force-recreate caddy'`. Jamais de `pull` (l'image locale est en 2.11.2) ; `--no-deps` laisse le service voisin intact.
8. Lecture : `docker inspect caddy` (montages et droits, noms des variables seulement, `LogConfig` à 10m et 3, politique de redémarrage), inode du Caddyfile identique sur l'hôte et dans le conteneur, `docker exec caddy caddy version`, instantané `apres` et `comparer`.
9. Retour arrière si un site a changé : remettre le Caddyfile sur place (`cat Caddyfile.bak-<…> > Caddyfile`), déplacer la surcharge dans `/root/rtp-retrait/`, recréer avec la même commande, reprendre un instantané et comparer.

**Attention :** `docker compose -f docker-compose.yml …` seul ignore `docker-compose.override.yml` et recréerait `caddy` sans les montages ni les variables. Toujours lancer `docker compose` dans `/opt/vaultwarden` sans option `-f`.

### Environments GitHub

| Environment | Protection | Variables | Secrets |
|-------------|------------|-----------|---------|
| `production` | Erwan seul relecteur requis, `prevent self-review` désactivé (sinon personne ne peut approuver ses propres push), branches de déploiement : `main` seulement | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_URL` | `DEPLOY_SSH_KEY`, `DEPLOY_SMOKE_USER`, `DEPLOY_SMOKE_PASS` |
| `sonde` | aucun relecteur (la sonde tourne toutes les 10 min), `main` seulement | aucune | `SONDE_USER`, `SONDE_PASS`, `SONDE_PING_URL` |

Variables de dépôt : `DEPLOY_CIBLE` (`essai`, puis `production` à l'ouverture, voir « Ouverture publique (Phase 9) » ; absente = chaîne de livraison en sommeil) et `SONDE_URL` (`https://essai.<domaine>`, posée par 08-15 ; absente = sonde en sommeil). Les relecteurs requis d'un Environment ne fonctionnent sur le plan gratuit que parce que le dépôt est public.

- Poser une valeur sans l'afficher, depuis le fichier local : `gh secret set DEPLOY_SSH_KEY --env production < ~/.config/rtp/rtp-deploy-github` (même forme pour `gh variable set … --env production`). La clé privée ne reste ensuite que dans l'Environment et dans Vaultwarden.
- Contrôler (noms seulement) : `gh secret list --env production`, `gh variable list --env production`, `gh variable list`, et `gh api repos/ErwanHenry/reveleTonProg/environments/production --jq '.protection_rules'`.

### Bloc Caddy (Phase 8)

`deploy/caddy/site.caddy` est généré (`node scripts/render-caddy.ts`, ne pas l'éditer à la main) : bloc du domaine (`root`, `encode zstd gzip`, `file_server`, en-têtes, journal) et redirection permanente de `www.` vers le domaine. Une adresse qui n'est ni un fichier ni un dossier de la release reçoit `404.html` avec le code 404 par le filtre `@introuvable` (`not file {path} {path}/`), `rewrite * /404.html` et `file_server { status 404 }`, précédé dans cette route seulement de `request_header -If-*` et `request_header -Range` (sans eux, Caddy 2.11.2 évalue préconditions et plages sur `404.html` et répond 404 avec un corps vide ou tronqué, page blanche dans Safari qui revalide une 404 : CR-01 de la revue 09.1 ; les vrais fichiers gardent ETag, 304 et plages), sans `handle_errors` (même raison que pour le bloc `essai` : sur le serveur partagé, il ferait passer le journal des erreurs de tous les sites au niveau debug) ; une release sans `404.html` répond 404 sans corps. La cible de la réécriture est le chemin fixe `/404.html` de la release, et un lien symbolique ne peut pas être servi depuis une release : le verbe `activer` de la commande forcée refuse tout envoi qui en contient un (constat CR-01 de la Phase 8) ; le filtre `file` ne teste donc que de vrais fichiers de la release. Son en-tête `Content-Security-Policy` porte les empreintes des deux scripts et `frame-ancestors 'none'` : c'est lui qui couvre le script d'ordre, placé avant la meta CSP de la page (ADR-056). Le journal d'accès tourne chaque jour à 00:00 UTC (`roll_at 00:00`, ou dès 10 Mio) et Caddy ne garde que 12 fichiers tournés (`roll_keep 12`, `roll_keep_for 288h`) plus le fichier du jour : une entrée y reste moins de 13 jours, et **14 jours au plus** si une rotation de minuit est manquée (Caddy arrêté à minuit). Adresses IP tronquées (/24 et /48), en-têtes de requête supprimés. C'est cette borne de 14 jours que reprennent les Mentions légales (étape 4 ci-dessus) ; `tests/repo/caddy.test.ts` la recalcule depuis le bloc rendu. `deploy/caddy/essai.caddy` suit les mêmes règles (voir « Hôte technique (essai) »).

Faits du serveur, constatés en 08-09 (ADR-057) :

- Caddy 2.11.2 dans le conteneur `caddy` (`caddy:2-alpine`), défini par `/opt/vaultwarden/docker-compose.yml`, qui n'est jamais modifié. Nos ajouts sont dans `/opt/vaultwarden/docker-compose.override.yml` (copie de `deploy/compose/docker-compose.override.yml`) : `/srv/reveletonprog` en lecture seule, `/var/log/caddy` en écriture, `/opt/vaultwarden/sites.d` sur `/etc/caddy/sites.d` en lecture seule, variables `RTP_ESSAI_HASH` et `RTP_SONDE_HASH`, journaux du conteneur plafonnés à 10 Mio x 3. `roll_at`, `ip_mask` et la suppression des en-têtes de requête sont acceptés par cette version.
- `/opt/vaultwarden/Caddyfile` se termine par `import /etc/caddy/sites.d/*.caddy`. Nos blocs vivent dans `sites.d/`, un fichier par hôte ; ce dossier est monté entier, un fichier y est donc remplacé sans risque par fichier temporaire et renommage.
- Règle d'inode : le Caddyfile est un montage d'un seul fichier. Ne jamais l'éditer par renommage (`sed -i`, éditeur qui remplace le fichier) : le conteneur garderait l'ancien inode et un `caddy reload` « réussirait » avec l'ancienne configuration. Écrire sur place (`>>` ou `cat > fichier`) puis comparer `stat -c %i /opt/vaultwarden/Caddyfile` à `docker exec caddy stat -c %i /etc/caddy/Caddyfile`.
- Changer la configuration : `ops/valider-caddy.sh` d'abord, puis `docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` et, seulement si c'est valide, `docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`. Jamais de redémarrage ni de recréation pour un changement de configuration : un rechargement refusé garde l'ancienne configuration, un redémarrage sur une configuration invalide coupe tous les sites du serveur.
- Variable d'empreinte vide : `{$RTP_ESSAI_HASH}` est remplacée avant l'analyse ; vide, tout le Caddyfile devient invalide, donc tous les sites au prochain démarrage. Trois parades : le bloc rendu porte une valeur par défaut factice (`HASH_FACTICE` de `scripts/render-caddy.ts`, forme bcrypt valide qu'aucun mot de passe ne produit), la surcharge exige les deux variables (`docker compose` refuse de recréer sans elles), et `ops/valider-caddy.sh` valide avec et sans elles (`RTP_AVEC_SANS_VARIABLES=1`).
- Lien `current` relatif (`releases/<sha>`), résolu dans le conteneur. Contrôle : `docker exec caddy ls /srv/reveletonprog/essai/current/index.html`.
- Un bloc n'entre dans `sites.d` qu'avec un vrai domaine dont le DNS répond (`dig +short essai.<domaine>`), jamais en `.invalid` (Caddy demanderait un certificat sans fin). Le bloc public (`site.caddy`, domaine et `www.`) attend la Phase 9 et l'enregistrement DNS de `www.<domaine>`. Avec un enregistrement AAAA publié, vérifier d'abord `curl -6 -I https://essai.<domaine>` depuis l'extérieur.
- Après un redémarrage de Caddy, le minuteur de rotation ne repart qu'à la première requête. Une fois le DNS posé, la sonde externe (toutes les 10 min) et le battement en HTTPS (toutes les 5 min) touchent le site bien plus d'une fois par jour (D-14) : la rotation de minuit tient tant que la supervision tourne. Contrôle au bout de deux jours : `ls -l /var/log/caddy/` montre des fichiers datés de minuit UTC, jamais plus de 12 par journal.
- La politique du bloc (IP tronquées, en-têtes supprimés, 14 jours) ne vaut que pour le **journal d'accès**. Le journal d'erreurs (`http.log.error`, réponses 5xx) et le journal par défaut de Caddy (TLS, ACME) vont sur la sortie d'erreur du conteneur, avec l'adresse complète : depuis la recréation, ils sont plafonnés en taille (pilote `json-file`, 10 Mio x 3), pas en durée. Contrôle : `docker inspect --format '{{.HostConfig.LogConfig}}' caddy` montre `max-size` et `max-file`. **Point juridique de la Phase 9** : les Mentions légales doivent le dire tel quel, ou ce flux doit passer par le même filtre (bloc `log` global avec `include http.log.error`).

## CI et déploiement depuis le Mac

Deux commandes locales remplacent, pour Erwan, un run GitHub Actions : `npm run ci:local` rejoue les contrôles de la CI, `npm run deploy:local` construit le commit poussé, l'envoie au serveur, l'active et le vérifie, avec les gardes du job `deploy` de `.github/workflows/ci.yml` (phase 9.2, ADR-063). Code : `scripts/ci-local.ts`, `scripts/deploy-local.ts`, `scripts/lib/ci-local.ts`, `scripts/lib/deploiement/`. Toutes les commandes passent par Node 24 : `fnm exec --using=24 npm run …`.

### Pourquoi

Fait établi le 2026-11-18 : le dépôt est public, ses workflows tournent sur les machines standard de GitHub, et les minutes de ces machines sont gratuites pour un dépôt public ; les runs de ce jour-là ont réussi. Erwan a choisi le chemin local en connaissance de cause (« Script sur le Mac », 2026-11-18). Cette phase ne modifie aucun workflow GitHub : les deux chemins coexistent (voir « Coexistence avec GitHub »).

### Prérequis

- Node 24 par fnm (`fnm exec --using=24`) ; les deux commandes refusent une autre version (code 2).
- gitleaks, installé par Erwan : `brew install gitleaks` (8.30.1, la version épinglée par la CI). Absent, la recherche de secrets de `ci:local` est « non exécutée » et le reçu ne permet pas de déployer.
- rsync 3, installé par Erwan : `brew install rsync`. Le `/usr/bin/rsync` de macOS est openrsync : il refuse les options de la CI et n'a jamais été essayé contre le `rrsync` du serveur, donc `deploy:local` le refuse pour un envoi réel (code 2). Si le rsync de Homebrew n'est pas le premier du `PATH`, poser `RTP_RSYNC=/opt/homebrew/bin/rsync` dans le fichier local.
- `sandbox-exec` (présent sur macOS ; Apple le déclare déprécié, il fonctionne sur macOS 15) : sans lui, la build de déploiement est refusée.
- `jq`, `git`, `ssh`, `ssh-agent`, `ssh-add`, `ssh-keygen`, `curl` (ceux de macOS conviennent).
- `~/.config/rtp/known_hosts-deploy` : l'empreinte épinglée du serveur, la même que `DEPLOY_KNOWN_HOSTS` ; jamais de scan de clé d'hôte.

### Fichier local deploiement.env

`~/.config/rtp/deploiement.env`, hors du dépôt, mode 0600 (refusé sinon). Une ligne `CLE=valeur` par clé, lignes vides et commentaires `#` admis, ni `export`, ni `$`, ni accent grave ; `~/` est développé. Jamais lu par un shell. Les messages d'erreur nomment la clé et la ligne, jamais la valeur.

| Clé | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `RTP_CIBLE` | oui | | `essai` ou `production` |
| `RTP_HOTE` | oui | | nom ou adresse du serveur (`ssh -F /dev/null` : `~/.ssh/config` et ses alias sont ignorés) |
| `RTP_UTILISATEUR` | oui | | utilisateur de déploiement du serveur |
| `RTP_URL` | non | vide | adresse `https://` du test de fumée ; vide : test HTTPS sauté, `etat` fait foi |
| `RTP_CLE` | non | `~/.config/rtp/rtp-deploy-mac` | clé privée du Mac (0600, avec phrase de passe), `.pub` à côté |
| `RTP_KNOWN_HOSTS` | non | `~/.config/rtp/known_hosts-deploy` | empreinte épinglée du serveur, non vide |
| `RTP_FUMEE_UTILISATEUR` | non | `sonde` | utilisateur `basic_auth` du test de fumée ; vide avec `RTP_FUMEE_MOT_DE_PASSE` vide : sans identifiant |
| `RTP_FUMEE_MOT_DE_PASSE` | non | `~/.config/rtp/sonde-pass` | chemin du fichier du mot de passe (0600), jamais le mot de passe |
| `RTP_RSYNC` | non | `rsync` (cherché dans le `PATH`) | rsync 3 de Homebrew |

Forme attendue, valeurs factices :

```
RTP_CIBLE=essai
RTP_HOTE=serveur.exemple.invalid
RTP_UTILISATEUR=deploy-factice
RTP_URL=https://essai.exemple.invalid/
RTP_RSYNC=/opt/homebrew/bin/rsync
```

Le fichier est créé par la session principale ou par Erwan, jamais commité. Hôte, utilisateur et adresse réels ne vont jamais dans le dépôt.

### Créer la clé du Mac

Erwan, dans son propre terminal, jamais un agent ni la session principale :

```bash
umask 077 && ssh-keygen -t ed25519 -C rtp-deploy-mac -f ~/.config/rtp/rtp-deploy-mac
```

ssh-keygen demande une phrase de passe : en choisir une, la ranger dans Vaultwarden (coffre `reveleTonProg`), ne jamais la laisser vide. Le commentaire `rtp-deploy-mac` évite d'écrire le nom du Mac dans la ligne publique. La session principale ne lit que `rtp-deploy-mac.pub`. Toute sous-commande qui contacte le serveur, `etat` comprise, vérifie d'abord que la clé a une phrase de passe (`ssh-keygen -y -P ''`, sortie jetée) et refuse une clé sans phrase de passe (code 3, aucun contact) ; pour en poser une : `ssh-keygen -p -f ~/.config/rtp/rtp-deploy-mac`. La phrase de passe est tapée par Erwan à l'invite de `ssh-add`, dans un agent ssh propre à la commande, où la clé expire au bout de 900 s ; l'agent est arrêté à la fin. Pour un déploiement ou un retour, elle est demandée deux fois : avant `etat` (version en ligne de l'écran), puis juste avant d'écrire sur le serveur, après la phrase de confirmation. Entre les deux, la clé est retirée de l'agent : elle ne reste pas chargée pendant que l'écran attend, et une confirmation tapée longtemps après ne tombe plus sur une clé expirée (revue de la phase 9.2, CR-04). Avant `activer`, la clé doit être encore là avec 12 minutes devant elle (vérification, test de fumée et retour automatique) ; sinon la phrase de passe est demandée une troisième fois.

### Autoriser la clé sur le serveur

Écriture du serveur : montrée à Erwan (commande, effet, retour arrière) et lancée seulement après son accord explicite, par la session principale ou par lui (règle D-01 de « Serveur : installer et vérifier »). Aucun agent ne le fait.

1. Fichier de deux lignes, sur le Mac : `cat ~/.config/rtp/rtp-deploy-github.pub ~/.config/rtp/rtp-deploy-mac.pub > ~/.config/rtp/cles-deploy.pub`. Avant, contrôler que la clé de GitHub est bien celle du serveur : l'étape `utilisateur` en vérification avec `--cle-publique` sur `rtp-deploy-github.pub` seul doit répondre `[ok] … une ou deux lignes restreintes, à jour`.
2. Copier ce fichier sur le serveur (une clé publique n'est pas un secret) avec la copie à jour de `ops/` (`git archive`, voir « Serveur : installer et vérifier »), puis : `ssh <hôte> 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape utilisateur --cle-publique <fichier sur le serveur> </dev/null'`. `authorized_keys` reçoit une ligne `restrict,command="/usr/local/sbin/rtp-deploy-command"` par clé, dans l'ordre du fichier, root:root 0644. L'installateur accepte une ou deux lignes `ssh-ed25519` distinctes et refuse (code 4, rien d'écrit) une troisième ligne (« deux lignes au plus »), une clé en double, une ligne vide ou un autre type de clé.
3. Contrôle : `--verifier --etape utilisateur </dev/null` répond `[ok] … une ou deux lignes restreintes` ; il répond `[a faire]` pour trois lignes, une clé en double ou une ligne sans le préfixe restreint exact.
4. Retour arrière : réappliquer l'étape avec la seule clé de GitHub (`--cle-publique` sur `rtp-deploy-github.pub`) ; la clé du Mac disparaît. **Le fichier passé à `--cle-publique` est la seule source** : une application future avec la seule clé de GitHub retire aussi celle du Mac. Garder `cles-deploy.pub` à jour et toujours le repasser.

### Contrôler : npm run ci:local

`fnm exec --using=24 npm run ci:local` rejoue les 19 étapes locales des jobs `verifier`, `secrets` et `e2e` de `ci.yml` (`npm run ci:local -- --liste` : identifiant, job, parité, nom de l'étape de ci.yml), une ligne par étape ; un échec n'arrête pas la suite. Long sur une machine chargée : ne lancer en même temps ni `npm test`, ni `npm run e2e`, ni un autre build dans le même dossier. `-- --etapes <id,id>` ne lance que ces étapes : reçu partiel, jamais valide pour un déploiement. `-- --aide` affiche l'usage.

- Reçu : `~/.cache/rtp/ci/<commit>.json` (dossier 0700, fichier 0600), écrit seulement si l'arbre de travail était propre au début et à la fin et que HEAD n'a pas bougé. Il porte le commit, la date, la base de `ids.lock`, la version de gitleaks et le résultat de chaque étape.
- gitleaks absent : la ligne dit « [non exécutée] Chercher des secrets : gitleaks absent (brew install gitleaks) » et le bilan rappelle que ce reçu ne permet pas de déployer.
- Codes : 0 toutes les étapes lancées sont vertes, 1 une étape a échoué, 2 usage, Node autre que 24, pas un dépôt git, ou un autre `ci:local` en cours (verrou `~/.cache/rtp/ci/.verrou`).
- Limite connue : un reçu partiel (`--etapes`) écrase le reçu complet du même commit. Relancer `npm run ci:local` complet avant de déployer.

### Déployer : npm run deploy:local

À lancer par Erwan dans son terminal : `fnm exec --using=24 npm run deploy:local`. Ordre : refus d'une entrée standard qui n'est pas un terminal (code 3, avant toute autre chose, sauf `--dry-run`) ; verrou local `~/.cache/rtp/deploiement/.verrou` commun au déploiement et au retour ; fichier local ; rsync 3 ; instantané d'intégrité (exécutables d'envoi, `git` et `bash` compris, toujours lancés par leur chemin figé ; `.git/config`, `.git/hooks`, fichiers de configuration, `ops/site-touche.sh` et `ci.yml`, WR-06) ; garde de gel ; arbre propre, `git fetch` réussi et HEAD égal à `origin/main` (rien de non poussé ne part en ligne) ; reçu vert de `ci:local` pour ce commit exact, sinon refus (code 1) : `deploy:local` ne lance jamais `ci:local`, Erwan le lance d'abord puis relance `deploy:local` dans un nouveau terminal (revue de la phase 9.2, CR-01 : `ci:local` fait tourner les dépendances npm sans bac à sable, dans le terminal même où la clé va être chargée) ; build scellée ; agent ssh (phrase de passe de la clé) ; `etat` ; site touché depuis la version en ligne ; clé retirée de l'agent ; écran ; phrase tapée ; puis instantané (avant tout nouveau `git`), gel, tête de `main`, fichier local, instantané de nouveau, empreinte de la build et `version.json` rejoués ; clé rechargée (phrase de passe tapée de nouveau) ; envoi, `etat` (version d'avant, qui doit être celle de l'écran : sinon code 1, rien n'est activé, WR-02), clé présente avec 12 minutes devant elle (sinon rechargée), `activer`, `etat`, test de fumée.

- Build scellée : worktree temporaire du commit dans le dossier temporaire (`$TMPDIR/rtp-deploiement-<sha12>-<hasard>`), `npm ci --ignore-scripts`, `npm audit signatures`, `npm run build`, `npm run check-dist -- --mode production`, `RTP_DEPLOIEMENT=1` pour `production` et `0` pour `essai`, sous `sandbox-exec` : écriture interdite hors du worktree, de son dossier `.git/worktrees/<nom>`, d'un dossier temporaire propre à la build (`…-tmp`, son `TMPDIR`) et d'un cache npm propre aux builds de déploiement (`~/.cache/rtp/npm-build`, 0700 ; jamais le `~/.npm` d'Erwan, où une build pourrait déposer sous `_npx` du code lancé ensuite hors de tout bac à sable : CR-03 ; la première build après ce changement télécharge tous les paquets) ; lecture interdite de chaque chemin désigné par le fichier local (clé, `.pub`, known_hosts, mot de passe de la sonde) et du fichier lui-même, de `~/.config/rtp`, `~/.ssh`, `~/.config/gh` et du dossier des agents ssh (`~/.cache/rtp/agents`) ; aucune connexion à un socket Unix hors du résolveur DNS ; ni lecture ni écriture de `/dev/tty` (WR-07). Chaque étape tourne dans sa propre session, sans terminal de contrôle, et son groupe de processus est tué à la fin (revue de la phase 9.2, CR-01). L'agent ssh n'existe pas encore pendant la build ; son socket vit ensuite sous `~/.cache/rtp/agents/`, hors du dossier temporaire. Une fois les étapes finies, `dist/` est copié dans un dossier privé que la build ne peut pas écrire (`~/.cache/rtp/deploiement/build-<hasard>`, 0700) et le worktree est retiré aussitôt : l'empreinte affichée, les contrôles d'après la confirmation et l'envoi portent sur cette copie seule (CR-02). La copie est supprimée à la fin, quelle que soit l'issue.
- Écran avant la phrase : cible, commit et sujet, version en ligne et son sujet, date du reçu, fichiers qui changent (20 lignes au plus), empreinte de la build, variante de rsync, garde de gel.
- Phrases, tapées exactement (ni espace en plus, ni majuscule) : `deployer essai <sha7>` ou `deployer en production <sha7>`. Elles sont lues sur le terminal (`/dev/tty`), jamais sur l'entrée standard ; aucune option du type `--oui` n'existe. Ce qui a été tapé avant l'invite est jeté (une phrase tapée d'avance, après la répétition à blanc par exemple, ne vaut pas confirmation), et l'écran est réécrit sur le terminal quand la sortie standard est redirigée (`| tee`, fichier) (IN-04). Une autre saisie : code 3, rien n'est envoyé.
- Limites du serveur, inchangées dans cette phase (IN-01) : un second envoi du même commit dans la même journée s'ajoute au premier dans `incoming/<cible>/<sha>/` (rsync sans suppression : un fichier absent de la nouvelle build reste) ; si `releases/<sha>` existe déjà (redéploiement après un retour), la commande forcée ignore l'envoi et réactive l'ancienne copie, dont l'empreinte n'est pas celle affichée. L'écran le signale quand le journal local montre un déploiement réussi du même commit sur la même cible. Correction côté serveur (décision d'Erwan, hors de cette phase) : vider `incoming/<cible>/<sha>/` avant chaque envoi, et comparer l'empreinte de l'arbre envoyé à celle de `releases/<sha>` avant de réactiver.
- Commit qui ne touche pas le site (même classement que `ops/site-touche.sh`, depuis la version en ligne) : « rien à déployer », code 0, sauf avec `-- --forcer`.
- `-- --dry-run` : répétition à blanc. Elle exige le fichier local (clé et `.pub` présents, jamais ouverts), prend le verrou, rejoue les gardes, le reçu et la build scellée, affiche l'écran et la phrase qui sera demandée, puis s'arrête. **La répétition à blanc ne contacte jamais le serveur** : ni agent ssh, ni `etat`, ni envoi, ni HTTPS, et elle n'écrit pas au journal. Elle tourne sans terminal ; avec openrsync, elle avertit au lieu de refuser.
- Codes de sortie de `deploy:local` (déploiement) : 0 déployé, rien à déployer ou répétition à blanc ; 1 garde ou étape en échec, activation refusée ou interruption avant l'activation, rien d'activé ; 2 usage ou configuration (rsync 3 absent compris, verrou tenu) ; 3 pas de terminal, confirmation refusée ou clé sans phrase de passe ; 4 échec après l'activation, version d'avant remise en ligne ; 5 échec après l'activation, version d'avant non remise (vérifier avec `npm run deploy:local -- etat`).
- Après l'activation, un échec ou un Ctrl-C (SIGINT, SIGTERM, SIGHUP) déclenche le retour automatique vers la version exacte notée juste avant (code 4). Les appels `ssh`, `rsync` et `curl` tournent dans leur propre session : un Ctrl-C ou la fermeture de la fenêtre ne coupe ni un `activer` ni un retour en vol (WR-04) ; la commande attend leur fin, et le journal local garde la trace si le terminal n'est plus là. Pas de retour automatique (code 5) pour un retrait d'urgence, sans version avant, ou si `current` pointe une troisième version (retour manuel ou déploiement venu d'ailleurs entre-temps).
- Un refus net du verbe `activer` n'a rien activé : refus de la commande forcée (64, 65, 66, 75), verrou du serveur occupé (« verrou occupé », par exemple un run GitHub en cours), ou refus de ssh avant toute commande (clé refusée, connexion refusée, clé d'hôte, nom introuvable). Code 1 « activation refusée, rien n'a été activé », sans retour automatique. Si le retour automatique constate que `current` pointe toujours la version d'avant, il rend aussi le code 1 (« rien de ce déploiement n'est en ligne ») au lieu de 5 (revue de la phase 9.2, WR-01).
- `deploy:local` n'a pas d'option `--aide` : une option inconnue affiche l'usage complet (code 2).

### Lire l'état

`fnm exec --using=24 npm run deploy:local -- etat` : lecture seule, mais la phrase de passe de la clé est demandée (aucun agent ne contacte le serveur par ce chemin). Affiche la cible, le commit en ligne et son sujet, le nombre de versions, l'espace libre, puis le commit servi par `/version.json` et la présence de `Strict-Transport-Security` et `Content-Security-Policy` (si `RTP_URL` est renseignée). Codes : 0 état lu et cohérent, 1 anomalie (commit servi illisible ou différent, en-tête absent), 2 usage ou configuration, 3 clé sans phrase de passe ou non chargée, autre : code du serveur ou de ssh.

### Retour arrière depuis le Mac

`fnm exec --using=24 npm run deploy:local -- retour` remet la version précédente de la cible du fichier local ; `npm run deploy:local -- retour <sha>` remet un commit précis (40 hexadécimaux en minuscules, encore dans `releases/`). Remplace `rollback.yml` : même verrou que le déploiement, garde de gel, phrase de passe, `etat`, clé retirée de l'agent, écran, phrase `retour essai precedente`, `retour en production precedente` ou `retour essai <sha7>`, garde de gel rejouée, phrase de passe de nouveau (clé rechargée), `etat` relu (la version en ligne doit être celle de l'écran, sinon code 1 sans rien remettre), verbe `retour` (le serveur doit avoir quitté la version de l'écran), `etat` (vers « la précédente », `current` doit avoir changé), commit servi (WR-03). Si le journal local dit que la version en ligne est un retrait d'urgence, l'écran avertit que le retour remettra en ligne le contenu retiré et la phrase devient `retour essai precedente malgre retrait` (ou `… <sha7> malgre retrait`) ; un retrait fait depuis GitHub n'est pas au journal local. `-- --dry-run` ne contacte pas le serveur. Codes : 0 fait et vérifié, 1 garde ou vérification en échec (les codes du serveur, 64, 66, 255, sont cités dans le message) ou interruption (Ctrl-C) avant le verbe `retour`, 2 usage, configuration ou verrou tenu, 3 pas de terminal, confirmation refusée ou clé sans phrase de passe.

### Gel et retrait d'urgence depuis le Mac

Mêmes fenêtres et mêmes règles que « Gel des scrutins et retrait d'urgence » (`scripts/garde-gel.ts`). La garde est jouée au départ, puis rejouée juste après la phrase tapée : une confirmation tapée avant minuit et validée pendant un gel n'envoie rien. Pendant un gel, seul un retrait d'urgence passe : commiter le retrait, le pousser, puis `npm run deploy:local -- --urgence --justification "Retrait de la mesure X publiée sans source"` (20 caractères au moins ; `--justification` sans `--urgence` est refusé, code 2). Un retrait d'urgence est déployé même si le classement dit « hors site » et n'a jamais de retour automatique (code 5 sur un échec après l'activation : vérifier avec `etat`). Retour arrière pendant un gel : `npm run deploy:local -- retour <sha> --urgence --justification "…"`. La justification est nettoyée, masquée et gardée au journal.

### Pannes

- « rsync 3 requis pour l'envoi » (code 2) : `brew install rsync`, puis `RTP_RSYNC=<chemin>` dans le fichier local si besoin.
- « recherche de secrets (gitleaks) non exécutée » : `brew install gitleaks`, puis `npm run ci:local`.
- « la clé … n'a pas de phrase de passe : refusée » (code 3) : `ssh-keygen -p -f ~/.config/rtp/rtp-deploy-mac`. « clé non chargée » : la phrase de passe n'a pas été tapée (pas de terminal, ou phrase refusée), au premier chargement ou au rechargement d'après la confirmation ; rien n'a été envoyé ni activé. « clé absente de l'agent » (code 3) : la clé n'est plus dans l'agent même après le rechargement ; relancer.
- « Permission denied (publickey) » à l'envoi après une longue attente à l'écran : cas constaté avant la revue de la phase 9.2, réglé par le rechargement de la clé après la confirmation (CR-04). S'il revient, vérifier que la clé du Mac est toujours dans `authorized_keys` (« Autoriser la clé sur le serveur »).
- Verrou tenu (code 2, le pid est nommé) : attendre la fin de l'autre déploiement ou retour. Un verrou dont le processus n'existe plus est repris avec un avertissement.
- « git fetch impossible » (code 1) : réseau ou accès à GitHub ; rien de non vérifié ne part en ligne.
- « intégrité locale modifiée » (code 1) : un exécutable d'envoi, `.git/config`, `.git/hooks` ou un fichier de configuration a changé pendant `ci:local`, la build ou l'attente de la phrase. Ne pas relancer à l'aveugle : regarder ce qui a changé et pourquoi.
- Code 4 : le site en ligne est la version d'avant ; lire la raison, corriger, redéployer. Code 5 : la version en ligne est incertaine ; `npm run deploy:local -- etat` d'abord, puis `retour <sha>` si besoin.
- « sandbox-exec introuvable » (code 2) : aucun déploiement possible sans le bac à sable. Apple déclare `sandbox-exec` déprécié : s'il disparaît d'une future version de macOS, ce chemin s'arrête et le chemin GitHub reste disponible.
- Ctrl-C (ou SIGTERM, SIGHUP) avant l'activation, pendant la build, la phrase de passe ou la phrase de confirmation : la commande s'arrête tout de suite (étape de build tuée avec son groupe, invite interrompue), retire le worktree temporaire et la copie de la build, ferme l'agent, écrit `refus` au journal et rend le verrou ; code 1 « interrompu par SIGINT avant l'activation : rien n'a été activé » (revue de la phase 9.2, WR-05 ; avant elle, le worktree temporaire restait dans le dossier temporaire). Si un ancien worktree reste malgré tout (processus tué par `kill -9`) : `rm -rf "$TMPDIR"/rtp-deploiement-<sha12>-*`, puis `git worktree prune`.
- Tests du bac à sable : `tests/deploiement/construire.test.ts` joue le vrai `sandbox-exec` sur macOS ; sous Linux (CI GitHub) ces cas sont sautés (« macOS seulement »). Un exécuteur qui tourne lui-même dans un bac à sable peut se voir refuser le bac à sable imbriqué : les tests sont alors lancés par la session principale (`TZ=Europe/Paris fnm exec --using=24 node --test --test-timeout=900000 tests/deploiement/construire.test.ts`), jamais affaiblis.

### Journal

`~/.local/state/rtp/deploiements.jsonl` (dossier 0700, fichier 0600), une ligne JSON par déploiement, retour et retour automatique : date UTC, action (`deployer`, `retour`, `retour-auto`), cible, commit, version d'avant, résultat (`succes`, `echec`, `refus`, `retour-auto`, `sans-retour`), urgence, justification et message facultatifs. Identifiants masqués (`<hôte>`, `<utilisateur>`, `<url>`, et toute adresse IP écrite par ssh : `<adresse>`, WR-08), aucune donnée personnelle, aucun secret. Pas de ligne pour une répétition à blanc ni pour « rien à déployer ». Lecture : `tail -n 5 ~/.local/state/rtp/deploiements.jsonl | jq .`.

### Coexistence avec GitHub

- Les workflows GitHub (`ci.yml`, `rollback.yml`) ne sont pas modifiés par cette phase. Les mettre en sommeil (retirer la variable `DEPLOY_CIBLE`) ou désactiver Actions est une décision séparée d'Erwan, à prendre après le premier déploiement local réussi (D-11 : tranchée le 2026-11-22 à l'ouverture, déploiement GitHub mis en sommeil par le retrait de `DEPLOY_CIBLE` ; la CI de vérification continue de tourner sur GitHub).
- Tant que `DEPLOY_CIBLE` est posée, un push qui touche le site crée sur GitHub un déploiement en attente d'approbation. Après un déploiement local du même commit, **rejeter** ce run (« Review deployments ») : approuvé, il ne ferait que réactiver le même commit, et approuvé après un retour arrière local, il remettrait en ligne ce que le retour a retiré.
- Le serveur sérialise de toute façon les verbes `activer` et `retour` des deux chemins (verrou `flock -w 20`) ; le verrou local du Mac ne voit pas GitHub.
- Revenir au chemin GitHub : rien à réinstaller, les workflows et la clé de GitHub sont en place ; approuver le prochain run, ou `gh workflow run ci.yml --ref main -f deployer=true`. Retirer la clé du Mac si besoin : réappliquer l'étape `utilisateur` avec la seule clé de GitHub (« Autoriser la clé sur le serveur », point 4).

### Règle pour les agents

- Un agent ne lance que `npm run deploy:local -- --dry-run` (ou `retour --dry-run`), qui ne contacte jamais le serveur.
- Jamais `script`, `expect` ni aucun pseudo-terminal autour de `deploy:local`, jamais de `ssh` vers le serveur. L'agent ne lit ni n'affiche lui-même aucun fichier de `~/.config/rtp/` hors des `.pub` (la commande lit le fichier local sans jamais afficher une valeur).
- Le premier `etat` réel et chaque déploiement ou retour réels sont faits par Erwan, dans son terminal : lui seul connaît la phrase de passe de la clé.
- La phrase tapée protège contre l'erreur, pas contre un attaquant : la barrière réelle est la phrase de passe de la clé (ADR-063).

## Veille des candidatures

Phase 10.1, demande d'Erwan du 2026-11-20 : sortir les candidats qui se désistent (au profit d'un autre ou non) et ajouter ceux qui entrent dans la course. Règle : la veille détecte et propose, Erwan décide ; le site ne change qu'après une pull request relue (ADR-064).

### Ce que fait la veille

Deux fois par jour, à 8 h et à 19 h (heure du Mac), `launchd` lance la veille sur le Mac d'Erwan ; un passage manqué pendant la veille du Mac est rattrapé au réveil, pas un Mac éteint. Un passage : récupère `origin` en lecture ; aligne son propre worktree détaché (`~/.cache/rtp/veille/arbre`) sur `origin/main` ; télécharge le jeu data.gouv « statuts sourcés » (seule source, décision du 2026-11-20 ; le Conseil constitutionnel viendra dans une phase ultérieure, avant fin février 2027) ; garde les octets sous `amont/<sha256>.json` ; si l'empreinte est déjà connue, s'arrête là ; sinon lance `import:datagouv -- --dry-run --format json` dans son worktree, classe les changements et écrit un rapport daté. Il n'écrit jamais dans le dossier de travail d'Erwan, ne crée aucune branche, ne pousse rien, n'ouvre aucune pull request.

Après chaque passage, le même lanceur exécute `npm run veille -- auto`, la mise à jour autonome des statuts (voir « Mise à jour autonome des statuts ») ; sans le marqueur d'activation, elle s'arrête au commit local, sans rien publier. Un passage à blanc marque le jeu comme traité : après création du marqueur `auto-actif`, le jeu déjà vu à blanc n'est republié qu'avec `npm run veille -- auto --reprendre`, qui efface cette marque et fait retraiter le jeu courant.

Le jeu amont change d'octets sans changer `mise_a_jour` : la veille dédoublonne sur l'empreinte SHA-256, jamais sur la date.

| Commande | Effet |
|---|---|
| `npm run veille` | un passage (sous-commande `lancer` par défaut) ; `--sans-alerte` pour un essai, `--reference <ref>` pour suivre une autre référence |
| `npm run veille -- auto` | mise à jour autonome des statuts ; `--reprendre`, `--sans-alerte`, `--sonde-agent`, `--sonde-push` |
| `npm run veille -- etat` | dernier passage, dernière empreinte, dernier rapport, canaux configurés (oui ou non, jamais la valeur) |
| `npm run veille -- decider <id-amont>` | décision d'Erwan sur une personne, tapée dans un terminal (voir plus bas) |
| `npm run veille -- preparer` | branche d'import locale, jamais poussée (voir plus bas) |
| `npm run veille -- installer` | planification `launchd` (agent `fr.reveletonprog.veille`) et lanceur ; idempotent |
| `npm run veille -- retirer` | retire la planification et le lanceur ; rapports et état restent |

Dossier de données : `~/.cache/rtp/veille` (0700 ; `RTP_VEILLE_DIR` pour un autre dossier) : `etat.json`, `rapports/`, `amont/`, `pr/` (corps de pull request), `arbre/`, `lancer.sh`, `journal.log`.

### Lire le rapport

En tête, le résumé de la veille, puis le rapport d'import habituel (section « Importer les statuts data.gouv »), puis le texte amont non relu.

- **Sorties** : statut amont `renonce` ou `empeche` pour une personne dont le dernier statut ne l'était pas. Un désistement au profit d'une autre candidature se traduit par le motif `ralliement`, sans nommer la candidature soutenue sur le site (décision du 2026-11-20).
- **Entrées** : personne nouvelle au statut `declare` ou `primaire`, ou statut qui passe à `declare` ou `primaire`.
- **Retours** : sortie annulée (`renonce` ou `empeche` vers un autre statut).
- **Autres changements de statut** : par exemple `declare` vers `primaire`, ou une personne nouvelle déjà hors course.
- **Décisions à prendre (Erwan seul)** : ligne de `correspondances.yaml` à écrire pour une personne absente de la table ; motif d'un désistement quand la ligne de la table n'en a pas. Avant la phase 10.1, ce dernier cas faisait échouer la répétition à blanc ; il y est maintenant listé sous « Désistements dont le motif est à décider », et l'import réel refuse tant que le motif n'est pas décidé.
- **Effet sur les thèmes publiés** : case de couverture à créer avant de relire le statut d'une entrée ; personne qui sortira du périmètre d'équité quand son statut `renonce` sera relu (ses mesures quittent alors les cellules du thème et elle apparaît sous « Ne se présente pas »).
- **Texte amont non relu** : `statut_detail` du jeu amont, pour aider à choisir un motif. Il reste dans ce rapport local : jamais dans `src/content/`, jamais dans le corps de la pull request.

Les dérives de source à statut inchangé n'alertent pas ; elles restent dans le rapport.

### Alertes

Alerte seulement quand l'empreinte est nouvelle et qu'il y a une sortie, une entrée, un retour, un autre changement de statut ou une décision à prendre : notification macOS et message Telegram court (comptes et chemin du rapport, aucun nom). Sans jeton Telegram, notification macOS seule ; une panne Telegram n'arrête pas la veille et apparaît dans `etat`. Un envoi Telegram qui échoue pour une raison passagère (réseau, délai de 30 secondes dépassé, 429, 5xx) est retenté une fois après 5 secondes ; un refus net (jeton ou conversation faux) ne l'est pas. Un envoi dont seule la réponse a tardé peut être déjà arrivé : un doublon est alors possible, préféré à une alerte perdue. Chaque passage réussi envoie un ping de succès au contrôle Healthchecks `veille-candidatures`, et un `/fail` si la veille elle-même tombe en panne ; ce contrôle ne signale jamais un changement.

### Installer (Erwan, une fois)

1. Bot Telegram : dans Telegram, écrire à `@BotFather`, `/newbot`, nom au choix ; noter le jeton. Écrire un message au bot, puis lire l'identifiant de conversation dans la réponse de `https://api.telegram.org/bot<jeton>/getUpdates` (champ `chat.id`). Copier le jeton dans Vaultwarden (coffre `reveleTonProg`).
2. Healthchecks : créer le contrôle `veille-candidatures`, période 12 heures, grâce 2 jours, intégration Telegram existante ; copier l'adresse de ping.
3. Trousseau du Mac (chaque commande demande la valeur, tapée par Erwan ; `-U` remplace une valeur existante) :

   ```bash
   security add-generic-password -U -a "$USER" -s rtp-veille-telegram-jeton -w
   security add-generic-password -U -a "$USER" -s rtp-veille-telegram-conversation -w
   security add-generic-password -U -a "$USER" -s rtp-veille-healthchecks -w
   ```

4. Depuis n'importe quel checkout du dépôt à jour : `fnm exec --using=24 npm run veille -- installer`, puis un essai immédiat : `launchctl kickstart gui/$(id -u)/fr.reveletonprog.veille`, et `npm run veille -- etat`. Au premier accès au Trousseau, macOS peut demander l'autorisation pour `security` : choisir « Toujours autoriser ».

La première alerte arrive au premier passage (aucune empreinte connue) s'il y a quelque chose à décider.

### De la décision à la pull request

1. `npm run veille -- preparer` : refuse pendant le gel d'import (13 décembre 2026 à 18:00 au 15 décembre 2026 à 23:59) et pendant les fenêtres de `scripts/garde-gel.ts` ; sinon crée ou reprend le worktree `../reveleTonProg-import` sur `import/statuts-AAAA-MM-JJ` depuis `origin/main`, avec les octets du dernier rapport (empreinte vérifiée). S'il reste une décision, il liste les commandes `decider` et s'arrête (code 3).
2. Dans ce worktree, pour chaque personne listée : `npm run veille -- decider <id-amont>`. La commande affiche les faits amont et le texte amont non relu, puis demande l'identifiant de fiche, le prénom, le nom, `nom_tri`, le type de source et, pour un désistement, le motif (`retrait`, `elimine_primaire`, `ralliement`, `non_candidat`) ; pour une personne déjà dans la table, seulement le motif. Rien n'est prérempli. Elle relit la table modifiée, montre l'entrée et n'écrit qu'après « oui ». Sans terminal de contrôle (tâche planifiée, agent, processus détaché), elle refuse avant toute autre action (code 3) ; dans le dossier de travail principal ou hors d'une branche `import/…`, elle refuse aussi.
3. `npm run veille -- preparer` à nouveau : corps de pull request écrit sous `~/.cache/rtp/veille/pr/` (résumé et rapport, sans texte amont non relu) ; commit des décisions ; import réel ; pointeur `data/dataset-datagouv.yaml`, dates de `data/import/ATTRIBUTION.md` et de `LICENSE` ; contrôles `--check`, `ids -- --check`, `validate --mode production` ; commit de l'import (statuts en `brouillon`). Il imprime ce qui reste à décider ou à relire et les commandes de push et de pull request, sans les lancer. Code 4 si un contrôle échoue.
4. Sur la branche, par un agent d'IA puis revérifié par un second agent (délégation d'Erwan du 2026-11-24) : cases de couverture des thèmes publiés avant toute relecture d'une entrée, `data/couverture-themes.yaml` et cases des thèmes pilotes pour chaque nouvelle personne du périmètre (liste de contrôle de l'import, points 6 et 7), relecture des statuts (`npm run relecture -- marquer statut <candidat> --relecteur "l'agent d'IA Claude"`, `--hors-perimetre` pour une sortie), textes qui annoncent un compte.
Quand l'automate est activé, il fait lui-même ces écritures pour les cas simples (règles fixes, deux agents sans outil, ci:local complet) et les cas réservés restent à Erwan.

5. Erwan pousse et ouvre la pull request (ou le demande à un agent), la relit et la fusionne ; le déploiement suit la procédure habituelle. En décembre 2026, la procédure « Import de décembre » s'applique telle quelle ; la veille sert à la répétition du matin.

### Pannes

- `etat` dit `panne` : lire `derniere erreur`, puis `~/.cache/rtp/veille/journal.log`. Réseau ou data.gouv indisponible : le passage suivant réessaie, rien à faire.
- « le worktree de la veille contient des modifications » : quelqu'un a écrit dans `~/.cache/rtp/veille/arbre`. La veille ne l'écrase pas. Regarder le diff (`git -C ~/.cache/rtp/veille/arbre status`), puis le supprimer : `git worktree remove --force ~/.cache/rtp/veille/arbre` ; le passage suivant le recrée.
- Plus aucune alerte Healthchecks ni rapport : `launchctl print gui/$(id -u)/fr.reveletonprog.veille` ; réinstaller avec `npm run veille -- installer`.
- Jeton Telegram révoqué ou changé : refaire l'étape 3 de l'installation pour ce seul service.
- `preparer` code 1 « répétition à blanc signale un conflit » : lire la section « Conflits » du rapport et la section « Importer les statuts data.gouv ».

### Retirer

`npm run veille -- retirer` (planification et lanceur supprimés ; rapports et état gardés). Pour tout effacer ensuite : `git worktree remove --force ~/.cache/rtp/veille/arbre`, puis supprimer `~/.cache/rtp/veille`, les trois entrées `rtp-veille-*` du Trousseau et le contrôle Healthchecks.

### Règle pour les agents

Un agent peut lancer `npm run veille`, `etat` et `preparer`, lire les rapports et en résumer les comptes. Il ne lance jamais `decider` (ni par un pseudo-terminal), n'écrit aucune ligne de `correspondances.yaml`, aucun motif, aucune case de couverture, aucun statut relu, et ne pousse la branche d'import que sur demande écrite d'Erwan. Les lignes de `correspondances.yaml` écrites par règles fixes le sont par l'automate, jamais par un agent interactif.

## Mise à jour autonome des statuts

Phase 10.3, demandes d'Erwan du 2026-11-24 et du 2026-11-26 : les quatre gestes manuels qui suivent un changement de statut amont (décider, préparer, relire, publier) sont faits par une tâche planifiée sur le Mac, avec des contrôles qui s'arrêtent au moindre doute (ADR-065). Livrée désactivée : tant que le marqueur d'activation est absent, l'automate travaille à blanc.

### Ce que fait l'automate

- **D-01** : la mise à jour des statuts de personnes est publiée sans relecture humaine préalable, mais seulement si tous les contrôles passent.
- **D-02** : l'identité d'une personne est décidée par des règles fixes, jamais par un agent ; un cas ambigu s'arrête avec une alerte.
- **D-03** : deux agents `claude -p` sans outil relisent chaque écriture ; une citation que le code ne retrouve pas dans la source arrête le passage.
- Statut : le nom de famille de la fiche doit figurer dans la source, et la date de page renvoyée par un agent, si elle est donnée, doit être le jour du statut du jeu ; sinon `doute_agent`. Le texte des pages entre dans le prompt avec toute borne du bloc de données non fiables neutralisée.
- Constat « programme non publié » : c'est un constat d'absence, donc une appréciation de l'agent, doublée d'un second agent, jamais une preuve. Il ne porte que sur les pages lues (site de campagne, site du parti, source du statut), listées dans `urls_consultees` ; chaque page a sa part du texte lu, et la citation exigée (au moins 40 caractères, retrouvée dans une de ces pages) prouve que la page a été lue, pas qu'aucun programme n'existe ailleurs.
- **D-04** : la clé de déploiement automatique est distincte, restreinte côté serveur par `--auto`, et la publication est retenue du 10 décembre 2026 00:00 au 15 décembre 2026 à 23:59.

Un passage (lancé par le lanceur launchd, `lancer` puis `auto`) : verrou ; worktree dédié `~/.cache/rtp/veille/auto` aligné sur `origin/main` ; répétition à blanc de l'import ; cas réservés (motif à décider, date au mois, volume, conflit, identité ambiguë, programme signalé) qui s'arrêtent avec une alerte ; identité par règles fixes ; deux agents sans outil ; écriture des fichiers par gabarits ; garde de périmètre (seuls les fichiers attendus ont changé) ; commit local ; `ci:local` complet ; push en avance rapide sur `main` (sans pull request, parce qu'une fusion change le SHA du reçu) ; `deploy:auto` ; alerte du résultat.

Tant que le marqueur `~/.config/rtp/auto-actif` est absent, le passage s'arrête au commit local testé (code `pret_a_blanc`). Un passage à blanc marque le jeu comme traité : après création du marqueur, `npm run veille -- auto --reprendre` republie le jeu déjà vu.

`--reprendre` efface la marque « jeu traité » et fait retraiter le jeu courant, quel que soit l'état non transitoire : repos après un passage à blanc, arrêt définitif (`ci_rouge`, `controle_rouge`, `doute_agent` et les autres codes non transitoires du tableau) ou état `retenu`. Seule exception : un commit poussé mais non déployé (`pousse_non_deploye`) garde la priorité ; sa mise en ligne est reprise d'abord, sans nouveau commit, et l'option n'y change rien. L'automate ne touche jamais un texte de mesure, une source citée ni `archives/`.

Frontière de confiance (IN-04) : l'automate exécute le code de `origin/main` (import, `ci:local`, validation, `deploy:auto`) dans son worktree dédié, sous le compte d'Erwan, avec la clé de déploiement automatique, la configuration de l'agent et le moyen de push à portée dans `~/.config/rtp/`. Tout commit sur `main`, quelle que soit la session qui le pousse, est donc du code de confiance, exécuté au passage suivant. Mesures en place : une seule personne pousse sur `main` ; clé restreinte côté serveur par `--auto` ; push en avance rapide seulement, sans forçage ; agents sans outil ; alerte à chaque publication ; interrupteur d'arrêt. Risque accepté : un commit erroné ou malveillant sur `main` agirait avec ces moyens ; la protection de `main` côté GitHub (avance rapide seulement, auteurs limités) reste à envisager.

Commandes : `npm run veille -- auto [--reprendre] [--sans-alerte] [--sonde-agent] [--sonde-push]`, `npm run veille -- etat`, `npm run deploy:auto -- etat` (lecture) ; `npm run deploy:auto -- deployer <sha>` n'est appelé que par l'automate. Codes de sortie de `auto` : 0 (passage terminé sans arrêt), 3 (arrêt avec alerte, voir le tableau), 1 (exception inattendue, alerte `controle_rouge`), 2 (usage ou configuration locale invalide). Les sondes impriment des lignes fixes : `agent : ok` ou `agent : ko`, `push : ok` ou `push : ko`.

### Codes et alertes

Une alerte (notification macOS et Telegram) contient un libellé fixe, le code, le mode, des comptes, un SHA court, des identifiants de fiche et le chemin du rapport local. Jamais de nom complet, jamais de texte produit par un agent. Un arrêt transitoire est retenté au passage suivant ; un arrêt définitif marque le jeu comme traité, et seul `--reprendre` (après correction) le fait retraiter. L'état `retenu` (après un échec de mise en ligne) attend un examen puis `--reprendre`.

| Code | Sens | Ce que fait Erwan |
|---|---|---|
| `publie` | mise à jour publiée et mise en ligne | rien, lire le rapport |
| `pret_a_blanc` | passage à blanc réussi, rien publié | lire le rapport et le commit local |
| `rien_a_faire` | aucune différence avec l'état en ligne | rien |
| `deja_en_ligne` | le commit poussé est déjà en ligne | rien |
| `gel` | gel ou retenue en cours (transitoire) | rien, attendre la fin du gel |
| `main_non_deploye` | le dernier commit de `main` n'est pas en ligne (transitoire) | mise en ligne manuelle `deploy:local` d'abord |
| `motif_a_decider` | désistement d'une personne connue sans motif | `npm run veille -- decider` |
| `date_au_mois` | date de source donnée au mois seulement | décider la date |
| `garde_volume` | trop de changements | relire le rapport |
| `conflit_import` | conflit avec une décision existante | relire, trancher |
| `identite_ambigue` | identité ambiguë | écrire la ligne de `correspondances.yaml` à la main |
| `volume_anormal` | volume amont anormal | vérifier la source |
| `programme_signale` | programme signalé par la source | examiner, rien n'est publié |
| `controle_rouge` | contrôle du dépôt rouge, ou exception | lire le rapport et le journal |
| `doute_agent` | relecture des agents non concluante | lire le rapport local |
| `source_inaccessible` | source inaccessible (transitoire) | rien, nouvel essai |
| `ci_rouge` | `ci:local` en échec, rien poussé | lire le rapport |
| `perimetre_ecriture` | une écriture de l'automate sort du périmètre autorisé | lire le diff du commit local |
| `main_a_avance` | `main` a avancé pendant le passage (transitoire) | rien, nouvel essai |
| `push_echec` | push refusé (transitoire) | sonde `--sonde-push` |
| `verrou_pris` | un autre passage ou `ci:local` en cours (transitoire) | attendre |
| `config_absente` | configuration locale absente ou invalide (transitoire) | refaire l'étape concernée de la mise en service |
| `serveur_non_restreint` | clé automatique non restreinte côté serveur | reprendre les étapes 3 et 4 de la mise en service |
| `deploiement_refuse` | déploiement refusé avant activation (transitoire) | lire `deploy:auto -- etat` |
| `smoke_echec_retour_ok` | fumée en échec, retour arrière réussi | examiner puis `--reprendre` |
| `smoke_echec_retour_ko` | fumée en échec et retour arrière en échec | intervention immédiate, voir « Retour arrière depuis le Mac » |
| `hors_ligne` | réseau indisponible (transitoire) | rien |
| `desactive` | interrupteur d'arrêt posé (sans alerte) | retirer l'interrupteur pour reprendre |
| `reprise_a_blanc` | commit déjà poussé, marqueur d'activation absent : mode à blanc, mise en ligne en attente (transitoire) | recréer le marqueur, ou mise en ligne manuelle `deploy:local` |

### Mise en service (session principale, accord d'Erwan)

Faite par la session principale, jamais par l'exécuteur de la phase. Avant chaque écriture serveur, la commande et son retour arrière sont montrés à Erwan et attendent son accord explicite. Les valeurs ci-dessous sont factices (`exemple.invalid`).

1. Clé automatique : `ssh-keygen -t ed25519 -N '' -C rtp-deploy-auto -f ~/.config/rtp/rtp-deploy-auto`, puis `chmod 600 ~/.config/rtp/rtp-deploy-auto`.
2. `~/.config/rtp/deploiement-auto.env` (0600) : `RTP_CIBLE=production`, les mêmes clés que `deploiement.env` (hôte `exemple.invalid`), `RTP_CLE` vers la clé automatique et `RTP_URL` (la fumée n'est jamais sautée en automatique).
3. Mise à jour du script serveur : `ops/installer-serveur.sh --etape commande --appliquer`, puis contrôle `grep -x '# rtp-capacite: auto-v1' /usr/local/sbin/rtp-deploy-command`. Retour arrière : réappliquer l'étape commande depuis le commit précédent.
4. Seulement ensuite : `ops/installer-serveur.sh --etape utilisateur --cle-publique <clés actuelles> --cle-publique-auto ~/.config/rtp/rtp-deploy-auto.pub --appliquer`. La ligne posée est `restrict,command="/usr/local/sbin/rtp-deploy-command --auto" ssh-ed25519 <clé factice> rtp-deploy-auto`. Retour arrière : la même commande sans `--cle-publique-auto`.
5. `npm run deploy:auto -- etat` doit afficher `restreint=oui`.
6. Jeton de l'agent : Erwan tape `claude setup-token`. `~/.config/rtp/agent-claude.env` (0600) : `RTP_CLAUDE=/usr/local/bin/claude`, `CLAUDE_CODE_OAUTH_TOKEN=<jeton>` (ou la variante clé d'API `ANTHROPIC_API_KEY=<clé>`), `RTP_AGENT_BUDGET_USD=<montant>`. Puis `npm run veille -- auto --sonde-agent` doit afficher `agent : ok`.
7. Moyen de push, créé avec Erwan : clé de déploiement GitHub en écriture limitée au dépôt, ou jeton fin `contents: write` sur ce seul dépôt. `~/.config/rtp/push-auto.env` (0600) : `RTP_PUSH_DEPOT`, `RTP_PUSH_CLE` et `RTP_PUSH_KNOWN_HOSTS`, ou `RTP_PUSH_JETON`. Puis `npm run veille -- auto --sonde-push` doit afficher `push : ok`.
8. `npm run veille -- installer` (régénère le lanceur qui enchaîne `auto`), puis `launchctl kickstart gui/$(id -u)/fr.reveletonprog.veille`.
9. Au moins deux passages à blanc, lus avec Erwan : alerte `pret_a_blanc`, rapport, diff du commit local dans `~/.cache/rtp/veille/auto`.
10. En dernier, avec l'accord d'Erwan : `touch ~/.config/rtp/auto-actif`, puis `npm run veille -- auto --reprendre` (le jeu vu à blanc est retraité et publié). Après le premier push, vérifier `gh run list --status waiting` (le déploiement GitHub ne doit pas rester en attente d'approbation sans raison).

Après un échec de mise en ligne d'un commit déjà poussé, la garde `main_non_deploye` bloque l'automate : faire d'abord la mise en ligne manuelle `deploy:local`.

Ne jamais réinstaller un script serveur sans le marqueur `# rtp-capacite: auto-v1` tant qu'une ligne `--auto` existe dans `authorized_keys` ; l'installateur le refuse et `--verifier` le signale.

### Interrupteur d'arrêt

`touch ~/.cache/rtp/veille/auto-desactive` arrête tout passage avant toute action, sans alerte. Retirer le fichier pour reprendre. Retirer `~/.config/rtp/auto-actif` ramène au mode à blanc.

### Retirer la clé automatique

1. Poser l'interrupteur : `touch ~/.cache/rtp/veille/auto-desactive`.
2. `rm ~/.config/rtp/auto-actif`.
3. Réappliquer l'étape utilisateur sans la clé automatique : `ops/installer-serveur.sh --etape utilisateur --cle-publique <clés actuelles> --appliquer`. La ligne `--auto` disparaît ; contrôler sur le serveur que `authorized_keys` n'en contient plus.
4. Supprimer `~/.config/rtp/rtp-deploy-auto`, `~/.config/rtp/rtp-deploy-auto.pub`, `deploiement-auto.env`, `push-auto.env` et `agent-claude.env`.
5. Révoquer le moyen de push sur GitHub et le jeton de l'agent (depuis le compte, pour celui de `claude setup-token`).
6. L'automate reste désactivé par l'interrupteur. Pour arrêter aussi la veille : `npm run veille -- retirer`, puis `launchctl print gui/$(id -u)/fr.reveletonprog.veille` pour vérifier qu'elle n'est plus chargée.

Tant que la ligne `--auto` n'a pas disparu d'`authorized_keys` (étape 3), ne jamais réinstaller un script serveur sans le marqueur `# rtp-capacite: auto-v1` ; l'installateur le refuse et `--verifier` le signale.

### Pannes

- `hors_ligne` : reprise seule au passage suivant.
- `verrou_pris` : un `ci:local` ou un `deploy:local` manuel est en cours ; attendre sa fin.
- `main_a_avance` : rien à faire, nouvel essai au passage suivant.
- Phase `poussee_en_cours` (lue par `npm run veille -- etat`) : intention écrite avant chaque push, avec le commit ; un passage interrompu (Mac en veille, arrêt brutal) la laisse en place et le passage suivant la résout seul : commit présent sur `origin/main`, reprise de la mise en ligne comme `pousse_non_deploye` ; commit absent, intention nettoyée. Un passage bloqué par le verrou n'écrit jamais l'état de l'automate : il compte ses reports à part et alerte au troisième.
- `pousse_non_deploye` qui dure : `npm run veille -- etat` et `npm run deploy:auto -- etat`, puis mise en ligne manuelle si besoin.
- `retenu` après une fumée en échec : examiner la version en ligne, puis `npm run veille -- auto --reprendre`.
- Arrêt définitif (`ci_rouge`, `controle_rouge`, `doute_agent`, par exemple après un e2e instable ou un `npm ci` en échec réseau) : corriger la cause, puis `npm run veille -- auto --reprendre` fait retraiter le jeu courant.
- `serveur_non_restreint` : reprendre les étapes 3 puis 4 de la mise en service.
- Worktree `~/.cache/rtp/veille/auto` abîmé : `git worktree remove --force ~/.cache/rtp/veille/auto` ; le passage suivant le recrée.
- Coût de l'agent : lu dans le rapport local de `~/.cache/rtp/veille/rapports-auto/` ; ajuster `RTP_AGENT_BUDGET_USD`.

### Questions à confirmer par Erwan

Sept réponses par défaut sont appliquées, à confirmer :

1. Retenue de l'automate du 10 décembre 2026 00:00 au 15 décembre 2026 à 23:59 (autour de l'import de décembre).
2. Contenu des alertes : comptes, code, SHA court, identifiants de fiche, chemin du rapport.
3. `aucun_site` et programme signalé : arrêt avec alerte, rien n'est publié.
4. Désistement sans motif d'une personne connue : réservé à Erwan.
5. Deux voies d'authentification de l'agent : jeton `claude setup-token` ou clé d'API.
6. Moyen de push : clé de déploiement ou jeton fin.
7. Livré désactivé : marqueur `auto-actif` créé en dernier.

Écarts connus : nom de tri de Lagarde, type de source de Retailleau. Risque résiduel accepté : la clé automatique n'a pas de phrase de passe et permet d'activer un envoi arbitraire en production ; elle est limitée par `--auto` côté serveur et chaque publication déclenche une alerte.

### Règle pour les agents

Un agent interactif ne crée ni `auto-actif` ni la clé, ne lance pas `deploy:auto -- deployer`, ne modifie aucun fichier de `~/.config/rtp/`. Il peut lancer `npm run veille -- etat` et `npm run deploy:auto -- etat` seulement si Erwan le demande.

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure : voir « Retrait d'urgence d'une mesure (moins d'une heure) » juste en dessous. Pendant un gel des scrutins : « Gel des scrutins et retrait d'urgence ».

### Retrait d'urgence d'une mesure (moins d'une heure)

**Chemin à suivre depuis le 2026-11-22 : le Mac.** Le déploiement GitHub est en sommeil (variable `DEPLOY_CIBLE` retirée à l'ouverture) : `gh workflow run rollback.yml` et l'approbation « Review deployments » décrites plus bas ne déploient plus rien. Équivalences, à lancer par Erwan dans son terminal (« CI et déploiement depuis le Mac ») :

| Étape | Commande |
|---|---|
| Voie 1, retour arrière | `npm run deploy:local -- retour` (version précédente) ou `npm run deploy:local -- retour <sha>` ; phrase « retour en production precedente » ou « retour en production <sha7> » (avec « malgre retrait » à la fin si la version visée remettrait en ligne un contenu retiré en urgence) |
| Voies 2 et 3, après `retirer` | commit, push sur `main`, `npm run ci:local` (13 à 16 minutes sur une machine chargée), puis `npm run deploy:local` et la phrase « deployer en production <sha7> » |
| Pendant un gel des scrutins | ajouter `--urgence --justification "<motif d'au moins 20 caractères>"` à `deploy:local` ou à `deploy:local -- retour` (aucun retour automatique pour un retrait d'urgence) |

Exercice du 2026-11-21 (plus bas) : 53 min 45 s par la voie 2 sur ce chemin, retour arrière réel en 21 s. Le texte qui suit garde la description du chemin GitHub comme historique.

Objectif : une mesure publiée qui ne doit plus l'être (absence de source, erreur factuelle, demande fondée) disparaît du site **en moins d'une heure** entre la décision et la page servie. Trois voies, à prendre dans cet ordre. Dans tous les cas : noter l'identifiant de la mesure (`<candidat>/<slug>`) et l'heure de début.

**Voie 1, retour arrière (moins de 2 minutes).** À prendre si la version précédente ne contient pas la mesure. Elle ne passe ni par la CI ni par `main` (cible `essai` tant que le site n'est pas ouvert) :

```bash
gh workflow run rollback.yml -f cible=production
gh workflow run rollback.yml -f cible=production -f version=<sha>
```

Erwan approuve dans l'interface (Environment `production`), voir « Retour arrière ». Mesures de 08-13 : 56 s et 70 s au total, approbation comprise (vue à +48 s et +59 s), exécution de 8 s et 11 s. Un retour arrière ne change pas `main` : le déploiement suivant remettrait la tête de `main`, donc la mesure. Faire aussi la voie 2 ou 3 dans la foulée.

**Voie 2, retirer la mesure.** La commande repasse la mesure à `brouillon` et vérifie que tout le corpus de production reste sans erreur :

```bash
npm run relecture -- retirer <candidat>/<slug> --relecteur <nom> --dry-run
npm run relecture -- retirer <candidat>/<slug> --relecteur <nom>
```

*Piège de la couverture.* Si c'est la **seule** mesure publiée du candidat sur ce thème, la case de couverture « mesures » ne serait plus vraie et la CI passerait au rouge (`EQUITE_COUVERTURE_INCOHERENTE`). La commande refuse alors (code 1, rien n'est écrit), explique le piège et imprime les deux lignes à copier, la première avec les identifiants des sources du candidat :

```bash
npm run relecture -- retirer <candidat>/<slug> --case non_precise --sources <id-source,id-source> --relecteur <nom>
npm run relecture -- retirer <candidat>/<slug> --case programme_non_publie --relecteur <nom>
```

Choisir entre les deux est une décision éditoriale d'Erwan : `non_precise` dit « non précisé dans les sources consultées » (les sources nommées doivent être des sources du candidat), `programme_non_publie` dit que le candidat n'a pas publié de programme sur ce thème. La commande ne choisit jamais seule. Avec `--case`, la mesure et la case changent dans la même opération, avec `verifie_le` et `verifie_par` à la date et au nom du relecteur (`--relecteur`, `--date`). Si le candidat a d'autres mesures publiées sur le thème, `--case` est refusé comme inutile.

*Erreur sans rapport.* `retirer` exige zéro erreur de validation de production sur tout le corpus après l'écriture. Une erreur déjà présente et sans rapport avec la mesure la bloque : la sortie nomme chaque erreur (fichier, ligne, code) et dit que les fichiers sont restaurés. La CI serait rouge de la même façon, donc aucun déploiement ne passerait : prendre la voie 1 pour retirer la mesure tout de suite, puis corriger l'erreur nommée dans un commit à part (voir « Lire un diagnostic ») et refaire la voie 2 ou 3.

**Voie 3, repli le plus rapide, sans décision éditoriale.** Le thème entier repasse à `brouillon` : sa page disparaît de la production, aucune mesure ni case n'est touchée.

```bash
npm run relecture -- retirer --theme <id> --relecteur <nom> --dry-run
npm run relecture -- retirer --theme <id> --relecteur <nom>
```

`config/publication.yml` peut garder le thème : un thème listé mais non publié n'est qu'un avertissement (`PUBLICATION_THEME_OUVERT_NON_PUBLIE`). Même validation de production que la voie 2, donc même parade en cas d'erreur sans rapport.

**Après l'écriture (voies 2 et 3).**

1. Relire le diff (`git diff`), commiter, pousser sur `main`. La commande rappelle ces étapes et le journal `relecture/journal.jsonl` reçoit une ligne `retirer`, à commiter avec le retrait.
2. Approuver le déploiement dès que le run le demande (« Review deployments »). **Rejeter tout déploiement encore en attente** : approuvé plus tard, il pourrait remettre en ligne ce qu'on retire. Un run en attente retient le groupe `deploy-production`.
3. Contrôler : `/version.json` sert le commit du retrait et la page du thème ne montre plus la mesure.
4. **Pendant un gel des scrutins**, `deploy` est sauté : après le push, relancer avec la case d'urgence cochée et une justification écrite d'au moins 20 caractères (la commande le rappelle quand la date de Paris tombe dans une fenêtre) :

```bash
gh workflow run ci.yml --ref main -f retrait_urgence=true -f justification="Retrait de la mesure <candidat>/<slug> : <motif>"
gh workflow run rollback.yml -f cible=production -f retrait_urgence=true -f justification="<motif du retour arrière>"
```

**À consigner ensuite.** Une issue GitHub datée (heure UTC de début et de fin, identifiant de la mesure, voie utilisée, commit, run, motif), sans donnée personnelle ; la ligne du journal de relecture est déjà dans le commit.

**Remettre la mesure en ligne.** Corriger le texte ou la source par une modification manuelle du YAML, validée par Erwan ; puis `npm run relecture -- marquer mesure <candidat>/<slug> --relecteur <nom>` et `npm run relecture -- publier --theme <id> --relecteur <nom>`, avec `--case-mesures <candidat>` si la case de couverture a été changée par `--case` (elle repasse à `mesures` dans la même opération, sans modification à la main) (voir « Relire un thème » et « Publier un thème »), pull request, approbation.

**Budget de temps.** Cible : moins d'une heure. Chaîne de livraison mesurée sur les trois derniers runs de `main` dont le job « Déployer » a réussi (2026-11-10, runs 42909517138, 42913976301 et 42917023412, cible `essai`) ; l'approbation d'Erwan est la seule attente humaine :

| Étape | Mesuré (minimum à maximum) | Budget |
|---|---|---|
| Décision, puis `retirer` en essai à blanc et en réel (la commande : 1,2 s sur le vrai corpus, 09-06) | quelques secondes pour la commande | 5 min |
| Relire le diff, commiter, pousser | non mesuré | 2 min |
| CI jusqu'à la fin de « Construire la build de déploiement » (le job navigateur est le plus long) | 409 s à 518 s (6 min 49 s à 8 min 38 s) | 9 min |
| Approbation d'Erwan | 205 s à 446 s (3 min 25 s à 7 min 26 s) sur ces runs, mais elle dépend de lui | 15 min |
| Job « Déployer » après l'approbation (envoi, activation, test de fumée) | 19 s à 33 s | 1 min |
| **Total** | de la création du run à la fin du déploiement : 668 s à 920 s (11 min 8 s à 15 min 20 s) | **32 min** |

Hors approbation, la chaîne mesurée prend 436 s à 537 s (7 min 16 s à 8 min 57 s). Le budget de 32 minutes laisse environ 28 minutes de marge, de quoi relancer une CI en échec une fois. Le retour arrière (voie 1) tient en moins de 2 minutes, approbation comprise. Le chiffre de l'exercice chronométré sur une vraie mesure publiée sera inscrit ici par 09-11 : aucune mesure n'est publiée avant la fin de la relecture.

**Exercice du 2026-11-21 (plan 09-11, cible `essai`, chemin local de la phase 9.2).** Mesure retirée : `natacha-polony/sante-medicaments-essentiels-production`, seule mesure publiée de la candidate sur le thème santé (voie 2 avec `--case non_precise`, décision d'Erwan du 2026-11-20). Chronologie UTC : début 20:56:45 ; premier `retirer` sans `--case` refusé avec les deux lignes à choisir (20:56:51) ; retrait écrit et validé (20:57:04) ; poussé (20:57:18) ; `ci:local` rouge à 21:13:23 ; correctif poussé à 21:21:00 ; `ci:local` vert à 21:36:01 ; déploiement par Erwan de 21:49:19 à 21:50:18 ; mesure absente de l'hôte et case « Non précisé dans les sources consultées » vérifiées à 21:50:30. **Total : 53 min 45 s**, dont environ 13 minutes d'attente du geste d'Erwan (40 minutes sans elle). Ce qui a ralenti : (1) un défaut de la procédure, trouvé par l'exercice : le contrôle du corpus pilote (`PILOTE_INCOHERENCE`, `scripts/lib/pilote.ts`) comptait la mesure repassée en brouillon, donc `ci:local` était rouge et `deploy:local` aurait refusé le retrait ; corrigé (commit `7f13a99` : sur un thème publié, seules les mesures publiées comptent), soit un second `ci:local` de 15 minutes ; (2) `ci:local` complet à chaque commit (13 à 16 minutes sur une machine chargée), contre 7 à 9 minutes pour la CI GitHub ; (3) un premier lancement de `deploy:local` pendant que `ci:local` tournait déjà, refusé (un seul `ci:local` à la fois). Remise en ligne par la voie 1 : `npm run deploy:local -- retour`, phrase `retour essai precedente`, de 21:55:29 à 21:55:50 (21 s), premier retour arrière réel par le chemin local ; puis `git revert` du commit d'exercice, contenu identique à l'octet à la publication. Corrections faites à la suite : messages « étapes suivantes » de `publier` et `retirer` (ils citaient encore le bouton d'approbation de GitHub). Leçon : sur le chemin local, compter environ 35 minutes hors attente humaine pour un retrait par la voie 2 (un `ci:local` de 15 minutes, la build et le déploiement), et préférer la voie 1 quand la version précédente ne contient pas la mesure.

### Build CI en échec
Ouvrir l'exécution du workflow `CI`. Trois jobs tournent en parallèle :
- `verifier` : lire l'étape en rouge (`migrate`, `validate`, `ids.lock`, `check`, `test` ou `build`). Les étapes s'arrêtent à la première erreur ; la sortie de `npm run validate` nomme le fichier et la règle violée. Reproduire en local avec la même commande.
- `e2e` : tests navigateur ; télécharger l'artefact `playwright-report`, ou reproduire avec `npm run e2e` (voir « Tests navigateur (e2e) »).
- `secrets` : gitleaks a trouvé un secret dans l'historique. Ne rien pousser de plus, **révoquer le secret** chez son émetteur, puis traiter l'historique. Faux positif confirmé : ajouter une exception ciblée (motif exact, jamais un dossier entier) dans `.gitleaks.toml`.

### Droit de réponse

Cadre : article 1-1 de la loi pour la confiance dans l'économie numérique (LCEN), III, et son décret d'application n° 2007-1527 du 24 octobre 2007, tels que lus le 2026-11-10 sur Légifrance (`docs/RISQUES-JURIDIQUES.md`, R2). Le droit de réponse en ligne ne repose plus sur l'ancien IV de l'article 6, même si les visas du décret le citent encore : ne pas « corriger » vers lui. Procédure :

1. **Comment la demande arrive.** Par courriel, à l'adresse de contact de `config/site.yml` (alias dédié, jamais une adresse personnelle ; aucune adresse postale n'est publiée). Le décret admet la lettre recommandée avec accusé de réception ou tout moyen prouvant l'identité de l'auteur de la demande et la réception : le courriel reçu, daté, avec ses en-têtes, sert de preuve de réception. Elle est recevable dans un délai de trois mois à compter de la mise à disposition du contenu visé.
2. **Ce que la demande doit contenir.** Les références du contenu visé et ses conditions d'accès, le nom de l'auteur du contenu s'il est indiqué, la nature du contenu, les passages contestés et le texte de la réponse demandée.
3. **Délais et forme.** Accuser réception le jour même. La réponse tient en **200 lignes** au plus. Elle est insérée au plus tard trois jours après réception de la demande, dans des conditions similaires à celles du contenu visé, présentée comme une réponse du demandeur, et reste accessible aussi longtemps que le contenu d'origine. Le refus d'insérer expose, tel que lu, à une amende de 3 750 euros.
4. **Contenu retiré ou corrigé.** Si le contenu contesté est retiré ou corrigé dans les trois jours de la réception, il n'y a pas à insérer la réponse (article 5 du décret, lecture à confiance moyenne : à faire relire par le juriste de l'après-ouverture). Retirer une mesure se fait par « Retrait d'urgence d'une mesure (moins d'une heure) » ; corriger un texte reste une modification manuelle validée par Erwan puis une nouvelle relecture.
5. **Suivi.** Ouvrir une issue GitHub qui trace la date de réception, la date d'insertion et la décision, sans donnée personnelle du demandeur.
6. **Erreur factuelle.** Une demande de rectification d'erreur factuelle suit la procédure de correction habituelle (sources, relecture), pas celle du droit de réponse.

Limite connue : les réponses partent de la boîte personnelle de l'éditeur tant qu'il n'y a pas de vraie boîte pour l'alias (note de risques, acceptée par la signature). Une demande perdue (redirection en panne, courriel filtré) ferait courir le délai de trois jours sans le savoir.

## Restauration

Contenu du site :

- Le contenu est sauvegardé par Git (dépôt GitHub distant) : cloner le dépôt suffit.
- Les binaires d'archives sont dans le dépôt privé `reveleTonProg-archives` (à cloner à côté si besoin).
- Le site se reconstruit entièrement avec `npm ci && npm run build` ; une version en ligne se remet par « Retour arrière » ou par un nouveau déploiement.

Configuration du serveur (ADR-058) :

- `rtp-sauvegarder` (copie de `ops/sauvegarder-config.sh`, cron `/etc/cron.d/rtp-sauvegarde` chaque jour à 02:45 UTC) écrit `/root/rtp-sauvegardes/<AAAA-MM-JJ>.tar.gz` (root, 0600, dossier 0700, les 6 dernières gardées). L'archive contient le Caddyfile, le fichier de composition et sa surcharge, `.env`, `sites.d/`, `/etc/cron.d/rtp-*`, `/etc/rtp/`, le `authorized_keys` de `deploy`, `/usr/local/sbin/rtp-*`, les clés d'hôte publiques (jamais les privées) et les deux `.historique`, plus `MANIFESTE.txt` (sha256 de chaque fichier) et `liens.txt` (cible des liens `current`). Ni le contenu du site (reconstruit depuis Git) ni les certificats (Caddy les redemande).
- Copie sur le Mac (modèle tiré : le serveur ne détient aucun identifiant sortant), dans un dossier 0700 hors de tout dépôt : `scp keel-vps:/root/rtp-sauvegardes/<AAAA-MM-JJ>.tar.gz ~/Sauvegardes/reveletonprog/`.
- Les deux fichiers secrets que le dépôt ne peut pas recréer, `/opt/vaultwarden/.env` (empreintes bcrypt) et `/etc/rtp/*.env` (adresses de ping), sont aussi dans Vaultwarden, avec les mots de passe en clair.
- Test de restauration : `ssh keel-vps /usr/local/sbin/rtp-tester-restauration` (aussi lancé par le cron `/etc/cron.d/rtp-restauration` le 1er du mois à 11:00 UTC). Sur des copies jetables, il extrait la dernière archive, vérifie les sha256 du manifeste, compare chaque fichier à celui en service, lance `ops/installer-serveur.sh --verifier` sur l'arbre restauré (aucun `[a faire]` permis) et `ops/valider-caddy.sh` (avec et sans variables), puis pingue `restauration-mensuelle`. Sortie : une ligne JSON (`"resultat":"echec"` et l'étape en cause en cas d'échec, sans ping). Rafraîchir `/opt/rtp/depot` avant (étape `depot`), sinon l'installateur du test est celui d'une ancienne version.
- Remettre un fichier : extraire l'archive dans un dossier jetable, puis le réinstaller par l'installateur (fichiers venus du dépôt) ou l'écrire sur place (Caddyfile, `.env` : `cat <copie> > <fichier>`, jamais `mv`, règle d'inode).
- Sauvegardes automatiques Hetzner : réponse d'Erwan notée dans le résumé de 08-11 (D-15 accepte la reconstruction par le dépôt plus le test mensuel). Un instantané manuel existe depuis le 2026-11-08.

Reconstruire le serveur depuis le dépôt (machine neuve ou configuration perdue), chaque écriture approuvée, dans cet ordre :

1. Copie du dépôt : `git archive --format=tar.gz HEAD ops deploy | ssh keel-vps 'mkdir -p /opt/rtp/depot && tar -xz -C /opt/rtp/depot'`.
2. `--appliquer --etape sauvegarde-caddy`, puis `montages`, puis `env-caddy` avec les deux empreintes de Vaultwarden sur l'entrée standard.
3. Lecture : `docker compose config -q` dans `/opt/vaultwarden`, puis `ops/valider-caddy.sh` avec `RTP_AJOUTER_IMPORT=1 RTP_AVEC_SANS_VARIABLES=1`.
4. `--etape import-caddy`, puis la recréation du conteneur (« Serveur : installer et vérifier »).
5. `--etape utilisateur,commande --cle-publique <clé publique de déploiement>`.
6. `--etape battement` (fichier `battement.env` de Vaultwarden sur l'entrée standard), `--etape sauvegarde`, `--etape restauration-mensuelle` (ligne `HC_RESTAURATION=…`).
7. `--etape site-public` (après un premier déploiement de production) et, tant que l'hôte technique existe, `--etape site-essai`, puis `caddy validate` et `caddy reload` dans le conteneur.
8. Vérifier : `--verifier` sur toutes ces étapes (aucun `[a faire]`), `rtp-tester-restauration`, puis un déploiement approuvé. Si la clé d'hôte SSH du serveur a changé, remplacer `DEPLOY_KNOWN_HOSTS` dans l'Environment `production`, ligne lue par le canal SSH de confiance, jamais par un scan.

## Monitoring

Depuis l'ouverture du 2026-11-22, le battement, la sonde externe et le test de fumée de `deploy:local` visent le site public `https://reveletonprog.fr`, sans aucun identifiant (plus de `basic_auth` sur l'hôte public).

Healthchecks.io (compte d'Erwan) reçoit des pings et alerte quand un contrôle reçoit `/fail` ou ne reçoit plus rien ; il ne sonde aucune URL (ADR-058). L'intégration Telegram native (HealthchecksBot) est branchée sur chaque contrôle : un message de panne, puis un message de rétablissement au premier ping de succès suivant. Les adresses de ping sont des secrets : `/etc/rtp/battement.env`, `/etc/rtp/restauration.env`, secret `SONDE_PING_URL` de l'Environment `sonde`, copies dans Vaultwarden.

| Contrôle | Alimenté par | Période | Grâce | Alerte quand | Première commande |
|----------|--------------|---------|-------|--------------|-------------------|
| `vps-battement` | `rtp-battement`, cron toutes les 5 min | 5 min | 10 min | plus aucun ping : machine tombée, conteneur Caddy arrêté, cron mort ou contenu cassé | `ssh keel-vps 'docker ps --filter name=caddy; journalctl -t rtp-battement -n 5 --no-pager'` |
| `vps-disque-85` | `rtp-battement` | 5 min | 10 min | `/fail` : disque le plus plein à 85 % ou plus | `ssh keel-vps 'df -h; docker system df'` |
| `vps-disque-92` | `rtp-battement` | 5 min | 10 min | `/fail` à 92 % (le déploiement refuse déjà au-delà, code 75) | même commande, puis libérer de la place sans toucher aux autres sites |
| `vps-certificat` | `rtp-battement`, une fois `RTP_HOTE` posé | 5 min | 10 min | `/fail` : certificat servi qui expire dans moins de 14 jours | `ssh keel-vps 'docker logs --since 24h caddy 2>&1 \| grep -ci acme'` puis lire les messages ACME |
| `sonde-externe` | `.github/workflows/sonde.yml`, toutes les 10 min | 1 jour | 1 jour | environ 2 jours sans ping de succès : page d'accueil sans le marqueur, `/version.json` illisible, hôte injoignable | `gh run list --workflow sonde.yml --limit 3`, puis `gh run view <id> --log-failed` |
| `restauration-mensuelle` | `rtp-tester-restauration`, le 1er du mois | planning `0 11 1 * *` UTC | 3 jours | test du mois manqué ou en échec | `ssh keel-vps 'journalctl -t rtp-restauration -n 20 --no-pager'` |
| `veille-candidatures` | `npm run veille`, launchd sur le Mac à 8 h et 19 h | 12 h | 2 jours | plus de ping de succès, ou `/fail` : veille en panne ou Mac éteint deux jours (jamais pour un changement de candidature) | `npm run veille -- etat` |

- La sonde ne pingue qu'en cas de succès ; en cas d'échec elle envoie seulement la raison au journal du contrôle (`/log`). Le battement fait tous ses contrôles, puis envoie un ping par contrôle dans un ordre fixe ; sa ligne JSON (journal `rtp-battement`) ne contient ni adresse ni identifiant. Chaque appel externe est borné par `timeout` (`docker inspect` et `openssl s_client` 15 s, requêtes HTTPS 15 s, pings 60 s) et la ligne cron passe par `flock -n /run/rtp-battement.lock` : pendant une panne de Docker ou de Caddy, un passage encore en cours fait sauter le suivant au lieu de s'empiler (revue de code WR-05).
- Alertes simulées, sans remplir le disque ni toucher au certificat (elles envoient de vraies alertes : à faire approuver comme une écriture) : `ssh keel-vps 'RTP_SEUIL1=1 /usr/local/sbin/rtp-battement'`, puis `RTP_SEUIL2=1`, puis `RTP_CERT_JOURS=9999` (une fois `RTP_HOTE` posé), et un passage normal pour le rétablissement. `RTP_HC_SIMULATION=1` affiche le signal prévu pour chaque contrôle sans rien envoyer.
- **Sonde externe à 1 jour (écart à OPS-01).** OPS-01 demandait une alerte Telegram après 3 échecs consécutifs de la sonde externe. La planification de GitHub ne tient pas un rythme de 10 minutes : elle glisse et saute des exécutions, ce qui a produit de fausses alertes. Erwan a réglé la période et la grâce du contrôle `sonde-externe` à 1 jour chez Healthchecks le 2026-11-10 ; le workflow tourne toujours toutes les 10 minutes mais ne déclenche plus d'alerte qu'après environ 2 jours sans succès. L'alerte rapide du contenu est le battement du VPS (HTTPS, toutes les 5 minutes, grâce de 10 minutes : `vps-battement`, `vps-certificat`). Aucun déclencheur externe n'est prévu pour l'instant. Erwan a accepté cet écart par écrit le 2026-11-11 (plan 09-09) : il est inscrit dans `08-VERIFICATION.md`.
- GitHub peut retarder une exécution planifiée de quelques minutes, et suspend la planification après 60 jours sans activité dans le dépôt : `sonde-externe` passe alors en panne (interrupteur de l'homme mort). Relancer avec `gh workflow enable sonde.yml`, puis `gh workflow run sonde.yml`.
- Avant le DNS, `vps-battement` lit la version d'essai sur le disque (`/srv/reveletonprog/essai/current/version.json`) et `vps-certificat` ne reçoit rien. Après le DNS (08-15), `RTP_HOTE` et les identifiants de la sonde dans `battement.env` font passer le battement en HTTPS à travers Caddy.

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
- Lancer `rtp-tester-restauration` (`ssh keel-vps /usr/local/sbin/rtp-tester-restauration`) et noter le résultat dans RETROSPECTIVE.md (ligne JSON, contrôle `restauration-mensuelle` vert) ; tirer la dernière archive de configuration sur le Mac (« Restauration »).

## Contacts

- Hébergeur VPS : Hetzner — compte Erwan
- DNS : domaine à acheter (open question)
