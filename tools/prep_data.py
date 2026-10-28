"""
Firmament – przygotowanie danych katalogowych.

Czyta pliki z tools/raw/ i zapisuje skompresowany plik src/data/skydata.js:
  * gwiazdy do 8 mag – ok. 41 tys. z bazy HYG 4.1 (Hipparcos; pozycja J2000 z dokładnością 0,0001°,
    ruch własny, odległość z paralaksy, jasność, B−V, typ widmowy, numer HIP), zapisane binarnie
    (base64, 19 bajtów na gwiazdę); oznaczenia Bayera/Flamsteeda z katalogu Yale (przez HYG);
    nazwy – oficjalne nazwy IAU WGSN, dla najbardziej znanych gwiazd w polskiej formie;
    przynależność do gwiazdozbioru wyznaczona dokładnie wg granic IAU (w układzie B1875,
    w którym krawędzie granic biegną wzdłuż stałej rektascensji lub deklinacji),
    oraz gwiazdozbiór oznaczenia Bayera/Flamsteeda (zwykle ten sam; wyjątki to np. 10 UMa leżąca w Rysiu),
  * linie, granice i etykiety 88 gwiazdozbiorów (d3-celestial, O. Frohn, BSD-3; polskie nazwy),
  * siatka przynależności do gwiazdozbiorów (0,25°) do podświetlania pod kursorem,
  * obiekty Messiera (d3-celestial; środki, rozmiary i kąty położenia z OpenNGC),
  * tekstura Drogi Mlecznej w układzie galaktycznym (WebP, 2048×1024).

Pliki hyg_v41_mag8.csv, iau_star_names.csv i openngc_messier.csv tworzy tools/fetch_sources.py.
Wymaga: Python 3.9+, numpy, scipy, Pillow  (pip install -r tools/requirements.txt)
Uruchomienie (z folderu projektu):  python tools/prep_data.py      (trwa kilka minut)
"""
import json, math, base64, io, os, struct, re, csv
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
# Gwiazdy: baza HYG 4.1 (pozycje J2000, ruch własny, odległość z paralaksy Hipparcosa, typ widmowy,
# oznaczenia Bayera/Flamsteeda z katalogu Yale). Nazwy: oficjalne nazwy IAU WGSN (po numerze HIP),
# a dla wybranych gwiazd – polskie formy. Składniki układów bez własnej nazwy IAU dostają nazwę „… B”.
STAR_PL = {'Sirius':'Syriusz','Canopus':'Kanopus','Arcturus':'Arktur','Vega':'Wega','Capella':'Kapella',
 'Procyon':'Procjon','Betelgeuse':'Betelgeza','Acrux':'Akruks','Spica':'Spika','Pollux':'Polluks',
 'Mimosa':'Mimoza','Castor':'Kastor','Castor B':'Kastor B','Shaula':'Szaula','Bellatrix':'Bellatriks',
 'Polaris':'Gwiazda Polarna','Adhara':'Adara','Schedar':'Szedar','Alcor':'Alkor','Garnet Star':'Granatowa Gwiazda'}
GREEK = {'Alp':'α','Bet':'β','Gam':'γ','Del':'δ','Eps':'ε','Zet':'ζ','Eta':'η','The':'θ','Iot':'ι','Kap':'κ','Lam':'λ',
 'Mu':'μ','Nu':'ν','Xi':'ξ','Omi':'ο','Pi':'π','Rho':'ρ','Sig':'σ','Tau':'τ','Ups':'υ','Phi':'φ','Chi':'χ','Psi':'ψ','Ome':'ω'}
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
def bayer(code):
    m = re.match(r'^([A-Z][a-z]+)-?(\d*)$', code or '')
    if not m: return code or ''
    return GREEK.get(m.group(1), m.group(1)) + m.group(2).translate(SUP)
fnum = lambda x: float(x) if x not in ('', None) else None
hyg = list(csv.DictReader(open(os.path.join(RAW, 'hyg_v41_mag8.csv'), encoding='utf-8')))
IAU, IAU_NOHIP = {}, set()   # names bound to a HIP number; names of stars that have none in Hipparcos
for r in csv.DictReader(open(os.path.join(RAW, 'iau_star_names.csv'), encoding='utf-8')):
    h = (r['HIP'] or '').strip()
    if h.isdigit(): IAU.setdefault(int(h), r['Proper Names'].strip())
    else: IAU_NOHIP.add(r['Proper Names'].strip())
# stars without a HIP number (e.g. Mizar B, Castor B) only when they do not coincide with a HIP star
vh = {}
for r in hyg:
    if r['hip']: vh.setdefault(r['bf'], []).append(r)
def far_from_hip(r):
    v = vec(float(r['ra']) * 15, float(r['dec']))
    return all(math.degrees(math.acos(min(1, v @ vec(float(o['ra']) * 15, float(o['dec']))))) * 3600 > 3 for o in vh.get(r['bf'], []))
hyg = [r for r in hyg if r['hip'] or (r['bf'].strip() and far_from_hip(r))]
# a non-HIP entry at the same place as a brighter star of the same system (e.g. Alula Australis B) adds nothing
def dup(r):
    if r['hip']: return False
    v = vec(float(r['ra']) * 15, float(r['dec']))
    return any(o is not r and float(o['mag']) <= float(r['mag']) and o['bf'] == r['bf'] and
               math.degrees(math.acos(min(1, v @ vec(float(o['ra']) * 15, float(o['dec']))))) * 3600 < 1.5 for o in hyg)
hyg = [r for r in hyg if not dup(r)]
hyg.sort(key=lambda r: float(r['mag']))
# IAU names whose HIP star is absent here (e.g. ξ UMa, listed in HYG only as Gliese components) may go to a non-HIP entry
present = {int(r['hip']) for r in hyg if r['hip']}
IAU_NOHIP |= {n for h, n in IAU.items() if h not in present}
named_bf = {}
for r in hyg:
    if r['hip'] and IAU.get(int(r['hip'])) and r['bf'].strip(): named_bf.setdefault(r['bf'], IAU[int(r['hip'])])
S, NM, PM, DIST, SPEC = [], {}, [], [], {}
STRIDE = 7
for i, r in enumerate(hyg):
    hip = int(r['hip']) if r['hip'] else 0
    ra, de, mag = float(r['ra']) * 15, float(r['dec']), float(r['mag'])
    bv = fnum(r['ci']); bv = 0.6 if bv is None else bv
    bf = r['bf'].strip(); dc = bf[-3:].strip() if bf else ''
    dcon = con_ids.index(dc) if dc in con_ids else -1
    S += [int(round(ra360(ra) * 10000)) % 3600000, int(round(de * 10000)), int(round(mag * 100)), int(round(bv * 100)), -1, hip, dcon]
    PM.append((fnum(r['pmra']) or 0.0, fnum(r['pmdec']) or 0.0))
    d = fnum(r['dist']); DIST.append(d if d and 0 < d < 100000 else 0.0)
    name = IAU.get(hip, '') if hip else ''
    if not name and r['proper'].endswith(' B'): name = r['proper']            # e.g. Albireo B, Cor Caroli B
    if not name and not hip and r['proper'] in IAU_NOHIP: name = r['proper']  # e.g. Alula Australis (no HIP entry)
    if not name and not hip and bf in named_bf: name = named_bf[bf] + ' B'     # e.g. Mizar B
    name = STAR_PL.get(name, name)
    by, fl = bayer(r['bayer']), r['flam']
    if name or by or fl: NM[i] = [name, by, fl, dcon]
    if mag <= 6.5 and r['spect'].strip(): SPEC[i] = r['spect'].strip()
# spectral types that the Hipparcos catalogue gives for the companion or a blend instead of the bright primary
# (B−V contradicts them by two classes or more); SIMBAD / literature values
SPEC_FIX = {9640: 'K3 IIb', 24608: 'K0 III + G1 III', 32246: 'G8 Ib', 54061: 'K0 IIIa', 72105: 'K0 II-III + A2 V', 100345: 'K0 II + A5n'}
for i, r in enumerate(hyg):
    if r['hip'] and int(r['hip']) in SPEC_FIX: SPEC[i] = SPEC_FIX[int(r['hip'])]
NSTAR = len(hyg)
V = np.array([vec(S[k * STRIDE] / 10000, S[k * STRIDE + 1] / 10000) for k in range(NSTAR)])
print('Gwiazdy:', NSTAR, '· nazwy IAU:', sum(1 for v in NM.values() if v[0]), '· bez numeru HIP:', sum(1 for k in range(NSTAR) if not S[k * STRIDE + 5]))

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
# Every IAU boundary edge runs along constant RA or constant Dec in the B1875 frame. The vertices are therefore
# moved to B1875, cleaned, densified there along the true edges and only then returned to J2000.
def to75(lon, lat):
    w = P1875 @ vec(ra360(lon), lat)
    return (math.degrees(math.atan2(w[1], w[0])) % 360, math.degrees(math.asin(max(-1, min(1, w[2])))))
def aligned(p, q):
    dra = ((q[0] - p[0] + 180) % 360) - 180
    return abs(dra) * math.cos(math.radians((p[1] + q[1]) / 2)) < 0.003 or abs(q[1] - p[1]) < 0.003
DROPPED = [0]
def clean75(coords, closed):
    """J2000 vertices -> B1875 [(ra, dec)], without vertices that lie off the constant-RA/Dec edges.
    (d3-celestial has three such points on the UMi/Cep border, which in B1875 is the parallel +88°
    from 23h through 0h to 8h; they were up to 0.45° too far south.)"""
    ring = [to75(lon, lat) for lon, lat in coords]
    while True:
        n = len(ring)
        k = next((k for k in range(n) if (closed or 0 < k < n - 1)
                  and not aligned(ring[k - 1], ring[k]) and not aligned(ring[k], ring[(k + 1) % n])), None)
        if k is None: return ring
        ring.pop(k); DROPPED[0] += 1
def dens75(ring, closed, step=1.0, rastep=6.0, nd=3):
    """densify in B1875 along the edges, back to J2000, flattened [ra, dec, ra, dec, …]"""
    n = len(ring); pts = []
    for k in range(n if closed else n - 1):
        (r1, d1), (r2, d2) = ring[k], ring[(k + 1) % n]
        dra = ((r2 - r1 + 180) % 360) - 180
        m = max(1, math.ceil(max(abs(dra) * math.cos(math.radians(min(abs(d1), abs(d2)))) / step, abs(dra) / rastep, abs(d2 - d1) / step)))
        pts += [(r1 + dra * s / m, d1 + (d2 - d1) * s / m) for s in range(m)]
    if not closed: pts.append(ring[-1])
    flat = []
    for r, d in pts:
        w = P1875.T @ vec(r % 360, d)
        flat += [round(math.degrees(math.atan2(w[1], w[0])) % 360, nd), round(math.degrees(math.asin(max(-1, min(1, w[2])))), nd)]
    return flat
B = []
for f in load('constellations.borders.json')['features']:
    for line in f['geometry']['coordinates']:
        B.append(dens75(clean75(line, False), False))
BD = [[] for _ in con_ids]
bounds = load('constellations.bounds.json')['features']
RING75 = []                               # per feature (Serpens has two: Caput and Cauda)
for f in bounds:
    r = clean75(f['geometry']['coordinates'][0], True)
    if abs(r[0][0] - r[-1][0]) < 1e-6 and abs(r[0][1] - r[-1][1]) < 1e-6: r = r[:-1]
    RING75.append(r)
    BD[con_ids.index(f['id'])].append(dens75(r, True, 2.0, 12.0, 2))   # highlight outline – coarser is enough
print('Granice: usunięto', DROPPED[0], 'niedokładnych wierzchołków')

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
def hms(t): h, m, x = t.split(':'); return (float(h) + float(m) / 60 + float(x) / 3600) * 15
def dms(t):
    sg = -1 if t.startswith('-') else 1; d, m, x = t.lstrip('+-').split(':'); return sg * (float(d) + float(m) / 60 + float(x) / 3600)
# OpenNGC lists M102 as a duplicate of M101; M102 keeps the d3-celestial position (NGC 5866)
ONGC = {int(r['M']): r for r in csv.DictReader(open(os.path.join(RAW, 'openngc_messier.csv'), encoding='utf-8')) if r['Name'] != 'M102'}
M = []
for f in load('messier.json')['features']:
    p = f['properties']; lon, lat = f['geometry']['coordinates']
    dim = str(p.get('dim', '') or '')
    try:
        a, b = (float(x) for x in dim.split('x')) if 'x' in dim else (float(dim), float(dim))
    except Exception:
        a = b = 5.0
    pa = None
    o = ONGC.get(int(f['id'][1:]))
    if o:   # OpenNGC: precise centre, size and position angle
        lon = hms(o['RA']); lat = dms(o['Dec'])
        if fnum(o['MajAx']): a = fnum(o['MajAx']); b = fnum(o['MinAx']) or a
        pa = fnum(o['PosAng'])
    M.append([f['id'], round(ra360(lon), 4), round(lat, 4), p['type'], p['mag'], a, b, MPL.get(f['id'], ''), p.get('desig', ''), pa])

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
for fi, f in enumerate(bounds):
    ci = con_ids.index(f['id']); pts = []
    ring = RING75[fi]                                   # cleaned vertices in B1875
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
    if star_con[k] < 0: star_con[k] = int(grid[min(GH - 1, int((S[k * STRIDE + 1] / 10000 + 90) / 180 * GH)), min(GW - 1, int(S[k * STRIDE] / 10000 / 360 * GW))])
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

# gwiazdy binarnie (19 bajtów): ra u24 (0,0001°), dec+90° u24, (mag+2)·100 u16, B−V·50+128 u8, gwiazdozbiór u8,
# HIP u24, ruch własny μα* i μδ i16 (mas/rok), odległość u16 = log10(pc)·10⁴ (0 = nieznana)
buf_s = bytearray()
for k in range(NSTAR):
    ra_, de_, mg, bv_, cn, hp, _ = S[k * STRIDE:(k + 1) * STRIDE]
    buf_s += (ra_ % 3600000).to_bytes(3, 'little') + (de_ + 900000).to_bytes(3, 'little')
    buf_s += struct.pack('<HBB', mg + 200, max(0, min(255, round(bv_ / 2) + 128)), cn) + hp.to_bytes(3, 'little')
    pa_, pd_ = PM[k]; d = DIST[k]
    buf_s += struct.pack('<hhH', max(-32767, min(32767, round(pa_))), max(-32767, min(32767, round(pd_))),
                         max(1, min(65535, round(math.log10(d) * 10000))) if d >= 1 else (1 if d > 0 else 0))
SPT = sorted(set(SPEC.values())); SPI = {t: n for n, t in enumerate(SPT)}
print(f'Gwiazdy: {NSTAR} (do {max(S[2::STRIDE]) / 100} mag), nazwane: {sum(1 for v in NM.values() if v[0])}')
data = {'cons': con_out, 'SB': base64.b64encode(bytes(buf_s)).decode(), 'NS': NSTAR, 'SBW': 19, 'N': NM, 'SPT': SPT, 'SP': {k: SPI[v] for k, v in SPEC.items()}, 'L': L, 'B': B, 'BD': BD, 'M': M, 'CG': rle}
js = ('// Wygenerowane przez tools/prep_data.py – nie edytuj ręcznie.\n'
      'const SKYDATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'const MWTEX="data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode() + '";\n')
open(OUT, 'w', encoding='utf-8').write(js)
print(f'Zapisano {OUT} ({len(js.encode()) // 1024} KB)')
