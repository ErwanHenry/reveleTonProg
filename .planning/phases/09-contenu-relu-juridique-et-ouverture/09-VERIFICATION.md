---
phase: 09-contenu-relu-juridique-et-ouverture
verified: 2026-11-22T18:05:00Z
status: passed
score: 3/5 success criteria fully verified (criterion 1 failed as written on "relu par Erwan", criterion 5 partial on the RUNBOOK withdrawal procedure)
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Erwan relit un thème avec une commande qui liste ce qui reste à relire et passe chaque mesure en `relu` en enregistrant relecteur et date (ROADMAP SC1, PUB-01, but de la phase « un thème entièrement relu par Erwan »)"
    status: failed
    reason: "La commande et l'affichage existent et marchent, mais Erwan n'a pas relu le thème : 47 mesures sur 47 et 36 statuts sur 37 sont relus par des agents d'IA (relecteur « l'agent d'IA Claude »), sur décision écrite d'Erwan du 2026-11-17 (« Ne pas relire ou alors tu fais relire par un agent »). Aucune dérogation n'est inscrite ; PUB-01 reste « Pending » dans REQUIREMENTS.md alors que la phase est cochée dans ROADMAP.md."
    artifacts:
      - path: "src/content/mesures/*/sante-*.yaml"
        issue: "47 x relecteur: l'agent d'IA Claude, date_relecture: 2026-11-17"
      - path: ".planning/REQUIREMENTS.md"
        issue: "PUB-01 non coché (ligne 44) et « Pending » (ligne 150), but de la phase dans ROADMAP.md (ligne 131) toujours rédigé « relu par Erwan »"
    missing:
      - "Décision d'Erwan, à écrire : accepter la dérogation (bloc overrides ci-dessous) et réécrire PUB-01, SC1 et le but de la phase pour la relecture par agent, OU relire lui-même le thème santé. Aucun travail de code."
  - truth: "Le RUNBOOK décrit le retrait d'urgence d'une mesure en moins d'une heure (ROADMAP SC5, LEG-03)"
    status: partial
    reason: "La section « Retrait d'urgence d'une mesure (moins d'une heure) » prescrit encore le chemin GitHub, en sommeil depuis le 2026-11-22 (variable DEPLOY_CIBLE retirée). Voie 1 : `gh workflow run rollback.yml -f cible=production` lance un job sauté (`if: vars.DEPLOY_CIBLE != ''`), vert, sans rien déployer. Étape 2 : « Approuver le déploiement dès que le run le demande » n'arrive jamais. Retrait pendant le gel : `gh workflow run ci.yml -f retrait_urgence=true`. Les commandes locales (`deploy:local -- retour`, `deploy:local -- --urgence`) ne sont que dans le récit de l'exercice du 2026-11-21 et dans d'autres sections (lignes 548 et 887). La ligne 910 dit encore « D-11, en attente » alors que D-11 a été tranchée au 09-12."
    artifacts:
      - path: "docs/RUNBOOK.md"
        issue: "lignes 1006 à 1074 : voies 1 et suite écrites pour GitHub ; ligne 910 dépassée"
    missing:
      - "Réécrire les voies 1 à 3 et « Après l'écriture » de la section avec `npm run ci:local`, `npm run deploy:local`, `deploy:local -- retour [<sha>]` et `--urgence --justification`, en gardant le chemin GitHub comme repli explicitement en sommeil"
      - "Mettre à jour la ligne 910 (D-11 tranchée le 2026-11-22)"
human_verification: []
---

# Phase 9 : Contenu relu, juridique et ouverture, rapport de vérification

**But de la phase :** le site ouvre au public avec un thème entièrement relu par Erwan, des Mentions légales finales validées, et un journal d'audit refait sur la build réellement en ligne (cible : vers le 2026-12-05).
**Vérifié le :** 2026-11-22 vers 18:05 UTC, dépôt sur `main` à `53f1bc4` (arbre propre), site public servant `5088ded` (`/version.json` : `5088ded8066d…`, date 2026-11-22T13:26:47Z). Les commits `580e81b` et `53f1bc4` ne touchent que la documentation et les tests.
**Statut :** gaps_found. Un critère manqué tel qu'il est écrit, à cause d'une décision délibérée d'Erwan, et une procédure du RUNBOOK dépassée.
**Re-vérification :** non, vérification initiale.

## Ce que le vérificateur a exécuté (sans reprendre les bilans)

| Contrôle | Commande | Résultat |
|---|---|---|
| Validation de production | `fnm exec --using=24 node scripts/validate.ts --mode production` | 392 fichiers, 0 erreur, 18 avertissements (dont 10 `LISIBILITE_ENFANT_FAIBLE` sur des mesures santé publiées, voir anti-patterns) |
| Relecture restante | `npm run relecture -- liste --theme sante --relecteur "l'agent d'IA Claude"` | « reste 0 sur 121 » |
| Tests ciblés | `TZ=Europe/Paris node --test` sur `tests/rules/{publication,equite,sources-wayback}.test.ts`, `tests/relecture/{publier,retirer,liste,marquer}.test.ts`, `tests/corpus/{publication,hebergeur}-config.test.ts`, `tests/dist/cas/publication.cas.ts` | 108 tests, 0 échec |
| Corpus | grep sur `src/content` | santé : 47 mesures `publie`, thème `publie` ; travail et Europe et monde : thème et 87 mesures `brouillon` ; `config/publication.yml` = `[sante]` ; `config/hebergeur.yml` `statut: actif` |
| Site public | `curl` sur `https://reveletonprog.fr` (domaine lu dans `config/site.yml`) | voir les critères |
| Empreinte de la build en ligne | miroir des 50 fichiers servis (44 pages du plan du site, 404.html, robots.txt, sitemap.xml, version.json, favicon.ico, partage.png) dans `/tmp`, puis `node scripts/audit-lire.ts --dist <miroir> --empreinte` | `8f7fce757ef02b11…f836c`, identique à l'empreinte de `docs/AUDIT-TEST-CROISE.md` |
| Journal d'audit | `audit-lire.ts --persona verif --journal /tmp/...` sur 4 pages du miroir | empreintes de `/qui-sommes-nous/`, `/methode/`, `/themes/sante/`, `/mentions-legales/` identiques aux lignes 21 à 46 de `audit/journal.jsonl` |

Aucun identifiant utilisé, aucun accès SSH, rien lu sous `~/.config/rtp/`, aucune écriture hors de ce rapport (miroir temporaire sous `/tmp/rtp-verif`).

## Vérité observable par critère

| # | Critère (ROADMAP) | Statut | Preuve |
|---|---|---|---|
| 1 | Erwan relit un thème avec une commande (liste, `relu`, relecteur, date) ; chaque mesure publiée affiche relecteur et date | ✗ FAILED tel qu'écrit (outil et affichage VERIFIED) | voir ci-dessous |
| 2 | Production : seul le thème entièrement relu, aucun brouillon ; garde d'équité et liste blanche refusent toute autre publication | ✓ VERIFIED | voir ci-dessous |
| 3 | Chaque source citée par une mesure publiée a une copie Wayback ou une exception motivée | ✓ VERIFIED | 30 sources sur 30 avec `archive.wayback_url`, 0 exception |
| 4 | Mentions légales finales (régime, hébergeur actif, contact testé, journal, droit de réponse sur Légifrance) ; relecture juridique ou risque accepté par écrit | ✓ VERIFIED, avec des éléments attestés seulement par Erwan (trace écrite) | voir ci-dessous |
| 5 | RUNBOOK (retrait en moins d'une heure, gel 2027) ; audit et empreintes refaits sur la build déployée ; site ouvert, hôte technique retiré | ⚠ PARTIAL : audit, ouverture et gel VERIFIED ; procédure de retrait du RUNBOOK dépassée | voir ci-dessous |

**Score :** 3 critères sur 5 pleinement vérifiés.

### Critère 1 : ✗ FAILED tel qu'écrit ; outil et affichage vérifiés

Ce qui tient :
- La commande existe et marche : `relecture liste` affiche ce qui reste par candidat et « reste 0 sur 121 » ; `marquer`, `publier` et `retirer` sont couverts par des tests verts. L'éditeur n'écrit que les champs de relecture (tests `editer`, `marquer`).
- Chaque mesure publiée affiche son relecteur et sa date. Sur le site public, les 37 pages candidats contiennent 47 articles `mesure`, tous `data-statut-relecture="publie"`, et 47 lignes `data-relecture` « Relue par l'agent d'IA Claude le 17 novembre 2026 ». La page thème affiche 27 cartes et 27 lignes. Les dates correspondent au YAML (`date_relecture: 2026-11-17`). Le bilan 09-11 écrit « le 20 novembre 2026 » à tort ; le site est juste.

Ce qui ne tient pas : **Erwan n'a pas relu le thème.** Ses seules validations sont le statut de François Asselineau et des arbitrages globaux (« Agent corrige, autre agent revérifie », puis « Suis ton avis » sur cinq points éditoriaux). Le reste, soit les 47 mesures, 36 statuts et 37 cases, a été relu par des agents d'IA en trois passes contre la source archivée. Les rapports sont dans `relecture-agent/`.

Décision qui motive l'écart : le 2026-11-17, Erwan a écrit « Je ne vais pas valider les 120 à la main », puis « Ne pas relire ou alors tu fais relire par un agent ». Révisions de `09-CONTEXT.md` ; avenant à `docs/RISQUES-JURIDIQUES.md` accepté le 2026-11-17 (« Oui, j'accepte l'avenant »).

Esprit du critère, sans détour :
- Ce qui tient : transparence et honnêteté. Aucune mesure ne prétend « Relue par Erwan Henry ». La Méthode et Qui sommes-nous disent « Ce n'est pas une relecture humaine de chaque texte ». Le risque accru est accepté par écrit.
- Ce qui ne tient pas : une vérification humaine entre un texte rédigé par un modèle et le public. Le critère visait cette garantie, et elle n'existe pas.

La relecture par agent est une autre garantie, plus faible. Elle ne réalise pas le critère dans son esprit. Les exigences le reflètent : PUB-01 reste « Pending » dans `REQUIREMENTS.md` alors que la phase est cochée `[x]` dans `ROADMAP.md`. C'est une incohérence à trancher.

**Cela semble voulu.** Pour accepter l'écart, Erwan peut ajouter ceci au frontmatter (le vérificateur ne peut pas le faire à sa place) :

```yaml
overrides:
  - must_have: "Erwan relit un thème avec une commande qui liste ce qui reste à relire et passe chaque mesure en relu en enregistrant relecteur et date"
    reason: "Relecture du thème santé confiée à des agents d'IA (trois passes contre la source archivée), mention publique « Relue par l'agent d'IA Claude », avenant à la note de risques ; décision d'Erwan du 2026-11-17"
    accepted_by: "Erwan Henry"
    accepted_at: "<date ISO>"
```

Il faudra ensuite réécrire PUB-01, SC1 et le but de la phase.

### Critère 2 : ✓ VERIFIED

- Site public : `/themes/` ne liste que la santé ; `/themes/travail/` et `/themes/europe-et-monde/` répondent 404 ; aucune occurrence de « brouillon » ni de `data-badge` sur la page thème et les 37 pages candidats. Le seul « brouillon » de la Méthode est l'énoncé d'une règle. `/candidats/laurent-wauquiez/` (personne non relue) répond 404. Le plan du site compte 44 adresses.
- Les gardes sont réelles : `src/lib/content-core/rules/publication.ts`. Un thème `publie` absent de `themes_ouverts` est une erreur en production (`PUBLICATION_THEME_NON_OUVERT`) ; un identifiant inconnu donne `PUBLICATION_THEME_INCONNU`. La règle d'équité (`equite.ts`) et `check-dist` (`THEME_HORS_LISTE_BLANCHE`, `RELECTURE_ABSENTE`, `CANDIDAT_NON_RELU_EN_PRODUCTION`) sont branchés dans `scripts/lib/ci-local.ts` et `scripts/lib/deploiement/construire.ts`. Tests verts.

### Critère 3 : ✓ VERIFIED

- Les 30 sources distinctes citées par les 47 mesures publiées ont toutes `archive.wayback_url`.
- Aucune source du corpus ne porte `wayback_exception` : l'exception Rohou est retirée (décision d'Erwan du 2026-11-17, « Oui, Wayback compris »).
- Trois liens Wayback testés (programme MEI, Polony, Batho) répondent 200.
- Le test `sources-wayback` est vert, et sa liste épinglée est vide.
- La page santé affiche 34 liens « Copie archivée », les pages candidats 54. Un lien « Extrait archivé » testé vers GitHub répond 200.

### Critère 4 : ✓ VERIFIED (éléments attestés par Erwan, avec trace écrite)

Page `/mentions-legales/` servie :
- **Régime :** « édité à titre non professionnel, au sens du II de l'article 1-1 » de la LCEN, avec la phrase sur l'identité communiquée à l'hébergeur.
- **Hébergeur :** Hetzner Online GmbH, adresse, téléphone et registre, identiques à `config/hebergeur.yml` (`actif`).
- **Contact :** `contact@reveletonprog.fr`. Les MX IONOS (`mx00` et `mx01.ionos.fr`) et le SPF répondent.
- **Droit de réponse :** « III de l'article 1-1 », trois mois et trois jours, décret 2007-1527.
- **Journaux :** 14 jours au plus, IP tronquée /24 et /48, en-têtes non enregistrés, sortie d'erreur plafonnée à 30 Mio. Ces chiffres correspondent à la configuration du dépôt : `deploy/caddy/site.caddy` (`roll_keep 12`, `roll_keep_for 288h`, `ip_mask 24 48`, `headers delete`) et `deploy/compose/docker-compose.override.yml` (10 Mo x 3). La configuration réelle du serveur n'a pas été lue (pas de SSH) ; le contrôle 09-12 dit le journal d'accès masqué.
- **Juriste :** « Ces mentions n'ont pas été relues par un juriste ». LEG-02 est rempli par la voie « risque accepté par écrit » : `docs/RISQUES-JURIDIQUES.md`, statut « risque accepté le 2026-11-11 », signature, avenant du 2026-11-17.

Éléments que seul un humain peut attester, trace écrite seulement :
- test de bout en bout du contact le 2026-11-10 ;
- identité transmise à Hetzner le 2026-11-10, preuve gardée hors du dépôt ;
- « Textes lus par le signataire sur Légifrance, date : 2026-11-11 ».

Ces traces sont dans la section Signature de la note. La note précise aussi que la recherche a lu Légifrance par un outil de résumé, avec une confiance moyenne.

### Critère 5 : ⚠ PARTIAL

Ce qui est vérifié :
- **DETTE-04, preuve forte et indépendante.** L'empreinte que j'ai calculée sur un miroir des fichiers servis est égale à celle publiée (`8f7fce…`). Les empreintes de pages du nouveau journal (46 lignes) correspondent aux pages en ligne. L'ancien journal est gardé sous `audit/journal-2026-11-04.jsonl`.
- **Ouverture.** Le domaine répond 200, `www` en 301, avec HSTS (300 s, à allonger après le 2026-11-29 comme prévu), CSP, `nosniff`, `no-referrer` et `Permissions-Policy`. `robots.txt` : `Allow: /` et `Sitemap:`. Aucun `noindex` sur l'accueil. L'adresse inconnue répond 404 « Page introuvable » (`noindex`). `/favicon.ico` répond 200.
- **Hôte technique retiré.** `essai.reveletonprog.fr` ne répond plus (code 000), mais son DNS résout encore : retrait chez IONOS à faire par Erwan, c'est connu.
- **Gel 2027.** Calendrier présent (RUNBOOK, ligne 576 : 17 au 19 avril et 1er au 3 mai) et appliqué par `scripts/garde-gel.ts`. Il est aussi documenté pour le Mac (ligne 887).
- **Moins d'une heure.** Prouvé par l'exercice du 2026-11-21 (53 min 45 s, sur l'hôte d'essai, chemin local), consigné au RUNBOOK.

L'écart : la procédure même de la section « Retrait d'urgence d'une mesure » est écrite pour le chemin GitHub, mis en sommeil le jour de l'ouverture (détail dans `gaps`). En incident réel, la voie 1 telle qu'écrite lance un run vert qui ne déploie rien, et l'étape « Approuver le déploiement » attend une demande qui ne viendra pas. La correction est documentaire et courte.

## Déploiement : écart avec les plans d'origine

Les plans 09-11 à 09-13 prévoyaient une approbation GitHub. Depuis la phase 9.2 (2026-11-19), le déploiement passe par `npm run deploy:local` depuis le Mac. Ce changement est consigné dans les bilans et le RUNBOOK (ligne 624). Il n'invalide aucun critère : la version servie est contrôlée ci-dessus.

## Exigences

| Exigence | Statut | Preuve |
|---|---|---|
| PUB-01 | ✗ BLOQUÉE tel qu'écrite (« Erwan relit ») ; outil livré | critère 1 ; « Pending » dans REQUIREMENTS.md |
| PUB-02 | SATISFAITE | critère 2 |
| PUB-03 | SATISFAITE | 47 sur 47 mesures publiées affichent relecteur et date |
| PUB-04 | SATISFAITE | critère 3 |
| LEG-01 | SATISFAITE (contact et lecture Légifrance attestés par Erwan) | critère 4 |
| LEG-02 | SATISFAITE par risque accepté par écrit, avenant compris | critère 4 |
| LEG-03 | PARTIELLE | critère 5 (procédure dépassée) |
| DETTE-04 | SATISFAITE | critère 5, empreinte reproduite |

Aucune exigence orpheline.

## Affirmations publiques confrontées au comportement réel

| Page | Affirmation | Constat | Gravité |
|---|---|---|---|
| Méthode, Qui sommes-nous | « l'éditeur tranche les cas douteux » | Les agents ont classé 29 mesures en « doute » et 6 en « erreur ». Elles ont été traitées par le circuit agent correcteur puis agent vérificateur. Erwan n'a tranché que les désaccords remontés (cinq points), et par « Suis ton avis ». La formule est défendable (c'est le texte de l'avenant accepté), mais elle laisse entendre un arbitrage cas par cas qui n'a pas eu lieu. | ⚠ WARNING |
| Accueil | « En détail : le coût annoncé, le calendrier, ce qui existe déjà dans la loi et la citation du programme » | Les textes « En détail » disent ce que le programme ne précise pas (coût, calendrier), mais une recherche par mots-clés ne trouve une mention du droit existant que dans 3 textes sur 47 (lecture de deux exemples confirmée). Promesse antérieure à la phase, désormais publique. | ⚠ WARNING |
| Mentions légales | « Aucune relecture par un juriste n'est prévue avant l'ouverture du site. Un juriste pourra les relire après l'ouverture. » | Vrai, mais écrit au futur alors que le site est ouvert. | ℹ INFO |
| Méthode | « Sous 80, le texte pour enfants reçoit un avertissement ; il n'est pas bloqué. » | Exact : 10 mesures santé publiées sont sous 80 (66,2 à 78,9), en avertissement. | ℹ INFO (conforme) |
| Méthode | mesure 4G « sur le site public », 855 ms au plus | Cohérent avec le correctif `df62296` et `MESURE_SERVEUR_4G` ; non remesurée ici | ℹ INFO |
| Méthode | personnes qui ne se présentent pas « listées à part sur chaque page thème » une fois leur statut relu | Désormais au conditionnel, juste (aucune n'est relue) | ✓ |
| Qui sommes-nous | « Une version qui n'a pas encore été relue n'est jamais publiée » | Exact (aucun brouillon servi) | ✓ |

## Anti-patterns et dettes

| Fichier | Ligne | Constat | Gravité |
|---|---|---|---|
| `docs/RUNBOOK.md` | 1006 à 1074, 910 | procédure de retrait sur le chemin GitHub en sommeil ; D-11 dite « en attente » | ⚠ (gap) |
| `docs/RISQUES-JURIDIQUES.md` | 38 (R8) | cite encore « Exception Rohou (décision 3a) », retirée le 2026-11-17 | ℹ |
| `09-11-SUMMARY.md` | 48 | « le 20 novembre 2026 » au lieu du 17 novembre affiché | ℹ (bilan seulement) |
| Fichiers de la phase (relecture, règles, check-dist, pages, RUNBOOK, note) | | aucun `TBD`, `FIXME`, `XXX` | ✓ |

## Vérification humaine

Aucune nouvelle action humaine n'est demandée pour valider les critères vérifiables. Éléments déjà attestés par Erwan, trace écrite seulement :
- confirmation « Ouvert, vérifié » le 2026-11-22 (`09-13-SUMMARY.md` ligne 56, `STATE.md`) ;
- test du contact et transmission d'identité (2026-11-10), lecture Légifrance (2026-11-11), dans la note signée.

Les deux points de décision sont dans `gaps`.

## Résumé des manques

1. **Relecture par Erwan (SC1, PUB-01, but de la phase).** Non faite, par décision écrite d'Erwan du 2026-11-17. Le site le dit honnêtement, mais la garantie humaine visée n'existe pas. À clore par une décision : dérogation et réécriture des textes, ou relecture humaine. Pas de code.
2. **Procédure de retrait d'urgence du RUNBOOK (SC5, LEG-03).** Écrite pour le chemin GitHub, en sommeil depuis l'ouverture. Correction documentaire.

Tout le reste du but est atteint et vérifié de façon indépendante : thème santé seul en production, gardes branchées, Wayback complet, Mentions légales finales, journal d'audit et empreinte identiques à la build servie, site ouvert, hôte d'essai retiré. Deux formulations publiques sont à revoir (arbitrage de l'éditeur, promesse « ce qui existe déjà dans la loi »).

---

_Verified: 2026-11-22T18:05:00Z_
_Verifier: Claude (gsd-verifier)_

## Décisions d'Erwan après la vérification (2026-11-22)

- **Dérogation à PUB-01 et au critère 1 acceptée** (« Oui, dérogation acceptée ») : la relecture du thème santé est faite par un agent d'IA nommé sur chaque mesure (« Relue par l'agent d'IA Claude »), selon sa décision du 2026-11-17 et l'avenant signé à la note de risques ; le site le dit sur la Méthode et sur Qui sommes-nous. PUB-01 est cochée « par dérogation » dans REQUIREMENTS.md.
- **Six textes publics corrigés** (« Applique les six ») : niveau « En détail » de l'accueil (plus de promesse sur le droit existant) ; rôle de l'éditeur (« fixe les règles de relecture, décide des cas qui lui sont soumis ») ; source « du candidat, de sa candidature ou de son parti » ; non-candidats et pressentis ; statut « le plus récent qui a été relu » ; relecture juridique au passé dans les Mentions légales.
- **Corrections de code des deux revues** (« Oui, tout ») et RUNBOOK du retrait d'urgence remis sur le chemin local : en cours.
- **Clôture (2026-11-23)** : les six textes et les corrections de code des deux revues sont en ligne (commit `3702f7f`, vérifiés sur le site public) ; le RUNBOOK du retrait d'urgence décrit le chemin local. Avec la dérogation à PUB-01 acceptée, la vérification passe à `passed`.
