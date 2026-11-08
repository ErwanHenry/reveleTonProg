#!/usr/bin/env bash
# Sauvegarde de la configuration serveur de reveleTonProg (Phase 8, D-15 ; OPS-03).
#
# Installé en /usr/local/sbin/rtp-sauvegarder (root, 0755) par ops/installer-serveur.sh, étape sauvegarde, et lancé
# chaque jour à 02:45 UTC par /etc/cron.d/rtp-sauvegarde. Le contenu du site n'est pas sauvegardé (il se reconstruit
# depuis Git), ni les certificats (Caddy les redemande) : seulement les petits fichiers de configuration du site sur
# la machine partagée.
#
# Archive : <destination>/<AAAA-MM-JJ>.tar.gz (date UTC ; un second passage le même jour la remplace), root, 0600,
# dans un dossier 0700. Elle contient, sous leurs chemins relatifs à la racine :
#   opt/vaultwarden/Caddyfile, docker-compose.yml (obligatoires), docker-compose.override.yml, .env, sites.d/
#   etc/cron.d/rtp-*, etc/rtp/ (fichiers d'environnement des pings), home/deploy/.ssh/authorized_keys
#   usr/local/sbin/rtp-*, etc/ssh/ssh_host_*_key.pub (clés d'hôte publiques seulement, jamais les privées)
#   srv/reveletonprog/.historique, srv/reveletonprog/essai/.historique
# plus MANIFESTE.txt (une ligne « sha256  chemin » par fichier, « absent chemin » pour un chemin facultatif absent)
# et liens.txt (cible des deux liens current, ou « absent »). Les 6 archives les plus récentes sont gardées.
#
# L'archive reste sur la machine : Erwan la tire vers son Mac (scp vers un dossier 0700 hors de tout dépôt). C'est un
# modèle « tiré » : la machine ne détient aucun identifiant sortant. Elle contient les empreintes bcrypt (.env) et
# les adresses de ping (etc/rtp/) : Erwan garde aussi ces deux fichiers secrets dans Vaultwarden. Elle n'est
# envoyée nulle part ailleurs. ops/tester-restauration.sh prouve qu'elle se restaure (chaque mois).
#
# Usage :
#   rtp-sauvegarder [--racine <dir>] [--destination <dir>]
#   --racine       préfixe de tous les chemins du serveur (défaut /)
#   --destination  dossier des archives (défaut <racine>/root/rtp-sauvegardes)
#
# Variables : RTP_DATE (AAAA-MM-JJ, défaut : date UTC du jour ; pour les tests).
#
# Sortie : une ligne JSON (date, archive, nombre de fichiers, taille en octets, nombre d'absents). Jamais le
# contenu d'un fichier ni une empreinte : seulement des chemins et des nombres.
#
# Codes de sortie : 0 archive écrite ; 1 échec (Caddyfile ou fichier de composition absent, tar en échec) ;
# 2 usage (option inconnue, racine relative ou introuvable, date invalide). Compatible bash 3.2.
set -euo pipefail
export LC_ALL=C
# tar de macOS (tests) : pas de fichiers AppleDouble « ._* » dans l'archive.
export COPYFILE_DISABLE=1
umask 077

GARDER=6
RE_DATE='^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
RE_ARCHIVE='^[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz$'
# Chemins relatifs à la racine ; les motifs sont développés dans la racine (aucune correspondance = absent).
OBLIGATOIRES=(opt/vaultwarden/Caddyfile opt/vaultwarden/docker-compose.yml)
FACULTATIFS=(
  opt/vaultwarden/docker-compose.override.yml
  opt/vaultwarden/.env
  opt/vaultwarden/sites.d
  'etc/cron.d/rtp-*'
  etc/rtp
  home/deploy/.ssh/authorized_keys
  'usr/local/sbin/rtp-*'
  'etc/ssh/ssh_host_*_key.pub'
  srv/reveletonprog/.historique
  srv/reveletonprog/essai/.historique
)
LIENS=(srv/reveletonprog/current srv/reveletonprog/essai/current)

usage() {
  cat <<'FIN'
Usage : sauvegarder-config.sh [--racine <dir>] [--destination <dir>]
FIN
}
erreur_usage() {
  printf '[erreur] %s\n' "$1" >&2
  usage >&2
  exit 2
}
echec() {
  printf '[erreur] %s\n' "$1" >&2
  exit 1
}

RACINE_ARG=/
DESTINATION=''
while [ $# -gt 0 ]; do
  case "$1" in
    --racine | --destination)
      [ $# -ge 2 ] || erreur_usage "valeur manquante après $1"
      if [ "$1" = --racine ]; then RACINE_ARG=$2; else DESTINATION=$2; fi
      shift 2
      ;;
    -h | --aide) usage; exit 0 ;;
    *)
      if [[ "$1" =~ ^--?[a-z-]+$ ]]; then erreur_usage "option inconnue : $1"; fi
      erreur_usage "argument inconnu"
      ;;
  esac
done

case "$RACINE_ARG" in /*) ;; *) erreur_usage "--racine doit être un chemin absolu" ;; esac
R=$RACINE_ARG
while [ "${R%/}" != "$R" ]; do R=${R%/}; done
RACINE=${R:-/}
[ -d "$RACINE" ] || erreur_usage "--racine introuvable"
if [ -z "$DESTINATION" ]; then DESTINATION="$R/root/rtp-sauvegardes"; fi
case "$DESTINATION" in /*) ;; *) erreur_usage "--destination doit être un chemin absolu" ;; esac

JOUR=${RTP_DATE:-$(date -u +%Y-%m-%d)}
[[ $JOUR =~ $RE_DATE ]] || erreur_usage "RTP_DATE attend AAAA-MM-JJ"

empreinte() { # fichier -> sha256 hexadécimal
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -- "$1" | awk '{ print $1 }'
  else
    shasum -a 256 -- "$1" | awk '{ print $1 }'
  fi
}

# --- Fichiers temporaires (seule chose supprimée, avec les archives au-delà des 6 plus récentes) ------------------
PREPARATION=''
ARCHIVE_TMP=''
nettoyer() {
  if [ -n "$PREPARATION" ]; then rm -rf -- "$PREPARATION"; fi
  if [ -n "$ARCHIVE_TMP" ]; then rm -f -- "$ARCHIVE_TMP"; fi
}
trap nettoyer EXIT
PREPARATION=$(mktemp -d "${TMPDIR:-/tmp}/rtp-sauvegarde.XXXXXX")

# --- Liste des entrées et manifeste -------------------------------------------------------------------------------
for p in "${OBLIGATOIRES[@]}"; do
  [ -f "$R/$p" ] || echec "/$p absent : rien n'est archivé"
done

ENTREES=()
FICHIERS=0
ABSENTS=0
MANIFESTE="$PREPARATION/MANIFESTE.txt"
: >"$MANIFESTE"

manifester() { # chemin relatif d'un fichier ordinaire
  printf '%s  %s\n' "$(empreinte "$R/$1")" "$1" >>"$MANIFESTE"
  FICHIERS=$((FICHIERS + 1))
}

ajouter() { # chemin relatif existant (fichier ou dossier)
  local rel=$1 f
  case "$rel" in *_key) return 0 ;; esac
  ENTREES+=("$rel")
  if [ -d "$R/$rel" ] && [ ! -L "$R/$rel" ]; then
    while IFS= read -r f; do
      manifester "$f"
    done < <(cd "$RACINE" && find "$rel" -type f ! -name '*_key' | sort)
  elif [ -f "$R/$rel" ]; then
    manifester "$rel"
  fi
}

shopt -s nullglob
for motif in "${OBLIGATOIRES[@]}" "${FACULTATIFS[@]}"; do
  trouves=()
  for f in "$R"/$motif; do
    if [ -e "$f" ] || [ -L "$f" ]; then trouves+=("${f#"$R"/}"); fi
  done
  if [ "${#trouves[@]}" -eq 0 ]; then
    printf 'absent %s\n' "$motif" >>"$MANIFESTE"
    ABSENTS=$((ABSENTS + 1))
  else
    for f in "${trouves[@]}"; do ajouter "$f"; done
  fi
done
shopt -u nullglob

LISTE_LIENS="$PREPARATION/liens.txt"
: >"$LISTE_LIENS"
for l in "${LIENS[@]}"; do
  if [ -L "$R/$l" ]; then
    printf '%s %s\n' "$l" "$(readlink "$R/$l")" >>"$LISTE_LIENS"
  else
    printf '%s absent\n' "$l" >>"$LISTE_LIENS"
  fi
done

# --- Archive : fichier temporaire 0600 dans la destination, puis renommage ----------------------------------------
mkdir -p "$DESTINATION"
chmod 700 "$DESTINATION"
NOM="$JOUR.tar.gz"
ARCHIVE_TMP=$(mktemp "$DESTINATION/.rtp-sauvegarde.XXXXXX")
chmod 600 "$ARCHIVE_TMP"
tar -czf "$ARCHIVE_TMP" '--exclude=*_key' -C "$RACINE" "${ENTREES[@]}" -C "$PREPARATION" MANIFESTE.txt liens.txt ||
  echec "tar en échec : archive non écrite"
mv -f "$ARCHIVE_TMP" "$DESTINATION/$NOM"
ARCHIVE_TMP=''
OCTETS=$(wc -c <"$DESTINATION/$NOM" | tr -d ' ')

# --- Rotation : les 6 plus récentes (les noms datés se trient dans l'ordre chronologique) -------------------------
ARCHIVES=()
for f in "$DESTINATION"/*.tar.gz; do
  [ -f "$f" ] || continue
  if [[ ${f##*/} =~ $RE_ARCHIVE ]]; then ARCHIVES+=("$f"); fi
done
EN_TROP=$((${#ARCHIVES[@]} - GARDER))
i=0
while [ "$i" -lt "$EN_TROP" ]; do
  rm -f -- "${ARCHIVES[$i]}"
  i=$((i + 1))
done

printf '{"evenement":"sauvegarde","date":"%s","archive":"%s","fichiers":%s,"octets":%s,"absents":%s}\n' \
  "$JOUR" "$NOM" "$FICHIERS" "$OCTETS" "$ABSENTS"
