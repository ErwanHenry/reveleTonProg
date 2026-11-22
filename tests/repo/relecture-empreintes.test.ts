// Revue de la phase 9, CR-01 : sur le vrai corpus, chaque mesure relue ou publiée, chaque statut retenu par la
// production et chaque case d'un thème publié a encore le texte relu (empreinte de la dernière ligne de
// relecture/journal.jsonl). Même calcul que check-dist (RELECTURE_PERIMEE), lancé ici pour qu'une correction faite à
// la main sans nouvelle relecture se voie dès `npm test`, avant la build. Lecture seule : rien n'est écrit.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { relecturesPerimees } from '../../scripts/lib/check-dist.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

describe('vrai corpus : textes relus inchangés depuis leur relecture', () => {
  it('le registre de relecture existe', () => {
    assert.ok(existsSync(path.join(REPO_ROOT, 'relecture', 'journal.jsonl')));
  });

  it('aucune cible relue ou publiée dont le texte a changé depuis sa relecture', () => {
    const perimees = relecturesPerimees(REPO_ROOT, REPO_ROOT);
    assert.deepEqual(
      perimees.map((r) => r.message),
      [],
      'relire chaque cible nommée (npm run relecture -- marquer …), voir docs/RUNBOOK.md, « Corriger une mesure publiée »',
    );
  });
});
