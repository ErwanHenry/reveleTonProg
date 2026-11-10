// `relecture note <cible> <texte>` : ajoute une note de correction ouverte ; `relecture note --resoudre <cible>` :
// ferme les notes ouvertes de la cible. Les notes vont dans relecture/notes.jsonl, jamais dans src/content.
// Le dépôt est public : une note ne contient aucune donnée personnelle (voir relecture/README.md).

import { parseArgs } from 'node:util';
import { loadAll } from '../../../../src/lib/content-core/load.ts';
import { analyserCible, entreesDe, nomCible } from '../etat.ts';
import type { Chargeur, Cible, Contexte } from '../etat.ts';
import { ajouterNote, lireNotes, notesOuvertes, texteNoteValide } from '../registre.ts';

const USAGE = 'usage : relecture note <cible> <texte> | note --resoudre <cible> (cible : mesure:<candidat>/<slug>, statut:<candidat>, case:<theme>/<candidat>)';

/** La cible existe-t-elle dans le corpus chargé ? */
export function cibleExiste(cible: Cible, racine: string, schemasDir: string, charger: Chargeur = loadAll): boolean {
  const r = charger(racine, { schemasDir, mode: 'preview' });
  if (cible.type === 'mesure') return entreesDe(r, 'mesures').some((e) => e.id === cible.id);
  if (cible.type === 'statut') return entreesDe(r, 'candidats').some((e) => e.id === cible.candidat);
  return entreesDe(r, 'couverture').some(
    (e) => e.data.theme === cible.theme && Array.isArray(e.data.cases) && e.data.cases.some((k) => (k as Record<string, unknown>)?.candidat === cible.candidat),
  );
}

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { resoudre?: boolean };
  let p: string[];
  try {
    ({ values: v, positionals: p } = parseArgs({ args: argv, options: { resoudre: { type: 'boolean' } }, allowPositionals: true, strict: true }));
  } catch (e) {
    ctx.erreur(`note : ${e instanceof Error ? e.message : String(e)}`);
    ctx.erreur(USAGE);
    return 2;
  }
  const usage = (message: string): number => {
    ctx.erreur(`note : ${message}`);
    ctx.erreur(USAGE);
    return 2;
  };
  const [brute, ...mots] = p;
  if (brute === undefined) return usage('cible attendue');
  const cible = analyserCible(brute);
  if (cible === undefined) return usage(`cible invalide « ${brute} » (jamais un chemin)`);
  const nom = nomCible(cible);
  if (!cibleExiste(cible, ctx.racine, ctx.schemasDir)) {
    ctx.erreur(`refusé : ${nom} : cible inconnue dans le corpus`);
    return 1;
  }
  const horodatage = ctx.maintenant().toISOString();
  if (v.resoudre === true) {
    if (mots.length > 0) return usage('--resoudre ne prend que la cible');
    const ouvertes = notesOuvertes(lireNotes(ctx.racine)).get(nom) ?? [];
    if (ouvertes.length === 0) {
      ctx.sortie(`aucune note ouverte : ${nom}`);
      return 0;
    }
    ajouterNote(ctx.racine, { horodatage, cible: nom, texte: '', etat: 'resolue' });
    ctx.sortie(`${ouvertes.length} note(s) résolue(s) : ${nom}`);
    return 0;
  }
  const texte = mots.join(' ');
  const probleme = texteNoteValide(texte);
  if (probleme !== undefined) return usage(probleme);
  ajouterNote(ctx.racine, { horodatage, cible: nom, texte, etat: 'ouverte' });
  ctx.sortie(`note ouverte : ${nom}`);
  return 0;
}
