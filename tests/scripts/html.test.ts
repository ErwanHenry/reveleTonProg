import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aClasse, analyserHtml, parcourir, texte, trouver } from '../../scripts/lib/html.ts';
import type { Noeud } from '../../scripts/lib/html.ts';

const EXEMPLE =
  '<!doctype html><html lang="fr"><body><p class="a b">Le <button popovertarget="x">loyer</button><span id="x" popover>déf</span> est</p><br><img src="/a.png"></body></html>';

const un = (racine: Noeud, tag: string): Noeud => {
  const [n] = trouver(racine, (x) => x.tag === tag);
  assert.ok(n, `balise <${tag}> introuvable`);
  return n;
};

describe('analyserHtml', () => {
  it("construit l'arbre : 4 enfants pour <p>, éléments vides frères de <p>", () => {
    const racine = analyserHtml(EXEMPLE);
    assert.equal(racine.tag, '#document');
    const p = un(racine, 'p');
    assert.equal(p.enfants.length, 4);
    assert.equal(p.enfants[0], 'Le ');
    assert.equal((p.enfants[1] as Noeud).tag, 'button');
    assert.equal((p.enfants[2] as Noeud).tag, 'span');
    assert.equal(p.enfants[3], ' est');
    const body = un(racine, 'body');
    const tags = body.enfants.map((e) => (typeof e === 'string' ? 'texte' : e.tag));
    assert.deepEqual(tags, ['p', 'br', 'img']);
    assert.equal(un(racine, 'br').enfants.length, 0);
    assert.equal(un(racine, 'img').enfants.length, 0);
    assert.equal(un(racine, 'img').attrs.src, '/a.png');
    assert.equal(un(racine, 'p').parent, body);
    // le doctype n'est pas du texte visible
    assert.ok(!texte(racine).includes('doctype'));
  });

  it('décode les entités des valeurs et du texte ; un attribut booléen vaut la chaîne vide', () => {
    const racine = analyserHtml(
      '<a title="a &amp; b &quot;c&quot; &#39;d&#39; &#x27;e&#x27;&nbsp;f" href=/x data-k=\'v\' hidden>1 &lt; 2&nbsp;ok</a>',
    );
    const a = un(racine, 'a');
    assert.equal(a.attrs.title, 'a & b "c" \'d\' \'e\' f');
    assert.equal(a.attrs.href, '/x');
    assert.equal(a.attrs['data-k'], 'v');
    assert.equal(a.attrs.hidden, '');
    assert.equal(texte(a), '1 < 2 ok');
    const span = analyserHtml('<span popover></span>');
    assert.equal(un(span, 'span').attrs.popover, '');
  });

  it('traite le contenu de <script> et <style> comme du texte brut ; les commentaires sont retirés', () => {
    const racine = analyserHtml(
      '<head><script>if (a<b && c>d) { x = "<p>"; }</script><style>a>b{color:red}</style><!-- <p>caché</p> --></head><p>vu</p>',
    );
    assert.equal(trouver(racine, (n) => n.tag === 'p').length, 1);
    const script = un(racine, 'script');
    assert.equal(script.enfants.length, 1);
    assert.equal(script.enfants[0], 'if (a<b && c>d) { x = "<p>"; }');
    assert.equal(un(racine, 'style').enfants[0], 'a>b{color:red}');
    assert.ok(!texte(racine).includes('caché'));
  });

  it('ne lève jamais sur des balises non fermées ou des fermetures orphelines', () => {
    const racine = analyserHtml('</div><ul><li>un<li>deux</ul>fin</span><p>x');
    assert.ok(un(racine, 'ul'));
    assert.equal(trouver(racine, (n) => n.tag === 'li').length, 2);
    assert.ok(texte(racine).includes('fin'));
    assert.doesNotThrow(() => analyserHtml('<a href="x'));
    assert.doesNotThrow(() => analyserHtml('<'));
    assert.doesNotThrow(() => analyserHtml(''));
  });
});

describe('aides de parcours', () => {
  it("texte() concatène les descendants et saute les sous-arbres exclus ; aClasse() teste un mot de class", () => {
    const racine = analyserHtml('<p class="a b">Un <b data-citation>caché</b> deux <i>trois</i></p>');
    const p = un(racine, 'p');
    assert.equal(texte(p), 'Un caché deux trois');
    assert.equal(texte(p, (n) => 'data-citation' in n.attrs), 'Un  deux trois');
    assert.ok(aClasse(p, 'a'));
    assert.ok(aClasse(p, 'b'));
    assert.ok(!aClasse(p, 'ab'));
    assert.ok(!aClasse(un(racine, 'i'), 'a'));
  });

  it("trouver() et parcourir() suivent l'ordre du document", () => {
    const racine = analyserHtml('<div id="1"><p id="2"></p><div id="3"><p id="4"></p></div></div><p id="5"></p>');
    assert.deepEqual(
      trouver(racine, (n) => n.tag === 'p').map((n) => n.attrs.id),
      ['2', '4', '5'],
    );
    const vus: string[] = [];
    parcourir(racine, (n) => vus.push(n.tag));
    assert.deepEqual(vus, ['#document', 'div', 'p', 'div', 'p', 'p']);
  });
});
