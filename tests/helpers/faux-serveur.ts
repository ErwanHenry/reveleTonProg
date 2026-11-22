// Faux serveur de déploiement réutilisable (phase 9.2, plans 04 à 06) : aucun accès réseau, aucun vrai serveur.
//
// Un dossier temporaire contient :
//   bin/     exécutables factices côté Mac, en sh POSIX (0755), à mettre en tête de PATH : ssh, rsync, curl,
//            ssh-agent, ssh-add, ssh-keygen. Chacun note ses arguments (journal), jamais son entrée standard.
//   serveur/ remplaçants côté serveur (PATH de la commande forcée) : df, logger, rrsync ; sous macOS aussi flock
//            (saute le verrou) et mv (GNU mv « gmv », pour « mv -T »), comme tests/repo/commande-deploiement.test.ts.
//   base/    RTP_BASE de la vraie commande forcée ops/commande-deploiement.sh.
// Le faux ssh saute les options -F, -i, -o, prend <utilisateur>@<hôte> puis la commande, pose SSH_ORIGINAL_COMMAND
// et lance la vraie commande forcée avec bash, dans un environnement vidé (env -i). Le faux rsync se présente en
// rsync 3 (ou en openrsync), refuse -l, -a et --chmod, puis passe par le faux ssh avec la commande serveur que le
// vrai rsync 3.5.2 de Homebrew envoie (capturée sans réseau avec un faux ssh, IN-07 de la revue de la phase 9.2) :
// « -l <utilisateur> <hôte> rsync --server -tre.iLsfxCIvu --stats . <cible>/<sha>/ » ; en openrsync, l'ancienne
// forme « <utilisateur>@<hôte> rsync --server -r -t --dirs . <cible>/<sha>/ ». L'envoi traverse donc les filtres de la commande forcée, et le
// faux rrsync copie l'arbre dans incoming/. Le faux curl sert current/version.json de la cible et des en-têtes
// réglables ; la ligne « user = … » reçue sur son entrée standard est gardée à part, hors des journaux.
// Valeurs factices seulement : serveur.exemple.invalid, deploy-factice, https://essai.exemple.invalid.
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RACINE_DEPOT, 'ops', 'commande-deploiement.sh');
const DARWIN = process.platform === 'darwin';

export const HOTE_FACTICE = 'serveur.exemple.invalid';
export const UTILISATEUR_FACTICE = 'deploy-factice';
export const URL_FACTICE = 'https://essai.exemple.invalid';
export const CLE_FACTICE = 'CLE-PRIVEE-FACTICE';
export const MOT_DE_PASSE_FACTICE = 'MOT-DE-PASSE-FACTICE-9f3e';
export const ENTETES_PAR_DEFAUT = [
  'HTTP/2 200',
  'content-type: text/html; charset=utf-8',
  'strict-transport-security: max-age=31536000',
  "content-security-policy: default-src 'self'",
];

export type NomFaux = 'ssh' | 'rsync' | 'curl' | 'ssh-agent' | 'ssh-add' | 'ssh-keygen';

export interface FauxServeur {
  racine: string;
  base: string;
  bin: string;
  /** Environnement des processus du test : PATH avec bin/ en tête. */
  env: Record<string, string>;
  /** Écrit un deploiement.env valide et ses fichiers (modes 0600) sous <home>/.config/rtp ; o remplace des clés. */
  config(home: string, o?: Partial<Record<string, string>>): void;
  journal(nom: NomFaux): string[][];
  motDePasseRecu(): string | null;
  poserEntetes(lignes: string[]): void;
  /** Range <dossier> dans releases/<sha>/ de la cible et y fait pointer current (sans la commande forcée). */
  servirCommit(cible: 'essai' | 'production', sha: string, dossier: string): void;
  /** Retire la clé du faux agent, comme une expiration (ssh-add -t) : avec exigerCle, ssh répond alors 255. */
  expirerCle(): void;
  /** WR-01 : le verbe activer échouera sans rien activer (verrou occupé, ou échec de code 1 ambigu) ; null : rétabli. */
  echouerActiver(mode: 'verrou' | 'bascule' | null): void;
  /** Pose la clé dans le faux agent (aides des tests qui appellent un verbe sans agent). */
  chargerCle(): void;
  /** La clé est-elle dans le faux agent ? */
  cleChargee(): boolean;
  detruire(): void;
  /** false sous macOS sans GNU mv : les cas de bascule (activer, retour) sont alors sautés. */
  basculePossible: boolean;
}

export interface OptionsFauxServeur {
  cleSansPhrase?: boolean;
  rsync?: 'rsync3' | 'openrsync';
  echecRetour?: boolean;
  /**
   * IN-07, CR-04 : le faux ssh exige que la clé soit chargée dans le faux agent (ssh-add -t, retirée par ssh-add -D
   * ou expirerCle) ; sinon « Permission denied (publickey) », code 255, comme le vrai.
   */
  exigerCle?: boolean;
  /** Nombre de chargements de la clé (ssh-add -t) acceptés ; les suivants échouent (phrase de passe refusée). */
  chargementsAdmis?: number;
}

const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

function ecrireExecutable(p: string, contenu: string): void {
  writeFileSync(p, contenu);
  chmodSync(p, 0o755);
}

function surPath(commande: string): string | null {
  const r = spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function creerFauxServeur(o: OptionsFauxServeur = {}): FauxServeur {
  const racine = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-faux-serveur-')));
  const base = path.join(racine, 'base');
  const bin = path.join(racine, 'bin');
  const serveur = path.join(racine, 'serveur');
  const logs = path.join(racine, 'logs');
  const prive = path.join(racine, 'prive');
  for (const d of [base, bin, serveur, logs, prive]) mkdirSync(d, { recursive: true });
  for (const n of ['ssh', 'rsync', 'curl', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'rrsync']) mkdirSync(path.join(logs, n));

  const gmv = DARWIN ? surPath('gmv') : null;
  const basculePossible = !DARWIN || gmv !== null;
  const pathOrigine = process.env.PATH ?? '/usr/bin:/bin';
  const pathServeur = `${serveur}:${pathOrigine}`;
  const fichierCible = path.join(prive, 'cible');
  const fichierEntetes = path.join(prive, 'entetes');
  const fichierMotDePasse = path.join(prive, 'mot-de-passe-recu');
  const fichierCleChargee = path.join(prive, 'cle-chargee');
  const fichierChargements = path.join(prive, 'chargements');
  const fichierEchecActiver = path.join(prive, 'echec-activer');
  writeFileSync(fichierCible, 'essai\n');
  writeFileSync(fichierEntetes, `${ENTETES_PAR_DEFAUT.join('\r\n')}\r\n\r\n`);

  // Journal d'un appel : un fichier par appel (ordre par numéro), arguments séparés par NUL, $0 en premier.
  const journal = (nom: string): string => `D=${quote(path.join(logs, nom))}
N=$(ls "$D" | wc -l | tr -d ' ')
printf '%s\\0' "$0" "$@" > "$D/$(printf '%06d' "$N")"
`;

  // ---------- côté serveur ----------
  ecrireExecutable(
    path.join(serveur, 'df'),
    `#!/bin/sh
printf 'Filesystem 1048576-blocks Used Available Capacity Mounted on\\n'
printf '/dev/factice 100000 50000 50000 50%% /\\n'
`,
  );
  ecrireExecutable(path.join(serveur, 'logger'), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${quote(path.join(logs, 'logger.log'))}\n`);
  ecrireExecutable(
    path.join(serveur, 'rrsync'),
    `#!/bin/sh
${journal('rrsync')}
# rrsync -wo -no-del -munge <base>/incoming : la destination est le dernier jeton de SSH_ORIGINAL_COMMAND.
for a in "$@"; do RACINE_ECRITURE=$a; done
DEST=
for t in $SSH_ORIGINAL_COMMAND; do DEST=$t; done
DEST=\${DEST%/}
[ -n "$FAUX_RSYNC_SOURCE" ] && [ -d "$FAUX_RSYNC_SOURCE" ] || { echo "rrsync factice : source absente" >&2; exit 12; }
mkdir -p "$RACINE_ECRITURE/$DEST" && cp -R "$FAUX_RSYNC_SOURCE/." "$RACINE_ECRITURE/$DEST/"
`,
  );
  if (DARWIN) {
    ecrireExecutable(
      path.join(serveur, 'flock'),
      `#!/bin/sh
while [ $# -gt 0 ]; do case "$1" in -w) shift 2 ;; -*) shift ;; *) break ;; esac; done
[ $# -gt 0 ] && shift
[ $# -gt 0 ] && exec "$@"
exit 0
`,
    );
    if (gmv !== null) ecrireExecutable(path.join(serveur, 'mv'), `#!/bin/sh\nexec ${quote(gmv)} "$@"\n`);
  }

  // ---------- côté Mac ----------
  ecrireExecutable(
    path.join(bin, 'ssh'),
    `#!/bin/sh
${journal('ssh')}
while [ $# -gt 0 ]; do
  case "$1" in
    -F|-i|-o|-l) shift 2 ;;
    -*) echo "ssh factice : option inattendue $1" >&2; exit 255 ;;
    *) break ;;
  esac
done
[ $# -ge 2 ] || { echo "ssh factice : destination et commande attendues" >&2; exit 255; }
${o.exigerCle === true ? `[ -f ${quote(fichierCleChargee)} ] || { echo "$1: Permission denied (publickey)." >&2; exit 255; }` : ''}
shift
CMD="$*"
${o.echecRetour === true ? `case "$CMD" in retour*) echo "échec : connexion perdue vers ${HOTE_FACTICE}" >&2; exit 1 ;; esac` : ''}
ECHEC_ACTIVER=$(cat ${quote(fichierEchecActiver)} 2>/dev/null || true)
case "$ECHEC_ACTIVER:$CMD" in
  verrou:activer*) echo "échec : verrou occupé depuis 20 s" >&2; exit 1 ;;
  bascule:activer*) echo "échec : bascule de current impossible" >&2; exit 1 ;;
esac
exec env -i PATH=${quote(pathServeur)} LC_ALL=C RTP_BASE=${quote(base)} RTP_RRSYNC=${quote(path.join(serveur, 'rrsync'))} \\
  SSH_ORIGINAL_COMMAND="$CMD" FAUX_RSYNC_SOURCE="\${FAUX_RSYNC_SOURCE:-}" \\
  bash ${quote(SCRIPT)}
`,
  );

  const versionRsync =
    o.rsync === 'openrsync'
      ? `echo 'openrsync: protocol version 29'; echo 'rsync version 2.6.9 compatible'`
      : `echo 'rsync  version 3.4.1  protocol version 32'; echo 'Copyright (C) 1996-2025 by Andrew Tridgell, Wayne Davison, and others.'`;
  ecrireExecutable(
    path.join(bin, 'rsync'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then ${versionRsync}; exit 0; fi
${journal('rsync')}
E=
SRC=
DEST=
while [ $# -gt 0 ]; do
  case "$1" in
    -l|-a|--chmod*|--links) echo "rsync factice : option refusée $1" >&2; exit 1 ;;
    --*) shift ;;
    -e) E=$2; shift 2 ;;
    -*l*|-*a*) echo "rsync factice : option refusée $1" >&2; exit 1 ;;
    -*) shift ;;
    *) if [ -z "$SRC" ]; then SRC=$1; else DEST=$1; fi; shift ;;
  esac
done
[ -n "$E" ] && [ -n "$SRC" ] && [ -n "$DEST" ] || { echo "rsync factice : -e, source et destination attendus" >&2; exit 1; }
case "$SRC" in */) ;; *) echo "rsync factice : source sans barre finale" >&2; exit 1 ;; esac
FAUX_RSYNC_SOURCE=\${SRC%/}
export FAUX_RSYNC_SOURCE
${o.rsync === 'openrsync' ? `$E "\${DEST%%:*}" rsync --server -r -t --dirs . "\${DEST#*:}" || exit $?` : `QUI=\${DEST%%:*}
$E -l "\${QUI%%@*}" "\${QUI#*@}" rsync --server -tre.iLsfxCIvu --stats . "\${DEST#*:}" || exit $?`}
N=$(find "$FAUX_RSYNC_SOURCE" -type f | wc -l | tr -d ' ')
echo "Number of files: $N"
echo "Total transferred file size: 1 bytes"
`,
  );

  ecrireExecutable(
    path.join(bin, 'curl'),
    `#!/bin/sh
${journal('curl')}
OUT=
HDR=
CFG=
URL=
while [ $# -gt 0 ]; do
  case "$1" in
    -o) OUT=$2; shift 2 ;;
    -D) HDR=$2; shift 2 ;;
    --config|-K) CFG=$2; shift 2 ;;
    --retry|--retry-delay|--max-time) shift 2 ;;
    -*) shift ;;
    *) URL=$1; shift ;;
  esac
done
if [ "$CFG" = "-" ]; then
  RECU=$(cat)
  [ -n "$RECU" ] && printf '%s' "$RECU" > ${quote(fichierMotDePasse)}
fi
CIBLE=$(cat ${quote(fichierCible)})
if [ "$CIBLE" = production ]; then R=${quote(base)}; else R=${quote(path.join(base, 'essai'))}; fi
case "$URL" in
  */version.json)
    if [ ! -f "$R/current/version.json" ]; then echo "curl: (22) $URL" >&2; exit 22; fi
    cp "$R/current/version.json" "$OUT"
    ;;
  */)
    [ -n "$HDR" ] && cp ${quote(fichierEntetes)} "$HDR"
    [ -n "$OUT" ] && printf '<!doctype html><title>essai</title>\\n' > "$OUT"
    ;;
  *) echo "curl: (22) $URL" >&2; exit 22 ;;
esac
exit 0
`,
  );

  ecrireExecutable(
    path.join(bin, 'ssh-keygen'),
    `#!/bin/sh
${journal('ssh-keygen')}
${o.cleSansPhrase === true ? `echo 'ssh-ed25519 AAAAC3-CLE-PUBLIQUE-FACTICE rtp-test'; exit 0` : `echo 'Load key: incorrect passphrase supplied to decrypt private key' >&2; exit 255`}
`,
  );
  ecrireExecutable(
    path.join(bin, 'ssh-agent'),
    `#!/bin/sh
${journal('ssh-agent')}
case "$1" in
  -a) : > "$2"; printf 'SSH_AUTH_SOCK=%s; export SSH_AUTH_SOCK;\\nSSH_AGENT_PID=4242; export SSH_AGENT_PID;\\necho Agent pid 4242;\\n' "$2" ;;
  -k) rm -f ${quote(fichierCleChargee)}; echo 'unset SSH_AUTH_SOCK;' ;;
  *) exit 64 ;;
esac
`,
  );
  // Faux ssh-add avec état : -t charge la clé (fichier témoin), -D la retire, -l dit si elle est là.
  ecrireExecutable(
    path.join(bin, 'ssh-add'),
    `#!/bin/sh
${journal('ssh-add')}
case "$1" in
  -t)
    N=$(cat ${quote(fichierChargements)} 2>/dev/null || echo 0)
    N=$((N + 1))
    echo "$N" > ${quote(fichierChargements)}
    ${o.chargementsAdmis === undefined ? ':' : `[ "$N" -le ${o.chargementsAdmis} ] || { echo 'Bad passphrase' >&2; exit 1; }`}
    : > ${quote(fichierCleChargee)}
    ;;
  -D) rm -f ${quote(fichierCleChargee)}; echo 'All identities removed.' ;;
  -l)
    if [ -f ${quote(fichierCleChargee)} ]; then echo '256 SHA256:EMPREINTE-FACTICE rtp-deploy-mac (ED25519)'; else echo 'The agent has no identities.'; exit 1; fi
    ;;
esac
exit 0
`,
  );

  const env = { PATH: `${bin}:${pathOrigine}` };

  return {
    racine,
    base,
    bin,
    env,
    basculePossible,
    config(home, surcharges = {}) {
      const rtp = path.join(home, '.config', 'rtp');
      mkdirSync(rtp, { recursive: true, mode: 0o700 });
      const ecrire = (nom: string, contenu: string, mode: number): void => {
        const p = path.join(rtp, nom);
        writeFileSync(p, contenu);
        chmodSync(p, mode);
      };
      ecrire('rtp-deploy-mac', `-----BEGIN OPENSSH PRIVATE KEY-----\n${CLE_FACTICE}\n-----END OPENSSH PRIVATE KEY-----\n`, 0o600);
      ecrire('rtp-deploy-mac.pub', 'ssh-ed25519 AAAAC3-CLE-PUBLIQUE-FACTICE rtp-deploy-mac\n', 0o600);
      ecrire('known_hosts-deploy', `${HOTE_FACTICE} ssh-ed25519 AAAAC3-HOTE-FACTICE\n`, 0o600);
      ecrire('sonde-pass', `${MOT_DE_PASSE_FACTICE}\n`, 0o600);
      const valeurs: Record<string, string> = {
        RTP_CIBLE: 'essai',
        RTP_HOTE: HOTE_FACTICE,
        RTP_UTILISATEUR: UTILISATEUR_FACTICE,
        RTP_URL: `${URL_FACTICE}/`,
        RTP_CLE: path.join(rtp, 'rtp-deploy-mac'),
        RTP_KNOWN_HOSTS: path.join(rtp, 'known_hosts-deploy'),
        RTP_FUMEE_UTILISATEUR: 'sonde',
        RTP_FUMEE_MOT_DE_PASSE: path.join(rtp, 'sonde-pass'),
        RTP_RSYNC: path.join(bin, 'rsync'),
      };
      for (const [k, v] of Object.entries(surcharges)) if (v !== undefined) valeurs[k] = v;
      writeFileSync(fichierCible, `${valeurs.RTP_CIBLE === 'production' ? 'production' : 'essai'}\n`);
      ecrire('deploiement.env', `${Object.entries(valeurs).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, 0o600);
    },
    journal(nom) {
      const d = path.join(logs, nom);
      return readdirSync(d)
        .sort()
        .map((f) => {
          const parts = readFileSync(path.join(d, f), 'utf8').split('\0');
          parts.pop();
          return parts;
        });
    },
    motDePasseRecu() {
      return existsSync(fichierMotDePasse) ? readFileSync(fichierMotDePasse, 'utf8').trim() : null;
    },
    poserEntetes(lignes) {
      writeFileSync(fichierEntetes, `${lignes.join('\r\n')}\r\n\r\n`);
    },
    servirCommit(cible, sha, dossier) {
      const r = cible === 'production' ? base : path.join(base, 'essai');
      const version = path.join(r, 'releases', sha);
      mkdirSync(path.dirname(version), { recursive: true });
      rmSync(version, { recursive: true, force: true });
      cpSync(dossier, version, { recursive: true });
      rmSync(path.join(r, 'current'), { force: true });
      symlinkSync(`releases/${sha}`, path.join(r, 'current'));
    },
    expirerCle() {
      rmSync(fichierCleChargee, { force: true });
    },
    echouerActiver(mode) {
      if (mode === null) rmSync(fichierEchecActiver, { force: true });
      else writeFileSync(fichierEchecActiver, mode);
    },
    chargerCle() {
      writeFileSync(fichierCleChargee, '');
    },
    cleChargee() {
      return existsSync(fichierCleChargee);
    },
    detruire() {
      rmSync(racine, { recursive: true, force: true });
    },
  };
}
