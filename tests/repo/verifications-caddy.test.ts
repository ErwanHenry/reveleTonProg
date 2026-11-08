// HEB-01 (08-02, D-04, D-05) : les deux vérifications en lecture seule qui encadrent chaque changement Caddy.
// - ops/valider-caddy.sh : « caddy validate » dans un conteneur jetable (sans réseau, racine en lecture seule) de la
//   même image que le conteneur en service, avec ou sans les variables d'empreinte ; ne modifie rien sur la machine.
// - ops/verifier-sites.sh : code HTTP de chaque site servi, sous une empreinte du nom d'hôte (aucun nom affiché), et
//   comparaison de deux instantanés.
// Les cas lancent les scripts avec bash et des remplaçants de docker et curl en tête de PATH. Noms d'hôte
// synthétiques en *.exemple.test ; aucun nom d'un site du serveur ni contenu de son Caddyfile ici.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HASH_FACTICE } from '../../scripts/render-caddy.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VALIDER = path.join(ROOT, 'ops/valider-caddy.sh');
const VERIFIER = path.join(ROOT, 'ops/verifier-sites.sh');
const IMAGE = `sha256:${'0123456789abcdef'.repeat(4)}`;
const IMPORT = 'import /etc/caddy/sites.d/*.caddy';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-verif-caddy-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function surPath(commande: string): boolean {
  return spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' }).status === 0;
}

function stub(dossier: string, nom: string, lignes: string[]): void {
  fs.writeFileSync(path.join(dossier, nom), `${lignes.join('\n')}\n`, { mode: 0o755 });
}

/** Code seulement : commentaires (en début de ligne ou après une espace) et lignes vides retirés. */
function codeDe(fichier: string): string {
  return fs
    .readFileSync(fichier, 'utf8')
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, ''))
    .filter((l) => l.trim() !== '')
    .join('\n');
}

function redirections(code: string): string[] {
  return code.match(/\d?>>?\s*[^\s&|)]+/g) ?? [];
}

// ---------------------------------------------------------------------------------------------------------------
// valider-caddy.sh

interface BancValider {
  dossier: string;
  stubs: string;
  appels: string;
  tmpdir: string;
  caddyfile: string;
  sitesD: string;
}

const CADDYFILE_SYNTHETIQUE = ['a.exemple.test {', '\trespond "a" 200', '}', ''].join('\n');

function bancValider(contenuCaddyfile = CADDYFILE_SYNTHETIQUE): BancValider {
  const dossier = fs.mkdtempSync(path.join(tmp, 'valider-'));
  const stubs = path.join(dossier, 'stubs');
  const appels = path.join(dossier, 'appels');
  const tmpdir = path.join(dossier, 'tmpdir');
  const sitesD = path.join(dossier, 'sites.d');
  for (const d of [stubs, appels, tmpdir, sitesD]) fs.mkdirSync(d);
  fs.writeFileSync(path.join(sitesD, 'autre.caddy'), 'b.exemple.test {\n\trespond "b" 200\n}\n');
  const caddyfile = path.join(dossier, 'Caddyfile');
  fs.writeFileSync(caddyfile, contenuCaddyfile);
  // docker : consigne chaque appel (argv, copie du Caddyfile et du sites.d montés), répond à inspect et run.
  stub(stubs, 'docker', [
    '#!/bin/sh',
    'd="$STUB_APPELS"',
    'n=$(( $(cat "$d/n" 2>/dev/null || echo 0) + 1 ))',
    'echo "$n" > "$d/n"',
    'for a in "$@"; do printf \'%s\\n\' "$a"; done > "$d/appel-$n.argv"',
    'case "$1" in',
    '  inspect)',
    '    if [ -n "${STUB_SANS_CONTENEUR:-}" ]; then echo "Error: No such object" >&2; exit 1; fi',
    `    echo "${IMAGE}"; exit 0 ;;`,
    '  run) ;;',
    '  *) echo "verbe docker inattendu : $1" >&2; exit 3 ;;',
    'esac',
    'avec=0; prec=""; dernier=""',
    'for a in "$@"; do',
    '  if [ "$prec" = "-v" ]; then',
    '    case "$a" in',
    '      *:/etc/caddy/Caddyfile:ro) cp "${a%:/etc/caddy/Caddyfile:ro}" "$d/appel-$n.caddyfile" ;;',
    '      *:/etc/caddy/sites.d:ro) mkdir "$d/appel-$n.sites"; cp -R "${a%:/etc/caddy/sites.d:ro}/." "$d/appel-$n.sites/" ;;',
    '    esac',
    '  fi',
    '  case "$a" in RTP_ESSAI_HASH=*) avec=1 ;; esac',
    '  prec=$a; dernier=$a',
    'done',
    'if [ "$dernier" = version ]; then echo "v2.11.2 h1:factice"; exit 0; fi',
    'echo \'{"level":"info","ts":1,"msg":"using config from file","file":"/etc/caddy/Caddyfile"}\' >&2',
    'if [ "$avec" = 0 ] && [ -n "${STUB_INVALIDE_SANS:-}" ]; then',
    '  echo "Error: adapting config using caddyfile: username and password cannot be empty or missing" >&2',
    '  exit 1',
    'fi',
    'echo "Valid configuration"',
  ]);
  return { dossier, stubs, appels, tmpdir, caddyfile, sitesD };
}

interface Resultat {
  status: number | null;
  stdout: string;
  stderr: string;
}

function lancerValider(b: BancValider, extra: Record<string, string> = {}): Resultat {
  const env: Record<string, string> = {
    PATH: `${b.stubs}:${process.env.PATH ?? '/usr/bin:/bin'}`,
    LC_ALL: 'C',
    TMPDIR: b.tmpdir,
    STUB_APPELS: b.appels,
    RTP_CADDYFILE: b.caddyfile,
    RTP_SITES_D: b.sitesD,
    ...extra,
  };
  const r = spawnSync('bash', [VALIDER], { env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

interface Appel {
  n: number;
  argv: string[];
}

function appels(b: BancValider): Appel[] {
  return fs
    .readdirSync(b.appels)
    .filter((f) => f.endsWith('.argv'))
    .map((f) => ({ n: Number(f.slice('appel-'.length, -'.argv'.length)), argv: fs.readFileSync(path.join(b.appels, f), 'utf8').trimEnd().split('\n') }))
    .sort((x, y) => x.n - y.n);
}

const validations = (b: BancValider): Appel[] => appels(b).filter((a) => a.argv.includes('validate'));

function montage(a: Appel, cible: string): string {
  const i = a.argv.findIndex((x, k) => k > 0 && a.argv[k - 1] === '-v' && x.endsWith(`:${cible}:ro`));
  assert.ok(i > 0, `montage ${cible}:ro attendu dans ${a.argv.join(' ')}`);
  return a.argv[i].slice(0, -`:${cible}:ro`.length);
}

describe('ops/valider-caddy.sh : code en lecture seule', () => {
  const code = codeDe(VALIDER);

  it('ne contient aucune commande qui change l’état', () => {
    const interdits: [RegExp, string][] = [
      [/\bdocker\s+(exec|restart|compose|stop|rm|rmi|pull|push|kill|start|create|cp|commit|tag|update|rename|pause|unpause|network|volume|system|image|container)\b/, 'docker qui agit'],
      [/\bcaddy\s+(reload|start|stop|run)\b/, 'caddy qui agit'],
      [/\bsed\s+-i\b/, 'sed -i'],
      [/\bmv\b/, 'mv'],
      [/\bcp\b/, 'cp'],
      [/\b(eval|sudo)\b|bash -c/, 'eval, sudo ou bash -c'],
    ];
    for (const [re, quoi] of interdits) assert.doesNotMatch(code, re, `${quoi} interdit`);
  });

  it('n’écrit que dans /dev/null ou dans son dossier mktemp', () => {
    assert.match(code, /DOSSIER=\$\(mktemp -d\)/);
    for (const r of redirections(code)) assert.match(r, /^\d?>>?\s*(\/dev\/null|"\$DOSSIER\/[^"]*")$/, `redirection interdite : ${r}`);
  });

  it('lance un conteneur sans réseau, racine en lecture seule, montages en lecture seule', () => {
    assert.match(code, /docker run --rm --network none --read-only/);
    for (const t of ['/tmp', '/data', '/config', '/var/log/caddy']) assert.match(code, new RegExp(`--tmpfs ${t.replaceAll('/', '\\/')}\\b`));
    assert.match(code, /:\/etc\/caddy\/Caddyfile:ro"/);
    assert.match(code, /:\/etc\/caddy\/sites\.d:ro"/);
    assert.match(code, /docker inspect "\$CONTENEUR" --format '\{\{\.Image\}\}'/);
  });

  it('passe bash -n et shellcheck -S warning (si présent)', (t) => {
    const n = spawnSync('bash', ['-n', VALIDER], { encoding: 'utf8' });
    assert.equal(n.status, 0, n.stderr);
    if (!surPath('shellcheck')) return t.skip('shellcheck absent');
    const r = spawnSync('shellcheck', ['-S', 'warning', VALIDER], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

describe('ops/valider-caddy.sh : exécution avec un docker factice', () => {
  it('valide avec puis sans les variables d’empreinte (RTP_AVEC_SANS_VARIABLES=1)', () => {
    const b = bancValider();
    const r = lancerValider(b, { RTP_AVEC_SANS_VARIABLES: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^caddy v2\.11\.2$/m);
    assert.match(r.stdout, /^validation avec variables : valide$/m);
    assert.match(r.stdout, /^validation sans variables : valide$/m);
    assert.doesNotMatch(r.stdout + r.stderr, /"level":"info"/, 'journal de Caddy filtré');
    const inspect = appels(b).find((a) => a.argv[0] === 'inspect');
    assert.deepEqual(inspect?.argv, ['inspect', 'caddy', '--format', '{{.Image}}']);
    const v = validations(b);
    assert.equal(v.length, 2);
    for (const a of v) {
      assert.deepEqual(a.argv.slice(0, 4), ['run', '--rm', '--network', 'none']);
      assert.ok(a.argv.includes('--read-only'));
      assert.ok(a.argv.includes(IMAGE), 'même image que le conteneur en service');
      assert.deepEqual(a.argv.slice(-6), ['caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']);
      assert.equal(montage(a, '/etc/caddy/Caddyfile'), b.caddyfile, 'Caddyfile en service monté tel quel');
      assert.equal(montage(a, '/etc/caddy/sites.d'), b.sitesD, 'sites.d en service monté tel quel');
    }
    assert.ok(v[0].argv.includes(`RTP_ESSAI_HASH=${HASH_FACTICE}`));
    assert.ok(v[0].argv.includes(`RTP_SONDE_HASH=${HASH_FACTICE}`));
    assert.ok(!v[1].argv.some((x) => x.startsWith('RTP_ESSAI_HASH') || x.startsWith('RTP_SONDE_HASH')), 'second passage sans variables');
    assert.deepEqual(fs.readdirSync(b.tmpdir), [], 'dossier temporaire retiré');
  });

  it('valide une seule fois, avec les variables, par défaut', () => {
    const b = bancValider();
    const r = lancerValider(b);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(validations(b).length, 1);
    assert.match(r.stdout, /^validation avec variables : valide$/m);
    assert.doesNotMatch(r.stdout, /sans variables/);
  });

  it('échoue (code 1) si un passage est invalide et montre l’erreur', () => {
    const b = bancValider();
    const r = lancerValider(b, { RTP_AVEC_SANS_VARIABLES: '1', STUB_INVALIDE_SANS: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^validation avec variables : valide$/m);
    assert.match(r.stdout, /^validation sans variables : invalide$/m);
    assert.match(r.stdout, /username and password cannot be empty/);
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
  });

  it('RTP_BLOC_B64 : monte un sites.d temporaire qui ne contient que le bloc candidat', () => {
    const b = bancValider();
    const bloc = 'essai.exemple.test {\n\trespond "essai" 200\n}\n';
    const r = lancerValider(b, { RTP_BLOC_B64: Buffer.from(bloc).toString('base64') });
    assert.equal(r.status, 0, r.stderr);
    const [a] = validations(b);
    assert.notEqual(montage(a, '/etc/caddy/sites.d'), b.sitesD);
    const copie = path.join(b.appels, `appel-${a.n}.sites`);
    assert.deepEqual(fs.readdirSync(copie), ['reveletonprog-essai.caddy']);
    assert.equal(fs.readFileSync(path.join(copie, 'reveletonprog-essai.caddy'), 'utf8'), bloc);
    assert.equal(fs.existsSync(montage(a, '/etc/caddy/sites.d')), false, 'dossier du bloc retiré à la sortie');
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
  });

  it('RTP_AJOUTER_IMPORT=1 : valide une copie terminée par la ligne import, le Caddyfile en service ne bouge pas', () => {
    const b = bancValider();
    const avant = fs.readFileSync(b.caddyfile);
    const r = lancerValider(b, { RTP_AJOUTER_IMPORT: '1', RTP_AVEC_SANS_VARIABLES: '1' });
    assert.equal(r.status, 0, r.stderr);
    const v = validations(b);
    assert.equal(v.length, 2);
    for (const a of v) {
      assert.notEqual(montage(a, '/etc/caddy/Caddyfile'), b.caddyfile, 'une copie est montée');
      assert.equal(fs.readFileSync(path.join(b.appels, `appel-${a.n}.caddyfile`), 'utf8'), `${CADDYFILE_SYNTHETIQUE}${IMPORT}\n`);
      assert.equal(fs.existsSync(montage(a, '/etc/caddy/Caddyfile')), false, 'copie retirée à la sortie');
    }
    assert.ok(fs.readFileSync(b.caddyfile).equals(avant), 'Caddyfile en service identique octet par octet');
    assert.deepEqual(fs.readdirSync(b.tmpdir), []);
  });

  it('RTP_AJOUTER_IMPORT=1 : ajoute un retour à la ligne manquant et ne double pas une ligne déjà présente', () => {
    const sansFin = bancValider('a.exemple.test {\n}');
    assert.equal(lancerValider(sansFin, { RTP_AJOUTER_IMPORT: '1' }).status, 0);
    const [a] = validations(sansFin);
    assert.equal(fs.readFileSync(path.join(sansFin.appels, `appel-${a.n}.caddyfile`), 'utf8'), `a.exemple.test {\n}\n${IMPORT}\n`);

    const deja = bancValider(`${CADDYFILE_SYNTHETIQUE}${IMPORT}\n`);
    assert.equal(lancerValider(deja, { RTP_AJOUTER_IMPORT: '1' }).status, 0);
    const [c] = validations(deja);
    assert.equal(fs.readFileSync(path.join(deja.appels, `appel-${c.n}.caddyfile`), 'utf8'), `${CADDYFILE_SYNTHETIQUE}${IMPORT}\n`);
  });

  it('sites.d absent : monte un dossier vide temporaire sans créer le dossier en service', () => {
    const b = bancValider();
    const absent = path.join(b.dossier, 'pas-de-sites.d');
    const r = lancerValider(b, { RTP_SITES_D: absent });
    assert.equal(r.status, 0, r.stderr);
    const [a] = validations(b);
    assert.notEqual(montage(a, '/etc/caddy/sites.d'), absent);
    assert.deepEqual(fs.readdirSync(path.join(b.appels, `appel-${a.n}.sites`)), []);
    assert.equal(fs.existsSync(absent), false);
  });

  const mauvais: [string, Record<string, string>][] = [
    ['conteneur caddy absent', { STUB_SANS_CONTENEUR: '1' }],
    ['Caddyfile absent', { RTP_CADDYFILE: '/nexiste/pas/Caddyfile' }],
    ['Caddyfile relatif', { RTP_CADDYFILE: 'Caddyfile' }],
    ['bloc base64 invalide', { RTP_BLOC_B64: 'pas du base64 !' }],
    ['RTP_AJOUTER_IMPORT hors 0/1', { RTP_AJOUTER_IMPORT: 'oui' }],
    ['RTP_AVEC_SANS_VARIABLES hors 0/1', { RTP_AVEC_SANS_VARIABLES: '2' }],
    ['nom de conteneur invalide', { RTP_CONTENEUR: 'caddy;id' }],
  ];
  for (const [nom, env] of mauvais) {
    it(`refuse : ${nom} (code 2, aucune validation lancée)`, () => {
      const b = bancValider();
      const r = lancerValider(b, env);
      assert.equal(r.status, 2, `${nom} : ${r.stderr}`);
      assert.equal(validations(b).length, 0);
      assert.deepEqual(fs.readdirSync(b.tmpdir), []);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// verifier-sites.sh

const empreinte = (h: string): string => crypto.createHash('sha256').update(h).digest('hex').slice(0, 12);

interface BancSites {
  dossier: string;
  stubs: string;
  caddyfile: string;
  sitesD: string;
  journalCurl: string;
}

const CODES: Record<string, string> = {
  'a.exemple.test': '200',
  'b.exemple.test': '401',
  'c.exemple.test': '000',
  'd.exemple.test': '302',
  'e.exemple.test': '503',
  'f.exemple.test': '200',
};

function bancSites(): BancSites {
  const dossier = fs.mkdtempSync(path.join(tmp, 'sites-'));
  const stubs = path.join(dossier, 'stubs');
  const sitesD = path.join(dossier, 'sites.d');
  fs.mkdirSync(stubs);
  fs.mkdirSync(sitesD);
  const caddyfile = path.join(dossier, 'Caddyfile');
  fs.writeFileSync(
    caddyfile,
    [
      '# Commentaire : z.exemple.test ne compte pas',
      '(entetes) {',
      '\theader -Server',
      '}',
      '',
      'a.exemple.test {',
      '\timport entetes',
      '\treverse_proxy 127.0.0.1:8000 # y.exemple.test non plus',
      '}',
      '',
      ':8080 {',
      '\trespond "ok"',
      '}',
      '',
      'http://h.exemple.test {',
      '\tredir https://a.exemple.test{uri}',
      '}',
      '',
      'https://F.exemple.test {',
      '\trespond "{http.request.host}" 200',
      '}',
      '',
      'g.exemple.test:8443 {',
      '\trespond "g"',
      '}',
      '',
      IMPORT,
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(sitesD, 'un.caddy'),
    ['b.exemple.test, c.exemple.test {', '\trespond "bc" 200', '}', '*.exemple.test {', '\ttls internal', '}', ''].join('\n'),
  );
  fs.writeFileSync(path.join(sitesD, 'deux.caddy'), ['d.exemple.test,', '\te.exemple.test {', '\tfile_server', '}', ''].join('\n'));
  fs.writeFileSync(path.join(sitesD, 'ignore.txt'), 'x.exemple.test {\n}\n');
  const journalCurl = path.join(dossier, 'curl.txt');
  // curl : code tiré de STUB_CODES selon l'hôte de --resolve ; 000 et code 7 comme un refus de connexion.
  stub(stubs, 'curl', [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$STUB_CURL"',
    'hote=""; prec=""',
    'for a in "$@"; do if [ "$prec" = "--resolve" ]; then hote=${a%%:*}; fi; prec=$a; done',
    'code=$(printf \'%s\\n\' $STUB_CODES | awk -F= -v h="$hote" \'$1 == h { print $2 }\')',
    '[ -n "$code" ] || code=000',
    'printf \'%s\' "$code"',
    'if [ "$code" = 000 ]; then exit 7; fi',
  ]);
  return { dossier, stubs, caddyfile, sitesD, journalCurl };
}

function lancerVerifier(args: string[], env: Record<string, string> = {}, stubs?: string): Resultat {
  const r = spawnSync('bash', [VERIFIER, ...args], {
    env: { PATH: `${stubs ? `${stubs}:` : ''}${process.env.PATH ?? '/usr/bin:/bin'}`, LC_ALL: 'C', ...env },
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('ops/verifier-sites.sh instantane', () => {
  it('donne empreinte et code de chaque site, sans aucun nom d’hôte', () => {
    const b = bancSites();
    const r = lancerVerifier(
      ['instantane'],
      {
        RTP_CADDYFILE: b.caddyfile,
        RTP_SITES_D: b.sitesD,
        STUB_CURL: b.journalCurl,
        STUB_CODES: Object.entries(CODES)
          .map(([h, c]) => `${h}=${c}`)
          .join(' '),
      },
      b.stubs,
    );
    assert.equal(r.status, 0, r.stderr);
    const attendu = Object.entries(CODES)
      .map(([h, c]) => `${empreinte(h)}\t${c}`)
      .sort();
    assert.deepEqual(r.stdout.trimEnd().split('\n'), attendu);
    assert.equal(r.stderr.trim(), '6 sites, 4 joignables (2xx, 3xx, 401), 4 ignorés');
    assert.doesNotMatch(r.stdout + r.stderr, /exemple\.test/i, 'aucun nom d’hôte dans la sortie');
    const curl = fs.readFileSync(b.journalCurl, 'utf8');
    assert.match(curl, /^-s -o \/dev\/null -m 10 -w %\{http_code\} --resolve a\.exemple\.test:443:127\.0\.0\.1 https:\/\/a\.exemple\.test\/$/m);
    assert.match(curl, /--resolve f\.exemple\.test:443:127\.0\.0\.1 https:\/\/f\.exemple\.test\//, 'hôte en minuscules, préfixe https:// retiré');
    for (const h of ['z', 'y', 'h', 'g', 'x']) assert.doesNotMatch(curl, new RegExp(`${h}\\.exemple\\.test:443`), `${h} ne doit pas être interrogé`);
  });

  it('mode par défaut sans argument et Caddyfile seul quand sites.d est absent', () => {
    const b = bancSites();
    const r = lancerVerifier([], { RTP_CADDYFILE: b.caddyfile, RTP_SITES_D: path.join(b.dossier, 'absent'), STUB_CURL: b.journalCurl, STUB_CODES: 'a.exemple.test=200' }, b.stubs);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr.trim(), '2 sites, 1 joignables (2xx, 3xx, 401), 3 ignorés');
  });

  it('refuse un Caddyfile illisible (code 2)', () => {
    const b = bancSites();
    const r = lancerVerifier(['instantane'], { RTP_CADDYFILE: path.join(b.dossier, 'absent'), STUB_CURL: b.journalCurl }, b.stubs);
    assert.equal(r.status, 2);
    assert.equal(fs.existsSync(b.journalCurl), false);
  });
});

describe('ops/verifier-sites.sh comparer', () => {
  const dossier = fs.mkdtempSync(path.join(tmp, 'comparer-'));
  const ecrire = (nom: string, lignes: [string, string][]): string => {
    const p = path.join(dossier, nom);
    fs.writeFileSync(p, lignes.map(([h, c]) => `${empreinte(h)}\t${c}\n`).join(''));
    return p;
  };
  const base: [string, string][] = [
    ['a.exemple.test', '200'],
    ['b.exemple.test', '401'],
    ['c.exemple.test', '000'],
  ];
  const avant = ecrire('avant.tsv', base);

  it('identiques : code 0', () => {
    const r = lancerVerifier(['comparer', avant, ecrire('pareil.tsv', [...base].reverse())]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'identiques 3, differents 0, nouveaux 0, disparus 0\n');
  });

  it('un code différent : code 1', () => {
    const r = lancerVerifier(['comparer', avant, ecrire('diff.tsv', [['a.exemple.test', '502'], base[1], base[2]])]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, 'identiques 2, differents 1, nouveaux 0, disparus 0\n');
  });

  it('un nouvel hôte (l’hôte technique) : code 0', () => {
    const r = lancerVerifier(['comparer', avant, ecrire('nouveau.tsv', [...base, ['essai.exemple.test', '401']])]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'identiques 3, differents 0, nouveaux 1, disparus 0\n');
  });

  it('un hôte disparu : code 1', () => {
    const r = lancerVerifier(['comparer', avant, ecrire('disparu.tsv', [base[0], base[1]])]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, 'identiques 2, differents 0, nouveaux 0, disparus 1\n');
  });

  it('refuse une ligne mal formée, un fichier absent ou un mode inconnu (code 2)', () => {
    const mal = path.join(dossier, 'mal.tsv');
    fs.writeFileSync(mal, 'a.exemple.test 200\n');
    assert.equal(lancerVerifier(['comparer', avant, mal]).status, 2);
    assert.equal(lancerVerifier(['comparer', avant, path.join(dossier, 'absent.tsv')]).status, 2);
    assert.equal(lancerVerifier(['comparer', avant]).status, 2);
    assert.equal(lancerVerifier(['autre']).status, 2);
  });
});

describe('ops/verifier-sites.sh : code en lecture seule', () => {
  const code = codeDe(VERIFIER);

  it('ne modifie rien : aucune commande d’écriture, sorties vers /dev/null seulement', () => {
    assert.doesNotMatch(code, /\b(rm|mv|cp|tee|mkdir|touch|ln|chmod|chown|docker|eval|sudo)\b|sed\s+-i|bash -c/);
    for (const r of redirections(code)) assert.match(r, /^\d?>>?\s*\/dev\/null$/, `redirection interdite : ${r}`);
  });

  it('interroge chaque site en local par --resolve sur 443', () => {
    assert.match(code, /curl -s -o \/dev\/null -m 10 -w '%\{http_code\}' --resolve "\$h:443:127\.0\.0\.1" "https:\/\/\$h\/"/);
  });

  it('passe bash -n et shellcheck -S warning (si présent)', (t) => {
    const n = spawnSync('bash', ['-n', VERIFIER], { encoding: 'utf8' });
    assert.equal(n.status, 0, n.stderr);
    if (!surPath('shellcheck')) return t.skip('shellcheck absent');
    const r = spawnSync('shellcheck', ['-S', 'warning', VERIFIER], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});
