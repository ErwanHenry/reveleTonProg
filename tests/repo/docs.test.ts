import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, HYPOTHESES } from '../../src/lib/content-core/rules/config.ts';
import { CODES_CHECK_DIST } from '../../scripts/lib/check-dist.ts';

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
  it('ARCHITECTURE : ADR-053 et ADR-056 seulement (054, 055, 057 et 058 réservés aux phases 6 et 8)', () => {
    assert.match(architecture, /^### ADR-053 : domaine déclaré une seule fois/m);
    assert.match(architecture, /^### ADR-056 : CSS et scripts dans la page, CSP à empreintes/m);
    assert.doesNotMatch(architecture, /^### ADR-05[4578] : /m);
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
      'rejeter ou approuver d\'abord le déploiement en attente',
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
