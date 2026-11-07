// HEB-05 (D-04) : le nom d'hôte du site n'est écrit qu'une fois, dans config/site.yml. Ce test refuse ce domaine
// (et tout sous-domaine, l'hôte technique de la Phase 8 compris) dans tout autre fichier suivi par Git, pour qu'un
// changement de domaine ne laisse aucune copie périmée. Seul le domaine configuré est interdit : les centaines
// d'URL de sources (sites des candidats, data.gouv.fr, github.com, web.archive.org) restent permises sans liste
// blanche. Tant que le contact est une adresse du domaine provisoire, une copie de ce contact est refusée par le
// même balayage.
//
// Exclusions (documentées, rien d'autre) :
// - config/site.yml : la seule source du domaine ;
// - deploy/caddy/site.caddy : bloc généré depuis config/site.yml, couvert par son propre test de dérive (07-07) ;
// - .planning/ et docs/ : récits d'audit et de planification qui citent la valeur provisoire ;
// - archives/ : copies des sources primaires, jamais modifiées ;
// - tests/fixtures/ : corpus de test figés ;
// - fichiers binaires (octet NUL) ; node_modules, dist* et rapports ne sont pas suivis (ignorés par le repli aussi).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface FichierTexte {
  chemin: string;
  contenu: string;
}

export interface HoteEnDur {
  chemin: string;
  ligne: number;
  extrait: string;
}

/** Chemins exclus : égalité exacte pour un fichier, préfixe pour un dossier (« / » final). */
export const EXCLUSIONS: readonly string[] = ['config/site.yml', 'deploy/caddy/site.caddy', '.planning/', 'docs/', 'archives/', 'tests/fixtures/'];

const exclu = (chemin: string): boolean => EXCLUSIONS.some((e) => (e.endsWith('/') ? chemin.startsWith(e) : chemin === e));

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Ligne dont chaque échappement %XX est décodé (WR-04) : sans cela, le chiffre hexadécimal de « %40 » ou « %2F »
 * passe pour un caractère d'hôte et masque « contact%40exemple.test » ou « https%3A%2F%2Fexemple.test ». Décodage
 * répété (3 fois au plus) pour un double encodage (« %2540 ») ; un octet isolé d'une séquence UTF-8 devient une espace.
 */
export function vueDecodee(texte: string): string {
  let vue = texte;
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(vue); i++) {
    vue = vue.replace(/%[0-9a-f]{2}/gi, (h) => {
      try {
        return decodeURIComponent(h);
      } catch {
        return ' ';
      }
    });
  }
  return vue;
}

/**
 * Occurrences du domaine (ou d'un sous-domaine) dans des fichiers texte, insensible à la casse, sur des frontières
 * de nom d'hôte : un caractère d'hôte juste avant (« autre-exemple.test ») ou juste après (« exemple.test2 »,
 * « exemple.testeur.fr », « exemple.test.fr ») désigne un autre nom et n'est pas signalé. Chaque ligne est aussi lue
 * décodée (vueDecodee) : les copies encodées en pourcentage sont signalées. Fonction pure.
 */
export function trouverHotesEnDur(fichiers: readonly FichierTexte[], domaine: string): HoteEnDur[] {
  const motif = new RegExp(`(?<![a-z0-9-])(?:[a-z0-9-]+\\.)*${echapper(domaine)}(?![a-z0-9-]|\\.[a-z0-9-])`, 'gi');
  const out: HoteEnDur[] = [];
  for (const { chemin, contenu } of fichiers) {
    if (exclu(chemin) || contenu.includes('\u0000')) continue;
    const lignes = contenu.split('\n');
    lignes.forEach((texte, i) => {
      const trouve = [texte, vueDecodee(texte)].some((vue) => {
        motif.lastIndex = 0;
        return motif.test(vue);
      });
      if (trouve) out.push({ chemin, ligne: i + 1, extrait: texte.trim().slice(0, 120) });
    });
  }
  return out;
}

const IGNORES_REPLI = new Set(['node_modules', '.git', 'playwright-report', 'test-results', '.astro']);

/** Fichiers suivis par Git ; à défaut de Git, parcours du dossier sans node_modules, .git, dist*, rapports. */
function fichiersDuDepot(racine: string): string[] {
  const git = spawnSync('git', ['ls-files', '-z'], { cwd: racine, encoding: 'utf8' });
  if (git.status === 0 && git.stdout.length > 0) return git.stdout.split('\u0000').filter((f) => f !== '');
  const out: string[] = [];
  const visiter = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORES_REPLI.has(e.name) || e.name.startsWith('dist')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) visiter(abs);
      else if (e.isFile()) out.push(path.relative(racine, abs).split(path.sep).join('/'));
    }
  };
  visiter(racine);
  return out;
}

function lireDepot(racine: string): FichierTexte[] {
  const out: FichierTexte[] = [];
  for (const chemin of fichiersDuDepot(racine)) {
    if (exclu(chemin)) continue;
    const abs = path.join(racine, ...chemin.split('/'));
    // suivi mais supprimé de la copie de travail, ou lien symbolique vers un dossier : rien à lire
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const octets = fs.readFileSync(abs);
    if (octets.includes(0)) continue;
    out.push({ chemin, contenu: octets.toString('utf8') });
  }
  return out;
}

describe('trouverHotesEnDur : fautes injectées (domaine synthétique exemple.test)', () => {
  const D = 'exemple.test';
  const trouve = (contenu: string, chemin = 'src/x.ts'): HoteEnDur[] => trouverHotesEnDur([{ chemin, contenu }], D);

  for (const contenu of [
    `const url = 'https://${D}/x';`,
    `www.${D}`,
    `technique.${D}`,
    `contact@${D}`,
    D.toUpperCase(),
    `Voir https://Www.Exemple.Test/themes/.`,
    `fin de phrase : ${D}.`,
    `<loc>https://${D}/</loc>`,
    // WR-04 : copies encodées en pourcentage (lien mailto, URL passée en paramètre, double encodage, point encodé)
    `href="mailto:contact%40${D}"`,
    `https%3A%2F%2F${D}%2Fthemes%2F`,
    `?u=https%253A%252F%252F${D}`,
    `exemple%2Etest`,
  ]) {
    it(`signale « ${contenu} »`, () => {
      const r = trouve(contenu);
      assert.equal(r.length, 1, JSON.stringify(r));
      assert.deepEqual(r[0], { chemin: 'src/x.ts', ligne: 1, extrait: contenu.trim() });
    });
  }

  for (const contenu of [
    'exemple.testeur.fr',
    'exemple.test2',
    'autre-exemple.test',
    'https://exemple.test.fr/',
    'monexemple.test',
    'https://web.archive.org/web/2026/https://candidat.fr/',
    'https://www.data.gouv.fr/fr/datasets/x/ https://github.com/ErwanHenry/reveleTonProg',
    'exemple test',
    'https%3A%2F%2Fautre-exemple.test%2F',
    'contact%40exemple.testeur.fr',
    '100%25 exemple',
    '%E9t%E9 exemple test',
  ]) {
    it(`ne signale pas « ${contenu} »`, () => {
      assert.deepEqual(trouve(contenu), []);
    });
  }

  it('numéro de ligne et extrait de chaque occurrence, plusieurs fichiers', () => {
    const r = trouverHotesEnDur(
      [
        { chemin: 'a.md', contenu: `titre\n\n  lien https://${D}/a  \nautre` },
        { chemin: 'b/c.ts', contenu: `x\ny = '${D}'` },
      ],
      D,
    );
    assert.deepEqual(r, [
      { chemin: 'a.md', ligne: 3, extrait: `lien https://${D}/a` },
      { chemin: 'b/c.ts', ligne: 2, extrait: `y = '${D}'` },
    ]);
  });

  it('chemins exclus ignorés, frontières de dossier respectées', () => {
    const contenu = `https://${D}/`;
    for (const chemin of ['config/site.yml', 'deploy/caddy/site.caddy', '.planning/STATE.md', 'docs/RUNBOOK.md', 'archives/x/a.txt', 'tests/fixtures/corpus-m1/a.yaml']) {
      assert.deepEqual(trouve(contenu, chemin), [], chemin);
    }
    for (const chemin of ['config/site.yml.bak', 'config/autre.yml', 'deploy/caddy/autre.caddy', 'docs-x/a.md', 'tests/fixturesx/a.ts', 'src/docs/a.ts']) {
      assert.equal(trouve(contenu, chemin).length, 1, chemin);
    }
  });

  it('contenu binaire (octet NUL) ignoré', () => {
    assert.deepEqual(trouve(`\u0000PNG https://${D}/`), []);
  });

  it('le domaine est échappé : « . » ne vaut pas n’importe quel caractère', () => {
    assert.deepEqual(trouve('exempleXtest'), []);
  });
});

describe('dépôt réel : aucun nom d’hôte du site hors de config/site.yml (HEB-05)', () => {
  it('git ls-files, domaine de config/site.yml : aucune occurrence', () => {
    // Env vide : on lit la valeur configurée sans évaluer la garde de déploiement (RTP_DEPLOIEMENT=1 exporté).
    const { domaine } = loadSiteConfig(REPO, {});
    const fichiers = lireDepot(REPO);
    assert.ok(fichiers.length > 100, `trop peu de fichiers lus : ${fichiers.length}`);
    assert.ok(fichiers.some((f) => f.chemin === 'tests/repo/hote-en-dur.test.ts'), 'ce test ne s’est pas lu lui-même');
    const trouves = trouverHotesEnDur(fichiers, domaine);
    assert.deepEqual(
      trouves.map((t) => `${t.chemin}:${t.ligne}`),
      [],
      `nom d'hôte du site écrit en dur (le lire avec loadSiteConfig, ou exemple.test dans un test) :\n${trouves
        .map((t) => `  ${t.chemin}:${t.ligne} ${t.extrait}`)
        .join('\n')}`,
    );
  });
});
