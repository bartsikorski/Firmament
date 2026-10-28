'use strict';
/* FIRMAMENT · południk
   Wybrany południk niebieski (koło godzinne o stałej rektascensji, od bieguna do bieguna) albo południk
   miejscowy – linia północ–zenit–południe nad miejscem obserwacji. Program wylicza, które gwiazdozbiory
   przecina (od północy na południe), i przelatuje wzdłuż niego, podpisując kolejne gwiazdozbiory. */
const meridian = { on: false, local: false, ra: 0, pick: false };
let ride = null;
const RIDE_SPEED = 3.4, RIDE_FOV = 44;   // degrees per second, field of view during the ride
const merSync = [];                       // sync functions of the panel controls

/* Geometry of the current meridian as a path parametrised by s (degrees along it):
   at(s) – equatorial vector, frame(s) – camera position [lon, lat] in the current frame (optional),
   len – path length, segs – constellations crossed, in order. */
function merGeom(noSegs) {
  const jd = jdOf(st.time);
  const H = horMatrix(jd, st.loc.lat, st.loc.lon), zen = mtv(H, [0, 0, 1]);
  const ra = meridian.local ? sph(zen)[0] : meridian.ra;
  let g;
  if (meridian.local && st.mode === 'hor') {
    // north horizon → zenith, a half turn at the zenith (to face south), zenith → south horizon
    const up = 87, turn = 24;
    const frame = s => s < up ? [0, 2 + s] : s < up + turn ? [-180 * (s - up) / turn, 89.99] : [-180, 89.99 - (s - up - turn)];
    g = { ra, len: up * 2 + turn, frame, at: s => eqOfFrame(vec(...frame(s))), skip: s => s >= up && s < up + turn };
  } else {
    const at = s => vec(ra, 89.5 - s);
    g = { ra, len: 179, at, skip: () => false };
    if (st.mode === 'hor') {   // only the part above the horizon can be visited
      let best = null, cur = null;
      for (let s = 0; s <= 179; s += 0.5) {
        if (aboveGround(at(s))) { if (!cur) cur = [s, s]; else cur[1] = s; if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur.slice(); }
        else cur = null;
      }
      g.s0 = best ? best[0] : 0; g.s1 = best ? best[1] : -1;
    }
  }
  if (g.s0 == null) { g.s0 = 0; g.s1 = g.len; }
  if (noSegs) return g;
  // constellations along the path, merging tiny slivers where it only grazes a boundary corner
  const segs = [];
  for (let s = g.s0; s <= g.s1; s += 0.25) {
    if (g.skip(s)) continue;
    const ci = conAt(g.at(s)), last = segs[segs.length - 1];
    if (last && last.ci === ci) last.s1 = s; else segs.push({ ci, s0: s, s1: s });
  }
  g.segs = segs.filter(x => x.s1 - x.s0 >= 0.75 || segs.length < 3).reduce((a, x) => { const l = a[a.length - 1]; if (l && l.ci === x.ci) l.s1 = x.s1; else a.push({ ...x }); return a; }, []);
  return g;
}
const raHM = ra => { const m = Math.round(((ra % 360) + 360) % 360 / 15 * 60) % 1440; return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`; };

// ---------------------------------------------------------------- drawing (called from drawOverlay)
function drawMeridian(ctx, view, c) {
  if (!meridian.on) return;
  const g = merGeom(true), pts = [];
  if (g.frame) { for (let s = 0; s <= g.len; s += 0.5) if (!g.skip(s)) pts.push(g.at(s)); }
  else for (let d = 90; d >= -90; d -= 0.5) pts.push(vec(g.ra, d));
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = rgba(c.accent, 0.75); ctx.lineWidth = 1.5; ctx.shadowColor = rgba(c.accent, 0.6); ctx.shadowBlur = 8;
  ctx.beginPath(); strokeVecs(ctx, view, pts, false); ctx.stroke();
  ctx.shadowBlur = 0;
  // declination ticks every 10°, labels every 30°
  ctx.font = `10px "JetBrains Mono", ui-monospace, monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let d = -80; d <= 80; d += 10) {
    const v = vec(g.ra, d); if (!pj(view, v) || !aboveGround(v)) continue;
    const x = P[0], y = P[1]; if (x < 0 || x > view.W || y < 0 || y > view.H) continue;
    ctx.fillStyle = rgba(c.accent, 0.8); ctx.beginPath(); ctx.arc(x, y, d % 30 ? 1.6 : 2.4, 0, TAU); ctx.fill();
    if (!(d % 30)) drawText(ctx, `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}°`, x + 7, y, c.accent, 0.7);
  }
  // name of the meridian near the top of the screen
  let lab = null;   // the top-most visible point, clear of the toolbar and of the caption at the bottom
  for (const v of pts) if (pj(view, v) && aboveGround(v) && P[0] > 20 && P[0] < view.W - 260 && P[1] > 70 && P[1] < view.H - 230 && (!lab || P[1] < lab[1])) lab = [P[0], P[1]];
  if (lab) {
    ctx.font = `600 10.5px "JetBrains Mono", ui-monospace, monospace`; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(c.bg1, 0.8);
    const t = meridian.local ? `POŁUDNIK MIEJSCOWY · ${raHM(g.ra)}` : `POŁUDNIK ${raHM(g.ra)}`;
    ctx.strokeText(t, lab[0] + 10, lab[1] + 14); drawText(ctx, t, lab[0] + 10, lab[1] + 14, c.accent, 0.95);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

// ---------------------------------------------------------------- ride along the meridian
function startRide() {
  if (!meridian.on) { meridian.ra = sph(centerEq())[0]; setMeridian(true); }
  stopTour(); select(null);
  const g = merGeom();
  if (g.s1 < g.s0 || !g.segs.length) { toast('Ten południk jest teraz pod horyzontem'); return; }
  ride = { g, s: g.s0, go: false, seg: -1 };
  const start = g.frame ? eqOfFrame(vec(...g.frame(g.s0))) : g.at(g.s0);
  flyTo(start, RIDE_FOV, { roll: 0, done: () => { if (ride) ride.go = true; } });
  syncMerUI();
}
function stopRide(keepCaption) { if (!ride) return; ride = null; if (!keepCaption) hideCaption(); syncMerUI(); }
function stepRide(dt) {
  if (!ride || !ride.go || fly) return false;
  const g = ride.g;
  ride.s += dt * RIDE_SPEED;
  if (ride.s >= g.s1) { ride.s = g.s1; const r = ride; stopRide(true); capT = setTimeout(hideCaption, 3500); toast(`Koniec południka · ${r.g.segs.length} gwiazdozbiorów`); return true; }
  if (g.frame) { const [lo, la] = g.frame(ride.s); st.lon = ((lo % 360) + 360) % 360; st.lat = la; }
  else { const [lo, la] = sph(frameOf(g.at(ride.s))); st.lon = lo; st.lat = clamp(la, -89.99, 89.99); }
  st.roll = 0;
  const si = g.segs.findIndex(x => ride.s >= x.s0 - 0.13 && ride.s <= x.s1 + 0.13);
  if (si >= 0 && si !== ride.seg) {
    ride.seg = si; const C = CONS[g.segs[si].ci], info = CONINFO[C.id] || {};
    setFocus({ con: [C.id] });
    showCaption({ k: `${meridian.local ? 'Południk miejscowy' : 'Południk'} ${raHM(g.ra)} · ${si + 1} / ${g.segs.length}`, n: settings.latin ? C.la : C.pl, s: info.f || '', con: [] }, si);
    $$('#mer-list .chip').forEach((b, k) => b.classList.toggle('on', k === si));
  }
  return true;
}

// ---------------------------------------------------------------- panel
function setMeridian(on) { meridian.on = on; if (!on) { stopRide(); meridian.pick = false; } ovDirty = true; syncMerUI(); }
function setMeridianRA(ra) { meridian.ra = ((ra % 360) + 360) % 360; meridian.local = false; stopRide(); ovDirty = true; syncMerUI(); merSync.forEach(f => f()); }
function syncMerUI() {
  const on = meridian.on;
  $('#mer-on').textContent = on ? 'Ukryj' : 'Pokaż'; $('#mer-body').hidden = !on;
  ov.classList.toggle('picking', meridian.pick);
  $('#mer-pick').classList.toggle('on', meridian.pick);
  $('#mer-ride span').textContent = ride ? 'Zatrzymaj przejazd' : 'Przejedź wzdłuż południka';
  if (!on) return;
  const g = ride ? ride.g : merGeom();   // during a ride the list follows the ride's own path
  $('#mer-ra').textContent = `RA ${raHM(g.ra)}`; $('#r-mer').hidden = meridian.local;   // the slider sets a chosen hour circle
  $('#mer-sub').textContent = meridian.local ? (st.mode === 'hor' ? 'północ – zenit – południe' : `nad: ${st.loc.n}, ${fmtLocTime(st.time)}`) : 'od bieguna do bieguna';
  const host = $('#mer-list'); host.innerHTML = '';
  if (!g.segs.length) { host.innerHTML = '<p class="empty">Ten południk jest teraz pod horyzontem.</p>'; return; }
  g.segs.forEach((x, k) => {
    const C = CONS[x.ci], b = document.createElement('button'); b.className = 'chip' + (ride && ride.seg === k ? ' on' : '');
    b.innerHTML = iconHTML(C.i, 16) + '<span></span>'; b.lastChild.textContent = settings.latin ? C.la : C.pl;
    b.title = `${C.la} · ${Math.round(x.s1 - x.s0)}° wzdłuż południka`;
    b.addEventListener('click', () => { stopRide(); const sm = (x.s0 + x.s1) / 2; flyTo(g.frame ? eqOfFrame(vec(...g.frame(sm))) : g.at(sm), RIDE_FOV, { roll: 0, done: () => setFocus({ con: [C.id] }) }); });
    host.appendChild(b);
  });
}
function buildMeridianUI() {
  merSync.push(mkSeg($('#seg-mer'), [[false, 'Wybrany', 'Koło godzinne o wybranej rektascensji'], [true, 'Miejscowy', 'Południk nad miejscem obserwacji o ustawionej godzinie']], () => meridian.local, v => { meridian.local = v; stopRide(); ovDirty = true; syncMerUI(); }));
  merSync.push(mkSlider($('#r-mer'), { id: 'mer', label: 'Rektascensja', min: 0, max: 24, step: 1 / 60, get: () => meridian.ra / 15, set: v => setMeridianRA(v * 15), fmt: v => { const m = Math.round(v * 60) % 1440; return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`; }, help: 'Godzina rektascensji wybranego południka.' }));
  $('#mer-on').addEventListener('click', () => { if (!meridian.on) meridian.ra = sph(centerEq())[0]; setMeridian(!meridian.on); syncAll(); });
  $('#mer-center').addEventListener('click', () => { setMeridianRA(sph(centerEq())[0]); syncAll(); });
  $('#mer-pick').addEventListener('click', () => { meridian.pick = !meridian.pick; syncMerUI(); if (meridian.pick) toast('Kliknij miejsce na niebie, przez które ma biec południk'); });
  $('#mer-ride').addEventListener('click', () => { if (ride) stopRide(); else startRide(); });
  syncMerUI();
}
/* a click on the sky while picking chooses the meridian through that point */
function meridianPickAt(x, y) {
  if (!meridian.pick || !curView) return false;
  const v = unproject(curView, x, y); meridian.pick = false;
  if (v) { setMeridianRA(sph(v)[0]); syncAll(); }
  syncMerUI(); return true;
}
