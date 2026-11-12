// Source primaire complète et liens de signalement sous chaque mesure (M1-04), build de production du corpus-m1.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { lienExtrait, lienIssue, lienMailto } from '../../../src/lib/corpus/signalement.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const enfantsElements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');

const ID = 'marie-fictive/aide-construction';
const TITRE = 'Aide à la construction dans les zones tendues (fictif)';
const INTRO = "Vous avez repéré une erreur ? Signalez-la : l'identifiant de la mesure est déjà indiqué dans le message.";

export default function source(ctx: ContexteSite): void {
  // Racine dédiée dans un dossier temporaire du contexte : nettoyerCorpusM1() supprimerait aussi celles des autres modules de cas.
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'));

  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const page = (chemin: string): { html: string; arbre: Noeud } => {
    const html = ctx.lire(production().outDir, chemin);
    return { html, arbre: analyserHtml(html) };
  };
  const bloc = (): Noeud => {
    const { arbre } = page('themes/logement/index.html');
    const mesure = trouver(arbre, (n) => n.tag === 'article' && aClasse(n, 'mesure') && n.attrs.id === 'm-marie-fictive-aide-construction')[0];
    assert.ok(mesure, 'mesure de Marie présente');
    return trouver(mesure, (n) => aClasse(n, 'source'))[0] as Noeud;
  };
  const liens = (n: Noeud): Noeud[] => trouver(n, (x) => x.tag === 'a');

  describe('bloc source', () => {
    it('ordre : source primaire, date de consultation, document original, Wayback, extrait, signalements', () => {
      const s = bloc();
      const lignes = enfantsElements(s).map((e) => norm(texte(e)));
      assert.equal(lignes[0], 'Source primaire : Programme fictif de Marie Fictive');
      assert.equal(lignes[1], 'Consultée le 20 octobre 2026');
      // 09.1, proposition 2 : liens du document sur une ligne, signalements sur une ligne
      // Variante 2b : la liste est dans details.source-details, derrière « Vérifier la source »
      assert.equal(lignes[2], 'Vérifier la source Document original Copie archivée Extrait archivé (23c5f1cc8eff)');
      assert.match(lignes[3] as string, /^Signaler une erreur : Signaler une erreur par courriel.*Signaler une erreur sur GitHub/);
      assert.equal(lignes.length, 4);
      const titre = trouver(s, (n) => n.tag === 'span' && n.attrs['data-citation'] !== undefined)[0] as Noeud;
      assert.equal(norm(texte(titre)), 'Programme fictif de Marie Fictive');
      const t = trouver(s, (n) => n.tag === 'time')[0] as Noeud;
      assert.equal(t.attrs.datetime, '2026-10-20');
    });

    it('liens : original, Wayback et extrait', () => {
      const [original, wayback, extrait] = liens(bloc());
      assert.equal(original?.attrs.href, 'https://marie-fictive.exemple.invalid/programme');
      assert.equal(original?.attrs.rel, 'noopener noreferrer');
      assert.equal(wayback?.attrs.href, 'https://web.archive.org/web/20261020100000/https://marie-fictive.exemple.invalid/programme');
      assert.equal(extrait?.attrs.href, lienExtrait('ErwanHenry/reveleTonProg', 'archives/marie-fictive/23c5f1cc8eff.txt', racine, ctx.repoRoot));
      assert.match(extrait?.attrs.href ?? '', /^https:\/\/github\.com\/ErwanHenry\/reveleTonProg\/blob\/main\/archives\/marie-fictive\/23c5f1cc8eff\.txt$/);
    });

    it('deux liens de signalement encodés, avec suffixe masqué nommant la mesure', () => {
      const [, , , mail, issue] = liens(bloc());
      // contact lu dans config/site.yml (env vide : pas de garde de déploiement ici), jamais écrit en dur (HEB-05)
      assert.equal(mail?.attrs.href, lienMailto(loadSiteConfig(ctx.repoRoot, {}).contact, ID, '/themes/logement/#m-marie-fictive-aide-construction'));
      assert.equal(issue?.attrs.href, lienIssue('ErwanHenry/reveleTonProg', ID));
      assert.equal(issue?.attrs.rel, 'noopener noreferrer');
      for (const a of [mail, issue]) {
        const sr = trouver(a as Noeud, (n) => n.tag === 'span' && aClasse(n, 'sr-only'));
        assert.equal(sr.length, 2, 'préfixe et suffixe .sr-only');
        assert.equal(norm(texte(sr[0] as Noeud)), 'Signaler une erreur');
        assert.equal(norm(texte(sr[1] as Noeud)), `sur la mesure « ${TITRE} »`);
      }
      assert.equal(norm(texte(mail as Noeud)), `Signaler une erreur par courriel sur la mesure « ${TITRE} »`);
      assert.equal(norm(texte(issue as Noeud)), `Signaler une erreur sur GitHub sur la mesure « ${TITRE} »`);
    });

    it('chaque mesure de chaque page thème a ses deux liens de signalement', () => {
      for (const f of ctx.pagesHtml(production().outDir).filter((p) => p.includes(`${path.sep}themes${path.sep}`))) {
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        for (const m of trouver(arbre, (n) => n.tag === 'article' && aClasse(n, 'mesure'))) {
          const textes = liens(m).map((a) => norm(texte(a)));
          assert.equal(textes.filter((t) => t.startsWith('Signaler une erreur par courriel')).length, 1, f);
          assert.equal(textes.filter((t) => t.startsWith('Signaler une erreur sur GitHub')).length, 1, f);
        }
      }
    });
  });

  describe('phrase de signalement', () => {
    it('une seule fois sur une page avec mesures, en tête du pied de page (09.1-05 : elle y a été déplacée), avant ses liens', () => {
      const { html } = page('themes/logement/index.html');
      assert.equal(html.split(INTRO).length - 1, 1);
      const i = html.indexOf(INTRO);
      const pied = html.indexOf('<footer');
      assert.ok(pied > 0 && i > pied, 'dans le pied de page');
      assert.ok(i < html.indexOf('<nav aria-label="Informations sur le site"'), 'avant les liens du pied');
      assert.ok(html.lastIndexOf('</main>', i) > 0 && html.lastIndexOf('</main>', i) < pied, 'après le contenu principal');
    });

    it('absente d’une page sans mesure', () => {
      const { outDir } = production();
      for (const f of ctx.pagesHtml(outDir)) {
        const html = fs.readFileSync(f, 'utf8');
        if (trouver(analyserHtml(html), (n) => n.tag === 'article' && aClasse(n, 'mesure')).length === 0) {
          assert.ok(!html.includes(INTRO), `${path.relative(outDir, f)} sans mesure ne doit pas porter la phrase`);
        }
      }
    });
  });

  describe('archives', () => {
    it('aucun lien du site vers archives/, aucun dossier archives/ dans dist', () => {
      const { outDir } = production();
      assert.ok(!fs.existsSync(path.join(outDir, 'archives')), 'dist ne contient pas archives/');
      for (const f of ctx.pagesHtml(outDir)) {
        const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
        for (const a of trouver(arbre, (n) => n.tag === 'a')) {
          const href = a.attrs.href ?? '';
          if (/^https?:/.test(href)) continue;
          assert.ok(!/(^|\/)archives\//.test(href), `${path.relative(outDir, f)} lie vers ${href}`);
        }
      }
    });

    it('checkDist ne signale aucune erreur en production', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
