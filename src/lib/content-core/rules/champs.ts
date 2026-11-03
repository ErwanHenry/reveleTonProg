import { isPair, isScalar, isSeq, visit } from 'yaml';
import { CHAMPS_NON_IMPORTABLES } from './config.ts';
import type { FileRule, Finding } from './types.ts';

// REGLE-12 : trois clés du dataset data.gouv (bloc, extdroite, propositions) ne doivent jamais
// entrer dans src/content/. Le contrôle lit l'arbre YAML (clés de paires, à toute profondeur) et
// jamais le texte brut : le mot « propositions » dans une rédaction est légitime.

const INTERDITES: ReadonlySet<string> = new Set(CHAMPS_NON_IMPORTABLES);

const echapper = (s: string): string => s.replaceAll('~', '~0').replaceAll('/', '~1');
const cleDe = (key: unknown): string => String(isScalar(key) ? key.value : key);

export const regleChamps: FileRule = {
  id: 'champs_non_importables',
  run(f) {
    const out: Finding[] = [];
    visit(f.doc, {
      Pair(_k, pair, chemin) {
        const nom = cleDe(pair.key);
        if (!INTERDITES.has(nom)) return undefined;
        // Pointeur JSON reconstruit depuis les ancêtres : clés de paires et indices de séquences.
        const segments: string[] = [];
        chemin.forEach((noeud, i) => {
          const suivant = chemin[i + 1] ?? pair;
          if (isPair(noeud)) segments.push(echapper(cleDe(noeud.key)));
          else if (isSeq(noeud)) segments.push(String((noeud.items as unknown[]).indexOf(suivant)));
        });
        segments.push(echapper(nom));
        const debut = (pair.key as { range?: [number, number, number] | null } | null)?.range?.[0];
        const finding: Finding = {
          code: 'CHAMP_NON_IMPORTABLE',
          pointer: `/${segments.join('/')}`,
          file: f.file,
          message: `le champ « ${nom} » du dataset data.gouv ne doit jamais figurer dans le contenu`,
        };
        if (debut !== undefined) finding.at = f.lc.linePos(debut);
        out.push(finding);
        return undefined;
      },
    });
    return out;
  },
};
