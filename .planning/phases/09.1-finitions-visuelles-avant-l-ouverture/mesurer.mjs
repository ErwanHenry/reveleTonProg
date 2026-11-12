// Mesures des finitions visuelles (phase 9.1, FIN-03 et FIN-04), pour n'importe quel dist construit.
// Usage : fnm exec --using=24 node mesurer.mjs --dist <dossier> --etiquette <nom> [--captures <dossier>] [--port <n>] [--sans-4g]
// Sert le dist avec le serveur des tests navigateur (e2e/serveur.ts : gzip, en-tête CSP du dépôt, no-store),
// mesure avec Chromium (@playwright/test du dépôt principal) et écrit UN objet JSON sur la sortie standard.
// Mêmes profils 4G que la suite de garde (PROFILS_4G de src/lib/profil-4g.ts), même mesure à froid que e2e/4g.spec.ts.
// Aucune dépendance ; une page absente est signalée dans le JSON, jamais levée.
// Captures : PNG hors du dépôt (dossier donné par --captures, sous-dossier <etiquette>).
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { creerServeur } from '../../../e2e/serveur.ts';
import { PROFILS_4G } from '../../../src/lib/profil-4g.ts';

function lireArgs(argv) {
  const o = { port: 4339, sans4g: false, captures: null, dist: null, etiquette: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dist') o.dist = argv[++i];
    else if (a === '--etiquette') o.etiquette = argv[++i];
    else if (a === '--captures') o.captures = argv[++i];
    else if (a === '--port') o.port = Number(argv[++i]);
    else if (a === '--sans-4g') o.sans4g = true;
    else {
      console.error(`argument inconnu : ${a}`);
      process.exit(2);
    }
  }
  if (!o.dist || !o.etiquette) {
    console.error('usage : node mesurer.mjs --dist <dossier> --etiquette <nom> [--captures <dossier>] [--port <n>] [--sans-4g]');
    process.exit(2);
  }
  return o;
}

const opts = lireArgs(process.argv.slice(2));
const dist = path.resolve(opts.dist);
const NIVEAUX = ['resume', 'detaille', 'enfant', 'aine'];
const sortie = { etiquette: opts.etiquette, dist, date: new Date().toISOString(), manquants: [] };

function lire(rel) {
  const f = path.join(dist, rel);
  return existsSync(f) ? readFileSync(f) : null;
}

// Page thème mesurée : /themes/sante/, sinon la page thème qui a le plus de cartes.
function choisirPageTheme() {
  if (existsSync(path.join(dist, 'themes/sante/index.html'))) return '/themes/sante/';
  const dossier = path.join(dist, 'themes');
  if (!existsSync(dossier)) return null;
  let meilleur = null;
  let max = -1;
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dossier, e.name, 'index.html');
    if (!existsSync(f)) continue;
    const n = (readFileSync(f, 'utf8').match(/class="cellule"/g) ?? []).length;
    if (n > max) [meilleur, max] = [`/themes/${e.name}/`, n];
  }
  return meilleur;
}

// Première page candidat (ordre alphabétique des dossiers) qui affiche un bloc de statut.
function choisirPageCandidat() {
  const dossier = path.join(dist, 'candidats');
  if (!existsSync(dossier)) return null;
  for (const nom of readdirSync(dossier).sort()) {
    const f = path.join(dossier, nom, 'index.html');
    if (existsSync(f) && /class="statut[" ]/.test(readFileSync(f, 'utf8'))) return `/candidats/${nom}/`;
  }
  return null;
}

const theme = choisirPageTheme();
const candidat = choisirPageCandidat();
if (!theme) sortie.manquants.push('page thème');
if (!candidat) sortie.manquants.push('page candidat avec statut');
if (!lire('index.html')) sortie.manquants.push('accueil');

// Poids lus dans le dist (gzip niveau 6, comme le serveur de test).
sortie.poids = {};
for (const [cle, rel] of [['theme', theme ? `${theme.slice(1)}index.html` : null], ['accueil', 'index.html']]) {
  const brut = rel ? lire(rel) : null;
  sortie.poids[cle] = brut ? { fichier: rel, brut: brut.length, gzip: gzipSync(brut, { level: 6 }).length } : null;
}

const serveur = creerServeur(dist);
await new Promise((ok, ko) => serveur.once('error', ko).listen(opts.port, '127.0.0.1', ok));
const base = `http://127.0.0.1:${opts.port}`;
const browser = await chromium.launch();

async function nouvellePage(largeur, hauteur) {
  const context = await browser.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  return { context, page };
}

async function choisirNiveau(page, niveau) {
  const radio = page.locator(`#niv-${niveau}`);
  if ((await radio.count()) === 0) return false;
  await radio.check();
  await page.waitForTimeout(100);
  return radio.isChecked();
}

const hauteur = (page) => page.evaluate(() => document.documentElement.scrollHeight);

try {
  // Page thème : hauteur par niveau à 375, « Gros caractères » à 320, « En bref » à 1280, vides des cartes.
  if (theme) {
    sortie.sante = { url: theme, hauteurs375: {} };
    const { context, page } = await nouvellePage(375, 812);
    await page.goto(base + theme, { waitUntil: 'load' });
    sortie.sante.cartes = await page.locator('li.cellule').count();
    for (const n of NIVEAUX) {
      const ok = await choisirNiveau(page, n);
      sortie.sante.hauteurs375[n] = ok ? await hauteur(page) : null;
    }
    await context.close();

    const p320 = await nouvellePage(320, 800);
    await p320.page.goto(base + theme, { waitUntil: 'load' });
    sortie.sante.aine320 = (await choisirNiveau(p320.page, 'aine')) ? await hauteur(p320.page) : null;
    await p320.context.close();

    const p1280 = await nouvellePage(1280, 900);
    await p1280.page.goto(base + theme, { waitUntil: 'load' });
    const ok = await choisirNiveau(p1280.page, 'resume');
    sortie.sante.resume1280 = ok ? await hauteur(p1280.page) : null;
    // Vide d'une carte : hauteur moins l'étendue de ses enfants visibles (haut du premier, bas du dernier)
    // moins les marges intérieures verticales.
    sortie.vides = await p1280.page.evaluate(() => {
      const vides = [];
      for (const li of document.querySelectorAll('li.cellule')) {
        const r = li.getBoundingClientRect();
        const enfants = [...li.children].filter((e) => {
          const s = getComputedStyle(e);
          return s.display !== 'none' && s.visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
        });
        if (enfants.length === 0) continue;
        const haut = Math.min(...enfants.map((e) => e.getBoundingClientRect().top));
        const bas = Math.max(...enfants.map((e) => e.getBoundingClientRect().bottom));
        const s = getComputedStyle(li);
        const pad = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
        vides.push(Math.max(0, Math.round(r.height - (bas - haut) - pad)));
      }
      return { cartes: vides.length, max: vides.length ? Math.max(...vides) : 0, somme: vides.reduce((a, b) => a + b, 0) };
    });
    await p1280.context.close();
  }

  // Accueil à 375 x 812 : hauteur et position de la première tuile.
  if (lire('index.html')) {
    const { context, page } = await nouvellePage(375, 812);
    await page.goto(base + '/', { waitUntil: 'load' });
    const tuile = await page.evaluate(() => {
      const t = document.querySelector('.tuile');
      return t ? Math.round(t.getBoundingClientRect().top + window.scrollY) : null;
    });
    sortie.accueil = {
      hauteur: await hauteur(page),
      premiereTuileHaut: tuile,
      premiereTuileVisible: tuile !== null && tuile + 48 < 812,
    };
    await context.close();
  }

  // 4G : trois chargements à froid de la page thème par profil, comme e2e/4g.spec.ts.
  if (!opts.sans4g && theme) {
    sortie.quatreG = {};
    for (const profil of PROFILS_4G) {
      const mesures = [];
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: profil.latenceRequeteMs,
            downloadThroughput: profil.debitDescendantOctetsParSeconde,
            uploadThroughput: profil.debitMontantOctetsParSeconde,
          });
          await page.goto(base + theme, { waitUntil: 'load' });
          const ms = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return nav.loadEventEnd - nav.startTime;
          });
          mesures.push(Math.round(ms));
        } finally {
          await context.close();
        }
      }
      sortie.quatreG[profil.id] = { mesuresMs: mesures, maxMs: Math.max(...mesures), budgetMs: profil.budgetMs };
    }
  }

  // Captures : pleine page et premier écran de l'accueil, de la page thème et d'une page candidat, à 375 et 1280.
  if (opts.captures) {
    const dossier = path.join(path.resolve(opts.captures), opts.etiquette);
    mkdirSync(dossier, { recursive: true });
    const cibles = [['accueil', '/'], ['theme', theme], ['candidat', candidat]].filter(([, u]) => u);
    for (const [largeur, hauteurEcran] of [[375, 812], [1280, 900]]) {
      const { context, page } = await nouvellePage(largeur, hauteurEcran);
      for (const [nom, url] of cibles) {
        await page.goto(base + url, { waitUntil: 'load' });
        await page.screenshot({ path: path.join(dossier, `${nom}-${largeur}-ecran.png`) });
        await page.screenshot({ path: path.join(dossier, `${nom}-${largeur}-page.png`), fullPage: true });
      }
      await context.close();
    }
    sortie.captures = { dossier, candidat };
  }
} finally {
  await browser.close();
  await new Promise((ok) => serveur.close(() => ok()));
}

process.stdout.write(`${JSON.stringify(sortie, null, 2)}\n`);
process.exit(0);
