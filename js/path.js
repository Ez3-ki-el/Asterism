/* Asterism : Chemin entre deux artistes de la carte.
   « Chemin vers… » (menu d'un artiste) : on clique ensuite l'artiste d'arrivee, la carte surligne la chaine qui les relie
   et estompe le reste. Le chemin ne passe que par des liens affiches ; a nombre d'etapes egal, il prefere les meilleurs scores.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale. */
'use strict';

var pathPick = null;   /* artiste de depart, en attente du clic sur l'arrivee */
var pathSel = null;    /* chemin affiche : { list: [noeuds], ids: Set, keys: Set } */

function linkKeyOf(a, b) { return a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id; }

/* Dijkstra sur les liens visibles : chaque etape coute 1, plus jusqu'a 0,5 selon la faiblesse du score. */
function findPath(a, b) {
  var nb = new Map();
  links.forEach(function (lk) {
    if (!ekOf(lk)) return;
    var s = byId.get(idOf(lk.source)), t = byId.get(idOf(lk.target));
    if (!s || !t || !isShown(s) || !isShown(t)) return;
    var c = 1 + 0.5 * (1 - (lk.w || 0));
    if (!nb.has(s.id)) nb.set(s.id, []);
    if (!nb.has(t.id)) nb.set(t.id, []);
    nb.get(s.id).push([t.id, c]); nb.get(t.id).push([s.id, c]);
  });
  var dist = new Map([[a.id, 0]]), prev = new Map(), done = new Set();
  while (true) {
    var u = null, best = Infinity;
    dist.forEach(function (d, id) { if (!done.has(id) && d < best) { best = d; u = id; } });
    if (u === null) return null;
    if (u === b.id) break;
    done.add(u);
    (nb.get(u) || []).forEach(function (e) {
      var nd = best + e[1];
      if (!done.has(e[0]) && nd < (dist.has(e[0]) ? dist.get(e[0]) : Infinity)) { dist.set(e[0], nd); prev.set(e[0], u); }
    });
  }
  var out = [b.id];
  while (out[0] !== a.id) out.unshift(prev.get(out[0]));
  return out.map(function (id) { return byId.get(id); });
}

function startPathPick(n) {
  clearPath(true);
  pathPick = n;
  renderPathBar();
  draw();
}
/* Appele au clic sur un artiste : vrai si le clic a servi a choisir l'arrivee. */
function pathClick(n) {
  if (!pathPick) return false;
  var a = pathPick;
  pathPick = null;
  if (n === a || byId.get(a.id) !== a) { renderPathBar(); draw(); return true; }
  var list = findPath(a, n);
  if (!list) {
    renderPathBar(); draw();
    toast(T('Aucun chemin entre {a} et {b} sur la carte actuelle : explore quelques artistes entre les deux, puis réessaie.', { a: a.name, b: n.name }));
    return true;
  }
  var keys = new Set();
  for (var i = 1; i < list.length; i++) keys.add(linkKeyOf(list[i - 1], list[i]));
  pathSel = { list: list, ids: new Set(list.map(function (m) { return m.id; })), keys: keys };
  renderPathBar();
  fitPath();
  draw();
  return true;
}
function clearPath(silent) {
  var had = pathPick || pathSel;
  pathPick = null; pathSel = null;
  if (!silent) { renderPathBar(); if (had) draw(); }
  return !!had;
}
/* Un chemin dont un artiste a disparu (suppression, annulation) n'a plus de sens : on le retire. */
function pathAlive() {
  if (pathSel && pathSel.list.some(function (m) { return byId.get(m.id) !== m; })) { pathSel = null; renderPathBar(); }
  if (pathPick && byId.get(pathPick.id) !== pathPick) { pathPick = null; renderPathBar(); }
  return pathSel;
}
function fitPath() {
  if (!pathSel) return;
  var xs = pathSel.list.map(function (m) { return m.x; }), ys = pathSel.list.map(function (m) { return m.y; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var pad = W < 640 ? 50 : 140;
  var k = Math.max(0.15, Math.min(2, (W - 2 * pad) / Math.max(x1 - x0, 1), (H - 2 * pad) / Math.max(y1 - y0, 1)));
  var t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  sel.transition().duration(700).call(zoom.transform, t);
}
function listenPath() {
  if (!pathSel) return;
  tour = { name: pathSel.list[0].name, list: pathSel.list.slice(), i: -1 };
  tourGo(1);
}

function renderPathBar() {
  var box = el('pathbar');
  document.body.classList.toggle('haspath', !!(pathPick || pathSel));
  box.textContent = '';
  if (!pathPick && !pathSel) { box.hidden = true; return; }
  box.hidden = false;
  function button(label, fn, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', fn);
    return b;
  }
  var row = document.createElement('div'); row.className = 'pbtns';
  if (pathPick) {
    var p = document.createElement('div'); p.className = 'ph';
    p.textContent = T('Chemin depuis {name} : clique l’artiste d’arrivée sur la carte.', { name: pathPick.name });
    row.appendChild(button(T('Annuler'), function () { clearPath(); }));
    box.append(p, row);
    return;
  }
  var steps = pathSel.list.length - 1;
  var h = document.createElement('div'); h.className = 'ph';
  h.textContent = T(steps > 1 ? 'Chemin en {n} étapes' : 'Chemin en {n} étape', { n: steps });
  var chain = document.createElement('div'); chain.className = 'pchain';
  pathSel.list.forEach(function (m, i) {
    if (i) { var s = document.createElement('span'); s.className = 'sep'; s.textContent = '→'; chain.appendChild(s); }
    chain.appendChild(button(m.name, function () { select(m); if (typeof ensureOnScreen === 'function') ensureOnScreen(m); }, 'link'));
  });
  row.append(button(T('Écouter le chemin'), listenPath), button(T('Fermer'), function () { clearPath(); }));
  box.append(h, chain, row);
}
