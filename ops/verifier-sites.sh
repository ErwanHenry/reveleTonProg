#!/usr/bin/env bash
# Instantané HTTP de chaque site servi par Caddy, sans nom d'hôte, et comparaison (Phase 8, D-04, D-05 ; HEB-01).
#
# instantane : lit les adresses de site du Caddyfile en service et des fichiers *.caddy du dossier sites.d, garde
#   les noms d'hôte (adresses séparées par des virgules ou des espaces, suite sur la ligne suivante après une
#   virgule ; extraits « (nom) », commentaires et lignes import écartés), compte comme « ignorés » les adresses
#   http:// seules, avec port, génériques (*) ou sans nom d'hôte, puis interroge chaque hôte en local :
#     curl -s -o /dev/null -m 10 -w '%{http_code}' --resolve <hôte>:443:127.0.0.1 https://<hôte>/
#   Sortie standard : une ligne « <12 premiers hexadécimaux du sha256 de l'hôte><tab><code> » par hôte, triée.
#   Sortie d'erreur : « N sites, M joignables (2xx, 3xx, 401), K ignorés ». Aucun nom d'hôte n'est affiché : le
#   fichier produit peut nommer d'autres sites par leur seule empreinte, il ne va pas dans le dépôt public.
# comparer <avant> <apres> : compare deux instantanés par empreinte (s'exécute aussi sur le poste d'Erwan) et
#   affiche « identiques N, differents M, nouveaux P, disparus Q ». Un nouvel hôte (l'hôte technique) est permis.
#
# Usage :
#   ssh <hôte> 'bash -s -- instantane' < ops/verifier-sites.sh > avant.tsv
#   bash ops/verifier-sites.sh comparer avant.tsv apres.tsv
#
# Variables : RTP_CADDYFILE (défaut /opt/vaultwarden/Caddyfile), RTP_SITES_D (défaut /opt/vaultwarden/sites.d).
# curl, awk, sort, sha256sum (ou shasum) sont pris dans PATH. Aucune écriture, aucun redémarrage.
#
# Codes de sortie : 0 instantané pris, ou instantanés sans différence ni disparition ; 1 comparaison avec au moins
# un code différent ou un hôte disparu ; 2 usage ou entrée invalide (Caddyfile illisible, ligne mal formée).
set -euo pipefail
export LC_ALL=C

CADDYFILE=${RTP_CADDYFILE:-/opt/vaultwarden/Caddyfile}
SITES_D=${RTP_SITES_D:-/opt/vaultwarden/sites.d}
TAB=$(printf '\t')

erreur() {
  echo "erreur : $1" >&2
  exit 2
}

usage() {
  erreur "usage : verifier-sites.sh [instantane] | verifier-sites.sh comparer AVANT APRES"
}

empreinte() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | cut -c1-12
  else
    printf '%s' "$1" | shasum -a 256 | cut -c1-12
  fi
}

# Une ligne par adresse de site : « H <hôte en minuscules> » ou « I » (ignorée).
adresses() {
  awk '
    function classer(jeton,   h) {
      if (jeton ~ /^http:\/\//) { print "I"; return }
      h = tolower(jeton)
      sub(/^https:\/\//, "", h)
      sub(/\/.*$/, "", h)
      if (h ~ /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/) print "H " h
      else print "I"
    }
    FNR == 1 { prof = 0; attente = "" }
    {
      sub(/\r$/, "")
      nf = NF
      for (i = 1; i <= NF; i++) if ($i ~ /^#/) { nf = i - 1; break }
      if (prof == 0) {
        ouvre = 0
        for (i = 1; i <= nf; i++) if ($i == "{") { ouvre = i; break }
        fin = ouvre ? ouvre - 1 : nf
        liste = attente
        attente = ""
        for (i = 1; i <= fin; i++) liste = liste " " $i
        sub(/^ +/, "", liste)
        if (liste ~ /^\(/ || liste ~ /^import( |$)/) {
          liste = ""
        } else if (!ouvre) {
          if (liste ~ /,$/) attente = liste
        } else if (liste != "") {
          k = split(liste, jetons, /[ ,]+/)
          for (j = 1; j <= k; j++) if (jetons[j] != "") classer(jetons[j])
        }
      }
      for (i = 1; i <= nf; i++) {
        c = $i; prof += gsub(/[{]/, "", c)
        c = $i; prof -= gsub(/[}]/, "", c)
      }
    }' "$@"
}

instantane() {
  [ $# -eq 0 ] || usage
  [ -f "$CADDYFILE" ] && [ -r "$CADDYFILE" ] || erreur "Caddyfile illisible"
  command -v curl >/dev/null 2>&1 || erreur "curl absent"
  local fichiers=("$CADDYFILE") f liste hotes ignores h code sortie="" total=0 joignables=0
  if [ -d "$SITES_D" ]; then
    for f in "$SITES_D"/*.caddy; do
      if [ -f "$f" ] && [ -r "$f" ]; then fichiers+=("$f"); fi
    done
  fi
  liste=$(adresses "${fichiers[@]}")
  ignores=$(printf '%s\n' "$liste" | grep -c '^I$' || true)
  hotes=$(printf '%s\n' "$liste" | awk '$1 == "H" { print $2 }' | sort -u)
  while IFS= read -r h; do
    [ -n "$h" ] || continue
    code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' --resolve "$h:443:127.0.0.1" "https://$h/" 2>/dev/null) || true
    [[ $code =~ ^[0-9][0-9][0-9]$ ]] || code=000
    total=$((total + 1))
    case "$code" in 2?? | 3?? | 401) joignables=$((joignables + 1)) ;; esac
    sortie="$sortie$(empreinte "$h")${TAB}${code}
"
  done <<<"$hotes"
  printf '%s' "$sortie" | sort
  echo "$total sites, $joignables joignables (2xx, 3xx, 401), $ignores ignorés" >&2
}

comparer() {
  [ $# -eq 2 ] || usage
  local f rc=0
  for f in "$1" "$2"; do
    [ -f "$f" ] && [ -r "$f" ] || erreur "instantané illisible : $f"
    if grep -qvE "^[0-9a-f]{12}${TAB}[0-9]{3}\$" "$f"; then erreur "ligne mal formée dans $f"; fi
  done
  awk -F "$TAB" '
    FILENAME == ARGV[1] { a[$1] = $2; next }
    { b[$1] = $2 }
    END {
      for (k in a) { if (k in b) { if (a[k] == b[k]) id++; else df++ } else ds++ }
      for (k in b) if (!(k in a)) nv++
      printf "identiques %d, differents %d, nouveaux %d, disparus %d\n", id, df, nv, ds
      if (df + ds) exit 1
    }' "$1" "$2" || rc=$?
  return "$rc"
}

MODE=${1:-instantane}
[ $# -eq 0 ] || shift
case "$MODE" in
  instantane) instantane "$@" ;;
  comparer) comparer "$@" ;;
  *) usage ;;
esac
