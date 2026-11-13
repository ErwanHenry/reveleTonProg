import { defineConfig, devices } from '@playwright/test';

// Page locale de relecture (09-05) pilotée dans un vrai Chromium. Aucun dist, aucun webServer : le test démarre
// lui-même le serveur de relecture, sur une copie temporaire du corpus fictif, port libre, 127.0.0.1.
// Lancé une seule fois par scripts/e2e.ts (pas une fois par jeu). CSP de la page non contournée : c'est celle du
// serveur (form-action 'self'), exactement ce que voit le relecteur.
export default defineConfig({
  testDir: 'e2e',
  testMatch: /relecture\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], locale: 'fr-FR', timezoneId: 'Europe/Paris', bypassCSP: false },
});
