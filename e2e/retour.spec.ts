// DETTE-02 (W4, D-12) : même parcours que parcours.spec, retour arrière sans bfcache (projet avec-js :
// Playwright lance Chromium avec --disable-back-forward-cache, la page de thème est rechargée). Le niveau
// affiché est celui choisi en dernier, relu dans localStorage au chargement.
import { expect, test } from '@playwright/test';
import { jusquaLaPageCandidat } from './chemin.ts';

test('retour arrière sans bfcache : niveau choisi en dernier', async ({ page }) => {
  const urlTheme = await jusquaLaPageCandidat(page);
  await page.goBack();
  await expect(page).toHaveURL(urlTheme);
  await expect(page.locator('#niv-enfant')).toBeChecked();
});
