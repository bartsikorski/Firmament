'use strict';
/* FIRMAMENT · interfejs
   Ikony, suwaki, przełączniki, panel z zakładkami (Eksploruj, Styl, Cele, Warstwy, Ustawienia),
   miniatury wyglądów, pasek trybu foto, wyszukiwarka, blok pola widzenia, statystyki i kompas. */

// ---------------------------------------------------------------- constellation icons in the interface
/* the icon sheet (data/artdata.js) is used directly as a CSS sprite: no waiting for the image to decode */
document.documentElement.style.setProperty('--icons', `url("${ICONDATA.img}")`);
function iconHTML(ci, px) {
  const n = CONS[ci] ? CONS[ci].icon : -1; if (n < 0) return '';
  return `<span class="ico" aria-hidden="true" style="--s:${px}px;--x:${n % ICONDATA.cols};--y:${Math.floor(n / ICONDATA.cols)};--c:${ICONDATA.cols}"></span>`;
}

// ---------------------------------------------------------------- toolbar icons
const ICONS = {
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 10v10h4.5v-6h4v6h4.5V10"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', fwd: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  cross: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>', mark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  asterisk: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>',
  horizon: '<path d="M2 18h20M5.5 18a6.5 6.5 0 0 1 13 0"/><path d="M12 4.5v2.5M4.9 8.4l1.6 1.6M19.1 8.4l-1.6 1.6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  camera: '<path d="M4 8h3.2l1.8-2.8h6l1.8 2.8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  panel: '<rect x="3" y="4.5" width="18" height="15" rx="1"/><path d="M14.5 4.5v15"/>', compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.7 1.5-1.5 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.9a4.5 4.5 0 0 0 4.5-4.5c0-4-3.8-7.2-8.5-7.2z"/><circle cx="7.6" cy="11.5" r=".6"/><circle cx="10" cy="7.6" r=".6"/><circle cx="14.6" cy="7.6" r=".6"/>',
  layers: '<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  figure: '<circle cx="10" cy="7.2" r="2.6"/><path d="M5.2 20.5c.3-4.4 2.1-7.1 4.8-7.1s4.5 2.7 4.8 7.1"/><path d="M18.5 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
function paintIcons(root = document) { $$('i[data-ic]', root).forEach(el => { const s = document.createElement('span'); s.innerHTML = icon(el.dataset.ic); el.replaceWith(s.firstChild); }); }
paintIcons();
const setIcon = (btn, n) => { const svg = btn.querySelector('svg'); if (svg) svg.innerHTML = ICONS[n]; };

// ---------------------------------------------------------------- controls
const syncers = [];
const syncAll = () => syncers.forEach(s => s());
/* Suwak: etykieta i edytowalna wartość nad cienką linią z kropką.
   o: { id, label, min, max, get, set, fmt?, dec?, step?, log?, help? } */
function mkSlider(host, o) {
  const w = document.createElement('div'); w.className = 'sl';
  w.innerHTML = `<div class="sl-top"><label for="rg-${o.id}"></label><input class="sl-val" id="nm-${o.id}" type="text" inputmode="decimal" spellcheck="false"></div><input type="range" id="rg-${o.id}" min="0" max="1000" step="1">`;
  const l = w.querySelector('label'), n = w.querySelector('.sl-val'), r = w.querySelector('input[type=range]');
  l.textContent = o.label; n.setAttribute('aria-label', o.label); if (o.help) w.title = o.help;
  const toPos = v => o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) * 1000 : (v - o.min) / (o.max - o.min) * 1000;
  const fromPos = p => o.log ? o.min * Math.pow(o.max / o.min, p / 1000) : o.min + (o.max - o.min) * p / 1000;
  const fmt = o.fmt || (v => pl(v, o.dec != null ? o.dec : 2));
  const sync = () => { const v = o.get(); r.value = toPos(v); r.style.setProperty('--p', (clamp(+r.value, 0, 1000) / 10) + '%'); if (document.activeElement !== n) n.value = fmt(v); };
  r.addEventListener('input', () => { let v = fromPos(+r.value); if (o.step) v = Math.round(v / o.step) * o.step; o.set(v); sync(); });
  n.addEventListener('change', () => { const v = parseFloat(n.value.replace(',', '.').replace('−', '-')); if (isFinite(v)) o.set(clamp(v, o.min, o.max)); n.blur(); sync(); });
  n.addEventListener('keydown', e => { if (e.key === 'Enter') n.blur(); });
  host.appendChild(w); syncers.push(sync); sync(); return sync;
}
function mkSwitch(host, o) {
  const lab = document.createElement('label'); lab.className = 'sw';
  lab.innerHTML = `<input type="checkbox" id="sw-${o.id}"><i></i><span class="sw-t"></span>`;
  const inp = lab.querySelector('input'), t = lab.querySelector('.sw-t');
  t.textContent = o.label; if (o.note) { const s = document.createElement('small'); s.textContent = o.note; t.append(s); }
  inp.addEventListener('change', () => o.set(inp.checked));
  host.appendChild(lab); const sync = () => { inp.checked = !!o.get(); }; syncers.push(sync); sync();
}
function mkSeg(host, items, get, set) {
  host.innerHTML = '';
  const btns = items.map(([v, label, title]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (title) b.title = title; b.addEventListener('click', () => { set(v); sync(); }); host.appendChild(b); return [v, b]; });
  const sync = () => btns.forEach(([v, b]) => b.classList.toggle('on', v === get()));
  syncers.push(sync); sync(); return sync;
}
$$('.sec.fold .sec-h').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

// ---------------------------------------------------------------- tabs
let tabNow = 'nav';
$$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(t) { tabNow = t; $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); $$('.tab-body').forEach(d => d.hidden = d.id !== 'tab-' + t); if (t === 'style') thumbsDirty = true; }

// ---------------------------------------------------------------- explore tab
const normRoll = () => ((st.roll + 540) % 360) - 180;
mkSeg($('#seg-mode'), [['eq', 'Mapa nieba'], ['hor', 'Z miejsca']], () => st.mode, v => setMode(v));
mkSeg($('#seg-proj'), [[0, 'Stereo', 'Stereograficzne – wierne kształty'], [1, 'Równoodl.', 'Azymutalne równoodległe – całe niebo naraz'], [2, 'Orto', 'Ortograficzne – jak globus']], () => st.proj, v => { st.proj = v; st.fov = clampFov(st.fov); invalidate(); scheduleHist(); });
mkSeg($('#seg-rot'), [[-15, '−15°'], [0, '0°'], [15, '+15°']], () => (Math.abs(normRoll()) < 0.5 ? 0 : null), v => rollBy(v === 0 ? -st.roll : v));
$('#copy-pos').addEventListener('click', () => {
  const [ra, de] = sph(centerEq()); const txt = `RA ${fmtRA(ra)}, Dec ${fmtDec(de)}, pole ${pl(st.fov, 2)}°`;
  try { navigator.clipboard.writeText(txt).then(() => toast('Skopiowano współrzędne'), () => toast(txt)); } catch (e) { toast(txt); }
});
const locSel = $('#loc'); LOCS.forEach((L, i) => { const o = document.createElement('option'); o.value = i; o.textContent = L.n; locSel.appendChild(o); });
locSel.addEventListener('change', () => { const L = LOCS[+locSel.value]; if (L.lat == null) st.loc.n = 'Własne współrzędne'; else st.loc = { n: L.n, lat: L.lat, lon: L.lon, tz: L.tz }; locChanged(); });
for (const id of ['lat', 'lon']) $('#' + id).addEventListener('change', e => { const v = parseFloat(e.target.value); if (!isFinite(v)) return; st.loc[id] = clamp(v, id === 'lat' ? -89.9 : -180, id === 'lat' ? 89.9 : 180); st.loc.n = 'Własne współrzędne'; st.loc.tz = null; locChanged(); });
function locChanged() { Fcache.key = ''; bodies = calcBodies(); bodiesT = st.time; persist(); invalidate(); syncNavUI(); syncTimeUI(true); if (sel || selCon >= 0) updateCard(true); }
const toLocalInput = ms => { const p = locParts(ms); return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}`; };
$('#dt').addEventListener('change', e => { const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(e.target.value); if (m) setTime(fromLocal(+m[1], +m[2], +m[3], +m[4], +m[5])); });
$('#t-now').addEventListener('click', () => setTime(Date.now()));
$('#t-play').addEventListener('click', togglePlay);
$('#speed').addEventListener('change', e => { st.speed = +e.target.value; });
let hourBase = Date.now();
mkSlider($('#r-hour'), { id: 'hour', label: 'Przesunięcie czasu', min: -12, max: 12, get: () => clamp((st.time - hourBase) / 3600000, -12, 12), set: v => { st.time = hourBase + v * 3600000; timeChanged(); }, fmt: v => (v >= 0 ? '+' : '−') + pl(Math.abs(v), 1) + ' h', help: 'Przesuń czas o kilka godzin – obserwuj wschody i zachody.' });
function setTime(t) { st.time = t; hourBase = t; timeChanged(); }
function timeChanged() { refreshStarEpoch(); if (meridian.on && meridian.local) syncMerUI(); bodies = calcBodies(); bodiesT = st.time; Fcache.key = ''; invalidate(); syncTimeUI(true); if (sel || selCon >= 0) updateCard(true); }
let lastTimeSync = 0;
function syncTimeUI(force) {
  const now = performance.now(); if (!force && now - lastTimeSync < 250) return; lastTimeSync = now;
  if (document.activeElement !== $('#dt')) $('#dt').value = toLocalInput(st.time);
  $('#t-big').textContent = fmtLocTime(st.time);
  $('#t-date').textContent = `${fmtLocDate(st.time, true)} · ${fmtUtcOff(st.time)}`;
  $('#t-date').title = `Czas lokalny w miejscu obserwacji: ${st.loc.n}`;
  for (const b of [$('#b-play'), $('#t-play')]) { b.classList.toggle('on', st.playing); setIcon(b, st.playing ? 'pause' : 'play'); }
  syncAll();
}
function syncNavUI() {
  const li = LOCS.findIndex(L => L.n === st.loc.n); locSel.value = li >= 0 ? li : LOCS.length - 1;
  $('#lat').value = st.loc.lat; $('#lon').value = st.loc.lon;
  const bm = $('#b-mode'); bm.classList.toggle('on', st.mode === 'hor'); setIcon(bm, st.mode === 'hor' ? 'globe' : 'horizon');
  bm.title = st.mode === 'hor' ? 'Wróć do mapy nieba (M)' : 'Niebo nad miejscem obserwacji (M)';
  syncAll();
}
$('#a-night').addEventListener('click', skyTonight);
$('#a-random').addEventListener('click', randomTarget);
$('#a-tour').addEventListener('click', startTour);
$('#a-photo').addEventListener('click', () => setPhoto(true));

// ---------------------------------------------------------------- style tab
function allLooks() { return [...LOOKS, ...customLooks]; }
const looksHost = $('#looks'); let lookEls = [];
function buildLooks() {
  looksHost.innerHTML = ''; lookEls = [];
  for (const L of allLooks()) {
    const b = document.createElement('button'); b.className = 'look'; b.type = 'button';
    const cv = document.createElement('canvas'); cv.width = 264; cv.height = 148;
    const ln = document.createElement('span'); ln.className = 'ln'; const t = document.createElement('span'); t.textContent = L.name; ln.append(t);
    if (L.custom) { const d = document.createElement('span'); d.className = 'del'; d.textContent = '×'; d.title = 'Usuń ten styl'; d.setAttribute('role', 'button'); d.addEventListener('click', ev => { ev.stopPropagation(); customLooks = customLooks.filter(x => x.id !== L.id); persist(); buildLooks(); buildPalSel(); }); ln.append(d); }
    b.append(cv, ln); b.addEventListener('click', () => applyLook(L));
    looksHost.appendChild(b); lookEls.push({ L, b, cv, t });
  }
  syncLookUI(); thumbsDirty = true;
}
function syncLookUI() { for (const e of lookEls) { const on = e.L.id === cur.id; e.b.classList.toggle('active', on); e.t.textContent = (on ? '✓ ' : '') + e.L.name; } $('#pal').value = allLooks().some(L => L.id === cur.id) ? cur.id : 'working'; paintGrad(); syncColors(); }
function buildPalSel() { const s = $('#pal'); s.innerHTML = ''; for (const L of allLooks()) { const o = document.createElement('option'); o.value = L.id; o.textContent = L.name; s.appendChild(o); } const o = document.createElement('option'); o.value = 'working'; o.textContent = 'Własna (edytowana)'; s.appendChild(o); syncLookUI(); }
$('#pal').addEventListener('change', e => { const L = allLooks().find(x => x.id === e.target.value); if (L) applyLook(L); });
function paintGrad() { const c = cur.c; $('#grad').style.background = `linear-gradient(90deg, ${c.bg1}, ${c.bg0} 16%, ${c.mwLo} 34%, ${c.mwHi} 52%, ${c.hot} 66%, ${c.mid} 78%, ${c.cool} 90%, ${c.accent})`; }
$('#pal-edit').addEventListener('click', () => { const box = $('#colors'); box.hidden = !box.hidden; $('#pal-edit').textContent = box.hidden ? 'Edytuj' : 'Zwiń'; });
const colorEls = {};
for (const [k, label] of CKEYS) {
  const l = document.createElement('label'); l.className = 'cpick'; const i = document.createElement('input'); i.type = 'color'; i.id = 'c-' + k; const s = document.createElement('span'); s.textContent = label;
  l.append(i, s); $('#colors').appendChild(l); colorEls[k] = i;
  i.addEventListener('input', () => { cur.c[k] = i.value; markModified(); paintGrad(); });
}
function syncColors() { for (const [k] of CKEYS) colorEls[k].value = cur.c[k]; }
$('#surprise').addEventListener('click', () => {
  const r = Math.random, h = r() * 360, h2 = h + (r() < 0.5 ? 1 : -1) * (25 + r() * 50), h3 = h + 150 + r() * 60;
  const L = { id: 'working', name: 'Niespodzianka', c: { bg0: hsl(h, 0.42, 0.10), bg1: hsl(h, 0.5, 0.035), mwLo: hsl(h2, 0.38, 0.24), mwHi: hsl(h2 + 20, 0.32, 0.80), neb: hsl(h3, 0.42, 0.22), hot: hsl(215 + r() * 20, 0.6, 0.82), mid: hsl(h, 0.2, 0.93), cool: hsl(25 + r() * 15, 0.6, 0.78), line: hsl(h2, 0.36, 0.60), grid: hsl(h, 0.3, 0.30), label: hsl(h, 0.25, 0.85), accent: hsl(h3 - 30, 0.4, 0.82), ground: hsl(h, 0.3, 0.025), glow: hsl(h2, 0.4, 0.2) }, p: { mw: 0.5 + r() * 0.25, neb: 0.15 + r() * 0.4, dust: 0.45 + r() * 0.4, glow: 0.6 + r() * 0.4, spikes: r() * 0.55, sat: 0.6 + r() * 0.4 } };
  applyLook(L); cur.id = 'working'; syncLookUI();
});
function styleChanged() { persist(); invalidate(); }
const lookP = (k, label, help, mx = 1) => ({ id: 'p-' + k, label, min: 0, max: mx, get: () => cur.p[k], set: v => { cur.p[k] = v; markModified(); if (k === 'art' && v > 0.02 && layers.art === false) toggleArt(true); }, help });
const sty = (k, label, min, max, help, dec, extra = {}) => Object.assign({ id: 's-' + k, label, min, max, get: () => style[k], set: v => { style[k] = v; styleChanged(); }, help, dec }, extra);
mkSeg($('#seg-spec'), [[1, 'Barwa widmowa', 'Kolor gwiazdy według jej temperatury (B−V)'], [0, 'Jednolita']], () => style.spectral, v => { style.spectral = v; styleChanged(); });
mkSlider($('#r-stars'), sty('bright', 'Jasność', 0.3, 3, 'Ogólna jasność gwiazd.'));
mkSlider($('#r-stars'), sty('size', 'Rozmiar', 0.4, 2.5, 'Wielkość tarcz gwiazd.'));
mkSlider($('#r-stars'), lookP('glow', 'Poświata', 'Miękka aureola wokół jasnych gwiazd.', 2));
mkSlider($('#r-stars'), lookP('spikes', 'Promienie', 'Promienie dyfrakcyjne najjaśniejszych gwiazd.', 1.5));
mkSlider($('#r-stars'), lookP('sat', 'Nasycenie barw', 'Nasycenie kolorów gwiazd.', 1.5));
mkSlider($('#r-stars'), sty('twinkle', 'Migotanie', 0, 1, 'Delikatne migotanie wywołane atmosferą.'));
mkSlider($('#r-sky'), lookP('mw', 'Droga Mleczna', 'Jasność pasa Drogi Mlecznej.', 1.6));
mkSlider($('#r-sky'), lookP('dust', 'Pył', 'Ciemne pasma pyłu w Drodze Mlecznej.', 1));
mkSlider($('#r-sky'), lookP('neb', 'Mgławice', 'Barwne, rozproszone obłoki na tle nieba.', 1.5));
mkSlider($('#r-sky'), lookP('art', 'Ilustracje gwiazdozbiorów', 'Półprzezroczyste rysunki figur, od których pochodzą nazwy gwiazdozbiorów. Wskazany kursorem gwiazdozbiór podświetla się niezależnie.', 1));
mkSlider($('#r-sky'), sty('artInk', 'Wyrazistość rysunków', 0, 1, 'Jak mocno figura przyciemnia niebo pod sobą. Wyżej – ciemne linie rysunku (atrybuty, rysy twarzy) są wyraźniejsze; niżej – rysunek jest lżejszy i bardziej przejrzysty.'));
mkSeg($('#seg-font'), [['atlas', 'Atlas'], ['sans', 'Wąski'], ['mono', 'Techniczny']], () => style.font, v => { style.font = v; styleChanged(); });
mkSlider($('#r-lines'), sty('lineA', 'Krycie figur', 0, 1, null));
mkSlider($('#r-lines'), sty('gridA', 'Krycie siatki', 0, 1, null));
mkSlider($('#r-lines'), sty('labelSize', 'Wielkość opisów', 0.7, 1.6, null));
mkSeg($('#seg-size'), [['flat', 'Płasko'], ['natural', 'Naturalnie'], ['dramatic', 'Dramatycznie']], () => style.sizeMode, v => { style.sizeMode = v; styleChanged(); });
mkSeg($('#seg-line'), [['solid', 'Linie ciągłe'], ['soft', 'Z przerwą'], ['dashed', 'Przerywane']], () => style.lineStyle, v => { style.lineStyle = v; styleChanged(); });
mkSlider($('#r-adv'), sty('magLim', 'Zasięg (mag)', 3, 7.5, 'Najsłabsza pokazywana jasność przy szerokim polu. Po przybliżeniu rośnie sama.', 1));
mkSlider($('#r-adv'), sty('lineW', 'Grubość linii', 0.4, 2.5, null));
mkSlider($('#r-adv'), sty('labelDensity', 'Gęstość opisów', 0, 1, null));
mkSlider($('#r-adv'), sty('vignette', 'Winieta', 0, 1, 'Przyciemnienie brzegów kadru.'));
mkSlider($('#r-adv'), sty('grain', 'Ziarno', 0, 1, 'Drobne ziarno, które usuwa pasmowanie gradientów.'));
mkSlider($('#r-adv'), sty('airglow', 'Łuna horyzontu', 0, 1.5, 'Blask nieba nisko nad horyzontem w widoku z miejsca.'));
function syncStyleUI() { syncAll(); syncLookUI(); }
$('#save-look').addEventListener('click', () => {
  const nm = $('#save-name').value.trim() || `Mój styl ${customLooks.length + 1}`;
  const L = { id: 'c' + Date.now().toString(36), name: nm, c: Object.assign({}, cur.c), p: Object.assign({}, cur.p), custom: true, style: Object.assign({}, style) };
  customLooks.push(L); cur = cloneLook(L); persist(); buildLooks(); buildPalSel(); $('#save-name').value = ''; toast(`Zapisano styl „${nm}”`);
});
$('#exp').addEventListener('click', () => {
  const json = JSON.stringify({ name: cur.name, colors: cur.c, sky: cur.p, style });
  try { navigator.clipboard.writeText(json).then(() => toast('Styl skopiowany do schowka'), () => showImp(json)); } catch (e) { showImp(json); }
});
function showImp(t) { $('#imp-box').hidden = false; $('#imp-text').value = t || ''; $('#imp-text').focus(); $('#imp-text').select(); }
$('#imp-toggle').addEventListener('click', () => { const b = $('#imp-box'); b.hidden = !b.hidden; if (!b.hidden) $('#imp-text').focus(); });
$('#imp').addEventListener('click', () => {
  try {
    const o = JSON.parse($('#imp-text').value); const base = cloneLook(LOOKS[0]);
    for (const [k] of CKEYS) if (o.colors && /^#[0-9a-f]{6}$/i.test(o.colors[k])) base.c[k] = o.colors[k];
    for (const k of PKEYS) if (o.sky && isFinite(o.sky[k])) base.p[k] = clamp(+o.sky[k], 0, 2);
    if (o.style) for (const k of Object.keys(STYLE0)) if (o.style[k] != null && typeof o.style[k] === typeof STYLE0[k]) style[k] = o.style[k];
    base.id = 'working'; base.name = String(o.name || 'Wklejony styl').slice(0, 28); applyLook(base); styleChanged(); syncStyleUI(); toast('Zastosowano wklejony styl');
  } catch (e) { toast('To nie jest styl Firmamentu – wklej tekst z „Kopiuj JSON”'); }
});
// live previews of the current view in every look
let thumbCanvas = null;
function renderThumbs() {
  if (!sky || !lookEls.length) return;
  try { if (!thumbGL) { thumbCanvas = document.createElement('canvas'); thumbCanvas.width = 264; thumbCanvas.height = 148; thumbGL = new SkyGL(thumbCanvas); thumbGL.setStars(realStars, NS); if (mwImg) thumbGL.setMW(mwImg); loadArt(thumbGL); } } catch (e) { return; }
  const tw = 132, th = 74;
  const v = computeView({ lon: st.lon, lat: st.lat, roll: st.roll, fov: st.fov, proj: st.proj, F: frameF(), refr: refrOn() }, tw, th);
  for (const e of lookEls) {
    const lk = toDisp(e.L.id === cur.id ? cur : e.L);
    const ab = lk.p.art || 0, cEq = centerEq(), art = ab > 0 ? ART.map((A, i) => [i, ab, 0]).filter(([i]) => angDist(cEq, ART[i].cv) - ART[i].r < Math.min(v.fov * 0.62, 118)) : null;
    const R = buildR(v, lk, { pr: 2, starPr: clamp(2 * tw / W * 2.6, 0.7, 0.95), loScale: 1, time: 0, art });
    R.twinkle = 0; R.faint = false; R.magLim = Math.min(R.magLim, 5.8); R.refine = false;
    thumbGL.render(R);
    const c = e.cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(thumbCanvas, 0, 0);
    c.setTransform(2, 0, 0, 2, 0, 0); drawOverlay(c, v, lk, { thumb: true });
  }
  ovDirty = true;
}

// ---------------------------------------------------------------- layers tab
const LY = [
  ['ly-obj', 'stars', 'Gwiazdy', 'Katalog Hipparcos do 8 mag, ok. 41 tys.'], ['ly-obj', 'faint', 'Słabe gwiazdy tła', 'Dekoracyjne, słabsze niż 8 mag, po przybliżeniu'], ['ly-obj', 'mw', 'Droga Mleczna i mgławice'], ['ly-obj', 'planets', 'Planety'], ['ly-obj', 'sunmoon', 'Słońce i Księżyc'], ['ly-obj', 'dso', 'Obiekty Messiera'], ['ly-obj', 'starNames', 'Nazwy gwiazd'],
  ['ly-con', 'art', 'Ilustracje gwiazdozbiorów', 'Wszystkie rysunki naraz · klawisz I'], ['ly-con', 'conLines', 'Figury'], ['ly-con', 'conNames', 'Nazwy'], ['ly-con', 'conIcons', 'Ikony przy nazwach', 'Małe rysunki figur obok nazw'], ['ly-con', 'artNotes', 'Podpisy atrybutów', 'Na wskazanej ilustracji: maczuga, głowa Meduzy, kłos…'], ['ly-con', 'bounds', 'Granice IAU'], ['ly-con', 'conHover', 'Podświetlanie pod kursorem'],
  ['ly-ref', 'grid', 'Siatka współrzędnych', 'Równikowa na mapie, horyzontalna z miejsca'], ['ly-ref', 'ecliptic', 'Ekliptyka'], ['ly-ref', 'galactic', 'Równik galaktyczny'],
  ['ly-hor', 'ground', 'Grunt i horyzont'], ['ly-hor', 'cardinals', 'Kierunki świata'], ['ly-hor', 'atmosphere', 'Atmosfera', 'Zmierzch, dzień, ekstynkcja przy horyzoncie']
];
for (const [host, k, label, note] of LY) mkSwitch($('#' + host), { id: k, label, note, get: () => layers[k], set: v => { if (k === 'art') { toggleArt(v); return; } layers[k] = v; persist(); invalidate(); if (k === 'conHover' && !v) hover.con = -1; } });
mkSwitch($('#ly-con'), { id: 'artHover', label: 'Ilustracja po najechaniu', note: 'Rysunek figury pojawia się nad wskazanym gwiazdozbiorem', get: () => settings.artHover, set: v => { settings.artHover = v; persist(); } });

// ---------------------------------------------------------------- settings tab
mkSeg($('#seg-q'), Object.entries(QUAL).map(([k, q]) => [k, q.name]), () => settings.quality, v => { settings.quality = v; $('#q-note').textContent = Q().note; persist(); resize(); });
$('#q-note').textContent = Q().note;
mkSlider($('#r-anim'), { id: 'fly', label: 'Czas przelotu', min: 0.3, max: 3, get: () => settings.flyDur, set: v => { settings.flyDur = v; persist(); }, fmt: v => pl(v, 1) + '×', help: 'Długość animowanych przelotów do celów.' });
mkSlider($('#r-anim'), { id: 'inertia', label: 'Bezwładność', min: 0, max: 1, get: () => settings.inertia, set: v => { settings.inertia = v; persist(); }, help: 'Jak długo niebo sunie po puszczeniu.' });
mkSwitch($('#st-misc'), { id: 'cross', label: 'Celownik w środku', get: () => settings.crosshair, set: v => { settings.crosshair = v; $('#b-cross').classList.toggle('on', v); persist(); ovDirty = true; } });
mkSwitch($('#st-misc'), { id: 'latin', label: 'Nazwy łacińskie', note: 'Zamiast polskich', get: () => settings.latin, set: v => { settings.latin = v; persist(); invalidate(); if (sel || selCon >= 0) updateCard(false); } });
mkSwitch($('#st-misc'), { id: 'reduce', label: 'Ogranicz animacje', note: 'Natychmiastowe przejścia, bez migotania', get: () => settings.reduce, set: v => { settings.reduce = v; persist(); invalidate(); } });
$('#reset-all').addEventListener('click', () => { Object.assign(style, STYLE0); Object.assign(layers, LAY0); Object.assign(settings, SET0); applyLook(LOOKS[0]); resize(); syncStyleUI(); $('#q-note').textContent = Q().note; toast('Przywrócono ustawienia domyślne'); });

// ---------------------------------------------------------------- targets tab
function buildTargets() {
  const host = $('#targets'); host.innerHTML = '';
  let g = '';
  for (const T of TARGETS) {
    if (T.g !== g) { g = T.g; const h = document.createElement('div'); h.className = 'tg-h'; h.textContent = g; host.appendChild(h); }
    const ci = CONS.findIndex(C => C.id === (T.con || [])[0]);
    const b = document.createElement('button'); b.className = 'tgt ic'; b.innerHTML = iconHTML(ci, 30) + '<span><span class="n"></span><span class="s"></span></span><span class="go">→</span>';
    b.querySelector('.n').textContent = T.n; b.querySelector('.s').textContent = T.s; b.addEventListener('click', () => presentTarget(T, TOUR.indexOf(T))); host.appendChild(b);
  }
  buildMarks();
}
function buildMarks() {
  const host = $('#mine'); host.innerHTML = '';
  if (!marks.length) { host.innerHTML = '<p class="empty">Brak zapisanych widoków. Zapisz bieżący przyciskiem zakładki u góry.</p>'; return; }
  marks.forEach((M, i) => {
    const b = document.createElement('button'); b.className = 'tgt'; b.innerHTML = '<span><span class="n"></span><span class="s"></span></span><span class="del" role="button" title="Usuń">×</span>';
    b.querySelector('.n').textContent = M.n; b.querySelector('.s').textContent = M.s;
    b.addEventListener('click', ev => { if (ev.target.classList.contains('del')) { marks.splice(i, 1); persist(); buildMarks(); return; } stopTour(); if (M.mode !== st.mode) setMode(M.mode, true); st.proj = M.proj; syncNavUI(); flyTo(eqOfFrame(vec(M.lon, M.lat)), M.fov, { roll: M.roll }); });
    host.appendChild(b);
  });
}
function saveMark() {
  const v = centerEq(); const C = CONS[conAt(v)]; const s = snap(); const [ra, de] = sph(v);
  marks.unshift({ ...s, n: `${C.pl}${sel ? ' · ' + objName(sel) : ''}`, s: `${s.mode === 'hor' ? 'z miejsca · ' : ''}${fmtRA(ra).slice(0, 7)} ${fmtDeg(de)} · pole ${pl(s.fov, 0)}°` });
  marks = marks.slice(0, 30); persist(); buildMarks(); toast('Zapisano widok w Celach');
}
$('#b-mark').addEventListener('click', saveMark); $('#mark2').addEventListener('click', saveMark);
$('#tour-btn').addEventListener('click', startTour); $('#b-tour').addEventListener('click', startTour);

// ---------------------------------------------------------------- toolbar
$('#b-home').addEventListener('click', goHome);
$('#b-back').addEventListener('click', () => goHist(-1)); $('#b-fwd').addEventListener('click', () => goHist(1));
$('#compass').addEventListener('click', () => rollBy(-st.roll));
$('#b-cross').addEventListener('click', () => { settings.crosshair = !settings.crosshair; $('#b-cross').classList.toggle('on', settings.crosshair); persist(); ovDirty = true; syncAll(); });
$('#b-cross').classList.toggle('on', settings.crosshair);
$('#b-mode').addEventListener('click', () => setMode(st.mode === 'eq' ? 'hor' : 'eq'));
$('#b-art').addEventListener('click', () => toggleArt());
syncers.push(() => { const b = $('#b-art'); b.classList.toggle('on', !!layers.art); b.setAttribute('aria-pressed', String(!!layers.art)); b.title = layers.art ? 'Wyłącz ilustracje gwiazdozbiorów (I)' : 'Włącz ilustracje gwiazdozbiorów (I)'; });
$('#b-play').addEventListener('click', togglePlay);
$('#b-full').addEventListener('click', toggleFull);
$('#b-photo').addEventListener('click', () => setPhoto(true));
$('#b-shot').addEventListener('click', () => capture({ res: 'x2' }));
function setPanel(on) { $('#panel').hidden = !on; $('#b-panel').classList.toggle('on', on); if (on && tabNow === 'style') thumbsDirty = true; }
$('#b-panel').addEventListener('click', () => setPanel($('#panel').hidden));
if (matchMedia('(max-width: 760px)').matches) setPanel(false);

// ---------------------------------------------------------------- photo bar
mkSeg($('#pb-aspect'), ASPECTS, () => photo.aspect, v => { photo.aspect = v; layoutCrop(); });
mkSeg($('#pb-res'), RESES, () => photo.res, v => { photo.res = v; });
$$('#pb-aspect button, #pb-res button').forEach(b => b.classList.add('chip'));
{
  const host = $('#pb-layers');
  { const b = document.createElement('button'); b.className = 'chip'; b.textContent = 'Ilustracje'; b.addEventListener('click', () => toggleArt()); host.appendChild(b); syncers.push(() => b.classList.toggle('on', !!layers.art)); }
  for (const [k, label] of [['labels', 'Opisy'], ['lines', 'Figury'], ['grid', 'Siatka']]) {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = label;
    b.addEventListener('click', () => { photo.layers[k] = !photo.layers[k]; applyPhotoLayers(); syncPhotoUI(); });
    host.appendChild(b); syncers.push(() => b.classList.toggle('on', !!photo.layers[k]));
  }
}
{
  const r = $('#pb-exp'); const lo = Math.log(0.4), hi = Math.log(2.5);
  const sync = () => { r.value = (Math.log(photo.exp) - lo) / (hi - lo) * 1000; r.style.setProperty('--p', r.value / 10 + '%'); };
  r.addEventListener('input', () => { photo.exp = Math.exp(lo + (hi - lo) * r.value / 1000); sync(); invalidate(); });
  r.addEventListener('dblclick', () => { photo.exp = 1; sync(); invalidate(); });
  syncers.push(sync); sync();
}
function syncPhotoUI() { syncAll(); }
$('#pb-shoot').addEventListener('click', () => capture());
$('#pb-exit').addEventListener('click', () => setPhoto(false));
$('#photobar').addEventListener('pointerenter', () => { photo.overBar = true; });
$('#photobar').addEventListener('pointerleave', () => { photo.overBar = false; photo.lastMove = performance.now(); });
window.addEventListener('resize', layoutCrop);

// ---------------------------------------------------------------- search
const IDX = [];
for (let i = 0; i < NS; i++) if (STAR.name[i]) { const f = FAMOUS[STAR.hip[i]]; IDX.push({ t: STAR.name[i], s: `${pl(STAR.mag[i], 1)} mag`, k: 'Gwiazda', o: { type: 'star', i }, w: STAR.mag[i] - (f ? 3 : 0), extra: designation(i) + (f ? ' ' + f[1] : '') }); }
for (let i = 0, n = starsTo(4.5); i < n; i++) if (!STAR.name[i] && STAR.bayer[i]) IDX.push({ t: designation(i), s: `${pl(STAR.mag[i], 1)} mag`, k: 'Gwiazda', o: { type: 'star', i }, w: STAR.mag[i] + 2, extra: `${STAR.bayer[i]} ${CONS[STAR.dcon[i]].id}` });
for (const C of CONS) IDX.push({ t: C.pl, s: C.la, k: 'Gwiazdozb.', o: { type: 'con', ci: C.i }, w: -3, extra: `${C.la} ${C.id} ${C.gen}`, ci: C.i });
for (const [hip, ce] of Object.entries(CEPHEIDS)) { const i = starByHip.get(+hip); if (i != null) IDX.push({ t: STAR.name[i] ? `${STAR.name[i]} · ${ce.d}` : ce.d, s: `cefeida · ${pl(ce.p, 2)} d`, k: 'Cefeida', o: { type: 'star', i }, w: +hip === 110991 ? -1 : 0, extra: 'cefeida cefeidy cepheid zmienna' }); }
for (const D of DSO) IDX.push({ t: D.name ? `${D.id} · ${D.name}` : D.id, s: D.ngc || '', k: 'Messier', o: { type: 'dso', id: D.id }, w: D.mag - 2, extra: D.ngc });
for (const id of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) IDX.push({ t: bodyById(id).name, s: id === 'sun' || id === 'moon' ? '' : 'planeta', k: 'Układ Sł.', o: { type: 'body', id }, w: -5, extra: id });
IDX.forEach(e => { e.n = normTxt(e.t + ' ' + (e.extra || '')); e.n0 = normTxt(e.t); });
let qSel = 0, qList = [];
const qIn = $('#q'), qRes = $('#q-res');
qIn.addEventListener('input', () => {
  const q = normTxt(qIn.value); if (!q) { qRes.hidden = true; return; }
  qList = IDX.map(e => { let sc = -1; if (e.n0.startsWith(q)) sc = 3; else if (e.n0.split(' ').some(w => w.startsWith(q))) sc = 2; else if (e.n.includes(q)) sc = 1; return [sc, e]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0] || a[1].w - b[1].w).slice(0, 10).map(x => x[1]);
  qSel = 0; renderQ();
});
function renderQ() {
  if (!qList.length) { qRes.innerHTML = '<p class="empty" style="padding:8px 10px;margin:0">Nic nie znaleziono. Wpisz nazwę polską, łacińską albo numer M.</p>'; qRes.hidden = false; return; }
  qRes.innerHTML = ''; qList.forEach((e, i) => { const b = document.createElement('button'); b.className = 'qr' + (i === qSel ? ' sel' : ''); b.innerHTML = '<span class="k"></span><span class="t">' + (e.ci != null ? iconHTML(e.ci, 20) : '') + '<span class="tt"></span></span><small></small>'; b.querySelector('.k').textContent = e.k; b.querySelector('.tt').textContent = e.t; b.querySelector('small').textContent = e.s; b.addEventListener('mousedown', ev => { ev.preventDefault(); goQ(e); }); qRes.appendChild(b); });
  qRes.hidden = false;
}
function goQ(e) { qRes.hidden = true; qIn.value = ''; qIn.blur(); stopTour(); select(e.o, 'fly'); }
qIn.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { qSel = Math.min(qList.length - 1, qSel + 1); renderQ(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { qSel = Math.max(0, qSel - 1); renderQ(); e.preventDefault(); }
  else if (e.key === 'Enter') { if (qList[qSel]) goQ(qList[qSel]); e.preventDefault(); }
  else if (e.key === 'Escape') { qRes.hidden = true; qIn.blur(); }
});
qIn.addEventListener('blur', () => setTimeout(() => { qRes.hidden = true; }, 120));

// ---------------------------------------------------------------- field-of-view block, readouts, status, stats
const FOVMIN = 0.1, FOVMAX = 360, LFOV = Math.log(FOVMAX / FOVMIN);
const zbRange = $('#zb-range');
zbRange.addEventListener('input', () => { const f = FOVMAX * Math.exp(-LFOV * zbRange.value / 1000); stopTour(); zoomBy(clampFov(f) / (zoomA ? zoomA.target : st.fov)); });
function fmtFov(f) { const d = f < 10 ? 2 : 1; const s = f.toFixed(d).split('.'); return `${s[0]}<small>,${s[1]}</small><sup>°</sup>`; }
let gpuLabel = '';
function updateHud() {
  const vC = centerEq(); const cC = CONS[conAt(vC)];
  // bottom-left: big field of view + ruler + coordinates under the cursor (or centre)
  $('#zb-num').innerHTML = fmtFov(st.fov);
  if (document.activeElement !== zbRange) { zbRange.value = clamp(Math.log(FOVMAX / st.fov) / LFOV * 1000, 0, 1000); }
  let v = vC; if (mouse.in && curView && !photo.on) { const u = unproject(curView, mouse.x, mouse.y); if (u) v = u; }
  const [ra, de] = sph(v); const parts = [`<span><em>RA</em>${fmtRA(ra)}</span>`, `<span><em>DEC</em>${fmtDec(de)}</span>`];
  if (st.mode === 'hor') { const h = horOf(v); parts.push(`<span><em>AZ</em>${fmtDeg(h.az)}</span>`, `<span><em>WYS</em>${fmtDeg(h.alt)}</span>`); }
  parts.push(`<span>${esc(CONS[conAt(v)].pl.toUpperCase())}</span>`);
  if (st.playing || st.mode === 'hor') parts.push(`<span><em>CZAS</em>${fmtLocDate(st.time).slice(0, 5)} ${fmtLocTime(st.time)}${st.playing ? ' ▸' : ''}</span>`);
  $('#readout').innerHTML = parts.join('');
  // top-left: context + refinement status
  $('#ctx').textContent = (settings.latin ? cC.la : cC.pl);
  const n = Q().aa, k = Math.min(refineK, n), stEl = $('#status');
  if (sky && k < n) { stEl.classList.remove('idle'); const p = Math.round(k / n * 100); $('#status-t').textContent = `Dopracowanie ${p}%`; stEl.querySelector('i').style.width = p + '%'; }
  else { stEl.classList.add('idle'); $('#status-t').textContent = st.mode === 'hor' ? `${st.loc.n} · ${fmtLocTime(st.time)}` : 'Mapa nieba · J2000'; stEl.querySelector('i').style.width = '100%'; }
  // bottom-right: render statistics
  if (!gpuLabel && sky) gpuLabel = sky.label;
  const fps = Math.round(1000 / Math.max(1, frameEMA));
  const count = layers.stars ? (layers.faint && sky ? sky.nAll : NS) : 0;
  $('#stats').innerHTML = `<div class="hi">AA ${k} / ${n} · ${k < n ? 'dopracowanie' : 'gotowe'}</div><div>Klatka ${Math.round(frameEMA)} ms · ${fps} kl/s</div><div>Gwiazdy ${count.toLocaleString('pl-PL')} · zasięg ${pl(Math.min(magLimit(st.fov), layers.faint ? 10.5 : 8), 1)} mag</div><div>${esc(gpuLabel || 'WebGL niedostępny')}</div>`;
  // explore tab: position
  if (tabNow === 'nav' && !$('#panel').hidden) {
    const [r0, d0] = sph(vC);
    let html = `<dt>RA</dt><dd>${fmtRA(r0)}</dd><dt>Dec</dt><dd>${fmtDec(d0)}</dd>`;
    if (st.mode === 'hor') { const h = horOf(vC); html += `<dt>Az</dt><dd>${fmtDeg(h.az)}</dd><dt>Wys</dt><dd>${fmtDeg(h.alt)}</dd>`; }
    html += `<dt>Pole</dt><dd>${pl(st.fov, st.fov < 10 ? 2 : 1)}° <small>· ${esc(cC.pl)}</small></dd><dt>Obrót</dt><dd>${pl(normRoll(), 1)}°</dd>`;
    $('#pos').innerHTML = html;
  }
}
const cmp = $('#compass canvas').getContext('2d');
function drawCompass() {
  if (!curView) return; const s = 88; cmp.setTransform(1, 0, 0, 1, 0, 0); cmp.clearRect(0, 0, s, s);
  const v0 = centerEq(); let ang = 0;
  if (pj(curView, v0)) { const x0 = P[0], y0 = P[1]; const up = st.mode === 'hor' ? eqOfFrame(vec(st.lon, Math.min(89.9, st.lat + 0.5))) : vec(sph(v0)[0], Math.min(89.9, sph(v0)[1] + 0.5)); if (pj(curView, up)) ang = Math.atan2(P[0] - x0, -(P[1] - y0)); }
  cmp.translate(s / 2, s / 2);
  cmp.strokeStyle = 'rgba(255,255,255,0.28)'; cmp.lineWidth = 1.2; cmp.beginPath(); cmp.arc(0, 0, 40, 0, TAU); cmp.stroke();
  cmp.rotate(ang);
  cmp.fillStyle = 'rgba(168,208,255,0.95)'; cmp.beginPath(); cmp.moveTo(0, -30); cmp.lineTo(4.5, -6); cmp.lineTo(-4.5, -6); cmp.closePath(); cmp.fill();
  cmp.strokeStyle = 'rgba(255,255,255,0.4)'; cmp.beginPath(); cmp.moveTo(0, 6); cmp.lineTo(0, 24); cmp.stroke();
  cmp.rotate(-ang); cmp.font = '600 15px "JetBrains Mono", monospace'; cmp.textAlign = 'center'; cmp.textBaseline = 'middle'; cmp.fillStyle = '#fff';
  cmp.fillText(st.mode === 'hor' ? 'Z' : 'N', 0, 1);
  $('#compass').title = st.mode === 'hor' ? 'Strzałka wskazuje zenit – kliknij, aby wyrównać horyzont' : 'Strzałka wskazuje północny biegun nieba – kliknij, aby wyzerować obrót';
}
