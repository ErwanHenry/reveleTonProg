// Walking skeleton (Phase 1), migré depuis tests/dist/skeleton.test.ts : mêmes quatre cas.
// Le cas (a) remplace la boucle « aucun .js, aucun <script, aucun href externe » par checkDist, qui
// est plus strict (ressources tierces, scripts en ligne, poids, mots collés, sources datées…).
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import type { ContexteSite } from '../contexte.ts';

export default function squelette(ctx: ContexteSite): void {
  const FIXTURE_ROOT = path.join(ctx.repoRoot, 'tests', 'fixtures', 'corpus-valide');

  it('(a) construit le corpus fictif en HTML statique, et checkDist ne signale aucune erreur', () => {
    const { status, output, outDir } = ctx.construire('corpus-valide', { racine: FIXTURE_ROOT });
    assert.equal(status, 0, `astro build a échoué :\n${output}`);
    const html = ctx.lire(outDir, 'index.html');
    assert.match(html, /Marie Fictive/);
    assert.match(html, /Parti Imaginaire/);
    assert.ok(html.includes('2026-10-15'), 'la date 2026-10-15 doit apparaître telle quelle');
    assert.match(html, /lang="fr"/);
    // mesure sourcée fictive : titre, résumé, source et date de consultation telle qu'écrite dans le YAML
    assert.ok(html.includes('Encadrement des loyers dans les villes moyennes (fictif)'), 'titre de la mesure absent');
    assert.ok(html.includes('Marie Fictive propose de plafonner les loyers'), 'résumé de la mesure absent');
    assert.ok(html.includes('Programme fictif de Marie Fictive'), 'titre de la source absent');
    assert.ok(html.includes('2026-10-20'), 'date de consultation de la source absente');
    // compressHTML: true conserve l'espace entre un élément inline et le texte suivant
    assert.match(html, /<\/span>\s+à des fins de test/);

    const constats = checkDist(outDir, {
      mode: 'production',
      cellulesParTheme: cellulesAttendues(FIXTURE_ROOT, ctx.repoRoot, 'production'),
    });
    const erreurs = constats.filter((c) => c.severite === 'erreur');
    assert.deepEqual(
      erreurs,
      [],
      `checkDist signale ${erreurs.length} erreur(s) :\n${erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n')}`,
    );
  });

  it('(b) construit une racine de contenu vide', () => {
    const root = ctx.tmp();
    fs.mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
    const { status, output, outDir } = ctx.construire('racine-vide', { racine: root });
    assert.equal(status, 0, `astro build a échoué :\n${output}`);
    assert.match(ctx.lire(outDir, 'index.html'), /Aucun candidat dans ce corpus/);
  });

  it('(c) échoue avec fichier:ligne:col SCHEMA_REQUIRED sur une fixture cassée', () => {
    const root = ctx.tmp();
    fs.cpSync(FIXTURE_ROOT, root, { recursive: true });
    const file = path.join(root, 'src', 'content', 'candidats', 'marie-fictive.yaml');
    const source = fs.readFileSync(file, 'utf8');
    const idx = source.indexOf('statuts:');
    assert.ok(idx > 0, 'la fixture doit contenir « statuts: »');
    fs.writeFileSync(file, source.slice(0, idx));

    const { status, output, outDir } = ctx.construire('fixture-cassee', { racine: root });
    assert.notEqual(status, 0, 'le build aurait dû échouer');
    assert.match(output, /marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/);
    const occurrences = output.match(/marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/g) ?? [];
    assert.equal(occurrences.length, 1, `diagnostic attendu une seule fois, vu ${occurrences.length} fois`);
    assert.ok(!fs.existsSync(path.join(outDir, 'index.html')), 'index.html ne doit pas exister');
  });

  it("(d) l'extrait d'archive de la fixture est cohérent : sha256, nom de fichier, citation verbatim", () => {
    const sourceYaml = fs.readFileSync(path.join(FIXTURE_ROOT, 'src', 'content', 'sources', 'marie-fictive-programme.yaml'), 'utf8');
    const mesureYaml = fs.readFileSync(path.join(FIXTURE_ROOT, 'src', 'content', 'mesures', 'marie-fictive', 'encadrement-loyers.yaml'), 'utf8');
    const source = parseYaml(sourceYaml, { schema: 'core' }) as { archive: { extrait: string; sha256: string } };
    const mesure = parseYaml(mesureYaml, { schema: 'core' }) as { texte_source: string };

    const archivePath = path.join(FIXTURE_ROOT, source.archive.extrait);
    assert.ok(fs.existsSync(archivePath), `extrait d'archive introuvable : ${source.archive.extrait}`);
    const bytes = fs.readFileSync(archivePath);
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, source.archive.sha256, "le sha256 réel de l'extrait doit égaler archive.sha256");
    assert.equal(path.basename(archivePath), `${sha.slice(0, 12)}.txt`, "le fichier doit s'appeler <12 premiers hex du sha256>.txt");
    assert.ok(bytes.toString('utf8').includes(mesure.texte_source), "texte_source doit apparaître tel quel dans l'extrait");
  });
}
