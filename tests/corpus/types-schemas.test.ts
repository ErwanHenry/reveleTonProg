// DETTE-05 (W7, D-14) : les interfaces écrites à la main dans src/lib/corpus/types.ts ne doivent pas dériver
// des schémas JSON de schemas/. Le corpus est validé par Ajv contre les schémas, puis typé par un
// « as unknown as » (src/lib/corpus/index.ts) : une dérive ne se verrait qu'à l'exécution, sur une page.
// Ce test lit types.ts avec l'API du compilateur TypeScript (déjà en devDependency) et compare, dans les
// deux sens, les propriétés de 13 interfaces et les valeurs de 7 unions de littéraux aux schémas : présence,
// requisition (required de l'objet et de allOf[*] ; une propriété non optionnelle du type doit être requise),
// nullabilité, et enum d'une propriété (en place ou derrière un $ref) contre l'union ou l'alias du type.
// Pas de génération de types (hors périmètre de D-14). Les schémas sondage et journal n'ont pas de type
// dans types.ts : hors périmètre. Les types dérivés de src/lib/corpus/vue.ts ne sont pas comparés.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHEMIN_TYPES = path.join(REPO, 'src', 'lib', 'corpus', 'types.ts');
const DOSSIER_SCHEMAS = path.join(REPO, 'schemas');

type Json = { [cle: string]: unknown };
type Schemas = Record<string, Json>;

/** Interface de types.ts → emplacement de l'objet dans un schéma (fichier relatif à schemas/ + pointeur JSON). */
const INTERFACES: Record<string, string> = {
  Candidat: 'candidat.schema.json#',
  StatutEntree: 'candidat.schema.json#/properties/statuts/items',
  Theme: 'theme.schema.json#',
  SousTheme: 'theme.schema.json#/properties/sous_themes/items',
  Source: 'source.schema.json#',
  Mesure: 'mesure.schema.json#',
  Redactions: 'mesure.schema.json#/properties/redactions',
  Chiffrage: 'mesure.schema.json#/properties/chiffrage',
  Couverture: 'couverture.schema.json#',
  CaseCouverture: 'couverture.schema.json#/properties/cases/items',
  EntreeGlossaire: 'glossaire.schema.json#',
  Archive: 'defs/common.schema.json#/$defs/archive',
  SourceStatut: 'defs/common.schema.json#/$defs/sourceStatut',
};

/** Union de littéraux de types.ts → `enum` du schéma. */
const UNIONS: Record<string, string> = {
  StatutRelecture: 'defs/common.schema.json#/$defs/statutRelecture/enum',
  CodeStatut: 'candidat.schema.json#/properties/statuts/items/properties/code/enum',
  MotifRenoncement: 'candidat.schema.json#/properties/statuts/items/properties/motif/enum',
  TypeSource: 'defs/common.schema.json#/$defs/sourceStatut/properties/type/enum',
  TypeSourcePrimaire: 'source.schema.json#/properties/type/enum',
  AuteurSource: 'source.schema.json#/properties/auteur/enum',
  EtatCouverture: 'couverture.schema.json#/properties/cases/items/properties/etat/enum',
};

interface ProprieteType {
  optionnelle: boolean;
  /** Valeurs si le type de la propriété est une union de littéraux chaînes écrite en place (ex. 'terme' | 'parti'). */
  litteraux: string[] | null;
  /** Le type admet null (membre `null` d'une union). */
  nullable: boolean;
  /** Nom de l'alias si le type est une simple référence (ex. StatutRelecture), sinon null. */
  reference: string | null;
}

interface TypesLus {
  interfaces: Map<string, Map<string, ProprieteType>>;
  unions: Map<string, string[]>;
}

function nomPropriete(nom: ts.PropertyName): string {
  if (ts.isIdentifier(nom) || ts.isStringLiteral(nom) || ts.isNumericLiteral(nom)) return nom.text;
  throw new Error(`nom de propriété non géré : ${nom.getText()}`);
}

/** Valeurs d'une union faite uniquement de littéraux chaînes, sinon null. */
function litterauxChaines(type: ts.TypeNode | undefined): string[] | null {
  if (type === undefined) return null;
  const membres = ts.isUnionTypeNode(type) ? [...type.types] : [type];
  const valeurs: string[] = [];
  for (const m of membres) {
    if (!ts.isLiteralTypeNode(m) || !ts.isStringLiteral(m.literal)) return null;
    valeurs.push(m.literal.text);
  }
  return valeurs;
}

/** Le type est une union (ou un type seul) qui contient le littéral null. */
function admetNull(type: ts.TypeNode | undefined): boolean {
  if (type === undefined) return false;
  const membres = ts.isUnionTypeNode(type) ? [...type.types] : [type];
  return membres.some((m) => ts.isLiteralTypeNode(m) && m.literal.kind === ts.SyntaxKind.NullKeyword);
}

function lireTypes(texte: string): TypesLus {
  const src = ts.createSourceFile('types.ts', texte, ts.ScriptTarget.Latest, true);
  const interfaces = new Map<string, Map<string, ProprieteType>>();
  const unions = new Map<string, string[]>();
  src.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n)) {
      const proprietes = new Map<string, ProprieteType>();
      for (const m of n.members) {
        if (!ts.isPropertySignature(m)) throw new Error(`${n.name.text} : membre non géré ${m.getText()}`);
        proprietes.set(nomPropriete(m.name), {
          optionnelle: m.questionToken !== undefined,
          litteraux: litterauxChaines(m.type),
          nullable: admetNull(m.type),
          reference: m.type !== undefined && ts.isTypeReferenceNode(m.type) && ts.isIdentifier(m.type.typeName) ? m.type.typeName.text : null,
        });
      }
      interfaces.set(n.name.text, proprietes);
    } else if (ts.isTypeAliasDeclaration(n)) {
      const valeurs = litterauxChaines(n.type);
      if (valeurs === null) throw new Error(`alias ${n.name.text} : seules les unions de littéraux chaînes sont gérées`);
      unions.set(n.name.text, valeurs);
    }
  });
  return { interfaces, unions };
}

function lireSchemas(dossier: string): Schemas {
  const schemas: Schemas = {};
  const parcourir = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dossier, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) parcourir(r);
      else if (e.name.endsWith('.schema.json')) schemas[r] = JSON.parse(fs.readFileSync(path.join(dossier, r), 'utf8')) as Json;
    }
  };
  parcourir('');
  return schemas;
}

/** Résout « fichier#/pointeur » ; échoue bruyamment si l'emplacement n'existe pas (aucun saut silencieux). */
function resoudre(schemas: Schemas, emplacement: string): unknown {
  const [fichier, pointeur = ''] = emplacement.split('#');
  const racine = schemas[fichier ?? ''];
  if (racine === undefined) throw new Error(`schéma introuvable : ${fichier}`);
  let noeud: unknown = racine;
  for (const brut of pointeur.split('/').slice(1)) {
    const cle = brut.replace(/~1/g, '/').replace(/~0/g, '~');
    if (noeud === null || typeof noeud !== 'object' || !(cle in noeud)) throw new Error(`emplacement introuvable : ${emplacement}`);
    noeud = (noeud as Json)[cle];
  }
  return noeud;
}

function objet(v: unknown): Json | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

/** Propriétés connues d'un objet de schéma : properties ∪ then/else.properties, à la racine et dans allOf[*]. */
function proprietesSchema(s: Json): Map<string, unknown> {
  const connues = new Map<string, unknown>();
  const ajouter = (branche: unknown, prioritaire: boolean): void => {
    const props = objet(objet(branche)?.['properties']);
    if (props === null) return;
    for (const [cle, def] of Object.entries(props)) if (prioritaire || !connues.has(cle)) connues.set(cle, def);
  };
  const niveaux = [s, ...((Array.isArray(s['allOf']) ? s['allOf'] : []) as unknown[])];
  niveaux.forEach((niveau, i) => {
    ajouter(niveau, i === 0);
    ajouter(objet(niveau)?.['then'], false);
    ajouter(objet(niveau)?.['else'], false);
  });
  return connues;
}

/** Propriétés requises sans condition : required de l'objet et de chaque branche allOf[*] (pas les then/else). */
function requisesSchema(s: Json): Set<string> {
  const niveaux = [s, ...((Array.isArray(s['allOf']) ? s['allOf'] : []) as unknown[])];
  return new Set(niveaux.flatMap((n) => { const r = objet(n)?.['required']; return Array.isArray(r) ? (r as string[]) : []; }));
}

/** Suit un $ref (« #/… » relatif au fichier, ou « <$id>#/… ») ; rend la définition telle quelle si elle n'en a pas. */
function suivreRef(schemas: Schemas, fichier: string, def: Json | null, profondeur = 0): { def: Json | null; fichier: string } {
  const ref = def?.['$ref'];
  if (typeof ref !== 'string' || profondeur > 8) return { def, fichier };
  const [id = '', pointeur = ''] = ref.split('#');
  const cible = id === '' ? fichier : Object.keys(schemas).find((f) => schemas[f]?.['$id'] === id);
  if (cible === undefined) throw new Error(`$ref introuvable : ${ref}`);
  return suivreRef(schemas, cible, objet(resoudre(schemas, `${cible}#${pointeur}`)), profondeur + 1);
}

/** La définition admet null : type null (seul ou en tableau), const ou enum null, ou branche anyOf/oneOf qui l'admet. */
function schemaAdmetNull(schemas: Schemas, fichier: string, brute: Json | null): boolean {
  const { def, fichier: f } = suivreRef(schemas, fichier, brute);
  if (def === null) return false;
  const t = def['type'];
  if (t === 'null' || (Array.isArray(t) && t.includes('null'))) return true;
  if ('const' in def && def['const'] === null) return true;
  if (Array.isArray(def['enum']) && def['enum'].includes(null)) return true;
  return (['anyOf', 'oneOf'] as const).some((k) => Array.isArray(def[k]) && (def[k] as unknown[]).some((b) => schemaAdmetNull(schemas, f, objet(b))));
}

function memeEnsemble(a: string[], b: string[]): { manquantes: string[]; enTrop: string[] } {
  return { manquantes: b.filter((v) => !a.includes(v)), enTrop: a.filter((v) => !b.includes(v)) };
}

/**
 * Écarts lisibles entre le texte de types.ts et les schémas. Liste vide = aucune dérive.
 * Lève une erreur si une interface, une union ou un emplacement de schéma de la table manque,
 * ou si types.ts déclare une interface ou une union absente de la table (rien n'échappe à la comparaison).
 */
function comparer(texteTypes: string, schemas: Schemas): string[] {
  const { interfaces, unions } = lireTypes(texteTypes);
  const ecarts: string[] = [];

  for (const nom of interfaces.keys()) if (!(nom in INTERFACES)) throw new Error(`interface ${nom} absente de la table INTERFACES`);
  for (const nom of unions.keys()) if (!(nom in UNIONS)) throw new Error(`union ${nom} absente de la table UNIONS`);

  for (const [nom, emplacement] of Object.entries(INTERFACES)) {
    const type = interfaces.get(nom);
    if (type === undefined) throw new Error(`interface ${nom} introuvable dans types.ts`);
    const s = objet(resoudre(schemas, emplacement));
    if (s === null || objet(s['properties']) === null) throw new Error(`${emplacement} n'est pas un objet de schéma avec properties`);
    const requises = [...requisesSchema(s)];
    const connues = proprietesSchema(s);
    const fichier = emplacement.split('#')[0] ?? '';

    for (const r of requises) {
      const p = type.get(r);
      if (p === undefined) ecarts.push(`${nom}.${r} : requise par ${emplacement}, absente du type`);
      else if (p.optionnelle) ecarts.push(`${nom}.${r} : requise par ${emplacement}, optionnelle (?) dans le type`);
    }
    for (const [cle, p] of type) {
      if (!connues.has(cle)) {
        ecarts.push(`${nom}.${cle} : déclarée dans le type, inconnue de ${emplacement}`);
        continue;
      }
      // Sens dangereux (WR-03) : le type promet la propriété, le schéma la laisse absente. Les propriétés requises
      // seulement sous condition (then : enfant et aine si publie, motif si renonce) restent « ? » dans le type.
      if (!p.optionnelle && !requises.includes(cle)) ecarts.push(`${nom}.${cle} : non optionnelle dans le type, pas requise par ${emplacement}`);
      const brute = objet(connues.get(cle));
      const nullSchema = schemaAdmetNull(schemas, fichier, brute);
      if (nullSchema && !p.nullable) ecarts.push(`${nom}.${cle} : null permis par ${emplacement}, absent du type`);
      if (!nullSchema && p.nullable) ecarts.push(`${nom}.${cle} : null dans le type, refusé par ${emplacement}`);
      const def = suivreRef(schemas, fichier, brute).def;
      const enumSchema = Array.isArray(def?.['enum']) ? (def['enum'] as string[]) : null;
      // Union en place ou alias (StatutRelecture…) : comparée à l'enum, y compris derrière un $ref.
      const valeursType = p.litteraux ?? (p.reference !== null ? (unions.get(p.reference) ?? null) : null);
      if (valeursType !== null && enumSchema !== null) {
        const { manquantes, enTrop } = memeEnsemble(valeursType, enumSchema);
        if (manquantes.length > 0 || enTrop.length > 0)
          ecarts.push(`${nom}.${cle} : union [${valeursType.join(', ')}] différente de l'enum [${enumSchema.join(', ')}]`);
      }
    }
    for (const cle of connues.keys()) if (!type.has(cle)) ecarts.push(`${nom}.${cle} : connue de ${emplacement}, absente du type`);
  }

  for (const [nom, emplacement] of Object.entries(UNIONS)) {
    const valeurs = unions.get(nom);
    if (valeurs === undefined) throw new Error(`union ${nom} introuvable dans types.ts`);
    const enumSchema = resoudre(schemas, emplacement);
    if (!Array.isArray(enumSchema)) throw new Error(`${emplacement} n'est pas un enum`);
    const { manquantes, enTrop } = memeEnsemble(valeurs, enumSchema as string[]);
    for (const v of manquantes) ecarts.push(`${nom} : valeur '${v}' de ${emplacement} absente de l'union`);
    for (const v of enTrop) ecarts.push(`${nom} : valeur '${v}' de l'union absente de ${emplacement}`);
  }
  return ecarts;
}

const TEXTE = fs.readFileSync(CHEMIN_TYPES, 'utf8');
const SCHEMAS = lireSchemas(DOSSIER_SCHEMAS);

/** Remplace une seule occurrence et vérifie qu'elle existait (une injection ratée ne doit pas passer pour un succès). */
function injecter(avant: string, apres: string): string {
  assert.equal(TEXTE.split(avant).length - 1, 1, `motif d'injection introuvable ou ambigu : ${avant}`);
  return TEXTE.replace(avant, apres);
}

function ecartsContiennent(ecarts: string[], ...fragments: string[]): void {
  assert.ok(
    ecarts.some((e) => fragments.every((f) => e.includes(f))),
    `aucun écart ne contient ${fragments.join(' + ')} :\n${ecarts.join('\n')}`,
  );
}

describe('W7 : types.ts aligné sur schemas/', () => {
  it('aucune dérive sur les vrais fichiers (13 interfaces, 7 unions)', () => {
    const { interfaces, unions } = lireTypes(TEXTE);
    assert.equal(interfaces.size, 13);
    assert.equal(unions.size, 7);
    assert.deepEqual(comparer(TEXTE, SCHEMAS), []);
  });

  it('les propriétés déclarées seulement dans then/else comptent comme connues (motif, parti_source)', () => {
    const statuts = objet(resoudre(SCHEMAS, INTERFACES['StatutEntree'] ?? ''));
    assert.ok(statuts !== null);
    const connues = proprietesSchema(statuts);
    assert.ok(connues.has('motif') && connues.has('relecteur') && connues.has('date_relecture'));
    const sansMotif = { ...statuts, properties: { ...(objet(statuts['properties']) ?? {}) } } as Json;
    delete (sansMotif['properties'] as Json)['motif'];
    assert.ok(proprietesSchema(sansMotif).has('motif'), 'motif reste connu par la branche then de allOf[0]');
  });

  it('faute : propriété ajoutée à Mesure', () => {
    const texte = injecter('  texte_source: string;\n', '  texte_source: string;\n  resume_court: string;\n');
    ecartsContiennent(comparer(texte, SCHEMAS), 'Mesure.resume_court', 'inconnue');
  });

  it('faute : propriété requise rendue optionnelle (Source.url devient url?)', () => {
    const texte = injecter('  candidats: string[];\n  titre: string;\n  url: string;\n', '  candidats: string[];\n  titre: string;\n  url?: string;\n');
    ecartsContiennent(comparer(texte, SCHEMAS), 'Source.url', 'optionnelle');
  });

  it('faute : propriété retirée de Candidat (nom_tri)', () => {
    const texte = injecter('  nom_tri: string;\n', '');
    const ecarts = comparer(texte, SCHEMAS);
    ecartsContiennent(ecarts, 'Candidat.nom_tri', 'requise', 'absente du type');
  });

  it('faute : propriété optionnelle retirée de Candidat (ordre_cc), connue du schéma', () => {
    const texte = injecter('  ordre_cc?: number;\n', '');
    ecartsContiennent(comparer(texte, SCHEMAS), 'Candidat.ordre_cc', 'absente du type');
  });

  it('faute : valeur retirée de StatutRelecture', () => {
    const texte = injecter("'brouillon' | 'relu' | 'publie'", "'brouillon' | 'publie'");
    ecartsContiennent(comparer(texte, SCHEMAS), 'StatutRelecture', "'relu'");
  });

  it('faute : valeur ajoutée à CodeStatut', () => {
    const texte = injecter("| 'renonce';", "| 'renonce' | 'suspendu';");
    ecartsContiennent(comparer(texte, SCHEMAS), 'CodeStatut', "'suspendu'");
  });

  it('faute : union en place différente de l’enum (EntreeGlossaire.type)', () => {
    const texte = injecter("type: 'terme' | 'parti';", "type: 'terme' | 'parti' | 'sigle';");
    ecartsContiennent(comparer(texte, SCHEMAS), 'EntreeGlossaire.type', 'enum');
  });

  // WR-03 (revue de la phase 7) : sens inverse de la requisition, nullabilité, required de allOf, enum derrière un $ref.
  /** Copie des schémas avec une modification ciblée (les vrais fichiers ne sont jamais touchés). */
  function schemasModifies(modifier: (s: Schemas) => void): Schemas {
    const copie = structuredClone(SCHEMAS);
    modifier(copie);
    return copie;
  }
  const source = (s: Schemas): Json => s['source.schema.json']!;
  const sansUrl = (r: unknown): string[] => (r as string[]).filter((c) => c !== 'url');

  it('faute : propriété non optionnelle dans le type mais plus requise par le schéma (url retirée de source#/required)', () => {
    const schemas = schemasModifies((s) => { source(s)['required'] = sansUrl(source(s)['required']); });
    ecartsContiennent(comparer(TEXTE, schemas), 'Source.url', 'non optionnelle dans le type', 'pas requise');
  });

  it('les required d’une branche allOf[*] comptent comme requis (url déplacée de required vers allOf)', () => {
    const schemas = schemasModifies((s) => {
      source(s)['required'] = sansUrl(source(s)['required']);
      source(s)['allOf'] = [...((source(s)['allOf'] as unknown[] | undefined) ?? []), { required: ['url'] }];
    });
    assert.deepEqual(comparer(TEXTE, schemas), []);
  });

  it('un required conditionnel (then) ne compte pas : motif reste optionnel dans StatutEntree sans écart', () => {
    assert.ok(!requisesSchema(objet(resoudre(SCHEMAS, INTERFACES['StatutEntree'] ?? ''))!).has('motif'));
  });

  it('faute : null permis par le schéma, absent du type (Source.titre nullable, puis Candidat.parti sans | null)', () => {
    const schemas = schemasModifies((s) => {
      (objet(source(s)['properties'])!)['titre'] = { anyOf: [{ $ref: 'urn:reveletonprog:schema:common#/$defs/texte' }, { type: 'null' }] };
    });
    ecartsContiennent(comparer(TEXTE, schemas), 'Source.titre', 'null permis');
    ecartsContiennent(comparer(injecter('  parti: string | null;\n', '  parti: string;\n'), SCHEMAS), 'Candidat.parti', 'null permis');
  });

  it('faute : null dans le type, refusé par le schéma (Source.url: string | null)', () => {
    const texte = injecter('  candidats: string[];\n  titre: string;\n  url: string;\n', '  candidats: string[];\n  titre: string;\n  url: string | null;\n');
    ecartsContiennent(comparer(texte, SCHEMAS), 'Source.url', 'null dans le type');
  });

  it('faute : enum atteint par un $ref différent de l’alias du type (Mesure.statut_relecture)', () => {
    const schemas = schemasModifies((s) => {
      ((objet(s['defs/common.schema.json']!['$defs'])!)['statutRestreint']) = { enum: ['brouillon', 'publie'] };
      (objet(s['mesure.schema.json']!['properties'])!)['statut_relecture'] = { $ref: 'urn:reveletonprog:schema:common#/$defs/statutRestreint' };
    });
    ecartsContiennent(comparer(TEXTE, schemas), 'Mesure.statut_relecture', 'enum');
  });

  it('échec bruyant : interface de la table absente de types.ts', () => {
    const texte = injecter('export interface Chiffrage {', 'export interface ChiffrageRenomme {');
    assert.throws(() => comparer(texte, SCHEMAS), /ChiffrageRenomme absente de la table|Chiffrage introuvable/);
  });

  it('échec bruyant : emplacement de schéma manquant', () => {
    const { ['mesure.schema.json']: _retire, ...sansMesure } = SCHEMAS;
    assert.throws(() => comparer(TEXTE, sansMesure), /schéma introuvable : mesure\.schema\.json/);
    const redactionsSansProps = structuredClone(SCHEMAS);
    delete (objet(redactionsSansProps['mesure.schema.json']?.['properties'])?? {})['redactions'];
    assert.throws(() => comparer(TEXTE, redactionsSansProps), /emplacement introuvable : mesure\.schema\.json#\/properties\/redactions/);
  });
});
