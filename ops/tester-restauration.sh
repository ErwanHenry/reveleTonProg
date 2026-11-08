#!/usr/bin/env bash
# Test de restauration de la configuration serveur de reveleTonProg (Phase 8, D-15 ; OPS-03).
#
# Installé en /usr/local/sbin/rtp-tester-restauration (root, 0755) par ops/installer-serveur.sh, étape sauvegarde ;
# lancé le 1er de chaque mois à 11:00 UTC par /etc/cron.d/rtp-restauration (étape restauration-mensuelle), et à la
# main pour la vraie restauration avant l'ouverture. Prouve, sur des copies jetables, que la dernière archive de
# ops/sauvegarder-config.sh restaure une configuration complète, conforme et valide. Rien de ce qui est en service
# n'est modifié : extraction dans un dossier mktemp retiré à la sortie, installateur en vérification seulement,
# Caddy validé dans un conteneur jetable sans réseau (ops/valider-caddy.sh).
#
# Étapes :
#   archive       la plus récente <destination>/<AAAA-MM-JJ>.tar.gz, extraite par « tar -xpzf » (modes gardés)
#                 dans le dossier jetable ; puis le squelette que l'archive ne porte pas est recréé (0755) :
#                 srv/reveletonprog/{incoming/essai,incoming/production,releases,essai/releases}, var/log/caddy
#   1 hachages    chaque ligne de MANIFESTE.txt : fichier présent et sha256 identique, sinon échec
#   2 comparaison chaque fichier restauré comparé au fichier en service sous --racine ; une différence est
#                 signalée « modifié depuis la sauvegarde » et n'échoue que si l'archive est du jour ; les
#                 historiques de déploiement (.historique) et les liens current changent à chaque déploiement :
#                 signalés, jamais en échec
#   3 installateur  <source>/ops/installer-serveur.sh --verifier --etape
#                 montages,import-caddy,commande,battement,sauvegarde,site-essai --racine <arbre restauré> : aucune
#                 ligne « [a faire] » permise
#   4 caddy       <source>/ops/valider-caddy.sh avec RTP_CADDYFILE et RTP_SITES_D sur la copie restaurée, avec et
#                 sans les variables d'empreinte : valide exigé
#   5 ping        succès seulement : ping du contrôle restauration-mensuelle (HC_RESTAURATION lu dans
#                 <racine>/etc/rtp/restauration.env, jamais affiché) ; fichier ou clé absents : pas de ping, signalé
#
# Usage :
#   rtp-tester-restauration [--racine <dir>] [--destination <dir>] [--source <dir>]
#   --racine       préfixe des fichiers en service (défaut /)
#   --destination  dossier des archives (défaut <racine>/root/rtp-sauvegardes)
#   --source       copie du dépôt sur la machine, avec ops/ et deploy/ (défaut <racine>/opt/rtp/depot)
#
# Variables : RTP_DATE (AAAA-MM-JJ, défaut : date UTC du jour ; décide si l'archive est « du jour »).
#
# Sortie : une ligne JSON. Succès : date, archive, fichiers, hachages "ok", modifies, installateur "conforme",
# caddy "valide", ping. Échec : resultat "echec" et l'étape en cause. Les diagnostics (chemins seulement, jamais un
# contenu, une empreinte de .env ni l'adresse de ping) vont sur stderr.
#
# Codes de sortie : 0 restauration prouvée (ping envoyé, ou absent faute de fichier d'environnement) ; 1 étape en
# échec (aucun ping) ou ping en échec ; 2 usage. Compatible bash 3.2.
set -euo pipefail
export LC_ALL=C
export COPYFILE_DISABLE=1
# Le dossier jetable est créé en 0700 par mktemp ; dedans, les dossiers parents créés par tar (usr/local/sbin,
# etc/cron.d...) doivent être en 0755 comme sur le serveur.
umask 022

ETAPES_INSTALLATEUR='montages,import-caddy,commande,battement,sauvegarde,site-essai'
RE_DATE='^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
RE_ARCHIVE='^([0-9]{4}-[0-9]{2}-[0-9]{2})\.tar\.gz$'
RE_URL_PING='^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$'
SQUELETTE=(srv/reveletonprog srv/reveletonprog/incoming srv/reveletonprog/incoming/essai srv/reveletonprog/incoming/production srv/reveletonprog/releases srv/reveletonprog/essai srv/reveletonprog/essai/releases var/log/caddy)

usage() {
  cat <<'FIN'
Usage : tester-restauration.sh [--racine <dir>] [--destination <dir>] [--source <dir>]
FIN
}
erreur_usage() {
  printf '[erreur] %s\n' "$1" >&2
  usage >&2
  exit 2
}
diag() { printf '%s\n' "$1" >&2; }

RACINE_ARG=/
DESTINATION=''
SOURCE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --racine | --destination | --source)
      [ $# -ge 2 ] || erreur_usage "valeur manquante après $1"
      case "$1" in
        --racine) RACINE_ARG=$2 ;;
        --destination) DESTINATION=$2 ;;
        --source) SOURCE=$2 ;;
      esac
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
[ -d "${R:-/}" ] || erreur_usage "--racine introuvable"
if [ -z "$DESTINATION" ]; then DESTINATION="$R/root/rtp-sauvegardes"; fi
if [ -z "$SOURCE" ]; then SOURCE="$R/opt/rtp/depot"; fi
case "$DESTINATION" in /*) ;; *) erreur_usage "--destination doit être un chemin absolu" ;; esac
[ -f "$SOURCE/ops/installer-serveur.sh" ] || erreur_usage "--source sans ops/installer-serveur.sh"
[ -f "$SOURCE/ops/valider-caddy.sh" ] || erreur_usage "--source sans ops/valider-caddy.sh"

JOUR=${RTP_DATE:-$(date -u +%Y-%m-%d)}
[[ $JOUR =~ $RE_DATE ]] || erreur_usage "RTP_DATE attend AAAA-MM-JJ"

empreinte() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -- "$1" | awk '{ print $1 }'
  else
    shasum -a 256 -- "$1" | awk '{ print $1 }'
  fi
}

DATE_ARCHIVE=''
NOM_ARCHIVE=''
echec() { # étape message
  diag "[échec] $2"
  printf '{"evenement":"restauration","resultat":"echec","etape":"%s","date":"%s","archive":"%s"}\n' "$1" "$DATE_ARCHIVE" "$NOM_ARCHIVE"
  exit 1
}

# --- Archive la plus récente --------------------------------------------------------------------------------------
ARCHIVE=''
if [ -d "$DESTINATION" ]; then
  for f in "$DESTINATION"/*.tar.gz; do
    [ -f "$f" ] || continue
    if [[ ${f##*/} =~ $RE_ARCHIVE ]]; then ARCHIVE=$f; DATE_ARCHIVE=${BASH_REMATCH[1]}; fi
  done
fi
[ -n "$ARCHIVE" ] || echec archive "aucune archive AAAA-MM-JJ.tar.gz dans $DESTINATION"
NOM_ARCHIVE=${ARCHIVE##*/}

TRAVAIL=$(mktemp -d "${TMPDIR:-/tmp}/rtp-restauration.XXXXXX")
trap 'rm -rf -- "$TRAVAIL"' EXIT
EXTRAIT="$TRAVAIL/racine"
mkdir "$EXTRAIT"
tar -xpzf "$ARCHIVE" -C "$EXTRAIT" 2>/dev/null || echec archive "extraction de $NOM_ARCHIVE en échec"
[ -f "$EXTRAIT/MANIFESTE.txt" ] || echec hachages "MANIFESTE.txt absent de $NOM_ARCHIVE"
for d in "${SQUELETTE[@]}"; do
  mkdir -p "$EXTRAIT/$d"
  chmod 755 "$EXTRAIT/$d"
done

# --- 1. Hachages --------------------------------------------------------------------------------------------------
FICHIERS=0
DEFAUTS=0
LISTE=()
while IFS= read -r ligne || [ -n "$ligne" ]; do
  case "$ligne" in '' | 'absent '*) continue ;; esac
  h=${ligne%%  *}
  p=${ligne#*  }
  if ! [[ $h =~ ^[0-9a-f]{64}$ ]] || [ "$p" = "$ligne" ]; then
    DEFAUTS=$((DEFAUTS + 1)); diag "ligne de manifeste illisible"; continue
  fi
  case "/$p/" in */../* | //*) DEFAUTS=$((DEFAUTS + 1)); diag "chemin refusé dans le manifeste"; continue ;; esac
  if [ ! -f "$EXTRAIT/$p" ] || [ -L "$EXTRAIT/$p" ]; then
    DEFAUTS=$((DEFAUTS + 1)); diag "manquant dans l'archive : $p"; continue
  fi
  if [ "$(empreinte "$EXTRAIT/$p")" != "$h" ]; then
    DEFAUTS=$((DEFAUTS + 1)); diag "empreinte différente du manifeste : $p"; continue
  fi
  FICHIERS=$((FICHIERS + 1))
  LISTE+=("$p")
done <"$EXTRAIT/MANIFESTE.txt"
[ "$DEFAUTS" -eq 0 ] || echec hachages "$DEFAUTS fichier(s) manquant(s) ou altéré(s) dans $NOM_ARCHIVE"
[ "$FICHIERS" -gt 0 ] || echec hachages "manifeste vide dans $NOM_ARCHIVE"

# --- 2. Comparaison avec les fichiers en service ------------------------------------------------------------------
MODIFIES=0
BLOQUANTS=0
for p in "${LISTE[@]}"; do
  if [ -f "$R/$p" ] && cmp -s "$EXTRAIT/$p" "$R/$p"; then continue; fi
  case "$p" in
    srv/reveletonprog/.historique | srv/reveletonprog/essai/.historique)
      diag "[info] déploiement depuis la sauvegarde : $p"
      ;;
    *)
      MODIFIES=$((MODIFIES + 1))
      diag "[modifié depuis la sauvegarde] /$p"
      if [ "$DATE_ARCHIVE" = "$JOUR" ]; then BLOQUANTS=$((BLOQUANTS + 1)); fi
      ;;
  esac
done
if [ -f "$EXTRAIT/liens.txt" ]; then
  while IFS=' ' read -r lien cible || [ -n "$lien" ]; do
    [ -n "$lien" ] || continue
    actuelle=absent
    if [ -L "$R/$lien" ]; then actuelle=$(readlink "$R/$lien"); fi
    [ "$actuelle" = "$cible" ] || diag "[info] lien changé depuis la sauvegarde : /$lien"
  done <"$EXTRAIT/liens.txt"
fi
[ "$BLOQUANTS" -eq 0 ] || echec comparaison "$BLOQUANTS fichier(s) modifié(s) depuis une archive du jour : sauvegarde à refaire"

# --- 3. Installateur en vérification sur l'arbre restauré ---------------------------------------------------------
RC=0
SORTIE=$(bash "$SOURCE/ops/installer-serveur.sh" --verifier --etape "$ETAPES_INSTALLATEUR" --racine "$EXTRAIT" --source "$SOURCE" </dev/null 2>&1) || RC=$?
A_FAIRE=$(printf '%s\n' "$SORTIE" | grep -c '^\[a faire\]' || true)
if [ "$RC" -ne 0 ] || [ "$A_FAIRE" -gt 0 ]; then
  # Lignes de l'installateur : statut et chemin vu du serveur seulement, jamais un contenu.
  printf '%s\n' "$SORTIE" | grep -E '^\[(a faire|erreur)\]' >&2 || true
  echec installateur "installateur : code $RC, $A_FAIRE action(s) à faire sur l'arbre restauré"
fi

# --- 4. Caddy : validation jetable de la copie restaurée ----------------------------------------------------------
RC=0
SORTIE=$(RTP_CADDYFILE="$EXTRAIT/opt/vaultwarden/Caddyfile" RTP_SITES_D="$EXTRAIT/opt/vaultwarden/sites.d" \
  RTP_AJOUTER_IMPORT=0 RTP_AVEC_SANS_VARIABLES=1 RTP_BLOC_B64='' \
  bash "$SOURCE/ops/valider-caddy.sh" </dev/null 2>&1) || RC=$?
# Seulement le verdict de chaque passage : les messages de Caddy peuvent citer la configuration.
printf '%s\n' "$SORTIE" | grep -E '^validation ' >&2 || true
[ "$RC" -eq 0 ] || echec caddy "configuration Caddy restaurée invalide (code $RC)"

# --- 5. Ping du contrôle mensuel ----------------------------------------------------------------------------------
PING=absent
URL=''
ENV_RESTAURATION="$R/etc/rtp/restauration.env"
if [ -f "$ENV_RESTAURATION" ]; then
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    ligne=${ligne%$'\r'}
    case "$ligne" in
      HC_RESTAURATION=*)
        URL=${ligne#HC_RESTAURATION=}
        case "$URL" in \"*\") URL=${URL#\"}; URL=${URL%\"} ;; \'*\') URL=${URL#\'}; URL=${URL%\'} ;; esac
        ;;
    esac
  done <"$ENV_RESTAURATION"
fi
CODE=0
if [ -z "$URL" ]; then
  diag "[info] HC_RESTAURATION absent de /etc/rtp/restauration.env : aucun ping"
elif ! [[ $URL =~ $RE_URL_PING ]]; then
  PING=invalide
  CODE=1
  diag "HC_RESTAURATION : adresse https attendue (valeur non affichée)"
elif curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "restauration $NOM_ARCHIVE ok, $FICHIERS fichiers" "${URL%/}" 2>/dev/null; then
  PING=ok
else
  PING=echec
  CODE=1
  diag "ping restauration-mensuelle : échec de l'envoi (adresse non affichée)"
fi

printf '{"evenement":"restauration","resultat":"ok","date":"%s","archive":"%s","fichiers":%s,"hachages":"ok","modifies":%s,"installateur":"conforme","caddy":"valide","ping":"%s"}\n' \
  "$DATE_ARCHIVE" "$NOM_ARCHIVE" "$FICHIERS" "$MODIFIES" "$PING"
exit "$CODE"
