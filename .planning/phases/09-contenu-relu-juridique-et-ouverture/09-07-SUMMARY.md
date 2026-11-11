---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 07
subsystem: ops, infra, check-dist, testing
tags: [installer, caddy, site-public, restauration, favicon, check-dist, bash, node-test]

# Dependency graph
requires:
  - phase: 08
    provides: ops/installer-serveur.sh (étapes idempotentes, --verifier/--appliquer), ops/tester-restauration.sh, deploy/caddy/site.caddy et essai.caddy, e2e/serveur.ts
  - phase: 09-02
    provides: codes check-dist et liste blanche (TYPE_FICHIER_INATTENDU déjà actif dans le CLI)
provides:
  - "Étape site-public de ops/installer-serveur.sh (sites.d/reveletonprog.caddy, codes 6 et 7)"
  - "Marqueur /opt/rtp/essai-retire : site-essai répond [ok: retiré] et n'écrit plus rien"
  - "ops/tester-restauration.sh : étapes de l'installateur déduites des blocs restaurés, étape d'échec « blocs »"
  - "scripts/favicon.ts (genererFavicon, --check) et public/favicon.ico (268 octets)"
  - "TYPES_AUTORISES, FAVICON et LIMITES.favicon exportés par scripts/lib/check-dist.ts"
affects: [09-09, 09-12]

tech-stack:
  added: []
  patterns:
    - "Adresses de premier niveau d'un fichier Caddy lues par profondeur d'accolades (bash 3.2, sans eval)"
    - "Liste d'étapes du test de restauration calculée à partir de l'arbre restauré, jamais figée"
    - "Binaire versionné produit par un générateur du dépôt et comparé octet pour octet par un test (zlib niveau 0 : mêmes octets sur toute machine)"

key-files:
  created:
    - scripts/favicon.ts
    - public/favicon.ico
    - tests/scripts/favicon.test.ts
  modified:
    - ops/installer-serveur.sh
    - ops/tester-restauration.sh
    - tests/repo/installer-serveur.test.ts
    - tests/repo/sauvegarde.test.ts
    - scripts/lib/check-dist.ts
    - scripts/check-dist.ts
    - tests/scripts/check-dist.test.ts
    - tests/dist/cas/version.cas.ts
    - e2e/serveur.ts
    - tests/scripts/e2e-serveur.test.ts
    - docs/RUNBOOK.md

key-decisions:
  - "site-public vérifie chaque adresse de premier niveau du bloc (nom nu et www) ; adresse_bloc devient adresses_bloc et sert aussi à site-essai (même comportement sur un bloc d'un seul site)"
  - "Code 7 si /srv/reveletonprog/current n'est ni un lien ni un dossier, dans les deux modes : un lien pendant (releases/<sha> absent) est accepté, comme après le verbe activer"
  - "Le marqueur essai-retire est dérivé de --racine comme les autres chemins ; l'installateur ne le crée ni ne le supprime (test statique)"
  - "Le test de restauration recrée srv/reveletonprog/current seulement pour une cible relative releases/<nom> lue dans liens.txt, sans jamais la suivre (esprit de CR-01)"
  - "Icône : palette de deux couleurs (--encre #1F2328, --fond #FAFAF8), un bit par pixel, flux zlib stocké (niveau 0) pour un résultat identique quel que soit le zlib (Chromium zlib et SIMD donnent d'autres octets aux niveaux compressés)"
  - "Le serveur de test sert l'icône en Cache-Control no-cache comme le bloc Caddy : en no-store, Chromium refuse le bfcache de la page"

patterns-established:
  - "Une étape d'installation qui ne doit plus revenir est neutralisée par un marqueur posé par la commande approuvée, pas par une option"

requirements-completed: []

# Metrics
duration: 75min
completed: 2026-11-11
---

# Phase 9 Plan 07 : étape site-public, restauration conditionnelle et favicon.ico Summary

**Étape d'installation `site-public` (adresses vérifiées, racine `current` exigée), marqueur `/opt/rtp/essai-retire` qui neutralise `site-essai`, test de restauration qui suit les blocs présents dans l'archive, et icône de 268 octets générée par le dépôt avec sa règle check-dist.**

## Performance

- **Duration:** environ 75 min
- **Completed:** 2026-11-11
- **Tasks:** 2 (TDD rouge puis vert pour chacune)
- **Files modified:** 14 (3 créés, 11 modifiés)

## Accomplishments

- `ops/installer-serveur.sh` : nouvelle étape `site-public`, placée après `site-essai`. Elle installe `deploy/caddy/site.caddy` en `sites.d/reveletonprog.caddy` comme `site-essai` installe son bloc (fichier temporaire dans le dossier monté, 644, root, renommage). Elle refuse en code 6 une adresse réservée dans l'un ou l'autre bloc, ou un fichier sans adresse. Elle refuse en code 7 tant que `/srv/reveletonprog/current` n'existe pas. En-tête, usage, `ORDRE_ETAPES` et codes de sortie sont à jour.
- Marqueur `/opt/rtp/essai-retire` : quand il est présent, `site-essai` imprime une seule ligne `[ok: retiré] reveletonprog-essai.caddy : hôte technique retiré le <date> (marqueur présent), rien à installer`. Il n'exige plus la source `essai.caddy`, ne contrôle plus son adresse et n'écrit rien, dans les deux modes, que l'étape soit nommée seule ou dans la liste complète.
- `ops/tester-restauration.sh` : la liste d'étapes est `montages,import-caddy,commande,battement,sauvegarde`, plus `site-essai` et/ou `site-public` selon les blocs restaurés. S'il n'y a aucun des deux blocs, le test échoue à l'étape `blocs` sans ping. Le lien `current` de production est recréé d'après `liens.txt` pour que le code 7 ne bloque pas une archive légitime.
- `scripts/favicon.ts` et `public/favicon.ico` : ICO d'une seule image PNG 32 x 32, 268 octets. C'est un carré `--encre` avec un carré intérieur `--fond`, une œuvre originale du dépôt. `--check` détecte la dérive, `--sortie` écrit ailleurs.
- `scripts/lib/check-dist.ts` exporte `TYPES_AUTORISES` (`.html .txt .xml .json .ico`), `FAVICON` et `LIMITES.favicon = 4096`. Un `.ico` n'est admis que s'il s'appelle exactement `favicon.ico`, à la racine. Toute autre icône, ou une icône trop lourde, donne `TYPE_FICHIER_INATTENDU` avec la condition en cause. Le CLI et `tests/dist/cas/version.cas.ts` utilisent cette constante.
- `e2e/serveur.ts` sert `.ico` en `image/x-icon` (no-cache). Le RUNBOOK a été mis à jour (étapes, codes 6 et 7, marqueur, test de restauration, ligne `TYPE_FICHIER_INATTENDU`).

## Task Commits

1. **Task 1 : installer site-public et restauration selon les blocs**
   - `c7ad52c` test(09-07) : rouge
   - `bd0d15a` feat(09-07) : vert
2. **Task 2 : favicon.ico et règle check-dist**
   - `465ded9` test(09-07) : rouge
   - `e505de4` feat(09-07) : vert

## Verification

- `fnm exec --using=24 npm test` : 2514 tests, 2505 réussis, 0 échec, 9 sautés (shellcheck absent en local, cas GNU). Le suite a été relancée après la dernière correction.
- `fnm exec --using=24 npm run check` : 0 erreur, 0 avertissement.
- `RTP_MODE=production npm run build` puis `npm run check-dist` : 0 erreur. Il reste les 3 avertissements déjà connus (`PUBLICATION_VIDE`, `HEBERGEUR_PREVU` x2) et aucun `TYPE_FICHIER_INATTENDU`. `dist/favicon.ico` est identique à `public/favicon.ico`.
- `npm run e2e -- --jeu m1` : 259 réussis, y compris les specs CSP et bfcache.
- `node scripts/favicon.ts --check` : à jour.
- Critères d'acceptation vérifiés :
  - aucun `docker`, `caddy reload`, `systemctl`, `sed -i` ni `eval` hors commentaires de l'installateur (0) ;
  - `site-public` apparaît 6 fois, `essai-retire` 2 fois, `ok: retiré` 2 fois ;
  - la liste d'étapes figée n'existe plus dans `tester-restauration.sh` ;
  - l'icône fait 268 octets (moins de 1024) ;
  - aucune balise `rel="icon"` dans `Base.astro`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Icône en no-store : bfcache perdu sous Chromium**
- **Found during:** Task 2 (passage e2e m1)
- **Issue:** une fois `/favicon.ico` servi avec le `Cache-Control: no-store` du serveur de test, les deux specs bfcache de `e2e/parcours.spec.ts` échouaient (`pageshow persisted` jamais vrai). Sans l'icône, ou avec l'icône en `no-cache`, elles passent. J'ai reproduit les trois cas sur le même dist.
- **Fix:** le serveur de test sert l'icône en `no-cache`, valeur que le bloc Caddy envoie déjà sur toute réponse (`deploy/caddy/site.caddy`). Le test du serveur épingle cette valeur. Rien ne change côté Caddy. Il ne faudra jamais ajouter de règle `no-store` pour l'icône.
- **Files modified:** e2e/serveur.ts, tests/scripts/e2e-serveur.test.ts
- **Commit:** e505de4

**2. [Rule 1 - Bug, test] Instantané de racine et liens pendants ; casse des noms sous macOS**
- **Found during:** Task 1 et Task 2
- **Issue 1:** `instantane()` (tests/repo/installer-serveur.test.ts) lisait le contenu d'un lien `current` pendant (ENOENT).
- **Fix 1:** les liens sont maintenant notés par leur cible.
- **Issue 2:** un cas check-dist « Favicon.ico » écrasait `favicon.ico` sur le système de fichiers insensible à la casse du Mac.
- **Fix 2:** ce nom a été remplacé par `favicon-2.ico`.
- **Commits:** bd0d15a, e505de4

### Interprétation

- « L'installateur lancé sans `--etape` » : `--etape` reste obligatoire (code 2, comportement existant épinglé par un test). Le cas couvert est la liste complète des étapes, en application comme en vérification. Rendre `--etape` facultatif aurait changé le comportement des étapes existantes, ce que la consigne interdit.

Aucun fichier hors de `files_modified`. `ops/sauvegarder-config.sh` n'a pas été modifié : il archive déjà tout `sites.d` et tolère les chemins d'essai absents, comme le prouve le cas « bloc public seul ».

## Ce qui reste à appliquer sur le serveur (orchestrateur, avec l'accord explicite d'Erwan)

Rien n'a été lancé sur le VPS. Dans l'ordre :

1. **Lecture seule.** Vérification depuis une copie éphémère du dépôt. Elle doit montrer `[a faire]` pour `rtp-tester-restauration` (nouvelle version) et pour `/opt/rtp/depot` :
   `tar -C . -cz ops deploy | ssh keel-vps 'd=$(mktemp -d) && tar -xz -C "$d" && bash "$d/ops/installer-serveur.sh" --verifier --etape montages,import-caddy,commande,battement,sauvegarde,site-essai,depot; r=$?; rm -rf "$d"; exit $r'`
2. **Écriture.** Installer le nouveau test de restauration et rafraîchir la copie du dépôt, depuis une copie fraîche des scripts. C'est à faire **avant le 1er décembre** (test mensuel) et, dans tous les cas, **avant le retrait de l'hôte `essai`** : l'ancienne version installée a la liste figée avec `site-essai` et échouerait après le retrait.
   `tar -C . -cz ops deploy | ssh keel-vps 'd=$(mktemp -d) && tar -xz -C "$d" && bash "$d/ops/installer-serveur.sh" --appliquer --etape sauvegarde,depot </dev/null; r=$?; rm -rf "$d"; exit $r'`
3. **Lecture seule sur la configuration, mais envoie un ping.** Contrôle du test de restauration installé : `ssh keel-vps 'rtp-tester-restauration'`. Il travaille dans un dossier jetable et envoie le ping de succès du contrôle `restauration-mensuelle` s'il réussit ; l'étape `[info] étapes de l'installateur : …,site-essai` doit apparaître. Par ailleurs, `--verifier --etape site-public` répond code 7 tant que la cible production n'est pas déployée, ce qui est attendu.
4. **À l'ouverture (09-12), après le premier déploiement `production` approuvé par Erwan :**
   - **lecture seule :** `ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --verifier --etape site-public'` ;
   - **écriture :** `ssh keel-vps 'bash /opt/rtp/depot/ops/installer-serveur.sh --appliquer --etape site-public </dev/null'` ;
   - **lecture seule :** `ssh keel-vps 'RTP_AVEC_SANS_VARIABLES=1 bash -s' < ops/valider-caddy.sh` puis `ssh keel-vps 'docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile'` ;
   - **écriture**, seulement si c'est valide : `ssh keel-vps 'docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'`, avec `ops/verifier-sites.sh` avant et après.
5. **Au retrait de l'hôte technique (09-12, écriture, commande approuvée séparée) :** retirer `sites.d/reveletonprog-essai.caddy` et poser le marqueur `/opt/rtp/essai-retire` dans la même commande, puis faire validate et reload. Le marqueur n'est jamais posé par l'installateur.

`/favicon.ico` ne répondra plus 404 qu'au premier déploiement d'une build contenant ce commit (approbation d'Erwan).

## Known Stubs

None.

## Threat Flags

None. Toutes les surfaces sont couvertes par T-09-35 à T-09-40 :
- l'étape écrit dans `sites.d` ;
- le marqueur ne fait que lire un fichier ;
- le lien recréé reste dans un dossier jetable, sans jamais être suivi ;
- le nouveau type de fichier est limité à une icône de 4 096 octets au plus.

## Self-Check: PASSED

- Fichiers présents : `scripts/favicon.ts`, `public/favicon.ico`, `tests/scripts/favicon.test.ts`, `ops/installer-serveur.sh`, `ops/tester-restauration.sh`.
- Commits présents : c7ad52c, bd0d15a, 465ded9, e505de4.
