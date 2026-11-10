// Mentions légales finales (LEG-01, 09-04) : régime de l'éditeur non professionnel (LCEN art. 1-1 II, D-02 révisée),
// contact réel (D-01), deux journaux du serveur (D-11, IN-06), droit de réponse (art. 1-1 III et décret 2007-1527),
// section « Relecture juridique » (D-03). Construit la configuration réelle du dépôt (config/site.yml,
// config/hebergeur.yml) et suit l'état de l'hébergeur : sous `prevu`, rendu d'avant la mise en ligne ; sous `actif`
// (à partir de 09-11), les trois éléments du serveur et le paragraphe RGPD. Le rendu `actif` est aussi vérifié au
// niveau du source par tests/ui/journal-acces.test.ts tant que le dépôt est `prevu`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import { loadHebergeurConfig } from '../../../src/lib/hebergeur-config.ts';
import { phraseJournalAcces, phraseSortieErreur } from '../../../src/lib/journal-acces.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const DECRET = 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000428279';
const ARTICLE_1_1 = 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614';

export default function mentionsFinales(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-mentions-finales'));
  const chemin = 'mentions-legales/index.html';
  const page = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return analyserHtml(ctx.lire(b.outDir, chemin));
  };
  const attr = (a: ReturnType<typeof analyserHtml>, nom: string) => trouver(a, (n) => n.attrs[nom] !== undefined);

  describe('mentions légales finales (régime II, LEG-01)', () => {
    // env vide : un RTP_DEPLOIEMENT=1 exporté par le développeur ne doit pas empêcher de déclarer ces cas
    const heb = loadHebergeurConfig(ctx.repoRoot, {});
    const site = loadSiteConfig(ctx.repoRoot, {});

    it('éditeur : régime non professionnel avec lien vers l’article 1-1, nom sans adresse ni téléphone', () => {
      const a = page();
      const t = norm(texte(a));
      assert.ok(t.includes('à titre non professionnel, au sens du II de l\'article 1-1'), t.slice(0, 400));
      assert.ok(t.includes('Éditeur et directeur de la publication : Erwan Henry.'));
      const liens = trouver(a, (n) => n.tag === 'a').map((n) => n.attrs.href ?? '');
      assert.ok(liens.includes(ARTICLE_1_1));
      assert.equal(liens.filter((h) => h.startsWith('tel:')).length, 0);
    });

    it('contact réel en mailto, sans ligne « Adresse provisoire »', () => {
      const a = page();
      const liens = trouver(a, (n) => n.tag === 'a').map((n) => n.attrs.href ?? '');
      assert.ok(liens.includes(`mailto:${site.contact}`), liens.join(' | '));
      assert.equal(site.contactProvisoire, false);
      assert.doesNotMatch(norm(texte(a)), /Adresse provisoire/);
    });

    it('droit de réponse : III de l’article 1-1, trois mois, trois jours, décret 2007-1527, 200 lignes, jamais « 6 IV »', () => {
      const a = page();
      const t = norm(texte(a));
      for (const attendu of ['III de l\'article 1-1', 'trois mois', 'trois jours', 'décret n° 2007-1527 du 24 octobre 2007', 'passages contestés', 'texte de la réponse demandée', '200 lignes au plus']) {
        assert.ok(t.includes(attendu), `« ${attendu} » absent`);
      }
      assert.ok(trouver(a, (n) => n.tag === 'a').some((n) => n.attrs.href === DECRET));
      assert.doesNotMatch(t, /6 IV|IV de l'article 6/);
    });

    it('section « Relecture juridique » dans les deux états, sans lien ni mention de la note de risques', () => {
      const a = page();
      const sections = attr(a, 'data-relecture-juridique');
      assert.equal(sections.length, 1);
      const s = norm(texte(sections[0]!));
      assert.match(s, /n'ont pas été relues par un juriste/);
      assert.match(s, /après l'ouverture/);
      assert.ok(trouver(a, (n) => n.tag === 'h2').some((n) => norm(texte(n)) === 'Relecture juridique'));
      const hrefs = trouver(a, (n) => n.attrs.href !== undefined).map((n) => n.attrs.href ?? '');
      assert.equal(hrefs.filter((h) => h.includes('RISQUES-JURIDIQUES')).length, 0);
      assert.doesNotMatch(norm(texte(a)), /RISQUES-JURIDIQUES|note de risques/);
    });

    it('journaux du serveur et RGPD : selon l’état de l’hébergeur', () => {
      const a = page();
      const t = norm(texte(a));
      if (heb.statut === 'prevu') {
        assert.equal(attr(a, 'data-identite-hebergeur').length, 0);
        assert.equal(attr(a, 'data-sortie-erreur').length, 0);
        assert.equal(attr(a, 'data-journal-acces').length, 0);
        assert.equal(attr(a, 'data-rgpd').length, 0);
        assert.ok(trouver(a, (n) => n.attrs['data-hebergeur'] === 'prevu').length >= 1);
      } else {
        assert.equal(attr(a, 'data-identite-hebergeur').length, 1);
        assert.equal(norm(texte(attr(a, 'data-journal-acces')[0]!)), norm(phraseJournalAcces()));
        assert.equal(norm(texte(attr(a, 'data-sortie-erreur')[0]!)), norm(phraseSortieErreur()));
        const rgpd = attr(a, 'data-rgpd');
        assert.equal(rgpd.length, 1);
        assert.ok(trouver(rgpd[0]!, (n) => n.tag === 'a').some((n) => n.attrs.href === 'https://www.cnil.fr/fr/plaintes'));
        assert.equal(trouver(a, (n) => n.attrs['data-hebergeur'] === 'prevu').length, 0);
        assert.match(t, /intérêt légitime/);
      }
    });
  });
}
