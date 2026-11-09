// Page Méthode (INST-01, INST-04) : la page est égale à ses imports (config.ts, couverture, dataset, tours, profil 4G).
// Réutilise le build « m1-production » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { classer, lireCouverture, MARGE_EGALITE, THEMES_SPEC } from '../../../scripts/lib/couverture.ts';
import {
  CATALOGUE, HYPOTHESES, KANDEL_MOLES, LONGUEURS, MOTS_INTERDITS, PERIMETRE_EQUITE, PHRASE_ENFANT_MAX,
  SEUIL_KANDEL_MOLES, VERBES_CONNOTES,
} from '../../../src/lib/content-core/rules/config.ts';
import { ETAT_VIDE_TEXTES, formatDate, LIBELLES_STATUT } from '../../../src/lib/corpus/vue.ts';
import { loadDatasetDatagouv } from '../../../src/lib/dataset-datagouv.ts';
import { loadHebergeurConfig } from '../../../src/lib/hebergeur-config.ts';
import { TOURS } from '../../../src/lib/dates-tours.ts';
import { MESURE_SERVEUR_4G, PROFILS_4G } from '../../../src/lib/profil-4g.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

export default function methode(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-methode'));
  const build = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build a échoué :\n${b.output}`);
    return b;
  };
  const page = (): Noeud => analyserHtml(ctx.lire(build().outDir, 'methode/index.html'));
  const avec = (a: Noeud, attr: string, valeur?: string): Noeud[] =>
    trouver(a, (n) => attr in n.attrs && (valeur === undefined || n.attrs[attr] === valeur));
  const txt = (n: Noeud): string => norm(texte(n));
  const unique = (a: Noeud, attr: string, valeur?: string): Noeud => {
    const l = avec(a, attr, valeur);
    assert.equal(l.length, 1, `${attr}${valeur ? `="${valeur}"` : ''} : ${l.length} élément(s)`);
    return l[0] as Noeud;
  };

  describe('méthode : règles lues dans config.ts', () => {
    it('mots interdits : un seul élément, tous les exemples, aucune erreur check-dist', () => {
      const el = unique(page(), 'data-liste-mots-interdits');
      const t = txt(el);
      for (const m of MOTS_INTERDITS) for (const ex of m.exemples) assert.ok(t.includes(ex), `« ${ex} » absent`);
      const erreurs = checkDist(build().outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') }).filter(
        (c) => c.severite === 'erreur',
      );
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });

    it('bornes de longueur, phrase enfant, Kandel-Moles', () => {
      const a = page();
      for (const [niveau, b] of Object.entries(LONGUEURS) as [string, { min?: number; max: number }][]) {
        const t = txt(unique(a, 'data-borne', niveau));
        assert.ok(t.includes(String(b.max)), `${niveau} max`);
        if (b.min !== undefined) assert.ok(t.includes(String(b.min)), `${niveau} min`);
      }
      assert.ok(txt(unique(a, 'data-regle', 'phrase-enfant-max')).includes(String(PHRASE_ENFANT_MAX)));
      const k = txt(unique(a, 'data-regle', 'kandel-moles'));
      for (const v of [String(SEUIL_KANDEL_MOLES), ...[KANDEL_MOLES.base, KANDEL_MOLES.motsParPhrase, KANDEL_MOLES.syllabesParMot].map((x) => x.toLocaleString('fr-FR'))]) {
        assert.ok(k.includes(v), `Kandel-Moles : « ${v} » absent de « ${k} »`);
      }
      assert.ok(k.includes('1,015') && k.includes('73,6') && k.includes('207'));
    });

    it("périmètre d'équité et verbes connotés", () => {
      const a = page();
      const lis = trouver(unique(a, 'data-perimetre-equite'), (n) => n.tag === 'li').map(txt);
      assert.deepEqual(lis, PERIMETRE_EQUITE.map((c) => LIBELLES_STATUT[c]));
      const v = txt(unique(a, 'data-verbes-connotes'));
      for (const verbe of VERBES_CONNOTES) assert.ok(v.includes(verbe), verbe);
    });

    it('INFO : les non-candidats sont décrits là où ils apparaissent (page thème : motif et date ; page de la personne : motif et source)', () => {
      const a = page();
      const t = txt(unique(a, 'data-regle', 'non-candidats'));
      assert.ok(t.includes('Sur chaque page thème') && t.includes('avec le motif et la date'), t);
      assert.ok(t.includes('donne le motif et la source'), t);
      assert.doesNotMatch(txt(a), /sur la page des candidats/);
      // Ce que la phrase annonce existe : la page thème de la fixture liste Luc avec son motif et une date.
      const theme = analyserHtml(ctx.lire(build().outDir, 'themes/logement/index.html'));
      const renonce = trouver(theme, (n) => n.tag === 'details' && n.attrs.class === 'renonce')[0] as Noeud;
      assert.ok(renonce, 'liste « Ne se présentent pas » absente');
      assert.ok(txt(renonce).includes('retrait de la candidature'), txt(renonce));
      assert.ok(trouver(renonce, (n) => n.tag === 'time').length > 0, 'date absente');
    });

    it('catalogue et hypothèses dans un <details>', () => {
      const a = page();
      const cat = unique(a, 'data-catalogue');
      const lignes = trouver(cat, (n) => n.tag === 'tr').filter((tr) => trouver(tr, (n) => n.tag === 'td').length > 0);
      assert.equal(lignes.length, CATALOGUE.length);
      const t = txt(cat);
      for (const e of CATALOGUE) assert.ok(t.includes(e.code), e.code);
      const hyp = unique(a, 'data-hypotheses');
      assert.equal(trouver(hyp, (n) => n.tag === 'li').length, HYPOTHESES.length);
      const details = trouver(a, (n) => n.tag === 'details');
      for (const el of [cat, hyp]) assert.ok(details.some((d) => trouver(d, (n) => n === el).length > 0), 'dans un <details>');
    });
  });

  describe('méthode : couverture, dataset, dates, 4G', () => {
    it('classement et thèmes pilotes recalculés', () => {
      const a = page();
      const lu = lireCouverture(fs.readFileSync(path.join(ctx.repoRoot, 'data/couverture-themes.yaml'), 'utf8'));
      assert.deepEqual(lu.problemes, []);
      const res = classer(lu.data);
      const nom = (id: string): string => THEMES_SPEC.find((t) => t.id === id)?.nom ?? id;
      const lignes = trouver(unique(a, 'data-classement'), (n) => n.tag === 'tr').filter((tr) => trouver(tr, (n) => n.tag === 'td').length > 0);
      assert.deepEqual(
        lignes.map((tr) => txt(trouver(tr, (n) => n.tag === 'th' || n.tag === 'td')[0] as Noeud)),
        res.classement.map((l) => nom(l.theme)),
      );
      const pil = txt(unique(a, 'data-pilotes'));
      const attendus = lu.data.pilote.themes.length > 0 ? lu.data.pilote.themes : res.choix;
      for (const c of attendus) assert.ok(pil.includes(nom(c)), c);
      // W1 : « (livré) » seulement pour un thème pilote visible dans ce build (fixture : aucun thème pilote publié).
      const visibles = new Set(trouver(analyserHtml(ctx.lire(build().outDir, 'themes/index.html')), (n) => n.tag === 'li' && n.attrs['data-theme'] !== undefined).map((n) => n.attrs['data-theme']));
      for (const li of trouver(unique(a, 'data-pilotes'), (n) => n.tag === 'li')) {
        const id = li.attrs['data-pilote'] ?? '';
        const attendu = lu.data.pilote.livres.includes(id) && visibles.has(id);
        assert.equal(txt(li).endsWith('(livré)'), attendu, `${id} : « (livré) » ${attendu ? 'attendu' : 'inattendu'} (thèmes visibles : ${[...visibles].join(', ')})`);
      }
      const marge = txt(unique(a, 'data-regle', 'marge'));
      assert.ok(marge.includes(String(MARGE_EGALITE)));
      // IN-01 : même règle que classer() : retenu d'office à P4 + marge ou plus, égalité dans la bande du meilleur restant.
      assert.ok(marge.includes(`quatrième du classement de ${MARGE_EGALITE} positions ou plus est retenu d'office`), marge);
      assert.doesNotMatch(marge, /Deux thèmes à \d+ positions d'écart ou moins/);
    });

    it('dataset : 51 annoncés, 59 lignes, statuts, licence, attribution', () => {
      const d = loadDatasetDatagouv(ctx.repoRoot);
      const bloc = unique(page(), 'data-dataset');
      const t = txt(bloc);
      assert.ok(t.includes(String(d.annonce)) && t.includes(String(d.instantane.total)));
      // WR-07 : la phrase d'écart suit les nombres calculés.
      if (d.annonce !== d.instantane.total) assert.match(t, /alors que le fichier .* Cet écart est constaté/);
      else assert.ok(!t.includes('écart') && t.includes('le même nombre'), t);
      for (const n of Object.values(d.instantane.parStatut)) assert.ok(t.includes(String(n)));
      assert.ok(t.includes('Licence Ouverte 2.0') && t.includes('2027 et moi'));
      const hrefs = trouver(bloc, (n) => n.tag === 'a').map((n) => n.attrs.href);
      assert.ok(hrefs.includes(d.page), hrefs.join(' | '));
    });

    it("sondages : loi n° 77-808 et Commission des sondages, jamais « sondages … relèvent de l'Arcom » (CR-01)", () => {
      const a = page();
      const t = txt(unique(a, 'data-regle', 'sondages'));
      assert.ok(t.includes('loi n° 77-808 du 19 juillet 1977'), t);
      assert.ok(t.includes('Commission des sondages'), t);
      const main = txt(trouver(a, (n) => n.tag === 'main')[0] as Noeud);
      assert.doesNotMatch(main, /sondages[^.]*relèvent de l'Arcom/);
    });

    it("« pas encore en ligne » seulement sous l'hébergeur prévu, marqué pour check-dist (WR-03)", () => {
      const a = page();
      const heb = loadHebergeurConfig(ctx.repoRoot, {});
      const marques = trouver(a, (n) => n.attrs['data-hebergeur'] === 'prevu').map(txt).join(' | ');
      if (heb.statut === 'prevu') assert.ok(marques.includes("pas encore en ligne"), marques);
      else assert.ok(!txt(a).includes('pas encore en ligne'));
    });

    it('dates des tours, profil 4G, états vides', () => {
      const a = page();
      const main = trouver(a, (n) => n.tag === 'main')[0] as Noeud;
      for (const tour of TOURS) assert.ok(trouver(main, (n) => n.tag === 'time' && n.attrs.datetime === tour.date).length > 0, tour.date);
      const t = txt(main);
      for (const p of PROFILS_4G) {
        const el = txt(unique(a, 'data-profil-4g', p.id));
        assert.ok(el.includes(p.libelle), el);
        assert.ok(el.includes(`moins de ${(p.budgetMs / 1000).toLocaleString('fr-FR')} s`), el);
        // D-13 (08-05) : moins de 1 s sur les deux profils publiés.
        assert.ok(el.includes('moins de 1 s avec '), el);
      }
      assert.ok(txt(unique(a, 'data-profil-4g', 'slow-4g-lighthouse')).includes('« Slow 4G simulé »'), 'libellé Slow 4G simulé absent');
      assert.doesNotMatch(t, /moins d'une seconde sur une connexion mobile lente/);
      // IN-04 : le seuil d'axe publié est celui de e2e/axe.spec.ts (serious, critical).
      assert.ok(t.includes("le test bloque sur les défauts que l'outil classe graves ou critiques"), 'seuil axe absent');
      for (const e of Object.values(ETAT_VIDE_TEXTES)) assert.ok(t.includes(norm(e.avant)), e.avant);
    });

    it('PERF-02 (D-13, 08-14) : mesure derrière le serveur réel, lue dans MESURE_SERVEUR_4G', () => {
      const a = page();
      const M = MESURE_SERVEUR_4G;
      const el = unique(a, 'data-mesure-serveur');
      const t = txt(el);
      const fr = (n: number): string => n.toLocaleString('fr-FR');
      // Date en français dans un <time> à la date ISO de la constante.
      assert.ok(trouver(el, (n) => n.tag === 'time' && n.attrs.datetime === M.date && txt(n) === formatDate(M.date)).length === 1, t);
      assert.ok(t.includes('« Slow 4G simulé »'), t);
      assert.ok(t.includes(M.page) && t.includes(`${fr(M.octetsGzip)} octets`) && t.includes(M.encodage), t);
      // Pire mesure de chaque profil, avec le nom court du profil.
      for (const m of M.profils) {
        const profil = PROFILS_4G.find((p) => p.id === m.id)!;
        const span = txt(unique(el, 'data-mesure-profil', m.id));
        assert.ok(span.includes(`${fr(Math.max(...m.mesuresMs))} ms`) && span.includes(profil.nom), span);
      }
      for (const v of [M.lighthouse.version, `${fr(M.lighthouse.fcpMs)} ms`, `${fr(M.lighthouse.lcpMs)} ms`, `${fr(M.lighthouse.speedIndexMs)} ms`]) {
        assert.ok(t.includes(v), `« ${v} » absent de « ${t} »`);
      }
      assert.ok(t.includes(norm(M.perimetre)) && t.includes(norm(M.ecart)), t);
      assert.doesNotMatch(t, /[\u2013\u2014]/, 'tiret long ou demi-cadratin');
      // Les nombres viennent de la constante : aucun n'est écrit dans la page.
      const src = fs.readFileSync(path.join(ctx.repoRoot, 'src/pages/methode.astro'), 'utf8');
      assert.ok(src.includes('MESURE_SERVEUR_4G'));
      const nombres = [M.octetsGzip, ...M.profils.flatMap((m) => m.mesuresMs), M.lighthouse.fcpMs, M.lighthouse.lcpMs, M.lighthouse.speedIndexMs];
      for (const n of nombres) assert.doesNotMatch(src, new RegExp(`\\b${n}\\b`), `${n} écrit en dur dans methode.astro`);
      assert.ok(!src.includes(M.date) && !src.includes(M.lighthouse.version), 'date ou version écrite en dur');
    });

    it('lien Méthode dans le pied de page de chaque page', () => {
      const liste = ctx.pagesHtml(build().outDir);
      assert.ok(liste.length > 0);
      for (const f of liste) {
        const rel = path.relative(build().outDir, f);
        const pied = trouver(analyserHtml(ctx.lire(build().outDir, rel)), (n) => n.tag === 'footer')[0] as Noeud;
        assert.ok(trouver(pied, (n) => n.tag === 'a').some((n) => n.attrs.href === '/methode/'), rel);
      }
    });

    it('source de la page : aucun mot interdit ni nombre en dur', () => {
      const src = fs.readFileSync(path.join(ctx.repoRoot, 'src/pages/methode.astro'), 'utf8');
      for (const m of MOTS_INTERDITS) for (const ex of m.exemples) assert.ok(!src.includes(ex), `« ${ex} » en dur`);
      assert.doesNotMatch(src, /\b(51|59|37|17|207|73[,.]6|1[,.]015)\b/);
    });
  });
}
