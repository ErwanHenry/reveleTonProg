// Ordre des candidats (M1-07) vérifié sur le site construit à partir du corpus fictif corpus-m1 :
// script dans <head>, contrôle caché dans le HTML, phrases d'aide, règles CSS de la mise en attente.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
/** Sans espace ni guillemet : un minifieur peut réécrire `[data-ordre="aleatoire"]` en `[data-ordre=aleatoire]`. */
const compact = (s: string): string => s.replace(/[\s"']+/g, '');

const AIDE =
  "Les candidats sont classés par ordre alphabétique du nom, jamais selon les sondages. L'ordre aléatoire change à chaque chargement de la page.";

export default function ordre(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'ordre'));

  const production = () => {
    const b = ctx.construire('ordre-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const preview = () => {
    const b = ctx.construire('ordre-preview', { racine, mode: 'preview' });
    assert.equal(b.status, 0, `astro build (preview) a échoué :\n${b.output}`);
    return b;
  };
  const page = (chemin: string): { html: string; arbre: Noeud } => {
    const html = ctx.lire(production().outDir, chemin);
    return { html, arbre: analyserHtml(html) };
  };
  const controle = (arbre: Noeud): Noeud => {
    const c = trouver(arbre, (n) => n.attrs['data-ordre-controle'] !== undefined);
    assert.equal(c.length, 1, 'un seul [data-ordre-controle]');
    return c[0] as Noeud;
  };
  const cssDist = (): string => {
    const { outDir } = production();
    return ctx
      .fichiers(outDir)
      .filter((f) => f.includes(`${path.sep}_astro${path.sep}`) && f.endsWith('.css'))
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');
  };
  const blocs = (css: string): { sel: string; decl: string }[] =>
    [...compact(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1] ?? '', decl: m[2] ?? '' }));

  describe('script dans <head>', () => {
    it('toutes les pages : <script src="/_astro/ordre.<hash>.js"> bloquant, sans corps, avant le <body>', () => {
      const { outDir } = production();
      const pages = ctx.pagesHtml(outDir);
      assert.ok(pages.length > 10);
      for (const f of pages) {
        const rel = path.relative(outDir, f);
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        const head = trouver(arbre, (n) => n.tag === 'head')[0] as Noeud;
        const scripts = elements(head).filter((n) => n.tag === 'script' && /ordre\./.test(n.attrs.src ?? ''));
        assert.equal(scripts.length, 1, `${rel} : un seul script ordre dans <head>`);
        const s = scripts[0] as Noeud;
        assert.match(s.attrs.src as string, /^\/_astro\/ordre\.[A-Za-z0-9_-]+\.js$/, rel);
        assert.equal(s.attrs.async, undefined, rel);
        assert.equal(s.attrs.defer, undefined, rel);
        assert.equal(s.attrs.type, undefined, rel);
        assert.equal(texte(s), '', `${rel} : aucun corps de script`);
        const fils = elements(head);
        // Astro place ses <link rel="stylesheet"> en fin de <head>, après les scripts is:inline : l'ordre script / feuille
        // n'a pas d'incidence (le script ne lit aucun style), l'essentiel est qu'il précède l'analyse du <body>.
        assert.ok(fils.some((n) => n.tag === 'link' && /(^|\s)stylesheet(\s|$)/i.test(n.attrs.rel ?? '')), `${rel} : feuille de style liée`);
      }
    });

    it('le fichier du dist pèse au plus 2048 octets et est identique à src/scripts/ordre.js', () => {
      const { outDir } = production();
      const { arbre } = page('candidats/index.html');
      const s = trouver(arbre, (n) => n.tag === 'script' && /ordre\./.test(n.attrs.src ?? ''))[0] as Noeud;
      const dist = fs.readFileSync(path.join(outDir, (s.attrs.src as string).slice(1)));
      assert.ok(dist.length <= 2048, `${dist.length} octets`);
      assert.ok(dist.equals(fs.readFileSync(path.join(ctx.repoRoot, 'src', 'scripts', 'ordre.js'))), 'octet pour octet identique à la source');
    });
  });

  describe('contrôle « Ordre des candidats »', () => {
    for (const chemin of ['themes/logement/index.html', 'candidats/index.html']) {
      it(`${chemin} : div caché, fieldset, 2 radios, zone d'annonce, aide visible`, () => {
        const { arbre } = page(chemin);
        const c = controle(arbre);
        assert.equal(c.tag, 'div');
        assert.notEqual(c.attrs.hidden, undefined, 'caché dans le HTML (révélé par le script)');
        const f = trouver(c, (n) => n.tag === 'fieldset');
        assert.equal(f.length, 1);
        assert.equal(norm(texte(trouver(f[0] as Noeud, (n) => n.tag === 'legend')[0] as Noeud)), 'Ordre des candidats');
        const radios = trouver(c, (n) => n.tag === 'input');
        assert.equal(radios.length, 2);
        const attendus: [string, string][] = [
          ['alphabetique', 'Ordre alphabétique'],
          ['aleatoire', 'Ordre aléatoire'],
        ];
        radios.forEach((r, i) => {
          const [valeur, libelle] = attendus[i] as [string, string];
          assert.equal(r.attrs.type, 'radio');
          assert.equal(r.attrs.name, 'ordre');
          assert.equal(r.attrs.value, valeur);
          assert.equal(r.attrs.autocomplete, 'off');
          assert.equal(r.attrs.checked !== undefined, valeur === 'alphabetique', `checked sur ${valeur}`);
          const label = trouver(c, (n) => n.tag === 'label' && n.attrs.for === r.attrs.id);
          assert.equal(label.length, 1, `un label pour ${valeur}`);
          assert.equal(norm(texte(label[0] as Noeud)), libelle);
        });
        assert.deepEqual(
          radios.map((r) => r.attrs.id),
          ['ordre-alpha', 'ordre-alea'],
        );
        const annonce = trouver(c, (n) => n.attrs['data-ordre-annonce'] !== undefined);
        assert.equal(annonce.length, 1);
        assert.equal((annonce[0] as Noeud).attrs.role, 'status');
        assert.equal(norm(texte(annonce[0] as Noeud)), '');
        // aide : hors du bloc caché, donc lisible sans JavaScript
        const aide = trouver(arbre, (n) => n.tag === 'p' && norm(texte(n)) === AIDE);
        assert.equal(aide.length, 1, 'phrase d’aide présente une fois');
        let p: Noeud | null = aide[0] as Noeud;
        while (p !== null) {
          assert.equal(p.attrs['data-ordre-controle'], undefined, 'l’aide n’est pas dans le bloc caché');
          p = p.parent;
        }
        const sansJs = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'ordre-aide-sansjs'));
        assert.equal(sansJs.length, 1);
        assert.equal(norm(texte(sansJs[0] as Noeud)), "L'ordre aléatoire demande JavaScript.");
        assert.equal(sansJs[0]?.attrs.hidden, undefined, 'visible sans JavaScript (masquée par le CSS quand le script a tourné)');
      });
    }

    it('page thème : après p.couverture et avant le h2 « Les candidats » ; ordre statique inchangé', () => {
      const { arbre } = page('themes/logement/index.html');
      const contenu = trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud;
      const fils = elements(contenu);
      const iCouv = fils.findIndex((n) => n.tag === 'p' && aClasse(n, 'couverture'));
      const iH2 = fils.findIndex((n) => n.tag === 'h2' && norm(texte(n)) === 'Les candidats');
      const iCtl = fils.findIndex((n) => n.attrs['data-ordre-controle'] !== undefined);
      const iAide = fils.findIndex((n) => n.tag === 'p' && norm(texte(n)) === AIDE);
      assert.ok(iCouv >= 0 && iH2 >= 0 && iCtl >= 0 && iAide >= 0, 'éléments présents dans .lecteur-contenu');
      assert.ok(iCouv < iAide && iCouv < iCtl && iAide < iH2 && iCtl < iH2, 'contrôle et aide entre la couverture et le h2');
      const cartes = trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
      assert.equal(norm(texte(trouver(cartes[0] as Noeud, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud)), 'Élise Érard');
      assert.deepEqual(
        cartes.map((c) => c.attrs['data-rang']),
        ['0', '1', '2', '5'],
      );
    });

    it('/candidats/ : le contrôle suit l’introduction et précède la liste ; ordre statique inchangé', () => {
      const { arbre } = page('candidats/index.html');
      const main = trouver(arbre, (n) => n.tag === 'main')[0] as Noeud;
      const fils = elements(main);
      const iIntro = fils.findIndex((n) => n.tag === 'p' && norm(texte(n)).startsWith('Toutes les personnalités'));
      const iCtl = fils.findIndex((n) => n.attrs['data-ordre-controle'] !== undefined);
      const iListe = fils.findIndex((n) => n.tag === 'ul' && n.attrs['data-ordonnable'] !== undefined);
      assert.ok(iIntro >= 0 && iCtl >= 0 && iListe >= 0);
      assert.ok(iIntro < iCtl && iCtl < iListe);
      const rangs = trouver(fils[iListe] as Noeud, (n) => n.tag === 'li' && n.attrs['data-rang'] !== undefined).map((l) => Number(l.attrs['data-rang']));
      assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
      assert.equal(rangs[0], 0);
    });
  });

  describe('CSS de mise en attente du tirage', () => {
    it('listes cachées sans décalage tant que data-ordre-fait manque, révélées par rtp-reveler après 1,5 s', () => {
      const css = cssDist();
      const bloc = blocs(css).find((b) => b.sel.includes('html[data-ordre=aleatoire]') && b.sel.includes('[data-ordonnable]:not([data-ordre-fait])'));
      assert.ok(bloc, 'règle de masquage absente');
      assert.match(bloc.decl, /visibility:hidden/);
      // le minifieur réordonne les valeurs du raccourci `animation`
      for (const part of ['rtp-reveler', '0s', '1.5s', 'forwards']) assert.ok(bloc.decl.includes(part), `animation sans « ${part} » : ${bloc.decl}`);
      assert.match(bloc.decl, /animation:[^;]*1\.5s/);
      assert.ok(!/display:none/.test(bloc.decl), 'visibility et non display : aucun décalage de mise en page');
      assert.match(compact(css), /@keyframesrtp-reveler\{(to|100%)\{visibility:visible;?\}\}/);
    });

    it('la phrase « demande JavaScript » est masquée quand le script a tourné', () => {
      const bloc = blocs(cssDist()).find((b) => b.sel.includes('html[data-ordre-js].ordre-aide-sansjs'));
      assert.ok(bloc, 'règle absente');
      assert.match(bloc.decl, /display:none/);
    });

    it('le sélecteur de masquage ne dépend pas de prefers-reduced-motion (filet de sécurité, pas un mouvement)', () => {
      const css = compact(cssDist());
      const i = css.indexOf('[data-ordonnable]:not([data-ordre-fait])');
      assert.ok(i > 0);
      const avant = css.slice(Math.max(0, i - 200), i);
      assert.ok(!/prefers-reduced-motion/.test(avant.slice(avant.lastIndexOf('}') + 1)), 'règle imbriquée dans un @media prefers-reduced-motion');
    });
  });

  describe('contrôle du dist', () => {
    it('checkDist (production) ne signale aucune erreur', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });

    it('checkDist (preview) ne signale aucune erreur', () => {
      const { outDir } = preview();
      const constats = checkDist(outDir, { mode: 'preview', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'preview') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
