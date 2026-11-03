import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { lireCouverture } from '../../scripts/lib/couverture.ts';
import { verifierPilote } from '../../scripts/lib/pilote.ts';
import { MARQUEUR_GLOSSAIRE } from '../../src/lib/content-core/rules/config.ts';
import { slugGlossaire } from '../../src/lib/content-core/rules/references.ts';

// Corpus pilote réel, CONT-06 : marqueurs de glossaire résolus, partis et termes marqués dans les textes enfant.
// Limite connue : CI ne voit que les termes qui ont déjà une entrée de glossaire (relecture humaine pour le reste).

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { data } = lireCouverture(readFileSync(path.join(REPO_ROOT, 'data', 'couverture-themes.yaml'), 'utf8'));
const charge = loadAll(REPO_ROOT, { schemasDir: path.join(REPO_ROOT, 'schemas'), mode: 'preview' });
const glossaire = charge.entries.filter((e) => e.collection === 'glossaire');
const ids = new Set(glossaire.map((g) => g.id));

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

describe('glossaire du corpus pilote réel (CONT-06)', () => {
  it('ne signale ni parti ni terme non marqué dans les textes enfant', (t) => {
    const tous = verifierPilote(charge.entries, data);
    for (const p of tous.filter((x) => x.code === 'PILOTE_SIGLE_ENFANT')) t.diagnostic(`${p.code} ${p.fichier ?? ''} : ${p.message}`);
    const erreurs = tous.filter((p) => p.code === 'PILOTE_PARTI_NON_MARQUE' || p.code === 'PILOTE_TERME_NON_MARQUE');
    assert.deepEqual(erreurs.map((p) => `${p.code} ${p.fichier ?? ''} : ${p.message}`), []);
  });

  it('résout chaque marqueur des rédactions des mesures des thèmes pilotes vers une entrée de glossaire', () => {
    const pilotes = new Set(data.pilote.themes);
    for (const m of charge.entries.filter((e) => e.collection === 'mesures' && pilotes.has(texte(e.data.theme)))) {
      const red = (m.data.redactions ?? {}) as Record<string, unknown>;
      for (const [niveau, valeur] of Object.entries(red)) {
        for (const mq of texte(valeur).matchAll(MARQUEUR_GLOSSAIRE)) {
          const id = mq[2] ?? slugGlossaire(mq[1] ?? '');
          assert.ok(ids.has(id), `${m.id} (${niveau}) : marqueur « ${mq[0]} » sans entrée de glossaire « ${id} »`);
        }
      }
    }
  });

  it('donne source.type « parti » à chaque entrée de type parti', () => {
    for (const g of glossaire.filter((e) => e.data.type === 'parti')) {
      const source = (g.data.source ?? {}) as Record<string, unknown>;
      assert.equal(source.type, 'parti', `glossaire ${g.id} : source.type doit être « parti »`);
    }
  });
});
