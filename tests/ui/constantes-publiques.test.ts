// Constantes publiques partagées : dates des tours, profil 4G, clés du stockage local.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS } from '../../src/lib/dates-tours.ts';
import { PROFILS_4G } from '../../src/lib/profil-4g.ts';
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

  it('PROFILS_4G (WR-04, D-13) : profil historique nommé pour ce qu\'il simule, et « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse), 1 s pour les deux', () => {
    assert.deepEqual(PROFILS_4G, [
      {
        id: 'latence-150',
        libelle: 'une latence de 150 ms par requête et un débit de 1,6 Mbit/s',
        latenceRequeteMs: 150,
        debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024) / 8,
        debitMontantOctetsParSeconde: (750 * 1024) / 8,
        budgetMs: 1000,
      },
      {
        id: 'slow-4g-lighthouse',
        libelle: 'le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse : 562,5 ms de latence par requête, 1,44 Mbit/s)',
        latenceRequeteMs: 562.5,
        debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024 * 0.9) / 8,
        debitMontantOctetsParSeconde: (750 * 1024 * 0.9) / 8,
        // D-13 (08-05, choix d'Erwan du 2026-11-08) : 1 s pour les deux profils. Ne pas relever pour faire passer la CI.
        budgetMs: 1000,
      },
    ]);
    // Les libellés publiés disent les valeurs réellement appliquées.
    const [a, b] = PROFILS_4G;
    assert.ok(a!.libelle.includes(`${a!.latenceRequeteMs} ms`));
    assert.ok(b!.libelle.includes(`${b!.latenceRequeteMs.toLocaleString('fr-FR')} ms`));
    assert.ok(b!.libelle.includes(`${((b!.debitDescendantOctetsParSeconde * 8) / (1024 * 1024)).toLocaleString('fr-FR')} Mbit/s`));
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
