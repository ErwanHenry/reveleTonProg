(function () {
  var CLE = 'rtp:ordre', racine = document.documentElement, mode = 'alphabetique';
  racine.setAttribute('data-ordre-js', '');
  try { if (localStorage.getItem(CLE) === 'aleatoire') mode = 'aleatoire'; } catch (e) {}
  if (mode === 'aleatoire') racine.setAttribute('data-ordre', 'aleatoire');
  function alea(n) {
    var max = Math.floor(4294967296 / n) * n, u = new Uint32Array(1);
    do { crypto.getRandomValues(u); } while (u[0] >= max);
    return u[0] % n;
  }
  function ordonner() {
    var listes = document.querySelectorAll('[data-ordonnable]');
    for (var k = 0; k < listes.length; k++) {
      var l = listes[k], a = Array.prototype.slice.call(l.children);
      if (mode === 'aleatoire') {
        for (var i = a.length - 1; i > 0; i--) { var j = alea(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
      } else a.sort(function (x, y) { return x.getAttribute('data-rang') - y.getAttribute('data-rang'); });
      a.forEach(function (n) { l.appendChild(n); });
      l.setAttribute('data-ordre-fait', '');
    }
  }
  function pret() {
    ordonner();
    var c = document.querySelector('[data-ordre-controle]');
    if (!c) return;
    c.hidden = false;
    c.querySelector('input[value="' + mode + '"]').checked = true;
    c.addEventListener('change', function (e) {
      mode = e.target.value === 'aleatoire' ? 'aleatoire' : 'alphabetique';
      try { localStorage.setItem(CLE, mode); } catch (x) {}
      ordonner();
      c.querySelector('[data-ordre-annonce]').textContent = 'Ordre ' + (mode === 'aleatoire' ? 'aléatoire : nouveau tirage.' : 'alphabétique.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pret); else pret();
})();
