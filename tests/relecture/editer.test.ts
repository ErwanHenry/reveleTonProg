import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  CLES_ECRIVIBLES,
  EditionRefusee,
  comparerLignes,
  definirChamps,
  ecrireAtomique,
  verifierSeulesCles,
} from '../../scripts/lib/relecture/editer.ts';
import { statutRetenu } from '../../src/lib/content-core/rules/equite.ts';

// Éditeur de relecture (09-01, D-04) : seules les clés de relecture changent, octet pour octet ailleurs.
// Les tests sur le corpus réel lisent les fichiers et travaillent en mémoire : rien n'est écrit dans src/content.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENU = path.join(REPO_ROOT, 'src', 'content');
const DATE = '2026-11-20';
const RELU = [
  { cle: 'statut_relecture', valeur: 'relu' },
  { cle: 'relecteur', valeur: 'Erwan Henry' },
  { cle: 'date_relecture', valeur: DATE },
] as const;

const MESURE = [
  'version_schema: 1',
  'id: a/b',
  '# commentaire conservé',
  'titre: "Titre"',
  'texte_source: >-',
  '  Texte replié',
  '  sur deux lignes.',
  'redactions:',
  '  resume: >-',
  '    Résumé.',
  'statut_relecture: brouillon',
  '',
].join('\n');

describe('editer : definirChamps', () => {
  it('pose les trois champs d’une mesure : 1 ligne modifiée, 2 ajoutées, le reste identique', () => {
    const apres = definirChamps(MESURE, [], RELU);
    assert.equal(apres, MESURE.replace('statut_relecture: brouillon\n', `statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: ${DATE}\n`));
    const b = comparerLignes(MESURE, apres);
    assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [1, 2, 0]);
  });

  it('garde les fins de ligne CRLF', () => {
    const crlf = MESURE.replace(/\n/g, '\r\n');
    const apres = definirChamps(crlf, [], RELU);
    assert.ok(apres.includes(`relecteur: Erwan Henry\r\ndate_relecture: ${DATE}\r\n`));
    assert.ok(!/[^\r]\n/.test(apres), 'un saut de ligne LF seul a été écrit dans un fichier CRLF');
  });

  it('fichier sans saut de ligne final : insertion correcte', () => {
    const apres = definirChamps(MESURE.trimEnd(), [], RELU);
    assert.equal(apres, MESURE.trimEnd().replace('statut_relecture: brouillon', `statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: ${DATE}`));
    const b = comparerLignes(MESURE.trimEnd(), apres);
    assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [1, 2, 0]);
  });

  it('deuxième relecture : remplace relecteur et date sans doublon', () => {
    const une = definirChamps(MESURE, [], RELU);
    const deux = definirChamps(une, [], [RELU[0], { cle: 'relecteur', valeur: 'Anne Relectrice' }, { cle: 'date_relecture', valeur: '2026-12-01' }]);
    const b = comparerLignes(une, deux);
    assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [2, 0, 0]);
    assert.equal(deux.match(/relecteur:/g)?.length, 1);
    assert.equal(deux.match(/date_relecture:/g)?.length, 1);
  });

  it('entrée de liste (statuts[i]) : indentation des clés sœurs', () => {
    const t = 'statuts:\n  - code: declare\n    date: 2026-06-01\n    statut_relecture: brouillon\n  - code: renonce\n    statut_relecture: brouillon\n';
    const apres = definirChamps(t, ['statuts', 0], RELU);
    assert.equal(apres, t.replace('    statut_relecture: brouillon\n  - code: renonce', `    statut_relecture: relu\n    relecteur: Erwan Henry\n    date_relecture: ${DATE}\n  - code: renonce`));
  });

  it('liste de slugs : écrite en séquence bloc un niveau plus bas', () => {
    const t = 'cases:\n  - candidat: x\n    etat: mesures\n    verifie_le: 2026-11-03\n    verifie_par: Claude\n';
    const apres = definirChamps(t, ['cases', 0], [{ cle: 'sources_consultees', valeur: ['source-a', 'source-b'] }], { apres: 'verifie_par' });
    assert.equal(apres, `${t}    sources_consultees:\n      - source-a\n      - source-b\n`);
    assert.deepEqual(parse(apres).cases[0].sources_consultees, ['source-a', 'source-b']);
  });

  it('refuse toute clé hors de la liste fermée (titre, redactions)', () => {
    assert.ok(!(CLES_ECRIVIBLES as readonly string[]).includes('titre'));
    assert.throws(() => definirChamps(MESURE, [], [{ cle: 'titre', valeur: 'Autre' }]), EditionRefusee);
    assert.throws(() => definirChamps(MESURE, [], [{ cle: 'redactions', valeur: 'x' }]), EditionRefusee);
    assert.throws(() => definirChamps(MESURE, ['redactions'], [{ cle: 'resume', valeur: 'x' }]), EditionRefusee);
  });

  it('refuse les valeurs qui demanderaient des guillemets ou changeraient de type', () => {
    const refus: [string, string][] = [
      ['date_relecture', '2026-02-30'],
      ['date_relecture', '2026-11'],
      ['statut_relecture', 'valide'],
      ['etat', 'autre'],
      ['relecteur', 'Erwan: Henry'],
      ['relecteur', 'Erwan #1'],
      ['relecteur', 'true'],
      ['relecteur', 'Null'],
      ['relecteur', 'Erwan '],
      ['relecteur', '-Erwan'],
      ['relecteur', 'E'],
      ['relecteur', 'Erwan\nid: autre'],
    ];
    for (const [cle, valeur] of refus) assert.throws(() => definirChamps(MESURE, [], [{ cle, valeur }]), EditionRefusee, `${cle}=${valeur}`);
    assert.throws(() => definirChamps(MESURE, [], [{ cle: 'sources_consultees', valeur: ['Pas Un Slug'] }]), EditionRefusee);
  });

  it('refuse un remplacement sur une valeur multiligne', () => {
    const t = 'statut_relecture: brouillon\nrelecteur: >-\n  Erwan\n  Henry\n';
    assert.throws(() => definirChamps(t, [], RELU), EditionRefusee);
  });
});

describe('editer : verifierSeulesCles', () => {
  it('refuse un changement d’une autre clé, une ligne supprimée ou un reformatage', () => {
    const relu = definirChamps(MESURE, [], RELU);
    const cles = RELU.map((c) => c.cle);
    assert.throws(() => verifierSeulesCles(MESURE, relu.replace('Résumé.', 'Résumé modifié.'), [], cles), EditionRefusee);
    assert.throws(() => verifierSeulesCles(MESURE, relu.replace('# commentaire conservé\n', ''), [], cles), EditionRefusee);
    // Même valeur, autre forme (scalaire replié devenu une ligne) : toJS égal mais diff hors des clés.
    assert.throws(() => verifierSeulesCles(MESURE, relu.replace('texte_source: >-\n  Texte replié\n  sur deux lignes.', 'texte_source: Texte replié sur deux lignes.'), [], cles), EditionRefusee);
    assert.throws(() => verifierSeulesCles(MESURE, relu, [], ['titre']), EditionRefusee);
    assert.throws(() => verifierSeulesCles(MESURE, `${relu}a: &x 1\nb: *x\n`, [], cles), EditionRefusee);
    assert.doesNotThrow(() => verifierSeulesCles(MESURE, relu, [], cles));
  });
});

describe('editer : ecrireAtomique', () => {
  const racine = mkdtempSync(path.join(os.tmpdir(), 'rtp-editer-'));
  after(() => rmSync(racine, { recursive: true, force: true }));
  mkdirSync(path.join(racine, 'src', 'content', 'mesures', 'a'), { recursive: true });
  const fichier = path.join(racine, 'src', 'content', 'mesures', 'a', 'b.yaml');
  writeFileSync(fichier, MESURE);

  it('écrit par renommage, sans laisser de fichier temporaire', () => {
    ecrireAtomique(racine, fichier, 'x: 1\n');
    assert.equal(readFileSync(fichier, 'utf8'), 'x: 1\n');
    assert.deepEqual(readdirSync(path.dirname(fichier)), ['b.yaml']);
  });

  it('refuse hors de src/content, un lien symbolique, un fichier absent', () => {
    const dehors = path.join(racine, 'dehors.yaml');
    writeFileSync(dehors, 'x: 1\n');
    assert.throws(() => ecrireAtomique(racine, dehors, 'y: 2\n'), EditionRefusee);
    assert.throws(() => ecrireAtomique(racine, path.join(racine, 'src', 'content', '..', 'dehors.yaml'), 'y: 2\n'), EditionRefusee);
    const lien = path.join(racine, 'src', 'content', 'mesures', 'a', 'lien.yaml');
    symlinkSync(dehors, lien);
    assert.throws(() => ecrireAtomique(racine, lien, 'y: 2\n'), EditionRefusee);
    assert.equal(readFileSync(dehors, 'utf8'), 'x: 1\n');
    assert.throws(() => ecrireAtomique(racine, path.join(racine, 'src', 'content', 'mesures', 'a', 'absent.yaml'), 'y: 2\n'), EditionRefusee);
  });
});

describe('editer : preuve sur le corpus réel (en mémoire, lecture seule)', () => {
  const fichiersDe = (dossier: string): string[] =>
    readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiersDe(path.join(dossier, e.name)) : e.name.endsWith('.yaml') ? [path.join(dossier, e.name)] : []));

  it('chaque mesure : 3 champs, 1 ligne modifiée et 2 ajoutées', () => {
    const fichiers = fichiersDe(path.join(CONTENU, 'mesures'));
    for (const f of fichiers) {
      const avant = readFileSync(f, 'utf8');
      const apres = definirChamps(avant, [], RELU);
      verifierSeulesCles(avant, apres, [], RELU.map((c) => c.cle));
      const b = comparerLignes(avant, apres);
      assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [1, 2, 0], f);
      // Seconde relecture : remplacement, jamais de doublon.
      const deux = definirChamps(apres, [], [RELU[0], RELU[1], { cle: 'date_relecture', valeur: '2026-12-01' }]);
      assert.deepEqual(Object.values(comparerLignes(apres, deux)).slice(0, 3), [0, 1, 0], f);
    }
    console.log(`editer : ${fichiers.length} mesures réelles vérifiées`);
    assert.ok(fichiers.length >= 134, `${fichiers.length} mesures seulement`);
  });

  it('chaque candidat : statut retenu (preview), 3 champs sur statuts[i]', () => {
    const fichiers = fichiersDe(path.join(CONTENU, 'candidats'));
    for (const f of fichiers) {
      const avant = readFileSync(f, 'utf8');
      const statuts = (parse(avant, { schema: 'core' }) as { statuts: unknown[] }).statuts;
      const i = statuts.indexOf(statutRetenu(statuts, 'preview') as unknown);
      assert.ok(i >= 0, f);
      const apres = definirChamps(avant, ['statuts', i], RELU);
      verifierSeulesCles(avant, apres, ['statuts', i], RELU.map((c) => c.cle));
      const b = comparerLignes(avant, apres);
      assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [1, 2, 0], f);
    }
    console.log(`editer : ${fichiers.length} candidats réels vérifiés`);
    assert.ok(fichiers.length >= 59, `${fichiers.length} candidats seulement`);
  });

  it('chaque case de couverture : verifie_le et verifie_par, 2 lignes modifiées', () => {
    let cases = 0;
    for (const f of fichiersDe(path.join(CONTENU, 'couverture'))) {
      const avant = readFileSync(f, 'utf8');
      const n = (parse(avant, { schema: 'core' }) as { cases: unknown[] }).cases.length;
      for (let i = 0; i < n; i++) {
        const champs = [
          { cle: 'verifie_le', valeur: DATE },
          { cle: 'verifie_par', valeur: 'Erwan Henry' },
        ];
        const apres = definirChamps(avant, ['cases', i], champs);
        verifierSeulesCles(avant, apres, ['cases', i], ['verifie_le', 'verifie_par']);
        const b = comparerLignes(avant, apres);
        assert.deepEqual([b.modifiees, b.ajoutees, b.supprimees], [2, 0, 0], `${f} cases[${i}]`);
        cases++;
      }
    }
    console.log(`editer : ${cases} cases de couverture réelles vérifiées`);
    assert.ok(cases > 0);
  });
});
