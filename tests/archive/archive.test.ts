import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import {
  TAILLE_MAX_BINAIRE,
  TAILLE_MAX_EXTRAIT,
  buildSourceYaml,
  checkExtract,
  extractName,
  normalizeExtract,
  refreshDecision,
  sha256Hex,
  type ParamsSource,
} from '../../scripts/lib/archive.ts';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import path from 'node:path';

const LONG = `${'Une phrase fictive assez longue pour passer le minimum de caractères exigé. '.repeat(10)}\n`;

describe('normalizeExtract', () => {
  it('NFC, LF, espaces de fin retirés, un seul \\n final, pas de BOM', () => {
    const brut = '\ufeffe\u0301te\r\nligne  \r\n\r\nfin\t \r\r\n\n\n';
    assert.equal(normalizeExtract(brut), '\u00e9te\nligne\n\nfin\n');
  });

  it('conserve les sauts de page (U+000C) des PDF', () => {
    const brut = 'page un\n\f\npage deux\n';
    assert.equal(normalizeExtract(brut), 'page un\n\f\npage deux\n');
  });

  it('est idempotent', () => {
    const une = normalizeExtract('a  \r\nb\r\n\r\n\r\n');
    assert.equal(normalizeExtract(une), une);
  });
});

describe('extractName', () => {
  it('12 premiers hex du sha256 des octets UTF-8', () => {
    const t = 'été\n';
    assert.equal(extractName(t), sha256Hex(Buffer.from(t, 'utf8')).slice(0, 12));
    assert.match(extractName(t), /^[0-9a-f]{12}$/);
  });
});

describe('checkExtract', () => {
  it('accepte un texte suffisant', () => {
    const v = checkExtract(LONG);
    assert.deepEqual(v.erreurs, []);
  });

  it('refuse sous 500 caractères', () => {
    const v = checkExtract('trop court\n');
    assert.equal(v.erreurs.length, 1);
    assert.match(v.erreurs[0] ?? '', /trop court/);
  });

  it('refuse au-delà de 5 Mio', () => {
    assert.equal(TAILLE_MAX_EXTRAIT, 5 * 1024 * 1024);
    assert.equal(TAILLE_MAX_BINAIRE, 50 * 1024 * 1024);
    const v = checkExtract('a'.repeat(TAILLE_MAX_EXTRAIT + 1));
    assert.ok(v.erreurs.some((e) => /volumineux/.test(e)));
  });

  it('refuse U+FFFD sauf si autorisé', () => {
    const t = `${LONG}a\ufffdendu\n`;
    assert.ok(checkExtract(t).erreurs.some((e) => /U\+FFFD/.test(e)));
    const ok = checkExtract(t, { allowReplacement: true });
    assert.deepEqual(ok.erreurs, []);
    assert.ok(ok.avertissements.some((e) => /U\+FFFD/.test(e)));
  });

  it("signale trait d'union conditionnel, largeur nulle et lignes finissant par un tiret (sans rien corriger)", () => {
    const t = `${LONG}in\u00adsécable\nzéro\u200blargeur\nmot coupé-\nsuite\n`;
    const v = checkExtract(t);
    assert.deepEqual(v.erreurs, []);
    assert.equal(v.avertissements.length, 3);
  });
});

const PARAMS: ParamsSource = {
  id: 'marie-fictive-page',
  type: 'site_candidat',
  auteur: 'candidat',
  candidats: ['marie-fictive'],
  titre: 'Page : fictive "test"',
  url: 'https://marie-fictive.exemple.invalid/page',
  datePublication: '2026-10',
  dateConsultation: '2026-11-03',
  archive: {
    extrait: 'archives/marie-fictive/0123456789ab.txt',
    sha256: 'a'.repeat(64),
    captureLe: '2026-11-03T10:00:00+01:00',
    binaireSha256: 'b'.repeat(64),
  },
};

describe('buildSourceYaml', () => {
  it("émet les clés dans l'ordre du contrat et valide contre le schéma source", () => {
    const yaml = buildSourceYaml(PARAMS);
    const cles = Object.keys(parse(yaml, { schema: 'core' }) as object);
    assert.deepEqual(cles, [
      'version_schema', 'id', 'type', 'auteur', 'candidats', 'titre', 'url', 'date_publication', 'date_consultation', 'archive',
    ]);
    assert.deepEqual(Object.keys((parse(yaml, { schema: 'core' }) as { archive: object }).archive), ['extrait', 'sha256', 'capture_le', 'binaire_sha256']);
    const res = validateYamlText('source', yaml, path.join(REPO_ROOT, 'src', 'content', 'sources', 'marie-fictive-page.yaml'), { schemasDir: SCHEMAS_DIR });
    assert.deepEqual(res.diagnostics, []);
    assert.equal((res.data as { titre: string }).titre, 'Page : fictive "test"');
  });

  it('place wayback_url entre capture_le et binaire_sha256, seulement quand il existe', () => {
    assert.ok(!buildSourceYaml(PARAMS).includes('wayback_url'));
    const avec = buildSourceYaml({
      ...PARAMS,
      archive: { ...PARAMS.archive, waybackUrl: 'https://web.archive.org/web/20261103014534/https://marie-fictive.exemple.invalid/page' },
    });
    const archive = (parse(avec, { schema: 'core' }) as { archive: object }).archive;
    assert.deepEqual(Object.keys(archive), ['extrait', 'sha256', 'capture_le', 'wayback_url', 'binaire_sha256']);
    assert.deepEqual(validateYamlText('source', avec, path.join(REPO_ROOT, 'x.yaml'), { schemasDir: SCHEMAS_DIR }).diagnostics, []);
  });

  it('les dates partielles et complètes restent des chaînes (pas de coercition YAML)', () => {
    const d = parse(buildSourceYaml({ ...PARAMS, datePublication: '2026-10-05' }), { schema: 'core' }) as { date_publication: unknown; date_consultation: unknown };
    assert.equal(d.date_publication, '2026-10-05');
    assert.equal(d.date_consultation, '2026-11-03');
  });
});

describe('refreshDecision', () => {
  const ex = { sha256: 'a'.repeat(64), binaire_sha256: 'b'.repeat(64) };
  it('texte et binaire identiques : inchange, Wayback conservé', () => {
    const d = refreshDecision(ex, 'a'.repeat(64), 'b'.repeat(64));
    assert.equal(d.decision, 'inchange');
    assert.equal(d.waybackConserve, true);
    assert.deepEqual(d.avertissements, []);
  });
  it('texte identique, binaire différent : binaire_modifie', () => {
    const d = refreshDecision(ex, 'a'.repeat(64), 'c'.repeat(64));
    assert.equal(d.decision, 'binaire_modifie');
    assert.equal(d.waybackConserve, true);
  });
  it('texte différent : texte_modifie, Wayback retiré, avertissement de revérification', () => {
    const d = refreshDecision(ex, 'd'.repeat(64), 'b'.repeat(64));
    assert.equal(d.decision, 'texte_modifie');
    assert.equal(d.waybackConserve, false);
    assert.match(d.avertissements.join(' '), /contenu modifié : relancer validate, les mesures citant cette source doivent être revérifiées/);
  });
  it("sans binaire enregistré auparavant : le texte seul décide", () => {
    assert.equal(refreshDecision({ sha256: 'a'.repeat(64) }, 'a'.repeat(64), 'c'.repeat(64)).decision, 'inchange');
  });
});
