// Pages institutionnelles (INST-02, INST-03, INST-04) : Mentions légales, Qui sommes-nous, dates des
// deux tours dans le pied de page de chaque page. Réutilise les builds « m1-production » et « m1-preview ».
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { loadHebergeurConfig } from '../../../src/lib/hebergeur-config.ts';
import { CLES_STOCKAGE } from '../../../src/lib/stockage-local.ts';
import { TOURS } from '../../../src/lib/dates-tours.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const MARQUES = /alignd|spikee\s?labs|faire un don|soutenir financièrement|helloasso|paypal|buymeacoffee|ko-fi|tipeee|utip|liberapay|patreon/i;
const PHRASE_FINANCEMENT = 'Ce site ne reçoit aucun financement.';

export default function institutionnel(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-institutionnel'));
  const build = (mode: 'production' | 'preview') => {
    const b = ctx.construire(`m1-${mode}`, { racine, mode });
    assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
    return b;
  };
  const html = (chemin: string): string => ctx.lire(build('production').outDir, chemin);
  const vu = (chemin: string): string => norm(texte(analyserHtml(html(chemin))));

  describe('mentions légales', () => {
    const heb = loadHebergeurConfig(ctx.repoRoot);
    const site = loadSiteConfig(ctx.repoRoot);
    const chemin = 'mentions-legales/index.html';

    it('contenu LCEN, éditeur, hébergeur, droit de réponse, Arcom', () => {
      const t = vu(chemin);
      for (const attendu of [
        'article 1-1', '2004-575', '2024-449', 'à titre non professionnel', 'Erwan Henry', 'directeur de la publication',
        heb.nom, heb.adresse, heb.telephone, 'trois mois', 'trois jours', 'Arcom',
      ]) assert.ok(t.includes(attendu), `« ${attendu} » absent`);
      if (heb.statut === 'prevu') assert.match(t, /Cette version de test n'est pas mise en ligne/);
      assert.doesNotMatch(t, /article 6\b|6 IV|IV de l'article 6/);
    });

    it('données personnelles : les deux clés, aucun cookie', () => {
      const t = vu(chemin);
      assert.ok(t.includes(CLES_STOCKAGE.niveau.cle));
      assert.ok(t.includes(CLES_STOCKAGE.ordre.cle));
      assert.match(t, /aucun cookie/);
    });

    it('lien mailto vers le contact, aucun lien tel:, un seul h1', () => {
      const a = analyserHtml(html(chemin));
      const liens = trouver(a, (n) => n.tag === 'a').map((n) => n.attrs.href ?? '');
      assert.ok(liens.includes(`mailto:${site.contact}`), liens.join(' | '));
      assert.equal(liens.filter((h) => h.startsWith('tel:')).length, 0);
      assert.equal(trouver(a, (n) => n.tag === 'h1').length, 1);
    });
  });

  describe('qui sommes-nous', () => {
    it('éditeur, phrase de financement, un seul h1', () => {
      const chemin = 'qui-sommes-nous/index.html';
      const t = vu(chemin);
      assert.ok(t.includes('Erwan Henry'));
      assert.ok(t.includes(PHRASE_FINANCEMENT));
      assert.equal(trouver(analyserHtml(html(chemin)), (n) => n.tag === 'h1').length, 1);
    });
  });

  for (const mode of ['production', 'preview'] as const) {
    describe(`pied de page et marques (${mode})`, () => {
      const pages = () => ctx.pagesHtml(build(mode).outDir);

      it('chaque page : dates des deux tours dans <time>, liens institutionnels', () => {
        const liste = pages();
        assert.ok(liste.length > 0);
        for (const f of liste) {
          const rel = path.relative(build(mode).outDir, f);
          const a = analyserHtml(ctx.lire(build(mode).outDir, rel));
          const pied = trouver(a, (n) => n.tag === 'footer')[0] as Noeud;
          assert.ok(pied, `${rel} : footer`);
          const times = trouver(pied, (n) => n.tag === 'time');
          for (const tour of TOURS) {
            assert.ok(times.find((n) => n.attrs.datetime === tour.date), `${rel} : <time datetime="${tour.date}">`);
          }
          const textes = times.map((n) => norm(texte(n)));
          assert.ok(textes.includes('18 avril 2027'), `${rel} : ${textes.join(',')}`);
          assert.ok(textes.includes('2 mai 2027'), rel);
          const hrefs = trouver(pied, (n) => n.tag === 'a').map((n) => n.attrs.href);
          assert.ok(hrefs.includes('/mentions-legales/'), rel);
          assert.ok(hrefs.includes('/qui-sommes-nous/'), rel);
        }
      });

      it('aucune marque tierce ni appel au don, texte et liens', () => {
        for (const f of pages()) {
          const rel = path.relative(build(mode).outDir, f);
          const a = analyserHtml(ctx.lire(build(mode).outDir, rel));
          assert.doesNotMatch(norm(texte(a)), MARQUES, rel);
          for (const l of trouver(a, (n) => n.tag === 'a')) assert.doesNotMatch(l.attrs.href ?? '', MARQUES, rel);
        }
      });

      it('checkDist sans erreur', () => {
        const erreurs = checkDist(build(mode).outDir, { mode, cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode) }).filter(
          (c) => c.severite === 'erreur',
        );
        assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
      });
    });
  }
}
