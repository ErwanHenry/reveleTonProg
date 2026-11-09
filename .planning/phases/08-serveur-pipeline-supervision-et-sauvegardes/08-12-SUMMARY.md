---
phase: 08-serveur-pipeline-supervision-et-sauvegardes
plan: 12
subsystem: ops
tags: [domaine, dns, caddy, https]
requirements-completed: [HEB-01, HEB-08, HEB-09, HEB-14]
requirements-partial: [HEB-07]
metrics:
  completed: 2026-11-09
---

# Phase 8 Plan 12: Domaine réel et HTTPS sur l'hôte technique Summary

`essai.reveletonprog.fr` est servi en HTTPS (certificat Let's Encrypt, CN=YE2, valable jusqu'au 2027-02-07) par le Caddy partagé du VPS, protégé par mot de passe, avec les en-têtes de sécurité, la CSP du bloc rendu et le journal d'accès à IP masquée. Le site public (nom nu et `www`) n'est pas installé : aucun brouillon n'est exposé.

## Tâches

1. **Domaine (Erwan, 2026-11-09)** : `reveletonprog.fr` acheté chez IONOS. DNS posés par l'orchestrateur dans le compte IONOS d'Erwan (navigateur où il était connecté, aucun identifiant saisi) : A pour le nom nu, `www` et `essai` vers le VPS, TTL 300 ; enregistrements du « site par défaut » IONOS désactivés ; messagerie IONOS conservée. Vérifié sur 1.1.1.1, 8.8.8.8 et 9.9.9.9.
2. **Dépôt (agent exécuteur, commit eaef21e)** : `domaine: reveletonprog.fr` dans `config/site.yml` (contact et hébergeur restent provisoires) ; blocs `deploy/caddy/*.caddy` régénérés, à jour ; validation jetable sur le VPS (conteneur tmpfs, rien écrit) valide dans les 4 cas ; `npm test` 2205/2214 (0 échec), `npm run check` 0 ; CI 42699357785 verte. Écart (règle 3) : `tests/corpus/site-config.test.ts` attendait un domaine `.invalid` ; il attend désormais un domaine réel et un contact encore provisoire, sans écrire le nom de domaine.
3. **Serveur (session principale, demandé par Erwan : « fais tout ça »)** :

| Étape | Résultat |
|---|---|
| W0 | **IPv6 retiré du DNS** : le VPS ne répond pas en IPv6 sur 80/443 (pas de règle ufw IPv6, réseaux Docker sans IPv6 ; piège 12). Les 3 enregistrements AAAA (nom nu, `www`, `essai`) supprimés chez IONOS ; propagation vérifiée sur les 3 résolveurs et le serveur faisant autorité |
| W1 | `/opt/rtp/depot` mis à jour (hash de `essai.caddy` = dépôt `5b5a8a98…`) |
| W2 | `sites.d/reveletonprog-essai.caddy` installé (644 root, même hash hôte et conteneur) |
| W3 | `caddy validate` puis `caddy reload` dans le conteneur ; **aucun redémarrage** (StartedAt inchangé `2026-11-09T19:28:52Z`, 0 redémarrage) ; certificat obtenu à la première tentative |

## Vérifications

- V2 (`verifier-essai.sh`) : 401 et `WWW-Authenticate: Basic` sans identifiant ; `robots.txt` = `User-agent: *` / `Disallow: /` avec `X-Robots-Tag` ; avec l'identifiant de la sonde : 200, HSTS (max-age=300), CSP égale au bloc rendu (empreintes des deux scripts, `frame-ancestors 'none'`, sans `default-src`), nosniff, no-referrer, Permissions-Policy, COOP, pas d'en-tête Server, `no-cache` sur `/` et `/version.json`, compression zstd, `version.json` = commit B (`6da5b2c…`), date ISO.
- **Écart mineur** : la réponse 401 ne porte pas `X-Robots-Tag` (l'en-tête n'est pas appliqué sur le chemin d'erreur de `basic_auth`). Sans effet d'indexation (page 401, `robots.txt` interdit tout). À corriger avec un `handle_errors` dans le rendu de l'hôte essai (suivi pour 08-15 ou Phase 9, qui retire l'hôte).
- V3 journal (`/var/log/caddy/essai.log`) : IP distante et IP client masquées, en-têtes de requête et TLS absents.
- V5 : relevé avant/après des hôtes servis : **16 identiques, 0 disparu** ; seul changement, `essai` (hash `4d7841…`) de 000 à 401.
- Contrôle automatique du plan : `https://essai.<domaine>/` = 401.

## Reste

- IPv6 à rétablir proprement plus tard (règles ufw IPv6 et IPv6 dans les réseaux Docker, ou proxy qui conserve l'IP client), puis AAAA.
- HEB-07 (`/version.json` servi) vérifié sur essai ; le site public suivra en Phase 9.
- `RTP_HOTE` pour le contrôle de certificat du battement : 08-15.
