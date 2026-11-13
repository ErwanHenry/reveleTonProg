#!/usr/bin/env bash
# Lancement filtré de node --test pour les vérifications des plans de la phase 9.1.
# Usage : bash filtre.sh "<motif>" [--exige "<jeton>"]... <fichier de test>...
# Échoue si un test échoue, si AUCUN test ne correspond au motif (un --test-name-pattern sans correspondance sort
# sinon en code 0 avec zéro test lancé), ou si un jeton exigé n'apparaît dans le nom d'aucun test ou describe réussi
# (« ok N - … » de la sortie TAP). Chaque nouveau module de cas porte un jeton unique dans le titre de son describe.
# Se lance depuis la racine du dépôt ou du worktree à tester.
set -uo pipefail
if [ "$#" -lt 2 ]; then
  echo "usage : bash filtre.sh \"<motif>\" [--exige \"<jeton>\"]... <fichier de test>..." >&2
  exit 2
fi
motif=$1
shift
jetons=()
while [ "$#" -gt 0 ] && [ "$1" = "--exige" ]; do
  [ "$#" -ge 2 ] || { echo "filtre.sh : --exige sans jeton" >&2; exit 2; }
  jetons+=("$2")
  shift 2
done
[ "$#" -ge 1 ] || { echo "filtre.sh : aucun fichier de test" >&2; exit 2; }
sortie=$(mktemp)
TZ=Europe/Paris fnm exec --using=24 node --test --test-reporter=tap --test-name-pattern="$motif" "$@" >"$sortie" 2>&1
code=$?
tail -n 12 "$sortie"
# Tests réellement lancés et réussis : lignes « ok N - nom », hors ligne du fichier lui-même et hors « # SKIP »
# (le résumé « # pass » compte aussi le fichier et ne prouve rien).
reussis=$(grep -E '^[[:space:]]*ok [0-9]+ - ' "$sortie" | grep -vE ' - .*\.test\.ts$' | grep -vc '# SKIP')
manquants=0
for j in "${jetons[@]+"${jetons[@]}"}"; do
  if ! grep -E '^[[:space:]]*ok [0-9]+ - ' "$sortie" | grep -v '# SKIP' | grep -qF -- "$j"; then
    echo "filtre.sh : aucun test réussi ne porte le jeton « $j »" >&2
    manquants=1
  fi
done
rm -f "$sortie"
if [ "$code" -ne 0 ]; then
  exit "$code"
fi
if [ "${reussis:-0}" -lt 1 ]; then
  echo "filtre.sh : aucun test ne correspond au motif « $motif »" >&2
  exit 1
fi
exit "$manquants"
