/**
 * FLETT — måltala.
 *
 * SIGEN er tyngdepunktet i heile fila. Ein vev er ikkje ei plate: han ber
 * ikkje ved å bøye seg, han ber ved å STREKKJE seg, og eit band som er
 * strekt må søkke for å få ein vinkel å ta lasta i. Sigen er difor ikkje
 * eit tap — han er sjølve verkemåten, og han er samstundes komforten.
 *
 * Modellen er kabelen med førespenn. Eit band med spennet L, tverrsnittet
 * A og førespenninga T0 som får lasta P på midten, tek ho i to ledd:
 *
 *     P = 4·T0·δ/L        (førespenninga er der frå fyrste millimeter)
 *       + 32·E·A·δ³/(3L³) (strekket bandet SJØLV byggjer opp av å søkke)
 *
 * Det fyrste leddet er lineært i sigen, det andre kubisk. Ein slakk vev
 * lever på det andre og søkk mykje; ein stramt oppspent vev lever på det
 * fyrste og søkk lite — og betalar for det med ei ramme som må halde
 * strekket heile tida, ikkje berre når nokon sit.
 *
 * Alle banda under sitjeflekken søkk LIKT (dei er fletta i kvarandre), og
 * difor deler dei lasta i høve til si eiga stivleik. Det er den einaste
 * staden i sandkassen der lastdelinga fylgjer av at delane er bundne
 * saman og ikkje av kor mange dei er.
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
import { DETAIL, lagMesh } from "./mesh"
import { buildParts } from "./parts"
import { makeWeave, type Weave } from "./weave"
import type { Params } from "./params"

const DEG = Math.PI / 180
/**
 * Sitjeflekken. Standarden last gjennom ein pute på 200 mm, men i ein vev
 * er interlocken sjølv ein lastspreiar: eit band som vert pressa ned dreg
 * grannane sine med seg gjennom krysspunkta. Tre hundre millimeter er den
 * flata ein vaksen faktisk kviler på, og det er DEN skilnaden mellom eit
 * band og ei plate som gjer det talet forsvarleg her.
 */
const PATCH = 300

export type Krefter = {
  /** sig under 1600 N, mm */
  sig: number
  /** strekk i det hardast lasta bandet, N */
  Tmax: number
  /** strekkspenning i bandet, MPa */
  sigmaBand: number
  /** samla innoverdrag frå renninga og frå innslaget, N */
  Fren: number
  Finn: number
  /** trykkspenning i ramma, MPa */
  sigmaRimC: number
  /** bøyespenning i ramma, MPa */
  sigmaRimM: number
  /** kor mykje ramma spriker, mm */
  sprik: number
  /** minste bøyeradius i heile veven, mm og kva som krevst */
  rmin: number
  rKrav: number
  /** festet sin eigen bøyeradius, og kravet der */
  rFeste: number
  rFesteKrav: number
  /** ramma sitt effektive tverrsnitt etter at festet har ete av det, mm² */
  aRim: number
}

/** eitt band sitt bidrag: tverrsnitt, spenn */
type Streng = { A: number; L: number }

/**
 * Kabelen med førespenn, løyst med halvering. Funksjonen er strengt
 * veksande i δ, so halvering treffer alltid, og han treng inga startgissing
 * som kan sprike.
 */
function solveSag(strenger: Streng[], E: number, eps0: number, P: number): number {
  if (!strenger.length) return 0
  let lin = 0
  let kub = 0
  for (const s of strenger) {
    lin += (4 * eps0 * E * s.A) / s.L
    kub += (32 * E * s.A) / (3 * s.L * s.L * s.L)
  }
  if (kub <= 0 && lin <= 0) return 0
  const f = (d: number) => lin * d + kub * d * d * d
  let lo = 0
  let hi = 1
  while (f(hi) < P && hi < 4096) hi *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < P) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function krefter(p: Params, w: Weave): Krefter {
  const E = w.E
  const eps0 = p.spenn * 0.0015 // 0,15 % tøying er så stramt ein vev vert spent

  // --- kven ligg under sitjeflekken? ---------------------------------------
  const under: Streng[] = []
  const alle: { A: number; L: number; under: boolean; dir: 0 | 1 }[] = []
  for (const band of w.warp) {
    const A = band.w * band.t
    const L = Math.max(40, band.spenn)
    const inn = Math.abs(band.pos) <= PATCH / 2
    alle.push({ A, L, under: inn, dir: 0 })
    if (inn) under.push({ A, L })
  }
  for (const band of w.weft) {
    const A = band.w * band.t
    const L = Math.max(40, band.spenn)
    const x = w.a - band.pos
    const inn = Math.abs(x) <= PATCH / 2 && band.pos <= w.sSeat
    alle.push({ A, L, under: inn, dir: 1 })
    if (inn) under.push({ A, L })
  }

  const sig = solveSag(under, E, eps0, SEAT_LOAD)

  // --- strekk band for band -------------------------------------------------
  // σ = T/A = ε0·E + 8·E·δ²/(3L²). Det andre leddet er uavhengig av
  // tverrsnittet: eit tjukkare band tek meir KRAFT, men ikkje meir
  // spenning. Difor er det spennet og sigen, og ikkje bandbreidda, som
  // avgjer om veven held.
  let Tmax = 0
  let sigmaBand = 0
  let Fren = 0
  let Finn = 0
  for (const q of alle) {
    const s = eps0 * E + (q.under ? (8 * E * sig * sig) / (3 * q.L * q.L) : 0)
    const T = s * q.A
    if (T > Tmax) Tmax = T
    if (s > sigmaBand) sigmaBand = s
    if (q.dir === 0) Fren += T
    else Finn += T
  }

  // --- ramma ----------------------------------------------------------------
  // Festet et av ramma sitt tverrsnitt: slissa er eit sagsnitt tvers
  // gjennom godset, leppa er ein fals i overkanten. Omslaget tek ingen ting
  // — det er den eine gongen den vanskelegaste bøyinga gjev den sterkaste
  // ramma.
  const tB = Math.max(p.renT, p.innT)
  const dyp = Math.min(p.kant, p.rammeH - 10)
  const aFull = p.rammeT * p.rammeH
  const aRim =
    p.feste === 1 ? aFull : Math.max(aFull * 0.35, aFull - tB * Math.max(0, dyp))

  const lukka = p.rammetype === 0
  let sigmaRimC = 0
  let sigmaRimM = 0
  let sprik = 0
  const I = (p.rammeT * p.rammeH * p.rammeH * p.rammeH) / 12
  if (lukka) {
    // Ein heil ring tek eit jamt innoverdrag som REIN RINGTRYKK. Det er
    // heile grunnen til at hanken er den sterkaste lukkinga: krafta går
    // aldri gjennom eit bøyemoment.
    const N = Math.max(Fren, Finn) / 2
    sigmaRimC = N / Math.max(1, aRim)
    sprik = (N * Math.max(w.a, w.b)) / Math.max(1, E * aRim)
  } else {
    const L1 = p.rammetype === 1 ? p.breidd : p.breidd * 0.72
    const L2 = p.rammetype === 1 ? p.djup : p.djup * 0.72
    // To bogar heng saman kring hjørna sine og verkar som ei LUKKA
    // portalramme i planet: momentet i hjørnet er qL²/12. Fire lause
    // rammebitar mellom fire bein er leddlagde og får qL²/8 på midten.
    // Skilnaden er halvanna gong, og det er heile grunnen til at ein
    // vel den eine lukkinga framfor den andre.
    const kf = p.rammetype === 1 ? 12 : 8
    const hTie = p.rammetype === 1 ? p.rammeH * 0.8 : p.rammeH
    const Wt = (p.rammeT * hTie * hTie) / 6
    const Wr = (p.rammeT * p.rammeH * p.rammeH) / 6
    const It = (p.rammeT * hTie * hTie * hTie) / 12
    const del = p.rammetype === 1 ? 1 : 2
    const M1 = (Fren / del) * (L1 / kf)
    const M2 = (Finn / del) * (L2 / kf)
    sigmaRimM = Math.max(M1 / Math.max(1, Wt), M2 / Math.max(1, Wr))
    sigmaRimC = (Math.max(Fren, Finn) / 4) / Math.max(1, aRim)
    const d1 = (5 * (Fren / del) * L1 * L1 * L1) / (384 * E * Math.max(1, It))
    const d2 = (5 * (Finn / del) * L2 * L2 * L2) / (384 * E * Math.max(1, I))
    sprik = Math.max(d1, d2)
  }

  // --- bøyeradius -----------------------------------------------------------
  // Kravet er BANDET SITT EIGE: eit tynt band toler ein trongare radius
  // enn eit tjukt, og renninga og innslaget treng ikkje ha same tjukn. Det
  // som skal rapporterast er difor ikkje den minste radien i veven, men
  // den radien som ligg NÆRAST sitt eige krav — og det er ikkje alltid
  // same band.
  let verst = Infinity
  let rmin = 1e6
  let rKrav = p.boygtal * tB
  for (const band of [...w.warp, ...w.weft]) {
    const krav = p.boygtal * band.t
    const rel = band.rmin / Math.max(0.001, krav)
    if (rel < verst) {
      verst = rel
      rmin = band.rmin
      rKrav = krav
    }
  }

  // Festet er ei ANNA bøying: bandet vert bløytt, bøygd og STRAKS bunde.
  // Ei slik bøying er ei varig form, ikkje ei elastisk, og finér toler ho
  // ned mot seks gonger tjukna — mot dei hundre til hundre og femti ei
  // kald, fri bøying krev. Slissa og leppa bøyer ikkje bandet i det heile.
  const rFeste = Math.min(
    p.feste === 1 ? p.rammeT / 2 : 1e6,
    w.hVev > 0 ? w.Rk : 1e6,
  )
  const rFesteKrav = rFeste < 1e5 ? 6 * tB : 0

  return {
    sig, Tmax, sigmaBand, Fren, Finn,
    sigmaRimC, sigmaRimM, sprik, rmin, rKrav, rFeste, rFesteKrav, aRim,
  }
}


// =============================================================================
// GEOMETRI SOM BÅDE MÅLINGA OG REPARASJONEN LES
// =============================================================================
/** midlere høgd på vevmidtplanet over sitjeflekken, tom */
export function seatMean(w: Weave): number {
  let sum = 0
  let n = 0
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const x = (i / 3) * (PATCH / 2)
      const y = (j / 3) * (PATCH / 2)
      if (Math.abs(x) > w.a * 0.94 || Math.abs(y) > w.b * 0.94) continue
      sum += w.zm(x, y)
      n++
    }
  }
  return n ? sum / n : w.zRim(0) + w.rimOff
}

/** føtene sine hjørne på golvet, og boksen kring dei */
export function footprint(w: Weave) {
  const p = w.p
  const feet: Pt[] = []
  const zTop0 = w.zRim(0) + w.rimOff - p.rammeT
  const fas = Math.min(p.fotfas, p.beinB / 2 - 6)
  for (const leg of w.legs) {
    const r0 = w.innR(leg.th) + p.rammeH / 2
    const dR = Math.tan(p.spreie * DEG) * Math.max(0, zTop0)
    const ct = Math.cos(leg.th)
    const st = Math.sin(leg.th)
    const hw = p.beinB / 2 - Math.max(0, fas)
    const ht = p.rammeT / 2
    for (const a of [-hw, hw]) {
      for (const b of [-ht, ht]) {
        feet.push([(r0 + dR + a) * ct - b * st, (r0 + dR + a) * st + b * ct])
      }
    }
  }
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of feet) {
    fx0 = Math.min(fx0, q[0]); fx1 = Math.max(fx1, q[0])
    fy0 = Math.min(fy0, q[1]); fy1 = Math.max(fy1, q[1])
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }
  return { feet, contacts: w.legs.length, fx0, fx1, fy0, fy1, zTop0 }
}

/**
 * Det tynnaste vassrette snittet under setet. Under ramma finst det berre
 * bein, og beinet er smalast der bogeforma har teke mest av det — difor
 * vert høgda skanna og ikkje gissa.
 */
export function legSection(w: Weave) {
  const p = w.p
  const zTop0 = w.zRim(0) + w.rimOff - p.rammeT
  const rot = Math.min(p.rammeH * 1.7, Math.max(p.beinB * 1.35, p.beinB + 24))
  let area = Infinity
  let z = 0
  for (let q = 0; q <= 20; q++) {
    const t = q / 20
    const hw =
      p.beinB / 2 +
      ((rot - p.beinB) / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, p.bogeN)), 1 / p.bogeN)
    const A = 2 * hw * p.rammeT * w.legs.length
    if (A < area) {
      area = A
      z = zTop0 * (1 - t)
    }
  }
  if (!Number.isFinite(area) || area < 1) area = 1
  return { area, z }
}

// =============================================================================
// MÅLINGA
// =============================================================================
export function measure(p: Params, pre?: Weave): Metrics {
  const w = pre ?? makeWeave(p)
  const mat = p.material as Material
  const cap = capacities(mat)
  const mesh = lagMesh(w, DETAIL.mid.k)
  const pl = buildParts(w)
  const nsR = nest(pl.ramme.parts)
  const nsB = nest(pl.band.parts)
  const kr = krefter(p, w)

  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- setet ---------------------------------------------------------------
  const seatZ = w.zRim(w.a + p.rammeH / 2) + w.rimOff
  // Sitjehøgda er der ein FAKTISK sit, og i ein vev er det under sigen.
  // Det er ikkje ein finesse: ni millimeter er meir enn heile bandtjukna.
  const sitZ = seatMean(w) - kr.sig

  // sitjeflata er der VEVEN er, ikkje der ramma er: ytterkantane av
  // ytterbanda kvar veg
  const seatW = w.ys.length ? w.ys[w.ys.length - 1] - w.ys[0] + p.renW : 0
  const seteS = w.stasjonar.filter((q) => !q.bak)
  const seatD = seteS.length ? seteS[seteS.length - 1].s - seteS[0].s + p.innW : 0

  const fp = footprint(w)
  const feet = fp.feet
  const contacts = fp.contacts
  const h = hull(feet)
  const footArea = hullArea(h)
  const { fx0, fx1, fy0, fy1 } = fp

  // Banda stikk tampane sine inn i ramma, so overlappen vert talt to
  // gonger. Han er under ein promille av godset og står att med vilje:
  // eit nett som er kutta reint i festet er eit nett med hòl i.
  const [vol, mz] = meshVolume(mesh)
  const volume = Math.abs(vol)
  const comZ = volume > 0 ? Math.abs(mz) / volume : 0
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  const tipArm = Math.max(0, armToHull(h, 0, 0))
  const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI

  // --- det styrande vassrette snittet ---------------------------------------
  const sec = legSection(w)
  const minSecArea = sec.area
  const minSecZ = sec.z

  const sigmaCLeg = SEAT_LOAD / minSecArea
  const sigmaC = Math.max(sigmaCLeg, kr.sigmaRimC)
  // sigmaM er slottet for den spenninga som vert prøvd mot bøyekapasiteten.
  // I ein vev er det STREKKET I BANDET: for kryssfinér ligg ft,0,k og fm,k
  // så nær kvarandre at fm,k er den rette og forsvarlege målestokken.
  const sigmaM = kr.sigmaBand

  const utilBand = kr.sigmaBand / cap.capM
  const utilRamme = kr.sigmaRimC / cap.capC + kr.sigmaRimM / cap.capM
  const utilBein = sigmaCLeg / cap.capC
  // Bandet, ramma og beinet er TRE ULIKE DELAR, og ei last som er kritisk
  // i det eine er ikkje kritisk i det andre. Difor er samla utnytting den
  // verste av dei tre, ikkje summen — å leggje dei saman ville vera å
  // straffe eit band for eit bein det aldri deler snitt med.
  const util = Math.max(utilBand, utilRamme, utilBein)

  const bandAreal = pl.band.area
  const kryss = w.warp.reduce((s, q) => s + q.kryss, 0)
  const opningar = Math.max(0, (w.ys.length - 1) * (w.stasjonar.length - 1))

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
    ["seatZ", "rammekant", seatZ, "mm", mm(seatZ)],
    ["sitZ", "sitjehøgd under last", sitZ, "mm", mm(sitZ)],
    ["sig", "sig under 1600 N", kr.sig, "mm", mm1(kr.sig)],
    ["seatW", "vev på tvers", seatW, "mm", mm(seatW)],
    ["seatD", "vev framover", seatD, "mm", mm(seatD)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", contacts, "stk", nn(contacts, 0)],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", nn(tipAngle, 1) + "°"],
    ["rmin", "minste bøyeradius", kr.rmin, "mm", mm(kr.rmin)],
    ["rKrav", "kravd bøyeradius", kr.rKrav, "mm", mm(kr.rKrav)],
    ["minSecArea", "styrande snitt", minSecArea, "mm²", cm2(minSecArea)],
    ["minSecZ", "snittet ligg", minSecZ, "mm", mm(minSecZ)],
    ["Tmax", "største bandstrekk", kr.Tmax, "N", nn(kr.Tmax, 0) + " N"],
    ["sigmaM", "strekk i bandet", sigmaM, "MPa", nn(sigmaM, 2)],
    ["capM", "strekkapasitet", cap.capM, "MPa", nn(cap.capM, 1)],
    ["sigmaC", "trykk i ramme og bein", sigmaC, "MPa", nn(sigmaC, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaRimM", "bøying i ramma", kr.sigmaRimM, "MPa", nn(kr.sigmaRimM, 2)],
    ["sprik", "ramma spriker", kr.sprik, "mm", mm1(kr.sprik)],
    ["util", "utnytting", util, "", pct(util)],
    ["renningar", "renningar", w.warp.length, "stk", nn(w.warp.length, 0)],
    ["innslag", "innslag", w.weft.length, "stk", nn(w.weft.length, 0)],
    ["kryss", "krysspunkt", kryss, "stk", nn(kryss, 0)],
    ["opningar", "opningar i veven", opningar, "stk", nn(opningar, 0)],
    ["luft", "minste luft i veven", Math.min(w.gapRen, w.gapInn), "mm", mm1(Math.min(w.gapRen, w.gapInn))],
    ["bandL", "band i alt", w.warp.concat(w.weft).reduce((s, q) => s + q.cut, 0), "mm",
      nn(w.warp.concat(w.weft).reduce((s, q) => s + q.cut, 0) / 1000, 2) + " m"],
    ["parts", "delar", pl.ramme.parts.length + pl.band.parts.length, "stk",
      nn(pl.ramme.parts.length + pl.band.parts.length, 0)],
    ["kinds", "unike delar", pl.ramme.ids.length + pl.band.ids.length, "stk",
      nn(pl.ramme.ids.length + pl.band.ids.length, 0)],
    ["sheets", "plater", nsR.sheets.length + nsB.sheets.length, "stk",
      nn(nsR.sheets.length + nsB.sheets.length, 0)],
    ["plyArea", "finérareal", pl.ramme.area + bandAreal, "mm²", cm2(pl.ramme.area + bandAreal)],
    ["volume", "godsvolum", volume, "mm³", dm3(volume)],
    ["massCut", "masse som kutta", pl.ramme.mass + pl.band.mass, "kg", nn(pl.ramme.mass + pl.band.mass, 2)],
    ["mass", "masse ferdig", mass, "kg", nn(mass, 2)],
  ]
  const list: Metric[] = raw.map((r) => metric(r[0], r[1], r[2], r[3], r[4]))

  return {
    envX, envY, envZ,
    clearX: CUBE - envX, clearY: CUBE - envY, clearZ: CUBE - envZ,
    seatZ, sitZ, seatW, seatD,
    footX: fx1 - fx0, footY: fy1 - fy0, footArea, contacts, comZ, tipArm, tipAngle,
    minSecArea, minSecZ,
    sigmaC, sigmaM, capC: cap.capC, capM: cap.capM, util,
    volume, mass, massCut: pl.ramme.mass + pl.band.mass,
    parts: pl.ramme.parts.length + pl.band.parts.length,
    plyArea: pl.ramme.area + bandAreal,
    units: w.warp.length + w.weft.length,
    unitLabel: "band",
    list,
  }
}
