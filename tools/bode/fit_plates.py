"""
Firmament – dopasowanie rycin atlasu Bodego do nieba.

Dla każdej ryciny z tools/bode/plates/: wykrywa wygrawerowane symbole gwiazd, startuje od kilku ręcznie
wskazanych jasnych gwiazd (anchors.json: [HIP, x, y] w pikselach skanu 3200 px) i dopasowuje model każdej strony
rozkładówki (grzbiet książki: gutter.json). Zapisuje models/m_pNN.json i, z opcją --check, podgląd
work/ov_pNN.jpg (czerwone kółka: gwiazdy katalogu w miejscach przewidzianych przez model).

Kontrola: każda gwiazda do 4,5 mag wewnątrz ramki mapy powinna leżeć na symbolu gwiazdy (≤ 6 px, czyli ok. 0,2°).
Uruchomienie:  python tools/bode/fit_plates.py [p03 p04 …] [--check]
"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from reg import load_stars, detect2, register2, register_from, Plate

HERE = os.path.dirname(os.path.abspath(__file__))

def fit(name, check=False):
    anchors = json.load(open(os.path.join(HERE, 'anchors.json')))[name]
    g = json.load(open(os.path.join(HERE, 'gutter.json')))[name]
    cat = load_stars(6.5)
    im = Image.open(os.path.join(HERE, 'plates', f'{name}.jpg')); W, H = im.size; D = detect2(im)
    aL = [a for a in anchors if a[1] < g]; aR = [a for a in anchors if a[1] >= g]
    mL = register2(D, cat, aL, W, H, xr=(0, g), g=g, verbose=False) if len(aL) >= 2 else None
    mR = register2(D, cat, aR, W, H, xr=(g, W), g=g, verbose=False) if len(aR) >= 2 else None
    if mL is None: mL = register_from(D, cat, mR, W, H, (0, g), g=g, verbose=False)
    if mR is None: mR = register_from(D, cat, mL, W, H, (g, W), g=g, verbose=False)
    pl = Plate(g, mL, mR)
    os.makedirs(os.path.join(HERE, 'models'), exist_ok=True)
    json.dump(pl.to_json(), open(os.path.join(HERE, 'models', f'm_{name}.json'), 'w'))
    P, _ = pl(cat['v'])
    Dall = detect2(im, thr=1.0); t = cKDTree(Dall[:, :2])
    ok = np.isfinite(P[:, 0]) & (P[:, 0] > 300) & (P[:, 0] < W - 300) & (P[:, 1] > 230) & (P[:, 1] < H - 230) & (cat['mag'] <= 4.5)
    dd, _ = t.query(P[ok])
    print(f'{name}: {int((dd <= 6).sum())}/{len(dd)} jasnych gwiazd na swoich symbolach')
    if check:
        os.makedirs(os.path.join(HERE, 'work'), exist_ok=True)
        v = im.convert('RGB'); d = ImageDraw.Draw(v); sel = (cat['mag'] <= 6.5) & np.isfinite(P[:, 0])
        for (x, y), mg in zip(P[sel], cat['mag'][sel]):
            rr = 2 + (6.5 - mg) * 1.5; d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=(255, 0, 0), width=2)
        d.line([(g, 0), (g, H)], fill=(0, 0, 255), width=1)
        v.save(os.path.join(HERE, 'work', f'ov_{name}.jpg'), quality=80)

if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or [f'p{n:02d}' for n in range(3, 21)]
    for n in names: fit(n, '--check' in sys.argv)
