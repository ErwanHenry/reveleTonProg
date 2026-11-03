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
    // page candidat : nom, parti revendiqué, date du statut, mesure sourcée fictive (titre et résumé)
    const candidat = ctx.lire(outDir, 'candidats/marie-fictive/index.html');
    assert.match(candidat, /Marie Fictive/);
    assert.match(candidat, /Parti Imaginaire/);
    assert.match(candidat, /lang="fr"/);
    assert.ok(candidat.includes('datetime="2026-10-15"'), 'la date 2026-10-15 doit apparaître dans un <time datetime>');
    assert.ok(candidat.includes('Encadrement des loyers dans les villes moyennes (fictif)'), 'titre de la mesure absent');
    assert.ok(candidat.includes('Marie Fictive propose de plafonner les loyers'), 'résumé de la mesure absent');
    // page thème : source de la mesure et date de consultation telle qu'écrite dans le YAML
    const theme = ctx.lire(outDir, 'themes/logement/index.html');
    assert.ok(theme.includes('Programme fictif de Marie Fictive'), 'titre de la source absent');
    assert.ok(theme.includes('datetime="2026-10-20"'), 'date de consultation de la source absente');
    // le hall remplace la page du squelette
    assert.match(ctx.lire(outDir, 'index.html'), /<h1[^>]*>Les programmes de la présidentielle 2027, à votre niveau<\/h1>/);
    // compressHTML: true conserve l'espace entre un élément inline et le texte suivant
    assert.match(candidat, /<\/span>\s+n'utilise aucun cookie/);

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
    const hall = ctx.lire(outDir, 'index.html');
    assert.match(hall, /Aucun thème publié pour le moment\./);
    assert.match(hall, /<a[^>]*href="\/candidats\/"[^>]*>Consulter la liste des candidats<\/a>/);
    const liste = ctx.lire(outDir, 'candidats/index.html');
    assert.match(liste, /Aucun candidat à afficher pour le moment\./);
    assert.match(liste, /<a[^>]*href="\/"[^>]*>Revenir à l'accueil<\/a>/);
    const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(root, ctx.repoRoot, 'production') });
    const erreurs = constats.filter((c) => c.severite === 'erreur');
    assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
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
