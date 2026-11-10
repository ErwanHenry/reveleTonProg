// `relecture liste [--theme <id>] [--format texte|json] [--relecteur <nom>]` : ce qui reste à relire, par candidat.

import path from 'node:path';
import { parseArgs } from 'node:util';
import { relecteurValide } from '../editer.ts';
import { RELECTEUR_DEFAUT, chargerCorpus, entreesDe, erreursDuTheme, etatRelecture, themesAvecMesures } from '../etat.ts';
import type { Alerte, Chargeur, Contexte, EtatTheme } from '../etat.ts';

const LIBELLES: Record<string, string> = { a_relire: 'à relire', relu: 'relu', a_revoir: 'à revoir (modifié depuis la relecture)', publie: 'publié' };

function resumeAlertes(alertes: readonly Alerte[]): string {
  if (alertes.length === 0) return '';
  const par = new Map<string, number>();
  for (const a of alertes) par.set(a.code, (par.get(a.code) ?? 0) + 1);
  return ` ; alertes : ${[...par].map(([c, n]) => (n > 1 ? `${c} x${n}` : c)).join(', ')}`;
}

function notes(n: number): string {
  return n === 0 ? '' : ` ; ${n} note(s) ouverte(s)`;
}

function enTexte(e: EtatTheme, ctx: Contexte): void {
  ctx.sortie(`Thème ${e.theme} : ${e.candidats.length} candidat(s) dans le périmètre`);
  for (const c of e.candidats) {
    ctx.sortie('');
    ctx.sortie(`${c.nom} (${c.id})`);
    for (const m of c.mesures) ctx.sortie(`  mesure ${m.id} : ${LIBELLES[m.etat]}${resumeAlertes(m.alertes)}${notes(m.notes.length)}`);
    if (c.mesures.length === 0) ctx.sortie('  aucune mesure sur ce thème');
    if (c.statut) ctx.sortie(`  statut ${c.statut.code} du ${c.statut.date} (statuts[${c.statut.index}]) : ${LIBELLES[c.statut.etat]}${resumeAlertes(c.statut.alertes)}${notes(c.statut.notes.length)}`);
    if (c.case) ctx.sortie(`  case ${c.case.etat_case} (vérifiée le ${c.case.verifie_le} par ${c.case.verifie_par}) : ${LIBELLES[c.case.etat]}${resumeAlertes(c.case.alertes)}${notes(c.case.notes.length)}`);
    else ctx.sortie('  aucune case de couverture');
  }
  ctx.sortie('');
  ctx.sortie(`reste ${e.reste} sur ${e.total}`);
}

function enJson(e: EtatTheme, racine: string): unknown {
  const rel = (f: string): string => path.relative(racine, f).split(path.sep).join('/');
  return {
    theme: e.theme,
    reste: e.reste,
    total: e.total,
    candidats: e.candidats.map((c) => ({
      id: c.id,
      nom: c.nom,
      mesures: c.mesures.map((m) => ({ ...m, file: rel(m.file) })),
      statut: c.statut ? { ...c.statut, file: rel(c.statut.file) } : null,
      case: c.case ? { ...c.case, file: rel(c.case.file) } : null,
    })),
  };
}

export async function liste(argv: string[], ctx: Contexte, charger?: Chargeur): Promise<number> {
  let v: { theme?: string; format?: string; relecteur?: string };
  try {
    ({ values: v } = parseArgs({ args: argv, options: { theme: { type: 'string' }, format: { type: 'string' }, relecteur: { type: 'string' } }, allowPositionals: false, strict: true }));
  } catch (e) {
    ctx.erreur(`liste : ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const format = v.format ?? 'texte';
  if (format !== 'texte' && format !== 'json') {
    ctx.erreur(`liste : format inconnu « ${format} » (texte ou json)`);
    return 2;
  }
  const relecteur = v.relecteur ?? RELECTEUR_DEFAUT;
  if (!relecteurValide(relecteur)) {
    ctx.erreur(`liste : nom de relecteur refusé « ${relecteur} »`);
    return 2;
  }
  const corpus = chargerCorpus(ctx.racine, ctx.schemasDir, charger);
  const connus = new Set(entreesDe(corpus.preview, 'themes').map((t) => t.id));
  if (v.theme !== undefined && !connus.has(v.theme)) {
    ctx.erreur(`liste : thème inconnu « ${v.theme} » (thèmes : ${[...connus].sort().join(', ')})`);
    return 2;
  }
  const themes = v.theme !== undefined ? [v.theme] : themesAvecMesures(corpus.preview);

  let code = 0;
  const etats: EtatTheme[] = [];
  for (const theme of themes) {
    const erreurs = erreursDuTheme(corpus, theme);
    for (const d of erreurs) ctx.erreur(`erreur : ${path.relative(ctx.racine, d.file)}:${d.line}:${d.col} ${d.code} ${d.message}`);
    if (erreurs.length > 0) code = 1;
    etats.push(etatRelecture(ctx.racine, ctx.schemasDir, theme, { corpus, relecteur }));
  }

  if (format === 'json') {
    const objets = etats.map((e) => enJson(e, ctx.racine));
    ctx.sortie(JSON.stringify(objets.length === 1 ? objets[0] : objets, null, 2));
  } else {
    etats.forEach((e, i) => {
      if (i > 0) ctx.sortie('');
      enTexte(e, ctx);
    });
    if (etats.length > 1) ctx.sortie(`reste ${etats.reduce((s, e) => s + e.reste, 0)} sur ${etats.reduce((s, e) => s + e.total, 0)} (tous thèmes)`);
  }
  return code;
}

export default function commande(argv: string[], ctx: Contexte): Promise<number> {
  return liste(argv, ctx);
}
