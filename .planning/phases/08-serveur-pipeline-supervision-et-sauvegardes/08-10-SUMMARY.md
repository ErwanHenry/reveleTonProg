---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 10
subsystem: ops
tags: [vps, deploy, rrsync, forced-command]
requirements-completed: [HEB-10]
requirements-partial: [HEB-02, HEB-11]
metrics:
  completed: 2026-11-09
---

# Phase 8 Plan 10: Utilisateur de déploiement restreint et preuve en boucle Summary

Le VPS a un utilisateur `deploy` (uid 996, seul dans son groupe, sans sudo, hors du groupe Docker) dont l'unique clé autorisée est restreinte (`restrict,command="/usr/local/sbin/rtp-deploy-command"`), dans un `authorized_keys` appartenant à root (644, dossier `.ssh` root 755). La commande forcée est la copie exacte de `ops/commande-deploiement.sh`. Le chemin de déploiement complet a été prouvé en boucle locale sur le VPS, avec le même rsync 3.2.7 que le runner GitHub.

## Tâches

1. **Lecture seule et préparation locale (agent exécuteur)** : paire ed25519 dédiée `~/.config/rtp/rtp-deploy-github` (0600, empreinte `SHA256:/EwXblcvxni+ED6OQZvIyXKas4kJzofxbsv+6kdtREk`) ; ligne d'hôte épinglée `~/.config/rtp/known_hosts-deploy` lue par le canal SSH de confiance (jamais ssh-keyscan), empreinte identique à `~/.ssh/known_hosts` ; deux builds de production hors dépôt, A = `1bcf4f6`, B = `6da5b2c` (`~/.config/rtp/essai-b.sha`), check-dist 0 erreur ; constats sshd, rsync 3.2.7, rrsync, disque 57 %.
2. **Décision** : « go » d'Erwan.
3. **Écritures lancées depuis la session principale avec son approbation** (le contrôle de permissions bloque les écritures distantes des agents) :

| Étape | Résultat |
|---|---|
| C0 | copie `/opt/rtp/depot` identique à HEAD |
| W1 | utilisateur `deploy`, commande forcée, 7 dossiers du site à `deploy:deploy` ; vérification : 1 ligne restreinte, `commande-identique`, sudo refusé, installateur 17 ok / 0 à faire |
| W2 | clé de test temporaire `rtp-test-boucle` (même préfixe restreint) |
| W3 | preuve en boucle : **0 échec** (tableau ci-dessous) |
| W4 | retour à une seule ligne, clé de test détruite (`shred`), `/root/rtp-0810` supprimé |
| R5 | depuis le Mac, vraie clé + hôte épinglé : `etat essai` répond `courant=6da5b2c…` ; `id` refusé (« verbe inconnu ») |

Preuve W3 :
- A1 confirmée : chaîne serveur `rsync --server -ltre.iLsfxCIvu --stats . essai/<sha>/` acceptée par `rrsync -wo -no-del` ; envoi à blanc sans trace dans `incoming`, envois réels de A et B (133 entrées).
- `activer essai A` puis `activer essai B` ; deux retours arrière, **288 ms et 329 ms** (poignée de main SSH comprise) ; lien relatif `current → releases/<sha>` vu dans le conteneur Caddy (`visible-dans-caddy`).
- 13 tentatives refusées : `id`, `bash`, `etat essai; id`, `--sender`, cible `../`, `--delete`, `activer` avec chemin, client `rsync --delete`, client en lecture, `ssh -tt` (PTY refusé, 255), `-W`, `-R`, `-L` (aucun octet).
- Journal `rtp-deploy` en JSON (`"code":64` pour les refus).

## État laissé

`essai/current → releases/6da5b2c…`, deux versions sur l'hôte `essai`, non servies (aucun bloc `essai` dans `sites.d` tant que le domaine n'existe pas). La clé privée de déploiement reste sur le Mac jusqu'à 08-13 (dépôt dans l'Environment `production`, puis suppression locale).

## Écarts

- Clé et hôte épinglé rangés dans `~/.config/rtp/` (plan : `~/.ssh/`) ; 08-13 utilise ce chemin.
- L'étape de copie du dépôt (W1 du plan) n'était pas nécessaire : `/opt/rtp/depot` était déjà identique à HEAD.
