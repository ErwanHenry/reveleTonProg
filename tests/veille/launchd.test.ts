// Phase 10.1 : fichiers de planification launchd de la veille (plist et lanceur). Rien n'est chargé dans launchd :
// les fichiers sont écrits dans un dossier temporaire et contrôlés par plutil et sh -n quand ils existent (macOS).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HEURES, LABEL, cheminLanceur, lanceur, plist } from '../../scripts/lib/veille/launchd.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-veille-launchd-'));
  dossiers.push(d);
  return d;
};
const P = { dossier: "/Users/essai/.cache/rtp/veille d'essai", depot: '/Users/essai/projets/reveleTonProg', reference: 'origin/main', fnm: '/opt/homebrew/bin/fnm', chemins: ['/usr/bin'] };

describe('plist de la veille', () => {
  it('étiquette, deux heures (8 h et 19 h), lanceur par /bin/sh, journal dans le dossier de données, pas de lancement au chargement', () => {
    const x = plist(P);
    assert.match(x, new RegExp(`<key>Label</key><string>${LABEL.replace(/\./g, '\\.')}</string>`));
    assert.deepEqual([...HEURES], [8, 19]);
    for (const h of HEURES) assert.match(x, new RegExp(`<key>Hour</key><integer>${h}</integer><key>Minute</key><integer>0</integer>`));
    assert.match(x, /<string>\/bin\/sh<\/string>\s*<string>\/Users\/essai\/\.cache\/rtp\/veille d'essai\/lancer\.sh<\/string>/);
    assert.match(x, /<key>RunAtLoad<\/key><false\/>/);
    assert.match(x, /journal\.log/);
  });

  it('caractères XML échappés ; plutil accepte le fichier (macOS)', () => {
    const x = plist({ ...P, dossier: '/tmp/a&b<c>' });
    assert.match(x, /\/tmp\/a&amp;b&lt;c&gt;\/lancer\.sh/);
    if (existsSync('/usr/bin/plutil')) {
      const f = path.join(tmp(), 'x.plist');
      writeFileSync(f, plist(P));
      const r = spawnSync('/usr/bin/plutil', ['-lint', f], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
  });

  it('chemins relatifs, retours à la ligne ou référence douteuse : refus', () => {
    assert.throws(() => plist({ ...P, dossier: 'relatif' }), /absolu/);
    assert.throws(() => lanceur({ ...P, depot: '/a\nb' }), /interdit/);
    assert.throws(() => lanceur({ ...P, reference: 'main; rm -rf /' }), /référence/);
  });
});

describe('lanceur de la veille', () => {
  it('set -eu, worktree de la veille aligné sur la référence, exécution depuis ce worktree, Node 24 par fnm, aucun secret', () => {
    const t = lanceur(P);
    assert.match(t, /^#!\/bin\/sh\n/);
    assert.match(t, /^set -eu$/m);
    assert.match(t, /^export RTP_VEILLE_DIR='\/Users\/essai\/\.cache\/rtp\/veille d'\\''essai'$/m);
    assert.match(t, /git -C "\$DEPOT" worktree add --detach --quiet "\$ARBRE" "\$REFERENCE"/);
    assert.match(t, /git -C "\$ARBRE" checkout --quiet --detach "\$REFERENCE" \|\| true/);
    assert.match(t, /^cd "\$ARBRE"$/m);
    assert.match(t, /^exec "\$FNM" exec --using=24 node scripts\/veille\.ts lancer --reference "\$REFERENCE"$/m);
    assert.doesNotMatch(t, /push|telegram|hc-ping|security /i);
    assert.equal(cheminLanceur(P.dossier), `${P.dossier}/lancer.sh`);
  });

  it('syntaxe shell valide (sh -n)', () => {
    const f = path.join(tmp(), 'lancer.sh');
    writeFileSync(f, lanceur(P));
    const r = spawnSync('/bin/sh', ['-n', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});
