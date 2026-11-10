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
  FICHIERS_SORTIE_ERREUR,
  TAILLE_SORTIE_ERREUR_MIO,
  phraseJournalAcces,
  phraseSortieErreur,
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
    assert.match(page, /import \{ phraseJournalAcces, phraseSortieErreur \} from '\.\.\/lib\/journal-acces\.ts';/);
    assert.match(page, /<li data-journal-acces>\{phraseJournalAcces\(\)\}<\/li>/);
    assert.equal([...page.matchAll(/phraseJournalAcces\(\)/g)].length, 1);
  });

  it('seulement dans la branche « hébergeur actif » de la section Données personnelles, pas dans la branche prevu', () => {
    const section = page.slice(page.indexOf('<h2>Données personnelles</h2>'));
    const debut = section.indexOf("{heb.statut === 'prevu' ? (");
    assert.ok(debut >= 0, 'ternaire hébergeur absent de la section');
    const sinon = section.indexOf(') : (', debut);
    const fin = section.indexOf('\n      )}', sinon);
    const appel = section.indexOf('phraseJournalAcces()');
    assert.ok(sinon > debut && fin > sinon, 'ternaire mal formé');
    assert.ok(appel > sinon && appel < fin, 'phraseJournalAcces() doit être dans la branche non prevu');
    assert.doesNotMatch(section.slice(debut, sinon), /journal/);
  });
});

// IN-06 (revue de la phase 8), D-11 : la sortie d'erreur du conteneur Caddy (requêtes en échec, TLS, ACME) garde
// l'adresse IP complète ; elle est plafonnée en taille par le pilote json-file de deploy/compose/docker-compose.override.yml,
// pas en durée. Les Mentions légales le disent, avec les valeurs de ce module, liées par test au fichier de composition.
describe('phraseSortieErreur : sortie d’erreur du conteneur', () => {
  const phrase = phraseSortieErreur();

  it('constantes : 10 Mio x 3 fichiers', () => {
    assert.equal(TAILLE_SORTIE_ERREUR_MIO, 10);
    assert.equal(FICHIERS_SORTIE_ERREUR, 3);
  });

  it('les constantes égalent max-size et max-file du fichier de composition (service caddy)', () => {
    const compose = readFileSync(path.join(REPO, 'deploy', 'compose', 'docker-compose.override.yml'), 'utf8');
    const taille = /^\s*max-size:\s*"?(\d+)m"?\s*$/m.exec(compose);
    const fichiers = /^\s*max-file:\s*"?(\d+)"?\s*$/m.exec(compose);
    assert.ok(taille && fichiers, 'max-size ou max-file absent du fichier de composition');
    assert.equal(Number(taille[1]), TAILLE_SORTIE_ERREUR_MIO);
    assert.equal(Number(fichiers[1]), FICHIERS_SORTIE_ERREUR);
    assert.match(compose, /driver: json-file/);
  });

  it('une phrase : requêtes en échec, fonctionnement du serveur, IP complète, 30 Mio au plus, pas de durée, diagnostic', () => {
    assert.match(phrase, /^[A-Z]/);
    assert.ok(phrase.endsWith('.'));
    assert.equal(phrase.split(/[.!?](\s|$)/).filter((p) => p.trim() !== '').length, 1, 'une seule phrase');
    assert.match(phrase, /sortie d'erreur du serveur/);
    assert.match(phrase, /requêtes en échec/);
    assert.match(phrase, /certificats/);
    assert.match(phrase, /adresse IP complète/);
    assert.ok(phrase.includes(`${TAILLE_SORTIE_ERREUR_MIO * FICHIERS_SORTIE_ERREUR} Mio au plus`), phrase);
    assert.ok(phrase.includes('30 Mio'));
    assert.match(phrase, /non en durée/);
    assert.match(phrase, /diagnostiquer les pannes/);
  });

  it('la taille vient des constantes (aucun 30 écrit en dur dans la fonction)', () => {
    const source = readFileSync(path.join(REPO, 'src', 'lib', 'journal-acces.ts'), 'utf8');
    const corps = source.slice(source.indexOf('export function phraseSortieErreur'));
    assert.doesNotMatch(corps, /\b30\b/);
    assert.match(corps, /\$\{TAILLE_SORTIE_ERREUR_MIO \* FICHIERS_SORTIE_ERREUR\}/);
  });

  it('ni tiret long ni tiret moyen, aucun mot interdit', () => {
    assert.doesNotMatch(phrase, /[–—]/);
    assert.deepEqual(motsInterdits(phrase, { exempterCitations: false }), []);
  });
});

/** Vrai si `marque` est rendu seulement dans un bloc `{heb.statut === 'actif' && (` … `)}` de la page. */
function dansBlocActif(page: string, marque: string): boolean {
  const pos = page.indexOf(marque);
  if (pos < 0) return false;
  const tete = "{heb.statut === 'actif' && (";
  const ouverture = page.lastIndexOf(tete, pos);
  if (ouverture < 0) return false;
  const fermeture = page.indexOf(')}', ouverture);
  // aucune autre condition sur l'hébergeur entre l'ouverture et la marque
  return fermeture > pos && !page.slice(ouverture + tete.length, pos).includes('heb.statut');
}

describe('src/pages/mentions-legales.astro : rendu « hébergeur actif » (régime II, D-02 révisée)', () => {
  const page = readFileSync(path.join(REPO, 'src', 'pages', 'mentions-legales.astro'), 'utf8');
  const donnees = page.slice(page.indexOf('<h2>Données personnelles</h2>'));

  it('phraseSortieErreur() une fois, dans un <li data-sortie-erreur>, dans la branche non prevu, après le journal d’accès', () => {
    assert.match(page, /<li data-sortie-erreur>\{phraseSortieErreur\(\)\}<\/li>/);
    assert.equal([...page.matchAll(/phraseSortieErreur\(\)/g)].length, 1);
    const debut = donnees.indexOf("{heb.statut === 'prevu' ? (");
    const sinon = donnees.indexOf(') : (', debut);
    const fin = donnees.indexOf('\n      )}', sinon);
    const appel = donnees.indexOf('phraseSortieErreur()');
    assert.ok(appel > sinon && appel < fin, 'phraseSortieErreur() doit être dans la branche non prevu');
    assert.ok(appel > donnees.indexOf('phraseJournalAcces()'));
  });

  it('le commentaire qui renvoyait la phrase de la sortie d’erreur à la Phase 9 a disparu', () => {
    assert.doesNotMatch(page, /question O4|rédigée avec la relecture juridique/);
  });

  it('la phrase de transmission de l’identité à l’hébergeur n’existe que sous « actif », dans la section Éditeur', () => {
    assert.ok(dansBlocActif(page, '<p data-identite-hebergeur>'), 'data-identite-hebergeur hors bloc actif');
    assert.equal([...page.matchAll(/data-identite-hebergeur/g)].length, 1);
    const editeur = page.slice(page.indexOf('<h2>Éditeur</h2>'), page.indexOf('<h2>Contact</h2>'));
    assert.ok(editeur.includes("l'éditeur a communiqué ses éléments d'identification à l'hébergeur nommé ci-dessous."));
  });

  it('le paragraphe RGPD (responsable, finalité, base légale, droits, CNIL) n’existe que sous « actif »', () => {
    assert.ok(dansBlocActif(page, '<p data-rgpd>'), 'data-rgpd hors bloc actif');
    const rgpd = page.slice(page.indexOf('<p data-rgpd>'));
    const bloc = rgpd.slice(0, rgpd.indexOf('</p>'));
    for (const attendu of ['Erwan Henry', 'sécurité du serveur', 'intérêt légitime', 'article 6, paragraphe 1, f du RGPD', "d'accès", "d'effacement", "d'opposition", 'CNIL', 'https://www.cnil.fr/fr/plaintes']) {
      assert.ok(bloc.includes(attendu), `« ${attendu} » absent du paragraphe RGPD`);
    }
  });

  it('aucun lien ni mention de la note de risques, aucun « 6 IV », aucune adresse ni téléphone de l’éditeur', () => {
    assert.doesNotMatch(page, /RISQUES-JURIDIQUES|note de risques/);
    assert.doesNotMatch(page, /6 IV|IV de l'article 6/);
    assert.doesNotMatch(page, /tel:/);
    const editeur = page.slice(page.indexOf('<h2>Éditeur</h2>'), page.indexOf('<h2>Contact</h2>'));
    assert.ok(editeur.includes('Éditeur et directeur de la publication : Erwan Henry.'));
    assert.doesNotMatch(editeur, /[Tt]éléphone|domicile|adresse postale/);
  });
});
