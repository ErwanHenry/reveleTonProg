import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCouverture } from '../../scripts/lib/couverture.ts';
import {
  NOTE_GABARIT,
  RELECTEUR_AGENT,
  ecartsCouverture,
  ecrireCasesManquantes,
  ecrireCorrespondances,
  relireParAgent,
  synchroniserCouverture,
} from '../../scripts/lib/veille/ecriture-auto.ts';
import { THEMES_SPEC } from '../../scripts/lib/couverture.ts';

// Tout se passe sur une COPIE du corpus réel dans un dossier temporaire : le dépôt n'est jamais modifié.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

function copie(): string {
  const racine = mkdtempSync(path.join(tmpdir(), 'rtp-ecriture-'));
  dossiers.push(racine);
  for (const p of ['data', 'src/content', 'schemas', 'relecture', 'ids.lock']) {
    cpSync(path.join(REPO, p), path.join(racine, p), { recursive: true });
  }
  return racine;
}
const lire = (racine: string, rel: string): string => readFileSync(path.join(racine, rel), 'utf8');

function ficheFictive(statut: string, date: string, relu: boolean): string {
  return [
    'version_schema: 1',
    'id: jean-dupont',
    'prenom: Jean',
    'nom: Dupont',
    'nom_tri: Dupont',
    'parti: Parti fictif',
    'parti_source:',
    '  type: parti',
    '  url: https://exemple.invalid/parti',
    '  date_consultation: 2026-10-28',
    'statuts:',
    `  - code: ${statut}`,
    `    date: ${date}`,
    '    source:',
    '      type: parti',
    '      titre: Parti fictif',
    '      url: https://exemple.invalid/annonce',
    '      date_publication: 2026-06-01',
    '      date_consultation: 2026-10-28',
    `    statut_relecture: ${relu ? 'relu' : 'brouillon'}`,
    ...(relu ? ["    relecteur: l'agent d'IA Claude", '    date_relecture: 2026-11-17'] : []),
    '',
  ].join('\n');
}
function ajouterFiche(racine: string, statut = 'declare', date = '2026-11-20'): void {
  writeFileSync(path.join(racine, 'src/content/candidats/jean-dupont.yaml'), ficheFictive(statut, date, false));
  appendFileSync(path.join(racine, 'ids.lock'), 'jean-dupont\n');
}

/** Blocs `  - id:` du fichier de couverture, par identifiant. */
function blocs(texte: string): Map<string, string> {
  const out = new Map<string, string>();
  const l = texte.split('\n');
  const idx = l.map((x, i) => (/^ {2}- id: /.test(x) ? i : -1)).filter((i) => i >= 0);
  const fin = l.findIndex((x) => x === 'pilote:');
  idx.forEach((d, k) => out.set((l[d] as string).slice(8).trim(), l.slice(d, idx[k + 1] ?? fin).join('\n')));
  return out;
}

describe('ecrireCorrespondances', () => {
  const ligne = { idAmont: 'dupont-j', entree: { id: 'jean-dupont', prenom: 'Jean', nom: 'Dupont', nom_tri: 'Dupont', type_source_statut: 'parti' as const } };

  it('ajoute en fin sans toucher aux octets d’avant', () => {
    const racine = copie();
    const avant = lire(racine, 'data/import/correspondances.yaml');
    ecrireCorrespondances(racine, [ligne]);
    const apres = lire(racine, 'data/import/correspondances.yaml');
    assert.ok(apres.startsWith(avant));
    assert.match(apres.slice(avant.length), /^ {2}dupont-j:\n {4}id: jean-dupont\n/);
  });

  it('refuse un idAmont déjà présent et laisse le fichier inchangé', () => {
    const racine = copie();
    ecrireCorrespondances(racine, [ligne]);
    const avant = lire(racine, 'data/import/correspondances.yaml');
    assert.throws(() => ecrireCorrespondances(racine, [ligne]), /existe déjà/);
    assert.equal(lire(racine, 'data/import/correspondances.yaml'), avant);
  });

  it('refuse un identifiant de fiche déjà pris', () => {
    const racine = copie();
    const avant = lire(racine, 'data/import/correspondances.yaml');
    assert.throws(() => ecrireCorrespondances(racine, [{ ...ligne, idAmont: 'autre-amont', entree: { ...ligne.entree, id: 'olivier-faure' } }]), /existe déjà/);
    assert.equal(lire(racine, 'data/import/correspondances.yaml'), avant);
  });
});

describe('couverture réalignée sur le périmètre', () => {
  it('le dépôt réel est aligné', () => {
    assert.deepEqual(ecartsCouverture(copie()), { aAjouter: [], aRetirer: [] });
  });

  it('ajoute une personne entrée à sa place en collation française, le reste inchangé octet pour octet', () => {
    const racine = copie();
    const avant = lire(racine, 'data/couverture-themes.yaml');
    ajouterFiche(racine);
    assert.deepEqual(ecartsCouverture(racine).aAjouter, ['jean-dupont']);
    const r = synchroniserCouverture(racine, { 'jean-dupont': ['https://exemple.invalid/a'] }, '2026-11-26');
    assert.deepEqual(r, { ajoutes: ['jean-dupont'], retires: [] });
    const apres = lire(racine, 'data/couverture-themes.yaml');
    assert.deepEqual(lireCouverture(apres).problemes, []);
    const ids = [...blocs(apres).keys()];
    const i = ids.indexOf('jean-dupont');
    assert.ok(i > 0 && i < ids.length - 1);
    const avantBlocs = blocs(avant);
    const apresBlocs = blocs(apres);
    for (const [id, b] of avantBlocs) assert.equal(apresBlocs.get(id), b, id);
    assert.equal(apresBlocs.size, avantBlocs.size + 1);
    assert.deepEqual(ecartsCouverture(racine), { aAjouter: [], aRetirer: [] });
  });

  it('écrit un bloc gabarit : aucun_site, dix cellules aucun avec la note gabarit', () => {
    const racine = copie();
    ajouterFiche(racine);
    synchroniserCouverture(racine, { 'jean-dupont': ['https://exemple.invalid/a'] }, '2026-11-26');
    const { data } = lireCouverture(lire(racine, 'data/couverture-themes.yaml'));
    const c = data.candidats.find((x) => x.id === 'jean-dupont');
    assert.ok(c);
    assert.equal(c.acces, 'aucun_site');
    assert.deepEqual(c.urls_bloquees, []);
    assert.deepEqual(c.sources, []);
    assert.deepEqual(c.urls_consultees, ['https://exemple.invalid/a']);
    for (const t of THEMES_SPEC) {
      assert.equal(c.cellules[t.id]?.niveau, 'aucun');
      assert.equal(c.cellules[t.id]?.note, NOTE_GABARIT('2026-11-26'));
    }
  });

  it('retire le bloc d’une personne sortie du périmètre, le reste inchangé', () => {
    const racine = copie();
    const avant = lire(racine, 'data/couverture-themes.yaml');
    const fiche = path.join(racine, 'src/content/candidats/anasse-kazib.yaml');
    writeFileSync(
      fiche,
      `${readFileSync(fiche, 'utf8')}  - code: renonce\n    date: 2026-11-20\n    source:\n      type: parti\n      titre: Parti\n      url: https://exemple.invalid/x\n      date_publication: 2026-11-20\n      date_consultation: 2026-11-26\n    statut_relecture: brouillon\n`,
    );
    assert.deepEqual(ecartsCouverture(racine).aRetirer, ['anasse-kazib']);
    const r = synchroniserCouverture(racine, {}, '2026-11-26');
    assert.deepEqual(r.retires, ['anasse-kazib']);
    const apres = lire(racine, 'data/couverture-themes.yaml');
    const avantBlocs = blocs(avant);
    const apresBlocs = blocs(apres);
    assert.equal(apresBlocs.has('anasse-kazib'), false);
    for (const [id, b] of apresBlocs) assert.equal(avantBlocs.get(id), b, id);
    assert.equal(apresBlocs.size, avantBlocs.size - 1);
    assert.deepEqual(lireCouverture(apres).problemes, []);
  });

  it('refuse une personne à ajouter sans URL, fichier inchangé', () => {
    const racine = copie();
    const avant = lire(racine, 'data/couverture-themes.yaml');
    ajouterFiche(racine);
    assert.throws(() => synchroniserCouverture(racine, {}, '2026-11-26'), /urls_consultees/);
    assert.equal(lire(racine, 'data/couverture-themes.yaml'), avant);
  });

  it('retire les URL non https, refuse s’il n’en reste aucune', () => {
    const racine = copie();
    ajouterFiche(racine);
    const avant = lire(racine, 'data/couverture-themes.yaml');
    assert.throws(() => synchroniserCouverture(racine, { 'jean-dupont': ['http://exemple.invalid/a', 'javascript:alert(1)'] }, '2026-11-26'), /urls_consultees/);
    assert.equal(lire(racine, 'data/couverture-themes.yaml'), avant);
    synchroniserCouverture(racine, { 'jean-dupont': ['http://exemple.invalid/a', 'https://exemple.invalid/b'] }, '2026-11-26');
    const c = lireCouverture(lire(racine, 'data/couverture-themes.yaml')).data.candidats.find((x) => x.id === 'jean-dupont');
    assert.deepEqual(c?.urls_consultees, ['https://exemple.invalid/b']);
  });
});

describe('cases des thèmes pilotes', () => {
  it('insère une case programme_non_publie par thème, dans l’ordre, sans toucher aux autres lignes', () => {
    const racine = copie();
    ajouterFiche(racine);
    const dir = path.join(racine, 'src/content/couverture');
    const avant = new Map(readdirSync(dir).map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
    const ecrites = ecrireCasesManquantes(racine, '2026-11-26');
    assert.equal(ecrites.length, avant.size);
    assert.ok(ecrites.every((e) => e.candidat === 'jean-dupont'));
    for (const [f, ancien] of avant) {
      const nouveau = readFileSync(path.join(dir, f), 'utf8');
      const bloc = `  - candidat: jean-dupont\n    etat: programme_non_publie\n    verifie_le: 2026-11-26\n    verifie_par: ${RELECTEUR_AGENT}\n`;
      assert.ok(nouveau.includes(bloc), f);
      assert.equal(nouveau.replace(bloc, ''), ancien, f);
    }
    assert.deepEqual(ecrireCasesManquantes(racine, '2026-11-26'), []);
  });
});

describe('relireParAgent', () => {
  const maintenant = (): Date => new Date('2026-11-26T10:00:00Z');

  it('relit les cases puis les statuts, hors périmètre décidé par codeDansPerimetre', () => {
    const vus: string[] = [];
    const faux = ((cible: { type: string; candidat: string }, o: { horsPerimetre: boolean; relecteur: string }) => {
      vus.push(`${cible.type}:${cible.candidat}:${o.horsPerimetre}:${o.relecteur}`);
      return 0;
    }) as never;
    const r = relireParAgent(
      '/inexistant',
      { cases: [{ theme: 'sante', candidat: 'a' }], statuts: ['declare', 'primaire', 'renonce', 'empeche', 'pressenti'].map((code) => ({ candidat: code, code })) },
      '2026-11-26',
      maintenant,
      faux,
    );
    assert.deepEqual(r, { ok: true, relus: 6 });
    assert.deepEqual(vus, [
      `case:a:false:${RELECTEUR_AGENT}`,
      `statut:declare:false:${RELECTEUR_AGENT}`,
      `statut:primaire:false:${RELECTEUR_AGENT}`,
      `statut:renonce:true:${RELECTEUR_AGENT}`,
      `statut:empeche:true:${RELECTEUR_AGENT}`,
      `statut:pressenti:true:${RELECTEUR_AGENT}`,
    ]);
  });

  it('s’arrête au premier refus', () => {
    let appels = 0;
    const faux = (() => {
      appels += 1;
      return appels === 2 ? 1 : 0;
    }) as never;
    const r = relireParAgent('/x', { cases: [{ theme: 'sante', candidat: 'a' }, { theme: 'travail', candidat: 'a' }], statuts: [{ candidat: 'a', code: 'declare' }] }, '2026-11-26', maintenant, faux);
    assert.equal(r.ok, false);
    assert.equal(appels, 2);
    if (!r.ok) assert.equal(r.refus, 'case travail a');
  });

  it('relit pour de vrai sur la copie : cases puis statut, le journal gagne des lignes', () => {
    const racine = copie();
    ajouterFiche(racine);
    synchroniserCouverture(racine, { 'jean-dupont': ['https://exemple.invalid/a'] }, '2026-11-26');
    const cases = ecrireCasesManquantes(racine, '2026-11-26');
    const journalAvant = lire(racine, 'relecture/journal.jsonl').split('\n').filter(Boolean).length;
    const r = relireParAgent(racine, { cases, statuts: [{ candidat: 'jean-dupont', code: 'declare' }] }, '2026-11-26', maintenant);
    assert.deepEqual(r.ok ? r : r.messages, { ok: true, relus: cases.length + 1 });
    const journal = lire(racine, 'relecture/journal.jsonl').split('\n').filter(Boolean);
    assert.equal(journal.length, journalAvant + cases.length + 1);
    assert.match(lire(racine, 'src/content/candidats/jean-dupont.yaml'), /statut_relecture: relu/);
  });

  it('refuse un statut daté du mois seul, sans rien écrire pour ce statut', () => {
    const racine = copie();
    ajouterFiche(racine, 'declare', '2027-01');
    const avant = lire(racine, 'src/content/candidats/jean-dupont.yaml');
    const r = relireParAgent(racine, { cases: [], statuts: [{ candidat: 'jean-dupont', code: 'declare' }] }, '2026-11-26', maintenant);
    assert.equal(r.ok, false);
    assert.equal(lire(racine, 'src/content/candidats/jean-dupont.yaml'), avant);
  });
});
