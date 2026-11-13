import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { checkUpstream, mapRow, renderYaml } from '../../scripts/lib/datagouv.ts';
import type { UpstreamRow } from '../../scripts/lib/datagouv.ts';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { EN_TETE_IDS_LOCK } from '../../src/lib/content-core/ids-lock.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import { instantanePlusRecent } from '../../scripts/lib/instantane-depot.ts';

const IMPORT_DIR = path.join(REPO_ROOT, 'data', 'import');
const tmpDirs: string[] = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

/** Instantané le plus récent par (mise_a_jour, fetched_at), le même ordre que le contrôle E6 (WR-04 : jamais par nom). */
function newestSnapshot(): string {
  return instantanePlusRecent(REPO_ROOT);
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

// WR-11 : le dépôt est public. Un changement de statut, un retrait du jeu ou une date inventés ne portent jamais sur
// une personne réelle : ils portent sur `essai-fictif`, ajoutée à la racine temporaire (ligne amont et ligne de table).
const FICTIF = 'essai-fictif';

/** Ligne amont fictive, complète (aucun champ recopié d'une ligne réelle). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ligneFictive(over: Record<string, any> = {}): Record<string, any> {
  return {
    id: FICTIF,
    nom: 'Essai Fictif',
    parti: '',
    bloc: '',
    statut: 'declare',
    statut_detail: '',
    source: { titre: 'Annonce (fictive)', url: 'https://exemple.test/essai-fictif/annonce', date: '2026-10-01' },
    propositions: [],
    liens: {},
    verifie_le: '2026-11-09',
    ...over,
  };
}

/**
 * Instantané de base de la racine temporaire : les lignes réelles (lues, jamais modifiées) plus la ligne fictive,
 * et la ligne de table correspondante. Renvoie le chemin du JSON écrit sous data/import de la racine temporaire.
 */
function baseFictive(root: string, snap: string): string {
  const j = JSON.parse(readFileSync(snap, 'utf8')) as { candidats: Record<string, unknown>[] };
  j.candidats.push(ligneFictive());
  const out = path.join(root, 'data', 'import', 'base-fictive.json');
  writeFileSync(out, JSON.stringify(j));
  const table = path.join(root, 'data', 'import', 'correspondances.yaml');
  writeFileSync(
    table,
    `${readFileSync(table, 'utf8')}  ${FICTIF}:\n    id: ${FICTIF}\n    prenom: Essai\n    nom: Fictif\n    nom_tri: Fictif\n    type_source_statut: candidat\n`,
  );
  return out;
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
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    const fiche = path.join(root, 'src', 'content', 'candidats', `${FICTIF}.yaml`);
    const avant = readFileSync(fiche, 'utf8');
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2026-11-01';
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /statut ajouté : essai-fictif/);
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
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    const avant = fichiers(root);
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2025-01-01';
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /conflit : essai-fictif — régression de date/);
    const apres = fichiers(root);
    for (const [name, buf] of avant) assert.ok(buf.equals(apres.get(name) as Buffer), `${name} modifié malgré le conflit`);
  });

  it('WR-01 : un statut amont daté au mois dans le mois du dernier statut est un conflit, deux passages n’écrivent rien', () => {
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2026-10';
    });
    const avant = fichiers(root);
    for (const passage of [1, 2]) {
      const res = importer(['--file', modif, '--root', root]);
      assert.equal(res.status, 1, `passage ${passage} : ${res.stdout}${res.stderr}`);
      assert.match(res.stdout, /conflit : essai-fictif — date amont 2026-10 au mois seulement/);
      const apres = fichiers(root);
      for (const [name, buf] of avant) assert.ok(buf.equals(apres.get(name) as Buffer), `${name} modifié au passage ${passage}`);
    }
  });

  it('WR-01 : un statut amont de même date que le dernier est ajouté une fois, le second passage ne change rien', () => {
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
    });
    const un = importer(['--file', modif, '--root', root]);
    assert.equal(un.status, 0, un.stdout + un.stderr);
    assert.match(un.stdout, /1 statut\(s\) ajouté\(s\)/);
    const avant = fichiers(root);
    const deux = importer(['--file', modif, '--root', root]);
    assert.equal(deux.status, 0, deux.stdout + deux.stderr);
    assert.match(deux.stdout, /0 statut\(s\) ajouté\(s\)/);
    const apres = fichiers(root);
    for (const [name, buf] of avant) assert.ok(buf.equals(apres.get(name) as Buffer), `${name} modifié au second passage`);
  });

  it('un id amont absent de la table : code 1, tous les ids listés, aucun fichier écrit', () => {
    const snap = newestSnapshot();
    const root = tmpRoot();
    const modif = muter(root, snap, (j) => {
      j.candidats.push(ligneFictive({ id: 'nouveau-un' }), ligneFictive({ id: 'nouveau-deux' }));
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /nouveau-un, nouveau-deux/);
    assert.equal(fichiers(root).size, 0);
    assert.equal(readFileSync(path.join(root, 'ids.lock'), 'utf8'), EN_TETE_IDS_LOCK);
  });

  it('une ligne retirée en amont : la fiche reste et le rapport la liste', () => {
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    const modif = muter(root, base, (j) => {
      j.candidats = j.candidats.filter((x) => x.id !== FICTIF);
    });
    const res = importer(['--file', modif, '--root', root]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /absent en amont : essai-fictif/);
    assert.ok(existsSync(path.join(root, 'src', 'content', 'candidats', `${FICTIF}.yaml`)));
    assert.match(readFileSync(path.join(root, 'ids.lock'), 'utf8'), /^essai-fictif$/m);
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

// IMP-03 (D-06, D-04) : rapport Markdown, répétition à blanc tolérante aux identifiants inconnus, --check.
// Tout se passe sur des racines temporaires : le vrai dépôt n'est jamais écrit.
describe('import : --format, --dry-run tolérant et --check (IMP-03)', () => {
  function octets(root: string): Map<string, Buffer> {
    const out = new Map<string, Buffer>();
    for (const rel of (readdirSync(root, { recursive: true }) as string[]).sort()) {
      const full = path.join(root, rel);
      if (lstatSync(full).isFile()) out.set(rel, readFileSync(full));
    }
    return out;
  }
  function identiques(avant: Map<string, Buffer>, apres: Map<string, Buffer>): void {
    assert.deepEqual([...apres.keys()], [...avant.keys()]);
    for (const [n, b] of avant) assert.ok(b.equals(apres.get(n) as Buffer), `${n} modifié`);
  }
  function section(texte: string, titre: string): string {
    const i = texte.indexOf(`${titre}\n`);
    assert.ok(i >= 0, `section absente : ${titre}`);
    const reste = texte.slice(i + titre.length + 1);
    const j = reste.search(/^(## |---$)/m);
    return (j < 0 ? reste : reste.slice(0, j)).trim();
  }
  /** Copie du dépôt réduite à ce que lit --check (jamais le vrai dépôt : le chargeur mémorise par racine). */
  function copieDepot(): string {
    const racine = mkdtempSync(path.join(os.tmpdir(), 'rtp-check-'));
    tmpDirs.push(racine);
    mkdirSync(path.join(racine, 'data'), { recursive: true });
    cpSync(IMPORT_DIR, path.join(racine, 'data', 'import'), { recursive: true });
    cpSync(path.join(REPO_ROOT, 'data', 'dataset-datagouv.yaml'), path.join(racine, 'data', 'dataset-datagouv.yaml'));
    mkdirSync(path.join(racine, 'src', 'content'), { recursive: true });
    cpSync(path.join(REPO_ROOT, 'src', 'content', 'candidats'), path.join(racine, 'src', 'content', 'candidats'), { recursive: true });
    return racine;
  }
  /**
   * Copie du dépôt avec la personne fictive (WR-11) : un nouvel instantané (lignes réelles, lues, plus la ligne
   * fictive `over`) avec sa méta au bon SHA-256, le pointeur mis à jour, la ligne de table et une fiche fictive dont
   * le statut est `statutFiche` (par défaut celui de l'amont). Toute incohérence inventée porte sur cette personne.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function copieDepotFictive(over: Record<string, any> = {}, statutFiche: Record<string, unknown> = {}): string {
    const racine = copieDepot();
    const j = JSON.parse(readFileSync(newestSnapshot(), 'utf8')) as { mise_a_jour: string; candidats: Record<string, unknown>[] };
    const ligne = ligneFictive(over);
    j.candidats.push(ligne);
    const octetsJson = Buffer.from(JSON.stringify(j));
    const sha = createHash('sha256').update(octetsJson).digest('hex');
    const nom = `2027etmoi-candidats-${j.mise_a_jour}-${sha.slice(0, 12)}`;
    const dossierImport = path.join(racine, 'data', 'import');
    writeFileSync(path.join(dossierImport, `${nom}.json`), octetsJson);
    const metaReelle = JSON.parse(readFileSync(newestSnapshot().replace(/\.json$/, '.meta.json'), 'utf8')) as Record<string, unknown>;
    const fetched = new Date(Date.parse(String(metaReelle.fetched_at)) + 60_000).toISOString();
    writeFileSync(path.join(dossierImport, `${nom}.meta.json`), JSON.stringify({ ...metaReelle, sha256: sha, bytes: octetsJson.byteLength, rows: j.candidats.length, fetched_at: fetched }));
    const ptr = path.join(racine, 'data', 'dataset-datagouv.yaml');
    writeFileSync(ptr, readFileSync(ptr, 'utf8').replace(/^instantane: .*$/m, `instantane: data/import/${nom}.json`));
    const table = path.join(dossierImport, 'correspondances.yaml');
    writeFileSync(table, `${readFileSync(table, 'utf8')}  ${FICTIF}:\n    id: ${FICTIF}\n    prenom: Essai\n    nom: Fictif\n    nom_tri: Fictif\n    type_source_statut: candidat\n`);
    const corr = { [FICTIF]: { id: FICTIF, prenom: 'Essai', nom: 'Fictif', nom_tri: 'Fictif', type_source_statut: 'candidat' as const } };
    const fiche = mapRow(checkUpstream({ mise_a_jour: j.mise_a_jour, candidats: [ligne] }).rows[0] as UpstreamRow, corr);
    const st = (fiche.statuts as Record<string, unknown>[])[0] as Record<string, unknown>;
    Object.assign(st, statutFiche);
    writeFileSync(path.join(racine, 'src', 'content', 'candidats', `${FICTIF}.yaml`), renderYaml(fiche));
    return racine;
  }
  function deuxInconnus(root: string, snap: string): string {
    return muter(root, snap, (j) => {
      j.candidats.push(ligneFictive({ id: 'nouveau-un', nom: 'Essai Fictif Un' }), ligneFictive({ id: 'nouveau-deux', nom: 'Essai Fictif Deux', statut: 'renonce' }));
    });
  }

  it('--dry-run avec deux ids inconnus : code 0, listés sous « Nouveaux à décider », aucun octet écrit', () => {
    const root = tmpRoot();
    const modif = deuxInconnus(root, newestSnapshot());
    const avant = octets(root);
    const res = importer(['--file', modif, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const s = section(res.stdout, '## Nouveaux à décider (absents de correspondances.yaml)');
    assert.match(s, /^- nouveau-deux : Essai Fictif Deux, renonce \(/m);
    assert.match(s, /^- nouveau-un : Essai Fictif Un, declare \(/m);
    // les autres lignes sont traitées normalement
    assert.equal((section(res.stdout, '## Nouveaux').match(/^- /gm) ?? []).length, snapshotRows(newestSnapshot()).length);
    identiques(avant, octets(root));
  });

  it('--dry-run en texte : ligne « à décider : » avec les deux identifiants, résumé et code 0', () => {
    const root = tmpRoot();
    const modif = deuxInconnus(root, newestSnapshot());
    const res = importer(['--file', modif, '--root', root, '--dry-run']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^à décider : nouveau-deux, nouveau-un$/m);
    assert.match(res.stdout, /simulation \(--dry-run\)/);
  });

  it('sans --dry-run, un id inconnu arrête tout même avec --format markdown', () => {
    const root = tmpRoot();
    const modif = deuxInconnus(root, newestSnapshot());
    const res = importer(['--file', modif, '--root', root, '--format', 'markdown']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /nouveau-un, nouveau-deux/);
    assert.equal(res.stdout, '');
    assert.equal(fichiers(root).size, 0);
  });

  /** Racine temporaire peuplée avec la personne fictive (WR-11) : toute mutation de statut porte sur elle. */
  function racineFictive(): { root: string; base: string } {
    const root = tmpRoot();
    const base = baseFictive(root, newestSnapshot());
    assert.equal(importer(['--file', base, '--root', root]).status, 0);
    return { root, base };
  }

  it('markdown : un statut qui change imprime la transition avec sa source et sa date', () => {
    const { root, base } = racineFictive();
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2026-11-01';
    });
    const avant = octets(root);
    const res = importer(['--file', modif, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^- essai-fictif : statut : declare \(2026-10-01\) -> renonce\/retrait \(2026-11-01\), source https:\/\/exemple\.test\/essai-fictif\/annonce du 2026-11-01$/m);
    assert.doesNotMatch(res.stdout, /[–—]/);
    identiques(avant, octets(root));
  });

  it('markdown : deux exécutions donnent les mêmes octets, rien d’autre que le rapport sur stdout', () => {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    const a = importer(['--file', snap, '--root', root, '--dry-run', '--format', 'markdown']);
    const b = importer(['--file', snap, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(a.stdout, b.stdout);
    assert.ok(a.stdout.startsWith('# Rapport de répétition à blanc'));
    assert.doesNotMatch(a.stdout, /^(import|créé|simulation) :/m);
  });

  it('--format markdown sans --dry-run écrit comme d’habitude et imprime le rapport', () => {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    const res = importer(['--file', snap, '--root', root, '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.ok(res.stdout.startsWith('# Rapport de répétition à blanc'));
    assert.equal(fichiers(root).size, snapshotRows(newestSnapshot()).length);
  });

  it('--format avec une autre valeur : code 2', () => {
    const res = importer(['--file', newestSnapshot(), '--dry-run', '--format', 'html']);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /--format/);
  });

  it('conflit en markdown : le rapport est imprimé (section Conflits) et le code est 1', () => {
    const { root, base } = racineFictive();
    ajouterMotif(root, FICTIF, 'retrait');
    const modif = muter(root, base, (j) => {
      const r = j.candidats.find((x) => x.id === FICTIF) as Record<string, any>;
      r.statut = 'renonce';
      r.source.date = '2025-01-01';
    });
    const res = importer(['--file', modif, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(section(res.stdout, '## Conflits'), /^- essai-fictif : régression de date/);
  });

  it('IN-02 : une fiche au YAML refusé est nommée dans le rapport Markdown, pas seulement en mode texte', () => {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'content', 'candidats', 'hors-amont.yaml'), 'a: 1\na: 2\n');
    const res = importer(['--file', snap, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(section(res.stdout, '## Instantané'), /^- fiches illisibles \(YAML refusé\), ignorées pour « Absents du jeu amont » : hors-amont \(src\/content\/candidats\/hors-amont\.yaml:2:1 YAML_DUPLICATE_KEY/m);
  });

  it('WR-03 : un fichier candidat refusé par le chargeur est nommé dans l’en-tête du rapport', () => {
    const root = tmpRoot();
    const snap = path.join(root, 'data', 'import', path.basename(newestSnapshot()));
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'content', 'candidats', 'hors-amont.yaml'), 'id: hors-amont\nchamp_inconnu: 1\n');
    const res = importer(['--file', snap, '--root', root, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(section(res.stdout, '## Instantané'), /^- fichiers refusés par le chargeur, absents du calcul des conséquences .* : src\/content\/candidats\/hors-amont\.yaml$/m);
  });

  it('dépôt réel en markdown : aucun nouveau, changé ni conflit, sections dans l’ordre, aucun tiret long', () => {
    const res = importer(['--file', newestSnapshot(), '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    for (const t of ['## Nouveaux', '## Changés', '## Conflits']) assert.equal(section(res.stdout, t), 'aucun', t);
    assert.match(res.stdout, /^## Absents du jeu amont$/m);
    assert.match(res.stdout, /^- fichiers refusés par le chargeur : aucun$/m);
    assert.doesNotMatch(res.stdout, /[–—]/);
  });

  it('--check sur une copie du dépôt : code 0 et « 0 écart »', () => {
    const res = importer(['--check', '--root', copieDepot()]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /cohérence instantané \/ fiches : 0 écart/);
  });

  it('--check sur une copie avec la personne fictive cohérente : code 0 (contrôle du montage WR-11)', () => {
    const res = importer(['--check', '--root', copieDepotFictive()]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /cohérence instantané \/ fiches : 0 écart/);
  });

  it('--check sur une copie dont un statut diffère : code 1 et une ligne d’écart', () => {
    const racine = copieDepotFictive({}, { code: 'pressenti' });
    const avant = octets(racine);
    const res = importer(['--check', '--root', racine]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.ok(res.stdout.includes(`${FICTIF} : statut : fichier=pressenti amont=declare`), res.stdout);
    assert.match(res.stdout, /cohérence instantané \/ fiches : 1 écart\(s\)/);
    identiques(avant, octets(racine));
  });

  it('WR-02 : date amont qui recule pour un statut inchangé : --check code 0 avec une information, la répétition la range en dérive', () => {
    const source = { type: 'candidat', titre: 'Annonce (fictive)', url: 'https://exemple.test/essai-fictif/annonce', date_publication: '2026-10-15', date_consultation: '2026-11-09' };
    const racine = copieDepotFictive({}, { date: '2026-10-15', source });
    const res = importer(['--check', '--root', racine]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^information : essai-fictif : source : .*\(2026-10-15\) amont=.*\(2026-10-01\) : même statut, date amont antérieure au fichier, source non appliquée$/m);
    assert.match(res.stdout, /cohérence instantané \/ fiches : 0 écart/);
    // même verdict côté outil : la fiche reste « inchangée », la ligne est sous « Dérives de source (information) »
    const snap = readFileSync(path.join(racine, 'data', 'dataset-datagouv.yaml'), 'utf8').match(/^instantane: (.*)$/m)?.[1] as string;
    const rep = importer(['--file', path.join(racine, snap), '--root', racine, '--dry-run', '--format', 'markdown']);
    assert.equal(rep.status, 0, rep.stdout + rep.stderr);
    assert.match(section(rep.stdout, '## Dérives de source (information)'), /^- essai-fictif : declare inchangé ; fichier \S+ du 2026-10-15 ; amont \S+ du 2026-10-01$/m);
    assert.equal(section(rep.stdout, '## Conflits'), 'aucun');
  });

  it('WR-10 : un jeu amont vide est refusé (code 1, rien d’écrit), même sans instantané précédent', () => {
    const root = tmpRoot();
    const vide = muter(root, newestSnapshot(), (j) => {
      j.candidats = [];
    });
    const avant = octets(root);
    const res = importer(['--file', vide, '--root', root]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stderr, /jeu amont vide ou tronqué : 0 ligne/);
    assert.match(res.stderr, /rien n'a été écrit/);
    identiques(avant, octets(root));
  });

  it('WR-10 : un jeu tronqué par rapport à l’instantané pointé est refusé, sauf --accepter-absents', () => {
    const racine = copieDepot();
    const tronque = muter(racine, newestSnapshot(), (j) => {
      j.candidats = j.candidats.slice(0, 10);
    });
    const avant = octets(racine);
    const res = importer(['--file', tronque, '--root', racine]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stderr, /jeu amont vide ou tronqué : 10 ligne\(s\) contre \d+ dans l’instantané précédent, \d+ identifiant\(s\) disparu\(s\) \(plus de 20 %\)/);
    assert.match(res.stderr, /--accepter-absents/);
    identiques(avant, octets(racine));
    // la répétition à blanc n'est pas refusée, mais le rapport l'annonce dans l'en-tête
    const rep = importer(['--file', tronque, '--root', racine, '--dry-run', '--format', 'markdown']);
    assert.equal(rep.status, 0, rep.stdout + rep.stderr);
    assert.match(section(rep.stdout, '## Instantané'), /^- garde de volume : \d+ identifiant\(s\) du jeu précédent absent\(s\) sur \d+, plus de 20 % : l’import réel refusera ce jeu sans --accepter-absents$/m);
    // l'option explicite d'Erwan laisse passer
    const ok = importer(['--file', tronque, '--root', racine, '--accepter-absents']);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /absent en amont : /);
  });

  it('WR-10 : un jeu légèrement plus court (sous le plafond) passe sans option', () => {
    const racine = copieDepot();
    const court = muter(racine, newestSnapshot(), (j) => {
      j.candidats = j.candidats.slice(0, j.candidats.length - 2);
    });
    const res = importer(['--file', court, '--root', racine, '--dry-run', '--format', 'markdown']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(section(res.stdout, '## Instantané'), /^- garde de volume : 2 identifiant\(s\) du jeu précédent absent\(s\) sur \d+, sous le plafond de 20 %$/m);
  });

  it('--check sur une copie dont le pointeur est périmé : code 1', () => {
    const racine = copieDepot();
    const ptr = path.join(racine, 'data', 'dataset-datagouv.yaml');
    const texte = readFileSync(ptr, 'utf8');
    const ancien = path.basename(newestSnapshot());
    // un instantané plus récent déposé sans mettre le pointeur à jour
    const json = JSON.parse(readFileSync(newestSnapshot(), 'utf8')) as Record<string, unknown>;
    json.mise_a_jour = '2026-11-09';
    const nom = '2027etmoi-candidats-2026-11-09-000000000000';
    writeFileSync(path.join(racine, 'data', 'import', `${nom}.json`), JSON.stringify(json));
    const meta = JSON.parse(readFileSync(path.join(IMPORT_DIR, ancien.replace(/\.json$/, '.meta.json')), 'utf8')) as Record<string, unknown>;
    writeFileSync(path.join(racine, 'data', 'import', `${nom}.meta.json`), JSON.stringify({ ...meta, mise_a_jour: '2026-11-09', fetched_at: '2026-11-12T10:00:00+01:00' }));
    assert.equal(readFileSync(ptr, 'utf8'), texte);
    const res = importer(['--check', '--root', racine]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /instantane : fichier=data\/import\/.* amont=data\/import\/2027etmoi-candidats-2026-11-09-000000000000\.json/);
  });

  it('--check refuse --file, --url, --dry-run et --format : code 2', () => {
    for (const autre of [['--file', newestSnapshot()], ['--url', 'https://exemple.test/x.json'], ['--dry-run'], ['--format', 'texte']]) {
      const res = importer(['--check', ...autre]);
      assert.equal(res.status, 2, autre.join(' '));
    }
  });
});
