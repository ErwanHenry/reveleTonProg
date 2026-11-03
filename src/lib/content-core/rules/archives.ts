import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { checkContained } from '../contained.ts';
import { ARCHIVE_TAILLE_MAX } from './config.ts';
import type { CorpusRule, Finding, LoadedEntry, RuleContext } from './types.ts';

// REGLE-01, moitié « corpus » : la source citée existe, appartient au candidat de la mesure, et son
// archive est présente, de taille bornée, identique octet pour octet à l'empreinte sha256.
// Ce module n'importe jamais load.ts (cycle) ; la nature primaire d'une source se lit dans `type`
// (schéma, plan 02-02), jamais dans le nom d'hôte de l'URL.

export type EtatArchive = { etat: 'ok'; texte: string; fichier: string } | { etat: 'inutilisable' };

type Analyse = { etat: 'ok'; texte: string; fichier: string } | { etat: 'inutilisable'; finding?: Finding };

interface ArchiveSource {
  extrait: string;
  sha256: string;
  wayback_url?: string;
}

const archiveDe = (source: LoadedEntry): ArchiveSource | undefined => {
  const a = source.data.archive;
  return a !== null && typeof a === 'object' ? (a as ArchiveSource) : undefined;
};

function analyserArchive(ctx: RuleContext, source: LoadedEntry): Analyse {
  const archive = archiveDe(source);
  if (archive === undefined || typeof archive.extrait !== 'string') return { etat: 'inutilisable' };
  const erreur = (code: string, pointer: string, message: string): Analyse => ({
    etat: 'inutilisable',
    finding: { code, pointer, message, file: source.file },
  });
  const fichier = path.join(ctx.contentRoot, archive.extrait);

  const refus = checkContained(ctx.contentRoot, fichier);
  if (refus !== undefined) {
    const raison = refus.code === 'FICHIER_ILLISIBLE' ? 'fichier introuvable ou illisible' : refus.message;
    return erreur('ARCHIVE_ABSENTE', '/archive/extrait', `l'extrait archivé « ${archive.extrait} » est inutilisable : ${raison}`);
  }
  let octets: Buffer;
  try {
    const taille = statSync(fichier).size;
    if (taille > ARCHIVE_TAILLE_MAX) {
      return erreur(
        'ARCHIVE_TROP_VOLUMINEUX',
        '/archive/extrait',
        `l'extrait archivé fait ${taille} octets, au-delà du maximum de ${ARCHIVE_TAILLE_MAX} octets`,
      );
    }
    octets = readFileSync(fichier);
  } catch {
    return erreur('ARCHIVE_ABSENTE', '/archive/extrait', `l'extrait archivé « ${archive.extrait} » est introuvable ou illisible`);
  }
  const empreinte = createHash('sha256').update(octets).digest('hex');
  if (empreinte !== archive.sha256) {
    return erreur(
      'ARCHIVE_SHA256_DIVERGENT',
      '/archive/sha256',
      `l'empreinte sha256 déclarée ne correspond pas aux octets de l'extrait archivé (calculée : ${empreinte})`,
    );
  }
  return { etat: 'ok', texte: octets.toString('utf8'), fichier };
}

function analyser(ctx: RuleContext, sourceId: string): Analyse {
  const cle = `archive:${sourceId}`;
  const memo = ctx.cache.get(cle) as Analyse | undefined;
  if (memo !== undefined) return memo;
  const source = ctx.corpus.entree('sources', sourceId);
  const res: Analyse = source === undefined ? { etat: 'inutilisable' } : analyserArchive(ctx, source);
  ctx.cache.set(cle, res);
  return res;
}

/**
 * Extrait d'archive d'une source, lu une seule fois par chargement (mémo `archive:<id>`). Renvoie
 * `inutilisable` quand la source est absente ou invalide, ou quand son archive échoue un contrôle.
 */
export function lireArchive(ctx: RuleContext, sourceId: string): EtatArchive {
  const a = analyser(ctx, sourceId);
  return a.etat === 'ok' ? { etat: 'ok', texte: a.texte, fichier: a.fichier } : { etat: 'inutilisable' };
}

/** Chaque source valide : l'échec de son archive est signalé une fois, sur le fichier de la source. */
export const regleArchives: CorpusRule = {
  id: 'archives',
  run(ctx) {
    const out: Finding[] = [];
    for (const source of ctx.corpus.de('sources')) {
      const a = analyser(ctx, source.id);
      if (a.etat === 'inutilisable' && a.finding !== undefined) out.push(a.finding);
    }
    return out;
  },
};

/** Chaque mesure valide : source connue, source du bon candidat, copie Wayback une fois publiée. */
export const regleSources: CorpusRule = {
  id: 'sources',
  run(ctx) {
    const out: Finding[] = [];
    const publiees = new Set<string>();
    for (const m of ctx.corpus.de('mesures')) {
      const sourceId = m.data.source;
      if (typeof sourceId !== 'string') continue;
      if (!(ctx.corpus.listes.get('sources')?.has(sourceId) ?? false)) {
        out.push({ code: 'SOURCE_INCONNUE', pointer: '/source', file: m.file, message: `la source « ${sourceId} » n'existe pas dans src/content/sources/` });
        continue;
      }
      const source = ctx.corpus.entree('sources', sourceId);
      if (source === undefined) continue; // source invalide : son erreur de schéma suffit
      const candidats = source.data.candidats;
      if (Array.isArray(candidats) && !candidats.includes(m.data.candidat)) {
        out.push({
          code: 'SOURCE_AUTRE_CANDIDAT',
          pointer: '/source',
          file: m.file,
          message: `la source « ${sourceId} » n'est pas une source du candidat « ${String(m.data.candidat)} » (candidats de la source : ${candidats.map(String).join(', ')})`,
        });
      }
      if (m.data.statut_relecture === 'publie') publiees.add(sourceId);
    }
    for (const sourceId of [...publiees].sort()) {
      const source = ctx.corpus.entree('sources', sourceId);
      if (source === undefined) continue;
      const archive = archiveDe(source);
      if (archive !== undefined && (typeof archive.wayback_url !== 'string' || archive.wayback_url === '')) {
        out.push({
          code: 'ARCHIVE_WAYBACK_ABSENTE',
          pointer: '/archive',
          file: source.file,
          message: `la source « ${sourceId} » est citée par une mesure publiée mais n'a pas de capture Wayback Machine (archive.wayback_url)`,
        });
      }
    }
    return out;
  },
};
