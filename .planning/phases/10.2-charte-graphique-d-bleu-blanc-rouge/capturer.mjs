// Captures avant/après de la charte D (phase 10.2), pour n'importe quel dist construit.
// Usage : fnm exec --using=24 node capturer.mjs --dist <dossier> --sortie <dossier> [--port <n>]
// Sert le dist avec le serveur des tests navigateur (e2e/serveur.ts), capture en JPEG (qualité 70) le premier écran
// de quelques pages et une zone de cartes de la page thème, sur bureau (1280 x 900) et téléphone (375 x 812).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { creerServeur } from '../../../e2e/serveur.ts';

const a = process.argv.slice(2);
const val = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
const dist = path.resolve(val('--dist'));
const sortie = path.resolve(val('--sortie'));
const port = Number(val('--port', '4341'));
mkdirSync(sortie, { recursive: true });

const PAGES = [
  ['accueil', '/', null],
  ['theme', '/themes/sante/', null],
  ['theme-cartes', '/themes/sante/', '.cellule'],
  ['candidat', '/candidats/edouard-philippe/', null],
  ['candidats', '/candidats/', null],
  ['methode', '/methode/', null],
  // 4e champ : radio à cocher avant la capture. Entrée placée en dernier car le niveau est mémorisé dans le contexte.
  ['theme-gros', '/themes/sante/', '#concerne-titre', '#niv-aine'],
];
// Le format « etroit » (320 px) ne s'applique qu'aux entrées qui portent un 4e champ.
const FORMATS = [['bureau', 1280, 900], ['mobile', 375, 812], ['etroit', 320, 812]];

const serveur = creerServeur(dist);
await new Promise((ok, ko) => serveur.once('error', ko).listen(port, '127.0.0.1', ok));
const browser = await chromium.launch();
try {
  for (const [format, w, h] of FORMATS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const [nom, url, ancre, radio] of PAGES) {
      if (format === 'etroit' && !radio) continue;
      await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: 'load' });
      if (radio) await page.locator(radio).check({ force: true });
      if (ancre) {
        const el = page.locator(ancre).first();
        if ((await el.count()) === 0) continue;
        await el.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 16));
      }
      await page.screenshot({ path: path.join(sortie, `${format}-${nom}.jpg`), type: 'jpeg', quality: 70 });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  serveur.close();
}
console.log(`captures écrites dans ${sortie}`);
