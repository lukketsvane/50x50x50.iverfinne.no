# -*- coding: utf-8 -*-
"""
Arket.

Typografi og sats for mappa. Alt som har med side, spalte, strek og
skrift å gjere ligg her; render.py held seg til innhaldet. Grunnen er
banal, men han er den same som i resten av prosjektet: når satsen er ein
funksjon, kan ingen side kome i utakt med ei anna.

A4 ståande, 200 dpi. Koordinatane er piksel med origo øvst til venstre,
fordi det er slik ein les eit ark.
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

HERE = os.path.dirname(os.path.abspath(__file__))
DPI = 200
MM = DPI / 25.4                      # piksel per millimeter
A4 = (int(210 * MM), int(297 * MM))  # 1653 x 2339

INK       = "#111111"
INK_SOFT  = "#5A6066"
INK_FAINT = "#9AA0A6"
HAIR      = "#C3C8CC"
WARN      = "#B3261E"
PAPER     = "#FFFFFF"

_FAM = None


def _fonts():
    """Inter i fire vekter. Fell tilbake til det systemet har om filene
    manglar — eit dokument som ikkje let seg setje er verre enn eit som
    er sett i feil skrift."""
    global _FAM
    if _FAM is not None:
        return _FAM
    d = os.path.join(HERE, "fonts")
    found = []
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".ttf", ".otf")):
                path = os.path.join(d, f)
                font_manager.fontManager.addfont(path)
                found.append(font_manager.FontProperties(fname=path).get_name())
    _FAM = found[0] if found else "DejaVu Sans"
    plt.rcParams["font.family"] = _FAM
    plt.rcParams["pdf.fonttype"] = 42     # legg skrifta inn som TrueType
    plt.rcParams["ps.fonttype"] = 42
    plt.rcParams["axes.unicode_minus"] = False
    return _FAM


def new_fig(w=A4[0], h=A4[1]):
    _fonts()
    fig = plt.figure(figsize=(w / DPI, h / DPI), dpi=DPI)
    fig.patch.set_facecolor(PAPER)
    return fig


class Page:
    """Eit ark. Alle mål i piksel, origo øvst til venstre."""

    # spaltene: ei smal margspalte for tittel og bisetning, ei brei for saka
    MARGIN = int(18 * MM)
    SIDE_W = int(46 * MM)
    GAP = int(8 * MM)

    def __init__(self, w=A4[0], h=A4[1], stamp="50 × 50 × 50 · SANDKASSE"):
        self.w, self.h = w, h
        self.fig = new_fig(w, h)
        self.stamp = stamp
        self.col0 = self.MARGIN
        self.col1 = self.MARGIN + self.SIDE_W + self.GAP
        self.right = w - self.MARGIN
        self.body_w = self.right - self.col1

    # --- primitiv ---------------------------------------------------------
    def _r(self, x, y, w, h):
        return [x / self.w, 1 - (y + h) / self.h, w / self.w, h / self.h]

    def ax(self, x, y, w, h, frame=False):
        a = self.fig.add_axes(self._r(x, y, w, h))
        a.set_axis_off() if not frame else None
        a.set_xticks([])
        a.set_yticks([])
        for s in a.spines.values():
            s.set_visible(False)
        return a

    def text(self, x, y, s, size=9.5, weight=400, color=INK, ha="left",
             va="baseline", tracking=0.0, alpha=1.0, style="normal"):
        t = self.fig.text(
            x / self.w, 1 - y / self.h, s, fontsize=size, color=color,
            ha=ha, va=va, alpha=alpha, style=style,
            fontweight=int(weight) if isinstance(weight, (int, float)) else weight,
        )
        if tracking:
            # matplotlib har ingen bokstavavstand; sperr manuelt
            t.set_text(" ".join(s)) if False else None
        return t

    def label(self, x, y, s, size=7.6, color=INK_FAINT, ha="left"):
        """Etikett: sperra versalar. Bokstavavstanden vert lagd inn i
        strengen fordi matplotlib ikkje kjenner letter-spacing."""
        return self.text(x, y, " ".join(s.upper()), size=size,
                         weight=500, color=color, ha=ha)

    def rule(self, x0, x1, y, color=HAIR, lw=0.8):
        a = self.fig.add_axes([0, 0, 1, 1], zorder=0)
        a.set_axis_off()
        a.set_xlim(0, self.w)
        a.set_ylim(self.h, 0)
        a.patch.set_alpha(0)
        a.plot([x0, x1], [y, y], color=color, lw=lw, solid_capstyle="butt")
        return a

    def para(self, x, y, s, w=None, size=9.2, leading=1.55, color=INK,
             weight=400, chars=None):
        """Brødtekst med enkel ombrekking. Talet på teikn per line vert
        rekna av spaltebreidda, ikkje gjetta."""
        w = w or self.body_w
        chars = chars or max(20, int(w / (size * DPI / 72 * 0.50)))
        lines = []
        for block in s.split("\n"):
            cur = ""
            for word in block.split():
                if len(cur) + len(word) + 1 <= chars:
                    cur = (cur + " " + word).strip()
                else:
                    lines.append(cur)
                    cur = word
            lines.append(cur)
        dy = size * DPI / 72 * leading
        for i, ln in enumerate(lines):
            self.text(x, y + i * dy, ln, size=size, color=color, weight=weight)
        return y + len(lines) * dy

    # --- fast sats --------------------------------------------------------
    def head(self, no, title, lead):
        self.text(self.col0, self.MARGIN + 28, str(no), size=10,
                  weight=500, color=INK_FAINT)
        self.text(self.col1, self.MARGIN + 32, title, size=19, weight=600)
        self.rule(self.col0, self.right, self.MARGIN + 54)
        if lead:
            self.para(self.col0, self.MARGIN + 84, lead, w=self.SIDE_W,
                      size=8.6, color=INK_SOFT, leading=1.5)
        return self.MARGIN + int(22 * MM)

    def foot(self, no, note=None):
        y = self.h - self.MARGIN - int(6 * MM)
        self.rule(self.col0, self.right, y - int(5 * MM))
        self.text(self.col0, y, str(no), size=8, color=INK_FAINT, weight=500)
        self.text(self.right, y, self.stamp, size=8, color=INK_FAINT, ha="right")
        if note:
            self.text(self.col1, y, note, size=8, color=INK_FAINT)

    def caption(self, x, y, s, w=None, size=7.4):
        return self.para(x, y, s, w=w or self.body_w, size=size,
                         color=INK_SOFT, leading=1.45)

    def table(self, x, y, rows, w=None, size=8.6, gap=None, rule_every=None):
        """To kolonnar: etikett til venstre, tal til høgre. Tabulartal."""
        w = w or self.body_w
        gap = gap or size * DPI / 72 * 1.9
        for i, (k, v) in enumerate(rows):
            yy = y + i * gap
            col = WARN if (isinstance(v, str) and v.startswith("!")) else INK
            vv = v[1:] if isinstance(v, str) and v.startswith("!") else v
            self.text(x, yy, k, size=size, color=INK_SOFT)
            self.text(x + w, yy, str(vv), size=size, color=col, ha="right")
            if rule_every and (i + 1) % rule_every == 0:
                self.rule(x, x + w, yy + gap * 0.32, lw=0.5)
        return y + len(rows) * gap

    def img(self, x, y, w, h, arr):
        a = self.ax(x, y, w, h)
        a.imshow(arr, interpolation="lanczos", aspect="auto")
        return a

    def save(self, path):
        self.fig.savefig(path, dpi=DPI, facecolor=PAPER)
        plt.close(self.fig)
        return path


def draw_polys(ax, polys, lw=0.6, color=INK, fill=None, alpha=1.0):
    """Teiknar lukka polygon i millimeter i eit akse med lik målestokk."""
    for p in polys:
        if len(p) < 2:
            continue
        xs = [q[0] for q in p] + [p[0][0]]
        ys = [q[1] for q in p] + [p[0][1]]
        if fill:
            ax.fill(xs, ys, color=fill, lw=0, alpha=alpha, zorder=1)
        ax.plot(xs, ys, color=color, lw=lw, alpha=alpha,
                solid_joinstyle="round", zorder=2)


def equal(ax, x0, x1, y0, y1, pad=0.04):
    """Lik målestokk i begge retningar, med luft rundt."""
    dx, dy = x1 - x0, y1 - y0
    ax.set_xlim(x0 - dx * pad, x1 + dx * pad)
    ax.set_ylim(y0 - dy * pad, y1 + dy * pad)
    ax.set_aspect("equal")
    ax.set_axis_off()
