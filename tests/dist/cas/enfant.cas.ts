// Mots du glossaire au niveau « Pour les enfants » : boutons .terme + popovers adjacents, liste
// « Mots expliqués », repli sans Popover. Vérifié sur la page thème /themes/logement/ du corpus
// fictif corpus-m1 construit en production. Les popovers des pages candidat sont vérifiés par le plan 04-09.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';
import { cssDesPages } from '../css-pages.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
/** Sans espace ni guillemet : un minifieur peut réécrire `[data-niveau="x"]` en `[data-niveau=x]` et `> .a` en `>.a`. */
const compact = (s: string): string => s.replace(/[\s"']+/g, '');
/** Espace ou ponctuation : un mot ne doit jamais être collé au bouton ni à la définition qui l'entoure. */
const SEPARATEUR = /^[\s\p{P}]$/u;

const ANCRE_MARIE = 'm-marie-fictive-aide-construction';
const AIDE_REPLI = "Votre navigateur n'affiche pas les définitions au clic. Elles sont réunies dans la liste « Mots expliqués » en bas de page.";

export default function enfant(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'enfant'));

  const production = () => {
    const b = ctx.construire('enfant-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const logement = (): { html: string; arbre: Noeud } => {
    const html = ctx.lire(production().outDir, 'themes/logement/index.html');
    return { html, arbre: analyserHtml(html) };
  };
  const redactionEnfantMarie = (arbre: Noeud): Noeud => {
    const article = trouver(arbre, (n) => n.tag === 'article' && n.attrs.id === ANCRE_MARIE)[0];
    assert.ok(article, `article #${ANCRE_MARIE} absent`);
    const r = trouver(article, (n) => aClasse(n, 'redaction') && n.attrs['data-niveau'] === 'enfant')[0];
    assert.ok(r, 'rédaction enfant absente');
    return r;
  };
  const suivant = (n: Noeud): string | Noeud | undefined => {
    const freres = (n.parent as Noeud).enfants;
    return freres[freres.indexOf(n) + 1];
  };
  const precedent = (n: Noeud): string | Noeud | undefined => {
    const freres = (n.parent as Noeud).enfants;
    return freres[freres.indexOf(n) - 1];
  };

  describe('termes et définitions', () => {
    it('chaque mot est un bouton .terme immédiatement suivi de son popover (ids propres à la mesure)', () => {
      const boutons = trouver(redactionEnfantMarie(logement().arbre), (n) => n.tag === 'button' && aClasse(n, 'terme'));
      assert.deepEqual(
        boutons.map((b) => norm(texte(b))),
        ['Parti Imaginaire', 'loyer'],
      );
      boutons.forEach((b, i) => {
        const id = `def-${ANCRE_MARIE}-${i + 1}`;
        assert.equal(b.attrs.type, 'button');
        assert.equal(b.attrs.popovertarget, id);
        const def = suivant(b);
        assert.ok(def !== undefined && typeof def !== 'string', 'le popover suit immédiatement le bouton');
        assert.equal(def.tag, 'span');
        assert.equal(def.attrs.id, id);
        assert.notEqual(def.attrs.popover, undefined, 'attribut popover');
        assert.ok(aClasse(def, 'definition'));
      });
    });

    it('la définition de « loyer » est celle du glossaire', () => {
      const boutons = trouver(redactionEnfantMarie(logement().arbre), (n) => n.tag === 'button' && aClasse(n, 'terme'));
      const def = suivant(boutons[1] as Noeud) as Noeud;
      assert.match(norm(texte(def)), /^Le loyer est la somme d'argent qu'on paie chaque mois/);
    });

    it('le popover du parti dit de qui viennent ces mots et à quelle date', () => {
      const boutons = trouver(redactionEnfantMarie(logement().arbre), (n) => n.tag === 'button' && aClasse(n, 'terme'));
      const def = suivant(boutons[0] as Noeud) as Noeud;
      assert.ok(norm(texte(def)).includes('Définition donnée par Page de présentation du Parti Imaginaire, 20 octobre 2026.'), norm(texte(def)));
      const date = trouver(def, (n) => n.tag === 'time')[0];
      assert.equal(date?.attrs.datetime, '2026-10-20');
    });

    it('un terme ordinaire n’affiche aucune ligne de source', () => {
      const boutons = trouver(redactionEnfantMarie(logement().arbre), (n) => n.tag === 'button' && aClasse(n, 'terme'));
      const def = suivant(boutons[1] as Noeud) as Noeud;
      assert.ok(!norm(texte(def)).includes('Définition donnée par'));
    });

    it('jamais de mot collé : espace ou ponctuation avant chaque bouton et après chaque définition', () => {
      const termes = trouver(logement().arbre, (n) => n.tag === 'button' && aClasse(n, 'terme'));
      assert.ok(termes.length >= 2);
      for (const b of termes) {
        const avant = precedent(b);
        assert.equal(typeof avant, 'string', 'du texte précède le bouton');
        assert.match(String(avant).slice(-1), SEPARATEUR, `avant « ${norm(texte(b))} »`);
        const def = suivant(b) as Noeud;
        const apres = suivant(def);
        if (typeof apres === 'string') assert.match(apres.slice(0, 1), SEPARATEUR, `après la définition de « ${norm(texte(b))} »`);
      }
    });

    it('ids de popover uniques sur la page', () => {
      const ids = trouver(logement().arbre, (n) => n.attrs.popover !== undefined).map((n) => n.attrs.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.length >= 2);
    });
  });

  describe('liste « Mots expliqués »', () => {
    const liste = (arbre: Noeud): Noeud => {
      const l = trouver(arbre, (n) => n.tag === 'details' && aClasse(n, 'mots-expliques'));
      assert.equal(l.length, 1, 'une seule liste par page');
      return l[0] as Noeud;
    };

    it('fermée, avec un résumé compté et les mots dans l’ordre alphabétique', () => {
      const d = liste(logement().arbre);
      assert.equal(d.attrs.open, undefined, 'fermée par défaut');
      assert.equal(norm(texte(trouver(d, (n) => n.tag === 'summary')[0] as Noeud)), 'Mots expliqués (2)');
      const dt = trouver(d, (n) => n.tag === 'dt').map((n) => norm(texte(n)));
      assert.deepEqual(dt, ['loyer', 'Parti Imaginaire']);
      assert.equal(trouver(d, (n) => n.tag === 'dd').length, 2);
      assert.ok(norm(texte(d)).includes('Définition donnée par Page de présentation du Parti Imaginaire, 20 octobre 2026.'));
    });

    it('placée après le contenu et avant le lien « Changer le niveau de lecture », avec la phrase d’aide', () => {
      const { arbre } = logement();
      const contenu = trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud;
      const els = elements(contenu);
      const d = liste(arbre);
      const i = els.indexOf(d);
      assert.ok(i > 0, 'la liste est un enfant direct de .lecteur-contenu');
      assert.ok(aClasse(els[i + 1] as Noeud, 'rappel-niveau'), 'le rappel suit immédiatement la liste');
      const aide = els[i - 1] as Noeud;
      assert.ok(aClasse(aide, 'mots-aide-repli'), "la phrase d'aide précède la liste");
      assert.equal(norm(texte(aide)), AIDE_REPLI);
      const articles = els.findIndex((n) => trouver(n, (x) => x.tag === 'article').length > 0);
      assert.ok(articles >= 0 && articles < i, 'après le contenu de la page');
    });
  });

  describe('pas de marqueur brut ni de pictogramme exotique', () => {
    it('aucune page ne contient « [[ », ⓘ, ni caractère des alphanumériques cerclés ou des emoji', () => {
      const { outDir } = production();
      const interdit = /\[\[|[①-⓿☀-➿\u{1F000}-\u{1FAFF}]/u; // alphanumériques cerclés (dont U+24D8), symboles divers, emoji
      const pages = ctx.pagesHtml(outDir);
      assert.ok(pages.length > 0);
      for (const f of pages) {
        const m = interdit.exec(fs.readFileSync(f, 'utf8'));
        assert.equal(m, null, `${path.relative(outDir, f)} : « ${m?.[0]} »`);
      }
    });
  });

  describe('feuille de style construite', () => {
    const blocs = (css: string): { sel: string; decl: string }[] =>
      [...compact(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1] ?? '', decl: m[2] ?? '' }));

    it('repli sans Popover : @supports not selector(:popover-open) masque .definition et montre l’aide', () => {
      const css = compact(cssDesPages(production().outDir));
      const m = /@supportsnot\(?selector\(:popover-open\)\)?\{(.*?)\}\}/.exec(css);
      assert.ok(m, '@supports not selector(:popover-open) absent');
      const interne = m[1] ?? '';
      assert.match(interne, /\.definition\{display:none/);
      assert.match(interne, /\.mots-aide-repli\{display:block/);
      assert.match(interne, /\.terme\{[^}]*text-decoration:none/);
      assert.match(interne, /\.terme(::|:)after\{content:none/);
    });

    it('« Mots expliqués » est masqué hors du niveau enfant, par :not(:has()) pour rester visible sans :has()', () => {
      const sel = compact('.lecteur:not(:has(> .niveaux #niv-enfant:checked)) .mots-expliques');
      const bloc = blocs(cssDesPages(production().outDir)).find((b) => b.sel.split(',').includes(sel));
      assert.ok(bloc, 'règle de masquage absente');
      assert.match(bloc.decl, /display:none/);
    });

    it('terme en pointillé et marqueur « ? » avec sa variante à texte alternatif vide', () => {
      const tous = blocs(cssDesPages(production().outDir));
      assert.ok(
        tous.some((b) => /(^|,)\.terme(,|$)/.test(b.sel) && /text-decoration:underline[^;]*dotted|text-decoration-style:dotted/.test(b.decl)),
        'pointillé sur .terme',
      );
      const apres = tous.filter((b) => /(^|,)\.terme(::|:)after(,|$)/.test(b.sel) && /content:/.test(b.decl));
      assert.ok(apres.length > 0, '.terme::after absent');
      const decl = apres.map((b) => b.decl).join(';');
      assert.match(decl, /content:\?(;|$)/, 'content: "?" simple');
      assert.match(decl, /content:\?\/(;|$)/, 'content: "?" / ""');
    });
  });

  describe('contrôle du dist', () => {
    it('checkDist ne signale aucune erreur (ids de popover uniques)', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
