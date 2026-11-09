#!/usr/bin/env bash
# Classement des fichiers changés : le site est-il touché ? (jobs changements et deploy de .github/workflows/ci.yml)
#
# Lit sur l'entrée standard une liste de chemins séparés par des octets nuls (sortie de
# « git diff --no-renames --name-only -z A B ») et écrit « true » si au moins un chemin est HORS de la liste
# CHEMINS_HORS_SITE, « false » sinon (liste vide comprise). Un push qui ne touche que la documentation, la
# planification, les tests, l'outillage ou les workflows ne crée donc aucune demande de déploiement.
#
# CHEMINS_HORS_SITE (obligatoire, définie une seule fois, dans l'env du workflow ci.yml) : motifs séparés par des
# espaces.
#   - motif terminé par « / » : dossier à la racine du dépôt, tout ce qu'il contient (« docs/ ») ;
#   - autre motif : fichier à la racine seulement, jokers du shell admis (« README.md », « *.md ») ; un fichier
#     de même nom dans un sous-dossier (« src/notes.md ») reste un changement du site.
# La liste est volontairement prudente : tout chemin non listé (src/, content/, config/, scripts/, package.json,
# astro.config.mjs, public/, ...) compte comme un changement du site.
#
# Essai sur le Mac :
#   printf 'docs/RUNBOOK.md\0src/pages/index.astro\0' | CHEMINS_HORS_SITE='docs/ *.md' bash ops/site-touche.sh
#
# Codes de sortie : 0 verdict écrit ; 2 CHEMINS_HORS_SITE absente ou vide.
set -euo pipefail

hors_site() {
  local chemin=$1 motif
  for motif in "${MOTIFS[@]}"; do
    if [[ $motif == */ ]]; then
      [[ $chemin == "$motif"* ]] && return 0
    else
      # Motif de racine : le chemin ne doit contenir aucun « / » ; $motif non cité pour garder les jokers.
      # shellcheck disable=SC2053
      [[ $chemin != */* && $chemin == $motif ]] && return 0
    fi
  done
  return 1
}

if [ -z "${CHEMINS_HORS_SITE:-}" ]; then
  echo "site-touche : CHEMINS_HORS_SITE absente ou vide." >&2
  exit 2
fi
# read découpe sur les espaces et les fins de ligne sans développer les jokers (« *.md » reste un motif) ; il
# répond 1 en fin d'entrée, d'où le « || true ».
read -r -d '' -a MOTIFS <<< "$CHEMINS_HORS_SITE" || true

# Toute l'entrée est lue, même après un premier chemin du site : un arrêt précoce ferait échouer
# « git diff | site-touche » par SIGPIPE sous pipefail.
site=false
while IFS= read -r -d '' chemin || [ -n "$chemin" ]; do
  [ -z "$chemin" ] && continue
  hors_site "$chemin" || site=true
done
echo "$site"
