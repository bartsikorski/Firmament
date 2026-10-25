'use strict';
/* FIRMAMENT · astronomia
   Czas gwiazdowy, precesja (J2000 → epoka obserwacji), układ horyzontalny z refrakcją,
   Słońce i planety (elementy JPL + poprawki dopasowane do efemeryd ERFA dla planet zewnętrznych),
   Księżyc (główne wyrazy teorii Meeusa, z paralaksą w widoku z miejsca), strefy czasowe, cefeidy.
   Zweryfikowane z biblioteką astropy: gwiazdy w widoku z miejsca < 0,01°, Słońce i planety < 1′,
   Księżyc ok. 1–2′ (1900–2100). */
const jdOf = ms => ms / 86400000 + 2440587.5;
const gmst = jd => { const d = jd - 2451545.0, T = d / 36525; return ((280.46061837 + 360.98564736629 * d + 0.000387933 * T * T) % 360 + 360) % 360; };
// IAU 1976 precession: J2000 mean equator -> mean equator of date (row-major 3x3)
function precMatrix(jd) {
  const T = (jd - 2451545.0) / 36525, as = x => x / 3600 * D2R;
  const ze = as(2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T), z = as(2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T), th = as(2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T);
  const Rz = a => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const Ry = a => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
  return mm(Rz(-z), mm(Ry(th), Rz(-ze)));
}
// J2000 equatorial -> local horizontal frame (x: north, y: west, z: zenith), precession included
function horMatrix(jd, lat, lon) {
  const L = (gmst(jd) + lon) * D2R, cL = Math.cos(L), sL = Math.sin(L);
  const p = lat * D2R, sp = Math.sin(p), cp = Math.cos(p);
  return mm(mm([-sp, 0, cp, 0, -1, 0, cp, 0, sp], [cL, sL, 0, -sL, cL, 0, 0, 0, 1]), precMatrix(jd));
}
// atmospheric refraction (degrees): true -> apparent (Saemundsson) and apparent -> true (Bennett), faded out below -2°
function refrDeg(h) { if (h < -2) return 0; const x = Math.max(h, -1.9), R = 1.02 / Math.tan((x + 10.3 / (x + 5.11)) * D2R) / 60; return h < -1 ? R * (h + 2) : R; }
function unrefrDeg(h) { if (h < -2) return 0; const x = Math.max(h, -1.9), R = 1 / Math.tan((x + 7.31 / (x + 4.4)) * D2R) / 60; return h < -1 ? R * (h + 2) : R; }
function shiftAlt(h, dDeg) { const alt = Math.asin(clamp(h[2], -1, 1)) + dDeg * D2R, l = Math.hypot(h[0], h[1]); if (l < 1e-9) return h; const c = Math.cos(alt) / l; return [h[0] * c, h[1] * c, Math.sin(alt)]; }
const refrVec = h => shiftAlt(h, refrDeg(Math.asin(clamp(h[2], -1, 1)) * R2D));
const unrefrVec = h => shiftAlt(h, -unrefrDeg(Math.asin(clamp(h[2], -1, 1)) * R2D));
const PEL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]]
};
const PINFO = {
  mercury: { pl: 'Merkury', H: -0.42, col: '#cfc3b2', ph: i => 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i },
  venus: { pl: 'Wenus', H: -4.40, col: '#f4ead0', ph: i => 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i },
  mars: { pl: 'Mars', H: -1.52, col: '#e4876a', ph: i => 0.016 * i },
  jupiter: { pl: 'Jowisz', H: -9.40, col: '#ead6b6', ph: i => 0.005 * i },
  saturn: { pl: 'Saturn', H: -8.88, col: '#e6d29e', ph: () => 0 },
  uranus: { pl: 'Uran', H: -7.19, col: '#acdce2', ph: () => 0 },
  neptune: { pl: 'Neptun', H: -6.87, col: '#93acf2', ph: () => 0 }
};
/* Empirical corrections for Jupiter–Neptune (heliocentric longitude/latitude in degrees, radius in au),
   least-squares fitted to the ERFA/astropy ephemeris over 1900–2100; columns: 1, T, then sin/cos of the arguments below. */
const PCORR = {
  jupiter: { l: [-0.029997,0.103023,0.009473,0.028816,0.000265,0.000948,0.000438,0.000911,0.003046,-0.001466,-0.004419,0.021617,-0.08684,0.187762,0.000451,0.004358,-0.034855,-0.00039,0.013836,0.000555,-0.051328,-0.021545,0.012662,0.017167,0.019185,0.008664,-1.7e-05,0.002977], b: [0.000184,-0.000204,-0.000613,0.000795,3.2e-05,2.2e-05,0.000279,-2.8e-05,-5.6e-05,-0.000434,-1.6e-05,5.3e-05,0.000305,-0.000267,1.3e-05,-2e-05,0.000139,-0.00055,9.9e-05,0.000288,-4.1e-05,0.000402,-5.4e-05,4.8e-05,-0.000388,-0.000559,-0.000149,0.000118], r: [-0.000162,0.000154,0.001303,-0.000624,6.9e-05,-2.1e-05,7.4e-05,-1.5e-05,-8.2e-05,-0.00014,0.00064,0.000136,-0.00013,-3.4e-05,-2e-06,-1.3e-05,2.2e-05,0.000278,-7.7e-05,-0.000638,-0.001088,0.002598,0.00064,-0.000467,-0.000491,0.000842,-6.6e-05,2.2e-05] },
  saturn: { l: [0.078754,-0.223839,0.15333,-0.025253,0.003955,-0.005119,-0.000871,0.001685,-2e-06,-6e-06,0.006512,-0.000645,0.197578,-0.455407,-0.043845,-0.099493,0.113535,-0.001095,0.003417,0.055537,0.013384,0.002954,-0.005158,-0.001489,0.00122,0.001966,0.001087,-0.008046], b: [0.000126,-0.00023,0.003307,0.002324,0.001143,-0.001945,0.000299,-0.00019,2.2e-05,1.3e-05,0.002253,-0.001234,-0.000172,-0.00144,0.000641,-0.002998,0.000372,3.6e-05,0.003408,-0.001887,0.002261,0.001055,-0.002069,-0.000736,-6.5e-05,-5.5e-05,0.00014,-1.5e-05], r: [0.005826,-0.00055,-0.002323,-0.013219,-0.00036,-0.000329,5.2e-05,0.000121,-1.1e-05,-9e-06,0.008114,0.001115,0.002942,-0.00169,-0.008104,0.003659,0.000258,-0.005299,-0.004705,0.000131,-0.000251,0.00111,0.00061,-0.00033,0.000273,-0.000222,-0.001268,-0.000164] },
  uranus: { l: [0.005468,-0.014263,0.042194,0.001891,-3e-06,-0.002605,-0.045512,-0.357402,-0.059816,0.356657,0.02072,-0.038952,0.001649,0.001902,-0.013504,-0.005701,-4e-05,-0.000174], b: [-0.000224,0.016811,-0.003327,-0.002319,6e-06,0.000181,-0.024654,0.154663,0.071519,-0.142753,-0.008198,0.004891,-0.000282,0.000215,1.1e-05,1e-06,1.4e-05,8e-06], r: [0.001395,0.162527,-0.046495,-0.040399,-0.00108,-0.001501,-0.28542,1.581619,0.758094,-1.439243,-0.103679,0.062871,-0.004501,0.001821,0.001936,-0.004619,-2.2e-05,6.8e-05] },
  neptune: { l: [436.168943,-5465.111401,10.097771,81.547549,-5.10527,1.098588,5.91966,0.623861,18.103225,-91.390528,-0.008754,0.020995,-31506.850883,-10422.297489], b: [0.439709,7.970035,0.037829,-0.133007,0.014232,-0.000108,-0.014725,-0.005027,-0.086034,0.129197,9.2e-05,-0.000231,46.290758,14.173368], r: [-62.077375,-5226.250393,-16.748997,74.621383,-4.105954,-1.918335,3.821929,3.500596,43.572188,-75.200906,-0.017442,0.005776,-30276.107146,-9507.613604] }
};
function corrArgs(n, T) {
  const Mj = ((34.39644051 + 3034.74612775 * T) - (14.72847983 + 0.21252668 * T)) * D2R, Ms = ((49.95424423 + 1222.49362201 * T) - (92.59887831 - 0.41897216 * T)) * D2R;
  const Mu = ((313.23810451 + 428.48202785 * T) - (170.95427630 + 0.40805281 * T)) * D2R, Mn = ((-55.12002969 + 218.45945325 * T) - (44.96476227 - 0.32241464 * T)) * D2R;
  if (n === 'jupiter') return [Mj, 2 * Mj, Ms, 2 * Ms, Mj - Ms, 2 * Mj - 5 * Ms, 2 * Mj - 4 * Ms, Mj - 2 * Ms, 3 * Mj - 5 * Ms, 2 * Mj - 2 * Ms, 2 * Mj - 3 * Ms, Mj - 5 * Ms, Mj - 3 * Ms];
  if (n === 'saturn') return [Ms, 2 * Ms, Mj, 2 * Mj, Mj - Ms, 2 * Mj - 5 * Ms, 2 * Mj - 4 * Ms, Mj - 2 * Ms, 2 * Mj - 6 * Ms, Mj - 3 * Ms, 2 * Mj - 3 * Ms, 3 * Mj - 5 * Ms, 3 * Ms];
  if (n === 'uranus') return [Mu, 2 * Mu, Mn, Mu - Mn, Ms - 2 * Mu, 2 * Mu - Mn, Mj - Mu, 3 * Mu];
  return [Mn, 2 * Mn, Mu, Mu - Mn, 2 * Mu - Mn, Mu - 2 * Mn];
}
function helio(name, T) {
  const [e0, r] = PEL[name];
  const a = e0[0] + r[0] * T, e = e0[1] + r[1] * T, I = (e0[2] + r[2] * T) * D2R, L = e0[3] + r[3] * T, wb = e0[4] + r[4] * T, Om = e0[5] + r[5] * T;
  const w = (wb - Om) * D2R, O = Om * D2R;
  const M = (((L - wb) % 360 + 540) % 360 - 180) * D2R;
  let E = M + e * Math.sin(M); for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  let v = [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, (sw * sI) * xp + (cw * sI) * yp];
  const C = PCORR[name];
  if (C) {
    const ar = corrArgs(name, T), Tc = clamp(T, -1, 1), ev = c => { let s = c[0] + c[1] * Tc; for (let k = 0; k < ar.length; k++) s += c[2 + 2 * k] * Math.sin(ar[k]) + c[3 + 2 * k] * Math.cos(ar[k]); return s; };
    const rr = Math.hypot(...v) + ev(C.r), lo = Math.atan2(v[1], v[0]) + ev(C.l) * D2R, la = Math.asin(v[2] / Math.hypot(...v)) + ev(C.b) * D2R;
    v = [rr * Math.cos(la) * Math.cos(lo), rr * Math.cos(la) * Math.sin(lo), rr * Math.sin(la)];
  }
  return v;
}
// Moon: main periodic terms of Meeus (Astronomical Algorithms, ch. 47). [D, M, M', F, Σl (1e-6°), Σr (m)]
const MOON_LR = [[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],[2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0]];
const MOON_B = [[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794]];
// geocentric Moon, mean equator of date, km
function moonDate(jd) {
  const T = (jd - 2451545) / 36525, r = D2R;
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T, F = 93.2720950 + 483202.0175233 * T, E = 1 - 0.002516 * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, rr] of MOON_LR) { const k = Math.abs(m) === 1 ? E : m ? E * E : 1, a = (d * D + m * M + mp * Mp + f * F) * r; sl += l * k * Math.sin(a); sr += rr * k * Math.cos(a); }
  for (const [d, m, mp, f, b] of MOON_B) { const k = Math.abs(m) === 1 ? E : m ? E * E : 1; sb += b * k * Math.sin((d * D + m * M + mp * Mp + f * F) * r); }
  sl += 3958 * Math.sin(A1 * r) + 1962 * Math.sin((Lp - F) * r) + 318 * Math.sin(A2 * r);
  sb += -2235 * Math.sin(Lp * r) + 382 * Math.sin(A3 * r) + 175 * Math.sin((A1 - F) * r) + 175 * Math.sin((A1 + F) * r) + 127 * Math.sin((Lp - Mp) * r) - 115 * Math.sin((Lp + Mp) * r);
  const lam = (Lp + sl / 1e6) * r, bet = sb / 1e6 * r, km = 385000.56 + sr / 1000, eps = (23.4392911 - 0.0130042 * T) * r;
  const x = Math.cos(bet) * Math.cos(lam), y = Math.cos(bet) * Math.sin(lam), z = Math.sin(bet);
  return { v: [x * km, (y * Math.cos(eps) - z * Math.sin(eps)) * km, (y * Math.sin(eps) + z * Math.cos(eps)) * km], lam };
}
const MOONPH = ['Nów', 'Przybywający sierp', 'Pierwsza kwadra', 'Przybywający garb', 'Pełnia', 'Ubywający garb', 'Ostatnia kwadra', 'Ubywający sierp'];
// obs = { lat, lon } adds topocentric parallax of the Moon (up to ~1°) for the observer view
function computeBodies(jd, obs) {
  const T = (jd - 2451545.0) / 36525, out = [];
  const E = helio('earth', T); const Rsun = Math.hypot(...E);
  const sunEcl = [-E[0], -E[1], -E[2]];
  const sunV = eclToEq(sunEcl.map(x => x / Rsun));
  out.push({ id: 'sun', name: 'Słońce', kind: 'Gwiazda – Słońce', v: sunV, mag: -26.7, dist: Rsun, col: '#ffe2a8', size: 0.533 });
  const P = precMatrix(jd), md = moonDate(jd); let mv_ = md.v;
  if (obs) { const lst = (gmst(jd) + obs.lon) * D2R, ph = obs.lat * D2R, Re = 6378.14; mv_ = [mv_[0] - Re * Math.cos(ph) * Math.cos(lst), mv_[1] - Re * Math.cos(ph) * Math.sin(lst), mv_[2] - Re * Math.sin(ph)]; }
  const km = Math.hypot(...mv_), moonV = mtv(P, mv_.map(x => x / km));
  const elong = angDist(moonV, sunV); const k = (1 - Math.cos(elong * D2R)) / 2;
  const sunLam = Math.atan2(sunEcl[1], sunEcl[0]) * R2D; const waxing = ((md.lam * R2D - sunLam) % 360 + 360) % 360 < 180;
  let ph; if (k < 0.03) ph = 0; else if (k > 0.97) ph = 4; else if (Math.abs(k - 0.5) < 0.04) ph = waxing ? 2 : 6; else ph = waxing ? (k < 0.5 ? 1 : 3) : (k < 0.5 ? 7 : 5);
  out.push({ id: 'moon', name: 'Księżyc', kind: 'Naturalny satelita Ziemi', v: moonV, mag: -12.7 - 2.5 * Math.log10(Math.max(k, 0.01)), dist: km / 149597870.7, km, col: '#e8e3d6', size: 0.518 * 384400 / km, illum: k, phase: MOONPH[ph], waxing });
  for (const name of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const Pp = helio(name, T); const g = [Pp[0] - E[0], Pp[1] - E[1], Pp[2] - E[2]]; const D = Math.hypot(...g); const rr = Math.hypot(...Pp);
    const ci = clamp((rr * rr + D * D - Rsun * Rsun) / (2 * rr * D), -1, 1); const i = Math.acos(ci) * R2D;
    const info = PINFO[name];
    out.push({ id: name, name: info.pl, kind: 'Planeta', v: eclToEq(g.map(x => x / D)), mag: info.H + 5 * Math.log10(rr * D) + info.ph(i), dist: D, col: info.col, size: 0 });
  }
  return out;
}
// ---------------------------------------------------------------- time zones of observing sites
function tzOffsetMin(tz, ms) {
  if (!tz) return null;
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms) / 60000);
  } catch (e) { return null; }
}
// ---------------------------------------------------------------- Cepheids (pulsating variable stars), keyed by HIP
const CEPHEIDS = {
  110991: { d: 'δ Cephei', t: 'Cefeida klasyczna – prototyp całej klasy', p: 5.366, r: '3,48–4,37' },
  97804: { d: 'η Aquilae', t: 'Cefeida klasyczna', p: 7.177, r: '3,48–4,39' },
  34088: { d: 'ζ Geminorum', t: 'Cefeida klasyczna', p: 10.151, r: '3,62–4,18' },
  26069: { d: 'β Doradus', t: 'Cefeida klasyczna', p: 9.843, r: '3,46–4,08' },
  47854: { d: 'l Carinae', t: 'Cefeida klasyczna o długim okresie', p: 35.56, r: '3,28–4,18' },
  93015: { d: 'κ Pavonis', t: 'Cefeida typu II (W Virginis)', p: 9.088, r: '3,91–4,78' },
  11767: { d: 'α Ursae Minoris', t: 'Cefeida klasyczna o bardzo małej amplitudzie', p: 3.970, r: '≈1,98 (amplituda ok. 0,03)' },
  87072: { d: 'X Sagittarii', t: 'Cefeida klasyczna', p: 7.013, r: '4,20–4,90' },
  88567: { d: 'W Sagittarii (γ¹ Sgr)', t: 'Cefeida klasyczna', p: 7.595, r: '4,29–5,14' }
};
