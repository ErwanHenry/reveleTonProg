// WR-11 (revue de la phase 10) : un test d'import ne fabrique jamais un fait sur une personne réelle. Le dépôt est
// public : un test qui fait passer une ligne réelle du jeu amont à « renonce », qui la retire du jeu, ou qui sert de
// modèle à un changement de statut inventé, laisse dans le dépôt un texte qui attribue un fait faux à une personne.
// Les tests de changement de statut utilisent une personne fictive (`essai-fictif`, adresses exemple.test).
//
// Ce test lit les clés amont et les identifiants réels de data/import/correspondances.yaml, puis refuse dans
// tests/**/*.ts les trois formes par lesquelles un test choisit une ligne réelle pour la modifier :
//   - `ajouterMotif(racine, '<clé réelle>', …)` (motif de renoncement ajouté à une personne réelle) ;
//   - `x.id === '<clé réelle>'` ou `x.id !== '<clé réelle>'` (rappel de `muter`, qui modifie ou retire la ligne) ;
//   - `mapRow(rows.find((r) => r.id === '<clé réelle>')` (fiche réelle prise comme base de statuts inventés).
// Lire une ligne réelle sans rien affirmer de faux reste permis (contrôle du mapping, octets des 59 fiches réelles).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const FORMES: readonly RegExp[] = [
  /ajouterMotif\([^,()]+,\s*['"]([^'"]+)['"]/g,
  /\bx\.id\s*[!=]==\s*['"]([^'"]+)['"]/g,
  /mapRow\(\s*rows\.find\(\s*\(r\)\s*=>\s*r\.id\s*===\s*['"]([^'"]+)['"]/g,
];

function personnesReelles(): Set<string> {
  const t = parse(fs.readFileSync(path.join(REPO, 'data', 'import', 'correspondances.yaml'), 'utf8')) as {
    correspondances: Record<string, { id: string }>;
  };
  const out = new Set<string>();
  for (const [cle, c] of Object.entries(t.correspondances)) {
    out.add(cle);
    out.add(c.id);
  }
  return out;
}

/** Lignes `fichier:ligne : clé` où un test choisit une personne réelle pour la modifier. */
export function choixDePersonnesReelles(texte: string, reelles: ReadonlySet<string>, fichier = 'texte'): string[] {
  const out: string[] = [];
  for (const forme of FORMES) {
    for (const m of texte.matchAll(forme)) {
      const cle = m[1] as string;
      if (!reelles.has(cle)) continue;
      const ligne = texte.slice(0, m.index).split('\n').length;
      out.push(`${fichier}:${ligne} : ${cle}`);
    }
  }
  return out.sort();
}

function fichiersDeTest(dossier: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'fixtures' && e.name !== 'node_modules') out.push(...fichiersDeTest(p));
    } else if (/\.(ts|mts|cts|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('WR-11 : aucun test d’import ne modifie une personne réelle', () => {
  const reelles = personnesReelles();

  it('auto-contrôle : les trois formes sont vues pour une clé réelle, jamais pour la personne fictive', () => {
    const [cle] = [...reelles];
    assert.ok(cle);
    const echantillon = [
      `ajouterMotif(root, '${cle}', 'retrait');`,
      `const r = j.candidats.find((x) => x.id === '${cle}');`,
      `j.candidats = j.candidats.filter((x) => x.id !== "${cle}");`,
      `const base = mapRow(rows.find((r) => r.id === '${cle}') as UpstreamRow, corr);`,
    ].join('\n');
    assert.equal(choixDePersonnesReelles(echantillon, reelles).length, 4);
    const fictif = ["ajouterMotif(root, 'essai-fictif', 'retrait');", "j.candidats.find((x) => x.id === 'essai-fictif');"].join('\n');
    assert.deepEqual(choixDePersonnesReelles(fictif, reelles), []);
    // lire une ligne réelle pour contrôler le mapping reste permis
    assert.deepEqual(choixDePersonnesReelles(`const v = rows.find((r) => r.id === '${cle}') as UpstreamRow;`, reelles), []);
  });

  it('tests/** : aucune personne réelle choisie pour un changement de statut ou un retrait inventé', () => {
    const trouves: string[] = [];
    for (const f of fichiersDeTest(path.join(REPO, 'tests'))) {
      trouves.push(...choixDePersonnesReelles(fs.readFileSync(f, 'utf8'), reelles, path.relative(REPO, f).split(path.sep).join('/')));
    }
    assert.deepEqual(trouves, []);
  });
});
