# Domain Pitfalls

**Domain:** mise en ligne (Lot 3) d'un site statique Astro sur un VPS Hetzner partagé et saturé, avec rsync depuis GitHub Actions, Caddy, monitoring, import data.gouv de décembre et première publication de contenu politique relu.
**Milestone:** v1.1
**Researched:** 2026-11-06
**Confiance globale:** MEDIUM-HIGH. Le contexte projet est lu dans le dépôt (HIGH). Les limites Let's Encrypt et les textes électoraux sont vérifiés sur les sources officielles ou relayées (voir Sources). Le comportement de Caddy et de rsync vient de l'expérience établie, sans nouvelle vérification de version (MEDIUM). L'interprétation juridique n'est pas un avis : à faire relire (déjà prévu au RUNBOOK, étape 5).

Phases de référence (proposition, à recaler sur le ROADMAP) :
- **P-A** Diagnostic VPS et décision (libérer ou monter en gamme)
- **P-B** Domaine, DNS, Caddy, HTTPS
- **P-C** Pipeline de déploiement (GitHub Actions, rsync, SSH, gardes)
- **P-D** Inlining CSS/script pour la Slow 4G
- **P-E** Contenu : relecture, publication du premier thème, dette W3 W4 W6 W7 W8 W10
- **P-F** Monitoring et sauvegardes
- **P-G** Juridique et mentions (hébergeur actif, journaux, droit de réponse)
- **P-H** Import data.gouv de décembre

---

## Critical Pitfalls

Erreurs qui causent une panne des autres sites, une publication irréversible ou une exposition juridique.

### Pitfall 1 : `rsync --delete` avec un chemin mal formé efface autre chose que le site
**What goes wrong:** `rsync -az --delete dist/ $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH` avec `DEPLOY_PATH` vide, égal à `/`, à `/var/www` (parent commun de tous les sites du VPS) ou sans slash final côté source change complètement le résultat. `dist` sans `/` crée `dist/` dans la cible. Un secret non défini donne `host:` (le home de l'utilisateur SSH). Avec `--delete`, tout fichier absent de `dist/` est supprimé : les autres sites servis par le même Caddy peuvent disparaître.
**Why it happens:** variables de secrets interpolées sans contrôle ; le RUNBOOK actuel (ligne 281) montre la commande nue ; un répertoire racine partagé.
**Consequences:** autres clients d'Erwan hors ligne, restauration depuis des sauvegardes douteuses (disque à 90 %), perte de confiance.
**Prevention:**
- Utilisateur de déploiement dédié, dont le home est le seul répertoire inscriptible ; cible = un répertoire propre au site (`/srv/revele/releases/<sha>`), jamais un répertoire partagé.
- Script de déploiement avec `set -euo pipefail`, qui refuse si `DEPLOY_PATH` est vide, ne commence pas par `/srv/revele/`, ou si `dist/index.html` est absent (garde `DIST_VIDE` existante, à appeler avant rsync).
- Déploiement par release + lien symbolique `current` : `rsync` vers `releases/<sha>/` (sans `--delete` sur un répertoire neuf), puis `ln -sfn` (échange atomique via `mv -T`). Le rollback devient un changement de lien. Garder 3 releases, purger les anciennes (voir Pitfall 6).
- Toujours un `rsync -n --delete --itemize-changes` (dry-run) en première exécution, sortie lue par Erwan ; option `--max-delete=N` en filet.
- Verrou côté serveur : `command="rrsync /srv/revele/releases"` dans `authorized_keys` (Pitfall 2).
**Detection:** le dry-run liste des suppressions hors `dist` ; le site renvoie 404 pendant le rsync (déploiement non atomique) ; `DEPLOY_PATH` apparaît vide dans le journal.
**Phase:** P-C (avant le premier déploiement réel).

### Pitfall 2 : clé SSH de déploiement trop puissante et `known_hosts` contourné
**What goes wrong:** (a) on réutilise la clé personnelle d'Erwan ou une clé avec shell complet sur un VPS partagé ; une fuite de secret CI donne root-équivalent sur les autres sites. (b) Pour « faire marcher » la CI, on met `StrictHostKeyChecking=no` ou on exécute `ssh-keyscan` pendant le workflow : l'empreinte est alors apprise à chaud, donc ouverte à un homme du milieu. (c) La clé privée est mise dans un secret de dépôt, lisible par tout workflow qui s'exécute sur `main`.
**Why it happens:** les tutoriels de rsync-deploy font ces raccourcis ; le dépôt est public, avec CI durcie (SHA épinglés, `persist-credentials: false`) : il serait dommage de ruiner cela.
**Consequences:** compromission de l'hébergeur partagé ; déploiement d'une page piégée sur un site politique.
**Prevention:**
- Clé ed25519 **dédiée**, sans passphrase (CI), créée pour ce seul usage. Dans `authorized_keys` : `restrict,command="rrsync -wo /srv/revele/releases",from="<plage IP>"` si utilisable (les IP des runners GitHub sont larges : `from=` est un bonus, pas la défense principale). `restrict` coupe forwarding, pty, X11. Pas de sudo pour cet utilisateur.
- Les rechargements de Caddy passent par une commande distincte, non par la clé de rsync (voir Pitfall 4).
- Empreinte de l'hôte **épinglée** : récupérer `ssh-keyscan -t ed25519 host` une fois depuis un poste de confiance, comparer à l'empreinte affichée dans la console Hetzner ou via la connexion existante, puis stocker la ligne `known_hosts` complète dans une variable de dépôt (pas besoin que ce soit secret). Le workflow écrit ce fichier et lance ssh avec `-o StrictHostKeyChecking=yes -o UserKnownHostsFile=...`. Prévoir la procédure de rotation si le serveur est réinstallé.
- Secret au niveau d'un **Environment GitHub** `production` avec revue obligatoire (Erwan) et restriction de branche à `main` ; pas de secret de dépôt global.
- Rotation documentée dans le RUNBOOK ; la clé et la passphrase éventuelle dans Vaultwarden.
**Detection:** `ssh -v` sans ligne « Server host key ... matched » ; `authorized_keys` sans `restrict` ; workflow contenant `StrictHostKeyChecking=no` (ajouter un test dans `tests/repo/ci.test.ts`, comme pour `RTP_MODE`).
**Phase:** P-C.

### Pitfall 3 : secrets exposés par les PR de forks ou par un déclencheur mal choisi
**What goes wrong:** le dépôt est **public**. Un workflow de déploiement déclenché par `pull_request_target`, ou un workflow `pull_request` qui checkout le code de la PR avec accès aux secrets, permet à un tiers d'exfiltrer la clé SSH. Variante : `workflow_run` qui consomme l'artefact d'une PR de fork ; injection via le titre de branche ou de PR interpolé dans un `run:` (`${{ github.event.pull_request.title }}`). Variante 2 : le job de déploiement partage le fichier de workflow `ci.yml` et hérite de permissions larges.
**Why it happens:** on veut une URL de test par PR, et on ajoute `pull_request_target` « pour avoir les secrets ».
**Consequences:** déploiement de contenu falsifié sur un site de neutralité politique : atteinte directe à la valeur centrale.
**Prevention:**
- Workflow `deploy.yml` séparé, déclenché **uniquement** par `push` sur `main` (et `workflow_dispatch` protégé), jamais par `pull_request*`. Les PR de forks ne reçoivent de toute façon pas les secrets en `pull_request`, ne rien faire pour changer cela.
- `permissions: {}` par défaut, puis `contents: read` seulement sur le job ; environnement `production` avec relecteur requis.
- Jamais d'interpolation `${{ }}` de données contrôlées par un tiers dans `run:` ; passer par `env:`.
- Réglage du dépôt : « Require approval for all outside collaborators » pour les workflows de forks ; branche `main` protégée, checks requis, pas de push direct.
- Garder gitleaks, `persist-credentials: false`, SHA épinglés (déjà en place) ; ajouter un test de dépôt qui échoue si `pull_request_target` apparaît dans `.github/workflows/`.
- L'artefact `site-preview` des PR ne contient aucun secret ; ne jamais déployer un artefact construit par un workflow de PR.
**Detection:** `grep -r pull_request_target .github/` ; secrets listés dans un job qui tourne sur PR ; journal Actions montrant un accès aux secrets lors d'une PR externe.
**Phase:** P-C.

### Pitfall 4 : un rechargement ou une erreur de Caddyfile casse les autres sites du VPS partagé
**What goes wrong:** Caddy sert déjà d'autres sites. Un bloc ajouté avec une erreur de syntaxe, un hôte déjà pris, une directive globale modifiée (`servers`, `log`, `order`, options `email`), ou un `caddy reload` sur un fichier cassé. `caddy reload` valide avant d'appliquer, donc un fichier invalide laisse l'ancienne config active (bon), mais `systemctl restart caddy` coupe les connexions de tous les sites, et un fichier valide mais mal pensé (bloc `:80` fourre-tout, matcher trop large, `redir` global) change le comportement des autres sites. Un domaine dont le DNS pointe ailleurs fait boucler les tentatives ACME.
**Why it happens:** un seul Caddyfile partagé, édité à la main, sans validation ni sauvegarde.
**Consequences:** panne des sites de clients d'Erwan ; limites Let's Encrypt consommées (Pitfall 5).
**Prevention:**
- Un fichier par site : `import /etc/caddy/sites/*.caddy` dans le Caddyfile principal ; le bloc de reveleTonProg dans `/etc/caddy/sites/revele.caddy` seulement. Aucun changement de bloc global.
- Procédure : copier l'actuel (`cp -a /etc/caddy /root/caddy-backup-$(date +%F)`), `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, puis `systemctl reload caddy` (jamais `restart`), puis `curl -sI` sur **chaque** site existant (liste dans le RUNBOOK) avant et après. Résultat attendu : mêmes codes HTTP.
- `caddy fmt --diff` avant de commiter. Garder le fichier `.caddy` **dans le dépôt** (dossier `deploy/caddy/`) pour la revue ; le déploiement initial se fait à la main, pas par la CI (la CI n'a pas besoin de droit sur Caddy).
- Le bloc dédié : `root * /srv/revele/current`, `file_server`, `encode zstd gzip`, en-têtes de sécurité, `handle_errors` pour 404 propre. Pas de `reverse_proxy`.
- Fenêtre de modification hors des heures chargées des autres sites ; garder une session SSH ouverte pendant le reload ; commande de retour arrière prête (`cp` de la sauvegarde puis `reload`).
**Detection:** `journalctl -u caddy` contient `error` ou `adapting config` ; un autre site change de code HTTP ; `caddy validate` échoue.
**Phase:** P-B (avec contrôle de non-régression des autres sites).

### Pitfall 5 : limites Let's Encrypt et DNS pas propagé à l'émission du certificat
**What goes wrong:** le domaine n'est pas encore acheté. Dès que le bloc Caddy est chargé, Caddy tente l'ACME. Si l'enregistrement A/AAAA n'est pas propagé (ou si un AAAA pointe vers une adresse IPv6 non servie), la validation échoue. Les limites officielles : **5 échecs de validation par identifiant et par compte par heure**, **5 certificats pour le même ensemble d'identifiants par 7 jours (sans dérogation)**, 50 certificats par domaine enregistré par 7 jours, 300 nouvelles commandes par 3 heures. Répéter des essais en production ou supprimer le dossier de données de Caddy (`/var/lib/caddy`) pour « repartir de zéro » redemande de nouveaux certificats et brûle le quota des 5 doublons.
**Why it happens:** on charge la configuration avant que le DNS réponde ; on teste sur la production ; un `www` oublié ; un enregistrement CAA restrictif sur le domaine.
**Consequences:** site sans HTTPS pendant 7 jours sur un domaine qui doit être lancé avant le 15 décembre ; avertissement navigateur à l'ouverture publique.
**Prevention:**
- Ordre : acheter le domaine, créer A (et AAAA seulement si IPv6 vraiment servie), baisser le TTL à 300 s, **vérifier** par `dig +short A domaine @1.1.1.1` et `@8.8.8.8` (et le serveur faisant autorité) avant de charger le bloc Caddy.
- Premier essai sur l'**environnement de staging** de Let's Encrypt (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` dans le bloc), puis retrait de la ligne et rechargement.
- Décider tôt du périmètre des noms (apex seul ou apex + `www` avec redirection) pour ne demander qu'un seul certificat ; ne jamais changer l'ensemble des noms plusieurs fois.
- Ne jamais supprimer `/var/lib/caddy/.local/share/caddy` ; le sauvegarder (Pitfall 12).
- Vérifier port 80 et 443 ouverts (pare-feu Hetzner et `ufw`), CAA éventuel, et que rien d'autre n'occupe le défi HTTP-01 ou TLS-ALPN.
- Si le domaine est un `.fr`, prévoir le délai d'activation du registrar (heures à jours) et le gel éventuel des nouveaux domaines.
- Ajouter une sonde de péremption du certificat (Pitfall 13). Caddy renouvelle seul, mais un échec silencieux de renouvellement se découvre 30 jours plus tard.
**Detection:** journaux Caddy « obtaining certificate » en boucle, `too many failed authorizations`, `urn:ietf:params:acme:error:rateLimited`.
**Phase:** P-B.

### Pitfall 6 : disque plein sur un VPS à 90 % (et RAM saturée pendant un build)
**What goes wrong:** le disque était à 90 % en juillet 2026. Les releases successives, le cache npm, les journaux Caddy, les sauvegardes sur le même disque et les mises à jour système peuvent atteindre 100 %. Disque plein : Caddy ne peut plus écrire ses journaux, ni renouveler le certificat (écriture dans son stockage), rsync échoue à mi-chemin et laisse un site à moitié écrit. Si quelqu'un lance `npm run build` sur le VPS « pour aller vite », la RAM (3,7 Go, pleine) déclenche l'OOM killer, qui peut tuer un autre service.
**Why it happens:** les anciens sites n'ont pas été nettoyés ; la sauvegarde est stockée sur la même machine.
**Consequences:** panne simultanée de tous les sites ; certificat non renouvelé.
**Prevention:**
- P-A : diagnostic en lecture seule (`df -h`, `du -xh --max-depth=2 / | sort -h`, `docker system df`, `journalctl --disk-usage`, `free -m`, swap, OOM passés dans `dmesg`). Décision d'Erwan **avant** tout déploiement : libérer (journald plafonné `SystemMaxUse=200M`, `docker system prune`, anciens paquets) ou monter en gamme (resize Hetzner, ou petit second VPS dédié au site ; coût faible, risque nul pour les autres clients). Recommandation : si le gain de libération est inférieur à 30 % de marge, monter en gamme.
- **Jamais de build sur le VPS** : la CI construit, le VPS ne reçoit que `dist/` (cohérent avec STACK.md). Taille du site faible (limite 500 Ko par page, 134 mesures) : quelques Mo par release, rotation à 3 releases (`ls -1dt releases/* | tail -n +4 | xargs rm -rf`, avec garde de chemin).
- Journaux Caddy avec rotation (`roll_size 10MiB`, `roll_keep 5`, `roll_keep_for 168h` si 7 jours conservés) ; `logrotate` pour le reste.
- Alerte de seuil disque (Pitfall 13) à 85 % avertissement et 92 % critique, tirée par Healthchecks (script cron `df` qui ping seulement si OK : l'absence de ping alerte).
- Sauvegardes hors VPS (Pitfall 12).
- Vérifier l'espace libre dans le script de déploiement avant rsync (`df --output=avail`), et échouer proprement si < 200 Mo.
**Detection:** `df` > 90 % ; `No space left on device` dans le journal CI ; `Out of memory: Killed process` dans `dmesg`.
**Phase:** P-A (décision), P-C (garde dans le script), P-F (alertes).

### Pitfall 7 : publier des brouillons ou du contenu non relu par erreur
**What goes wrong:** le build de production exclut les brouillons, mais l'erreur humaine reste : `RTP_MODE=preview` positionné dans l'environnement du job de déploiement, déploiement de l'artefact `site-preview` à la place de `dist`, `pilote.relecture_ouverte` basculé à `true` puis des fichiers marqués `relu` qui passent en production, un thème marqué `publie` alors que l'équité n'est tenue qu'en apparence, un `noindex`/`robots.txt` de preview servi en production (le site invisible) ou, à l'inverse, absent de la preview servie publiquement (brouillons indexés). Sur un site politique en précampagne, une mesure non relue publiée sous le nom d'un candidat est le pire incident (RUNBOOK : « retirer dans l'heure »).
**Why it happens:** deux builds proches (`dist` et `dist-preview`), jeux de gardes déjà nombreux mais non branchés sur le déploiement.
**Consequences:** atteinte à la neutralité, risque de droit de réponse ou de plainte, perte de crédibilité.
**Prevention:**
- Le job de déploiement construit lui-même (`RTP_DEPLOIEMENT=1`, `RTP_MODE` absent, `validate --mode production`), puis `check-dist` (codes `BROUILLON_EN_PRODUCTION`, `PREVIEW_INDEXABLE`, `CONTACT_PROVISOIRE`, `HEBERGEUR_PREVU` existent déjà), puis seulement rsync. Aucun artefact d'un autre job n'est déployé.
- Ajouter un test de dépôt : le workflow de déploiement ne contient pas `RTP_MODE`, ne télécharge pas `site-preview`, dépend de `needs: verifier`.
- Garde « liste blanche de publication » : fichier `data/publication.yaml` (ou équivalent) signé par commit d'Erwan, listant les thèmes autorisés en ligne ; le build échoue si un thème publié n'y figure pas. Évite qu'un agent ou une PR automatique passe un statut à `publie`.
- Statuts `relu` / `publie` modifiables uniquement par PR approuvée par Erwan (CODEOWNERS sur `src/content/**` pour le champ statut ; protection de branche). Le contenu a été rédigé avec l'aide d'un modèle de langage : la relecture humaine est la seule barrière, elle doit être **tracée** (relecteur, date) et non un simple changement de champ.
- Contrôle post-déploiement : `curl` de la page d'accueil et d'un thème publié, vérifier l'absence de la pastille de brouillon, la présence de l'index, `robots.txt` autorisant, `ARCHIVE_WAYBACK_ABSENTE` résolu pour les sources citées (W9 : trois sources Batho et Rohou à relancer sur Wayback ; ne pas publier les mesures concernées avant).
- Prévoir dans le temps d'Erwan la relecture (le milestone l'a déjà noté) : si la relecture n'est pas finie avant le 15 décembre, la mise en ligne d'un seul thème complet vaut mieux que trois thèmes partiels (l'équité l'impose de toute façon).
- Rollback : la bascule du lien `current` (Pitfall 1) rend le retrait en moins de 5 minutes réaliste.
**Detection:** page de production contenant la pastille de brouillon ou le bandeau de preview ; `meta robots noindex` en production ; `check-dist` rouge.
**Phase:** P-C et P-E.

### Pitfall 8 : exposition juridique à la mise en ligne (LCEN, droit de réponse, période électorale)
**What goes wrong:** plusieurs obligations se cumulent au moment où le site devient public.
1. **Identification de l'éditeur (LCEN art. 1-1, ex-art. 6 III).** Une personne physique non professionnelle peut ne publier que l'identité de l'hébergeur, à condition d'avoir communiqué son identité à l'hébergeur. Un site politique mis à jour régulièrement avec un nom de domaine, un contact public et un travail éditorial structuré peut être jugé « professionnel » (un jugement du tribunal de Caen a requalifié un blog politique publiant 17 à 20 fois par mois ; source de seconde main, MEDIUM). Le RUNBOOK (étapes 1 à 3) prévoit déjà la preuve d'envoi à Hetzner : l'oublier laisse la mention anonyme sans base légale. Ne pas compter sur l'anonymat si le site est une activité éditoriale suivie : prévoir de publier nom, adresse et contact de l'éditeur ou de la structure (association/micro-entreprise), à trancher avec un juriste.
2. **Droit de réponse (LCEN art. 6 IV, décret 2007-1527).** Toute personne nommée peut répondre, dans un délai de trois mois ; réponse à insérer sous trois jours, sinon amende (3 750 EUR selon les sources). Sur un site qui nomme 37 candidats déclarés, l'afflux est probable. **Le RUNBOOK cite « l'article 1-1 » pour le droit de réponse : à corriger en art. 6 IV après vérification** (art. 1-1 porte l'identification). L'adresse de contact `.invalid` rend le droit de réponse impossible à exercer : le garde `CONTACT_PROVISOIRE` doit rester une erreur.
3. **Sondages (loi 77-808 du 19 juillet 1977, art. 11).** La veille et le jour du scrutin, aucun sondage ne peut être publié, diffusé ou commenté ; pour la présidentielle l'interdiction court à partir du **samedi 00h00** précédant le scrutin. Amende 75 000 EUR. La poursuite de la diffusion d'un sondage déjà publié n'est pas interdite, à condition d'indiquer la date de première publication, le média et l'institut. Le blocage du dépôt (`SONDAGE_FENETRE_BLOCAGE`) couvre l'ajout de données, **pas** un cache, un CDN ou un lien depuis une page de commentaire. Le milestone ne publie pas de sondages (M2 est ultérieur) : ne pas laisser de page « sondages » vide mais indexée ni de lien vers elle.
4. **Propagande électorale (Code électoral art. L49).** À partir de la veille du scrutin à 0 h, il est interdit de diffuser par voie électronique tout message ayant le caractère de propagande électorale ; le contenu antérieur n'a pas à être retiré mais ne doit pas être **modifié** (Conseil d'État 2009, d'après une source d'avocat, MEDIUM). Un site neutre n'est pas de la propagande, mais une modification de contenu le samedi et le dimanche du scrutin est un risque d'interprétation : geler les déploiements du vendredi 23 h 59 (heure de Paris) au lundi, sauf correctif de sécurité ou retrait d'une erreur, et le documenter (18 et 2 mai : gel les 17-19 avril et 1er-3 mai 2027).
5. **Arcom / CNCCEP (périmètre).** L'Arcom n'a de compétence directe que sur les services de communication audiovisuelle et certaines plateformes. Un site statique d'un particulier est hors du périmètre du pluralisme audiovisuel, mais la CNCCEP (commission de contrôle de la campagne) et le juge des référés peuvent être saisis, et la loi de 2018 contre la manipulation de l'information permet un référé pendant les trois mois précédant le scrutin contre une allégation inexacte diffusée massivement (art. L163-2 du Code électoral, MEDIUM car non revérifié ici). Conséquence pratique : l'exactitude et le sourçage ne sont pas qu'un principe éditorial, c'est la défense. La période de trois mois avant le premier tour commence mi-janvier 2027.
6. **Données personnelles (RGPD, CNIL).** Les opinions politiques sont une catégorie particulière (art. 9) ; les positions sont celles déclarées publiquement par des candidats, ce qui est une base défendable (données manifestement rendues publiques), mais les fiches de 59 personnalités incluent des non-candidats : vérifier la minimisation. Le cas déjà identifié (pied de page de `erwan-rohou-programme-mei`) montre que les sources contiennent des données de tiers.
7. **Journaux d'accès (Pitfall 9) et Mentions légales.** La page dit « le serveur reçoit l'adresse IP » : doit décrire exactement ce que Caddy conserve.
**Prevention:**
- Passer en revue le point 1 avec Hetzner (preuve datée) ou publier l'identité de l'éditeur ; faire relire les Mentions par un juriste avant le go-live (le RUNBOOK étape 5, ne pas le sauter).
- Corriger le RUNBOOK (droit de réponse : art. 6 IV ; ajouter la fenêtre de gel L49 et sondages).
- Boîte de contact **réelle**, alias dédié, surveillée avec accusé de réception le jour même ; mettre l'alerte « mail reçu » dans le monitoring. Créer le modèle d'accusé de réception et le registre (issue GitHub sans donnée personnelle, déjà prévue).
- Chaque correction de contenu après une demande est tracée par commit et date ; la réponse d'un candidat est présentée comme la sienne, au même emplacement.
- Mettre en place une règle de gel des déploiements autour des deux scrutins (calendrier dans le RUNBOOK + vérification dans le workflow : refus si la date de Paris est dans une fenêtre, sauf `workflow_dispatch` avec raison). Réutiliser la fenêtre de `config.ts` plutôt que dupliquer (leçon W5/W11).
- Ne pas publier de comparaison « qui est devant » sous aucune forme ; les sondages restent hors périmètre de v1.1.
**Detection:** contact `.invalid` en production ; statut hébergeur `prevu` ; message du juriste ; première demande de droit de réponse sans procédure suivie.
**Phase:** P-G (et P-C pour le gel). **Flag : recherche juridique approfondie / avis d'un juriste avant go-live.**

---

## Moderate Pitfalls

### Pitfall 9 : journaux d'accès qui conservent l'adresse IP sans durée définie
**What goes wrong:** le format JSON de Caddy enregistre `remote_ip`, `client_ip`, en-têtes `User-Agent`, `Referer`, sans rotation par défaut sur stdout/journald (conservation selon journald, parfois des mois). Les Mentions légales promettent « ne collecte aucune donnée personnelle » alors que l'adresse IP est une donnée personnelle (CJUE, Breyer). Le site affirme « aucun cookie, aucune donnée » : si les journaux sont plus riches que ce qui est dit, c'est une incohérence publique, dans un projet dont la valeur est la transparence.
**Prevention:**
- Décider : pas de journal d'accès du tout pour ce site (`log` omis dans son bloc ; pas d'analytique, comptes de pages non nécessaires) **ou** journal avec IP tronquée. Caddy permet de filtrer des champs : `log { output file ... { roll_keep_for 168h } format filter { request>remote_ip ip_mask { ipv4 24 ipv6 48 } request>client_ip ip_mask {...} request>headers delete } }` (syntaxe à valider sur la version installée avec `caddy validate`, MEDIUM). Durée conservée courte (7 à 30 jours), alignée avec ce qui est écrit sur Mentions légales.
- Journal séparé par site (`log` dans le bloc du site) pour ne pas mélanger avec les autres clients.
- Journaux d'erreur (erreurs ACME, 5xx) distincts des journaux d'accès : garder les premiers sans IP.
- Mettre à jour la page Mentions légales avec les champs, le masque d'IP et la durée exacte (RUNBOOK étape 4) ; un test de dépôt peut vérifier que la durée écrite égale la valeur du fichier `deploy/caddy/revele.caddy`.
- Les sondes de disponibilité externes (Uptime Kuma) ne doivent pas envoyer de traces contenant l'IP des visiteurs.
**Detection:** `grep remote_ip` dans `/var/log` ou `journalctl -u caddy` plus ancien que la durée annoncée.
**Phase:** P-B (config) et P-G (texte).

### Pitfall 10 : en-têtes de cache qui servent du contenu périmé après une correction
**What goes wrong:** une correction d'erreur factuelle (chiffre, citation) est déployée mais le visiteur voit l'ancienne page, car le navigateur ou un intermédiaire l'a gardée. Cas typiques : `Cache-Control: max-age=31536000, immutable` appliqué à tout (y compris le HTML) ; fichiers sans empreinte (le CSS/script d'amélioration `src/scripts/` avec un nom fixe) ; ou à l'inverse aucun en-tête, et le cache heuristique du navigateur (10 % de l'âge depuis `Last-Modified`) s'applique. rsync ne met pas à jour mtime de manière uniforme (`--checksum` ou `-t` modifie `Last-Modified`/ETag), donc des ETag peuvent rester identiques à tort si seules des permissions ou le contenu avec même taille et mtime changent (`rsync` compare par défaut taille + mtime : une correction de même taille et même mtime peut être **non copiée**).
**Prevention:**
- HTML (`*.html`, `/`) : `Cache-Control: no-cache` (revalidation par ETag, coût faible) ou `max-age=0, must-revalidate`. Actifs avec empreinte (`/_astro/*`) : `public, max-age=31536000, immutable`. Tout le reste (images, `robots.txt`, `sitemap.xml`) : court (1 h).
- Avec le déploiement par releases, chaque release est un nouveau répertoire : le problème rsync mtime disparaît pour la copie ; pour un rsync direct, utiliser `--checksum` (site petit, coût négligeable) .
- Après inlining (Pitfall 11), le CSS est dans le HTML, donc ce risque disparaît pour lui ; le script de niveau doit avoir un nom à empreinte ou être inliné.
- Un test e2e post-déploiement : déployer un changement connu, `curl` avec en-têtes, vérifier l'ETag et le texte.
- Une page de correction visible (« Corrigé le ... ») est du contenu, pas du cache : ne pas l'oublier dans le processus de correction (Pitfall 8, droit de réponse).
- Pas de CDN ni de Cloudflare devant (cookies tiers/IP exposée à un tiers : contraire à la contrainte vie privée) ; si ajouté un jour, prévoir la purge dans le déploiement.
**Detection:** `curl -sI` montrant `immutable` sur du HTML ; deux visiteurs voyant des textes différents ; ETag inchangé après un déploiement qui modifie la page.
**Phase:** P-B (en-têtes Caddy) et P-C (rsync).

### Pitfall 11 : l'inlining du CSS et du script casse le fonctionnement sans JS ou la vérification d'identité
**What goes wrong:** le RUNBOOK dit que `check-dist` refuse `SCRIPT_EN_LIGNE` (tout `<script>` avec un corps), `SCRIPT_NON_BLOQUANT` (le script doit rester bloquant dans `<head>`), `STYLE_EN_LIGNE` (attribut `style=`) et mesure 2048 octets par script. L'inlining demandé pour la Slow 4G entre donc directement en conflit avec ces gardes ; la tentation est de les assouplir ou de les contourner. Autres risques : (a) CSS inline qui gonfle chaque page : 134 mesures × N pages, `POIDS_GZIP` 100 Ko par page ; la mise en cache du CSS partagé est perdue (compter le coût sur des visites répétées) ; (b) l'ordre : le script de niveau inliné doit s'exécuter avant le premier rendu pour éviter un flash du mauvais niveau (c'est la raison du script bloquant) ; (c) `:has()` et radio : le CSS inline doit contenir **tout** ce qui fait fonctionner la bascule sans JS, pas seulement le « critical CSS » (un découpage « critique + reste différé » casse le no-JS si le reste dépend de JS pour se charger) ; (d) la CSP : si une `Content-Security-Policy` stricte est ajoutée, `script-src` doit autoriser le hash de chaque script inline (hash identique pour toutes les pages seulement si le script est octet par octet identique) ; (e) « byte-identity » : les tests ou la comparaison qui supposent un fichier JS/CSS unique identique (comparaison de l'artefact de CI et du déploiement, test de hash du script de niveau) échouent quand le contenu est dupliqué dans le HTML ; (f) `compressHTML` d'Astro 7 (`'jsx'`) peut modifier l'espacement dans le script inline (STACK.md) ; (g) `ESPACE_PERDU` déjà observé sur des mots collés.
**Prevention:**
- Utiliser l'option native `build.inlineStylesheets: 'always'` d'Astro (à vérifier dans la doc Astro 7) pour le CSS plutôt qu'un post-traitement maison, et un petit script `<script is:inline>` pour le niveau ; tester avec Playwright en `javaScriptEnabled: false` **sur la page construite avec inlining** (suite `sans-js`).
- Réécrire les gardes `check-dist` de façon **précise** et non les supprimer : autoriser un seul `<script>` inline dont le contenu a un SHA-256 listé dans une constante (`config.ts`), maximum 2048 octets, toujours bloquant dans `<head>`, sans `async`/`defer`/`type=module` ; `SCRIPT_EN_LIGNE` reste une erreur pour tout autre corps. Tests pièges (`tests/fixtures/pieges/...`) pour le cas autorisé (`--ok`) et le cas refusé.
- Fixer le budget par page après inlining et vérifier `POIDS_GZIP` sur la page la plus lourde ; mesurer à nouveau avec le profil `4g` (150 ms/1,6 Mbit/s sous 1 s ; Slow 4G sous 1,5 s). Le serveur de test local n'a ni DNS ni TLS : prévoir une mesure réelle derrière Caddy après déploiement (RUNBOOK le signale) et s'attendre à ± 300 ms de TLS+DNS à froid. Décision d'Erwan sur le sens du critère « < 1 s » à noter.
- Si une CSP est introduite : hash dans l'en-tête généré à partir du même constat que le garde (une seule source de vérité).
- Ne pas inliner les polices ni les archives ; ne pas déplacer le CSS sous le script (ordre).
**Detection:** test no-JS rouge sur la build inlinée ; `SCRIPT_EN_LIGNE` désactivé « temporairement » dans un commit ; poids gzip proche de 100 Ko ; flash de contenu dans le mauvais niveau.
**Phase:** P-D (avec P-C pour l'ordre des gardes).

### Pitfall 12 : sauvegardes jamais restaurées, stockées au même endroit, ou qui ne couvrent pas l'état de Caddy
**What goes wrong:** « sauvegardes testées » devient un cron `tar` sur le même disque saturé. Ce qui est vraiment perdu en cas de sinistre : la clé de compte ACME et les certificats de Caddy (régénérables, mais soumis aux limites : Pitfall 5), les `authorized_keys` et la configuration du VPS, `/etc/caddy`. Le contenu du site, lui, se reconstruit depuis Git (RUNBOOK « Restauration »), donc inutile de sauvegarder `dist`.
**Prevention:**
- Lister ce qui a besoin d'une sauvegarde : `/etc/caddy`, `/var/lib/caddy` (stockage ACME), configuration SSH/utilisateur de déploiement, scripts de cron, `deploy/`. Tout le reste est reproductible.
- Destination hors VPS (Hetzner Storage Box ou dépôt chiffré), jamais sur le même disque ; chiffrement (restic/borg), clé de chiffrement dans Vaultwarden.
- Test de restauration réel le 1er du mois (règle d'hygiène d'Erwan), consigné dans `RETROSPECTIVE.md`, sur une machine vierge ou un conteneur ; ping Healthchecks.io **à la fin** de chaque sauvegarde (alerte par absence).
- Instantané Hetzner (snapshot) avant la première modification de Caddy (P-B) : coût faible, retour arrière complet.
- Reconstruction du site : tester `git clone` + `npm ci && npm run build` + déploiement sur un VPS neuf au moins une fois avant le 15 décembre (durée mesurée dans le RUNBOOK).
**Detection:** dernier ping Healthchecks ancien ; aucune ligne de restauration dans la rétrospective du mois.
**Phase:** P-F.

### Pitfall 13 : fatigue d'alertes (et alerte qui ne détecte pas la vraie panne)
**What goes wrong:** une sonde HTTP toutes les 30 s avec alerte Telegram à chaque échec envoie une rafale lors d'un reload de Caddy ou d'un déploiement ; au bout de quelques jours l'alerte est coupée ou ignorée. Autres pièges : la sonde contrôle seulement le code 200 sur `/` alors que Caddy sert une page d'erreur ou un autre site (virtual host par défaut) ; l'alerte part du même VPS qui tombe ; le certificat expire sans alerte ; l'espace disque n'est pas surveillé ; le canal Telegram partagé avec les autres clients d'Erwan noie le message.
**Prevention:**
- Sonde externe au VPS (Healthchecks.io pour les cron, un second endroit pour la sonde HTTP : Uptime Kuma sur une autre machine, ou un service gratuit). Pas d'auto-hébergement sur le VPS saturé.
- Sonde qui vérifie le **contenu** (mot-clé présent dans la page d'accueil, par exemple le titre) et un thème publié, pas seulement le code HTTP ; HTTPS vérifié avec date d'expiration (alerte à 14 jours).
- Politique : 3 échecs consécutifs avant alerte (intervalle 1 min), message de reprise (« rétabli »), mode maintenance pendant un déploiement (appel d'API Kuma en début et fin de workflow, ou simple tolérance), résumé hebdomadaire.
- Deux niveaux : critique (site tombé, certificat < 7 jours, disque > 92 %) vers Telegram avec notification sonore ; avertissement (disque > 85 %, certificat < 14 jours, sauvegarde en retard) vers un canal silencieux ou un résumé quotidien.
- Canal Telegram dédié au projet ; tester volontairement une panne (arrêt du bloc Caddy sur un hôte de staging) et mesurer le délai d'alerte avant le go-live ; consigner dans le RUNBOOK qui répond et que faire (rollback = lien `current`).
- Surveiller aussi le flux de contact (le droit de réponse a un délai de 3 jours).
**Detection:** plus d'une alerte non actionnable par semaine ; alertes ignorées ; panne découverte par un visiteur.
**Phase:** P-F.

### Pitfall 14 : l'import data.gouv de décembre change les statuts de candidats déjà publiés
**What goes wrong:** les statuts sont attendus vers le 10 au 13 décembre 2026, c'est-à-dire pendant la semaine du lot 3 (échéance du 15). Le RUNBOOK dit que les statuts s'ajoutent en fin de `statuts[]`, mais le périmètre d'équité (`declare` / `primaire` relu, REGLE-08) dépend du **dernier** statut retenu : un candidat qui passe de `declare` à `ne_se_presente_pas` sort du périmètre d'un thème publié ; un nouveau déclaré **entre** dans le périmètre et la règle `EQUITE_CANDIDAT_MANQUANT` fait échouer le build de production, donc le déploiement du jour est bloqué (ou, pire, les mesures publiées affichent un thème où un candidat n'a pas de ligne). Un statut importé entre en `brouillon` tant que non relu (W2 corrigé) : la page affiche « statut en cours de vérification ». Le W5 historique (« divergera au deuxième import ») a été traité par `dansPerimetre`, mais le contrôle « CI ne revérifie pas la cohérence entre l'instantané data.gouv et les fichiers candidats » reste en dette.
**Prevention:**
- **Ne pas importer pendant la fenêtre de mise en ligne.** Publier d'abord le thème relu sur l'état du jour (statuts relus par Erwan à date X), puis traiter l'import comme une PR séparée avec rapport lu (`--dry-run` d'abord).
- Importer sur une branche : lire le diff `src/content/candidats/` ; pour chaque changement de statut d'un candidat dans le périmètre d'un thème publié, une décision explicite d'Erwan (relecture du statut) ; ne pas fusionner si `EQUITE_*` s'allume sans plan.
- Règle de production : un statut importé ne devient visible qu'après relecture (statut_relecture de chaque entrée de `statuts[]`), de sorte que le site ne change pas de périmètre à la volée ; vérifier ce comportement par un test piège « import ajoute un statut déclaré à un thème publié ».
- Combler la dette : test CI qui compare l'instantané data.gouv le plus récent aux fichiers candidats (cohérence, aucune dérive manuelle).
- Si le périmètre change et que l'équité manque : repasser le thème en brouillon n'est pas acceptable en ligne (retrait public) ; prévoir la case « programme non publié à ce jour » (existante) pour les nouveaux déclarés, plutôt que de dépublier.
- Documenter le « gel des statuts à la date de publication » sur la page Méthode : « statuts à la date du ... ».
- Source amont instable : la date peut glisser (le 10-13 est une attente) ; ne pas faire dépendre le jalon du 15 décembre de cette date.
- Limite sur W6 : `yaml.parse` sans plafond d'alias dans l'import ; traiter avant d'ajouter une source externe supplémentaire.
**Detection:** `EQUITE_PERIMETRE_VIDE` ou `EQUITE_CANDIDAT_MANQUANT` rouge après import ; nombre de candidats dans le périmètre différent de la veille ; rapport d'import avec « conflit ».
**Phase:** P-H (et P-E pour les tests et la dette).

---

## Minor Pitfalls

### Pitfall 15 : `www`, redirections et canonique
**What goes wrong:** l'apex et `www` servent deux fois le même contenu (contenu dupliqué, certificat non prévu pour `www`), `http` ne redirige pas, `<link rel=canonical>` pointe vers l'ancien domaine ou un domaine provisoire. Le domaine est « paramétrable » : un build avec la mauvaise valeur écrit des URL absolues (sitemap, canonical, Open Graph) vers un hôte inexistant.
**Prevention:** une seule variable de domaine, lue par le build et la CI ; `check-dist` vérifie que toutes les URL absolues commencent par ce domaine (et refuse `domaine-a-definir`) ; Caddy redirige `www` vers l'apex (ou l'inverse) ; décider avant l'émission du certificat. HSTS : démarrer avec `max-age` court (ex. 5 min puis 1 semaine) avant d'envisager long/preload, car il est difficile à défaire.
**Phase:** P-B.

### Pitfall 16 : `robots.txt` et indexation involontaires
**What goes wrong:** la preview écrit un `robots.txt` qui interdit tout ; si ce fichier arrive en production, le site est invisible pour les moteurs. L'inverse (preview publique indexée) est tout aussi nocif. Les pages thèmes encore vides ou « Aucun thème publié » sont indexées avec un contenu pauvre.
**Prevention:** vérifier `robots.txt` et `sitemap.xml` en post-déploiement ; `noindex` sur l'URL de test ; ne pas annoncer l'URL avant la relecture.
**Phase:** P-C et P-E.

### Pitfall 17 : permissions et propriétaire après rsync
**What goes wrong:** rsync avec `-a` depuis un runner conserve des permissions/propriétaires inadaptés : Caddy (utilisateur `caddy`) ne peut pas lire les fichiers (403), ou les répertoires sont `700`.
**Prevention:** `--chmod=D755,F644` et `--no-owner --no-group` ; utilisateur de déploiement dans un groupe lisible par `caddy` ; test `curl` après chaque déploiement (smoke test), échec du workflow si code ≠ 200.
**Phase:** P-C.

### Pitfall 18 : actions de la CI et artefacts non reproductibles
**What goes wrong:** `permissions: contents: read` peut empêcher `upload-artifact` (hypothèse A4 du RUNBOOK, étape 8 non vérifiée) ; un build non déterministe (dates, ordre aléatoire) empêche la comparaison entre l'artefact testé et celui déployé ; la mise à jour d'une action épinglée par Dependabot rompt le déploiement la veille d'un jalon.
**Prevention:** construire une seule fois, tester ce même `dist/`, le déployer (artefact `download-artifact` à l'intérieur du **même** run) ; pinner les SHA ; gel des mises à jour de dépendances pendant les deux semaines autour du go-live et des scrutins.
**Phase:** P-C.

### Pitfall 19 : dette de l'audit v1.0 non soldée avant la publication
**What goes wrong:** W3 (en preview « 27 sur 37 ont une position publiée » alors que ce sont des brouillons), W4 (aucun test de parcours par clics, bfcache), W6, W7 (types écrits à la main), W8 (journal d'audit antérieur aux correctifs), W10 (« Sources consultées » des cases vides sans lien) : W3 et W10 produisent un texte inexact ou invérifiable, donc touchent à la neutralité et au sourçage en ligne. W9 (trois sources sans Wayback) bloque certaines mesures.
**Prevention:** classer la dette en « bloquant le go-live » (W3 si visible en production, W10, W9 pour les mesures concernées) et « peut suivre » (W6, W7, W8) ; lier la liste aux critères de sortie de P-E.
**Phase:** P-E.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| P-A Diagnostic VPS | Décider en ayant trop peu mesuré ; libération risquée sur serveur partagé (suppressions de données d'autres clients) | Lecture seule, tableau des consommateurs, décision écrite d'Erwan ; snapshot Hetzner avant toute action ; préférer un resize ou un second VPS (Pitfall 6) |
| P-B Domaine / Caddy / HTTPS | Reload cassant les autres sites ; limites ACME ; DNS pas propagé ; journaux avec IP | Fichier de site importé, `caddy validate` puis `reload`, staging ACME, `dig` multi-résolveurs, journal masqué (Pitfalls 4, 5, 9, 15) |
| P-C Pipeline | `--delete` mal ciblé ; clé SSH large ; secrets exposés à une PR ; brouillon déployé | Releases + lien `current`, `rrsync`, host key épinglée, environnement protégé, workflow dédié, build de prod dans le même job (Pitfalls 1, 2, 3, 7, 17, 18) |
| P-D Inlining Slow 4G | Casse `check-dist` ou le no-JS ; poids par page ; mesure réelle différente du serveur local | Gardes précises avec hash du script, tests no-JS sur la build inlinée, mesure derrière Caddy réel (Pitfall 11) |
| P-E Contenu et dette | Publication de non relu ; équité incomplète ; W3/W10 faux en ligne ; W9 bloque | Liste blanche de publication, relecture tracée, dette classée bloquante/non (Pitfalls 7, 19) |
| P-F Monitoring / sauvegardes | Alertes bruyantes ; sauvegardes non testées ; surveillance sur le VPS qui tombe | Sondes externes, seuils à 3 échecs, deux niveaux, test de restauration mensuel, ping par absence (Pitfalls 12, 13) |
| P-G Juridique | Anonymat sans base ; droit de réponse impossible (contact `.invalid`) ; gel de période électorale oublié ; Mentions fausses sur les journaux | Revue juridique, preuve Hetzner, contact réel, RUNBOOK corrigé, gel des déploiements (Pitfall 8) |
| P-H Import de décembre | Statuts changeant le périmètre d'un thème publié, juste avant le jalon du 15 | Import séparé et relu, sans bloquer le go-live, test piège du cas, test CI instantané/candidats (Pitfall 14) |

## Points nécessitant une recherche plus poussée plus tard

- Avis juridique sur le statut d'éditeur (professionnel ou non) et sur le rôle de la période électorale pour un site d'information neutre (Pitfall 8) : sources de seconde main seulement ici.
- Syntaxe exacte du filtre de journal Caddy (`ip_mask`) sur la version installée ; version de Caddy et plugins du VPS inconnus (P-A).
- Option d'inlining Astro 7 (`build.inlineStylesheets`) et interaction avec `compressHTML` : à vérifier dans la doc 7.x au démarrage de P-D.
- Date réelle de publication des statuts data.gouv de décembre (attendue 10-13 décembre, non garantie).

## Sources

- Let's Encrypt, limites de débit : https://letsencrypt.org/docs/rate-limits/ (HIGH ; consulté le 2026-11-06 : 5 échecs/h par identifiant, 5 certificats identiques/7 jours sans dérogation, 50 par domaine enregistré/7 jours, 300 commandes/3 h ; environnement de staging recommandé)
- Loi n° 77-808 du 19 juillet 1977, art. 11 (sondages la veille et le jour du scrutin, début samedi 00h00 pour la présidentielle, amende 75 000 EUR) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547 ; synthèse CNCCEP : https://www.cnccep.fr/pdf-cp8.html (MEDIUM-HIGH : texte résumé par la recherche, non relu en entier)
- Code électoral, art. L49 (message de propagande par voie électronique interdit dès la veille du scrutin à 0 h) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215 ; Conseil constitutionnel, « Peut-on faire campagne sur Internet le jour et la veille du scrutin ? » : https://presidentielle2017.conseil-constitutionnel.fr/tout-savoir/la-campagne-sur-internet/on-faire-campagne-internet-jour-veille-scrutin/ ; communiqué CNCCEP de 2022 : https://www.cnccep.fr/pdf-cp15.html (MEDIUM)
- LCEN (loi 2004-575) art. 6 (version Légifrance en vigueur au 2026-11-06 : ne contient plus l'identification des éditeurs, renvoie à l'article 1-1) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000042038977 (HIGH pour ce constat)
- Droit de réponse en ligne (art. 6 IV LCEN, trois mois, insertion sous trois jours, décret 2007-1527) : https://www.droit-technologie.org/actualites/comment-exercer-un-droit-de-reponse-sur-linternet/ ; https://www.lexbase.fr/revues-juridiques/3223924-commentedanslarubriquebinternetbtitrenbspipublicationdudecretsurledroitdereponseenl (MEDIUM : sources secondaires, à confirmer par le juriste)
- Anonymat des éditeurs non professionnels déplacé à l'article 1-1, II par la loi SREN (mai 2024) et jurisprudence de Caen sur le blog politique : https://www.simonnetavocat.fr/mentions-legales-dun-site-internet-obligations-sanctions-et-modele/ ; https://dimeglio-avocat.com/identification/ (LOW-MEDIUM : cabinets d'avocats, non vérifié sur Légifrance)
- Contexte projet lu dans le dépôt : `.planning/PROJECT.md`, `docs/RUNBOOK.md`, `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (HIGH)
- Comportements de Caddy (`reload` validant avant application, `import`, `log` avec filtres, rotation), de rsync (comparaison taille + mtime par défaut, `--delete`, `--max-delete`, `rrsync`) et de GitHub Actions (secrets non transmis aux PR de forks en `pull_request`, danger de `pull_request_target`) : connaissance établie, non revérifiée dans cette session (MEDIUM) ; à confirmer sur la documentation Caddy et GitHub au démarrage de P-B et P-C.
- Non couverts ici : loi de 2018 sur la manipulation de l'information (art. L163-2 du Code électoral), cité de mémoire (LOW-MEDIUM).
