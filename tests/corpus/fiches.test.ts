// Contrôle du vrai corpus (racine du dépôt) : une fiche valide par ligne de l'instantané data.gouv.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { statutLePlusRecent } from '../../src/lib/content-core/rules/equite.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';
import { instantanePlusRecent } from '../../scripts/lib/instantane-depot.ts';

const IMPORT_DIR = path.join(REPO_ROOT, 'data', 'import');
const CANDIDATS_DIR = path.join(REPO_ROOT, 'src', 'content', 'candidats');
const INTERDITS = new Set(['bloc', 'propositions', 'statut_detail', 'extdroite']);

/** Instantané le plus récent par (mise_a_jour, fetched_at), le même ordre que le contrôle E6 (WR-04 : jamais par nom). */
function newestSnapshot(): string {
  return instantanePlusRecent(REPO_ROOT);
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

  it('chaque statut le plus récent « renonce » porte un motif', () => {
    for (const f of fiches) {
      // Statut le plus récent par date (W5), comme le périmètre d'équité, pas le dernier de la liste.
      const dernier = statutLePlusRecent(f.statuts);
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

  it('ATTRIBUTION.md : producteur, licence, URL du jeu et date de mise à jour du dernier instantané', () => {
    const texte = readFileSync(path.join(IMPORT_DIR, 'ATTRIBUTION.md'), 'utf8');
    const meta = JSON.parse(readFileSync(newestSnapshot().replace(/\.json$/, '.meta.json'), 'utf8')) as { mise_a_jour: string };
    const [a, m, j] = meta.mise_a_jour.split('-');
    assert.ok(texte.includes('2027 et moi'));
    assert.ok(texte.includes('Licence Ouverte 2.0'));
    assert.ok(texte.includes('https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources'));
    assert.ok(texte.includes(`${j}/${m}/${a}`), `date ${j}/${m}/${a} absente`);
    const licence = readFileSync(path.join(REPO_ROOT, 'LICENSE'), 'utf8');
    assert.ok(licence.includes('ATTRIBUTION.md'));
    assert.ok(licence.includes(`${j}/${m}/${a}`));
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
