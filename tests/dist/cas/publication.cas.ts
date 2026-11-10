// Liste blanche de publication (D-07) sur le site construit : le corpus M1 en production liste logement et climat,
// check-dist ne dit rien ; une liste plus courte est refusée par le validateur (le build échoue fermé) et par check-dist.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadAll } from '../../../src/lib/content-core/load.ts';
import { loadPublicationConfig } from '../../../src/lib/publication-config.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import { SCHEMAS_DIR } from '../../helpers/validate-yaml.ts';
import type { ContexteSite } from '../contexte.ts';

export default function publication(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-publication'));
  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };

  it('production : pages de logement et climat, check-dist sans erreur avec la liste du corpus', () => {
    const { outDir } = production();
    const { themesOuverts } = loadPublicationConfig(racine);
    assert.deepEqual(themesOuverts, ['logement', 'climat']);
    assert.ok(fs.existsSync(path.join(outDir, 'themes', 'logement', 'index.html')));
    assert.ok(fs.existsSync(path.join(outDir, 'themes', 'climat', 'index.html')));
    const constats = checkDist(outDir, {
      mode: 'production',
      themesOuverts,
      cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production', themesOuverts),
    });
    assert.deepEqual(constats.filter((c) => c.code.startsWith('THEME_') || c.code === 'PUBLICATION_VIDE'), []);
  });

  it('une liste réduite à logement : le validateur refuse climat, check-dist refuse sa page', () => {
    const { outDir } = production();
    const copie = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-liste-courte'));
    fs.writeFileSync(path.join(copie, 'config', 'publication.yml'), 'themes_ouverts:\n  - logement\n');
    const res = loadAll(copie, { schemasDir: SCHEMAS_DIR, mode: 'production' });
    const refus = res.diagnostics.filter((d) => d.code === 'PUBLICATION_THEME_NON_OUVERT');
    assert.equal(refus.length, 1);
    assert.equal(refus[0]?.severity, 'error');
    assert.match(refus[0]?.file ?? '', /themes[\\/]climat\.yaml$/);

    const constats = checkDist(outDir, { mode: 'production', themesOuverts: ['logement'] });
    const hors = constats.filter((c) => c.code === 'THEME_HORS_LISTE_BLANCHE');
    assert.equal(hors.length, 1);
    assert.equal(hors[0]?.severite, 'erreur');
    assert.match(hors[0]?.fichier ?? '', /climat/);
  });
}
