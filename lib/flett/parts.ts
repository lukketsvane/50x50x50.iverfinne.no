/**
 * FLETT — delane.
 *
 * Typologien har TO kuttlister, og det er den einaste i sandkassen som
 * har det. Ramma er finérplate: ringen kan ikkje bøyast av eitt stykke —
 * atten millimeter kryssfinér krev ein radius på over to meter — so han
 * vert skoren som BOGESEGMENT som ligg flatt på plata og vert lappa i
 * skøytane. Banda er finér i eit heilt anna godstal, og dei er lange,
 * smale rektangel: kuttlengda er den VEVDE veglengda, ikkje spennet, og
 * ho er ulik for kvart einaste band av di planet er ei superellipse.
 *
 * Nesting av lange smale rektangel er eit anna problem enn nesting av
 * store profilar. Difor står dei to listene kvar for seg heilt fram til
 * arket.
 */
import { MATERIALS, bbox, shoelace, type Material, type Pt } from "../core"
import type { Part, PartList } from "../vaffel/parts"
import { bowGeom, type Weave } from "./weave"

const DEG = Math.PI / 180

function shapeKey(o: Pt[]): string {
  const b = bbox(o)
  const r = (v: number) => Math.round(v * 5)
  return o.map((q) => `${r(q[0] - b.x0)},${r(q[1] - b.y0)}`).join(";")
}

function mkList(parts: Part[]): PartList {
  const seen = new Map<string, string>()
  const ids: string[] = []
  for (const q of parts) {
    const key = q.id.slice(0, 1) + "|" + shapeKey(q.outline)
    let id = seen.get(key)
    if (!id) {
      id = `${q.id.slice(0, 1)}${String(ids.length + 1).padStart(2, "0")}`
      seen.set(key, id)
      ids.push(id)
    }
    q.id = id
  }
  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}

const mk = (tag: string, outline: Pt[], t: number, rho: number): Part => {
  const area = Math.abs(shoelace(outline))
  return { id: tag, outline, holes: [], t, area, mass: (area * t * rho) / 1e9 }
}

/** eit rektangel med hjørna i (0,0) og (w,h) */
const rect = (w: number, h: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
]

export function buildParts(w: Weave): { ramme: PartList; band: PartList } {
  const p = w.p
  const rho = MATERIALS[p.material as Material].rho

  // --- ramma ---------------------------------------------------------------
  const R: Part[] = []
  // Ein lukka hank vert skoren i fire segment med lapp i skøytane; ein
  // kutta ring er alt delt av lukkinga, og lange bogar vert kløyvde slik
  // at ingen del er breiare enn eit halvt ark.
  const segs: [number, number][] = []
  for (const [t0, t1] of w.arcs) {
    let span = t1 - t0
    while (span <= 0) span += Math.PI * 2
    const n = Math.max(1, Math.ceil(span / (95 * DEG)))
    const lap = w.arcs.length === 1 ? 6 * DEG : 0
    for (let i = 0; i < n; i++) {
      segs.push([t0 + (span * i) / n - lap, t0 + (span * (i + 1)) / n + lap])
    }
  }
  for (const [t0, t1] of segs) {
    let span = t1 - t0
    while (span <= 0) span += Math.PI * 2
    const N = Math.max(8, Math.round((span / DEG) / 4))
    const out: Pt[] = []
    for (let i = 0; i <= N; i++) {
      const th = t0 + (span * i) / N
      const r = w.innR(th) + p.rammeH
      out.push([r * Math.cos(th), r * Math.sin(th)])
    }
    for (let i = N; i >= 0; i--) {
      const th = t0 + (span * i) / N
      const r = w.innR(th)
      out.push([r * Math.cos(th), r * Math.sin(th)])
    }
    R.push(mk("R", out, p.rammeT, rho))
  }

  // beina: same blad, fire gonger
  {
    const zTop = w.zRim(0) + w.rimOff - p.rammeT
    const rot = Math.min(p.rammeH * 1.7, Math.max(p.beinB * 1.35, p.beinB + 24))
    const dR = Math.tan(p.spreie * DEG) * zTop
    const fas = Math.min(p.fotfas, p.beinB / 2 - 6)
    const L: Pt[] = []
    const Rr: Pt[] = []
    const put = (t: number, shrink: number) => {
      const z = zTop * (1 - t)
      const c = dR * t
      const hw =
        p.beinB / 2 +
        ((rot - p.beinB) / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, p.bogeN)), 1 / p.bogeN) -
        shrink
      L.push([c - hw, z])
      Rr.push([c + hw, z])
    }
    for (let i = 0; i <= 16; i++) put(i / 16, 0)
    if (fas > 0.5) {
      L.pop(); Rr.pop()
      put(1 - fas / Math.max(1, zTop), 0)
      put(1, fas)
    }
    const blad = [...L, ...Rr.slice().reverse()]
    for (let i = 0; i < w.legs.length; i++) {
      R.push(mk("B", blad.map((q) => [q[0], q[1]] as Pt), p.rammeT, rho))
    }
  }

  // tverrbanda når ringen er kløyvd framme og bak
  if (p.rammetype === 1) {
    for (let i = 0; i < 2; i++) R.push(mk("T", rect(w.b * 1.88, p.rammeH * 0.8), p.rammeT, rho))
  }

  // ryggbogen og dei to stolpane, utbretta i sitt eige plan
  if (p.ryggH >= 30) {
    const g = bowGeom(w)
    const out: Pt[] = []
    const N = 22
    for (let i = 0; i <= N; i++) {
      const y = -g.bwE + (2 * g.bwE * i) / N
      out.push([y, Math.max(18, g.tTop * g.arch(y))])
    }
    for (let i = N; i >= 0; i--) {
      const y = -g.bwE + (2 * g.bwE * i) / N
      out.push([y, Math.max(6, g.tVev * g.arch(y))])
    }
    R.push(mk("G", out, p.rammeT, rho))
    for (let i = 0; i < 2; i++) {
      const zt = Math.max(24, g.tTop * g.arch(g.bwE * 0.8))
      R.push(mk("S", rect(p.rammeH * 0.42, zt + p.rammeT), p.rammeT, rho))
    }
  }

  // --- banda ---------------------------------------------------------------
  // Kvart band er ein rett strimmel FØR han vert vevd. Lengda er den vevde
  // veglengda: spennet pluss krypet frå over-under-svingane pluss tampen.
  const Bd: Part[] = []
  for (const band of [...w.warp, ...w.weft]) {
    Bd.push(mk(band.dir === 0 ? "N" : "I", rect(band.cut, band.w), band.t, rho))
  }

  return { ramme: mkList(R), band: mkList(Bd) }
}
