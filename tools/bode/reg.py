"""Firmament – dopasowanie rycin „Uranographii” Bodego do nieba (wspólne funkcje narzędzi z tools/bode/).

Model rozkładówki: kierunek J2000 -> średni równik i punkt równonocy B1800 (epoka atlasu) -> położenie na
stronie. Bode rysował mapy w rzucie stożkowym (południki zbiegają się w jednym punkcie, równoleżniki są łukami),
więc dla każdej strony dopasowywany jest stożek (Conic): wierzchołek, kąt i promień jako wielomian deklinacji,
plus gładka poprawka w pikselach, która uwzględnia też wygięcie papieru przy grzbiecie książki. Dla map
równikowych, gdzie południki są prawie równoległe, stożek jest zastąpiony wielomianem we współrzędnych
stereograficznych (PolyG). Punkty kontrolne to wygrawerowane symbole gwiazd sparowane z gwiazdami katalogu HYG."""
import numpy as np, math, csv, os
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
HYG = os.path.join(HERE, '..', 'raw', 'hyg_v41_mag8.csv')

def precession(jd):
    T = (jd - 2451545.0) / 36525; a = lambda s: math.radians(s / 3600)
    zeta = a(2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3); z = a(2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3)
    th = a(2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3)
    Rz = lambda x: np.array([[math.cos(x), math.sin(x), 0], [-math.sin(x), math.cos(x), 0], [0, 0, 1]])
    Ry = lambda x: np.array([[math.cos(x), 0, -math.sin(x)], [0, 1, 0], [math.sin(x), 0, math.cos(x)]])
    return Rz(-z) @ Ry(th) @ Rz(-zeta)
P1800 = precession(2415020.31352 + (1800 - 1900) * 365.242198781)

def vec(ra, dec):
    ra, dec = np.radians(ra), np.radians(dec)
    return np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], -1)

def load_stars(maglim=6.5):
    S = []
    for r in csv.DictReader(open(HYG, encoding='utf-8')):
        m = float(r['mag'])
        if m <= maglim: S.append((float(r['ra']) * 15, float(r['dec']), m, int(r['hip'] or 0), (r['proper'] or r['bf'] or '').strip()))
    S.sort(key=lambda s: s[2])
    ra = np.array([s[0] for s in S]); de = np.array([s[1] for s in S])
    return {'ra': ra, 'dec': de, 'mag': np.array([s[2] for s in S]), 'hip': np.array([s[3] for s in S]), 'name': [s[4] for s in S],
            'v': vec(ra, de) @ P1800.T}

class Frame:
    """stereographic coordinates (degrees-ish) about centre c; x grows to the east (left on the sky view)"""
    def __init__(self, c):
        c = c / np.linalg.norm(c); self.c = c
        up = np.array([0, 0, 1.0]) if abs(c[2]) < 0.999 else np.array([1.0, 0, 0])
        self.e = np.cross(up, c); self.e /= np.linalg.norm(self.e); self.n = np.cross(c, self.e)
    def xy(self, v):
        d = v @ self.c; k = 2 / (1 + d)
        return np.stack([(v @ self.e) * k, (v @ self.n) * k], -1) * (180 / math.pi)
    def v(self, xy):
        x, y = (xy[..., 0] * math.pi / 180), (xy[..., 1] * math.pi / 180); r2 = x * x + y * y
        s = 4 / (4 + r2)
        return (s * x)[..., None] * self.e + (s * y)[..., None] * self.n + ((4 - r2) / (4 + r2))[..., None] * self.c

def terms(xy, deg):
    x, y = xy[:, 0] / 30, xy[:, 1] / 30
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], 1)

class Model:
    def __init__(self, frame, deg, A):
        self.f, self.deg, self.A = frame, deg, A
    def __call__(self, v):   # J2000->B1800 already applied: v in the 1800 frame
        return terms(self.f.xy(v), self.deg) @ self.A
    @staticmethod
    def fit(frame, v, px, deg, w=None):
        T = terms(frame.xy(v), deg)
        if w is not None: T = T * w[:, None]; px = px * w[:, None]
        A, *_ = np.linalg.lstsq(T, px, rcond=None); return Model(frame, deg, A)
    def to_json(self):
        return {'c': self.f.c.tolist(), 'deg': self.deg, 'A': self.A.tolist()}
    @staticmethod
    def from_json(d):
        return Model(Frame(np.array(d['c'])), d['deg'], np.array(d['A']))

def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r + 0.5

def detect2(img, thr=2.0):
    """isotropic dark blobs (Hessian at sigma 2): star symbols, without points on lines"""
    ink = 255.0 - np.asarray(img, np.float32); s = 2.0
    Hxx = ndi.gaussian_filter(ink, s, order=(0, 2)); Hyy = ndi.gaussian_filter(ink, s, order=(2, 0)); Hxy = ndi.gaussian_filter(ink, s, order=(1, 1))
    tr = Hxx + Hyy; det = Hxx * Hyy - Hxy ** 2; disc = np.sqrt(np.maximum(0, (tr / 2) ** 2 - det))
    blob = -(tr / 2 + disc)
    pk = (blob == ndi.maximum_filter(blob, size=7)) & (blob > thr)
    ys, xs = np.nonzero(pk); b = blob[ys, xs]
    # symbol size: ink mass in a 9x9 window (bright stars are drawn larger)
    mass = ndi.uniform_filter(ndi.gaussian_filter(ink, 1.0), 9)[ys, xs]
    return np.stack([xs, ys, b, mass], 1).astype(np.float64)

def match(P, D, rad):
    """one-to-one nearest matching of projected catalogue points P to detections D[:, :2] within rad"""
    from scipy.spatial import cKDTree
    tree = cKDTree(D[:, :2]); d, j = tree.query(P, distance_upper_bound=rad)
    ok = np.where(np.isfinite(d))[0]; ok = ok[np.argsort(d[ok])]; used = set(); a, b = [], []
    for q in ok:
        if j[q] in used: continue
        used.add(j[q]); a.append(q); b.append(j[q])
    return np.array(a, int), np.array(b, int)

def seed(cat, anchors):
    """similarity transform from two (or more) identified stars: anchors = [(hip, x, y), ...]
    returns an init tuple usable by register2()"""
    hips = list(cat['hip']); V = np.array([cat['v'][hips.index(h)] for h, _, _ in anchors]); X = np.array([[x, y] for _, x, y in anchors], float)
    c = V.sum(0); f = Frame(c); xy = f.xy(V)
    # px = t - s*R(th)*xy  ->  solve complex: z_px = t - s e^{i th} z_xy   (with x mirrored: px = tx - s(x c - y s))
    zx = xy[:, 0] + 1j * xy[:, 1]; zp = X[:, 0] + 1j * X[:, 1]
    # px = tx - s(x cos - y sin); py = ty - s(x sin + y cos) -> zp = t - s e^{i th} zx
    A = np.stack([np.ones(len(zx)), -zx], 1); sol, *_ = np.linalg.lstsq(A, zp, rcond=None)
    t, k = sol; return (len(anchors), float(np.angle(k)), float(abs(k)), float(t.real), float(t.imag), f)

# ---------------------------------------------------------------- conic model
from scipy.optimize import least_squares
def radec1800(v):
    return np.degrees(np.arctan2(v[..., 1], v[..., 0])), np.degrees(np.arcsin(np.clip(v[..., 2], -1, 1)))

class Conic:
    """pixel = apex + r(dec) * (sin(phi), cos(phi)), phi = a + k * dRA; r(dec) cubic in (dec - dc).
    An optional residual correction (cubic polynomial in normalised pixel coordinates) follows."""
    def __init__(self, p, rac, dc, corr=None, W=3200, H=2300, cdeg=4, g=None):
        self.p, self.rac, self.dc, self.corr, self.W, self.H, self.cdeg, self.g = np.asarray(p, float), rac, dc, corr, W, H, cdeg, g
    @staticmethod
    def raw(p, ra, de, rac, dc):
        x0, y0, a, k, c0, c1, c2, c3 = p
        dra = np.radians(((ra - rac + 180) % 360) - 180); d = (de - dc) / 30
        r = c0 + c1 * d + c2 * d * d + c3 * d ** 3; phi = a + k * dra
        return np.stack([x0 + r * np.sin(phi), y0 + r * np.cos(phi)], -1)
    def cterms(self, P):
        x, y = P[:, 0] / self.W * 2 - 1, P[:, 1] / self.H * 2 - 1
        T = [x ** i * y ** j for i in range(self.cdeg + 1) for j in range(self.cdeg + 1 - i)]
        if self.g is not None:   # paper curving into the binding: compression growing towards the gutter
            u = np.abs(P[:, 0] - self.g) / self.W
            for L in (0.015, 0.04, 0.1):
                e = np.exp(-u / L); T += [e, e * y, e * y * y]
        return np.stack(T, 1)
    def __call__(self, v):
        ra, de = radec1800(v); P = Conic.raw(self.p, ra, de, self.rac, self.dc)
        if self.corr is not None: P = P + self.cterms(P) @ self.corr
        return P
    def to_json(self):
        return {'type': 'conic', 'p': self.p.tolist(), 'rac': self.rac, 'dc': self.dc, 'corr': None if self.corr is None else self.corr.tolist(), 'W': self.W, 'H': self.H, 'cdeg': self.cdeg, 'g': self.g}
    @staticmethod
    def from_json(d):
        return Conic(d['p'], d['rac'], d['dc'], None if d['corr'] is None else np.array(d['corr']), d['W'], d['H'], d.get('cdeg', 3), d.get('g'))

def fit_conic(v, px, init, rac, dc, W, H, corr=False, lam=2.0, kfix=None, g=None, w=None):
    ra, de = radec1800(v)
    sw = np.ones(len(px)) if w is None else np.sqrt(w)
    if kfix is None:
        res = lambda p: ((Conic.raw(p, ra, de, rac, dc) - px) * sw[:, None]).ravel()
        sol = least_squares(res, init, loss='soft_l1', f_scale=3.0, max_nfev=4000); p = sol.x
    else:   # azimuthal plate (pole on the plate): the cone constant is exactly +-1
        full = lambda q: np.concatenate([q[:3], [kfix], q[3:]])
        res = lambda q: ((Conic.raw(full(q), ra, de, rac, dc) - px) * sw[:, None]).ravel()
        q0 = np.concatenate([np.asarray(init[:3]), np.asarray(init[4:])])
        sol = least_squares(res, q0, loss='soft_l1', f_scale=3.0, max_nfev=4000); p = full(sol.x)
    sol.x = p
    m = Conic(sol.x, rac, dc, None, W, H, g=g)
    if corr:
        P = Conic.raw(sol.x, ra, de, rac, dc); T = m.cterms(P); R = px - P; w0 = sw ** 2; w = w0.copy()
        for _ in range(5):
            Tw = T * w[:, None]; A = Tw.T @ T + lam * np.eye(T.shape[1]); m.corr = np.linalg.solve(A, Tw.T @ R)
            e = np.linalg.norm(R - T @ m.corr, axis=1); w = w0 / np.maximum(1, e / 3.0)
    return m

def conic_init(model, cat_v_center, W, H):
    """initial conic parameters from a (locally good) polynomial model, using points near the centre"""
    ra_c, dc = radec1800(cat_v_center)
    grid = [(ra_c + dr, dc + dd) for dr in (-12, -6, 0, 6, 12) for dd in (-10, -5, 0, 5, 10)]
    G = np.array(grid); V = vec(G[:, 0], G[:, 1])        # already in the 1800 frame
    P = model(V)
    # apex: intersection of the meridians ra_c-12 and ra_c+12
    def line(dr):
        idx = [i for i, g in enumerate(grid) if g[0] == ra_c + dr]; Q = P[idx]
        return Q[0], Q[-1] - Q[0]
    (p1, d1), (p2, d2) = line(-12), line(12)
    A = np.array([d1, -d2]).T; t = np.linalg.solve(A, p2 - p1); apex = p1 + t[0] * d1
    ang = lambda q: math.atan2(q[0] - apex[0], q[1] - apex[1])
    k = (ang(P[grid.index((ra_c + 12, dc))]) - ang(P[grid.index((ra_c - 12, dc))])) / math.radians(24)
    a = ang(P[grid.index((ra_c, dc))])
    rr = [np.linalg.norm(P[grid.index((ra_c, dc + dd))] - apex) for dd in (-10, 0, 10)]
    c0 = rr[1]; c1 = (rr[2] - rr[0]) / 2 * 3 / 10 * 10   # per (30 deg) unit
    c1 = (rr[2] - rr[0]) / (20 / 30)
    return [apex[0], apex[1], a, k, c0, c1, 0.0, 0.0], ra_c, dc

class Plate:
    """two pages of a plate, split at the gutter g"""
    def __init__(self, g, L, R): self.g, self.L, self.R = g, L, R
    def __call__(self, v):
        """pixel position and page (True = left); points that fall into the gutter of both pages get NaN"""
        PL, PR = self.L(v), self.R(v); g = self.g
        inL, inR = PL[:, 0] < g, PR[:, 0] >= g
        both = inL & inR
        useL = inL & (~both | ((g - PL[:, 0]) > (PR[:, 0] - g)))
        P = np.where(useL[:, None], PL, PR)
        P[~inL & ~inR] = np.nan
        return P, useL
    def to_json(self): return {'g': self.g, 'L': self.L.to_json(), 'R': self.R.to_json()}
    @staticmethod
    def from_json(d): return Plate(d['g'], model_from_json(d['L']), model_from_json(d['R']))

def coherent_match(P, D, R, tol, nb=350.0, binw=3.0):
    """P: predicted positions (n,2); D: detections. For each star pick the detection whose offset agrees with
    the dominant offset among neighbouring stars. Returns (idx_star, idx_det)."""
    from scipy.spatial import cKDTree
    td = cKDTree(D[:, :2]); cand = td.query_ball_point(P, R)
    offs = [D[c, :2] - P[i] if len(c) else np.zeros((0, 2)) for i, c in enumerate(cand)]
    tp = cKDTree(P); nbrs = tp.query_ball_point(P, nb)
    nb_ = int(2 * R / binw) + 1; si, dj = [], []
    for i in range(len(P)):
        if not len(cand[i]): continue
        allo = np.concatenate([offs[j] for j in nbrs[i] if len(offs[j])])
        h, ex, ey = np.histogram2d(allo[:, 0], allo[:, 1], bins=nb_, range=[[-R, R], [-R, R]])
        h = ndi.uniform_filter(h, 3, mode='constant')
        a, b = np.unravel_index(np.argmax(h), h.shape); o = np.array([(ex[a] + ex[a + 1]) / 2, (ey[b] + ey[b + 1]) / 2])
        e = np.linalg.norm(offs[i] - o, axis=1); k = np.argmin(e)
        if e[k] < tol: si.append(i); dj.append(cand[i][k])
    si, dj = np.array(si, int), np.array(dj, int)
    # one detection per star
    if len(dj):
        _, first = np.unique(dj, return_index=True); si, dj = si[first], dj[first]
    return si, dj

def register2(D, cat, anchors, W, H, xr=None, verbose=True, g=None):
    x0, x1 = xr if xr is not None else (0, W)
    D = D[(D[:, 0] >= x0 - 10) & (D[:, 0] < x1 + 10)]
    snapped = []
    for h, x, y in anchors:   # snap the hand-picked position to the strongest symbol within 15 px
        dd = np.hypot(D[:, 0] - x, D[:, 1] - y); k = np.where(dd < 24)[0]
        if len(k): j = k[np.argmax(D[k, 3])]; snapped.append((h, D[j, 0], D[j, 1]))
        else: snapped.append((h, x, y))
    anchors = snapped
    b = seed(cat, anchors); th, s, tx, ty, f = b[1], b[2], b[3], b[4], b[5]
    c, s_ = math.cos(th), math.sin(th); xy = f.xy(cat['v'])
    P = np.stack([tx - s * (xy[:, 0] * c - xy[:, 1] * s_), ty - s * (xy[:, 0] * s_ + xy[:, 1] * c)], 1)
    hips = list(cat['hip']); ai = np.array([hips.index(h) for h, _, _ in anchors]); ap = np.array([[x, y] for _, x, y in anchors], float)
    vis = cat['v'] @ f.c > 0.6   # within ~53 deg of the anchors: polynomials fold far-away stars back into the page
    model = None; conic = None; polypath = None
    stages = ((4.5, 70, 10, 'p2'), (5.0, 35, 7, 'p3'), (5.5, 20, 5, 'c'), (6.0, 12, 4, 'cc'), (5.5, 45, 6, 'cc'), (5.5, 45, 6, 'cc'), (6.0, 25, 5, 'cc'), (6.5, 12, 4, 'cc'), (6.5, 8, 3.5, 'cc'), (6.5, 7, 3.5, 'cc'))
    for mlim, R, tol, kind in stages:
        ins = (P[:, 0] > x0 - 5) & (P[:, 0] < x1 + 5) & (P[:, 1] > 0) & (P[:, 1] < H)
        sel = np.where((cat['mag'] <= mlim) & vis & ins)[0]
        a, j = coherent_match(P[sel], D, R, tol)
        if kind in ('p2', 'p3', 'c'): keep = np.ones(len(ai), bool); rep = 4
        else: keep = np.linalg.norm(P[ai] - ap, axis=1) < 12; rep = 3   # hand-checked anchors stay, unless clearly wrong
        si = np.concatenate([sel[a], np.repeat(ai[keep], rep)]); px = np.concatenate([D[j, :2], np.repeat(ap[keep], rep, 0)])
        V = cat['v'][si]
        if kind in ('p2', 'p3'):
            model = Model.fit(f, V, px, 2 if kind == 'p2' else 3); P = model(cat['v'])
        else:
            if conic is None and polypath is None:
                p0, rac, dc = conic_init(model, f.c, W, H)
                polypath = abs(p0[3]) > 3 or abs(p0[1] - H / 2) > 6 * H or abs(p0[0] - W / 2) > 6 * W
                if verbose and polypath: print(f'  near-parallel meridians (apex {p0[0]:.0f},{p0[1]:.0f}): polynomial model')
            if polypath:
                wt = 1 + 2.0 * np.clip(6.0 - cat['mag'][si], 0, 5)
                conic = fit_polyg(f, V, px, 3 if kind == 'c' else 4, W, H, g=g, w=wt, corr=kind == 'cc'); P = conic(cat['v'])
            elif conic is None:
                polar = abs(p0[3]) > 0.8 and 0 < p0[0] < W and 0 < p0[1] < H
                kfix = float(np.sign(p0[3])) if polar else None
                if verbose: print(f'  conic init: apex ({p0[0]:.0f},{p0[1]:.0f}) k={p0[3]:.3f} polar={polar}')
                # first fit the conic to the smooth polynomial model over the page (no outliers), then to the stars
                gv = cat['v'][(cat['mag'] <= 6.5) & vis & ins]; gp = model(gv)
                conic = fit_conic(gv, gp, p0, rac, dc, W, H, False, kfix=kfix, g=g)
                conic = fit_conic(V, px, conic.p, rac, dc, W, H, False, kfix=kfix, g=g)
            if not polypath:
                wt = 1 + 2.0 * np.clip(6.0 - cat['mag'][si], 0, 5)
                conic = fit_conic(V, px, conic.p, conic.rac, conic.dc, W, H, kind == 'cc', kfix=kfix, g=g, w=wt); P = conic(cat['v'])
        r = np.linalg.norm(P[sel[a]] - D[j, :2], axis=1); ra = np.linalg.norm(P[ai] - ap, axis=1)
        if verbose: print(f'  {kind} mag<={mlim} R={R}: {len(a)} matches, median {np.median(r):.2f}px, rms {np.sqrt(np.mean(r**2)):.2f}px, anchors max {ra.max():.1f}px')
    return conic

def register_from(D, cat, init, W, H, xr, g=None, verbose=True):
    """register a page starting from another page's conic model (same projection, small offset)"""
    x0, x1 = xr; D = D[(D[:, 0] >= x0 - 10) & (D[:, 0] < x1 + 10)]
    poly = isinstance(init, PolyG)
    if poly: conic = PolyG(init.f, init.deg, init.A.copy(), None, W, H, g=g)
    else: conic = Conic(init.p.copy(), init.rac, init.dc, None, W, H, g=g)
    P = conic(cat['v'])
    kfix = None if poly else (float(np.sign(init.p[3])) if abs(abs(init.p[3]) - 1) < 1e-9 else None)
    stages = ((4.5, 90, 10, 'c'), (5.0, 50, 7, 'c'), (5.5, 30, 6, 'cc'), (5.5, 45, 6, 'cc'), (6.0, 25, 5, 'cc'), (6.5, 12, 4, 'cc'), (6.5, 8, 3.5, 'cc'), (6.5, 7, 3.5, 'cc'))
    for mlim, R, tol, kind in stages:
        ins = (P[:, 0] > x0 - 5) & (P[:, 0] < x1 + 5) & (P[:, 1] > 0) & (P[:, 1] < H)
        sel = np.where((cat['mag'] <= mlim) & ins)[0]
        a, j = coherent_match(P[sel], D, R, tol)
        wt = 1 + 2.0 * np.clip(6.0 - cat['mag'][sel[a]], 0, 5)
        if poly: conic = fit_polyg(init.f, cat['v'][sel[a]], D[j, :2], 3 if kind == 'c' else 4, W, H, g=g, w=wt, corr=kind == 'cc')
        else: conic = fit_conic(cat['v'][sel[a]], D[j, :2], conic.p, conic.rac, conic.dc, W, H, kind == 'cc', kfix=kfix, g=g, w=wt)
        P = conic(cat['v'])
        r = np.linalg.norm(P[sel[a]] - D[j, :2], axis=1)
        if verbose: print(f'  {kind} mag<={mlim} R={R}: {len(a)} matches, median {np.median(r):.2f}px, rms {np.sqrt(np.mean(r**2)):.2f}px')
    return conic


class PolyG(Conic):
    """polynomial in stereographic coordinates about the plate centre, plus the same pixel-space corrections as Conic
    (used for equatorial plates, where the meridians are almost parallel and the cone model degenerates)"""
    def __init__(self, frame, deg, A, corr=None, W=3200, H=2300, cdeg=4, g=None):
        self.f, self.deg, self.A = frame, deg, np.asarray(A, float)
        self.corr, self.W, self.H, self.cdeg, self.g = corr, W, H, cdeg, g
        self.p = np.array([0.0, 0, 0, 0])   # not a cone
    def base(self, v): return terms(self.f.xy(v), self.deg) @ self.A
    def __call__(self, v):
        P = self.base(v)
        if self.corr is not None: P = P + self.cterms(P) @ self.corr
        return P
    def to_json(self):
        return {'type': 'poly', 'c': self.f.c.tolist(), 'deg': self.deg, 'A': self.A.tolist(), 'corr': None if self.corr is None else self.corr.tolist(),
                'W': self.W, 'H': self.H, 'cdeg': self.cdeg, 'g': self.g}

def fit_polyg(f, v, px, deg, W, H, g=None, w=None, corr=True, lam=2.0):
    T = terms(f.xy(v), deg); sw = np.ones(len(px)) if w is None else np.sqrt(w); r = np.ones(len(px))
    for _ in range(4):   # robust (reweighted) least squares
        ww = sw * r; A, *_ = np.linalg.lstsq(T * ww[:, None], px * ww[:, None], rcond=None)
        e = np.linalg.norm(T @ A - px, axis=1); r = 1 / np.sqrt(np.maximum(1, e / 3.0))
    m = PolyG(f, deg, A, None, W, H, g=g)
    if corr:
        P = m.base(v); C = m.cterms(P); R = px - P; w0 = sw ** 2; ww = w0.copy()
        for _ in range(5):
            Cw = C * ww[:, None]; M = Cw.T @ C + lam * np.eye(C.shape[1]); m.corr = np.linalg.solve(M, Cw.T @ R)
            e = np.linalg.norm(R - C @ m.corr, axis=1); ww = w0 / np.maximum(1, e / 3.0)
    return m

def model_from_json(d):
    if d.get('type') == 'poly':
        return PolyG(Frame(np.array(d['c'])), d['deg'], np.array(d['A']), None if d['corr'] is None else np.array(d['corr']), d['W'], d['H'], d.get('cdeg', 4), d.get('g'))
    return Conic.from_json(d)


# ---------------------------------------------------------------- chart frame
def _border_curve(dark, axis, lo, hi, inner_is_max, nseg=20, tol=4.0):
    """one side of the chequered border: axis=1 vertical side (x as a function of y), axis=0 horizontal side.
    Each strip along the side gives candidate dark bands; the quadratic through three strips that most strips agree
    on is the border (it runs along the whole side, unlike the ecliptic or a label); of equally good ones, the
    innermost. Returns [a, b, c] with position = a + b*s + c*s^2, or None."""
    D = dark if axis == 1 else dark.T
    H = D.shape[0]
    cand = []
    for k in range(nseg):
        y0 = int(H * (0.10 + 0.80 * k / nseg)); y1 = int(H * (0.10 + 0.80 * (k + 1) / nseg))
        prof = ndi.uniform_filter1d(D[y0:y1, lo:hi].mean(0), 9)
        pk = np.where((prof >= 0.5 * prof.max()) & (prof == ndi.maximum_filter1d(prof, 7)))[0] if prof.max() >= 0.12 else []
        cand.append(((y0 + y1) / 2, np.asarray(pk, float) + lo))
    ys = np.array([c[0] for c in cand]); nz = [i for i, c in enumerate(cand) if len(c[1])]
    if len(nz) < 6: return None
    def support(coef):
        hit = []
        for (y, xs), p in zip(cand, np.polyval(coef, ys)):
            if len(xs):
                j = np.abs(xs - p).argmin()
                if abs(xs[j] - p) < tol: hit.append((y, xs[j]))
        return hit
    rng = np.random.default_rng(0); found = []
    for _ in range(4000):
        q3 = sorted(rng.choice(nz, 3, replace=False))
        pts = [(cand[q][0], rng.choice(cand[q][1])) for q in q3]
        coef = np.polyfit([p[0] for p in pts], [p[1] for p in pts], 2)
        if abs(np.polyval(np.polyder(coef), ys)).max() > 0.12: continue
        hit = support(coef)
        if len(hit) >= 6: found.append((len(hit), float(np.polyval(coef, ys).mean()), hit))
    if not found: return None
    best = max(f[0] for f in found); good = [f for f in found if f[0] >= 0.85 * best]
    P = np.array((max if inner_is_max else min)(good, key=lambda f: f[1])[2])
    c = np.polyfit(P[:, 0], P[:, 1], 2 if len(P) >= 8 else 1)
    c = np.concatenate([np.zeros(3 - len(c)), c])
    return [float(c[2]), float(c[1]), float(c[0])]

def chart_frame(img):
    """the four sides of the engraved chart frame (centre of the chequered band) in a plate scan"""
    a = np.asarray(img.convert('L') if hasattr(img, 'convert') else img, np.float32); H, W = a.shape
    paper = ndi.binary_erosion(ndi.median_filter(a[::4, ::4], 9) > 150, iterations=3)
    paper = np.kron(paper, np.ones((4, 4), bool))[:H, :W]
    dark = ((a < 110) & paper).astype(np.float32)
    return {'L': _border_curve(dark, 1, 40, 420, True), 'R': _border_curve(dark, 1, W - 420, W - 30, False),
            'T': _border_curve(dark, 0, 20, 360, True), 'B': _border_curve(dark, 0, H - 400, H - 15, False)}

def frame_mask(fr, W, H, inset=32, scale=1):
    """pixels inside the frame, `inset` px clear of the band centre (the degree scale lies just inside the band);
    a side that was not found does not limit the mask. scale=4 gives the mask at quarter resolution."""
    y, x = np.mgrid[0:H // scale, 0:W // scale] * scale
    m = np.ones(y.shape, bool)
    for k, sgn in (('L', 1), ('R', -1), ('T', 1), ('B', -1)):
        c = fr.get(k)
        if c is None: continue
        s, q = (y, x) if k in 'LR' else (x, y)
        m &= sgn * (q - (c[0] + c[1] * s + c[2] * s * s)) > inset
    return m
