import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lire-'));
const dist = path.join(tmp, 'dist');
const journal = path.join(tmp, 'j.jsonl');
fs.mkdirSync(path.join(dist, 'themes', 'x'), { recursive: true });
fs.writeFileSync(
  path.join(dist, 'index.html'),
  `<!doctype html><html><head><title>Accueil test</title><style>.secret{}</style><script>var SECRET_JS=1</script></head><body><main><h1>Bonjour</h1>
<div class="lecteur"><input type="radio" id="niv-resume"><div class="redaction" data-niveau="resume"><p>Texte resume</p></div>
<div class="redaction" data-niveau="detaille"><p>Texte detaille</p></div><div class="redaction" data-niveau="enfant"><p>Texte enfant <button popovertarget="d1">mot</button></p><div id="d1" popover>Une definition</div></div>
<div class="redaction" data-niveau="aine"><p>Texte aine</p></div></div>
<details><summary>Ne se presentent pas</summary><p>Corps replie</p></details>
<a href="/themes/x/">Theme X</a></main><footer>Pied de page</footer></body></html>`,
);
fs.writeFileSync(path.join(dist, 'themes', 'x', 'index.html'), '<html><head><title>X</title></head><body><main><p>Page X</p></main></body></html>');
fs.writeFileSync(path.join(tmp, 'hors.html'), '<html><title>HORS</title></html>');

function lancer(...args: string[]) {
  return spawnSync(process.execPath, ['scripts/audit-lire.ts', '--dist', dist, '--journal', journal, ...args], { encoding: 'utf8' });
}
const lignes = (): Record<string, unknown>[] =>
  fs.existsSync(journal)
    ? fs
        .readFileSync(journal, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    : [];

test('--liste : chemins triés, une ligne de journal', () => {
  const r = lancer('--liste', '--persona', 'p1');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '/\n/themes/x/\n');
  const l = lignes();
  assert.equal(l.length, 1);
  assert.equal(l[0]?.chemin, '--liste');
});

test('lecture au niveau enfant : autres niveaux omis, replié et définition étiquetés, liens, pas de script', () => {
  const avant = lignes().length;
  const r = lancer('--persona', 'enfant-10-ans', '--niveau', 'enfant', '/');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Titre : Accueil test/);
  assert.match(r.stdout, /Texte enfant/);
  assert.doesNotMatch(r.stdout, /Texte resume|Texte detaille|Texte aine/);
  assert.match(r.stdout, /\(replié\) Corps replie/);
  assert.match(r.stdout, /\(définition\) Une definition/);
  assert.match(r.stdout, /Pied de page/);
  assert.match(r.stdout, /Liens :\n1\. Theme X -> \/themes\/x\//);
  assert.doesNotMatch(r.stdout, /SECRET_JS|\.secret/);
  const l = lignes();
  assert.equal(l.length, avant + 1);
  const derniere = l[l.length - 1] ?? {};
  assert.deepEqual(Object.keys(derniere).sort(), ['chemin', 'horodatage', 'niveau', 'octets', 'persona', 'sha256']);
  assert.equal(derniere.niveau, 'enfant');
  assert.match(String(derniere.sha256), /^[0-9a-f]{64}$/);
  assert.equal(derniere.octets, fs.statSync(path.join(dist, 'index.html')).size);
});

test('sans --niveau : tous les niveaux, étiquetés', () => {
  const r = lancer('--persona', 'p1', '/');
  assert.match(r.stdout, /\[En bref\] Texte resume/);
  assert.match(r.stdout, /\[Gros caractères\] Texte aine/);
});

test('refus (code 2, aucune ligne de journal)', () => {
  const avant = lignes().length;
  for (const args of [
    ['--persona', 'p1', '/../hors.html'],
    ['--persona', 'p1', '/%2e%2e/hors.html'],
    ['--persona', 'p1', '/absente/'],
    ['--persona', 'Mauvais Id', '/'],
    ['--persona', 'p1', '--niveau', 'expert', '/'],
  ]) {
    const r = lancer(...args);
    assert.equal(r.status, 2, args.join(' '));
    assert.ok(r.stderr.length > 0);
  }
  assert.equal(lignes().length, avant);
});

test('--empreinte : stable, change quand un fichier change', () => {
  const a = lancer('--empreinte').stdout;
  assert.match(a, /^[0-9a-f]{64}\n$/);
  assert.equal(lancer('--empreinte').stdout, a);
  fs.appendFileSync(path.join(dist, 'themes', 'x', 'index.html'), ' ');
  assert.notEqual(lancer('--empreinte').stdout, a);
});

// WR-01 : jeu de fichiers séparé, pour ne pas changer le dist des tests ci-dessus.
function distAvecLiens(): { racine: string; dist: string; journal: string } {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lire-liens-'));
  const d = path.join(racine, 'dist');
  fs.mkdirSync(d);
  fs.writeFileSync(path.join(d, 'index.html'), '<html><head><title>Dedans</title></head><body><main><p>Page interne</p></main></body></html>');
  fs.writeFileSync(path.join(racine, 'secret.html'), '<html><head><title>SECRET</title></head><body><main><p>SECRET</p></main></body></html>');
  return { racine, dist: d, journal: path.join(racine, 'j.jsonl') };
}
const lancerSur = (d: string, j: string, ...args: string[]) =>
  spawnSync(process.execPath, ['scripts/audit-lire.ts', '--dist', d, '--journal', j, ...args], { encoding: 'utf8' });

test('liens symboliques (WR-01) : cible hors du dist refusée, lien interne lu', () => {
  const { racine, dist: d, journal: j } = distAvecLiens();
  fs.symlinkSync(path.join(racine, 'secret.html'), path.join(d, 'sym.html'));
  fs.symlinkSync(racine, path.join(d, 'dehors'));
  fs.symlinkSync(path.join(d, 'index.html'), path.join(d, 'alias.html'));
  for (const chemin of ['/sym.html', '/dehors/secret.html']) {
    const r = lancerSur(d, j, '--persona', 'p1', chemin);
    assert.equal(r.status, 2, chemin);
    assert.doesNotMatch(r.stdout, /SECRET/, chemin);
  }
  assert.equal(fs.existsSync(j), false, 'aucune ligne de journal pour un refus');
  const ok = lancerSur(d, j, '--persona', 'p1', '/alias.html');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Page interne/);
});

test('--empreinte (WR-01) : un lien est compté sans être suivi', () => {
  const { racine, dist: d, journal: j } = distAvecLiens();
  const empreinte = (): string => lancerSur(d, j, '--empreinte').stdout;
  const sans = empreinte();
  fs.symlinkSync(path.join(racine, 'secret.html'), path.join(d, 'sym.html'));
  const avec = empreinte();
  assert.match(avec, /^[0-9a-f]{64}\n$/);
  assert.notEqual(avec, sans, 'un lien ajouté change l\'empreinte');
  fs.appendFileSync(path.join(racine, 'secret.html'), ' ');
  assert.equal(empreinte(), avec, 'la cible hors dist n\'est pas lue');
  fs.unlinkSync(path.join(d, 'sym.html'));
  fs.symlinkSync(path.join(d, 'index.html'), path.join(d, 'sym.html'));
  assert.notEqual(empreinte(), avec, 'un lien redirigé change l\'empreinte');
});

test('journal dans le dist refusé (WR-02) : chemin direct, par un lien, ou par défaut depuis le dist', () => {
  const { racine, dist: d } = distAvecLiens();
  const script = path.resolve('scripts/audit-lire.ts');
  fs.symlinkSync(d, path.join(racine, 'lien-dist'));
  for (const j of [path.join(d, 'journal.jsonl'), path.join(d, 'audit', 'j.jsonl'), path.join(racine, 'lien-dist', 'j.jsonl')]) {
    const r = lancerSur(d, j, '--liste');
    assert.equal(r.status, 2, j);
    assert.match(r.stderr, /Journal refusé/, j);
    assert.equal(r.stdout, '', j);
  }
  const defaut = spawnSync(process.execPath, [script, '--dist', '.', '--liste'], { cwd: d, encoding: 'utf8' });
  assert.equal(defaut.status, 2, defaut.stderr);
  assert.match(defaut.stderr, /Journal refusé/);
  assert.deepEqual(fs.readdirSync(d).sort(), ['index.html'], 'rien n\'est écrit dans le dist');
  const hors = lancerSur(d, path.join(racine, 'j.jsonl'), '--liste');
  assert.equal(hors.status, 0, hors.stderr);
});
