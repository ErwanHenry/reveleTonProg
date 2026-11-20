// Phase 10.1 : classement de la veille (module pur scripts/lib/veille/classer.ts). Personnes fictives, adresses
// exemple.test, aucune lecture disque.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UpstreamRow } from '../../scripts/lib/datagouv.ts';
import { construireRapport, rapportMarkdown } from '../../scripts/lib/rapport-import.ts';
import type { EntreeRapport, PlanRapport } from '../../scripts/lib/rapport-import.ts';
import { classerVeille, comptesVeille, detailsLocauxMarkdown, resumeVeilleMarkdown } from '../../scripts/lib/veille/classer.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';

type Obj = Record<string, unknown>;

function statut(code: string, date: string, url: string, motif?: string, relecture = 'relu'): Obj {
  return { code, ...(motif !== undefined ? { motif } : {}), date, source: { type: 'presse', url, date_publication: date, date_consultation: '2026-11-09' }, statut_relecture: relecture };
}
const fiche = (id: string, statuts: Obj[]): Obj => ({ id, parti: null, statuts });

/** Plan d'import : `avant` (statuts du fichier) et le statut amont ; ajouté en fin si (code, motif) change. */
function plan(id: string, avant: Obj[] | null, amont: Obj): PlanRapport {
  const change = avant === null || (avant[avant.length - 1] as Obj).code !== amont.code || (avant[avant.length - 1] as Obj).motif !== amont.motif;
  const apresStatuts = avant === null ? [amont] : change ? [...avant, { ...amont, statut_relecture: 'brouillon' }] : avant;
  return { id, idAmont: `amont-${id}`, avant: avant === null ? null : fiche(id, avant), apres: fiche(id, apresStatuts), mappe: { id, parti: null, statuts: [amont] } };
}
function ligne(id: string, statutAmont: string): UpstreamRow {
  return { id, nom: 'Prénom Fictif', parti: 'Parti Fictif', statut: statutAmont, source: { titre: 'T', url: `https://exemple.test/${id}`, date: '2026-11-20' }, liens: {}, verifie_le: '2026-11-20' };
}
function entree(over: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    instantane: { nom: '2027etmoi-candidats-2026-11-20-bbbbbbbbbbbb.json', sha256: 'b'.repeat(64), miseAJour: '2026-11-20', lignes: 9, precedent: null },
    plans: [],
    inconnus: [],
    conflits: [],
    precedent: null,
    idsAmont: [],
    fichesAbsentes: [],
    candidats: [],
    themes: [],
    mesures: [],
    couvertures: [],
    themesOuverts: [],
    ...over,
  };
}
const U = (x: string): string => `https://exemple.test/${x}`;

describe('classerVeille', () => {
  it('rien de nouveau (statuts inchangés, dérive de source seule) : non notable, aucune ligne', () => {
    const p = plan('alpha-test', [statut('declare', '2026-09-01', U('a'))], statut('declare', '2026-11-10', U('a2')));
    const c = classerVeille(entree({ plans: [p] }));
    assert.equal(c.notable, false);
    assert.equal(c.derives, 1);
    assert.deepEqual([c.sorties, c.entrees, c.retours, c.autres, c.decisions].map((x) => x.length), [0, 0, 0, 0, 0]);
  });

  it('sortie avec motif décidé (ralliement), entrée (pressenti vers declare), retour (renonce vers declare), personne nouvelle', () => {
    const plans = [
      plan('alpha-test', [statut('declare', '2026-09-01', U('a'))], statut('renonce', '2026-11-15', U('a2'), 'ralliement')),
      plan('beta-test', [statut('pressenti', '2026-09-01', U('b'))], statut('declare', '2026-11-16', U('b2'))),
      plan('gamma-test', [statut('renonce', '2026-06-01', U('g'), 'non_candidat')], statut('declare', '2026-11-17', U('g2'))),
      plan('delta-test', null, statut('declare', '2026-11-18', U('d'))),
      plan('epsilon-test', null, statut('renonce', '2026-11-18', U('e'), 'non_candidat')),
      plan('zeta-test', [statut('declare', '2026-09-01', U('z'))], statut('primaire', '2026-11-19', U('z2'))),
    ];
    const c = classerVeille(entree({ plans }));
    assert.deepEqual(c.sorties.map((m) => [m.id, m.avant, m.apres]), [['alpha-test', 'declare', 'renonce/ralliement']]);
    assert.deepEqual(c.entrees.map((m) => m.id), ['beta-test', 'delta-test']);
    assert.deepEqual(c.retours.map((m) => m.id), ['gamma-test']);
    assert.deepEqual(c.autres.map((m) => m.id), ['epsilon-test', 'zeta-test']);
    assert.equal(c.decisions.length, 0);
    assert.equal(c.notable, true);
    assert.equal(comptesVeille(c), '1 sortie(s), 2 entrée(s), 1 retour(s), 2 autre(s) changement(s), 0 décision(s) à prendre');
  });

  it('désistement sans motif et personne absente de la table : sorties ou entrées, plus une décision chacune', () => {
    const c = classerVeille(
      entree({
        motifsADecider: [{ id: 'eta-test', idAmont: 'amont-eta', avant: [statut('declare', '2026-09-01', U('h'))], code: 'renonce', date: '2026-11-20', url: U('h2') }],
        inconnus: [ligne('inconnu-un', 'declare'), ligne('inconnu-deux', 'renonce')],
      }),
    );
    assert.deepEqual(c.sorties.map((m) => [m.id, m.motifADecider]), [['eta-test', true]]);
    assert.deepEqual(c.entrees.map((m) => m.id), ['inconnu-un']);
    assert.deepEqual(c.autres.map((m) => m.id), ['inconnu-deux']);
    assert.deepEqual(c.decisions.map((d) => [d.genre, d.idAmont]), [['motif', 'amont-eta'], ['correspondance', 'inconnu-deux'], ['correspondance', 'inconnu-un']]);
    assert.equal(c.notable, true);
  });

  it('effet sur un thème publié : sortie qui quittera le périmètre, entrée qui demande une case', () => {
    const alpha = [statut('declare', '2026-09-01', U('a'))];
    const c = classerVeille(
      entree({
        plans: [plan('beta-test', [statut('pressenti', '2026-09-01', U('b'))], statut('declare', '2026-11-16', U('b2')))],
        motifsADecider: [{ id: 'alpha-test', idAmont: 'amont-alpha', avant: alpha, code: 'renonce', date: '2026-11-20', url: U('a2') }],
        candidats: [{ id: 'alpha-test', statuts: alpha }, { id: 'beta-test', statuts: [statut('pressenti', '2026-09-01', U('b'))] }],
        themes: [{ id: 'logement', statutRelecture: 'publie' }],
        mesures: [{ theme: 'logement', candidat: 'alpha-test', statutRelecture: 'publie' }],
        themesOuverts: ['logement'],
      }),
    );
    const md = resumeVeilleMarkdown(c);
    assert.match(md, /^- logement : case de couverture à créer avant de relire le statut : beta-test ; sortira du périmètre une fois le statut relu : alpha-test \(1 mesure\(s\) publiée\(s\)\)$/m);
    assert.match(md, /^- alpha-test \(amont amont-alpha\) : declare \(2026-09-01\) -> renonce, motif à décider \(2026-11-20\), source https:\/\/exemple\.test\/a2$/m);
    assert.match(md, /motif du désistement à choisir parmi retrait, elimine_primaire, ralliement, non_candidat : amont-alpha \(fiche alpha-test\) : npm run veille -- decider amont-alpha/);
  });

  it('textes neutres : aucun mot interdit, aucun tiret long ni demi-long, aucune étiquette de parti', () => {
    const c = classerVeille(entree({ inconnus: [ligne('inconnu-un', 'declare')], motifsADecider: [{ id: 'eta-test', idAmont: 'amont-eta', avant: null, code: 'renonce', date: '2026-11-20', url: U('h') }] }));
    const t = resumeVeilleMarkdown(c) + comptesVeille(c);
    assert.deepEqual(motsInterdits(t, { exempterCitations: false }), []);
    assert.doesNotMatch(t, /[–—]/);
    assert.doesNotMatch(t, /Parti Fictif/);
  });

  it('texte amont non relu : seulement dans les détails locaux, échappé, jamais dans le résumé', () => {
    const c = classerVeille(entree({ inconnus: [ligne('inconnu-un', 'declare')] }));
    const details = detailsLocauxMarkdown(c, { 'inconnu-un': 'Se retire au profit de [quelqu’un](https://exemple.test/x)', autre: 'ignoré' });
    assert.match(details, /rapport local seulement, jamais publié/);
    assert.match(details, /^- inconnu-un : `Se retire au profit de \[quelqu’un\]\(https:\/\/exemple\.test\/x\)`$/m);
    assert.doesNotMatch(details, /ignoré/);
    assert.doesNotMatch(resumeVeilleMarkdown(c), /au profit/);
  });

  it('le rapport d’import imprime la section des motifs à décider seulement quand elle n’est pas vide', () => {
    const sans = rapportMarkdown(construireRapport(entree()));
    assert.doesNotMatch(sans, /Désistements dont le motif est à décider/);
    const avec = rapportMarkdown(construireRapport(entree({ motifsADecider: [{ id: 'eta-test', idAmont: 'amont-eta', avant: null, code: 'renonce', date: '2026-11-20', url: U('h') }] })));
    assert.match(avec, /^## Désistements dont le motif est à décider\n\n- eta-test \(amont amont-eta\) : nouvelle fiche -> renonce \(2026-11-20\), source https:\/\/exemple\.test\/h ; motif à décider parmi retrait, elimine_primaire, ralliement, non_candidat$/m);
  });
});
