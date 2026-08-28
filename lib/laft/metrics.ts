/**
 * LAFT — måla.
 *
 * Platene er prisme, og då er det ingen grunn til å måle eit nett: volum,
 * ytre mål og tyngdepunkt er EKSAKTE summar over konturane. Det er den
 * eine typologien der tala ikkje er tilnærmingar, og då skal dei heller
 * ikkje reknast som om dei var.
 *
 * `seatD` er ikkje plata si djupn. Det er det ein faktisk kan sitje på:
 * frå framkanten og bak til ryggen — plata går lenger, men ryggen står i
 * vegen, og eit tal som talde med det ville lyge om komforten.
 */
import {
  CUBE,
  MATERIALS,
  armToHull,
  capacities,
  hull,
  hullArea,
  metric,
  nn,
  shoelace,
  type Metric,
  type Metrics,
  type Pt,
} from "../core"
import { nest, usedArea } from "../vaffel/nest"
import { iKuben, stabel } from "./pakke"
import { bygg, delAreal, materialet, tilVerda } from "./profil"
import { lastVerste } from "./last"
import { buildParts } from "./parts"
import type { Params } from "./params"

/** talet på skilde stykke profilen har i høgd w */
function runsAt(outline: Pt[], holes: Pt[][], w: number): [number, number][] {
  const xs: number[] = []
  for (const ring of [outline, ...holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      if (a[1] > w === b[1] > w) continue
      xs.push(a[0] + ((w - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
  }
  xs.sort((u, v) => u - v)
  const ut: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > 0.5) ut.push([xs[i], xs[i + 1]])
  }
  return ut
}

export function measure(p: Params): Metrics {
  const b = bygg(p)
  const mat = materialet(p)
  const { capC, capM, rho } = capacities(mat)
  const pl = buildParts(p)
  const ns = nest(pl.parts)
  const sArea = usedArea(ns)

  // --- ytre mål: eksakt, av hjørna til kvar plate -------------------------
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  let volume = 0
  let momX = 0, momY = 0, momZ = 0
  for (const d of b.delar) {
    const A = delAreal(d)
    volume += A * d.t
    // tyngdepunktet til ein prisme: arealsenteret i planet, halve tjukna ut
    let cu = 0, cv = 0, aa = 0
    for (let i = 0; i < d.outline.length; i++) {
      const q = d.outline[i]
      const r = d.outline[(i + 1) % d.outline.length]
      const f = q[0] * r[1] - r[0] * q[1]
      aa += f
      cu += (q[0] + r[0]) * f
      cv += (q[1] + r[1]) * f
    }
    aa *= 0.5
    const c: Pt = aa !== 0 ? [cu / (6 * aa), cv / (6 * aa)] : [0, 0]
    const w = tilVerda(d.plass, c, d.t / 2)
    momX += w[0] * A * d.t
    momY += w[1] * A * d.t
    momZ += w[2] * A * d.t
    for (const q of d.outline) {
      for (const ww of [0, d.t]) {
        const v = tilVerda(d.plass, q, ww)
        if (v[0] < x0) x0 = v[0]
        if (v[0] > x1) x1 = v[0]
        if (v[1] < y0) y0 = v[1]
        if (v[1] > y1) y1 = v[1]
        if (v[2] < z0) z0 = v[2]
        if (v[2] > z1) z1 = v[2]
      }
    }
  }
  const envX = x1 - x0
  const envY = y1 - y0
  const envZ = z1 - Math.min(0, z0)
  const comZ = volume > 0 ? momZ / volume : 0
  const mass = (volume * rho) / 1e9

  // --- foten: føtene til dei to bladene -----------------------------------
  // Bladplana kryssar, so føtene kan ikkje reknast av eit spenn. Kvar
  // fot vert lagd ned i verda gjennom sitt eige blad si plassering, og
  // det konvekse hylsteret av dei fire er støtteflata.
  const blad = b.delar.filter((d) => d.kind === "bein")
  const golv: Pt[] = []
  let foterTal = 0
  for (const d of blad) {
    const foter = runsAt(d.outline, d.holes, 0.8)
    foterTal += foter.length
    for (const [sa, sb] of foter) {
      for (const s2 of [sa, sb]) {
        for (const w of [0, d.t]) {
          const q = tilVerda(d.plass, [s2, 0], w)
          golv.push([q[0], q[1]])
        }
      }
    }
  }
  const H = hull(golv)
  const footArea = hullArea(H)
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of H) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }
  const contacts = foterTal

  // --- setet ---------------------------------------------------------------
  const seatZ = b.seteTopp(b.xF)
  // brukbar djupn: framkanten fram til ryggen, ikkje heile plata
  const xRygg = b.delar.find((d) => d.kind === "rygg")!.plass.o[0]
  const seatD = Math.max(0, b.xF - xRygg)
  // Sitjebreidda vert MÅLT i omrisset, ikkje rekna av breiddetalet:
  // sigden og skjoldet og stadion har heilt ulik breidd der ein faktisk
  // sit, og eit tal som berre les `breidd` ville seie det same om alle
  // tre. Snittet ligg midt i den brukbare djupna.
  const sete0 = b.delar.find((d) => d.kind === "sete")!
  const uSnitt = (b.xF + xRygg) / 2 / Math.cos(b.a)
  let sw0 = Infinity
  let sw1 = -Infinity
  {
    const ring = sete0.outline
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (xi > uSnitt !== xj > uSnitt) {
        const y = yi + ((uSnitt - xi) * (yj - yi)) / (xj - xi)
        if (y < sw0) sw0 = y
        if (y > sw1) sw1 = y
      }
    }
  }
  const seatW = Number.isFinite(sw0) ? Math.max(0, sw1 - sw0) : 0
  const sitZ = b.seteTopp((b.xF + xRygg) / 2)

  // --- velting -------------------------------------------------------------
  const tipArm = H.length >= 3 ? armToHull(H, (b.xF + xRygg) / 2, 0) : 0
  const tipAngle = (Math.atan2(tipArm, Math.max(seatZ, 1e-6)) * 180) / Math.PI

  // --- styrken -------------------------------------------------------------
  const v = lastVerste(b)

  const sheetArea = sArea
  const sheetUtil = sheetArea > 0 ? pl.area / sheetArea : 0

  // --- pakken --------------------------------------------------------------
  // Eit flatpakka møbel har to former, og dette er den andre: bunten han
  // kjem som. Kuttarket seier kor mange plater jobben krev; pakken seier
  // kor stor stabelen vert, om han står i den same kuben som stolen, og
  // om det er eit hòl å bera han etter.
  const st = stabel(pl.parts)
  const kube = iKuben(st)

  const mm = (q: number) => nn(q, 0)
  const mm1 = (q: number) => nn(q, 1)
  const cm2 = (q: number) => nn(q / 100, 0) + " cm²"
  const dm3 = (q: number) => nn(q / 1e6, 2) + " dm³"
  const m2 = (q: number) => nn(q / 1e6, 2) + " m²"
  const pct = (q: number) => nn(q * 100, 0) + " %"
  const kg = (q: number) => nn(q, 2)
  const mpa = (q: number) => nn(q, 2)

  const raw: [string, string, number, string, (q: number) => string][] = [
    ["envX", "ytre mål X", envX, "mm", mm1],
    ["envY", "ytre mål Y", envY, "mm", mm1],
    ["envZ", "høgd", envZ, "mm", mm1],
    ["clearX", "klaring X", CUBE - envX, "mm", mm1],
    ["clearY", "klaring Y", CUBE - envY, "mm", mm1],
    ["clearZ", "klaring høgd", CUBE - envZ, "mm", mm1],

    ["seatZ", "setekant", seatZ, "mm", mm],
    ["sitZ", "sitjehøgd", sitZ, "mm", mm],
    ["seatW", "sitjeflate tvers", seatW, "mm", mm],
    ["seatD", "sitjeflate djup", seatD, "mm", mm],

    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm],
    ["footArea", "støtteflate", footArea, "mm²", cm2],
    ["contacts", "kontaktflater mot golvet", contacts, "stk", mm],
    ["comZ", "tyngdepunkt", comZ, "mm", mm],
    ["tipArm", "vippearm", tipArm, "mm", mm],
    ["tipAngle", "veltevinkel", tipAngle, "°", mm1],

    ["minSecArea", "styrande snitt", v.A, "mm²", cm2],
    ["minSecZ", "snittet ligg", v.z, "mm", mm],
    ["sigmaC", "trykkspenning", v.sc, "MPa", mpa],
    ["capC", "trykkapasitet", capC, "MPa", mpa],
    ["sigmaM", "bøyespenning", v.sm, "MPa", mpa],
    ["capM", "bøyekapasitet", capM, "MPa", mpa],
    ["util", "utnytting", v.util, "", pct],

    ["units", "plater", pl.parts.length, "stk", mm],
    ["spenn", "kryssvinkel", (2 * b.phi * 180) / Math.PI, "°", mm],
    ["overheng", "setet utanfor kryssarmen", b.overheng, "mm", mm],
    ["parts", "delar", pl.parts.length, "stk", mm],
    ["pakkeL", "pakken lang", st.L, "mm", mm],
    ["pakkeB", "pakken brei", st.B, "mm", mm],
    ["pakkeD", "pakken tjukk", st.D, "mm", mm],
    // 0 nei · 1 på skrå · 2 beint — eitt tal, av di tavla berre tek tal
    ["pakkeKube", "pakken i kuben", kube === "beint" ? 2 : kube === "på skrå" ? 1 : 0, "", mm],
    ["pakkeHank", "hank i pakken", st.hank ? 1 : 0, "", mm],
    ["pakkeInni", "delar inne i omslaget", st.inni, "stk", mm],

    ["sheets", "plater", ns.sheets.length, "stk", mm],
    ["sheetArea", "plate medgått", sheetArea, "mm²", m2],
    ["sheetUtil", "plateutnytting", sheetUtil, "", pct],
    ["plyArea", "finérareal", pl.area, "mm²", cm2],
    ["volume", "godsvolum", volume, "mm³", dm3],
    ["mass", "masse ferdig", mass, "kg", kg],
    ["massCut", "masse som emne", pl.mass, "kg", kg],
  ]

  const list: Metric[] = raw.map(([id, label, value, unit, fmt]) =>
    metric(id, label, value, unit, fmt(value)),
  )

  return {
    envX, envY, envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ, sitZ, seatW, seatD,
    footX: fx1 - fx0,
    footY: fy1 - fy0,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea: v.A,
    minSecZ: v.z,
    sigmaC: v.sc,
    sigmaM: v.sm,
    capC,
    capM,
    util: v.util,
    volume,
    mass,
    massCut: pl.mass,
    parts: pl.parts.length,
    plyArea: pl.area,
    sheets: ns.sheets.length,
    sheetArea,
    sheetUtil,
    units: pl.parts.length,
    unitLabel: "plater",
    list,
  }
}

export { shoelace }
