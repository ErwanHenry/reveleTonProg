import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import type { CollectionName } from './collections.ts';
import { clearSchemaCache } from './ajv.ts';
import { formatText } from './diagnostics.ts';
import { loadAll } from './load.ts';
import type { LoadResult } from './load.ts';
import { resolveContentRoot, schemasDirOf } from './root.ts';

// Loader objet Astro, volontairement SANS `schema` ni `parseData` : toute la validation
// est faite par content-core (le même `loadAll` que la CLI), Astro ne reparse rien et les
// dates restent des chaînes (DATA-07).

/** Empreinte (chemin relatif + mtime + taille) de tous les fichiers sous `dir`. */
function fingerprintDir(dir: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of names) {
    const full = path.join(dir, name);
    let st;
    try {
      st = lstatSync(full);
    } catch {
      continue; // supprimé ou renommé entre readdir et lstat (enregistrement par renommage des éditeurs)
    }
    if (st.isDirectory() && !st.isSymbolicLink()) fingerprintDir(full, out);
    else out.push(`${full}:${st.mtimeMs}:${st.size}`);
  }
}

function fingerprint(projectRoot: string, contentRoot: string): string {
  const parts: string[] = [projectRoot, contentRoot];
  fingerprintDir(path.join(contentRoot, 'src', 'content'), parts);
  fingerprintDir(schemasDirOf(projectRoot), parts);
  return parts.join('\n');
}

// Les 8 loaders partagent UN SEUL loadAll par synchronisation ; le premier qui lit le
// résultat journalise les diagnostics (une fois, pas 8 fois).
let memo: { key: string; res: LoadResult; reported: boolean } | undefined;

function shared(projectRoot: string, contentRoot: string): { res: LoadResult; first: boolean } {
  const key = fingerprint(projectRoot, contentRoot);
  if (memo?.key !== key) {
    memo = { key, res: loadAll(contentRoot, { schemasDir: schemasDirOf(projectRoot) }), reported: false };
  }
  const first = !memo.reported;
  memo.reported = true;
  return { res: memo.res, first };
}

export function contentCoreLoader(name: CollectionName): Loader {
  return {
    name: `content-core:${name}`,
    load: async ({ config, store, generateDigest, logger, watcher }) => {
      const projectRoot = fileURLToPath(config.root);
      const contentRoot = resolveContentRoot(projectRoot);
      const runOnce = (): void => {
        const { res, first } = shared(projectRoot, contentRoot);
        const errors = res.diagnostics.filter((d) => d.severity === 'error');
        if (first) {
          // Jusqu'à la Phase 3 la racine par défaut est le corpus fictif : on l'affiche pour qu'un
          // build de production ne parte jamais sur un mauvais corpus sans que ce soit visible.
          logger.info(`racine de contenu : ${path.relative(projectRoot, contentRoot).split(path.sep).join('/') || '.'}`);
          for (const d of res.diagnostics) {
            if (d.severity === 'error') logger.error(formatText(d, projectRoot));
            else logger.warn(formatText(d, projectRoot));
          }
        }
        if (errors.length > 0) {
          // Build : on échoue. Dev : on garde les données précédentes pour ne pas tuer le serveur.
          if (!watcher) throw new Error(`content-core : ${errors.length} erreur(s) de contenu, build interrompu`);
          return;
        }
        store.clear();
        for (const e of res.entries) {
          if (e.collection !== name) continue;
          store.set({
            id: e.id,
            data: e.data,
            digest: generateDigest(e.data),
            filePath: path.relative(projectRoot, e.file).split(path.sep).join('/'),
          });
        }
      };
      // Dev : une erreur d'E/S, de schéma ou de lecture ne doit jamais tuer le serveur (on journalise et
      // on garde les données précédentes). Build : on relance l'erreur, le build doit échouer.
      const run = (): void => {
        try {
          runOnce();
        } catch (e) {
          if (!watcher) throw e;
          logger.error(`content-core : ${e instanceof Error ? e.message : String(e)}`);
        }
      };
      run();
      if (watcher) {
        const schemasDir = schemasDirOf(projectRoot);
        watcher.add(path.join(contentRoot, 'src', 'content'));
        watcher.add(schemasDir);
        const inside = (p: string, dir: string): boolean => (path.resolve(p) + path.sep).startsWith(path.resolve(dir) + path.sep);
        const again = (p: string): void => {
          if (inside(p, schemasDir)) {
            clearSchemaCache(); // sinon le cache Ajv sert encore les anciens schémas compilés
            run();
          } else if (inside(p, path.join(contentRoot, 'src', 'content'))) run();
        };
        watcher.on('change', again);
        watcher.on('add', again);
        watcher.on('unlink', again);
      }
    },
  };
}
