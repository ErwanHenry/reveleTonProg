import type { Document, LineCounter } from 'yaml';
import { pointerToPos } from '../diagnostics.ts';
import type { Diagnostic } from '../diagnostics.ts';
import type { CollectionName } from '../collections.ts';
import { famille as citations } from './citations.ts';
import { famille as corpus } from './corpus.ts';
import { famille as redaction } from './redaction.ts';
import { famille as sondages } from './sondages.ts';
import { citer } from './types.ts';
import type { Corpus, FichierAnalyse, Famille, Finding, LoadedEntry, Mode, RuleContext } from './types.ts';

/** Registre des familles de règles, dans l'ordre d'exécution. */
export const FAMILLES: readonly Famille[] = [redaction, corpus, sondages, citations];

const cleEntree = (collection: CollectionName, id: string): string => `${collection}\u0000${id}`;

function construireCorpus(entries: readonly LoadedEntry[], listes: ReadonlyMap<CollectionName, ReadonlySet<string>>): Corpus {
  const parId = new Map<string, LoadedEntry>();
  for (const e of entries) parId.set(cleEntree(e.collection, e.id), e);
  return {
    entries,
    de: (collection) => entries.filter((e) => e.collection === collection),
    entree: (collection, id) => parId.get(cleEntree(collection, id)),
    listes,
    aDesInvalides: (collection) => {
      for (const id of listes.get(collection) ?? []) if (!parId.has(cleEntree(collection, id))) return true;
      return false;
    },
  };
}

interface Parse {
  doc: Document.Parsed;
  lc: LineCounter;
}

function enDiagnostic(f: Finding, defaut: string, parses: ReadonlyMap<string, Parse>): Diagnostic {
  const file = f.file ?? defaut;
  let pos = f.at;
  if (pos === undefined) {
    const p = parses.get(file);
    pos = p ? pointerToPos(p.doc, p.lc, f.pointer, 'key') : { line: 1, col: 1 };
  }
  return { code: f.code, severity: f.severity ?? 'error', file, line: pos.line, col: pos.col, pointer: f.pointer, message: f.message };
}

/**
 * Applique toutes les règles en trois niveaux (fichier, entrée, corpus), après le schéma. Une règle
 * qui lève une exception produit REGLE_ECHEC (fail-closed) au lieu de passer en silence ; les autres
 * règles continuent. Les messages ne citent du texte de contributeur que via citer().
 */
export function appliquerRegles(args: {
  mode: Mode;
  contentRoot: string;
  familles: readonly Famille[];
  fichiers: readonly FichierAnalyse[];
  entries: readonly LoadedEntry[];
  listes: ReadonlyMap<CollectionName, ReadonlySet<string>>;
}): Diagnostic[] {
  const { mode, contentRoot, familles, fichiers, entries, listes } = args;
  const parses = new Map<string, Parse>();
  for (const f of fichiers) parses.set(f.file, { doc: f.doc, lc: f.lc });
  for (const e of entries) parses.set(e.file, { doc: e.doc, lc: e.lc });
  const ctx: RuleContext = { mode, contentRoot, corpus: construireCorpus(entries, listes), cache: new Map() };
  const out: Diagnostic[] = [];

  // Une règle défaillante n'est signalée qu'une fois (au premier fichier touché) : elle échouera
  // en général partout, et une avalanche de REGLE_ECHEC noierait le vrai diagnostic.
  const echouees = new Set<string>();
  const executer = (regleId: string, defaut: string, run: () => Finding[]): void => {
    let findings: Finding[];
    try {
      findings = run();
    } catch (e) {
      if (echouees.has(regleId)) return;
      echouees.add(regleId);
      const raison = e instanceof Error ? e.message : String(e);
      out.push({
        code: 'REGLE_ECHEC',
        severity: 'error',
        file: defaut,
        line: 1,
        col: 1,
        pointer: '',
        message: `la règle « ${regleId} » a échoué : ${citer(raison, 200)}`,
      });
      return;
    }
    for (const f of findings) out.push(enDiagnostic(f, defaut, parses));
  };

  for (const fam of familles) for (const r of fam.fichier) for (const f of fichiers) executer(r.id, f.file, () => r.run(f, ctx));
  for (const fam of familles) for (const r of fam.entree) for (const e of entries) executer(r.id, e.file, () => r.run(e, ctx));
  for (const fam of familles) for (const r of fam.corpus) executer(r.id, contentRoot, () => r.run(ctx));
  return out;
}
