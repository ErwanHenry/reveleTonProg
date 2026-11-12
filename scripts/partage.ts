// Image de partage (proposition 6 du lot B, D-04) : public/partage.png, 1200 x 630, copiée telle quelle à la racine du
// dist par Astro. Capture par le Chromium de @playwright/test (déjà une dépendance de développement, aucune autre)
// de scripts/partage.html, remplie avec la phrase de src/lib/partage.ts, le domaine de config/site.yml et les
// couleurs de src/styles/base.css (--fond, --encre, --encre-douce) : jamais une couleur de thème ni de parti, polices
// du système. L'image ne contient pas le nom du site, donc elle ne dépend pas du nom affiché.
//
// Le fichier n'est PAS identique octet pour octet d'une machine à l'autre (rendu des polices du système) : le fichier
// versionné est la référence, régénéré seulement quand le texte, le domaine ou les couleurs changent. Pour que
// « --check » reste fiable sans navigateur ni police (la CI ne lance pas Chromium), le PNG porte un morceau tEXt
// « Source » avec l'empreinte SHA-256 du HTML rempli ; --check compare cette empreinte, la signature, les dimensions
// 1200 x 630 et le poids (LIMITES.partage), jamais les pixels. Aucun horodatage dans le PNG.
//
// check-dist n'admet que ce fichier comme .png (TYPE_FICHIER_INATTENDU sinon) ; il n'est cité que par og:image :
// aucune page ne le charge (PARTAGE_INCORRECT).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { crc32 } from './favicon.ts';
import { LIMITES } from './lib/check-dist.ts';
import { HAUTEUR_PARTAGE, LARGEUR_PARTAGE, PROMESSE_PARTAGE, REPERE_PARTAGE } from '../src/lib/partage.ts';
import { loadSiteConfig } from '../src/lib/site-config.ts';

const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE_DEPOT, 'public/partage.png');
const SOURCE = path.join(RACINE_DEPOT, 'scripts/partage.html');
const BASE_CSS = path.join(RACINE_DEPOT, 'src/styles/base.css');
const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CLE_SOURCE = 'Source';

const echapper = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function jeton(css: string, nom: string): string {
  const v = new RegExp(`--${nom}:\\s*(#[0-9A-Fa-f]{6})\\s*;`).exec(css)?.[1];
  if (v === undefined) throw new Error(`--${nom} introuvable dans src/styles/base.css`);
  return v;
}

/** HTML de la page de capture, repères remplis : phrase, domaine (config/site.yml) et couleurs (base.css). */
export function htmlRempli(): string {
  const css = fs.readFileSync(BASE_CSS, 'utf8');
  const domaine = loadSiteConfig(RACINE_DEPOT, {}).domaine;
  const valeurs: Record<string, string> = {
    FOND: jeton(css, 'fond'),
    ENCRE: jeton(css, 'encre'),
    ENCRE_DOUCE: jeton(css, 'encre-douce'),
    REPERE: echapper(REPERE_PARTAGE),
    PROMESSE: echapper(PROMESSE_PARTAGE),
    DOMAINE: echapper(domaine),
  };
  return fs.readFileSync(SOURCE, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => valeurs[k] ?? m);
}

/** Empreinte SHA-256 (hexadécimal) du HTML rempli et des dimensions : ce que --check compare. */
export function empreinteSource(): string {
  return createHash('sha256').update(`${LARGEUR_PARTAGE}x${HAUTEUR_PARTAGE}\n${htmlRempli()}`).digest('hex');
}

function morceaux(png: Buffer): Array<{ type: string; donnees: Buffer; brut: Buffer }> {
  const out: Array<{ type: string; donnees: Buffer; brut: Buffer }> = [];
  let i = 8;
  while (i + 12 <= png.length) {
    const n = png.readUInt32BE(i);
    if (i + 12 + n > png.length) break;
    out.push({ type: png.subarray(i + 4, i + 8).toString('latin1'), donnees: png.subarray(i + 8, i + 8 + n), brut: png.subarray(i, i + 12 + n) });
    i += 12 + n;
  }
  return out;
}

/** Dimensions lues dans l'IHDR, ou undefined si ce n'est pas un PNG. */
export function lireDimensions(png: Buffer): { largeur: number; hauteur: number } | undefined {
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE_PNG) || png.subarray(12, 16).toString('latin1') !== 'IHDR') return undefined;
  return { largeur: png.readUInt32BE(16), hauteur: png.readUInt32BE(20) };
}

/** Valeur du morceau tEXt de ce mot-clé, ou undefined. */
export function lireTexte(png: Buffer, cle: string): string | undefined {
  for (const m of morceaux(png)) {
    if (m.type !== 'tEXt') continue;
    const s = m.donnees.toString('latin1');
    if (s.startsWith(`${cle}\0`)) return s.slice(cle.length + 1);
  }
  return undefined;
}

/** PNG avec un morceau tEXt (mot-clé, valeur) ajouté juste après l'IHDR ; un morceau du même mot-clé est remplacé. */
export function ajouterTexte(png: Buffer, cle: string, valeur: string): Buffer {
  const donnees = Buffer.from(`${cle}\0${valeur}`, 'latin1');
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from('tEXt', 'latin1'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  const nouveau = Buffer.concat([longueur, corps, crc]);
  const ms = morceaux(png).filter((m) => !(m.type === 'tEXt' && m.donnees.toString('latin1').startsWith(`${cle}\0`)));
  const [ihdr, ...reste] = ms;
  if (ihdr === undefined) throw new Error('PNG sans IHDR');
  return Buffer.concat([SIGNATURE_PNG, ihdr.brut, nouveau, ...reste.map((m) => m.brut)]);
}

/** Écarts d'un PNG avec ce que le dépôt attend (liste vide : conforme). Aucun navigateur, aucune police. */
export function problemesImage(png: Buffer): string[] {
  const p: string[] = [];
  const dim = lireDimensions(png);
  if (dim === undefined) return ['ce n\'est pas un PNG'];
  if (dim.largeur !== LARGEUR_PARTAGE || dim.hauteur !== HAUTEUR_PARTAGE) p.push(`dimensions ${dim.largeur} x ${dim.hauteur} au lieu de ${LARGEUR_PARTAGE} x ${HAUTEUR_PARTAGE}`);
  if (png.length > LIMITES.partage) p.push(`${png.length} octets (limite ${LIMITES.partage})`);
  const vue = lireTexte(png, CLE_SOURCE);
  if (vue === undefined) p.push('empreinte de la page source absente du PNG');
  else if (vue !== `sha256:${empreinteSource()}`) p.push('empreinte de la page source périmée (texte, domaine ou couleurs changés depuis la capture)');
  return p;
}

/** Capture la page remplie en PNG 1200 x 630 (Chromium de @playwright/test) et y inscrit l'empreinte. */
export async function genererPartage(): Promise<Buffer> {
  const { chromium } = await import('@playwright/test');
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ viewport: { width: LARGEUR_PARTAGE, height: HAUTEUR_PARTAGE }, deviceScaleFactor: 1 });
    await page.setContent(htmlRempli(), { waitUntil: 'load' });
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: LARGEUR_PARTAGE, height: HAUTEUR_PARTAGE } });
    return ajouterTexte(png, CLE_SOURCE, `sha256:${empreinteSource()}`);
  } finally {
    await navigateur.close();
  }
}

const USAGE = `Usage : node scripts/partage.ts [--check] [--sortie <fichier>]
  (sans option)       capture scripts/partage.html et écrit public/partage.png (Chromium de @playwright/test)
  --check             n'écrit rien, ne lance pas de navigateur : code 1 si le fichier est absent, n'a pas 1200 x 630,
                      dépasse ${LIMITES.partage} octets ou ne correspond plus au texte (empreinte du HTML rempli)
  --sortie <fichier>  autre fichier que public/partage.png
  Code de sortie : 0 écrit ou conforme, 1 --check en écart, 2 arguments invalides.
`;

async function main(): Promise<void> {
  let valeurs: { check?: boolean; sortie?: string };
  try {
    ({ values: valeurs } = parseArgs({
      args: process.argv.slice(2),
      options: { check: { type: 'boolean' }, sortie: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    process.exit(2);
  }
  const cible = valeurs.sortie === undefined ? FICHIER : path.resolve(valeurs.sortie);
  const rel = path.relative(RACINE_DEPOT, cible).split(path.sep).join('/');
  if (valeurs.check === true) {
    if (!fs.existsSync(cible)) {
      console.error(`partage : ${rel} absent : lancer « node scripts/partage.ts »`);
      process.exit(1);
    }
    const ecarts = problemesImage(fs.readFileSync(cible));
    if (ecarts.length > 0) {
      console.error(`partage : ${rel} ne convient pas (${ecarts.join(' ; ')}) : relancer « node scripts/partage.ts »`);
      process.exit(1);
    }
    console.log(`partage : ${rel} conforme (${fs.statSync(cible).size} octets, ${LARGEUR_PARTAGE} x ${HAUTEUR_PARTAGE})`);
    return;
  }
  const png = await genererPartage();
  const ecarts = problemesImage(png);
  if (ecarts.length > 0) {
    console.error(`partage : image produite refusée (${ecarts.join(' ; ')})`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, png);
  console.log(`partage : ${rel} écrit (${png.length} octets, ${LARGEUR_PARTAGE} x ${HAUTEUR_PARTAGE})`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
