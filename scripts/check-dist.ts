// CLI `npm run check-dist` (après `astro build`) : contrôle du dist, QUAL-01. Toute la logique est
// dans scripts/lib/check-dist.ts ; ici, seulement les arguments, l'affichage et le code de sortie.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { escapeData, escapeProperty, safe } from '../src/lib/content-core/diagnostics.ts';
import { ModeInvalideError, resolveContentRoot, resolveMode } from '../src/lib/content-core/root.ts';
import { DeploiementInvalideError, estDeploiement } from '../src/lib/deploiement.ts';
import { loadPublicationConfig } from '../src/lib/publication-config.ts';
import { loadSiteConfig } from '../src/lib/site-config.ts';
import { TYPES_AUTORISES, candidatsNonRelus, cellulesAttendues, checkDist } from './lib/check-dist.ts';

const USAGE = `Usage : node scripts/check-dist.ts [--dist <dossier>] [--root <dossier>] [--mode preview|production] [--format text|github]

  --dist <dossier>        dossier construit par « astro build » (défaut : dist/)
  --root <dossier>        racine du contenu, pour le nombre de cellules attendu (défaut : RTP_CONTENT_ROOT, sinon le vrai corpus « . »)
  --mode preview|production  mode du build contrôlé (défaut : RTP_MODE, sinon production)
  --format text|github    text (défaut) ou annotations GitHub Actions en plus
  Liste blanche : config/publication.yml de la racine de contenu (themes_ouverts) ; en production, une page de thème
  hors liste est une erreur (THEME_HORS_LISTE_BLANCHE), un thème listé sans page ou un dist sans thème un avertissement.
  Personnes sans statut relu ou publié (lues dans la racine de contenu, D-06) : en production, une page, un lien ou
  une entrée de sitemap.xml pour l'une d'elles est une erreur (CANDIDAT_NON_RELU_EN_PRODUCTION).
  Le domaine du site est lu dans config/site.yml (racine du projet) : en production, URL canonique de chaque page,
  sitemap.xml et ligne Sitemap de robots.txt doivent le suivre ; en preview, aucun des trois n'est permis.
  RTP_DEPLOIEMENT=1 (job de déploiement) : un contact provisoire, un hébergeur seulement prévu et un domaine
  provisoire (TLD réservé : .invalid, .test, .example, .localhost) deviennent des erreurs au lieu d'avertissements.
  RTP_DEPLOIEMENT n'accepte que 1, 0 ou vide ; toute autre valeur est refusée (code 2).
  version.json doit exister et donner exactement commit et date ; GITHUB_SHA (40 hexadécimaux, en CI) impose son
  commit, et le commit « dev » est refusé sous RTP_DEPLOIEMENT=1. Le dist ne contient que html, txt, xml et json,
  plus une seule icône : favicon.ico à la racine, 4 096 octets au plus (régénérée par node scripts/favicon.ts),
  et un seul PNG : partage.png à la racine, 100 000 octets au plus (image de partage, node scripts/partage.ts).
  Code de sortie : 0 sans erreur, 1 si au moins une erreur, 2 si les arguments, le mode, config/site.yml ou config/publication.yml sont invalides.
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

let values: { dist?: string; root?: string; mode?: string; format?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { dist: { type: 'string' }, root: { type: 'string' }, mode: { type: 'string' }, format: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'github') usageError(`Format inconnu : « ${format} » (attendu : text ou github)`);

let mode: ReturnType<typeof resolveMode>;
try {
  mode = resolveMode(values.mode, process.env);
} catch (e) {
  if (e instanceof ModeInvalideError) usageError(e.message);
  throw e;
}

const projectRoot = process.cwd();
const dist = path.resolve(projectRoot, values.dist ?? 'dist');
if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) usageError(`Dossier introuvable : ${dist} (lancer « astro build » avant, ou passer --dist)`);
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot, process.env);

let themesOuverts: string[];
try {
  ({ themesOuverts } = loadPublicationConfig(contentRoot));
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
}
const attendues = cellulesAttendues(contentRoot, projectRoot, mode, themesOuverts);
// D-06 (plan 09-15) : toujours passé ; checkDist ne l'applique qu'en production.
const nonRelus = [...candidatsNonRelus(contentRoot, projectRoot)];
let deploiement = false;
try {
  deploiement = estDeploiement(process.env);
} catch (e) {
  if (e instanceof DeploiementInvalideError) usageError(e.message);
  throw e;
}
// Env vide : la décision de déploiement appartient à check-dist, qui signale DOMAINE_PROVISOIRE comme une erreur
// sous RTP_DEPLOIEMENT=1 au lieu de laisser le lecteur de config lever une exception.
let domaine: string;
try {
  ({ domaine } = loadSiteConfig(projectRoot, {}));
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
}
// Version servie (HEB-07) : GITHUB_SHA (CI) est le commit attendu dans version.json quand il compte 40 hexadécimaux,
// comme dans src/pages/version.json.ts. Types de fichiers (HEB-08) : html, txt, xml et json, plus le seul favicon.ico
// à la racine (D-11) et le seul partage.png à la racine (09.1) : TYPES_AUTORISES de scripts/lib/check-dist.ts.
const sha = process.env.GITHUB_SHA ?? '';
const version = /^[0-9a-f]{40}$/.test(sha) ? { commitAttendu: sha } : {};
const constats = checkDist(dist, { mode, cellulesParTheme: attendues, themesOuverts, candidatsNonRelus: nonRelus, deploiement, domaine, version, typesAutorises: TYPES_AUTORISES });

for (const c of constats) console.log(`${c.code} ${safe(c.fichier)} : ${safe(c.message)}`);
if (format === 'github') {
  // 10 annotations au plus : les erreurs d'abord (IN-03), sinon des avertissements masqueraient ce qui fait échouer le job.
  const parGravite = [...constats].sort((a, b) => Number(b.severite === 'erreur') - Number(a.severite === 'erreur'));
  for (const c of parGravite.slice(0, 10)) {
    const kind = c.severite === 'erreur' ? 'error' : 'warning';
    const fichier = path.relative(projectRoot, path.join(dist, c.fichier)).split(path.sep).join('/');
    console.log(`::${kind} file=${escapeProperty(fichier)},title=${escapeProperty(c.code)}::${escapeData(c.message)}`);
  }
}

const erreurs = constats.filter((c) => c.severite === 'erreur').length;
const avertissements = constats.length - erreurs;
const rel = path.relative(projectRoot, dist).split(path.sep).join('/') || '.';
console.log(`check-dist : ${erreurs} erreur(s), ${avertissements} avertissement(s) — dist ${rel}, mode ${mode}, ${attendues.size} thème(s) attendu(s), ${themesOuverts.length} thème(s) ouvert(s)`);
process.exit(erreurs > 0 ? 1 : 0);
