"""
Firmament – przygotowanie ilustracji i ikon gwiazdozbiorów.

Czyta rysunki z tools/raw/art/ (Stellarium, kultura nieba „modern”, ilustracje
zespołu Stellarium na licencji Free Art License 1.3) oraz ich punkty zaczepienia z tools/raw/stellarium_modern_index.json
i zapisuje src/data/artdata.js:

  * ARTDATA – dla każdej ilustracji: rysunek w odcieniach szarości (WebP, jasność wyrównana między
    rysunkami, lekko wyostrzony), maska pokrycia figury w 1/4 rozdzielczości (WebP; maska jest gładka,
    więc wystarcza mała) oraz trzy gwiazdy, na których rysunek jest rozpięty na sferze niebieskiej.
    Maska pozwala przyciemnić niebo pod figurą, dzięki czemu ciemne linie rysunku (atrybuty, fałdy,
    rysy twarzy) stają się wyraźnymi kreskami, a nie dziurami w poświacie.
  * ICONDATA – arkusz 88 ikon (po jednej na gwiazdozbiór), wyciętych z ilustracji. Kil, Rufa i Żagiel
    dzielą rysunek okrętu Argo, a Wąż – rysunek Wężownika; ich ikony to fragmenty rysunku leżące
    w granicach danego gwiazdozbioru (dla Węża: Głowa Węża, najbardziej czytelna część).

Wymaga: numpy, scipy, Pillow.   Uruchomienie: python tools/prep_art.py
"""
import json, os, io, base64, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'src', 'data', 'artdata.js')
load = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
idx = load('stellarium_modern_index.json')
stars = {f['id']: f['geometry']['coordinates'] for f in load('stars.8.json')['features']}
# fallback positions (J2000, Hipparcos) for three faint anchor stars
stars.update({17999: [57.7184, 23.9615], 91589: [280.1829, -47.0272], 102805: [312.4074, 12.5451]})
CON_IDS = [f['id'] for f in load('constellations.json')['features']]
CON_IDS = list(dict.fromkeys(CON_IDS))                      # Serpens appears twice
ALIAS = {'Pup': 'Car', 'Vel': 'Car', 'Ser': 'Oph'}          # figures shared by several constellations
CROP = {'Car', 'Pup', 'Vel', 'Ser'}                         # icons cut out along the IAU boundary

def vec(ra, dec):
    r, d = math.radians(ra), math.radians(dec)
    return np.array([math.cos(d) * math.cos(r), math.cos(d) * math.sin(r), math.sin(d)])

def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r

def coverage(L):
    """Maska figury: piksele rysunku, domknięte i z wypełnionymi drobnymi dziurami (ciemne linie
    wewnątrz figury), duże zamknięte przestrzenie (np. wnętrze cyrkla) zostają puste."""
    n = L.shape[0]; r = max(2, round(n * 0.012)); pad = r * 2
    m = np.pad(L > 0.035, pad)
    m = ndi.binary_closing(m, structure=disk(r))[pad:-pad, pad:-pad]
    holes = ndi.binary_fill_holes(m) & ~m
    lab, k = ndi.label(holes)
    if k:
        sizes = ndi.sum(holes, lab, range(1, k + 1))
        m |= np.isin(lab, 1 + np.where(sizes < 0.004 * m.size)[0])
    return np.clip(ndi.gaussian_filter(m.astype(np.float32), r * 0.45) * 1.15, 0, 1)

def enhance(L, cov):
    """Wyrównanie jasności między rysunkami i wyostrzenie detali (maska nieostra)."""
    inside = L[cov > 0.5]
    hi = np.percentile(inside, 98) if inside.size else 1.0
    L = np.clip(L / max(hi, 0.2) * 0.8, 0, 1)
    s = L.shape[0] / 512 * 1.3
    return np.clip(L + 0.35 * (L - ndi.gaussian_filter(L, s)), 0, 1)

def b64(img, fmt, **kw):
    buf = io.BytesIO(); img.save(buf, fmt, **kw); return base64.b64encode(buf.getvalue()).decode()

# ---------------------------------------------------------------- illustrations
art, imgs = [], {}
for c in idx['constellations']:
    im = c.get('image')
    if not im: continue
    cid = c['id'].split()[-1]
    w, h = im['size']
    img = Image.open(os.path.join(RAW, 'art', os.path.basename(im['file']))).convert('L')
    if img.size != (w, h): img = img.resize((w, h), Image.LANCZOS)
    L = np.asarray(img, np.float32) / 255
    cov = coverage(L); L = enhance(L, cov)
    l8 = Image.fromarray((L * 255 + 0.5).astype(np.uint8))
    m8 = Image.fromarray((cov * 255 + 0.5).astype(np.uint8)).resize((max(64, w // 4), max(64, h // 4)), Image.LANCZOS)
    anchors, S, Pm = [], [], []
    for a in im['anchors']:
        ra, de = stars[a['hip']][:2]
        u, v = a['pos'][0] / w, a['pos'][1] / h
        anchors.append([round(u, 5), round(v, 5), round(ra % 360, 4), round(de, 4)])
        S.append(vec(ra, de)); Pm.append([u, v, 1.0])
    B = np.array(S).T @ np.linalg.inv(np.array(Pm).T)          # (u, v, 1) -> sky vector
    imgs[cid] = (L, cov, B)
    art.append({'c': cid, 'a': anchors, 'img': 'data:image/webp;base64,' + b64(l8, 'WEBP', quality=78, method=6),
                'mask': 'data:image/webp;base64,' + b64(m8, 'WEBP', quality=60, method=6)})

# ---------------------------------------------------------------- icons
bounds = {}
for f in load('constellations.bounds.json')['features']:
    bounds.setdefault(f['id'], []).append(f['geometry']['coordinates'][0])
# Serpens: keep only Serpens Caput (the part west of Ophiuchus, RA < 260°) for its icon
bounds['Ser'] = [r for r in bounds['Ser'] if np.mean([p[0] % 360 for p in r]) < 260]

def boundary_mask(cid, B, size):
    """Granice gwiazdozbioru narysowane w układzie obrazu ilustracji."""
    Binv = np.linalg.inv(B); m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    for ring in bounds[cid]:
        pts = []
        for k in range(len(ring)):
            (r1, d1), (r2, d2) = ring[k], ring[(k + 1) % len(ring)]
            dr = ((r2 - r1 + 180) % 360) - 180; n = max(1, int(max(abs(dr), abs(d2 - d1)) / 0.5))
            for s in range(n):
                q = Binv @ vec(r1 + dr * s / n, d1 + (d2 - d1) * s / n)
                if q[2] > 0: pts.append((q[0] / q[2] * size[0], q[1] / q[2] * size[1]))
        if len(pts) > 2: d.polygon(pts, fill=255)
    return ndi.binary_dilation(np.asarray(m) > 0, iterations=max(1, size[0] // (20 if cid == 'Ser' else 100)))

IC = 64; COLS = 11
sheet = Image.new('RGBA', (COLS * IC, math.ceil(len(CON_IDS) / COLS) * IC), (255, 255, 255, 0))
for n, cid in enumerate(CON_IDS):
    L, cov, B = imgs[ALIAS.get(cid, cid)]
    cov = cov.copy()
    if cid in CROP: cov *= boundary_mask(cid, B, (L.shape[1], L.shape[0]))
    ys, xs = np.where(cov > 0.1)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(x1 - x0, y1 - y0) * 1.06) + 2; cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    alpha = cov * (0.42 + 0.58 * np.clip(L * 1.25, 0, 1))      # dark lines stay readable as thinner alpha
    a = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8))
    box = Image.new('L', (side, side), 0); box.paste(a.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)))
    box = box.resize((IC, IC), Image.LANCZOS)
    tile = Image.merge('RGBA', [Image.new('L', (IC, IC), 255)] * 3 + [box])
    sheet.paste(tile, ((n % COLS) * IC, (n // COLS) * IC))

js = ('// Wygenerowane przez tools/prep_art.py – nie edytuj ręcznie.\n'
      '// Ilustracje gwiazdozbiorów: Stellarium (kultura nieba „modern”, zespół Stellarium),\n'
      '// licencja Free Art License 1.3 – to samo dotyczy ikon wyciętych z tych rysunków.\n'
      'const ARTDATA=' + json.dumps(art, separators=(',', ':')) + ';\n'
      'const ICONDATA=' + json.dumps({'size': IC, 'cols': COLS, 'ids': CON_IDS,
                                      'img': 'data:image/webp;base64,' + b64(sheet, 'WEBP', lossless=True, quality=100, method=6)},
                                     separators=(',', ':')) + ';\n')
open(OUT, 'w', encoding='utf-8').write(js)
sheet.save(os.path.join(HERE, 'icons-preview.png'))
print(f'Zapisano {OUT}: {len(art)} ilustracji, {len(CON_IDS)} ikon, {len(js.encode()) // 1024} KB')
