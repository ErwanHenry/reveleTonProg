// Lecteur simulé (QUAL-06) : lit un dist construit en texte brut, sans navigateur ni réseau,
// et journalise chaque lecture. Lecture seule sur le dist ; le journal est la seule écriture, et il est
// refusé dans le dist. Liens symboliques : une page n'est lue que si son chemin réel (realpath) reste
// sous le chemin réel du dist ; --empreinte ne suit aucun lien mais l'inclut (chemin et cible), si bien
// qu'un lien ajouté, retiré ou redirigé change l'empreinte.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { aClasse, analyserHtml, trouver, type Noeud } from './lib/html.ts';

const USAGE = `Usage :
  node scripts/audit-lire.ts --dist <dossier> --liste [--persona <id>] [--journal <fichier>]
  node scripts/audit-lire.ts --dist <dossier> --persona <id> [--niveau resume|detaille|enfant|aine] [--journal <fichier>] <chemin>
  node scripts/audit-lire.ts --dist <dossier> --empreinte

  Lecture seule du dist ; chaque lecture ajoute une ligne à audit/journal.jsonl (ou --journal), jamais dans le dist.
  Code de sortie : 0, ou 2 pour un refus (chemin hors dist, lien vers l'extérieur, page absente, journal dans le dist, persona ou niveau invalide).
`;

const NIVEAUX = ['resume', 'detaille', 'enfant', 'aine'] as const;
// Mêmes libellés que le sélecteur du site (LIBELLES_NIVEAUX, src/lib/corpus/vue.ts) : le lecteur ne doit pas en inventer d'autres.
const LIBELLES: Record<string, string> = { resume: 'En bref', detaille: 'En détail', enfant: 'Pour les enfants', aine: 'Gros caractères' };
const BLOCS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'details', 'summary', 'blockquote', 'figure', 'dl', 'dt', 'dd', 'br']);
const OMIS = new Set(['script', 'style', 'template']);

function refuser(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function sha256(donnees: Buffer | string): string {
  return crypto.createHash('sha256').update(donnees).digest('hex');
}

/** Vrai si `p` est `dossier` ou se trouve dessous. */
function dans(p: string, dossier: string): boolean {
  return p === dossier || p.startsWith(dossier + path.sep);
}

/** Chemin réel de `p`, même s'il n'existe pas encore : chemin réel du plus proche parent existant, plus le reste. */
function reelOuParent(p: string): string {
  let parent = p;
  const reste: string[] = [];
  while (!fs.existsSync(parent)) {
    const haut = path.dirname(parent);
    if (haut === parent) break;
    reste.unshift(path.basename(parent));
    parent = haut;
  }
  return path.join(fs.realpathSync(parent), ...reste);
}

/** Résout un chemin d'URL vers un .html sous le dist ; null si hors dist (y compris par un lien symbolique) ou absent. */
function resoudre(dist: string, distReel: string, chemin: string): string | null {
  let decode: string;
  try {
    decode = decodeURIComponent(chemin.split(/[?#]/)[0] ?? '');
  } catch {
    return null;
  }
  if (decode.includes('\0') || decode.includes('\\')) return null;
  let rel = decode.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  else if (path.extname(rel) === '') rel += '/index.html';
  const cible = path.resolve(dist, rel);
  if (!cible.startsWith(dist + path.sep)) return null;
  if (path.extname(cible) !== '.html') return null;
  let reel: string;
  try {
    reel = fs.realpathSync(cible);
  } catch {
    return null;
  }
  if (!reel.startsWith(distReel + path.sep) || path.extname(reel) !== '.html') return null;
  return fs.statSync(reel).isFile() ? reel : null;
}

/**
 * Lignes de l'empreinte, triées par chemin comme avant les liens : `chemin:sha256` par fichier,
 * `chemin -> lien:cible` par lien symbolique (jamais suivi). Un dist sans lien garde la même empreinte.
 */
function lignesEmpreinte(dist: string): string[] {
  const out: { cle: string; ligne: string }[] = [];
  const rel = (p: string): string => path.relative(dist, p).split(path.sep).join('/');
  const visiter = (dossier: string): void => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const p = path.join(dossier, e.name);
      if (e.isSymbolicLink()) out.push({ cle: p, ligne: `${rel(p)} -> lien:${fs.readlinkSync(p)}` });
      else if (e.isDirectory()) visiter(p);
      else if (e.isFile()) out.push({ cle: p, ligne: `${rel(p)}:${sha256(fs.readFileSync(p))}` });
      else out.push({ cle: p, ligne: `${rel(p)} -> special` });
    }
  };
  visiter(dist);
  return out.sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0)).map((x) => x.ligne);
}

function listerFichiers(dossier: string, filtre: (nom: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...listerFichiers(p, filtre));
    else if (e.isFile() && filtre(e.name)) out.push(p);
  }
  return out.sort();
}

function urlDe(dist: string, fichier: string): string {
  const rel = path.relative(dist, fichier).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  return rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`;
}

/** Texte lisible d'un sous-arbre : blocs sur des lignes séparées, contenu replié ou en popover étiqueté. */
function rendu(n: Noeud, niveau: string | null): string {
  let s = '';
  const visiter = (x: Noeud): void => {
    if (OMIS.has(x.tag)) return;
    const nv = x.attrs['data-niveau'];
    const redaction = aClasse(x, 'redaction') && nv !== undefined;
    if (niveau !== null && redaction && nv !== niveau) return;
    const bloc = BLOCS.has(x.tag);
    if (bloc) s += '\n';
    if (redaction) s += `[${LIBELLES[nv] ?? nv}] `;
    if ('popover' in x.attrs) s += '(définition) ';
    let corpsReplie = false;
    for (const e of x.enfants) {
      if (typeof e === 'string') {
        s += e;
        continue;
      }
      if (x.tag === 'details' && e.tag !== 'summary' && !corpsReplie) {
        corpsReplie = true;
        s += '\n(replié) ';
      }
      visiter(e);
    }
    if (bloc) s += '\n';
  };
  visiter(n);
  return s
    .replace(/[ \t\r\f\v]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
    .replace(/^(\[(?:En bref|En détail|Pour les enfants|Gros caractères)\]|\(replié\)|\(définition\))\n/gm, '$1 ');
}

function estDans(n: Noeud, ancetre: Noeud): boolean {
  for (let p: Noeud | null = n; p !== null; p = p.parent) if (p === ancetre) return true;
  return false;
}

function lirePage(html: string, niveau: string | null): string {
  const doc = analyserHtml(html);
  const titre = trouver(doc, (n) => n.tag === 'title')[0];
  const main = trouver(doc, (n) => n.tag === 'main')[0];
  const pied = trouver(doc, (n) => n.tag === 'footer' && !(main !== undefined && estDans(n, main)))[0];
  const liens = trouver(doc, (n) => n.tag === 'a' && n.attrs.href !== undefined);
  const sortie: string[] = [];
  sortie.push(`Titre : ${titre ? rendu(titre, null) : '(sans titre)'}`, '', main ? rendu(main, niveau) : rendu(doc, niveau));
  if (pied) sortie.push('', rendu(pied, null));
  sortie.push('', 'Liens :');
  liens.forEach((a, i) => sortie.push(`${i + 1}. ${rendu(a, null).replace(/\n/g, ' ')} -> ${a.attrs.href}`));
  return `${sortie.join('\n')}\n`;
}

let values: { dist?: string; persona?: string; niveau?: string; journal?: string; liste?: boolean; empreinte?: boolean };
let positionnels: string[];
try {
  ({ values, positionals: positionnels } = parseArgs({
    args: process.argv.slice(2),
    options: {
      dist: { type: 'string' },
      persona: { type: 'string' },
      niveau: { type: 'string' },
      journal: { type: 'string' },
      liste: { type: 'boolean' },
      empreinte: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: true,
  }));
} catch (e) {
  refuser(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
}

if (values.dist === undefined) refuser(`--dist est obligatoire\n\n${USAGE}`);
const dist = path.resolve(values.dist);
if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) refuser(`Dossier introuvable : ${dist}`);
const distReel = fs.realpathSync(dist);

if (values.empreinte === true) {
  console.log(sha256(lignesEmpreinte(distReel).join('\n')));
  process.exit(0);
}

const persona = values.persona ?? 'anonyme';
if (!/^[a-z0-9-]{1,40}$/.test(persona)) refuser('Persona invalide : un identifiant court (a-z, 0-9, tiret, 40 caractères au plus) est attendu');
const niveau = values.niveau ?? null;
if (niveau !== null && !(NIVEAUX as readonly string[]).includes(niveau)) refuser(`Niveau invalide : « ${niveau} » (attendu : ${NIVEAUX.join(', ')})`);
const journal = path.resolve(values.journal ?? 'audit/journal.jsonl');
if (dans(journal, dist) || dans(reelOuParent(journal), distReel)) {
  refuser(`Journal refusé : ${journal} est dans le dist (lecture seule) ; passer --journal hors du dist`);
}

function journaliser(chemin: string, sha: string, octets: number): void {
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  const ligne = { horodatage: new Date().toISOString(), persona, chemin, niveau, sha256: sha, octets };
  fs.appendFileSync(journal, `${JSON.stringify(ligne)}\n`);
}

if (values.liste === true) {
  const urls = listerFichiers(dist, (nom) => nom.endsWith('.html')).map((f) => urlDe(dist, f)).sort();
  const sortie = `${urls.join('\n')}\n`;
  process.stdout.write(sortie);
  journaliser('--liste', sha256(sortie), Buffer.byteLength(sortie));
  process.exit(0);
}

const demande = positionnels[0];
if (demande === undefined || positionnels.length !== 1) refuser(`Un chemin est attendu\n\n${USAGE}`);
const fichier = resoudre(dist, distReel, demande);
if (fichier === null) refuser(`Chemin refusé ou page absente : ${demande}`);
const brut = fs.readFileSync(fichier);
process.stdout.write(lirePage(brut.toString('utf8'), niveau));
journaliser(demande, sha256(brut), brut.length);
