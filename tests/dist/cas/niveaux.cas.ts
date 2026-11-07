// Sélecteur de niveau de lecture (fieldset + 4 radios + script classique + bloc « Ce qui me concerne »),
// vérifié sur la page thème /themes/logement/ du corpus fictif corpus-m1 construit en production.
// Les pages candidat n'existent pas encore (plan 04-06) : le plan 04-09 vérifiera leur côté.
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

const NIVEAUX: readonly [string, string][] = [
  ['resume', 'En bref'],
  ['detaille', 'En détail'],
  ['enfant', 'Pour les enfants'],
  ['aine', 'Gros caractères'],
];

export default function niveaux(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'm1'));

  const production = () => {
    const b = ctx.construire('niveaux-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const page = (chemin: string): { html: string; arbre: Noeud } => {
    const html = ctx.lire(production().outDir, chemin);
    return { html, arbre: analyserHtml(html) };
  };
  const fieldset = (arbre: Noeud): Noeud => {
    const f = trouver(arbre, (n) => n.tag === 'fieldset' && aClasse(n, 'niveaux'));
    assert.equal(f.length, 1, 'un seul fieldset.niveaux');
    return f[0] as Noeud;
  };

  describe('sélecteur de niveau', () => {
    it('fieldset#niveaux : légende, 4 radios dans l’ordre, seul « En bref » coché', () => {
      const { arbre } = page('themes/logement/index.html');
      const f = fieldset(arbre);
      assert.equal(f.attrs.id, 'niveaux');
      assert.equal(norm(texte(trouver(f, (n) => n.tag === 'legend')[0] as Noeud)), 'Niveau de lecture');
      const radios = trouver(f, (n) => n.tag === 'input');
      assert.equal(radios.length, 4);
      radios.forEach((r, i) => {
        const [valeur, libelle] = NIVEAUX[i] as [string, string];
        assert.equal(r.attrs.type, 'radio');
        assert.equal(r.attrs.name, 'niveau');
        assert.equal(r.attrs.id, `niv-${valeur}`);
        assert.equal(r.attrs.value, valeur);
        assert.equal(r.attrs.autocomplete, 'off');
        assert.equal(r.attrs.checked !== undefined, valeur === 'resume', `checked sur ${valeur}`);
        const label = trouver(f, (n) => n.tag === 'label' && n.attrs.for === r.attrs.id);
        assert.equal(label.length, 1);
        assert.equal(norm(texte(label[0] as Noeud)), libelle);
      });
    });

    it('aide, phrase « sans JavaScript » et région role=status vide', () => {
      const { arbre } = page('themes/logement/index.html');
      const f = fieldset(arbre);
      const aide = trouver(f, (n) => n.attrs.id === 'niveaux-aide')[0] as Noeud;
      assert.equal(norm(texte(aide)), "Ce choix s'applique à toutes les mesures de la page.");
      assert.equal(f.attrs['aria-describedby'], 'niveaux-aide');
      const sansJs = trouver(f, (n) => aClasse(n, 'aide-sansjs'));
      assert.equal(sansJs.length, 1);
      assert.equal(
        norm(texte(sansJs[0] as Noeud)),
        "Sans JavaScript, votre choix n'est pas mémorisé d'une page à l'autre : il faut le refaire sur chaque page.",
      );
      const statut = trouver(f, (n) => n.attrs.role === 'status' && n.attrs['data-niveau-annonce'] !== undefined);
      assert.equal(statut.length, 1);
      assert.equal(norm(texte(statut[0] as Noeud)), '');
    });

    it('le script classique suit immédiatement </fieldset> : sans attribut, identique à src/scripts/niveau.js, ≤ 2048 octets', () => {
      // ADR-056 : le script est inclus dans la page (`?raw` + is:inline) ; son empreinte est vérifiée par csp.cas.
      const { outDir } = production();
      const source = fs.readFileSync(path.join(ctx.repoRoot, 'src', 'scripts', 'niveau.js'), 'utf8');
      assert.ok(Buffer.byteLength(source) <= 2048, `src/scripts/niveau.js : ${Buffer.byteLength(source)} octets (plafond 2048)`);
      const avecSelecteur: string[] = [];
      for (const f of ctx.pagesHtml(outDir)) {
        const rel = path.relative(outDir, f).split(path.sep).join('/');
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        const selecteurs = trouver(arbre, (n) => n.tag === 'fieldset' && n.attrs.id === 'niveaux');
        const corps = trouver(arbre, (n) => n.tag === 'script' && texte(n) === source);
        if (selecteurs.length === 0) {
          assert.equal(corps.length, 0, `${rel} : script de niveau sans sélecteur`);
          continue;
        }
        avecSelecteur.push(rel);
        assert.equal(selecteurs.length, 1, `${rel} : un seul fieldset#niveaux`);
        const f0 = selecteurs[0] as Noeud;
        const freres = elements(f0.parent as Noeud);
        const suivant = freres[freres.indexOf(f0) + 1] as Noeud;
        assert.equal(suivant?.tag, 'script', `${rel} : un <script> suit </fieldset>`);
        assert.deepEqual(Object.keys(suivant.attrs), [], `${rel} : script sans attribut (classique, bloquant, ni src)`);
        assert.equal(texte(suivant), source, `${rel} : octet pour octet identique à src/scripts/niveau.js`);
        assert.ok(Buffer.byteLength(texte(suivant)) <= 2048, `${rel} : ${Buffer.byteLength(texte(suivant))} octets`);
        assert.equal(corps.length, 1, `${rel} : le script de niveau n'est inclus qu'une fois`);
      }
      assert.ok(avecSelecteur.includes('themes/logement/index.html'), `pages à sélecteur : ${avecSelecteur.join(', ')}`);
      assert.ok(avecSelecteur.some((p) => p.startsWith('candidats/') && p !== 'candidats/index.html'), 'au moins une page candidat porte le sélecteur');
    });

    it('le contenu vient après le script : .lecteur-contenu est le frère suivant du script', () => {
      const { arbre } = page('themes/logement/index.html');
      const f = fieldset(arbre);
      const freres = elements(f.parent as Noeud);
      const contenu = freres[freres.indexOf(f) + 2] as Noeud;
      assert.ok(aClasse(contenu, 'lecteur-contenu'));
      assert.ok(aClasse(f.parent as Noeud, 'lecteur'));
    });
  });

  describe('« Ce qui me concerne » et rappel', () => {
    it('premier élément de .lecteur-contenu, thèmes prioritaires publiés seulement', () => {
      const { arbre } = page('themes/logement/index.html');
      const contenu = trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud;
      const premier = elements(contenu)[0] as Noeud;
      assert.equal(premier.tag, 'section');
      assert.ok(aClasse(premier, 'concerne-aine'));
      const h2 = trouver(premier, (n) => n.tag === 'h2')[0] as Noeud;
      assert.equal(norm(texte(h2)), 'Ce qui me concerne');
      assert.equal(premier.attrs['aria-labelledby'], h2.attrs.id);
      const intro = elements(premier).find((n) => n.tag === 'p') as Noeud;
      assert.equal(
        norm(texte(intro)),
        'Les thèmes qui touchent souvent les retraités : pensions, santé, dépendance, succession, logement. Cette sélection ne classe pas les candidats.',
      );
      const liens = trouver(premier, (n) => n.tag === 'a');
      assert.equal(liens.length, 1, 'seul logement est publié et prioritaire');
      const lien = liens[0] as Noeud;
      assert.equal(lien.attrs.href, '/themes/logement/');
      assert.equal(lien.attrs['aria-current'], 'page');
      assert.ok(norm(texte(lien)).includes('Logement'));
      assert.ok(norm(texte(lien)).includes('(page affichée)'));
      assert.ok(!norm(texte(premier)).includes('Climat'));
    });

    it('sur la page climat, le lien vers logement n’est pas la page affichée', () => {
      const { arbre } = page('themes/climat/index.html');
      const premier = elements(trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud)[0] as Noeud;
      const liens = trouver(premier, (n) => n.tag === 'a');
      assert.equal(liens.length, 1);
      assert.equal((liens[0] as Noeud).attrs.href, '/themes/logement/');
      assert.equal((liens[0] as Noeud).attrs['aria-current'], undefined);
      assert.ok(!norm(texte(premier)).includes('(page affichée)'));
    });

    it('dernier élément de .lecteur-contenu : lien « Changer le niveau de lecture » vers #niveaux', () => {
      const { arbre } = page('themes/logement/index.html');
      const contenu = trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud;
      const els = elements(contenu);
      const dernier = els[els.length - 1] as Noeud;
      assert.ok(aClasse(dernier, 'rappel-niveau'));
      const a = trouver(dernier, (n) => n.tag === 'a')[0] as Noeud;
      assert.equal(a.attrs.href, '#niveaux');
      assert.equal(norm(texte(a)), 'Changer le niveau de lecture');
    });
  });

  describe('feuille de style construite', () => {
    const blocs = (css: string): { sel: string; decl: string }[] =>
      [...compact(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1] ?? '', decl: m[2] ?? '' }));

    it('quatre règles :has() masquent les rédactions des autres niveaux (display: none)', () => {
      const tous = blocs(cssDesPages(production().outDir));
      for (const [n] of NIVEAUX) {
        const sel = compact(`.lecteur:has(> .niveaux #niv-${n}:checked) .redaction:not([data-niveau="${n}"])`);
        const bloc = tous.find((b) => b.sel.split(',').includes(sel));
        assert.ok(bloc, `règle de masquage pour ${n} absente`);
        assert.match(bloc.decl, /display:none/);
      }
    });

    it('@supports :has() masque visuellement .etiquette (clip-path, 1px, pas display: none)', () => {
      const css = cssDesPages(production().outDir);
      assert.match(compact(css), /@supports\(?selector\(:has\(\*\)\)\)?\{/);
      const bloc = blocs(css).find((b) => b.sel.includes('.redaction>.etiquette') && b.decl.includes('clip-path'));
      assert.ok(bloc, 'règle de masquage visuel de .etiquette absente');
      assert.match(bloc.decl, /width:1px/);
      assert.match(bloc.decl, /height:1px/);
      assert.ok(!/display:none/.test(bloc.decl));
    });

    it('.concerne-aine masqué par défaut, affiché seulement au niveau Gros caractères', () => {
      const tous = blocs(cssDesPages(production().outDir));
      assert.ok(tous.some((b) => b.sel.split(',').includes('.concerne-aine') && /display:none/.test(b.decl)));
      const aine = compact('.lecteur:has(> .niveaux #niv-aine:checked) .concerne-aine');
      assert.ok(tous.some((b) => b.sel.split(',').includes(aine) && /display:block/.test(b.decl)));
    });
  });

  describe('contrôle du dist', () => {
    it('checkDist ne signale aucune erreur (ids uniques : niveaux, niv-*)', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
