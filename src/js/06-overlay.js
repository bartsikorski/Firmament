'use strict';
/* FIRMAMENT · nakładka 2D
   Siatka, ekliptyka, figury i granice gwiazdozbiorów, nazwy z ikonami, podpisy atrybutów na ilustracjach,
   obiekty Messiera, planety, opisy gwiazd (znane gwiazdy mają pierwszeństwo), celownik. */
const FONTS = { atlas: { con: '600 {s}px "Cormorant Garamond", Georgia, serif', star: 'italic 500 {s}px "Cormorant Garamond", Georgia, serif', sz: 1.12 }, sans: { con: '500 {s}px "Barlow Semi Condensed", "Arial Narrow", sans-serif', star: '400 {s}px "Barlow Semi Condensed", "Arial Narrow", sans-serif', sz: 1 }, mono: { con: '500 {s}px "JetBrains Mono", ui-monospace, monospace', star: '400 {s}px "JetBrains Mono", ui-monospace, monospace', sz: 0.88 } };
const fnt = (kind, s) => FONTS[style.font][kind].replace('{s}', (s * FONTS[style.font].sz).toFixed(1));
class Placer { constructor() { this.r = []; } fits(x, y, w, h) { for (const q of this.r) if (x < q[0] + q[2] && x + w > q[0] && y < q[1] + q[3] && y + h > q[1]) return false; return true; } add(x, y, w, h) { this.r.push([x, y, w, h]); } try(x, y, w, h) { if (!this.fits(x, y, w, h)) return false; this.add(x, y, w, h); return true; } }
/* screen positions of catalogue stars, filled each frame for stars [0, SP.n) – the ones bright enough to be drawn */
let SP = { x: new Float32Array(NS), y: new Float32Array(NS), ok: new Uint8Array(NS), r: new Float32Array(NS), n: 0 };
// famous stars as [star index, tier]: tier 1 is always labelled, tier 2 once zoomed in a little
const FAMOUS_I = Object.entries(FAMOUS).map(([h, f]) => [starByHip.get(+h), f[0]]).filter(f => f[0] != null).sort((a, b) => STAR.mag[a[0]] - STAR.mag[b[0]]);
// constellation icons: one sheet of white 64 px icons cut from the illustrations, tinted per colour on demand
const ICON = { img: null, tint: new Map() };
CONS.forEach(C => { C.icon = ICONDATA.ids.indexOf(C.id); });
function iconSheet(col) {
  if (!ICON.img) return null; const key = col.map(v => v.toFixed(3)).join(); let c = ICON.tint.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = ICON.img.width; c.height = ICON.img.height; const x = c.getContext('2d');
    x.drawImage(ICON.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = rgba(col, 1); x.fillRect(0, 0, c.width, c.height);
    if (ICON.tint.size > 16) ICON.tint.clear(); ICON.tint.set(key, c);
  }
  return c;
}
function drawIcon(ctx, ci, x, y, s, col, a) {
  const sh = iconSheet(col), n = CONS[ci].icon; if (!sh || n < 0) return; const S = ICONDATA.size;
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(sh, (n % ICONDATA.cols) * S, Math.floor(n / ICONDATA.cols) * S, S, S, x, y, s, s); ctx.restore();
}
let hover = { con: -1, obj: null }, sel = null, selCon = -1, hoverA = 0, selAnimT = 0;
let mouse = { x: -1, y: -1, in: false };

function strokeVecs(ctx, view, pts, closed, M, frameCoords) {
  M = M || view.V; let prevOk = false, px = 0, py = 0, started = false; const maxJ = view.W * 0.45;
  const n = pts.length + (closed ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const v = pts[k % pts.length];
    const ok = pjM(view, M, v) && (!groundCheckFrame || (frameCoords ? Math.asin(clamp(v[2], -1, 1)) > horizonH(Math.atan2(v[1], v[0])) - 0.003 : aboveGround(v)));
    if (ok) { if (prevOk && Math.hypot(P[0] - px, P[1] - py) < maxJ) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]); px = P[0]; py = P[1]; started = true; }
    prevOk = ok;
  }
  return started;
}
let groundCheckFrame = false;
function gridSteps(fov) { if (fov > 120) return [30, 30]; if (fov > 70) return [15, 15]; if (fov > 35) return [15, 10]; if (fov > 18) return [7.5, 5]; if (fov > 8) return [2.5, 2]; if (fov > 3) return [1.25, 1]; return [0.25, 0.25]; }
function visibleRange(view, M) {
  // sample screen to find visible lon/lat ranges in the frame given by matrix M (frame->local)
  let latMin = 90, latMax = -90; const lons = [];
  const Mt = M; const nx = 9, ny = 7;
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    const x = view.W * i / nx, y = view.H * j / ny;
    const pxp = (x - view.cx) / view.scale, pyp = (view.cy - y) / view.scale; let L;
    if (view.proj === 0) { const r2 = pxp * pxp + pyp * pyp, a = (4 - r2) / (4 + r2), k = (1 + a) / 2; L = [pxp * k, pyp * k, a]; }
    else if (view.proj === 1) { const th = Math.hypot(pxp, pyp); if (th > Math.PI) continue; const s = th > 1e-9 ? Math.sin(th) / th : 1; L = [pxp * s, pyp * s, Math.cos(th)]; }
    else { const r2 = pxp * pxp + pyp * pyp; if (r2 > 1) continue; L = [pxp, pyp, Math.sqrt(1 - r2)]; }
    const v = mtv(Mt, L); const [lo, la] = sph(v); latMin = Math.min(latMin, la); latMax = Math.max(latMax, la); lons.push(lo);
  }
  // poles visible?
  let full = false;
  if (pjM(view, M, [0, 0, 1]) && P[0] > -20 && P[0] < view.W + 20 && P[1] > -20 && P[1] < view.H + 20) { latMax = 90; full = true; }
  if (pjM(view, M, [0, 0, -1]) && P[0] > -20 && P[0] < view.W + 20 && P[1] > -20 && P[1] < view.H + 20) { latMin = -90; full = true; }
  let lo0 = 0, lo1 = 360;
  if (!full && lons.length > 2 && view.fov < 150) {
    lons.sort((a, b) => a - b); let gap = 0, gi = 0;
    for (let k = 0; k < lons.length; k++) { const g = (k + 1 < lons.length ? lons[k + 1] : lons[0] + 360) - lons[k]; if (g > gap) { gap = g; gi = k; } }
    lo0 = lons[(gi + 1) % lons.length]; lo1 = lons[gi]; if (lo1 < lo0) lo1 += 360;
    const pad = (lo1 - lo0) * 0.15 + 2; lo0 -= pad; lo1 += pad;
  }
  const lp = (latMax - latMin) * 0.1 + 1;
  return { lo0, lo1, la0: Math.max(-90, latMin - lp), la1: Math.min(90, latMax + lp) };
}
function drawText(ctx, txt, x, y, col, a) { ctx.fillStyle = rgba(col, a); ctx.fillText(txt, x, y); }

function drawOverlay(ctx, view, lk, o) {
  const thumb = !!o.thumb; const c = lk.c; const fov = view.fov; const Wv = view.W, Hv = view.H;
  if (!thumb) ctx.clearRect(0, 0, Wv, Hv);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const obs = st.mode === 'hor'; groundCheckFrame = obs && layers.ground;
  const lw = style.lineW;
  // project all catalogue stars once
  const mlim = magLimit(fov);
  if (!thumb) SP.n = starsTo(mlim + 0.3);
  if (!thumb) for (let i = 0; i < SP.n; i++) {
    const v = [STAR.v[i * 3], STAR.v[i * 3 + 1], STAR.v[i * 3 + 2]];
    if (pj(view, v) && P[0] > -60 && P[0] < Wv + 60 && P[1] > -60 && P[1] < Hv + 60 && (!groundCheckFrame || aboveGround(v))) { SP.ok[i] = 1; SP.x[i] = P[0]; SP.y[i] = P[1]; SP.r[i] = starCore(STAR.mag[i], view); } else SP.ok[i] = 0;
  }
  // --- reference grid
  if (!thumb && layers.grid) {
    const M = obs ? view.VF : view.V; const [ls, as] = gridSteps(fov); const rg = visibleRange(view, M);
    ctx.strokeStyle = rgba(c.grid, style.gridA); ctx.lineWidth = 0.8 * lw; ctx.beginPath();
    const sStep = Math.min(as / 4, 2), lStep = Math.min(ls / 6, 2);
    const la0 = Math.ceil(rg.la0 / as) * as;
    for (let la = la0; la <= rg.la1 + 1e-9; la += as) { if (Math.abs(la) > 89.99) continue; if (obs && layers.ground && la < 0) continue; const pts = []; for (let lo = rg.lo0; lo <= rg.lo1 + 1e-9; lo += lStep) pts.push(vec(lo, la)); strokeVecs(ctx, view, pts, false, M, obs); }
    const lo0 = Math.ceil(rg.lo0 / ls) * ls; const polarCut = obs ? 0 : (fov > 40 ? 80 : 89);
    for (let lo = lo0; lo <= rg.lo1 + 1e-9; lo += ls) {
      const isMain = Math.abs(((lo % 90) + 90) % 90) < 1e-6; const lim = isMain ? 90 : polarCut;
      const pts = []; for (let la = Math.max(rg.la0, -lim, obs && layers.ground ? 0 : -90); la <= Math.min(rg.la1, lim) + 1e-9; la += sStep) pts.push(vec(lo, la)); strokeVecs(ctx, view, pts, false, M, obs);
    }
    ctx.stroke();
    // labels along the line through centre
    ctx.font = `10px "JetBrains Mono", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cLat = clamp(Math.round(st.lat / as) * as, -80, 80), cLon = Math.round(st.lon / ls) * ls;
    const la1 = obs && layers.ground ? Math.max(cLat, as) : cLat;
    for (let lo = lo0; lo <= rg.lo1; lo += ls) { if (pjM(view, M, vec(lo, la1)) && P[0] > 10 && P[0] < Wv - 10 && P[1] > 10 && P[1] < Hv - 10) { const t = obs ? `${Math.round(((-lo % 360) + 360) % 360)}°` : (ls >= 15 ? `${Math.round(((lo % 360) + 360) % 360 / 15)}h` : `${Math.floor(((lo % 360) + 360) % 360 / 15)}h${pad2(Math.round((((lo % 360) + 360) % 360 / 15 % 1) * 60))}m`); drawText(ctx, t, P[0], P[1] - 8, c.grid, Math.min(1, style.gridA * 2.6)); } }
    for (let la = la0; la <= rg.la1; la += as) { if (Math.abs(la) > 89 || (obs && layers.ground && la < 0) || Math.abs(la - la1) < 1e-6) continue; if (pjM(view, M, vec(cLon, la)) && P[0] > 10 && P[0] < Wv - 10 && P[1] > 10 && P[1] < Hv - 10) drawText(ctx, `${la > 0 ? '+' : la < 0 ? '−' : ''}${Math.abs(la) % 1 ? pl(Math.abs(la), 2) : Math.abs(la)}°`, P[0] + 16, P[1] - 7, c.grid, Math.min(1, style.gridA * 2.6)); }
  }
  // --- ecliptic, galactic equator
  if (!thumb && layers.ecliptic) {
    const pts = []; for (let l = 0; l < 360; l += 1) pts.push(eclToEq([Math.cos(l * D2R), Math.sin(l * D2R), 0]));
    ctx.strokeStyle = rgba(c.accent, 0.32); ctx.lineWidth = 0.9 * lw; ctx.setLineDash([6, 5]); ctx.beginPath(); strokeVecs(ctx, view, pts, true); ctx.stroke(); ctx.setLineDash([]);
    if (fov < 160) { const lab = pts.find((v, k) => k % 15 === 0 && pj(view, v) && P[0] > 40 && P[0] < Wv - 40 && P[1] > 30 && P[1] < Hv - 30 && aboveGround(v)); if (lab) { pj(view, lab); ctx.font = fnt('star', 12 * style.labelSize); ctx.textAlign = 'left'; drawText(ctx, 'ekliptyka', P[0] + 6, P[1] - 8, c.accent, 0.55); } }
  }
  if (!thumb && layers.galactic) {
    const pts = []; for (let l = 0; l < 360; l += 1) pts.push(mtv(GAL, [Math.cos(l * D2R), Math.sin(l * D2R), 0]));
    ctx.strokeStyle = rgba(c.mwHi, 0.25); ctx.lineWidth = 0.9 * lw; ctx.setLineDash([2, 5]); ctx.beginPath(); strokeVecs(ctx, view, pts, true); ctx.stroke(); ctx.setLineDash([]);
  }
  // --- constellation boundaries
  if (!thumb && layers.bounds) {
    ctx.strokeStyle = rgba(c.line, style.lineA * 0.5); ctx.lineWidth = 0.7 * lw; ctx.setLineDash([2, 4]); ctx.beginPath();
    for (const b of BORDERS) strokeVecs(ctx, view, b, false); ctx.stroke(); ctx.setLineDash([]);
  }
  // --- highlighted constellation (hover / selected)
  const hiCons = [];
  if (!thumb && !o.clean) {
    if (selCon >= 0) hiCons.push([selCon, 1]);
    if (focus.a > 0.01) for (const ci of focus.cons) if (ci !== selCon) hiCons.push([ci, focus.a]);
    if (hover.con >= 0 && hover.con !== selCon && layers.conHover && !hiCons.some(h => h[0] === hover.con)) hiCons.push([hover.con, hoverA]);
  }
  for (const [ci, a] of hiCons) {
    if (a <= 0.01) continue;
    const C = CONS[ci];
    let allOk = true; ctx.beginPath();
    for (const ring of C.rings) { let first = true; for (const v of ring) { if (!pj(view, v)) { allOk = false; break; } if (first) { ctx.moveTo(P[0], P[1]); first = false; } else ctx.lineTo(P[0], P[1]); } ctx.closePath(); if (!allOk) break; }
    if (allOk) { ctx.fillStyle = rgba(c.accent, 0.075 * a); ctx.fill('evenodd'); }
    ctx.beginPath(); for (const ring of C.rings) strokeVecs(ctx, view, ring, true);
    ctx.save(); ctx.shadowColor = rgba(c.accent, 0.8 * a); ctx.shadowBlur = 10; ctx.strokeStyle = rgba(c.accent, 0.62 * a); ctx.lineWidth = 1.2 * lw; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
  }
  // --- constellation lines
  if (layers.conLines) {
    const hiSet = new Map(hiCons);
    const drawCon = (C, strong) => {
      for (const pl_ of C.lines) for (let k = 0; k + 1 < pl_.length; k++) {
        const A = pl_[k], B = pl_[k + 1];
        if (!pj(view, A.v) || (groundCheckFrame && !aboveGround(A.v))) continue; const ax = P[0], ay = P[1];
        if (!pj(view, B.v) || (groundCheckFrame && !aboveGround(B.v))) continue; const bx = P[0], by = P[1];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len > Wv * 0.6 || len < 0.5) continue;
        let ga = 0, gb = 0;
        if (style.lineStyle === 'soft' && !thumb) { ga = starCore(A.mag, view) * 1.5 + 2.5; gb = starCore(B.mag, view) * 1.5 + 2.5; if (len < ga + gb + 2) continue; }
        ctx.moveTo(ax + dx / len * ga, ay + dy / len * ga); ctx.lineTo(bx - dx / len * gb, by - dy / len * gb);
      }
    };
    ctx.lineWidth = (thumb ? 0.8 : 1) * lw; ctx.strokeStyle = rgba(c.line, thumb ? Math.min(0.8, style.lineA * 1.4) : style.lineA);
    if (style.lineStyle === 'dashed' && !thumb) ctx.setLineDash([3, 4]);
    ctx.beginPath(); for (const C of CONS) if (!hiSet.has(C.i)) drawCon(C); ctx.stroke();
    for (const [ci, a] of hiCons) { ctx.beginPath(); drawCon(CONS[ci]); ctx.strokeStyle = rgba(mix3(c.line, c.accent, a), style.lineA + (0.95 - style.lineA) * a); ctx.lineWidth = lw * (1 + 0.6 * a); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  if (thumb) return;
  const placer = new Placer();
  // --- attribute notes on a highlighted illustration (club, Medusa's head, ear of wheat…)
  if (layers.artNotes && layers.art !== false && !o.clean) {
    ctx.font = fnt('star', 12.5 * style.labelSize); ctx.textAlign = 'left';
    for (const [ci, ha] of hiCons) {
      const info = CONINFO[CONS[ci].id], A = ART[artOfCon(ci)]; if (!info || !info.p || !A) continue;
      const a = ha * clamp((A.cur - 0.08) * 4, 0, 1); if (a < 0.03) continue;
      const col = mix3(c.label, c.accent, 0.4);
      for (const [u, v, txt] of info.p) {
        const w = nrm(mv(A.B, [u, v, 1])); if (!pj(view, w) || !aboveGround(w)) continue; const x = P[0], y = P[1];
        if (x < 0 || x > Wv || y < 0 || y > Hv) continue;
        const tw = ctx.measureText(txt).width; placer.add(x + 5, y - 9, tw + 6, 13);
        ctx.fillStyle = rgba(col, 0.9 * a); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = rgba(c.bg1, 0.75 * a); ctx.strokeText(txt, x + 7, y + 4); drawText(ctx, txt, x + 7, y + 4, col, 0.95 * a);
      }
    }
  }
  // --- famous stars first, so that constellation names never hide Sirius or Polaris
  const famousDone = new Set();
  if (layers.starNames && layers.stars) {
    const fs = 13 * style.labelSize; ctx.font = fnt('star', fs); ctx.textAlign = 'left';
    ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(c.bg1, 0.7);
    for (const [i, tier] of FAMOUS_I) {
      if (i >= SP.n || !SP.ok[i] || (tier === 2 && fov > 110)) continue;
      const txt = STAR.name[i], x = SP.x[i] + SP.r[i] + 4, y = SP.y[i] + 4; if (!txt || x > Wv || y < 0 || y - fs > Hv) continue;
      const w = ctx.measureText(txt).width; if (!placer.try(x - 1, y - fs, w + 2, fs + 3)) continue;
      ctx.strokeText(txt, x, y); drawText(ctx, txt, x, y, c.label, 0.95); famousDone.add(i);
    }
    ctx.restore();
  }
  // --- deep-sky objects
  const labels = [];
  if (layers.dso) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const D of DSO) { // soft glows for large bright objects
      if (D.a < 15 || D.mag > 7 || D.type === 'gc' || D.type === 'pos') continue;
      if (!pj(view, D.v) || !aboveGround(D.v)) continue;
      const rpx = D.a / 60 * D2R * view.scale * 0.5; if (rpx < 5) continue;
      const g = ctx.createRadialGradient(P[0], P[1], 0, P[0], P[1], rpx * 1.3);
      const col = D.type === 's' || D.type === 'e' ? c.mwHi : D.type === 'oc' ? c.hot : mix3(c.neb, c.accent, 0.35);
      const al = clamp(0.22 - D.mag * 0.012, 0.05, 0.2) * clamp((rpx - 5) / 25, 0, 1);
      g.addColorStop(0, rgba(col, al)); g.addColorStop(0.5, rgba(col, al * 0.35)); g.addColorStop(1, rgba(col, 0));
      ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(northDir(view, D.v) - D.pa * D2R); ctx.scale(1, Math.max(0.25, D.b / D.a)); ctx.translate(-P[0], -P[1]); ctx.fillStyle = g; ctx.fillRect(P[0] - rpx * 1.4, P[1] - rpx * 1.4, rpx * 2.8, rpx * 2.8); ctx.restore();
    }
    ctx.restore();
    const showAll = fov < 70, nm = fov < 26;
    ctx.lineWidth = 1;
    for (const D of DSO) {
      if (!showAll && D.mag > 5.2) continue; if (!pj(view, D.v) || !aboveGround(D.v)) continue;
      const x = P[0], y = P[1]; if (x < -30 || x > Wv + 30 || y < -30 || y > Hv + 30) continue;
      const rr = Math.max(4.5, Math.min(60, D.a / 60 * D2R * view.scale * 0.5)), rb = Math.max(2.5, rr * D.b / D.a);
      const isSel = sel && sel.type === 'dso' && sel.id === D.id;
      ctx.strokeStyle = rgba(isSel ? c.accent : mix3(c.label, c.accent, 0.35), isSel ? 0.95 : 0.55);
      ctx.beginPath();
      if (D.type === 's' || D.type === 'e' || D.type === 'i') { ctx.ellipse(x, y, rr, rb, northDir(view, D.v) - D.pa * D2R, 0, TAU); }
      else if (D.type === 'oc') { ctx.setLineDash([2, 2.5]); ctx.arc(x, y, rr, 0, TAU); }
      else if (D.type === 'gc') { ctx.arc(x, y, rr, 0, TAU); ctx.moveTo(x - rr, y); ctx.lineTo(x + rr, y); ctx.moveTo(x, y - rr); ctx.lineTo(x, y + rr); }
      else if (D.type === 'pn') { ctx.arc(x, y, rr * 0.6, 0, TAU); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * rr * 0.6, y + dy * rr * 0.6); ctx.lineTo(x + dx * rr * 1.1, y + dy * rr * 1.1); } }
      else if (D.type === 'pos') { ctx.setLineDash([1, 3]); ctx.arc(x, y, rr, 0, TAU); }
      else { const s = rr * 0.9; ctx.rect(x - s, y - s, s * 2, s * 2); }
      ctx.stroke(); ctx.setLineDash([]);
      if (showAll || D.mag < 4.6 || isSel) labels.push({ pr: (D.mag < 5 ? D.mag * 0.35 : 3 + D.mag * 0.1) + (isSel ? -10 : 0), txt: nm && D.name ? `${D.id} · ${D.name}` : D.id, x: x + rr + 4, y: y + 4, font: fnt('star', 12 * style.labelSize), col: mix3(c.label, c.accent, 0.35), a: 0.8 });
    }
  }
  // --- solar system
  if (layers.planets || layers.sunmoon) {
    for (const B of bodies) {
      const isPl = B.id !== 'sun' && B.id !== 'moon'; if (isPl && !layers.planets) continue; if (!isPl && !layers.sunmoon) continue;
      if (!pj(view, B.v) || !aboveGround(B.v)) continue; const x = P[0], y = P[1]; if (x < -80 || x > Wv + 80 || y < -80 || y > Hv + 80) continue;
      const col = mix3(hex2rgb(B.col), c.mid, 0.25);
      let r;
      if (B.id === 'sun' || B.id === 'moon') {
        r = Math.max(B.id === 'sun' ? 7 : 6.5, B.size / 2 * D2R * view.scale);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (B.id === 'sun' ? 6 : 4)); g.addColorStop(0, rgba(col, B.id === 'sun' ? 0.35 : 0.16)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * (B.id === 'sun' ? 6 : 4), 0, TAU); ctx.fill(); ctx.restore();
        if (B.id === 'sun') { ctx.fillStyle = rgba(mix3(col, [1, 1, 1], 0.4), 0.95); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        else drawMoon(ctx, view, x, y, r, B, col, c);
      } else {
        r = clamp(starCore(B.mag, view) * 1.15, 1.8, 6.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5); g.addColorStop(0, rgba(col, 0.5)); g.addColorStop(0.25, rgba(col, 0.14)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = rgba(mix3(col, [1, 1, 1], 0.35), 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        if (B.id === 'saturn' && r > 2.5) { ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.75, -0.35, 0, TAU); ctx.stroke(); }
      }
      labels.push({ pr: -2, txt: B.name, x: x + r + 6, y: y + 4, font: fnt('star', 13.5 * style.labelSize), col: mix3(col, c.label, 0.3), a: 0.95, w: 0 });
    }
  }
  // --- horizon and cardinal points
  if (obs) {
    const M = view.VF;
    if (layers.ground) {
      const pts = []; for (let k = 0; k <= 720; k++) { const a = k / 720 * TAU - Math.PI; const h = horizonH(a); pts.push([Math.cos(h) * Math.cos(a), Math.cos(h) * Math.sin(a), Math.sin(h)]); }
      const gcf = groundCheckFrame; groundCheckFrame = false;
      ctx.beginPath(); strokeVecs(ctx, view, pts, false, M, true); ctx.strokeStyle = rgba(mix3(c.glow, c.accent, 0.3), 0.55); ctx.lineWidth = 1; ctx.stroke(); groundCheckFrame = gcf;
    } else {
      const pts = []; for (let k = 0; k <= 360; k++) pts.push(vec(k, 0)); ctx.beginPath(); groundCheckFrame = false; strokeVecs(ctx, view, pts, false, M, true); ctx.strokeStyle = rgba(c.accent, 0.5); ctx.lineWidth = 1; ctx.stroke(); groundCheckFrame = obs && layers.ground;
    }
    if (layers.cardinals) {
      const names = ['PN', 'PN-WSCH', 'WSCH', 'PD-WSCH', 'PD', 'PD-ZACH', 'ZACH', 'PN-ZACH'];
      for (let k = 0; k < 8; k++) {
        const az = k * 45, lo = -az; const v = vec(lo, layers.ground ? -4 : -2.5);
        if (!pjM(view, M, v)) continue; if (P[0] < -20 || P[0] > Wv + 20 || P[1] < -20 || P[1] > Hv + 20) continue;
        ctx.font = k % 2 ? `500 ${9.5 * style.labelSize}px "JetBrains Mono", ui-monospace, monospace` : `600 ${12.5 * style.labelSize}px "JetBrains Mono", ui-monospace, monospace`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = k % 2 ? '1.5px' : '3px';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; drawText(ctx, names[k], P[0], P[1], k === 0 ? c.accent : c.label, k % 2 ? 0.55 : 0.85);
        placer.add(P[0] - 20, P[1] - 10, 40, 20);
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
  }
  ctx.textBaseline = 'alphabetic';
  // --- constellation names
  /* All 88 names: well-known constellations (rank 1) large, rank 2 smaller, the least known (rank 3)
     smallest and dimmest. Each name can carry a small icon cut from its illustration. Names are placed
     in rank order, so a lesser constellation gives way when labels would collide. */
  if (layers.conNames) {
    const sz = 12.5 * style.labelSize * clamp(Math.pow(90 / fov, 0.22), 0.82, 1.5);
    const dens = style.labelDensity, icons = layers.conIcons && ICON.img;
    ctx.textAlign = 'left';
    const list = CONS.slice().sort((a, b) => a.rank - b.rank);
    for (const C of list) {
      const hi = hiCons.find(h => h[0] === C.i);
      const show = hi || C.rank === 1 || (C.rank === 2 && (fov < 175 || dens > 0.5)) || (C.rank === 3 && (fov < 150 || dens > 0.75));
      if (!show) continue;
      for (const v of [C.v, C.v2]) {
        if (!v || !pj(view, v) || !aboveGround(v)) continue; const x = P[0], y = P[1];
        if (x < 0 || x > Wv || y < 0 || y > Hv) continue;
        const name = (settings.latin ? C.la : C.pl).toUpperCase();
        const s = Math.max(8.5, sz * (hi ? 1.18 : C.rank === 1 ? 1 : C.rank === 2 ? 0.88 : 0.76));
        ctx.font = fnt('con', s);
        if ('letterSpacing' in ctx) ctx.letterSpacing = (s * 0.22).toFixed(1) + 'px';
        const w = ctx.measureText(name).width, is = icons ? s * 1.9 : 0, gap = icons ? s * 0.4 : 0, tw = is + gap + w, x0 = x - tw / 2, cy = y - s * 0.36;
        const bh = Math.max(s * 1.3, is);
        if (!hi && !placer.try(x0 - 4, cy - bh / 2, tw + 8, bh)) continue; if (hi) placer.add(x0, cy - bh / 2, tw, bh);
        const a = hi ? 0.65 + 0.35 * hi[1] : (C.rank === 1 ? 0.62 : C.rank === 2 ? 0.52 : 0.42), col = hi ? mix3(c.label, c.accent, hi[1]) : c.label;
        if (icons) drawIcon(ctx, C.i, x0, cy - is / 2, is, col, Math.min(1, a * 1.15));
        ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(c.bg1, 0.6); ctx.strokeText(name, x0 + is + gap, y); drawText(ctx, name, x0 + is + gap, y, col, a);
        break;
      }
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  // --- star names
  if (layers.starNames && layers.stars) {
    const lim = clamp(0.9 + style.labelDensity * 2.4 + 2.3 * Math.log10(100 / fov), 0.4, 6.5);
    const bayerOn = fov < 32;
    const fs = 12.5 * style.labelSize;
    for (let i = 0; i < SP.n; i++) {
      if (!SP.ok[i] || famousDone.has(i)) continue; const m = STAR.mag[i];
      const isSel = sel && sel.type === 'star' && sel.i === i;
      if (m > lim + (bayerOn ? 0.9 : 0) && !isSel) continue;
      let txt = '', big = false;
      if (STAR.name[i] && (m <= lim || isSel)) { txt = STAR.name[i]; big = true; }
      else if (bayerOn && STAR.bayer[i]) txt = STAR.bayer[i];
      else if (isSel) txt = designation(i);
      if (!txt) continue;
      labels.push({ pr: m + (big ? 0 : 1.5) + (isSel ? -10 : 0), txt, x: SP.x[i] + SP.r[i] + 4, y: SP.y[i] + 4, font: fnt('star', big ? fs : fs * 0.92), col: c.label, a: big ? 0.88 : 0.6 });
    }
  }
  labels.sort((a, b) => a.pr - b.pr);
  ctx.textAlign = 'left';
  ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(c.bg1, 0.7);
  let nLab = 0; const maxLab = 70 + style.labelDensity * 120;
  for (const L of labels) {
    if (nLab > maxLab) break;
    ctx.font = L.font; const w = ctx.measureText(L.txt).width; const h = 12 * style.labelSize;
    if (L.x > Wv || L.x + w < 0 || L.y < 0 || L.y - h > Hv) continue;
    if (!placer.try(L.x - 1, L.y - h, w + 2, h + 3)) continue;
    ctx.strokeText(L.txt, L.x, L.y); drawText(ctx, L.txt, L.x, L.y, L.col, L.a); nLab++;
  }
  ctx.restore();
  // --- selection reticle
  if (sel && !o.clean) {
    const v = selVec(); if (v && pj(view, v)) {
      const x = P[0], y = P[1]; let r = 14;
      if (sel.type === 'star') r = Math.max(11, starCore(STAR.mag[sel.i], view) * 2 + 7);
      if (sel.type === 'dso') { const D = DSO.find(d => d.id === sel.id); r = Math.max(13, Math.min(80, D.a / 60 * D2R * view.scale * 0.5) + 6); }
      if (sel.type === 'body') { const B = bodyById(sel.id); r = Math.max(13, (B.size || 0) / 2 * D2R * view.scale + 7); }
      const t = clamp((performance.now() - selAnimT) / 350, 0, 1); const k = 1 + (1 - ease(t)) * 1.2; const R = r * k; const a = 0.4 + 0.6 * t;
      ctx.strokeStyle = rgba(c.accent, 0.9 * a); ctx.lineWidth = 1.4; ctx.beginPath(); const L = Math.min(R * 0.55, 9);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x + sx * R, y + sy * (R - L)); ctx.lineTo(x + sx * R, y + sy * R); ctx.lineTo(x + sx * (R - L), y + sy * R); }
      ctx.stroke();
    }
  }
  // --- tour / target focus marker
  if (focus.obj && focus.a > 0.05 && !o.clean) {
    const fo = focus.obj, v = fo.type === 'star' ? starV(fo.i) : fo.type === 'dso' ? (DSO.find(d => d.id === fo.id) || {}).v : null;
    if (v && pj(view, v)) {
      const x = P[0], y = P[1]; let r = fo.type === 'star' ? Math.max(14, starCore(STAR.mag[fo.i], view) * 2 + 10) : Math.max(16, Math.min(90, (DSO.find(d => d.id === fo.id).a) / 60 * D2R * view.scale * 0.5) + 8);
      r *= 1 + (1 - focus.a) * 0.8;
      ctx.save(); ctx.strokeStyle = rgba(c.accent, 0.85 * focus.a); ctx.lineWidth = 1.2; ctx.shadowColor = rgba(c.accent, 0.6 * focus.a); ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r + 6, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r + 6, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); ctx.restore();
    }
  }
  if (settings.crosshair && !o.clean) {
    ctx.strokeStyle = rgba(c.accent, 0.55); ctx.lineWidth = 1; ctx.beginPath();
    const x = Wv / 2, y = Hv / 2; ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y); ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 16); ctx.stroke();
  }
}
function northDir(view, v) {
  // canvas angle (radians) pointing toward celestial north at v
  const sx = P[0], sy = P[1], sz = P[2];
  let a = -Math.PI / 2;
  if (pj(view, v)) { const x0 = P[0], y0 = P[1]; const [ra, de] = sph(v); if (pj(view, vec(ra, Math.min(89.9, de + 0.2)))) a = Math.atan2(P[1] - y0, P[0] - x0); }
  P[0] = sx; P[1] = sy; P[2] = sz; return a;
}
function drawMoon(ctx, view, x, y, r, B, col, c) {
  const sun = bodyById('sun');
  // direction toward the sun on screen
  let ang = 0; if (pj(view, slerp(B.v, sun.v, 0.02))) ang = Math.atan2(P[1] - y, P[0] - x);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = rgba(mix3(c.bg1, col, 0.12), 0.95); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  const k = B.illum, e = r * (1 - 2 * k);
  ctx.fillStyle = rgba(mix3(col, [1, 1, 1], 0.2), 0.96);
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); ctx.ellipse(0, 0, Math.abs(e), r, 0, Math.PI / 2, -Math.PI / 2, e > 0); ctx.fill();
  ctx.restore();
}
function designation(i) {
  const C = CONS[STAR.dcon[i]]; const g = C ? C.gen : '';
  if (STAR.bayer[i]) return `${STAR.bayer[i]} ${g}`; if (STAR.flam[i]) return `${STAR.flam[i]} ${g}`; return `HIP ${STAR.hip[i]}`;
}

