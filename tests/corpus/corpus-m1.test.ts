import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { MARQUEUR_GLOSSAIRE, PERIMETRE_EQUITE } from '../../src/lib/content-core/rules/config.ts';
import { statutRetenu } from '../../src/lib/content-core/rules/equite.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';
import { CORPUS_M1, SURCHARGES_AUTORISEES, TRAPPE_BROUILLON, materialiserCorpusM1, nettoyerCorpusM1 } from '../helpers/corpus-m1.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

type Donnees = Record<string, unknown>;

/** Fichiers d'un dossier, chemins POSIX relatifs. */
function fichiers(dossier: string, courant = dossier): string[] {
  const out: string[] = [];
  for (const e of readdirSync(courant, { withFileTypes: true })) {
    const p = path.join(courant, e.name);
    if (e.isDirectory()) out.push(...fichiers(dossier, p));
    else if (e.isFile()) out.push(path.relative(dossier, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Même règle que l'équité : date maximale, à égalité le dernier de la liste l'emporte. */
function statutLePlusRecent(statuts: unknown): Donnees {
  let meilleur: Donnees | undefined;
  for (const s of statuts as Donnees[]) {
    if (meilleur === undefined || String(s.date) >= String(meilleur.date)) meilleur = s;
  }
  assert.ok(meilleur !== undefined, 'un candidat sans statut');
  return meilleur;
}

describe('corpus-m1 : la surcouche fictive des pages M1', () => {
  let racine = '';
  let racine2 = '';

  before(() => {
    racine = materialiserCorpusM1();
    racine2 = materialiserCorpusM1();
  });
  after(nettoyerCorpusM1);

  const charger = (mode: 'production' | 'preview') => loadAll(racine, { schemasDir: SCHEMAS_DIR, mode });
  const entree = (collection: string, id: string): Donnees => {
    const e = charger('production').entries.find((x) => x.collection === collection && x.id === id);
    assert.ok(e !== undefined, `entrée absente : ${collection}/${id}`);
    return e.data;
  };

  it('matérialise deux racines distinctes contenant tous les fichiers de base et de la surcouche', () => {
    assert.notEqual(racine, racine2);
    assert.ok(path.isAbsolute(racine));
    const presents = new Set(fichiers(racine));
    for (const f of [...fichiers(BASE_CORPUS), ...fichiers(CORPUS_M1)]) assert.ok(presents.has(f), `fichier absent de la racine : ${f}`);
  });

  it('nettoyerCorpusM1 supprime les racines temporaires', () => {
    const jetable = materialiserCorpusM1();
    assert.ok(existsSync(jetable));
    nettoyerCorpusM1();
    assert.ok(!existsSync(jetable));
    assert.ok(!existsSync(racine), 'toutes les racines créées sont supprimées');
    // Les racines du test sont recréées pour les assertions suivantes.
    racine = materialiserCorpusM1();
  });

  it('ne remplace que ids.lock et couverture/logement.yaml du corpus de base', () => {
    const base = new Set(fichiers(BASE_CORPUS));
    const surcharges = fichiers(CORPUS_M1).filter((f) => base.has(f));
    assert.deepEqual(surcharges, [...SURCHARGES_AUTORISEES].sort());
  });

  for (const mode of ['production', 'preview'] as const) {
    it(`valide sans aucune erreur en mode ${mode}`, () => {
      const res = charger(mode);
      const erreurs = res.diagnostics.filter((d) => d.severity === 'error');
      assert.deepEqual(
        erreurs.map((d) => `${d.code} ${path.relative(racine, d.file)} ${d.pointer} ${d.message}`),
        [],
      );
      const avertissements = res.diagnostics.filter((d) => d.severity === 'warning');
      if (avertissements.length > 0) {
        console.log(`  [corpus-m1 ${mode}] avertissements : ${avertissements.map((d) => `${d.code}@${path.basename(d.file)}`).join(', ')}`);
      }
    });
  }

  it('passe « ids --check » (code de sortie 0)', () => {
    const r = spawnSync(process.execPath, ['scripts/ids.ts', '--check', '--root', racine], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `ids --check a échoué :\n${r.stdout}\n${r.stderr}`);
  });

  it('contient 6 candidats et le bon périmètre d\'équité', () => {
    const candidats = charger('production').entries.filter((e) => e.collection === 'candidats');
    assert.equal(candidats.length, 6);
    const perimetre = candidats
      .filter((c) => (PERIMETRE_EQUITE as readonly unknown[]).includes(statutLePlusRecent(c.data.statuts).code))
      .map((c) => c.id)
      .sort();
    assert.deepEqual(perimetre, ['elise-erard', 'jean-imaginaire', 'marie-fictive', 'paul-de-villefranche']);
    // Sans aucun statut relu ou publié, donc absentes de la production (D-06, plan 09-15) : Paul et Nina.
    const nonRelus = candidats
      .filter((c) => statutRetenu(c.data.statuts, 'production') === undefined)
      .map((c) => c.id)
      .sort();
    assert.deepEqual(nonRelus, ['nina-pressentie', 'paul-de-villefranche']);
  });

  it('couvre les cas de candidats : collation, particule, statut non relu, renoncement relu, pressenti', () => {
    const elise = entree('candidats', 'elise-erard');
    assert.equal(elise.nom_tri, 'Érard');
    const paul = entree('candidats', 'paul-de-villefranche');
    assert.equal(paul.nom, 'de Villefranche');
    assert.equal(paul.nom_tri, 'Villefranche');
    const statutsPaul = paul.statuts as Donnees[];
    assert.equal(statutsPaul.length, 1);
    assert.equal(statutsPaul[0]?.code, 'declare');
    assert.equal(statutsPaul[0]?.statut_relecture, 'brouillon');
    const luc = statutLePlusRecent(entree('candidats', 'luc-retire').statuts);
    assert.equal(luc.code, 'renonce');
    assert.equal(luc.motif, 'retrait');
    assert.equal(luc.statut_relecture, 'relu');
    const nina = entree('candidats', 'nina-pressentie').statuts as Donnees[];
    assert.equal(nina.length, 1);
    assert.equal(nina[0]?.code, 'pressenti');
  });

  it('a deux thèmes publiés (un seul prioritaire aîné) et un thème relu', () => {
    const themes = charger('production').entries.filter((e) => e.collection === 'themes');
    const publies = themes.filter((t) => t.data.statut_relecture === 'publie').map((t) => t.id).sort();
    assert.deepEqual(publies, ['climat', 'logement']);
    assert.deepEqual(
      publies.filter((id) => themes.find((t) => t.id === id)?.data.prioritaire_aine === true),
      ['logement'],
    );
    assert.equal(entree('themes', 'ecole').statut_relecture, 'relu');
  });

  it('porte les états vides typés non_precise et programme_non_publie', () => {
    const etats = new Set<string>();
    for (const c of charger('production').entries.filter((e) => e.collection === 'couverture')) {
      for (const cas of c.data.cases as Donnees[]) etats.add(String(cas.etat));
    }
    assert.ok(etats.has('non_precise'));
    assert.ok(etats.has('programme_non_publie'));
    assert.ok(etats.has('mesures'));
  });

  it('a deux mesures de marie-fictive sur logement, dont une avec deux marqueurs de glossaire', () => {
    const mesures = charger('production').entries.filter((e) => e.collection === 'mesures' && e.data.candidat === 'marie-fictive' && e.data.theme === 'logement');
    assert.equal(mesures.length, 2);
    const m = entree('mesures', 'marie-fictive/aide-construction');
    assert.equal(m.statut_relecture, 'publie');
    const enfant = String((m.redactions as Donnees).enfant);
    const marqueurs = [...enfant.matchAll(MARQUEUR_GLOSSAIRE)].map((x) => x[0]).sort();
    assert.deepEqual(marqueurs, ['[[Parti Imaginaire|parti-imaginaire]]', '[[loyer]]'].sort());
  });

  it('range la phrase piège dans le seul titre de la mesure en brouillon', () => {
    const m = entree('mesures', 'elise-erard/guichet-unique');
    assert.equal(m.statut_relecture, 'brouillon');
    assert.ok(String(m.titre).includes(TRAPPE_BROUILLON));
    const porteurs = fichiers(racine).filter((f) => readFileSync(path.join(racine, f), 'utf8').includes(TRAPPE_BROUILLON));
    assert.deepEqual(porteurs, ['src/content/mesures/elise-erard/guichet-unique.yaml']);
  });

  it('n\'utilise que des hôtes en .invalid dans la surcouche (hors enveloppe web.archive.org)', () => {
    let vues = 0;
    for (const f of fichiers(CORPUS_M1).filter((x) => x.endsWith('.yaml'))) {
      const texte = readFileSync(path.join(CORPUS_M1, f), 'utf8');
      for (const [url] of texte.matchAll(/https?:\/\/[^\s"']+/g)) {
        vues++;
        assert.ok(URL.canParse(url), `URL illisible dans ${f} : ${url}`);
        const hote = new URL(url).hostname;
        if (hote === 'web.archive.org') {
          const m = /^https:\/\/web\.archive\.org\/web\/[0-9]{14}\/(https:\/\/.+)$/.exec(url);
          assert.ok(m?.[1] !== undefined && new URL(m[1]).hostname.endsWith('.invalid'), `enveloppe wayback non fictive dans ${f} : ${url}`);
        } else {
          assert.ok(url.startsWith('https://') && hote.endsWith('.invalid'), `hôte non fictif dans ${f} : ${url}`);
        }
      }
    }
    assert.ok(vues > 0, 'aucune URL trouvée : la surcouche est-elle vide ?');
  });
});
