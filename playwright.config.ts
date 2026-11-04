import { defineConfig, devices } from '@playwright/test';

// Chromium seul (le throttling 4G par CDP n'existe que là). Dist et port viennent de scripts/e2e.ts.
const dist = process.env.E2E_DIST ?? 'dist-e2e/reel';
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  webServer: {
    // Chemin entre guillemets : un clone dont le chemin contient une espace reste un seul argument (IN-02).
    command: `node e2e/serveur.ts ${JSON.stringify(dist)} ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
  projects: [
    { name: 'avec-js', testIgnore: /sans-js|4g/ },
    { name: '4g', testMatch: /4g\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'sans-js', testMatch: /sans-js\.spec\.ts/, use: { javaScriptEnabled: false } },
  ],
});
