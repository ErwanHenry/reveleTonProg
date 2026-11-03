// Liens de signalement (mailto RFC 6068, issue GitHub) et lien vers l'extrait archivé.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lienExtrait, lienIssue, lienMailto } from '../../src/lib/corpus/signalement.ts';

const ID = 'marie-fictive/aide-construction';
const CHEMIN = '/themes/logement/#m-marie-fictive-aide-construction';

describe('lienMailto', () => {
  const url = lienMailto('a@b.invalid', ID, CHEMIN);

  it('préfixe exact, espaces en %20', () => {
    assert.ok(url.startsWith('mailto:a@b.invalid?subject=Signaler%20une%20erreur%20%3A%20marie-fictive%2Faide-construction&body='), url);
    assert.ok(!url.includes('+'), 'jamais de + pour une espace');
  });

  it('le corps se décode en texte CRLF exact', () => {
    const corps = decodeURIComponent(url.split('&body=')[1] as string);
    assert.equal(corps, `Identifiant : ${ID}\r\nPage : ${CHEMIN}\r\n\r\nErreur constatée :\r\n`);
    assert.ok((url.split('&body=')[1] as string).includes('%0D%0A'));
  });

  it('un identifiant hostile reste encodé', () => {
    const hostile = lienMailto('a@b.invalid', 'x&body=pwn#y', '/p');
    assert.equal(hostile.split('&body=').length, 2, 'un seul séparateur body');
    assert.ok(!hostile.includes('#'));
  });
});

describe('lienIssue', () => {
  const url = lienIssue('ErwanHenry/reveleTonProg', ID);

  it('titre et corps encodés, ni labels ni template', () => {
    assert.ok(
      url.startsWith('https://github.com/ErwanHenry/reveleTonProg/issues/new?title=Erreur%20signal%C3%A9e%20%3A%20marie-fictive%2Faide-construction&body='),
      url,
    );
    assert.ok(!url.includes('labels='));
    assert.ok(!url.includes('template='));
    assert.equal(decodeURIComponent(url.split('&body=')[1] as string), `Identifiant : ${ID}\n\nErreur constatée :\n`);
  });
});

describe('lienExtrait', () => {
  const projet = path.join(path.sep, 'tmp', 'depot');
  const extrait = 'archives/marie-fictive/23c5f1cc8eff.txt';

  it('racine de contenu = racine du projet : chemin direct', () => {
    assert.equal(lienExtrait('ErwanHenry/reveleTonProg', extrait, projet, projet), `https://github.com/ErwanHenry/reveleTonProg/blob/main/${extrait}`);
  });

  it('racine de contenu dans le projet : chemin relatif POSIX', () => {
    const contenu = path.join(projet, 'tests', 'fixtures', 'corpus-valide');
    assert.equal(
      lienExtrait('ErwanHenry/reveleTonProg', extrait, contenu, projet),
      `https://github.com/ErwanHenry/reveleTonProg/blob/main/tests/fixtures/corpus-valide/${extrait}`,
    );
  });

  it('racine de contenu hors du projet : archives/… sans ..', () => {
    const url = lienExtrait('ErwanHenry/reveleTonProg', extrait, path.join(path.sep, 'var', 'tmp', 'rtp-m1-x'), projet);
    assert.equal(url, `https://github.com/ErwanHenry/reveleTonProg/blob/main/${extrait}`);
    assert.ok(!url.includes('..'));
  });

  it('jamais de .. même avec un dossier voisin', () => {
    const url = lienExtrait('a/b', extrait, path.join(path.sep, 'tmp', 'depot-voisin'), projet);
    assert.ok(!url.includes('..'));
  });
});

describe('signalement.ts', () => {
  it('ne s’appuie ni sur labels= ni sur template=', () => {
    const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'lib', 'corpus', 'signalement.ts'), 'utf8');
    assert.equal(/labels=|template=/.test(src), false);
  });
});
