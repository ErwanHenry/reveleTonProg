import assert from 'node:assert/strict';
import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parse } from 'yaml';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

// Chaîne complète « archiver une source puis valider », sans réseau : la page vient d'un fichier
// (--file), le dépôt privé est un clone git local dont `origin` est un dépôt nu local.

const CLI = path.join(REPO_ROOT, 'scripts', 'archive-source.ts');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'archive');
const URL_PAGE = 'https://marie-fictive.exemple.invalid/page';

const ENV_GIT = {
  GIT_AUTHOR_NAME: 'Test Archive',
  GIT_AUTHOR_EMAIL: 'test@exemple.invalid',
  GIT_COMMITTER_NAME: 'Test Archive',
  GIT_COMMITTER_EMAIL: 'test@exemple.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};

const tmpDirs: string[] = [];
const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ENV_GIT }, stdio: ['ignore', 'pipe', 'pipe'] });

function lancer(args: string[], env: Record<string, string> = {}): SpawnSyncReturns<string> {
  const base: Record<string, string> = { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), TZ: 'Europe/Paris', LANG: 'C.UTF-8', ...ENV_GIT };
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env: { ...base, ...env }, timeout: 120_000 });
}

function nouveauMonde(): { base: string; racine: string; remote: string } {
  const base = mkdtempSync(path.join(os.tmpdir(), 'rtp-archive-'));
  tmpDirs.push(base);
  const racine = path.join(base, 'projet');
  cpSync(BASE_CORPUS, racine, { recursive: true });
  return { base, racine, remote: path.join(base, 'remote.git') };
}

function cloneVide(remote: string, dossier: string): void {
  git(path.dirname(dossier), 'clone', '--quiet', remote, dossier);
  git(dossier, 'checkout', '--quiet', '-B', 'main');
}

function listeFichiers(dossier: string): string[] {
  const out: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else out.push(path.relative(dossier, p));
    }
  };
  parcourir(dossier);
  return out.sort();
}

function pdftotextDisponible(): boolean {
  return spawnSync('pdftotext', ['-v'], { stdio: 'ignore' }).error === undefined;
}

/** PDF d'une page en police Helvetica, table xref exacte ; texte ASCII sans parenthèse ni barre oblique inverse. */
function pdfMinimal(lignes: string[]): Buffer {
  const flux = `BT /F1 10 Tf 40 780 Td 14 TL ${lignes.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const sha = (octets: Buffer | string): string => createHash('sha256').update(octets).digest('hex');
const sortie = (r: SpawnSyncReturns<string>): string => `status=${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`;

const ARGS_PAGE = (racine: string, fichier = path.join(FIXTURES, 'page-utf8.html')): string[] => [
  URL_PAGE,
  '--file', fichier,
  '--candidat', 'marie-fictive',
  '--source-id', 'marie-fictive-page',
  '--type', 'site_candidat',
  '--auteur', 'candidat',
  '--titre', 'Page fictive',
  '--date-publication', '2026-10',
  '--capture-le', '2026-11-03T10:00:00+01:00',
  '--root', racine,
];

describe('archive-source : chaîne complète archiver puis valider (hors réseau)', () => {
  let base: string;
  let racine: string;
  let remote: string;
  let clone: string;
  const sourceYaml = (): string => path.join(racine, 'src', 'content', 'sources', 'marie-fictive-page.yaml');
  const lireSource = (): { archive: Record<string, string>; [k: string]: unknown } => parse(readFileSync(sourceYaml(), 'utf8'), { schema: 'core' }) as { archive: Record<string, string> };

  before(() => {
    ({ base, racine, remote } = nouveauMonde());
    execFileSync('git', ['init', '--bare', '--quiet', '-b', 'main', remote], { env: { ...process.env, ...ENV_GIT }, stdio: ['ignore', 'pipe', 'pipe'] });
    // Un premier commit pour que `git pull --rebase` ait une branche à suivre.
    const amorce = path.join(base, 'amorce');
    git(base, 'clone', '--quiet', remote, amorce);
    git(amorce, 'checkout', '--quiet', '-B', 'main');
    writeFileSync(path.join(amorce, 'README.md'), 'privé\n');
    git(amorce, 'add', 'README.md');
    git(amorce, 'commit', '--quiet', '-m', 'init');
    git(amorce, 'push', '--quiet', '-u', 'origin', 'main');
    clone = path.join(base, 'reveleTonProg-archives');
    git(base, 'clone', '--quiet', remote, clone);
  });

  after(() => {
    for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("--dry-run n'écrit rien nulle part", () => {
    const avant = listeFichiers(racine);
    const avantClone = listeFichiers(clone);
    const r = lancer([...ARGS_PAGE(racine), '--dry-run'], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));
    assert.deepEqual(listeFichiers(racine), avant);
    assert.deepEqual(listeFichiers(clone), avantClone);
    assert.match(r.stdout, /[0-9a-f]{12}/);
  });

  it('capture un fichier : extrait .txt, source YAML valide, binaire et métadonnées dans le dépôt privé, push', () => {
    const avantCommits = Number(git(remote, 'rev-list', '--count', 'main').trim());
    const r = lancer([...ARGS_PAGE(racine), '--push'], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));

    const src = lireSource();
    const archive = src.archive;
    assert.match(archive.extrait ?? '', /^archives\/marie-fictive\/[0-9a-f]{12}\.txt$/);
    const extraitPath = path.join(racine, archive.extrait ?? '');
    const octets = readFileSync(extraitPath);
    assert.equal(sha(octets), archive.sha256);
    assert.equal(path.basename(extraitPath, '.txt'), (archive.sha256 ?? '').slice(0, 12));
    assert.equal(archive.capture_le, '2026-11-03T10:00:00+01:00');
    assert.equal(archive.wayback_url, undefined);
    const html = readFileSync(path.join(FIXTURES, 'page-utf8.html'));
    assert.equal(archive.binaire_sha256, sha(html));
    assert.equal(src.url, URL_PAGE);
    assert.equal(src.date_consultation, '2026-11-03');
    assert.equal(src.date_publication, '2026-10');

    const texte = octets.toString('utf8');
    assert.ok(texte.endsWith('\n') && !texte.endsWith('\n\n'));
    assert.ok(!texte.includes('SCRIPT_SENTINEL'));
    assert.ok(texte.includes('préfet'));

    const sha12 = (archive.binaire_sha256 ?? '').slice(0, 12);
    assert.ok(existsSync(path.join(clone, 'marie-fictive', `${sha12}.html`)), 'binaire dans le dépôt privé');
    const meta = JSON.parse(readFileSync(path.join(clone, 'marie-fictive', `${sha12}--marie-fictive-page.json`), 'utf8')) as Record<string, unknown>;
    assert.equal(meta.source_id, 'marie-fictive-page');
    assert.equal(meta.url_demandee, URL_PAGE);
    assert.equal(meta.outil, 'fichier-manuel');
    assert.equal(meta.binaire_sha256, archive.binaire_sha256);
    assert.equal(meta.extrait_sha256, archive.sha256);

    assert.equal(Number(git(remote, 'rev-list', '--count', 'main').trim()), avantCommits + 1, 'un commit de plus sur le dépôt nu');
    assert.equal(git(clone, 'status', '--porcelain').trim(), '');

    // Aucun binaire dans le dépôt public (ici : la racine de contenu temporaire).
    assert.deepEqual(listeFichiers(racine).filter((f) => /\.(html|pdf)$/.test(f)), []);
  });

  it('une mesure qui cite la source passe la validation ; un octet de plus dans l’extrait donne ARCHIVE_SHA256_DIVERGENT', () => {
    const modele = readFileSync(path.join(BASE_CORPUS, 'src', 'content', 'mesures', 'marie-fictive', 'encadrement-loyers.yaml'), 'utf8');
    const mesure = modele
      .replace('id: marie-fictive/encadrement-loyers', 'id: marie-fictive/encadrement-page')
      .replace('source: marie-fictive-programme', 'source: marie-fictive-page')
      .replace('statut_relecture: publie', 'statut_relecture: brouillon')
      .replace('relecteur: Erwan Henry\n', '')
      .replace('date_relecture: 2026-10-21\n', '');
    assert.notEqual(mesure, modele);
    writeFileSync(path.join(racine, 'src', 'content', 'mesures', 'marie-fictive', 'encadrement-page.yaml'), mesure);

    const ok = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
    assert.deepEqual(
      ok.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.code} ${path.relative(racine, d.file)} ${d.pointer}`),
      [],
    );

    const extrait = path.join(racine, lireSource().archive.extrait ?? '');
    const original = readFileSync(extrait);
    appendFileSync(extrait, 'x');
    try {
      const ko = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
      assert.ok(
        ko.diagnostics.some((d) => d.code === 'ARCHIVE_SHA256_DIVERGENT' && d.file === sourceYaml()),
        JSON.stringify(ko.diagnostics.map((d) => d.code)),
      );
    } finally {
      writeFileSync(extrait, original);
    }
  });

  it('refuse une source déjà présente (utiliser --refresh)', () => {
    const r = lancer(ARGS_PAGE(racine), { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 2, sortie(r));
    assert.match(r.stderr, /--refresh/);
  });

  it('refuse une coquille JS avec le conseil --file et n’écrit rien', () => {
    const avant = listeFichiers(racine);
    const avantClone = listeFichiers(clone);
    const args = ARGS_PAGE(racine, path.join(FIXTURES, 'coquille-js.html'));
    args[args.indexOf('marie-fictive-page')] = 'marie-fictive-coquille';
    const r = lancer(args, { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 1, sortie(r));
    assert.match(r.stderr, /--file/);
    assert.deepEqual(listeFichiers(racine), avant);
    assert.deepEqual(listeFichiers(clone), avantClone);
  });

  it('refuse une URL non https (code 2)', () => {
    const args = ARGS_PAGE(racine);
    args[0] = 'http://marie-fictive.exemple.invalid/page';
    args[args.indexOf('marie-fictive-page')] = 'marie-fictive-http';
    const r = lancer(args, { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 2, sortie(r));
    assert.match(r.stderr, /https/);
  });

  it('sans RTP_ARCHIVES_DIR ni clone voisin : code 2 qui nomme reveleTonProg-archives', () => {
    const autre = nouveauMonde();
    const avant = listeFichiers(autre.racine);
    const r = lancer(ARGS_PAGE(autre.racine));
    assert.equal(r.status, 2, sortie(r));
    assert.match(r.stderr, /reveleTonProg-archives/);
    assert.deepEqual(listeFichiers(autre.racine), avant);
  });

  it('le clone par défaut se résout depuis --root (voisin de la racine), pas depuis le dossier courant', () => {
    const autre = nouveauMonde();
    cloneVide(remote, path.join(autre.base, 'reveleTonProg-archives'));
    const r = lancer(ARGS_PAGE(autre.racine));
    assert.equal(r.status, 0, sortie(r));
    const sha12 = sha(readFileSync(path.join(FIXTURES, 'page-utf8.html'))).slice(0, 12);
    assert.ok(existsSync(path.join(autre.base, 'reveleTonProg-archives', 'marie-fictive', `${sha12}.html`)));
  });

  it('--refresh d’une source saisie à la main sans --file : avertissement, rien ne change', () => {
    const avant = readFileSync(sourceYaml(), 'utf8');
    const r = lancer(['--refresh', 'marie-fictive-page', '--root', racine], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));
    assert.match(r.stdout + r.stderr, /fichier-manuel|manuel/);
    assert.equal(readFileSync(sourceYaml(), 'utf8'), avant);
  });

  it('--refresh --file : texte identique = dates rafraîchies, Wayback conservé', () => {
    const wb = 'https://web.archive.org/web/20261103014534/https://marie-fictive.exemple.invalid/page';
    writeFileSync(sourceYaml(), readFileSync(sourceYaml(), 'utf8').replace('  binaire_sha256:', `  wayback_url: ${wb}\n  binaire_sha256:`));
    const r = lancer(
      ['--refresh', 'marie-fictive-page', '--file', path.join(FIXTURES, 'page-utf8.html'), '--capture-le', '2026-11-05T09:00:00+01:00', '--root', racine],
      { RTP_ARCHIVES_DIR: clone },
    );
    assert.equal(r.status, 0, sortie(r));
    const a = lireSource().archive;
    assert.equal(a.wayback_url, wb);
    assert.equal(a.capture_le, '2026-11-05T09:00:00+01:00');
    assert.equal(lireSource().date_consultation, '2026-11-05');
  });

  it('--refresh --file : texte modifié = nouvel extrait, Wayback retiré, avertissement de revérification', () => {
    const ancien = lireSource().archive;
    const modifie = path.join(base, 'page-modifiee.html');
    const html = readFileSync(path.join(FIXTURES, 'page-utf8.html'), 'utf8').replace(
      /Nous encadrerons les loyers[\s\S]*?pr&#233;fet\./,
      'Les loyers ne sont plus évoqués dans cette version de la page fictive.',
    );
    assert.ok(html.includes('ne sont plus évoqués'));
    writeFileSync(modifie, html);
    const r = lancer(['--refresh', 'marie-fictive-page', '--file', modifie, '--capture-le', '2026-11-06T09:00:00+01:00', '--root', racine], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));
    assert.match(r.stdout + r.stderr, /contenu modifié : relancer validate, les mesures citant cette source doivent être revérifiées/);
    const a = lireSource().archive;
    assert.notEqual(a.sha256, ancien.sha256);
    assert.notEqual(a.extrait, ancien.extrait);
    assert.equal(a.wayback_url, undefined);
    assert.equal(sha(readFileSync(path.join(racine, a.extrait ?? ''))), a.sha256);
    const apres = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
    assert.ok(apres.diagnostics.some((d) => d.code === 'TEXTE_SOURCE_HORS_ARCHIVE'), 'la mesure citée doit être revérifiée');
  });

  it('capture un PDF (pdftotext) : texte extrait, binaire .pdf dans le dépôt privé', { skip: !pdftotextDisponible() }, () => {
    const lignes = Array.from({ length: 14 }, (_, i) => `Ligne ${i + 1} du programme fictif : nous financerons des mesures imaginaires sans valeur reelle.`);
    lignes.splice(3, 0, 'Nous encadrerons les loyers dans toutes les villes de plus de 50 000 habitants.');
    const pdf = path.join(base, 'programme-fictif.pdf');
    writeFileSync(pdf, pdfMinimal(lignes));
    const args = [
      'https://marie-fictive.exemple.invalid/programme.pdf',
      '--file', pdf,
      '--candidat', 'marie-fictive',
      '--source-id', 'marie-fictive-pdf',
      '--type', 'programme',
      '--auteur', 'candidat',
      '--titre', 'Programme fictif (PDF)',
      '--date-publication', '2026-10-05',
      '--capture-le', '2026-11-03T10:00:00+01:00',
      '--root', racine,
    ];
    const r = lancer(args, { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));
    const src = parse(readFileSync(path.join(racine, 'src', 'content', 'sources', 'marie-fictive-pdf.yaml'), 'utf8'), { schema: 'core' }) as { archive: Record<string, string> };
    const texte = readFileSync(path.join(racine, src.archive.extrait ?? ''), 'utf8');
    assert.ok(texte.includes('Nous encadrerons les loyers dans toutes les villes de plus de 50 000 habitants.'));
    const binSha = sha(readFileSync(pdf));
    assert.equal(src.archive.binaire_sha256, binSha);
    assert.ok(existsSync(path.join(clone, 'marie-fictive', `${binSha.slice(0, 12)}.pdf`)));
  });

  it('--sync-private : rien à pousser, code 0', () => {
    const r = lancer(['--sync-private'], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r.status, 0, sortie(r));
    mkdirSync(path.join(clone, 'marie-fictive'), { recursive: true });
    writeFileSync(path.join(clone, 'marie-fictive', 'a-pousser.txt'), 'x\n');
    const avantCommits = Number(git(remote, 'rev-list', '--count', 'main').trim());
    const r2 = lancer(['--sync-private'], { RTP_ARCHIVES_DIR: clone });
    assert.equal(r2.status, 0, sortie(r2));
    assert.equal(Number(git(remote, 'rev-list', '--count', 'main').trim()), avantCommits + 1);
  });
});
