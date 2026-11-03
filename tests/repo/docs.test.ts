import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('justifie chacune des six dépendances sur une ligne', () => {
    for (const dep of ['astro', 'ajv', 'yaml', '@astrojs/check', 'typescript', '@types/node']) {
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

describe('docs/ARCHITECTURE.md', () => {
  it('a un diagramme Mermaid avec content-core', () => {
    const block = architecture.match(/```mermaid\n([\s\S]*?)```/);
    assert.ok(block, 'bloc mermaid absent');
    assert.ok(block[1].includes('content-core'));
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
