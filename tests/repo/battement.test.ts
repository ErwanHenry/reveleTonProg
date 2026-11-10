// OPS-01, OPS-02 (08-07, D-14) : battement de cœur du serveur (ops/battement.sh, installé en
// /usr/local/sbin/rtp-battement). Chaque cas écrit un fichier d'environnement temporaire avec des adresses de ping
// factices (https://hc.invalid/<uuid>, construites à l'exécution), place des remplaçants en tête de PATH et lance
// le script avec bash :
// - df : table POSIX (-P) dont le taux d'occupation de chaque point de montage vient de STUB_DF (« /:58 /v:40 ») ;
// - docker : « inspect » répond STUB_DOCKER (true par défaut), ou échoue si STUB_DOCKER=absent ;
// - openssl : « s_client » imprime un faux certificat, « x509 » sort en STUB_CHECKEND (0 par défaut) ; les deux
//   consignent leurs arguments ;
// - curl : consigne ses arguments (et la configuration lue sur l'entrée standard avec --config -) ; une adresse
//   hc.invalid est un ping (adresse et corps consignés), sinon il répond une version.json ou une page d'accueil
//   factices selon le chemin, ou échoue (STUB_HTTP=ko) ;
// - logger : consigne ses arguments ;
// - timeout : consigne ses arguments puis lance la commande, ou simule son expiration (code 124, commande non lancée)
//   quand le nom de la commande figure dans STUB_TIMEOUT_EXPIRE.
// Aucune sortie ne doit contenir hc.invalid, l'utilisateur ou le mot de passe factices de la sonde.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'ops/battement.sh');
const DARWIN = process.platform === 'darwin';

function surPath(commande: string): boolean {
  return spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' }).status === 0;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-battement-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const ping = (): string => ['https:/', '/hc.invalid/', crypto.randomUUID()].join('');
const URLS = { battement: ping(), d85: ping(), d92: ping(), cert: ping() };
const SONDE_USER = `sonde-${crypto.randomBytes(4).toString('hex')}`;
const SONDE_PASS = `mdp-${crypto.randomBytes(12).toString('base64url')}`;
const HOTE = 'essai.exemple.fr';
const COMMIT = 'a'.repeat(20) + '0123456789abcdef0123';

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
  env: string;
  stubs: string;
  journal: string;
}

function banc(options: { avecHote?: boolean; sansCle?: string; lignesEnPlus?: string[]; sansVersion?: boolean; commit?: string } = {}): Banc {
  const dossier = fs.mkdtempSync(path.join(tmp, 'cas-'));
  const base = path.join(dossier, 'srv');
  const stubs = path.join(dossier, 'stubs');
  const journal = path.join(dossier, 'journal');
  fs.mkdirSync(stubs, { recursive: true });
  fs.mkdirSync(journal, { recursive: true });

  if (!options.sansVersion) {
    ecrire(path.join(base, 'essai/releases', COMMIT, 'version.json'), `{"commit":"${options.commit ?? COMMIT}","date":"2026-11-08T20:00:00Z"}\n`);
    fs.symlinkSync(path.join('releases', COMMIT), path.join(base, 'essai/current'));
  }

  const lignes = [
    `HC_BATTEMENT=${URLS.battement}`,
    `HC_DISQUE85=${URLS.d85}`,
    `HC_DISQUE92=${URLS.d92}`,
    `HC_CERT=${URLS.cert}`,
    ...(options.avecHote ? [`RTP_HOTE=${HOTE}`, `RTP_SONDE_USER=${SONDE_USER}`, `RTP_SONDE_PASS=${SONDE_PASS}`] : []),
    ...(options.lignesEnPlus ?? []),
  ].filter((l) => !options.sansCle || !l.startsWith(`${options.sansCle}=`));
  const env = path.join(dossier, 'battement.env');
  ecrire(env, `# fichier factice\n${lignes.join('\n')}\n`, 0o600);

  stub(stubs, 'df', [
    '#!/bin/sh',
    '[ "${STUB_DF_ECHEC:-0}" = 1 ] && exit 1',
    'm=""; for a in "$@"; do m=$a; done',
    'pct=58',
    'for paire in ${STUB_DF:-}; do case "$paire" in "$m:"*) pct=${paire#"$m:"} ;; esac; done',
    'echo "Filesystem 1024-blocks Used Available Capacity Mounted on"',
    'echo "/dev/factice 40000000 20000000 18000000 ${pct}% $m"',
  ]);
  stub(stubs, 'docker', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/docker"',
    'case "${STUB_DOCKER:-true}" in absent) echo "Error: No such object" >&2; exit 1 ;; esac',
    'echo "${STUB_DOCKER:-true}"',
  ]);
  stub(stubs, 'openssl', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/openssl"',
    'case "$1" in',
    '  s_client) cat > /dev/null; echo "-----BEGIN CERTIFICATE-----"; echo "Y2VydGlmaWNhdCBmYWN0aWNl"; echo "-----END CERTIFICATE-----" ;;',
    '  x509) cat > /dev/null; exit "${STUB_CHECKEND:-0}" ;;',
    'esac',
  ]);
  stub(stubs, 'curl', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/curl"',
    'url=""; corps=""; prec=""; config=0',
    'for a in "$@"; do',
    '  [ "$prec" = "--data-raw" ] && corps=$a',
    '  [ "$prec" = "--config" ] && [ "$a" = "-" ] && config=1',
    '  case "$a" in https://*) url=$a ;; esac',
    '  prec=$a',
    'done',
    'if [ "$config" = 1 ]; then',
    '  cfg=$(cat); printf \'%s\\n\' "$cfg" >> "$STUB_JOURNAL/curl-config"',
    '  [ -n "$url" ] || url=$(printf \'%s\\n\' "$cfg" | sed -n \'s/^url = "\\(.*\\)"$/\\1/p\')',
    'fi',
    'case "$url" in',
    '  https://hc.invalid/*) printf \'%s\\t%s\\n\' "$url" "$corps" >> "$STUB_JOURNAL/pings"; exit "${STUB_PING:-0}" ;;',
    'esac',
    '[ "${STUB_HTTP:-ok}" = ko ] && exit 22',
    'case "$url" in',
    '  */version.json) printf \'{"commit":"%s","date":"2026-11-08T20:00:00Z"}\\n\' "${STUB_COMMIT:-}" ;;',
    '  */) printf \'<!doctype html><title>%s</title>\\n\' "${STUB_MARQUEUR-reveleTonProg}" ;;',
    '  *) exit 22 ;;',
    'esac',
  ]);
  stub(stubs, 'logger', ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/logger"']);
  stub(stubs, 'timeout', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/timeout"',
    'while [ $# -gt 0 ]; do case "$1" in -k) shift 2 ;; -*) shift ;; *) break ;; esac; done',
    'shift',
    'case " ${STUB_TIMEOUT_EXPIRE:-} " in *" $1 "*) exit 124 ;; esac',
    'exec "$@"',
  ]);
  return { base, env, stubs, journal };
}

interface Sortie {
  status: number | null;
  stdout: string;
  stderr: string;
}

const SECRETS = ['hc.invalid', SONDE_USER, SONDE_PASS, ...Object.values(URLS)];

function lancer(b: Banc, env: Record<string, string> = {}): Sortie {
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${b.stubs}:${process.env['PATH'] ?? ''}`,
      STUB_JOURNAL: b.journal,
      STUB_COMMIT: COMMIT,
      RTP_ENV: b.env,
      RTP_BASE: b.base,
      ...env,
    },
  });
  const tout = `${r.stdout}${r.stderr}`;
  for (const s of SECRETS) assert.ok(!tout.includes(s), 'une adresse de ping ou un identifiant apparaît dans la sortie');
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const lire = (b: Banc, nom: string): string => {
  const f = path.join(b.journal, nom);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};

type Controle = 'battement' | 'd85' | 'd92' | 'cert';
interface Ping {
  controle: Controle;
  fail: boolean;
  corps: string;
}

function pings(b: Banc): Ping[] {
  return lire(b, 'pings')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [url = '', corps = ''] = l.split('\t');
      const fail = url.endsWith('/fail');
      const nu = fail ? url.slice(0, -'/fail'.length) : url;
      const controle = (Object.keys(URLS) as Controle[]).find((k) => URLS[k] === nu);
      assert.ok(controle, 'ping vers une adresse inconnue');
      return { controle, fail, corps };
    });
}

interface Bilan {
  site: string;
  raison?: string;
  cert: string;
  disque_max: number;
  disques: { point: string; pct: number }[];
  pings: Record<string, string>;
}

function bilan(s: Sortie): Bilan {
  const lignes = s.stdout.split('\n').filter(Boolean);
  assert.equal(lignes.length, 1, `une seule ligne attendue sur stdout : ${s.stdout}`);
  return JSON.parse(lignes[0] ?? '') as Bilan;
}

describe('ops/battement.sh : passage normal sans hôte (avant DNS)', () => {
  const b = banc();
  const r = lancer(b);

  it('sort en 0 et pinge battement, disque 85 et disque 92 en succès, jamais le certificat', () => {
    assert.equal(r.status, 0, r.stderr);
    const p = pings(b);
    assert.deepEqual(
      p.map((x) => `${x.controle}${x.fail ? '/fail' : ''}`),
      ['battement', 'd85', 'd92'],
    );
    assert.match(p[1]?.corps ?? '', /\/ 58%/);
  });

  it('lit la version déployée sur le disque, sans HTTP ni openssl', () => {
    assert.equal(lire(b, 'openssl'), '');
    assert.ok(!lire(b, 'curl').includes('--resolve'));
    assert.match(lire(b, 'docker'), /inspect -f \{\{\.State\.Running\}\} caddy/);
  });

  it('imprime une ligne JSON : site ok, certificat ignoré, taux par disque', () => {
    const j = bilan(r);
    assert.equal(j.site, 'ok');
    assert.equal(j.cert, 'ignore');
    assert.deepEqual(j.disques, [{ point: '/', pct: 58 }]);
    assert.equal(j.disque_max, 58);
    assert.equal(j.pings['vps-battement'], 'ok');
    assert.equal(j.pings['vps-certificat'], 'aucun');
  });

  it("n'appelle pas logger quand la sortie n'est pas un terminal (la ligne cron passe déjà par logger)", () => {
    assert.equal(lire(b, 'logger'), '');
  });
});

describe('ops/battement.sh : passage normal avec hôte (après DNS)', () => {
  const b = banc({ avecHote: true });
  const r = lancer(b);

  it('vérifie le contenu par Caddy en HTTPS, identifiants par --config -', () => {
    assert.equal(r.status, 0, r.stderr);
    const appels = lire(b, 'curl').split('\n').filter((l) => l.includes('--resolve'));
    assert.equal(appels.length, 2, appels.join('\n'));
    for (const a of appels) {
      assert.match(a, new RegExp(`--resolve ${HOTE}:443:127\\.0\\.0\\.1`));
      assert.match(a, /--config -/);
    }
    assert.ok(appels.some((a) => a.includes(`https://${HOTE}/version.json`)));
    assert.ok(appels.some((a) => a.endsWith(`https://${HOTE}/`)));
    assert.ok(!lire(b, 'curl').includes(SONDE_PASS), 'mot de passe dans les arguments de curl');
    assert.ok(lire(b, 'curl-config').includes(`user = "${SONDE_USER}:${SONDE_PASS}"`));
  });

  it('vérifie le certificat par s_client sur 127.0.0.1:443 avec SNI et -checkend 14 jours', () => {
    const o = lire(b, 'openssl');
    assert.match(o, new RegExp(`s_client .*-connect 127\\.0\\.0\\.1:443 .*-servername ${HOTE}`));
    assert.match(o, /x509 -noout -checkend 1209600/);
  });

  it('pinge les quatre contrôles en succès, dans un ordre fixe', () => {
    assert.deepEqual(
      pings(b).map((x) => `${x.controle}${x.fail ? '/fail' : ''}`),
      ['battement', 'd85', 'd92', 'cert'],
    );
    const j = bilan(r);
    assert.equal(j.site, 'ok');
    assert.equal(j.cert, 'ok');
  });
});

describe('ops/battement.sh : site en panne, aucun battement', () => {
  const cas: [string, Parameters<typeof banc>[0], Record<string, string>, RegExp][] = [
    ['conteneur arrêté', {}, { STUB_DOCKER: 'false' }, /conteneur/],
    ['conteneur introuvable', {}, { STUB_DOCKER: 'absent' }, /conteneur/],
    ['version.json absent', { sansVersion: true }, {}, /version/],
    ['commit invalide sur le disque', { commit: 'dev' }, {}, /commit/],
    ['HTTP en échec', { avecHote: true }, { STUB_HTTP: 'ko' }, /version|HTTP/],
    ['commit invalide en HTTP', { avecHote: true }, { STUB_COMMIT: 'abc' }, /commit/],
    ['marqueur absent de la page', { avecHote: true }, { STUB_MARQUEUR: 'autre site' }, /marqueur/],
  ];
  for (const [nom, options, env, raison] of cas) {
    it(`${nom} : pas de ping battement, disques (et certificat) quand même`, () => {
      const b = banc(options);
      const r = lancer(b, env);
      assert.equal(r.status, 0, r.stderr);
      const p = pings(b);
      assert.ok(!p.some((x) => x.controle === 'battement'), 'battement pingé malgré la panne');
      assert.deepEqual(
        p.filter((x) => x.controle === 'd85' || x.controle === 'd92').map((x) => x.fail),
        [false, false],
      );
      if (options?.avecHote) assert.ok(p.some((x) => x.controle === 'cert'));
      const j = bilan(r);
      assert.equal(j.site, 'ko');
      assert.match(j.raison ?? '', raison);
      assert.equal(j.pings['vps-battement'], 'aucun');
    });
  }
});

describe('ops/battement.sh : seuils de disque et certificat', () => {
  it('RTP_SEUIL1=1 envoie /fail au contrôle 85 avec le point de montage et le taux', () => {
    const b = banc();
    const r = lancer(b, { RTP_SEUIL1: '1' });
    assert.equal(r.status, 0, r.stderr);
    const p = pings(b);
    const d85 = p.find((x) => x.controle === 'd85');
    assert.equal(d85?.fail, true);
    assert.match(d85?.corps ?? '', /disque \/ 58%/);
    assert.equal(p.find((x) => x.controle === 'd92')?.fail, false);
    assert.equal(p.find((x) => x.controle === 'battement')?.fail, false);
  });

  it('RTP_SEUIL2=1 envoie /fail au contrôle 92', () => {
    const b = banc();
    lancer(b, { RTP_SEUIL2: '1' });
    const p = pings(b);
    assert.equal(p.find((x) => x.controle === 'd92')?.fail, true);
    assert.equal(p.find((x) => x.controle === 'd85')?.fail, false);
  });

  it('plusieurs disques : le plus plein décide, le corps nomme chaque point de montage', () => {
    const b = banc({ lignesEnPlus: ['RTP_DISQUES="/ /mnt/volume"'] });
    const r = lancer(b, { STUB_DF: '/:58 /mnt/volume:90' });
    assert.equal(r.status, 0, r.stderr);
    const p = pings(b);
    const d85 = p.find((x) => x.controle === 'd85');
    assert.equal(d85?.fail, true);
    assert.match(d85?.corps ?? '', /\/ 58%/);
    assert.match(d85?.corps ?? '', /\/mnt\/volume 90%/);
    assert.equal(p.find((x) => x.controle === 'd92')?.fail, false);
    const j = bilan(r);
    assert.equal(j.disque_max, 90);
    assert.deepEqual(j.disques, [
      { point: '/', pct: 58 },
      { point: '/mnt/volume', pct: 90 },
    ]);
  });

  it('retour à la normale : un ping de succès au passage suivant (rétablissement)', () => {
    const b = banc();
    lancer(b, { RTP_SEUIL1: '1' });
    lancer(b);
    const d85 = pings(b).filter((x) => x.controle === 'd85');
    assert.deepEqual(
      d85.map((x) => x.fail),
      [true, false],
    );
  });

  it('df illisible : les deux contrôles de disque en /fail', () => {
    const b = banc();
    lancer(b, { STUB_DF_ECHEC: '1' });
    const p = pings(b);
    assert.equal(p.find((x) => x.controle === 'd85')?.fail, true);
    assert.equal(p.find((x) => x.controle === 'd92')?.fail, true);
  });

  it('RTP_CERT_JOURS=9999 et checkend en échec : /fail au contrôle certificat', () => {
    const b = banc({ avecHote: true });
    const r = lancer(b, { RTP_CERT_JOURS: '9999', STUB_CHECKEND: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(lire(b, 'openssl'), new RegExp(`-checkend ${9999 * 86400}`));
    const cert = pings(b).find((x) => x.controle === 'cert');
    assert.equal(cert?.fail, true);
    assert.match(cert?.corps ?? '', /9999/);
    assert.equal(bilan(r).cert, 'fail');
  });

  it("un ping en échec n'empêche pas les suivants et ne cite pas l'adresse (code 1)", () => {
    const b = banc();
    const r = lancer(b, { STUB_PING: '22' });
    assert.equal(r.status, 1);
    assert.equal(pings(b).length, 3);
    assert.match(r.stderr, /vps-battement/);
    assert.equal(bilan(r).pings['vps-disque-85'], 'echec');
  });
});

describe('ops/battement.sh : configuration refusée (code 2)', () => {
  it('fichier d’environnement absent', () => {
    const b = banc();
    const r = lancer(b, { RTP_ENV: path.join(b.base, 'absent.env') });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /absent\.env/);
    assert.equal(lire(b, 'curl'), '');
  });

  for (const cle of ['HC_BATTEMENT', 'HC_DISQUE85', 'HC_DISQUE92', 'HC_CERT']) {
    it(`variable ${cle} manquante : message qui la nomme, sans valeur`, () => {
      const b = banc({ sansCle: cle });
      const r = lancer(b);
      assert.equal(r.status, 2);
      assert.match(r.stderr, new RegExp(cle));
      assert.equal(lire(b, 'curl'), '');
    });
  }

  it('adresse de ping non https', () => {
    const b = banc({ sansCle: 'HC_CERT', lignesEnPlus: ['HC_CERT=http://exemple.invalid/x'] });
    const r = lancer(b);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /HC_CERT/);
    assert.ok(!r.stderr.includes('exemple.invalid'));
  });

  it('seuil ou durée non numériques', () => {
    const b = banc();
    const cas: Record<string, string>[] = [{ RTP_SEUIL1: 'abc' }, { RTP_SEUIL2: '0' }, { RTP_CERT_JOURS: '-1' }, { RTP_HC_SIMULATION: 'oui' }];
    for (const env of cas) {
      assert.equal(lancer(b, env).status, 2, JSON.stringify(env));
    }
    assert.equal(lire(b, 'curl'), '');
  });

  it('fichier lisible par le groupe ou les autres (Linux seulement)', (t) => {
    if (DARWIN) return t.skip('contrôle du mode ignoré sous darwin');
    const b = banc();
    fs.chmodSync(b.env, 0o644);
    const r = lancer(b);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /600|mode/);
  });
});

describe('ops/battement.sh : simulation (RTP_HC_SIMULATION=1)', () => {
  it("n'appelle jamais curl et liste le signal prévu de chaque contrôle", () => {
    const b = banc();
    const r = lancer(b, { RTP_HC_SIMULATION: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lire(b, 'curl'), '');
    for (const l of ['vps-battement: ping', 'vps-disque-85: ok', 'vps-disque-92: ok', 'vps-certificat: ignore']) {
      assert.ok(r.stdout.split('\n').includes(l), l);
    }
  });

  it('montre les alertes simulées', () => {
    const b = banc();
    const r = lancer(b, { RTP_HC_SIMULATION: '1', RTP_SEUIL1: '1', RTP_SEUIL2: '1', STUB_DOCKER: 'false' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lire(b, 'curl'), '');
    for (const l of ['vps-battement: aucun', 'vps-disque-85: fail', 'vps-disque-92: fail']) {
      assert.ok(r.stdout.split('\n').includes(l), l);
    }
  });

  it('avec hôte : certificat ok ou fail selon checkend', () => {
    const b = banc({ avecHote: true });
    const ok = lancer(b, { RTP_HC_SIMULATION: '1' });
    assert.ok(ok.stdout.split('\n').includes('vps-certificat: ok'), ok.stdout);
    const ko = lancer(b, { RTP_HC_SIMULATION: '1', STUB_CHECKEND: '1' });
    assert.ok(ko.stdout.split('\n').includes('vps-certificat: fail'), ko.stdout);
    assert.equal(lire(b, 'pings'), '');
  });
});

describe('ops/battement.sh : code', () => {
  const script = fs.existsSync(SCRIPT) ? fs.readFileSync(SCRIPT, 'utf8') : '';
  const code = script
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

  it('passe bash -n', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });

  it('passe shellcheck -S warning (si présent)', (t) => {
    if (!surPath('shellcheck')) return t.skip('shellcheck absent');
    const r = spawnSync('shellcheck', ['-S', 'warning', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it("n'imprime jamais une variable HC_, ne source pas le fichier, pas d'eval", () => {
    assert.doesNotMatch(code, /(echo|printf)[^\n]*\$\{?HC_/);
    assert.doesNotMatch(code, /\beval\b|\bset -x\b/);
    assert.doesNotMatch(code, /^\s*(source|\.)\s/m);
    assert.match(code, /checkend/);
    assert.match(code, /\/fail/);
  });

  it('a un en-tête avec usage, environnement et codes de sortie, en français sans tiret long', () => {
    assert.match(script, /^#!\/usr\/bin\/env bash\n/);
    assert.match(script, /set -euo pipefail/);
    assert.match(script, /Usage/);
    assert.match(script, /Codes de sortie/);
    for (const nom of ['vps-battement', 'vps-disque-85', 'vps-disque-92', 'vps-certificat']) assert.ok(script.includes(nom), nom);
    assert.doesNotMatch(script, /[–—]/);
    assert.ok(script.split('\n').length >= 80);
  });
});

describe('ops/battement.sh : durées bornées (WR-05)', () => {
  it('docker inspect, openssl s_client, les requêtes HTTPS et les pings passent tous par timeout -k 5', () => {
    const b = banc({ avecHote: true });
    const r = lancer(b, { STUB_COMMIT: COMMIT });
    assert.equal(r.status, 0, r.stderr);
    const appels = lire(b, 'timeout').split('\n').filter(Boolean);
    assert.ok(appels.some((l) => /^-k 5 15 docker inspect /.test(l)), appels.join('\n'));
    assert.ok(appels.some((l) => /^-k 5 15 openssl s_client /.test(l)), appels.join('\n'));
    assert.equal(appels.filter((l) => /^-k 5 15 curl .*--resolve/.test(l)).length, 2, 'version.json et accueil');
    assert.equal(appels.filter((l) => /^-k 5 60 curl /.test(l)).length, 4, 'quatre pings');
    const curl = lire(b, 'curl').split('\n').filter(Boolean);
    assert.equal(appels.filter((l) => / curl /.test(l)).length, curl.length, 'aucun curl hors de timeout');
  });

  it('docker bloqué (timeout expiré) : panne signalée, aucun battement, le passage se termine', () => {
    const b = banc();
    const r = lancer(b, { STUB_TIMEOUT_EXPIRE: 'docker' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lire(b, 'docker'), '', 'docker jamais lancé');
    const j = bilan(r);
    assert.equal(j.site, 'ko');
    assert.equal(j.pings['vps-battement'], 'aucun');
    assert.ok(!pings(b).some((x) => x.controle === 'battement'));
  });

  it('openssl bloqué (timeout expiré) : certificat en /fail, le passage se termine', () => {
    const b = banc({ avecHote: true });
    const r = lancer(b, { STUB_COMMIT: COMMIT, STUB_TIMEOUT_EXPIRE: 'openssl' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(bilan(r).cert, 'fail');
  });

  it('chaque appel externe du script est précédé de timeout (lecture du code)', () => {
    const code = fs
      .readFileSync(SCRIPT, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .map((l) => l.replace(/\s#\s.*$/, ''))
      .join('\n');
    const appels = [...code.matchAll(/\b(curl|docker|openssl s_client)\b/g)];
    assert.ok(appels.length >= 4, 'appels externes introuvables');
    for (const m of appels) {
      const avant = code.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
      assert.match(avant, /timeout -k \d+ \d+ $/, `appel sans timeout : …${avant}${m[0]}`);
    }
  });
});

describe('ops/battement.sh : adresses de ping hors de argv (IN-01)', () => {
  it('chaque ping lit son adresse sur l’entrée standard de curl (--config -), jamais en argument', () => {
    const b = banc({ avecHote: true });
    const r = lancer(b, { STUB_COMMIT: COMMIT });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(pings(b).length, 4);
    const argv = lire(b, 'curl');
    assert.ok(!argv.includes('hc.invalid'), 'adresse de ping dans les arguments de curl');
    for (const u of Object.values(URLS)) assert.ok(lire(b, 'curl-config').includes(`url = "${u}`), 'adresse absente de la configuration');
  });
});
