#!/usr/bin/env bash
# Battement de cœur du serveur de reveleTonProg (Phase 8, D-14 ; OPS-01, OPS-02).
#
# Installé en /usr/local/sbin/rtp-battement (root, 0755) par ops/installer-serveur.sh, étape battement, et lancé
# toutes les 5 minutes par /etc/cron.d/rtp-battement (root, UTC). Healthchecks.io ne sonde rien : il reçoit des
# pings et alerte (Telegram) quand un contrôle reçoit /fail ou ne reçoit plus rien. Ce script nourrit quatre
# contrôles (noms créés par 08-11) :
#   vps-battement   ping de succès seulement si la machine tourne, si le conteneur Caddy est en marche et si le
#                   contenu du site répond ; sinon rien : le contrôle passe en retard (période 5 min, grâce
#                   10 min) et l'alerte part. Couvre machine tombée, conteneur arrêté, cron mort, contenu cassé.
#   vps-disque-85   /fail quand le disque le plus plein de RTP_DISQUES atteint RTP_SEUIL1 %, sinon succès
#   vps-disque-92   /fail à RTP_SEUIL2 %, sinon succès (seconde alerte, plus forte)
#   vps-certificat  /fail quand le certificat servi expire dans moins de RTP_CERT_JOURS jours, sinon succès ;
#                   aucun ping tant que RTP_HOTE n'est pas posé (avant DNS)
# Le message de rétablissement vient du ping de succès suivant : rien de spécial à faire au retour à la normale.
# Healthchecks.io accepte au plus 5 pings par minute et par contrôle : un passage envoie un ping par contrôle.
#
# Contenu vérifié :
#   sans RTP_HOTE (avant DNS)  la version d'essai déployée sur le disque : $RTP_BASE/essai/current/version.json
#                              doit porter un commit de 40 caractères hexadécimaux
#   avec RTP_HOTE              le site à travers Caddy en HTTPS (curl --resolve <hôte>:443:127.0.0.1) :
#                              /version.json avec un commit valide et / avec le marqueur « reveleTonProg » ;
#                              identifiants de la sonde passés par « curl --config - », jamais en argument ;
#                              certificat lu par openssl s_client sur 127.0.0.1:443 avec SNI
# Tous les contrôles sont faits d'abord, les pings partent à la fin, dans un ordre fixe (battement, disque 85,
# disque 92, certificat). Un ping en échec est signalé sans son adresse et n'empêche pas les suivants.
#
# Usage :
#   rtp-battement
#   RTP_SEUIL1=1 rtp-battement            alerte disque 85 simulée, sans remplir le disque
#   RTP_CERT_JOURS=9999 rtp-battement     alerte certificat simulée, sans toucher au certificat
#   RTP_HC_SIMULATION=1 rtp-battement     affiche le signal prévu pour chaque contrôle, n'envoie aucun ping
#
# Fichier d'environnement (RTP_ENV, défaut /etc/rtp/battement.env ; fichier ordinaire, root, 0600, écrit par
# l'installateur depuis son entrée standard) : lignes CLE=valeur, lues une à une, jamais exécutées ni affichées.
#   HC_BATTEMENT, HC_DISQUE85, HC_DISQUE92, HC_CERT   adresses de ping https (obligatoires)
#   RTP_HOTE                     hôte d'essai (facultatif ; active la vérification HTTPS et le certificat)
#   RTP_SONDE_USER, RTP_SONDE_PASS  identifiant de la sonde pour l'hôte d'essai (facultatifs, ensemble)
#   RTP_DISQUES                  points de montage séparés par des espaces (défaut « / »)
# Les autres clés sont ignorées.
#
# Variables d'environnement (surcharges) :
#   RTP_ENV          chemin du fichier ci-dessus
#   RTP_BASE         racine du site (défaut /srv/reveletonprog)
#   RTP_CONTENEUR    conteneur Caddy (défaut caddy)
#   RTP_SEUIL1       seuil disque de la première alerte, en % (défaut 85)
#   RTP_SEUIL2       seuil disque de la seconde alerte, en % (défaut 92)
#   RTP_CERT_JOURS   délai d'expiration du certificat, en jours (défaut 14)
#   RTP_HC_SIMULATION=1  simulation : lignes « vps-battement: ping|aucun », « vps-disque-85: ok|fail »,
#                    « vps-disque-92: ok|fail », « vps-certificat: ok|fail|ignore » ; aucun ping
#
# Sortie : une ligne JSON par passage (site, raison, disques, certificat, état de chaque ping), sans adresse ni
# identifiant. Elle part aussi dans le journal (logger -t rtp-battement) quand la sortie est un terminal ; sous
# cron, la ligne de /etc/cron.d/rtp-battement la passe déjà à logger, une seule entrée par passage.
#
# Durées bornées (revue de code WR-05) : chaque appel externe passe par timeout (coreutils), qui envoie TERM puis
# KILL 5 s plus tard ; docker inspect et openssl s_client 15 s, chaque requête HTTPS 15 s, chaque ping 60 s (curl
# -m 10 --retry 3). Un dockerd ou un Caddy bloqué ne bloque donc pas le passage, et la ligne cron prend en plus un
# verrou (flock -n) : un passage encore en cours fait sauter le suivant au lieu de l'empiler.
#
# Codes de sortie : 0 contrôles faits et pings envoyés (quel que soit l'état du site) ; 1 au moins un ping en
# échec ; 2 configuration refusée (fichier absent, illisible ou trop ouvert, variable manquante, valeur invalide).
# Compatible bash 3.2.
set -euo pipefail
export LC_ALL=C

ENV_FICHIER=${RTP_ENV:-/etc/rtp/battement.env}
BASE=${RTP_BASE:-/srv/reveletonprog}
CONTENEUR=${RTP_CONTENEUR:-caddy}
SEUIL1=${RTP_SEUIL1:-85}
SEUIL2=${RTP_SEUIL2:-92}
CERT_JOURS=${RTP_CERT_JOURS:-14}
SIMULATION=${RTP_HC_SIMULATION:-0}
MARQUEUR=reveleTonProg
RE_COMMIT='^[0-9a-f]{40}$'
RE_CHAMP_COMMIT='"commit"[[:space:]]*:[[:space:]]*"([^"]*)"'
RE_URL_PING='^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$'
RE_HOTE='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'

erreur() {
  printf 'erreur : %s\n' "$1" >&2
  exit 2
}

# Message de diagnostic : sur stderr (cron le passe à logger), et dans le journal si on est à un terminal.
journal() {
  printf '%s\n' "$1" >&2
  if [ -t 1 ]; then logger -t rtp-battement -- "$1" 2>/dev/null || true; fi
}

json_chaine() { # texte -> chaîne JSON entre guillemets
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  printf '"%s"' "$s"
}

# --- Paramètres ---------------------------------------------------------------------------------------------------
entier_entre() { # valeur min max
  [[ $1 =~ ^(0|[1-9][0-9]{0,4})$ ]] && [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]
}
entier_entre "$SEUIL1" 1 100 || erreur "RTP_SEUIL1 : entier de 1 à 100 attendu"
entier_entre "$SEUIL2" 1 100 || erreur "RTP_SEUIL2 : entier de 1 à 100 attendu"
entier_entre "$CERT_JOURS" 0 99999 || erreur "RTP_CERT_JOURS : nombre de jours attendu"
case "$SIMULATION" in 0 | 1) ;; *) erreur "RTP_HC_SIMULATION vaut 0 ou 1" ;; esac
[[ $CONTENEUR =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || erreur "RTP_CONTENEUR : nom de conteneur invalide"

# --- Fichier d'environnement : lu ligne à ligne, clés connues seulement, jamais exécuté ----------------------------
[ -e "$ENV_FICHIER" ] || erreur "fichier d'environnement absent : $ENV_FICHIER"
if [ ! -f "$ENV_FICHIER" ] || [ -L "$ENV_FICHIER" ]; then erreur "$ENV_FICHIER n'est pas un fichier ordinaire"; fi
[ -r "$ENV_FICHIER" ] || erreur "$ENV_FICHIER illisible"
if [ "$(uname -s)" != Darwin ]; then
  MODE_ENV=$(stat -c %a "$ENV_FICHIER")
  case "$MODE_ENV" in *00) ;; *) erreur "$ENV_FICHIER lisible par le groupe ou les autres (mode $MODE_ENV, 600 attendu)" ;; esac
fi

HC_BATTEMENT=''
HC_DISQUE85=''
HC_DISQUE92=''
HC_CERT=''
RTP_HOTE=''
RTP_SONDE_USER=''
RTP_SONDE_PASS=''
RTP_DISQUES=''
while IFS= read -r ligne || [ -n "$ligne" ]; do
  ligne=${ligne%$'\r'}
  case "$ligne" in '' | '#'*) continue ;; esac
  cle=${ligne%%=*}
  valeur=${ligne#*=}
  [ "$cle" != "$ligne" ] || continue
  case "$valeur" in
    \"*\") valeur=${valeur#\"}; valeur=${valeur%\"} ;;
    \'*\') valeur=${valeur#\'}; valeur=${valeur%\'} ;;
  esac
  case "$cle" in
    HC_BATTEMENT | HC_DISQUE85 | HC_DISQUE92 | HC_CERT | RTP_HOTE | RTP_SONDE_USER | RTP_SONDE_PASS | RTP_DISQUES)
      printf -v "$cle" '%s' "$valeur"
      ;;
  esac
done <"$ENV_FICHIER"

for nom in HC_BATTEMENT HC_DISQUE85 HC_DISQUE92 HC_CERT; do
  [ -n "${!nom}" ] || erreur "variable manquante dans $ENV_FICHIER : $nom"
  [[ ${!nom} =~ $RE_URL_PING ]] || erreur "$nom : adresse https attendue dans $ENV_FICHIER"
done
if [ -n "$RTP_HOTE" ]; then [[ $RTP_HOTE =~ $RE_HOTE ]] || erreur "RTP_HOTE : nom d'hôte invalide"; fi
if [ -n "$RTP_SONDE_USER" ] || [ -n "$RTP_SONDE_PASS" ]; then
  [ -n "$RTP_SONDE_USER" ] && [ -n "$RTP_SONDE_PASS" ] || erreur "RTP_SONDE_USER et RTP_SONDE_PASS vont ensemble"
  case "$RTP_SONDE_USER" in *:*) erreur "RTP_SONDE_USER ne doit pas contenir « : »" ;; esac
fi
read -r -a POINTS <<<"$RTP_DISQUES"
if [ "${#POINTS[@]}" -eq 0 ]; then POINTS=(/); fi
for m in "${POINTS[@]}"; do
  [[ $m =~ ^/[A-Za-z0-9._/-]*$ ]] || erreur "RTP_DISQUES : point de montage invalide"
done

# --- Contrôle 1 : conteneur et contenu ----------------------------------------------------------------------------
SITE=ok
RAISON=''
panne() {
  if [ "$SITE" = ok ]; then SITE=ko; RAISON=$1; fi
}

commit_de() { # texte JSON -> commit (vide si absent)
  if [[ $1 =~ $RE_CHAMP_COMMIT ]]; then printf '%s' "${BASH_REMATCH[1]}"; fi
}

config_curl() { # identifiants de la sonde au format de configuration de curl (guillemets et barres échappés)
  local u p
  if [ -z "$RTP_SONDE_USER" ]; then return 0; fi
  u=${RTP_SONDE_USER//\\/\\\\}
  u=${u//\"/\\\"}
  p=${RTP_SONDE_PASS//\\/\\\\}
  p=${p//\"/\\\"}
  printf 'user = "%s:%s"\n' "$u" "$p"
}

https_get() { # chemin -> corps de la réponse ; échec si HTTP en erreur
  config_curl | timeout -k 5 15 curl -fsS -m 10 --max-filesize 2000000 --resolve "$RTP_HOTE:443:127.0.0.1" --config - \
    "https://$RTP_HOTE$1" 2>/dev/null
}

ETAT_CONTENEUR=$(timeout -k 5 15 docker inspect -f '{{.State.Running}}' "$CONTENEUR" 2>/dev/null) || ETAT_CONTENEUR=''
if [ "$ETAT_CONTENEUR" != true ]; then panne "conteneur $CONTENEUR arrêté ou introuvable"; fi

if [ "$SITE" = ok ]; then
  if [ -z "$RTP_HOTE" ]; then
    FICHIER_VERSION="$BASE/essai/current/version.json"
    if [ ! -f "$FICHIER_VERSION" ]; then
      panne "version.json absent de la version d'essai déployée"
    else
      COMMIT=$(commit_de "$(head -c 4096 "$FICHIER_VERSION")")
      [[ $COMMIT =~ $RE_COMMIT ]] || panne "commit invalide dans version.json de la version d'essai"
    fi
  else
    if ! VERSION=$(https_get /version.json); then
      panne "version.json inaccessible en HTTPS par Caddy"
    else
      COMMIT=$(commit_de "$VERSION")
      [[ $COMMIT =~ $RE_COMMIT ]] || panne "commit invalide dans version.json servi en HTTPS"
    fi
    if [ "$SITE" = ok ]; then
      if ! ACCUEIL=$(https_get /); then
        panne "page d'accueil inaccessible en HTTPS par Caddy"
      else
        case "$ACCUEIL" in *"$MARQUEUR"*) ;; *) panne "marqueur $MARQUEUR absent de la page d'accueil" ;; esac
      fi
    fi
  fi
fi

# --- Contrôle 2 : disques -----------------------------------------------------------------------------------------
MAX=0
ILLISIBLE=0
CORPS_DISQUES=''
JSON_DISQUES=''
for m in "${POINTS[@]}"; do
  pct=$(df -P "$m" 2>/dev/null | awk 'NR > 1 { v = $5 } END { print v }') || pct=''
  pct=${pct%\%}
  if [[ $pct =~ ^[0-9]{1,3}$ ]]; then
    texte="$m ${pct}%"
    entree="{\"point\":$(json_chaine "$m"),\"pct\":$pct}"
    if [ "$pct" -gt "$MAX" ]; then MAX=$pct; fi
  else
    ILLISIBLE=1
    texte="$m illisible"
    entree="{\"point\":$(json_chaine "$m"),\"pct\":null}"
  fi
  CORPS_DISQUES=${CORPS_DISQUES:+$CORPS_DISQUES, }$texte
  JSON_DISQUES=${JSON_DISQUES:+$JSON_DISQUES,}$entree
done
D85=ok
D92=ok
if [ "$ILLISIBLE" = 1 ] || [ "$MAX" -ge "$SEUIL1" ]; then D85=fail; fi
if [ "$ILLISIBLE" = 1 ] || [ "$MAX" -ge "$SEUIL2" ]; then D92=fail; fi

# --- Contrôle 3 : certificat (après DNS seulement) ----------------------------------------------------------------
CERT=ignore
if [ -n "$RTP_HOTE" ]; then
  PEM=$(timeout -k 5 15 openssl s_client -connect 127.0.0.1:443 -servername "$RTP_HOTE" </dev/null 2>/dev/null) || true
  if [ -n "$PEM" ] && printf '%s\n' "$PEM" | openssl x509 -noout -checkend "$((CERT_JOURS * 86400))" >/dev/null 2>&1; then
    CERT=ok
  else
    CERT=fail
  fi
fi

# --- Pings, à la fin, dans un ordre fixe --------------------------------------------------------------------------
ECHECS=0
RESULTAT=''
envoyer() { # nom-du-contrôle url corps [suffixe] -> RESULTAT ok|echec|simulation
  local nom=$1 url=${2%/} corps=$3 suffixe=${4:-}
  if [ "$SIMULATION" = 1 ]; then
    RESULTAT=simulation
  elif timeout -k 5 60 curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$corps" "$url$suffixe" 2>/dev/null; then
    RESULTAT=ok
  else
    RESULTAT=echec
    ECHECS=$((ECHECS + 1))
    journal "ping $nom : échec de l'envoi (adresse non affichée)"
  fi
}

P_BATTEMENT=aucun
if [ "$SITE" = ok ]; then
  envoyer vps-battement "$HC_BATTEMENT" "ok"
  P_BATTEMENT=$RESULTAT
fi
if [ "$D85" = fail ]; then envoyer vps-disque-85 "$HC_DISQUE85" "disque $CORPS_DISQUES" /fail; else envoyer vps-disque-85 "$HC_DISQUE85" "ok $CORPS_DISQUES"; fi
P_D85=$RESULTAT
if [ "$D92" = fail ]; then envoyer vps-disque-92 "$HC_DISQUE92" "disque $CORPS_DISQUES" /fail; else envoyer vps-disque-92 "$HC_DISQUE92" "ok $CORPS_DISQUES"; fi
P_D92=$RESULTAT
P_CERT=aucun
case "$CERT" in
  ok) envoyer vps-certificat "$HC_CERT" "ok, certificat valide au moins $CERT_JOURS j"; P_CERT=$RESULTAT ;;
  fail) envoyer vps-certificat "$HC_CERT" "certificat de $RTP_HOTE illisible ou expirant dans moins de $CERT_JOURS j" /fail; P_CERT=$RESULTAT ;;
esac

# --- Bilan --------------------------------------------------------------------------------------------------------
if [ "$SIMULATION" = 1 ]; then
  if [ "$SITE" = ok ]; then echo "vps-battement: ping"; else echo "vps-battement: aucun"; fi
  echo "vps-disque-85: $D85"
  echo "vps-disque-92: $D92"
  echo "vps-certificat: $CERT"
fi

MODE_CONTENU=disque
if [ -n "$RTP_HOTE" ]; then MODE_CONTENU=https; fi
JSON="{\"evenement\":\"battement\",\"contenu\":\"$MODE_CONTENU\",\"site\":\"$SITE\""
if [ -n "$RAISON" ]; then JSON="$JSON,\"raison\":$(json_chaine "$RAISON")"; fi
JSON="$JSON,\"disques\":[$JSON_DISQUES],\"disque_max\":$MAX,\"disque85\":\"$D85\",\"disque92\":\"$D92\",\"cert\":\"$CERT\""
JSON="$JSON,\"pings\":{\"vps-battement\":\"$P_BATTEMENT\",\"vps-disque-85\":\"$P_D85\",\"vps-disque-92\":\"$P_D92\",\"vps-certificat\":\"$P_CERT\"}"
if [ "$SIMULATION" = 1 ]; then JSON="$JSON,\"simulation\":true"; fi
JSON="$JSON}"
printf '%s\n' "$JSON"
if [ -t 1 ] && [ "$SIMULATION" = 0 ]; then logger -t rtp-battement -- "$JSON" 2>/dev/null || true; fi

if [ "$ECHECS" -gt 0 ]; then exit 1; fi
exit 0
