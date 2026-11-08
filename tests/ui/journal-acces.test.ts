// HEB-09 (08-01) : la politique du journal d'accès de Caddy (rotation, taille, fichiers gardés, durée maximale,
// masques d'adresse IP) n'a qu'une source, src/lib/journal-acces.ts. Le rendu des blocs Caddy et la phrase des
// Mentions légales en dérivent : changer une valeur change les deux, jamais l'un sans l'autre.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as renderCaddy from '../../scripts/render-caddy.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import {
  FICHIERS_TOURNES_GARDES,
  MASQUE_IPV4,
  MASQUE_IPV6,
  RETENTION_MAX_JOURS,
  ROTATION_JOURNAL,
  TAILLE_JOURNAL,
  phraseJournalAcces,
} from '../../src/lib/journal-acces.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('src/lib/journal-acces.ts : politique du journal d’accès', () => {
  it('valeurs : rotation à 00:00 UTC ou à 10 Mio, 12 fichiers tournés gardés, 14 jours au plus, /24 et /48', () => {
    assert.equal(ROTATION_JOURNAL, '00:00');
    assert.equal(TAILLE_JOURNAL, '10MiB');
    assert.equal(FICHIERS_TOURNES_GARDES, 12);
    assert.equal(RETENTION_MAX_JOURS, 14);
    assert.equal(RETENTION_MAX_JOURS, FICHIERS_TOURNES_GARDES + 2);
    assert.equal(MASQUE_IPV4, 24);
    assert.equal(MASQUE_IPV6, 48);
  });

  it('scripts/render-caddy.ts réexporte les mêmes valeurs (les imports existants restent valides)', () => {
    assert.equal(renderCaddy.ROTATION_JOURNAL, ROTATION_JOURNAL);
    assert.equal(renderCaddy.TAILLE_JOURNAL, TAILLE_JOURNAL);
    assert.equal(renderCaddy.FICHIERS_TOURNES_GARDES, FICHIERS_TOURNES_GARDES);
    assert.equal(renderCaddy.RETENTION_MAX_JOURS, RETENTION_MAX_JOURS);
    assert.equal(renderCaddy.MASQUE_IPV4, MASQUE_IPV4);
    assert.equal(renderCaddy.MASQUE_IPV6, MASQUE_IPV6);
    const source = readFileSync(path.join(REPO, 'scripts', 'render-caddy.ts'), 'utf8');
    assert.match(source, /from '\.\.\/src\/lib\/journal-acces\.ts'/);
    assert.match(source, /ip_mask \$\{MASQUE_IPV4\} \$\{MASQUE_IPV6\}/);
  });
});

describe('phraseJournalAcces : phrase des Mentions légales', () => {
  const phrase = phraseJournalAcces();

  it('une phrase : 14 jours au plus, IP tronquée (/24, /48), en-têtes non enregistrés, usage limité au serveur', () => {
    assert.match(phrase, /^[A-Z]/);
    assert.ok(phrase.endsWith('.'));
    assert.equal(phrase.split(/[.!?](\s|$)/).filter((p) => p.trim() !== '').length, 1, 'une seule phrase');
    assert.ok(phrase.includes(`${RETENTION_MAX_JOURS} jours au plus`), phrase);
    assert.ok(phrase.includes('14 jours'));
    assert.ok(phrase.includes('/24') && phrase.includes('/48'));
    assert.match(phrase, /adresse IP/);
    assert.match(phrase, /en-têtes/);
    assert.match(phrase, /navigateur/);
    assert.match(phrase, /page d'où vous venez/);
    assert.match(phrase, /fonctionnement du serveur/);
  });

  it('le nombre de jours vient de RETENTION_MAX_JOURS (aucun 14 écrit en dur dans le module)', () => {
    const source = readFileSync(path.join(REPO, 'src', 'lib', 'journal-acces.ts'), 'utf8');
    const corpsFonction = source.slice(source.indexOf('export function phraseJournalAcces'));
    assert.doesNotMatch(corpsFonction, /\b14\b/);
    assert.match(corpsFonction, /\$\{RETENTION_MAX_JOURS\}/);
  });

  it('ni tiret long ni tiret moyen, aucun mot interdit', () => {
    assert.doesNotMatch(phrase, /[–—]/);
    assert.deepEqual(motsInterdits(phrase, { exempterCitations: false }), []);
  });
});

describe('src/pages/mentions-legales.astro : phrase du journal d’accès', () => {
  const page = readFileSync(path.join(REPO, 'src', 'pages', 'mentions-legales.astro'), 'utf8');

  it('importe phraseJournalAcces et l’affiche dans un <li data-journal-acces>', () => {
    assert.match(page, /import \{ phraseJournalAcces \} from '\.\.\/lib\/journal-acces\.ts';/);
    assert.match(page, /<li data-journal-acces>\{phraseJournalAcces\(\)\}<\/li>/);
    assert.equal([...page.matchAll(/phraseJournalAcces\(\)/g)].length, 1);
  });

  it('seulement dans la branche « hébergeur actif » de la section Données personnelles, pas dans la branche prevu', () => {
    const section = page.slice(page.indexOf('<h2>Données personnelles</h2>'));
    const debut = section.indexOf("{heb.statut === 'prevu' ? (");
    assert.ok(debut >= 0, 'ternaire hébergeur absent de la section');
    const sinon = section.indexOf(') : (', debut);
    const fin = section.indexOf(')}', sinon);
    const appel = section.indexOf('phraseJournalAcces()');
    assert.ok(sinon > debut && fin > sinon, 'ternaire mal formé');
    assert.ok(appel > sinon && appel < fin, 'phraseJournalAcces() doit être dans la branche non prevu');
    assert.doesNotMatch(section.slice(debut, sinon), /journal/);
  });
});
