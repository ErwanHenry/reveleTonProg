// PERF-02 (D-13) : bascule distante de playwright.config.ts. Sans E2E_BASE_URL, la configuration reste celle des
// tests locaux (serveur e2e/serveur.ts, quatre projets). Avec elle, le projet 4g mesure le vrai serveur : pas de
// serveur local, en-tête Authorization Basic envoyé d'emblée (extraHTTPHeaders) pour qu'aucun aller-retour 401 ne
// soit mesuré, httpCredentials gardé seulement en secours pour la lecture de version.json.
// La configuration est importée dans un processus enfant (son environnement est lu au chargement du module) ; le
// processus enfant n'imprime jamais le mot de passe en clair, seulement l'en-tête encodé et une égalité.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Identifiants factices construits à l'exécution (aucune valeur fixe dans le dépôt). */
const UTILISATEUR = 'sonde';
const MOT_DE_PASSE = `factice-${randomBytes(9).toString('hex')}`;
const BASE = 'https://essai.exemple.test';

const SONDE = `
const { pathToFileURL } = await import('node:url');
const cfg = (await import(pathToFileURL(process.argv[1]).href)).default;
const id = cfg.use?.httpCredentials;
console.log(JSON.stringify({
  webServer: cfg.webServer ?? null,
  baseURL: cfg.use?.baseURL ?? null,
  projets: (cfg.projects ?? []).map((p) => p.name),
  projet4g: (cfg.projects ?? []).find((p) => p.name === '4g')?.testMatch?.toString() ?? null,
  entetes: cfg.use?.extraHTTPHeaders ?? null,
  identifiants: id === undefined ? null : { cles: Object.keys(id).sort(), username: id.username, motDePasseEgal: id.password === process.env.E2E_PASS },
}));
`;

interface Lecture {
  status: number | null;
  sortie: string;
  erreur: string;
  config?: {
    webServer: { command?: string; url?: string; reuseExistingServer?: boolean } | null;
    baseURL: string | null;
    projets: string[];
    projet4g: string | null;
    entetes: Record<string, string> | null;
    identifiants: { cles: string[]; username: string; motDePasseEgal: boolean } | null;
  };
}

function lire(env: Record<string, string> = {}): Lecture {
  const propre: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(propre)) if (k.startsWith('E2E_')) delete propre[k];
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', SONDE, path.join(REPO, 'playwright.config.ts')], {
    cwd: REPO,
    env: { ...propre, ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  const sortie = r.stdout ?? '';
  const erreur = r.stderr ?? '';
  const lecture: Lecture = { status: r.status, sortie, erreur };
  if (r.status === 0) lecture.config = JSON.parse(sortie.trim().split('\n').at(-1) ?? '{}') as Lecture['config'];
  return lecture;
}

const sansSecret = (l: Lecture): void => {
  assert.ok(!l.sortie.includes(MOT_DE_PASSE), 'mot de passe en clair sur stdout');
  assert.ok(!l.erreur.includes(MOT_DE_PASSE), 'mot de passe en clair sur stderr');
};

describe('playwright.config.ts : mode local (sans E2E_BASE_URL)', () => {
  it('serveur e2e/serveur.ts sur 127.0.0.1:4173, quatre projets, aucun en-tête ni identifiant', () => {
    const l = lire();
    assert.equal(l.status, 0, l.erreur);
    const c = l.config!;
    assert.equal(c.baseURL, 'http://127.0.0.1:4173');
    assert.equal(c.webServer?.command, 'node e2e/serveur.ts "dist-e2e/reel" 4173');
    assert.equal(c.webServer?.url, 'http://127.0.0.1:4173/');
    assert.equal(c.webServer?.reuseExistingServer, false);
    assert.deepEqual(c.projets, ['avec-js', '4g', 'sans-js', 'parcours']);
    assert.equal(c.entetes, null);
    assert.equal(c.identifiants, null);
  });

  it('E2E_DIST et E2E_PORT gardent leur effet ; E2E_USER et E2E_PASS seuls ne changent rien', () => {
    const l = lire({ E2E_DIST: 'dist-e2e/m1', E2E_PORT: '4180', E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE });
    assert.equal(l.status, 0, l.erreur);
    assert.equal(l.config?.baseURL, 'http://127.0.0.1:4180');
    assert.equal(l.config?.webServer?.command, 'node e2e/serveur.ts "dist-e2e/m1" 4180');
    assert.deepEqual(l.config?.projets, ['avec-js', '4g', 'sans-js', 'parcours']);
    assert.equal(l.config?.entetes, null);
    assert.equal(l.config?.identifiants, null);
    sansSecret(l);
  });
});

describe('playwright.config.ts : mode distant (E2E_BASE_URL)', () => {
  it('pas de serveur local, baseURL distante, projet 4g seul, Authorization Basic préemptif et httpCredentials de secours', () => {
    const l = lire({ E2E_BASE_URL: BASE, E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE });
    assert.equal(l.status, 0, l.erreur);
    const c = l.config!;
    assert.equal(c.webServer, null);
    assert.equal(c.baseURL, BASE);
    assert.deepEqual(c.projets, ['4g']);
    assert.match(c.projet4g ?? '', /4g/);
    assert.deepEqual(c.entetes, { Authorization: `Basic ${Buffer.from(`${UTILISATEUR}:${MOT_DE_PASSE}`).toString('base64')}` });
    assert.deepEqual(c.identifiants, { cles: ['password', 'username'], username: UTILISATEUR, motDePasseEgal: true });
    sansSecret(l);
  });

  it('une barre finale est retirée de la baseURL (les specs ajoutent un chemin qui commence par /)', () => {
    const l = lire({ E2E_BASE_URL: `${BASE}/`, E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE });
    assert.equal(l.status, 0, l.erreur);
    assert.equal(l.config?.baseURL, BASE);
  });

  it('sans identifiants (hôte public après la Phase 9) : ni en-tête ni httpCredentials', () => {
    const l = lire({ E2E_BASE_URL: BASE });
    assert.equal(l.status, 0, l.erreur);
    assert.equal(l.config?.webServer, null);
    assert.deepEqual(l.config?.projets, ['4g']);
    assert.equal(l.config?.entetes, null);
    assert.equal(l.config?.identifiants, null);
  });

  const refus: Array<[string, Record<string, string>, RegExp]> = [
    ['http://', { E2E_BASE_URL: 'http://essai.exemple.test', E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE }, /https/],
    ['URL illisible', { E2E_BASE_URL: 'essai.exemple.test', E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE }, /E2E_BASE_URL/],
    ['identifiants dans l’URL', { E2E_BASE_URL: `https://${UTILISATEUR}:${MOT_DE_PASSE}@essai.exemple.test` }, /E2E_USER/],
    ['chemin', { E2E_BASE_URL: `${BASE}/themes/`, E2E_USER: UTILISATEUR, E2E_PASS: MOT_DE_PASSE }, /chemin/],
    ['E2E_USER seul', { E2E_BASE_URL: BASE, E2E_USER: UTILISATEUR }, /E2E_USER et E2E_PASS/],
    ['E2E_PASS seul', { E2E_BASE_URL: BASE, E2E_PASS: MOT_DE_PASSE }, /E2E_USER et E2E_PASS/],
    ['deux-points dans E2E_USER', { E2E_BASE_URL: BASE, E2E_USER: 'a:b', E2E_PASS: MOT_DE_PASSE }, /deux-points/],
  ];
  for (const [nom, env, motif] of refus) {
    it(`refus en français : ${nom}`, () => {
      const l = lire(env);
      assert.notEqual(l.status, 0, `${nom} : la configuration aurait dû lever une erreur`);
      assert.match(l.erreur, motif);
      assert.match(l.erreur, /playwright\.config\.ts : /);
      sansSecret(l);
    });
  }
});
