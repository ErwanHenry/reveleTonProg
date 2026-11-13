// IMP-01 (D-02) : l'analyseur plafonné léger des scripts (src/lib/content-core/yaml-plafonne.ts).
// Cas unitaires (refus, positions, message plafonné à trois positions) puis test d'équivalence : les mêmes
// entrées hostiles passent par parseYaml de load.ts et par analyserYamlPlafonne, et les diagnostics doivent être
// identiques champ par champ. Ce fichier de test peut importer load.ts (les tests sont hors du balayage de dépôt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../src/lib/content-core/load.ts';
import {
  YamlRefuse,
  analyserYamlPlafonne,
  lireDocumentPlafonne,
  lireYamlPlafonne,
  messageRefus,
} from '../../src/lib/content-core/yaml-plafonne.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const F = 'src/content/candidats/essai.yaml';

/** Bombe d'alias : six niveaux, neuf alias par niveau (45 alias). */
function bombeAlias(): string {
  const lignes = ['a: &a ["x","x","x","x","x","x","x","x","x"]'];
  const noms = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let i = 1; i < noms.length; i++) {
    const prec = noms[i - 1];
    lignes.push(`${noms[i]}: &${noms[i]} [${Array(9).fill(`*${prec}`).join(',')}]`);
  }
  return lignes.join('\n') + '\n';
}

const ENTREES: Record<string, string> = {
  valide: 'nom: Essai\ndate: 2026-11-03\noui: no\n',
  aliasBenin: 'parti: &p Parti essai\nnom: Essai\nx: *p\n',
  bombe: bombeAlias(),
  doublon: 'a: 1\nb: 2\na: 3\n',
  listeRacine: '- a\n- b\n',
  vide: '',
  deuxDocuments: 'a: 1\n---\nb: 2\n',
  baliseInconnue: 'b: !foo bar\n',
  fusion: 'base: &x\n  k: 1\nautre:\n  <<: *x\n',
  indentation: 'a:\n  b: 1\n c: 2\n',
};

function attraper(fn: () => unknown): YamlRefuse {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof YamlRefuse, `YamlRefuse attendue, reçu ${String(e)}`);
    return e;
  }
  assert.fail('YamlRefuse attendue, rien levé');
}

describe('analyserYamlPlafonne : cas unitaires', () => {
  it('objet valide : dates et « no » restent des chaînes, aucun diagnostic', () => {
    const r = analyserYamlPlafonne(ENTREES.valide!, F);
    assert.deepEqual(r.diagnostics, []);
    assert.deepEqual(r.data, { nom: 'Essai', date: '2026-11-03', oui: 'no' });
    assert.deepEqual(lireYamlPlafonne(ENTREES.valide!, F), { nom: 'Essai', date: '2026-11-03', oui: 'no' });
    assert.equal(lireDocumentPlafonne(ENTREES.valide!, F).toString(), ENTREES.valide);
  });

  it('un seul alias bénin : YAML_ALIAS_INTERDIT avec ligne et colonne, data absente', () => {
    const r = analyserYamlPlafonne(ENTREES.aliasBenin!, F);
    assert.equal(r.data, undefined);
    assert.equal(r.diagnostics.length, 1);
    assert.equal(r.diagnostics[0]?.code, 'YAML_ALIAS_INTERDIT');
    assert.equal(r.diagnostics[0]?.line, 3);
    assert.equal(r.diagnostics[0]?.col, 4);
    const e = attraper(() => lireYamlPlafonne(ENTREES.aliasBenin!, F));
    assert.equal(e.name, 'YamlRefuse');
    assert.equal(e.message, `${F}:3:4 YAML_ALIAS_INTERDIT les alias YAML (*nom) sont interdits : répéter la valeur`);
    assert.equal(e.diagnostics.length, 1);
    attraper(() => lireDocumentPlafonne(ENTREES.aliasBenin!, F));
  });

  it('bombe d’alias : refusée, trois positions puis « (+N autre(s)) »', () => {
    const r = analyserYamlPlafonne(ENTREES.bombe!, F);
    assert.equal(r.data, undefined);
    assert.equal(r.diagnostics.length, 45);
    assert.ok(r.diagnostics.every((d) => d.code === 'YAML_ALIAS_INTERDIT'));
    const e = attraper(() => lireYamlPlafonne(ENTREES.bombe!, F));
    const positions = e.message.match(/essai\.yaml:\d+:\d+ YAML_ALIAS_INTERDIT/g) ?? [];
    assert.equal(positions.length, 3);
    assert.ok(e.message.endsWith(` (+${r.diagnostics.length - 3} autre(s))`), e.message);
    assert.equal(e.message.split(' ; ').length, 3);
  });

  it('clé en double : YAML_DUPLICATE_KEY, sa ligne, « clé en double »', () => {
    const e = attraper(() => lireYamlPlafonne(ENTREES.doublon!, F));
    assert.equal(e.diagnostics[0]?.code, 'YAML_DUPLICATE_KEY');
    assert.equal(e.diagnostics[0]?.line, 3);
    assert.match(e.message, /^src\/content\/candidats\/essai\.yaml:3:1 YAML_DUPLICATE_KEY clé en double/);
    attraper(() => lireDocumentPlafonne(ENTREES.doublon!, F));
  });

  it('liste à la racine et fichier vide : YAML_RACINE_NON_OBJET en 1:1', () => {
    for (const t of [ENTREES.listeRacine!, ENTREES.vide!]) {
      const e = attraper(() => lireYamlPlafonne(t, F));
      assert.equal(e.diagnostics[0]?.code, 'YAML_RACINE_NON_OBJET');
      assert.match(e.message, /^src\/content\/candidats\/essai\.yaml:1:1 YAML_RACINE_NON_OBJET /);
    }
  });

  it('deux documents : YAML_MULTIPLE_DOCS ; balise inconnue : YAML_TAG_RESOLVE_FAILED', () => {
    assert.ok(attraper(() => lireYamlPlafonne(ENTREES.deuxDocuments!, F)).diagnostics.some((d) => d.code === 'YAML_MULTIPLE_DOCS'));
    assert.equal(attraper(() => lireYamlPlafonne(ENTREES.baliseInconnue!, F)).diagnostics[0]?.code, 'YAML_TAG_RESOLVE_FAILED');
  });

  it('aucun message ne porte de pile d’appels', () => {
    for (const [nom, t] of Object.entries(ENTREES)) {
      if (nom === 'valide') continue;
      const e = attraper(() => lireYamlPlafonne(t, F));
      assert.doesNotMatch(e.message, /\n\s+at |\.ts:\d+:\d+\)/, nom);
      assert.ok(!e.message.includes('\n'), nom);
    }
  });

  it('messageRefus : max réglable, pas de suffixe quand tout est montré', () => {
    const d = analyserYamlPlafonne(ENTREES.bombe!, F).diagnostics;
    assert.equal(messageRefus(d.slice(0, 2)).split(' ; ').length, 2);
    assert.ok(!messageRefus(d.slice(0, 3)).includes('autre(s)'));
    assert.ok(messageRefus(d, 1).endsWith(' (+44 autre(s))'));
  });
});

describe('équivalence avec parseYaml de content-core (load.ts)', () => {
  const candidats = readdirSync(path.join(REPO_ROOT, 'src', 'content', 'candidats')).filter((n) => n.endsWith('.yaml')).sort();
  const reels: Record<string, [string, string]> = {
    candidat: [`src/content/candidats/${candidats[0]}`, readFileSync(path.join(REPO_ROOT, 'src', 'content', 'candidats', candidats[0]!), 'utf8')],
    couverture: ['data/couverture-themes.yaml', readFileSync(path.join(REPO_ROOT, 'data', 'couverture-themes.yaml'), 'utf8')],
  };
  const cas: [string, string, string][] = [
    ...Object.entries(ENTREES).map(([nom, t]): [string, string, string] => [nom, F, t]),
    ...Object.entries(reels).map(([nom, [f, t]]): [string, string, string] => [nom, f, t]),
  ];
  for (const [nom, fichier, texte] of cas) {
    it(`${nom} : mêmes diagnostics (code, gravité, fichier, ligne, colonne, pointeur, message) et mêmes données`, () => {
      const leger = analyserYamlPlafonne(texte, fichier);
      const coeur = parseYaml(texte, fichier);
      assert.deepEqual(leger.diagnostics, coeur.diagnostics);
      if (coeur.diagnostics.length === 0) assert.deepEqual(leger.data, coeur.data);
      else assert.equal(leger.data, undefined);
    });
  }

  it('les fichiers réels passent sans diagnostic', () => {
    for (const [f, t] of Object.values(reels)) assert.deepEqual(analyserYamlPlafonne(t, f).diagnostics, [], f);
  });
});
