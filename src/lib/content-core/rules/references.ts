import { lstatSync } from 'node:fs';
import path from 'node:path';
import type { CollectionName } from '../collections.ts';
import { readContained } from '../contained.ts';
import { IDS_LOCK, comparerIdsLock, lireIdsLock } from '../ids-lock.ts';
import { CHAMPS_EDITORIAUX, MARQUEUR_GLOSSAIRE } from './config.ts';
import { slugGlossaire } from './text/normalize.ts';
import { citer } from './types.ts';
import type { CorpusRule, Finding, LoadedEntry, RuleContext } from './types.ts';

// REGLE-07 : intégrité du corpus. Toute règle ne regarde que les entrées valides au schéma, et une
// cible qui existe mais échoue son propre schéma n'est jamais re-signalée (pas de cascade d'erreurs).

const existe = (ctx: RuleContext, collection: CollectionName, id: unknown): boolean =>
  typeof id === 'string' && (ctx.corpus.listes.get(collection)?.has(id) ?? false);

const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

// Déplacé dans le module texte pur (Phase 4) pour que les composants Astro l'importent sans node:fs.
export { slugGlossaire };

/** Valeurs texte d'un champ éditorial, `*` désignant chaque élément d'un tableau. */
function valeursTexte(donnees: unknown, pointeur: string): { pointer: string; texte: string }[] {
  let courant: { pointer: string; valeur: unknown }[] = [{ pointer: '', valeur: donnees }];
  for (const seg of pointeur.split('/').slice(1)) {
    const suivant: { pointer: string; valeur: unknown }[] = [];
    for (const c of courant) {
      if (seg === '*') {
        tableau(c.valeur).forEach((v, i) => suivant.push({ pointer: `${c.pointer}/${i}`, valeur: v }));
      } else if (c.valeur !== null && typeof c.valeur === 'object' && !Array.isArray(c.valeur)) {
        const v = (c.valeur as Record<string, unknown>)[seg];
        if (v !== undefined) suivant.push({ pointer: `${c.pointer}/${seg}`, valeur: v });
      }
    }
    courant = suivant;
  }
  return courant.flatMap((c) => (typeof c.valeur === 'string' ? [{ pointer: c.pointer, texte: c.valeur }] : []));
}

function referencesEntree(ctx: RuleContext, e: LoadedEntry, out: Finding[]): void {
  const casse = (pointer: string, message: string): void => {
    out.push({ code: 'REFERENCE_CASSEE', pointer, message, file: e.file });
  };
  const verifier = (pointer: string, collection: CollectionName, id: unknown, libelle: string): void => {
    if (!existe(ctx, collection, id)) casse(pointer, `${libelle} « ${citer(String(id))} » n'existe pas dans ${collection}`);
  };
  const d = e.data;

  switch (e.collection) {
    case 'mesures': {
      verifier('/candidat', 'candidats', d.candidat, 'le candidat');
      verifier('/theme', 'themes', d.theme, 'le thème');
      const theme = typeof d.theme === 'string' ? ctx.corpus.entree('themes', d.theme) : undefined;
      if (theme !== undefined) {
        const ids = tableau(theme.data.sous_themes).map((s) => objet(s).id);
        if (!ids.includes(d.sous_theme)) casse('/sous_theme', `le sous-thème « ${citer(String(d.sous_theme))} » n'existe pas dans le thème « ${theme.id} »`);
      }
      break;
    }
    case 'sources':
      tableau(d.candidats).forEach((c, i) => verifier(`/candidats/${i}`, 'candidats', c, 'le candidat'));
      break;
    case 'couverture':
      verifier('/theme', 'themes', d.theme, 'le thème');
      tableau(d.cases).forEach((cas, i) => {
        verifier(`/cases/${i}/candidat`, 'candidats', objet(cas).candidat, 'le candidat');
        tableau(objet(cas).sources_consultees).forEach((s, j) => verifier(`/cases/${i}/sources_consultees/${j}`, 'sources', s, 'la source'));
      });
      break;
    case 'sondages':
      tableau(d.hypotheses).forEach((h, i) =>
        tableau(objet(h).scores).forEach((s, j) => verifier(`/hypotheses/${i}/scores/${j}/candidat`, 'candidats', objet(s).candidat, 'le candidat')),
      );
      break;
    case 'journal': {
      if (d.type === 'retrait') break; // la cible d'un retrait n'existe plus, c'est normal
      const cible = d.collection_cible;
      if (typeof cible === 'string' && ctx.corpus.listes.has(cible as CollectionName)) {
        verifier('/id_cible', cible as CollectionName, d.id_cible, `la cible « ${cible} »`);
      }
      break;
    }
    default:
      break;
  }

  // Renvois au glossaire [[affiché]] / [[affiché|id]] dans les champs éditoriaux.
  for (const champ of CHAMPS_EDITORIAUX[e.collection] ?? []) {
    for (const { pointer, texte } of valeursTexte(d, champ)) {
      for (const m of texte.matchAll(MARQUEUR_GLOSSAIRE)) {
        const id = m[2] ?? slugGlossaire(m[1] ?? '');
        if (!existe(ctx, 'glossaire', id)) casse(pointer, `le renvoi au glossaire « ${citer(m[0])} » pointe vers un terme « ${citer(id)} » qui n'existe pas`);
      }
    }
  }
}

/** REFERENCE_CASSEE : thème, sous-thème, candidat, sources de couverture, sondage, journal, glossaire. */
export const regleReferences: CorpusRule = {
  id: 'references',
  run(ctx) {
    const out: Finding[] = [];
    for (const e of ctx.corpus.entries) referencesEntree(ctx, e, out);
    return out;
  },
};

/** ID_* : les identifiants de candidats sont verrouillés dans ids.lock (même comparateur que `npm run ids`). */
export const regleIdsVerrouilles: CorpusRule = {
  id: 'ids_verrouilles',
  run(ctx) {
    const fichierLock = path.join(ctx.contentRoot, IDS_LOCK);
    const lockInvalide = (message: string): Finding => ({
      code: 'IDS_LOCK_INVALIDE',
      pointer: '',
      message,
      file: fichierLock,
      at: { line: 1, col: 1 },
    });
    let lock: ReturnType<typeof lireIdsLock> | undefined;
    if (lstatSync(fichierLock, { throwIfNoEntry: false }) !== undefined) {
      const lu = readContained(ctx.contentRoot, fichierLock);
      if ('diagnostic' in lu) return [lockInvalide(`${IDS_LOCK} illisible : ${lu.diagnostic.message}`)];
      lock = lireIdsLock(lu.text);
    }
    const candidats = [...(ctx.corpus.listes.get('candidats') ?? [])];
    return comparerIdsLock(lock, candidats).map((p): Finding => {
      if (p.code === 'ID_NON_VERROUILLE') {
        return {
          code: p.code,
          pointer: '/id',
          message: p.message, // dit déjà : lancer npm run ids -- --write
          file: path.join(ctx.contentRoot, 'src', 'content', 'candidats', `${p.id ?? ''}.yaml`),
        };
      }
      return { code: p.code, pointer: '', message: p.message, file: fichierLock, at: { line: p.ligne, col: 1 } };
    });
  },
};
