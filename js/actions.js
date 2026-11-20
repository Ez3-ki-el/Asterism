/* Asterism : Menu contextuel, historique annuler et retablir, partage par lien et image PNG.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Menu contextuel (clic droit) ---------- */
var menu = document.createElement('ul');
menu.id = 'menu'; menu.className = 'box'; menu.hidden = true; menu.setAttribute('role', 'menu');
app.appendChild(menu);

function hideMenu() { menu.hidden = true; }

/* ---------- Historique : annuler / retablir ---------- */
var undoStack = [], redoStack = [];

function snapshot() {
  return {
    nodes: nodes.map(function (n) {
      return { id: n.id, name: n.name, pic: n.pic, fans: n.fans, expanded: n.expanded,
        root: !!n.root, pinned: !!n.pinned, x: n.x, y: n.y };
    }),
    links: links.map(function (l) {
      return [typeof l.source === 'object' ? l.source.id : l.source,
              typeof l.target === 'object' ? l.target.id : l.target, l.k || 'd', l.w || 0,
              l.ev ? JSON.parse(JSON.stringify(l.ev)) : null];
    }),
    selectedId: selected ? selected.id : null
  };
}

function restore(s) {
  gen++;
  stopTour();
  xjobs.length = 0; renderProg();
  var old = new Map(byId);
  nodes.length = 0; links.length = 0; byId.clear(); adj.clear(); linkKeys.clear();
  s.nodes.forEach(function (d) {
    var n = old.get(d.id);
    if (n) {
      n.deg = 0; n.ext = undefined; n.lightDone = false; n.hold = 0; n.born = 0; n.flash = 0; n.enriching = false;
      nodes.push(n); byId.set(n.id, n); adj.set(n.id, new Set());
    } else {
      n = ensureNode({ id: d.id, name: d.name, picture_medium: d.pic, nb_fan: d.fans }, d.x, d.y);
    }
    n.x = d.x; n.y = d.y; n.vx = 0; n.vy = 0;
    n.expanded = d.expanded; n.root = d.root; n.pinned = d.pinned;
    n.fx = d.pinned ? d.x : null; n.fy = d.pinned ? d.y : null;
  });
  s.links.forEach(function (p) {
    var a = byId.get(p[0]), b = byId.get(p[1]);
    if (a && b) addLink(a, b, p[2], p[3], p[4]);
  });
  hovered = null;
  selected = (s.selectedId != null && byId.get(s.selectedId)) || null;
  if (playing && !byId.has(playing.id)) stopAudio();
  var firstRoot = nodes.filter(function (n) { return n.root; })[0];
  try {
    history.replaceState(null, '', firstRoot ? '#' + encodeURIComponent(firstRoot.name) : location.pathname);
  } catch (e) { dbg('ignore', e); }
  refresh(); renderCard();
  sim.alpha(0.3).restart();
  draw();
}

/* ---------- Partage : lien (carte compressee dans l'adresse) et image PNG ---------- */
var SHARE_BASE = 'https://ez3-ki-el.github.io/Asterism/', DZ_IMG = 'https://cdn-images.dzcdn.net/images/artist/';
function b64u(bytes) {
  var bin = '';
  for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  var bin = atob(str.replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipeBytes(bytes, stream) {
  var r = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await r.arrayBuffer());
}
/* Etat minimal : artistes (identifiant, nom, fans, position, drapeaux, empreinte de l'image Deezer) et liens avec preuves. */
function sharePayload() {
  var idx = new Map();
  var ns = nodes.map(function (n, i) {
    idx.set(n.id, i);
    var m = /\/artist\/([0-9a-f]{32})\//.exec(n.pic || '');
    return [n.id, n.name, typeof n.fans === 'number' ? n.fans : null, Math.round(n.x), Math.round(n.y),
      (n.root ? 1 : 0) | (n.expanded ? 2 : 0), m ? m[1] : ''];
  });
  var ls = [];
  links.forEach(function (l) {
    if (l.hold) return;
    var a = idx.get(idOf(l.source)), b = idx.get(idOf(l.target));
    if (a === undefined || b === undefined) return;
    ls.push([a, b, l.k || 'd', l.ev || 0]);
  });
  return { v: 1, n: ns, l: ls };
}
async function encodeShare() {
  var json = new TextEncoder().encode(JSON.stringify(sharePayload()));
  if (typeof CompressionStream === 'function') return 'z.' + b64u(await pipeBytes(json, new CompressionStream('deflate-raw')));
  return 'u.' + b64u(json);
}
async function decodeShare(str) {
  var raw = unb64u(str.slice(2));
  if (str.charAt(0) === 'z') raw = await pipeBytes(raw, new DecompressionStream('deflate-raw'));
  var p = JSON.parse(new TextDecoder().decode(raw));
  if (!p || p.v !== 1 || !Array.isArray(p.n) || !Array.isArray(p.l)) throw new Error('format');
  /* Le lien vient de n'importe qui : chaque valeur est verifiee avant usage. Les identifiants finissent dans des adresses
     de l'API Deezer (JSONP, execute comme un script) : seuls des entiers positifs sont acceptes. */
  var num = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
  var okNode = function (a) { return Array.isArray(a) && Number.isInteger(a[0]) && a[0] > 0 && typeof a[1] === 'string'; };
  var ids = p.n.slice(0, 2000).map(function (a) { return okNode(a) ? a[0] : null; });
  var nodesOk = [];
  p.n.slice(0, 2000).forEach(function (a) {
    if (!okNode(a)) return;
    var flags = num(a[5], 0);
    nodesOk.push({ id: a[0], name: a[1].slice(0, 200), fans: Number.isFinite(a[2]) && a[2] >= 0 ? a[2] : undefined,
      x: num(a[3], 0), y: num(a[4], 0), root: !!(flags & 1), expanded: !!(flags & 2), pinned: false,
      pic: typeof a[6] === 'string' && /^[0-9a-f]{32}$/.test(a[6]) ? DZ_IMG + a[6] + '/250x250-000000-80-0-0.jpg' : '' });
  });
  if (!nodesOk.length) throw new Error('format');
  var linksOk = [];
  p.l.slice(0, 6000).forEach(function (l) {
    if (!Array.isArray(l)) return;
    var a = ids[l[0]], b = ids[l[1]];
    if (!a || !b || a === b || typeof l[2] !== 'string' || !/^[dlcepri]{1,7}$/.test(l[2])) return;
    linksOk.push([a, b, l[2], 0, cleanEv(l[3])]);
  });
  var root = nodesOk.filter(function (n) { return n.root; })[0];
  return { nodes: nodesOk, links: linksOk, selectedId: root ? root.id : null };
}
/* Preuves d'un lien partage : seules les formes connues sont gardees, avec des types et des bornes verifies. */
function cleanEv(ev) {
  if (!ev || typeof ev !== 'object') return null;
  var out = {};
  if (ev.d && ev.d.from && typeof ev.d.from === 'object') {
    var from = {};
    Object.keys(ev.d.from).slice(0, 20).forEach(function (k) {
      var r = Number(ev.d.from[k]);
      if (/^\d+$/.test(k) && r >= 1 && r <= 100) from[k] = r;
    });
    out.d = { from: from };
  }
  if (ev.l && isFinite(ev.l.score) && Number(ev.l.top) > 0) out.l = { score: Number(ev.l.score), top: Number(ev.l.top), rank: Math.max(0, Number(ev.l.rank) || 0) };
  if (ev.c && isFinite(ev.c.count)) out.c = { count: Math.max(1, Math.min(99, Number(ev.c.count))) };
  if (ev.e && Array.isArray(ev.e.labels)) {
    out.e = { labels: ev.e.labels.slice(0, 5).map(function (x) { return String(x).slice(0, 80); }),
      cos: Math.max(0, Math.min(1, Number(ev.e.cos) || 0)), match: !!ev.e.match, size: Math.max(0, Number(ev.e.size) || 0) };
  }
  if (ev.r && isFinite(ev.r.count)) out.r = { count: Math.max(1, Math.min(50, Number(ev.r.count))) };
  if (ev.p && Array.isArray(ev.p.rels)) {
    out.p = { rels: ev.p.rels.slice(0, 5).filter(function (r) { return r && typeof r.t === 'string'; })
      .map(function (r) { return { t: r.t.slice(0, 30), s: String(r.s).slice(0, 120), o: String(r.o).slice(0, 120) }; }) };
  }
  if (ev.i && Array.isArray(ev.i.rels)) {
    out.i = { rels: ev.i.rels.slice(0, 5).filter(function (r) { return r && r.s && r.o; })
      .map(function (r) { return { s: String(r.s).slice(0, 120), o: String(r.o).slice(0, 120) }; }) };
  }
  return Object.keys(out).length ? out : null;
}
async function loadShared(str) {
  try {
    var snap = await decodeShare(str);
    restore(snap);
    toast(T('Carte partagée chargée : {n} artistes', { n: snap.nodes.length }));
    setTimeout(fit, 700);
  } catch (e) {
    dbg('lien de partage', e);
    toast(T('Lien de partage illisible'));
  }
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise(function (resolve, reject) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? resolve() : reject(new Error('copie')); } catch (e) { reject(e); } finally { ta.remove(); }
  });
}
el('share').addEventListener('click', async function () {
  if (!nodes.length) { toast(T('Rien à partager : la carte est vide')); return; }
  try {
    var base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE;
    var url = base + '#s=' + await encodeShare();
    if (url.length > 60000) { toast(T('Carte trop grande pour un lien : utilise l’image PNG')); return; }
    try { await copyText(url); toast(T('Lien copié : {n} artistes, {k} liens', { n: nodes.length, k: links.length })); }
    catch (e) { window.prompt(T('Copie ce lien :'), url); }
  } catch (e) { toast(T('Partage impossible : {m}', { m: e.message })); }
});
el('png').addEventListener('click', function () {
  if (!nodes.length) { toast(T('Rien à exporter : la carte est vide')); return; }
  draw();
  var out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  var c2 = out.getContext('2d'), sc = out.width / Math.max(1, W);
  c2.fillStyle = C.bg; c2.fillRect(0, 0, out.width, out.height);
  c2.drawImage(canvas, 0, 0);
  var roots = nodes.filter(function (n) { return n.root; }).map(function (n) { return n.name; }).slice(0, 3);
  c2.font = (12 * sc) + 'px ' + C.mono; c2.textBaseline = 'bottom'; c2.fillStyle = C.ink; c2.globalAlpha = 0.65;
  c2.fillText('Asterism' + (roots.length ? '  ·  ' + roots.join(', ') : '') + '  ·  ez3-ki-el.github.io/Asterism', 14 * sc, out.height - 12 * sc);
  try {
    out.toBlob(function (blob) {
      if (!blob) { toast(T('Export impossible')); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'asterism' + (roots[0] ? '-' + normName(roots[0]).replace(/\s+/g, '-') : '') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast(T('Image enregistrée'));
    }, 'image/png');
  } catch (e) { toast(T('Export impossible : images protégées par le navigateur')); }
});

function historyUI() {
  el('undo').disabled = !undoStack.length;
  el('redo').disabled = !redoStack.length;
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  historyUI();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  historyUI();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  historyUI();
}

function leaves(n) {
  var out = [];
  adj.get(n.id).forEach(function (id) {
    var m = byId.get(id);
    if (m && !m.expanded && !m.root && m.deg === 1) out.push(m);
  });
  return out;
}

/* Retire un artiste et ses liens, puis les voisins qui n'avaient de lien qu'avec lui (sauf artistes de depart et epingles) :
   sans cela ils resteraient seuls sur la carte. Renvoie le nombre d'artistes retires ; une annulation restaure le tout. */
function removeNode(n, silent) {
  if (!byId.has(n.id)) return 0;
  if (!silent) commit();
  if (playing && playing.id === n.id) stopAudio();
  if (selected === n) select(null);
  if (hovered === n) hovered = null;
  var touched = [];
  for (var i = links.length - 1; i >= 0; i--) {
    var l = links[i];
    var a = typeof l.source === 'object' ? l.source.id : l.source;
    var b = typeof l.target === 'object' ? l.target.id : l.target;
    if (a !== n.id && b !== n.id) continue;
    var other = byId.get(a === n.id ? b : a);
    if (other) {
      if (!l.hold) other.deg--;
      adj.get(other.id).delete(n.id);
      if (other.deg <= 0) other.expanded = false;
      touched.push(other);
    }
    linkKeys.delete(a < b ? a + '-' + b : b + '-' + a);
    links.splice(i, 1);
  }
  nodes.splice(nodes.indexOf(n), 1);
  byId.delete(n.id); adj.delete(n.id);
  var removed = 1;
  touched.forEach(function (o) {
    if (!byId.has(o.id) || o.root || o.pinned) return;
    var still = links.some(function (lk) { return idOf(lk.source) === o.id || idOf(lk.target) === o.id; });
    if (!still) removed += removeNode(o, true);
  });
  if (!silent) {
    refresh();
    renderCard();
    toast(removed > 1 ? T('{n} nœuds supprimés', { n: removed }) : T('Nœud supprimé'), T('Annuler'), undo);
    sim.alpha(0.4).restart();
  }
  return removed;
}

function menuItems(n) {
  if (!n) {
    return [
      { label: T('Annuler'), disabled: !undoStack.length, run: undo },
      { label: T('Rétablir'), disabled: !redoStack.length, run: redo },
      { sep: true },
      { label: T('Recentrer'), run: fit },
      { label: T('Tout effacer'), danger: true, disabled: !nodes.length, run: function () { el('clear').click(); } }
    ];
  }
  var lv = leaves(n);
  return [
    { label: T('Explorer'), disabled: n.expanded || n.loading, run: function () { expand(n); renderCard(); } },
    { label: (playing && playing.id === n.id) ? (playing.paused ? T('Reprendre') : T('Pause')) : T('Écouter'),
      run: function () { if (playing && playing.id === n.id) togglePause(); else togglePlay(n, 0); } },
    { label: T('Écouter ses voisins'), disabled: !neighboursByScore(n).length, run: function () { startTour(n); } },
    { label: T('Top {n} titres', { n: topN }),
      run: function () { n.showTop = true; loadTracks(n).then(function () { if (selected === n) renderCard(); }); } },
    { label: focusDepth > 0 ? T('Quitter le focus') : T('Focus sur ce nœud'),
      run: function () {
        var s = el('focus');
        s.value = focusDepth > 0 ? 0 : 1;
        s.dispatchEvent(new Event('input'));
      } },
    { label: n.pinned ? T('Libérer') : T('Épingler'),
      run: function () {
        commit();
        n.pinned = !n.pinned;
        if (n.pinned) { n.fx = n.x; n.fy = n.y; } else { n.fx = null; n.fy = null; }
        draw();
      } },
    { label: T('Enrichir (sources étendues)'), disabled: !extOn || !n.expanded || !!n.ext,
      run: function () { commit(); enrich(n); } },
    { sep: true },
    { label: T('Élaguer les feuilles ({n})', { n: lv.length }), disabled: !lv.length,
      run: function () {
        commit();
        lv.forEach(function (m) { removeNode(m, true); });
        refresh(); renderCard(); sim.alpha(0.4).restart();
        toast(T('{n} nœuds supprimés', { n: lv.length }), T('Annuler'), undo);
      } },
    { label: T('Supprimer le nœud'), danger: true, run: function () { removeNode(n); } }
  ];
}

function showMenu(items, cx, cy) {
  menu.textContent = '';
  items.forEach(function (it) {
    var li = document.createElement('li');
    if (it.sep) { li.className = 'sep'; menu.appendChild(li); return; }
    li.textContent = it.label;
    li.setAttribute('role', 'menuitem');
    if (it.danger) li.classList.add('danger');
    if (it.disabled) li.classList.add('off');
    else li.addEventListener('click', function () { hideMenu(); it.run(); });
    menu.appendChild(li);
  });
  menu.hidden = false;
  var r = app.getBoundingClientRect();
  var x = clamp(cx - r.left, 4, Math.max(4, W - menu.offsetWidth - 4));
  var y = clamp(cy - r.top, 4, Math.max(4, H - menu.offsetHeight - 4));
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}

canvas.addEventListener('contextmenu', function (e) {
  e.preventDefault();
  var n = nodeAt(evPos(e));
  if (n) select(n);
  showMenu(menuItems(n), e.clientX, e.clientY);
});
var lpTimer = null, lpStart = [0, 0];
function cancelLP() { clearTimeout(lpTimer); lpTimer = null; }
canvas.addEventListener('pointerdown', function (e) {
  cancelLP();
  if (e.pointerType !== 'touch' || !e.isPrimary) return;
  lpStart = [e.clientX, e.clientY];
  lpTimer = setTimeout(function () {
    lpTimer = null;
    if (!menu.hidden || pinching(400)) return;
    var n = nodeAt(evPos(e));
    if (n) select(n);
    showMenu(menuItems(n), lpStart[0], lpStart[1]);
  }, 550);
});
canvas.addEventListener('pointermove', function (e) {
  if (lpTimer && Math.hypot(e.clientX - lpStart[0], e.clientY - lpStart[1]) > 8) cancelLP();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { canvas.addEventListener(t, cancelLP); });
canvas.addEventListener('wheel', hideMenu, { passive: true });
document.addEventListener('pointerdown', function (e) { if (!menu.contains(e.target)) hideMenu(); });
window.addEventListener('blur', hideMenu);
