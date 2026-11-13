// Page locale de relecture (09-05, PUB-01) pilotée dans un vrai Chromium : ce que fait un navigateur sur un
// formulaire (en-tête Origin selon la Referrer-Policy, Sec-Fetch-Site, CSP form-action) ne se voit pas avec des
// en-têtes fabriqués à la main. Régression du 2026-11-11 : sous « Referrer-Policy: no-referrer », le navigateur
// envoyait « Origin: null » sur son propre POST et chaque clic sur « Valider » était refusé en 403.
// Tout se passe sur une copie temporaire du corpus fictif M1, serveur dans ce processus, 127.0.0.1, port libre.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { creerServeurRelecture } from '../scripts/lib/relecture/serveur.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../tests/helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../tests/helpers/corpus-relecture.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../tests/helpers/validate-yaml.ts';

const MESURE = 'src/content/mesures/elise-erard/guichet-unique.yaml';

/** Empreinte (nom, taille, date de modification) des dossiers du vrai dépôt que l'outil pourrait écrire. */
function empreinteReelle(): string {
  const h = createHash('sha256');
  const parcourir = (dossier: string): void => {
    if (!existsSync(dossier)) return;
    for (const e of readdirSync(dossier, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const plein = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(plein);
      else {
        const s = statSync(plein);
        h.update(`${path.relative(REPO_ROOT, plein)}:${s.size}:${s.mtimeMs}\n`);
      }
    }
  };
  for (const d of ['src/content', 'archives', 'data', 'config', 'relecture']) parcourir(path.join(REPO_ROOT, d));
  return h.digest('hex');
}

let c: CorpusRelecture;
let serveur: Server;
let base: string;
let avantReel: string;

test.beforeEach(async () => {
  avantReel = empreinteReelle();
  c = corpusRelecture();
  expect(path.relative(REPO_ROOT, c.racine).startsWith('..')).toBe(true); // copie hors du dépôt
  serveur = creerServeurRelecture({ racine: c.racine, schemasDir: SCHEMAS_DIR, theme: 'logement', maintenant: () => new Date('2026-11-20T10:00:00Z') });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  const a = serveur.address() as AddressInfo;
  expect(a.address).toBe('127.0.0.1');
  base = `http://127.0.0.1:${a.port}`;
});

test.afterEach(async () => {
  if (serveur !== undefined) {
    serveur.closeAllConnections();
    await new Promise<void>((ok) => serveur.close(() => ok()));
  }
  nettoyerCorpusRelecture();
  expect(empreinteReelle(), 'le vrai corpus et le registre du dépôt sont intacts').toBe(avantReel);
});

test('Valider une mesure dans le navigateur : confirmation verte, trois champs écrits, une ligne de journal', async ({ page }) => {
  const avant = c.arbre();
  const original = c.lire(MESURE);
  expect(existsSync(c.chemin('relecture/journal.jsonl'))).toBe(false);

  await page.goto(`${base}/`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Relecture du thème logement');
  await page.getByRole('link', { name: /Élise Érard/ }).click();
  await expect(page).toHaveURL(`${base}/candidat/elise-erard`);

  const section = page.locator('#mesure-guichet-unique');
  const poste = page.waitForResponse((r) => r.url() === `${base}/valider` && r.request().method() === 'POST');
  await section.getByRole('button', { name: 'Valider cette mesure (relu)' }).click();
  // 303 attendu ; 403 « origine étrangère refusée » si la page fait envoyer « Origin: null » au navigateur.
  expect((await poste).status(), 'POST /valider du navigateur').toBe(303);

  // Pas une page « Refusé » : le navigateur revient sur la fiche, avec le message de confirmation.
  await expect(page).toHaveURL(`${base}/candidat/elise-erard?etat=valide#mesure-guichet-unique`);
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Refusé');
  await expect(page.locator('p.message[role="status"]')).toHaveText('Validé : statut relu, relecteur et date enregistrés.');

  expect(c.lire(MESURE)).toBe(original.replace('statut_relecture: brouillon\n', 'statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: 2026-11-20\n'));
  const apres = c.arbre();
  const changes = [...new Set([...avant.keys(), ...apres.keys()])].filter((k) => avant.get(k) !== apres.get(k));
  expect(changes).toEqual([MESURE]);
  const journal = readFileSync(c.chemin('relecture/journal.jsonl'), 'utf8').trimEnd().split('\n');
  expect(journal).toHaveLength(1);
  expect(JSON.parse(journal[0]!)).toMatchObject({ cible: 'mesure:elise-erard/guichet-unique', relecteur: 'Erwan Henry', date: '2026-11-20', action: 'marquer' });
});

test('Note par le formulaire, puis Valider : refus 409 affiché, fichier inchangé', async ({ page }) => {
  await page.goto(`${base}/candidat/elise-erard`);
  const id = 'mesure-guichet-unique';
  const section = page.locator(`#${id}`);
  const fichier = MESURE;
  const original = c.lire(fichier);

  await section.getByLabel(/Note de correction/).fill('Vérifier la page citée');
  const note = page.waitForResponse((r) => r.url() === `${base}/note` && r.request().method() === 'POST');
  await section.getByRole('button', { name: 'Ajouter la note' }).click();
  expect((await note).status(), 'POST /note du navigateur').toBe(303);
  await expect(page).toHaveURL(`${base}/candidat/elise-erard?etat=note#${id}`);
  await expect(page.locator('p.message[role="status"]')).toHaveText('Note enregistrée.');
  const notes = readFileSync(c.chemin('relecture/notes.jsonl'), 'utf8').trimEnd().split('\n');
  expect(notes).toHaveLength(1);
  expect(JSON.parse(notes[0]!)).toMatchObject({ cible: `mesure:elise-erard/guichet-unique`, texte: 'Vérifier la page citée', etat: 'ouverte' });

  const reponse = page.waitForResponse((r) => r.url().endsWith('/valider') && r.request().method() === 'POST');
  await page.locator(`#${id}`).getByRole('button', { name: 'Valider cette mesure (relu)' }).click();
  expect((await reponse).status()).toBe(409);
  await expect(page.locator('.refus[role="alert"]')).toContainText('Validation refusée, rien n’a été écrit.');
  await expect(page.locator('.refus')).toContainText('note(s) ouverte(s)');
  expect(c.lire(fichier)).toBe(original);
  expect(existsSync(c.chemin('relecture/journal.jsonl'))).toBe(false);
});
