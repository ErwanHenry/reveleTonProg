// Contrôle du vrai corpus (racine du dépôt) : une fiche valide par ligne de l'instantané data.gouv.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const IMPORT_DIR = path.join(REPO_ROOT, 'data', 'import');
const CANDIDATS_DIR = path.join(REPO_ROOT, 'src', 'content', 'candidats');
const INTERDITS = new Set(['bloc', 'propositions', 'statut_detail', 'extdroite']);

function newestSnapshot(): string {
  const names = readdirSync(IMPORT_DIR)
    .filter((n) => /^2027etmoi-candidats-.*\.json$/.test(n) && !n.endsWith('.meta.json'))
    .sort();
  const last = names[names.length - 1];
  assert.ok(last, 'aucun instantané data/import/2027etmoi-candidats-*.json');
  return path.join(IMPORT_DIR, last);
}

type Fiche = {
  id: string;
  ids_externes?: Record<string, string>;
  statuts: { code: string; motif?: string; statut_relecture: string; relecteur?: string }[];
};

function lireFiches(): Fiche[] {
  if (!existsSync(CANDIDATS_DIR)) return [];
  return readdirSync(CANDIDATS_DIR)
    .filter((n) => n.endsWith('.yaml'))
    .sort()
    .map((n) => parse(readFileSync(path.join(CANDIDATS_DIR, n), 'utf8'), { schema: 'core' }) as Fiche);
}

function cles(o: unknown, acc: string[] = []): string[] {
  if (Array.isArray(o)) for (const x of o) cles(x, acc);
  else if (o !== null && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      acc.push(k);
      cles(v, acc);
    }
  }
  return acc;
}

/** Lecture autonome de data/couverture-themes.yaml : absent, sans bloc `pilote` ou sans clé = fermé. */
function relectureOuverte(): boolean {
  const file = path.join(REPO_ROOT, 'data', 'couverture-themes.yaml');
  if (!existsSync(file)) return false;
  const doc = parse(readFileSync(file, 'utf8'), { schema: 'core' }) as { pilote?: { relecture_ouverte?: unknown } } | null;
  return doc?.pilote?.relecture_ouverte === true;
}

describe('corpus réel : fiches candidats importées', () => {
  const snapshot = JSON.parse(readFileSync(newestSnapshot(), 'utf8')) as { candidats: { id: string }[] };
  const amont = snapshot.candidats.map((r) => r.id);
  const fiches = lireFiches();

  it('une fiche par ligne de l’instantané, ids uniques', () => {
    assert.equal(fiches.length, amont.length);
    assert.equal(new Set(fiches.map((f) => f.id)).size, fiches.length);
  });

  it('ids_externes.2027etmoi : bijection avec les ids amont', () => {
    const vus = fiches.map((f) => f.ids_externes?.['2027etmoi']);
    assert.deepEqual([...vus].sort(), [...amont].sort());
  });

  it('chaque dernier statut renonce porte un motif', () => {
    for (const f of fiches) {
      const dernier = f.statuts[f.statuts.length - 1];
      assert.ok(dernier, `${f.id} sans statut`);
      if (dernier.code === 'renonce') assert.ok(dernier.motif, `${f.id} : renonce sans motif`);
    }
  });

  it('aucune clé bloc, propositions, statut_detail, extdroite dans src/content/candidats', () => {
    for (const f of fiches) {
      const trouvees = cles(f).filter((k) => INTERDITS.has(k));
      assert.deepEqual(trouvees, [], `${f.id} : clé interdite`);
    }
  });

  it('tant que la relecture n’est pas ouverte, tout statut est brouillon sans relecteur', () => {
    if (relectureOuverte()) return;
    for (const f of fiches) {
      for (const s of f.statuts) {
        assert.equal(s.statut_relecture, 'brouillon', `${f.id} : statut non brouillon`);
        assert.equal(s.relecteur, undefined, `${f.id} : relecteur posé avant l’ouverture de la relecture`);
      }
    }
  });
});
