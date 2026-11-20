// Veille des candidatures (phase 10.1) : planification launchd sur le Mac d'Erwan (décision du 2026-11-20 : deux
// passages par jour, 8 h et 19 h, heure du Mac). Agent utilisateur, aucun droit administrateur.
//
// Deux fichiers, écrits par `npm run veille -- installer` et retirés par `retirer` :
//   - ~/Library/LaunchAgents/fr.reveletonprog.veille.plist : quand lancer, où journaliser ;
//   - <dossier de la veille>/lancer.sh : aligne le worktree de la veille sur la référence suivie, installe les
//     dépendances si le lockfile a changé, puis exécute la veille DEPUIS ce worktree, jamais depuis le dossier de
//     travail d'Erwan (quelle que soit la branche qui y est ouverte).
// Aucun secret dans ces fichiers : la veille lit le Trousseau à chaque passage.
import path from 'node:path';

export const LABEL = 'fr.reveletonprog.veille';
export const HEURES = [8, 19] as const;

export interface ParametresLaunchd {
  dossier: string;
  depot: string;
  reference: string;
  /** Chemin absolu de fnm et dossiers à mettre dans le PATH (git, fnm). */
  fnm: string;
  chemins: string[];
}

export const cheminPlist = (home: string): string => path.join(home, 'Library', 'LaunchAgents', `${LABEL}.plist`);
export const cheminLanceur = (dossier: string): string => path.join(dossier, 'lancer.sh');
export const cheminJournal = (dossier: string): string => path.join(dossier, 'journal.log');

const xml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Chaîne shell entre apostrophes (aucune expansion). */
const sh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

function verifier(p: ParametresLaunchd): void {
  for (const [nom, v] of [['dossier', p.dossier], ['depot', p.depot], ['fnm', p.fnm], ...p.chemins.map((c) => ['chemin', c])] as [string, string][]) {
    if (!path.isAbsolute(v)) throw new Error(`${nom} : chemin absolu attendu (${v.slice(0, 80)})`);
    if (/[\n\r\0]/.test(v)) throw new Error(`${nom} : caractère interdit`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(p.reference)) throw new Error('référence : nom de référence git attendu');
}

export function plist(p: ParametresLaunchd): string {
  verifier(p);
  const heures = HEURES.map((h) => `      <dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>0</integer></dict>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Veille des candidatures (reveleTonProg), écrit par npm run veille -- installer ; retiré par npm run veille -- retirer. -->
<plist version="1.0">
  <dict>
    <key>Label</key><string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/sh</string>
      <string>${xml(cheminLanceur(p.dossier))}</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>
${heures}
    </array>
    <key>RunAtLoad</key><false/>
    <key>ProcessType</key><string>Background</string>
    <key>StandardOutPath</key><string>${xml(cheminJournal(p.dossier))}</string>
    <key>StandardErrorPath</key><string>${xml(cheminJournal(p.dossier))}</string>
  </dict>
</plist>
`;
}

export function lanceur(p: ParametresLaunchd): string {
  verifier(p);
  const chemins = [...new Set([...p.chemins, path.dirname(p.fnm), '/usr/bin', '/bin', '/usr/sbin', '/sbin'])].join(':');
  return `#!/bin/sh
# Lanceur de la veille des candidatures (reveleTonProg). Écrit par npm run veille -- installer : ne pas modifier à
# la main (relancer installer). Aucun secret ici : la veille lit le Trousseau à chaque passage.
set -eu
export PATH=${sh(chemins)}
export RTP_VEILLE_DIR=${sh(p.dossier)}
DEPOT=${sh(p.depot)}
REFERENCE=${sh(p.reference)}
FNM=${sh(p.fnm)}
ARBRE="$RTP_VEILLE_DIR/arbre"
echo "--- veille $(date '+%Y-%m-%d %H:%M:%S') ---"
git -C "$DEPOT" fetch --quiet origin
if [ ! -e "$ARBRE/.git" ]; then
  git -C "$DEPOT" worktree add --detach --quiet "$ARBRE" "$REFERENCE"
else
  # Un worktree modifié à la main n'est pas écrasé : la veille le signale (panne, Healthchecks).
  git -C "$ARBRE" checkout --quiet --detach "$REFERENCE" || true
fi
cd "$ARBRE"
LOCK=$(shasum -a 256 package-lock.json | cut -d ' ' -f 1)
if [ ! -d node_modules ] || [ "$LOCK" != "$(cat "$RTP_VEILLE_DIR/arbre-lock.sha256" 2>/dev/null || true)" ]; then
  "$FNM" exec --using=24 npm ci --no-audit --no-fund --silent
  printf '%s\\n' "$LOCK" > "$RTP_VEILLE_DIR/arbre-lock.sha256"
fi
exec "$FNM" exec --using=24 node scripts/veille.ts lancer --reference "$REFERENCE"
`;
}
