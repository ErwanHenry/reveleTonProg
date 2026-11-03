import { CHAMPS_CHIFFRES, CHAMPS_CHIFFRES_AVERTIS, FRAGMENTS_CITATION, TEXTE_SOURCE_MOTS } from './config.ts';
import { lireArchive } from './archives.ts';
import { champsEditoriaux } from './redaction.ts';
import { sansMarqueurs } from './text/normalize.ts';
import { extractNumberWords, extractNumbers } from './text/numbers.ts';
import { aEllipse, haystack, quoteIn } from './text/verbatim.ts';
import { extractWordNumbers } from './text/word-numbers.ts';
import { countWords, quoteSpans } from './text/words.ts';
import { citer } from './types.ts';
import type { CorpusRule, EntryRule, Famille, Finding, LoadedEntry, RuleContext } from './types.ts';

// Famille « citations » (REGLE-04, REGLE-05) : chaque chiffre et chaque citation d'une mesure
// remonte, mot pour mot, au texte de la source, lui-même retrouvé dans l'extrait archivé.

const texteSourceDe = (m: Pick<LoadedEntry, 'data'>): string | undefined =>
  typeof m.data.texte_source === 'string' ? sansMarqueurs(m.data.texte_source) : undefined;

/** Rappel des conditions d'une citation à ellipse, ajouté au message quand elle en contient une. */
const indiceEllipse = (citation: string): string =>
  aEllipse(citation)
    ? ` Avec une ellipse, chaque fragment compte au moins ${FRAGMENTS_CITATION.motsMin} mots, suit le précédent dans l'ordre de la source et en est éloigné de ${FRAGMENTS_CITATION.ecartMax} mots au plus.`
    : '';

const chiffrageDe = (m: Pick<LoadedEntry, 'data'>): string | undefined => {
  const c = m.data.chiffrage;
  if (c === null || typeof c !== 'object' || Array.isArray(c)) return undefined;
  const t = (c as Record<string, unknown>).texte;
  return typeof t === 'string' ? sansMarqueurs(t) : undefined;
};

/**
 * REGLE-04 : (1) aucun chiffre de résumé, enfant ou aîné (erreur), ni du titre ou du détaillé (avertissement), absent de texte_source et de chiffrage.texte
 * (le chiffrage n'est digne de confiance que s'il est lui-même dans l'archive : corpus `textes_archives`) ;
 * (2) toute citation « … » d'un champ éditorial de la mesure figure mot pour mot dans texte_source ;
 * (3) garde-fou de longueur de texte_source (un texte_source démesuré légitimerait n'importe quoi).
 */
const chiffresCitations: EntryRule = {
  id: 'chiffres_citations',
  run(e, ctx) {
    if (e.collection !== 'mesures') return [];
    const source = texteSourceDe(e);
    if (source === undefined) return [];
    const chiffrage = chiffrageDe(e);
    const out: Finding[] = [];

    const sources = chiffrage === undefined ? source : `${source} ${chiffrage}`;
    // WR-08 : les nombres en toutes lettres de la source (« deux millions ») comptent comme leur
    // valeur en chiffres, et inversement : « 2 millions » dans une rédaction est établi par la source.
    const nombres = new Set([...extractNumbers(sources), ...extractWordNumbers(sources).map((n) => n.valeur)]);
    const motsNombres = new Set(extractNumberWords(sources));
    for (const { pointer, texte: brut } of champsEditoriaux(e)) {
      const strict = (CHAMPS_CHIFFRES as readonly string[]).includes(pointer);
      if (!strict && !(CHAMPS_CHIFFRES_AVERTIS as readonly string[]).includes(pointer)) continue;
      const texte = sansMarqueurs(brut);
      const niveau = pointer.slice(pointer.lastIndexOf('/') + 1);
      for (const valeur of new Set(extractNumbers(texte))) {
        if (nombres.has(valeur)) continue;
        const message = `le nombre « ${citer(valeur)} » du champ « ${niveau} » ne figure ni dans texte_source ni dans chiffrage.texte : le retirer ou l'établir dans la source.`;
        out.push(
          strict
            ? { code: 'CHIFFRE_HORS_SOURCE', pointer, message }
            : { code: 'CHIFFRE_DETAILLE_HORS_SOURCE', severity: 'warning', pointer, message },
        );
      }
      // Nombres en toutes lettres : comparés par valeur (« trois » est établi par « 3 » dans la source).
      const couverts = new Set<string>();
      for (const { valeur, mots } of extractWordNumbers(texte)) {
        for (const m of mots) couverts.add(m);
        if (nombres.has(valeur)) continue;
        out.push({
          code: 'NOMBRE_LETTRES_HORS_SOURCE',
          severity: 'warning',
          pointer,
          message: `le nombre écrit en lettres « ${citer(mots.join(' '))} » du champ « ${niveau} » ne figure pas dans la source : vérifier qu'il vient bien d'elle.`,
        });
      }
      // Quantités floues (dizaine, moitié, tiers, ordinaux…) : comparées mot pour mot.
      for (const mot of new Set(extractNumberWords(texte))) {
        if (couverts.has(mot) || motsNombres.has(mot)) continue;
        out.push({
          code: 'NOMBRE_LETTRES_HORS_SOURCE',
          severity: 'warning',
          pointer,
          message: `le nombre écrit en lettres « ${citer(mot)} » du champ « ${niveau} » ne figure pas dans la source : vérifier qu'il vient bien d'elle.`,
        });
      }
    }

    const hay = haystack(source);
    for (const { pointer, texte } of champsEditoriaux(e)) {
      for (const citation of quoteSpans(sansMarqueurs(texte))) {
        if (quoteIn(citation, hay)) continue;
        out.push({
          code: 'CITATION_HORS_SOURCE',
          pointer,
          message: `la citation « ${citer(citation)} » ne figure pas mot pour mot dans texte_source.${indiceEllipse(citation)}`,
        });
      }
    }

    const n = countWords(source);
    if (n < TEXTE_SOURCE_MOTS.min) {
      out.push({
        code: 'TEXTE_SOURCE_TROP_COURT',
        severity: 'warning',
        pointer: '/texte_source',
        message: `texte_source ne compte que ${n} mot${n > 1 ? 's' : ''} (minimum conseillé ${TEXTE_SOURCE_MOTS.min}) : un extrait trop court ne justifie pas la mesure.`,
      });
    } else if (n > TEXTE_SOURCE_MOTS.max) {
      out.push({
        code: 'TEXTE_SOURCE_TROP_LONG',
        // Garde-fou anti-contournement (WR-04) : un texte_source démesuré légitimerait tous les
        // chiffres et toutes les citations. Erreur en production, avertissement en preview.
        severity: ctx.mode === 'production' ? 'error' : 'warning',
        pointer: '/texte_source',
        message: `texte_source compte ${n} mots (maximum ${TEXTE_SOURCE_MOTS.max}) : citer l'extrait précis qui fonde la mesure.`,
      });
    }
    return out;
  },
};

/** Texte d'archive normalisé, calculé une fois par source et par chargement. */
function meule(ctx: RuleContext, sourceId: string, texte: string): string {
  const cle = `haystack:${sourceId}`;
  const memo = ctx.cache.get(cle);
  if (typeof memo === 'string') return memo;
  const h = haystack(texte);
  ctx.cache.set(cle, h);
  return h;
}

/**
 * REGLE-05 : texte_source et chiffrage.texte figurent mot pour mot dans l'extrait archivé de la
 * source. Ignoré quand l'archive est déjà signalée défaillante (pas de cascade d'erreurs).
 */
const textesArchives: CorpusRule = {
  id: 'textes_archives',
  run(ctx) {
    const out: Finding[] = [];
    for (const m of ctx.corpus.de('mesures')) {
      const sourceId = m.data.source;
      if (typeof sourceId !== 'string') continue;
      const archive = lireArchive(ctx, sourceId);
      if (archive.etat !== 'ok') continue;
      const hay = meule(ctx, sourceId, archive.texte);
      const ts = texteSourceDe(m);
      if (ts !== undefined && !quoteIn(ts, hay)) {
        out.push({
          code: 'TEXTE_SOURCE_HORS_ARCHIVE',
          pointer: '/texte_source',
          file: m.file,
          message: `texte_source ne figure pas mot pour mot dans l'extrait archivé de la source « ${sourceId} » : « ${citer(ts)} »${indiceEllipse(ts)}`,
        });
      }
      const ch = chiffrageDe(m);
      if (ch !== undefined && !quoteIn(ch, hay)) {
        out.push({
          code: 'CHIFFRAGE_HORS_ARCHIVE',
          pointer: '/chiffrage/texte',
          file: m.file,
          message: `chiffrage.texte ne figure pas mot pour mot dans l'extrait archivé de la source « ${sourceId} » : « ${citer(ch)} »${indiceEllipse(ch)}`,
        });
      }
    }
    return out;
  },
};

export const famille: Famille = {
  id: 'citations',
  fichier: [],
  entree: [chiffresCitations],
  corpus: [textesArchives],
};
