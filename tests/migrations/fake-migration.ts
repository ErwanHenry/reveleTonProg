import { isMap, isScalar } from 'yaml';
import type { Migration } from '../../src/lib/content-core/migrate.ts';

/** Migration factice candidat v0 -> v1 : renomme `etiquette` en `parti`, à la même place (ordre des clés conservé). */
export const fakeMigration: Migration = {
  schema: 'candidat',
  from: 0,
  to: 1,
  migrate(doc) {
    const root = doc.contents;
    if (!isMap(root)) return;
    for (const pair of root.items) {
      if (isScalar(pair.key) && pair.key.value === 'etiquette') pair.key.value = 'parti';
    }
  },
};
