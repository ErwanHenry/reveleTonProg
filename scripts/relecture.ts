// Outil de relecture local (D-04) : jamais déployé, jamais référencé par src/ ni par Astro.
//
//   npm run relecture -- [--root <dossier>] [--schemas <dossier>] <commande> [arguments]
//
// Commandes connues : liste, marquer, note, servir, publier, retirer. Chaque commande est un module
// scripts/lib/relecture/commandes/<nom>.ts dont l'export par défaut reçoit (argv, contexte) et renvoie le
// code de sortie (0 fait, 1 refusé pour une raison de contenu, 2 usage). Une commande connue dont le module
// n'existe pas encore répond « commande pas encore installée » (code 2).

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { schemasDirOf } from '../src/lib/content-core/root.ts';
import { EditionRefusee } from './lib/relecture/editer.ts';
import type { Commande, Contexte } from './lib/relecture/etat.ts';
import { RegistreInvalide } from './lib/relecture/registre.ts';

export const COMMANDES = ['liste', 'marquer', 'note', 'servir', 'publier', 'retirer'] as const;

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PROJET = path.resolve(ICI, '..');

const USAGE = `Usage : npm run relecture -- [--root <dossier>] [--schemas <dossier>] <commande> [arguments]

Commandes :
  liste [--theme <id>] [--format texte|json]     ce qui reste à relire, par candidat
  marquer mesure <candidat/slug>                  pose statut_relecture: relu, relecteur, date_relecture
  marquer statut <candidat>                       idem sur le statut retenu du candidat
  marquer case <theme> <candidat>                 pose verifie_le et verifie_par sur la case de couverture
      options : --relecteur <nom> --date AAAA-MM-JJ --malgre-note --hors-perimetre
  note <cible> <texte> | note --resoudre <cible>  notes de correction (relecture/notes.jsonl)
  servir, publier, retirer                        ajoutées par les plans suivants
`;

export async function principal(argv: string[], ctx: Omit<Contexte, 'racine' | 'schemasDir'>, cwd = process.cwd()): Promise<number> {
  let racine: string | undefined;
  let schemas: string | undefined;
  let i = 0;
  while (i < argv.length && argv[i]!.startsWith('--')) {
    const opt = argv[i]!;
    const val = argv[i + 1];
    if ((opt === '--root' || opt === '--schemas') && val !== undefined && !val.startsWith('--')) {
      if (opt === '--root') racine = val;
      else schemas = val;
      i += 2;
    } else if (opt === '--help') {
      ctx.sortie(USAGE);
      return 0;
    } else {
      ctx.erreur(`option globale inconnue ou sans valeur : ${opt}`);
      ctx.erreur(USAGE);
      return 2;
    }
  }
  const nom = argv[i];
  if (nom === undefined || !(COMMANDES as readonly string[]).includes(nom)) {
    ctx.erreur(nom === undefined ? 'commande attendue' : `commande inconnue : ${nom}`);
    ctx.erreur(USAGE);
    return 2;
  }
  if (racine === undefined && path.resolve(cwd).split(path.sep).join('/').includes('/tests/fixtures/')) {
    ctx.erreur('le dossier courant est sous tests/fixtures/ : passer --root explicitement');
    return 2;
  }
  const module = path.join(ICI, 'lib', 'relecture', 'commandes', `${nom}.ts`);
  if (!existsSync(module)) {
    ctx.erreur(`commande pas encore installée : ${nom}`);
    return 2;
  }
  const contexte: Contexte = {
    ...ctx,
    racine: path.resolve(cwd, racine ?? '.'),
    schemasDir: schemas !== undefined ? path.resolve(cwd, schemas) : schemasDirOf(PROJET),
  };
  const charge = (await import(pathToFileURL(module).href)) as { default?: Commande };
  if (typeof charge.default !== 'function') {
    ctx.erreur(`module de commande invalide : ${nom}`);
    return 2;
  }
  try {
    return await charge.default(argv.slice(i + 1), contexte);
  } catch (e) {
    if (e instanceof EditionRefusee || e instanceof RegistreInvalide) {
      ctx.erreur(`refusé : ${e.message}`);
      return 1;
    }
    throw e;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = await principal(process.argv.slice(2), {
    sortie: (l) => process.stdout.write(`${l}\n`),
    erreur: (l) => process.stderr.write(`${l}\n`),
    maintenant: () => new Date(),
  });
  process.exitCode = code;
}
