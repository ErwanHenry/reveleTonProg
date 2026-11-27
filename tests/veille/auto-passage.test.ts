// Phase 10.3, plan 09 : passage complet de l'automate (mode, verrou, boîte d'envoi, reprise, préparation, poussée,
// déploiement, alertes, état) sur le monde simulé du plan 08 : copie du dépôt, origine nue locale, HOME temporaire,
// faux claude, faux ci:local, lignes de deploy:auto scriptées, faux fetch Telegram. Aucun GitHub, aucun serveur,
// aucun vrai claude, aucun réseau, aucun Telegram réel.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CODES_SORTIE_AUTO, RESULTATS_DEPLOIEMENT_AUTO } from '../../scripts/lib/deploiement/auto.ts';
import type { ResultatAuto as ResultatDeploiement } from '../../scripts/lib/deploiement/auto.ts';
import { executerPassageAuto, lireResultat, SUITE_DEPLOIEMENT } from '../../scripts/lib/veille/auto.ts';
import type { DependancesAuto, OptionsAuto } from '../../scripts/lib/veille/auto.ts';
import { LIBELLES } from '../../scripts/lib/veille/alertes-auto.ts';
import { CODES_ARRET, CODES_ISSUE } from '../../scripts/lib/veille/codes-auto.ts';
import type { CodeAuto } from '../../scripts/lib/veille/codes-auto.ts';
import { ETAT_AUTO_VIDE, cheminEtatAuto, ecrireEtatAuto, lireEtatAuto, lireReportsVerrou } from '../../scripts/lib/veille/etat-auto.ts';
import { dossierVerrou } from '../../scripts/lib/veille/etat.ts';
import { cheminsAuto } from '../../scripts/lib/veille/mode-auto.ts';
import type { TexteSource } from '../../scripts/lib/veille/sources-texte.ts';
import { creerMondeAuto, sortieAgent } from '../helpers/monde-auto.ts';
import type { JeuAmont, MondeAuto, OptionsMonde } from '../helpers/monde-auto.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const git = (cwd: string, args: string[]): string => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const statutReel = (): string => git(REPO_ROOT, ['status', '--porcelain']);

const PHRASE = "Cette page officielle présente la personne et sa démarche pour l'élection présidentielle de deux mille vingt-sept.";
const URL_S = 'https://exemple.test/s';
const URL_C = 'https://jeanne2027.example/';
// WR-04 : le nom de famille de la personne vérifiée figure dans la source (personnes fictives seulement).
const NOMS_PAGE = 'Page de Jeanne Duval ; mention de Essai Fictif.';
const texte = (url: string): TexteSource => ({ ok: true, url, texte: `Titre de la page. ${NOMS_PAGE} ${PHRASE} Fin du texte.`, tronque: false });
const TEXTES: Record<string, TexteSource> = { [URL_S]: texte(URL_S), [URL_C]: texte(URL_C) };
const CONFIRME = { stdout: sortieAgent('confirme', PHRASE) };

const nouvelle = (j: JeuAmont): void => {
  j.candidats.push({
    id: 'duval',
    nom: 'Jeanne Duval',
    parti: 'Parti Fictif',
    bloc: 'centre',
    statut: 'declare',
    statut_detail: 'STATUT-DETAIL-SENTINELLE',
    source: { titre: 'Titre', url: URL_S, date: '2026-11-19' },
    propositions: ['PROPOSITION-SENTINELLE'],
    liens: { campagne: URL_C },
    verifie_le: '2026-11-19',
  });
};

const mondes: MondeAuto[] = [];
function monde(o: OptionsMonde = {}): MondeAuto {
  const m = creerMondeAuto({ textes: TEXTES, scenariosClaude: [CONFIRME], telegram: true, ...o });
  mondes.push(m);
  return m;
}
/** Monde avec une nouvelle personne déclarée, prêt à produire un commit. */
const avecPersonne = (o: OptionsMonde = {}): MondeAuto => monde({ modifierAmont: nouvelle, ...o });

let statutAvant = '';
before(() => {
  statutAvant = statutReel();
});
after(() => {
  assert.equal(statutReel(), statutAvant, 'le dépôt réel est inchangé par les tests');
  for (const m of mondes) m.detruire();
});

// Alertes observées, par code, pour la table finale.
const vues = new Map<string, string>();
const alertes = (m: MondeAuto): string[] => m.telegramEnvoyes().map((b) => (JSON.parse(b) as { text: string }).text);
const noter = (m: MondeAuto): void => {
  for (const t of alertes(m)) {
    const code = /^code : (\w+)$/m.exec(t)?.[1];
    if (code !== undefined) vues.set(code, t);
  }
};

interface Scripts {
  /** Lignes de `deploy-auto deployer` par appel (la dernière se répète). */
  deployer?: string[][];
  /** Lignes de `deploy-auto etat` par appel (la dernière se répète). Défaut : courant = main de l'origine. */
  etat?: string[][];
  /** Commit courant servi par défaut à `etat`. */
  courant?: string;
}
interface Suivi {
  deployer: { sha: string; phase: string }[];
  etat: number;
}
/**
 * Format réel de `deploy-auto deployer` (CR-01, revue 10.3) : la dernière ligne est `resultat=<code> sha=<12 hex>`
 * (scripts/lib/deploiement/auto.ts). Une ligne scriptée `resultat=<code>` nue reçoit le suffixe du commit déployé ;
 * une ligne déjà suffixée est gardée telle quelle.
 */
const formatReel = (lignes: string[], sha: string): string[] => lignes.map((l) => (/^resultat=\w+$/.test(l) ? `${l} sha=${sha.slice(0, 12)}` : l));
/** Code de sortie réel de deploy-auto pour la dernière ligne `resultat=` (1 pour un résultat inconnu, comme le repli). */
const statusDe = (lignes: string[]): number => {
  const r = /^resultat=(\w+)(?: sha=[0-9a-f]{12})?$/.exec(lignes[lignes.length - 1] ?? '')?.[1] ?? '';
  return Object.hasOwn(CODES_SORTIE_AUTO, r) ? CODES_SORTIE_AUTO[r as ResultatDeploiement] : 1;
};

/** Dépendances du monde avec deploy:auto scripté ; relève l'état de l'automate au moment de chaque déploiement. */
function scripter(m: MondeAuto, s: Scripts = {}, surcharge: Partial<DependancesAuto> = {}): { deps: DependancesAuto; suivi: Suivi } {
  const base = m.deps.executer;
  const suivi: Suivi = { deployer: [], etat: 0 };
  const choisir = (liste: string[][], n: number): string[] => liste[Math.min(n, liste.length - 1)] as string[];
  const deps: DependancesAuto = {
    ...m.deps,
    ...surcharge,
    executer: (c, a, o) => {
      if ((a[0] ?? '').endsWith('scripts/deploy-auto.ts')) {
        let lignes: string[];
        if (a[1] === 'deployer') {
          suivi.deployer.push({ sha: a[2] ?? '', phase: lireEtatAuto(m.dossier).phase });
          lignes = formatReel(choisir(s.deployer ?? [['resultat=publie']], suivi.deployer.length - 1), a[2] ?? '');
        } else {
          lignes = choisir(s.etat ?? [[`courant=${s.courant ?? m.shaOrigine()} restreint=oui`, 'resultat=etat_lu']], suivi.etat);
          suivi.etat++;
        }
        return { status: statusDe(lignes), stdout: `${lignes.join('\n')}\n`, stderr: '' };
      }
      return surcharge.executer !== undefined ? surcharge.executer(c, a, o) : base(c, a, o);
    },
  };
  return { deps, suivi };
}

/** Remplace la poussée git par une réponse fictive (aucun réseau). */
function poussee(m: MondeAuto, status: number, stderr: string, base: DependancesAuto['executer'] = m.deps.executer): DependancesAuto['executer'] {
  return (c, a, o) => (c === 'git' && a.includes('--porcelain') && a.some((x) => x === 'push') ? { status, stdout: '', stderr } : base(c, a, o));
}

const passer = (m: MondeAuto, deps: DependancesAuto = m.deps, o: OptionsAuto = {}): ReturnType<typeof executerPassageAuto> => executerPassageAuto(deps, o);
const nbAppelsDeploy = (m: MondeAuto): number => m.appels().filter((a) => a.args.some((x) => x.endsWith('deploy-auto.ts'))).length;

describe('passage : interrupteur, à blanc, publication', () => {
  it('interrupteur présent : rien ne s\'exécute, aucune alerte, état desactive', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const c = cheminsAuto(m.home, m.dossier);
    writeFileSync(c.desactive, 'stop\n');
    const r = await passer(m);
    assert.equal(r.code, 'desactive');
    assert.equal(r.sortie, 0);
    assert.equal(m.appels().length, 0, 'aucun appel git ni script');
    assert.equal(alertes(m).length, 0);
    assert.equal(lireEtatAuto(m.dossier).dernierCode, 'desactive');
  });

  it('sans marqueur : passage à blanc, rien poussé, une alerte ; le second passage ne dit plus rien', async () => {
    const m = avecPersonne();
    const avant = m.shaOrigine();
    const r = await passer(m);
    assert.equal(r.code, 'pret_a_blanc', JSON.stringify(r));
    assert.equal(r.sortie, 0);
    assert.equal(m.shaOrigine(), avant, 'main de l\'origine inchangé');
    assert.equal(nbAppelsDeploy(m), 0, 'aucun appel à deploy-auto');
    const a = alertes(m);
    assert.equal(a.length, 1);
    assert.match(a[0] as string, /^mode : à blanc$/m);
    assert.match(a[0] as string, /^fiches : jeanne-duval$/m);
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, m.empreinte);
    noter(m);

    const r2 = await passer(m);
    assert.equal(r2.code, 'rien_a_faire');
    assert.equal(alertes(m).length, 1, 'aucune nouvelle alerte');
    assert.equal(m.shaOrigine(), avant);
  });

  it('marqueur présent, hors gel : poussée en avance rapide, état écrit avant le déploiement, alerte publié', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const avant = m.shaOrigine();
    const { deps, suivi } = scripter(m);
    const r = await passer(m, deps);
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.equal(r.sortie, 0);
    const sha = m.shaOrigine();
    assert.notEqual(sha, avant);
    assert.equal(r.sha, sha, 'le commit testé est celui qui est poussé');
    assert.equal(git(m.origine, ['rev-parse', 'refs/heads/main^']), avant, 'avance rapide : le parent est l\'ancien main');
    assert.equal(suivi.deployer.length, 1);
    assert.equal(suivi.deployer[0]?.sha, sha, 'deploy:auto reçoit le commit exact');
    assert.equal(suivi.deployer[0]?.phase, 'pousse_non_deploye', 'état écrit avant le déploiement');
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.phase, 'repos');
    assert.equal(e.empreinteTraitee, m.empreinte);
    const a = alertes(m);
    assert.equal(a.length, 1);
    assert.match(a[0] as string, new RegExp(`^commit : ${sha.slice(0, 12)}$`, 'm'));
    assert.match(a[0] as string, /^fiches : jeanne-duval$/m);
    assert.match(a[0] as string, /^rapport : ~\/\.cache\/rtp\/veille\/rapports-auto\//m);
    assert.match(a[0] as string, /^mode : publication$/m);
    assert.doesNotMatch(a.join('\n'), /Jeanne|Duval/);
    noter(m);
  });

  it('marqueur présent pendant la retenue de décembre : gel, rien poussé, rien déployé', async () => {
    const m = avecPersonne({ marqueurActif: true, maintenant: '2026-12-12T09:00:00+01:00' });
    const avant = m.shaOrigine();
    const { deps, suivi } = scripter(m);
    const r = await passer(m, deps);
    assert.equal(r.code, 'gel', JSON.stringify(r));
    assert.equal(r.sortie, 3);
    assert.equal(m.shaOrigine(), avant);
    assert.equal(suivi.deployer.length, 0);
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, null, 'le gel est transitoire : le jeu sera repris');
    noter(m);
  });

  it('gel qui commence entre la préparation et la poussée : gel, rien poussé', async () => {
    const m = avecPersonne({ marqueurActif: true });
    let t = new Date('2026-12-09T09:00:00+01:00');
    const avant = m.shaOrigine();
    const { deps, suivi } = scripter(m, {}, { maintenant: () => t, apresEcriture: () => (t = new Date('2026-12-12T09:00:00+01:00')) });
    const r = await passer(m, deps);
    assert.equal(r.code, 'gel', JSON.stringify(r));
    assert.equal(m.shaOrigine(), avant);
    assert.equal(suivi.deployer.length, 0);
  });

  it('moyen de poussée absent : config_absente, rien poussé', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const avant = m.shaOrigine();
    const { deps, suivi } = scripter(m, {}, { push: undefined });
    const r = await passer(m, deps);
    assert.equal(r.code, 'config_absente', JSON.stringify(r));
    assert.equal(m.shaOrigine(), avant);
    assert.equal(suivi.deployer.length, 0);
    noter(m);
  });

  it('poussée refusée pour une autre raison : push_echec ; réseau coupé : hors_ligne ; jamais de déploiement', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const { deps, suivi } = scripter(m, {}, { executer: poussee(m, 1, 'fatal: erreur inattendue') });
    const r = await passer(m, deps);
    assert.equal(r.code, 'push_echec', JSON.stringify(r));
    assert.equal(suivi.deployer.length, 0);
    noter(m);

    const m2 = avecPersonne({ marqueurActif: true });
    const s2 = scripter(m2, {}, { executer: poussee(m2, 128, 'fatal: Could not resolve host: exemple.invalid') });
    const r2 = await passer(m2, s2.deps);
    assert.equal(r2.code, 'hors_ligne', JSON.stringify(r2));
    assert.equal(s2.suivi.deployer.length, 0);
    noter(m2);
  });

  it('main avancé pendant la préparation : main_a_avance, jeu non marqué traité ; le passage suivant publie', async () => {
    const m = avecPersonne({ marqueurActif: true });
    let fait = false;
    const { deps } = scripter(m, {}, {
      apresEcriture: () => {
        if (fait) return;
        fait = true;
        m.commitOrigine('docs/autre-session.md', 'autre commit\n', 'docs: autre session');
      },
    });
    const r = await passer(m, deps);
    assert.equal(r.code, 'main_a_avance', JSON.stringify(r));
    assert.equal(r.sortie, 3);
    const autre = m.shaOrigine();
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, null);
    assert.equal(lireEtatAuto(m.dossier).phase, 'repos');
    noter(m);

    const r2 = await passer(m, deps);
    assert.equal(r2.code, 'publie', JSON.stringify(r2));
    assert.equal(git(m.origine, ['rev-parse', 'refs/heads/main^']), autre, 'le commit est recalculé sur le nouveau main');
  });
});

describe('passage : verrou, boîte d\'envoi, répétitions', () => {
  it('verrou de veille tenu : reports comptés, alerte au troisième seulement, compteur remis à 0 ensuite', async () => {
    const m = monde();
    const verrou = dossierVerrou(m.dossier);
    mkdirSync(verrou, { recursive: true });
    writeFileSync(path.join(verrou, 'pid'), `${process.pid}\n`);
    for (let i = 1; i <= 3; i++) {
      const r = await passer(m);
      assert.equal(r.code, 'verrou_pris');
      assert.equal(lireReportsVerrou(m.dossier), i);
      assert.equal(alertes(m).length, i < 3 ? 0 : 1, `alertes après le report ${i}`);
    }
    assert.equal(m.appels().filter((a) => a.commande === 'git').length, 0, 'aucune action git tant que le verrou est tenu');
    noter(m);
    rmSync(verrou, { recursive: true, force: true });
    const r = await passer(m);
    assert.equal(r.code, 'rien_a_faire');
    assert.equal(lireReportsVerrou(m.dossier), 0);
  });

  it('Telegram en échec : l\'alerte va en boîte, puis part en premier au passage suivant', async () => {
    const m = avecPersonne();
    const { deps } = scripter(m, {}, { fetch: async () => ({ ok: false, status: 400 }) });
    const r = await passer(m, deps);
    assert.equal(r.code, 'pret_a_blanc', JSON.stringify(r));
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.boite.length, 1);
    assert.match(e.boite[0] as string, /^code : pret_a_blanc$/m);
    assert.equal(alertes(m).length, 0);

    const r2 = await passer(m);
    assert.equal(r2.code, 'rien_a_faire');
    assert.equal(lireEtatAuto(m.dossier).boite.length, 0);
    assert.equal(alertes(m).length, 1);
    assert.match(alertes(m)[0] as string, /^code : pret_a_blanc$/m);
  });

  it('arrêt définitif (doute des agents) : une seule alerte, le jeu est marqué traité', async () => {
    const m = avecPersonne({ scenariosClaude: [{ stdout: sortieAgent('insuffisant', '') }] });
    const r = await passer(m);
    assert.equal(r.code, 'doute_agent', JSON.stringify(r));
    assert.equal(r.sortie, 3);
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, m.empreinte);
    assert.equal(alertes(m).length, 1);
    const r2 = await passer(m);
    assert.equal(r2.code, 'rien_a_faire');
    assert.equal(alertes(m).length, 1, 'pas d\'alerte répétée');
    noter(m);
  });

  it('arrêt transitoire (source inaccessible) : retenté au passage suivant, alerte une seule fois', async () => {
    const m = avecPersonne({ textes: {} });
    const r = await passer(m);
    assert.equal(r.code, 'source_inaccessible', JSON.stringify(r));
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, null);
    const r2 = await passer(m);
    assert.equal(r2.code, 'source_inaccessible', 'le jeu est retraité');
    assert.equal(alertes(m).length, 1, 'même code et même empreinte : une seule alerte');
    assert.ok(m.fauxClaude.journal().length === 0);
  });
});

/** État de l'automate après une poussée dont le déploiement n'a pas abouti. */
function semerPousse(m: MondeAuto, sha: string): void {
  ecrireEtatAuto(m.dossier, { ...ETAT_AUTO_VIDE, phase: 'pousse_non_deploye', sha, empreinteEnCours: m.empreinte, fiches: ['jeanne-duval'], comptes: '1 entrée', rapport: null });
}
/** Version « précédemment en ligne » fictive : un commit inconnu du dépôt, donc ni le commit à reprendre ni un descendant. */
const parent = (_m: MondeAuto): string => 'a'.repeat(40);

describe('déploiement : retenue, reprise, état pousse_non_deploye', () => {
  it('fumée en échec, retour en arrière impossible, après une vraie poussée : retenu, plus rien jusqu\'à --reprendre', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const { deps, suivi } = scripter(m, { deployer: [['resultat=smoke_echec_retour_ko']] });
    const r = await passer(m, deps);
    assert.equal(r.code, 'smoke_echec_retour_ko', JSON.stringify(r));
    assert.equal(r.sortie, 3);
    assert.equal(lireEtatAuto(m.dossier).phase, 'retenu');
    assert.equal(alertes(m).length, 1);
    noter(m);
    const apres = await passer(m, deps);
    assert.equal(apres.sortie, 3);
    assert.equal(suivi.deployer.length, 1, 'aucune nouvelle tentative');
    assert.equal(alertes(m).length, 1, 'aucune alerte répétée');
  });

  it('smoke_echec_retour_ok : retenu ; --reprendre remet l\'automate au repos et fait retraiter le jeu', async () => {
    const m = monde({ marqueurActif: true });
    const sha = m.shaOrigine();
    semerPousse(m, sha);
    const { deps, suivi } = scripter(m, { courant: parent(m), deployer: [['resultat=smoke_echec_retour_ok']] });
    const r = await passer(m, deps);
    assert.equal(r.code, 'smoke_echec_retour_ok', JSON.stringify(r));
    assert.equal(lireEtatAuto(m.dossier).phase, 'retenu');
    noter(m);
    await passer(m, deps);
    assert.equal(suivi.deployer.length, 1);
    assert.equal(alertes(m).length, 1);
    // Après l'intervention humaine, la version en ligne est celle de main : le jeu est retraité sans reste.
    const apresIntervention = scripter(m).deps;
    const apres = await passer(m, apresIntervention, { reprendre: true });
    assert.equal(apres.code, 'rien_a_faire', JSON.stringify(apres));
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.phase, 'repos');
    assert.equal(e.empreinteTraitee, m.empreinte, 'le jeu a été retraité');
  });

  it('serveur non restreint détecté à la reprise : retenu', async () => {
    const m = monde({ marqueurActif: true });
    semerPousse(m, m.shaOrigine());
    const { deps, suivi } = scripter(m, { etat: [['resultat=serveur_non_restreint']] });
    const r = await passer(m, deps);
    assert.equal(r.code, 'serveur_non_restreint');
    assert.equal(lireEtatAuto(m.dossier).phase, 'retenu');
    assert.equal(suivi.deployer.length, 0);
    noter(m);
  });

  for (const resultat of ['hors_ligne', 'verrou_pris', 'gel', 'deploiement_refuse', 'config_absente']) {
    it(`déploiement non abouti (${resultat}) : phase gardée, une alerte par code, repris au passage suivant`, async () => {
      const m = monde({ marqueurActif: true });
      const sha = m.shaOrigine();
      semerPousse(m, sha);
      const { deps, suivi } = scripter(m, { courant: parent(m), deployer: [[`resultat=${resultat}`]] });
      const r = await passer(m, deps);
      assert.equal(r.code, resultat);
      assert.equal(r.sortie, 3);
      assert.equal(lireEtatAuto(m.dossier).phase, 'pousse_non_deploye');
      assert.equal(alertes(m).length, 1);
      assert.equal(git(m.worktree, ['rev-parse', 'HEAD']), sha, 'worktree remis sur le commit exact');
      await passer(m, deps);
      assert.equal(suivi.deployer.length, 2, 'la reprise réessaie');
      assert.equal(alertes(m).length, 1, 'même code, même empreinte : pas de nouvelle alerte');
      noter(m);
    });
  }

  it('reprise réussie : publié, repos, jeu traité, alerte publié', async () => {
    const m = monde({ marqueurActif: true });
    const sha = m.shaOrigine();
    semerPousse(m, sha);
    const { deps, suivi } = scripter(m, { courant: parent(m), deployer: [['resultat=hors_ligne'], ['resultat=publie']] });
    assert.equal((await passer(m, deps)).code, 'hors_ligne');
    const r = await passer(m, deps);
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.equal(r.sortie, 0);
    assert.equal(suivi.deployer.length, 2);
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.phase, 'repos');
    assert.equal(e.empreinteTraitee, m.empreinte);
    assert.equal(e.empreinteEnCours, null);
    const a = alertes(m);
    assert.equal(a.length, 2);
    assert.match(a[1] as string, new RegExp(`^commit : ${sha.slice(0, 12)}$`, 'm'));
    assert.match(a[1] as string, /^code : publie$/m);
  });

  it('commit déjà mis en ligne par un autre déploiement (égal ou descendant) : deja_en_ligne, aucun déploiement', async () => {
    const m = monde({ marqueurActif: true });
    const sha = m.shaOrigine();
    semerPousse(m, sha);
    const egal = scripter(m, { courant: sha });
    const r = await passer(m, egal.deps);
    assert.equal(r.code, 'deja_en_ligne', JSON.stringify(r));
    assert.equal(egal.suivi.deployer.length, 0);
    assert.equal(lireEtatAuto(m.dossier).phase, 'repos');
    noter(m);

    const m2 = monde({ marqueurActif: true });
    semerPousse(m2, m2.shaOrigine());
    const descendant = m2.commitOrigine('docs/suite.md', 'suite\n', 'docs: suite');
    const s2 = scripter(m2, { courant: descendant });
    const r2 = await passer(m2, s2.deps);
    assert.equal(r2.code, 'deja_en_ligne', JSON.stringify(r2));
    assert.equal(s2.suivi.deployer.length, 0);
    assert.equal(lireEtatAuto(m2.dossier).empreinteTraitee, m2.empreinte);
  });

  it('reprise sans marqueur (mode à blanc) ou pendant un gel : rien n\'est déployé, phase inchangée, alerte dédupliquée', async () => {
    for (const [o, code] of [
      [{ marqueurActif: false }, 'reprise_a_blanc'],
      [{ marqueurActif: true, maintenant: '2026-12-12T09:00:00+01:00' }, 'gel'],
    ] as const) {
      const m = monde(o);
      semerPousse(m, m.shaOrigine());
      const { deps, suivi } = scripter(m);
      assert.equal((await passer(m, deps)).code, code);
      assert.equal((await passer(m, deps)).code, code);
      assert.equal(suivi.deployer.length, 0);
      assert.equal(suivi.etat, 0, 'aucun appel à deploy-auto');
      assert.equal(lireEtatAuto(m.dossier).phase, 'pousse_non_deploye');
      assert.equal(alertes(m).length, 1);
      noter(m);
    }
  });

  it('commit à reprendre absent de l\'historique d\'origin/main : deploiement_refuse et retenu', async () => {
    const m = monde({ marqueurActif: true });
    semerPousse(m, 'f'.repeat(40));
    const { deps, suivi } = scripter(m);
    const r = await passer(m, deps);
    assert.equal(r.code, 'deploiement_refuse');
    assert.equal(lireEtatAuto(m.dossier).phase, 'retenu');
    assert.equal(suivi.deployer.length, 0);
  });

  it('sortie illisible de deploy-auto : deploiement_refuse, phase inchangée', async () => {
    const m = monde({ marqueurActif: true });
    semerPousse(m, m.shaOrigine());
    const { deps } = scripter(m, { courant: parent(m), deployer: [['du texte quelconque', 'resultat=inconnu_au_catalogue']] });
    const r = await passer(m, deps);
    assert.equal(r.code, 'deploiement_refuse');
    assert.equal(lireEtatAuto(m.dossier).phase, 'pousse_non_deploye');
  });
});

describe('intention de poussée et état sous verrou (WR-09)', () => {
  it('l\'intention poussee_en_cours est écrite avec le sha avant la poussée', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const vu: { phase: string; sha: string | null }[] = [];
    const base = m.deps.executer;
    const { deps } = scripter(m, {}, {
      executer: (c, a, o) => {
        if (c === 'git' && a.includes('push')) {
          const e = lireEtatAuto(m.dossier);
          vu.push({ phase: e.phase, sha: e.sha });
        }
        return base(c, a, o);
      },
    });
    const r = await passer(m, deps);
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.equal(vu.length, 1);
    assert.equal(vu[0]?.phase, 'poussee_en_cours');
    assert.equal(vu[0]?.sha, r.sha);
  });

  it('arrêt brutal après une poussée réussie : le passage suivant reprend comme pousse_non_deploye et publie', async () => {
    const m = monde({ marqueurActif: true });
    const sha = m.shaOrigine();
    ecrireEtatAuto(m.dossier, { ...ETAT_AUTO_VIDE, phase: 'poussee_en_cours', sha, empreinteEnCours: m.empreinte, fiches: ['jeanne-duval'], comptes: '1 entrée' });
    const { deps, suivi } = scripter(m, { courant: parent(m) });
    const r = await passer(m, deps);
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.equal(suivi.deployer.length, 1);
    assert.equal(suivi.deployer[0]?.sha, sha);
    assert.equal(suivi.deployer[0]?.phase, 'pousse_non_deploye', 'intention résolue et écrite avant le déploiement');
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, m.empreinte);
  });

  it('intention non suivie d\'effet (commit absent d\'origin/main) : nettoyée, passage normal, rien déployé', async () => {
    const m = monde({ marqueurActif: true });
    ecrireEtatAuto(m.dossier, { ...ETAT_AUTO_VIDE, phase: 'poussee_en_cours', sha: 'f'.repeat(40), empreinteEnCours: m.empreinte });
    const { deps, suivi } = scripter(m);
    const r = await passer(m, deps);
    assert.equal(r.code, 'rien_a_faire', JSON.stringify(r));
    assert.equal(suivi.deployer.length, 0);
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.phase, 'repos');
    assert.equal(e.sha, null);
    assert.equal(e.empreinteEnCours, null);
  });

  it('poussée en échec ambigu (réseau) : intention gardée, résolue au passage suivant qui publie', async () => {
    const m = avecPersonne({ marqueurActif: true });
    const s1 = scripter(m, {}, { executer: poussee(m, 128, 'fatal: Could not resolve host: exemple.invalid') });
    const r1 = await passer(m, s1.deps);
    assert.equal(r1.code, 'hors_ligne', JSON.stringify(r1));
    assert.equal(lireEtatAuto(m.dossier).phase, 'poussee_en_cours');
    const s2 = scripter(m);
    const r2 = await passer(m, s2.deps);
    assert.equal(r2.code, 'publie', JSON.stringify(r2));
    assert.equal(s2.suivi.deployer.length, 1);
  });

  it('passage bloqué par le verrou : etat-auto.json n\'est jamais réécrit', async () => {
    const m = monde({ marqueurActif: true });
    semerPousse(m, m.shaOrigine());
    const avant = readFileSync(cheminEtatAuto(m.dossier), 'utf8');
    const verrou = dossierVerrou(m.dossier);
    mkdirSync(verrou, { recursive: true });
    writeFileSync(path.join(verrou, 'pid'), `${process.pid}\n`);
    for (let i = 0; i < 3; i++) assert.equal((await passer(m)).code, 'verrou_pris');
    assert.equal(readFileSync(cheminEtatAuto(m.dossier), 'utf8'), avant, 'état du détenteur intact');
    writeFileSync(cheminsAuto(m.home, m.dossier).desactive, 'stop\n');
    assert.equal((await passer(m)).code, 'desactive');
    assert.equal(readFileSync(cheminEtatAuto(m.dossier), 'utf8'), avant, 'interrupteur sous verrou tenu : aucune écriture');
    rmSync(verrou, { recursive: true, force: true });
  });
});

describe('--reprendre fait retraiter le jeu courant (CR-02)', () => {
  it('à blanc, puis marqueur auto-actif, puis --reprendre : publié', async () => {
    const m = avecPersonne();
    const avant = m.shaOrigine();
    const { deps, suivi } = scripter(m);
    const r1 = await passer(m, deps);
    assert.equal(r1.code, 'pret_a_blanc', JSON.stringify(r1));
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, m.empreinte);
    writeFileSync(cheminsAuto(m.home, m.dossier).actif, 'actif\n', { mode: 0o600 });
    const r2 = await passer(m, deps);
    assert.equal(r2.code, 'rien_a_faire', 'sans --reprendre, le jeu vu à blanc reste traité');
    const r3 = await passer(m, deps, { reprendre: true });
    assert.equal(r3.code, 'publie', JSON.stringify(r3));
    assert.notEqual(m.shaOrigine(), avant);
    assert.equal(suivi.deployer.length, 1);
    const e = lireEtatAuto(m.dossier);
    assert.equal(e.phase, 'repos');
    assert.equal(e.empreinteTraitee, m.empreinte);
  });

  it('arrêt définitif (doute des agents) puis --reprendre : le jeu est retraité', async () => {
    const m = avecPersonne({ scenariosClaude: [{ stdout: sortieAgent('insuffisant', '') }, CONFIRME] });
    const r1 = await passer(m);
    assert.equal(r1.code, 'doute_agent', JSON.stringify(r1));
    assert.equal((await passer(m)).code, 'rien_a_faire', 'arrêt définitif : jeu traité');
    const r3 = await passer(m, m.deps, { reprendre: true });
    assert.equal(r3.code, 'pret_a_blanc', JSON.stringify(r3));
    assert.equal(alertes(m).length, 2, 'doute_agent puis pret_a_blanc');
  });

  it('commit poussé non déployé : --reprendre laisse passer la reprise de mise en ligne d\'abord', async () => {
    const m = monde({ marqueurActif: true });
    const sha = m.shaOrigine();
    semerPousse(m, sha);
    const { deps, suivi } = scripter(m, { courant: parent(m) });
    const r = await passer(m, deps, { reprendre: true });
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.equal(suivi.deployer.length, 1);
    assert.equal(suivi.deployer[0]?.sha, sha, 'le commit en attente est celui qui est mis en ligne');
    assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, m.empreinte);
  });
});

describe('contrat de la ligne resultat= de deploy:auto (CR-01)', () => {
  const SHA12 = '0123456789ab';
  it('lireResultat lit le format réel, avec ou sans suffixe sha, et refuse le reste', () => {
    assert.equal(lireResultat(`resultat=publie sha=${SHA12}\n`, 0), 'publie');
    assert.equal(lireResultat('resultat=etat_lu\n', 0), 'deploiement_refuse', 'etat_lu n\'est pas une issue de déploiement');
    assert.equal(lireResultat('resultat=hors_ligne\n', 9), 'hors_ligne');
    assert.equal(lireResultat(`du texte\nresultat=hors_ligne sha=${SHA12}\nresultat=smoke_echec_retour_ko sha=${SHA12}\n`, 5), 'smoke_echec_retour_ko', 'la dernière ligne compte');
    assert.equal(lireResultat(`resultat=smoke_echec_retour_ok sha=${SHA12}`, 4), 'smoke_echec_retour_ok');
    assert.equal(lireResultat(`resultat=publie sha=${SHA12} reste`, 0), 'deploiement_refuse', 'texte après le sha');
    assert.equal(lireResultat('resultat=publie sha=0123', 0), 'deploiement_refuse', 'sha tronqué');
    assert.equal(lireResultat(`  resultat=publie sha=${SHA12}`, 0), 'deploiement_refuse', 'ligne non ancrée');
    assert.equal(lireResultat(`resultat=publie sha=${SHA12}`, 1), 'deploiement_refuse', 'succès annoncé avec un code de sortie d\'échec');
    assert.equal(lireResultat(`resultat=smoke_echec_retour_ko sha=${SHA12}`, 0), 'smoke_echec_retour_ko', 'un échec annoncé est toujours cru');
  });

  const cas: [string, string, 'repos' | 'retenu', 0 | 3][] = [
    [`resultat=publie sha=${SHA12}`, 'publie', 'repos', 0],
    [`resultat=smoke_echec_retour_ko sha=${SHA12}`, 'smoke_echec_retour_ko', 'retenu', 3],
    [`resultat=smoke_echec_retour_ok sha=${SHA12}`, 'smoke_echec_retour_ok', 'retenu', 3],
  ];
  for (const [ligne, code, phase, sortie] of cas) {
    it(`deploy-auto écrit « ${ligne.replace(SHA12, '<12>')} » : ${code}, phase ${phase}, alerte au libellé de ${code}`, async () => {
      const m = monde({ marqueurActif: true });
      const sha = m.shaOrigine();
      semerPousse(m, sha);
      const { deps, suivi } = scripter(m, { courant: parent(m), deployer: [['déploiement en cours', ligne.replace(SHA12, sha.slice(0, 12))]] });
      const r = await passer(m, deps);
      assert.equal(r.code, code, JSON.stringify(r));
      assert.equal(r.sortie, sortie);
      assert.equal(lireEtatAuto(m.dossier).phase, phase);
      assert.equal(suivi.deployer.length, 1);
      const a = alertes(m);
      assert.equal(a.length, 1);
      assert.equal((a[0] as string).split('\n')[0], `Mise à jour autonome : ${LIBELLES[code as CodeAuto]}`);
      assert.match(a[0] as string, new RegExp(`^code : ${code}$`, 'm'));
      if (phase === 'retenu') {
        // Aucune nouvelle tentative au passage suivant : la version cassée n'est jamais tenue pour publiée.
        const r2 = await passer(m, deps);
        assert.notEqual(r2.code, 'deja_en_ligne');
        assert.equal(suivi.deployer.length, 1);
        assert.equal(lireEtatAuto(m.dossier).empreinteTraitee, null, 'le jeu n\'est pas marqué traité');
      }
    });
  }
});

describe('table des codes après commit et garde-fous du code', () => {
  it('les résultats de deploy:auto (hors etat_lu) sont tous traduits, vers des codes connus', () => {
    for (const r of RESULTATS_DEPLOIEMENT_AUTO.filter((x) => x !== 'etat_lu')) {
      const s = SUITE_DEPLOIEMENT[r];
      assert.ok(s !== undefined, `résultat ${r} traduit`);
      assert.ok([...CODES_ISSUE, ...CODES_ARRET].includes(s.code as never), `code ${s.code} connu`);
    }
    for (const r of ['smoke_echec_retour_ok', 'smoke_echec_retour_ko', 'serveur_non_restreint']) assert.equal(SUITE_DEPLOIEMENT[r]?.phase, 'retenu');
  });

  it('chaque code possible après le commit a donné une alerte au libellé fixe', () => {
    const codes: CodeAuto[] = ['main_a_avance', 'push_echec', 'hors_ligne', 'config_absente', 'gel', 'serveur_non_restreint', 'deploiement_refuse', 'smoke_echec_retour_ok', 'smoke_echec_retour_ko', 'verrou_pris'];
    for (const code of codes) {
      const t = vues.get(code);
      assert.ok(t !== undefined, `alerte observée pour ${code}`);
      assert.equal((t as string).split('\n')[0], `Mise à jour autonome : ${LIBELLES[code]}`);
      assert.match(t as string, new RegExp(`^code : ${code}$`, 'm'));
    }
  });

  it('auto.ts : ni ping Healthchecks, ni force, ni rebase, état pousse_non_deploye avant le déploiement', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'scripts', 'lib', 'veille', 'auto.ts'), 'utf8');
    assert.doesNotMatch(src, /pingHealthchecks\(/);
    assert.doesNotMatch(src, /'--force'|rebase/);
    const iEtat = src.indexOf("p.etat.phase = 'pousse_non_deploye'");
    const iDeploy = src.indexOf('return await deployer(p, prep.sha)');
    assert.ok(iEtat > 0 && iDeploy > iEtat);
    assert.ok(existsSync(path.join(REPO_ROOT, 'scripts', 'deploy-auto.ts')));
  });
});
