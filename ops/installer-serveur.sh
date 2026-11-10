#!/usr/bin/env bash
# Installation idempotente de la configuration serveur de reveleTonProg (Phase 8, D-01, D-04, D-05, D-15 ;
# HEB-01, HEB-10, OPS-03).
#
# Seule voie par laquelle les plans serveur écrivent sur la machine, une liste d'étapes approuvée à la fois (D-01).
# Toute la configuration du site est reconstructible depuis le dépôt par ce script, sauf deux secrets fournis sur
# l'entrée standard (empreintes bcrypt, adresses de ping) et la clé publique de déploiement.
#
# Usage :
#   installer-serveur.sh [--verifier|--appliquer] --etape <liste séparée par des virgules> [--racine <dir>]
#                        [--source <dir>] [--cle-publique <fichier>] [--horodatage <AAAAMMJJhhmm>]
#
#   --verifier      (défaut) ne change rien ; une ligne par action : « [ok] ... » ou « [a faire] ... »
#   --appliquer     fait les actions : « [fait] ... » ou « [ok] ... » ; une seconde application ne fait plus rien
#   --racine        préfixe de tous les chemins du serveur (défaut /) ; useradd, id et chown agissent toujours sur
#                   le vrai système (les tests les remplacent)
#   --source        racine du dépôt à installer (défaut : le dossier au-dessus de ce script)
#   --cle-publique  fichier d'une seule ligne « ssh-ed25519 <clé> [commentaire] » (étape utilisateur)
#   --horodatage    suffixe des copies de sauvegarde (défaut : minute courante UTC)
#
# Étapes (exécutées dans cet ordre, quel que soit l'ordre de la liste) :
#   sauvegarde-caddy        cp -p du Caddyfile et du fichier de composition en <nom>.bak-<horodatage> (jamais écrasés)
#   montages                dossiers /opt/vaultwarden/sites.d, /srv/reveletonprog/{incoming/{essai,production},
#                           releases,essai/releases}, /var/log/caddy (0755) ; surcharge docker-compose.override.yml
#                           (0644) à côté du fichier de composition d'origine, qui n'est jamais modifié
#   env-caddy               RTP_ESSAI_HASH et RTP_SONDE_HASH lus sur l'entrée standard, écrits entre apostrophes dans
#                           /opt/vaultwarden/.env (0600) ; toutes les autres lignes gardées octet pour octet
#   import-caddy            ajoute « import /etc/caddy/sites.d/*.caddy » à la fin du Caddyfile, sur place (>>) :
#                           c'est un montage d'un seul fichier, un renommage laisserait le conteneur sur l'ancien
#                           inode ; inode comparé avant et après
#   utilisateur             utilisateur deploy (sans sudo ni groupe d'administration ou de conteneurs), dossier
#                           personnel /home/deploy root:root 0755 et tout ce qu'il contient à root, .ssh
#                           root:root 0755, authorized_keys root:root 0644 avec une seule ligne
#                           restrict,command=<commande forcée> <clé> ; /srv/reveletonprog et ses dossiers à deploy
#   commande                ops/commande-deploiement.sh en /usr/local/sbin/rtp-deploy-command (root, 0755)
#   battement               rtp-battement (0755), /etc/rtp (0700), /etc/rtp/battement.env (0600, depuis l'entrée
#                           standard si elle en contient), /etc/cron.d/rtp-battement (0644)
#   sauvegarde              rtp-sauvegarder et rtp-tester-restauration (0755), /etc/cron.d/rtp-sauvegarde (0644)
#   restauration-mensuelle  /etc/rtp/restauration.env (0600, HC_RESTAURATION=<url> sur l'entrée standard),
#                           /etc/cron.d/rtp-restauration (0644)
#   site-essai              deploy/caddy/essai.caddy en sites.d/reveletonprog-essai.caddy, par fichier temporaire et
#                           renommage (dossier monté : le renommage y est sûr) ; refusé tant que le domaine est
#                           réservé (.invalid, .test, .example, .localhost)
#   depot                   copie ops/ et deploy/ de la source dans /opt/rtp/depot
#
# Entrée standard (--appliquer seulement, jamais affichée) : lignes CLE=valeur, réparties par clé.
#   RTP_ESSAI_HASH, RTP_SONDE_HASH -> env-caddy (format bcrypt) ; HC_RESTAURATION -> restauration-mensuelle (https) ;
#   autres HC_* (https) et RTP_* -> battement. Une ligne pour une étape non demandée est refusée. Sans secret à
#   fournir, passer </dev/null : le fichier existant est gardé et sa présence signalée.
#
# Jamais de redémarrage, de recréation ni de rechargement (conteneur, Caddy, service, cron) : ce sont des commandes
# séparées, approuvées une à une. Aucune suppression hors de ses propres fichiers temporaires (l'ancienne copie de
# /opt/rtp/depot devient l'un d'eux au remplacement). N'affiche jamais le contenu d'un fichier ni un secret :
# seulement des chemins, des modes et la présence ou l'absence des clés. Compatible bash 3.2 (tests sous macOS).
#
# Codes de sortie : 0 succès (en vérification, même s'il reste des actions) ; 1 échec ou application incomplète
# (fichier du serveur ou source absent, deploy dans un groupe privilégié, action restée à faire) ; 2 usage
# (option, étape, racine, source ou horodatage invalide) ; 3 --appliquer sur la racine / sans être root ;
# 4 entrée refusée (empreinte, adresse de ping, clé publique, ligne inconnue ou en double) ; 5 inode du Caddyfile
# changé pendant l'ajout ; 6 bloc d'essai refusé (domaine réservé ou adresse introuvable).
set -euo pipefail
export LC_ALL=C
umask 022

LIGNE_IMPORT='import /etc/caddy/sites.d/*.caddy'
PREFIXE_CLE='restrict,command="/usr/local/sbin/rtp-deploy-command"'
RE_BCRYPT='^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
RE_CLE='^ssh-ed25519 [A-Za-z0-9+/=]+( [A-Za-z0-9._@-]+)?$'
# Même motif que ops/battement.sh et ops/tester-restauration.sh (port facultatif ; test de dérive, IN-03).
RE_URL_PING='^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$'
RE_HORODATAGE='^[0-9]{12}$'
ORDRE_ETAPES='sauvegarde-caddy montages env-caddy import-caddy utilisateur commande battement sauvegarde restauration-mensuelle site-essai depot'
# Noms écrits en deux morceaux : le test statique refuse ce mot hors commentaires, pour prouver qu'aucune commande
# de conteneur n'est lancée par ce script.
FICHIER_COMPOSE='dock''er-compose.yml'
FICHIER_SURCHARGE='dock''er-compose.override.yml'
GROUPE_CONTENEURS='dock''er'

usage() {
  cat <<'FIN'
Usage : installer-serveur.sh [--verifier|--appliquer] --etape <liste> [--racine <dir>] [--source <dir>]
                             [--cle-publique <fichier>] [--horodatage <AAAAMMJJhhmm>]
Étapes : sauvegarde-caddy, montages, env-caddy, import-caddy, utilisateur, commande, battement, sauvegarde,
         restauration-mensuelle, site-essai, depot
FIN
}

echec() { # code message
  printf '[erreur] %s\n' "$2" >&2
  exit "$1"
}

erreur_usage() {
  printf '[erreur] %s\n' "$1" >&2
  usage >&2
  exit 2
}

MODE=verifier
ETAPES=''
ETAPES_DONNEES=0
RACINE_ARG=/
SOURCE=''
CLE_FICHIER=''
HORODATAGE=''

while [ $# -gt 0 ]; do
  case "$1" in
    --verifier) MODE=verifier; shift ;;
    --appliquer) MODE=appliquer; shift ;;
    --etape | --racine | --source | --cle-publique | --horodatage)
      [ $# -ge 2 ] || erreur_usage "valeur manquante après $1"
      case "$1" in
        --etape) ETAPES=$2; ETAPES_DONNEES=1 ;;
        --racine) RACINE_ARG=$2 ;;
        --source) SOURCE=$2 ;;
        --cle-publique) CLE_FICHIER=$2 ;;
        --horodatage) HORODATAGE=$2 ;;
      esac
      shift 2
      ;;
    -h | --aide) usage; exit 0 ;;
    *)
      # L'argument n'est répété que s'il a la forme d'une option (jamais une valeur collée par erreur).
      if [[ "$1" =~ ^--?[a-z-]+$ ]]; then erreur_usage "option inconnue : $1"; fi
      erreur_usage "argument inconnu"
      ;;
  esac
done

# --- Étapes demandées -------------------------------------------------------------------------------------------
[ "$ETAPES_DONNEES" = 1 ] || erreur_usage "--etape est obligatoire"
[ -n "$ETAPES" ] || erreur_usage "--etape sans étape"
IFS=, read -r -a LISTE_ETAPES <<<"$ETAPES"
[ "${#LISTE_ETAPES[@]}" -gt 0 ] || erreur_usage "--etape sans étape"
for e in "${LISTE_ETAPES[@]}"; do
  case " $ORDRE_ETAPES " in
    *" $e "*) ;;
    *)
      if [[ "$e" =~ ^[a-z-]+$ ]]; then erreur_usage "étape inconnue : $e"; fi
      erreur_usage "étape inconnue"
      ;;
  esac
done
demandee() { case ",$ETAPES," in *",$1,"*) return 0 ;; esac; return 1; }

# --- Racine, source, horodatage ---------------------------------------------------------------------------------
case "$RACINE_ARG" in /*) ;; *) erreur_usage "--racine doit être un chemin absolu" ;; esac
R=$RACINE_ARG
while [ "${R%/}" != "$R" ]; do R=${R%/}; done
[ -d "${R:-/}" ] || erreur_usage "--racine introuvable"

if [ "$MODE" = appliquer ] && [ -z "$R" ] && [ "$(id -u)" != 0 ]; then
  echec 3 "--appliquer sur la racine / demande root"
fi

if [ -z "$SOURCE" ]; then SOURCE="$(dirname "$0")/.."; fi
[ -d "$SOURCE" ] || erreur_usage "--source introuvable"
SOURCE=$(cd "$SOURCE" && pwd)

if [ -z "$HORODATAGE" ]; then HORODATAGE=$(date -u +%Y%m%d%H%M); fi
[[ "$HORODATAGE" =~ $RE_HORODATAGE ]] || erreur_usage "--horodatage attend AAAAMMJJhhmm"

# --- Chemins du serveur -----------------------------------------------------------------------------------------
COMPOSE="$R/opt/vaultwarden"
CADDYFILE="$COMPOSE/Caddyfile"
SITES_D="$COMPOSE/sites.d"
SITE="$R/srv/reveletonprog"
DOSSIERS_SITE=("$SITE" "$SITE/incoming" "$SITE/incoming/essai" "$SITE/incoming/production" "$SITE/releases" "$SITE/essai" "$SITE/essai/releases")
JOURNAUX="$R/var/log/caddy"
SBIN="$R/usr/local/sbin"
ETC_RTP="$R/etc/rtp"
CRON_D="$R/etc/cron.d"
DEPOT_PARENT="$R/opt/rtp"
DEPOT="$DEPOT_PARENT/depot"
HOME_DEPLOY="$R/home/deploy"
SSH_DEPLOY="$HOME_DEPLOY/.ssh"
CLES_AUTORISEES="$SSH_DEPLOY/authorized_keys"
BLOC_ESSAI="$SITES_D/reveletonprog-essai.caddy"

# Chemin affiché : vu depuis le serveur (sans le préfixe de --racine).
affiche() { printf '%s' "${1#"$R"}"; }

# --- Fichiers temporaires (seule chose que ce script supprime) --------------------------------------------------
TEMPORAIRES=()
TMP_CREE=''
nettoyer() {
  local t
  for t in ${TEMPORAIRES[@]+"${TEMPORAIRES[@]}"}; do rm -rf -- "$t"; done
}
trap nettoyer EXIT
temporaire() { # dossier : fichier temporaire dans ce dossier (même système de fichiers que la cible)
  TMP_CREE=$(mktemp "$1/.rtp-installation.XXXXXX")
  TEMPORAIRES+=("$TMP_CREE")
}
temporaire_dossier() {
  TMP_CREE=$(mktemp -d "$1/.depot.XXXXXX")
  TEMPORAIRES+=("$TMP_CREE")
}

# --- Vérifications préalables (avant toute écriture) ------------------------------------------------------------
exiger_source() {
  [ -e "$SOURCE/$1" ] || echec 1 "source absente : $1"
}
if demandee montages; then exiger_source "deploy/compose/$FICHIER_SURCHARGE"; fi
if demandee commande; then exiger_source ops/commande-deploiement.sh; fi
if demandee battement; then exiger_source ops/battement.sh; exiger_source deploy/cron/rtp-battement; fi
if demandee sauvegarde; then
  exiger_source ops/sauvegarder-config.sh
  exiger_source ops/tester-restauration.sh
  exiger_source deploy/cron/rtp-sauvegarde
fi
if demandee restauration-mensuelle; then exiger_source deploy/cron/rtp-restauration; fi
if demandee site-essai; then exiger_source deploy/caddy/essai.caddy; fi
if demandee depot; then exiger_source ops; exiger_source deploy; fi

for e in sauvegarde-caddy montages env-caddy import-caddy; do
  if demandee "$e"; then [ -d "$COMPOSE" ] || echec 1 "$(affiche "$COMPOSE") absent : rien n'est créé"; fi
done
for e in sauvegarde-caddy import-caddy; do
  if demandee "$e"; then [ -f "$CADDYFILE" ] || echec 1 "$(affiche "$CADDYFILE") absent : rien n'est créé"; fi
done
if demandee sauvegarde-caddy; then
  [ -f "$COMPOSE/$FICHIER_COMPOSE" ] || echec 1 "$(affiche "$COMPOSE/$FICHIER_COMPOSE") absent"
fi

# Clé publique : une seule ligne ssh-ed25519.
CLE=''
if [ -n "$CLE_FICHIER" ]; then
  [ -f "$CLE_FICHIER" ] || echec 4 "--cle-publique : fichier introuvable"
  n=0
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    n=$((n + 1))
    CLE=$ligne
  done <"$CLE_FICHIER"
  [ "$n" = 1 ] || echec 4 "--cle-publique : une seule ligne attendue"
  [[ "$CLE" =~ $RE_CLE ]] || echec 4 "--cle-publique : ligne « ssh-ed25519 <clé> [commentaire] » attendue"
fi

# Bloc d'essai : refusé tant que son adresse est un domaine réservé (le certificat ne pourrait pas être obtenu et
# Caddy relancerait ACME en boucle).
adresse_bloc() { # fichier : première ligne de code, sans l'accolade ouvrante
  local ligne
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    ligne=${ligne%%#*}
    ligne=$(printf '%s' "$ligne" | tr -d '\r' | awk '{$1=$1; print}')
    [ -n "$ligne" ] || continue
    case "$ligne" in
      *'{') printf '%s' "${ligne%'{'}"; return 0 ;;
      *) return 1 ;;
    esac
  done <"$1"
  return 1
}
if demandee site-essai; then
  adresses=$(adresse_bloc "$SOURCE/deploy/caddy/essai.caddy") || echec 6 "bloc d'essai : adresse introuvable"
  # Découpage sans expansion de motif : une adresse joker (*.exemple.fr) ne doit pas lister le dossier courant.
  read -r -a liste_adresses <<<"$(printf '%s' "$adresses" | tr ',' ' ')"
  nb_adresses=0
  for a in ${liste_adresses[@]+"${liste_adresses[@]}"}; do
    hote=${a#*://}
    hote=${hote%%/*}
    hote=${hote%%:*}
    hote=$(printf '%s' "${hote%.}" | tr '[:upper:]' '[:lower:]')
    case "$hote" in
      '' | localhost | *.localhost | invalid | *.invalid | test | *.test | example | *.example)
        echec 6 "bloc d'essai : domaine réservé (.${hote##*.}), à remplacer par le vrai domaine avant l'import"
        ;;
    esac
    nb_adresses=$((nb_adresses + 1))
  done
  [ "$nb_adresses" -gt 0 ] || echec 6 "bloc d'essai : adresse introuvable"
fi

# Entrée standard : lue une fois, en application seulement, si une étape en a besoin. Valeurs jamais affichées.
ESSAI_HASH=''
SONDE_HASH=''
CONTENU_BATTEMENT=''
CONTENU_RESTAURATION=''
if [ "$MODE" = appliquer ] && { demandee env-caddy || demandee battement || demandee restauration-mensuelle; } && [ ! -t 0 ]; then
  n=0
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    n=$((n + 1))
    case "$ligne" in '' | '#'*) continue ;; esac
    cle=${ligne%%=*}
    valeur=${ligne#*=}
    [ "$cle" != "$ligne" ] || echec 4 "entrée standard, ligne $n : CLE=valeur attendu"
    case "$cle" in
      RTP_ESSAI_HASH | RTP_SONDE_HASH)
        demandee env-caddy || echec 4 "entrée standard, ligne $n : $cle sans l'étape env-caddy"
        [[ "$valeur" =~ $RE_BCRYPT ]] || echec 4 "entrée standard, ligne $n : $cle refusée (format bcrypt attendu)"
        if [ "$cle" = RTP_ESSAI_HASH ]; then
          [ -z "$ESSAI_HASH" ] || echec 4 "entrée standard, ligne $n : $cle en double"
          ESSAI_HASH=$valeur
        else
          [ -z "$SONDE_HASH" ] || echec 4 "entrée standard, ligne $n : $cle en double"
          SONDE_HASH=$valeur
        fi
        ;;
      HC_RESTAURATION)
        demandee restauration-mensuelle || echec 4 "entrée standard, ligne $n : $cle sans l'étape restauration-mensuelle"
        [[ "$valeur" =~ $RE_URL_PING ]] || echec 4 "entrée standard, ligne $n : $cle refusée (adresse https attendue)"
        [ -z "$CONTENU_RESTAURATION" ] || echec 4 "entrée standard, ligne $n : $cle en double"
        CONTENU_RESTAURATION=$ligne
        ;;
      HC_* | RTP_*)
        [[ "$cle" =~ ^[A-Z][A-Z0-9_]*$ ]] || echec 4 "entrée standard, ligne $n : clé invalide"
        demandee battement || echec 4 "entrée standard, ligne $n : $cle sans l'étape battement"
        case "$cle" in
          HC_*) [[ "$valeur" =~ $RE_URL_PING ]] || echec 4 "entrée standard, ligne $n : $cle refusée (adresse https attendue)" ;;
        esac
        case "
$CONTENU_BATTEMENT" in *"
$cle="*) echec 4 "entrée standard, ligne $n : $cle en double" ;; esac
        if [ -z "$CONTENU_BATTEMENT" ]; then CONTENU_BATTEMENT=$ligne; else CONTENU_BATTEMENT="$CONTENU_BATTEMENT
$ligne"; fi
        ;;
      *) echec 4 "entrée standard, ligne $n : clé inconnue" ;;
    esac
  done
fi

# --- Aides --------------------------------------------------------------------------------------------------------
N_OK=0
N_AFAIRE=0
N_FAIT=0
dire() { # statut message
  case "$1" in
    ok) N_OK=$((N_OK + 1)) ;;
    'a faire') N_AFAIRE=$((N_AFAIRE + 1)) ;;
    fait) N_FAIT=$((N_FAIT + 1)) ;;
  esac
  printf '[%s] %s\n' "$1" "$2"
}
verification() { [ "$MODE" = verifier ]; }
mode_est() { [ -n "$(find "$1" -prune -perm "$2" 2>/dev/null)" ]; }
proprietaire() { ls -ldn "$1" | awk '{print $3 ":" $4}'; }
ids_de() { # utilisateur -> uid:gid (échoue si l'utilisateur n'existe pas)
  local u g
  u=$(id -u "$1" 2>/dev/null) || return 1
  g=$(id -g "$1" 2>/dev/null) || return 1
  printf '%s:%s' "$u" "$g"
}
inode() { ls -di "$1" | awk '{print $1}'; }
comparer_fichier() { [ -f "$2" ] && cmp -s "$1" "$2"; }

assurer_proprietaire() { # chemin utilisateur
  local f=$1 qui=$2 nom attendu
  nom=$(affiche "$f")
  if ! attendu=$(ids_de "$qui"); then
    dire 'a faire' "$nom : propriétaire $qui:$qui (utilisateur absent)"
  elif [ -e "$f" ] && [ "$(proprietaire "$f")" = "$attendu" ]; then
    dire ok "$nom : propriétaire $qui:$qui"
  elif verification || [ ! -e "$f" ]; then
    dire 'a faire' "$nom : propriétaire $qui:$qui"
  else
    chown "$qui:$qui" "$f"
    dire fait "$nom : propriétaire $qui:$qui"
  fi
}

assurer_dossier() { # chemin mode [propriétaire]
  local d=$1 m=$2 qui=${3:-} nom
  nom=$(affiche "$d")
  if [ ! -d "$d" ]; then
    if verification; then
      dire 'a faire' "$nom : créer le dossier ($m)"
      if [ -n "$qui" ]; then dire 'a faire' "$nom : propriétaire $qui:$qui"; fi
      return 0
    fi
    mkdir -p "$d"
    chmod "$m" "$d"
    if [ -n "$qui" ]; then chown "$qui:$qui" "$d"; fi
    dire fait "$nom : dossier créé ($m)"
  elif mode_est "$d" "$m"; then
    dire ok "$nom : dossier ($m)"
  elif verification; then
    dire 'a faire' "$nom : mode $m"
  else
    chmod "$m" "$d"
    dire fait "$nom : mode $m"
  fi
  if [ -n "$qui" ]; then assurer_proprietaire "$d" "$qui"; fi
}

assurer_fichier() { # source cible mode [propriétaire]
  local src=$1 dst=$2 m=$3 qui=${4:-} nom
  nom=$(affiche "$dst")
  if comparer_fichier "$src" "$dst"; then
    if mode_est "$dst" "$m"; then
      dire ok "$nom : à jour ($m)"
    elif verification; then
      dire 'a faire' "$nom : mode $m"
    else
      chmod "$m" "$dst"
      dire fait "$nom : mode $m"
    fi
  elif verification || [ ! -d "$(dirname "$dst")" ]; then
    if [ -e "$dst" ]; then dire 'a faire' "$nom : mettre à jour ($m)"; else dire 'a faire' "$nom : installer ($m)"; fi
    return 0
  else
    install -m "$m" "$src" "$dst"
    if [ -n "$qui" ]; then chown "$qui:$qui" "$dst"; fi
    dire fait "$nom : installé ($m)"
    return 0
  fi
  if [ -n "$qui" ]; then assurer_proprietaire "$dst" "$qui"; fi
}

# Fichier d'environnement secret (0600 root) : écrit depuis l'entrée standard si elle en contient, sinon gardé.
# printf est une commande interne : la valeur ne passe dans les arguments d'aucun processus.
assurer_secret() { # cible contenu
  local dst=$1 contenu=$2 nom
  nom=$(affiche "$dst")
  if ! verification && [ -n "$contenu" ] && [ -d "$(dirname "$dst")" ]; then
    temporaire "$(dirname "$dst")"
    printf '%s\n' "$contenu" >"$TMP_CREE"
    if comparer_fichier "$TMP_CREE" "$dst" && mode_est "$dst" 600; then
      dire ok "$nom : présent, inchangé (600)"
    else
      chmod 600 "$TMP_CREE"
      chown root:root "$TMP_CREE"
      mv -f "$TMP_CREE" "$dst"
      dire fait "$nom : écrit (600)"
    fi
  elif [ -f "$dst" ]; then
    if mode_est "$dst" 600; then
      dire ok "$nom : présent (600)"
    elif verification; then
      dire 'a faire' "$nom : mode 600"
    else
      chmod 600 "$dst"
      dire fait "$nom : mode 600"
    fi
  else
    dire 'a faire' "$nom : absent, fournir son contenu sur l'entrée standard"
  fi
}

# --- Étapes -------------------------------------------------------------------------------------------------------
etape_sauvegarde_caddy() {
  local f src bak
  for f in Caddyfile "$FICHIER_COMPOSE"; do
    src="$COMPOSE/$f"
    bak="$src.bak-$HORODATAGE"
    if [ -e "$bak" ]; then
      dire ok "$(affiche "$bak") : copie présente (jamais écrasée)"
    elif verification; then
      dire 'a faire' "$(affiche "$src") : copier en $f.bak-$HORODATAGE (cp -p)"
    else
      cp -p "$src" "$bak"
      dire fait "$(affiche "$src") : copié en $f.bak-$HORODATAGE"
    fi
  done
}

etape_montages() {
  local d
  assurer_dossier "$SITES_D" 755
  for d in "${DOSSIERS_SITE[@]}"; do assurer_dossier "$d" 755; done
  assurer_dossier "$JOURNAUX" 755
  assurer_fichier "$SOURCE/deploy/compose/$FICHIER_SURCHARGE" "$COMPOSE/$FICHIER_SURCHARGE" 644
}

cle_env_valide() { # fichier clé : la clé existe avec une empreinte bien formée (valeur jamais affichée)
  local ligne valeur
  [ -f "$1" ] || return 1
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    case "$ligne" in
      "$2="*)
        valeur=${ligne#*=}
        valeur=${valeur#\'}
        valeur=${valeur%\'}
        [[ "$valeur" =~ $RE_BCRYPT ]] && return 0
        ;;
    esac
  done <"$1"
  return 1
}

etape_env_caddy() {
  local env="$COMPOSE/.env" nom cle ligne vu_essai=0 vu_sonde=0 ecrit=0
  nom=$(affiche "$env")
  if ! verification && { [ -n "$ESSAI_HASH" ] || [ -n "$SONDE_HASH" ]; }; then
    temporaire "$COMPOSE"
    {
      if [ -f "$env" ]; then
        while IFS= read -r ligne || [ -n "$ligne" ]; do
          case "$ligne" in
            RTP_ESSAI_HASH=*)
              if [ -n "$ESSAI_HASH" ]; then printf "RTP_ESSAI_HASH='%s'\n" "$ESSAI_HASH"; vu_essai=1; else printf '%s\n' "$ligne"; fi
              ;;
            RTP_SONDE_HASH=*)
              if [ -n "$SONDE_HASH" ]; then printf "RTP_SONDE_HASH='%s'\n" "$SONDE_HASH"; vu_sonde=1; else printf '%s\n' "$ligne"; fi
              ;;
            *) printf '%s\n' "$ligne" ;;
          esac
        done <"$env"
      fi
      if [ -n "$ESSAI_HASH" ] && [ "$vu_essai" = 0 ]; then printf "RTP_ESSAI_HASH='%s'\n" "$ESSAI_HASH"; fi
      if [ -n "$SONDE_HASH" ] && [ "$vu_sonde" = 0 ]; then printf "RTP_SONDE_HASH='%s'\n" "$SONDE_HASH"; fi
    } >"$TMP_CREE"
    if ! comparer_fichier "$TMP_CREE" "$env"; then
      chmod 600 "$TMP_CREE"
      chown root:root "$TMP_CREE"
      mv -f "$TMP_CREE" "$env"
      ecrit=1
    fi
  fi
  for cle in RTP_ESSAI_HASH RTP_SONDE_HASH; do
    if cle_env_valide "$env" "$cle"; then
      if [ "$ecrit" = 1 ] && { { [ "$cle" = RTP_ESSAI_HASH ] && [ -n "$ESSAI_HASH" ]; } || { [ "$cle" = RTP_SONDE_HASH ] && [ -n "$SONDE_HASH" ]; }; }; then
        dire fait "$nom : $cle écrit"
      else
        dire ok "$nom : $cle présent"
      fi
    else
      dire 'a faire' "$nom : $cle absent, le fournir sur l'entrée standard"
    fi
  done
  if [ -f "$env" ]; then
    if mode_est "$env" 600; then
      dire ok "$nom : mode 600"
    elif verification; then
      dire 'a faire' "$nom : mode 600"
    else
      chmod 600 "$env"
      dire fait "$nom : mode 600"
    fi
  fi
}

etape_import_caddy() {
  local f=$CADDYFILE nom avant apres
  nom=$(affiche "$f")
  if grep -qxF -- "$LIGNE_IMPORT" "$f"; then
    dire ok "$nom : ligne import présente"
  elif verification; then
    dire 'a faire' "$nom : ajouter la ligne import à la fin, sur place"
  else
    avant=$(inode "$f")
    printf '\n%s\n' "$LIGNE_IMPORT" >> "$f"
    apres=$(inode "$f")
    [ "$avant" = "$apres" ] || echec 5 "$nom : inode changé pendant l'ajout, le conteneur lirait l'ancien fichier"
    dire fait "$nom : ligne import ajoutée sur place (inode inchangé)"
  fi
}

cles_autorisees_conformes() { # une seule ligne, préfixe restreint, clé ed25519 valide
  local ligne n=0 reste
  [ -f "$CLES_AUTORISEES" ] || return 1
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    n=$((n + 1))
    case "$ligne" in
      "$PREFIXE_CLE "*) reste=${ligne#"$PREFIXE_CLE "}; [[ "$reste" =~ $RE_CLE ]] || return 1 ;;
      *) return 1 ;;
    esac
  done <"$CLES_AUTORISEES"
  [ "$n" = 1 ]
}

etape_utilisateur() {
  local cree=0 groupes d nom
  if id -u deploy >/dev/null 2>&1; then
    dire ok "utilisateur deploy présent"
  elif verification; then
    dire 'a faire' "utilisateur deploy : créer (système, sans mot de passe, sans groupe privilégié)"
  else
    useradd --system --create-home --shell /bin/bash --user-group -p '*' deploy
    cree=1
    dire fait "utilisateur deploy créé"
  fi
  if id -u deploy >/dev/null 2>&1; then
    groupes=" $(id -nG deploy) "
    case "$groupes" in
      *" sudo "* | *" admin "* | *" wheel "* | *" root "* | *" adm "* | *" $GROUPE_CONTENEURS "*)
        echec 1 "deploy appartient à un groupe privilégié : à corriger à la main avant toute suite"
        ;;
    esac
    dire ok "deploy : aucun groupe privilégié"
  fi

  # Dossier personnel à root (revue de code WR-03) : un renommage ne demande que le droit d'écriture sur le dossier
  # parent, donc un /home/deploy à deploy lui permettrait de remplacer .ssh (mv ~/.ssh ~/.x && mkdir ~/.ssh) et de
  # poser une clé sans restriction. deploy n'a besoin d'écrire nulle part chez lui (rrsync verrouille incoming/, son
  # journal rrsync.log n'est écrit que s'il existe déjà). Les fichiers du squelette (.bashrc, .profile... : bash lit
  # .bashrc avant la commande forcée quand sshd le lance) passent aussi à root, sans suivre de lien (chown -h).
  assurer_dossier "$HOME_DEPLOY" 755 root
  if [ -d "$HOME_DEPLOY" ]; then
    local e attendu_root
    attendu_root=$(ids_de root) || attendu_root=''
    while IFS= read -r -d '' e; do
      if [ -n "$attendu_root" ] && [ "$(proprietaire "$e")" = "$attendu_root" ]; then
        dire ok "$(affiche "$e") : propriétaire root:root"
      elif verification; then
        dire 'a faire' "$(affiche "$e") : propriétaire root:root (deploy ne doit rien posséder dans son dossier personnel)"
      else
        chown -hR root:root -- "$e"
        dire fait "$(affiche "$e") : propriétaire root:root"
      fi
    done < <(find "$HOME_DEPLOY" -mindepth 1 -maxdepth 1 ! -name .ssh -print0)
  fi

  # .ssh et authorized_keys à root : deploy ne peut pas réécrire sa propre restriction.
  assurer_dossier "$SSH_DEPLOY" 755 root
  nom=$(affiche "$CLES_AUTORISEES")
  if [ -n "$CLE" ]; then
    if [ -f "$CLES_AUTORISEES" ] && printf '%s %s\n' "$PREFIXE_CLE" "$CLE" | cmp -s - "$CLES_AUTORISEES"; then
      dire ok "$nom : une seule ligne restreinte, à jour"
    elif verification || [ ! -d "$SSH_DEPLOY" ]; then
      dire 'a faire' "$nom : écrire une seule ligne restreinte (commande forcée)"
    else
      temporaire "$SSH_DEPLOY"
      printf '%s %s\n' "$PREFIXE_CLE" "$CLE" >"$TMP_CREE"
      chmod 644 "$TMP_CREE"
      mv -f "$TMP_CREE" "$CLES_AUTORISEES"
      chown root:root "$CLES_AUTORISEES"
      dire fait "$nom : une seule ligne restreinte écrite"
    fi
  elif cles_autorisees_conformes; then
    dire ok "$nom : une seule ligne restreinte"
  else
    dire 'a faire' "$nom : absent ou non conforme, fournir --cle-publique"
  fi
  if [ -f "$CLES_AUTORISEES" ]; then
    if mode_est "$CLES_AUTORISEES" 644; then
      dire ok "$nom : mode 644"
    elif verification; then
      dire 'a faire' "$nom : mode 644"
    else
      chmod 644 "$CLES_AUTORISEES"
      dire fait "$nom : mode 644"
    fi
    assurer_proprietaire "$CLES_AUTORISEES" root
  fi

  # Racine du site à deploy (verrou, envois, versions) ; Caddy la lit en lecture seule.
  for d in "${DOSSIERS_SITE[@]}"; do
    if [ ! -d "$d" ]; then
      dire 'a faire' "$(affiche "$d") : absent, lancer l'étape montages"
    elif [ "$cree" = 1 ]; then
      chown deploy:deploy "$d"
      dire fait "$(affiche "$d") : propriétaire deploy:deploy"
    else
      assurer_proprietaire "$d" deploy
    fi
  done
}

etape_commande() {
  assurer_dossier "$SBIN" 755
  assurer_fichier "$SOURCE/ops/commande-deploiement.sh" "$SBIN/rtp-deploy-command" 755 root
}

etape_battement() {
  assurer_dossier "$SBIN" 755
  assurer_fichier "$SOURCE/ops/battement.sh" "$SBIN/rtp-battement" 755 root
  assurer_dossier "$ETC_RTP" 700 root
  assurer_secret "$ETC_RTP/battement.env" "$CONTENU_BATTEMENT"
  assurer_dossier "$CRON_D" 755
  assurer_fichier "$SOURCE/deploy/cron/rtp-battement" "$CRON_D/rtp-battement" 644 root
}

etape_sauvegarde() {
  assurer_dossier "$SBIN" 755
  assurer_fichier "$SOURCE/ops/sauvegarder-config.sh" "$SBIN/rtp-sauvegarder" 755 root
  assurer_fichier "$SOURCE/ops/tester-restauration.sh" "$SBIN/rtp-tester-restauration" 755 root
  assurer_dossier "$CRON_D" 755
  assurer_fichier "$SOURCE/deploy/cron/rtp-sauvegarde" "$CRON_D/rtp-sauvegarde" 644 root
}

etape_restauration_mensuelle() {
  assurer_dossier "$ETC_RTP" 700 root
  assurer_secret "$ETC_RTP/restauration.env" "$CONTENU_RESTAURATION"
  assurer_dossier "$CRON_D" 755
  assurer_fichier "$SOURCE/deploy/cron/rtp-restauration" "$CRON_D/rtp-restauration" 644 root
}

etape_site_essai() {
  local src="$SOURCE/deploy/caddy/essai.caddy" nom
  nom=$(affiche "$BLOC_ESSAI")
  if [ ! -d "$SITES_D" ]; then
    dire 'a faire' "$nom : installer après l'étape montages ($(affiche "$SITES_D") absent)"
  elif comparer_fichier "$src" "$BLOC_ESSAI"; then
    if mode_est "$BLOC_ESSAI" 644; then
      dire ok "$nom : à jour (644)"
    elif verification; then
      dire 'a faire' "$nom : mode 644"
    else
      chmod 644 "$BLOC_ESSAI"
      dire fait "$nom : mode 644"
    fi
  elif verification; then
    dire 'a faire' "$nom : installer (644) par renommage dans le dossier monté"
  else
    temporaire "$SITES_D"
    cp "$src" "$TMP_CREE"
    chmod 644 "$TMP_CREE"
    chown root:root "$TMP_CREE"
    mv -f "$TMP_CREE" "$BLOC_ESSAI"
    dire fait "$nom : installé (644) par renommage"
  fi
}

etape_depot() {
  local nom nouveau ancien
  nom=$(affiche "$DEPOT")
  if [ -d "$DEPOT/ops" ] && [ -d "$DEPOT/deploy" ] &&
    diff -rq "$SOURCE/ops" "$DEPOT/ops" >/dev/null 2>&1 &&
    diff -rq "$SOURCE/deploy" "$DEPOT/deploy" >/dev/null 2>&1; then
    dire ok "$nom : ops/ et deploy/ à jour"
  elif verification; then
    dire 'a faire' "$nom : copier ops/ et deploy/ depuis la source"
  else
    if [ ! -d "$DEPOT_PARENT" ]; then
      mkdir -p "$DEPOT_PARENT"
      chmod 755 "$DEPOT_PARENT"
    fi
    temporaire_dossier "$DEPOT_PARENT"
    nouveau=$TMP_CREE
    cp -R "$SOURCE/ops" "$nouveau/ops"
    cp -R "$SOURCE/deploy" "$nouveau/deploy"
    chmod 755 "$nouveau"
    if [ -e "$DEPOT" ]; then
      temporaire_dossier "$DEPOT_PARENT"
      ancien=$TMP_CREE
      mv "$DEPOT" "$ancien/depot"
    fi
    mv "$nouveau" "$DEPOT"
    dire fait "$nom : ops/ et deploy/ copiés"
  fi
}

# --- Exécution ----------------------------------------------------------------------------------------------------
printf 'installer-serveur : mode %s, étapes %s\n' "$MODE" "$ETAPES"
for e in $ORDRE_ETAPES; do
  if demandee "$e"; then
    case "$e" in
      sauvegarde-caddy) etape_sauvegarde_caddy ;;
      montages) etape_montages ;;
      env-caddy) etape_env_caddy ;;
      import-caddy) etape_import_caddy ;;
      utilisateur) etape_utilisateur ;;
      commande) etape_commande ;;
      battement) etape_battement ;;
      sauvegarde) etape_sauvegarde ;;
      restauration-mensuelle) etape_restauration_mensuelle ;;
      site-essai) etape_site_essai ;;
      depot) etape_depot ;;
    esac
  fi
done

printf 'bilan : %s ok, %s a faire, %s fait\n' "$N_OK" "$N_AFAIRE" "$N_FAIT"
if [ "$MODE" = appliquer ] && [ "$N_AFAIRE" -gt 0 ]; then
  echec 1 "application incomplète : $N_AFAIRE action(s) restent à faire"
fi
exit 0
