// D-06 : rapport de répétition à blanc (module pur scripts/lib/rapport-import.ts). Personnes fictives,
// adresses exemple.test, aucune lecture disque : le même texte sert au terminal et à la pull request.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UpstreamRow } from '../../scripts/lib/datagouv.ts';
import { construireRapport, rapportMarkdown } from '../../scripts/lib/rapport-import.ts';
import type { EntreeRapport, PlanRapport } from '../../scripts/lib/rapport-import.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';

type Obj = Record<string, unknown>;

const SHA = 'a'.repeat(64);

function statut(code: string, date: string, url: string, over: Obj = {}, relecture = 'relu'): Obj {
  return {
    code,
    ...(over.motif !== undefined ? { motif: over.motif } : {}),
    date,
    source: { type: 'presse', url, date_publication: date, date_consultation: '2026-11-09' },
    statut_relecture: relecture,
  };
}

/** Fiche fictive : une ou plusieurs entrées de statuts. */
function fiche(id: string, statuts: Obj[], extra: Obj = {}): Obj {
  return { id, parti: null, ...extra, statuts };
}

function plan(id: string, avant: Obj | null, apresStatuts: Obj[], mappe: Obj | null = null): PlanRapport {
  const derniers = apresStatuts[apresStatuts.length - 1] as Obj;
  const apres = avant === null ? fiche(id, apresStatuts) : { ...avant, statuts: apresStatuts };
  return { id, idAmont: id.replace('-test', ''), avant, apres, mappe: mappe ?? { id, parti: null, statuts: [derniers] } };
}

function ligne(id: string, extra: Partial<UpstreamRow> = {}): UpstreamRow {
  return {
    id,
    nom: 'Prénom Fictif',
    parti: 'Parti Fictif',
    statut: 'declare',
    source: { titre: 'Titre', url: 'https://exemple.test/nouveau', date: '2026-11-01' },
    liens: { parti: 'https://exemple.test/parti', campagne: 'https://exemple.test/campagne' },
    verifie_le: '2026-11-09',
    ...extra,
  };
}

function entree(over: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    instantane: { nom: '2027etmoi-candidats-2026-12-10-aaaaaaaaaaaa.json', sha256: SHA, miseAJour: '2026-12-10', lignes: 3, precedent: 'data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json' },
    plans: [],
    inconnus: [],
    conflits: [],
    precedent: null,
    idsAmont: [],
    fichesAbsentes: [],
    candidats: [],
    themes: [],
    mesures: [],
    couvertures: [],
    themesOuverts: [],
    ...over,
  };
}

const TITRES = [
  '## Instantané',
  '## Nouveaux',
  '## Nouveaux à décider (absents de correspondances.yaml)',
  '## Absents du jeu amont',
  '## Changés',
  '## Statut déjà relu qui change',
  '## Conséquences sur les thèmes publiés',
  '## Dérives de source (information)',
  '## Conflits',
];
const PHRASE_VOCABULAIRE = 'Vocabulaire : « absents du jeu amont » correspond aux « retirés » de la feuille de route ; une absence du jeu ne vaut pas retrait de candidature.';
const PHRASE_FIN = "Aucune décision sur une personne n'est prise par cet outil : statut, motif et type de source sont décidés par le relecteur.";

const md = (e: EntreeRapport): string => rapportMarkdown(construireRapport(e));

/** Texte d'une section (de son titre jusqu'au titre suivant). */
function section(texte: string, titre: string): string {
  const i = texte.indexOf(`${titre}\n`);
  assert.ok(i >= 0, `section absente : ${titre}`);
  const reste = texte.slice(i + titre.length + 1);
  const j = reste.search(/^(## |---$)/m);
  return (j < 0 ? reste : reste.slice(0, j)).trim();
}

// ---- jeu de départ : un thème publié et ouvert, deux personnes relues dans le périmètre ----
const A_RELU = fiche('alice-test', [statut('declare', '2026-09-01', 'https://exemple.test/alice-ancien')]);
const B_RELU = fiche('bob-test', [statut('declare', '2026-09-02', 'https://exemple.test/bob-ancien')]);
const THEME = { themes: [{ id: 'logement', statutRelecture: 'publie' }], themesOuverts: ['logement'] };
const CORPUS = {
  ...THEME,
  candidats: [
    { id: 'alice-test', statuts: A_RELU.statuts },
    { id: 'bob-test', statuts: B_RELU.statuts },
  ],
  mesures: [
    { theme: 'logement', candidat: 'alice-test', statutRelecture: 'publie' },
    { theme: 'logement', candidat: 'alice-test', statutRelecture: 'publie' },
  ],
  couvertures: [{ theme: 'logement', candidat: 'bob-test', etat: 'programme_non_publie' }],
};

describe('rapport de répétition à blanc (D-06)', () => {
  it('les sections sont toujours présentes, dans l’ordre, avec le vocabulaire et la dernière phrase', () => {
    const t = md(entree());
    let dernier = -1;
    for (const titre of TITRES) {
      const i = t.indexOf(`${titre}\n`);
      assert.ok(i > dernier, `${titre} absent ou hors ordre`);
      dernier = i;
    }
    assert.ok(section(t, '## Instantané').includes(PHRASE_VOCABULAIRE));
    assert.equal(t.trimEnd().split('\n').pop(), PHRASE_FIN);
  });

  it('aucun changement : chaque section vaut « aucun » et aucun thème publié', () => {
    const t = md(entree());
    for (const titre of TITRES.slice(1)) {
      const s = section(t, titre);
      assert.match(s, /^aucun/, `${titre} : ${s}`);
    }
    assert.match(section(t, '## Conséquences sur les thèmes publiés'), /aucun thème publié/);
  });

  it('en-tête : nom, empreinte complète, mise à jour, lignes, précédent', () => {
    const s = section(md(entree()), '## Instantané');
    assert.ok(s.includes('2027etmoi-candidats-2026-12-10-aaaaaaaaaaaa.json'));
    assert.ok(s.includes(SHA));
    assert.ok(s.includes('2026-12-10'));
    assert.match(s, /lignes amont : 3/);
    assert.ok(s.includes('data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json'));
    const sans = section(md(entree({ instantane: { ...entree().instantane, precedent: null } })), '## Instantané');
    assert.match(sans, /aucun instantané précédent/);
  });

  it('Nouveaux : identifiant, code, date et adresse de la source', () => {
    const t = md(entree({ plans: [plan('zoe-test', null, [statut('declare', '2026-11-01', 'https://exemple.test/zoe', {}, 'brouillon')])] }));
    assert.equal(section(t, '## Nouveaux'), '- zoe-test : declare (2026-11-01), source https://exemple.test/zoe du 2026-11-01');
  });

  it('Nouveaux à décider : faits amont seuls, sans parti, bloc, propositions ni détail', () => {
    const u = ligne('inconnu-un', {
      nom: 'Prénom Fictif',
      parti: 'Parti extrêmement courageux',
      statut: 'renonce',
      source: { titre: 'Titre libre', url: 'https://exemple.test/inconnu', date: '2026-11-02' },
    });
    (u as Obj).bloc = 'Bloc fictif';
    (u as Obj).propositions = ['Proposition fictive'];
    (u as Obj).statut_detail = 'Détail fictif';
    const t = md(entree({ inconnus: [u] }));
    const s = section(t, '## Nouveaux à décider (absents de correspondances.yaml)');
    assert.ok(s.includes('inconnu-un'));
    assert.ok(s.includes('Prénom Fictif'));
    assert.ok(s.includes('renonce'));
    assert.ok(s.includes('2026-11-02'));
    assert.ok(s.includes('https://exemple.test/inconnu'));
    assert.ok(s.includes('2026-11-09'));
    assert.match(s, /liens : campagne, parti/);
    for (const interdit of ['Parti extrêmement', 'Bloc fictif', 'Proposition fictive', 'Détail fictif', 'Titre libre']) assert.ok(!t.includes(interdit), interdit);
    assert.deepEqual(motsInterdits(t, { exempterCitations: false }), []);
  });

  it('Absents du jeu amont : jeu précédent et fiches, formule « absent du jeu amont du », jamais « retiré »', () => {
    const t = md(
      entree({
        precedent: { miseAJour: '2026-10-28', ids: ['a', 'b', 'c'] },
        idsAmont: ['a'],
        fichesAbsentes: [{ id: 'bob-test', idAmont: 'b' }],
      }),
    );
    const s = section(t, '## Absents du jeu amont');
    assert.equal(s, ['- b (fiche bob-test) : absent du jeu amont du 2026-12-10', '- c : absent du jeu amont du 2026-12-10'].join('\n'));
    assert.doesNotMatch(t.replace(PHRASE_VOCABULAIRE, ''), /retir/i);
  });

  it('Changés : transition sourcée champ par champ, parti et site « non appliqué » sans étiquette', () => {
    const ancien = statut('declare', '2026-09-01', 'https://exemple.test/ancien');
    const nouveau = statut('renonce', '2026-11-20', 'https://exemple.test/nouveau', { motif: 'retrait' }, 'brouillon');
    const avant = fiche('alice-test', [ancien], { parti: 'Ancienne étiquette', site_officiel: 'https://exemple.test/site-ancien' });
    const mappe = { id: 'alice-test', parti: 'Nouvelle étiquette', site_officiel: 'https://exemple.test/site-nouveau', statuts: [nouveau] };
    const t = md(entree({ plans: [plan('alice-test', avant, [ancien, nouveau], mappe)] }));
    const s = section(t, '## Changés');
    assert.ok(s.includes('- alice-test : statut : declare (2026-09-01) -> renonce/retrait (2026-11-20), source https://exemple.test/nouveau du 2026-11-20'), s);
    assert.match(s, /alice-test : parti : différent du fichier \(non appliqué\)/);
    assert.match(s, /alice-test : site_officiel : différent du fichier \(non appliqué\)/);
    assert.ok(!t.includes('étiquette'));
  });

  it('Statut déjà relu qui change : anciennes et nouvelles sources, thèmes publiés, mesures et case', () => {
    const ancien = statut('declare', '2026-09-01', 'https://exemple.test/alice-ancien');
    const nouveau = statut('renonce', '2026-11-20', 'https://exemple.test/alice-nouveau', { motif: 'retrait' }, 'brouillon');
    const t = md(entree({ ...CORPUS, plans: [plan('alice-test', A_RELU, [ancien, nouveau])] }));
    const s = section(t, '## Statut déjà relu qui change');
    assert.ok(s.includes('- alice-test : relu declare (2026-09-01), source https://exemple.test/alice-ancien du 2026-09-01 -> renonce/retrait (2026-11-20), source https://exemple.test/alice-nouveau du 2026-11-20'), s);
    assert.match(s, /thème logement : 2 mesure\(s\) publiée\(s\), case : aucune/);
    // (ii) du thème : la personne sort du périmètre après relecture.
    const c = section(t, '## Conséquences sur les thèmes publiés');
    assert.match(c, /sort du périmètre après relecture : alice-test \(renonce\), 2 mesure\(s\) publiée\(s\), case : aucune/);
  });

  it('un statut relu qui ne change pas de code n’y figure pas', () => {
    const memeCode = statut('declare', '2026-11-20', 'https://exemple.test/alice-bis', {}, 'brouillon');
    // l'import n'ajoute une entrée que si (code, motif) change ; ici l'action est « inchangé » côté données
    const t = md(entree({ ...CORPUS, plans: [plan('alice-test', A_RELU, [...(A_RELU.statuts as Obj[]), memeCode])] }));
    assert.match(section(t, '## Statut déjà relu qui change'), /^aucun/);
  });

  it('Conséquences : un nouveau déclaré sur un thème publié sans mesure ni case, cellules maintenant et après', () => {
    const nouveau = statut('declare', '2026-11-01', 'https://exemple.test/zoe', {}, 'brouillon');
    const t = md(entree({ ...CORPUS, plans: [plan('zoe-test', null, [nouveau])], candidats: [...CORPUS.candidats] }));
    const c = section(t, '## Conséquences sur les thèmes publiés');
    assert.match(c, /### logement/);
    assert.match(c, /cellules attendues : 2 maintenant, 3 après relecture de tous les statuts importés/);
    assert.match(c, /case de couverture à créer avant de relire le statut : zoe-test \(declare\)/);
    assert.match(c, /sort du périmètre après relecture : aucun/);
  });

  it('Conséquences : thème publié mais non ouvert, ou ouvert mais en brouillon, n’est pas listé', () => {
    const t1 = md(entree({ ...CORPUS, themesOuverts: [] }));
    assert.match(section(t1, '## Conséquences sur les thèmes publiés'), /aucun thème publié/);
    const t2 = md(entree({ ...CORPUS, themes: [{ id: 'logement', statutRelecture: 'brouillon' }] }));
    assert.match(section(t2, '## Conséquences sur les thèmes publiés'), /aucun thème publié/);
  });

  it('Dérives de source : même statut, adresse ou date différente, les deux adresses', () => {
    const avant = fiche('alice-test', [statut('declare', '2026-09-01', 'https://exemple.test/ancienne')]);
    const mappe = { id: 'alice-test', parti: null, statuts: [statut('declare', '2026-09-15', 'https://exemple.test/nouvelle', {}, 'brouillon')] };
    const t = md(entree({ plans: [{ id: 'alice-test', idAmont: 'alice', avant, apres: avant, mappe }] }));
    const s = section(t, '## Dérives de source (information)');
    assert.equal(s, '- alice-test : declare inchangé ; fichier https://exemple.test/ancienne du 2026-09-01 ; amont https://exemple.test/nouvelle du 2026-09-15');
    assert.match(section(t, '## Changés'), /^aucun/);
  });

  it('Conflits : le tiret long est rendu « : »', () => {
    const t = md(entree({ conflits: ['alice-test — régression de date : amont renonce du 2026-01-01'] }));
    assert.equal(section(t, '## Conflits'), '- alice-test : régression de date : amont renonce du 2026-01-01');
  });

  it('déterministe : mêmes octets, ordre des entrées indifférent, identifiants triés', () => {
    const n1 = plan('zoe-test', null, [statut('declare', '2026-11-01', 'https://exemple.test/zoe', {}, 'brouillon')]);
    const n2 = plan('adam-test', null, [statut('declare', '2026-11-01', 'https://exemple.test/adam', {}, 'brouillon')]);
    const a = md(entree({ plans: [n1, n2] }));
    const b = md(entree({ plans: [n2, n1] }));
    assert.equal(a, b);
    assert.ok(a.indexOf('adam-test') < a.indexOf('zoe-test'));
  });

  it('jamais de tiret long ou demi-long, de mot interdit, de « retiré » hors vocabulaire, toute transition sourcée', () => {
    const ancien = statut('declare', '2026-09-01', 'https://exemple.test/alice-ancien');
    const nouveau = statut('renonce', '2026-11-20', 'https://exemple.test/alice-nouveau', { motif: 'retrait' }, 'brouillon');
    const e = entree({
      ...CORPUS,
      plans: [
        plan('alice-test', A_RELU, [ancien, nouveau]),
        plan('zoe-test', null, [statut('primaire', '2026-11-01', 'https://exemple.test/zoe', {}, 'brouillon')]),
      ],
      inconnus: [ligne('inconnu-un', { nom: 'Prénom — Fictif' })],
      conflits: ['bob-test — conflit fictif'],
      precedent: { miseAJour: '2026-10-28', ids: ['x'] },
      idsAmont: [],
    });
    const t = md(e);
    assert.doesNotMatch(t, /[–—]/);
    assert.deepEqual(motsInterdits(t, { exempterCitations: false }), []);
    assert.doesNotMatch(t.replace(PHRASE_VOCABULAIRE, ''), /retiré/i);
    const transitions = t.split('\n').filter((l) => / -> /.test(l));
    assert.ok(transitions.length >= 2);
    for (const l of transitions) {
      assert.match(l, /source https:\/\/\S+ du \d{4}-\d{2}(-\d{2})?/, l);
    }
    // seul le texte de l'amont public peut apparaître comme libellé : aucune étiquette de parti
    assert.ok(!t.includes('Parti Fictif'));
  });
});

/** Texte hors des spans de code (CommonMark : une suite de N accents graves ferme la suite de même longueur). */
function horsCode(texte: string): string {
  let out = '';
  let i = 0;
  while (i < texte.length) {
    const m = /`+/.exec(texte.slice(i));
    if (m === null) return out + texte.slice(i);
    const debut = i + m.index;
    out += texte.slice(i, debut);
    const fence = m[0];
    let j = debut + fence.length;
    let fin = -1;
    while (j < texte.length) {
      const k = texte.indexOf(fence, j);
      if (k < 0) break;
      if (texte[k + fence.length] !== '`' && texte[k - 1] !== '`') {
        fin = k;
        break;
      }
      j = k + 1;
      while (texte[j] === '`') j += 1;
    }
    if (fin < 0) return out + texte.slice(debut);
    out += ' ';
    i = fin + fence.length;
  }
  return out;
}

describe('CR-01 : texte amont hostile dans le corps de la pull request', () => {
  const HOSTILES = [
    'Nom\n\n## Conflits\n\naucun\n\n## Faux',
    '<img src=https://traceur.exemple.test/p.png>',
    '[@compte](https://exemple.test/piege)',
    'Salut @compte et @org/equipe',
    '![image](https://traceur.exemple.test/i.png)',
    '| a | b |\n|---|---|\n| c | d |',
    '# Faux titre',
    '`code` et ``double``',
    'Nom ## Faux suite',
    'Nom <script>alert(1)</script> &amp;',
  ];
  const URLS_HOSTILES = [
    'https://exemple.test/a<img src=https://traceur.exemple.test/p.png>',
    'https://exemple.test/[lien](https://piege.exemple.test)',
    'https://exemple.test/@compte',
    'https://exemple.test/a`b`c',
    'https://exemple.test/!%5Bx%5D(https://traceur.exemple.test/i.png)',
  ];

  function rapportHostile(): string {
    const inconnus = HOSTILES.map((nom, i) =>
      ligne(`hostile-${i}`, {
        nom,
        source: { titre: 'Titre', url: URLS_HOSTILES[i % URLS_HOSTILES.length] as string, date: '2026-11-02' },
        liens: { [`campagne\n\n## Conflits\n\naucun\n\n## Faux ${i}`]: 'https://exemple.test/c', '<b>gras</b>': 'https://exemple.test/b', '@compte': 'https://exemple.test/m' },
      }),
    );
    const ancien = statut('declare', '2026-09-01', URLS_HOSTILES[0] as string);
    const nouveau = statut('renonce', '2026-11-20', URLS_HOSTILES[1] as string, { motif: 'retrait' }, 'brouillon');
    return md(
      entree({
        ...CORPUS,
        plans: [
          plan('alice-test', A_RELU, [ancien, nouveau]),
          plan('zoe-test', null, [statut('declare', '2026-11-01', URLS_HOSTILES[2] as string, {}, 'brouillon')]),
        ],
        inconnus,
        conflits: ['bob-test — conflit\n## Faux conflit\n<img src=https://traceur.exemple.test/c.png> @compte'],
        precedent: { miseAJour: '2026-10-28', ids: ['x\n## Faux absent'] },
        idsAmont: [],
      }),
    );
  }

  it('aucun titre fabriqué : seuls les titres du rapport et des thèmes commencent une ligne par #', () => {
    const t = rapportHostile();
    const titres = t.split('\n').filter((l) => /^\s{0,3}#/.test(l));
    assert.deepEqual(titres, ['# Rapport de répétition à blanc de l\'import data.gouv', ...TITRES.slice(0, 7), '### logement', ...TITRES.slice(7)]);
  });

  it('une ligne par personne à décider, aucune ligne de tableau, aucune ligne vide inventée dans une section', () => {
    const t = rapportHostile();
    const s = section(t, '## Nouveaux à décider (absents de correspondances.yaml)');
    assert.equal(s.split('\n').length, HOSTILES.length, s);
    for (const l of s.split('\n')) assert.match(l, /^- hostile-\d : /, l);
    assert.equal(section(t, '## Conflits').split('\n').length, 1);
    assert.equal(section(t, '## Absents du jeu amont').split('\n').length, 1);
    for (const l of t.split('\n')) assert.doesNotMatch(l, /^\s*\|/, l);
  });

  it('hors des spans de code : ni balise, ni lien, ni image, ni mention, ni barre verticale, ni caractère de contrôle', () => {
    const t = rapportHostile();
    const libre = horsCode(t);
    assert.doesNotMatch(libre.replace(/ -> /g, ' '), /[<>]/, 'balise HTML (la flèche « -> » du rapport mise à part)');
    assert.doesNotMatch(libre, /[[\]]/, 'crochet de lien ou d’image');
    assert.doesNotMatch(libre, /!\[/, 'image');
    assert.doesNotMatch(libre, /(^|[^\w/])@\w/, 'mention');
    assert.doesNotMatch(libre, /\|/, 'tableau');
    assert.doesNotMatch(libre, /&\w+;/, 'entité HTML');
    assert.doesNotMatch(t, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/, 'caractère de contrôle');
  });

  it('le texte hostile reste lisible, entier, dans un span de code', () => {
    const t = rapportHostile();
    assert.ok(t.includes('`<img src=https://traceur.exemple.test/p.png>`'), 'balise montée en texte');
    assert.ok(t.includes('`[@compte](https://exemple.test/piege)`'));
    assert.ok(t.includes('`` `code` et ``double`` ``') || t.includes('``` `code` et ``double`` ```'), 'accents graves gardés par une clôture plus longue');
  });

  it('une ligne légitime est rendue sans aucun changement', () => {
    const t = md(entree({ inconnus: [ligne('inconnu-un', { statut: 'renonce', source: { titre: 'T', url: 'https://exemple.test/inconnu_2026/article-1.html?a=1&b=2', date: '2026-11-02' } })] }));
    assert.equal(
      section(t, '## Nouveaux à décider (absents de correspondances.yaml)'),
      '- inconnu-un : Prénom Fictif, renonce (2026-11-02), source https://exemple.test/inconnu_2026/article-1.html?a=1&b=2, vérifié le 2026-11-09, liens : campagne, parti',
    );
    const n = md(entree({ inconnus: [ligne('inconnu-deux', { nom: "Jeanne d'Arc-Exemple O’Fictive" })] }));
    assert.match(section(n, '## Nouveaux à décider (absents de correspondances.yaml)'), /^- inconnu-deux : Jeanne d'Arc-Exemple O’Fictive, declare /);
  });
});
