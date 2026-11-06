#!/usr/bin/env bash
# Diagnostic du VPS en lecture seule (Phase 6, HEB-03).
# Usage depuis le poste d'Erwan : ssh <hôte> 'bash -s' < ops/diagnostic-vps.sh > rapport-brut.txt
# Aucune commande de ce script ne modifie la machine : pas d'écriture de fichier, pas de redémarrage,
# pas d'installation. tests/repo/diagnostic-vps.test.ts refuse toute commande hors liste blanche.
# Le rapport brut peut nommer d'autres sites et services : il ne va jamais dans le dépôt public.
set -u
export LC_ALL=C

section() { printf '\n## %s\n' "$1"; }
existe() { command -v "$1" >/dev/null 2>&1; }

section "Identité"
hostname
cat /etc/os-release | grep -E '^(PRETTY_NAME|VERSION_ID)='
uname -r
uptime

section "Processeur"
nproc

section "Mémoire (Mio)"
free -m
section "Swap"
swapon --show

section "Disque"
df -h -x tmpfs -x devtmpfs -x overlay -x squashfs
section "Inodes"
df -i -x tmpfs -x devtmpfs -x overlay -x squashfs
section "Plus gros dossiers (Mio, profondeur 1)"
for d in /var/log /var/lib /home /srv /opt /root /tmp /var/cache /var/backups; do
  [ -d "$d" ] && du -xsm "$d" 2>/dev/null
done
section "Plus gros dossiers sous /var/lib (Mio)"
du -xm --max-depth=1 /var/lib 2>/dev/null | sort -rn | head -15
section "Journal systemd"
existe journalctl && journalctl --disk-usage 2>/dev/null

section "Processus les plus gourmands en mémoire"
ps -eo pid,user,rss,%mem,comm --sort=-rss | head -15

section "Services actifs"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | awk '{print $1}'

section "Conteneurs"
if existe docker; then
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null
  docker system df 2>/dev/null
else
  echo "docker absent"
fi

section "Ports en écoute (TCP)"
ss -Htln 2>/dev/null | awk '{print $4}' | sort -u

section "Caddy (conteneur Docker)"
if existe docker; then
  for c in $(docker ps --format '{{.Names}}' 2>/dev/null); do
    img=$(docker inspect --format '{{.Config.Image}}' "$c" 2>/dev/null)
    case "$img" in
      caddy*|*/caddy*)
        echo "conteneur : $c ($img)"
        docker inspect --format '{{range .Mounts}}{{.Type}} {{.Source}} vers {{.Destination}}{{"\n"}}{{end}}' "$c" 2>/dev/null
        docker inspect --format '{{range $p, $b := .HostConfig.PortBindings}}{{$p}} {{end}}' "$c" 2>/dev/null
        docker inspect --format 'réseau : {{.HostConfig.NetworkMode}}' "$c" 2>/dev/null
        docker image inspect --format 'image créée : {{.Created}}' "$img" 2>/dev/null
        ;;
    esac
  done
fi

section "Caddy (système)"
if existe caddy; then
  caddy version
  systemctl is-active caddy 2>/dev/null
  ls -la /etc/caddy 2>/dev/null
  [ -f /etc/caddy/Caddyfile ] && grep -cE '^[^#[:space:]].*\{' /etc/caddy/Caddyfile | sed 's/^/blocs de site (approx.) : /'
  [ -f /etc/caddy/Caddyfile ] && grep -nE '^\s*import ' /etc/caddy/Caddyfile
  [ -d /var/lib/caddy ] && du -xsm /var/lib/caddy 2>/dev/null
  [ -d /var/log/caddy ] && du -xsm /var/log/caddy 2>/dev/null
else
  echo "caddy absent"
fi

section "Outils de déploiement"
for o in rsync rrsync restic; do
  if existe "$o"; then echo "$o : $(command -v "$o")"; else echo "$o : absent"; fi
done
[ -f /usr/share/doc/rsync/scripts/rrsync ] && echo "rrsync fourni dans /usr/share/doc/rsync/scripts"
rsync --version 2>/dev/null | head -1

section "Réseau IPv6"
ip -6 addr show scope global 2>/dev/null | grep -c inet6 | sed 's/^/adresses IPv6 globales : /'

section "Pare-feu"
existe ufw && ufw status 2>/dev/null | head -20

section "Mises à jour en attente"
existe apt && apt list --upgradable 2>/dev/null | grep -vc '^Listing'

section "Cron (noms des fichiers seulement)"
ls /etc/cron.d 2>/dev/null
crontab -l 2>/dev/null | grep -vc '^#' | sed 's/^/lignes actives dans la crontab de root : /'

section "Fin"
date -u +%Y-%m-%dT%H:%M:%SZ
