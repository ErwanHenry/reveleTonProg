// Règle unique des initiales (U-02, 10.4) : logo de l'en-tête et vignettes des candidats.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { initiales } from '../../src/lib/initiales.ts';
import { INITIALE_SITE, NOM_SITE } from '../../src/lib/identite.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fichiersCandidats(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      fichiersCandidats(p, out);
    } else if (e.name.endsWith('.yaml') && p.includes(`${path.sep}src${path.sep}content${path.sep}candidats${path.sep}`)) out.push(p);
  }
  return out;
}

describe('initiales', () => {
  const cas: Array<[string, string]> = [
    ['Édouard Philippe', 'ÉP'],
    ['Marine Le Pen', 'MLP'],
    ['Jean-Luc Mélenchon', 'JLM'],
    ['Nicolas Dupont-Aignan', 'NDA'],
    ['Dominique de Villepin', 'DV'],
    ['Paul de Villefranche', 'PV'],
    ['Élise Érard', 'ÉÉ'],
    ["Valéry d'Estaing", 'VE'],
    ['Valéry d’Estaing', 'VE'],
    ['Révèle ton prog', 'R'],
    ['Zéro de conduite', 'Z'],
    ['Zéro Conduite', 'ZC'],
    ['Marine\u00A0Le\u202FPen', 'MLP'],
    ['Bruno Le Maire', 'BLM'],
    ['Benjamin Lucas-Lundy', 'BLL'],
    ['Marine Le Pen', 'MLP'],
    ['jean dupont', 'J'],
    ['   ', ''],
  ];
  for (const [nom, attendu] of cas) {
    it(`${JSON.stringify(nom)} donne ${JSON.stringify(attendu)}`, () => assert.equal(initiales(nom), attendu));
  }

  it('INITIALE_SITE est calculée depuis NOM_SITE', () => {
    assert.equal(initiales(NOM_SITE), INITIALE_SITE);
    assert.equal(INITIALE_SITE, 'R');
  });

  it('aucune sortie vide ni autre chose que des majuscules pour les candidats du dépôt et des fixtures', () => {
    let n = 0;
    for (const f of fichiersCandidats(ROOT)) {
      const d = parse(fs.readFileSync(f, 'utf8')) as { prenom?: unknown; nom?: unknown } | null;
      if (d === null || typeof d !== 'object' || typeof d.prenom !== 'string' || typeof d.nom !== 'string') continue;
      const i = initiales(`${d.prenom} ${d.nom}`);
      assert.match(i, /^\p{Lu}+$/u, `${f} : ${JSON.stringify(i)}`);
      n++;
    }
    assert.ok(n >= 30, `${n} noms vérifiés`);
  });
});
