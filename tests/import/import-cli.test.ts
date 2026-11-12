import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { EN_TETE_IDS_LOCK } from '../../src/lib/content-core/ids-lock.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const IMPORT_DIR = path.join(REPO_ROOT, 'data', 'import');
const tmpDirs: string[] = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

/** Instantané le plus récent (mise_a_jour décroissante), hors .meta.json. */
function newestSnapshot(): string {
  const names = readdirSync(IMPORT_DIR)
    .filter((n) => /^2027etmoi-candidats-.*\.json$/.test(n) && !n.endsWith('.meta.json'))
    .sort();
  const last = names[names.length - 1];
  assert.ok(last, 'aucun instantané data/import/2027etmoi-candidats-*.json');
  return path.join(IMPORT_DIR, last);
}

/** Racine temporaire : src/content vide, ids.lock réduit à son en-tête, data/import copié. */
function tmpRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rtp-import-'));
  tmpDirs.push(root);
  mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
  writeFileSync(path.join(root, 'ids.lock'), EN_TETE_IDS_LOCK);
  cpSync(IMPORT_DIR, path.join(root, 'data', 'import'), { recursive: true });
  return root;
}

function importer(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, ['scripts/import-datagouv.ts', ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function snapshotRows(file: string): { id: string }[] {
  return (JSON.parse(readFileSync(file, 'utf8')) as { candidats: { id: string }[] }).candidats;
}

function fichiers(root: string): Map<string, Buffer> {
  const dir = path.join(root, 'src', 'content', 'candidats');
  const out = new Map<string, Buffer>();
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) out.set(n, readFileSync(path.join(dir, n)));
  return out;
}

/** Écrit une variante de l'instantané dans data/import de la racine temporaire et renvoie son chemin. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function muter(root: string, snap: string, fn: (j: { candidats: Record<string, any>[] }) => void): string {
  const j = JSON.parse(readFileSync(snap, 'utf8')) as { candidats: Record<string, unknown>[] };
  fn(j);
  const out = path.join(root, 'data', 'import', 'variante.json');
  writeFileSync(out, JSON.stringify(j));
  return out;
}

/** Ajoute un motif à la table à la main de la racine temporaire (le statut renonce l'exige). */
function ajouterMotif(root: string, amont: string, motif: string): void {
  const file = path.join(root, 'data', 'import', 'correspondances.yaml');
  const t = parse(readFileSync(file, 'utf8')) as { correspondances: Record<string, Record<string, unknown>> };
  (t.correspondances[amont] as Record<string, unknown>).motif = motif;
  writeFileSync(file, stringify(t));
}

describe('npm run import:datagouv (scripts/import-datagouv.ts)', () => {
  it('WR-03 : --url vers une adresse non publique est refusé avant tout réseau (SSRF)', () => {
    for (const cible of ['https://127.0.0.1/x.json', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x.json']) {
      const res = importer(['--url', cible, '--dry-run']);
      assert.equal(res.status, 1, cible);
      assert.match(res.stderr, /ADRESSE_PRIVEE/, cible);
    }
  });

  it('WR-08 : un fichier candidat au YAML invalide est un conflit nommé, sans rien écrire', () => {
    const snap = newestSnapshot();
    const id = snapshotRows(snap)[0]?.id;
    assert.ok(id);
    const root = tmpRoot();
    const file = path.join(root, 'data', 'import', path.basename(snap));
    // Créer d'abord toutes les fiches, puis casser celle d'un candidat connu.
    assert.equal(importer(['--file', file, '--root', root]).status, 0);
    const cible = path.join(root, 'src', 'content', 'candidats', readdirSync(path.join(root, 'src', 'content', 'candidats'))[0] as string);
    writeFileSync(cible, 'a: 1\na: 2\n  : [\n');
    const res = importer(['--file', file, '--root', root, '--dry-run']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.doesNotMatch(res.stderr + res.stdout, /at .*\.ts:\d+/, 'pas de pile d’appels');
    assert.match(res.stdout, /conflit : .* — fichier existant illisible/);
  });

  it('WR-08 : un fichier hors amont au YAML invalide ne fait pas échouer le rapport', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const file = path.join(root, 'data', 'import', path.basename(snap));
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'content', 'candidats', 'hors-amont.yaml'), 'a: 1\na: 2\n  : [\n');
    const res = importer(['--file', file, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /illisible .*hors-amont/);
  });

  it('crée une fiche valide par ligne de l’instantané et verrouille les identifiants', () => {
    const snap = newestSnapshot();
    const rows = snapshotRows(snap);
    const root = tmpRoot();
    const res = importer(['--file', path.join(root, 'data', 'import', path.basename(snap)), '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const created = fichiers(root);
    assert.equal(created.size, rows.length);
    const loaded = loadAll(root, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
    const errors = loaded.diagnostics.filter((d) => d.severity === 'error');
    assert.deepEqual(errors, []);
    const ids = [...created.keys()].map((n) => n.replace(/\.yaml$/, ''));
    const lock = readFileSync(path.join(root, 'ids.lock'), 'utf8')
      .split('\n')
      .filter((l) => l !== '' && !l.startsWith('#'));
    assert.deepEqual(lock, [...ids].sort());
  });

  it('un second passage identique ne change aucun octet et annonce 0 créé(s)', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const file = path.join(root, 'data', 'import', path.basename(snap));
    assert.equal(importer(['--file', file, '--root', root]).status, 0);
    const avant = fichiers(root);
    const lockAvant = readFileSync(path.join(root, 'ids.lock'));
    const second = importer(['--file', file, '--root', root]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /, 0 créé\(s\)/);
    const apres = fichiers(root);
    assert.deepEqual([...apres.keys()], [...avant.keys()]);
    for (const [name, buf] of avant) assert.ok(buf.equals(apres.get(name) as Buffer), `${name} modifié au second passage`);
    assert.ok(lockAvant.equals(readFileSync(path.join(root, 'ids.lock'))));
  });

  it('--dry-run n’écrit rien mais imprime le rapport ; option inconnue : code 2', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const dry = importer(['--file', path.join(root, 'data', 'import', path.basename(snap)), '--root', root, '--dry-run']);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /import : \d+ ligne\(s\)/);
    assert.equal(fichiers(root).size, 0);
    assert.equal(readFileSync(path.join(root, 'ids.lock'), 'utf8'), EN_TETE_IDS_LOCK);
    assert.equal(importer(['--inconnue']).status, 2);
  });

  it('un instantané hors data/import est copié avec son .meta.json', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    rmSync(path.join(root, 'data', 'import', path.basename(snap)));
    rmSync(path.join(root, 'data', 'import', path.basename(snap).replace(/\.json$/, '.meta.json')));
    const res = importer(['--file', snap, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const copie = path.join(root, 'data', 'import', path.basename(snap));
    assert.ok(readFileSync(copie).equals(readFileSync(snap)));
    const meta = JSON.parse(readFileSync(copie.replace(/\.json$/, '.meta.json'), 'utf8')) as Record<string, unknown>;
    assert.equal(meta.rows, snapshotRows(snap).length);
    assert.match(String(meta.sha256), /^[0-9a-f]{64}$/);
  });

  it('un statut qui change en amont est ajouté en fin de statuts[] sans toucher l’ancien', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    assert.equal(importer(['--file', path.join(root, 'data', 'import', path.basename(snap)), '--root', root]).status, 0);
    const fiche = path.join(root, 'src', 'content', 'candidats', 'jean-luc-melenchon.yaml');
    const avant = readFileSync(fiche, 'utf8');
    ajouterMotif(root, 'melenchon', 'retrait');
    const modif = muter(root, snap, (j) => {
      const r = j.candidats.find((x) => x.id === 'melenchon') as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2026-11-01';
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /statut ajouté : jean-luc-melenchon/);
    assert.match(res.stdout, /1 statut\(s\) ajouté\(s\)/);
    const apres = readFileSync(fiche, 'utf8');
    const ancien = (parse(avant) as { statuts: unknown[] }).statuts;
    const nouveau = (parse(apres) as { statuts: Record<string, unknown>[] }).statuts;
    assert.equal(nouveau.length, 2);
    assert.deepEqual(nouveau[0], ancien[0]);
    assert.equal(nouveau[1]?.code, 'renonce');
    assert.equal(nouveau[1]?.motif, 'retrait');
    assert.equal(nouveau[1]?.statut_relecture, 'brouillon');
    // L'entrée d'origine reste, octet pour octet, le début du bloc statuts du nouveau fichier.
    assert.ok(apres.includes(avant.slice(avant.indexOf('statuts:'))));
  });

  it('une date qui recule est un conflit : code 1, rien n’est écrit', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    assert.equal(importer(['--file', path.join(root, 'data', 'import', path.basename(snap)), '--root', root]).status, 0);
    const avant = fichiers(root);
    ajouterMotif(root, 'melenchon', 'retrait');
    const modif = muter(root, snap, (j) => {
      const r = j.candidats.find((x) => x.id === 'melenchon') as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2025-01-01';
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /conflit : jean-luc-melenchon — régression de date/);
    const apres = fichiers(root);
    for (const [name, buf] of avant) assert.ok(buf.equals(apres.get(name) as Buffer), `${name} modifié malgré le conflit`);
  });

  it('un id amont absent de la table : code 1, tous les ids listés, aucun fichier écrit', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const modif = muter(root, snap, (j) => {
      const modele = j.candidats[0] as Record<string, any>;
      j.candidats.push({ ...modele, id: 'nouveau-un' }, { ...modele, id: 'nouveau-deux' });
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /nouveau-un, nouveau-deux/);
    assert.equal(fichiers(root).size, 0);
    assert.equal(readFileSync(path.join(root, 'ids.lock'), 'utf8'), EN_TETE_IDS_LOCK);
  });

  it('une ligne retirée en amont : la fiche reste et le rapport la liste', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    assert.equal(importer(['--file', path.join(root, 'data', 'import', path.basename(snap)), '--root', root]).status, 0);
    const modif = muter(root, snap, (j) => {
      j.candidats = j.candidats.filter((x) => x.id !== 'brun');
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /absent en amont : philippe-brun/);
    assert.ok(existsSync(path.join(root, 'src', 'content', 'candidats', 'philippe-brun.yaml')));
    assert.match(readFileSync(path.join(root, 'ids.lock'), 'utf8'), /^philippe-brun$/m);
  });

  it('un jeu amont malformé : code 1 et rien d’écrit', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const modif = muter(root, snap, (j) => {
      delete (j.candidats[0] as Record<string, any>).statut;
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /statut/);
    assert.equal(fichiers(root).size, 0);
  });

  it('ignore RTP_CONTENT_ROOT : jamais d’écriture dans la fixture par défaut', () => {
    const res = spawnSync(process.execPath, ['scripts/import-datagouv.ts', '--file', newestSnapshot(), '--dry-run'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, RTP_CONTENT_ROOT: 'tests/fixtures/corpus-valide' },
    });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /racine \.(\s|$)/);
    const fixture = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'candidats');
    assert.ok(!existsSync(path.join(fixture, 'jean-luc-melenchon.yaml')));
  });
});

// IMP-01 (D-02) : chaque fichier YAML lu par l'import passe par l'analyseur plafonné (yaml-plafonne.ts), y compris
// une fiche dont l'action serait « inchangé ». Un refus nomme fichier, ligne, colonne et code ; rien n'est écrit.
describe('import : lectures YAML plafonnées (IMP-01)', () => {
  /** Tous les fichiers de la racine (chemin relatif -> octets), pour prouver que rien n'a été écrit. */
  function octetsRacine(root: string): Map<string, Buffer> {
    const out = new Map<string, Buffer>();
    for (const rel of (readdirSync(root, { recursive: true }) as string[]).sort()) {
      const full = path.join(root, rel);
      if (lstatSync(full).isFile()) out.set(rel, readFileSync(full));
    }
    return out;
  }
  function memesOctets(avant: Map<string, Buffer>, apres: Map<string, Buffer>): void {
    assert.deepEqual([...apres.keys()], [...avant.keys()]);
    for (const [n, b] of avant) assert.ok(b.equals(apres.get(n) as Buffer), `${n} modifié`);
  }
  /** Racine temporaire peuplée par un premier import réel (dans la racine temporaire seulement). */
  function racinePeuplee(): { root: string; snap: string } {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    assert.equal(importer(['--file', snap, '--root', root]).status, 0);
    return { root, snap };
  }
  /** Première fiche dont `nom` et `nom_tri` sont égaux (un alias bénin n'y change aucune valeur). */
  function ficheNomEgal(root: string): { id: string; file: string; texte: string; nom: string } {
    const dir = path.join(root, 'src', 'content', 'candidats');
    for (const n of readdirSync(dir).sort()) {
      const texte = readFileSync(path.join(dir, n), 'utf8');
      const m = /^nom: (.+)\nnom_tri: \1$/m.exec(texte);
      if (m) return { id: n.replace(/\.yaml$/, ''), file: path.join(dir, n), texte, nom: m[1] as string };
    }
    assert.fail('aucune fiche avec nom === nom_tri');
  }

  it('une fiche existante avec un seul alias bénin : code 1, conflit nommé avec fichier, ligne et code, rien d’écrit', () => {
    const { root, snap } = racinePeuplee();
    const f = ficheNomEgal(root);
    writeFileSync(f.file, f.texte.replace(`\nnom: ${f.nom}\nnom_tri: ${f.nom}\n`, `\nnom: &n ${f.nom}\nnom_tri: *n\n`));
    const avant = octetsRacine(root);
    const res = importer(['--file', snap, '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    const attendu = `conflit : ${f.id} — fichier existant illisible (src/content/candidats/${f.id}.yaml:`;
    assert.ok(res.stdout.includes(attendu), res.stdout);
    assert.match(res.stdout, new RegExp(`candidats/${f.id}\\.yaml:\\d+:\\d+ YAML_ALIAS_INTERDIT les alias YAML`));
    assert.match(res.stderr, /rien n'a été écrit/);
    memesOctets(avant, octetsRacine(root));
  });

  it('une fiche existante avec une clé en double : YAML_DUPLICATE_KEY, sa ligne et « clé en double »', () => {
    const { root, snap } = racinePeuplee();
    const f = ficheNomEgal(root);
    const lignes = f.texte.split('\n').length;
    writeFileSync(f.file, `${f.texte}id: ${f.id}\n`);
    const avant = octetsRacine(root);
    const res = importer(['--file', snap, '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, new RegExp(`candidats/${f.id}\\.yaml:${lignes}:1 YAML_DUPLICATE_KEY clé en double`));
    memesOctets(avant, octetsRacine(root));
  });

  it('une bombe d’alias dans une fiche : trois positions au plus puis « (+N autre(s)) »', () => {
    const { root, snap } = racinePeuplee();
    const f = ficheNomEgal(root);
    const lignes = ['a: &a ["x","x","x","x","x","x","x","x","x"]'];
    for (const [i, n] of ['b', 'c', 'd', 'e', 'f'].entries()) lignes.push(`${n}: &${n} [${Array(9).fill(`*${'abcde'[i]}`).join(',')}]`);
    writeFileSync(f.file, `${lignes.join('\n')}\n`);
    const res = importer(['--file', snap, '--root', root, '--dry-run']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    const ligne = res.stdout.split('\n').find((l) => l.startsWith(`conflit : ${f.id} `)) ?? '';
    assert.equal((ligne.match(/YAML_ALIAS_INTERDIT/g) ?? []).length, 3, ligne);
    assert.match(ligne, / \(\+42 autre\(s\)\)\)$/);
  });

  it('data/import/correspondances.yaml avec un alias : code 1, fichier, ligne et code sur stderr, rien d’écrit', () => {
    const root = tmpRoot();
    const corr = path.join(root, 'data', 'import', 'correspondances.yaml');
    const texte = readFileSync(corr, 'utf8');
    const remplace = texte.replace('    nom: Mélenchon\n    nom_tri: Mélenchon\n', '    nom: &m Mélenchon\n    nom_tri: *m\n');
    assert.notEqual(remplace, texte);
    writeFileSync(corr, remplace);
    const avant = octetsRacine(root);
    const res = importer(['--file', path.join(root, 'data', 'import', path.basename(newestSnapshot())), '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stderr, /data\/import\/correspondances\.yaml:\d+:\d+ YAML_ALIAS_INTERDIT/);
    assert.doesNotMatch(res.stderr, /at .*\.ts:\d+/);
    memesOctets(avant, octetsRacine(root));
  });

  it('une fiche hors amont avec une clé en double : code 0, la ligne « illisible » porte la raison', () => {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'content', 'candidats', 'hors-amont.yaml'), 'a: 1\na: 2\n');
    const res = importer(['--file', snap, '--root', root, '--dry-run']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /illisible .*hors-amont/);
    assert.match(res.stdout, /hors-amont \(src\/content\/candidats\/hors-amont\.yaml:2:1 YAML_DUPLICATE_KEY clé en double/);
  });
});
