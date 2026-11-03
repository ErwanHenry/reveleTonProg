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
npm run validate                  # données valides ? (racine : RTP_CONTENT_ROOT, mode production)
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

Par défaut ces commandes lisent la fixture fictive `tests/fixtures/corpus-valide`. Ajouter `RTP_CONTENT_ROOT=.` pour viser le vrai corpus.

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
| `CARACTERE_SUSPECT` | REGLE-02 | erreur | Retirer le caractère invisible, bidirectionnel, d'une écriture non latine (cyrillique, grec) ou imitant une lettre latine (i sans point, petites capitales). |
| `LONGUEUR_HORS_BORNES` | REGLE-03 | erreur | Ramener la rédaction dans les bornes de son niveau (le message donne le décompte et les bornes). |
| `CHIFFRE_HORS_SOURCE` | REGLE-04 | erreur | Supprimer le chiffre ou le justifier : il doit figurer dans `texte_source` ou dans `chiffrage.texte` (lui-même archivé). Vaut pour résumé, enfant et aîné. |
| `NOMBRE_LETTRES_HORS_SOURCE` | REGLE-04 | avertissement | Un nombre écrit en lettres n'est pas dans la source : vérifier qu'il n'est pas inventé. |
| `CITATION_HORS_SOURCE` | REGLE-04 | erreur | Une citation « … » doit être mot pour mot dans `texte_source` (casse et ponctuation ignorées, accents significatifs). |
| `TEXTE_SOURCE_HORS_ARCHIVE` | REGLE-05 | erreur | Recopier `texte_source` tel qu'il est dans l'extrait archivé. |
| `CHIFFRAGE_HORS_ARCHIVE` | REGLE-05 | erreur | Recopier `chiffrage.texte` tel qu'il est dans l'extrait archivé ; seul le chiffrage du candidat est admis. |
| `TEXTE_SOURCE_TROP_COURT` | REGLE-05 | avertissement | Citer un passage plus complet (au moins 4 mots). |
| `TEXTE_SOURCE_TROP_LONG` | REGLE-05 | avertissement | Réduire la citation au passage utile (au plus 120 mots). |
| `PHRASE_ENFANT_LONGUE` | REGLE-06 | selon le statut | Couper la phrase de la rédaction enfant (15 mots au plus). Erreur pour `relu` et `publie`, avertissement pour `brouillon`. |
| `LISIBILITE_ENFANT_FAIBLE` | REGLE-06 | avertissement | Raccourcir phrases et mots de la rédaction enfant ; l'indice Kandel-Moles est indicatif. |
| `ID_CHEMIN_INCOHERENT` | REGLE-07 | erreur | Faire correspondre l'`id` (ou le `candidat`) au nom du dossier et du fichier. |
| `REFERENCE_CASSEE` | REGLE-07 | erreur | La référence (thème, candidat, source, `[[terme]]`...) vise une entrée inexistante : corriger l'identifiant ou créer l'entrée. |
| `ID_VERROUILLE_DISPARU` | REGLE-07 | erreur | Un identifiant de `ids.lock` n'a plus de fichier (renommé ou supprimé) : le restaurer, jamais retirer la ligne. |
| `ID_NON_VERROUILLE` | REGLE-07 | erreur | Lancer `npm run ids -- --write` et commiter `ids.lock`. |
| `IDS_LOCK_ABSENT` | REGLE-07 | erreur | Il y a des candidats sans `ids.lock` : lancer `npm run ids -- --write`. |
| `IDS_LOCK_INVALIDE` | REGLE-07 | erreur | Une ligne de `ids.lock` est mal formée, en double ou mal triée : restaurer le fichier depuis Git puis relancer `npm run ids -- --write`. |
| `EQUITE_CANDIDAT_MANQUANT` | REGLE-08 | selon le mode | Un candidat `declare` ou `primaire` n'a ni mesure publiée ni case de couverture sur un thème publié : ajouter la mesure ou la case, ou repasser le thème en brouillon. |
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

Le mode `preview` ne sert qu'en local, pour rédiger un thème sans avoir encore couvert tous les candidats : `npm run validate -- --mode preview` ou `RTP_MODE=preview npm run validate`. Seules `EQUITE_CANDIDAT_MANQUANT` et `EQUITE_COUVERTURE_INCOHERENTE` deviennent des avertissements (annotation `::warning`, code de sortie 0) ; toutes les autres règles continuent de bloquer. `--mode` l'emporte sur `RTP_MODE` et une valeur inconnue est refusée (code de sortie 2). Avant la pull request, relancer en production : c'est ce que fera la CI.

## Déploiement (lot 3, à venir)

GitHub Actions → `rsync -az --delete dist/ $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH`. Rollback : re-lancer le workflow sur le commit précédent.

## Incidents fréquents

### Une mesure publiée sans source
Retirer dans l'heure (passer en `brouillon`), tracer au journal, redéployer.

### Build CI en échec
Ouvrir l'exécution du workflow `CI`. Deux jobs tournent en parallèle :
- `verifier` : lire l'étape en rouge (`migrate`, `validate`, `ids.lock`, `check`, `test` ou `build`). Les étapes s'arrêtent à la première erreur ; la sortie de `npm run validate` nomme le fichier et la règle violée. Reproduire en local avec la même commande.
- `secrets` : gitleaks a trouvé un secret dans l'historique. Ne rien pousser de plus, **révoquer le secret** chez son émetteur, puis traiter l'historique. Faux positif confirmé : ajouter une exception ciblée (motif exact, jamais un dossier entier) dans `.gitleaks.toml`.

### Droit de réponse

À compléter au lot 3 (décision D-4) : adresse de contact dédiée (alias, sans adresse personnelle), délai de réponse et procédure d'un droit de réponse ou d'une demande de retrait. Rien n'est publié tant que ce paragraphe est vide.

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
