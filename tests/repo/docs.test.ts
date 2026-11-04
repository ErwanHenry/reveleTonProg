import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, HYPOTHESES } from '../../src/lib/content-core/rules/config.ts';

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
