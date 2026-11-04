import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import {
  UnknownUpstreamIdsError,
  UpstreamShapeError,
  checkUpstream,
  dateComparable,
  lireCorrespondances,
  mapRow,
  ajouterStatutYaml,
  dateAvant,
  mergeFiche,
  renderYaml,
  snapshotName,
} from '../../scripts/lib/datagouv.ts';
import type { Correspondance, UpstreamRow } from '../../scripts/lib/datagouv.ts';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const IMPORT_DIR = path.join(REPO_ROOT, 'data', 'import');
const snapName = readdirSync(IMPORT_DIR)
  .filter((n) => /^2027etmoi-candidats-.*\.json$/.test(n) && !n.endsWith('.meta.json'))
  .sort()
  .pop() as string;
const brut: unknown = JSON.parse(readFileSync(path.join(IMPORT_DIR, snapName), 'utf8'));
const corr: Record<string, Correspondance> = lireCorrespondances(parse(readFileSync(path.join(IMPORT_DIR, 'correspondances.yaml'), 'utf8'), { schema: 'core' }));
const { rows, miseAJour } = checkUpstream(brut);
const clone = <T>(o: T): T => structuredClone(o);
const FICHE = path.join(REPO_ROOT, 'src', 'content', 'candidats', 'x.yaml');
const valide = (fiche: unknown) => validateYamlText('candidat', renderYaml(fiche), FICHE, { schemasDir: SCHEMAS_DIR }).diagnostics;

describe('checkUpstream', () => {
  it('accepte l’instantané committé', () => {
    assert.ok(rows.length > 0);
    assert.match(miseAJour, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuse une racine non objet, sans tableau candidats ou avec une clé de ligne absente', () => {
    assert.throws(() => checkUpstream([]), UpstreamShapeError);
    assert.throws(() => checkUpstream(null), UpstreamShapeError);
    assert.throws(() => checkUpstream({ mise_a_jour: '2026-10-28' }), /candidats/);
    for (const cle of ['id', 'nom', 'parti', 'bloc', 'statut', 'statut_detail', 'source', 'propositions', 'liens', 'verifie_le']) {
      const j = clone(brut) as { candidats: Record<string, unknown>[] };
      delete j.candidats[0]?.[cle];
      assert.throws(() => checkUpstream(j), new RegExp(cle), `clé ${cle}`);
    }
  });

  it('refuse un id en double, une URL non https, un statut ou une date inconnus', () => {
    const doublon = clone(brut) as { candidats: { id: string }[] };
    (doublon.candidats[1] as { id: string }).id = (doublon.candidats[0] as { id: string }).id;
    assert.throws(() => checkUpstream(doublon), /double/);
    const http = clone(brut) as { candidats: { source: { url: string } }[] };
    (http.candidats[0] as { source: { url: string } }).source.url = 'http://exemple.fr/a';
    assert.throws(() => checkUpstream(http), /https/);
    const js = clone(brut) as { candidats: { liens: Record<string, string> }[] };
    (js.candidats[0] as { liens: Record<string, string> }).liens.x = 'javascript:alert(1)';
    assert.throws(() => checkUpstream(js), /https/);
    const statut = clone(brut) as { candidats: { statut: string }[] };
    (statut.candidats[0] as { statut: string }).statut = 'elu';
    assert.throws(() => checkUpstream(statut), /statut/);
    const date = clone(brut) as { candidats: { verifie_le: string }[] };
    (date.candidats[0] as { verifie_le: string }).verifie_le = '2026-02-31';
    assert.throws(() => checkUpstream(date), /verifie_le/);
  });

  it('signale les clés inconnues sans échouer', () => {
    const j = clone(brut) as Record<string, unknown> & { candidats: Record<string, unknown>[] };
    j.extra = 1;
    (j.candidats[0] as Record<string, unknown>).nouveau = 'x';
    const res = checkUpstream(j);
    assert.equal(res.avertissements.length, 2);
    assert.match(res.avertissements.join('\n'), /extra/);
    assert.match(res.avertissements.join('\n'), /nouveau/);
  });
});

describe('mapRow', () => {
  const villepin = rows.find((r) => r.id === 'villepin') as UpstreamRow;

  it('Villepin : ordre des clés, id et nom_tri de la table', () => {
    const f = mapRow(villepin, corr);
    assert.deepEqual(Object.keys(f).filter((k) => ['version_schema', 'id', 'prenom', 'nom', 'nom_tri', 'parti'].includes(k)), ['version_schema', 'id', 'prenom', 'nom', 'nom_tri', 'parti']);
    assert.ok(Object.keys(f).indexOf('ids_externes') < Object.keys(f).indexOf('statuts'));
    assert.equal(f.id, 'dominique-de-villepin');
    assert.equal(f.nom_tri, 'Villepin');
    assert.deepEqual(f.ids_externes, { '2027etmoi': 'villepin' });
  });

  it('jamais bloc, propositions ni statut_detail, sur toutes les lignes', () => {
    for (const r of rows) {
      const texte = JSON.stringify(mapRow(r, corr));
      for (const interdit of ['"bloc"', '"propositions"', '"statut_detail"']) assert.ok(!texte.includes(interdit), `${r.id} : ${interdit}`);
    }
  });

  it('parti : page du parti, à défaut site de campagne, sinon null sans parti_source', () => {
    let nuls = 0;
    for (const r of rows) {
      const f = mapRow(r, corr);
      const url = r.liens.parti ?? r.liens.campagne;
      if (url === undefined) {
        nuls += 1;
        assert.equal(f.parti, null, r.id);
        assert.ok(!('parti_source' in f), r.id);
      } else {
        assert.equal(f.parti, r.parti);
        assert.deepEqual(f.parti_source, { type: r.liens.parti !== undefined ? 'parti' : 'candidat', url, date_consultation: r.verifie_le });
      }
    }
    assert.equal(nuls, rows.filter((r) => r.liens.parti === undefined && r.liens.campagne === undefined).length);
    assert.ok(nuls > 0);
  });

  it('statuts[0] : code, motif (renonce seulement), date, source typée, brouillon', () => {
    for (const r of rows) {
      const f = mapRow(r, corr);
      const s = (f.statuts as Record<string, unknown>[])[0] as Record<string, unknown>;
      assert.equal(s.code, r.statut);
      assert.equal('motif' in s, r.statut === 'renonce', r.id);
      assert.equal(s.date, r.source.date);
      assert.equal(s.statut_relecture, 'brouillon');
      const src = s.source as Record<string, unknown>;
      assert.equal(src.url, r.source.url);
      assert.equal(src.date_publication, r.source.date);
      assert.equal(src.date_consultation, r.verifie_le);
      assert.equal('titre' in src, r.source.titre !== '');
      assert.equal(f.site_officiel, r.liens.campagne);
    }
  });

  it('id absent de la table : UnknownUpstreamIdsError', () => {
    assert.throws(
      () => mapRow({ ...villepin, id: 'inconnu-x' }, corr),
      (err: unknown) => err instanceof UnknownUpstreamIdsError && err.ids.join() === 'inconnu-x',
    );
  });

  it('chaque fiche mappée est valide pour le schéma candidat', () => {
    for (const r of rows) assert.deepEqual(valide(mapRow(r, corr)), [], r.id);
  });
});

describe('renderYaml', () => {
  it('aller-retour sans perte, dates non guillemetées, aucun commentaire', () => {
    for (const r of rows) {
      const f = mapRow(r, corr);
      const texte = renderYaml(f);
      assert.deepEqual(parse(texte, { schema: 'core' }), f);
      assert.ok(!texte.includes('#'), `${r.id} : commentaire`);
      assert.match(texte, new RegExp(`^ {2}- code: ${r.statut}\\n(?: {4}motif: \\w+\\n)? {4}date: ${r.source.date}\\n`, 'm'));
    }
  });
});

describe('mergeFiche', () => {
  const base = mapRow(rows.find((r) => r.id === 'brun') as UpstreamRow, corr);
  const avec = (statuts: Record<string, unknown>[]) => ({ ...clone(base), statuts });
  const dernier = (base.statuts as Record<string, unknown>[])[0] as Record<string, unknown>;

  it('absent : cree ; identique : inchange', () => {
    const c = mergeFiche(undefined, base);
    assert.ok('action' in c && c.action === 'cree');
    const i = mergeFiche(clone(base), clone(base));
    assert.ok('action' in i && i.action === 'inchange' && i.notes.length === 0);
  });

  it('(code, motif) différent et date >= : statut ajouté en dernier, anciens intacts', () => {
    const existant = avec([{ ...clone(dernier), statut_relecture: 'relu', relecteur: 'Erwan', date_relecture: '2026-11-01' }]);
    const amont = avec([{ ...clone(dernier), code: 'declare', date: '2026-11-02' }]);
    delete (amont.statuts[0] as Record<string, unknown>).motif;
    const r = mergeFiche(existant, amont);
    assert.ok('action' in r);
    assert.equal(r.action, 'statut_ajoute');
    const st = r.fiche.statuts as Record<string, unknown>[];
    assert.equal(st.length, 2);
    assert.deepEqual(st[0], existant.statuts[0]);
    assert.equal(st[1]?.code, 'declare');
    assert.equal(st[1]?.statut_relecture, 'brouillon');
  });

  it('même statut, source ou date différente : inchange avec la note « source amont modifiée »', () => {
    const amont = avec([{ ...clone(dernier), date: '2026-09-17' }]);
    const r = mergeFiche(clone(base), amont);
    assert.ok('action' in r && r.action === 'inchange');
    assert.match(r.notes.join('|'), /source amont modifiée/);
  });

  it('changement de statut avec une date qui recule : conflit', () => {
    const amont = avec([{ ...clone(dernier), code: 'declare', date: '2026-01-01' }]);
    delete (amont.statuts[0] as Record<string, unknown>).motif;
    const r = mergeFiche(clone(base), amont);
    assert.ok('conflit' in r);
    assert.match(r.conflit, /régression de date/);
  });

  it('une date partielle compte comme le premier du mois', () => {
    assert.equal(dateComparable('2026-07'), '2026-07-01');
    const existant = avec([{ ...clone(dernier), date: '2026-07' }]);
    const amont = avec([{ ...clone(dernier), code: 'declare', date: '2026-07-01' }]);
    delete (amont.statuts[0] as Record<string, unknown>).motif;
    const r = mergeFiche(existant, amont);
    assert.ok('action' in r && r.action === 'statut_ajoute');
  });

  it('parti ou site amont différent : note, jamais appliqué', () => {
    const existant = { ...clone(base), parti: 'Autre', site_officiel: 'https://ancien.example/' };
    const amont = { ...clone(base), parti: 'Nouveau', site_officiel: 'https://nouveau.example/' };
    const r = mergeFiche(existant, amont);
    assert.ok('action' in r && r.action === 'inchange');
    assert.equal(r.notes.length, 2);
    assert.equal(r.fiche.parti, 'Autre');
  });
});

describe('snapshotName et lireCorrespondances', () => {
  it('snapshotName : date + 12 premiers caractères du sha256', () => {
    assert.equal(snapshotName('2026-10-28', 'a'.repeat(64)), '2027etmoi-candidats-2026-10-28-aaaaaaaaaaaa.json');
    assert.throws(() => snapshotName('2026-10', 'a'.repeat(64)), UpstreamShapeError);
    assert.throws(() => snapshotName('2026-10-28', 'xyz'), UpstreamShapeError);
  });

  it('la table committée couvre toutes les lignes ; motif exactement pour les renonce', () => {
    assert.equal(Object.keys(corr).length, rows.length);
    for (const r of rows) {
      const c = corr[r.id] as Correspondance;
      assert.equal(c.motif !== undefined, r.statut === 'renonce', r.id);
    }
    assert.equal(corr['poutou']?.motif, 'non_candidat');
    assert.equal(corr['knafo']?.motif, 'non_candidat');
    assert.equal(corr['brun']?.motif, 'elimine_primaire');
  });

  it('refuse un id de candidat invalide ou en double', () => {
    const entree = { prenom: 'A', nom: 'B', nom_tri: 'B', type_source_statut: 'presse' };
    assert.throws(() => lireCorrespondances({ version: 1, correspondances: { x: { ...entree, id: 'faure' } } }), /identifiant de candidat valide/);
    assert.throws(
      () => lireCorrespondances({ version: 1, correspondances: { x: { ...entree, id: 'a-b' }, y: { ...entree, id: 'a-b' } } }),
      /double/,
    );
  });
});

describe('WR-07 : ajouterStatutYaml conserve commentaires et mise en forme', () => {
  const texte = [
    '# Fiche relue à la main — ne pas réordonner',
    'version_schema: 1',
    'id: brun   # identifiant stable',
    'statuts:',
    '  # historique, du plus ancien au plus récent',
    '  - code: declare   # déclaré',
    '    date: 2026-03-15',
    '    statut_relecture: relu',
    'parti: null',
    '',
  ].join('\n');

  it('ajoute le statut en dernier sans perdre un seul commentaire', () => {
    const sortie = ajouterStatutYaml(texte, { code: 'renonce', date: '2026-10-01', statut_relecture: 'brouillon' });
    for (const c of ['# Fiche relue à la main — ne pas réordonner', '# identifiant stable', '# historique, du plus ancien au plus récent', '# déclaré']) {
      assert.ok(sortie.includes(c), c);
    }
    assert.ok(sortie.indexOf('version_schema') < sortie.indexOf('statuts:') && sortie.indexOf('statuts:') < sortie.indexOf('parti: null'));
    assert.match(sortie, /- code: renonce\n\s+date: 2026-10-01\n/);
    assert.match(sortie, /date: 2026-03-15\n/, 'date existante non guillemetée');
  });

  it('refuse un texte sans séquence statuts', () => {
    assert.throws(() => ajouterStatutYaml('id: x\n', { code: 'declare' }), /statuts/);
  });
});

describe('WR-09 : statut courant et régression de date', () => {
  const base = mapRow(rows.find((r) => r.id === 'brun') as UpstreamRow, corr);
  const st = (code: string, date: string): Record<string, unknown> => ({ ...clone((base.statuts as Record<string, unknown>[])[0] as Record<string, unknown>), code, date });

  it('statuts[] dans le désordre : le plus récent par date sert de référence, pas le dernier de la liste', () => {
    const amont = { ...clone(base), statuts: [st('declare', '2026-09-10')] };
    delete (amont.statuts[0] as Record<string, unknown>).motif;
    // le dernier de la liste est le plus ancien (renonce du 2026-01-05) ; le courant est declare du 2026-09-10
    const existant = { ...clone(base), statuts: [st('declare', '2026-09-10'), st('renonce', '2026-01-05')] };
    delete (existant.statuts[0] as Record<string, unknown>).motif;
    delete (existant.statuts[1] as Record<string, unknown>).motif;
    const r = mergeFiche(existant, amont);
    assert.ok('action' in r && r.action === 'inchange', JSON.stringify(r));
  });

  it('une date partielle amont ne crée pas de régression dans le même mois', () => {
    assert.equal(dateAvant('2026-03', '2026-03-15'), false);
    assert.equal(dateAvant('2026-02', '2026-03-15'), true);
    assert.equal(dateAvant('2026-03-14', '2026-03-15'), true);
    const existant = { ...clone(base), statuts: [st('declare', '2026-03-15')] };
    delete (existant.statuts[0] as Record<string, unknown>).motif;
    const amont = { ...clone(base), statuts: [st('renonce', '2026-03')] };
    const r = mergeFiche(existant, amont);
    assert.ok('action' in r && r.action === 'statut_ajoute', JSON.stringify(r));
  });
});
