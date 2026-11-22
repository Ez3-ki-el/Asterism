/* Asterism : Focus, rendu du graphe sur le canevas, interactions (zoom, glisser, survol, clic).
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Focus ---------- */
function recomputeVisible() {
  if (!selected || focusDepth === 0) { visible = null; return; }
  var seen = new Set([selected.id]), frontier = [selected.id];
  for (var d = 0; d < focusDepth; d++) {
    var next = [];
    frontier.forEach(function (id) {
      adj.get(id).forEach(function (o) { if (!seen.has(o)) { seen.add(o); next.push(o); } });
    });
    frontier = next;
  }
  visible = seen;
}

function select(n) {
  if (tour && !tourSelecting) stopTour();
  /* Le lecteur a son propre encart : la musique continue quand on ferme la fiche ou qu'on regarde un autre artiste.
     Seule l'ecoute au survol s'arrete en changeant d'artiste. */
  if (playing && playing.hover && (!n || playing.id !== n.id)) stopAudio();
  if (playing && n && playing.id === n.id) playing.hover = false;
  selected = n;
  recomputeVisible();
  renderCard();
  draw();
  if (n) ensureWd(n).then(function () { if (selected === n) renderCard(); });
  if (n) loadStylesFor(n);
}

/* ---------- Rendu ---------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
  var k = transform.k, f = hovered, nb = f ? adj.get(f.id) : null, i, l, n;
  /* Chemin affiche (path.js, charge apres ce fichier : draw() tourne deja au chargement, d'ou les gardes typeof). */
  var ps = typeof pathAlive === 'function' ? pathAlive() : null, pf = ps ? 0.22 : 1;
  var pp = typeof pathPick !== 'undefined' ? pathPick : null;

  var dimRoot = focusDepth > 0 && selected && !selected.root;
  function isDim(lk) {
    return dimRoot && (lk.source.root || lk.target.root) && lk.source !== selected && lk.target !== selected;
  }
  function pass(test, alpha) {
    ctx.beginPath();
    for (i = 0; i < links.length; i++) {
      l = links[i];
      if (typeof l.source !== 'object' || !vis(l.source) || !vis(l.target)) continue;
      if (f && (l.source === f || l.target === f)) continue;
      if (!test(l)) continue;
      ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y);
    }
    ctx.globalAlpha = alpha * pf; ctx.strokeStyle = C.link; ctx.lineWidth = 1 / k;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function plain(lk) { return ekOf(lk) === 'd'; }
  var anyDim = fanMax > 0 || (typeof markFilter !== 'undefined' && markFilter !== 'all');
  function toBig(lk) { return anyDim && (dimNode(lk.source) || dimNode(lk.target)); }
  pass(function (lk) { return plain(lk) && !isDim(lk) && !toBig(lk); }, f ? 0.35 : 1);
  if (dimRoot) pass(function (lk) { return plain(lk) && isDim(lk) && !toBig(lk); }, f ? 0.12 : 0.33);
  if (anyDim) pass(function (lk) { return plain(lk) && toBig(lk); }, f ? 0.05 : 0.08);

  /* Liens des sources etendues : pointille fin = collaboration, tirets = ListenBrainz,
     trait plein epais = confirme par plusieurs sources ; l'epaisseur suit le poids. */
  for (i = 0; i < links.length; i++) {
    l = links[i];
    var ek = ekOf(l);
    if (!ek || ek === 'd' || typeof l.source !== 'object' || !vis(l.source) || !vis(l.target)) continue;
    if (f && (l.source === f || l.target === f)) continue;
    var multi = ek.length > 1, wgt = 1 + (l.w || 0) * 0.8;
    ctx.beginPath();
    ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y);
    ctx.globalAlpha = pf * (f ? 0.35 : 1) * (isDim(l) ? 0.35 : 1) * (toBig(l) ? 0.2 : 1) * (multi ? 0.45 : 1) * fadeOf(l);
    ctx.strokeStyle = multi ? C.ink : C.link;
    ctx.lineWidth = (multi ? 1.25 : 1) * wgt / k;
    ctx.setLineDash(multi ? [] : (ek === 'c' ? [1.5 / k, 3.5 / k]
      : ek === 'e' ? [8 / k, 3 / k, 1.5 / k, 3 / k]
      : ek === 'p' ? [10 / k, 3 / k, 2 / k, 3 / k, 2 / k, 3 / k]
      : ek === 'i' ? [2 / k, 2 / k, 2 / k, 6 / k]
      : ek === 'r' ? [14 / k, 4 / k] : [5 / k, 4 / k]));
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  if (ps) {
    ctx.beginPath();
    for (i = 1; i < ps.list.length; i++) {
      ctx.moveTo(ps.list[i - 1].x, ps.list[i - 1].y); ctx.lineTo(ps.list[i].x, ps.list[i].y);
    }
    ctx.strokeStyle = C.accent; ctx.lineWidth = 3.2 / k; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  }

  if (f) {
    ctx.beginPath();
    for (i = 0; i < links.length; i++) {
      l = links[i];
      if (typeof l.source !== 'object' || !ekOf(l)) continue;
      if (l.source === f || l.target === f) { ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); }
    }
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5 / k; ctx.stroke();
  }

  if (hoveredLink && ekOf(hoveredLink) && typeof hoveredLink.source === 'object') {
    ctx.beginPath();
    ctx.moveTo(hoveredLink.source.x, hoveredLink.source.y); ctx.lineTo(hoveredLink.target.x, hoveredLink.target.y);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2 / k; ctx.stroke();
  }

  var now = performance.now();
  for (i = 0; i < nodes.length; i++) {
    n = nodes[i];
    if (!isShown(n)) continue;
    var v = vis(n), a = v ? 1 : 0.07;
    if (f && v && n !== f && !nb.has(n.id)) a = 0.2;
    if (dimNode(n)) a = Math.min(a, 0.12);
    if (ps && !ps.ids.has(n.id)) a = Math.min(a, 0.18);
    a *= fadeOf(n);
    ctx.globalAlpha = a;
    var r = R(n), hot = (n === f || n.root || (ps && ps.ids.has(n.id)) || n === pp);
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832);
    if (n.imgOk && r * k >= 6) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(n.img, n.x - r, n.y - r, 2 * r, 2 * r);
      ctx.restore();
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832);
      ctx.strokeStyle = hot ? C.accent : C.ink;
      ctx.lineWidth = (hot ? 2.5 : n.expanded ? 2 : 1) / k;
      ctx.stroke();
    } else if (hot) {
      ctx.fillStyle = C.accent; ctx.fill();
    } else if (n.expanded) {
      ctx.fillStyle = C.ink; ctx.fill();
    } else {
      ctx.fillStyle = C.bg; ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2 / k; ctx.stroke();
    }
    if (n === selected) {
      ctx.beginPath(); ctx.arc(n.x, n.y, R(n) + 3 / k + 1, 0, 6.2832);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5 / k; ctx.stroke();
    }
    if (playing && !playing.paused && playing.id === n.id) {
      var phase = (now % 1800) / 1800;
      for (var wv = 0; wv < 2; wv++) {
        var pw = (phase + wv * 0.5) % 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, r * (1.08 + pw * 0.7), 0, 6.2832);
        ctx.globalAlpha = a * (1 - pw) * 0.85;
        ctx.strokeStyle = C.accent; ctx.lineWidth = 2 / k; ctx.stroke();
      }
      ctx.globalAlpha = a;
    }
    var mk = marks[n.id];
    if (mk) {
      /* Mes ecoutes : anneau autour de la photo. Plein orange = aime, tirets orange = a ecouter, pointille fin couleur du texte = ecoute. */
      ctx.save();
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 2 / k, 0, 6.2832);
      ctx.lineWidth = 2.6 / k;
      ctx.strokeStyle = mk.s === 'heard' ? C.ink : C.accent;
      if (mk.s === 'later') ctx.setLineDash([4 / k, 3 / k]);
      if (mk.s === 'heard') { ctx.lineWidth = 2.2 / k; ctx.setLineDash([1.2 / k, 2.8 / k]); }
      ctx.stroke();
      ctx.restore();
    }
    if (n.pinned) {
      ctx.fillStyle = C.accent;
      ctx.fillRect(n.x + r * 0.7, n.y - r * 0.7 - 5 / k, 5 / k, 5 / k);
    }
    if (n.loading) {
      var pr = R(n) + 4 + Math.sin(now / 160) * 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, pr, 0, 6.2832);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5 / k; ctx.stroke();
    }
    /* Sources etendues en cours : anneau en pointilles qui tourne autour de l'artiste, les nouveaux voisins arrivent ensemble. */
    if (n.enriching) {
      var er = R(n) + 7 / k + 3;
      ctx.save();
      for (var wv2 = 0; wv2 < 3; wv2++) {
        var ph2 = ((now / 2400) + wv2 / 3) % 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, R(n) + (10 + ph2 * 70) / k, 0, 6.2832);
        ctx.globalAlpha = (1 - ph2) * 0.75; ctx.strokeStyle = C.accent; ctx.lineWidth = 2 / k; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(n.x, n.y, er, 0, 6.2832);
      ctx.setLineDash([4 / k, 5 / k]); ctx.lineDashOffset = -now / 60 / k;
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.6 / k; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 300);
      ctx.stroke();
      ctx.restore();
    }
    /* A l'arrivee des nouveaux artistes : un halo orange qui s'etend et s'efface (1,8 s). */
    if (n.flash) {
      var ft = (now - n.flash) / 1800;
      if (ft >= 1) n.flash = 0;
      else {
        ctx.save();
        ctx.beginPath(); ctx.arc(n.x, n.y, R(n) + (3 + ft * 18) / k, 0, 6.2832);
        ctx.globalAlpha = (1 - ft) * 0.9; ctx.strokeStyle = C.accent; ctx.lineWidth = 2.2 / k; ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* Score de compatibilite au milieu du lien survole, ou du lien entre le noeud survole et la selection. */
  var hl = hoveredLink || ((f && selected && f !== selected)
    ? linkKeys.get(f.id < selected.id ? f.id + '-' + selected.id : selected.id + '-' + f.id) : null);
  if (hl && ekOf(hl) && typeof hl.source === 'object') {
    var ptxt = Math.round(scoreOf(hl).score * 100) + ' %';
    var mx = (hl.source.x + hl.target.x) / 2, my = (hl.source.y + hl.target.y) / 2;
    ctx.save();
    ctx.font = (12 / k) + 'px ' + C.mono;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(ptxt).width, pd = 6 / k;
    ctx.globalAlpha = 1; ctx.fillStyle = C.bg;
    ctx.fillRect(mx - tw / 2 - pd, my - 9 / k, tw + 2 * pd, 18 / k);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1 / k;
    ctx.strokeRect(mx - tw / 2 - pd, my - 9 / k, tw + 2 * pd, 18 / k);
    ctx.fillStyle = C.accent; ctx.fillText(ptxt, mx, my);
    ctx.restore();
  }

  var base = clamp((k - 0.3) / 0.4, 0, 1);
  ctx.font = (11 / k) + 'px ' + C.mono;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = C.ink;
  var cand = [];
  for (i = 0; i < nodes.length; i++) {
    n = nodes[i];
    if (!vis(n)) continue;
    var strong = n === f || n === selected || n.root || (f && nb.has(n.id)) || (ps && ps.ids.has(n.id)) || n === pp;
    if (!strong && (f || ps || base <= 0.02 || dimNode(n))) continue;
    cand.push({ n: n, strong: strong });
  }
  cand.sort(function (a, b) {
    if (a.strong !== b.strong) return a.strong ? -1 : 1;
    return b.n.deg - a.n.deg;
  });
  var nbx = [];
  for (i = 0; i < nodes.length; i++) {
    n = nodes[i];
    if (!vis(n)) continue;
    var nsx = n.x * k + transform.x, nsy = n.y * k + transform.y, nrr = R(n) * k + 1;
    nbx.push([nsx - nrr, nsy - nrr, nsx + nrr, nsy + nrr, n]);
  }
  var placed = [];
  for (i = 0; i < cand.length; i++) {
    n = cand[i].n;
    if (n._lw === undefined) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = '11px ' + C.mono;
      n._lw = ctx.measureText(n.name).width;
      ctx.restore();
    }
    var lx = n.x * k + transform.x, ly = n.y * k + transform.y + R(n) * k + 4;
    var bx0 = lx - n._lw / 2 - 3, bx1 = lx + n._lw / 2 + 3, by0 = ly - 1, by1 = ly + 14;
    if (!cand[i].strong) {
      var clash = false;
      for (var pi = 0; pi < placed.length; pi++) {
        var rc = placed[pi];
        if (bx0 < rc[2] && bx1 > rc[0] && by0 < rc[3] && by1 > rc[1]) { clash = true; break; }
      }
      for (var ni = 0; ni < nbx.length && !clash; ni++) {
        var nb2 = nbx[ni];
        if (nb2[4] === n) continue;
        if (bx0 < nb2[2] && bx1 > nb2[0] && by0 < nb2[3] && by1 > nb2[1]) clash = true;
      }
      if (clash) continue;
    }
    placed.push([bx0, by0, bx1, by1]);
    ctx.globalAlpha = (cand[i].strong ? 1 : base) * fadeOf(n);
    ctx.fillText(n.name, n.x, n.y + R(n) + 4 / k);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

var anim = false;
function startAnim() { if (anim) return; anim = true; requestAnimationFrame(loop); }
function loop() {
  draw();
  var busy = nodes.some(function (n) { return n.loading || n.enriching; }) || (playing && !playing.paused)
    || performance.now() < fadeUntil;
  if (busy) requestAnimationFrame(loop); else anim = false;
}

/* ---------- Interaction : zoom, glisser, survol ---------- */
function evPos(e) {
  var s = e.sourceEvent || e;
  var t = (s.touches && s.touches[0]) || (s.changedTouches && s.changedTouches[0]) || s;
  var r = canvas.getBoundingClientRect();
  return [t.clientX - r.left, t.clientY - r.top];
}

function nodeAt(pos) {
  var p = transform.invert(pos), k = transform.k;
  for (var i = nodes.length - 1; i >= 0; i--) {
    var n = nodes[i];
    if (!vis(n)) continue;
    var dx = n.x - p[0], dy = n.y - p[1], r = R(n) + PAD / k;
    if (dx * dx + dy * dy <= r * r) return n;
  }
  return null;
}

var PAD = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 12 : 4;
var lastMultiAt = 0, lastTap = { id: null, t: 0 };
function pinching(ms) { return Date.now() - lastMultiAt < ms; }
function noteMulti(e) { if (e.touches && e.touches.length > 1) lastMultiAt = Date.now(); }
window.addEventListener('touchstart', noteMulti, { passive: true });
window.addEventListener('touchmove', noteMulti, { passive: true });

var zoom = d3.zoom().scaleExtent([0.1, 8])
  .filter(function (e) {
    if (e.type === 'wheel') return true;
    if (e.type === 'touchstart') return (e.touches && e.touches.length > 1) || !nodeAt(evPos(e));
    if (e.type === 'mousedown') return !nodeAt(evPos(e)) && !e.button;
    return false;
  })
  .on('zoom', function (e) { transform = e.transform; draw(); });

var drag = d3.drag().container(canvas)
  .subject(function (e) {
    var n = nodeAt(evPos(e));
    return n ? { x: transform.applyX(n.x), y: transform.applyY(n.y), node: n } : null;
  })
  .on('start', function (e) {
    dragging = true;
    var s = e.subject, p = transform.invert([e.x, e.y]);
    s.moved = false; s.sx = e.x; s.sy = e.y;
    if (!e.active) sim.alphaTarget(0.25).restart();
    s.node.fx = p[0]; s.node.fy = p[1];
  })
  .on('drag', function (e) {
    if (pinching(120)) return;
    var s = e.subject, p = transform.invert([e.x, e.y]);
    s.node.fx = p[0]; s.node.fy = p[1];
    if (Math.hypot(e.x - s.sx, e.y - s.sy) > 4) s.moved = true;
  })
  .on('end', function (e) {
    var s = e.subject, n = s.node;
    if (!e.active) sim.alphaTarget(0);
    if (!n.pinned) { n.fx = null; n.fy = null; }
    dragging = false;
    if (!s.moved && !pinching(350)) {
      if (typeof pathClick === 'function' && pathClick(n)) return;
      select(n);
      if (e.sourceEvent && /^touch/.test(e.sourceEvent.type)) {
        var tnow = Date.now();
        if (lastTap.id === n.id && tnow - lastTap.t < 350) {
          lastTap.t = 0;
          expand(n); renderCard();
        } else {
          lastTap = { id: n.id, t: tnow };
        }
      }
    }
  });

var sel = d3.select(canvas);
sel.call(drag).call(zoom).on('dblclick.zoom', null);
sel.call(zoom.transform, d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2));

/* Lien sous le curseur : distance en pixels ecran au segment ; un noeud a toujours la priorite. */
var LPAD = PAD + 3, ltipTimer = null;
function distToSeg(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  var t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function linkAt(pos) {
  var best = null, bd = LPAD;
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (typeof l.source !== 'object' || !ekOf(l) || !vis(l.source) || !vis(l.target)) continue;
    var d = distToSeg(pos[0], pos[1], transform.applyX(l.source.x), transform.applyY(l.source.y),
      transform.applyX(l.target.x), transform.applyY(l.target.y));
    if (d <= bd) { bd = d; best = l; }
  }
  return best;
}

/* Preuves d'un score, lisibles d'un coup d'oeil : le trait et le nom de la source, puis un fait par ligne. */
function partsEl(parts) {
  var box = document.createElement('div');
  parts.forEach(function (x) {
    var p = document.createElement('div'); p.className = 'prt';
    var h = document.createElement('div'); h.className = 'ph';
    h.insertAdjacentHTML('afterbegin', sampleSvg(x.src));
    var nm = document.createElement('span'); nm.textContent = x.name; h.appendChild(nm);
    p.appendChild(h);
    x.lines.forEach(function (l) {
      var d = document.createElement('div'); d.className = 'pd'; d.textContent = l; p.appendChild(d);
    });
    box.appendChild(p);
  });
  return box;
}

/* Infobulle d'un lien : score et origine de chaque preuve, avec le trait de la source. */
var ltip = document.createElement('div');
ltip.id = 'ltip'; ltip.hidden = true;
app.appendChild(ltip);
function moveLinkTip(cx, cy) {
  var r = app.getBoundingClientRect();
  var x = Math.min(cx - r.left + 14, W - ltip.offsetWidth - 8);
  var y = Math.min(cy - r.top + 16, H - ltip.offsetHeight - 8);
  ltip.style.left = Math.max(8, x) + 'px';
  ltip.style.top = Math.max(8, y) + 'px';
}
function showLinkTip(lk, cx, cy) {
  var sc = scoreOf(lk);
  ltip.textContent = '';
  var h = document.createElement('div');
  h.className = 'th';
  h.textContent = T('{a} et {b} : {n} %', { a: lk.source.name, b: lk.target.name, n: Math.round(sc.score * 100) });
  ltip.appendChild(h);
  ltip.appendChild(partsEl(sc.parts));
  ltip.hidden = false;
  moveLinkTip(cx, cy);
}
function hideLinkTip() { clearTimeout(ltipTimer); if (ltip) ltip.hidden = true; }

/* Info-bulle d'un artiste survole : nom, fans, liens. Utile quand les noms sont masques par le zoom. */
var ntip = document.createElement('div');
ntip.id = 'ntip'; ntip.hidden = true;
app.appendChild(ntip);
function hideNodeTip() { ntip.hidden = true; }
function showNodeTip(n, cx, cy) {
  ntip.textContent = '';
  var b = document.createElement('b'), sp = document.createElement('span');
  b.textContent = n.name;
  var bits = [];
  if (typeof n.fans === 'number') bits.push(T('{n} fans', { n: loc(n.fans) }));
  bits.push(T(n.deg > 1 ? '{n} liens' : '{n} lien', { n: n.deg }));
  sp.textContent = bits.join(' · ');
  ntip.append(b, sp);
  ntip.hidden = false;
  var r = app.getBoundingClientRect();
  ntip.style.left = Math.max(8, Math.min(cx - r.left + 14, W - ntip.offsetWidth - 8)) + 'px';
  ntip.style.top = Math.max(8, Math.min(cy - r.top + 16, H - ntip.offsetHeight - 8)) + 'px';
}
canvas.addEventListener('pointerdown', hideNodeTip);
canvas.addEventListener('wheel', hideNodeTip, { passive: true });

canvas.addEventListener('pointermove', function (e) {
  if (dragging || e.pointerType === 'touch') return;
  var pos = evPos(e);
  var n = nodeAt(pos);
  var lk = n ? null : linkAt(pos);
  canvas.style.cursor = (n || lk) ? 'pointer' : 'grab';
  setHover(n);
  if (n && menu.hidden) showNodeTip(n, e.clientX, e.clientY); else hideNodeTip();
  if (lk !== hoveredLink) {
    hoveredLink = lk;
    if (lk) showLinkTip(lk, e.clientX, e.clientY); else hideLinkTip();
    draw();
  } else if (lk) {
    moveLinkTip(e.clientX, e.clientY);
  }
});
canvas.addEventListener('pointerleave', function () {
  hideNodeTip();
  if (dragging) return;
  setHover(null);
  if (hoveredLink) { hoveredLink = null; hideLinkTip(); draw(); }
});
canvas.addEventListener('click', function (e) {
  var pos = evPos(e);
  if (nodeAt(pos)) return;
  var lk = linkAt(pos);
  if (lk) {
    hoveredLink = lk; showLinkTip(lk, e.clientX, e.clientY); draw();
    clearTimeout(ltipTimer);
    if (window.matchMedia('(pointer: coarse)').matches) {
      ltipTimer = setTimeout(function () { hoveredLink = null; hideLinkTip(); draw(); }, 4500);
    }
    return;
  }
  hoveredLink = null; hideLinkTip();
  select(null);
});
canvas.addEventListener('dblclick', function (e) {
  var n = nodeAt(evPos(e));
  if (n) { select(n); expand(n); renderCard(); }
});
