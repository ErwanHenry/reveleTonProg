---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 13
subsystem: audit, performance, contenu institutionnel
tags: [dette-04, perf-02, audit, 4g, pub-02]

requires:
  - phase: 09
    provides: 09-12 (site public, supervision, déploiement depuis le Mac)
provides:
  - Mesure 4G refaite sur le site public avec la page du thème santé, publiée depuis MESURE_SERVEUR_4G
  - Premier test de fumée automatique sur le site public (deploy:local, sans identifiant)
  - Passe d'audit refaite sur la build en ligne, journal et empreintes (DETTE-04)
  - Trois affirmations fausses du site public corrigées et redéployées
affects: [10-05]

key-decisions:
  - "Erwan, 2026-11-22 : « Oui, prépare » (plan 09-13)"
  - "Erwan, 2026-11-22 : « Applique les trois corrections » (textes de Qui sommes-nous et de la Méthode)"
  - "Copie de la build en ligne prise sur le serveur (tar de /srv/reveletonprog/current), et non un artefact de CI : le déploiement passe par le Mac depuis la phase 9.2"
---

# Plan 09-13 : audit et 4G sur la build en ligne

## Résultat

La mesure 4G publiée et le journal d'audit décrivent maintenant le site tel qu'il est servi au public. La passe d'audit a trouvé trois affirmations fausses sur le site public ; elles ont été corrigées, validées par Erwan et redéployées le jour même. La build auditée en dernier, `5088ded`, est celle qui reste en ligne à la fin du plan.

## Tâche 1 : mesure 4G

- Copie de la version servie (`c383a03`) prise sur le serveur, `version.json` vérifié, utilisée comme `E2E_DIST`.
- `e2e/4g.spec.ts` en mode distant sur le site public, sans identifiant : page la plus lourde `/themes/sante/`, 31 085 octets gzip, servie en zstd ; 462 / 421 / 414 ms à 150 ms de latence ; 855 / 841 / 849 ms en « Slow 4G simulé » (budget 1 000 ms).
- Lighthouse 13.0.3 à la main, trois passages : FCP 974, 958, 972 ms ; LCP 974, 982, 984 ms ; Speed Index 1 354, 958, 972 ms ; médianes 972, 982, 972 ms.
- `MESURE_SERVEUR_4G`, son test, le README et le RUNBOOK mis à jour (commit `4613f19`). Écart rattrapé : le nom de domaine écrit en clair dans le README et un commentaire, refusé par le test HEB-05, remplacé avant le push.
- `ci:local` vert, déploiement par Erwan à 09:52 UTC : **test de fumée passé sur le site public** (commit servi et en-têtes HSTS et CSP, sans identifiant), premier passage automatique de cette étape en production.

## Tâche 2 : passe d'audit sur la build en ligne

| Preuve | Première lecture (`4613f19`) | Après corrections (`5088ded`) |
|---|---|---|
| Arbre du serveur et de la copie | `11250972a04b16b7abf97ee1700ae7cc80db1083d57341dead6127e54f3d61a2` des deux côtés | `13d67e47f73d07bb5f0d2750f041afbe710c90afbf030cb197409d3cf4fd61fe` des deux côtés |
| Fichiers servis comparés à la copie | 49, 0 différence | 49, 0 différence |
| Empreinte `audit-lire.ts --empreinte` | `e08e5ae9dbc70e2d1435612d87da184d67f2d3debd7b1eb66ca9a5afc58ffa6b` | `8f7fce757ef02b1121d66afae127f1c46a531d68f82e163c905e4920591f836c` |

- `audit/journal.jsonl` (131 lignes) renommé `audit/journal-2026-11-04.jsonl`. Nouveau journal : 46 lignes, lignes 1 à 20 sur `4613f19`, 21 à 46 sur `5088ded`, trois personas.
- Lecteurs simulés Sonnet 5.5, un agent par persona, puis un agent neuf par question rejouée. Scénario adapté pour deux questions du journaliste (build de démonstration, personnes masquées en production), sans suppression.
- Résultat : 13 questions, 0 KO à la fin (1 KO corrigé et rejoué), 3 Partiel dont 2 bloquants déjà connus (titres de mesure au niveau enfant ; extrait archivé hors du lecteur). Pièges §12 : 7 sur 7 rejetés.
- Trois affirmations fausses du site public corrigées (commit `df62296`, textes validés par Erwan) : « Qui sommes-nous » prétendait que l'éditeur relit chaque version ; la Méthode situait la mesure 4G sur l'adresse de test ; la Méthode promettait la liste des personnes qui ne se présentent pas sur chaque page thème. Premier envoi du redéploiement refusé (clé expirée : confirmation tapée plus d'une heure après la phrase de passe), second envoi réussi à 13:27 UTC.
- `docs/AUDIT-TEST-CROISE.md` : section « Passe du 22 novembre 2026 : build en ligne » ; `audit/README.md` nomme les deux journaux ; deux tests ajoutés dans `tests/repo/docs.test.ts`.

## Tâche 3 : contrôles avant la confirmation d'Erwan (lecture seule)

Site 200, HSTS 300, CSP ; `www` 301 ; `robots.txt` sans `Disallow: /`, avec `Sitemap:` ; plan du site 200 ; certificats jusqu'au 2027-02-20 ; sonde externe verte sur ses cinq dernières exécutions (dernière à 08:45 UTC, planification irrégulière de GitHub) ; battement `site ok`, `cert ok` ; journal d'accès aux adresses masquées ; 18 autres sites identiques ; aucun run en attente ; validation 0 erreur ; relecture santé reste 0 sur 121.

Confirmation d'Erwan : voir la fin de ce résumé (à compléter à sa réponse).

## Constats pour Erwan (rien modifié)

Cases « Programme non publié » sans source citée ; mesures du thème santé surtout tournées vers l'emploi (Arthaud, Labib, Kazib, Collovati) ; départage du choix des thèmes ; « Son parti veut… » sans nom au niveau enfant ; titres de mesure difficiles ; date de publication des sources non affichée ; trois liens de source aux noms proches ; page santé longue ; Méthode trop technique ; « Qui sommes-nous » sans version simple ; l'accueil ne dit pas que les textes sont rédigés avec une IA.

## Améliorations notées

- `deploy:local` : vérifier que la clé est encore chargée juste après la confirmation et redemander la phrase de passe si elle a expiré, au lieu d'échouer à l'envoi.
- `audit-lire.ts` : option pour restreindre la sortie à un candidat (pages de plus de 120 Ko).
