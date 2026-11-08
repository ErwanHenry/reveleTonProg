// HEB-02, HEB-10, HEB-11 (08-02, D-09) : commande forcée de la clé de déploiement (ops/commande-deploiement.sh).
// Chaque cas lance le script avec bash dans une racine temporaire (RTP_BASE) et des remplaçants placés en tête de
// PATH : df (espace libre et taux d'occupation lus dans l'environnement du cas), logger (consigne ses arguments),
// rrsync (RTP_RRSYNC, consigne argv et SSH_ORIGINAL_COMMAND) ; sous macOS aussi flock (saute le verrou) et mv
// (GNU mv de coreutils, « gmv », pour « mv -T »). Sans gmv sous macOS, les cas de bascule sont sautés ; la CI Linux
// (ubuntu-24.04, GNU mv et util-linux flock réels) les joue tous.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'ops/commande-deploiement.sh');
const DARWIN = process.platform === 'darwin';

function surPath(commande: string): boolean {
  return spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' }).status === 0;
}

const GMV = surPath('gmv');
/** Bascule impossible à jouer ici : macOS sans GNU mv (la CI Linux joue ces cas). */
const SANS_MV_T = DARWIN && !GMV;
const RAISON_MV = 'GNU mv requis';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-commande-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sha = (n: number | string): string => crypto.createHash('sha1').update(`version-${n}`).digest('hex');

interface Banc {
  base: string;
  stubs: string;
  sortieRrsync: string;
  sortieLogger: string;
}

function stub(dossier: string, nom: string, contenu: string): void {
  fs.writeFileSync(path.join(dossier, nom), contenu, { mode: 0o755 });
}

function banc(): Banc {
  const racine = fs.mkdtempSync(path.join(tmp, 'cas-'));
  const base = path.join(racine, 'base');
  const stubs = path.join(racine, 'stubs');
  fs.mkdirSync(base);
  fs.mkdirSync(stubs);
  stub(
    stubs,
    'df',
    [
      '#!/bin/sh',
      "printf 'Filesystem 1048576-blocks Used Available Capacity Mounted on\\n'",
      "printf '/dev/factice 100000 50000 %s %s%% /\\n' \"${STUB_DF_LIBRE:-50000}\" \"${STUB_DF_PCT:-50}\"",
      '',
    ].join('\n'),
  );
  stub(stubs, 'logger', ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_LOGGER"', ''].join('\n'));
  stub(
    stubs,
    'rrsync',
    [
      '#!/bin/sh',
      '{ for a in "$@"; do printf \'arg=%s\\n\' "$a"; done; printf \'cmd=%s\\n\' "$SSH_ORIGINAL_COMMAND"; } > "$STUB_RRSYNC"',
      '',
    ].join('\n'),
  );
  if (DARWIN) {
    // flock : saute les options et le verrou (fichier ou descripteur), exécute le reste s'il y en a un.
    stub(
      stubs,
      'flock',
      [
        '#!/bin/sh',
        'while [ $# -gt 0 ]; do case "$1" in -w) shift 2 ;; -*) shift ;; *) break ;; esac; done',
        '[ $# -gt 0 ] && shift',
        '[ $# -gt 0 ] && exec "$@"',
        'exit 0',
        '',
      ].join('\n'),
    );
    if (GMV) stub(stubs, 'mv', ['#!/bin/sh', 'exec gmv "$@"', ''].join('\n'));
  }
  return { base, stubs, sortieRrsync: path.join(racine, 'rrsync.txt'), sortieLogger: path.join(racine, 'logger.txt') };
}

interface Resultat {
  status: number | null;
  stdout: string;
  stderr: string;
}

function lancer(b: Banc, commande: string | undefined, extra: Record<string, string> = {}): Resultat {
  const env: Record<string, string> = {
    PATH: `${b.stubs}:${process.env.PATH ?? '/usr/bin:/bin'}`,
    LC_ALL: 'C',
    RTP_BASE: b.base,
    RTP_RRSYNC: path.join(b.stubs, 'rrsync'),
    STUB_RRSYNC: b.sortieRrsync,
    STUB_LOGGER: b.sortieLogger,
    ...extra,
  };
  if (commande !== undefined) env.SSH_ORIGINAL_COMMAND = commande;
  const r = spawnSync('bash', [SCRIPT], { env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function deposer(b: Banc, cible: string, s: string, options: { commit?: string; sansIndex?: boolean } = {}): string {
  const dossier = path.join(b.base, 'incoming', cible, s);
  fs.mkdirSync(dossier, { recursive: true });
  if (!options.sansIndex) fs.writeFileSync(path.join(dossier, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  fs.writeFileSync(path.join(dossier, 'version.json'), JSON.stringify({ commit: options.commit ?? s, date: '2026-11-08T00:00:00Z' }));
  return dossier;
}

function racineDe(b: Banc, cible: string): string {
  return cible === 'production' ? b.base : path.join(b.base, 'essai');
}

function lien(b: Banc, cible = 'essai'): string | null {
  const p = path.join(racineDe(b, cible), 'current');
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}

function historique(b: Banc, cible = 'essai'): string[] {
  const p = path.join(racineDe(b, cible), '.historique');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter((l) => l !== '') : [];
}

function versionsHex(b: Banc, cible = 'essai'): string[] {
  const p = path.join(racineDe(b, cible), 'releases');
  return fs.existsSync(p) ? fs.readdirSync(p).filter((n) => /^[0-9a-f]{40}$/.test(n)).sort() : [];
}

function activer(b: Banc, cible: string, s: string): Resultat {
  deposer(b, cible, s);
  const r = lancer(b, `activer ${cible} ${s}`);
  assert.equal(r.status, 0, `activer ${s} : ${r.stderr}`);
  return r;
}

const S = sha(1);

describe('ops/commande-deploiement.sh : refus (code 64, rien d’écrit)', () => {
  const malveillantes: [string, string | undefined][] = [
    ['commande absente (clé utilisée sans commande)', undefined],
    ['commande vide', ''],
    ['espaces seuls', '   '],
    ['rm -rf /', 'rm -rf /'],
    ['id', 'id'],
    ['bash', 'bash'],
    ['activer sans sha', 'activer essai'],
    ['cible inconnue', `activer prod ${S}`],
    ['sha en majuscules', `activer essai ${S.toUpperCase()}`],
    ['sha de 39 caractères', `activer essai ${S.slice(0, 39)}`],
    ['sha de 41 caractères', `activer essai ${S}a`],
    ['point-virgule', `activer essai ${S}; id`],
    ['substitution $(...)', '$(id)'],
    ['accents graves', '`id`'],
    ['tube', `etat essai | id`],
    ['esperluette', `etat essai & id`],
    ['redirection', `etat essai > /tmp/x`],
    ['guillemet double', `activer essai "${S}"`],
    ['guillemet simple', `activer essai '${S}'`],
    ['retour à la ligne', `etat essai\nid`],
    ['tabulation', `etat\tessai`],
    ['téléchargement (--sender)', `rsync --server --sender . essai/${S}/`],
    ['suppression (--delete)', `rsync --server --delete . essai/${S}/`],
    ['option avec chemin', `rsync --server --log-file=/tmp/x . essai/${S}/`],
    ['rsync sans --server', `rsync -logDtpre.iLsfxC . essai/${S}/`],
    ['rsync sans destination', 'rsync --server'],
    ['remontée ../etc/', 'rsync --server . ../etc/'],
    ['remontée après le sha', `rsync --server . essai/${S}/../../x`],
    ['destination sans sha', 'rsync --server . production/notasha/'],
    ['destination hors cible', `rsync --server . incoming/${S}/`],
    ['argument après la destination', `rsync --server . essai/${S}/ autre`],
    ['source autre que « . »', `rsync --server x essai/${S}/`],
    ['retour avec sha court', 'retour essai abc'],
    ['retour avec trop d’arguments', `retour essai ${S} ${S}`],
    ['etat sans cible', 'etat'],
    ['etat avec argument en trop', 'etat essai extra'],
    ['verbe en majuscules', 'ETAT essai'],
  ];
  for (const [nom, commande] of malveillantes) {
    it(`refuse : ${nom}`, () => {
      const b = banc();
      const r = lancer(b, commande);
      assert.equal(r.status, 64, `${nom} : code ${r.status}, stderr ${r.stderr}`);
      assert.deepEqual(fs.readdirSync(b.base), [], `${nom} : rien ne doit être écrit sous RTP_BASE`);
      assert.equal(fs.existsSync(b.sortieRrsync), false, `${nom} : rrsync ne doit pas être lancé`);
      assert.equal(r.stdout, '', `${nom} : aucune sortie standard`);
      assert.match(r.stderr, /refusé/);
    });
  }
});

describe('ops/commande-deploiement.sh : envoi par rsync', () => {
  it('lance rrsync -wo -no-del sur incoming/ avec la même commande', () => {
    const b = banc();
    const commande = `rsync --server -logDtpre.iLsfxC . essai/${S}/`;
    const r = lancer(b, commande);
    assert.equal(r.status, 0, r.stderr);
    const lignes = fs.readFileSync(b.sortieRrsync, 'utf8').trimEnd().split('\n');
    assert.deepEqual(lignes, ['arg=-wo', 'arg=-no-del', `arg=${path.join(b.base, 'incoming')}`, `cmd=${commande}`]);
    assert.ok(fs.statSync(path.join(b.base, 'incoming', 'essai')).isDirectory());
    assert.equal(fs.existsSync(path.join(b.base, 'essai')), false, 'l’arbre servi n’est pas touché par l’envoi');
  });

  it('accepte la cible production sans barre finale', () => {
    const b = banc();
    const r = lancer(b, `rsync --server -logDtpre.iLsfxC --stats . production/${S}`);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.statSync(path.join(b.base, 'incoming', 'production')).isDirectory());
  });

  const pleins: [string, Record<string, string>][] = [
    ['500 Mio libres', { STUB_DF_LIBRE: '500' }],
    ['1023 Mio libres', { STUB_DF_LIBRE: '1023' }],
    ['93 % utilisés', { STUB_DF_PCT: '93' }],
    ['92 % utilisés', { STUB_DF_PCT: '92' }],
  ];
  for (const [nom, env] of pleins) {
    it(`refuse l’envoi avec ${nom} (code 75, rrsync non lancé)`, () => {
      const b = banc();
      const r = lancer(b, `rsync --server -logDtpre.iLsfxC . essai/${S}/`, env);
      assert.equal(r.status, 75, r.stderr);
      assert.equal(fs.existsSync(b.sortieRrsync), false);
    });
  }

  it('accepte 1024 Mio libres et 91 % utilisés (bornes)', () => {
    const b = banc();
    const r = lancer(b, `rsync --server -logDtpre.iLsfxC . essai/${S}/`, { STUB_DF_LIBRE: '1024', STUB_DF_PCT: '91' });
    assert.equal(r.status, 0, r.stderr);
  });

  it('refuse un df illisible (code 1, rrsync non lancé)', () => {
    const b = banc();
    const r = lancer(b, `rsync --server -logDtpre.iLsfxC . essai/${S}/`, { STUB_DF_LIBRE: 'beaucoup' });
    assert.equal(r.status, 1, r.stderr);
    assert.equal(fs.existsSync(b.sortieRrsync), false);
  });
});

describe('ops/commande-deploiement.sh : activer', () => {
  it('range l’envoi vérifié dans releases/<sha>/ et bascule le lien relatif', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    deposer(b, 'essai', S);
    const r = lancer(b, `activer essai ${S}`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lien(b), `releases/${S}`);
    assert.ok(fs.existsSync(path.join(b.base, 'essai', 'releases', S, 'index.html')));
    assert.equal(fs.existsSync(path.join(b.base, 'essai', '.current.tmp')), false);
    assert.equal(fs.existsSync(path.join(b.base, 'incoming', 'essai', S)), false);
    const h = historique(b);
    assert.equal(h.length, 1);
    assert.match(h[0], new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z ${S}$`));
    assert.equal(r.stdout, `active cible=essai courant=${S} versions=1\n`);
  });

  it('consigne une ligne JSON par logger -t rtp-deploy', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', S);
    const lignes = fs.readFileSync(b.sortieLogger, 'utf8').trimEnd().split('\n');
    assert.equal(lignes.length, 1);
    assert.ok(lignes[0].startsWith('-t rtp-deploy '), lignes[0]);
    assert.deepEqual(JSON.parse(lignes[0].slice('-t rtp-deploy '.length)), { verbe: 'activer', cible: 'essai', sha: S, code: 0 });
  });

  it('production : racine RTP_BASE, sans toucher essai/', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    const r = activer(b, 'production', S);
    assert.equal(lien(b, 'production'), `releases/${S}`);
    assert.ok(fs.existsSync(path.join(b.base, 'releases', S, 'index.html')));
    assert.equal(fs.existsSync(path.join(b.base, 'essai')), false);
    assert.equal(r.stdout, `active cible=production courant=${S} versions=1\n`);
  });

  it('refuse un commit de version.json différent (code 65, current inchangé)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', sha(1));
    deposer(b, 'essai', sha(2), { commit: sha(3) });
    const r = lancer(b, `activer essai ${sha(2)}`);
    assert.equal(r.status, 65, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
    assert.deepEqual(versionsHex(b), [sha(1)]);
    assert.equal(historique(b).length, 1);
  });

  it('refuse un envoi sans index.html (code 65, current inchangé)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', sha(1));
    deposer(b, 'essai', sha(2), { sansIndex: true });
    const r = lancer(b, `activer essai ${sha(2)}`);
    assert.equal(r.status, 65, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
  });

  it('refuse un envoi absent (code 65)', () => {
    const b = banc();
    const r = lancer(b, `activer essai ${S}`);
    assert.equal(r.status, 65, r.stderr);
    assert.equal(lien(b), null);
  });

  it('refuse un version.json illisible (code 65)', () => {
    const b = banc();
    const dossier = deposer(b, 'essai', S);
    fs.writeFileSync(path.join(dossier, 'version.json'), 'pas du json');
    const r = lancer(b, `activer essai ${S}`);
    assert.equal(r.status, 65, r.stderr);
  });

  it('est idempotent pour un sha déjà présent : copie reçue écartée, current inchangé', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', S);
    deposer(b, 'essai', S);
    const r = lancer(b, `activer essai ${S}`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lien(b), `releases/${S}`);
    assert.equal(fs.existsSync(path.join(b.base, 'incoming', 'essai', S)), false);
    assert.equal(historique(b).length, 1);
    assert.equal(r.stdout, `active cible=essai courant=${S} versions=1\n`);
  });

  it('garde 5 versions après 7 activations, dont la courante et la précédente, sans toucher un dossier non hexadécimal', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    fs.mkdirSync(path.join(b.base, 'essai', 'releases', '_panne'), { recursive: true });
    let r: Resultat | undefined;
    for (let i = 1; i <= 7; i++) r = activer(b, 'essai', sha(i));
    const restants = versionsHex(b);
    assert.equal(restants.length, 5);
    assert.ok(restants.includes(sha(7)), 'la courante reste');
    assert.ok(restants.includes(sha(6)), 'la précédente reste');
    assert.ok(!restants.includes(sha(1)) && !restants.includes(sha(2)), 'les deux plus anciennes partent');
    assert.ok(fs.existsSync(path.join(b.base, 'essai', 'releases', '_panne')), '_panne n’est jamais supprimé');
    assert.equal(r?.stdout, `active cible=essai courant=${sha(7)} versions=5\n`);
  });

  it('échoue (code 1) sans toucher un current qui est un vrai dossier (mv -T refuse)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    const courant = path.join(b.base, 'essai', 'current');
    fs.mkdirSync(courant, { recursive: true });
    fs.writeFileSync(path.join(courant, 'temoin.txt'), 'ne pas toucher');
    deposer(b, 'essai', S);
    const r = lancer(b, `activer essai ${S}`);
    assert.equal(r.status, 1, r.stderr);
    assert.ok(fs.lstatSync(courant).isDirectory() && !fs.lstatSync(courant).isSymbolicLink());
    assert.equal(fs.readFileSync(path.join(courant, 'temoin.txt'), 'utf8'), 'ne pas toucher');
    assert.equal(fs.existsSync(path.join(b.base, 'essai', '.current.tmp')), false);
    assert.equal(historique(b).length, 0);
  });
});

describe('ops/commande-deploiement.sh : retour', () => {
  it('rebascule sur la précédente, puis revient (aller-retour)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', sha(1));
    activer(b, 'essai', sha(2));
    const r1 = lancer(b, 'retour essai');
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
    assert.equal(r1.stdout, `retour cible=essai courant=${sha(1)} precedent=${sha(2)}\n`);
    const r2 = lancer(b, 'retour essai');
    assert.equal(r2.status, 0, r2.stderr);
    assert.equal(lien(b), `releases/${sha(2)}`);
    assert.equal(r2.stdout, `retour cible=essai courant=${sha(2)} precedent=${sha(1)}\n`);
    assert.equal(fs.existsSync(path.join(b.base, 'essai', '.current.tmp')), false);
  });

  it('saute une version de l’historique dont le dossier a disparu', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    for (let i = 1; i <= 3; i++) activer(b, 'essai', sha(i));
    fs.rmSync(path.join(b.base, 'essai', 'releases', sha(2)), { recursive: true });
    const r = lancer(b, 'retour essai');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
  });

  it('bascule sur un sha explicite présent', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    for (let i = 1; i <= 3; i++) activer(b, 'essai', sha(i));
    const r = lancer(b, `retour essai ${sha(1)}`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
    assert.equal(r.stdout, `retour cible=essai courant=${sha(1)} precedent=${sha(3)}\n`);
  });

  it('refuse un sha explicite absent (code 66, current inchangé)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', sha(1));
    const r = lancer(b, `retour essai ${sha(9)}`);
    assert.equal(r.status, 66, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
  });

  it('refuse sans version précédente (code 66)', (t) => {
    if (SANS_MV_T) return t.skip(RAISON_MV);
    const b = banc();
    activer(b, 'essai', sha(1));
    const r = lancer(b, 'retour essai');
    assert.equal(r.status, 66, r.stderr);
    assert.equal(lien(b), `releases/${sha(1)}`);
  });
});

describe('ops/commande-deploiement.sh : etat et nettoyage', () => {
  it('donne la version courante, le nombre de versions et l’espace libre', () => {
    const b = banc();
    const releases = path.join(b.base, 'essai', 'releases');
    fs.mkdirSync(path.join(releases, sha(1)), { recursive: true });
    fs.mkdirSync(path.join(releases, sha(2)));
    fs.mkdirSync(path.join(releases, '_panne'));
    fs.symlinkSync(`releases/${sha(2)}`, path.join(b.base, 'essai', 'current'));
    const r = lancer(b, 'etat essai', { STUB_DF_LIBRE: '4321' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `etat cible=essai courant=${sha(2)} versions=2 libre_mio=4321\n`);
  });

  it('dit courant=aucun sans lien', () => {
    const b = banc();
    const r = lancer(b, 'etat production');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'etat cible=production courant=aucun versions=0 libre_mio=50000\n');
  });

  it('retire les envois de plus d’un jour à chaque appel et garde les récents', () => {
    const b = banc();
    const vieux = deposer(b, 'essai', sha(1));
    const recent = deposer(b, 'production', sha(2));
    const avant = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    fs.utimesSync(vieux, avant, avant);
    const r = lancer(b, 'etat essai');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.existsSync(vieux), false);
    assert.ok(fs.existsSync(recent));
  });
});

describe('ops/commande-deploiement.sh : code', () => {
  const script = fs.readFileSync(SCRIPT, 'utf8');
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

  it('n’a ni eval, ni bash -c, ni sudo, ni docker, ni ln -sfn', () => {
    assert.doesNotMatch(code, /\beval\b|bash -c|\bsudo\b|\bdocker\b|ln -sfn/);
  });

  it('envoie par rrsync -wo -no-del et bascule par mv -T', () => {
    assert.match(code, /exec "\$RRSYNC" -wo -no-del "\$BASE\/incoming"/);
    assert.match(code, /ln -s "releases\/\$1" \.current\.tmp/);
    assert.match(code, /mv -T \.current\.tmp current/);
  });

  it('commence par l’en-tête bash strict', () => {
    assert.ok(script.startsWith('#!/usr/bin/env bash\n'));
    assert.match(code, /^set -euo pipefail$/m);
  });
});
