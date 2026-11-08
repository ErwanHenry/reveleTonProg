// Version servie (HEB-07, D-12) et types de fichiers du dist (HEB-08) sur de vraies builds du corpus-m1 :
// /version.json porte exactement le commit (GITHUB_SHA s'il compte 40 hexadécimaux, sinon dev) et la date de
// build, et le dist ne contient que html, txt, xml et json (aucun fichier haché qui demanderait une règle de
// cache long dans le bloc Caddy, que le bloc n'a plus depuis l'intégration de la Phase 7).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const TYPES_AUTORISES = ['.html', '.txt', '.xml', '.json'] as const;
const SHA_FACTICE = 'a'.repeat(40);

/** Commit attendu d'une build qui hérite de l'environnement du test (en CI, GITHUB_SHA est défini). */
const commitHerite = (): string => {
  const sha = process.env.GITHUB_SHA ?? '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : 'dev';
};

export default function version(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-version'));
  const build = (cle: string, mode: 'production' | 'preview', env?: Record<string, string>) => {
    const b = ctx.construire(cle, { racine, mode, ...(env === undefined ? {} : { env }) });
    assert.equal(b.status, 0, `astro build (${cle}) a échoué :\n${b.output}`);
    return b;
  };
  const lireVersion = (outDir: string): Record<string, unknown> => {
    const brut = ctx.lire(outDir, 'version.json');
    assert.ok(brut.endsWith('}\n'), `version.json doit finir par un saut de ligne : ${JSON.stringify(brut.slice(-5))}`);
    return JSON.parse(brut) as Record<string, unknown>;
  };

  for (const [cle, mode] of [['m1-production', 'production'], ['m1-preview', 'preview']] as const) {
    describe(mode, () => {
      it(`HEB-07 : ${mode}, version.json a exactement commit et date ; commit = GITHUB_SHA hérité (40 hex) ou dev`, () => {
        const { outDir } = build(cle, mode);
        const v = lireVersion(outDir);
        assert.deepEqual(Object.keys(v).sort(), ['commit', 'date']);
        assert.equal(v.commit, commitHerite());
        assert.equal(typeof v.date, 'string');
        const date = new Date(v.date as string);
        assert.equal(date.toISOString(), v.date, 'date au format toISOString (UTC)');
        assert.ok(date.getTime() <= Date.now() + 60_000, `date dans le futur : ${String(v.date)}`);
        assert.ok(date.getTime() >= Date.now() - 24 * 3600_000, `date trop ancienne pour la build de ce test : ${String(v.date)}`);
      });

      it(`HEB-07, HEB-08 : ${mode}, checkDist avec version et typesAutorises ne signale rien`, () => {
        const { outDir } = build(cle, mode);
        const sha = commitHerite();
        const constats = checkDist(outDir, {
          mode,
          version: sha === 'dev' ? {} : { commitAttendu: sha },
          typesAutorises: TYPES_AUTORISES,
        }).filter((c) => c.code.startsWith('VERSION_') || c.code === 'TYPE_FICHIER_INATTENDU');
        assert.deepEqual(constats, []);
      });

      it(`HEB-08 : ${mode}, chaque fichier du dist est en html, txt, xml ou json`, () => {
        const { outDir } = build(cle, mode);
        const autres = ctx
          .fichiers(outDir)
          .map((f) => path.relative(outDir, f).split(path.sep).join('/'))
          .filter((rel) => !(TYPES_AUTORISES as readonly string[]).includes(path.posix.extname(rel)));
        assert.deepEqual(autres, []);
      });
    });
  }

  describe('GITHUB_SHA explicite', () => {
    it('HEB-07 : une build avec GITHUB_SHA = 40 fois « a » écrit ce commit, que check-dist accepte et compare', () => {
      const { outDir } = build('m1-version-sha', 'production', { GITHUB_SHA: SHA_FACTICE });
      assert.equal(lireVersion(outDir).commit, SHA_FACTICE);
      const filtre = (c: { code: string }) => c.code.startsWith('VERSION_');
      assert.deepEqual(checkDist(outDir, { mode: 'production', version: { commitAttendu: SHA_FACTICE }, deploiement: true }).filter(filtre), []);
      const autre = checkDist(outDir, { mode: 'production', version: { commitAttendu: 'b'.repeat(40) } }).filter(filtre);
      assert.deepEqual(autre.map((c) => c.code), ['VERSION_INVALIDE']);
    });

    it('HEB-07 : une valeur de GITHUB_SHA qui n’est pas un commit complet donne dev', () => {
      const { outDir } = build('m1-version-court', 'production', { GITHUB_SHA: 'abc1234' });
      assert.equal(lireVersion(outDir).commit, 'dev');
    });
  });
}
