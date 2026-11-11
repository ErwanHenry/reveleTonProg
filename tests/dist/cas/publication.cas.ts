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

  // PUB-03 (D-05) : « Relue par <relecteur> le <date>. », un seul paragraphe par mesure, hors des quatre niveaux.
  const pagesDeThemes = (outDir: string): string[] => {
    const dossier = path.join(outDir, 'themes');
    return fs
      .readdirSync(dossier)
      .map((id) => path.join(dossier, id, 'index.html'))
      .filter((f) => fs.existsSync(f));
  };
  const articles = (html: string): string[] => html.match(/<article class="mesure"[\s\S]*?<\/article>/g) ?? [];

  it('PUB-03 : en production, chaque mesure porte une seule ligne de relecture, lue dans son YAML', () => {
    const { outDir } = production();
    const yaml = fs.readFileSync(path.join(racine, 'src', 'content', 'mesures', 'marie-fictive', 'aide-construction.yaml'), 'utf8');
    const relecteur = /^relecteur: (.+)$/m.exec(yaml)?.[1];
    const date = /^date_relecture: (\d{4}-\d{2}-\d{2})$/m.exec(yaml)?.[1];
    assert.ok(relecteur !== undefined && date !== undefined);
    let vues = 0;
    let nommee = 0;
    for (const f of pagesDeThemes(outDir)) {
      for (const a of articles(fs.readFileSync(f, 'utf8'))) {
        vues++;
        const lignes = a.match(/<p class="relecture" data-relecture[^>]*>[\s\S]*?<\/p>/g) ?? [];
        assert.equal(lignes.length, 1, `une ligne de relecture attendue par mesure dans ${f}`);
        assert.match(lignes[0] ?? '', /^<p class="relecture" data-relecture>Relue par [^<]+ le <time datetime="\d{4}-\d{2}-\d{2}">[^<]+<\/time>\.<\/p>$/);
        // hors de tout bloc de niveau de lecture : visible quel que soit le niveau, sans JS
        const redactions = a.match(/<div class="redaction"[\s\S]*?<\/div>/g) ?? [];
        assert.ok(redactions.every((r) => !r.includes('data-relecture')));
        if (a.includes('id="m-marie-fictive-aide-construction"')) {
          nommee++;
          assert.ok((lignes[0] ?? '').includes(`Relue par ${relecteur} le `));
          assert.ok((lignes[0] ?? '').includes(`datetime="${date}"`));
        }
      }
    }
    assert.ok(vues > 0, 'aucune mesure vue');
    assert.equal(nommee, 1, 'la mesure fixture nommée doit apparaître une fois');
  });

  it('PUB-03 : en preview, un brouillon n’a pas de ligne de relecture', () => {
    const preview = ctx.construire('m1-preview', { racine: materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-relecture-preview')), mode: 'preview' });
    assert.equal(preview.status, 0, `astro build (preview) a échoué :\n${preview.output}`);
    let brouillons = 0;
    for (const f of pagesDeThemes(preview.outDir)) {
      for (const a of articles(fs.readFileSync(f, 'utf8'))) {
        if (a.includes('data-statut-relecture="brouillon"')) {
          brouillons++;
          assert.ok(!a.includes('data-relecture'));
        }
      }
    }
    assert.ok(brouillons > 0, 'le jeu preview doit contenir un brouillon');
  });

  it('PUB-03 : check-dist sur le build de production ne signale pas RELECTURE_ABSENTE', () => {
    const { outDir } = production();
    const { themesOuverts } = loadPublicationConfig(racine);
    const constats = checkDist(outDir, {
      mode: 'production',
      themesOuverts,
      cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production', themesOuverts),
    });
    assert.deepEqual(constats.filter((c) => c.code === 'RELECTURE_ABSENTE' || c.code.startsWith('POIDS_')), []);
  });
}
