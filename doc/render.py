# -*- coding: utf-8 -*-
"""
SANDKASSE — mappa.

Set heile dokumentet av doc/data/doc.json. Ingen tal i denne fila er
skrivne inn for hand; alle er henta ut av modellen medan sidene vert
sette. Endrar ein parameter seg, endrar tabellane seg.

    npx tsx scripts/dump-doc.ts      # data ut av motoren
    python3 doc/render.py            # arka og PDF-en

Bileta vert rendra av doc/raster.py — eigen rasterisator med z-buffer,
skuggekart og omgjevingsokklusjon, utan GPU.
"""
import json
import math
import os
import sys
import time

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import sheet
from sheet import (INK, INK_FAINT, INK_SOFT, HAIR, WARN, MM, Page,
                   draw_polys, equal)
import raster

DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

D = json.load(open(os.path.join(DATA, "doc.json"), encoding="utf-8"))
M = D["metrics"]
P = D["params"]
STACK = D["stack"]

# bjørk under kvitpigmentert olje
WOOD = (0.90, 0.87, 0.81)


# =============================================================================
# BILETE
# =============================================================================
def mesh(name):
    a = np.fromfile(os.path.join(DATA, name), dtype=np.float32)
    a = a.reshape(-1, 3, 6)
    return np.ascontiguousarray(a[:, :, :3]), np.ascontiguousarray(a[:, :, 3:])


_cache = {}


def shot(meshfile, key, az=38, el=22, ortho=False, size=(1500, 1500),
         ss=3, stripes=True, ao=True, shadow=True, dist=None, fov=26):
    """Rendrar éin gong per køyring og legg biletet i out/, slik at ei
    omsats av dokumentet ikkje kostar ei ny rendring."""
    if key in _cache:
        return _cache[key]
    png = os.path.join(OUT, f"{key}.npy")
    src = os.path.join(DATA, meshfile)
    if os.path.exists(png) and os.path.getmtime(png) > os.path.getmtime(src):
        img = np.load(png)
        _cache[key] = img
        return img
    t0 = time.time()
    tris, nors = mesh(meshfile)
    lo = tris.reshape(-1, 3).min(0)
    hi = tris.reshape(-1, 3).max(0)
    ctr = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (hi[2] - lo[2]) * 0.46)
    span = float(max(hi - lo))
    cam = raster.look(az, el, dist or span * 3.1, target=ctr, ortho=ortho,
                      fov=fov, ortho_scale=span * 1.12)
    img = raster.render(tris, nors, cam, size=size, ss=ss, ao=ao,
                        shadow=shadow, material=WOOD, ground=True,
                        stripes=STACK["plyT"] if stripes else 0)
    np.save(png, img)
    print(f"  rendra {key}  {time.time() - t0:.1f} s")
    _cache[key] = img
    return img


# =============================================================================
# TEIKNINGAR
# =============================================================================
def layer_polys(layer):
    out = []
    for q in layer["parts"]:
        out.append(q["outline"])
        out.extend(q["holes"])
    return out


def contour_map(ax, every=5, lw_thin=0.28, lw_bold=0.75):
    """Konturkartet: alle laga lagde oppå kvarandre, sett ovanfrå. Ei
    teikning av dette objektet kan ikkje vera eit oppriss med mål på —
    flata har ingen rette kantar og ingen radiussenter. Det som kan
    målast, er laga."""
    for L in STACK["layers"]:
        bold = L["i"] % every == 0
        draw_polys(ax, layer_polys(L), lw=lw_bold if bold else lw_thin,
                   color=INK if bold else HAIR)
    xs = [c[0] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    ys = [c[1] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    equal(ax, min(xs), max(xs), min(ys), max(ys))


def field_image(ax):
    F = D["field"]
    v = np.array(F["values"], dtype=float).reshape(F["nh"], F["nth"])
    mat = (v >= 1.0).astype(float)
    ax.imshow(1 - mat * 0.86, cmap="gray", vmin=0, vmax=1, origin="lower",
              extent=[0, 360, 0, D["zTop"]], aspect="auto",
              interpolation="nearest")
    for L in STACK["layers"]:
        ax.axhline(L["z1"], color="#00000022", lw=0.3)
    ax.set_xlim(0, 360)
    ax.set_ylim(0, D["zTop"])
    ax.set_xticks([0, 90, 180, 270, 360])
    ax.set_yticks([0, P["seatZ"], round(D["zTop"])])
    ax.tick_params(labelsize=6.2, colors=INK_SOFT, length=2, width=0.5)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_axis_on()


def area_curve(ax):
    z = [r["z"] for r in D["profile"]]
    a = [r["area"] / 100.0 for r in D["profile"]]
    ax.plot(a, z, color=INK, lw=0.9)
    ax.fill_betweenx(z, 0, a, color="#00000010", lw=0)
    ax.axhline(M["minSecZ"], color=WARN, lw=0.6, ls=(0, (3, 2)))
    ax.set_ylim(0, D["zTop"])
    ax.set_xlim(0, max(a) * 1.06)
    ax.tick_params(labelsize=6.2, colors=INK_SOFT, length=2, width=0.5)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_axis_on()


def law_curves(ax):
    """Ryggrad, vriding og radius gjennom høgda, alle normaliserte til
    same rute. Poenget er ikkje talverdiane, men at dei tre kurvene
    ikkje er i fase — det er faseskilnaden som gjer flata vridd."""
    L = D["laws"]
    z = [r["z"] for r in L]
    def norm(vs):
        lo, hi = min(vs), max(vs)
        return [(v - lo) / (hi - lo) if hi > lo else 0.5 for v in vs]
    ax.plot(norm([r["x"] for r in L]), z, color=INK, lw=0.9, label="ryggrad")
    ax.plot(norm([r["twist"] for r in L]), z, color=INK_SOFT, lw=0.9,
            ls=(0, (4, 2)), label="vriding")
    ax.plot(norm([r["r0"] for r in L]), z, color=INK_FAINT, lw=0.9,
            ls=(0, (1, 2)), label="radius")
    ax.set_ylim(0, D["zTop"])
    ax.set_xlim(-0.06, 1.06)
    ax.set_xticks([])
    ax.set_yticks([0, P["seatZ"], round(D["zTop"])])
    ax.tick_params(labelsize=6.2, colors=INK_SOFT, length=2, width=0.5)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_axis_on()
    ax.legend(fontsize=6, frameon=False, loc="upper right",
              labelcolor=INK_SOFT, handlelength=2.4)


def sheet_plot(ax, k=0):
    S = D["nesting"]["sheets"][k]
    ax.add_patch(plt.Rectangle((0, 0), S["w"], S["h"], fill=False,
                               ec=HAIR, lw=0.7))
    for pl in S["placed"]:
        a = math.radians(pl["rot"])
        ca, sa = math.cos(a), math.sin(a)
        def tf(poly):
            return [[pl["x"] + c[0] * ca - c[1] * sa,
                     pl["y"] + c[0] * sa + c[1] * ca] for c in poly]
        draw_polys(ax, [tf(pl["outline"])] + [tf(h) for h in pl["holes"]],
                   lw=0.28, color=INK)
    ax.plot([S["used"], S["used"]], [0, S["h"]], color=WARN, lw=0.6,
            ls=(0, (4, 3)))
    equal(ax, 0, S["w"], 0, S["h"], pad=0.02)


# =============================================================================
# SIDENE
# =============================================================================
pages = []


def page(fn):
    pages.append(fn)
    return fn


def fmt(v, n=0):
    s = f"{v:,.{n}f}".replace(",", " ").replace(".", ",")
    return s


def flag(rule_id, text):
    """Merkjer eit tal raudt om regelen det høyrer til ikkje er oppfylt."""
    for r in D["rules"]:
        if r["id"] == rule_id and not r["ok"]:
            return "!" + text
    return text


@page
def p_front(pg, no):
    img = shot("skal.f32", "front", az=34, el=18, size=(1700, 1900), ss=3)
    pg.img(pg.col0, int(64 * MM), pg.right - pg.col0, int(150 * MM), img)
    pg.text(pg.col0, int(30 * MM), "SANDKASSE", size=34, weight=600)
    pg.text(pg.col0, int(38 * MM), "Eit parametrisk rom for eit sitjemøbel, "
            "og eitt objekt henta ut av det", size=10.5, color=INK_SOFT)
    pg.text(pg.col0, int(44 * MM), "50 × 50 × 50 · AHO", size=10.5,
            color=INK_SOFT)
    y = int(228 * MM)
    pg.para(pg.col0, y,
            f"Objektet er ei samanhengande flate: {int(round(M['contacts']))} bein på golvet som veks "
            f"saman i midja, opnar seg til eit sete og reiser seg til ein låg rygg bak. "
            f"{fmt(M['envX'])} × {fmt(M['envY'])} × {fmt(M['envZ'])} millimeter, "
            f"{STACK['count']} lag {fmt(P['plyT'],0)} mm bjørkefinér, {STACK['parts']} delar, "
            f"{fmt(M['mass'],1)} kilo. Ingen del er krum før ho er limt.",
            w=int(120 * MM), size=9.4)
    pg.para(pg.right - int(52 * MM), y,
            "Dette er ikkje teikninga av ein krakk. Det er reiskapen som lagar heile "
            "familien, reglane som seier nei, og eitt objekt som vart valt.",
            w=int(52 * MM), size=8.6, color=INK_SOFT)


@page
def p_tool(pg, no):
    y = pg.head(1, "Reiskapen", "Modellen og verktøyet er same kode. Det er "
                "heile skilnaden frå førre gong.")
    y = pg.para(pg.col1, y,
        "Førre versjon av dette prosjektet hadde to ting: ein modell i Python som "
        "kunne rekne, og eit verktøy i nettlesaren som kunne skruast på. Verktøyet "
        "kjende ikkje ryggrad, kutt eller opningar. Han var eit steg bak modellen, "
        "og kvar gong dei to var usamde, var det modellen som hadde rett — men det "
        "var verktøyet ein sat med.\n\n"
        "Sandkassen er svaret på det. Feltet, flata, laga, målinga, reglane, "
        "kuttarket og denne mappa les alle frå den same fila. Eit tal på dette arket "
        "er ikkje ei avskrift av eit tal i modellen; det er det talet.")
    rows = [
        ("felt og lover", "lib/skal/field.ts"),
        ("flata, klipt mot feltet", "lib/skal/surface.ts"),
        ("laga som flate delar", "lib/skal/laminae.ts"),
        ("måling og berekning", "lib/skal/metrics.ts"),
        ("reglane som seier nei", "lib/skal/rules.ts"),
        ("nesting og kuttark", "lib/skal/nest.ts"),
        ("STL · DXF · SVG", "lib/skal/export-*.ts"),
        ("denne mappa", "doc/render.py"),
    ]
    y = pg.table(pg.col1, y + int(10 * MM), rows, w=int(96 * MM), size=8.4)

    y2 = y + int(14 * MM)
    pg.label(pg.col1, y2, "Kva som er parametrisert")
    y2 = pg.para(pg.col1, y2 + int(6 * MM),
        f"{len(D['ranges'])} tal i åtte grupper. Snittet, ryggraden, vridinga, midja, "
        f"beina, sveipet, rimet, setet og plata. Kvar av dei har eit band, og "
        f"bandet er ikkje pynt: det er der motoren framleis gjev meining.")
    pg.label(pg.col1, y2 + int(8 * MM), "Kva som ikkje er parametrisert")
    pg.para(pg.col1, y2 + int(14 * MM),
        "Kva som er vakkert. Generatoren lagar ikkje val, han lagar rom å velje i. "
        "Objektet på side 6 er valt for hand, og grunngjevinga står ved sida av.")
    pg.foot(no)


@page
def p_space(pg, no):
    y = pg.head(2, "Rommet", "Åtte grupper, {} tal. Eitt objekt er eitt "
                "punkt.".format(len(D["ranges"])))
    img = shot("skal.f32", "space", az=118, el=14, size=(1000, 1300), ss=2)
    pg.img(pg.right - int(46 * MM), y, int(46 * MM), int(60 * MM), img)
    yy = y
    for g in D["groups"]:
        pg.label(pg.col1, yy, g["label"])
        yy += int(5.4 * MM)
        rows = []
        for k in g["keys"]:
            r = D["ranges"][k]
            unit = r.get("unit", "")
            val = P[k]
            rows.append((r["label"],
                         f"{fmt(val, 0 if r.get('int') or abs(val) >= 20 else 2)}"
                         f"{(' ' + unit) if unit else ''}"
                         f"   [{fmt(r['min'],2 if abs(r['min'])<20 else 0)} – "
                         f"{fmt(r['max'],2 if abs(r['max'])<20 else 0)}]"))
        yy = pg.table(pg.col1, yy, rows, w=int(84 * MM), size=7.6,
                      gap=int(3.5 * MM))
        yy += int(3.4 * MM)
    pg.caption(pg.col0, y + int(70 * MM),
        "Talet i midten er verdien objektet står på. Klammene er bandet "
        "motoren tillèt. Utanfor bandet finst det ingen krakk — berre tal.",
        w=pg.SIDE_W)
    pg.foot(no)


@page
def p_field(pg, no):
    y = pg.head(3, "Feltet", "Rullar ein flata ut, vert objektet eit "
                "rektangel. Kvar opning er ei likning i det rektangelet.")
    ax = pg.ax(pg.col1, y, pg.body_w, int(58 * MM))
    field_image(ax)
    y2 = y + int(64 * MM)
    pg.caption(pg.col1, y2,
        "Vinkel til høgre, høgd oppover. Grå flater er opningar, tynne linjer er "
        f"dei {STACK['count']} laga. Den øvre kanten er rimet.")
    y3 = y2 + int(12 * MM)
    y3 = pg.para(pg.col1, y3,
        "Ei opning er ikkje eit hòl som vert skore etterpå. Ho er ein del av "
        "likninga: der feltverdien fell under éin, er det ikkje material. Fordi "
        f"sentrum for sveipet vandrar {fmt(abs(P['sweepDrift']))} grader over høgda, "
        "sveipar opninga diagonalt kring kroppen — og fordi eksponenten er "
        f"{fmt(P['sweepExp'],2)}, altså under to, får ho spisse endar i staden for runde.")
    rows = [
        ("beinopningar", f"{int(P['legs'])} × {fmt(P['legGap'])}°, senter under golvet"),
        ("sveipet", f"{fmt(P['sweepSpan'])}° breitt, vandrar {fmt(abs(P['sweepDrift']))}°"),
        ("rimet finst", flag("rim", f"{fmt(M['rimSpan'])}° av 360°")),
        ("eggkant ved opningane", f"{fmt(P['edgeT'],1)} mm av {fmt(P['shellT'],0)} mm"),
    ]
    pg.table(pg.col1, y3 + int(10 * MM), rows, w=pg.body_w, size=8.4)
    pg.para(pg.col0, y3,
        "Utan eggkanten les opningane som dører skorne i ein vegg i staden for "
        "som noko flata sjølv gjer.", w=pg.SIDE_W, size=8.2, color=INK_SOFT)
    pg.foot(no)


@page
def p_laws(pg, no):
    y = pg.head(4, "Snittet", "Snittet er ein superellipse. Det som gjer "
                "objektet, er kva som skjer med snittet på vegen opp.")
    ax = pg.ax(pg.col1, y, int(52 * MM), int(64 * MM))
    law_curves(ax)
    img = shot("skal.f32", "side", az=90, el=4, ortho=True,
               size=(900, 1300), ss=3, shadow=False)
    pg.img(pg.col1 + int(58 * MM), y, int(40 * MM), int(64 * MM), img)
    y2 = y + int(70 * MM)
    pg.caption(pg.col1, y2,
        "Ryggrad, vriding og radius gjennom høgda, normaliserte til same rute. "
        "Dei er ikkje i fase, og det er faseskilnaden som gjer flata vridd.")
    y3 = y2 + int(12 * MM)
    rows = [
        ("ryggraden vandrar", f"{fmt(max(abs(r['x']) for r in D['laws']))} mm i planet"),
        ("vridinga", f"{fmt(P['twist'])}° frå golv til rim"),
        ("akseforhold nede / midje / oppe",
         f"{fmt(P['asp0'],2)} · {fmt(P['asp1'],2)} · {fmt(P['asp2'],2)}"),
        ("midja snørast inn", f"{fmt(P['waist'] * 100)} % ved h = {fmt(P['waistZ'],2)}"),
        ("fotinnsnittet", f"{fmt(P['foot'] * 100)} % mot golvet"),
        ("strekt bein", f"{fmt(P['legStretch'] * 100)} % lenger ut, retning {fmt(P['legDir'])}°"),
    ]
    y3 = pg.table(pg.col1, y3, rows, w=pg.body_w, size=8.4)
    pg.para(pg.col1, y3 + int(8 * MM),
        "Senteret for snittet er ikkje ein akse, men ein kurve: fyrst litt "
        "attende, så framover. Det er den som gjer at objektet ser ut til å ha "
        "rørt seg. Sidan snittet ikkje er rundt, er det rotasjonen som lagar "
        "vridinga i flata — og fordi kvart lag likevel er flatt, kan heile "
        "vridinga skjerast ut av ei plate.")
    pg.foot(no)


@page
def p_rules(pg, no):
    y = pg.head(5, "Reglane", "Det som skil ein reiskap frå ein "
                "demonstrasjon, er om han seier nei.")
    y = pg.para(pg.col1, y,
        "Reiskapen nektar ikkje å teikne. Han teiknar kva som helst, men han "
        "seier frå — og han seier kvifor. Ein hard regel tyder at objektet bryt "
        "oppgåva eller ikkje kan byggjast. Ein mjuk regel er eit val som er teke, "
        "og som skal stå på papiret i staden for i hovudet.")
    y += int(6 * MM)
    for r in D["rules"]:
        mark = "●" if not r["ok"] else "○"
        col = WARN if not r["ok"] else INK_FAINT
        pg.text(pg.col1, y, mark, size=7, color=col)
        pg.text(pg.col1 + int(5 * MM), y, r["label"], size=8.6,
                color=INK if not r["ok"] else INK_SOFT, weight=500)
        pg.text(pg.right, y, r["value"], size=8.6,
                color=WARN if not r["ok"] else INK, ha="right")
        pg.text(pg.col1 + int(5 * MM), y + int(4 * MM), r["why"], size=7.6,
                color=INK_FAINT)
        pg.text(pg.col0, y, "hard" if r["hard"] else "mjuk", size=7.2,
                color=INK_FAINT)
        y += int(9.4 * MM)
    n_bad = sum(1 for r in D["rules"] if not r["ok"])
    pg.rule(pg.col1, pg.right, y - int(4 * MM))
    pg.para(pg.col1, y + int(4 * MM),
        f"Objektet på dei neste sidene bryt {n_bad} av {len(D['rules'])} reglar."
        + ("" if n_bad == 0 else " Dei står raudt der dei slår ut."),
        size=8.6)
    pg.foot(no)


@page
def p_object(pg, no):
    y = pg.head(6, "Objektet", "Same objekt frå fire vinklar. Det er ikkje "
                "eit uhell at det er ulikt frå kvar — snittet roterer.")
    w = (pg.body_w - int(6 * MM)) // 2
    h = int(52 * MM)
    for i, (key, az) in enumerate([("o0", 34), ("o1", 124), ("o2", 214), ("o3", 304)]):
        img = shot("skal.f32", key, az=az, el=14, size=(1000, 1100), ss=2)
        pg.img(pg.col1 + (i % 2) * (w + int(6 * MM)),
               y + (i // 2) * (h + int(5 * MM)), w, h, img)
    y2 = y + 2 * h + int(12 * MM)
    rows = [
        ("ytre mål", flag("kube", f"{fmt(M['envX'])} × {fmt(M['envY'])} × {fmt(M['envZ'])} mm")),
        ("klaring til kuben", f"{fmt(M['clearX'])} / {fmt(M['clearY'])} / {fmt(M['clearZ'])} mm"),
        ("setehøgd", flag("sete", f"{fmt(M['seatZ'])} mm")),
        ("skål, brukbar flate", flag("skaal", f"{fmt(M['dishW'])} × {fmt(M['dishD'])} mm")),
        ("skåldjupn", f"{fmt(M['dishDepth'])} mm"),
        ("ryggen over setet", f"{fmt(M['finRise'])} mm"),
        ("fotavtrykk", f"{fmt(M['footX'])} × {fmt(M['footY'])} mm"),
        ("veltevinkel", flag("velte", f"{fmt(M['tipAngle'],0)}°")),
        ("skaltjukn", f"{fmt(P['shellT'],0)} mm, {fmt(P['edgeT'],0)} mm ved eggkanten"),
        ("masse", f"{fmt(M['mass'],1)} kg ferdig · {fmt(M['massCut'],1)} kg kutta"),
        ("lag / delar", f"{M['layers']} / {M['parts']}"),
    ]
    pg.table(pg.col1, y2, rows, w=pg.body_w, size=8.6)
    pg.para(pg.col0, y2,
        "Setehøgda ligg nedst i det brukbare bandet. Det er valt: ein rygg krev "
        "at setet kjem ned, elles kjem ryggen for høgt i kuben.",
        w=pg.SIDE_W, size=8.2, color=INK_SOFT)
    pg.foot(no)


@page
def p_seat(pg, no):
    y = pg.head(7, "Setet", "Setet er ikkje ei plate. Det er toppen av same "
                "flata, med skåla skoren inn i dei øvste laga.")
    img = shot("skal.f32", "top", az=0, el=88, ortho=True, size=(1300, 1300),
               ss=3, shadow=False)
    pg.img(pg.col1, y, int(62 * MM), int(62 * MM), img)
    ax = pg.ax(pg.col1 + int(68 * MM), y, int(52 * MM), int(62 * MM))
    for L in STACK["layers"]:
        if L["z0"] < P["seatZ"] - P["dish"] - P["shellT"] - P["plyT"]:
            continue
        draw_polys(ax, layer_polys(L), lw=0.5, color=INK)
    xs = [c[0] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    ys = [c[1] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    equal(ax, min(xs), max(xs), min(ys), max(ys))
    y2 = y + int(68 * MM)
    pg.caption(pg.col1, y2,
        "Til venstre setet ovanfrå. Til høgre dei laga skåla er skoren i. Skåla er "
        "målt i normalisert radius innanfor snittet, ikkje i x og y — difor fylgjer "
        "ho kanten same kva form snittet har, og salen kan dreiast utan at kanten "
        "flyttar seg.")
    rows = [
        ("skåldjupn", f"{fmt(M['dishDepth'])} mm"),
        ("skålform, eksponent", f"{fmt(P['dishExp'],2)}"),
        ("sal", f"{fmt(P['saddle'],2)}, dreidd {fmt(P['saddleDir'])}°"),
        ("setekant over skalet", f"{fmt(P['lip'],1)} mm"),
        ("brukbar flate 15 mm over botnen",
         flag("skaal", f"{fmt(M['dishW'])} × {fmt(M['dishD'])} mm")),
    ]
    y3 = pg.table(pg.col1, y2 + int(16 * MM), rows, w=pg.body_w, size=8.6)
    pg.para(pg.col1, y3 + int(8 * MM),
        f"Eksponenten på {fmt(P['dishExp'],2)} gjev ei skål som er nesten plan i "
        "midten og bratt mot kanten. Det er den som gjer at flata er brukbar og "
        "ikkje berre eit punkt. Kanten stikk "
        f"{fmt(P['lip'],1)} mm ut over skalet — nok til ein skarp skuggestrek "
        "heile vegen rundt, og lite nok til at det ikkje les som eit lok.")
    pg.foot(no)


@page
def p_layers(pg, no):
    y = pg.head(8, "Laga", "Det einaste som kan målast på eit objekt utan "
                "rette kantar, er laga.")
    ax = pg.ax(pg.col1, y, int(68 * MM), int(68 * MM))
    contour_map(ax)
    six = [STACK["layers"][i] for i in
           np.linspace(0, len(STACK["layers"]) - 1, 6).astype(int)]
    bw = int(15 * MM)
    for i, L in enumerate(six):
        a = pg.ax(pg.col1 + int(74 * MM), y + i * int(11.4 * MM), bw, int(10 * MM))
        draw_polys(a, layer_polys(L), lw=0.5, color=INK)
        xs = [c[0] for p in layer_polys(L) for c in p] or [0]
        ys = [c[1] for p in layer_polys(L) for c in p] or [0]
        allx = [c[0] for LL in STACK["layers"] for p in layer_polys(LL) for c in p]
        ally = [c[1] for LL in STACK["layers"] for p in layer_polys(LL) for c in p]
        equal(a, min(allx), max(allx), min(ally), max(ally))
        pg.text(pg.col1 + int(91 * MM), y + i * int(11.4 * MM) + int(5 * MM),
                f"lag {L['i'] + 1} · z = {fmt(L['z0'])}", size=7.2, color=INK_SOFT)
        pg.text(pg.col1 + int(91 * MM), y + i * int(11.4 * MM) + int(8.6 * MM),
                f"{len(L['parts'])} " + ("del" if len(L["parts"]) == 1 else "delar"),
                size=7.2, color=INK_FAINT)
    y2 = y + int(74 * MM)
    pg.caption(pg.col1, y2,
        "Konturkartet er alle laga lagde oppå kvarandre — samstundes plan og "
        "kuttdata. Kvart femte lag med heil strek.", w=int(68 * MM))
    rows = [
        ("lag", f"{STACK['count']} à {fmt(P['plyT'],0)} mm"),
        ("delar", f"{STACK['parts']} stk"),
        ("finérareal", f"{fmt(STACK['area'] / 10000, 0)} dm²"),
        ("masse som kutta", f"{fmt(STACK['mass'],1)} kg"),
        ("slipemon på ytterkanten", f"{fmt(P['sand'],1)} mm"),
    ]
    pg.table(pg.col1, y2 + int(14 * MM), rows, w=pg.body_w, size=8.6)
    pg.para(pg.col0, y,
        "Dei nedste laga er fleire lause delar — beina. Frå det laget der "
        "beinopningane sluttar og opp er dei lukka ringar, heilt til sveipet "
        "opnar dei att.", w=pg.SIDE_W, size=8.2, color=INK_SOFT)
    pg.foot(no)


@page
def p_build(pg, no):
    y = pg.head(9, "Kutta og slipt", "Til venstre slik det kjem ut av "
                "fresen, til høgre slik det står ferdig.")
    w = (pg.body_w - int(6 * MM)) // 2
    pg.img(pg.col1, y, w, int(62 * MM),
           shot("lag.f32", "cut", az=34, el=16, size=(1100, 1200), ss=2,
                stripes=False))
    pg.img(pg.col1 + w + int(6 * MM), y, w, int(62 * MM),
           shot("skal.f32", "sanded", az=34, el=16, size=(1100, 1200), ss=2))
    y2 = y + int(66 * MM)
    pg.caption(pg.col1, y2,
        f"Som kutta: {STACK['count']} lag, ytterkanten skoren {fmt(P['sand'],1)} mm "
        "utanfor den ferdige flata. Som slipt: limfugene står att som eit mønster "
        f"med {fmt(P['plyT'],0)} millimeters avstand i høgda — tett der flata er "
        "bratt, spreidd der ho legg seg ned.")
    y3 = y2 + int(12 * MM)
    steps = [
        ("Kutting", f"Kvart lag er ein lukka kontur i {fmt(P['plyT'],0)} mm bjørkefinér. "
                    f"Ytre kant får {fmt(P['sand'],1)} mm slipemon; indre kant vert ståande."),
        ("Stabling", "To dybelhòl ⌀8 mm per del. Dybelen er den einaste posisjoneringa "
                     "som trengst — når to lag sit på dybel, kan dei ikkje vri seg."),
        ("Liming", "PVA over heile flata, pressa mot ein flat botn. Stabelen vert limt "
                   "i tre bolkar, slik at ein får tid til å justere før limet grip."),
        ("Sliping", "Rasp og eksentersliper til 120, så 180 og 240. Flata er konveks "
                    "nesten overalt; dei konkave partia er ved beina og under rimet."),
        ("Overflate", "Kvitpigmentert olje. Ubehandla bjørk i endeved dreg til seg skit, "
                      "og heile ytterflata er endeved."),
    ]
    for k, v in steps:
        pg.text(pg.col0, y3, k, size=8.6, weight=500)
        y3 = pg.para(pg.col1, y3, v, size=8.4) + int(3 * MM)
    pg.foot(no)


@page
def p_sheet(pg, no):
    N = D["nesting"]
    y = pg.head(10, "Kuttarket", "Alle delane på finérplate. Talet nedst er "
                "det ærlege.")
    ax = pg.ax(pg.col1, y, pg.body_w, int(56 * MM))
    sheet_plot(ax, 0)
    y2 = y + int(62 * MM)
    pg.caption(pg.col1, y2,
        f"{fmt(N['sheetW'])} × {fmt(N['sheetH'])} mm bjørkefinér {fmt(P['plyT'],0)} mm. "
        f"Raud stipla line viser kor mykje av plata som faktisk vert brukt. "
        f"Delane er nesta med fri rotasjon i femten graders steg.")
    rows = [
        ("plater", f"{len(N['sheets'])} stk"),
        ("brukt av fyrste plata", f"{fmt(N['usedLen'])} mm av {fmt(N['sheetW'])}"),
        ("utnytting", f"{fmt(N['util'] * 100,0)} %"),
        ("delar", f"{STACK['parts']} stk"),
        ("snittbreidd, kompensert", "3 mm"),
    ]
    y3 = pg.table(pg.col1, y2 + int(14 * MM), rows, w=pg.body_w, size=8.6)
    pg.para(pg.col1, y3 + int(8 * MM),
        "Utnyttinga er rekna som verkeleg polygonareal delt på brukt plateflate — "
        "ikkje bounding box. Talet er lågt fordi ringane er annulusar: hòlet i "
        "midten er avfall. Men avfallet er ikkje spon. Det er skiver, og dei "
        "største av dei er akkurat emne til eit mindre objekt i same familie. Ein "
        "bør ikkje rekne dei som tap før ein har prøvd.")
    pg.foot(no)


@page
def p_calc(pg, no):
    y = pg.head(11, "Rekning", "Skalet er ikkje dimensjonert av styrke. Det "
                "er dimensjonert av plata.")
    ax = pg.ax(pg.col1, y, int(50 * MM), int(62 * MM))
    area_curve(ax)
    y2 = y
    rows = [
        ("lasttilfelle", "1600 N, NS-EN 1728"),
        ("minste tverrsnitt", f"{fmt(M['minSecArea'] / 100, 0)} cm² ved z = {fmt(M['minSecZ'])} mm"),
        ("trykkspenning", f"{fmt(M['sigmaC'],2)} MPa av {fmt(M['capC'],1)}"),
        ("bøyespenning", f"{fmt(M['sigmaM'],2)} MPa av {fmt(M['capM'],1)}"),
        ("samla utnytting", flag("utnytting", f"{fmt(M['util'] * 100,0)} %")),
        ("tyngdepunkt", f"{fmt(M['comZ'])} mm over golvet"),
        ("vippearm", f"{fmt(M['tipArm'])} mm"),
        ("veltevinkel", flag("velte", f"{fmt(M['tipAngle'],0)}°")),
    ]
    pg.table(pg.col1 + int(56 * MM), y2, rows, w=int(64 * MM), size=8.4)
    y3 = y + int(68 * MM)
    pg.caption(pg.col1, y3,
        "Tverrsnittsarealet gjennom høgda, cm² vassrett. Beina, midja og finnen "
        "les direkte av kurva; den stipla lina er det dimensjonerande snittet.",
        w=int(50 * MM))
    y4 = y3 + int(14 * MM)
    pg.para(pg.col1, y4,
        f"Utnyttinga er {fmt(M['util'] * 100,0)} prosent. Det er ikkje ei god nyheit — "
        "det tyder at massen er større enn konstruksjonen krev. Ville ein ned i "
        "vekt, måtte ein gå til tynnare finér, ikkje til tynnare skal: tretten "
        "millimeter er det som står att når ein har slipt slipemonet av eit "
        "femten millimeters lag og lagt inn ei klaring.\n\n"
        "Stabiliteten er rekna av geometri, ikkje målt. Ein krakk med rygg vert "
        "dratt bakover når nokon reiser seg, og NS-EN 1022 må prøvast fysisk.")
    pg.foot(no)


def _variant_page(pg, no, sel, first):
    y = pg.head(12 if first else "", "Tolv variantar" if first else "",
                "Kvar av dei svarar på eit spørsmål motoren stiller, og kvar "
                "av dei har ein grunn til å bli forkasta." if first else "")
    if not first:
        y = pg.MARGIN + int(14 * MM)
    w = (pg.body_w - int(8 * MM)) // 2
    for i, v in enumerate(sel):
        cx = pg.col1 + (i % 2) * (w + int(8 * MM))
        cy = y + (i // 2) * int(62 * MM)
        img = shot(v["mesh"], "v" + v["code"], az=34, el=16, size=(760, 820),
                   ss=2, ao=True)
        pg.img(cx, cy, int(34 * MM), int(37 * MM), img)
        pg.text(cx + int(37 * MM), cy + int(5 * MM), f"{v['code']}  {v['name']}",
                size=8.6, weight=500)
        pg.para(cx + int(37 * MM), cy + int(10 * MM), v["why"],
                w=w - int(37 * MM), size=7.2, color=INK_SOFT)
        pg.para(cx + int(37 * MM), cy + int(26 * MM), "Mot: " + v["against"],
                w=w - int(37 * MM), size=7.2, color=INK_FAINT)
        m = v["metrics"]
        pg.text(cx, cy + int(41 * MM),
                f"{fmt(m['envX'])} × {fmt(m['envY'])} × {fmt(m['envZ'])} mm · "
                f"sete {fmt(m['seatZ'])} · velte {fmt(m['tipAngle'],0)}° · "
                f"{fmt(m['mass'],1)} kg",
                size=7.0, color=INK_FAINT)
        if v["rules"]:
            pg.text(cx, cy + int(45 * MM), "bryt: " + ", ".join(v["rules"]),
                    size=7.0, color=WARN)
    pg.foot(no)


@page
def p_var1(pg, no):
    _variant_page(pg, no, D["variants"][:6], True)


@page
def p_var2(pg, no):
    _variant_page(pg, no, D["variants"][6:], False)
    pg.para(pg.col1, pg.h - pg.MARGIN - int(30 * MM),
        "Dei tolv er ikkje tolv idear. Dei er tolv snitt gjennom eitt "
        "parameterrom, og skilnaden mellom dei er tal, ikkje intensjon. Det er "
        "både styrken og faren ved metoden: han produserer variasjon lettare enn "
        "han produserer meining.", size=8.4)


@page
def p_rest(pg, no):
    y = pg.head(13, "Att", "Ærleg liste, i den rekkjefylgja eg ville teke dei.")
    items = [
        ("Bygg det", "Slipinga er den halve arbeidstida og er ikkje prøvd. Alt anna "
                     "i dette dokumentet er rekna; sliping må gjerast."),
        ("Prøv NS-EN 1022", "Veltevinkelen er rekna av geometri. Ein krakk med rygg "
                            "vert dratt bakover når nokon reiser seg."),
        ("Dybelplan i motoren", "Hòla er ikkje geometri enno. Dei bør leggjast der to "
                                "lag har mest overlapp, og det talet finst alt i stacken."),
        ("Ekte polygonnesting", "Hyllepakkinga sløser plate. Nesting inne i annulusane "
                                "er den eine endringa som løftar utnyttinga mest."),
        ("Klemfare", "Opningane mellom delane må vera anten under 5 mm eller over 25. "
                     "Regelen finst; geometrien som løyser han finst ikkje."),
        ("Kant mot golvet", "Beina endar i ein skarp kant. Ein liten fas eller ein filtknott."),
        ("Skiveavfallet", "Dei største hòlskivene er emne til eit mindre objekt. Prøv om "
                          "familien held seg i mindre målestokk."),
        ("Fargen", "Alt er rendra i naturleg bjørk. Kvitpigmentert olje er vald, men "
                   "ikkje prøvd mot flata."),
    ]
    for i, (k, v) in enumerate(items):
        pg.text(pg.col0, y, str(i + 1), size=8.4, color=INK_FAINT)
        pg.text(pg.col1, y, k, size=8.8, weight=500)
        y = pg.para(pg.col1, y + int(4.6 * MM), v, size=8.2, color=INK_SOFT)
        y += int(4 * MM)
    y += int(6 * MM)
    pg.label(pg.col1, y, "Kva metoden ikkje løyser")
    y = pg.para(pg.col1, y + int(6 * MM),
        "Ein generator gjer det billeg å lage variasjon og dyrt å lage brot. Dei "
        "tolv variantane er i slekt fordi dei kjem frå same likning. Eit objekt "
        "som verkeleg skil seg frå dei, kjem ikkje av å skru ein skyvar lenger — "
        "det kjem av å byte produksjonsveg, og det kostar nye modular. Kvar gong "
        "objektet har teke eit verkeleg steg i dette prosjektet, var det fordi "
        "noko utanfor likninga endra seg.", size=8.4)
    y += int(8 * MM)
    pg.label(pg.col1, y, "Kjelder")
    pg.para(pg.col1, y + int(5 * MM),
        "Metsä Wood, Handbook of Finnish Plywood (2023) — fastleik, tettleik og "
        "fuktrørsle for bjørkefinér. · NS-EN 1728:2012 — statiske lastar for "
        "sitjemøblar. · NS-EN 1022:2018 — stabilitetsprøving. · NS-EN 1995-1-1 — "
        "kmod og γM. · NS-EN 1729 og Pheasant, Bodyspace (2006) — setehøgd og "
        "setedjupn.", size=7.6, color=INK_SOFT)
    y += int(20 * MM)
    pg.label(pg.col1, y, "Kolofon")
    pg.para(pg.col1, y + int(5 * MM),
        "Geometri, måling og eksport: lib/skal/. Nett og render: doc/raster.py — "
        "eigen rasterisator med z-buffer, skuggekart og omgjevingsokklusjon, utan "
        "GPU. Sats: doc/sheet.py og doc/render.py. Reiskapen: "
        "50x50x50.iverfinne.no. Sett i Inter.", size=7.6, color=INK_SOFT)
    pg.foot(no)


# =============================================================================
def main():
    """PDF-en vert sett direkte av figurane, ikkje av PNG-ar. Då står
    teksten som tekst i fila — søkbar, kopierbar og skarp i kva som helst
    målestokk — og berre 3D-bileta er punktgrafikk."""
    t0 = time.time()
    pdf = os.path.join(OUT, "sandkasse.pdf")
    only = os.environ.get("SIDE")
    with PdfPages(pdf) as out:
        for i, fn in enumerate(pages):
            if only and str(i + 1) != only:
                continue
            pg = Page()
            fn(pg, i + 1)
            out.savefig(pg.fig, dpi=sheet.DPI, facecolor=sheet.PAPER)
            pg.fig.savefig(os.path.join(OUT, f"ark-{i + 1:02d}.png"),
                           dpi=110, facecolor=sheet.PAPER)
            plt.close(pg.fig)
            print(f"  sette ark {i + 1:02d}", flush=True)
        out.infodict()["Title"] = "SANDKASSE — 50 × 50 × 50"
        out.infodict()["Subject"] = ("Parametrisk rom for eit sitjemøbel i "
                                     "stabla bjørkefinér")
    print(f"skreiv {pdf}  ({len(pages)} sider, {time.time() - t0:.0f} s)")


if __name__ == "__main__":
    main()
