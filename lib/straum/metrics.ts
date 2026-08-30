/**
 * STRAUM — måla.
 *
 * Skilnaden på ein parameter og eit mål er heile poenget med fila: ein
 * parameter seier kva ein bad om, eit mål seier kva ein fekk. Kroppen kan
 * vera krympa inn i kuben, eit skiveplan kan ha gått ut av kroppen og late
 * eit stykke falle bort, og salen et av setekanten — så det ein bad om og
 * det som står der treng ikkje vera same tal.
 *
 * TRE TAL SOM MÅ NAMNGJEVAST I STADEN FOR Å GØYMAST:
 *
 *   `seatZ` er høgda på setekanten, målt som det høgste punktet på
 *   salranda. `sitZ` er der ein faktisk sit: arealvegd middelhøgd over den
 *   inste tredelen av setet. På denne salen ligg dei tretti millimeter frå
 *   kvarandre, og den skilnaden skal stå.
 *
 *   `mass` er den ferdige massen, rekna som arealet av dei vassrette
 *   snitta gjennom det som verkeleg er material — 24 finnar med luft
 *   imellom, ikkje ein massiv kropp — integrert over høgda. `massCut` er
 *   emna: heile plateareal gonga med tjukna. Den freste kroppen som eitt
 *   massivt stykke er eit tredje tal, og det står i lista for seg, av di
 *   det er det talet biletet viser.
 *
 *   `minSecArea` er ikkje det minste snittet. Det er det STYRANDE: areal
 *   og utmiddel dreg kvar sin veg oppover, og utnyttinga vert rekna i
 *   kvart snitt og maksimum teke. Leitte ein etter minste AREAL, ville
 *   svaret vore sett av kvar sveipet sluttar og ikkje av geometrien.
 */
import {
  CUBE,
  MATERIALS,
  armToHull,
  capacities,
  hull,
  hullArea,
  meshVolume,
  metric,
  nn,
  type Material,
  type Metric,
  type Metrics,
  type Pt,
  keep,
} from "../core"
import { makeBody, type Body } from "./body"
import { lastProfil, snittMaskin } from "./last"
import { nest } from "./nest"
import { buildParts, type Build } from "./parts"
import { buildMesh, DETAIL } from "./surface"
import type { Params } from "./params"

const TAU = Math.PI * 2

/** kor høgt over botnen av salen den brukbare sitjeflata vert lesen, mm */
const SIT_BAND = 0.62

export type Prebuilt = { body?: Body; build?: Build }

const MAAL_NETT = keep<ReturnType<typeof buildMesh>>(2)

export function measure(p: Params, pre: Prebuilt = {}): Metrics {
  const bd = pre.body ?? makeBody(p)
  const B = pre.build ?? buildParts(bd)
  const mat: Material = (p.material as Material) in MATERIALS ? (p.material as Material) : "bjork"
  const { capC, capM, rho } = capacities(mat)
  const { cosA } = bd.frame

  // --- ytre mål -----------------------------------------------------------
  // Midtre detaljnivå: boksen er den same på «lav» som på «hog» til under
  // ein tidels millimeter, men volumet av den massive kroppen er det
  // ikkje — eit grovt nett skriv inn ytterflata og skriv ut hola, og då
  // slår begge feila same vegen.
  // målinga sitt eige nett — vert aldri sendt, og kan difor hugsast
  const mesh = MAAL_NETT(JSON.stringify(p), () => buildMesh(p, DETAIL.mid, bd))
  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]
  const [solidVol] = meshVolume(mesh)

  // --- foten --------------------------------------------------------------
  // Kontaktpunkta er dei hjørna i nettet som ligg i golvplanet. Eit punkt
  // eit par millimeter oppe ber ingen ting, og der veggen svulmar utover
  // frå golvkanten ville det blåse opp støtteflata og gjeve ein
  // veltevinkel som er for snill.
  const floor: Pt[] = []
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i + 2] < 0.01) floor.push([mesh.positions[i], mesh.positions[i + 1]])
  }
  const Hull = hull(floor)
  const footArea = hullArea(Hull)
  let fx0 = Infinity
  let fx1 = -Infinity
  let fy0 = Infinity
  let fy1 = -Infinity
  for (const q of floor) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  const footX = floor.length ? fx1 - fx0 : 0
  const footY = floor.length ? fy1 - fy0 : 0
  // Kor mange skilde flater objektet står på. STRAUM står på ein
  // samanhengande sokkel, så talet er eitt — men det vert talt og ikkje
  // skrive inn, av di eit tomrom som når ned i sokkelen ville dele han.
  let contacts = 0
  const on: boolean[] = []
  for (let i = 0; i < 720; i++) on.push(bd.ri((i / 720) * TAU, 0.5) < bd.ro((i / 720) * TAU, 0.5))
  if (on.every(Boolean)) contacts = 1
  else for (let i = 0; i < 720; i++) if (!on[i] && on[(i + 1) % 720]) contacts++

  // --- setet --------------------------------------------------------------
  const NT = 720
  let seatZ = -Infinity
  const rim: Pt[] = []
  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * TAU
    const q = bd.outer(th, bd.zTop(th))
    if (q[2] > seatZ) seatZ = q[2]
    rim.push([q[0], q[1]])
  }
  // Brukbar sitjeflate: randa trekt inn med setekantradien, av di ein sit
  // ikkje på ei avrunding. Talet er difor mindre enn ytre mål, og det er
  // meininga.
  const cs = bd.ctr(bd.H)
  let sx0 = Infinity
  let sx1 = -Infinity
  let sy0 = Infinity
  let sy1 = -Infinity
  for (const q of rim) {
    const dx = q[0] - cs[0]
    const dy = q[1] - cs[1]
    const r = Math.hypot(dx, dy) || 1
    const s = Math.max(0, r - p.kantR) / r
    const x = cs[0] + dx * s
    const y = cs[1] + dy * s
    if (x < sx0) sx0 = x
    if (x > sx1) sx1 = x
    if (y < sy0) sy0 = y
    if (y > sy1) sy1 = y
  }
  const seatD = sx1 - sx0
  const seatW = sy1 - sy0

  // Der ein faktisk sit: arealvegd middelhøgd over den inste delen av
  // salen. Setekanten er eit anna tal, og på ein sal er skilnaden det
  // meste av salsøkket.
  let wSum = 0
  let zSum = 0
  for (let i = 0; i < 240; i++) {
    const th = (i / 240) * TAU
    const j = Math.round((i / 240) * NT) % NT
    for (let k = 1; k <= 12; k++) {
      const q = ((k - 0.5) / 12) * SIT_BAND
      const x = cs[0] + q * (rim[j][0] - cs[0])
      const y = cs[1] + q * (rim[j][1] - cs[1])
      const dA = q
      wSum += dA
      zSum += dA * bd.seatTop(x, y)
    }
  }
  const sitZ = wSum > 0 ? zSum / wSum : seatZ

  // --- velting ------------------------------------------------------------
  // Lasta kjem inn ved setet og ikkje ved objektet sitt eige tyngdepunkt:
  // ein person på 80 kg gjer dei sju kiloa i krakken til avrunding, og då
  // er det setehøgda som er armen. Talet er difor konservativt og kan
  // samanliknast med dei som står i litteraturen — men det er framleis
  // rekna og ikkje målt, og NS-EN 1022 må prøvast fysisk.
  const tipArm = Hull.length >= 3 ? armToHull(Hull, cs[0], cs[1]) : 0
  const tipAngle = (Math.atan2(tipArm, Math.max(seatZ, 1e-6)) * 180) / Math.PI

  // --- snittet gjennom det som verkeleg er material -----------------------
  // Maskineriet bur i last.ts og tener tavla, volumintegralet og
  // lastkartet med SAME snitta — difor kan ikkje kartet og tavla seie
  // kvar sitt tal.
  const mask = snittMaskin(p, bd, B)
  const lp = lastProfil(mask, bd.H, p.kappeT)
  const worst = lp.verste
  const minSecArea = worst.A
  const minSecZ = worst.z
  const sigmaC = worst.sc
  const sigmaM = worst.sm
  const util = worst.util

  // --- volum og tyngdepunkt -----------------------------------------------
  // Same snittet, integrert over høgda. Det er den einaste ærlege massen
  // for denne typologien: den freste kroppen er ikkje massiv, han er 24
  // finnar med luft imellom, og lufta veg ingen ting.
  let volume = 0
  let mom = 0
  const band = (z0: number, z1: number, n: number) => {
    if (!(z1 - z0 > 0.5)) return
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n
      const segs = mask.cut(z)
      let A = 0
      for (const s of segs) A += s.dA
      volume += (A * (z1 - z0)) / n
      mom += (A * z * (z1 - z0)) / n
    }
  }
  band(0, mask.zS0, 8)
  band(mask.zS0, mask.zS1, 120)
  band(mask.zS1, bd.H, 24)
  const comZ = volume > 0 ? mom / volume : 0
  const mass = (volume * rho) / 1e9

  let plyArea = 0
  let massCut = 0
  let legs = 0
  for (const q of B.parts) {
    plyArea += q.area
    massCut += q.mass
  }
  for (const q of B.fins) legs += q.legs

  // --- plata ----------------------------------------------------------------
  // Avfallsrekninga på arket. Nemnaren er den stripa av arka som faktisk
  // går gjennom maskina — breidda gonger brukt lengd, summert — same
  // rekning som i dei andre motorane, så talet kan samanliknast.
  const nst = nest(B.parts)
  const sheetArea = nst.sheets.reduce((s, q) => s + q.used * q.w, 0)
  const sheetUtil = sheetArea > 0 ? nst.used / sheetArea : 0

  const mm = (v: number) => nn(v, 0)
  const mm1 = (v: number) => nn(v, 1)
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
  const m2 = (v: number) => nn(v / 1e6, 2) + " m²"
  const pct = (v: number) => nn(v * 100, 0) + " %"
  const kg = (v: number) => nn(v, 2)
  const mpa = (v: number) => nn(v, 2)

  const raw: [string, string, number, string, (v: number) => string][] = [
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
    ["saddle", "salsøkk, målt", seatZ - sitZ, "mm", mm1],

    ["footX", "fotavtrykk X", footX, "mm", mm],
    ["footY", "fotavtrykk Y", footY, "mm", mm],
    ["footArea", "støtteflate", footArea, "mm²", cm2],
    ["contacts", "kontaktflater mot golvet", contacts, "stk", mm],
    ["comZ", "tyngdepunkt", comZ, "mm", mm],
    ["tipArm", "vippearm", tipArm, "mm", mm],
    ["tipAngle", "veltevinkel", tipAngle, "°", mm1],

    ["minSecArea", "styrande snitt", minSecArea, "mm²", cm2],
    ["minSecZ", "snittet ligg", minSecZ, "mm", mm],
    ["sigmaC", "trykkspenning", sigmaC, "MPa", mpa],
    ["capC", "trykkapasitet", capC, "MPa", mpa],
    ["sigmaM", "bøyespenning", sigmaM, "MPa", mpa],
    ["capM", "bøyekapasitet", capM, "MPa", mpa],
    ["util", "utnytting", util, "", pct],

    ["units", "finnar", B.fins.length, "stk", mm],
    ["planes", "skiveplan i bruk", B.usedPlanes, "stk", mm],
    ["pitch", "finnedeling", bd.pitch, "mm", mm1],
    ["legs", "bein i midja", legs, "stk", mm],
    ["gap", "luft mellom finnane", bd.pitch * cosA - p.finneT, "mm", mm1],
    ["slot", "sporbreidd i planet", p.finneT / cosA + p.pressfit, "mm", mm1],
    ["parts", "delar", B.parts.length, "stk", mm],
    ["sheets", "plater", nst.sheets.length, "stk", mm],
    ["sheetArea", "plate medgått", sheetArea, "mm²", m2],
    ["sheetUtil", "plateutnytting", sheetUtil, "", pct],
    ["plyArea", "finérareal", plyArea, "mm²", cm2],
    ["volume", "godsvolum", volume, "mm³", dm3],
    ["solid", "kroppen som massiv", solidVol, "mm³", dm3],
    ["mass", "masse ferdig", mass, "kg", kg],
    ["massCut", "masse som emne", massCut, "kg", kg],
  ]

  const list: Metric[] = raw.map(([id, label, value, unit, fmt]) =>
    metric(id, label, value, unit, fmt(value)),
  )

  return {
    envX,
    envY,
    envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ,
    sitZ,
    seatW,
    seatD,
    footX,
    footY,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea,
    minSecZ,
    sigmaC,
    sigmaM,
    capC,
    capM,
    util,
    volume,
    mass,
    massCut,
    parts: B.parts.length,
    plyArea,
    sheets: nst.sheets.length,
    sheetArea,
    sheetUtil,
    units: B.fins.length,
    unitLabel: "finnar",
    list,
  }
}
