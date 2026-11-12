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
| `THEME_HORS_LISTE_BLANCHE` | page de thème dont l'identifiant n'est pas dans `themes_ouverts` de `config/publication.yml` (erreur en production) | ajouter le thème à la liste dans un commit dédié relu par Erwan, ou le repasser en brouillon |
| `THEME_OUVERT_ABSENT` | thème listé dans `themes_ouverts` sans page dans le dist (avertissement en production) | normal après un retrait d'urgence ; sinon vérifier le statut du thème |
| `PUBLICATION_VIDE` | aucune page de thème dans le dist de production (avertissement) | normal si tout est retiré ; sinon vérifier `themes_ouverts` et les statuts |
| `BROUILLON_EN_PRODUCTION` | trace de brouillon dans un build de production | vérifier `RTP_MODE` et le statut de la mesure |
| `RELECTURE_ABSENTE` | mesure publiée sans exactement une ligne « Relue par … le … » avec relecteur et date réelle (erreur en production) | renseigner `relecteur` et `date_relecture` dans le YAML de la mesure ; ne pas publier une mesure non relue |
| `CANDIDAT_NON_RELU_EN_PRODUCTION` | une personne sans aucun statut relu ou publié serait publique en production : page `candidats/<id>/`, lien vers elle ou entrée de `sitemap.xml` (erreur, D-06) | faire relire son statut avec `npm run relecture -- marquer statut <candidat>`, ou trouver la page qui la lie encore (le message nomme l'identifiant et le fichier) ; ne jamais changer un statut pour faire passer le contrôle |
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
| `TYPE_FICHIER_INATTENDU` | fichier du dist autre que `.html`, `.txt`, `.xml`, `.json` et le seul `favicon.ico` à la racine (4 096 octets au plus, régénéré par `node scripts/favicon.ts` ; toute autre icône ou une icône plus lourde est refusée) (CSS, JS, police, image séparés) : il demanderait une règle de cache long dans le bloc Caddy (HEB-08), que le bloc n'a plus depuis l'intégration de la Phase 7 | intégrer la ressource dans la page, ou ajouter d'abord la règle de cache au rendu Caddy (`scripts/render-caddy.ts`) puis l'extension à `check-dist` |
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

Entrée : `data/import/` (instantanés bruts datés, `correspondances.yaml` faite à la main, attribution). Détail complet dans `data/import/README.md`.

1. `npm run import:datagouv` (ou `-- --file data/import/<instantané>.json` hors ligne, `-- --dry-run` pour le rapport seul ; `-- --url` n'accepte que des hôtes https publics, redirections revérifiées, sinon `ADRESSE_PRIVEE`) ;
2. lire le rapport : créé, statut ajouté (en place : les commentaires du fichier candidat sont conservés), inchangé, absent en amont, conflit (un fichier candidat YAML illisible est signalé `conflit` / `illisible`, sans plantage) ;
3. ouvrir une pull request avec le diff de `src/content/candidats/`, l'instantané et `ids.lock` ; `npm run validate -- --mode production` et `npm run ids -- --check` doivent passer.

Les changements de statut attendus en décembre suivent ce chemin : un statut qui change s'ajoute à la fin de `statuts[]` (historique en ajout seul, jamais de réécriture). Un conflit (id amont inconnu, date qui recule) arrête tout sans rien écrire : ajouter la personne à la main dans `correspondances.yaml`, jamais par découpage automatique du nom. Les champs `bloc`, `propositions` et `statut_detail` du jeu amont n'entrent jamais dans `src/content/`. L'attribution de la source (data.gouv.fr, licence) reste dans `data/import/`.

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
| `npm run relecture -- liste --theme sante` | ce qui reste à relire, candidat par candidat, et la ligne `reste N sur M` ; `--format json` pour une sortie lisible par un script, `--relecteur <nom>` pour compter les cases relues par un autre relecteur |
| `npm run relecture -- servir` | page de relecture sur `http://127.0.0.1:4327/` (thème santé par défaut ; `--theme <id>`, `--port <n>`), arrêt par Ctrl+C |
| `npm run relecture -- marquer mesure <candidat>/<slug>` | passe la mesure à `relu` avec le relecteur et la date du jour (Paris) |
| `npm run relecture -- marquer statut <candidat>` | idem pour le statut de candidature retenu |
| `npm run relecture -- marquer case <theme> <candidat>` | pose `verifie_le` et `verifie_par` sur la case de couverture |
| `npm run relecture -- note mesure:<candidat>/<slug> "texte"` | ouvre une note de correction (cibles `statut:<candidat>` et `case:<theme>/<candidat>` aussi) ; 500 caractères au plus |
| `npm run relecture -- note --resoudre mesure:<candidat>/<slug>` | ferme la note quand la correction est faite |

Options de `marquer` : `--relecteur <nom>` (défaut `Erwan Henry`), `--date AAAA-MM-JJ` (défaut : aujourd'hui, heure de Paris), `--malgre-note`, `--hors-perimetre`. `marquer` refuse, sans rien écrire, dans ces cas : cible inconnue, fichier invalide, note ouverte sur la cible (sauf `--malgre-note`), statut hors du périmètre d'équité (sauf `--hors-perimetre`, voir « Publier un thème »), date de statut incomplète, mesure ou statut déjà `publie`. Si la validation de production trouve une erreur nouvelle après l'écriture, il remet les octets d'origine.

La page `servir` écoute sur la boucle locale seulement, exige un jeton propre à chaque lancement pour toute écriture et refuse un autre hôte ou une autre origine. Pour chaque candidat, elle montre les quatre rédactions à côté du `texte_source` et de l'extrait archivé autour de la citation, la source avec ses dates et son empreinte, les alertes de la CI, le statut de candidature et la case de couverture avec ses dates ; les formulaires « Valider » et « Note » appellent le même code que le terminal. Elle relit le corpus à chaque requête : une correction faite à la main dans le YAML apparaît au rechargement.

Un test navigateur garde cette page : `e2e/relecture.spec.ts` (config `playwright.relecture.config.ts`, lancé à la fin de `npm run e2e`, sans dist) pilote la vraie page dans Chromium sur une copie temporaire du corpus fictif, clique « Valider » et « Ajouter la note », puis vérifie le YAML, les registres et le refus 409 sur note ouverte. Il protège contre ce que seul un vrai navigateur fait : le 2026-11-11, la `Referrer-Policy: no-referrer` faisait envoyer `Origin: null` sur le formulaire et chaque clic était refusé en 403, ce que les tests à en-têtes fabriqués ne voyaient pas. Lancement seul : `fnm exec --using=24 npx playwright test -c playwright.relecture.config.ts`.

Le registre `relecture/journal.jsonl` garde, à chaque écriture de l'outil, l'empreinte sha256 du texte relu ; `relecture/notes.jsonl` garde les notes. Les deux fichiers sont en ajout seul et publics (le dépôt est public) : aucune donnée personnelle dans une note. Quand le texte d'une cible change après sa relecture, `liste` l'affiche « à revoir (modifié depuis la relecture) » (état `a_revoir` dans la sortie JSON) et `publier` refuse : refaire `marquer` après avoir relu la correction.

**Dates de couverture.** Trois cas du thème santé sont à traiter pendant la relecture de leur case, jamais par recherche-remplacement : `clara-egger`, `benoit-mathieu` et `manolo-mlekuz` ont `verifie_le: 2026-11-03` alors que leur source a été consultée le 2026-11-04 (avertissement `COUVERTURE_VERIFIEE_AVANT_SOURCE`, fichier `src/content/couverture/sante.yaml`). Relire la case dans les sources listées, puis `marquer case sante <candidat>` : `verifie_le` prend la date de cette relecture et l'avertissement disparaît. Cinq cas du thème `travail` restent ouverts tant que ce thème n'est pas relu (D-06) : `clara-egger`, `benoit-mathieu`, `antoine-mikolajczak`, `manolo-mlekuz` et `natacha-polony`. Ce sont des avertissements : ils ne bloquent ni la CI ni le déploiement.

**Périmètre de l'ouverture.** Seuls les 37 statuts « déclaré » du thème santé sont relus (121 cibles : 47 mesures, 37 statuts, 37 cases de couverture). Les 22 personnes « ne se présente pas » ou « pressenti » ne sont pas relues et restent absentes de la production (voir « Publier un thème »).

### Publier un thème

Une mesure passe en deux temps : `relu` (par Erwan, cible par cible, « Relire un thème »), puis `publie` pour le thème entier, quand tout son périmètre est relu (ADR-059). Un thème n'est visible en production que s'il est `publie` **et** listé dans `config/publication.yml` (ADR-060).

1. **Ouvrir le thème dans la liste blanche.** Ajouter son identifiant sous `themes_ouverts` de `config/publication.yml` (séquence en bloc, éléments indentés de deux espaces sous la clé), dans un commit dédié relu par Erwan : c'est une décision éditoriale, que l'outil ne prend jamais. `publier` refuse tant que le thème n'y est pas (« thème absent de config/publication.yml »).
2. **Vérifier qu'il ne reste rien à relire** : `npm run relecture -- liste --theme <id>` doit afficher `reste 0`, sans note ouverte ni cible « à revoir ».
3. **Essai à blanc puis publication** :

```bash
npm run relecture -- publier --theme <id> --dry-run
npm run relecture -- publier --theme <id>
```

   Options : `--relecteur <nom>` et `--date AAAA-MM-JJ`. La commande passe les mesures `relu` du thème et le thème lui-même à `publie` en une seule opération tout ou rien : elle valide tout le corpus en mode production et remet les octets d'origine si une erreur apparaît. Elle **ne marque jamais rien `relu`**. Elle refuse, en listant toutes les raisons ensemble et sans rien écrire : thème absent de la liste blanche, mesure pas encore relue ou « à revoir », note ouverte, statut ou case de couverture pas encore relus, mesure d'un candidat hors du périmètre d'équité, erreur de validation du thème, alerte `ARCHIVE_WAYBACK_ABSENTE` (source sans copie Wayback ni exception motivée, voir « Archiver une source »). Un second passage répond « déjà publié ».
4. **Pull request.** Vérifier en local que `npm run validate -- --mode production` donne zéro erreur ; la CI refait la validation, la build et `check-dist`. Un build local de déploiement se fait avec `RTP_DEPLOIEMENT=1 RTP_MODE=production GITHUB_SHA=$(git rev-parse HEAD) npm run build`, puis `npm run check-dist` : tant que `config/hebergeur.yml` est `prevu`, il échoue, c'est la garde de déploiement.
5. **Déploiement.** Après la fusion, le run de `main` attend l'approbation d'Erwan (bouton « Review deployments », voir « Déploiement »).

Codes qui bloquent une publication mal préparée : `PUBLICATION_THEME_NON_OUVERT` (thème `publie` mais absent de la liste : erreur en production), `THEME_HORS_LISTE_BLANCHE` et `THEME_OUVERT_ABSENT` côté `check-dist`, `RELECTURE_ABSENTE` (mesure publiée sans sa ligne de relecture). Leurs lignes sont dans les tables « Codes du validateur » et « Contrôle post-build (check-dist) ».

**Ligne du relecteur.** Chaque mesure publiée affiche, à tous les niveaux de lecture et sans JavaScript, « Relue par <relecteur> le <date>. » (valeurs du YAML de la mesure). `check-dist` refuse un build de production où cette ligne manque ou est invalide (`RELECTURE_ABSENTE`).

**Personnes sans statut relu (décision D-06, « 2a »).** En production, une personne du jeu de données qui n'a aucun statut de candidature `relu` ou `publie` est absente : ni page `candidats/<id>/`, ni ligne sur `/candidats/`, ni entrée de `sitemap.xml`, ni lien, ni nom sur une page thème. La page Candidats et la page Méthode disent combien de personnes attendent la relecture de leur statut. `check-dist` refuse un dist qui en exposerait une (`CANDIDAT_NON_RELU_EN_PRODUCTION`). Une personne apparaît dès que son statut est relu : `npm run relecture -- marquer statut <candidat>` (avec `--hors-perimetre` pour un statut « ne se présente pas » ou « pressenti », hors du périmètre d'équité). La définition est celle de l'ADR-041 : la production ne compte que les statuts `relu` et `publie`, la prévisualisation montre tout le monde avec ses pastilles de brouillon.

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

Une page dont le pied de page publie des données personnelles de particuliers (cas de `erwan-rohou-programme-mei`) n'est ni archivée telle quelle ni soumise à Wayback : saisie manuelle expurgée avec `--file`, `wayback_url` absent, remplacé par une exception motivée (ci-dessous). Une source qui porte `archive.wayback_exception` n'est jamais soumise ni adoptée par l'outil, y compris par `--wayback-missing`.

**Adopter un instantané existant (mode 6, ADR-061).** Quand l'adresse d'une page a changé (l'ancienne répond 404) mais qu'un instantané Wayback de la nouvelle adresse existe, `--wayback-adopter <id> --instantane <horodatage> [--nouvelle-url <url>]` lit l'instantané (14 chiffres, repris de son adresse web.archive.org) et ne l'adopte que si **chaque paragraphe** de l'extrait archivé s'y retrouve (trouvé : 30 sur 30, 29 sur 29 et 39 sur 39 pour les trois sources de Delphine Batho en 09-03). Il avertit d'un écart de plus de 24 h entre la capture du dépôt et l'instantané. `--nouvelle-url` corrige aussi le champ `url` de la source ; l'extrait, son sha256 et les dates ne changent pas. Montrer le diff à Erwan avant d'écrire dans `src/content/sources/`.

**Exception Wayback motivée.** Une source citée par une mesure publiée exige `archive.wayback_url` ou le champ `archive.wayback_exception` (`motif`, `decide_par`, `decide_le`), exclusifs l'un de l'autre ; sinon `ARCHIVE_WAYBACK_ABSENTE`. La décision revient à Erwan seul : `decide_par` et `decide_le` portent son nom et la date. La liste des exceptions du corpus réel est épinglée par `tests/rules/sources-wayback.test.ts` (aujourd'hui `erwan-rohou-programme-mei`, motif : la page affiche des données personnelles de particuliers, donc le site ne renvoie pas vers une copie Wayback de cette page) : ajouter une exception fait échouer ce test tant qu'elle n'est pas ajoutée à la liste, dans une pull request relue. Le motif n'est affiché sur aucune page. Sources Batho (PUB-04) : les trois (priorités 1, 2 et 4) ont leur nouvelle adresse et leur instantané adopté, aucune n'est ouverte ; deux points restent à décider par Erwan, le champ `source_localisation` des deux mesures santé de Delphine Batho (il dit encore « page de la priorité 1 La pleine santé ») et trois lignes de « sources consultées » de `data/couverture-themes.yaml` qui citent les anciennes adresses.

**Site qui refuse l'outil.** Le site de Delphine Batho répond HTTP 403 à l'agent utilisateur de l'outil d'archivage alors qu'un navigateur reçoit 200. L'adoption n'est pas touchée (elle ne lit que web.archive.org), mais un futur `--refresh` de ces sources demandera `--file` avec une page enregistrée depuis le navigateur.

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

### Hôte technique (essai)

- `essai.<domaine>` est un hôte privé : bloc `deploy/caddy/essai.caddy`, généré par `node scripts/render-caddy.ts`, installé en `sites.d/reveletonprog-essai.caddy` par l'étape `site-essai` de l'installateur (refusée tant que le domaine est réservé). Racine `/srv/reveletonprog/essai/current`.
- `basic_auth` sur tous les chemins sauf `/robots.txt`, deux utilisateurs : `essai` (relecture par Erwan) et `sonde` (sonde externe, battement HTTPS, test de fumée, mesures 4G). Mots de passe en clair dans Vaultwarden, copie locale dans `~/.config/rtp/` (0600). Empreintes bcrypt dans `/opt/vaultwarden/.env` (root, 0600), passées au conteneur par `RTP_ESSAI_HASH` et `RTP_SONDE_HASH`.
- Changer un mot de passe : nouvelle empreinte bcrypt calculée hors du dépôt (jamais affichée), `ops/installer-serveur.sh --appliquer --etape env-caddy` avec la ligne `RTP_ESSAI_HASH=…` ou `RTP_SONDE_HASH=…` sur l'entrée standard, puis recréation du conteneur (procédure de la section suivante) : la variable d'un conteneur ne change qu'à sa recréation, un `caddy reload` garde l'ancienne. Pour `sonde`, mettre aussi à jour Vaultwarden, `~/.config/rtp/sonde-pass`, les secrets `DEPLOY_SMOKE_PASS` et `SONDE_PASS`, et `RTP_SONDE_PASS` dans `/etc/rtp/battement.env` (étape `battement`).
- Non indexé : `X-Robots-Tag: noindex, nofollow` sur toutes les réponses (401 compris) et `robots.txt` fermé (`Disallow: /`). L'en-tête est posé par une directive `header` à part : le sous-bloc `header` commun est différé (à cause de `-Server`) et Caddy ne l'applique pas au 401 de `basic_auth`. Pas de `handle_errors` : sur le serveur partagé, il ferait passer au niveau debug le journal des erreurs 5xx de tous les sites. Contrôle sans identifiant : `curl -sI https://essai.<domaine>/ | grep -i x-robots-tag`. Mêmes en-têtes et même journal masqué que la production.
- Construit sans `RTP_DEPLOIEMENT` (ADR-055). Retiré à l'ouverture en Phase 9 : bloc ôté de `sites.d`, `caddy reload`, sonde et test de fumée réorientés vers l'hôte public, selon la procédure ordonnée de « Ouverture publique (Phase 9) ».
- **Point de la Phase 9 (Mentions légales).** La build d'essai a l'hébergeur `prevu` : ses Mentions légales disent « aucun serveur de l'éditeur ne reçoit vos visites », alors que l'hôte d'essai est un serveur. Il est privé, protégé par mot de passe et visité seulement par Erwan et la sonde. La phrase redevient vraie quand l'hôte d'essai est retiré, et la build publique passe à `actif`.

### Ouverture publique (Phase 9)

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
- adresse inconnue : `curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/nexistepas/` répond 404 et `curl -s https://<domaine>/nexistepas/` contient « Page introuvable » ; routes d'erreur : avant l'étape 5, `ssh keel-vps 'docker exec caddy caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile' | jq -c '.apps.http.servers | map_values(has("errors"))' > ~/.config/rtp/caddy-erreurs-avant.json` (lecture seule), puis la même commande après le rechargement de l'étape 6 vers `~/.config/rtp/caddy-erreurs-apres.json` ; `jq -s '.[0] as $a | .[1] | to_entries | all(.value == ($a[.key] // false))' ~/.config/rtp/caddy-erreurs-avant.json ~/.config/rtp/caddy-erreurs-apres.json` répond `true` : le bloc public n'a ajouté de route d'erreur à aucun serveur (comparaison avant et après, et non une valeur absolue : un autre site du serveur partagé peut déjà déclarer `handle_errors`, ce qui ne regarde pas ce bloc) ;
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

Puis les deux validations et le rechargement de l'étape 6. Avec le marqueur `/opt/rtp/essai-retire`, l'étape `site-essai` de l'installateur répond `[ok: retiré]` et ne réinstalle jamais le bloc, même quand toute la liste des étapes est rejouée (le marqueur n'est posé que par cette commande, jamais par le script). Retour arrière : `ssh keel-vps 'rm /opt/rtp/essai-retire && mv /root/rtp-retire/reveletonprog-essai.caddy /opt/vaultwarden/sites.d/'`, validation, rechargement. Les variables d'empreinte `RTP_ESSAI_HASH` et `RTP_SONDE_HASH` restent : leur retrait changerait le conteneur. Le test de restauration du mois suit les blocs présents dans l'archive ; une sauvegarde puis un test juste après la mise en ligne le prouvent :

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

`deploy/caddy/site.caddy` est généré (`node scripts/render-caddy.ts`, ne pas l'éditer à la main) : bloc du domaine (`root`, `encode zstd gzip`, `file_server`, en-têtes, journal) et redirection permanente de `www.` vers le domaine. Une adresse qui n'est ni un fichier ni un dossier de la release reçoit `404.html` avec le code 404 par le filtre `@introuvable` (`not file {path} {path}/`), `rewrite * /404.html` et `file_server { status 404 }`, sans `handle_errors` (même raison que pour le bloc `essai` : sur le serveur partagé, il ferait passer le journal des erreurs de tous les sites au niveau debug) ; une release sans `404.html` répond 404 sans corps. La cible de la réécriture est le chemin fixe `/404.html` de la release, et un lien symbolique ne peut pas être servi depuis une release : le verbe `activer` de la commande forcée refuse tout envoi qui en contient un (constat CR-01 de la Phase 8) ; le filtre `file` ne teste donc que de vrais fichiers de la release. Son en-tête `Content-Security-Policy` porte les empreintes des deux scripts et `frame-ancestors 'none'` : c'est lui qui couvre le script d'ordre, placé avant la meta CSP de la page (ADR-056). Le journal d'accès tourne chaque jour à 00:00 UTC (`roll_at 00:00`, ou dès 10 Mio) et Caddy ne garde que 12 fichiers tournés (`roll_keep 12`, `roll_keep_for 288h`) plus le fichier du jour : une entrée y reste moins de 13 jours, et **14 jours au plus** si une rotation de minuit est manquée (Caddy arrêté à minuit). Adresses IP tronquées (/24 et /48), en-têtes de requête supprimés. C'est cette borne de 14 jours que reprennent les Mentions légales (étape 4 ci-dessus) ; `tests/repo/caddy.test.ts` la recalcule depuis le bloc rendu. `deploy/caddy/essai.caddy` suit les mêmes règles (voir « Hôte technique (essai) »).

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
Retirer dans l'heure : voir « Retrait d'urgence d'une mesure (moins d'une heure) » juste en dessous. Pendant un gel des scrutins : « Gel des scrutins et retrait d'urgence ».

### Retrait d'urgence d'une mesure (moins d'une heure)

Objectif : une mesure publiée qui ne doit plus l'être (absence de source, erreur factuelle, demande fondée) disparaît du site **en moins d'une heure** entre la décision et la page servie. Trois voies, à prendre dans cet ordre. Dans tous les cas : noter l'identifiant de la mesure (`<candidat>/<slug>`) et l'heure de début.

**Voie 1, retour arrière (moins de 2 minutes).** À prendre si la version précédente ne contient pas la mesure. Elle ne passe ni par la CI ni par `main` (cible `essai` tant que le site n'est pas ouvert) :

```bash
gh workflow run rollback.yml -f cible=production
gh workflow run rollback.yml -f cible=production -f version=<sha>
```

Erwan approuve dans l'interface (Environment `production`), voir « Retour arrière ». Mesures de 08-13 : 56 s et 70 s au total, approbation comprise (vue à +48 s et +59 s), exécution de 8 s et 11 s. Un retour arrière ne change pas `main` : le déploiement suivant remettrait la tête de `main`, donc la mesure. Faire aussi la voie 2 ou 3 dans la foulée.

**Voie 2, retirer la mesure.** La commande repasse la mesure à `brouillon` et vérifie que tout le corpus de production reste sans erreur :

```bash
npm run relecture -- retirer <candidat>/<slug> --dry-run
npm run relecture -- retirer <candidat>/<slug>
```

*Piège de la couverture.* Si c'est la **seule** mesure publiée du candidat sur ce thème, la case de couverture « mesures » ne serait plus vraie et la CI passerait au rouge (`EQUITE_COUVERTURE_INCOHERENTE`). La commande refuse alors (code 1, rien n'est écrit), explique le piège et imprime les deux lignes à copier, la première avec les identifiants des sources du candidat :

```bash
npm run relecture -- retirer <candidat>/<slug> --case non_precise --sources <id-source,id-source>
npm run relecture -- retirer <candidat>/<slug> --case programme_non_publie
```

Choisir entre les deux est une décision éditoriale d'Erwan : `non_precise` dit « non précisé dans les sources consultées » (les sources nommées doivent être des sources du candidat), `programme_non_publie` dit que le candidat n'a pas publié de programme sur ce thème. La commande ne choisit jamais seule. Avec `--case`, la mesure et la case changent dans la même opération, avec `verifie_le` et `verifie_par` à la date et au nom du relecteur (`--relecteur`, `--date`). Si le candidat a d'autres mesures publiées sur le thème, `--case` est refusé comme inutile.

*Erreur sans rapport.* `retirer` exige zéro erreur de validation de production sur tout le corpus après l'écriture. Une erreur déjà présente et sans rapport avec la mesure la bloque : la sortie nomme chaque erreur (fichier, ligne, code) et dit que les fichiers sont restaurés. La CI serait rouge de la même façon, donc aucun déploiement ne passerait : prendre la voie 1 pour retirer la mesure tout de suite, puis corriger l'erreur nommée dans un commit à part (voir « Lire un diagnostic ») et refaire la voie 2 ou 3.

**Voie 3, repli le plus rapide, sans décision éditoriale.** Le thème entier repasse à `brouillon` : sa page disparaît de la production, aucune mesure ni case n'est touchée.

```bash
npm run relecture -- retirer --theme <id> --dry-run
npm run relecture -- retirer --theme <id>
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

**Remettre la mesure en ligne.** Corriger le texte ou la source par une modification manuelle du YAML, validée par Erwan ; si la case de couverture a été changée par `--case`, la remettre à `mesures` de la même façon (`EQUITE_COUVERTURE_INCOHERENTE` l'exige) ; puis `npm run relecture -- marquer mesure <candidat>/<slug>` et `npm run relecture -- publier --theme <id>` (voir « Relire un thème » et « Publier un thème »), pull request, approbation.

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

Healthchecks.io (compte d'Erwan) reçoit des pings et alerte quand un contrôle reçoit `/fail` ou ne reçoit plus rien ; il ne sonde aucune URL (ADR-058). L'intégration Telegram native (HealthchecksBot) est branchée sur chaque contrôle : un message de panne, puis un message de rétablissement au premier ping de succès suivant. Les adresses de ping sont des secrets : `/etc/rtp/battement.env`, `/etc/rtp/restauration.env`, secret `SONDE_PING_URL` de l'Environment `sonde`, copies dans Vaultwarden.

| Contrôle | Alimenté par | Période | Grâce | Alerte quand | Première commande |
|----------|--------------|---------|-------|--------------|-------------------|
| `vps-battement` | `rtp-battement`, cron toutes les 5 min | 5 min | 10 min | plus aucun ping : machine tombée, conteneur Caddy arrêté, cron mort ou contenu cassé | `ssh keel-vps 'docker ps --filter name=caddy; journalctl -t rtp-battement -n 5 --no-pager'` |
| `vps-disque-85` | `rtp-battement` | 5 min | 10 min | `/fail` : disque le plus plein à 85 % ou plus | `ssh keel-vps 'df -h; docker system df'` |
| `vps-disque-92` | `rtp-battement` | 5 min | 10 min | `/fail` à 92 % (le déploiement refuse déjà au-delà, code 75) | même commande, puis libérer de la place sans toucher aux autres sites |
| `vps-certificat` | `rtp-battement`, une fois `RTP_HOTE` posé | 5 min | 10 min | `/fail` : certificat servi qui expire dans moins de 14 jours | `ssh keel-vps 'docker logs --since 24h caddy 2>&1 \| grep -ci acme'` puis lire les messages ACME |
| `sonde-externe` | `.github/workflows/sonde.yml`, toutes les 10 min | 1 jour | 1 jour | environ 2 jours sans ping de succès : page d'accueil sans le marqueur, `/version.json` illisible, hôte injoignable | `gh run list --workflow sonde.yml --limit 3`, puis `gh run view <id> --log-failed` |
| `restauration-mensuelle` | `rtp-tester-restauration`, le 1er du mois | planning `0 11 1 * *` UTC | 3 jours | test du mois manqué ou en échec | `ssh keel-vps 'journalctl -t rtp-restauration -n 20 --no-pager'` |

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
