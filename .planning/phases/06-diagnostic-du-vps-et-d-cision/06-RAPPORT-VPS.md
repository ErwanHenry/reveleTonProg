# Rapport du VPS (HEB-03)

**Machine :** `ubuntu-4gb-nbg1-2` (Hetzner), Ubuntu 24.04.5 LTS, noyau 6.8, 2 vCPU, en service depuis 22 jours.
**Relevé :** 2026-11-06T23:16Z, par `ops/diagnostic-vps.sh` (lecture seule, liste blanche vérifiée par `tests/repo/diagnostic-vps.test.ts`), lancé depuis le poste d'Erwan avec `ssh keel-vps 'bash -s' < ops/diagnostic-vps.sh`.
**Rapport brut :** hors du dépôt public (il nomme d'autres sites et services). Pour le régénérer, relancer la commande ci-dessus.

## Chiffres

| Mesure | Valeur | Lecture |
|---|---|---|
| RAM totale | 3 819 Mio | |
| RAM disponible | 1 266 Mio (33 %) | utilisée à 67 % ; cache 1 234 Mio |
| Swap | 1 051 Mio utilisés sur 2 047 | la machine pagine déjà |
| Charge | 0,05 / 0,08 / 0,02 | processeur peu sollicité |
| Disque système `/` | 21 Go sur 38 (58 %), 16 Go libres | **42 % de marge** (c'était 90 % en juillet 2026) |
| Volume attaché | 32 Go sur 50 (68 %), 16 Go libres | |
| Inodes | 30 % et 31 % | sans souci |
| Journaux systemd | 923 Mio | récupérables par une purge (non faite) |
| Images Docker | 33,8 Go dont 19,0 Go récupérables (56 %) ; cache de build 3,0 Go récupérables | récupérables par un nettoyage (non fait) |
| Conteneurs actifs | 17 (dont 2 Caddy) | |
| Services système notables | Docker, fail2ban, pm2, mises à jour automatiques | 17 paquets en attente |
| Ports publics | 22, 80, 443 (IPv4 et IPv6) | IPv6 globale présente |
| rsync | 3.2.7, `/usr/bin/rsync` | |
| rrsync | `/usr/bin/rrsync` | présent : clé de déploiement restreinte possible |
| restic | absent | |

## Caddy

- Caddy **n'est pas installé sur le système** : il tourne dans un conteneur Docker (`caddy:2-alpine`, image du 2026-03-06) qui publie 80 et 443.
- Son Caddyfile est un fichier monté depuis l'hôte (environ 15 blocs de site, sans `import` ni directive `log`) ; ses données (certificats) et sa configuration sont dans deux dossiers montés. Des copies datées du Caddyfile existent à côté.
- Aucun dossier de site statique n'est monté dans ce conteneur. Pour servir reveleTonProg, il faut **ajouter un montage** (par exemple `/srv/reveletonprog` en lecture seule) et donc **recréer le conteneur une fois** : courte coupure de tous les sites qu'il sert. À planifier avec Erwan (Phase 8).
- Conséquences pour la Phase 8 : `caddy validate` et `caddy reload` passent par `docker exec` dans ce conteneur ; le bloc du site va dans le Caddyfile monté, ou dans un fichier importé une fois la ligne `import` ajoutée ; le journal d'accès à 14 jours doit écrire dans un dossier monté.

## Sauvegardes Hetzner

Non visibles depuis la machine. À vérifier par Erwan dans la console Hetzner (sauvegardes automatiques actives ou non, dernier instantané).

## Recommandation

**Garder l'instance actuelle, sans montée en gamme pour le Lot 3.**

- Le site est statique et servi par le Caddy existant : il n'ajoute ni processus ni conteneur, quelques Mio de disque par version (5 versions gardées).
- La marge disque est de 42 %, au-dessus des 30 % demandés (HEB-04), sans rien supprimer.
- Point de vigilance : la RAM. 1,27 Go disponibles et 1 Go de swap utilisé, sans lien avec ce site. Si d'autres services grossissent, une montée en gamme (4 Go vers 8 Go) ou un nettoyage deviendra nécessaire ; ce n'est pas un prérequis du Lot 3.
- Nettoyage possible, non fait, à décider par Erwan : images et cache de build Docker inutilisés (environ 22 Go), journaux systemd au-delà d'une durée choisie (environ 0,9 Go).
- Avant toute modification de la machine (Phase 8 : montage dans le conteneur Caddy, utilisateur de déploiement) : **instantané Hetzner** pris par Erwan dans la console.

## Décision d'Erwan

- **Décision (Erwan, 2026-11-07) : garder l'instance actuelle**, sans nettoyage ni montée en gamme pour le Lot 3.
- **Marge disque retenue :** 42 % libres sur le disque système au relevé du 2026-11-06 (seuil HEB-04 : 30 %). À remesurer avec le script avant la Phase 8.
- **Instantané Hetzner :** à prendre par Erwan dans la console avant toute modification de la machine (Phase 8) ; date à reporter ici.
- **Sauvegardes Hetzner automatiques :** état à vérifier par Erwan dans la console.
