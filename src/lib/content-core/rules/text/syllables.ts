import { KANDEL_MOLES } from '../config.ts';
import { sentences } from './sentences.ts';
import { words } from './words.ts';

// Heuristique de syllabes françaises et indice de lisibilité Kandel-Moles (REGLE-06). Module PUR.
// Les valeurs de référence figées dans les tests viennent de Lexique 3.83 (voir tests/text/syllables.test.ts).

// Convention de Lexique 3 (nbsyll) : syllabes prononcées ; e final muet exclu, e interne compté.
const V = 'aeiouyàâäéèêëîïôöùûüÿ';
const NASAL_ENT = new Set([
  'moment', 'vent', 'souvent', 'comment', 'argent', 'agent', 'agents', 'client', 'clients', 'président', 'présidents', 'accident', 'accidents',
  'différent', 'différents', 'évident', 'patient', 'patients', 'récent', 'récents', 'content', 'contents', 'parent', 'parents', 'cent', 'dent',
  'dents', 'lent', 'lents', 'talent', 'talents', 'urgent', 'excellent', 'violent', 'permanent', 'document', 'documents', 'instrument',
  'instruments', 'gent', 'sergent', 'serpent', 'présent', 'absent', 'effet',
]);

export function syllables(word: string): number {
  let w = word.normalize('NFC').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  // nombre en chiffres : approximation (« 50000 » ~ 4, « 3,5 » ~ 3)
  if (/\d/.test(w)) return (w.match(/\d+/g) ?? []).reduce((a, run) => a + Math.min(run.length, 4), 0) + (/\d[.,]\d/.test(w) ? 1 : 0);
  w = w.replace(/[^a-zà-ÿ]/g, '');
  if (w === '') return 0;
  const verbEnt = w.length > 4 && w.endsWith('ent') && !w.endsWith('ment') && !NASAL_ENT.has(w);
  w = w
    .replace(/([qg])u(?=[eiyéèêë])/g, '$1') // qu / gu devant e, i, y : u muet
    .replace(/(?<=[aeiouéèêàâôû])y(?=[aeiouéèêàâôû])/g, 'j') // loyer, voyage : y consonne
    .replace(/^y(?=[aeiou])/, 'j')
    .replace(/([bcdfgpt][lr][iu])(?=[aeoéèêâô])/g, '$1.') // diérèse après consonne + liquide (crier, influence)
    .replace(/(?<=[éèê])(?=[aeiouyàâäéèêëîïôöùûüÿ])/g, '.') // hiatus : é + voyelle (créer, nucléaire)
    .replace(/(?<=[aeoyàâäéèêëîïôöùûüÿ])(?=[éèê])/g, '.') // hiatus : voyelle + é (aérien, poète), pas après i/u (société, joué)
    .replace(/(?<=[aeiouyàâäéèêëîïôöùûüÿ])(?=[äëïöüÿ])/g, '.'); // tréma (maïs, Noël)
  const groups = w.split(new RegExp(`[^${V}]+`)).filter(Boolean);
  let n = groups.length;
  if (n > 1 && groups[n - 1] === 'e' && (/es?$/.test(w) || verbEnt)) n -= 1; // e final muet (-e, -es, -ent verbal)
  return Math.max(1, n);
}

/** Kandel-Moles (1958) : base − 1,015 × mots/phrase − 73,6 × syllabes/mot. NaN si texte vide. */
export function kandelMoles(text: string): number {
  const ws = words(text);
  const ss = sentences(text);
  if (ws.length === 0 || ss.length === 0) return Number.NaN;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  return KANDEL_MOLES.base - KANDEL_MOLES.motsParPhrase * (ws.length / ss.length) - KANDEL_MOLES.syllabesParMot * (syl / ws.length);
}
