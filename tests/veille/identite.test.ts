import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lireYamlPlafonne } from '../../src/lib/content-core/yaml-plafonne.ts';
import { lireCorrespondances } from '../../scripts/lib/datagouv.ts';
import { deriverIdentite, idsPris, ligneCorrespondance, slug } from '../../scripts/lib/veille/identite.ts';
import { hoteSansWww, lireDomainesInstitutions, lireReglesTypeSource, memeSite, typeSourceStatut } from '../../scripts/lib/veille/type-source.ts';
import type { ReglesTypeSource } from '../../scripts/lib/veille/type-source.ts';

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
  refus({ id: 'dupont', nom: 'Jean \u2014 Dupont' });
  refus({ id: 'dupont', nom: 'Jean\u2013Dupont' });
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

const INST: ReglesTypeSource = { institutions: ['gouv.fr', 'elysee.fr'], partages: ['facebook.com', 'x.com', 'wordpress.com', 'github.io', 'linktr.ee'] };

test('hoteSansWww : nom d\'hôte complet, www. retiré', () => {
  assert.equal(hoteSansWww('https://www.lafranceinsoumise.fr/x'), 'lafranceinsoumise.fr');
  assert.equal(hoteSansWww('https://blog.melenchon2027.fr/'), 'blog.melenchon2027.fr');
  assert.equal(hoteSansWww('pas une url'), null);
  assert.equal(hoteSansWww('ftp://exemple.fr/'), null);
});

test('WR-10 : même site sur l\'hôte complet (égal ou sous-domaine), jamais sur les deux derniers labels', () => {
  const P = INST.partages;
  assert.ok(memeSite('https://blog.parti.fr/a', 'https://www.parti.fr/', P), 'sous-domaine du lien');
  assert.ok(!memeSite('https://parti.fr/a', 'https://adherer.parti.fr/', P), 'le lien sous-domaine ne couvre pas le domaine parent');
  assert.ok(!memeSite('https://autre-parti.fr/a', 'https://parti.fr/', P), 'suffixe non aligné sur un label');
  assert.ok(!memeSite('https://ministere.gouv.fr/a', 'https://parti.gouv.fr/', P), 'deux derniers labels partagés');
  assert.ok(!memeSite('https://exemple.co.uk/a', 'https://parti.co.uk/', P), 'suffixe à deux niveaux');
  assert.ok(!memeSite('https://www.facebook.com/un-tiers', 'https://www.facebook.com/jeanne2027', P), 'réseau social partagé');
  assert.ok(!memeSite('https://tiers.wordpress.com/a', 'https://jeanne.wordpress.com/', P), 'hébergeur de pages');
  assert.ok(!memeSite('https://jeanne.wordpress.com/annonce', 'https://jeanne.wordpress.com/', P), 'même hébergé : jamais candidat');
  assert.ok(!memeSite('https://linktr.ee/x', 'https://linktr.ee/jeanne', P), 'raccourcisseur');
  assert.equal(typeSourceStatut({ source: { url: 'https://x.com/tiers/status/1' }, liens: { campagne: 'https://x.com/jeanne2027' } }, INST), 'presse');
  assert.equal(typeSourceStatut({ source: { url: 'https://moi.github.io/annonce' }, liens: { parti: 'https://parti.github.io/' } }, INST), 'presse');
});

test('typeSourceStatut : candidat, parti, institution, presse', () => {
  const liens = { campagne: 'https://melenchon2027.fr/', parti: 'https://parti.fr/' };
  assert.equal(typeSourceStatut({ source: { url: 'https://melenchon2027.fr/annonce' }, liens }, INST), 'candidat');
  assert.equal(typeSourceStatut({ source: { url: 'https://www.parti.fr/a' }, liens }, INST), 'parti');
  assert.equal(typeSourceStatut({ source: { url: 'https://www.elysee.fr/a' }, liens }, INST), 'institution');
  assert.equal(typeSourceStatut({ source: { url: 'https://www.interieur.gouv.fr/a' } }, INST), 'institution');
  assert.equal(typeSourceStatut({ source: { url: 'https://www.lemonde.fr/a' }, liens }, INST), 'presse');
  assert.equal(typeSourceStatut({ source: { url: 'nimporte quoi' } }, INST), 'presse');
});

test('lireDomainesInstitutions et lireReglesTypeSource lisent la liste versionnée', () => {
  assert.ok(lireDomainesInstitutions(RACINE).includes('gouv.fr'));
  const r = lireReglesTypeSource(RACINE);
  assert.ok(r.institutions.includes('gouv.fr'));
  for (const h of ['facebook.com', 'x.com', 'wordpress.com', 'github.io', 'linktr.ee', 'bit.ly']) assert.ok(r.partages.includes(h), h);
});

test('oracle : type de source reproduit les lignes réelles (écart connu : Retailleau)', () => {
  const table = lireCorrespondances(lireYamlPlafonne(readFileSync(path.join(RACINE, 'data/import/correspondances.yaml'), 'utf8'), 'correspondances.yaml'));
  const jeu = JSON.parse(readFileSync(path.join(RACINE, 'data/import/2027etmoi-candidats-2026-11-01-332914fc603e.json'), 'utf8')) as { candidats: { id: string; source: { url: string }; liens?: Record<string, string> }[] };
  const inst = lireReglesTypeSource(RACINE);
  const ecarts: string[] = [];
  for (const l of jeu.candidats) {
    const attendu = table[l.id];
    if (attendu !== undefined && typeSourceStatut(l, inst) !== attendu.type_source_statut) ecarts.push(l.id);
  }
  assert.deepEqual(ecarts, ['retailleau']);
});

const base = { id: 'dupont', nom: 'Jean Dupont', source: { url: 'https://www.lemonde.fr/a', date: '2026-11-01' } };

test('ligneCorrespondance : motif non_candidat pour renonce, aucun pour declare', () => {
  const r = ligneCorrespondance({ ...base, statut: 'renonce' }, vide, INST);
  assert.ok(!('refus' in r));
  assert.equal(r.entree.motif, 'non_candidat');
  assert.equal(r.entree.type_source_statut, 'presse');
  assert.equal(r.idAmont, 'dupont');
  const d = ligneCorrespondance({ ...base, statut: 'declare' }, vide, INST);
  assert.ok(!('refus' in d));
  assert.equal(d.entree.motif, undefined);
  assert.equal(d.entree.id, 'jean-dupont');
});

test('ligneCorrespondance : refus propagés', () => {
  const r = ligneCorrespondance({ ...base, id: 'martin', statut: 'declare' }, vide, INST);
  assert.ok('refus' in r && r.refus === 'identite_ambigue');
  const p = ligneCorrespondance({ ...base, statut: 'declare', liens: { programme: 'https://x.fr/p' } }, vide, INST);
  assert.ok('refus' in p && p.refus === 'programme_signale');
  const pr = ligneCorrespondance({ ...base, statut: 'pressenti', liens: { programme: 'https://x.fr/p' } }, vide, INST);
  assert.ok(!('refus' in pr));
});
