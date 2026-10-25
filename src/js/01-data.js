'use strict';
/* FIRMAMENT · dane katalogowe
   Rozpakowanie SKYDATA: gwiazdy do 8 mag (J2000, 0,001°), gwiazdozbiory (linie, granice, siatka przynależności),
   obiekty Messiera. STAR.con – gwiazdozbiór wg granic IAU; STAR.dcon – gwiazdozbiór z oznaczenia
   Bayera/Flamsteeda (zwykle ten sam; wyjątki to np. 10 UMa leżąca w Rysiu). */
const SD = SKYDATA;
/* Stars are stored in binary (base64), 13 bytes each, sorted by magnitude:
   RA u24 (0.001°), Dec+90° u24 (0.001°), (mag+2)·100 u16, B−V·50+128 u8, IAU constellation u8, HIP u24. */
const NS = SD.NS;
const STAR = { v: new Float32Array(NS * 3), ra: new Float32Array(NS), dec: new Float32Array(NS), mag: new Float32Array(NS), bv: new Float32Array(NS), con: new Int16Array(NS), dcon: new Int16Array(NS), hip: new Int32Array(NS), name: [], bayer: [], flam: [] };
{
  const bin = atob(SD.SB), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  const u24 = o => u[o] | u[o + 1] << 8 | u[o + 2] << 16;
  for (let i = 0; i < NS; i++) {
    const o = i * 13, ra = u24(o) / 1000, de = u24(o + 3) / 1000 - 90;
    STAR.ra[i] = ra; STAR.dec[i] = de; STAR.mag[i] = (u[o + 6] | u[o + 7] << 8) / 100 - 2; STAR.bv[i] = (u[o + 8] - 128) / 50;
    STAR.con[i] = u[o + 9]; STAR.hip[i] = u24(o + 10);
    const v = vec(ra, de); STAR.v[i * 3] = v[0]; STAR.v[i * 3 + 1] = v[1]; STAR.v[i * 3 + 2] = v[2];
    const n = SD.N[i]; STAR.name[i] = n ? n[0] : ''; STAR.bayer[i] = n ? n[1] : ''; STAR.flam[i] = n ? n[2] : '';
    STAR.dcon[i] = n && n[3] >= 0 ? n[3] : STAR.con[i];   // constellation of the Bayer/Flamsteed designation
  }
}
const starByHip = new Map(); for (let i = NS - 1; i >= 0; i--) starByHip.set(STAR.hip[i], i);
/* index of the first star fainter than m (stars are sorted by magnitude) */
function starsTo(m) { let lo = 0, hi = NS; while (lo < hi) { const k = (lo + hi) >> 1; if (STAR.mag[k] <= m) lo = k + 1; else hi = k; } return lo; }
const starV = i => [STAR.v[i * 3], STAR.v[i * 3 + 1], STAR.v[i * 3 + 2]];
function densify(flat, closed, step = 1) {
  const pts = []; const n = flat.length / 2;
  const segs = closed ? n : n - 1;
  for (let k = 0; k < segs; k++) {
    const r1 = flat[k * 2], d1 = flat[k * 2 + 1], r2 = flat[((k + 1) % n) * 2], d2 = flat[((k + 1) % n) * 2 + 1];
    const dr = angDiff(r2, r1); const m = Math.max(1, Math.ceil(Math.max(Math.abs(dr) * Math.cos(Math.min(Math.abs(d1), Math.abs(d2)) * D2R), Math.abs(d2 - d1)) / step));
    for (let s = 0; s < m; s++) { const t = s / m; pts.push(vec(r1 + dr * t, d1 + (d2 - d1) * t)); }
  }
  if (!closed) pts.push(vec(flat[(n - 1) * 2], flat[(n - 1) * 2 + 1]));
  return pts;
}
const CONS = SD.cons.map((c, i) => ({
  ...c, i, v: vec(c.pos[0], c.pos[1]), v2: c.pos2 ? vec(c.pos2[0], c.pos2[1]) : null, cv: vec(c.c[0], c.c[1]),
  lines: (SD.L[c.id] || []).map(pl => pl.map(p => Array.isArray(p) ? { v: vec(p[0], p[1]), mag: 5, s: -1 } : { v: starV(p), mag: STAR.mag[p], s: p })),
  rings: (SD.BD[i] || []).map(r => densify(r, true, 1))
}));
const BORDERS = SD.B.map(b => densify(b, false, 1));
// constellation lookup grid (0.25°)
const GRID = new Uint8Array(1440 * 720);
{ let p = 0; for (let k = 0; k < SD.CG.length; k += 2) { GRID.fill(SD.CG[k], p, p + SD.CG[k + 1]); p += SD.CG[k + 1]; } }
function conAt(v) { const [ra, de] = sph(v); const gx = Math.min(1439, (ra / 360 * 1440) | 0), gy = clamp(((de + 90) / 180 * 720) | 0, 0, 719); return GRID[gy * 1440 + gx]; }
const DSOT = { gc: 'Gromada kulista', oc: 'Gromada otwarta', pn: 'Mgławica planetarna', snr: 'Pozostałość po supernowej', sfr: 'Mgławica emisyjna', rn: 'Mgławica refleksyjna', s: 'Galaktyka spiralna', e: 'Galaktyka eliptyczna', i: 'Galaktyka nieregularna', pos: 'Asteryzm' };
const DSOPA = { M31: 35, M33: 23, M81: 157, M82: 65, M104: 90, M51: 163, M63: 105, M64: 115, M65: 3, M66: 173, M106: 152, M77: 70, M8: 72, M1: 125, M27: 30, M57: 60, M42: 10, M98: 153, M99: 0, M100: 30, M108: 79, M109: 23, M88: 141, M90: 23, M58: 95, M83: 45, M101: 0, M102: 122, M110: 170, M32: 170, M74: 0, M94: 115, M96: 15, M95: 0 };
const DSO = SD.M.map(m => ({ id: m[0], ra: m[1], dec: m[2], type: m[3], mag: m[4], a: m[5], b: m[6], name: m[7], ngc: m[8], v: vec(m[1], m[2]), pa: DSOPA[m[0]] || 0, con: conAt(vec(m[1], m[2])) }));

