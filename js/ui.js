/* Asterism : Recherche, reglages, bulles, zoom, aide, clavier, theme, Surprends-moi.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Recherche ---------- */
var q = document.getElementById('q'), results = document.getElementById('results');
var qTimer = null, qList = [], qSel = -1;

function renderResults() {
  results.textContent = '';
  qList.forEach(function (a, i) {
    var li = document.createElement('li');
    if (i === qSel) li.className = 'sel';
    var img = document.createElement('img'); img.src = a.picture_small || ''; img.alt = '';
    var name = document.createElement('span'); name.textContent = a.name;
    var fans = document.createElement('small');
    fans.textContent = typeof a.nb_fan === 'number' ? T('{n} fans', { n: loc(a.nb_fan) }) : '';
    li.append(img, name, fans);
    li.addEventListener('mousedown', function (ev) { ev.preventDefault(); pick(a); });
    results.appendChild(li);
  });
  results.style.display = qList.length ? 'block' : 'none';
}

function pick(a) { q.value = ''; qList = []; qSel = -1; renderResults(); addRoot(a); }

q.addEventListener('input', function () {
  clearTimeout(qTimer);
  var v = q.value.trim();
  if (!v) { qList = []; renderResults(); return; }
  qTimer = setTimeout(async function () {
    try {
      var d = await dz('/search/artist?q=' + encodeURIComponent(v) + '&limit=6');
      if (q.value.trim() !== v) return;
      qList = d.data || []; qSel = qList.length ? 0 : -1; renderResults();
    } catch (e) { toast(T('Erreur Deezer : {m}', { m: T(e.message) })); }
  }, 250);
});
q.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowDown' && qList.length) { qSel = (qSel + 1) % qList.length; renderResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && qList.length) { qSel = (qSel - 1 + qList.length) % qList.length; renderResults(); e.preventDefault(); }
  else if (e.key === 'Enter' && qList[qSel]) { pick(qList[qSel]); }
  else if (e.key === 'Escape') { qList = []; renderResults(); q.blur(); }
});
q.addEventListener('blur', function () { setTimeout(function () { qList = []; renderResults(); }, 100); });

function addRoot(a, skipCommit) {
  if (!skipCommit) commit();
  var first = nodes.length === 0;
  var c = transform.invert([W / 2, H / 2]);
  var n = ensureNode(a, c[0], c[1]);
  n.root = true;
  refresh();
  select(n);
  expand(n, true);
  try { history.replaceState(null, '', '#' + encodeURIComponent(a.name)); } catch (e) { dbg('ignore', e); }
  if (first) setTimeout(fit, 1500);
  firstVisitHint();
}

async function searchAndAdd(name) {
  try {
    var d = await dz('/search/artist?q=' + encodeURIComponent(name) + '&limit=1');
    if (d.data && d.data[0]) addRoot(d.data[0]); else toast(T('Aucun artiste trouvé pour {name}', { name: name }));
  } catch (e) { toast(T('Erreur Deezer : {m}', { m: T(e.message) })); }
}

/* ---------- Panneau et divers ---------- */
/* Bulle de retour d'action : disparait seule (plus longtemps si elle porte un bouton, comme Annuler). */
var toastTimer = null;
function hideToast() { clearTimeout(toastTimer); el('toast').hidden = true; }
function toast(text, label, fn, ms) {
  var t = el('toast');
  t.textContent = text;
  if (label) {
    t.append(' · ');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'link'; b.textContent = label;
    b.addEventListener('click', function () { hideToast(); fn(); });
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms || (label ? 7000 : 3800));
}
/* Message d'accueil, une seule fois : le double-clic est le geste le moins visible. */
function firstVisitHint() {
  var seen = false;
  try { seen = localStorage.getItem('mg-hint') === '1'; } catch (e) { dbg('ignore', e); }
  if (seen) return;
  try { localStorage.setItem('mg-hint', '1'); } catch (e) { dbg('ignore', e); }
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  setTimeout(function () {
    toast(T(coarse ? 'Touche deux fois un artiste pour voir ses voisins. Appui long : menu.'
      : 'Double-clique un artiste pour voir ses voisins. « ? » ouvre l’aide.'), null, null, 9000);
  }, 1800);
}
function setStatus(t, label, fn, kind) {
  var s = document.getElementById('status');
  s.dataset.kind = kind || 'msg';
  s.textContent = t;
  s.style.pointerEvents = 'none';
  if (label) {
    s.append(' · ');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'link'; b.textContent = label;
    b.addEventListener('click', fn);
    s.appendChild(b);
    s.style.pointerEvents = 'auto';
  }
}

function fit() {
  if (!nodes.length) return;
  var xs = nodes.map(function (n) { return n.x; }), ys = nodes.map(function (n) { return n.y; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var pad = W < 640 ? 34 : 90;
  var k = Math.min(2, (W - 2 * pad) / Math.max(x1 - x0, 1), (H - 2 * pad) / Math.max(y1 - y0, 1));
  k = Math.max(0.15, k);
  var t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  sel.transition().duration(700).call(zoom.transform, t);
}

var FOCUS_LABELS = ['Tout', '1 saut', '2 sauts', '3 sauts'];
document.getElementById('focus').addEventListener('input', function (e) {
  focusDepth = +e.target.value;
  document.getElementById('focusv').textContent = T(FOCUS_LABELS[focusDepth]);
  recomputeVisible(); draw();
  if (focusDepth > 0 && !selected) toast(T('Clique sur un nœud pour choisir le centre du focus'));
});
document.getElementById('dist').addEventListener('input', function (e) {
  document.getElementById('distv').textContent = e.target.value;
  sim.force('link').distance(+e.target.value); sim.alpha(0.5).restart();
});
document.getElementById('fit').addEventListener('click', fit);
function clearGraph() {
  gen++;
  stopTour();
  clearPath();
  xjobs.length = 0; renderProg();
  hovered = null; selected = null; visible = null; stopAudio();
  nodes.length = 0; links.length = 0; byId.clear(); adj.clear(); linkKeys.clear();
  refresh(); renderCard();
  try { history.replaceState(null, '', location.pathname); } catch (e) { dbg('ignore', e); }
  draw();
}
document.getElementById('clear').addEventListener('click', function () {
  if (!nodes.length) return;
  commit(); clearGraph();
  toast(T('Carte effacée'), T('Annuler'), undo);
});
el('undo').addEventListener('click', undo);
el('redo').addEventListener('click', redo);

var surprising = false, SYL_C = 'bcdfgklmnprstvz', SYL_V = 'aeiou';
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomSyllable() {
  var s = randomOf(SYL_C) + randomOf(SYL_V);
  if (Math.random() < 0.5) s += randomOf(SYL_C + 'n');
  return s;
}

/* Le point d'acces "genre" de Deezer renvoie les memes 50 artistes pour tous les genres :
   on tire donc une syllabe au hasard, on cherche, on prend un decalage au hasard dans les
   resultats, puis on fait un saut vers un voisin. Un artiste sans voisins est ecarte. */
async function pickSurprise() {
  for (var attempt = 0; attempt < 6; attempt++) {
    try {
      var q = randomSyllable();
      var probe = await dz('/search/artist?q=' + q + '&limit=1');
      var total = probe.total || 0;
      if (total < 5) continue;
      var index = Math.floor(Math.random() * (Math.max(0, Math.min(total - 50, 300)) + 1));
      var found = (await dz('/search/artist?q=' + q + '&limit=50&index=' + index)).data || [];
      var mid = found.filter(function (x) { return (x.nb_fan || 0) >= 2000 && (x.nb_fan || 0) <= 3000000; });
      var pool = mid.length ? mid : found;
      if (!pool.length) continue;
      var a = randomOf(pool);
      var rel = (await dz('/artist/' + a.id + '/related?limit=20')).data || [];
      if (rel.length < 8) continue;
      var known = rel.filter(function (x) { return (x.nb_fan || 0) >= 1000; });
      var b = randomOf(known.length ? known : rel);
      var rel2 = (await dz('/artist/' + b.id + '/related?limit=20')).data || [];
      return rel2.length >= 5 ? b : a;
    } catch (e) { /* on retente avec une autre syllabe */ }
  }
  return null;
}

async function surprise() {
  if (surprising) return;
  surprising = true;
  var btn = el('surprise');
  btn.disabled = true;
  setStatus(T('Recherche d’un artiste…'));
  try {
    var a = await pickSurprise();
    if (!a) throw new Error(T('aucun artiste trouvé, réessaie'));
    commit(); clearGraph();
    addRoot(a, true);
  } catch (e) {
    toast(T('Erreur Deezer : {m}', { m: T(e.message) }));
  } finally {
    surprising = false;
    btn.disabled = false;
  }
}
el('surprise').addEventListener('click', surprise);
/* Zoom et aide */
function zoomBy(f) { sel.transition().duration(220).call(zoom.scaleBy, f); }
el('zin').addEventListener('click', function () { zoomBy(1.5); });
el('zout').addEventListener('click', function () { zoomBy(1 / 1.5); });
function showHelp() { hideMenu(); hideNodeTip(); el('help').hidden = false; el('helpx').focus(); }
function hideHelp() { el('help').hidden = true; }
el('helpbtn').addEventListener('click', function () { if (el('help').hidden) showHelp(); else hideHelp(); });
el('helpx').addEventListener('click', hideHelp);
document.addEventListener('pointerdown', function (e) {
  var h = el('help');
  if (!h.hidden && !h.contains(e.target) && !el('helpbtn').contains(e.target)) hideHelp();
});

/* Clavier : on passe a l'artiste le plus proche dans la direction de la fleche (a +-60 degres environ). */
function ensureOnScreen(m) {
  var p = transform.apply([m.x, m.y]);
  if (p[0] < 50 || p[0] > W - 50 || p[1] < 90 || p[1] > H - 50) sel.transition().duration(300).call(zoom.translateTo, m.x, m.y);
}
function moveSelection(dx, dy) {
  var from = selected;
  if (!from) {
    var start = nodes.filter(function (m) { return m.root && vis(m); })[0] || nodes.filter(vis)[0];
    if (start) { select(start); ensureOnScreen(start); }
    return;
  }
  var best = null, bs = Infinity;
  nodes.forEach(function (m) {
    if (m === from || !vis(m)) return;
    var vx = m.x - from.x, vy = m.y - from.y, d = Math.hypot(vx, vy);
    if (!d) return;
    var cos = (vx * dx + vy * dy) / d;
    if (cos < 0.5) return;
    if (d / cos < bs) { bs = d / cos; best = m; }
  });
  if (best) { select(best); ensureOnScreen(best); }
}
window.addEventListener('keydown', function (e) {
  if (document.activeElement === q) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    var kk = e.key.toLowerCase();
    if (kk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (kk === 'y' || (kk === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
    return;
  }
  if (e.key === 'Escape') {
    if (!el('mylist').hidden) closeMyList(); else if (!el('help').hidden) hideHelp(); else if (clearPath()) { /* chemin retire */ } else { hideMenu(); select(null); }
    return;
  }
  var tg = e.target, tag = (tg && tg.tagName) || '';
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (tg && tg.isContentEditable) || e.altKey) return;
  var onCtl = /^(BUTTON|SUMMARY|A)$/.test(tag);
  if (e.key === '/') { e.preventDefault(); q.focus(); q.select(); }
  else if (e.key === '?') { if (el('help').hidden) showHelp(); else hideHelp(); }
  else if (e.key === '+' || e.key === '=') zoomBy(1.5);
  else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.5);
  else if (e.key === 'Delete' && selected) removeNode(selected);
  else if (!onCtl && e.key === 'ArrowRight') { e.preventDefault(); moveSelection(1, 0); }
  else if (!onCtl && e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(-1, 0); }
  else if (!onCtl && e.key === 'ArrowDown') { e.preventDefault(); moveSelection(0, 1); }
  else if (!onCtl && e.key === 'ArrowUp') { e.preventDefault(); moveSelection(0, -1); }
  else if (!onCtl && e.key === 'Enter' && selected && !selected.expanded && !selected.loading) { e.preventDefault(); expand(selected); renderCard(); }
});
window.addEventListener('resize', resize);

['Radiohead', 'Daft Punk', 'Miles Davis', 'Björk', 'Nina Simone', 'Aphex Twin'].forEach(function (name) {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'link'; b.textContent = name;
  b.addEventListener('click', function () { searchAndAdd(name); });
  document.getElementById('chips').appendChild(b);
});
(function () {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'link'; b.textContent = 'Surprends-moi';
  b.addEventListener('click', surprise);
  document.getElementById('chips').appendChild(b);
})();

/* Page d'accueil : artistes du moment (classement Deezer) et un artiste au hasard par genre Deezer. */
function homeChip(label, box, fn) {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'link'; b.textContent = label;
  b.addEventListener('click', function () { fn(b); });
  el(box).appendChild(b);
}
/* Un artiste au hasard dans un genre. La route Deezer /genre/{id}/artists renvoie le classement general quel que soit
   le genre (constate le 2026-11-22 : Metal donnait Koba LaD) : on passe par la radio Deezer du genre, dont les titres
   respectent le genre. Radio au nom du genre de preference, sinon la premiere ; puis un artiste tire parmi ses titres. */
async function randomOfGenre(gid, gname, btn) {
  btn.disabled = true;
  try {
    var radios = ((await dz('/genre/' + gid + '/radios')).data || []).filter(function (x) { return x && x.id; });
    if (!radios.length) throw new Error(T('aucun artiste trouvé, réessaie'));
    /* Radios d'evenement (festivals, annees, chaines) ecartees ; puis le nom exact du genre, sinon un nom qui le contient
       (Classiques du rock, Electronic...), sinon une des premieres radios du genre. */
    var junk = /festival|\b(19|20)\d\d\b|mtv|weather|nuits|parisien|t[eé]l[eé]rama|magazine|test|ina musique|victoires|home/i;
    var ok = radios.filter(function (x) { return !junk.test(x.title || ''); });
    if (!ok.length) ok = radios;
    var gn = normName(gname), stem = (gn.split(' ').filter(function (w) { return w.length >= 4; })[0] || gn).slice(0, 5);
    var pickFrom = ok.filter(function (x) { return normName(x.title) === gn; });
    if (!pickFrom.length) pickFrom = ok.filter(function (x) { return normName(x.title).indexOf(stem) >= 0; });
    if (!pickFrom.length) pickFrom = ok.slice(0, 3);
    var radio = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    var tracks = (await dz('/radio/' + radio.id + '/tracks?limit=40')).data || [];
    var pool = new Map();
    tracks.forEach(function (t) { if (t.artist && t.artist.id) pool.set(t.artist.id, t.artist); });
    var ids = Array.from(pool.keys());
    if (!ids.length) throw new Error(T('aucun artiste trouvé, réessaie'));
    var pick = pool.get(ids[Math.floor(Math.random() * ids.length)]);
    var full = await dz('/artist/' + pick.id).catch(function () { return null; });
    addRoot(full && full.id ? full : pick);
  } catch (e) {
    toast(T('Erreur Deezer : {m}', { m: T(e.message) }));
  } finally { btn.disabled = false; }
}
dz('/chart/0/artists?limit=8').then(function (r) {
  var list = ((r && r.data) || []).filter(function (a) { return a && a.id && a.name; });
  if (!list.length) return;
  list.forEach(function (a) { homeChip(a.name, 'trend', function () { addRoot(a); }); });
  el('trendh').hidden = false;
}, function (e) { dbg('classement deezer', e); });
dz('/genre').then(function (r) {
  var list = ((r && r.data) || []).filter(function (x) { return x && x.id > 0 && x.name && !/livre|audio ?book|enfant|kid|film|jeu|game|podcast/i.test(x.name); }).slice(0, 14);
  if (!list.length) return;
  list.forEach(function (x) { homeChip(x.name, 'genres', function (b) { randomOfGenre(x.id, x.name, b); }); });
  el('genreh').hidden = false;
}, function (e) { dbg('genres deezer', e); });

var themeBtn = document.getElementById('theme');
function themeLabel() {
  var txt = document.documentElement.getAttribute('data-theme') === 'dark' ? T('Mode clair') : T('Mode sombre');
  themeBtn.textContent = txt;
  el('theme2').textContent = txt;
}
el('theme2').addEventListener('click', function () { themeBtn.click(); });
themeBtn.addEventListener('click', function () {
  var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('mg-theme', next); } catch (e) { dbg('ignore', e); }
  loadTheme(); themeLabel(); draw();
});
if (window.matchMedia) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    var stored = null;
    try { stored = localStorage.getItem('mg-theme'); } catch (err) { dbg('ignore', err); }
    if (stored) return;
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    loadTheme(); themeLabel(); draw();
  });
}
themeLabel();
historyUI();
if (window.innerWidth < 700) document.getElementById('panel').open = false;
el('clinks').open = window.innerWidth >= 700;
document.addEventListener('pointerdown', function (e) {
  var p = document.getElementById('panel');
  if (p.open && window.innerWidth < 700 && !p.contains(e.target)) p.open = false;
});
