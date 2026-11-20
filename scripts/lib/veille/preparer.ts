// Veille des candidatures (phase 10.1) : `npm run veille -- preparer`.
//
// Monte la prise en compte du dernier jeu lu par la veille jusqu'à une branche LOCALE, et s'arrête là (décision
// d'Erwan du 2026-11-20 : « branche locale sans push »). Dans l'ordre : refus pendant un gel ; octets amont du
// dernier rapport (empreinte vérifiée) ; worktree ../reveleTonProg-import sur import/statuts-AAAA-MM-JJ depuis
// origin/main ; répétition à blanc : s'il reste une décision sur une personne, la liste des commandes `decider` et
// arrêt (code 3) ; sinon corps de pull request écrit hors dépôt, commit des décisions d'Erwan, import réel,
// pointeur et dates d'attribution, contrôles, commit de l'import, et la liste de ce qui reste à décider ou à relire.
//
// Ce que cette commande ne fait jamais : pousser, ouvrir ou fusionner une pull request, écrire une case de couverture,
// relire un statut, toucher au dossier de travail principal.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluerGel } from '../../garde-gel.ts';
import type { EntreeRapport, MotifADecider } from '../rapport-import.ts';
import type { Executer } from './alertes.ts';
import { classerVeille, resumeVeilleMarkdown } from './classer.ts';
import { ecrirePrive, lireEtat } from './etat.ts';

/** Gel d'import décidé le 2026-11-13 (RUNBOOK « Gel d'import ») : bornes incluses, heure de Paris. */
export const GEL_IMPORT = { debut: new Date('2026-12-13T18:00:00+01:00'), fin: new Date('2026-12-15T23:59:59+01:00') };

export class ArretPreparer extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export interface DependancesPreparer {
  dossier: string;
  /** Dossier de travail principal (racine du dépôt git commun). */
  depot: string;
  executer: Executer;
  maintenant: () => Date;
  node: string;
  journal: (ligne: string) => void;
}

export interface OptionsPreparer {
  /** Dossier du worktree d'import (défaut : ../reveleTonProg-import à côté du dépôt). */
  dossierImport?: string;
}

export interface ResultatPreparer {
  code: 0 | 3 | 4;
  worktree: string;
  branche: string;
  corps: string | null;
}

/** Refus pendant le gel d'import de décembre 2026 et les fenêtres de garde-gel.ts (2027). */
export function verifierGel(instant: Date): void {
  if (instant >= GEL_IMPORT.debut && instant <= GEL_IMPORT.fin) {
    throw new ArretPreparer(5, 'gel d’import du 13 décembre 2026 à 18:00 au 15 décembre 2026 à 23:59 : aucune préparation ; la veille continue de détecter (RUNBOOK, Gel d’import)');
  }
  const g = evaluerGel(instant, false, '');
  if (g.gele) throw new ArretPreparer(5, `${g.motif} : aucune préparation ; la veille continue de détecter`);
}

const dateParisJour = (t: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
const jjmmaaaa = (iso: string): string => {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
};

/** Pointeur, ATTRIBUTION.md et LICENSE alignés sur le nouvel instantané (mises à jour mécaniques, aucune décision). */
export function miseAJourMecanique(racine: string, nomInstantane: string, miseAJour: string, lignes: number): string[] {
  const touches: string[] = [];
  const remplacer = (rel: string, fn: (t: string) => string): void => {
    const f = path.join(racine, rel);
    const avant = readFileSync(f, 'utf8');
    const apres = fn(avant);
    if (apres !== avant) {
      writeFileSync(f, apres);
      touches.push(rel);
    }
  };
  const date = jjmmaaaa(miseAJour);
  remplacer('data/dataset-datagouv.yaml', (t) => t.replace(/^instantane: .*$/m, `instantane: data/import/${nomInstantane}`));
  remplacer('data/import/ATTRIBUTION.md', (t) =>
    t.replace(/mises à jour le \d{2}\/\d{2}\/\d{4}/g, `mises à jour le ${date}`).replace(/le fichier du \d{2}\/\d{2}\/\d{4} en contient \d+/g, `le fichier du ${date} en contient ${lignes}`),
  );
  remplacer('LICENSE', (t) => t.replace(/mises à jour le \d{2}\/\d{2}\/\d{4}/g, `mises à jour le ${date}`));
  return touches;
}

interface SortieJson {
  version: number;
  entree: EntreeRapport;
  motifsADecider: MotifADecider[];
  markdown: string;
}

export function preparerImport(d: DependancesPreparer, o: OptionsPreparer = {}): ResultatPreparer {
  const maintenant = d.maintenant();
  verifierGel(maintenant);

  const etat = lireEtat(d.dossier);
  if (etat.dernierAmont === null || etat.derniereEmpreinte === null) throw new ArretPreparer(2, 'aucun jeu amont lu par la veille : lancer d’abord npm run veille');
  if (!existsSync(etat.dernierAmont)) throw new ArretPreparer(2, `octets amont introuvables : ${etat.dernierAmont}`);
  const octets = readFileSync(etat.dernierAmont);
  if (createHash('sha256').update(octets).digest('hex') !== etat.derniereEmpreinte) throw new ArretPreparer(2, 'empreinte des octets amont gardés différente de celle de l’état : refus');

  const git = (args: string[], cwd = d.depot): { status: number | null; stdout: string; stderr: string } => d.executer('git', args, { cwd, timeoutMs: 120_000 });
  const gitOk = (args: string[], cwd = d.depot): string => {
    const r = git(args, cwd);
    if (r.status !== 0) throw new ArretPreparer(1, `git ${args.join(' ')} a échoué : ${r.stderr.trim().split('\n').slice(-1)[0] ?? ''}`);
    return r.stdout.trim();
  };

  const branche = `import/statuts-${dateParisJour(maintenant)}`;
  const worktree = path.resolve(o.dossierImport ?? path.join(path.dirname(d.depot), 'reveleTonProg-import'));
  if (worktree === path.resolve(d.depot)) throw new ArretPreparer(2, 'le worktree d’import ne peut pas être le dossier de travail principal');

  if (!existsSync(worktree)) {
    gitOk(['fetch', '--quiet', 'origin']);
    const existe = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branche}`]).status === 0;
    gitOk(existe ? ['worktree', 'add', '--quiet', worktree, branche] : ['worktree', 'add', '--quiet', '-b', branche, worktree, 'origin/main']);
    const ci = d.executer('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: worktree, timeoutMs: 600_000 });
    if (ci.status !== 0) throw new ArretPreparer(1, `npm ci a échoué dans ${worktree}`);
    d.journal(`worktree d’import créé : ${worktree} (${branche})`);
  } else {
    const courante = gitOk(['rev-parse', '--abbrev-ref', 'HEAD'], worktree);
    if (!courante.startsWith('import/')) throw new ArretPreparer(2, `${worktree} est sur la branche « ${courante} », pas sur une branche import/… : refus`);
    const sale = gitOk(['status', '--porcelain'], worktree)
      .split('\n')
      .filter((l) => l.trim() !== '' && !l.endsWith(' data/import/correspondances.yaml'));
    if (sale.length > 0) throw new ArretPreparer(2, `${worktree} contient d’autres modifications que les décisions de correspondances.yaml : ${sale.slice(0, 3).join(' ; ')}`);
  }

  // Répétition à blanc dans le worktree d'import (décisions comprises, avant l'import).
  const r = d.executer(d.node, ['scripts/import-datagouv.ts', '--dry-run', '--format', 'json', '--file', etat.dernierAmont, '--root', worktree], { cwd: worktree, timeoutMs: 300_000 });
  let sortie: SortieJson;
  try {
    sortie = JSON.parse(r.stdout) as SortieJson;
  } catch {
    throw new ArretPreparer(1, `répétition à blanc illisible (code ${r.status}) : ${r.stderr.trim().split('\n').slice(-1)[0] ?? ''}`);
  }
  const classement = classerVeille(sortie.entree);
  if (classement.decisions.length > 0) {
    d.journal(`${classement.decisions.length} décision(s) sur une personne à prendre par Erwan, dans un terminal, avant de préparer :`);
    for (const x of classement.decisions) d.journal(`  cd ${worktree} && npm run veille -- decider ${x.idAmont}   (${x.genre === 'motif' ? 'motif du désistement' : 'ligne de correspondances.yaml'})`);
    d.journal('puis relancer : npm run veille -- preparer');
    return { code: 3, worktree, branche, corps: null };
  }
  if (sortie.entree.conflits.length > 0 || r.status !== 0) {
    throw new ArretPreparer(1, `la répétition à blanc signale ${sortie.entree.conflits.length} conflit(s) (code ${r.status}) : voir le rapport de la veille ; rien n’est importé`);
  }
  if (!classement.notable && sortie.entree.plans.every((p) => p.avant !== null)) {
    d.journal('aucun changement de statut ni personne nouvelle : rien à importer (les dérives de source ne s’importent pas)');
    return { code: 0, worktree, branche, corps: null };
  }

  // Corps de la pull request : résumé de la veille et rapport d'import, sans texte amont non relu (dépôt public).
  const corps = path.join(d.dossier, 'pr', `${dateParisJour(maintenant)}-${etat.derniereEmpreinte.slice(0, 12)}.md`);
  ecrirePrive(corps, `${resumeVeilleMarkdown(classement)}\n${sortie.markdown}`);

  if (gitOk(['status', '--porcelain', '--', 'data/import/correspondances.yaml'], worktree) !== '') {
    gitOk(['add', '--', 'data/import/correspondances.yaml'], worktree);
    gitOk(['commit', '--quiet', '-m', 'import(statuts): lignes de correspondances.yaml décidées par Erwan (npm run veille -- decider)'], worktree);
  }

  const imp = d.executer(d.node, ['scripts/import-datagouv.ts', '--file', etat.dernierAmont, '--root', worktree], { cwd: worktree, timeoutMs: 300_000 });
  if (imp.status !== 0) throw new ArretPreparer(1, `import réel refusé (code ${imp.status}) : ${imp.stderr.trim().split('\n').slice(-1)[0] ?? ''} ; la branche garde le commit des décisions`);
  const touches = miseAJourMecanique(worktree, sortie.entree.instantane.nom, sortie.entree.instantane.miseAJour, sortie.entree.instantane.lignes);
  d.journal(`mises à jour mécaniques : ${touches.join(', ') || 'aucune'}`);

  const controles: [string, string[]][] = [
    ['cohérence instantané / fiches', ['scripts/import-datagouv.ts', '--check', '--root', worktree]],
    ['ids.lock', ['scripts/ids.ts', '--root', worktree, '--check']],
    ['validation de production', ['scripts/validate.ts', '--root', worktree, '--mode', 'production']],
  ];
  const echecs: string[] = [];
  for (const [nom, args] of controles) {
    const c = d.executer(d.node, args, { cwd: worktree, timeoutMs: 300_000 });
    d.journal(`contrôle ${nom} : ${c.status === 0 ? 'réussi' : `ÉCHEC (code ${c.status})`}`);
    if (c.status !== 0) echecs.push(nom);
  }

  gitOk(['add', '--all', '--', 'data', 'src/content/candidats', 'ids.lock', 'LICENSE'], worktree);
  gitOk(['commit', '--quiet', '-m', `import(statuts): jeu data.gouv du ${sortie.entree.instantane.miseAJour} (${etat.derniereEmpreinte.slice(0, 12)}), statuts en brouillon`], worktree);

  d.journal('');
  d.journal(`Branche locale prête : ${branche} dans ${worktree} (rien n’est poussé). Corps de pull request : ${corps}`);
  d.journal('Reste à décider ou à relire, par Erwan seul, sur cette branche :');
  for (const t of classement.consequences) {
    if (t.casAcreer.length > 0) d.journal(`  - thème ${t.theme} : case de couverture à créer AVANT de relire le statut de ${t.casAcreer.map((x) => x.id).join(', ')} (src/content/couverture/${t.theme}.yaml)`);
    if (t.sortants.length > 0) d.journal(`  - thème ${t.theme} : sortira du périmètre une fois le statut relu : ${t.sortants.map((x) => x.id).join(', ')}`);
  }
  if (classement.entrees.length > 0) d.journal(`  - data/couverture-themes.yaml et cases des thèmes pilotes pour chaque nouvelle personne du périmètre : ${classement.entrees.map((m) => m.id).join(', ')} (RUNBOOK, liste de contrôle, points 6 et 7)`);
  for (const m of [...classement.sorties, ...classement.entrees, ...classement.retours, ...classement.autres]) d.journal(`  - relire le statut : npm run relecture -- marquer statut ${m.id}${m.apres.startsWith('renonce') || m.apres.startsWith('empeche') ? ' --hors-perimetre' : ''}`);
  d.journal('  - textes qui annoncent un compte : README.md, docs/COUVERTURE-THEMES.md');
  d.journal('Puis, quand vous le décidez :');
  d.journal(`  git -C ${worktree} push -u origin ${branche}`);
  d.journal(`  gh pr create --repo ErwanHenry/reveleTonProg --base main --head ${branche} --title "import(statuts): jeu data.gouv du ${sortie.entree.instantane.miseAJour}" --body-file ${corps}`);
  if (echecs.length > 0) {
    d.journal(`Contrôles en échec : ${echecs.join(', ')} ; à corriger sur la branche avant la pull request.`);
    return { code: 4, worktree, branche, corps };
  }
  return { code: 0, worktree, branche, corps };
}
