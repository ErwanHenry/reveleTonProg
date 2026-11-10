// LEG-02 (D-03) : la note de risques juridiques que signe Erwan à la place d'une relecture par un juriste avant
// l'ouverture. Ce test fige sa structure (R1 à R9, déclencheurs de la bascule vers une domiciliation, bloc de
// signature) et ses règles de forme. Il accepte l'état non signé (« à compléter ») comme l'état signé (date
// AAAA-MM-JJ et mention « risque accepté »), pour que la signature de 09-08 ne casse rien.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const note = readFileSync(path.join(REPO, 'docs', 'RISQUES-JURIDIQUES.md'), 'utf8');
const lignes = note.split('\n');

/** Valeur d'une ligne « Libellé : valeur » du bloc de signature (premier match), sans gras ni puce. */
function valeur(texte: string, libelle: string): string | undefined {
  const re = new RegExp(`^(?:[-*]\\s+)?(?:\\*\\*)?${libelle}\\s*:(?:\\*\\*)?\\s*(.*)$`);
  for (const l of texte.split('\n')) {
    const m = re.exec(l.trim());
    if (m) return m[1]?.trim();
  }
  return undefined;
}

describe('docs/RISQUES-JURIDIQUES.md : structure (LEG-02)', () => {
  it('sections dans l’ordre : en-tête, périmètre, risques, procédures, bascule, points non vérifiés, suivi, signature', () => {
    const titres = ['## Périmètre et limites', '## Tableau des risques', '## Procédures liées', '## Bascule vers une domiciliation', '## Points non vérifiés', '## Suivi après l’ouverture', '## Signature'];
    let avant = 0;
    for (const t of titres) {
      const i = lignes.findIndex((l) => l.trim() === t);
      assert.ok(i >= 0, `titre absent : ${t}`);
      assert.ok(i > avant, `titre hors d'ordre : ${t}`);
      avant = i;
    }
    for (const champ of ['Version', 'Date', 'Auteur', 'Signataire', 'Statut']) {
      assert.ok(lignes.slice(0, 20).some((l) => l.includes(`${champ} :`)), `en-tête sans « ${champ} »`);
    }
    assert.match(note, /agent d'IA/);
  });

  it('neuf lignes de risque R1 à R9, une fois chacune, chacune avec ses huit colonnes', () => {
    const rangs = lignes.filter((l) => /^\| R\d /.test(l));
    assert.equal(rangs.length, 9);
    for (let n = 1; n <= 9; n++) {
      const r = rangs.filter((l) => l.startsWith(`| R${n} `));
      assert.equal(r.length, 1, `R${n}`);
      const cellules = r[0]!.split('|').slice(1, -1).map((c) => c.trim());
      assert.equal(cellules.length, 8, `R${n} : ${cellules.length} colonnes`);
      assert.ok(cellules.every((c) => c !== ''), `R${n} : cellule vide`);
      assert.match(cellules[3]!, /^(faible|moyenne|forte)\b/, `R${n} : probabilité`);
    }
  });

  it('les faits datés d’Erwan : identité transmise à l’hébergeur, contact testé, réponse depuis une boîte personnelle', () => {
    assert.ok(note.includes("Identité transmise à l'hébergeur le 2026-11-10"));
    assert.ok(note.includes('Hetzner Online GmbH'));
    assert.match(note, /hors du dépôt/);
    assert.match(note, /Adresse de contact testée de bout en bout le 2026-11-10/);
    assert.match(note, /boîte personnelle de l'éditeur/);
    assert.match(note, /envoyer en tant que/);
    // aucune adresse courriel en clair (ni personnelle ni autre)
    assert.doesNotMatch(note, /[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it('bascule vers une domiciliation : les trois déclencheurs, le contenu, la limite, le juriste', () => {
    for (const p of [
      'audience notable ou reprise par la presse',
      'tout revenu : don, partenariat, publicité',
      "lien avec l'activité de freelance de l'éditeur",
      'adresse de domiciliation',
      'numéro dédié',
      "ne vaut que pour l'avenir",
      'premier point à faire relire par un juriste',
    ]) assert.ok(note.includes(p), `« ${p} » absent`);
  });

  it('points non vérifiés : A1 à A10, une ligne chacun', () => {
    const section = note.slice(note.indexOf('## Points non vérifiés'), note.indexOf('## Suivi après l’ouverture'));
    for (let n = 1; n <= 10; n++) assert.equal([...section.matchAll(new RegExp(`^- A${n} :`, 'gm'))].length, 1, `A${n}`);
  });

  it('bloc de signature : phrase, signataire, date, mention ; non signé ou signé', () => {
    const bloc = note.slice(note.indexOf('## Signature'));
    assert.ok(bloc.includes("J'ai lu cette note et j'accepte les risques résiduels décrits ci-dessus."));
    const signataire = valeur(bloc, 'Signataire');
    const date = valeur(bloc, 'Date');
    const mention = valeur(bloc, 'Mention');
    assert.ok(signataire !== undefined && date !== undefined && mention !== undefined, 'ligne de signature absente');
    const nonSigne = date === 'à compléter' && mention === 'à compléter';
    const signe = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && /risque accepté/.test(mention ?? '');
    assert.ok(nonSigne || signe, `état de signature incohérent : date « ${date} », mention « ${mention} »`);
  });

  it('liens : seulement https vers Légifrance ou la CNIL', () => {
    const urls = [...note.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]);
    assert.ok(urls.length >= 5);
    for (const u of urls) assert.match(u, /^https:\/\/www\.(legifrance\.gouv\.fr|cnil\.fr)\//, u);
    for (const attendu of ['LEGIARTI000049568614', 'LEGIARTI000049568616', 'JORFTEXT000000428279', 'LEGIARTI000039446215', 'LEGIARTI000032454547']) {
      assert.ok(urls.some((u) => u.includes(attendu)), `lien Légifrance absent : ${attendu}`);
    }
  });

  it('droit de réponse : base au III de l’article 1-1, « 6 IV » jamais présenté comme la base', () => {
    assert.match(note, /III de l'article 1-1/);
    for (const l of lignes.filter((x) => /6 IV|IV de l'article 6/.test(x))) {
      assert.match(l, /ancien|ne repose plus|visas/, `« 6 IV » présenté comme base : ${l.slice(0, 160)}`);
    }
  });

  it('ni tiret long ni tiret moyen, aucun mot interdit', () => {
    assert.doesNotMatch(note, /[–—]/);
    assert.deepEqual(motsInterdits(note, { exempterCitations: false }), []);
  });
});
