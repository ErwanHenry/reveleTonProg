import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, HYPOTHESES } from '../../src/lib/content-core/rules/config.ts';
import { CODES_CHECK_DIST } from '../../scripts/lib/check-dist.ts';
import { MESURE_SERVEUR_4G } from '../../src/lib/profil-4g.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import { COMMANDES } from '../../scripts/relecture.ts';
import { FENETRES_GEL } from '../../scripts/garde-gel.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string): string => fs.readFileSync(path.join(ROOT, f), 'utf8');

const license = read('LICENSE');
const readme = read('README.md');
const architecture = read('docs/ARCHITECTURE.md');
const runbook = read('docs/RUNBOOK.md');
const envExample = read('.env.example');
const archivesReadme = read('archives/README.md');
const editorconfig = read('.editorconfig');

describe('LICENSE', () => {
  it('contient le texte MIT, la Licence Ouverte 2.0 et les exclusions', () => {
    for (const needle of [
      'MIT',
      'Permission is hereby granted',
      'Erwan Henry',
      'Licence Ouverte',
      '2.0',
      'Etalab-2.0',
      'archives/',
      'droits réservés à leurs auteurs',
    ]) {
      assert.ok(license.includes(needle), `LICENSE doit contenir « ${needle} »`);
    }
  });

  it('le texte MIT n’apparaît qu’une fois', () => {
    assert.equal(license.split('Permission is hereby granted').length - 1, 1);
  });
});

describe('README', () => {
  it('répond aux cinq questions', () => {
    assert.match(readme, /^# reveleTonProg$/m);
    assert.match(readme, /^> Site pédagogique/m);
    for (const heading of ['## Pour qui', '## Stack', '## Lancer en local', '## Où sont les secrets']) {
      assert.ok(readme.includes(`\n${heading}\n`), `titre manquant : ${heading}`);
    }
  });

  it('parle de Node 24 et jamais de l’ancienne version', () => {
    assert.ok(readme.includes('Node 24'));
    assert.doesNotMatch(readme, /Node 20/);
  });

  it('donne la séquence FOND-01 et la variable RTP_CONTENT_ROOT', () => {
    assert.ok(readme.includes('npm install && npm run validate && npm test && npm run build'));
    assert.ok(readme.includes('RTP_CONTENT_ROOT'));
  });

  it('justifie chacune des huit dépendances sur une ligne', () => {
    for (const dep of ['astro', 'ajv', 'yaml', '@astrojs/check', 'typescript', '@types/node', '@playwright/test', '@axe-core/playwright']) {
      const line = readme.split('\n').find((l) => l.startsWith(`| \`${dep}\` |`));
      assert.ok(line, `ligne de justification absente pour ${dep}`);
      assert.ok(line.length > 40, `justification trop courte pour ${dep}`);
    }
  });

  it('documente l’action utilisateur dans les réglages GitHub', () => {
    assert.ok(readme.includes('Dependabot alerts'));
    assert.ok(readme.includes('Settings > Code security'));
  });
});

describe('README (phase 2)', () => {
  it('documente les modes de validation et le verrou des identifiants', () => {
    for (const needle of [
      'npm run validate -- --mode preview',
      '--mode production',
      'RTP_MODE',
      'npm run ids -- --write',
      'npm run ids -- --check',
    ]) {
      assert.ok(readme.includes(needle), `README doit contenir « ${needle} »`);
    }
  });
});

describe('docs/ARCHITECTURE.md', () => {
  it('a un diagramme Mermaid avec content-core', () => {
    const block = architecture.match(/```mermaid\n([\s\S]*?)```/);
    assert.ok(block, 'bloc mermaid absent');
    assert.ok(block[1]?.includes('content-core'));
  });

  it('a exactement un ADR par décision D-1 à D-13', () => {
    for (let n = 1; n <= 13; n += 1) {
      const re = new RegExp(`^### ADR-\\d{3} \\(D-${n}\\) : `, 'gm');
      const found = architecture.match(re) ?? [];
      assert.equal(found.length, 1, `ADR de D-${n} : ${found.length} trouvé(s)`);
    }
  });

  it('cite le validateur TypeScript et wayback_url, pas l’ancien .mjs', () => {
    assert.ok(architecture.includes('scripts/validate.ts'));
    assert.ok(architecture.includes('wayback_url'));
    assert.ok(!architecture.includes('validate.mjs'));
  });
});

describe('docs/ARCHITECTURE.md (phase 2)', () => {
  it('montre les trois niveaux de règles dans le diagramme Mermaid', () => {
    const block = architecture.match(/```mermaid\n([\s\S]*?)```/);
    assert.ok(block, 'bloc mermaid absent');
    for (const tier of ['règles de fichier', 'règles d\'entrée', 'règles de corpus']) {
      assert.ok(block[1]?.includes(tier), `le diagramme doit montrer « ${tier} »`);
    }
  });

  it('a les ADR 027 à 031 au minimum, sans référence à une décision D-n', () => {
    for (let n = 27; n <= 31; n += 1) {
      assert.match(architecture, new RegExp(`^### ADR-0${n} : `, 'm'), `ADR-0${n} manquant`);
    }
    const adrs = architecture.match(/^### ADR-0(?:2[7-9]|[3-9]\d).*$/gm) ?? [];
    assert.ok(adrs.length >= 5);
    for (const titre of adrs) assert.ok(!titre.includes('(D-'), `titre d'ADR avec (D- : ${titre}`);
  });

  it('consigne les ADR de la phase 4 (pages M1, check-dist, structure fixe)', () => {
    const titres = [
      'cartes à structure fixe, pas à hauteur fixe',
      'pages M1 en vue-modèle pure',
      'statuts, périmètre et copie archivée',
      'pages compatibles CSP',
      'contrôle post-build `check-dist` sans dépendance',
      'un seul fichier de test lance `astro build`',
      'niveaux de lecture par boutons radio',
    ];
    for (const t of titres) {
      assert.match(architecture, new RegExp(`^### ADR-\\d{3} : ${t.replace(/[`.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `ADR « ${t} » manquant`);
    }
    assert.match(architecture, /structure fixe[\s\S]{0,1200}160 %[\s\S]{0,400}Gros caractères/);
    assert.ok(architecture.includes('check-dist'));
  });

  it('consigne chacune des hypothèses A1 à A12 et renvoie à HYPOTHESES', () => {
    assert.ok(architecture.includes('HYPOTHESES'));
    for (const h of HYPOTHESES) {
      assert.ok(new RegExp(`\\*\\*${h.id}\\*\\*`).test(architecture), `hypothèse ${h.id} absente d'ARCHITECTURE`);
    }
    assert.equal(HYPOTHESES.length, 12);
  });

  it('WR-10 : la dette « sondage encore affiché pendant une fenêtre » est consignée comme différée', () => {
    assert.match(architecture, /Dette différée[^\n]*WR-10/);
    assert.match(HYPOTHESES.find((h) => h.id === 'A10')?.choix ?? '', /dette différée/);
  });
});

describe('docs/RUNBOOK.md', () => {
  it('a les bons chemins et commandes', () => {
    for (const needle of [
      'mesures/<candidat>/<slug>.yaml',
      'npm run migrate -- --check',
      'npm run migrate -- --write',
      'gitleaks',
      'droit de réponse',
    ]) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
    assert.ok(!runbook.includes('<candidat>-<theme>-<slug>'));
  });

  it('documente l’action utilisateur dans les réglages GitHub', () => {
    assert.ok(runbook.includes('Dependabot alerts'));
    assert.ok(runbook.includes('Settings > Code security'));
  });
});

describe('docs/RUNBOOK.md (phase 2)', () => {
  it('a les sections du validateur', () => {
    for (const heading of [
      'Codes du validateur',
      'Verrouiller un identifiant de candidat',
      'Ajouter un piège',
      "Faux positif d'une règle",
      'Mode preview',
    ]) {
      assert.match(runbook, new RegExp(`^#{2,4} ${heading}$`, 'm'), `titre manquant : ${heading}`);
    }
  });

  it('mentionne chaque code du catalogue au moins une fois', () => {
    const manquants = CATALOGUE.map((e) => e.code).filter((code) => !runbook.includes(`\`${code}\``));
    assert.deepEqual(manquants, [], `codes absents du RUNBOOK : ${manquants.join(', ')}`);
  });

  it('explique le verrou append-only vérifié par la CI et les commandes associées', () => {
    for (const needle of ['npm run ids -- --write', 'npm run ids -- --check', '--base', 'attendu.json', 'RTP_MODE']) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
  });
});

describe('docs/RUNBOOK.md (phase 3, archivage)', () => {
  it('documente l’outil d’archivage et le dépôt privé', () => {
    for (const needle of ['Archiver une source', 'RTP_ARCHIVES_DIR', '--wayback-missing', '--sync-private', '--file']) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
    assert.match(runbook, /^#{2,4} Archiver une source$/m);
  });
});

describe('fichiers annexes', () => {
  it('.env.example ne fixe plus NODE_VERSION=20', () => {
    assert.ok(!envExample.includes('NODE_VERSION=20'));
  });

  it('archives/README.md renvoie au dépôt privé et au plafond', () => {
    assert.ok(archivesReadme.includes('reveleTonProg-archives'));
    assert.ok(archivesReadme.includes('5 Mo'));
  });

  it('.editorconfig impose 2 espaces', () => {
    assert.ok(editorconfig.includes('indent_size = 2'));
  });
});

describe('phase 3 : documentation', () => {
  it('le README décrit la racine réelle par défaut, l’import et l’archive', () => {
    for (const needle of ['npm run import:datagouv', 'npm run archive', 'RTP_CONTENT_ROOT', 'tests/fixtures/corpus-valide']) {
      assert.ok(readme.includes(needle), `README doit contenir « ${needle} »`);
    }
    assert.ok(/par défaut[^\n]*vrai corpus/i.test(readme), 'README doit dire que le défaut est le vrai corpus');
  });

  it('le RUNBOOK documente import, couverture, archivage et ouverture de la relecture', () => {
    for (const needle of ['Importer les statuts data.gouv', 'Mesurer la couverture', 'Archiver une source', 'Ouvrir la relecture', 'relecture_ouverte']) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
    assert.ok(!runbook.includes('<candidat>-<theme>-<slug>'));
  });

  it('l’ARCHITECTURE porte les ADR de la phase 3 et le défaut réel dans .env.example', () => {
    for (const n of ['042', '043', '044', '045', '046']) assert.ok(architecture.includes(`### ADR-${n} :`), `ADR-${n} absent`);
    assert.ok(architecture.includes('### ADR-042 : racine par défaut = corpus réel, fixture explicite'));
    assert.ok(/^# RTP_CONTENT_ROOT=tests\/fixtures\/corpus-valide$/m.test(envExample));
    assert.ok(envExample.includes('RTP_ARCHIVES_DIR'));
  });
});

describe('documentation (phase 5)', () => {
  it('README : tests navigateur et URL de test', () => {
    for (const needle of ['npm run e2e', 'npx playwright install chromium', 'site-preview', 'node e2e/serveur.ts']) {
      assert.ok(readme.includes(needle), `README doit contenir « ${needle} »`);
    }
    assert.doesNotMatch(readme, /alignd|spikeelabs/i);
  });

  it('RUNBOOK : e2e, URL de test, droit de réponse complété, étapes juridiques du lot 3', () => {
    for (const needle of ['### Tests navigateur (e2e)', '### URL de test', 'trois jours', 'trois mois', 'article 1-1', 'statut: actif', 'juriste', 'Hetzner Online GmbH']) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
    const droit = runbook.split('### Droit de réponse')[1]?.split('\n## ')[0] ?? '';
    assert.ok(droit.length > 200 && !droit.includes('À compléter'), 'Droit de réponse non complété');
    assert.doesNotMatch(runbook, /alignd|spikeelabs/i);
  });

  it('ARCHITECTURE : ADR de la phase 5 sans (D- et schéma e2e', () => {
    const titres = [
      'tests navigateur hors de npm test, Chromium seul, serveur gzip maison',
      'pages institutionnelles générées depuis la configuration du validateur',
      'hébergeur prévu ou actif, garde de déploiement',
      'écart du jeu de données : annonce dans un fichier de données, comptes calculés depuis l’instantané haché',
      'URL de test = artefact CI de la build preview, aucun hébergement avant le Lot 3',
      'test croisé simulé : banc journalisé, scénario écrit avant les résultats',
    ];
    for (const t of titres) {
      const re = new RegExp(`^### ADR-\\d{3} : ${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
      assert.match(architecture, re, `ADR « ${t} » manquant`);
    }
    assert.ok(architecture.includes('e2e'));
    assert.ok(architecture.includes('site-preview'));
    assert.doesNotMatch(architecture, /alignd|spikeelabs/i);
  });
});

describe('docs/AUDIT-TEST-CROISE.md (QUAL-06)', () => {
  const audit = read('docs/AUDIT-TEST-CROISE.md');

  it('nomme les trois personas', () => {
    for (const p of ['enfant-10-ans', 'retraite-72-ans', 'journaliste']) assert.ok(audit.includes(`\`${p}\``), `persona ${p} absente`);
  });

  it('tableau des pièges : 7 lignes, une par code §12, sans « à remplir »', () => {
    const table = audit.split('## Données piégées')[1]?.split('\n## ')[0] ?? '';
    const lignes = table.split('\n').filter((l) => /^\| [^|-]/.test(l) && l.includes('--test-name-pattern'));
    assert.equal(lignes.length, 7);
    const codes = ['SOURCE_ABSENTE', 'MOT_INTERDIT', 'SONDAGE_NOTICE_ABSENTE', 'SONDAGE_SOMME_HORS_BORNES', 'SONDAGE_TOUR2_EN_TOUR1', 'CHIFFRE_HORS_SOURCE', 'SONDAGE_FENETRE_BLOCAGE'];
    for (const c of codes) assert.ok(lignes.some((l) => l.includes(`\`${c}\``)), `piège ${c} absent`);
    assert.ok(!table.includes('à remplir'), 'résultat de piège non rempli');
  });

  it('contient un verdict, ni tiret long ni demi-cadratin, aucune mention externe', () => {
    assert.match(audit, /^## Verdict\n\n.*\b(prêt|pas prêt)\b/m);
    assert.doesNotMatch(audit, /[–—]/);
    assert.doesNotMatch(audit, /alignd|spikeelabs/i);
  });

  it('audit/journal.jsonl : non vide, chaque ligne a exactement les 6 clés autorisées', () => {
    const lignes = read('audit/journal.jsonl').trim().split('\n');
    assert.ok(lignes.length > 0 && lignes[0] !== '');
    for (const [i, l] of lignes.entries()) {
      const o = JSON.parse(l) as Record<string, unknown>;
      assert.equal(Object.keys(o).sort().join(), 'chemin,horodatage,niveau,octets,persona,sha256', `ligne ${i + 1}`);
    }
  });
});

/** Texte d'un ADR : de son titre au titre `### ` suivant (ou à la section `## ` suivante). */
function sectionAdr(numero: string): string {
  const debut = architecture.search(new RegExp(`^### ADR-${numero} : `, 'm'));
  assert.ok(debut >= 0, `ADR-${numero} absent`);
  const finTitre = architecture.indexOf('\n', debut);
  const reste = architecture.slice(debut, finTitre < 0 ? undefined : finTitre + 1);
  const corps = finTitre < 0 ? '' : architecture.slice(finTitre + 1);
  const fin = corps.search(/^#{2,3} /m);
  return reste + (fin < 0 ? corps : corps.slice(0, fin));
}

describe('documentation (phase 7)', () => {
  it('ARCHITECTURE : ADR-053 et ADR-056 de la phase 7 (054, 055, 057 et 058 consignés par la phase 8)', () => {
    assert.match(architecture, /^### ADR-053 : domaine déclaré une seule fois/m);
    assert.match(architecture, /^### ADR-056 : CSS et scripts dans la page, CSP à empreintes/m);
  });

  it('ARCHITECTURE : l\'ADR-037 est marqué remplacé par l\'ADR-056 et garde son début de titre', () => {
    const titre = architecture.match(/^### ADR-037 : .*$/m)?.[0] ?? '';
    assert.ok(titre.startsWith('### ADR-037 : pages compatibles CSP'), titre);
    assert.ok(titre.includes("(remplacée par l'ADR-056)"), titre);
  });

  it('ARCHITECTURE : l\'ADR-056 dit que l\'en-tête Caddy couvre le script d\'ordre, pas la meta', () => {
    const adr = sectionAdr('056');
    for (const needle of ['deploy/caddy/site.caddy', 'en-tête', "script d'ordre", 'insertScriptHash', 'bypassCSP']) {
      assert.ok(adr.includes(needle), `ADR-056 doit contenir « ${needle} »`);
    }
    assert.doesNotMatch(adr, /meta[^.\n]{0,80}(couvre|protège) (le|aussi le) script d'ordre/);
  });

  it('ARCHITECTURE : l\'ADR-051 note que le dépôt est public depuis le 2026-11-04', () => {
    const adr = sectionAdr('051');
    for (const needle of ['2026-11-04', 'public', 'site-preview', 'jamais déployée']) {
      assert.ok(adr.includes(needle), `ADR-051 doit contenir « ${needle} »`);
    }
  });

  it('ARCHITECTURE : l\'ADR-053 décrit la source unique du domaine et sa garde', () => {
    const adr = sectionAdr('053');
    for (const needle of ['config/site.yml', 'RTP_DEPLOIEMENT=1', 'sitemap.xml', 'node scripts/render-caddy.ts']) {
      assert.ok(adr.includes(needle), `ADR-053 doit contenir « ${needle} »`);
    }
  });

  it('RUNBOOK : changer de domaine, bloc Caddy, e2e CSP et bfcache, astro dev', () => {
    assert.match(runbook, /^### Changer de domaine$/m);
    for (const needle of ['node scripts/render-caddy.ts', "channel: 'chromium'", 'bypassCSP', 'astro dev']) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
  });

  it('RUNBOOK : chaque code de check-dist est documenté', () => {
    const manquants = CODES_CHECK_DIST.filter((code) => !runbook.includes(`\`${code}\``));
    assert.deepEqual(manquants, [], `codes check-dist absents du RUNBOOK : ${manquants.join(', ')}`);
  });

  it('README : domaine dans config/site.yml, bloc Caddy généré', () => {
    for (const needle of ['config/site.yml', 'deploy/caddy/site.caddy']) {
      assert.ok(readme.includes(needle), `README doit contenir « ${needle} »`);
    }
  });
});

/** Texte d'une section du RUNBOOK : de son titre au titre suivant de même niveau ou plus haut. */
function sectionRunbook(titre: string): string {
  const echappe = titre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = runbook.match(new RegExp(`^(#{2,3}) ${echappe}$`, 'm'));
  assert.ok(m && m.index !== undefined, `section « ${titre} » absente du RUNBOOK`);
  const niveau = m[1]?.length ?? 2;
  const corps = runbook.slice(m.index + m[0].length);
  const fin = corps.search(new RegExp(`^#{2,${niveau}} `, 'm'));
  return m[0] + (fin < 0 ? corps : corps.slice(0, fin));
}

describe('documentation (phase 8) : RUNBOOK', () => {
  const titres = [
    '## Déploiement',
    '### Retour arrière',
    "### Gel des scrutins et retrait d'urgence",
    '### Hôte technique (essai)',
    '### Serveur : installer et vérifier',
    '### Environments GitHub',
    '### Bloc Caddy (Phase 8)',
    '## Restauration',
    '## Monitoring',
  ];

  it('a les titres de la chaîne de livraison, sans « (lot 3, à venir) »', () => {
    for (const t of titres) {
      const echappe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(runbook, new RegExp(`^${echappe}$`, 'm'), `titre manquant : ${t}`);
    }
    assert.doesNotMatch(runbook, /lot 3, à venir/);
  });

  it('donne les commandes des scripts et workflows de la Phase 8', () => {
    for (const needle of [
      'rollback.yml',
      'runuser -u deploy',
      'deploy-production',
      'DEPLOY_CIBLE',
      'retrait_urgence',
      'ops/installer-serveur.sh --verifier',
      'ops/valider-caddy.sh',
      'ops/verifier-sites.sh',
      'rtp-tester-restauration',
      'docker compose up -d --no-deps --force-recreate caddy',
      'import /etc/caddy/sites.d/*.caddy',
      'prevent self-review',
    ]) {
      assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
    }
  });

  it('retour arrière : commandes, attente d\'approbation, repli sans GitHub', () => {
    const s = sectionRunbook('Retour arrière');
    for (const needle of [
      'gh workflow run rollback.yml -f cible=essai',
      '-f version=<sha>',
      '/version.json',
      'retour-production',
      'le **rejeter**',
      `ssh keel-vps 'SSH_ORIGINAL_COMMAND="retour essai" runuser -u deploy -- /usr/local/sbin/rtp-deploy-command'`,
      '2 min',
    ]) {
      assert.ok(s.includes(needle), `Retour arrière doit contenir « ${needle} »`);
    }
  });

  it('gel : fenêtres de Paris et retrait d\'urgence justifié', () => {
    const s = sectionRunbook("Gel des scrutins et retrait d'urgence");
    for (const needle of ['17 au 19 avril', '1er au 3 mai 2027', 'heure de Paris', '-f retrait_urgence=true', '-f justification=', '20 caractères']) {
      assert.ok(s.includes(needle), `Gel doit contenir « ${needle} »`);
    }
  });

  it('hôte technique : utilisateurs, noindex, et le point de la Phase 9 sur les Mentions légales', () => {
    const s = sectionRunbook('Hôte technique (essai)');
    for (const needle of ['essai', 'sonde', 'noindex', 'robots.txt', 'Phase 9', 'aucun serveur de l\'éditeur ne reçoit vos visites', 'prevu', 'actif']) {
      assert.ok(s.includes(needle), `Hôte technique doit contenir « ${needle} »`);
    }
  });

  it('serveur : règle D-01, étapes, procédure de recréation et piège du -f seul', () => {
    const s = sectionRunbook('Serveur : installer et vérifier');
    for (const needle of ['--appliquer', '--etape', '/opt/rtp/depot', 'rtp-deploy-command', 'docker-compose.override.yml', '-f docker-compose.yml']) {
      assert.ok(s.includes(needle), `Serveur doit contenir « ${needle} »`);
    }
  });

  it('Environments GitHub : production et sonde, noms des secrets et variables', () => {
    const s = sectionRunbook('Environments GitHub');
    for (const needle of ['production', 'sonde', 'DEPLOY_SSH_KEY', 'DEPLOY_KNOWN_HOSTS', 'DEPLOY_SMOKE_PASS', 'SONDE_PING_URL', 'SONDE_URL', 'main']) {
      assert.ok(s.includes(needle), `Environments GitHub doit contenir « ${needle} »`);
    }
  });

  it('bloc Caddy : faits du serveur réel, plus d\'hypothèses ni d\'Uptime Kuma', () => {
    const s = sectionRunbook('Bloc Caddy (Phase 8)');
    for (const needle of ['2.11.2', 'inode', 'HASH_FACTICE', 'Phase 9']) {
      assert.ok(s.includes(needle), `Bloc Caddy doit contenir « ${needle} »`);
    }
    assert.doesNotMatch(runbook, /Uptime Kuma/);
    assert.doesNotMatch(runbook, /rsync -az --delete/);
    assert.doesNotMatch(s, /Hypothèses à confirmer/);
  });

  it('restauration et monitoring : archive, Vaultwarden, contrôles et alertes simulées', () => {
    const r = sectionRunbook('Restauration');
    for (const needle of ['rtp-sauvegarder', 'rtp-tester-restauration', 'Vaultwarden', 'Hetzner', 'ops/installer-serveur.sh']) {
      assert.ok(r.includes(needle), `Restauration doit contenir « ${needle} »`);
    }
    const m = sectionRunbook('Monitoring');
    for (const needle of ['Healthchecks', 'Telegram', 'vps-battement', 'vps-disque-85', 'vps-disque-92', 'vps-certificat', 'sonde-externe', 'restauration-mensuelle', 'RTP_SEUIL1', 'RTP_SEUIL2', 'RTP_CERT_JOURS', '60 jours']) {
      assert.ok(m.includes(needle), `Monitoring doit contenir « ${needle} »`);
    }
  });

  it('revue mensuelle : lancer le test de restauration et noter le résultat', () => {
    const s = sectionRunbook("Revue mensuelle d'hygiène (15 min, notes dans RETROSPECTIVE.md)");
    assert.ok(s.includes('rtp-tester-restauration'), 'la revue mensuelle doit lancer rtp-tester-restauration');
    assert.ok(s.includes('RETROSPECTIVE.md'));
  });

  it('les sections nouvelles ou réécrites n\'ont ni tiret long ni demi-cadratin', () => {
    for (const t of ['Déploiement', 'Restauration', 'Monitoring']) {
      assert.doesNotMatch(sectionRunbook(t), /[–—]/, `tiret long ou demi-cadratin dans « ${t} »`);
    }
  });
});

describe('documentation (phase 8) : ADR et README', () => {
  it('ARCHITECTURE : ADR-054, 055, 057 et 058, dans l\'ordre numérique autour de l\'ADR-056', () => {
    const position = (n: string): number => architecture.search(new RegExp(`^### ADR-${n} : `, 'm'));
    for (const n of ['054', '055', '057', '058']) assert.ok(position(n) >= 0, `ADR-${n} absent`);
    const ordre = ['053', '054', '055', '056', '057', '058'].map(position);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'ADR-053 à 058 hors de l\'ordre numérique');
    assert.equal((architecture.match(/^### ADR-05[4578] : /gm) ?? []).length, 4);
  });

  it('ARCHITECTURE : chaque ADR de la phase 8 a Contexte, Décision, Conséquences et ses mots clés', () => {
    const attendus: Record<string, string[]> = {
      '054': ['releases/<sha>', 'mv -T', 'ids.lock'],
      '055': ['environment', 'RTP_DEPLOIEMENT=1', 'essai', 'DEPLOY_CIBLE'],
      '057': ['caddy validate', 'docker-compose.override.yml', 'sites.d', 'cache long'],
      '058': ['Healthchecks', 'Telegram', 'rtp-tester-restauration'],
    };
    for (const [n, needles] of Object.entries(attendus)) {
      const adr = sectionAdr(n);
      for (const rubrique of ['**Contexte**', '**Décision**', '**Conséquence']) {
        assert.ok(adr.includes(rubrique), `ADR-${n} sans ${rubrique}`);
      }
      for (const needle of needles) assert.ok(adr.includes(needle), `ADR-${n} doit contenir « ${needle} »`);
      assert.doesNotMatch(adr, /[–—]/, `tiret long ou demi-cadratin dans l\'ADR-${n}`);
    }
  });

  it('README : où sont les secrets de la phase 8, sans valeur', () => {
    const s = readme.split('## Où sont les secrets\n')[1]?.split('\n## ')[0] ?? '';
    for (const needle of [
      'production',
      'sonde',
      'DEPLOY_SSH_KEY',
      'DEPLOY_SMOKE_PASS',
      'SONDE_PING_URL',
      '/opt/vaultwarden/.env',
      '/etc/rtp/battement.env',
      '/etc/rtp/restauration.env',
      'Vaultwarden',
    ]) {
      assert.ok(s.includes(needle), `README (secrets) doit contenir « ${needle} »`);
    }
    assert.doesNotMatch(s, /Aucun secret pour l'instant/);
    assert.doesNotMatch(s, /\$2[aby]\$|hc-ping\.com\/[0-9a-f-]{8}|BEGIN OPENSSH/);
    assert.doesNotMatch(s, /[–—]/);
  });
});

describe('documentation (phase 8) : mesure 4G derrière le serveur réel (PERF-02, 08-14)', () => {
  const M = MESURE_SERVEUR_4G;
  const pire = (id: string): number => Math.max(...(M.profils.find((p) => p.id === id)?.mesuresMs ?? [Number.NaN]));
  const attendus = [
    M.date,
    `${pire('slow-4g-lighthouse')} ms au plus en « Slow 4G simulé »`,
    `FCP ${M.lighthouse.fcpMs} ms`,
    `LCP ${M.lighthouse.lcpMs} ms`,
    `Lighthouse ${M.lighthouse.version}`,
    'MESURE_SERVEUR_4G',
  ];
  for (const [nom, doc] of [['README', readme], ['RUNBOOK', runbook]] as const) {
    it(`${nom} : une phrase reprend la date, le pire chiffre « Slow 4G simulé » et Lighthouse (FCP, LCP)`, () => {
      const lignes = doc.split('\n').filter((l) => l.includes(M.date) && l.includes('« Slow 4G simulé »'));
      assert.equal(lignes.length, 1, `${nom} : ${lignes.length} ligne(s) avec ${M.date} et « Slow 4G simulé »`);
      const ligne = lignes[0] as string;
      for (const needle of attendus) assert.ok(ligne.includes(needle), `${nom} doit contenir « ${needle} » dans la phrase de mesure`);
      assert.doesNotMatch(ligne, /[–—]/, `tiret long ou demi-cadratin dans la phrase de mesure du ${nom}`);
    });
  }
});

describe('documentation (phase 9) : RUNBOOK (LEG-03, PUB-01, PUB-02)', () => {
  const TITRES = [
    '### Relire un thème',
    '### Publier un thème',
    "### Retrait d'urgence d'une mesure (moins d'une heure)",
    '### Ouverture publique (Phase 9)',
  ];
  const nom = (t: string): string => t.replace(/^#+ /, '');

  it('a les quatre titres, une fois chacun', () => {
    for (const t of TITRES) {
      const echappe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.equal((runbook.match(new RegExp(`^${echappe}$`, 'gm')) ?? []).length, 1, `titre absent ou en double : ${t}`);
    }
    assert.equal((runbook.match(/^### Retrait d'urgence d'une mesure/gm) ?? []).length, 1);
    assert.equal((runbook.match(/^### Ouverture publique/gm) ?? []).length, 1);
  });

  it('le retrait d\'urgence est sous « Incidents fréquents » et l\'ancienne section y renvoie', () => {
    const incidents = runbook.split('\n## Incidents fréquents\n')[1]?.split('\n## ')[0] ?? '';
    assert.ok(incidents.includes("### Retrait d'urgence d'une mesure (moins d'une heure)"));
    assert.ok(sectionRunbook('Une mesure publiée sans source').includes("Retrait d'urgence d'une mesure"));
  });

  it('retrait d\'urgence : trois voies dans l\'ordre, piège de la couverture, budget, gel, retour de la mesure', () => {
    const s = sectionRunbook("Retrait d'urgence d'une mesure (moins d'une heure)");
    const ordre = ['rollback.yml', 'relecture -- retirer <candidat>/<slug>', 'relecture -- retirer --theme <id>'].map((n) => s.indexOf(n));
    assert.ok(ordre.every((i) => i >= 0), `une des trois voies manque : ${ordre.join(', ')}`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'les trois voies ne sont pas dans l\'ordre');
    for (const needle of [
      '--case non_precise --sources',
      '--case programme_non_publie',
      'EQUITE_COUVERTURE_INCOHERENTE',
      '-f retrait_urgence=true',
      '-f justification=',
      'Review deployments',
      'Rejeter',
      'relecture -- publier',
      'relecture -- marquer',
      'moins d\'une heure',
      'Budget',
      '| Étape |',
      'secondes',
      'issue',
    ]) {
      assert.ok(s.includes(needle), `Retrait d'urgence doit contenir « ${needle} »`);
    }
  });

  it('gel : calendrier 2027 des deux tours, dernier déploiement sûr, source des dates', () => {
    const s = sectionRunbook("Gel des scrutins et retrait d'urgence");
    for (const needle of ['dimanche 18 avril 2027', 'samedi 17 avril 2027', 'lundi 19 avril 2027', 'dimanche 2 mai 2027', 'samedi 1er mai 2027', 'lundi 3 mai 2027', 'vendredi 16 avril 2027', 'vendredi 30 avril 2027', 'src/lib/dates-tours.ts']) {
      assert.ok(s.includes(needle), `Gel doit contenir « ${needle} »`);
    }
    assert.deepEqual(FENETRES_GEL.map((f) => [f.debut, f.fin]), [['2027-04-17', '2027-04-19'], ['2027-05-01', '2027-05-03']]);
  });

  it('relire un thème : worktree, commandes, registre, notes, cas de dates, cas de travail encore ouverts', () => {
    const s = sectionRunbook('Relire un thème');
    for (const needle of [
      'git worktree add',
      'relecture -- liste',
      'relecture -- servir',
      'relecture -- marquer mesure',
      'relecture -- marquer statut',
      'relecture -- marquer case',
      'relecture -- note',
      '--resoudre',
      'relecture/journal.jsonl',
      'a_revoir',
      'COUVERTURE_VERIFIEE_AVANT_SOURCE',
      'clara-egger',
      'benoit-mathieu',
      'manolo-mlekuz',
      'antoine-mikolajczak',
      'natacha-polony',
      'travail',
    ]) {
      assert.ok(s.includes(needle), `Relire un thème doit contenir « ${needle} »`);
    }
  });

  it('publier un thème : liste blanche, publier, refus, personnes sans statut relu, ligne du relecteur', () => {
    const s = sectionRunbook('Publier un thème');
    for (const needle of [
      'config/publication.yml',
      'themes_ouverts',
      'relecture -- publier',
      '--dry-run',
      'PUBLICATION_THEME_NON_OUVERT',
      'RELECTURE_ABSENTE',
      'CANDIDAT_NON_RELU_EN_PRODUCTION',
      'THEME_HORS_LISTE_BLANCHE',
      'Relue par',
      'Pull request',
      'Review deployments',
    ]) {
      assert.ok(s.includes(needle), `Publier un thème doit contenir « ${needle} »`);
    }
  });

  it('archivage : adoption d\'un instantané Wayback, exception motivée, site qui refuse l\'agent (403)', () => {
    const s = sectionRunbook('Archiver une source');
    for (const needle of ['--wayback-adopter', '--instantane', '--nouvelle-url', 'wayback_exception', 'decide_par', 'tests/rules/sources-wayback.test.ts', 'erwan-rohou-programme-mei', '403', '--file']) {
      assert.ok(s.includes(needle), `Archiver une source doit contenir « ${needle} »`);
    }
  });

  it('droit de réponse : décret 2007-1527, 200 lignes, trois mois, trois jours, art. 1-1', () => {
    const s = sectionRunbook('Droit de réponse');
    for (const needle of ['2007-1527', '200 lignes', 'trois mois', 'trois jours', '1-1', 'accusé de réception', 'prouvant', '3 750 euros', 'issue']) {
      assert.ok(s.includes(needle), `Droit de réponse doit contenir « ${needle} »`);
    }
    assert.doesNotMatch(s, /valeur provisoire en `\.invalid`/);
  });

  it('étapes juridiques : chaque étape est marquée faite, remplacée ou à faire avec son plan', () => {
    const liste = runbook.split('Étapes juridiques')[1]?.split('### Retour arrière')[0] ?? '';
    for (const needle of ['09-08', '09-11', '09-04', 'note de risques signée']) {
      assert.ok(liste.includes(needle), `Étapes juridiques doit contenir « ${needle} »`);
    }
    const etapes = liste.split('\n').filter((l) => /^\d+\. /.test(l));
    assert.equal(etapes.length, 9);
    for (const e of etapes) assert.match(e, /^\d+\. \*\*(Fait|Remplacé|À faire|Sans objet)/, `étape sans marque : ${e.slice(0, 60)}`);
  });

  it('autres sections mises à jour : relecture ouverte, garde de déploiement, git archive, sonde à un jour', () => {
    assert.match(sectionRunbook('Ouvrir la relecture'), /vaut `true` depuis le premier commit de la phase 9/);
    assert.doesNotMatch(runbook, /vaut `false` pendant la phase 3/);
    assert.doesNotMatch(runbook, /Tant que le domaine n'est pas acheté, `config\/site\.yml` garde/);
    const serveur = sectionRunbook('Serveur : installer et vérifier');
    assert.ok(serveur.includes('git archive --format=tar.gz HEAD ops deploy'));
    assert.doesNotMatch(runbook, /tar -C \. -cz ops deploy/);
    const m = sectionRunbook('Monitoring');
    for (const needle of ['1 jour', 'OPS-01', 'battement']) assert.ok(m.includes(needle), `Monitoring doit contenir « ${needle} »`);
  });

  it('ouverture publique : réglages GitHub, écritures du serveur dans l\'ordre, contrôles, suites datées', () => {
    const s = sectionRunbook('Ouverture publique (Phase 9)');
    const ordre = [
      'gh variable delete DEPLOY_URL --env production',
      'gh variable set DEPLOY_CIBLE --body production',
      '-f deployer=true',
      'git archive --format=tar.gz HEAD ops deploy',
      '--etape site-public',
      'ops/valider-caddy.sh',
      'caddy validate',
      'caddy reload',
      'gh variable set DEPLOY_URL --env production --body https://<domaine>',
      'gh variable set SONDE_URL',
      '--etape battement',
      'touch /opt/rtp/essai-retire',
      'rtp-tester-restauration',
    ].map((n) => s.indexOf(n));
    assert.ok(ordre.every((i) => i >= 0), `commande absente : ${ordre.join(', ')}`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'les commandes ne sont pas dans l\'ordre');
    for (const needle of [
      'DEPLOY_CIBLE',
      'DEPLOY_SMOKE_USER',
      'DEPLOY_SMOKE_PASS',
      'SONDE_USER',
      'SONDE_PASS',
      'RTP_HOTE',
      '[ok: retiré]',
      'verifier-sites.sh',
      'www',
      'robots.txt',
      'sitemap.xml',
      'noindex',
      'version.json',
      '31536000',
      'includeSubDomains',
      'preload',
      '7 jours',
      'AAAA',
      'accord',
      'Retour arrière',
    ]) {
      assert.ok(s.includes(needle), `Ouverture publique doit contenir « ${needle} »`);
    }
  });

  it('les commandes du RUNBOOK existent : commandes de relecture, entrées des workflows, options d\'archivage', () => {
    for (const m of runbook.matchAll(/relecture -- (?:--root \S+ )?([a-z]+)/g)) {
      assert.ok((COMMANDES as readonly string[]).includes(m[1] as string), `commande de relecture inconnue : ${m[1]}`);
    }
    const ci = read('.github/workflows/ci.yml');
    const rollback = read('.github/workflows/rollback.yml');
    for (const entree of ['deployer', 'retrait_urgence', 'justification']) assert.match(ci, new RegExp(`^      ${entree}:`, 'm'), `ci.yml sans l'entrée ${entree}`);
    for (const entree of ['cible', 'version', 'retrait_urgence', 'justification']) assert.match(rollback, new RegExp(`^      ${entree}:`, 'm'), `rollback.yml sans l'entrée ${entree}`);
    const archive = read('scripts/archive-source.ts');
    for (const option of ['--wayback-adopter', '--instantane', '--nouvelle-url']) assert.ok(archive.includes(option), `archive-source.ts sans ${option}`);
    const installateur = read('ops/installer-serveur.sh');
    for (const etape of ['site-public', 'battement', 'depot']) assert.ok(installateur.includes(etape));
  });

  it('table check-dist : chaque code y figure une seule fois', () => {
    const table = runbook.split('### Contrôle post-build (check-dist)')[1]?.split('\n### ')[0] ?? '';
    for (const code of CODES_CHECK_DIST) {
      const lignes = table.split('\n').filter((l) => l.startsWith(`| \`${code}\` |`));
      assert.equal(lignes.length, 1, `${code} : ${lignes.length} ligne(s) dans la table check-dist`);
    }
  });

  it('aucun secret, hash, adresse de ping ni adresse IP dans les sections de la phase 9', () => {
    const sections = [...TITRES.map(nom), 'Archiver une source', 'Droit de réponse'].map((t) => sectionRunbook(t)).join('\n');
    assert.doesNotMatch(sections.replaceAll('127.0.0.1', 'boucle-locale').replaceAll('1.1.1.1', 'resolveur-a').replaceAll('9.9.9.9', 'resolveur-b'), /\$2[aby]\$|hc-ping\.com\/[0-9a-f-]{8}|BEGIN OPENSSH|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });

  it('les sections nouvelles ou réécrites n\'ont ni tiret long ni demi-cadratin, ni mot interdit', () => {
    const noms = [...TITRES.map(nom), "Gel des scrutins et retrait d'urgence", 'Droit de réponse', 'Archiver une source', 'Serveur : installer et vérifier', 'Ouvrir la relecture'];
    for (const t of noms) {
      const s = sectionRunbook(t);
      assert.doesNotMatch(s, /[–—]/, `tiret long ou demi-cadratin dans « ${t} »`);
      assert.deepEqual(motsInterdits(s, { exempterCitations: false }), [], `mot interdit dans « ${t} »`);
    }
    const liste = runbook.split('Étapes juridiques')[1]?.split('### Retour arrière')[0] ?? '';
    assert.doesNotMatch(liste, /[–—]/);
  });
});

describe('documentation (phase 9) : ADR', () => {
  const ATTENDUS: Record<string, { titre: string; needles: string[] }> = {
    '059': { titre: 'outil de relecture local', needles: ['relecture/journal.jsonl', 'node.range', 'relu', 'publie', 'hors de src/content'] },
    '060': { titre: 'liste blanche de publication', needles: ['config/publication.yml', 'PUBLICATION_THEME_NON_OUVERT', 'THEME_HORS_LISTE_BLANCHE', 'ADR-041', 'CANDIDAT_NON_RELU_EN_PRODUCTION'] },
    '061': { titre: 'exception Wayback motivée', needles: ['wayback_exception', '--wayback-adopter', 'paragraphe'] },
    '062': { titre: 'éditeur non professionnel', needles: ['1-1', 'note de risques', 'domiciliation', 'Hetzner'] },
  };

  it('ARCHITECTURE : ADR-059 à 062 après l\'ADR-058 et avant les dépendances externes, dans l\'ordre', () => {
    const position = (n: string): number => architecture.search(new RegExp(`^### ADR-${n} : `, 'm'));
    const ordre = ['058', '059', '060', '061', '062'].map(position);
    assert.ok(ordre.every((i) => i >= 0), `ADR absent : ${ordre.join(', ')}`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre);
    assert.ok(position('062') < architecture.indexOf('## Dépendances externes critiques'));
    for (const n of Object.keys(ATTENDUS)) assert.equal((architecture.match(new RegExp(`^### ADR-${n} : `, 'gm')) ?? []).length, 1, `ADR-${n} en double`);
  });

  for (const [n, { titre, needles }] of Object.entries(ATTENDUS)) {
    it(`ADR-${n} : titre, Contexte, Décision, Conséquence, mots clés, aucun tiret long`, () => {
      const adr = sectionAdr(n);
      assert.ok(adr.split('\n')[0]?.includes(titre), `titre de l'ADR-${n} sans « ${titre} »`);
      for (const rubrique of ['**Contexte**', '**Décision**', '**Conséquence']) assert.ok(adr.includes(rubrique), `ADR-${n} sans ${rubrique}`);
      for (const needle of needles) assert.ok(adr.includes(needle), `ADR-${n} doit contenir « ${needle} »`);
      assert.doesNotMatch(adr, /[–—]/);
      assert.deepEqual(motsInterdits(adr, { exempterCitations: false }), []);
    });
  }

  it('ADR-049 : note de la phase 9, `actif` conditionne aussi la phrase d\'identité et celle de la sortie d\'erreur', () => {
    const adr = sectionAdr('049');
    assert.ok(adr.includes('Note de la phase 9'));
    assert.ok(adr.includes('phrase d\'identité'));
    assert.ok(adr.includes('sortie d\'erreur'));
  });

  it('le schéma Mermaid reste fermé et unique', () => {
    assert.equal((architecture.match(/^```mermaid$/gm) ?? []).length, 1);
    assert.equal((architecture.match(/^```$/gm) ?? []).length, 1);
  });
});

describe('documentation (phase 10) : import de décembre (IMP-03)', () => {
  const IMPORT = 'Import de décembre (10 au 13 décembre 2026)';
  const GEL = "Gel d'import (13 au 15 décembre 2026)";
  const ANCIEN = 'Importer les statuts data.gouv';
  const script = read('scripts/import-datagouv.ts');
  const scriptsNpm = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

  it("section « Gel d'import » : bornes décidées, interdits, seule exception, run en attente rejeté, fenêtres de 2027 inchangées", () => {
    const s = sectionRunbook(GEL);
    for (const needle of ['13 décembre 2026', '15 décembre 2026', '18:00', '23:59', 'retrait_urgence', 'justification', 'scripts/garde-gel.ts']) {
      assert.ok(s.includes(needle), `« ${needle} » absent de la section « ${GEL} »`);
    }
    assert.match(s, /rejet/);
    assert.match(s, /fusion/);
  });

  it('le gel d’import suit immédiatement « Gel des scrutins et retrait d’urgence »', () => {
    const iGel = runbook.search(/^### Gel des scrutins et retrait d'urgence$/m);
    const iImport = runbook.search(new RegExp(`^### ${GEL.replace(/[()]/g, '\\$&')}$`, 'm'));
    assert.ok(iGel >= 0 && iImport > iGel);
    assert.equal(runbook.slice(iGel, iImport).match(/^### /gm)?.length, 1, 'une seule section entre les deux');
  });

  it('les fenêtres de gel de 2027 restent exactement les deux fenêtres des tours (D-09 : règle écrite, pas de garde technique)', () => {
    assert.deepEqual(FENETRES_GEL.map((f) => [f.debut, f.fin]), [['2027-04-17', '2027-04-19'], ['2027-05-01', '2027-05-03']]);
  });

  it("section « Import de décembre » : branche, ordre de fusion, recréation, preuve d'ancêtre, options, vocabulaire, règle D-08", () => {
    const s = sectionRunbook(IMPORT);
    for (const needle of [
      'import/statuts-2026-12',
      'relecture/sante',
      'recréer la branche',
      '--is-ancestor',
      '--dry-run',
      '--format markdown',
      '--check',
      'Absents du jeu amont',
      'STATUT_PLUS_RECENT_NON_RELU',
      '06237c53-76bd-4224-9805-418e125f0493',
      '13 décembre 2026 à 12:00',
      'reporter',
      'jamais fusionner',
      'marquer statut',
      '--hors-perimetre',
      'data/couverture-themes.yaml',
      'src/content/couverture/',
      'gh run list --branch main --status waiting',
    ]) {
      assert.ok(s.includes(needle), `« ${needle} » absent de la section « ${IMPORT} »`);
    }
    assert.match(s, /aucun agent/i);
  });

  it('la liste de contrôle des mises à jour à la main compte huit points et nomme les deux décisions de l’éditeur', () => {
    const s = sectionRunbook(IMPORT);
    const debut = s.indexOf('Liste de contrôle');
    assert.ok(debut >= 0, 'liste de contrôle absente');
    const liste = s.slice(debut);
    const points = [...liste.matchAll(/^\s*(\d+)\.\s+`/gm)].map((m) => Number(m[1]));
    assert.deepEqual(points.slice(0, 8), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok((liste.match(/Décision d'Erwan/g) ?? []).length >= 2, 'les points 6 et 7 doivent nommer la décision d’Erwan');
    for (const f of ['data/dataset-datagouv.yaml', 'data/import/ATTRIBUTION.md', 'LICENSE', 'tests/corpus/dataset-datagouv.test.ts', 'tests/dist/cas/methode.cas.ts', 'README.md', 'docs/COUVERTURE-THEMES.md']) {
      assert.ok(liste.includes(f), `${f} absent de la liste de contrôle`);
    }
  });

  it('chaque option et chaque script cités dans l’import existent dans le code', () => {
    for (const titre of [IMPORT, ANCIEN]) {
      const s = sectionRunbook(titre);
      // Les options qui suivent la commande, jusqu'à la fin du bloc de code en ligne ou de la ligne.
      for (const cmd of s.matchAll(/import:datagouv([^`\n>)]*)/g)) {
        for (const o of (cmd[1] ?? '').matchAll(/(?<![\w-])--([a-z][a-z-]*)/g)) {
          assert.ok(new RegExp(`['\\s{,]${o[1]}'?\\s*:\\s*\\{ type:`).test(script), `option --${o[1]} (section « ${titre} ») absente de scripts/import-datagouv.ts`);
        }
      }
      for (const m of s.matchAll(/npm run (?:-s )?([a-z:-]+)/g)) assert.ok(m[1] !== undefined && m[1] in scriptsNpm, `script npm inconnu : ${m[1]}`);
      for (const m of s.matchAll(/npm run relecture -- (?:--[a-z-]+ \S+ )?([a-z]+)/g)) {
        assert.ok((COMMANDES as readonly string[]).includes(m[1] as string), `commande de relecture inconnue : ${m[1]}`);
      }
    }
  });

  it("l'ancienne section décrit l'outil actuel : --dry-run, --format markdown, --check, « Nouveaux à décider », « Absents du jeu amont »", () => {
    const s = sectionRunbook(ANCIEN);
    for (const needle of ['--dry-run', '--format markdown', '--check', 'Nouveaux à décider', 'Absents du jeu amont']) {
      assert.ok(s.includes(needle), `« ${needle} » absent de la section « ${ANCIEN} »`);
    }
  });

  it('WR-05 : le worktree d’import existe avant que la table soit écrite, et la table est écrite dans ce worktree', () => {
    const s = sectionRunbook(IMPORT);
    const deroule = s.slice(s.indexOf('**Déroulé.**'), s.indexOf('**Si `main` avance'));
    const iWorktree = deroule.indexOf('git worktree add -b import/statuts-2026-12 ../reveleTonProg-import origin/main');
    const iDecisions = deroule.indexOf("**Décisions d'Erwan**");
    const iDiff = deroule.indexOf('git diff --stat data/import/correspondances.yaml');
    const iAdd = deroule.indexOf('git add data/import/correspondances.yaml');
    assert.ok(iWorktree >= 0 && iDecisions > iWorktree, 'le worktree doit précéder les décisions');
    assert.ok(iDiff > iDecisions && iAdd > iDiff, 'git diff --stat avant le commit de la table');
    const decisions = deroule.slice(iDecisions, deroule.indexOf('\n', iDecisions));
    assert.ok(decisions.includes('../reveleTonProg-import/data/import/correspondances.yaml'), 'la table est écrite dans le worktree d’import');
  });

  it('WR-07 : « relecture santé fusionnée » se vérifie par la pull request fusionnée, comme le plan 10-05', () => {
    const s = sectionRunbook(IMPORT);
    const condition = s.split('\n').find((l) => /^1\. La branche `relecture\/sante`/.test(l)) ?? '';
    assert.ok(condition.includes('gh pr list --head relecture/sante --state merged --json number --jq length'), condition);
    assert.doesNotMatch(condition.replace(/[^.]*information[^.]*\./g, ''), /--is-ancestor/, '--is-ancestor ne décide pas de la condition');
    const plan = read('.planning/phases/10-import-de-d-cembre/10-05-PLAN.md');
    assert.ok(plan.includes('gh pr list --head relecture/sante --state merged --json number --jq length'), 'même commande que le plan 10-05');
  });

  it('WR-08 : une date au mois seulement (refus de marquer, conflit de l’import) a sa conduite, décidée par Erwan seul', () => {
    const s = sectionRunbook(IMPORT);
    const debut = s.indexOf('**Date au mois seulement.**');
    assert.ok(debut >= 0, 'paragraphe « Date au mois seulement » absent');
    const p = s.slice(debut, s.indexOf('**Liste de contrôle', debut));
    for (const needle of ['un statut relu exige une date complète', 'au mois seulement, dans le mois du dernier statut', 'source primaire', 'ajoutée par cet import', 'marquer statut', 'STATUT_PLUS_RECENT_NON_RELU', 'reporter']) {
      assert.ok(p.includes(needle), `« ${needle} » absent du paragraphe`);
    }
    assert.match(p, /aucun agent ne complète/i);
    // le message que cite le RUNBOOK est bien celui de l'outil (scripts/lib/relecture/commandes/marquer.ts, lu seulement)
    assert.ok(read('scripts/lib/relecture/commandes/marquer.ts').includes('un statut relu exige une date complète'));
    assert.ok(read('scripts/lib/datagouv.ts').includes('au mois seulement, dans le mois du dernier statut'));
  });

  it('WR-06 : la commande range-diff du RUNBOOK, rejouée sur une branche jetable, apparie les seuls commits d’import', () => {
    const s = sectionRunbook(IMPORT);
    const commande = /git range-diff ([^`\n]+)/.exec(s)?.[1]?.trim();
    assert.ok(commande, 'commande git range-diff absente');
    assert.ok(s.includes('git log --oneline origin/main..import/statuts-2026-12 | wc -l'), 'compte des commits recréés absent');
    const depot = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-range-diff-'));
    try {
      const git = (...args: string[]): string => {
        const r = spawnSync('git', args, { cwd: depot, encoding: 'utf8' });
        assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
        return r.stdout;
      };
      const commit = (fichier: string, message: string): void => {
        fs.writeFileSync(path.join(depot, fichier), `${message}\n`);
        git('add', fichier);
        git('commit', '-q', '-m', message);
      };
      git('init', '-q', '-b', 'main');
      git('config', 'user.name', 'Essai');
      git('config', 'user.email', 'essai@exemple.test');
      git('config', 'commit.gpgsign', 'false');
      commit('a.txt', 'main initial');
      git('switch', '-q', '-c', 'import/statuts-2026-12-ancienne');
      commit('table.txt', 'table');
      commit('outil.txt', 'sortie de l’outil');
      commit('relecture.txt', 'relecture');
      git('switch', '-q', 'main');
      commit('b.txt', 'main avance');
      git('update-ref', 'refs/remotes/origin/main', 'main');
      git('switch', '-q', '-c', 'import/statuts-2026-12', 'origin/main');
      for (const sha of git('log', '--format=%H', '--reverse', 'origin/main..import/statuts-2026-12-ancienne').trim().split('\n')) git('cherry-pick', sha);
      const sortie = git('range-diff', ...commande.split(/\s+/)).trim().split('\n');
      assert.equal(sortie.length, 3, sortie.join('\n'));
      for (const l of sortie) assert.match(l, /^\s*\d+:\s+[0-9a-f]+ = \s*\d+:\s+[0-9a-f]+ /, `commit non apparié : ${l}`);
      assert.equal(git('log', '--oneline', 'origin/main..import/statuts-2026-12').trim().split('\n').length, 3);
    } finally {
      fs.rmSync(depot, { recursive: true, force: true });
    }
  });

  it('WR-10 : la garde de volume et son option --accepter-absents sont documentées, décision d’Erwan seul', () => {
    const ancien = sectionRunbook(ANCIEN);
    for (const needle of ['--accepter-absents', '20 %', 'jeu vide', 'garde de volume']) assert.ok(ancien.includes(needle), `« ${needle} » absent de « ${ANCIEN} »`);
    const imp = sectionRunbook(IMPORT);
    assert.ok(imp.includes('--accepter-absents'), `--accepter-absents absent de « ${IMPORT} »`);
    const ligne = imp.split('\n').find((l) => l.includes('--accepter-absents')) ?? '';
    assert.match(ligne, /Erwan/);
    assert.match(ligne, /un agent n'ajoute jamais cette option/);
  });

  it('WR-02 : une date amont qui recule pour un statut inchangé est une information, et les écarts restants ont leur issue', () => {
    const s = sectionRunbook(ANCIEN);
    for (const needle of ['date amont qui recule', 'information', 'Dérives de source', 'ids_externes.2027etmoi', 'data/dataset-datagouv.yaml']) {
      assert.ok(s.includes(needle), `« ${needle} » absent de la section « ${ANCIEN} »`);
    }
    assert.doesNotMatch(s, /\bE5\b/, 'E5 n’existe plus');
    assert.doesNotMatch(read('scripts/lib/instantane.ts'), /champ: 'date'/, 'plus aucune erreur « date » dans la cohérence');
  });

  it('aucun tiret long ni demi-long, aucun mot interdit, aucun secret dans les sections de l’import', () => {
    for (const titre of [IMPORT, GEL, ANCIEN]) {
      const s = sectionRunbook(titre);
      assert.doesNotMatch(s, /[–—]/, `tiret long ou demi-long dans « ${titre} »`);
      assert.deepEqual(motsInterdits(s, { exempterCitations: false }), [], `mot interdit dans « ${titre} »`);
      assert.doesNotMatch(s, /ghp_|github_pat_|-----BEGIN|password\s*[:=]/i);
    }
  });
});
