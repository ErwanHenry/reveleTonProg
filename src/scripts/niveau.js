(function () {
  var CLE = 'rtp:niveau', champ = document.querySelector('.niveaux');
  if (!champ) return;
  document.documentElement.setAttribute('data-js-niveau', '');
  var annonce = document.querySelector('[data-niveau-annonce]');
  function lire() { try { return localStorage.getItem(CLE); } catch (e) { return null; } }
  function appliquer(v) {
    var r = champ.querySelectorAll('input[name="niveau"]');
    for (var i = 0; i < r.length; i++) if (r[i].value === v) { r[i].checked = true; return; }
  }
  appliquer(lire());
  champ.addEventListener('change', function (e) {
    var r = e.target;
    if (r.name !== 'niveau') return;
    try { localStorage.setItem(CLE, r.value); } catch (x) {}
    if (annonce && r.labels && r.labels[0]) annonce.textContent = 'Niveau « ' + r.labels[0].textContent + ' » affiché.';
  });
  addEventListener('pageshow', function (e) { if (e.persisted) appliquer(lire()); });
})();
