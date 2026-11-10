# 09-08 : actes d'Erwan (dates et résultats seulement, aucune donnée personnelle)

## Étape A : identité transmise à l'hébergeur (LCEN art. 1-1 II, D-02 révisée)

- Compte client Hetzner vérifié par Erwan (nom, prénoms, domicile, téléphone à jour) : fait, déclaré le 2026-11-10.
- Entité émettrice des factures du VPS, lue par Erwan sur une facture : Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne. Identique à `config/hebergeur.yml`.
- Message écrit au support Hetzner (éditeur non professionnel de reveletonprog.fr, éléments d'identification du compte client) : envoyé, déclaré le 2026-11-10.
- Preuve datée (message et accusé de réception) : conservée par Erwan dans Vaultwarden, hors dépôt.

Ligne à reporter dans `docs/RISQUES-JURIDIQUES.md` quand la note existera (plan 09-04) : « Identité transmise à l'hébergeur le 2026-11-10 ».

## Étape B : adresse de contact

- `contact@reveletonprog.fr` : redirection IONOS existante (constatée le 2026-11-10), MX et SPF vérifiés sur deux résolveurs.
- Test de bout en bout, déclaré par Erwan le 2026-11-10 : envoi depuis une boîte extérieure fait, message reçu via la redirection, réponse envoyée et arrivée.
- Adresse d'expéditeur de la réponse : l'adresse Gmail personnelle d'Erwan (la redirection IONOS ne réécrit pas l'expéditeur). **Accepté par Erwan le 2026-11-10** : une personne qui écrit au contact verra cette adresse dans la réponse. À revoir si le site prend de l'audience (vraie boîte IONOS ou « envoyer en tant que »). Résultats SPF, DKIM, DMARC de la réponse : non relevés ; ils portent sur gmail.com, pas sur le domaine du site.

## Signature de la note de risques

En attente de la rédaction de la note (plan 09-04).
