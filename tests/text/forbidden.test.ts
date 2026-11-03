import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { motsInterdits, verbesConnotes } from '../../src/lib/content-core/rules/text/forbidden.ts';

const lower = (xs: string[]): string[] => xs.map((x) => x.toLocaleLowerCase('fr')).sort();

describe('motsInterdits : mots flagués', () => {
  for (const t of ['EXTREME', 'extrême', "l'extrême", 'l’extrême droite', 'extrémiste', 'extrêmement']) {
    it(`flague « ${t} »`, () => assert.equal(motsInterdits(`Un texte ${t} ici`).length, 1));
  }
  for (const t of ['populistes', 'populisme', 'irresponsable', 'irresponsabilité', 'courageux', 'courage', 'courageusement', 'Enfin,']) {
    it(`flague « ${t} »`, () => assert.equal(motsInterdits(`Un texte ${t} ici`).length, 1));
  }
});

describe('motsInterdits : faux positifs évités', () => {
  for (const t of ['population', 'populaire', 'encouragé', 'Enfinir', 'extrémité', 'extrémités']) {
    it(`ne flague pas « ${t} »`, () => assert.deepEqual(motsInterdits(`Un texte ${t} ici`), []));
  }
});

describe('motsInterdits : citations et contournements', () => {
  it('un mot dans une citation équilibrée est exempté', () => {
    assert.deepEqual(motsInterdits("Il dit « enfin, c'est extrême » puis propose"), []);
  });
  it('seul le mot hors citation est flagué', () => {
    assert.deepEqual(lower(motsInterdits("Il dit « enfin » puis c'est extrême")), ['extrême']);
  });
  it('un guillemet ouvrant orphelin n’exempte rien', () => {
    assert.deepEqual(lower(motsInterdits('Il dit « enfin puis propose')), ['enfin']);
  });
  it('les caractères invisibles ne masquent pas un mot', () => {
    assert.equal(motsInterdits('c’est extr\u200Bême').length, 1);
    assert.equal(motsInterdits('c’est ex\u00ADtrême').length, 1);
  });
  it('les marqueurs de glossaire sont résolus avant la recherche', () => {
    assert.deepEqual(lower(motsInterdits('Un [[extrême|extreme]] choix')), ['extrême']);
  });
  it('un mot par forme, sans doublon', () => {
    assert.deepEqual(lower(motsInterdits('enfin, enfin, Enfin')), ['enfin']);
  });
});

describe('verbesConnotes', () => {
  for (const v of ['promet', 'prétend', 'ose', 'assure', 'affirme', 'martèle', 'reconnaît', 'reconnait', 'admet', 'avoue']) {
    it(`flague « ${v} »`, () => assert.deepEqual(verbesConnotes(`Elle ${v} que oui`), [v]));
  }
  it('flague « se vante »', () => {
    assert.equal(verbesConnotes('Elle se vante de tout').length, 1);
  });
  it('« a osé » et « assuré » ne sont pas flagués (les accents comptent)', () => {
    assert.deepEqual(verbesConnotes('Elle a osé et il est assuré'), []);
  });
  it('un verbe entre guillemets est exempté', () => {
    assert.deepEqual(verbesConnotes('Le texte dit « admet » ici'), []);
  });
});
