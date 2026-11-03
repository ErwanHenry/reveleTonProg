// Page thème (/themes/<id>/) construite sur la surcouche fictive corpus-m1, en production et en preview.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { TRAPPE_BROUILLON, materialiserCorpusM1, nettoyerCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const enfantsElements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');

export default function theme(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1();
  after(nettoyerCorpusM1);

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
  const page = (outDir: string, chemin: string): { html: string; arbre: Noeud } => {
    const html = ctx.lire(outDir, chemin);
    return { html, arbre: analyserHtml(html) };
  };
  const cellules = (arbre: Noeud): Noeud[] => trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
  const nomDe = (c: Noeud): string => norm(texte(trouver(c, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud));
  const carte = (arbre: Noeud, nom: string): Noeud => {
    const c = cellules(arbre).find((x) => nomDe(x) === nom);
    assert.ok(c, `carte « ${nom} » absente`);
    return c;
  };

  describe('production', () => {
    it('construit logement et climat, pas ecole', () => {
      const { outDir } = production();
      assert.ok(fs.existsSync(path.join(outDir, 'themes', 'logement', 'index.html')));
      assert.ok(fs.existsSync(path.join(outDir, 'themes', 'climat', 'index.html')));
      assert.ok(!fs.existsSync(path.join(outDir, 'themes', 'ecole')), 'le thème relu ne doit pas être publié');
    });

    it('logement : trois cartes dans le rang alphabétique (Érard avant Fictive)', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const cs = cellules(arbre);
      assert.deepEqual(
        cs.map((c) => c.attrs['data-rang']),
        ['0', '1', '2'],
      );
      assert.deepEqual(cs.map(nomDe), ['Élise Érard', 'Marie Fictive', 'Jean Imaginaire']);
      assert.equal(trouver(arbre, (n) => n.tag === 'ul' && aClasse(n, 'cellules'))[0]?.attrs['data-ordonnable'] !== undefined, true);
    });

    it('carte de Marie : une seule mesure, « 1 autre mesure »', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const marie = carte(arbre, 'Marie Fictive');
      const mesures = trouver(marie, (n) => n.tag === 'article' && aClasse(n, 'mesure'));
      assert.equal(mesures.length, 1);
      assert.equal(norm(texte(trouver(mesures[0] as Noeud, (n) => aClasse(n, 'mesure-titre'))[0] as Noeud)), 'Aide à la construction dans les zones tendues (fictif)');
      assert.match(norm(texte(trouver(marie, (n) => aClasse(n, 'cellule-pied'))[0] as Noeud)), /^1 autre mesure\b/);
    });

    it('chaque mesure a quatre rédactions étiquetées, dans l’ordre des niveaux', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const mesure = trouver(arbre, (n) => n.tag === 'article' && aClasse(n, 'mesure'))[0] as Noeud;
      const redactions = trouver(mesure, (n) => aClasse(n, 'redaction'));
      assert.deepEqual(
        redactions.map((r) => r.attrs['data-niveau']),
        ['resume', 'detaille', 'enfant', 'aine'],
      );
      const libelles = ['En bref', 'En détail', 'Pour les enfants', 'Gros caractères'];
      redactions.forEach((r, i) => {
        const premier = enfantsElements(r)[0] as Noeud;
        assert.ok(aClasse(premier, 'etiquette'), `la rédaction ${i} commence par .etiquette`);
        assert.equal(norm(texte(premier)), libelles[i]);
      });
      const detail = redactions[1] as Noeud;
      assert.equal(trouver(detail, (n) => n.tag === 'blockquote' && n.attrs['data-citation'] !== undefined).length, 1);
      assert.equal(mesure.attrs['data-statut-relecture'], 'publie');
      const source = trouver(mesure, (n) => aClasse(n, 'source'))[0] as Noeud;
      assert.ok(trouver(source, (n) => n.tag === 'time' && /^\d{4}-\d{2}-\d{2}$/.test(n.attrs.datetime ?? '')).length > 0);
    });

    it('états vides typés et datés (Élise, Jean), sources consultées', () => {
      const { html, arbre } = page(production().outDir, 'themes/logement/index.html');
      const elise = carte(arbre, 'Élise Érard');
      assert.equal(trouver(elise, (n) => aClasse(n, 'mesure')).length, 0);
      const vide = norm(texte(trouver(elise, (n) => aClasse(n, 'vide'))[0] as Noeud));
      assert.match(vide, /^Non précisé dans les sources consultées le 24 octobre 2026\.$/);
      assert.ok(trouver(elise, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-24' && norm(texte(n)) === '24 octobre 2026').length >= 1);
      assert.ok(norm(texte(elise)).includes("Sources consultées : Programme commun fictif d'Élise Érard et Jean Imaginaire."));
      const jean = carte(arbre, 'Jean Imaginaire');
      assert.match(norm(texte(trouver(jean, (n) => aClasse(n, 'vide'))[0] as Noeud)), /^Programme non publié à ce jour\. Vérifié le 21 octobre 2026\.$/);
      assert.ok(trouver(jean, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-21').length === 1);
      assert.ok(html.includes('Programme non publié à ce jour. Vérifié le'));
    });

    it('phrase de couverture exacte', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const p = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'couverture'))[0] as Noeud;
      assert.equal(
        norm(texte(p)),
        "Sur ce thème, 1 candidat sur 3 a une position publiée, 1 n'a rien de précisé dans les sources consultées, 1 n'a pas publié de programme.",
      );
    });

    it('« Ne se présentent pas » : renonce relu, sans carte ; autres personnalités comptées', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const d = trouver(arbre, (n) => n.tag === 'details' && aClasse(n, 'renonce'))[0] as Noeud;
      assert.ok(d, 'section details.renonce');
      assert.equal(norm(texte(trouver(d, (n) => n.tag === 'summary')[0] as Noeud)), 'Ne se présentent pas (1)');
      assert.equal(d.attrs.open, undefined, 'fermée par défaut');
      assert.ok(norm(texte(d)).includes('Luc Retiré : retrait de la candidature. 25 octobre 2026.'));
      assert.ok(trouver(d, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-25').length === 1);
      assert.equal(trouver(d, (n) => aClasse(n, 'cellule')).length, 0);
      const autres = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'autres-personnalites'))[0] as Noeud;
      assert.equal(norm(texte(autres)), '2 autres personnalités du jeu de données ne figurent pas ici : voir la liste complète des candidats.');
    });

    it('pied de page : date de mise à jour = maximum des dates affichées ; canari d’espace', () => {
      const { html } = page(production().outDir, 'themes/logement/index.html');
      assert.match(html, /Dernière mise à jour des contenus de cette page :\s*<time datetime="2026-10-26">26 octobre 2026<\/time>/);
      assert.match(html, /<\/span>\s+n'utilise aucun cookie/);
      const climat = page(production().outDir, 'themes/climat/index.html').html;
      assert.match(climat, /<time datetime="2026-10-25">25 octobre 2026<\/time>/);
    });

    it('aucun octet de brouillon dans le dist de production', () => {
      const { outDir } = production();
      for (const f of ctx.fichiers(outDir)) {
        const contenu = fs.readFileSync(f, 'utf8');
        assert.ok(!contenu.includes(TRAPPE_BROUILLON), `${path.relative(outDir, f)} contient le titre du brouillon`);
      }
    });

    it('aucun marqueur de glossaire littéral', () => {
      const { outDir } = production();
      for (const f of ctx.pagesHtml(outDir)) assert.ok(!fs.readFileSync(f, 'utf8').includes('[['), `${path.relative(outDir, f)} contient « [[ »`);
    });

    it('checkDist ne signale aucune erreur en production', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });

  describe('preview', () => {
    it('le thème relu est construit : quatre cases non vérifiées', () => {
      const { arbre } = page(preview().outDir, 'themes/ecole/index.html');
      const cs = cellules(arbre);
      assert.equal(cs.length, 4);
      for (const c of cs) assert.ok(norm(texte(c)).includes('Case non vérifiée : à compléter avant publication.'));
    });

    it('la mesure en brouillon est visible sur la carte d’Élise', () => {
      const { arbre } = page(preview().outDir, 'themes/logement/index.html');
      assert.ok(norm(texte(carte(arbre, 'Élise Érard'))).includes(TRAPPE_BROUILLON));
    });
  });

  describe('CSS externe', () => {
    for (const cle of ['production', 'preview'] as const) {
      it(`${cle} : feuille de style dans _astro/, aucun <style> ni style="" dans le HTML`, () => {
        const { outDir } = cle === 'production' ? production() : preview();
        const css = ctx.fichiers(outDir).filter((f) => f.includes(`${path.sep}_astro${path.sep}`) && f.endsWith('.css'));
        assert.ok(css.length >= 1, 'au moins une feuille .css dans dist/_astro/');
        for (const f of ctx.pagesHtml(outDir)) {
          const html = fs.readFileSync(f, 'utf8');
          assert.ok(!/<style/i.test(html), `${path.relative(outDir, f)} contient <style`);
          assert.ok(!/\sstyle=/i.test(html), `${path.relative(outDir, f)} contient style=`);
        }
      });
    }
  });
}
