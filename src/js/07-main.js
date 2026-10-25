'use strict';
/* FIRMAMENT · pętla główna i interakcja
   Renderowanie klatek, profile jakości, animacje (przeloty, płynny zoom, bezwładność),
   wybieranie obiektów i karta informacji, obsługa myszy/dotyku/klawiatury, cele i wycieczka,
   tryb fotograficzny i eksport zdjęć w wysokiej rozdzielczości. */
// ---------------------------------------------------------------- renderer and main loop
const glCanvas = $('#gl'), ov = $('#ov'), octx = ov.getContext('2d');
let sky = null, thumbGL = null, curView = null, glDirty = true, ovDirty = true, thumbsDirty = true, thumbT = 0;
let prGL = 1, prOV = 1, mwImg = null;
/* Profile jakości: pr – gęstość pikseli renderu, lo – rozdzielczość nieba w ruchu,
   aa – liczba próbek dopracowania po zatrzymaniu, spf – próbek na klatkę. */
const QUAL = {
  eco: { name: 'Oszczędna', pr: d => Math.max(0.5, Math.min(d, 2) * 0.75), lo: 0.4, aa: 1, note: 'Niższa rozdzielczość, niebo w pełnej rozdzielczości bez wygładzania. Dla słabszych laptopów.' },
  bal: { name: 'Zrównoważona', pr: d => Math.min(d, 1.5), lo: 0.5, aa: 4, note: 'Po zatrzymaniu niebo dopracowuje się 4 próbkami.' },
  high: { name: 'Wysoka', pr: d => Math.min(d, 2), lo: 0.5, aa: 8, note: 'Natywna gęstość ekranu, 8 próbek dopracowania w buforze HDR.' },
  ultra: { name: 'Ultra', pr: d => Math.min(d * 1.5, 3), lo: 0.6, aa: 16, spf: 2, note: 'Nadpróbkowanie 1,5× i 16 próbek. Najostrzej, ale wymaga mocnej karty graficznej.' }
};
const Q = () => QUAL[settings.quality] || QUAL.high;
function invalidate() { glDirty = true; ovDirty = true; thumbsDirty = true; }
try { sky = new SkyGL(glCanvas); } catch (e) { console.error(e); const d = document.createElement('div'); d.id = 'nogl'; d.textContent = 'Ta wizualizacja potrzebuje WebGL, którego ta przeglądarka nie udostępnia. Spróbuj w aktualnym Chrome, Firefoksie lub Safari.'; $('#stage').appendChild(d); }
function resize() {
  const r = $('#stage').getBoundingClientRect(); W = Math.max(50, r.width); H = Math.max(50, r.height);
  const dpr = window.devicePixelRatio || 1;
  prGL = Q().pr(dpr); prOV = Math.min(dpr, 2);
  if (sky) prGL = Math.min(prGL, sky.maxDim / Math.max(W, H));
  glCanvas.width = Math.round(W * prGL); glCanvas.height = Math.round(H * prGL);
  ov.width = Math.round(W * prOV); ov.height = Math.round(H * prOV);
  invalidate();
}
new ResizeObserver(resize).observe($('#stage'));
resize();
const t0 = performance.now();
let skyKeyLast = '', skyKeyT = 0, refineK = 0;
function renderGL(view, now) {
  if (!sky) return;
  const q = Q();
  const R = buildR(view, disp, { pr: prGL, starPr: prGL, loScale: q.lo, time: (now - t0) / 1000, exposure: photo.on ? photo.exp : 1, art: artList(view) });
  if (R.skyKey !== skyKeyLast) { skyKeyLast = R.skyKey; skyKeyT = now; }
  R.refine = now - skyKeyT > 130 && !drag && !pinch; R.aa = q.aa; R.samplesPerFrame = q.spf || 1;
  refineK = sky.render(R);
}
const refineDone = () => !sky || refineK >= Q().aa;
function renderOV(view) { octx.setTransform(prOV, 0, 0, prOV, 0, 0); drawOverlay(octx, view, disp, { clean: photo.on }); }

// --- animation state
let fly = null, zoomA = null, inertia = null, tour = null, drag = null, pinch = null;
const hist = []; let histI = -1, histT = 0;
function snap() { return { mode: st.mode, proj: st.proj, lon: st.lon, lat: st.lat, roll: st.roll, fov: st.fov }; }
function scheduleHist() { clearTimeout(histT); histT = setTimeout(pushHist, 550); }
function pushHist() {
  const s = snap(); const last = hist[histI];
  if (last && last.mode === s.mode && Math.abs(angDiff(last.lon, s.lon)) < 0.5 && Math.abs(last.lat - s.lat) < 0.5 && Math.abs(Math.log(last.fov / s.fov)) < 0.05) return;
  hist.splice(histI + 1); hist.push(s); if (hist.length > 60) hist.shift(); histI = hist.length - 1; syncHistUI();
}
function goHist(d) { const i = histI + d; if (i < 0 || i >= hist.length) return; histI = i; const s = hist[i]; if (s.mode !== st.mode) setMode(s.mode, true); st.proj = s.proj; syncNavUI(); flyTo(eqOfFrame(vec(s.lon, s.lat)), s.fov, { roll: s.roll, noHist: true }); syncHistUI(); }
function syncHistUI() { $('#b-back').disabled = histI <= 0; $('#b-fwd').disabled = histI >= hist.length - 1; }

function flyTo(target, fov1, o = {}) {
  const getT = typeof target === 'function' ? target : () => target;
  const from = vec(st.lon, st.lat); const to = frameOf(getT());
  const dist = angDist(from, to); fov1 = clampFov(fov1 == null ? st.fov : fov1);
  const dur = settings.reduce ? 0.001 : settings.flyDur * (0.8 + 0.9 * Math.min(1, dist / 110) + 0.3 * Math.min(1, Math.abs(Math.log(fov1 / st.fov)) / 2.5));
  fly = { t: 0, dur, getT, from, fov0: st.fov, fov1, roll0: st.roll, roll1: o.roll != null ? o.roll : (st.mode === 'hor' ? 0 : st.roll), peak: Math.max(st.fov, fov1, Math.min(maxFov() * 0.8, dist * 1.25)), done: o.done, noHist: o.noHist };
  zoomA = null; inertia = null;
}
function stepFly(dt) {
  fly.t = Math.min(1, fly.t + dt / fly.dur); const e = ease(fly.t);
  const to = frameOf(fly.getT());
  const cv = slerp(fly.from, to, e); const [lo, la] = sph(cv); st.lon = lo; st.lat = clamp(la, -89.99, 89.99);
  const a = Math.log(fly.fov0), b = Math.log(fly.peak), c2 = Math.log(fly.fov1);
  st.fov = Math.exp((1 - e) * (1 - e) * a + 2 * (1 - e) * e * b + e * e * c2);
  st.roll = fly.roll0 + angDiff(fly.roll1, fly.roll0) * e;
  if (fly.t >= 1) { const f = fly; fly = null; if (!f.noHist) scheduleHist(); f.done && f.done(); }
}
function viewWith(lon, lat) { return computeView({ lon, lat, roll: st.roll, fov: st.fov, proj: st.proj, F: frameF(), refr: refrOn() }, W, H); }
function dragTo(vEq, x, y) {
  for (let it = 0; it < 5; it++) {
    const v0 = viewWith(st.lon, st.lat); if (!pj(v0, vEq)) return; const x0 = P[0], y0 = P[1];
    const ex = x - x0, ey = y - y0; if (ex * ex + ey * ey < 0.0025) break;
    const h = Math.max(1e-4, st.fov * 2e-4);
    if (!pj(viewWith(st.lon + h, st.lat), vEq)) return; const ax = (P[0] - x0) / h, ay = (P[1] - y0) / h;
    const latB = st.lat + h > 89.99 ? st.lat - h : st.lat + h; const hb = latB - st.lat;
    if (!pj(viewWith(st.lon, latB), vEq)) return; const bx = (P[0] - x0) / hb, by = (P[1] - y0) / hb;
    const det = ax * by - bx * ay; if (Math.abs(det) < 1e-9) return;
    let dl = (ex * by - bx * ey) / det, db = (ax * ey - ex * ay) / det;
    const lim = Math.max(2, st.fov); dl = clamp(dl, -lim * 2, lim * 2); db = clamp(db, -lim, lim);
    st.lon = ((st.lon + dl) % 360 + 360) % 360; st.lat = clamp(st.lat + db, -89.99, 89.99);
  }
}
function zoomBy(f, x, y) {
  const base = zoomA ? zoomA.target : st.fov; const target = clampFov(base * f);
  let anchor = null; if (x != null && curView) { const v = unproject(curView, x, y); if (v) anchor = { v, x, y }; }
  zoomA = { target, anchor }; fly = null; inertia = null; stopTour();
}
function stepZoom(dt) {
  const k = 1 - Math.exp(-dt * (settings.reduce ? 80 : 10));
  st.fov = Math.exp(lerp(Math.log(st.fov), Math.log(zoomA.target), k));
  if (zoomA.anchor) dragTo(zoomA.anchor.v, zoomA.anchor.x, zoomA.anchor.y);
  if (Math.abs(Math.log(st.fov / zoomA.target)) < 0.0015) { st.fov = zoomA.target; if (zoomA.anchor) dragTo(zoomA.anchor.v, zoomA.anchor.x, zoomA.anchor.y); zoomA = null; scheduleHist(); }
}
function stepInertia(dt) {
  st.lon = ((st.lon + inertia.vl * dt) % 360 + 360) % 360; st.lat = clamp(st.lat + inertia.vb * dt, -89.99, 89.99);
  const damp = Math.exp(-dt * (1.6 + (1 - settings.inertia) * 14)); inertia.vl *= damp; inertia.vb *= damp;
  if (Math.hypot(inertia.vl * Math.cos(st.lat * D2R), inertia.vb) < st.fov * 0.004) { inertia = null; scheduleHist(); }
}
let lastT = performance.now(), lastHud = 0, frameEMA = 16;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); frameEMA = lerp(frameEMA, Math.min(250, now - lastT), 0.06); lastT = now;
  let moving = false;
  if (st.playing) { st.time += dt * 1000 * st.speed; moving = true; if (Math.abs(st.time - bodiesT) > 30000 || Math.abs(st.speed) < 100) { bodies = calcBodies(); bodiesT = st.time; } syncTimeUI(false); }
  if (fly) { stepFly(dt); moving = true; }
  if (zoomA) { stepZoom(dt); moving = true; }
  if (inertia) { stepInertia(dt); moving = true; }
  if (stepLook(dt)) moving = true;
  if (tour) stepTour(dt);
  if (stepFocus(dt)) ovDirty = true;
  if (stepArt(dt)) glDirty = true;
  // hover fade
  const ht = hover.con >= 0 ? 1 : 0; if (Math.abs(hoverA - ht) > 0.01) { hoverA += (ht - hoverA) * Math.min(1, dt * 14); ovDirty = true; } else if (hoverA !== ht) { hoverA = ht; ovDirty = true; }
  if (sel && performance.now() - selAnimT < 400) ovDirty = true;
  if (moving) { glDirty = true; ovDirty = true; }
  const twinkling = (sky && layers.stars && style.twinkle > 0 && !settings.reduce) || ART.some(a => a.hi > 0.02 && a.cur > 0.01);
  const refining = !refineDone();
  if (glDirty || ovDirty || twinkling || refining) curView = viewNow();
  if (sky && (glDirty || twinkling || refining)) { renderGL(curView, now); glDirty = false; }
  if (ovDirty) { renderOV(curView); ovDirty = false; if (moving) thumbsDirty = true; }
  if (mouse.pending) { mouse.pending = false; doHover(); }
  if (now - lastHud > 100) { lastHud = now; updateHud(); drawCompass(); if (sel && (st.playing || moving)) updateCard(true); }
  if (photo.on) photoTick(now);
  if (thumbsDirty && !moving && !drag && now - thumbT > 260 && tabNow === 'style' && !$('#panel').hidden && !photo.on) { thumbsDirty = false; thumbT = now; renderThumbs(); }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- picking, hover, selection, object card
function pick(x, y) {
  if (!curView) return null;
  let best = null, bd = 1e9;
  if (layers.planets || layers.sunmoon) for (const B of bodies) {
    const isPl = B.id !== 'sun' && B.id !== 'moon'; if (isPl ? !layers.planets : !layers.sunmoon) continue;
    if (!pj(curView, B.v) || !aboveGround(B.v)) continue; const r = Math.max(12, (B.size || 0) / 2 * D2R * curView.scale + 4); const d = Math.hypot(P[0] - x, P[1] - y);
    if (d < r && d - 6 < bd) { bd = d - 6; best = { type: 'body', id: B.id }; }
  }
  if (layers.stars) for (let i = 0; i < SP.n; i++) {
    if (!SP.ok[i]) continue; if (STAR.mag[i] > magLimit(curView.fov) + 0.2) continue;
    const d = Math.hypot(SP.x[i] - x, SP.y[i] - y); const r = Math.max(8, SP.r[i] * 1.8 + 4);
    if (d < r) { const sc = d - (6.5 - STAR.mag[i]) * 0.9; if (sc < bd) { bd = sc; best = { type: 'star', i }; } }
  }
  if (layers.dso) for (const D of DSO) {
    if (curView.fov >= 70 && D.mag > 5.2) continue; if (!pj(curView, D.v) || !aboveGround(D.v)) continue;
    const rr = Math.max(9, Math.min(60, D.a / 60 * D2R * curView.scale * 0.5)); const d = Math.hypot(P[0] - x, P[1] - y);
    if (d < rr && d < bd + 4) { bd = d; best = { type: 'dso', id: D.id }; }
  }
  if (best) return best;
  const v = unproject(curView, x, y); if (!v) return null;
  if (st.mode === 'hor' && layers.ground && !aboveGround(v)) return null;
  return { type: 'con', ci: conAt(v) };
}
function objName(o) {
  if (!o) return '';
  if (o.type === 'star') return STAR.name[o.i] || designation(o.i);
  if (o.type === 'dso') { const D = DSO.find(d => d.id === o.id); return D.name ? `${D.id} · ${D.name}` : D.id; }
  if (o.type === 'body') return bodyById(o.id).name;
  if (o.type === 'con') return settings.latin ? CONS[o.ci].la : CONS[o.ci].pl;
}
function selVec() {
  if (!sel) return null;
  if (sel.type === 'star') return starV(sel.i);
  if (sel.type === 'dso') return DSO.find(d => d.id === sel.id).v;
  if (sel.type === 'body') return bodyById(sel.id).v;
  return null;
}
function doHover() {
  const tip = $('#tip');
  if (!mouse.in || drag || pinch || !curView || photo.on) { tip.hidden = true; if (hover.con !== -1 || hover.obj) { hover = { con: -1, obj: null }; ovDirty = true; } return; }
  const p = pick(mouse.x, mouse.y);
  const no = p && p.type !== 'con' ? p : null;
  const vc = unproject(curView, mouse.x, mouse.y);
  const conNow = vc && (st.mode !== 'hor' || !layers.ground || aboveGround(vc)) ? conAt(vc) : -1;
  if (conNow !== hover.con || JSON.stringify(no) !== JSON.stringify(hover.obj)) { hover = { con: layers.conHover ? conNow : -1, obj: no }; ovDirty = true; }
  ov.classList.toggle('pointing', !!no);
  if (p) {
    let main = objName(p), sub = '';
    if (p.type === 'star') sub = `${pl(STAR.mag[p.i], 2)} mag`;
    if (p.type === 'con') { sub = settings.latin ? CONS[p.ci].pl : CONS[p.ci].la; if (sub === main) sub = CONS[p.ci].id; }
    if (p.type === 'body') sub = `${pl(bodyById(p.id).mag, 1)} mag`;
    if (p.type === 'dso') sub = DSOT[DSO.find(d => d.id === p.id).type] || '';
    tip.innerHTML = (p.type === 'con' ? iconHTML(p.ci, 22) : '') + `<b></b><span></span>`; tip.querySelector('b').textContent = main; tip.lastChild.textContent = sub;
    if (!sub) tip.lastChild.remove();
    tip.style.left = Math.min(mouse.x, W - 200) + 'px'; tip.style.top = Math.min(mouse.y, H - 40) + 'px'; tip.hidden = false;
  } else tip.hidden = true;
}
function select(o, flyMode) {
  sel = null; selCon = -1;
  if (!o) { $('#card').hidden = true; ovDirty = true; return; }
  if (o.type === 'con') { selCon = o.ci; }
  else { sel = o; selAnimT = performance.now(); }
  ovDirty = true; updateCard(false);
  if (flyMode === 'fly') {
    if (o.type === 'con') { const C = CONS[o.ci]; flyTo(C.cv, clamp(C.r * 2.7, 10, 150)); }
    else { const fv = o.type === 'body' ? (o.id === 'moon' || o.id === 'sun' ? 4 : 10) : o.type === 'dso' ? clamp(DSO.find(d => d.id === o.id).a / 60 * 6, 2, 30) : Math.min(st.fov, 30); flyTo(o.type === 'body' ? () => bodyById(o.id).v : selVec(), fv); }
  }
}
function cardRows(rows) { return '<dl>' + rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>'; }
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function posRows(v) {
  const [ra, de] = sph(v); const rows = [['Rektascensja', fmtRA(ra)], ['Deklinacja', fmtDec(de)]];
  if (st.mode === 'hor') { const h = horOf(v); rows.push(['Wysokość', fmtDeg(h.alt)], ['Azymut', fmtDeg(h.az)]); }
  return rows;
}
function updateCard(soft) {
  const card = $('#card');
  if (!sel && selCon < 0) { card.hidden = true; return; }
  let kind = '', title = '', sub = '', rows = [], acts = '', extra = '', ico = '';
  if (selCon >= 0) {
    const C = CONS[selCon]; kind = 'Gwiazdozbiór'; title = settings.latin ? C.la : C.pl; sub = `${settings.latin ? C.pl : C.la} · ${C.gen} · ${C.id}`;
    const info = CONINFO[C.id]; ico = iconHTML(C.i, 52);
    if (info) extra = `<p class="desc">${esc(info.f)}</p><p class="orig">${esc(info.o)}</p>`;
    const b = C.br >= 0 ? C.br : null;
    rows = [['Powierzchnia', `${C.area.toLocaleString('pl-PL')} deg²`], ['Udział w niebie', `${pl(C.area / 412.53, 2)} %`], ['Gwiazdy do 6 mag', String(C.n)], b != null && ['Najjaśniejsza', `${esc(STAR.name[b] || designation(b))} · ${pl(STAR.mag[b], 2)}`], ['Środek (RA / Dec)', `${fmtRA(C.c[0]).slice(0, 7)} / ${fmtDeg(C.c[1])}`]];
    acts = `<button class="btn small primary" data-a="fit">Pokaż cały</button><button class="btn small" data-a="brightest">Najjaśniejsza gwiazda</button>`;
  } else if (sel.type === 'star') {
    // temperature from B−V: Ballesteros (2012), EPL 97, 34008
    const i = sel.i, bv = STAR.bv[i], T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); const C = CONS[STAR.con[i]];
    kind = 'Gwiazda'; title = STAR.name[i] || designation(i); sub = STAR.name[i] ? `${designation(i)} · ${C ? C.pl : ''}` : (C ? C.pl : '');
    const ce = CEPHEIDS[STAR.hip[i]];
    if (ce) kind = 'Gwiazda zmienna · cefeida';
    rows = [['Jasność obserwowana', ce ? `${ce.r} mag` : `${pl(STAR.mag[i], 2)} mag`], ce && ['Typ zmienności', ce.t], ce && ['Okres pulsacji', `${pl(ce.p, ce.p < 10 ? 3 : 2)} doby`], ['Indeks barwy B−V', pl(bv, 2)], ['Temperatura (szac.)', `≈ ${(Math.round(T / 100) * 100).toLocaleString('pl-PL')} K`], ['Typ widmowy (szac.)', specClass(bv)], ...posRows(starV(i)), ['Katalog Hipparcos', `HIP ${STAR.hip[i]}`]];
    acts = `<button class="btn small primary" data-a="center">Wyśrodkuj</button><button class="btn small" data-a="zoom">Przybliż</button><button class="btn small" data-a="con">Gwiazdozbiór</button>`;
  } else if (sel.type === 'dso') {
    const D = DSO.find(d => d.id === sel.id); kind = DSOT[D.type] || 'Obiekt głębokiego nieba'; title = D.name ? D.name : D.id; sub = `${D.id}${D.ngc ? ' · ' + D.ngc : ''} · ${CONS[D.con].pl}`;
    rows = [['Jasność', `${pl(D.mag, 1)} mag`], ['Rozmiar kątowy', D.a === D.b ? `${pl(D.a, 1)}′` : `${pl(D.a, 1)}′ × ${pl(D.b, 1)}′`], ...posRows(D.v)];
    acts = `<button class="btn small primary" data-a="center">Wyśrodkuj</button><button class="btn small" data-a="zoom">Przybliż</button>`;
  } else if (sel.type === 'body') {
    const B = bodyById(sel.id); kind = B.kind; title = B.name;
    sub = B.id === 'moon' ? `${B.phase} · oświetlenie ${Math.round(B.illum * 100)} %` : B.id === 'sun' ? 'Nasza gwiazda' : `w gwiazdozbiorze: ${CONS[conAt(B.v)].pl}`;
    const lm = B.dist * 499.005 / 60;
    rows = [B.id !== 'sun' && ['Jasność', `${pl(B.mag, 1)} mag`], ['Odległość', B.id === 'moon' ? `${Math.round(B.km).toLocaleString('pl-PL')} km` : `${pl(B.dist, 3)} au`], B.id !== 'moon' && ['Czas biegu światła', lm < 60 ? `${pl(lm, 1)} min` : `${pl(lm / 60, 2)} h`], ...posRows(B.v), ['Gwiazdozbiór', CONS[conAt(B.v)].pl]];
    acts = `<button class="btn small primary" data-a="center">Wyśrodkuj</button><button class="btn small" data-a="zoom">Przybliż</button>`;
  }
  acts = acts.replace(/btn small primary/g, 'btn sm prime').replace(/btn small/g, 'btn sm');
  const html = `<button class="tb x" data-a="close" title="Zamknij (Esc)" aria-label="Zamknij"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="hd"><div><div class="kind">${esc(kind)}</div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>${ico}</div>${extra}${cardRows(rows)}<div class="btns">${acts}</div>`;
  if (soft && !card.hidden) { const dl = card.querySelector('dl'); const tmp = document.createElement('div'); tmp.innerHTML = cardRows(rows); if (dl) dl.replaceWith(tmp.firstChild); const sb = card.querySelector('.sub'); if (sb) sb.textContent = sub; return; }
  card.innerHTML = html; card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
}
function specClass(bv) { if (bv < -0.25) return 'O / wczesny B'; if (bv < -0.02) return 'B'; if (bv < 0.30) return 'A'; if (bv < 0.58) return 'F'; if (bv < 0.81) return 'G'; if (bv < 1.40) return 'K'; return 'M'; }
$('#card').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'close') { select(null); return; }
  if (selCon >= 0) { const C = CONS[selCon]; if (a === 'fit') flyTo(C.cv, clamp(C.r * 2.7, 10, 150)); if (a === 'brightest' && C.br >= 0) select({ type: 'star', i: C.br }, 'fly'); return; }
  if (!sel) return;
  const tgt = sel.type === 'body' ? (() => { const id = sel.id; return () => bodyById(id).v; })() : selVec();
  if (a === 'center') flyTo(tgt, st.fov);
  if (a === 'zoom') flyTo(tgt, Math.max(0.6, st.fov / 3.5));
  if (a === 'con' && sel.type === 'star') select({ type: 'con', ci: STAR.con[sel.i] }, 'fly');
});

// ---------------------------------------------------------------- input: mouse, touch, keyboard
const ptrs = new Map();
function stopTour() { if (tour) { tour = null; syncTourUI(); hideCaption(); } }
ov.addEventListener('pointerdown', e => {
  ov.focus({ preventScroll: true }); ov.setPointerCapture(e.pointerId);
  const r = ov.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.set(e.pointerId, { x, y });
  fly = null; inertia = null; zoomA = null; stopTour(); $('#q-res').hidden = true;
  if (ptrs.size === 1) { const v = curView && unproject(curView, x, y); drag = { x0: x, y0: y, v, moved: false, samples: [{ t: performance.now(), lon: st.lon, lat: st.lat }], id: e.pointerId }; }
  else if (ptrs.size === 2) {
    drag = null; const [a, b] = [...ptrs.values()]; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), fov0: st.fov, v: curView && unproject(curView, mx, my) };
  }
  $('#tip').hidden = true;
});
ov.addEventListener('pointermove', e => {
  const r = ov.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  mouse.x = x; mouse.y = y; mouse.in = true;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x, y });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    st.fov = clampFov(pinch.fov0 * pinch.d0 / Math.max(10, d)); if (pinch.v) dragTo(pinch.v, mx, my); glDirty = ovDirty = true; return;
  }
  if (drag && drag.id === e.pointerId) {
    if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 4) { drag.moved = true; ov.classList.add('dragging'); }
    if (drag.moved && drag.v) {
      dragTo(drag.v, x, y); glDirty = ovDirty = true;
      const now = performance.now(); drag.samples.push({ t: now, lon: st.lon, lat: st.lat }); while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
    }
    return;
  }
  mouse.pending = true;
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) { pinch = null; scheduleHist(); } drag = null; return; }
  if (drag && drag.id === e.pointerId) {
    ov.classList.remove('dragging');
    if (!drag.moved) { if (!photo.on) { const p = pick(drag.x0, drag.y0); if (p && p.type === 'con' && p.ci === selCon) select(null); else select(p); } }
    else {
      const s = drag.samples, a = s[0], b = s[s.length - 1], dt = (b.t - a.t) / 1000;
      if (dt > 0.008 && performance.now() - b.t < 60 && settings.inertia > 0.02 && !settings.reduce) inertia = { vl: angDiff(b.lon, a.lon) / dt, vb: (b.lat - a.lat) / dt };
      else scheduleHist();
    }
    drag = null;
  }
}
ov.addEventListener('pointerup', endPtr); ov.addEventListener('pointercancel', endPtr);
ov.addEventListener('pointerleave', () => { mouse.in = false; mouse.pending = true; });
ov.addEventListener('dblclick', e => {
  const r = ov.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const v = curView && unproject(curView, x, y);
  if (v) { stopTour(); flyTo(v, Math.max(0.5, st.fov / 2.6)); }
});
ov.addEventListener('wheel', e => {
  e.preventDefault(); const r = ov.getBoundingClientRect();
  const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY;
  zoomBy(Math.exp(clamp(dy, -250, 250) * 0.0016), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
function panKey(dx, dy) { const v = curView && unproject(curView, W / 2 + dx * W * 0.14, H / 2 + dy * H * 0.14); if (v) flyTo(v, st.fov, { noHist: false }); if (fly) fly.dur = settings.reduce ? 0.001 : 0.32; }
window.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) { if (e.key === 'Escape') t.blur(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (photo.on) { if (k === 'Escape') { setPhoto(false); e.preventDefault(); return; } if (k === 'Enter') { capture(); e.preventDefault(); return; } }
  if (k === 'p' || k === 'P') { setPhoto(!photo.on); e.preventDefault(); return; }
  if (k === 'n' || k === 'N') { skyTonight(); e.preventDefault(); return; }
  if (k === 'r' || k === 'R') { randomTarget(); e.preventDefault(); return; }
  if (k === 't' || k === 'T') { startTour(); e.preventDefault(); return; }
  if (k === 'i' || k === 'I') { toggleArt(); e.preventDefault(); return; }
  if (k === 'ArrowLeft') panKey(-1, 0); else if (k === 'ArrowRight') panKey(1, 0); else if (k === 'ArrowUp') panKey(0, -1); else if (k === 'ArrowDown') panKey(0, 1);
  else if (k === '+' || k === '=') zoomBy(1 / 1.6); else if (k === '-' || k === '_') zoomBy(1.6);
  else if (k === 'q' || k === 'Q') rollBy(-15); else if (k === 'e' || k === 'E') rollBy(15);
  else if (k === 'h' || k === 'H') goHome(); else if (k === 'm' || k === 'M') setMode(st.mode === 'eq' ? 'hor' : 'eq');
  else if (k === ' ') togglePlay(); else if (k === 'f' || k === 'F') toggleFull(); else if (k === 'Enter' && document.activeElement === ov && sel) flyTo(selVec(), st.fov);
  else if (k === '/') { $('#q').focus(); } else if (k === 'Escape') { select(null); stopTour(); }
  else return;
  e.preventDefault();
});
function rollBy(d) { stopTour(); flyTo(centerEq(), st.fov, { roll: st.roll + d }); if (fly) fly.dur = settings.reduce ? 0.001 : 0.35; }
function goHome() {
  stopTour(); select(null);
  if (st.mode !== 'eq') setMode('eq', true);
  st.proj = HOME.proj; syncNavUI(); flyTo(vec(HOME.lon, HOME.lat), HOME.fov, { roll: HOME.roll });
}
function setMode(m, instant) {
  if (m === st.mode) return;
  const vc = centerEq(); st.mode = m; Fcache.key = '';
  const [lo, la] = sph(frameOf(vc)); st.lon = lo; st.lat = la; st.roll = 0;
  if (m === 'hor') {
    if (!instant && la < 8) flyTo(eqOfFrame(vec(lo, 28)), Math.max(st.fov, 95), { roll: 0 });
    if (st.proj === 2 && st.fov > 180) st.fov = 170;
  }
  bodies = calcBodies(); bodiesT = st.time;
  syncNavUI(); invalidate(); if (sel || selCon >= 0) updateCard(false);
  toast(m === 'hor' ? `Niebo nad: ${st.loc.n} · ${fmtLocDate(st.time)} ${fmtLocTime(st.time)}` : 'Mapa nieba · współrzędne równikowe');
}
let toastT = 0; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }
function togglePlay() { st.playing = !st.playing; syncTimeUI(true); }
function toggleFull() { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); p && p.catch && p.catch(() => toast('Pełny ekran nie jest tu dostępny')); } } catch (e) { toast('Pełny ekran nie jest tu dostępny'); } }

// ---------------------------------------------------------------- targets and tour
/* Targets (data/content.js): con – constellation(s) to highlight on arrival, obj – object marked with
   a reticle, tour – visited by the tour. */
const TOUR = TARGETS.filter(T => T.tour);
const eqTarget = (ra, dec) => vec(ra, dec);
function resolveObj(o) {
  if (!o) return null;
  if (o.type === 'star') { const i = starByHip.get(o.hip); return i == null ? null : { type: 'star', i }; }
  return o;
}
/* Focus: highlights the target's constellation (boundary glow, bright figure, illustration) and marks the object. */
const focus = { cons: [], obj: null, a: 0, target: 0 };
function setFocus(T) { if (!T) { focus.target = 0; return; } focus.cons = (T.con || []).map(id => CONS.findIndex(C => C.id === id)).filter(i => i >= 0); focus.obj = resolveObj(T.obj); focus.target = 1; }
function stepFocus(dt) {
  if (Math.abs(focus.a - focus.target) < 0.004) { if (focus.a !== focus.target) { focus.a = focus.target; return true; } return false; }
  focus.a += (focus.target - focus.a) * Math.min(1, dt * (focus.target ? 3.5 : 5)); if (focus.a < 0.01 && !focus.target) { focus.a = 0; focus.cons = []; focus.obj = null; } return true;
}
let capT = 0;
function showCaption(T, i, dwell) {
  const el = $('#caption'); clearTimeout(capT);
  $('#cap-k').textContent = tour ? `Wycieczka · ${i + 1} / ${TOUR.length}` : 'Cel';
  $('#cap-t').textContent = T.n; $('#cap-s').textContent = T.s;
  $('#cap-c').innerHTML = (T.con || []).map(id => { const C = CONS.find(c => c.id === id); return C ? `<span>${iconHTML(C.i, 18)}${esc(settings.latin ? C.la : C.pl)}</span>` : esc(id); }).join('<i>·</i>');
  el.hidden = false; void el.offsetWidth; el.classList.add('show');
  if (dwell) capT = setTimeout(hideCaption, dwell * 1000);
}
function hideCaption() { const el = $('#caption'); el.classList.remove('show'); clearTimeout(capT); capT = setTimeout(() => { el.hidden = true; }, 700); setFocus(null); }
function presentTarget(T, i) {
  stopTour(); select(null); hideCaption();
  flyTo(eqTarget(T.ra, T.dec), T.fov, { roll: st.mode === 'hor' ? 0 : st.roll, done: () => { setFocus(T); showCaption(T, i, 5); } });
}
function stepTour(dt) {
  if (fly) return;
  if (tour.phase === 'show') { tour.wait -= dt; if (tour.wait <= 0) { hideCaption(); tour.phase = 'go'; tour.wait = 0.5; } return; }
  tour.wait -= dt; if (tour.wait > 0) return;
  tour.i = (tour.i + 1) % TOUR.length; const T = TOUR[tour.i], i = tour.i;
  flyTo(eqTarget(T.ra, T.dec), T.fov, { roll: st.mode === 'hor' ? 0 : st.roll, done: () => { if (!tour) return; setFocus(T); showCaption(T, i); tour.phase = 'show'; tour.wait = 6.5; } });
  if (fly) fly.dur *= 1.6;
}
function startTour() { if (tour) { stopTour(); return; } select(null); hideCaption(); tour = { i: -1, wait: 0, phase: 'go' }; syncTourUI(); }
function syncTourUI() { $('#b-tour').classList.toggle('on', !!tour); $('#tour-btn span').textContent = tour ? 'Zatrzymaj wycieczkę' : 'Rozpocznij wycieczkę'; $('#a-tour span').textContent = tour ? 'Zatrzymaj wycieczkę' : 'Wycieczka po niebie'; }

// ---------------------------------------------------------------- illustration visibility
/* Base strength comes from the look (slider „Ilustracje”); a figure also lights up when pointed at,
   selected, or visited by the tour. */
function stepArt(dt) {
  if (!ART.length) return false;
  const on = layers.art !== false;   // main switch: off hides every illustration (look, hover, selection, tour)
  const base = on ? disp.p.art || 0 : 0, k = Math.min(1, dt * 5);
  const hov = on && !photo.on && layers.conHover && settings.artHover && hover.con >= 0 ? artOfCon(hover.con) : -1;
  const sA = on && selCon >= 0 ? artOfCon(selCon) : -1;
  const fA = on && focus.a > 0.01 ? focus.cons.map(artOfCon) : [];
  let changing = false;
  ART.forEach((A, i) => {
    let t = base, h = 0;
    if (i === hov) { t = Math.max(t, 0.34 + base * 0.35); h = 1; }
    if (i === sA) { t = Math.max(t, 0.48 + base * 0.3); h = 1; }
    if (fA.includes(i)) { t = Math.max(t, (0.5 + base * 0.3) * focus.a); h = Math.max(h, focus.a); }
    A.cur += (t - A.cur) * k; A.hi += (h - A.hi) * k;
    if (Math.abs(t - A.cur) > 0.002 || Math.abs(h - A.hi) > 0.002) changing = true;
  });
  return changing;
}
function artList(view) {
  const out = []; if (!ART.length) return out;
  const c = centerEq(), lim = view.proj === 0 ? 118 : view.proj === 1 ? 175 : 95;
  ART.forEach((A, i) => { if (A.cur < 0.004) return; if (angDist(c, A.cv) - A.r > Math.min(view.fov * 0.62, lim)) return; out.push([i, A.cur, A.hi]); });
  return out;
}

// ---------------------------------------------------------------- quick actions
// one switch for all constellation illustrations (toolbar button, key I, Layers tab, photo bar)
function toggleArt(on) {
  layers.art = on != null ? !!on : !layers.art; persist(); syncAll(); glDirty = true; thumbsDirty = true;
  toast(layers.art ? 'Ilustracje gwiazdozbiorów włączone' : 'Ilustracje gwiazdozbiorów wyłączone');
}
function skyTonight() { const p = locParts(Date.now()); setTime(fromLocal(p.y, p.mo, p.d, 22, 0)); if (st.mode !== 'hor') setMode('hor', true); flyTo(eqOfFrame(vec(-180, 35)), 110, { roll: 0 }); }
function randomTarget() {
  const pool = [], ok = v => st.mode !== 'hor' || aboveGround(v);
  for (let i = 0, n = starsTo(2.6); i < n; i++) if (STAR.name[i] && ok(starV(i))) pool.push({ type: 'star', i });
  for (const D of DSO) if (D.mag < 7.5 && ok(D.v)) pool.push({ type: 'dso', id: D.id });
  for (const C of CONS) if (C.rank === 1 && ok(C.cv)) pool.push({ type: 'con', ci: C.i });
  if (!pool.length) { toast('Nad horyzontem nie ma teraz ciekawych celów'); return; }
  const o = pool[Math.floor(Math.random() * pool.length)]; stopTour(); select(o, 'fly'); toast(objName(o));
}

// ---------------------------------------------------------------- photo mode and export
const photo = { on: false, aspect: 'full', res: '4k', exp: 1, saved: null, lastMove: 0, overBar: false, layers: { labels: true, lines: true, grid: false } };
const ASPECTS = [['full', 'Pełny'], ['16:9', '16:9'], ['3:2', '3:2'], ['1:1', '1:1'], ['4:5', '4:5']];
const RESES = [['x2', '2×'], ['4k', '4K'], ['6k', '6K']];
function cropRect() {
  if (photo.aspect === 'full') return { x: 0, y: 0, w: W, h: H };
  const [a, b] = photo.aspect.split(':').map(Number), ar = a / b;
  const mx = Math.min(90, W * 0.06), top = Math.min(70, H * 0.08), bot = W < 760 ? Math.min(170, H * 0.24) : Math.min(140, H * 0.16);
  let w = W - 2 * mx, h = w / ar; if (h > H - top - bot) { h = H - top - bot; w = h * ar; }
  return { x: (W - w) / 2, y: top + (H - top - bot - h) / 2, w, h };
}
function layoutCrop() {
  const el = $('#crop'); if (!photo.on || photo.aspect === 'full') { el.hidden = true; return; }
  const r = cropRect(); Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); el.hidden = false;
}
function applyPhotoLayers() { layers.conNames = layers.starNames = photo.layers.labels; layers.conLines = photo.layers.lines; layers.grid = layers.ecliptic = photo.layers.grid; layers.bounds = false; invalidate(); }
function setPhoto(on) {
  if (on === photo.on) return;
  photo.on = on; document.body.classList.toggle('photo', on);
  if (on) {
    stopTour(); photo.saved = Object.assign({}, layers);
    photo.layers = { labels: layers.conNames || layers.starNames, lines: layers.conLines, grid: false };
    applyPhotoLayers(); $('#tip').hidden = true; hover = { con: -1, obj: null }; photo.lastMove = performance.now();
    $('#q-res').hidden = true;
  } else { const art = layers.art; Object.assign(layers, photo.saved); layers.art = art; photo.exp = 1; }
  $('#photobar').hidden = !on; $('#ph-hint').hidden = !on; layoutCrop(); syncPhotoUI(); invalidate();
}
function photoTick(now) {
  const idle = now - photo.lastMove > 2600 && !photo.overBar;
  $('#photobar').classList.toggle('idle', idle); $('#ph-hint').classList.toggle('idle', idle || now - photo.lastMove > 1400);
}
window.addEventListener('pointermove', () => { if (photo.on) photo.lastMove = performance.now(); }, { passive: true });
let capturing = false, shotURL = null, shotBlob = null, shotName = 'firmament.png';
async function capture(opts = {}) {
  if (!sky || !curView || capturing) return;
  capturing = true;
  const res = opts.res || (photo.on ? photo.res : 'x2');
  const crop = photo.on ? cropRect() : { x: 0, y: 0, w: W, h: H };
  const long = Math.max(crop.w, crop.h);
  let k = res === '4k' ? 3840 / long : res === '6k' ? 5760 / long : Math.max(2, prGL);
  k = Math.min(k, (sky.maxDim - 4) / Math.max(W, H), 12);
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  toast('Renderuję zdjęcie…');
  await new Promise(r => setTimeout(r, 60));
  const oldW = glCanvas.width, oldH = glCanvas.height; let out = null;
  try {
    glCanvas.width = Math.round(W * k); glCanvas.height = Math.round(H * k);
    const gl = sky.gl, kr = gl.drawingBufferWidth / W;
    const view = viewNow();
    const R = buildR(view, disp, { pr: kr, starPr: kr, loScale: 1, time: 0, exposure: photo.on ? photo.exp : 1, art: artList(view) });
    R.twinkle = 0; R.refine = true; R.aa = 6; R.samplesPerFrame = 6; R.skyKey += '|export';
    sky.render(R);
    const oc = document.createElement('canvas'); oc.width = gl.drawingBufferWidth; oc.height = gl.drawingBufferHeight;
    const ox = oc.getContext('2d'); ox.setTransform(kr, 0, 0, kr, 0, 0); drawOverlay(ox, view, disp, { clean: true });
    out = document.createElement('canvas'); out.width = Math.round(crop.w * kr); out.height = Math.round(crop.h * kr);
    const x = out.getContext('2d');
    x.drawImage(glCanvas, crop.x * kr, crop.y * kr, out.width, out.height, 0, 0, out.width, out.height);
    x.drawImage(oc, crop.x * kr, crop.y * kr, out.width, out.height, 0, 0, out.width, out.height);
  } catch (e) { console.error(e); out = null; }
  finally { glCanvas.width = oldW; glCanvas.height = oldH; sky.release(); skyKeyLast = ''; invalidate(); }
  capturing = false;
  if (!out) { toast('Nie udało się wykonać zdjęcia w tej rozdzielczości. Wybierz niższą.'); return; }
  const C = CONS[conAt(centerEq())]; const d = locParts(st.time);
  shotName = `firmament-${normTxt(C.pl).replace(/ /g, '-')}-${d.y}${pad2(d.mo)}${pad2(d.d)}-${pad2(d.h)}${pad2(d.mi)}.png`;
  out.toBlob(blob => {
    if (!blob) { toast('Przeglądarka nie zapisała obrazu.'); return; }
    if (shotURL) URL.revokeObjectURL(shotURL);
    shotURL = URL.createObjectURL(blob); shotBlob = blob;
    $('#shot-img').src = shotURL; $('#shot-meta').textContent = `${out.width} × ${out.height} px · ${pl(blob.size / 1048576, 1)} MB`;
    $('#shot').hidden = false; $('#toast').classList.remove('show');
  }, 'image/png');
}
/* Saving: inside the claude.ai viewer the page asks the platform (downloads capability) to save the file;
   opened locally from disk it uses an ordinary download link. */
let dlNS = null;
try { if (window.claude && window.claude.use) window.claude.use('downloads').then(n => { dlNS = n; }, () => { }); } catch (e) { }
$('#shot-save').addEventListener('click', async () => {
  if (!shotURL) return;
  if (dlNS) {
    try { await dlNS.save({ filename: shotName, data: shotBlob }); toast('Zdjęcie zapisane'); }
    catch (e) { if (!e || e.code !== 'declined') toast('Nie udało się zapisać – kliknij obraz prawym przyciskiem'); }
    return;
  }
  const a = document.createElement('a'); a.href = shotURL; a.download = shotName; document.body.appendChild(a); a.click(); a.remove();
});
$('#shot-copy').addEventListener('click', async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': shotBlob })]); toast('Obraz skopiowany do schowka'); } catch (e) { toast('Schowek jest tu niedostępny – zapisz obraz prawym przyciskiem'); } });
$('#shot-close').addEventListener('click', () => { $('#shot').hidden = true; });
$('#shot').addEventListener('click', e => { if (e.target.id === 'shot') $('#shot').hidden = true; });
