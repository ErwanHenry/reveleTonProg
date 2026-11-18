// Gardes qui précèdent un déploiement local (D-04) : arbre propre, tête de origin/main, classement site ou hors
// site par ops/site-touche.sh, tête admise (approbation périmée du job deploy), gel (CR-02), reçu de ci:local.
// Dépôts git temporaires avec une identité locale ; le dossier personnel des reçus est un dossier temporaire.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { lancer } from '../../scripts/lib/processus.ts';
import { ETAPES, ecrireRecu, type Recu } from '../../scripts/lib/ci-local.ts';
import {
  Sortie,
  arbrePropre,
  decisionGel,
  lireCheminsHorsSite,
  siteTouche,
  teteAdmise,
  teteOrigine,
  verifierRecu,
} from '../../scripts/lib/deploiement/gardes.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTE_CI = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const CHEMINS = (parse(TEXTE_CI) as { env: Record<string, string> }).env.CHEMINS_HORS_SITE as string;

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
function temp(prefixe = 'rtp-gardes-'): string {
  const d = mkdtempSync(path.join(tmpdir(), prefixe));
  dossiers.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}

function depot(): string {
  const d = temp();
  git(d, 'init', '--quiet', '-b', 'main');
  git(d, 'config', 'user.email', 't@exemple.invalid');
  git(d, 'config', 'user.name', 'Test');
  git(d, 'config', 'commit.gpgsign', 'false');
  return d;
}

function commit(d: string, fichiers: Record<string, string>, message = 'c'): string {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    const p = path.join(d, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, contenu);
    git(d, 'add', '--', rel);
  }
  git(d, 'commit', '--quiet', '-m', message);
  return git(d, 'rev-parse', 'HEAD');
}

describe('Sortie', () => {
  it('porte son code', () => {
    const s = new Sortie(2, 'x');
    assert.equal(s.code, 2);
    assert.equal(s.message, 'x');
    assert.ok(s instanceof Error);
  });
});

describe('lireCheminsHorsSite', () => {
  it('lit sur le vrai ci.yml la valeur de l’analyse YAML', () => {
    assert.equal(lireCheminsHorsSite(TEXTE_CI), CHEMINS);
  });
  it('ligne absente : erreur', () => {
    assert.throws(() => lireCheminsHorsSite('env:\n  AUTRE: "x"\n'), /CHEMINS_HORS_SITE/);
  });
  it('ligne en double : erreur', () => {
    assert.throws(() => lireCheminsHorsSite('env:\n  CHEMINS_HORS_SITE: "docs/"\n  CHEMINS_HORS_SITE: "tests/"\n'), /CHEMINS_HORS_SITE/);
  });
});

describe('siteTouche', () => {
  const d = depot();
  const c0 = commit(d, { 'src/a.astro': 'a', 'docs/a.md': 'a' });
  const c1 = commit(d, { 'docs/b.md': 'b' });
  const c2 = commit(d, { 'src/a.astro': 'a2' });
  git(d, 'checkout', '--quiet', '-b', 'autre', c0);
  const cAutre = commit(d, { 'docs/c.md': 'c' });
  git(d, 'checkout', '--quiet', 'main');

  it('documentation seule : false, fichiers listés', async () => {
    const r = await siteTouche(lancer, d, c0, c1, CHEMINS);
    assert.equal(r.touche, false);
    assert.deepEqual(r.fichiers, ['docs/b.md']);
  });
  it('changement de src : true', async () => {
    const r = await siteTouche(lancer, d, c1, c2, CHEMINS);
    assert.equal(r.touche, true);
    assert.deepEqual(r.fichiers, ['src/a.astro']);
  });
  it('base null : true par prudence, avec la raison', async () => {
    const r = await siteTouche(lancer, d, null, c2, CHEMINS);
    assert.equal(r.touche, true);
    assert.match(r.raison, /aucune version/);
  });
  it('base inconnue : true par prudence', async () => {
    const r = await siteTouche(lancer, d, 'f'.repeat(40), c2, CHEMINS);
    assert.equal(r.touche, true);
    assert.match(r.raison, /introuvable/);
  });
  it('base qui n’est pas un ancêtre : true par prudence', async () => {
    const r = await siteTouche(lancer, d, cAutre, c1, CHEMINS);
    assert.equal(r.touche, true);
    assert.match(r.raison, /ancêtre/);
  });
  it('liste vide : erreur (site-touche répond 2)', async () => {
    await assert.rejects(siteTouche(lancer, d, c0, c1, ''), /site-touche/);
  });
});

describe('teteAdmise (approbation périmée du job deploy)', () => {
  const d = depot();
  const c0 = commit(d, { 'src/a.astro': 'a' });
  const c1 = commit(d, { 'docs/b.md': 'b' });
  const c2 = commit(d, { 'src/a.astro': 'a2' });
  git(d, 'checkout', '--quiet', '-b', 'autre', c0);
  const cAutre = commit(d, { 'docs/c.md': 'c' });
  git(d, 'checkout', '--quiet', 'main');

  it('commit égal à la tête : admis', async () => {
    const r = await teteAdmise(lancer, d, c1, c1, CHEMINS);
    assert.equal(r.ok, true);
  });
  it('tête qui descend du commit, documentation seule : admise', async () => {
    const r = await teteAdmise(lancer, d, c0, c1, CHEMINS);
    assert.equal(r.ok, true);
    assert.match(r.motif, /tête plus récente sans changement du site/);
  });
  it('tête qui descend du commit avec un changement de src : refusée', async () => {
    const r = await teteAdmise(lancer, d, c1, c2, CHEMINS);
    assert.equal(r.ok, false);
    assert.match(r.motif, /changements du site/);
  });
  it('tête qui ne descend pas du commit : refusée', async () => {
    const r = await teteAdmise(lancer, d, cAutre, c2, CHEMINS);
    assert.equal(r.ok, false);
    assert.match(r.motif, /ne descend pas/);
  });
});

describe('decisionGel (CR-02)', () => {
  const pendant = new Date('2027-04-18T12:00:00+02:00');
  it('jour du premier tour : refusé', () => {
    const g = decisionGel(pendant, false, '');
    assert.equal(g.ok, false);
    assert.equal(g.gele, true);
  });
  it('urgence avec 25 caractères : autorisé', () => {
    const g = decisionGel(pendant, true, 'x'.repeat(25));
    assert.equal(g.ok, true);
  });
  it('urgence avec 5 caractères : refusé', () => {
    const g = decisionGel(pendant, true, 'court');
    assert.equal(g.ok, false);
  });
  it('justification sur plusieurs lignes nettoyée avant d’être comptée', () => {
    const g = decisionGel(pendant, true, '\n\n\n   \t\t\t\n\n\n   ab');
    assert.equal(g.ok, false);
  });
});

describe('arbrePropre', () => {
  function base(): string {
    const d = depot();
    writeFileSync(path.join(d, '.gitignore'), 'ignore.txt\n');
    commit(d, { 'a.txt': 'a', '.gitignore': 'ignore.txt\n' });
    return d;
  }
  it('arbre propre : true, même avec un fichier ignoré', async () => {
    const d = base();
    writeFileSync(path.join(d, 'ignore.txt'), 'x');
    assert.equal(await arbrePropre(lancer, d), true);
  });
  it('fichier non suivi non ignoré : false', async () => {
    const d = base();
    writeFileSync(path.join(d, 'nouveau.txt'), 'x');
    assert.equal(await arbrePropre(lancer, d), false);
  });
  it('changement indexé : false', async () => {
    const d = base();
    writeFileSync(path.join(d, 'a.txt'), 'b');
    git(d, 'add', 'a.txt');
    assert.equal(await arbrePropre(lancer, d), false);
  });
  it('changement non indexé : false', async () => {
    const d = base();
    writeFileSync(path.join(d, 'a.txt'), 'b');
    assert.equal(await arbrePropre(lancer, d), false);
  });
  it('dossier qui n’est pas un dépôt : Sortie code 2', async () => {
    const d = temp();
    await assert.rejects(arbrePropre(lancer, d), (e: unknown) => e instanceof Sortie && e.code === 2);
  });
});

describe('teteOrigine', () => {
  it('origine nue joignable : fetchOk true, tête de main', async () => {
    const nu = temp();
    git(nu, 'init', '--quiet', '--bare', '-b', 'main');
    const d = depot();
    const c = commit(d, { 'a.txt': 'a' });
    git(d, 'remote', 'add', 'origin', nu);
    git(d, 'push', '--quiet', 'origin', 'main');
    // Un commit poussé par ailleurs : la tête locale de origin/main est en retard avant le fetch.
    const autre = temp();
    git(autre, 'clone', '--quiet', nu, '.');
    git(autre, 'config', 'user.email', 't@exemple.invalid');
    git(autre, 'config', 'user.name', 'Test');
    const c2 = commit(autre, { 'b.txt': 'b' });
    git(autre, 'push', '--quiet', 'origin', 'main');
    assert.notEqual(c, c2);
    const r = await teteOrigine(lancer, d);
    assert.deepEqual(r, { tete: c2, fetchOk: true });
  });
  it('origine injoignable : fetchOk false', async () => {
    const d = depot();
    commit(d, { 'a.txt': 'a' });
    git(d, 'remote', 'add', 'origin', path.join(temp(), 'absent.git'));
    const r = await teteOrigine(lancer, d);
    assert.equal(r.fetchOk, false);
  });
});

describe('verifierRecu', () => {
  const sha = 'a'.repeat(40);
  it('aucun reçu : refusé, motif avec le commit court', () => {
    const home = temp();
    const r = verifierRecu(home, sha);
    assert.deepEqual(r, { ok: false, motif: `aucun reçu de ci:local pour ${sha.slice(0, 12)}`, date: null });
  });
  it('reçu vert : admis avec sa date', () => {
    const home = temp();
    const recu: Recu = {
      version: 1,
      commit: sha,
      date: '2026-11-18T10:00:00.000Z',
      node: 'v24.22.2',
      arbre_propre: true,
      partiel: false,
      base_ids: null,
      secrets: 'ok',
      gitleaks: '8.30.1',
      etapes: ETAPES.map((e) => ({ id: e.id, nomCi: e.nomCi, resultat: 'ok' as const, duree_ms: 1 })),
    };
    ecrireRecu(home, recu);
    const r = verifierRecu(home, sha);
    assert.equal(r.ok, true);
    assert.equal(r.date, '2026-11-18T10:00:00.000Z');
  });
  it('reçu partiel : refusé', () => {
    const home = temp();
    const recu: Recu = {
      version: 1,
      commit: sha,
      date: '2026-11-18T10:00:00.000Z',
      node: 'v24.22.2',
      arbre_propre: true,
      partiel: true,
      base_ids: null,
      secrets: 'ok',
      gitleaks: '8.30.1',
      etapes: [],
    };
    ecrireRecu(home, recu);
    const r = verifierRecu(home, sha);
    assert.equal(r.ok, false);
    assert.match(r.motif, /partielle/);
  });
});
