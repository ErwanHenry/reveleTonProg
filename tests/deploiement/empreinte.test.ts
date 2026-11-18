// Empreinte de l'arbre de la build de déploiement (CR-01) : même calcul que le job deploy de ci.yml
// (find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum), refus des liens et fichiers
// spéciaux, modes normalisés. Le pipeline shell est joué avec /usr/bin/shasum -a 256 (présent sur macOS et Ubuntu).
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { empreinteArbre, normaliserModes, trouverSpecial } from '../../scripts/lib/deploiement/empreinte.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'rtp-empreinte-'));
  dossiers.push(d);
  return d;
}
function ecrire(racine: string, rel: string, contenu: string): void {
  const p = path.join(racine, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, contenu);
}

function pipeline(d: string): string {
  const script = '(cd "$1" && command find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r /usr/bin/shasum -a 256) | /usr/bin/shasum -a 256 | cut -d" " -f1';
  const r = spawnSync('bash', ['-c', script, 'pipeline', d], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

const SHA_VIDE = createHash('sha256').update('').digest('hex');

describe('empreinteArbre', () => {
  it('égale le pipeline de ci.yml (espaces, accents, ordre C différent de l’ordre UTF-16)', () => {
    const d = temp();
    ecrire(d, 'a.txt', 'a');
    ecrire(d, 'B.txt', 'B');
    ecrire(d, 'dossier/é.html', '<p>é</p>');
    ecrire(d, 'avec espace.json', '{}');
    ecrire(d, 'z/ü', 'u');
    ecrire(d, 'vide.txt', '');
    // U+FB00 (UTF-8 EF AC 80) et U+1F600 (UTF-8 F0 9F 98 80) : en UTF-16, l'émoji (D83D) passe avant ; en octets, après.
    ecrire(d, 'ﬀ.txt', 'ff');
    ecrire(d, '\u{1F600}.txt', 'emoji');
    mkdirSync(path.join(d, 'creux', 'plus-creux'), { recursive: true });
    assert.equal(empreinteArbre(d), pipeline(d));
  });

  it('arbre vide : sha256 de la chaîne vide, comme le pipeline', () => {
    const d = temp();
    mkdirSync(path.join(d, 'seul-un-dossier'));
    assert.equal(empreinteArbre(d), SHA_VIDE);
    assert.equal(pipeline(d), SHA_VIDE);
  });

  it('change quand un contenu ou un nom change', () => {
    const d = temp();
    ecrire(d, 'a.txt', 'a');
    const e1 = empreinteArbre(d);
    ecrire(d, 'a.txt', 'b');
    const e2 = empreinteArbre(d);
    assert.notEqual(e1, e2);
  });

  it('refuse un lien symbolique au lieu de le suivre', () => {
    const d = temp();
    ecrire(d, 'a.txt', 'a');
    symlinkSync('a.txt', path.join(d, 'lien'));
    assert.throws(() => empreinteArbre(d), /lien/);
  });
});

describe('trouverSpecial', () => {
  it('arbre propre : null', () => {
    const d = temp();
    ecrire(d, 'a/b/c.txt', 'c');
    assert.equal(trouverSpecial(d), null);
  });

  it('lien vers un fichier, vers un dossier, lien cassé : chemin relatif signalé', () => {
    for (const [cible, nom] of [['a.txt', 'l-fichier'], ['sous', 'l-dossier'], ['absent', 'l-casse']] as const) {
      const d = temp();
      ecrire(d, 'a.txt', 'a');
      mkdirSync(path.join(d, 'sous'));
      symlinkSync(cible, path.join(d, 'sous', nom));
      assert.equal(trouverSpecial(d), `sous/${nom}`);
    }
  });

  it('ne suit jamais un lien vers un dossier qui contient un fichier spécial', () => {
    const d = temp();
    const ailleurs = temp();
    ecrire(ailleurs, 'x.txt', 'x');
    symlinkSync(ailleurs, path.join(d, 'lien'));
    assert.equal(trouverSpecial(d), 'lien');
  });

  it('FIFO signalée', () => {
    const d = temp();
    const r = spawnSync('mkfifo', [path.join(d, 'tube')]);
    assert.equal(r.status, 0);
    assert.equal(trouverSpecial(d), 'tube');
  });

  it('second lien physique signalé (code 65 du serveur)', () => {
    const d = temp();
    ecrire(d, 'a.txt', 'a');
    mkdirSync(path.join(d, 'z'));
    linkSync(path.join(d, 'a.txt'), path.join(d, 'z', 'b.txt'));
    const trouve = trouverSpecial(d);
    assert.ok(trouve === 'a.txt' || trouve === 'z/b.txt', String(trouve));
  });
});

describe('normaliserModes', () => {
  it('0700 et 0600 deviennent 0755 et 0644', () => {
    const d = temp();
    ecrire(d, 'sous/f.html', 'x');
    ecrire(d, 'g.txt', 'y');
    chmodSync(path.join(d, 'sous', 'f.html'), 0o600);
    chmodSync(path.join(d, 'g.txt'), 0o600);
    chmodSync(path.join(d, 'sous'), 0o700);
    normaliserModes(d);
    assert.equal(statSync(path.join(d, 'sous')).mode & 0o777, 0o755);
    assert.equal(statSync(path.join(d, 'sous', 'f.html')).mode & 0o777, 0o644);
    assert.equal(statSync(path.join(d, 'g.txt')).mode & 0o777, 0o644);
    assert.equal(statSync(d).mode & 0o777, 0o755);
  });
});
