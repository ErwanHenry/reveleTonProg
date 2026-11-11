// Icône du site (D-11, 09-07) : public/favicon.ico, copiée telle quelle à la racine du dist par Astro.
// Cette icône est une œuvre originale du dépôt, produite par ce script et publiée sous la licence du dépôt.
// Aucune image tierce, aucune dépendance : un conteneur ICO d'une seule image PNG 32 x 32 écrite à la main
// (node:zlib pour le flux compressé, CRC32 calculé ici). Motif abstrait : un carré de la couleur principale du site
// (--encre) et un carré intérieur plus clair (--fond) ; ni lettre, ni drapeau, ni couleur de parti.
//
// Sortie déterministe : palette de deux couleurs, un bit par pixel, flux zlib en blocs stockés (niveau 0), donc les
// mêmes octets sur toute machine et toute version de zlib ; aucun horodatage. tests/scripts/favicon.test.ts compare
// le fichier versionné à cette sortie. Aucune balise <link rel="icon"> : le navigateur demande /favicon.ico de
// lui-même, le poids des pages ne change pas. check-dist n'admet que ce fichier comme .ico (LIMITES.favicon).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deflateSync } from 'node:zlib';

/** Couleur principale du site (--encre de src/styles/base.css). */
export const COULEUR_ICONE = '#1F2328';
/** Couleur claire du site (--fond de src/styles/base.css). */
export const COULEUR_FOND_ICONE = '#FAFAF8';

const COTE = 32;
/** Carré intérieur clair : de la colonne (et ligne) DEBUT à FIN comprises. */
const DEBUT = 10;
const FIN = 21;

const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE_DEPOT, 'public/favicon.ico');

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 (ISO 3309, celui du PNG). */
export function crc32(octets: Buffer): number {
  let c = 0xffffffff;
  for (const o of octets) c = (TABLE_CRC[(c ^ o) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function morceau(type: string, donnees: Buffer): Buffer {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'latin1'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
}

const rgb = (hex: string): number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

function png(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(COTE, 0);
  ihdr.writeUInt32BE(COTE, 4);
  ihdr[8] = 1; // un bit par pixel
  ihdr[9] = 3; // couleurs indexées (palette)
  // compression, filtre et entrelacement : 0
  const plte = Buffer.from([...rgb(COULEUR_ICONE), ...rgb(COULEUR_FOND_ICONE)]);
  const parLigne = COTE / 8;
  const brut = Buffer.alloc(COTE * (1 + parLigne)); // octet de filtre 0 en tête de chaque ligne
  for (let y = 0; y < COTE; y++) {
    for (let x = 0; x < COTE; x++) {
      if (y >= DEBUT && y <= FIN && x >= DEBUT && x <= FIN) {
        const i = y * (1 + parLigne) + 1 + (x >> 3);
        brut[i] = (brut[i] ?? 0) | (0x80 >> (x & 7));
      }
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('PLTE', plte),
    morceau('IDAT', deflateSync(brut, { level: 0 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

/** Octets de public/favicon.ico : en-tête ICO, une entrée 32 x 32, puis l'image PNG. */
export function genererFavicon(): Buffer {
  const image = png();
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0);
  entete.writeUInt16LE(1, 2); // type 1 : icône
  entete.writeUInt16LE(1, 4); // une image
  const entree = Buffer.alloc(16);
  entree[0] = COTE;
  entree[1] = COTE;
  entree[2] = 0; // pas de palette déclarée ici (elle est dans le PNG)
  entree[3] = 0;
  entree.writeUInt16LE(1, 4); // plans
  entree.writeUInt16LE(32, 6); // bits par pixel annoncés, valeur usuelle pour une image PNG
  entree.writeUInt32LE(image.length, 8);
  entree.writeUInt32LE(entete.length + entree.length, 12);
  return Buffer.concat([entete, entree, image]);
}

const USAGE = `Usage : node scripts/favicon.ts [--check] [--sortie <fichier>]
  (sans option)       écrit public/favicon.ico
  --check             n'écrit rien : code 1 si le fichier est absent ou diffère de la sortie du générateur
  --sortie <fichier>  autre fichier que public/favicon.ico
  Code de sortie : 0 écrit ou à jour, 1 --check en écart, 2 arguments invalides.
`;

function main(): void {
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
  const attendu = genererFavicon();
  const rel = path.relative(RACINE_DEPOT, cible).split(path.sep).join('/');
  if (valeurs.check === true) {
    if (fs.existsSync(cible) && fs.readFileSync(cible).equals(attendu)) {
      console.log(`favicon : ${rel} à jour (${attendu.length} octets)`);
      return;
    }
    console.error(`favicon : ${rel} absent ou différent : relancer « node scripts/favicon.ts »`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, attendu);
  console.log(`favicon : ${rel} écrit (${attendu.length} octets)`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
