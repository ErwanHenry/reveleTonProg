// Constantes publiques partagées : dates des tours, profil 4G, clés du stockage local.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS } from '../../src/lib/dates-tours.ts';
import { PROFIL_4G } from '../../src/lib/profil-4g.ts';
import { CLES_STOCKAGE } from '../../src/lib/stockage-local.ts';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'scripts');

describe('constantes publiques', () => {
  it('TOURS : deux dimanches', () => {
    assert.deepEqual(TOURS.map((t) => [t.numero, t.date]), [[1, '2027-04-18'], [2, '2027-05-02']]);
    for (const t of TOURS) {
      const [a, m, j] = t.date.split('-').map(Number) as [number, number, number];
      assert.equal(new Date(Date.UTC(a, m - 1, j)).getUTCDay(), 0, t.date);
    }
  });

  it('PROFIL_4G', () => {
    assert.deepEqual(PROFIL_4G, {
      latenceMs: 150,
      debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024) / 8,
      debitMontantOctetsParSeconde: (750 * 1024) / 8,
      libelle: '150 ms, 1,6 Mbit/s',
    });
  });

  it('CLES_STOCKAGE : cohérent avec src/scripts/*.js', () => {
    assert.deepEqual(CLES_STOCKAGE, {
      niveau: { cle: 'rtp:niveau', valeurs: ['resume', 'detaille', 'enfant', 'aine'] },
      ordre: { cle: 'rtp:ordre', valeurs: ['alphabetique', 'aleatoire'] },
    });
    assert.match(readFileSync(path.join(SCRIPTS, 'niveau.js'), 'utf8'), /'rtp:niveau'/);
    assert.match(readFileSync(path.join(SCRIPTS, 'ordre.js'), 'utf8'), /'rtp:ordre'/);
    const trouvees = new Set<string>();
    for (const f of readdirSync(SCRIPTS).filter((n) => n.endsWith('.js'))) {
      for (const m of readFileSync(path.join(SCRIPTS, f), 'utf8').matchAll(/['"](rtp:[a-z]+)['"]/g)) trouvees.add(m[1] as string);
    }
    assert.deepEqual([...trouvees].sort(), Object.values(CLES_STOCKAGE).map((c) => c.cle).sort());
  });
});
