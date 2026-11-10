// OPS-03 (08-07, D-15) : archive de la configuration serveur (ops/sauvegarder-config.sh) et preuve de restauration
// (ops/tester-restauration.sh). Bout en bout, sans machine réelle :
// 1. une copie de ops/ et deploy/ du dépôt sert de source (--source), avec un bloc d'essai dont l'adresse n'est pas
//    un domaine réservé (le bloc commité garde le domaine provisoire tant que 08-12 ne l'a pas remplacé) ;
// 2. un faux serveur est construit sous une racine temporaire par le VRAI installateur (--appliquer), avec les
//    remplaçants id, useradd et chown de tests/repo/installer-serveur.test.ts, puis complété (clés d'hôte publique
//    et privée, historiques, liens current) ;
// 3. le VRAI sauvegarder-config.sh l'archive, puis le VRAI tester-restauration.sh la restaure dans un dossier
//    jetable et lance le VRAI installateur (--verifier) et le VRAI valider-caddy.sh dessus.
// Remplaçants en tête de PATH : docker (inspect donne un identifiant d'image ; run répond « Valid configuration »
// ou une erreur si STUB_CADDY=invalide, et consigne ses arguments), curl (consigne l'adresse et le corps du ping),
// logger, id, useradd, chown. Adresses de ping factices (https://hc.invalid/<uuid>) et empreintes bcrypt factices
// construites à l'exécution : aucune valeur dans le dépôt. Aucune sortie ne doit les contenir.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAUVEGARDER = path.join(ROOT, 'ops/sauvegarder-config.sh');
const RESTAURER = path.join(ROOT, 'ops/tester-restauration.sh');

function surPath(commande: string): boolean {
  return spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' }).status === 0;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-sauvegarde-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const ALPHABET_BCRYPT = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function empreinteFactice(variante: string): string {
  let corps = '';
  for (const o of crypto.randomBytes(53)) corps += ALPHABET_BCRYPT[o % ALPHABET_BCRYPT.length] ?? '.';
  return ['$', '2', variante, '$', '12', '$', corps].join('');
}
const ping = (): string => ['https:/', '/hc.invalid/', crypto.randomUUID()].join('');
const ESSAI = empreinteFactice('y');
const SONDE = empreinteFactice('b');
const PINGS = { battement: ping(), d85: ping(), d92: ping(), cert: ping(), restauration: ping() };
const CLE = `ssh-ed25519 ${crypto.randomBytes(51).toString('base64')} rtp-deploy-test`;
const CLE_PRIVEE = `cle-privee-factice-${crypto.randomBytes(16).toString('hex')}`;
const ENV_AUTRE = `AUTRE_SERVICE='valeur-voisine-${crypto.randomBytes(6).toString('hex')}'\n`;
const CADDYFILE = ['site-factice-un.exemple.test {', '\trespond "contenu-prive-un"', '}', ''].join('\n');
const COMPOSE = ['services:', '  caddy:', '    image: caddy:2-alpine', ''].join('\n');
const SHA_PROD = 'b'.repeat(40);
const SHA_ESSAI = 'c'.repeat(40);
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const ETAPES = 'montages,env-caddy,import-caddy,utilisateur,commande,battement,sauvegarde,restauration-mensuelle,site-essai';
const ENTREE = [
  `RTP_ESSAI_HASH=${ESSAI}`,
  `RTP_SONDE_HASH=${SONDE}`,
  `HC_BATTEMENT=${PINGS.battement}`,
  `HC_DISQUE85=${PINGS.d85}`,
  `HC_DISQUE92=${PINGS.d92}`,
  `HC_CERT=${PINGS.cert}`,
  'RTP_HOTE=essai.exemple.fr',
  `HC_RESTAURATION=${PINGS.restauration}`,
  '',
].join('\n');
const SECRETS = ['hc.invalid', ESSAI, SONDE, CLE_PRIVEE, 'valeur-voisine', 'contenu-prive-un', ...Object.values(PINGS)];

function ecrire(fichier: string, contenu: string, mode = 0o644): void {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, contenu, { mode });
  fs.chmodSync(fichier, mode);
}

function stub(dossier: string, nom: string, lignes: string[]): void {
  ecrire(path.join(dossier, nom), `${lignes.join('\n')}\n`, 0o755);
}

interface Banc {
  base: string;
  racine: string;
  source: string;
  destination: string;
  stubs: string;
  journal: string;
  tmpdir: string;
  uid: string;
  gid: string;
}

interface Sortie {
  status: number | null;
  stdout: string;
  stderr: string;
}

function env(b: Banc, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${b.stubs}:${process.env['PATH'] ?? ''}`,
    TMPDIR: b.tmpdir,
    COPYFILE_DISABLE: '1',
    STUB_JOURNAL: b.journal,
    STUB_UID: b.uid,
    STUB_GID: b.gid,
    ...extra,
  };
}

function verifierFuites(s: Sortie): Sortie {
  const tout = `${s.stdout}${s.stderr}`;
  for (const secret of SECRETS) assert.ok(!tout.includes(secret), 'une valeur secrète ou un contenu de fichier apparaît dans la sortie');
  return s;
}

function lancer(b: Banc, script: string, args: string[], extra: Record<string, string> = {}): Sortie {
  const r = spawnSync('bash', [script, ...args], { encoding: 'utf8', input: '', env: env(b, extra) });
  return verifierFuites({ status: r.status, stdout: r.stdout, stderr: r.stderr });
}

const sauvegarder = (b: Banc, extra: Record<string, string> = {}): Sortie => lancer(b, SAUVEGARDER, ['--racine', b.racine, '--destination', b.destination], extra);
const restaurer = (b: Banc, extra: Record<string, string> = {}): Sortie =>
  lancer(b, RESTAURER, ['--racine', b.racine, '--destination', b.destination, '--source', b.source], extra);

function stubs(dossier: string): void {
  stub(dossier, 'id', [
    '#!/bin/sh',
    'case "$*" in',
    '  "-u") echo "${STUB_ID_U:-0}" ;;',
    '  "-u root") echo "$STUB_UID" ;;',
    '  "-g root") echo "$STUB_GID" ;;',
    '  "-u deploy"|"deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo "$STUB_UID" ;;',
    '  "-g deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo "$STUB_GID" ;;',
    '  "-nG deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo deploy ;;',
    '  *) exit 1 ;;',
    'esac',
  ]);
  stub(dossier, 'useradd', ['#!/bin/sh', ': > "$STUB_JOURNAL/deploy-existe"']);
  stub(dossier, 'chown', ['#!/bin/sh', 'exit 0']);
  stub(dossier, 'logger', ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/logger"']);
  stub(dossier, 'docker', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/docker"',
    'case "$1" in',
    `  inspect) echo "sha256:${'d'.repeat(64)}" ;;`,
    '  run)',
    '    case "$*" in',
    '      *"caddy version"*) echo "v2.8.4 h1:factice" ;;',
    '      *"caddy validate"*)',
    '        if [ "${STUB_CADDY:-valide}" = valide ]; then echo "Valid configuration"; else echo "Error: adapting config using caddyfile: factice"; exit 1; fi ;;',
    '    esac ;;',
    '  *) exit 1 ;;',
    'esac',
  ]);
  stub(dossier, 'curl', [
    '#!/bin/sh',
    'url=""; corps=""; prec=""; config=0',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/curl-argv"',
    'for a in "$@"; do',
    '  [ "$prec" = "--data-raw" ] && corps=$a',
    '  [ "$prec" = "--config" ] && [ "$a" = "-" ] && config=1',
    '  case "$a" in https://*) url=$a ;; esac',
    '  prec=$a',
    'done',
    'if [ "$config" = 1 ] && [ -z "$url" ]; then url=$(sed -n \'s/^url = "\\(.*\\)"$/\\1/p\'); fi',
    'printf \'%s\\t%s\\n\' "$url" "$corps" >> "$STUB_JOURNAL/pings"',
    'exit "${STUB_PING:-0}"',
  ]);
}

/** Banc complet : source copiée du dépôt, faux serveur construit par le vrai installateur. */
/**
 * Blocs Caddy du site présents sur le faux serveur : « essai » (avant l'ouverture), « deux » (les jours de
 * l'ouverture), « public » (après : bloc et chemins d'essai absents), « aucun » (configuration amputée).
 */
type Blocs = 'essai' | 'deux' | 'public' | 'aucun';

function banc(options: { sansRestaurationEnv?: boolean; blocs?: Blocs } = {}): Banc {
  const blocs = options.blocs ?? 'essai';
  const base = fs.mkdtempSync(path.join(tmp, 'cas-'));
  const b: Banc = {
    base,
    racine: path.join(base, 'racine'),
    source: path.join(base, 'source'),
    destination: path.join(base, 'racine/root/rtp-sauvegardes'),
    stubs: path.join(base, 'stubs'),
    journal: path.join(base, 'journal'),
    tmpdir: path.join(base, 'tmpdir'),
    uid: '',
    gid: '',
  };
  for (const d of [b.racine, b.stubs, b.journal, b.tmpdir]) fs.mkdirSync(d, { recursive: true });
  const st = fs.statSync(b.racine);
  b.uid = String(st.uid);
  b.gid = String(st.gid);
  stubs(b.stubs);

  // Source : copie de ops/ et deploy/ du dépôt ; adresse du bloc d'essai remplacée si elle est réservée.
  fs.cpSync(path.join(ROOT, 'ops'), path.join(b.source, 'ops'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'deploy'), path.join(b.source, 'deploy'), { recursive: true });
  const bloc = path.join(b.source, 'deploy/caddy/essai.caddy');
  fs.writeFileSync(bloc, fs.readFileSync(bloc, 'utf8').replace(/^[A-Za-z0-9.-]+\.invalid \{$/m, 'essai.exemple.fr {'));

  // Serveur existant, puis installation réelle.
  ecrire(path.join(b.racine, 'opt/vaultwarden/Caddyfile'), CADDYFILE);
  ecrire(path.join(b.racine, 'opt/vaultwarden/docker-compose.yml'), COMPOSE, 0o600);
  ecrire(path.join(b.racine, 'opt/vaultwarden/.env'), ENV_AUTRE, 0o600);
  const cle = path.join(base, 'cle.pub');
  ecrire(cle, `${CLE}\n`);
  // Lien current de production posé avant l'installation : l'étape site-public refuse une racine absente.
  fs.mkdirSync(path.join(b.racine, 'srv/reveletonprog'), { recursive: true });
  fs.chmodSync(path.join(b.racine, 'srv/reveletonprog'), 0o755);
  fs.symlinkSync(`releases/${SHA_PROD}`, path.join(b.racine, 'srv/reveletonprog/current'));
  const etapes = blocs === 'essai' ? ETAPES : `${ETAPES},site-public`;
  const r = spawnSync('bash', [path.join(b.source, 'ops/installer-serveur.sh'), '--appliquer', '--etape', etapes, '--cle-publique', cle, '--racine', b.racine, '--source', b.source], {
    encoding: 'utf8',
    input: ENTREE,
    env: env(b),
  });
  assert.equal(r.status, 0, `installation du faux serveur : ${r.stdout}${r.stderr}`);
  if (options.sansRestaurationEnv) fs.rmSync(path.join(b.racine, 'etc/rtp/restauration.env'));
  if (blocs === 'public' || blocs === 'aucun') fs.rmSync(path.join(b.racine, 'opt/vaultwarden/sites.d/reveletonprog-essai.caddy'));
  if (blocs === 'aucun') fs.rmSync(path.join(b.racine, 'opt/vaultwarden/sites.d/reveletonprog.caddy'));

  // Compléments : clés d'hôte, historiques, liens current.
  ecrire(path.join(b.racine, 'etc/ssh/ssh_host_ed25519_key'), `${CLE_PRIVEE}\n`, 0o600);
  ecrire(path.join(b.racine, 'etc/ssh/ssh_host_rsa_key'), `${CLE_PRIVEE}-rsa\n`, 0o600);
  ecrire(path.join(b.racine, 'etc/ssh/ssh_host_ed25519_key.pub'), 'ssh-ed25519 AAAAfactice root@hote\n');
  ecrire(path.join(b.racine, 'etc/ssh/sshd_config'), 'PermitRootLogin no\n');
  ecrire(path.join(b.racine, 'srv/reveletonprog/.historique'), `2026-11-08T20:00:00Z activer ${SHA_PROD}\n`);
  if (blocs !== 'public') {
    ecrire(path.join(b.racine, 'srv/reveletonprog/essai/.historique'), `2026-11-08T20:00:00Z activer ${SHA_ESSAI}\n`);
    fs.symlinkSync(`releases/${SHA_ESSAI}`, path.join(b.racine, 'srv/reveletonprog/essai/current'));
  }
  return b;
}

/** Banc minimal (Caddyfile et composition seulement), pour l'archive seule. */
function bancMinimal(): Banc {
  const base = fs.mkdtempSync(path.join(tmp, 'min-'));
  const b: Banc = {
    base,
    racine: path.join(base, 'racine'),
    source: path.join(base, 'source'),
    destination: path.join(base, 'sauvegardes'),
    stubs: path.join(base, 'stubs'),
    journal: path.join(base, 'journal'),
    tmpdir: path.join(base, 'tmpdir'),
    uid: '0',
    gid: '0',
  };
  for (const d of [b.racine, b.stubs, b.journal, b.tmpdir]) fs.mkdirSync(d, { recursive: true });
  stubs(b.stubs);
  ecrire(path.join(b.racine, 'opt/vaultwarden/Caddyfile'), CADDYFILE);
  ecrire(path.join(b.racine, 'opt/vaultwarden/docker-compose.yml'), COMPOSE, 0o600);
  return b;
}

const mode = (f: string): number => fs.statSync(f).mode & 0o777;
const lire = (b: Banc, nom: string): string => {
  const f = path.join(b.journal, nom);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};
const json = (s: Sortie): Record<string, unknown> => {
  const lignes = s.stdout.split('\n').filter(Boolean);
  assert.equal(lignes.length, 1, `une seule ligne attendue sur stdout : ${s.stdout}`);
  return JSON.parse(lignes[0] ?? '') as Record<string, unknown>;
};
const archives = (b: Banc): string[] =>
  fs
    .readdirSync(b.destination)
    .filter((n) => n.endsWith('.tar.gz'))
    .sort();

function entrees(archive: string): string[] {
  const r = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((e) => e.replace(/^\.\//, '').replace(/\/$/, ''))
    .filter((e) => e !== '.' && e !== '');
}

function extraire(archive: string, dossier: string): void {
  fs.mkdirSync(dossier, { recursive: true });
  const r = spawnSync('tar', ['-xpzf', archive, '-C', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function reconditionner(archive: string, dossier: string): void {
  const r = spawnSync('tar', ['-czf', archive, '-C', dossier, ...fs.readdirSync(dossier)], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  assert.equal(r.status, 0, r.stderr);
}

const sha256 = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const ATTENDUS = [
  'opt/vaultwarden/Caddyfile',
  'opt/vaultwarden/docker-compose.yml',
  'opt/vaultwarden/docker-compose.override.yml',
  'opt/vaultwarden/.env',
  'opt/vaultwarden/sites.d/reveletonprog-essai.caddy',
  'etc/cron.d/rtp-battement',
  'etc/cron.d/rtp-sauvegarde',
  'etc/cron.d/rtp-restauration',
  'etc/rtp/battement.env',
  'etc/rtp/restauration.env',
  'home/deploy/.ssh/authorized_keys',
  'usr/local/sbin/rtp-deploy-command',
  'usr/local/sbin/rtp-battement',
  'usr/local/sbin/rtp-sauvegarder',
  'usr/local/sbin/rtp-tester-restauration',
  'etc/ssh/ssh_host_ed25519_key.pub',
  'srv/reveletonprog/.historique',
  'srv/reveletonprog/essai/.historique',
];

describe('ops/sauvegarder-config.sh : archive de la configuration', () => {
  const b = banc();
  const r = sauvegarder(b);
  const archive = path.join(b.destination, `${AUJOURDHUI}.tar.gz`);
  const extrait = path.join(b.base, 'extrait');

  it('écrit <destination>/<AAAA-MM-JJ>.tar.gz (date UTC) en 0600 dans un dossier 0700', () => {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(archive), archives(b).join(','));
    assert.equal(mode(archive), 0o600);
    assert.equal(mode(b.destination), 0o700);
  });

  it('contient chaque fichier de la liste sous son chemin relatif, plus MANIFESTE.txt et liens.txt', () => {
    const e = entrees(archive);
    for (const a of [...ATTENDUS, 'MANIFESTE.txt', 'liens.txt']) assert.ok(e.includes(a), `${a} absent de l'archive`);
  });

  it("n'archive jamais une clé d'hôte privée ni un fichier hors liste", () => {
    const e = entrees(archive);
    assert.deepEqual(
      e.filter((x) => x.endsWith('_key')),
      [],
    );
    assert.ok(!e.some((x) => x.includes('sshd_config')));
    assert.ok(!e.some((x) => x.startsWith('opt/rtp')));
    assert.ok(!e.some((x) => x.includes('.bak-')));
  });

  it('MANIFESTE donne le sha256 exact de chaque fichier ; liens.txt donne la cible des deux liens current', () => {
    extraire(archive, extrait);
    const manifeste = fs.readFileSync(path.join(extrait, 'MANIFESTE.txt'), 'utf8').split('\n').filter(Boolean);
    const vus = new Set<string>();
    for (const l of manifeste) {
      const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(l);
      assert.ok(m, `ligne de manifeste inattendue : ${l}`);
      const [, h, p] = m;
      assert.equal(sha256(path.join(extrait, p ?? '')), h, p);
      assert.equal(sha256(path.join(b.racine, p ?? '')), h, p);
      vus.add(p ?? '');
    }
    for (const a of ATTENDUS) assert.ok(vus.has(a), `${a} absent du manifeste`);
    const liens = fs.readFileSync(path.join(extrait, 'liens.txt'), 'utf8');
    assert.match(liens, new RegExp(`^srv/reveletonprog/current releases/${SHA_PROD}$`, 'm'));
    assert.match(liens, new RegExp(`^srv/reveletonprog/essai/current releases/${SHA_ESSAI}$`, 'm'));
  });

  it('garde les modes des fichiers et dossiers sensibles', () => {
    assert.equal(mode(path.join(extrait, 'etc/rtp')), 0o700);
    assert.equal(mode(path.join(extrait, 'etc/rtp/battement.env')), 0o600);
    assert.equal(mode(path.join(extrait, 'opt/vaultwarden/.env')), 0o600);
    assert.equal(mode(path.join(extrait, 'usr/local/sbin/rtp-battement')), 0o755);
  });

  it('imprime une ligne JSON : date, nombre de fichiers, taille en octets, absents', () => {
    const j = json(r);
    assert.equal(j['date'], AUJOURDHUI);
    assert.equal(j['fichiers'], ATTENDUS.length);
    assert.equal(j['octets'], fs.statSync(archive).size);
    assert.equal(j['absents'], 0);
  });

  it('un second passage le même jour remplace l’archive', () => {
    fs.appendFileSync(path.join(b.racine, 'srv/reveletonprog/.historique'), `2026-11-08T21:00:00Z activer ${SHA_PROD}\n`);
    const r2 = sauvegarder(b);
    assert.equal(r2.status, 0, r2.stderr);
    assert.deepEqual(archives(b), [`${AUJOURDHUI}.tar.gz`]);
    const e2 = path.join(b.base, 'extrait2');
    extraire(archive, e2);
    assert.equal(sha256(path.join(e2, 'srv/reveletonprog/.historique')), sha256(path.join(b.racine, 'srv/reveletonprog/.historique')));
  });
});

describe('ops/sauvegarder-config.sh : chemins absents, rotation, refus', () => {
  it('liste un chemin facultatif absent comme « absent <chemin> »', () => {
    const b = bancMinimal();
    const r = sauvegarder(b);
    assert.equal(r.status, 0, r.stderr);
    const j = json(r);
    assert.ok((j['absents'] as number) >= 5);
    assert.equal(j['fichiers'], 2);
    const e = path.join(b.base, 'extrait');
    extraire(path.join(b.destination, `${AUJOURDHUI}.tar.gz`), e);
    const manifeste = fs.readFileSync(path.join(e, 'MANIFESTE.txt'), 'utf8');
    assert.match(manifeste, /^absent opt\/vaultwarden\/\.env$/m);
    assert.match(manifeste, /^absent srv\/reveletonprog\/essai\/\.historique$/m);
    assert.match(fs.readFileSync(path.join(e, 'liens.txt'), 'utf8'), /^srv\/reveletonprog\/current absent$/m);
  });

  it('garde les 6 archives les plus récentes et rien d’autre n’est touché', () => {
    const b = bancMinimal();
    fs.mkdirSync(b.destination, { recursive: true, mode: 0o700 });
    for (let i = 1; i <= 8; i++) ecrire(path.join(b.destination, `2026-10-0${i}.tar.gz`), 'ancienne\n', 0o600);
    ecrire(path.join(b.destination, 'notes.txt'), 'à garder\n', 0o600);
    const r = sauvegarder(b);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(archives(b), ['2026-10-04.tar.gz', '2026-10-05.tar.gz', '2026-10-06.tar.gz', '2026-10-07.tar.gz', '2026-10-08.tar.gz', `${AUJOURDHUI}.tar.gz`]);
    assert.ok(fs.existsSync(path.join(b.destination, 'notes.txt')));
  });

  it('refuse une racine sans Caddyfile (code 1) et un argument inconnu (code 2)', () => {
    const b = bancMinimal();
    fs.rmSync(path.join(b.racine, 'opt/vaultwarden/Caddyfile'));
    assert.equal(sauvegarder(b).status, 1);
    assert.equal(lancer(b, SAUVEGARDER, ['--bavard']).status, 2);
    assert.equal(lancer(b, SAUVEGARDER, ['--racine', 'relative']).status, 2);
  });
});

describe('ops/tester-restauration.sh : restauration réussie', () => {
  const b = banc();
  const s = sauvegarder(b);
  const r = restaurer(b);

  it('archive, restauration, installateur conforme et Caddy valide : sort en 0', () => {
    assert.equal(s.status, 0, s.stderr);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const j = json(r);
    assert.equal(j['date'], AUJOURDHUI);
    assert.equal(j['archive'], `${AUJOURDHUI}.tar.gz`);
    assert.equal(j['fichiers'], ATTENDUS.length);
    assert.equal(j['hachages'], 'ok');
    assert.equal(j['installateur'], 'conforme');
    assert.equal(j['caddy'], 'valide');
  });

  it('pinge une seule fois le contrôle mensuel, en succès', () => {
    const p = lire(b, 'pings').split('\n').filter(Boolean);
    assert.equal(p.length, 1, p.join('\n'));
    assert.equal(p[0]?.split('\t')[0], PINGS.restauration);
  });

  it('passe l’adresse de ping par l’entrée standard de curl (--config -), jamais en argument (IN-01)', () => {
    const argv = lire(b, 'curl-argv');
    assert.match(argv, /--config -/);
    assert.ok(!argv.includes('hc.invalid'), 'adresse de ping dans les arguments de curl');
  });

  it('valide le Caddyfile et le sites.d restaurés (pas ceux du serveur)', () => {
    const run = lire(b, 'docker')
      .split('\n')
      .filter((l) => l.includes('caddy validate'));
    assert.ok(run.length >= 1);
    for (const l of run) {
      assert.match(l, /Caddyfile:\/etc\/caddy\/Caddyfile:ro/);
      assert.ok(l.includes(b.tmpdir), 'le Caddyfile monté doit être la copie restaurée');
      assert.ok(!l.includes(`${b.racine}/opt`), 'le Caddyfile du serveur ne doit pas être monté');
    }
  });

  it('ne laisse aucun dossier temporaire et ne touche pas au serveur', () => {
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
    assert.equal(fs.readFileSync(path.join(b.racine, 'opt/vaultwarden/.env'), 'utf8').startsWith(ENV_AUTRE), true);
  });

  it('archive ancienne et fichier modifié depuis : signalé, sans échec', () => {
    const b2 = banc();
    assert.equal(sauvegarder(b2, { RTP_DATE: '2026-10-01' }).status, 0);
    fs.appendFileSync(path.join(b2.racine, 'etc/cron.d/rtp-battement'), '# modifié\n');
    const r2 = restaurer(b2);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.match(r2.stderr, /modifié depuis la sauvegarde.*etc\/cron\.d\/rtp-battement/);
    assert.equal(json(r2)['modifies'], 1);
  });

  it('archive du jour : un déploiement (historique, lien current) après la sauvegarde ne fait pas échouer', () => {
    const b3 = banc();
    assert.equal(sauvegarder(b3).status, 0);
    fs.appendFileSync(path.join(b3.racine, 'srv/reveletonprog/essai/.historique'), `2026-11-08T22:00:00Z activer ${SHA_PROD}\n`);
    const r3 = restaurer(b3);
    assert.equal(r3.status, 0, r3.stdout + r3.stderr);
  });

  it('sans /etc/rtp/restauration.env : contrôles faits, aucun ping, code 0', () => {
    const b4 = banc({ sansRestaurationEnv: true });
    assert.equal(sauvegarder(b4).status, 0);
    const r4 = restaurer(b4);
    assert.equal(r4.status, 0, r4.stdout + r4.stderr);
    assert.equal(json(r4)['ping'], 'absent');
    assert.equal(lire(b4, 'pings'), '');
  });
});

describe("ops/tester-restauration.sh : étapes de l'installateur selon les blocs restaurés", () => {
  const FIXE = 'montages,import-caddy,commande,battement,sauvegarde';
  const etapesVues = (r: Sortie): string => {
    const m = /^\[info\] étapes de l'installateur : (\S+)$/m.exec(r.stderr);
    assert.ok(m, r.stderr);
    return m[1] as string;
  };

  it("bloc d'essai seul (avant l'ouverture) : site-essai vérifié, pas site-public", () => {
    const b = banc({ blocs: 'essai' });
    assert.equal(sauvegarder(b).status, 0);
    const r = restaurer(b);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(etapesVues(r), `${FIXE},site-essai`);
    assert.equal(json(r)['installateur'], 'conforme');
  });

  it("les deux blocs (jours de l'ouverture) : site-essai et site-public vérifiés, current recréé d'après liens.txt", () => {
    const b = banc({ blocs: 'deux' });
    assert.equal(sauvegarder(b).status, 0);
    assert.ok(entrees(path.join(b.destination, `${AUJOURDHUI}.tar.gz`)).includes('opt/vaultwarden/sites.d/reveletonprog.caddy'));
    const r = restaurer(b);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(etapesVues(r), `${FIXE},site-essai,site-public`);
    assert.equal(json(r)['caddy'], 'valide');
    assert.equal(lire(b, 'pings').split('\n').filter(Boolean).length, 1);
  });

  it("bloc public seul et chemins d'essai absents (après l'ouverture) : site-public vérifié, pas site-essai", () => {
    const b = banc({ blocs: 'public' });
    const s = sauvegarder(b);
    assert.equal(s.status, 0, s.stderr);
    const contenu = entrees(path.join(b.destination, `${AUJOURDHUI}.tar.gz`));
    assert.ok(!contenu.includes('opt/vaultwarden/sites.d/reveletonprog-essai.caddy'));
    assert.ok(!contenu.includes('srv/reveletonprog/essai/.historique'));
    const r = restaurer(b);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(etapesVues(r), `${FIXE},site-public`);
    assert.equal(json(r)['installateur'], 'conforme');
  });

  it("bloc public sans lien current dans l'archive : l'installateur refuse (étape 3), aucun ping", () => {
    const b = banc({ blocs: 'public' });
    fs.rmSync(path.join(b.racine, 'srv/reveletonprog/current'));
    assert.equal(sauvegarder(b).status, 0);
    const r = restaurer(b);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(json(r)['etape'], 'installateur');
    assert.equal(lire(b, 'pings'), '');
  });

  it('aucun bloc du site : échec à l’étape blocs, aucun ping', () => {
    const b = banc({ blocs: 'aucun' });
    assert.equal(sauvegarder(b).status, 0);
    const r = restaurer(b);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const j = json(r);
    assert.equal(j['resultat'], 'echec');
    assert.equal(j['etape'], 'blocs');
    assert.equal(lire(b, 'pings'), '');
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
  });
});

describe('ops/tester-restauration.sh : échecs, aucun ping', () => {
  function echecAttendu(b: Banc, r: Sortie, etape: string): void {
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const j = json(r);
    assert.equal(j['resultat'], 'echec');
    assert.equal(j['etape'], etape);
    assert.equal(lire(b, 'pings'), '', 'aucun ping en cas d’échec');
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
  }

  it('aucune archive : échec à l’étape archive', () => {
    const b = banc();
    echecAttendu(b, restaurer(b), 'archive');
  });

  it('fichier de l’archive corrompu : échec à l’étape 1 (hachages)', () => {
    const b = banc();
    sauvegarder(b);
    const archive = path.join(b.destination, `${AUJOURDHUI}.tar.gz`);
    const d = path.join(b.base, 'corrompre');
    extraire(archive, d);
    fs.appendFileSync(path.join(d, 'opt/vaultwarden/Caddyfile'), '# altéré\n');
    reconditionner(archive, d);
    echecAttendu(b, restaurer(b), 'hachages');
  });

  it('fichier listé au manifeste mais manquant : échec à l’étape 1 (hachages)', () => {
    const b = banc();
    sauvegarder(b);
    const archive = path.join(b.destination, `${AUJOURDHUI}.tar.gz`);
    const d = path.join(b.base, 'amputer');
    extraire(archive, d);
    fs.rmSync(path.join(d, 'etc/cron.d/rtp-battement'));
    reconditionner(archive, d);
    echecAttendu(b, restaurer(b), 'hachages');
  });

  it('archive du jour et fichier du serveur modifié depuis : échec à l’étape 2 (comparaison)', () => {
    const b = banc();
    sauvegarder(b);
    fs.appendFileSync(path.join(b.racine, 'opt/vaultwarden/Caddyfile'), '# changé après la sauvegarde\n');
    echecAttendu(b, restaurer(b), 'comparaison');
  });

  it('surcharge retirée de l’archive : l’installateur trouve une action à faire (étape 3)', () => {
    const b = banc();
    sauvegarder(b);
    const archive = path.join(b.destination, `${AUJOURDHUI}.tar.gz`);
    const d = path.join(b.base, 'sans-surcharge');
    extraire(archive, d);
    const surcharge = 'opt/vaultwarden/docker-compose.override.yml';
    fs.rmSync(path.join(d, surcharge));
    const manifeste = path.join(d, 'MANIFESTE.txt');
    fs.writeFileSync(
      manifeste,
      fs
        .readFileSync(manifeste, 'utf8')
        .split('\n')
        .map((l) => (l.endsWith(`  ${surcharge}`) ? `absent ${surcharge}` : l))
        .join('\n'),
    );
    reconditionner(archive, d);
    const r = restaurer(b);
    echecAttendu(b, r, 'installateur');
    assert.match(r.stderr, /\[a faire\].*docker-compose\.override\.yml/);
  });

  it('Caddyfile restauré invalide : échec à l’étape 4 (caddy)', () => {
    const b = banc();
    sauvegarder(b);
    echecAttendu(b, restaurer(b, { STUB_CADDY: 'invalide' }), 'caddy');
  });
});

describe('scripts de sauvegarde : code', () => {
  for (const script of [SAUVEGARDER, RESTAURER]) {
    const nom = path.basename(script);
    const texte = fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : '';
    const code = texte
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');

    it(`${nom} passe bash -n`, () => {
      const r = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    });

    it(`${nom} passe shellcheck -S warning (si présent)`, (t) => {
      if (!surPath('shellcheck')) return t.skip('shellcheck absent');
      const r = spawnSync('shellcheck', ['-S', 'warning', script], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stdout + r.stderr);
    });

    it(`${nom} : en-tête avec usage et codes de sortie, français sans tiret long, pas d'eval`, () => {
      assert.match(texte, /^#!\/usr\/bin\/env bash\n/);
      assert.match(texte, /set -euo pipefail/);
      assert.match(texte, /Usage/);
      assert.match(texte, /Codes de sortie/);
      assert.doesNotMatch(texte, /[–—]/);
      assert.doesNotMatch(code, /\beval\b|\bset -x\b/);
      assert.doesNotMatch(code, /(echo|printf)[^\n]*\$\{?HC_/);
    });
  }

  it("sauvegarder-config.sh ne prend que les clés d'hôte publiques et dit que l'archive est tirée par le Mac", () => {
    const texte = fs.existsSync(SAUVEGARDER) ? fs.readFileSync(SAUVEGARDER, 'utf8') : '';
    assert.match(texte, /ssh_host_\*_key\.pub/);
    assert.match(texte, /Vaultwarden/);
    assert.match(texte, /Mac/);
  });

  it('tester-restauration.sh appelle le vrai installateur en vérification et valider-caddy.sh', () => {
    const texte = fs.existsSync(RESTAURER) ? fs.readFileSync(RESTAURER, 'utf8') : '';
    assert.match(texte, /--verifier/);
    assert.match(texte, /'montages,import-caddy,commande,battement,sauvegarde'/);
    assert.match(texte, /sites\.d\/reveletonprog-essai\.caddy/);
    assert.match(texte, /sites\.d\/reveletonprog\.caddy/);
    assert.doesNotMatch(texte, /ETAPES_INSTALLATEUR='montages,import-caddy,commande,battement,sauvegarde,site-essai'/);
    assert.match(texte, /valider-caddy\.sh/);
    assert.match(texte, /tar -xpzf/);
  });
});
