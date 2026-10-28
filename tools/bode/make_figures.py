"""
Firmament – ryciny poszczególnych gwiazdozbiorów z oczyszczonych, dopasowanych rycin atlasu Bodego.

Każdy gwiazdozbiór dostaje własny obraz w rzucie gnomonicznym wokół swojego środka (ok. 18 px na stopień).
Każdy punkt obrazu jest odszukiwany na wszystkich rycinach, które go obejmują. Główną jest rycina, na której
gwiazdozbiór leży najlepiej (Bode rysował tę samą okolicę na sąsiednich arkuszach trochę inaczej, więc mieszanie
dałoby podwójne napisy); pozostałe uzupełniają tylko jej brzegi, z wąskim, łagodnym szwem. Wąski pas nieba schowany
w zgięciu grzbietu (między modelami lewej i prawej strony) jest ściskany do paska przy grzbiecie, a miejsca, których
żadna rycina nie pokazuje pewnie, biorą treść z ryciny najbliższej pewnego obszaru. Obraz jest ograniczony
do granic IAU gwiazdozbioru z miękką krawędzią, więc sąsiednie figury stykają się bez nakładania. Okręt Argo
(Kil, Rufa, Żagiel) i Wężownik z Wężem to po jednej figurze, jak w atlasie.

Wynik: tools/raw/bode/<id>.webp (biel = tusz), <id>_a.png (zasięg), index.json (trzy punkty zaczepienia na sferze).
Uruchomienie:  python tools/bode/make_figures.py [Ori Tau …]     (całość kilkanaście minut)
"""
import json, math, os, sys
import numpy as np, cv2
from scipy import ndimage as ndi
from reg import Plate, P1800, load_stars, vec

HERE = os.path.dirname(os.path.abspath(__file__))
SKY = os.path.join(HERE, '..', '..', 'src', 'data', 'skydata.js')
OUTDIR = os.path.join(HERE, '..', 'raw', 'bode')
PX_PER_DEG = 18.0           # output scale at the tangent point
MAXDIM = 2200
MARGIN = 1.6                # degrees around the region
FEATHER = 0.35              # degrees, sigma of the soft region edge
GROUPS = {'Car': ['Car', 'Pup', 'Vel'], 'Oph': ['Oph', 'Ser']}
SKIP = {'Pup', 'Vel', 'Ser'}

def load_sky():
    t = open(SKY, encoding='utf-8').read(); SD = json.loads(t[t.index('{'):t.rindex('}') + 1])
    ids = [c['id'] for c in SD['cons']]
    g = np.empty(1440 * 720, np.uint8); p = 0; cg = SD['CG']
    for k in range(0, len(cg), 2): g[p:p + cg[k + 1]] = cg[k]; p += cg[k + 1]
    return ids, g.reshape(720, 1440)

def plates():
    out = []
    cat = load_stars(6.5)
    for n in range(3, 21):
        name = f'p{n:02d}'
        pl = Plate.from_json(json.load(open(os.path.join(HERE, 'models', f'm_{name}.json'))))
        ink = cv2.imread(os.path.join(HERE, 'work', f'{name}_ink.png'), cv2.IMREAD_GRAYSCALE)
        w = np.load(os.path.join(HERE, 'work', f'{name}_w.npy')).astype(np.float32)
        # sky footprint of each page: stars that fall on the page with a positive weight
        P, isL = pl(cat['v']); ok = np.isfinite(P[:, 0])
        H, W = ink.shape; inside = ok & (P[:, 0] > 0) & (P[:, 0] < W) & (P[:, 1] > 0) & (P[:, 1] < H)
        wv = np.zeros(len(P)); wv[inside] = w[(P[inside, 1] / 4).astype(int).clip(0, w.shape[0] - 1), (P[inside, 0] / 4).astype(int).clip(0, w.shape[1] - 1)]
        foot = {}
        for page in (True, False):
            V = cat['v'][(wv > 0) & (isL == page)]
            if len(V) < 10: continue
            c = V.mean(0); c /= np.linalg.norm(c); foot[page] = (c, math.cos(math.acos(np.clip((V @ c).min(), -1, 1)) + math.radians(2)))
        allc = cat['v'][wv > 0].mean(0); allc /= np.linalg.norm(allc)
        rad = math.acos(np.clip((cat['v'][wv > 0] @ allc).min(), -1, 1))
        # signed trust: inside the trusted area as above, outside it minus the distance to it (in plate pixels)
        fb = np.where(w > 0, w, -cv2.distanceTransform((w <= 0).astype(np.uint8), cv2.DIST_L2, 5) * 4).astype(np.float32)
        out.append(dict(name=name, pl=pl, ink=ink.astype(np.float32) / 255, w=fb, foot=foot, c=allc, r=rad))
    return out

def gridlook(V, grid):
    r, d = radec(V)
    return grid[np.clip((d + 90) / 0.25, 0, 719.999).astype(int), np.clip(r / 0.25, 0, 1439.999).astype(int)]

def tangent_basis(c):
    up = np.array([0, 0, 1.0]) if abs(c[2]) < 0.999 else np.array([1.0, 0, 0])
    e = np.cross(up, c); e /= np.linalg.norm(e); n = np.cross(c, e); return e, n

def radec(v):
    return np.degrees(np.arctan2(v[..., 1], v[..., 0])) % 360, np.degrees(np.arcsin(np.clip(v[..., 2], -1, 1)))

def plate_xy(pl, v, m=4.0):
    """pixel position on a plate and its page, as Plate() gives it, except for sky that falls between the two page
    models (the strip hidden in the fold of the binding): that is squeezed onto a narrow strip at the gutter instead
    of being left out, so a figure that runs across the fold stays whole"""
    PL, PR = pl.L(v), pl.R(v); g = pl.g
    inL, inR = PL[:, 0] < g, PR[:, 0] >= g
    useL = inL & (~(inL & inR) | ((g - PL[:, 0]) > (PR[:, 0] - g)))
    P = np.where(useL[:, None], PL, PR)
    gap = ~inL & ~inR
    with np.errstate(invalid='ignore'):
        dL, dR = PL[:, 0] - g, g - PR[:, 0]
        fold = gap & (dL + dR < 120) & (np.abs(PL[:, 1] - PR[:, 1]) < 40)
    t = dL[fold] / np.maximum(dL[fold] + dR[fold], 1e-9)
    P[fold, 0] = g + (2 * t - 1) * m
    P[fold, 1] = (1 - t) * PL[fold, 1] + t * PR[fold, 1]
    useL[fold] = t < 0.5
    P[gap & ~fold] = np.nan
    tf = np.full(len(P), np.nan); tf[fold] = t                      # where in the fold (0 = left edge, 1 = right)
    return P, useL, (tf, PL[:, 1], PR[:, 1])

def build(cid, members, ids, grid, PL, outdir, anchors_only=False):
    # region cells (J2000 grid of 0.25 deg) -> centre and tangent-plane bounding box
    mi = [ids.index(m) for m in members]
    jj, ii = np.nonzero(np.isin(grid, mi))
    ra = (ii + 0.5) * 0.25; de = (jj + 0.5) * 0.25 - 90
    V = vec(ra, de); wts = np.cos(np.radians(de))
    c = (V * wts[:, None]).sum(0); c /= np.linalg.norm(c)
    e, n = tangent_basis(c)
    d = V @ c; X = (V @ e) / d; Y = (V @ n) / d
    m = math.tan(math.radians(MARGIN))
    x0, x1, y0, y1 = X.min() - m, X.max() + m, Y.min() - m, Y.max() + m
    s = PX_PER_DEG * 180 / math.pi
    s = min(s, MAXDIM / (x1 - x0), MAXDIM / (y1 - y0))
    Wd, Hd = int(math.ceil((x1 - x0) * s)), int(math.ceil((y1 - y0) * s))
    if anchors_only: return anchors_for(c, e, n, x0, x1, y0, y1, s, Wd, Hd)
    # pixel (i, j): east coordinate decreases to the right (sky seen from inside), north decreases downwards
    i = np.arange(Wd) + 0.5; j = np.arange(Hd) + 0.5
    XX = x1 - i[None, :] / s; YY = y1 - j[:, None] / s
    Wv = c[None, None, :] + XX[..., None] * e + YY[..., None] * n
    Wv /= np.linalg.norm(Wv, axis=-1, keepdims=True)
    flat = Wv.reshape(-1, 3); v18 = flat @ P1800.T
    rr = math.acos(np.clip(d.min(), -1, 1)) + math.radians(MARGIN)
    samples = []
    for p in PL:
        if math.acos(np.clip(p['c'] @ c, -1, 1)) > p['r'] + rr: continue
        P, isL, (tf, yL, yR) = plate_xy(p['pl'], v18)
        ok = np.isfinite(P[:, 0])
        for page, (fc, fcos) in p['foot'].items():   # no polynomial fold-back from far away
            ok &= ~((isL == page) & ((v18 @ fc) < fcos))
        H, W = p['ink'].shape
        ok &= (P[:, 0] > 1) & (P[:, 0] < W - 2) & (P[:, 1] > 1) & (P[:, 1] < H - 2)
        if not ok.any(): continue
        idx = np.where(ok)[0]; q = P[ok]
        wr = ndi.map_coordinates(p['w'], [q[:, 1] / 4, q[:, 0] / 4], order=1)
        wv = np.maximum(wr - 25, 0)                                       # keep clear of the chart frame
        val = ndi.map_coordinates(p['ink'], [q[:, 1], q[:, 0]], order=1)
        f = np.isfinite(tf[idx])
        if f.any():   # inside the fold: cross-fade between the two page edges, stepping over the line along the fold
            g, tt = p['pl'].g, tf[idx][f]
            vL = ndi.map_coordinates(p['ink'], [yL[idx][f], np.full(f.sum(), g - 7.0)], order=1)
            vR = ndi.map_coordinates(p['ink'], [yR[idx][f], np.full(f.sum(), g + 7.0)], order=1)
            val[f] = (1 - tt) * vL + tt * vR
        samples.append((p['name'], idx, wv, val, wr))
    # main plate: covers most of the region best; other plates only fill in (the same area engraved twice differs)
    regmask = np.isin(gridlook(flat, grid), mi)
    score = {nm: float(((wv > 20) & regmask[idx]).sum()) + 1e-6 * float((wv * regmask[idx]).sum()) for nm, idx, wv, val, wr in samples}
    main = max(score, key=score.get) if score else None
    wmax = np.zeros(len(flat), np.float32); eff = []
    for nm, idx, wv, val, wr in samples:
        we = wv * (4.0 if nm == main else 1.0)                               # main plate wins unless near its edge or the binding
        eff.append(we); wmax[idx] = np.maximum(wmax[idx], we)
    acc = np.zeros(len(flat), np.float32); wsum = np.zeros(len(flat), np.float32)
    for (nm, idx, wv, val, wr), we in zip(samples, eff):
        k = np.where(we > 0, np.exp((we - wmax[idx]) / 15.0), 0.0)        # narrow seam, about 15 px of plate
        acc[idx] += k * val; wsum[idx] += k
    # no trusted plate (mostly the strip along a binding, where the page bends): take what the plates show there,
    # preferring the most trusted one, rather than leave a hole in the figure
    hole = wsum == 0
    if hole.any():
        fmax = np.full(len(flat), -np.inf, np.float32)
        for nm, idx, wv, val, wr in samples: fmax[idx] = np.maximum(fmax[idx], wr)
        for nm, idx, wv, val, wr in samples:
            h = hole[idx]; k = np.exp((wr[h] - fmax[idx[h]]) / 15.0)
            acc[idx[h]] += k * val[h]; wsum[idx[h]] += k
    img = np.where(wsum > 0, acc / np.maximum(wsum, 1e-9), 0).reshape(Hd, Wd)
    covered = (wsum > 0).reshape(Hd, Wd)
    # soft region mask
    rd, dd = radec(Wv)
    gi = np.clip((dd + 90) / 0.25, 0, 719.999).astype(int); gj = np.clip(rd / 0.25, 0, 1439.999).astype(int)
    reg = np.isin(grid[gi, gj], mi).astype(np.float32)
    sig = FEATHER * s * math.pi / 180
    alpha = cv2.GaussianBlur(reg, (0, 0), sig) * covered
    cv2.imwrite(os.path.join(outdir, f'{cid}.webp'), np.clip(img * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 90])
    cv2.imwrite(os.path.join(outdir, f'{cid}_a.png'), np.clip(alpha * 255, 0, 255).astype(np.uint8))
    anchors = anchors_for(c, e, n, x0, x1, y0, y1, s, Wd, Hd)
    cov = float(covered.mean())
    return dict(c=cid, members=members, size=[Wd, Hd], anchors=anchors, covered=round(cov, 3), pxdeg=round(s * math.pi / 180, 1), plate=main)

def anchors_for(c, e, n, x0, x1, y0, y1, s, Wd, Hd):
    """three anchors on a circle about the tangent point (equal distance -> the 3-point mapping is exact)"""
    rho = 0.3 * min(x1 - x0, y1 - y0)
    anchors = []
    for a in (90, 210, 330):
        xa, ya = rho * math.cos(math.radians(a)), rho * math.sin(math.radians(a))
        u = (x1 - xa) * s / Wd; v = (y1 - ya) * s / Hd     # exact pixel geometry (sizes are rounded up)
        w = c + xa * e + ya * n; w /= np.linalg.norm(w); r_, d_ = radec(w)
        anchors.append([round(u, 6), round(v, 6), round(float(r_), 5), round(float(d_), 5)])
    return anchors

def main():
    ids, grid = load_sky()
    PL = None if '--anchors' in sys.argv else plates()
    outdir = OUTDIR; os.makedirs(outdir, exist_ok=True)
    only = sys.argv[1:]
    todo = [c for c in dict.fromkeys(ids) if c not in SKIP]
    if only: todo = [c for c in todo if c in only]
    idx = {}
    if os.path.exists(os.path.join(outdir, 'index.json')): idx = json.load(open(os.path.join(outdir, 'index.json')))
    if '--anchors' in only:   # recompute anchors only
        for cid in idx: idx[cid]['anchors'] = build(cid, GROUPS.get(cid, [cid]), ids, grid, None, outdir, True)
        json.dump(idx, open(os.path.join(outdir, 'index.json'), 'w'), indent=0); return
    for cid in todo:
        r = build(cid, GROUPS.get(cid, [cid]), ids, grid, PL, outdir)
        idx[cid] = r; print(cid, r['size'], 'px/deg', r['pxdeg'], 'covered', r['covered'], 'plate', r['plate'], flush=True)
    path = os.path.join(outdir, 'index.json')       # merge with what another run may have written meanwhile
    if os.path.exists(path): idx = {**json.load(open(path)), **{c: idx[c] for c in todo}}
    json.dump(idx, open(path, 'w'), indent=0)

if __name__ == '__main__':
    main()
