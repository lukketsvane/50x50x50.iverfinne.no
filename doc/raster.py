# -*- coding: utf-8 -*-
"""
SANDKASSE — rasterisatoren.

Mappa skal ha 3D-bilete i same stilen som dei tidlegare mappene i serien,
og dei skal kunne byggjast på kva som helst maskin, i eit byggjesteg
utan skjerm. Difor ligg heile biletkjeda her inne — projeksjon, z-buffer,
skuggekart, omgjevingsokklusjon, nedskalering — i rein numpy. Ingen GPU,
ingen OpenGL, ingen trimesh, ingen pyrender.

Kjeda per bilete:

  1  trekantane inn i kamerarommet og ned på eit ss× forstørra rutenett
  2  z-buffer, med hjørnenormalane barysentrisk interpolerte per piksel
  3  eit eige djupnepass sett frå lyset            → skuggekart
  4  halvkulesampling over djupnebufferet          → omgjevingsokklusjon
  5  utsett skuggelegging, bandvis over biletet    → bunde minnebruk
  6  boksnedskalering ss×ss                        → antialiasinga

Aksane er dei same som i lib/skal: X fram, Y sideveg, Z opp, alt i
millimeter. Fargar inn og ut er sRGB, men sjølve lysreknestykket går i
lineært rom; gjer ein det i sRGB vert okklusjon og skugge altfor mørke.

Det viktigaste visuelle trekket ved objektet er at det er stabla. To ting
ber det: okklusjonen, som gjer at ei trapp av lag les som djupn og ikkje
som eit mønster, og `stripes`, som legg ei tynn mørk stripe i kvar limfug.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

# Lyset er verdsfast og ikkje kamerafast: eit sett med oppriss og
# perspektiv av same objektet skal lesast som same lyssettinga.
LIGHT = (0.32, 0.62, 0.72)          # retninga MOT lyskjelda, verdskoordinat
WOOD = (0.90, 0.87, 0.81)           # bjørk under kvitpigmentert olje

# Vektene summerer seg til om lag 1 på den best opplyste flata, slik at
# materialfargen kjem ut att som seg sjølv der og ingen ting klipper.
W_KEY = 0.66
W_AMB = 0.26
W_FILL = (0.10, 0.07)
W_SPEC = 0.05
SPEC_EXP = 26.0

# Kor stor del av lyset golvet misser i full skugge, per kanal. Blått vert
# minst borte, for det som når inn i ein slagskugge er himmellys — ein heilt
# nøytralt grå skugge ser død ut ved sida av eit varmt materiale.
SHADOW_LOSS = (0.560, 0.555, 0.527)

_EPS = 1e-12


# =============================================================================
# SMÅTT
# =============================================================================
def _v3(v) -> np.ndarray:
    return np.asarray(v, dtype=np.float64).reshape(3)


def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n > _EPS else np.array([0.0, 0.0, 1.0])


def _smoothstep(x):
    t = np.clip(x, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def srgb_to_lin(c):
    """sRGB → lineært lys. Kurva er den ekte, ikkje gamma 2.2, for elles
    driv dei mørke tonane bort frå det ein ser i ein biletredigerar."""
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1.0 / 2.4) - 0.055)


# =============================================================================
# KAMERA
# =============================================================================
@dataclass(frozen=True)
class Camera:
    """`ortho_scale` er verdsbreidda den KORTE biletsida dekkjer, og `fov_deg`
    opnar likeins over den korte sida. Det er ikkje konvensjonen (som er den
    loddrette sida), men det er den einaste varianten der same innramminga
    held både for eit ståande og eit liggjande utsnitt — og mappa har begge."""
    eye: tuple[float, float, float]
    target: tuple[float, float, float]
    up: tuple[float, float, float] = (0.0, 0.0, 1.0)
    fov_deg: float = 28.0
    ortho_scale: float = 0.0
    ortho: bool = False


def look(azimuth_deg: float, elevation_deg: float, distance: float,
         target=(0.0, 0.0, 0.0), ortho: bool = False, fov: float = 28.0,
         ortho_scale: float | None = None,
         up=(0.0, 0.0, 1.0)) -> Camera:
    """Kamera på ei kule kring `target`. Asimut 0 er +X (framover), og veks
    mot +Y; elevasjon er over golvplanet."""
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    t = _v3(target)
    d = np.array([math.cos(el) * math.cos(az),
                  math.cos(el) * math.sin(az),
                  math.sin(el)])
    eye = t + d * float(distance)
    # Rett over eller rett under fell verdsoppen saman med synsretninga.
    # Då let vi biletoppen peike bort frå kameraet, slik at ein plan får
    # framsida ned mot arkkanten slik plan pleier å ha det.
    u = _v3(up)
    if abs(float(np.dot(_unit(-d), _unit(u)))) > 0.9995:
        u = np.array([-math.cos(az), -math.sin(az), 0.0])
    if ortho_scale is None:
        # Same innramming som perspektivet ville gjeve i same avstand,
        # slik at ein kan slå om ortho utan å måtte finne skalaen på nytt.
        ortho_scale = 2.0 * float(distance) * math.tan(math.radians(fov) / 2.0)
    return Camera(eye=tuple(float(x) for x in eye),
                  target=tuple(float(x) for x in t),
                  up=tuple(float(x) for x in u),
                  fov_deg=float(fov), ortho_scale=float(ortho_scale),
                  ortho=bool(ortho))


class _View:
    """Kameraet gjort om til rekneform: ortonormal basis pluss projeksjon
    ned på eit rutenett av W×H pikslar. Djupna `z` er avstanden langs
    synsaksen, positiv framover, slik at z-bufferet kan samanliknast direkte."""

    def __init__(self, cam: Camera, w: int, h: int):
        self.w, self.h = int(w), int(h)
        self.eye = _v3(cam.eye)
        self.f = _unit(_v3(cam.target) - self.eye)
        r = np.cross(self.f, _v3(cam.up))
        if float(np.linalg.norm(r)) < 1e-9:      # skal ikkje skje etter look()
            r = np.cross(self.f, np.array([1.0, 0.0, 0.0]))
        self.r = _unit(r)
        self.u = np.cross(self.r, self.f)
        self.ortho = bool(cam.ortho)
        m = float(min(self.w, self.h))
        self.kx = self.w / m                     # den korte sida er eininga
        self.ky = self.h / m
        self.t = math.tan(math.radians(cam.fov_deg) / 2.0)
        self.hx = 0.5 * cam.ortho_scale * self.kx
        self.hy = 0.5 * cam.ortho_scale * self.ky
        self.basis = np.stack([self.r, self.u, self.f], axis=1)  # (3,3)

    # -- verd → kamera ------------------------------------------------------
    def to_view(self, p: np.ndarray) -> np.ndarray:
        return (p - self.eye) @ self.basis

    def dir_to_view(self, d: np.ndarray) -> np.ndarray:
        return d @ self.basis

    # -- kamera → piksel ----------------------------------------------------
    def project(self, v: np.ndarray):
        x, y, z = v[..., 0], v[..., 1], v[..., 2]
        if self.ortho:
            nx = x / self.hx
            ny = y / self.hy
        else:
            zz = np.maximum(z, 1e-6)
            nx = x / (self.t * zz * self.kx)
            ny = y / (self.t * zz * self.ky)
        return (nx * 0.5 + 0.5) * self.w, (0.5 - ny * 0.5) * self.h

    # -- piksel + djupn → kamera -------------------------------------------
    def unproject(self, px, py, z):
        nx = px / self.w * 2.0 - 1.0
        ny = 1.0 - py / self.h * 2.0
        if self.ortho:
            return nx * self.hx, ny * self.hy
        return nx * (self.t * self.kx) * z, ny * (self.t * self.ky) * z

    def to_world(self, xv, yv, zv):
        return (self.eye[None, :] + xv[:, None] * self.r[None, :]
                + yv[:, None] * self.u[None, :] + zv[:, None] * self.f[None, :])


# =============================================================================
# Z-BUFFER
# =============================================================================
def _rasterize(sx, sy, zc, view: _View, attrs=None, near: float = 0.0):
    """Ei lykkje over trekantane, men alt inne i henne er numpy: kvar trekant
    vert fylt over si eiga avgrensingsboks med kantfunksjonar.

    Kantfunksjonane er separable — kvart ledd er anten berre ein funksjon av
    kolonna eller berre av rada — så dei to todimensjonale mellomlagra er alt
    som vert allokert per trekant. Koordinatane vert flytte til hjørnet av
    boksen fyrst; utan det taper differansen av to store produkt presisjon for
    små trekantar langt ute i biletet.

    Returnerer (zbuf, abuf) flate: (H*W,) og (H*W,K).
    """
    W, H = view.w, view.h
    n = sx.shape[0]
    zf = np.full(W * H, np.inf, dtype=np.float32)
    K = 0 if attrs is None else attrs.shape[2]
    af = np.zeros((W * H, K), dtype=np.float32) if K else None
    if n == 0:
        return zf, af

    minx, maxx = sx.min(1), sx.max(1)
    miny, maxy = sy.min(1), sy.max(1)
    ok = (maxx >= 0.0) & (minx <= W) & (maxy >= 0.0) & (miny <= H)
    if not view.ortho:
        # Ingen klipping mot nærplanet: ein trekant som stikk bak kameraet
        # vert forkasta heilt. Det held så lenge kameraet står utanfor
        # objektet, og feilmoden — eit hòl i biletet — er tydeleg om det ikkje.
        ok &= zc.min(1) > near
    ar = ((sx[:, 1] - sx[:, 0]) * (sy[:, 2] - sy[:, 0])
          - (sx[:, 2] - sx[:, 0]) * (sy[:, 1] - sy[:, 0]))
    ok &= np.abs(ar) > 1e-9
    idx = np.flatnonzero(ok)
    if idx.size == 0:
        return zf, af

    bx0 = np.clip(np.floor(minx[idx]), 0, W - 1).astype(np.int64)
    bx1 = np.clip(np.ceil(maxx[idx]), 0, W - 1).astype(np.int64)
    by0 = np.clip(np.floor(miny[idx]), 0, H - 1).astype(np.int64)
    by1 = np.clip(np.ceil(maxy[idx]), 0, H - 1).astype(np.int64)

    # Python-flyttal er raskare å plukke ut enn numpy-skalarar, og lykkja
    # er overheaddriven når trekantane er små — som dei er ved 100k+.
    xs_l = sx[idx].tolist()
    ys_l = sy[idx].tolist()
    zs_l = zc[idx].tolist()
    iw_l = (1.0 / np.maximum(zc[idx], 1e-9)).tolist()
    inv_l = (1.0 / ar[idx]).tolist()
    bx0_l, bx1_l = bx0.tolist(), bx1.tolist()
    by0_l, by1_l = by0.tolist(), by1.tolist()
    idx_l = idx.tolist()
    ortho = view.ortho

    for t in range(idx.size):
        ax0, ax1 = bx0_l[t], bx1_l[t]
        ay0, ay1 = by0_l[t], by1_l[t]
        x0, x1, x2 = xs_l[t]
        y0, y1, y2 = ys_l[t]
        inv = inv_l[t]
        # flytt til boksehjørnet
        x0 -= ax0
        x1 -= ax0
        x2 -= ax0
        y0 -= ay0
        y1 -= ay0
        y2 -= ay0
        px = np.arange(0, ax1 - ax0 + 1, dtype=np.float64) + 0.5
        py = np.arange(0, ay1 - ay0 + 1, dtype=np.float64) + 0.5
        w0 = ((x2 - x1) * (py - y1))[:, None] - ((y2 - y1) * (px - x1))[None, :]
        w1 = ((x0 - x2) * (py - y2))[:, None] - ((y0 - y2) * (px - x2))[None, :]
        w0 *= inv
        w1 *= inv
        # inv ber teiknet på arealet, så testen held for begge vindingar
        m = (w0 >= 0.0) & (w1 >= 0.0) & ((w0 + w1) <= 1.0)
        yy, xx = np.nonzero(m)
        if yy.size == 0:
            continue
        b0 = w0[yy, xx]
        b1 = w1[yy, xx]
        b2 = 1.0 - b0 - b1

        if ortho:
            q0, q1, q2 = zs_l[t]
            z = b0 * q0 + b1 * q1 + b2 * q2
        else:
            # perspektivriktig: interpoler 1/z lineært i biletplanet
            i0, i1, i2 = iw_l[t]
            z = 1.0 / (b0 * i0 + b1 * i1 + b2 * i2)

        lin = (yy + ay0) * W + (xx + ax0)
        keep = z < zf[lin]
        if not keep.any():
            continue
        lin = lin[keep]
        z = z[keep]
        zf[lin] = z
        if K:
            b0, b1, b2 = b0[keep], b1[keep], b2[keep]
            A = attrs[idx_l[t]]
            if ortho:
                av = (b0[:, None] * A[0] + b1[:, None] * A[1]
                      + b2[:, None] * A[2])
            else:
                av = ((b0 * i0)[:, None] * A[0] + (b1 * i1)[:, None] * A[1]
                      + (b2 * i2)[:, None] * A[2]) * z[:, None]
            af[lin] = av
    return zf, af


# =============================================================================
# SKUGGEKART
# =============================================================================
class _Shadow:
    """Djupna sett frå lyset, rendra ortografisk over den omsluttande kula
    til objektet. Berre kastarane treng vera med: alt som fell utanfor kartet
    vert rekna som opplyst, og golvet slepp difor å vera med i passet."""

    def __init__(self, tris, ldir, ctr, rad, res=2048):
        eye = ctr + _unit(ldir) * (rad * 3.0)
        up = np.array([0.0, 0.0, 1.0])
        if abs(float(np.dot(_unit(ctr - eye), up))) > 0.9995:
            up = np.array([0.0, 1.0, 0.0])
        cam = Camera(eye=tuple(eye), target=tuple(ctr), up=tuple(up),
                     ortho_scale=2.0 * rad * 1.06, ortho=True)
        self.view = _View(cam, res, res)
        self.res = res
        v = self.view.to_view(tris.reshape(-1, 3)).reshape(-1, 3, 3)
        sx, sy = self.view.project(v)
        self.depth, _ = _rasterize(np.ascontiguousarray(sx),
                                   np.ascontiguousarray(sy),
                                   np.ascontiguousarray(v[..., 2]), self.view)
        self.depth = self.depth.reshape(res, res)
        self.texel = 2.0 * rad * 1.06 / res
        # Normaloffset i staden for berre djupneslark: det er det einaste
        # som held akne borte på ei flate som ligg nær parallelt med lyset,
        # og 1.7 tekslar er langt mindre enn ei finértjukn, så limfugene
        # vert ikkje smurde ut.
        self.noff = 1.7 * self.texel
        self.bias = 1.2 * self.texel

        # Kor på golvet skuggen i det heile kan liggje: kastarkula skoven
        # ned langs lyset. Golvet er millionar av pikslar og dei aller
        # fleste ligg utanfor — utan denne sirkelen kostar dei like mykje
        # som dei få som faktisk står i skugge.
        lz = float(_unit(ldir)[2])
        if lz > 1e-3:
            k = float(ctr[2]) / lz
            self.disc = (float(ctr[0]) - float(ldir[0]) * k,
                         float(ctr[1]) - float(ldir[1]) * k,
                         rad * (1.0 + math.hypot(ldir[0], ldir[1]) / lz))
        else:
            self.disc = (0.0, 0.0, 0.0)     # lys i horisonten kastar ikkje golvskugge

    def _vis(self, x, y, z):
        """PCF over 3×3 tekslar. Mjukare enn eitt oppslag, men framleis éin
        hard skugge — ingen kontaktflekk, ingen halvskugge.

        Komponentvis på x, y, z og ikkje på ei (n,3)-matrise: for golvet er
        n i millionar, og ei full punktmatrise med matriseprodukt er rein
        minnetrafikk. z kan vera ein skalar, som han er for eit plan."""
        e, B, R = self.view.eye, self.view.basis, self.res
        dx, dy, dz = x - e[0], y - e[1], z - e[2]
        vx = dx * B[0, 0] + dy * B[1, 0] + dz * B[2, 0]
        vy = dx * B[0, 1] + dy * B[1, 1] + dz * B[2, 1]
        vz = dx * B[0, 2] + dy * B[1, 2] + dz * B[2, 2]
        px = (vx / self.view.hx * 0.5 + 0.5) * R
        py = (0.5 - vy / self.view.hy * 0.5) * R
        ix = np.floor(px).astype(np.int32)
        iy = np.floor(py).astype(np.int32)
        vis = np.ones(np.broadcast(ix, iy).shape, dtype=np.float32)
        # utanfor kartet finst ingen kastar
        sel = np.flatnonzero(((ix >= 0) & (ix < R) & (iy >= 0) & (iy < R)).ravel())
        if sel.size == 0:
            return vis
        jx0, jy0 = ix.ravel()[sel], iy.ravel()[sel]
        zl = np.broadcast_to(np.asarray(vz, dtype=np.float32),
                             vis.shape).ravel()[sel] - self.bias
        acc = np.zeros(sel.size, dtype=np.float32)
        for oy in (-1, 0, 1):
            jy = np.clip(jy0 + oy, 0, R - 1)
            for ox in (-1, 0, 1):
                acc += self.depth[jy, np.clip(jx0 + ox, 0, R - 1)] >= zl
        vis.ravel()[sel] = acc * (1.0 / 9.0)
        return vis

    def visible(self, p, nrm):
        return self._vis(p[:, 0] + nrm[:, 0] * self.noff,
                         p[:, 1] + nrm[:, 1] * self.noff,
                         p[:, 2] + nrm[:, 2] * self.noff)

    def visible_ground(self, x, y):
        """Golvet: normalen er +Z overalt, så offsetten er ein skalar."""
        return self._vis(x, y, self.noff)


# =============================================================================
# OMGJEVINGSOKKLUSJON
# =============================================================================
def _ssao(zbuf, nrm_w, view_lo: _View, rad: float, n=16, strength=1.0,
          seed=7):
    """SSAO rett over djupnebufferet: for kvar piksel eit knippe retningar i
    halvkula kring normalen, projisert ned att og samanlikna med djupna som
    alt står der.

    Køyrer på utgangsoppløysinga, ikkje på supersamplinga: okklusjonen er
    lågfrekvent, og ss² gonger fleire sampl ville kosta storparten av
    rendretida utan å syne. Retningane er faste (seeda), slik at to
    køyringar av mappa gjev same biletet."""
    H, W = zbuf.shape
    hit = np.isfinite(zbuf)
    ao = np.ones((H, W), dtype=np.float32)
    if not hit.any():
        return ao
    yy, xx = np.nonzero(hit)
    z = zbuf[yy, xx].astype(np.float64)
    xv, yv = view_lo.unproject(xx + 0.5, yy + 0.5, z)
    nv = view_lo.dir_to_view(nrm_w[yy, xx].astype(np.float64))

    rng = np.random.default_rng(seed)
    d = rng.normal(size=(n, 3))
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    # kortare sampl er tettare: nærkontakt er det som ber lesinga av ein stabel
    d *= (0.30 + 0.70 * ((np.arange(n) + 1) / n) ** 2)[:, None]

    occ = np.zeros(z.shape[0], dtype=np.float32)
    bias = 0.02 * rad
    for k in range(n):
        s = d[k] * rad
        # spegl retninga inn i halvkula kring normalen
        sg = np.where(nv[:, 0] * s[0] + nv[:, 1] * s[1] + nv[:, 2] * s[2] < 0.0,
                      -1.0, 1.0)
        sxv = xv + sg * s[0]
        syv = yv + sg * s[1]
        szv = z + sg * s[2]
        px, py = view_lo.project(np.stack([sxv, syv, szv], axis=-1))
        ix = np.floor(px).astype(np.int32)
        iy = np.floor(py).astype(np.int32)
        inside = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
        np.clip(ix, 0, W - 1, out=ix)
        np.clip(iy, 0, H - 1, out=iy)
        zb = zbuf[iy, ix].astype(np.float64)
        near = np.isfinite(zb)
        # avstandsvakt: ein silhuett langt bak skal ikkje kaste okklusjon
        fall = np.clip(rad / np.maximum(np.abs(z - zb), 1e-6), 0.0, 1.0)
        occ += (near & inside & (zb < szv - bias)) * _smoothstep(fall)
    ao[yy, xx] = np.clip(1.0 - strength * occ / n, 0.0, 1.0).astype(np.float32)
    return ao


# =============================================================================
# RENDER
# =============================================================================
def render(tris, normals=None, cam: Camera | None = None,
           size=(1600, 1200), light=LIGHT, ss: int = 3,
           ao: bool = True, shadow: bool = True, bg=(1.0, 1.0, 1.0),
           material=WOOD, ground: bool = True, stripes: float = 0.0,
           stripe_depth: float = 0.24, stripe_w: float = 0.34,
           ao_radius: float | None = None, ao_strength: float = 0.90,
           shadow_strength: float = 1.0, spec: float = W_SPEC,
           exposure: float = 1.0, smap: int = 2048,
           alpha: bool = False) -> np.ndarray:
    """Eitt bilete. `tris` er (N,3,3) hjørnepunkt i mm, `normals` er (N,3,3)
    hjørnenormalar (None gjev flate normalar frå trekanten sjølv).

    `stripes` er finértjukna i mm; 0 slår striperinga av. `ground` legg eit
    plan på z = 0 som TEK IMOT skugge men aldri sjølv vert synleg som flate.

    Ut kjem float RGB (H,W,3) i sRGB, eller RGBA om `alpha` er sett.
    """
    tris = np.ascontiguousarray(np.asarray(tris, dtype=np.float32).reshape(-1, 3, 3))
    if normals is None:
        e1 = tris[:, 1] - tris[:, 0]
        e2 = tris[:, 2] - tris[:, 0]
        fn = np.cross(e1, e2)
        fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
        nors = np.repeat(fn[:, None, :], 3, axis=1).astype(np.float32)
    else:
        nors = np.ascontiguousarray(
            np.asarray(normals, dtype=np.float32).reshape(-1, 3, 3))
    if cam is None:
        raise ValueError("render() krev eit kamera frå look()")

    W, H = int(size[0]), int(size[1])
    ss = max(1, int(ss))
    Ws, Hs = W * ss, H * ss
    view = _View(cam, Ws, Hs)
    view_lo = _View(cam, W, H)

    flat = tris.reshape(-1, 3)
    lo = flat.min(0).astype(np.float64)
    hi = flat.max(0).astype(np.float64)
    ctr = (lo + hi) * 0.5
    rad = max(float(np.linalg.norm(hi - lo)) * 0.5, 1e-6)

    # ---- geometripass ------------------------------------------------------
    v = view.to_view(flat.astype(np.float64)).reshape(-1, 3, 3)
    sx, sy = view.project(v)
    near = 0.0 if cam.ortho else rad * 1e-3
    zf, nf = _rasterize(np.ascontiguousarray(sx), np.ascontiguousarray(sy),
                        np.ascontiguousarray(v[..., 2]), view,
                        attrs=nors, near=near)
    zbuf = zf.reshape(Hs, Ws)
    nbuf = nf.reshape(Hs, Ws, 3)

    # ---- lågoppløyst geometri til okklusjonen ------------------------------
    if ao:
        zb = zbuf.reshape(H, ss, W, ss)
        # minimum, ikkje middel: over ein silhuettkant ligg bakgrunnen på
        # uendeleg, og eit middel ville dratt heile blokka dit
        z_lo = zb.min(axis=(1, 3))
        n_lo = nbuf.reshape(H, ss, W, ss, 3).mean(axis=(1, 3))
        ln = np.linalg.norm(n_lo, axis=2, keepdims=True)
        n_lo = n_lo / np.maximum(ln, 1e-9)
        r_ao = float(ao_radius) if ao_radius else rad * 0.075
        ao_lo = _ssao(z_lo, n_lo, view_lo, r_ao, strength=ao_strength)
    else:
        ao_lo = None

    # ---- skuggekart --------------------------------------------------------
    ldir = _unit(_v3(light))                     # peikar MOT lyskjelda
    sm = _Shadow(tris.astype(np.float64), ldir, ctr, rad, res=int(smap)) \
        if shadow else None

    # ---- lyssetjing --------------------------------------------------------
    alb = srgb_to_lin(np.asarray(material, dtype=np.float64).reshape(3))
    bg_lin = srgb_to_lin(np.asarray(bg, dtype=np.float64).reshape(3))
    # Fyllys: eitt frå kameraet, så silhuetten ikkje flatar ut, og eitt frå
    # motsett kant, så skuggesida aldri kollapsar til svart på trykk.
    fillA = _unit(view.eye - _v3(cam.target))
    fillB = _unit(np.array([-ldir[0], -ldir[1], 0.42]))
    loss = np.asarray(SHADOW_LOSS, dtype=np.float64)

    out = np.zeros((H, W, 3), dtype=np.float32)
    cov = np.zeros((H, W), dtype=np.float32) if alpha else None

    # Ei stripe som er tynnare enn ein piksel flimrar under nedskaleringa.
    # Så heller ei litt for brei fug enn ei som kokar: set breidda ned mot
    # det biletet faktisk kan oppløyse.
    mmpp = (cam.ortho_scale if cam.ortho
            else 2.0 * view.t * float(np.linalg.norm(view.eye - _v3(cam.target)))
            ) / max(min(Ws, Hs), 1)
    sw = max(float(stripe_w), 0.75 * mmpp)

    # Bandvis: eit fullt mellomlag på ss-oppløysing ville vore fleire hundre
    # MB, og alt frå her og ut er punktvis, så bandinndelinga kostar ingen
    # ting. Bandhøgda må dele på ss, elles går ikkje nedskaleringa opp.
    rows = max(ss, (int(1_200_000 // max(Ws, 1)) // ss) * ss)
    for y0 in range(0, Hs, rows):
        y1 = min(Hs, y0 + rows)
        zc = zbuf[y0:y1]
        ny = y1 - y0
        col = np.empty((ny, Ws, 3), dtype=np.float32)
        col[:] = bg_lin
        cvg = np.zeros((ny, Ws), dtype=np.float32) if alpha else None

        hit = np.isfinite(zc)
        yy, xx = np.nonzero(hit)
        if yy.size:
            z = zc[yy, xx].astype(np.float64)
            xv, yv = view.unproject(xx + 0.5, yy + 0.5 + y0, z)
            P = view.to_world(np.asarray(xv, dtype=np.float64),
                              np.asarray(yv, dtype=np.float64), z)
            N = nbuf[y0:y1][yy, xx].astype(np.float64)
            N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
            # Skalet er tynt og kutta opp; ein einsidig normal ville gjeve
            # svarte flekkar der innsida vender mot kameraet. Snu han i staden.
            if cam.ortho:
                # (1,3) og ikkje (n,3): synsretninga er den same for kvar
                # piksel i ein parallellprojeksjon, og n er i millionar
                V = (-view.f)[None, :]
            else:
                V = view.eye[None, :] - P
                V /= np.maximum(np.linalg.norm(V, axis=1, keepdims=True), 1e-12)
            N[np.sum(N * V, axis=1) < 0.0] *= -1.0

            nl = np.clip(N @ ldir, 0.0, 1.0)
            vis = sm.visible(P, N) if sm is not None else 1.0
            amb = W_AMB * (0.55 + 0.45 * (0.5 + 0.5 * N[:, 2]))
            f1 = W_FILL[0] * np.clip(N @ fillA, 0.0, 1.0)
            f2 = W_FILL[1] * np.clip(N @ fillB, 0.0, 1.0)
            if ao_lo is not None:
                # Okklusjonen tek heile omgjevingslyset, men berre halve
                # fyllyset. Tek han alt, kollapsar skuggesida til svart der
                # to lag møtest — og det er nett der stabelen skal lesast.
                q = ao_lo[(yy + y0) // ss, xx // ss].astype(np.float64)
                lit = amb * q + (f1 + f2) * (0.45 + 0.55 * q)
            else:
                lit = amb + f1 + f2
            lit = lit + W_KEY * nl * vis

            a = np.repeat(alb[None, :], N.shape[0], 0)
            if stripes and stripes > 0.0:
                # Avstanden opp til nærmaste limfug, i mm. Styrken skalerer
                # med kor mykje flata står på tvers av lagdelinga: ei
                # vassrett flate ligg heilt inne i eitt lag og har inga fug
                # å syne, og utan denne vakta ville ei slik flate kunne
                # verte einsfarga mørk fordi heile ho ligg i same fasen.
                u = np.abs(np.mod(P[:, 2] / stripes + 0.5, 1.0) - 0.5) * stripes
                edge = np.sqrt(np.clip(1.0 - N[:, 2] ** 2, 0.0, 1.0))
                ln_ = (1.0 - _smoothstep(u / sw)) * edge
                a = a * (1.0 - stripe_depth * ln_)[:, None]

            c = a * lit[:, None]
            if spec > 0.0:
                hv = ldir[None, :] + V
                hv /= np.maximum(np.linalg.norm(hv, axis=1, keepdims=True), 1e-12)
                sp = np.clip(np.sum(N * hv, axis=1), 0.0, 1.0) ** SPEC_EXP
                c = c + (spec * sp * vis)[:, None]
            col[yy, xx] = c * exposure
            if alpha:
                cvg[yy, xx] = 1.0

        # ---- golvet: berre skuggen, aldri flata --------------------------
        # Golvplanet vert aldri teikna. Strålen vert skoten mot z = 0 berre
        # for å finne kvar skuggen fell; alt anna av planet blir ståande
        # kvitt, slik oppriss i serien alltid har hatt det.
        if ground and sm is not None and sm.disc[2] > 0.0:
            nxs = (np.arange(Ws, dtype=np.float64) + 0.5) / Ws * 2.0 - 1.0
            nys = 1.0 - (np.arange(y0, y1, dtype=np.float64) + 0.5) / Hs * 2.0
            rr, uu, ff, ee = view.r, view.u, view.f, view.eye
            if cam.ortho:
                cx_ = (nxs * view.hx)[None, :]
                cy_ = (nys * view.hy)[:, None]
                oz = ee[2] + cx_ * rr[2] + cy_ * uu[2]
                tt = -oz / ff[2] if abs(ff[2]) > 1e-9 else np.full_like(oz, -1.0)
                gxw = ee[0] + cx_ * rr[0] + cy_ * uu[0] + ff[0] * tt
                gyw = ee[1] + cx_ * rr[1] + cy_ * uu[1] + ff[1] * tt
            else:
                cx_ = (nxs * view.t * view.kx)[None, :]
                cy_ = (nys * view.t * view.ky)[:, None]
                dz = ff[2] + cx_ * rr[2] + cy_ * uu[2]
                tt = -ee[2] / np.where(np.abs(dz) > 1e-9, dz, 1e-9)
                gxw = ee[0] + (ff[0] + cx_ * rr[0] + cy_ * uu[0]) * tt
                gyw = ee[1] + (ff[1] + cx_ * rr[1] + cy_ * uu[1]) * tt
            dc = sm.disc
            ok = ((tt > 0.0) & ~hit
                  & ((gxw - dc[0]) ** 2 + (gyw - dc[1]) ** 2 < dc[2] ** 2))
            gi = np.flatnonzero(ok.ravel())
            if gi.size:
                gxf = np.broadcast_to(gxw, ok.shape).ravel()[gi]
                gyf = np.broadcast_to(gyw, ok.shape).ravel()[gi]
                k = shadow_strength * (1.0 - sm.visible_ground(gxf, gyf))
                gi = gi[k > 1e-4]
                k = k[k > 1e-4]
                if gi.size:
                    col.reshape(-1, 3)[gi] = (bg_lin[None, :]
                                              * (1.0 - k[:, None] * loss[None, :]))
                    if alpha:
                        # tettleik, ikkje dekning: golvet finst ikkje som
                        # flate, så det einaste som er «der» er skuggen
                        cvg.ravel()[gi] = np.maximum(cvg.ravel()[gi],
                                                     k * float(loss.mean()))

        # ---- nedskalering --------------------------------------------------
        np.clip(col, 0.0, 1.0, out=col)
        blk = col.reshape(ny // ss, ss, W, ss, 3).mean(axis=(1, 3))
        out[y0 // ss:y1 // ss] = lin_to_srgb(blk).astype(np.float32)
        if alpha:
            cov[y0 // ss:y1 // ss] = cvg.reshape(ny // ss, ss, W, ss).mean(axis=(1, 3))

    if alpha:
        return np.concatenate([out, cov[:, :, None]], axis=2)
    return out


def save_png(img, path):
    """Skriv float RGB/RGBA i [0,1] til PNG. PIL berre til filformatet;
    ingen ting av biletet er laga der."""
    from PIL import Image
    a = np.clip(np.asarray(img, dtype=np.float64), 0.0, 1.0)
    a = (a * 255.0 + 0.5).astype(np.uint8)
    Image.fromarray(a, mode="RGBA" if a.shape[2] == 4 else "RGB").save(path)
    return path
