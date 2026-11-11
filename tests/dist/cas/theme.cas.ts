// Page thème (/themes/<id>/) construite sur la surcouche fictive corpus-m1, en production et en preview.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { parse as parseYaml } from 'yaml';
import { formatDate } from '../../../src/lib/corpus/vue.ts';
import { lienExtrait } from '../../../src/lib/corpus/signalement.ts';
import type { Source } from '../../../src/lib/corpus/types.ts';
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

    it('W10 : états vides typés et datés (Élise, Jean), sources consultées avec lien, date et extrait', () => {
      const { html, arbre } = page(production().outDir, 'themes/logement/index.html');
      const elise = carte(arbre, 'Élise Érard');
      assert.equal(trouver(elise, (n) => aClasse(n, 'mesure')).length, 0);
      const vide = norm(texte(trouver(elise, (n) => aClasse(n, 'vide'))[0] as Noeud));
      assert.match(vide, /^Non précisé dans les sources consultées le 24 octobre 2026\.$/);
      assert.ok(trouver(elise, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-24' && norm(texte(n)) === '24 octobre 2026').length >= 1);
      const blocs = trouver(elise, (n) => n.tag === 'div' && aClasse(n, 'source') && aClasse(n, 'sources-consultees'));
      assert.equal(blocs.length, 1, 'un div.source.sources-consultees');
      const bloc = blocs[0] as Noeud;
      const [entete, liste] = enfantsElements(bloc);
      assert.equal(entete?.tag, 'p');
      assert.equal(norm(texte(entete as Noeud)), 'Sources consultées :');
      assert.equal(liste?.tag, 'ul');
      assert.equal(liste?.attrs.role, 'list', 'IN-03 : sémantique de liste gardée malgré list-style: none');
      const entrees = enfantsElements(liste as Noeud);
      assert.equal(entrees.length, 1);
      const li = entrees[0] as Noeud;
      assert.equal(li.tag, 'li');
      const titre = "Programme commun fictif d'Élise Érard et Jean Imaginaire";
      const cite = trouver(li, (n) => n.tag === 'span' && n.attrs['data-citation'] !== undefined);
      assert.equal(cite.length, 1);
      assert.equal(norm(texte(cite[0] as Noeud)), titre);
      const lignes = enfantsElements(li).map((e) => norm(texte(e, (x) => aClasse(x, 'sr-only'))));
      assert.deepEqual(lignes, [
        titre,
        'Consultée le 24 octobre 2026',
        'Lire le document original',
        'Copie archivée (Wayback Machine)',
        'Extrait archivé, empreinte sha256 c3107ed7287b',
      ]);
      const t = trouver(li, (n) => n.tag === 'time');
      assert.equal(t.length, 1);
      assert.equal(t[0]?.attrs.datetime, '2026-10-24');
      const [original, wayback, extrait, ...reste] = trouver(li, (n) => n.tag === 'a');
      assert.equal(reste.length, 0, 'trois liens exactement');
      assert.equal(original?.attrs.href, 'https://programme-commun.exemple.invalid/programme');
      assert.equal(wayback?.attrs.href, 'https://web.archive.org/web/20261024100000/https://programme-commun.exemple.invalid/programme');
      assert.equal(extrait?.attrs.href, lienExtrait('ErwanHenry/reveleTonProg', 'archives/programme-commun-fictif/c3107ed7287b.txt', racine, ctx.repoRoot));
      assert.match(extrait?.attrs.href ?? '', /^https:\/\/github\.com\/ErwanHenry\/reveleTonProg\/blob\/main\/archives\/programme-commun-fictif\/c3107ed7287b\.txt$/);
      for (const a of [original, wayback, extrait] as Noeud[]) {
        assert.equal(a.attrs.rel, 'noopener noreferrer');
        const sr = trouver(a, (n) => n.tag === 'span' && aClasse(n, 'sr-only'));
        assert.equal(sr.length, 1, `suffixe .sr-only dans « ${norm(texte(a))} »`);
        assert.equal(norm(texte(sr[0] as Noeud)), `: ${titre}`);
      }
      assert.equal(norm(texte(original as Noeud)), `Lire le document original : ${titre}`);
      const jean = carte(arbre, 'Jean Imaginaire');
      assert.match(norm(texte(trouver(jean, (n) => aClasse(n, 'vide'))[0] as Noeud)), /^Programme non publié à ce jour\. Vérifié le 21 octobre 2026\.$/);
      assert.ok(trouver(jean, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-21').length === 1);
      assert.ok(html.includes('Programme non publié à ce jour. Vérifié le'));
    });

    it('W10 : chaque source consultée de chaque page (production et preview) a titre, date, original, extrait et Wayback si elle existe', () => {
      const dossier = path.join(racine, 'src', 'content', 'sources');
      const parTitre = new Map<string, Source>();
      for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith('.yaml'))) {
        const s = parseYaml(fs.readFileSync(path.join(dossier, f), 'utf8')) as Source;
        parTitre.set(s.titre, s);
      }
      let vues = 0;
      for (const b of [production(), preview()]) {
        for (const f of ctx.pagesHtml(b.outDir)) {
          const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
          const entrees = trouver(
            arbre,
            (n) => n.tag === 'li' && n.parent?.tag === 'ul' && n.parent.parent !== null && aClasse(n.parent.parent, 'sources-consultees'),
          );
          for (const li of entrees) {
            vues++;
            const ou = path.relative(b.outDir, f);
            const titre = norm(texte(trouver(li, (n) => n.tag === 'span' && n.attrs['data-citation'] !== undefined)[0] as Noeud));
            const s = parTitre.get(titre);
            assert.ok(s, `${ou} : titre « ${titre} » inconnu des sources`);
            const t = trouver(li, (n) => n.tag === 'time');
            assert.equal(t.length, 1, ou);
            assert.equal(t[0]?.attrs.datetime, s.date_consultation, ou);
            assert.equal(norm(texte(t[0] as Noeud)), formatDate(s.date_consultation), ou);
            const hrefs = trouver(li, (n) => n.tag === 'a').map((a) => a.attrs.href);
            const attendus = [
              s.url,
              ...(s.archive.wayback_url === undefined ? [] : [s.archive.wayback_url]),
              lienExtrait('ErwanHenry/reveleTonProg', s.archive.extrait, racine, ctx.repoRoot),
            ];
            assert.deepEqual(hrefs, attendus, ou);
            assert.ok(norm(texte(li)).includes(`Extrait archivé, empreinte sha256 ${s.archive.sha256.slice(0, 12)}`), ou);
          }
        }
      }
      assert.ok(vues >= 2, `entrées de sources consultées vues : ${vues}`);
    });

    it('phrase de couverture exacte', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const p = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'couverture'))[0] as Noeud;
      assert.equal(
        norm(texte(p)),
        "Sur ce thème, 1 candidat sur 3 a une position publiée, 1 n'a rien de précisé dans les sources consultées, 1 n'a pas publié de programme.",
      );
    });

    it('« Ne se présentent pas » : renonce relu, sans carte ; aucune autre personnalité en production', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const d = trouver(arbre, (n) => n.tag === 'details' && aClasse(n, 'renonce'))[0] as Noeud;
      assert.ok(d, 'section details.renonce');
      assert.equal(norm(texte(trouver(d, (n) => n.tag === 'summary')[0] as Noeud)), 'Ne se présentent pas (1)');
      assert.equal(d.attrs.open, undefined, 'fermée par défaut');
      assert.ok(norm(texte(d)).includes('Luc Retiré : retrait de la candidature. 25 octobre 2026.'));
      assert.ok(trouver(d, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-25').length === 1);
      assert.equal(trouver(d, (n) => aClasse(n, 'cellule')).length, 0);
      // Paul et Nina (aucun statut relu) sont absents de la production (plan 09-15) : plus aucune autre personnalité à compter.
      assert.equal(trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'autres-personnalites')).length, 0);
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

  // ADR-056 : CSS et scripts sont dans chaque page ; plus aucun fichier .css ni .js n'est servi.
  describe('CSS en ligne', () => {
    for (const cle of ['production', 'preview'] as const) {
      it(`${cle} : une <style> par page, aucun fichier .css ni .js, aucun style=`, () => {
        const { outDir } = cle === 'production' ? production() : preview();
        assert.equal(fs.existsSync(path.join(outDir, '_astro')), false, 'dist/_astro/ ne doit plus exister');
        const externes = ctx.fichiers(outDir).filter((f) => /\.(css|js)$/i.test(f));
        assert.deepEqual(externes.map((f) => path.relative(outDir, f)), [], 'aucun fichier .css ni .js dans le dist');
        const pages = ctx.pagesHtml(outDir);
        assert.ok(pages.length > 10, `${pages.length} pages`);
        for (const f of pages) {
          const rel = path.relative(outDir, f);
          const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
          const styles = trouver(arbre, (n) => n.tag === 'style');
          assert.equal(styles.length, 1, `${rel} : ${styles.length} <style> (une seule attendue)`);
          assert.equal(styles[0]?.parent?.tag, 'head', `${rel} : la <style> est dans <head>`);
          assert.notEqual(texte(styles[0] as Noeud), '', `${rel} : <style> vide`);
          const avecStyle = trouver(arbre, (n) => n.attrs.style !== undefined);
          assert.deepEqual(avecStyle.map((n) => n.tag), [], `${rel} : attribut style=`);
        }
      });
    }
  });
}
