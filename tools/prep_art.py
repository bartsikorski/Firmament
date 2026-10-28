"""
Firmament – ilustracje i ikony gwiazdozbiorów z atlasu Johanna Elerta Bodego „Uranographia” (Berlin 1801).

Czyta ryciny przygotowane przez narzędzia z tools/bode/ (domena publiczna; skany: ETH-Bibliothek Zürich, e-rara.ch):
  tools/raw/bode/<id>.webp   – rycina gwiazdozbioru w rzucie gnomonicznym (biel = tusz), z usuniętą siatką
                                współrzędnych i symbolami gwiazd,
  tools/raw/bode/<id>_a.png  – zasięg gwiazdozbioru (granice IAU z miękką krawędzią),
  tools/raw/bode/index.json  – trzy punkty na sferze, na których rozpięta jest każda rycina,
i zapisuje src/data/artdata.js:

  * ARTDATA – dla każdej ryciny: obraz w odcieniach szarości (WebP, jasność wyrównana między rycinami, lekko
    wyostrzony), maska pokrycia w 1/4 rozdzielczości (WebP) oraz trzy punkty zaczepienia. Maska przyciemnia niebo
    pod figurą, dzięki czemu kreski ryciny są wyraźne.
  * ICONDATA – arkusz 88 ikon (po jednej na gwiazdozbiór), wyciętych z rycin. Kil, Rufa i Żagiel dzielą rycinę
    okrętu Argo, a Wąż – rycinę Wężownika; ich ikony to fragmenty leżące w granicach danego gwiazdozbioru.

Wymaga: numpy, scipy, Pillow.   Uruchomienie: python tools/prep_art.py
"""
import json, os, io, base64, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw')
BODE = os.path.join(RAW, 'bode')
OUT = os.path.join(HERE, '..', 'src', 'data', 'artdata.js')
load = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
idx = json.load(open(os.path.join(BODE, 'index.json'), encoding='utf-8'))
CON_IDS = list(dict.fromkeys(f['id'] for f in load('constellations.json')['features']))   # Serpens appears twice
ALIAS = {'Pup': 'Car', 'Vel': 'Car', 'Ser': 'Oph'}          # figures shared by several constellations
CROP = {'Car', 'Pup', 'Vel', 'Ser', 'Oph'}                  # icons cut out along the IAU boundary
SCALE = 0.8                                                 # 18 px/deg in tools/raw/bode -> about 14 px/deg here

def vec(ra, dec):
    r, d = math.radians(ra), math.radians(dec)
    return np.array([math.cos(d) * math.cos(r), math.cos(d) * math.sin(r), math.sin(d)])

def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r

def coverage(L, A):
    """Maska postaci: obszary gęstego kreskowania. Cienkie linie, napisy, kropki i pojedyncze kreski odpadają
    (otwarcie morfologiczne i minimalna wielkość plamy), małe dziury wewnątrz postaci są wypełniane."""
    m = ndi.binary_opening(ndi.gaussian_filter(L, 2.0) > 0.11, structure=disk(2))
    lab, k = ndi.label(m)
    if k:
        sizes = ndi.sum(m, lab, range(1, k + 1)); m = np.isin(lab, 1 + np.where(sizes > 900)[0])
    m = ndi.binary_closing(np.pad(m, 8), structure=disk(5))[8:-8, 8:-8]
    holes = ndi.binary_fill_holes(m) & ~m; lab, k = ndi.label(holes)
    if k:
        sizes = ndi.sum(holes, lab, range(1, k + 1)); m |= np.isin(lab, 1 + np.where(sizes < 2500)[0])
    return np.clip(ndi.gaussian_filter(m.astype(np.float32), 1.5) * 1.1, 0, 1) * A

def enhance(L, cov, A):
    """Wyrównanie jasności między rycinami, podniesienie półtonów (kreskowanie czyta się wtedy jak cieniowanie
    postaci, a nie jak szum) i lekkie wyostrzenie (maska nieostra). Najsłabsze tło papieru jest odcinane."""
    L = np.maximum(L - 0.03, 0)
    inside = L[cov > 0.5] if (cov > 0.5).sum() > 500 else L[A > 0.5]
    hi = np.percentile(inside, 99) if inside.size > 100 else 1.0
    L = np.clip(L / max(hi, 0.25), 0, 1) ** 0.65 * 0.9
    return np.clip(L + 0.3 * (L - ndi.gaussian_filter(L, 1.2)), 0, 1)

def otsu(v):
    h, e = np.histogram(v, 64, (0, max(float(v.max()), 1e-3))); c = (e[:-1] + e[1:]) / 2
    w = h.cumsum(); m = (h * c).cumsum(); b = (m[-1] * w / w[-1] - m) ** 2 / np.maximum(w * (w[-1] - w), 1)
    return c[b.argmax()]

def silhouette(L, reg):
    """Sylwetka postaci do ikony: rozmyte kreskowanie powyżej progu Otsu, domknięte i wypełnione; zostają największe
    plamy (napisy i drobne elementy odpadają)."""
    D = ndi.gaussian_filter(L, 3.0)
    m = (D > max(0.07, otsu(D[reg]))) & reg
    m = ndi.binary_fill_holes(ndi.binary_closing(np.pad(m, 12), structure=disk(6))[12:-12, 12:-12])
    lab, k = ndi.label(m)
    if k > 1:
        sz = ndi.sum(m, lab, range(1, k + 1)); keep, acc = [], 0
        for j in np.argsort(-sz):
            if sz[j] < 0.05 * sz.max() or acc > 0.92 * sz.sum(): break
            keep.append(j + 1); acc += sz[j]
        m = np.isin(lab, keep)
    return m

def b64(img, fmt, **kw):
    buf = io.BytesIO(); img.save(buf, fmt, **kw); return base64.b64encode(buf.getvalue()).decode()

# ---------------------------------------------------------------- illustrations
art, imgs = [], {}
for cid, meta in idx.items():
    g = Image.open(os.path.join(BODE, f'{cid}.webp')).convert('L'); a = Image.open(os.path.join(BODE, f'{cid}_a.png')).convert('L')
    w, h = max(64, round(g.width * SCALE)), max(64, round(g.height * SCALE))
    g, a = g.resize((w, h), Image.LANCZOS), a.resize((w, h), Image.LANCZOS)
    A = np.asarray(a, np.float32) / 255
    Lr = np.asarray(g, np.float32) / 255 * A
    cov = coverage(Lr, A); L = enhance(Lr, cov, A) * A
    l8 = Image.fromarray((L * 255 + 0.5).astype(np.uint8))
    m8 = Image.fromarray((cov * 255 + 0.5).astype(np.uint8)).resize((max(64, w // 4), max(64, h // 4)), Image.LANCZOS)
    S = np.array([vec(an[2], an[3]) for an in meta['anchors']]).T; Pm = np.array([[an[0], an[1], 1.0] for an in meta['anchors']]).T
    B = S @ np.linalg.inv(Pm)                                  # (u, v, 1) -> sky vector
    imgs[cid] = (Lr, B, A)
    art.append({'c': cid, 'a': meta['anchors'], 'img': 'data:image/webp;base64,' + b64(l8, 'WEBP', quality=72, method=6),
                'mask': 'data:image/webp;base64,' + b64(m8, 'WEBP', quality=60, method=6)})

# ---------------------------------------------------------------- icons
bounds = {}
for f in load('constellations.bounds.json')['features']:
    bounds.setdefault(f['id'], []).append(f['geometry']['coordinates'][0])
# Serpens: only Serpens Caput (the part west of Ophiuchus, RA < 260 deg) for its icon
bounds['Ser'] = [r for r in bounds['Ser'] if np.mean([p[0] % 360 for p in r]) < 260]

def boundary_mask(cid, B, size):
    """Granice gwiazdozbioru narysowane w układzie obrazu ryciny."""
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
    return np.asarray(m) > 0

IC = 64; COLS = 11
sheet = Image.new('RGBA', (COLS * IC, math.ceil(len(CON_IDS) / COLS) * IC), (255, 255, 255, 0))
for n, cid in enumerate(CON_IDS):
    L, B, A = imgs[ALIAS.get(cid, cid)]
    reg = A > 0.5
    if cid in CROP: reg &= ndi.binary_dilation(boundary_mask(cid, B, (L.shape[1], L.shape[0])), iterations=3)
    m = silhouette(L, reg)
    ys, xs = np.where(m if m.any() else reg)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(x1 - x0, y1 - y0) * 1.06) + 2; cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    # at icon size the hatching averages to grey: a soft silhouette with the strokes on top reads best
    sm = ndi.gaussian_filter(m.astype(np.float32), max(1.0, side / IC * 0.7))
    Lg = np.clip(L / max(np.percentile(L[m] if m.sum() > 100 else L[reg], 99), 0.2), 0, 1) ** 0.65
    alpha = np.clip(sm * 0.55 + ndi.gaussian_filter(Lg, max(1.0, side / IC * 0.5)) * sm * 0.9, 0, 1)
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    box = Image.new('L', (side, side), 0); box.paste(a.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)))
    box = box.resize((IC, IC), Image.LANCZOS)
    tile = Image.merge('RGBA', [Image.new('L', (IC, IC), 255)] * 3 + [box])
    sheet.paste(tile, ((n % COLS) * IC, (n // COLS) * IC))

js = ('// Wygenerowane przez tools/prep_art.py – nie edytuj ręcznie.\n'
      '// Ilustracje gwiazdozbiorów: J. E. Bode, „Uranographia” (Berlin 1801), domena publiczna;\n'
      '// skany: ETH-Bibliothek Zürich, e-rara.ch. Ikony wycięte z tych samych rycin.\n'
      'const ARTDATA=' + json.dumps(art, separators=(',', ':')) + ';\n'
      'const ICONDATA=' + json.dumps({'size': IC, 'cols': COLS, 'ids': CON_IDS,
                                      'img': 'data:image/webp;base64,' + b64(sheet, 'WEBP', lossless=True, quality=100, method=6)},
                                     separators=(',', ':')) + ';\n')
open(OUT, 'w', encoding='utf-8').write(js)
sheet.save(os.path.join(HERE, 'icons-preview.png'))
print(f'Zapisano {OUT}: {len(art)} ilustracji, {len(CON_IDS)} ikon, {len(js.encode()) // 1024} KB')
