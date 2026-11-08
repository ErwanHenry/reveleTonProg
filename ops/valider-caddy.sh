#!/usr/bin/env bash
# Validation jetable de la configuration Caddy, en lecture seule (Phase 8, D-04, D-05 ; HEB-01).
#
# Lance « caddy validate » dans un conteneur jetable de la même image que le conteneur Caddy en service : sans
# réseau (aucune demande de certificat, aucun amont contacté), racine en lecture seule, /tmp /data /config et
# /var/log/caddy en tmpfs, Caddyfile et dossier sites.d montés en lecture seule. Rien n'est modifié sur la
# machine : pas de rechargement, pas de redémarrage, aucune écriture hors de son propre dossier mktemp, retiré à
# la sortie. À lancer avant toute écriture dans le Caddyfile et avant tout rechargement.
#
# Usage depuis le poste d'Erwan (le script ne dépend pas de son propre chemin) :
#   ssh <hôte> 'RTP_AVEC_SANS_VARIABLES=1 bash -s' < ops/valider-caddy.sh
#   ssh <hôte> "RTP_BLOC_B64=$(base64 < deploy/caddy/essai.caddy | tr -d '\n') bash -s" < ops/valider-caddy.sh
#
# Variables :
#   RTP_CADDYFILE            Caddyfile en service (défaut /opt/vaultwarden/Caddyfile), chemin absolu
#   RTP_SITES_D              dossier sites.d en service (défaut /opt/vaultwarden/sites.d), chemin absolu ; s'il
#                            n'existe pas, un dossier vide temporaire est monté à sa place (rien n'est créé)
#   RTP_CONTENEUR            conteneur Caddy en service dont on reprend l'image (défaut caddy)
#   RTP_BLOC_B64             bloc candidat en base64 : monté seul, sous reveletonprog-essai.caddy, dans un sites.d
#                            temporaire à la place du sites.d en service
#   RTP_AJOUTER_IMPORT=1     valide une copie du Caddyfile terminée par la ligne
#                            « import /etc/caddy/sites.d/*.caddy » (le Caddyfile en service n'est pas touché)
#   RTP_AVEC_SANS_VARIABLES=1  deux passages : avec RTP_ESSAI_HASH et RTP_SONDE_HASH posés à une empreinte bcrypt
#                            factice, puis sans ces variables (un seul passage, avec, par défaut)
#
# Sortie : « caddy <version> », puis une ligne « validation <avec|sans> variables : valide|invalide » par passage,
# précédée du verdict de Caddy et de ses messages d'erreur (le reste de son journal est filtré).
#
# Codes de sortie : 0 tous les passages valides ; 1 au moins un passage invalide ; 2 entrée ou environnement
# invalide (variable hors valeurs permises, Caddyfile illisible, conteneur introuvable, bloc base64 invalide).
set -euo pipefail
export LC_ALL=C

CADDYFILE=${RTP_CADDYFILE:-/opt/vaultwarden/Caddyfile}
SITES_D=${RTP_SITES_D:-/opt/vaultwarden/sites.d}
CONTENEUR=${RTP_CONTENEUR:-caddy}
BLOC_B64=${RTP_BLOC_B64:-}
AJOUTER_IMPORT=${RTP_AJOUTER_IMPORT:-0}
AVEC_SANS=${RTP_AVEC_SANS_VARIABLES:-0}
LIGNE_IMPORT='import /etc/caddy/sites.d/*.caddy'
NOM_BLOC=reveletonprog-essai.caddy

# Même empreinte factice que HASH_FACTICE de scripts/render-caddy.ts : forme bcrypt valide (Caddy l'accepte),
# produite par aucun calcul, donc aucun mot de passe ne lui correspond.
HASH_FACTICE='$2a$14$factice'
while [ "${#HASH_FACTICE}" -lt 60 ]; do HASH_FACTICE="$HASH_FACTICE."; done

erreur() {
  echo "erreur : $1" >&2
  exit 2
}

case "$AJOUTER_IMPORT" in 0 | 1) ;; *) erreur "RTP_AJOUTER_IMPORT vaut 0 ou 1" ;; esac
case "$AVEC_SANS" in 0 | 1) ;; *) erreur "RTP_AVEC_SANS_VARIABLES vaut 0 ou 1" ;; esac
[[ $CONTENEUR =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || erreur "nom de conteneur invalide"
case "$CADDYFILE" in /*) ;; *) erreur "RTP_CADDYFILE doit être un chemin absolu" ;; esac
case "$SITES_D" in /*) ;; *) erreur "RTP_SITES_D doit être un chemin absolu" ;; esac
[ -f "$CADDYFILE" ] && [ -r "$CADDYFILE" ] || erreur "Caddyfile illisible : $CADDYFILE"
if [ -n "$BLOC_B64" ] && ! [[ $BLOC_B64 =~ ^[A-Za-z0-9+/=]+$ ]]; then erreur "RTP_BLOC_B64 n'est pas du base64"; fi
command -v docker >/dev/null 2>&1 || erreur "docker absent"

IMG=$(docker inspect "$CONTENEUR" --format '{{.Image}}' 2>/dev/null) || erreur "conteneur introuvable : $CONTENEUR"
[[ $IMG =~ ^sha256:[0-9a-f]{64}$ ]] || erreur "identifiant d'image inattendu"

DOSSIER=$(mktemp -d)
trap 'rm -rf "$DOSSIER"' EXIT

# Caddyfile monté : celui en service, ou une copie terminée par la ligne import.
FICHIER=$CADDYFILE
if [ "$AJOUTER_IMPORT" = 1 ]; then
  FICHIER=$DOSSIER/Caddyfile
  cat "$CADDYFILE" >"$DOSSIER/Caddyfile"
  if grep -Fxq "$LIGNE_IMPORT" "$CADDYFILE"; then
    echo "ligne import déjà présente : copie identique au Caddyfile" >&2
  else
    if [ -s "$CADDYFILE" ] && [ -n "$(tail -c 1 "$CADDYFILE")" ]; then printf '\n' >>"$DOSSIER/Caddyfile"; fi
    printf '%s\n' "$LIGNE_IMPORT" >>"$DOSSIER/Caddyfile"
  fi
fi

# sites.d monté : le bloc candidat seul, le dossier en service, ou un dossier vide s'il n'existe pas encore.
if [ -n "$BLOC_B64" ]; then
  SITES=$DOSSIER/sites.d
  mkdir "$SITES"
  printf '%s' "$BLOC_B64" | base64 -d >"$DOSSIER/sites.d/$NOM_BLOC" 2>/dev/null || erreur "RTP_BLOC_B64 n'est pas du base64"
  [ -s "$SITES/$NOM_BLOC" ] || erreur "bloc candidat vide"
elif [ -d "$SITES_D" ]; then
  SITES=$SITES_D
else
  SITES=$DOSSIER/sites.d
  mkdir "$SITES"
  echo "sites.d absent : dossier vide monté à sa place" >&2
fi

VERSION=$(docker run --rm --network none --read-only "$IMG" caddy version 2>/dev/null | awk 'NR == 1 { print $1 }') || VERSION=inconnue
echo "caddy ${VERSION:-inconnue}"

valider() { # avec|sans
  local mode=$1 sortie rc=0
  local variables=()
  if [ "$mode" = avec ]; then
    variables=(-e "RTP_ESSAI_HASH=$HASH_FACTICE" -e "RTP_SONDE_HASH=$HASH_FACTICE")
  fi
  sortie=$(docker run --rm --network none --read-only \
    --tmpfs /tmp --tmpfs /data --tmpfs /config --tmpfs /var/log/caddy \
    ${variables[@]+"${variables[@]}"} \
    -v "$FICHIER:/etc/caddy/Caddyfile:ro" \
    -v "$SITES:/etc/caddy/sites.d:ro" \
    "$IMG" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1) || rc=$?
  # Verdict et erreurs seulement : pas de copie de la configuration chargée.
  printf '%s\n' "$sortie" | grep -E '^(Valid configuration|Error:)|"level":"(error|fatal)"' || true
  if [ "$rc" -eq 0 ] && printf '%s\n' "$sortie" | grep -q '^Valid configuration'; then
    echo "validation $mode variables : valide"
    return 0
  fi
  echo "validation $mode variables : invalide"
  return 1
}

STATUT=0
valider avec || STATUT=1
if [ "$AVEC_SANS" = 1 ]; then valider sans || STATUT=1; fi
exit "$STATUT"
