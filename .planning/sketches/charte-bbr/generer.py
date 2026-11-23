#!/usr/bin/env python3
"""Maquettes de charte bleu blanc rouge (exploration, hors site).

Trois directions et une synthèse (D) sur le même contenu, repris du site réel. Lancer depuis la racine du dépôt :
    python3 .planning/sketches/charte-bbr/generer.py
Écrit a.html, b.html, c.html, d.html et index.html à côté de ce fichier. Rien n'est servi au public.
"""
import os

D = os.path.dirname(os.path.abspath(__file__))
NOMS = {'a': 'A · Tribune', 'b': 'B · Affiche', 'c': 'C · Atelier', 'd': 'D · Synthèse A+B'}


def corps(lettre):
    liens = []
    for l in sorted(NOMS):
        courant = ' aria-current="page"' if l == lettre else ''
        liens.append('<a href="%s.html"%s>%s</a>' % (l, courant, NOMS[l]))
    nav = ''.join(liens)
    return '''<div class="proto"><span>Maquette, pas le site réel</span><nav>''' + nav + '''</nav></div>
<header class="entete"><div class="conteneur entete-in">
  <a class="marque" href="#"><span class="logo" aria-hidden="true"><i></i><i></i><i></i></span><span class="marque-txt"><strong>Révèle ton prog</strong><small>Présidentielle 2027 : les programmes, expliqués et sourcés</small></span></a>
  <nav class="menu" aria-label="Principal"><a href="#">Thèmes</a><a href="#">Candidats</a><a href="#">Méthode</a></nav>
</div></header>
<main>
<section class="hero"><div class="conteneur hero-in">
  <div class="hero-txt">
    <p class="surtitre">Élection présidentielle des 18 avril et 2 mai 2027</p>
    <h1>Les programmes de la présidentielle 2027, à votre niveau</h1>
    <p class="chapo">Ce site explique ce que proposent les candidats à l'élection présidentielle de 2027, un thème à la fois. Il ne prend jamais parti.</p>
    <p class="actions"><a class="bouton" href="#theme">Lire le thème Santé</a><a class="lien-fort" href="#">Voir les 37 candidats</a></p>
  </div>
  <div class="hero-deco" aria-hidden="true"><span></span><span></span><span></span></div>
</div></section>
<section class="garanties"><div class="conteneur"><ul role="list">
  <li><b>Sourcé</b>Chaque mesure décrit ce que le candidat propose, sans jugement, et renvoie à son texte, daté et archivé.</li>
  <li><b>Sans classement</b>Par défaut, les candidats sont classés par ordre alphabétique, jamais selon les sondages.</li>
  <li><b>Sans traceur</b>Aucun cookie, aucune publicité, aucun service extérieur.</li>
</ul></div></section>
<section class="bloc"><div class="conteneur">
  <h2>Les thèmes</h2>
  <div class="tuiles">
    <a class="tuile tuile-ouverte" href="#theme"><span class="tuile-num">01</span><strong>Santé</strong><span>37 candidats · 47 mesures</span><em>Lire</em></a>
    <div class="tuile tuile-avenir"><span class="tuile-num">02</span><strong>Travail</strong><span>Publié après relecture</span></div>
    <div class="tuile tuile-avenir"><span class="tuile-num">03</span><strong>Europe et monde</strong><span>Publié après relecture</span></div>
  </div>
</div></section>
<section class="bloc bloc-alt"><div class="conteneur">
  <h2>Quatre façons de lire</h2>
  <div class="niveaux">
    <div><strong>En bref</strong><p>Une phrase par mesure.</p></div>
    <div><strong>En détail</strong><p>Le coût annoncé, le calendrier, ce que le texte ne précise pas et la citation du programme.</p></div>
    <div><strong>Pour les enfants</strong><p>Des mots simples, avec les mots difficiles expliqués.</p></div>
    <div><strong>Gros caractères</strong><p>Un texte plus grand et les thèmes qui touchent souvent les retraités en premier.</p></div>
  </div>
</div></section>
<section class="bloc" id="theme"><div class="conteneur">
  <p class="etiquette">Extrait de la page d'un thème</p>
  <h2 class="titre-theme">Santé</h2>
  <p class="compte">Sur ce thème, 27 candidats sur 37 ont une position publiée, 3 n'ont rien de précisé dans les sources consultées, 7 n'ont pas publié de programme.</p>
  <div class="selecteur" role="group" aria-label="Niveau de lecture"><span class="actif">En bref</span><span>En détail</span><span>Pour les enfants</span><span>Gros caractères</span></div>
  <div class="cartes">
    <article class="carte">
      <header class="carte-tete"><span class="portrait" aria-hidden="true">ÉP</span><div><h3>Édouard Philippe</h3><p class="parti">Parti revendiqué : Horizons</p></div></header>
      <h4>Renforcement de la santé à l'école</h4>
      <p class="mesure">Édouard Philippe veut renforcer la santé à l'école, avec des tiers de confiance, des conseils et la détection en matière de santé mentale.</p>
      <p class="relue">Relue par l'agent d'IA Claude le 17 novembre 2026.</p>
      <div class="source"><span class="source-titre">Source primaire</span><p>Édouard Philippe, Les priorités : Pour une France plus attentive à ses enfants</p><p class="source-meta">Consultée le 4 novembre 2026 · <a href="#">Document original</a> · <a href="#">Copie archivée</a></p></div>
    </article>
    <article class="carte carte-vide">
      <header class="carte-tete"><span class="portrait" aria-hidden="true">MLP</span><div><h3>Marine Le Pen</h3><p class="parti">Parti revendiqué : Rassemblement national</p></div></header>
      <p class="vide">Programme non publié à ce jour. Vérifié le 17 novembre 2026.</p>
    </article>
  </div>
  <p class="note-photo">Les vignettes à initiales tiennent la place des portraits (photos libres de Wikimedia Commons, avec auteur et licence).</p>
</div></section>
</main>
<footer class="pied"><div class="conteneur pied-in"><p>Révèle ton prog présente les programmes des candidats sans prendre parti, sans publicité et sans cookie.</p><nav aria-label="Pied de page"><a href="#">Méthode</a><a href="#">Mentions légales</a><a href="#">Qui sommes-nous</a></nav></div></footer>'''


BASE = '''*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;line-height:1.55;font-size:1.0625rem}
a{color:inherit}.conteneur{max-width:70rem;margin:0 auto;padding:0 1.25rem}
.proto{display:flex;gap:1rem;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:.4rem 1rem;background:#111;color:#fff;font:600 .8rem/1.4 system-ui,sans-serif}
.proto nav{display:flex;gap:.35rem;flex-wrap:wrap}.proto a{white-space:nowrap}.proto a{color:#fff;text-decoration:none;padding:.2rem .6rem;border:1px solid #666;border-radius:99px}.proto a[aria-current]{background:#fff;color:#111;border-color:#fff}
.entete-in{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding-top:.9rem;padding-bottom:.9rem}
.marque{display:flex;align-items:center;gap:.75rem;text-decoration:none}.marque-txt{display:flex;flex-direction:column}.marque small{font-size:.8rem}
.menu{display:flex;gap:1.25rem;flex-wrap:wrap}.menu a{text-decoration:none;font-weight:600}
.hero-in{display:grid;grid-template-columns:1.25fr .75fr;gap:2.5rem;align-items:center}
.actions{display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;margin:1.75rem 0 0}
.bouton{display:inline-block;text-decoration:none;font-weight:700;padding:.85rem 1.4rem}
.garanties ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}.garanties b{display:block;margin-bottom:.25rem}
.bloc{padding:3.5rem 0}.tuiles{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1.25rem}
.tuile{display:flex;flex-direction:column;gap:.35rem;padding:1.5rem;text-decoration:none;min-height:11rem}.tuile strong{font-size:1.6rem}.tuile em{margin-top:auto;font-style:normal;font-weight:700}
.niveaux{display:grid;grid-template-columns:repeat(4,1fr);gap:1.25rem}.niveaux p{margin:.35rem 0 0;font-size:.95rem}
.selecteur{display:flex;gap:.5rem;flex-wrap:wrap;margin:1.5rem 0}.selecteur span{padding:.5rem 1rem;font-weight:600;font-size:.95rem}
.cartes{display:grid;grid-template-columns:1.4fr 1fr;gap:1.5rem;align-items:start}.carte{padding:1.5rem}
.carte-tete{display:flex;gap:1rem;align-items:center;margin-bottom:1rem}.carte h3{margin:0;font-size:1.3rem}.parti{margin:.1rem 0 0;font-size:.9rem}
.portrait{flex:none;display:grid;place-items:center;width:4.25rem;height:4.25rem;font:700 1.05rem system-ui,sans-serif}
.carte h4{margin:0 0 .5rem;font-size:1.05rem}.mesure{margin:0 0 .75rem;font-size:1.15rem}.relue{font-size:.85rem;margin:0 0 1rem}
.source{padding:.9rem 1rem;font-size:.9rem}.source p{margin:.2rem 0}.source-titre{font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}
.vide{margin:0;font-size:1.05rem}.note-photo{font-size:.85rem;margin:1.5rem 0 0}.etiquette{font:700 .78rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin:0 0 .5rem}
.pied-in{display:flex;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;padding-top:2rem;padding-bottom:2rem;font-size:.9rem}.pied nav{display:flex;gap:1.25rem;flex-wrap:wrap}.pied p{margin:0;max-width:34rem}
@media (max-width:760px){.hero-in,.cartes,.tuiles,.garanties ul{grid-template-columns:1fr}.niveaux{grid-template-columns:1fr 1fr}.hero-deco{display:none}.bloc{padding:2.5rem 0}}'''

CSS = {}

# A, Tribune : éditorial, fond blanc, bleu nuit, filet tricolore, titres à empattements.
CSS['a'] = '''body{background:#fff;color:#1a1d29;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1,h2,h3,.tuile strong,.marque strong{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;color:#101c4c;font-weight:700}
.entete{border-top:6px solid;border-image:linear-gradient(90deg,#16308f 0 33.3%,#fff 33.3% 66.6%,#c1121f 66.6%) 1;border-bottom:1px solid #d9dce6}
.logo{display:grid;place-items:center;width:2.5rem;height:2.5rem;background:#101c4c;border-bottom:5px solid #c1121f}.logo i{display:none}.logo::before{content:"R";color:#fff;font:700 1.45rem/1 "Iowan Old Style",Palatino,Georgia,serif}
.marque strong{font-size:1.35rem}.marque small{color:#5a607a}.menu a{color:#101c4c}
.hero{padding:4.5rem 0 3.5rem}.surtitre{color:#c1121f;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:.82rem;margin:0 0 1rem}
h1{font-size:clamp(2.2rem,4.6vw,3.6rem);line-height:1.08;margin:0 0 1.25rem}.chapo{font-size:1.25rem;max-width:36rem;margin:0}
.bouton{background:#101c4c;color:#fff}.lien-fort{color:#101c4c;font-weight:700;text-underline-offset:.25em;text-decoration-color:#c1121f;text-decoration-thickness:2px}
.hero-deco{border-left:6px solid #c1121f;padding:.5rem 0 .5rem 1.75rem}.hero-deco span{display:none}.hero-deco::before{content:"2027";display:block;font:700 clamp(4rem,9vw,7.5rem)/.9 "Iowan Old Style",Palatino,Georgia,serif;color:#16308f;letter-spacing:-.03em}.hero-deco::after{content:"1er tour le 18 avril, 2d tour le 2 mai";display:block;margin-top:.9rem;font:600 1rem system-ui,sans-serif;color:#101c4c}
.garanties{border-block:1px solid #d9dce6;padding:2rem 0;background:#f6f7fb}.garanties b{color:#101c4c;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase}.garanties li{font-size:.98rem}
h2{font-size:2rem;margin:0 0 1.5rem;padding-bottom:.6rem;border-bottom:2px solid #101c4c}
.tuile{border:1px solid #101c4c;color:#101c4c}.tuile-num{font:700 .8rem system-ui;color:#c1121f}.tuile-ouverte{background:#101c4c;color:#fff}.tuile-ouverte strong{color:#fff}.tuile-ouverte .tuile-num{color:#fff}.tuile-avenir{border-style:dashed;color:#5a607a}.tuile-avenir strong{color:#5a607a}
.bloc-alt{background:#f6f7fb}.niveaux div{border-top:3px solid #16308f;padding-top:.9rem}.niveaux div:nth-child(even){border-color:#c1121f}.niveaux strong{color:#101c4c}
.etiquette{color:#c1121f}.titre-theme{border:0;font-size:2.6rem;margin-bottom:.5rem}.compte{max-width:44rem}
.selecteur span{border:1px solid #101c4c;color:#101c4c}.selecteur .actif{background:#101c4c;color:#fff}
.carte{border:1px solid #d9dce6;border-top:4px solid #16308f}.portrait{border:1px solid #101c4c;color:#101c4c;background:#f6f7fb}
.parti{color:#5a607a}.carte h4{color:#c1121f;font-family:system-ui,sans-serif}.relue{color:#5a607a}.source{background:#f6f7fb;border-left:3px solid #101c4c}.source a{color:#16308f}
.carte-vide{border-top-color:#9aa0b8}.vide{color:#5a607a;font-style:italic}.note-photo{color:#5a607a}
.pied{background:#101c4c;color:#fff}.pied a{color:#fff}'''

# B, Affiche : aplats forts, capitales, ombres portées franches.
CSS['b'] = '''body{background:#fff;color:#0b1020;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.entete{background:#fff;border-bottom:4px solid #0b1020}.logo{position:relative;display:grid;place-items:center;width:2.9rem;height:2.9rem;background:#1535c9;border-radius:8px;box-shadow:4px 4px 0 #0b1020}.logo i{display:none}.logo::before{content:"R";color:#fff;font:900 1.7rem/1 system-ui,sans-serif}.logo::after{content:"";position:absolute;right:-.35rem;top:-.35rem;width:.95rem;height:.95rem;border-radius:50%;background:#e0162b;border:2px solid #fff}
.marque strong{font-size:1.45rem;font-weight:900;letter-spacing:-.02em;text-transform:uppercase}.marque small{color:#3b4263}.menu a{text-transform:uppercase;font-size:.88rem;letter-spacing:.06em;font-weight:800}
.hero{background:#1535c9;color:#fff;padding:5rem 0;overflow:hidden}.surtitre{display:inline-block;background:#e0162b;color:#fff;font-weight:800;padding:.35rem .8rem;margin:0 0 1.25rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}
h1{font-size:clamp(2.3rem,5.2vw,4.2rem);line-height:1;margin:0 0 1.25rem;font-weight:900;letter-spacing:-.03em;text-transform:uppercase}.chapo{font-size:1.3rem;max-width:34rem;margin:0}
.bouton{background:#fff;color:#1535c9;border-radius:6px;font-weight:900;text-transform:uppercase;letter-spacing:.03em;box-shadow:6px 6px 0 #e0162b}.lien-fort{color:#fff;font-weight:800}
.hero-deco{height:18rem;position:relative}.hero-deco span{position:absolute;border-radius:50%}.hero-deco span:nth-child(1){left:0;top:0;width:13rem;height:13rem;background:#fff}.hero-deco span:nth-child(2){right:0;bottom:0;width:11rem;height:11rem;background:#e0162b}.hero-deco span:nth-child(3){left:6rem;top:6.5rem;width:7rem;height:7rem;background:#0b1020}
.garanties{background:#0b1020;color:#fff;padding:2rem 0}.garanties b{font-weight:900;text-transform:uppercase;font-size:.95rem;border-bottom:3px solid #e0162b;display:table;padding-bottom:.15rem;margin-bottom:.5rem}.garanties li{font-size:.98rem}
h2{font-size:2.4rem;font-weight:900;letter-spacing:-.02em;text-transform:uppercase;margin:0 0 1.5rem}h2::after{content:"";display:block;width:4.5rem;height:8px;background:#e0162b;margin-top:.5rem}
.tuile{border-radius:10px;color:#fff;background:#1535c9}.tuile strong{font-weight:900;text-transform:uppercase;font-size:1.8rem;letter-spacing:-.02em}.tuile-num{font-weight:900;font-size:.9rem}.tuile-ouverte{background:#e0162b;box-shadow:8px 8px 0 #0b1020}.tuile-avenir{background:#e9ecf7;color:#3b4263}
.bloc-alt{background:#eef1fb}.niveaux div{background:#fff;border-radius:10px;padding:1.1rem;border:3px solid #0b1020}.niveaux strong{font-weight:900;text-transform:uppercase;font-size:.98rem}
.etiquette{color:#c1121f}.titre-theme{font-size:3.4rem}.compte{max-width:44rem;font-weight:500}
.selecteur span{border:3px solid #0b1020;border-radius:99px;font-weight:800}.selecteur .actif{background:#0b1020;color:#fff}
.carte{border:3px solid #0b1020;border-radius:12px;box-shadow:8px 8px 0 #1535c9}.portrait{border-radius:50%;background:#1535c9;color:#fff;border:3px solid #0b1020}
.carte h3{font-weight:900;font-size:1.45rem}.parti{color:#3b4263;font-weight:600}.carte h4{color:#1535c9;text-transform:uppercase;font-weight:900;font-size:.95rem;letter-spacing:.03em}.mesure{font-weight:500}.relue{color:#3b4263}
.source{background:#eef1fb;border-radius:8px}.source a{color:#1535c9;font-weight:700}
.carte-vide{box-shadow:8px 8px 0 #c9cee3}.carte-vide .portrait{background:#c9cee3;color:#0b1020}.vide{color:#3b4263;font-weight:600}.note-photo{color:#3b4263}
.pied{background:#0b1020;color:#fff}.pied a{color:#fff;font-weight:700}'''

# C, Atelier : papier crème, encre bleue, rouge corail, formes arrondies, ombres douces.
CSS['c'] = '''body{background:#f6f1e7;color:#232a45;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1,h2,h3,.tuile strong,.marque strong,.niveaux strong{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;color:#1c2759;font-weight:600;letter-spacing:-.01em}
.logo{display:flex;gap:3px;align-items:flex-end;height:2.2rem}.logo i{width:.62rem;border-radius:99px}.logo i:nth-child(1){height:100%;background:#2b3f9e}.logo i:nth-child(2){height:62%;background:#fffdf8;border:1.5px solid #cfc6b4}.logo i:nth-child(3){height:82%;background:#b5362a}
.marque strong{font-size:1.4rem}.marque small{color:#5d6480}.menu{gap:.25rem}.menu a{color:#1c2759;padding:.4rem .9rem;border-radius:99px}
.hero{padding:4rem 0 3rem}.surtitre{display:inline-block;background:#e6ebfa;color:#2b3f9e;font-weight:600;padding:.35rem .9rem;border-radius:99px;margin:0 0 1.25rem;font-size:.88rem}
h1{font-size:clamp(2.2rem,4.8vw,3.7rem);line-height:1.08;margin:0 0 1.25rem}.chapo{font-size:1.25rem;max-width:35rem;margin:0;color:#3b4263}
.bouton{background:#b5362a;color:#fff;border-radius:99px;box-shadow:0 6px 18px rgba(181,54,42,.28)}.lien-fort{color:#2b3f9e;font-weight:600;text-underline-offset:.25em}
.hero-deco{height:17rem;display:flex;gap:1rem;align-items:flex-end;justify-content:center;background:#fffdf8;border-radius:28px;padding:1.75rem;box-shadow:0 10px 30px rgba(35,42,69,.08)}.hero-deco span{flex:1;border-radius:99px}.hero-deco span:nth-child(1){height:100%;background:#2b3f9e}.hero-deco span:nth-child(2){height:60%;background:#f6f1e7;border:2px solid #dcd3c0}.hero-deco span:nth-child(3){height:80%;background:#b5362a}
.garanties{padding:1rem 0 2rem}.garanties li{background:#fffdf8;border-radius:20px;padding:1.25rem 1.4rem;box-shadow:0 6px 20px rgba(35,42,69,.06);font-size:.98rem}.garanties b{color:#b5362a;font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.15rem;font-weight:600}
h2{font-size:2.1rem;margin:0 0 1.5rem}
.tuile{background:#fffdf8;border-radius:24px;color:#232a45;box-shadow:0 8px 24px rgba(35,42,69,.07)}.tuile-num{color:#b5362a;font-weight:700;font-size:.85rem}.tuile-ouverte{background:#2b3f9e;color:#fff}.tuile-ouverte strong{color:#fff}.tuile-ouverte .tuile-num{color:#fff}.tuile-ouverte em{align-self:flex-start;background:#fff;color:#2b3f9e;padding:.35rem 1rem;border-radius:99px}.tuile-avenir{background:transparent;box-shadow:none;border:2px dashed #cfc6b4;color:#5d6480}.tuile-avenir strong{color:#5d6480}
.bloc-alt{background:#efe8d9;border-radius:36px;margin:0 1rem}.niveaux div{background:#fffdf8;border-radius:20px;padding:1.2rem}.niveaux strong{font-size:1.15rem}.niveaux p{color:#3b4263}
.etiquette{color:#b5362a}.titre-theme{font-size:2.8rem;margin-bottom:.5rem}.compte{max-width:44rem;color:#3b4263}
.selecteur{background:#efe8d9;display:inline-flex;padding:.35rem;border-radius:28px}.selecteur span{border-radius:99px;color:#3b4263}.selecteur .actif{background:#fffdf8;color:#1c2759;box-shadow:0 2px 8px rgba(35,42,69,.12)}
.carte{background:#fffdf8;border-radius:24px;box-shadow:0 10px 30px rgba(35,42,69,.08)}.portrait{border-radius:50%;background:#e6ebfa;color:#2b3f9e;box-shadow:0 0 0 3px #fffdf8,0 0 0 5px #2b3f9e}
.parti{color:#5d6480}.carte h4{color:#b5362a;font-family:system-ui,sans-serif;font-weight:600}.relue{color:#5d6480}
.source{background:#f6f1e7;border-radius:16px}.source-titre{color:#2b3f9e}.source a{color:#2b3f9e}
.carte-vide{background:transparent;box-shadow:none;border:2px dashed #cfc6b4}.carte-vide .portrait{box-shadow:0 0 0 3px #f6f1e7,0 0 0 5px #b9b09c;background:#efe8d9;color:#5d6480}.vide{color:#5d6480}.note-photo{color:#5d6480}
.pied{margin-top:2rem;background:#1c2759;color:#fff;border-radius:36px 36px 0 0}.pied a{color:#fff}'''

# D, Synthèse A+B (troisième version, après deux tours de test A/B du 2026-11-23, lecteurs simulés).
# Base : A (fond blanc, titres à empattements, casse normale, bleu nuit).
# Repris de B, parce que les lecteurs l'ont demandé : pastilles épaisses, cadres nets et arrondis,
# encadré de source teinté à liens gras, graisses plus fortes, bouton plus gros.
# Écarté de B, parce que lu comme « tract » ou « publicité » aux deux tours : capitales sur les titres,
# aplats de bleu vif, ombres décalées, tuile rouge, point rouge du logo, bandeau sombre à petit texte blanc.
# Corrigé dans A : filet tricolore de l'en-tête (lu comme drapeau ou site de l'État), titre de mesure rouge
# (lu comme alerte), cartes inégales entre candidats, mention de relecture pâle, thèmes à venir en pointillés,
# petites capitales rouges, gris pâles.
CSS['d'] = '''body{background:#fff;color:#161a2b;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1,h2,h3,.tuile strong,.marque strong{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:700;color:#101c4c;letter-spacing:-.01em}
.entete{border-bottom:3px solid #101c4c}.logo{display:grid;place-items:center;width:2.7rem;height:2.7rem;background:#101c4c;border-radius:8px;border-bottom:5px solid #c1121f}.logo i{display:none}.logo::before{content:"R";color:#fff;font:700 1.55rem/1 "Iowan Old Style",Palatino,Georgia,serif}
.marque strong{font-size:1.45rem}.marque small{color:#3b4263}.menu a{color:#101c4c;font-weight:700}
.hero{padding:4.5rem 0 4rem}.surtitre{display:inline-block;color:#101c4c;font-weight:700;padding:.15rem 0 .15rem .8rem;border-left:6px solid #c1121f;margin:0 0 1.25rem;font-size:.95rem}
h1{font-size:clamp(2.15rem,5vw,3.9rem);line-height:1.06;margin:0 0 1.25rem}.chapo{font-size:1.3rem;max-width:35rem;margin:0}
.bouton{background:#101c4c;color:#fff;border-radius:10px;font-weight:800;font-size:1.08rem;padding:1rem 1.6rem}.lien-fort{color:#101c4c;font-weight:700;text-underline-offset:.25em;text-decoration-color:#c1121f;text-decoration-thickness:2px}
.hero-deco{border-left:6px solid #c1121f;padding:.5rem 0 .5rem 1.75rem}.hero-deco span{display:none}.hero-deco::before{content:"2027";display:block;font:700 clamp(4rem,9vw,7.5rem)/.9 "Iowan Old Style",Palatino,Georgia,serif;color:#16308f;letter-spacing:-.03em}.hero-deco::after{content:"1er tour le 18 avril, 2d tour le 2 mai";display:block;margin-top:.9rem;font:700 1.05rem system-ui,sans-serif;color:#101c4c}
.garanties{background:#f3f5fc;border-block:1px solid #d5daea;padding:2rem 0}.garanties b{color:#101c4c;font-weight:800;font-size:1.08rem;border-bottom:3px solid #c1121f;display:table;padding-bottom:.15rem;margin-bottom:.5rem}.garanties li{font-size:1rem}
h2{font-size:2.15rem;margin:0 0 1.5rem}h2::after{content:"";display:block;width:4rem;height:5px;background:#c1121f;margin-top:.5rem}
.tuile{border:2px solid #101c4c;border-radius:12px;color:#101c4c}.tuile-num{font:800 .85rem system-ui,sans-serif;color:#c1121f}.tuile-ouverte{background:#101c4c;color:#fff}.tuile-ouverte strong{color:#fff}.tuile-ouverte .tuile-num{color:#fff}.tuile-ouverte em{align-self:flex-start;background:#fff;color:#101c4c;padding:.45rem 1.2rem;border-radius:99px}.tuile-avenir{background:#f3f5fc;border-color:#c3cae0;color:#2a3050}.tuile-avenir .tuile-num{color:#2a3050}
.bloc-alt{background:#f3f5fc}.niveaux div{border-top:4px solid #101c4c;padding-top:.9rem}.niveaux strong{color:#101c4c;font-weight:800;font-size:1.05rem}
.etiquette{color:#3b4263;text-transform:none;letter-spacing:0;font-size:.95rem}.titre-theme{font-size:2.9rem;margin-bottom:.5rem}.titre-theme::after{display:none}.compte{max-width:44rem}
.selecteur span{border:2px solid #101c4c;border-radius:99px;color:#101c4c;font-weight:700;padding:.7rem 1.2rem;font-size:1rem;text-align:center}.selecteur .actif{background:#101c4c;color:#fff}
.carte{border:2px solid #101c4c;border-radius:14px}.portrait{border-radius:50%;background:#f3f5fc;color:#101c4c;border:2px solid #101c4c}
.carte h3{font-size:1.4rem}.parti{color:#3b4263}.carte h4{color:#101c4c;font-weight:800;font-size:1.12rem}.relue{color:#161a2b;font-size:.95rem;font-weight:600}
.source{background:#f3f5fc;border-radius:10px;border-left:5px solid #101c4c;font-size:.95rem}.source-titre{text-transform:none;letter-spacing:0;font-size:.95rem;color:#101c4c}.source a{color:#16308f;font-weight:700}
.vide{color:#161a2b}.note-photo{color:#3b4263;font-size:.9rem}
.pied{background:#101c4c;color:#fff}.pied a{color:#fff;font-weight:600}
@media (max-width:760px){.hero{padding:2.5rem 0}.selecteur{display:grid;grid-template-columns:1fr 1fr}.selecteur span{padding:.7rem .4rem;font-size:.95rem;white-space:nowrap}.tuile-avenir{min-height:0;padding:1.1rem 1.5rem}}'''

TETE = '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>%s</title><style>%s</style></head><body>\n%s\n</body></html>\n'

for l in sorted(NOMS):
    with open(os.path.join(D, l + '.html'), 'w', encoding='utf-8') as f:
        f.write(TETE % ('Maquette ' + NOMS[l] + ' : Révèle ton prog', BASE + '\n' + CSS[l], corps(l)))

INDEX = '''<h1>Maquettes de charte bleu blanc rouge</h1><p>Trois directions et une synthèse, même contenu réel du site. Aucune n'est en ligne.</p>
<ul><li><a href="a.html">A · Tribune</a> : sobre, éditorial, filet tricolore.</li><li><a href="b.html">B · Affiche</a> : aplats forts, capitales, énergie.</li><li><a href="c.html">C · Atelier</a> : chaleureux, papier crème, arrondis.</li><li><a href="d.html">D · Synthèse A+B</a> : base de A, corrigée par le test, avec les pastilles, cadres et encadrés de source de B.</li></ul>'''
with open(os.path.join(D, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(TETE % ('Maquettes de charte bleu blanc rouge', 'body{font:1.05rem/1.6 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1.25rem}a{font-weight:700}', INDEX))
print('écrit :', ', '.join(sorted(x for x in os.listdir(D) if x.endswith('.html'))))
