// Vue candidat du modèle (src/lib/corpus/vue.ts) : sections par thème, statut affiché, date de mise à jour.
// Le corpus vient de la surcouche fictive corpus-m1 (plan 04-01), chargée par content-core.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { Brut } from '../../src/lib/corpus/vue.ts';
import { BADGES, construireCorpus, depuis, texteSource } from '../../src/lib/corpus/vue.ts';
import type { SourceStatut } from '../../src/lib/corpus/types.ts';
import { materialiserCorpusM1 } from '../helpers/corpus-m1.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

let brut: Brut;
let dossier: string;

before(() => {
  // Racine dédiée (pas de nettoyerCorpusM1 global : il supprimerait les racines des autres modules).
  dossier = mkdtempSync(path.join(os.tmpdir(), 'rtp-vue-candidat-'));
  const racine = materialiserCorpusM1(path.join(dossier, 'corpus-m1'));
  const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
  const de = <T>(collection: string): T[] => res.entries.filter((e) => e.collection === collection).map((e) => e.data as unknown as T);
  brut = {
    themes: de('themes'),
    candidats: de('candidats'),
    mesures: de('mesures'),
    sources: de('sources'),
    couverture: de('couverture'),
    glossaire: de('glossaire'),
  };
});
after(() => rmSync(dossier, { recursive: true, force: true }));

describe('depuis et texteSource', () => {
  it('depuis : jour, mois, année', () => {
    assert.equal(depuis('2026-10-15'), 'depuis le 15 octobre 2026');
    assert.equal(depuis('2026-11-01'), 'depuis le 1er novembre 2026');
    assert.equal(depuis('2026-09'), 'depuis septembre 2026');
    assert.equal(depuis('2026'), 'depuis 2026');
  });

  it("texteSource : le titre, sinon l'hôte sans « www. »", () => {
    const base = { type: 'candidat', url: 'https://www.la-convention.fr/', date_consultation: '2026-10-01' } as const satisfies SourceStatut;
    assert.equal(texteSource(base), 'la-convention.fr');
    assert.equal(texteSource({ ...base, titre: 'Annonce' }), 'Annonce');
    assert.equal(texteSource({ ...base, url: 'https://exemple.fr/a/b?c=1' }), 'exemple.fr');
  });
});

describe('pageCandidat : production', () => {
  const corpus = () => construireCorpus(brut, 'production');

  it('Marie : sections logement puis climat, mesures en ordre de titre, case « non précisé »', () => {
    const p = corpus().pageCandidat('marie-fictive');
    assert.deepEqual(
      p.sections.map((s) => s.theme.theme.id),
      ['logement', 'climat'],
    );
    assert.deepEqual(p.sections[0]?.cellule.mesures.map((m) => m.mesure.titre), [
      'Aide à la construction dans les zones tendues (fictif)',
      'Encadrement des loyers dans les villes moyennes (fictif)',
    ]);
    assert.equal(p.sections[1]?.cellule.etat, 'non_precise');
    assert.equal(p.statut?.code, 'declare');
    assert.equal(p.badgeStatut, null);
    assert.equal(p.miseAJour, '2026-10-26');
  });

  it('Paul : statut non relu jamais présenté comme un fait', () => {
    const p = corpus().pageCandidat('paul-de-villefranche');
    assert.equal(p.statut, null);
    assert.equal(p.badgeStatut, null);
    // Hors périmètre en production tant que son statut « declare » n'est pas relu (ADR-041) : pas de section.
    assert.deepEqual(p.sections, []);
  });

  it('Nina (pressentie, hors périmètre) : aucune section', () => {
    const p = corpus().pageCandidat('nina-pressentie');
    assert.deepEqual(p.sections, []);
    assert.equal(p.statut, null);
    assert.equal(p.miseAJour, undefined);
  });

  it('Luc : statut renonce relu affiché, aucune section', () => {
    const p = corpus().pageCandidat('luc-retire');
    assert.equal(p.statut?.code, 'renonce');
    assert.equal(p.statut?.motif, 'retrait');
    assert.deepEqual(p.sections, []);
    assert.equal(p.miseAJour, '2026-10-25');
  });

  it('candidat inconnu : erreur explicite', () => {
    assert.throws(() => corpus().pageCandidat('inconnu'), /inconnu/);
  });
});

describe('pageCandidat : preview', () => {
  const corpus = () => construireCorpus(brut, 'preview');

  it("Marie : le thème relu s'intercale selon son ordre, case non vérifiée", () => {
    const p = corpus().pageCandidat('marie-fictive');
    assert.deepEqual(
      p.sections.map((s) => s.theme.theme.id),
      ['logement', 'ecole', 'climat'],
    );
    assert.equal(p.sections[1]?.cellule.etat, 'non_verifie');
  });

  it('Paul : statut déclaré en brouillon affiché avec sa pastille', () => {
    const p = corpus().pageCandidat('paul-de-villefranche');
    assert.equal(p.statut?.code, 'declare');
    assert.equal(p.statut?.date, '2026-10-19');
    assert.equal(p.badgeStatut, BADGES.brouillon);
  });

  it('Nina : aucune section, statut pressenti en brouillon', () => {
    const p = corpus().pageCandidat('nina-pressentie');
    assert.deepEqual(p.sections, []);
    assert.equal(p.statut?.code, 'pressenti');
    assert.equal(p.badgeStatut, BADGES.brouillon);
  });
});

describe('miseAJourIndex', () => {
  it('maximum des dates des thèmes visibles et des statuts affichés', () => {
    assert.equal(construireCorpus(brut, 'production').miseAJourIndex(), '2026-10-26');
  });

  it('corpus sans thème ni candidat : undefined', () => {
    const vide = construireCorpus({ themes: [], candidats: [], mesures: [], sources: [], couverture: [], glossaire: [] }, 'production');
    assert.equal(vide.miseAJourIndex(), undefined);
  });
});
