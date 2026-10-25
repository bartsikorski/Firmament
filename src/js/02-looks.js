'use strict';
/* FIRMAMENT · wyglądy i styl
   Definicje 14 wyglądów (paleta + nastrój nieba), domyślny styl, warstwy i ustawienia,
   zapamiętywanie w przeglądarce i płynne przejścia między wyglądami.
   Żeby dodać własny wygląd na stałe, dopisz obiekt do tablicy LOOKS. */
const LOOKS = [
  /* Realistyczny: neutralna, prawie czarna noc, ciepło-szara Droga Mleczna z pyłem, gwiazdy w barwach
     zbliżonych do rzeczywistych (lekko stonowanych), bez sztucznych mgławic. Wygląd domyślny. */
  { id: 'real', name: 'Realistyczny', c: { bg0: '#0b0e14', bg1: '#020305', mwLo: '#34322e', mwHi: '#d8d2c4', neb: '#141820', hot: '#b2c6ff', mid: '#fff6ec', cool: '#ffc995', line: '#7f8a9a', grid: '#3b4352', label: '#cdd2da', accent: '#e8edf5', ground: '#030304', glow: '#161b25' }, p: { mw: 0.58, neb: 0.03, dust: 0.85, glow: 0.7, spikes: 0.12, sat: 0.72, art: 0 } },
  /* Mitologia: atlas z półprzezroczystymi ilustracjami figur gwiazdozbiorów. */
  { id: 'myth', name: 'Mitologia', c: { bg0: '#16305e', bg1: '#060f22', mwLo: '#28508e', mwHi: '#c9d9f3', neb: '#21457e', hot: '#d2deff', mid: '#ffffff', cool: '#ffe3c6', line: '#e2ebff', grid: '#3a5a8e', label: '#f3f7ff', accent: '#ffffff', ground: '#040a14', glow: '#1c3866' }, p: { mw: 0.42, neb: 0.18, dust: 0.5, glow: 0.9, spikes: 0.2, sat: 0.5, art: 0.62 } },
  { id: 'porcelain', name: 'Porcelana', c: { bg0: '#0d1934', bg1: '#04080f', mwLo: '#1f3a66', mwHi: '#d3d9e2', neb: '#24406e', hot: '#9fbcf0', mid: '#eef0f0', cool: '#f3cfa6', line: '#7090c2', grid: '#3a5584', label: '#d2dbe9', accent: '#dce8f8', ground: '#03060b', glow: '#1d3156' }, p: { mw: 0.6, neb: 0.22, dust: 0.7, glow: 0.85, spikes: 0.3, sat: 0.85 } },
  { id: 'gilded', name: 'Pozłacany', c: { bg0: '#17120b', bg1: '#060504', mwLo: '#45311a', mwHi: '#e2c48a', neb: '#4a321a', hot: '#ece4cf', mid: '#f3e4bf', cool: '#e9b36e', line: '#b48a4a', grid: '#5a4424', label: '#e3cc98', accent: '#e8b65c', ground: '#050403', glow: '#3a2a14' }, p: { mw: 0.6, neb: 0.2, dust: 0.7, glow: 0.9, spikes: 0.45, sat: 0.9 } },
  { id: 'nebula', name: 'Mgławica', c: { bg0: '#1a1030', bg1: '#07050e', mwLo: '#45205a', mwHi: '#e2bcdc', neb: '#6a2a6c', hot: '#b9c6ff', mid: '#f1e7f4', cool: '#ffc4d6', line: '#ad7bc4', grid: '#4a2e5e', label: '#e0c9ea', accent: '#e690c4', ground: '#05030a', glow: '#33173f' }, p: { mw: 0.65, neb: 0.55, dust: 0.6, glow: 0.85, spikes: 0.3, sat: 0.9 } },
  { id: 'ember', name: 'Żar', c: { bg0: '#1c0e0b', bg1: '#070303', mwLo: '#561c10', mwHi: '#eaa56a', neb: '#5e2012', hot: '#ffe0bd', mid: '#ffe4c8', cool: '#ff9a5c', line: '#c06c40', grid: '#5a2b1b', label: '#efc5a2', accent: '#ff9450', ground: '#060202', glow: '#3e150b' }, p: { mw: 0.62, neb: 0.35, dust: 0.7, glow: 0.9, spikes: 0.35, sat: 0.95 } },
  { id: 'aurora', name: 'Zorza', c: { bg0: '#081b1b', bg1: '#030808', mwLo: '#174a42', mwHi: '#b5e4cd', neb: '#46276a', hot: '#b8eee0', mid: '#eaf6ee', cool: '#f0d6b8', line: '#5fb19a', grid: '#1f4a42', label: '#c3e8d9', accent: '#8fe0b6', ground: '#020605', glow: '#0f3a30' }, p: { mw: 0.6, neb: 0.45, dust: 0.6, glow: 0.8, spikes: 0.25, sat: 0.85 } },
  { id: 'glacier', name: 'Lodowiec', c: { bg0: '#0b1a25', bg1: '#03080d', mwLo: '#1d4862', mwHi: '#cde7f1', neb: '#24526c', hot: '#b5dbf5', mid: '#eef7fb', cool: '#e5dfd5', line: '#7eb1cb', grid: '#28485b', label: '#cde2ed', accent: '#9fd6ee', ground: '#02060a', glow: '#16384c' }, p: { mw: 0.62, neb: 0.25, dust: 0.55, glow: 0.85, spikes: 0.4, sat: 0.75 } },
  { id: 'copper', name: 'Miedź', c: { bg0: '#0f1617', bg1: '#040607', mwLo: '#29423f', mwHi: '#dda274', neb: '#47301f', hot: '#c3e0dc', mid: '#f0e2d2', cool: '#e8a070', line: '#bf7f58', grid: '#38443f', label: '#e4c3a7', accent: '#dc8c58', ground: '#030505', glow: '#2a2a20' }, p: { mw: 0.6, neb: 0.3, dust: 0.7, glow: 0.8, spikes: 0.3, sat: 0.85 } },
  { id: 'neon', name: 'Neon', c: { bg0: '#0c0718', bg1: '#030208', mwLo: '#2a0f4c', mwHi: '#8ce4fb', neb: '#5a1062', hot: '#9eefff', mid: '#f4e8ff', cool: '#ff9ede', line: '#d457b4', grid: '#3a1f5c', label: '#b7f1ff', accent: '#4fe1ff', ground: '#030107', glow: '#2c0d48' }, p: { mw: 0.58, neb: 0.45, dust: 0.55, glow: 1, spikes: 0.5, sat: 1 } },
  { id: 'atlas', name: 'Atlas', c: { bg0: '#211a12', bg1: '#0c0906', mwLo: '#4a3a26', mwHi: '#d8c4a0', neb: '#3a2c1a', hot: '#efe4cc', mid: '#f3e7cd', cool: '#e8cfa0', line: '#b59e78', grid: '#5a4a32', label: '#e6d6b4', accent: '#d5a85a', ground: '#080604', glow: '#33281a' }, p: { mw: 0.55, neb: 0.15, dust: 0.5, glow: 0.6, spikes: 0, sat: 0.5 } },
  { id: 'sunset', name: 'Zmierzch', c: { bg0: '#1d1530', bg1: '#080611', mwLo: '#4a2a52', mwHi: '#efc3a0', neb: '#5a2a44', hot: '#cfc8ff', mid: '#ffeedf', cool: '#ffb48a', line: '#cf8a8a', grid: '#4a2e48', label: '#efd0c0', accent: '#f2a172', ground: '#06040a', glow: '#4a2438' }, p: { mw: 0.6, neb: 0.35, dust: 0.6, glow: 0.85, spikes: 0.3, sat: 0.85 } },
  { id: 'ink', name: 'Tusz', c: { bg0: '#111112', bg1: '#040404', mwLo: '#29292b', mwHi: '#d6d4ce', neb: '#1a1a1c', hot: '#f0f0f0', mid: '#efede7', cool: '#e6e0d4', line: '#9a9894', grid: '#3a3a3a', label: '#dcdad4', accent: '#f0eee6', ground: '#030303', glow: '#1c1c1e' }, p: { mw: 0.6, neb: 0.1, dust: 0.75, glow: 0.7, spikes: 0.4, sat: 0 } },
  { id: 'classic', name: 'Klasyczny', c: { bg0: '#080c16', bg1: '#020306', mwLo: '#25303f', mwHi: '#c8cfd8', neb: '#121a28', hot: '#9db4ff', mid: '#fff4ea', cool: '#ffb46c', line: '#4f6a8f', grid: '#2a3a52', label: '#9fb0c8', accent: '#e8c06a', ground: '#020304', glow: '#141c2a' }, p: { mw: 0.62, neb: 0.12, dust: 0.65, glow: 0.75, spikes: 0.25, sat: 1 } }
];
const CKEYS = [['bg1', 'Tło głębokie'], ['bg0', 'Tło jaśniejsze'], ['mwLo', 'Droga Mleczna – cień'], ['mwHi', 'Droga Mleczna – blask'], ['neb', 'Mgławice'], ['hot', 'Gwiazdy gorące'], ['mid', 'Gwiazdy białe'], ['cool', 'Gwiazdy chłodne'], ['line', 'Figury'], ['grid', 'Siatka'], ['label', 'Opisy'], ['accent', 'Akcent'], ['ground', 'Grunt'], ['glow', 'Poświata']];
const PKEYS = ['mw', 'neb', 'dust', 'glow', 'spikes', 'sat', 'art'];
for (const L of LOOKS) if (L.p.art == null) L.p.art = 0;
const STYLE0 = { size: 1.08, bright: 1.4, twinkle: 0.25, magLim: 6.8, spectral: 1, sizeMode: 'natural', lineW: 1, lineA: 0.45, gridA: 0.28, labelSize: 1, labelDensity: 0.5, font: 'atlas', lineStyle: 'soft', vignette: 0.5, grain: 0.35, airglow: 0.6, artInk: 0.45 };
const LAY0 = { stars: true, faint: true, mw: true, planets: true, sunmoon: true, dso: true, starNames: true, conLines: true, conNames: true, bounds: false, conHover: true, grid: true, ecliptic: true, galactic: false, ground: true, cardinals: true, atmosphere: true, art: true, conIcons: true, artNotes: true };  // art: main switch for constellation illustrations
const SET0 = { quality: 'high', flyDur: 1, inertia: 0.75, crosshair: false, latin: false, reduce: reduceMQ, fps: false, artHover: true };
const SAVED = store.get('firmament.v2', {});
const style = Object.assign({}, STYLE0, SAVED.style || {});
const layers = Object.assign({}, LAY0, SAVED.layers || {});
const settings = Object.assign({}, SET0, SAVED.settings || {});
if (!['eco', 'bal', 'high', 'ultra'].includes(settings.quality)) settings.quality = 'high';
let customLooks = Array.isArray(SAVED.custom) ? SAVED.custom : [];
let marks = Array.isArray(SAVED.marks) ? SAVED.marks : [];
const cloneLook = L => ({ id: L.id, name: L.name, c: Object.assign({}, L.c), p: Object.assign({ art: 0 }, L.p), base: L.base || L.id });
// a saved look from an older version is replaced by the new default (Realistyczny)
let cur = SAVED.ver >= 3 && SAVED.look && SAVED.look.c ? cloneLook(SAVED.look) : cloneLook(LOOKS[0]);
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(() => store.set('firmament.v2', { ver: 3, style, layers, settings, custom: customLooks, marks, look: cur, loc: st.loc }), 300); }
function toDisp(L) { const c = {}; for (const [k] of CKEYS) c[k] = hex2rgb(L.c[k]); return { c, p: Object.assign({ art: 0 }, L.p) }; }
let disp = toDisp(cur), dispFrom = null, dispT = 1;
function applyLook(L, keepId) {
  dispFrom = { c: Object.fromEntries(Object.entries(disp.c).map(([k, v]) => [k, v.slice()])), p: Object.assign({}, disp.p) };
  cur = cloneLook(L); if (keepId === false) { cur.id = 'working'; }
  if (L.style) { Object.assign(style, L.style); }
  dispT = settings.reduce ? 1 : 0;
  if (dispT === 1) disp = toDisp(cur);
  persist(); invalidate(); syncStyleUI(); thumbsDirty = true;
  if (layers.art === false && (L.p && L.p.art || 0) > 0.2) toggleArt(true);   // a look built on illustrations switches them back on
}
function stepLook(dt) {
  if (dispT >= 1) return false;
  dispT = Math.min(1, dispT + dt / 0.7); const e = ease(dispT); const to = toDisp(cur);
  for (const [k] of CKEYS) disp.c[k] = mix3(dispFrom.c[k], to.c[k], e);
  for (const k of PKEYS) disp.p[k] = lerp(dispFrom.p[k], to.p[k], e);
  return true;
}
function markModified() { if (cur.id !== 'working') { cur.id = 'working'; cur.name = cur.name.replace(/ \(zmieniony\)$/, '') + ' (zmieniony)'; } disp = toDisp(cur); dispT = 1; persist(); invalidate(); thumbsDirty = true; syncLookUI(); }

