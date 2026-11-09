// Constantes publiques partagées : dates des tours, profil 4G, clés du stockage local.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS } from '../../src/lib/dates-tours.ts';
import { MESURE_SERVEUR_4G, PROFILS_4G } from '../../src/lib/profil-4g.ts';
import { CLES_STOCKAGE } from '../../src/lib/stockage-local.ts';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'scripts');

describe('constantes publiques', () => {
  it('TOURS : deux dimanches', () => {
    assert.deepEqual(TOURS.map((t) => [t.numero, t.date]), [[1, '2027-04-18'], [2, '2027-05-02']]);
    for (const t of TOURS) {
      const [a, m, j] = t.date.split('-').map(Number) as [number, number, number];
      assert.equal(new Date(Date.UTC(a, m - 1, j)).getUTCDay(), 0, t.date);
    }
  });

  it('PROFILS_4G (WR-04, D-13) : profil historique nommé pour ce qu\'il simule, et « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse), 1 s pour les deux', () => {
    assert.deepEqual(PROFILS_4G, [
      {
        id: 'latence-150',
        nom: 'une latence de 150 ms par requête',
        libelle: 'une latence de 150 ms par requête et un débit de 1,6 Mbit/s',
        latenceRequeteMs: 150,
        debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024) / 8,
        debitMontantOctetsParSeconde: (750 * 1024) / 8,
        budgetMs: 1000,
      },
      {
        id: 'slow-4g-lighthouse',
        nom: 'le profil « Slow 4G simulé »',
        libelle: 'le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse : 562,5 ms de latence par requête, 1,44 Mbit/s)',
        latenceRequeteMs: 562.5,
        debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024 * 0.9) / 8,
        debitMontantOctetsParSeconde: (750 * 1024 * 0.9) / 8,
        // D-13 (08-05, choix d'Erwan du 2026-11-08) : 1 s pour les deux profils. Ne pas relever pour faire passer la CI.
        budgetMs: 1000,
      },
    ]);
    // Les libellés publiés disent les valeurs réellement appliquées ; le nom court est le début du libellé.
    const [a, b] = PROFILS_4G;
    for (const p of PROFILS_4G) assert.ok(p.libelle.startsWith(p.nom), `${p.id} : « ${p.nom} » n'ouvre pas le libellé`);
    assert.ok(a!.libelle.includes(`${a!.latenceRequeteMs} ms`));
    assert.ok(b!.libelle.includes(`${b!.latenceRequeteMs.toLocaleString('fr-FR')} ms`));
    assert.ok(b!.libelle.includes(`${((b!.debitDescendantOctetsParSeconde * 8) / (1024 * 1024)).toLocaleString('fr-FR')} Mbit/s`));
  });

  it('MESURE_SERVEUR_4G (PERF-02, D-13, 08-14) : mesure derrière le serveur réel, chaque mesure sous le budget de son profil', () => {
    // Valeurs relevées le 2026-11-09 sur https://essai.reveletonprog.fr (commit servi 0949633), voir 08-14-SUMMARY.md.
    // Ne pas relever un budget pour faire passer ce test : une nouvelle mesure au-dessus de 1 s se signale.
    assert.equal(MESURE_SERVEUR_4G.date, '2026-11-09');
    assert.equal(MESURE_SERVEUR_4G.page, '/methode/');
    assert.equal(MESURE_SERVEUR_4G.octetsGzip, 11917);
    assert.equal(MESURE_SERVEUR_4G.encodage, 'zstd');
    assert.deepEqual(MESURE_SERVEUR_4G.profils, [
      { id: 'latence-150', mesuresMs: [345, 300, 304] },
      { id: 'slow-4g-lighthouse', mesuresMs: [716, 722, 723] },
    ]);
    assert.deepEqual(MESURE_SERVEUR_4G.lighthouse, { version: '13.0.3', fcpMs: 791, lcpMs: 791, speedIndexMs: 812 });
    // Date réelle du calendrier.
    const [an, mois, jour] = MESURE_SERVEUR_4G.date.split('-').map(Number) as [number, number, number];
    assert.equal(new Date(Date.UTC(an, mois - 1, jour)).toISOString().slice(0, 10), MESURE_SERVEUR_4G.date);
    // Mêmes profils, dans le même ordre, trois mesures chacun, toutes sous le budget publié.
    assert.deepEqual(MESURE_SERVEUR_4G.profils.map((p) => p.id), PROFILS_4G.map((p) => p.id));
    for (const m of MESURE_SERVEUR_4G.profils) {
      const profil = PROFILS_4G.find((p) => p.id === m.id)!;
      assert.equal(m.mesuresMs.length, 3, m.id);
      for (const ms of m.mesuresMs) {
        assert.ok(Number.isInteger(ms) && ms > 0, `${m.id} : ${ms}`);
        assert.ok(ms < profil.budgetMs, `${m.id} : ${ms} ms, budget ${profil.budgetMs} ms`);
      }
    }
    // Phrases publiées : neutres, sans tiret long ni demi-cadratin, sans mot interdit.
    for (const phrase of [MESURE_SERVEUR_4G.perimetre, MESURE_SERVEUR_4G.ecart]) {
      assert.ok(phrase.length > 40 && phrase.endsWith('.'), phrase);
      assert.doesNotMatch(phrase, /[\u2013\u2014]/);
      assert.doesNotMatch(phrase.toLocaleLowerCase('fr'), /extrêm|extrém|populis|irresponsab|courage|\benfin\b/);
    }
    assert.ok(MESURE_SERVEUR_4G.ecart.includes('Lighthouse'), MESURE_SERVEUR_4G.ecart);
  });

  it('CLES_STOCKAGE : cohérent avec src/scripts/*.js', () => {
    assert.deepEqual(CLES_STOCKAGE, {
      niveau: { cle: 'rtp:niveau', valeurs: ['resume', 'detaille', 'enfant', 'aine'] },
      ordre: { cle: 'rtp:ordre', valeurs: ['alphabetique', 'aleatoire'] },
    });
    assert.match(readFileSync(path.join(SCRIPTS, 'niveau.js'), 'utf8'), /'rtp:niveau'/);
    assert.match(readFileSync(path.join(SCRIPTS, 'ordre.js'), 'utf8'), /'rtp:ordre'/);
    const trouvees = new Set<string>();
    for (const f of readdirSync(SCRIPTS).filter((n) => n.endsWith('.js'))) {
      for (const m of readFileSync(path.join(SCRIPTS, f), 'utf8').matchAll(/['"](rtp:[a-z]+)['"]/g)) trouvees.add(m[1] as string);
    }
    assert.deepEqual([...trouvees].sort(), Object.values(CLES_STOCKAGE).map((c) => c.cle).sort());
  });
});
