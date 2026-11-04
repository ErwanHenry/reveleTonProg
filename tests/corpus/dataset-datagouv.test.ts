// Lecteur strict de data/dataset-datagouv.yaml : les comptes (59 lignes, par statut) sont calculés
// depuis l'instantané haché, jamais saisis ; l'annonce (51) est un fait de la description du jeu.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecartAnnonce, loadDatasetDatagouv } from '../../src/lib/dataset-datagouv.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAP = '2027etmoi-candidats-2026-10-28-9f2fbc7930c0';
const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

const BASE: Record<string, string> = {
  page: 'https://www.data.gouv.fr/datasets/exemple',
  producteur: '2027 et moi (https://2027etmoi.fr)',
  licence: 'Licence Ouverte 2.0',
  annonce: '51',
  description_consultee_le: '2026-11-03',
  instantane: `data/import/${SNAP}.json`,
};

function yml(surcharge: Record<string, string | null> = {}): string {
  return (
    Object.entries({ ...BASE, ...surcharge })
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') + '\n'
  );
}

/** Projet temporaire avec le vrai instantané + sa méta (modifiables), et un YAML donné. */
function projet(contenu: string, opts: { sansSnapshot?: boolean; meta?: (m: Record<string, unknown>) => void; json?: (t: string) => string } = {}): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-dsg-'));
  dossiers.push(dir);
  mkdirSync(path.join(dir, 'data', 'import'), { recursive: true });
  writeFileSync(path.join(dir, 'data', 'dataset-datagouv.yaml'), contenu);
  if (!opts.sansSnapshot) {
    const src = path.join(REPO, 'data', 'import', SNAP);
    const json = readFileSync(`${src}.json`, 'utf8');
    writeFileSync(path.join(dir, 'data', 'import', `${SNAP}.json`), opts.json ? opts.json(json) : json);
    const meta = JSON.parse(readFileSync(`${src}.meta.json`, 'utf8')) as Record<string, unknown>;
    opts.meta?.(meta);
    writeFileSync(path.join(dir, 'data', 'import', `${SNAP}.meta.json`), JSON.stringify(meta));
  }
  return dir;
}

const echoue = (dir: string, motif: RegExp): void =>
  assert.throws(() => loadDatasetDatagouv(dir), (e: Error) => e.message.includes('data/dataset-datagouv.yaml') && motif.test(e.message));

describe('loadDatasetDatagouv', () => {
  it('le fichier du dépôt : 51 annoncés, 59 lignes calculées, 37/17/5', () => {
    const d = loadDatasetDatagouv(REPO);
    assert.equal(d.annonce, 51);
    assert.equal(d.instantane.total, 59);
    assert.deepEqual(d.instantane.parStatut, { declare: 37, renonce: 17, pressenti: 5 });
    assert.equal(d.instantane.miseAJour, '2026-10-28');
    assert.equal(d.licence, 'Licence Ouverte 2.0');
    assert.match(d.producteur, /2027 et moi/);
    assert.match(d.page, /^https:\/\/www\.data\.gouv\.fr\//);
  });

  it("ecartAnnonce (WR-07) : un écart seulement si l'annonce diffère du total de l'instantané", () => {
    assert.equal(ecartAnnonce(loadDatasetDatagouv(REPO)), true);
    const instantane = { chemin: 'x', miseAJour: '2026-10-28', total: 59, parStatut: {} };
    assert.equal(ecartAnnonce({ annonce: 59, instantane }), false);
    assert.equal(ecartAnnonce({ annonce: 60, instantane }), true);
  });

  it('un projet cohérent se charge', () => {
    assert.equal(loadDatasetDatagouv(projet(yml())).instantane.total, 59);
  });

  it('chemin d\'instantané hors de data/import/', () => {
    echoue(projet(yml({ instantane: '../secret.json' })), /data\/import/);
    echoue(projet(yml({ instantane: 'data/autre/x.json' })), /data\/import/);
  });

  it('instantané absent', () => {
    echoue(projet(yml(), { sansSnapshot: true }), /introuvable|absent/);
  });

  it('SHA-256 différent de la méta', () => {
    echoue(projet(yml(), { meta: (m) => { m.sha256 = '0'.repeat(64); } }), /sha-?256/i);
    echoue(projet(yml(), { json: (t) => t.replace('"mise_a_jour"', '"mise_a_jour" ') }), /sha-?256/i);
  });

  it('forme amont invalide (checkUpstream)', () => {
    const dir = projet(yml(), { json: () => '{"mise_a_jour":"2026-10-28","candidats":"non"}', meta: () => undefined });
    // la méta doit porter le hachage du contenu modifié pour atteindre checkUpstream
    const fichier = path.join(dir, 'data', 'import', `${SNAP}.json`);
    const meta = path.join(dir, 'data', 'import', `${SNAP}.meta.json`);
    const m = JSON.parse(readFileSync(meta, 'utf8')) as Record<string, unknown>;
    m.sha256 = createHash('sha256').update(readFileSync(fichier)).digest('hex');
    writeFileSync(meta, JSON.stringify(m));
    echoue(dir, /candidats|tableau/);
  });

  it('clé inconnue, alias, annonce invalide, page non https, date irréelle', () => {
    echoue(projet(yml() + 'extra: 1\n'), /clé inconnue/);
    echoue(projet(yml() + 'ancre: &a 1\nautre: *a\n'), /alias|clé inconnue/);
    echoue(projet(yml({ annonce: '0' })), /annonce/);
    echoue(projet(yml({ annonce: '5.5' })), /annonce/);
    echoue(projet(yml({ annonce: 'beaucoup' })), /annonce/);
    echoue(projet(yml({ page: 'http://www.data.gouv.fr/x' })), /page/);
    echoue(projet(yml({ description_consultee_le: '2026-02-31' })), /description_consultee_le/);
    echoue(projet(yml({ description_consultee_le: 'hier' })), /description_consultee_le/);
  });

  it('fichier absent', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-dsg-'));
    dossiers.push(dir);
    echoue(dir, /introuvable/);
  });
});
