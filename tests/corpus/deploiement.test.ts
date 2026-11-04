// IN-06 : RTP_DEPLOIEMENT n'accepte que 1, 0 ou vide ; une autre valeur est refusée (pas d'échec ouvert).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeploiementInvalideError, estDeploiement } from '../../src/lib/deploiement.ts';

describe('estDeploiement', () => {
  it('1 : déploiement ; absente, vide ou 0 : hors déploiement', () => {
    assert.equal(estDeploiement({ RTP_DEPLOIEMENT: '1' }), true);
    assert.equal(estDeploiement({}), false);
    assert.equal(estDeploiement({ RTP_DEPLOIEMENT: '' }), false);
    assert.equal(estDeploiement({ RTP_DEPLOIEMENT: '0' }), false);
  });

  it('toute autre valeur est refusée', () => {
    for (const v of ['true', 'yes', 'oui', 'TRUE', ' 1', '1 ', '2', 'false', 'no']) {
      assert.throws(() => estDeploiement({ RTP_DEPLOIEMENT: v }), (e: Error) => e instanceof DeploiementInvalideError && /RTP_DEPLOIEMENT doit valoir 1/.test(e.message), v);
    }
  });
});
