'use strict';
/* FIRMAMENT · narzędzia
   Matematyka wektorowa, formatowanie liczb i współrzędnych, pamięć przeglądarki. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI, TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const hex2rgb = h => { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rgb2hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const rgba = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${clamp(a, 0, 1).toFixed(3)})`;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360 / 360; const f = n => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return rgb2hex([f(0), f(8), f(4)]); };
function vec(ra, dec) { const r = ra * D2R, d = dec * D2R, c = Math.cos(d); return [c * Math.cos(r), c * Math.sin(r), Math.sin(d)]; }
function sph(v) { return [((Math.atan2(v[1], v[0]) * R2D) % 360 + 360) % 360, Math.asin(clamp(v[2], -1, 1)) * R2D]; }
function mv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function mtv(m, v) { return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; }
function mm(a, b) { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; }
function tr(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angDist = (a, b) => Math.acos(clamp(dot(a, b), -1, 1)) * R2D;
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const GAL = [-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.4448296300, 0.7469822445, -0.8676661490, -0.1980763734, 0.4559837762];
const EPS = 23.4392911 * D2R;
const eclToEq = v => { const c = Math.cos(EPS), s = Math.sin(EPS); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
function slerp(a, b, t) {
  let d = clamp(dot(a, b), -1, 1);
  if (d > 0.999999) return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  if (d < -0.9999) { const p = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const ax = [a[1] * p[2] - a[2] * p[1], a[2] * p[0] - a[0] * p[2], a[0] * p[1] - a[1] * p[0]]; const l = Math.hypot(...ax); const m = [ax[0] / l, ax[1] / l, ax[2] / l]; const th = Math.PI * t; return [a[0] * Math.cos(th) + m[0] * Math.sin(th), a[1] * Math.cos(th) + m[1] * Math.sin(th), a[2] * Math.cos(th) + m[2] * Math.sin(th)]; }
  const w = Math.acos(d), s = Math.sin(w), k0 = Math.sin((1 - t) * w) / s, k1 = Math.sin(t * w) / s;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}
// mulberry32 – small seeded PRNG by Tommy Ettinger (public domain)
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pl = (x, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−');
const pad2 = n => String(n).padStart(2, '0');
function fmtRA(ra) { let s = Math.round(((ra % 360) + 360) % 360 / 15 * 3600); const h = Math.floor(s / 3600) % 24; s %= 3600; return `${pad2(h)}h ${pad2(Math.floor(s / 60))}m ${pad2(s % 60)}s`; }
function fmtDec(d) { const sg = d < 0 ? '−' : '+'; let s = Math.round(Math.abs(d) * 3600); const dd = Math.floor(s / 3600); s %= 3600; return `${sg}${pad2(dd)}° ${pad2(Math.floor(s / 60))}′ ${pad2(s % 60)}″`; }
function fmtDeg(d) { const sg = d < 0 ? '−' : ''; let m = Math.round(Math.abs(d) * 60); return `${sg}${Math.floor(m / 60)}° ${pad2(m % 60)}′`; }
const normTxt = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9α-ω ]/g, ' ').replace(/\s+/g, ' ').trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
// Halton low-discrepancy sequence – sub-pixel offsets for progressive anti-aliasing
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
const reduceMQ = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

