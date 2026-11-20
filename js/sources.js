/* Asterism : Sources etendues : collaborations, labels, ListenBrainz, relations MusicBrainz, panneau de progression.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Sources etendues (experimental) : collaborations Deezer + ListenBrainz ---------- */
var gen = 0;                       /* change quand le graphe est remplace : annule les travaux en vol */
var extOn = false;
/* Traduction : les cles sont les textes francais ; {x} marque une valeur a inserer. Le dictionnaire EN est rempli plus bas. */
var LANG = 'fr', EN = {};
try {
  var savedLang = localStorage.getItem('mg-lang');
  LANG = (savedLang === 'en' || savedLang === 'fr') ? savedLang
    : ((navigator.language || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en');
} catch (e) { dbg('ignore', e); }
function loc(n) { return Number(n).toLocaleString(LANG === 'en' ? 'en-US' : 'fr-FR'); }
function T(fr, v) {
  var s = (LANG === 'en' && EN[fr]) || fr;
  if (v) Object.keys(v).forEach(function (k) { s = s.split('{' + k + '}').join(v[k]); });
  return s;
}
/* Nombre de titres affiches dans le top (3 a 10) ; on en charge toujours TOP_MAX pour changer sans nouvelle requete. */
var TOP_MAX = 10, topN = 5;
try { topN = Math.max(3, Math.min(TOP_MAX, parseInt(localStorage.getItem('mg-top'), 10) || 5)); } catch (e) { dbg('ignore', e); }
try { extOn = localStorage.getItem('mg-ext') === '1'; } catch (e) { dbg('ignore', e); }
var LB_ALGO = 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30';
var mbNext = 0;                    /* MusicBrainz : 1 requete par seconde au maximum */

function normName(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function idOf(x) { return typeof x === 'object' ? x.id : x; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function alive(n, g) { return gen === g && byId.get(n.id) === n; }
/* A appeler apres chaque ajout fait entre deux requetes : sans cela la simulation lit des liens non rattaches. */
function syncSim() { sim.nodes(nodes); sim.force('link').links(links); recomputeShown(); sim.alpha(0.4).restart(); }

async function mbJson(url) {
  for (var attempt = 0; attempt < 3; attempt++) {
    var wait = Math.max(0, mbNext - Date.now());
    mbNext = Date.now() + wait + 1300;
    if (wait) await sleep(wait);
    var r = await fetch(url);
    if (r.status === 503) { await sleep(2500 * (attempt + 1)); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('MusicBrainz ' + r.status);
    return r.json();
  }
  throw new Error('MusicBrainz occupe');
}

/* Collaborations : les autres participants des titres les plus ecoutes de l'artiste. */
async function enrichCollab(n, g) {
  var d = await dzp('/artist/' + n.id + '/top?limit=50');
  if (!alive(n, g)) return;
  var cnt = new Map(), objs = new Map();
  (d.data || []).forEach(function (t) {
    (t.contributors || []).forEach(function (c) {
      if (c.id === n.id) return;
      cnt.set(c.id, (cnt.get(c.id) || 0) + 1);
      objs.set(c.id, c);
    });
  });
  var ranked = Array.from(cnt.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
  if (!ranked.length) return;
  held(n.id, function () {
    ranked.forEach(function (e) {
      var c = objs.get(e[0]);
      var m = byId.get(e[0]) || ensureNode(
        { id: c.id, name: c.name, picture_medium: c.picture_medium || c.picture, nb_fan: c.nb_fan }, n.x, n.y);
      addLink(n, m, 'c', 0, { c: { count: e[1] } });
    });
  });
  syncSim();
}

/* ListenBrainz : artiste Deezer -> identifiant MusicBrainz (lien Deezer enregistre), puis voisins avec score. */
async function enrichLB(n, g) {
  await ensureMbid(n);
  if (!alive(n, g)) return 'stop';
  if (!n.mbid) return 'nomb';
  var resp = await fetch('https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=' + n.mbid + '&algorithm=' + LB_ALGO);
  if (!resp.ok) throw new Error('ListenBrainz ' + resp.status);
  var items = await resp.json();
  if (!alive(n, g)) return 'stop';
  if (!Array.isArray(items) || !items.length) return 'empty';
  var top = items[0].score || 1;
  var byName = new Map();
  nodes.forEach(function (m) { byName.set(normName(m.name), m); });
  var extra = [];
  held(n.id, function () {
    items.forEach(function (it, idx) {
      it._rank = idx + 1;
      var m = byName.get(normName(it.name));
      if (m && m !== n) addLink(n, m, 'l', 0, { l: { score: it.score || 0, top: top, rank: it._rank } });
      else if (!m) extra.push(it);
    });
  });
  syncSim();
  /* Les voisins inconnus du graphe sont cherches chez Deezer en parallele, puis ajoutes d'un seul coup. */
  var found = await Promise.all(extra.slice(0, 8).map(function (it) {
    return dzp('/search/artist?q=' + encodeURIComponent(it.name) + '&limit=5').then(function (sr) {
      return (sr.data || []).filter(function (x) { return normName(x.name) === normName(it.name); })
        .sort(function (a, b) { return (b.nb_fan || 0) - (a.nb_fan || 0); })[0];
    }, function () { return null; });
  }));
  if (!alive(n, g)) return 'stop';
  held(n.id, function () {
    found.forEach(function (hit, j) {
      if (!hit) return;
      var it = extra[j];
      addLink(n, byId.get(hit.id) || ensureNode(hit, n.x, n.y), 'l', 0, { l: { score: it.score || 0, top: top, rank: it._rank } });
    });
  });
  syncSim();
  return 'ok';
}

/* Autres projets : relations MusicBrainz entre artistes (membre de, sous-groupe, fondateur, meme personne,
   collaboration), puis retrouvees chez Deezer par le nom exact. Couverture limitee aux fiches MusicBrainz detaillees. */
var PROJ_TYPES = { 'member of band': 1, 'subgroup': 1, 'founder': 1, 'is person': 1, 'collaboration': 1 };
async function enrichProj(n, g) {
  await ensureMbid(n);
  if (!alive(n, g)) return 'stop';
  if (!n.mbid) return 'nomb';
  var d = await mbJson('https://musicbrainz.org/ws/2/artist/' + n.mbid + '?inc=artist-rels&fmt=json');
  if (!alive(n, g)) return 'stop';
  var byMb = new Map();
  ((d && d.relations) || []).forEach(function (r) {
    if (!r.artist || !PROJ_TYPES[r.type]) return;
    var e = byMb.get(r.artist.id) || { name: r.artist.name, rels: [] };
    var fwd = r.direction !== 'backward';
    e.rels.push({ t: r.type, s: fwd ? n.name : r.artist.name, o: fwd ? r.artist.name : n.name });
    byMb.set(r.artist.id, e);
  });
  var list = Array.from(byMb.values()).slice(0, 10);
  if (!list.length) return 'empty';
  var byName = new Map();
  nodes.forEach(function (m) { byName.set(normName(m.name), m); });
  var hits = await Promise.all(list.map(function (e) {
    var known = byName.get(normName(e.name));
    if (known) return Promise.resolve(known);
    return dzp('/search/artist?q=' + encodeURIComponent(e.name) + '&limit=5').then(function (sr) {
      return (sr.data || []).filter(function (x) { return normName(x.name) === normName(e.name); })
        .sort(function (a, b) { return (b.nb_fan || 0) - (a.nb_fan || 0); })[0] || null;
    }, function () { return null; });
  }));
  if (!alive(n, g)) return 'stop';
  var added = 0;
  held(n.id, function () {
    hits.forEach(function (h, i) {
      if (!h || h.id === n.id) return;
      var m = byId.get(h.id) || ensureNode(h, n.x, n.y);
      addLink(n, m, 'p', 0, { p: { rels: list[i].rels } });
      added++;
    });
  });
  syncSim();
  return added ? 'ok' : 'nodz';
}

/* Labels : autres artistes sortis chez les labels des albums de l'artiste (type 'e').
   Les labels de distributeur (numeros, Believe, TuneCore...) sont ecartes, "Various Artists" ignore,
   et un label tres large (50 albums ou plus de 40 artistes) pese moins et ajoute moins de nœuds. */
var GENERIC_LABELS = /^(\d+\s*records|believe|tunecore|distrokid|cd\s?baby|amuse|ditto|symphonic|the orchard|ingrooves|7digital|self[- ]released|independent|unknown|none|n\/a)\b/i;
var VARIOUS = ['various artists', 'artistes divers', 'multi interpretes', 'compilation', 'va'];

/* Profil de genres des albums d'un artiste (genre_id Deezer -> nombre d'albums). */
var genreCache = new Map();
function genreProfile(id) {
  if (genreCache.has(id)) return genreCache.get(id);
  var p = dzp('/artist/' + id + '/albums?limit=50').then(function (r) {
    var m = new Map();
    (r.data || []).forEach(function (a) { if (a.genre_id > 0) m.set(a.genre_id, (m.get(a.genre_id) || 0) + 1); });
    return m;
  });
  genreCache.set(id, p);
  p.catch(function () { genreCache.delete(id); });
  return p;
}
/* Un artiste sans photo chez Deezer (adresse d'image vide, ou empreinte MD5 d'un fichier vide)
   est en general un profil cree par un distributeur : trop peu fiable pour un lien de label. */
function hasPicture(ar) {
  var p = ar.picture_medium || ar.picture || '';
  return !!p && p.indexOf('/artist//') < 0 && p.indexOf('d41d8cd98f00b204e9800998ecf8427e') < 0;
}
function cosine(a, b) {
  var dot = 0, na = 0, nb = 0;
  a.forEach(function (v, k) { na += v * v; if (b.has(k)) dot += v * b.get(k); });
  b.forEach(function (v) { nb += v * v; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/* --- Description de style via MusicBrainz : texte libre (psytrance, techno...) --- */
var STYLE_STOP = new Set(['duo', 'trio', 'band', 'group', 'producer', 'producers', 'musician', 'singer', 'artist',
  'project', 'from', 'with', 'collective', 'based', 'music', 'electronic', 'austrian', 'portuguese', 'french',
  'german', 'british', 'american', 'italian', 'spanish', 'swedish', 'japanese', 'brazilian', 'dutch', 'belgian',
  'russian', 'polish', 'swiss', 'canadian', 'australian', 'israeli', 'greek', 'turkish', 'mexican', 'indian']);
var STYLE_ALIASES = [
  [/psy[\s-]?trance|psychedelic trance|dark[\s-]?psy|goa( trance)?|full[\s-]?on|forest psy/g, ' psytrance '],
  [/drum (and|&|n) bass|drum'n'bass|dnb/g, ' dnb '],
  [/hip[\s-]?hop|\brap\b/g, ' hiphop ']
];
function styleTokens(text) {
  var t = ' ' + String(text || '').toLowerCase() + ' ';
  STYLE_ALIASES.forEach(function (p) { t = t.replace(p[0], p[1]); });
  var out = new Set();
  t.split(/[^\p{L}\p{N}]+/u).forEach(function (w) { if (w.length >= 4 && !STYLE_STOP.has(w)) out.add(w); });
  return out;
}
function styleMatch(a, b) {
  var A = styleTokens(a), B = styleTokens(b), hit = false;
  A.forEach(function (w) { if (B.has(w)) hit = true; });
  return hit;
}
function mbPartsText(o) {
  var parts = [o.disambiguation || ''];
  (o.genres || []).forEach(function (x) { parts.push(x.name); });
  (o.tags || []).forEach(function (x) { parts.push(x.name); });
  return parts.join(' ');
}
/* Identifiant MusicBrainz d'un artiste Deezer, par le lien Deezer enregistre dans MusicBrainz. */
/* Une seule requete a la fois par artiste : les labels et ListenBrainz tournent en parallele et partagent la reponse. */
function ensureMbid(n) {
  if (n.mbid !== undefined) return Promise.resolve(n.mbid);
  var cm = cacheGet('mb', n.id);
  if (cm !== undefined) { n.mbid = cm; return Promise.resolve(cm); }
  if (n.mbidP) return n.mbidP;
  n.mbidP = mbJson('https://musicbrainz.org/ws/2/url?resource=' +
    encodeURIComponent('https://www.deezer.com/artist/' + n.id) + '&inc=artist-rels&fmt=json').then(function (r) {
    n.mbid = null;
    if (r && r.relations) {
      for (var i = 0; i < r.relations.length; i++) {
        if (r.relations[i].artist) { n.mbid = r.relations[i].artist.id; break; }
      }
    }
    n.mbidP = null;
    cacheSet('mb', n.id, n.mbid);
    return n.mbid;
  }, function (e) { dbg('musicbrainz identifiant', e); n.mbidP = null; throw e; });
  return n.mbidP;
}
async function mbTextsByName(names) {
  var q = names.map(function (s) { return 'artist:"' + String(s).replace(/["\\]/g, ' ') + '"'; }).join(' OR ');
  var d = await mbJson('https://musicbrainz.org/ws/2/artist/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100');
  var best = new Map();
  ((d && d.artists) || []).forEach(function (a) {
    if ((a.score || 0) < 85) return;
    var key = normName(a.name), cur = best.get(key);
    if (!cur || a.score > cur.score) best.set(key, a);
  });
  var out = new Map();
  best.forEach(function (a, key) { out.set(key, mbPartsText(a)); });
  return out;
}

/* Un label reunit des artistes de tous les genres : on garde les candidats dont les genres d'albums
   ressemblent a ceux de l'artiste (cosinus >= 0,75). Un candidat rejete est repeche si sa description
   MusicBrainz rejoint celle de l'artiste (ex. psytrance). Compteurs : n.ext.rej et n.ext.res. */
var LABEL_MIN_COS = 0.75;
async function enrichLabel(n, g) {
  var albs = (await dzp('/artist/' + n.id + '/albums?limit=6')).data || [];
  if (!alive(n, g)) return [];
  var labels = new Map();
  var infos = await Promise.all(albs.slice(0, 4).map(function (al) { return dzp('/album/' + al.id); }));
  if (!alive(n, g)) return [];
  infos.forEach(function (info) {
    var lab = info.label && String(info.label).trim();
    if (lab && !GENERIC_LABELS.test(lab)) labels.set(lab, (labels.get(lab) || 0) + 1);
  });
  var ranked = Array.from(labels.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 2);
  if (!ranked.length) return [];
  var srcProf = await genreProfile(n.id);
  if (!alive(n, g)) return [];
  var srcText = '', mbFailed = false;
  try {
    if (await ensureMbid(n)) {
      if (n.mbText === undefined) {
        n.mbText = mbPartsText(await mbJson('https://musicbrainz.org/ws/2/artist/' + n.mbid + '?inc=tags+genres&fmt=json') || {});
      }
      srcText = n.mbText || '';
    }
  } catch (e) { mbFailed = true; /* pas de description : on se contente des genres Deezer */ }
  if (!alive(n, g)) return [];
  var used = [], rejected = 0, rescued = 0;
  /* Les deux labels sont traites en parallele ; les noeuds ne sont crees qu'une fois les verdicts connus. */
  await Promise.all(ranked.map(async function (rk) {
    var name = rk[0];
    var found = (await dzp('/search/album?q=' + encodeURIComponent('label:"' + name + '"') + '&limit=50')).data || [];
    if (!alive(n, g)) return;
    var roster = new Map();
    found.forEach(function (a) {
      var ar = a.artist || {};
      if (!ar.id || ar.id === n.id || VARIOUS.indexOf(normName(ar.name)) >= 0) return;
      var ent = roster.get(ar.id) || { a: ar, c: 0 };
      ent.c++;
      roster.set(ar.id, ent);
    });
    var size = roster.size;
    if (!size) return;
    var cap = (size >= 40 || found.length >= 50) ? 3 : 6, added = 0, kept = 0;
    var cands = Array.from(roster.values()).sort(function (a, b) { return b.c - a.c; }).slice(0, 12);
    var withPic = cands.filter(function (cd) {
      if (hasPicture(cd.a)) return true;
      rejected++;
      return false;
    });
    var profs = await Promise.all(withPic.map(function (cd) { return genreProfile(cd.a.id); }));
    if (!alive(n, g)) return;
    var scored = withPic.map(function (cd, idx) {
      return { ent: cd, cos: srcProf.size ? cosine(srcProf, profs[idx]) : 1, match: false };
    });
    if (scored.length && srcText) {
      var texts;
      try { texts = await mbTextsByName(scored.map(function (x) { return x.ent.a.name; })); } catch (e) { texts = new Map(); mbFailed = true; }
      if (!alive(n, g)) return;
      scored.forEach(function (x) {
        var t = texts.get(normName(x.ent.a.name));
        x.match = !!(t && styleMatch(srcText, t));
      });
    }
    var accepted = scored.filter(function (x) {
      if (x.cos >= LABEL_MIN_COS) return true;
      if (x.match) { rescued++; return true; }
      rejected++;
      return false;
    });
    /* Un style qui correspond passe avant la simple ressemblance des genres Deezer. */
    accepted.sort(function (a, b) { return ((b.match ? 1 : 0) + b.cos) - ((a.match ? 1 : 0) + a.cos); });
    held(n.id, function () {
      accepted.forEach(function (x) {
        var m = byId.get(x.ent.a.id);
        if (!m) {
          if (added >= cap) return;
          m = ensureNode({ id: x.ent.a.id, name: x.ent.a.name, picture_medium: x.ent.a.picture_medium || x.ent.a.picture,
            nb_fan: x.ent.a.nb_fan }, n.x, n.y);
          added++;
        }
        addLink(n, m, 'e', 0, { e: { labels: [name], cos: x.cos, match: x.match, size: size } });
        kept++;
      });
    });
    if (kept) used.push(name);
    syncSim();
  }));
  if (n.ext) { n.ext.rej = rejected; n.ext.res = rescued; n.ext.mbfail = mbFailed; }
  return used;
}

/* ----- Panneau de progression : un travail par artiste enrichi (le plus recent est affiche) ----- */
var xjobs = [];
var XSRC = [['c', 'Collaborations'], ['e', 'Labels'], ['l', 'ListenBrainz'], ['p', 'Projets (MusicBrainz)']];
function removeJob(job) {
  var i = xjobs.indexOf(job);
  if (i >= 0) xjobs.splice(i, 1);
  renderProg();
}
function renderProg() {
  var box = el('xprog'), job = xjobs[xjobs.length - 1];
  if (!job) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = '';
  var h = document.createElement('div'); h.className = 'xh';
  var t = document.createElement('span'); t.textContent = T('Recherche étendue : {name}', { name: job.name });
  h.appendChild(t);
  var active = xjobs.filter(function (j) { return !j.sum; }).length;
  if (active > 1) { var more = document.createElement('span'); more.className = 'xn'; more.textContent = T('+ {n} autres', { n: active - 1 }); h.appendChild(more); }
  var bar = document.createElement('div'); bar.className = 'xbar' + (job.sum ? ' done' : '');
  bar.appendChild(document.createElement('i'));
  var ul = document.createElement('ul');
  XSRC.forEach(function (x) {
    var li = document.createElement('li'), st = job.st[x[0]];
    var dot = document.createElement('span'); dot.className = 'dot ' + st;
    var nm = document.createElement('span'); nm.textContent = T(x[1]);
    var tx = document.createElement('span'); tx.className = 'st';
    tx.textContent = st === 'run' ? T('en cours') : st === 'done' ? T('terminé') : T('indisponible');
    li.append(dot, nm, tx); ul.appendChild(li);
  });
  var foot = document.createElement('div'); foot.className = 'xs';
  foot.textContent = job.sum ? job.sum() : T('Les nouveaux artistes apparaîtront tous ensemble à la fin.');
  box.append(h, bar, ul, foot);
}

async function enrich(n) {
  if (!extOn) return;
  var g = gen;
  n.ext = { txt: 'Sources étendues en cours : les nouveaux artistes arrivent ensemble.', live: true };
  n.enriching = true; startAnim();
  var job = { id: n.id, name: n.name, st: { c: 'run', e: 'run', l: 'run', p: 'run' }, sum: null };
  xjobs.push(job); renderProg();
  function mark(k, ok) { job.st[k] = ok ? 'done' : 'fail'; renderProg(); }
  if (selected === n) renderCard();
  var collabFailed = false, lb, pj, labelsUsed = [], labelFailed = false;
  try {
    /* Les trois sources partent en meme temps ; leurs ajouts restent retenus jusqu'a la fin de la derniere. */
    await Promise.all([
      enrichCollab(n, g).catch(function (e) { dbg('collaborations', e); collabFailed = true; }).then(function () { mark('c', !collabFailed); }),
      enrichLabel(n, g).then(function (u) { labelsUsed = u; }, function (e) { dbg('labels', e); labelFailed = true; }).then(function () { mark('e', !labelFailed); }),
      enrichLB(n, g).then(function (r) { lb = r; }, function (e) { dbg('listenbrainz', e); lb = 'err'; }).then(function () { mark('l', lb !== 'err'); }),
      enrichProj(n, g).then(function (r) { pj = r; }, function (e) { dbg('musicbrainz projets', e); pj = 'err'; }).then(function () { mark('p', pj !== 'err'); })
    ]);
  } finally {
    n.enriching = false;
    if (gen === g) releaseHold(n.id);   /* meme si l'artiste a ete supprime entre-temps : rien ne doit rester masque */
    if (gen !== g || !alive(n, g)) removeJob(job);
  }
  if (!alive(n, g)) return;
  var c = 0, l = 0, both = 0, eCount = 0, anyExt = 0, pCount = 0;
  links.forEach(function (lk) {
    if (idOf(lk.source) !== n.id && idOf(lk.target) !== n.id) return;
    if (!lk.k) return;
    if (/[clep]/.test(lk.k)) anyExt++;
    if (lk.k.length > 1) both++;
    if (lk.k.indexOf('c') >= 0) c++;
    if (lk.k.indexOf('l') >= 0) l++;
    if (lk.k.indexOf('p') >= 0) pCount++;
    if (lk.k.indexOf('e') >= 0) eCount++;
  });
  /* Resume court (barre d'etat, titre du detail) et detail ligne par ligne, replie dans la fiche. */
  var rej = n.ext.rej || 0, res = n.ext.res || 0, mbf = !!n.ext.mbfail;
  var lines = [function () { return [T('Collaborations'), collabFailed ? T('indisponibles') : String(c)]; }];
  lines.push(function () {
    return [T('Labels'), labelFailed ? T('indisponibles') : eCount + (labelsUsed.length ? ' (' + labelsUsed.join(', ') + ')' : '')];
  });
  if (!labelFailed && rej) lines.push(function () { return [null, T('{n} écartés (genre différent ou sans photo)', { n: rej })]; });
  if (!labelFailed && res) lines.push(function () { return [null, T('{n} retrouvés par le style MusicBrainz', { n: res })]; });
  if (!labelFailed && mbf) lines.push(function () { return [null, T('style MusicBrainz indisponible, réessaie plus tard')]; });
  lines.push(function () {
    return ['ListenBrainz', lb === 'nomb' ? T('artiste absent de MusicBrainz')
      : lb === 'empty' ? T('aucun voisin') : lb === 'err' ? T('indisponible') : String(l)];
  });
  lines.push(function () {
    return [T('Projets (MusicBrainz)'), pj === 'nomb' ? T('artiste absent de MusicBrainz')
      : pj === 'empty' ? T('aucune relation enregistrée') : pj === 'nodz' ? T('relations sans équivalent Deezer')
      : pj === 'err' ? T('indisponible') : String(pCount)];
  });
  if (both) lines.push(function () { return [T('Confirmés par plusieurs sources'), String(both)]; });
  n.ext.lines = lines;
  n.ext.sumf = function () {
    return anyExt ? T(anyExt > 1 ? 'Sources étendues : {n} liens ajoutés' : 'Sources étendues : {n} lien ajouté', { n: anyExt })
      : T('Sources étendues : aucun lien ajouté');
  };
  n.ext.txt = '';
  refresh();
  sim.alpha(0.5).restart();
  job.sum = n.ext.sumf; renderProg();
  setTimeout(function () { removeJob(job); }, 5000);
  if (selected === n) renderCard();
}
