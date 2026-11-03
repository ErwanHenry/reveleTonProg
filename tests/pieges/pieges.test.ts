import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PIEGES_DIR, comparer, construireRacine, executerPiege, lirePiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { PiegeSpec } from '../helpers/overlay.ts';

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const NOM_DOSSIER = /^([A-Z][A-Z0-9_]*)(?:--([a-z0-9]+(?:-[a-z0-9]+)*))?$/;

const dossiers = existsSync(PIEGES_DIR)
  ? readdirSync(PIEGES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

const base = (extra: Partial<PiegeSpec> = {}): PiegeSpec => ({ piege: 'base', regle: 'REGLE-11', attendu: [], ...extra });

describe('harnais de pièges : auto-contrôles', () => {
  it('le corpus de base sans patch ne produit aucun diagnostic (production et preview)', () => {
    assert.deepEqual(executerPiege(base({ mode: 'production' })), []);
    assert.deepEqual(executerPiege(base({ mode: 'preview' })), []);
  });

  it('au moins un dossier de piège existe', () => {
    assert.ok(dossiers.length > 0, 'tests/fixtures/pieges/ est vide');
  });

  it('un « de » absent du fichier lève une erreur', () => {
    assert.throws(
      () => construireRacine(base({ remplacer: [{ fichier: MESURE, de: 'texte-introuvable-xyz', par: '' }] })),
      /exactement une fois.*0 occurrence/s,
    );
  });

  it('un « de » présent deux fois lève une erreur', () => {
    assert.throws(
      () => construireRacine(base({ remplacer: [{ fichier: MESURE, de: 'Marie Fictive', par: 'X' }] })),
      /exactement une fois.*\d+ occurrence/s,
    );
  });

  it('un chemin avec « .. » est refusé', () => {
    assert.throws(() => construireRacine(base({ supprimer: ['../x'] })), /interdit/);
    assert.throws(() => construireRacine(base({ remplacer: [{ fichier: '../x', de: 'a', par: 'b' }] })), /interdit/);
  });

  it('comparer refuse un élément attendu en trop et un élément manquant', () => {
    const reel = [{ code: 'A', severite: 'error' as const, fichier: 'f.yaml', pointer: '', ligne: 1 }];
    comparer(reel, [{ code: 'A', severite: 'error', fichier: 'f.yaml', pointer: '' }]);
    assert.throws(() => comparer(reel, [...reel, { code: 'B', severite: 'error', fichier: 'f.yaml', pointer: '' }]));
    assert.throws(() => comparer([], reel));
    assert.throws(() => comparer(reel, []));
  });

  it('comparer distingue la sévérité, le pointeur et la ligne attendue', () => {
    const reel = [{ code: 'A', severite: 'error' as const, fichier: 'f.yaml', pointer: '/x', ligne: 4 }];
    assert.throws(() => comparer(reel, [{ code: 'A', severite: 'warning', fichier: 'f.yaml', pointer: '/x' }]));
    assert.throws(() => comparer(reel, [{ code: 'A', severite: 'error', fichier: 'f.yaml', pointer: '/y' }]));
    assert.throws(() => comparer(reel, [{ code: 'A', severite: 'error', fichier: 'f.yaml', pointer: '/x', ligne: 5 }]));
    comparer(reel, [{ code: 'A', severite: 'error', fichier: 'f.yaml', pointer: '/x', ligne: 4 }]);
  });
});

describe('pièges §12 : rejeu', () => {
  for (const nom of dossiers) {
    describe(nom, () => {
      const dossier = path.join(PIEGES_DIR, nom);
      it('attendu.json est bien formé et le nom du dossier est <CODE> ou <CODE>--<variante>', () => {
        assert.ok(NOM_DOSSIER.test(nom), `nom de dossier invalide : ${nom}`);
        const spec = lirePiege(dossier);
        assert.equal(typeof spec.piege, 'string');
        assert.ok(spec.piege.length > 0);
        assert.match(spec.regle, /^REGLE-\d{2}$/);
        assert.ok(Array.isArray(spec.attendu), '« attendu » doit être un tableau');
      });
      it('le piège est rejoué et les diagnostics correspondent exactement', () => {
        const spec = lirePiege(dossier);
        comparer(executerPiege(spec, dossier), spec.attendu);
      });
    });
  }
});

// Complété par la tâche 3 : le préfixe de code de chaque dossier existe dans CATALOGUE.
describe('pièges §12 : cohérence avec le catalogue', () => {
  it('à compléter', () => {
    assert.ok(true);
  });
});
