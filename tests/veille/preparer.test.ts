// Phase 10.1 : décisions d'Erwan (`decider`) et préparation de la branche d'import (`preparer`). Faux terminal, faux
// git, fausse répétition à blanc, personnes fictives. Aucune commande réelle, sauf le refus sans terminal (CLI).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EntreeRapport } from '../../scripts/lib/rapport-import.ts';
import type { Executer } from '../../scripts/lib/veille/alertes.ts';
import { RefusDecider, ajouterCorrespondance, ajouterMotif, decider, ligneAmont } from '../../scripts/lib/veille/decider.ts';
import type { Terminal } from '../../scripts/lib/veille/decider.ts';
import { ecrireEtat, ETAT_VIDE } from '../../scripts/lib/veille/etat.ts';
import { ArretPreparer, miseAJourMecanique, preparerImport, verifierGel } from '../../scripts/lib/veille/preparer.ts';
import { lireCorrespondances } from '../../scripts/lib/datagouv.ts';
import { lireYamlPlafonne } from '../../src/lib/content-core/yaml-plafonne.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-veille-prep-'));
  dossiers.push(d);
  return d;
};

const TABLE = `version: 1
correspondances:
  # commentaire conservé
  essai-connu:
    id: essai-connu
    prenom: Essai
    nom: Connu
    nom_tri: Connu
    type_source_statut: presse
`;

function fauxTerminal(reponses: string[]): Terminal & { sorti: string } {
  const t = {
    sorti: '',
    ecrire: (x: string) => {
      t.sorti += x;
    },
    lireLigne: () => {
      const r = reponses.shift();
      if (r === undefined) throw new RefusDecider(3, 'saisie interrompue');
      return r;
    },
    fermer: () => {},
  };
  return t;
}
function racineImport(): string {
  const r = tmp();
  mkdirSync(path.join(r, 'data', 'import'), { recursive: true });
  writeFileSync(path.join(r, 'data', 'import', 'correspondances.yaml'), TABLE);
  return r;
}
const amont = (id: string, statut: string) => ({ id, nom: 'Essai Nouveau', statut, source: { url: 'https://exemple.test/s', date: '2026-11-20' }, statut_detail: 'Texte amont fictif' });

describe('veille decider', () => {
  it('personne nouvelle déclarée : chaque champ est demandé, rien n’est prérempli, la ligne est ajoutée et se relit', () => {
    const r = racineImport();
    const t = fauxTerminal(['essai-nouveau', 'Essai', 'Nouveau', 'Nouveau', 'candidat', 'oui']);
    const res = decider(t, r, amont('nouveau-amont', 'declare'));
    assert.equal(res.ajout, 'correspondance');
    const texte = readFileSync(path.join(r, 'data', 'import', 'correspondances.yaml'), 'utf8');
    assert.match(texte, /# commentaire conservé/);
    const table = lireCorrespondances(lireYamlPlafonne(texte, 'x'));
    assert.deepEqual(table['nouveau-amont'], { id: 'essai-nouveau', prenom: 'Essai', nom: 'Nouveau', nom_tri: 'Nouveau', type_source_statut: 'candidat' });
    assert.match(t.sorti, /Texte amont non relu : Texte amont fictif/);
    assert.doesNotMatch(t.sorti, /essai-nouveau \?|\[essai/, 'aucune valeur proposée');
    assert.doesNotMatch(t.sorti, /Motif/, 'pas de motif pour un statut declare');
  });

  it('personne nouvelle qui renonce : le motif est demandé parmi les quatre', () => {
    const r = racineImport();
    const t = fauxTerminal(['essai-autre', 'Essai', 'Autre', 'Autre', 'presse', 'ralliement', 'oui']);
    decider(t, r, amont('autre-amont', 'renonce'));
    const table = lireCorrespondances(lireYamlPlafonne(readFileSync(path.join(r, 'data', 'import', 'correspondances.yaml'), 'utf8'), 'x'));
    assert.equal(table['autre-amont']?.motif, 'ralliement');
  });

  it('personne connue qui se désiste sans motif : seul le motif est ajouté, avant type_source_statut', () => {
    const r = racineImport();
    decider(fauxTerminal(['non_candidat', 'oui']), r, amont('essai-connu', 'renonce'));
    const texte = readFileSync(path.join(r, 'data', 'import', 'correspondances.yaml'), 'utf8');
    assert.match(texte, / {4}nom_tri: Connu\n {4}motif: non_candidat\n {4}type_source_statut: presse\n/);
  });

  it('valeur refusée trois fois, abandon ou saisie interrompue : rien n’est écrit', () => {
    for (const reponses of [['MAUVAIS', 'mauvais', 'x y'], ['essai-nouveau', 'Essai', 'Nouveau', 'Nouveau', 'candidat', 'non'], ['essai-nouveau']]) {
      const r = racineImport();
      assert.throws(() => decider(fauxTerminal(reponses), r, amont('nouveau-amont', 'declare')), RefusDecider);
      assert.equal(readFileSync(path.join(r, 'data', 'import', 'correspondances.yaml'), 'utf8'), TABLE);
    }
  });

  it('identifiant déjà utilisé, motif déjà présent, statut sans décision : refus', () => {
    assert.throws(() => decider(fauxTerminal(['essai-connu', 'essai-connu', 'essai-connu']), racineImport(), amont('n', 'declare')), /trois saisies/);
    assert.throws(() => decider(fauxTerminal([]), racineImport(), amont('essai-connu', 'declare')), /rien à décider/);
    assert.throws(() => ajouterMotif(ajouterMotif(TABLE, 'essai-connu', 'retrait'), 'essai-connu', 'retrait'), /déjà un motif/);
  });

  it('valeurs spéciales en YAML : guillemets, relues à l’identique', () => {
    const t = ajouterCorrespondance(TABLE, 'x-amont', { id: 'x-y', prenom: 'Yes', nom: 'D’Essai: deux', nom_tri: '#tri', type_source_statut: 'presse' });
    const e = lireCorrespondances(lireYamlPlafonne(t, 'x'))['x-amont'];
    assert.deepEqual([e?.prenom, e?.nom, e?.nom_tri], ['Yes', 'D’Essai: deux', '#tri']);
  });

  it('ligneAmont : identifiant absent du jeu, refus nommé', () => {
    assert.throws(() => ligneAmont(Buffer.from('{"candidats":[]}'), 'absent'), /absent du dernier jeu/);
  });

  it('CLI sans terminal de contrôle : refus code 3 avant toute autre action', () => {
    // detached : nouvelle session (setsid), donc aucun terminal de contrôle, même quand npm test tourne dans un terminal.
    const options = { cwd: REPO_ROOT, encoding: 'utf8' as const, detached: true, env: { ...process.env, RTP_VEILLE_DIR: tmp() } };
    const res = spawnSync(process.execPath, ['scripts/veille.ts', 'decider', 'nimporte'], options as Parameters<typeof spawnSync>[2] & { encoding: 'utf8' });
    assert.equal(res.status, 3, res.stderr);
    assert.match(res.stderr, /aucun terminal/);
  });
});

// ---- preparer -------------------------------------------------------------------------------------------------

function entree(over: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    instantane: { nom: '2027etmoi-candidats-2026-11-20-dddddddddddd.json', sha256: 'd'.repeat(64), miseAJour: '2026-11-20', lignes: 62, precedent: null },
    plans: [],
    inconnus: [],
    conflits: [],
    precedent: null,
    idsAmont: [],
    fichesAbsentes: [],
    candidats: [],
    themes: [],
    mesures: [],
    couvertures: [],
    themesOuverts: [],
    ...over,
  };
}
const statut = (code: string, date: string): Record<string, unknown> => ({ code, date, source: { type: 'presse', url: 'https://exemple.test/s', date_publication: date, date_consultation: date }, statut_relecture: 'brouillon' });
const PLAN_ENTREE = { id: 'essai-nouveau', idAmont: 'nouveau-amont', avant: null, apres: { id: 'essai-nouveau', statuts: [statut('declare', '2026-11-20')] }, mappe: { id: 'essai-nouveau', statuts: [statut('declare', '2026-11-20')] } };

interface MondePrep {
  dossier: string;
  depot: string;
  worktree: string;
  appels: { commande: string; args: string[]; cwd?: string }[];
  journal: string[];
  sortie: EntreeRapport;
  executer: Executer;
}

function mondePrep(): MondePrep {
  const dossier = tmp();
  const parent = tmp();
  const depot = path.join(parent, 'reveleTonProg');
  mkdirSync(depot);
  const octets = Buffer.from('{"mise_a_jour":"2026-11-20","candidats":[]}');
  const sha = createHash('sha256').update(octets).digest('hex');
  const amontF = path.join(dossier, 'amont', `${sha}.json`);
  mkdirSync(path.dirname(amontF), { recursive: true });
  writeFileSync(amontF, octets);
  ecrireEtat(dossier, { ...ETAT_VIDE, derniereEmpreinte: sha, dernierAmont: amontF });
  const m: MondePrep = { dossier, depot, worktree: path.join(parent, 'reveleTonProg-import'), appels: [], journal: [], sortie: entree({ plans: [PLAN_ENTREE] }), executer: undefined as unknown as Executer };
  m.executer = (commande, args, options = {}) => {
    m.appels.push({ commande, args, cwd: options.cwd });
    const ok = { status: 0, stdout: '', stderr: '' };
    if (commande === 'git') {
      if (args[0] === 'rev-parse' && args[1] === '--verify') return { status: 1, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return { status: 0, stdout: 'import/statuts-2026-11-20\n', stderr: '' };
      if (args[0] === 'worktree') {
        const wt = args.includes('-b') ? (args[args.indexOf('-b') + 2] as string) : (args[2] as string);
        mkdirSync(path.join(wt, 'data', 'import'), { recursive: true });
        cpSync(path.join(REPO_ROOT, 'data', 'dataset-datagouv.yaml'), path.join(wt, 'data', 'dataset-datagouv.yaml'));
        cpSync(path.join(REPO_ROOT, 'data', 'import', 'ATTRIBUTION.md'), path.join(wt, 'data', 'import', 'ATTRIBUTION.md'));
        cpSync(path.join(REPO_ROOT, 'LICENSE'), path.join(wt, 'LICENSE'));
        return ok;
      }
      if (args[0] === 'status' && args.includes('data/import/correspondances.yaml')) return { status: 0, stdout: ' M data/import/correspondances.yaml\n', stderr: '' };
      return ok;
    }
    if (commande === 'npm') return ok;
    if (commande === 'node' && args.includes('--dry-run')) return { status: 0, stdout: JSON.stringify({ version: 1, entree: m.sortie, motifsADecider: m.sortie.motifsADecider ?? [], markdown: '# Rapport de répétition à blanc\n' }), stderr: '' };
    if (commande === 'node') return ok;
    return { status: 1, stdout: '', stderr: 'inattendu' };
  };
  return m;
}
const deps = (m: MondePrep, quand = '2026-11-20T09:00:00+01:00') => ({ dossier: m.dossier, depot: m.depot, executer: m.executer, maintenant: () => new Date(quand), node: 'node', journal: (l: string) => m.journal.push(l) });

describe('veille preparer', () => {
  it('gel d’import de décembre et gels des tours : refus, code 5, aucune commande', () => {
    for (const quand of ['2026-12-13T18:00:00+01:00', '2026-12-15T23:59:00+01:00', '2027-04-18T12:00:00+02:00']) {
      const m = mondePrep();
      assert.throws(() => preparerImport(deps(m, quand)), (e: Error) => e instanceof ArretPreparer && e.code === 5);
      assert.equal(m.appels.length, 0);
    }
    assert.doesNotThrow(() => verifierGel(new Date('2026-12-13T17:59:00+01:00')));
    assert.doesNotThrow(() => verifierGel(new Date('2026-12-16T00:00:00+01:00')));
  });

  it('décisions en attente : worktree créé depuis origin/main, commandes decider listées, code 3, aucun import', () => {
    const m = mondePrep();
    m.sortie = entree({ inconnus: [{ id: 'nouveau-amont', nom: 'Essai Nouveau', parti: '', statut: 'declare', source: { titre: 't', url: 'https://exemple.test/n', date: '2026-11-20' }, liens: {}, verifie_le: '2026-11-20' }] });
    const r = preparerImport(deps(m));
    assert.equal(r.code, 3);
    assert.equal(r.branche, 'import/statuts-2026-11-20');
    assert.ok(m.appels.some((a) => a.commande === 'git' && a.args.join(' ') === `worktree add --quiet -b import/statuts-2026-11-20 ${m.worktree} origin/main`));
    assert.ok(m.journal.some((l) => l.includes('npm run veille -- decider nouveau-amont')));
    assert.ok(!m.appels.some((a) => a.commande === 'node' && !a.args.includes('--dry-run')));
  });

  it('sans décision : corps de PR hors dépôt, commit des décisions, import, mises à jour, contrôles, commit ; jamais de push', () => {
    const m = mondePrep();
    const r = preparerImport(deps(m));
    assert.equal(r.code, 0, m.journal.join('\n'));
    assert.ok(r.corps !== null && r.corps.startsWith(path.join(m.dossier, 'pr')));
    const corps = readFileSync(r.corps, 'utf8');
    assert.match(corps, /# Veille des candidatures/);
    assert.doesNotMatch(corps, /Texte amont non relu/);
    const nodes = m.appels.filter((a) => a.commande === 'node').map((a) => a.args[0] + (a.args.includes('--dry-run') ? ' dry' : a.args.includes('--check') ? ' check' : ''));
    assert.deepEqual(nodes, ['scripts/import-datagouv.ts dry', 'scripts/import-datagouv.ts', 'scripts/import-datagouv.ts check', 'scripts/ids.ts check', 'scripts/validate.ts']);
    const commits = m.appels.filter((a) => a.commande === 'git' && a.args[0] === 'commit').map((a) => a.args[3]);
    assert.equal(commits.length, 2);
    assert.match(commits[0] as string, /décidées par Erwan/);
    assert.match(commits[1] as string, /statuts en brouillon/);
    for (const a of m.appels) assert.ok(!(a.commande === 'git' && a.args[0] === 'push') && a.commande !== 'gh', `${a.commande} ${a.args.join(' ')}`);
    assert.match(readFileSync(path.join(m.worktree, 'data', 'dataset-datagouv.yaml'), 'utf8'), /^instantane: data\/import\/2027etmoi-candidats-2026-11-20-dddddddddddd\.json$/m);
    assert.match(readFileSync(path.join(m.worktree, 'LICENSE'), 'utf8'), /mises à jour le 20\/11\/2026/);
    assert.match(readFileSync(path.join(m.worktree, 'data', 'import', 'ATTRIBUTION.md'), 'utf8'), /le fichier du 20\/11\/2026 en contient 62/);
    assert.ok(m.journal.some((l) => l.includes('git -C') && l.includes('push -u origin import/statuts-2026-11-20')), 'la commande de push est donnée à Erwan, pas lancée');
    assert.ok(m.journal.some((l) => l.includes('relire le statut : npm run relecture -- marquer statut essai-nouveau')));
  });

  it('worktree existant sur une autre branche, ou modifié hors correspondances.yaml : refus', () => {
    const m = mondePrep();
    mkdirSync(m.worktree, { recursive: true });
    const base = m.executer;
    m.executer = (c, a, o) => (c === 'git' && a[1] === '--abbrev-ref' ? { status: 0, stdout: 'main\n', stderr: '' } : base(c, a, o));
    assert.throws(() => preparerImport(deps(m)), /pas sur une branche import/);
    m.executer = (c, a, o) => (c === 'git' && a[0] === 'status' && !a.includes('--') ? { status: 0, stdout: ' M src/content/candidats/x.yaml\n', stderr: '' } : base(c, a, o));
    assert.throws(() => preparerImport(deps(m)), /d’autres modifications/);
  });

  it('octets amont falsifiés : refus avant tout git', () => {
    const m = mondePrep();
    const f = readdirSync(path.join(m.dossier, 'amont'))[0] as string;
    writeFileSync(path.join(m.dossier, 'amont', f), '{"autre":true}');
    assert.throws(() => preparerImport(deps(m)), /empreinte/);
    assert.equal(m.appels.length, 0);
  });

  it('miseAJourMecanique sur une copie : seules les dates et le pointeur changent', () => {
    const r = tmp();
    mkdirSync(path.join(r, 'data', 'import'), { recursive: true });
    cpSync(path.join(REPO_ROOT, 'data', 'dataset-datagouv.yaml'), path.join(r, 'data', 'dataset-datagouv.yaml'));
    cpSync(path.join(REPO_ROOT, 'data', 'import', 'ATTRIBUTION.md'), path.join(r, 'data', 'import', 'ATTRIBUTION.md'));
    cpSync(path.join(REPO_ROOT, 'LICENSE'), path.join(r, 'LICENSE'));
    const avant = readFileSync(path.join(r, 'LICENSE'), 'utf8');
    assert.deepEqual(miseAJourMecanique(r, 'nouveau.json', '2026-12-10', 61), ['data/dataset-datagouv.yaml', 'data/import/ATTRIBUTION.md', 'LICENSE']);
    const apres = readFileSync(path.join(r, 'LICENSE'), 'utf8');
    assert.equal(apres.split('\n').filter((l, i) => avant.split('\n')[i] !== l).length, 1);
    assert.ok(existsSync(path.join(r, 'data', 'dataset-datagouv.yaml')));
  });
});

describe('code de la veille', () => {
  it('aucun appel à git push, gh pr create ni gh pr merge (les commandes sont seulement imprimées pour Erwan)', () => {
    const dir = path.join(REPO_ROOT, 'scripts', 'lib', 'veille');
    for (const f of [...readdirSync(dir).map((n) => path.join(dir, n)), path.join(REPO_ROOT, 'scripts', 'veille.ts')]) {
      const t = readFileSync(f, 'utf8');
      assert.doesNotMatch(t, /executer\(\s*'gh'/, f);
      assert.doesNotMatch(t, /\[\s*'push'/, f);
      assert.doesNotMatch(t, /'pr',\s*'(create|merge)'/, f);
    }
  });
});
