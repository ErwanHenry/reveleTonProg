#!/usr/bin/env bash
# Commande forcée de la clé de déploiement (Phase 8, D-09 ; HEB-02, HEB-10, HEB-11).
#
# Installée en /usr/local/sbin/rtp-deploy-command (root:root 0755) par le script d'installation du serveur, lancée
# par sshd pour l'utilisateur deploy (sans sudo) grâce à la ligne authorized_keys
#   restrict,command="/usr/local/sbin/rtp-deploy-command" ssh-ed25519 ... rtp-deploy-github
# Seule entrée : SSH_ORIGINAL_COMMAND (la commande demandée par le client). Elle n'est jamais passée à un shell :
# filtre de caractères, découpage en jetons, contrôle de chaque jeton, puis exécution d'une commande fixe.
#
# Verbes acceptés, tout le reste est refusé (code 64) :
#   rsync --server <options> . <cible>/<sha>/   envoi dans incoming/<cible>/<sha>/ par rrsync -wo -no-del -munge
#   activer <cible> <sha>                       vérifie l'envoi, le range dans releases/<sha>/, bascule current
#   retour <cible> [<sha>]                      rebascule current sur la version précédente (ou sur <sha>)
#   etat <cible>                                version courante, nombre de versions, espace libre
# <cible> : essai (racine $RTP_BASE/essai) ou production (racine $RTP_BASE).
# <sha> : 40 caractères hexadécimaux minuscules (commit complet).
#
# Disposition de chaque racine : releases/<sha>/, lien relatif current -> releases/<sha> (relatif pour qu'il se
# résolve aussi dans le montage du conteneur Caddy), .historique en ajout seul (lignes « <ISO 8601 UTC> <sha> »).
# Les envois arrivent dans $RTP_BASE/incoming/<cible>/<sha>/ : rsync n'écrit jamais dans l'arbre servi, seul
# activer y range une version vérifiée. Verrou $RTP_BASE/.verrou (flock -w 20) autour de activer et retour.
#
# Sortie : une ligne sur stdout, lue par les workflows.
#   active cible=<cible> courant=<sha> versions=<n>
#   retour cible=<cible> courant=<sha> precedent=<sha>
#   etat cible=<cible> courant=<sha|aucun> versions=<n> libre_mio=<n>
# Messages d'erreur en français sur stderr ; chaque appel écrit une ligne JSON par logger -t rtp-deploy.
#
# Variables (tests) : RTP_BASE (défaut /srv/reveletonprog), RTP_RRSYNC (défaut /usr/bin/rrsync). df, find, flock,
# jq, logger, mv sont pris dans PATH.
#
# Codes de sortie : 0 succès ; 64 refusé (caractères, verbe, jeton, nombre d'arguments) ; 65 envoi invalide
# (absent, index.html absent, version.json absent ou commit différent, ou contenant autre chose que des fichiers
# ordinaires et des dossiers : lien symbolique, tube, socket, périphérique, fichier à plusieurs liens physiques) ;
# 66 version introuvable ; 75 espace disque
# insuffisant (moins de 1024 Mio libres ou 92 % utilisés) ; 1 autre échec (verrou, bascule, df illisible).
set -euo pipefail
export LC_ALL=C
umask 022

BASE=${RTP_BASE:-/srv/reveletonprog}
RRSYNC=${RTP_RRSYNC:-/usr/bin/rrsync}
GARDER=5
MIN_LIBRE_MIO=1024
MAX_UTILISE_PCT=92

# Aucun ; & | $ ` ( ) < > guillemet, tabulation ni retour à la ligne.
RE_COMMANDE='^[A-Za-z0-9 ._/=,+-]+$'
RE_SHA='^[0-9a-f]{40}$'
RE_DEST='^(essai|production)/[0-9a-f]{40}/?$'
# Option rsync : sans barre oblique (aucun chemin glissé dans une option).
RE_OPTION='^--?[A-Za-z0-9][A-Za-z0-9._=,+-]*$'
RE_ENTIER='^[0-9]+$'

VERBE=refuse
CIBLE=""
SHA=""
RACINE=""

journal() { # verbe cible sha code ; les valeurs sont déjà contrôlées, aucun échappement JSON nécessaire
  logger -t rtp-deploy "{\"verbe\":\"$1\",\"cible\":\"$2\",\"sha\":\"$3\",\"code\":$4}" >/dev/null 2>&1 || true
}

refuser() {
  echo "refusé : $1" >&2
  journal refuse "" "" 64
  exit 64
}

echouer() { # code message
  echo "échec : $2" >&2
  journal "$VERBE" "$CIBLE" "$SHA" "$1"
  exit "$1"
}

choisir_racine() {
  case "$1" in
    essai) RACINE=$BASE/essai ;;
    production) RACINE=$BASE ;;
    *) refuser "cible inconnue (essai ou production)" ;;
  esac
  CIBLE=$1
}

verrouiller() {
  exec 9>>"$BASE/.verrou"
  flock -w 20 9 || echouer 1 "verrou occupé depuis 20 s"
}

nettoyer_incoming() { # envois de plus d'un jour, sauf celui qu'on active
  [ -d "$BASE/incoming" ] || return 0
  find "$BASE/incoming" -mindepth 2 -maxdepth 2 -mtime +0 ! -path "$BASE/incoming/$CIBLE/$SHA" \
    -exec rm -rf {} + 2>/dev/null || true
}

lire_espace() { # LIBRE (Mio) et PCT (% utilisé) du système de fichiers de BASE
  local ligne
  ligne=$(df -Pm "$BASE" | awk 'NR == 2 { print $4, $5 }')
  LIBRE=${ligne%% *}
  PCT=${ligne##* }
  PCT=${PCT%\%}
  if ! [[ $LIBRE =~ $RE_ENTIER && $PCT =~ $RE_ENTIER ]]; then
    echouer 1 "espace disque illisible"
  fi
}

garde_espace() {
  lire_espace
  if [ "$LIBRE" -lt "$MIN_LIBRE_MIO" ] || [ "$PCT" -ge "$MAX_UTILISE_PCT" ]; then
    echouer 75 "espace disque insuffisant (${LIBRE} Mio libres, ${PCT} % utilisés)"
  fi
}

courant() { # COURANT : sha pointé par current, ou « aucun »
  COURANT=aucun
  if [ -L "$RACINE/current" ]; then
    local cible_lien
    cible_lien=$(readlink "$RACINE/current")
    cible_lien=${cible_lien%/}
    cible_lien=${cible_lien##*/}
    if [[ $cible_lien =~ $RE_SHA ]]; then COURANT=$cible_lien; fi
  fi
}

compter_versions() {
  VERSIONS=0
  local d
  for d in "$RACINE"/releases/*; do
    [ -d "$d" ] && [ ! -L "$d" ] || continue
    [[ ${d##*/} =~ $RE_SHA ]] || continue
    VERSIONS=$((VERSIONS + 1))
  done
}

historique_inverse() { # sha distincts de l'historique, du plus récent au plus ancien
  [ -f "$RACINE/.historique" ] || return 0
  awk '$2 ~ /^[0-9a-f]+$/ && length($2) == 40 { l[++n] = $2 }
    END { for (i = n; i > 0; i--) if (!(l[i] in vu)) { vu[l[i]] = 1; print l[i] } }' "$RACINE/.historique"
}

trouver_precedent() { # PRECEDENT : dernier sha de l'historique, autre que le courant, dont le dossier existe
  PRECEDENT=""
  local s
  for s in $(historique_inverse); do
    [ "$s" != "$COURANT" ] || continue
    if [ -d "$RACINE/releases/$s" ]; then
      PRECEDENT=$s
      return 0
    fi
  done
}

basculer() { # sha : lien temporaire puis rename(2) ; mv -T échoue si current est un vrai dossier
  if ! (cd "$RACINE" && rm -f .current.tmp && ln -s "releases/$1" .current.tmp && mv -T .current.tmp current); then
    rm -f "$RACINE/.current.tmp"
    echouer 1 "bascule impossible (current n'est pas un lien ?)"
  fi
}

historiser() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >>"$RACINE/.historique"
}

tourner() { # garde les 5 plus récentes de l'historique, plus la courante et la précédente
  local garder=" $COURANT $PRECEDENT " n=0 s d nom
  for s in $(historique_inverse); do
    [ "$n" -lt "$GARDER" ] || break
    [ -d "$RACINE/releases/$s" ] || continue
    garder="$garder$s "
    n=$((n + 1))
  done
  for d in "$RACINE"/releases/*; do
    nom=${d##*/}
    [[ $nom =~ $RE_SHA ]] || continue
    case "$garder" in *" $nom "*) continue ;; esac
    rm -rf "$d"
  done
}

verbe_envoi() {
  local n=$1 dest i o
  [ "$n" -ge 4 ] || refuser "rsync : arguments manquants"
  [ "${t[1]}" = "--server" ] || refuser "rsync : --server attendu"
  dest=${t[$((n - 1))]}
  [[ $dest =~ $RE_DEST ]] || refuser "rsync : destination hors <cible>/<sha>/"
  [ "${t[$((n - 2))]}" = "." ] || refuser "rsync : source « . » attendue"
  i=2
  while [ "$i" -lt $((n - 2)) ]; do
    o=${t[$i]}
    [[ $o =~ $RE_OPTION ]] || refuser "rsync : option non autorisée"
    case "$o" in
      --server | --sender | --delete* | --remove* | --del) refuser "rsync : option non autorisée" ;;
    esac
    i=$((i + 1))
  done
  CIBLE=${dest%%/*}
  SHA=${dest#*/}
  SHA=${SHA%/}
  VERBE=envoi
  nettoyer_incoming
  garde_espace
  mkdir -p "$BASE/incoming/$CIBLE"
  journal envoi "$CIBLE" "$SHA" 0
  # rrsync relit SSH_ORIGINAL_COMMAND et enferme l'écriture dans incoming/ (écriture seule, sans suppression).
  # -munge (rrsync de rsync 3.2.x) fait ajouter --munge-links côté serveur : un lien symbolique reçu est préfixé
  # de /rsyncd-munged/ et ne pointe plus nulle part. Seconde barrière seulement : la garantie est le refus de tout
  # lien ou fichier spécial dans activer (CR-01), qui ne dépend pas du comportement de rrsync.
  exec "$RRSYNC" -wo -no-del -munge "$BASE/incoming"
}

verbe_activer() {
  local arrivee=$BASE/incoming/$CIBLE/$SHA version=$RACINE/releases/$SHA special
  mkdir -p "$RACINE/releases"
  courant
  if [ -d "$version" ]; then
    # Version déjà présente (même commit) : la copie reçue est écartée.
    rm -rf "$arrivee"
    if [ "$COURANT" != "$SHA" ]; then
      basculer "$SHA"
      historiser "$SHA"
    fi
  else
    if ! [ -d "$arrivee" ] || [ -L "$arrivee" ]; then echouer 65 "envoi absent : incoming/$CIBLE/$SHA"; fi
    # Que des fichiers ordinaires et des dossiers (CR-01) : Caddy suit les liens symboliques dans son propre
    # conteneur (certificats TLS de tous les sites, /proc), et un lien physique partagerait un inode avec un
    # fichier hors de l'envoi. Contrôlé avant tout déplacement, sur tout l'arbre.
    # Un parcours incomplet (find en échec) refuse aussi : jamais d'arbre non vérifié rangé dans releases/.
    special=$(find "$arrivee" \( ! -type f ! -type d \) -print -quit) || echouer 65 "envoi illisible"
    [ -z "$special" ] || echouer 65 "l'envoi contient un lien symbolique ou un fichier spécial (seuls fichiers et dossiers admis)"
    special=$(find "$arrivee" -type f -links +1 -print -quit) || echouer 65 "envoi illisible"
    [ -z "$special" ] || echouer 65 "l'envoi contient un fichier à plusieurs liens physiques"
    if ! [ -f "$arrivee/index.html" ] || [ -L "$arrivee/index.html" ]; then echouer 65 "index.html absent de l'envoi"; fi
    if ! [ -f "$arrivee/version.json" ] || [ -L "$arrivee/version.json" ]; then echouer 65 "version.json absent de l'envoi"; fi
    if ! jq -e --arg s "$SHA" '.commit == $s' "$arrivee/version.json" >/dev/null 2>&1; then
      echouer 65 "le commit de version.json ne correspond pas au sha demandé"
    fi
    mv -T "$arrivee" "$version"
    basculer "$SHA"
    historiser "$SHA"
  fi
  courant
  trouver_precedent
  tourner
  compter_versions
  journal activer "$CIBLE" "$SHA" 0
  echo "active cible=$CIBLE courant=$SHA versions=$VERSIONS"
}

verbe_retour() {
  local demande=$1 vise ancien
  courant
  if [ -n "$demande" ]; then
    [ -d "$RACINE/releases/$demande" ] || echouer 66 "version absente : releases/$demande"
    vise=$demande
  else
    trouver_precedent
    [ -n "$PRECEDENT" ] || echouer 66 "aucune version précédente disponible"
    vise=$PRECEDENT
  fi
  ancien=$COURANT
  if [ "$vise" != "$COURANT" ]; then
    basculer "$vise"
    historiser "$vise"
  fi
  SHA=$vise
  journal retour "$CIBLE" "$vise" 0
  echo "retour cible=$CIBLE courant=$vise precedent=$ancien"
}

verbe_etat() {
  courant
  compter_versions
  lire_espace
  journal etat "$CIBLE" "" 0
  echo "etat cible=$CIBLE courant=$COURANT versions=$VERSIONS libre_mio=$LIBRE"
}

commande=${SSH_ORIGINAL_COMMAND:-}
[[ $commande =~ $RE_COMMANDE ]] || refuser "caractères non autorisés ou commande vide"
t=()
read -r -a t <<<"$commande"
n=${#t[@]}
[ "$n" -gt 0 ] || refuser "commande vide"

case "${t[0]}" in
  rsync)
    verbe_envoi "$n"
    ;;
  activer)
    [ "$n" -eq 3 ] || refuser "usage : activer <cible> <sha>"
    choisir_racine "${t[1]}"
    [[ ${t[2]} =~ $RE_SHA ]] || refuser "sha invalide"
    SHA=${t[2]}
    VERBE=activer
    verrouiller
    nettoyer_incoming
    verbe_activer
    ;;
  retour)
    [ "$n" -eq 2 ] || [ "$n" -eq 3 ] || refuser "usage : retour <cible> [<sha>]"
    choisir_racine "${t[1]}"
    demande=""
    if [ "$n" -eq 3 ]; then
      [[ ${t[2]} =~ $RE_SHA ]] || refuser "sha invalide"
      demande=${t[2]}
    fi
    VERBE=retour
    verrouiller
    nettoyer_incoming
    verbe_retour "$demande"
    ;;
  etat)
    [ "$n" -eq 2 ] || refuser "usage : etat <cible>"
    choisir_racine "${t[1]}"
    VERBE=etat
    nettoyer_incoming
    verbe_etat
    ;;
  *)
    refuser "verbe inconnu"
    ;;
esac
