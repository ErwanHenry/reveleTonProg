// Finitions visuelles 09.1, lot B, proposition 2 (audit B4) : bloc source compact.
// La source primaire et la date de consultation restent deux lignes de texte toujours visibles, jamais dans un
// <details> ; les liens du document sont réunis dans une liste en ligne (ul.source-liens), les deux signalements
// dans une ligne « Signaler une erreur : … ». Chaque nom accessible reste complet. Fixture corpus-m1, production et preview.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const enfantsElements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
const visible = (n: Noeud): string => norm(texte(n, (x) => aClasse(x, 'sr-only') || x.attrs['aria-hidden'] === 'true'));
const accessible = (n: Noeud): string => norm(texte(n, (x) => x.attrs['aria-hidden'] === 'true'));
const dansDetails = (n: Noeud): boolean => {
  for (let p = n.parent; p !== null && p !== undefined; p = p.parent) if (p.tag === 'details') return true;
  return false;
};

export default function sourceCompacte(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'));
  const builds = () => {
    const out: { mode: string; outDir: string }[] = [];
    for (const mode of ['production', 'preview'] as const) {
      const b = ctx.construire(`m1-${mode}`, { racine, mode });
      assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
      out.push({ mode, outDir: b.outDir });
    }
    return out;
  };
  const pagesTheme = (outDir: string): { ou: string; arbre: Noeud }[] =>
    ctx
      .pagesHtml(outDir)
      .filter((f) => f.includes(`${path.sep}themes${path.sep}`))
      .map((f) => ({ ou: path.relative(outDir, f), arbre: analyserHtml(fs.readFileSync(f, 'utf8')) }));

  /** Titre et date : deux paragraphes visibles, hors de tout <details>. */
  const verifierTitreDate = (p1: Noeud | undefined, p2: Noeud | undefined, ou: string, prefixe: string): void => {
    assert.equal(p1?.tag, 'p', `${ou} : première ligne`);
    assert.ok(visible(p1 as Noeud).startsWith(prefixe), `${ou} : « ${visible(p1 as Noeud)} »`);
    assert.equal(trouver(p1 as Noeud, (n) => n.tag === 'span' && n.attrs['data-citation'] !== undefined).length, 1, `${ou} : titre cité`);
    assert.equal(p2?.tag, 'p', `${ou} : deuxième ligne`);
    assert.ok(visible(p2 as Noeud).startsWith('Consultée le '), `${ou} : « ${visible(p2 as Noeud)} »`);
    const t = trouver(p2 as Noeud, (n) => n.tag === 'time');
    assert.equal(t.length, 1, `${ou} : une date`);
    assert.match(t[0]?.attrs.datetime ?? '', /^\d{4}-\d{2}-\d{2}$/, ou);
    for (const p of [p1, p2] as Noeud[]) assert.ok(!dansDetails(p), `${ou} : titre et date jamais repliés`);
  };

  /** Liens du document : une liste en ligne, un élément par lien, chaque nom accessible dit ce qu'il ouvre. */
  const verifierLiens = (ul: Noeud | undefined, ou: string): void => {
    assert.ok(ul !== undefined && ul.tag === 'ul' && aClasse(ul, 'source-liens'), `${ou} : ul.source-liens`);
    assert.equal(ul.attrs.role, 'list', `${ou} : role="list" (list-style: none)`);
    const lis = enfantsElements(ul);
    assert.ok(lis.length >= 2 && lis.length <= 3, `${ou} : ${lis.length} liens`);
    const noms: string[] = [];
    for (const li of lis) {
      assert.equal(li.tag, 'li', ou);
      const as = trouver(li, (n) => n.tag === 'a');
      assert.equal(as.length, 1, `${ou} : un lien par élément`);
      assert.equal(as[0]?.attrs.rel, 'noopener noreferrer', ou);
      noms.push(accessible(as[0] as Noeud));
    }
    assert.match(noms[0] as string, /^Document original\b/, ou);
    assert.match(noms.at(-1) as string, /^Extrait archivé \([0-9a-f]{12}\)/, ou);
    if (noms.length === 3) assert.match(noms[1] as string, /^Copie archivée\b/, ou);
    // Variante 2b (touche C5) : la liste, et elle seule, est repliée dans details.source-details, fermé par défaut,
    // dont le résumé visible est « Vérifier la source ».
    const repli = ul.parent as Noeud;
    assert.ok(repli.tag === 'details' && aClasse(repli, 'source-details'), `${ou} : liste dans details.source-details`);
    assert.equal(repli.attrs.open, undefined, `${ou} : fermé par défaut`);
    const resume = enfantsElements(repli)[0] as Noeud;
    assert.equal(resume.tag, 'summary', ou);
    assert.equal(visible(resume), 'Vérifier la source', ou);
    assert.deepEqual(enfantsElements(repli).map((e) => e.tag), ['summary', 'ul'], `${ou} : rien d'autre dans le repli`);
  };

  describe('source compacte 09.1 : bloc source des mesures et des cases vides', () => {
    it('chaque mesure : source primaire et date visibles, liens du document en liste, signalements en ligne', () => {
      const vues: Record<string, number> = {};
      for (const { mode, outDir } of builds()) {
        vues[mode] = 0;
        for (const { ou, arbre } of pagesTheme(outDir)) {
          for (const m of trouver(arbre, (n) => n.tag === 'article' && aClasse(n, 'mesure'))) {
            vues[mode]++;
            const lieu = `${mode} ${ou} #${m.attrs.id}`;
            const titreMesure = norm(texte(trouver(m, (n) => aClasse(n, 'mesure-titre'))[0] as Noeud));
            const blocs = trouver(m, (n) => n.tag === 'div' && aClasse(n, 'source'));
            assert.equal(blocs.length, 1, lieu);
            const [p1, p2, ...reste] = enfantsElements(blocs[0] as Noeud);
            verifierTitreDate(p1, p2, lieu, 'Source primaire : ');
            verifierLiens(trouver(blocs[0] as Noeud, (n) => n.tag === 'ul' && aClasse(n, 'source-liens'))[0], lieu);
            const signaler = reste.at(-1) as Noeud;
            assert.ok(signaler.tag === 'p' && aClasse(signaler, 'signaler'), `${lieu} : p.signaler en dernier`);
            assert.ok(!dansDetails(signaler), `${lieu} : signalements jamais repliés`);
            assert.match(norm(texte(signaler, (x) => aClasse(x, 'sr-only'))), /^Signaler une erreur : /, lieu);
            const as = trouver(signaler, (n) => n.tag === 'a');
            assert.equal(as.length, 2, lieu);
            assert.deepEqual(as.map(visible), ['par courriel', 'sur GitHub'], lieu);
            for (const a of as) {
              const nom = accessible(a);
              assert.ok(nom.startsWith('Signaler une erreur '), `${lieu} : « ${nom} »`);
              assert.ok(nom.includes(`« ${titreMesure} »`), `${lieu} : « ${nom} » sans le titre de la mesure`);
              assert.ok(nom.includes(visible(a)), `${lieu} : le nom accessible contient le libellé visible (WCAG 2.5.3)`);
            }
          }
        }
      }
      assert.ok(Object.values(vues).every((n) => n >= 1), `mesures vues : ${JSON.stringify(vues)}`);
    });

    it('chaque source consultée d’une case vide : même structure, liens nommés par le titre du document', () => {
      let vues = 0;
      for (const { mode, outDir } of builds()) {
        for (const { ou, arbre } of pagesTheme(outDir)) {
          for (const bloc of trouver(arbre, (n) => n.tag === 'div' && aClasse(n, 'sources-consultees'))) {
            const liste = enfantsElements(bloc).find((e) => e.tag === 'ul') as Noeud;
            for (const li of enfantsElements(liste)) {
              vues++;
              const lieu = `${mode} ${ou}`;
              const [p1, p2, ul, ...reste] = enfantsElements(li);
              const titre = norm(texte(trouver(p1 as Noeud, (n) => n.attrs['data-citation'] !== undefined)[0] as Noeud));
              verifierTitreDate(p1, p2, lieu, titre);
              verifierLiens(ul?.tag === 'ul' ? ul : trouver(li, (n) => n.tag === 'ul' && aClasse(n, 'source-liens'))[0], lieu);
              assert.ok(reste.length <= 1, lieu);
              for (const a of trouver(li, (n) => n.tag === 'a')) assert.ok(accessible(a).endsWith(`: ${titre}`), `${lieu} : « ${accessible(a)} »`);
              // Variante 2b : le résumé du repli nomme aussi le document (plusieurs sources par case)
              const resume = trouver(li, (n) => n.tag === 'summary')[0] as Noeud;
              assert.equal(accessible(resume), `Vérifier la source : ${titre}`, lieu);
            }
          }
        }
      }
      assert.ok(vues >= 2, `sources consultées vues : ${vues}`);
    });
  });
}
