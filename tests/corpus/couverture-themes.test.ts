import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { THEMES_SPEC, classer, lireCouverture } from '../../scripts/lib/couverture.ts';
import { HOTES_INTERDITS, MODE_PILOTE } from '../../scripts/lib/pilote.ts';
import { dansPerimetre } from '../../src/lib/content-core/rules/equite.ts';

// Test sur les données réelles (racine du dépôt) : tableau de couverture mesurée (CONT-04), plan 03-04.
// Rien n'est saisi à la main : le périmètre vient des fiches candidats, le classement de `classer`.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (...p: string[]): string => readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

const { data, problemes } = lireCouverture(lire('data', 'couverture-themes.yaml'));

/** Périmètre : fiches dans le périmètre d'équité (dansPerimetre, mode du pilote, W5), dans l'ordre `nom_tri` (collation française). */
function perimetre(): string[] {
  const dir = path.join(REPO_ROOT, 'src', 'content', 'candidats');
  const fiches = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(path.join(dir, f), 'utf8'), { schema: 'core' }) as { id: string; nom_tri: string; statuts: unknown });
  const col = new Intl.Collator('fr');
  return fiches
    .filter((f) => dansPerimetre(f.statuts, MODE_PILOTE))
    .sort((a, b) => col.compare(a.nom_tri, b.nom_tri))
    .map((f) => f.id);
}

describe('tableau de couverture mesurée (données réelles)', () => {
  it('est lu sans problème par lireCouverture', () => {
    assert.deepEqual(problemes, []);
  });

  it('a exactement une ligne par candidat du périmètre, dans l’ordre nom_tri', () => {
    assert.deepEqual(data.candidats.map((c) => c.id), perimetre());
  });

  it('a 10 cellules complètes, avec une note, par ligne', () => {
    for (const c of data.candidats) {
      for (const t of THEMES_SPEC) {
        const cell = c.cellules[t.id];
        assert.ok(cell, `${c.id} : cellule ${t.id} absente`);
        assert.ok((cell.note ?? '').trim() !== '', `${c.id} : note vide pour ${t.id}`);
      }
    }
  });

  it('rattache chaque ligne à des sources archivées et attribuées au candidat', () => {
    for (const c of data.candidats) {
      for (const id of c.sources) {
        const f = path.join(REPO_ROOT, 'src', 'content', 'sources', `${id}.yaml`);
        assert.ok(existsSync(f), `${c.id} : source ${id} introuvable`);
        const s = parse(readFileSync(f, 'utf8'), { schema: 'core' }) as {
          candidats: string[];
          url: string;
          archive: { extrait: string; sha256: string };
        };
        assert.ok(s.candidats.includes(c.id), `${id} n’est pas attribuée à ${c.id}`);
        const extrait = path.join(REPO_ROOT, s.archive.extrait);
        assert.ok(existsSync(extrait), `${id} : extrait ${s.archive.extrait} introuvable`);
        assert.equal(createHash('sha256').update(readFileSync(extrait)).digest('hex'), s.archive.sha256, `${id} : sha256 de l’extrait différent`);
        const hote = new URL(s.url).hostname;
        const interdit = HOTES_INTERDITS.find((h) => hote === h || hote.endsWith(`.${h}`));
        assert.equal(interdit, undefined, `${id} : hôte interdit ${hote}`);
      }
    }
  });

  it('exige une source pour toute ligne qui a une case fort, partiel ou silence', () => {
    for (const c of data.candidats) {
      const lue = Object.values(c.cellules).some((x) => ['fort', 'partiel', 'silence'].includes(x.niveau));
      if (lue) assert.ok(c.sources.length > 0, `${c.id} : cases lues mais aucune source`);
      assert.ok(c.urls_consultees.length > 0, `${c.id} : urls_consultees vide`);
    }
  });

  it('respecte les définitions de `acces` (§3 du protocole)', () => {
    for (const c of data.candidats) {
      const niveaux = new Set(Object.values(c.cellules).map((x) => x.niveau));
      if (c.acces === 'aucun_site') assert.deepEqual([...niveaux], ['aucun'], `${c.id} : aucun_site exige 10 cases « aucun »`);
      if (c.acces === 'bloque') assert.deepEqual([...niveaux], ['inaccessible'], `${c.id} : bloque exige 10 cases « inaccessible »`);
      if (c.acces === 'partiel' || c.acces === 'bloque') assert.ok(c.urls_bloquees.length > 0, `${c.id} : urls_bloquees vide`);
      if (c.acces === 'ok' || c.acces === 'aucun_site') assert.equal(c.urls_bloquees.length, 0, `${c.id} : urls_bloquees non vide`);
      if (c.acces === 'ok' || c.acces === 'partiel') assert.ok(c.sources.length > 0, `${c.id} : acces ${c.acces} sans source`);
      if (c.acces === 'ok' || c.acces === 'partiel') assert.ok(!niveaux.has('aucun') && !niveaux.has('inaccessible'), `${c.id} : cases aucun/inaccessible avec une source lue`);
    }
  });

  it('garde la liste provisoire et l’état de relecture du plan 03-04', () => {
    assert.deepEqual(data.pilote.provisoires, ['institutions', 'impots', 'retraites']);
    assert.equal(data.pilote.relecture_ouverte, false);
  });

  it('recalcule le choix : pilote.themes, s’il est renseigné, égale classer(...).choix sauf dérogation', () => {
    const r = classer(data);
    assert.equal(r.choix.length, 3);
    assert.equal(new Set(r.choix).size, 3);
    if (data.pilote.themes.length > 0 && data.pilote.derogation === null) {
      assert.deepEqual(data.pilote.themes, r.choix);
    }
  });

  it('est expliqué dans docs/COUVERTURE-THEMES.md (date, règle de la marge, trois thèmes retenus)', () => {
    const doc = lire('docs', 'COUVERTURE-THEMES.md');
    const r = classer(data);
    assert.ok(doc.includes(data.mesure_le), 'la date de mesure est absente du document');
    const marge = r.explication.find((l) => l.startsWith('Règle des trois thèmes'));
    assert.ok(marge, 'phrase de la marge introuvable dans classer');
    assert.ok(doc.includes(marge), 'la phrase de la marge de classer doit figurer mot pour mot dans le document');
    for (const id of r.choix) assert.ok(doc.includes(id), `le thème retenu « ${id} » est absent du document`);
    for (const id of r.top3Litteral) assert.ok(doc.includes(id), `le thème du classement littéral « ${id} » est absent du document`);
    for (const id of data.pilote.provisoires) assert.ok(doc.includes(id), `le thème provisoire « ${id} » est absent du document`);
  });
});
