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

`npm run e2e` construit la fixture (`corpus-m1`) puis le vrai corpus en mode preview, sert chaque dossier avec `e2e/serveur.ts` (compression gzip comme Caddy) et lance Playwright. Les fichiers de `e2e/` prouvent : fonctionnement sans JS et changement de niveau (`sans-js`), parcours au clavier (`clavier`), WCAG 2.2 AA par axe (`axe` : échec sur toute violation d'impact `serious` ou `critical`, les impacts `minor` et `moderate` ne bloquent pas ; même seuil annoncé sur la page Méthode), contraste (`contraste`), texte agrandi à 160 % (`texte`), `prefers-reduced-motion` (`mouvement`), aucun tiers, cookie ni clé `localStorage` hors réglages (`vie-privee`), et le temps de chargement à froid de la page la plus lourde sur deux connexions lentes simulées par CDP (`4g`, Chromium uniquement) : moins de 1 s avec 150 ms de latence par requête et 1,6 Mbit/s, et moins de 1 s aussi en « Slow 4G simulé », l'équivalent DevTools du « Slow 4G » de Lighthouse (562,5 ms par requête, 1,44 Mbit/s). Profils et budgets : `src/lib/profil-4g.ts`, repris tels quels par la page Méthode. Chaque mesure ouvre un contexte de navigateur neuf (cache et connexions neufs) ; le serveur local n'a ni DNS ni TLS, une mesure réelle derrière Caddy peut être plus lente.

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

Relevé du 2026-11-09 (08-14, commit servi `0949633`, identique avant et après ; page la plus lourde servie `/methode/`, 11 917 octets gzip, servie en zstd, HTML servi identique octet pour octet au dist local ; aucune page thème n'est encore publiée sur essai, les pages thème en préparation restent mesurées sur le serveur local) : 345 / 300 / 304 ms à 150 ms de latence par requête et 716 / 722 / 723 ms, soit 723 ms au plus en « Slow 4G simulé », aucune réponse 401 ; Lighthouse 13.0.3 (mobile, simulé, médiane de trois passages) : FCP 791 ms, LCP 791 ms, Speed Index 812 ms (passages : Speed Index 1 671, 812 et 770 ms), document de 13 125 octets transférés en HTTP/2. Écart : Lighthouse recalcule le chargement à partir d'une trace sans ralentissement, compte 150 ms par aller-retour, y compris l'ouverture de la connexion chiffrée, ralentit le processeur 4 fois et mesure l'affichage ; le test du site ajoute 562,5 ms par requête sans ralentir le processeur et mesure la fin de l'événement `load`. Chiffres publiés sur la page Méthode depuis `MESURE_SERVEUR_4G` (`src/lib/profil-4g.ts`) ; une nouvelle mesure remplace la constante, ce paragraphe et la phrase du README, sans changer un budget.

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
| `CONTACT_PROVISOIRE` | lien `mailto:` vers un TLD réservé, `.invalid`, `.test`, `.example` ou `.localhost` (contact de `config/site.yml` pas encore remplacé) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : renseigner un vrai contact |
| `CSP_ABSENTE` | page sans meta CSP, avec plusieurs, ou meta hors de `<head>` (le navigateur l'ignore) | vérifier `security.csp` dans `astro.config.mjs` et la mise en page |
| `CSP_TROP_PERMISSIVE` | jeton de la CSP autre que `'self'`, `'none'` ou une empreinte sha256 (`'unsafe-inline'`, `*`, `https:`…), y compris dans une directive répétée | retirer le jeton ; ne jamais affaiblir la politique pour faire passer un script |
| `SCRIPT_SANS_EMPREINTE` | empreinte d'un script en ligne absente de la directive effective (`script-src-elem`, sinon `script-src`, sinon `default-src`) | reconstruire : les empreintes sont calculées au chargement de `astro.config.mjs` par `src/lib/csp-empreintes.ts` |
| `STYLE_SANS_EMPREINTE` | empreinte d'un `<style>` absente de la directive effective (`style-src-elem`, `style-src`, `default-src`) | reconstruire ; vérifier `security.csp` (Astro hache les styles qu'il écrit) |
| `CANONIQUE_ABSENT` | page de production sans `<link rel="canonical">` ou avec plusieurs | vérifier `Base.astro` (un seul lien, production seulement) |
| `CANONIQUE_INCORRECT` | URL canonique différente de `https://` + domaine de `config/site.yml` + chemin de la page (relative, `http:`, autre hôte, `www.`, mauvais chemin), ou URL canonique sur la page d'erreur `404.html` (qui n'en a pas et n'entre pas dans le sitemap) | reconstruire après tout changement de domaine ; ne jamais écrire l'URL à la main ; ne pas passer la page 404 par le lien canonique de `Base.astro` |
| `SITEMAP_INCOHERENT` | `sitemap.xml` absent en production, ou liste différente des URL canoniques des pages (manquante, en trop, en double) | reconstruire ; vérifier `src/lib/sitemap.ts` si une page a été ajoutée hors de `cheminsDuSite` |
| `ROBOTS_SANS_SITEMAP` | `robots.txt` de production absent ou sans la ligne `Sitemap: https://<domaine>/sitemap.xml` | reconstruire ; vérifier `src/pages/robots.txt.ts` |
| `DOMAINE_PROVISOIRE` | domaine de `config/site.yml` sur un TLD réservé, `.invalid`, `.test`, `.example` ou `.localhost` (un constat pour le dist), ou URL canonique vers un tel domaine | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : voir « Changer de domaine » |
| `HEBERGEUR_PREVU` | page qui porte `data-hebergeur="prevu"` (Méthode, Mentions légales : « pas encore en ligne », relecture par un juriste à venir) | avertissement en CI ; erreur quand `RTP_DEPLOIEMENT=1` : passer `statut: actif` dans `config/hebergeur.yml` et reconstruire |
| `VERSION_ABSENTE` | `version.json` absent de la racine du dist (version servie, HEB-07) | reconstruire ; vérifier `src/pages/version.json.ts` |
| `VERSION_INVALIDE` | `version.json` illisible, clés autres qu'exactement `commit` et `date`, commit autre que 40 hexadécimaux ou `dev`, date qui n'est pas un horodatage ISO UTC, commit différent de `GITHUB_SHA` (CI), ou commit `dev` quand `RTP_DEPLOIEMENT=1` | reconstruire dans le même job que le contrôle (même `GITHUB_SHA`) ; un déploiement se construit en CI, jamais depuis une build locale |
| `TYPE_FICHIER_INATTENDU` | fichier du dist autre que `.html`, `.txt`, `.xml` ou `.json` (CSS, JS, police, image séparés) : il demanderait une règle de cache long dans le bloc Caddy (HEB-08), que le bloc n'a plus depuis l'intégration de la Phase 7 | intégrer la ressource dans la page, ou ajouter d'abord la règle de cache au rendu Caddy (`scripts/render-caddy.ts`) puis l'extension à `check-dist` |
| `FICHIER_NON_REGULIER` | entrée du dist qui n'est ni un fichier ordinaire ni un dossier (lien symbolique, même cassé ou vers un dossier, tube, socket, périphérique) ; erreur dans tous les modes. Caddy suivrait un lien dans son propre conteneur, et la commande forcée du serveur refuse un tel envoi (code 65) | retirer le lien et copier le fichier lui-même dans le dist (revue de code WR-06) |

**Garde de déploiement (contact et domaine).** Tant que le domaine n'est pas acheté, `config/site.yml` garde `contact@domaine-a-definir.invalid` et la CI passe avec un avertissement. Le job de déploiement du lot 3 doit définir `RTP_DEPLOIEMENT=1` : le build (`astro build`) échoue alors si le contact finit par un TLD réservé (`.invalid`, `.test`, `.example`, `.localhost` : `estHoteProvisoire` de `src/lib/site-config.ts`, partagé avec `check-dist`), et `check-dist` signale `CONTACT_PROVISOIRE` en erreur. Même logique pour l'hébergeur : tant que `config/hebergeur.yml` dit `statut: prevu`, le build échoue sous `RTP_DEPLOIEMENT=1`, et `check-dist` signale `HEBERGEUR_PREVU` en erreur sur un dist construit plus tôt (artefact `site-preview`, `dist-reel`) qui contient encore les phrases d'avant la mise en ligne. Même logique pour le domaine : tant que `domaine` finit par l'un de ces TLD réservés, le build échoue sous `RTP_DEPLOIEMENT=1` et `check-dist` signale `DOMAINE_PROVISOIRE` en erreur. Quand le domaine et le contact sont tous deux provisoires, le build s'arrête sur une seule erreur qui nomme les deux : « config/site.yml : domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer ; contact provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner une vraie adresse avant de déployer ». Sans la variable, le build passe avec un seul avertissement « config/site.yml : valeurs provisoires (TLD réservé), à remplacer avant le déploiement : … ». `node scripts/render-caddy.ts` refuse aussi de rendre le bloc (code 2) sous `RTP_DEPLOIEMENT=1` quand le **domaine** est provisoire ; un contact provisoire seul ne l'empêche pas, car le contact n'est pas dans le bloc (le build et `check-dist` le refusent). `RTP_DEPLOIEMENT` n'accepte que `1` (déploiement), `0` ou une valeur vide : `true`, `yes` ou toute autre valeur font échouer le build et `check-dist` (code 2) au lieu de désactiver les gardes en silence (`src/lib/deploiement.ts`).

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

### Relire les dates de couverture

Chaque case « Non précisé » affiche « Non précisé dans les sources consultées le <`verifie_le`> », puis la date de consultation de chaque source listée. Si une source a été consultée **après** `verifie_le`, le lecteur lit une vérification faite avant la lecture de la source : `npm run validate` le signale par l'avertissement `COUVERTURE_VERIFIEE_AVANT_SOURCE` (il ne bloque pas la CI et figure dans le catalogue de la page Méthode). Correction éditoriale, jamais par script ni par recherche-remplacement : relire la case dans les sources listées, puis mettre `verifie_le` à la date de cette relecture ; ou, si c'est la date de consultation qui est fausse, la corriger d'après la capture archivée (`archive.capture_le`). Les cas ouverts au 2026-11-07 sont listés dans `.planning/phases/07-domaine-param-tr-inlining-et-dette/07-REVIEW-FIX.md` (WR-05).

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

## Déploiement

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

Étapes juridiques à faire avant la mise en ligne publique :

1. Communiquer l'identité de l'éditeur à l'hébergeur (condition du II de l'article 1-1 pour ne publier que l'identité de l'hébergeur) et conserver la preuve de cet envoi.
2. Vérifier sur la facture que l'entité qui héberge le VPS est bien Hetzner Online GmbH (hypothèse A5 de la phase 5) ; sinon corriger `config/hebergeur.yml`.
3. Passer `statut: actif` dans `config/hebergeur.yml`, dans le commit de déploiement. Tant que le statut est `prevu`, un build avec `RTP_DEPLOIEMENT=1` échoue.
4. Décrire dans les Mentions légales ce que garde le journal d'accès de Caddy (champs, adresse IP entière ou tronquée, durée de conservation : 14 jours au plus avec le bloc généré, voir « Bloc Caddy (Phase 8) ») une fois sa configuration arrêtée. Avec `statut: actif`, la page dit seulement que le serveur reçoit l'adresse IP pour envoyer les pages ; elle ne dit plus que le site ne collecte aucune donnée personnelle.
5. Faire relire par un juriste les Mentions légales et l'interprétation de la CNIL sur `localStorage` (hypothèse A2 : réglages d'affichage exemptés de consentement).
6. Remplacer le domaine provisoire de `config/site.yml` (le build échoue sous `RTP_DEPLOIEMENT=1` tant qu'il finit par un TLD réservé : `.invalid`, `.test`, `.example`, `.localhost`), puis régénérer le bloc Caddy (« Changer de domaine »).
7. Remplacer l'adresse de contact provisoire de `config/site.yml`.
8. Vérifier que le dépôt `ErwanHenry/reveleTonProg` est toujours public (il l'est depuis le 2026-11-04) et le garder public : les liens du site vers le dépôt (Qui sommes-nous, « Signaler une erreur (GitHub) », « Extrait archivé ») en dépendent et renverraient une erreur 404 s'il redevenait privé. Contrôle : `gh repo view ErwanHenry/reveleTonProg --json visibility` doit répondre `PUBLIC`.
9. Hypothèse A4 confirmée : `actions/upload-artifact` fonctionne avec `permissions: contents: read` (artefact `site-preview` publié à chaque run de `main`, par exemple le run 42525804302 du 2026-11-08). Rien à faire au premier déploiement.

### Retour arrière

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
- Pendant un gel, un push sur `main` passe la CI mais `deploy` est sauté, avec l'avertissement « déploiement refusé » dans le résumé du job `gel`. Un retour arrière est refusé de la même façon. Un run qui a passé `gel` avant le gel et attend encore l'approbation est refusé au moment de l'approbation : `deploy` rejoue la garde en première étape et échoue (« Déploiement refusé par la garde de gel au moment de l'approbation »), sans rien envoyer.
- Retrait d'urgence pendant un gel (par exemple une mesure publiée sans source) : commiter le retrait (mesure repassée en `brouillon`), pousser sur `main`, puis relancer avec la case cochée et une justification écrite d'au moins 20 caractères :

```bash
gh workflow run ci.yml --ref main -f retrait_urgence=true -f justification="Retrait de la mesure X publiée sans source"
gh workflow run rollback.yml -f cible=production -f retrait_urgence=true -f justification="Retour à la version d'hier, page cassée"
```

- La justification est nettoyée (caractères de contrôle remplacés, coupée à 300 caractères) et gardée dans le résumé du run. Le déploiement passe ensuite par la même approbation. `retrait_urgence` coché suffit à demander le déploiement : inutile d'ajouter `-f deployer=true`.
- Une case cochée sans justification valable fait échouer le job `gel` (code 1), même hors gel : jamais de passage silencieux.
- Essai à blanc sur le Mac : `node scripts/garde-gel.ts --urgence '' --justification '' --date 2027-04-18T12:00:00+02:00` (refus, avertissement, code 0).

### Hôte technique (essai)

- `essai.<domaine>` est un hôte privé : bloc `deploy/caddy/essai.caddy`, généré par `node scripts/render-caddy.ts`, installé en `sites.d/reveletonprog-essai.caddy` par l'étape `site-essai` de l'installateur (refusée tant que le domaine est réservé). Racine `/srv/reveletonprog/essai/current`.
- `basic_auth` sur tous les chemins sauf `/robots.txt`, deux utilisateurs : `essai` (relecture par Erwan) et `sonde` (sonde externe, battement HTTPS, test de fumée, mesures 4G). Mots de passe en clair dans Vaultwarden, copie locale dans `~/.config/rtp/` (0600). Empreintes bcrypt dans `/opt/vaultwarden/.env` (root, 0600), passées au conteneur par `RTP_ESSAI_HASH` et `RTP_SONDE_HASH`.
- Changer un mot de passe : nouvelle empreinte bcrypt calculée hors du dépôt (jamais affichée), `ops/installer-serveur.sh --appliquer --etape env-caddy` avec la ligne `RTP_ESSAI_HASH=…` ou `RTP_SONDE_HASH=…` sur l'entrée standard, puis recréation du conteneur (procédure de la section suivante) : la variable d'un conteneur ne change qu'à sa recréation, un `caddy reload` garde l'ancienne. Pour `sonde`, mettre aussi à jour Vaultwarden, `~/.config/rtp/sonde-pass`, les secrets `DEPLOY_SMOKE_PASS` et `SONDE_PASS`, et `RTP_SONDE_PASS` dans `/etc/rtp/battement.env` (étape `battement`).
- Non indexé : `X-Robots-Tag: noindex, nofollow` sur toutes les réponses (401 compris) et `robots.txt` fermé (`Disallow: /`). L'en-tête est posé par une directive `header` à part : le sous-bloc `header` commun est différé (à cause de `-Server`) et Caddy ne l'applique pas au 401 de `basic_auth`. Pas de `handle_errors` : sur le serveur partagé, il ferait passer au niveau debug le journal des erreurs 5xx de tous les sites. Contrôle sans identifiant : `curl -sI https://essai.<domaine>/ | grep -i x-robots-tag`. Mêmes en-têtes et même journal masqué que la production.
- Construit sans `RTP_DEPLOIEMENT` (ADR-055). Retiré à l'ouverture en Phase 9 : bloc ôté de `sites.d`, `caddy reload`, sonde et test de fumée réorientés vers l'hôte public.
- **Point de la Phase 9 (Mentions légales).** La build d'essai a l'hébergeur `prevu` : ses Mentions légales disent « aucun serveur de l'éditeur ne reçoit vos visites », alors que l'hôte d'essai est un serveur. Il est privé, protégé par mot de passe et visité seulement par Erwan et la sonde. La phrase redevient vraie quand l'hôte d'essai est retiré, et la build publique passe à `actif`.

### Serveur : installer et vérifier

Règle D-01 : sur le VPS, la lecture est libre (diagnostic, `caddy validate` dans un conteneur jetable, instantanés HTTP) ; toute écriture est montrée à Erwan (commande, effet, retour arrière) et lancée seulement après son accord, depuis la session principale (les agents n'écrivent jamais sur le serveur). La configuration du site ne s'écrit que par `ops/installer-serveur.sh`, une liste d'étapes approuvée à la fois ; recréation, rechargement de Caddy et cron restent des commandes séparées.

- Vérifier sans rien écrire, depuis une copie éphémère du dépôt (retirée à la fin, pas d'accord nécessaire) :

```bash
tar -C . -cz ops deploy | ssh keel-vps 'd=$(mktemp -d) && tar -xz -C "$d" && bash "$d/ops/installer-serveur.sh" --verifier --etape montages,env-caddy,import-caddy,utilisateur,commande; r=$?; rm -rf "$d"; exit $r'
```

  Chaque ligne dit `[ok]` ou `[a faire]` ; une configuration conforme n'a aucun `[a faire]`. Ajouter à la liste les étapes déjà installées (`battement`, `sauvegarde`, `restauration-mensuelle`, `site-essai`). Le script n'affiche jamais un contenu ni un secret.
- Appliquer (écriture, après accord) : rafraîchir la copie du dépôt sur le serveur, puis lancer les étapes approuvées depuis elle. Sans secret à fournir, `</dev/null` ; avec secret, le fichier local sur l'entrée standard :

```bash
tar -C . -cz ops deploy | ssh keel-vps 'mkdir -p /opt/rtp/depot && tar -xz -C /opt/rtp/depot'
ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape commande </dev/null'
ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape env-caddy' < ~/.config/rtp/hashes-caddy.env
```

  Étapes, toujours exécutées dans cet ordre : `sauvegarde-caddy` (copies `.bak-<AAAAMMJJhhmm>`, jamais écrasées), `montages`, `env-caddy`, `import-caddy` (ajout sur place, inode comparé), `utilisateur` (`--cle-publique <fichier>`), `commande`, `battement`, `sauvegarde`, `restauration-mensuelle`, `site-essai`, `depot`. Codes : 0 succès, 1 échec ou application incomplète, 2 usage, 3 `--appliquer` sans root, 4 entrée refusée, 5 inode du Caddyfile changé, 6 bloc d'essai refusé. Une seconde application ne fait plus rien.
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

Variables de dépôt : `DEPLOY_CIBLE` (`essai`, puis `production` en Phase 9 ; absente = chaîne de livraison en sommeil) et `SONDE_URL` (`https://essai.<domaine>`, posée par 08-15 ; absente = sonde en sommeil). Les relecteurs requis d'un Environment ne fonctionnent sur le plan gratuit que parce que le dépôt est public.

- Poser une valeur sans l'afficher, depuis le fichier local : `gh secret set DEPLOY_SSH_KEY --env production < ~/.config/rtp/rtp-deploy-github` (même forme pour `gh variable set … --env production`). La clé privée ne reste ensuite que dans l'Environment et dans Vaultwarden.
- Contrôler (noms seulement) : `gh secret list --env production`, `gh variable list --env production`, `gh variable list`, et `gh api repos/ErwanHenry/reveleTonProg/environments/production --jq '.protection_rules'`.

### Bloc Caddy (Phase 8)

`deploy/caddy/site.caddy` est généré (`node scripts/render-caddy.ts`, ne pas l'éditer à la main) : bloc du domaine (`root`, `encode zstd gzip`, `file_server`, en-têtes, journal) et redirection permanente de `www.` vers le domaine. Son en-tête `Content-Security-Policy` porte les empreintes des deux scripts et `frame-ancestors 'none'` : c'est lui qui couvre le script d'ordre, placé avant la meta CSP de la page (ADR-056). Le journal d'accès tourne chaque jour à 00:00 UTC (`roll_at 00:00`, ou dès 10 Mio) et Caddy ne garde que 12 fichiers tournés (`roll_keep 12`, `roll_keep_for 288h`) plus le fichier du jour : une entrée y reste moins de 13 jours, et **14 jours au plus** si une rotation de minuit est manquée (Caddy arrêté à minuit). Adresses IP tronquées (/24 et /48), en-têtes de requête supprimés. C'est cette borne de 14 jours que reprennent les Mentions légales (étape 4 ci-dessus) ; `tests/repo/caddy.test.ts` la recalcule depuis le bloc rendu. `deploy/caddy/essai.caddy` suit les mêmes règles (voir « Hôte technique (essai) »).

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

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure (passer en `brouillon`), tracer au journal, redéployer. Pendant un gel des scrutins : « Gel des scrutins et retrait d'urgence ».

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

1. Copie du dépôt : `tar -C . -cz ops deploy | ssh keel-vps 'mkdir -p /opt/rtp/depot && tar -xz -C /opt/rtp/depot'`.
2. `--appliquer --etape sauvegarde-caddy`, puis `montages`, puis `env-caddy` avec les deux empreintes de Vaultwarden sur l'entrée standard.
3. Lecture : `docker compose config -q` dans `/opt/vaultwarden`, puis `ops/valider-caddy.sh` avec `RTP_AJOUTER_IMPORT=1 RTP_AVEC_SANS_VARIABLES=1`.
4. `--etape import-caddy`, puis la recréation du conteneur (« Serveur : installer et vérifier »).
5. `--etape utilisateur,commande --cle-publique <clé publique de déploiement>`.
6. `--etape battement` (fichier `battement.env` de Vaultwarden sur l'entrée standard), `--etape sauvegarde`, `--etape restauration-mensuelle` (ligne `HC_RESTAURATION=…`).
7. `--etape site-essai`, puis `caddy validate` et `caddy reload` dans le conteneur.
8. Vérifier : `--verifier` sur toutes ces étapes (aucun `[a faire]`), `rtp-tester-restauration`, puis un déploiement approuvé. Si la clé d'hôte SSH du serveur a changé, remplacer `DEPLOY_KNOWN_HOSTS` dans l'Environment `production`, ligne lue par le canal SSH de confiance, jamais par un scan.

## Monitoring

Healthchecks.io (compte d'Erwan) reçoit des pings et alerte quand un contrôle reçoit `/fail` ou ne reçoit plus rien ; il ne sonde aucune URL (ADR-058). L'intégration Telegram native (HealthchecksBot) est branchée sur chaque contrôle : un message de panne, puis un message de rétablissement au premier ping de succès suivant. Les adresses de ping sont des secrets : `/etc/rtp/battement.env`, `/etc/rtp/restauration.env`, secret `SONDE_PING_URL` de l'Environment `sonde`, copies dans Vaultwarden.

| Contrôle | Alimenté par | Période | Grâce | Alerte quand | Première commande |
|----------|--------------|---------|-------|--------------|-------------------|
| `vps-battement` | `rtp-battement`, cron toutes les 5 min | 5 min | 10 min | plus aucun ping : machine tombée, conteneur Caddy arrêté, cron mort ou contenu cassé | `ssh keel-vps 'docker ps --filter name=caddy; journalctl -t rtp-battement -n 5 --no-pager'` |
| `vps-disque-85` | `rtp-battement` | 5 min | 10 min | `/fail` : disque le plus plein à 85 % ou plus | `ssh keel-vps 'df -h; docker system df'` |
| `vps-disque-92` | `rtp-battement` | 5 min | 10 min | `/fail` à 92 % (le déploiement refuse déjà au-delà, code 75) | même commande, puis libérer de la place sans toucher aux autres sites |
| `vps-certificat` | `rtp-battement`, une fois `RTP_HOTE` posé | 5 min | 10 min | `/fail` : certificat servi qui expire dans moins de 14 jours | `ssh keel-vps 'docker logs --since 24h caddy 2>&1 \| grep -ci acme'` puis lire les messages ACME |
| `sonde-externe` | `.github/workflows/sonde.yml`, toutes les 10 min | 10 min | 20 min | environ 3 sondes manquées : page d'accueil sans le marqueur, `/version.json` illisible, hôte injoignable | `gh run list --workflow sonde.yml --limit 3`, puis `gh run view <id> --log-failed` |
| `restauration-mensuelle` | `rtp-tester-restauration`, le 1er du mois | planning `0 11 1 * *` UTC | 3 jours | test du mois manqué ou en échec | `ssh keel-vps 'journalctl -t rtp-restauration -n 20 --no-pager'` |

- La sonde ne pingue qu'en cas de succès ; en cas d'échec elle envoie seulement la raison au journal du contrôle (`/log`). Le battement fait tous ses contrôles, puis envoie un ping par contrôle dans un ordre fixe ; sa ligne JSON (journal `rtp-battement`) ne contient ni adresse ni identifiant. Chaque appel externe est borné par `timeout` (`docker inspect` et `openssl s_client` 15 s, requêtes HTTPS 15 s, pings 60 s) et la ligne cron passe par `flock -n /run/rtp-battement.lock` : pendant une panne de Docker ou de Caddy, un passage encore en cours fait sauter le suivant au lieu de s'empiler (revue de code WR-05).
- Alertes simulées, sans remplir le disque ni toucher au certificat (elles envoient de vraies alertes : à faire approuver comme une écriture) : `ssh keel-vps 'RTP_SEUIL1=1 /usr/local/sbin/rtp-battement'`, puis `RTP_SEUIL2=1`, puis `RTP_CERT_JOURS=9999` (une fois `RTP_HOTE` posé), et un passage normal pour le rétablissement. `RTP_HC_SIMULATION=1` affiche le signal prévu pour chaque contrôle sans rien envoyer.
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
