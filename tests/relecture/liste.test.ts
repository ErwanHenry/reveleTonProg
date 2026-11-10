import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';

// Commande `liste` (09-01, PUB-01) sur le corpus fictif M1 temporaire, thème logement.
// Périmètre (preview) : marie-fictive, jean-imaginaire, elise-erard, paul-de-villefranche (luc-retire a renoncé,
// nina-pressentie est pressentie). 3 mesures + 4 statuts + 4 cases = 11 cibles.

after(() => nettoyerCorpusRelecture());

interface Json {
  theme: string;
  reste: number;
  total: number;
  candidats: { id: string; mesures: { id: string; etat: string; alertes: { code: string }[] }[]; statut: { etat: string; index: number } | null; case: { etat: string } | null }[];
}

describe('relecture liste (CLI, corpus M1 temporaire)', () => {
  let c: CorpusRelecture;
  beforeEach(() => {
    c = corpusRelecture();
  });
  const json = (): Json => {
    const r = c.lancer('liste', '--theme', 'logement', '--format', 'json');
    assert.equal(r.code, 0, r.stderr);
    return JSON.parse(r.stdout) as Json;
  };
  const mesure = (j: Json, id: string): { etat: string } | undefined => j.candidats.flatMap((x) => x.mesures).find((m) => m.id === id);

  it('json : périmètre, totaux ; un fichier relu ou publié sans ligne de registre est « à revoir »', () => {
    const j = json();
    assert.equal(j.theme, 'logement');
    assert.deepEqual(j.candidats.map((x) => x.id).sort(), ['elise-erard', 'jean-imaginaire', 'marie-fictive', 'paul-de-villefranche']);
    assert.equal(j.total, 11);
    // 3 mesures (2 publiées sans registre : à revoir ; 1 brouillon) + 4 statuts (3 relus sans registre, 1 brouillon) ; cases relues par Erwan Henry.
    assert.equal(j.reste, 7);
    assert.equal(mesure(j, 'elise-erard/guichet-unique')?.etat, 'a_relire');
    assert.equal(mesure(j, 'marie-fictive/aide-construction')?.etat, 'a_revoir');
    assert.ok(j.candidats.every((x) => x.case?.etat === 'relu'));
  });

  it('après marquer : relu ; après une modification du texte relu : à revoir', () => {
    assert.equal(c.lancer('marquer', 'mesure', 'elise-erard/guichet-unique', '--date', '2026-11-20').code, 0);
    let j = json();
    assert.equal(mesure(j, 'elise-erard/guichet-unique')?.etat, 'relu');
    assert.equal(j.reste, 6);
    const f = 'src/content/mesures/elise-erard/guichet-unique.yaml';
    c.ecrire(f, c.lire(f).replace('pour toutes les demandes de logement social.\n  detaille', 'pour les demandes de logement social.\n  detaille'));
    j = json();
    assert.equal(mesure(j, 'elise-erard/guichet-unique')?.etat, 'a_revoir');
    assert.equal(j.reste, 7);
  });

  it('une case dont verifie_par n’est pas le relecteur est à relire ; --relecteur change la référence', () => {
    const j = JSON.parse(c.lancer('liste', '--theme', 'logement', '--format', 'json', '--relecteur', 'Anne Relectrice').stdout) as Json;
    assert.ok(j.candidats.every((x) => x.case?.etat === 'a_relire'));
    assert.equal(j.reste, 11);
  });

  it('texte : une ligne par cible et « reste N sur M »', () => {
    const r = c.lancer('liste', '--theme', 'logement');
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^Thème logement : 4 candidat\(s\) dans le périmètre$/m);
    assert.match(r.stdout, /^ {2}mesure elise-erard\/guichet-unique : à relire/m);
    assert.match(r.stdout, /^ {2}statut declare du 2026-10-19 \(statuts\[0\]\) : à relire$/m);
    assert.match(r.stdout, /^reste 7 sur 11$/m);
  });

  it('sans --theme : tous les thèmes qui ont une mesure', () => {
    const r = c.lancer('liste');
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^Thème logement :/m);
  });

  it('code 1 et erreurs affichées quand un fichier du thème est invalide ; code 2 sur un thème inconnu', () => {
    const f = 'src/content/mesures/elise-erard/guichet-unique.yaml';
    c.ecrire(f, `${c.lire(f)}cle_inconnue: 1\n`);
    const r = c.lancer('liste', '--theme', 'logement');
    assert.equal(r.code, 1);
    assert.match(r.stderr, /^erreur : .*guichet-unique\.yaml/m);
    assert.equal(c.lancer('liste', '--theme', 'inexistant').code, 2);
    assert.equal(c.lancer('liste', '--format', 'xml').code, 2);
  });
});
