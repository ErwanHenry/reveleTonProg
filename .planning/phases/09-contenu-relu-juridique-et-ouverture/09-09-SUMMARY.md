---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 09
subsystem: documentation d'exploitation, préparation du serveur
tags: [runbook, adr, retrait-urgence, gel, ouverture, restauration, ops-01]

requires:
  - phase: 09
    provides: outil de relecture (09-01, 09-05, 09-06), liste blanche (09-02), exception Wayback (09-03), Mentions finales (09-04), installateur site-public (09-07), note signée (09-08), ligne de relecture (09-14), filtre des personnes (09-15)
provides:
  - RUNBOOK : relire un thème, publier un thème, retrait d'urgence en moins d'une heure, ouverture publique pas à pas, calendrier de gel 2027, droit de réponse
  - ADR-059 à ADR-062
  - Serveur prêt pour l'ouverture sans changement de ce qu'il sert : dépôt de travail et test de restauration à jour, bloc public validé à blanc, relevé de référence des autres sites
  - Override OPS-01 accepté par écrit (08-VERIFICATION.md)
affects: [09-10, 09-11, 09-12, 09-13]

tech-stack:
  added: []
  patterns:
    - "Copie de travail du serveur alimentée par git archive HEAD (arbre commité), plus par le dossier de travail du Mac"
    - "Chaque code check-dist apparaît une seule fois dans le RUNBOOK (test)"

key-files:
  created: []
  modified:
    - docs/RUNBOOK.md
    - docs/ARCHITECTURE.md
    - tests/repo/docs.test.ts
    - scripts/relecture.ts
    - .planning/phases/08-serveur-pipeline-supervision-et-sauvegardes/08-VERIFICATION.md
    - .planning/phases/08-serveur-pipeline-supervision-et-sauvegardes/08-HUMAN-UAT.md

key-decisions:
  - "Erwan a répondu « Go » le 2026-11-11 au point de validation : écritures W1 à W3 approuvées, override OPS-01 accepté"
  - "La confirmation « 48 h sans fausse alerte » n'a pas été donnée dans sa réponse : elle reste ouverte dans 08-HUMAN-UAT.md"
  - "`publier` exige le thème dans config/publication.yml : le RUNBOOK place le commit de la liste blanche avant `publier`"
  - "Repli du retrait d'urgence quand une erreur sans rapport bloque `retirer` : retour arrière (rollback.yml), puis correction dans un commit à part"

requirements-completed: [LEG-03]
---

# Plan 09-09 : RUNBOOK, ADR et préparation du serveur

## Résultat

Le RUNBOOK décrit le retrait d'urgence d'une mesure en moins d'une heure et le calendrier de gel des scrutins de 2027 (LEG-03). Le serveur est prêt pour l'ouverture sans que rien de ce qu'il sert ait changé.

## Tâches

| Tâche | Contenu | Commit |
|---|---|---|
| 1 (rouge) | Tests de documentation, 19 échecs constatés avant écriture | 2626149 |
| 1 (vert) | RUNBOOK, ARCHITECTURE (ADR-059 à 062) | d0d0d49 |
| hors plan | Aide de `npm run relecture` : `servir`, `publier`, `retirer` décrites | 174f4bd |
| 2 | Point de validation : « Go » d'Erwan le 2026-11-11 | sans commit |
| 3 | Écritures W1 à W3, préparation en lecture seule, override inscrit | commit de clôture |

## Tâche 1

- Sections ajoutées : « Relire un thème », « Publier un thème », « Retrait d'urgence d'une mesure (moins d'une heure) », « Ouverture publique (Phase 9) ».
- Sections mises à jour : relecture ouverte, archivage (six modes, adoption Wayback, exception, note HTTP 403), garde de déploiement, étapes juridiques, gel des scrutins (tableau 2027), hôte technique, installation du serveur (`git archive`), Environments GitHub, droit de réponse (décret 2007-1527), Monitoring (sonde à 1 jour, écart OPS-01).
- Budget du retrait d'urgence, mesuré sur trois déploiements réussis du 2026-11-10 : 32 minutes pour une cible de 60, attente d'approbation comprise (205 à 446 s).
- Tests : 2559, 0 échec. Chaque commande du RUNBOOK a été lancée sur une copie temporaire, lancée à blanc, ou lue dans le code ; `publier` et `retirer` n'ont jamais tourné sur le corpus réel.

## Tâche 3 : écritures approuvées (session principale)

| Écriture | Résultat |
|---|---|
| W1, copie de `ops/` et `deploy/` depuis l'arbre commité vers `/opt/rtp/depot` | faite ; archive sans fichier `.DS_Store` |
| W2, installateur `--appliquer --etape sauvegarde` | 6 ok, 1 fait (`rtp-tester-restauration` installé) ; script installé identique au dépôt (`cmp`) |
| W3, sauvegarde puis test de restauration réel | sauvegarde : 19 fichiers, 23 606 octets, 1 absent ; restauration : `{"resultat":"ok","fichiers":19,"hachages":"ok","modifies":0,"installateur":"conforme","caddy":"valide","ping":"ok"}` |

Conteneur Caddy : `StartedAt` 2026-11-09T19:28:52Z et 0 redémarrage, inchangés.

## Tâche 3 : préparation de l'ouverture (lecture seule)

- (a) Bloc public validé à blanc dans un conteneur jetable (Caddy v2.11.2) : valide avec et sans variables.
- (b) Installateur `--verifier --etape site-public` : code 7, attendu (aucune version de la cible production encore déployée).
- (c) Relevé de référence des autres sites : 17 lignes, gardé sur le Mac hors dépôt (`sites-avant-ouverture.tsv`).
- (d) DNS sur deux résolveurs : enregistrements A du nom nu, de `www` et de `essai` égaux à l'adresse du VPS ; aucun AAAA.
- (e) Sortie d'erreur du conteneur sur 24 h : 623 lignes avec une adresse, dont 619 avec une adresse non tronquée ; journal Docker plafonné à 3 fichiers de 10 Mio. Conforme à la phrase des Mentions légales (09-04).
- (f) Réglages GitHub lus : variables de dépôt `DEPLOY_CIBLE` (essai) et `SONDE_URL` ; Environment `production` : variables `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_URL`, `DEPLOY_USER`, secrets `DEPLOY_SMOKE_PASS`, `DEPLOY_SMOKE_USER`, `DEPLOY_SSH_KEY`, relecteur requis ErwanHenry, branche `main` seulement ; Environment `sonde` : `SONDE_PASS`, `SONDE_PING_URL`, `SONDE_USER`. Identique à la liste du plan : la section « Ouverture publique » n'a pas à être corrigée.

## Écarts

1. **`--etape` obligatoire.** Le plan parlait d'un installateur lancé sans `--etape` ; il refuse (code 2). Le RUNBOOK dit « même quand toute la liste des étapes est rejouée ».
2. **Journal système.** `journalctl -t rtp-restauration` ne montre aucune entrée pour un lancement à la main ; la ligne JSON du test fait foi.
3. **Un fichier absent à la sauvegarde.** La sauvegarde compte 1 fichier attendu absent ; le test de restauration qui suit est conforme. Non analysé ici, à regarder au test mensuel du 2026-12-01.
4. **Cas non couvert par le RUNBOOK.** Si une erreur de production sans rapport bloque `retirer` et que la version précédente contient aussi la mesure à retirer, il n'y a pas de repli propre. L'exercice chronométré du plan 09-11 doit le traiter.
5. **PUB-01 et PUB-02 non cochées** bien que citées par le plan : elles demandent la relecture réelle (09-10) et une publication réelle (09-11).

## Points ouverts

- Sonde externe : Erwan déclare le 2026-11-11 n'avoir reçu aucune fausse alerte depuis le réglage ; la fenêtre de 48 h après les dernières fausses alertes (2026-11-10, 12:44) se ferme le 2026-11-12, à reconfirmer après.
- 09-11 : chiffre de l'exercice chronométré de retrait à inscrire dans le RUNBOOK. 09-12 : date d'ouverture et date cible de l'allongement du HSTS.
- Pour la relecture (09-10) : `source_localisation` des deux mesures santé de Delphine Batho et trois lignes de « sources consultées » de `data/couverture-themes.yaml` citent encore l'ancien intitulé ou les anciennes adresses.
- Article 5 du décret 2007-1527 (pas d'insertion si le contenu est corrigé ou retiré sous trois jours) : à confirmer par le juriste.
