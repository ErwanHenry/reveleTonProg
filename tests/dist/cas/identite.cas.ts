// Finitions visuelles 09.1, lot B, proposition 5 (audit B9, B11) : nom du site lisible dans l'en-tête, sous-titre
// d'une ligne, ligne d'identité en tête du pied de page. Les trois textes viennent de src/lib/identite.ts (brouillons
// à valider par Erwan) : les cas lisent les constantes, jamais une copie. Réutilise « m1-production ».
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { aClasse, analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import * as identite from '../../../src/lib/identite.ts';
import { motsInterdits } from '../../../src/lib/content-core/rules/text/forbidden.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
/** Nom affiché avant la proposition 5 (nom du dépôt). */
const ANCIEN_NOM = 'reveleTonProg';

const valeurs = identite as Record<string, unknown>;
const chaine = (cle: string): string => {
  const v = valeurs[cle];
  assert.equal(typeof v, 'string', `src/lib/identite.ts doit exporter ${cle} (chaîne)`);
  return v as string;
};

export default function identiteSite(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-identite'));
  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const rel = (outDir: string, f: string): string => path.relative(outDir, f).split(path.sep).join('/');

  describe('identite 09.1 : nom lisible, sous-titre, ligne d\'identité du pied', () => {
    it('les trois textes : aucun tiret long ni moyen, aucun mot interdit', () => {
      for (const cle of ['NOM_SITE', 'SOUS_TITRE', 'LIGNE_IDENTITE']) {
        const s = chaine(cle);
        assert.ok(s.trim().length > 0, `${cle} vide`);
        assert.ok(!/[–—]/.test(s), `${cle} contient un tiret long ou moyen : ${s}`);
        assert.deepEqual(motsInterdits(s, { exempterCitations: false }), [], `mot interdit dans ${cle} : ${s}`);
      }
      assert.ok(chaine('LIGNE_IDENTITE').includes(chaine('NOM_SITE')), 'la ligne d\'identité nomme le site');
    });

    it('chaque page : lien d\'accueil au texte exact du nom, suivi du sous-titre ; pied ouvert par la ligne d\'identité', () => {
      const { outDir } = production();
      const pages = ctx.pagesHtml(outDir);
      assert.ok(pages.length > 5);
      for (const f of pages) {
        const r = rel(outDir, f);
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        const entete = trouver(arbre, (n) => n.tag === 'header' && aClasse(n, 'entete'))[0] as Noeud;
        assert.ok(entete, `${r} : header.entete`);
        const nom = trouver(entete, (n) => n.tag === 'a' && aClasse(n, 'site-nom'));
        assert.equal(nom.length, 1, `${r} : un seul a.site-nom`);
        const a = nom[0] as Noeud;
        assert.equal(a.attrs.href, '/', `${r} : lien vers l'accueil`);
        assert.equal(txt(a), chaine('NOM_SITE'), `${r} : texte du lien d'accueil`);
        const freres = elements(a.parent as Noeud);
        const suivant = freres[freres.indexOf(a) + 1];
        assert.ok(suivant && suivant.tag === 'p' && aClasse(suivant, 'site-sous-titre'), `${r} : p.site-sous-titre suit le nom`);
        assert.equal(txt(suivant as Noeud), chaine('SOUS_TITRE'), `${r} : texte du sous-titre`);
        if (chaine('NOM_SITE') !== ANCIEN_NOM) assert.ok(!txt(entete).includes(ANCIEN_NOM), `${r} : ancien nom dans l'en-tête`);

        const pied = trouver(arbre, (n) => n.tag === 'footer' && aClasse(n, 'pied'))[0] as Noeud;
        const conteneur = elements(pied).find((n) => aClasse(n, 'conteneur')) as Noeud;
        const premier = elements(conteneur)[0] as Noeud;
        assert.ok(premier.tag === 'p' && aClasse(premier, 'pied-identite'), `${r} : p.pied-identite en tête du pied`);
        assert.equal(txt(premier), chaine('LIGNE_IDENTITE'), `${r} : texte de la ligne d'identité`);
      }
    });

    it('titres et og:site_name : le nom du site, jamais l\'ancien quand il diffère', () => {
      const { outDir } = production();
      for (const f of ctx.pagesHtml(outDir)) {
        const r = rel(outDir, f);
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        const titres = trouver(arbre, (n) => n.tag === 'title').map(txt);
        assert.equal(titres.length, 1, `${r} : un seul title`);
        const t = titres[0] as string;
        // Accueil : « {NOM_SITE} : les programmes… » (clé hall.titre.page) ; autres pages : « … : {NOM_SITE} » ou « …, {NOM_SITE} ».
        if (r === 'index.html') assert.ok(t.startsWith(`${chaine('NOM_SITE')} : `), `${r} : ${t}`);
        else assert.ok(t.endsWith(chaine('NOM_SITE')), `${r} : ${t}`);
        if (chaine('NOM_SITE') !== ANCIEN_NOM) assert.ok(!t.includes(ANCIEN_NOM), `${r} : ancien nom dans le titre`);
        const og = trouver(arbre, (n) => n.tag === 'meta' && n.attrs.property === 'og:site_name');
        assert.equal(og.length, 1, `${r} : og:site_name`);
        assert.equal(og[0]?.attrs.content, chaine('NOM_SITE'), `${r} : og:site_name`);
      }
    });

    it('marqueur de la sonde et du battement présent sur la page d\'accueil construite, quel que soit le nom affiché', () => {
      const sonde = /grep -q '([^']+)' "\$RUNNER_TEMP\/accueil\.html"/.exec(fs.readFileSync(path.join(ctx.repoRoot, '.github/workflows/sonde.yml'), 'utf8'))?.[1];
      const battement = /^MARQUEUR=(\S+)$/m.exec(fs.readFileSync(path.join(ctx.repoRoot, 'ops/battement.sh'), 'utf8'))?.[1];
      assert.ok(sonde && battement, 'marqueur introuvable dans sonde.yml ou ops/battement.sh');
      assert.equal(sonde, chaine('MARQUEUR_SONDE'));
      assert.equal(battement, chaine('MARQUEUR_SONDE'));
      const arbre = analyserHtml(ctx.lire(production().outDir, 'index.html'));
      const gen = trouver(arbre, (n) => n.tag === 'meta' && n.attrs.name === 'generator');
      assert.equal(gen.length, 1);
      assert.equal(gen[0]?.attrs.content, chaine('MARQUEUR_SONDE'));
    });
  });
}
