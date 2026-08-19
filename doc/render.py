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
         ss=3, stripes=True, ao=True, shadow=True, dist=None, fov=26, pad=3.1):
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
    # Skuggen ligg utanfor objektet og vert kappa av biletkanten om ein
    # rammar inn etter omhyllinga åleine. `pad` er difor romsleg her.
    cam = raster.look(az, el, dist or span * pad, target=ctr, ortho=ortho,
                      fov=fov, ortho_scale=span * (pad / 2.75))
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


def contour_map(ax, every=5, lw_thin=0.3, lw_bold=0.85):
    """Konturkartet: alle laga lagde oppå kvarandre, sett ovanfrå.

    Ytterkantane står fyrst og tynt, så dei tunge laga oppå. Hòla vert
    teikna svakare enn ytterkantane — dei er ikkje ein kant på objektet,
    dei er det som er teke bort, og teiknar ein dei like tungt vert kartet
    ei floke i staden for eit snitt."""
    for L in STACK["layers"]:
        if L["i"] % every == 0:
            continue
        # berre ytterkanten på dei tynne laga: teiknar ein hòla òg, vert
        # kartet ei floke og ikkje eit snitt
        draw_polys(ax, [q["outline"] for q in L["parts"]], lw=lw_thin,
                   color="#A7ADB2")
    for L in STACK["layers"]:
        if L["i"] % every:
            continue
        draw_polys(ax, [q["outline"] for q in L["parts"]], lw=lw_bold, color=INK)
        for q in L["parts"]:
            draw_polys(ax, q["holes"], lw=lw_bold * 0.6, color=INK_SOFT)
    xs = [c[0] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    ys = [c[1] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    equal(ax, min(xs), max(xs), min(ys), max(ys))


def field_image(ax):
    F = D["field"]
    v = np.array(F["values"], dtype=float).reshape(F["nh"], F["nth"])
    over = np.array(F.get("above", [0] * (F["nh"] * F["nth"])),
                    dtype=float).reshape(F["nh"], F["nth"])
    # Grått er opning; kvitt er både gods og lufta over rimet. Dei to
    # kvite flatene vert skilde av rimkurva åleine, som er den rette
    # lesinga: over rimet er det ikkje eit hòl, det er ingen ting.
    tone = np.where((v >= 1.0) | (over > 0.5), 1.0, 0.32)
    ax.imshow(tone, cmap="gray", vmin=0, vmax=1, origin="lower",
              extent=[0, 360, 0, D["zTop"]], aspect="auto",
              interpolation="nearest")
    lay = np.where(over > 0.5, np.nan, 1.0)
    for L in STACK["layers"]:
        ax.axhline(L["z1"], color="#00000026", lw=0.3,
                   xmax=1.0 if np.nansum(lay) else 1.0)
    zs = np.linspace(0, D["zTop"], F["nh"])
    rim = [zs[np.max(np.nonzero(over[:, i] < 0.5)[0])] if (over[:, i] < 0.5).any() else 0
           for i in range(F["nth"])]
    ax.plot(np.linspace(0, 360, F["nth"]), rim, color=INK, lw=1.2)
    # skjul hjelpelinjene over rimet ved å legge papir oppå
    ax.fill_between(np.linspace(0, 360, F["nth"]), rim, D["zTop"],
                    color=sheet.PAPER, lw=0, zorder=2)
    ax.plot(np.linspace(0, 360, F["nth"]), rim, color=INK, lw=1.2, zorder=3)
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
    ax.set_xlabel("cm²", fontsize=6.2, color=INK_FAINT, labelpad=1)
    ax.set_ylabel("mm over golvet", fontsize=6.2, color=INK_FAINT, labelpad=1)
    ax.text(max(a) * 0.98, M["minSecZ"], " minste snitt", fontsize=6.2,
            color=WARN, va="center", ha="right")


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
    # Forklaringa ligg under ruta, ikkje oppi kurvene: tre kurver som
    # kryssar kvarandre har inga hjørne å gøyme ei ramme i.
    ax.legend(fontsize=6.2, frameon=False, ncol=3, labelcolor=INK_SOFT,
              handlelength=2.2, loc="upper center",
              bbox_to_anchor=(0.5, -0.03), columnspacing=1.4)


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
    img = shot("skal.f32", "front", az=300, el=17, size=(1420, 1560), ss=2)
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
    img = shot("skal.f32", "space", az=126, el=14, size=(470, 640), ss=2, pad=4.4)
    pg.img(pg.right - int(46 * MM), y, int(46 * MM), int(60 * MM), img)
    yy = y
    for g in D["groups"]:
        pg.label(pg.col1, yy, g["label"])
        yy += int(5.4 * MM)
        rows = []
        for k in g["keys"]:
            r = D["ranges"][k]
            unit = r.get("unit", "")
            # talet på desimalar kjem av steget i bandet, ikkje av kor stor
            # verdien tilfeldigvis er: 18 grader skal ikkje stå som 18,00
            d = 0 if r.get("int") or r["step"] >= 1 else 1 if r["step"] >= 0.1 else 2
            rows.append((r["label"],
                         f"{fmt(P[k], d)}{(' ' + unit) if unit else ''}"
                         f"   [{fmt(r['min'], d)} – {fmt(r['max'], d)}]"))
        yy = pg.table(pg.col1, yy, rows, w=int(84 * MM), size=7.6,
                      gap=int(3.5 * MM))
        yy += int(3.4 * MM)
    pg.side(y + int(70 * MM),
        "Talet i midten er verdien objektet står på. Klammene er bandet "
        "motoren tillèt. Utanfor bandet finst det ingen krakk — berre tal.",
        size=7.8)
    pg.foot(no)


@page
def p_field(pg, no):
    y = pg.head(3, "Feltet", "Rullar ein flata ut, vert objektet eit "
                "rektangel. Kvar opning er ei likning i det rektangelet.")
    ax = pg.ax(pg.col1, y, pg.body_w, int(88 * MM))
    field_image(ax)
    y2 = y + int(97 * MM)
    y2 = pg.caption(pg.col1, y2,
        "Vinkel til høgre, høgd oppover. Grå flater er opningar, tynne linjer "
        f"er dei {STACK['count']} laga, og den tjukke kurva øvst er rimet.")
    y3 = y2 + int(10 * MM)
    y3 = pg.para(pg.col1, y3,
        "Ei opning er ikkje eit hòl som vert skore etterpå. Ho er ein del av "
        "likninga: der feltverdien fell under éin, er det ikkje material. Fordi "
        f"sentrum for sveipet vandrar {fmt(abs(P['sweepDrift']))} grader over høgda, "
        "sveipar opninga diagonalt kring kroppen — og fordi eksponenten er "
        f"{fmt(P['sweepExp'],2)}, altså under to, får ho spisse endar i staden for runde.")
    y3 += int(4 * MM)
    rows = [
        ("beinopningar", f"{int(P['legs'])} × {fmt(P['legGap'])}°, senter under golvet"),
        ("sveipet", f"{fmt(P['sweepSpan'])}° breitt, vandrar {fmt(abs(P['sweepDrift']))}°"),
        ("rimet finst", flag("rim", f"{fmt(M['rimSpan'])}° av 360°")),
        ("eggkant ved opningane", f"{fmt(P['edgeT'],1)} mm av {fmt(P['shellT'],0)} mm"),
    ]
    y4 = pg.table(pg.col1, y3 + int(10 * MM), rows, w=pg.body_w, size=8.4)
    pg.para(pg.col1, y4 + int(10 * MM),
        "Dei tre nedste opningane har sentrum under golvplanet. Det som står "
        "att mellom dei, er bein — og fordi kvar opning har si eiga breidd, er "
        "ingen av dei like. Den fjerde opninga ligg høgt og er det einaste som "
        "skjer på baksida; utan henne har objektet ei daud side.")
    pg.side(y3,
        "Utan eggkanten les opningane som dører skorne i ein vegg i staden for "
        "som noko flata sjølv gjer.")
    pg.foot(no)


@page
def p_laws(pg, no):
    y = pg.head(4, "Snittet", "Snittet er ein superellipse. Det som gjer "
                "objektet, er kva som skjer med snittet på vegen opp.")
    ax = pg.ax(pg.col1, y, int(56 * MM), int(80 * MM))
    law_curves(ax)
    img = shot("skal.f32", "side", az=120, el=3, ortho=True,
               size=(540, 800), ss=2, shadow=False, pad=3.0)
    pg.img(pg.col1 + int(60 * MM), y, int(60 * MM), int(84 * MM), img)
    y2 = y + int(90 * MM)
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
    y += int(8 * MM)
    for r in D["rules"]:
        col = WARN if not r["ok"] else INK
        pg.text(pg.col0 + int(30 * MM), y, "hard" if r["hard"] else "mjuk",
                size=7.2, color=INK_FAINT, ha="right")
        pg.text(pg.col1, y, r["label"], size=8.6, weight=500, color=col)
        pg.text(pg.right, y, r["value"], size=8.6, color=col, ha="right")
        y = pg.para(pg.col1, y + int(4.0 * MM), r["why"], size=7.0,
                    color=INK_FAINT, leading=1.35)
        pg.rule(pg.col1, pg.right, y - int(1.4 * MM), lw=0.4)
        y += int(2.2 * MM)
    n_bad = sum(1 for r in D["rules"] if not r["ok"])
    pg.para(pg.col1, y + int(3 * MM),
        f"Objektet på dei neste sidene bryt {n_bad} av {len(D['rules'])} reglar."
        + ("" if n_bad == 0 else " Dei står raudt der dei slår ut."),
        size=8.6)
    pg.para(pg.col0, pg.h - pg.MARGIN - int(30 * MM),
        "Reglane er eit golv, ikkje ein dom. Å halde alle fjorten gjer ikkje "
        "eit objekt godt — det gjer det berre mogleg.",
        w=pg.SIDE_W, size=8.2, color=INK_SOFT)
    pg.foot(no)


@page
def p_object(pg, no):
    y = pg.head(6, "Objektet", "Same objekt frå fire vinklar. Det er ikkje "
                "eit uhell at det er ulikt frå kvar — snittet roterer.")
    w = (pg.body_w - int(4 * MM)) // 2
    h = int(60 * MM)
    for i, (key, az) in enumerate([("o0", 30), ("o1", 120), ("o2", 210), ("o3", 300)]):
        img = shot("skal.f32", key, az=az, el=14, size=(700, 760), ss=2, pad=3.9)
        pg.img(pg.col1 + (i % 2) * (w + int(4 * MM)),
               y + (i // 2) * (h + int(3 * MM)), w, h, img)
        pg.text(pg.col1 + (i % 2) * (w + int(4 * MM)),
                y + (i // 2) * (h + int(3 * MM)) + h - int(2 * MM),
                f"{az}°", size=7.2, color=INK_FAINT)
    y2 = y + 2 * h + int(10 * MM)
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
    y3 = pg.table(pg.col1, y2, rows, w=pg.body_w, size=8.6)
    pg.side(y2,
        "Setehøgda ligg nedst i det brukbare bandet. Det er valt: ein rygg krev "
        "at setet kjem ned, elles kjem ryggen for høgt i kuben.")
    pg.para(pg.col1, y3 + int(10 * MM),
        "Alle tala over er målte på geometrien etter at ho er passa inn i "
        "kuben, ikkje lesne av parametrane. Det er ikkje det same: skalet vert "
        "skalert ned til det står inne i dei 500 millimetrane, og då er "
        "setehøgda ein ville ha og setehøgda ein fekk to ulike tal.")
    pg.foot(no)


@page
def p_seat(pg, no):
    y = pg.head(7, "Setet", "Setet er ikkje ei plate. Det er toppen av same "
                "flata, med skåla skoren inn i dei øvste laga.")
    img = shot("skal.f32", "top", az=0, el=89, ortho=True, size=(820, 820),
               ss=2, shadow=False, pad=3.0)
    pg.img(pg.col1, y, int(60 * MM), int(76 * MM), img)
    ax = pg.ax(pg.col1 + int(62 * MM), y, int(58 * MM), int(76 * MM))
    for L in STACK["layers"]:
        if L["z0"] < P["seatZ"] - P["dish"] - P["shellT"] - P["plyT"]:
            continue
        draw_polys(ax, layer_polys(L), lw=0.5, color=INK)
    xs = [c[0] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    ys = [c[1] for L in STACK["layers"] for p in layer_polys(L) for c in p]
    equal(ax, min(xs), max(xs), min(ys), max(ys))
    y2 = y + int(82 * MM)
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
    ax = pg.ax(pg.col1, y, int(84 * MM), int(84 * MM))
    contour_map(ax)
    six = [STACK["layers"][i] for i in
           np.linspace(0, len(STACK["layers"]) - 1, 6).astype(int)]
    bw = int(17 * MM)
    for i, L in enumerate(six):
        a = pg.ax(pg.col1 + int(84 * MM), y + i * int(13.6 * MM), bw, int(12 * MM))
        draw_polys(a, layer_polys(L), lw=0.5, color=INK)
        xs = [c[0] for p in layer_polys(L) for c in p] or [0]
        ys = [c[1] for p in layer_polys(L) for c in p] or [0]
        allx = [c[0] for LL in STACK["layers"] for p in layer_polys(LL) for c in p]
        ally = [c[1] for LL in STACK["layers"] for p in layer_polys(LL) for c in p]
        equal(a, min(allx), max(allx), min(ally), max(ally))
        pg.text(pg.col1 + int(102 * MM), y + i * int(13.6 * MM) + int(6 * MM),
                f"lag {L['i'] + 1} · z {fmt(L['z0'])}", size=7.2, color=INK_SOFT)
        pg.text(pg.col1 + int(102 * MM), y + i * int(13.6 * MM) + int(9.6 * MM),
                f"{len(L['parts'])} " + ("del" if len(L["parts"]) == 1 else "delar"),
                size=7.2, color=INK_FAINT)
    y2 = y + int(90 * MM)
    y2 = pg.caption(pg.col1, y2,
        "Konturkartet er alle laga lagde oppå kvarandre, sett ovanfrå — "
        "samstundes plan og kuttdata. Kvart femte lag med heil strek.",
        w=int(84 * MM))
    rows = [
        ("lag", f"{STACK['count']} à {fmt(P['plyT'],0)} mm"),
        ("delar", f"{STACK['parts']} stk"),
        ("finérareal", f"{fmt(STACK['area'] / 10000, 0)} dm²"),
        ("masse som kutta", f"{fmt(STACK['mass'],1)} kg"),
        ("slipemon på ytterkanten", f"{fmt(P['sand'],1)} mm"),
    ]
    y3 = pg.table(pg.col1, y2 + int(10 * MM), rows, w=pg.body_w, size=8.6)
    pg.side(y,
        "Dei nedste laga er fleire lause delar — beina. Frå det laget der "
        "beinopningane sluttar og opp er dei lukka ringar, heilt til sveipet "
        "opnar dei att.")
    pg.para(pg.col1, y3 + int(10 * MM),
        "Ei teikning av dette objektet kan ikkje vera eit oppriss med mål på. "
        "Flata har ingen rette kantar og ingen radiussenter. Det som kan "
        "målast, er laga: like mange lukka konturar i kjend høgd, og kvar av "
        "dei er både det som skal skjerast og det som kan kontrollmålast "
        "etterpå.")
    pg.foot(no)


@page
def p_build(pg, no):
    y = pg.head(9, "Kutta og slipt", "Til venstre slik det kjem ut av "
                "fresen, til høgre slik det står ferdig.")
    w = (pg.body_w - int(4 * MM)) // 2
    # Same kamera og same avstand på begge: heile poenget er at det er
    # eitt objekt i to tilstandar, og då kan ikkje innramminga skifte.
    pg.img(pg.col1, y, w, int(72 * MM),
           shot("lag.f32", "cut", az=300, el=16, size=(700, 760), ss=2,
                stripes=False, pad=4.1, dist=480 * 4.1))
    pg.img(pg.col1 + w + int(4 * MM), y, w, int(72 * MM),
           shot("skal.f32", "sanded", az=300, el=16, size=(700, 760), ss=2,
                pad=4.1, dist=480 * 4.1))
    y2 = y + int(76 * MM)
    pg.caption(pg.col1, y2,
        f"Som kutta: {STACK['count']} lag, ytterkanten skoren {fmt(P['sand'],1)} mm "
        "utanfor den ferdige flata. Som slipt: limfugene står att som eit mønster "
        f"med {fmt(P['plyT'],0)} millimeters avstand i høgda — tett der flata er "
        "bratt, spreidd der ho legg seg ned.")
    y3 = y2 + int(12 * MM)
    steps = [
        ("Kutting", f"Kvart lag er ein lukka kontur i {fmt(P['plyT'],0)} mm bjørkefinér. "
                    f"Ytre kant får {fmt(P['sand'],1)} mm slipemon; indre kant vert ståande."),
        ("Stabling", "To dybelhòl Ø8 mm per del. Dybelen er den einaste posisjoneringa "
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
    ax = pg.ax(pg.col1, y, pg.body_w, int(66 * MM))
    sheet_plot(ax, 0)
    y2 = y + int(72 * MM)
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
    ax = pg.ax(pg.col1, y, int(52 * MM), int(80 * MM))
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
    y3 = y + int(86 * MM)
    y3 = pg.caption(pg.col1, y3,
        "Tverrsnittsarealet gjennom høgda, cm² vassrett. Beina, midja og "
        "ryggen les direkte av kurva; den stipla lina er det dimensjonerande "
        "snittet.", w=int(52 * MM))
    y4 = y3 + int(10 * MM)
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
    if first:
        y = pg.head(12, "Tolv variantar",
                    "Kvar av dei svarar på eit spørsmål motoren stiller, og "
                    "kvar av dei har ein grunn til å bli forkasta.")
    else:
        pg.head("", "", "")
        y = pg.MARGIN + int(14 * MM)
    w = (pg.body_w - int(7 * MM)) // 2
    iw = int(33 * MM)
    tw = w - iw - int(3 * MM)
    row = int(74 * MM)
    for i, v in enumerate(sel):
        cx = pg.col1 + (i % 2) * (w + int(7 * MM))
        cy = y + (i // 2) * row
        img = shot(v["mesh"], "v" + v["code"], az=300, el=16, size=(440, 470),
                   ss=2, ao=True, pad=3.8)
        pg.img(cx, cy, iw, int(37 * MM), img)
        tx = cx + iw + int(3 * MM)
        pg.text(tx, cy + int(4 * MM), f"{v['code']}  {v['name']}",
                size=8.4, weight=500)
        ty = pg.para(tx, cy + int(9 * MM), v["why"], w=tw, size=7.0,
                     color=INK_SOFT, leading=1.42)
        pg.para(tx, ty + int(2.4 * MM), "Mot: " + v["against"], w=tw,
                size=7.0, color=INK_FAINT, leading=1.42)
        m = v["metrics"]
        pg.rule(cx, cx + w, cy + int(58 * MM), lw=0.5)
        pg.text(cx, cy + int(62 * MM),
                f"{fmt(m['envX'])} × {fmt(m['envY'])} × {fmt(m['envZ'])} mm · "
                f"sete {fmt(m['seatZ'])} · {fmt(m['tipAngle'],0)}° · "
                f"{fmt(m['mass'],1)} kg",
                size=6.8, color=INK_FAINT)
        if v["rules"]:
            pg.text(cx, cy + int(66 * MM), "bryt: " + ", ".join(v["rules"]),
                    size=6.8, color=WARN)
    pg.foot(no)


@page
def p_var1(pg, no):
    _variant_page(pg, no, D["variants"][:6], True)


@page
def p_var2(pg, no):
    _variant_page(pg, no, D["variants"][6:], False)
    # Slutningen står i margen: hovudspalta er full av variantar, og
    # ei setning som skal lesast til slutt skal ikkje måtte klemme seg
    # inn mellom to måltal.
    pg.para(pg.col0, pg.MARGIN + int(14 * MM),
        "Dei tolv er ikkje tolv idear. Dei er tolv snitt gjennom eitt "
        "parameterrom, og skilnaden mellom dei er tal, ikkje intensjon.\n\n"
        "Det er både styrken og faren ved metoden: han produserer variasjon "
        "lettare enn han produserer meining.\n\n"
        "Difor står dei her, med grunngjeving og motargument, og ikkje som "
        "ein meny i reiskapen. Ein meny ville gjort argumentet om til eit "
        "val, og då slepp ingen å forsvare noko.",
        w=pg.SIDE_W, size=8.2, color=INK_SOFT)


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
        y += int(3.4 * MM)

    y += int(4 * MM)
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
    y = pg.para(pg.col1, y + int(5 * MM),
        "Metsä Wood, Handbook of Finnish Plywood (2023) — fastleik, tettleik og "
        "fuktrørsle for bjørkefinér. · NS-EN 1728:2012 — statiske lastar for "
        "sitjemøblar. · NS-EN 1022:2018 — stabilitetsprøving. · NS-EN 1995-1-1 — "
        "kmod og materialfaktoren. · NS-EN 1729 og Pheasant, Bodyspace (2006) — "
        "setehøgd og setedjupn.", size=7.6, color=INK_SOFT)

    y += int(7 * MM)
    pg.label(pg.col1, y, "Kolofon")
    pg.para(pg.col1, y + int(5 * MM),
        "Geometri, måling og eksport: lib/skal/. Nett og render: doc/raster.py — "
        "eigen rasterisator med z-buffer, skuggekart og omgjevingsokklusjon, "
        "utan GPU. Sats: doc/sheet.py og doc/render.py. Reiskapen: "
        "50x50x50.iverfinne.no. Sett i Inter.", size=7.6, color=INK_SOFT)
    pg.foot(no)


# =============================================================================
def main():
    """PDF-en vert sett direkte av figurane, ikkje av PNG-ar. Då står
    teksten som tekst i fila — søkbar, kopierbar og skarp i kva som helst
    målestokk — og berre 3D-bileta er punktgrafikk."""
    t0 = time.time()
    # SIDE=n set berre ei side, til korrektur. Då vert det ikkje skrive
    # nokon PDF: ein PDF med éi side ser ferdig ut og er det ikkje.
    only = os.environ.get("SIDE")
    pdf = os.path.join(OUT, "sandkasse-side.pdf" if only else "sandkasse.pdf")
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
    if only:
        os.remove(pdf)
        print(f"sette berre ark {only} ({time.time() - t0:.0f} s) — ingen PDF")
    else:
        print(f"skreiv {pdf}  ({len(pages)} sider, {time.time() - t0:.0f} s)")


if __name__ == "__main__":
    main()
