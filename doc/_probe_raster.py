# -*- coding: utf-8 -*-
"""
SANDKASSE — prøve på rasterisatoren.

Køyr:  python3 doc/_probe_raster.py

Fyrst ein kule og ein kube på golvet. Den prøva er der for å sjå om
grunnlaget står: eit kroppsrundt objekt syner om normalinterpolasjonen er
samanhengande, ein kube med skarpe kantar syner om skuggekartet legg
skuggen der han skal og ikkje på seg sjølv.

Så det verkelege objektet, om out/skal.stl finst — same tre bileta som
mappa treng: eit 3/4 perspektiv, eit ortografisk oppriss og ein
ortografisk plan. Perspektivet går i 1600 × 1200 med ss = 3, som er
ytelsesmålet, og tida vert skriven ut.
"""
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import raster

OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)


# =============================================================================
# TESTGEOMETRI
# =============================================================================
def sphere(c, r, nu=64, nv=32):
    """Analytiske normalar, så prøva skil rasterisatoren sin feil frå
    normalane sin."""
    u = np.linspace(0.0, 2.0 * math.pi, nu + 1)
    v = np.linspace(0.0, math.pi, nv + 1)
    U, V = np.meshgrid(u, v, indexing="ij")
    n = np.stack([np.cos(U) * np.sin(V), np.sin(U) * np.sin(V), np.cos(V)], -1)
    p = np.asarray(c, float) + n * r
    # akse 2 er hjørnet, akse 3 er xyz — stablar ein på akse 1 i staden
    # kjem hjørna i utakt med rutene og nettet vert ei sil
    q = [(p[:-1, :-1], p[1:, :-1], p[1:, 1:]), (p[:-1, :-1], p[1:, 1:], p[:-1, 1:])]
    m = [(n[:-1, :-1], n[1:, :-1], n[1:, 1:]), (n[:-1, :-1], n[1:, 1:], n[:-1, 1:])]
    tris = np.concatenate([np.stack(t, 2).reshape(-1, 3, 3) for t in q])
    nors = np.concatenate([np.stack(t, 2).reshape(-1, 3, 3) for t in m])
    return tris.astype(np.float32), nors.astype(np.float32)


def box(lo, hi):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    tris, nors = [], []
    for ax in range(3):
        for s in (0, 1):
            i, j = (ax + 1) % 3, (ax + 2) % 3
            nn = np.zeros(3)
            nn[ax] = -1.0 if s == 0 else 1.0
            base = lo.copy()
            base[ax] = lo[ax] if s == 0 else hi[ax]
            e1, e2 = np.zeros(3), np.zeros(3)
            e1[i] = hi[i] - lo[i]
            e2[j] = hi[j] - lo[j]
            if s == 0:
                e1, e2 = e2, e1                  # hald vindinga utover
            c = [base, base + e1, base + e1 + e2, base + e2]
            tris += [[c[0], c[1], c[2]], [c[0], c[2], c[3]]]
            nors += [[nn, nn, nn], [nn, nn, nn]]
    return np.array(tris, np.float32), np.array(nors, np.float32)


# =============================================================================
# BINÆR STL
# =============================================================================
def read_stl(path):
    """80 byte topptekst, uint32 tal trekantar, så 50 byte per trekant:
    12 float32 (flatenormal + tre hjørne) og to byte attributt. Kopien før
    .view() er naudsynt — utsnittet er ikkje samanhengande, og numpy nektar
    å tolke om minnet då."""
    b = np.fromfile(path, dtype=np.uint8)
    n = int(b[80:84].copy().view(np.uint32)[0])
    rec = b[84:84 + 50 * n].reshape(n, 50)
    f = rec[:, :48].copy().view(np.float32).reshape(n, 4, 3)
    return np.ascontiguousarray(f[:, 1:4]), np.ascontiguousarray(f[:, 0])


def smooth_normals(tris, crease_deg=40.0):
    """STL ber berre flatenormalar, og flate normalar les som fasettar.
    Sveis hjørna på posisjon og legg saman arealvekta flatenormalar — men
    la eit hjørne falle attende på si eiga flate når vinkelen er over
    knekkgrensa, slik at lagkantane i stabelen held seg skarpe."""
    v = tris.reshape(-1, 3)
    _, inv = np.unique(np.round(v, 3), axis=0, return_inverse=True)
    inv = inv.ravel()
    fn = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])  # arealvekt
    rep = np.repeat(fn, 3, axis=0)
    m = int(inv.max()) + 1
    acc = np.stack([np.bincount(inv, weights=rep[:, k], minlength=m)
                    for k in range(3)], axis=1)
    acc /= np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)
    fnn = rep / np.maximum(np.linalg.norm(rep, axis=1, keepdims=True), 1e-12)
    out = acc[inv]
    hard = np.sum(out * fnn, axis=1) < math.cos(math.radians(crease_deg))
    out[hard] = fnn[hard]
    return out.reshape(-1, 3, 3).astype(np.float32)


# =============================================================================
# KØYRING
# =============================================================================
def frame(tris, az, el, ortho, size, margin=1.10):
    lo = tris.reshape(-1, 3).min(0)
    hi = tris.reshape(-1, 3).max(0)
    ctr = ((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5,
           lo[2] + (hi[2] - lo[2]) * 0.46)
    span = float(max(hi - lo))
    return raster.look(az, el, span * 3.2, target=ctr, ortho=ortho,
                       fov=26, ortho_scale=span * margin), span


def shot(name, tris, nors, az, el, ortho, size, ss=3, stripes=0.0, **kw):
    cam, _ = frame(tris, az, el, ortho, size)
    t0 = time.perf_counter()
    img = raster.render(tris, nors, cam, size=size, ss=ss, stripes=stripes,
                        material=raster.WOOD, ground=True, **kw)
    dt = time.perf_counter() - t0
    p = os.path.join(OUT, name + ".png")
    raster.save_png(img, p)
    print(f"  {name:<14} {size[0]}×{size[1]} ss={ss}  {dt:6.2f} s   "
          f"{img.shape}  min {img.min():.3f} max {img.max():.3f}  "
          f"{os.path.getsize(p) / 1024:.0f} kB")
    return dt, img


def main():
    print(f"testgeometri — kule + kube på golv")
    st, sn = sphere((-70.0, 0.0, 60.0), 60.0)
    bt, bn = box((20.0, -55.0, 0.0), (130.0, 55.0, 110.0))
    tris = np.concatenate([st, bt])
    nors = np.concatenate([sn, bn])
    print(f"  {len(tris)} trekantar")
    shot("prove-testgeometri", tris, nors, 38, 20, False, (1200, 900), ss=3)
    shot("prove-testgeometri-ortho", tris, nors, 38, 20, True, (1200, 900), ss=3)

    stl = os.path.join(ROOT, "out", "skal.stl")
    if not os.path.exists(stl):
        print("\nout/skal.stl finst ikkje — hoppar over det verkelege objektet."
              "\nbygg han fyrst med:  npx tsx scripts/fab.ts")
        return

    print(f"\nskal.stl")
    t0 = time.perf_counter()
    tris, _ = read_stl(stl)
    t_read = time.perf_counter() - t0
    t0 = time.perf_counter()
    nors = smooth_normals(tris)
    t_nrm = time.perf_counter() - t0
    lo = tris.reshape(-1, 3).min(0)
    hi = tris.reshape(-1, 3).max(0)
    print(f"  {len(tris)} trekantar   les {t_read:.2f} s   normalar {t_nrm:.2f} s")
    print(f"  boks {np.round(lo, 1)} … {np.round(hi, 1)} mm")

    # plyT er ikkje kjend her; 4 mm er standardplata i params.ts
    dt1, _ = shot("skal-perspektiv", tris, nors, 34, 18, False,
                  (1600, 1200), ss=3, stripes=4.0)
    # Ikkje heilt el = 0: eit strengt oppriss ser golvet på kant, og då
    # finst ingen golvflate å ta imot skuggen på.
    dt2, _ = shot("skal-oppriss", tris, nors, 90, 4, True,
                  (1100, 1500), ss=3, stripes=4.0)
    dt3, _ = shot("skal-plan", tris, nors, 0, 89.5, True,
                  (1300, 1300), ss=3, stripes=4.0)

    print(f"\nytelsesmål: {len(tris)} trekantar, 1600×1200, ss=3 "
          f"→ {dt1:.1f} s  ({'innanfor' if dt1 < 60 else 'OVER'} 60 s)")
    print(f"i alt {dt1 + dt2 + dt3:.1f} s for dei tre bileta")
    print(f"bileta ligg i {OUT}")


if __name__ == "__main__":
    main()
