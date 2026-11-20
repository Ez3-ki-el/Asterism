/* Asterism : Base : debogage, cache local, API Deezer, etat du graphe, canevas, types de liens et score.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

function el(id) { return document.getElementById(id); }

/* ---------- Debogage et cache local ---------- */
/* Mode debogage : ajouter ?debug=1 a l'adresse (ou localStorage mg-debug = 1). Les erreurs qui sont volontairement
   ignorees (stockage refuse, source indisponible...) sont alors ecrites dans la console au lieu de disparaitre. */
var DEBUG = /[?&]debug=1(&|$)/.test(location.search);
try { DEBUG = DEBUG || localStorage.getItem('mg-debug') === '1'; } catch (e) { /* stockage refuse : pas de debogage */ }
function dbg(where, e) { if (DEBUG) console.warn('[Asterism] ' + where, e); }
window.addEventListener('error', function (e) { dbg('erreur', e.error || e.message); });
window.addEventListener('unhandledrejection', function (e) { dbg('promesse rejetee', e.reason); });

/* Cache local entre deux visites, par identifiant Deezer : fiche Wikidata (7 jours) et identifiant MusicBrainz (30 jours).
   Un seul objet dans localStorage, plafonne a 600 entrees (les plus anciennes partent) ; vide en cas de quota depasse. */
var CACHE_KEY = 'mg-cache', CACHE_MAX = 600, CACHE_TTL = { wd: 7 * 864e5, mb: 30 * 864e5, ds2: 30 * 864e5 }, cacheObj = null, cacheTimer = null;
function cacheLoad() {
  if (cacheObj) return cacheObj;
  try { cacheObj = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { dbg('cache illisible', e); cacheObj = {}; }
  return cacheObj;
}
function cacheGet(kind, id) {
  var c = cacheLoad(), key = kind + ':' + id, e = c[key];
  if (!e) return undefined;
  if (Date.now() - e.t > (CACHE_TTL[kind] || 0)) { delete c[key]; return undefined; }
  return e.v;
}
function cacheSave() {
  var c = cacheLoad(), keys = Object.keys(c);
  if (keys.length > CACHE_MAX) {
    keys.sort(function (a, b) { return c[a].t - c[b].t; }).slice(0, keys.length - CACHE_MAX).forEach(function (k) { delete c[k]; });
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }
  catch (e) {
    dbg('cache plein, il est vide', e);
    cacheObj = {};
    try { localStorage.removeItem(CACHE_KEY); } catch (e2) { dbg('cache', e2); }
  }
}
function cacheSet(kind, id, v) {
  cacheLoad()[kind + ':' + id] = { t: Date.now(), v: v };
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(cacheSave, 400);
}

/* ---------- API Deezer (JSONP, sans cle) ---------- */
var jid = 0;
function jsonp(url, timeout, plain) {
  timeout = timeout || 8000;
  return new Promise(function (resolve, reject) {
    var cb = '__dz' + (++jid);
    var s = document.createElement('script');
    var t = setTimeout(function () { cleanup(); reject(new Error('delai depasse')); }, timeout);
    function cleanup() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = function (d) { cleanup(); resolve(d); };
    s.onerror = function () { cleanup(); reject(new Error('reseau')); };
    s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + (plain ? '' : 'output=jsonp&') + 'callback=' + cb;   /* plain : l'API d'Apple refuse output=jsonp */
    document.head.appendChild(s);
  });
}
/* Deezer repond "quota depasse" (code 4) au-dela d'environ 50 requetes par 5 secondes : on reessaie un peu plus tard. */
async function dz(path) {
  for (var attempt = 0; ; attempt++) {
    var d = await jsonp('https://api.deezer.com' + path);
    if (d && d.error) {
      if (d.error.code === 4 && attempt < 3) { await new Promise(function (r) { setTimeout(r, 1200 * (attempt + 1)); }); continue; }
      throw new Error(d.error.message || ('erreur ' + d.error.code));
    }
    return d;
  }
}
/* Version cadencee (une requete toutes les 110 ms) pour les sources etendues, qui lancent beaucoup d'appels en parallele
   sans retarder les actions directes de l'utilisateur (explorer, rechercher). */
var dzNext = 0;
async function dzp(path) {
  var wait = Math.max(0, dzNext - Date.now());
  dzNext = Date.now() + wait + 110;
  if (wait) await new Promise(function (r) { setTimeout(r, wait); });
  return dz(path);
}

/* ---------- Etat du graphe ---------- */
var nodes = [], links = [];
var byId = new Map(), adj = new Map(), linkKeys = new Map();
var hovered = null, selected = null, dragging = false, hoveredLink = null;
var focusDepth = 0, visible = null;

var C = {};
function loadTheme() {
  var s = getComputedStyle(document.documentElement);
  function g(name) { return s.getPropertyValue(name).trim(); }
  C.bg = g('--bg'); C.ink = g('--ink'); C.accent = g('--accent'); C.link = g('--link'); C.mono = g('--mono');
}
loadTheme();

/* ---------- Canvas ---------- */
var app = document.getElementById('app');
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var W = 0, H = 0, dpr = 1;
var transform = d3.zoomIdentity;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = app.clientWidth; H = app.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  draw();
}

var sim = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(70).strength(0.5))
  .force('charge', d3.forceManyBody().strength(-220).distanceMax(600))
  .force('x', d3.forceX(0).strength(0.03))
  .force('y', d3.forceY(0).strength(0.03))
  .force('collide', d3.forceCollide(function (d) { return R(d) + 3; }))
  .on('tick', function () { draw(); });   /* draw est defini dans render.js, charge apres ce fichier */

function R(n) { return 6.5 + Math.sqrt(n.deg) * 1.2 + (n.root ? 3 : 0); }
/* Types de liens affiches (cases de la legende) : d Deezer, c collaboration, e label, l ListenBrainz.
   Hors option « Sources etendues », tout est affiche, pour ne jamais masquer sans moyen de reafficher. */
var kindsOn = { d: true, c: true, e: true, l: true, p: true, r: true }, kindsVer = 0, shown = null, minScore = 0;
try {
  var savedKinds = JSON.parse(localStorage.getItem('mg-kinds') || 'null');
  if (savedKinds) ['d', 'c', 'e', 'l', 'p', 'r'].forEach(function (c) { if (savedKinds[c] === false) kindsOn[c] = false; });
} catch (e) { dbg('ignore', e); }
try { minScore = Math.max(0, Math.min(100, parseInt(localStorage.getItem('mg-min'), 10) || 0)) / 100; } catch (e) { dbg('ignore', e); }
/* Sources etendues decochees : seuls les liens Deezer restent visibles (la legende est alors cachee, donc toujours affiches).
   Sources etendues cochees : chaque type, Deezer compris, suit sa case dans la legende. */
/* Toujours actifs : Deezer (d), radio Deezer (r) et collaborations (c), chacun suivant sa case de la legende.
   Les autres types (labels, ListenBrainz, MusicBrainz) n'apparaissent qu'avec les sources etendues cochees. */
var ALWAYS_KINDS = 'drc';
function kOn(c) { return ALWAYS_KINDS.indexOf(c) >= 0 ? !!kindsOn[c] : (extOn && !!kindsOn[c]); }
/* Nombre de voisins Deezer d'un artiste (liens de type d), quelle que soit la visibilite des autres types. */
function dDeg(n) {
  var c = 0;
  links.forEach(function (lk) {
    if (lk.k && lk.k.indexOf('d') >= 0 && (idOf(lk.source) === n.id || idOf(lk.target) === n.id)) c++;
  });
  return c;
}
/* Mode petits artistes : au-dela d'un nombre de fans (curseur des reglages), un artiste est estompe, jamais masque :
   il reste cliquable. La racine et la selection ne sont jamais estompees. Indice 0 = tout afficher. */
var FAN_STEPS = [0, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500], fanIdx = 0, fanMax = 0;
try { fanIdx = Math.max(0, Math.min(FAN_STEPS.length - 1, parseInt(localStorage.getItem('mg-fan'), 10) || 0)); } catch (e) { dbg('ignore', e); }
fanMax = FAN_STEPS[fanIdx];
function bigNode(n) { return fanMax > 0 && !n.root && n !== selected && typeof n.fans === 'number' && n.fans > fanMax; }
/* Un artiste est estompe s'il depasse le seuil de popularite, ou s'il ne correspond pas au filtre « mes ecoutes »
   (markFilter et marks sont definis dans card.js ; ces fonctions ne servent qu'apres le chargement). */
function markOut(n) {
  return typeof markFilter !== 'undefined' && markFilter !== 'all' && !n.root && n !== selected && !(marks[n.id] && marks[n.id].s === markFilter);
}
function dimNode(n) { return bigNode(n) || markOut(n); }
/* Lettres de types d'un lien qui sont actuellement cochees ('' = lien masque). */
function ekRaw(lk) {
  if (lk._kv !== kindsVer || lk._kk !== lk.k) {
    var s = '', src = lk.k || 'd';
    for (var i = 0; i < src.length; i++) if (kOn(src[i])) s += src[i];
    lk._ek = s; lk._kv = kindsVer; lk._kk = lk.k;
  }
  return lk._ek;
}
/* Un lien est visible si un de ses types est coche et si son score atteint le seuil des reglages. */
function ekOf(lk) { return (!lk.hold && lk.w >= minScore) ? ekRaw(lk) : ''; }
function isShown(n) { return !n.hold && (!shown || shown.has(n.id)); }
function vis(n) { return (!visible || visible.has(n.id)) && isShown(n); }
/* Un noeud n'est affiche que s'il garde un lien visible, sauf racine, selection et noeud sans lien. */
function recomputeShown() {
  if (extOn && kindsOn.d && kindsOn.c && kindsOn.e && kindsOn.l && kindsOn.p && kindsOn.r && minScore <= 0) { shown = null; return; }
  shown = new Set();
  links.forEach(function (lk) {
    if (ekOf(lk)) { shown.add(idOf(lk.source)); shown.add(idOf(lk.target)); }
  });
  nodes.forEach(function (n) { if (n.root || n === selected || n.deg === 0) shown.add(n.id); });
}
function refreshWeights() { links.forEach(function (lk) { lk.w = scoreOf(lk).score; }); }
function updateLegend() {
  var cnt = { d: 0, c: 0, e: 0, l: 0, p: 0, r: 0 };
  links.forEach(function (lk) {
    var s = lk.k || 'd';
    for (var i = 0; i < s.length; i++) if (cnt[s[i]] !== undefined) cnt[s[i]]++;
  });
  document.querySelectorAll('#extlegend [data-count]').forEach(function (e) {
    var c = cnt[e.getAttribute('data-count')];
    e.textContent = '(' + c + ')';
    e.parentNode.parentNode.classList.toggle('zero', c === 0);
  });
  var hid = 0;
  links.forEach(function (lk) { if (ekRaw(lk) && lk.w < minScore) hid++; });
  var pct = Math.round(minScore * 100);
  el('minv').textContent = pct ? '≥ ' + pct + ' % (' + T(hid > 1 ? '{n} masqués' : '{n} masqué', { n: hid }) + ')' : T('Tout');
}
function applyKinds() {
  kindsVer++;
  refreshWeights(); recomputeShown(); recomputeVisible(); updateLegend();
  renderCard(); draw();
}

function refresh() {
  sim.nodes(nodes);
  sim.force('link').links(links);
  recomputeVisible();
  recomputeShown();
  updateLegend();
  hoveredLink = null;
  hideLinkTip();
  if (typeof updateFanLabel === 'function') updateFanLabel();
  document.getElementById('empty').hidden = nodes.length > 0;
  setStatus(nodes.length ? T('{n} artistes, {k} liens', { n: nodes.length, k: links.length }) : '', null, null, 'count');
}

/* Retenue : les artistes et liens trouves par les sources etendues restent masques (hold = identifiant de l'artiste
   enrichi) jusqu'a la fin de toutes les sources, puis apparaissent ensemble (releaseHold). */
var holdTok = 0, fadeUntil = 0, FADE_MS = 500;
function held(tok, fn) { holdTok = tok; try { fn(); } finally { holdTok = 0; } }
function fadeOf(o) {
  if (!o.born) return 1;
  var t = (performance.now() - o.born) / FADE_MS;
  if (t >= 1) { o.born = 0; return 1; }
  return t * t * (3 - 2 * t);
}

function ensureNode(a, x, y) {
  var n = byId.get(a.id);
  if (n) return n;
  n = {
    id: a.id, name: a.name, pic: a.picture_medium || a.picture_big || a.picture || '', hold: holdTok,
    fans: a.nb_fan, deg: 0, expanded: false, loading: false,
    x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24, track: undefined
  };
  n.imgOk = false;
  n.img = new Image();
  n.img.onload = function () { n.imgOk = true; draw(); };
  /* CORS anonyme (le CDN de Deezer l'autorise) : sans cela le canevas serait « teinte » et l'export en image impossible.
     Si l'image refuse, on la recharge sans CORS : elle s'affiche, seul l'export sera limite. */
  n.img.crossOrigin = 'anonymous';
  n.img.onerror = function () {
    if (n.img.crossOrigin) { n.img.removeAttribute('crossorigin'); n.img.src = n.pic; n.corsOff = true; }
  };
  if (n.pic) n.img.src = n.pic;
  nodes.push(n); byId.set(n.id, n); adj.set(n.id, new Set());
  return n;
}

/* kind : 'd' similaires Deezer, 'l' ListenBrainz, 'c' collaboration ; w : poids de 0 a 1.
   Un lien confirme par plusieurs sources cumule les lettres (ex. 'dl'). */
/* Preuves d'un lien (ev) : d.from = rang chez Deezer selon l'artiste qui l'a explore ; l = score ListenBrainz ;
   c = titres en commun ; e = labels, ressemblance des genres, style MusicBrainz, taille du label. */
function mergeEv(dst, src) {
  if (!src) return dst;
  dst = dst || {};
  if (src.d) {
    dst.d = dst.d || { from: {} };
    Object.keys(src.d.from).forEach(function (id) { dst.d.from[id] = src.d.from[id]; });
  }
  if (src.l && (!dst.l || src.l.score / src.l.top > dst.l.score / dst.l.top)) {
    dst.l = { score: src.l.score, top: src.l.top, rank: src.l.rank };
  }
  if (src.c && (!dst.c || src.c.count > dst.c.count)) dst.c = { count: src.c.count };
  if (src.r && (!dst.r || src.r.count > dst.r.count)) dst.r = { count: src.r.count };
  if (src.p) {
    dst.p = dst.p || { rels: [] };
    src.p.rels.forEach(function (r) {
      if (!dst.p.rels.some(function (x) { return x.t === r.t && x.s === r.s && x.o === r.o; })) dst.p.rels.push({ t: r.t, s: r.s, o: r.o });
    });
  }
  if (src.e) {
    dst.e = dst.e || { labels: [], cos: 0, match: false, size: 0 };
    src.e.labels.forEach(function (x) { if (dst.e.labels.indexOf(x) < 0) dst.e.labels.push(x); });
    dst.e.cos = Math.max(dst.e.cos, src.e.cos);
    dst.e.match = dst.e.match || src.e.match;
    dst.e.size = Math.max(dst.e.size, src.e.size);
  }
  return dst;
}

/* Score de compatibilite (0 a 1). Chaque source donne sa preuve avec sa propre confiance, puis on
   combine par "au moins une source a raison" : 1 - produit des (1 - confiance). Un lien porte par
   une seule source reste donc modeste, et le score monte quand les sources concordent. */
/* Relation MusicBrainz en une phrase : s est le sujet de la relation, o son objet. */
function projLine(r) {
  var v = { s: r.s, o: r.o };
  return r.t === 'member of band' ? T('{s} est membre de {o}', v)
    : r.t === 'subgroup' ? T('{s} est un sous-groupe de {o}', v)
    : r.t === 'founder' ? T('{s} a fondé {o}', v)
    : r.t === 'is person' ? T('{s} et {o} : même personne', v)
    : T('{s} et {o} : collaboration', v);
}
/* ---------- Styles Discogs : profil de styles d'un artiste (ex. Freetekno, Tribal, Acid) ----------
   Une recherche des sorties par nom d'artiste, sans cle. Discogs accepte environ 25 requetes par minute et par
   visiteur : file cadencee a une requete toutes les 2,6 s, reponse mise en cache 30 jours (n.ds, null = rien trouve). */
var dgNext = 0;
async function dgJson(url) {
  var wait = Math.max(0, dgNext - Date.now());
  dgNext = Date.now() + wait + 2600;
  if (wait) await new Promise(function (r) { setTimeout(r, wait); });
  var resp = await fetch(url);
  if (resp.status === 429) { dgNext = Date.now() + 30000; throw new Error('Discogs 429'); }
  if (!resp.ok) throw new Error('Discogs ' + resp.status);
  return resp.json();
}
function ensureStyles(n) {
  if (n.ds !== undefined) return Promise.resolve(n.ds);
  var c = cacheGet('ds2', n.id);
  if (c !== undefined) { n.ds = c; return Promise.resolve(c); }
  if (n.dsP) return n.dsP;
  n.dsP = dgJson('https://api.discogs.com/database/search?type=release&per_page=50&artist=' + encodeURIComponent(n.name)).then(function (d) {
    /* Titre Discogs : « Artiste - Sortie », avec parfois « (2) » pour distinguer des homonymes, retire ici. */
    var want = normName(n.name), cnt = {}, used = 0;
    ((d && d.results) || []).forEach(function (r) {
      /* Partie artiste du titre, decoupee sur & , / feat. vs : l'artiste doit y figurer (ecarte surtout les compilations). */
      var whos = String(r.title || '').split(' - ')[0].split(/\s*(?:&|,|\/|\bfeat\.?|\bft\.?|\bvs\.?|\bx\b)\s*/i)
        .map(function (w) { return normName(w.replace(/\s*\(\d+\)\s*$/, '')); });
      if (whos.indexOf(want) < 0) return;
      used++;
      (r.style || []).forEach(function (st) { cnt[st] = (cnt[st] || 0) + 1; });
    });
    n.ds = used && Object.keys(cnt).length ? { n: used, s: cnt } : null;
    n.dsP = null;
    cacheSet('ds2', n.id, n.ds);
    return n.ds;
  }, function (e) { dbg('discogs', e); n.dsP = null; return undefined; });
  return n.dsP;
}
function styleCos(a, b) {
  var dot = 0, na = 0, nb = 0;
  Object.keys(a).forEach(function (k) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; });
  Object.keys(b).forEach(function (k) { nb += b[k] * b[k]; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
function topStyles(ds, k) {
  return Object.keys(ds.s).sort(function (x, y) { return ds.s[y] - ds.s[x]; }).slice(0, k);
}
function commonStyles(a, b, k) {
  return Object.keys(a).filter(function (x) { return b[x]; })
    .sort(function (x, y) { return Math.min(b[y], a[y]) - Math.min(b[x], a[x]); }).slice(0, k);
}

function scoreOf(lk) {
  var ev = lk.ev || {}, k = lk.k || 'd', parts = [], prod = 1, penal = false;
  function add(s, src, name, lines) { parts.push({ src: src, s: s, name: name, lines: lines }); prod *= (1 - s); }
  if ((ev.d || k.indexOf('d') >= 0) && kOn('d')) {
    var ranks = ev.d ? Object.keys(ev.d.from).map(function (id) { return ev.d.from[id]; }) : [];
    var best = ranks.length ? Math.min.apply(null, ranks) : 10, recip = ranks.length > 1;
    var sd = 0.35 + 0.5 * (1 - (best - 1) / 19);
    if (recip) sd = Math.min(0.95, sd + 0.1);
    add(sd, 'd', 'Deezer', [T('Rang {n} sur 20', { n: best })].concat(recip ? [T('Lien réciproque')] : []));
  }
  if ((ev.l || k.indexOf('l') >= 0) && kOn('l')) {
    var rel = ev.l ? ev.l.score / ev.l.top : 0.5;
    add(0.3 + 0.6 * rel, 'l', 'ListenBrainz', [T('{n} % du meilleur voisin', { n: Math.round(rel * 100) })]
      .concat(ev.l && ev.l.rank ? [T('Rang {n} chez ListenBrainz', { n: ev.l.rank })] : []));
  }
  if ((ev.c || k.indexOf('c') >= 0) && kOn('c')) {
    var cnt = ev.c ? ev.c.count : 1;
    add(Math.min(0.85, 0.5 + 0.1 * cnt), 'c', T('Collaboration'), [T(cnt > 1 ? '{n} titres en commun' : '{n} titre en commun', { n: cnt })]);
  }
  if ((ev.p || k.indexOf('p') >= 0) && kOn('p')) {
    var pr = ev.p ? ev.p.rels : [];
    add(Math.min(0.9, 0.75 + 0.05 * Math.max(0, pr.length - 1)), 'p', T('Même artiste ou groupe (MusicBrainz)'),
      pr.slice(0, 3).map(projLine));
  }
  if ((ev.r || k.indexOf('r') >= 0) && kOn('r')) {
    var rc = ev.r ? ev.r.count : 1;
    add(Math.min(0.8, 0.3 + 0.12 * rc), 'r', T('Radio Deezer'), [T(rc > 1 ? '{n} titres dans sa radio Deezer' : '{n} titre dans sa radio Deezer', { n: rc })]);
  }
  if ((ev.e || k.indexOf('e') >= 0) && kOn('e')) {
    var e = ev.e || { labels: [], cos: 0.5, match: false, size: 0 };
    var se = 0.15 + 0.25 * e.cos + (e.match ? 0.2 : 0);
    if (e.size >= 40) se *= 0.8;
    add(se, 'e', T('Label : {names}', { names: e.labels.join(', ') || '?' }), [T('Genres comparables à {n} %', { n: Math.round(e.cos * 100) })]
      .concat(e.match ? [T('Même style (MusicBrainz)')] : []));
  }
  /* Styles Discogs (sources etendues) : des styles proches renforcent le lien, des styles sans rapport le reduisent. */
  if (extOn) {
    var na = byId.get(idOf(lk.source)), nb = byId.get(idOf(lk.target));
    if (na && nb && na.ds && nb.ds) {
      var sc = styleCos(na.ds.s, nb.ds.s), common = commonStyles(na.ds.s, nb.ds.s, 3);
      if (sc >= 0.4) {
        add(0.15 + 0.35 * sc, 's', T('Styles Discogs'), [T('Styles proches à {n} %', { n: Math.round(sc * 100) })]
          .concat(common.length ? [T('En commun : {list}', { list: common.join(', ') })] : []));
      } else if (sc < 0.1 && na.ds.n >= 3 && nb.ds.n >= 3) {
        penal = true;
        parts.push({ src: 's', s: 0, name: T('Styles Discogs'), lines: [T('Styles très différents : score réduit')] });
      }
    }
  }
  return { score: (1 - prod) * (penal ? 0.6 : 1), parts: parts };
}

function addLink(a, b, kind, w, ev) {
  if (a === b) return null;
  kind = kind || 'd';
  var key = a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id;
  var ex = linkKeys.get(key);
  if (ex) {
    if (ex.k.indexOf(kind) < 0) ex.k += kind;
    ex.ev = mergeEv(ex.ev, ev);
    ex.w = scoreOf(ex).score;
    return ex;
  }
  var lk = { source: a.id, target: b.id, k: kind, w: 0, ev: mergeEv(null, ev) || null, hold: holdTok };
  lk.w = scoreOf(lk).score;
  linkKeys.set(key, lk);
  links.push(lk);
  if (!lk.hold) connect(lk, a, b);
  return lk;
}
/* Degre et voisinage ne comptent un lien retenu qu'au moment ou il apparait. */
function connect(lk, a, b) {
  a.deg++; b.deg++;
  adj.get(a.id).add(b.id); adj.get(b.id).add(a.id);
}
function releaseHold(tok) {
  var now = performance.now(), any = false;
  nodes.forEach(function (n) { if (n.hold === tok) { n.hold = 0; n.born = now; n.flash = now; any = true; } });
  links.forEach(function (lk) {
    if (lk.hold !== tok) return;
    lk.hold = 0; lk.born = now; any = true;
    var a = byId.get(idOf(lk.source)), b = byId.get(idOf(lk.target));
    if (a && b) connect(lk, a, b);
  });
  if (!any) return;
  fadeUntil = now + 1900;
  recomputeShown(); recomputeVisible(); updateLegend();
  sim.alpha(0.5).restart();
  startAnim();
}

async function expand(n, silent) {
  if (n.expanded || n.loading) return;
  n.loading = true; startAnim();
  try {
    var d = await dz('/artist/' + n.id + '/related?limit=20');
    var list = d.data || [];
    if (!byId.has(n.id)) return;
    if (!silent) commit();
    list.forEach(function (a, i) {
      var from = {}; from[n.id] = i + 1;
      addLink(n, ensureNode(a, n.x, n.y), 'd', 0, { d: { from: from } });
    });
    n.expanded = true;
    refresh();
    if (extOn) enrich(n); else enrichLight(n);
    if (!list.length) toast(T('Aucun artiste lié pour {name}', { name: n.name }));
  } catch (e) {
    toast(T('Erreur Deezer : {m}', { m: T(e.message) }));
  } finally {
    n.loading = false;
    sim.alpha(0.7).restart();
    if (selected === n) renderCard();
  }
}
