import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ErreurConfigLocale, lireFichierCles } from '../../scripts/lib/config-locale.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const SENTINELLE = 'SENTINELLE-CONFIG-7c1';
const CLES = ['A', 'B', 'CHEMIN'] as const;

function fichier(contenu: string, mode = 0o600): { home: string; f: string } {
  const home = mkdtempSync(path.join(os.tmpdir(), 'rtp-cfg-'));
  dossiers.push(home);
  const f = path.join(home, 'x.env');
  writeFileSync(f, contenu);
  chmodSync(f, mode);
  return { home, f };
}

function erreurs(contenu: string, mode = 0o600): string[] {
  const { home, f } = fichier(contenu, mode);
  try {
    lireFichierCles(f, CLES, home);
  } catch (e) {
    assert.ok(e instanceof ErreurConfigLocale);
    assert.ok(!e.message.includes(SENTINELLE), 'valeur dans le message');
    return e.erreurs;
  }
  assert.fail('aucune erreur levée');
}

describe('lireFichierCles', () => {
  it('lit les valeurs, retire les guillemets, développe ~/, ignore commentaires et lignes vides', () => {
    const { home, f } = fichier('# c\n\nA=un\nB="deux mots"\nCHEMIN=~/x/y\n');
    const m = lireFichierCles(f, CLES, home);
    assert.equal(m.get('A'), 'un');
    assert.equal(m.get('B'), 'deux mots');
    assert.equal(m.get('CHEMIN'), path.join(home, 'x', 'y'));
  });

  it('fichier absent : erreur qui nomme le chemin', () => {
    assert.throws(() => lireFichierCles('/nexiste/pas.env', CLES, '/tmp'), /\/nexiste\/pas\.env/);
  });

  it('mode 0644 : erreur chmod 600', () => {
    assert.match(erreurs('A=1\n', 0o644).join('\n'), /chmod 600/);
  });

  it('refuse export, expansion, guillemet interne, barre oblique inverse, contrôle, clé inconnue, doublon, forme', () => {
    const e = erreurs(
      [
        `export A=${SENTINELLE}`,
        `B=${SENTINELLE}$HOME`,
        `A=${SENTINELLE}\`id\``,
        `A=x${SENTINELLE}"y`,
        `A=x${SENTINELLE}\\y`,
        `A=x${SENTINELLE}\u0007`,
        `INCONNUE=${SENTINELLE}`,
        'a = 1',
        'B=1',
        'B=2',
      ].join('\n'),
    );
    assert.equal(e.length, 9);
    assert.match(e[0] ?? '', /ligne 1/);
    assert.match(e.join('\n'), /INCONNUE/);
    assert.match(e.join('\n'), /ligne 3 \(A\)/);
    assert.match(e.join('\n'), /B est donnée plusieurs fois/);
  });
});
