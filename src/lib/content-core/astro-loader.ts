import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import type { CollectionName } from './collections.ts';
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
    const st = lstatSync(full);
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
      const run = (): void => {
        const { res, first } = shared(projectRoot, contentRoot);
        const errors = res.diagnostics.filter((d) => d.severity === 'error');
        if (first) {
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
      run();
      if (watcher) {
        watcher.add(path.join(contentRoot, 'src', 'content'));
        const again = (p: string): void => {
          if (p.split(path.sep).join('/').includes('/src/content/')) run();
        };
        watcher.on('change', again);
        watcher.on('add', again);
        watcher.on('unlink', again);
      }
    },
  };
}
