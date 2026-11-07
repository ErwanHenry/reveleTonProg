// PERF-01 (D-06, D-07) : les deux scripts du site sont inclus tels quels dans chaque page et autorisés par leur
// empreinte sha256 dans la CSP. L'empreinte est calculée par Node sur les fichiers sources ; le navigateur hache
// le texte du <script> après avoir ramené CR LF à LF. Un fichier en CRLF ou précédé d'un BOM donnerait deux
// empreintes différentes et le script serait bloqué (Pitfall 6) : ce test garde les sources en LF, sans BOM.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { empreinteCsp, scriptsEnLigne } from '../../src/lib/csp-empreintes.ts';
import { LIMITES } from '../../scripts/lib/check-dist.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOSSIER = path.join(REPO, 'src', 'scripts');
const fichiersJs = fs
  .readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.js'))
  .sort();

describe('empreinteCsp', () => {
  it('vecteur connu : chaîne vide', () => {
    assert.equal(empreinteCsp(''), 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });

  it('même valeur pour une chaîne et ses octets UTF-8 (accents compris)', () => {
    const texte = 'var é = "à l’école";\n';
    assert.equal(empreinteCsp(texte), empreinteCsp(Buffer.from(texte, 'utf8')));
  });

  it('aucun trim : un retour ligne final change l’empreinte', () => {
    assert.notEqual(empreinteCsp('a'), empreinteCsp('a\n'));
  });
});

describe('scriptsEnLigne', () => {
  it('renvoie exactement niveau.js et ordre.js, triés par nom, empreinte des octets du fichier', () => {
    const scripts = scriptsEnLigne(REPO);
    assert.deepEqual(
      scripts.map((s) => s.nom),
      ['niveau.js', 'ordre.js'],
    );
    for (const s of scripts) {
      const octets = fs.readFileSync(path.join(DOSSIER, s.nom));
      assert.equal(s.empreinte, empreinteCsp(octets), s.nom);
      assert.equal(s.texte, octets.toString('utf8'), s.nom);
    }
  });
});

describe('src/scripts/*.js : octets stables pour le hachage', () => {
  it('au moins les deux scripts du site', () => {
    assert.deepEqual(fichiersJs, ['niveau.js', 'ordre.js']);
  });

  for (const f of fichiersJs) {
    it(`${f} : aucun \\r, aucun BOM, au plus ${LIMITES.script} octets UTF-8`, () => {
      const octets = fs.readFileSync(path.join(DOSSIER, f));
      assert.ok(!octets.includes(0x0d), `${f} contient un retour chariot (CR)`);
      assert.ok(!(octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf), `${f} commence par un BOM`);
      assert.ok(octets.length <= LIMITES.script, `${f} pèse ${octets.length} octets (limite ${LIMITES.script})`);
    });
  }

  it('.gitattributes impose LF sur src/scripts/*.js', () => {
    const lignes = fs.readFileSync(path.join(REPO, '.gitattributes'), 'utf8').split('\n').map((l) => l.trim());
    assert.ok(lignes.includes('src/scripts/*.js text eol=lf'), 'ligne « src/scripts/*.js text eol=lf » absente de .gitattributes');
  });
});
