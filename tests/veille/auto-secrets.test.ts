// Plan 10.3-10, SC-4 : aucune valeur sentinelle dans aucune sortie d'un passage de l'automate.
// Trois passages sur le monde simulé (publié, arrêt par doute des agents, Telegram en échec). Les sentinelles sont
// placées là où les vraies valeurs vivent (Trousseau, agent-claude.env, push-auto.env, sorties de deploy:auto) ;
// toute sortie est ensuite scannée : journal du passage, état de l'automate, état de la veille, rapports locaux,
// historique du commit poussé, corps des requêtes Telegram, arguments de chaque processus lancé, journal du faux claude.
// Le jeton Telegram n'apparaît que dans l'URL de l'API et la conversation que dans le champ chat_id, par conception :
// seul le texte du message est scanné.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { envDeBase } from '../../scripts/lib/processus.ts';
import { executerPassageAuto } from '../../scripts/lib/veille/auto.ts';
import type { DependancesAuto } from '../../scripts/lib/veille/auto.ts';
import { SERVICES } from '../../scripts/lib/veille/alertes.ts';
import type { TexteSource } from '../../scripts/lib/veille/sources-texte.ts';
import { creerMondeAuto, JETON_AGENT_SENTINELLE, sortieAgent } from '../helpers/monde-auto.ts';
import type { JeuAmont, MondeAuto, OptionsMonde } from '../helpers/monde-auto.ts';

const JETON_TELEGRAM = '123456789:SENTINELLE-TELEGRAM-abcdefghijklmnop';
const CONVERSATION = 'CONVERSATION-SENTINELLE-42';
const JETON_PUSH = 'JETON-PUSH-SENTINELLE-3d';
const HOTE = 'serveur.exemple.invalid';
const UTILISATEUR = 'deploy-factice';
const URL_SERVEUR = 'https://essai.exemple.invalid';
const CLE = '/chemin/cle-auto-sentinelle';
const SENTINELLES = [JETON_AGENT_SENTINELLE, JETON_TELEGRAM, CONVERSATION, JETON_PUSH, HOTE, UTILISATEUR, URL_SERVEUR, CLE];

const PHRASE = "Cette page officielle présente la personne et sa démarche pour l'élection présidentielle de deux mille vingt-sept.";
const URL_S = 'https://exemple.test/s';
const URL_C = 'https://jeanne2027.example/';
const texte = (url: string): TexteSource => ({ ok: true, url, texte: `Titre de la page. ${PHRASE} Fin du texte.`, tronque: false });
const TEXTES: Record<string, TexteSource> = { [URL_S]: texte(URL_S), [URL_C]: texte(URL_C) };

const nouvelle = (j: JeuAmont): void => {
  j.candidats.push({
    id: 'duval',
    nom: 'Jeanne Duval',
    parti: 'Parti Fictif',
    bloc: 'centre',
    statut: 'declare',
    statut_detail: 'Déclarée candidate',
    source: { titre: 'Titre', url: URL_S, date: '2026-11-19' },
    propositions: ['Proposition fictive'],
    liens: { campagne: URL_C },
    verifie_le: '2026-11-19',
  });
};

const mondes: MondeAuto[] = [];
after(() => {
  for (const m of mondes) m.detruire();
});

/** Monde dont le Trousseau, la configuration de l'agent et le moyen de push portent les sentinelles. */
function mondeSentinelles(o: OptionsMonde, deployer: string[]): { m: MondeAuto; deps: DependancesAuto; echecTelegram: { actif: boolean } } {
  const m = creerMondeAuto({ textes: TEXTES, telegram: true, modifierAmont: nouvelle, ...o });
  mondes.push(m);
  const base = m.deps.executer;
  const echecTelegram = { actif: false };
  writeFileSync(path.join(m.home, '.config', 'rtp', 'push-auto.env'), `RTP_PUSH_JETON=${JETON_PUSH}\n`, { mode: 0o600 });
  const deps: DependancesAuto = {
    ...m.deps,
    push: () => ({ destination: m.origine, env: { ...envDeBase(), RTP_PUSH_JETON: JETON_PUSH }, configGit: [] }),
    executer: (c, a, opt) => {
      if (c === '/usr/bin/security') {
        const service = a[a.indexOf('-s') + 1];
        const v = service === SERVICES.telegramJeton ? JETON_TELEGRAM : service === SERVICES.telegramConversation ? CONVERSATION : null;
        return v === null ? { status: 44, stdout: '', stderr: '' } : { status: 0, stdout: `${v}\n`, stderr: '' };
      }
      if ((a[0] ?? '').endsWith('scripts/deploy-auto.ts')) {
        // Sortie non masquée, comme pourrait la produire un script qui afficherait sa configuration.
        const lignes = a[1] === 'deployer' ? [...deployer, 'resultat=publie'] : [`courant=${m.shaOrigine()} restreint=oui`, `hote=${HOTE}`, 'resultat=etat_lu'];
        return { status: 0, stdout: `${lignes.join('\n')}\n`, stderr: `${UTILISATEUR}@${HOTE} ${CLE}\n` };
      }
      return base(c, a, opt);
    },
    fetch: async (_u, init) => {
      m.telegramEnvoyes();
      if (echecTelegram.actif) return { ok: false, status: 400 };
      return m.deps.fetch(_u, init);
    },
  };
  return { m, deps, echecTelegram };
}

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  const sortie: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === 'amont' || e.name === 'arbre' || e.name === 'auto-arbre' || e.name === 'worktree' || e.name === 'auto') continue;
      sortie.push(...fichiers(p));
    } else if (e.isFile() && statSync(p).size < 5 * 1024 * 1024) sortie.push(p);
  }
  return sortie;
}

function scanner(texte: string, emplacement: string): void {
  for (const s of SENTINELLES) assert.ok(!texte.includes(s), `sentinelle « ${s} » trouvée dans : ${emplacement}`);
}

/** Emplacements scannés après un passage ; rend leur nombre. */
function scannerTout(m: MondeAuto, avant: string, corpsTelegram: string[]): number {
  let n = 0;
  const vu = (texte: string, emplacement: string): void => {
    scanner(texte, emplacement);
    n++;
  };
  vu(m.journal.join('\n'), 'journal du passage');
  for (const nom of ['etat-auto.json', 'etat.json']) {
    const f = path.join(m.dossier, nom);
    vu(existsSync(f) ? readFileSync(f, 'utf8') : '', nom);
  }
  const rapports = fichiers(path.join(m.dossier, 'rapports-auto')).concat(fichiers(path.join(m.dossier, 'rapports')));
  vu(rapports.map((f) => readFileSync(f, 'utf8')).join('\n'), 'rapports locaux');
  const autres = fichiers(m.dossier).filter((f) => !rapports.includes(f) && !/etat(-auto)?\.json$/.test(f));
  vu(autres.map((f) => readFileSync(f, 'utf8')).join('\n'), 'autres fichiers du dossier de la veille');
  const log = spawnSync('git', ['log', '-p', '--format=fuller', `${avant}..refs/heads/main`], { cwd: m.origine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  vu(log.stdout, 'git log -p des commits poussés');
  vu(corpsTelegram.join('\n'), 'corps des requêtes Telegram');
  vu(m.appels().map((a) => `${a.commande} ${a.args.join(' ')}`).join('\n'), 'arguments des processus lancés');
  vu(JSON.stringify(m.fauxClaude.journal()) + m.fauxClaude.entrees().join('\n'), 'journal et entrées du faux claude');
  return n;
}

// Le jeton (URL) et la conversation (champ chat_id) sont la destination de l'API Telegram, par conception : on scanne le texte du message.
const corps = (m: MondeAuto): string[] => m.telegramEnvoyes().map((b) => (JSON.parse(b) as { text: string }).text);

describe('SC-4 : aucune sentinelle dans les sorties de l\'automate', () => {
  it('contrôle positif : le scan attrape une sentinelle', () => {
    for (const s of SENTINELLES) assert.throws(() => scanner(`xx ${s} yy`, 'essai'), /sentinelle/);
  });

  it('passage publié : sept emplacements au moins, aucune sentinelle', async () => {
    const { m, deps } = mondeSentinelles({ marqueurActif: true, scenariosClaude: [{ stdout: sortieAgent('confirme', PHRASE) }] }, [`hote=${HOTE}`, `utilisateur=${UTILISATEUR}`, `url=${URL_SERVEUR}`, `cle=${CLE}`]);
    const avant = m.shaOrigine();
    const r = await executerPassageAuto(deps, {});
    assert.equal(r.code, 'publie', JSON.stringify(r));
    assert.ok(corps(m).length >= 1, 'une alerte a été envoyée');
    assert.ok(m.fauxClaude.journal().length >= 1, 'l\'agent a tourné');
    const n = scannerTout(m, avant, corps(m));
    assert.ok(n >= 7, `${n} emplacements`);
  });

  it('passage en arrêt (doute des agents) : aucune sentinelle', async () => {
    const { m, deps } = mondeSentinelles({ marqueurActif: true, scenariosClaude: [{ stdout: sortieAgent('insuffisant', '') }] }, [`hote=${HOTE}`]);
    const avant = m.shaOrigine();
    const r = await executerPassageAuto(deps, {});
    assert.equal(r.code, 'doute_agent', JSON.stringify(r));
    assert.ok(corps(m).length >= 1);
    const n = scannerTout(m, avant, corps(m));
    assert.ok(n >= 7, `${n} emplacements`);
  });

  it('Telegram en échec (boîte d\'envoi) : aucune sentinelle', async () => {
    const { m, deps, echecTelegram } = mondeSentinelles({ marqueurActif: true, scenariosClaude: [{ stdout: sortieAgent('confirme', PHRASE) }] }, [`url=${URL_SERVEUR}`, `cle=${CLE}`]);
    echecTelegram.actif = true;
    const avant = m.shaOrigine();
    const r = await executerPassageAuto(deps, {});
    assert.equal(r.code, 'publie', JSON.stringify(r));
    const etat = JSON.parse(readFileSync(path.join(m.dossier, 'etat-auto.json'), 'utf8')) as { boite: string[] };
    assert.ok(etat.boite.length >= 1, 'le message attend dans la boîte d\'envoi');
    const n = scannerTout(m, avant, [...corps(m), ...etat.boite]);
    assert.ok(n >= 7, `${n} emplacements`);
  });
});
