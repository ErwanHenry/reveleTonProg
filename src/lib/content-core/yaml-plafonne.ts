// IMP-01 (D-02) : point d'entrée unique des scripts qui lisent un fichier YAML du dépôt (import data.gouv,
// archivage des sources, tableau de couverture). Il reproduit l'analyse plafonnée de load.ts (parseYaml) : mêmes
// options (schéma « core », clés uniques, pas de fusion « << »), aucun alias accepté, mêmes messages français,
// même visite des alias avec ligne et colonne.
//
// Il n'importe PAS load.ts : src/pages/methode.astro importe scripts/lib/couverture.ts, et load.ts ferait entrer
// ajv et le moteur de règles dans la build de cette page. Le test tests/content-core/yaml-plafonne.test.ts donne
// les mêmes entrées hostiles aux deux analyseurs et compare leurs diagnostics champ par champ : changer les deux,
// ou aucun. Le test de dépôt tests/repo/yaml-plafonne.test.ts interdit toute autre lecture directe de 'yaml'.
import { LineCounter, parseDocument, visit } from 'yaml';
import type { Document } from 'yaml';
import type { Diagnostic } from './diagnostics.ts';

const OPTIONS_ANALYSE = { schema: 'core', uniqueKeys: true, merge: false } as const;
const OPTIONS_TOJS = { maxAliasCount: 0 } as const;

const MESSAGES_YAML: Record<string, string> = {
  DUPLICATE_KEY: 'clé en double dans le même objet',
  MULTIPLE_DOCS: 'plusieurs documents YAML dans le même fichier',
  TAG_RESOLVE_FAILED: 'balise YAML inconnue',
  BAD_INDENT: 'indentation incorrecte ou structure non terminée',
};
const MESSAGE_ALIAS = 'les alias YAML (*nom) sont interdits : répéter la valeur';
const MESSAGE_RACINE = 'le fichier doit contenir un objet YAML (clé: valeur) à la racine';

function diag(code: string, fichier: string, line: number, col: number, message: string): Diagnostic {
  return { code, severity: 'error', file: fichier, line, col, pointer: '', message };
}

function messageYaml(code: string, brut: string): string {
  const premiere = (brut.split('\n')[0] ?? brut).replace(/\s+at line \d+, column \d+:?$/, '').trim();
  const fr = MESSAGES_YAML[code];
  return fr ? `${fr} (${premiere})` : premiere;
}

export interface AnalyseYaml {
  /** Objet racine, seulement quand `diagnostics` est vide. */
  data: Record<string, unknown> | undefined;
  doc: Document.Parsed;
  diagnostics: Diagnostic[];
}

/** Analyse plafonnée, ne lève jamais pour une erreur de contenu. `fichier` : chemin relatif à la racine du dépôt. */
export function analyserYamlPlafonne(texte: string, fichier: string): AnalyseYaml {
  const lc = new LineCounter();
  const doc = parseDocument(texte, { ...OPTIONS_ANALYSE, lineCounter: lc });
  const diagnostics: Diagnostic[] = [];

  // Les avertissements (balise inconnue...) comptent comme des erreurs, comme dans load.ts.
  for (const err of [...doc.errors, ...doc.warnings]) {
    const pos = err.linePos?.[0] ?? lc.linePos(err.pos[0]);
    diagnostics.push(diag(`YAML_${err.code}`, fichier, pos.line, pos.col, messageYaml(err.code, err.message)));
  }

  let alias = false;
  visit(doc, {
    Alias(_cle, noeud) {
      alias = true;
      const pos = lc.linePos(noeud.range?.[0] ?? 0);
      diagnostics.push(diag('YAML_ALIAS_INTERDIT', fichier, pos.line, pos.col, MESSAGE_ALIAS));
    },
  });

  let data: unknown = undefined;
  if (!alias) {
    try {
      data = doc.toJS(OPTIONS_TOJS);
    } catch {
      diagnostics.push(diag('YAML_ALIAS_INTERDIT', fichier, 1, 1, MESSAGE_ALIAS));
    }
    if (diagnostics.length === 0 && (data === null || typeof data !== 'object' || Array.isArray(data))) {
      diagnostics.push(diag('YAML_RACINE_NON_OBJET', fichier, 1, 1, MESSAGE_RACINE));
    }
  }
  return { data: diagnostics.length === 0 ? (data as Record<string, unknown>) : undefined, doc, diagnostics };
}

/** `<fichier>:<ligne>:<col> <CODE> <message>` pour les `max` premiers, joints par « ; », puis « (+N autre(s)) ». */
export function messageRefus(diagnostics: readonly Diagnostic[], max = 3): string {
  const montres = diagnostics.slice(0, max).map((d) => `${d.file}:${d.line}:${d.col} ${d.code} ${d.message}`);
  const reste = diagnostics.length - montres.length;
  return `${montres.join(' ; ')}${reste > 0 ? ` (+${reste} autre(s))` : ''}`;
}

/** Refus d'un fichier YAML par l'analyse plafonnée ; le message nomme fichier, ligne, colonne et code. */
export class YamlRefuse extends Error {
  readonly diagnostics: Diagnostic[];
  constructor(diagnostics: Diagnostic[]) {
    super(messageRefus(diagnostics));
    this.name = 'YamlRefuse';
    this.diagnostics = diagnostics;
  }
}

/** Objet racine du fichier, ou `YamlRefuse`. */
export function lireYamlPlafonne(texte: string, fichier: string): Record<string, unknown> {
  const r = analyserYamlPlafonne(texte, fichier);
  if (r.diagnostics.length > 0 || r.data === undefined) throw new YamlRefuse(r.diagnostics);
  return r.data;
}

/** `Document` construit par l'analyse plafonnée (pour une édition en place), ou `YamlRefuse` aux mêmes conditions. */
export function lireDocumentPlafonne(texte: string, fichier: string): Document.Parsed {
  const r = analyserYamlPlafonne(texte, fichier);
  if (r.diagnostics.length > 0 || r.data === undefined) throw new YamlRefuse(r.diagnostics);
  return r.doc;
}
