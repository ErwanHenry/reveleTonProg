import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { Entry } from '../../src/lib/content-core/load.ts';
import { THEMES_SPEC } from '../../scripts/lib/couverture.ts';
import type { CouvertureThemes, Niveau } from '../../scripts/lib/couverture.ts';
import { HOTES_INTERDITS, SIGLES_ENFANT, verifierPilote } from '../../scripts/lib/pilote.ts';
import type { Probleme } from '../../scripts/lib/pilote.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = loadAll(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide'), { schemasDir: path.join(REPO_ROOT, 'schemas'), mode: 'preview' });
assert.equal(BASE.diagnostics.filter((d) => d.severity === 'error').length, 0, 'le corpus fictif doit rester valide');

/** Copie profonde du corpus fictif, modifiable en mémoire. */
const copie = (): Entry[] => structuredClone(BASE.entries);
const trouve = (entries: Entry[], collection: string, id: string): Entry => {
  const e = entries.find((x) => x.collection === collection && x.id === id);
  assert.ok(e, `entrée ${collection}/${id} introuvable`);
  return e;
};

function couverture(opts: { themes?: string[]; livres?: string[]; ouverte?: boolean; niveaux?: Record<string, Niveau> } = {}): CouvertureThemes {
  const niveaux = opts.niveaux ?? {};
  return {
    version: 1,
    mesure_le: '2026-11-04',
    mesure_par: 'test',
    regle: { marge_egalite: 2 },
    themes: THEMES_SPEC.map((t) => ({ id: t.id })),
    candidats: Object.entries(niveaux).map(([id, niveau]) => ({
      id,
      acces: 'ok' as const,
      urls_bloquees: [],
      sources: [],
      urls_consultees: [],
      cellules: Object.fromEntries(THEMES_SPEC.map((t) => [t.id, { niveau }])),
    })),
    pilote: { provisoires: [], themes: opts.themes ?? ['logement'], livres: opts.livres ?? ['logement'], derogation: null, relecture_ouverte: opts.ouverte ?? true },
  };
}

const codes = (ps: Probleme[]): string[] => ps.map((p) => p.code);
const avec = (ps: Probleme[], code: string): Probleme[] => ps.filter((p) => p.code === code);

function toutEnBrouillon(entries: Entry[]): void {
  for (const e of entries) {
    if (e.collection === 'mesures' || e.collection === 'themes' || e.collection === 'couverture') {
      if ('statut_relecture' in e.data) e.data.statut_relecture = 'brouillon';
      delete e.data.relecteur;
      delete e.data.date_relecture;
    }
    if (e.collection === 'candidats') {
      for (const s of e.data.statuts as Record<string, unknown>[]) {
        s.statut_relecture = 'brouillon';
        delete s.relecteur;
        delete s.date_relecture;
      }
    }
  }
}

const caseDe = (entries: Entry[], candidat: string): Record<string, unknown> => {
  const cases = trouve(entries, 'couverture', 'logement').data.cases as Record<string, unknown>[];
  const c = cases.find((x) => x.candidat === candidat);
  assert.ok(c);
  return c;
};
const enfantDe = (entries: Entry[], texte: string): void => {
  (trouve(entries, 'mesures', 'marie-fictive/encadrement-loyers').data.redactions as Record<string, unknown>).enfant = texte;
};

describe('listes exportées', () => {
  it('HOTES_INTERDITS contient le plancher documenté', () => {
    for (const h of ['2027etmoi.fr', 'repere2027.fr', 'data.gouv.fr', 'wikipedia.org', 'web.archive.org', 'lemonde.fr', 'jhm.fr', 'huffingtonpost.fr', 'poligraph.fr']) {
      assert.ok(HOTES_INTERDITS.includes(h), h);
    }
  });
  it('SIGLES_ENFANT liste les sigles de partis et fiscaux', () => {
    assert.deepEqual([...SIGLES_ENFANT], ['PS', 'LR', 'RN', 'LFI', 'PCF', 'EELV', 'NPA', 'LO', 'UPR', 'DLF', 'UDI', 'PRG', 'TVA', 'CSG', 'IFI', 'ISF', 'RIC']);
  });
});

describe('PILOTE_NON_BROUILLON', () => {
  it('relecture fermée : le corpus fictif (publie) ne produit que ce code', () => {
    const ps = verifierPilote(copie(), couverture({ ouverte: false }));
    assert.ok(ps.length > 0);
    assert.deepEqual([...new Set(codes(ps))], ['PILOTE_NON_BROUILLON']);
    assert.ok(ps.every((p) => p.severite === 'erreur'));
  });
  it('relecture ouverte : plus de contrôle', () => {
    assert.deepEqual(verifierPilote(copie(), couverture({ ouverte: true })), []);
  });
  it('relecture fermée et tout en brouillon : aucun problème', () => {
    const entries = copie();
    toutEnBrouillon(entries);
    assert.deepEqual(verifierPilote(entries, couverture({ ouverte: false })), []);
  });
  it('un relecteur sur un fichier en brouillon est refusé', () => {
    const entries = copie();
    toutEnBrouillon(entries);
    trouve(entries, 'mesures', 'marie-fictive/encadrement-loyers').data.relecteur = 'Erwan Henry';
    const ps = verifierPilote(entries, couverture({ ouverte: false }));
    assert.deepEqual(codes(ps), ['PILOTE_NON_BROUILLON']);
    assert.match(ps[0]!.message, /marie-fictive/);
  });
  it('un statut de candidat non brouillon est refusé', () => {
    const entries = copie();
    toutEnBrouillon(entries);
    (trouve(entries, 'candidats', 'jean-imaginaire').data.statuts as Record<string, unknown>[])[0]!.statut_relecture = 'relu';
    const ps = verifierPilote(entries, couverture({ ouverte: false }));
    assert.deepEqual(codes(ps), ['PILOTE_NON_BROUILLON']);
    assert.match(ps[0]!.message, /jean-imaginaire/);
  });
});

describe('PILOTE_PLAFOND', () => {
  function avecMesures(n: number): Entry[] {
    const entries = copie();
    const modele = trouve(entries, 'mesures', 'marie-fictive/encadrement-loyers');
    for (let i = 2; i <= n; i++) {
      const id = `marie-fictive/mesure-${i}`;
      entries.push({ ...structuredClone(modele), id, file: modele.file.replace('encadrement-loyers', `mesure-${i}`), data: { ...structuredClone(modele.data), id } });
    }
    return entries;
  }
  it('2 mesures : accepté', () => {
    assert.deepEqual(avec(verifierPilote(avecMesures(2), couverture()), 'PILOTE_PLAFOND'), []);
  });
  it('3 mesures pour un candidat et un thème : erreur qui liste les identifiants', () => {
    const ps = avec(verifierPilote(avecMesures(3), couverture()), 'PILOTE_PLAFOND');
    assert.equal(ps.length, 1);
    assert.equal(ps[0]!.severite, 'erreur');
    assert.match(ps[0]!.message, /marie-fictive\/mesure-3/);
    assert.match(ps[0]!.message, /logement/);
  });
  it('un thème hors pilote n’est pas compté', () => {
    assert.deepEqual(avec(verifierPilote(avecMesures(3), couverture({ themes: ['ecole'], livres: [] })), 'PILOTE_PLAFOND'), []);
  });
});

describe('PILOTE_CASE_MANQUANTE / PILOTE_CASE_DOUBLE', () => {
  it('la case de Jean retirée, thème livré : erreur', () => {
    const entries = copie();
    const cases = trouve(entries, 'couverture', 'logement').data.cases as Record<string, unknown>[];
    cases.splice(cases.findIndex((c) => c.candidat === 'jean-imaginaire'), 1);
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_CASE_MANQUANTE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /jean-imaginaire/);
    assert.match(ps[0]!.message, /logement/);
  });
  it('le même cas, thème non livré : aucune erreur', () => {
    const entries = copie();
    const cases = trouve(entries, 'couverture', 'logement').data.cases as Record<string, unknown>[];
    cases.splice(cases.findIndex((c) => c.candidat === 'jean-imaginaire'), 1);
    assert.deepEqual(avec(verifierPilote(entries, couverture({ livres: [] })), 'PILOTE_CASE_MANQUANTE'), []);
  });
  it('fichier de couverture absent pour un thème livré : erreur', () => {
    const entries = copie().filter((e) => e.collection !== 'couverture');
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_CASE_MANQUANTE');
    assert.ok(ps.length >= 1);
    assert.match(ps[0]!.message, /logement/);
  });
  it('un candidat hors périmètre n’a pas besoin de case', () => {
    const entries = copie();
    (trouve(entries, 'candidats', 'jean-imaginaire').data.statuts as Record<string, unknown>[])[0]!.code = 'pressenti';
    const cases = trouve(entries, 'couverture', 'logement').data.cases as Record<string, unknown>[];
    cases.splice(cases.findIndex((c) => c.candidat === 'jean-imaginaire'), 1);
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_CASE_MANQUANTE'), []);
  });
  it('une case en double : erreur', () => {
    const entries = copie();
    const cases = trouve(entries, 'couverture', 'logement').data.cases as Record<string, unknown>[];
    cases.push(structuredClone(cases[0]!));
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_CASE_DOUBLE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /marie-fictive/);
  });
});

describe('PILOTE_INCOHERENCE / PILOTE_SOURCE_CONSULTEE', () => {
  it('case « mesures » sans mesure : erreur', () => {
    const entries = copie();
    caseDe(entries, 'jean-imaginaire').etat = 'mesures';
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_INCOHERENCE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /jean-imaginaire/);
  });
  it('case « non_precise » alors qu’une mesure existe : erreur', () => {
    const entries = copie();
    const c = caseDe(entries, 'marie-fictive');
    c.etat = 'non_precise';
    c.sources_consultees = ['marie-fictive-programme'];
    assert.equal(avec(verifierPilote(entries, couverture()), 'PILOTE_INCOHERENCE').length, 1);
  });
  it('case « programme_non_publie » alors qu’une mesure existe : erreur', () => {
    const entries = copie();
    caseDe(entries, 'marie-fictive').etat = 'programme_non_publie';
    assert.equal(avec(verifierPilote(entries, couverture()), 'PILOTE_INCOHERENCE').length, 1);
  });
  it('non_precise avec une source consultée du candidat : accepté', () => {
    const entries = copie();
    const c = caseDe(entries, 'marie-fictive');
    // la mesure est retirée pour que la case soit cohérente
    entries.splice(entries.findIndex((e) => e.collection === 'mesures'), 1);
    c.etat = 'non_precise';
    c.sources_consultees = ['marie-fictive-programme'];
    const ps = verifierPilote(entries, couverture());
    assert.deepEqual(avec(ps, 'PILOTE_SOURCE_CONSULTEE'), []);
    assert.deepEqual(avec(ps, 'PILOTE_INCOHERENCE'), []);
  });
  it('non_precise dont la source consultée est celle d’un autre candidat : erreur', () => {
    const entries = copie();
    const c = caseDe(entries, 'jean-imaginaire');
    c.etat = 'non_precise';
    c.sources_consultees = ['marie-fictive-programme'];
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_SOURCE_CONSULTEE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /jean-imaginaire/);
    assert.match(ps[0]!.message, /marie-fictive-programme/);
  });
  it('non_precise dont la source consultée n’existe pas : erreur', () => {
    const entries = copie();
    const c = caseDe(entries, 'jean-imaginaire');
    c.etat = 'non_precise';
    c.sources_consultees = ['source-fantome'];
    assert.equal(avec(verifierPilote(entries, couverture()), 'PILOTE_SOURCE_CONSULTEE').length, 1);
  });
});

describe('PILOTE_HOTE_INTERDIT', () => {
  const source = (entries: Entry[]): Entry => trouve(entries, 'sources', 'marie-fictive-programme');
  it('un site de presse comme source d’une mesure : erreur', () => {
    const entries = copie();
    source(entries).data.url = 'https://www.lemonde.fr/politique/article/2026/11/03/programme.html';
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_HOTE_INTERDIT');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /lemonde\.fr/);
    assert.match(ps[0]!.message, /marie-fictive\/encadrement-loyers/);
  });
  it('le même hôte pour une tribune de la main du candidat : accepté', () => {
    const entries = copie();
    source(entries).data.url = 'https://www.lemonde.fr/idees/article/2026/11/03/tribune.html';
    source(entries).data.type = 'tribune';
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_HOTE_INTERDIT'), []);
  });
  it('un hôte qui finit par le même texte sans être un sous-domaine : accepté', () => {
    const entries = copie();
    source(entries).data.url = 'https://notlemonde.fr/programme';
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_HOTE_INTERDIT'), []);
  });
});

describe('PILOTE_PARTI_NON_MARQUE / PILOTE_TERME_NON_MARQUE', () => {
  it('un nom de parti sans marqueur : erreur', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive est du Parti Imaginaire. Elle veut une règle.');
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_PARTI_NON_MARQUE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /Parti Imaginaire/);
  });
  it('la casse et les accents ne changent rien', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive parle du parti imaginaire.');
    assert.equal(avec(verifierPilote(entries, couverture()), 'PILOTE_PARTI_NON_MARQUE').length, 1);
  });
  it('un nom de parti marqué : accepté', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive est du [[Parti Imaginaire|parti-imaginaire]]. Elle veut une règle.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_PARTI_NON_MARQUE'), []);
  });
  it('un terme du glossaire sans marqueur : erreur', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive veut fixer le loyer. Le préfet décide chaque année.');
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_TERME_NON_MARQUE');
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /loyer/);
  });
  it('un terme du glossaire marqué : accepté', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive veut fixer le [[loyer]]. Le préfet décide chaque année.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_TERME_NON_MARQUE'), []);
  });
  it('un terme marqué sous un autre affichage : accepté', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive veut limiter les [[loyers|loyer]]. Le loyer est le prix du logement.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_TERME_NON_MARQUE'), []);
  });
  it('le pluriel n’est pas le libellé : pas de faux positif', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive veut limiter les loyers.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_TERME_NON_MARQUE'), []);
  });
  it('seules les rédactions enfant sont contrôlées', () => {
    const entries = copie();
    (trouve(entries, 'mesures', 'marie-fictive/encadrement-loyers').data.redactions as Record<string, unknown>).aine = 'Le Parti Imaginaire parle du loyer.';
    const ps = verifierPilote(entries, couverture());
    assert.deepEqual(avec(ps, 'PILOTE_PARTI_NON_MARQUE'), []);
    assert.deepEqual(avec(ps, 'PILOTE_TERME_NON_MARQUE'), []);
  });
});

describe('PILOTE_SIGLE_ENFANT (avertissement)', () => {
  it('un sigle nu : avertissement', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive critique le RN. Elle veut une règle.');
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_SIGLE_ENFANT');
    assert.equal(ps.length, 1);
    assert.equal(ps[0]!.severite, 'avertissement');
    assert.match(ps[0]!.message, /RN/);
  });
  it('un sigle fiscal : avertissement', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive veut baisser la TVA.');
    assert.equal(avec(verifierPilote(entries, couverture()), 'PILOTE_SIGLE_ENFANT').length, 1);
  });
  it('un nom développé et marqué : aucun avertissement', () => {
    const entries = copie();
    enfantDe(entries, 'Marie Fictive critique le [[Rassemblement national|rassemblement-national]]. Elle veut une règle.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_SIGLE_ENFANT'), []);
  });
  it('un mot ordinaire qui contient les lettres : aucun avertissement', () => {
    const entries = copie();
    enfantDe(entries, 'Le préfet a un LORS ou un Ps dans Hlm.');
    assert.deepEqual(avec(verifierPilote(entries, couverture()), 'PILOTE_SIGLE_ENFANT'), []);
  });
});

describe('avertissements de périmètre et de mesure', () => {
  it('PILOTE_HORS_PERIMETRE : une case pour un candidat hors périmètre', () => {
    const entries = copie();
    (trouve(entries, 'candidats', 'jean-imaginaire').data.statuts as Record<string, unknown>[])[0]!.code = 'pressenti';
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_HORS_PERIMETRE');
    assert.equal(ps.length, 1);
    assert.equal(ps[0]!.severite, 'avertissement');
    assert.match(ps[0]!.message, /jean-imaginaire/);
  });
  it('PILOTE_HORS_PERIMETRE : une mesure pour un candidat hors périmètre', () => {
    const entries = copie();
    const statuts = trouve(entries, 'candidats', 'marie-fictive').data.statuts as Record<string, unknown>[];
    statuts[statuts.length - 1]!.code = 'renonce';
    const ps = avec(verifierPilote(entries, couverture()), 'PILOTE_HORS_PERIMETRE');
    assert.ok(ps.some((p) => /marie-fictive/.test(p.message)));
  });
  it('PILOTE_ECART_MESURE : niveau « aucun » mais case « mesures »', () => {
    const ps = avec(verifierPilote(copie(), couverture({ niveaux: { 'marie-fictive': 'aucun' } })), 'PILOTE_ECART_MESURE');
    assert.equal(ps.length, 1);
    assert.equal(ps[0]!.severite, 'avertissement');
    assert.match(ps[0]!.message, /marie-fictive/);
  });
  it('PILOTE_ECART_MESURE : niveau cohérent avec la case', () => {
    const ps = verifierPilote(copie(), couverture({ niveaux: { 'marie-fictive': 'fort', 'jean-imaginaire': 'aucun' } }));
    assert.deepEqual(avec(ps, 'PILOTE_ECART_MESURE'), []);
  });
});
