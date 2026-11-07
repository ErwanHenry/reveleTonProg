// PERF-01 (ADR-056) prouvé sur les builds réelles du corpus fictif corpus-m1, en production et en preview :
// un seul meta CSP par page, empreintes des deux scripts sources dans script-src, empreinte de chaque corps de
// script et de chaque <style> dans sa directive, aucun mot-clé « unsafe-* », aucun attribut style=, et des
// scripts en ligne identiques octet pour octet à src/scripts/. Puis des fautes injectées dans une copie du dist
// prouvent que check-dist les voit (une règle qui ne mord jamais ne prouve rien).
//
// Ce que ce module n'affirme pas, exprès :
// - que le meta précède les scripts : le script d'ordre est émis avant lui (Pitfall 1), le meta ne le couvre donc
//   pas ; l'en-tête CSP de Caddy (07-07, appliqué en Phase 8) le couvre dès le premier octet ;
// - que script-src est égal à la liste des scripts de la page : Astro y ajoute toujours 5 empreintes de scripts
//   d'îlots (inoffensives, le site n'a aucun îlot). On exige l'inclusion, jamais l'égalité.
// Réutilise les builds mémorisées « m1-production » et « m1-preview » (aucune build en plus).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { checkDist } from '../../../scripts/lib/check-dist.ts';
import type { Constat } from '../../../scripts/lib/check-dist.ts';
import { empreinteCsp, scriptsEnLigne } from '../../../src/lib/csp-empreintes.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

/** Codes de check-dist propres à la CSP et au code en ligne (07-01). */
const CODES_CSP = ['CSP_ABSENTE', 'CSP_TROP_PERMISSIVE', 'SCRIPT_SANS_EMPREINTE', 'STYLE_SANS_EMPREINTE', 'SCRIPT_EN_LIGNE', 'STYLE_EN_LIGNE'] as const;

const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
const posix = (p: string): string => p.split(path.sep).join('/');
const cleConstat = (c: Constat): string => `${c.code} ${c.fichier} ${c.message}`;

/** Politique d'un meta : directives en minuscules, jetons ; une directive répétée est ignorée (comme le navigateur). */
function politique(contenu: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const brute of contenu.split(';')) {
    const [nom, ...jetons] = brute.trim().split(/\s+/);
    if (nom === undefined || nom === '' || out.has(nom.toLowerCase())) continue;
    out.set(nom.toLowerCase(), jetons);
  }
  return out;
}

const occurrences = (texteComplet: string, motif: string): number => texteComplet.split(motif).length - 1;

export default function csp(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-csp'));
  const sources = scriptsEnLigne(ctx.repoRoot);
  const source = (nom: string) => {
    const s = sources.find((x) => x.nom === nom);
    assert.ok(s, `src/scripts/${nom} absent de scriptsEnLigne`);
    return s;
  };

  const build = (mode: 'production' | 'preview') => {
    const b = ctx.construire(`m1-${mode}`, { racine, mode });
    assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
    return b;
  };

  /** Pages du dist : chemin relatif, arbre, head, et la politique de son unique meta CSP. */
  const pages = (outDir: string) =>
    ctx.pagesHtml(outDir).map((f) => {
      const rel = posix(path.relative(outDir, f));
      const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
      const head = trouver(arbre, (n) => n.tag === 'head');
      assert.equal(head.length, 1, `${rel} : un seul <head>`);
      const metas = trouver(arbre, (n) => n.tag === 'meta' && (n.attrs['http-equiv'] ?? '').trim().toLowerCase() === 'content-security-policy');
      return { rel, arbre, head: head[0] as Noeud, metas, csp: politique(metas[0]?.attrs.content ?? '') };
    });

  it('PERF-01 : scriptsEnLigne liste exactement niveau.js et ordre.js, chacun d’au plus 2048 octets', () => {
    assert.deepEqual(
      sources.map((s) => s.nom),
      ['niveau.js', 'ordre.js'],
    );
    for (const s of sources) {
      assert.ok(Buffer.byteLength(s.texte) <= 2048, `${s.nom} : ${Buffer.byteLength(s.texte)} octets`);
      assert.equal(s.empreinte, empreinteCsp(fs.readFileSync(path.join(ctx.repoRoot, 'src', 'scripts', s.nom))));
    }
  });

  for (const mode of ['production', 'preview'] as const) {
    describe(`CSP de la build ${mode}`, () => {
      it(`PERF-01 : ${mode} : un seul meta CSP par page, dans <head>, aucun mot-clé « unsafe-* », plus de dist/_astro/`, () => {
        const { outDir } = build(mode);
        assert.equal(fs.existsSync(path.join(outDir, '_astro')), false, 'dist/_astro/ ne doit plus exister');
        const toutes = pages(outDir);
        assert.ok(toutes.length > 10, `${toutes.length} pages`);
        for (const p of toutes) {
          assert.equal(p.metas.length, 1, `${p.rel} : ${p.metas.length} meta CSP (un seul attendu)`);
          assert.equal(p.metas[0]?.parent, p.head, `${p.rel} : le meta CSP est un enfant de <head>`);
          const contenu = p.metas[0]?.attrs.content ?? '';
          assert.ok(!/unsafe-/i.test(contenu), `${p.rel} : « unsafe-* » dans la CSP : ${contenu}`);
          for (const d of ['script-src', 'style-src', 'default-src']) assert.ok(p.csp.has(d), `${p.rel} : directive ${d} absente`);
          assert.deepEqual(p.csp.get('default-src'), ["'none'"], `${p.rel} : default-src 'none'`);
        }
      });

      it(`PERF-01 : ${mode} : script-src liste les empreintes de niveau.js et ordre.js, et celle de chaque corps de script`, () => {
        const { outDir } = build(mode);
        for (const p of pages(outDir)) {
          const scriptSrc = p.csp.get('script-src') ?? [];
          for (const s of sources) assert.ok(scriptSrc.includes(`'${s.empreinte}'`), `${p.rel} : empreinte de ${s.nom} absente de script-src`);
          const scripts = trouver(p.arbre, (n) => n.tag === 'script');
          assert.ok(scripts.length >= 1, `${p.rel} : au moins le script d'ordre`);
          for (const s of scripts) {
            assert.equal(s.attrs.src, undefined, `${p.rel} : aucun script externe`);
            const corps = texte(s);
            assert.ok(
              sources.some((x) => x.texte === corps),
              `${p.rel} : corps de script (${Buffer.byteLength(corps)} octets) différent de src/scripts/*.js`,
            );
            assert.ok(scriptSrc.includes(`'${empreinteCsp(corps)}'`), `${p.rel} : empreinte du corps de script absente de script-src`);
          }
        }
      });

      it(`PERF-01 : ${mode} : chaque <style> a son empreinte dans style-src, aucun attribut style=`, () => {
        const { outDir } = build(mode);
        for (const p of pages(outDir)) {
          const styleSrc = p.csp.get('style-src') ?? [];
          const styles = trouver(p.arbre, (n) => n.tag === 'style');
          assert.equal(styles.length, 1, `${p.rel} : ${styles.length} <style>`);
          for (const s of styles) assert.ok(styleSrc.includes(`'${empreinteCsp(texte(s))}'`), `${p.rel} : empreinte du <style> absente de style-src`);
          const avecStyle = trouver(p.arbre, (n) => n.attrs.style !== undefined);
          assert.deepEqual(avecStyle.map((n) => n.tag), [], `${p.rel} : attribut style=`);
        }
      });

      it(`PERF-01 : ${mode} : script d’ordre premier de <head>, script de niveau juste après </fieldset>, sans attribut, identiques aux sources`, () => {
        const { outDir } = build(mode);
        const ordre = source('ordre.js').texte;
        const niveau = source('niveau.js').texte;
        let selecteurs = 0;
        for (const p of pages(outDir)) {
          const premier = elements(p.head).find((n) => n.tag === 'script');
          assert.ok(premier, `${p.rel} : aucun <script> dans <head>`);
          assert.equal(texte(premier), ordre, `${p.rel} : le premier <script> de <head> est src/scripts/ordre.js octet pour octet`);
          assert.deepEqual(Object.keys(premier.attrs), [], `${p.rel} : script d'ordre sans attribut`);
          assert.equal(trouver(p.arbre, (n) => n.tag === 'script' && texte(n) === ordre).length, 1, `${p.rel} : un seul script d'ordre`);
          const fieldsets = trouver(p.arbre, (n) => n.tag === 'fieldset' && n.attrs.id === 'niveaux');
          const niveaux = trouver(p.arbre, (n) => n.tag === 'script' && texte(n) === niveau);
          if (fieldsets.length === 0) {
            assert.equal(niveaux.length, 0, `${p.rel} : script de niveau sans sélecteur`);
            continue;
          }
          selecteurs += 1;
          const f = fieldsets[0] as Noeud;
          const freres = elements(f.parent as Noeud);
          const suivant = freres[freres.indexOf(f) + 1];
          assert.equal(suivant?.tag, 'script', `${p.rel} : un <script> suit </fieldset>`);
          assert.equal(texte(suivant as Noeud), niveau, `${p.rel} : src/scripts/niveau.js octet pour octet`);
          assert.deepEqual(Object.keys((suivant as Noeud).attrs), [], `${p.rel} : script de niveau sans attribut`);
          assert.equal(niveaux.length, 1, `${p.rel} : un seul script de niveau`);
        }
        assert.ok(selecteurs >= 2, `${selecteurs} page(s) à sélecteur de niveau`);
      });

      it(`PERF-01 : ${mode} : checkDist ne signale aucun code de CSP ni de code en ligne`, () => {
        const { outDir } = build(mode);
        const constats = checkDist(outDir, { mode }).filter((c) => (CODES_CSP as readonly string[]).includes(c.code));
        assert.deepEqual(constats, [], constats.map(cleConstat).join('\n'));
      });
    });
  }

  describe('fautes injectées dans une copie du dist de production', () => {
    const PAGE = 'themes/logement/index.html';
    let reference: Set<string> | undefined;
    const constatsReference = (): Set<string> => {
      reference ??= new Set(checkDist(build('production').outDir, { mode: 'production' }).map(cleConstat));
      return reference;
    };

    /** Copie le dist, applique `muter` à PAGE (qui doit changer), et renvoie les constats absents de la build intacte. */
    const constatsApres = (muter: (html: string) => string): Constat[] => {
      const { outDir } = build('production');
      const copie = path.join(ctx.tmp(), 'dist');
      fs.cpSync(outDir, copie, { recursive: true });
      const fichier = path.join(copie, ...PAGE.split('/'));
      const avant = fs.readFileSync(fichier, 'utf8');
      const apres = muter(avant);
      assert.notEqual(apres, avant, 'la faute n’a pas été injectée');
      fs.writeFileSync(fichier, apres);
      const ref = constatsReference();
      return checkDist(copie, { mode: 'production' }).filter((c) => !ref.has(cleConstat(c)));
    };
    const verifier = (nouveaux: Constat[], codes: string[]): void => {
      const resume = nouveaux.map(cleConstat).join('\n');
      assert.deepEqual(nouveaux.map((c) => c.code).sort(), [...codes].sort(), resume);
      for (const c of nouveaux) {
        assert.equal(c.fichier, PAGE, `${c.code} sur ${c.fichier} : seule ${PAGE} a été modifiée`);
        assert.equal(c.severite, 'erreur', cleConstat(c));
      }
    };

    it('PERF-01 : mutation : une espace ajoutée au script de niveau donne SCRIPT_EN_LIGNE et SCRIPT_SANS_EMPREINTE sur cette page seulement', () => {
      const niveau = source('niveau.js').texte;
      const nouveaux = constatsApres((html) => {
        const motif = `<script>${niveau}</script>`;
        assert.equal(occurrences(html, motif), 1, 'script de niveau introuvable tel quel dans la page');
        return html.replace(motif, `<script>${niveau} </script>`);
      });
      verifier(nouveaux, ['SCRIPT_EN_LIGNE', 'SCRIPT_SANS_EMPREINTE']);
    });

    it('PERF-01 : mutation : un caractère changé dans la <style> donne STYLE_SANS_EMPREINTE', () => {
      const nouveaux = constatsApres((html) => {
        const m = /<style>([\s\S]*?)<\/style>/.exec(html);
        assert.ok(m, '<style> introuvable');
        const css = m[1] as string;
        const i = css.search(/[a-y]/);
        assert.ok(i >= 0, 'aucune lettre à changer dans la <style>');
        const muee = `${css.slice(0, i)}z${css.slice(i + 1)}`;
        assert.notEqual(muee, css);
        return `${html.slice(0, m.index)}<style>${muee}</style>${html.slice(m.index + m[0].length)}`;
      });
      verifier(nouveaux, ['STYLE_SANS_EMPREINTE']);
    });

    it('PERF-01 : mutation : l’empreinte du script d’ordre retirée du meta donne SCRIPT_SANS_EMPREINTE', () => {
      const jeton = ` '${source('ordre.js').empreinte}'`;
      const nouveaux = constatsApres((html) => {
        assert.equal(occurrences(html, jeton), 1, 'empreinte du script d’ordre introuvable dans le meta');
        return html.replace(jeton, '');
      });
      verifier(nouveaux, ['SCRIPT_SANS_EMPREINTE']);
      assert.ok(nouveaux[0]?.message.includes(source('ordre.js').empreinte), nouveaux[0]?.message);
    });

    it("PERF-01 : mutation : 'unsafe-inline' ajouté à script-src donne CSP_TROP_PERMISSIVE", () => {
      const nouveaux = constatsApres((html) => {
        const motif = "script-src 'self'";
        assert.equal(occurrences(html, motif), 1, `« ${motif} » introuvable dans le meta`);
        return html.replace(motif, "script-src 'self' 'unsafe-inline'");
      });
      verifier(nouveaux, ['CSP_TROP_PERMISSIVE']);
    });
  });
}
