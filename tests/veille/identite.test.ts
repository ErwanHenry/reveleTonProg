import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lireYamlPlafonne } from '../../src/lib/content-core/yaml-plafonne.ts';
import { lireCorrespondances } from '../../scripts/lib/datagouv.ts';
import { deriverIdentite, idsPris, slug } from '../../scripts/lib/veille/identite.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vide = new Set<string>();

test('slug', () => {
  assert.equal(slug('Ségolène Royal'), 'segolene-royal');
  assert.equal(slug("d'Ornano"), 'd-ornano');
  assert.equal(slug('Le Maire'), 'le-maire');
  assert.equal(slug('d’Ornano'), 'd-ornano');
});

test('Villepin : particule gardée dans nom, retirée de nom_tri', () => {
  assert.deepEqual(deriverIdentite({ id: 'villepin', nom: 'Dominique de Villepin' }, vide), {
    id: 'dominique-de-villepin',
    prenom: 'Dominique',
    nom: 'de Villepin',
    nom_tri: 'Villepin',
  });
});

test('Le Maire : majuscule, mot du nom', () => {
  const r = deriverIdentite({ id: 'le-maire', nom: 'Bruno Le Maire' }, vide);
  assert.deepEqual(r, { id: 'bruno-le-maire', prenom: 'Bruno', nom: 'Le Maire', nom_tri: 'Le Maire' });
});

test('noms et prénoms composés, accents conservés', () => {
  assert.deepEqual(deriverIdentite({ id: 'melenchon', nom: 'Jean-Luc Mélenchon' }, vide), {
    id: 'jean-luc-melenchon',
    prenom: 'Jean-Luc',
    nom: 'Mélenchon',
    nom_tri: 'Mélenchon',
  });
  assert.deepEqual(deriverIdentite({ id: 'lucas-lundy', nom: 'Benjamin Lucas-Lundy' }, vide), {
    id: 'benjamin-lucas-lundy',
    prenom: 'Benjamin',
    nom: 'Lucas-Lundy',
    nom_tri: 'Lucas-Lundy',
  });
});

test("particule d' collée", () => {
  assert.deepEqual(deriverIdentite({ id: 'ornano', nom: "Paul d'Ornano" }, vide), {
    id: 'paul-d-ornano',
    prenom: 'Paul',
    nom: "d'Ornano",
    nom_tri: 'Ornano',
  });
});

function refus(ligne: { id: string; nom: string }, pris: ReadonlySet<string> = vide): string {
  const r = deriverIdentite(ligne, pris);
  assert.ok('refus' in r, `refus attendu pour ${ligne.nom}`);
  assert.equal(r.refus, 'identite_ambigue');
  assert.ok(r.raison.length > 5);
  return r.raison;
}

test('refus : un seul mot', () => {
  refus({ id: 'madonna', nom: 'Madonna' });
});
test('refus : mot tout en majuscules', () => {
  refus({ id: 'dupont', nom: 'JEAN DUPONT' });
  refus({ id: 'dupont', nom: 'Jean DUPONT' });
});
test('refus : plus de 5 mots', () => {
  refus({ id: 'f', nom: 'Aa Bb Cc Dd Ee Ff' });
});
test('refus : caractère hors lettres', () => {
  refus({ id: 'dupont2', nom: 'Jean Dupont2' });
  refus({ id: 'dupont', nom: 'Jean Dupont\n' });
});
test('refus : aucun découpage', () => {
  refus({ id: 'martin', nom: 'Jean Dupont' });
});
test('particules enchaînées : un seul découpage retenu, particules gardées dans nom', () => {
  const r = deriverIdentite({ id: 'villepin', nom: 'Dominique de du Villepin' }, vide);
  assert.ok(!('refus' in r));
  assert.equal(r.nom, 'de du Villepin');
  assert.equal(r.nom_tri, 'Villepin');
});
test('refus : tiret long ou moyen', () => {
  refus({ id: 'dupont', nom: 'Jean — Dupont' });
  refus({ id: 'dupont', nom: 'Jean–Dupont' });
});
test('refus : espaces doubles', () => {
  refus({ id: 'dupont', nom: 'Jean  Dupont' });
});
test('refus : identifiant dérivé déjà pris (homonyme)', () => {
  refus({ id: 'dupont', nom: 'Jean Dupont' }, new Set(['jean-dupont']));
});

test('idsPris lit la table, ids.lock et les fiches', () => {
  const pris = idsPris(RACINE);
  assert.ok(pris.has('jean-luc-melenchon'));
  assert.ok(pris.size >= 61);
});

// Écart connu : le nom de tri de Christine Lagarde est une décision manuelle d'Erwan.
const ECARTS_CONNUS: Record<string, string[]> = { lagarde: ['nom_tri'] };

test('oracle : les règles reproduisent les lignes réelles de correspondances.yaml', () => {
  const table = lireCorrespondances(lireYamlPlafonne(readFileSync(path.join(RACINE, 'data/import/correspondances.yaml'), 'utf8'), 'correspondances.yaml'));
  const jeu = JSON.parse(readFileSync(path.join(RACINE, 'data/import/2027etmoi-candidats-2026-11-01-332914fc603e.json'), 'utf8')) as { candidats: { id: string; nom: string }[] };
  const ids = new Set(Object.values(table).map((c) => c.id));
  let conformes = 0;
  const vus = new Set<string>();
  for (const l of jeu.candidats) {
    const attendu = table[l.id];
    if (attendu === undefined) continue;
    const pris = new Set(ids);
    pris.delete(attendu.id);
    const r = deriverIdentite(l, pris);
    assert.ok(!('refus' in r), `${l.id} refusé`);
    const diff = (['id', 'prenom', 'nom', 'nom_tri'] as const).filter((c) => r[c] !== attendu[c]);
    const prevus = ECARTS_CONNUS[l.id] ?? [];
    if (prevus.length > 0) vus.add(l.id);
    assert.deepEqual(diff, prevus, `écart pour ${l.id}`);
    if (diff.length === 0) conformes += 1;
  }
  assert.deepEqual([...vus].sort(), Object.keys(ECARTS_CONNUS).sort(), 'un écart listé a disparu');
  console.log(`oracle identité : ${conformes} lignes conformes`);
  assert.ok(conformes >= 60);
});
