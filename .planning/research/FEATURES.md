# Feature Landscape : v1.1 Lot 3 (hébergement et mise en ligne)

**Domain:** petit site statique d'information civique qui passe en production (éditeur non professionnel, un seul relecteur)
**Researched:** 2026-11-06
**Scope:** seulement les nouvelles fonctions de v1.1. Le reste est déjà validé (voir PROJECT.md « Validated »).
**Overall confidence:** MEDIUM. Les points juridiques sont étayés par des textes officiels ou la CNIL, sauf mention contraire. La relecture par un juriste (RUNBOOK étape 5) reste nécessaire.

## Points juridiques à connaître (sourcés)

| Point | Ce que disent les sources | Conséquence pour le lot | Confiance |
|---|---|---|---|
| Mentions légales de l'éditeur : LCEN art. 1-1 (déplacé depuis l'art. 6 III par la loi SREN 2024-449, en vigueur depuis le 23 mai 2024) | Un éditeur « à titre non professionnel » peut, pour préserver son anonymat, n'afficher que le nom et l'adresse de son hébergeur, à condition d'avoir communiqué son identité à cet hébergeur. L'hébergeur doit toujours être nommé. | Hetzner étant l'hébergeur, la page Mentions légales nomme Hetzner (raison sociale + adresse) et l'éditeur. Un site politique avec un directeur de publication nommé est plus crédible : décider si Erwan s'identifie. Le statut « non professionnel » est discutable si le site est lié à une activité freelance : question à poser au juriste. | MEDIUM (sources secondaires ; texte Légifrance non récupéré, art. 1-1 à relire) |
| Droit de réponse en ligne (LCEN, décret 2007-1527) | Déjà traduit dans docs/RUNBOOK.md « Droit de réponse » : demande écrite, délai de 3 mois, insertion sous 3 jours. | Il faut une adresse de contact réelle pour que la procédure fonctionne (le RUNBOOK le dit). Pas de nouveau code, seulement le contact et un alias dédié. | MEDIUM (numérotation post-SREN à confirmer) |
| Journaux serveur : RGPD, pas art. 82 | Les adresses IP des logs sont des données personnelles. La CNIL (délibération 2021-122 du 14/10/2021 sur la journalisation) recommande une conservation de 6 mois à 1 an, avec purge ou anonymisation automatisée. Le guide RGPD du développeur juge 6 mois généralement adéquat. Plus long = justification. La conservation légale d'un an vise surtout les hébergeurs et les FAI. | Caddy : rotation + durée fixe (proposition : 30 jours bruts maximum, car l'usage est la fréquentation et le débogage, pas la sécurité d'un SI ; au plus 6 mois). Documenter dans Mentions légales : champs, IP entière ou tronquée, durée. Choix de conception : ne pas loguer l'IP entière (masquer le dernier octet / désactiver `client_ip` si inutile). | MEDIUM (résumé de recherche web, délibération non relue ; lien à vérifier sur cnil.fr) |
| `localStorage` pour le niveau de lecture | Le stockage local est un « traceur » au sens de l'art. 82 loi Informatique et Libertés. Sont exemptés de consentement les traceurs strictement nécessaires, dont la personnalisation attendue de l'interface ; la CNIL recommande une finalité unique et un nom explicite. | L'hypothèse A2 du RUNBOOK est cohérente. À faire : clé au nom explicite, une seule finalité, mention dans la page Mentions légales/vie privée, aucune autre donnée dedans. Validation finale par le juriste. | MEDIUM (CNIL, recommandation cookies consolidée janvier 2026) |
| Mesure d'audience exemptée | Exemption possible seulement avec finalité limitée à l'éditeur, information, 25 mois maximum, etc. Les logs côté serveur ne relèvent pas de l'art. 82 mais du RGPD. | Rester sur les logs Caddy anonymisés (déjà la décision de la spec). Aucun outil de mesure : donc pas de bandeau cookies. | MEDIUM |
| Informations RGPD | Un site qui reçoit des IP doit informer (finalité, base légale intérêt légitime, durée, droits, contact). | Section « Vie privée » dans Mentions légales, alimentée depuis `config/site.yml` (durée de conservation lue de la même config que Caddy). | MEDIUM |

Sources : https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications ; https://www.cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf ; https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ ; https://lincnil.github.io/Guide-RGPD-du-developpeur/ ; https://www.legifrance.gouv.fr (LCEN, loi 2004-575, art. 1-1 et 6) ; synthèses secondaires : https://www.tinyterms.fr/blog/mentions-legales-site-web-obligatoires, https://legalnest.io/en/guides/legal-notice-website-france/.

## Catégorie 1 : Diagnostic VPS et décision (libérer ou monter en gamme)

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Script de diagnostic strictement en lecture seule (`free`, `df`, `du` des plus gros dossiers, état Caddy, docker ps, load, swap) lancé à la main et sortie collée dans un rapport | Décision éclairée d'Erwan avant toute action destructive ; la spec §8 l'exige | Basse | Aucun code existant ; garder le script dans le dépôt, sans secret, avec liste blanche de commandes |
| Rapport de décision : seuils chiffrés (disque < 80 %, RAM disponible > X, swap) et recommandation libérer / monter | « Décision attendue d'Erwan » : lui donner une question fermée | Basse | Coût indicatif en spec : +10 EUR/mois si montée en gamme |
| Sauvegarde/snapshot avant toute libération d'espace ou redimensionnement | Évite de perdre les services existants du VPS | Basse | Snapshot Hetzner = action humaine ou via API |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Vérification de la charge mémoire du site seul (mesurée avant/après activation du bloc Caddy) | Preuve chiffrée que le statique ajoute « presque rien » (spec lot 3) | Basse | Un `free -m` avant/après suffit |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Nettoyage automatique de disque par script | Disque à 90 %, services tiers inconnus : risque de destruction | Liste des candidats à suppression, Erwan valide |
| Ajouter un conteneur permanent ou un outil de monitoring lourd sur la machine saturée | RAM saturée en juillet 2026 | Sonde externe (Healthchecks.io / Uptime Robot) et non Uptime Kuma sur ce VPS, sauf si le diagnostic montre de la marge |

## Catégorie 2 : Domaine, Caddy, HTTPS

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Domaine paramétrable : une seule variable (`config/site.yml` + variable CI) alimente `astro.config` (site/canonical), sitemap, robots, Caddy | Domaine pas encore acheté : le code ne doit pas le coder en dur | Moyenne | Config `site.yml` existe (contact, hébergeur) ; vérifier ce qui lit déjà le domaine, canonical, URLs de sitemap |
| Bloc Caddy dédié (fichier à part importé, pas d'édition du Caddyfile existant sans sauvegarde), `caddy validate` puis `reload` | Caddy déjà en place pour d'autres sites | Basse | Cache long assets hachés, cache court (5 min) pour les futures pages sondages, compression gzip/zstd (la spec l'exige ; le test 4G mime déjà gzip) |
| HTTPS automatique + redirection www/apex + HSTS prudent (court d'abord) | Attendu de tout site ; ACME gère le certificat | Basse | Dépend de l'achat du domaine et du DNS (A/AAAA) : action humaine |
| En-têtes de sécurité (CSP stricte sans script externe, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) | Cohérent avec « aucun script externe » ; la CSP doit autoriser le script de niveau inline (hash ou nonce statique) | Moyenne | Lien avec la catégorie « Slow 4G » : si le script de niveau devient inline, il faut un hash CSP calculé au build |
| Page 404 statique et `robots.txt`/sitemap corrects (pas d'indexation en preview) | Un site civique doit être indexable en production et pas en preview | Basse | Mécanisme preview vs production existe (M1) |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Test post-déploiement automatique (fumée) : HTTPS valide, en-têtes, 200 sur 3 pages, sha du build affiché | Détecte un mauvais déploiement avant l'utilisateur | Basse | Réutilise la suite Playwright ou un `curl` |
| `.well-known/security.txt` | Standard peu coûteux pour un site civique | Basse | Optionnel |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| CDN tiers / Cloudflare devant le site | Violerait la promesse « aucun tiers » et ajouterait un sous-traitant RGPD | Caddy seul |
| HSTS `preload` d'emblée | Irréversible en pratique | `max-age` court puis allongé |

## Catégorie 3 : Déploiement rsync depuis GitHub Actions

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Job `deploy` avec `RTP_DEPLOIEMENT=1`, `needs:` des jobs de qualité, sur `main` uniquement, `environment: production` | La garde existe : elle fait échouer le build si contact provisoire ou hébergeur « prévu » | Moyenne | Dépend de `CONTACT_PROVISOIRE` et `HEBERGEUR_PREVU` (RUNBOOK) ; le build de production et celui de preview doivent rester distincts |
| Clé SSH de déploiement dédiée, restreinte (`command=`/rrsync, un seul dossier, utilisateur non-root), dans GitHub Secrets ; `known_hosts` épinglé | Principe de moindre privilège ; règle d'hygiène sur les secrets | Moyenne | Pas de nouveau secret dans le dépôt ; gitleaks déjà en CI |
| Déploiement atomique : rsync vers `releases/<sha>/` puis bascule du lien symbolique `current`, garder N versions | Pas de site à moitié copié ; retour arrière en une commande | Moyenne | Caddy sert `current/` |
| Retour arrière documenté et testé (RUNBOOK) | Hygiène n°5 | Basse | |
| Exclusion des archives de sources du rsync (le VPS ne reçoit que `dist/`, disque à 90 %) | Contrainte de la spec/stack | Basse | Vérifier que `dist/` ne contient pas les binaires d'archive privés |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Fichier `version.json`/commentaire avec sha + date du build, visible en pied de page ou page Méthode | Lien direct avec W8 (journal d'audit lié au build courant) et support de diagnostic | Basse | |
| Approbation manuelle (environment protégé) avant production pour la première mise en ligne | Dernier garde-fou éditorial | Basse | À retirer quand le pipeline quotidien (lot 5) arrive |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Déploiement depuis une pull request de fork ou sur chaque branche | Risque de fuite de clé/publication de brouillons | `main` + environment |
| Auto-hébergement d'un runner sur le VPS saturé | RAM | Runner GitHub hébergé |

## Catégorie 4 : Mise en ligne du contenu relu seul et workflow de relecture

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Build de production qui n'inclut que `relu`/`publie` ; les `brouillon` n'apparaissent jamais (ni page, ni sitemap, ni index de recherche, ni compte « N candidats ont une position ») | Promesse centrale : seul le contenu relu est en ligne | Moyenne | Le filtre preview/production existe (M1) ; à valider avec W3 (libellés de couverture en preview) |
| Gate de publication : au moins un thème entièrement relu (équité : tous les candidats déclarés du thème au même niveau) avant que le déploiement réussisse | Règle d'équité §5 et « au moins un thème relu » | Moyenne | Règles d'équité en CI existent (phase 2) ; ajouter un contrôle de production explicite |
| File de relecture visible par Erwan : liste des mesures `brouillon` par thème avec lien source/archive/extrait, et commande pour passer à `relu` (avec relecteur + date) | Un seul relecteur humain, 134 mesures : il faut un outil, pas un tableur | Moyenne | `statut de relecture`, `relecteur`, `date` existent dans le schéma §7 ; CLI `npm run` à ajouter |
| Budget de temps de relecture planifié dans la roadmap (estimation : 134 mesures, par ex. 3-5 min chacune = 7-11 h pour tout ; un thème = environ 45 mesures soit 3-4 h) | Le risque principal est humain | Basse | À poser dans le plan de phase, avec un thème pilote d'abord (probablement le plus couvert) |
| Droit à la correction visible : lien « signaler une erreur » vers le contact réel | Spec §10 et Méthode | Basse | Contact à remplacer (`CONTACT_PROVISOIRE`) |
| Mention explicite dans le site que le contenu a été rédigé avec un modèle de langage puis relu | Déjà dit dans Qui sommes-nous/Méthode ; vérifier que la formulation reste vraie une fois en production | Basse | |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Date et nom du relecteur affichés par mesure (« relu le … ») | Transparence ; la donnée existe | Basse | Respecte la neutralité si le relecteur est l'éditeur |
| Rapport « couverture publiée » honnête (ex. « 1 thème sur 3 est en ligne, les autres arrivent ») sur la page d'accueil | Évite de laisser croire à un site complet ; recoupe W3 | Basse | |
| Échantillon de contrôle par un 2e regard (même informel) avant le premier déploiement | Réduit le risque d'erreur factuelle sur un site politique | Basse | Hors outils : processus |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Passage automatique `brouillon` → `relu` par un agent | Casse l'engagement « relu par un humain » | Le passage est un commit humain, vérifié par la CI |
| Publier un thème à moitié relu (certains candidats seulement) | Viole l'équité | Gate de thème complet |
| Cacher les brouillons par CSS ou `noindex` | Ils resteraient dans le HTML déployé | Exclusion au build |

## Catégorie 5 : Import data.gouv de décembre (re-import du jeu de données)

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Import idempotent et déterministe : même entrée = même sortie, diff lisible dans une PR, jamais commit direct sur `main` | Contenu dans Git, relecture humaine du diff | Moyenne | `import-datagouv.ts` existe (phase 3) ; W6 : plafond d'alias à ajouter sur `yaml.parse` |
| Les ids ne changent jamais ; un candidat retiré reste avec historique (spec §7) ; `ids.lock` continue de bloquer les renommages | Règle de données | Moyenne | `ids.lock` et migrations existent |
| Détection des changements de statut : nouvelle ligne d'historique avec date et source du statut, pas d'écrasement | Un changement de statut passe par la procédure de la spec §9 | Moyenne | Schéma candidat : statut, date du statut, source du statut |
| Rapport de diff d'import (nouveaux, retirés, statut changé, champ modifié, doublons/homonymes) lisible par Erwan avant fusion | Les jeux de données ouverts sont corrigés sans préavis | Moyenne | Réutiliser la sortie d'annotation de la CI |
| Piège de données : candidat présent dans les mesures mais disparu de la source → alerte, pas suppression | Évite les références orphelines | Basse | `reference()` entre collections existe |
| Aucune édition des champs rédigés à la main (nom affiché, étiquette revendiquée, site officiel vérifié) | Fusion non destructive | Moyenne | Définir quels champs sont « propriété de l'import » |
| Fenêtre de décision : import le ~10-13 décembre, déploiement avant le 15 décembre, donc un buffer de relecture | Échéance de la spec | Basse | Planifier un import à blanc avant (sur la version actuelle de data.gouv) |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Instantané brut du jeu importé archivé avec sha256 (mécanisme d'archivage existant) | Reproductibilité et preuve de provenance | Basse | Outil d'archive (extrait + sha256) existe |
| Test sur un jeu « piégé » (homonymes, statut inconnu, date invalide, id changé) | Cohérent avec §12 | Moyenne | `node:test` |
| Journal public de modifications (M5) alimenté plus tard par ces diffs | Prépare le lot 5 | Basse | Hors v1.1 : seulement garder un format réutilisable |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Re-import automatique par cron avant le lot 5 | Pas de relecture, pas de journal public | Commande manuelle + PR |
| Faire confiance à un statut sans source | Règle « source primaire » ; data.gouv est un indice, pas une source de mesure | Garder la source du statut du jeu et la citer comme telle |

## Catégorie 6 : Dette d'audit v1.0 (W3, W4, W6, W7, W8, W10)

| Item | Attendu / comportement | Complexité | Dépend de | Table stakes ? |
|---|---|---|---|---|
| W3 libellé de couverture en preview | « 27 candidats sur 37 ont une position publiée » est faux tant qu'elles sont des brouillons : libellé « brouillon » en preview, calcul sur le statut publié en production | Basse | Filtre preview/production, tests de libellé | Oui (honnêteté) |
| W4 test navigateur par clics du niveau persistant (inter-pages + bfcache) | Playwright : cliquer le niveau, naviguer, retour arrière (bfcache via `pageshow` persisted), vérifier le niveau | Moyenne | Suite Playwright, script de niveau (client) ; sera touché par l'inlining Slow 4G, donc écrire le test après ou avec | Oui |
| W6 plafond d'alias YAML sur les parse directs | `maxAliasCount` (option `yaml`) ou passer par le parseur partagé de content-core | Basse | `import-datagouv.ts`, `archive-source.ts` | Oui (sécurité import avec données externes) |
| W7 types de vue écrits à la main | Générer les types depuis les schémas ou test de dérive types/schéma | Moyenne | `src/lib/corpus/types.ts`, schémas JSON | Oui pour éviter les régressions silencieuses ; la génération complète est un différenciateur |
| W8 journal d'audit lié au build courant | Rejouer le test croisé sur le build à déployer et enregistrer sha du commit dans `audit/journal.jsonl` ; test qui échoue si le sha ne correspond plus | Moyenne | `audit/journal.jsonl`, empreintes | Oui avant la production |
| W10 sources vides sans lien/date/archive | Un cas vide affiche soit « aucune source publiée à ce jour » avec date de consultation, soit lien + date + archive ; jamais une case vide | Basse | Composant « Sources consultées », schémas | Oui (cœur de la promesse) |

## Catégorie 7 : Slow 4G sous 1 s (CSS et script de niveau en ligne)

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| CSS critique en ligne dans `<style>` de chaque page (Astro `build.inlineStylesheets: 'always'` ou `'auto'` à seuil) | Supprime une requête bloquante, donc une latence aller-retour de 150 ms sur Slow 4G | Basse | Config Astro ; vérifier le budget de poids de page (`check-weight.ts`) : le CSS est répété sur chaque page |
| Script de niveau en ligne (`is:inline`), < 2 KB, avec hash CSP | Pas de requête supplémentaire ; reste un enrichissement progressif | Basse | CSP de la catégorie 2 ; le comportement sans JS (radios `:checked`) ne doit pas changer |
| Mesure fiable : test CDP Slow 4G dans Playwright (déjà là) sur les pages les plus lourdes, après gzip comme Caddy | Critère mesuré, pas supposé | Moyenne | Test 4G existant ; serveur de test avec gzip existant |
| Trancher le critère (deux profils publiés : 150 ms de latence sous 1 s, ou Slow 4G Lighthouse sous 1,5 s) et l'écrire dans la spec/Méthode | Décision d'Erwan en attente | Basse | À poser en début de phase |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Budget de poids par type de page appliqué en CI avec message d'échec chiffré | Évite la régression | Basse | Existe en partie |
| Page de grand volume (thème avec 59 personnalités) : séparer Détaillé sur page candidat plutôt que lazy-loading JS (déjà dans Stack Patterns) | Tient le budget sans JS | Moyenne | Seulement si le test dépasse |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Polices distantes, préchargement CDN, service worker | Tiers / complexité / risque de contenu périmé | Pile de polices système |
| Optimiser avec un framework JS ou un outil de bundling en plus | Ajoute une dépendance et du JS | Config Astro suffit |

## Catégorie 8 : Surveillance (monitoring) et sauvegardes

### Table stakes
| Feature | Pourquoi attendu | Complexité | Dépendances / notes |
|---|---|---|---|
| Sonde de disponibilité HTTPS toutes les 1-5 min sur la page d'accueil et une page profonde, vérifiant le code 200 + une chaîne attendue | Attendu de tout service en ligne ; règle d'hygiène n°8 | Basse | Choix : service externe gratuit (Healthchecks.io en mode ping depuis le VPS ne détecte pas une panne du VPS entier ; Uptime Robot/Better Stack en sonde externe oui) ou Uptime Kuma sur le VPS (inutile s'il tombe avec lui) |
| Alerte Telegram (bot, chat id dans Vaultwarden/GitHub Secrets) avec message d'incident et de rétablissement | Demandé par la spec | Basse | Aucun secret dans le dépôt |
| Surveillance de l'expiration du certificat TLS (alerte à J-14) | Cause fréquente de panne d'un petit site | Basse | Souvent incluse dans la sonde |
| Surveillance disque/RAM du VPS avec seuils (disque 85 %) | Le VPS est déjà à 90 % | Basse | Cron simple avec ping Healthchecks.io « dead man's switch » |
| Quoi sauvegarder : le site est reconstructible depuis Git, donc le vrai périmètre est (a) le dépôt (déjà sur GitHub), (b) les archives de sources binaires privées, (c) la config Caddy et les clés | Évite des sauvegardes inutiles | Basse | Les binaires privés (PDF, MHTML) ne sont pas tous dans Git : vérifier où ils vivent |
| Sauvegarde testée (restauration réelle sur un dossier vide ou un clone) le 1er du mois, résultat noté dans RUNBOOK/RETROSPECTIVE | Hygiène n°6 | Moyenne | Compte-rendu daté ; premier test avant la mise en ligne |
| Rotation et purge des logs Caddy conformes à la durée annoncée | Cohérence avec Mentions légales | Basse | Catégorie « points juridiques » |

### Differentiators
| Feature | Valeur | Complexité | Notes |
|---|---|---|---|
| Page de statut ou badge public | Transparence | Moyenne | Pas nécessaire au pilote |
| Sonde de contenu : alerte si un mot interdit ou une source morte apparaît en production | Complète la CI | Moyenne | Lot 5 plus naturel |
| Vérification périodique des liens des sources primaires (liens morts, archive Wayback manquante : voir W9) | Spécifique au domaine : les sources se déplacent | Moyenne | `ARCHIVE_WAYBACK_ABSENTE` bloque déjà la publication des mesures concernées ; relancer l'archivage Wayback de Delphine Batho est un prérequis opérationnel de la publication de ces mesures |

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Analytics, pixels, Matomo/Plausible hébergés | Promesse « aucune mesure externe », sinon bandeau/consentement | Logs Caddy anonymisés |
| Pile Prometheus/Grafana sur le VPS | RAM | Sonde externe + cron |
| Sauvegarde jamais testée | Fausse assurance | Test de restauration mensuel |

## Catégorie 9 : Conformité à l'ouverture (check-list)

### Table stakes (à cocher avant le premier déploiement)
1. Domaine acheté, DNS en place, `config/site.yml` renseigné.
2. Hébergeur `statut: actif` (Hetzner : raison sociale et adresse), éditeur identifié ou régime d'anonymat via l'hébergeur (LCEN art. 1-1).
3. Contact réel et alias dédié, testé par un message de bout en bout (droit de réponse).
4. Mentions légales à jour : données reçues par le serveur (IP, durée), `localStorage` (finalité unique), absence de cookies, droits RGPD et contact.
5. Page Méthode : liste des mots interdits, formule de lisibilité, seuils, mention modèle de langage + relecture.
6. Revue juridique des Mentions légales (RUNBOOK étape 5) ; si elle ne peut pas être faite à temps, noter le risque accepté par Erwan.
7. Logs Caddy configurés (format JSON, IP masquée ou purgée, rotation).
8. Sondes et alertes actives, sauvegarde testée.
9. Garde `RTP_DEPLOIEMENT=1` verte en CI sans contournement.
10. Procédure de retrait d'urgence (retirer une mesure ou la page en moins d'une heure, comme dans la spec §10).

### Anti-features
| Anti-feature | Pourquoi éviter | Alternative |
|---|---|---|
| Générateur de mentions légales tiers à copier tel quel | Texte non adapté (éditeur anonyme, pas de cookies) | Page générée depuis la config (déjà le cas) |
| Bandeau cookies | Inutile sans traceur soumis au consentement, et un bandeau inutile fait douter | Aucun traceur, information dans la page |
| Déclaration de traitement à la CNIL | Régime de déclaration supprimé en 2018 (RGPD) | Registre interne simple (3 lignes) dans le dépôt |

## Dépendances entre fonctions

```
Décision VPS -> bloc Caddy -> déploiement rsync -> mise en ligne
Achat du domaine -> config domaine -> HTTPS -> contact réel -> garde RTP_DEPLOIEMENT=1 verte
Contact réel + hébergeur actif -> Mentions légales finales -> revue juridique
Inlining script de niveau -> hash CSP (Caddy) ; inlining -> test W4 à écrire après
W3 + W10 + relecture d'un thème -> contenu de production crédible
Import data.gouv (W6 d'abord) -> PR de diff -> relecture -> déploiement avant le 15/12
Logs Caddy configurés -> section vie privée des Mentions légales
Sauvegarde testée + sonde -> go-live
```

## Recommandation MVP pour v1.1

Prioriser :
1. Diagnostic VPS et décision (bloque tout).
2. Domaine/Caddy/HTTPS + déploiement atomique avec garde, sans contenu complet.
3. Un thème relu (outil de file de relecture + gate d'équité de thème) et W3, W10, W8.
4. Mentions légales finales, contact réel, logs Caddy anonymisés.
5. Inlining CSS/script + test W4 + critère Slow 4G tranché.
6. Sonde + Telegram + sauvegarde testée.
7. W6 puis import data.gouv de décembre (entre le 10 et le 13), dernier pour profiter des données les plus fraîches.

Différer : page de statut publique, sonde de contenu, journal public M5 (lot 5), génération automatique des types (W7 peut se contenter d'un test de dérive).

## Drapeaux de recherche pour les phases

- Mentions légales/éditeur : lire le texte de l'art. 1-1 LCEN sur Légifrance et trancher « non professionnel » avec un juriste (le lien avec une activité freelance est ambigu).
- Journalisation Caddy : lire la délibération CNIL 2021-122 et fixer la durée ; détails du JSON de log de Caddy et de la troncature d'IP à vérifier dans la doc Caddy (non vérifiés ici).
- Import de décembre : le format réel du jeu data.gouv de décembre n'est pas connu, prévoir une exécution à blanc.
- Temps de relecture d'Erwan : estimation ci-dessus non validée.

## Sources

- CNIL, mesure d'audience : https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications (MEDIUM)
- CNIL, recommandation cookies consolidée (janvier 2026) : https://www.cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf (MEDIUM, résumé de recherche)
- CNIL, FAQ traceurs : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ (MEDIUM)
- CNIL, guide RGPD du développeur (logs, 6 mois) : https://lincnil.github.io/Guide-RGPD-du-developpeur/ (MEDIUM)
- CNIL, délibération 2021-122 sur la journalisation (via synthèses) : https://silexo.fr/article/120/duree-de-conservation-des-logs-6-mois-cnil (LOW-MEDIUM, secondaire)
- LCEN (loi 2004-575) art. 1-1 et 6, Légifrance : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000042038977 (la page récupérée ne couvrait que l'art. 6 III/IV hébergeurs ; art. 1-1 non lu directement)
- Synthèses sur l'anonymat de l'éditeur non professionnel : https://www.tinyterms.fr/blog/mentions-legales-site-web-obligatoires, https://legalnest.io/en/guides/legal-notice-website-france/ (LOW-MEDIUM)
- Dépôt : docs/spec/CAHIER-DES-CHARGES.md §8-§10, docs/RUNBOOK.md (Garde de déploiement, Déploiement lot 3, Droit de réponse), .planning/milestones/v1.0-MILESTONE-AUDIT.md (W3-W10), CLAUDE.md (stack)
