"""
Firmament – oczyszczenie dopasowanych rycin atlasu Bodego.

Z każdej ryciny usuwane jest to, co w aplikacji rysuje się osobno albo nie pasuje do dzisiejszego nieba:
  * siatka współrzędnych B1800 (co 5°), zwrotniki i koła podbiegunowe – linia jest śledzona wzdłuż przewidywanego
    przebiegu (±7 px w poprzek) i zamalowywana tylko tam, gdzie rzeczywiście jest; kreskowanie figur zostaje,
  * przerywane pasy równika i ekliptyki – zastępowane fakturą sąsiadującą z pasem,
  * symbole gwiazd do 7,5 mag – wygaszane (w ich miejscu aplikacja rysuje prawdziwe gwiazdy).
Papier jest wyrównywany (wynik: biel = tusz). Dodatkowo zapisywana jest mapa zaufania każdej strony: odległość od
krawędzi obszaru dopasowanych gwiazd, ograniczonego do wnętrza wygrawerowanej ramki mapy (szachownica i podziałka
nie trafiają do figur), zmniejszana przy grzbiecie książki, gdzie papier się wygina.

Wynik: tools/bode/work/pNN_ink.png, pNN_w.npy.   Wymaga: numpy, scipy, Pillow, opencv-python-headless.
Uruchomienie:  python tools/bode/clean_plates.py [p03 p04 …]
"""
import sys, json, os, math
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from reg import load_stars, vec, Plate, detect2, chart_frame, frame_mask

HERE = os.path.dirname(os.path.abspath(__file__)); WORK = os.path.join(HERE, 'work')

OBL = math.radians(23.4664)   # obliquity around 1800

def lines_mask(pl, H, W, width):
    """band masks around Bode's coordinate grid (B1800, every 5 deg), tropics and polar circles, and the dashed
    equator and ecliptic bands; returns (thin-line band mask, orientation map in degrees, thick-band mask)"""
    m = np.zeros((H, W), np.uint8); ang = np.zeros((H, W), np.float32); thick = np.zeros((H, W), np.uint8)
    def draw(V, w, tgt):
        P, _ = pl(V); ok = np.isfinite(P[:, 0]) & (P[:, 0] > -50) & (P[:, 0] < W + 50) & (P[:, 1] > -50) & (P[:, 1] < H + 50)
        for k in range(len(P) - 1):
            if not (ok[k] and ok[k + 1]): continue
            a_, b_ = P[k], P[k + 1]
            if np.hypot(*(b_ - a_)) > 60: continue
            p1, p2 = tuple(np.round(a_).astype(int)), tuple(np.round(b_).astype(int))
            cv2.line(tgt, p1, p2, 255, w)
            cv2.line(ang, p1, p2, float(math.degrees(math.atan2(b_[1] - a_[1], b_[0] - a_[0])) % 180), w)
    d = np.linspace(-89.5, 89.5, 4000)
    for ra in range(0, 360, 5): draw(vec(np.full_like(d, ra), d), width, m)
    r = np.linspace(0, 360, 8000)
    for de in range(-85, 90, 5):
        if de: draw(vec(r, np.full_like(r, de)), width, m)
    for de in (23.4664, -23.4664, 66.5336, -66.5336): draw(vec(r, np.full_like(r, de)), width, m)
    draw(vec(r, np.zeros_like(r)), width + 4, thick)           # equator: dashed band
    lam = np.radians(r); ecl = np.stack([np.cos(lam), np.sin(lam) * math.cos(OBL), np.sin(lam) * math.sin(OBL)], -1)
    draw(ecl, width + 4, thick)                                 # ecliptic: dashed band
    return m, ang, thick

def trace_lines(ink, pl, H, W, step=2.0):
    """follows every engraved grid line: samples the predicted curve every `step` px, searches +-7 px along the
    normal for the ink ridge (smoothed along the line), returns a list of refined polylines (only where a ridge exists)"""
    curves = []
    d = np.linspace(-89.8, 89.8, 9000); r = np.linspace(0, 360, 18000)
    for ra in range(0, 360, 5): curves.append(vec(np.full_like(d, ra), d))
    for de in range(-85, 90, 5):
        if de: curves.append(vec(r, np.full_like(r, de)))
    for de in (23.4664, -23.4664, 66.5336, -66.5336): curves.append(vec(r, np.full_like(r, de)))
    sm = cv2.GaussianBlur(ink, (0, 0), 0.8); out = []
    offs = np.arange(-7, 7.5, 0.5)
    for V in curves:
        P, _ = pl(V); ok = np.isfinite(P[:, 0]) & (P[:, 0] > 5) & (P[:, 0] < W - 5) & (P[:, 1] > 5) & (P[:, 1] < H - 5)
        idx = np.where(ok)[0]
        if len(idx) < 20: continue
        # split into runs, resample each at `step` px
        runs = np.split(idx, np.where(np.diff(idx) > 1)[0] + 1)
        for run in runs:
            Q = P[run]; seg = np.hypot(*np.diff(Q, axis=0).T); keep = seg < 40
            if not keep.all(): continue
            s_ = np.concatenate([[0], np.cumsum(seg)]); L = s_[-1]
            if L < 60: continue
            t = np.arange(0, L, step); Q = np.stack([np.interp(t, s_, Q[:, 0]), np.interp(t, s_, Q[:, 1])], 1)
            tg = np.gradient(Q, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9; nr = np.stack([-tg[:, 1], tg[:, 0]], 1)
            prof = np.stack([ndi.map_coordinates(sm, [Q[:, 1] + o * nr[:, 1], Q[:, 0] + o * nr[:, 0]], order=1) for o in offs], 1)
            # smooth along the line so the ridge position is stable through hatching
            prof_s = ndi.uniform_filter1d(prof, 21, axis=0)
            k = np.argmax(prof_s, 1); best = prof_s[np.arange(len(k)), k]
            base = np.median(prof_s, 1)
            off = ndi.median_filter(offs[k], 31)
            off = ndi.uniform_filter1d(off, 15)
            good = (best - base) > 0.06
            good = ndi.binary_opening(good, np.ones(9)) if good.sum() else good
            R = Q + off[:, None] * nr
            out.append((R, good))
    return out

def line_mask_traced(traced, H, W, width=3):
    m = np.zeros((H, W), np.uint8)
    for R, good in traced:
        for a, b in zip(np.where(np.diff(np.concatenate([[0], good.astype(int), [0]])) == 1)[0], np.where(np.diff(np.concatenate([[0], good.astype(int), [0]])) == -1)[0]):
            pts = np.round(R[a:b] * 4).astype(np.int32)
            if len(pts) > 1: cv2.polylines(m, [pts], False, 255, width, cv2.LINE_8, shift=2)
    return m

def main(name):
    os.makedirs(WORK, exist_ok=True)
    src = os.path.join(HERE, 'plates', f'{name}.jpg')
    img = np.asarray(Image.open(src), np.float32); H, W = img.shape
    pl = Plate.from_json(json.load(open(os.path.join(HERE, 'models', f'm_{name}.json'))))
    # paper flattening: ink = paper level - pixel, paper level from a large-scale upper envelope
    small = cv2.resize(img, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    paper = cv2.resize(ndi.percentile_filter(small, 80, size=9), (W, H), interpolation=cv2.INTER_LINEAR)
    ink = np.clip((paper - img) / np.maximum(paper, 60) * 1.25, 0, 1)
    # the binding casts a narrow shadow along the gutter, which the large-scale paper level misses: per column, a low
    # percentile along the gutter (engraved strokes are short there, the shadow is not) is taken as extra paper tone
    g = json.load(open(os.path.join(HERE, 'gutter.json')))[name]
    x0, x1 = max(0, g - 120), min(W, g + 120)
    bg = ndi.percentile_filter(ink[::4, x0:x1], 10, size=(75, 1))
    bg = cv2.resize(ndi.uniform_filter1d(bg, 5, axis=1), (x1 - x0, H), interpolation=cv2.INTER_LINEAR)
    ink[:, x0:x1] = np.clip(ink[:, x0:x1] - bg, 0, 1)
    # 1) grid lines: only the pixels of long straight strokes along the predicted line (hatching survives)
    _, ang, thick = lines_mask(pl, H, W, 13)
    traced = trace_lines(ink, pl, H, W)
    lp = line_mask_traced(traced, H, W, 4) > 0
    lp &= ink > 0.08
    tb = thick > 0
    ink8 = (ink * 255).astype(np.uint8)
    clean = cv2.inpaint(ink8, (lp & ~tb).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA).astype(np.float32) / 255
    # dashed bands: filled with the texture just beside the band (mean of +-12 px along the normal)
    tbw = cv2.dilate((thick > 0).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    ys, xs = np.nonzero(tbw); th = np.radians(ang[ys, xs]); nx, ny = -np.sin(th), np.cos(th)
    side = lambda k: ndi.map_coordinates(clean, [ys + k * ny, xs + k * nx], order=1, mode='nearest')
    fill = 0.5 * (side(13) + side(-13))
    clean[ys, xs] = fill
    lp |= tbw
    # 2) star symbols: blanked (the rendered stars cover these spots)
    cat = load_stars(7.5); P, _ = pl(cat['v']); ok = np.isfinite(P[:, 0])
    D = detect2(Image.open(src), thr=1.0)
    t = cKDTree(D[:, :2]); holes = np.zeros((H, W), np.uint8)
    for (x, y), mg in zip(P[ok], cat['mag'][ok]):
        if not (0 <= x < W and 0 <= y < H): continue
        d, j = t.query([x, y])
        if d < 6: x, y = D[j, 0], D[j, 1]
        cv2.circle(holes, (int(round(x)), int(round(y))), int(round(4 + max(0, 6.8 - mg) * 1.9)), 255, -1)
    hole = cv2.GaussianBlur(holes.astype(np.float32) / 255, (0, 0), 1.5)
    clean = clean * (1 - np.clip(hole * 1.3, 0, 1))
    clean = (np.clip(clean, 0, 1) * 255).astype(np.uint8)
    # where this plate can be trusted: inside the hull of its matched stars (per page), away from the binding
    cat6 = load_stars(6.5); P6, isL = pl(cat6['v']); ok6 = np.isfinite(P6[:, 0])
    dd, _ = t.query(np.where(ok6[:, None], P6, -1e6))
    good = ok6 & (dd < 5)
    wgt = np.zeros((H // 4, W // 4), np.float32)
    inside = frame_mask(chart_frame(img), W, H, scale=4)[:H // 4, :W // 4]
    for page in (True, False):
        pts = P6[good & (isL == page)]
        if len(pts) < 10: continue
        hm = np.zeros((H // 4, W // 4), np.uint8)
        cv2.fillConvexPoly(hm, cv2.convexHull(np.round(pts / 4).astype(np.int32)), 1)
        hm &= inside.astype(np.uint8)                       # never beyond the engraved frame
        side_ = (np.arange(W // 4)[None, :] * 4 < g) == page
        dist = cv2.distanceTransform(hm, cv2.DIST_L2, 5) * 4
        wgt = np.where(side_ & (hm > 0), dist, wgt)
    gx = np.abs(np.arange(W // 4) * 4 - g)[None, :]
    wgt *= np.clip(gx / 80.0, 0.12, 1.0)
    np.save(os.path.join(WORK, f'{name}_w.npy'), wgt.astype(np.float16))
    cv2.imwrite(os.path.join(WORK, f'{name}_ink.png'), clean)
    print(name, 'usunięto', int((lp | (holes > 0)).sum()), 'px')

if __name__ == '__main__':
    for n in sys.argv[1:] or [f'p{k:02d}' for k in range(3, 21)]: main(n)
