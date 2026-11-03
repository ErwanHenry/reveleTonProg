import { lireArchive } from '../../src/lib/content-core/rules/archives.ts';
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadAll, parseYaml } from '../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../src/lib/content-core/diagnostics.ts';
import { ARCHIVE_TAILLE_MAX } from '../../src/lib/content-core/rules/config.ts';
import type { Corpus, LoadedEntry, Mode, RuleContext } from '../../src/lib/content-core/rules/types.ts';
import { comparer, construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { ElementAttendu, PiegeSpec, Remplacement } from '../helpers/overlay.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const SOURCE = 'src/content/sources/marie-fictive-programme.yaml';
const THEME = 'src/content/themes/logement.yaml';
const ARCHIVE = 'archives/marie-fictive/23c5f1cc8eff.txt';
const WAYBACK = '  wayback_url: https://web.archive.org/web/20261020100000/https://marie-fictive.exemple.invalid/programme\n';

const spec = (remplacer: Remplacement[], mode: Mode = 'production'): PiegeSpec => ({ piege: 'test', regle: 'REGLE-01', mode, remplacer, attendu: [] });
const err = (code: string, fichier: string, pointer: string): ElementAttendu => ({ code, severite: 'error', fichier, pointer });

/** Racine temporaire + chargement complet, pour les cas qui touchent au système de fichiers. */
function chargerRacine(racine: string): { code: string; fichier: string; pointer: string; message: string }[] {
  const res = loadAll(racine, { schemasDir: SCHEMAS_DIR });
  return res.diagnostics.map((d: Diagnostic) => ({ code: d.code, fichier: path.relative(racine, d.file).split(path.sep).join('/'), pointer: d.pointer, message: d.message }));
}

describe('REGLE-01 : source et archive (pièges en mémoire)', () => {
  it('le corpus de référence ne produit aucun diagnostic', () => {
    comparer(executerPiege(spec([])), []);
  });

  it('SOURCE_INCONNUE : la mesure cite une source sans fichier', () => {
    const r = executerPiege(spec([{ fichier: MESURE, de: 'source: marie-fictive-programme\n', par: 'source: inconnue-xyz\n' }]));
    comparer(r, [err('SOURCE_INCONNUE', MESURE, '/source')]);
  });

  it('pas de SOURCE_INCONNUE quand le fichier de source existe mais échoue son schéma', () => {
    const racine = construireRacine(spec([{ fichier: MESURE, de: 'source: marie-fictive-programme\n', par: 'source: marie-fictive-autre\n' }]));
    writeFileSync(path.join(racine, 'src/content/sources/marie-fictive-autre.yaml'), 'version_schema: 1\nid: marie-fictive-autre\n');
    const codes = chargerRacine(racine).filter((d) => d.fichier === MESURE);
    assert.deepEqual(codes, []);
    assert.ok(chargerRacine(racine).some((d) => d.fichier === 'src/content/sources/marie-fictive-autre.yaml'));
  });

  it('SOURCE_AUTRE_CANDIDAT : la source ne liste pas le candidat de la mesure', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: 'candidats:\n  - marie-fictive\n', par: 'candidats:\n  - jean-imaginaire\n' }]));
    comparer(r, [err('SOURCE_AUTRE_CANDIDAT', MESURE, '/source')]);
  });

  it('ARCHIVE_ABSENTE : extrait supprimé', () => {
    const racine = construireRacine(spec([]));
    rmSync(path.join(racine, ARCHIVE));
    const r = chargerRacine(racine);
    assert.deepEqual(r.map((d) => [d.code, d.fichier, d.pointer]), [['ARCHIVE_ABSENTE', SOURCE, '/archive/extrait']]);
  });

  it('ARCHIVE_ABSENTE : extrait remplacé par un lien symbolique (« lien symbolique refusé »)', () => {
    const racine = construireRacine(spec([]));
    const cible = path.join(racine, 'cible.txt');
    writeFileSync(cible, readFileSync(path.join(racine, ARCHIVE)));
    rmSync(path.join(racine, ARCHIVE));
    symlinkSync(cible, path.join(racine, ARCHIVE));
    const r = chargerRacine(racine);
    assert.deepEqual(r.map((d) => [d.code, d.fichier, d.pointer]), [['ARCHIVE_ABSENTE', SOURCE, '/archive/extrait']]);
    assert.match(r[0]?.message ?? '', /lien symbolique refusé/);
  });

  it('ARCHIVE_SHA256_DIVERGENT : un octet modifié', () => {
    const racine = construireRacine(spec([]));
    const fichier = path.join(racine, ARCHIVE);
    const octets = readFileSync(fichier);
    octets[0] = (octets[0] ?? 0) ^ 0x01;
    writeFileSync(fichier, octets);
    const r = chargerRacine(racine);
    assert.deepEqual(r.map((d) => [d.code, d.fichier, d.pointer]), [['ARCHIVE_SHA256_DIVERGENT', SOURCE, '/archive/sha256']]);
  });

  it('ARCHIVE_TROP_VOLUMINEUX : 5 Mo + 1 octet, refusé avant le calcul de l’empreinte', () => {
    const racine = construireRacine(spec([]));
    truncateSync(path.join(racine, ARCHIVE), ARCHIVE_TAILLE_MAX + 1);
    const r = chargerRacine(racine);
    assert.deepEqual(r.map((d) => [d.code, d.fichier, d.pointer]), [['ARCHIVE_TROP_VOLUMINEUX', SOURCE, '/archive/extrait']]);
  });

  it('ARCHIVE_WAYBACK_ABSENTE : mesure publiée et source sans wayback_url', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: '' }]));
    comparer(r, [err('ARCHIVE_WAYBACK_ABSENTE', SOURCE, '/archive')]);
  });

  it('pas d’ARCHIVE_WAYBACK_ABSENTE quand la mesure et le thème sont en brouillon', () => {
    const r = executerPiege(
      spec([
        { fichier: SOURCE, de: WAYBACK, par: '' },
        { fichier: MESURE, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' },
        { fichier: THEME, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' },
      ]),
    );
    assert.deepEqual(r.filter((d) => d.code === 'ARCHIVE_WAYBACK_ABSENTE'), []);
  });
});

describe('lireArchive', () => {
  /** Contexte minimal : un corpus qui ne connaît que la source de la fixture. */
  function contexte(racine: string): RuleContext {
    const fichier = path.join(racine, SOURCE);
    const { doc, lc, data } = parseYaml(readFileSync(fichier, 'utf8'), fichier);
    const source: LoadedEntry = { collection: 'sources', id: 'marie-fictive-programme', file: fichier, data: data as Record<string, unknown>, doc, lc };
    const corpus = {
      entries: [source],
      de: (c: string) => (c === 'sources' ? [source] : []),
      entree: (c: string, id: string) => (c === 'sources' && id === source.id ? source : undefined),
      listes: new Map(),
      aDesInvalides: () => false,
    } as unknown as Corpus;
    return { mode: 'production', contentRoot: racine, corpus, cache: new Map() };
  }

  it('renvoie le texte de l’extrait pour la source de la fixture', () => {
    const racine = construireRacine(spec([]));
    const etat = lireArchive(contexte(racine), 'marie-fictive-programme');
    assert.equal(etat.etat, 'ok');
    if (etat.etat === 'ok') assert.ok(etat.texte.includes('encadrerons les loyers'));
  });

  it('est mémoïsée : une seule lecture par chargement', () => {
    const racine = construireRacine(spec([]));
    const ctx = contexte(racine);
    assert.equal(lireArchive(ctx, 'marie-fictive-programme').etat, 'ok');
    assert.ok(ctx.cache.has('archive:marie-fictive-programme'));
    rmSync(path.join(racine, ARCHIVE));
    assert.equal(lireArchive(ctx, 'marie-fictive-programme').etat, 'ok');
  });

  it('inutilisable après suppression, après divergence d’empreinte, ou pour une source inconnue', () => {
    const racine = construireRacine(spec([]));
    rmSync(path.join(racine, ARCHIVE));
    assert.deepEqual(lireArchive(contexte(racine), 'marie-fictive-programme'), { etat: 'inutilisable' });

    const autre = construireRacine(spec([]));
    writeFileSync(path.join(autre, ARCHIVE), 'texte modifié');
    assert.deepEqual(lireArchive(contexte(autre), 'marie-fictive-programme'), { etat: 'inutilisable' });

    assert.deepEqual(lireArchive(contexte(autre), 'source-inconnue'), { etat: 'inutilisable' });
  });
});
