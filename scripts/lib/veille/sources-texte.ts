// Récupération du texte d'une source pour le relecteur automatique (phase 10.3, D-03).
//
// Le texte lu par l'agent est toujours récupéré par le code, jamais par l'agent : fetchSafe seulement (https
// public, adresses privées refusées, redirections revérifiées, plafonds de volume et de durée). Une page non HTML,
// une coquille JS ou une page vide est une source inaccessible pour la relecture. Aucun cache disque.
import { fetchSafe, type OptionsFetch } from '../fetch-safe.ts';
import { decodeHtml, htmlToText, looksClientRendered } from '../html-text.ts';

export const TEXTE_MAX = 30_000;

export type TexteSource =
  | { ok: true; url: string; texte: string; tronque: boolean }
  | { ok: false; echec: 'inaccessible' | 'non_html' | 'coquille_js' | 'vide' };

export async function recupererTexte(url: string, o: Pick<OptionsFetch, 'fetch' | 'lookup'> = {}): Promise<TexteSource> {
  let r;
  try {
    r = await fetchSafe(url, { ...o, maxOctets: 5 * 1024 * 1024, timeoutMs: 30_000 });
  } catch {
    // Le message de l'erreur n'est pas renvoyé : il peut citer l'adresse demandée ou résolue.
    return { ok: false, echec: 'inaccessible' };
  }
  const type = (r.contentType ?? '').toLowerCase();
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) return { ok: false, echec: 'non_html' };
  let html: string;
  let texte: string;
  try {
    html = decodeHtml(r.bytes, r.contentType);
    texte = htmlToText(html).text.trim();
  } catch {
    return { ok: false, echec: 'inaccessible' };
  }
  if (looksClientRendered(html, texte)) return { ok: false, echec: 'coquille_js' };
  if (texte === '') return { ok: false, echec: 'vide' };
  const tronque = texte.length > TEXTE_MAX;
  return { ok: true, url: r.finalUrl, texte: tronque ? texte.slice(0, TEXTE_MAX) : texte, tronque };
}
