/* Asterism : Fiche de l artiste : ecoute, top des titres, repli Apple, Wikidata, logos des services.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Tuile fixe, ecoute, top 5 ---------- */
var card = document.getElementById('card');
var audio = new Audio(); audio.preload = 'none';
var playToken = 0, fadeT = null;
var playing = null; /* { id, idx } */

var hoverPlay = false, hoverTimer = null, cardMin = false;
try { hoverPlay = localStorage.getItem('mg-hover') === '1'; } catch (e) { dbg('ignore', e); }
el('sound').checked = hoverPlay;

function setHover(n) {
  if (n === hovered) return;
  hovered = n;
  clearTimeout(hoverTimer);
  if (playing && playing.hover && (!n || playing.id !== n.id)) stopAudio();
  hoverStart(n);
  draw();
}

function hoverStart(n) {
  if (!hoverPlay || !n) return;
  if (playing && (!playing.hover || playing.id === n.id)) return;
  hoverTimer = setTimeout(async function () {
    if (hovered !== n || (playing && !playing.hover)) return;
    var tok = ++playToken;
    var tracks = await loadTracks(n);
    if (tok !== playToken || hovered !== n || (playing && !playing.hover) || !tracks) return;
    var idx = tracks.findIndex(function (x) { return x.url; });
    if (idx < 0) return;
    playing = { id: n.id, idx: idx, paused: false, hover: true };
    audio.src = tracks[idx].url; audio.volume = 0;
    renderCard();
    try {
      await audio.play();
      if (tok !== playToken) { audio.pause(); return; }
      fade(volLevel, 300);
    } catch (e) {
      if (tok === playToken) { playing = null; renderCard(); }
    }
  }, 300);
}

/* Le cadre pulse tant que l'artiste choisi a 3 voisins Deezer ou moins et que les sources etendues sont decochees ;
   il s'arrete des que l'utilisateur survole la case (il a vu), ou active l'option. */
var nudgeSeen = false;
function updateNudge() {
  var s = selected;
  var on = !nudgeSeen && !extOn && !!s && s.expanded && !s.loading && dDeg(s) <= 3;
  el('extopt').parentNode.classList.toggle('nudge', on);
  el('panel').classList.toggle('nudge', on);
  el('grpext').classList.toggle('nudge', on);
}
el('extopt').parentNode.addEventListener('pointerenter', function () { nudgeSeen = true; updateNudge(); });
el('panel').addEventListener('toggle', function () { if (el('panel').open && el('panel').classList.contains('nudge')) updateNudge(); });

function renderCard() {
  var n = selected;
  updateNudge();
  renderTour();
  card.hidden = !n;
  if (!n) { updateNow(); return; }
  /* Le top des titres est ouvert par defaut a la premiere ouverture de la fiche ; « Masquer » le referme pour cet artiste. */
  if (n.showTop === undefined) {
    n.showTop = true;
    if (n.tracks === undefined) loadTracks(n).then(function () { if (selected === n) renderCard(); });
  }
  card.classList.toggle('min', cardMin);
  el('cmin').textContent = cardMin ? '+' : '−';
  el('cname').textContent = n.name;
  var img = el('cimg');
  if (img.getAttribute('src') !== n.pic) img.src = n.pic;
  var meta = [];
  if (typeof n.fans === 'number') meta.push(T('{n} fans', { n: loc(n.fans) }));
  var vc = 0;
  links.forEach(function (lk) {
    if ((idOf(lk.source) === n.id || idOf(lk.target) === n.id) && ekOf(lk)) vc++;
  });
  meta.push(vc === n.deg ? T(n.deg > 1 ? '{n} liens' : '{n} lien', { n: n.deg }) : T('{vc} liens affichés sur {n}', { vc: vc, n: n.deg }));
  el('cmeta').textContent = meta.join(' · ');
  var ex = el('aexp');
  ex.textContent = n.loading ? T('Chargement') : n.expanded ? T('Exploré') : T('Explorer');
  ex.disabled = n.loading || n.expanded;
  el('alisten').textContent = (playing && playing.id === n.id) ? (playing.paused ? T('Reprendre') : T('Pause')) : T('Écouter');
  var narrow = window.matchMedia('(max-width: 640px)').matches;
  el('atop').textContent = n.showTop ? (narrow ? T('Masquer') : T('Masquer le top')) : (narrow ? T('Top {n}', { n: topN }) : T('Top {n} titres', { n: topN }));
  renderTracks(n);
  renderLinks(n);
  renderOut(n);
  renderWd(n);
  renderBio(n);
  renderMarks(n);
  renderStyles(n);
  renderDisc(n);
  var hints = [];
  var dd = dDeg(n), few = n.expanded && !n.loading && dd <= 3;
  if (few) hints.push(dd === 0 ? T('Deezer ne propose aucun artiste lié.')
    : T(dd > 1 ? 'Deezer ne propose que {n} artistes liés.' : 'Deezer ne propose que {n} artiste lié.', { n: dd }));
  if (n.ext && n.ext.txt) hints.push(T(n.ext.txt));
  if (n.tracksSrc === 'apple' && n.tracks) hints.push(T('Extraits : Apple (absents chez Deezer).'));
  if (n.tracks === null) {
    var an = n.appleNote;
    hints.push(T('Aucun extrait disponible') + (an ? ' (' + T('repli Apple : {m}', { m: T(an[0], an[1] ? { m: T(an[1].m) } : null) }) + ')' : '') + '.');
  }
  var hb = el('chint');
  hb.textContent = '';
  hints.forEach(function (h) { var d = document.createElement('div'); d.textContent = h; hb.appendChild(d); });
  /* Peu de voisins et sources etendues desactivees : on propose de les essayer. */
  if (few && !extOn) {
    var inv = document.createElement('div');
    inv.append(T('Les sources étendues (expérimental) peuvent en trouver d’autres. '));
    var tryBtn = document.createElement('button');
    tryBtn.type = 'button'; tryBtn.className = 'link'; tryBtn.textContent = T('Essayer');
    tryBtn.addEventListener('click', function () { setExt(true); });
    inv.appendChild(tryBtn);
    hb.appendChild(inv);
  }
  var extLines = n.ext && n.ext.lines;
  el('cext').hidden = !extLines || !extOn;
  if (extLines) {
    el('cextsum').textContent = n.ext.sumf();
    var xl = el('cextl');
    xl.textContent = '';
    extLines.forEach(function (fn) {
      var ln = fn(), d = document.createElement('div');
      if (ln[0] === null) { d.className = 'sub'; d.textContent = ln[1]; }
      else { var b = document.createElement('b'); b.textContent = ln[0] + (LANG === 'en' ? ': ' : ' : '); d.append(b, ln[1]); }
      xl.appendChild(d);
    });
  }
  updateNow();
  if (playing && !playing.paused) startAnim();
}

/* Liens vers l'artiste ailleurs : Deezer est exact (identifiant connu), les autres sont des recherches sur le nom,
   sans cle ni API. Ouverts dans un nouvel onglet, sans referent. Logos monochromes Simple Icons (CC0),
   integres ici pour ne dependre d'aucun serveur ; marques deposees de leurs proprietaires. */
var LOGO = {
  'Deezer': 'M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19Z',
  'Spotify': 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  'Apple Music': 'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z',
  'YouTube Music': 'M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z',
  'Bandcamp': 'M0 18.75l7.437-13.5H24l-7.438 13.5H0z',
  'SoundCloud': 'M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z'
};
var OUT = [
  ['Spotify', 'https://open.spotify.com/search/'],
  ['Apple Music', 'https://music.apple.com/search?term='],
  ['YouTube Music', 'https://music.youtube.com/search?q='],
  ['Bandcamp', 'https://bandcamp.com/search?item_type=b&q='],
  ['SoundCloud', 'https://soundcloud.com/search/people?q=']
];
/* ---------- Wikidata : fiche de l'artiste retrouvee par son identifiant Deezer (propriete P2722) ----------
   Donne les identifiants exacts (Spotify, Apple Music, YouTube, Bandcamp, SoundCloud, Instagram, Discogs...), le site officiel,
   les genres, le pays, les dates et la page Wikipedia. Sans cle ; reponse mise en cache par artiste (n.wd : objet, null = pas de fiche). */
var WD_API = 'https://www.wikidata.org/w/api.php?origin=*&format=json&';
var WD_IDS = ['P1902', 'P2850', 'P2397', 'P3040', 'P3283', 'P2003', 'P1953', 'P434'];
function wdJson(q) {
  return fetch(WD_API + q).then(function (r) {
    if (!r.ok) throw new Error('Wikidata ' + r.status);
    return r.json();
  });
}
function wdVals(c, p) {
  return (c[p] || []).filter(function (x) { return x.rank !== 'deprecated' && x.mainsnak && x.mainsnak.datavalue; })
    .map(function (x) { return x.mainsnak.datavalue.value; });
}
function wdTime(v) {
  var m = v && /^([+-])(\d{4,})-(\d\d)-(\d\d)/.exec(v.time || '');
  if (!m || m[1] === '-') return null;
  return { y: +m[2], m: +m[3], d: +m[4], prec: v.precision || 9 };
}
function ensureWd(n) {
  if (n.wd !== undefined) return Promise.resolve(n.wd);
  var cw = cacheGet('wd', n.id);
  if (cw !== undefined) { n.wd = cw; return Promise.resolve(cw); }
  if (n.wdP) return n.wdP;
  n.wdP = (async function () {
    var r = await wdJson('action=query&list=search&srsearch=' + encodeURIComponent('haswbstatement:P2722=' + n.id));
    var hit = r && r.query && r.query.search && r.query.search[0];
    if (!hit || !/^Q\d+$/.test(hit.title)) return null;
    var q = hit.title;
    var ent = (await wdJson('action=wbgetentities&ids=' + q + '&props=claims|sitelinks&sitefilter=frwiki|enwiki')).entities[q];
    var c = ent.claims || {}, w = { q: q, ids: {}, wiki: {} };
    WD_IDS.forEach(function (p) {
      var v = wdVals(c, p).filter(function (x) { return typeof x === 'string'; });
      if (v.length) w.ids[p] = v;
    });
    var web = wdVals(c, 'P856')[0];
    try { var u = new URL(web); if (/^https?:$/.test(u.protocol)) w.web = u.href; } catch (e) { dbg('ignore', e); }
    ['frwiki', 'enwiki'].forEach(function (k) {
      if (ent.sitelinks && ent.sitelinks[k]) w.wiki[k.slice(0, 2)] = ent.sitelinks[k].title;
    });
    w.birth = wdTime(wdVals(c, 'P569')[0]); w.death = wdTime(wdVals(c, 'P570')[0]); w.formed = wdTime(wdVals(c, 'P571')[0]);
    var itemIds = function (p, max) { return wdVals(c, p).filter(function (x) { return x && x.id; }).map(function (x) { return x.id; }).slice(0, max); };
    var gen = itemIds('P136', 5), ctry = itemIds('P27', 3);
    if (!ctry.length) ctry = itemIds('P495', 3);
    var place = itemIds('P19', 1);
    var all = gen.concat(ctry, place).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var lab = {};
    if (all.length) {
      var le = (await wdJson('action=wbgetentities&ids=' + all.join('|') + '&props=labels&languages=fr|en')).entities || {};
      Object.keys(le).forEach(function (id) {
        var L = le[id].labels || {};
        lab[id] = { fr: L.fr && L.fr.value, en: L.en && L.en.value };
      });
    }
    var named = function (ids) { return ids.map(function (id) { return lab[id]; }).filter(Boolean); };
    w.genres = named(gen); w.countries = named(ctry); w.place = named(place)[0] || null;
    return w;
  })().then(function (w) { n.wd = w; n.wdP = null; cacheSet('wd', n.id, w); return w; },
            function (e) { dbg('wikidata', e); n.wdP = null; return undefined; });   /* erreur reseau : on retentera a la prochaine selection */
  return n.wdP;
}
function wdLabel(o) { return o ? (o[LANG] || o.fr || o.en || '') : ''; }
function wdDate(t) {
  if (!t) return '';
  var loc = LANG === 'en' ? 'en-GB' : 'fr-FR';
  if (t.prec < 10 || !t.m) return String(t.y);
  var d = new Date(Date.UTC(t.y, t.m - 1, t.prec >= 11 ? t.d : 1));
  return d.toLocaleDateString(loc, t.prec >= 11 ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function wdId(w, p) {
  var v = (w.ids[p] || []).filter(function (x) { return /^[A-Za-z0-9._-]+$/.test(x); })[0];
  return v || '';
}
/* Adresses exactes : un service n'apparait en lien exact que si Wikidata connait l'identifiant. */
var EXACT = {
  'Spotify': function (w) { var i = wdId(w, 'P1902'); return i && 'https://open.spotify.com/artist/' + i; },
  'Apple Music': function (w) { var i = wdId(w, 'P2850'); return /^\d+$/.test(i) && 'https://music.apple.com/' + (LANG === 'en' ? 'us' : 'fr') + '/artist/' + i; },
  'YouTube Music': function (w) { var i = wdId(w, 'P2397'); return i && 'https://music.youtube.com/channel/' + i; },
  'Bandcamp': function (w) { var i = wdId(w, 'P3283'); return /^[a-z0-9-]+$/i.test(i) && 'https://' + i + '.bandcamp.com'; },
  'SoundCloud': function (w) { var i = wdId(w, 'P3040'); return i && 'https://soundcloud.com/' + i; }
};
function renderWd(n) {
  var w = n.wd, box = el('cwd');
  box.hidden = !w;
  if (!w) return;
  el('cwdsum').textContent = T('Identité et liens (Wikidata)');
  var xl = el('cwdl');
  xl.textContent = '';
  function row(label, text) {
    if (!text) return;
    var d = document.createElement('div'), b = document.createElement('b');
    b.textContent = label + (LANG === 'en' ? ': ' : ' : ');
    d.append(b, text); xl.appendChild(d);
  }
  row(T('Genres'), w.genres.map(wdLabel).filter(Boolean).join(', '));
  row(T('Pays'), w.countries.map(wdLabel).filter(Boolean).join(', '));
  if (w.birth) row(T('Naissance'), wdDate(w.birth) + (w.place ? ', ' + wdLabel(w.place) : ''));
  if (w.formed && !w.birth) row(T('Formé en'), wdDate(w.formed));
  if (w.death) row(T('Décès'), wdDate(w.death));
  var wl = document.createElement('div');
  wl.className = 'wl';
  function link(label, href) {
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label;
    wl.appendChild(a);
  }
  if (w.web) link(T('Site officiel'), w.web);
  var ig = wdId(w, 'P2003'); if (ig) link('Instagram', 'https://www.instagram.com/' + encodeURIComponent(ig) + '/');
  var dc = wdId(w, 'P1953'); if (/^\d+$/.test(dc)) link('Discogs', 'https://www.discogs.com/artist/' + dc);
  var wk = LANG === 'en' ? (w.wiki.en ? 'en' : 'fr') : (w.wiki.fr ? 'fr' : 'en');
  if (w.wiki[wk]) link(T('Wikipédia'), 'https://' + wk + '.wikipedia.org/wiki/' + encodeURIComponent(w.wiki[wk].replace(/ /g, '_')));
  var mb = wdId(w, 'P434'); if (/^[0-9a-f-]{36}$/i.test(mb)) link('MusicBrainz', 'https://musicbrainz.org/artist/' + mb);
  link('Wikidata', 'https://www.wikidata.org/wiki/' + w.q);
  xl.appendChild(wl);
}

/* Biographie : resume de la page Wikipedia liee a la fiche Wikidata (jamais une recherche par nom, trop d'homonymes).
   Langue de l'interface si la page existe, sinon l'autre. Licence CC BY-SA : source citee avec un lien. */
function bioLang(w) { return LANG === 'en' ? (w.wiki.en ? 'en' : 'fr') : (w.wiki.fr ? 'fr' : 'en'); }
function ensureBio(n) {
  var w = n.wd;
  if (!w || !w.wiki) return Promise.resolve(null);
  var lg = bioLang(w), title = w.wiki[lg], key = lg + n.id;
  if (n.bioKey === key) return Promise.resolve(n.bio);
  if (!title) { n.bio = null; n.bioKey = key; return Promise.resolve(null); }
  var c = cacheGet('wp', key);
  if (c !== undefined) { n.bio = c; n.bioKey = key; return Promise.resolve(c); }
  if (n.bioP && n.bioPKey === key) return n.bioP;
  n.bioPKey = key;
  n.bioP = fetch('https://' + lg + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))).then(function (r) {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Wikipedia ' + r.status);
    return r.json();
  }).then(function (d) {
    var u = d && d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page;
    var b = d && d.type === 'standard' && d.extract ? { t: String(d.extract), u: /^https:\/\/(fr|en)\.wikipedia\.org\//.test(u || '') ? u : '', l: lg } : null;
    n.bio = b; n.bioKey = key; n.bioP = null; cacheSet('wp', key, b);
    return b;
  }, function (e) { dbg('wikipedia', e); n.bioP = null; n.bioErr = key; return undefined; });
  return n.bioP;
}
function renderBio(n) {
  var box = el('cbio'), w = n.wd;
  if (!w || !w.wiki || !(w.wiki.fr || w.wiki.en)) { box.hidden = true; return; }
  var key = bioLang(w) + n.id;
  if (n.bioKey !== key) {
    box.hidden = true;
    if (n.bioErr !== key) ensureBio(n).then(function (b) { if (b && selected === n) renderCard(); });
    return;
  }
  var b = n.bio;
  box.hidden = !b;
  if (!b) return;
  el('cbiosum').textContent = T('Biographie (Wikipédia)');
  var bl = el('cbiol');
  bl.textContent = '';
  var p = document.createElement('p'); p.textContent = b.t;
  var src = document.createElement('div'); src.className = 'src';
  var a = document.createElement('a');
  a.href = b.u || ('https://' + b.l + '.wikipedia.org/'); a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = T('Source : Wikipédia, licence CC BY-SA');
  src.appendChild(a);
  bl.append(p, src);
}

function renderOut(n) {
  var box = el('coutl'), q = encodeURIComponent(n.name), NS = 'http://www.w3.org/2000/svg';
  box.textContent = '';
  function add(label, href, direct, exact) {
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.title = exact ? T('{label} : fiche de l’artiste (lien exact)', { label: label })
      : direct ? T('{label} : fiche de l’artiste (lien direct)', { label: label })
      : T('{label} : rechercher {name} (un homonyme peut apparaître)', { label: label, name: n.name });
    a.setAttribute('aria-label', a.title);
    if (direct || exact) a.className = 'direct';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', LOGO[label]); path.setAttribute('fill', 'currentColor');
    svg.appendChild(path); a.appendChild(svg);
    box.appendChild(a);
  }
  add('Deezer', 'https://www.deezer.com/artist/' + n.id, true);
  OUT.forEach(function (o) {
    var ex = n.wd && EXACT[o[0]] ? EXACT[o[0]](n.wd) : '';
    add(o[0], ex || o[1] + q, false, !!ex);
  });
}

/* Petit trait d'exemple, au meme motif que sur le graphe, pour chaque source. */
var DASH = { d: '', l: '5 4', c: '1.5 3.5', e: '8 3 1.5 3', p: '10 3 2 3 2 3', r: '14 4', i: '2 2 2 6', s: '1 2' };
function sampleSvg(src) {
  return '<svg viewBox="0 0 24 6" aria-hidden="true"><line x1="1" y1="3" x2="23" y2="3" stroke="currentColor" stroke-width="1.3"'
    + (DASH[src] ? ' stroke-dasharray="' + DASH[src] + '"' : ' stroke-opacity="0.5"') + '/></svg>';
}

/* Liste des liens de l'artiste selectionne, classes par score, avec l'origine de chaque score. */
function renderLinks(n) {
  var box = el('clinks'), ol = el('lklist');
  ol.textContent = '';
  var items = [];
  links.forEach(function (lk) {
    var a = idOf(lk.source), b = idOf(lk.target);
    if (a !== n.id && b !== n.id) return;
    if (!ekOf(lk)) return;
    var other = byId.get(a === n.id ? b : a);
    if (other) items.push({ other: other, sc: scoreOf(lk) });
  });
  box.hidden = !items.length;
  if (!items.length) return;
  items.sort(function (x, y) { return y.sc.score - x.sc.score; });
  el('lksum').textContent = T('Liens et compatibilité ({n})', { n: items.length });
  items.slice(0, 12).forEach(function (it) {
    var pct = Math.round(it.sc.score * 100);
    var li = document.createElement('li');
    var r1 = document.createElement('div'); r1.className = 'r1';
    var p = document.createElement('span'); p.className = 'pct'; p.textContent = pct + ' %';
    var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.other.name;
    r1.append(p, nm);
    var bar = document.createElement('div'); bar.className = 'sbar';
    var fill = document.createElement('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
    var why = document.createElement('div'); why.className = 'why';
    why.appendChild(partsEl(it.sc.parts));
    li.append(r1, bar, why);
    li.addEventListener('click', function () { select(it.other); });
    li.addEventListener('mouseenter', function () { hovered = it.other; draw(); });
    li.addEventListener('mouseleave', function () { if (hovered === it.other) { hovered = null; draw(); } });
    ol.appendChild(li);
  });
  if (items.length > 12) {
    var more = document.createElement('li'); more.className = 'more';
    more.textContent = T('+ {n} autres liens moins compatibles', { n: items.length - 12 });
    ol.appendChild(more);
  }
}

function renderTracks(n) {
  var ol = el('ctracks');
  ol.textContent = '';
  ol.hidden = !(n.showTop && n.tracks);
  if (ol.hidden) return;
  n.tracks.slice(0, topN).forEach(function (t, i) {
    var li = document.createElement('li');
    var on = playing && playing.id === n.id && playing.idx === i;
    if (on) li.className = 'on';
    var num = document.createElement('span'); num.className = 'num'; num.textContent = i + 1;
    var title = document.createElement('span'); title.className = 't'; title.textContent = t.title;
    var act = document.createElement('span'); act.className = 'act';
    act.textContent = !t.url ? '' : (on && !playing.paused) ? T('Pause') : T('Lire');
    li.append(num, title, act);
    if (t.url) li.addEventListener('click', function () { togglePlay(n, i); }); else li.classList.add('off');
    ol.appendChild(li);
  });
}

/* Encart du lecteur : affiche ce qui joue, quel que soit l'artiste selectionne. L'ecoute au survol n'y apparait pas. */
function updateNow() {
  var box = el('player'), n = playing ? byId.get(playing.id) : null;
  if (!playing || !n || playing.hover) {
    box.hidden = true; document.body.classList.remove('hasplayer'); el('cbar').style.width = '0';
    return;
  }
  var t = playing.title || (n.tracks && n.tracks[playing.idx] ? n.tracks[playing.idx].title : '');
  box.hidden = false; document.body.classList.add('hasplayer');
  box.setAttribute('aria-label', T('Lecteur'));
  var img = el('plimg');
  if (n.pic && img.getAttribute('src') !== n.pic) img.src = n.pic;
  img.title = T('Ouvrir la fiche');
  el('plname').textContent = n.name;
  el('cnowt').textContent = t ? '· ' + t : '';
  box.classList.toggle('paused', !!playing.paused);
  el('cnowk').textContent = playing.paused ? T('En pause')
    : tour ? T('Écoute de la carte') + ' · ' + (tour.i + 1) + '/' + tour.list.length : T('En écoute');
  el('cnowpp').setAttribute('aria-label', playing.paused ? T('Reprendre') : T('Pause'));
  renderTour();
  updateNowTime();
}
function mmss(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function updateNowTime() {
  el('cnowtime').textContent = audio.duration ? mmss(audio.currentTime) + ' / ' + mmss(audio.duration) : '';
}

/* Joue un extrait quelconque (titre d'album, voisin de l'ecoute de la carte). kind : 'album' ou 'tour'. */
async function playTrack(n, title, url, kind, idx) {
  var tok = ++playToken;
  playing = { id: n.id, idx: idx === undefined ? -1 : idx, paused: false, title: title, kind: kind };
  audio.src = url; audio.volume = 0;
  renderCard();
  try {
    await audio.play();
    if (tok !== playToken) { audio.pause(); return false; }
    fade(volLevel, 300);
    return true;
  } catch (e) {
    dbg('lecture', e);
    if (tok === playToken) { playing = null; renderCard(); el('chint').textContent = T('Lecture bloquée par le navigateur'); }
    return false;
  }
}

/* Styles Discogs : ligne dans la fiche pour l'artiste selectionne ; avec les sources etendues, on charge aussi
   les styles des voisins (file cadencee) pour ajuster le score des liens, puis on rafraichit les scores. */
var styleTimer = null;
function styleRefreshSoon() {
  clearTimeout(styleTimer);
  styleTimer = setTimeout(function () { refreshWeights(); recomputeShown(); updateLegend(); renderCard(); draw(); }, 700);
}
/* Genres MusicBrainz (votes de la communaute), second avis a cote des styles Discogs. n.mg : liste, null = rien. */
function ensureMbGenres(n) {
  if (n.mg !== undefined) return Promise.resolve(n.mg);
  var c = cacheGet('mg', n.id);
  if (c !== undefined) { n.mg = c; return Promise.resolve(c); }
  if (n.mgP) return n.mgP;
  n.mgP = ensureMbid(n).then(function (id) {
    if (!id) return null;
    return mbJson('https://musicbrainz.org/ws/2/artist/' + id + '?inc=genres&fmt=json').then(function (d) {
      var gl = ((d && d.genres) || []).filter(function (x) { return (x.count || 0) > 0; })
        .sort(function (a, b) { return (b.count || 0) - (a.count || 0); }).slice(0, 5).map(function (x) { return x.name; });
      return gl.length ? gl : null;
    });
  }).then(function (gl) { n.mg = gl; n.mgP = null; cacheSet('mg', n.id, gl); return gl; },
          function (e) { dbg('musicbrainz genres', e); n.mgP = null; return undefined; });
  return n.mgP;
}
function loadStylesFor(n) {
  ensureMbGenres(n).then(function (gl) { if (gl && selected === n) renderCard(); });
  ensureStyles(n).then(function () { if (selected === n) { renderCard(); if (extOn) styleRefreshSoon(); } });
  if (!extOn) return;
  neighboursByScore(n).slice(0, 20).forEach(function (m) {
    if (m.ds === undefined) ensureStyles(m).then(function (ds) { if (ds) styleRefreshSoon(); });
  });
}
function renderStyles(n) {
  var box = el('cstyles'), top = n.ds ? topStyles(n.ds, 5) : [], mg = n.mg || [];
  box.hidden = !top.length && !mg.length;
  if (box.hidden) return;
  box.textContent = '';
  function line(label, list) {
    var d = document.createElement('div'), b = document.createElement('b');
    b.textContent = label + (LANG === 'en' ? ': ' : ' : ');
    d.append(b, list.join(' · ')); box.appendChild(d);
  }
  if (top.length) line(T('Styles (Discogs)'), top);
  if (mg.length) line(T('Genres (MusicBrainz)'), mg);
}

/* ---------- Ecouter la carte : l'artiste puis ses voisins, du plus compatible au moins compatible ---------- */
var tour = null, tourSelecting = false;
function neighboursByScore(n) {
  var best = new Map();
  links.forEach(function (lk) {
    if (!ekOf(lk)) return;
    var a = idOf(lk.source), b = idOf(lk.target);
    if (a !== n.id && b !== n.id) return;
    var m = byId.get(a === n.id ? b : a);
    if (m && vis(m) && (!best.has(m.id) || best.get(m.id).s < lk.w)) best.set(m.id, { n: m, s: lk.w });
  });
  return Array.from(best.values()).sort(function (x, y) { return y.s - x.s; }).map(function (x) { return x.n; });
}
function startTour(origin) {
  var list = neighboursByScore(origin);
  if (!list.length) { toast(T('Aucun voisin à écouter')); return; }
  tour = { name: origin.name, list: [origin].concat(list), i: -1 };
  tourGo(1);
}
function stopTour(msg) {
  if (!tour) return;
  tour = null;
  updateNow();
  if (msg) toast(msg);
}
async function tourGo(step) {
  if (!tour) return;
  var me = tour;
  for (var tries = 0; tries < me.list.length; tries++) {
    me.i += step;
    if (me.i < 0) me.i = 0;
    if (me.i >= me.list.length) { stopTour(T('Écoute de la carte terminée')); return; }
    var n = me.list[me.i];
    if (byId.get(n.id) !== n) continue;
    tourSelecting = true; select(n); tourSelecting = false;
    if (typeof ensureOnScreen === 'function') ensureOnScreen(n);
    renderTour();
    var tracks = await loadTracks(n);
    if (tour !== me) return;
    var idx = tracks ? tracks.findIndex(function (x) { return x.url; }) : -1;
    if (idx < 0) continue;   /* pas d'extrait : on passe au suivant */
    var ok = await playTrack(n, tracks[idx].title, tracks[idx].url, 'tour', idx);
    if (!ok && tour === me) stopTour();
    return;
  }
  stopTour(T('Écoute de la carte terminée'));
}
/* Boutons de l'encart du lecteur : precedent et suivant pendant l'ecoute de la carte, arreter toujours. */
var PL_ICON = {
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="2" height="10" fill="currentColor"/><path d="M13 3v10L6 8z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10l7-5z" fill="currentColor"/><rect x="11" y="3" width="2" height="10" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" fill="currentColor"/></svg>'
};
function renderTour() {
  var x = el('plx');
  x.textContent = '';
  function btn(icon, label, fn) {
    var b = document.createElement('button'); b.type = 'button';
    b.insertAdjacentHTML('afterbegin', PL_ICON[icon]);
    b.title = label; b.setAttribute('aria-label', label);
    b.addEventListener('click', fn); x.appendChild(b);
  }
  if (tour) {
    btn('prev', T('Précédent'), function () { tourGo(-1); });
    btn('next', T('Suivant'), function () { tourGo(1); });
  }
  btn('stop', T('Arrêter'), function () { stopAudio(); stopTour(); });
}
el('plimg').addEventListener('click', function () {
  var n = playing && byId.get(playing.id);
  if (n) { select(n); if (typeof ensureOnScreen === 'function') ensureOnScreen(n); }
});

/* ---------- Discographie : albums Deezer avec pochette, un clic joue le premier extrait de l'album ---------- */
function loadAlbums(n) {
  if (n.albums !== undefined) return Promise.resolve(n.albums);
  if (n.albumsP) return n.albumsP;
  n.albumsP = dz('/artist/' + n.id + '/albums?limit=100').then(function (d) {
    var seen = new Set();
    n.albums = (d.data || []).filter(function (a) {
      var k = strictName(a.title);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).sort(function (a, b) { return String(b.release_date || '').localeCompare(String(a.release_date || '')); });
    n.albumsP = null;
    return n.albums;
  }, function (e) { dbg('discographie', e); n.albumsP = null; n.albums = null; return null; });
  return n.albumsP;
}
/* Deezer melange parfois plusieurs homonymes sous un meme identifiant, et ajoute les sorties ou l'artiste n'est qu'invite.
   On garde en tete les sorties du genre dominant ; un autre genre est replie s'il forme un vrai groupe (3 sorties et 5 %
   au moins), s'il n'est pas voisin du genre dominant (meme famille) et si l'artiste a un genre net (60 % au moins).
   Les bandes originales et les genres inconnus ne sont jamais replies. */
var GENRE_FAMILY = { 106: 'elec', 113: 'elec', 116: 'urb', 165: 'urb', 169: 'urb', 144: 'urb', 132: 'pop', 52: 'pop', 466: 'pop',
  84: 'pop', 197: 'pop', 152: 'rock', 85: 'rock', 464: 'rock', 129: 'jazz', 153: 'jazz', 98: 'jazz' };
function splitDisc(albums) {
  var cnt = {}, dom = null;
  albums.forEach(function (a) { if (a.genre_id > 0) cnt[a.genre_id] = (cnt[a.genre_id] || 0) + 1; });
  Object.keys(cnt).forEach(function (g) { if (dom === null || cnt[g] > cnt[dom]) dom = g; });
  if (dom === null || cnt[dom] / albums.length < 0.6) return { main: albums, other: [] };
  var fam = function (g) { return GENRE_FAMILY[g] || ('g' + g); }, fold = {};
  Object.keys(cnt).forEach(function (g) {
    if (+g === 173 || fam(g) === fam(dom)) return;
    if (cnt[g] >= Math.max(3, albums.length * 0.05)) fold[g] = true;
  });
  return {
    main: albums.filter(function (a) { return !fold[a.genre_id]; }),
    other: albums.filter(function (a) { return fold[a.genre_id]; })
  };
}
var DISC_TYPES = { album: 'Album', ep: 'EP', single: 'Single', compile: 'Compilation' };
function discItem(n, a, ol) {
  var li = document.createElement('li');
  if (playing && playing.id === n.id && playing.album === a.id) li.className = 'on';
  var img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
  if (a.cover_small) img.src = a.cover_small;
  var dt = document.createElement('div'); dt.className = 'dt';
  var b = document.createElement('b'); b.textContent = a.title;
  var sp = document.createElement('span');
  sp.textContent = [String(a.release_date || '').slice(0, 4), DISC_TYPES[a.record_type] ? T(DISC_TYPES[a.record_type]) : ''].filter(Boolean).join(' · ');
  dt.append(b, sp); li.append(img, dt);
  li.addEventListener('click', function () { playAlbum(n, a); });
  ol.appendChild(li);
}
function discNote(ol, text, onClick) {
  var li = document.createElement('li'); li.className = 'more';
  if (onClick) {
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'link'; bt.textContent = text;
    bt.addEventListener('click', onClick); li.appendChild(bt);
  } else li.textContent = text;
  ol.appendChild(li);
}
function renderDisc(n) {
  var box = el('cdisc'), ol = el('cdiscl');
  var parts = n.albums ? splitDisc(n.albums) : null;
  el('cdiscsum').textContent = parts ? T('Discographie ({n})', { n: parts.main.length }) : T('Discographie');
  if (!box.open) return;
  ol.textContent = '';
  if (n.albums === undefined) {
    discNote(ol, T('Chargement'));
    loadAlbums(n).then(function () { if (selected === n) renderDisc(n); });
    return;
  }
  if (!n.albums || !n.albums.length) { discNote(ol, T('Aucun album chez Deezer')); return; }
  parts.main.slice(0, n.discAll ? parts.main.length : 24).forEach(function (a) { discItem(n, a, ol); });
  if (parts.main.length > 24 && !n.discAll) {
    discNote(ol, T('Afficher les {n} autres sorties', { n: parts.main.length - 24 }), function () { n.discAll = true; renderDisc(n); });
  }
  if (parts.other.length) {
    if (!n.discOther) {
      discNote(ol, T('+ {n} sorties d’un autre genre (homonyme ou featuring possible)', { n: parts.other.length }),
        function () { n.discOther = true; renderDisc(n); });
    } else {
      discNote(ol, T('Autre genre, homonyme ou featuring possible :'));
      parts.other.forEach(function (a) { discItem(n, a, ol); });
    }
  }
}
async function playAlbum(n, a) {
  stopTour();
  try {
    var d = await dz('/album/' + a.id + '/tracks?limit=10');
    var tr = (d.data || []).filter(function (t) { return t.preview; })[0];
    if (!tr) { toast(T('Aucun extrait pour cet album')); return; }
    var ok = await playTrack(n, a.title + ' · ' + tr.title, tr.preview, 'album');
    if (ok && playing) { playing.album = a.id; renderCard(); }
  } catch (e) { dbg('album', e); toast(T('Erreur Deezer : {m}', { m: T(e.message) })); }
}
el('cdisc').addEventListener('toggle', function () { if (selected && el('cdisc').open) renderDisc(selected); });

/* ---------- Mes ecoutes : a ecouter, aime, ecoute ; garde dans le navigateur (cle mg-marks) ---------- */
var marks = {};
try { marks = JSON.parse(localStorage.getItem('mg-marks') || '{}') || {}; } catch (e) { dbg('marques illisibles', e); marks = {}; }
function saveMarks() {
  try { localStorage.setItem('mg-marks', JSON.stringify(marks)); } catch (e) { dbg('marques', e); }
  updateMyCount();
}
/* Compteur du bouton « Mes ecoutes » de la barre de recherche. */
function updateMyCount() {
  var c = el('mylistcount'), k = Object.keys(marks).length;
  if (!c) return;
  c.textContent = k ? String(k) : '';
  c.hidden = !k;
}
function setMark(n, s) {
  if (marks[n.id] && marks[n.id].s === s) delete marks[n.id];
  else marks[n.id] = { s: s, name: n.name, t: Date.now(), pic: n.pic || '' };
  saveMarks(); renderCard(); draw(); renderMyList();
}
var MARK_LABELS = { later: 'À écouter', liked: 'Aimé', heard: 'Écouté' };
/* Filtre « mes ecoutes » des reglages : tout, ou seulement les aimes, a ecouter ou ecoutes (les autres sont estompes). */
var markFilter = 'all';
try { var savedMf = localStorage.getItem('mg-markf'); if (/^(all|liked|later|heard)$/.test(savedMf || '')) markFilter = savedMf; } catch (e) { dbg('ignore', e); }
function renderMarkFilter() {
  document.querySelectorAll('#panel .mkbtns button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.getAttribute('data-mf') === markFilter ? 'true' : 'false');
  });
}
document.querySelectorAll('#panel .mkbtns button').forEach(function (b) {
  b.addEventListener('click', function () {
    markFilter = b.getAttribute('data-mf');
    try { localStorage.setItem('mg-markf', markFilter); } catch (e) { dbg('ignore', e); }
    renderMarkFilter(); draw();
    if (markFilter !== 'all' && !nodes.some(function (n) { return marks[n.id] && marks[n.id].s === markFilter; })) {
      toast(T('Aucun artiste de cette catégorie sur la carte'));
    }
  });
});
renderMarkFilter();
function renderMarks(n) {
  var m = marks[n.id];
  document.querySelectorAll('#cmarks button[data-mark]').forEach(function (b) {
    var k = b.getAttribute('data-mark');
    b.textContent = T(MARK_LABELS[k]);
    b.setAttribute('aria-pressed', m && m.s === k ? 'true' : 'false');
  });
  el('cmarks').setAttribute('aria-label', T('Mes écoutes'));
  el('atour').textContent = T('Écouter ses voisins');
  el('atour').hidden = !neighboursByScore(n).length;
}
document.querySelectorAll('#cmarks button[data-mark]').forEach(function (b) {
  b.addEventListener('click', function () { if (selected) setMark(selected, b.getAttribute('data-mark')); });
});
el('atour').addEventListener('click', function () { if (selected) startTour(selected); });
function exportMarks() {
  var ids = Object.keys(marks);
  if (!ids.length) { toast(T('Aucune écoute marquée pour l’instant')); return; }
  var groups = [['later', T('À écouter')], ['liked', T('Aimé')], ['heard', T('Écouté')]];
  var lines = ['Asterism · ' + T('Mes écoutes') + ' · ' + new Date().toLocaleDateString(LANG === 'en' ? 'en-GB' : 'fr-FR'), ''];
  groups.forEach(function (g) {
    var list = ids.filter(function (id) { return marks[id].s === g[0]; }).sort(function (a, b) { return marks[a].name.localeCompare(marks[b].name); });
    if (!list.length) return;
    lines.push(g[1] + ' (' + list.length + ')');
    list.forEach(function (id) { lines.push('- ' + marks[id].name + '  https://www.deezer.com/artist/' + id); });
    lines.push('');
  });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = 'asterism-mes-ecoutes.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  toast(T('{n} artistes exportés', { n: ids.length }));
}

/* ---------- Liste « Mes ecoutes » : tous les artistes marques, filtres par etat ---------- */
var listFilter = 'all';
function openMyList() { hideMenu(); el('help').hidden = true; el('mylist').hidden = false; renderMyList(); }
function closeMyList() { el('mylist').hidden = true; }
function setMarkById(id, s) {
  if (!marks[id]) return;
  if (marks[id].s === s) delete marks[id]; else { marks[id].s = s; marks[id].t = Date.now(); }
  saveMarks(); renderCard(); draw(); renderMyList();
}
async function goToMarked(id) {
  closeMyList();
  var n = byId.get(Number(id));
  if (n && isShown(n)) { select(n); if (typeof ensureOnScreen === 'function') ensureOnScreen(n); return; }
  try { addRoot(await dz('/artist/' + Number(id))); }
  catch (e) { dbg('mes ecoutes', e); toast(T('Erreur Deezer : {m}', { m: T(e.message) })); }
}
function renderMyList() {
  var box = el('mylist');
  if (box.hidden) return;
  box.textContent = '';
  box.setAttribute('aria-label', T('Mes écoutes'));
  var x = document.createElement('button'); x.type = 'button'; x.className = 'hx'; x.textContent = '×';
  x.setAttribute('aria-label', T('Fermer')); x.addEventListener('click', closeMyList);
  var h = document.createElement('h2'); h.textContent = T('Mes écoutes');
  box.append(x, h);
  var ids = Object.keys(marks), count = { all: ids.length, later: 0, liked: 0, heard: 0 };
  ids.forEach(function (id) { count[marks[id].s] = (count[marks[id].s] || 0) + 1; });
  var bar = document.createElement('div'); bar.className = 'mlf';
  [['all', 'Tout'], ['later', 'À écouter'], ['liked', 'Aimé'], ['heard', 'Écouté']].forEach(function (f) {
    var b = document.createElement('button'); b.type = 'button';
    b.textContent = T(f[1]) + ' (' + (count[f[0]] || 0) + ')';
    b.setAttribute('aria-pressed', listFilter === f[0] ? 'true' : 'false');
    b.addEventListener('click', function () { listFilter = f[0]; renderMyList(); });
    bar.appendChild(b);
  });
  box.appendChild(bar);
  var shown = ids.filter(function (id) { return listFilter === 'all' || marks[id].s === listFilter; })
    .sort(function (a, b) { return marks[b].t - marks[a].t; });
  if (!shown.length) {
    var e = document.createElement('div'); e.className = 'mle';
    e.textContent = ids.length ? T('Aucun artiste dans cette catégorie.')
      : T('Aucun artiste marqué. Dans la fiche d’un artiste, choisis « À écouter », « Aimé » ou « Écouté ».');
    box.appendChild(e);
  } else {
    var ul = document.createElement('ul');
    shown.forEach(function (id) {
      var m = marks[id], li = document.createElement('li');
      var img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
      if (m.pic) img.src = m.pic;
      var nm = document.createElement('button'); nm.type = 'button'; nm.className = 'link nm'; nm.textContent = m.name;
      nm.title = T('Ouvrir {name} sur la carte', { name: m.name });
      nm.addEventListener('click', function () { goToMarked(id); });
      var st = document.createElement('div'); st.className = 'st';
      ['later', 'liked', 'heard'].forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = T(MARK_LABELS[k]);
        b.setAttribute('aria-pressed', m.s === k ? 'true' : 'false');
        b.addEventListener('click', function () { setMarkById(id, k); });
        st.appendChild(b);
      });
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×';
      rm.title = T('Retirer de la liste'); rm.setAttribute('aria-label', rm.title);
      rm.addEventListener('click', function () { delete marks[id]; saveMarks(); renderCard(); draw(); renderMyList(); });
      li.append(img, nm, st, rm); ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  var foot = document.createElement('div'); foot.className = 'mlx';
  var note = document.createElement('span'); note.textContent = T('Gardé dans ce navigateur uniquement.');
  var ex = document.createElement('button'); ex.type = 'button'; ex.textContent = T('Exporter en texte');
  ex.disabled = !ids.length; ex.addEventListener('click', exportMarks);
  foot.append(note, ex); box.appendChild(foot);
}
el('mylistbtn').addEventListener('click', openMyList);
updateMyCount();
document.addEventListener('pointerdown', function (e) {
  var b = el('mylist');
  if (!b.hidden && !b.contains(e.target) && !el('mylistbtn').contains(e.target)) closeMyList();
});

/* Repli : quand Deezer n'a aucun extrait, l'API de recherche d'Apple (iTunes, sans cle, CORS ouvert) en fournit
   de 30 secondes. Pas d'identifiant commun entre les deux services : on n'accepte que les titres dont le nom
   d'artiste est identique au notre (casse, accents et apostrophes mis a part), pour limiter les homonymes. */
function strictName(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[‘’`´]/g, "'").replace(/\s+/g, ' ').trim();
}
async function appleTracks(n) {
  var url = 'https://itunes.apple.com/search?entity=song&attribute=artistTerm&limit=25&country=FR&term=' + encodeURIComponent(n.name);
  /* Deux voies : fetch, puis une balise script (JSONP) si le navigateur ou le reseau refuse la premiere. */
  var d;
  try {
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('Apple ' + resp.status);
    d = await resp.json();
  } catch (e1) {
    try { d = await jsonp(url, 8000, true); } catch (e2) { throw new Error((e1 && e1.message) + ' ; script : ' + (e2 && e2.message)); }
  }
  var want = strictName(n.name), seen = new Set(), list = [];
  (d.results || []).forEach(function (r) {
    if (!r.previewUrl || strictName(r.artistName) !== want) return;
    var key = strictName(r.trackName);
    if (seen.has(key) || list.length >= TOP_MAX) return;
    seen.add(key);
    list.push({ title: r.trackName, url: r.previewUrl });
  });
  return list;
}
async function loadTracks(n) {
  if (n.tracks !== undefined) return n.tracks;
  var list;
  try {
    var d = await dz('/artist/' + n.id + '/top?limit=' + TOP_MAX);
    list = (d.data || []).map(function (t) { return { title: t.title, url: t.preview || '' }; });
  } catch (e) {
    toast(T('Erreur Deezer : {m}', { m: T(e.message) }));
    return null;
  }
  n.tracksSrc = 'deezer';
  if (!list.some(function (t) { return t.url; })) {
    try {
      var alt = await appleTracks(n);
      if (alt.length) { list = alt; n.tracksSrc = 'apple'; }
      else n.appleNote = ['aucun titre au nom exact chez Apple'];
    } catch (e) { dbg('apple', e); n.appleNote = ['injoignable ({m})', { m: e && e.message ? e.message : 'erreur réseau' }]; }
  }
  n.tracks = list.length ? list : null;
  return n.tracks;
}

/* Volume du lecteur (0 a 1), memorise ; les fondus d'entree montent jusqu'a ce niveau. Couper le son garde le niveau choisi. */
var volLevel = 0.7, volSaved = 0.7;
try {
  var sv = parseFloat(localStorage.getItem('mg-vol'));
  if (isFinite(sv)) volLevel = Math.max(0, Math.min(1, sv));
} catch (e) { dbg('ignore', e); }
if (volLevel > 0) volSaved = volLevel;
function setVolume(v, keep) {
  volLevel = Math.max(0, Math.min(1, v));
  if (volLevel > 0 && !keep) volSaved = volLevel;
  clearInterval(fadeT);
  if (!audio.paused) audio.volume = volLevel;
  try { localStorage.setItem('mg-vol', String(volLevel)); } catch (e) { dbg('ignore', e); }
  renderVol();
}
function renderVol() {
  var off = volLevel === 0;
  el('vol').value = Math.round(volLevel * 100);
  el('player').classList.toggle('muted', off);
  var lb = off ? T('Rétablir le son') : T('Couper le son');
  el('volbtn').setAttribute('aria-label', lb); el('volbtn').title = lb;
  el('vol').setAttribute('aria-label', T('Volume'));
  el('vol').title = T('Volume : {n} %', { n: Math.round(volLevel * 100) });
}
el('vol').addEventListener('input', function (e) { setVolume(e.target.value / 100); });
el('volbtn').addEventListener('click', function () { setVolume(volLevel > 0 ? 0 : (volSaved || 0.7), true); });
renderVol();

function fade(to, ms, done) {
  clearInterval(fadeT);
  var from = audio.volume, steps = 10, i = 0;
  fadeT = setInterval(function () {
    i++;
    audio.volume = clamp(from + (to - from) * i / steps, 0, 1);
    if (i >= steps) { clearInterval(fadeT); if (done) done(); }
  }, ms / steps);
}

function stopAudio() {
  playToken++;
  playing = null;
  if (!audio.paused) fade(0, 200, function () { audio.pause(); });
  renderCard();
}

function togglePause() {
  if (!playing) return;
  if (playing.paused) {
    playing.paused = false;
    audio.volume = 0;
    audio.play().then(function () { fade(volLevel, 200); }).catch(function () {});
  } else {
    playing.paused = true;
    fade(0, 150, function () { if (playing && playing.paused) audio.pause(); });
  }
  renderCard();
}

async function togglePlay(n, i) {
  if (playing && playing.id === n.id && playing.idx === i) { togglePause(); return; }
  var tok = ++playToken;
  var tracks = await loadTracks(n);
  if (tok !== playToken) return;
  if (!tracks) { renderCard(); return; }
  var idx = i;
  if (!tracks[idx].url) idx = tracks.findIndex(function (x) { return x.url; });
  if (idx < 0) { renderCard(); return; }
  playing = { id: n.id, idx: idx, paused: false };
  audio.src = tracks[idx].url; audio.volume = 0;
  renderCard();
  try {
    await audio.play();
    if (tok !== playToken) { audio.pause(); return; }
    fade(volLevel, 300);
  } catch (e) {
    if (tok === playToken) {
      playing = null; renderCard();
      el('chint').textContent = T('Lecture bloquée par le navigateur');
    }
  }
}

el('aexp').addEventListener('click', function () {
  if (selected) { expand(selected); renderCard(); }
});
el('alisten').addEventListener('click', function () {
  var n = selected;
  if (!n) return;
  if (playing && playing.id === n.id) togglePause(); else togglePlay(n, 0);
});
el('atop').addEventListener('click', async function () {
  var n = selected;
  if (!n) return;
  n.showTop = !n.showTop;
  if (n.showTop) await loadTracks(n);
  if (selected === n) renderCard();
});
el('cclose').addEventListener('click', function () { select(null); });
el('cmin').addEventListener('click', function () { cardMin = !cardMin; renderCard(); });
el('sound').addEventListener('change', function (e) {
  hoverPlay = e.target.checked;
  try { localStorage.setItem('mg-hover', hoverPlay ? '1' : '0'); } catch (err) { dbg('ignore', err); }
  clearTimeout(hoverTimer);
  if (!hoverPlay && playing && playing.hover) stopAudio();
  else if (hoverPlay && hovered) hoverStart(hovered);
});
el('extopt').checked = extOn;
/* La legende reste visible : Deezer, radio et collaborations sont toujours actifs ; les types reserves aux sources
   etendues (labels, ListenBrainz, MusicBrainz) sont grises tant que l'option est decochee. */
function updateLegendState() {
  el('extlegend').hidden = false;
  document.querySelectorAll('#extlegend input[data-kind]').forEach(function (inp) {
    var dis = !extOn && ALWAYS_KINDS.indexOf(inp.getAttribute('data-kind')) < 0;
    inp.disabled = dis;
    inp.closest('.lg').classList.toggle('dis', dis);
  });
}
updateLegendState();
/* Active ou desactive les sources etendues (case des reglages, ou bouton « Essayer » de la fiche). */
function setExt(on) {
  extOn = on;
  updateNudge();
  el('extopt').checked = on;
  updateLegendState();
  try { localStorage.setItem('mg-ext', on ? '1' : '0'); } catch (err) { dbg('ignore', err); }
  applyKinds();
  if (!on) refresh();   /* efface le message « N liens ajoutes » devenu faux */
  if (on && selected && selected.expanded && !selected.ext) { commit(); enrich(selected); }
}
el('extopt').addEventListener('change', function (e) { setExt(e.target.checked); });
/* Cases de la legende : un type de lien par case, memorise dans le navigateur. */
document.querySelectorAll('#extlegend input[data-kind]').forEach(function (inp) {
  var kind = inp.getAttribute('data-kind');
  inp.checked = kindsOn[kind];
  inp.addEventListener('change', function () {
    kindsOn[kind] = inp.checked;
    try { localStorage.setItem('mg-kinds', JSON.stringify(kindsOn)); } catch (err) { dbg('ignore', err); }
    applyKinds();
  });
});

/* Jauge de score minimal : masque les liens dont le score est inferieur au seuil. */
function updateFanLabel() {
  var out = 0;
  nodes.forEach(function (n) { if (bigNode(n)) out++; });
  el('fanv').textContent = fanMax ? '≤ ' + fanMax.toLocaleString(LANG === 'en' ? 'en-US' : 'fr-FR') + (out ? ' (' + out + ')' : '') : T('Tout');
}
el('fanmax').value = fanIdx; updateFanLabel();
el('fanmax').addEventListener('input', function (e) {
  fanIdx = +e.target.value; fanMax = FAN_STEPS[fanIdx];
  try { localStorage.setItem('mg-fan', String(fanIdx)); } catch (err) { dbg('ignore', err); }
  updateFanLabel(); draw();
});
el('topn').value = topN; el('topv').textContent = topN;
el('topn').addEventListener('input', function (e) {
  topN = +e.target.value;
  el('topv').textContent = topN;
  try { localStorage.setItem('mg-top', String(topN)); } catch (err) { dbg('ignore', err); }
  renderCard();
});
el('minscore').value = Math.round(minScore * 100);
el('minscore').addEventListener('input', function (e) {
  minScore = (+e.target.value) / 100;
  try { localStorage.setItem('mg-min', String(Math.round(minScore * 100))); } catch (err) { dbg('ignore', err); }
  applyKinds();
});

var seeking = false;
var bar = document.querySelector('#player .bar');
function seekTo(e) {
  if (!playing || !audio.duration) return;
  var r = bar.getBoundingClientRect();
  var f = clamp((e.clientX - r.left) / r.width, 0, 1);
  audio.currentTime = f * audio.duration;
  el('cbar').style.width = (100 * f) + '%';
}
bar.addEventListener('pointerdown', function (e) { seeking = true; bar.setPointerCapture(e.pointerId); seekTo(e); });
bar.addEventListener('pointermove', function (e) { if (seeking) seekTo(e); });
bar.addEventListener('pointerup', function () { seeking = false; });
bar.addEventListener('pointercancel', function () { seeking = false; });

audio.addEventListener('timeupdate', function () {
  if (!seeking && audio.duration) el('cbar').style.width = (100 * audio.currentTime / audio.duration) + '%';
  updateNowTime();
});
el('cnowpp').addEventListener('click', function () { if (playing) togglePause(); });
audio.addEventListener('ended', function () {
  var wasTour = tour && playing && playing.kind === 'tour';
  playing = null; renderCard();
  if (wasTour) tourGo(1);
});
