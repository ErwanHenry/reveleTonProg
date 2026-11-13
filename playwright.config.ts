import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

// Chromium seul (le throttling 4G par CDP n'existe que là). Dist et port viennent de scripts/e2e.ts.
const dist = process.env.E2E_DIST ?? 'dist-e2e/reel';
const port = Number(process.env.E2E_PORT ?? 4173);

/**
 * Mode distant (PERF-02, D-13) : E2E_BASE_URL (https, origine seule) fait mesurer le projet 4g sur le vrai serveur,
 * sans serveur local. E2E_USER et E2E_PASS (les deux ou aucun) donnent l'en-tête Authorization Basic, envoyé d'emblée
 * à chaque requête (extraHTTPHeaders) : sans lui, chaque chargement paierait un aller-retour 401 (environ 560 ms de
 * plus sous le profil à 562,5 ms) que le site public n'aura pas. httpCredentials reste en secours pour la lecture de
 * version.json. Le site ne charge rien d'un autre hôte (check-dist RESSOURCE_TIERCE) : l'en-tête ne quitte pas l'hôte
 * technique. Aucun message d'erreur ne reprend un identifiant ou l'URL fournie.
 */
function modeDistant(env: NodeJS.ProcessEnv): { baseURL: string; utilisateur?: string; motDePasse?: string } | undefined {
  const brute = env.E2E_BASE_URL;
  if (brute === undefined || brute === '') return undefined;
  let url: URL;
  try {
    url = new URL(brute);
  } catch {
    throw new Error('playwright.config.ts : E2E_BASE_URL illisible (attendu : https://essai.<domaine>)');
  }
  if (url.protocol !== 'https:') throw new Error('playwright.config.ts : E2E_BASE_URL doit commencer par https:// (mesure derrière Caddy, en TLS)');
  if (url.username !== '' || url.password !== '') {
    throw new Error("playwright.config.ts : pas d'identifiants dans E2E_BASE_URL ; les passer par E2E_USER et E2E_PASS");
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('playwright.config.ts : E2E_BASE_URL doit être une origine seule, sans chemin, requête ni fragment');
  }
  const utilisateur = env.E2E_USER ?? '';
  const motDePasse = env.E2E_PASS ?? '';
  if ((utilisateur === '') !== (motDePasse === '')) {
    throw new Error('playwright.config.ts : E2E_USER et E2E_PASS vont ensemble (les deux, ou aucun pour un hôte public)');
  }
  if (utilisateur.includes(':')) throw new Error("playwright.config.ts : E2E_USER ne doit pas contenir de deux-points (séparateur de l'en-tête Basic)");
  return { baseURL: url.origin, ...(utilisateur === '' ? {} : { utilisateur, motDePasse }) };
}

const distant = modeDistant(process.env);

const use: PlaywrightTestConfig['use'] = {
  ...devices['Desktop Chrome'],
  baseURL: distant?.baseURL ?? `http://127.0.0.1:${port}`,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  // CSP ignorée par défaut : texte.spec injecte des styles avec page.addStyleTag, qu'une politique à
  // empreintes refuse. Seuls csp.spec et csp-sans-js.spec rétablissent la politique réelle de la page.
  bypassCSP: true,
};
if (distant?.utilisateur !== undefined && distant.motDePasse !== undefined) {
  use.extraHTTPHeaders = { Authorization: `Basic ${Buffer.from(`${distant.utilisateur}:${distant.motDePasse}`).toString('base64')}` };
  use.httpCredentials = { username: distant.utilisateur, password: distant.motDePasse };
}

const projet4g = { name: '4g', testMatch: /4g\.spec\.ts/, use: { ...devices['Desktop Chrome'] } };

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use,
  ...(distant !== undefined
    ? { projects: [projet4g] }
    : {
        webServer: {
          // Chemin entre guillemets : un clone dont le chemin contient une espace reste un seul argument (IN-02).
          command: `node e2e/serveur.ts ${JSON.stringify(dist)} ${port}`,
          url: `http://127.0.0.1:${port}/`,
          reuseExistingServer: false,
          timeout: 15_000,
        },
        projects: [
          { name: 'avec-js', testIgnore: /sans-js|4g|parcours|relecture/ },
          projet4g,
          { name: 'sans-js', testMatch: /sans-js\.spec\.ts/, use: { javaScriptEnabled: false } },
          // Retour arrière restauré du bfcache (DETTE-02) : le headless shell par défaut refuse le bfcache et Playwright
          // le coupe par une option de lancement (retirée ci-dessous). channel 'chromium' = nouveau headless, installé par
          // `npx playwright install chromium` (déjà lancé en CI). bypassCSP reste à true : la preuve par mutation sert
          // un script de niveau modifié, qui n'a plus son empreinte dans la CSP.
          {
            name: 'parcours',
            testMatch: /parcours\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              channel: 'chromium',
              launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] },
            },
          },
        ],
      }),
});
