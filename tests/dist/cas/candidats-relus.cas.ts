// Personnes sans statut relu (D-06, décision 2a, plan 09-15) : absentes de la build de production, présentes en preview.
// Surcouche fictive corpus-m1 : paul-de-villefranche (déclaré, brouillon) et nina-pressentie (pressenti, brouillon) n'ont
// aucun statut relu ou publié. Réutilise les builds « m1-production » et « m1-preview » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { loadAll } from '../../../src/lib/content-core/load.ts';
import { construireCorpus } from '../../../src/lib/corpus/vue.ts';
import type { Brut } from '../../../src/lib/corpus/vue.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import { SCHEMAS_DIR } from '../../helpers/validate-yaml.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));

const ECARTES = ['paul-de-villefranche', 'nina-pressentie'];
const NOMS_ECARTES = ['Paul de Villefranche', 'Villefranche', 'Nina Pressentie'];
const RETENUS = ['elise-erard', 'marie-fictive', 'jean-imaginaire', 'luc-retire'];

export default function candidatsRelus(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-candidats-relus'));

  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const preview = () => {
    const b = ctx.construire('m1-preview', { racine, mode: 'preview' });
    assert.equal(b.status, 0, `astro build (preview) a échoué :\n${b.output}`);
    return b;
  };
  const arbre = (outDir: string, chemin: string): Noeud => analyserHtml(ctx.lire(outDir, chemin));
  const posix = (outDir: string, f: string): string => path.relative(outDir, f).split(path.sep).join('/');

  // Vue-modèle de la fixture en production : taille réelle du périmètre, jamais un nombre recopié.
  const vueProduction = () => {
    const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
    const de = <T>(collection: string): T[] => res.entries.filter((e) => e.collection === collection).map((e) => e.data as unknown as T);
    const brut: Brut = {
      themes: de('themes'),
      candidats: de('candidats'),
      mesures: de('mesures'),
      sources: de('sources'),
      couverture: de('couverture'),
      glossaire: de('glossaire'),
    };
    return construireCorpus(brut, 'production');
  };

  describe('production : personnes sans statut relu absentes (D-06, PUB-02)', () => {
    it('aucune page candidats/<id>/ pour Paul et Nina, une page pour chaque personne retenue', () => {
      const { outDir } = production();
      for (const id of ECARTES) assert.equal(fs.existsSync(path.join(outDir, 'candidats', id)), false, `candidats/${id}/ construit`);
      for (const id of RETENUS) assert.ok(fs.existsSync(path.join(outDir, 'candidats', id, 'index.html')), `candidats/${id}/index.html`);
    });

    it('/candidats/ : quatre lignes, rangs 0 à 3, intro et description honnêtes, phrase data-non-relus avec 2', () => {
      const html = ctx.lire(production().outDir, 'candidats/index.html');
      const a = analyserHtml(html);
      const ul = trouver(a, (n) => n.tag === 'ul' && n.attrs['data-ordonnable'] !== undefined)[0] as Noeud;
      const lignes = trouver(ul, (n) => n.tag === 'li' && n.attrs['data-rang'] !== undefined);
      assert.deepEqual(
        lignes.map((l) => l.attrs['data-rang']),
        ['0', '1', '2', '3'],
      );
      assert.deepEqual(
        lignes.map((l) => trouver(l, (n) => n.tag === 'a')[0]?.attrs.href),
        RETENUS.map((id) => `/candidats/${id}/`),
      );
      assert.ok(
        txt(a).includes(
          "Les personnalités du jeu de données dont le statut a été relu, dans l'ordre choisi ci-dessus. Le statut est celui de la dernière source consultée.",
        ),
      );
      assert.ok(!txt(a).includes('Toutes les personnalités'), 'intro de preview en production');
      assert.ok(
        html.includes('content="Les personnalités du jeu de données dont le statut a été relu, avec leur parti revendiqué et leur statut."'),
        'meta description',
      );
      const p = trouver(a, (n) => n.tag === 'p' && n.attrs['data-non-relus'] !== undefined);
      assert.equal(p.length, 1, 'p[data-non-relus]');
      assert.equal(txt(p[0] as Noeud), '2 autres personnalités du jeu de données apparaîtront après relecture de leur statut.');
      assert.ok(!txt(a).includes('Statut en cours de vérification'));
    });

    it('sitemap.xml : aucune entrée pour Paul ni Nina, une entrée par personne retenue', () => {
      const xml = ctx.lire(production().outDir, 'sitemap.xml');
      for (const id of ECARTES) assert.ok(!xml.includes(`/candidats/${id}/`), `sitemap : ${id}`);
      for (const id of RETENUS) assert.ok(xml.includes(`/candidats/${id}/</loc>`), `sitemap : ${id} absent`);
    });

    it('aucun fichier du dist ne lie ni ne nomme Paul ou Nina (pages, sitemap, robots, version.json)', () => {
      const { outDir } = production();
      for (const f of ctx.fichiers(outDir)) {
        if (!/\.(html|xml|txt|json)$/.test(f)) continue;
        const contenu = fs.readFileSync(f, 'utf8');
        for (const id of ECARTES) assert.ok(!contenu.includes(id), `${posix(outDir, f)} contient « ${id} »`);
        for (const nom of NOMS_ECARTES) assert.ok(!contenu.includes(nom), `${posix(outDir, f)} nomme « ${nom} »`);
      }
    });

    it('page thème : aucune case ni « Ne se présentent pas » pour une personne écartée, lien « voir la liste des candidats » si la phrase existe', () => {
      const { outDir } = production();
      for (const chemin of ['themes/logement/index.html', 'themes/climat/index.html']) {
        const a = arbre(outDir, chemin);
        const hrefs = trouver(a, (n) => n.tag === 'a').map((n) => n.attrs.href ?? '');
        for (const id of ECARTES) assert.ok(!hrefs.some((h) => h.startsWith(`/candidats/${id}/`)), `${chemin} lie ${id}`);
        // Aucune personne retenue hors périmètre et hors renoncement dans la fixture : la phrase « autres personnalités »
        // n'a plus lieu d'être (Paul et Nina n'y sont plus comptés).
        assert.equal(trouver(a, (n) => n.tag === 'p' && aClasse(n, 'autres-personnalites')).length, 0, chemin);
        assert.ok(!txt(a).includes('liste complète'), `${chemin} : « liste complète » alors que des personnes sont écartées`);
      }
    });

    it('Méthode : p[data-personnalites-affichees] donne n, p et k lus dans le view-model (4, 3, 2)', () => {
      const vue = vueProduction();
      const n = vue.candidats.length;
      const p = vue.perimetre.size;
      const k = vue.nonRelus;
      assert.deepEqual([n, p, k], [4, 3, 2]);
      const a = arbre(production().outDir, 'methode/index.html');
      const el = trouver(a, (x) => x.tag === 'p' && x.attrs['data-personnalites-affichees'] !== undefined);
      assert.equal(el.length, 1, 'p[data-personnalites-affichees]');
      assert.equal(
        txt(el[0] as Noeud),
        `Ce site affiche ${n} personnalités dont le statut a été relu, dont ${p} candidatures déclarées ou à une primaire ; les ${k} autres personnalités du jeu de données apparaîtront après relecture de leur statut.`,
      );
      // Le paragraphe suit le bloc du jeu de données, sans le modifier.
      const main = trouver(a, (x) => x.tag === 'main')[0] as Noeud;
      const fils = main.enfants.filter((e): e is Noeud => typeof e !== 'string');
      const iDataset = fils.findIndex((x) => x.attrs['data-dataset'] !== undefined);
      assert.ok(iDataset >= 0 && fils[iDataset + 1]?.attrs['data-personnalites-affichees'] !== undefined, 'juste après div[data-dataset]');
    });
  });

  describe('preview : tout le monde reste visible', () => {
    it('pages de Paul et Nina avec leur pastille de brouillon, six lignes sur /candidats/, aucune phrase de production', () => {
      const { outDir } = preview();
      for (const id of ECARTES) {
        const a = arbre(outDir, `candidats/${id}/index.html`);
        const statut = trouver(a, (n) => n.tag === 'p' && aClasse(n, 'statut'))[0] as Noeud;
        assert.ok(statut, `${id} : p.statut`);
        assert.ok(trouver(statut, (n) => n.attrs['data-badge'] !== undefined && txt(n) === 'brouillon, non relu').length === 1, id);
      }
      const html = ctx.lire(outDir, 'candidats/index.html');
      const a = analyserHtml(html);
      const lignes = trouver(a, (n) => n.tag === 'li' && n.attrs['data-rang'] !== undefined);
      assert.equal(lignes.length, 6);
      assert.ok(txt(a).includes("Toutes les personnalités du jeu de données, dans l'ordre choisi ci-dessus. Le statut est celui de la dernière source consultée."));
      assert.ok(html.includes('content="Toutes les personnalités du jeu de données, avec leur parti revendiqué et leur statut."'));
      assert.equal(trouver(a, (n) => n.attrs['data-non-relus'] !== undefined).length, 0);
      const m = arbre(outDir, 'methode/index.html');
      assert.equal(trouver(m, (n) => n.attrs['data-personnalites-affichees'] !== undefined).length, 0);
      const theme = arbre(outDir, 'themes/logement/index.html');
      const autres = trouver(theme, (n) => n.tag === 'p' && aClasse(n, 'autres-personnalites'))[0] as Noeud;
      assert.equal(txt(autres), '1 autre personnalité du jeu de données ne figure pas ici : voir la liste complète des candidats.');
    });
  });
}
