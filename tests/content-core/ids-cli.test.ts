import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EN_TETE_IDS_LOCK, ajouterIds, comparerIdsLock, ecrireIdsLock, lireIdsLock } from '../../src/lib/content-core/ids-lock.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');

describe('ids-lock : lireIdsLock', () => {
  it('ignore commentaires et lignes vides, donne la ligne de chaque id', () => {
    const lock = lireIdsLock(`${EN_TETE_IDS_LOCK}\njean-imaginaire\nmarie-fictive\n`);
    assert.deepEqual(lock.ids, ['jean-imaginaire', 'marie-fictive']);
    assert.equal(lock.lignes.get('jean-imaginaire'), 4);
    assert.equal(lock.lignes.get('marie-fictive'), 5);
    assert.deepEqual(lock.problemes, []);
  });

  it('accepte les fins de ligne CRLF valides', () => {
    const lock = lireIdsLock('# c\r\njean-imaginaire\r\nmarie-fictive\r\n');
    assert.deepEqual(lock.ids, ['jean-imaginaire', 'marie-fictive']);
    assert.deepEqual(lock.problemes, []);
  });

  it('signale une ligne invalide, un doublon et un id non trié (IDS_LOCK_INVALIDE)', () => {
    const lock = lireIdsLock('marie-fictive\nMarie Fictive\nmarie-fictive\naaa-bbb\n');
    assert.deepEqual(
      lock.problemes.map((p) => [p.code, p.ligne]),
      [
        ['IDS_LOCK_INVALIDE', 2],
        ['IDS_LOCK_INVALIDE', 3],
        ['IDS_LOCK_INVALIDE', 4],
      ],
    );
  });
});

describe('ids-lock : comparerIdsLock', () => {
  it('sans verrou : rien à dire sans candidat, IDS_LOCK_ABSENT sinon', () => {
    assert.deepEqual(comparerIdsLock(undefined, []), []);
    const p = comparerIdsLock(undefined, ['a-b']);
    assert.equal(p.length, 1);
    assert.equal(p[0]?.code, 'IDS_LOCK_ABSENT');
    assert.equal(p[0]?.ligne, 1);
  });

  it('id verrouillé sans candidat : ID_VERROUILLE_DISPARU à sa ligne', () => {
    const lock = lireIdsLock('# t\naaa-bbb\nccc-ddd\n');
    const p = comparerIdsLock(lock, ['aaa-bbb']);
    assert.equal(p.length, 1);
    assert.equal(p[0]?.code, 'ID_VERROUILLE_DISPARU');
    assert.equal(p[0]?.ligne, 3);
    assert.equal(p[0]?.id, 'ccc-ddd');
    assert.match(p[0]?.message ?? '', /interdit/);
  });

  it('candidat hors verrou : ID_NON_VERROUILLE qui cite npm run ids -- --write', () => {
    const p = comparerIdsLock(lireIdsLock('aaa-bbb\n'), ['aaa-bbb', 'eee-fff']);
    assert.equal(p.length, 1);
    assert.equal(p[0]?.code, 'ID_NON_VERROUILLE');
    assert.equal(p[0]?.id, 'eee-fff');
    assert.match(p[0]?.message ?? '', /npm run ids -- --write/);
  });

  it('inclut les problèmes de lecture et trie par ligne puis code', () => {
    const lock = lireIdsLock('zzz-aaa\naaa-bbb\n');
    const p = comparerIdsLock(lock, ['zzz-aaa', 'nnn-ooo']);
    assert.deepEqual(
      p.map((x) => [x.ligne, x.code]),
      [
        [1, 'ID_NON_VERROUILLE'],
        [2, 'IDS_LOCK_INVALIDE'],
        [2, 'ID_VERROUILLE_DISPARU'],
      ],
    );
  });
});

describe('ids-lock : ecrireIdsLock et ajouterIds', () => {
  it('trie, dédoublonne et ajoute l\'en-tête', () => {
    assert.equal(ecrireIdsLock(['marie-fictive', 'jean-imaginaire', 'marie-fictive']), `${EN_TETE_IDS_LOCK}jean-imaginaire\nmarie-fictive\n`);
    assert.equal(ecrireIdsLock([]), EN_TETE_IDS_LOCK);
  });

  it('reproduit octet pour octet les ids.lock versionnés', () => {
    assert.equal(ecrireIdsLock(['jean-imaginaire', 'marie-fictive']), readFileSync(path.join(FIXTURE_ROOT, 'ids.lock'), 'utf8'));
    assert.equal(ecrireIdsLock([]), readFileSync(path.join(REPO_ROOT, 'ids.lock'), 'utf8'));
  });

  it('ajoute les nouveaux ids en conservant les anciens', () => {
    const res = ajouterIds(lireIdsLock('aaa-bbb\nmmm-nnn\n'), ['aaa-bbb', 'mmm-nnn', 'ccc-ddd']);
    assert.ok('texte' in res);
    assert.deepEqual(res.ajoutes, ['ccc-ddd']);
    assert.equal(res.texte, `${EN_TETE_IDS_LOCK}aaa-bbb\nccc-ddd\nmmm-nnn\n`);
  });

  it('refuse si un id verrouillé a disparu ou si le verrou est invalide', () => {
    const disparu = ajouterIds(lireIdsLock('aaa-bbb\nmmm-nnn\n'), ['aaa-bbb']);
    assert.ok('refus' in disparu);
    assert.equal(disparu.refus[0]?.code, 'ID_VERROUILLE_DISPARU');
    const invalide = ajouterIds(lireIdsLock('pas valide\n'), []);
    assert.ok('refus' in invalide);
    assert.equal(invalide.refus[0]?.code, 'IDS_LOCK_INVALIDE');
  });

  it('crée un verrou à partir de rien', () => {
    const res = ajouterIds(undefined, ['marie-fictive']);
    assert.ok('texte' in res);
    assert.equal(res.texte, `${EN_TETE_IDS_LOCK}marie-fictive\n`);
  });
});

const tmpDirs: string[] = [];
function tmpCopy(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-ids-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}
function tmpEmpty(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-ids-'));
  tmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const env = { ...process.env };
  delete env.RTP_CONTENT_ROOT;
  const res = spawnSync(process.execPath, ['scripts/ids.ts', ...args], { cwd: REPO_ROOT, encoding: 'utf8', env });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}
const candidat = (root: string, id: string): string => path.join(root, 'src', 'content', 'candidats', `${id}.yaml`);

describe('npm run ids (scripts/ids.ts)', () => {
  it('--check réussit sur le corpus fictif par défaut et sur la racine réelle', () => {
    const fixture = cli(['--check']);
    assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
    assert.match(fixture.stdout, /ids : 2 candidat\(s\), 2 verrouillé\(s\), 0 problème\(s\)/);
    const reel = cli(['--check', '--root', '.']);
    assert.equal(reel.status, 0, reel.stdout + reel.stderr);
    assert.match(reel.stdout, /ids : 0 candidat\(s\), 0 verrouillé\(s\), 0 problème\(s\) — racine \./);
  });

  it('candidat renommé : --check échoue (DISPARU + NON_VERROUILLE), --write refuse sans toucher le verrou', () => {
    const root = tmpCopy();
    renameSync(candidat(root, 'jean-imaginaire'), candidat(root, 'jean-imagine'));
    const lockPath = path.join(root, 'ids.lock');
    const avant = readFileSync(lockPath, 'utf8');
    const check = cli(['--check', '--root', root]);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /ids\.lock:3:1 ID_VERROUILLE_DISPARU/);
    assert.match(check.stdout, /jean-imagine\.yaml:1:1 ID_NON_VERROUILLE/);
    const write = cli(['--write', '--root', root]);
    assert.equal(write.status, 1);
    assert.match(write.stdout, /ID_VERROUILLE_DISPARU/);
    assert.equal(readFileSync(lockPath, 'utf8'), avant);
  });

  it('candidat supprimé : --check échoue avec ID_VERROUILLE_DISPARU', () => {
    const root = tmpCopy();
    rmSync(candidat(root, 'jean-imaginaire'));
    const check = cli(['--check', '--root', root]);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /ID_VERROUILLE_DISPARU/);
  });

  it('nouveau candidat : --check échoue, --write l\'ajoute trié, puis --check réussit', () => {
    const root = tmpCopy();
    cpSync(candidat(root, 'jean-imaginaire'), candidat(root, 'paul-exemple'));
    assert.equal(cli(['--check', '--root', root]).status, 1);
    const write = cli(['--write', '--root', root]);
    assert.equal(write.status, 0, write.stdout + write.stderr);
    assert.match(write.stdout, /1 id\(s\) ajouté\(s\)/);
    assert.equal(readFileSync(path.join(root, 'ids.lock'), 'utf8'), `${EN_TETE_IDS_LOCK}jean-imaginaire\nmarie-fictive\npaul-exemple\n`);
    assert.equal(cli(['--check', '--root', root]).status, 0);
    assert.equal(existsSync(path.join(root, `ids.lock.tmp-${process.pid}`)), false);
  });

  it('sans ids.lock : --check signale IDS_LOCK_ABSENT, --write crée le fichier', () => {
    const root = tmpCopy();
    rmSync(path.join(root, 'ids.lock'));
    const check = cli(['--check', '--root', root]);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /IDS_LOCK_ABSENT/);
    assert.equal(cli(['--write', '--root', root]).status, 0);
    assert.equal(readFileSync(path.join(root, 'ids.lock'), 'utf8'), `${EN_TETE_IDS_LOCK}jean-imaginaire\nmarie-fictive\n`);
  });

  it('ids.lock en lien symbolique : code 1, FICHIER_LIEN_SYMBOLIQUE, rien d\'écrit', () => {
    const root = tmpCopy();
    const cible = path.join(tmpEmpty(), 'cible.lock');
    writeFileSync(cible, 'zzz-zzz\n');
    rmSync(path.join(root, 'ids.lock'));
    symlinkSync(cible, path.join(root, 'ids.lock'));
    for (const flag of ['--check', '--write']) {
      const res = cli([flag, '--root', root]);
      assert.equal(res.status, 1, flag);
      assert.match(res.stdout, /FICHIER_LIEN_SYMBOLIQUE/);
    }
    assert.equal(readFileSync(cible, 'utf8'), 'zzz-zzz\n');
  });

  it('WR-02 : seule l’absence de ids.lock vaut « pas de verrou », les autres erreurs lstat se propagent', () => {
    // Une erreur EACCES/ENOTDIR/EIO ne se reproduit pas de façon portable sur un dossier de test
    // (la racine doit rester traversable pour lister le contenu) : on verrouille la forme du code.
    const src = readFileSync(path.join(REPO_ROOT, 'scripts', 'ids.ts'), 'utf8');
    assert.match(src, /lstatSync\(lockPath, \{ throwIfNoEntry: false \}\) === undefined/);
    assert.ok(!/lstatSync\(lockPath\);\s*\}\s*catch\s*\{\s*return undefined/.test(src), 'catch fourre-tout interdit');
  });

  it('racine introuvable : code 1 (RACINE_INTROUVABLE)', () => {
    const res = cli(['--check', '--root', path.join(tmpEmpty(), 'absent')]);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /RACINE_INTROUVABLE/);
  });

  it('erreurs d\'usage : code 2 et « Usage » sur stderr', () => {
    for (const args of [[], ['--check', '--write'], ['--check', '--inconnue']]) {
      const res = cli(args);
      assert.equal(res.status, 2, args.join(' '));
      assert.match(res.stderr, /Usage/);
    }
  });

  it('un dossier de candidats vide ne plante pas', () => {
    const root = tmpEmpty();
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    assert.equal(cli(['--check', '--root', root]).status, 0);
  });
});

describe('npm run ids -- --check --base <fichier> (ajout seul contre le commit de base)', () => {
  const base = (root: string): string => {
    const f = path.join(tmpEmpty(), 'ids-base.lock');
    cpSync(path.join(root, 'ids.lock'), f);
    return f;
  };

  it('verrou courant = base : code 0', () => {
    const root = tmpCopy();
    const res = cli(['--check', '--root', root, '--base', base(root)]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /0 problème\(s\)/);
  });

  it('une ligne retirée avec son fichier candidat : la vérification locale passe, --base échoue (ID_VERROUILLE_DISPARU)', () => {
    const root = tmpCopy();
    const fichierBase = base(root);
    rmSync(candidat(root, 'jean-imaginaire'));
    writeFileSync(path.join(root, 'ids.lock'), `${EN_TETE_IDS_LOCK}marie-fictive\n`);
    assert.equal(cli(['--check', '--root', root]).status, 0, 'sans --base, la suppression cohérente passe');
    const res = cli(['--check', '--root', root, '--base', fichierBase]);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /ids-base\.lock:3:1 ID_VERROUILLE_DISPARU/);
    assert.match(res.stdout, /jean-imaginaire/);
    assert.match(res.stdout, /retiré de ids\.lock depuis la base : interdit/);
  });

  it('un identifiant ajouté (avec son candidat) est accepté', () => {
    const root = tmpCopy();
    const fichierBase = base(root);
    cpSync(candidat(root, 'jean-imaginaire'), candidat(root, 'paul-exemple'));
    assert.equal(cli(['--write', '--root', root]).status, 0);
    const res = cli(['--check', '--root', root, '--base', fichierBase]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
  });

  it('--base sur un fichier introuvable ou combiné à --write : erreur d’usage (code 2)', () => {
    const root = tmpCopy();
    const absent = cli(['--check', '--root', root, '--base', path.join(tmpEmpty(), 'absent.lock')]);
    assert.equal(absent.status, 2);
    assert.match(absent.stderr, /Usage/);
    const ecriture = cli(['--write', '--root', root, '--base', base(root)]);
    assert.equal(ecriture.status, 2);
    assert.match(ecriture.stderr, /Usage/);
  });

  it('le ids.lock du corpus fictif est accepté comme sa propre base', () => {
    const res = cli(['--check', '--base', 'tests/fixtures/corpus-valide/ids.lock', '--root', 'tests/fixtures/corpus-valide']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
  });
});
