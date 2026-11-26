// Phase 10.3, plan 09 : passage complet de l'automate (mode, verrou, boîte d'envoi, reprise, préparation, poussée,
// déploiement, alertes, état) sur le monde simulé du plan 08 : copie du dépôt, origine nue locale, HOME temporaire,
// faux claude, faux ci:local, lignes de deploy:auto scriptées, faux fetch Telegram. Aucun GitHub, aucun serveur,
// aucun vrai claude, aucun réseau, aucun Telegram réel.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTATS_DEPLOIEMENT_AUTO } from '../../scripts/lib/deploiement/auto.ts';
import { executerPassageAuto, SUITE_DEPLOIEMENT } from '../../scripts/lib/veille/auto.ts';
import type { DependancesAuto, OptionsAuto } from '../../scripts/lib/veille/auto.ts';
import { LIBELLES } from '../../scripts/lib/veille/alertes-auto.ts';
import { CODES_ARRET, CODES_ISSUE } from '../../scripts/lib/veille/codes-auto.ts';
import type { CodeAuto } from '../../scripts/lib/veille/codes-auto.ts';
import { ETAT_AUTO_VIDE, ecrireEtatAuto, lireEtatAuto } from '../../scripts/lib/veille/etat-auto.ts';
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
const texte = (url: string): TexteSource => ({ ok: true, url, texte: `Titre de la page. ${PHRASE} Fin du texte.`, tronque: false });
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
          lignes = choisir(s.deployer ?? [['resultat=publie']], suivi.deployer.length - 1);
        } else {
          lignes = choisir(s.etat ?? [[`courant=${s.courant ?? m.shaOrigine()} restreint=oui`, 'resultat=etat_lu']], suivi.etat);
          suivi.etat++;
        }
        return { status: 0, stdout: `${lignes.join('\n')}\n`, stderr: '' };
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
      assert.equal(lireEtatAuto(m.dossier).reportsVerrou, i);
      assert.equal(alertes(m).length, i < 3 ? 0 : 1, `alertes après le report ${i}`);
    }
    assert.equal(m.appels().filter((a) => a.commande === 'git').length, 0, 'aucune action git tant que le verrou est tenu');
    noter(m);
    rmSync(verrou, { recursive: true, force: true });
    const r = await passer(m);
    assert.equal(r.code, 'rien_a_faire');
    assert.equal(lireEtatAuto(m.dossier).reportsVerrou, 0);
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

  it('reprise sans marqueur ou pendant un gel : rien n\'est déployé, phase inchangée, alerte gel dédupliquée', async () => {
    for (const o of [{ marqueurActif: false }, { marqueurActif: true, maintenant: '2026-12-12T09:00:00+01:00' }]) {
      const m = monde(o);
      semerPousse(m, m.shaOrigine());
      const { deps, suivi } = scripter(m);
      assert.equal((await passer(m, deps)).code, 'gel');
      assert.equal((await passer(m, deps)).code, 'gel');
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
