'use strict';
/* FIRMAMENT · stan i rzutowanie
   Stan widoku, miejsca obserwacji ze strefami czasowymi, macierze kamery, rzutowania
   (stereograficzne, równoodległe, ortograficzne), refrakcja w widoku z miejsca, horyzont. */
const LOCS = [
  { n: 'Warszawa', lat: 52.23, lon: 21.01, tz: 'Europe/Warsaw' }, { n: 'Kraków', lat: 50.06, lon: 19.94, tz: 'Europe/Warsaw' }, { n: 'Gdańsk', lat: 54.35, lon: 18.65, tz: 'Europe/Warsaw' },
  { n: 'Wrocław', lat: 51.11, lon: 17.03, tz: 'Europe/Warsaw' }, { n: 'Poznań', lat: 52.41, lon: 16.93, tz: 'Europe/Warsaw' }, { n: 'Bieszczady (park ciemnego nieba)', lat: 49.21, lon: 22.53, tz: 'Europe/Warsaw' },
  { n: 'Reykjavík', lat: 64.15, lon: -21.94, tz: 'Atlantic/Reykjavik' }, { n: 'Quito (równik)', lat: -0.18, lon: -78.47, tz: 'America/Guayaquil' }, { n: 'Atacama, Paranal', lat: -24.63, lon: -70.40, tz: 'America/Santiago' },
  { n: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' }, { n: 'Własne współrzędne', lat: null, lon: null, tz: null }
];
const HOME = { mode: 'eq', proj: 0, lon: 281, lat: -14, roll: -38, fov: 124 };
const st = { mode: 'eq', proj: 0, lon: HOME.lon, lat: HOME.lat, roll: HOME.roll, fov: HOME.fov, time: Date.now(), playing: false, speed: 600, loc: Object.assign({ n: 'Warszawa', lat: 52.23, lon: 21.01, tz: 'Europe/Warsaw' }, SAVED.loc || {}) };
/* Time at the observing site: preset sites use their real time zone (with daylight saving time),
   custom coordinates use zone time rounded from longitude. */
function locOffsetMin(ms) { const o = tzOffsetMin(st.loc.tz, ms); return o != null ? o : Math.round(st.loc.lon / 15) * 60; }
function locParts(ms) { const d = new Date(ms + locOffsetMin(ms) * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() }; }
function fromLocal(y, mo, d, h, mi) { let ms = Date.UTC(y, mo - 1, d, h, mi); for (let k = 0; k < 3; k++) ms = Date.UTC(y, mo - 1, d, h, mi) - locOffsetMin(ms) * 60000; return ms; }
const WD = ['nd.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
function fmtLocTime(ms) { const p = locParts(ms); return `${pad2(p.h)}:${pad2(p.mi)}`; }
function fmtLocDate(ms, wd) { const p = locParts(ms); return `${wd ? WD[p.wd] + ', ' : ''}${pad2(p.d)}.${pad2(p.mo)}.${p.y}`; }
function fmtUtcOff(ms) { const o = locOffsetMin(ms), a = Math.abs(o); return `UTC${o < 0 ? '−' : '+'}${Math.floor(a / 60)}${a % 60 ? ':' + pad2(a % 60) : ''}`; }
const maxFov = () => st.proj === 0 ? 220 : st.proj === 1 ? 360 : 180;
const clampFov = f => clamp(f, 0.4, maxFov());
let W = 800, H = 600;
let Fcache = { key: '', F: I3 };
function frameF() {
  if (st.mode !== 'hor') return I3;
  const jd = jdOf(st.time); const key = jd.toFixed(7) + st.loc.lat + ',' + st.loc.lon;
  if (key !== Fcache.key) Fcache = { key, F: horMatrix(jd, st.loc.lat, st.loc.lon) };
  return Fcache.F;
}
function computeView(o, w, h) {
  const lon = o.lon * D2R, lat = o.lat * D2R, R = o.roll * D2R;
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  const f = [cl * co, cl * so, sl], e = [-so, co, 0], n = [-sl * co, -sl * so, cl];
  const cR = Math.cos(R), sR = Math.sin(R);
  const rx = [-e[0] * cR - n[0] * sR, -e[1] * cR - n[1] * sR, -e[2] * cR - n[2] * sR];
  const ry = [-e[0] * sR + n[0] * cR, -e[1] * sR + n[1] * cR, -e[2] * sR + n[2] * cR];
  const VF = [...rx, ...ry, ...f];
  const F = o.F || I3;
  const V = mm(VF, F);
  const half = o.fov / 2 * D2R;
  const rEdge = o.proj === 0 ? 2 * Math.tan(half / 2) : o.proj === 1 ? half : Math.sin(Math.min(half, Math.PI / 2));
  return { V, VF, F, refr: !!o.refr, scale: (Math.max(w, h) / 2) / rEdge, W: w, H: h, cx: w / 2, cy: h / 2, proj: o.proj, fov: o.fov };
}
// refraction applies in the observer view when the atmosphere layer is on
const refrOn = () => st.mode === 'hor' && layers.atmosphere;
const viewNow = () => computeView({ lon: st.lon, lat: st.lat, roll: st.roll, fov: st.fov, proj: st.proj, F: frameF(), refr: refrOn() }, W, H);
const P = [0, 0, 0];
function pjM(view, M, v) {
  if (view.refr && M === view.V) { v = refrVec(mv(view.F, v)); M = view.VF; }   // true -> apparent position
  const X = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], Y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], Z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
  let k;
  if (view.proj === 0) { if (Z < -0.86) return false; k = 2 / (1 + Z); }
  else if (view.proj === 1) { if (Z < -0.9995) return false; const s = Math.hypot(X, Y); k = s < 1e-9 ? 1 : Math.atan2(s, Z) / s; }
  else { if (Z < 0) return false; k = 1; }
  P[0] = view.cx + X * k * view.scale; P[1] = view.cy - Y * k * view.scale; P[2] = Z; return true;
}
const pj = (view, v) => pjM(view, view.V, v);
function unproject(view, x, y) {
  const px = (x - view.cx) / view.scale, py = (view.cy - y) / view.scale; let L;
  if (view.proj === 0) { const r2 = px * px + py * py, a = (4 - r2) / (4 + r2), k = (1 + a) / 2; L = [px * k, py * k, a]; }
  else if (view.proj === 1) { const th = Math.hypot(px, py); if (th > Math.PI) return null; const s = th > 1e-9 ? Math.sin(th) / th : 1; L = [px * s, py * s, Math.cos(th)]; }
  else { const r2 = px * px + py * py; if (r2 > 1) return null; L = [px, py, Math.sqrt(1 - r2)]; }
  if (view.refr) return mtv(view.F, unrefrVec(mtv(view.VF, L)));
  return mtv(view.V, L);
}
// eq (J2000) <-> apparent frame coordinates (horizontal with refraction in the observer view)
const frameOf = vEq => { const h = mv(frameF(), vEq); return refrOn() ? refrVec(h) : h; };
const eqOfFrame = h => mtv(frameF(), refrOn() ? unrefrVec(h) : h);
const centerEq = () => eqOfFrame(vec(st.lon, st.lat));
// apparent horizontal position (with refraction when the atmosphere is on)
function horOf(vEq) { let h = mv(frameF(), vEq); if (refrOn()) h = refrVec(h); return { alt: Math.asin(clamp(h[2], -1, 1)) * R2D, lonh: Math.atan2(h[1], h[0]), az: ((-Math.atan2(h[1], h[0]) * R2D) % 360 + 360) % 360 }; }
// horizon silhouette (radians), identical formula in GLSL
const hs = (k, p, a) => 0.5 + 0.5 * Math.sin(k * a + p);
function horizonH(a) { return 0.004 + 0.020 * hs(2, 0.3, a) * hs(5, 1.1, a) + 0.012 * hs(9, 2.0, a) * hs(3, 0.7, a) + 0.005 * hs(17, 0.2, a) * hs(6, 2.4, a) + 0.0025 * hs(31, 1.7, a) + 0.0012 * hs(57, 0.4, a); }
function aboveGround(vEq) {
  if (st.mode !== 'hor' || !layers.ground) return true;
  let h = mv(frameF(), vEq); if (refrOn()) h = refrVec(h); return Math.asin(clamp(h[2], -1, 1)) > horizonH(Math.atan2(h[1], h[0])) - 0.002;
}
function magLimit(fov) { return Math.min(10, style.magLim + (fov < 100 ? 2.0 : 1.2) * Math.log10(100 / fov)); }
const SIZEEXP = { flat: 0.2, natural: 0.27, dramatic: 0.34 };
const zoomSize = fov => clamp(Math.pow(60 / fov, 0.12), 0.85, 1.45);
function starCore(mag, view) { const f = Math.pow(10, 0.4 * (magLimit(view.fov) - mag)); return style.size * zoomSize(view.fov) * (0.5 + 0.46 * Math.pow(Math.max(f, 0.3), SIZEEXP[style.sizeMode] || 0.27)); }

