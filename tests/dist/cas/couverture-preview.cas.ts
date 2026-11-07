// DETTE-01 (W3, D-11) : en preview, la phrase de couverture d'un thème ne compte jamais comme « publiée »
// une case qui ne tient que des brouillons ou des mesures relues. Preuve structurelle sur la build
// preview de corpus-m1 : le nombre annoncé est recompté sur les articles rendus de chaque page thème.
// La page thème montre la première mesure de chaque case (tri par titre) ; dans corpus-m1, une case qui
// tient une mesure publiée la montre en premier, donc le recomptage sur les articles est exact.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { aClasse, analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { materialiserCorpusM1, nettoyerCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

interface PageTheme {
  id: string;
  total: number;
  publiees: number;
  enAttente: number;
  phrase: string;
}

export default function couverturePreview(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1();
  after(nettoyerCorpusM1);

  const pagesTheme = (): PageTheme[] => {
    const b = ctx.construire('m1-preview', { racine, mode: 'preview' });
    assert.equal(b.status, 0, `astro build (preview) a échoué :\n${b.output}`);
    const themes = path.join(b.outDir, 'themes');
    const pages = ctx
      .pagesHtml(b.outDir)
      .filter((p) => path.dirname(path.dirname(p)) === themes && path.basename(p) === 'index.html');
    return pages.map((p) => {
      const arbre = analyserHtml(ctx.lire(b.outDir, path.relative(b.outDir, p).split(path.sep).join('/')));
      const cellules = trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
      const articles = (c: Noeud): Noeud[] => trouver(c, (n) => n.tag === 'article' && aClasse(n, 'mesure'));
      const publiee = (c: Noeud): boolean => articles(c).some((a) => a.attrs['data-statut-relecture'] === 'publie');
      const phrases = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'couverture'));
      assert.equal(phrases.length, 1, `${p} : une seule phrase de couverture attendue`);
      return {
        id: path.basename(path.dirname(p)),
        total: cellules.length,
        publiees: cellules.filter(publiee).length,
        enAttente: cellules.filter((c) => articles(c).length > 0 && !publiee(c)).length,
        phrase: norm(texte(phrases[0] as Noeud)),
      };
    });
  };

  describe('preview : phrase de couverture honnête (W3)', () => {
    it('W3 : le jeu preview contient au moins un thème avec une case qui ne tient qu’un brouillon', () => {
      const pages = pagesTheme();
      assert.ok(pages.length >= 3, `pages thème trouvées : ${pages.map((x) => x.id).join(', ')}`);
      assert.ok(
        pages.some((x) => x.enAttente > 0),
        'aucune case en attente : le test ne prouverait rien',
      );
    });

    it('W3 : le nombre de positions publiées annoncé égale les cases qui tiennent une mesure publie', () => {
      for (const x of pagesTheme()) {
        const n = x.publiees;
        const publieeAttendue = `${n} ${n > 1 ? 'candidats' : 'candidat'} sur ${x.total} ${n > 1 ? 'ont' : 'a'} une position publiée`;
        if (n > 0 || x.enAttente === 0) {
          assert.ok(x.phrase.includes(publieeAttendue), `${x.id} : « ${publieeAttendue} » attendu dans « ${x.phrase} »`);
        } else {
          assert.ok(!x.phrase.includes('position publiée'), `${x.id} : aucune position publiée, phrase « ${x.phrase} »`);
        }
        assert.equal((x.phrase.match(/position publiée/g) ?? []).length, n > 0 || x.enAttente === 0 ? 1 : 0, x.id);
      }
    });

    it('W3 : les cases en attente sont annoncées comme rédigées mais pas encore publiées', () => {
      for (const x of pagesTheme()) {
        const n = x.enAttente;
        if (n === 0) {
          assert.ok(!x.phrase.includes('rédigée'), `${x.id} : « ${x.phrase} »`);
          continue;
        }
        const verbe = `${n > 1 ? 'ont' : 'a'} une position rédigée mais pas encore publiée`;
        const sujet = x.publiees > 0 ? `${n}` : `${n} ${n > 1 ? 'candidats' : 'candidat'} sur ${x.total}`;
        assert.ok(x.phrase.includes(`, ${sujet} ${verbe}`) || x.phrase.includes(`Sur ce thème, ${sujet} ${verbe}`), `${x.id} : « ${x.phrase} »`);
      }
    });

    it('W3 : logement, Élise (brouillon seul) n’est pas comptée comme publiée', () => {
      const logement = pagesTheme().find((x) => x.id === 'logement');
      assert.ok(logement);
      assert.equal(
        logement.phrase,
        "Sur ce thème, 1 candidat sur 4 a une position publiée, 1 a une position rédigée mais pas encore publiée, 2 n'ont pas publié de programme.",
      );
    });
  });
}
