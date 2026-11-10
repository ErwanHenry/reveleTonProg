// D-11 (09-07) : icône du site, public/favicon.ico, produite par scripts/favicon.ts (aucune image tierce). Le fichier
// versionné doit être octet pour octet la sortie du générateur : un conteneur ICO d'une seule image, un PNG 32 x 32
// de quelques centaines d'octets, aux couleurs de src/styles/base.css.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { COULEUR_FOND_ICONE, COULEUR_ICONE, genererFavicon } from '../../scripts/favicon.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FICHIER = path.join(ROOT, 'public/favicon.ico');
const SCRIPT = path.join(ROOT, 'scripts/favicon.ts');
const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Morceaux d'un PNG : type et données, CRC non vérifié ici (le décodage suffit). */
function morceaux(png: Buffer): Array<{ type: string; donnees: Buffer }> {
  const out: Array<{ type: string; donnees: Buffer }> = [];
  let i = 8;
  while (i < png.length) {
    const n = png.readUInt32BE(i);
    out.push({ type: png.subarray(i + 4, i + 8).toString('latin1'), donnees: png.subarray(i + 8, i + 8 + n) });
    i += 12 + n;
  }
  return out;
}

describe('scripts/favicon.ts et public/favicon.ico', () => {
  const ico = genererFavicon();

  it('est déterministe : deux appels donnent les mêmes octets', () => {
    assert.ok(genererFavicon().equals(ico));
  });

  it('le fichier versionné est octet pour octet la sortie du générateur', () => {
    assert.ok(fs.existsSync(FICHIER), 'public/favicon.ico absent : lancer node scripts/favicon.ts');
    assert.ok(fs.readFileSync(FICHIER).equals(ico), 'public/favicon.ico dérive : relancer node scripts/favicon.ts');
  });

  it('pèse moins de 1 024 octets', () => {
    assert.ok(ico.length < 1024, `${ico.length} octets`);
  });

  it('en-tête ICO (00 00 01 00, une image) et entrée 32 x 32 qui pointe sur un PNG', () => {
    assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
    assert.equal(ico.readUInt16LE(4), 1);
    assert.equal(ico[6], 32);
    assert.equal(ico[7], 32);
    const taille = ico.readUInt32LE(14);
    const decalage = ico.readUInt32LE(18);
    assert.equal(decalage, 22);
    assert.equal(decalage + taille, ico.length);
    const png = ico.subarray(decalage);
    assert.ok(png.subarray(0, 8).equals(SIGNATURE_PNG), 'signature PNG attendue');
    const ihdr = morceaux(png)[0];
    assert.equal(ihdr?.type, 'IHDR');
    assert.equal(ihdr.donnees.readUInt32BE(0), 32);
    assert.equal(ihdr.donnees.readUInt32BE(4), 32);
    assert.equal(morceaux(png).at(-1)?.type, 'IEND');
  });

  it('image : carré de la couleur principale, carré intérieur plus clair (palette de deux couleurs)', () => {
    const png = ico.subarray(22);
    const m = morceaux(png);
    const plte = m.find((c) => c.type === 'PLTE');
    assert.ok(plte);
    const hex = (o: number): string => `#${plte.donnees.subarray(o, o + 3).toString('hex').toUpperCase()}`;
    assert.equal(hex(0), COULEUR_ICONE);
    assert.equal(hex(3), COULEUR_FOND_ICONE);
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/base.css'), 'utf8');
    assert.match(css, new RegExp(`--encre: ${COULEUR_ICONE};`), 'couleur principale reprise de base.css (--encre)');
    assert.match(css, new RegExp(`--fond: ${COULEUR_FOND_ICONE};`), 'couleur claire reprise de base.css (--fond)');
    const brut = inflateSync(Buffer.concat(m.filter((c) => c.type === 'IDAT').map((c) => c.donnees)));
    const ligne = (y: number): number[] => {
      const octets = brut.subarray(y * 5 + 1, y * 5 + 5);
      const px: number[] = [];
      for (const o of octets) for (let b = 7; b >= 0; b--) px.push((o >> b) & 1);
      return px;
    };
    assert.ok(ligne(0).every((p) => p === 0), 'bord de la couleur principale');
    assert.ok(ligne(31).every((p) => p === 0));
    assert.equal(ligne(16)[0], 0);
    assert.equal(ligne(16)[16], 1, 'centre plus clair');
  });

  it('CLI : --check passe sur le fichier versionné, échoue (code 1) sur un fichier différent ; --sortie écrit', () => {
    const ok = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-favicon-'));
    try {
      const sortie = path.join(tmp, 'favicon.ico');
      const ecrit = spawnSync(process.execPath, [SCRIPT, '--sortie', sortie], { encoding: 'utf8' });
      assert.equal(ecrit.status, 0, ecrit.stderr);
      assert.ok(fs.readFileSync(sortie).equals(ico));
      fs.writeFileSync(sortie, Buffer.from([0, 0, 1, 0]));
      const ko = spawnSync(process.execPath, [SCRIPT, '--check', '--sortie', sortie], { encoding: 'utf8' });
      assert.equal(ko.status, 1, ko.stdout + ko.stderr);
      assert.equal(spawnSync(process.execPath, [SCRIPT, '--inconnue'], { encoding: 'utf8' }).status, 2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('en-tête du script : œuvre originale du dépôt, sans dépendance ni image tierce', () => {
    const texte = fs.readFileSync(SCRIPT, 'utf8');
    assert.match(texte.split('\n').slice(0, 12).join('\n'), /œuvre originale/);
    assert.doesNotMatch(texte, /from '(?!node:)[^']+'/, 'aucun module hors de node:');
    assert.doesNotMatch(texte, /[–—]/);
  });

  it('aucune balise <link rel="icon"> : le navigateur demande /favicon.ico de lui-même (poids des pages inchangé)', () => {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/layouts/Base.astro'), 'utf8'), /rel="icon"/);
  });
});
