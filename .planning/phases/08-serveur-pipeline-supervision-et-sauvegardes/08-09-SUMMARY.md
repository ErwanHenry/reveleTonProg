---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 09
subsystem: ops
tags: [vps, caddy, compose, recreate]
requirements-completed: [HEB-14]
requirements-partial: [HEB-01, HEB-09]
metrics:
  completed: 2026-11-09
---

# Phase 8 Plan 09: Caddy prêt à servir le site (sans DNS) Summary

Le conteneur Caddy du VPS monte désormais le dossier du site en lecture seule, le dossier des journaux en écriture et `sites.d` en lecture seule ; il reçoit les deux hash `basic_auth` par variables d'environnement ; le Caddyfile importe `sites.d/*.caddy` (vide pour l'instant). Recréation unique faite le 2026-11-09 vers 11:20 UTC avec l'accord explicite d'Erwan (« Run step 5 now ») : conteneur prêt en 1,6 s, 16 hôtes identiques avant et après.

## Tâches

1. **Lecture seule (agent exécuteur)** : validation jetable (`--network none --read-only`, même image) du Caddyfile vivant avec la ligne d'import, avec et sans variables, valide ; aperçu de fusion compose (6 montages, 2 variables, autres services identiques ; refus `:?` sans variables) ; mot de passe de la sonde généré, haché par stdin dans un conteneur jetable, vérifié par `htpasswd -v`.
2. **Décision** : « go » d'Erwan. Le mot de passe de l'hôte `essai` a été généré par l'orchestrateur (même méthode que la sonde, `~/.config/rtp/essai-pass` 0600) après des échecs de saisie interactive (syntaxe `read` de zsh, presse-papiers) ; Erwan le range dans Vaultwarden. Deux lignes invalides ajoutées par ces essais ont été retirées du fichier local sans être affichées.
3. **Écritures W1 à W5**, lancées depuis la session principale avec l'approbation d'Erwan (le contrôle de permissions avait refusé l'exécution depuis l'agent ; rien n'a été contourné) :

| Écriture | Résultat |
|---|---|
| W1 | `/opt/rtp/depot` (ops/, deploy/ de HEAD) |
| W2 | sauvegardes `Caddyfile.bak-202611091116` et `docker-compose.yml.bak-202611091116`, 9 dossiers (755), override compose (644) |
| W3 | `/opt/vaultwarden/.env` root 0600, 2 lignes ; `docker compose config -q` = 0 |
| W4 | ligne `import /etc/caddy/sites.d/*.caddy` ajoutée sur place, inode 265375 inchangé hôte et conteneur ; `caddy validate` du fichier vivant = 0 ; pas de rechargement |
| W5 | `docker compose up -d --no-deps --force-recreate caddy` : prêt en 1 624 ms ; montages `/srv/reveletonprog` ro, `/var/log/caddy` rw, `/etc/caddy/sites.d` ro ; variables présentes, préfixe `$2a$`, longueur 60 (valeurs jamais affichées) ; journal Docker 10m x 3, politique de redémarrage et mémoire (192m) inchangées ; 35 Mio utilisés |

Comparaison des sites (relevé juste avant W5, relevé après, `ops/verifier-sites.sh comparer`) : **identiques 16, différents 0, nouveaux 0, disparus 0**. Aucun retour arrière utilisé.

## Points connus

- Le conteneur d'origine avait été créé le 2026-10-15 par Docker Compose 5.4.0 ; le VPS a Compose 2.40.3. La comparaison champ par champ montrait une définition identique ; la recréation l'a confirmé (16 hôtes identiques).
- 16 hôtes servis, pas 15 : un bloc a deux adresses.
- HEB-01 et HEB-09 seront complets quand le domaine existera (08-12 : bloc du site dans `sites.d`, HTTPS, journal réel).

## Fichiers hors dépôt

Relevés et sorties brutes sur le Mac seulement (`~/.config/rtp/sites-*.tsv`, 0600) ; `/tmp/rtp-0809/` supprimé. Rien du serveur n'est commité.
