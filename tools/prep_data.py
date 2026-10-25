"""
Firmament – przygotowanie danych katalogowych.

Czyta surowe pliki GeoJSON z tools/raw/ (projekt d3-celestial, O. Frohn, licencja BSD-3)
i zapisuje skompresowany plik src/data/skydata.js:
  * gwiazdy do 8 mag – ok. 41 tys. z katalogu Hipparcos (pozycja J2000 z dokładnością 0,001°,
    jasność, B−V, HIP), zapisane binarnie (base64, 13 bajtów na gwiazdę),
    ich nazwy zweryfikowane z bazą nazw Stellarium (błędne nazwy z d3-celestial są usuwane),
    przynależność do gwiazdozbioru wyznaczona dokładnie wg granic IAU (w układzie B1875,
    w którym krawędzie granic biegną wzdłuż stałej rektascensji lub deklinacji),
    oraz gwiazdozbiór oznaczenia Bayera/Flamsteeda (np. β Tauri leży w granicach Byka),
  * linie, granice i etykiety 88 gwiazdozbiorów (polskie nazwy),
  * siatka przynależności do gwiazdozbiorów (0,25°) do podświetlania pod kursorem,
  * obiekty Messiera,
  * tekstura Drogi Mlecznej w układzie galaktycznym (WebP, 2048×1024).

Wymaga: Python 3.9+, numpy, scipy, Pillow  (pip install numpy scipy pillow)
Uruchomienie (z folderu projektu):  python tools/prep_data.py      (trwa kilka minut)
"""
import json, math, base64, io, os, struct
import numpy as np
from PIL import Image, ImageDraw, ImageChops
from scipy.ndimage import gaussian_filter, distance_transform_edt

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'src', 'data', 'skydata.js')
load = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
ra360 = lambda x: x % 360.0

def precession(jd):
    """Macierz precesji IAU 1976: J2000 -> średni równik i punkt równonocy epoki jd."""
    T = (jd - 2451545.0) / 36525; a = lambda s: math.radians(s / 3600)
    zeta = a(2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3); z = a(2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3)
    th = a(2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3)
    Rz = lambda x: np.array([[math.cos(x), math.sin(x), 0], [-math.sin(x), math.cos(x), 0], [0, 0, 1]])
    Ry = lambda x: np.array([[math.cos(x), 0, -math.sin(x)], [0, 1, 0], [math.sin(x), 0, math.cos(x)]])
    return Rz(-z) @ Ry(th) @ Rz(-zeta)
P1875 = precession(2405889.25855)   # B1875.0 – epoka definicji granic gwiazdozbiorów (Delporte 1930)

def vec(ra, dec):
    r, d = math.radians(ra), math.radians(dec)
    return np.array([math.cos(d) * math.cos(r), math.cos(d) * math.sin(r), math.sin(d)])

# ---------------------------------------------------------------- constellations
PL = {
 'And':'Andromeda','Ant':'Pompa','Aps':'Ptak Rajski','Aqr':'Wodnik','Aql':'Orzeł','Ara':'Ołtarz','Ari':'Baran',
 'Aur':'Woźnica','Boo':'Wolarz','Cae':'Rylec','Cam':'Żyrafa','Cnc':'Rak','CVn':'Psy Gończe','CMa':'Wielki Pies',
 'CMi':'Mały Pies','Cap':'Koziorożec','Car':'Kil','Cas':'Kasjopeja','Cen':'Centaur','Cep':'Cefeusz','Cet':'Wieloryb',
 'Cha':'Kameleon','Cir':'Cyrkiel','Col':'Gołąb','Com':'Warkocz Bereniki','CrA':'Korona Południowa',
 'CrB':'Korona Północna','Crv':'Kruk','Crt':'Puchar','Cru':'Krzyż Południa','Cyg':'Łabędź','Del':'Delfin',
 'Dor':'Złota Ryba','Dra':'Smok','Equ':'Źrebię','Eri':'Erydan','For':'Piec','Gem':'Bliźnięta','Gru':'Żuraw',
 'Her':'Herkules','Hor':'Zegar','Hya':'Hydra','Hyi':'Wąż Wodny','Ind':'Indianin','Lac':'Jaszczurka','Leo':'Lew',
 'LMi':'Mały Lew','Lep':'Zając','Lib':'Waga','Lup':'Wilk','Lyn':'Ryś','Lyr':'Lutnia','Men':'Góra Stołowa',
 'Mic':'Mikroskop','Mon':'Jednorożec','Mus':'Mucha','Nor':'Węgielnica','Oct':'Oktant','Oph':'Wężownik',
 'Ori':'Orion','Pav':'Paw','Peg':'Pegaz','Per':'Perseusz','Phe':'Feniks','Pic':'Malarz','Psc':'Ryby',
 'PsA':'Ryba Południowa','Pup':'Rufa','Pyx':'Kompas','Ret':'Sieć','Sge':'Strzała','Sgr':'Strzelec',
 'Sco':'Skorpion','Scl':'Rzeźbiarz','Sct':'Tarcza','Ser':'Wąż','Sex':'Sekstant','Tau':'Byk','Tel':'Luneta',
 'Tri':'Trójkąt','TrA':'Trójkąt Południowy','Tuc':'Tukan','UMa':'Wielka Niedźwiedzica',
 'UMi':'Mała Niedźwiedzica','Vel':'Żagiel','Vir':'Panna','Vol':'Ryba Latająca','Vul':'Lisek'}

con_ids, con_out = [], []
for f in load('constellations.json')['features']:
    cid, p = f['id'], f['properties']
    lon, lat = f['geometry']['coordinates']
    if cid in con_ids:  # Serpens has two parts
        con_out[con_ids.index(cid)]['pos2'] = [round(ra360(lon), 2), round(lat, 2)]
        continue
    con_ids.append(cid)
    con_out.append({'id': cid, 'pl': PL[cid], 'la': p['name'], 'gen': p['gen'], 'rank': int(p['rank']),
                    'pos': [round(ra360(lon), 2), round(lat, 2)]})

# ---------------------------------------------------------------- stars
STAR_PL = {'Shedar':'Szedar','Sirius':'Syriusz','Canopus':'Kanopus','Arcturus':'Arktur','Vega':'Wega','Capella':'Kapella',
 'Procyon':'Procjon','Betelgeuse':'Betelgeza','Acrux':'Akruks','Spica':'Spika','Pollux':'Polluks',
 'Mimosa':'Mimoza','Castor':'Kastor','Shaula':'Szaula','Bellatrix':'Bellatriks','Polaris':'Gwiazda Polarna',
 'Adhara':'Adara','Schedar':'Szedar'}
stars = load('stars.8.json')['features']
names = load('starnames.json')
# reference star names (Stellarium "modern" sky culture, CC BY-SA 4.0)
REFN = {k: v for k, v in load('stellarium_modern_index.json')['common_names'].items()}
IAUREF = {12, 36, 45}
def checked_name(hip, name):
    ref = REFN.get(f'HIP {hip}', [])
    if not name: return ''
    variants = {x.get('english', '') for x in ref} | {x.get('native', '') for x in ref}
    base = {v.rsplit(' ', 1)[0] if v.endswith((' I', ' II', ' III', ' IV')) else v for v in variants}
    if name in variants or name in base: return name
    iau = [x['english'] for x in ref if IAUREF & set(x.get('references', []))]
    return iau[0] if iau else ''   # nazwa niepotwierdzona -> zostaje samo oznaczenie Bayera
stars.sort(key=lambda f: f['properties']['mag'])
S, NM, DROPPED = [], {}, []
STRIDE = 7
for i, f in enumerate(stars):
    hip = str(f['id'])
    lon, lat = f['geometry']['coordinates']
    p = f['properties']
    try: bv = float(p['bv'])
    except (TypeError, ValueError): bv = 0.6
    n = names.get(hip, {})
    dcon = con_ids.index(n['c']) if n.get('c') in con_ids else -1
    S += [int(round(ra360(lon) * 1000)), int(round(lat * 1000)), int(round(p['mag'] * 100)), int(round(bv * 100)), -1, int(hip), dcon]
    raw_name = n.get('name', '')
    name = checked_name(hip, raw_name)
    if raw_name and name != raw_name: DROPPED.append(f'{raw_name} -> {name or "(brak)"} [HIP {hip}]')
    proper = STAR_PL.get(name, name)
    if proper or n.get('bayer') or n.get('flam'):
        NM[i] = [proper, n.get('bayer', ''), n.get('flam', ''), dcon]
NSTAR = len(stars)
V = np.array([vec(S[k * STRIDE] / 1000, S[k * STRIDE + 1] / 1000) for k in range(NSTAR)])

# constellation figures as star indices
L = {}
for f in load('constellations.lines.json')['features']:
    out = []
    for poly in f['geometry']['coordinates']:
        seq = []
        for lon, lat in poly:
            d = V @ vec(ra360(lon), lat); j = int(np.argmax(d))
            seq.append(j if math.degrees(math.acos(min(1, d[j]))) < 0.08 else [round(ra360(lon), 2), round(lat, 2)])
        out.append(seq)
    L.setdefault(f['id'], []).extend(out)

# boundaries (lines for drawing, polygons for highlight)
B = []
for f in load('constellations.borders.json')['features']:
    for line in f['geometry']['coordinates']:
        flat = []
        for lon, lat in line: flat += [round(ra360(lon), 2), round(lat, 2)]
        B.append(flat)
BD = [[] for _ in con_ids]
bounds = load('constellations.bounds.json')['features']
for f in bounds:
    flat = []
    for lon, lat in f['geometry']['coordinates'][0]: flat += [round(lon % 360, 2), round(lat, 2)]
    BD[con_ids.index(f['id'])].append(flat)

# ---------------------------------------------------------------- Messier
MPL = {'M1':'Mgławica Kraba','M6':'Gromada Motyl','M7':'Gromada Ptolemeusza','M8':'Mgławica Laguna',
 'M11':'Dzika Kaczka','M13':'Wielka Gromada w Herkulesie','M16':'Mgławica Orzeł','M17':'Mgławica Omega',
 'M20':'Mgławica Trójlistna','M22':'Gromada w Strzelcu','M24':'Obłok Gwiazd w Strzelcu','M27':'Mgławica Hantle',
 'M31':'Galaktyka Andromedy','M33':'Galaktyka Trójkąta','M42':'Wielka Mgławica w Orionie','M43':'Mgławica de Mairana',
 'M44':'Żłóbek','M45':'Plejady','M51':'Galaktyka Wir','M57':'Mgławica Pierścień','M63':'Galaktyka Słonecznik',
 'M64':'Galaktyka Czarne Oko','M76':'Mała Hantla','M78':'Mgławica w Orionie','M81':'Galaktyka Bodego',
 'M82':'Galaktyka Cygaro','M83':'Południowy Wiatraczek','M87':'Virgo A','M97':'Mgławica Sowa',
 'M101':'Galaktyka Wiatraczek','M104':'Galaktyka Sombrero','M4':'Gromada w Skorpionie','M5':'Gromada w Wężu',
 'M35':'Gromada w Bliźniętach','M41':'Gromada pod Syriuszem','M39':'Gromada w Łabędziu','M3':'Gromada w Psach Gończych'}
M = []
for f in load('messier.json')['features']:
    p = f['properties']; lon, lat = f['geometry']['coordinates']
    dim = str(p.get('dim', '') or '')
    try:
        a, b = (float(x) for x in dim.split('x')) if 'x' in dim else (float(dim), float(dim))
    except Exception:
        a = b = 5.0
    M.append([f['id'], round(ra360(lon), 3), round(lat, 3), p['type'], p['mag'], a, b, MPL.get(f['id'], ''), p.get('desig', '')])

# ---------------------------------------------------------------- constellation lookup grid
print('Siatka gwiazdozbiorów…')
GW, GH = 1440, 720
GRA, GDE = np.meshgrid(np.radians((np.arange(GW) + 0.5) * 360 / GW), np.radians((np.arange(GH) + 0.5) * 180 / GH - 90))
GV = np.stack([np.cos(GDE) * np.cos(GRA), np.cos(GDE) * np.sin(GRA), np.sin(GDE)], -1)
grid = np.full((GH, GW), 255, np.uint8)
def pip(px, py, poly):
    inside = np.zeros(px.shape, bool); xs, ys = poly[:, 0], poly[:, 1]; n = len(poly)
    for i in range(n):
        x1, y1, x2, y2 = xs[i], ys[i], xs[(i + 1) % n], ys[(i + 1) % n]
        cond = (y1 > py) != (y2 > py)
        with np.errstate(divide='ignore', invalid='ignore'):
            xint = (x2 - x1) * (py - y1) / (y2 - y1) + x1
        inside ^= cond & (px < xint)
    return inside
GV75 = GV @ P1875.T                       # grid cell centres in the B1875 frame
V75 = V @ P1875.T                         # stars in the B1875 frame
star_con = [-1] * NSTAR
POLYS = []
for f in bounds:
    ci = con_ids.index(f['id']); pts = []
    ring = []
    for lon, lat in f['geometry']['coordinates'][0]:   # vertex J2000 -> B1875 (round values there)
        w = P1875 @ vec(ra360(lon), lat); ring.append((math.degrees(math.atan2(w[1], w[0])) % 360, math.degrees(math.asin(w[2]))))
    for k in range(len(ring)):                          # edges are exact constant-RA / constant-Dec lines in B1875
        (r1, d1), (r2, d2) = ring[k], ring[(k + 1) % len(ring)]
        dra = ((r2 - r1 + 180) % 360) - 180; steps = max(1, int(max(abs(dra), abs(d2 - d1)) / 0.1))
        pts += [(r1 + dra * s / steps, d1 + (d2 - d1) * s / steps) for s in range(steps)]
    vs = np.array([vec(ra360(r), d) for r, d in pts]); c = vs.mean(0); c /= np.linalg.norm(c)
    up = np.array([0, 0, 1.0]) if abs(c[2]) < 0.99 else np.array([1.0, 0, 0])
    e = np.cross(up, c); e /= np.linalg.norm(e); n_ = np.cross(c, e)
    poly = np.stack([(vs @ e) / (vs @ c), (vs @ n_) / (vs @ c)], 1)
    dots = GV75 @ c; sel = dots > 0.2
    ins = pip((GV75[sel] @ e) / dots[sel], (GV75[sel] @ n_) / dots[sel], poly)
    sub = grid[sel]; sub[ins] = ci; grid[sel] = sub
    sd = V75 @ c; ss = np.where(sd > 0.2)[0]
    if len(ss):
        ins = pip((V75[ss] @ e) / sd[ss], (V75[ss] @ n_) / sd[ss], poly)
        for k in ss[ins]: star_con[k] = ci
if (grid == 255).any():
    idx = distance_transform_edt(grid == 255, return_distances=False, return_indices=True); grid = grid[idx[0], idx[1]]
flat = grid.ravel(); rle = []; cur = int(flat[0]); cnt = 0
for v in flat:
    v = int(v)
    if v == cur: cnt += 1
    else: rle += [cur, cnt]; cur = v; cnt = 1
rle += [cur, cnt]

cellarea = (360 / GW) * (180 / GH) * np.cos(GDE)
for k in range(NSTAR):
    if star_con[k] < 0: star_con[k] = int(grid[min(GH - 1, int((S[k * STRIDE + 1] / 1000 + 90) / 180 * GH)), min(GW - 1, int(S[k * STRIDE] / 1000 / 360 * GW))])
    S[k * STRIDE + 4] = star_con[k]
for ci, co in enumerate(con_out):
    m = grid == ci
    cc = (GV[m] * cellarea[m][:, None]).sum(0); cc /= np.linalg.norm(cc)
    ang = np.degrees(np.arccos(np.clip(GV[m] @ cc, -1, 1)))
    co['c'] = [round(float(np.degrees(np.arctan2(cc[1], cc[0])) % 360), 2), round(float(np.degrees(np.arcsin(cc[2]))), 2)]
    co['r'] = round(float(np.percentile(ang, 97)), 1)
    co['area'] = int(round(float(cellarea[m].sum())))
    members = [k for k in range(NSTAR) if star_con[k] == ci]
    co['n'] = sum(1 for k in members if S[k * STRIDE + 2] <= 600)   # gwiazdy do 6 mag (widoczne gołym okiem)
    co['br'] = members[0] if members else -1

# ---------------------------------------------------------------- Milky Way texture
print('Tekstura Drogi Mlecznej…')
G = np.array([[-0.0548755604, -0.8734370902, -0.4838350155],
              [ 0.4941094279, -0.4448296300,  0.7469822445],
              [-0.8676661490, -0.1980763734,  0.4559837762]])
SZ, EXT = 9000, 7.0
def to_plane(ra, dec):
    # stereographic projection from the north galactic pole: the band becomes an annulus, no seams
    v = G @ vec(ra, dec); l = math.atan2(v[1], v[0]); b = math.asin(max(-1, min(1, v[2])))
    r = 2 * math.tan((math.pi / 2 - b) / 2)
    return ((r * math.cos(l) + EXT) / (2 * EXT) * SZ, (r * math.sin(l) + EXT) / (2 * EXT) * SZ)
masks = []
for f in load('mw.json')['features']:
    acc = Image.new('1', (SZ, SZ), 0)
    for poly in f['geometry']['coordinates']:
        for ring in poly:
            m = Image.new('1', (SZ, SZ), 0)
            ImageDraw.Draw(m).polygon([to_plane(ra360(lon), lat) for lon, lat in ring], fill=1)
            acc = ImageChops.logical_xor(acc, m)
    masks.append(np.array(acc, dtype=np.float32))
TW, TH = 2048, 1024
LL, BB = np.meshgrid((np.arange(TW) + 0.5) / TW * 2 * np.pi, (np.arange(TH) + 0.5) / TH * np.pi - np.pi / 2)
R_ = 2 * np.tan((np.pi / 2 - BB) / 2)
X = (R_ * np.cos(LL) + EXT) / (2 * EXT) * SZ; Y = (R_ * np.sin(LL) + EXT) / (2 * EXT) * SZ
inside = (X >= 0) & (X < SZ) & (Y >= 0) & (Y < SZ)
Xi = np.clip(X.astype(int), 0, SZ - 1); Yi = np.clip(Y.astype(int), 0, SZ - 1)
tex = np.zeros((TH, TW), np.float32)
for w, m in zip([0.16, 0.2, 0.22, 0.2, 0.22], masks): tex += w * m[Yi, Xi] * inside
def wrapblur(a, s):
    pad = int(s * 4) + 4
    return gaussian_filter(np.concatenate([a[:, -pad:], a, a[:, :pad]], 1), sigma=s)[:, pad:-pad]
tex = wrapblur(tex, 2.2)
def blob(l0, b0, sl, sb, amp, ang=0):
    global tex
    dl = ((LL - math.radians(l0) + np.pi) % (2 * np.pi) - np.pi) * np.cos(BB); db = BB - math.radians(b0)
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    u = ca * dl + sa * db; v = -sa * dl + ca * db
    tex += amp * np.exp(-(u / math.radians(sl)) ** 2 - (v / math.radians(sb)) ** 2)
blob(280.47, -32.89, 4.2, 3.4, 0.55, 20); blob(280.47, -32.89, 1.6, 0.7, 0.35, 20)   # LMC
blob(302.8, -44.3, 2.2, 1.3, 0.42, 40)                                                # SMC
blob(121.17, -21.57, 1.1, 0.35, 0.33, 35); blob(133.61, -31.33, 0.35, 0.25, 0.12)     # M31, M33
tex = np.clip(tex, 0, 1) ** 0.85
tex = np.round(tex * 255) / 255
dl = (LL + np.pi) % (2 * np.pi) - np.pi
disk = np.exp(-(BB / np.radians(13.0)) ** 2) * (0.07 + 0.14 * np.exp(-(dl / np.radians(60)) ** 2))
bulge = 0.30 * np.exp(-(dl / np.radians(11)) ** 2 - ((BB + np.radians(1.5)) / np.radians(7.5)) ** 2)
out = np.clip(0.42 * wrapblur(tex, 1.6) + 0.42 * wrapblur(tex, 10.0) + 0.5 * wrapblur(tex, 34.0) + disk + bulge, 0, 1) ** 0.9
buf = io.BytesIO(); Image.fromarray((out * 255).astype(np.uint8), 'L').save(buf, 'WEBP', quality=90, method=6)

print('Nazwy gwiazd usunięte lub poprawione po weryfikacji:', len(DROPPED))
for d_ in DROPPED: print('   ', d_)
# gwiazdy binarnie: ra u24 (0,001°), dec+90° u24 (0,001°), (mag+2)·100 u16, B−V·50+128 u8, gwiazdozbiór u8, HIP u24
buf_s = bytearray()
for k in range(NSTAR):
    ra_, de_, mg, bv_, cn, hp, _ = S[k * STRIDE:(k + 1) * STRIDE]
    buf_s += (ra_ % 360000).to_bytes(3, 'little') + (de_ + 90000).to_bytes(3, 'little')
    buf_s += struct.pack('<HBB', mg + 200, max(0, min(255, round(bv_ / 2) + 128)), cn) + hp.to_bytes(3, 'little')
print(f'Gwiazdy: {NSTAR} (do {max(S[2::STRIDE]) / 100} mag), nazwane: {sum(1 for v in NM.values() if v[0])}')
data = {'cons': con_out, 'SB': base64.b64encode(bytes(buf_s)).decode(), 'NS': NSTAR, 'N': NM, 'L': L, 'B': B, 'BD': BD, 'M': M, 'CG': rle}
js = ('// Wygenerowane przez tools/prep_data.py – nie edytuj ręcznie.\n'
      'const SKYDATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'const MWTEX="data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode() + '";\n')
open(OUT, 'w', encoding='utf-8').write(js)
print(f'Zapisano {OUT} ({len(js.encode()) // 1024} KB)')
