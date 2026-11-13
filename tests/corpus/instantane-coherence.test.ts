// IMP-02 / D-04 : l'instantané data.gouv versionné, la table de correspondances et les fichiers
// candidats doivent dire la même chose sur ce que l'import possède (identifiants, ids_externes,
// couple (code, motif) du statut le plus récent, pointeur de data/dataset-datagouv.yaml).
// Cas synthétiques sur objets en mémoire, cas de chargeur sur racines temporaires, puis le vrai dépôt
// (lu, jamais écrit).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Correspondance, UpstreamRow } from '../../scripts/lib/datagouv.ts';
import { comparerInstantane, formaterEcart } from '../../scripts/lib/instantane.ts';
import type { EtatInstantane } from '../../scripts/lib/instantane.ts';
import { chargerEtatDepot } from '../../scripts/lib/instantane-depot.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const temporaires: string[] = [];
after(() => {
  for (const d of temporaires) rmSync(d, { recursive: true, force: true });
});

// ---------- cas synthétiques ----------

function ligne(id: string, statut = 'declare', date = '2026-10-01', url = 'https://exemple.test/a'): UpstreamRow {
  return { id, nom: id, parti: '', statut, source: { titre: 'Titre', url, date }, liens: {}, verifie_le: '2026-11-09' };
}

function entree(id: string, motif?: Correspondance['motif']): Correspondance {
  const e: Correspondance = { id, prenom: 'Prénom', nom: 'Nom', nom_tri: 'Nom', type_source_statut: 'presse' };
  if (motif !== undefined) e.motif = motif;
  return e;
}

function fiche(id: string, cle: string | null, code = 'declare', date = '2026-10-01', url = 'https://exemple.test/a', motif?: string): Record<string, unknown> {
  const statut: Record<string, unknown> = { code };
  if (motif !== undefined) statut.motif = motif;
  statut.date = date;
  statut.source = { type: 'presse', url };
  const f: Record<string, unknown> = { id, statuts: [statut] };
  if (cle !== null) f.ids_externes = { '2027etmoi': cle };
  return f;
}

const SNAP = { chemin: 'data/import/s-2026-10-28.json', miseAJour: '2026-10-28', fetchedAt: '2026-11-03T17:22:47+01:00' };

function base(): EtatInstantane {
  return {
    rows: [ligne('a'), ligne('b', 'renonce')],
    table: { a: entree('alice-test'), b: entree('bob-test', 'retrait') },
    fiches: new Map([
      ['alice-test', fiche('alice-test', 'a')],
      ['bob-test', fiche('bob-test', 'b', 'renonce', '2026-10-01', 'https://exemple.test/a', 'retrait')],
    ]),
    pointeur: SNAP.chemin,
    instantanes: [SNAP],
  };
}

function champs(r: { erreurs: { champ: string }[]; infos: { champ: string }[] }): { e: string[]; i: string[] } {
  return { e: r.erreurs.map((x) => x.champ), i: r.infos.map((x) => x.champ) };
}

describe('comparerInstantane : cas synthétiques (D-04)', () => {
  it('cohérent : 0 erreur, 0 information', () => {
    assert.deepEqual(comparerInstantane(base()), { erreurs: [], infos: [] });
  });

  it('E1 table : une ligne amont absente de la table', () => {
    const etat = base();
    etat.rows.push(ligne('c'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['table'], i: [] });
    assert.equal(r.erreurs[0]?.id, 'c');
  });

  it('E2 fiche : une ligne amont dont la table désigne un id sans fichier candidat', () => {
    const etat = base();
    etat.fiches.delete('bob-test');
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['fiche'], i: [] });
    assert.equal(r.erreurs[0]?.id, 'bob-test');
  });

  it('E3 ids_externes : un fichier dont la clé amont n’est pas dans la table', () => {
    const etat = base();
    etat.fiches.set('alice-test', fiche('alice-test', 'inconnu'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['ids_externes'], i: [] });
    assert.equal(r.erreurs[0]?.id, 'alice-test');
  });

  it('E3 ids_externes : un fichier dont la table renvoie vers un autre identifiant', () => {
    const etat = base();
    etat.fiches.set('alice-test', fiche('alice-test', 'b'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r).e, ['ids_externes']);
  });

  it('E4 statut : code différent du statut amont', () => {
    const etat = base();
    etat.fiches.set('alice-test', fiche('alice-test', 'a', 'pressenti'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['statut'], i: [] });
    assert.equal(formaterEcart(r.erreurs[0]!), 'alice-test : statut : fichier=pressenti amont=declare');
  });

  it('E4 statut : motif différent pour un renoncement', () => {
    const etat = base();
    etat.fiches.set('bob-test', fiche('bob-test', 'b', 'renonce', '2026-10-01', 'https://exemple.test/a', 'ralliement'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r).e, ['statut']);
    assert.match(formaterEcart(r.erreurs[0]!), /fichier=renonce\/ralliement amont=renonce\/retrait/);
  });

  it('E4 statut : le statut le plus récent du fichier compte, pas le premier', () => {
    const etat = base();
    const f = fiche('alice-test', 'a', 'pressenti', '2026-09-01');
    (f.statuts as unknown[]).push({ code: 'declare', date: '2026-10-01', source: { type: 'presse', url: 'https://exemple.test/a' } });
    etat.fiches.set('alice-test', f);
    assert.deepEqual(comparerInstantane(etat), { erreurs: [], infos: [] });
  });

  it('E5 date : même statut, date du fichier strictement postérieure à l’amont', () => {
    const etat = base();
    etat.fiches.set('alice-test', fiche('alice-test', 'a', 'declare', '2026-10-15'));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['date'], i: [] });
  });

  it('E5 date : une date mensuelle contre une date complète ne se compare qu’au mois', () => {
    const etat = base();
    etat.rows[0] = ligne('a', 'declare', '2026-10');
    etat.fiches.set('alice-test', fiche('alice-test', 'a', 'declare', '2026-10-20'));
    assert.deepEqual(comparerInstantane(etat), { erreurs: [], infos: [] });
  });

  it('WR-01 : même définition du plus récent que la règle d’équité (une date au mois vient avant le premier du mois)', () => {
    const etat = base();
    const f = fiche('alice-test', 'a', 'pressenti', '2026-10-01');
    (f.statuts as unknown[]).push({ code: 'declare', date: '2026-10', source: { type: 'presse', url: 'https://exemple.test/a' } });
    etat.fiches.set('alice-test', f);
    // equite.statutLePlusRecent retient pressenti (2026-10-01 vient après 2026-10) : la cohérence doit dire pareil
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r).e, ['statut']);
    assert.equal(formaterEcart(r.erreurs[0]!), 'alice-test : statut : fichier=pressenti amont=declare');
  });

  it('E6 instantane : le pointeur ne désigne pas le plus récent (import sans mise à jour du pointeur)', () => {
    const etat = base();
    etat.instantanes = [SNAP, { chemin: 'data/import/s-2026-11-09.json', miseAJour: '2026-11-09', fetchedAt: '2026-11-12T10:00:00+01:00' }];
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: ['instantane'], i: [] });
    assert.match(formaterEcart(r.erreurs[0]!), /fichier=data\/import\/s-2026-10-28\.json amont=data\/import\/s-2026-11-09\.json/);
  });

  it('E6 instantane : à mise_a_jour égale, le fetched_at le plus récent gagne', () => {
    const etat = base();
    etat.instantanes = [SNAP, { chemin: 'data/import/s-bis.json', miseAJour: '2026-10-28', fetchedAt: '2026-11-03T18:00:00+01:00' }];
    assert.deepEqual(champs(comparerInstantane(etat)).e, ['instantane']);
  });

  it('I1 source : même statut, URL de source différente, information seulement', () => {
    const etat = base();
    etat.rows[0] = ligne('a', 'declare', '2026-10-01', 'https://exemple.test/nouvelle');
    assert.deepEqual(champs(comparerInstantane(etat)), { e: [], i: ['source'] });
  });

  it('I1 source : même statut, date du fichier antérieure à l’amont, information seulement', () => {
    const etat = base();
    etat.rows[0] = ligne('a', 'declare', '2026-10-20');
    assert.deepEqual(champs(comparerInstantane(etat)), { e: [], i: ['source'] });
  });

  it('I2 absent en amont : une personne du dépôt absente de l’instantané n’est pas une erreur', () => {
    const etat = base();
    etat.rows = [ligne('a')];
    assert.deepEqual(champs(comparerInstantane(etat)), { e: [], i: ['absent en amont'] });
  });

  it('I3 hors import : un fichier sans ids_externes.2027etmoi', () => {
    const etat = base();
    etat.fiches.set('carole-test', fiche('carole-test', null));
    const r = comparerInstantane(etat);
    assert.deepEqual(champs(r), { e: [], i: ['hors import'] });
    assert.equal(r.infos[0]?.id, 'carole-test');
  });

  it('erreurs triées par identifiant puis par champ, une ligne par écart', () => {
    const etat = base();
    etat.rows.push(ligne('z'));
    etat.fiches.set('bob-test', fiche('bob-test', 'b', 'declare'));
    etat.fiches.set('alice-test', fiche('alice-test', 'a', 'pressenti'));
    const lignes = comparerInstantane(etat).erreurs.map(formaterEcart);
    assert.equal(lignes.length, 3);
    assert.deepEqual(lignes, [...lignes].sort());
    assert.match(lignes[0]!, /^alice-test : statut : fichier=/);
  });
});

// ---------- chargeur sur racines temporaires ----------

function copieDepot(): string {
  const racine = mkdtempSync(path.join(os.tmpdir(), 'rtp-instantane-'));
  temporaires.push(racine);
  mkdirSync(path.join(racine, 'data'), { recursive: true });
  cpSync(path.join(REPO_ROOT, 'data', 'import'), path.join(racine, 'data', 'import'), { recursive: true });
  cpSync(path.join(REPO_ROOT, 'data', 'dataset-datagouv.yaml'), path.join(racine, 'data', 'dataset-datagouv.yaml'));
  mkdirSync(path.join(racine, 'src', 'content'), { recursive: true });
  cpSync(path.join(REPO_ROOT, 'src', 'content', 'candidats'), path.join(racine, 'src', 'content', 'candidats'), { recursive: true });
  return racine;
}

describe('chargerEtatDepot : racines temporaires', () => {
  it('la copie du dépôt est cohérente', () => {
    const r = comparerInstantane(chargerEtatDepot(copieDepot()));
    assert.deepEqual(r.erreurs, []);
  });

  it('mutation : le code d’un statut le plus récent change, une ligne « statut » nomme la personne', () => {
    const racine = copieDepot();
    const dossier = path.join(racine, 'src', 'content', 'candidats');
    const fichier = readdirSync(dossier).sort().find((n) => readFileSync(path.join(dossier, n), 'utf8').includes('code: declare'));
    assert.ok(fichier, 'aucune fiche déclarée trouvée');
    const chemin = path.join(dossier, fichier);
    const texte = readFileSync(chemin, 'utf8');
    assert.ok(texte.includes('code: declare'));
    writeFileSync(chemin, texte.replace('code: declare', 'code: pressenti'));
    const id = fichier.replace(/\.yaml$/, '');
    const { erreurs } = comparerInstantane(chargerEtatDepot(racine));
    const lignes = erreurs.map(formaterEcart);
    assert.ok(lignes.some((l) => l.startsWith(`${id} : statut : fichier=pressenti amont=declare`)), lignes.join('\n'));
  });

  it('un instantané plus récent déposé sans mettre à jour le pointeur est signalé', () => {
    const racine = copieDepot();
    const dossier = path.join(racine, 'data', 'import');
    const jsonAncien = readdirSync(dossier).find((n) => /^2027etmoi-candidats-.*\.json$/.test(n) && !n.endsWith('.meta.json'));
    assert.ok(jsonAncien);
    const contenu = JSON.parse(readFileSync(path.join(dossier, jsonAncien), 'utf8')) as Record<string, unknown>;
    contenu.mise_a_jour = '2026-11-09';
    const nouveau = '2027etmoi-candidats-2026-11-09-000000000000';
    writeFileSync(path.join(dossier, `${nouveau}.json`), JSON.stringify(contenu));
    const meta = JSON.parse(readFileSync(path.join(dossier, jsonAncien.replace(/\.json$/, '.meta.json')), 'utf8')) as Record<string, unknown>;
    writeFileSync(path.join(dossier, `${nouveau}.meta.json`), JSON.stringify({ ...meta, mise_a_jour: '2026-11-09', fetched_at: '2026-11-12T10:00:00+01:00' }));
    const { erreurs } = comparerInstantane(chargerEtatDepot(racine));
    assert.deepEqual(erreurs.map((e) => e.champ), ['instantane']);
    assert.match(formaterEcart(erreurs[0]!), new RegExp(`amont=data/import/${nouveau}\\.json`));
  });

  it('une fiche au YAML refusé fait lever une erreur qui nomme le fichier (pas d’état partiel)', () => {
    const racine = copieDepot();
    const dossier = path.join(racine, 'src', 'content', 'candidats');
    const fichier = readdirSync(dossier).sort()[0]!;
    writeFileSync(path.join(dossier, fichier), 'a: &x 1\nb: *x\n');
    assert.throws(() => chargerEtatDepot(racine), (e: Error) => e.message.includes(fichier));
  });

  it('une table de correspondances au YAML refusé fait lever une erreur qui nomme le fichier', () => {
    const racine = copieDepot();
    writeFileSync(path.join(racine, 'data', 'import', 'correspondances.yaml'), 'version: 1\nversion: 2\n');
    assert.throws(() => chargerEtatDepot(racine), (e: Error) => e.message.includes('correspondances.yaml'));
  });
});

// ---------- vrai dépôt ----------

describe('dépôt réel : instantané et fichiers candidats cohérents (D-04)', () => {
  const etat = chargerEtatDepot(REPO_ROOT);
  const r = comparerInstantane(etat);

  it('0 erreur, un écart par ligne', () => {
    assert.deepEqual(r.erreurs.map(formaterEcart), []);
  });

  it('informations (dérive de source, absents en amont, hors import) : affichées, jamais bloquantes', (t) => {
    t.diagnostic(`${etat.rows.length} ligne(s) amont, ${etat.fiches.size} fiche(s), ${r.infos.length} information(s)`);
    for (const i of r.infos) t.diagnostic(`info ${formaterEcart(i)}`);
    assert.ok(true);
  });

  it('le plus récent par nom de fichier est aussi le plus récent par (mise_a_jour, fetched_at)', () => {
    const parNom = etat.instantanes.map((s) => s.chemin).sort();
    const parNomPlusRecent = parNom[parNom.length - 1];
    const parDate = [...etat.instantanes].sort((a, b) => a.miseAJour.localeCompare(b.miseAJour) || Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));
    const parDatePlusRecent = parDate[parDate.length - 1]?.chemin;
    assert.equal(parNomPlusRecent, parDatePlusRecent, `deux définitions du plus récent divergent : par nom ${parNomPlusRecent}, par date ${parDatePlusRecent}`);
    assert.equal(etat.pointeur, parDatePlusRecent);
  });
});
