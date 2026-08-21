/**
 * BØYG — måltala.
 *
 * Alt er lese av geometrien som faktisk er bygd. Tre av tala er særeigne
 * for typologien og er verd å seia kva er:
 *
 * TVERRSNITTET. Eit pressbøygd skal er ikkje ei flat plate: krona på
 * tvers gjer det til eit grunt renne, og eit renne har eit heilt anna
 * motstandsmoment enn ei plate av same tjukn. Andrearealmomentet vert
 * difor rekna av det bøygde snittet — b·t³/12 pluss b·t gonger
 * kvadratavviket av krona — og det er DET som gjer at eit skal på sju
 * millimeter kan bera nokon i det heile.
 *
 * KRUMNINGSFAKTOREN. NS-EN 1995-1-1 punkt 6.4.3 set ned bøyekapasiteten i
 * eit bøygd felt: k_r = 0,76 + 0,001·r/t_lam, der t_lam er tjukna på det
 * einskilde laget. Difor er finértjukna eit skyvar og ikkje ein konstant —
 * tynne lag bøyer seg utan å tape kapasitet, tjukke lag betaler.
 *
 * BERANDE SKAL. Fanen er ein progressiv fjør: det ytste skalet søkk under
 * lasta og legg seg ned på det neste. Talet på skal innanfor det bandet
 * er målt i form.ts, og det er DET talet lasta vert delt på — ikkje talet
 * på skal i det heile.
 */
import {
  CUBE,
  MATERIALS,
  SEAT_LOAD,
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
} from "../core"
import { nest } from "../vaffel/nest"
import { bygg, DETAIL, krumFaktor, naerSt, snitt, soneR, type Bygg } from "./form"
import { lagMesh } from "./mesh"
import { buildParts } from "./parts"
import type { Params } from "./params"

const KMOD = 0.8
const GAMMA = 1.2

/** dei fire dybeltala: skjer i staven, hòltrykk i plata, kantavstand */
export function dybelTal(b: Bygg, p: Params) {
  const n = b.skal.length
  // Lasta vandrar mellom skala gjennom dybelen. Med n skal er det n−1
  // skjerplan, og kvart plan fører om lag same delen av lasta.
  const V = SEAT_LOAD / Math.max(1, n)
  const A = (Math.PI * p.pinnD * p.pinnD) / 4
  const tau = (4 * V) / (3 * A)
  // NS-EN 1995-1-1 (8.36): hòltrykk i kryssfinér
  const fh = 50 * Math.pow(p.plyT, 0.6) * Math.pow(p.pinnD, -0.3)
  const sigmaH = V / (p.pinnD * p.plyT)
  let kant = Infinity
  let skeiv = 0
  for (const sk of b.skal) {
    kant = Math.min(kant, sk.sPin, sk.len - sk.sPin)
    const q = naerSt(sk.st, sk.sPin)
    const dot = Math.abs(q.nx * b.pinD[0] + q.nz * b.pinD[1])
    skeiv = Math.max(skeiv, (Math.acos(Math.min(1, dot)) * 180) / Math.PI)
  }
  if (!Number.isFinite(kant)) kant = 0
  return { V, tau, sigmaH, capH: (fh * KMOD) / GAMMA, kant, skeiv, plan: Math.max(1, n - 1) }
}

export function measure(p: Params, pre?: Bygg): Metrics {
  const b = pre ?? bygg(p, DETAIL.mid)
  const mat = p.material as Material
  const cap = capacities(mat)
  const mesh = lagMesh(b, p, DETAIL.mid.nw)
  const pl = buildParts(b, p)
  const ns = nest(pl.parts)

  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- fotavtrykket ---------------------------------------------------------
  // Ein fot er ein KAPPA ENDE, ikkje eit punkt. Saleskjeringa avgjer om
  // han ligg flatt i golvet eller står på ein kant av finér, og difor vert
  // hylsteret bygd av dei punkta i endeflatene som faktisk er nede.
  const feet: Pt[] = []
  let contacts = 0
  for (const sk of b.skal) {
    for (const ende of [0, sk.st.length - 1]) {
      const q = sk.st[ende]
      let rørt = false
      for (const v of [-1, -0.5, 0, 0.5, 1]) {
        for (const sg of [-1, 1]) {
          const off = sg * (p.plyT / 2) + q.kr * (1 - v * v)
          const x = q.x + q.nx * off
          const z = q.z + q.nz * off
          if (z < 3.5) {
            feet.push([x, v * q.w])
            rørt = true
          }
        }
      }
      if (rørt) contacts++
    }
  }
  const h = hull(feet)
  const footArea = hullArea(h)
  let fx0 = Infinity
  let fx1 = -Infinity
  let fy0 = Infinity
  let fy1 = -Infinity
  for (const q of h) {
    fx0 = Math.min(fx0, q[0])
    fx1 = Math.max(fx1, q[0])
    fy0 = Math.min(fy0, q[1])
    fy1 = Math.max(fy1, q[1])
  }
  if (!Number.isFinite(fx0)) fx0 = fx1 = fy0 = fy1 = 0

  // --- masse ----------------------------------------------------------------
  // Dybelen går GJENNOM skala i nettet i staden for å vera skoren ut av
  // dei, so det overlappa godset ligg der to gonger. Det vert trekt frå
  // her i staden for å verta talt to gonger i vekta.
  const [vol, mz] = meshVolume(mesh)
  const dobbelt =
    b.skal.length * Math.PI * (p.pinnD / 2) ** 2 * p.plyT
  const volume = Math.max(1, Math.abs(vol) - dobbelt)
  const comZ = Math.abs(vol) > 0 ? Math.abs(mz) / Math.abs(vol) : 0
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  // --- velting --------------------------------------------------------------
  const tipArm = Math.max(0, armToHull(h, b.sitX, 0))
  const tipAngle = (Math.atan2(tipArm, Math.max(1, b.sitZ)) * 180) / Math.PI

  // --- styrken --------------------------------------------------------------
  // Topskalet er ein krum bjelke på to føter med lasta i sitjepunktet.
  // Momentet er F·a·b/L av dei VASSRETTE avstandane, av di reaksjonane er
  // loddrette — det er den same rekninga som for ein rett bjelke.
  const top = b.skal[0]
  const xF = top.st[0].x
  const xB = top.st[top.st.length - 1].x
  const L = Math.max(40, Math.abs(xF - xB))
  const a = Math.max(10, Math.abs(b.sitX - xB))
  const c2 = Math.max(10, Math.abs(xF - b.sitX))
  const F = SEAT_LOAD / Math.max(1, b.barande)
  const M = (F * a * c2) / L

  const sitSt = naerSt(top.st, top.len * 0.5)
  const wSit = 2 * Math.max(20, sitSt.w)
  const sec = snitt(p, wSit)
  // Krumninga i framfolden er der bøyinga i skalet fyrst gjev etter: der
  // er godset alt bøygd, og kapasiteten er sett ned av k_r.
  const rInn = Math.min(...top.soner.filter((s) => s.press).map(soneR))
  const kr = krumFaktor(rInn, p.finer)
  const sigmaM = M / Math.max(1, sec.W * kr)

  // trykk i framebeinet: reaksjonen delt på beintverrsnittet der det er smalast
  const Rf = (F * a) / L
  const fotSt = top.st[0]
  const legA = Math.max(50, 2 * fotSt.w * p.plyT)
  const sigmaC = Rf / legA
  const util = sigmaC / cap.capC + sigmaM / cap.capM

  // Det styrande snittet er IKKJE det smalaste — det er det som ber
  // momentet, altså tverrsnittet under sitjepunktet.
  const minSecArea = sec.A
  const minSecZ = b.sitZ

  const dy = dybelTal(b, p)
  const lagTal = Math.max(3, Math.round(p.plyT / p.finer))

  const mm = (v: number) => nn(v, 0) + " mm"
  const mm1 = (v: number) => nn(v, 1) + " mm"
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
  const pct = (v: number) => nn(v * 100, 0) + " %"

  const raw: [string, string, number, string, string][] = [
    ["envX", "ytre mål X", envX, "mm", mm1(envX)],
    ["envY", "ytre mål Y", envY, "mm", mm1(envY)],
    ["envZ", "høgd", envZ, "mm", mm1(envZ)],
    ["clearX", "klaring X", CUBE - envX, "mm", mm1(CUBE - envX)],
    ["clearY", "klaring Y", CUBE - envY, "mm", mm1(CUBE - envY)],
    ["clearZ", "klaring høgd", CUBE - envZ, "mm", mm1(CUBE - envZ)],
    ["seatZ", "setekant", b.seteZ0, "mm", mm(b.seteZ0)],
    ["sitZ", "sitjehøgd", b.sitZ, "mm", mm(b.sitZ)],
    ["seatW", "sete på tvers", b.seteW, "mm", mm(b.seteW)],
    ["seatD", "sete framover", b.seteD, "mm", mm(b.seteD)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", contacts, "stk", nn(contacts, 0)],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", nn(tipAngle, 1) + "°"],
    ["minR", "minste pressradius", b.minR, "mm", mm(b.minR)],
    ["rt", "radius mot tjukn", b.minR / p.plyT, "", nn(b.minR / p.plyT, 1)],
    ["lag", "finérlag", lagTal, "stk", nn(lagTal, 0)],
    ["krumf", "krumningsfaktor", kr, "", nn(kr, 2)],
    ["gap", "minste luft", b.minGap, "mm", mm1(b.minGap)],
    ["barande", "berande skal", b.barande, "stk", nn(b.barande, 0)],
    ["minSecArea", "styrande snitt", minSecArea, "mm²", cm2(minSecArea)],
    ["minSecZ", "snittet ligg", minSecZ, "mm", mm(minSecZ)],
    ["sigmaC", "trykkspenning", sigmaC, "MPa", nn(sigmaC, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaM", "bøyespenning", sigmaM, "MPa", nn(sigmaM, 2)],
    ["capM", "bøyekapasitet", cap.capM * kr, "MPa", nn(cap.capM * kr, 1)],
    ["util", "utnytting", util, "", pct(util)],
    ["dybelV", "skjer per plan", dy.V, "N", nn(dy.V, 0) + " N"],
    ["dybelT", "skjer i dybelen", dy.tau, "MPa", nn(dy.tau, 2)],
    ["holtrykk", "hòltrykk", dy.sigmaH, "MPa", nn(dy.sigmaH, 1)],
    ["kantavstand", "kantavstand", dy.kant, "mm", mm(dy.kant)],
    ["units", "skal", b.skal.length, "stk", nn(b.skal.length, 0)],
    ["parts", "delar", pl.parts.length + 1, "stk", nn(pl.parts.length + 1, 0)],
    ["kinds", "unike blankettar", pl.ids.length, "stk", nn(pl.ids.length, 0)],
    ["sheets", "plater", ns.sheets.length, "stk", nn(ns.sheets.length, 0)],
    ["plyArea", "finérareal", pl.area, "mm²", cm2(pl.area)],
    ["blank", "lengste blankett", b.skal[0].len, "mm", mm(b.skal[0].len)],
    ["volume", "godsvolum", volume, "mm³", dm3(volume)],
    ["massCut", "masse som kutta", pl.mass, "kg", nn(pl.mass, 2)],
    ["mass", "masse ferdig", mass, "kg", nn(mass, 2)],
  ]
  const list: Metric[] = raw.map((r) => metric(r[0], r[1], r[2], r[3], r[4]))

  return {
    envX,
    envY,
    envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ: b.seteZ0,
    sitZ: b.sitZ,
    seatW: b.seteW,
    seatD: b.seteD,
    footX: fx1 - fx0,
    footY: fy1 - fy0,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea,
    minSecZ,
    sigmaC,
    sigmaM,
    capC: cap.capC,
    capM: cap.capM * kr,
    util,
    volume,
    mass,
    massCut: pl.mass,
    parts: pl.parts.length + 1,
    plyArea: pl.area,
    units: b.skal.length,
    unitLabel: "skal",
    list,
  }
}
